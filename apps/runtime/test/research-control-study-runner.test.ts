import { describe, expect, it } from "vitest";
import type { ResearchControlStudyOutcomeRecord } from "@ouroboros/domain";
import { ResearchControlStudyExecutorError } from
  "../src/candidate/arena/research-control-study-executor";
import {
  ResearchControlStudyRunner
} from "../src/candidate/arena/research-control-study-runner";

describe("ResearchControlStudyRunner", () => {
  it("runs study actions sequentially through effect-free completion", async () => {
    const steps = [
      ...Array.from({ length: 6 }, (_, index) => campaignStep(index + 1)),
      adjudicatedStep(),
      completeStep()
    ];
    let active = 0;
    let maximumActive = 0;
    let callCount = 0;
    const runner = new ResearchControlStudyRunner({
      executor: {
        async advance() {
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          const step = steps[callCount++]!;
          active -= 1;
          return step;
        }
      }
    });

    expect(runner.status()).toEqual({ status: "idle" });
    runner.start({ studyId: "study-001" });
    expect(runner.status()).toMatchObject({
      status: "running",
      studyId: "study-001"
    });
    await runner.drain();

    expect(callCount).toBe(8);
    expect(maximumActive).toBe(1);
    expect(runner.status()).toEqual({
      status: "completed",
      latestStep: completeStep()
    });
  });

  it("completes an already terminal study without another effect", async () => {
    let callCount = 0;
    const runner = new ResearchControlStudyRunner({
      executor: {
        async advance() {
          callCount += 1;
          return completeStep();
        }
      }
    });

    runner.start({ studyId: "study-complete" });
    await runner.drain();

    expect(callCount).toBe(1);
    expect(runner.status().status).toBe("completed");
  });

  it("guards immediately before every executor advance", async () => {
    const events: string[] = [];
    const steps = [campaignStep(1), completeStep()];
    const runner = new ResearchControlStudyRunner({
      beforeAdvance: async () => { events.push("guard"); },
      executor: {
        async advance() {
          events.push("advance");
          return steps.shift()!;
        }
      }
    });

    runner.start({ studyId: "study-guarded" });
    await runner.drain();

    expect(events).toEqual(["guard", "advance", "guard", "advance"]);
    expect(runner.status().status).toBe("completed");
  });

  it("records guard loss before another executor effect", async () => {
    const events: string[] = [];
    let guardCount = 0;
    const runner = new ResearchControlStudyRunner({
      beforeAdvance: async () => {
        guardCount += 1;
        events.push(`guard-${guardCount}`);
        if (guardCount === 2) {
          throw Object.assign(new Error("lease lost"), {
            code: "research_control_study_execution_lease_lost"
          });
        }
      },
      executor: {
        async advance() {
          events.push("advance");
          return campaignStep(1);
        }
      }
    });

    runner.start({ studyId: "study-guard-lost" });
    await runner.drain();

    expect(events).toEqual(["guard-1", "advance", "guard-2"]);
    expect(runner.status()).toMatchObject({
      status: "failed",
      errorCode: "research_control_study_execution_lease_lost"
    });
  });

  it("rejects a second active study", async () => {
    const pending = deferred<ReturnType<typeof campaignStep>>();
    const runner = new ResearchControlStudyRunner({
      executor: { advance: () => pending.promise }
    });
    runner.start({ studyId: "study-001" });

    expect(() => runner.start({ studyId: "study-002" }))
      .toThrow("research_control_study_runner_already_running");

    const stopPromise = runner.stop();
    pending.resolve(campaignStep(1));
    await stopPromise;
  });

  it("drains the active campaign and stops before the next replication", async () => {
    const pending = deferred<ReturnType<typeof campaignStep>>();
    let callCount = 0;
    const runner = new ResearchControlStudyRunner({
      executor: {
        advance() {
          callCount += 1;
          return pending.promise;
        }
      }
    });
    runner.start({ studyId: "study-stop" });
    await Promise.resolve();

    const stopPromise = runner.stop();
    pending.resolve(campaignStep(1));
    await stopPromise;

    expect(callCount).toBe(1);
    expect(runner.status()).toEqual({
      status: "stopped",
      latestStep: campaignStep(1)
    });
  });

  it("records a stable failed status and resolves drain", async () => {
    const runner = new ResearchControlStudyRunner({
      executor: {
        async advance() {
          throw new ResearchControlStudyExecutorError(
            "research_control_study_executor_graph_invalid",
            "injected graph failure"
          );
        }
      }
    });

    runner.start({ studyId: "study-failed" });
    await expect(runner.drain()).resolves.toBeUndefined();

    expect(runner.status()).toEqual({
      status: "failed",
      errorCode: "research_control_study_executor_graph_invalid",
      errorMessage: "injected graph failure"
    });
  });

  it("preserves nested campaign failure evidence for operator diagnosis", async () => {
    const cause = Object.assign(new Error("paper comparison failed"), {
      code: "paper_comparison_failed",
      details: { action: "advance_source_window" }
    });
    const runner = new ResearchControlStudyRunner({
      executor: {
        async advance() {
          throw new ResearchControlStudyExecutorError(
            "research_control_study_executor_action_failed",
            "campaign action failed",
            { replication_index: 2 },
            { cause }
          );
        }
      }
    });

    runner.start({ studyId: "study-failed" });
    await runner.drain();

    expect(runner.status()).toEqual({
      status: "failed",
      errorCode: "research_control_study_executor_action_failed",
      errorMessage:
        "campaign action failed {\"replication_index\":2}" +
        " <- paper_comparison_failed: paper comparison failed" +
        " {\"action\":\"advance_source_window\"}"
    });
  });
});

function campaignStep(replicationIndex: number) {
  return {
    status: "advanced" as const,
    action: "run_campaign" as const,
    replicationIndex,
    campaignId: `campaign-${replicationIndex}`,
    outcomeId: `campaign-${replicationIndex}-outcome`,
    resume: false
  };
}

function adjudicatedStep() {
  return {
    status: "advanced" as const,
    action: "study_adjudicated" as const,
    outcome: studyOutcome()
  };
}

function completeStep() {
  return {
    status: "complete" as const,
    action: "complete" as const,
    outcome: studyOutcome()
  };
}

function studyOutcome(): ResearchControlStudyOutcomeRecord {
  return {
    research_control_study_outcome_id: "study-outcome-001"
  } as ResearchControlStudyOutcomeRecord;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
