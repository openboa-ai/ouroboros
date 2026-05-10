import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { buildServer } from "../src/server";
import type { CandidateMaterializationInput } from "@ouroboros/domain";
import { FixtureEvaluationProviderAdapter } from "../src/providers/fixture-evaluation-provider";
import type { CandidateGenerationProviderResult, RuntimeProviderAdapter } from "../src/providers/runtime-provider-adapter";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("runtime read-only API", () => {
  it("serves health and candidate read models", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      status: "ok",
      mode: "fixture_convenience_mode"
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      candidates: [{ candidate_id: FIXTURE_CANDIDATE_ID }]
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      fixture_notice: { mode: "fixture_convenience_mode" },
      runtime: {
        authority_status: "not_live",
        memory_surface: {
          access_mode: "read_only",
          authority_status: "not_evidence"
        }
      }
    });

    await server.close();
  });

  it("returns 404 for an unknown candidate", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const response = await server.inject({ method: "GET", url: "/api/candidates/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    await server.close();
  });

  it("creates and reads deterministic candidate evaluation runs", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const create = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: candidateVersionId,
        idempotency_key: "runtime-api-evaluation-test-001",
        execution_mode: "host_local"
      }
    });

    expect(create.statusCode).toBe(201);
    const created = create.json();
    expect(created).toMatchObject({
      status: "created",
      evaluation: {
        candidate_id: FIXTURE_CANDIDATE_ID,
        candidate_version_id: candidateVersionId,
        stage_binding: {
          stage: "backtest",
          profile: "backtest",
          execution_mode: "host_local",
          authority_status: "not_live"
        },
        evaluation_run: {
          status: "created",
          authority_status: "not_counted",
          evaluator_ref: {
            record_kind: "evaluation_provider",
            id: "deterministic-backtest-fixture"
          }
        },
        trace: {
          authority_label: "provider_output_not_evidence",
          authority_status: "not_counted"
        },
        sealing_decision: {
          evidence_disposition: "not_counted",
          authority_status: "not_counted"
        }
      }
    });
    expect(created.evaluation.trace.provider_output_artifact_refs).toHaveLength(1);
    expect(created.evaluation.trace.debug_artifact_refs).toHaveLength(1);

    const detail = await server.inject({
      method: "GET",
      url: `/api/evaluation-runs/${created.evaluation.evaluation_run.evaluation_run_record_id}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toEqual(created.evaluation);

    const list = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().evaluation_runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evaluation_run: expect.objectContaining({
            evaluation_run_record_id: created.evaluation.evaluation_run.evaluation_run_record_id,
            authority_status: "not_counted"
          }),
          sealing_decision: expect.objectContaining({
            evidence_disposition: "not_counted"
          })
        })
      ])
    );

    const defaultHostMode = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: { candidate_version_id: candidateVersionId }
    });
    const defaultContainerMode = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: candidateVersionId,
        execution_mode: "containerized_local"
      }
    });
    const invalidModeAfterDefaultRun = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: candidateVersionId,
        execution_mode: "unsupported_mode"
      }
    });

    expect(defaultHostMode.statusCode).toBe(201);
    expect(defaultContainerMode.statusCode).toBe(201);
    expect(defaultHostMode.json().evaluation.stage_binding.execution_mode).toBe("host_local");
    expect(defaultContainerMode.json().evaluation.stage_binding.execution_mode).toBe("containerized_local");
    expect(defaultHostMode.json().evaluation.evaluation_run.evaluation_run_record_id).not.toBe(
      defaultContainerMode.json().evaluation.evaluation_run.evaluation_run_record_id
    );
    expect(invalidModeAfterDefaultRun.statusCode).toBe(422);
    expect(invalidModeAfterDefaultRun.json()).toMatchObject({
      error: "evaluation_run_failed",
      reason: "unsupported_execution_mode"
    });

    await server.close();
  });

  it("returns deterministic evaluation API errors", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const missingCandidate = await server.inject({
      method: "POST",
      url: "/api/candidates/missing/evaluation-runs",
      payload: { idempotency_key: "missing-candidate" }
    });
    expect(missingCandidate.statusCode).toBe(404);
    expect(missingCandidate.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    const missingCandidateRuns = await server.inject({
      method: "GET",
      url: "/api/candidates/missing/evaluation-runs"
    });
    expect(missingCandidateRuns.statusCode).toBe(404);
    expect(missingCandidateRuns.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    const invalidStage = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        idempotency_key: "invalid-stage",
        stage: "paper"
      }
    });
    expect(invalidStage.statusCode).toBe(422);
    expect(invalidStage.json()).toMatchObject({
      error: "evaluation_run_failed",
      reason: "unsupported_evaluation_stage",
      candidate_id: FIXTURE_CANDIDATE_ID
    });

    const missingVersion = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: "missing-candidate-version",
        idempotency_key: "missing-version"
      }
    });
    expect(missingVersion.statusCode).toBe(422);
    expect(missingVersion.json()).toMatchObject({
      error: "evaluation_run_failed",
      reason: "candidate_version_not_found",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: "missing-candidate-version"
    });

    const missingRun = await server.inject({
      method: "GET",
      url: "/api/evaluation-runs/missing-evaluation-run"
    });
    expect(missingRun.statusCode).toBe(404);
    expect(missingRun.json()).toEqual({
      error: "evaluation_run_not_found",
      evaluation_run_id: "missing-evaluation-run"
    });

    await server.close();
  });

  it("maps evaluation adapter failures to deterministic API responses", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      evaluationProviderAdapter: new FixtureEvaluationProviderAdapter({
        failureReason: "evaluation_provider_failed"
      })
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: { idempotency_key: "adapter-failure" }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "evaluation_run_failed",
      reason: "evaluation_provider_failed",
      candidate_id: FIXTURE_CANDIDATE_ID
    });

    await server.close();
  });

  it("does not expose runtime action routes", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const forbiddenPaths = [
      "/api/candidates/fixture-candidate-btc-perp-001/start",
      "/api/candidates/fixture-candidate-btc-perp-001/pause",
      "/api/provider-runs",
      "/api/evaluations",
      "/api/promotions",
      "/api/live/orders"
    ];

    for (const url of forbiddenPaths) {
      const response = await server.inject({ method: "POST", url });
      expect(response.statusCode).toBe(404);
    }

    await server.close();
  });

  it("allows browser clients to preflight candidate generation posts", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const response = await server.inject({
      method: "OPTIONS",
      url: "/api/candidate-generation-runs",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("POST");

    await server.close();
  });

  it("materializes a candidate generation provider result", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      providerAdapter: fakeProvider({
        status: "succeeded",
        output: validMaterializationInput()
      })
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/candidate-generation-runs",
      payload: { prompt: "create one BTC perp candidate" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "materialized",
      attempt: {
        provider_kind: "codex_cli",
        model: "gpt-5.4",
        authority_label: "provider_output_not_evidence"
      },
      candidate: {
        status: "materialized",
        display_name: "BTC Perp Breakout Candidate",
        evaluation: {
          run: {
            status: "created",
            authority_status: "not_counted"
          },
          sealing_decision: {
            authority_status: "not_counted"
          }
        }
      }
    });

    const attempts = await server.inject({ method: "GET", url: "/api/candidate-materialization-attempts" });
    expect(attempts.statusCode).toBe(200);
    expect(attempts.json()).toMatchObject({
      attempts: [
        {
          status: "materialized",
          validation_status: "accepted"
        }
      ]
    });

    await server.close();
  });

  it("keeps provider failures inspectable without creating a candidate", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      providerAdapter: fakeProvider({
        status: "failed",
        failure_reason: "provider_failed",
        idempotency_key: "runtime-provider-failure",
        provider_kind: "codex_cli",
        model: "gpt-5.4",
        agent_run_id: "agent-run-runtime-provider-failure",
        trace_id: "trace-runtime-provider-failure",
        artifact_refs: []
      })
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/candidate-generation-runs",
      payload: { prompt: "create one BTC perp candidate" }
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "provider_failed",
        authority_label: "provider_output_not_evidence"
      }
    });

    const candidates = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(candidates.json()).toMatchObject({
      candidates: [{ candidate_id: FIXTURE_CANDIDATE_ID }]
    });
    expect(candidates.json().candidates).toHaveLength(1);

    await server.close();
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
    idempotency_key: "runtime-codex-success-output-hash-001",
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema",
      agent_run_id: "agent-run-runtime-codex-success-001",
      agent_event_id: "agent-event-runtime-codex-success-001",
      trace_id: "trace-runtime-codex-success-001",
      output_artifact_hash: "sha256:runtime-success-output-001"
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
    artifact_refs: [{ record_kind: "provider_output_artifact", id: "runtime-codex-output-success-001" }]
  };
}
