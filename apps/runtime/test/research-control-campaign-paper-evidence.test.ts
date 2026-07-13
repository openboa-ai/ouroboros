import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  PaperTradingComparisonVerdictRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord
} from "@ouroboros/domain";
import {
  loadResearchControlCampaignPaperEvidence,
  ResearchControlCampaignPaperEvidenceError
} from "../src/candidate/arena/research-control-campaign-paper-evidence";

describe("ResearchControlCampaign paper evidence loader", () => {
  it("loads one unopened schedule-owned slot without fabricating evidence", async () => {
    const graph = graphFixture();
    const coordinator = new EvidenceStore();
    const arm = new EvidenceStore();

    const evidence = await loadResearchControlCampaignPaperEvidence({
      graph,
      coordinator: port(coordinator),
      arms: {
        adaptive_treatment: port(arm),
        static_control: port(new EvidenceStore())
      },
      now: "2026-07-12T10:00:00.500Z"
    });

    expect(evidence).toEqual({
      schedule: graph.schedule,
      now: "2026-07-12T10:00:00.500Z",
      confirmationPrecommitDeadlineMs: 1_000,
      slots: [{ armKind: "adaptive_treatment", sequence: 1 }],
      startBatches: []
    });
  });

  it("rejects duplicate source verdict evidence before projection", async () => {
    const graph = graphFixture();
    const arm = new EvidenceStore();
    arm.verdicts = [verdict("verdict-1"), verdict("verdict-2")];

    await expect(loadResearchControlCampaignPaperEvidence({
      graph,
      coordinator: port(new EvidenceStore()),
      arms: {
        adaptive_treatment: port(arm),
        static_control: port(new EvidenceStore())
      },
      now: "2026-07-12T10:00:00.500Z"
    })).rejects.toBeInstanceOf(ResearchControlCampaignPaperEvidenceError);
  });
});

class EvidenceStore {
  verdicts: PaperTradingComparisonVerdictRecord[] = [];

  root() { return "evidence"; }
  async getPaperTradingComparisonPreparation() { return undefined; }
  async getPaperTradingComparisonCommitment() { return undefined; }
  async listPaperTradingComparisonTicks() { return []; }
  async listPaperTradingComparisonActivations() { return []; }
  async listPaperTradingComparisonVerdicts() {
    return structuredClone(this.verdicts);
  }
  async getResearchControlCampaignPaperSlotOutcome() { return undefined; }
  async listResearchControlCampaignPaperStartBatches() { return []; }
  async listResearchControlCampaignOutcomes() { return []; }
}

function graphFixture() {
  const campaign = {
    research_control_campaign_id: "campaign-001",
    campaign_digest: "sha256:campaign",
    paper_evaluation_protocol: {
      protocol_status: "bound",
      protocol_digest: "sha256:paper-protocol",
      schedule_policy: {
        confirmation_precommit_deadline_ms: 1_000
      }
    }
  } as ResearchControlCampaignRecord;
  const report = {
    research_control_campaign_report_id: "report-001",
    report_digest: "sha256:report"
  } as ResearchControlCampaignReportRecord;
  const schedule = {
    record_kind: "research_control_campaign_paper_schedule",
    research_control_campaign_paper_schedule_id: "schedule-001",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: "campaign-001"
    },
    campaign_digest: "sha256:campaign",
    paper_evaluation_protocol_digest: "sha256:paper-protocol",
    schedule_digest: "sha256:schedule",
    arms: [{
      arm_kind: "adaptive_treatment",
      slots: [{
        slot_status: "candidate_scheduled",
        sequence: 1,
        source_preparation_id: "adaptive-preparation",
        source_comparison_commitment_id: "adaptive-comparison"
      }]
    }, {
      arm_kind: "static_control",
      slots: [{ slot_status: "no_admitted_candidate", sequence: 1 }]
    }]
  } as ResearchControlCampaignPaperScheduleRecord;
  return { campaign, report, schedule };
}

function verdict(id: string): PaperTradingComparisonVerdictRecord {
  return {
    paper_trading_comparison_verdict_id: id,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "adaptive-comparison"
    }
  } as PaperTradingComparisonVerdictRecord;
}

function port(store: EvidenceStore): OuroborosStorePort {
  return store as unknown as OuroborosStorePort;
}
