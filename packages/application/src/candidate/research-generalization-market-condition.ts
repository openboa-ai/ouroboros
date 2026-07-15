import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchGeneralizationMarketClassifierPolicyDigestInput,
  researchGeneralizationMarketConditionDigestInput,
  researchGeneralizationPublicKlineWindowDigestInput,
  type ResearchGeneralizationMarketClassifierPolicy,
  type ResearchGeneralizationMarketCondition,
  type ResearchGeneralizationMarketConditionBlock,
  type ResearchGeneralizationPublicKline,
  type ResearchGeneralizationPublicKlineWindow,
  type ResearchGeneralizationPublicKlineWindowInput
} from "@ouroboros/domain";

const classifierPolicy: ResearchGeneralizationMarketClassifierPolicy = {
  policy_version: "btc_usdt_closed_kline_direction_v1",
  symbol: "BTCUSDT",
  interval: "1m",
  sample_count: 30,
  fast_mean_sample_count: 5,
  slow_mean_sample_count: 30,
  directional_gap_ratio_threshold: 0.00005,
  observation_boundary_rule: "last_fully_closed_minute_before_observation",
  missing_data_rule: "no_condition_block",
  classifier_digest: pendingDigest()
};
classifierPolicy.classifier_digest = canonicalDigest(
  researchGeneralizationMarketClassifierPolicyDigestInput(classifierPolicy)
);

export const RESEARCH_GENERALIZATION_MARKET_CLASSIFIER_POLICY = Object.freeze(
  classifierPolicy
);

export interface DecideResearchGeneralizationMarketConditionInput {
  publicKlineWindow: ResearchGeneralizationPublicKlineWindowInput;
  classifiedAt: string;
}

export class ResearchGeneralizationMarketConditionDecisionError extends Error {
  readonly code = "invalid_research_generalization_market_condition_input";

  constructor() {
    super("ResearchGeneralization market-condition input is invalid.");
    this.name = "ResearchGeneralizationMarketConditionDecisionError";
  }
}

export function decideResearchGeneralizationMarketCondition(
  input: DecideResearchGeneralizationMarketConditionInput
): ResearchGeneralizationMarketCondition {
  try {
    const window = sealPublicKlineWindow(input?.publicKlineWindow);
    const classifiedAt = canonicalTime(input?.classifiedAt);
    if (Date.parse(classifiedAt) < Date.parse(window.observed_at)) {
      throw invalidDecision();
    }
    const closes = window.klines.map((kline) => Number(kline.close_price));
    const fastMean = roundedMean(
      closes.slice(-RESEARCH_GENERALIZATION_MARKET_CLASSIFIER_POLICY
        .fast_mean_sample_count)
    );
    const slowMean = roundedMean(closes);
    const directionalGapRatio = roundMarketFeature(
      (fastMean - slowMean) / slowMean
    );
    const condition: ResearchGeneralizationMarketCondition = {
      classifier_policy: { ...RESEARCH_GENERALIZATION_MARKET_CLASSIFIER_POLICY },
      public_kline_window: window,
      fast_mean: fastMean,
      slow_mean: slowMean,
      directional_gap_ratio: directionalGapRatio,
      condition_block: conditionBlock(directionalGapRatio),
      classified_at: classifiedAt,
      classification_digest: pendingDigest(),
      evaluation_authority: false,
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "public_evidence_only"
    };
    condition.classification_digest = canonicalDigest(
      researchGeneralizationMarketConditionDigestInput(condition)
    );
    return condition;
  } catch (error) {
    if (error instanceof ResearchGeneralizationMarketConditionDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function researchGeneralizationMarketConditionHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationMarketCondition {
  try {
    if (!value || typeof value !== "object") return false;
    const condition = value as ResearchGeneralizationMarketCondition;
    const { window_digest: _windowDigest, ...windowInput } =
      condition.public_kline_window;
    const decided = decideResearchGeneralizationMarketCondition({
      publicKlineWindow: windowInput,
      classifiedAt: condition.classified_at
    });
    return isDeepStrictEqual(condition, decided);
  } catch {
    return false;
  }
}

function sealPublicKlineWindow(
  input: ResearchGeneralizationPublicKlineWindowInput
): ResearchGeneralizationPublicKlineWindow {
  if (!input || input.symbol !== "BTCUSDT" || input.interval !== "1m" ||
    input.sample_count !== 30 || input.authority_status !== "read_only" ||
    !Array.isArray(input.klines) || input.klines.length !== 30) {
    throw invalidDecision();
  }
  const observedAt = canonicalTime(input.observed_at);
  const closedWindowEndAt = canonicalTime(input.closed_window_end_at);
  const observedEpoch = Date.parse(observedAt);
  const expectedEndEpoch = Math.floor(observedEpoch / 60_000) * 60_000 - 1;
  if (Date.parse(closedWindowEndAt) !== expectedEndEpoch) {
    throw invalidDecision();
  }
  const source = canonicalSource(input.source);
  const firstOpenEpoch = expectedEndEpoch + 1 - 30 * 60_000;
  const klines = input.klines.map((kline, index) => canonicalKline(
    kline,
    firstOpenEpoch + index * 60_000
  ));
  const window: ResearchGeneralizationPublicKlineWindow = {
    symbol: "BTCUSDT",
    interval: "1m",
    sample_count: 30,
    observed_at: observedAt,
    closed_window_end_at: closedWindowEndAt,
    source,
    klines,
    authority_status: "read_only",
    window_digest: pendingDigest()
  };
  window.window_digest = canonicalDigest(
    researchGeneralizationPublicKlineWindowDigestInput(window)
  );
  return window;
}

function canonicalSource(
  value: ResearchGeneralizationPublicKlineWindowInput["source"]
): ResearchGeneralizationPublicKlineWindowInput["source"] {
  if (!value ||
    value.provider_kind !== "binance_production_public_market_data" ||
    value.source_kind !== "binance_production_public_rest" ||
    value.endpoint !== "/fapi/v1/klines" ||
    value.authority_status !== "read_only") {
    throw invalidDecision();
  }
  let restBaseUrl: URL;
  try {
    restBaseUrl = new URL(value.rest_base_url);
  } catch {
    throw invalidDecision();
  }
  if (restBaseUrl.protocol !== "https:" || restBaseUrl.username ||
    restBaseUrl.password || restBaseUrl.search || restBaseUrl.hash ||
    (restBaseUrl.pathname !== "/" && restBaseUrl.pathname !== "")) {
    throw invalidDecision();
  }
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_rest",
    rest_base_url: restBaseUrl.origin,
    endpoint: "/fapi/v1/klines",
    authority_status: "read_only"
  };
}

function canonicalKline(
  value: ResearchGeneralizationPublicKline,
  expectedOpenEpoch: number
): ResearchGeneralizationPublicKline {
  if (!value || typeof value !== "object") throw invalidDecision();
  const openTime = canonicalTime(value.open_time);
  const closeTime = canonicalTime(value.close_time);
  const closePrice = canonicalPositiveDecimal(value.close_price);
  if (Date.parse(openTime) !== expectedOpenEpoch ||
    Date.parse(closeTime) !== expectedOpenEpoch + 59_999) {
    throw invalidDecision();
  }
  return {
    open_time: openTime,
    close_time: closeTime,
    close_price: closePrice
  };
}

function conditionBlock(
  directionalGapRatio: number
): ResearchGeneralizationMarketConditionBlock {
  const threshold = RESEARCH_GENERALIZATION_MARKET_CLASSIFIER_POLICY
    .directional_gap_ratio_threshold;
  if (directionalGapRatio > threshold) return "long";
  if (directionalGapRatio < -threshold) return "short";
  return "flat";
}

function roundedMean(values: number[]): number {
  if (values.length === 0 || values.some((value) =>
    !Number.isFinite(value) || value <= 0
  )) {
    throw invalidDecision();
  }
  return roundMarketFeature(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

function roundMarketFeature(value: number): number {
  if (!Number.isFinite(value)) throw invalidDecision();
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function canonicalPositiveDecimal(value: unknown): string {
  if (typeof value !== "string" ||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ||
    !Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw invalidDecision();
  }
  return value;
}

function canonicalTime(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw invalidDecision();
  }
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== value) {
    throw invalidDecision();
  }
  return value;
}

function canonicalDigest(value: unknown): string {
  const text = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function pendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function invalidDecision(): ResearchGeneralizationMarketConditionDecisionError {
  return new ResearchGeneralizationMarketConditionDecisionError();
}
