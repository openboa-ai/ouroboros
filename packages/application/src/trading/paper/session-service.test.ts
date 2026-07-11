import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  PAPER_TRADING_COMPARISON_ZERO_SCORE,
  paperTradingComparisonActivationPolicyFor,
  paperTradingEvaluationCommitmentDigestInput,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonActivationSide,
  type PaperTradingComparisonRuntimeWriteContext,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type SandboxDetailReadModel,
  type TradingRunRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type { OuroborosStorePort } from "../../ports/store";
import type { SandboxStartInput } from "../../ports/sandbox";
import { initialPaperTradingEngineState, paperTradingScoreFromAccount } from "./engine";
import { PaperTradingEvaluationRunner } from "./evaluation-runner";
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
      id: `session-comparison-tick-${suffix}`
    },
    first_tick_digest: `sha256:tick-${suffix}`,
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
  const startAuthority = comparisonSessionAuthority(attempt, "start");
  const stopAuthority = comparisonSessionAuthority(attempt, "stop");
  const effects = {
    providerStarts: 0,
    providerCloses: 0,
    sandboxStarts: 0,
    sandboxStops: 0,
    fixedMarketReads: 0,
    underlyingMarketReads: 0,
    maximumRequestCount: undefined as number | undefined,
    maximumRequestCounts: [] as Array<number | undefined>
  };
  const writes: Array<{
    kind: string;
    authority: PaperTradingComparisonRuntimeWriteContext | undefined;
  }> = [];
  let run: TradingRunRecord = structuredClone(storedRun);
  let evaluation: PaperTradingEvaluationRecord = structuredClone(prepared.evaluation);
  let sandbox: SandboxDetailReadModel | undefined;

  const store = new Proxy(backingStore as OuroborosStorePort, {
    get(target, property, receiver) {
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
      if (property === "listPaperTradingObservations") return async () => [];
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
        request_count: () => 3,
        candidate_input: {} as never
      };
    }
  });
  return {
    store,
    service,
    runner,
    side,
    activation,
    attempt,
    startAuthority,
    stopAuthority,
    fixedMarketData,
    effects,
    writes
  };
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
  runner?: PaperTradingEvaluationRunner
): PaperTradingSessionService {
  return new PaperTradingSessionService({
    store,
    runner,
    intervalMs: 60_000,
    artifactResolver: {
      async resolveArtifactDigest() {
        return "sha256:session-service-fixture";
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
