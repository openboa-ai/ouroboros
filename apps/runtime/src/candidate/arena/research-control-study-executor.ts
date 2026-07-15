import { isDeepStrictEqual } from "node:util";
import {
  ResearchControlStudyOutcomeService,
  researchControlStudyOutcomeId
} from "@ouroboros/application/candidate/research-control-study-outcome";
import type { OuroborosStorePort } from
  "@ouroboros/application/ports/store";
import type {
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignRecord,
  ResearchControlStudyOutcomeRecord,
  ResearchControlStudyRecord,
  ResearchControlStudyReplication
} from "@ouroboros/domain";
import {
  projectResearchControlStudyNextAction,
  type ProjectResearchControlStudyNextActionInput
} from "./research-control-study-next-action";

export type ResearchControlStudyExecutorErrorCode =
  | "research_control_study_executor_graph_invalid"
  | "research_control_study_executor_action_failed"
  | "research_control_study_executor_persistence_conflict";

export class ResearchControlStudyExecutorError extends Error {
  constructor(
    readonly code: ResearchControlStudyExecutorErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlStudyExecutorError";
  }
}

export interface ResearchControlStudyExecutorCampaignAction {
  study: ResearchControlStudyRecord;
  replication: ResearchControlStudyReplication;
  resume: boolean;
}

export interface ResearchControlStudyExecutorCampaignClosure {
  campaign: ResearchControlCampaignRecord;
  outcome: ResearchControlCampaignOutcomeRecord;
}

export type ResearchControlStudyExecutorStep =
  | {
      status: "advanced";
      action: "run_campaign";
      replicationIndex: number;
      campaignId: string;
      outcomeId: string;
      resume: boolean;
    }
  | {
      status: "advanced";
      action: "study_adjudicated";
      outcome: ResearchControlStudyOutcomeRecord;
    }
  | {
      status: "complete";
      action: "complete";
      outcome: ResearchControlStudyOutcomeRecord;
    };

export class ResearchControlStudyExecutor {
  private readonly projectNextAction:
    typeof projectResearchControlStudyNextAction;
  private readonly adjudicateStudy: (input: {
    study: ResearchControlStudyRecord;
    replications: ResearchControlStudyExecutorCampaignClosure[];
  }) => Promise<ResearchControlStudyOutcomeRecord>;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    runCampaign(
      action: ResearchControlStudyExecutorCampaignAction
    ): Promise<ResearchControlStudyExecutorCampaignClosure>;
    projectNextAction?: typeof projectResearchControlStudyNextAction;
    adjudicateStudy?: (input: {
      study: ResearchControlStudyRecord;
      replications: ResearchControlStudyExecutorCampaignClosure[];
    }) => Promise<ResearchControlStudyOutcomeRecord>;
    now?: () => string;
  }) {
    this.projectNextAction = options.projectNextAction ??
      projectResearchControlStudyNextAction;
    const service = new ResearchControlStudyOutcomeService({
      store: options.store,
      ...(options.now ? { now: options.now } : {})
    });
    this.adjudicateStudy = options.adjudicateStudy ?? ((input) =>
      service.adjudicate(input));
  }

  async advance(input: {
    studyId: string;
  }): Promise<ResearchControlStudyExecutorStep> {
    const graph = await this.loadGraph(input?.studyId);
    let action;
    try {
      action = this.projectNextAction(graph);
    } catch (error) {
      throw executorError(
        "research_control_study_executor_graph_invalid",
        "ResearchControlStudy evidence graph is invalid.",
        undefined,
        error
      );
    }
    if (action.action === "complete") {
      if (!graph.studyOutcome) {
        throw executorError(
          "research_control_study_executor_graph_invalid",
          "Complete ResearchControlStudy has no terminal outcome."
        );
      }
      return {
        status: "complete",
        action: "complete",
        outcome: graph.studyOutcome
      };
    }
    if (action.action === "adjudicate_study") {
      const closures = graph.replications.map((evidence) => {
        if (!evidence.campaign || !evidence.outcome) {
          throw executorError(
            "research_control_study_executor_graph_invalid",
            "Study adjudication source closure is incomplete."
          );
        }
        return { campaign: evidence.campaign, outcome: evidence.outcome };
      });
      let outcome;
      try {
        outcome = await this.adjudicateStudy({
          study: graph.study,
          replications: closures
        });
      } catch (error) {
        throw executorError(
          "research_control_study_executor_action_failed",
          "ResearchControlStudy adjudication failed.",
          { action: "adjudicate_study" },
          error
        );
      }
      const persisted = await this.options.store.getResearchControlStudyOutcome(
        researchControlStudyOutcomeId(graph.study)
      );
      if (!persisted || !isDeepStrictEqual(persisted, outcome)) {
        throw executorError(
          "research_control_study_executor_persistence_conflict",
          "ResearchControlStudy adjudication was not persisted exactly."
        );
      }
      return {
        status: "advanced",
        action: "study_adjudicated",
        outcome
      };
    }

    const replication = graph.study.replications[action.replicationIndex - 1];
    if (!replication || replication.replication_index !==
        action.replicationIndex || replication.campaign_ref.id !==
        action.campaignId || replication.campaign_idempotency_key !==
        action.campaignIdempotencyKey) {
      throw executorError(
        "research_control_study_executor_graph_invalid",
        "Projected campaign action differs from the frozen study."
      );
    }
    let closure;
    try {
      closure = await this.options.runCampaign({
        study: graph.study,
        replication,
        resume: action.resume
      });
    } catch (error) {
      throw executorError(
        "research_control_study_executor_action_failed",
        "ResearchControlStudy campaign action failed.",
        {
          action: "run_campaign",
          replication_index: action.replicationIndex
        },
        error
      );
    }
    const reloaded = await this.loadGraph(graph.study.research_control_study_id);
    const persisted = reloaded.replications[action.replicationIndex - 1];
    if (!persisted?.campaign || !persisted.outcome ||
      !isDeepStrictEqual(persisted.campaign, closure.campaign) ||
      !isDeepStrictEqual(persisted.outcome, closure.outcome)) {
      throw executorError(
        "research_control_study_executor_persistence_conflict",
        "Campaign action did not persist its exact terminal closure.",
        { replication_index: action.replicationIndex }
      );
    }
    return {
      status: "advanced",
      action: "run_campaign",
      replicationIndex: action.replicationIndex,
      campaignId: persisted.campaign.research_control_campaign_id,
      outcomeId: persisted.outcome.research_control_campaign_outcome_id,
      resume: action.resume
    };
  }

  private async loadGraph(
    studyId: string
  ): Promise<ProjectResearchControlStudyNextActionInput> {
    if (typeof studyId !== "string" || !studyId.trim() ||
      studyId.trim() !== studyId) {
      throw executorError(
        "research_control_study_executor_graph_invalid",
        "ResearchControlStudy executor requires one exact study ID."
      );
    }
    const study = await this.options.store.getResearchControlStudy(studyId);
    if (!study) {
      throw executorError(
        "research_control_study_executor_graph_invalid",
        "ResearchControlStudy was not found."
      );
    }
    const [campaigns, outcomes, studyOutcome] = await Promise.all([
      Promise.all(study.replications.map((replication) =>
        this.options.store.getResearchControlCampaign(
          replication.campaign_ref.id
        )
      )),
      this.options.store.listResearchControlCampaignOutcomes(),
      this.options.store.getResearchControlStudyOutcome(
        researchControlStudyOutcomeId(study)
      )
    ]);
    const replications = study.replications.map((replication, index) => {
      const campaign = campaigns[index];
      const matches = outcomes.filter((outcome) =>
        outcome.campaign_ref.id === replication.campaign_ref.id
      );
      if (matches.length > 1) {
        throw executorError(
          "research_control_study_executor_graph_invalid",
          "ResearchControlStudy campaign outcome is ambiguous.",
          { replication_index: replication.replication_index }
        );
      }
      return {
        replicationIndex: replication.replication_index,
        ...(campaign ? { campaign } : {}),
        ...(matches[0] ? { outcome: matches[0] } : {})
      };
    });
    return {
      study,
      replications,
      ...(studyOutcome ? { studyOutcome } : {})
    };
  }
}

function executorError(
  code: ResearchControlStudyExecutorErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown
): ResearchControlStudyExecutorError {
  return new ResearchControlStudyExecutorError(
    code,
    message,
    details,
    cause === undefined ? undefined : { cause }
  );
}
