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

export type PrivateReadGateCredentialReferenceSource =
  | "policy_configuration_gate"
  | "private_readiness_posture";

export type PrivateReadGateAuthorityStatus = "not_granted";

export type PrivateReadGateEvidenceStatus = "not_counted";

export type PrivateReadGateSignedReadPermissionPreflightStatus =
  | "not_requested"
  | "preflight_only";

export type PrivateReadGateSignedReadPermissionPreflightSource = "policy_decision";

export type PrivateReadGateSignedRequestConstructionBoundaryStatus =
  | "not_requested"
  | "dry_run_only";

export type PrivateReadGateSignedRequestConstructionBoundarySource = "policy_decision";

export type PrivateReadGateSignedRequestConstructionRequiredComponent =
  | "API key"
  | "timestamp"
  | "recvWindow"
  | "query string"
  | "signature"
  | "signed endpoint";

export type PrivateReadGateReasonCode =
  | PrivateReadinessPolicyDecision["reason_codes"][number]
  | "credential_reference_only"
  | "signed_read_permission_preflight_only"
  | "signed_request_construction_boundary_only"
  | "private_read_gate_not_ready"
  | "private_read_gate_review_required"
  | "private_read_gate_blocked"
  | "private_read_gate_ready_but_disabled";

export interface PrivateReadGateCredentialReferenceInput {
  configured: boolean;
  ref?: PrivateReadinessPolicyDecision["source_surface_refs"][number];
  raw_secret_material_present: false;
  source: PrivateReadGateCredentialReferenceSource;
}

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
  credential_reference_source: PrivateReadGateCredentialReferenceSource;
  credential_reference_ref?: PrivateReadinessPolicyDecision["source_surface_refs"][number];
  signed_read_permission_preflight_status: PrivateReadGateSignedReadPermissionPreflightStatus;
  signed_read_permission_preflight_source: PrivateReadGateSignedReadPermissionPreflightSource;
  signed_request_construction_boundary_status: PrivateReadGateSignedRequestConstructionBoundaryStatus;
  signed_request_construction_boundary_source: PrivateReadGateSignedRequestConstructionBoundarySource;
  signed_request_construction_required_components: PrivateReadGateSignedRequestConstructionRequiredComponent[];
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
  credential_reference?: PrivateReadGateCredentialReferenceInput;
}

export function evaluatePrivateReadGateDecision(
  input: PrivateReadGateEvaluationInput
): PrivateReadGateDecision {
  const policyDecision = input.policy_decision;
  const status = mapPolicyStatus(policyDecision.status);
  const gateReasonCode = mapGateReasonCode(status);
  const credentialReference = credentialReferenceSnapshot(
    policyDecision,
    input.credential_reference
  );
  const signedReadPermissionPreflight = signedReadPermissionPreflightSnapshot(
    status,
    credentialReference.status
  );
  const signedRequestConstructionBoundary = signedRequestConstructionBoundarySnapshot(
    signedReadPermissionPreflight.status
  );
  const requiredNextActions = new Set(policyDecision.required_next_actions);

  if (status === "ready_but_disabled") {
    requiredNextActions.add("grant_signed_read_authority_before_private_user_data_reads");
  }
  if (signedRequestConstructionBoundary.status === "dry_run_only") {
    requiredNextActions.add("grant_signed_request_authority_before_private_user_data_reads");
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
    credential_reference_status: credentialReference.status,
    credential_reference_source: credentialReference.source,
    ...(credentialReference.ref ? { credential_reference_ref: credentialReference.ref } : {}),
    signed_read_permission_preflight_status: signedReadPermissionPreflight.status,
    signed_read_permission_preflight_source: signedReadPermissionPreflight.source,
    signed_request_construction_boundary_status: signedRequestConstructionBoundary.status,
    signed_request_construction_boundary_source: signedRequestConstructionBoundary.source,
    signed_request_construction_required_components: signedRequestConstructionBoundary.requiredComponents,
    signed_read_permission: "not_granted",
    account_balance_position_read_authority: "not_granted",
    listen_key_user_data_stream_authority: "not_granted",
    leverage_margin_mutation_authority: "not_granted",
    order_submission_authority: "not_granted",
    gateway_decision_authority: "not_granted",
    evidence_sealing_authority: "not_counted",
    promotion_authority: "not_granted",
    reason_codes: uniqueReasonCodes([
      ...policyDecision.reason_codes,
      ...(credentialReference.status === "reference_only" ? ["credential_reference_only" as const] : []),
      ...(signedReadPermissionPreflight.status === "preflight_only"
        ? ["signed_read_permission_preflight_only" as const]
        : []),
      ...(signedRequestConstructionBoundary.status === "dry_run_only"
        ? ["signed_request_construction_boundary_only" as const]
        : []),
      gateReasonCode,
      "no_private_read_performed"
    ]),
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

function credentialReferenceSnapshot(
  decision: PrivateReadinessPolicyDecision,
  reference: PrivateReadGateCredentialReferenceInput | undefined
): {
  status: PrivateReadGateCredentialReferenceStatus;
  source: PrivateReadGateCredentialReferenceSource;
  ref?: PrivateReadinessPolicyDecision["source_surface_refs"][number];
} {
  if (reference) {
    return {
      status: reference.configured ? "reference_only" : "not_configured",
      source: reference.source,
      ...(reference.ref ? { ref: reference.ref } : {})
    };
  }

  const configurationGate = decision.checked_gates.find((gate) => gate.dimension === "configuration");
  if (configurationGate?.status === "blocked") {
    return {
      status: "blocked",
      source: "policy_configuration_gate"
    };
  }
  if (configurationGate?.status === "review_required") {
    return {
      status: "review_required",
      source: "policy_configuration_gate"
    };
  }
  if (configurationGate?.status === "not_ready") {
    return {
      status: "not_configured",
      source: "policy_configuration_gate"
    };
  }
  return {
    status: "reference_only",
    source: "policy_configuration_gate"
  };
}

const SIGNED_REQUEST_CONSTRUCTION_REQUIRED_COMPONENTS: PrivateReadGateSignedRequestConstructionRequiredComponent[] = [
  "API key",
  "timestamp",
  "recvWindow",
  "query string",
  "signature",
  "signed endpoint"
];

function signedReadPermissionPreflightSnapshot(
  status: PrivateReadGateDecisionStatus,
  credentialReferenceStatus: PrivateReadGateCredentialReferenceStatus
): {
  status: PrivateReadGateSignedReadPermissionPreflightStatus;
  source: PrivateReadGateSignedReadPermissionPreflightSource;
} {
  if (status === "ready_but_disabled" && credentialReferenceStatus === "reference_only") {
    return {
      status: "preflight_only",
      source: "policy_decision"
    };
  }

  return {
    status: "not_requested",
    source: "policy_decision"
  };
}

function signedRequestConstructionBoundarySnapshot(
  preflightStatus: PrivateReadGateSignedReadPermissionPreflightStatus
): {
  status: PrivateReadGateSignedRequestConstructionBoundaryStatus;
  source: PrivateReadGateSignedRequestConstructionBoundarySource;
  requiredComponents: PrivateReadGateSignedRequestConstructionRequiredComponent[];
} {
  if (preflightStatus === "preflight_only") {
    return {
      status: "dry_run_only",
      source: "policy_decision",
      requiredComponents: [...SIGNED_REQUEST_CONSTRUCTION_REQUIRED_COMPONENTS]
    };
  }

  return {
    status: "not_requested",
    source: "policy_decision",
    requiredComponents: []
  };
}

function uniqueReasonCodes(reasonCodes: PrivateReadGateReasonCode[]): PrivateReadGateReasonCode[] {
  return [...new Set(reasonCodes)];
}
