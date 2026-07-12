import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchPreflightCommitmentDigestInput,
  type ResearchPreflightCommitmentRecord
} from "@ouroboros/domain";
import {
  deriveResearchBehaviorFingerprint,
  ResearchBehaviorFingerprintUnavailableError
} from "./behavior-fingerprint";
import { researchDevelopmentReplayScenarios } from "./replay-trading-api-provider";
import type { TradingScenarioEvaluationResult } from "./types";

describe("ResearchBehaviorFingerprint derivation", () => {
  it("normalizes only final externally recorded development decisions", () => {
    const first = derivationInput([
      scenarioResult("range_flat", holdDecision("first rationale")),
      scenarioResult("trend_long", buyDecision(0.02, "first rationale"))
    ]);
    first.scenario_results[1]!.provider_requests.splice(
      first.scenario_results[1]!.provider_requests.length - 1,
      0,
      providerRequest(buyDecision(0.01, "earlier validation probe"), "2026-07-12T10:00:00.500Z")
    );

    const second = derivationInput([
      scenarioResult("trend_long", buyDecision(0.02, "different rationale")),
      scenarioResult("range_flat", holdDecision("different rationale"))
    ]);
    second.scenario_results.forEach((scenario, index) => {
      scenario.score = 0.99 - index;
      scenario.summary = `different summary ${index}`;
      scenario.profit_loss = {
        revenue_usdt: 999 + index,
        cost_usdt: 111,
        net_revenue_usdt: 888 + index,
        net_return_pct: 8.88
      };
      scenario.candidate_events = [
        { event: "debug_noise", at: "2026-07-12T11:00:00.000Z", index },
        ...scenario.candidate_events
      ];
      scenario.provider_requests.forEach((request) => {
        request.at = "2026-07-12T11:00:00.000Z";
      });
    });
    (second as any).sealed_admission = {
      score: 999,
      scenario_results: [{ hidden: true }]
    };

    const firstRecord = deriveResearchBehaviorFingerprint(first);
    const secondRecord = deriveResearchBehaviorFingerprint(second);

    expect(firstRecord.observations).toEqual([
      {
        scenario_id: "range_flat",
        decision: {
          symbol: "BTCUSDT",
          side: "hold",
          quantity: 0,
          order_type: "none"
        }
      },
      {
        scenario_id: "trend_long",
        decision: {
          symbol: "BTCUSDT",
          side: "buy",
          quantity: 0.02,
          order_type: "market"
        }
      }
    ]);
    expect(secondRecord.observations).toEqual(firstRecord.observations);
    expect(secondRecord.fingerprint_digest).toBe(firstRecord.fingerprint_digest);
  });

  it("changes the fingerprint for a real effective decision", () => {
    const baseline = deriveResearchBehaviorFingerprint(derivationInput([
      scenarioResult("trend_long", buyDecision(0.02, "baseline")),
      scenarioResult("range_flat", holdDecision("baseline"))
    ]));
    const changedSide = deriveResearchBehaviorFingerprint(derivationInput([
      scenarioResult("trend_long", sellDecision(0.02, "side")),
      scenarioResult("range_flat", holdDecision("side"))
    ]));
    const changedQuantity = deriveResearchBehaviorFingerprint(derivationInput([
      scenarioResult("trend_long", buyDecision(0.01999999, "quantity")),
      scenarioResult("range_flat", holdDecision("quantity"))
    ]));
    expect(changedSide.fingerprint_digest).not.toBe(baseline.fingerprint_digest);
    expect(changedQuantity.fingerprint_digest).not.toBe(baseline.fingerprint_digest);
  });

  it("binds one canonical record to the exact commitment and frozen SystemCode", () => {
    const input = derivationInput([
      scenarioResult("trend_long", buyDecision(0.02, "canonical")),
      scenarioResult("range_flat", holdDecision("canonical"))
    ]);

    const record = deriveResearchBehaviorFingerprint(input);

    expect(record).toEqual(expect.objectContaining({
      record_kind: "research_behavior_fingerprint",
      version: 1,
      research_preflight_commitment_ref: {
        record_kind: "research_preflight_commitment",
        id: input.commitment.research_preflight_commitment_id
      },
      research_preflight_commitment_digest: input.commitment.commitment_digest,
      system_code_ref: input.system_code_ref,
      system_code_artifact_digest: input.system_code_artifact_digest,
      protocol_version: "research_behavior_fingerprint_v1",
      development_suite_version: "research_development_replay_v1",
      development_suite_digest: input.commitment.development_policy.suite_digest,
      observation_count: 2,
      created_at: input.created_at,
      duplicate_detection_authority: true,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    }));
    expect(record.research_behavior_fingerprint_id).toMatch(
      /^research-behavior-fingerprint-[a-f0-9]{24}$/
    );
    expect(record.fingerprint_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it.each([
    ["empty scenario set", (input: any) => { input.scenario_results = []; }, "scenario_results_empty"],
    ["incomplete scenario set", (input: any) => {
      input.scenario_results.pop();
    }, "scenario_results_incomplete"],
    ["duplicate scenario", (input: any) => {
      input.scenario_results.push(structuredClone(input.scenario_results[0]));
    }, "scenario_id_duplicate"],
    ["missing validation request", (input: any) => {
      input.scenario_results[0].provider_requests = [];
    }, "effective_decision_missing"],
    ["wrong request path", (input: any) => {
      input.scenario_results[0].provider_requests[0].path = "/orders/place";
    }, "effective_decision_missing"],
    ["malformed order", (input: any) => {
      input.scenario_results[0].provider_requests[0].body.extra = true;
    }, "effective_decision_invalid"],
    ["non-string rationale", (input: any) => {
      input.scenario_results[0].provider_requests[0].body.reason = 1;
    }, "effective_decision_invalid"],
    ["non-finite quantity", (input: any) => {
      input.scenario_results[0].provider_requests[0].body.quantity = Number.NaN;
    }, "effective_decision_invalid"],
    ["invalid hold shape", (input: any) => {
      input.scenario_results[0].provider_requests[0].body = {
        symbol: "BTCUSDT",
        side: "hold",
        quantity: 1,
        order_type: "market"
      };
    }, "effective_decision_invalid"],
    ["wrong market", (input: any) => {
      input.scenario_results[0].provider_requests[0].body.symbol = "ETHUSDT";
    }, "effective_decision_invalid"],
    ["corrupt commitment digest", (input: any) => {
      input.commitment.commitment_digest = digest("corrupt");
    }, "commitment_invalid"],
    ["development suite drift", (input: any) => {
      input.commitment.development_policy.suite_digest = digest("other-suite");
      sealCommitment(input.commitment);
    }, "commitment_invalid"],
    ["wrong SystemCode ref", (input: any) => {
      input.system_code_ref.record_kind = "candidate_version";
    }, "system_code_identity_invalid"],
    ["invalid artifact digest", (input: any) => {
      input.system_code_artifact_digest = "pending";
    }, "system_code_identity_invalid"],
    ["time before commitment", (input: any) => {
      input.created_at = "2026-07-12T09:59:59.999Z";
    }, "created_at_invalid"],
    ["non-canonical time", (input: any) => {
      input.created_at = "2026-07-12 10:00:01";
    }, "created_at_invalid"]
  ])("fails closed for %s", (_label, mutate, reason) => {
    const input = derivationInput([
      scenarioResult("trend_long", buyDecision(0.02, "valid")),
      scenarioResult("range_flat", holdDecision("valid"))
    ]);
    mutate(input);

    expect(() => deriveResearchBehaviorFingerprint(input)).toThrowError(
      expect.objectContaining({
        name: "ResearchBehaviorFingerprintUnavailableError",
        reason
      })
    );
    try {
      deriveResearchBehaviorFingerprint(input);
    } catch (error) {
      expect(error).toBeInstanceOf(ResearchBehaviorFingerprintUnavailableError);
    }
  });
});

function derivationInput(scenarioResults: TradingScenarioEvaluationResult[]) {
  return {
    commitment: commitmentFixture(),
    system_code_ref: { record_kind: "system_code", id: "system-code-submitted" },
    system_code_artifact_digest: digest("system-code-submitted"),
    scenario_results: scenarioResults,
    created_at: "2026-07-12T10:00:01.000Z"
  };
}

function scenarioResult(
  scenarioId: string,
  decision: Record<string, unknown>
): TradingScenarioEvaluationResult {
  return {
    scenario_id: scenarioId,
    runner_kind: "host_process",
    status: "accepted",
    run_status: "completed",
    score: 0.75,
    metrics: [{ name: "score", score: 0.75, detail: "development-only" }],
    summary: "development summary",
    risk_decision: "valid_order_request",
    profit_loss: {
      revenue_usdt: 10,
      cost_usdt: 2,
      net_revenue_usdt: 8,
      net_return_pct: 0.08
    },
    events_path: `/tmp/${scenarioId}.jsonl`,
    provider_request_count: 1,
    runner_command_count: 1,
    candidate_events: [{ event: "order_request", ...decision }],
    provider_requests: [providerRequest(decision)]
  };
}

function providerRequest(
  body: Record<string, unknown>,
  at = "2026-07-12T10:00:00.250Z"
) {
  return {
    at,
    method: "POST",
    path: "/orders/validate",
    body,
    response_status: 200
  };
}

function buyDecision(quantity: number, reason: string): Record<string, unknown> {
  return { symbol: "BTCUSDT", side: "buy", quantity, order_type: "market", reason };
}

function sellDecision(quantity: number, reason: string): Record<string, unknown> {
  return { symbol: "BTCUSDT", side: "sell", quantity, order_type: "market", reason };
}

function holdDecision(reason: string): Record<string, unknown> {
  return { symbol: "BTCUSDT", side: "hold", quantity: 0, order_type: "none", reason };
}

function commitmentFixture(): ResearchPreflightCommitmentRecord {
  const commitment: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: "preflight-tick-7-trend-following",
    candidate_arena_tick_id: "tick-7",
    research_direction_ref: {
      record_kind: "research_direction",
      id: "research-direction-trend-following"
    },
    research_worker_ref: {
      record_kind: "research_worker",
      id: "research-worker-trend-following"
    },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: "allocation-tick-7"
    },
    research_allocation_digest: digest("allocation-tick-7"),
    source_system_code_ref: { record_kind: "system_code", id: "source-system-code" },
    source_artifact_digest: digest("source-system-code"),
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: digest("pending-development-suite"),
      submission_limit: 2,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest("rotation"),
      suite_digest: digest("sealed-suite"),
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: "2026-07-12T10:00:00.000Z",
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("pending")
  };
  commitment.development_policy.suite_digest = developmentSuiteDigest();
  sealCommitment(commitment);
  return commitment;
}

function developmentSuiteDigest(): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonPersistedRecordDigestInput(
      researchDevelopmentReplayScenarios()
    ))
    .digest("hex")}`;
}

function sealCommitment(commitment: ResearchPreflightCommitmentRecord): void {
  commitment.commitment_digest = `sha256:${createHash("sha256")
    .update(researchPreflightCommitmentDigestInput(commitment))
    .digest("hex")}`;
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
