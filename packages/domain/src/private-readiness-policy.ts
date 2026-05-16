import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  PrivateReadinessPreflightGate,
  PrivateReadinessPreflightSurfaceReadModel,
  Ref,
  TradingSubstrateInstrument,
  TradingSubstrateProductCategory,
  TradingSubstrateVenue
} from "./index";

export const PRIVATE_READINESS_POLICY_BINANCE_SECURITY_TYPES = [
  "USER_DATA",
  "USER_STREAM",
  "TRADE"
] as const;

export type PrivateReadinessPolicyBinanceSecurityType =
  (typeof PRIVATE_READINESS_POLICY_BINANCE_SECURITY_TYPES)[number];

export const PRIVATE_READINESS_POLICY_DIMENSIONS = [
  "configuration",
  "operator_approval",
  "jurisdiction_risk",
  "live_binding",
  "secret_handling",
  "account_position_freshness",
  "kill_switch",
  "stop_behavior",
  "listen_key",
  "user_data_stream",
  "trade_authority"
] as const;

export type PrivateReadinessPolicyDimension = (typeof PRIVATE_READINESS_POLICY_DIMENSIONS)[number];

export type PrivateReadinessPolicyDecisionStatus =
  | "ready"
  | "not_ready"
  | "blocked"
  | "review_required";

export type PrivateReadinessPolicyReasonCode =
  | "ready"
  | "configuration_not_ready"
  | "configuration_blocked"
  | "operator_approval_missing"
  | "operator_approval_blocked"
  | "jurisdiction_review_required"
  | "jurisdiction_blocked"
  | "risk_limit_breach"
  | "live_binding_not_ready"
  | "live_binding_blocked"
  | "secret_handling_not_ready"
  | "secret_handling_blocked"
  | "account_position_freshness_not_ready"
  | "kill_switch_active"
  | "stop_behavior_not_ready"
  | "stop_behavior_blocked"
  | "listen_key_not_ready"
  | "user_data_stream_not_ready"
  | "private_account_read_not_ready"
  | "private_position_read_not_ready"
  | "trade_authority_scope_expanded"
  | "authority_boundary_expanded"
  | "no_private_read_performed";

export interface PrivateReadinessPolicyGateInput {
  status: PrivateReadinessPolicyDecisionStatus;
  reason: string;
}

export interface PrivateReadinessPolicyEvaluationInput {
  evaluated_at: string;
  private_readiness_preflight_surface: PrivateReadinessPreflightSurfaceReadModel;
  account_position_risk_mirror_surface?: AccountPositionRiskMirrorSurfaceReadModel | null;
  operator_approval_gate?: PrivateReadinessPolicyGateInput;
  jurisdiction_risk_gate?: PrivateReadinessPolicyGateInput;
  live_binding_gate: PrivateReadinessPolicyGateInput;
  secret_handling_gate: PrivateReadinessPolicyGateInput;
  stop_behavior_gate: PrivateReadinessPolicyGateInput;
}

export interface PrivateReadinessPolicyCheck {
  dimension: PrivateReadinessPolicyDimension;
  status: PrivateReadinessPolicyDecisionStatus;
  reason_code: PrivateReadinessPolicyReasonCode;
  reason: string;
}

export interface PrivateReadinessPolicyDecision {
  decision_kind: "private_readiness_policy_decision";
  status: PrivateReadinessPolicyDecisionStatus;
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  evaluated_at: string;
  source_surface_refs: Ref[];
  checked_gates: PrivateReadinessPolicyCheck[];
  reason_codes: PrivateReadinessPolicyReasonCode[];
  blocking_conditions: string[];
  required_next_actions: string[];
  binance_security_types: PrivateReadinessPolicyBinanceSecurityType[];
  no_private_read_performed: true;
  signed_request_authority: false;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export function evaluatePrivateReadinessPolicyDecision(
  input: PrivateReadinessPolicyEvaluationInput
): PrivateReadinessPolicyDecision {
  const privateSurface = input.private_readiness_preflight_surface;
  const accountSurface = input.account_position_risk_mirror_surface ?? null;
  const checked_gates: PrivateReadinessPolicyCheck[] = [];
  const reasonCodeSet = new Set<PrivateReadinessPolicyReasonCode>();
  const blocking_conditions: string[] = [];
  const requiredNextActions = new Set<string>();
  let hasBlocked = false;
  let hasNotReady = false;
  let hasReviewRequired = false;

  const addCheck = (
    dimension: PrivateReadinessPolicyDimension,
    status: PrivateReadinessPolicyDecisionStatus,
    reason_code: PrivateReadinessPolicyReasonCode,
    reason: string
  ) => {
    checked_gates.push({
      dimension,
      status,
      reason_code,
      reason
    });
    if (status !== "ready") {
      reasonCodeSet.add(reason_code);
      blocking_conditions.push(`${dimension}: ${reason}`);
    }
    if (status === "blocked") {
      hasBlocked = true;
    } else if (status === "not_ready") {
      hasNotReady = true;
    } else if (status === "review_required") {
      hasReviewRequired = true;
    }
  };

  const addAuxiliaryReason = (reason_code: PrivateReadinessPolicyReasonCode, condition: string) => {
    reasonCodeSet.add(reason_code);
    blocking_conditions.push(condition);
    hasNotReady = true;
  };

  const gateReady = (gate: PrivateReadinessPreflightGate): boolean =>
    gate.status === "ready" && gate.enabled === true;

  const gateBlocked = (gate: PrivateReadinessPreflightGate): boolean =>
    gate.status === "blocked";

  const addGateCheck = (
    dimension: PrivateReadinessPolicyDimension,
    gate: PrivateReadinessPreflightGate,
    notReadyCode: PrivateReadinessPolicyReasonCode,
    blockedCode: PrivateReadinessPolicyReasonCode
  ) => {
    if (gateReady(gate)) {
      addCheck(dimension, "ready", "ready", gate.reason);
    } else if (gateBlocked(gate)) {
      addCheck(dimension, "blocked", blockedCode, gate.reason);
    } else {
      const status: PrivateReadinessPolicyDecisionStatus =
        gate.status === "not_evaluated" ? "review_required" : "not_ready";
      addCheck(dimension, status, notReadyCode, gate.reason);
    }
  };

  addGateCheck(
    "configuration",
    privateSurface.credential_gate,
    "configuration_not_ready",
    "configuration_blocked"
  );
  if (input.operator_approval_gate) {
    addPolicyGateInputCheck("operator_approval", input.operator_approval_gate);
  } else {
    addGateCheck(
      "operator_approval",
      privateSurface.operator_approval_gate,
      "operator_approval_missing",
      "operator_approval_blocked"
    );
  }

  if (input.jurisdiction_risk_gate) {
    addJurisdictionRiskPolicyGateInputCheck(input.jurisdiction_risk_gate);
  } else {
    if (gateReady(privateSurface.jurisdiction_gate)) {
      if (accountSurface?.risk_status === "breach") {
        addCheck("jurisdiction_risk", "blocked", "risk_limit_breach", "risk_status=breach");
      } else {
        addCheck("jurisdiction_risk", "ready", "ready", privateSurface.jurisdiction_gate.reason);
      }
    } else if (gateBlocked(privateSurface.jurisdiction_gate)) {
      addCheck("jurisdiction_risk", "blocked", "jurisdiction_blocked", privateSurface.jurisdiction_gate.reason);
    } else {
      addCheck(
        "jurisdiction_risk",
        "review_required",
        "jurisdiction_review_required",
        privateSurface.jurisdiction_gate.reason
      );
    }
  }

  addPolicyGateInputCheck("live_binding", input.live_binding_gate);
  addPolicyGateInputCheck("secret_handling", input.secret_handling_gate);

  if (accountSurface && accountSurface.freshness === "fresh" && accountSurface.liveness === "connected") {
    addCheck(
      "account_position_freshness",
      "ready",
      "ready",
      `${accountSurface.freshness}/${accountSurface.liveness}`
    );
  } else {
    const reason = accountSurface
      ? accountSurface.degraded_reason ?? `${accountSurface.freshness}/${accountSurface.liveness}`
      : "account_position_risk_mirror_surface_missing";
    addCheck(
      "account_position_freshness",
      "not_ready",
      "account_position_freshness_not_ready",
      reason
    );
  }

  if (accountSurface?.kill_switch_status === "active") {
    addCheck("kill_switch", "blocked", "kill_switch_active", "active");
  } else {
    addCheck("kill_switch", "ready", "ready", accountSurface?.kill_switch_status ?? "not_recorded");
  }

  addPolicyGateInputCheck("stop_behavior", input.stop_behavior_gate);

  if (gateReady(privateSurface.listen_key_gate)) {
    addCheck("listen_key", "ready", "ready", privateSurface.listen_key_gate.reason);
  } else {
    addCheck("listen_key", "not_ready", "listen_key_not_ready", privateSurface.listen_key_gate.reason);
  }

  if (gateReady(privateSurface.user_data_stream_gate)) {
    addCheck("user_data_stream", "ready", "ready", privateSurface.user_data_stream_gate.reason);
  } else {
    addCheck(
      "user_data_stream",
      "not_ready",
      "user_data_stream_not_ready",
      privateSurface.user_data_stream_gate.reason
    );
  }

  if (!gateReady(privateSurface.private_account_read_gate)) {
    addAuxiliaryReason(
      "private_account_read_not_ready",
      `configuration: ${privateSurface.private_account_read_gate.reason}`
    );
  }
  if (!gateReady(privateSurface.private_position_read_gate)) {
    addAuxiliaryReason(
      "private_position_read_not_ready",
      `configuration: ${privateSurface.private_position_read_gate.reason}`
    );
  }

  if (
    privateSurface.order_submission_gate.enabled ||
    privateSurface.order_submission_gate.status === "ready" ||
    privateSurface.leverage_or_margin_mutation_gate.enabled ||
    privateSurface.leverage_or_margin_mutation_gate.status === "ready"
  ) {
    addCheck(
      "trade_authority",
      "blocked",
      "trade_authority_scope_expanded",
      privateSurface.order_submission_gate.enabled || privateSurface.order_submission_gate.status === "ready"
        ? privateSurface.order_submission_gate.reason
        : privateSurface.leverage_or_margin_mutation_gate.reason
    );
  } else {
    addCheck("trade_authority", "ready", "ready", "TRADE authority disabled for private-read readiness");
  }

  if (
    privateSurface.no_authority.live_exchange !== false ||
    privateSurface.no_authority.order_submission !== false ||
    privateSurface.no_authority.credentials !== false ||
    (accountSurface !== null &&
      (accountSurface.no_authority.live_exchange !== false ||
        accountSurface.no_authority.order_submission !== false ||
        accountSurface.no_authority.credentials !== false))
  ) {
    reasonCodeSet.add("authority_boundary_expanded");
    blocking_conditions.push("authority: no_authority boundary expanded");
    hasBlocked = true;
  }

  const addNextAction = (action: string | undefined) => {
    if (action && action !== "none") {
      requiredNextActions.add(action);
    }
  };
  addNextAction(privateSurface.next_blocked_action);
  addNextAction(accountSurface?.next_blocked_action);
  for (const check of checked_gates) {
    if (check.status !== "ready") {
      requiredNextActions.add(check.dimension);
    }
  }

  reasonCodeSet.add("no_private_read_performed");

  return {
    decision_kind: "private_readiness_policy_decision",
    status: hasBlocked
      ? "blocked"
      : hasNotReady
        ? "not_ready"
        : hasReviewRequired
          ? "review_required"
          : "ready",
    venue: privateSurface.venue,
    instrument: privateSurface.instrument,
    product_category: privateSurface.product_category,
    evaluated_at: input.evaluated_at,
    source_surface_refs: [
      {
        record_kind: "private_readiness_preflight_surface",
        id: privateSurface.surface_id
      },
      ...(accountSurface
        ? [
            {
              record_kind: "account_position_risk_mirror_surface",
              id: accountSurface.surface_id
            }
          ]
        : [])
    ],
    checked_gates,
    reason_codes: [...reasonCodeSet],
    blocking_conditions,
    required_next_actions: [...requiredNextActions],
    binance_security_types: [...PRIVATE_READINESS_POLICY_BINANCE_SECURITY_TYPES],
    no_private_read_performed: true,
    signed_request_authority: false,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };

  function addPolicyGateInputCheck(
    dimension: "operator_approval" | "live_binding" | "secret_handling" | "stop_behavior",
    gate: PrivateReadinessPolicyGateInput
  ) {
    const reasonCodeByDimension = {
      operator_approval: {
        notReady: "operator_approval_missing",
        blocked: "operator_approval_blocked"
      },
      live_binding: {
        notReady: "live_binding_not_ready",
        blocked: "live_binding_blocked"
      },
      secret_handling: {
        notReady: "secret_handling_not_ready",
        blocked: "secret_handling_blocked"
      },
      stop_behavior: {
        notReady: "stop_behavior_not_ready",
        blocked: "stop_behavior_blocked"
      }
    } as const;
    if (gate.status === "ready") {
      addCheck(dimension, "ready", "ready", gate.reason);
    } else if (gate.status === "blocked") {
      addCheck(dimension, "blocked", reasonCodeByDimension[dimension].blocked, gate.reason);
    } else if (gate.status === "review_required") {
      addCheck(dimension, "review_required", reasonCodeByDimension[dimension].notReady, gate.reason);
    } else {
      addCheck(dimension, "not_ready", reasonCodeByDimension[dimension].notReady, gate.reason);
    }
  }

  function addJurisdictionRiskPolicyGateInputCheck(gate: PrivateReadinessPolicyGateInput) {
    if (gate.status === "ready") {
      if (accountSurface?.risk_status === "breach") {
        addCheck("jurisdiction_risk", "blocked", "risk_limit_breach", "risk_status=breach");
      } else {
        addCheck("jurisdiction_risk", "ready", "ready", gate.reason);
      }
    } else if (gate.status === "blocked") {
      addCheck("jurisdiction_risk", "blocked", "jurisdiction_blocked", gate.reason);
    } else if (gate.status === "review_required") {
      addCheck("jurisdiction_risk", "review_required", "jurisdiction_review_required", gate.reason);
    } else {
      addCheck("jurisdiction_risk", "not_ready", "jurisdiction_review_required", gate.reason);
    }
  }
}
