import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CandidateInspectReadModel,
  CandidateMaterializationInput,
  LedgerInput,
  Ref,
  SystemCodeRecord,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import type { LocalStore } from "@ouroboros/local-store";
import { recordPaperExecutionResult } from "./paper-execution";
import { safeId } from "./safe-id";
import { validatePaperGatewayOrderRequest } from "./trading-gateway-validation";
import {
  HostTradingArtifactRunner,
  readTradingSystemManifest
} from "./trading-research/artifact-runner";
import {
  CodexTradingResearchAgentAdapter
} from "./trading-research/agent-adapters";
import {
  defaultReplayTradingScenario,
  startReplayTradingApiProvider
} from "./trading-research/replay-trading-api-provider";
import {
  runTradingResearchLoop
} from "./trading-research/run-trading-research";
import type {
  ArtifactRunResult,
  ManagedResearchAgent,
  OrderRequest,
  TradingEvaluationResult,
  TradingResearchAgentAdapter,
  TradingResearchDecision
} from "./trading-research/types";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export interface RunAgentTradingCycleInput {
  store: LocalStore;
  sourceSystemId: string;
  sourceCandidateVersionId: string;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
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

export async function runAgentTradingCycle(
  input: RunAgentTradingCycleInput
): Promise<AgentTradingCycleOutcome> {
  const agentAdapter = input.agentAdapter ?? new CodexTradingResearchAgentAdapter();
  const sessionId = [
    "agent-cycle",
    safeId(input.sourceSystemId),
    safeId(input.sourceCandidateVersionId)
  ].join("-");
  const runRoot = path.join(input.store.root(), "agent-cycle-runs", sessionId);
  const research = await runTradingResearchLoop({
    repo_root: input.repoRoot ?? REPO_ROOT,
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
    manifestEntrypoint: manifest.entrypoint
  });
  const paperLedger = paperLedgerResultFromRun(paperRun);
  const materialization = await input.store.materializeCandidate(materializationInput({
    sourceSystemId: input.sourceSystemId,
    sourceCandidateVersionId: input.sourceCandidateVersionId,
    systemCode,
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
    backtest: latestEntry.evaluation,
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
}): Promise<ArtifactRunResult> {
  const provider = await startReplayTradingApiProvider(defaultReplayTradingScenario);
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

function materializationInput(input: {
  sourceSystemId: string;
  sourceCandidateVersionId: string;
  systemCode: SystemCodeRecord;
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
    system_code_ref: { record_kind: "system_code", id: input.systemCode.system_code_id }
  };
}

type PaperLedgerResult = Pick<LedgerInput, "intent" | "gateway_result" | "execution_result">;

function paperLedgerResultFromRun(run: ArtifactRunResult): PaperLedgerResult {
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
  const intent = {
    intent_kind: "place_order" as const,
    symbol: orderRequest.symbol,
    side,
    order_type: orderType,
    quantity: decimalString(orderRequest.quantity)
  };
  const gatewayResult = validatePaperGatewayOrderRequest(intent);
  return {
    intent,
    gateway_result: gatewayResult,
    execution_result: recordPaperExecutionResult(gatewayResult)
  };
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
