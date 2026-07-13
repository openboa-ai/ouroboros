import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from
  "@ouroboros/application/ports/store";
import type {
  PaperTradingComparisonActivationAttemptRecord,
  PaperTradingComparisonActivationOutcomeRecord,
  PaperTradingComparisonActivationRecord,
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonTickRecord,
  PaperTradingComparisonVerdictRecord
} from "@ouroboros/domain";
import {
  ResearchControlCampaignPaperComparisonAdvancer
} from "../src/candidate/arena/research-control-campaign-paper-comparison-advancer";

describe("ResearchControlCampaign paper comparison advancer", () => {
  it("performs one persisted setup transition per call with deterministic keys", async () => {
    const fixture = comparisonFixture();

    await expect(fixture.advancer.advance(fixture.input)).resolves.toMatchObject({
      status: "first_tick_captured",
      comparisonId: "confirmation-comparison-1"
    });
    await expect(fixture.advancer.advance(fixture.input)).resolves.toMatchObject({
      status: "activation_authorized",
      activationId: "confirmation-activation-1"
    });
    await expect(fixture.advancer.advance(fixture.input)).resolves.toMatchObject({
      status: "runtime_started",
      activationAttemptId: "confirmation-attempt-1"
    });

    expect(fixture.operations).toEqual([
      "tick:research-control-confirmation:confirmation-campaign:1:first-tick",
      "authorize:research-control-confirmation:confirmation-campaign:1:activation",
      "recover",
      "start:research-control-confirmation:confirmation-campaign:1:runtime"
    ]);
  });

  it("advances exactly one owned window transition", async () => {
    const fixture = comparisonFixture();
    fixture.installRunningAttempt(true);

    const result = await fixture.advancer.advance(fixture.input);

    expect(result).toMatchObject({
      status: "window_advanced",
      transition: "capture_first_checkpoint",
      terminal: false
    });
    expect(fixture.operations).toEqual(["driver:capture_first_checkpoint"]);
  });

  it("returns the exact wake time instead of spinning an owned window", async () => {
    const fixture = comparisonFixture({
      driverStep: {
        transition: "none",
        terminal: false,
        next_wake_at: "2026-07-12T10:01:00.000Z"
      }
    });
    fixture.installRunningAttempt(true);

    await expect(fixture.advancer.advance(fixture.input)).resolves.toEqual({
      status: "waiting",
      campaignId: "confirmation-campaign",
      slotIndex: 1,
      comparisonId: "confirmation-comparison-1",
      wakeAt: "2026-07-12T10:01:00.000Z"
    });
    expect(fixture.operations).toEqual(["driver:none"]);
  });

  it("recovers but never adopts an unowned running attempt", async () => {
    const fixture = comparisonFixture();
    fixture.installRunningAttempt(false);

    await expect(fixture.advancer.advance(fixture.input)).resolves.toMatchObject({
      status: "runtime_recovered",
      activationAttemptId: "confirmation-attempt-1"
    });
    expect(fixture.operations).toEqual(["recover"]);
  });

  it("adjudicates a cleanly stopped attempt that previously reached both running", async () => {
    const fixture = comparisonFixture();
    fixture.installRunningAttempt(false);
    fixture.outcomes.push(activationOutcome(2, "stopped_cleanly"));

    await expect(fixture.advancer.advance(fixture.input)).resolves.toMatchObject({
      status: "verdict_adjudicated",
      verdictId: "confirmation-verdict-1"
    });
    expect(fixture.operations).toEqual(["verdict"]);
  });

  it("replays an existing exact verdict without another effect", async () => {
    const fixture = comparisonFixture();
    fixture.installRunningAttempt(false);
    fixture.outcomes.push(activationOutcome(2, "stopped_cleanly"));
    fixture.verdicts.push(verdict());

    await expect(fixture.advancer.advance(fixture.input)).resolves.toMatchObject({
      status: "verdict_adjudicated",
      verdictId: "confirmation-verdict-1"
    });
    expect(fixture.operations).toEqual([]);
  });

  it("fails before effects when the campaign slot does not own the comparison", async () => {
    const fixture = comparisonFixture();

    await expect(fixture.advancer.advance({
      ...fixture.input,
      comparisonId: "different-comparison"
    })).rejects.toMatchObject({
      code: "research_control_campaign_paper_comparison_graph_invalid"
    });
    expect(fixture.operations).toEqual([]);
  });

  it("fails closed on ambiguous activation evidence", async () => {
    const fixture = comparisonFixture();
    fixture.ticks.push(firstTick());
    fixture.activations.push(activation(), {
      ...activation(),
      paper_trading_comparison_activation_id: "different-activation"
    });

    await expect(fixture.advancer.advance(fixture.input)).rejects.toMatchObject({
      code: "research_control_campaign_paper_comparison_graph_invalid"
    });
    expect(fixture.operations).toEqual([]);
  });

  it("fails closed when runtime start does not reach both running", async () => {
    const fixture = comparisonFixture({ startStatus: "stopped_cleanly" });
    fixture.ticks.push(firstTick());
    fixture.activations.push(activation());

    await expect(fixture.advancer.advance(fixture.input)).rejects.toMatchObject({
      code: "research_control_campaign_paper_comparison_start_failed"
    });
    expect(fixture.operations).toEqual([
      "recover",
      "start:research-control-confirmation:confirmation-campaign:1:runtime"
    ]);
  });

  it("fails closed on cleanup-required terminal evidence", async () => {
    const fixture = comparisonFixture();
    fixture.installRunningAttempt(false);
    fixture.outcomes.push(activationOutcome(2, "cleanup_required"));

    await expect(fixture.advancer.advance(fixture.input)).rejects.toMatchObject({
      code: "research_control_campaign_paper_comparison_recovery_failed"
    });
    expect(fixture.operations).toEqual([]);
  });
});

function comparisonFixture(options: {
  driverStep?: {
    transition: "capture_first_checkpoint" | "none";
    terminal: boolean;
    next_wake_at?: string;
  };
  startStatus?: "both_running" | "stopped_cleanly";
} = {}) {
  const operations: string[] = [];
  const ticks: PaperTradingComparisonTickRecord[] = [];
  const activations: PaperTradingComparisonActivationRecord[] = [];
  const attempts: PaperTradingComparisonActivationAttemptRecord[] = [];
  const outcomes: PaperTradingComparisonActivationOutcomeRecord[] = [];
  const verdicts: PaperTradingComparisonVerdictRecord[] = [];
  const owned = new Set<string>();
  const campaign = confirmationCampaign();
  const store = {
    async getPaperTradingComparisonConfirmationCampaign(id: string) {
      return id === campaign.paper_trading_comparison_confirmation_campaign_id
        ? structuredClone(campaign)
        : undefined;
    },
    async getPaperTradingComparisonCommitment(id: string) {
      return id === "confirmation-comparison-1"
        ? {
            paper_trading_comparison_commitment_id: id,
            preparation_ref: {
              record_kind: "paper_trading_comparison_preparation",
              id: "confirmation-preparation-1"
            }
          }
        : undefined;
    },
    async listPaperTradingComparisonTicks() {
      return structuredClone(ticks);
    },
    async listPaperTradingComparisonActivations() {
      return structuredClone(activations);
    },
    async listPaperTradingComparisonActivationAttempts() {
      return structuredClone(attempts);
    },
    async listPaperTradingComparisonActivationOutcomes() {
      return structuredClone(outcomes);
    },
    async listPaperTradingComparisonVerdicts() {
      return structuredClone(verdicts);
    }
  } as unknown as OuroborosStorePort;
  const driverStep = options.driverStep ?? {
    transition: "capture_first_checkpoint" as const,
    terminal: false
  };
  const advancer = new ResearchControlCampaignPaperComparisonAdvancer({
    store,
    ticks: {
      async captureFirstTick(input) {
        operations.push(`tick:${input.idempotencyKey}`);
        const tick = firstTick();
        ticks.push(tick);
        return { tick } as never;
      }
    },
    activations: {
      async authorize(input) {
        operations.push(`authorize:${input.idempotencyKey}`);
        const value = activation();
        activations.push(value);
        return { activation: value } as never;
      }
    },
    runtime: {
      ownsRunningAttempt(attemptId) {
        return owned.has(attemptId);
      },
      async recoverIncompleteActivations() {
        operations.push("recover");
        const latest = outcomes.at(-1);
        if (attempts[0] && latest?.outcome_status === "both_running") {
          outcomes.push(activationOutcome(
            latest.outcome_sequence + 1,
            "stopped_cleanly"
          ));
          return [{
            status: "stopped_cleanly",
            attempt: attempts[0]
          }] as never;
        }
        return [];
      },
      async start(input) {
        operations.push(`start:${input.idempotencyKey}`);
        const attempt = activationAttempt();
        const status = options.startStatus ?? "both_running";
        attempts.push(attempt);
        outcomes.push(activationOutcome(1, status));
        if (status === "both_running") owned.add(
          attempt.paper_trading_comparison_activation_attempt_id
        );
        return { status, attempt } as never;
      }
    },
    createWindowDriver() {
      return {
        async advance() {
          operations.push(`driver:${driverStep.transition}`);
          return {
            activation_id: "confirmation-activation-1",
            activation_attempt_id: "confirmation-attempt-1",
            phase: "observing",
            checkpoint_sequence: 1,
            authority_status: "not_live",
            ...driverStep
          } as never;
        }
      };
    },
    verdicts: {
      async evaluate() {
        operations.push("verdict");
        const value = verdict();
        verdicts.push(value);
        return value;
      }
    }
  });
  return {
    advancer,
    operations,
    ticks,
    activations,
    attempts,
    outcomes,
    verdicts,
    input: {
      campaignId: "confirmation-campaign",
      slotIndex: 1,
      comparisonId: "confirmation-comparison-1"
    },
    installRunningAttempt(isOwned: boolean) {
      ticks.push(firstTick());
      activations.push(activation());
      attempts.push(activationAttempt());
      outcomes.push(activationOutcome(1, "both_running"));
      if (isOwned) owned.add("confirmation-attempt-1");
    }
  };
}

function confirmationCampaign():
PaperTradingComparisonConfirmationCampaignRecord {
  return {
    paper_trading_comparison_confirmation_campaign_id:
      "confirmation-campaign",
    slots: [{
      slot_index: 1,
      paper_trading_comparison_preparation_id: "confirmation-preparation-1",
      paper_trading_comparison_commitment_id: "confirmation-comparison-1"
    }]
  } as PaperTradingComparisonConfirmationCampaignRecord;
}

function firstTick(): PaperTradingComparisonTickRecord {
  return {
    paper_trading_comparison_tick_id: "confirmation-tick-1",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "confirmation-comparison-1"
    },
    sequence: 1
  } as PaperTradingComparisonTickRecord;
}

function activation(): PaperTradingComparisonActivationRecord {
  return {
    paper_trading_comparison_activation_id: "confirmation-activation-1",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "confirmation-comparison-1"
    }
  } as PaperTradingComparisonActivationRecord;
}

function activationAttempt(): PaperTradingComparisonActivationAttemptRecord {
  return {
    paper_trading_comparison_activation_attempt_id: "confirmation-attempt-1",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "confirmation-activation-1"
    },
    attempt_sequence: 1
  } as PaperTradingComparisonActivationAttemptRecord;
}

function activationOutcome(
  sequence: number,
  status: "both_running" | "stopped_cleanly" | "cleanup_required"
): PaperTradingComparisonActivationOutcomeRecord {
  return {
    paper_trading_comparison_activation_outcome_id:
      `confirmation-outcome-${sequence}`,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: "confirmation-attempt-1"
    },
    outcome_sequence: sequence,
    outcome_status: status
  } as PaperTradingComparisonActivationOutcomeRecord;
}

function verdict(): PaperTradingComparisonVerdictRecord {
  return {
    paper_trading_comparison_verdict_id: "confirmation-verdict-1",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "confirmation-comparison-1"
    }
  } as PaperTradingComparisonVerdictRecord;
}
