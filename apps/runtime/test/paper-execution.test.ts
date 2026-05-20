import { describe, expect, it } from "vitest";
import { recordPaperExecutionResult } from "../src/paper-execution";

describe("paper execution result", () => {
  it("records a dry-run Gateway result without exchange authority", () => {
    expect(recordPaperExecutionResult({
      decision_outcome: "dry_run_only",
      decision_reason: "dry_run_allowed"
    })).toMatchObject({
      execution_mode: "host_local",
      status: "dry_run_recorded",
      result_reason: "dry_run_allowed"
    });
  });

  it("blocks execution when the Gateway rejects an order request", () => {
    expect(recordPaperExecutionResult({
      decision_outcome: "rejected",
      decision_reason: "fixture_only"
    })).toMatchObject({
      execution_mode: "host_local",
      status: "blocked",
      result_reason: "fixture_only"
    });
  });
});
