import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
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

describe("ResearchControlCampaign paper executor restart soak", () => {
  it("preserves unique evidence across three sequences and every durable crash", async () => {
    const state = soakState();
    let terminal = false;
    for (let restart = 0; restart < 100 && !terminal; restart += 1) {
      const executor = soakExecutor(state);
      try {
        const step = await executor.advance({ campaignId: "campaign-001" });
        terminal = step.status === "complete";
      } catch (error) {
        expect(error).toMatchObject({
          code: "research_control_campaign_paper_executor_action_failed"
        });
      }
    }

    expect(terminal).toBe(true);
    expect(state.commitments.size).toBe(6);
    expect(state.ticks.size).toBe(6);
    expect(state.verdicts.size).toBe(6);
    expect(state.campaigns.size).toBe(1);
    expect(state.releases.size).toBe(1);
    expect(state.slotOutcomes.size).toBe(6);
    expect(state.finalOutcomes.size).toBe(1);
    expect(state.finalOutcome.arms).toEqual([
      { metrics: { qualified_discovery_count: 1 } },
      { metrics: { qualified_discovery_count: 0 } }
    ]);
  });
});

interface PipelineEntry {
  key: string;
  action: ResearchControlCampaignPaperNextAction;
}

function soakState() {
  const graph = graphFixture();
  const pipeline: PipelineEntry[] = [];
  for (let sequence = 1; sequence <= 3; sequence += 1) {
    pipeline.push(
      { key: `prepare:${sequence}`, action: {
        action: "prepare_source_batch", sequence } },
      { key: `capture:${sequence}`, action: {
        action: "capture_source_start_batch", sequence } },
      { key: `authorize:${sequence}`, action: {
        action: "authorize_source_batch", sequence } },
      { key: `start:${sequence}`, action: {
        action: "start_source_batch", sequence } },
      { key: `advance:${sequence}`, action: {
        action: "advance_source_window", sequence } },
      ...(["adaptive_treatment", "static_control"] as const).map((armKind) => ({
        key: `verdict:${sequence}:${armKind}`,
        action: {
          action: "adjudicate_source_verdict" as const,
          armKind,
          sequence
        }
      }))
    );
    if (sequence === 2) {
      pipeline.push(
        { key: "precommit:2", action: {
          action: "precommit_confirmation",
          armKind: "adaptive_treatment",
          sequence: 2
        } },
        { key: "confirmation:2", action: {
          action: "advance_confirmation",
          armKind: "adaptive_treatment",
          sequence: 2
        } }
      );
    }
    pipeline.push(...(["adaptive_treatment", "static_control"] as const)
      .map((armKind) => ({
        key: `outcome:${sequence}:${armKind}`,
        action: {
          action: "record_slot_outcome" as const,
          armKind,
          sequence
        }
      })));
  }
  pipeline.push({
    key: "collect",
    action: { action: "collect_campaign_outcome" }
  });
  const finalOutcome = {
    record_kind: "research_control_campaign_outcome",
    research_control_campaign_outcome_id: "outcome-001",
    arms: [
      { metrics: { qualified_discovery_count: 1 } },
      { metrics: { qualified_discovery_count: 0 } }
    ]
  } as unknown as ResearchControlCampaignOutcomeRecord;
  return {
    graph,
    pipeline,
    completed: new Set<string>(),
    commitments: new Set<string>(),
    ticks: new Set<string>(),
    verdicts: new Set<string>(),
    campaigns: new Set<string>(),
    releases: new Set<string>(),
    slotOutcomes: new Set<string>(),
    finalOutcomes: new Set<string>(),
    finalOutcome
  };
}

function soakExecutor(state: ReturnType<typeof soakState>) {
  const store = new SoakStore(state.graph);
  const current = () => state.pipeline.find((entry) =>
    !state.completed.has(entry.key)
  );
  const crashAfter = async (record: () => void) => {
    const entry = current()!;
    record();
    addUnique(state.completed, entry.key);
    throw new Error("injected_crash_after_durable_write");
  };
  const sequenceRecords = (target: Set<string>, prefix: string) => {
    const action = current()!.action as { sequence: number };
    for (const arm of ["adaptive", "static"]) {
      addUnique(target, `${prefix}:${action.sequence}:${arm}`);
    }
  };
  return new ResearchControlCampaignPaperExecutor({
    coordinator: port(store),
    arms: {
      adaptive_treatment: port(store),
      static_control: port(store)
    },
    installGraph: async () => undefined,
    loadEvidence: async () => ({
      schedule: state.graph.schedule,
      now: "2026-07-12T10:00:00.000Z",
      confirmationPrecommitDeadlineMs: 1_000,
      slots: [],
      startBatches: []
    }),
    projectNextAction: () => current()?.action ?? { action: "complete" },
    actions: {
      expireUnopenedSourceSlot: () => crashAfter(() => undefined),
      prepareSourceBatch: () => crashAfter(() =>
        sequenceRecords(state.commitments, "commitment")
      ),
      captureSourceStartBatch: () => crashAfter(() =>
        sequenceRecords(state.ticks, "tick")
      ),
      authorizeSourceBatch: () => crashAfter(() => undefined),
      startSourceBatch: () => crashAfter(() => undefined),
      advanceSourceWindow: () => crashAfter(() => undefined),
      adjudicateSourceVerdict: (action) => crashAfter(() =>
        addUnique(state.verdicts, `verdict:${action.sequence}:${action.armKind}`)
      ),
      precommitOrExpireConfirmation: () => crashAfter(() =>
        addUnique(state.campaigns, "confirmation-campaign:2")
      ),
      advanceConfirmation: () => crashAfter(() =>
        addUnique(state.releases, "research-release:2")
      ),
      recordSlotOutcome: (action) => crashAfter(() =>
        addUnique(
          state.slotOutcomes,
          `slot-outcome:${action.sequence}:${action.armKind}`
        )
      ),
      async collectCampaignOutcome() {
        addUnique(state.finalOutcomes, "outcome-001");
        addUnique(state.completed, "collect");
        return state.finalOutcome;
      }
    }
  });
}

class SoakStore {
  constructor(private readonly graph: ReturnType<typeof graphFixture>) {}
  root() { return "soak"; }
  async getResearchControlCampaign() {
    return structuredClone(this.graph.campaign);
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
    research_control_campaign_id: "campaign-001",
    campaign_digest: "sha256:campaign"
  } as ResearchControlCampaignRecord;
  const report = {
    research_control_campaign_report_id: "report-001",
    campaign_ref: { id: "campaign-001" },
    campaign_digest: "sha256:campaign",
    report_digest: "sha256:report"
  } as ResearchControlCampaignReportRecord;
  const schedule = {
    research_control_campaign_paper_schedule_id: "schedule-001",
    campaign_ref: { id: "campaign-001" },
    campaign_digest: "sha256:campaign",
    report_ref: { id: "report-001" },
    report_digest: "sha256:report",
    schedule_digest: "sha256:schedule"
  } as ResearchControlCampaignPaperScheduleRecord;
  return { campaign, report, schedule };
}

function addUnique(target: Set<string>, value: string) {
  if (target.has(value)) throw new Error(`duplicate:${value}`);
  target.add(value);
}

function port(store: SoakStore): OuroborosStorePort {
  return store as unknown as OuroborosStorePort;
}
