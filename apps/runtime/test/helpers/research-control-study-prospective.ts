import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeterministicSandboxAdapter,
  FileSystemCodeArtifactResolver
} from "@ouroboros/adapters";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type {
  SandboxAdapterPort,
  SandboxAdapterRegistryPort,
  SandboxStartInput
} from "@ouroboros/application/ports/sandbox";
import type { TradingArtifactRunner } from
  "@ouroboros/application/trading/research/artifact-runner";
import {
  startPaperTradingApiProvider,
  type GatewayRuntimeBinding,
  type PaperTradingApiProviderOptions
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { validateOrderRequest } from
  "@ouroboros/application/trading/research/replay-trading-api-provider";
import type {
  ReplayTradingApiProviderSession,
  ReplayTradingCandidateInput,
  TradingProviderRequestLog,
  TradingSystemEvent
} from "@ouroboros/application/trading/research/types";
import type { SandboxDetailReadModel, SandboxRecord } from "@ouroboros/domain";
import type { ResearchControlStudyArmSessionContext } from
  "../../src/candidate/arena/research-control-study-arm-session-factory";
import { passingPaperHandoffProbe } from "./paper-handoff";

export interface ProspectivePaperTracker {
  providerStarts: number;
  providerCloses: number;
  sandboxStarts: number;
  sandboxStops: number;
}

export interface ProspectivePaperHarness {
  tracker: ProspectivePaperTracker;
  createSandboxAdapters(
    context: ResearchControlStudyArmSessionContext
  ): SandboxAdapterRegistryPort;
  createArtifactResolver(
    context: ResearchControlStudyArmSessionContext
  ): FileSystemCodeArtifactResolver;
  apiProviderFactory(
    binding: GatewayRuntimeBinding,
    options: PaperTradingApiProviderOptions
  ): Promise<ReplayTradingApiProviderSession>;
  cleanup(): Promise<void>;
}

export function prospectiveClock(startAt: string) {
  let current = validTimestamp(startAt);
  const currentTime = () => {
    current = Math.max(current, Date.now());
    return current;
  };
  return {
    now: () => new Date(currentTime()).toISOString(),
    async sleep(milliseconds: number) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new TypeError("prospective_clock_sleep_invalid");
      }
      current = currentTime() + milliseconds;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  };
}

export function prospectiveMarketData(input: {
  now: () => string;
  priceAt?: (observedAt: string) => number;
}): GatewayMarketDataPort {
  let sequence = 0;
  const observedAt = (requested?: string) => requested ?? input.now();
  const priceAt = (at: string) => {
    const price = input.priceAt?.(at) ?? 60_000;
    if (!Number.isFinite(price) || price <= 0) {
      throw new TypeError("prospective_market_price_invalid");
    }
    return price;
  };
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://example.invalid",
    required_endpoints: [
      "GET /fapi/v1/exchangeInfo",
      "GET /fapi/v1/premiumIndex"
    ],
    authority_status: "read_only",
    async readMarketSnapshot(request = {}) {
      const requestedAt = observedAt(request.observedAt);
      const at = shiftTimestamp(requestedAt, -2);
      const price = priceAt(requestedAt);
      return {
        symbol: "BTCUSDT",
        price,
        moving_average_fast: price + 100,
        moving_average_slow: price - 100,
        volatility: 0.01,
        expected_direction: "long",
        observed_at: at,
        source_kind: "binance_production_public_rest",
        source_priority: "rest_fallback",
        freshness: "fresh",
        ws_connected: false,
        rest_fallback_used: true,
        gap_detected: false,
        stream_marker: `prospective-market-${++sequence}`
      };
    },
    async readPublicMarketLivenessSurface(request = {}) {
      const at = observedAt(request.observedAt);
      const price = priceAt(at);
      return {
        record_kind: "public_market_liveness_surface",
        version: 1,
        public_market_liveness_surface_id:
          `prospective-btcusdt-public-market-${Date.parse(at)}`,
        surface_family: "public_market_liveness",
        venue: "binance_usd_m_futures",
        instrument: "BTCUSDT",
        product_category: "perpetual_futures",
        symbol_status: "TRADING",
        contract_type: "PERPETUAL",
        price_tick_size: "0.10",
        quantity_step_size: "0.001",
        min_quantity: "0.001",
        min_notional: "100",
        mark_price: price.toFixed(1),
        index_price: (price - 1).toFixed(1),
        estimated_settle_price: (price - 2).toFixed(1),
        funding_rate: "0.00010000",
        interest_rate: "0.00010000",
        next_funding_time: shiftTimestamp(at, 8 * 60 * 60 * 1_000),
        server_time: at,
        source_timestamp: at,
        observed_at: at,
        updated_at: at,
        freshness: "fresh",
        liveness: "connected",
        source_kind: "binance_market_data_rest",
        source_ref: {
          record_kind: "binance_rest_endpoint",
          id: "prospective-fapi-v1-exchangeInfo-premiumIndex"
        },
        transport: {
          transport_kind: "official_binance_connector",
          repository: "binance/binance-connector-js",
          package_name: "@binance/derivatives-trading-usds-futures",
          api_family: "derivatives_trading_usds_futures",
          supported_endpoints: [
            "rest_api",
            "websocket_api",
            "websocket_streams"
          ],
          production_base_url: "https://fapi.binance.com",
          testnet_base_url: "https://demo-fapi.binance.com",
          integration_role: "transport_only",
          authority_status: "not_live"
        },
        fixture_backed: false,
        simulated: false,
        no_authority: {
          live_exchange: false,
          order_submission: false,
          credentials: false
        },
        authority_status: "read_only"
      };
    },
    async readPublicExecutionSnapshot(request = {}) {
      const requestedAt = observedAt(request.observedAt);
      const at = shiftTimestamp(requestedAt, -1);
      const price = priceAt(requestedAt);
      const marker = `prospective-execution-${++sequence}`;
      return {
        symbol: "BTCUSDT",
        observed_at: at,
        source_kind: "binance_production_public_rest",
        source_priority: "rest_fallback",
        freshness: "fresh",
        ws_connected: false,
        rest_fallback_used: true,
        gap_detected: false,
        stream_marker: marker,
        book_ticker: {
          bid_price: (price - 0.1).toFixed(1),
          bid_quantity: "1.000",
          ask_price: (price + 0.1).toFixed(1),
          ask_quantity: "1.000",
          event_time: at
        },
        agg_trades: [{
          trade_id: marker,
          price: price.toFixed(1),
          quantity: "1.000",
          trade_time: at,
          is_buyer_maker: false
        }],
        authority_status: "read_only"
      };
    }
  };
}

export function createProspectivePaperHarness(input: {
  repoRoot: string;
  marketData: GatewayMarketDataPort;
}): ProspectivePaperHarness {
  const tracker: ProspectivePaperTracker = {
    providerStarts: 0,
    providerCloses: 0,
    sandboxStarts: 0,
    sandboxStops: 0
  };
  const providers = new Set<ReplayTradingApiProviderSession>();
  const sandboxes: Array<{
    adapter: DeterministicSandboxAdapter;
    active: Map<string, SandboxRecord | SandboxDetailReadModel>;
  }> = [];

  const apiProviderFactory = async (
    binding: GatewayRuntimeBinding,
    options: PaperTradingApiProviderOptions
  ): Promise<ReplayTradingApiProviderSession> => {
    tracker.providerStarts += 1;
    const provider = await startPaperTradingApiProvider(binding, options);
    let closed = false;
    const tracked: ReplayTradingApiProviderSession = {
      base_url: provider.base_url,
      ...(provider.sandbox_base_url
        ? { sandbox_base_url: provider.sandbox_base_url }
        : {}),
      candidate_input: provider.candidate_input,
      requests: () => provider.requests(),
      async close() {
        if (closed) return;
        closed = true;
        providers.delete(tracked);
        await provider.close();
        tracker.providerCloses += 1;
      }
    };
    providers.add(tracked);
    return tracked;
  };

  const createSandboxAdapters = (
    context: ResearchControlStudyArmSessionContext
  ): SandboxAdapterRegistryPort => {
    const adapter = new DeterministicSandboxAdapter({
      allowedSystemCodeIds: [
        "fixture-system-code-clock-python-001",
        "system-code-confirmation-challenger"
      ],
      allowedArtifactRoots: [
        path.join(context.root, "candidate-arena-runs"),
        path.join(input.repoRoot, "fixtures", "trading-systems")
      ],
      allowedCapabilityPolicyIds: [
        "candidate-arena-paper-system-code",
        "capability-policy-clock-fixture-v1"
      ]
    });
    const active = new Map<
      string,
      SandboxRecord | SandboxDetailReadModel
    >();
    sandboxes.push({ adapter, active });
    const tracked: SandboxAdapterPort = {
      kind: adapter.kind,
      async startArtifactInstance(startInput: SandboxStartInput) {
        tracker.sandboxStarts += 1;
        const result = await adapter.startArtifactInstance(startInput);
        if (result.instance.lifecycle_status === "running") {
          active.set(result.instance.sandbox_id, result.instance);
        }
        return result;
      },
      getArtifactInstanceStatus: (instance) =>
        adapter.getArtifactInstanceStatus(instance),
      getArtifactInstanceLogs: (instance) =>
        adapter.getArtifactInstanceLogs(instance),
      async stopArtifactInstance(instance) {
        tracker.sandboxStops += 1;
        const result = await adapter.stopArtifactInstance(instance);
        active.delete(sandboxId(instance));
        return result;
      }
    };
    return {
      deterministic_test: tracked,
      docker_sandboxes_sbx: tracked
    };
  };

  return {
    tracker,
    createSandboxAdapters,
    createArtifactResolver: (context) =>
      new FileSystemCodeArtifactResolver({
        repoRoot: input.repoRoot,
        generatedArtifactRoot: path.join(context.root, "candidate-arena-runs")
      }),
    apiProviderFactory,
    async cleanup() {
      await Promise.allSettled([...providers].map((provider) =>
        provider.close()
      ));
      for (const sandbox of sandboxes) {
        for (const instance of [...sandbox.active.values()]) {
          tracker.sandboxStops += 1;
          await sandbox.adapter.stopArtifactInstance(instance).catch(() => undefined);
          sandbox.active.delete(sandboxId(instance));
        }
      }
    }
  };
}

export function networklessResearchPreflightArtifactRunner():
  TradingArtifactRunner {
  return {
    kind: "host_process",
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    async run(input) {
      const source = await readFile(path.join(input.artifact_dir, "run.py"), "utf8");
      const direction = source.match(
        /^ARENA_RESEARCH_DIRECTION = "([a-z_]+)"$/m
      )?.[1];
      const riskFraction = Number(source.match(
        /^RISK_FRACTION = ([0-9.]+)$/m
      )?.[1] ?? "0.02");
      if (!Number.isFinite(riskFraction) || riskFraction <= 0) {
        throw new TypeError("prospective_artifact_risk_fraction_invalid");
      }
      const market = input.provider.candidate_input.market;
      const account = input.provider.candidate_input.account;
      const shouldHold =
        direction === "funding_aware_risk" ||
        market.moving_average_fast === market.moving_average_slow;
      const trendSide = market.moving_average_fast < market.moving_average_slow
        ? "sell" as const
        : "buy" as const;
      const side = direction === "mean_reversion"
        ? trendSide === "buy" ? "sell" as const : "buy" as const
        : trendSide;
      const orderRequest = {
        symbol: market.symbol,
        side: shouldHold
          ? "hold" as const
          : side,
        quantity: shouldHold
          ? 0
          : Number((account.equity *
              Math.min(riskFraction, account.max_risk_fraction) /
              market.price).toFixed(8)),
        order_type: shouldHold ? "none" as const : "market" as const,
        reason: `networkless prospective ${direction ?? "unclassified"} fixture`
      };
      const validation = validateOrderRequest(orderRequest, market, account);
      const events: TradingSystemEvent[] = [
        { event: "market_snapshot", ...market },
        { event: "account_state", ...account },
        { event: "order_request", ...orderRequest },
        { event: "order_validation", ...validation },
        { event: "run_complete", accepted: validation.accepted }
      ];
      await mkdir(input.output_dir, { recursive: true });
      const eventsPath = path.join(input.output_dir, "events.jsonl");
      await writeFile(
        eventsPath,
        `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
        "utf8"
      );
      return {
        status: "completed",
        runner_kind: "host_process",
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: eventsPath,
        stdout: events.map((event) => JSON.stringify(event)).join("\n"),
        stderr: "",
        events,
        provider_requests: providerRequests(orderRequest)
      };
    }
  };
}

export async function networklessResearchPreflightProvider(
  candidateInput: ReplayTradingCandidateInput
): Promise<ReplayTradingApiProviderSession> {
  return {
    base_url: "",
    close: async () => undefined,
    requests: () => [],
    candidate_input: candidateInput
  };
}

function providerRequests(body: unknown): TradingProviderRequestLog[] {
  return [
    providerRequest("GET", "/market/snapshot"),
    providerRequest("GET", "/account/state"),
    providerRequest("POST", "/orders/validate", body)
  ];
}

function providerRequest(
  method: string,
  requestPath: string,
  body?: unknown
): TradingProviderRequestLog {
  return {
    at: new Date().toISOString(),
    method,
    path: requestPath,
    ...(body === undefined ? {} : { body }),
    response_status: 200
  };
}

function validTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError("prospective_clock_timestamp_invalid");
  }
  return parsed;
}

function shiftTimestamp(value: string, milliseconds: number): string {
  return new Date(validTimestamp(value) + milliseconds).toISOString();
}

function sandboxId(instance: SandboxRecord | SandboxDetailReadModel): string {
  return instance.sandbox_id;
}
