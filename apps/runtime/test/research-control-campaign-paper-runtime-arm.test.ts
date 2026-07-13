import { describe, expect, it } from "vitest";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { OuroborosStorePort } from
  "@ouroboros/application/ports/store";
import { PaperTradingComparisonActivationCoordinator } from
  "@ouroboros/application/trading/paper/comparison-activation-coordinator";
import { PaperTradingComparisonConfirmationCampaignService } from
  "@ouroboros/application/trading/paper/comparison-confirmation-campaign-service";
import { PaperTradingComparisonConfirmationWindowService } from
  "@ouroboros/application/trading/paper/comparison-confirmation-window-service";
import { PaperTradingComparisonCoordinator } from
  "@ouroboros/application/trading/paper/comparison-coordinator";
import { PaperTradingComparisonResearchReleaseService } from
  "@ouroboros/application/trading/paper/comparison-research-release-service";
import { PaperTradingComparisonRuntimeActivationCoordinator } from
  "@ouroboros/application/trading/paper/comparison-runtime-activation-coordinator";
import { PaperTradingComparisonVerdictService } from
  "@ouroboros/application/trading/paper/comparison-verdict-service";
import { PaperTradingComparisonWindowDriver } from
  "@ouroboros/application/trading/paper/comparison-window-driver";
import { LocalStorePaperTradingComparisonWindowStateReader } from
  "@ouroboros/application/trading/paper/comparison-window-reader";
import {
  createResearchControlCampaignPaperRuntimeArm,
  type ResearchControlCampaignPaperRuntimeArmSessions
} from "../src/candidate/arena/research-control-campaign-paper-runtime-arm";

describe("ResearchControlCampaign paper runtime arm factory", () => {
  it("composes the real paper services around one activation owner", () => {
    const store = {} as OuroborosStorePort;
    const sessions = {} as ResearchControlCampaignPaperRuntimeArmSessions;
    const marketData = marketDataPort();
    const now = () => "2026-07-12T10:00:00.000Z";

    const arm = createResearchControlCampaignPaperRuntimeArm({
      store,
      sessions,
      marketData,
      now
    });
    const driver = arm.createWindowDriver({ marketData, now });

    expect(arm.store).toBe(store);
    expect(arm.comparisons).toBeInstanceOf(PaperTradingComparisonCoordinator);
    expect(arm.activations).toBeInstanceOf(
      PaperTradingComparisonActivationCoordinator
    );
    expect(arm.runtime).toBeInstanceOf(
      PaperTradingComparisonRuntimeActivationCoordinator
    );
    expect(arm.windowReader).toBeInstanceOf(
      LocalStorePaperTradingComparisonWindowStateReader
    );
    expect(arm.verdicts).toBeInstanceOf(PaperTradingComparisonVerdictService);
    expect(arm.campaigns).toBeInstanceOf(
      PaperTradingComparisonConfirmationCampaignService
    );
    expect(arm.windows).toBeInstanceOf(
      PaperTradingComparisonConfirmationWindowService
    );
    expect(arm.releases).toBeInstanceOf(
      PaperTradingComparisonResearchReleaseService
    );
    expect(driver).toBeInstanceOf(PaperTradingComparisonWindowDriver);
    expect(typeof arm.advanceComparison).toBe("function");
    expect(runtimeOwner(arm.windowReader)).toBe(arm.runtime);
    expect(runtimeOwner(driver)).toBe(arm.runtime);
  });

  it("creates a fresh ownership boundary for each arm", () => {
    const input = {
      store: {} as OuroborosStorePort,
      sessions: {} as ResearchControlCampaignPaperRuntimeArmSessions,
      marketData: marketDataPort()
    };

    const first = createResearchControlCampaignPaperRuntimeArm(input);
    const second = createResearchControlCampaignPaperRuntimeArm(input);

    expect(first.runtime).not.toBe(second.runtime);
    expect(first.windowReader).not.toBe(second.windowReader);
  });
});

function runtimeOwner(value: object): unknown {
  return (value as {
    options?: { activations?: unknown };
  }).options?.activations;
}

function marketDataPort(): GatewayMarketDataPort {
  const unavailable = async (): Promise<never> => {
    throw new Error("not invoked by composition test");
  };
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://example.invalid",
    required_endpoints: [],
    authority_status: "read_only",
    readMarketSnapshot: unavailable,
    readPublicExecutionSnapshot: unavailable,
    readPublicMarketLivenessSurface: unavailable
  };
}
