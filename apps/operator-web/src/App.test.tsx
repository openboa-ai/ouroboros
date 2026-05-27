import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLedgerReadModel } from "@ouroboros/domain";
import type {
  ImprovementReadModel,
  CandidateEvaluationReadModel,
  CandidateInspectReadModel,
  CandidateLatestValidationStateReadModel,
  ReplayRunComparisonReadModel,
  ReplayRunDetailReadModel,
  ReplayRunEvidenceReadModel,
  ReplayRunValidationStateReadModel,
  LedgerSourceRecordsReadModel,
  CandidateArenaReadModel,
  RunControlReadModel,
  TradingGatewayEnvironmentReadModel,
  TradingSystemExecutionModeContractReadModel
} from "@ouroboros/domain";
import {
  BINANCE_NO_AUTHORITY_LABEL,
  expectNoOperatorActionControls,
  fixtureAccountPositionRiskMirrorSurface,
  fixtureOrderFillSurface,
  fixturePrivateReadGateDecision,
  fixturePrivateReadinessPolicyDecision,
  fixturePrivateReadinessPosture,
  fixturePrivateReadinessPreflightSurface,
  fixturePublicMarketLivenessSurface,
  fixtureTradingGatewayContract,
  ref
} from "../../../test/support/binance-no-authority";
import {
  badgeVariant,
  CandidateArenaPanel,
  CandidateDetail,
  CandidateSummaryRow,
  isPositiveRiskDecision,
  PrivateReadinessReviewPacketSections,
  TradingGatewayEnvironmentSection,
  TradingExecutionModesSection
} from "./App";
import {
  privateReadinessPostureDraftFromCandidate,
  privateReadinessPosturePayload,
  replayRunPayload,
  ledgerCommandPayload,
  runControlPausePayload,
  fetchOperatorReadModel,
  runCandidateArenaCommand,
  runPaperEvidenceForCandidate,
  type FullCycleOutcome,
  type TradingResearchRuntimeReadModel
} from "./api";
import { buildPrivateReadinessReviewPacketProjection } from "./private-readiness-review-packet";

describe("operator status helpers", () => {
  it("matches positive replay risk decisions without accepting invalid values by substring", () => {
    expect(isPositiveRiskDecision("valid_order_request")).toBe(true);
    expect(isPositiveRiskDecision("passes_replay_checks")).toBe(true);
    expect(isPositiveRiskDecision("invalid_order_request")).toBe(false);
    expect(isPositiveRiskDecision("no_order_request")).toBe(false);
    expect(isPositiveRiskDecision("not_ready")).toBe(false);
  });

  it("does not style incomplete status badges as successful", () => {
    expect(badgeVariant("complete")).toBe("default");
    expect(badgeVariant("chain complete")).toBe("default");
    expect(badgeVariant("incomplete")).toBe("outline");
    expect(badgeVariant("chain incomplete")).toBe("outline");
    expect(badgeVariant("invalid_order_request")).toBe("destructive");
  });
});

describe("operator command API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches arena actions through the shared command endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      command: {
        command_kind: "arena.tick",
        status: "succeeded"
      },
      operator: {
        candidate_arena: fixtureCandidateArena
      }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const arena = await runCandidateArenaCommand("tick");

    expect(arena).toBe(fixtureCandidateArena);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4173/api/commands",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command_kind: "arena.tick" })
      }
    );
  });

  it("dispatches selected candidate paper evidence through the shared command endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      command: {
        command_kind: "candidate.paper_evidence.run",
        status: "succeeded"
      },
      operator: {
        selected_candidate_id: "candidate-profitable",
        selected_candidate: arenaSelectedCandidate(),
        selected_paper_evidence: {
          status: "ledger_chain_complete",
          ledger_chain_complete: true,
          ledger_chain_count: 1,
          authority_status: "not_live"
        }
      }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runPaperEvidenceForCandidate("candidate-profitable");

    expect(outcome.selected_paper_evidence.status).toBe("ledger_chain_complete");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4173/api/commands",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          command_kind: "candidate.paper_evidence.run",
          payload: { candidate_id: "candidate-profitable" }
        })
      }
    );
  });

  it("reads the shared operator model for UI state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      operator: {
        candidate_arena: fixtureCandidateArena,
        selected_candidate_id: "candidate-profitable",
        selected_candidate: arenaSelectedCandidate(),
        selected_paper_evidence: {
          status: "not_run",
          ledger_chain_complete: false,
          authority_status: "not_live"
        },
        researcher_provider: {
          selected_provider: "fixture",
          available_providers: ["codex", "fixture"],
          authority_status: "research_only"
        },
        agent_profiles: [],
        latest_commands: [],
        authority_status: "not_live",
        live_disabled: true
      }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const operator = await fetchOperatorReadModel();

    expect(operator.selected_candidate_id).toBe("candidate-profitable");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4173/api/operator");
  });
});

describe("CandidateDetail", () => {
  it("renders Candidate Arena leaderboard around net revenue without fixture controls", () => {
    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={fixtureCandidateArena}
        selectedCandidateId="candidate-profitable"
        selectedCandidate={arenaSelectedCandidate()}
        researcherProvider={{
          selected_provider: "codex",
          available_providers: ["codex", "fixture"],
          authority_status: "research_only"
        }}
        agentProfiles={[{
          profile_id: "codex",
          label: "Codex",
          provider: "codex",
          status: "authenticated",
          managed_home: "/tmp/ouroboros/agent-profiles/codex/home",
          managed_provider_home: "/tmp/ouroboros/agent-profiles/codex/codex-home",
          authority_status: "no_trading_authority"
        }]}
        latestCommands={[{
          command_id: "command-1",
          command_kind: "arena.tick",
          status: "succeeded",
          requested_at: "2026-05-27T00:00:00.000Z",
          completed_at: "2026-05-27T00:00:01.000Z",
          authority_status: "not_live"
        }]}
        selectedPaperEvidence={{
          status: "not_run",
          ledger_chain_complete: false,
          authority_status: "not_live"
        }}
        onStart={() => undefined}
        onStop={() => undefined}
        onTick={() => undefined}
        onSelectCandidate={() => undefined}
        onRunPaperEvidence={() => undefined}
        actionPending={false}
        runningPaperEvidence={false}
      />
    );

    expect(html).toContain("Candidate Arena");
    expect(html).toContain("Operator cockpit");
    expect(html).toContain("Runtime command bar");
    expect(html).toContain("Revenue-cost leaderboard");
    expect(html).toContain("running");
    expect(html).toContain("Net revenue");
    expect(html).toContain("Net return");
    expect(html).toContain("trend_following");
    expect(html).toContain("9.83 USDT");
    expect(html).toContain("0.0983%");
    expect(html).toContain("Start");
    expect(html).toContain("Stop");
    expect(html).toContain("Selected candidate");
    expect(html).toContain("SystemCode");
    expect(html).toContain("Evaluation");
    expect(html).toContain("profit_loss");
    expect(html).toContain("Lineage");
    expect(html).toContain("Run paper evidence");
    expect(html).toContain("Agent providers");
    expect(html).toContain("Codex");
    expect(html).toContain("Command log");
    expect(html).toContain("arena.tick");
    expect(html).toContain("Latest ticks");
    expect(html).toContain("completed");
    expect(html).not.toContain("Fixture");
    expect(html).not.toContain("Research iterations");
  });

  it("keeps selected arena candidate paper evidence available before Ledger exists", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={arenaSelectedCandidate()}
        candidateArena={fixtureCandidateArena}
        onSelectCandidate={() => undefined}
        onStartTradingRun={() => undefined}
        runningTradingRun={false}
      />
    );

    expect(html).toContain("Selected candidate");
    expect(html).toContain("Run paper evidence");
    expect(html).toContain("Paper evidence");
    expect(html).toContain("not run");
    expect(html).not.toContain("Research iterations");
  });

  it("treats an empty selected candidate Ledger as paper evidence not run", () => {
    const selectedCandidate = arenaSelectedCandidate({
      ledger: buildLedgerReadModel(emptyLedgerSourceRecords()),
      runtime: {
        ...arenaSelectedCandidate().runtime,
        runtime_lifecycle_status: "registered"
      },
      trading_run: {
        ref: { record_kind: "trading_run", id: "arena-trading-run-placeholder" },
        stage: "paper",
        lifecycle_status: "registered",
        authority_status: "not_live"
      }
    });

    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={fixtureCandidateArena}
        selectedCandidateId="candidate-profitable"
        selectedCandidate={selectedCandidate}
        onStart={() => undefined}
        onStop={() => undefined}
        onTick={() => undefined}
        onSelectCandidate={() => undefined}
        onRunPaperEvidence={() => undefined}
        actionPending={false}
        runningPaperEvidence={false}
      />
    );

    expect(html).toContain("Paper evidence");
    expect(html).toContain("not run");
    expect(html).toContain("TradingRun");
    expect(html).not.toContain("0 Ledger chains");
    expect(html).not.toContain("registered");
  });

  it("shows selected candidate Ledger chain summary after paper evidence completes", () => {
    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={fixtureCandidateArena}
        selectedCandidateId="candidate-profitable"
        selectedCandidate={arenaSelectedCandidate({
          ledger: buildLedgerReadModel(ledgerSourceRecords()),
          trading_run: {
            ref: { record_kind: "trading_run", id: "arena-trading-run-complete" },
            stage: "paper",
            lifecycle_status: "stopped",
            authority_status: "not_live"
          }
        })}
        onStart={() => undefined}
        onStop={() => undefined}
        onTick={() => undefined}
        onSelectCandidate={() => undefined}
        onRunPaperEvidence={() => undefined}
        actionPending={false}
        runningPaperEvidence={false}
      />
    );

    expect(html).toContain("Paper evidence");
    expect(html).toContain("Ledger chain complete");
    expect(html).toContain("TradingRun");
    expect(html).toContain("stopped");
    expect(html).toContain("OrderRequest");
    expect(html).toContain("buy limit 0.001");
    expect(html).toContain("GatewayResult");
    expect(html).toContain("dry_run_only");
    expect(html).toContain("ExecutionResult");
    expect(html).toContain("dry_run_recorded");
  });

  it("renders fixture labels and inspect sections without action controls", () => {
    const html = renderToStaticMarkup(<CandidateDetail candidate={fixtureCandidate} />);

    expect(html).toContain("Fixture / convenience mode");
    expect(html).toContain("fixture_convenience_mode");
    expect(html).toContain("No provider has run.");
    expect(html).toContain("Capability Package");
    expect(html).toContain("Agent And Provider");
    expect(html).toContain("Ledger");
    expect(html).toContain("Run Control");
    expect(html).toContain("Candidate Runs");
    expect(html).toContain("No candidate-id replay runs");
    expect(html).toContain("Trading run state");
    expect(html).toContain("Request / decision / result");
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
            private_readiness_posture_history: [],
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
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true
    });
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
            private_readiness_posture_history: [],
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
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true
    });
  });

  it("renders Binance BTCUSDT private-readiness preflight gates without action controls", () => {
    const localPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-002",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:08.000Z",
      operator_approval_gate: {
        status: "ready",
        reason: "operator_approval_recorded_in_local_history"
      }
    });
    const secretReference = ref(
      "secret_reference",
      "local-binance-btcusdt-user-data-read-reference"
    );
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: localPosture,
            private_readiness_posture_history: [
              localPosture,
              fixturePrivateReadinessPosture()
            ],
            latest_trading_gateway_contract: fixtureTradingGatewayContract(),
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_private_read_gate_decision: fixturePrivateReadGateDecision({
              credential_reference_status: "reference_only",
              credential_reference_source: "private_readiness_posture",
              credential_reference_ref: secretReference,
              signed_read_permission_preflight_status: "preflight_only",
              signed_read_permission_preflight_source: "policy_decision",
              signed_request_construction_boundary_status: "dry_run_only",
              signed_request_construction_boundary_source: "policy_decision",
              signed_request_construction_required_components: [
                "API key",
                "timestamp",
                "recvWindow",
                "query string",
                "signature",
                "signed endpoint"
              ],
              signed_read_permission_grant_boundary_status: "decision_only",
              signed_read_permission_grant_boundary_source: "policy_decision",
              signed_request_execution_boundary_status: "decision_only",
              signed_request_execution_boundary_source: "policy_decision",
              account_balance_position_read_boundary_status: "decision_only",
              account_balance_position_read_boundary_source: "policy_decision"
            }),
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
    expect(html).toContain("Recent posture history");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-002");
    expect(html).toContain("local_config / 2026-05-16T00:00:08.000Z");
    expect(html).toContain("operator=ready, jurisdiction=review_required");
    expect(html).toContain("Posture delta summary");
    expect(html).toContain("Current posture");
    expect(html).toContain("Previous posture");
    expect(html).toContain("fixture-binance-btcusdt-private-readiness-posture-001");
    expect(html).toContain("1 changed gate");
    expect(html).toContain("Operator approval: not_ready -&gt; ready");
    expect(html).toContain(
      "reason operator_live_private_read_approval_missing -&gt; operator_approval_recorded_in_local_history"
    );
    expect(html).toContain("local_config_delta_inspection_only");
    expect(html).toContain("not_counted_evidence_or_promotion");
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
    expect(html).toContain("Trading gateway contract");
    expect(html).toContain("TradingGateway");
    expect(html).toContain("sandbox_direct_exchange_access=false");
    expect(html).toContain("USER_DATA, TRADE");
    expect(html).toContain("order_request -&gt; gateway_result -&gt; execution_result");
    expect(html).toContain("GET /fapi/v3/account, GET /fapi/v3/positionRisk");
    expect(html).toContain("POST /fapi/v1/order");
    expect(html).toContain("gateway_required=true, authority=not_granted");
    expect(html).toContain("Private-read gate");
    expect(html.indexOf("Trading gateway contract")).toBeLessThan(
      html.indexOf("Private-read gate")
    );
    expect(html).toContain("private_read_gate_decision");
    expect(html).toContain("Gate status");
    expect(html).toContain("not_ready");
    expect(html).toContain("Credential reference");
    expect(html).toContain("reference_only");
    expect(html).toContain("Credential reference source");
    expect(html).toContain("private_readiness_posture");
    expect(html).toContain("Credential reference ref");
    expect(html).toContain("secret_reference:local-binance-btcusdt-user-data-read-reference");
    expect(html).toContain("Signed-read preflight");
    expect(html).toContain("USER_DATA=preflight_only");
    expect(html).toContain("policy_decision");
    expect(html).toContain("Signed request construction");
    expect(html).toContain("USER_DATA=dry_run_only");
    expect(html).toContain("API key, timestamp, recvWindow, query string, signature, signed endpoint");
    expect(html).toContain("Signed-read grant boundary");
    expect(html).toContain("USER_DATA=decision_only");
    expect(html).toContain("Signed request execution boundary");
    expect(html).toContain("Account / balance / position read boundary");
    expect(html).toContain("USER_DATA=not_granted");
    expect(html).toContain("USER_STREAM=not_granted");
    expect(html).toContain("TRADE=not_granted");
    expect(html).toContain("gateway=not_granted, evidence=not_counted, promotion=not_granted");
    expect(html).toContain("private_read_gate_no_secret_not_live");
    expect(html).toContain("Private-readiness review packet index");
    expect(html).toContain("review_packet_index_ready_for_operator_scan");
    expect(html).toContain("01 policy_impact_interpretation");
    expect(html).toContain("02 posture_delta_summary");
    expect(html).toContain("03 review_handoff");
    expect(html).toContain("04 authority_gate_preview");
    expect(html).toContain("05 checked_gate_matrix");
    expect(html).toContain("06 remediation_action_map");
    expect(html).toContain("07 remediation_progress_summary");
    expect(html.indexOf("01 policy_impact_interpretation")).toBeLessThan(
      html.indexOf("02 posture_delta_summary")
    );
    expect(html.indexOf("02 posture_delta_summary")).toBeLessThan(html.indexOf("03 review_handoff"));
    expect(html.indexOf("03 review_handoff")).toBeLessThan(html.indexOf("04 authority_gate_preview"));
    expect(html.indexOf("04 authority_gate_preview")).toBeLessThan(html.indexOf("05 checked_gate_matrix"));
    expect(html.indexOf("05 checked_gate_matrix")).toBeLessThan(html.indexOf("06 remediation_action_map"));
    expect(html.indexOf("06 remediation_action_map")).toBeLessThan(
      html.indexOf("07 remediation_progress_summary")
    );
    expect(html).toContain("review_packet_index_navigation_only");
    expect(html).toContain("Private-readiness review packet availability summary");
    expect(html).toContain(
      "availability_summary=available_for_review=7, needs_posture_context=0, no_current_items=0, policy_context_available=0"
    );
    expect(html).toContain("policy_input_posture_available");
    expect(html).toContain("posture_delta_current_and_previous_available");
    expect(html).toContain("review_handoff_context_available");
    expect(html).toContain("authority_gate_preview_context_available");
    expect(html).toContain("checked_gates=11");
    expect(html).toContain("required_next_actions=6");
    expect(html).toContain("remediation_progress_actions_present");
    expect(html).toContain("review_packet_availability_summary_navigation_only");
    expect(html).toContain("Private-readiness review packet gap summary");
    expect(html).toContain(
      "gap_summary=needs_posture_context=0, no_current_items=0, policy_context_available=0"
    );
    expect(html).toContain(
      "next_gap_focus=configure_private_read_credentials -&gt; checked_gate: configuration"
    );
    expect(html).toContain("review_packet_remediation_focus_present");
    expect(html).toContain("review_packet_gap_summary_navigation_only");
    expect(html).toContain("Private-readiness review packet resolution checklist");
    expect(html).toContain(
      "resolution_checklist=availability_gaps=0, remediation_actions=6, policy_context_available=0, total_items=6"
    );
    expect(html).toContain(
      "next_resolution_focus=configure_private_read_credentials -&gt; checked_gate: configuration"
    );
    expect(html).toContain("resolution_checklist_remediation_actions_present");
    expect(html).toContain("resolve_required_next_action");
    expect(html).toContain("read_only_resolution_guidance");
    expect(html).toContain("review_packet_resolution_checklist_navigation_only");
    expect(html).toContain("Private-readiness review packet source/provenance summary");
    expect(html).toContain(
      "source_provenance=policy_refs=2, posture_refs=1, previous_posture_refs=1, projection_rows=7"
    );
    expect(html).toContain(
      "next_source_focus=01 policy_impact_interpretation -&gt; PrivateReadinessPolicyDecision.source_surface_refs"
    );
    expect(html).toContain("source_provenance_posture_context_available");
    expect(html).toContain("read_only_source_provenance_context");
    expect(html).toContain("review_packet_source_provenance_navigation_only");
    expect(html).toContain("Private-readiness review packet completion/readiness summary");
    expect(html).toContain(
      "completion_readiness=review_surfaces=7, availability_gaps=0, source_gaps=0, resolution_items=6, remediation_actions=6"
    );
    expect(html).toContain(
      "next_completion_focus=configure_private_read_credentials -&gt; checked_gate: configuration"
    );
    expect(html).toContain("completion_readiness_remediation_actions_present");
    expect(html).toContain("read_only_completion_readiness_context");
    expect(html).toContain("review_packet_completion_readiness_navigation_only");
    expect(html.indexOf("Private-readiness review packet completion/readiness summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet index")
    );
    expect(html.indexOf("Private-readiness review packet index")).toBeLessThan(
      html.indexOf("Private-readiness review packet availability summary")
    );
    expect(html.indexOf("Private-readiness review packet availability summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet gap summary")
    );
    expect(html.indexOf("Private-readiness review packet gap summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet resolution checklist")
    );
    expect(html.indexOf("Private-readiness review packet resolution checklist")).toBeLessThan(
      html.indexOf("Private-readiness review packet source/provenance summary")
    );
    expect(html).toContain("Policy impact interpretation");
    expect(html).toContain("Policy input posture");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-002");
    expect(html).toContain("History role");
    expect(html).toContain("inspection_context_only");
    expect(html).toContain("Policy impact");
    expect(html).toContain("status=not_ready");
    expect(html).toContain("local_config_inspection_not_counted_evidence_or_promotion");
    expect(html).toContain("No-authority proof");
    expect(html).toContain("authority_status=not_live");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expect(html).toContain("Private-readiness review handoff");
    expect(html).toContain("Review scope");
    expect(html).toContain("binance_usd_m_futures / BTCUSDT / perpetual_futures");
    expect(html).toContain("Latest posture");
    expect(html).toContain("Posture delta");
    expect(html).toContain("previous=fixture-binance-btcusdt-private-readiness-posture-001, 1 changed gate");
    expect(html).toContain("Policy summary");
    expect(html).toContain("status=not_ready, blocking_conditions=5, required_next_actions=6");
    expect(html).toContain("Required next actions");
    expect(html).toContain("configure_private_read_credentials, configuration, operator_approval, +3 more");
    expect(html).toContain("Review checklist");
    expect(html).toContain(
      "inspect_latest_posture, review_posture_delta, review_policy_impact, resolve_required_next_actions, keep_no_authority_boundary"
    );
    expect(html).toContain("review_handoff_only_not_counted_evidence_or_promotion");
    expect(html).toContain("Private-readiness authority gate preview");
    expect(html).toContain("Private-read authority");
    expect(html).toContain("private_read_authority=not_granted, policy_status=not_ready, authority_status=not_live");
    expect(html).toContain("Gate readiness");
    expect(html).toContain("ready=2, not_ready=8, review_required=1, blocked=0");
    expect(html).toContain("Blocking conditions");
    expect(html).toContain(
      "configuration: no_binance_api_key_configured, operator_approval: operator_live_private_read_approval_missing, jurisdiction_risk: operator_jurisdiction_not_recorded, +2 more"
    );
    expect(html).toContain("Preview next step");
    expect(html).toContain("resolve_blocking_conditions, complete_required_next_actions, keep_authority_status_not_live");
    expect(html).toContain("authority_gate_preview_only_not_private_read_permission_or_execution_authority");
    expect(html).toContain("Private-readiness checked-gate matrix");
    expect(html).toContain("configuration");
    expect(html).toContain("not_ready");
    expect(html).toContain("configuration_not_ready");
    expect(html).toContain("no_binance_api_key_configured");
    expect(html).toContain("blocking_gate");
    expect(html).toContain("jurisdiction_risk");
    expect(html).toContain("jurisdiction_review_required");
    expect(html).toContain("review_required_gate");
    expect(html).toContain("kill_switch");
    expect(html).toContain("ready_gate");
    expect(html).toContain("checked_gate_matrix_inspection_only");
    expect(html).toContain("Private-readiness remediation/action map");
    expect(html).toContain("configure_private_read_credentials");
    expect(html).toContain("checked_gate: configuration");
    expect(html).toContain("not_ready / blocking_gate");
    expect(html).toContain("configuration_not_ready");
    expect(html).toContain("read_only_remediation_guidance");
    expect(html).toContain("remediation_action_map_guidance_only");
    expect(html).toContain("Private-readiness remediation progress summary");
    expect(html).toContain("required_actions=6, mapped_actions=6, unmapped_actions=0");
    expect(html).toContain("blocking_review_focus=6");
    expect(html).toContain("next_review_focus=configure_private_read_credentials -&gt; checked_gate: configuration");
    expect(html).toContain("remediation_progress_summary_guidance_only");
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

  it("renders an empty checked-gate matrix from a policy decision without posture context", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: null,
            private_readiness_posture_history: [],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision({
              checked_gates: [],
              reason_codes: ["no_private_read_performed"],
              blocking_conditions: [],
              required_next_actions: []
            }),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private-readiness checked-gate matrix");
    expect(html).toContain("Private-readiness review packet index");
    expect(html).toContain("review_packet_index_policy_only_posture_context_missing");
    expect(html).toContain("01 policy_impact_interpretation");
    expect(html).toContain("07 remediation_progress_summary");
    expect(html).toContain("review_packet_index_navigation_only");
    expect(html).toContain("Private-readiness review packet availability summary");
    expect(html).toContain(
      "availability_summary=available_for_review=0, needs_posture_context=3, no_current_items=3, policy_context_available=1"
    );
    expect(html).toContain("policy_decision_available_posture_input_missing");
    expect(html).toContain("latest_posture_required_for_delta");
    expect(html).toContain("latest_posture_required_for_review_handoff");
    expect(html).toContain("latest_posture_required_for_authority_preview");
    expect(html).toContain("checked_gates_empty");
    expect(html).toContain("required_next_actions_empty");
    expect(html).toContain("review_packet_availability_summary_navigation_only");
    expect(html).toContain("Private-readiness review packet gap summary");
    expect(html).toContain(
      "gap_summary=needs_posture_context=3, no_current_items=3, policy_context_available=1"
    );
    expect(html).toContain(
      "next_gap_focus=02 posture_delta_summary -&gt; latest_posture_required_for_delta"
    );
    expect(html).toContain("review_packet_availability_gaps_present");
    expect(html).toContain("review_packet_gap_summary_navigation_only");
    expect(html).toContain("Private-readiness review packet resolution checklist");
    expect(html).toContain(
      "resolution_checklist=availability_gaps=6, remediation_actions=0, policy_context_available=1, total_items=6"
    );
    expect(html).toContain(
      "next_resolution_focus=02 posture_delta_summary -&gt; latest_posture_required_for_delta"
    );
    expect(html).toContain("resolution_checklist_availability_gaps_present");
    expect(html).toContain("requires_posture_context");
    expect(html).toContain("confirm_empty_review_state");
    expect(html).toContain("review_packet_resolution_checklist_navigation_only");
    expect(html).toContain("Private-readiness review packet source/provenance summary");
    expect(html).toContain(
      "source_provenance=policy_refs=2, posture_refs=0, previous_posture_refs=0, projection_rows=7"
    );
    expect(html).toContain(
      "next_source_focus=02 posture_delta_summary -&gt; private_readiness_posture_history"
    );
    expect(html).toContain("source_provenance_policy_only_posture_context_missing");
    expect(html).toContain("latest_posture_not_available");
    expect(html).toContain("review_packet_source_provenance_navigation_only");
    expect(html).toContain("Private-readiness review packet completion/readiness summary");
    expect(html).toContain(
      "completion_readiness=review_surfaces=7, availability_gaps=6, source_gaps=2, resolution_items=6, remediation_actions=0"
    );
    expect(html).toContain(
      "next_completion_focus=02 posture_delta_summary -&gt; latest_posture_required_for_delta"
    );
    expect(html).toContain("completion_readiness_policy_only_posture_context_missing");
    expect(html).toContain("read_only_completion_readiness_context");
    expect(html).toContain("review_packet_completion_readiness_navigation_only");
    expect(html.indexOf("Private-readiness review packet completion/readiness summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet index")
    );
    expect(html.indexOf("Private-readiness review packet index")).toBeLessThan(
      html.indexOf("Private-readiness review packet availability summary")
    );
    expect(html.indexOf("Private-readiness review packet availability summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet gap summary")
    );
    expect(html.indexOf("Private-readiness review packet gap summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet resolution checklist")
    );
    expect(html.indexOf("Private-readiness review packet resolution checklist")).toBeLessThan(
      html.indexOf("Private-readiness review packet source/provenance summary")
    );
    expect(html).toContain("no_checked_gates");
    expect(html).toContain("Private-readiness remediation/action map");
    expect(html).toContain("no_required_next_actions");
    expect(html).toContain("Private-readiness remediation progress summary");
    expect(html).toContain("required_actions=0, mapped_actions=0, unmapped_actions=0");
    expect(html).toContain("blocking_review_focus=0");
    expect(html).toContain("next_review_focus=no_required_next_actions");
    expect(html).toContain("no_remediation_progress_actions");
    expect(html).toContain("remediation_action_map_guidance_only");
    expect(html).toContain("checked_gate_matrix_inspection_only");
    expect(html).toContain("not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders unmatched private-readiness remediation actions without authority controls", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: null,
            private_readiness_posture_history: [],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision({
              blocking_conditions: ["configuration: no_binance_api_key_configured"],
              required_next_actions: ["manual_tax_review"]
            }),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private-readiness remediation/action map");
    expect(html).toContain("manual_tax_review");
    expect(html).toContain("unmapped_action");
    expect(html).toContain("no_matching_gate_or_blocker");
    expect(html).toContain("read_only_remediation_guidance");
    expect(html).toContain("Private-readiness remediation progress summary");
    expect(html).toContain("required_actions=1, mapped_actions=0, unmapped_actions=1");
    expect(html).toContain("blocking_review_focus=0");
    expect(html).toContain("next_review_focus=manual_tax_review -&gt; unmapped_action");
    expect(html).toContain("remediation_action_map_guidance_only");
    expect(html).toContain("remediation_progress_summary_guidance_only");
    expect(html).toContain("not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders the review packet section stack from its projection without the full candidate detail", () => {
    const projection = buildPrivateReadinessReviewPacketProjection({
      decision: fixturePrivateReadinessPolicyDecision(),
      posture: fixturePrivateReadinessPosture({
        posture_id: "local-binance-btcusdt-private-readiness-posture-history-002"
      }),
      previousPosture: fixturePrivateReadinessPosture()
    });
    const html = renderToStaticMarkup(
      <PrivateReadinessReviewPacketSections
        postureContextAvailable
        projection={projection}
      />
    );

    expect(html).toContain("Private-readiness review packet completion/readiness summary");
    expect(html).toContain("Private-readiness review packet index");
    expect(html).toContain("Private-readiness review packet availability summary");
    expect(html).toContain("Private-readiness review packet gap summary");
    expect(html).toContain("Private-readiness review packet resolution checklist");
    expect(html).toContain("Private-readiness review packet source/provenance summary");
    expect(html).toContain("completion_readiness_remediation_actions_present");
    expect(html).toContain("review_packet_index_ready_for_operator_scan");
    expect(html).toContain("review_packet_source_provenance_navigation_only");
    expect(html).toContain("not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expect(html.indexOf("Private-readiness review packet completion/readiness summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet index")
    );
    expect(html.indexOf("Private-readiness review packet index")).toBeLessThan(
      html.indexOf("Private-readiness review packet availability summary")
    );
    expect(html.indexOf("Private-readiness review packet availability summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet gap summary")
    );
    expect(html.indexOf("Private-readiness review packet gap summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet resolution checklist")
    );
    expect(html.indexOf("Private-readiness review packet resolution checklist")).toBeLessThan(
      html.indexOf("Private-readiness review packet source/provenance summary")
    );
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders an unchanged posture delta summary without action controls", () => {
    const currentPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-003",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:10.000Z"
    });
    const previousPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-002",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:08.000Z"
    });
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: currentPosture,
            private_readiness_posture_history: [
              currentPosture,
              previousPosture
            ],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Posture delta summary");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-003");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-002");
    expect(html).toContain("0 changed gates");
    expect(html).toContain("Gate changes");
    expect(html).toContain("none");
    expect(html).toContain("local_config_delta_inspection_only");
    expect(html).toContain("not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders a private-readiness review handoff without previous posture history", () => {
    const localPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-004",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:12.000Z"
    });
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: localPosture,
            private_readiness_posture_history: [localPosture],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private-readiness review handoff");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-004");
    expect(html).toContain("previous_posture_not_available");
    expect(html).toContain("record_previous_posture_before_delta_review");
    expect(html).toContain("review_handoff_only_not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders an authority gate preview with no blocking conditions or next actions", () => {
    const localPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-005",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:14.000Z"
    });
    const basePolicyDecision = fixturePrivateReadinessPolicyDecision();
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: localPosture,
            private_readiness_posture_history: [localPosture],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision({
              status: "ready",
              checked_gates: basePolicyDecision.checked_gates.map((gate) => ({
                ...gate,
                status: "ready" as const,
                reason_code: "ready" as const,
                reason: "ready_for_preview"
              })),
              reason_codes: ["ready", "no_private_read_performed"],
              blocking_conditions: [],
              required_next_actions: []
            }),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private-readiness authority gate preview");
    expect(html).toContain("private_read_authority=not_granted, policy_status=ready, authority_status=not_live");
    expect(html).toContain("ready=11, not_ready=0, review_required=0, blocked=0");
    expect(html).toContain("No blocking conditions");
    expect(html).toContain("none");
    expect(html).toContain("Required next actions");
    expect(html).toContain("no_blocking_conditions, no_required_next_actions, keep_authority_status_not_live");
    expect(html).toContain("authority_gate_preview_only_not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders a local private-readiness posture edit form without live authority language", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: fixturePrivateReadinessPosture(),
            private_readiness_posture_history: [fixturePrivateReadinessPosture()],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_account_position_risk_mirror_surface: null
          }
        }}
        onRecordPrivateReadinessPosture={() => undefined}
        privateReadinessPostureMessage="local_config recorded: local-binance-btcusdt-private-readiness-posture-001"
      />
    );

    expect(html).toContain("Local posture edit");
    expect(html).toContain("Operator approval");
    expect(html).toContain("Jurisdiction / risk");
    expect(html).toContain("Live binding");
    expect(html).toContain("Secret handling");
    expect(html).toContain("Stop behavior");
    expect(html).toContain("Save local posture");
    expect(html).toContain("local_config / no_secret / not_live");
    expect(html).toContain("local_config recorded: local-binance-btcusdt-private-readiness-posture-001");
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
            private_readiness_posture_history: [fixturePrivateReadinessPosture()],
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
    expect(html).toContain("Live disabled");
    expect(html).toContain("gated_live_order_gateway");
    expect(html).toContain("live_disabled");
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
    expect(html).toContain("1 / valid_order_request");
    expect(html).toContain("live_exchange=false, order_authority=false, credentials=false, paper_trading=false");
    expect(html).toContain("promotion-detail");
    expect(html).toContain("research-detail");
    expect(html).toContain("trend_long");
    expect(html).toContain("Accepted order request with score 1.000.");
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
    expect(html).toContain("valid_order_request -&gt; valid_order_request");
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
    expect(html).toContain("Trading System bundle");
    expect(html).toContain("materialized");
    expect(html).toContain("External trading API provider / Trading system");
    expect(html).toContain("docker_sandboxes_sbx");
    expect(html).toContain("Run replay");
    expect(html).toContain("host_process / replay_only / not_live");
    expect(html).toContain("No evaluation runs");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
    expect(html).not.toMatch(/Run trading loop|Record pause control/i);
  });

  it("renders Ledger state without implying live authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))}
        tradingGatewayEnvironment={tradingGatewayEnvironment()}
        onStartTradingRun={() => undefined}
        onObserveTradingRun={() => undefined}
        onStopTradingRun={() => undefined}
        tradingRunMessage="dry_run_only recorded: execution-result-001"
      />
    );

    expect(html).toContain("Trading gateway environment");
    expect(html).toContain("paper / mlp_policy");
    expect(html).toContain("Gateway locked / runtime_binding_policy");
    expect(html).toContain("https://fapi.binance.com");
    expect(html).toContain("fake_paper_account");
    expect(html).toContain("fake_paper_order_executor");
    expect(html).toContain("live_gateway_not_enabled_in_mlp");
    expect(html).toContain("api_key=true");
    expect(html).toContain("api_secret=true");
    expect(html).toContain("live_exchange=false");
    expect(html).toContain("Ledger");
    expect(html).toContain("Ledger");
    expect(html).toContain("chain complete");
    expect(html).toContain("Order request");
    expect(html).toContain("place_order");
    expect(html).toContain("buy / limit");
    expect(html).toContain("Gateway result");
    expect(html).toContain("dry_run_only");
    expect(html).toContain("paper_stage_only");
    expect(html).toContain("order_request:order-request-001");
    expect(html).toContain("Execution result");
    expect(html).toContain("gateway_result:gateway-result-001");
    expect(html).toContain("Trading Run Transcript");
    expect(html).toContain("Sandbox heartbeat");
    expect(html).toContain("Order request");
    expect(html).toContain("Gateway result");
    expect(html).toContain("Sandbox");
    expect(html).toContain("deterministic_test");
    expect(html).toContain("sandbox-running-fixture");
    expect(html).toContain("runtime_heartbeat");
    expect(html).toContain("Start trading run");
    expect(html).toContain("Observe");
    expect(html).toContain("Stop");
    expect(html).not.toContain("Compatibility detail");
    expect(html).not.toContain("runtime.ledger");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true,
      allowTradingRunControls: true
    });
  });

  it("renders a one-click full cycle action over the canonical flow", () => {
    const candidate = {
      ...candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    };
    const tradingHtml = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
        onRunFullCycle={() => undefined}
        fullCycleMessage="full cycle completed: running"
      />
    );
    const researchHtml = renderToStaticMarkup(
      <CandidateDetail
        activeView="research"
        candidate={candidate}
        lastFullCycle={fullCycleOutcome(candidate)}
      />
    );
    const detailsHtml = renderToStaticMarkup(
      <CandidateDetail
        activeView="details"
        candidate={candidate}
        onRunFullCycle={() => undefined}
        fullCycleMessage="full cycle completed: running"
      />
    );

    expect(tradingHtml).toContain("BTCUSDT operator cockpit");
    expect(tradingHtml).toContain("Recommended action");
    expect(tradingHtml).not.toContain("Run next cycle");
    expect(tradingHtml).not.toContain("Research iterations");
    expect(tradingHtml).toContain("Trading cockpit");
    expect(tradingHtml).toContain("BTCUSDT futures chart");
    expect(tradingHtml).toContain("My assets");
    expect(tradingHtml).toContain("Today P&amp;L");
    expect(tradingHtml).toContain("Current position");
    expect(tradingHtml).toContain("Risk status");
    expect(tradingHtml).toContain("Order / trade status");
    expect(tradingHtml).toContain("OrderRequest");
    expect(tradingHtml).toContain("GatewayResult");
    expect(tradingHtml).toContain("ExecutionResult");
    expect(tradingHtml).toContain("Safety boundary");
    expect(tradingHtml).not.toContain("full cycle completed: running");
    expect(tradingHtml).not.toContain("Research cycle");

    expect(researchHtml).toContain("Research");
    expect(researchHtml).toContain("Research cycle");
    expect(researchHtml).toContain("System performance");
    expect(researchHtml).toContain("Profit analysis");
    expect(researchHtml).toContain("Selected Trading System");
    expect(researchHtml).toContain("backtest accepted");
    expect(researchHtml).toContain("score 1.00");
    expect(researchHtml).toContain("Next cycle handoff");
    expect(researchHtml).toContain("agent handoff ready");
    expect(researchHtml).toContain("Agent generated Trading System");
    expect(researchHtml).toContain("Full-cycle lineage");
    expect(researchHtml).toContain("Source Trading System");
    expect(researchHtml).toContain("fixture-candidate-sealed-replay-001");
    expect(researchHtml).toContain("Next Trading System");
    expect(researchHtml).toContain("system-code-agent-test");
    expect(researchHtml).toContain("Backtest");
    expect(researchHtml).toContain("Paper Trading Run");
    expect(researchHtml).toContain("Ledger");
    expect(researchHtml).not.toContain("No evaluation result yet.");
    expect(researchHtml).not.toContain("Run a full cycle to produce the next System Code candidate.");
    expect(researchHtml).not.toContain("Trading cockpit");

    expect(detailsHtml).toContain("Details");
    expect(detailsHtml).toContain("Full-cycle compatibility");
    expect(detailsHtml).toContain("Run next cycle");
    expect(detailsHtml).toContain("full cycle completed: running");
    expect(detailsHtml).toContain("Gateway");
    expect(detailsHtml).toContain("Trading System");
    expect(detailsHtml).toContain("System Code");
    expect(detailsHtml).toContain("Evaluation");
    expect(detailsHtml).toContain("Improvement");
    expect(detailsHtml).toContain("Trading Run");
    expect(detailsHtml).toContain("Sandbox");
    expect(detailsHtml).toContain("Ledger");
    expect(detailsHtml).not.toContain("Trading cockpit");
    expectNoOperatorActionControls(`${tradingHtml}${researchHtml}${detailsHtml}`, {
      includePrivateAuthorityTerms: true,
      allowTradingRunControls: true
    });
  });

  it("renders Codex researcher selection in full-cycle developer controls", () => {
    const candidate = {
      ...candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    };
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="details"
        candidate={candidate}
        onRunFullCycle={() => undefined}
        tradingResearchRuntime={tradingResearchRuntimeFixture({
          codexReadiness: "active_verified"
        })}
        selectedTradingResearchAgent="codex"
        tradingResearchIterations={2}
      />
    );

    expect(html).toContain("aria-label=\"Researcher\"");
    expect(html).toContain("Codex");
    expect(html).toContain("Fixture");
    expect(html).toContain("aria-label=\"Research iterations\"");
    expect(html).toContain("value=\"2\"");
    expect(html).toContain("Codex researcher ready");
    expect(html).toContain("Run next cycle");
  });

  it("disables full-cycle developer action when selected Codex researcher is unavailable", () => {
    const candidate = {
      ...candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    };
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="details"
        candidate={candidate}
        onRunFullCycle={() => undefined}
        tradingResearchRuntime={tradingResearchRuntimeFixture({
          codexReadiness: "blocked_or_not_installed"
        })}
        selectedTradingResearchAgent="codex"
      />
    );

    expect(html).toContain("Codex unavailable: codex_cli_unavailable");
    expect(html).toContain("disabled");
  });

  it("counts accepted full-cycle scenarios from scenario result status", () => {
    const candidate = {
      ...candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    };
    const outcome = fullCycleOutcome(candidate);
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="research"
        candidate={candidate}
        lastFullCycle={{
          ...outcome,
          backtest: {
            ...outcome.backtest,
            scenario_results: [
              {
                scenario_id: "trend_long",
                status: "accepted",
                score: 1,
                risk_decision: "valid_order_request",
                summary: "Accepted order request."
              },
              {
                scenario_id: "range_flat",
                status: "disqualified",
                score: 0,
                risk_decision: "no_order_request",
                summary: "No order request."
              }
            ]
          }
        }}
      />
    );

    expect(html).toContain("1/2 scenarios accepted");
    expect(html).not.toContain("2/2 scenarios accepted");
  });

  it("keeps agent-created Trading System evidence visible after reload", () => {
    const candidate = candidateWithAgentCycleMaterialization(
      candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    );
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="research"
        candidate={candidate}
      />
    );

    expect(html).toContain("Agent generated Trading System");
    expect(html).toContain("agent handoff ready");
    expect(html).toContain("backtest recorded");
    expect(html).toContain("system-code-agent-reloaded");
    expect(html).toContain("Full-cycle lineage");
    expect(html).toContain("Source Trading System");
    expect(html).toContain("fixture-candidate-sealed-replay-001");
    expect(html).toContain("Next Trading System");
    expect(html).toContain("candidate-agent-generated-reloaded");
    expect(html).toContain("Ledger chain complete");
    expect(html).not.toContain("No evaluation result yet.");
    expect(html).not.toContain("Run a full cycle to produce the next System Code candidate.");
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true,
      allowTradingRunControls: true
    });
  });

  it("renders Improvement without promotion or trading authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithImprovementLoop(artifactImprovementLoop())}
        onRecordImprovement={() => undefined}
        improvementMessage="evaluation recorded: trading-evaluation-result-001"
      />
    );

    expect(html).toContain("Improvement");
    expect(html).toContain("automated_alignment_researcher");
    expect(html).toContain("chain complete");
    expect(html).toContain("Source finding");
    expect(html).toContain("Change proposal");
    expect(html).not.toContain("ImprovementProposal");
    expect(html).toContain("improvement-proposal-001");
    expect(html).toContain("Experiment");
    expect(html).toContain("experiment-run-001");
    expect(html).toContain("Evaluation result");
    expect(html).toContain("accepted");
    expect(html).toContain("not_counted");
    expect(html).toContain("Evidence");
    expect(html).toContain("not_sealed");
    expect(html).toContain("Promotion");
    expect(html).toContain("not_promoted");
    expect(html).toContain("Record improvement");
    expect(html).not.toContain("Run improvement loop");
    expect(html).not.toContain("Run provider");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders trading gateway environment without exposing secret values", () => {
    const html = renderToStaticMarkup(
      <TradingGatewayEnvironmentSection environment={tradingGatewayEnvironment()} />
    );

    expect(html).toContain("Trading gateway environment");
    expect(html).toContain("OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL");
    expect(html).toContain("OUROBOROS_BINANCE_API_KEY");
    expect(html).not.toContain("OUROBOROS_TRADING_GATEWAY_MODE");
    expect(html).toContain("api_secret=true");
    expect(html).not.toContain("secretKey");
    expect(html).not.toContain("signature=");
  });

  it("renders runtime control state and bounded pause command without implying live authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithRunControl(
          runtimeControl(),
          fixturePrivateReadinessPolicyDecision()
        )}
        onRecordRunControl={() => undefined}
        runtimeControlMessage="Run control recorded"
      />
    );

    expect(html).toContain("Run Control");
    expect(html).toContain("Private-readiness policy alignment");
    expect(html).toContain("policy_not_ready");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expect(html).toContain("not_order_request_gateway_result_evidence_or_promotion");
    expect(html).toContain("chain complete");
    expect(html).toContain("Latest control command");
    expect(html).toContain("pause");
    expect(html).toContain("human_operator");
    expect(html).toContain("Latest control decision");
    expect(html).toContain("policy_allows_control");
    expect(html).toContain("run_control_command:run-control-command-001");
    expect(html).toContain("Latest audit event");
    expect(html).toContain("runtime_lifecycle_transitioned");
    expect(html).toContain("Record pause");
    expect(html).toContain("control_only");
    expect(html).toContain("audit_only");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
    expect(html).not.toMatch(/\bKill\b/i);
  });

  it("distinguishes runtime control policy alignment states without granting authority", () => {
    const reviewRequiredHtml = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithRunControl(
          runtimeControl(),
          fixturePrivateReadinessPolicyDecision({
            status: "review_required",
            reason_codes: ["jurisdiction_review_required", "no_private_read_performed"],
            blocking_conditions: ["jurisdiction: operator_jurisdiction_requires_review"],
            required_next_actions: ["review_operator_jurisdiction"]
          })
        )}
        onRecordRunControl={() => undefined}
      />
    );

    const readyHtml = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithRunControl(
          runtimeControl(),
          fixturePrivateReadinessPolicyDecision({
            status: "ready",
            reason_codes: ["ready", "no_private_read_performed"],
            blocking_conditions: [],
            required_next_actions: []
          })
        )}
        onRecordRunControl={() => undefined}
      />
    );

    expect(reviewRequiredHtml).toContain("policy_review_required");
    expect(reviewRequiredHtml).toContain("not_private_read_permission_or_execution_authority");
    expect(reviewRequiredHtml).toContain("control_only / audit_only / not_live");
    expectNoOperatorActionControls(reviewRequiredHtml, { includePrivateAuthorityTerms: true });

    expect(readyHtml).toContain("policy_ready_but_not_live_authority");
    expect(readyHtml).toContain("not_private_read_permission_or_execution_authority");
    expect(readyHtml).toContain("control_only / audit_only / not_live");
    expectNoOperatorActionControls(readyHtml, { includePrivateAuthorityTerms: true });
  });

  it("builds fixture-safe Ledger command payloads", () => {
    const payload = ledgerCommandPayload(fixtureCandidate);
    expect(payload).toMatchObject({
      candidate_version_id: fixtureCandidate.candidate_version.candidate_version_id,
      intent: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit"
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only"
      },
      execution_result: {
        execution_mode: "host_local"
      }
    });
    expect(payload.idempotency_key).toContain("operator-web-ledger");
    expect(JSON.stringify(payload)).not.toMatch(/exchange_credentials|live_order|broker/i);
  });

  it("builds fixture-safe run control pause payloads", () => {
    const payload = runControlPausePayload(fixtureCandidate);
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
    expect(payload.idempotency_key).toContain("operator-web-run-control-pause");
    expect(JSON.stringify(payload)).not.toMatch(/exchange_credentials|live_order|broker|provider_api_key/i);
  });

  it("builds fixture-safe private-readiness posture payloads", () => {
    const candidate: CandidateInspectReadModel = {
      ...fixtureCandidate,
      trading_substrate: {
        latest_order_fill_surface: fixtureOrderFillSurface(),
        latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
        latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
        latest_private_readiness_posture: fixturePrivateReadinessPosture(),
        private_readiness_posture_history: [fixturePrivateReadinessPosture()],
        latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
        latest_account_position_risk_mirror_surface: null
      }
    };

    const draft = privateReadinessPostureDraftFromCandidate(candidate);
    const payload = privateReadinessPosturePayload(candidate, draft);
    const editedPayload = privateReadinessPosturePayload(candidate, {
      ...draft,
      operator_approval_gate: {
        status: "ready",
        reason: "operator_approval_recorded_in_local_posture_form"
      },
      secret_handling_gate: {
        status: "review_required",
        reason: "secret_handling_review_recorded_without_secret_material"
      }
    });

    expect(payload).toMatchObject({
      idempotency_key: expect.stringContaining("operator-web-private-readiness-posture"),
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      product_category: "perpetual_futures",
      operator_approval_gate: {
        status: "not_ready",
        reason: "operator_live_private_read_approval_missing"
      },
      jurisdiction_risk_gate: {
        status: "review_required",
        reason: "operator_jurisdiction_not_recorded"
      },
      secret_reference_configured: false,
      source_ref: {
        record_kind: "operator",
        id: "operator-web"
      }
    });
    expect(payload.idempotency_key).toContain("draft-");
    expect(editedPayload.idempotency_key).toContain("draft-");
    expect(editedPayload.idempotency_key).not.toEqual(payload.idempotency_key);
    expect(editedPayload).toMatchObject({
      operator_approval_gate: {
        status: "ready",
        reason: "operator_approval_recorded_in_local_posture_form"
      },
      secret_handling_gate: {
        status: "review_required",
        reason: "secret_handling_review_recorded_without_secret_material"
      },
      secret_reference_configured: false
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /exchange_credentials|provider_api_key|apiKey|secretKey|signature|direct_exchange_order/
    );
    expect(JSON.stringify(editedPayload)).not.toMatch(
      /exchange_credentials|provider_api_key|apiKey|secretKey|signature|direct_exchange_order/
    );
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

function candidateWithLedgerSource(
  ledgerSource: LedgerSourceRecordsReadModel
): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    ledger: buildLedgerReadModel(ledgerSource),
    runtime: {
      ...fixtureCandidate.runtime,
      ledger: ledgerSource
    }
  };
}

function candidateWithSandbox(
  candidate: CandidateInspectReadModel
): CandidateInspectReadModel {
  return {
    ...candidate,
    runtime: {
      ...candidate.runtime,
      runtime_lifecycle_status: "running",
      transcript: {
        transcript_kind: "trading_run_transcript",
        has_activity: true,
        item_count: 4,
        latest_item: {
          item_id: "gateway-result:gateway-result-001",
          item_kind: "gateway_result",
          occurred_at: "2026-05-20T00:00:04.000Z",
          label: "Gateway result",
          summary: "dry_run_only / paper_stage_only",
          ref: { record_kind: "gateway_result", id: "gateway-result-001" },
          authority_status: "dry_run_only"
        },
        items: [
          {
            item_id: "run-control-audit:runtime-audit-start-001",
            item_kind: "run_control_audit",
            occurred_at: "2026-05-20T00:00:00.000Z",
            label: "Run Control audit",
            summary: "Trading Run start recorded.",
            ref: { record_kind: "runtime_audit_event", id: "runtime-audit-start-001" },
            authority_status: "audit_only",
            lifecycle_status: "running"
          },
          {
            item_id: "sandbox-heartbeat:runtime-heartbeat-running-fixture",
            item_kind: "sandbox_heartbeat",
            occurred_at: "2026-05-20T00:00:01.000Z",
            label: "Sandbox heartbeat",
            summary: "{\"event\":\"runtime_heartbeat\",\"tick\":1}",
            ref: { record_kind: "runtime_heartbeat", id: "runtime-heartbeat-running-fixture" },
            authority_status: "trace_only"
          },
          {
            item_id: "order-request:order-request-001",
            item_kind: "order_request",
            occurred_at: "2026-05-20T00:00:03.000Z",
            label: "Order request",
            summary: "buy / limit / 0.001 @ 60000",
            ref: { record_kind: "order_request", id: "order-request-001" },
            authority_status: "draft_only"
          },
          {
            item_id: "gateway-result:gateway-result-001",
            item_kind: "gateway_result",
            occurred_at: "2026-05-20T00:00:04.000Z",
            label: "Gateway result",
            summary: "dry_run_only / paper_stage_only",
            ref: { record_kind: "gateway_result", id: "gateway-result-001" },
            authority_status: "dry_run_only"
          }
        ],
        authority_status: "not_live",
        no_authority: {
          live_exchange_authority: false,
          private_read_authority: false,
          order_submission_authority: false,
          credentials: false
        }
      },
      sandbox: {
        sandbox_id: "sandbox-running-fixture",
        adapter_kind: "deterministic_test",
        system_code_ref: { record_kind: "system_code", id: "fixture-system-code" },
        runtime_ref: candidate.runtime.ref,
        sandbox_placement_ref: { record_kind: "sandbox_placement", id: "sandbox-placement-running-fixture" },
        lifecycle_status: "running",
        sandbox_name: "ouro-sandbox-running-fixture",
        sandbox_ref: { record_kind: "docker_sandbox", id: "ouro-sandbox-running-fixture" },
        created_at: "2026-05-20T00:00:00.000Z",
        started_at: "2026-05-20T00:00:00.000Z",
        last_heartbeat_at: "2026-05-20T00:00:01.000Z",
        log_refs: [{ record_kind: "sandbox_log", id: "sandbox-log-running-fixture" }],
        heartbeat_refs: [{ record_kind: "runtime_heartbeat", id: "runtime-heartbeat-running-fixture" }],
        command_evidence_refs: [],
        authority_status: "not_live",
        logs: [
          {
            log_ref: { record_kind: "sandbox_log", id: "sandbox-log-running-fixture" },
            lines: ["{\"event\":\"runtime_heartbeat\",\"tick\":1}"],
            captured_at: "2026-05-20T00:00:01.000Z",
            authority_status: "trace_only"
          }
        ],
        heartbeats: [
          {
            heartbeat_ref: { record_kind: "runtime_heartbeat", id: "runtime-heartbeat-running-fixture" },
            heartbeat_line: "{\"event\":\"runtime_heartbeat\",\"tick\":1}",
            observed_at: "2026-05-20T00:00:01.000Z",
            authority_status: "trace_only"
          }
        ],
        command_evidence: []
      }
    }
  };
}

function candidateWithAgentCycleMaterialization(
  candidate: CandidateInspectReadModel
): CandidateInspectReadModel {
  return {
    ...candidate,
    candidate_id: "candidate-agent-generated-reloaded",
    display_name: "Agent generated BTCUSDT Trading System",
    status: "materialized",
    spec: {
      ...candidate.spec,
      market: "Binance USD-M Futures",
      instrument: "BTCUSDT"
    },
    system_code: {
      ref: { record_kind: "system_code", id: "system-code-agent-reloaded" },
      summary: "Agent-generated Python SystemCode using the TradingApiProvider boundary.",
      declared_runtime: "python",
      declared_outputs: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
    },
    materialization_attempt: {
      attempt_id: "candidate-materialization-attempt-agent-cycle-reloaded",
      idempotency_key: "agent-cycle-materialize:fixture-candidate-sealed-replay-001:fixture-candidate-version-001",
      provider_kind: "codex_cli",
      model: "gpt-5",
      agent_run_ref: { record_kind: "agent_run", id: "agent-run-agent-cycle-reloaded" },
      trace_ref: { record_kind: "trace_placeholder", id: "trace-agent-cycle-reloaded" },
      status: "materialized",
      validation_status: "accepted",
      resulting_candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-agent-generated-reloaded" },
      artifact_refs: [{ record_kind: "system_code", id: "system-code-agent-reloaded" }],
      created_at: "2026-05-23T00:00:00.000Z",
      authority_label: "provider_output_not_evidence"
    },
    full_cycle_lineage: {
      handoff_status: "runnable",
      source: {
        trading_system_id: "fixture-candidate-sealed-replay-001",
        candidate_version_id: "fixture-candidate-version-001",
        system_code_ref: {
          record_kind: "system_code",
          id: "fixture-system-code-clock-python-001"
        }
      },
      generated: {
        system_code_ref: {
          record_kind: "system_code",
          id: "system-code-agent-reloaded"
        },
        artifact_digest: "sha256:agent-reloaded",
        generated_by_agent: true
      },
      materialized: {
        trading_system_id: "candidate-agent-generated-reloaded",
        candidate_version_id: candidate.candidate_version.candidate_version_id,
        system_code_ref: {
          record_kind: "system_code",
          id: "system-code-agent-reloaded"
        }
      },
      evidence: {
        evaluation_status: "accepted",
        evaluation_score: 1,
        trading_run_id: candidate.runtime.ref.id,
        gateway_result_outcome: "dry_run_only",
        ledger_chain_complete: true
      }
    }
  };
}

function candidateWithImprovementLoop(
  improvementLoop: ImprovementReadModel
): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    improvement: improvementFromLoop(improvementLoop)
  };
}

function improvementFromLoop(loop: ImprovementReadModel): ImprovementReadModel {
  return {
    improvement_kind: "improvement",
    source_model: loop.source_model,
    has_activity: loop.has_activity,
    proposal_chain_complete: loop.proposal_chain_complete,
    evaluation_chain_complete: loop.evaluation_chain_complete,
    chain_complete: loop.chain_complete,
    latest_source_finding: loop.latest_source_finding,
    latest_change_proposal: loop.latest_change_proposal,
    latest_materialization: loop.latest_materialization,
    latest_research_run: loop.latest_research_run,
    latest_experiment: loop.latest_experiment,
    latest_evaluation_result: loop.latest_evaluation_result,
    evidence: loop.evidence,
    promotion: loop.promotion,
    no_authority: loop.no_authority
  };
}

function candidateWithRunControl(
  runtimeControl: RunControlReadModel,
  privateReadinessPolicyDecision?: NonNullable<
    CandidateInspectReadModel["trading_substrate"]
  >["latest_private_readiness_policy_decision"]
): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    runtime: {
      ...fixtureCandidate.runtime,
      run_control: runtimeControl
    },
    trading_substrate: {
      latest_order_fill_surface: fixtureOrderFillSurface(),
      latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
      latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
      latest_private_readiness_posture: fixturePrivateReadinessPosture(),
      private_readiness_posture_history: [fixturePrivateReadinessPosture()],
      latest_private_readiness_policy_decision: privateReadinessPolicyDecision ?? null,
      latest_account_position_risk_mirror_surface: null
    }
  };
}

function promotedCandidate(): CandidateInspectReadModel {
  const candidateId = "trading-system-candidate-8d42977b8c79";
  return {
    ...fixtureCandidate,
    candidate_id: candidateId,
    display_name: "Trading System s15-02-seeded-codex-real-sdx-proof",
    status: "materialized",
    active_version_id: `${candidateId}-v1`,
    fixture_notice: {
      mode: "local_promoted_candidate_bundle",
      label: "Promoted local candidate bundle",
      statements: [
        "Read-only Trading System bundle promoted from research.",
        "No exchange credentials or order authority are mounted.",
        "Replay-run evidence is replay-only and not counted trading authority."
      ]
    },
    candidate_version: {
      candidate_version_id: `${candidateId}-v1`,
      version_label: "trading-research-v1",
      provenance_refs: [
        { record_kind: "trading_research_notebook", id: "s15-02-seeded-codex-real-sdx-proof" },
        { record_kind: "system_code", id: "system-code-8d42977b8c79" }
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
        declared_outputs: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
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
      ref: { record_kind: "trading_run", id: `${candidateId}-runtime` },
      stage_binding_profile: "backtest",
      runtime_lifecycle_status: "registered",
      authority_status: "not_live",
      placement: {
        ref: { record_kind: "sandbox_placement", id: `${candidateId}-placement` },
        label: "Sandbox placement",
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
    risk_decision: "valid_order_request",
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
        risk_decision: "valid_order_request",
        summary: "Accepted order request with score 1.000.",
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
      risk_decision: "valid_order_request",
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
      risk_decision: "valid_order_request",
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
    risk_transition: "valid_order_request -> valid_order_request",
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

function fullCycleOutcome(candidate: CandidateInspectReadModel): FullCycleOutcome {
  const ledger = candidate.ledger ?? buildLedgerReadModel(ledgerSourceRecords());
  return {
    status: "completed",
    source_system_id: "fixture-candidate-sealed-replay-001",
    source_candidate_version_id: "fixture-candidate-version-001",
    agent_research: {
      session_id: "agent-cycle-test",
      run_root: "/tmp/agent-cycle-test",
      notebook_path: "/tmp/agent-cycle-test/notebook.json",
      agent: {
        id: "managed-agent-fixture-trading-research",
        provider: "fixture",
        model: "scripted-fixture",
        permission_policy: "fixture_only"
      },
      best_score: 1,
      best_artifact_dir: "/tmp/agent-cycle-test/best",
      latest_decision: "keep",
      latest_summary: "Accepted replay set with average score 1.000 across 2 scenarios."
    },
    system_code_handoff: {
      system_code_id: "system-code-agent-test",
      artifact_path: "/tmp/agent-cycle-test/best/run.py",
      artifact_digest: "sha256:test",
      runtime_kind: "python",
      declared_output_kinds: ["order_request"],
      generated_by_agent: true,
      authority_status: "not_live"
    },
    full_cycle_lineage: {
      handoff_status: "runnable",
      source: {
        trading_system_id: "fixture-candidate-sealed-replay-001",
        candidate_version_id: "fixture-candidate-version-001",
        system_code_ref: {
          record_kind: "system_code",
          id: "fixture-system-code-clock-python-001"
        }
      },
      generated: {
        system_code_ref: {
          record_kind: "system_code",
          id: "system-code-agent-test"
        },
        artifact_digest: "sha256:test",
        generated_by_agent: true
      },
      materialized: {
        trading_system_id: candidate.candidate_id,
        candidate_version_id: candidate.candidate_version.candidate_version_id,
        system_code_ref: {
          record_kind: "system_code",
          id: "system-code-agent-test"
        }
      },
      evidence: {
        evaluation_status: "accepted",
        evaluation_score: 1,
        trading_run_id: candidate.runtime.ref.id,
        gateway_result_outcome: "dry_run_only",
        ledger_chain_complete: true
      }
    },
    backtest: {
      status: "accepted",
      score: 1,
      risk_decision: "valid_order_request",
      summary: "Accepted replay set with average score 1.000 across 2 scenarios.",
      scenario_results: [
        {
          scenario_id: "trend_long",
          status: "accepted",
          score: 1,
          risk_decision: "valid_order_request",
          summary: "Accepted order request with score 1.000."
        }
      ]
    },
    next_trading_system: candidate,
    trading_run_id: candidate.runtime.ref.id,
    trading_run: {
      ref: { record_kind: "trading_run", id: candidate.runtime.ref.id },
      stage: candidate.runtime.stage_binding_profile,
      lifecycle_status: candidate.runtime.runtime_lifecycle_status,
      authority_status: "not_live"
    },
    paper_trading: {
      run_status: "completed",
      events_path: "/tmp/agent-cycle-test/paper/events.jsonl",
      provider_request_count: 3,
      authority_status: "not_live"
    },
    order_request: ledger.latest_order_request,
    gateway_result: ledger.latest_gateway_result,
    execution_result: ledger.latest_execution_result,
    ledger,
    trading_gateway_environment: tradingGatewayEnvironment()
  };
}

function ledgerSourceRecords(): LedgerSourceRecordsReadModel {
  return {
    has_activity: true,
    chain_complete: true,
    chain_count: 1,
    chains: [
      {
        chain_id: "order-request-001",
        chain_complete: true,
        occurred_at: "2026-05-10T00:00:00.000Z",
        order_request: {
          order_request_id: "order-request-001",
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
        gateway_result: {
          gateway_result_id: "gateway-result-001",
          order_request_ref: { record_kind: "order_request", id: "order-request-001" },
          decision_outcome: "dry_run_only",
          decision_reason: "paper_stage_only",
          decided_at: "2026-05-10T00:00:00.000Z",
          authority_status: "dry_run_only"
        },
        execution_result: {
          execution_result_id: "execution-result-001",
          order_request_ref: { record_kind: "order_request", id: "order-request-001" },
          gateway_result_ref: { record_kind: "gateway_result", id: "gateway-result-001" },
          stage: "paper",
          execution_mode: "host_local",
          venue_scope: "external_trading_api_fixture",
          status: "dry_run_recorded",
          result_reason: "paper_stage_only",
          created_at: "2026-05-10T00:00:00.000Z",
          authority_status: "dry_run_only"
        },
        authority_status: "not_live"
      }
    ],
    latest_order_request: {
      order_request_id: "order-request-001",
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
    latest_gateway_result: {
      gateway_result_id: "gateway-result-001",
      order_request_ref: { record_kind: "order_request", id: "order-request-001" },
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      decided_at: "2026-05-10T00:00:00.000Z",
      authority_status: "dry_run_only"
    },
    latest_execution_result: {
      execution_result_id: "execution-result-001",
      order_request_ref: { record_kind: "order_request", id: "order-request-001" },
      gateway_result_ref: { record_kind: "gateway_result", id: "gateway-result-001" },
      stage: "paper",
      execution_mode: "host_local",
      venue_scope: "external_trading_api_fixture",
      status: "dry_run_recorded",
      result_reason: "paper_stage_only",
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "dry_run_only"
    },
    order_request: {
      ref: { record_kind: "order_request", id: "order-request-001" },
      label: "Order request",
      status: "proposed",
      authority_status: "not_submitted"
    },
    gateway_result: {
      ref: { record_kind: "gateway_result", id: "gateway-result-001" },
      label: "Gateway result",
      status: "dry_run_only",
      authority_status: "dry_run_only"
    },
    execution_result: {
      ref: { record_kind: "execution_result", id: "execution-result-001" },
      label: "Execution result",
      status: "dry_run_recorded",
      authority_status: "dry_run_only"
    }
  };
}

function tradingResearchRuntimeFixture(input: {
  codexReadiness: "active_verified" | "blocked_or_not_installed";
}): TradingResearchRuntimeReadModel {
  return {
    default_agent: "codex",
    available_agents: ["codex", "fixture"],
    iterations: 1,
    agents: [
      {
        agent: "codex",
        provider: "codex",
        readiness_status: input.codexReadiness,
        permission_policy: "artifact_workspace_only",
        command: "codex",
        model: "test-model",
        timeout_ms: 120_000,
        reasoning_effort: "low",
        version: input.codexReadiness === "active_verified" ? "codex-cli 0.130.0" : undefined,
        failure_reason: input.codexReadiness === "blocked_or_not_installed" ? "codex_cli_unavailable" : undefined
      },
      {
        agent: "fixture",
        provider: "fixture",
        readiness_status: "active_verified",
        permission_policy: "fixture_only",
        model: "scripted-fixture"
      }
    ]
  };
}

function artifactImprovementLoop(): ImprovementReadModel {
  return {
    improvement_kind: "improvement",
    source_model: "automated_alignment_researcher",
    has_activity: true,
    proposal_chain_complete: true,
    evaluation_chain_complete: true,
    chain_complete: true,
    latest_source_finding: {
      finding_id: "research-finding-001",
      finding_kind: "failure_analysis",
      summary: "Limit-order sizing is too brittle in a flat market fixture.",
      research_worker_ref: { record_kind: "research_worker", id: "research-worker-001" },
      research_direction_ref: { record_kind: "research_direction", id: "research-direction-001" },
      created_at: "2026-05-18T00:00:00.000Z",
      authority_status: "research_trace_only"
    },
    latest_change_proposal: {
      proposal_id: "improvement-proposal-001",
      proposed_system_code_ref: { record_kind: "system_code", id: "system-code-002" },
      parent_system_code_ref: { record_kind: "system_code", id: "system-code-001" },
      proposal_summary: "Adjust the fixture trading artifact to emit a valid dry-run order intent.",
      requested_change_summary: "Keep the change limited to the generated artifact.",
      expected_improvement_summary: "The next sandbox experiment should produce an accepted evaluation result.",
      source_finding_refs: [{ record_kind: "research_finding", id: "research-finding-001" }],
      anti_hacking_finding_refs: [],
      status: "proposed",
      created_at: "2026-05-18T00:01:00.000Z",
      authority_status: "proposal_only"
    },
    latest_materialization: {
      attempt_id: "materialization-attempt-001",
      provider: {
        provider_kind: "codex_cli",
        model: "fixture-model",
        invocation_surface: "local_fixture"
      },
      status: "materialized",
      validation_status: "accepted",
      output_artifact_proposal_ref: { record_kind: "improvement_proposal", id: "improvement-proposal-001" },
      output_system_code_ref: { record_kind: "system_code", id: "system-code-002" },
      output_lineage_ref: { record_kind: "artifact_lineage", id: "artifact-lineage-001" },
      created_at: "2026-05-18T00:02:00.000Z",
      authority_status: "proposal_input_only"
    },
    latest_research_run: {
      run_id: "research-orchestration-run-001",
      input_finding_refs: [{ record_kind: "research_finding", id: "research-finding-001" }],
      input_lineage_refs: [{ record_kind: "artifact_lineage", id: "artifact-lineage-000" }],
      output_artifact_proposal_ref: { record_kind: "improvement_proposal", id: "improvement-proposal-001" },
      output_system_code_ref: { record_kind: "system_code", id: "system-code-002" },
      output_lineage_ref: { record_kind: "artifact_lineage", id: "artifact-lineage-001" },
      trace_ref: { record_kind: "trace", id: "trace-001" },
      status: "proposed",
      started_at: "2026-05-18T00:00:30.000Z",
      completed_at: "2026-05-18T00:02:30.000Z",
      authority_status: "research_only"
    },
    latest_experiment: {
      experiment_id: "experiment-run-001",
      system_code_ref: { record_kind: "system_code", id: "system-code-002" },
      sandbox_ref: { record_kind: "sandbox", id: "sandbox-runtime-001" },
      runtime_trace_refs: [{ record_kind: "trace", id: "runtime-trace-001" }],
      trace_ref: { record_kind: "trace", id: "experiment-trace-001" },
      status: "evaluated",
      submitted_at: "2026-05-18T00:03:00.000Z",
      authority_status: "not_live"
    },
    latest_evaluation_result: {
      result_id: "trading-evaluation-result-001",
      experiment_run_ref: { record_kind: "experiment_run", id: "experiment-run-001" },
      result_status: "accepted",
      evidence_disposition: "not_counted",
      total_score: 1,
      evaluator_trace_ref: { record_kind: "trace", id: "evaluator-trace-001" },
      completed_at: "2026-05-18T00:04:00.000Z",
      authority_status: "not_counted"
    },
    evidence: {
      status: "not_sealed",
      reason: "evidence_sealing_not_run",
      authority_status: "not_counted"
    },
    promotion: {
      status: "not_promoted",
      reason: "promotion_requires_sealed_evidence",
      authority_status: "not_live"
    },
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      promotion: false
    }
  };
}

function tradingGatewayEnvironment(): TradingGatewayEnvironmentReadModel {
  return {
    environment_kind: "trading_gateway_environment",
    venue: "binance_usd_m_futures",
    instrument: "BTCUSDT",
    product_category: "perpetual_futures",
    runtime_environment: "paper",
    runtime_environment_source: "mlp_policy",
    exchange_environment: "unbound",
    exchange_environment_source: "runtime_binding_policy",
    rest_base_url: null,
    credential_scope: "none",
    credential_source: "environment_variables",
    api_key_configured: true,
    api_secret_configured: true,
    configuration_status: "configured",
    configuration_reason: "credentials_configured_but_not_used_by_paper_runtime",
    authority_status: "not_live",
    live_exchange_authority: false,
    order_submission_authority: false,
    live_disabled_reason: "live_gateway_not_enabled_in_mlp",
    runtime_bindings: {
      paper: {
        status: "enabled",
        market_data_source: "binance_production_public_rest",
        rest_base_url: "https://fapi.binance.com",
        account_provider: "fake_paper_account",
        executor: "fake_paper_order_executor",
        ledger: "fake_ledger",
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "dry_run_only"
      },
      live: {
        status: "disabled",
        disabled_reason: "live_gateway_not_enabled_in_mlp",
        market_data_source: "binance_production_public_rest",
        rest_base_url: "https://fapi.binance.com",
        account_provider: "live_account",
        executor: "live_order_executor",
        ledger: "ledger",
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "not_live"
      }
    },
    env_var_names: {
      rest_base_url: "OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL",
      api_key: "OUROBOROS_BINANCE_API_KEY",
      api_secret: "OUROBOROS_BINANCE_API_SECRET"
    },
    warnings: []
  };
}

function runtimeControl(): RunControlReadModel {
  return {
    has_activity: true,
    chain_complete: true,
    latest_command: {
      command_id: "run-control-command-001",
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
      decision_id: "run-control-decision-001",
      command_ref: { record_kind: "run_control_command", id: "run-control-command-001" },
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
      command_ref: { record_kind: "run_control_command", id: "run-control-command-001" },
      decision_ref: { record_kind: "run_control_decision", id: "run-control-decision-001" },
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-web" },
      runtime_lifecycle_status: "paused",
      message: "Paper runtime paused through operator-web.",
      created_at: "2026-05-10T00:10:00.000Z",
      authority_status: "audit_only"
    },
    command: {
      ref: { record_kind: "run_control_command", id: "run-control-command-001" },
      label: "Runtime control command",
      status: "decided",
      authority_status: "control_only"
    },
    decision: {
      ref: { record_kind: "run_control_decision", id: "run-control-decision-001" },
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
      support_status: "available",
      stage_binding_profile: "paper",
      artifact_contract: baseArtifactContract,
      provider_contract: {
        market_data: "realtime_market_data",
        account: "paper_account",
        order_plane: "paper_order_sink",
        credentials_scope: "none_required"
      },
      authority: {
        artifact_has_credentials: false,
        artifact_has_order_authority: false,
        provider_may_submit_orders: false,
        live_exchange_authority: false,
        status: "paper_only"
      },
      required_controls: ["fake paper account isolation"],
      forbidden_artifact_capabilities: forbiddenArtifactCapabilities
    },
    {
      mode: "live",
      label: "Live disabled",
      support_status: "disabled",
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
        provider_may_submit_orders: false,
        live_exchange_authority: false,
        status: "live_disabled"
      },
      required_controls: ["live_gateway_not_enabled_in_mlp"],
      forbidden_artifact_capabilities: forbiddenArtifactCapabilities
    }
  ];
}

const fixtureCandidateArena: CandidateArenaReadModel = {
  arena_kind: "candidate_arena",
  runner_status: "running",
  tick_count: 1,
  authority_status: "not_live",
  active_researchers: [
    {
      researcher_id: "research-worker-trend-following",
      direction_kind: "trend_following",
      status: "active",
      authority_status: "research_only"
    }
  ],
  leaderboard: [
    {
      rank: 1,
      candidate_id: "candidate-profitable",
      display_name: "Arena trend Trading System",
      direction_kind: "trend_following",
      parent_candidate_id: "fixture-candidate-sealed-replay-001",
      status: "accepted",
      profit_loss: {
        revenue_usdt: 10,
        cost_usdt: 0.17,
        net_revenue_usdt: 9.83,
        net_return_pct: 0.0983
      },
      latest_finding: "Positive net revenue after costs.",
      authority_status: "not_live"
    }
  ],
  latest_candidates: [
    {
      candidate_id: "candidate-profitable",
      display_name: "Arena trend Trading System",
      direction_kind: "trend_following",
      net_revenue_usdt: 9.83,
      authority_status: "not_live"
    }
  ],
  latest_ticks: [
    {
      tick_id: "tick-1",
      started_at: "2026-05-24T00:00:00.000Z",
      completed_at: "2026-05-24T00:00:01.000Z",
      status: "completed",
      created_candidate_ids: ["candidate-profitable"],
      direction_results: [
        {
          direction_kind: "trend_following",
          status: "created",
          candidate_id: "candidate-profitable",
          finding: "Positive net revenue after costs.",
          net_revenue_usdt: 9.83
        }
      ],
      authority_status: "not_live"
    }
  ],
  live_disabled: true
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

function arenaSelectedCandidate(
  overrides: Partial<CandidateInspectReadModel> = {}
): CandidateInspectReadModel {
  const candidate = candidateWithAgentCycleMaterialization(fixtureCandidate);
  return {
    ...candidate,
    candidate_id: "candidate-profitable",
    display_name: "Arena trend Trading System",
    full_cycle_lineage: candidate.full_cycle_lineage
      ? {
          ...candidate.full_cycle_lineage,
          generated: {
            system_code_ref: { record_kind: "system_code", id: "system-code-arena-profitable" },
            artifact_digest: "sha256:arena-profitable",
            generated_by_agent: true
          },
          evidence: candidate.full_cycle_lineage.evidence
            ? {
                ...candidate.full_cycle_lineage.evidence,
                evaluation_status: "accepted",
                evaluation_score: 1,
                profit_loss: {
                  revenue_usdt: 10,
                  cost_usdt: 0.17,
                  net_revenue_usdt: 9.83,
                  net_return_pct: 0.0983
                },
                direction_kind: "trend_following"
              }
            : undefined
        }
      : undefined,
    ...overrides
  };
}

function emptyLedgerSourceRecords(): LedgerSourceRecordsReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    chain_count: 0,
    chains: [],
    latest_order_request: null,
    latest_gateway_result: null,
    latest_execution_result: null,
    order_request: {
      ref: { record_kind: "order_request", id: "none" },
      label: "Order request",
      status: "not_submitted",
      authority_status: "not_submitted"
    },
    gateway_result: {
      ref: { record_kind: "gateway_result", id: "none" },
      label: "Gateway result",
      status: "not_evaluated",
      authority_status: "not_live"
    },
    execution_result: {
      ref: { record_kind: "execution_result", id: "none" },
      label: "Execution result",
      status: "not_submitted",
      authority_status: "not_submitted"
    }
  };
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
      declared_outputs: ["OrderRequest placeholder"]
    },
    validation: {
      ref: { record_kind: "program_validation_record", id: "fixture-validation" },
      label: "Program validation",
      status: "fixture_placeholder",
      authority_status: "not_executable"
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
    ref: { record_kind: "trading_run", id: "fixture-runtime" },
    stage_binding_profile: "paper",
    authority_status: "not_live",
    placement: placeholder("sandbox_placement", "fixture-placement", "Sandbox placement"),
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
