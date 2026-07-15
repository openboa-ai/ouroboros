import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  candidateEgressAttestationDigestInput,
  candidateEgressAttestationHasRuntimeShape,
  candidateEgressAttestationIdForConformance,
  candidateEgressNetworkPolicyDigestInput,
  CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS,
  verifyCandidateEgressAttestation,
  type CandidateEgressAttestation,
  type CandidateEgressAttestationExpectedContext
} from "./candidate-egress-attestation";

describe("CandidateEgressAttestation", () => {
  it("verifies evaluator-owned evidence that covers the exact candidate effect", () => {
    const { attestation, expected } = fixture();

    expect(candidateEgressAttestationHasRuntimeShape(attestation)).toBe(true);
    expect(verifyCandidateEgressAttestation({
      attestation,
      expected,
      consumed_attestation_digests: [],
      sha256: digest
    })).toEqual({ status: "verified" });
  });

  it("rejects missing evidence", () => {
    const { expected } = fixture();

    expect(verifyCandidateEgressAttestation({
      expected,
      consumed_attestation_digests: [],
      sha256: digest
    })).toEqual({ status: "rejected", reason: "missing" });
  });

  it("rejects stale policy observations that do not cover candidate effect", () => {
    const { attestation, expected } = fixture();
    attestation.start.observed_at = "2026-07-15T10:00:00.600Z";
    resign(attestation);

    expect(verifyCandidateEgressAttestation({
      attestation,
      expected,
      consumed_attestation_digests: [],
      sha256: digest
    })).toEqual({ status: "rejected", reason: "stale" });
  });

  it("rejects exact subject and Sandbox mismatches", () => {
    const { attestation, expected } = fixture();

    expect(verifyCandidateEgressAttestation({
      attestation,
      expected: { ...expected, sandbox_name: "other-sandbox" },
      consumed_attestation_digests: [],
      sha256: digest
    })).toEqual({ status: "rejected", reason: "mismatched" });
  });

  it("rejects a digest already bound to another conformance", () => {
    const { attestation, expected } = fixture();

    expect(verifyCandidateEgressAttestation({
      attestation,
      expected,
      consumed_attestation_digests: [attestation.attestation_digest],
      sha256: digest
    })).toEqual({ status: "rejected", reason: "replayed" });
  });

  it("rejects candidate-authored evidence even when it is canonically resigned", () => {
    const { attestation, expected } = fixture();
    attestation.attested_by = {
      record_kind: "research_worker",
      id: "candidate-controlled-worker"
    };
    attestation.candidate_authored = true;
    resign(attestation);

    expect(verifyCandidateEgressAttestation({
      attestation,
      expected,
      consumed_attestation_digests: [],
      sha256: digest
    })).toEqual({ status: "rejected", reason: "candidate_authored" });
  });

  it("rejects tampered canonical content", () => {
    const { attestation, expected } = fixture();
    attestation.denial_summary.end_denied_probe_count -= 1;

    expect(verifyCandidateEgressAttestation({
      attestation,
      expected,
      consumed_attestation_digests: [],
      sha256: digest
    })).toEqual({ status: "rejected", reason: "tampered" });
  });

  it.each([
    ["policy changed", (record: CandidateEgressAttestation) => {
      record.end.policy_digest = digest("other-policy");
    }, "mismatched"],
    ["deny probe missing", (record: CandidateEgressAttestation) => {
      record.denial_summary.end_denied_probe_count -= 1;
    }, "enforcement_failed"],
    ["unexpected allow", (record: CandidateEgressAttestation) => {
      record.denial_summary.unexpected_allow_count = 1;
    }, "enforcement_failed"],
    ["cleanup incomplete", (record: CandidateEgressAttestation) => {
      record.cleanup_status = "failed";
      record.enforcement_result = "cleanup_failed";
    }, "enforcement_failed"]
  ] as const)("rejects %s despite a recomputed attestation digest", (_label, mutate, reason) => {
    const { attestation, expected } = fixture();
    mutate(attestation);
    resign(attestation);

    expect(verifyCandidateEgressAttestation({
      attestation,
      expected,
      consumed_attestation_digests: [],
      sha256: digest
    })).toEqual({ status: "rejected", reason });
  });

  it("keeps raw inherited policy resources out of the canonical schema", () => {
    const { attestation } = fixture();
    const serialized = JSON.stringify(attestation);

    expect(serialized).not.toContain("**.github.com:443");
    expect(serialized).not.toContain("registry.npmjs.org:443");
    expect(serialized).not.toContain("inherited_allow_resources");
    expect(attestation.network_policy.inherited_allow_count).toBe(2);
  });
});

function fixture(): {
  attestation: CandidateEgressAttestation;
  expected: CandidateEgressAttestationExpectedContext;
} {
  const conformanceId = "paper-handoff-conformance-attested";
  const networkPolicy = {
    protocol_version: "candidate_sandbox_network_policy_v1" as const,
    inherited_allow_digest: digest(JSON.stringify([
      "**.github.com:443",
      "registry.npmjs.org:443"
    ])),
    inherited_allow_count: 2,
    owned_allow_rule_ids: ["owned-allow-3"],
    owned_deny_rule_ids: ["owned-deny-1", "owned-deny-2"],
    gateway_resource: "localhost:4173",
    deny_targets: [...CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS]
  };
  const networkPolicyDigest = digest(candidateEgressNetworkPolicyDigestInput(networkPolicy));
  const attestation: CandidateEgressAttestation = {
    protocol_version: "candidate_egress_attestation_v1",
    attestation_id: candidateEgressAttestationIdForConformance(conformanceId),
    attested_by: {
      record_kind: "external_evaluator",
      id: "candidate-egress-evaluator-v1"
    },
    candidate_authored: false,
    system_code_ref: { record_kind: "system_code", id: "system-code-attested" },
    system_code_artifact_digest: digest("system-code-artifact"),
    execution_ref: { record_kind: "experiment_run", id: "experiment-run-attested" },
    sandbox: {
      adapter_kind: "docker_sandboxes_sbx",
      sandbox_name: "ouro-candidate-attested",
      implementation_version: "0.35.0"
    },
    network_policy: networkPolicy,
    network_policy_digest: networkPolicyDigest,
    start: {
      observed_at: "2026-07-15T10:00:00.100Z",
      policy_digest: networkPolicyDigest
    },
    end: {
      observed_at: "2026-07-15T10:00:01.900Z",
      policy_digest: networkPolicyDigest
    },
    candidate_effect: {
      started_at: "2026-07-15T10:00:00.500Z",
      completed_at: "2026-07-15T10:00:01.500Z"
    },
    cleanup_status: "released",
    enforcement_result: "enforced",
    denial_summary: {
      required_probe_count: CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length,
      start_denied_probe_count: CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length,
      end_denied_probe_count: CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length,
      unexpected_allow_count: 0
    },
    issued_at: "2026-07-15T10:00:02.000Z",
    attestation_digest: "pending",
    research_preflight_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  resign(attestation);
  return {
    attestation,
    expected: {
      attestation_id: attestation.attestation_id,
      system_code_ref: { ...attestation.system_code_ref },
      system_code_artifact_digest: attestation.system_code_artifact_digest,
      execution_ref: { ...attestation.execution_ref },
      sandbox_name: attestation.sandbox.sandbox_name,
      sandbox_implementation_version: attestation.sandbox.implementation_version,
      conformance_started_at: "2026-07-15T10:00:00.000Z",
      conformance_completed_at: "2026-07-15T10:00:02.100Z"
    }
  };
}

function resign(attestation: CandidateEgressAttestation): void {
  attestation.attestation_digest = digest(
    candidateEgressAttestationDigestInput(attestation)
  );
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
