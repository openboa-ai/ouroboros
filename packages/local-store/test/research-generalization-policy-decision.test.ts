import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  paperTradingComparisonPersistedRecordDigestInput,
  researchGeneralizationOutcomeDigestInput,
  researchGeneralizationPolicyDecisionDigestInput,
  type ResearchGeneralizationOutcomeBlockResult,
  type ResearchGeneralizationOutcomeRecord,
  type ResearchGeneralizationPolicyDecisionRecord,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import {
  decideResearchGeneralizationPolicyDecision
} from "@ouroboros/application/candidate/research-generalization-policy-decision";
import { decideResearchGeneralizationProtocol } from
  "@ouroboros/application/candidate/research-generalization-protocol";
import { researchGeneralizationOutcomeId } from
  "@ouroboros/application/candidate/research-generalization-outcome";
import { LocalStore } from "../src/index";

describe("LocalStore ResearchGeneralizationPolicyDecision", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-generalization-policy-decision-"
    ));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("appends, reloads, orders, and replays exact decisions", async () => {
    const first = graph("supported", "store-first");
    const second = graph("negative", "store-second");
    const store = new DecisionGraphStore(root, [first, second]);
    await store.initialize();
    const firstDecision = decision(first, "2026-07-20T00:00:01.000Z");
    const secondDecision = decision(second, "2026-07-20T00:00:02.000Z");

    await expect(store.recordResearchGeneralizationPolicyDecision(
      secondDecision
    )).resolves.toEqual(secondDecision);
    await expect(store.recordResearchGeneralizationPolicyDecision(
      firstDecision
    )).resolves.toEqual(firstDecision);
    await expect(store.getResearchGeneralizationPolicyDecision(
      firstDecision.research_generalization_policy_decision_id
    )).resolves.toEqual(firstDecision);
    await expect(store.listResearchGeneralizationPolicyDecisions())
      .resolves.toEqual([firstDecision, secondDecision]);
    await expect(store.recordResearchGeneralizationPolicyDecision(
      firstDecision
    )).resolves.toEqual(firstDecision);
  });

  it("converges exact publication across independent stores", async () => {
    const source = graph("supported", "store-exact-race");
    const left = new DecisionGraphStore(root, [source]);
    const right = new DecisionGraphStore(root, [source]);
    await left.initialize();
    await right.initialize();
    const record = decision(source, "2026-07-20T00:00:01.000Z");

    await expect(Promise.all([
      left.recordResearchGeneralizationPolicyDecision(record),
      right.recordResearchGeneralizationPolicyDecision(
        structuredClone(record)
      )
    ])).resolves.toEqual([record, record]);
    await expect(left.listResearchGeneralizationPolicyDecisions())
      .resolves.toEqual([record]);
  });

  it("publishes one winner for conflicting decision bytes", async () => {
    const source = graph("supported", "store-conflict-race");
    const left = new DecisionGraphStore(root, [source]);
    const right = new DecisionGraphStore(root, [source]);
    await left.initialize();
    await right.initialize();
    const first = decision(source, "2026-07-20T00:00:01.000Z");
    const second = decision(source, "2026-07-20T00:00:02.000Z");

    const settled = await Promise.allSettled([
      left.recordResearchGeneralizationPolicyDecision(first),
      right.recordResearchGeneralizationPolicyDecision(second)
    ]);

    expect(settled.filter((result) => result.status === "fulfilled"))
      .toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected"))
      .toEqual([expect.objectContaining({
        reason: expect.objectContaining({
          code: "research_generalization_policy_decision_conflict"
        })
      })]);
  });

  it("rejects malformed bytes, digest drift, and non-deterministic identity", async () => {
    const source = graph("supported", "store-invalid-shape");
    const store = new DecisionGraphStore(root, [source]);
    await store.initialize();
    const canonical = decision(source, "2026-07-20T00:00:01.000Z");
    const malformed = { ...canonical, version: 2 };
    const digestDrift = { ...canonical, decided_at: "2026-07-20T00:00:02.000Z" };
    const identityDrift = {
      ...canonical,
      research_generalization_policy_decision_id: "other-decision"
    };
    resealDecision(identityDrift);

    await expect(store.recordResearchGeneralizationPolicyDecision(
      malformed as ResearchGeneralizationPolicyDecisionRecord
    )).rejects.toMatchObject({
      code: "invalid_research_generalization_policy_decision_input"
    });
    await expect(store.recordResearchGeneralizationPolicyDecision(
      digestDrift
    )).rejects.toMatchObject({
      code: "research_generalization_policy_decision_digest_mismatch"
    });
    await expect(store.recordResearchGeneralizationPolicyDecision(
      identityDrift
    )).rejects.toMatchObject({
      code: "research_generalization_policy_decision_identity_mismatch"
    });
  });

  it("rejects absent, drifted, and time-inverted source evidence", async () => {
    const source = graph("supported", "store-source-drift");
    const canonical = decision(source, "2026-07-20T00:00:01.000Z");
    const missing = new DecisionGraphStore(root, [{
      protocol: source.protocol,
      outcome: undefined
    }]);
    await missing.initialize();

    await expect(missing.recordResearchGeneralizationPolicyDecision(canonical))
      .rejects.toMatchObject({
        code: "research_generalization_policy_decision_reference_not_found"
      });

    const store = new DecisionGraphStore(root, [source]);
    const protocolDigestDrift = structuredClone(canonical);
    protocolDigestDrift.protocol_digest = digest("f");
    resealDecision(protocolDigestDrift);
    const outcomeDigestDrift = structuredClone(canonical);
    outcomeDigestDrift.generalization_outcome_digest = digest("e");
    resealDecision(outcomeDigestDrift);
    const policyDrift = structuredClone(canonical);
    policyDrift.target_allocation_policy_digest = digest("d");
    resealDecision(policyDrift);
    const preOutcome = structuredClone(canonical);
    preOutcome.decided_at = source.outcome.adjudicated_at;
    resealDecision(preOutcome);

    for (const candidate of [
      protocolDigestDrift,
      outcomeDigestDrift,
      policyDrift,
      preOutcome
    ]) {
      await expect(store.recordResearchGeneralizationPolicyDecision(candidate))
        .rejects.toMatchObject({
          code: "research_generalization_policy_decision_reference_mismatch"
        });
    }
  });

  it("rejects false approval and false non-approval", async () => {
    const supported = graph("supported", "store-false-non-approval");
    const supportedDecision = decision(
      supported,
      "2026-07-20T00:00:01.000Z"
    );
    supportedDecision.decision_status = "not_approved";
    supportedDecision.decision_reason = "generalization_outcome_not_eligible";
    supportedDecision.effective_default_mode = null;
    resealDecision(supportedDecision);
    const negative = graph("negative", "store-false-approval");
    const negativeDecision = decision(
      negative,
      "2026-07-20T00:00:01.000Z"
    );
    negativeDecision.decision_status = "approved";
    negativeDecision.decision_reason =
      "supported_cross_condition_adaptive_effect";
    negativeDecision.effective_default_mode = "adaptive_default";
    resealDecision(negativeDecision);
    const store = new DecisionGraphStore(root, [supported, negative]);
    await store.initialize();

    await expect(store.recordResearchGeneralizationPolicyDecision(
      supportedDecision
    )).rejects.toMatchObject({
      code: "research_generalization_policy_decision_reference_mismatch"
    });
    await expect(store.recordResearchGeneralizationPolicyDecision(
      negativeDecision
    )).rejects.toMatchObject({
      code: "research_generalization_policy_decision_reference_mismatch"
    });
  });

  it("rejects corrupt persisted decisions during reload", async () => {
    const source = graph("supported", "store-corrupt-reload");
    const store = new DecisionGraphStore(root, [source]);
    await store.initialize();
    const itemRoot = path.join(
      root,
      "research-generalization-policy-decisions",
      "items"
    );
    await mkdir(itemRoot, { recursive: true });
    await writeFile(path.join(itemRoot, "corrupt.json"), JSON.stringify({
      record_kind: "research_generalization_policy_decision",
      research_generalization_policy_decision_id: "corrupt"
    }));

    await expect(store.listResearchGeneralizationPolicyDecisions())
      .rejects.toMatchObject({
        code: "research_generalization_policy_decision_reload_failed"
      });
  });
});

type EvidenceKind = "supported" | "negative";
type Graph = {
  protocol: ResearchGeneralizationProtocolRecord;
  outcome: ResearchGeneralizationOutcomeRecord;
};

class DecisionGraphStore extends LocalStore {
  private readonly protocols = new Map<string, ResearchGeneralizationProtocolRecord>();
  private readonly outcomes = new Map<string, ResearchGeneralizationOutcomeRecord>();

  constructor(
    root: string,
    sources: Array<{
      protocol: ResearchGeneralizationProtocolRecord;
      outcome?: ResearchGeneralizationOutcomeRecord;
    }>
  ) {
    super(root);
    for (const source of sources) {
      this.protocols.set(
        source.protocol.research_generalization_protocol_id,
        structuredClone(source.protocol)
      );
      if (source.outcome) {
        this.outcomes.set(
          source.outcome.research_generalization_outcome_id,
          structuredClone(source.outcome)
        );
      }
    }
  }

  override async getResearchGeneralizationProtocol(id: string) {
    return structuredClone(this.protocols.get(id));
  }

  override async getResearchGeneralizationOutcome(id: string) {
    return structuredClone(this.outcomes.get(id));
  }
}

function graph(kind: EvidenceKind, token: string): Graph {
  const protocol = decideResearchGeneralizationProtocol({
    idempotencyKey: token,
    targetAllocationPolicy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
    researchAgent: {
      provider: "fixture",
      model: "scripted-fixture",
      permission_policy: "fixture_only"
    },
    paperEvaluationProtocol: boundPaperProtocol(),
    campaignPolicy: campaignPolicy(),
    committedAt: "2026-07-13T00:00:00.000Z"
  });
  const effects = kind === "supported"
    ? [1, 0.8, 0.6, 0.4, 0.2, 0.1]
    : [1, 0.8, 0.6, 0.4, -0.1, -0.3];
  return { protocol, outcome: outcome(protocol, effects) };
}

function outcome(
  protocol: ResearchGeneralizationProtocolRecord,
  effects: number[]
): ResearchGeneralizationOutcomeRecord {
  const baselineCharacters = ["1", "2", "3", "1", "2", "3"];
  const slots = protocol.study_slots.map((slot, index) => {
    const effect = effects[index]!;
    return {
      slot_index: slot.slot_index,
      condition_block: slot.condition_block,
      condition_block_study_index: slot.condition_block_study_index,
      planned_study_ref: { ...slot.study_ref },
      slot_status: "completed" as const,
      status_reason: "eligible_terminal_study" as const,
      study_ref: { ...slot.study_ref },
      study_digest: digest(String.fromCharCode(97 + index)),
      study_outcome_ref: {
        record_kind: "research_control_study_outcome",
        id: `${slot.study_ref.id}-outcome`
      },
      study_outcome_digest: digest(String(index)),
      baseline_snapshot_digest: digest(baselineCharacters[index]!),
      source_system_code_artifact_digest:
        digest(["6", "7", "8", "9", "a", "b"][index]!),
      observed_rate_difference: effect,
      study_effect_status: effect > 0
        ? "adaptive_positive" as const
        : "static_positive" as const
    };
  });
  const blocks = (["long", "short", "flat"] as const).map((block, index) =>
    blockResult(block, slots.slice(index * 2, index * 2 + 2))
  ) as ResearchGeneralizationOutcomeRecord["block_results"];
  const adaptive = effects.filter((effect) => effect > 0).length;
  const staticPositive = effects.filter((effect) => effect < 0).length;
  const pValue = signPValue(adaptive, staticPositive);
  const equalMean = round6(blocks.reduce(
    (sum, block) => sum + Number(block.mean_rate_difference),
    0
  ) / 3);
  const harmful = blocks.filter((block) =>
    Number(block.mean_rate_difference) <= 0
  ).map((block) => block.condition_block);
  const supported = pValue <= 0.05 && equalMean > 0 && harmful.length === 0;
  const record: ResearchGeneralizationOutcomeRecord = {
    record_kind: "research_generalization_outcome",
    version: 1,
    research_generalization_outcome_id:
      researchGeneralizationOutcomeId(protocol),
    protocol_ref: {
      record_kind: "research_generalization_protocol",
      id: protocol.research_generalization_protocol_id
    },
    protocol_digest: protocol.protocol_digest,
    target_allocation_policy_digest: protocol.target_allocation_policy_digest,
    slot_results: slots,
    block_results: blocks,
    planned_study_count: 6,
    completed_study_count: 6,
    non_tied_study_count: 6,
    tied_study_count: 0,
    missing_study_count: 0,
    ineligible_study_count: 0,
    adaptive_positive_count: adaptive,
    static_positive_count: staticPositive,
    distinct_baseline_count: 3,
    equal_weight_mean_rate_difference: equalMean,
    exact_sign_test_p_value: pValue,
    harmful_condition_blocks: harmful,
    inference_status: supported
      ? "generalization_supported"
      : "generalization_not_supported",
    causal_scope:
      "pre_effect_market_condition_blocked_cross_baseline_study_effects",
    policy_decision_eligibility: supported
      ? "eligible_for_separate_generalization_policy_decision"
      : "not_eligible",
    next_action: supported
      ? "review_broad_research_allocation_policy"
      : "retain_negative_generalization_evidence",
    adjudicated_at: "2026-07-20T00:00:00.000Z",
    outcome_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  record.outcome_digest = exactDigest(
    researchGeneralizationOutcomeDigestInput(record)
  );
  return record;
}

function decision(graph: Graph, decidedAt: string) {
  return decideResearchGeneralizationPolicyDecision({
    ...graph,
    decidedAt
  });
}

function blockResult(
  conditionBlock: "long" | "short" | "flat",
  slots: Array<{ observed_rate_difference: number; baseline_snapshot_digest: string }>
): ResearchGeneralizationOutcomeBlockResult {
  const effects = slots.map((slot) => slot.observed_rate_difference);
  const adaptive = effects.filter((effect) => effect > 0).length;
  const staticPositive = effects.filter((effect) => effect < 0).length;
  const mean = round6(effects.reduce((sum, effect) => sum + effect, 0) / 2);
  return {
    condition_block: conditionBlock,
    planned_study_count: 2,
    completed_study_count: 2,
    non_tied_study_count: 2,
    tied_study_count: 0,
    missing_study_count: 0,
    ineligible_study_count: 0,
    adaptive_positive_count: adaptive,
    static_positive_count: staticPositive,
    distinct_baseline_count: new Set(slots.map((slot) =>
      slot.baseline_snapshot_digest
    )).size,
    mean_rate_difference: mean,
    block_status: mean > 0 ? "complete_positive" : "complete_non_positive"
  };
}

function boundPaperProtocol() {
  return {
    protocol_status: "bound" as const,
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge" as const,
      symbol: "BTCUSDT" as const,
      interval_ms: 60_000,
      minimum_observation_count: 2,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 2,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 2,
      primary_metric: "net_revenue_usdt" as const,
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true as const,
      require_both_qualified: true as const,
      release_policy: "sealed_until_adjudication" as const
    },
    market_data_configuration_digest: digest("5"),
    paper_policy_identity: {
      market_data_policy_version: "market-v1",
      gateway_policy_version: "gateway-v1",
      cost_policy_version: "cost-v1",
      funding_policy_version: "funding-v1",
      slippage_policy_version: "slippage-v1",
      fill_policy_version: "fill-v1",
      risk_policy_version: "risk-v1",
      paper_account_policy_version: "account-v1",
      decision_event_protocol_version: "decision-v1",
      persistent_state_boundary_version: "state-v1"
    },
    schedule_policy: {
      policy_version: "research-control-paper-schedule-v1" as const,
      source_start_order: "paired_by_sequence" as const,
      maximum_active_source_pairs: 2 as const,
      maximum_cross_arm_first_tick_skew_ms: 5_000,
      source_missed_start_policy: "slot_expired" as const,
      confirmation_precommit_deadline_ms: 600_000
    }
  };
}

function campaignPolicy() {
  return {
    policy_version: "research_control_campaign_v1" as const,
    tick_count_per_arm: 1,
    worker_slot_count_per_tick: 3 as const,
    concurrency_limit_per_arm: 2 as const,
    maximum_total_development_submissions_per_tick: 5 as const,
    arm_execution_policy: "concurrent_per_sequence" as const,
    maximum_baseline_regular_file_count: 10_000,
    maximum_baseline_total_bytes: 1_000_000_000,
    paper_candidate_slot_count_per_arm: 1,
    paper_candidate_reservation_rule:
      "first_admitted_per_tick_in_allocation_order" as const,
    primary_metric_kind:
      "prospective_qualified_candidate_discovery_rate" as const,
    required_future_evidence:
      "confirmed_comparison_research_release" as const
  };
}

function resealDecision(
  record: ResearchGeneralizationPolicyDecisionRecord
): void {
  record.policy_decision_digest = exactDigest(
    researchGeneralizationPolicyDecisionDigestInput(record)
  );
}

function exactDigest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function signPValue(positive: number, negative: number): number {
  const count = positive + negative;
  const lower = Math.min(positive, negative);
  let combinations = 0;
  for (let index = 0; index <= lower; index += 1) {
    combinations += combination(count, index);
  }
  return round6(Math.min(1, 2 * combinations / 2 ** count));
}

function combination(count: number, selected: number): number {
  let result = 1;
  for (let index = 1; index <= selected; index += 1) {
    result = result * (count - index + 1) / index;
  }
  return result;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
