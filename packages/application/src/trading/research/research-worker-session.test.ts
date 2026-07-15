import { describe, expect, it, vi } from "vitest";
import {
  ResearchWorkerDevelopmentSession,
  ResearchWorkerSessionError
} from "./research-worker-session";
import type {
  ResearchWorkerDevelopmentEvaluationEvidence,
  ResearchWorkerDevelopmentSubmissionRequest
} from "./types";

describe("ResearchWorkerDevelopmentSession", () => {
  it("lets the worker finish without spending development evaluation", async () => {
    const evaluate = vi.fn(async () => evidence(1, 0.5));
    const session = new ResearchWorkerDevelopmentSession({
      submissionLimit: 2,
      evaluate
    });

    expect(await session.status()).toEqual({
      session_status: "open",
      submission_limit: 2,
      completed_submission_count: 0,
      remaining_submission_count: 2,
      selected_submission_sequence: null
    });
    await expect(session.finishWithoutSubmission({
      idempotency_key: "finish-no-candidate",
      reason: "No bounded hypothesis justified evaluator spend."
    })).resolves.toEqual({
      session_status: "finished_without_submission",
      reason: "No bounded hypothesis justified evaluator spend."
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(session.completedSubmissions()).toEqual([]);
    expect(session.selectedSubmission()).toBeNull();
  });

  it("keeps call ordering worker-owned and selects any completed submission", async () => {
    const observed: ResearchWorkerDevelopmentSubmissionRequest[] = [];
    const session = new ResearchWorkerDevelopmentSession({
      submissionLimit: 2,
      evaluate: async (input) => {
        observed.push(input);
        return evidence(input.submission_sequence, input.submission_sequence === 1 ? 0.8 : 0.2);
      }
    });

    const first = await session.submitDevelopment({
      idempotency_key: "submit-cheap-check",
      research_note: "Test the smallest cost filter before changing position direction."
    });
    const second = await session.submitDevelopment({
      idempotency_key: "submit-direction-change",
      research_note: "Test the direction change despite the lower development frontier."
    });
    expect(first).toMatchObject({
      session_status: "open",
      submission_sequence: 1,
      remaining_submission_count: 1,
      feedback: { score: 0.8 }
    });
    expect(second).toMatchObject({
      session_status: "open",
      submission_sequence: 2,
      remaining_submission_count: 0,
      feedback: { score: 0.2 }
    });

    await expect(session.selectDevelopment({
      idempotency_key: "select-direction-change",
      submission_sequence: 2,
      reason: "Select the more defensible direction hypothesis, not the highest replay score."
    })).resolves.toEqual({
      session_status: "selected",
      submission_sequence: 2,
      reason: "Select the more defensible direction hypothesis, not the highest replay score."
    });
    expect(observed.map((entry) => entry.submission_sequence)).toEqual([1, 2]);
    expect(session.selectedSubmission()).toMatchObject({
      submission_sequence: 2,
      evaluation: { score: 0.2 }
    });
    expect(await session.status()).toMatchObject({
      session_status: "selected",
      selected_submission_sequence: 2
    });
  });

  it("replays exact idempotent calls without duplicate evaluator effects", async () => {
    const evaluate = vi.fn(async (input) => evidence(input.submission_sequence, 1));
    const session = new ResearchWorkerDevelopmentSession({
      submissionLimit: 1,
      evaluate
    });
    const request = {
      idempotency_key: "submission-one",
      research_note: "One exact bounded submission."
    };

    const [left, right] = await Promise.all([
      session.submitDevelopment(request),
      session.submitDevelopment({ ...request })
    ]);
    expect(left).toEqual(right);
    expect(evaluate).toHaveBeenCalledTimes(1);

    const selection = {
      idempotency_key: "selection-one",
      submission_sequence: 1,
      reason: "Freeze the only completed snapshot."
    };
    await expect(Promise.all([
      session.selectDevelopment(selection),
      session.selectDevelopment({ ...selection })
    ])).resolves.toEqual([
      {
        session_status: "selected",
        submission_sequence: 1,
        reason: selection.reason
      },
      {
        session_status: "selected",
        submission_sequence: 1,
        reason: selection.reason
      }
    ]);
  });

  it("rejects conflicting idempotency reuse across payloads and actions", async () => {
    const session = new ResearchWorkerDevelopmentSession({
      submissionLimit: 2,
      evaluate: async (input) => evidence(input.submission_sequence, 1)
    });
    await session.submitDevelopment({
      idempotency_key: "shared-key",
      research_note: "First payload."
    });

    await expect(session.submitDevelopment({
      idempotency_key: "shared-key",
      research_note: "Changed payload."
    })).rejects.toMatchObject({
      code: "research_worker_tool_idempotency_conflict"
    });
    await expect(session.finishWithoutSubmission({
      idempotency_key: "shared-key",
      reason: "Cross-action collision."
    })).rejects.toMatchObject({
      code: "research_worker_tool_idempotency_conflict"
    });
  });

  it("serializes concurrent distinct submissions within the committed budget", async () => {
    let active = 0;
    let maximumActive = 0;
    const session = new ResearchWorkerDevelopmentSession({
      submissionLimit: 2,
      evaluate: async (input) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, input.submission_sequence === 1 ? 5 : 1));
        active -= 1;
        return evidence(input.submission_sequence, input.submission_sequence);
      }
    });

    const results = await Promise.all([
      session.submitDevelopment({
        idempotency_key: "parallel-a",
        research_note: "First concurrent request."
      }),
      session.submitDevelopment({
        idempotency_key: "parallel-b",
        research_note: "Second concurrent request."
      })
    ]);
    expect(results.map((result) => result.submission_sequence)).toEqual([1, 2]);
    expect(maximumActive).toBe(1);
  });

  it("fails closed for over-budget, unknown selection, and post-terminal effects", async () => {
    const evaluate = vi.fn(async (input) => evidence(input.submission_sequence, 1));
    const session = new ResearchWorkerDevelopmentSession({
      submissionLimit: 1,
      evaluate
    });

    await expect(session.selectDevelopment({
      idempotency_key: "select-missing",
      submission_sequence: 1,
      reason: "Missing submission."
    })).rejects.toMatchObject({
      code: "research_worker_tool_submission_not_found"
    });
    await session.submitDevelopment({
      idempotency_key: "submit-only",
      research_note: "Spend the only committed submission."
    });
    await expect(session.submitDevelopment({
      idempotency_key: "submit-over-budget",
      research_note: "Must not run."
    })).rejects.toMatchObject({
      code: "research_worker_tool_budget_exhausted"
    });
    expect(evaluate).toHaveBeenCalledTimes(1);

    await session.selectDevelopment({
      idempotency_key: "select-only",
      submission_sequence: 1,
      reason: "Select the completed snapshot."
    });
    await expect(session.submitDevelopment({
      idempotency_key: "submit-after-selection",
      research_note: "Must not run after selection."
    })).rejects.toMatchObject({
      code: "research_worker_tool_session_closed"
    });
    await expect(session.finishWithoutSubmission({
      idempotency_key: "finish-after-selection",
      reason: "Must not replace selection."
    })).rejects.toMatchObject({
      code: "research_worker_tool_session_closed"
    });
  });

  it("marks evaluator failure terminal without fabricating completed evidence", async () => {
    const session = new ResearchWorkerDevelopmentSession({
      submissionLimit: 2,
      evaluate: async () => {
        throw new Error("development evaluator unavailable");
      }
    });

    await expect(session.submitDevelopment({
      idempotency_key: "submit-fails",
      research_note: "This evaluator effect fails."
    })).rejects.toThrow("development evaluator unavailable");
    expect(await session.status()).toMatchObject({
      session_status: "failed",
      completed_submission_count: 0,
      remaining_submission_count: 1
    });
    expect(session.completedSubmissions()).toEqual([]);
    await expect(session.submitDevelopment({
      idempotency_key: "submit-after-failure",
      research_note: "Must not recover inside the old session."
    })).rejects.toMatchObject({
      code: "research_worker_tool_session_closed"
    });
  });

  it("closes provider exit without auto-selecting the highest score", async () => {
    const session = new ResearchWorkerDevelopmentSession({
      submissionLimit: 2,
      evaluate: async (input) => evidence(input.submission_sequence, 100)
    });
    await session.submitDevelopment({
      idempotency_key: "unselected-high-score",
      research_note: "A high development score is not final-selection authority."
    });

    expect(session.closeAfterProviderExit()).toEqual({
      session_status: "finished_without_submission",
      reason: "provider_exited_without_terminal_action"
    });
    expect(session.selectedSubmission()).toBeNull();
  });

  it.each([
    ["bad submission limit", () => new ResearchWorkerDevelopmentSession({
      submissionLimit: 0,
      evaluate: async () => evidence(1, 1)
    }), "research_worker_session_invalid_input"],
    ["empty idempotency key", async () => {
      const session = makeSession();
      await session.submitDevelopment({ idempotency_key: "", research_note: "note" });
    }, "research_worker_tool_invalid_request"],
    ["oversized note", async () => {
      const session = makeSession();
      await session.submitDevelopment({
        idempotency_key: "oversized-note",
        research_note: "x".repeat(501)
      });
    }, "research_worker_tool_invalid_request"],
    ["invalid sequence", async () => {
      const session = makeSession();
      await session.selectDevelopment({
        idempotency_key: "bad-sequence",
        submission_sequence: 0,
        reason: "invalid"
      });
    }, "research_worker_tool_invalid_request"]
  ])("rejects %s", async (_label, action, code) => {
    try {
      await action();
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ResearchWorkerSessionError);
      expect(error).toMatchObject({ code });
    }
  });
});

function makeSession(): ResearchWorkerDevelopmentSession {
  return new ResearchWorkerDevelopmentSession({
    submissionLimit: 1,
    evaluate: async (input) => evidence(input.submission_sequence, 1)
  });
}

function evidence(
  submissionSequence: number,
  score: number
): ResearchWorkerDevelopmentEvaluationEvidence {
  return {
    submission_sequence: submissionSequence,
    artifact_dir: `/external/submission-${submissionSequence}`,
    artifact_digest: `sha256:${String(submissionSequence).padStart(64, "0")}`,
    started_at: `2026-07-13T00:00:0${submissionSequence}.000Z`,
    completed_at: `2026-07-13T00:00:1${submissionSequence}.000Z`,
    evaluation: {
      status: "accepted",
      score,
      metrics: [{ name: "aggregate", score, detail: "Aggregate development feedback." }],
      summary: "Aggregate development feedback.",
      risk_decision: "valid_order_request",
      profit_loss: {
        revenue_usdt: score,
        cost_usdt: 0,
        net_revenue_usdt: score,
        net_return_pct: score
      }
    },
    feedback: {
      status: "accepted",
      score,
      metrics: [{ name: "aggregate", score, detail: "Aggregate development feedback." }],
      summary: "Aggregate development feedback.",
      risk_decision: "valid_order_request",
      profit_loss: {
        revenue_usdt: score,
        cost_usdt: 0,
        net_revenue_usdt: score,
        net_return_pct: score
      }
    }
  };
}
