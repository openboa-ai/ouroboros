import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  ResearchControlCampaignArmIntentRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperStartBatchRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord
} from "@ouroboros/domain";
import {
  ResearchControlCampaignPaperGraphError,
  installResearchControlCampaignPaperGraph
} from "../src/candidate/arena/research-control-campaign-paper-graph";

describe("ResearchControlCampaign paper graph installer", () => {
  it("installs the exact sealed graph in both arms before the next effect", async () => {
    const fixture = graphFixture();
    const operations: string[] = [];
    const coordinator = new GraphStore("coordinator", operations, fixture);
    const adaptive = new GraphStore("adaptive", operations, {
      campaign: fixture.campaign,
      intents: [fixture.intents[0]]
    });
    const control = new GraphStore("control", operations, {
      campaign: fixture.campaign,
      intents: [fixture.intents[1]]
    });

    await installResearchControlCampaignPaperGraph({
      coordinator: port(coordinator),
      arms: {
        adaptive_treatment: port(adaptive),
        static_control: port(control)
      },
      campaign: fixture.campaign,
      report: fixture.report,
      schedule: fixture.schedule
    });
    operations.push("effect");

    for (const arm of [adaptive, control]) {
      expect(arm.campaign).toEqual(fixture.campaign);
      expect(arm.intents.slice().sort((left, right) =>
        left.research_control_campaign_arm_intent_id.localeCompare(
          right.research_control_campaign_arm_intent_id
        )
      )).toEqual(fixture.intents.slice().sort((left, right) =>
        left.research_control_campaign_arm_intent_id.localeCompare(
          right.research_control_campaign_arm_intent_id
        )
      ));
      expect(arm.report).toEqual(fixture.report);
      expect(arm.schedule).toEqual(fixture.schedule);
    }
    expect(adaptive.batches).toEqual(fixture.batches);
    expect(control.batches).toEqual([]);
    expect(operations.at(-1)).toBe("effect");
    expect(operations.slice(0, -1)).not.toContain("effect");

    await installResearchControlCampaignPaperGraph({
      coordinator: port(coordinator),
      arms: {
        adaptive_treatment: port(adaptive),
        static_control: port(control)
      },
      campaign: fixture.campaign,
      report: fixture.report,
      schedule: fixture.schedule
    });
    expect(adaptive.batches).toEqual(fixture.batches);
    expect(control.batches).toEqual([]);
  });

  it.each([
    ["campaign", (fixture: GraphFixture) => ({
      ...fixture,
      campaign: { ...fixture.campaign, campaign_digest: "sha256:changed" }
    })],
    ["report", (fixture: GraphFixture) => ({
      ...fixture,
      report: { ...fixture.report, report_digest: "sha256:changed" }
    })],
    ["schedule", (fixture: GraphFixture) => ({
      ...fixture,
      schedule: { ...fixture.schedule, schedule_digest: "sha256:changed" }
    })]
  ])("rejects changed coordinator %s evidence", async (_label, change) => {
    const fixture = graphFixture();
    const changed = change(fixture) as GraphFixture;

    await expect(installResearchControlCampaignPaperGraph({
      coordinator: port(new GraphStore("coordinator", [], fixture)),
      arms: {
        adaptive_treatment: port(new GraphStore("adaptive", [], {
          campaign: fixture.campaign
        })),
        static_control: port(new GraphStore("control", [], {
          campaign: fixture.campaign
        }))
      },
      campaign: changed.campaign,
      report: changed.report,
      schedule: changed.schedule
    })).rejects.toBeInstanceOf(ResearchControlCampaignPaperGraphError);
  });

  it("rejects a coordinator intent that no longer matches the campaign arm", async () => {
    const fixture = graphFixture();
    const changedIntent = {
      ...fixture.intents[0],
      campaign_digest: "sha256:changed"
    };
    const coordinator = new GraphStore("coordinator", [], {
      ...fixture,
      intents: [changedIntent, fixture.intents[1]]
    });

    await expect(installResearchControlCampaignPaperGraph({
      coordinator: port(coordinator),
      arms: {
        adaptive_treatment: port(new GraphStore("adaptive", [], {
          campaign: fixture.campaign
        })),
        static_control: port(new GraphStore("control", [], {
          campaign: fixture.campaign
        }))
      },
      campaign: fixture.campaign,
      report: fixture.report,
      schedule: fixture.schedule
    })).rejects.toMatchObject({
      code: "research_control_campaign_paper_graph_coordinator_invalid"
    });
  });

  it("preserves an existing arm conflict instead of overwriting it", async () => {
    const fixture = graphFixture();
    const adaptive = new GraphStore("adaptive", [], {
      campaign: fixture.campaign,
      intents: [{
        ...fixture.intents[1],
        intent_digest: "sha256:arm-conflict"
      }]
    });

    await expect(installResearchControlCampaignPaperGraph({
      coordinator: port(new GraphStore("coordinator", [], fixture)),
      arms: {
        adaptive_treatment: port(adaptive),
        static_control: port(new GraphStore("control", [], {
          campaign: fixture.campaign
        }))
      },
      campaign: fixture.campaign,
      report: fixture.report,
      schedule: fixture.schedule
    })).rejects.toMatchObject({
      code: "research_control_campaign_paper_graph_arm_conflict"
    });
    expect(adaptive.intents).toHaveLength(1);
  });
});

interface GraphFixture {
  campaign: ResearchControlCampaignRecord;
  intents: [
    ResearchControlCampaignArmIntentRecord,
    ResearchControlCampaignArmIntentRecord
  ];
  report: ResearchControlCampaignReportRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
  batches: ResearchControlCampaignPaperStartBatchRecord[];
}

interface GraphStoreInput {
  campaign?: ResearchControlCampaignRecord;
  intents?: ResearchControlCampaignArmIntentRecord[];
  report?: ResearchControlCampaignReportRecord;
  schedule?: ResearchControlCampaignPaperScheduleRecord;
  batches?: ResearchControlCampaignPaperStartBatchRecord[];
}

class GraphStore {
  campaign?: ResearchControlCampaignRecord;
  intents: ResearchControlCampaignArmIntentRecord[];
  report?: ResearchControlCampaignReportRecord;
  schedule?: ResearchControlCampaignPaperScheduleRecord;
  batches: ResearchControlCampaignPaperStartBatchRecord[];

  constructor(
    private readonly name: string,
    private readonly operations: string[],
    input: GraphStoreInput
  ) {
    this.campaign = clone(input.campaign);
    this.intents = clone(input.intents ?? []);
    this.report = clone(input.report);
    this.schedule = clone(input.schedule);
    this.batches = clone(input.batches ?? []);
  }

  root() {
    return this.name;
  }

  async getResearchControlCampaign(id: string) {
    return this.campaign?.research_control_campaign_id === id
      ? clone(this.campaign)
      : undefined;
  }

  async getResearchControlCampaignArmIntent(id: string) {
    return clone(this.intents.find((intent) =>
      intent.research_control_campaign_arm_intent_id === id
    ));
  }

  async recordResearchControlCampaignArmIntent(
    intent: ResearchControlCampaignArmIntentRecord
  ) {
    this.operations.push(`${this.name}:intent:${intent.arm_kind}`);
    return this.append(
      this.intents,
      intent,
      (record) => record.research_control_campaign_arm_intent_id
    );
  }

  async getResearchControlCampaignReport(id: string) {
    return this.report?.research_control_campaign_report_id === id
      ? clone(this.report)
      : undefined;
  }

  async recordResearchControlCampaignReport(
    report: ResearchControlCampaignReportRecord
  ) {
    this.operations.push(`${this.name}:report`);
    this.report = this.singleAppend(this.report, report);
    return clone(this.report);
  }

  async getResearchControlCampaignPaperSchedule(id: string) {
    return this.schedule?.research_control_campaign_paper_schedule_id === id
      ? clone(this.schedule)
      : undefined;
  }

  async recordResearchControlCampaignPaperSchedule(
    schedule: ResearchControlCampaignPaperScheduleRecord
  ) {
    this.operations.push(`${this.name}:schedule`);
    this.schedule = this.singleAppend(this.schedule, schedule);
    return clone(this.schedule);
  }

  async listResearchControlCampaignPaperStartBatches(scheduleId?: string) {
    return clone(this.batches.filter((batch) => !scheduleId ||
      batch.schedule_ref.id === scheduleId
    ));
  }

  async getResearchControlCampaignPaperStartBatch(id: string) {
    return clone(this.batches.find((batch) =>
      batch.research_control_campaign_paper_start_batch_id === id
    ));
  }

  async replicateResearchControlCampaignPaperStartBatch(
    batch: ResearchControlCampaignPaperStartBatchRecord
  ) {
    this.operations.push(`${this.name}:batch:${batch.sequence}`);
    return this.append(
      this.batches,
      batch,
      (record) => record.research_control_campaign_paper_start_batch_id
    );
  }

  private append<T>(records: T[], value: T, id: (record: T) => string): T {
    const existing = records.find((record) => id(record) === id(value));
    if (existing && JSON.stringify(existing) !== JSON.stringify(value)) {
      throw new Error(`${this.name}:append_conflict`);
    }
    if (!existing) records.push(clone(value));
    return clone(existing ?? value);
  }

  private singleAppend<T>(existing: T | undefined, value: T): T {
    if (existing && JSON.stringify(existing) !== JSON.stringify(value)) {
      throw new Error(`${this.name}:append_conflict`);
    }
    return clone(existing ?? value);
  }
}

function port(store: GraphStore): OuroborosStorePort {
  return store as unknown as OuroborosStorePort;
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

function graphFixture(): GraphFixture {
  const adaptiveIntent = intentFixture("adaptive_treatment", "adaptive-intent");
  const controlIntent = intentFixture("static_control", "control-intent");
  const campaign = {
    record_kind: "research_control_campaign",
    research_control_campaign_id: "campaign-001",
    campaign_digest: "sha256:campaign",
    baseline: { snapshot_digest: "sha256:baseline" },
    arms: [
      {
        arm_kind: "adaptive_treatment",
        allocation_mode: "adaptive_default",
        research_control_campaign_arm_intent_id:
          adaptiveIntent.research_control_campaign_arm_intent_id,
        tick_ids: ["adaptive-tick"]
      },
      {
        arm_kind: "static_control",
        allocation_mode: "static_control",
        research_control_campaign_arm_intent_id:
          controlIntent.research_control_campaign_arm_intent_id,
        tick_ids: ["control-tick"]
      }
    ]
  } as unknown as ResearchControlCampaignRecord;
  adaptiveIntent.campaign_ref = { record_kind: "research_control_campaign", id:
    campaign.research_control_campaign_id };
  adaptiveIntent.campaign_digest = campaign.campaign_digest;
  controlIntent.campaign_ref = adaptiveIntent.campaign_ref;
  controlIntent.campaign_digest = campaign.campaign_digest;
  const report = {
    record_kind: "research_control_campaign_report",
    research_control_campaign_report_id: "report-001",
    campaign_ref: adaptiveIntent.campaign_ref,
    campaign_digest: campaign.campaign_digest,
    report_digest: "sha256:report"
  } as unknown as ResearchControlCampaignReportRecord;
  const schedule = {
    record_kind: "research_control_campaign_paper_schedule",
    research_control_campaign_paper_schedule_id: "schedule-001",
    campaign_ref: adaptiveIntent.campaign_ref,
    campaign_digest: campaign.campaign_digest,
    report_ref: {
      record_kind: "research_control_campaign_report",
      id: report.research_control_campaign_report_id
    },
    report_digest: report.report_digest,
    schedule_digest: "sha256:schedule"
  } as unknown as ResearchControlCampaignPaperScheduleRecord;
  const batch = {
    record_kind: "research_control_campaign_paper_start_batch",
    research_control_campaign_paper_start_batch_id: "batch-001",
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: schedule.research_control_campaign_paper_schedule_id
    },
    schedule_digest: schedule.schedule_digest,
    sequence: 1,
    sides: [{ arm_kind: "adaptive_treatment" }],
    start_batch_digest: "sha256:batch"
  } as unknown as ResearchControlCampaignPaperStartBatchRecord;

  return {
    campaign,
    intents: [adaptiveIntent, controlIntent],
    report,
    schedule,
    batches: [batch]
  };
}

function intentFixture(
  armKind: "adaptive_treatment" | "static_control",
  id: string
): ResearchControlCampaignArmIntentRecord {
  return {
    record_kind: "research_control_campaign_arm_intent",
    research_control_campaign_arm_intent_id: id,
    campaign_ref: { record_kind: "research_control_campaign", id: "pending" },
    campaign_digest: "pending",
    arm_kind: armKind,
    allocation_mode: armKind === "adaptive_treatment"
      ? "adaptive_default"
      : "static_control",
    baseline_snapshot_digest: "sha256:baseline",
    tick_ids: [armKind === "adaptive_treatment" ? "adaptive-tick" : "control-tick"],
    intent_digest: `sha256:${id}`
  } as ResearchControlCampaignArmIntentRecord;
}
