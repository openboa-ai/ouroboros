import type { PrivateReadinessPolicyDecision } from "./private-readiness-policy";

export type PrivateReadGateDecisionStatus =
  | "not_ready"
  | "review_required"
  | "blocked"
  | "ready_but_disabled";

export type PrivateReadGateCredentialReferenceStatus =
  | "not_configured"
  | "review_required"
  | "blocked"
  | "reference_only";

export type PrivateReadGateAuthorityStatus = "not_granted";

export type PrivateReadGateEvidenceStatus = "not_counted";

export type PrivateReadGateReasonCode =
  | PrivateReadinessPolicyDecision["reason_codes"][number]
  | "private_read_gate_not_ready"
  | "private_read_gate_review_required"
  | "private_read_gate_blocked"
  | "private_read_gate_ready_but_disabled";

export interface PrivateReadGateDecision {
  decision_kind: "private_read_gate_decision";
  status: PrivateReadGateDecisionStatus;
  policy_status: PrivateReadinessPolicyDecision["status"];
  venue: PrivateReadinessPolicyDecision["venue"];
  instrument: PrivateReadinessPolicyDecision["instrument"];
  product_category: PrivateReadinessPolicyDecision["product_category"];
  evaluated_at: string;
  source_surface_refs: PrivateReadinessPolicyDecision["source_surface_refs"];
  credential_reference_status: PrivateReadGateCredentialReferenceStatus;
  signed_read_permission: PrivateReadGateAuthorityStatus;
  account_balance_position_read_authority: PrivateReadGateAuthorityStatus;
  listen_key_user_data_stream_authority: PrivateReadGateAuthorityStatus;
  leverage_margin_mutation_authority: PrivateReadGateAuthorityStatus;
  order_submission_authority: PrivateReadGateAuthorityStatus;
  gateway_decision_authority: PrivateReadGateAuthorityStatus;
  evidence_sealing_authority: PrivateReadGateEvidenceStatus;
  promotion_authority: PrivateReadGateAuthorityStatus;
  reason_codes: PrivateReadGateReasonCode[];
  blocking_conditions: string[];
  required_next_actions: string[];
  binance_security_types: PrivateReadinessPolicyDecision["binance_security_types"];
  raw_secret_material_present: false;
  no_private_read_performed: true;
  signed_request_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export interface PrivateReadGateEvaluationInput {
  evaluated_at: string;
  policy_decision: PrivateReadinessPolicyDecision;
}

export function evaluatePrivateReadGateDecision(
  input: PrivateReadGateEvaluationInput
): PrivateReadGateDecision {
  const policyDecision = input.policy_decision;
  const status = mapPolicyStatus(policyDecision.status);
  const gateReasonCode = mapGateReasonCode(status);
  const requiredNextActions = new Set(policyDecision.required_next_actions);

  if (status === "ready_but_disabled") {
    requiredNextActions.add("grant_signed_read_authority_before_private_user_data_reads");
  }

  return {
    decision_kind: "private_read_gate_decision",
    status,
    policy_status: policyDecision.status,
    venue: policyDecision.venue,
    instrument: policyDecision.instrument,
    product_category: policyDecision.product_category,
    evaluated_at: input.evaluated_at,
    source_surface_refs: policyDecision.source_surface_refs,
    credential_reference_status: credentialReferenceStatus(policyDecision),
    signed_read_permission: "not_granted",
    account_balance_position_read_authority: "not_granted",
    listen_key_user_data_stream_authority: "not_granted",
    leverage_margin_mutation_authority: "not_granted",
    order_submission_authority: "not_granted",
    gateway_decision_authority: "not_granted",
    evidence_sealing_authority: "not_counted",
    promotion_authority: "not_granted",
    reason_codes: uniqueReasonCodes([...policyDecision.reason_codes, gateReasonCode, "no_private_read_performed"]),
    blocking_conditions: policyDecision.blocking_conditions,
    required_next_actions: [...requiredNextActions],
    binance_security_types: policyDecision.binance_security_types,
    raw_secret_material_present: false,
    no_private_read_performed: true,
    signed_request_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function mapPolicyStatus(
  status: PrivateReadinessPolicyDecision["status"]
): PrivateReadGateDecisionStatus {
  if (status === "ready") {
    return "ready_but_disabled";
  }
  return status;
}

function mapGateReasonCode(status: PrivateReadGateDecisionStatus): PrivateReadGateReasonCode {
  if (status === "ready_but_disabled") {
    return "private_read_gate_ready_but_disabled";
  }
  if (status === "review_required") {
    return "private_read_gate_review_required";
  }
  if (status === "blocked") {
    return "private_read_gate_blocked";
  }
  return "private_read_gate_not_ready";
}

function credentialReferenceStatus(
  decision: PrivateReadinessPolicyDecision
): PrivateReadGateCredentialReferenceStatus {
  const configurationGate = decision.checked_gates.find((gate) => gate.dimension === "configuration");
  if (configurationGate?.status === "blocked") {
    return "blocked";
  }
  if (configurationGate?.status === "review_required") {
    return "review_required";
  }
  if (configurationGate?.status === "not_ready") {
    return "not_configured";
  }
  return "reference_only";
}

function uniqueReasonCodes(reasonCodes: PrivateReadGateReasonCode[]): PrivateReadGateReasonCode[] {
  return [...new Set(reasonCodes)];
}
