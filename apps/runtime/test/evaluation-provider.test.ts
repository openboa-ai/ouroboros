import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { runCandidateEvaluation } from "../src/candidate-evaluation";
import { FixtureEvaluationProviderAdapter } from "../src/providers/fixture-evaluation-provider";
import type { CandidateEvaluationRequest } from "../src/providers/runtime-provider-adapter";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-evaluation-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("FixtureEvaluationProviderAdapter", () => {
  it("returns deterministic trace-only evaluation output", async () => {
    const adapter = new FixtureEvaluationProviderAdapter();

    const result = await adapter.runCandidateEvaluation(validEvaluationRequest("candidate-version-001"));

    expect(result).toMatchObject({
      status: "succeeded",
      trace_ref: {
        record_kind: "trace_placeholder",
        id: "trace-runtime-evaluation-fixture-001"
      },
      evaluator_ref: {
        record_kind: "evaluation_provider",
        id: "deterministic-backtest-fixture"
      }
    });
    expect(result.output_artifact_refs).toEqual([
      {
        record_kind: "evaluation_provider_output_artifact",
        id: "fixture-evaluation-output-runtime-evaluation-fixture-001"
      }
    ]);
    expect(result.debug_artifact_refs).toEqual([
      {
        record_kind: "debug_artifact",
        id: "fixture-evaluation-debug-runtime-evaluation-fixture-001"
      }
    ]);
  });

  it("maps invalid evaluation requests to deterministic provider failures", async () => {
    const adapter = new FixtureEvaluationProviderAdapter();

    const result = await adapter.runCandidateEvaluation({
      ...validEvaluationRequest("candidate-version-001"),
      stage_binding_ref: { record_kind: "trader_system_candidate", id: "wrong-ref" }
    });

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "invalid_evaluation_request",
      trace_ref: {
        record_kind: "trace_placeholder",
        id: "trace-runtime-evaluation-fixture-001"
      }
    });
  });

  it("rejects empty execution mode values", async () => {
    const adapter = new FixtureEvaluationProviderAdapter();

    const result = await adapter.runCandidateEvaluation({
      ...validEvaluationRequest("candidate-version-001"),
      execution_mode: "" as CandidateEvaluationRequest["execution_mode"]
    });

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "unsupported_execution_mode"
    });
  });
});

describe("runCandidateEvaluation", () => {
  it("records adapter output as non-counted evaluation trace material", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const outcome = await runCandidateEvaluation(
      store,
      new FixtureEvaluationProviderAdapter(),
      validEvaluationRequest(candidate.candidate_version.candidate_version_id)
    );

    expect(outcome.status).toBe("created");
    if (outcome.status !== "created") {
      throw new Error("expected created evaluation outcome");
    }
    expect(outcome.evaluation.evaluation_run).toMatchObject({
      status: "created",
      authority_status: "not_counted",
      trace_ref: {
        record_kind: "trace_placeholder",
        id: "trace-runtime-evaluation-fixture-001"
      },
      evaluator_ref: {
        record_kind: "evaluation_provider",
        id: "deterministic-backtest-fixture"
      }
    });
    expect(outcome.evaluation.stage_binding).toMatchObject({
      stage: "backtest",
      profile: "backtest",
      execution_mode: "host_local",
      authority_status: "not_live"
    });
    expect(outcome.evaluation.trace.provider_output_artifact_refs).toEqual(
      outcome.provider_result.output_artifact_refs
    );
    expect(outcome.evaluation.trace.debug_artifact_refs).toEqual(
      outcome.provider_result.debug_artifact_refs
    );
    expect(outcome.evaluation.sealing_decision).toMatchObject({
      evidence_disposition: "not_counted",
      authority_status: "not_counted",
      disposition_reason: "provider_output_trace_only"
    });
    expect(outcome.evaluation.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification_kind: "trace_debug_material",
          classification_status: "trace_only",
          authority_status: "not_counted"
        }),
        expect.objectContaining({
          classification_kind: "non_counted_evidence",
          classification_status: "not_counted",
          authority_status: "not_counted"
        })
      ])
    );
  });

  it("returns an existing idempotent evaluation run without calling the provider again", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }
    const provider = new CountingEvaluationProviderAdapter();
    const request = validEvaluationRequest(candidate.candidate_version.candidate_version_id);

    const first = await runCandidateEvaluation(store, provider, request);
    const second = await runCandidateEvaluation(store, provider, request);

    expect(first.status).toBe("created");
    expect(second.status).toBe("created");
    expect(provider.runCount).toBe(1);
    if (first.status !== "created" || second.status !== "created") {
      throw new Error("expected created evaluation outcomes");
    }
    expect(second.evaluation).toEqual(first.evaluation);
  });

  it("keeps provider failures out of the evaluation store", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }
    const before = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    const outcome = await runCandidateEvaluation(
      store,
      new FixtureEvaluationProviderAdapter({ failureReason: "evaluation_provider_failed" }),
      validEvaluationRequest(candidate.candidate_version.candidate_version_id)
    );

    expect(outcome).toMatchObject({
      status: "failed",
      failure_reason: "evaluation_provider_failed",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidate.candidate_version.candidate_version_id
    });
    await expect(store.getCandidate(FIXTURE_CANDIDATE_ID)).resolves.toEqual(before);
  });

  it("maps deterministic local-store errors without creating silent placeholders", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateEvaluation(
      store,
      new FixtureEvaluationProviderAdapter(),
      {
        ...validEvaluationRequest("missing-version"),
        candidate_version_id: "missing-version"
      }
    );

    expect(outcome).toMatchObject({
      status: "failed",
      failure_reason: "candidate_version_not_found",
      store_error: {
        code: "candidate_version_not_found"
      }
    });
  });
});

function validEvaluationRequest(candidateVersionId: string): CandidateEvaluationRequest {
  return {
    candidate_id: FIXTURE_CANDIDATE_ID,
    candidate_version_id: candidateVersionId,
    stage_binding_ref: {
      record_kind: "stage_binding",
      id: "stage-binding-runtime-evaluation-fixture-001"
    },
    trace_id: "trace-runtime-evaluation-fixture-001",
    idempotency_key: "runtime-evaluation-fixture-001",
    execution_mode: "host_local"
  };
}

class CountingEvaluationProviderAdapter extends FixtureEvaluationProviderAdapter {
  runCount = 0;

  override async runCandidateEvaluation(request: CandidateEvaluationRequest) {
    this.runCount += 1;
    return super.runCandidateEvaluation(request);
  }
}
