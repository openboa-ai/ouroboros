import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTradingPromotionDigestInput,
  researchAllocationPolicyDecisionDigestInput,
  researchControlCampaignDigestInput,
  researchControlCampaignOutcomeDigestInput,
  researchControlStudyOutcomeDigestInput,
  type ResearchControlCampaignOutcomeArm,
  type ResearchControlCampaignOutcomeRecord,
  type ResearchControlCampaignRecord,
  type ResearchAllocationPolicyDecisionRecord,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord,
  type TradingPromotionRecord
} from "@ouroboros/domain";
import {
  decideResearchControlCampaign
} from "@ouroboros/application/candidate/research-control-campaign";
import {
  decideResearchControlStudy,
  researchControlStudyConditionFromCampaign
} from "@ouroboros/application/candidate/research-control-study";
import { decideResearchControlStudyOutcome } from
  "@ouroboros/application/candidate/research-control-study-outcome";
import { decideResearchAllocationPolicyDecision } from
  "@ouroboros/application/candidate/research-allocation-policy-decision";
import { LocalStore } from "../src/index";

describe("LocalStore ResearchControlStudy", () => {
  let root: string;
  let store: StudyLocalStore;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-control-study-"));
    store = new StudyLocalStore(root);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("appends, reloads, orders, and replays exact studies", async () => {
    const second = studyFixture("study-b", "2026-07-12T09:00:01.000Z");
    const first = studyFixture("study-a", "2026-07-12T09:00:00.000Z");

    expect(await store.recordResearchControlStudy(second)).toEqual(second);
    expect(await store.recordResearchControlStudy(first)).toEqual(first);
    expect(await store.recordResearchControlStudy(first)).toEqual(first);
    expect(await store.getResearchControlStudy(
      first.research_control_study_id
    )).toEqual(first);
    expect(await store.listResearchControlStudies()).toEqual([first, second]);
  });

  it("publishes one exact study across independent store instances", async () => {
    const sharedRoot = path.join(root, "exact-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const study = studyFixture("exact-race-study");

    await expect(Promise.all([
      left.recordResearchControlStudy(study),
      right.recordResearchControlStudy(structuredClone(study))
    ])).resolves.toEqual([study, study]);
    await expect(left.listResearchControlStudies()).resolves.toEqual([study]);
  });

  it("publishes one winner for conflicting cross-instance study bytes", async () => {
    const sharedRoot = path.join(root, "conflict-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const first = studyFixture(
      "conflict-race-study",
      "2026-07-12T09:00:00.000Z"
    );
    const second = studyFixture(
      "conflict-race-study",
      "2026-07-12T09:00:01.000Z"
    );

    const settled = await Promise.allSettled([
      left.recordResearchControlStudy(first),
      right.recordResearchControlStudy(second)
    ]);
    const fulfilled = settled.filter((item) => item.status === "fulfilled");
    const rejected = settled.filter((item) => item.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: { code: "research_control_study_conflict" }
    });
    const persisted = await left.listResearchControlStudies();
    expect(persisted).toHaveLength(1);
    expect([first, second]).toContainEqual(persisted[0]);
  });

  it("rejects same-ID study drift and malformed persisted bytes", async () => {
    const study = studyFixture();
    await store.recordResearchControlStudy(study);
    const changed = structuredClone(study);
    changed.replications[0]!.campaign_idempotency_key = "changed";

    await expect(store.recordResearchControlStudy(changed)).rejects.toMatchObject({
      code: "research_control_study_digest_mismatch"
    });

    const corruptRoot = path.join(root, "research-control-studies", "items");
    await mkdir(corruptRoot, { recursive: true });
    await writeFile(path.join(corruptRoot, "corrupt.json"), JSON.stringify({
      record_kind: "research_control_study",
      research_control_study_id: "corrupt"
    }));
    await expect(store.listResearchControlStudies()).rejects.toMatchObject({
      code: "research_control_study_reload_failed"
    });
  });

  it("rejects a study committed after one planned campaign already exists", async () => {
    const campaign = plannedCampaign();
    await store.recordResearchControlCampaign(campaign);

    await expect(store.recordResearchControlStudy(
      studyFixture(undefined, undefined, campaign)
    )).rejects.toMatchObject({
      code: "research_control_study_campaign_already_exists"
    });
  });

  it("accepts only an exact post-study planned campaign", async () => {
    const campaign = plannedCampaign();
    const study = studyFixture(undefined, undefined, campaign);
    await store.recordResearchControlStudy(study);

    await expect(store.recordResearchControlCampaign(campaign))
      .resolves.toEqual(campaign);
  });

  it.each([
    ["pre-study time", (campaign: ResearchControlCampaignRecord) => {
      campaign.committed_at = "2026-07-12T08:59:59.999Z";
    }],
    ["baseline drift", (campaign: ResearchControlCampaignRecord) => {
      campaign.baseline.snapshot_digest = digest("8");
    }],
    ["source drift", (campaign: ResearchControlCampaignRecord) => {
      campaign.source.candidate_ref.id = "other-source";
    }],
    ["agent drift", (campaign: ResearchControlCampaignRecord) => {
      campaign.research_agent.model = "other-model";
    }],
    ["campaign policy drift", (campaign: ResearchControlCampaignRecord) => {
      campaign.policy.maximum_baseline_regular_file_count = 9_999;
    }]
  ])("rejects planned campaign %s", async (_label, mutate) => {
    const campaign = plannedCampaign();
    const study = studyFixture(undefined, undefined, campaign);
    await store.recordResearchControlStudy(study);
    mutate(campaign);
    resealCampaign(campaign);

    await expect(store.recordResearchControlCampaign(campaign))
      .rejects.toMatchObject({
        code: "research_control_study_campaign_mismatch"
      });
  });

  it("appends, reloads, lists, and replays one exact study outcome", async () => {
    const graph = terminalStudyGraph();
    const outcomeStore = new OutcomeGraphStore(root, graph);
    const outcome = decideResearchControlStudyOutcome({
      ...graph,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });

    expect(await outcomeStore.recordResearchControlStudyOutcome(outcome))
      .toEqual(outcome);
    expect(await outcomeStore.getResearchControlStudyOutcome(
      outcome.research_control_study_outcome_id
    )).toEqual(outcome);
    expect(await outcomeStore.listResearchControlStudyOutcomes())
      .toEqual([outcome]);
    expect(await outcomeStore.recordResearchControlStudyOutcome(outcome))
      .toEqual(outcome);
  });

  it("lists study outcomes by adjudication time and deterministic identity", async () => {
    const laterGraph = terminalStudyGraph({
      studyIdempotencyKey: "terminal-study-later",
      replicationKeyPrefix: "terminal-study-later-replication"
    });
    const earlierGraph = terminalStudyGraph({
      studyIdempotencyKey: "terminal-study-earlier",
      replicationKeyPrefix: "terminal-study-earlier-replication"
    });
    const later = decideResearchControlStudyOutcome({
      ...laterGraph,
      adjudicatedAt: "2026-07-12T12:00:01.000Z"
    });
    const earlier = decideResearchControlStudyOutcome({
      ...earlierGraph,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });
    await new OutcomeGraphStore(root, laterGraph)
      .recordResearchControlStudyOutcome(later);
    const earlierStore = new OutcomeGraphStore(root, earlierGraph);
    await earlierStore.recordResearchControlStudyOutcome(earlier);

    expect(await earlierStore.listResearchControlStudyOutcomes())
      .toEqual([earlier, later]);
  });

  it("rejects outcome drift and missing source graph", async () => {
    const graph = terminalStudyGraph();
    const outcomeStore = new OutcomeGraphStore(root, graph);
    const outcome = decideResearchControlStudyOutcome({
      ...graph,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });
    const drifted = structuredClone(outcome);
    drifted.mean_rate_difference = 0;
    await expect(outcomeStore.recordResearchControlStudyOutcome(drifted))
      .rejects.toMatchObject({
        code: "invalid_research_control_study_outcome_input"
      });

    const incomplete = new OutcomeGraphStore(root, {
      study: graph.study,
      replications: graph.replications.slice(1)
    });
    await expect(incomplete.recordResearchControlStudyOutcome(outcome))
      .rejects.toMatchObject({
        code: "research_control_study_outcome_reference_not_found"
      });
    await expect(new MissingStudyOutcomeGraphStore(root, graph)
      .recordResearchControlStudyOutcome(outcome)).rejects.toMatchObject({
        code: "research_control_study_outcome_reference_not_found"
      });
  });

  it("rejects outcome conflict, statistic drift, and malformed persisted bytes", async () => {
    const graph = terminalStudyGraph();
    const outcomeStore = new OutcomeGraphStore(root, graph);
    const outcome = decideResearchControlStudyOutcome({
      ...graph,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });
    await outcomeStore.recordResearchControlStudyOutcome(outcome);

    const conflicting = structuredClone(outcome);
    conflicting.adjudicated_at = "2026-07-12T12:00:01.000Z";
    resealStudyOutcome(conflicting);
    await expect(outcomeStore.recordResearchControlStudyOutcome(conflicting))
      .rejects.toMatchObject({
        code: "research_control_study_outcome_conflict"
      });

    const statisticDrift = structuredClone(outcome);
    statisticDrift.exact_sign_test_p_value = 0.5;
    resealStudyOutcome(statisticDrift);
    await expect(outcomeStore.recordResearchControlStudyOutcome(statisticDrift))
      .rejects.toMatchObject({
        code: "invalid_research_control_study_outcome_input"
      });
    const countDrift = structuredClone(outcome);
    countDrift.completed_replication_count = 5;
    resealStudyOutcome(countDrift);
    await expect(outcomeStore.recordResearchControlStudyOutcome(countDrift))
      .rejects.toMatchObject({
        code: "invalid_research_control_study_outcome_input"
      });

    const corruptRoot = path.join(
      root,
      "research-control-study-outcomes",
      "items"
    );
    await mkdir(corruptRoot, { recursive: true });
    await writeFile(path.join(corruptRoot, "corrupt.json"), JSON.stringify({
      record_kind: "research_control_study_outcome",
      research_control_study_outcome_id: "corrupt"
    }));
    await expect(outcomeStore.listResearchControlStudyOutcomes())
      .rejects.toMatchObject({
        code: "research_control_study_outcome_reload_failed"
      });
  });

  it("rejects an unplanned campaign substituted into a study outcome", async () => {
    const graph = terminalStudyGraph();
    const outcome = decideResearchControlStudyOutcome({
      ...graph,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });
    const campaign = plannedCampaign("unplanned-study-replication");
    const campaignOutcome = positiveCampaignOutcome(campaign);
    graph.replications.push({ campaign, outcome: campaignOutcome });
    outcome.replication_results[0] = {
      replication_index: 1,
      campaign_ref: {
        record_kind: "research_control_campaign",
        id: campaign.research_control_campaign_id
      },
      campaign_digest: campaign.campaign_digest,
      campaign_outcome_ref: {
        record_kind: "research_control_campaign_outcome",
        id: campaignOutcome.research_control_campaign_outcome_id
      },
      campaign_outcome_digest: campaignOutcome.outcome_digest,
      observed_rate_difference: campaignOutcome.observed_rate_difference
    };
    resealStudyOutcome(outcome);

    await expect(new OutcomeGraphStore(root, graph)
      .recordResearchControlStudyOutcome(outcome)).rejects.toMatchObject({
        code: "research_control_study_outcome_reference_mismatch"
      });
  });

  it("rejects campaign outcomes adjudicated before their campaign", async () => {
    const graph = terminalStudyGraph();
    const outcome = decideResearchControlStudyOutcome({
      ...graph,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });
    const campaignOutcome = graph.replications[0]!.outcome;
    campaignOutcome.adjudicated_at = "2026-07-12T09:30:00.000Z";
    resealCampaignOutcome(campaignOutcome);
    outcome.replication_results[0]!.campaign_outcome_digest =
      campaignOutcome.outcome_digest;
    resealStudyOutcome(outcome);

    await expect(new OutcomeGraphStore(root, graph)
      .recordResearchControlStudyOutcome(outcome)).rejects.toMatchObject({
        code: "research_control_study_outcome_reference_mismatch"
      });
  });

  it("appends, reloads, lists, and replays one policy decision", async () => {
    const graph = terminalStudyGraph();
    const studyOutcome = decideResearchControlStudyOutcome({
      ...graph,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });
    const decisionStore = new PolicyDecisionGraphStore(
      root,
      graph,
      studyOutcome
    );
    const decision = decideResearchAllocationPolicyDecision({
      study: graph.study,
      outcome: studyOutcome,
      decidedAt: "2026-07-12T13:00:00.000Z"
    });

    expect(await decisionStore.recordResearchAllocationPolicyDecision(decision))
      .toEqual(decision);
    expect(await decisionStore.getResearchAllocationPolicyDecision(
      decision.research_allocation_policy_decision_id
    )).toEqual(decision);
    expect(await decisionStore.listResearchAllocationPolicyDecisions())
      .toEqual([decision]);
    expect(await decisionStore.recordResearchAllocationPolicyDecision(decision))
      .toEqual(decision);
  });

  it("rejects policy decision conflicts and source graph drift", async () => {
    const graph = terminalStudyGraph();
    const studyOutcome = decideResearchControlStudyOutcome({
      ...graph,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });
    const decisionStore = new PolicyDecisionGraphStore(
      root,
      graph,
      studyOutcome
    );
    const decision = decideResearchAllocationPolicyDecision({
      study: graph.study,
      outcome: studyOutcome,
      decidedAt: "2026-07-12T13:00:00.000Z"
    });
    await decisionStore.recordResearchAllocationPolicyDecision(decision);

    const conflicting = structuredClone(decision);
    conflicting.decided_at = "2026-07-12T13:00:01.000Z";
    resealPolicyDecision(conflicting);
    await expect(decisionStore.recordResearchAllocationPolicyDecision(
      conflicting
    )).rejects.toMatchObject({
      code: "research_allocation_policy_decision_conflict"
    });

    const targetDrift = structuredClone(decision);
    targetDrift.target_allocation_policy_digest = digest("e");
    resealPolicyDecision(targetDrift);
    await expect(new PolicyDecisionGraphStore(root, graph, studyOutcome)
      .recordResearchAllocationPolicyDecision(targetDrift))
      .rejects.toMatchObject({
        code: "research_allocation_policy_decision_reference_mismatch"
      });

    const preOutcome = structuredClone(decision);
    preOutcome.decided_at = "2026-07-12T11:59:59.999Z";
    resealPolicyDecision(preOutcome);
    await expect(new PolicyDecisionGraphStore(root, graph, studyOutcome)
      .recordResearchAllocationPolicyDecision(preOutcome))
      .rejects.toMatchObject({
        code: "research_allocation_policy_decision_reference_mismatch"
      });
  });

  it("rejects missing policy source and malformed persisted bytes", async () => {
    const graph = terminalStudyGraph();
    const studyOutcome = decideResearchControlStudyOutcome({
      ...graph,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });
    const decision = decideResearchAllocationPolicyDecision({
      study: graph.study,
      outcome: studyOutcome,
      decidedAt: "2026-07-12T13:00:00.000Z"
    });
    await expect(new PolicyDecisionGraphStore(root, graph)
      .recordResearchAllocationPolicyDecision(decision))
      .rejects.toMatchObject({
        code: "research_allocation_policy_decision_reference_not_found"
      });

    const corruptRoot = path.join(
      root,
      "research-allocation-policy-decisions",
      "items"
    );
    await mkdir(corruptRoot, { recursive: true });
    await writeFile(path.join(corruptRoot, "corrupt.json"), JSON.stringify({
      record_kind: "research_allocation_policy_decision",
      research_allocation_policy_decision_id: "corrupt"
    }));
    await expect(new PolicyDecisionGraphStore(root, graph, studyOutcome)
      .listResearchAllocationPolicyDecisions()).rejects.toMatchObject({
        code: "research_allocation_policy_decision_reload_failed"
      });
  });
});

class StudyLocalStore extends LocalStore {
  override async getTradingPromotion(
    promotionId: string
  ): Promise<TradingPromotionRecord | undefined> {
    const promotion = promotionFixture();
    return promotion.trading_promotion_id === promotionId
      ? structuredClone(promotion)
      : undefined;
  }
}

class OutcomeGraphStore extends StudyLocalStore {
  constructor(
    root: string,
    private readonly graph: ReturnType<typeof terminalStudyGraph>
  ) {
    super(root);
  }

  override async getResearchControlStudy(studyId: string) {
    return this.graph.study.research_control_study_id === studyId
      ? structuredClone(this.graph.study)
      : super.getResearchControlStudy(studyId);
  }

  override async getResearchControlCampaign(campaignId: string) {
    const campaign = this.graph.replications.find((entry) =>
      entry.campaign.research_control_campaign_id === campaignId
    )?.campaign;
    return campaign
      ? structuredClone(campaign)
      : super.getResearchControlCampaign(campaignId);
  }

  override async getResearchControlCampaignOutcome(outcomeId: string) {
    const outcome = this.graph.replications.find((entry) =>
      entry.outcome.research_control_campaign_outcome_id === outcomeId
    )?.outcome;
    return outcome
      ? structuredClone(outcome)
      : super.getResearchControlCampaignOutcome(outcomeId);
  }
}

class MissingStudyOutcomeGraphStore extends OutcomeGraphStore {
  override async getResearchControlStudy() {
    return undefined;
  }
}

class PolicyDecisionGraphStore extends OutcomeGraphStore {
  constructor(
    root: string,
    graph: ReturnType<typeof terminalStudyGraph>,
    private readonly studyOutcome?: ResearchControlStudyOutcomeRecord
  ) {
    super(root, graph);
  }

  override async getResearchControlStudyOutcome(outcomeId: string) {
    return this.studyOutcome?.research_control_study_outcome_id === outcomeId
      ? structuredClone(this.studyOutcome)
      : super.getResearchControlStudyOutcome(outcomeId);
  }
}

function studyFixture(
  idempotencyKey = "study-001",
  committedAt = "2026-07-12T09:00:00.000Z",
  campaign = plannedCampaign()
) {
  const condition = researchControlStudyConditionFromCampaign(campaign);
  const { condition_digest: _digest, ...conditionInput } = condition;
  return decideResearchControlStudy({
    idempotencyKey,
    baselineSnapshotDigest: campaign.baseline.snapshot_digest,
    condition: conditionInput,
    replicationIdempotencyKeys: [
      campaign.idempotency_key,
      ...Array.from({ length: 5 }, (_, index) =>
        `${idempotencyKey}-replication-${index + 2}`
      )
    ],
    committedAt
  });
}

function plannedCampaign(
  idempotencyKey = "study-001-replication-1"
): ResearchControlCampaignRecord {
  const promotion = promotionFixture();
  return decideResearchControlCampaign({
    idempotencyKey,
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("1"),
      regular_file_count: 40,
      total_bytes: 40_000,
      exclusion_policy: "research_control_campaign_evidence_only"
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
      system_code_ref: {
        record_kind: "system_code",
        id: "system-code-fixture"
      },
      system_code_artifact_digest: "sha256:fixture-system-code-v1",
      system_code_record_digest: digest("2"),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("3")
    },
    researchAgent: {
      id: "fixture",
      provider: "fixture",
      model: "scripted-fixture",
      permission_policy: "fixture_only"
    },
    paperComparator: {
      comparator_status: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: promotion.trading_promotion_id
      },
      trading_promotion_digest: exactDigest(
        paperTradingComparisonTradingPromotionDigestInput(promotion)
      ),
      candidate_ref: { ...promotion.candidate_ref },
      candidate_version_ref: { ...promotion.candidate_version_ref },
      paper_trading_evaluation_ref: {
        ...promotion.paper_trading_evaluation_ref
      }
    },
    paperEvaluationProtocol: boundPaperProtocolInput(),
    tickCountPerArm: 1,
    maximumBaselineRegularFileCount: 10_000,
    maximumBaselineTotalBytes: 1_000_000_000,
    committedAt: "2026-07-12T10:00:00.000Z"
  });
}

function terminalStudyGraph(options: {
  studyIdempotencyKey?: string;
  replicationKeyPrefix?: string;
} = {}): {
  study: ResearchControlStudyRecord;
  replications: Array<{
    campaign: ResearchControlCampaignRecord;
    outcome: ResearchControlCampaignOutcomeRecord;
  }>;
} {
  const studyIdempotencyKey = options.studyIdempotencyKey ?? "terminal-study";
  const replicationKeyPrefix = options.replicationKeyPrefix ??
    "terminal-study-replication";
  const keys = Array.from({ length: 6 }, (_, index) =>
    `${replicationKeyPrefix}-${index + 1}`
  );
  const campaigns = keys.map(plannedCampaign);
  const condition = researchControlStudyConditionFromCampaign(campaigns[0]!);
  const { condition_digest: _digest, ...conditionInput } = condition;
  const study = decideResearchControlStudy({
    idempotencyKey: studyIdempotencyKey,
    baselineSnapshotDigest: campaigns[0]!.baseline.snapshot_digest,
    condition: conditionInput,
    replicationIdempotencyKeys: keys,
    committedAt: "2026-07-12T09:00:00.000Z"
  });
  return {
    study,
    replications: campaigns.map((campaign) => ({
      campaign,
      outcome: positiveCampaignOutcome(campaign)
    }))
  };
}

function positiveCampaignOutcome(
  campaign: ResearchControlCampaignRecord
): ResearchControlCampaignOutcomeRecord {
  const outcome: ResearchControlCampaignOutcomeRecord = {
    record_kind: "research_control_campaign_outcome",
    version: 1,
    research_control_campaign_outcome_id:
      `${campaign.research_control_campaign_id}-outcome`,
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    report_ref: {
      record_kind: "research_control_campaign_report",
      id: `${campaign.research_control_campaign_id}-report`
    },
    report_digest: digest("6"),
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: `${campaign.research_control_campaign_id}-schedule`
    },
    schedule_digest: digest("7"),
    paper_comparator: structuredClone(campaign.paper_comparator) as never,
    shared_evaluation_policy_status: "bound",
    shared_evaluation_policy_digest:
      campaign.paper_evaluation_protocol.protocol_status === "bound"
        ? campaign.paper_evaluation_protocol.protocol_digest
        : digest("8"),
    arms: [
      studyOutcomeCampaignArm(
        "adaptive_treatment",
        "adaptive_default",
        1,
        campaign.research_control_campaign_id
      ),
      studyOutcomeCampaignArm(
        "static_control",
        "static_control",
        0,
        campaign.research_control_campaign_id
      )
    ],
    observed_rate_difference: 1,
    observed_result: "adaptive_rate_higher",
    causal_conclusion: "single_campaign_observation_only",
    policy_replacement_eligibility: "not_eligible",
    next_action: "accumulate_replicated_control_campaigns",
    adjudicated_at: "2026-07-12T11:00:00.000Z",
    outcome_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  outcome.outcome_digest = exactDigest(
    researchControlCampaignOutcomeDigestInput(outcome)
  );
  return outcome;
}

function studyOutcomeCampaignArm(
  armKind: "adaptive_treatment" | "static_control",
  allocationMode: "adaptive_default" | "static_control",
  credit: 0 | 1,
  token: string
): ResearchControlCampaignOutcomeArm {
  const tickRef = {
    record_kind: "candidate_arena_tick" as const,
    id: `${token}-${armKind}-tick`
  };
  const slot = credit === 1 ? {
    sequence: 1,
    tick_ref: tickRef,
    terminal_status: "qualified_improvement" as const,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: `${token}-${armKind}-candidate`
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `${token}-${armKind}-version`
    },
    system_code_ref: {
      record_kind: "system_code",
      id: `${token}-${armKind}-code`
    },
    system_code_artifact_digest: digest("9"),
    paper_slot_outcome_ref: {
      record_kind: "research_control_campaign_paper_slot_outcome",
      id: `${token}-${armKind}-slot-outcome`
    },
    paper_slot_outcome_digest: digest("a"),
    discovery_credit: 1 as const
  } : {
    sequence: 1,
    tick_ref: tickRef,
    terminal_status: "no_admitted_candidate" as const,
    discovery_credit: 0 as const
  };
  return {
    arm_kind: armKind,
    allocation_mode: allocationMode,
    slot_results: [slot],
    metrics: {
      slot_count: 1,
      admitted_candidate_slot_count: credit,
      no_admitted_candidate_count: 1 - credit,
      qualified_discovery_count: credit,
      source_not_improved_count: 0,
      not_reproduced_count: 0,
      evidence_ineligible_count: 0,
      paper_slot_expired_count: 0,
      qualified_discovery_rate: credit
    }
  };
}

function promotionFixture(): TradingPromotionRecord {
  return {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "promotion-001",
    status: "promoted_for_trading_review",
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
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: "confirmation-campaign"
      },
      campaign_digest: digest("a"),
      campaign_outcome_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: "confirmation-outcome"
      },
      campaign_outcome_digest: digest("b"),
      final_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "confirmation-verdict"
      },
      final_verdict_digest: digest("c")
    },
    promoted_at: "2026-07-12T08:00:00.000Z",
    authority_status: "not_live"
  };
}

function boundPaperProtocolInput() {
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
    market_data_configuration_digest: digest("4"),
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

function resealCampaign(campaign: ResearchControlCampaignRecord): void {
  campaign.campaign_digest = exactDigest(researchControlCampaignDigestInput(
    campaign
  ));
}

function resealCampaignOutcome(
  outcome: ResearchControlCampaignOutcomeRecord
): void {
  outcome.outcome_digest = exactDigest(
    researchControlCampaignOutcomeDigestInput(outcome)
  );
}

function resealStudyOutcome(outcome: ResearchControlStudyOutcomeRecord): void {
  outcome.study_outcome_digest = exactDigest(
    researchControlStudyOutcomeDigestInput(outcome)
  );
}

function resealPolicyDecision(
  decision: ResearchAllocationPolicyDecisionRecord
): void {
  decision.policy_decision_digest = exactDigest(
    researchAllocationPolicyDecisionDigestInput(decision)
  );
}

function exactDigest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
