import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { PaperTradingComparisonSessionPort } from
  "@ouroboros/application/ports/paper-comparison-session";
import type { OuroborosStorePort } from
  "@ouroboros/application/ports/store";
import { PaperTradingComparisonActivationCoordinator } from
  "@ouroboros/application/trading/paper/comparison-activation-coordinator";
import { PaperTradingComparisonCheckpointCoordinator } from
  "@ouroboros/application/trading/paper/comparison-checkpoint-coordinator";
import { PaperTradingComparisonConfirmationCampaignService } from
  "@ouroboros/application/trading/paper/comparison-confirmation-campaign-service";
import { PaperTradingComparisonConfirmationWindowService } from
  "@ouroboros/application/trading/paper/comparison-confirmation-window-service";
import { PaperTradingComparisonCoordinator } from
  "@ouroboros/application/trading/paper/comparison-coordinator";
import { PaperTradingComparisonQualificationService } from
  "@ouroboros/application/trading/paper/comparison-qualification-service";
import { PaperTradingComparisonResearchReleaseService } from
  "@ouroboros/application/trading/paper/comparison-research-release-service";
import { PaperTradingComparisonRuntimeActivationCoordinator } from
  "@ouroboros/application/trading/paper/comparison-runtime-activation-coordinator";
import type { PaperTradingSessionService } from
  "@ouroboros/application/trading/paper/session-service";
import { PaperTradingComparisonTickCoordinator } from
  "@ouroboros/application/trading/paper/comparison-tick-coordinator";
import { PaperTradingComparisonVerdictService } from
  "@ouroboros/application/trading/paper/comparison-verdict-service";
import { PaperTradingComparisonWindowDriver } from
  "@ouroboros/application/trading/paper/comparison-window-driver";
import { LocalStorePaperTradingComparisonWindowStateReader } from
  "@ouroboros/application/trading/paper/comparison-window-reader";
import { ResearchControlCampaignPaperComparisonAdvancer } from
  "./research-control-campaign-paper-comparison-advancer";
import type { ResearchControlCampaignPaperRuntimeArm } from
  "./research-control-campaign-paper-runtime";

export type ResearchControlCampaignPaperRuntimeArmSessions =
  PaperTradingComparisonSessionPort &
  Pick<PaperTradingSessionService, "prepare">;

export function createResearchControlCampaignPaperRuntimeArm(input: {
  store: OuroborosStorePort;
  sessions: ResearchControlCampaignPaperRuntimeArmSessions;
  marketData: GatewayMarketDataPort;
  now?: () => string;
}): ResearchControlCampaignPaperRuntimeArm {
  const now = input.now ?? (() => new Date().toISOString());
  const comparisons = new PaperTradingComparisonCoordinator({
    store: input.store,
    sessions: input.sessions,
    now
  });
  const activations = new PaperTradingComparisonActivationCoordinator({
    store: input.store,
    comparisons,
    now
  });
  const runtime = new PaperTradingComparisonRuntimeActivationCoordinator({
    store: input.store,
    sessions: input.sessions,
    marketData: input.marketData,
    now
  });
  const windowReader = new LocalStorePaperTradingComparisonWindowStateReader({
    store: input.store,
    activations: runtime,
    now
  });
  const createWindowDriver: ResearchControlCampaignPaperRuntimeArm[
    "createWindowDriver"
  ] = (driverInput) => {
    const ticks = new PaperTradingComparisonTickCoordinator({
      store: input.store,
      comparisons,
      marketData: driverInput.marketData,
      activations: runtime,
      now: driverInput.now
    });
    const checkpoints = new PaperTradingComparisonCheckpointCoordinator({
      store: input.store,
      sessions: input.sessions,
      activations: runtime,
      now: driverInput.now
    });
    return new PaperTradingComparisonWindowDriver({
      reader: windowReader,
      ticks,
      checkpoints,
      activations: runtime
    });
  };
  const qualifications = new PaperTradingComparisonQualificationService({
    store: input.store,
    windowReader
  });
  const verdicts = new PaperTradingComparisonVerdictService({
    store: input.store,
    qualifications,
    now
  });
  const campaigns = new PaperTradingComparisonConfirmationCampaignService({
    store: input.store,
    now
  });
  const windows = new PaperTradingComparisonConfirmationWindowService({
    store: input.store,
    comparisons,
    now
  });
  const releases = new PaperTradingComparisonResearchReleaseService({
    store: input.store,
    now
  });
  const firstTicks = new PaperTradingComparisonTickCoordinator({
    store: input.store,
    comparisons,
    marketData: input.marketData,
    now
  });
  const comparisonAdvancer = new ResearchControlCampaignPaperComparisonAdvancer({
    store: input.store,
    ticks: firstTicks,
    activations,
    runtime,
    createWindowDriver: () => createWindowDriver({
      marketData: input.marketData,
      now
    }),
    verdicts
  });

  return {
    store: input.store,
    comparisons,
    activations,
    runtime,
    windowReader,
    createWindowDriver,
    verdicts,
    campaigns,
    windows,
    advanceComparison: (advanceInput) =>
      comparisonAdvancer.advance(advanceInput),
    releases
  };
}
