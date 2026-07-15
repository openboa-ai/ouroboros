export const CANDIDATE_EGRESS_ATTESTATION_PROTOCOL_VERSION =
  "candidate_egress_attestation_v1" as const;
export const CANDIDATE_EGRESS_NETWORK_POLICY_PROTOCOL_VERSION =
  "candidate_sandbox_network_policy_v1" as const;
export const CANDIDATE_EGRESS_ATTESTER_ID = "candidate-egress-evaluator-v1" as const;

export const CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS = [
  "https://example.com",
  "https://registry.npmjs.org",
  "tcp://1.1.1.1:53",
  "udp://1.1.1.1:53",
  "http://169.254.169.254:80",
  "http://10.0.0.1:80",
  "http://host.docker.internal:1"
] as const;

export interface CandidateEgressRef {
  record_kind: string;
  id: string;
}

export interface CandidateEgressNetworkPolicyIdentity {
  protocol_version: typeof CANDIDATE_EGRESS_NETWORK_POLICY_PROTOCOL_VERSION;
  inherited_allow_digest: string;
  inherited_allow_count: number;
  owned_allow_rule_ids: string[];
  owned_deny_rule_ids: string[];
  gateway_resource?: string;
  deny_targets: string[];
}

export interface CandidateEgressPolicyObservation {
  observed_at: string;
  policy_digest: string;
}

export interface CandidateEgressAttestation {
  protocol_version: typeof CANDIDATE_EGRESS_ATTESTATION_PROTOCOL_VERSION;
  attestation_id: string;
  attested_by: CandidateEgressRef;
  candidate_authored: boolean;
  system_code_ref: CandidateEgressRef;
  system_code_artifact_digest: string;
  execution_ref: CandidateEgressRef;
  sandbox: {
    adapter_kind: "docker_sandboxes_sbx";
    sandbox_name: string;
    implementation_version: string;
  };
  network_policy: CandidateEgressNetworkPolicyIdentity;
  network_policy_digest: string;
  start: CandidateEgressPolicyObservation;
  end: CandidateEgressPolicyObservation;
  candidate_effect: {
    started_at: string;
    completed_at: string;
  };
  cleanup_status: "released" | "failed";
  enforcement_result:
    | "enforced"
    | "policy_mismatch"
    | "unexpected_allow"
    | "cleanup_failed";
  denial_summary: {
    required_probe_count: number;
    start_denied_probe_count: number;
    end_denied_probe_count: number;
    unexpected_allow_count: number;
  };
  issued_at: string;
  attestation_digest: string;
  research_preflight_authority: boolean;
  promotion_authority: boolean;
  order_submission_authority: boolean;
  live_exchange_authority: boolean;
  authority_status: string;
}

export interface CandidateEgressAttestationExpectedContext {
  attestation_id: string;
  system_code_ref: CandidateEgressRef;
  system_code_artifact_digest: string;
  execution_ref: CandidateEgressRef;
  sandbox_name: string;
  sandbox_implementation_version: string;
  conformance_started_at: string;
  conformance_completed_at: string;
}

export type CandidateEgressAttestationRejectionReason =
  | "missing"
  | "stale"
  | "mismatched"
  | "replayed"
  | "candidate_authored"
  | "tampered"
  | "enforcement_failed";

export type CandidateEgressAttestationVerification =
  | { status: "verified" }
  | {
      status: "rejected";
      reason: CandidateEgressAttestationRejectionReason;
    };

export function candidateEgressAttestationIdForConformance(
  conformanceId: string
): string {
  if (!boundedString(conformanceId, 240)) {
    throw new Error("candidate_egress_conformance_id_invalid");
  }
  return `candidate-egress-attestation-${conformanceId}`;
}

export function candidateEgressNetworkPolicyDigestInput(
  identity: CandidateEgressNetworkPolicyIdentity
): string {
  return canonicalCandidateEgressJson(identity, new Set<object>());
}

export function candidateEgressAttestationDigestInput(
  attestation: CandidateEgressAttestation
): string {
  const { attestation_digest: _digest, ...payload } = attestation;
  return canonicalCandidateEgressJson(payload, new Set<object>());
}

export function candidateEgressAttestationHasRuntimeShape(
  value: unknown
): value is CandidateEgressAttestation {
  if (!record(value) || !exactKeys(value, [
    "protocol_version",
    "attestation_id",
    "attested_by",
    "candidate_authored",
    "system_code_ref",
    "system_code_artifact_digest",
    "execution_ref",
    "sandbox",
    "network_policy",
    "network_policy_digest",
    "start",
    "end",
    "candidate_effect",
    "cleanup_status",
    "enforcement_result",
    "denial_summary",
    "issued_at",
    "attestation_digest",
    "research_preflight_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ])) {
    return false;
  }
  return value.protocol_version === CANDIDATE_EGRESS_ATTESTATION_PROTOCOL_VERSION &&
    boundedString(value.attestation_id, 320) &&
    refShape(value.attested_by) &&
    typeof value.candidate_authored === "boolean" &&
    refShape(value.system_code_ref, "system_code") &&
    sha256Digest(value.system_code_artifact_digest) &&
    refShape(value.execution_ref, "experiment_run") &&
    sandboxShape(value.sandbox) &&
    networkPolicyShape(value.network_policy) &&
    sha256Digest(value.network_policy_digest) &&
    policyObservationShape(value.start) &&
    policyObservationShape(value.end) &&
    candidateEffectShape(value.candidate_effect) &&
    (value.cleanup_status === "released" || value.cleanup_status === "failed") &&
    (
      value.enforcement_result === "enforced" ||
      value.enforcement_result === "policy_mismatch" ||
      value.enforcement_result === "unexpected_allow" ||
      value.enforcement_result === "cleanup_failed"
    ) &&
    denialSummaryShape(value.denial_summary) &&
    isoTimestamp(value.issued_at) &&
    sha256Digest(value.attestation_digest) &&
    typeof value.research_preflight_authority === "boolean" &&
    typeof value.promotion_authority === "boolean" &&
    typeof value.order_submission_authority === "boolean" &&
    typeof value.live_exchange_authority === "boolean" &&
    boundedString(value.authority_status, 64);
}

export function verifyCandidateEgressAttestation(input: {
  attestation?: CandidateEgressAttestation;
  expected: CandidateEgressAttestationExpectedContext;
  consumed_attestation_digests: readonly string[];
  sha256(value: string): string;
}): CandidateEgressAttestationVerification {
  const attestation = input.attestation;
  if (!attestation) {
    return rejected("missing");
  }
  if (!candidateEgressAttestationHasRuntimeShape(attestation)) {
    return rejected("tampered");
  }
  const policyDigest = input.sha256(candidateEgressNetworkPolicyDigestInput(
    attestation.network_policy
  ));
  const attestationDigest = input.sha256(
    candidateEgressAttestationDigestInput(attestation)
  );
  if (
    attestation.network_policy_digest !== policyDigest ||
    attestation.attestation_digest !== attestationDigest
  ) {
    return rejected("tampered");
  }
  if (
    attestation.candidate_authored ||
    attestation.attested_by.record_kind !== "external_evaluator" ||
    attestation.attested_by.id !== CANDIDATE_EGRESS_ATTESTER_ID
  ) {
    return rejected("candidate_authored");
  }
  if (input.consumed_attestation_digests.includes(attestation.attestation_digest)) {
    return rejected("replayed");
  }
  if (
    attestation.attestation_id !== input.expected.attestation_id ||
    !sameRef(attestation.system_code_ref, input.expected.system_code_ref) ||
    attestation.system_code_artifact_digest !==
      input.expected.system_code_artifact_digest ||
    !sameRef(attestation.execution_ref, input.expected.execution_ref) ||
    attestation.sandbox.sandbox_name !== input.expected.sandbox_name ||
    attestation.sandbox.implementation_version !==
      input.expected.sandbox_implementation_version ||
    attestation.start.policy_digest !== attestation.network_policy_digest ||
    attestation.end.policy_digest !== attestation.network_policy_digest
  ) {
    return rejected("mismatched");
  }
  if (!attestationWindowIsCurrent(attestation, input.expected)) {
    return rejected("stale");
  }
  const requiredProbeCount = CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length;
  if (
    attestation.cleanup_status !== "released" ||
    attestation.enforcement_result !== "enforced" ||
    attestation.denial_summary.required_probe_count !== requiredProbeCount ||
    attestation.denial_summary.start_denied_probe_count !== requiredProbeCount ||
    attestation.denial_summary.end_denied_probe_count !== requiredProbeCount ||
    attestation.denial_summary.unexpected_allow_count !== 0
  ) {
    return rejected("enforcement_failed");
  }
  if (
    attestation.research_preflight_authority !== true ||
    attestation.promotion_authority !== false ||
    attestation.order_submission_authority !== false ||
    attestation.live_exchange_authority !== false ||
    attestation.authority_status !== "not_live"
  ) {
    return rejected("tampered");
  }
  return { status: "verified" };
}

function attestationWindowIsCurrent(
  attestation: CandidateEgressAttestation,
  expected: CandidateEgressAttestationExpectedContext
): boolean {
  const conformanceStart = Date.parse(expected.conformance_started_at);
  const conformanceEnd = Date.parse(expected.conformance_completed_at);
  const policyStart = Date.parse(attestation.start.observed_at);
  const effectStart = Date.parse(attestation.candidate_effect.started_at);
  const effectEnd = Date.parse(attestation.candidate_effect.completed_at);
  const policyEnd = Date.parse(attestation.end.observed_at);
  const issuedAt = Date.parse(attestation.issued_at);
  return [
    conformanceStart,
    conformanceEnd,
    policyStart,
    effectStart,
    effectEnd,
    policyEnd,
    issuedAt
  ].every(Number.isFinite) &&
    conformanceStart <= policyStart &&
    policyStart <= effectStart &&
    effectStart <= effectEnd &&
    effectEnd <= policyEnd &&
    policyEnd <= issuedAt &&
    issuedAt <= conformanceEnd;
}

function networkPolicyShape(
  value: unknown
): value is CandidateEgressNetworkPolicyIdentity {
  if (!record(value)) return false;
  const hasGateway = Object.hasOwn(value, "gateway_resource");
  const keys = [
    "protocol_version",
    "inherited_allow_digest",
    "inherited_allow_count",
    "owned_allow_rule_ids",
    "owned_deny_rule_ids",
    "deny_targets",
    ...(hasGateway ? ["gateway_resource"] : [])
  ];
  if (!exactKeys(value, keys)) return false;
  if (
    value.protocol_version !== CANDIDATE_EGRESS_NETWORK_POLICY_PROTOCOL_VERSION ||
    !sha256Digest(value.inherited_allow_digest) ||
    !boundedInteger(value.inherited_allow_count, 512) ||
    !boundedSortedStrings(value.owned_allow_rule_ids, 512, 256) ||
    !boundedSortedStrings(value.owned_deny_rule_ids, 512, 256) ||
    !sameStrings(value.deny_targets, CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS)
  ) {
    return false;
  }
  if (hasGateway) {
    return boundedString(value.gateway_resource, 1_024) &&
      value.owned_allow_rule_ids.length === 1;
  }
  return value.owned_allow_rule_ids.length === 0;
}

function sandboxShape(value: unknown): boolean {
  return record(value) && exactKeys(value, [
    "adapter_kind",
    "sandbox_name",
    "implementation_version"
  ]) && value.adapter_kind === "docker_sandboxes_sbx" &&
    boundedString(value.sandbox_name, 128) &&
    typeof value.implementation_version === "string" &&
    /^\d+\.\d+\.\d+$/.test(value.implementation_version);
}

function policyObservationShape(value: unknown): boolean {
  return record(value) && exactKeys(value, ["observed_at", "policy_digest"]) &&
    isoTimestamp(value.observed_at) && sha256Digest(value.policy_digest);
}

function candidateEffectShape(value: unknown): boolean {
  return record(value) && exactKeys(value, ["started_at", "completed_at"]) &&
    isoTimestamp(value.started_at) && isoTimestamp(value.completed_at) &&
    Date.parse(value.started_at as string) <= Date.parse(value.completed_at as string);
}

function denialSummaryShape(value: unknown): boolean {
  return record(value) && exactKeys(value, [
    "required_probe_count",
    "start_denied_probe_count",
    "end_denied_probe_count",
    "unexpected_allow_count"
  ]) && boundedInteger(value.required_probe_count, 1_024) &&
    boundedInteger(value.start_denied_probe_count, 1_024) &&
    boundedInteger(value.end_denied_probe_count, 1_024) &&
    boundedInteger(value.unexpected_allow_count, 1_024);
}

function canonicalCandidateEgressJson(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("candidate_egress_non_canonical_value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new Error("candidate_egress_non_canonical_value");
    ancestors.add(value);
    try {
      return `[${Array.from({ length: value.length }, (_, index) => {
        if (!Object.hasOwn(value, index) || value[index] === undefined) {
          throw new Error("candidate_egress_non_canonical_value");
        }
        return canonicalCandidateEgressJson(value[index], ancestors);
      }).join(",")}]`;
    } finally {
      ancestors.delete(value);
    }
  }
  if (!record(value)) throw new Error("candidate_egress_non_canonical_value");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("candidate_egress_non_canonical_value");
  }
  if (ancestors.has(value)) throw new Error("candidate_egress_non_canonical_value");
  ancestors.add(value);
  try {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0
    );
    return `{${entries.map(([key, item]) => {
      if (item === undefined) throw new Error("candidate_egress_non_canonical_value");
      return `${JSON.stringify(key)}:${canonicalCandidateEgressJson(item, ancestors)}`;
    }).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function refShape(value: unknown, recordKind?: string): value is CandidateEgressRef {
  return record(value) && exactKeys(value, ["record_kind", "id"]) &&
    boundedString(value.record_kind, 128) && boundedString(value.id, 320) &&
    (recordKind === undefined || value.record_kind === recordKind);
}

function sameRef(left: CandidateEgressRef, right: CandidateEgressRef): boolean {
  return left.record_kind === right.record_kind && left.id === right.id;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function boundedSortedStrings(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every((item) => boundedString(item, maxLength)) &&
    new Set(value).size === value.length &&
    value.every((item, index) => index === 0 || value[index - 1]! < item);
}

function sameStrings(left: unknown, right: readonly string[]): left is string[] {
  return Array.isArray(left) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function boundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength &&
    value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
}

function boundedInteger(value: unknown, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;
}

function sha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function isoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejected(
  reason: CandidateEgressAttestationRejectionReason
): CandidateEgressAttestationVerification {
  return { status: "rejected", reason };
}
