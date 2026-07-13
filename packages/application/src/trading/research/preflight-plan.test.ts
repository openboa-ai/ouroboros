import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildResearchPreflightPlan,
  generateResearchPreflightEvaluatorSeed
} from "./preflight-plan";
import { toReplayTradingCandidateInput } from "./replay-trading-api-provider";

describe("ResearchPreflight evaluator-owned plan", () => {
  it("is deterministic for one frozen input and injected evaluator seed", () => {
    const input = planInput(seed(7));

    const first = buildResearchPreflightPlan(input);
    const second = buildResearchPreflightPlan(structuredClone(input));

    expect(first.commitment).toEqual(second.commitment);
    expect(first.evaluatorDevelopmentSuite()).toEqual(second.evaluatorDevelopmentSuite());
    expect(first.claimSealedAdmissionSuite()).toEqual(second.claimSealedAdmissionSuite());
  });

  it("rotates adjacent evaluator plans and scopes one seed to tick and direction", () => {
    const firstSeed = generateResearchPreflightEvaluatorSeed();
    const secondSeed = generateResearchPreflightEvaluatorSeed();
    expect(firstSeed).toHaveLength(32);
    expect(secondSeed).toHaveLength(32);
    expect(Buffer.from(firstSeed).equals(Buffer.from(secondSeed))).toBe(false);

    const first = buildResearchPreflightPlan(planInput(firstSeed));
    const adjacent = buildResearchPreflightPlan(planInput(secondSeed, {
      candidate_arena_tick_id: "tick-8"
    }));
    expect(first.commitment.sealed_admission_policy.rotation_commitment_digest).not.toBe(
      adjacent.commitment.sealed_admission_policy.rotation_commitment_digest
    );
    expect(first.commitment.sealed_admission_policy.suite_digest).not.toBe(
      adjacent.commitment.sealed_admission_policy.suite_digest
    );

    const sameSeedOtherDirection = buildResearchPreflightPlan(planInput(firstSeed, {
      research_direction_ref: {
        record_kind: "research_direction",
        id: "research-direction-mean-reversion"
      },
      research_worker_ref: {
        record_kind: "research_worker",
        id: "research-worker-mean-reversion"
      }
    }));
    expect(first.commitment.sealed_admission_policy.rotation_commitment_digest).not.toBe(
      sameSeedOtherDirection.commitment.sealed_admission_policy.rotation_commitment_digest
    );
    expect(first.commitment.sealed_admission_policy.suite_digest).not.toBe(
      sameSeedOtherDirection.commitment.sealed_admission_policy.suite_digest
    );
  });

  it("keeps the raw seed and raw suites out of the serializable commitment surface", () => {
    const evaluatorSeed = seed(19);
    const plan = buildResearchPreflightPlan(planInput(evaluatorSeed));
    const serialized = JSON.stringify(plan);

    expect(Object.keys(plan)).toEqual(["commitment"]);
    expect(serialized).toBe(JSON.stringify({ commitment: plan.commitment }));
    expect(serialized).not.toContain(Buffer.from(evaluatorSeed).toString("hex"));
    expect(serialized).not.toContain("rotation_seed");
    expect(serialized).not.toContain("expected_direction");
    expect(serialized).not.toContain("target_risk_fraction");
    expect(serialized).not.toContain("outcome");
    expect(serialized).not.toContain("scenario_id");
    expect(serialized).not.toContain("exit_price");
  });

  it("binds an exact memory policy without changing legacy commitment readability", () => {
    const releasedPolicy = {
      protocol_version: "research_worker_memory_v1" as const,
      memory_mode: "released_memory" as const,
      memory_source_digest: digest("memory-source"),
      available_memory_item_count: 3,
      arena_context_digest: digest("released-context"),
      prior_checkpoint: { disposition: "none_available" as const }
    };
    const released = buildResearchPreflightPlan({
      ...planInput(seed(23)),
      memory_policy: releasedPolicy
    });
    const masked = buildResearchPreflightPlan({
      ...planInput(seed(23)),
      memory_policy: {
        ...releasedPolicy,
        memory_mode: "memory_masked",
        arena_context_digest: digest("masked-context")
      }
    });
    const legacy = buildResearchPreflightPlan(planInput(seed(23)));

    expect(released.commitment.memory_policy).toEqual(releasedPolicy);
    expect(masked.commitment.memory_policy?.memory_mode).toBe("memory_masked");
    expect(released.commitment.commitment_digest).not.toBe(
      masked.commitment.commitment_digest
    );
    expect(legacy.commitment).not.toHaveProperty("memory_policy");
    expect(released.commitment.sealed_admission_policy.suite_digest).toBe(
      legacy.commitment.sealed_admission_policy.suite_digest
    );
  });

  it("generates balanced hidden regimes without obvious metadata shortcuts", () => {
    const plan = buildResearchPreflightPlan(planInput(seed(31)));
    const suite = plan.claimSealedAdmissionSuite();
    const scenarios = suite.scenarios;
    const directionCounts = Object.fromEntries(["long", "short", "flat"].map((direction) => [
      direction,
      scenarios.filter((scenario) => scenario.market.expected_direction === direction).length
    ]));

    expect(scenarios).toHaveLength(6);
    expect(directionCounts).toEqual({ long: 2, short: 2, flat: 2 });
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(scenarios.length);
    expect(scenarios.every((scenario) =>
      !/(long|short|flat|volatility|cost|stress)/i.test(scenario.id)
    )).toBe(true);
    expect(scenarios.every((scenario) =>
      /^Sealed admission scenario [1-6]$/.test(scenario.description)
    )).toBe(true);
    expect(new Set(scenarios.map((scenario) => scenario.market.observed_at))).toEqual(
      new Set(["2026-07-12T10:00:00.000Z"])
    );
    const prices = scenarios.map((scenario) => scenario.market.price);
    expect(Math.max(...prices) / Math.min(...prices)).toBeLessThan(1.1);

    for (const direction of ["long", "short", "flat"] as const) {
      const directionScenarios = scenarios.filter((scenario) =>
        scenario.market.expected_direction === direction
      );
      expect(directionScenarios.some((scenario) => scenario.market.volatility >= 0.04)).toBe(true);
      expect(directionScenarios.some((scenario) =>
        scenario.outcome.fee_bps + scenario.outcome.slippage_bps +
          Math.abs(scenario.outcome.funding_bps) >= 18
      )).toBe(true);
    }
  });

  it("keeps candidate-facing provider response shape identical across hidden regimes", () => {
    const scenarios = buildResearchPreflightPlan(planInput(seed(43)))
      .claimSealedAdmissionSuite().scenarios;
    const candidateInputs = scenarios.map(toReplayTradingCandidateInput);
    const marketKeys = candidateInputs.map((input) => Object.keys(input.market).sort());
    const accountKeys = candidateInputs.map((input) => Object.keys(input.account).sort());

    expect(new Set(marketKeys.map((keys) => JSON.stringify(keys))).size).toBe(1);
    expect(new Set(accountKeys.map((keys) => JSON.stringify(keys))).size).toBe(1);
    for (const input of candidateInputs) {
      expect(input.market).not.toHaveProperty("expected_direction");
      expect(input.account).not.toHaveProperty("target_risk_fraction");
    }
  });

  it("rejects invalid evaluator seed, budget, digest, ref, and time inputs", () => {
    const cases: Array<(input: ReturnType<typeof planInput>) => void> = [
      (input) => { input.evaluator_seed = new Uint8Array(31); },
      (input) => { input.development_submission_limit = 0; },
      (input) => { input.development_submission_limit = 3; },
      (input) => { input.research_allocation_digest = "sha256:bad"; },
      (input) => { input.source_artifact_digest = ""; },
      (input) => { input.research_worker_ref.record_kind = "research_direction"; },
      (input) => { input.committed_at = "2026-07-12 10:00:00"; }
    ];

    for (const mutate of cases) {
      const input = planInput(seed(59));
      mutate(input);
      expect(() => buildResearchPreflightPlan(input)).toThrow(
        "research_preflight_plan_input_invalid"
      );
    }
  });
});

function planInput(
  evaluatorSeed: Uint8Array,
  overrides: Partial<{
    candidate_arena_tick_id: string;
    research_direction_ref: { record_kind: string; id: string };
    research_worker_ref: { record_kind: string; id: string };
  }> = {}
) {
  return {
    candidate_arena_tick_id: overrides.candidate_arena_tick_id ?? "tick-7",
    research_direction_ref: overrides.research_direction_ref ?? {
      record_kind: "research_direction",
      id: "research-direction-trend-following"
    },
    research_worker_ref: overrides.research_worker_ref ?? {
      record_kind: "research_worker",
      id: "research-worker-trend-following"
    },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: "allocation-tick-7"
    },
    research_allocation_digest: digest("allocation-tick-7"),
    source_system_code_ref: {
      record_kind: "system_code",
      id: "source-system-code-tick-7"
    },
    source_artifact_digest: digest("source-system-code-tick-7"),
    development_submission_limit: 2,
    committed_at: "2026-07-12T10:00:00.000Z",
    evaluator_seed: evaluatorSeed
  };
}

function seed(byte: number): Uint8Array {
  return new Uint8Array(32).fill(byte);
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
