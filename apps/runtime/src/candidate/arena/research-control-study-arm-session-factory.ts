import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { SandboxAdapterRegistryPort } from
  "@ouroboros/application/ports/sandbox";
import type { SystemCodeArtifactResolverPort } from
  "@ouroboros/application/ports/system-code-artifact";
import { PaperTradingEvaluationRunner } from
  "@ouroboros/application/trading/paper/evaluation-runner";
import {
  PaperTradingSessionService,
  type PaperTradingSessionServiceOptions
} from "@ouroboros/application/trading/paper/session-service";
import type { ResearchControlCampaignArmKind } from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import type { ResearchControlCampaignPaperRuntimeArmSessions } from
  "./research-control-campaign-paper-runtime-arm";

export type ResearchControlStudyArmSessionFactoryErrorCode =
  "research_control_study_arm_session_store_root_mismatch";

export class ResearchControlStudyArmSessionFactoryError extends Error {
  constructor(
    readonly code: ResearchControlStudyArmSessionFactoryErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchControlStudyArmSessionFactoryError";
  }
}

export interface ResearchControlStudyArmSessionContext {
  root: string;
  armKind: ResearchControlCampaignArmKind;
  store: LocalStore;
}

export interface ResearchControlStudyArmSessionFactoryOptions {
  marketData: GatewayMarketDataPort;
  createSandboxAdapters(
    context: ResearchControlStudyArmSessionContext
  ): SandboxAdapterRegistryPort | Promise<SandboxAdapterRegistryPort>;
  createArtifactResolver(
    context: ResearchControlStudyArmSessionContext
  ): SystemCodeArtifactResolverPort | Promise<SystemCodeArtifactResolverPort>;
  intervalMs?: number;
  sandboxIntervalMs?: number;
  observationDrainTimeoutMs?: number;
  apiProviderFactory?: PaperTradingSessionServiceOptions["apiProviderFactory"];
  apiProviderOptions?: PaperTradingSessionServiceOptions["apiProviderOptions"];
  logger?: PaperTradingSessionServiceOptions["logger"];
  createRunner?: () => PaperTradingEvaluationRunner;
}

export function createResearchControlStudyArmSessionFactory(
  options: ResearchControlStudyArmSessionFactoryOptions
): (
  context: ResearchControlStudyArmSessionContext
) => Promise<ResearchControlCampaignPaperRuntimeArmSessions> {
  return async (context) => {
    if (context.store.root() !== context.root) {
      throw new ResearchControlStudyArmSessionFactoryError(
        "research_control_study_arm_session_store_root_mismatch",
        "ResearchControlStudy arm session Store does not match its copied root."
      );
    }
    const sandboxAdapters = await options.createSandboxAdapters(context);
    const artifactResolver = await options.createArtifactResolver(context);

    return new PaperTradingSessionService({
      store: context.store,
      sandboxAdapters,
      marketData: options.marketData,
      runner: options.createRunner?.() ?? new PaperTradingEvaluationRunner(),
      artifactResolver,
      ...(options.intervalMs === undefined
        ? {}
        : { intervalMs: options.intervalMs }),
      ...(options.sandboxIntervalMs === undefined
        ? {}
        : { sandboxIntervalMs: options.sandboxIntervalMs }),
      ...(options.observationDrainTimeoutMs === undefined
        ? {}
        : { observationDrainTimeoutMs: options.observationDrainTimeoutMs }),
      ...(options.apiProviderFactory
        ? { apiProviderFactory: options.apiProviderFactory }
        : {}),
      ...(options.apiProviderOptions
        ? { apiProviderOptions: options.apiProviderOptions }
        : {}),
      ...(options.logger ? { logger: options.logger } : {})
    });
  };
}
