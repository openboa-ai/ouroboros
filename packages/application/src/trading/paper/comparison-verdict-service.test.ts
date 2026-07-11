import { createHash } from "node:crypto";
import {
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonQualificationResultDigestInput,
  paperTradingComparisonVerdictDigestInput,
  paperTradingComparisonVerdictHasRuntimeShape,
  type PaperTradingComparisonQualificationResult,
  type PaperTradingComparisonVerdictRecord,
  type TradingProfitLossReadModel
} from "@ouroboros/domain";
import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "../../ports/store";
import {
  PaperTradingComparisonVerdictService,
  PaperTradingComparisonVerdictServiceError
} from "./comparison-verdict-service";

describe("paper trading comparison verdict service", () => {
  it("rejects malformed IDs before qualification or Store access", async () => {
    const harness = verdictHarness();

    await expect(harness.service.evaluate({
      activationId: " activation-001",
      activationAttemptId: "activation-attempt-001"
    })).rejects.toMatchObject({
      code: "invalid_paper_trading_comparison_verdict_input"
    });
    expect(harness.calls).toEqual([]);
  });

  it("persists a deterministic improved verdict from exact qualified evidence", async () => {
    const harness = verdictHarness();
    const graphBefore = structuredClone(harness.graph);
    const qualificationBefore = structuredClone(harness.qualification);

    const first = await harness.service.evaluate(validInput());
    const replay = await harness.service.evaluate(validInput());

    expect(harness.calls[0]).toBe("qualification.assess");
    expect(first).toEqual(replay);
    expect(harness.recorded).toHaveLength(2);
    expect(harness.recorded[0]).toEqual(harness.recorded[1]);
    expect(first).toMatchObject({
      record_kind: "paper_trading_comparison_verdict",
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: "comparison-001"
      },
      paper_trading_comparison_activation_ref: {
        record_kind: "paper_trading_comparison_activation",
        id: "activation-001"
      },
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: "activation-attempt-001"
      },
      final_activation_outcome_ref: {
        id: "activation-outcome-stopped"
      },
      latest_tick_ref: { id: "tick-3" },
      pair_qualification: { qualification_status: "qualified" },
      verdict_outcome: "challenger_improved",
      champion: { net_revenue_usdt: 1, cost_usdt: 1 },
      challenger: { net_revenue_usdt: 3, cost_usdt: 1 },
      metric: {
        metric_kind: "net_revenue_usdt",
        champion_value_usdt: 1,
        challenger_value_usdt: 3,
        observed_lift_usdt: 2,
        minimum_lift_usdt: 2
      },
      window_started_at: "2026-07-12T00:00:00.000Z",
      window_ended_at: "2026-07-12T00:02:00.000Z",
      evaluated_at: "2026-07-12T00:03:00.000Z",
      confirmation_disposition: "requires_precommitted_campaign",
      promotion_eligibility: "not_eligible",
      release_status: "sealed",
      next_action: "precommit_confirmation_campaign",
      evaluation_authority: "external_to_trading_systems",
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "not_live"
    });
    expect(first.paper_trading_comparison_verdict_id)
      .toMatch(/^paper-comparison-verdict-[a-f0-9]{32}$/);
    expect(first.pair_qualification_digest).toBe(digest(
      paperTradingComparisonQualificationResultDigestInput(first.pair_qualification)
    ));
    expect(first.verdict_digest).toBe(digest(
      paperTradingComparisonVerdictDigestInput(first)
    ));
    expect(paperTradingComparisonVerdictHasRuntimeShape(first)).toBe(true);
    expect(harness.graph).toEqual(graphBefore);
    expect(harness.qualification).toEqual(qualificationBefore);
  });

  it("persists an ineligible terminal verdict without economic fields", async () => {
    const graph = verdictGraph();
    graph.activationOutcomes.at(-1)!.outcome_reason = "restart_cleanup";
    const qualification = ineligibleQualification();
    const harness = verdictHarness(graph, qualification);

    const verdict = await harness.service.evaluate(validInput());

    expect(verdict).toMatchObject({
      pair_qualification: {
        qualification_status: "not_qualified",
        qualification_reasons: ["comparison_window_not_completed_normally"]
      },
      verdict_outcome: "comparison_ineligible",
      confirmation_disposition: "not_applicable",
      next_action: "repair_evidence_or_rerun_comparison"
    });
    expect("metric" in verdict).toBe(false);
    expect("net_revenue_usdt" in verdict.champion).toBe(false);
    expect("cost_usdt" in verdict.champion).toBe(false);
    expect("net_revenue_usdt" in verdict.challenger).toBe(false);
    expect("cost_usdt" in verdict.challenger).toBe(false);
    expect(paperTradingComparisonVerdictHasRuntimeShape(verdict)).toBe(true);
  });

  it("persists equal qualified scores as sealed not-improved evidence", async () => {
    const graph = verdictGraph();
    graph.challenger.evaluation.latest_score = score(1, 1);
    const harness = verdictHarness(graph);

    const verdict = await harness.service.evaluate(validInput());

    expect(verdict).toMatchObject({
      pair_qualification: { qualification_status: "qualified" },
      verdict_outcome: "challenger_not_improved",
      metric: {
        champion_value_usdt: 1,
        challenger_value_usdt: 1,
        observed_lift_usdt: 0,
        minimum_lift_usdt: 2
      },
      confirmation_disposition: "not_applicable",
      promotion_eligibility: "not_eligible",
      release_status: "sealed",
      next_action: "return_to_candidate_arena"
    });
    expect(paperTradingComparisonVerdictHasRuntimeShape(verdict)).toBe(true);
  });

  it.each([
    ["both running", (graph: ReturnType<typeof verdictGraph>) => {
      graph.activationOutcomes = graph.activationOutcomes.slice(0, 1);
    }],
    ["cleanup required", (graph: ReturnType<typeof verdictGraph>) => {
      graph.activationOutcomes.at(-1)!.outcome_status = "cleanup_required";
    }],
    ["open checkpoint", (graph: ReturnType<typeof verdictGraph>) => {
      graph.checkpointOutcomes[2] = [];
    }],
    ["running evaluation", (graph: ReturnType<typeof verdictGraph>) => {
      graph.champion.evaluation.status = "running";
    }],
    ["running TradingRun", (graph: ReturnType<typeof verdictGraph>) => {
      graph.challenger.run.runtime_lifecycle_status = "running";
    }]
  ])("rejects %s evidence without persisting a verdict", async (_label, mutate) => {
    const graph = verdictGraph();
    mutate(graph);
    const harness = verdictHarness(graph);

    await expect(harness.service.evaluate(validInput())).rejects.toMatchObject({
      code: "paper_trading_comparison_verdict_not_terminal"
    });
    expect(harness.recorded).toEqual([]);
  });

  it("wraps qualification and graph failures with their stable cause codes", async () => {
    const qualificationFailure = verdictHarness();
    qualificationFailure.qualificationError = Object.assign(
      new Error("qualification failed"),
      { code: "paper_trading_comparison_qualification_graph_invalid" }
    );

    await expect(qualificationFailure.service.evaluate(validInput())).rejects.toMatchObject({
      code: "paper_trading_comparison_verdict_graph_invalid",
      details: {
        cause_code: "paper_trading_comparison_qualification_graph_invalid"
      }
    });
    expect(qualificationFailure.calls).toEqual(["qualification.assess"]);

    const drifted = verdictGraph();
    drifted.activationAttempt.paper_trading_comparison_commitment_ref.id =
      "comparison-drifted";
    const graphFailure = verdictHarness(drifted);
    await expect(graphFailure.service.evaluate(validInput())).rejects.toMatchObject({
      code: "paper_trading_comparison_verdict_graph_invalid",
      details: {
        cause_code: "paper_trading_comparison_verdict_graph_inconsistent"
      }
    });
    expect(graphFailure.recorded).toEqual([]);
  });

  it("preserves Store conflict codes and never calls authority-bearing dependencies", async () => {
    const harness = verdictHarness();
    const conflict = Object.assign(new Error("conflict"), {
      code: "paper_trading_comparison_verdict_conflict"
    });
    harness.storeError = conflict;

    await expect(harness.service.evaluate(validInput())).rejects.toBe(conflict);
    expect(harness.calls).not.toContain("store.createTradingPromotion");
    expect(harness.calls).not.toContain("store.recordResearchFinding");
    expect(harness.calls).not.toContain("store.startSandbox");
    expect(harness.calls).not.toContain("store.recordLedger");
  });

  it("uses only the service clock and rejects a non-canonical evaluation time", async () => {
    const harness = verdictHarness();
    harness.now = () => "not-a-time";

    await expect(harness.service.evaluate(validInput())).rejects.toBeInstanceOf(
      PaperTradingComparisonVerdictServiceError
    );
    await expect(harness.service.evaluate(validInput())).rejects.toMatchObject({
      code: "paper_trading_comparison_verdict_graph_invalid",
      details: {
        cause_code: "paper_trading_comparison_verdict_evaluation_time_invalid"
      }
    });
    expect(harness.recorded).toEqual([]);
  });
});

function validInput() {
  return {
    activationId: "activation-001",
    activationAttemptId: "activation-attempt-001"
  };
}

function verdictHarness(
  graph = verdictGraph(),
  qualification = qualifiedQualification()
) {
  const calls: string[] = [];
  const recorded: PaperTradingComparisonVerdictRecord[] = [];
  const state: {
    qualificationError?: unknown;
    storeError?: unknown;
    now: () => string;
  } = {
    now: () => "2026-07-12T00:03:00.000Z"
  };
  const qualifications = {
    assess: async () => {
      calls.push("qualification.assess");
      if (state.qualificationError) throw state.qualificationError;
      return structuredClone(qualification);
    }
  };
  const sideBy = (key: "commitment" | "evaluation" | "run", id: string) =>
    [graph.champion, graph.challenger].find((side) => {
      const value = side[key];
      return key === "commitment"
        ? value.paper_trading_evaluation_commitment_id === id
        : key === "evaluation"
          ? value.paper_trading_evaluation_id === id
          : value.trading_run_id === id;
    });
  function read(name: string, value: (...args: any[]) => unknown) {
    return async (...args: any[]) => {
      calls.push(`store.${name}`);
      return structuredClone(value(...args));
    };
  }
  const methods: Record<string, (...args: any[]) => Promise<any>> = {
    getPaperTradingComparisonActivation: read(
      "getPaperTradingComparisonActivation",
      () => graph.activation
    ),
    getPaperTradingComparisonActivationAttempt: read(
      "getPaperTradingComparisonActivationAttempt",
      () => graph.activationAttempt
    ),
    getPaperTradingComparisonCommitment: read(
      "getPaperTradingComparisonCommitment",
      () => graph.comparison
    ),
    listPaperTradingComparisonActivationOutcomes: read(
      "listPaperTradingComparisonActivationOutcomes",
      () => graph.activationOutcomes
    ),
    listPaperTradingComparisonTicks: read(
      "listPaperTradingComparisonTicks",
      () => graph.ticks
    ),
    listPaperTradingComparisonCheckpointAttempts: read(
      "listPaperTradingComparisonCheckpointAttempts",
      () => graph.checkpointAttempts
    ),
    listPaperTradingComparisonCheckpointOutcomes: read(
      "listPaperTradingComparisonCheckpointOutcomes",
      (attemptId: string) => {
        const index = graph.checkpointAttempts.findIndex((attempt) =>
          attempt.paper_trading_comparison_checkpoint_attempt_id === attemptId);
        return index < 0 ? [] : graph.checkpointOutcomes[index];
      }
    ),
    getPaperTradingEvaluationCommitment: read(
      "getPaperTradingEvaluationCommitment",
      (id: string) => sideBy("commitment", id)?.commitment
    ),
    getPaperTradingEvaluation: read(
      "getPaperTradingEvaluation",
      (id: string) => sideBy("evaluation", id)?.evaluation
    ),
    listPaperTradingObservations: read(
      "listPaperTradingObservations",
      (id: string) => sideBy("evaluation", id)?.observations ?? []
    ),
    getTradingRun: read(
      "getTradingRun",
      (id: string) => sideBy("run", id)?.run
    ),
    recordPaperTradingComparisonVerdict: async (
      verdict: PaperTradingComparisonVerdictRecord
    ) => {
      calls.push("store.recordPaperTradingComparisonVerdict");
      if (state.storeError) throw state.storeError;
      recorded.push(structuredClone(verdict));
      return structuredClone(verdict);
    }
  };
  const store = new Proxy(methods, {
    get(target, property) {
      if (typeof property === "string" && property in target) return target[property];
      return async () => {
        calls.push(`store.${String(property)}`);
        throw new Error(`unexpected Store method: ${String(property)}`);
      };
    }
  }) as unknown as OuroborosStorePort;
  const service = new PaperTradingComparisonVerdictService({
    store,
    qualifications,
    now: () => state.now()
  });
  return {
    graph,
    qualification,
    calls,
    recorded,
    service,
    get qualificationError() { return state.qualificationError; },
    set qualificationError(value: unknown) { state.qualificationError = value; },
    get storeError() { return state.storeError; },
    set storeError(value: unknown) { state.storeError = value; },
    get now() { return state.now; },
    set now(value: () => string) { state.now = value; }
  };
}

function verdictGraph() {
  const champion = verdictSide("champion", score(1, 1));
  const challenger = verdictSide("challenger", score(3, 1));
  const comparisonSide = (side: ReturnType<typeof verdictSide>) => ({
    role: side.role,
    candidate_ref: { record_kind: "trading_system_candidate", id: `${side.role}-candidate` },
    candidate_version_ref: { record_kind: "candidate_version", id: `${side.role}-version` },
    system_code_ref: { record_kind: "system_code", id: `${side.role}-code` },
    system_code_artifact_digest: `sha256:${side.role}-code-artifact`,
    trading_run_ref: { record_kind: "trading_run", id: side.run.trading_run_id },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: side.commitment.paper_trading_evaluation_commitment_id
    },
    paper_trading_evaluation_commitment_record_digest: digest(
      paperTradingComparisonEvaluationCommitmentRecordDigestInput(side.commitment)
    ),
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: side.evaluation.paper_trading_evaluation_id
    },
    paper_trading_evaluation_record_digest: digest(
      paperTradingComparisonEvaluationRecordDigestInput(side.evaluation)
    )
  });
  const comparison = {
    record_kind: "paper_trading_comparison_commitment",
    version: 1,
    paper_trading_comparison_commitment_id: "comparison-001",
    champion: comparisonSide(champion),
    challenger: comparisonSide(challenger),
    comparison_policy: {
      minimum_net_revenue_lift_usdt: 2
    },
    commitment_digest: "sha256:comparison",
    authority_status: "not_live"
  } as any;
  const activationSide = (side: ReturnType<typeof verdictSide>) => ({
    role: side.role,
    trading_run_ref: { record_kind: "trading_run", id: side.run.trading_run_id },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: side.commitment.paper_trading_evaluation_commitment_id
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: side.evaluation.paper_trading_evaluation_id
    }
  });
  const ticks = [1, 2, 3].map((sequence) => ({
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: `tick-${sequence}`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    sequence,
    observed_at: `2026-07-12T00:0${sequence - 1}:00.000Z`,
    tick_digest: `sha256:tick-${sequence}`,
    authority_status: "not_live"
  })) as any[];
  const activation = {
    record_kind: "paper_trading_comparison_activation",
    version: 1,
    paper_trading_comparison_activation_id: "activation-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: ticks[0]!.paper_trading_comparison_tick_id
    },
    first_tick_digest: ticks[0]!.tick_digest,
    champion: activationSide(champion),
    challenger: activationSide(challenger),
    activation_digest: "sha256:activation"
  } as any;
  const activationAttempt = {
    record_kind: "paper_trading_comparison_activation_attempt",
    version: 1,
    paper_trading_comparison_activation_attempt_id: "activation-attempt-001",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_activation_digest: activation.activation_digest,
    paper_trading_comparison_commitment_ref: {
      ...activation.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    first_tick_ref: { ...activation.first_tick_ref },
    first_tick_digest: activation.first_tick_digest,
    champion: activationSide(champion),
    challenger: activationSide(challenger),
    attempted_at: "2026-07-12T00:00:00.000Z",
    attempt_digest: "sha256:attempt"
  } as any;
  const activationOutcomes = [
    {
      record_kind: "paper_trading_comparison_activation_outcome",
      version: 1,
      paper_trading_comparison_activation_outcome_id: "activation-outcome-running",
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: activationAttempt.paper_trading_comparison_activation_attempt_id
      },
      paper_trading_comparison_activation_attempt_digest:
        activationAttempt.attempt_digest,
      paper_trading_comparison_activation_ref: {
        ...activationAttempt.paper_trading_comparison_activation_ref
      },
      paper_trading_comparison_activation_digest: activation.activation_digest,
      outcome_sequence: 1,
      outcome_status: "both_running",
      outcome_reason: "started_within_policy",
      completed_at: "2026-07-12T00:00:01.000Z",
      outcome_digest: "sha256:activation-outcome-running"
    },
    {
      record_kind: "paper_trading_comparison_activation_outcome",
      version: 1,
      paper_trading_comparison_activation_outcome_id: "activation-outcome-stopped",
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: activationAttempt.paper_trading_comparison_activation_attempt_id
      },
      paper_trading_comparison_activation_attempt_digest:
        activationAttempt.attempt_digest,
      paper_trading_comparison_activation_ref: {
        ...activationAttempt.paper_trading_comparison_activation_ref
      },
      paper_trading_comparison_activation_digest: activation.activation_digest,
      outcome_sequence: 2,
      previous_outcome_ref: {
        record_kind: "paper_trading_comparison_activation_outcome",
        id: "activation-outcome-running"
      },
      outcome_status: "stopped_cleanly",
      outcome_reason: "handoff_cleanup",
      completed_at: "2026-07-12T00:02:30.000Z",
      outcome_digest: "sha256:activation-outcome-stopped"
    }
  ] as any[];
  const checkpointAttempts = ticks.map((tick, index) => ({
    record_kind: "paper_trading_comparison_checkpoint_attempt",
    version: 1,
    paper_trading_comparison_checkpoint_attempt_id: `checkpoint-attempt-${index + 1}`,
    paper_trading_comparison_activation_ref: {
      ...activationAttempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest: activation.activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: activationAttempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest:
      activationAttempt.attempt_digest,
    paper_trading_comparison_commitment_ref: {
      ...activationAttempt.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: tick.paper_trading_comparison_tick_id
    },
    tick_digest: tick.tick_digest,
    checkpoint_sequence: index + 1,
    champion: activationSide(champion),
    challenger: activationSide(challenger),
    attempt_digest: `sha256:checkpoint-attempt-${index + 1}`
  })) as any[];
  const checkpointOutcomes = checkpointAttempts.map((attempt, index) => [{
    record_kind: "paper_trading_comparison_checkpoint_outcome",
    version: 1,
    paper_trading_comparison_checkpoint_outcome_id: `checkpoint-outcome-${index + 1}`,
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: attempt.attempt_digest,
    tick_ref: { ...attempt.tick_ref },
    tick_digest: attempt.tick_digest,
    checkpoint_sequence: index + 1,
    outcome_status: "paired",
    outcome_reason: "paired_checkpoint_recorded",
    completed_at: ticks[index]!.observed_at,
    outcome_digest: `sha256:checkpoint-outcome-${index + 1}`
  }]) as any[][];
  return {
    champion,
    challenger,
    comparison,
    activation,
    activationAttempt,
    activationOutcomes,
    ticks,
    checkpointAttempts,
    checkpointOutcomes
  };
}

function verdictSide(
  role: "champion" | "challenger",
  latestScore: TradingProfitLossReadModel
) {
  const commitment = {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: `${role}-commitment`,
    trading_run_ref: { record_kind: "trading_run", id: `${role}-run` },
    commitment_digest: `sha256:${role}-commitment`
  } as any;
  const observations = [1, 2, 3].map((sequence) => ({
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: `${role}-observation-${sequence}`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-evaluation`
    },
    sequence,
    status: "no_order",
    observed_at: `2026-07-12T00:0${sequence - 1}:00.000Z`,
    authority_status: "not_live"
  })) as any[];
  const evaluation = {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: `${role}-evaluation`,
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    trading_run_ref: { ...commitment.trading_run_ref },
    status: "stopped",
    observation_count: observations.length,
    started_at: observations[0]!.observed_at,
    stopped_at: "2026-07-12T00:02:15.000Z",
    latest_score: latestScore,
    authority_status: "not_live"
  } as any;
  const run = {
    record_kind: "trading_run",
    version: 1,
    trading_run_id: `${role}-run`,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: `${role}-candidate`
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `${role}-version`
    },
    system_code_ref: { record_kind: "system_code", id: `${role}-code` },
    runtime_lifecycle_status: "stopped",
    authority_status: "not_live"
  } as any;
  return { role, commitment, evaluation, observations, run };
}

function qualifiedQualification(): PaperTradingComparisonQualificationResult {
  return {
    comparison_id: "comparison-001",
    activation_id: "activation-001",
    activation_attempt_id: "activation-attempt-001",
    qualification_status: "qualified",
    qualification_reasons: [],
    checkpoint_count: 3,
    champion: sideQualification(),
    challenger: sideQualification(),
    authority_status: "not_verdict"
  };
}

function ineligibleQualification(): PaperTradingComparisonQualificationResult {
  return {
    ...qualifiedQualification(),
    qualification_status: "not_qualified",
    qualification_reasons: ["comparison_window_not_completed_normally"]
  };
}

function sideQualification() {
  return {
    qualification_status: "qualified" as const,
    qualification_reasons: [],
    evidence_window: {
      observation_count: 3,
      elapsed_ms: 120_000,
      failed_observation_count: 0,
      first_observed_at: "2026-07-12T00:00:00.000Z",
      last_observed_at: "2026-07-12T00:02:00.000Z"
    }
  };
}

function score(netRevenue: number, cost: number): TradingProfitLossReadModel {
  return {
    revenue_usdt: netRevenue + cost,
    cost_usdt: cost,
    net_revenue_usdt: netRevenue,
    net_return_pct: netRevenue / 100
  };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
