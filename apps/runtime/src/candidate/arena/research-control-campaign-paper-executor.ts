import { isDeepStrictEqual } from "node:util";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  ResearchControlCampaignArmKind,
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord
} from "@ouroboros/domain";
import {
  projectResearchControlCampaignPaperNextAction,
  type ProjectResearchControlCampaignPaperNextActionInput,
  type ResearchControlCampaignPaperNextAction
} from "./research-control-campaign-paper-next-action";
import { installResearchControlCampaignPaperGraph } from
  "./research-control-campaign-paper-graph";
import type {
  ResearchControlCampaignPaperConfirmationAdvanceResult
} from "./research-control-campaign-paper-confirmation";
import type {
  ResearchControlCampaignPaperSourceWindowAdvanceResult
} from "./research-control-campaign-paper-source-window";

export type ResearchControlCampaignPaperExecutorErrorCode =
  | "research_control_campaign_paper_executor_graph_invalid"
  | "research_control_campaign_paper_executor_action_failed";

export class ResearchControlCampaignPaperExecutorError extends Error {
  constructor(
    readonly code: ResearchControlCampaignPaperExecutorErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlCampaignPaperExecutorError";
  }
}

export interface ResearchControlCampaignPaperExecutorGraph {
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
}

export interface ResearchControlCampaignPaperExecutorContext
  extends ResearchControlCampaignPaperExecutorGraph {
  evidence: ProjectResearchControlCampaignPaperNextActionInput;
}

type ActionOf<Kind extends ResearchControlCampaignPaperNextAction["action"]> =
  Extract<ResearchControlCampaignPaperNextAction, { action: Kind }>;

export interface ResearchControlCampaignPaperExecutorActions {
  expireUnopenedSourceSlot(
    action: ActionOf<"expire_unopened_source_slot">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<unknown>;
  prepareSourceBatch(
    action: ActionOf<"prepare_source_batch">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<unknown>;
  captureSourceStartBatch(
    action: ActionOf<"capture_source_start_batch">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<unknown>;
  authorizeSourceBatch(
    action: ActionOf<"authorize_source_batch">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<unknown>;
  startSourceBatch(
    action: ActionOf<"start_source_batch">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<unknown>;
  advanceSourceWindow(
    action: ActionOf<"advance_source_window">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<ResearchControlCampaignPaperSourceWindowAdvanceResult>;
  adjudicateSourceVerdict(
    action: ActionOf<"adjudicate_source_verdict">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<unknown>;
  precommitOrExpireConfirmation(
    action: ActionOf<
      "precommit_confirmation" | "expire_confirmation_precommit"
    >,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<unknown>;
  advanceConfirmation(
    action: ActionOf<"advance_confirmation">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<ResearchControlCampaignPaperConfirmationAdvanceResult>;
  recordSlotOutcome(
    action: ActionOf<"record_slot_outcome">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<unknown>;
  collectCampaignOutcome(
    action: ActionOf<"collect_campaign_outcome">,
    context: ResearchControlCampaignPaperExecutorContext
  ): Promise<ResearchControlCampaignOutcomeRecord>;
}

export type ResearchControlCampaignPaperExecutorStep =
  | {
      status: "advanced";
      action: Exclude<
        ResearchControlCampaignPaperNextAction["action"],
        "wait_until" | "complete"
      >;
      sequence?: number;
      armKind?: ResearchControlCampaignArmKind;
      outcome?: ResearchControlCampaignOutcomeRecord;
    }
  | {
      status: "waiting";
      action: "wait_until";
      sequence: number;
      wakeAt: string;
    }
  | { status: "complete"; action: "complete" };

export class ResearchControlCampaignPaperExecutor {
  private readonly installGraph: typeof installResearchControlCampaignPaperGraph;
  private readonly projectNextAction:
    typeof projectResearchControlCampaignPaperNextAction;

  constructor(private readonly options: {
    coordinator: OuroborosStorePort;
    arms: Record<ResearchControlCampaignArmKind, OuroborosStorePort>;
    actions: ResearchControlCampaignPaperExecutorActions;
    loadEvidence(
      graph: ResearchControlCampaignPaperExecutorGraph
    ): Promise<ProjectResearchControlCampaignPaperNextActionInput>;
    installGraph?: typeof installResearchControlCampaignPaperGraph;
    projectNextAction?: typeof projectResearchControlCampaignPaperNextAction;
  }) {
    this.installGraph = options.installGraph ??
      installResearchControlCampaignPaperGraph;
    this.projectNextAction = options.projectNextAction ??
      projectResearchControlCampaignPaperNextAction;
  }

  async advance(input: {
    campaignId: string;
  }): Promise<ResearchControlCampaignPaperExecutorStep> {
    const graph = await this.loadGraph(input?.campaignId);
    await this.installGraph({
      coordinator: this.options.coordinator,
      arms: this.options.arms,
      ...graph
    });
    const evidence = await this.options.loadEvidence(graph);
    if (!isDeepStrictEqual(evidence.schedule, graph.schedule)) {
      throw executorError(
        "research_control_campaign_paper_executor_graph_invalid",
        "Executor evidence does not belong to the exact installed schedule."
      );
    }
    const action = this.projectNextAction(evidence);
    if (action.action === "wait_until") {
      return { status: "waiting", ...action };
    }
    if (action.action === "complete") {
      return { status: "complete", action: "complete" };
    }
    const context = { ...graph, evidence };
    try {
      switch (action.action) {
        case "expire_unopened_source_slot":
          await this.options.actions.expireUnopenedSourceSlot(action, context);
          break;
        case "prepare_source_batch":
          await this.options.actions.prepareSourceBatch(action, context);
          break;
        case "capture_source_start_batch":
          await this.options.actions.captureSourceStartBatch(action, context);
          break;
        case "authorize_source_batch":
          await this.options.actions.authorizeSourceBatch(action, context);
          break;
        case "start_source_batch":
          await this.options.actions.startSourceBatch(action, context);
          break;
        case "advance_source_window": {
          const result = await this.options.actions.advanceSourceWindow(
            action,
            context
          );
          if (result.transition === "none" && !result.terminal && result.wakeAt) {
            return {
              status: "waiting",
              action: "wait_until",
              sequence: action.sequence,
              wakeAt: result.wakeAt
            };
          }
          break;
        }
        case "adjudicate_source_verdict":
          await this.options.actions.adjudicateSourceVerdict(action, context);
          break;
        case "precommit_confirmation":
        case "expire_confirmation_precommit":
          await this.options.actions.precommitOrExpireConfirmation(
            action,
            context
          );
          break;
        case "advance_confirmation": {
          const result = await this.options.actions.advanceConfirmation(
            action,
            context
          );
          if (result.status === "waiting") {
            return {
              status: "waiting",
              action: "wait_until",
              sequence: action.sequence,
              wakeAt: result.wakeAt
            };
          }
          break;
        }
        case "record_slot_outcome":
          await this.options.actions.recordSlotOutcome(action, context);
          break;
        case "collect_campaign_outcome": {
          const outcome = await this.options.actions.collectCampaignOutcome(
            action,
            context
          );
          return { status: "advanced", action: action.action, outcome };
        }
      }
    } catch (error) {
      if (error instanceof ResearchControlCampaignPaperExecutorError) throw error;
      throw executorError(
        "research_control_campaign_paper_executor_action_failed",
        `ResearchControlCampaign paper action ${action.action} failed.`,
        { action: action.action },
        error
      );
    }
    return {
      status: "advanced",
      action: action.action,
      ...(actionHasSequence(action) ? { sequence: action.sequence } : {}),
      ...(actionHasArm(action) ? { armKind: action.armKind } : {})
    };
  }

  private async loadGraph(
    campaignId: string
  ): Promise<ResearchControlCampaignPaperExecutorGraph> {
    if (typeof campaignId !== "string" || !campaignId.trim() ||
      campaignId.trim() !== campaignId) {
      throw executorError(
        "research_control_campaign_paper_executor_graph_invalid",
        "Executor requires one exact campaign ID."
      );
    }
    const [campaign, reports, schedules] = await Promise.all([
      this.options.coordinator.getResearchControlCampaign(campaignId),
      this.options.coordinator.listResearchControlCampaignReports(),
      this.options.coordinator.listResearchControlCampaignPaperSchedules()
    ]);
    const matchingReports = reports.filter((report) =>
      report.campaign_ref.id === campaignId
    );
    const matchingSchedules = schedules.filter((schedule) =>
      schedule.campaign_ref.id === campaignId
    );
    const report = matchingReports[0];
    const schedule = matchingSchedules[0];
    if (!campaign || matchingReports.length !== 1 || !report ||
      matchingSchedules.length !== 1 || !schedule ||
      report.campaign_digest !== campaign.campaign_digest ||
      schedule.campaign_digest !== campaign.campaign_digest ||
      schedule.report_ref.id !==
        report.research_control_campaign_report_id ||
      schedule.report_digest !== report.report_digest) {
      throw executorError(
        "research_control_campaign_paper_executor_graph_invalid",
        "Executor campaign, report, or schedule is missing or ambiguous."
      );
    }
    return { campaign, report, schedule };
  }
}

function actionHasSequence(
  action: ResearchControlCampaignPaperNextAction
): action is ResearchControlCampaignPaperNextAction & { sequence: number } {
  return "sequence" in action;
}

function actionHasArm(
  action: ResearchControlCampaignPaperNextAction
): action is ResearchControlCampaignPaperNextAction & {
  armKind: ResearchControlCampaignArmKind;
} {
  return "armKind" in action;
}

function executorError(
  code: ResearchControlCampaignPaperExecutorErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown
): ResearchControlCampaignPaperExecutorError {
  return new ResearchControlCampaignPaperExecutorError(
    code,
    message,
    details,
    cause === undefined ? undefined : { cause }
  );
}
