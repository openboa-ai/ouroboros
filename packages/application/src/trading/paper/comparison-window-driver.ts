import type {
  PaperTradingComparisonCheckpointAttemptRecord,
  PaperTradingComparisonCheckpointOutcomeRecord,
  PaperTradingComparisonTickRecord
} from "@ouroboros/domain";
import type { PaperTradingComparisonRuntimeActivationResult } from
  "./comparison-runtime-activation-coordinator";
import type {
  PaperTradingComparisonWindowSnapshot,
  PaperTradingComparisonWindowStateReader
} from "./comparison-window-reader";
import {
  classifyPaperTradingComparisonWindow,
  type PaperTradingComparisonWindowDecision,
  type PaperTradingComparisonWindowPhase,
  type PaperTradingComparisonWindowTransition
} from "./comparison-window-state";

interface WindowTickPort {
  captureNextTick(input: {
    activationId: string;
    activationAttemptId: string;
    idempotencyKey: string;
  }): Promise<{ tick: PaperTradingComparisonTickRecord }>;
}

interface WindowCheckpointPort {
  captureFirst(input: {
    activationId: string;
    activationAttemptId: string;
    idempotencyKey: string;
  }): Promise<PaperTradingComparisonCheckpointOutcomeRecord>;
  beginNext(input: {
    activationId: string;
    activationAttemptId: string;
    tickId: string;
    idempotencyKey: string;
  }): Promise<PaperTradingComparisonCheckpointAttemptRecord>;
  completeNext(input: {
    checkpointAttemptId: string;
  }): Promise<PaperTradingComparisonCheckpointOutcomeRecord>;
}

interface WindowActivationPort {
  stopOwnedAttempt(input: {
    attemptId: string;
    reason: "handoff_cleanup";
  }): Promise<PaperTradingComparisonRuntimeActivationResult>;
}

export interface PaperTradingComparisonWindowDriverOptions {
  reader: PaperTradingComparisonWindowStateReader;
  ticks: WindowTickPort;
  checkpoints: WindowCheckpointPort;
  activations: WindowActivationPort;
}

export interface PaperTradingComparisonWindowStep {
  activation_id: string;
  activation_attempt_id: string;
  phase: PaperTradingComparisonWindowPhase;
  checkpoint_sequence: number;
  transition: PaperTradingComparisonWindowTransition;
  terminal: boolean;
  next_wake_at?: string;
  stable_error_code?: string;
  authority_status: "not_live";
}

export class PaperTradingComparisonWindowDriverError extends Error {
  constructor(
    readonly code:
      | "invalid_paper_trading_comparison_window_input"
      | "paper_trading_comparison_window_transition_failed",
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingComparisonWindowDriverError";
  }
}

export class PaperTradingComparisonWindowDriver {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: PaperTradingComparisonWindowDriverOptions) {}

  advance(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonWindowStep> {
    const queued = this.queue.then(() => this.advanceUnlocked(normalizeInput(input)));
    this.queue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued;
  }

  private async advanceUnlocked(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonWindowStep> {
    const before = await this.options.reader.load(input);
    const decision = classifyPaperTradingComparisonWindow(before.facts);
    if (decision.transition === "none") {
      return buildStep(input, decision, "none");
    }

    try {
      await this.executeTransition(input, before, decision);
    } catch (error) {
      throw new PaperTradingComparisonWindowDriverError(
        "paper_trading_comparison_window_transition_failed",
        `Paper comparison window ${decision.transition} transition failed.`,
        {
          transition: decision.transition,
          cause_code: stableErrorCode(error),
          ...stableErrorDetails(error)
        }
      );
    }
    const after = await this.options.reader.load(input);
    return buildStep(
      input,
      classifyPaperTradingComparisonWindow(after.facts),
      decision.transition
    );
  }

  private async executeTransition(
    input: { activationId: string; activationAttemptId: string },
    snapshot: PaperTradingComparisonWindowSnapshot,
    decision: PaperTradingComparisonWindowDecision
  ): Promise<void> {
    switch (decision.transition) {
      case "capture_first_checkpoint":
        await this.options.checkpoints.captureFirst({
          ...input,
          idempotencyKey: checkpointIdempotencyKey(input.activationAttemptId, 1)
        });
        return;
      case "capture_next_tick": {
        const nextSequence = snapshot.facts.tick_count + 1;
        await this.options.ticks.captureNextTick({
          ...input,
          idempotencyKey: `window:${input.activationAttemptId}:tick:${nextSequence}`
        });
        return;
      }
      case "begin_next_checkpoint":
        await this.options.checkpoints.beginNext({
          ...input,
          tickId: snapshot.latest_tick_id,
          idempotencyKey: checkpointIdempotencyKey(
            input.activationAttemptId,
            decision.checkpoint_sequence
          )
        });
        return;
      case "complete_next_checkpoint":
        if (!snapshot.latest_checkpoint_attempt_id) {
          throw new Error("paper_trading_comparison_window_checkpoint_attempt_missing");
        }
        await this.options.checkpoints.completeNext({
          checkpointAttemptId: snapshot.latest_checkpoint_attempt_id
        });
        return;
      case "stop_window": {
        const result = await this.options.activations.stopOwnedAttempt({
          attemptId: input.activationAttemptId,
          reason: "handoff_cleanup"
        });
        if (result.status !== "stopped_cleanly") {
          throw new Error("paper_trading_comparison_window_stop_incomplete");
        }
        return;
      }
      case "none":
        return;
    }
  }
}

function normalizeInput(input: {
  activationId: string;
  activationAttemptId: string;
}): { activationId: string; activationAttemptId: string } {
  if (input === null || typeof input !== "object" ||
    typeof input.activationId !== "string" ||
    input.activationId.trim() !== input.activationId ||
    !input.activationId ||
    typeof input.activationAttemptId !== "string" ||
    input.activationAttemptId.trim() !== input.activationAttemptId ||
    !input.activationAttemptId) {
    throw new PaperTradingComparisonWindowDriverError(
      "invalid_paper_trading_comparison_window_input",
      "Paper comparison activation and attempt IDs are required."
    );
  }
  return { ...input };
}

function checkpointIdempotencyKey(attemptId: string, sequence: number): string {
  return `window:${attemptId}:checkpoint:${sequence}`;
}

function buildStep(
  input: { activationId: string; activationAttemptId: string },
  decision: PaperTradingComparisonWindowDecision,
  transition: PaperTradingComparisonWindowTransition
): PaperTradingComparisonWindowStep {
  return {
    activation_id: input.activationId,
    activation_attempt_id: input.activationAttemptId,
    phase: decision.phase,
    checkpoint_sequence: decision.checkpoint_sequence,
    transition,
    terminal: decision.terminal,
    ...(decision.next_wake_at ? { next_wake_at: decision.next_wake_at } : {}),
    ...(decision.stable_error_code
      ? { stable_error_code: decision.stable_error_code }
      : {}),
    authority_status: "not_live"
  };
}

function stableErrorCode(error: unknown): string {
  if (error !== null && typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  if (error instanceof Error && error.message.startsWith("paper_trading_")) {
    return error.message;
  }
  return "paper_trading_comparison_window_transition_failed";
}

function stableErrorDetails(error: unknown): { cause_details?: Record<string, unknown> } {
  if (error !== null && typeof error === "object") {
    const details = (error as { details?: unknown }).details;
    if (details !== null && typeof details === "object" && !Array.isArray(details)) {
      return { cause_details: structuredClone(details as Record<string, unknown>) };
    }
  }
  return {};
}
