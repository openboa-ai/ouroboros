import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { buildServer } from "../src/server";
import type {
  BoundedRuntimeAuthorityInput,
  CandidateMaterializationInput,
  RuntimeControlAuditInput,
  TradingSystemRuntimeRecord
} from "@ouroboros/domain";
import { FixtureEvaluationProviderAdapter } from "../src/providers/fixture-evaluation-provider";
import type {
  CandidateEvaluationRequest,
  CandidateGenerationProviderResult,
  RuntimeProviderAdapter
} from "../src/providers/runtime-provider-adapter";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("runtime read-only API", () => {
  it("serves health and candidate read models", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      status: "ok",
      mode: "fixture_convenience_mode"
    });

    const executionModes = await server.inject({ method: "GET", url: "/api/trading-execution-modes" });
    expect(executionModes.statusCode).toBe(200);
    expect(executionModes.json()).toMatchObject({
      modes: [
        {
          mode: "backtest",
          support_status: "available",
          artifact_contract: {
            api_provider_boundary: "TradingApiProvider",
            credentials_access: "forbidden",
            order_submission: "forbidden"
          },
          provider_contract: {
            market_data: "historical_replay",
            order_plane: "order_validation_only"
          },
          authority: {
            artifact_has_credentials: false,
            artifact_has_order_authority: false,
            live_exchange_authority: false,
            status: "not_live"
          }
        },
        {
          mode: "paper",
          support_status: "planned",
          provider_contract: {
            account: "paper_account",
            order_plane: "paper_order_sink"
          },
          authority: {
            status: "paper_only"
          }
        },
        {
          mode: "live",
          support_status: "planned",
          provider_contract: {
            account: "live_account",
            order_plane: "gated_live_order_gateway",
            credentials_scope: "provider_side_only"
          },
          authority: {
            status: "live_requires_gateway"
          }
        }
      ]
    });

    const liveMode = await server.inject({ method: "GET", url: "/api/trading-execution-modes/live" });
    expect(liveMode.statusCode).toBe(200);
    expect(liveMode.json()).toMatchObject({
      mode: {
        mode: "live",
        artifact_contract: {
          credentials_access: "forbidden",
          order_submission: "forbidden"
        },
        authority: {
          live_exchange_authority: true,
          status: "live_requires_gateway"
        }
      }
    });

    const missingMode = await server.inject({ method: "GET", url: "/api/trading-execution-modes/direct-broker" });
    expect(missingMode.statusCode).toBe(404);
    expect(missingMode.json()).toMatchObject({
      error: "trading_execution_mode_not_found"
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      candidates: [{
        candidate_id: FIXTURE_CANDIDATE_ID,
        latest_validation_state: {
          validation_state: "replay_required",
          validation_label: "validation_state_not_authority",
          authority_status: "not_live"
        }
      }]
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
      },
      latest_validation_state: {
        validation_state: "replay_required",
        reasons: [
          "no replay-run evidence has been recorded",
          "validation state cannot be inferred without replay evidence"
        ],
        required_next_evidence: [
          "record at least one candidate replay run",
          "record a second replay run to establish a comparison baseline"
        ],
        validation_label: "validation_state_not_authority"
      }
    });

    await server.close();
  });

  it("adds latest replay-run validation state summaries to candidate list and detail", async () => {
    const runRoot = path.join(tmpDir, "replay-runs");
    await writeReplayRunRecord(runRoot, {
      run_id: "candidate-posture-baseline",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "host_process",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 1,
      scenario_total: 2,
      provider_request_total: 5,
      runner_command_total: 0,
      artifact_digest: "sha256:baseline",
      score: 0.6,
      risk_decision: "valid_order_intent_draft",
      scenario_ids: ["trend_long", "range_short"],
      output_dir: path.join(runRoot, "candidate-posture-baseline", "output"),
      events_path: path.join(runRoot, "candidate-posture-baseline", "output", "replay-set.json"),
      started_at: "2026-05-14T10:59:00.000Z",
      completed_at: "2026-05-14T11:00:00.000Z",
      authority_status: "not_live"
    });
    await writeReplayRunRecord(runRoot, {
      run_id: "candidate-posture-latest",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 4,
      artifact_digest: "sha256:latest",
      score: 0.85,
      risk_decision: "valid_order_intent_draft",
      scenario_ids: ["trend_long", "range_short"],
      output_dir: path.join(runRoot, "candidate-posture-latest", "output"),
      events_path: path.join(runRoot, "candidate-posture-latest", "output", "replay-set.json"),
      started_at: "2026-05-14T11:59:00.000Z",
      completed_at: "2026-05-14T12:00:00.000Z",
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: runRoot
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.statusCode).toBe(200);
    expect(list.json().candidates[0]).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      latest_validation_state: {
        candidate_id: FIXTURE_CANDIDATE_ID,
        selected_run_id: "candidate-posture-latest",
        baseline_run_id: "candidate-posture-baseline",
        comparison_verdict: "improved",
        validation_state: "passes_replay_checks",
        validation_label: "validation_state_not_authority",
        authority_status: "not_live",
        no_authority: {
          live_exchange: false,
          order_authority: false,
          credentials: false,
          paper_trading: false
        }
      }
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      latest_validation_state: {
        selected_run_id: "candidate-posture-latest",
        baseline_run_id: "candidate-posture-baseline",
        validation_state: "passes_replay_checks",
        reasons: [
          "selected run improved against baseline",
          "all selected scenarios were accepted",
          "selected score meets the evidence threshold"
        ],
        required_next_evidence: [
          "human review of replay evidence",
          "future promotion issue with explicit authority scope"
        ]
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

  it("lists local replay-run evidence for operator inspection", async () => {
    const runRoot = path.join(tmpDir, "replay-runs");
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-newer",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 10,
      artifact_digest: "sha256:newer",
      completed_at: "2026-05-13T15:00:00.000Z",
      authority_status: "not_live"
    });
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-older",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "host_process",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 0,
      artifact_digest: "sha256:older",
      completed_at: "2026-05-13T14:00:00.000Z",
      authority_status: "not_live"
    });
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-other",
      candidate_id: "other-candidate",
      runner_kind: "host_process",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 1,
      scenario_total: 1,
      provider_request_total: 3,
      runner_command_total: 0,
      artifact_digest: "sha256:other",
      completed_at: "2026-05-13T16:00:00.000Z",
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      replayRunRoot: runRoot
    });

    const replayRuns = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs?limit=2`
    });

    expect(replayRuns.statusCode).toBe(200);
    expect(replayRuns.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      runs: [
        {
          run_id: "replay-run-newer",
          candidate_id: FIXTURE_CANDIDATE_ID,
          runner_kind: "docker_sandboxes_sbx",
          status: "accepted",
          run_status: "completed",
          scenario_accepted: 2,
          scenario_total: 2,
          provider_request_total: 6,
          runner_command_total: 10,
          artifact_digest: "sha256:newer",
          authority_status: "not_live"
        },
        {
          run_id: "replay-run-older",
          candidate_id: FIXTURE_CANDIDATE_ID,
          runner_kind: "host_process"
        }
      ]
    });
    expect(replayRuns.json().runs).toHaveLength(2);

    const allRuns = await server.inject({
      method: "GET",
      url: "/api/replay-runs?limit=1"
    });
    expect(allRuns.statusCode).toBe(200);
    expect(allRuns.json().runs[0]).toMatchObject({
      run_id: "replay-run-other",
      candidate_id: "other-candidate"
    });

    const missingCandidate = await server.inject({
      method: "GET",
      url: "/api/candidates/missing/replay-runs"
    });
    expect(missingCandidate.statusCode).toBe(404);
    expect(missingCandidate.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    await server.close();
  });

  it("surfaces promoted local candidate bundles with replay-run evidence", async () => {
    const promotedCandidateRoot = path.join(tmpDir, "trading-system-candidates");
    const replayRunRoot = path.join(tmpDir, "replay-runs");
    const candidateId = "trading-system-candidate-promoted-001";
    await writePromotedCandidateBundle(promotedCandidateRoot, candidateId);
    await writeReplayRunRecord(replayRunRoot, {
      run_id: "promoted-replay-run",
      candidate_id: candidateId,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 10,
      artifact_digest: "sha256:promoted",
      completed_at: "2026-05-14T10:00:00.000Z",
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot,
      replayRunRoot
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.statusCode).toBe(200);
    expect(list.json().candidates[0]).toMatchObject({
      candidate_id: candidateId,
      status: "materialized",
      fixture_notice: {
        mode: "local_promoted_candidate_bundle",
        label: "Promoted local candidate bundle"
      }
    });
    expect(list.json().candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ candidate_id: FIXTURE_CANDIDATE_ID })
    ]));

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${candidateId}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: candidateId,
      display_name: "Promoted Trading research Candidate",
      status: "materialized",
      program: {
        manifest: {
          declared_runtime: "python python3 run.py",
          declared_outputs: ["program_event", "runtime_log", "metric_snapshot", "order_intent_draft"]
        }
      },
      runtime: {
        authority_status: "not_live",
        memory_surface: {
          access_mode: "read_only",
          authority_status: "not_evidence"
        }
      },
      evaluation: {
        has_runs: false,
        counted_evidence: {
          disposition_reason: "no_evaluation_runs",
          authority_status: "not_counted"
        }
      }
    });
    expect(detail.json().runtime).not.toHaveProperty("bounded_authority");
    expect(detail.json().runtime).not.toHaveProperty("runtime_control");

    const replayRuns = await server.inject({
      method: "GET",
      url: `/api/candidates/${candidateId}/replay-runs`
    });
    expect(replayRuns.statusCode).toBe(200);
    expect(replayRuns.json()).toMatchObject({
      candidate_id: candidateId,
      runs: [
        {
          run_id: "promoted-replay-run",
          candidate_id: candidateId,
          runner_kind: "docker_sandboxes_sbx",
          artifact_digest: "sha256:promoted",
          authority_status: "not_live"
        }
      ]
    });

    await server.close();
  });

  it("creates promoted candidate replay runs through the runtime API", async () => {
    const promotedCandidateRoot = path.join(tmpDir, "trading-system-candidates");
    const replayRunRoot = path.join(tmpDir, "replay-runs");
    const candidateId = "trading-system-candidate-promoted-001";
    await writePromotedCandidateBundle(promotedCandidateRoot, candidateId);

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot,
      replayRunRoot
    });

    const created = await server.inject({
      method: "POST",
      url: `/api/candidates/${candidateId}/replay-runs`,
      payload: {
        run_id: "api-promoted-replay-run",
        runner_kind: "host_process"
      }
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      candidate_id: candidateId,
      run: {
        run_id: "api-promoted-replay-run",
        candidate_id: candidateId,
        runner_kind: "host_process",
        status: "accepted",
        run_status: "completed",
        scenario_accepted: 2,
        scenario_total: 2,
        provider_request_total: 6,
        runner_command_total: 0,
        authority_status: "not_live"
      }
    });
    expect(created.json().run.artifact_digest).toMatch(/^sha256:/);

    const replayRuns = await server.inject({
      method: "GET",
      url: `/api/candidates/${candidateId}/replay-runs`
    });
    expect(replayRuns.statusCode).toBe(200);
    expect(replayRuns.json().runs[0]).toMatchObject({
      run_id: "api-promoted-replay-run",
      candidate_id: candidateId,
      authority_status: "not_live"
    });

    const fixtureRejected = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs`,
      payload: { runner_kind: "host_process" }
    });
    expect(fixtureRejected.statusCode).toBe(422);
    expect(fixtureRejected.json()).toMatchObject({
      error: "replay_run_rejected",
      reason: "promoted_candidate_bundle_required",
      candidate_id: FIXTURE_CANDIDATE_ID
    });

    const sbxRejected = await server.inject({
      method: "POST",
      url: `/api/candidates/${candidateId}/replay-runs`,
      payload: {
        runner_kind: "docker_sandboxes_sbx"
      }
    });
    expect(sbxRejected.statusCode).toBe(422);
    expect(sbxRejected.json()).toMatchObject({
      error: "replay_run_rejected",
      reason: "docker_sandboxes_sbx_runtime_disabled",
      candidate_id: candidateId
    });

    await server.close();
  });

  it("reads replay-run detail evidence for scenario drilldown", async () => {
    const runRoot = path.join(tmpDir, "replay-runs");
    const promotedCandidateRoot = path.join(tmpDir, "trading-system-candidates");
    const otherCandidateId = "trading-system-candidate-other-001";
    await writePromotedCandidateBundle(promotedCandidateRoot, otherCandidateId);
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-detail",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 1,
      scenario_total: 1,
      provider_request_total: 3,
      runner_command_total: 2,
      artifact_digest: "sha256:detail",
      started_at: "2026-05-14T12:00:00.000Z",
      completed_at: "2026-05-14T12:01:00.000Z",
      score: 1,
      risk_decision: "valid_order_intent_draft",
      scenario_ids: ["trend_long"],
      output_dir: path.join(runRoot, "replay-run-detail", "output"),
      events_path: path.join(runRoot, "replay-run-detail", "output", "replay-set.json"),
      scenario_results: [
        {
          scenario_id: "trend_long",
          runner_kind: "docker_sandboxes_sbx",
          sandbox_name: "ouro-s22-detail",
          status: "accepted",
          run_status: "completed",
          score: 1,
          risk_decision: "valid_order_intent_draft",
          summary: "Accepted order intent draft with score 1.000.",
          events_path: path.join(runRoot, "replay-run-detail", "output", "trend_long", "events.jsonl"),
          provider_request_count: 3,
          runner_command_count: 2,
          metrics: [
            {
              name: "provider_boundary",
              score: 0.2,
              detail: "market/account/order validation went through the external provider"
            }
          ],
          runner_command_evidence: [
            {
              command: ["sbx", "version"],
              exit_code: 0,
              stdout_preview: "Docker Sandboxes",
              stderr_preview: "",
              started_at: "2026-05-14T12:00:01.000Z",
              completed_at: "2026-05-14T12:00:02.000Z"
            }
          ]
        }
      ],
      no_authority: {
        live_exchange: false,
        order_authority: false,
        credentials: false,
        paper_trading: false
      },
      provenance: {
        promotion_id: "promotion-detail",
        source_session_id: "research-detail"
      },
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot,
      replayRunRoot: runRoot
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-detail`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      run: {
        run_id: "replay-run-detail",
        candidate_id: FIXTURE_CANDIDATE_ID,
        score: 1,
        risk_decision: "valid_order_intent_draft",
        scenario_ids: ["trend_long"],
        no_authority: {
          live_exchange: false,
          order_authority: false,
          credentials: false,
          paper_trading: false
        },
        provenance: {
          promotion_id: "promotion-detail",
          source_session_id: "research-detail"
        },
        scenarios: [
          {
            scenario_id: "trend_long",
            runner_kind: "docker_sandboxes_sbx",
            sandbox_name: "ouro-s22-detail",
            status: "accepted",
            risk_decision: "valid_order_intent_draft",
            metrics: [
              {
                name: "provider_boundary",
                score: 0.2
              }
            ],
            runner_command_evidence: [
              {
                command: ["sbx", "version"],
                exit_code: 0,
                stdout_preview: "Docker Sandboxes",
                stderr_preview: ""
              }
            ]
          }
        ]
      }
    });

    const mismatch = await server.inject({
      method: "GET",
      url: `/api/candidates/${otherCandidateId}/replay-runs/replay-run-detail`
    });
    expect(mismatch.statusCode).toBe(404);
    expect(mismatch.json()).toEqual({
      error: "replay_run_not_found",
      candidate_id: otherCandidateId,
      run_id: "replay-run-detail"
    });

    const missingRun = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/missing-run`
    });
    expect(missingRun.statusCode).toBe(404);
    expect(missingRun.json()).toEqual({
      error: "replay_run_not_found",
      candidate_id: FIXTURE_CANDIDATE_ID,
      run_id: "missing-run"
    });

    await server.close();
  });

  it("compares selected replay-run evidence against a baseline run", async () => {
    const runRoot = path.join(tmpDir, "replay-runs");
    const promotedCandidateRoot = path.join(tmpDir, "trading-system-candidates");
    const otherCandidateId = "trading-system-candidate-other-001";
    await writePromotedCandidateBundle(promotedCandidateRoot, otherCandidateId);
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-selected",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 4,
      artifact_digest: "sha256:selected",
      started_at: "2026-05-14T13:00:00.000Z",
      completed_at: "2026-05-14T13:01:00.000Z",
      score: 0.85,
      risk_decision: "valid_order_intent_draft",
      scenario_ids: ["trend_long", "range_short"],
      output_dir: path.join(runRoot, "replay-run-selected", "output"),
      events_path: path.join(runRoot, "replay-run-selected", "output", "replay-set.json"),
      scenario_results: [],
      no_authority: {
        live_exchange: false,
        order_authority: false,
        credentials: false,
        paper_trading: false
      },
      authority_status: "not_live"
    });
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-baseline",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "host_process",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 1,
      scenario_total: 2,
      provider_request_total: 5,
      runner_command_total: 0,
      artifact_digest: "sha256:baseline",
      started_at: "2026-05-14T12:00:00.000Z",
      completed_at: "2026-05-14T12:01:00.000Z",
      score: 0.6,
      risk_decision: "valid_order_intent_draft",
      scenario_ids: ["trend_long", "range_short"],
      output_dir: path.join(runRoot, "replay-run-baseline", "output"),
      events_path: path.join(runRoot, "replay-run-baseline", "output", "replay-set.json"),
      scenario_results: [],
      no_authority: {
        live_exchange: false,
        order_authority: false,
        credentials: false,
        paper_trading: false
      },
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot,
      replayRunRoot: runRoot
    });

    const comparison = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/comparison?baseline_run_id=replay-run-baseline`
    });
    expect(comparison.statusCode).toBe(200);
    expect(comparison.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      comparison: {
        candidate_id: FIXTURE_CANDIDATE_ID,
        selected: {
          run_id: "replay-run-selected",
          score: 0.85,
          scenario_accepted: 2,
          authority_status: "not_live"
        },
        baseline: {
          run_id: "replay-run-baseline",
          score: 0.6,
          scenario_accepted: 1,
          authority_status: "not_live"
        },
        baseline_selection: "explicit_baseline_run_id",
        deltas: {
          score: 0.25,
          scenario_accepted: 1,
          scenario_total: 0,
          provider_request_total: 1,
          runner_command_total: 4
        },
        risk_transition: "valid_order_intent_draft -> valid_order_intent_draft",
        verdict: "improved",
        authority_status: "not_live",
        validation_label: "comparison_not_authority",
        no_authority: {
          live_exchange: false,
          order_authority: false,
          credentials: false,
          paper_trading: false
        }
      }
    });

    const missingBaseline = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/comparison?baseline_run_id=missing-run`
    });
    expect(missingBaseline.statusCode).toBe(404);
    expect(missingBaseline.json()).toEqual({
      error: "replay_run_comparison_not_found",
      candidate_id: FIXTURE_CANDIDATE_ID,
      run_id: "replay-run-selected",
      baseline_run_id: "missing-run"
    });

    const mismatch = await server.inject({
      method: "GET",
      url: `/api/candidates/${otherCandidateId}/replay-runs/replay-run-selected/comparison?baseline_run_id=replay-run-baseline`
    });
    expect(mismatch.statusCode).toBe(404);
    expect(mismatch.json()).toEqual({
      error: "replay_run_comparison_not_found",
      candidate_id: otherCandidateId,
      run_id: "replay-run-selected",
      baseline_run_id: "replay-run-baseline"
    });

    const missingQuery = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/comparison`
    });
    expect(missingQuery.statusCode).toBe(422);
    expect(missingQuery.json()).toEqual({
      error: "replay_run_comparison_rejected",
      reason: "missing_baseline_run_id",
      candidate_id: FIXTURE_CANDIDATE_ID,
      run_id: "replay-run-selected"
    });

    const validationState = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/validation-state?baseline_run_id=replay-run-baseline`
    });
    expect(validationState.statusCode).toBe(200);
    expect(validationState.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      validation_state: {
        candidate_id: FIXTURE_CANDIDATE_ID,
        selected_run_id: "replay-run-selected",
        baseline_run_id: "replay-run-baseline",
        comparison_verdict: "improved",
        validation_state: "passes_replay_checks",
        reasons: [
          "selected run improved against baseline",
          "all selected scenarios were accepted",
          "selected score meets the evidence threshold"
        ],
        required_next_evidence: [
          "human review of replay evidence",
          "future promotion issue with explicit authority scope"
        ],
        authority_status: "not_live",
        validation_label: "validation_state_not_authority",
        no_authority: {
          live_exchange: false,
          order_authority: false,
          credentials: false,
          paper_trading: false
        }
      }
    });

    const noBaseline = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/validation-state`
    });
    expect(noBaseline.statusCode).toBe(200);
    expect(noBaseline.json()).toMatchObject({
      validation_state: {
        selected_run_id: "replay-run-selected",
        validation_state: "comparison_required",
        validation_label: "validation_state_not_authority"
      }
    });

    const missingPostureRun = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/missing-run/validation-state`
    });
    expect(missingPostureRun.statusCode).toBe(404);
    expect(missingPostureRun.json()).toEqual({
      error: "replay_run_validation_state_not_found",
      candidate_id: FIXTURE_CANDIDATE_ID,
      run_id: "missing-run"
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
        },
        evidence_classifications: expect.arrayContaining([
          expect.objectContaining({
            classification_kind: "trace_debug_material",
            classification_status: "trace_only",
            authority_status: "not_counted"
          })
        ])
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

  it("records and reads bounded runtime authority through the runtime API", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const initialAuthority = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-authority`
    });
    expect(initialAuthority.statusCode).toBe(200);
    expect(initialAuthority.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      runtime_id: candidate.json().runtime.ref.id,
      bounded_authority: {
        has_activity: false,
        chain_complete: false
      }
    });

    const first = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-authority`,
      payload: validRuntimeAuthorityInput(candidateVersionId)
    });
    const duplicate = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-authority`,
      payload: validRuntimeAuthorityInput(candidateVersionId)
    });

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json()).toEqual(first.json());
    expect(first.json()).toMatchObject({
      status: "recorded",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId,
      runtime_id: candidate.json().runtime.ref.id,
      order_intent_draft: {
        record_kind: "order_intent_draft",
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
        stage: "paper",
        execution_mode: "host_local",
        status: "dry_run_recorded",
        authority_status: "dry_run_only"
      }
    });

    const updatedCandidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(updatedCandidate.json().runtime.bounded_authority).toMatchObject({
      has_activity: true,
      chain_complete: true,
      latest_order_intent_draft: {
        order_intent_draft_id: first.json().order_intent_draft.order_intent_draft_id,
        authority_status: "not_submitted"
      },
      latest_gateway_decision: {
        gateway_decision_id: first.json().gateway_decision.gateway_decision_id,
        authority_status: "dry_run_only"
      },
      latest_execution_attempt: {
        execution_attempt_id: first.json().execution_attempt.execution_attempt_id,
        authority_status: "dry_run_only"
      }
    });

    const projectedAuthority = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-authority`
    });
    expect(projectedAuthority.json().bounded_authority.latest_execution_attempt.execution_attempt_id).toBe(
      first.json().execution_attempt.execution_attempt_id
    );

    await server.close();
  });

  it("returns deterministic runtime authority API errors", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const missingCandidate = await server.inject({
      method: "GET",
      url: "/api/candidates/missing/runtime-authority"
    });
    expect(missingCandidate.statusCode).toBe(404);
    expect(missingCandidate.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });
    const missingCandidatePost = await server.inject({
      method: "POST",
      url: "/api/candidates/missing/runtime-control",
      payload: validRuntimeControlInput(candidateVersionId)
    });
    expect(missingCandidatePost.statusCode).toBe(404);
    expect(missingCandidatePost.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    const missingFields = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-authority`,
      payload: { candidate_version_id: candidateVersionId }
    });
    expect(missingFields.statusCode).toBe(422);
    expect(missingFields.json()).toMatchObject({
      error: "runtime_authority_record_failed",
      reason: "invalid_runtime_authority_request",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId
    });

    const invalidOutcome = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-authority`,
      payload: {
        ...validRuntimeAuthorityInput(candidateVersionId),
        gateway_decision: {
          decision_outcome: "live_allowed",
          decision_reason: "paper_stage_only"
        }
      }
    });
    expect(invalidOutcome.statusCode).toBe(422);
    expect(invalidOutcome.json()).toMatchObject({
      error: "runtime_authority_record_failed",
      reason: "invalid_runtime_authority_input",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId
    });

    const missingVersion = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-authority`,
      payload: {
        ...validRuntimeAuthorityInput("missing-candidate-version"),
        candidate_version_id: "missing-candidate-version"
      }
    });
    expect(missingVersion.statusCode).toBe(422);
    expect(missingVersion.json()).toMatchObject({
      error: "runtime_authority_record_failed",
      reason: "candidate_version_not_found",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: "missing-candidate-version"
    });

    await server.close();
  });

  it("records and reads runtime control through the runtime API", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const initialControl = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`
    });
    expect(initialControl.statusCode).toBe(200);
    expect(initialControl.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      runtime_id: candidate.json().runtime.ref.id,
      runtime_control: {
        has_activity: false,
        chain_complete: false
      }
    });

    const first = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
      payload: validRuntimeControlInput(candidateVersionId)
    });
    const duplicate = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
      payload: validRuntimeControlInput(candidateVersionId)
    });

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json()).toEqual(first.json());
    expect(first.json()).toMatchObject({
      status: "recorded",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId,
      runtime_id: candidate.json().runtime.ref.id,
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

    const updatedCandidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(updatedCandidate.json().runtime.runtime_control).toMatchObject({
      has_activity: true,
      chain_complete: true,
      latest_command: {
        command_id: first.json().command.runtime_control_command_id,
        action: "pause",
        authority_status: "control_only"
      },
      latest_decision: {
        decision_id: first.json().decision.runtime_control_decision_id,
        decision_outcome: "allowed",
        resulting_lifecycle_status: "paused"
      },
      latest_audit_event: {
        audit_event_id: first.json().audit_event.runtime_audit_event_id,
        event_kind: "runtime_lifecycle_transitioned",
        authority_status: "audit_only"
      }
    });
    expect(updatedCandidate.json().runtime.placement.authority_status).toBe("not_launched");
    expect(JSON.stringify(updatedCandidate.json().runtime.runtime_control)).not.toMatch(
      /exchange_credentials|provider_api_key|direct_exchange_order|gateway_signing_material/
    );

    const projectedControl = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`
    });
    expect(projectedControl.json().runtime_control.latest_command.command_id).toBe(
      first.json().command.runtime_control_command_id
    );

    await server.close();
  });

  it("returns deterministic runtime control API errors", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({ store });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const missingCandidate = await server.inject({
      method: "GET",
      url: "/api/candidates/missing/runtime-control"
    });
    expect(missingCandidate.statusCode).toBe(404);
    expect(missingCandidate.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    const missingFields = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
      payload: { candidate_version_id: candidateVersionId }
    });
    expect(missingFields.statusCode).toBe(422);
    expect(missingFields.json()).toMatchObject({
      error: "runtime_control_record_failed",
      reason: "invalid_runtime_control_request",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId
    });

    const invalidAction = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
      payload: {
        ...validRuntimeControlInput(candidateVersionId),
        command: {
          ...validRuntimeControlInput(candidateVersionId).command,
          action: "launch_live"
        }
      }
    });
    expect(invalidAction.statusCode).toBe(422);
    expect(invalidAction.json()).toMatchObject({
      error: "runtime_control_record_failed",
      reason: "invalid_runtime_control_input",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId
    });

    const invalidOutcome = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
      payload: {
        ...validRuntimeControlInput(candidateVersionId),
        decision: {
          ...validRuntimeControlInput(candidateVersionId).decision,
          decision_outcome: "live_allowed"
        }
      }
    });
    expect(invalidOutcome.statusCode).toBe(422);
    expect(invalidOutcome.json()).toMatchObject({
      reason: "invalid_runtime_control_input"
    });

    const missingVersion = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
      payload: {
        ...validRuntimeControlInput("missing-candidate-version"),
        candidate_version_id: "missing-candidate-version"
      }
    });
    expect(missingVersion.statusCode).toBe(422);
    expect(missingVersion.json()).toMatchObject({
      reason: "candidate_version_not_found",
      candidate_version_id: "missing-candidate-version"
    });

    const missingRuntime = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
      payload: {
        ...validRuntimeControlInput(candidateVersionId),
        runtime_id: "missing-runtime"
      }
    });
    expect(missingRuntime.statusCode).toBe(422);
    expect(missingRuntime.json()).toMatchObject({
      reason: "runtime_not_found",
      candidate_version_id: candidateVersionId
    });

    await writeStoreJson(
      {
        record_kind: "trading_system_runtime",
        version: 1,
        trading_system_runtime_id: "foreign-runtime-001",
        stage_binding_profile: "paper",
        placement_ref: { record_kind: "runtime_placement", id: "fixture-runtime-placement-001" },
        hands_environment_ref: { record_kind: "hands_environment", id: "fixture-hands-environment-001" },
        memory_surface_ref: { record_kind: "runtime_memory_surface", id: "fixture-runtime-memory-surface-001" },
        authority_status: "not_live"
      } satisfies TradingSystemRuntimeRecord,
      "trading-system-runtimes",
      "items",
      "foreign-runtime-001.json"
    );
    const runtimeMismatch = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
      payload: {
        ...validRuntimeControlInput(candidateVersionId),
        runtime_id: "foreign-runtime-001"
      }
    });
    expect(runtimeMismatch.statusCode).toBe(422);
    expect(runtimeMismatch.json()).toMatchObject({
      reason: "runtime_mismatch"
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

    const missingReplayRuns = await server.inject({
      method: "GET",
      url: "/api/candidates/missing/evaluation-runs"
    });
    expect(missingReplayRuns.statusCode).toBe(404);
    expect(missingReplayRuns.json()).toEqual({
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

  it("passes the default execution mode through the evaluation provider request", async () => {
    const evaluationProviderAdapter = new CapturingEvaluationProviderAdapter();
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      evaluationProviderAdapter
    });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: candidate.json().candidate_version.candidate_version_id,
        idempotency_key: "provider-default-execution-mode"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(evaluationProviderAdapter.requests[0]?.execution_mode).toBe("host_local");

    await server.close();
  });

  it("does not expose runtime action routes", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const forbiddenPaths = [
      "/api/candidates/fixture-candidate-sealed-replay-001/start",
      "/api/candidates/fixture-candidate-sealed-replay-001/pause",
      "/api/candidates/fixture-candidate-sealed-replay-001/runtime-control/pause",
      "/api/candidates/fixture-candidate-sealed-replay-001/runtime-control/kill",
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
      payload: { prompt: "create one generic trading candidate" }
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
        display_name: "generic market Perp Breakout Candidate",
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
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
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
      payload: { prompt: "create one generic trading candidate" }
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

class CapturingEvaluationProviderAdapter extends FixtureEvaluationProviderAdapter {
  readonly requests: CandidateEvaluationRequest[] = [];

  override async runCandidateEvaluation(request: CandidateEvaluationRequest) {
    this.requests.push(request);
    return super.runCandidateEvaluation(request);
  }
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
      summary: "generic tradingetual market context and indicator package request.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_market_bars", "read_position_state"],
      forbidden_contents: ["exchange_credentials", "evaluator_hidden_labels", "live_order_authority"]
    },
    artifact_refs: [{ record_kind: "provider_output_artifact", id: "runtime-codex-output-success-001" }]
  };
}

function validRuntimeAuthorityInput(candidateVersionId: string): BoundedRuntimeAuthorityInput {
  return {
    idempotency_key: "runtime-api-authority-dry-run-001",
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
      trace_ref: { record_kind: "trace_placeholder", id: "trace-runtime-api-authority-dry-run-001" },
      completed_at: "2026-05-10T00:01:00.000Z"
    },
    created_at: "2026-05-10T00:00:00.000Z"
  };
}

function validRuntimeControlInput(candidateVersionId: string): RuntimeControlAuditInput {
  return {
    idempotency_key: "runtime-api-control-pause-001",
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
      trace_ref: { record_kind: "trace_placeholder", id: "trace-runtime-api-control-pause-001" }
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
      message: "Paper runtime paused through runtime API control chain."
    },
    created_at: "2026-05-10T00:10:00.000Z"
  };
}

async function writeStoreJson(value: unknown, ...segments: string[]): Promise<void> {
  const filePath = path.join(tmpDir, ...segments);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writePromotedCandidateBundle(root: string, candidateId: string): Promise<void> {
  const bundleDir = path.join(root, candidateId);
  const runnableArtifactId = `${candidateId}-artifact`;
  const candidateVersionId = `${candidateId}-v1`;
  const artifactFiles = promotedCandidateArtifactFiles();
  const artifactDigest = digestArtifactFiles(artifactFiles);
  await mkdir(path.join(bundleDir, "artifact"), { recursive: true });
  for (const file of artifactFiles) {
    await writeFile(path.join(bundleDir, "artifact", file.relativePath), file.content, "utf8");
  }
  await writeFile(path.join(bundleDir, "candidate.json"), `${JSON.stringify({
    record_kind: "trading_system_candidate",
    version: 1,
    candidate_id: candidateId,
    display_name: "Promoted Trading research Candidate",
    status: "materialized",
    active_version_id: candidateVersionId,
    provenance_refs: [
      { record_kind: "trading_research_notebook", id: "test-research-session" },
      { record_kind: "runnable_artifact", id: runnableArtifactId }
    ],
    title: "Promoted Trading research Candidate",
    system_summary: "Promoted from a test Trading research seeded-stability gate.",
    candidate_status: "handoff_ready",
    evaluation_handoff_ready: true,
    active_runnable_artifact_ref: { record_kind: "runnable_artifact", id: runnableArtifactId },
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(bundleDir, "candidate-version.json"), `${JSON.stringify({
    record_kind: "candidate_version",
    version: 1,
    candidate_version_id: candidateVersionId,
    candidate_id: candidateId,
    version_label: "trading-research-v1",
    spec_ref: { record_kind: "trading_system_spec", id: `${candidateId}-spec` },
    program_ref: { record_kind: "trading_system_program", id: `${candidateId}-program` },
    capability_package_refs: [
      { record_kind: "capability_package", id: `${candidateId}-capabilities` }
    ],
    runtime_ref: { record_kind: "trading_system_runtime", id: `${candidateId}-runtime` },
    trace_placeholder_ref: { record_kind: "trace_placeholder", id: `${candidateId}-trace` },
    runnable_artifact_ref: { record_kind: "runnable_artifact", id: runnableArtifactId }
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(bundleDir, "runnable-artifact.json"), `${JSON.stringify({
    record_kind: "runnable_artifact",
    version: 1,
    runnable_artifact_id: runnableArtifactId,
    artifact_kind: "python_file",
    artifact_path: path.join(bundleDir, "artifact"),
    artifact_digest: artifactDigest,
    runtime_kind: "python",
    entrypoint: ["python3", "run.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "metric_snapshot", "order_intent_draft"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "secret-policy-no-raw-values-v1" },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "capability-policy-trading-replay-readonly-v1"
    },
    provenance_refs: [
      { record_kind: "trading_research_notebook", id: "test-research-session" }
    ],
    status: "registered",
    created_at: "2026-05-14T10:00:00.000Z",
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(bundleDir, "promotion.json"), `${JSON.stringify({
    record_kind: "trading_research_candidate_promotion",
    version: 1,
    promotion_id: `${candidateId}-promotion`,
    gate: "seeded-stability",
    artifact_manifest: {
      id: "trading-system-mvp",
      name: "Minimal Trading System MVP",
      entrypoint: ["python3", "run.py"],
      api_contract: "trading_api_provider_v1"
    },
    artifact_digest: artifactDigest,
    evidence_disposition: "not_counted",
    authority_status: "not_live",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    }
  }, null, 2)}\n`, "utf8");
}

function promotedCandidateArtifactFiles(): Array<{ relativePath: string; content: string }> {
  return [
    {
      relativePath: "manifest.json",
      content: `${JSON.stringify({
        id: "trading-system-mvp",
        name: "Minimal Trading System MVP",
        entrypoint: ["python3", "run.py"],
        editable_paths: ["run.py"],
        api_contract: "trading_api_provider_v1"
      }, null, 2)}\n`
    },
    {
      relativePath: "run.py",
      content: [
        "#!/usr/bin/env python3",
        "import argparse",
        "import json",
        "import os",
        "from urllib import request",
        "",
        "def get_json(base_url, path):",
        "    with request.urlopen(base_url + path, timeout=10) as response:",
        "        return json.loads(response.read().decode('utf-8'))",
        "",
        "def post_json(base_url, path, payload):",
        "    body = json.dumps(payload).encode('utf-8')",
        "    req = request.Request(base_url + path, data=body, headers={'content-type': 'application/json'}, method='POST')",
        "    with request.urlopen(req, timeout=10) as response:",
        "        return json.loads(response.read().decode('utf-8'))",
        "",
        "def append_event(events_path, event):",
        "    with open(events_path, 'a', encoding='utf-8') as handle:",
        "        handle.write(json.dumps(event, sort_keys=True) + '\\n')",
        "",
        "def build_intent(market, account):",
        "    if market['moving_average_fast'] <= market['moving_average_slow']:",
        "        return {'symbol': market['symbol'], 'side': 'hold', 'quantity': 0, 'order_type': 'none'}",
        "    return {'symbol': market['symbol'], 'side': 'buy', 'quantity': round((account['equity'] * 0.02) / market['price'], 8), 'order_type': 'market'}",
        "",
        "def main():",
        "    parser = argparse.ArgumentParser()",
        "    parser.add_argument('--output-events', required=True)",
        "    args = parser.parse_args()",
        "    base_url = os.environ['TRADING_API_BASE_URL']",
        "    market = get_json(base_url, '/market/snapshot')",
        "    append_event(args.output_events, {'event': 'market_snapshot', **market})",
        "    account = get_json(base_url, '/account/state')",
        "    append_event(args.output_events, {'event': 'account_state', **account})",
        "    intent = build_intent(market, account)",
        "    append_event(args.output_events, {'event': 'order_intent_draft', **intent})",
        "    validation = post_json(base_url, '/orders/validate', intent)",
        "    append_event(args.output_events, {'event': 'order_validation', **validation})",
        "    append_event(args.output_events, {'event': 'run_complete', 'accepted': validation['accepted']})",
        "",
        "if __name__ == '__main__':",
        "    main()",
        ""
      ].join("\n")
    }
  ];
}

function digestArtifactFiles(files: Array<{ relativePath: string; content: string }>): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.content);
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function writeReplayRunRecord(
  root: string,
  value: {
    run_id: string;
    candidate_id: string;
    runner_kind: string;
    status: string;
    run_status: string;
    scenario_accepted: number;
    scenario_total: number;
    provider_request_total: number;
    runner_command_total: number;
    artifact_digest: string;
    score?: number;
    risk_decision?: string;
    scenario_ids?: string[];
    output_dir?: string;
    events_path?: string;
    scenario_results?: unknown[];
    started_at?: string;
    completed_at: string;
    authority_status: string;
    no_authority?: {
      live_exchange: boolean;
      order_authority: boolean;
      credentials: boolean;
      paper_trading: boolean;
    };
    provenance?: {
      promotion_id?: string;
      source_session_id?: string;
    };
  }
): Promise<void> {
  const filePath = path.join(root, value.run_id, "run.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(path.join(root, value.run_id, "ignore.txt"), "ignored\n", "utf8");
  await writeFile(filePath, `${JSON.stringify({
    record_kind: "trading_system_replay_run",
    version: 1,
    ...value
  }, null, 2)}\n`, "utf8");
}
