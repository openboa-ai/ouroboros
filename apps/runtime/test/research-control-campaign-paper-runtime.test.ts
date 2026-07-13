import { describe, expect, it } from "vitest";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  ResearchControlCampaignArmIntentRecord,
  ResearchControlCampaignArmKind,
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord
} from "@ouroboros/domain";
import {
  createResearchControlCampaignPaperRuntime,
  type ResearchControlCampaignPaperRuntimeArm
} from "../src/candidate/arena/research-control-campaign-paper-runtime";

describe("ResearchControlCampaign paper runtime composition", () => {
  it("installs the graph, collects an empty schedule, and completes", async () => {
    const graph = graphFixture();
    const coordinator = new RuntimeStore(graph);
    const adaptive = new RuntimeStore({ campaign: graph.campaign });
    const control = new RuntimeStore({ campaign: graph.campaign });
    const operations: string[] = [];
    const runtime = createResearchControlCampaignPaperRuntime({
      coordinator: port(coordinator),
      arms: {
        adaptive_treatment: runtimeArm(adaptive),
        static_control: runtimeArm(control)
      },
      marketData: marketDataPort(),
      now: () => "2026-07-12T10:00:00.000Z",
      async collectCampaignOutcome(campaignId) {
        operations.push(`collect:${campaignId}`);
        const outcome = outcomeFixture(campaignId);
        coordinator.outcomes = [outcome];
        return structuredClone(outcome);
      }
    });

    runtime.runner.start({ campaignId: "campaign-001" });
    await runtime.runner.drain();

    expect(runtime.runner.status()).toMatchObject({
      status: "completed",
      latestStep: { status: "complete", action: "complete" }
    });
    expect(operations).toEqual(["collect:campaign-001"]);
    for (const arm of [adaptive, control]) {
      expect(arm.intents).toHaveLength(2);
      expect(arm.report).toEqual(graph.report);
      expect(arm.schedule).toEqual(graph.schedule);
    }
  });
});

class RuntimeStore {
  campaign?: ResearchControlCampaignRecord;
  intents: ResearchControlCampaignArmIntentRecord[] = [];
  report?: ResearchControlCampaignReportRecord;
  schedule?: ResearchControlCampaignPaperScheduleRecord;
  outcomes: ResearchControlCampaignOutcomeRecord[] = [];

  constructor(graph: Partial<ReturnType<typeof graphFixture>> = {}) {
    this.campaign = graph.campaign
      ? structuredClone(graph.campaign)
      : undefined;
    this.intents = graph.intents
      ? structuredClone(graph.intents)
      : [];
    this.report = graph.report ? structuredClone(graph.report) : undefined;
    this.schedule = graph.schedule
      ? structuredClone(graph.schedule)
      : undefined;
  }

  root() { return "paper-runtime"; }

  async getResearchControlCampaign(id: string) {
    return this.campaign?.research_control_campaign_id === id
      ? structuredClone(this.campaign)
      : undefined;
  }

  async getResearchControlCampaignArmIntent(id: string) {
    return structuredClone(this.intents.find((intent) =>
      intent.research_control_campaign_arm_intent_id === id
    ));
  }

  async recordResearchControlCampaignArmIntent(
    intent: ResearchControlCampaignArmIntentRecord
  ) {
    const existing = this.intents.find((candidate) =>
      candidate.research_control_campaign_arm_intent_id ===
        intent.research_control_campaign_arm_intent_id
    );
    if (!existing) this.intents.push(structuredClone(intent));
    return structuredClone(existing ?? intent);
  }

  async getResearchControlCampaignReport(id: string) {
    return this.report?.research_control_campaign_report_id === id
      ? structuredClone(this.report)
      : undefined;
  }

  async listResearchControlCampaignReports() {
    return this.report ? [structuredClone(this.report)] : [];
  }

  async recordResearchControlCampaignReport(
    report: ResearchControlCampaignReportRecord
  ) {
    this.report ??= structuredClone(report);
    return structuredClone(this.report);
  }

  async getResearchControlCampaignPaperSchedule(id: string) {
    return this.schedule?.research_control_campaign_paper_schedule_id === id
      ? structuredClone(this.schedule)
      : undefined;
  }

  async listResearchControlCampaignPaperSchedules() {
    return this.schedule ? [structuredClone(this.schedule)] : [];
  }

  async recordResearchControlCampaignPaperSchedule(
    schedule: ResearchControlCampaignPaperScheduleRecord
  ) {
    this.schedule ??= structuredClone(schedule);
    return structuredClone(this.schedule);
  }

  async listResearchControlCampaignPaperStartBatches() { return []; }
  async listResearchControlCampaignOutcomes() {
    return structuredClone(this.outcomes);
  }
}

function runtimeArm(store: RuntimeStore): ResearchControlCampaignPaperRuntimeArm {
  const unavailable = async (): Promise<never> => {
    throw new Error("unexpected_paper_effect");
  };
  return {
    store: port(store),
    comparisons: { prepare: unavailable, reload: unavailable },
    activations: { authorize: unavailable },
    runtime: {
      recoverIncompleteActivations: unavailable,
      start: unavailable,
      stopOwnedAttempt: unavailable
    },
    windowReader: { load: unavailable },
    enableComparisonTickAttribution: unavailable,
    createWindowDriver: () => ({ advance: unavailable }),
    verdicts: { evaluate: unavailable },
    campaigns: { precommit: unavailable, settle: unavailable },
    windows: { prepareNext: unavailable },
    advanceComparison: unavailable,
    releases: { release: unavailable }
  };
}

function graphFixture() {
  const arms = ([
    ["adaptive_treatment", "adaptive_default"],
    ["static_control", "static_control"]
  ] as const).map(([armKind, allocationMode]) => ({
    arm_kind: armKind,
    allocation_mode: allocationMode,
    research_control_campaign_arm_intent_id: `intent-${armKind}`,
    tick_ids: [`tick-${armKind}-1`]
  })) as ResearchControlCampaignRecord["arms"];
  const campaign = {
    record_kind: "research_control_campaign",
    research_control_campaign_id: "campaign-001",
    campaign_digest: "sha256:campaign",
    baseline: { snapshot_digest: "sha256:baseline" },
    arms,
    paper_comparator: { comparator_status: "trading_review" },
    paper_evaluation_protocol: {
      protocol_status: "bound",
      protocol_digest: "sha256:paper-protocol",
      schedule_policy: { confirmation_precommit_deadline_ms: 1_000 }
    }
  } as ResearchControlCampaignRecord;
  const intents = arms.map((arm) => ({
    record_kind: "research_control_campaign_arm_intent",
    research_control_campaign_arm_intent_id:
      arm.research_control_campaign_arm_intent_id,
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    arm_kind: arm.arm_kind,
    allocation_mode: arm.allocation_mode,
    baseline_snapshot_digest: campaign.baseline.snapshot_digest,
    tick_ids: [...arm.tick_ids]
  })) as [
    ResearchControlCampaignArmIntentRecord,
    ResearchControlCampaignArmIntentRecord
  ];
  const report = {
    record_kind: "research_control_campaign_report",
    research_control_campaign_report_id: "report-001",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    report_digest: "sha256:report"
  } as ResearchControlCampaignReportRecord;
  const schedule = {
    record_kind: "research_control_campaign_paper_schedule",
    research_control_campaign_paper_schedule_id: "schedule-001",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    report_ref: {
      record_kind: "research_control_campaign_report",
      id: report.research_control_campaign_report_id
    },
    report_digest: report.report_digest,
    paper_evaluation_protocol_digest: "sha256:paper-protocol",
    committed_at: "2026-07-12T09:59:59.000Z",
    arms: (["adaptive_treatment", "static_control"] as const).map((armKind) => ({
      arm_kind: armKind,
      slots: [{
        slot_status: "no_admitted_candidate",
        sequence: 1,
        tick_ref: {
          record_kind: "candidate_arena_tick",
          id: `tick-${armKind}-1`
        }
      }]
    })),
    schedule_digest: "sha256:schedule"
  } as ResearchControlCampaignPaperScheduleRecord;
  return { campaign, intents, report, schedule };
}

function outcomeFixture(campaignId: string): ResearchControlCampaignOutcomeRecord {
  return {
    record_kind: "research_control_campaign_outcome",
    research_control_campaign_outcome_id: "outcome-001",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaignId
    }
  } as ResearchControlCampaignOutcomeRecord;
}

function marketDataPort(): GatewayMarketDataPort {
  return {
    provider_kind: "binance",
    source_kind: "binance_production_public_rest",
    rest_base_url: "https://example.invalid",
    required_endpoints: [],
    authority_status: "read_only"
  } as unknown as GatewayMarketDataPort;
}

function port(store: RuntimeStore): OuroborosStorePort {
  return store as unknown as OuroborosStorePort;
}
