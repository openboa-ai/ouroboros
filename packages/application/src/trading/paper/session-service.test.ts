import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  PAPER_TRADING_COMPARISON_ZERO_SCORE,
  paperTradingComparisonActivationOutcomeDigestInput,
  paperTradingComparisonActivationPolicyFor,
  paperTradingComparisonCheckpointAttemptDigestInput,
  paperTradingComparisonCheckpointOutcomeDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTickAcknowledgementDigestInput,
  paperTradingComparisonTickDeliveryDigestInput,
  paperTradingComparisonTickDigestInput,
  paperTradingEvaluationCommitmentDigestInput,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonActivationSide,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonCheckpointWriteContext,
  type PaperTradingComparisonRuntimeWriteContext,
  type PaperTradingComparisonTickAcknowledgementRecord,
  type PaperTradingComparisonTickContext,
  type PaperTradingComparisonTickDeliveryRecord,
  type PaperTradingComparisonTickIOWriteContext,
  type PaperTradingComparisonTickRecord,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type SandboxAdapterKind,
  type SandboxDetailReadModel,
  type TradingRunRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type {
  OuroborosStorePort,
  PreparedPaperTradingComparisonCheckpointSide
} from "../../ports/store";
import type { SystemCodeArtifactResolverPort } from "../../ports/system-code-artifact";
import type { SandboxStartInput } from "../../ports/sandbox";
import { initialPaperTradingEngineState, paperTradingScoreFromAccount } from "./engine";
import { PaperTradingEvaluationRunner } from "./evaluation-runner";
import {
  PaperTradingApiProviderComparisonTickClientError
} from "../gateway/runtime-binding";
import type {
  MarketSnapshot,
  PaperTradingApiProviderComparisonTickHooks
} from "../research/types";
import { PaperTradingSessionService } from "./session-service";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-session-service-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("PaperTradingSessionService", () => {
  it("keeps comparison neutral constants byte-identical to the paper engine baseline", () => {
    const initial = initialPaperTradingEngineState();
    expect(JSON.stringify(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT))
      .toBe(JSON.stringify(initial.account));
    expect(initial.openOrders).toEqual([]);
    expect(initial.processedTradingSystemEventIds).toEqual([]);
    expect(initial.processedPublicTradeIds).toEqual([]);
    expect(paperTradingScoreFromAccount(initial.account))
      .toEqual(PAPER_TRADING_COMPARISON_ZERO_SCORE);
  });

  it("keeps rounded paper score revenue minus cost equal to net revenue", () => {
    const account = {
      ...initialPaperTradingEngineState().account,
      equity_usdt: "9999.841957622833",
      realized_pnl_usdt: "0",
      unrealized_pnl_usdt: "-0.00021554",
      fee_paid_usdt: "0.078913418584",
      slippage_paid_usdt: "0.059185063938",
      funding_paid_usdt: "0.019728354646"
    };

    expect(paperTradingScoreFromAccount(account)).toEqual({
      revenue_usdt: -0.000216,
      cost_usdt: 0.157827,
      net_revenue_usdt: -0.158043,
      net_return_pct: -0.00158
    });
  });

  it("rechecks generated start eligibility before artifact or runtime effects", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) throw new Error("fixture candidate was not materialized");
    const effects = {
      eligibilityChecks: 0,
      artifactReads: 0,
      providerStarts: 0,
      sandboxStarts: 0
    };
    const service = new PaperTradingSessionService({
      store,
      startEligibility: async () => {
        effects.eligibilityChecks += 1;
        return "paper_handoff_conformance_missing";
      },
      artifactResolver: {
        async resolveArtifactDigest() {
          effects.artifactReads += 1;
          return "sha256:must-not-resolve";
        }
      },
      sandboxAdapters: {
        deterministic_test: {
          async startArtifactInstance() {
            effects.sandboxStarts += 1;
            throw new Error("sandbox must not start");
          }
        }
      } as never,
      marketData: {} as never,
      async apiProviderFactory() {
        effects.providerStarts += 1;
        throw new Error("provider must not start");
      }
    });

    await expect(service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: candidate.runtime.ref.id,
      evidencePurpose: "research_feedback",
      clock: "scheduled"
    })).rejects.toMatchObject({
      code: "paper_handoff_conformance_missing"
    });
    expect(effects).toEqual({
      eligibilityChecks: 1,
      artifactReads: 0,
      providerStarts: 0,
      sandboxStarts: 0
    });
  });

  it.each([
    { label: "resolver-owned path", resolverOwnsPath: true },
    { label: "digest-only relative path", resolverOwnsPath: false }
  ])("activates a materialized candidate through Docker with a $label workspace", async ({
    resolverOwnsPath
  }) => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!fixture) throw new Error("fixture candidate was not materialized");
    const storedArtifact = fixture.system_code?.ref?.id
      ? await store.getSystemCode(fixture.system_code.ref.id)
      : undefined;
    if (!storedArtifact || storedArtifact.artifact_kind !== "python_file") {
      throw new Error("fixture Python SystemCode was not materialized");
    }
    const generated = structuredClone(fixture);
    generated.candidate_version.materialization_attempt_ref = {
      record_kind: "candidate_materialization_attempt",
      id: "generated-materialization"
    };
    generated.materialization_attempt = {
      attempt_id: "generated-materialization",
      idempotency_key: "generated-materialization",
      provider_kind: "codex_cli",
      model: "gpt-5-codex",
      agent_run_ref: { record_kind: "agent_run", id: "generated-agent-run" },
      trace_ref: { record_kind: "trace", id: "generated-trace" },
      status: "materialized",
      validation_status: "accepted",
      resulting_candidate_ref: {
        record_kind: "trading_system_candidate",
        id: fixture.candidate_id
      },
      artifact_refs: [],
      created_at: "2026-07-16T00:00:00.000Z",
      authority_label: "provider_output_not_evidence"
    };
    const generatedStore = new Proxy(store, {
      get(target, property, receiver) {
        if (property === "getCandidate" || property === "getCandidateForTradingRun") {
          return async () => structuredClone(generated);
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
    }) as OuroborosStorePort;
    const starts = { deterministic: 0, docker: 0 };
    const resolvedArtifactPath = resolverOwnsPath
      ? path.join(
          tmpDir,
          "arm",
          "candidate-arena-runs",
          "tick-1",
          "candidate-1",
          "run.py"
        )
      : path.resolve(storedArtifact.artifact_path);
    let dockerStart: SandboxStartInput | undefined;
    const artifactResolver: SystemCodeArtifactResolverPort = {
      async resolveArtifactDigest(systemCode: Parameters<
        SystemCodeArtifactResolverPort["resolveArtifactDigest"]
      >[0]) {
        return systemCode.artifact_digest;
      },
      ...(resolverOwnsPath
        ? {
            async resolveArtifact(systemCode: Parameters<
              SystemCodeArtifactResolverPort["resolveArtifactDigest"]
            >[0]) {
              return {
                artifact_digest: systemCode.artifact_digest,
                artifact_path: resolvedArtifactPath
              };
            }
          }
        : {})
    };
    const service = new PaperTradingSessionService({
      store: generatedStore,
      startEligibility: async () => undefined,
      artifactResolver,
      sandboxAdapters: {
        deterministic_test: sandboxAdapter("deterministic_test", () => {
          starts.deterministic += 1;
        }),
        docker_sandboxes_sbx: sandboxAdapter("docker_sandboxes_sbx", (input) => {
          starts.docker += 1;
          dockerStart = input;
        })
      },
      marketData: paperSessionMarketData(),
      async apiProviderFactory() {
        return {
          base_url: "http://paper-provider.test",
          sandbox_base_url: "http://paper-provider.internal",
          async close() {},
          requests: () => [],
          candidate_input: {} as never
        };
      }
    });
    const prepared = await service.prepare({
      candidateId: generated.candidate_id,
      candidateVersionId: generated.candidate_version.candidate_version_id,
      tradingRunId: generated.runtime.ref.id,
      evidencePurpose: "research_feedback",
      clock: "scheduled"
    });

    await service.activate(prepared);

    expect(starts).toEqual({ deterministic: 0, docker: 1 });
    expect(dockerStart).toMatchObject({
      artifact: {
        artifact_path: resolvedArtifactPath
      },
      workspace_path: path.dirname(resolvedArtifactPath)
    });
    await service.stopAllSessions();
  });

  it("repairs a commitment-only qualification preparation without runtime effects", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("fixture candidate was not materialized");
    }
    const run = await store.createPaperTradingRun({
      idempotency_key: "session-service-partial-qualification",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification",
      created_at: "2026-07-10T00:00:00.000Z"
    });
    const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
    const first = inertSessionService(failFirstEvaluationWrite(store), effects);

    await expect(first.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: run.trading_run_id,
      evidencePurpose: "qualification",
      clock: "external"
    })).rejects.toThrow("injected_evaluation_write_failure");
    const [persistedCommitment] = await store.listPaperTradingEvaluationCommitments();
    expect(persistedCommitment?.trading_run_ref.id).toBe(run.trading_run_id);
    expect(await store.getLatestPaperTradingEvaluationForTradingRun(run.trading_run_id))
      .toBeUndefined();

    const repaired = await inertSessionService(store, effects).prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: run.trading_run_id,
      evidencePurpose: "qualification",
      clock: "external"
    });

    expect(repaired.commitment).toEqual(persistedCommitment);
    expect(repaired.commitment.paper_trading_evaluation_commitment_id)
      .toMatch(/^paper-trading-evaluation-commitment-/);
    const deterministicSuffix = repaired.commitment.paper_trading_evaluation_commitment_id.slice(
      "paper-trading-evaluation-commitment-".length
    );
    expect(repaired.evaluation.paper_trading_evaluation_id).toBe(
      `paper-trading-evaluation-${deterministicSuffix}`
    );
    expect(repaired.evaluation).toMatchObject({
      status: "not_started",
      observation_count: 0,
      started_at: persistedCommitment!.committed_at,
      paper_trading_evaluation_commitment_ref: {
        id: persistedCommitment!.paper_trading_evaluation_commitment_id
      }
    });
    expect(repaired.candidate.candidate_id).toBe(candidate.candidate_id);
    expect(repaired.verification.status).toBe("verified");
    expect(repaired.clock).toBe("external");
    expect(effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
    await expect(store.listPaperTradingObservations(
      repaired.evaluation.paper_trading_evaluation_id
    )).resolves.toEqual([]);
  });

  it.each([
    "alternate-evaluation-for-exact-commitment",
    "additional-evaluation-for-exact-commitment",
    "alternate-commitment-only",
    "alternate-commitment-evaluation-chain"
  ] as const)("rejects non-deterministic partial session identity: %s", async (shape) => {
    const store = new LocalStore(path.join(tmpDir, shape));
    await store.initialize();
    const fixture = await qualificationRunFixture(store, shape);
    const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
    const failing = inertSessionService(failFirstEvaluationWrite(store), effects);
    await expect(failing.prepare(fixture.input)).rejects.toThrow(
      "injected_evaluation_write_failure"
    );
    const [exactCommitment] = await store.listPaperTradingEvaluationCommitments();
    if (!exactCommitment) {
      throw new Error("deterministic commitment was not persisted");
    }
    const exactCommitmentId = exactCommitment.paper_trading_evaluation_commitment_id;
    const exactEvaluationId = `paper-trading-evaluation-${exactCommitmentId.slice(
      "paper-trading-evaluation-commitment-".length
    )}`;

    if (shape === "additional-evaluation-for-exact-commitment") {
      await store.recordPaperTradingEvaluation(
        notStartedEvaluationFixture(exactCommitment, exactEvaluationId)
      );
    }
    if (shape === "alternate-commitment-evaluation-chain" ||
      shape === "alternate-commitment-only") {
      const alternateCommitment = withSessionCommitmentDigest({
        ...exactCommitment,
        paper_trading_evaluation_commitment_id: `${exactCommitmentId}-alternate`,
        commitment_digest: ""
      });
      await store.recordPaperTradingEvaluationCommitment(alternateCommitment);
      if (shape === "alternate-commitment-evaluation-chain") {
        await store.recordPaperTradingEvaluation(
          notStartedEvaluationFixture(
            alternateCommitment,
            `${exactEvaluationId}-alternate-chain`
          )
        );
      }
    } else {
      await store.recordPaperTradingEvaluation(
        notStartedEvaluationFixture(
          exactCommitment,
          `${exactEvaluationId}-alternate`
        )
      );
    }
    const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
    const evaluationsBefore = await store.listPaperTradingEvaluations();

    await expect(inertSessionService(store, effects).prepare(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_session_deterministic_identity_conflict"
    });
    await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(commitmentsBefore);
    await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
    expect(effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("reuses an exact inert qualification evaluation without writes or runtime effects", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await qualificationRunFixture(store, "exact-inert-replay");
    const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
    const service = inertSessionService(store, effects);
    const prepared = await service.prepare(fixture.input);
    const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
    const evaluationsBefore = await store.listPaperTradingEvaluations();

    await expect(service.prepare(fixture.input)).resolves.toEqual(prepared);
    await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(commitmentsBefore);
    await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
    expect(effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("reuses an exact running research-feedback evaluation without additional writes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("fixture candidate was not materialized");
    }
    const run = await store.createPaperTradingRun({
      idempotency_key: "session-running-research-feedback-replay",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback",
      created_at: "2026-07-10T00:00:00.000Z"
    });
    const input: Parameters<PaperTradingSessionService["prepare"]>[0] = {
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: run.trading_run_id,
      evidencePurpose: "research_feedback",
      clock: "external"
    };
    const writes = { evaluations: 0 };
    const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
    const service = activatableResearchSessionService(
      evaluationWriteCountingStore(store, writes),
      effects
    );
    const prepared = await service.prepare(input);
    const running = await service.activate(prepared);
    const evaluationsBefore = await store.listPaperTradingEvaluations();
    const writesBefore = writes.evaluations;
    const effectsBefore = { ...effects };

    const replayed = await service.prepare(input);

    expect(replayed.evaluation).toEqual(running);
    expect(replayed.verification.status).toBe("verified");
    expect(writes.evaluations).toBe(writesBefore);
    expect(effects).toEqual(effectsBefore);
    await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
    await service.stop(run.trading_run_id);
  });

  it("invalidates a running evaluation when its artifact becomes unreadable on recovery", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("fixture candidate was not materialized");
    }
    const run = await store.createPaperTradingRun({
      idempotency_key: "session-running-unreadable-artifact-recovery",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback",
      created_at: "2026-07-10T00:00:00.000Z"
    });
    const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
    const service = activatableResearchSessionService(store, effects);
    const prepared = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: run.trading_run_id,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    await service.activate(prepared);
    await service.stopAllSessions();
    const recovery = activatableResearchSessionService(
      store,
      effects,
      undefined,
      {
        async resolveArtifactDigest() {
          throw new Error("artifact disappeared");
        }
      }
    );

    await expect(recovery.recoverRunningEvaluations()).resolves.toEqual([{
      tradingRunId: run.trading_run_id,
      status: "invalidated",
      reason: "resolved_artifact_digest_mismatch"
    }]);
    const invalidated = await store.getLatestPaperTradingEvaluationForTradingRun(
      run.trading_run_id
    );
    expect(invalidated).toMatchObject({
      status: "invalidated",
      invalidation_reason: "resolved_artifact_digest_mismatch"
    });
    expect(invalidated?.next_observation_at).toBeUndefined();
  });

  it("keeps transient recovery failure retryable until explicit exhaustion", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) throw new Error("fixture candidate was not materialized");
    const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
    const initial = activatableResearchSessionService(store, effects);
    const prepared = await initial.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: candidate.runtime.ref.id,
      evidencePurpose: "research_feedback",
      clock: "scheduled"
    });
    await initial.activate(prepared);
    await initial.stopAllSessions();
    const recovery = transientlyFailingRecoverySessionService(store, effects);

    const outcomes = await recovery.recoverRunningEvaluations({
      persistFailures: false
    });

    expect(outcomes).toEqual([{
      tradingRunId: candidate.runtime.ref.id,
      status: "failed",
      error: "sandbox recovery unavailable"
    }]);
    expect(await store.getLatestPaperTradingEvaluationForTradingRun(
      candidate.runtime.ref.id
    )).toMatchObject({ status: "running" });

    await recovery.finalizeRecoveryFailures(outcomes);

    const exhausted = await store.getLatestPaperTradingEvaluationForTradingRun(
      candidate.runtime.ref.id
    );
    expect(exhausted).toMatchObject({
      status: "failed",
      latest_failure_reason: "sandbox recovery unavailable"
    });
    expect(exhausted?.next_observation_at).toBeUndefined();
  });

  it.each(["running", "stopped", "failed", "invalidated"] as const)(
    "rejects non-inert exact evaluation replay: %s",
    async (status) => {
      const store = new LocalStore(path.join(tmpDir, status));
      await store.initialize();
      const fixture = await qualificationRunFixture(store, `terminal-${status}`);
      const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
      const prepared = await inertSessionService(store, effects).prepare(fixture.input);
      const terminal = { ...prepared.evaluation, status };
      const evaluationsBefore = await store.listPaperTradingEvaluations();
      const writes = { evaluations: 0 };

      await expect(inertSessionService(
        exactEvaluationOverrideStore(store, terminal, writes),
        effects
      ).prepare(fixture.input)).rejects.toMatchObject({
        code: "paper_trading_session_non_inert_evaluation_replay"
      });
      await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
      expect(writes).toEqual({ evaluations: 0 });
      expect(effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
    }
  );

  it("drains the target runner before persisting a stopped evaluation", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("fixture candidate was not materialized");
    }
    const run = await store.createPaperTradingRun({
      idempotency_key: "session-stop-drain-order",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback",
      created_at: "2026-07-10T00:00:00.000Z"
    });
    const order: string[] = [];
    const runner = new PaperTradingEvaluationRunner();
    const originalDrain = runner.drain.bind(runner);
    const drain = vi.spyOn(runner, "drain").mockImplementation((...args) => {
      order.push("drain");
      return Reflect.apply(originalDrain, runner, args);
    });
    const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
    const service = activatableResearchSessionService(
      stoppedEvaluationOrderStore(store, order),
      effects,
      runner
    );
    const prepared = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: run.trading_run_id,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    await service.activate(prepared);
    order.length = 0;

    const stopped = await service.stop(run.trading_run_id);

    expect(drain).toHaveBeenCalledWith(run.trading_run_id, 10_000);
    expect(order).toEqual(["drain", "stopped"]);
    expect(stopped?.status).toBe("stopped");
    await expect(store.getLatestPaperTradingEvaluationForTradingRun(run.trading_run_id))
      .resolves.toMatchObject({ status: "stopped" });
  });

  it("fails closed without stopped evidence when target-run drain times out", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("fixture candidate was not materialized");
    }
    const run = await store.createPaperTradingRun({
      idempotency_key: "session-stop-drain-timeout",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback",
      created_at: "2026-07-10T00:00:00.000Z"
    });
    const stoppedWrites = { count: 0 };
    const runner = new PaperTradingEvaluationRunner();
    vi.spyOn(runner, "drain").mockResolvedValue(false as never);
    const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
    const service = activatableResearchSessionService(
      stoppedEvaluationCountingStore(store, stoppedWrites),
      effects,
      runner
    );
    const prepared = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: run.trading_run_id,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    await service.activate(prepared);

    await expect(service.stop(run.trading_run_id)).rejects.toMatchObject({
      code: "paper_trading_observation_drain_timeout"
    });
    expect(stoppedWrites.count).toBe(0);
    await expect(store.getLatestPaperTradingEvaluationForTradingRun(run.trading_run_id))
      .resolves.toMatchObject({ status: "running" });
  });

  it("stops the latest evaluation after an in-flight observation drains", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("fixture candidate was not materialized");
    }
    const run = await store.createPaperTradingRun({
      idempotency_key: "session-stop-reloads-after-drain",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback",
      created_at: "2026-07-10T00:00:00.000Z"
    });
    const runner = new PaperTradingEvaluationRunner();
    const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
    const service = activatableResearchSessionService(store, effects, runner);
    const prepared = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: run.trading_run_id,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    await service.activate(prepared);
    vi.spyOn(runner, "drain").mockImplementation(async () => {
      const current = await store.getLatestPaperTradingEvaluationForTradingRun(run.trading_run_id);
      if (!current) {
        throw new Error("running evaluation was not found");
      }
      await store.recordPaperTradingEvaluation({
        ...current,
        observation_count: current.observation_count + 1
      });
      return true;
    });

    const stopped = await service.stop(run.trading_run_id);

    expect(stopped).toMatchObject({ status: "stopped", observation_count: 1 });
    await expect(store.getLatestPaperTradingEvaluationForTradingRun(run.trading_run_id))
      .resolves.toMatchObject({ status: "stopped", observation_count: 1 });
  });

  it("rejects commitment-only qualification artifact drift without evaluation writes", async () => {
    const partial = await commitmentOnlyQualificationFixture("artifact-drift");
    const driftedCommitment = withSessionCommitmentDigest({
      ...partial.commitment,
      resolved_artifact_digest: "sha256:drifted-session-service-artifact"
    });
    const writes = { evaluations: 0 };

    await expect(inertSessionService(
      commitmentOverrideStore(partial.store, driftedCommitment, writes),
      partial.effects
    ).prepare(partial.input)).rejects.toMatchObject({
      code: "paper_trading_evaluation_invalidated"
    });
    await expect(partial.store.listPaperTradingEvaluations()).resolves.toEqual([]);
    expect(writes).toEqual({ evaluations: 0 });
    expect(partial.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("rejects commitment-only qualification policy drift without evaluation writes", async () => {
    const partial = await commitmentOnlyQualificationFixture("policy-drift");
    const driftedCommitment = withSessionCommitmentDigest({
      ...partial.commitment,
      policy_identity: {
        ...partial.commitment.policy_identity,
        cost_policy_version: "paper-cost-drifted-v1"
      }
    });
    const writes = { evaluations: 0 };

    await expect(inertSessionService(
      commitmentOverrideStore(partial.store, driftedCommitment, writes),
      partial.effects
    ).prepare(partial.input)).rejects.toMatchObject({
      code: "paper_trading_evaluation_invalidated"
    });
    await expect(partial.store.listPaperTradingEvaluations()).resolves.toEqual([]);
    expect(writes).toEqual({ evaluations: 0 });
    expect(partial.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("prepares without runtime effects, rejects unpaired qualification, and isolates external sessions", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("fixture candidate was not materialized");
    }

    const qualificationRun = await store.createPaperTradingRun({
      idempotency_key: "session-service-qualification",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification"
    });
    const additionalResearchRun = await store.createPaperTradingRun({
      idempotency_key: "session-service-research-feedback",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback"
    });

    let artifactResolutions = 0;
    let providerStarts = 0;
    let sandboxStarts = 0;
    let marketReads = 0;
    const providerIds: string[] = [];
    const sandboxIds: string[] = [];
    const service = new PaperTradingSessionService({
      store,
      artifactResolver: {
        async resolveArtifactDigest() {
          artifactResolutions += 1;
          return "sha256:session-service-fixture";
        }
      },
      sandboxAdapters: {
        deterministic_test: {
          async startArtifactInstance(input: SandboxStartInput) {
            sandboxStarts += 1;
            sandboxIds.push(input.instance_id);
            return {
              placement: {
                record_kind: "sandbox_placement",
                version: 1,
                sandbox_placement_id: input.sandbox_placement_id,
                placement_kind: "fixture_local_placeholder",
                authority_status: "not_launched"
              },
              instance: {
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
                log_refs: [],
                heartbeat_refs: [],
                authority_status: "not_live"
              },
              logs: [],
              heartbeats: [],
              command_evidence: []
            };
          },
          async getArtifactInstanceStatus() {
            return { lifecycle_status: "running" as const };
          },
          async getArtifactInstanceLogs() {
            return { lifecycle_status: "running" as const };
          },
          async stopArtifactInstance() {
            return {
              lifecycle_status: "stopped" as const,
              stopped_at: "2026-07-10T00:00:00.000Z"
            };
          }
        }
      } as never,
      marketData: {
        provider_kind: "binance_production_public_market_data",
        source_kind: "binance_production_public_hybrid",
        rest_base_url: "https://example.invalid",
        required_endpoints: [],
        authority_status: "read_only",
        async readMarketSnapshot() {
          marketReads += 1;
          throw new Error("external sessions must not observe during activation");
        },
        async readPublicMarketLivenessSurface() {
          throw new Error("external sessions must not observe during activation");
        },
        async readPublicExecutionSnapshot() {
          throw new Error("external sessions must not observe during activation");
        }
      },
      async apiProviderFactory() {
        providerStarts += 1;
        const id = `provider-${providerStarts}`;
        providerIds.push(id);
        return {
          base_url: `http://${id}.test`,
          async close() {},
          requests: () => [],
          candidate_input: {} as never
        };
      }
    });

    const commitmentsBeforeMismatch = await store.listPaperTradingEvaluationCommitments();
    await expect(service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: qualificationRun.trading_run_id,
      evidencePurpose: "research_feedback",
      clock: "external"
    })).rejects.toMatchObject({ code: "paper_trading_evidence_purpose_mismatch" });
    expect(await store.listPaperTradingEvaluationCommitments()).toEqual(commitmentsBeforeMismatch);

    const preparedQualification = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: qualificationRun.trading_run_id,
      evidencePurpose: "qualification",
      clock: "external"
    });

    expect(preparedQualification.evaluation.status).toBe("not_started");
    expect(preparedQualification.commitment.evidence_purpose).toBe("qualification");
    expect(preparedQualification.commitment.trading_run_ref.id).toBe(qualificationRun.trading_run_id);
    expect(artifactResolutions).toBe(1);
    expect(providerStarts).toBe(0);
    expect(sandboxStarts).toBe(0);
    expect(marketReads).toBe(0);
    expect(await store.listPaperTradingObservations(
      preparedQualification.evaluation.paper_trading_evaluation_id
    )).toEqual([]);
    const defaultBefore = await store.getTradingRun(candidate.runtime.ref.id);
    await expect(service.activate(preparedQualification)).rejects.toMatchObject({
      code: "paper_trading_comparison_authority_required"
    });
    expect(providerStarts).toBe(0);
    expect(sandboxStarts).toBe(0);
    expect(marketReads).toBe(0);
    expect(await store.listPaperTradingObservations(
      preparedQualification.evaluation.paper_trading_evaluation_id
    )).toEqual([]);
    expect((await store.getTradingRun(candidate.runtime.ref.id))?.runtime_lifecycle_status)
      .toBe(defaultBefore?.runtime_lifecycle_status);

    const preparedDefault = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: candidate.runtime.ref.id,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    const preparedAdditionalResearch = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: additionalResearchRun.trading_run_id,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    await service.activate(preparedDefault);
    const defaultDuringResearch = await store.getTradingRun(candidate.runtime.ref.id);
    const activeResearch = await service.activate(preparedAdditionalResearch);

    expect(activeResearch.status).toBe("running");
    expect(service.active(additionalResearchRun.trading_run_id)).toBe(true);
    expect((await store.getTradingRun(additionalResearchRun.trading_run_id))?.runtime_lifecycle_status)
      .toBe("running");
    expect(providerIds).toHaveLength(2);
    expect(new Set(providerIds).size).toBe(2);
    expect(sandboxIds).toHaveLength(2);
    expect(new Set(sandboxIds).size).toBe(2);
    expect(marketReads).toBe(0);

    await service.stop(additionalResearchRun.trading_run_id);
    expect(service.active(additionalResearchRun.trading_run_id)).toBe(false);
    expect((await store.getTradingRun(candidate.runtime.ref.id))?.runtime_lifecycle_status)
      .toBe(defaultDuringResearch?.runtime_lifecycle_status);
  });

  it("rejects observation of a prepared qualification run before runtime effects", async () => {
    const fixture = await prepareGuardedSession("qualification");

    await expect(fixture.service.observe(fixture.tradingRunId)).rejects.toMatchObject({
      code: "paper_trading_comparison_authority_required"
    });

    expect(fixture.effectCounts()).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
    expect(fixture.service.active(fixture.tradingRunId)).toBe(false);
    expect(await fixture.store.listPaperTradingObservations(
      fixture.prepared.evaluation.paper_trading_evaluation_id
    )).toEqual([]);
  });

  it("rejects scheduling a prepared qualification run before active state or timer effects", async () => {
    const fixture = await prepareGuardedSession("qualification");

    await expect(Promise.resolve(fixture.service.schedule(fixture.tradingRunId))).rejects.toMatchObject({
      code: "paper_trading_comparison_authority_required"
    });

    expect(fixture.effectCounts()).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
    expect(fixture.service.active(fixture.tradingRunId)).toBe(false);
  });

  it("rejects stopping a prepared qualification run before lifecycle effects", async () => {
    const fixture = await prepareGuardedSession("qualification");
    const stateBeforeStop = await guardedSessionState(fixture.store, fixture.tradingRunId);

    await expect(fixture.service.stop(fixture.tradingRunId)).rejects.toMatchObject({
      code: "paper_trading_comparison_authority_required"
    });

    expect(fixture.effectCounts()).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
    expect(fixture.service.active(fixture.tradingRunId)).toBe(false);
    expect(await guardedSessionState(fixture.store, fixture.tradingRunId)).toEqual(stateBeforeStop);
  });

  it("persists repeated Arena capacity deferrals as resumable stopped evaluations", async () => {
    const fixture = await prepareGuardedSession("research_feedback");

    const stopped = await fixture.service.stop(fixture.tradingRunId, {
      reason: "arena_capacity_deferred"
    });

    expect(stopped).toMatchObject({
      status: "stopped",
      runtime_coordination_status: "arena_capacity_deferred"
    });
    const firstDeferredRun = await fixture.store.getTradingRun(
      fixture.tradingRunId
    );
    expect(firstDeferredRun).toMatchObject({
      runtime_lifecycle_status: "stopped",
      run_control_command_refs: [
        { record_kind: "run_control_command", id: expect.any(String) }
      ],
      runtime_audit_event_refs: [
        { record_kind: "runtime_audit_event", id: expect.any(String) }
      ]
    });

    const resumedEffects = {
      providerStarts: 0,
      sandboxStarts: 0,
      marketReads: 0
    };
    const resumedService = activatableResearchSessionService(
      fixture.store,
      resumedEffects,
      undefined,
      {
        async resolveArtifactDigest() {
          return "sha256:session-service-guard";
        }
      }
    );
    const prepared = await resumedService.prepare({
      candidateId: fixture.prepared.candidate.candidate_id,
      candidateVersionId:
        fixture.prepared.candidate.candidate_version.candidate_version_id,
      tradingRunId: fixture.tradingRunId,
      evidencePurpose: "research_feedback",
      clock: "scheduled"
    });
    const resumed = await resumedService.activate(prepared);
    expect(resumed).toMatchObject({ status: "running" });
    expect(resumed.runtime_coordination_status).toBeUndefined();
    const firstResumedRun = await fixture.store.getTradingRun(fixture.tradingRunId);
    expect(firstResumedRun).toMatchObject({ runtime_lifecycle_status: "running" });
    expect(firstResumedRun?.runtime_audit_event_refs).toHaveLength(
      (firstDeferredRun?.runtime_audit_event_refs?.length ?? 0) + 1
    );
    expect(resumedEffects).toMatchObject({
      providerStarts: 1,
      sandboxStarts: 1
    });
    await resumedService.stop(fixture.tradingRunId, {
      reason: "arena_capacity_deferred"
    });
    const repeatedDeferredRun = await fixture.store.getTradingRun(
      fixture.tradingRunId
    );
    expect(repeatedDeferredRun).toMatchObject({
      runtime_lifecycle_status: "stopped"
    });
    expect(repeatedDeferredRun?.runtime_audit_event_refs).toHaveLength(
      (firstResumedRun?.runtime_audit_event_refs?.length ?? 0) + 1
    );

    const repeatedResumeEffects = {
      providerStarts: 0,
      sandboxStarts: 0,
      marketReads: 0
    };
    const repeatedResumeService = activatableResearchSessionService(
      fixture.store,
      repeatedResumeEffects,
      undefined,
      {
        async resolveArtifactDigest() {
          return "sha256:session-service-guard";
        }
      }
    );
    const repeatedPrepared = await repeatedResumeService.prepare({
      candidateId: fixture.prepared.candidate.candidate_id,
      candidateVersionId:
        fixture.prepared.candidate.candidate_version.candidate_version_id,
      tradingRunId: fixture.tradingRunId,
      evidencePurpose: "research_feedback",
      clock: "scheduled"
    });
    const repeatedResume = await repeatedResumeService.activate(repeatedPrepared);

    expect(repeatedResume).toMatchObject({ status: "running" });
    expect(repeatedResume.runtime_coordination_status).toBeUndefined();
    const repeatedResumedRun = await fixture.store.getTradingRun(
      fixture.tradingRunId
    );
    expect(repeatedResumedRun).toMatchObject({
      runtime_lifecycle_status: "running"
    });
    expect(repeatedResumedRun?.runtime_audit_event_refs).toHaveLength(
      (repeatedDeferredRun?.runtime_audit_event_refs?.length ?? 0) + 1
    );
    expect(repeatedResumeEffects).toMatchObject({
      providerStarts: 1,
      sandboxStarts: 1
    });
    await repeatedResumeService.stop(fixture.tradingRunId);
  });

  it("rejects observation of an unactivated research-feedback run before runtime effects", async () => {
    const fixture = await prepareGuardedSession("research_feedback");

    await expect(fixture.service.observe(fixture.tradingRunId)).rejects.toMatchObject({
      code: "paper_trading_session_not_active"
    });

    expect(fixture.effectCounts()).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
    expect(fixture.service.active(fixture.tradingRunId)).toBe(false);
    expect(await fixture.store.listPaperTradingObservations(
      fixture.prepared.evaluation.paper_trading_evaluation_id
    )).toEqual([]);
  });

  it("rejects scheduling an unactivated research-feedback run before active state or timer effects", async () => {
    const fixture = await prepareGuardedSession("research_feedback");

    await expect(fixture.service.schedule(fixture.tradingRunId)).rejects.toMatchObject({
      code: "paper_trading_session_not_active"
    });

    expect(fixture.effectCounts()).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
    expect(fixture.service.active(fixture.tradingRunId)).toBe(false);
  });

  it("starts, inspects, and idempotently stops one authorized comparison side without observation", async () => {
    const fixture = await authorizedComparisonSessionFixture("lifecycle");
    const running = await fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    });

    expect(running).toMatchObject({
      role: "challenger",
      runtime_lifecycle_status: "running",
      evaluation_status: "running",
      sandbox_lifecycle_status: "running",
      provider_request_count: 3,
      provider_session_active: true,
      authority_status: "not_live"
    });
    expect(fixture.effects).toMatchObject({
      providerStarts: 1,
      providerCloses: 0,
      sandboxStarts: 1,
      sandboxStops: 0,
      fixedMarketReads: 1,
      underlyingMarketReads: 0,
      maximumRequestCount: 7
    });
    expect(fixture.writes.map((write) => [write.kind, write.authority]))
      .toEqual([
        ["sandbox-start", fixture.startAuthority],
        ["run-control-start", fixture.startAuthority],
        ["evaluation-running", fixture.startAuthority]
      ]);
    expect(fixture.service.active(fixture.side.trading_run_ref.id)).toBe(false);
    expect(fixture.runner.active(fixture.side.trading_run_ref.id)).toBe(false);
    await expect(fixture.store.listPaperTradingObservations(
      fixture.side.paper_trading_evaluation_ref.id
    )).resolves.toEqual([]);
    await expect(fixture.service.inspectComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority
    })).resolves.toMatchObject({ ...running, observed_at: expect.any(String) });

    await expect(fixture.service.observe(fixture.side.trading_run_ref.id))
      .rejects.toMatchObject({ code: "paper_trading_comparison_authority_required" });
    await expect(fixture.service.schedule(fixture.side.trading_run_ref.id))
      .rejects.toMatchObject({ code: "paper_trading_comparison_authority_required" });
    await expect(fixture.service.stop(fixture.side.trading_run_ref.id))
      .rejects.toMatchObject({ code: "paper_trading_comparison_authority_required" });
    await expect(fixture.service.recoverRunningEvaluations()).resolves.toEqual([{
      tradingRunId: fixture.side.trading_run_ref.id,
      status: "skipped",
      reason: "qualification"
    }]);

    const stopped = await fixture.service.stopComparisonSide({
      side: fixture.side,
      authority: fixture.stopAuthority,
      deadlineAt: new Date(Date.now() + 10_000).toISOString(),
      reason: "policy_cleanup"
    });
    expect(stopped).toMatchObject({
      runtime_lifecycle_status: "stopped",
      evaluation_status: "stopped",
      sandbox_lifecycle_status: "stopped",
      provider_request_count: 3,
      provider_session_active: false
    });
    const stoppedEvaluation = await fixture.store.getPaperTradingEvaluation(
      fixture.side.paper_trading_evaluation_ref.id
    );
    expect(stoppedEvaluation?.next_observation_at).toBeUndefined();
    expect(fixture.writes.slice(3).map((write) => [write.kind, write.authority]))
      .toEqual([
        ["run-control-stop", fixture.stopAuthority],
        ["sandbox-stop", fixture.stopAuthority],
        ["evaluation-stopped", fixture.stopAuthority]
      ]);
    const writesAfterStop = fixture.writes.length;
    await expect(fixture.service.stopComparisonSide({
      side: fixture.side,
      authority: fixture.stopAuthority,
      deadlineAt: new Date(Date.now() + 10_000).toISOString(),
      reason: "restart_cleanup"
    })).resolves.toMatchObject({ ...stopped, observed_at: expect.any(String) });
    expect(fixture.writes).toHaveLength(writesAfterStop);
    expect(fixture.effects).toMatchObject({ providerCloses: 1, sandboxStops: 1 });
  });

  it("closes active comparison resources during service shutdown", async () => {
    const fixture = await authorizedComparisonSessionFixture("shutdown-cleanup");
    await fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    });

    await fixture.service.stopAllSessions();

    await expect(fixture.service.inspectComparisonSide({
      side: fixture.side,
      authority: fixture.stopAuthority
    })).resolves.toMatchObject({
      runtime_lifecycle_status: "stopped",
      evaluation_status: "stopped",
      sandbox_lifecycle_status: "stopped",
      provider_session_active: false
    });
    expect(fixture.effects).toMatchObject({
      providerCloses: 1,
      sandboxStops: 1
    });

    await fixture.service.stopAllSessions();
    expect(fixture.effects).toMatchObject({
      providerCloses: 1,
      sandboxStops: 1
    });
  });

  it("prepares one authorized first-checkpoint side without economic Store writes", async () => {
    const fixture = await authorizedComparisonSessionFixture("checkpoint-prepare", {
      checkpointLogLines: [checkpointOrderEventLine()]
    });
    await fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    });
    const checkpoint = await fixture.authorizeCheckpoint();
    const writesBefore = fixture.writes.length;
    const fixedReadsBefore = fixture.effects.fixedMarketReads;

    const prepared = await fixture.service.prepareComparisonCheckpointSide({
      side: fixture.side,
      authority: checkpoint.authority,
      tick: checkpoint.tick,
      deadlineAt: checkpoint.attempt.checkpoint_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    });

    expect(prepared).toMatchObject({
      role: "challenger",
      observation: {
        status: "recorded",
        paper_trading_comparison_tick_ref: checkpoint.attempt.tick_ref,
        paper_trading_comparison_checkpoint_attempt_ref: {
          id: checkpoint.attempt.paper_trading_comparison_checkpoint_attempt_id
        }
      },
      evaluation: { observation_count: 1 },
      consumed_event_count: 1,
      provider_request_count_after: 3,
      preparation_digest: expect.stringMatching(/^sha256:/)
    });
    expect(prepared.ledger_inputs).toHaveLength(1);
    expect(prepared.ledger_outcomes).toHaveLength(1);
    expect(fixture.effects).toMatchObject({
      sandboxLogReads: 1,
      fixedMarketReads: fixedReadsBefore,
      underlyingMarketReads: 0
    });
    expect(fixture.writes.slice(writesBefore)).toEqual([{
      kind: "sandbox-evidence",
      authority: checkpoint.authority
    }]);
    await expect(fixture.store.listPaperTradingObservations(
      fixture.side.paper_trading_evaluation_ref.id
    )).resolves.toEqual([]);
    await expect(fixture.store.getPaperTradingEvaluation(
      fixture.side.paper_trading_evaluation_ref.id
    )).resolves.toMatchObject({ observation_count: 0 });
  });

  it("rejects checkpoint preparation after the frozen provider request cap", async () => {
    const fixture = await authorizedComparisonSessionFixture("checkpoint-request-cap", {
      checkpointLogLines: [checkpointOrderEventLine()]
    });
    await fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    });
    const checkpoint = await fixture.authorizeCheckpoint();

    await expect(fixture.service.prepareComparisonCheckpointSide({
      side: fixture.side,
      authority: checkpoint.authority,
      tick: checkpoint.tick,
      deadlineAt: checkpoint.attempt.checkpoint_deadline_at,
      maximumProviderRequestCount: 2,
      signal: new AbortController().signal
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_provider_request_budget_exceeded"
    });
    expect(fixture.effects.sandboxLogReads).toBe(0);
  });

  it("rejects a mismatched checkpoint role before sandbox refresh", async () => {
    const fixture = await authorizedComparisonSessionFixture("checkpoint-role", {
      checkpointLogLines: [checkpointOrderEventLine()]
    });
    await fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    });
    const checkpoint = await fixture.authorizeCheckpoint();

    await expect(fixture.service.prepareComparisonCheckpointSide({
      side: fixture.side,
      authority: { ...checkpoint.authority, role: "champion" },
      tick: checkpoint.tick,
      deadlineAt: checkpoint.attempt.checkpoint_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_checkpoint_write_context_mismatch"
    });
    expect(fixture.effects.sandboxLogReads).toBe(0);
  });

  it("stops after a paired checkpoint without erasing committed evidence", async () => {
    const fixture = await authorizedComparisonSessionFixture("checkpoint-stop", {
      checkpointLogLines: [checkpointOrderEventLine()]
    });
    await fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    });
    const checkpoint = await fixture.authorizeCheckpoint();
    const prepared = await fixture.service.prepareComparisonCheckpointSide({
      side: fixture.side,
      authority: checkpoint.authority,
      tick: checkpoint.tick,
      deadlineAt: checkpoint.attempt.checkpoint_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    });
    fixture.commitCheckpoint(prepared);

    await expect(fixture.service.stopComparisonSide({
      side: fixture.side,
      authority: fixture.stopAuthority,
      deadlineAt: new Date(Date.now() + 10_000).toISOString(),
      reason: "handoff_cleanup"
    })).resolves.toMatchObject({
      runtime_lifecycle_status: "stopped",
      evaluation_status: "stopped"
    });
    await expect(fixture.store.getPaperTradingEvaluation(
      fixture.side.paper_trading_evaluation_ref.id
    )).resolves.toMatchObject({
      status: "stopped",
      observation_count: 1,
      next_observation_at: undefined,
      processed_trading_system_event_ids:
        prepared.evaluation.processed_trading_system_event_ids
    });
  });

  it("keeps comparison tick attribution dormant, then records exact delivery and acknowledgement", async () => {
    const fixture = await readyTickAttributionSessionFixture("tick-attribution-happy");
    const hooks = fixture.providerHooks();
    const market = comparisonTickMarket(fixture.tick);
    const deliveredAt = new Date(
      Date.parse(fixture.checkpointOutcome.completed_at) + 1_000
    ).toISOString();

    await expect(hooks.deliver({
      market,
      provider_request_count: 4,
      delivered_at: deliveredAt
    })).resolves.toBeUndefined();
    expect(fixture.tickDeliveries()).toEqual([]);

    await fixture.service.enableComparisonTickAttributionSide({
      side: fixture.side,
      authority: comparisonTickAttributionAuthority(fixture),
      tick: fixture.tick
    });
    const writesBefore = structuredClone(fixture.writes);
    const effectsBefore = structuredClone(fixture.effects);
    const context = await hooks.deliver({
      market,
      provider_request_count: 4,
      delivered_at: deliveredAt
    });
    if (!context) throw new Error("enabled delivery did not return context");
    const replayedContext = await hooks.deliver({
      market,
      provider_request_count: 5,
      delivered_at: new Date(Date.parse(deliveredAt) + 1_000).toISOString()
    });

    expect(replayedContext).toEqual(context);
    expect(context).toMatchObject({
      tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: fixture.tick.paper_trading_comparison_tick_id
      },
      tick_digest: fixture.tick.tick_digest,
      tick_sequence: 1,
      delivery_ref: {
        record_kind: "paper_trading_comparison_tick_delivery",
        id: expect.any(String)
      },
      delivery_digest: expect.stringMatching(/^sha256:/)
    });
    expect(fixture.tickDeliveries()).toHaveLength(1);
    expect(fixture.tickDeliveries()[0]).toMatchObject({
      role: "challenger",
      trading_run_ref: fixture.side.trading_run_ref,
      provider_request_count_at_delivery: 4,
      delivered_at: deliveredAt,
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "not_live"
    });

    const acknowledgement = await hooks.acknowledge({
      context,
      provider_request_count: 6,
      acknowledged_at: new Date(Date.parse(deliveredAt) + 2_000).toISOString()
    });
    const replayedAcknowledgement = await hooks.acknowledge({
      context,
      provider_request_count: 7,
      acknowledged_at: new Date(Date.parse(deliveredAt) + 3_000).toISOString()
    });
    expect(replayedAcknowledgement).toEqual(acknowledgement);
    expect(fixture.tickAcknowledgements()).toHaveLength(1);
    expect(fixture.tickAcknowledgements()[0]).toMatchObject({
      delivery_ref: context.delivery_ref,
      delivery_digest: context.delivery_digest,
      role: "challenger",
      provider_request_count_at_acknowledgement: 6,
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "not_live"
    });
    await expect(hooks.deliver({
      market: {
        ...market,
        observed_at: new Date(Date.parse(deliveredAt) + 4_000).toISOString()
      },
      provider_request_count: 8,
      delivered_at: new Date(Date.parse(deliveredAt) + 4_000).toISOString()
    })).resolves.toBeUndefined();
    expect(fixture.tickDeliveries()).toHaveLength(1);

    for (const invalid of [
      { ...context, tick_digest: "sha256:stale" },
      { ...context, delivery_ref: { ...context.delivery_ref, id: "cross-role-delivery" } },
      { tick_digest: context.tick_digest }
    ]) {
      await expect(hooks.acknowledge({
        context: invalid,
        provider_request_count: 8,
        acknowledged_at: new Date(Date.parse(deliveredAt) + 4_000).toISOString()
      })).rejects.toBeInstanceOf(PaperTradingApiProviderComparisonTickClientError);
    }
    await expect(hooks.acknowledge({
      context,
      provider_request_count: 21,
      acknowledged_at: new Date(Date.parse(deliveredAt) + 5_000).toISOString()
    })).rejects.toBeInstanceOf(PaperTradingApiProviderComparisonTickClientError);

    expect(fixture.writes).toEqual(writesBefore);
    expect(fixture.effects).toEqual(effectsBefore);
    expect(fixture.effects.underlyingMarketReads).toBe(0);
  });

  it("rejects tick attribution enablement outside the exact post-checkpoint side", async () => {
    const preCheckpoint = await authorizedComparisonSessionFixture(
      "tick-attribution-pre-checkpoint"
    );
    await startAuthorizedComparisonFixture(preCheckpoint);
    await expect(preCheckpoint.service.enableComparisonTickAttributionSide({
      side: preCheckpoint.side,
      authority: comparisonTickAttributionAuthority(preCheckpoint),
      tick: preCheckpoint.tick
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_tick_attribution_state_mismatch"
    });

    const wrongRole = await readyTickAttributionSessionFixture(
      "tick-attribution-wrong-role"
    );
    await expect(wrongRole.service.enableComparisonTickAttributionSide({
      side: wrongRole.side,
      authority: {
        ...comparisonTickAttributionAuthority(wrongRole),
        role: "champion"
      },
      tick: wrongRole.tick
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_tick_attribution_context_mismatch"
    });

    const staleAttempt = await readyTickAttributionSessionFixture(
      "tick-attribution-stale-attempt"
    );
    await expect(staleAttempt.service.enableComparisonTickAttributionSide({
      side: staleAttempt.side,
      authority: {
        ...comparisonTickAttributionAuthority(staleAttempt),
        paper_trading_comparison_activation_attempt_ref: {
          record_kind: "paper_trading_comparison_activation_attempt",
          id: "stale-attempt"
        }
      },
      tick: staleAttempt.tick
    })).rejects.toMatchObject({
      code: expect.stringMatching(/not_found|mismatch/)
    });

    const wrongTick = await readyTickAttributionSessionFixture(
      "tick-attribution-wrong-tick"
    );
    await expect(wrongTick.service.enableComparisonTickAttributionSide({
      side: wrongTick.side,
      authority: comparisonTickAttributionAuthority(wrongTick),
      tick: {
        ...wrongTick.tick,
        paper_trading_comparison_tick_id: "wrong-tick"
      }
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_tick_attribution_context_mismatch"
    });

    const missingProvider = await readyTickAttributionSessionFixture(
      "tick-attribution-missing-provider"
    );
    missingProvider.dropProviderSession();
    await expect(missingProvider.service.enableComparisonTickAttributionSide({
      side: missingProvider.side,
      authority: comparisonTickAttributionAuthority(missingProvider),
      tick: missingProvider.tick
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_tick_attribution_provider_missing"
    });

    const stopped = await readyTickAttributionSessionFixture("tick-attribution-stopped");
    await stopped.service.stopComparisonSide({
      side: stopped.side,
      authority: stopped.stopAuthority,
      deadlineAt: new Date(Date.now() + 10_000).toISOString(),
      reason: "handoff_cleanup"
    });
    await expect(stopped.service.enableComparisonTickAttributionSide({
      side: stopped.side,
      authority: comparisonTickAttributionAuthority(stopped),
      tick: stopped.tick
    })).rejects.toMatchObject({
      code: expect.stringMatching(/state_mismatch|provider_missing/)
    });
  });

  it("advances one owned role-bound view and requires a distinct tick 2 acknowledgement", async () => {
    const fixture = await readyRepeatedCheckpointSessionFixture(
      "advance-comparison-view"
    );
    const marketBefore = await fixture.readBoundComparisonMarket();
    const writesBefore = structuredClone(fixture.writes);
    const fixedReadsBefore = fixture.effects.fixedMarketReads;

    await fixture.service.advanceComparisonCheckpointSide({
      side: fixture.side,
      authority: fixture.repeated.authority,
      tick: fixture.repeated.tick
    });
    await fixture.service.advanceComparisonCheckpointSide({
      side: fixture.side,
      authority: fixture.repeated.authority,
      tick: fixture.repeated.tick
    });

    const marketAfter = await fixture.readBoundComparisonMarket();
    expect([marketBefore.price, marketAfter.price]).toEqual([60_000, 60_100]);
    expect(fixture.effects).toMatchObject({
      providerStarts: 1,
      providerCloses: 0,
      sandboxStarts: 1,
      sandboxStops: 0,
      fixedMarketReads: fixedReadsBefore,
      underlyingMarketReads: 0
    });
    expect(fixture.writes).toEqual(writesBefore);

    const deliveredAt = new Date(
      Date.parse(fixture.repeated.attempt.attempted_at) + 1_000
    ).toISOString();
    const checkpointProviderRequestCount =
      fixture.repeated.attempt.challenger.provider_request_count_before;
    await expect(fixture.hooks.deliver({
      market: comparisonTickMarket(fixture.tick),
      provider_request_count: checkpointProviderRequestCount,
      delivered_at: deliveredAt
    })).resolves.toBeUndefined();
    const context = await fixture.hooks.deliver({
      market: comparisonTickMarket(fixture.repeated.tick),
      provider_request_count: checkpointProviderRequestCount + 1,
      delivered_at: deliveredAt
    });
    if (!context) throw new Error("tick 2 delivery did not return context");
    expect(context).toMatchObject({
      tick_ref: {
        id: fixture.repeated.tick.paper_trading_comparison_tick_id
      },
      tick_digest: fixture.repeated.tick.tick_digest,
      tick_sequence: 2
    });
    expect(context.delivery_ref.id).not.toBe(fixture.firstContext.delivery_ref.id);

    await expect(fixture.hooks.acknowledge({
      context: fixture.firstContext,
      provider_request_count: checkpointProviderRequestCount + 2,
      acknowledged_at: new Date(Date.parse(deliveredAt) + 1_000).toISOString()
    })).rejects.toMatchObject({ code: "comparison_tick_context_stale" });
    await expect(fixture.hooks.acknowledge({
      context,
      provider_request_count: checkpointProviderRequestCount + 3,
      acknowledged_at: new Date(Date.parse(deliveredAt) + 2_000).toISOString()
    })).resolves.toMatchObject({
      acknowledgement_ref: { id: expect.any(String) },
      acknowledgement_digest: expect.stringMatching(/^sha256:/)
    });
    expect(fixture.tickDeliveries()).toHaveLength(2);
    expect(fixture.tickAcknowledgements()).toHaveLength(2);
  });

  it.each([
    ["wrong role", (fixture: Awaited<ReturnType<
      typeof readyRepeatedCheckpointSessionFixture
    >>) => ({
      authority: { ...fixture.repeated.authority, role: "champion" as const },
      tick: fixture.repeated.tick
    })],
    ["wrong tick", (fixture: Awaited<ReturnType<
      typeof readyRepeatedCheckpointSessionFixture
    >>) => ({
      authority: fixture.repeated.authority,
      tick: {
        ...fixture.repeated.tick,
        paper_trading_comparison_tick_id: "different-tick"
      }
    })],
    ["stale attempt", (fixture: Awaited<ReturnType<
      typeof readyRepeatedCheckpointSessionFixture
    >>) => ({
      authority: {
        ...fixture.repeated.authority,
        checkpoint_attempt_ref: {
          record_kind: "paper_trading_comparison_checkpoint_attempt",
          id: "stale-checkpoint-attempt"
        }
      },
      tick: fixture.repeated.tick
    })]
  ] as const)("rejects %s before changing the repeated comparison view", async (
    _label,
    mutate
  ) => {
    const fixture = await readyRepeatedCheckpointSessionFixture(`advance-${_label}`);
    const changed = mutate(fixture);
    const writesBefore = structuredClone(fixture.writes);
    const effectsBefore = structuredClone(fixture.effects);

    await expect(fixture.service.advanceComparisonCheckpointSide({
      side: fixture.side,
      authority: changed.authority,
      tick: changed.tick
    })).rejects.toMatchObject({
      code: expect.stringMatching(/context|reference|state|not_found/)
    });
    await expect(fixture.readBoundComparisonMarket()).resolves.toMatchObject({
      price: 60_000
    });
    expect(fixture.writes).toEqual(writesBefore);
    expect(fixture.effects).toMatchObject({
      ...effectsBefore,
      fixedMarketReads: effectsBefore.fixedMarketReads + 1
    });
  });

  it("accepts bounded prior-tick polling before changing the repeated comparison view", async () => {
    const fixture = await readyRepeatedCheckpointSessionFixture(
      "advance-bounded-provider-count-drift"
    );
    fixture.setProviderRequestCount(
      fixture.repeated.attempt.challenger.provider_request_count_before + 1
    );
    const writesBefore = structuredClone(fixture.writes);

    await expect(fixture.service.advanceComparisonCheckpointSide({
      side: fixture.side,
      authority: fixture.repeated.authority,
      tick: fixture.repeated.tick
    })).resolves.toBeUndefined();
    await expect(fixture.readBoundComparisonMarket()).resolves.toMatchObject({
      price: 60_100
    });
    expect(fixture.writes).toEqual(writesBefore);
    expect(fixture.effects).toMatchObject({
      providerStarts: 1,
      providerCloses: 0,
      sandboxStarts: 1,
      sandboxStops: 0,
      underlyingMarketReads: 0
    });
  });

  it("rejects provider requests beyond the comparison policy before view advance", async () => {
    const fixture = await readyRepeatedCheckpointSessionFixture(
      "advance-provider-count-limit"
    );
    fixture.setProviderRequestCount(
      fixture.attempt.activation_policy.maximum_provider_request_count_per_side + 1
    );

    await expect(fixture.service.advanceComparisonCheckpointSide({
      side: fixture.side,
      authority: fixture.repeated.authority,
      tick: fixture.repeated.tick
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_checkpoint_state_mismatch"
    });
    await expect(fixture.readBoundComparisonMarket()).resolves.toMatchObject({
      price: 60_000
    });
  });

  it("rejects repeated preparation before tick 2 acknowledgement and accepts acknowledged silence", async () => {
    const missing = await readyRepeatedCheckpointSessionFixture(
      "repeated-checkpoint-missing-ack"
    );
    await missing.service.advanceComparisonCheckpointSide({
      side: missing.side,
      authority: missing.repeated.authority,
      tick: missing.repeated.tick
    });
    const missingLogReads = missing.effects.sandboxLogReads;
    await expect(missing.service.prepareComparisonCheckpointSide({
      side: missing.side,
      authority: {
        ...missing.repeated.authority,
        operation: "refresh_sandbox_evidence"
      },
      tick: missing.repeated.tick,
      deadlineAt: missing.repeated.attempt.checkpoint_deadline_at,
      maximumProviderRequestCount:
        missing.attempt.activation_policy.maximum_provider_request_count_per_side,
      signal: new AbortController().signal
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_tick_acknowledgement_required"
    });
    expect(missing.effects.sandboxLogReads).toBe(missingLogReads);

    const fixture = await readyRepeatedCheckpointSessionFixture(
      "repeated-checkpoint-acknowledged-silence"
    );
    await fixture.service.advanceComparisonCheckpointSide({
      side: fixture.side,
      authority: fixture.repeated.authority,
      tick: fixture.repeated.tick
    });
    const deliveredAt = new Date(
      Date.parse(fixture.repeated.attempt.attempted_at) + 1_000
    ).toISOString();
    const context = await fixture.hooks.deliver({
      market: comparisonTickMarket(fixture.repeated.tick),
      provider_request_count: 7,
      delivered_at: deliveredAt
    });
    if (!context) throw new Error("tick 2 context was not delivered");
    const acknowledgement = await fixture.hooks.acknowledge({
      context,
      provider_request_count: 9,
      acknowledged_at: new Date(Date.parse(deliveredAt) + 1_000).toISOString()
    });
    const writesBefore = fixture.writes.length;

    const prepared = await fixture.service.prepareComparisonCheckpointSide({
      side: fixture.side,
      authority: {
        ...fixture.repeated.authority,
        operation: "refresh_sandbox_evidence"
      },
      tick: fixture.repeated.tick,
      deadlineAt: fixture.repeated.attempt.checkpoint_deadline_at,
      maximumProviderRequestCount:
        fixture.attempt.activation_policy.maximum_provider_request_count_per_side,
      signal: new AbortController().signal
    });

    expect(prepared).toMatchObject({
      role: "challenger",
      observation: {
        sequence: 2,
        status: "no_order",
        paper_trading_comparison_tick_acknowledgement_ref:
          acknowledgement.acknowledgement_ref,
        paper_trading_comparison_tick_acknowledgement_digest:
          acknowledgement.acknowledgement_digest
      },
      evaluation: { observation_count: 2 },
      consumed_event_count: 0,
      provider_request_count_after: 9
    });
    expect(prepared.ledger_inputs).toEqual([]);
    expect(prepared.ledger_outcomes).toEqual([]);
    expect(fixture.writes.slice(writesBefore)).toEqual([{
      kind: "sandbox-evidence",
      authority: {
        ...fixture.repeated.authority,
        operation: "refresh_sandbox_evidence"
      }
    }]);
  });

  it("closes a comparison provider when aborted before the sandbox effect", async () => {
    const controller = new AbortController();
    const fixture = await authorizedComparisonSessionFixture("abort-provider", {
      onProviderStarted: () => controller.abort()
    });

    await expect(fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 5,
      signal: controller.signal
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_aborted"
    });
    expect(fixture.effects).toMatchObject({
      providerStarts: 1,
      providerCloses: 1,
      sandboxStarts: 0
    });
    expect(fixture.writes).toEqual([]);
    await expect(fixture.service.inspectComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority
    })).resolves.toMatchObject({
      runtime_lifecycle_status: "registered",
      evaluation_status: "not_started",
      provider_request_count: 3,
      provider_session_active: false
    });
  });

  it("performs authorized cleanup when aborted after sandbox persistence", async () => {
    const controller = new AbortController();
    const fixture = await authorizedComparisonSessionFixture("abort-sandbox", {
      onSandboxRecorded: () => controller.abort()
    });

    await expect(fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 5,
      signal: controller.signal
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_aborted"
    });
    expect(fixture.effects).toMatchObject({
      providerStarts: 1,
      providerCloses: 1,
      sandboxStarts: 1,
      sandboxStops: 1
    });
    expect(fixture.writes.map((write) => [write.kind, write.authority]))
      .toEqual([
        ["sandbox-start", fixture.startAuthority],
        ["run-control-stop", fixture.stopAuthority],
        ["sandbox-stop", fixture.stopAuthority],
        ["evaluation-stopped", fixture.stopAuthority]
      ]);
    await expect(fixture.service.inspectComparisonSide({
      side: fixture.side,
      authority: fixture.stopAuthority
    })).resolves.toMatchObject({
      runtime_lifecycle_status: "stopped",
      evaluation_status: "stopped",
      sandbox_lifecycle_status: "stopped",
      provider_request_count: 3,
      provider_session_active: false
    });
    await expect(fixture.store.listPaperTradingObservations(
      fixture.side.paper_trading_evaluation_ref.id
    )).resolves.toEqual([]);
  });

  it("rejects a pre-aborted comparison start before any runtime effect", async () => {
    const controller = new AbortController();
    controller.abort();
    const fixture = await authorizedComparisonSessionFixture("abort-before-start");

    await expect(fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 5,
      signal: controller.signal
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_aborted"
    });
    expect(fixture.effects).toMatchObject({
      providerStarts: 0,
      providerCloses: 0,
      sandboxStarts: 0,
      sandboxStops: 0,
      fixedMarketReads: 0,
      underlyingMarketReads: 0
    });
    expect(fixture.writes).toEqual([]);
  });

  it("rejects start bounds that exceed the frozen activation attempt", async () => {
    const deadlineFixture = await authorizedComparisonSessionFixture("late-deadline");
    await expect(deadlineFixture.service.startComparisonSide({
      side: deadlineFixture.side,
      authority: deadlineFixture.startAuthority,
      marketData: deadlineFixture.fixedMarketData,
      deadlineAt: new Date(
        Date.parse(deadlineFixture.attempt.start_deadline_at) + 1
      ).toISOString(),
      maximumProviderRequestCount: 5,
      signal: new AbortController().signal
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_start_deadline_mismatch"
    });
    expect(deadlineFixture.effects.providerStarts).toBe(0);
    expect(deadlineFixture.writes).toEqual([]);

    const requestFixture = await authorizedComparisonSessionFixture("request-bound");
    await expect(requestFixture.service.startComparisonSide({
      side: requestFixture.side,
      authority: requestFixture.startAuthority,
      marketData: requestFixture.fixedMarketData,
      deadlineAt: requestFixture.attempt.start_deadline_at,
      maximumProviderRequestCount:
        requestFixture.attempt.activation_policy.maximum_provider_request_count_per_side + 1,
      signal: new AbortController().signal
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_provider_request_limit_mismatch"
    });
    expect(requestFixture.effects.providerStarts).toBe(0);
    expect(requestFixture.writes).toEqual([]);
  });

  it("rejects cleanup deadlines beyond the frozen cleanup timeout", async () => {
    const fixture = await authorizedComparisonSessionFixture("cleanup-deadline");

    await expect(fixture.service.stopComparisonSide({
      side: fixture.side,
      authority: fixture.stopAuthority,
      deadlineAt: new Date(
        Date.now() + fixture.attempt.activation_policy.cleanup_timeout_ms + 5_000
      ).toISOString(),
      reason: "policy_cleanup"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_cleanup_deadline_mismatch"
    });
    expect(fixture.effects).toMatchObject({
      providerStarts: 0,
      providerCloses: 0,
      sandboxStarts: 0,
      sandboxStops: 0
    });
    expect(fixture.writes).toEqual([]);
  });

  it("keeps request accounting attempt-scoped across provider recreation", async () => {
    const fixture = await authorizedComparisonSessionFixture("provider-recreation");
    const start = () => fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 7,
      signal: new AbortController().signal
    });
    const stop = () => fixture.service.stopComparisonSide({
      side: fixture.side,
      authority: fixture.stopAuthority,
      deadlineAt: new Date(Date.now() + 10_000).toISOString(),
      reason: "policy_cleanup" as const
    });

    await start();
    await stop();
    const restarted = await start();

    expect(fixture.effects.maximumRequestCounts).toEqual([7, 4]);
    expect(restarted).toMatchObject({
      provider_request_count: 6,
      provider_session_active: true
    });
    await stop();
  });

  it("stops a transient sandbox when its authorized Store start is rejected", async () => {
    const fixture = await authorizedComparisonSessionFixture("sandbox-store-failure", {
      failSandboxPersistence: true
    });

    await expect(fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 5,
      signal: new AbortController().signal
    })).rejects.toThrow("injected_sandbox_start_write_failure");
    expect(fixture.effects).toMatchObject({
      providerStarts: 1,
      providerCloses: 1,
      sandboxStarts: 1,
      sandboxStops: 1
    });
    expect(fixture.writes).toEqual([]);
  });

  it("keeps failed transient sandbox cleanup unresolved instead of claiming inactive", async () => {
    const fixture = await authorizedComparisonSessionFixture("sandbox-cleanup-failure", {
      failSandboxPersistence: true,
      failTransientSandboxStop: true
    });

    await expect(fixture.service.startComparisonSide({
      side: fixture.side,
      authority: fixture.startAuthority,
      marketData: fixture.fixedMarketData,
      deadlineAt: fixture.attempt.start_deadline_at,
      maximumProviderRequestCount: 5,
      signal: new AbortController().signal
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_transient_sandbox_cleanup_failed"
    });
    await expect(fixture.service.stopComparisonSide({
      side: fixture.side,
      authority: fixture.stopAuthority,
      deadlineAt: new Date(Date.now() + 10_000).toISOString(),
      reason: "restart_cleanup"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_transient_sandbox_cleanup_unresolved"
    });
    expect(fixture.effects).toMatchObject({
      providerStarts: 1,
      providerCloses: 1,
      sandboxStarts: 1,
      sandboxStops: 1
    });
    expect(fixture.writes).toEqual([]);
  });
});

async function authorizedComparisonSessionFixture(
  suffix: string,
  options: {
    onProviderStarted?: () => void;
    onSandboxRecorded?: () => void;
    failSandboxPersistence?: boolean;
    failTransientSandboxStop?: boolean;
    checkpointLogLines?: string[];
  } = {}
) {
  const backingStore = new LocalStore(path.join(tmpDir, `authorized-${suffix}`));
  await backingStore.initialize();
  const qualification = await qualificationRunFixture(backingStore, `authorized-${suffix}`);
  const preparationEffects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
  const prepared = await inertSessionService(backingStore, preparationEffects)
    .prepare(qualification.input);
  const storedRun = await backingStore.getTradingRun(qualification.run.trading_run_id);
  if (!storedRun) throw new Error("authorized comparison TradingRun was not found");

  const side: PaperTradingComparisonActivationSide = {
    role: "challenger",
    trading_run_ref: { record_kind: "trading_run", id: storedRun.trading_run_id },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: prepared.commitment.paper_trading_evaluation_commitment_id
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: prepared.evaluation.paper_trading_evaluation_id
    }
  };
  const policy = paperTradingComparisonActivationPolicyFor({
    policy_version: "paper-comparison-v1",
    comparison_mode: "bootstrap",
    symbol: "BTCUSDT",
    interval_ms: prepared.evaluation.interval_ms,
    minimum_observation_count: 30,
    minimum_elapsed_ms: 1_800_000,
    maximum_observation_count: 120,
    maximum_elapsed_ms: 7_200_000,
    maximum_start_skew_ms: 5_000,
    maximum_provider_request_count_per_side: 20,
    maximum_retry_count_per_side: 3,
    primary_metric: "net_revenue_usdt",
    minimum_net_revenue_lift_usdt: 10,
    required_confirmation_count: 2,
    require_non_overlapping_windows: true,
    require_both_qualified: true,
    release_policy: "sealed_until_adjudication"
  });
  const attemptedAt = new Date(Date.now() - 1_000).toISOString();
  const tickDraft: PaperTradingComparisonTickRecord = {
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: `session-comparison-tick-${suffix}`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: `session-comparison-${suffix}`
    },
    paper_trading_comparison_commitment_digest: `sha256:comparison-${suffix}`,
    sequence: 1,
    market_data_configuration_digest: prepared.commitment.data_identity
      .market_data_configuration_digest,
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000,
      moving_average_fast: 60_100,
      moving_average_slow: 59_900,
      volatility: 0.01,
      expected_direction: "long",
      observed_at: attemptedAt,
      source_kind: "binance_production_public_hybrid",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      authority_status: "read_only"
    },
    public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: attemptedAt,
      source_kind: "binance_production_public_hybrid",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      stream_marker: `session-first-tick-${suffix}`,
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: attemptedAt,
    tick_digest: "",
    authority_status: "not_live"
  };
  const tick: PaperTradingComparisonTickRecord = {
    ...tickDraft,
    tick_digest: comparisonFixtureDigest(
      paperTradingComparisonTickDigestInput(tickDraft)
    )
  };
  const activation: PaperTradingComparisonActivationRecord = {
    record_kind: "paper_trading_comparison_activation",
    version: 1,
    paper_trading_comparison_activation_id: `session-comparison-activation-${suffix}`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: `session-comparison-${suffix}`
    },
    paper_trading_comparison_commitment_digest: `sha256:comparison-${suffix}`,
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: tick.paper_trading_comparison_tick_id
    },
    first_tick_digest: tick.tick_digest,
    champion: {
      role: "champion",
      trading_run_ref: { record_kind: "trading_run", id: `champion-run-${suffix}` },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: `champion-commitment-${suffix}`
      },
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: `champion-evaluation-${suffix}`
      }
    },
    challenger: structuredClone(side),
    market_data_configuration_digest: prepared.commitment.data_identity
      .market_data_configuration_digest,
    activation_policy: policy,
    activation_scope: "qualification_pair",
    activation_status: "authorized",
    authorized_at: attemptedAt,
    activation_digest: `sha256:activation-${suffix}`,
    live_exchange_authority: false,
    order_submission_authority: false,
    private_exchange_access: "forbidden",
    credentials_access: "forbidden",
    authority_status: "not_live"
  };
  const attempt: PaperTradingComparisonActivationAttemptRecord = {
    record_kind: "paper_trading_comparison_activation_attempt",
    version: 1,
    paper_trading_comparison_activation_attempt_id: `session-comparison-attempt-${suffix}`,
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_activation_digest: activation.activation_digest,
    paper_trading_comparison_commitment_ref: {
      ...activation.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest:
      activation.paper_trading_comparison_commitment_digest,
    first_tick_ref: { ...activation.first_tick_ref },
    first_tick_digest: activation.first_tick_digest,
    champion: structuredClone(activation.champion),
    challenger: structuredClone(activation.challenger),
    activation_policy: structuredClone(policy),
    attempt_sequence: 1,
    retry_index: 0,
    start_mode: "parallel",
    attempt_status: "starting",
    attempted_at: attemptedAt,
    start_deadline_at: new Date(
      Date.parse(attemptedAt) + policy.maximum_activation_elapsed_ms
    ).toISOString(),
    attempt_digest: `sha256:attempt-${suffix}`,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  let activationOutcome: PaperTradingComparisonActivationOutcomeRecord | undefined;
  const ticks: PaperTradingComparisonTickRecord[] = [structuredClone(tick)];
  const checkpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[] = [];
  const checkpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[] = [];
  let checkpointObservations: PreparedPaperTradingComparisonCheckpointSide["observation"][] = [];
  let providerHooks: PaperTradingApiProviderComparisonTickHooks | undefined;
  let providerRequestCount = 3;
  const tickDeliveries: PaperTradingComparisonTickDeliveryRecord[] = [];
  const tickAcknowledgements: PaperTradingComparisonTickAcknowledgementRecord[] = [];
  const startAuthority = comparisonSessionAuthority(attempt, "start");
  const stopAuthority = comparisonSessionAuthority(attempt, "stop");
  const effects = {
    providerStarts: 0,
    providerCloses: 0,
    sandboxStarts: 0,
    sandboxStops: 0,
    sandboxLogReads: 0,
    fixedMarketReads: 0,
    underlyingMarketReads: 0,
    maximumRequestCount: undefined as number | undefined,
    maximumRequestCounts: [] as Array<number | undefined>
  };
  const writes: Array<{
    kind: string;
    authority: PaperTradingComparisonRuntimeWriteContext |
      PaperTradingComparisonCheckpointWriteContext |
      PaperTradingComparisonTickIOWriteContext | undefined;
  }> = [];
  let run: TradingRunRecord = structuredClone(storedRun);
  let evaluation: PaperTradingEvaluationRecord = structuredClone(prepared.evaluation);
  let sandbox: SandboxDetailReadModel | undefined;

  const store = new Proxy(backingStore as OuroborosStorePort, {
    get(target, property, receiver) {
      if (property === "getCandidateForTradingRun") {
        return async (id: string) => {
          const candidate = await backingStore.getCandidateForTradingRun(id);
          if (!candidate || id !== run.trading_run_id) return candidate;
          return {
            ...structuredClone(candidate),
            runtime: {
              ...structuredClone(candidate.runtime),
              runtime_lifecycle_status: run.runtime_lifecycle_status,
              ...(sandbox ? { sandbox: structuredClone(sandbox) } : {})
            }
          };
        };
      }
      if (property === "getTradingRun") {
        return async (id: string) => id === run.trading_run_id ? structuredClone(run) : undefined;
      }
      if (property === "getPaperTradingEvaluation") {
        return async (id: string) => id === evaluation.paper_trading_evaluation_id
          ? structuredClone(evaluation)
          : undefined;
      }
      if (property === "getLatestPaperTradingEvaluationForTradingRun") {
        return async (id: string) => id === run.trading_run_id
          ? structuredClone(evaluation)
          : undefined;
      }
      if (property === "listPaperTradingEvaluations") {
        return async () => [structuredClone(evaluation)];
      }
      if (property === "getPaperTradingComparisonActivation") {
        return async (id: string) => id === activation.paper_trading_comparison_activation_id
          ? structuredClone(activation)
          : undefined;
      }
      if (property === "getPaperTradingComparisonActivationAttempt") {
        return async (id: string) => id === attempt.paper_trading_comparison_activation_attempt_id
          ? structuredClone(attempt)
          : undefined;
      }
      if (property === "listPaperTradingComparisonActivationAttempts") {
        return async () => [structuredClone(attempt)];
      }
      if (property === "getPaperTradingComparisonTick") {
        return async (id: string) => structuredClone(ticks.find((record) =>
          record.paper_trading_comparison_tick_id === id
        ));
      }
      if (property === "getPaperTradingComparisonActivationOutcome") {
        return async (id: string) =>
          activationOutcome?.paper_trading_comparison_activation_outcome_id === id
            ? structuredClone(activationOutcome)
            : undefined;
      }
      if (property === "listPaperTradingComparisonActivationOutcomes") {
        return async () => activationOutcome ? [structuredClone(activationOutcome)] : [];
      }
      if (property === "getPaperTradingComparisonCheckpointAttempt") {
        return async (id: string) => structuredClone(checkpointAttempts.find((record) =>
          record.paper_trading_comparison_checkpoint_attempt_id === id
        ));
      }
      if (property === "listPaperTradingComparisonCheckpointAttempts") {
        return async () => structuredClone(checkpointAttempts);
      }
      if (property === "listPaperTradingComparisonCheckpointOutcomes") {
        return async (checkpointAttemptId: string) => structuredClone(
          checkpointOutcomes.filter((record) =>
            record.checkpoint_attempt_ref.id === checkpointAttemptId
          )
        );
      }
      if (property === "getPaperTradingComparisonCheckpointOutcome") {
        return async (id: string) => structuredClone(checkpointOutcomes.find((record) =>
          record.paper_trading_comparison_checkpoint_outcome_id === id
        ));
      }
      if (property === "recordPaperTradingComparisonTickDelivery") {
        return async (
          record: PaperTradingComparisonTickDeliveryRecord,
          authority: PaperTradingComparisonTickIOWriteContext
        ) => {
          if (authority.operation !== "deliver_market_snapshot" ||
            record.delivery_digest !== comparisonFixtureDigest(
              paperTradingComparisonTickDeliveryDigestInput(record)
            )) {
            throw new Error("invalid_tick_delivery_fixture_write");
          }
          const existing = tickDeliveries.find((item) =>
            item.paper_trading_comparison_tick_delivery_id ===
              record.paper_trading_comparison_tick_delivery_id
          );
          if (existing && JSON.stringify(existing) !== JSON.stringify(record)) {
            throw Object.assign(new Error("tick_delivery_conflict"), {
              code: "paper_trading_comparison_tick_delivery_conflict"
            });
          }
          if (!existing) tickDeliveries.push(structuredClone(record));
          return structuredClone(existing ?? record);
        };
      }
      if (property === "getPaperTradingComparisonTickDelivery") {
        return async (id: string) => structuredClone(tickDeliveries.find((item) =>
          item.paper_trading_comparison_tick_delivery_id === id
        ));
      }
      if (property === "listPaperTradingComparisonTickDeliveries") {
        return async (attemptId: string) => structuredClone(tickDeliveries.filter((item) =>
          item.paper_trading_comparison_activation_attempt_ref.id === attemptId
        ));
      }
      if (property === "recordPaperTradingComparisonTickAcknowledgement") {
        return async (
          record: PaperTradingComparisonTickAcknowledgementRecord,
          authority: PaperTradingComparisonTickIOWriteContext
        ) => {
          if (authority.operation !== "acknowledge_tick" ||
            record.acknowledgement_digest !== comparisonFixtureDigest(
              paperTradingComparisonTickAcknowledgementDigestInput(record)
            )) {
            throw new Error("invalid_tick_acknowledgement_fixture_write");
          }
          const existing = tickAcknowledgements.find((item) =>
            item.paper_trading_comparison_tick_acknowledgement_id ===
              record.paper_trading_comparison_tick_acknowledgement_id
          );
          if (existing && JSON.stringify(existing) !== JSON.stringify(record)) {
            throw Object.assign(new Error("tick_acknowledgement_conflict"), {
              code: "paper_trading_comparison_tick_acknowledgement_conflict"
            });
          }
          if (!existing) tickAcknowledgements.push(structuredClone(record));
          return structuredClone(existing ?? record);
        };
      }
      if (property === "getPaperTradingComparisonTickAcknowledgement") {
        return async (id: string) => structuredClone(tickAcknowledgements.find((item) =>
          item.paper_trading_comparison_tick_acknowledgement_id === id
        ));
      }
      if (property === "listPaperTradingComparisonTickAcknowledgements") {
        return async (attemptId: string) => structuredClone(
          tickAcknowledgements.filter((item) =>
            item.paper_trading_comparison_activation_attempt_ref.id === attemptId
          )
        );
      }
      if (property === "getSandbox") {
        return async (id: string) => sandbox?.sandbox_id === id
          ? structuredClone(sandbox)
          : undefined;
      }
      if (property === "recordSandboxStart") {
        return async (input: any, authority?: PaperTradingComparisonRuntimeWriteContext) => {
          if (options.failSandboxPersistence) {
            throw new Error("injected_sandbox_start_write_failure");
          }
          writes.push({ kind: "sandbox-start", authority: structuredClone(authority) });
          sandbox = {
            ...structuredClone(input.instance),
            command_evidence_refs: input.instance.command_evidence_refs ?? [],
            logs: [],
            heartbeats: [],
            command_evidence: []
          };
          run = {
            ...run,
            runtime_lifecycle_status: "running",
            placement_ref: { ...input.instance.sandbox_placement_ref },
            sandbox_ref: { record_kind: "sandbox", id: input.instance.sandbox_id }
          };
          options.onSandboxRecorded?.();
          return { sandbox: structuredClone(sandbox) };
        };
      }
      if (property === "recordSandboxObservations") {
        return async (
          id: string,
          observations: any,
          authority?: PaperTradingComparisonCheckpointWriteContext
        ) => {
          if (!sandbox || sandbox.sandbox_id !== id) throw new Error("sandbox_not_found");
          writes.push({
            kind: "sandbox-evidence",
            authority: structuredClone(authority)
          });
          sandbox = {
            ...sandbox,
            lifecycle_status: observations.lifecycle_status ?? sandbox.lifecycle_status,
            logs: [
              ...sandbox.logs,
              ...(observations.logs ?? []).map((log: any) => ({
                log_ref: { record_kind: "sandbox_log", id: log.sandbox_log_id },
                captured_at: log.captured_at,
                lines: structuredClone(log.lines)
              }))
            ]
          };
          return {
            sandbox: structuredClone(sandbox),
            logs: structuredClone(sandbox.logs),
            heartbeats: structuredClone(sandbox.heartbeats),
            command_evidence: structuredClone(sandbox.command_evidence)
          };
        };
      }
      if (property === "previewLedger") {
        return async (input: any) => backingStore.previewLedger(input);
      }
      if (property === "recordRunControlAudit") {
        return async (input: any, authority?: PaperTradingComparisonRuntimeWriteContext) => {
          const status = input.decision.resulting_lifecycle_status;
          writes.push({
            kind: status === "running" ? "run-control-start" : "run-control-stop",
            authority: structuredClone(authority)
          });
          run = { ...run, runtime_lifecycle_status: status };
          return {} as never;
        };
      }
      if (property === "recordPaperTradingEvaluation") {
        return async (
          next: PaperTradingEvaluationRecord,
          authority?: PaperTradingComparisonRuntimeWriteContext
        ) => {
          writes.push({
            kind: next.status === "running" ? "evaluation-running" : "evaluation-stopped",
            authority: structuredClone(authority)
          });
          evaluation = structuredClone(next);
          return structuredClone(evaluation);
        };
      }
      if (property === "stopSandbox") {
        return async (
          input: { sandbox_id: string; stopped_at?: string },
          _observations: unknown,
          authority?: PaperTradingComparisonRuntimeWriteContext
        ) => {
          writes.push({ kind: "sandbox-stop", authority: structuredClone(authority) });
          if (!sandbox || sandbox.sandbox_id !== input.sandbox_id) {
            throw new Error("sandbox_not_found");
          }
          sandbox = {
            ...sandbox,
            lifecycle_status: "stopped",
            stopped_at: input.stopped_at ?? new Date().toISOString()
          };
          run = { ...run, runtime_lifecycle_status: "stopped" };
          return { sandbox: structuredClone(sandbox) };
        };
      }
      if (property === "listPaperTradingObservations") {
        return async () => structuredClone(checkpointObservations);
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });

  const fixedMarketData: GatewayMarketDataPort = {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://example.invalid",
    required_endpoints: [],
    authority_status: "read_only",
    async readMarketSnapshot() {
      effects.fixedMarketReads += 1;
      return {
        symbol: "BTCUSDT",
        price: 60_000,
        moving_average_fast: 60_100,
        moving_average_slow: 59_900,
        volatility: 0.01,
        expected_direction: "long",
        observed_at: attemptedAt,
        source_kind: "binance_production_public_rest",
        freshness: "fresh"
      };
    },
    async readPublicMarketLivenessSurface() {
      throw new Error("fixed comparison liveness is unavailable");
    },
    async readPublicExecutionSnapshot() {
      throw new Error("fixed comparison execution is unavailable");
    }
  };
  const runner = new PaperTradingEvaluationRunner();
  const service = new PaperTradingSessionService({
    store,
    runner,
    intervalMs: prepared.evaluation.interval_ms,
    artifactResolver: {
      async resolveArtifactDigest() {
        return prepared.commitment.resolved_artifact_digest;
      }
    },
    sandboxAdapters: {
      deterministic_test: {
        async startArtifactInstance(input: SandboxStartInput) {
          effects.sandboxStarts += 1;
          return {
            placement: {
              record_kind: "sandbox_placement",
              version: 1,
              sandbox_placement_id: input.sandbox_placement_id,
              placement_kind: "fixture_local_placeholder",
              authority_status: "not_launched"
            },
            instance: {
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
              log_refs: [],
              heartbeat_refs: [],
              authority_status: "not_live"
            },
            logs: [],
            heartbeats: [],
            command_evidence: []
          };
        },
        async getArtifactInstanceLogs(instance: any) {
          effects.sandboxLogReads += 1;
          const capturedAt = new Date().toISOString();
          return {
            lifecycle_status: "running" as const,
            logs: options.checkpointLogLines?.length ? [{
              record_kind: "sandbox_log" as const,
              version: 1,
              sandbox_log_id: `${instance.sandbox_id}-checkpoint-log`,
              sandbox_ref: { record_kind: "sandbox", id: instance.sandbox_id },
              lines: structuredClone(options.checkpointLogLines),
              captured_at: capturedAt,
              authority_status: "trace_only" as const
            }] : []
          };
        },
        async stopArtifactInstance() {
          effects.sandboxStops += 1;
          if (options.failTransientSandboxStop) {
            throw new Error("injected_transient_sandbox_stop_failure");
          }
          return {
            lifecycle_status: "stopped" as const,
            stopped_at: new Date().toISOString()
          };
        }
      }
    } as never,
    marketData: {
      ...fixedMarketData,
      async readMarketSnapshot() {
        effects.underlyingMarketReads += 1;
        throw new Error("underlying market read is forbidden");
      }
    },
    async apiProviderFactory(binding, providerOptions) {
      effects.providerStarts += 1;
      effects.maximumRequestCount = providerOptions.maximum_request_count;
      effects.maximumRequestCounts.push(providerOptions.maximum_request_count);
      providerHooks = providerOptions.comparison_tick_hooks;
      await binding.marketData.readMarketSnapshot();
      options.onProviderStarted?.();
      return {
        base_url: `http://${run.trading_run_id}.comparison.test`,
        async close() {
          effects.providerCloses += 1;
        },
        requests: () => [
          { at: attemptedAt, method: "GET", path: "/one", response_status: 200 },
          { at: attemptedAt, method: "GET", path: "/two", response_status: 200 },
          { at: attemptedAt, method: "GET", path: "/three", response_status: 200 }
        ],
        request_count: () => providerRequestCount,
        candidate_input: {} as never
      };
    }
  });
  const authorizeCheckpoint = async () => {
    const completedAt = new Date().toISOString();
    const activationOutcomeDraft: PaperTradingComparisonActivationOutcomeRecord = {
      record_kind: "paper_trading_comparison_activation_outcome",
      version: 1,
      paper_trading_comparison_activation_outcome_id:
        `${attempt.paper_trading_comparison_activation_attempt_id}-both-running`,
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: attempt.paper_trading_comparison_activation_attempt_id
      },
      paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
      paper_trading_comparison_activation_ref: {
        ...attempt.paper_trading_comparison_activation_ref
      },
      paper_trading_comparison_activation_digest:
        attempt.paper_trading_comparison_activation_digest,
      outcome_sequence: 1,
      outcome_status: "both_running",
      outcome_reason: "started_within_policy",
      champion_latest_result_ref: {
        record_kind: "paper_trading_comparison_activation_side_result",
        id: `${attempt.paper_trading_comparison_activation_attempt_id}-champion-start`
      },
      challenger_latest_result_ref: {
        record_kind: "paper_trading_comparison_activation_side_result",
        id: `${attempt.paper_trading_comparison_activation_attempt_id}-challenger-start`
      },
      next_action: "capture_first_paired_checkpoint",
      completed_at: completedAt,
      outcome_digest: "",
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "not_live"
    };
    activationOutcome = {
      ...activationOutcomeDraft,
      outcome_digest: comparisonFixtureDigest(
        paperTradingComparisonActivationOutcomeDigestInput(activationOutcomeDraft)
      )
    };
    const checkpointAttemptedAt = new Date(Date.parse(completedAt) + 1).toISOString();
    const side = (role: "champion" | "challenger") => ({
      role,
      trading_run_ref: { ...attempt[role].trading_run_ref },
      paper_trading_evaluation_ref: {
        ...attempt[role].paper_trading_evaluation_ref
      },
      evaluation_record_digest: role === "challenger"
        ? comparisonFixtureDigest(
            paperTradingComparisonEvaluationRecordDigestInput(evaluation)
          )
        : `sha256:champion-evaluation-${suffix}`,
      observation_chain_digest: comparisonFixtureDigest(
        paperTradingComparisonObservationChainDigestInput([])
      ),
      provider_request_count_before: providerRequestCount
    });
    const checkpointDraft: PaperTradingComparisonCheckpointAttemptRecord = {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      version: 1,
      paper_trading_comparison_checkpoint_attempt_id:
        `${attempt.paper_trading_comparison_activation_attempt_id}-checkpoint-1`,
      paper_trading_comparison_activation_ref: {
        ...attempt.paper_trading_comparison_activation_ref
      },
      paper_trading_comparison_activation_digest:
        attempt.paper_trading_comparison_activation_digest,
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: attempt.paper_trading_comparison_activation_attempt_id
      },
      paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
      activation_outcome_ref: {
        record_kind: "paper_trading_comparison_activation_outcome",
        id: activationOutcome.paper_trading_comparison_activation_outcome_id
      },
      activation_outcome_digest: activationOutcome.outcome_digest,
      paper_trading_comparison_commitment_ref: {
        ...attempt.paper_trading_comparison_commitment_ref
      },
      paper_trading_comparison_commitment_digest:
        attempt.paper_trading_comparison_commitment_digest,
      tick_ref: { ...attempt.first_tick_ref },
      tick_digest: attempt.first_tick_digest,
      checkpoint_sequence: 1,
      champion: side("champion"),
      challenger: side("challenger"),
      attempted_at: checkpointAttemptedAt,
      checkpoint_deadline_at: new Date(
        Date.parse(checkpointAttemptedAt) + 60_000
      ).toISOString(),
      attempt_status: "preparing",
      attempt_digest: "",
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "not_live"
    };
    const checkpointAttempt: PaperTradingComparisonCheckpointAttemptRecord = {
      ...checkpointDraft,
      attempt_digest: comparisonFixtureDigest(
        paperTradingComparisonCheckpointAttemptDigestInput(checkpointDraft)
      )
    };
    checkpointAttempts.push(structuredClone(checkpointAttempt));
    const authority: PaperTradingComparisonCheckpointWriteContext = {
      paper_trading_comparison_activation_ref: {
        ...attempt.paper_trading_comparison_activation_ref
      },
      paper_trading_comparison_activation_digest:
        attempt.paper_trading_comparison_activation_digest,
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: attempt.paper_trading_comparison_activation_attempt_id
      },
      paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
      activation_outcome_ref: {
        record_kind: "paper_trading_comparison_activation_outcome",
        id: activationOutcome.paper_trading_comparison_activation_outcome_id
      },
      activation_outcome_digest: activationOutcome.outcome_digest,
      checkpoint_attempt_ref: {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
      },
      checkpoint_attempt_digest: checkpointAttempt.attempt_digest,
      role: "challenger",
      operation: "refresh_sandbox_evidence"
    };
    return {
      attempt: structuredClone(checkpointAttempt),
      tick: structuredClone(tick),
      outcome: structuredClone(activationOutcome),
      authority
    };
  };
  const commitCheckpoint = (
    preparedSide: PreparedPaperTradingComparisonCheckpointSide
  ): PaperTradingComparisonCheckpointOutcomeRecord => {
    const checkpointAttempt = checkpointAttempts[0];
    if (!checkpointAttempt) throw new Error("checkpoint attempt is not authorized");
    evaluation = structuredClone(preparedSide.evaluation);
    checkpointObservations = [structuredClone(preparedSide.observation)];
    run = {
      ...run,
      order_request_refs: preparedSide.ledger_outcomes.map((ledger) => ({
        record_kind: "order_request",
        id: ledger.order_request.order_request_id
      })),
      gateway_result_refs: preparedSide.ledger_outcomes.map((ledger) => ({
        record_kind: "gateway_result",
        id: ledger.gateway_result.gateway_result_id
      })),
      execution_result_refs: preparedSide.ledger_outcomes.map((ledger) => ({
        record_kind: "execution_result",
        id: ledger.execution_result.execution_result_id
      }))
    };
    const draft: PaperTradingComparisonCheckpointOutcomeRecord = {
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      version: 1,
      paper_trading_comparison_checkpoint_outcome_id:
        `${checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id}-outcome`,
      checkpoint_attempt_ref: {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
      },
      checkpoint_attempt_digest: checkpointAttempt.attempt_digest,
      tick_ref: { ...checkpointAttempt.tick_ref },
      tick_digest: checkpointAttempt.tick_digest,
      checkpoint_sequence: 1,
      outcome_status: "paired",
      outcome_reason: "paired_checkpoint_recorded",
      champion: {
        role: "champion",
        observation_ref: {
          record_kind: "paper_trading_observation",
          id: `champion-observation-${suffix}`
        },
        observation_record_digest: `sha256:champion-observation-${suffix}`,
        evaluation_record_digest: `sha256:champion-evaluation-${suffix}`,
        ledger_chain_refs: [],
        observation_status: "no_order",
        consumed_event_count: 0,
        provider_request_count_after: 3
      },
      challenger: {
        role: "challenger",
        observation_ref: {
          record_kind: "paper_trading_observation",
          id: preparedSide.observation.paper_trading_observation_id
        },
        observation_record_digest: comparisonFixtureDigest(
          paperTradingComparisonPersistedRecordDigestInput(preparedSide.observation)
        ),
        evaluation_record_digest: comparisonFixtureDigest(
          paperTradingComparisonEvaluationRecordDigestInput(preparedSide.evaluation)
        ),
        ledger_chain_refs: preparedSide.ledger_outcomes.map((ledger) => ({
          record_kind: "ledger_chain",
          id: ledger.order_request.order_request_id
        })),
        observation_status: preparedSide.observation.status,
        consumed_event_count: preparedSide.consumed_event_count,
        provider_request_count_after: preparedSide.provider_request_count_after
      },
      next_action: "serve_and_acknowledge_current_tick",
      completed_at: new Date().toISOString(),
      outcome_digest: "",
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "not_live"
    };
    const checkpointOutcome: PaperTradingComparisonCheckpointOutcomeRecord = {
      ...draft,
      outcome_digest: comparisonFixtureDigest(
        paperTradingComparisonCheckpointOutcomeDigestInput(draft)
      )
    };
    checkpointOutcomes.push(structuredClone(checkpointOutcome));
    return structuredClone(checkpointOutcome);
  };
  const authorizeRepeatedCheckpoint = () => {
    const previousAttempt = checkpointAttempts[0];
    const previousOutcome = checkpointOutcomes[0];
    if (!activationOutcome || !previousAttempt || !previousOutcome ||
      checkpointObservations.length !== 1) {
      throw new Error("first checkpoint must be committed before repeated authorization");
    }
    const observedAt = new Date(
      Date.parse(tick.observed_at) + prepared.evaluation.interval_ms
    ).toISOString();
    const nextTickDraft: PaperTradingComparisonTickRecord = {
      ...structuredClone(tick),
      paper_trading_comparison_tick_id: `${tick.paper_trading_comparison_tick_id}-2`,
      sequence: 2,
      previous_tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: tick.paper_trading_comparison_tick_id
      },
      previous_tick_digest: tick.tick_digest,
      market_snapshot: {
        ...structuredClone(tick.market_snapshot),
        price: tick.market_snapshot.price + 100,
        observed_at: new Date(Date.parse(observedAt) - 2).toISOString()
      },
      public_execution_snapshot: {
        ...structuredClone(tick.public_execution_snapshot),
        observed_at: new Date(Date.parse(observedAt) - 1).toISOString(),
        stream_marker: `${tick.public_execution_snapshot.stream_marker}-2`
      },
      observed_at: observedAt,
      tick_digest: ""
    };
    const nextTick: PaperTradingComparisonTickRecord = {
      ...nextTickDraft,
      tick_digest: comparisonFixtureDigest(
        paperTradingComparisonTickDigestInput(nextTickDraft)
      )
    };
    const attemptedAt = new Date(Date.parse(observedAt) + 1).toISOString();
    const sideFor = (role: "champion" | "challenger") => ({
      role,
      trading_run_ref: { ...attempt[role].trading_run_ref },
      paper_trading_evaluation_ref: {
        ...attempt[role].paper_trading_evaluation_ref
      },
      evaluation_record_digest: role === "challenger"
        ? comparisonFixtureDigest(
            paperTradingComparisonEvaluationRecordDigestInput(evaluation)
          )
        : `sha256:champion-evaluation-${suffix}-checkpoint-1`,
      observation_chain_digest: role === "challenger"
        ? comparisonFixtureDigest(
            paperTradingComparisonObservationChainDigestInput(checkpointObservations)
          )
        : `sha256:champion-observation-chain-${suffix}-checkpoint-1`,
      provider_request_count_before: providerRequestCount
    });
    const nextAttemptDraft: PaperTradingComparisonCheckpointAttemptRecord = {
      ...structuredClone(previousAttempt),
      paper_trading_comparison_checkpoint_attempt_id:
        `${attempt.paper_trading_comparison_activation_attempt_id}-checkpoint-2`,
      tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: nextTick.paper_trading_comparison_tick_id
      },
      tick_digest: nextTick.tick_digest,
      checkpoint_sequence: 2,
      previous_checkpoint_outcome_ref: {
        record_kind: "paper_trading_comparison_checkpoint_outcome",
        id: previousOutcome.paper_trading_comparison_checkpoint_outcome_id
      },
      previous_checkpoint_outcome_digest: previousOutcome.outcome_digest,
      champion: sideFor("champion"),
      challenger: sideFor("challenger"),
      attempted_at: attemptedAt,
      checkpoint_deadline_at: new Date(Date.parse(attemptedAt) + 60_000).toISOString(),
      attempt_digest: ""
    };
    const nextAttempt: PaperTradingComparisonCheckpointAttemptRecord = {
      ...nextAttemptDraft,
      attempt_digest: comparisonFixtureDigest(
        paperTradingComparisonCheckpointAttemptDigestInput(nextAttemptDraft)
      )
    };
    ticks.push(structuredClone(nextTick));
    checkpointAttempts.push(structuredClone(nextAttempt));
    const authority: PaperTradingComparisonCheckpointWriteContext & {
      operation: "advance_tick_view";
    } = {
      paper_trading_comparison_activation_ref: {
        ...nextAttempt.paper_trading_comparison_activation_ref
      },
      paper_trading_comparison_activation_digest:
        nextAttempt.paper_trading_comparison_activation_digest,
      paper_trading_comparison_activation_attempt_ref: {
        ...nextAttempt.paper_trading_comparison_activation_attempt_ref
      },
      paper_trading_comparison_activation_attempt_digest:
        nextAttempt.paper_trading_comparison_activation_attempt_digest,
      activation_outcome_ref: { ...nextAttempt.activation_outcome_ref },
      activation_outcome_digest: nextAttempt.activation_outcome_digest,
      checkpoint_attempt_ref: {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: nextAttempt.paper_trading_comparison_checkpoint_attempt_id
      },
      checkpoint_attempt_digest: nextAttempt.attempt_digest,
      role: "challenger",
      operation: "advance_tick_view"
    };
    return { tick: nextTick, attempt: nextAttempt, authority };
  };
  return {
    store,
    service,
    runner,
    side,
    activation,
    attempt,
    tick,
    startAuthority,
    stopAuthority,
    fixedMarketData,
    effects,
    writes,
    authorizeCheckpoint,
    authorizeRepeatedCheckpoint,
    commitCheckpoint,
    providerHooks() {
      if (!providerHooks) throw new Error("comparison tick hooks were not installed");
      return {
        deliver(input: Parameters<
          PaperTradingApiProviderComparisonTickHooks["deliver"]
        >[0]) {
          providerRequestCount = Math.max(
            providerRequestCount,
            input.provider_request_count
          );
          return providerHooks!.deliver(input);
        },
        acknowledge(input: Parameters<
          PaperTradingApiProviderComparisonTickHooks["acknowledge"]
        >[0]) {
          providerRequestCount = Math.max(
            providerRequestCount,
            input.provider_request_count
          );
          return providerHooks!.acknowledge(input);
        }
      };
    },
    tickDeliveries: () => structuredClone(tickDeliveries),
    tickAcknowledgements: () => structuredClone(tickAcknowledgements),
    setProviderRequestCount(value: number) {
      providerRequestCount = value;
    },
    async readBoundComparisonMarket() {
      const internals = service as unknown as {
        comparisonGatewayBindings: Map<string, { marketData: GatewayMarketDataPort }>;
      };
      const binding = internals.comparisonGatewayBindings.values().next().value;
      if (!binding) throw new Error("comparison Gateway binding was not installed");
      return binding.marketData.readMarketSnapshot();
    },
    dropProviderSession() {
      const internals = service as unknown as {
        comparisonApiProviderSessions: Map<string, unknown>;
      };
      internals.comparisonApiProviderSessions.clear();
    }
  };
}

async function startAuthorizedComparisonFixture(
  fixture: Awaited<ReturnType<typeof authorizedComparisonSessionFixture>>
): Promise<void> {
  await fixture.service.startComparisonSide({
    side: fixture.side,
    authority: fixture.startAuthority,
    marketData: fixture.fixedMarketData,
    deadlineAt: fixture.attempt.start_deadline_at,
    maximumProviderRequestCount:
      fixture.attempt.activation_policy.maximum_provider_request_count_per_side,
    signal: new AbortController().signal
  });
}

async function readyTickAttributionSessionFixture(suffix: string) {
  const fixture = await authorizedComparisonSessionFixture(suffix);
  await startAuthorizedComparisonFixture(fixture);
  const checkpoint = await fixture.authorizeCheckpoint();
  const prepared = await fixture.service.prepareComparisonCheckpointSide({
    side: fixture.side,
    authority: checkpoint.authority,
    tick: checkpoint.tick,
    deadlineAt: checkpoint.attempt.checkpoint_deadline_at,
    maximumProviderRequestCount:
      fixture.attempt.activation_policy.maximum_provider_request_count_per_side,
    signal: new AbortController().signal
  });
  const checkpointOutcome = fixture.commitCheckpoint(prepared);
  return { ...fixture, checkpointOutcome };
}

async function readyRepeatedCheckpointSessionFixture(suffix: string) {
  const fixture = await readyTickAttributionSessionFixture(suffix);
  const hooks = fixture.providerHooks();
  await fixture.service.enableComparisonTickAttributionSide({
    side: fixture.side,
    authority: comparisonTickAttributionAuthority(fixture),
    tick: fixture.tick
  });
  const deliveredAt = new Date(
    Date.parse(fixture.checkpointOutcome.completed_at) + 1_000
  ).toISOString();
  const firstContext = await hooks.deliver({
    market: comparisonTickMarket(fixture.tick),
    provider_request_count: 4,
    delivered_at: deliveredAt
  });
  if (!firstContext) throw new Error("first comparison tick delivery was not recorded");
  await hooks.acknowledge({
    context: firstContext,
    provider_request_count: 6,
    acknowledged_at: new Date(Date.parse(deliveredAt) + 1_000).toISOString()
  });
  const repeated = fixture.authorizeRepeatedCheckpoint();
  return { ...fixture, hooks, firstContext, repeated };
}

function comparisonTickAttributionAuthority(input: {
  attempt: PaperTradingComparisonActivationAttemptRecord;
  side: PaperTradingComparisonActivationSide;
  tick: PaperTradingComparisonTickRecord;
}): PaperTradingComparisonTickIOWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      ...input.attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      input.attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: input.attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: input.attempt.attempt_digest,
    role: input.side.role,
    trading_run_ref: { ...input.side.trading_run_ref },
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: input.tick.paper_trading_comparison_tick_id
    },
    tick_digest: input.tick.tick_digest,
    operation: "deliver_market_snapshot"
  };
}

function comparisonTickMarket(tick: PaperTradingComparisonTickRecord): MarketSnapshot {
  const market = tick.market_snapshot;
  if (market.moving_average_fast === undefined ||
    market.moving_average_slow === undefined ||
    market.volatility === undefined ||
    market.expected_direction === undefined) {
    throw new Error("comparison tick market fixture is incomplete");
  }
  return {
    symbol: market.symbol,
    price: market.price,
    moving_average_fast: market.moving_average_fast,
    moving_average_slow: market.moving_average_slow,
    volatility: market.volatility,
    expected_direction: market.expected_direction,
    observed_at: market.observed_at,
    ...(market.source_kind === undefined ? {} : { source_kind: market.source_kind }),
    ...(market.source_priority === undefined
      ? {}
      : { source_priority: market.source_priority }),
    ...(market.freshness === undefined ? {} : { freshness: market.freshness }),
    ...(market.ws_connected === undefined
      ? {}
      : { ws_connected: market.ws_connected }),
    ...(market.rest_fallback_used === undefined
      ? {}
      : { rest_fallback_used: market.rest_fallback_used }),
    ...(market.gap_detected === undefined
      ? {}
      : { gap_detected: market.gap_detected }),
    ...(market.last_update_id === undefined
      ? {}
      : { last_update_id: market.last_update_id }),
    ...(market.stream_marker === undefined
      ? {}
      : { stream_marker: market.stream_marker })
  };
}

function comparisonFixtureDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function checkpointOrderEventLine(): string {
  return JSON.stringify({
    event: "order_request",
    event_id: "checkpoint-session-order-1",
    instance_id: "checkpoint-session",
    at: new Date().toISOString(),
    authority_status: "trace_only",
    intent_kind: "place_order",
    symbol: "BTCUSDT",
    side: "buy",
    order_type: "limit",
    quantity: "0.001",
    limit_price: "60000",
    reason: "candidate first checkpoint order"
  });
}

function comparisonSessionAuthority(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  operation: "start" | "stop"
): PaperTradingComparisonRuntimeWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
    role: "challenger",
    operation
  };
}

async function qualificationRunFixture(store: LocalStore, suffix: string) {
  const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!candidate) {
    throw new Error("fixture candidate was not materialized");
  }
  const run = await store.createPaperTradingRun({
    idempotency_key: `session-deterministic-identity-${suffix}`,
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: "2026-07-10T00:00:00.000Z"
  });
  const input: Parameters<PaperTradingSessionService["prepare"]>[0] = {
    candidateId: candidate.candidate_id,
    candidateVersionId: candidate.candidate_version.candidate_version_id,
    tradingRunId: run.trading_run_id,
    evidencePurpose: "qualification",
    clock: "external"
  };
  return { candidate, run, input };
}

async function commitmentOnlyQualificationFixture(suffix: string) {
  const store = new LocalStore(path.join(tmpDir, suffix));
  await store.initialize();
  const fixture = await qualificationRunFixture(store, suffix);
  const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
  await expect(inertSessionService(failFirstEvaluationWrite(store), effects).prepare(fixture.input))
    .rejects.toThrow("injected_evaluation_write_failure");
  const [commitment] = await store.listPaperTradingEvaluationCommitments();
  if (!commitment) {
    throw new Error("deterministic commitment was not persisted");
  }
  return { ...fixture, store, effects, commitment };
}

function notStartedEvaluationFixture(
  commitment: PaperTradingEvaluationCommitmentRecord,
  evaluationId: string
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: evaluationId,
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    interval_ms: commitment.window_policy.interval_ms,
    observation_count: 0,
    started_at: commitment.committed_at,
    latest_score: {
      revenue_usdt: 0,
      cost_usdt: 0,
      net_revenue_usdt: 0,
      net_return_pct: 0
    },
    paper_account_snapshot: structuredClone(commitment.initial_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
}

function withSessionCommitmentDigest(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationCommitmentRecord {
  return {
    ...commitment,
    commitment_digest: `sha256:${createHash("sha256")
      .update(paperTradingEvaluationCommitmentDigestInput(commitment))
      .digest("hex")}`
  };
}

function failFirstEvaluationWrite(store: OuroborosStorePort): OuroborosStorePort {
  let failed = false;
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "recordPaperTradingEvaluation") {
        return async (...args: Parameters<OuroborosStorePort["recordPaperTradingEvaluation"]>) => {
          if (!failed) {
            failed = true;
            throw new Error("injected_evaluation_write_failure");
          }
          return target.recordPaperTradingEvaluation(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function exactEvaluationOverrideStore(
  store: OuroborosStorePort,
  evaluation: PaperTradingEvaluationRecord,
  writes: { evaluations: number }
): OuroborosStorePort {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "getPaperTradingEvaluation") {
        return async (id: string) => id === evaluation.paper_trading_evaluation_id
          ? evaluation
          : target.getPaperTradingEvaluation(id);
      }
      if (property === "listPaperTradingEvaluations") {
        return async () => (await target.listPaperTradingEvaluations()).map((record) =>
          record.paper_trading_evaluation_id === evaluation.paper_trading_evaluation_id
            ? evaluation
            : record
        );
      }
      if (property === "recordPaperTradingEvaluation") {
        return async (...args: Parameters<OuroborosStorePort["recordPaperTradingEvaluation"]>) => {
          writes.evaluations += 1;
          return target.recordPaperTradingEvaluation(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function commitmentOverrideStore(
  store: OuroborosStorePort,
  commitment: PaperTradingEvaluationCommitmentRecord,
  writes: { evaluations: number }
): OuroborosStorePort {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "getPaperTradingEvaluationCommitment") {
        return async (id: string) => id === commitment.paper_trading_evaluation_commitment_id
          ? commitment
          : target.getPaperTradingEvaluationCommitment(id);
      }
      if (property === "listPaperTradingEvaluationCommitments") {
        return async () => (await target.listPaperTradingEvaluationCommitments()).map((record) =>
          record.paper_trading_evaluation_commitment_id === commitment.paper_trading_evaluation_commitment_id
            ? commitment
            : record
        );
      }
      if (property === "recordPaperTradingEvaluation") {
        return async (...args: Parameters<OuroborosStorePort["recordPaperTradingEvaluation"]>) => {
          writes.evaluations += 1;
          return target.recordPaperTradingEvaluation(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function evaluationWriteCountingStore(
  store: OuroborosStorePort,
  writes: { evaluations: number }
): OuroborosStorePort {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "recordPaperTradingEvaluation") {
        return async (...args: Parameters<OuroborosStorePort["recordPaperTradingEvaluation"]>) => {
          writes.evaluations += 1;
          return target.recordPaperTradingEvaluation(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function stoppedEvaluationOrderStore(
  store: OuroborosStorePort,
  order: string[]
): OuroborosStorePort {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "recordPaperTradingEvaluation") {
        return async (...args: Parameters<OuroborosStorePort["recordPaperTradingEvaluation"]>) => {
          if (args[0].status === "stopped") {
            order.push("stopped");
          }
          return target.recordPaperTradingEvaluation(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function stoppedEvaluationCountingStore(
  store: OuroborosStorePort,
  writes: { count: number }
): OuroborosStorePort {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "recordPaperTradingEvaluation") {
        return async (...args: Parameters<OuroborosStorePort["recordPaperTradingEvaluation"]>) => {
          if (args[0].status === "stopped") {
            writes.count += 1;
          }
          return target.recordPaperTradingEvaluation(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function activatableResearchSessionService(
  store: OuroborosStorePort,
  effects: { providerStarts: number; sandboxStarts: number; marketReads: number },
  runner?: PaperTradingEvaluationRunner,
  artifactResolver: SystemCodeArtifactResolverPort = {
    async resolveArtifactDigest() {
      return "sha256:session-service-fixture";
    }
  }
): PaperTradingSessionService {
  return new PaperTradingSessionService({
    store,
    runner,
    intervalMs: 60_000,
    artifactResolver,
    sandboxAdapters: {
      deterministic_test: {
        async startArtifactInstance(input: SandboxStartInput) {
          effects.sandboxStarts += 1;
          return {
            placement: {
              record_kind: "sandbox_placement",
              version: 1,
              sandbox_placement_id: input.sandbox_placement_id,
              placement_kind: "fixture_local_placeholder",
              authority_status: "not_launched"
            },
            instance: {
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
              log_refs: [],
              heartbeat_refs: [],
              authority_status: "not_live"
            },
            logs: [],
            heartbeats: [],
            command_evidence: []
          };
        },
        async stopArtifactInstance() {
          return {
            lifecycle_status: "stopped" as const,
            stopped_at: "2026-07-10T00:00:00.000Z"
          };
        }
      }
    } as never,
    marketData: {
      provider_kind: "binance_production_public_market_data",
      source_kind: "binance_production_public_hybrid",
      rest_base_url: "https://example.invalid",
      required_endpoints: [],
      authority_status: "read_only",
      async readMarketSnapshot() {
        effects.marketReads += 1;
        throw new Error("research replay preparation read market data");
      },
      async readPublicMarketLivenessSurface() {
        effects.marketReads += 1;
        throw new Error("research replay preparation read market liveness");
      },
      async readPublicExecutionSnapshot() {
        effects.marketReads += 1;
        throw new Error("research replay preparation read public execution");
      }
    },
    async apiProviderFactory() {
      effects.providerStarts += 1;
      return {
        base_url: "http://research-replay.test",
        async close() {},
        requests: () => [],
        candidate_input: {} as never
      };
    }
  });
}

function sandboxAdapter(
  kind: SandboxAdapterKind,
  onStart: (input: SandboxStartInput) => void
) {
  return {
    async startArtifactInstance(input: SandboxStartInput) {
      onStart(input);
      return {
        placement: {
          record_kind: "sandbox_placement" as const,
          version: 1 as const,
          sandbox_placement_id: input.sandbox_placement_id,
          placement_kind: "fixture_local_placeholder" as const,
          authority_status: "not_launched" as const
        },
        instance: {
          record_kind: "sandbox" as const,
          version: 1 as const,
          sandbox_id: input.instance_id,
          adapter_kind: kind,
          system_code_ref: {
            record_kind: "system_code",
            id: input.artifact.system_code_id
          },
          runtime_ref: input.runtime_ref,
          sandbox_placement_ref: {
            record_kind: "sandbox_placement",
            id: input.sandbox_placement_id
          },
          lifecycle_status: "running" as const,
          sandbox_name: input.sandbox_name,
          created_at: input.created_at,
          started_at: input.created_at,
          log_refs: [],
          heartbeat_refs: [],
          authority_status: "not_live" as const
        },
        logs: [],
        heartbeats: [],
        command_evidence: []
      };
    },
    async stopArtifactInstance() {
      return {
        lifecycle_status: "removed" as const,
        stopped_at: "2026-07-16T00:00:00.000Z",
        removed_at: "2026-07-16T00:00:00.000Z"
      };
    }
  };
}

function paperSessionMarketData(): GatewayMarketDataPort {
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://example.invalid",
    required_endpoints: [],
    authority_status: "read_only",
    async readMarketSnapshot() {
      throw new Error("market snapshot was not expected");
    },
    async readPublicMarketLivenessSurface() {
      throw new Error("market liveness was not expected");
    },
    async readPublicExecutionSnapshot() {
      throw new Error("public execution was not expected");
    }
  };
}

function transientlyFailingRecoverySessionService(
  store: OuroborosStorePort,
  effects: { providerStarts: number; sandboxStarts: number; marketReads: number }
): PaperTradingSessionService {
  return new PaperTradingSessionService({
    store,
    intervalMs: 60_000,
    artifactResolver: {
      async resolveArtifactDigest() {
        return "sha256:session-service-fixture";
      }
    },
    sandboxAdapters: {
      deterministic_test: {
        async startArtifactInstance() {
          effects.sandboxStarts += 1;
          throw new Error("sandbox recovery unavailable");
        },
        async stopArtifactInstance() {
          return {
            lifecycle_status: "stopped" as const,
            stopped_at: "2026-07-16T00:00:00.000Z"
          };
        }
      }
    } as never,
    marketData: paperSessionMarketData(),
    async apiProviderFactory() {
      effects.providerStarts += 1;
      return {
        base_url: "http://paper-recovery.test",
        async close() {},
        requests: () => [],
        candidate_input: {} as never
      };
    }
  });
}

function inertSessionService(
  store: OuroborosStorePort,
  effects: { providerStarts: number; sandboxStarts: number; marketReads: number }
): PaperTradingSessionService {
  return new PaperTradingSessionService({
    store,
    intervalMs: 60_000,
    artifactResolver: {
      async resolveArtifactDigest() {
        return "sha256:session-service-fixture";
      }
    },
    sandboxAdapters: {
      deterministic_test: {
        async startArtifactInstance() {
          effects.sandboxStarts += 1;
          throw new Error("qualification preparation started a sandbox");
        }
      }
    } as never,
    marketData: {
      provider_kind: "binance_production_public_market_data",
      source_kind: "binance_production_public_hybrid",
      rest_base_url: "https://example.invalid",
      required_endpoints: [],
      authority_status: "read_only",
      async readMarketSnapshot() {
        effects.marketReads += 1;
        throw new Error("qualification preparation read market data");
      },
      async readPublicMarketLivenessSurface() {
        effects.marketReads += 1;
        throw new Error("qualification preparation read market liveness");
      },
      async readPublicExecutionSnapshot() {
        effects.marketReads += 1;
        throw new Error("qualification preparation read public execution");
      }
    },
    async apiProviderFactory() {
      effects.providerStarts += 1;
      throw new Error("qualification preparation started a provider");
    }
  });
}

async function prepareGuardedSession(evidencePurpose: "qualification" | "research_feedback") {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!candidate) {
    throw new Error("fixture candidate was not materialized");
  }
  const run = await store.createPaperTradingRun({
    idempotency_key: `session-service-guard-${evidencePurpose}`,
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    evidence_purpose: evidencePurpose
  });
  let providerStarts = 0;
  let sandboxStarts = 0;
  let marketReads = 0;
  const service = new PaperTradingSessionService({
    store,
    artifactResolver: {
      async resolveArtifactDigest() {
        return "sha256:session-service-guard";
      }
    },
    sandboxAdapters: {
      deterministic_test: {
        async startArtifactInstance() {
          sandboxStarts += 1;
          throw new Error("unactivated sessions must not start a sandbox");
        }
      }
    } as never,
    marketData: {
      provider_kind: "binance_production_public_market_data",
      source_kind: "binance_production_public_hybrid",
      rest_base_url: "https://example.invalid",
      required_endpoints: [],
      authority_status: "read_only",
      async readMarketSnapshot() {
        marketReads += 1;
        throw new Error("unactivated sessions must not read market data");
      },
      async readPublicMarketLivenessSurface() {
        throw new Error("unactivated sessions must not read market data");
      },
      async readPublicExecutionSnapshot() {
        throw new Error("unactivated sessions must not read market data");
      }
    },
    async apiProviderFactory() {
      providerStarts += 1;
      throw new Error("unactivated sessions must not start a provider");
    }
  });
  const prepared = await service.prepare({
    candidateId: candidate.candidate_id,
    candidateVersionId: candidate.candidate_version.candidate_version_id,
    tradingRunId: run.trading_run_id,
    evidencePurpose,
    clock: "external"
  });
  return {
    store,
    service,
    prepared,
    tradingRunId: run.trading_run_id,
    effectCounts: () => ({ providerStarts, sandboxStarts, marketReads })
  };
}

async function guardedSessionState(store: LocalStore, tradingRunId: string) {
  const evaluation = await store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
  const candidate = await store.getCandidateForTradingRun(tradingRunId);
  return structuredClone({
    tradingRun: await store.getTradingRun(tradingRunId),
    commitment: evaluation?.paper_trading_evaluation_commitment_ref
      ? await store.getPaperTradingEvaluationCommitment(evaluation.paper_trading_evaluation_commitment_ref.id)
      : undefined,
    evaluation,
    observations: evaluation
      ? await store.listPaperTradingObservations(evaluation.paper_trading_evaluation_id)
      : [],
    runControl: candidate?.runtime.run_control,
    sandbox: candidate?.runtime.sandbox,
    ledger: candidate?.ledger
  });
}
