import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "../src/index";
import type {
  CandidateMaterializationInput,
  EvaluationComparisonSetRecord,
  EvaluationRunRecord,
  EvidenceSealingDecisionRecord,
  TracePlaceholderRecord,
  StageBindingRecord
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

    expect(stageBinding.stage_binding_id).not.toBe(evaluationRun.evaluation_run_record_id);
    expect(comparisonSet.evaluation_comparison_set_id).not.toBe(sealingDecision.evidence_sealing_decision_id);
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

async function writeStoreJson(value: unknown, ...segments: string[]): Promise<void> {
  await writeFile(path.join(tmpDir, ...segments), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
