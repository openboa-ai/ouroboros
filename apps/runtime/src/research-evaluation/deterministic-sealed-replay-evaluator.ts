import type {
  ExperimentRunRecord,
  Ref,
  TradingEvaluationResultRecord,
  TradingEvaluationScoreSummary,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";

export type SealedReplayEvaluationScenario =
  | "accepted_oos_survives_costs"
  | "quarantined_metric_instability"
  | "disqualified_lookahead_leakage";

export interface SealedReplayEvaluationSubmission {
  experiment: ExperimentRunRecord;
  task: TradingEvaluationTaskRecord;
  scenario?: SealedReplayEvaluationScenario;
  metric_refs?: Ref[];
  completed_at?: string;
}

export interface DeterministicSealedReplayEvaluatorOptions {
  evaluator_ref?: Ref;
}

export class DeterministicSealedReplayEvaluator {
  private readonly evaluatorRef: Ref;

  constructor(options: DeterministicSealedReplayEvaluatorOptions = {}) {
    this.evaluatorRef = options.evaluator_ref ?? {
      record_kind: "external_evaluator",
      id: "sealed-replay-fixture-evaluator-v1"
    };
  }

  evaluate(submission: SealedReplayEvaluationSubmission): TradingEvaluationResultRecord {
    this.assertSubmission(submission);
    const scenario = submission.scenario ?? scenarioFromArtifact(submission.experiment.runnable_artifact_ref.id);
    const completedAt = submission.completed_at ?? new Date().toISOString();
    const base = {
      record_kind: "trading_evaluation_result" as const,
      version: 1 as const,
      trading_evaluation_result_id: `trading-evaluation-result-${safeId(submission.experiment.experiment_run_id)}`,
      experiment_run_ref: ref("experiment_run", submission.experiment.experiment_run_id),
      trading_evaluation_task_ref: ref("trading_evaluation_task", submission.task.trading_evaluation_task_id),
      evaluator_ref: this.evaluatorRef,
      metric_refs: submission.metric_refs ?? metricRefsFor(submission.experiment.experiment_run_id, scenario),
      evaluator_trace_ref: ref(
        "trace_placeholder",
        `trace-sealed-replay-${safeId(submission.experiment.experiment_run_id)}`
      ),
      completed_at: completedAt,
      authority_status: "not_counted" as const
    };

    if (scenario === "disqualified_lookahead_leakage") {
      return {
        ...base,
        result_status: "disqualified",
        evidence_disposition: "quarantined_for_review",
        score_summary: zeroScore(),
        disqualification_reason: "lookahead_leakage",
        quarantine_reason: "manual_review_required"
      };
    }

    if (scenario === "quarantined_metric_instability") {
      return {
        ...base,
        result_status: "quarantined_for_review",
        evidence_disposition: "quarantined_for_review",
        score_summary: {
          total_score: 0.38,
          oos_score: 0.42,
          drawdown_score: 0.29,
          turnover_score: 0.71,
          cost_survival_score: 0.33,
          reproducibility_score: 0.25,
          complexity_penalty: 0.44
        },
        quarantine_reason: "metric_instability"
      };
    }

    return {
      ...base,
      result_status: "accepted",
      evidence_disposition: "not_counted",
      score_summary: {
        total_score: 0.74,
        oos_score: 0.78,
        drawdown_score: 0.72,
        turnover_score: 0.81,
        cost_survival_score: 0.69,
        reproducibility_score: 0.77,
        complexity_penalty: 0.14
      }
    };
  }

  private assertSubmission(submission: SealedReplayEvaluationSubmission): void {
    if (submission.task.market_scope !== "external_trading_api_fixture") {
      throw new Error("unsupported_market_scope");
    }
    if (submission.task.stage !== "backtest") {
      throw new Error("unsupported_evaluation_stage");
    }
    if (submission.experiment.trading_evaluation_task_ref.id !== submission.task.trading_evaluation_task_id) {
      throw new Error("experiment_task_mismatch");
    }
  }
}

function scenarioFromArtifact(runnableArtifactId: string): SealedReplayEvaluationScenario {
  if (runnableArtifactId.includes("leakage") || runnableArtifactId.includes("lookahead")) {
    return "disqualified_lookahead_leakage";
  }
  if (runnableArtifactId.includes("unstable") || runnableArtifactId.includes("quarantine")) {
    return "quarantined_metric_instability";
  }
  return "accepted_oos_survives_costs";
}

function metricRefsFor(experimentId: string, scenario: SealedReplayEvaluationScenario): Ref[] {
  const prefix = safeId(experimentId);
  if (scenario === "disqualified_lookahead_leakage") {
    return [ref("metric_snapshot", `metric-${prefix}-anti-hacking-leakage`)];
  }
  if (scenario === "quarantined_metric_instability") {
    return [
      ref("metric_snapshot", `metric-${prefix}-oos-instability`),
      ref("metric_snapshot", `metric-${prefix}-reproducibility-instability`)
    ];
  }
  return [
    ref("metric_snapshot", `metric-${prefix}-oos`),
    ref("metric_snapshot", `metric-${prefix}-cost-survival`),
    ref("metric_snapshot", `metric-${prefix}-drawdown`)
  ];
}

function zeroScore(): TradingEvaluationScoreSummary {
  return {
    total_score: 0,
    oos_score: 0,
    drawdown_score: 0,
    turnover_score: 0,
    cost_survival_score: 0,
    reproducibility_score: 0,
    complexity_penalty: 1
  };
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function safeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 96) || "empty";
}
