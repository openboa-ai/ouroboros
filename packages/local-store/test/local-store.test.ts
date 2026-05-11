import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "../src/index";
import type {
  AarArtifactLineageRecord,
  AarArtifactProposalRecord,
  AarFindingRecord,
  AarOrchestrationRunRecord,
  BoundedRuntimeAuthorityInput,
  CandidateMaterializationInput,
  EvidenceClassificationRecord,
  EvaluationComparisonSetRecord,
  ExecutionAttemptRecord,
  EvaluationRunRecord,
  EvidenceSealingDecisionRecord,
  GatewayDecisionRecord,
  OrderIntentRecord,
  RunnableArtifactRecord,
  RuntimeAuditEventRecord,
  RuntimeControlAuditInput,
  RuntimeControlCommandRecord,
  RuntimeControlDecisionRecord,
  StageBindingRecord,
  TracePlaceholderRecord,
  TraderSystemRuntimeRecord
} from "@ouroboros/domain";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-store-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("LocalStore", () => {
  it("seeds fixture data idempotently", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const first = await readFile(
      path.join(tmpDir, "read-models/candidates/items", `${FIXTURE_CANDIDATE_ID}.json`),
      "utf8"
    );

    await store.initialize();
    const second = await readFile(
      path.join(tmpDir, "read-models/candidates/items", `${FIXTURE_CANDIDATE_ID}.json`),
      "utf8"
    );

    expect(second).toEqual(first);
  });

  it("rebuilds projections from authoritative item files", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const before = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
    await store.rebuildProjections();
    const after = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    expect(after).toEqual(before);
    expect(after?.fixture_notice.mode).toEqual("fixture_convenience_mode");
    expect(after?.evaluation.run.status).toEqual("created");
    expect(after?.evaluation.run.authority_status).toEqual("not_counted");
    expect(after?.evaluation.sealing_decision.authority_status).toEqual("not_counted");
  });

  it("seeds a durable stage binding for fixture evaluation records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const evaluationRun = await readStoreJson<EvaluationRunRecord>(
      "evaluation-runs",
      "items",
      "fixture-evaluation-run-001.json"
    );
    const stageBinding = await readStoreJson<StageBindingRecord>(
      "stage-bindings",
      "items",
      `${evaluationRun.stage_binding_ref.id}.json`
    );

    expect(stageBinding.record_kind).toBe("stage_binding");
    expect(stageBinding.candidate_ref.id).toBe(evaluationRun.candidate_ref.id);
    expect(stageBinding.candidate_version_ref.id).toBe(evaluationRun.candidate_version_ref.id);
    expect(stageBinding.stage).toBe("backtest");
    expect(stageBinding.authority_status).toBe("not_live");
  });

  it("lists candidate summaries from projections", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expect(store.listCandidates()).resolves.toMatchObject([
      {
        candidate_id: FIXTURE_CANDIDATE_ID,
        status: "fixture_only"
      }
    ]);
  });

  it("materializes a provider-shaped candidate and rebuilds it from authoritative item files", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await store.materializeCandidate(validMaterializationInput());

    expect(outcome.status).toBe("materialized");
    if (outcome.status !== "materialized") {
      throw new Error("expected materialized outcome");
    }
    expect(outcome.candidate.status).toBe("materialized");
    expect(outcome.candidate.display_name).toBe("BTC Perp Breakout Candidate");
    expect(outcome.candidate.materialization_attempt?.provider_kind).toBe("codex_cli");
    expect(outcome.candidate.materialization_attempt?.authority_label).toBe("provider_output_not_evidence");

    expect(outcome.candidate.evaluation.comparison_set.ref.id).not.toBe("fixture-evaluation-comparison-set-001");
    expect(outcome.candidate.evaluation.sealing_decision.ref.id).not.toBe("fixture-evidence-sealing-decision-001");

    await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
    await store.rebuildProjections();

    const reloaded = await store.getCandidate(outcome.candidate.candidate_id);
    expect(reloaded?.materialization_attempt?.attempt_id).toBe(outcome.attempt.attempt_id);
    expect(reloaded?.evaluation.run.status).toBe("created");
    expect(reloaded?.evaluation.run.authority_status).toBe("not_counted");
    expect(reloaded?.evaluation.sealing_decision.authority_status).toBe("not_counted");
    expect(reloaded?.evaluation.comparison_set.ref.id).toBe(outcome.candidate.evaluation.comparison_set.ref.id);
    expect(reloaded?.evaluation.sealing_decision.ref.id).toBe(outcome.candidate.evaluation.sealing_decision.ref.id);

    const evaluationRun = await readStoreJson<EvaluationRunRecord>(
      "evaluation-runs",
      "items",
      `${outcome.candidate.evaluation.run.ref.id}.json`
    );
    const stageBinding = await readStoreJson<StageBindingRecord>(
      "stage-bindings",
      "items",
      `${evaluationRun.stage_binding_ref.id}.json`
    );
    expect(stageBinding.candidate_ref.id).toBe(outcome.candidate.candidate_id);
    expect(stageBinding.candidate_version_ref.id).toBe(outcome.candidate.candidate_version.candidate_version_id);
    expect(stageBinding.execution_mode).toBe("host_local");
  });

  it("creates and reloads evaluation run records for an existing active candidate version", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id);
    const outcome = await store.createEvaluationRunForCandidate(input);
    const repeated = await store.createEvaluationRunForCandidate(input);

    expect(repeated).toEqual(outcome);
    expect(outcome.candidate_id).toBe(FIXTURE_CANDIDATE_ID);
    expect(outcome.candidate_version_id).toBe(candidate.candidate_version.candidate_version_id);
    expect(outcome.stage_binding).toMatchObject({
      record_kind: "stage_binding",
      stage: "backtest",
      profile: "backtest",
      execution_mode: "host_local",
      authority_status: "not_live"
    });
    expect(outcome.evaluation_run).toMatchObject({
      record_kind: "evaluation_run_record",
      status: "created",
      authority_status: "not_counted",
      trace_ref: input.trace_ref,
      evaluator_ref: input.evaluator_ref
    });
    expect(outcome.comparison_set.evaluation_run_refs).toEqual([
      { record_kind: "evaluation_run_record", id: outcome.evaluation_run.evaluation_run_record_id }
    ]);
    expect(outcome.sealing_decision).toMatchObject({
      evidence_disposition: "not_counted",
      authority_status: "not_counted",
      disposition_reason: "provider_output_trace_only"
    });
    expect(outcome.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification_kind: "trace_debug_material",
          classification_status: "trace_only",
          authority_status: "not_counted"
        }),
        expect.objectContaining({
          classification_kind: "candidate_evidence",
          classification_status: "candidate",
          authority_status: "not_counted"
        }),
        expect.objectContaining({
          classification_kind: "non_counted_evidence",
          classification_status: "not_counted",
          authority_status: "not_counted"
        }),
        expect.objectContaining({
          classification_kind: "sealed_decision",
          classification_status: "sealed",
          authority_status: "not_counted"
        })
      ])
    );

    const stageBinding = await readStoreJson<StageBindingRecord>(
      "stage-bindings",
      "items",
      `${outcome.stage_binding.stage_binding_id}.json`
    );
    const evaluationRun = await readStoreJson<EvaluationRunRecord>(
      "evaluation-runs",
      "items",
      `${outcome.evaluation_run.evaluation_run_record_id}.json`
    );
    const comparisonSet = await readStoreJson<EvaluationComparisonSetRecord>(
      "evaluation-comparison-sets",
      "items",
      `${outcome.comparison_set.evaluation_comparison_set_id}.json`
    );
    const sealingDecision = await readStoreJson<EvidenceSealingDecisionRecord>(
      "evidence-sealing-decisions",
      "items",
      `${outcome.sealing_decision.evidence_sealing_decision_id}.json`
    );
    const classification = await readStoreJson<EvidenceClassificationRecord>(
      "evidence-classifications",
      "items",
      `${outcome.evidence_classifications[0]?.evidence_classification_id}.json`
    );

    expect(stageBinding.stage_binding_id).not.toBe(evaluationRun.evaluation_run_record_id);
    expect(comparisonSet.evaluation_comparison_set_id).not.toBe(sealingDecision.evidence_sealing_decision_id);
    expect(classification.record_kind).toBe("evidence_classification");
    expect(evaluationRun.stage_binding_ref).toEqual({
      record_kind: "stage_binding",
      id: stageBinding.stage_binding_id
    });
    expect(sealingDecision.evaluation_comparison_set_ref).toEqual({
      record_kind: "evaluation_comparison_set",
      id: comparisonSet.evaluation_comparison_set_id
    });

    const reloadedStore = new LocalStore(tmpDir);
    const reloaded = await reloadedStore.getCandidateEvaluationRun(
      outcome.evaluation_run.evaluation_run_record_id
    );
    expect(reloaded).toEqual(outcome);

    const candidateRuns = await reloadedStore.listCandidateEvaluationRuns(FIXTURE_CANDIDATE_ID);
    expect(candidateRuns.map((run) => run.evaluation_run.evaluation_run_record_id)).toContain(
      outcome.evaluation_run.evaluation_run_record_id
    );
    expect(candidateRuns.every((run) => run.candidate_id === FIXTURE_CANDIDATE_ID)).toBe(true);
  });

  it("projects the latest stage-bound evaluation summary into candidate inspect", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-latest-summary",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-latest-summary" }
    });
    const outcome = await store.createEvaluationRunForCandidate(input);

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.has_runs).toBe(true);
    expect(projected?.evaluation.latest_run).toMatchObject({
      run_id: outcome.evaluation_run.evaluation_run_record_id,
      status: "created",
      stage: "backtest",
      profile: "backtest",
      execution_mode: "host_local",
      trace_ref: input.trace_ref,
      authority_status: "not_counted"
    });
    expect(projected?.evaluation.latest_comparison_set).toMatchObject({
      comparison_set_id: outcome.comparison_set.evaluation_comparison_set_id,
      comparability_status: "not_evaluated",
      comparability_reason: "provider_output_trace_only",
      authority_status: "not_counted"
    });
    expect(projected?.evaluation.latest_sealing_decision).toMatchObject({
      sealing_decision_id: outcome.sealing_decision.evidence_sealing_decision_id,
      evidence_disposition: "not_counted",
      disposition_reason: "provider_output_trace_only",
      authority_status: "not_counted"
    });
    expect(projected?.evaluation.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification_kind: "trace_debug_material",
          classification_reason: "provider_output_trace_only"
        }),
        expect.objectContaining({
          classification_kind: "non_counted_evidence",
          classification_status: "not_counted"
        })
      ])
    );
    expect(projected?.evaluation.run.ref.id).toBe(outcome.evaluation_run.evaluation_run_record_id);

    const evaluationReadModel = await readStoreJson(
      "read-models",
      "candidate-evaluations",
      "items",
      `${FIXTURE_CANDIDATE_ID}.json`
    );
    expect(evaluationReadModel).toMatchObject({
      has_runs: true,
      latest_run: {
        run_id: outcome.evaluation_run.evaluation_run_record_id,
        stage: "backtest"
      }
    });
  });

  it("selects latest evaluation run by creation recency, not completion time", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const olderOutcome = await store.createEvaluationRunForCandidate(
      validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
        idempotency_key: "evaluation-run-older-completes-late"
      })
    );
    const newerOutcome = await store.createEvaluationRunForCandidate(
      validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
        idempotency_key: "evaluation-run-newer-created-latest"
      })
    );

    await writeStoreJson(
      {
        ...olderOutcome.evaluation_run,
        created_at: "2026-05-07T00:00:00.000Z",
        completed_at: "2026-05-09T00:00:00.000Z"
      } satisfies EvaluationRunRecord,
      "evaluation-runs",
      "items",
      `${olderOutcome.evaluation_run.evaluation_run_record_id}.json`
    );
    await writeStoreJson(
      {
        ...newerOutcome.evaluation_run,
        created_at: "2026-05-08T00:00:00.000Z"
      } satisfies EvaluationRunRecord,
      "evaluation-runs",
      "items",
      `${newerOutcome.evaluation_run.evaluation_run_record_id}.json`
    );

    await store.rebuildProjections();

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.latest_run).toMatchObject({
      run_id: newerOutcome.evaluation_run.evaluation_run_record_id,
      created_at: "2026-05-08T00:00:00.000Z"
    });
  });

  it("keeps trace/debug material distinct from counted evidence in candidate inspect", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-trace-evidence-split",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-trace-evidence-split" }
    });
    await store.createEvaluationRunForCandidate(input);

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.trace).toMatchObject({
      state: "linked",
      trace_ref: input.trace_ref,
      authority_label: "provider_output_not_evidence",
      authority_status: "not_counted",
      provider_output_artifact_refs: input.provider_output_artifact_refs,
      debug_artifact_refs: input.debug_artifact_refs
    });
    expect(projected?.evaluation.counted_evidence).toMatchObject({
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "provider_output_trace_only",
      authority_status: "not_counted"
    });
    expect(projected?.evaluation.counted_evidence).not.toHaveProperty("provider_output_artifact_refs");
    expect(projected?.evaluation.counted_evidence).not.toHaveProperty("debug_artifact_refs");
    expect(projected?.evaluation.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classified_ref: input.trace_ref,
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

  it("seals counted fixture evidence only through an explicit deterministic decision", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-explicit-counted-fixture",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-explicit-counted-fixture" }
    });
    const outcome = await store.createEvaluationRunForCandidate(input);
    const countedEvidenceRef = { record_kind: "fixture_evidence", id: "sealed-backtest-summary-001" };

    const sealed = await store.sealEvaluationRunEvidence({
      idempotency_key: "seal-counted-fixture",
      evaluation_run_record_id: outcome.evaluation_run.evaluation_run_record_id,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      classified_refs: [countedEvidenceRef],
      sealed_at: "2026-05-08T00:00:00.000Z"
    });
    const repeated = await store.sealEvaluationRunEvidence({
      idempotency_key: "seal-counted-fixture",
      evaluation_run_record_id: outcome.evaluation_run.evaluation_run_record_id,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      classified_refs: [countedEvidenceRef],
      sealed_at: "2026-05-08T00:00:00.000Z"
    });

    expect(repeated).toEqual(sealed);
    expect(sealed.sealing_decision).toMatchObject({
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      sealed_at: "2026-05-08T00:00:00.000Z",
      authority_status: "counted"
    });
    expect(sealed.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classified_ref: countedEvidenceRef,
          classification_kind: "counted_evidence",
          classification_status: "counted",
          classification_reason: "sealed_counted_fixture_only_allowed_by_test",
          sealed_by_decision_ref: {
            record_kind: "evidence_sealing_decision",
            id: sealed.sealing_decision.evidence_sealing_decision_id
          },
          authority_status: "counted"
        }),
        expect.objectContaining({
          classification_kind: "sealed_decision",
          classification_status: "sealed",
          authority_status: "counted"
        })
      ])
    );

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.latest_sealing_decision).toMatchObject({
      sealing_decision_id: sealed.sealing_decision.evidence_sealing_decision_id,
      evidence_disposition: "counted",
      authority_status: "counted"
    });
    expect(projected?.evaluation.counted_evidence).toMatchObject({
      counted: true,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      authority_status: "counted",
      sealed_at: "2026-05-08T00:00:00.000Z"
    });
  });

  it("records rejected evidence without counting provider output", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-explicit-rejected-provider-output",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-explicit-rejected-provider-output" }
    });
    const outcome = await store.createEvaluationRunForCandidate(input);

    const sealed = await store.sealEvaluationRunEvidence({
      idempotency_key: "seal-rejected-provider-output",
      evaluation_run_record_id: outcome.evaluation_run.evaluation_run_record_id,
      evidence_disposition: "quarantined_for_review",
      disposition_reason: "method_not_authoritative",
      classified_refs: input.provider_output_artifact_refs,
      sealed_at: "2026-05-08T01:00:00.000Z"
    });

    expect(sealed.sealing_decision).toMatchObject({
      evidence_disposition: "quarantined_for_review",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    });
    expect(sealed.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classified_ref: input.provider_output_artifact_refs[0],
          classification_kind: "rejected_evidence",
          classification_status: "rejected",
          classification_reason: "method_not_authoritative",
          authority_status: "not_counted"
        })
      ])
    );

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.counted_evidence).toMatchObject({
      counted: false,
      evidence_disposition: "quarantined_for_review",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    });
  });

  it("projects a deterministic no-evaluation state when durable evaluation records are absent", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await rm(path.join(tmpDir, "evaluation-runs", "items"), { recursive: true, force: true });
    await rm(path.join(tmpDir, "evaluation-comparison-sets", "items"), { recursive: true, force: true });
    await rm(path.join(tmpDir, "evidence-sealing-decisions", "items"), { recursive: true, force: true });

    await store.rebuildProjections();

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation).toMatchObject({
      has_runs: false,
      latest_run: null,
      latest_comparison_set: null,
      latest_sealing_decision: null,
      trace: {
        state: "none",
        provider_output_artifact_refs: [],
        debug_artifact_refs: [],
        authority_status: "not_counted"
      },
      evidence_classifications: [],
      counted_evidence: {
        counted: false,
        evidence_disposition: "not_counted",
        disposition_reason: "no_evaluation_runs",
        authority_status: "not_counted"
      },
      run: {
        status: "not_evaluated",
        authority_status: "not_counted"
      }
    });
  });

  it("projects failed evaluation runs with a deterministic error state", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-failed-projection",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-failed-projection" }
    });
    const outcome = await store.createEvaluationRunForCandidate(input);
    await writeStoreJson(
      {
        ...outcome.evaluation_run,
        status: "failed",
        completed_at: "2026-05-07T00:00:00.000Z"
      } satisfies EvaluationRunRecord,
      "evaluation-runs",
      "items",
      `${outcome.evaluation_run.evaluation_run_record_id}.json`
    );

    await store.rebuildProjections();

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.latest_run).toMatchObject({
      run_id: outcome.evaluation_run.evaluation_run_record_id,
      status: "failed",
      stage: "backtest",
      error_state: {
        code: "evaluation_failed",
        message: "evaluation run failed"
      }
    });
    expect(projected?.evaluation.counted_evidence).toMatchObject({
      counted: false,
      evidence_disposition: "not_counted",
      authority_status: "not_counted"
    });
  });

  it("records, deduplicates, and projects bounded runtime authority records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validBoundedRuntimeAuthorityInput(candidate.candidate_version.candidate_version_id);
    const first = await store.recordBoundedRuntimeAuthority(input);
    const second = await store.recordBoundedRuntimeAuthority(input);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      runtime_id: candidate.runtime.ref.id,
      order_intent: {
        record_kind: "order_intent",
        status: "proposed",
        authority_status: "not_submitted"
      },
      gateway_decision: {
        record_kind: "gateway_decision",
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only",
        authority_status: "dry_run_only"
      },
      execution_attempt: {
        record_kind: "execution_attempt",
        status: "dry_run_recorded",
        authority_status: "dry_run_only"
      }
    });
    expect(first.gateway_decision.order_intent_ref).toEqual({
      record_kind: "order_intent",
      id: first.order_intent.order_intent_id
    });
    expect(first.execution_attempt.gateway_decision_ref).toEqual({
      record_kind: "gateway_decision",
      id: first.gateway_decision.gateway_decision_id
    });

    const orderIntent = await readStoreJson<OrderIntentRecord>(
      "order-intents",
      "items",
      `${first.order_intent.order_intent_id}.json`
    );
    const gatewayDecision = await readStoreJson<GatewayDecisionRecord>(
      "gateway-decisions",
      "items",
      `${first.gateway_decision.gateway_decision_id}.json`
    );
    const executionAttempt = await readStoreJson<ExecutionAttemptRecord>(
      "execution-attempts",
      "items",
      `${first.execution_attempt.execution_attempt_id}.json`
    );
    const stageBinding = await readStoreJson<StageBindingRecord>(
      "stage-bindings",
      "items",
      `${first.order_intent.stage_binding_ref.id}.json`
    );
    expect(orderIntent.runtime_ref.id).toBe(candidate.runtime.ref.id);
    expect(stageBinding).toMatchObject({
      stage: "paper",
      profile: "paper",
      execution_mode: "host_local",
      candidate_ref: { id: FIXTURE_CANDIDATE_ID },
      candidate_version_ref: { id: candidate.candidate_version.candidate_version_id }
    });
    expect(gatewayDecision.order_intent_ref.id).toBe(orderIntent.order_intent_id);
    expect(executionAttempt.gateway_decision_ref.id).toBe(gatewayDecision.gateway_decision_id);
    await expect(countJsonFiles("stage-bindings", "items")).resolves.toBe(2);
    await expect(countJsonFiles("order-intents", "items")).resolves.toBe(1);
    await expect(countJsonFiles("gateway-decisions", "items")).resolves.toBe(1);
    await expect(countJsonFiles("execution-attempts", "items")).resolves.toBe(1);

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.runtime.bounded_authority).toMatchObject({
      has_activity: true,
      chain_complete: true,
      latest_order_intent: {
        order_intent_id: first.order_intent.order_intent_id,
        status: "proposed",
        authority_status: "not_submitted"
      },
      latest_gateway_decision: {
        gateway_decision_id: first.gateway_decision.gateway_decision_id,
        decision_outcome: "dry_run_only",
        authority_status: "dry_run_only"
      },
      latest_execution_attempt: {
        execution_attempt_id: first.execution_attempt.execution_attempt_id,
        status: "dry_run_recorded",
        authority_status: "dry_run_only"
      }
    });

    await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
    await store.rebuildProjections();

    const reloaded = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(reloaded?.runtime.bounded_authority?.latest_execution_attempt?.execution_attempt_id).toBe(
      first.execution_attempt.execution_attempt_id
    );
    expect(reloaded?.runtime.bounded_authority?.chain_complete).toBe(true);
  });

  it("rejects invalid bounded runtime authority commands without creating records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.recordBoundedRuntimeAuthority({
        ...validBoundedRuntimeAuthorityInput("fixture-candidate-version-001"),
        candidate_id: ""
      }),
      "invalid_runtime_authority_input"
    );
    await expectStoreError(
      store.recordBoundedRuntimeAuthority({
        ...validBoundedRuntimeAuthorityInput("missing-version"),
        candidate_version_id: "missing-version"
      }),
      "candidate_version_not_found"
    );
    await writeStoreJson(
      {
        record_kind: "trader_system_runtime",
        version: 1,
        trader_system_runtime_id: "foreign-runtime-001",
        stage_binding_profile: "paper",
        placement_ref: { record_kind: "runtime_placement", id: "fixture-runtime-placement-001" },
        hands_environment_ref: { record_kind: "hands_environment", id: "fixture-hands-environment-001" },
        memory_surface_ref: { record_kind: "runtime_memory_surface", id: "fixture-runtime-memory-surface-001" },
        authority_status: "not_live"
      } satisfies TraderSystemRuntimeRecord,
      "trader-system-runtimes",
      "items",
      "foreign-runtime-001.json"
    );
    await expectStoreError(
      store.recordBoundedRuntimeAuthority({
        ...validBoundedRuntimeAuthorityInput("fixture-candidate-version-001"),
        runtime_id: "foreign-runtime-001"
      }),
      "runtime_mismatch"
    );
    await expect(countJsonFiles("order-intents", "items")).resolves.toBe(0);
    await expect(countJsonFiles("gateway-decisions", "items")).resolves.toBe(0);
    await expect(countJsonFiles("execution-attempts", "items")).resolves.toBe(0);
  });

  it("records, deduplicates, and projects runtime control audit records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validRuntimeControlAuditInput(candidate.candidate_version.candidate_version_id);
    const first = await store.recordRuntimeControlAudit(input);
    const second = await store.recordRuntimeControlAudit(input);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      runtime_id: candidate.runtime.ref.id,
      command: {
        record_kind: "runtime_control_command",
        action: "pause",
        status: "decided",
        authority_status: "control_only"
      },
      decision: {
        record_kind: "runtime_control_decision",
        decision_outcome: "allowed",
        decision_reason: "policy_allows_control",
        resulting_lifecycle_status: "paused",
        authority_status: "control_only"
      },
      audit_event: {
        record_kind: "runtime_audit_event",
        event_kind: "runtime_lifecycle_transitioned",
        runtime_lifecycle_status: "paused",
        authority_status: "audit_only"
      }
    });

    const command = await readStoreJson<RuntimeControlCommandRecord>(
      "runtime-control-commands",
      "items",
      `${first.command.runtime_control_command_id}.json`
    );
    const decision = await readStoreJson<RuntimeControlDecisionRecord>(
      "runtime-control-decisions",
      "items",
      `${first.decision.runtime_control_decision_id}.json`
    );
    const auditEvent = await readStoreJson<RuntimeAuditEventRecord>(
      "runtime-audit-events",
      "items",
      `${first.audit_event.runtime_audit_event_id}.json`
    );
    const runtime = await readStoreJson<TraderSystemRuntimeRecord>(
      "trader-system-runtimes",
      "items",
      `${candidate.runtime.ref.id}.json`
    );

    expect(command.runtime_ref).toEqual(candidate.runtime.ref);
    expect(command.runtime_ref.id).not.toBe(candidate.runtime.placement.ref.id);
    expect(decision.command_ref).toEqual({
      record_kind: "runtime_control_command",
      id: command.runtime_control_command_id
    });
    expect(auditEvent.supporting_record_refs).toEqual([
      { record_kind: "runtime_control_command", id: command.runtime_control_command_id },
      { record_kind: "runtime_control_decision", id: decision.runtime_control_decision_id }
    ]);
    expect(runtime.runtime_lifecycle_status).toBe("paused");
    expect(runtime.runtime_control_command_refs).toEqual([
      { record_kind: "runtime_control_command", id: command.runtime_control_command_id }
    ]);
    expect(runtime.runtime_control_decision_refs).toEqual([
      { record_kind: "runtime_control_decision", id: decision.runtime_control_decision_id }
    ]);
    expect(runtime.runtime_audit_event_refs).toEqual([
      { record_kind: "runtime_audit_event", id: auditEvent.runtime_audit_event_id }
    ]);
    await expect(countJsonFiles("runtime-control-commands", "items")).resolves.toBe(1);
    await expect(countJsonFiles("runtime-control-decisions", "items")).resolves.toBe(1);
    await expect(countJsonFiles("runtime-audit-events", "items")).resolves.toBe(1);

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.runtime.runtime_control).toMatchObject({
      has_activity: true,
      chain_complete: true,
      latest_command: {
        command_id: command.runtime_control_command_id,
        action: "pause",
        status: "decided",
        authority_status: "control_only"
      },
      latest_decision: {
        decision_id: decision.runtime_control_decision_id,
        decision_outcome: "allowed",
        resulting_lifecycle_status: "paused",
        authority_status: "control_only"
      },
      latest_audit_event: {
        audit_event_id: auditEvent.runtime_audit_event_id,
        event_kind: "runtime_lifecycle_transitioned",
        runtime_lifecycle_status: "paused",
        authority_status: "audit_only"
      }
    });
    expect(projected?.runtime.placement.authority_status).toBe("not_launched");
    expect(JSON.stringify(projected?.runtime.runtime_control)).not.toMatch(
      /exchange_credentials|provider_api_key|direct_exchange_order|gateway_signing_material/
    );

    await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
    await store.rebuildProjections();

    const reloaded = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(reloaded?.runtime.runtime_control?.latest_command?.command_id).toBe(
      command.runtime_control_command_id
    );
    expect(reloaded?.runtime.runtime_control?.chain_complete).toBe(true);
  });

  it("rejects invalid runtime control audit commands without creating records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.recordRuntimeControlAudit({
        ...validRuntimeControlAuditInput("fixture-candidate-version-001"),
        idempotency_key: ""
      }),
      "invalid_runtime_control_input"
    );
    await expectStoreError(
      store.recordRuntimeControlAudit({
        ...validRuntimeControlAuditInput("fixture-candidate-version-001"),
        candidate_id: "missing-candidate"
      }),
      "candidate_not_found"
    );
    await expectStoreError(
      store.recordRuntimeControlAudit({
        ...validRuntimeControlAuditInput("missing-version"),
        candidate_version_id: "missing-version"
      }),
      "candidate_version_not_found"
    );
    await expectStoreError(
      store.recordRuntimeControlAudit({
        ...validRuntimeControlAuditInput("fixture-candidate-version-001"),
        runtime_id: "missing-runtime"
      }),
      "runtime_not_found"
    );
    await writeStoreJson(
      {
        record_kind: "trader_system_runtime",
        version: 1,
        trader_system_runtime_id: "foreign-runtime-001",
        stage_binding_profile: "paper",
        placement_ref: { record_kind: "runtime_placement", id: "fixture-runtime-placement-001" },
        hands_environment_ref: { record_kind: "hands_environment", id: "fixture-hands-environment-001" },
        memory_surface_ref: { record_kind: "runtime_memory_surface", id: "fixture-runtime-memory-surface-001" },
        authority_status: "not_live"
      } satisfies TraderSystemRuntimeRecord,
      "trader-system-runtimes",
      "items",
      "foreign-runtime-001.json"
    );
    await expectStoreError(
      store.recordRuntimeControlAudit({
        ...validRuntimeControlAuditInput("fixture-candidate-version-001"),
        runtime_id: "foreign-runtime-001"
      }),
      "runtime_mismatch"
    );
    await expectStoreError(
      store.recordRuntimeControlAudit({
        ...validRuntimeControlAuditInput("fixture-candidate-version-001"),
        command: {
          ...validRuntimeControlAuditInput("fixture-candidate-version-001").command,
          action: "launch_live" as "pause"
        }
      }),
      "invalid_runtime_control_input"
    );
    await expect(countJsonFiles("runtime-control-commands", "items")).resolves.toBe(0);
    await expect(countJsonFiles("runtime-control-decisions", "items")).resolves.toBe(0);
    await expect(countJsonFiles("runtime-audit-events", "items")).resolves.toBe(0);
  });

  it("records and reloads AAR findings as research trace only", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const finding = validAarFindingRecord();

    const recorded = await store.recordAarFinding(finding);
    const repeated = await store.recordAarFinding(finding);

    expect(repeated).toEqual(recorded);
    expect(recorded).toMatchObject({
      record_kind: "aar_finding",
      finding_kind: "positive_result",
      authority_status: "research_trace_only"
    });
    await expect(store.listAarFindingsForExperiment("aar-experiment-btc-breakout-001")).resolves.toEqual([
      finding
    ]);
    await expect(store.listAarFindingsForExperiment("aar-experiment-other")).resolves.toEqual([]);

    const persisted = await readStoreJson<AarFindingRecord>(
      "aar-findings",
      "items",
      `${finding.aar_finding_id}.json`
    );
    expect(persisted).toEqual(finding);
    expect(JSON.stringify(persisted)).not.toMatch(/promotion_decision_ref|live_order_authority|exchange_credentials/);

    const reloadedStore = new LocalStore(tmpDir);
    await expect(reloadedStore.listAarFindings()).resolves.toEqual([finding]);
  });

  it("records AAR artifact lineage linked to stored findings", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const finding = validAarFindingRecord();
    const lineage = validAarArtifactLineageRecord();

    await store.recordAarFinding(finding);
    const recorded = await store.recordAarArtifactLineage(lineage);
    const repeated = await store.recordAarArtifactLineage(lineage);

    expect(repeated).toEqual(recorded);
    expect(recorded).toMatchObject({
      record_kind: "aar_artifact_lineage",
      child_runnable_artifact_ref: {
        record_kind: "runnable_artifact",
        id: "runnable-artifact-btc-breakout-v2"
      },
      parent_runnable_artifact_ref: {
        record_kind: "runnable_artifact",
        id: "runnable-artifact-btc-breakout-v1"
      },
      source_finding_refs: [
        { record_kind: "aar_finding", id: finding.aar_finding_id }
      ],
      authority_status: "lineage_only"
    });
    await expect(store.listAarArtifactLineagesForArtifact("runnable-artifact-btc-breakout-v2"))
      .resolves.toEqual([lineage]);
    await expect(store.listAarArtifactLineagesForArtifact("runnable-artifact-btc-breakout-v1"))
      .resolves.toEqual([lineage]);

    const persisted = await readStoreJson<AarArtifactLineageRecord>(
      "aar-artifact-lineages",
      "items",
      `${lineage.aar_artifact_lineage_id}.json`
    );
    expect(persisted).toEqual(lineage);
    expect(JSON.stringify(persisted)).not.toMatch(/strategy_internals|live_order_authority|exchange_credentials/);
  });

  it("rejects invalid AAR finding and lineage records without creating records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.recordAarFinding({
        ...validAarFindingRecord(),
        authority_status: "counted" as "research_trace_only"
      }),
      "invalid_aar_finding_input"
    );
    await expectStoreError(
      store.recordAarArtifactLineage({
        ...validAarArtifactLineageRecord(),
        source_finding_refs: [{ record_kind: "aar_finding", id: "missing-aar-finding" }]
      }),
      "aar_finding_not_found"
    );
    await expectStoreError(
      store.recordAarArtifactLineage({
        ...validAarArtifactLineageRecord(),
        child_runnable_artifact_ref: {
          record_kind: "provider_output_artifact",
          id: "not-runnable"
        }
      } as unknown as AarArtifactLineageRecord),
      "invalid_aar_artifact_lineage_input"
    );
    await expect(countJsonFiles("aar-findings", "items")).resolves.toBe(0);
    await expect(countJsonFiles("aar-artifact-lineages", "items")).resolves.toBe(0);
  });

  it("records AAR proposals, proposed runnable artifacts, and orchestration runs", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const finding = validAarFindingRecord();
    const lineage = validAarArtifactLineageRecord();
    const proposal = validAarArtifactProposalRecord();
    const artifact = validProposedRunnableArtifactRecord();
    const run = validAarOrchestrationRunRecord();

    await store.recordAarFinding(finding);
    await store.recordAarArtifactLineage(lineage);
    await store.recordAarArtifactProposal(proposal);
    await store.recordRunnableArtifact(artifact);
    await store.recordAarOrchestrationRun(run);

    await expect(store.getRunnableArtifact(artifact.runnable_artifact_id)).resolves.toEqual(artifact);
    await expect(store.listAarArtifactProposals()).resolves.toEqual([proposal]);
    await expect(store.listAarArtifactProposalsForFinding(finding.aar_finding_id)).resolves.toEqual([
      proposal
    ]);
    await expect(store.listAarOrchestrationRuns()).resolves.toEqual([run]);

    const persistedProposal = await readStoreJson<AarArtifactProposalRecord>(
      "aar-artifact-proposals",
      "items",
      `${proposal.aar_artifact_proposal_id}.json`
    );
    const persistedRun = await readStoreJson<AarOrchestrationRunRecord>(
      "aar-orchestration-runs",
      "items",
      `${run.aar_orchestration_run_id}.json`
    );
    const persistedArtifact = await readStoreJson<RunnableArtifactRecord>(
      "runnable-artifacts",
      "items",
      `${artifact.runnable_artifact_id}.json`
    );
    expect(persistedProposal.authority_status).toBe("proposal_only");
    expect(persistedRun.authority_status).toBe("research_only");
    expect(persistedArtifact.authority_status).toBe("not_live");
    expect(JSON.stringify({ persistedProposal, persistedRun, persistedArtifact })).not.toMatch(
      /strategy_internals|binance_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/
    );
  });

  it("rejects invalid AAR proposal and orchestration inputs without creating records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.recordAarArtifactProposal(validAarArtifactProposalRecord()),
      "aar_finding_not_found"
    );

    const finding = validAarFindingRecord();
    await store.recordAarFinding(finding);
    await expectStoreError(
      store.recordAarArtifactProposal({
        ...validAarArtifactProposalRecord(),
        authority_status: "counted" as "proposal_only"
      }),
      "invalid_aar_artifact_proposal_input"
    );
    await store.recordAarArtifactProposal(validAarArtifactProposalRecord());
    await expectStoreError(
      store.recordAarOrchestrationRun({
        ...validAarOrchestrationRunRecord(),
        output_artifact_proposal_ref: {
          record_kind: "aar_artifact_proposal",
          id: "missing-proposal"
        }
      }),
      "aar_artifact_proposal_not_found"
    );
    await expectStoreError(
      store.recordAarOrchestrationRun({
        ...validAarOrchestrationRunRecord(),
        authority_status: "counted" as "research_only"
      }),
      "invalid_aar_orchestration_run_input"
    );
    await expect(countJsonFiles("aar-orchestration-runs", "items")).resolves.toBe(0);
  });

  it("keeps evaluation provider output as trace material until explicitly sealed", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id);
    const outcome = await store.createEvaluationRunForCandidate(input);
    const trace = await readStoreJson<TracePlaceholderRecord>(
      "traces",
      "placeholders",
      `${outcome.trace.trace_id}.json`
    );
    const sealingDecision = await readStoreJson<Record<string, unknown>>(
      "evidence-sealing-decisions",
      "items",
      `${outcome.sealing_decision.evidence_sealing_decision_id}.json`
    );

    expect(trace.record_kind).toBe("trace_placeholder");
    expect(trace.provider_output_artifact_refs).toEqual(input.provider_output_artifact_refs);
    expect(trace.debug_artifact_refs).toEqual(input.debug_artifact_refs);
    expect(trace.authority_status).toBe("not_counted");
    expect(sealingDecision).not.toHaveProperty("provider_output_artifact_refs");
    expect(sealingDecision).not.toHaveProperty("artifact_refs");
    expect(sealingDecision).toMatchObject({
      evidence_disposition: "not_counted",
      authority_status: "not_counted"
    });
  });

  it("returns deterministic store errors for invalid evaluation run commands", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.createEvaluationRunForCandidate({
        ...validEvaluationRunInput("missing-version"),
        candidate_version_id: "missing-version"
      }),
      "candidate_version_not_found"
    );
    await expectStoreError(
      store.createEvaluationRunForCandidate({
        ...validEvaluationRunInput("fixture-candidate-version-001"),
        candidate_id: "missing-candidate"
      }),
      "candidate_not_found"
    );
    await expectStoreError(
      store.createEvaluationRunForCandidate({
        ...validEvaluationRunInput("fixture-candidate-version-001"),
        stage: "live" as "backtest"
      }),
      "unsupported_evaluation_stage"
    );
    await expectStoreError(
      store.sealEvaluationRunEvidence({
        idempotency_key: "missing-evaluation-run-seal",
        evaluation_run_record_id: "missing-evaluation-run",
        evidence_disposition: "not_counted",
        disposition_reason: "non_comparable"
      }),
      "evaluation_run_not_found"
    );
    await expectStoreError(
      store.sealEvaluationRunEvidence({
        idempotency_key: "invalid-counted-reason",
        evaluation_run_record_id: "fixture-evaluation-run-001",
        evidence_disposition: "counted",
        disposition_reason: "method_not_authoritative",
        classified_refs: [{ record_kind: "fixture_evidence", id: "bad-counted-reason" }]
      }),
      "invalid_evidence_sealing_input"
    );
  });

  it("keeps schema-invalid materialization attempts without creating a candidate", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const before = await store.listCandidates();

    const invalidInput = {
      ...validMaterializationInput(),
      idempotency_key: "codex-run-invalid-schema",
      candidate: {
        title: "",
        system_summary: "",
        first_market_scope: "binance_btc_perpetual_futures"
      }
    } as CandidateMaterializationInput;

    const outcome = await store.materializeCandidate(invalidInput);
    const after = await store.listCandidates();
    const attempts = await store.listCandidateMaterializationAttempts();

    expect(outcome).toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "schema_invalid",
        validation_status: "rejected"
      }
    });
    expect(after).toEqual(before);
    expect(attempts.some((attempt) => attempt.idempotency_key === "codex-run-invalid-schema")).toBe(true);

    const missingTitleInput = {
      ...validMaterializationInput(),
      idempotency_key: "codex-run-missing-title",
      candidate: {
        system_summary: "Missing title should be rejected instead of throwing.",
        first_market_scope: "binance_btc_perpetual_futures"
      }
    } as unknown as CandidateMaterializationInput;
    await expect(store.materializeCandidate(missingTitleInput)).resolves.toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "schema_invalid",
        validation_status: "rejected"
      }
    });
  });

  it("keeps provider failures without creating a candidate", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const before = await store.listCandidates();

    const outcome = await store.recordCandidateMaterializationFailure({
      idempotency_key: "codex-run-provider-failed",
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      agent_run_id: "agent-run-provider-failed",
      trace_id: "trace-provider-failed",
      failure_reason: "provider_failed",
      artifact_refs: []
    });

    expect(outcome).toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "provider_failed",
        authority_label: "provider_output_not_evidence"
      }
    });
    await expect(store.listCandidates()).resolves.toEqual(before);
  });

  it("deduplicates materialization by idempotency key", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await store.materializeCandidate(validMaterializationInput());
    const second = await store.materializeCandidate(validMaterializationInput());
    const candidates = await store.listCandidates();

    expect(first.status).toBe("materialized");
    expect(second.status).toBe("materialized");
    if (first.status !== "materialized" || second.status !== "materialized") {
      throw new Error("expected materialized outcomes");
    }
    expect(second.candidate.candidate_id).toBe(first.candidate.candidate_id);
    expect(second.attempt.attempt_id).toBe(first.attempt.attempt_id);
    expect(candidates.filter((candidate) => candidate.status === "materialized")).toHaveLength(1);
  });
});

function validMaterializationInput(): CandidateMaterializationInput {
  return {
    idempotency_key: "codex-run-success-output-hash-001",
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema",
      agent_run_id: "agent-run-codex-success-001",
      agent_event_id: "agent-event-codex-success-001",
      trace_id: "trace-codex-success-001",
      output_artifact_hash: "sha256:success-output-001"
    },
    candidate: {
      title: "BTC Perp Breakout Candidate",
      system_summary: "Agent-generated BTC perpetual futures breakout trader-system candidate.",
      first_market_scope: "binance_btc_perpetual_futures"
    },
    spec: {
      summary: "Trade BTC perpetual futures using volatility breakouts and strict risk caps.",
      market: "Binance",
      instrument: "BTC perpetual futures",
      supported_stage_binding_profiles: ["backtest", "paper", "live"]
    },
    program: {
      summary: "Generated behavior bundle that emits order intents only after validation.",
      declared_runtime: "python-sandbox-placeholder",
      declared_outputs: ["OrderIntent", "ProgramEvent", "Trace"]
    },
    capability_package: {
      summary: "BTC perpetual market context and indicator package request.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_market_bars", "read_position_state"],
      forbidden_contents: ["exchange_credentials", "evaluator_hidden_labels", "live_order_authority"]
    },
    artifact_refs: [{ record_kind: "provider_output_artifact", id: "codex-output-success-001" }]
  };
}

function validEvaluationRunInput(
  candidateVersionId: string,
  overrides: Partial<ReturnType<typeof baseEvaluationRunInput>> = {}
) {
  return {
    ...baseEvaluationRunInput(candidateVersionId),
    ...overrides
  };
}

function baseEvaluationRunInput(candidateVersionId: string) {
  return {
    idempotency_key: "evaluation-run-fixture-backtest-output-hash-001",
    candidate_id: FIXTURE_CANDIDATE_ID,
    candidate_version_id: candidateVersionId,
    stage: "backtest" as const,
    execution_mode: "host_local" as const,
    trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-fixture-backtest-001" },
    evaluator_ref: { record_kind: "evaluation_provider", id: "deterministic-backtest-fixture" },
    provider_output_artifact_refs: [
      { record_kind: "provider_output_artifact", id: "evaluation-provider-output-001" }
    ],
    debug_artifact_refs: [
      { record_kind: "debug_artifact", id: "evaluation-debug-output-001" }
    ]
  };
}

function validBoundedRuntimeAuthorityInput(candidateVersionId: string): BoundedRuntimeAuthorityInput {
  return {
    idempotency_key: "runtime-authority-dry-run-001",
    candidate_id: FIXTURE_CANDIDATE_ID,
    candidate_version_id: candidateVersionId,
    intent: {
      intent_kind: "place_order",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000"
    },
    gateway_decision: {
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      policy_ref: { record_kind: "runtime_operating_policy", id: "runtime-operating-policy-paper-v1" }
    },
    execution_attempt: {
      execution_mode: "host_local",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-runtime-authority-dry-run-001" },
      completed_at: "2026-05-10T00:01:00.000Z"
    },
    created_at: "2026-05-10T00:00:00.000Z"
  };
}

function validRuntimeControlAuditInput(candidateVersionId: string): RuntimeControlAuditInput {
  return {
    idempotency_key: "runtime-control-pause-001",
    candidate_id: FIXTURE_CANDIDATE_ID,
    candidate_version_id: candidateVersionId,
    command: {
      action: "pause",
      requested_lifecycle_status: "paused",
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-sjson" },
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      },
      reason: "operator_request",
      reason_summary: "Pause paper runtime for operator review.",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-runtime-control-pause-001" }
    },
    decision: {
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      decided_by_actor_ref: {
        record_kind: "runtime_policy_engine",
        id: "runtime-policy-engine-fixture"
      },
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      },
      resulting_lifecycle_status: "paused"
    },
    audit_event: {
      event_kind: "runtime_lifecycle_transitioned",
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-sjson" },
      runtime_lifecycle_status: "paused",
      message: "Paper runtime paused through runtime-control audit chain."
    },
    created_at: "2026-05-10T00:10:00.000Z"
  };
}

function validAarFindingRecord(): AarFindingRecord {
  return {
    record_kind: "aar_finding",
    version: 1,
    aar_finding_id: "aar-finding-btc-breakout-oos-001",
    researcher_ref: { record_kind: "aar_researcher", id: "aar-researcher-breakout-001" },
    research_direction_ref: {
      record_kind: "aar_research_direction",
      id: "aar-research-direction-breakout-001"
    },
    aar_experiment_ref: { record_kind: "aar_experiment", id: "aar-experiment-btc-breakout-001" },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: "trading-evaluation-result-btc-breakout-001"
    },
    finding_kind: "positive_result",
    summary: "Breakout artifact improved held-out BTC perp score after fees without gaining authority.",
    supporting_record_refs: [
      { record_kind: "trading_evaluation_result", id: "trading-evaluation-result-btc-breakout-001" },
      { record_kind: "metric_snapshot", id: "metric-btc-breakout-oos-001" }
    ],
    created_at: "2026-05-11T00:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function validAarArtifactLineageRecord(): AarArtifactLineageRecord {
  return {
    record_kind: "aar_artifact_lineage",
    version: 1,
    aar_artifact_lineage_id: "aar-artifact-lineage-btc-breakout-v2",
    child_runnable_artifact_ref: {
      record_kind: "runnable_artifact",
      id: "runnable-artifact-btc-breakout-v2"
    },
    parent_runnable_artifact_ref: {
      record_kind: "runnable_artifact",
      id: "runnable-artifact-btc-breakout-v1"
    },
    source_finding_refs: [
      { record_kind: "aar_finding", id: "aar-finding-btc-breakout-oos-001" }
    ],
    created_by_researcher_ref: { record_kind: "aar_researcher", id: "aar-researcher-breakout-001" },
    created_at: "2026-05-11T00:05:00.000Z",
    authority_status: "lineage_only"
  };
}

function validAarArtifactProposalRecord(): AarArtifactProposalRecord {
  return {
    record_kind: "aar_artifact_proposal",
    version: 1,
    aar_artifact_proposal_id: "aar-artifact-proposal-btc-breakout-v2",
    researcher_ref: { record_kind: "aar_researcher", id: "aar-researcher-breakout-001" },
    research_direction_ref: {
      record_kind: "aar_research_direction",
      id: "aar-research-direction-breakout-001"
    },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "trading-evaluation-task-btc-breakout-001"
    },
    proposed_runnable_artifact_ref: {
      record_kind: "runnable_artifact",
      id: "runnable-artifact-btc-breakout-v2"
    },
    parent_runnable_artifact_ref: {
      record_kind: "runnable_artifact",
      id: "runnable-artifact-btc-breakout-v1"
    },
    source_finding_refs: [
      { record_kind: "aar_finding", id: "aar-finding-btc-breakout-oos-001" }
    ],
    proposal_summary: "Propose a next opaque BTC breakout artifact candidate.",
    requested_change_summary: "Reduce drawdown while preserving cost survival.",
    expected_improvement_summary: "Improve held-out robustness under the same sealed evaluator.",
    created_at: "2026-05-11T00:06:00.000Z",
    status: "proposed",
    authority_status: "proposal_only"
  };
}

function validProposedRunnableArtifactRecord(): RunnableArtifactRecord {
  return {
    record_kind: "runnable_artifact",
    version: 1,
    runnable_artifact_id: "runnable-artifact-btc-breakout-v2",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trader-systems/clock.py",
    artifact_digest: "sha256:proposal-btc-breakout-v2",
    runtime_kind: "python",
    entrypoint: ["python", "fixtures/trader-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "metric_snapshot"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "fixture-aar-proposal" },
    provenance_refs: [
      { record_kind: "aar_artifact_proposal", id: "aar-artifact-proposal-btc-breakout-v2" },
      { record_kind: "aar_finding", id: "aar-finding-btc-breakout-oos-001" }
    ],
    status: "registered",
    created_at: "2026-05-11T00:06:00.000Z",
    authority_status: "not_live"
  };
}

function validAarOrchestrationRunRecord(): AarOrchestrationRunRecord {
  return {
    record_kind: "aar_orchestration_run",
    version: 1,
    aar_orchestration_run_id: "aar-orchestration-run-btc-breakout-v2",
    researcher_ref: { record_kind: "aar_researcher", id: "aar-researcher-breakout-001" },
    research_direction_ref: {
      record_kind: "aar_research_direction",
      id: "aar-research-direction-breakout-001"
    },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "trading-evaluation-task-btc-breakout-001"
    },
    input_finding_refs: [
      { record_kind: "aar_finding", id: "aar-finding-btc-breakout-oos-001" }
    ],
    input_lineage_refs: [
      { record_kind: "aar_artifact_lineage", id: "aar-artifact-lineage-btc-breakout-v2" }
    ],
    output_artifact_proposal_ref: {
      record_kind: "aar_artifact_proposal",
      id: "aar-artifact-proposal-btc-breakout-v2"
    },
    output_runnable_artifact_ref: {
      record_kind: "runnable_artifact",
      id: "runnable-artifact-btc-breakout-v2"
    },
    output_lineage_ref: {
      record_kind: "aar_artifact_lineage",
      id: "aar-artifact-lineage-btc-breakout-v2"
    },
    trace_ref: { record_kind: "trace_placeholder", id: "trace-aar-orchestration-btc-breakout-v2" },
    started_at: "2026-05-11T00:06:00.000Z",
    completed_at: "2026-05-11T00:06:01.000Z",
    status: "proposed",
    authority_status: "research_only"
  };
}

async function expectStoreError(promise: Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await promise;
    throw new Error(`expected local-store error ${expectedCode}`);
  } catch (error) {
    expect(error).toMatchObject({
      name: "LocalStoreError",
      code: expectedCode
    });
  }
}

async function readStoreJson<T>(...segments: string[]): Promise<T> {
  const text = await readFile(path.join(tmpDir, ...segments), "utf8");
  return JSON.parse(text) as T;
}

async function countJsonFiles(...segments: string[]): Promise<number> {
  try {
    const entries = await readdir(path.join(tmpDir, ...segments));
    return entries.filter((entry) => entry.endsWith(".json")).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}

async function writeStoreJson(value: unknown, ...segments: string[]): Promise<void> {
  await writeFile(path.join(tmpDir, ...segments), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
