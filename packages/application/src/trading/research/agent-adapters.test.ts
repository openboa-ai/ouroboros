import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FixtureTradingResearchAgentAdapter
} from "./agent-adapters";
import type {
  AgentEditInput,
  ResearchWorkerDevelopmentFeedback,
  ResearchWorkerToolPort
} from "./types";

describe("FixtureTradingResearchAgentAdapter autonomous session", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-fixture-session-"));
    await writeFile(
      path.join(tmpDir, "run.py"),
      "RISK_FRACTION = 0.01\n",
      "utf8"
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("uses aggregate feedback across one bounded session and explicitly selects the best accepted submission", async () => {
    const editInputs: AgentEditInput[] = [];
    class CapturingFixtureAdapter extends FixtureTradingResearchAgentAdapter {
      override async improveArtifact(input: AgentEditInput) {
        editInputs.push(input);
        return super.improveArtifact(input);
      }
    }
    const tools = scriptedTools([feedback(0.6), feedback(0.4)]);
    const adapter = new CapturingFixtureAdapter();

    const result = await adapter.runSession({
      artifact_dir: tmpDir,
      program_path: path.join(tmpDir, "program.md"),
      notebook_path: path.join(tmpDir, "notebook.json"),
      submission_limit: 2,
      timeout_ms: 1_000,
      arena_context: "direction=trend_following",
      tools: tools.port
    });

    expect(result).toMatchObject({
      status: "selected",
      selected_submission_sequence: 1,
      provider_command_count: 2
    });
    expect(editInputs.map((input) => input.iteration)).toEqual([1, 2]);
    expect(editInputs.map((input) => input.previous_best_score)).toEqual([
      undefined,
      0.6
    ]);
    expect(tools.submissions).toHaveLength(2);
    expect(tools.selections).toEqual([1]);
    expect(tools.finishes).toEqual([]);
  });

  it("can explicitly select early without consuming the remaining submission budget", async () => {
    const tools = scriptedTools([feedback(0.95), feedback(0.5)]);
    const adapter = new FixtureTradingResearchAgentAdapter({
      early_selection_score: 0.9
    });

    const result = await adapter.runSession({
      artifact_dir: tmpDir,
      program_path: path.join(tmpDir, "program.md"),
      notebook_path: path.join(tmpDir, "notebook.json"),
      submission_limit: 2,
      timeout_ms: 1_000,
      tools: tools.port
    });

    expect(result).toMatchObject({
      status: "selected",
      selected_submission_sequence: 1,
      provider_command_count: 1
    });
    expect(tools.submissions).toHaveLength(1);
    expect(tools.selections).toEqual([1]);
  });
});

function feedback(score: number): ResearchWorkerDevelopmentFeedback {
  return {
    status: "accepted",
    score,
    metrics: [{ name: "fixture_score", score, detail: "fixture aggregate" }],
    summary: `Fixture aggregate score ${score}.`,
    risk_decision: "valid_order_request",
    profit_loss: {
      revenue_usdt: score,
      cost_usdt: 0,
      net_revenue_usdt: score,
      net_return_pct: score
    }
  };
}

function scriptedTools(feedbacks: ResearchWorkerDevelopmentFeedback[]): {
  port: ResearchWorkerToolPort;
  submissions: string[];
  selections: number[];
  finishes: string[];
} {
  const submissions: string[] = [];
  const selections: number[] = [];
  const finishes: string[] = [];
  const port: ResearchWorkerToolPort = {
    status: vi.fn(async () => ({
      session_status: "open" as const,
      submission_limit: feedbacks.length,
      completed_submission_count: submissions.length,
      remaining_submission_count: feedbacks.length - submissions.length,
      selected_submission_sequence: null
    })),
    submitDevelopment: vi.fn(async (input) => {
      const submissionSequence = submissions.length + 1;
      submissions.push(input.research_note);
      const aggregate = feedbacks[submissionSequence - 1];
      if (!aggregate) throw new Error("unexpected_fixture_submission");
      return {
        session_status: "open" as const,
        submission_sequence: submissionSequence,
        remaining_submission_count: feedbacks.length - submissionSequence,
        feedback: aggregate
      };
    }),
    selectDevelopment: vi.fn(async (input) => {
      selections.push(input.submission_sequence);
      return {
        session_status: "selected" as const,
        submission_sequence: input.submission_sequence,
        reason: input.reason
      };
    }),
    finishWithoutSubmission: vi.fn(async (input) => {
      finishes.push(input.reason);
      return {
        session_status: "finished_without_submission" as const,
        reason: input.reason
      };
    })
  };
  return { port, submissions, selections, finishes };
}
