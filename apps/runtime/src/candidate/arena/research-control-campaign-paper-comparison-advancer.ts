import type { OuroborosStorePort } from
  "@ouroboros/application/ports/store";
import type {
  PaperTradingComparisonActivationCoordinator
} from "@ouroboros/application/trading/paper/comparison-activation-coordinator";
import type {
  PaperTradingComparisonRuntimeActivationCoordinator,
  PaperTradingComparisonRuntimeActivationResult
} from "@ouroboros/application/trading/paper/comparison-runtime-activation-coordinator";
import type {
  PaperTradingComparisonTickCoordinator
} from "@ouroboros/application/trading/paper/comparison-tick-coordinator";
import type {
  PaperTradingComparisonVerdictService
} from "@ouroboros/application/trading/paper/comparison-verdict-service";
import type {
  PaperTradingComparisonWindowDriver,
  PaperTradingComparisonWindowStep
} from "@ouroboros/application/trading/paper/comparison-window-driver";
import type {
  PaperTradingComparisonActivationAttemptRecord,
  PaperTradingComparisonActivationOutcomeRecord,
  PaperTradingComparisonActivationRecord,
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonTickRecord,
  PaperTradingComparisonVerdictRecord
} from "@ouroboros/domain";

export type ResearchControlCampaignPaperComparisonAdvancerErrorCode =
  | "research_control_campaign_paper_comparison_graph_invalid"
  | "research_control_campaign_paper_comparison_first_tick_failed"
  | "research_control_campaign_paper_comparison_authorization_failed"
  | "research_control_campaign_paper_comparison_start_failed"
  | "research_control_campaign_paper_comparison_recovery_failed"
  | "research_control_campaign_paper_comparison_transition_failed"
  | "research_control_campaign_paper_comparison_verdict_failed";

export class ResearchControlCampaignPaperComparisonAdvancerError extends Error {
  constructor(
    readonly code: ResearchControlCampaignPaperComparisonAdvancerErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlCampaignPaperComparisonAdvancerError";
  }
}

interface ComparisonAdvanceIdentity {
  campaignId: string;
  slotIndex: number;
  comparisonId: string;
}

export type ResearchControlCampaignPaperComparisonAdvanceResult =
  | (ComparisonAdvanceIdentity & {
      status: "first_tick_captured";
      tickId: string;
    })
  | (ComparisonAdvanceIdentity & {
      status: "activation_authorized";
      activationId: string;
    })
  | (ComparisonAdvanceIdentity & {
      status: "runtime_started";
      activationId: string;
      activationAttemptId: string;
    })
  | (ComparisonAdvanceIdentity & {
      status: "runtime_recovered";
      activationId: string;
      activationAttemptId: string;
    })
  | (ComparisonAdvanceIdentity & {
      status: "window_advanced";
      activationId: string;
      activationAttemptId: string;
      transition: PaperTradingComparisonWindowStep["transition"];
      terminal: boolean;
    })
  | (ComparisonAdvanceIdentity & {
      status: "waiting";
      wakeAt: string;
    })
  | (ComparisonAdvanceIdentity & {
      status: "verdict_adjudicated";
      verdictId: string;
    });

type ComparisonAdvanceStore = Pick<
  OuroborosStorePort,
  | "getPaperTradingComparisonConfirmationCampaign"
  | "getPaperTradingComparisonCommitment"
  | "listPaperTradingComparisonTicks"
  | "listPaperTradingComparisonActivations"
  | "listPaperTradingComparisonActivationAttempts"
  | "listPaperTradingComparisonActivationOutcomes"
  | "listPaperTradingComparisonVerdicts"
>;

export class ResearchControlCampaignPaperComparisonAdvancer {
  constructor(private readonly options: {
    store: ComparisonAdvanceStore;
    ticks: Pick<PaperTradingComparisonTickCoordinator, "captureFirstTick">;
    activations: Pick<PaperTradingComparisonActivationCoordinator, "authorize">;
    runtime: Pick<
      PaperTradingComparisonRuntimeActivationCoordinator,
      | "ownsRunningAttempt"
      | "recoverIncompleteActivations"
      | "start"
    >;
    createWindowDriver(): Pick<PaperTradingComparisonWindowDriver, "advance">;
    verdicts: Pick<PaperTradingComparisonVerdictService, "evaluate">;
  }) {}

  async advance(input: {
    campaignId: string;
    slotIndex: number;
    comparisonId: string;
  }): Promise<ResearchControlCampaignPaperComparisonAdvanceResult> {
    const identity = normalizeIdentity(input);
    const campaign = await this.loadCampaign(identity.campaignId);
    await this.validateReservedSlot(campaign, identity);
    const [ticks, activations, verdicts] = await Promise.all([
      this.options.store.listPaperTradingComparisonTicks(identity.comparisonId),
      this.options.store.listPaperTradingComparisonActivations(
        identity.comparisonId
      ),
      this.options.store.listPaperTradingComparisonVerdicts(identity.comparisonId)
    ]);
    validateBaseEvidence(identity, ticks, activations, verdicts);

    const activation = activations[0];
    if (verdicts[0]) {
      await this.validateTerminalVerdictGraph(
        identity,
        activation,
        verdicts[0]
      );
      return adjudicatedResult(identity, verdicts[0]);
    }
    if (ticks.length === 0) {
      return this.captureFirstTick(identity);
    }
    if (!activation) {
      return this.authorize(identity);
    }

    const attempts = await this.options.store
      .listPaperTradingComparisonActivationAttempts(
        activation.paper_trading_comparison_activation_id
      );
    validateAttempts(activation, attempts);
    if (attempts.length === 0) {
      return this.startRuntime(identity, activation);
    }
    const attempt = attempts.at(-1)!;
    const outcomes = await this.options.store
      .listPaperTradingComparisonActivationOutcomes(
        attempt.paper_trading_comparison_activation_attempt_id
      );
    validateOutcomes(attempt, outcomes);
    const latest = outcomes.at(-1);
    if (!latest) {
      await this.recoverExactAttempt(attempt);
      throw advanceError(
        "research_control_campaign_paper_comparison_recovery_failed",
        "Confirmation attempt never persisted a valid runtime outcome."
      );
    }
    if (latest.outcome_status === "cleanup_required") {
      throw advanceError(
        "research_control_campaign_paper_comparison_recovery_failed",
        "Confirmation attempt still requires runtime cleanup."
      );
    }
    if (latest.outcome_status === "both_running") {
      if (!this.options.runtime.ownsRunningAttempt(
        attempt.paper_trading_comparison_activation_attempt_id
      )) {
        await this.recoverExactAttempt(attempt);
        return {
          status: "runtime_recovered",
          ...identity,
          activationId:
            activation.paper_trading_comparison_activation_id,
          activationAttemptId:
            attempt.paper_trading_comparison_activation_attempt_id
        };
      }
      return this.advanceWindow(identity, activation, attempt);
    }
    if (latest.outcome_status !== "stopped_cleanly" ||
      !outcomes.some((outcome) => outcome.outcome_status === "both_running")) {
      throw advanceError(
        "research_control_campaign_paper_comparison_start_failed",
        "Confirmation attempt did not reach a valid both-running window."
      );
    }
    return this.adjudicate(identity, activation, attempt);
  }

  private async loadCampaign(
    campaignId: string
  ): Promise<PaperTradingComparisonConfirmationCampaignRecord> {
    const campaign = await this.options.store
      .getPaperTradingComparisonConfirmationCampaign(campaignId);
    if (!campaign ||
      campaign.paper_trading_comparison_confirmation_campaign_id !==
        campaignId || !Array.isArray(campaign.slots)) {
      throw advanceError(
        "research_control_campaign_paper_comparison_graph_invalid",
        "Confirmation campaign is absent or malformed."
      );
    }
    return campaign;
  }

  private async validateReservedSlot(
    campaign: PaperTradingComparisonConfirmationCampaignRecord,
    identity: ComparisonAdvanceIdentity
  ): Promise<void> {
    const matches = campaign.slots.filter((slot) =>
      slot.slot_index === identity.slotIndex
    );
    const slot = matches[0];
    const commitment = await this.options.store
      .getPaperTradingComparisonCommitment(identity.comparisonId);
    if (matches.length !== 1 || !slot ||
      slot.paper_trading_comparison_commitment_id !== identity.comparisonId ||
      !commitment ||
      commitment.paper_trading_comparison_commitment_id !==
        identity.comparisonId ||
      commitment.preparation_ref.id !==
        slot.paper_trading_comparison_preparation_id) {
      throw advanceError(
        "research_control_campaign_paper_comparison_graph_invalid",
        "Confirmation comparison is not the exact reserved campaign slot."
      );
    }
  }

  private async captureFirstTick(
    identity: ComparisonAdvanceIdentity
  ): Promise<ResearchControlCampaignPaperComparisonAdvanceResult> {
    try {
      const result = await this.options.ticks.captureFirstTick({
        comparisonId: identity.comparisonId,
        idempotencyKey: idempotencyKey(identity, "first-tick")
      });
      if (result.tick.sequence !== 1 ||
        result.tick.paper_trading_comparison_commitment_ref.id !==
          identity.comparisonId) {
        throw new Error("captured first tick differs from confirmation slot");
      }
      return {
        status: "first_tick_captured",
        ...identity,
        tickId: result.tick.paper_trading_comparison_tick_id
      };
    } catch (error) {
      throw advanceError(
        "research_control_campaign_paper_comparison_first_tick_failed",
        "Confirmation comparison first tick could not be captured.",
        error
      );
    }
  }

  private async authorize(
    identity: ComparisonAdvanceIdentity
  ): Promise<ResearchControlCampaignPaperComparisonAdvanceResult> {
    try {
      const result = await this.options.activations.authorize({
        comparisonId: identity.comparisonId,
        idempotencyKey: idempotencyKey(identity, "activation")
      });
      if (result.activation.paper_trading_comparison_commitment_ref.id !==
          identity.comparisonId) {
        throw new Error("activation differs from confirmation slot");
      }
      return {
        status: "activation_authorized",
        ...identity,
        activationId:
          result.activation.paper_trading_comparison_activation_id
      };
    } catch (error) {
      throw advanceError(
        "research_control_campaign_paper_comparison_authorization_failed",
        "Confirmation comparison activation could not be authorized.",
        error
      );
    }
  }

  private async startRuntime(
    identity: ComparisonAdvanceIdentity,
    activation: PaperTradingComparisonActivationRecord
  ): Promise<ResearchControlCampaignPaperComparisonAdvanceResult> {
    try {
      const recoveries = await this.options.runtime
        .recoverIncompleteActivations();
      if (recoveries.some((result) => result.status === "cleanup_required")) {
        throw advanceError(
          "research_control_campaign_paper_comparison_recovery_failed",
          "Arm recovery found an activation requiring cleanup."
        );
      }
      const result = await this.options.runtime.start({
        activationId:
          activation.paper_trading_comparison_activation_id,
        idempotencyKey: idempotencyKey(identity, "runtime")
      });
      if (result.status !== "both_running" ||
        result.attempt.paper_trading_comparison_activation_ref.id !==
          activation.paper_trading_comparison_activation_id ||
        !this.options.runtime.ownsRunningAttempt(
          result.attempt.paper_trading_comparison_activation_attempt_id
        )) {
        throw advanceError(
          "research_control_campaign_paper_comparison_start_failed",
          "Confirmation comparison did not start both runtime sides."
        );
      }
      return {
        status: "runtime_started",
        ...identity,
        activationId:
          activation.paper_trading_comparison_activation_id,
        activationAttemptId:
          result.attempt.paper_trading_comparison_activation_attempt_id
      };
    } catch (error) {
      if (error instanceof ResearchControlCampaignPaperComparisonAdvancerError) {
        throw error;
      }
      throw advanceError(
        "research_control_campaign_paper_comparison_start_failed",
        "Confirmation comparison runtime start failed.",
        error
      );
    }
  }

  private async recoverExactAttempt(
    attempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<PaperTradingComparisonRuntimeActivationResult> {
    let recoveries: PaperTradingComparisonRuntimeActivationResult[];
    try {
      recoveries = await this.options.runtime.recoverIncompleteActivations();
    } catch (error) {
      throw advanceError(
        "research_control_campaign_paper_comparison_recovery_failed",
        "Confirmation comparison runtime recovery failed.",
        error
      );
    }
    const matches = recoveries.filter((result) =>
      result.attempt.paper_trading_comparison_activation_attempt_id ===
        attempt.paper_trading_comparison_activation_attempt_id
    );
    if (matches.length !== 1 || matches[0]?.status !== "stopped_cleanly") {
      throw advanceError(
        "research_control_campaign_paper_comparison_recovery_failed",
        "Confirmation comparison recovery did not stop the exact attempt cleanly."
      );
    }
    return matches[0];
  }

  private async advanceWindow(
    identity: ComparisonAdvanceIdentity,
    activation: PaperTradingComparisonActivationRecord,
    attempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<ResearchControlCampaignPaperComparisonAdvanceResult> {
    let step: PaperTradingComparisonWindowStep;
    try {
      step = await this.options.createWindowDriver().advance({
        activationId:
          activation.paper_trading_comparison_activation_id,
        activationAttemptId:
          attempt.paper_trading_comparison_activation_attempt_id
      });
    } catch (error) {
      throw advanceError(
        "research_control_campaign_paper_comparison_transition_failed",
        "Confirmation comparison window transition failed.",
        error
      );
    }
    if (step.activation_id !==
        activation.paper_trading_comparison_activation_id ||
      step.activation_attempt_id !==
        attempt.paper_trading_comparison_activation_attempt_id) {
      throw advanceError(
        "research_control_campaign_paper_comparison_graph_invalid",
        "Confirmation window step differs from its active attempt."
      );
    }
    if (step.transition === "none") {
      if (step.terminal || !isExactIso(step.next_wake_at)) {
        throw advanceError(
          "research_control_campaign_paper_comparison_graph_invalid",
          "Nonterminal confirmation wait lacks an exact wake time."
        );
      }
      return {
        status: "waiting",
        ...identity,
        wakeAt: step.next_wake_at
      };
    }
    return {
      status: "window_advanced",
      ...identity,
      activationId:
        activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        attempt.paper_trading_comparison_activation_attempt_id,
      transition: step.transition,
      terminal: step.terminal
    };
  }

  private async adjudicate(
    identity: ComparisonAdvanceIdentity,
    activation: PaperTradingComparisonActivationRecord,
    attempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<ResearchControlCampaignPaperComparisonAdvanceResult> {
    try {
      const verdict = await this.options.verdicts.evaluate({
        activationId:
          activation.paper_trading_comparison_activation_id,
        activationAttemptId:
          attempt.paper_trading_comparison_activation_attempt_id
      });
      if (verdict.paper_trading_comparison_commitment_ref.id !==
          identity.comparisonId) {
        throw new Error("verdict differs from confirmation slot");
      }
      return adjudicatedResult(identity, verdict);
    } catch (error) {
      throw advanceError(
        "research_control_campaign_paper_comparison_verdict_failed",
        "Confirmation comparison verdict adjudication failed.",
        error
      );
    }
  }

  private async validateTerminalVerdictGraph(
    identity: ComparisonAdvanceIdentity,
    activation: PaperTradingComparisonActivationRecord | undefined,
    verdict: PaperTradingComparisonVerdictRecord
  ): Promise<void> {
    if (!activation ||
      activation.paper_trading_comparison_commitment_ref.id !==
        identity.comparisonId ||
      verdict.paper_trading_comparison_commitment_ref.id !==
        identity.comparisonId) {
      throw advanceError(
        "research_control_campaign_paper_comparison_graph_invalid",
        "Persisted confirmation verdict lacks its exact activation graph."
      );
    }
    const attempts = await this.options.store
      .listPaperTradingComparisonActivationAttempts(
        activation.paper_trading_comparison_activation_id
      );
    validateAttempts(activation, attempts);
    const attempt = attempts.at(-1);
    if (!attempt) {
      throw advanceError(
        "research_control_campaign_paper_comparison_graph_invalid",
        "Persisted confirmation verdict lacks an activation attempt."
      );
    }
    const outcomes = await this.options.store
      .listPaperTradingComparisonActivationOutcomes(
        attempt.paper_trading_comparison_activation_attempt_id
      );
    validateOutcomes(attempt, outcomes);
    if (outcomes.at(-1)?.outcome_status !== "stopped_cleanly" ||
      !outcomes.some((outcome) => outcome.outcome_status === "both_running")) {
      throw advanceError(
        "research_control_campaign_paper_comparison_graph_invalid",
        "Persisted confirmation verdict lacks one clean terminal window."
      );
    }
  }
}

function normalizeIdentity(input: {
  campaignId: string;
  slotIndex: number;
  comparisonId: string;
}): ComparisonAdvanceIdentity {
  if (!input || !exactId(input.campaignId) ||
    !Number.isInteger(input.slotIndex) || input.slotIndex <= 0 ||
    !exactId(input.comparisonId)) {
    throw advanceError(
      "research_control_campaign_paper_comparison_graph_invalid",
      "Confirmation comparison identity is malformed."
    );
  }
  return { ...input };
}

function validateBaseEvidence(
  identity: ComparisonAdvanceIdentity,
  ticks: PaperTradingComparisonTickRecord[],
  activations: PaperTradingComparisonActivationRecord[],
  verdicts: PaperTradingComparisonVerdictRecord[]
): void {
  if (!Array.isArray(ticks) || !Array.isArray(activations) ||
    !Array.isArray(verdicts) || activations.length > 1 || verdicts.length > 1 ||
    ticks.some((tick, index) => tick.sequence !== index + 1 ||
      tick.paper_trading_comparison_commitment_ref.id !==
        identity.comparisonId) ||
    activations.some((activation) =>
      activation.paper_trading_comparison_commitment_ref.id !==
        identity.comparisonId) ||
    verdicts.some((verdict) =>
      verdict.paper_trading_comparison_commitment_ref.id !==
        identity.comparisonId) ||
    ticks.length === 0 && (activations.length > 0 || verdicts.length > 0) ||
    ticks.length > 1 && activations.length === 0 ||
    verdicts.length > 0 && activations.length !== 1) {
    throw advanceError(
      "research_control_campaign_paper_comparison_graph_invalid",
      "Confirmation comparison evidence is ambiguous or out of order."
    );
  }
}

function validateAttempts(
  activation: PaperTradingComparisonActivationRecord,
  attempts: PaperTradingComparisonActivationAttemptRecord[]
): void {
  if (!Array.isArray(attempts) || attempts.some((attempt, index) =>
    attempt.attempt_sequence !== index + 1 ||
    attempt.paper_trading_comparison_activation_ref.id !==
      activation.paper_trading_comparison_activation_id)) {
    throw advanceError(
      "research_control_campaign_paper_comparison_graph_invalid",
      "Confirmation activation attempts are ambiguous or out of order."
    );
  }
}

function validateOutcomes(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  outcomes: PaperTradingComparisonActivationOutcomeRecord[]
): void {
  if (!Array.isArray(outcomes) || outcomes.some((outcome, index) =>
    outcome.outcome_sequence !== index + 1 ||
    outcome.paper_trading_comparison_activation_attempt_ref.id !==
      attempt.paper_trading_comparison_activation_attempt_id)) {
    throw advanceError(
      "research_control_campaign_paper_comparison_graph_invalid",
      "Confirmation activation outcomes are ambiguous or out of order."
    );
  }
}

function adjudicatedResult(
  identity: ComparisonAdvanceIdentity,
  verdict: PaperTradingComparisonVerdictRecord
): ResearchControlCampaignPaperComparisonAdvanceResult {
  return {
    status: "verdict_adjudicated",
    ...identity,
    verdictId: verdict.paper_trading_comparison_verdict_id
  };
}

function idempotencyKey(
  identity: ComparisonAdvanceIdentity,
  operation: "first-tick" | "activation" | "runtime"
): string {
  return [
    "research-control-confirmation",
    identity.campaignId,
    identity.slotIndex,
    operation
  ].join(":");
}

function exactId(value: unknown): value is string {
  return typeof value === "string" && Boolean(value) && value.trim() === value;
}

function isExactIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function advanceError(
  code: ResearchControlCampaignPaperComparisonAdvancerErrorCode,
  message: string,
  cause?: unknown
): ResearchControlCampaignPaperComparisonAdvancerError {
  return new ResearchControlCampaignPaperComparisonAdvancerError(
    code,
    message,
    cause === undefined ? undefined : { cause }
  );
}
