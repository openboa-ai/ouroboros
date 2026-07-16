import { createHash } from "node:crypto";
import type {
  CandidateInspectReadModel,
  SandboxAdapterKind
} from "@ouroboros/domain";
import {
  candidateEgressAttestationIdForConformance,
  paperTradingHandoffConformanceDigestInput,
  paperTradingHandoffConformanceHasRuntimeShape,
  verifyCandidateEgressAttestation
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import type { SystemCodeArtifactResolverPort } from
  "../../ports/system-code-artifact";

export type GeneratedCandidatePaperHandoffConformanceFailure =
  | "paper_handoff_conformance_admission_missing"
  | "paper_handoff_conformance_missing"
  | "paper_handoff_conformance_invalid"
  | "paper_handoff_conformance_not_passed"
  | "paper_handoff_conformance_not_admitted"
  | "paper_handoff_conformance_artifact_drift"
  | "paper_handoff_conformance_system_code_mismatch"
  | "paper_handoff_conformance_experiment_mismatch"
  | "paper_handoff_conformance_evaluation_task_mismatch"
  | "paper_handoff_conformance_egress_attestation_missing"
  | "paper_handoff_conformance_egress_attestation_invalid";

export type PaperTradingStartEligibility = (
  candidate: CandidateInspectReadModel
) => Promise<GeneratedCandidatePaperHandoffConformanceFailure | undefined>;

export function paperTradingStartRequiresGeneratedEligibility(
  candidate: CandidateInspectReadModel
): boolean {
  if (candidate.materialization_attempt?.provider_kind === "fixture_only") {
    return false;
  }
  return candidate.materialization_attempt !== undefined ||
    candidate.candidate_version.materialization_attempt_ref !== undefined;
}

export function paperTradingSandboxAdapterKind(
  candidate: CandidateInspectReadModel
): SandboxAdapterKind {
  return paperTradingStartRequiresGeneratedEligibility(candidate)
    ? "docker_sandboxes_sbx"
    : "deterministic_test";
}

export async function generatedCandidatePaperHandoffConformanceFailure(
  store: OuroborosStorePort,
  candidate: CandidateInspectReadModel,
  artifactResolver: SystemCodeArtifactResolverPort
): Promise<GeneratedCandidatePaperHandoffConformanceFailure | undefined> {
  if (!paperTradingStartRequiresGeneratedEligibility(candidate)) {
    return undefined;
  }
  const systemCodeId = candidate.system_code?.ref?.id;
  if (!systemCodeId) return "paper_handoff_conformance_system_code_mismatch";

  const admissions = (await store.listCandidateAdmissionDecisions())
    .filter((record) => record.system_code_ref.id === systemCodeId);
  const admission = admissions.at(-1);
  if (!admission) return "paper_handoff_conformance_admission_missing";
  const conformanceRef = admission.paper_trading_handoff_conformance_ref;
  const conformanceDigest = admission.paper_trading_handoff_conformance_digest;
  if (!conformanceRef || !conformanceDigest ||
    admission.paper_handoff_conformance_status === undefined) {
    return "paper_handoff_conformance_missing";
  }

  let conformance;
  try {
    conformance = await store.getPaperTradingHandoffConformance(conformanceRef.id);
  } catch {
    return "paper_handoff_conformance_invalid";
  }
  if (!conformance) return "paper_handoff_conformance_missing";
  if (!paperTradingHandoffConformanceHasRuntimeShape(conformance) ||
    conformance.evidence_digest !== exactConformanceDigest(conformance) ||
    conformanceRef.record_kind !== "paper_trading_handoff_conformance" ||
    conformanceRef.id !== conformance.paper_trading_handoff_conformance_id ||
    conformanceDigest !== conformance.evidence_digest) {
    return "paper_handoff_conformance_invalid";
  }
  if (conformance.status !== "passed" || conformance.reason !== "passed" ||
    !conformance.runnable_paper_handoff) {
    return "paper_handoff_conformance_not_passed";
  }
  if (admission.status !== "admitted" ||
    admission.reason !== "evaluation_accepted" ||
    !admission.runnable_paper_handoff ||
    admission.paper_handoff_conformance_status !== "passed") {
    return "paper_handoff_conformance_not_admitted";
  }

  const systemCode = await store.getSystemCode(systemCodeId);
  if (!systemCode ||
    conformance.system_code_ref.id !== systemCode.system_code_id ||
    conformance.system_code_artifact_digest !== systemCode.artifact_digest ||
    admission.submitted_artifact_digest !== systemCode.artifact_digest) {
    return "paper_handoff_conformance_system_code_mismatch";
  }
  if (conformance.experiment_run_ref.id !== admission.experiment_run_ref.id) {
    return "paper_handoff_conformance_experiment_mismatch";
  }
  const experiment = await store.getExperimentRun(admission.experiment_run_ref.id);
  if (!experiment ||
    experiment.system_code_ref.id !== systemCode.system_code_id ||
    experiment.status !== "evaluated") {
    return "paper_handoff_conformance_experiment_mismatch";
  }
  const evaluation = await store.getTradingEvaluationResult(
    admission.trading_evaluation_result_ref.id
  );
  if (!evaluation ||
    evaluation.experiment_run_ref.id !== experiment.experiment_run_id ||
    evaluation.result_status !== "accepted" ||
    evaluation.evidence_disposition !== "not_counted" ||
    conformance.trading_evaluation_task_ref.id !==
      experiment.trading_evaluation_task_ref.id ||
    evaluation.trading_evaluation_task_ref.id !==
      experiment.trading_evaluation_task_ref.id) {
    return "paper_handoff_conformance_evaluation_task_mismatch";
  }
  if (conformance.version !== 2) {
    return "paper_handoff_conformance_egress_attestation_missing";
  }
  const attestation = conformance.candidate_egress_attestation;
  const egressVerification = verifyCandidateEgressAttestation({
    attestation,
    expected: {
      attestation_id: candidateEgressAttestationIdForConformance(
        conformance.paper_trading_handoff_conformance_id
      ),
      system_code_ref: {
        record_kind: "system_code",
        id: systemCode.system_code_id
      },
      system_code_artifact_digest: systemCode.artifact_digest,
      execution_ref: {
        record_kind: "experiment_run",
        id: experiment.experiment_run_id
      },
      sandbox_name: attestation.sandbox.sandbox_name,
      sandbox_implementation_version:
        attestation.sandbox.implementation_version,
      conformance_started_at: conformance.started_at,
      conformance_completed_at: conformance.completed_at
    },
    consumed_attestation_digests: [],
    sha256
  });
  if (egressVerification.status === "rejected") {
    return "paper_handoff_conformance_egress_attestation_invalid";
  }
  try {
    if (await artifactResolver.resolveArtifactDigest(systemCode) !== systemCode.artifact_digest) {
      return "paper_handoff_conformance_artifact_drift";
    }
  } catch {
    return "paper_handoff_conformance_artifact_drift";
  }
  return undefined;
}

function exactConformanceDigest(
  conformance: Parameters<typeof paperTradingHandoffConformanceDigestInput>[0]
): string {
  return sha256(paperTradingHandoffConformanceDigestInput(conformance));
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
