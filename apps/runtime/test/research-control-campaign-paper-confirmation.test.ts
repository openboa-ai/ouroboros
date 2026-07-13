import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonResearchReleaseKind,
  PaperTradingComparisonResearchReleaseRecord,
  PaperTradingComparisonVerdictRecord,
  ResearchControlCampaignArmKind,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperSlotOutcomeRecord,
  ResearchControlCampaignRecord
} from "@ouroboros/domain";
import {
  ResearchControlCampaignPaperConfirmationCoordinator,
  type ResearchControlCampaignPaperConfirmationArm
} from "../src/candidate/arena/research-control-campaign-paper-confirmation";

describe("ResearchControlCampaign paper confirmation coordinator", () => {
  it("precommits at the exact deadline and expires one millisecond later", async () => {
    const exact = confirmationFixture("2026-07-12T10:00:02.000Z");
    await expect(exact.coordinator.precommitOrExpire({
      campaign: exact.campaign,
      schedule: exact.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      sourceVerdict: sourceVerdict()
    })).resolves.toMatchObject({ status: "precommitted" });
    expect(exact.operations).toEqual(["precommit"]);
    expect(exact.coordinatorStore.outcomes).toEqual([]);

    const late = confirmationFixture("2026-07-12T10:00:02.001Z");
    const result = await late.coordinator.precommitOrExpire({
      campaign: late.campaign,
      schedule: late.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      sourceVerdict: sourceVerdict()
    });
    expect(result).toMatchObject({ status: "expired" });
    expect(late.operations).not.toContain("precommit");
    expect(late.coordinatorStore.outcomes[0]!.terminal_evidence).toMatchObject({
      evidence_kind: "confirmation_precommit_expired",
      terminal_status: "paper_slot_expired"
    });
  });

  it("replays an on-time precommit after the wall clock passes its deadline", async () => {
    const fixture = confirmationFixture("2026-07-12T10:00:02.001Z");
    fixture.store.campaign = confirmationCampaign();

    await expect(fixture.coordinator.precommitOrExpire({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      sourceVerdict: sourceVerdict()
    })).resolves.toMatchObject({ status: "precommitted" });
    expect(fixture.operations).toEqual([]);
    expect(fixture.coordinatorStore.outcomes).toEqual([]);
  });

  it("prepares and advances confirmation slots in strict sequence", async () => {
    const fixture = confirmationFixture("2026-07-12T10:00:02.500Z");
    fixture.store.campaign = confirmationCampaign();

    await expect(fixture.coordinator.advanceConfirmation({
      armKind: "adaptive_treatment",
      campaignId: fixture.store.campaign
        .paper_trading_comparison_confirmation_campaign_id
    })).resolves.toMatchObject({ status: "advanced", slotIndex: 1 });
    fixture.store.verdicts.set("confirmation-comparison-1", confirmationVerdict(1));
    fixture.setNow("2026-07-12T10:00:05.000Z");
    await expect(fixture.coordinator.advanceConfirmation({
      armKind: "adaptive_treatment",
      campaignId: fixture.store.campaign
        .paper_trading_comparison_confirmation_campaign_id
    })).resolves.toMatchObject({ status: "advanced", slotIndex: 2 });

    expect(fixture.operations).toEqual([
      "prepare:1",
      "advance:confirmation-comparison-1",
      "prepare:2",
      "advance:confirmation-comparison-2"
    ]);
  });

  it("preserves the exact confirmation comparison wake time", async () => {
    const fixture = confirmationFixture("2026-07-12T10:00:02.500Z");
    fixture.store.campaign = confirmationCampaign();
    fixture.setAdvanceWakeAt("2026-07-12T10:01:00.000Z");

    await expect(fixture.coordinator.advanceConfirmation({
      armKind: "adaptive_treatment",
      campaignId: fixture.store.campaign
        .paper_trading_comparison_confirmation_campaign_id
    })).resolves.toEqual({
      status: "waiting",
      slotIndex: 1,
      comparisonId: "confirmation-comparison-1",
      wakeAt: "2026-07-12T10:01:00.000Z"
    });
    expect(fixture.operations).toEqual([
      "prepare:1",
      "advance:confirmation-comparison-1"
    ]);
  });

  it("rejects a waiting result from a different confirmation comparison", async () => {
    const fixture = confirmationFixture("2026-07-12T10:00:02.500Z");
    fixture.store.campaign = confirmationCampaign();
    fixture.setAdvanceWakeAt("2026-07-12T10:01:00.000Z");
    fixture.setAdvanceComparisonId("different-comparison");

    await expect(fixture.coordinator.advanceConfirmation({
      armKind: "adaptive_treatment",
      campaignId: fixture.store.campaign
        .paper_trading_comparison_confirmation_campaign_id
    })).rejects.toMatchObject({
      code: "research_control_campaign_paper_confirmation_graph_invalid"
    });
  });

  it("settles expired remaining slots and creates one research release", async () => {
    const fixture = confirmationFixture("2026-07-12T10:00:10.001Z");
    fixture.store.campaign = confirmationCampaign();

    const result = await fixture.coordinator.advanceConfirmation({
      armKind: "adaptive_treatment",
      campaignId: fixture.store.campaign
        .paper_trading_comparison_confirmation_campaign_id
    });

    expect(result).toMatchObject({
      status: "released",
      release: { release_kind: "campaign_slot_expired" }
    });
    expect(fixture.operations).toEqual(["settle", "release"]);
  });

  it.each([
    ["confirmed_improvement", "qualified_improvement"],
    ["challenger_not_reproduced", "not_reproduced"],
    ["comparison_evidence_ineligible", "evidence_ineligible"],
    ["campaign_slot_expired", "paper_slot_expired"]
  ] as const)("maps %s release to %s terminal evidence", async (
    releaseKind,
    terminalStatus
  ) => {
    const fixture = confirmationFixture("2026-07-12T10:00:05.000Z");
    const campaign = confirmationCampaign();
    const outcome = confirmationOutcome(campaign);
    const release = researchRelease(campaign, outcome, releaseKind);

    const slotOutcome = await fixture.coordinator.recordReleaseSlotOutcome({
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      campaign,
      outcome,
      release
    });

    expect(slotOutcome.terminal_evidence).toMatchObject({
      evidence_kind: "confirmation_release",
      release_kind: releaseKind,
      terminal_status: terminalStatus
    });
    expect(fixture.coordinatorStore.outcomes).toEqual([slotOutcome]);
  });
});

class ConfirmationStore {
  campaign?: PaperTradingComparisonConfirmationCampaignRecord;
  verdicts = new Map<string, PaperTradingComparisonVerdictRecord>();
  outcome?: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
  release?: PaperTradingComparisonResearchReleaseRecord;
  outcomes: ResearchControlCampaignPaperSlotOutcomeRecord[] = [];

  root() {
    return "confirmation";
  }

  async getPaperTradingComparisonConfirmationCampaign(id: string) {
    return this.campaign?.paper_trading_comparison_confirmation_campaign_id === id
      ? structuredClone(this.campaign)
      : undefined;
  }

  async listPaperTradingComparisonConfirmationCampaigns() {
    return this.campaign ? [structuredClone(this.campaign)] : [];
  }

  async getPaperTradingComparisonPreparation(id: string) {
    return id.endsWith("-prepared") ? { id } : undefined;
  }

  async getPaperTradingComparisonCommitment(id: string) {
    return id.endsWith("-prepared") ? { id } : undefined;
  }

  async listPaperTradingComparisonVerdicts(comparisonId: string) {
    const verdict = this.verdicts.get(comparisonId);
    return verdict ? [structuredClone(verdict)] : [];
  }

  async getPaperTradingComparisonConfirmationCampaignOutcome(id: string) {
    return this.outcome
      ?.paper_trading_comparison_confirmation_campaign_outcome_id === id
      ? structuredClone(this.outcome)
      : undefined;
  }

  async getPaperTradingComparisonResearchRelease(id: string) {
    return this.release?.paper_trading_comparison_research_release_id === id
      ? structuredClone(this.release)
      : undefined;
  }

  async recordResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ) {
    return this.appendOutcome(outcome);
  }

  async replicateResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ) {
    return this.appendOutcome(outcome);
  }

  async getResearchControlCampaignPaperSlotOutcome(id: string) {
    return structuredClone(this.outcomes.find((outcome) =>
      outcome.research_control_campaign_paper_slot_outcome_id === id
    ));
  }

  private appendOutcome(outcome: ResearchControlCampaignPaperSlotOutcomeRecord) {
    const existing = this.outcomes.find((candidate) =>
      candidate.research_control_campaign_paper_slot_outcome_id ===
        outcome.research_control_campaign_paper_slot_outcome_id
    );
    if (!existing) this.outcomes.push(structuredClone(outcome));
    return structuredClone(existing ?? outcome);
  }
}

function confirmationFixture(now: string) {
  let currentNow = now;
  let advanceWakeAt: string | undefined;
  let advanceComparisonId: string | undefined;
  const operations: string[] = [];
  const store = new ConfirmationStore();
  const coordinatorStore = new ConfirmationStore();
  const schedule = scheduleFixture();
  const campaign = campaignFixture();
  const arm: ResearchControlCampaignPaperConfirmationArm = {
    store: port(store),
    campaigns: {
      async precommit() {
        operations.push("precommit");
        store.campaign = confirmationCampaign();
        return structuredClone(store.campaign);
      },
      async settle() {
        operations.push("settle");
        store.outcome = confirmationOutcome(store.campaign!);
        return structuredClone(store.outcome);
      }
    },
    windows: {
      async prepareNext() {
        const firstOpen = store.campaign!.slots.find((slot) =>
          !store.verdicts.has(slot.paper_trading_comparison_commitment_id)
        )!;
        operations.push(`prepare:${firstOpen.slot_index}`);
        return {
          preparation: {
            paper_trading_comparison_preparation_id:
              firstOpen.paper_trading_comparison_preparation_id
          },
          commitment: {
            paper_trading_comparison_commitment_id:
              firstOpen.paper_trading_comparison_commitment_id
          }
        } as never;
      }
    },
    async advanceComparison(input) {
      operations.push(`advance:${input.comparisonId}`);
      return advanceWakeAt
        ? {
            status: "waiting" as const,
            campaignId: input.campaignId,
            slotIndex: input.slotIndex,
            comparisonId: advanceComparisonId ?? input.comparisonId,
            wakeAt: advanceWakeAt
          }
        : {
            status: "window_advanced" as const,
            campaignId: input.campaignId,
            slotIndex: input.slotIndex,
            comparisonId: input.comparisonId,
            activationId: "confirmation-activation",
            activationAttemptId: "confirmation-attempt",
            transition: "capture_first_checkpoint" as const,
            terminal: false
          };
    },
    releases: {
      async release() {
        operations.push("release");
        store.release = researchRelease(
          store.campaign!,
          store.outcome!,
          "campaign_slot_expired"
        );
        return structuredClone(store.release);
      }
    }
  };
  const coordinator = new ResearchControlCampaignPaperConfirmationCoordinator({
    coordinator: port(coordinatorStore),
    arms: {
      adaptive_treatment: arm,
      static_control: arm
    },
    now: () => currentNow,
    decideSlotOutcome: (input) => slotOutcome(input)
  });
  return {
    coordinator,
    coordinatorStore,
    store,
    campaign,
    schedule,
    operations,
    setNow(value: string) {
      currentNow = value;
    },
    setAdvanceWakeAt(value: string) {
      advanceWakeAt = value;
    },
    setAdvanceComparisonId(value: string) {
      advanceComparisonId = value;
    }
  };
}

function sourceVerdict(): PaperTradingComparisonVerdictRecord {
  return {
    record_kind: "paper_trading_comparison_verdict",
    paper_trading_comparison_verdict_id: "source-verdict",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "adaptive_treatment-comparison"
    },
    paper_trading_comparison_commitment_digest:
      "sha256:adaptive_treatment-comparison",
    verdict_outcome: "challenger_improved",
    confirmation_disposition: "requires_precommitted_campaign",
    evaluated_at: "2026-07-12T10:00:01.000Z",
    verdict_digest: "sha256:source-verdict"
  } as PaperTradingComparisonVerdictRecord;
}

function confirmationCampaign():
PaperTradingComparisonConfirmationCampaignRecord {
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    paper_trading_comparison_confirmation_campaign_id: "confirmation-campaign",
    source_verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: "source-verdict"
    },
    source_verdict_digest: "sha256:source-verdict",
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "adaptive_treatment-comparison"
    },
    source_comparison_digest: "sha256:adaptive_treatment-comparison",
    campaign_policy: {
      maximum_slot_start_delay_ms: 1_000
    },
    slots: [1, 2].map((slotIndex) => ({
      slot_index: slotIndex,
      comparison_idempotency_key: `confirmation-${slotIndex}`,
      paper_trading_comparison_preparation_id:
        `confirmation-preparation-${slotIndex}`,
      paper_trading_comparison_commitment_id:
        `confirmation-comparison-${slotIndex}`
    })),
    committed_at: "2026-07-12T10:00:02.000Z",
    campaign_digest: "sha256:confirmation-campaign"
  } as PaperTradingComparisonConfirmationCampaignRecord;
}

function confirmationVerdict(slotIndex: number): PaperTradingComparisonVerdictRecord {
  return {
    record_kind: "paper_trading_comparison_verdict",
    paper_trading_comparison_verdict_id: `confirmation-verdict-${slotIndex}`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: `confirmation-comparison-${slotIndex}`
    },
    verdict_outcome: "challenger_improved",
    evaluated_at: new Date(Date.parse("2026-07-12T10:00:03.000Z") +
      slotIndex * 1_000).toISOString(),
    verdict_digest: `sha256:confirmation-verdict-${slotIndex}`
  } as PaperTradingComparisonVerdictRecord;
}

function confirmationOutcome(
  campaign: PaperTradingComparisonConfirmationCampaignRecord
): PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    paper_trading_comparison_confirmation_campaign_outcome_id:
      `${campaign.paper_trading_comparison_confirmation_campaign_id}-outcome`,
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: campaign.paper_trading_comparison_confirmation_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    outcome_digest: "sha256:confirmation-outcome"
  } as PaperTradingComparisonConfirmationCampaignOutcomeRecord;
}

function researchRelease(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  releaseKind: PaperTradingComparisonResearchReleaseKind
): PaperTradingComparisonResearchReleaseRecord {
  return {
    record_kind: "paper_trading_comparison_research_release",
    paper_trading_comparison_research_release_id:
      `${outcome.paper_trading_comparison_confirmation_campaign_outcome_id}-research-release`,
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: campaign.paper_trading_comparison_confirmation_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    campaign_outcome_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: outcome.paper_trading_comparison_confirmation_campaign_outcome_id
    },
    campaign_outcome_digest: outcome.outcome_digest,
    release_kind: releaseKind,
    released_at: "2026-07-12T10:00:10.001Z",
    release_digest: `sha256:${releaseKind}`
  } as PaperTradingComparisonResearchReleaseRecord;
}

function scheduleFixture(): ResearchControlCampaignPaperScheduleRecord {
  return {
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
        source_comparison_commitment_id: "adaptive_treatment-comparison"
      }]
    }, {
      arm_kind: "static_control",
      slots: [{ slot_status: "no_admitted_candidate", sequence: 1 }]
    }]
  } as ResearchControlCampaignPaperScheduleRecord;
}

function campaignFixture(): ResearchControlCampaignRecord {
  return {
    record_kind: "research_control_campaign",
    research_control_campaign_id: "campaign-001",
    campaign_digest: "sha256:campaign",
    paper_comparator: { comparator_status: "trading_review" },
    paper_evaluation_protocol: {
      protocol_status: "bound",
      protocol_digest: "sha256:paper-protocol",
      schedule_policy: {
        confirmation_precommit_deadline_ms: 1_000
      }
    }
  } as ResearchControlCampaignRecord;
}

function slotOutcome(input: {
  schedule: ResearchControlCampaignPaperScheduleRecord;
  armKind: ResearchControlCampaignArmKind;
  sequence: number;
  terminalEvidence: ResearchControlCampaignPaperSlotOutcomeRecord["terminal_evidence"];
  terminalAt: string;
}): ResearchControlCampaignPaperSlotOutcomeRecord {
  return {
    record_kind: "research_control_campaign_paper_slot_outcome",
    research_control_campaign_paper_slot_outcome_id:
      `slot-${input.armKind}-${input.sequence}`,
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: input.schedule.research_control_campaign_paper_schedule_id
    },
    schedule_digest: input.schedule.schedule_digest,
    arm_kind: input.armKind,
    sequence: input.sequence,
    terminal_evidence: structuredClone(input.terminalEvidence),
    terminal_at: input.terminalAt,
    slot_outcome_digest: "sha256:slot-outcome"
  } as ResearchControlCampaignPaperSlotOutcomeRecord;
}

function port(store: ConfirmationStore): OuroborosStorePort {
  return store as unknown as OuroborosStorePort;
}
