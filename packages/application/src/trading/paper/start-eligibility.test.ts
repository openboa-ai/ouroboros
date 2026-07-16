import { describe, expect, it } from "vitest";
import type { CandidateInspectReadModel } from "@ouroboros/domain";
import {
  paperTradingSandboxAdapterKind,
  paperTradingStartRequiresGeneratedEligibility
} from "./start-eligibility";

describe("paper Trading start eligibility", () => {
  it("keeps fixtures deterministic and routes materialized candidates through Docker Sandboxes", () => {
    const fixture = candidate();
    const materializedFixture = candidate({
      candidate_version: {
        candidate_version_id: "candidate-version-fixture",
        materialization_attempt_ref: {
          record_kind: "candidate_materialization_attempt",
          id: "materialization-fixture"
        }
      },
      materialization_attempt: {
        attempt_id: "materialization-fixture",
        provider_kind: "fixture_only"
      }
    });
    const generated = candidate({
      candidate_version: {
        candidate_version_id: "candidate-version-1",
        materialization_attempt_ref: {
          record_kind: "candidate_materialization_attempt",
          id: "materialization-1"
        }
      },
      materialization_attempt: { attempt_id: "materialization-1" }
    });

    expect(paperTradingStartRequiresGeneratedEligibility(fixture)).toBe(false);
    expect(paperTradingSandboxAdapterKind(fixture)).toBe("deterministic_test");
    expect(paperTradingStartRequiresGeneratedEligibility(materializedFixture)).toBe(false);
    expect(paperTradingSandboxAdapterKind(materializedFixture)).toBe("deterministic_test");
    expect(paperTradingStartRequiresGeneratedEligibility(generated)).toBe(true);
    expect(paperTradingSandboxAdapterKind(generated)).toBe("docker_sandboxes_sbx");
  });
});

function candidate(
  overrides: Record<string, unknown> = {}
): CandidateInspectReadModel {
  return {
    candidate_id: "candidate-1",
    candidate_version: { candidate_version_id: "candidate-version-1" },
    runtime: { ref: { record_kind: "trading_run", id: "trading-run-1" } },
    ...overrides
  } as unknown as CandidateInspectReadModel;
}
