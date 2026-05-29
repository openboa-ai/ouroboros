import WebSocket from "ws";
import type {
  PaperTradingOrderBookSummary,
  PaperTradingPublicExecutionSnapshotSummary
} from "@ouroboros/domain";
import type { MarketSnapshot } from "@ouroboros/application/trading/research/types";

export interface BinanceMarketDataHubOptions {
  restBaseUrl: string;
  webSocketBaseUrl?: string;
  websocketFactory?: BinanceWebSocketFactory;
  now?: () => number;
  freshnessMs?: number;
  autoConnect?: boolean;
  depthLimit?: 100 | 500 | 1000;
}

export interface BinanceMarketDataHubReadMarketSnapshotInput {
  observedAt?: string;
  restSnapshot: () => Promise<MarketSnapshot>;
}

export interface BinanceMarketDataHubReadExecutionSnapshotInput {
  observedAt?: string;
  restExecutionSnapshot: () => Promise<PaperTradingPublicExecutionSnapshotSummary>;
}

export interface BinanceWebSocketLike {
  readonly readyState?: number;
  on(event: "open", listener: () => void): this;
  on(event: "message", listener: (data: WebSocket.RawData | string) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  close(): void;
}

export type BinanceWebSocketFactory = (url: string) => BinanceWebSocketLike;

interface TimedValue<T> {
  payload: T;
  observedAtMs: number;
}

interface BinanceBookTickerStreamPayload {
  e?: string;
  E?: number;
  s?: string;
  b?: string;
  B?: string;
  a?: string;
  A?: string;
  u?: number;
}

interface BinanceAggTradeStreamPayload {
  e?: string;
  E?: number;
  a?: number;
  s?: string;
  p?: string;
  q?: string;
  T?: number;
  m?: boolean;
}

interface BinanceMarkPriceStreamPayload {
  e?: string;
  E?: number;
  s?: string;
  p?: string;
}

interface BinanceKlineStreamPayload {
  e?: string;
  E?: number;
  s?: string;
  k?: {
    c?: string;
  };
}

interface BinanceDepthUpdatePayload {
  e?: string;
  E?: number;
  s?: string;
  U?: number;
  u?: number;
  pu?: number;
  b?: Array<[string, string]>;
  a?: Array<[string, string]>;
}

interface BinanceDepthSnapshotPayload {
  lastUpdateId?: number;
  bids?: Array<[string, string]>;
  asks?: Array<[string, string]>;
}

interface OrderBookState {
  bids: Map<string, string>;
  asks: Map<string, string>;
  lastUpdateId?: number;
  previousFinalUpdateId?: number;
  syncStatus: PaperTradingOrderBookSummary["sync_status"];
  bridgePending?: boolean;
  gapDetected: boolean;
  observedAtMs: number;
}

const DEFAULT_FRESHNESS_MS = 5_000;
const DEFAULT_WS_BASE_URL = "wss://fstream.binance.com";

export class BinanceMarketDataHub {
  private readonly restBaseUrl: string;
  private readonly webSocketBaseUrl: string;
  private readonly websocketFactory: BinanceWebSocketFactory;
  private readonly now: () => number;
  private readonly freshnessMs: number;
  private readonly depthLimit: 100 | 500 | 1000;
  private readonly sockets = new Map<"public" | "market", BinanceWebSocketLike>();
  private readonly connected = new Set<"public" | "market">();
  private readonly depthBuffer: BinanceDepthUpdatePayload[] = [];
  private readonly aggTrades: TimedValue<NonNullable<PaperTradingPublicExecutionSnapshotSummary["agg_trades"]>[number]>[] = [];
  private depthRecovery?: Promise<void>;
  private latestBookTicker?: TimedValue<NonNullable<PaperTradingPublicExecutionSnapshotSummary["book_ticker"]>>;
  private latestMarkPrice?: TimedValue<number>;
  private latestKlineCloses: TimedValue<number>[] = [];
  private orderBook?: OrderBookState;
  private latestStreamMarker = "binance-public-ws-not-started";
  private latestError?: string;

  constructor(options: BinanceMarketDataHubOptions) {
    this.restBaseUrl = trimTrailingSlashes(options.restBaseUrl);
    this.webSocketBaseUrl = trimTrailingSlashes(options.webSocketBaseUrl ?? DEFAULT_WS_BASE_URL);
    this.websocketFactory = options.websocketFactory ?? ((url) => new WebSocket(url));
    this.now = options.now ?? Date.now;
    this.freshnessMs = options.freshnessMs ?? DEFAULT_FRESHNESS_MS;
    this.depthLimit = options.depthLimit ?? 1000;
    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  connect(): void {
    if (!this.sockets.has("public")) {
      this.openSocket("public", `${this.webSocketBaseUrl}/public/stream?streams=btcusdt@bookTicker/btcusdt@depth@100ms`);
    }
    if (!this.sockets.has("market")) {
      this.openSocket(
        "market",
        `${this.webSocketBaseUrl}/market/stream?streams=btcusdt@aggTrade/btcusdt@markPrice@1s/btcusdt@kline_1m`
      );
    }
  }

  close(): void {
    for (const socket of this.sockets.values()) {
      socket.close();
    }
    this.sockets.clear();
    this.connected.clear();
  }

  ingestWebSocketMessage(raw: unknown): void {
    const payload = normalizeWebSocketPayload(raw);
    if (!payload) {
      return;
    }
    if (payload.e === "bookTicker") {
      this.ingestBookTicker(payload as BinanceBookTickerStreamPayload);
      return;
    }
    if (payload.e === "aggTrade") {
      this.ingestAggTrade(payload as BinanceAggTradeStreamPayload);
      return;
    }
    if (payload.e === "markPriceUpdate") {
      this.ingestMarkPrice(payload as BinanceMarkPriceStreamPayload);
      return;
    }
    if (payload.e === "kline") {
      this.ingestKline(payload as BinanceKlineStreamPayload);
      return;
    }
    if (payload.e === "depthUpdate") {
      this.ingestDepthUpdate(payload as BinanceDepthUpdatePayload);
    }
  }

  async readMarketSnapshot(input: BinanceMarketDataHubReadMarketSnapshotInput): Promise<MarketSnapshot> {
    this.connect();
    const observedAt = input.observedAt ?? new Date(this.now()).toISOString();
    const wsSnapshot = this.websocketMarketSnapshot(observedAt);
    if (wsSnapshot) {
      return wsSnapshot;
    }
    const rest = await input.restSnapshot();
    return {
      ...rest,
      source_kind: "binance_production_public_hybrid",
      source_priority: "rest_fallback",
      freshness: this.anySocketConnected() ? "stale" : "unavailable",
      ws_connected: this.anySocketConnected(),
      rest_fallback_used: true,
      gap_detected: this.orderBook?.gapDetected,
      last_update_id: this.orderBook?.lastUpdateId === undefined ? undefined : String(this.orderBook.lastUpdateId),
      stream_marker: this.latestStreamMarker
    };
  }

  async readPublicExecutionSnapshot(
    input: BinanceMarketDataHubReadExecutionSnapshotInput
  ): Promise<PaperTradingPublicExecutionSnapshotSummary> {
    this.connect();
    const observedAt = input.observedAt ?? new Date(this.now()).toISOString();
    await this.ensureOrderBookRecovered().catch((error: unknown) => {
      this.latestError = error instanceof Error ? error.message : "order_book_recovery_failed";
      this.markOrderBookRecovering();
    });
    const wsExecution = this.websocketExecutionSnapshot(observedAt);
    if (wsExecution) {
      return wsExecution;
    }
    const rest = await input.restExecutionSnapshot();
    await this.ensureOrderBookRecovered().catch((error: unknown) => {
      this.latestError = error instanceof Error ? error.message : "order_book_recovery_failed";
      this.markOrderBookRecovering();
    });
    return {
      ...rest,
      source_kind: "binance_production_public_hybrid",
      source_priority: "rest_fallback",
      freshness: this.anySocketConnected() ? "stale" : "unavailable",
      ws_connected: this.anySocketConnected(),
      rest_fallback_used: true,
      gap_detected: this.orderBook?.gapDetected,
      last_update_id: this.orderBook?.lastUpdateId === undefined ? undefined : String(this.orderBook.lastUpdateId),
      order_book: this.orderBookSummary(observedAt),
      stream_marker: `${rest.stream_marker}:rest-fallback`
    };
  }

  async recoverOrderBookFromRest(observedAt = new Date(this.now()).toISOString()): Promise<void> {
    const snapshot = await fetchBinancePublicJson<BinanceDepthSnapshotPayload>(
      `${this.restBaseUrl}/fapi/v1/depth?symbol=BTCUSDT&limit=${this.depthLimit}`
    );
    const lastUpdateId = requireNumber(snapshot.lastUpdateId, "depth lastUpdateId");
    const orderBook: OrderBookState = {
      bids: priceLevels(snapshot.bids),
      asks: priceLevels(snapshot.asks),
      lastUpdateId,
      previousFinalUpdateId: lastUpdateId,
      syncStatus: "synced",
      gapDetected: this.orderBook?.gapDetected ?? false,
      observedAtMs: Date.parse(observedAt)
    };

    const applicable = this.depthBuffer
      .filter((event) => requireNumber(event.u, "depth final update id") >= lastUpdateId);
    const firstIndex = applicable.findIndex((event) =>
      requireNumber(event.U, "depth first update id") <= lastUpdateId &&
      lastUpdateId <= requireNumber(event.u, "depth final update id")
    );
    if (applicable.length > 0 && firstIndex < 0) {
      this.orderBook = {
        ...orderBook,
        syncStatus: "recovering",
        bridgePending: true,
        gapDetected: true
      };
      this.depthBuffer.length = 0;
      this.depthBuffer.push(...applicable.slice(-1000));
      throw new Error("depth_snapshot_unbridged");
    }
    this.orderBook = {
      ...orderBook,
      syncStatus: firstIndex >= 0 ? "synced" : "buffering",
      bridgePending: firstIndex < 0
    };
    if (firstIndex >= 0) {
      for (const event of applicable.slice(firstIndex)) {
        this.applyDepthUpdate(event, { allowSnapshotBridge: true });
      }
    }
    this.depthBuffer.length = 0;
  }

  private openSocket(kind: "public" | "market", url: string): void {
    const socket = this.websocketFactory(url);
    this.sockets.set(kind, socket);
    socket.on("open", () => {
      this.connected.add(kind);
    });
    socket.on("message", (data) => {
      this.connected.add(kind);
      this.ingestWebSocketMessage(data);
    });
    socket.on("close", () => {
      this.connected.delete(kind);
      this.sockets.delete(kind);
    });
    socket.on("error", (error) => {
      this.latestError = error.message;
      this.connected.delete(kind);
    });
    if (socket.readyState === WebSocket.OPEN) {
      this.connected.add(kind);
    }
  }

  private ingestBookTicker(payload: BinanceBookTickerStreamPayload): void {
    if (payload.s !== "BTCUSDT" || !payload.b || !payload.B || !payload.a || !payload.A) {
      return;
    }
    const observedAtMs = payload.E ?? this.now();
    this.latestBookTicker = {
      observedAtMs,
      payload: {
        bid_price: payload.b,
        bid_quantity: payload.B,
        ask_price: payload.a,
        ask_quantity: payload.A,
        event_time: epochMsToIso(observedAtMs)
      }
    };
    this.latestStreamMarker = `binance-ws-bookTicker-${payload.u ?? observedAtMs}`;
  }

  private ingestAggTrade(payload: BinanceAggTradeStreamPayload): void {
    if (payload.s !== "BTCUSDT" || payload.a === undefined || !payload.p || !payload.q || payload.T === undefined) {
      return;
    }
    const trade = {
      trade_id: String(payload.a),
      price: payload.p,
      quantity: payload.q,
      trade_time: epochMsToIso(payload.T),
      is_buyer_maker: payload.m
    };
    if (!this.aggTrades.some((entry) => entry.payload.trade_id === trade.trade_id)) {
      this.aggTrades.push({ payload: trade, observedAtMs: payload.T });
    }
    if (this.aggTrades.length > 500) {
      this.aggTrades.splice(0, this.aggTrades.length - 500);
    }
    this.latestStreamMarker = `binance-ws-aggTrade-${trade.trade_id}`;
  }

  private ingestMarkPrice(payload: BinanceMarkPriceStreamPayload): void {
    if (payload.s !== "BTCUSDT" || !payload.p) {
      return;
    }
    const price = Number(payload.p);
    if (!Number.isFinite(price)) {
      return;
    }
    this.latestMarkPrice = {
      payload: price,
      observedAtMs: payload.E ?? this.now()
    };
    this.latestStreamMarker = `binance-ws-markPrice-${payload.E ?? this.now()}`;
  }

  private ingestKline(payload: BinanceKlineStreamPayload): void {
    if (payload.s !== "BTCUSDT" || !payload.k?.c) {
      return;
    }
    const close = Number(payload.k.c);
    if (!Number.isFinite(close)) {
      return;
    }
    this.latestKlineCloses.push({
      payload: close,
      observedAtMs: payload.E ?? this.now()
    });
    if (this.latestKlineCloses.length > 30) {
      this.latestKlineCloses.splice(0, this.latestKlineCloses.length - 30);
    }
    this.latestStreamMarker = `binance-ws-kline-${payload.E ?? this.now()}`;
  }

  private ingestDepthUpdate(payload: BinanceDepthUpdatePayload): void {
    if (payload.s !== "BTCUSDT" || payload.U === undefined || payload.u === undefined) {
      return;
    }
    if (this.orderBook?.bridgePending) {
      this.applyDepthUpdate(payload, { allowSnapshotBridge: true });
      return;
    }
    if (!this.orderBook || this.orderBook.syncStatus !== "synced") {
      this.depthBuffer.push(payload);
      if (this.depthBuffer.length > 1000) {
        this.depthBuffer.splice(0, this.depthBuffer.length - 1000);
      }
      if (!this.orderBook) {
        this.orderBook = {
          bids: new Map(),
          asks: new Map(),
          syncStatus: "buffering",
          bridgePending: true,
          gapDetected: false,
          observedAtMs: payload.E ?? this.now()
        };
      }
      return;
    }
    this.applyDepthUpdate(payload);
  }

  private applyDepthUpdate(payload: BinanceDepthUpdatePayload, options: { allowSnapshotBridge?: boolean } = {}): void {
    if (!this.orderBook) {
      return;
    }
    const finalUpdateId = requireNumber(payload.u, "depth final update id");
    const firstUpdateId = requireNumber(payload.U, "depth first update id");
    const previousFinalUpdateId = payload.pu;
    if (this.orderBook.lastUpdateId !== undefined && finalUpdateId < this.orderBook.lastUpdateId) {
      return;
    }
    const canBridgeSnapshot = options.allowSnapshotBridge &&
      this.orderBook.lastUpdateId !== undefined &&
      firstUpdateId <= this.orderBook.lastUpdateId &&
      this.orderBook.lastUpdateId <= finalUpdateId;
    if (!canBridgeSnapshot && previousFinalUpdateId !== this.orderBook.previousFinalUpdateId) {
      this.orderBook.syncStatus = "recovering";
      this.orderBook.bridgePending = false;
      this.orderBook.gapDetected = true;
      this.depthBuffer.push(payload);
      return;
    }
    applyPriceLevels(this.orderBook.bids, payload.b);
    applyPriceLevels(this.orderBook.asks, payload.a);
    this.orderBook.lastUpdateId = finalUpdateId;
    this.orderBook.previousFinalUpdateId = finalUpdateId;
    this.orderBook.syncStatus = "synced";
    this.orderBook.bridgePending = false;
    this.orderBook.observedAtMs = payload.E ?? this.now();
    this.latestStreamMarker = `binance-ws-depth-${finalUpdateId}`;
  }

  private async ensureOrderBookRecovered(): Promise<void> {
    if (this.orderBook?.syncStatus === "synced" && isFresh(this.orderBook.observedAtMs, this.now(), this.freshnessMs)) {
      return;
    }
    if (!this.depthRecovery) {
      this.depthRecovery = this.recoverOrderBookFromRest()
        .finally(() => {
          this.depthRecovery = undefined;
        });
    }
    await this.depthRecovery;
  }

  private markOrderBookRecovering(): void {
    if (this.orderBook) {
      this.orderBook.syncStatus = "recovering";
      this.orderBook.bridgePending = false;
      this.orderBook.gapDetected = true;
      this.orderBook.observedAtMs = this.now();
      return;
    }
    this.orderBook = {
      bids: new Map(),
      asks: new Map(),
      syncStatus: "recovering",
      bridgePending: false,
      gapDetected: true,
      observedAtMs: this.now()
    };
  }

  private websocketMarketSnapshot(observedAt: string): MarketSnapshot | undefined {
    if (!this.latestMarkPrice || !isFresh(this.latestMarkPrice.observedAtMs, this.now(), this.freshnessMs)) {
      return undefined;
    }
    const closes = this.latestKlineCloses
      .filter((entry) => isFresh(entry.observedAtMs, this.now(), 30 * 60_000))
      .map((entry) => entry.payload);
    const fallbackClose = this.latestMarkPrice.payload;
    const effectiveCloses = closes.length >= 2 ? closes : [fallbackClose, this.latestMarkPrice.payload];
    const fastAverage = average(effectiveCloses.slice(-Math.min(5, effectiveCloses.length)));
    const slowAverage = average(effectiveCloses);
    return {
      symbol: "BTCUSDT",
      price: this.latestMarkPrice.payload,
      moving_average_fast: roundMarketNumber(fastAverage),
      moving_average_slow: roundMarketNumber(slowAverage),
      volatility: roundMarketNumber(closeVolatility(effectiveCloses)),
      expected_direction: expectedDirection(fastAverage, slowAverage),
      observed_at: observedAt,
      source_kind: "binance_production_public_websocket",
      source_priority: "websocket_primary",
      freshness: "fresh",
      ws_connected: this.anySocketConnected(),
      rest_fallback_used: false,
      gap_detected: this.orderBook?.gapDetected,
      last_update_id: this.orderBook?.lastUpdateId === undefined ? undefined : String(this.orderBook.lastUpdateId),
      stream_marker: this.latestStreamMarker
    };
  }

  private websocketExecutionSnapshot(observedAt: string): PaperTradingPublicExecutionSnapshotSummary | undefined {
    if (!this.latestBookTicker || !isFresh(this.latestBookTicker.observedAtMs, this.now(), this.freshnessMs)) {
      return undefined;
    }
    const freshTrades = this.aggTrades
      .filter((entry) => isFresh(entry.observedAtMs, this.now(), 60_000))
      .map((entry) => entry.payload)
      .slice(-100);
    return {
      symbol: "BTCUSDT",
      observed_at: observedAt,
      source_kind: "binance_production_public_websocket",
      source_priority: "websocket_primary",
      freshness: "fresh",
      ws_connected: this.anySocketConnected(),
      rest_fallback_used: false,
      gap_detected: this.orderBook?.gapDetected,
      last_update_id: this.orderBook?.lastUpdateId === undefined ? undefined : String(this.orderBook.lastUpdateId),
      stream_marker: this.latestStreamMarker,
      book_ticker: this.latestBookTicker.payload,
      agg_trades: freshTrades,
      order_book: this.orderBookSummary(observedAt),
      authority_status: "read_only"
    };
  }

  private orderBookSummary(observedAt: string): PaperTradingOrderBookSummary | undefined {
    if (!this.orderBook) {
      return undefined;
    }
    const topBid = topBidLevel(this.orderBook.bids);
    const topAsk = topAskLevel(this.orderBook.asks);
    return {
      symbol: "BTCUSDT",
      observed_at: observedAt,
      source_kind: this.orderBook.syncStatus === "synced"
        ? "binance_production_public_hybrid"
        : "binance_production_public_websocket",
      sync_status: this.orderBook.syncStatus,
      last_update_id: this.orderBook.lastUpdateId === undefined ? undefined : String(this.orderBook.lastUpdateId),
      previous_final_update_id: this.orderBook.previousFinalUpdateId === undefined
        ? undefined
        : String(this.orderBook.previousFinalUpdateId),
      top_bid_price: topBid?.[0],
      top_bid_quantity: topBid?.[1],
      top_ask_price: topAsk?.[0],
      top_ask_quantity: topAsk?.[1],
      depth_level_count: this.orderBook.bids.size + this.orderBook.asks.size,
      gap_detected: this.orderBook.gapDetected,
      authority_status: "read_only"
    };
  }

  private anySocketConnected(): boolean {
    return this.connected.size > 0 ||
      Array.from(this.sockets.values()).some((socket) => socket.readyState === WebSocket.OPEN);
  }
}

function normalizeWebSocketPayload(raw: unknown): Record<string, unknown> | undefined {
  const parsed = parseWebSocketJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }
  const envelope = parsed as { data?: unknown };
  if (envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)) {
    return envelope.data as Record<string, unknown>;
  }
  return parsed as Record<string, unknown>;
}

function parseWebSocketJson(raw: unknown): unknown {
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }
  if (Buffer.isBuffer(raw)) {
    return JSON.parse(raw.toString("utf8"));
  }
  if (raw instanceof ArrayBuffer) {
    return JSON.parse(Buffer.from(raw).toString("utf8"));
  }
  return raw;
}

function priceLevels(levels?: Array<[string, string]>): Map<string, string> {
  const result = new Map<string, string>();
  for (const [price, quantity] of levels ?? []) {
    if (Number(quantity) > 0) {
      result.set(price, quantity);
    }
  }
  return result;
}

function applyPriceLevels(book: Map<string, string>, levels?: Array<[string, string]>): void {
  for (const [price, quantity] of levels ?? []) {
    if (Number(quantity) <= 0) {
      book.delete(price);
      continue;
    }
    book.set(price, quantity);
  }
}

function topBidLevel(book: Map<string, string>): [string, string] | undefined {
  return Array.from(book.entries()).sort((left, right) => Number(right[0]) - Number(left[0]))[0];
}

function topAskLevel(book: Map<string, string>): [string, string] | undefined {
  return Array.from(book.entries()).sort((left, right) => Number(left[0]) - Number(right[0]))[0];
}

function requireNumber(value: unknown, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Binance public market response is missing ${fieldName}.`);
  }
  return parsed;
}

function isFresh(observedAtMs: number, now: number, freshnessMs: number): boolean {
  return now - observedAtMs <= freshnessMs;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function closeVolatility(closes: number[]): number {
  const returns = closes.slice(1).map((close, index) => {
    const previous = closes[index];
    return previous > 0 ? (close - previous) / previous : 0;
  });
  if (returns.length === 0) {
    return 0;
  }
  const mean = average(returns);
  return Math.sqrt(average(returns.map((value) => (value - mean) ** 2)));
}

function expectedDirection(fastAverage: number, slowAverage: number): MarketSnapshot["expected_direction"] {
  const threshold = Math.max(1, slowAverage * 0.00005);
  if (fastAverage > slowAverage + threshold) {
    return "long";
  }
  if (fastAverage < slowAverage - threshold) {
    return "short";
  }
  return "flat";
}

function roundMarketNumber(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function epochMsToIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}

async function fetchBinancePublicJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance public market request failed: ${response.status}`);
  }
  return await response.json() as T;
}
