import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationHasRuntimeShape,
  paperTradingComparisonActivationPolicyFor,
  paperTradingComparisonActivationPolicyHasRuntimeShape,
  paperTradingComparisonActivationSideHasRuntimeShape,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonActivationSide,
  type PaperTradingComparisonPolicy
} from "./index";

describe("PaperTradingComparisonActivation", () => {
  it("derives one bounded activation policy from the comparison policy", () => {
    expect(paperTradingComparisonActivationPolicyFor(comparisonPolicy())).toEqual({
      policy_version: "paper-comparison-activation-v1",
      maximum_start_skew_ms: 5_000,
      maximum_retry_count_per_side: 3,
      maximum_provider_request_count_per_side: 500,
      maximum_activation_elapsed_ms: 60_000,
      cleanup_timeout_ms: 10_000,
      require_both_running_before_observation: true,
      partial_start_policy: "stop_started_side_before_retry",
      restart_policy: "recover_both_or_stop_both",
      market_view_policy: "first_tick_then_contiguous_persisted_ticks"
    });
  });

  it("canonically binds authorization evidence but excludes record metadata and server time", () => {
    const activation = validActivation();
    const reordered = {
      authority_status: activation.authority_status,
      credentials_access: activation.credentials_access,
      private_exchange_access: activation.private_exchange_access,
      order_submission_authority: activation.order_submission_authority,
      live_exchange_authority: activation.live_exchange_authority,
      activation_digest: activation.activation_digest,
      authorized_at: activation.authorized_at,
      activation_status: activation.activation_status,
      activation_scope: activation.activation_scope,
      activation_policy: { ...activation.activation_policy },
      market_data_configuration_digest: activation.market_data_configuration_digest,
      challenger: { ...activation.challenger },
      champion: { ...activation.champion },
      first_tick_digest: activation.first_tick_digest,
      first_tick_ref: { ...activation.first_tick_ref },
      paper_trading_comparison_commitment_digest:
        activation.paper_trading_comparison_commitment_digest,
      paper_trading_comparison_commitment_ref: {
        ...activation.paper_trading_comparison_commitment_ref
      },
      paper_trading_comparison_activation_id:
        activation.paper_trading_comparison_activation_id,
      version: activation.version,
      record_kind: activation.record_kind
    } satisfies PaperTradingComparisonActivationRecord;

    expect(paperTradingComparisonActivationDigestInput(reordered)).toBe(
      paperTradingComparisonActivationDigestInput(activation)
    );
    expect(paperTradingComparisonActivationDigestInput({
      ...activation,
      paper_trading_comparison_activation_id: "different-id",
      authorized_at: "2026-07-11T00:00:03.000Z",
      activation_digest: "sha256:different"
    })).toBe(paperTradingComparisonActivationDigestInput(activation));

    const mutations: PaperTradingComparisonActivationRecord[] = [
      { ...activation, paper_trading_comparison_commitment_digest: "sha256:changed" },
      { ...activation, first_tick_digest: "sha256:changed" },
      { ...activation, market_data_configuration_digest: "sha256:changed" },
      {
        ...activation,
        challenger: {
          ...activation.challenger,
          trading_run_ref: { record_kind: "trading_run", id: "changed" }
        }
      },
      {
        ...activation,
        activation_policy: {
          ...activation.activation_policy,
          maximum_start_skew_ms: 6_000
        }
      },
      {
        ...activation,
        activation_scope: "different_scope"
      } as unknown as PaperTradingComparisonActivationRecord,
      {
        ...activation,
        live_exchange_authority: true
      } as unknown as PaperTradingComparisonActivationRecord
    ];
    expect(mutations.map(paperTradingComparisonActivationDigestInput))
      .not.toContain(paperTradingComparisonActivationDigestInput(activation));
  });

  it("accepts one complete paper-only authorization", () => {
    const activation = validActivation();
    expect(paperTradingComparisonActivationSideHasRuntimeShape(
      activation.champion,
      "champion"
    )).toBe(true);
    expect(paperTradingComparisonActivationPolicyHasRuntimeShape(
      activation.activation_policy
    )).toBe(true);
    expect(paperTradingComparisonActivationHasRuntimeShape(activation)).toBe(true);
  });

  it.each([
    ["null", () => null],
    ["null champion", (record: any) => {
      record.champion = null;
      return record;
    }],
    ["null trading run ref", (record: any) => {
      record.champion.trading_run_ref = null;
      return record;
    }],
    ["null activation policy", (record: any) => {
      record.activation_policy = null;
      return record;
    }],
    ["wrong champion role", (record: any) => {
      record.champion.role = "challenger";
      return record;
    }],
    ["duplicate run", (record: any) => {
      record.challenger.trading_run_ref = record.champion.trading_run_ref;
      return record;
    }],
    ["duplicate commitment", (record: any) => {
      record.challenger.paper_trading_evaluation_commitment_ref =
        record.champion.paper_trading_evaluation_commitment_ref;
      return record;
    }],
    ["duplicate evaluation", (record: any) => {
      record.challenger.paper_trading_evaluation_ref =
        record.champion.paper_trading_evaluation_ref;
      return record;
    }],
    ["negative start skew", (record: any) => {
      record.activation_policy.maximum_start_skew_ms = -1;
      return record;
    }],
    ["negative retry count", (record: any) => {
      record.activation_policy.maximum_retry_count_per_side = -1;
      return record;
    }],
    ["zero request budget", (record: any) => {
      record.activation_policy.maximum_provider_request_count_per_side = 0;
      return record;
    }],
    ["wrong policy version", (record: any) => {
      record.activation_policy.policy_version = "paper-comparison-activation-v2";
      return record;
    }],
    ["activation elapsed drift", (record: any) => {
      record.activation_policy.maximum_activation_elapsed_ms = 59_999;
      return record;
    }],
    ["cleanup timeout drift", (record: any) => {
      record.activation_policy.cleanup_timeout_ms = 9_999;
      return record;
    }],
    ["observation before both running", (record: any) => {
      record.activation_policy.require_both_running_before_observation = false;
      return record;
    }],
    ["wrong partial start policy", (record: any) => {
      record.activation_policy.partial_start_policy = "continue_one_side";
      return record;
    }],
    ["wrong restart policy", (record: any) => {
      record.activation_policy.restart_policy = "recover_one_side";
      return record;
    }],
    ["wrong market view policy", (record: any) => {
      record.activation_policy.market_view_policy = "direct_binance_reads";
      return record;
    }],
    ["wrong scope", (record: any) => {
      record.activation_scope = "live_pair";
      return record;
    }],
    ["wrong status", (record: any) => {
      record.activation_status = "started";
      return record;
    }],
    ["non-ISO authorization time", (record: any) => {
      record.authorized_at = "not-a-time";
      return record;
    }],
    ["live authority", (record: any) => {
      record.live_exchange_authority = true;
      return record;
    }],
    ["order authority", (record: any) => {
      record.order_submission_authority = true;
      return record;
    }],
    ["private access", (record: any) => {
      record.private_exchange_access = "allowed";
      return record;
    }],
    ["credential access", (record: any) => {
      record.credentials_access = "allowed";
      return record;
    }],
    ["live record authority", (record: any) => {
      record.authority_status = "live";
      return record;
    }]
  ])("returns false without throwing for %s", (_label, mutate) => {
    const malformed = mutate(structuredClone(validActivation()));
    expect(() => paperTradingComparisonActivationHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonActivationHasRuntimeShape(malformed)).toBe(false);
  });
});

function comparisonPolicy(): PaperTradingComparisonPolicy {
  return {
    policy_version: "paper-comparison-v1",
    comparison_mode: "champion_challenge",
    symbol: "BTCUSDT",
    interval_ms: 60_000,
    minimum_observation_count: 30,
    minimum_elapsed_ms: 1_800_000,
    maximum_observation_count: 120,
    maximum_elapsed_ms: 7_200_000,
    maximum_start_skew_ms: 5_000,
    maximum_provider_request_count_per_side: 500,
    maximum_retry_count_per_side: 3,
    primary_metric: "net_revenue_usdt",
    minimum_net_revenue_lift_usdt: 10,
    required_confirmation_count: 2,
    require_non_overlapping_windows: true,
    require_both_qualified: true,
    release_policy: "sealed_until_adjudication"
  };
}

function validActivation(): PaperTradingComparisonActivationRecord {
  return {
    record_kind: "paper_trading_comparison_activation",
    version: 1,
    paper_trading_comparison_activation_id: "paper-comparison-activation-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "paper-comparison-001"
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison",
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "paper-comparison-tick-001"
    },
    first_tick_digest: "sha256:tick",
    champion: side("champion"),
    challenger: side("challenger"),
    market_data_configuration_digest: "sha256:market",
    activation_policy: paperTradingComparisonActivationPolicyFor(comparisonPolicy()),
    activation_scope: "qualification_pair",
    activation_status: "authorized",
    authorized_at: "2026-07-11T00:00:02.000Z",
    activation_digest: "sha256:activation",
    live_exchange_authority: false,
    order_submission_authority: false,
    private_exchange_access: "forbidden",
    credentials_access: "forbidden",
    authority_status: "not_live"
  };
}

function side(
  role: "champion" | "challenger"
): PaperTradingComparisonActivationSide {
  return {
    role,
    trading_run_ref: { record_kind: "trading_run", id: `${role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${role}-commitment`
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-evaluation`
    }
  };
}
