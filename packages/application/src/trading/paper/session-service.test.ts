import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  PAPER_TRADING_COMPARISON_ZERO_SCORE,
  paperTradingEvaluationCommitmentDigestInput,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
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
});

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
