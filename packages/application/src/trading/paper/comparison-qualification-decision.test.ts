import {
  type LedgerReadModel,
  type PaperTradingQualificationResult,
  type Ref
} from "@ouroboros/domain";
import { describe, expect, it } from "vitest";
import {
  decidePaperTradingComparisonQualification,
  type PaperTradingComparisonQualificationDecisionInput,
  type PaperTradingComparisonQualificationReason
} from "./comparison-qualification-decision";

describe("paired paper comparison qualification decision", () => {
  it("qualifies a clean stopped all-no-order comparison", () => {
    const input = qualificationInput();

    expect(decidePaperTradingComparisonQualification(input)).toEqual({
      comparison_id: "comparison-001",
      activation_id: "activation-001",
      activation_attempt_id: "activation-attempt-001",
      qualification_status: "qualified",
      qualification_reasons: [],
      checkpoint_count: 3,
      champion: input.champion.qualification,
      challenger: input.challenger.qualification,
      authority_status: "not_verdict"
    });
  });

  it("accepts exact complete Ledger chain refs", () => {
    const input = qualificationInput();
    input.champion.expectedLedgerRefs = ledgerRefs("champion");
    input.champion.ledger = completeLedger("champion");

    expect(decidePaperTradingComparisonQualification(input)).toMatchObject({
      qualification_status: "qualified",
      qualification_reasons: []
    });
  });

  it("requires a clean handoff window with complete checkpoints", () => {
    const cases: Array<{
      mutate: (input: PaperTradingComparisonQualificationDecisionInput) => void;
      reasons: PaperTradingComparisonQualificationReason[];
    }> = [
      {
        mutate: (input) => { input.windowPhase = "recovery_required"; },
        reasons: ["comparison_window_not_stopped_cleanly"]
      },
      {
        mutate: (input) => { input.finalOutcomeReason = "restart_cleanup"; },
        reasons: ["comparison_window_not_completed_normally"]
      },
      {
        mutate: (input) => { input.checkpointOutcomesComplete = false; },
        reasons: ["comparison_checkpoint_incomplete"]
      }
    ];

    for (const testCase of cases) {
      const input = qualificationInput();
      testCase.mutate(input);
      expect(decidePaperTradingComparisonQualification(input)).toMatchObject({
        qualification_status: "not_qualified",
        qualification_reasons: testCase.reasons
      });
    }
  });

  it("uses shared activation-to-latest-tick count and elapsed minimums", () => {
    const countInput = qualificationInput();
    countInput.checkpointCount = 2;
    expect(decidePaperTradingComparisonQualification(countInput).qualification_reasons)
      .toEqual(["comparison_minimum_observation_count_not_met"]);

    const elapsedInput = qualificationInput();
    elapsedInput.latestTickObservedAt = "2026-07-12T00:01:59.999Z";
    expect(decidePaperTradingComparisonQualification(elapsedInput).qualification_reasons)
      .toEqual(["comparison_minimum_elapsed_not_met"]);
  });

  it("preserves and gates every canonical side qualification status", () => {
    const statuses = [
      "collecting_evidence",
      "needs_resume",
      "blocked_by_quality",
      "paper_failed",
      "not_qualification_evidence"
    ] as const;

    for (const status of statuses) {
      const input = qualificationInput();
      input.champion.qualification = {
        ...input.champion.qualification,
        qualification_status: status,
        qualification_reasons: status === "collecting_evidence"
          ? ["min_observation_count_not_met"]
          : input.champion.qualification.qualification_reasons
      };
      const result = decidePaperTradingComparisonQualification(input);
      expect(result.qualification_reasons).toEqual(["champion_not_qualified"]);
      expect(result.champion).toEqual(input.champion.qualification);
    }
  });

  it("distinguishes missing projection and incomplete chains from lineage mismatch", () => {
    const missingProjection = qualificationInput();
    missingProjection.champion.projectedTradingRunId = undefined;
    expect(decidePaperTradingComparisonQualification(missingProjection).qualification_reasons)
      .toEqual(["champion_ledger_incomplete"]);

    const wrongRun = qualificationInput();
    wrongRun.champion.projectedTradingRunId = "other-run";
    expect(decidePaperTradingComparisonQualification(wrongRun).qualification_reasons)
      .toEqual(["champion_ledger_lineage_mismatch"]);

    const incomplete = qualificationInput();
    incomplete.champion.expectedLedgerRefs = ledgerRefs("champion");
    incomplete.champion.ledger = completeLedger("champion");
    incomplete.champion.ledger.chains[0]!.execution_result = null;
    incomplete.champion.ledger.chain_complete = false;
    expect(decidePaperTradingComparisonQualification(incomplete).qualification_reasons)
      .toEqual(["champion_ledger_incomplete"]);
  });

  it("rejects duplicate, missing, extra, unsupported, and cross-run Ledger refs", () => {
    const cases: Array<(input: PaperTradingComparisonQualificationDecisionInput) => void> = [
      (input) => {
        const refs = ledgerRefs("champion");
        input.champion.expectedLedgerRefs = [...refs, { ...refs[0]! }];
        input.champion.ledger = completeLedger("champion");
      },
      (input) => {
        input.champion.expectedLedgerRefs = [];
        input.champion.ledger = completeLedger("champion");
      },
      (input) => {
        input.champion.expectedLedgerRefs = [
          ...ledgerRefs("champion"),
          { record_kind: "ledger_chain", id: "order-extra" }
        ];
        input.champion.ledger = completeLedger("champion");
      },
      (input) => {
        input.champion.expectedLedgerRefs = [
          { record_kind: "trading_run", id: "champion-run" }
        ];
      },
      (input) => {
        input.champion.expectedLedgerRefs = ledgerRefs("challenger");
        input.champion.ledger = completeLedger("champion");
      }
    ];

    for (const mutate of cases) {
      const input = qualificationInput();
      mutate(input);
      expect(decidePaperTradingComparisonQualification(input).qualification_reasons)
        .toEqual(["champion_ledger_lineage_mismatch"]);
    }
  });

  it("validates chain-internal order and gateway lineage", () => {
    const input = qualificationInput();
    input.champion.expectedLedgerRefs = ledgerRefs("champion");
    input.champion.ledger = completeLedger("champion");
    input.champion.ledger.chains[0]!.execution_result!.gateway_result_ref.id =
      "gateway-other";

    expect(decidePaperTradingComparisonQualification(input).qualification_reasons)
      .toEqual(["champion_ledger_lineage_mismatch"]);
  });

  it("returns blockers in stable protocol order", () => {
    const input = qualificationInput();
    input.windowPhase = "comparison_failed";
    input.finalOutcomeReason = "restart_cleanup";
    input.checkpointOutcomesComplete = false;
    input.checkpointCount = 1;
    input.latestTickObservedAt = "2026-07-12T00:00:01.000Z";
    input.champion.qualification = unqualifiedSide();
    input.challenger.qualification = unqualifiedSide();
    input.champion.projectedTradingRunId = undefined;
    input.challenger.projectedTradingRunId = "wrong-run";

    expect(decidePaperTradingComparisonQualification(input).qualification_reasons).toEqual([
      "comparison_window_not_stopped_cleanly",
      "comparison_window_not_completed_normally",
      "comparison_checkpoint_incomplete",
      "comparison_minimum_observation_count_not_met",
      "comparison_minimum_elapsed_not_met",
      "champion_not_qualified",
      "challenger_not_qualified",
      "champion_ledger_incomplete",
      "challenger_ledger_lineage_mismatch"
    ]);
  });

  it("is deterministic and does not mutate caller evidence", () => {
    const input = qualificationInput();
    input.champion.expectedLedgerRefs = [...ledgerRefs("champion")].reverse();
    input.champion.ledger = completeLedger("champion");
    const before = structuredClone(input);

    const first = decidePaperTradingComparisonQualification(input);
    const second = decidePaperTradingComparisonQualification(input);

    expect(first).toEqual(second);
    expect(input).toEqual(before);
  });
});

function qualificationInput(): PaperTradingComparisonQualificationDecisionInput {
  return {
    comparisonId: "comparison-001",
    activationId: "activation-001",
    activationAttemptId: "activation-attempt-001",
    windowPhase: "window_stopped",
    finalOutcomeReason: "handoff_cleanup",
    checkpointCount: 3,
    checkpointOutcomesComplete: true,
    minimumObservationCount: 3,
    minimumElapsedMs: 120_000,
    activationAttemptedAt: "2026-07-12T00:00:00.000Z",
    latestTickObservedAt: "2026-07-12T00:02:00.000Z",
    champion: qualificationSide("champion"),
    challenger: qualificationSide("challenger")
  };
}

function qualificationSide(role: "champion" | "challenger") {
  return {
    tradingRunId: `${role}-run`,
    projectedTradingRunId: `${role}-run`,
    qualification: qualifiedSide(),
    expectedLedgerRefs: [] as Ref[],
    ledger: emptyLedger()
  };
}

function qualifiedSide(): PaperTradingQualificationResult {
  return {
    qualification_status: "qualified",
    qualification_reasons: [],
    evidence_window: {
      observation_count: 3,
      elapsed_ms: 120_000,
      failed_observation_count: 0,
      first_observed_at: "2026-07-12T00:00:00.000Z",
      last_observed_at: "2026-07-12T00:02:00.000Z"
    }
  };
}

function unqualifiedSide(): PaperTradingQualificationResult {
  return {
    ...qualifiedSide(),
    qualification_status: "collecting_evidence",
    qualification_reasons: ["min_observation_count_not_met"]
  };
}

function ledgerRefs(prefix: string): Ref[] {
  return [{ record_kind: "ledger_chain", id: `${prefix}-order` }];
}

function emptyLedger(): LedgerReadModel {
  return {
    ledger_kind: "ledger",
    has_activity: false,
    chain_complete: false,
    chain_count: 0,
    chains: [],
    latest_order_request: null,
    latest_gateway_result: null,
    latest_execution_result: null,
    order_request: placeholder("order_request", "Order request"),
    gateway_result: placeholder("gateway_result", "Gateway result"),
    execution_result: placeholder("execution_result", "Execution result"),
    authority_status: "not_live",
    no_authority: {
      live_exchange_authority: false,
      private_read_authority: false,
      order_submission_authority: false,
      credentials: false
    },
    source_record_kinds: ["order_request", "gateway_result", "execution_result"]
  };
}

function completeLedger(prefix: string): LedgerReadModel {
  const ledger = emptyLedger();
  const order = {
    order_request_id: `${prefix}-order`,
    intent_kind: "place_order" as const,
    market_scope: "external_trading_api_fixture" as const,
    side: "buy" as const,
    order_type: "market" as const,
    quantity: "0.001",
    status: "proposed" as const,
    created_at: "2026-07-12T00:01:00.000Z",
    authority_status: "not_submitted" as const
  };
  const gateway = {
    gateway_result_id: `${prefix}-gateway`,
    order_request_ref: { record_kind: "order_request", id: order.order_request_id },
    decision_outcome: "dry_run_only" as const,
    decision_reason: "paper_stage_only" as const,
    decided_at: "2026-07-12T00:01:00.001Z",
    authority_status: "dry_run_only" as const
  };
  const execution = {
    execution_result_id: `${prefix}-execution`,
    order_request_ref: { record_kind: "order_request", id: order.order_request_id },
    gateway_result_ref: { record_kind: "gateway_result", id: gateway.gateway_result_id },
    stage: "paper" as const,
    execution_mode: "host_local" as const,
    venue_scope: "external_trading_api_fixture" as const,
    status: "dry_run_recorded" as const,
    result_reason: "paper_stage_only" as const,
    created_at: "2026-07-12T00:01:00.002Z",
    completed_at: "2026-07-12T00:01:00.003Z",
    authority_status: "dry_run_only" as const
  };
  return {
    ...ledger,
    has_activity: true,
    chain_complete: true,
    chain_count: 1,
    chains: [{
      chain_id: order.order_request_id,
      chain_complete: true,
      occurred_at: order.created_at,
      order_request: order,
      gateway_result: gateway,
      execution_result: execution,
      authority_status: "not_live"
    }],
    latest_order_request: order,
    latest_gateway_result: gateway,
    latest_execution_result: execution
  };
}

function placeholder(recordKind: string, label: string) {
  return {
    status: "missing",
    ref: { record_kind: recordKind, id: "missing" },
    label,
    authority_status: "not_live"
  } as const;
}
