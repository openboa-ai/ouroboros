import { describe, expect, it } from "vitest";
import {
  BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL
} from "@ouroboros/application/trading/gateway/environment";
import {
  createGatewayRuntimeBinding,
  executeGatewayOrderRequest,
  LIVE_GATEWAY_DISABLED_REASON
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { BinancePublicMarketSdkAdapter } from "@ouroboros/adapters/binance/public-market-adapter";

describe("Gateway runtime binding", () => {
  it("binds paper to Binance production public market data and fake account/execution/Ledger", async () => {
    const client = fakeBinancePublicMarketDataClient();
    const binding = createGatewayRuntimeBinding({
      environment: "paper",
      marketData: new BinancePublicMarketSdkAdapter({
        restBaseUrl: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
        client,
        cache: false
      })
    });

    expect(binding).toMatchObject({
      environment: "paper",
      status: "enabled",
      marketData: {
        source_kind: "binance_production_public_rest",
        rest_base_url: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
        required_endpoints: [
          "/fapi/v1/time",
          "/fapi/v1/exchangeInfo",
          "/fapi/v1/premiumIndex?symbol=BTCUSDT",
          "/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=30",
          "/fapi/v1/ticker/bookTicker?symbol=BTCUSDT",
          "/fapi/v1/aggTrades?symbol=BTCUSDT&limit=100"
        ],
        authority_status: "read_only"
      },
      account: {
        provider_kind: "fake_paper_account",
        authority_status: "not_live"
      },
      executor: {
        executor_kind: "fake_paper_order_executor",
        order_submission_authority: false,
        authority_status: "dry_run_only"
      },
      ledger: {
        recorder_kind: "fake_ledger",
        chain: "OrderRequest -> GatewayResult -> ExecutionResult",
        authority_status: "not_live"
      },
      live_exchange_authority: false,
      order_submission_authority: false
    });

    const market = await binding.marketData.readMarketSnapshot();
    expect(market).toMatchObject({
      symbol: "BTCUSDT",
      price: 65000,
      expected_direction: "long"
    });
    expect(client.calls).toEqual([
      "checkServerTime",
      "exchangeInformation",
      "markPrice:BTCUSDT",
      "klineCandlestickData:BTCUSDT:1m:30"
    ]);

    const gatewayExecution = await executeGatewayOrderRequest(binding, {
      intent_kind: "place_order",
      symbol: "BTCUSDT",
      side: "buy",
      order_type: "market",
      quantity: "0.001"
    });
    expect(gatewayExecution).toMatchObject({
      intent: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "market",
        quantity: "0.001"
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        decision_reason: "dry_run_allowed"
      },
      execution_result: {
        status: "dry_run_recorded",
        result_reason: "dry_run_allowed"
      }
    });
    expect(JSON.stringify(binding)).not.toMatch(
      /demo-fapi|api_secret|signature|recvWindow|listenKey|USER_DATA|\/fapi\/v1\/order/i
    );
  });

  it("uses the same Gateway entrypoint but rejects disabled live execution", async () => {
    const liveBinding = createGatewayRuntimeBinding({
      environment: "live",
      marketData: new BinancePublicMarketSdkAdapter({
        restBaseUrl: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
        client: fakeBinancePublicMarketDataClient(),
        cache: false
      })
    });

    await expect(executeGatewayOrderRequest(liveBinding, {
      intent_kind: "place_order",
      symbol: "BTCUSDT",
      side: "buy",
      order_type: "market",
      quantity: "0.001"
    })).rejects.toThrow(LIVE_GATEWAY_DISABLED_REASON);

    expect(liveBinding).toMatchObject({
      environment: "live",
      status: "disabled",
      disabled_reason: LIVE_GATEWAY_DISABLED_REASON,
      live_exchange_authority: false,
      order_submission_authority: false
    });
  });
});

function fakeBinancePublicMarketDataClient() {
  const calls: string[] = [];
  return {
    calls,
    async checkServerTime() {
      calls.push("checkServerTime");
      return response({ serverTime: 1778889601000 });
    },
    async exchangeInformation() {
      calls.push("exchangeInformation");
      return response({
        serverTime: 1778889601000,
        symbols: [
          {
            symbol: "BTCUSDT",
            contractType: "PERPETUAL",
            status: "TRADING",
            filters: [
              { filterType: "PRICE_FILTER", tickSize: "0.10" },
              { filterType: "LOT_SIZE", minQty: "0.001", stepSize: "0.001" },
              { filterType: "MIN_NOTIONAL", notional: "100" }
            ]
          }
        ]
      });
    },
    async markPrice(request: { symbol?: string }) {
      calls.push(`markPrice:${request.symbol ?? ""}`);
      return response({
        symbol: "BTCUSDT",
        markPrice: "65000.00000000",
        indexPrice: "64995.00000000",
        estimatedSettlePrice: "64990.00000000",
        lastFundingRate: "0.00010000",
        interestRate: "0.00010000",
        nextFundingTime: 1778918400000,
        time: 1778889600000
      });
    },
    async klineCandlestickData(request: { symbol?: string; interval?: string; limit?: number }) {
      calls.push(`klineCandlestickData:${request.symbol ?? ""}:${request.interval ?? ""}:${request.limit ?? ""}`);
      return response([
        [1778887860000, "64000", "64100", "63900", "64000", "10"],
        [1778887920000, "64100", "64200", "64000", "64100", "10"],
        [1778887980000, "64200", "64300", "64100", "64200", "10"],
        [1778888040000, "64300", "64400", "64200", "64300", "10"],
        [1778888100000, "64400", "64500", "64300", "64400", "10"],
        [1778888160000, "64500", "64600", "64400", "64500", "10"]
      ]);
    }
  };
}

function response<T>(payload: T) {
  return {
    async data() {
      return payload;
    }
  };
}
