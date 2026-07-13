import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  ResearchControlCampaignArmKind,
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord
} from "@ouroboros/domain";
import type { ResearchControlCampaignPaperNextAction } from
  "../src/candidate/arena/research-control-campaign-paper-next-action";
import {
  ResearchControlCampaignPaperExecutor
} from "../src/candidate/arena/research-control-campaign-paper-executor";

describe("ResearchControlCampaign paper executor", () => {
  it("installs the exact graph before executing one projected effect", async () => {
    const harness = executorHarness({
      action: { action: "prepare_source_batch", sequence: 1 }
    });

    const step = await harness.executor.advance({ campaignId: "campaign-001" });

    expect(step).toMatchObject({
      status: "advanced",
      action: "prepare_source_batch",
      sequence: 1
    });
    expect(harness.operations).toEqual(["install", "prepare_source_batch"]);
  });

  it.each([
    [{ action: "expire_unopened_source_slot", armKind: "adaptive_treatment", sequence: 1 }],
    [{ action: "capture_source_start_batch", sequence: 1 }],
    [{ action: "authorize_source_batch", sequence: 1 }],
    [{ action: "start_source_batch", sequence: 1 }],
    [{ action: "advance_source_window", sequence: 1 }],
    [{ action: "adjudicate_source_verdict", armKind: "adaptive_treatment", sequence: 1 }],
    [{ action: "precommit_confirmation", armKind: "adaptive_treatment", sequence: 1 }],
    [{ action: "expire_confirmation_precommit", armKind: "adaptive_treatment", sequence: 1 }],
    [{ action: "advance_confirmation", armKind: "adaptive_treatment", sequence: 1 }],
    [{ action: "record_slot_outcome", armKind: "adaptive_treatment", sequence: 1 }]
  ] as Array<[ResearchControlCampaignPaperNextAction]>) (
    "dispatches exactly one $0.action transition",
    async (action) => {
      const harness = executorHarness({ action });

      const step = await harness.executor.advance({ campaignId: "campaign-001" });

      expect(step.status).toBe("advanced");
      expect(harness.operations).toEqual(["install", action.action]);
    }
  );

  it("returns wait_until without executing an effect", async () => {
    const harness = executorHarness({
      action: {
        action: "wait_until",
        sequence: 1,
        wakeAt: "2026-07-12T10:00:01.000Z"
      }
    });

    await expect(harness.executor.advance({ campaignId: "campaign-001" }))
      .resolves.toEqual({
        status: "waiting",
        action: "wait_until",
        sequence: 1,
        wakeAt: "2026-07-12T10:00:01.000Z"
      });
    expect(harness.operations).toEqual(["install"]);
  });

  it("maps a waiting confirmation transition to wait_until", async () => {
    const harness = executorHarness({
      action: {
        action: "advance_confirmation",
        armKind: "adaptive_treatment",
        sequence: 1
      },
      confirmationWakeAt: "2026-07-12T10:01:00.000Z"
    });

    await expect(harness.executor.advance({ campaignId: "campaign-001" }))
      .resolves.toEqual({
        status: "waiting",
        action: "wait_until",
        sequence: 1,
        wakeAt: "2026-07-12T10:01:00.000Z"
      });
    expect(harness.operations).toEqual(["install", "advance_confirmation"]);
  });

  it("maps a source polling transition to wait_until after its effect", async () => {
    const harness = executorHarness({
      action: { action: "advance_source_window", sequence: 1 },
      sourceWakeAt: "2026-07-12T10:00:00.025Z"
    });

    await expect(harness.executor.advance({ campaignId: "campaign-001" }))
      .resolves.toEqual({
        status: "waiting",
        action: "wait_until",
        sequence: 1,
        wakeAt: "2026-07-12T10:00:00.025Z"
      });
    expect(harness.operations).toEqual(["install", "advance_source_window"]);
  });

  it("collects the final outcome once and then returns complete", async () => {
    let action: ResearchControlCampaignPaperNextAction = {
      action: "collect_campaign_outcome"
    };
    const harness = executorHarness({
      get action() { return action; },
      onCollect() {
        action = { action: "complete" };
      }
    });

    const collected = await harness.executor.advance({ campaignId: "campaign-001" });
    const complete = await harness.executor.advance({ campaignId: "campaign-001" });

    expect(collected).toMatchObject({
      status: "advanced",
      action: "collect_campaign_outcome",
      outcome: {
        research_control_campaign_outcome_id: "outcome-001",
        arms: [{ metrics: { qualified_discovery_count: 1 } }]
      }
    });
    expect(complete).toEqual({ status: "complete", action: "complete" });
    expect(harness.operations).toEqual([
      "install",
      "collect_campaign_outcome",
      "install"
    ]);
  });
});

function executorHarness(input: {
  readonly action: ResearchControlCampaignPaperNextAction;
  onCollect?: () => void;
  confirmationWakeAt?: string;
  sourceWakeAt?: string;
}) {
  const graph = graphFixture();
  const operations: string[] = [];
  const store = new ExecutorStore(graph);
  const actionHandler = async (action: string) => {
    operations.push(action);
  };
  const executor = new ResearchControlCampaignPaperExecutor({
    coordinator: port(store),
    arms: {
      adaptive_treatment: port(store),
      static_control: port(store)
    },
    installGraph: async () => {
      operations.push("install");
    },
    loadEvidence: async () => ({
      schedule: graph.schedule,
      now: "2026-07-12T10:00:00.000Z",
      confirmationPrecommitDeadlineMs: 1_000,
      slots: [],
      startBatches: []
    }),
    projectNextAction: () => input.action,
    actions: {
      expireUnopenedSourceSlot: () => actionHandler(
        "expire_unopened_source_slot"
      ),
      prepareSourceBatch: () => actionHandler("prepare_source_batch"),
      captureSourceStartBatch: () => actionHandler(
        "capture_source_start_batch"
      ),
      authorizeSourceBatch: () => actionHandler("authorize_source_batch"),
      startSourceBatch: () => actionHandler("start_source_batch"),
      async advanceSourceWindow() {
        await actionHandler("advance_source_window");
        return {
          transition: "none" as const,
          steps: [],
          terminal: false,
          ...(input.sourceWakeAt ? { wakeAt: input.sourceWakeAt } : {})
        };
      },
      adjudicateSourceVerdict: () => actionHandler(
        "adjudicate_source_verdict"
      ),
      precommitOrExpireConfirmation: (action) => actionHandler(action.action),
      async advanceConfirmation(action) {
        await actionHandler("advance_confirmation");
        return input.confirmationWakeAt
          ? {
              status: "waiting" as const,
              slotIndex: action.sequence,
              comparisonId: "confirmation-comparison-1",
              wakeAt: input.confirmationWakeAt
            }
          : {
              status: "advanced" as const,
              slotIndex: action.sequence,
              comparisonId: "confirmation-comparison-1"
            };
      },
      recordSlotOutcome: () => actionHandler("record_slot_outcome"),
      async collectCampaignOutcome() {
        operations.push("collect_campaign_outcome");
        input.onCollect?.();
        return outcomeFixture();
      }
    }
  });
  return { executor, operations };
}

class ExecutorStore {
  constructor(private readonly graph: ReturnType<typeof graphFixture>) {}

  root() {
    return "executor";
  }

  async getResearchControlCampaign(id: string) {
    return id === this.graph.campaign.research_control_campaign_id
      ? structuredClone(this.graph.campaign)
      : undefined;
  }

  async listResearchControlCampaignReports() {
    return [structuredClone(this.graph.report)];
  }

  async listResearchControlCampaignPaperSchedules() {
    return [structuredClone(this.graph.schedule)];
  }
}

function graphFixture() {
  const campaign = {
    record_kind: "research_control_campaign",
    research_control_campaign_id: "campaign-001",
    campaign_digest: "sha256:campaign"
  } as ResearchControlCampaignRecord;
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
    schedule_digest: "sha256:schedule"
  } as ResearchControlCampaignPaperScheduleRecord;
  return { campaign, report, schedule };
}

function outcomeFixture(): ResearchControlCampaignOutcomeRecord {
  return {
    record_kind: "research_control_campaign_outcome",
    research_control_campaign_outcome_id: "outcome-001",
    arms: [{ metrics: { qualified_discovery_count: 1 } }]
  } as unknown as ResearchControlCampaignOutcomeRecord;
}

function port(store: ExecutorStore): OuroborosStorePort {
  return store as unknown as OuroborosStorePort;
}
