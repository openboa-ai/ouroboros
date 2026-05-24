import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CandidateInspectReadModel,
  CandidateMaterializationInput,
  FullCycleLineageReadModel,
  LedgerInput,
  Ref,
  SystemCodeRecord,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import type { LocalStore } from "@ouroboros/local-store";
import { safeId } from "./safe-id";
import {
  createGatewayRuntimeBinding,
  executeGatewayOrderRequest,
  startPaperTradingApiProvider,
  type GatewayRuntimeBinding
} from "./trading-gateway-runtime-binding";
import {
  HostTradingArtifactRunner,
  readTradingSystemManifest
} from "./trading-research/artifact-runner";
import {
  FixtureTradingResearchAgentAdapter
} from "./trading-research/agent-adapters";
import {
  runTradingResearchLoop
} from "./trading-research/run-trading-research";
import type {
  ArtifactRunResult,
  ManagedResearchAgent,
  OrderRequest,
  TradingEvaluationResult,
  TradingResearchAgentAdapter,
  TradingResearchDecision,
  TradingResearchLoopResult,
  TradingResearchNotebookEntry
} from "./trading-research/types";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export interface RunAgentTradingCycleInput {
  store: LocalStore;
  sourceSystemId: string;
  sourceCandidateVersionId: string;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
  gatewayRuntimeBinding?: GatewayRuntimeBinding;
  agentAdapter?: TradingResearchAgentAdapter;
  iterations?: number;
  repoRoot?: string;
}

export interface AgentTradingCycleOutcome {
  status: "completed";
  source_system_id: string;
  source_candidate_version_id: string;
  agent_research: {
    session_id: string;
    run_root: string;
    notebook_path: string;
    agent: ManagedResearchAgent;
    best_score?: number;
    best_artifact_dir: string;
    latest_decision: TradingResearchDecision;
    latest_summary: string;
  };
  system_code_handoff: {
    system_code_id: string;
    artifact_path: string;
    artifact_digest: string;
    runtime_kind: "python";
    declared_output_kinds: string[];
    generated_by_agent: true;
    authority_status: "not_live";
  };
  backtest: TradingEvaluationResult;
  full_cycle_lineage: FullCycleLineage;
  next_trading_system: CandidateInspectReadModel;
  trading_run_id: string;
  trading_run: {
    ref: Ref;
    stage: string;
    lifecycle_status?: string;
    authority_status: string;
  };
  paper_trading: {
    run_status: ArtifactRunResult["status"];
    events_path: string;
    provider_request_count: number;
    authority_status: "not_live";
  };
  order_request: NonNullable<CandidateInspectReadModel["ledger"]>["latest_order_request"];
  gateway_result: NonNullable<CandidateInspectReadModel["ledger"]>["latest_gateway_result"];
  execution_result: NonNullable<CandidateInspectReadModel["ledger"]>["latest_execution_result"];
  ledger: NonNullable<CandidateInspectReadModel["ledger"]>;
  run_control?: CandidateInspectReadModel["runtime"]["run_control"];
  transcript?: CandidateInspectReadModel["runtime"]["transcript"];
  trading_gateway_environment: TradingGatewayEnvironmentReadModel;
}

export type FullCycleLineage = FullCycleLineageReadModel;

export async function runAgentTradingCycle(
  input: RunAgentTradingCycleInput
): Promise<AgentTradingCycleOutcome> {
  const agentAdapter = input.agentAdapter ?? new FixtureTradingResearchAgentAdapter();
  const repoRoot = input.repoRoot ?? REPO_ROOT;
  const sessionId = [
    "agent-cycle",
    safeId(input.sourceSystemId),
    safeId(input.sourceCandidateVersionId)
  ].join("-");
  const runRoot = path.join(input.store.root(), "agent-cycle-runs", sessionId);
  const gatewayRuntimeBinding = input.gatewayRuntimeBinding ?? createGatewayRuntimeBinding({
    environment: "paper"
  });
  const artifactSourceDir = await sourceResearchArtifactDir({
    store: input.store,
    sourceSystemId: input.sourceSystemId,
    sourceCandidateVersionId: input.sourceCandidateVersionId,
    repoRoot
  });
  const research = await runTradingResearchLoop({
    repo_root: repoRoot,
    artifact_source_dir: artifactSourceDir,
    run_root: runRoot,
    session_id: sessionId,
    iterations: input.iterations ?? 1,
    agent_adapter: agentAdapter
  });
  const latestEntry = research.entries.at(-1);
  if (!latestEntry) {
    throw new Error("agent_trading_cycle_no_research_entry");
  }
  if (latestEntry.agent_status === "failed") {
    throw new Error(`agent_trading_cycle_agent_failed:${latestEntry.agent_failure_reason ?? "unknown"}`);
  }

  const artifactDir = research.best_artifact_dir ?? latestEntry.artifact_dir;
  const materializedEntry = materializedResearchEntry(research, latestEntry);
  const manifest = await readTradingSystemManifest(artifactDir);
  const systemCode = await registerSystemCode({
    store: input.store,
    artifactDir,
    sessionId,
    manifestEntrypoint: manifest.entrypoint,
    agent: agentAdapter.agent
  });
  const paperRun = await runPaperArtifact({
    artifactDir,
    outputDir: path.join(runRoot, "paper"),
    manifestEntrypoint: manifest.entrypoint,
    gatewayRuntimeBinding
  });
  const paperLedger = await paperLedgerResultFromRun(paperRun, gatewayRuntimeBinding);
  const sourceTradingSystem = await input.store.getCandidate(input.sourceSystemId);
  const materialization = await input.store.materializeCandidate(materializationInput({
    sourceSystemId: input.sourceSystemId,
    sourceCandidateVersionId: input.sourceCandidateVersionId,
    sourceSystemCodeRef: sourceTradingSystem?.system_code?.ref,
    systemCode,
    evaluation: materializedEntry.evaluation,
    agent: agentAdapter.agent,
    sessionId
  }));
  if (materialization.status !== "materialized") {
    throw new Error("agent_trading_cycle_materialization_failed");
  }

  const candidate = materialization.candidate;
  await input.store.recordLedger(ledgerInputFromPaperResult({
    result: paperLedger,
    candidateId: candidate.candidate_id,
    candidateVersionId: candidate.candidate_version.candidate_version_id,
    tradingRunId: candidate.runtime.ref.id
  }));
  await input.store.recordRunControlAudit({
    idempotency_key: [
      "agent-cycle-trading-run-start",
      candidate.candidate_id,
      candidate.candidate_version.candidate_version_id
    ].join(":"),
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    runtime_id: candidate.runtime.ref.id,
    command: {
      action: "start",
      requested_lifecycle_status: "running",
      actor_kind: "human_operator",
      reason: "operator_request",
      reason_summary: "Agent-generated paper Trading Run started.",
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      }
    },
    decision: {
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      resulting_lifecycle_status: "running"
    },
    audit_event: {
      event_kind: "runtime_lifecycle_transitioned",
      runtime_lifecycle_status: "running",
      message: "Agent-generated paper Trading Run started."
    }
  });

  const nextTradingSystem = await input.store.getCandidate(candidate.candidate_id);
  if (!nextTradingSystem?.ledger) {
    throw new Error("agent_trading_cycle_projection_failed");
  }

  return {
    status: "completed",
    source_system_id: input.sourceSystemId,
    source_candidate_version_id: input.sourceCandidateVersionId,
    agent_research: {
      session_id: research.session_id,
      run_root: research.run_root,
      notebook_path: research.notebook_path,
      agent: agentAdapter.agent,
      best_score: research.best_score,
      best_artifact_dir: artifactDir,
      latest_decision: latestEntry.decision,
      latest_summary: latestEntry.summary
    },
    system_code_handoff: {
      system_code_id: systemCode.system_code_id,
      artifact_path: systemCode.artifact_path,
      artifact_digest: systemCode.artifact_digest,
      runtime_kind: "python",
      declared_output_kinds: systemCode.declared_output_contract.declared_output_kinds,
      generated_by_agent: true,
      authority_status: "not_live"
    },
    backtest: materializedEntry.evaluation,
    full_cycle_lineage: {
      handoff_status: "runnable",
      source: {
        trading_system_id: input.sourceSystemId,
        candidate_version_id: input.sourceCandidateVersionId,
        system_code_ref: sourceTradingSystem?.system_code?.ref
      },
      generated: {
        system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
        artifact_digest: systemCode.artifact_digest,
        generated_by_agent: true
      },
      materialized: {
        trading_system_id: nextTradingSystem.candidate_id,
        candidate_version_id: nextTradingSystem.candidate_version.candidate_version_id,
        system_code_ref: nextTradingSystem.system_code?.ref
      },
      evidence: {
        evaluation_status: materializedEntry.evaluation.status,
        evaluation_score: materializedEntry.evaluation.score,
        trading_run_id: nextTradingSystem.runtime.ref.id,
        gateway_result_outcome: nextTradingSystem.ledger.latest_gateway_result?.decision_outcome ?? "missing",
        ledger_chain_complete: nextTradingSystem.ledger.chain_complete
      }
    },
    next_trading_system: nextTradingSystem,
    trading_run_id: nextTradingSystem.runtime.ref.id,
    trading_run: {
      ref: nextTradingSystem.runtime.ref,
      stage: nextTradingSystem.runtime.stage_binding_profile,
      lifecycle_status: nextTradingSystem.runtime.runtime_lifecycle_status,
      authority_status: nextTradingSystem.runtime.authority_status
    },
    paper_trading: {
      run_status: paperRun.status,
      events_path: paperRun.events_path,
      provider_request_count: paperRun.provider_requests.length,
      authority_status: "not_live"
    },
    order_request: nextTradingSystem.ledger.latest_order_request,
    gateway_result: nextTradingSystem.ledger.latest_gateway_result,
    execution_result: nextTradingSystem.ledger.latest_execution_result,
    ledger: nextTradingSystem.ledger,
    run_control: nextTradingSystem.runtime.run_control,
    transcript: nextTradingSystem.runtime.transcript,
    trading_gateway_environment: input.tradingGatewayEnvironment
  };
}

function materializedResearchEntry(
  research: TradingResearchLoopResult,
  latestEntry: TradingResearchNotebookEntry
): TradingResearchNotebookEntry {
  if (!research.best_artifact_dir) {
    return latestEntry;
  }
  return [...research.entries]
    .reverse()
    .find((entry) => entry.decision === "keep" && entry.score === research.best_score)
    ?? latestEntry;
}

async function registerSystemCode(input: {
  store: LocalStore;
  artifactDir: string;
  sessionId: string;
  manifestEntrypoint: string[];
  agent: ManagedResearchAgent;
}): Promise<SystemCodeRecord & { artifact_kind: "python_file" }> {
  const entrypointPath = input.manifestEntrypoint[1] ?? "run.py";
  const artifactPath = path.join(input.artifactDir, entrypointPath);
  const digest = await fileDigest(artifactPath);
  const systemCode: SystemCodeRecord & { artifact_kind: "python_file" } = {
    record_kind: "system_code",
    version: 1,
    system_code_id: `system-code-agent-${safeId(input.sessionId)}-${digest.slice(0, 12)}`,
    artifact_kind: "python_file",
    artifact_path: artifactPath,
    artifact_digest: `sha256:${digest}`,
    runtime_kind: "python",
    entrypoint: ["python3", artifactPath],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "agent-generated-paper-system-code" },
    provenance_refs: [
      { record_kind: "agent_run", id: `agent-run-${safeId(input.sessionId)}` },
      { record_kind: "trace_placeholder", id: `trace-${safeId(input.sessionId)}` }
    ],
    status: "registered",
    created_at: new Date().toISOString(),
    authority_status: "not_live"
  };
  return input.store.recordSystemCode(systemCode) as Promise<SystemCodeRecord & { artifact_kind: "python_file" }>;
}

async function runPaperArtifact(input: {
  artifactDir: string;
  outputDir: string;
  manifestEntrypoint: string[];
  gatewayRuntimeBinding: GatewayRuntimeBinding;
}): Promise<ArtifactRunResult> {
  const provider = await startPaperTradingApiProvider(input.gatewayRuntimeBinding).catch((error) => {
    const reason = error instanceof Error ? error.message : "binance_public_market_unavailable";
    throw new Error(`binance_public_market_snapshot_unavailable:${reason}`);
  });
  try {
    return await new HostTradingArtifactRunner().run({
      artifact_dir: input.artifactDir,
      manifest: {
        id: "agent-generated-paper-trading-system",
        name: "Agent Generated Paper Trading System",
        entrypoint: input.manifestEntrypoint,
        editable_paths: ["run.py"],
        api_contract: "trading_api_provider_v1"
      },
      provider,
      output_dir: input.outputDir
    });
  } finally {
    await provider.close();
  }
}

async function sourceResearchArtifactDir(input: {
  store: LocalStore;
  sourceSystemId: string;
  sourceCandidateVersionId: string;
  repoRoot: string;
}): Promise<string> {
  const candidate = await input.store.getCandidate(input.sourceSystemId);
  if (!candidate) {
    throw new Error("agent_trading_cycle_source_system_not_found");
  }
  if (candidate.candidate_version.candidate_version_id !== input.sourceCandidateVersionId) {
    throw new Error("agent_trading_cycle_source_version_mismatch");
  }

  const systemCodeRef = candidate.system_code?.ref;
  if (!systemCodeRef) {
    throw new Error("agent_trading_cycle_missing_source_system_code");
  }
  const systemCode = await input.store.getSystemCode(systemCodeRef.id);
  if (!systemCode) {
    throw new Error("agent_trading_cycle_source_system_code_not_found");
  }
  if (systemCode.artifact_kind !== "python_file") {
    throw new Error("agent_trading_cycle_source_system_code_not_python");
  }

  return researchArtifactSourceDir({
    systemCode,
    repoRoot: input.repoRoot
  });
}

async function researchArtifactSourceDir(input: {
  systemCode: SystemCodeRecord & { artifact_kind: "python_file" };
  repoRoot: string;
}): Promise<string> {
  const artifactPath = path.isAbsolute(input.systemCode.artifact_path)
    ? input.systemCode.artifact_path
    : path.join(input.repoRoot, input.systemCode.artifact_path);
  const artifactStat = await stat(artifactPath).catch(() => undefined);
  if (!artifactStat) {
    throw new Error("agent_trading_cycle_source_artifact_not_found");
  }
  if (artifactStat.isDirectory()) {
    await assertResearchArtifactManifest(artifactPath);
    return artifactPath;
  }

  const artifactDir = path.dirname(artifactPath);
  if (await hasResearchArtifactManifest(artifactDir)) {
    return artifactDir;
  }
  if (input.systemCode.artifact_path === "fixtures/trading-systems/clock.py") {
    return path.join(input.repoRoot, "artifacts/trading-system");
  }
  throw new Error("agent_trading_cycle_source_artifact_not_research_compatible");
}

async function assertResearchArtifactManifest(artifactDir: string): Promise<void> {
  if (await hasResearchArtifactManifest(artifactDir)) {
    return;
  }
  throw new Error("agent_trading_cycle_source_artifact_missing_manifest");
}

async function hasResearchArtifactManifest(artifactDir: string): Promise<boolean> {
  const manifest = await stat(path.join(artifactDir, "manifest.json")).catch(() => undefined);
  return Boolean(manifest?.isFile());
}

function materializationInput(input: {
  sourceSystemId: string;
  sourceCandidateVersionId: string;
  sourceSystemCodeRef?: Ref;
  systemCode: SystemCodeRecord;
  evaluation: TradingEvaluationResult;
  agent: ManagedResearchAgent;
  sessionId: string;
}): CandidateMaterializationInput {
  const suffix = safeId(input.sessionId);
  return {
    idempotency_key: [
      "agent-cycle-materialize",
      input.sourceSystemId,
      input.sourceCandidateVersionId
    ].join(":"),
    provider: {
      provider_kind: providerKind(input.agent.provider),
      model: input.agent.model ?? input.agent.provider,
      invocation_surface: "agent_trading_cycle",
      agent_run_id: `agent-run-${suffix}`,
      agent_event_id: `agent-event-${suffix}`,
      trace_id: `trace-${suffix}`,
      output_artifact_hash: input.systemCode.artifact_digest
    },
    candidate: {
      title: "Agent generated BTCUSDT Trading System",
      system_summary: "Agent-generated BTCUSDT paper Trading System from the latest full cycle.",
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: "BTCUSDT USD-M Futures paper Trading System generated by an agent.",
      market: "Binance USD-M Futures",
      instrument: "BTCUSDT",
      supported_stage_binding_profiles: ["backtest", "paper"]
    },
    program: {
      summary: "Agent-generated Python SystemCode using the TradingApiProvider boundary.",
      declared_runtime: "python",
      declared_outputs: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
    },
    capability_package: {
      summary: "Backtest and paper-only capability package for agent-generated SystemCode.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["external_trading_api_provider"],
      forbidden_contents: ["raw_secret_material", "live_order_submission", "private_account_read"]
    },
    artifact_refs: [
      { record_kind: "system_code", id: input.systemCode.system_code_id }
    ],
    system_code_ref: { record_kind: "system_code", id: input.systemCode.system_code_id },
    full_cycle_lineage: {
      source: {
        trading_system_id: input.sourceSystemId,
        candidate_version_id: input.sourceCandidateVersionId,
        system_code_ref: input.sourceSystemCodeRef
      },
      generated: {
        system_code_ref: { record_kind: "system_code", id: input.systemCode.system_code_id },
        artifact_digest: input.systemCode.artifact_digest,
        generated_by_agent: true
      },
      evaluation: {
        status: input.evaluation.status,
        score: input.evaluation.score
      }
    }
  };
}

type PaperLedgerResult = Pick<LedgerInput, "intent" | "gateway_result" | "execution_result">;

async function paperLedgerResultFromRun(
  run: ArtifactRunResult,
  gatewayRuntimeBinding: GatewayRuntimeBinding
): Promise<PaperLedgerResult> {
  const orderRequest = latestEvent<OrderRequest>(run.events, "order_request");
  if (!orderRequest) {
    throw new Error("agent_trading_cycle_missing_order_request");
  }
  const side = orderRequest.side === "buy" || orderRequest.side === "sell"
    ? orderRequest.side
    : undefined;
  const orderType = orderRequest.order_type === "market" || orderRequest.order_type === "limit"
    ? orderRequest.order_type
    : undefined;
  const gatewayExecution = await executeGatewayOrderRequest(gatewayRuntimeBinding, {
    intent_kind: "place_order" as const,
    symbol: orderRequest.symbol,
    side,
    order_type: orderType,
    quantity: decimalString(orderRequest.quantity)
  });
  if (gatewayExecution.gateway_result.decision_outcome === "rejected") {
    throw new Error("agent_trading_cycle_rejected_paper_order_request");
  }
  return gatewayExecution;
}

function ledgerInputFromPaperResult(input: {
  result: PaperLedgerResult;
  candidateId: string;
  candidateVersionId: string;
  tradingRunId: string;
}): LedgerInput {
  return {
    idempotency_key: [
      "agent-cycle-ledger",
      input.candidateId,
      input.candidateVersionId
    ].join(":"),
    candidate_id: input.candidateId,
    candidate_version_id: input.candidateVersionId,
    runtime_id: input.tradingRunId,
    intent: input.result.intent,
    gateway_result: input.result.gateway_result,
    execution_result: input.result.execution_result
  };
}

function latestEvent<T>(events: Array<Record<string, unknown>>, eventName: string): T | undefined {
  for (const event of [...events].reverse()) {
    if (event.event === eventName) {
      return event as T;
    }
  }
  return undefined;
}

async function fileDigest(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function decimalString(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function providerKind(provider: ManagedResearchAgent["provider"]): CandidateMaterializationInput["provider"]["provider_kind"] {
  if (provider === "codex") {
    return "codex_cli";
  }
  if (provider === "claude") {
    return "claude_code";
  }
  return "fixture_only";
}
