import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import { classifyPaperTradingComparisonWindow } from
  "@ouroboros/application/trading/paper/comparison-window-state";
import type {
  ResearchControlCampaignArmKind,
  ResearchControlCampaignOutcomeRecord
} from "@ouroboros/domain";
import { createResearchControlCampaignPaperExecutorActions } from
  "./research-control-campaign-paper-actions";
import {
  ResearchControlCampaignPaperConfirmationCoordinator,
  type ResearchControlCampaignPaperConfirmationArm
} from "./research-control-campaign-paper-confirmation";
import { loadResearchControlCampaignPaperEvidence } from
  "./research-control-campaign-paper-evidence";
import { ResearchControlCampaignPaperExecutor } from
  "./research-control-campaign-paper-executor";
import { ResearchControlCampaignPaperRunner } from
  "./research-control-campaign-paper-runner";
import {
  ResearchControlCampaignPaperSourceBatchCoordinator,
  type ResearchControlCampaignPaperSourceArm
} from "./research-control-campaign-paper-source-batch";
import {
  ResearchControlCampaignPaperSourceWindowCoordinator,
  type ResearchControlCampaignPaperSourceWindowArm
} from "./research-control-campaign-paper-source-window";

export interface ResearchControlCampaignPaperRuntimeArm
  extends ResearchControlCampaignPaperSourceArm,
    ResearchControlCampaignPaperSourceWindowArm,
    ResearchControlCampaignPaperConfirmationArm {}

export interface ResearchControlCampaignPaperRuntime {
  sourceBatch: ResearchControlCampaignPaperSourceBatchCoordinator;
  sourceWindow: ResearchControlCampaignPaperSourceWindowCoordinator;
  confirmation: ResearchControlCampaignPaperConfirmationCoordinator;
  executor: ResearchControlCampaignPaperExecutor;
  runner: ResearchControlCampaignPaperRunner;
}

export function createResearchControlCampaignPaperRuntime(input: {
  coordinator: OuroborosStorePort;
  arms: Record<
    ResearchControlCampaignArmKind,
    ResearchControlCampaignPaperRuntimeArm
  >;
  marketData: GatewayMarketDataPort;
  collectCampaignOutcome(
    campaignId: string
  ): Promise<ResearchControlCampaignOutcomeRecord>;
  now?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
}): ResearchControlCampaignPaperRuntime {
  const now = input.now ?? (() => new Date().toISOString());
  const sourceBatch = new ResearchControlCampaignPaperSourceBatchCoordinator({
    coordinator: input.coordinator,
    arms: input.arms,
    marketData: input.marketData,
    now
  });
  const sourceWindow = new ResearchControlCampaignPaperSourceWindowCoordinator({
    coordinator: input.coordinator,
    arms: input.arms,
    marketData: input.marketData,
    now
  });
  const confirmation = new ResearchControlCampaignPaperConfirmationCoordinator({
    coordinator: input.coordinator,
    arms: input.arms,
    now
  });
  const actions = createResearchControlCampaignPaperExecutorActions({
    sourceBatch,
    sourceWindow,
    confirmation,
    collectCampaignOutcome: input.collectCampaignOutcome
  });
  const executor = new ResearchControlCampaignPaperExecutor({
    coordinator: input.coordinator,
    arms: {
      adaptive_treatment: input.arms.adaptive_treatment.store,
      static_control: input.arms.static_control.store
    },
    actions,
    loadEvidence: (graph) => loadResearchControlCampaignPaperEvidence({
      graph,
      coordinator: input.coordinator,
      arms: {
        adaptive_treatment: input.arms.adaptive_treatment.store,
        static_control: input.arms.static_control.store
      },
      now: now(),
      readSourceWindowDecision: async (source) => {
        const snapshot = await input.arms[source.armKind].windowReader.load({
          activationId: source.activationId,
          activationAttemptId: source.activationAttemptId
        });
        return classifyPaperTradingComparisonWindow(snapshot.facts);
      }
    })
  });
  const runner = new ResearchControlCampaignPaperRunner({
    executor,
    now,
    ...(input.sleep ? { sleep: input.sleep } : {})
  });
  return { sourceBatch, sourceWindow, confirmation, executor, runner };
}
