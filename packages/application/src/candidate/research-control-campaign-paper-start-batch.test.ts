import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  researchControlCampaignPaperScheduleDigestInput,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonSide,
  type PaperTradingComparisonTickRecord,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignRecord
} from "@ouroboros/domain";
import { decideResearchControlCampaign } from "./research-control-campaign";
import {
  decideResearchControlCampaignPaperStartBatch,
  researchControlCampaignPaperStartBatchId,
  ResearchControlCampaignPaperStartBatchDecisionError,
  type DecideResearchControlCampaignPaperStartBatchInput,
  type ResearchControlCampaignPaperStartBatchSource
} from "./research-control-campaign-paper-start-batch";

describe("ResearchControlCampaignPaperStartBatch decision", () => {
  it("builds exact source commitment and first-tick fixtures", () => {
    const fixture = batchFixture();
    expect(fixture.input.sources.map((source) => ({
      commitment_shape:
        paperTradingComparisonCommitmentHasRuntimeShape(source.comparison),
      commitment_digest: source.comparison.commitment_digest === canonicalDigest(
        paperTradingComparisonCommitmentDigestInput(source.comparison)
      ),
      tick_shape: paperTradingComparisonTickHasRuntimeShape(source.firstTick),
      tick_digest: source.firstTick?.tick_digest === canonicalDigest(
        paperTradingComparisonTickDigestInput(source.firstTick!)
      )
    }))).toEqual([
      {
        commitment_shape: true,
        commitment_digest: true,
        tick_shape: true,
        tick_digest: true
      },
      {
        commitment_shape: true,
        commitment_digest: true,
        tick_shape: true,
        tick_digest: true
      }
    ]);
  });

  it("seals one paired ready batch from exact shared first-tick evidence", () => {
    const fixture = batchFixture();

    const batch = decideResearchControlCampaignPaperStartBatch(fixture.input);

    expect(batch).toMatchObject({
      research_control_campaign_paper_start_batch_id:
        researchControlCampaignPaperStartBatchId(fixture.schedule, 1),
      batch_status: "paired_ready",
      sides: [
        {
          arm_kind: "adaptive_treatment",
          source_comparison_ref: { id: "adaptive-source-comparison" },
          first_tick_ref: { id: "adaptive-source-first-tick" }
        },
        {
          arm_kind: "static_control",
          source_comparison_ref: { id: "static-source-comparison" },
          first_tick_ref: { id: "static-source-first-tick" }
        }
      ],
      source_start_deadline_at: "2026-07-12T12:10:00.000Z",
      shared_market_snapshot_digest: expect.stringMatching(
        /^sha256:[a-f0-9]{64}$/
      ),
      shared_public_execution_snapshot_digest: expect.stringMatching(
        /^sha256:[a-f0-9]{64}$/
      ),
      evaluation_authority: "external_to_trading_systems",
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
  });

  it("seals a single ready batch when the peer report slot has no candidate", () => {
    const fixture = batchFixture({ staticCandidate: false });

    expect(decideResearchControlCampaignPaperStartBatch(fixture.input))
      .toMatchObject({
        batch_status: "single_ready",
        sides: [{ arm_kind: "adaptive_treatment" }]
      });
  });

  it.each([
    ["first_tick_incomplete", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.sources[1]!.firstTick = undefined;
      fixture.input.evaluatedAt = fixture.input.sourceStartDeadlineAt;
    }],
    ["cross_arm_first_tick_mismatch", (
      fixture: ReturnType<typeof batchFixture>
    ) => {
      const tick = structuredClone(fixture.input.sources[1]!.firstTick!);
      tick.market_snapshot.price += 1;
      fixture.input.sources[1]!.firstTick = finalizeTick(tick);
    }],
    ["source_start_deadline_missed", (
      fixture: ReturnType<typeof batchFixture>
    ) => {
      const tick = structuredClone(fixture.input.sources[1]!.firstTick!);
      tick.observed_at = "2026-07-12T12:10:00.001Z";
      tick.market_snapshot.observed_at = "2026-07-12T12:10:00.001Z";
      tick.public_execution_snapshot.observed_at =
        "2026-07-12T12:10:00.001Z";
      fixture.input.sources[1]!.firstTick = finalizeTick(tick);
      fixture.input.evaluatedAt = tick.observed_at;
    }]
  ])("derives %s without caller classification", (reason, mutate) => {
    const fixture = batchFixture();
    mutate(fixture);

    expect(decideResearchControlCampaignPaperStartBatch(fixture.input))
      .toMatchObject({
        batch_status: "ineligible",
        ineligible_reason: reason
      });
  });

  it("closes a prepared single source whose first tick missed the deadline", () => {
    const fixture = batchFixture({ staticCandidate: false });
    fixture.input.sources[0]!.firstTick = undefined;
    fixture.input.evaluatedAt = fixture.input.sourceStartDeadlineAt;

    expect(decideResearchControlCampaignPaperStartBatch(fixture.input))
      .toMatchObject({
        batch_status: "ineligible",
        ineligible_reason: "first_tick_incomplete",
        sides: [{ arm_kind: "adaptive_treatment" }]
      });
  });

  it("keeps deterministic identity and digest across exact replay", () => {
    const fixture = batchFixture();
    const first = decideResearchControlCampaignPaperStartBatch(fixture.input);
    const replay = decideResearchControlCampaignPaperStartBatch(
      structuredClone(fixture.input)
    );

    expect(replay).toEqual(first);
  });

  it.each([
    ["early incomplete", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.sources[1]!.firstTick = undefined;
    }],
    ["deadline drift", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.sourceStartDeadlineAt = "2026-07-12T12:10:00.001Z";
    }],
    ["schedule campaign drift", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.schedule.campaign_digest = digest("f");
      fixture.schedule = finalizeSchedule(fixture.schedule);
      fixture.input.schedule = fixture.schedule;
    }],
    ["source comparison substitution", (
      fixture: ReturnType<typeof batchFixture>
    ) => {
      fixture.input.sources[0]!.comparison
        .paper_trading_comparison_commitment_id = "substituted-comparison";
      fixture.input.sources[0]!.comparison = finalizeComparison(
        fixture.input.sources[0]!.comparison
      );
    }],
    ["challenger substitution", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.sources[0]!.comparison.challenger.candidate_ref.id =
        "substituted-candidate";
      fixture.input.sources[0]!.comparison = finalizeComparison(
        fixture.input.sources[0]!.comparison
      );
    }],
    ["comparison policy drift", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.sources[0]!.comparison.comparison_policy.maximum_elapsed_ms +=
        1;
      fixture.input.sources[0]!.comparison = finalizeComparison(
        fixture.input.sources[0]!.comparison
      );
    }],
    ["non-first tick", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.sources[0]!.firstTick!.sequence = 2;
      fixture.input.sources[0]!.firstTick = finalizeTick(
        fixture.input.sources[0]!.firstTick!
      );
    }],
    ["tick comparison drift", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.sources[0]!.firstTick!
        .paper_trading_comparison_commitment_ref.id = "other-comparison";
      fixture.input.sources[0]!.firstTick = finalizeTick(
        fixture.input.sources[0]!.firstTick!
      );
    }],
    ["evaluation before tick", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.evaluatedAt = "2026-07-12T12:00:00.500Z";
    }],
    ["extra source", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.sources.push(structuredClone(fixture.input.sources[0]!));
    }],
    ["no candidate sources", (fixture: ReturnType<typeof batchFixture>) => {
      fixture.input.sources = [];
    }]
  ])("rejects %s", (_label, mutate) => {
    const fixture = batchFixture();
    mutate(fixture);

    expect(() => decideResearchControlCampaignPaperStartBatch(fixture.input))
      .toThrow(ResearchControlCampaignPaperStartBatchDecisionError);
  });
});

function batchFixture(options: { staticCandidate?: boolean } = {}) {
  const campaign = campaignFixture();
  const schedule = scheduleFixture(
    campaign,
    options.staticCandidate ?? true
  );
  const adaptive = sourceFixture(campaign, schedule, "adaptive_treatment");
  const sources: ResearchControlCampaignPaperStartBatchSource[] =
    options.staticCandidate === false
    ? [adaptive]
    : [
        adaptive,
        sourceFixture(campaign, schedule, "static_control")
      ];
  const input: DecideResearchControlCampaignPaperStartBatchInput = {
    campaign,
    schedule,
    sequence: 1,
    sources,
    sourceStartDeadlineAt: "2026-07-12T12:10:00.000Z",
    evaluatedAt: "2026-07-12T12:00:02.000Z"
  };
  return { campaign, schedule, input };
}

function campaignFixture(): ResearchControlCampaignRecord {
  return decideResearchControlCampaign({
    idempotencyKey: "paper-start-batch-campaign",
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("1"),
      regular_file_count: 1,
      total_bytes: 1,
      exclusion_policy: "research_control_campaign_evidence_only"
    },
    source: {
      candidate_ref: { record_kind: "trading_system_candidate", id: "source" },
      candidate_version_ref: { record_kind: "candidate_version", id: "source-v1" },
      system_code_ref: { record_kind: "system_code", id: "source-code" },
      system_code_artifact_digest: digest("2"),
      system_code_record_digest: digest("3"),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("4")
    },
    researchAgent: {
      id: "fixture",
      provider: "fixture",
      permission_policy: "fixture_only"
    },
    paperComparator: {
      comparator_status: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: "promotion-001"
      },
      trading_promotion_digest: digest("5"),
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: "champion-candidate"
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: "champion-version"
      },
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "champion-evaluation"
      }
    },
    paperEvaluationProtocol: {
      protocol_status: "bound",
      comparison_policy: comparisonPolicy(),
      market_data_configuration_digest: digest("6"),
      paper_policy_identity: paperPolicyIdentity(),
      schedule_policy: {
        policy_version: "research-control-paper-schedule-v1",
        source_start_order: "paired_by_sequence",
        maximum_active_source_pairs: 2,
        maximum_cross_arm_first_tick_skew_ms: 5_000,
        source_missed_start_policy: "slot_expired",
        confirmation_precommit_deadline_ms: 600_000
      }
    },
    tickCountPerArm: 1,
    committedAt: "2026-07-12T11:00:00.000Z"
  });
}

function scheduleFixture(
  campaign: ResearchControlCampaignRecord,
  staticCandidate: boolean
): ResearchControlCampaignPaperScheduleRecord {
  if (campaign.paper_comparator.comparator_status !== "trading_review" ||
    campaign.paper_evaluation_protocol.protocol_status !== "bound") {
    throw new Error("fixture_expected_bound_campaign");
  }
  return finalizeSchedule({
    record_kind: "research_control_campaign_paper_schedule",
    version: 1,
    research_control_campaign_paper_schedule_id: "paper-start-schedule",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    report_ref: {
      record_kind: "research_control_campaign_report",
      id: "paper-start-report"
    },
    report_digest: digest("7"),
    paper_comparator: structuredClone(campaign.paper_comparator),
    paper_evaluation_protocol_digest:
      campaign.paper_evaluation_protocol.protocol_digest,
    arms: [
      {
        arm_kind: "adaptive_treatment",
        slots: [scheduleCandidateSlot("adaptive")]
      },
      {
        arm_kind: "static_control",
        slots: [staticCandidate
          ? scheduleCandidateSlot("static")
          : {
              sequence: 1,
              tick_ref: {
                record_kind: "candidate_arena_tick",
                id: "static-research-tick"
              },
              slot_status: "no_admitted_candidate"
            }]
      }
    ],
    committed_at: "2026-07-12T12:00:00.000Z",
    schedule_digest: digest("0"),
    paper_evaluation_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  });
}

function scheduleCandidateSlot(token: "adaptive" | "static") {
  return {
    sequence: 1,
    tick_ref: {
      record_kind: "candidate_arena_tick" as const,
      id: `${token}-research-tick`
    },
    slot_status: "candidate_scheduled" as const,
    candidate_ref: {
      record_kind: "trading_system_candidate" as const,
      id: `${token}-candidate`
    },
    candidate_version_ref: {
      record_kind: "candidate_version" as const,
      id: `${token}-version`
    },
    system_code_ref: {
      record_kind: "system_code" as const,
      id: `${token}-code`
    },
    system_code_artifact_digest: digest(token === "adaptive" ? "8" : "9"),
    admission_decision_ref: {
      record_kind: "candidate_admission_decision" as const,
      id: `${token}-admission`
    },
    source_comparison_idempotency_key: `${token}-source-key`,
    source_preparation_id: `${token}-source-preparation`,
    source_comparison_commitment_id: `${token}-source-comparison`,
    maximum_source_start_delay_ms: 600_000
  };
}

function sourceFixture(
  campaign: ResearchControlCampaignRecord,
  schedule: ResearchControlCampaignPaperScheduleRecord,
  armKind: "adaptive_treatment" | "static_control"
) {
  if (campaign.paper_comparator.comparator_status !== "trading_review" ||
    campaign.paper_evaluation_protocol.protocol_status !== "bound") {
    throw new Error("fixture_expected_bound_campaign");
  }
  const arm = schedule.arms.find((candidate) => candidate.arm_kind === armKind)!;
  const slot = arm.slots[0]!;
  if (slot.slot_status !== "candidate_scheduled") {
    throw new Error("fixture_expected_candidate_slot");
  }
  const token = armKind === "adaptive_treatment" ? "adaptive" : "static";
  const comparison = finalizeComparison({
    record_kind: "paper_trading_comparison_commitment",
    version: 1,
    paper_trading_comparison_commitment_id:
      slot.source_comparison_commitment_id,
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: slot.source_preparation_id
    },
    champion: comparisonSide("champion", {
      candidateId: campaign.paper_comparator.candidate_ref.id,
      candidateVersionId: campaign.paper_comparator.candidate_version_ref.id,
      systemCodeId: "champion-code",
      admissionId: "champion-admission",
      artifactDigest: digest("a")
    }),
    challenger: comparisonSide("challenger", {
      candidateId: slot.candidate_ref.id,
      candidateVersionId: slot.candidate_version_ref.id,
      systemCodeId: slot.system_code_ref.id,
      admissionId: slot.admission_decision_ref.id,
      artifactDigest: slot.system_code_artifact_digest
    }),
    champion_selection: {
      selection_kind: "trading_review",
      trading_promotion_ref: {
        ...campaign.paper_comparator.trading_promotion_ref
      },
      trading_promotion_digest:
        campaign.paper_comparator.trading_promotion_digest,
      paper_trading_evaluation_ref: {
        ...campaign.paper_comparator.paper_trading_evaluation_ref
      },
      paper_trading_evaluation_record_digest: digest("5"),
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "champion-authority-commitment"
      },
      paper_trading_evaluation_commitment_record_digest: digest("6"),
      paper_trading_observation_chain_digest: digest("7")
    },
    comparison_policy: structuredClone(
      campaign.paper_evaluation_protocol.comparison_policy
    ),
    market_data_configuration_digest:
      campaign.paper_evaluation_protocol.market_data_configuration_digest,
    paper_policy_identity: structuredClone(
      campaign.paper_evaluation_protocol.paper_policy_identity
    ),
    committed_at: "2026-07-12T12:00:00.100Z",
    commitment_digest: digest("0"),
    authority_status: "not_live"
  });
  return {
    armKind,
    comparison,
    firstTick: firstTickFixture(comparison, token)
  };
}

function comparisonSide(
  role: "champion" | "challenger",
  input: {
    candidateId: string;
    candidateVersionId: string;
    systemCodeId: string;
    admissionId: string;
    artifactDigest: string;
  }
): PaperTradingComparisonSide {
  return {
    role,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: input.candidateId
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: input.candidateVersionId
    },
    candidate_version_digest: digest(role === "champion" ? "b" : "c"),
    system_code_ref: { record_kind: "system_code", id: input.systemCodeId },
    system_code_record_digest: digest(role === "champion" ? "d" : "e"),
    system_code_artifact_digest: input.artifactDigest,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: input.admissionId
    },
    admission_decision_digest: digest(role === "champion" ? "f" : "1"),
    trading_run_ref: { record_kind: "trading_run", id: `${role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${role}-paper-commitment`
    },
    paper_trading_evaluation_commitment_digest: digest("2"),
    paper_trading_evaluation_commitment_record_digest: digest("3"),
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-paper-evaluation`
    },
    paper_trading_evaluation_record_digest: digest("4")
  };
}

function firstTickFixture(
  comparison: PaperTradingComparisonCommitmentRecord,
  token: "adaptive" | "static"
): PaperTradingComparisonTickRecord {
  return finalizeTick({
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: `${token}-source-first-tick`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    sequence: 1,
    market_data_configuration_digest:
      comparison.market_data_configuration_digest,
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000,
      moving_average_fast: 60_100,
      moving_average_slow: 59_900,
      volatility: 0.01,
      expected_direction: "long",
      observed_at: "2026-07-12T12:00:00.500Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      authority_status: "read_only"
    },
    public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: "2026-07-12T12:00:00.600Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      stream_marker: "shared-start",
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: token === "adaptive"
      ? "2026-07-12T12:00:01.000Z"
      : "2026-07-12T12:00:02.000Z",
    tick_digest: digest("0"),
    authority_status: "not_live"
  });
}

function comparisonPolicy() {
  return {
    policy_version: "paper-comparison-v1",
    comparison_mode: "champion_challenge" as const,
    symbol: "BTCUSDT" as const,
    interval_ms: 60_000,
    minimum_observation_count: 1,
    minimum_elapsed_ms: 60_000,
    maximum_observation_count: 2,
    maximum_elapsed_ms: 600_000,
    maximum_start_skew_ms: 5_000,
    maximum_provider_request_count_per_side: 100,
    maximum_retry_count_per_side: 2,
    primary_metric: "net_revenue_usdt" as const,
    minimum_net_revenue_lift_usdt: 1,
    required_confirmation_count: 1,
    require_non_overlapping_windows: true as const,
    require_both_qualified: true as const,
    release_policy: "sealed_until_adjudication" as const
  };
}

function paperPolicyIdentity() {
  return {
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
  };
}

function finalizeSchedule(
  schedule: ResearchControlCampaignPaperScheduleRecord
): ResearchControlCampaignPaperScheduleRecord {
  return {
    ...schedule,
    schedule_digest: canonicalDigest(
      researchControlCampaignPaperScheduleDigestInput(schedule)
    )
  };
}

function finalizeComparison(
  comparison: PaperTradingComparisonCommitmentRecord
): PaperTradingComparisonCommitmentRecord {
  return {
    ...comparison,
    commitment_digest: canonicalDigest(
      paperTradingComparisonCommitmentDigestInput(comparison)
    )
  };
}

function finalizeTick(
  tick: PaperTradingComparisonTickRecord
): PaperTradingComparisonTickRecord {
  return {
    ...tick,
    tick_digest: canonicalDigest(paperTradingComparisonTickDigestInput(tick))
  };
}

function canonicalDigest(value: string | unknown): string {
  const text = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}
