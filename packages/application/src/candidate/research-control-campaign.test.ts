import { describe, expect, it } from "vitest";
import {
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignReportHasRuntimeShape,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickRecord,
  type ResearchControlCampaignArmIntentRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchPopulationDiversityReadModel
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import {
  ResearchControlCampaignDecisionError,
  ResearchControlCampaignService,
  buildResearchControlCampaignReport,
  decideResearchControlCampaign,
  decideResearchControlCampaignArmIntent,
  type ResearchControlCampaignArmEvidenceInput
} from "./research-control-campaign";
import { decideCandidateArenaResearchAllocation } from "./research-allocation";

describe("ResearchControlCampaign application", () => {
  it("precommits deterministic equal-bound treatment and control arms", () => {
    const campaign = decideResearchControlCampaign(campaignInput());

    expect(researchControlCampaignHasRuntimeShape(campaign)).toBe(true);
    expect(campaign.arms.map((arm) => [
      arm.arm_kind,
      arm.allocation_mode,
      arm.tick_ids.length
    ])).toEqual([
      ["adaptive_treatment", "adaptive_default", 2],
      ["static_control", "static_control", 2]
    ]);
    expect(campaign.policy).toMatchObject({
      tick_count_per_arm: 2,
      worker_slot_count_per_tick: 3,
      concurrency_limit_per_arm: 2,
      maximum_total_development_submissions_per_tick: 5,
      paper_candidate_slot_count_per_arm: 2
    });
    expect(new Set(campaign.arms.flatMap((arm) => arm.tick_ids)).size).toBe(4);
    expect(campaign.campaign_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("returns byte-equivalent commitments for the same exact decision input", () => {
    expect(decideResearchControlCampaign(campaignInput())).toEqual(
      decideResearchControlCampaign(campaignInput())
    );
  });

  it.each([
    ["empty idempotency key", (value: any) => { value.idempotencyKey = ""; }],
    ["zero ticks", (value: any) => { value.tickCountPerArm = 0; }],
    ["too many ticks", (value: any) => { value.tickCountPerArm = 6; }],
    ["snapshot above file bound", (value: any) => {
      value.baseline.regular_file_count = 10_001;
    }],
    ["snapshot above byte bound", (value: any) => {
      value.baseline.total_bytes = 1_000_000_001;
    }],
    ["invalid source closure digest", (value: any) => {
      value.source.research_artifact_closure_digest = "sha256:short";
    }],
    ["noncanonical time", (value: any) => {
      value.committedAt = "2026-07-12 10:00:00";
    }]
  ])("rejects %s before persistence", (_label, mutate) => {
    const input = campaignInput() as any;
    mutate(input);
    expect(() => decideResearchControlCampaign(input)).toThrow(
      ResearchControlCampaignDecisionError
    );
  });

  it("persists one campaign and reuses the exact idempotent record", async () => {
    const store = new CampaignStoreDouble();
    const service = new ResearchControlCampaignService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T10:00:00.000Z"
    });

    const first = await service.commit(campaignRequest());
    const second = await service.commit(campaignRequest());

    expect(second).toEqual(first);
    expect(store.campaignWrites).toBe(1);
  });

  it("fails closed when an idempotency key is reused for another baseline", async () => {
    const store = new CampaignStoreDouble();
    const service = new ResearchControlCampaignService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T10:00:00.000Z"
    });
    await service.commit(campaignRequest());

    await expect(service.commit({
      ...campaignRequest(),
      baseline: {
        ...campaignRequest().baseline,
        snapshot_digest: digest("9")
      }
    })).rejects.toMatchObject({
      code: "research_control_campaign_request_conflict"
    });
  });

  it("creates exact arm intents and reuses them without another write", async () => {
    const store = new CampaignStoreDouble();
    const service = new ResearchControlCampaignService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T10:00:01.000Z"
    });
    const campaign = decideResearchControlCampaign(campaignInput({
      tickCountPerArm: 1
    }));
    store.campaigns.set(campaign.research_control_campaign_id, campaign);

    const first = await service.commitArmIntent({
      campaign,
      armKind: "adaptive_treatment"
    });
    const second = await service.commitArmIntent({
      campaign,
      armKind: "adaptive_treatment"
    });

    expect(first).toEqual(decideResearchControlCampaignArmIntent({
      campaign,
      armKind: "adaptive_treatment",
      committedAt: "2026-07-12T10:00:01.000Z"
    }));
    expect(second).toEqual(first);
    expect(store.intentWrites).toBe(1);
  });

  it("builds a research-only report and reserves the first admitted candidate per tick", () => {
    const fixture = reportEvidenceFixture();
    const report = buildResearchControlCampaignReport({
      campaign: fixture.campaign,
      arms: fixture.arms,
      completedAt: "2026-07-12T10:30:01.000Z"
    });

    expect(researchControlCampaignReportHasRuntimeShape(report)).toBe(true);
    expect(report).toMatchObject({
      primary_outcome_status: "unadjudicated",
      causal_conclusion: "not_available_from_research_phase",
      next_action: "schedule_prospective_paper_slots",
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false
    });
    expect(report.arms[0].diagnostics).toEqual({
      attempt_count: 3,
      admitted_candidate_count: 1,
      duplicate_count: 1,
      quarantined_count: 0,
      failed_count: 1,
      provider_request_total: 9,
      runner_command_total: 5,
      scenario_count: 12,
      elapsed_ms: 300
    });
    expect(report.arms[0].paper_candidate_slots).toEqual([{
      sequence: 1,
      tick_ref: {
        record_kind: "candidate_arena_tick",
        id: fixture.arms[0].ticks[0]!.candidate_arena_tick_id
      },
      status: "candidate_reserved",
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: "candidate-adaptive"
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: "candidate-version-adaptive"
      },
      system_code_ref: {
        record_kind: "system_code",
        id: "system-code-adaptive"
      },
      system_code_artifact_digest: digest("7"),
      admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "admission-adaptive"
      }
    }]);
    expect(JSON.stringify(report)).not.toMatch(
      /winner|fingerprint_digest|suite_digest|sealed_terminal_score/
    );
  });

  it("freezes an empty paper slot when a tick admits no candidate", () => {
    const fixture = reportEvidenceFixture();
    const adaptive = fixture.arms[0];
    adaptive.ticks[0] = noCandidateTick(adaptive.ticks[0]!);
    adaptive.populationDiversity = noCandidateDiversity(
      adaptive.populationDiversity
    );
    adaptive.candidateClosures = [];

    const report = buildResearchControlCampaignReport({
      campaign: fixture.campaign,
      arms: fixture.arms,
      completedAt: "2026-07-12T10:30:01.000Z"
    });

    expect(report.arms[0].paper_candidate_slots).toEqual([{
      sequence: 1,
      tick_ref: {
        record_kind: "candidate_arena_tick",
        id: adaptive.ticks[0]!.candidate_arena_tick_id
      },
      status: "no_admitted_candidate"
    }]);
    expect(report.arms[0].diagnostics).toMatchObject({
      admitted_candidate_count: 0,
      duplicate_count: 1,
      failed_count: 2
    });
  });

  it.each([
    ["missing exact tick", (fixture: any) => { fixture.arms[0].ticks = []; }],
    ["wrong allocation mode", (fixture: any) => {
      fixture.arms[0].allocations[0].allocation_mode = "static_control";
    }],
    ["allocation digest mismatch", (fixture: any) => {
      fixture.arms[0].ticks[0].research_allocation_digest = digest("0");
    }],
    ["arm intent campaign mismatch", (fixture: any) => {
      fixture.arms[0].intent.campaign_digest = digest("0");
    }],
    ["unknown reserved candidate", (fixture: any) => {
      fixture.arms[0].candidateClosures = [];
    }],
    ["diversity tick mismatch", (fixture: any) => {
      fixture.arms[0].populationDiversity.tick_series[0].tick_id = "other-tick";
    }],
    ["final snapshot malformed", (fixture: any) => {
      fixture.arms[0].finalStoreSnapshotDigest = "sha256:short";
    }]
  ])("rejects report evidence with %s", (_label, mutate) => {
    const fixture = reportEvidenceFixture() as any;
    mutate(fixture);
    expect(() => buildResearchControlCampaignReport({
      campaign: fixture.campaign,
      arms: fixture.arms,
      completedAt: "2026-07-12T10:30:01.000Z"
    })).toThrow(ResearchControlCampaignDecisionError);
  });

  it("persists one exact terminal report and rejects a conflicting replay", async () => {
    const fixture = reportEvidenceFixture();
    const report = buildResearchControlCampaignReport({
      campaign: fixture.campaign,
      arms: fixture.arms,
      completedAt: "2026-07-12T10:30:01.000Z"
    });
    const store = new CampaignStoreDouble();
    store.campaigns.set(
      fixture.campaign.research_control_campaign_id,
      fixture.campaign
    );
    for (const arm of fixture.arms) {
      store.intents.set(
        arm.intent.research_control_campaign_arm_intent_id,
        arm.intent
      );
    }
    const service = new ResearchControlCampaignService({
      store: store as unknown as OuroborosStorePort
    });

    expect(await service.recordReport(report)).toEqual(report);
    expect(await service.recordReport(report)).toEqual(report);
    expect(store.reportWrites).toBe(1);

    const conflicting = structuredClone(report);
    conflicting.completed_at = "2026-07-12T10:31:00.000Z";
    await expect(service.recordReport(conflicting)).rejects.toMatchObject({
      code: "research_control_campaign_report_conflict"
    });
  });
});

function campaignInput(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "allocation-ablation-001",
    baseline: {
      protocol_version: "local_store_regular_files_v1" as const,
      snapshot_digest: digest("1"),
      regular_file_count: 40,
      total_bytes: 40_000,
      exclusion_policy: "research_control_campaign_evidence_only" as const
    },
    source: {
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: "candidate-fixture"
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: "candidate-version-fixture"
      },
      system_code_ref: { record_kind: "system_code", id: "system-code-fixture" },
      system_code_artifact_digest: "sha256:fixture-system-code-v1",
      system_code_record_digest: digest("2"),
      research_artifact_protocol: "single_file_python_v1" as const,
      research_artifact_closure_digest: digest("3")
    },
    researchAgent: {
      id: "fixture",
      provider: "fixture" as const,
      model: "scripted-fixture",
      permission_policy: "fixture_only" as const
    },
    tickCountPerArm: 2,
    maximumBaselineRegularFileCount: 10_000,
    maximumBaselineTotalBytes: 1_000_000_000,
    committedAt: "2026-07-12T10:00:00.000Z",
    ...overrides
  };
}

function campaignRequest() {
  const input = campaignInput();
  const { committedAt: _committedAt, ...request } = input;
  return request;
}

function reportEvidenceFixture(): {
  campaign: ResearchControlCampaignRecord;
  arms: [ResearchControlCampaignArmEvidenceInput, ResearchControlCampaignArmEvidenceInput];
} {
  const campaign = decideResearchControlCampaign(campaignInput({
    tickCountPerArm: 1
  }));
  const adaptiveIntent = decideResearchControlCampaignArmIntent({
    campaign,
    armKind: "adaptive_treatment",
    committedAt: "2026-07-12T10:00:01.000Z"
  });
  const staticIntent = decideResearchControlCampaignArmIntent({
    campaign,
    armKind: "static_control",
    committedAt: "2026-07-12T10:00:01.000Z"
  });
  return {
    campaign,
    arms: [
      armEvidence(campaign, adaptiveIntent, "adaptive", "adaptive_default"),
      armEvidence(campaign, staticIntent, "static", "static_control")
    ]
  };
}

function armEvidence(
  campaign: ResearchControlCampaignRecord,
  intent: ResearchControlCampaignArmIntentRecord,
  suffix: string,
  allocationMode: "adaptive_default" | "static_control"
): ResearchControlCampaignArmEvidenceInput {
  const tickId = intent.tick_ids[0]!;
  const allocation = decideCandidateArenaResearchAllocation({
    tickId,
    allocatedAt: "2026-07-12T10:00:02.000Z",
    allocationMode,
    findingClusters: [],
    latestTicks: [],
    priorAllocations: [],
    completedTickIds: []
  });
  const candidateId = `candidate-${suffix}`;
  const tick = tickFixture(tickId, allocation, candidateId, suffix);
  return {
    intent,
    ticks: [tick],
    allocations: [allocation],
    populationDiversity: diversityFixture(tickId),
    candidateClosures: [{
      candidate_id: candidateId,
      candidate_version_id: `candidate-version-${suffix}`,
      system_code_id: `system-code-${suffix}`,
      system_code_artifact_digest: digest(suffix === "adaptive" ? "7" : "8"),
      admission_decision_id: `admission-${suffix}`
    }],
    finalStoreSnapshotDigest: digest(suffix === "adaptive" ? "5" : "6"),
    completedAt: "2026-07-12T10:30:00.000Z"
  };
}

function tickFixture(
  tickId: string,
  allocation: CandidateArenaResearchAllocationRecord,
  candidateId: string,
  suffix: string
): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-tick-${tickId}`,
    tick_id: tickId,
    started_at: "2026-07-12T10:00:02.000Z",
    completed_at: "2026-07-12T10:20:00.000Z",
    status: "completed_with_errors",
    created_candidate_refs: [{
      record_kind: "trading_system_candidate",
      id: candidateId
    }],
    direction_results: [
      {
        direction_kind: allocation.selected_directions[0]!.direction_kind,
        status: "created",
        candidate_id: candidateId,
        admission_decision_id: `admission-${suffix}`,
        research_efficiency: efficiency(4, 2, 6, 100)
      },
      {
        direction_kind: allocation.selected_directions[1]!.direction_kind,
        status: "duplicate",
        admission_decision_id: `duplicate-${suffix}`,
        research_efficiency: efficiency(5, 3, 6, 200)
      },
      {
        direction_kind: allocation.selected_directions[2]!.direction_kind,
        status: "failed",
        error: "fixture_failure"
      }
    ],
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: allocation.allocation_digest,
    authority_status: "not_live"
  };
}

function efficiency(
  provider: number,
  runner: number,
  scenarios: number,
  elapsed: number
) {
  return {
    provider_request_total: provider,
    runner_command_total: runner,
    scenario_count: scenarios,
    elapsed_ms: elapsed,
    authority_status: "not_promotion_authority" as const
  };
}

function diversityFixture(tickId: string): ResearchPopulationDiversityReadModel {
  return {
    protocol_version: "research_population_diversity_v1",
    window_tick_count: 1,
    assigned_directions: {
      measurement_status: "measured",
      sample_count: 3,
      unique_count: 3,
      entropy_bits: 1.584963,
      normalized_entropy: 1
    },
    observed_behaviors: {
      measurement_status: "measured",
      sample_count: 2,
      unique_count: 1,
      entropy_bits: 0,
      normalized_entropy: 0,
      cohort_count: 1,
      admitted_submission_count: 1,
      exact_behavior_duplicate_count: 1,
      artifact_duplicate_count: 0,
      unavailable_fingerprint_count: 0
    },
    by_direction: [
      diversityDirection("trend_following", 1, 1, 1, 0),
      diversityDirection("mean_reversion", 1, 1, 0, 1),
      diversityDirection("volatility_regime", 1, 0, 0, 0)
    ],
    tick_series: [{
      tick_id: tickId,
      completed_at: "2026-07-12T10:20:00.000Z",
      assigned_directions: {
        measurement_status: "measured",
        sample_count: 3,
        unique_count: 3,
        entropy_bits: 1.584963,
        normalized_entropy: 1
      },
      observed_behaviors: {
        measurement_status: "measured",
        sample_count: 2,
        unique_count: 1,
        entropy_bits: 0,
        normalized_entropy: 0,
        cohort_count: 1,
        admitted_submission_count: 1,
        exact_behavior_duplicate_count: 1,
        artifact_duplicate_count: 0,
        unavailable_fingerprint_count: 0
      },
      evaluation_authority: false,
      promotion_authority: false,
      authority_status: "not_promotion_authority"
    }],
    evaluation_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}

function diversityDirection(
  direction: "trend_following" | "mean_reversion" | "volatility_regime",
  attempts: number,
  observed: number,
  admitted: number,
  duplicate: number
) {
  return {
    direction_kind: direction,
    attempt_count: attempts,
    observed_behavior_count: observed,
    unique_behavior_count: observed,
    admitted_submission_count: admitted,
    exact_behavior_duplicate_count: duplicate
  };
}

function noCandidateTick(tick: CandidateArenaTickRecord): CandidateArenaTickRecord {
  const changed = structuredClone(tick);
  changed.created_candidate_refs = [];
  changed.direction_results[0] = {
    direction_kind: changed.direction_results[0]!.direction_kind,
    status: "failed",
    error: "fixture_failure",
    research_efficiency: changed.direction_results[0]!.research_efficiency
  };
  return changed;
}

function noCandidateDiversity(
  diversity: ResearchPopulationDiversityReadModel
): ResearchPopulationDiversityReadModel {
  const changed = structuredClone(diversity);
  changed.observed_behaviors = {
    measurement_status: "insufficient_evidence",
    sample_count: 1,
    unique_count: 1,
    entropy_bits: 0,
    normalized_entropy: 0,
    cohort_count: 1,
    admitted_submission_count: 0,
    exact_behavior_duplicate_count: 1,
    artifact_duplicate_count: 0,
    unavailable_fingerprint_count: 0
  };
  changed.by_direction[0] = diversityDirection(
    "trend_following",
    1,
    0,
    0,
    0
  );
  changed.tick_series[0]!.observed_behaviors = {
    ...changed.observed_behaviors
  };
  return changed;
}

class CampaignStoreDouble {
  campaigns = new Map<string, ResearchControlCampaignRecord>();
  intents = new Map<string, ResearchControlCampaignArmIntentRecord>();
  reports = new Map<string, ResearchControlCampaignReportRecord>();
  campaignWrites = 0;
  intentWrites = 0;
  reportWrites = 0;

  async getResearchControlCampaign(id: string) {
    return this.campaigns.get(id);
  }

  async recordResearchControlCampaign(record: ResearchControlCampaignRecord) {
    this.campaignWrites += 1;
    this.campaigns.set(record.research_control_campaign_id, record);
    return record;
  }

  async getResearchControlCampaignArmIntent(id: string) {
    return this.intents.get(id);
  }

  async recordResearchControlCampaignArmIntent(
    record: ResearchControlCampaignArmIntentRecord
  ) {
    this.intentWrites += 1;
    this.intents.set(record.research_control_campaign_arm_intent_id, record);
    return record;
  }

  async getResearchControlCampaignReport(id: string) {
    return this.reports.get(id);
  }

  async recordResearchControlCampaignReport(
    record: ResearchControlCampaignReportRecord
  ) {
    this.reportWrites += 1;
    this.reports.set(record.research_control_campaign_report_id, record);
    return record;
  }
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
