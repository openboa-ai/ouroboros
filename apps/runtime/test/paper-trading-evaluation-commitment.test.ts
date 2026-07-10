import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SystemCodeArtifactResolverPort } from "@ouroboros/application/ports/system-code-artifact";
import type {
  GatewayRuntimeBinding,
  PaperTradingApiProviderOptions
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { toReplayTradingCandidateInput } from "@ouroboros/application/trading/research/replay-trading-api-provider";
import type { ReplayTradingApiProviderSession } from "@ouroboros/application/trading/research/types";
import type {
  OuroborosCommandKind,
  OuroborosCommandRequest,
  OperatorReadModel,
  RuntimeHeartbeatRecord,
  SandboxCommandEvidenceRecord,
  SandboxPlacementRecord,
  SandboxRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import type {
  SandboxAdapter,
  SandboxAdapterObservationResult,
  SandboxAdapterStartInput,
  SandboxAdapterStartResult
} from "@ouroboros/adapters/sandbox/adapter";
import type { GatewayMarketDataPort } from "@ouroboros/application/ports/market-data";
import { buildServer } from "../src/server";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-commitment-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("PaperTradingEvaluation commitment lifecycle", () => {
  it("persists a research-feedback commitment before provider, sandbox, or market work", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("fixture candidate was not materialized");
    }
    const qualificationRun = await store.createPaperTradingRun({
      idempotency_key: "paper-commitment-public-start-qualification",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification"
    });
    const order: string[] = [];
    const sandbox = inspectableSandbox(order);
    const marketData = orderedMarketData(order);
    let providerStarts = 0;
    const server = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: sandbox },
      marketDataPort: marketData,
      paperTradingArtifactResolver: artifactResolver("sha256:resolved-fixture-v1", order),
      paperTradingApiProviderFactory: async (binding, options) => {
        providerStarts += 1;
        const commitments = await store.listPaperTradingEvaluationCommitments();
        const evaluations = await store.listPaperTradingEvaluations();
        expect(commitments).toEqual([
          expect.objectContaining({
            evidence_purpose: "research_feedback",
            window_policy: expect.objectContaining({ release_policy: "closed_observation" })
          })
        ]);
        expect(evaluations).toEqual([
          expect.objectContaining({
            status: "not_started",
            observation_count: 0,
            paper_trading_evaluation_commitment_ref: {
              record_kind: "paper_trading_evaluation_commitment",
              id: commitments[0]!.paper_trading_evaluation_commitment_id
            }
          })
        ]);
        order.push("start_provider");
        return staticPaperTradingApiProvider(binding, options);
      }
    });

    try {
      const started = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });
      const malicious = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: {
          candidate_id: FIXTURE_CANDIDATE_ID,
          evidence_purpose: "qualification",
          trading_run_id: qualificationRun.trading_run_id,
          comparison_id: "forbidden-comparison"
        }
      });

      expect(started.command.status).toBe("succeeded");
      expect(malicious.command.status).toBe("succeeded");
      expect(order).toEqual([
        "resolve_artifact",
        "start_provider",
        "start_sandbox",
        "resolve_artifact",
        "read_market",
        "resolve_artifact"
      ]);
      await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual([
        expect.objectContaining({
          evidence_purpose: "research_feedback",
          trading_run_ref: { record_kind: "trading_run", id: candidate.runtime.ref.id }
        })
      ]);
      expect(providerStarts).toBe(1);
      expect(sandbox.startCalls()).toBe(1);
      expect(await store.getLatestPaperTradingEvaluationForTradingRun(qualificationRun.trading_run_id))
        .toBeUndefined();
      expect(await store.getTradingRun(qualificationRun.trading_run_id)).toMatchObject({
        runtime_lifecycle_status: "registered"
      });
      expect(started.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        observation_count: 1,
        trading_run_id: candidate.runtime.ref.id
      });
      expect(malicious.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        trading_run_id: candidate.runtime.ref.id
      });
    } finally {
      await server.close();
    }
  });

  it("ignores a malicious first public start payload and prepares only the default research-feedback run", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("fixture candidate was not materialized");
    }
    const qualificationRun = await store.createPaperTradingRun({
      idempotency_key: "paper-commitment-malicious-first-qualification",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification"
    });
    const order: string[] = [];
    const sandbox = inspectableSandbox(order);
    let providerStarts = 0;
    const server = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: sandbox },
      marketDataPort: orderedMarketData(order),
      paperTradingArtifactResolver: artifactResolver("sha256:resolved-fixture-v1", order),
      paperTradingApiProviderFactory: async (binding, options) => {
        providerStarts += 1;
        return staticPaperTradingApiProvider(binding, options);
      }
    });

    try {
      const response = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: {
          candidate_id: FIXTURE_CANDIDATE_ID,
          evidence_purpose: "qualification",
          trading_run_id: qualificationRun.trading_run_id,
          comparison_id: "forbidden-comparison"
        }
      });

      expect(response.command.status).toBe("succeeded");
      expect(response.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        trading_run_id: candidate.runtime.ref.id
      });
      await expect(store.listPaperTradingEvaluations()).resolves.toEqual([
        expect.objectContaining({
          trading_run_ref: { record_kind: "trading_run", id: candidate.runtime.ref.id }
        })
      ]);
      await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual([
        expect.objectContaining({
          evidence_purpose: "research_feedback",
          trading_run_ref: { record_kind: "trading_run", id: candidate.runtime.ref.id }
        })
      ]);
      expect(providerStarts).toBe(1);
      expect(sandbox.startCalls()).toBe(1);
      expect(await store.getLatestPaperTradingEvaluationForTradingRun(qualificationRun.trading_run_id))
        .toBeUndefined();
      expect(await store.getTradingRun(qualificationRun.trading_run_id)).toMatchObject({
        runtime_lifecycle_status: "registered"
      });
      const qualificationCandidate = await store.getCandidateForTradingRun(qualificationRun.trading_run_id);
      expect(qualificationCandidate?.runtime.run_control?.has_activity).toBe(false);
      expect(qualificationCandidate?.runtime.sandbox).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it("invalidates changed artifact bytes before restart side effects or evidence", async () => {
    const store = new LocalStore(tmpDir);
    const firstServer = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: inspectableSandbox([]) },
      marketDataPort: orderedMarketData([]),
      paperTradingArtifactResolver: artifactResolver("sha256:resolved-fixture-v1", []),
      paperTradingApiProviderFactory: staticPaperTradingApiProvider
    });

    let evaluationId: string;
    let observationCount: number;
    let ledgerCount: number;
    try {
      const started = await postCommand(firstServer, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });
      evaluationId = started.operator.selected_paper_trading_evaluation.evaluation_id!;
      observationCount = started.operator.selected_paper_trading_evaluation.observation_count;
      ledgerCount = started.operator.selected_candidate?.ledger?.chain_count ?? 0;
    } finally {
      await firstServer.close();
    }

    const restartOrder: string[] = [];
    const restartSandbox = inspectableSandbox(restartOrder);
    let providerStarts = 0;
    const restartedServer = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: restartSandbox },
      marketDataPort: orderedMarketData(restartOrder),
      paperTradingArtifactResolver: artifactResolver("sha256:resolved-fixture-v2", restartOrder),
      paperTradingApiProviderFactory: async (binding, options) => {
        providerStarts += 1;
        return staticPaperTradingApiProvider(binding, options);
      }
    });

    try {
      const restarted = await postCommand(restartedServer, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });
      const evaluation = await store.getPaperTradingEvaluation(evaluationId!);
      const observations = await store.listPaperTradingObservations(evaluationId!);
      const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);

      expect(restarted.command.status).toBe("failed");
      expect(evaluation).toMatchObject({
        status: "invalidated",
        invalidation_reason: "resolved_artifact_digest_mismatch",
        observation_count: observationCount!
      });
      expect(observations).toHaveLength(observationCount!);
      expect(candidate?.ledger?.chain_count ?? 0).toBe(ledgerCount!);
      expect(candidate?.runtime.run_control?.latest_command).toMatchObject({
        action: "inspect",
        requested_lifecycle_status: "stopped"
      });
      expect(candidate?.runtime.run_control?.latest_audit_event).toMatchObject({
        event_kind: "runtime_lifecycle_transitioned",
        message: "Paper TradingEvaluation stopped before additional evidence was recorded."
      });
      expect(providerStarts).toBe(0);
      expect(restartSandbox.startCalls()).toBe(0);
      expect(restartOrder).toEqual(["resolve_artifact"]);
    } finally {
      await restartedServer.close();
    }
  });

  it("reloads and verifies the original commitment before resuming", async () => {
    const store = new LocalStore(tmpDir);
    const firstServer = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: inspectableSandbox([]) },
      marketDataPort: orderedMarketData([]),
      paperTradingArtifactResolver: artifactResolver("sha256:resolved-fixture-v1", []),
      paperTradingApiProviderFactory: staticPaperTradingApiProvider
    });

    let evaluationId: string;
    let commitmentDigest: string;
    try {
      const started = await postCommand(firstServer, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });
      evaluationId = started.operator.selected_paper_trading_evaluation.evaluation_id!;
      commitmentDigest = (await store.listPaperTradingEvaluationCommitments())[0]!.commitment_digest;
    } finally {
      await firstServer.close();
    }

    const restartOrder: string[] = [];
    const restartedServer = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: inspectableSandbox(restartOrder) },
      marketDataPort: orderedMarketData(restartOrder),
      paperTradingArtifactResolver: artifactResolver("sha256:resolved-fixture-v1", restartOrder),
      paperTradingApiProviderFactory: async (binding, options) => {
        restartOrder.push("start_provider");
        return staticPaperTradingApiProvider(binding, options);
      }
    });

    try {
      const resumed = await postCommand(restartedServer, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });

      expect(resumed.command.status).toBe("succeeded");
      expect(resumed.operator.selected_paper_trading_evaluation).toMatchObject({
        evaluation_id: evaluationId!,
        status: "running",
        observation_count: 2
      });
      expect(await store.listPaperTradingEvaluationCommitments()).toEqual([
        expect.objectContaining({ commitment_digest: commitmentDigest! })
      ]);
      expect(restartOrder).toEqual([
        "resolve_artifact",
        "start_provider",
        "start_sandbox",
        "resolve_artifact",
        "read_market"
      ]);
    } finally {
      await restartedServer.close();
    }
  });

  it("returns invalidated without scheduling when the first observation invalidates commitment evidence", async () => {
    const store = new LocalStore(tmpDir);
    const sandbox = inspectableSandbox([]);
    let artifactResolutions = 0;
    const server = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: sandbox },
      marketDataPort: orderedMarketData([]),
      paperTradingArtifactResolver: {
        async resolveArtifactDigest() {
          artifactResolutions += 1;
          return artifactResolutions === 1
            ? "sha256:resolved-fixture-v1"
            : "sha256:resolved-fixture-v2";
        }
      },
      paperTradingApiProviderFactory: staticPaperTradingApiProvider
    });

    try {
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });

      expect(started.statusCode, started.body).toBe(409);
      expect(started.json()).toMatchObject({
        error: "paper_trading_evaluation_invalidated",
        status: "invalidated",
        paper_trading_evaluation: {
          status: "invalidated",
          invalidation_reason: "resolved_artifact_digest_mismatch"
        },
        runner_status: "stopped"
      });
    } finally {
      await server.close();
    }
  });
});

interface InspectableSandboxAdapter extends SandboxAdapter {
  startCalls(): number;
}

function inspectableSandbox(order: string[]): InspectableSandboxAdapter {
  let starts = 0;
  let instanceId = "paper-commitment-sandbox";
  return {
    kind: "deterministic_test",
    startCalls: () => starts,
    async startArtifactInstance(input: SandboxAdapterStartInput): Promise<SandboxAdapterStartResult> {
      starts += 1;
      instanceId = input.instance_id;
      order.push("start_sandbox");
      const sandboxRef = { record_kind: "sandbox" as const, id: input.instance_id };
      return {
        placement: sandboxPlacement(input.sandbox_placement_id),
        instance: sandboxRecord(input),
        logs: [],
        heartbeats: [heartbeat(sandboxRef, input.created_at, "start")],
        command_evidence: [commandEvidence(sandboxRef, input.created_at, "start")]
      };
    },
    async getArtifactInstanceStatus(): Promise<SandboxAdapterObservationResult> {
      return {
        lifecycle_status: "running",
        heartbeats: [heartbeat(
          { record_kind: "sandbox", id: instanceId },
          "2026-07-10T09:00:01.000Z",
          "status"
        )]
      };
    },
    async getArtifactInstanceLogs(): Promise<SandboxAdapterObservationResult> {
      return {
        lifecycle_status: "running",
        heartbeats: [heartbeat(
          { record_kind: "sandbox", id: instanceId },
          "2026-07-10T09:00:02.000Z",
          "logs"
        )]
      };
    },
    async stopArtifactInstance(instance): Promise<SandboxAdapterObservationResult> {
      const sandboxRef = { record_kind: "sandbox" as const, id: instance.sandbox_id };
      return {
        lifecycle_status: "stopped",
        stopped_at: "2026-07-10T09:01:00.000Z",
        command_evidence: [commandEvidence(sandboxRef, "2026-07-10T09:01:00.000Z", "stop")]
      };
    }
  };
}

function sandboxPlacement(id: string): SandboxPlacementRecord {
  return {
    record_kind: "sandbox_placement",
    version: 1,
    sandbox_placement_id: id,
    placement_kind: "fixture_local_placeholder",
    authority_status: "not_launched"
  };
}

function sandboxRecord(input: SandboxAdapterStartInput): SandboxRecord {
  return {
    record_kind: "sandbox",
    version: 1,
    sandbox_id: input.instance_id,
    adapter_kind: "deterministic_test",
    system_code_ref: { record_kind: "system_code", id: input.artifact.system_code_id },
    runtime_ref: input.runtime_ref,
    sandbox_placement_ref: {
      record_kind: "sandbox_placement",
      id: input.sandbox_placement_id
    },
    lifecycle_status: "running",
    sandbox_name: input.sandbox_name,
    created_at: input.created_at,
    started_at: input.created_at,
    last_heartbeat_at: input.created_at,
    log_refs: [],
    heartbeat_refs: [],
    command_evidence_refs: [],
    authority_status: "not_live"
  };
}

function heartbeat(
  sandboxRef: { record_kind: "sandbox"; id: string },
  at: string,
  suffix: string
): RuntimeHeartbeatRecord {
  return {
    record_kind: "runtime_heartbeat",
    version: 1,
    runtime_heartbeat_id: `runtime-heartbeat-${sandboxRef.id}-${suffix}`,
    sandbox_ref: sandboxRef,
    heartbeat_line: JSON.stringify({ event: "runtime_heartbeat", at }),
    observed_at: at,
    authority_status: "trace_only"
  };
}

function commandEvidence(
  sandboxRef: { record_kind: "sandbox"; id: string },
  at: string,
  suffix: string
): SandboxCommandEvidenceRecord {
  return {
    record_kind: "sandbox_command_evidence",
    version: 1,
    sandbox_command_evidence_id: `sandbox-command-evidence-${sandboxRef.id}-${suffix}`,
    sandbox_ref: sandboxRef,
    command: ["paper-commitment-test", suffix],
    exit_code: 0,
    stdout: "",
    stderr: "",
    started_at: at,
    completed_at: at,
    authority_status: "trace_only"
  };
}

function orderedMarketData(order: string[]): GatewayMarketDataPort {
  const base = fakeGatewayMarketDataPort({
    snapshots: [
      { price: 65_000, observed_at: "2026-07-10T09:00:03.000Z" },
      { price: 65_100, observed_at: "2026-07-10T09:01:03.000Z" }
    ]
  });
  return {
    ...base,
    readMarketSnapshot: async (input) => {
      order.push("read_market");
      return base.readMarketSnapshot(input);
    }
  };
}

function artifactResolver(
  digest: string,
  order: string[]
): SystemCodeArtifactResolverPort {
  return {
    async resolveArtifactDigest() {
      order.push("resolve_artifact");
      return digest;
    }
  };
}

async function staticPaperTradingApiProvider(
  binding: GatewayRuntimeBinding,
  options: PaperTradingApiProviderOptions
): Promise<ReplayTradingApiProviderSession> {
  const account = options.readAccountState && binding.account.provider_kind === "fake_paper_account"
    ? await options.readAccountState()
    : binding.account.provider_kind === "fake_paper_account"
      ? binding.account.state
      : {
          equity: 10_000,
          max_position_notional: 350,
          max_risk_fraction: 0.03,
          target_risk_fraction: 0.02
        };
  return {
    base_url: "http://paper-commitment.test",
    sandbox_base_url: "http://paper-commitment.test",
    close: async () => undefined,
    requests: () => [],
    candidate_input: toReplayTradingCandidateInput({
      market: {
        symbol: "BTCUSDT",
        price: 65_000,
        moving_average_fast: 65_100,
        moving_average_slow: 64_900,
        volatility: 0.01,
        observed_at: "2026-07-10T09:00:00.000Z"
      },
      account
    })
  };
}

async function postCommand(
  server: Awaited<ReturnType<typeof buildServer>>,
  request: OuroborosCommandRequest
): Promise<{
  command: { command_kind: OuroborosCommandKind; status: string };
  operator: OperatorReadModel;
}> {
  const response = await server.inject({
    method: "POST",
    url: "/api/commands",
    payload: request
  });
  expect([200, 409], response.body).toContain(response.statusCode);
  return response.json();
}
