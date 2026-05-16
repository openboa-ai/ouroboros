import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  CandidateEvaluationReadModel,
  CandidateInspectReadModel,
  CandidateLatestValidationStateReadModel,
  ReplayRunComparisonReadModel,
  ReplayRunDetailReadModel,
  ReplayRunEvidenceReadModel,
  ReplayRunValidationStateReadModel,
  ReplayRuntimeAuthorityReadModel,
  ReplayRuntimeControlReadModel,
  TradingSystemExecutionModeContractReadModel
} from "@ouroboros/domain";
import {
  BINANCE_NO_AUTHORITY_LABEL,
  expectNoOperatorActionControls,
  fixtureAccountPositionRiskMirrorSurface,
  fixtureOrderFillSurface,
  fixturePrivateReadinessPolicyDecision,
  fixturePrivateReadinessPosture,
  fixturePrivateReadinessPreflightSurface,
  fixturePublicMarketLivenessSurface
} from "../../../test/support/binance-no-authority";
import { CandidateDetail, CandidateSummaryRow, TradingExecutionModesSection } from "./App";
import {
  replayRunPayload,
  runtimeAuthorityCommandPayload,
  runtimeControlPausePayload
} from "./api";

describe("CandidateDetail", () => {
  it("renders fixture labels and inspect sections without action controls", () => {
    const html = renderToStaticMarkup(<CandidateDetail candidate={fixtureCandidate} />);

    expect(html).toContain("Fixture / convenience mode");
    expect(html).toContain("fixture_convenience_mode");
    expect(html).toContain("No provider has run.");
    expect(html).toContain("Capability Package");
    expect(html).toContain("Agent And Provider");
    expect(html).toContain("Runtime Authority");
    expect(html).toContain("Runtime Control");
    expect(html).toContain("Candidate Runs");
    expect(html).toContain("No candidate-id replay runs");
    expect(html).toContain("Logical TradingSystemRuntime state");
    expect(html).toContain("Bounded paper state");
    expect(html).toContain("Trace And Evaluation");
    expect(html).toContain("Evaluation state");
    expect(html).toContain("pending");
    expect(html).toContain("Latest evaluation run");
    expect(html).toContain("Stage binding");
    expect(html).toContain("Trace material");
    expect(html).toContain("Evidence classifications");
    expect(html).toContain("trace_debug_material");
    expectNoOperatorActionControls(html);
  });

  it("renders Binance BTCUSDT order-fill substrate posture without action controls", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: null,
            latest_private_readiness_preflight_surface: null,
            latest_private_readiness_posture: null,
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Trading Substrate");
    expect(html).toContain("Binance BTCUSDT order_fill");
    expect(html).toContain("partially_filled");
    expect(html).toContain("PARTIALLY_FILLED");
    expect(html).toContain("TRADE");
    expect(html).toContain("fixture-backed");
    expect(html).toContain("simulated");
    expect(html).toContain("@binance/derivatives-trading-usds-futures");
    expect(html).toContain("binance/binance-connector-js");
    expect(html).toContain("transport_only");
    expect(html).toContain("fixture_seed_no_live_connector");
    expect(html).toContain(BINANCE_NO_AUTHORITY_LABEL);
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders Binance BTCUSDT public market and liveness posture without action controls", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: null,
            latest_private_readiness_posture: null,
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Public market posture");
    expect(html).toContain("Binance BTCUSDT public_market_liveness");
    expect(html).toContain("TRADING");
    expect(html).toContain("PERPETUAL");
    expect(html).toContain("0.10");
    expect(html).toContain("0.001");
    expect(html).toContain("100");
    expect(html).toContain("65000.12340000");
    expect(html).toContain("64995.00000000");
    expect(html).toContain("0.00010000");
    expect(html).toContain("2026-05-16T08:00:00.000Z");
    expect(html).toContain("2026-05-16T00:00:01.000Z");
    expect(html).toContain("fixture-backed");
    expect(html).toContain("@binance/derivatives-trading-usds-futures");
    expect(html).toContain("transport_only");
    expect(html).toContain("fixture_seed_no_live_connector");
    expect(html).toContain(BINANCE_NO_AUTHORITY_LABEL);
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders Binance BTCUSDT private-readiness preflight gates without action controls", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: fixturePrivateReadinessPosture(),
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private readiness preflight");
    expect(html).toContain("Binance BTCUSDT private_readiness_preflight");
    expect(html).toContain("no_binance_api_key_configured");
    expect(html).toContain("operator_live_private_read_approval_missing");
    expect(html).toContain("operator_jurisdiction_not_recorded");
    expect(html).toContain("signed_user_data_account_read_deferred");
    expect(html).toContain("listen_key_creation_forbidden_in_preflight");
    expect(html).toContain("trade_endpoint_forbidden");
    expect(html).toContain("GET /fapi/v3/account");
    expect(html).toContain("POST /fapi/v1/listenKey");
    expect(html).toContain("POST /fapi/v1/order");
    expect(html).toContain("configure_private_read_credentials");
    expect(html).toContain("Private-readiness posture");
    expect(html).toContain("Binance BTCUSDT private_readiness_posture");
    expect(html).toContain("Operator approval gate");
    expect(html).toContain("Jurisdiction / risk gate");
    expect(html).toContain("operator_live_private_read_approval_missing");
    expect(html).toContain("operator_jurisdiction_not_recorded");
    expect(html).toContain("live_binding_profile_not_configured");
    expect(html).toContain("secret_handling_profile_not_configured");
    expect(html).toContain("operator_stop_behavior_not_recorded");
    expect(html).toContain("Raw secret material");
    expect(html).toContain("false");
    expect(html).toContain("Private-readiness policy");
    expect(html).toContain("private_readiness_policy_decision");
    expect(html).toContain("USER_DATA, USER_STREAM, TRADE");
    expect(html).toContain("configuration_not_ready");
    expect(html).toContain("secret_handling_not_ready");
    expect(html).toContain("no_private_read_performed=true");
    expect(html).toContain("signed_request_authority=false");
    expect(html).toContain("transport_only");
    expect(html).toContain("fixture_seed_no_private_authority");
    expect(html).toContain(BINANCE_NO_AUTHORITY_LABEL);
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders Binance BTCUSDT account-position-risk mirror posture without action controls", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: fixturePrivateReadinessPosture(),
            latest_account_position_risk_mirror_surface: fixtureAccountPositionRiskMirrorSurface()
          }
        }}
      />
    );

    expect(html).toContain("Account position risk mirror");
    expect(html).toContain("Binance BTCUSDT account_position_risk_mirror");
    expect(html).toContain("fixture-binance-usdt-account-mirror");
    expect(html).toContain("1250.00000000");
    expect(html).toContain("1262.50000000");
    expect(html).toContain("1100.00000000");
    expect(html).toContain("0.015");
    expect(html).toContain("65000.00000000");
    expect(html).toContain("65833.33333333");
    expect(html).toContain("42000.00000000");
    expect(html).toContain("987.50000000");
    expect(html).toContain("cross");
    expect(html).toContain("watch");
    expect(html).toContain("inactive");
    expect(html).toContain("not_paused");
    expect(html).toContain("GET /fapi/v3/account");
    expect(html).toContain("GET /fapi/v3/positionRisk");
    expect(html).toContain("POST /fapi/v1/leverage");
    expect(html).toContain("POST /fapi/v1/marginType");
    expect(html).toContain("mirror_is_fixture_backed_no_signed_user_data_read");
    expect(html).toContain("fixture_seed_no_private_account_or_position_read");
    expect(html).toContain("transport_only");
    expect(html).toContain(BINANCE_NO_AUTHORITY_LABEL);
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders candidate-level latest validation state in the sidebar row and detail header", () => {
    const candidate: CandidateInspectReadModel = {
      ...fixtureCandidate,
      latest_validation_state: candidateLatestValidationState()
    };
    const rowHtml = renderToStaticMarkup(
      <CandidateSummaryRow
        active
        candidate={candidate}
        onSelectCandidate={() => undefined}
      />
    );
    const detailHtml = renderToStaticMarkup(<CandidateDetail candidate={candidate} />);

    expect(rowHtml).toContain("latest validation state: passes_replay_checks");
    expect(rowHtml).toContain("active");
    expect(detailHtml).toContain("Latest validation state");
    expect(detailHtml).toContain("Candidate latest validation state");
    expect(detailHtml).toContain("latest-replay-run");
    expect(detailHtml).toContain("baseline-replay-run");
    expect(detailHtml).toContain("validation_state_not_authority");
    expect(detailHtml).toContain("live_exchange=false, order_authority=false, credentials=false, paper_trading=false");
    expectNoOperatorActionControls(detailHtml, { includePrivateAuthorityTerms: true });
  });

  it("renders backtest, paper, and live execution mode contracts without action controls", () => {
    const html = renderToStaticMarkup(
      <TradingExecutionModesSection modes={tradingExecutionModes()} />
    );

    expect(html).toContain("Backtest / paper / live contract");
    expect(html).toContain("Backtest replay");
    expect(html).toContain("historical_replay");
    expect(html).toContain("order_validation_only");
    expect(html).toContain("Paper trading");
    expect(html).toContain("paper_order_sink");
    expect(html).toContain("paper_only");
    expect(html).toContain("Live gated trading");
    expect(html).toContain("gated_live_order_gateway");
    expect(html).toContain("live_requires_gateway");
    expect(html).toContain("TradingApiProvider");
    expect(html).toContain("forbidden");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders replay-run evidence without implying trading authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[
          replayRun({
            run_id: "s18-01-sdx-candidate-id-smoke",
            runner_kind: "docker_sandboxes_sbx",
            runner_command_total: 10
          }),
          replayRun({
            run_id: "s18-01-host-candidate-id-proof",
            runner_kind: "host_process",
            runner_command_total: 0,
            completed_at: "2026-05-13T14:51:42.271Z"
          })
        ]}
      />
    );

    expect(html).toContain("Candidate Runs");
    expect(html).toContain("Candidate-id replay evidence");
    expect(html).toContain("s18-01-sdx-candidate-id-smoke");
    expect(html).toContain("docker_sandboxes_sbx");
    expect(html).toContain("2/2 accepted");
    expect(html).toContain("Provider requests");
    expect(html).toContain("Runner commands");
    expect(html).toContain("sha256:fadd2155");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders replay-run detail evidence without adding authority actions", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[replayRun({ run_id: "replay-run-detail" })]}
        replayRunDetail={replayRunDetail({ run_id: "replay-run-detail" })}
      />
    );

    expect(html).toContain("Selected run detail");
    expect(html).toContain("replay-run-detail");
    expect(html).toContain("1 / valid_order_intent_draft");
    expect(html).toContain("live_exchange=false, order_authority=false, credentials=false, paper_trading=false");
    expect(html).toContain("promotion-detail");
    expect(html).toContain("research-detail");
    expect(html).toContain("trend_long");
    expect(html).toContain("Accepted order intent draft with score 1.000.");
    expect(html).toContain("Metric provider_boundary");
    expect(html).toContain("0.2: market/account/order validation went through the external provider");
    expect(html).toContain("sbx version");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders selectable replay-run history with non-latest detail selected", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[
          replayRun({
            run_id: "latest-run",
            runner_kind: "host_process",
            completed_at: "2026-05-14T12:00:00.000Z"
          }),
          replayRun({
            run_id: "older-sdx-run",
            runner_kind: "docker_sandboxes_sbx",
            runner_command_total: 4,
            completed_at: "2026-05-14T11:00:00.000Z"
          })
        ]}
        selectedReplayRunId="older-sdx-run"
        replayRunDetail={replayRunDetail({
          run_id: "older-sdx-run",
          runner_kind: "docker_sandboxes_sbx"
        })}
        onSelectReplayRun={() => undefined}
      />
    );

    expect(html).toContain("Latest run");
    expect(html).toContain("latest-run");
    expect(html).toContain("Selected run");
    expect(html).toContain("older-sdx-run");
    expect(html).toContain("Run history");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("docker_sandboxes_sbx");
    expect(html).toContain("Selected run detail");
    expect(html).toContain("trend_long");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders selected replay-run comparison as non-authority evidence", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[
          replayRun({
            run_id: "latest-run",
            completed_at: "2026-05-14T12:00:00.000Z"
          }),
          replayRun({
            run_id: "baseline-run",
            completed_at: "2026-05-14T11:00:00.000Z"
          })
        ]}
        selectedReplayRunId="latest-run"
        replayRunDetail={replayRunDetail({ run_id: "latest-run" })}
        replayRunComparison={replayRunComparison({
          selected: {
            ...replayRunComparison().selected,
            run_id: "latest-run"
          },
          baseline: {
            ...replayRunComparison().baseline,
            run_id: "baseline-run"
          }
        })}
        replayRunComparisonBaselineId="baseline-run"
        replayRunValidationState={replayRunValidationState({
          selected_run_id: "latest-run",
          baseline_run_id: "baseline-run"
        })}
      />
    );

    expect(html).toContain("Run comparison");
    expect(html).toContain("Selected vs baseline replay evidence");
    expect(html).toContain("improved");
    expect(html).toContain("comparison_not_authority");
    expect(html).toContain("latest-run");
    expect(html).toContain("baseline-run");
    expect(html).toContain("+0.25");
    expect(html).toContain("+1");
    expect(html).toContain("valid_order_intent_draft -&gt; valid_order_intent_draft");
    expect(html).toContain("Validation state");
    expect(html).toContain("Read-only validation state");
    expect(html).toContain("validation_state_not_authority");
    expect(html).toContain("human review of replay evidence; future promotion issue with explicit authority scope");
    expect(html).toContain("live_exchange=false, order_authority=false, credentials=false, paper_trading=false");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders no-baseline replay-run comparison state without authority actions", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[replayRun({ run_id: "single-run" })]}
        selectedReplayRunId="single-run"
        replayRunDetail={replayRunDetail({ run_id: "single-run" })}
        replayRunValidationState={replayRunBaselineRequiredPosture("single-run")}
      />
    );

    expect(html).toContain("Run comparison");
    expect(html).toContain("No comparison baseline");
    expect(html).toContain("single replay-run history");
    expect(html).toContain("comparison_not_authority");
    expect(html).toContain("Validation state");
    expect(html).toContain("comparison_required");
    expect(html).toContain("record at least one baseline replay run; compare selected run against baseline before posture review");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders promoted local candidate bundles as read-only replay candidates", () => {
    const candidate = promotedCandidate();
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidate}
        onRunCandidateReplay={() => undefined}
        replayRuns={[
          replayRun({
            candidate_id: candidate.candidate_id,
            run_id: "promoted-sdx-run",
            runner_kind: "docker_sandboxes_sbx",
            runner_command_total: 10
          })
        ]}
      />
    );

    expect(html).toContain("Promoted local candidate bundle");
    expect(html).toContain("local_promoted_candidate_bundle");
    expect(html).toContain("Trading research candidate");
    expect(html).toContain("materialized");
    expect(html).toContain("External trading API provider / Trading system");
    expect(html).toContain("docker_sandboxes_sbx");
    expect(html).toContain("Run replay");
    expect(html).toContain("host_process / replay_only / not_live");
    expect(html).toContain("No evaluation runs");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
    expect(html).not.toMatch(/Record dry-run intent|Record pause control/i);
  });

  it("renders bounded runtime authority state without implying live authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithRuntimeAuthority(runtimeAuthority())}
        onRecordRuntimeAuthority={() => undefined}
        runtimeAuthorityMessage="dry_run_only recorded: execution-attempt-001"
      />
    );

    expect(html).toContain("Runtime Authority");
    expect(html).toContain("chain complete");
    expect(html).toContain("Latest order intent draft");
    expect(html).toContain("place_order");
    expect(html).toContain("buy / limit");
    expect(html).toContain("Latest gateway decision");
    expect(html).toContain("dry_run_only");
    expect(html).toContain("paper_stage_only");
    expect(html).toContain("order_intent_draft:order-intent-draft-001");
    expect(html).toContain("Latest execution attempt");
    expect(html).toContain("gateway_decision:gateway-decision-001");
    expect(html).toContain("Record dry-run intent");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders runtime control state and bounded pause command without implying live authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithRuntimeControl(runtimeControl())}
        onRecordRuntimeControl={() => undefined}
        runtimeControlMessage="control_only recorded: runtime-control-command-001"
      />
    );

    expect(html).toContain("Runtime Control");
    expect(html).toContain("chain complete");
    expect(html).toContain("Latest control command");
    expect(html).toContain("pause");
    expect(html).toContain("human_operator");
    expect(html).toContain("Latest control decision");
    expect(html).toContain("policy_allows_control");
    expect(html).toContain("runtime_control_command:runtime-control-command-001");
    expect(html).toContain("Latest audit event");
    expect(html).toContain("runtime_lifecycle_transitioned");
    expect(html).toContain("Record pause control");
    expect(html).toContain("control_only");
    expect(html).toContain("audit_only");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
    expect(html).not.toMatch(/\bKill\b/i);
  });

  it("builds fixture-safe runtime authority command payloads", () => {
    const payload = runtimeAuthorityCommandPayload(fixtureCandidate);
    expect(payload).toMatchObject({
      candidate_version_id: fixtureCandidate.candidate_version.candidate_version_id,
      intent: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit"
      },
      gateway_decision: {
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only"
      },
      execution_attempt: {
        execution_mode: "host_local"
      }
    });
    expect(payload.idempotency_key).toContain("operator-web-runtime-authority");
    expect(JSON.stringify(payload)).not.toMatch(/exchange_credentials|live_order|broker/i);
  });

  it("builds fixture-safe runtime control pause payloads", () => {
    const payload = runtimeControlPausePayload(fixtureCandidate);
    expect(payload).toMatchObject({
      candidate_version_id: fixtureCandidate.candidate_version.candidate_version_id,
      command: {
        action: "pause",
        requested_lifecycle_status: "paused",
        actor_kind: "human_operator",
        reason: "operator_request"
      },
      decision: {
        decision_outcome: "allowed",
        decision_reason: "policy_allows_control",
        resulting_lifecycle_status: "paused"
      },
      audit_event: {
        event_kind: "runtime_lifecycle_transitioned"
      }
    });
    expect(payload.idempotency_key).toContain("operator-web-runtime-control-pause");
    expect(JSON.stringify(payload)).not.toMatch(/exchange_credentials|live_order|broker|provider_api_key/i);
  });

  it("builds replay-only replay-run payloads", () => {
    const payload = replayRunPayload();

    expect(payload).toEqual({
      runner_kind: "host_process"
    });
    expect(JSON.stringify(payload)).not.toMatch(/exchange_credentials|live_order|paper_order|broker|provider_api_key/i);
  });

  it("renders materialization attempts as provider output, not evidence", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          status: "materialized",
          display_name: "generic market Perp Breakout Candidate",
          materialization_attempt: {
            attempt_id: "candidate-materialization-attempt-001",
            idempotency_key: "codex-run-success-output-hash-001",
            provider_kind: "codex_cli",
            model: "gpt-5.4",
            agent_run_ref: { record_kind: "agent_run", id: "agent-run-codex-success-001" },
            trace_ref: { record_kind: "trace_placeholder", id: "trace-codex-success-001" },
            status: "materialized",
            validation_status: "accepted",
            resulting_candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-001" },
            artifact_refs: [{ record_kind: "provider_output_artifact", id: "codex-output-success-001" }],
            created_at: "2026-04-27T00:00:00.000Z",
            authority_label: "provider_output_not_evidence"
          }
        }}
      />
    );

    expect(html).toContain("Materialization Attempt");
    expect(html).toContain("codex_cli / gpt-5.4");
    expect(html).toContain("provider_output_not_evidence");
    expect(html).not.toMatch(/Counted evidence|Promotion approved|Live authority/);
  });

  it("renders an empty evaluation state separately from failure", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail candidate={candidateWithEvaluation(emptyEvaluation())} />
    );

    expect(html).toContain("Evaluation state");
    expect(html).toContain("empty");
    expect(html).toContain("No evaluation runs");
    expect(html).toContain("no_evaluation_runs");
    expect(html).not.toContain("evaluation_failed");
  });

  it("renders failed evaluation run state with the run error", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail candidate={candidateWithEvaluation(failedEvaluation())} />
    );

    expect(html).toContain("Evaluation state");
    expect(html).toContain("failed");
    expect(html).toContain("evaluation engine rejected metrics");
    expect(html).not.toContain("No evaluation runs");
  });

  it("renders sealed counted and rejected evidence classifications distinctly", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail candidate={candidateWithEvaluation(sealedEvaluation())} />
    );

    expect(html).toContain("sealed");
    expect(html).toContain("counted_evidence");
    expect(html).toContain("rejected_evidence");
    expect(html).toContain("sealed_counted_fixture_only_allowed_by_test");
    expect(html).toContain("partial_trace");
    expect(html).toContain("evidence_sealing_decision:fixture-sealing");
    expectNoOperatorActionControls(html);
  });
});

function candidateWithEvaluation(evaluation: CandidateEvaluationReadModel): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    evaluation
  };
}

function candidateWithRuntimeAuthority(
  boundedAuthority: ReplayRuntimeAuthorityReadModel
): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    runtime: {
      ...fixtureCandidate.runtime,
      bounded_authority: boundedAuthority
    }
  };
}

function candidateWithRuntimeControl(
  runtimeControl: ReplayRuntimeControlReadModel
): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    runtime: {
      ...fixtureCandidate.runtime,
      runtime_control: runtimeControl
    }
  };
}

function promotedCandidate(): CandidateInspectReadModel {
  const candidateId = "trading-system-candidate-8d42977b8c79";
  return {
    ...fixtureCandidate,
    candidate_id: candidateId,
    display_name: "Trading research candidate s15-02-seeded-codex-real-sdx-proof",
    status: "materialized",
    active_version_id: `${candidateId}-v1`,
    fixture_notice: {
      mode: "local_promoted_candidate_bundle",
      label: "Promoted local candidate bundle",
      statements: [
        "Read-only TradingSystemCandidate bundle promoted from Trading research.",
        "No exchange credentials or order authority are mounted.",
        "Replay-run evidence is replay-only and not counted trading authority."
      ]
    },
    candidate_version: {
      candidate_version_id: `${candidateId}-v1`,
      version_label: "trading-research-v1",
      provenance_refs: [
        { record_kind: "trading_research_notebook", id: "s15-02-seeded-codex-real-sdx-proof" },
        { record_kind: "runnable_artifact", id: "runnable-artifact-8d42977b8c79" }
      ]
    },
    spec: {
      ref: { record_kind: "trading_system_spec", id: `${candidateId}-spec` },
      summary: "Promoted from Trading research seeded-stability gate using artifact trading-system-mvp.",
      market: "External trading API provider",
      instrument: "Trading system",
      supported_stage_binding_profiles: ["backtest"]
    },
    program: {
      ref: { record_kind: "trading_system_program", id: `${candidateId}-program` },
      summary: "Minimal Trading System MVP / sha256:fadd2155",
      manifest: {
        ref: { record_kind: "program_manifest", id: "trading-system-mvp-manifest" },
        declared_runtime: "python python3 run.py",
        declared_outputs: ["program_event", "runtime_log", "metric_snapshot", "order_intent_draft"]
      },
      validation: {
        ref: { record_kind: "program_validation_record", id: `${candidateId}-validation` },
        label: "Program validation",
        status: "promoted_from_seeded_stability_gate",
        authority_status: "not_counted"
      }
    },
    capability_package: {
      ref: { record_kind: "capability_package", id: `${candidateId}-capabilities` },
      summary: "Read-only replay capability for promoted local candidate artifacts.",
      manifest: {
        ref: { record_kind: "capability_manifest", id: `${candidateId}-capabilities-manifest` },
        allowed_stages: ["backtest"],
        declared_permissions: ["trading_api_provider_v1"],
        forbidden_contents: ["exchange_credentials", "live_order_submission", "paper_order_submission"]
      },
      admission: placeholder("capability_package_admission_record", `${candidateId}-admission`, "Capability admission"),
      grant: placeholder("capability_grant", `${candidateId}-grant`, "Capability grant"),
      mount: placeholder("capability_mount_record", `${candidateId}-mount`, "Capability mount")
    },
    runtime: {
      ref: { record_kind: "trading_system_runtime", id: `${candidateId}-runtime` },
      stage_binding_profile: "backtest",
      runtime_lifecycle_status: "registered",
      authority_status: "not_live",
      placement: {
        ref: { record_kind: "runtime_placement", id: `${candidateId}-placement` },
        label: "Runtime placement",
        status: "candidate_replay_only",
        authority_status: "not_live"
      },
      hands_environment: {
        ref: { record_kind: "hands_environment", id: `${candidateId}-hands` },
        label: "Hands environment",
        status: "not_mounted",
        authority_status: "not_mounted"
      },
      memory_surface: {
        ref: { record_kind: "runtime_memory_surface", id: `${candidateId}-memory` },
        trust_class: "local_promoted_candidate_bundle",
        access_mode: "read_only",
        surface_version: "v1",
        visibility: "operator_visible",
        quarantine_status: "not_quarantined",
        authority_status: "not_evidence"
      }
    },
    trace: {
      ref: { record_kind: "trace_placeholder", id: `${candidateId}-trace` },
      label: "Trace placeholder",
      status: "source_trace_only",
      authority_status: "not_counted"
    },
    evaluation: emptyEvaluation()
  };
}

function replayRun(overrides: Partial<ReplayRunEvidenceReadModel> = {}): ReplayRunEvidenceReadModel {
  return {
    run_id: "replay-run-001",
    run_dir: "/tmp/replay-run-001",
    candidate_id: fixtureCandidate.candidate_id,
    runner_kind: "host_process",
    status: "accepted",
    run_status: "completed",
    scenario_accepted: 2,
    scenario_total: 2,
    provider_request_total: 6,
    runner_command_total: 0,
    artifact_digest: "sha256:fadd2155",
    completed_at: "2026-05-13T15:00:00.000Z",
    authority_status: "not_live",
    ...overrides
  };
}

function replayRunDetail(overrides: Partial<ReplayRunDetailReadModel> = {}): ReplayRunDetailReadModel {
  const summary = replayRun(overrides);
  return {
    ...summary,
    score: 1,
    risk_decision: "valid_order_intent_draft",
    scenario_ids: ["trend_long"],
    output_dir: "/tmp/replay-run-001/output",
    events_path: "/tmp/replay-run-001/output/replay-set.json",
    started_at: "2026-05-13T14:59:00.000Z",
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
        run_status: "completed",
        score: 1,
        risk_decision: "valid_order_intent_draft",
        summary: "Accepted order intent draft with score 1.000.",
        events_path: "/tmp/replay-run-001/output/trend_long/events.jsonl",
        provider_request_count: 3,
        runner_command_count: 1,
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
            started_at: "2026-05-13T14:59:01.000Z",
            completed_at: "2026-05-13T14:59:02.000Z"
          }
        ]
      }
    ],
    ...overrides
  };
}

function replayRunComparison(
  overrides: Partial<ReplayRunComparisonReadModel> = {}
): ReplayRunComparisonReadModel {
  return {
    candidate_id: fixtureCandidate.candidate_id,
    selected: {
      run_id: "selected-run",
      status: "accepted",
      run_status: "completed",
      score: 0.85,
      risk_decision: "valid_order_intent_draft",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 4,
      completed_at: "2026-05-14T12:00:00.000Z",
      authority_status: "not_live"
    },
    baseline: {
      run_id: "baseline-run",
      status: "accepted",
      run_status: "completed",
      score: 0.6,
      risk_decision: "valid_order_intent_draft",
      scenario_accepted: 1,
      scenario_total: 2,
      provider_request_total: 5,
      runner_command_total: 0,
      completed_at: "2026-05-14T11:00:00.000Z",
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
    verdict_reason: "selected run improved score by 0.25 and accepted scenarios by 1",
    authority_status: "not_live",
    validation_label: "comparison_not_authority",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    },
    ...overrides
  };
}

function replayRunValidationState(
  overrides: Partial<ReplayRunValidationStateReadModel> = {}
): ReplayRunValidationStateReadModel {
  return {
    candidate_id: fixtureCandidate.candidate_id,
    selected_run_id: "selected-run",
    baseline_run_id: "baseline-run",
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
    },
    ...overrides
  };
}

function replayRunBaselineRequiredPosture(selectedRunId: string): ReplayRunValidationStateReadModel {
  return {
    candidate_id: fixtureCandidate.candidate_id,
    selected_run_id: selectedRunId,
    validation_state: "comparison_required",
    reasons: [
      "no baseline run was available for evidence comparison",
      "validation state cannot advance from a single run"
    ],
    required_next_evidence: [
      "record at least one baseline replay run",
      "compare selected run against baseline before posture review"
    ],
    authority_status: "not_live",
    validation_label: "validation_state_not_authority",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    }
  };
}

function candidateLatestValidationState(
  overrides: Partial<CandidateLatestValidationStateReadModel> = {}
): CandidateLatestValidationStateReadModel {
  return {
    candidate_id: fixtureCandidate.candidate_id,
    selected_run_id: "latest-replay-run",
    baseline_run_id: "baseline-replay-run",
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
    },
    ...overrides
  };
}

function runtimeAuthority(): ReplayRuntimeAuthorityReadModel {
  return {
    has_activity: true,
    chain_complete: true,
    latest_order_intent_draft: {
      order_intent_draft_id: "order-intent-draft-001",
      intent_kind: "place_order",
      market_scope: "external_trading_api_fixture",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000",
      status: "proposed",
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "not_submitted"
    },
    latest_gateway_decision: {
      gateway_decision_id: "gateway-decision-001",
      order_intent_draft_ref: { record_kind: "order_intent_draft", id: "order-intent-draft-001" },
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      decided_at: "2026-05-10T00:00:00.000Z",
      authority_status: "dry_run_only"
    },
    latest_execution_attempt: {
      execution_attempt_id: "execution-attempt-001",
      order_intent_draft_ref: { record_kind: "order_intent_draft", id: "order-intent-draft-001" },
      gateway_decision_ref: { record_kind: "gateway_decision", id: "gateway-decision-001" },
      stage: "paper",
      execution_mode: "host_local",
      venue_scope: "external_trading_api_fixture",
      status: "dry_run_recorded",
      result_reason: "paper_stage_only",
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "dry_run_only"
    },
    order_intent_draft: {
      ref: { record_kind: "order_intent_draft", id: "order-intent-draft-001" },
      label: "Order intent draft",
      status: "proposed",
      authority_status: "not_submitted"
    },
    gateway_decision: {
      ref: { record_kind: "gateway_decision", id: "gateway-decision-001" },
      label: "Gateway decision",
      status: "dry_run_only",
      authority_status: "dry_run_only"
    },
    execution_attempt: {
      ref: { record_kind: "execution_attempt", id: "execution-attempt-001" },
      label: "Execution attempt",
      status: "dry_run_recorded",
      authority_status: "dry_run_only"
    }
  };
}

function runtimeControl(): ReplayRuntimeControlReadModel {
  return {
    has_activity: true,
    chain_complete: true,
    latest_command: {
      command_id: "runtime-control-command-001",
      action: "pause",
      requested_lifecycle_status: "paused",
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-web" },
      reason: "operator_request",
      requested_at: "2026-05-10T00:10:00.000Z",
      status: "decided",
      authority_status: "control_only"
    },
    latest_decision: {
      decision_id: "runtime-control-decision-001",
      command_ref: { record_kind: "runtime_control_command", id: "runtime-control-command-001" },
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      decided_by_actor_ref: { record_kind: "runtime_policy_engine", id: "runtime-policy-engine-fixture" },
      resulting_lifecycle_status: "paused",
      decided_at: "2026-05-10T00:10:00.000Z",
      authority_status: "control_only"
    },
    latest_audit_event: {
      audit_event_id: "runtime-audit-event-001",
      event_kind: "runtime_lifecycle_transitioned",
      command_ref: { record_kind: "runtime_control_command", id: "runtime-control-command-001" },
      decision_ref: { record_kind: "runtime_control_decision", id: "runtime-control-decision-001" },
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-web" },
      runtime_lifecycle_status: "paused",
      message: "Paper runtime paused through operator-web.",
      created_at: "2026-05-10T00:10:00.000Z",
      authority_status: "audit_only"
    },
    command: {
      ref: { record_kind: "runtime_control_command", id: "runtime-control-command-001" },
      label: "Runtime control command",
      status: "decided",
      authority_status: "control_only"
    },
    decision: {
      ref: { record_kind: "runtime_control_decision", id: "runtime-control-decision-001" },
      label: "Runtime control decision",
      status: "allowed",
      authority_status: "control_only"
    },
    audit_event: {
      ref: { record_kind: "runtime_audit_event", id: "runtime-audit-event-001" },
      label: "Runtime audit event",
      status: "runtime_lifecycle_transitioned",
      authority_status: "audit_only"
    }
  };
}

function emptyEvaluation(): CandidateEvaluationReadModel {
  return {
    ...fixtureCandidate.evaluation,
    has_runs: false,
    latest_run: null,
    latest_comparison_set: null,
    latest_sealing_decision: null,
    trace: {
      state: "none",
      trace_ref: null,
      authority_status: "not_counted",
      provider_output_artifact_refs: [],
      debug_artifact_refs: []
    },
    evidence_classifications: [],
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "no_evaluation_runs",
      authority_status: "not_counted"
    },
    error_state: null,
    run: placeholder("evaluation_run_record", "missing-eval", "Evaluation run"),
    comparison_set: placeholder("evaluation_comparison_set", "missing-comparison", "Evaluation comparison set"),
    sealing_decision: placeholder("evidence_sealing_decision", "missing-sealing", "Evidence sealing decision")
  };
}

function failedEvaluation(): CandidateEvaluationReadModel {
  return {
    ...fixtureCandidate.evaluation,
    latest_run: {
      ...fixtureCandidate.evaluation.latest_run!,
      status: "failed",
      error_state: {
        code: "evaluation_failed",
        message: "evaluation engine rejected metrics"
      }
    },
    latest_sealing_decision: {
      ...fixtureCandidate.evaluation.latest_sealing_decision!,
      evidence_disposition: "not_counted",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    },
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    },
    error_state: {
      code: "evaluation_failed",
      message: "evaluation engine rejected metrics"
    }
  };
}

function sealedEvaluation(): CandidateEvaluationReadModel {
  return {
    ...fixtureCandidate.evaluation,
    latest_run: {
      ...fixtureCandidate.evaluation.latest_run!,
      status: "succeeded",
      completed_at: "2026-05-05T00:02:00.000Z"
    },
    latest_comparison_set: {
      ...fixtureCandidate.evaluation.latest_comparison_set!,
      comparability_status: "comparable",
      comparability_reason: "fixture_only"
    },
    latest_sealing_decision: {
      ...fixtureCandidate.evaluation.latest_sealing_decision!,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      authority_status: "counted",
      sealed_at: "2026-05-05T00:03:00.000Z"
    },
    evidence_classifications: [
      {
        classification_id: "fixture-classification-counted",
        classified_ref: { record_kind: "evaluation_run_record", id: "fixture-eval" },
        classification_kind: "counted_evidence",
        classification_status: "counted",
        classification_reason: "sealed_counted_fixture_only_allowed_by_test",
        authority_status: "counted",
        sealed_by_decision_ref: { record_kind: "evidence_sealing_decision", id: "fixture-sealing" },
        created_at: "2026-05-05T00:03:00.000Z"
      },
      {
        classification_id: "fixture-classification-rejected",
        classified_ref: { record_kind: "provider_output_artifact", id: "fixture-provider-output" },
        classification_kind: "rejected_evidence",
        classification_status: "rejected",
        classification_reason: "partial_trace",
        authority_status: "not_counted",
        sealed_by_decision_ref: { record_kind: "evidence_sealing_decision", id: "fixture-sealing" },
        created_at: "2026-05-05T00:03:00.000Z"
      }
    ],
    counted_evidence: {
      counted: true,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      authority_status: "counted",
      sealed_at: "2026-05-05T00:03:00.000Z"
    }
  };
}

function tradingExecutionModes(): TradingSystemExecutionModeContractReadModel[] {
  const baseArtifactContract = {
    artifact_shape: "opaque_trading_system" as const,
    api_provider_boundary: "TradingApiProvider" as const,
    credentials_access: "forbidden" as const,
    order_submission: "forbidden" as const
  };
  const forbiddenArtifactCapabilities = ["credentials", "direct_exchange_client"];
  return [
    {
      mode: "backtest",
      label: "Backtest replay",
      support_status: "available",
      stage_binding_profile: "backtest",
      artifact_contract: baseArtifactContract,
      provider_contract: {
        market_data: "historical_replay",
        account: "simulated_account",
        order_plane: "order_validation_only",
        credentials_scope: "none_required"
      },
      authority: {
        artifact_has_credentials: false,
        artifact_has_order_authority: false,
        provider_may_submit_orders: false,
        live_exchange_authority: false,
        status: "not_live"
      },
      required_controls: ["external TradingApiProvider boundary"],
      forbidden_artifact_capabilities: forbiddenArtifactCapabilities
    },
    {
      mode: "paper",
      label: "Paper trading",
      support_status: "planned",
      stage_binding_profile: "paper",
      artifact_contract: baseArtifactContract,
      provider_contract: {
        market_data: "realtime_market_data",
        account: "paper_account",
        order_plane: "paper_order_sink",
        credentials_scope: "provider_side_only"
      },
      authority: {
        artifact_has_credentials: false,
        artifact_has_order_authority: false,
        provider_may_submit_orders: true,
        live_exchange_authority: false,
        status: "paper_only"
      },
      required_controls: ["paper account isolation"],
      forbidden_artifact_capabilities: forbiddenArtifactCapabilities
    },
    {
      mode: "live",
      label: "Live gated trading",
      support_status: "planned",
      stage_binding_profile: "live",
      artifact_contract: baseArtifactContract,
      provider_contract: {
        market_data: "realtime_market_data",
        account: "live_account",
        order_plane: "gated_live_order_gateway",
        credentials_scope: "provider_side_only"
      },
      authority: {
        artifact_has_credentials: false,
        artifact_has_order_authority: false,
        provider_may_submit_orders: true,
        live_exchange_authority: true,
        status: "live_requires_gateway"
      },
      required_controls: ["risk gateway"],
      forbidden_artifact_capabilities: forbiddenArtifactCapabilities
    }
  ];
}

const fixtureCandidate: CandidateInspectReadModel = {
  candidate_id: "fixture-candidate-sealed-replay-001",
  display_name: "Fixture generic trading-system candidate",
  status: "fixture_only",
  active_version_id: "fixture-candidate-version-001",
  fixture_notice: {
    mode: "fixture_convenience_mode",
    label: "Fixture / convenience mode",
    statements: [
      "No provider has run.",
      "No trading-system program has executed.",
      "No evaluator has run and no evidence has counted."
    ]
  },
  candidate_version: {
    candidate_version_id: "fixture-candidate-version-001",
    version_label: "fixture-v1",
    provenance_refs: [{ record_kind: "agent_run", id: "fixture-agent-run-001" }]
  },
  spec: {
    ref: { record_kind: "trading_system_spec", id: "fixture-spec" },
    summary: "Fixture spec",
    market: "ExternalTradingApiProvider",
    instrument: "generic trading instruments",
    supported_stage_binding_profiles: ["backtest", "paper", "live"]
  },
  program: {
    ref: { record_kind: "trading_system_program", id: "fixture-program" },
    summary: "Fixture program",
    manifest: {
      ref: { record_kind: "program_manifest", id: "fixture-manifest" },
      declared_runtime: "fixture-sandbox-placeholder",
      declared_outputs: ["OrderIntentDraft placeholder"]
    },
    validation: {
      ref: { record_kind: "program_validation_record", id: "fixture-validation" },
      label: "Program validation",
      status: "fixture_placeholder",
      authority_status: "not_runnable"
    }
  },
  capability_package: {
    ref: { record_kind: "capability_package", id: "fixture-package" },
    summary: "Fixture package",
    manifest: {
      ref: { record_kind: "capability_manifest", id: "fixture-capability-manifest" },
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_fixture_market_context"],
      forbidden_contents: ["exchange_credentials"]
    },
    admission: {
      ref: { record_kind: "capability_package_admission_record", id: "fixture-admission" },
      label: "Capability admission",
      status: "fixture_placeholder",
      authority_status: "not_scanned"
    },
    grant: {
      ref: { record_kind: "capability_grant", id: "fixture-grant" },
      label: "Capability grant",
      status: "fixture_placeholder",
      authority_status: "not_granted"
    },
    mount: {
      ref: { record_kind: "capability_mount_record", id: "fixture-mount" },
      label: "Capability mount",
      status: "fixture_placeholder",
      authority_status: "not_mounted"
    }
  },
  agent_provider: {
    agent_spec: placeholder("agent_spec", "fixture-agent-spec", "Agent spec"),
    agent_session: placeholder("agent_session", "fixture-agent-session", "Agent session"),
    agent_run: placeholder("agent_run", "fixture-agent-run", "Agent run"),
    agent_event: placeholder("agent_event", "fixture-agent-event", "Agent event"),
    provider_readiness: placeholder("provider_readiness_record", "fixture-readiness", "Provider readiness"),
    provider_probe_attempt: placeholder("provider_probe_attempt", "fixture-probe", "Provider probe")
  },
  runtime: {
    ref: { record_kind: "trading_system_runtime", id: "fixture-runtime" },
    stage_binding_profile: "paper",
    authority_status: "not_live",
    placement: placeholder("runtime_placement", "fixture-placement", "Runtime placement"),
    hands_environment: placeholder("hands_environment", "fixture-hands", "Hands environment"),
    memory_surface: {
      ref: { record_kind: "runtime_memory_surface", id: "fixture-memory" },
      trust_class: "fixture_context",
      access_mode: "read_only",
      surface_version: "fixture-v1",
      visibility: "operator_visible",
      quarantine_status: "not_quarantined",
      authority_status: "not_evidence"
    }
  },
  trace: placeholder("trace_placeholder", "fixture-trace", "Trace placeholder"),
  evaluation: {
    has_runs: true,
    latest_run: {
      run_id: "fixture-eval",
      status: "created",
      stage: "backtest",
      profile: "backtest",
      execution_mode: "host_local",
      trace_ref: { record_kind: "trace_placeholder", id: "fixture-trace" },
      authority_status: "not_counted",
      created_at: "2026-05-05T00:00:00.000Z",
      error_state: null
    },
    latest_comparison_set: {
      comparison_set_id: "fixture-comparison",
      stage_binding_ref: { record_kind: "stage_binding", id: "fixture-stage-binding" },
      evaluation_run_refs: [{ record_kind: "evaluation_run_record", id: "fixture-eval" }],
      comparability_status: "not_evaluated",
      comparability_reason: "no_external_evaluator",
      authority_status: "not_counted",
      created_at: "2026-05-05T00:00:00.000Z"
    },
    latest_sealing_decision: {
      sealing_decision_id: "fixture-sealing",
      evaluation_comparison_set_ref: { record_kind: "evaluation_comparison_set", id: "fixture-comparison" },
      evaluation_run_refs: [{ record_kind: "evaluation_run_record", id: "fixture-eval" }],
      evidence_disposition: "not_counted",
      disposition_reason: "no_external_evaluator",
      authority_status: "not_counted",
      created_at: "2026-05-05T00:00:00.000Z"
    },
    trace: {
      state: "linked",
      trace_ref: { record_kind: "trace_placeholder", id: "fixture-trace" },
      authority_status: "not_counted",
      provider_output_artifact_refs: [],
      debug_artifact_refs: []
    },
    evidence_classifications: [
      {
        classification_id: "fixture-classification-trace",
        classified_ref: { record_kind: "trace_placeholder", id: "fixture-trace" },
        classification_kind: "trace_debug_material",
        classification_status: "trace_only",
        classification_reason: "no_external_evaluator",
        authority_status: "not_counted",
        created_at: "2026-05-05T00:00:00.000Z"
      }
    ],
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "no_external_evaluator",
      authority_status: "not_counted"
    },
    error_state: null,
    run: placeholder("evaluation_run_record", "fixture-eval", "Evaluation run"),
    comparison_set: placeholder("evaluation_comparison_set", "fixture-comparison", "Evaluation comparison set"),
    sealing_decision: placeholder("evidence_sealing_decision", "fixture-sealing", "Evidence sealing decision")
  }
};

function placeholder(record_kind: string, id: string, label: string) {
  return {
    ref: { record_kind, id },
    label,
    status: "fixture_placeholder",
    authority_status: "not_executed"
  };
}
