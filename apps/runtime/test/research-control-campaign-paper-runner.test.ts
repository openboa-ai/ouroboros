import { describe, expect, it } from "vitest";
import type { ResearchControlCampaignPaperExecutorStep } from
  "../src/candidate/arena/research-control-campaign-paper-executor";
import {
  ResearchControlCampaignPaperRunner
} from "../src/candidate/arena/research-control-campaign-paper-runner";

describe("ResearchControlCampaign paper runner", () => {
  it("uses next_wake_at and completes without a busy loop", async () => {
    const steps: ResearchControlCampaignPaperExecutorStep[] = [
      {
        status: "waiting",
        action: "wait_until",
        sequence: 1,
        wakeAt: "2026-07-12T10:00:01.000Z"
      },
      { status: "advanced", action: "advance_source_window", sequence: 1 },
      { status: "complete", action: "complete" }
    ];
    const sleeps: number[] = [];
    let advances = 0;
    const runner = new ResearchControlCampaignPaperRunner({
      executor: {
        async advance() {
          advances += 1;
          return steps.shift()!;
        }
      },
      now: () => "2026-07-12T10:00:00.000Z",
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      }
    });

    runner.start({ campaignId: "campaign-001" });
    await runner.drain();

    expect(sleeps).toEqual([1_000]);
    expect(advances).toBe(3);
    expect(runner.status()).toMatchObject({
      status: "completed",
      latestStep: { action: "complete" }
    });
  });

  it("stops on a stable executor failure", async () => {
    const runner = new ResearchControlCampaignPaperRunner({
      executor: {
        async advance() {
          throw Object.assign(new Error("injected"), {
            code: "stable_executor_failure"
          });
        }
      }
    });

    runner.start({ campaignId: "campaign-001" });
    await runner.drain();

    expect(runner.status()).toEqual({
      status: "failed",
      errorCode: "stable_executor_failure",
      errorMessage: "injected"
    });
  });

  it("preserves nested paper failure evidence for operator diagnosis", async () => {
    const cause = Object.assign(new Error("checkpoint transition failed"), {
      code: "checkpoint_transition_failed",
      details: { sequence: 3 }
    });
    const runner = new ResearchControlCampaignPaperRunner({
      executor: {
        async advance() {
          throw Object.assign(new Error("paper action failed"), {
            code: "paper_action_failed",
            details: { action: "advance_source_window" },
            cause
          });
        }
      }
    });

    runner.start({ campaignId: "campaign-failed" });
    await runner.drain();

    expect(runner.status()).toEqual({
      status: "failed",
      errorCode: "paper_action_failed",
      errorMessage:
        "paper action failed {\"action\":\"advance_source_window\"}" +
        " <- checkpoint_transition_failed: checkpoint transition failed" +
        " {\"sequence\":3}"
    });
  });

  it("drains an active advance before stopping", async () => {
    const pending = deferred<ResearchControlCampaignPaperExecutorStep>();
    const runner = new ResearchControlCampaignPaperRunner({
      executor: { advance: () => pending.promise }
    });
    runner.start({ campaignId: "campaign-001" });

    const stopping = runner.stop();
    let stopped = false;
    stopping.then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    pending.resolve({
      status: "advanced",
      action: "prepare_source_batch",
      sequence: 1
    });
    await stopping;

    expect(runner.status()).toMatchObject({
      status: "stopped",
      latestStep: { action: "prepare_source_batch" }
    });
  });

  it("interrupts a scheduled wait when stopping", async () => {
    const sleepStarted = deferred<void>();
    const neverWakes = deferred<void>();
    const runner = new ResearchControlCampaignPaperRunner({
      executor: {
        async advance() {
          return {
            status: "waiting",
            action: "wait_until",
            sequence: 1,
            wakeAt: "2026-07-12T11:00:00.000Z"
          };
        }
      },
      now: () => "2026-07-12T10:00:00.000Z",
      sleep: async () => {
        sleepStarted.resolve();
        await neverWakes.promise;
      }
    });
    runner.start({ campaignId: "campaign-001" });
    await sleepStarted.promise;

    await runner.stop();

    expect(runner.status()).toMatchObject({
      status: "stopped",
      latestStep: { action: "wait_until" }
    });
  });

  it("can start a new run after the previous run drains", async () => {
    const runner = new ResearchControlCampaignPaperRunner({
      executor: {
        async advance() {
          return { status: "complete", action: "complete" };
        }
      }
    });

    runner.start({ campaignId: "campaign-001" });
    await runner.drain();
    runner.start({ campaignId: "campaign-002" });
    await runner.drain();

    expect(runner.status()).toMatchObject({ status: "completed" });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
