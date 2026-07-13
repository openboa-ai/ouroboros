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
import type {
  PaperTradingComparisonActivationAttemptRecord,
  PaperTradingComparisonTickRecord
} from "@ouroboros/domain";
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

  it("preserves checkpoint ownership across drivers in one arm", () => {
    const arm = createResearchControlCampaignPaperRuntimeArm({
      store: {} as OuroborosStorePort,
      sessions: {} as ResearchControlCampaignPaperRuntimeArmSessions,
      marketData: marketDataPort()
    });

    const first = arm.createWindowDriver({
      marketData: marketDataPort(),
      now: () => "2026-07-12T10:00:00.000Z"
    });
    const second = arm.createWindowDriver({
      marketData: marketDataPort(),
      now: () => "2026-07-12T10:00:01.000Z"
    });

    expect(checkpointOwner(first)).toBe(checkpointOwner(second));
  });

  it("enables both role-bound sessions for the exact persisted tick", async () => {
    const attempt = activationAttempt();
    const tick = comparisonTick();
    const calls: Array<Parameters<
      ResearchControlCampaignPaperRuntimeArmSessions[
        "enableComparisonTickAttributionSide"
      ]
    >[0]> = [];
    const store = {
      async getPaperTradingComparisonActivationAttempt(id: string) {
        return id === attempt.paper_trading_comparison_activation_attempt_id
          ? structuredClone(attempt)
          : undefined;
      },
      async getPaperTradingComparisonTick(id: string) {
        return id === tick.paper_trading_comparison_tick_id
          ? structuredClone(tick)
          : undefined;
      }
    } as OuroborosStorePort;
    const sessions = {
      async enableComparisonTickAttributionSide(input: typeof calls[number]) {
        calls.push(structuredClone(input));
      }
    } as ResearchControlCampaignPaperRuntimeArmSessions;
    const arm = createResearchControlCampaignPaperRuntimeArm({
      store,
      sessions,
      marketData: marketDataPort()
    });

    await arm.enableComparisonTickAttribution({
      activationAttemptId: attempt.paper_trading_comparison_activation_attempt_id,
      tickId: tick.paper_trading_comparison_tick_id
    });

    expect(calls.map(({ side, authority, tick: servedTick }) => ({
      role: side.role,
      authorityRole: authority.role,
      operation: authority.operation,
      tickId: servedTick.paper_trading_comparison_tick_id
    }))).toEqual([
      {
        role: "champion",
        authorityRole: "champion",
        operation: "deliver_market_snapshot",
        tickId: "tick-1"
      },
      {
        role: "challenger",
        authorityRole: "challenger",
        operation: "deliver_market_snapshot",
        tickId: "tick-1"
      }
    ]);
  });
});

function activationAttempt(): PaperTradingComparisonActivationAttemptRecord {
  return {
    paper_trading_comparison_activation_attempt_id: "attempt-1",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-1"
    },
    paper_trading_comparison_activation_digest: "sha256:activation-1",
    attempt_digest: "sha256:attempt-1",
    champion: {
      role: "champion",
      trading_run_ref: { record_kind: "trading_run", id: "champion-run" }
    },
    challenger: {
      role: "challenger",
      trading_run_ref: { record_kind: "trading_run", id: "challenger-run" }
    }
  } as PaperTradingComparisonActivationAttemptRecord;
}

function comparisonTick(): PaperTradingComparisonTickRecord {
  return {
    paper_trading_comparison_tick_id: "tick-1",
    tick_digest: "sha256:tick-1"
  } as PaperTradingComparisonTickRecord;
}

function runtimeOwner(value: object): unknown {
  return (value as {
    options?: { activations?: unknown };
  }).options?.activations;
}

function checkpointOwner(value: object): unknown {
  return (value as {
    options?: { checkpoints?: unknown };
  }).options?.checkpoints;
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
