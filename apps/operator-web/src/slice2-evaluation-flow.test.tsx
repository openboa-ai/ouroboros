import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CandidateInspectReadModel,
  CandidateMaterializationInput,
  EvidenceClassificationRecord,
  EvidenceSealingDecisionRecord,
  EvaluationComparisonSetRecord,
  EvaluationRunRecord,
  StageBindingRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { buildServer } from "../../runtime/src/server";
import { expectNoOperatorActionControls } from "../../../test/support/binance-no-authority";
import type {
  CandidateGenerationProviderResult,
  RuntimeProviderAdapter
} from "../../runtime/src/providers/runtime-provider-adapter";
import { CandidateDetail } from "./App";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-slice2-e2e-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Slice 2 evaluation flow", () => {
  it("materializes, evaluates, seals, reads through the runtime API, and renders operator inspect state", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({
      store,
      providerAdapter: fakeProvider({
        status: "succeeded",
        output: validMaterializationInput()
      })
    });

    try {
      const materialize = await server.inject({
        method: "POST",
        url: "/api/candidate-generation-runs",
        payload: { prompt: "create one deterministic generic trading candidate" }
      });
      expect(materialize.statusCode).toBe(201);

      const materialized = materialize.json();
      const candidateId = materialized.candidate.candidate_id as string;
      const candidateVersionId = materialized.candidate.candidate_version.candidate_version_id as string;
      expect(materialized.candidate.materialization_attempt.authority_label).toBe(
        "provider_output_not_evidence"
      );

      const createEvaluation = await server.inject({
        method: "POST",
        url: `/api/candidates/${candidateId}/evaluation-runs`,
        payload: {
          candidate_version_id: candidateVersionId,
          idempotency_key: "slice2-e2e-backtest-evaluation",
          execution_mode: "host_local"
        }
      });
      expect(createEvaluation.statusCode).toBe(201);

      const createdEvaluation = createEvaluation.json();
      const evaluationRunId = createdEvaluation.evaluation.evaluation_run.evaluation_run_record_id as string;
      const countedEvidenceRef = {
        record_kind: "fixture_evidence",
        id: "slice2-e2e-sealed-backtest-summary"
      };

      const sealed = await store.sealEvaluationRunEvidence({
        idempotency_key: "fixture-seal",
        evaluation_run_record_id: evaluationRunId,
        evidence_disposition: "counted",
        disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
        classified_refs: [countedEvidenceRef],
        sealed_at: "2026-05-10T00:00:00.000Z"
      });

      const stageBinding = await readStoreJson<StageBindingRecord>(
        "stage-bindings",
        "items",
        `${createdEvaluation.evaluation.stage_binding.stage_binding_id}.json`
      );
      const evaluationRun = await readStoreJson<EvaluationRunRecord>(
        "evaluation-runs",
        "items",
        `${evaluationRunId}.json`
      );
      const comparisonSet = await readStoreJson<EvaluationComparisonSetRecord>(
        "evaluation-comparison-sets",
        "items",
        `${createdEvaluation.evaluation.comparison_set.evaluation_comparison_set_id}.json`
      );
      const sealingDecision = await readStoreJson<EvidenceSealingDecisionRecord>(
        "evidence-sealing-decisions",
        "items",
        `${sealed.sealing_decision.evidence_sealing_decision_id}.json`
      );
      const countedClassificationId = sealed.evidence_classifications.find(
        (classification) => classification.classification_kind === "counted_evidence"
      )?.evidence_classification_id;
      if (!countedClassificationId) {
        throw new Error("expected counted evidence classification");
      }
      const countedClassification = await readStoreJson<EvidenceClassificationRecord>(
        "evidence-classifications",
        "items",
        `${countedClassificationId}.json`
      );

      expect(stageBinding).toMatchObject({
        record_kind: "stage_binding",
        stage: "backtest",
        profile: "backtest",
        execution_mode: "host_local",
        authority_status: "not_live"
      });
      expect(evaluationRun).toMatchObject({
        record_kind: "evaluation_run_record",
        status: "created",
        authority_status: "not_counted"
      });
      expect(comparisonSet).toMatchObject({
        record_kind: "evaluation_comparison_set",
        comparability_status: "not_evaluated",
        authority_status: "not_counted"
      });
      expect(sealingDecision).toMatchObject({
        record_kind: "evidence_sealing_decision",
        evidence_disposition: "counted",
        authority_status: "counted"
      });
      expect(countedClassification).toMatchObject({
        record_kind: "evidence_classification",
        classification_kind: "counted_evidence",
        classification_status: "counted",
        authority_status: "counted"
      });

      const evaluationDetail = await server.inject({
        method: "GET",
        url: `/api/evaluation-runs/${evaluationRunId}`
      });
      expect(evaluationDetail.statusCode).toBe(200);
      expect(evaluationDetail.json()).toMatchObject({
        evaluation_run: {
          evaluation_run_record_id: evaluationRunId,
          authority_status: "not_counted"
        },
        sealing_decision: {
          evidence_disposition: "counted",
          disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
          authority_status: "counted"
        },
        evidence_classifications: expect.arrayContaining([
          expect.objectContaining({
            classification_kind: "trace_debug_material",
            classification_status: "trace_only",
            authority_status: "not_counted"
          }),
          expect.objectContaining({
            classification_kind: "counted_evidence",
            classification_status: "counted",
            authority_status: "counted"
          })
        ])
      });

      const candidateReadback = await server.inject({
        method: "GET",
        url: `/api/candidates/${candidateId}`
      });
      expect(candidateReadback.statusCode).toBe(200);
      const candidate = candidateReadback.json() as CandidateInspectReadModel;
      expect(candidate.evaluation.latest_run).toMatchObject({
        run_id: evaluationRunId,
        stage: "backtest",
        profile: "backtest",
        execution_mode: "host_local"
      });
      expect(candidate.evaluation.counted_evidence).toMatchObject({
        counted: true,
        evidence_disposition: "counted",
        disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
        authority_status: "counted",
        sealed_at: "2026-05-10T00:00:00.000Z"
      });

      const html = renderToStaticMarkup(<CandidateDetail candidate={candidate} />);
      expect(html).toContain("generic market Perp Breakout Candidate");
      expect(html).toContain("Latest evaluation run");
      expect(html).toContain("backtest / backtest");
      expect(html).toContain("host_local");
      expect(html).toContain("Trace material");
      expect(html).toContain("provider_output_not_evidence");
      expect(html).toContain("Evidence state");
      expect(html).toContain("counted_evidence");
      expect(html).toContain("sealed_counted_fixture_only_allowed_by_test");
      expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
    } finally {
      await server.close();
    }
  });
});

function fakeProvider(result: CandidateGenerationProviderResult): RuntimeProviderAdapter {
  return {
    async probe() {
      return {
        provider_kind: "codex_cli",
        model: "gpt-5.4",
        readiness_status: "active_verified"
      };
    },
    async runCandidateGeneration() {
      return result;
    }
  };
}

function validMaterializationInput(): CandidateMaterializationInput {
  return {
    idempotency_key: "slice2-e2e-codex-output-hash-001",
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema",
      agent_run_id: "agent-run-slice2-e2e-codex-success-001",
      agent_event_id: "agent-event-slice2-e2e-codex-success-001",
      trace_id: "trace-slice2-e2e-codex-success-001",
      output_artifact_hash: "sha256:slice2-e2e-success-output-001"
    },
    candidate: {
      title: "generic market Perp Breakout Candidate",
      system_summary: "Agent-generated generic trading instruments breakout trading-system candidate.",
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: "Trade generic trading instruments using volatility breakouts and strict risk caps.",
      market: "ExternalTradingApiProvider",
      instrument: "generic trading instruments",
      supported_stage_binding_profiles: ["backtest", "paper", "live"]
    },
    program: {
      summary: "Generated behavior bundle that emits order intent drafts only after validation.",
      declared_runtime: "python-sandbox-placeholder",
      declared_outputs: ["OrderIntentDraft", "ProgramEvent", "Trace"]
    },
    capability_package: {
      summary: "generic trading market context and indicator package request.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_market_bars", "read_position_state"],
      forbidden_contents: ["exchange_credentials", "evaluator_hidden_labels", "live_order_authority"]
    },
    artifact_refs: [{ record_kind: "provider_output_artifact", id: "slice2-e2e-codex-output-success-001" }]
  };
}

async function readStoreJson<T>(...segments: string[]): Promise<T> {
  const text = await readFile(path.join(tmpDir, ...segments), "utf8");
  return JSON.parse(text) as T;
}
