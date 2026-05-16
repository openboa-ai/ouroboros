import type {
  PrivateReadinessPolicyGateInput,
  PrivateReadinessPostureReadModel,
  PrivateReadinessPostureRecord,
  Ref,
  TradingSubstrateInstrument,
  TradingSubstrateVenue
} from "@ouroboros/domain";

const DEFAULT_OPERATOR_APPROVAL_GATE: PrivateReadinessPolicyGateInput = {
  status: "not_ready",
  reason: "operator_live_private_read_approval_missing"
};

const DEFAULT_JURISDICTION_RISK_GATE: PrivateReadinessPolicyGateInput = {
  status: "review_required",
  reason: "operator_jurisdiction_not_recorded"
};

export interface PrivateReadinessPostureQueryInput {
  venue?: TradingSubstrateVenue;
  instrument?: TradingSubstrateInstrument;
}

export function toPrivateReadinessPostureReadModel(
  posture: PrivateReadinessPostureRecord
): PrivateReadinessPostureReadModel {
  return {
    posture_id: posture.private_readiness_posture_id,
    posture_label: privateReadinessPostureLabel(posture),
    venue: posture.venue,
    instrument: posture.instrument,
    product_category: posture.product_category,
    operator_approval_gate: operatorApprovalGateFor(posture),
    jurisdiction_risk_gate: jurisdictionRiskGateFor(posture),
    live_binding_gate: posture.live_binding_gate,
    secret_handling_gate: posture.secret_handling_gate,
    stop_behavior_gate: posture.stop_behavior_gate,
    secret_reference_configured: posture.secret_reference_configured,
    secret_reference_ref: posture.secret_reference_ref,
    raw_secret_material_present: posture.raw_secret_material_present,
    source_timestamp: posture.source_timestamp,
    observed_at: posture.observed_at,
    updated_at: posture.updated_at,
    source_kind: posture.source_kind,
    source_ref: posture.source_ref,
    fixture_backed: posture.fixture_backed,
    simulated: posture.simulated,
    no_authority: posture.no_authority,
    no_authority_label: formatPostureNoAuthority(posture.no_authority),
    authority_status: posture.authority_status
  };
}

export function comparePrivateReadinessPostures(
  a: PrivateReadinessPostureRecord,
  b: PrivateReadinessPostureRecord
): number {
  const timeCompare = a.updated_at.localeCompare(b.updated_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.private_readiness_posture_id.localeCompare(b.private_readiness_posture_id);
}

export function matchesPrivateReadinessPostureQuery(
  posture: PrivateReadinessPostureRecord,
  query: PrivateReadinessPostureQueryInput
): boolean {
  return (
    (query.venue === undefined || posture.venue === query.venue) &&
    (query.instrument === undefined || posture.instrument === query.instrument)
  );
}

export function isPrivateReadinessPostureRecord(
  value: unknown
): value is PrivateReadinessPostureRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<PrivateReadinessPostureRecord>;
  return (
    raw.record_kind === "private_readiness_posture" &&
    raw.version === 1 &&
    nonEmpty(raw.private_readiness_posture_id) &&
    raw.venue === "binance_usd_m_futures" &&
    raw.instrument === "BTCUSDT" &&
    raw.product_category === "perpetual_futures" &&
    (raw.operator_approval_gate === undefined ||
      isPrivateReadinessPolicyGate(raw.operator_approval_gate)) &&
    (raw.jurisdiction_risk_gate === undefined ||
      isPrivateReadinessPolicyGate(raw.jurisdiction_risk_gate)) &&
    isPrivateReadinessPolicyGate(raw.live_binding_gate) &&
    isPrivateReadinessPolicyGate(raw.secret_handling_gate) &&
    isPrivateReadinessPolicyGate(raw.stop_behavior_gate) &&
    typeof raw.secret_reference_configured === "boolean" &&
    raw.raw_secret_material_present === false &&
    nonEmpty(raw.source_timestamp) &&
    nonEmpty(raw.observed_at) &&
    nonEmpty(raw.updated_at) &&
    (raw.source_kind === "fixture" || raw.source_kind === "local_config") &&
    typeof raw.fixture_backed === "boolean" &&
    typeof raw.simulated === "boolean" &&
    raw.no_authority !== undefined &&
    raw.no_authority.live_exchange === false &&
    raw.no_authority.order_submission === false &&
    raw.no_authority.credentials === false &&
    raw.authority_status === "not_live" &&
    (raw.secret_reference_ref === undefined || isRef(raw.secret_reference_ref)) &&
    (raw.source_ref === undefined || isRef(raw.source_ref))
  );
}

export function isCompletePrivateReadinessPostureRecord(
  value: unknown
): value is PrivateReadinessPostureRecord {
  if (!isPrivateReadinessPostureRecord(value)) {
    return false;
  }
  return (
    isPrivateReadinessPolicyGate(value.operator_approval_gate) &&
    isPrivateReadinessPolicyGate(value.jurisdiction_risk_gate)
  );
}

function privateReadinessPostureLabel(posture: PrivateReadinessPostureRecord): string {
  const venueLabel = posture.venue === "binance_usd_m_futures" ? "Binance" : posture.venue;
  return `${venueLabel} ${posture.instrument} private_readiness_posture`;
}

function operatorApprovalGateFor(
  posture: PrivateReadinessPostureRecord
): PrivateReadinessPolicyGateInput {
  return posture.operator_approval_gate ?? { ...DEFAULT_OPERATOR_APPROVAL_GATE };
}

function jurisdictionRiskGateFor(
  posture: PrivateReadinessPostureRecord
): PrivateReadinessPolicyGateInput {
  return posture.jurisdiction_risk_gate ?? { ...DEFAULT_JURISDICTION_RISK_GATE };
}

function formatPostureNoAuthority(
  noAuthority: PrivateReadinessPostureRecord["no_authority"]
): string {
  return [
    `live_exchange=${noAuthority.live_exchange}`,
    `order_submission=${noAuthority.order_submission}`,
    `credentials=${noAuthority.credentials}`
  ].join(", ");
}

function isPrivateReadinessPolicyGate(value: unknown): value is PrivateReadinessPolicyGateInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<PrivateReadinessPolicyGateInput>;
  return (
    (raw.status === "ready" ||
      raw.status === "not_ready" ||
      raw.status === "blocked" ||
      raw.status === "review_required") &&
    nonEmpty(raw.reason)
  );
}

function isRef(value: unknown): value is Ref {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<Ref>;
  return nonEmpty(raw.record_kind) && nonEmpty(raw.id);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
