import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import type { SandboxStartInput } from "../../ports/sandbox";
import { PaperTradingSessionService } from "./session-service";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-session-service-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("PaperTradingSessionService", () => {
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
