import { createHash } from "node:crypto";
import {
  paperTradingEvaluationCommitmentDigestInput,
  type CandidateInspectReadModel,
  type PaperTradingAccountSnapshot,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationInvalidationReason,
  type PaperTradingEvaluationPolicyIdentity,
  type PaperTradingEvaluationProviderIdentity,
  type PaperTradingEvaluationRecord,
  type PaperTradingEvidencePurpose,
  type Ref,
  type SystemCodeRecord
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "../../ports/market-data";

export const PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1 = {
  market_data_policy_version: "binance-public-market-v1",
  gateway_policy_version: "paper-gateway-dry-run-v1",
  cost_policy_version: "paper-cost-8bps-v1",
  funding_policy_version: "paper-funding-engine-v1",
  slippage_policy_version: "paper-public-fill-slippage-v1",
  fill_policy_version: "paper-public-execution-fill-v1",
  risk_policy_version: "paper-risk-validation-v1",
  paper_account_policy_version: "fake-paper-account-10000usdt-v1",
  decision_event_protocol_version: "trading-system-paper-events-v1",
  persistent_state_boundary_version: "paper-engine-checkpoint-v1"
} as const satisfies PaperTradingEvaluationPolicyIdentity;

export const PAPER_TRADING_EVIDENCE_ELIGIBILITY_POLICY_VERSION =
  "paper-evidence-eligibility-v1";

export const PAPER_TRADING_NO_RUNTIME_PROVIDER_IDENTITY = {
  runtime_provider_kind: "none",
  qualification_eligible: true
} as const satisfies PaperTradingEvaluationProviderIdentity;

export interface CreatePaperTradingEvaluationCommitmentInput {
  commitmentId: string;
  evidencePurpose: PaperTradingEvidencePurpose;
  candidate: CandidateInspectReadModel;
  systemCode: SystemCodeRecord;
  resolvedArtifactDigest: string;
  marketData: GatewayMarketDataPort;
  intervalMs: number;
  initialAccountSnapshot: PaperTradingAccountSnapshot;
  providerIdentity?: PaperTradingEvaluationProviderIdentity;
  policyIdentity?: PaperTradingEvaluationPolicyIdentity;
  committedAt: string;
}

export type PaperTradingEvaluationCommitmentVerification =
  | { status: "verified" }
  | {
      status: "invalidated";
      reason: PaperTradingEvaluationInvalidationReason;
      diagnostic: string;
    };

export interface VerifyPaperTradingEvaluationCommitmentInput {
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  candidate: CandidateInspectReadModel;
  systemCode: SystemCodeRecord;
  resolvedArtifactDigest: string;
  marketData: GatewayMarketDataPort;
  intervalMs: number;
  providerIdentity?: PaperTradingEvaluationProviderIdentity;
  policyIdentity?: PaperTradingEvaluationPolicyIdentity;
}

export function createPaperTradingEvaluationCommitment(
  input: CreatePaperTradingEvaluationCommitmentInput
): PaperTradingEvaluationCommitmentRecord {
  const providerIdentity = cleanProviderIdentity(
    input.providerIdentity ?? PAPER_TRADING_NO_RUNTIME_PROVIDER_IDENTITY
  );
  const policyIdentity = {
    ...(input.policyIdentity ?? PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1)
  };
  const commitmentWithoutDigest: PaperTradingEvaluationCommitmentRecord = {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: input.commitmentId,
    evidence_purpose: input.evidencePurpose,
    candidate_ref: ref("trading_system_candidate", input.candidate.candidate_id),
    candidate_version_ref: ref(
      "candidate_version",
      input.candidate.candidate_version.candidate_version_id
    ),
    trading_run_ref: ref("trading_run", input.candidate.runtime.ref.id),
    system_code_ref: ref("system_code", input.systemCode.system_code_id),
    system_code_artifact_digest: input.systemCode.artifact_digest,
    resolved_artifact_digest: input.resolvedArtifactDigest,
    runtime_identity: {
      artifact_kind: input.systemCode.artifact_kind,
      runtime_kind: input.systemCode.runtime_kind,
      entrypoint: [...input.systemCode.entrypoint],
      ...(input.systemCode.artifact_runtime_contract_ref
        ? { artifact_runtime_contract_ref: { ...input.systemCode.artifact_runtime_contract_ref } }
        : {})
    },
    provider_identity: providerIdentity,
    capability_policy_ref: { ...input.systemCode.capability_policy_ref },
    secret_policy_ref: { ...input.systemCode.secret_policy_ref },
    policy_identity: policyIdentity,
    data_identity: paperTradingEvaluationDataIdentity(input.marketData),
    window_policy: {
      interval_ms: input.intervalMs,
      release_policy: input.evidencePurpose === "research_feedback"
        ? "closed_observation"
        : "sealed_until_adjudication",
      eligibility_policy_version: PAPER_TRADING_EVIDENCE_ELIGIBILITY_POLICY_VERSION
    },
    initial_account_snapshot: cloneJson(input.initialAccountSnapshot),
    committed_at: input.committedAt,
    commitment_digest: "",
    authority_status: "not_live"
  };
  return {
    ...commitmentWithoutDigest,
    commitment_digest: paperTradingEvaluationCommitmentDigest(commitmentWithoutDigest)
  };
}

export function verifyPaperTradingEvaluationCommitment(
  input: VerifyPaperTradingEvaluationCommitmentInput
): PaperTradingEvaluationCommitmentVerification {
  const expectedDigest = paperTradingEvaluationCommitmentDigest(input.commitment);
  if (input.commitment.commitment_digest !== expectedDigest) {
    return invalidated(
      "commitment_digest_mismatch",
      "PaperTradingEvaluationCommitment canonical content changed."
    );
  }
  if (
    input.evaluation.paper_trading_evaluation_commitment_ref?.id !==
      input.commitment.paper_trading_evaluation_commitment_id
  ) {
    return invalidated(
      "commitment_missing",
      "PaperTradingEvaluation does not reference its persisted commitment."
    );
  }
  if (input.candidate.candidate_id !== input.commitment.candidate_ref.id) {
    return invalidated("candidate_identity_mismatch", "TradingSystem candidate identity changed.");
  }
  if (
    input.candidate.candidate_version.candidate_version_id !==
      input.commitment.candidate_version_ref.id ||
    input.candidate.runtime.ref.id !== input.commitment.trading_run_ref.id ||
    input.evaluation.candidate_version_ref.id !== input.commitment.candidate_version_ref.id ||
    input.evaluation.trading_run_ref.id !== input.commitment.trading_run_ref.id
  ) {
    return invalidated(
      "candidate_version_identity_mismatch",
      "CandidateVersion or TradingRun identity changed."
    );
  }
  if (
    input.systemCode.system_code_id !== input.commitment.system_code_ref.id ||
    input.candidate.system_code?.ref?.id !== input.commitment.system_code_ref.id
  ) {
    return invalidated("system_code_identity_mismatch", "SystemCode identity changed.");
  }
  if (input.systemCode.artifact_digest !== input.commitment.system_code_artifact_digest) {
    return invalidated(
      "stored_artifact_digest_mismatch",
      "Stored SystemCode artifact digest changed."
    );
  }
  if (input.resolvedArtifactDigest !== input.commitment.resolved_artifact_digest) {
    return invalidated(
      "resolved_artifact_digest_mismatch",
      "Resolved SystemCode executable bytes changed."
    );
  }
  if (!sameJson(systemCodeRuntimeIdentity(input.systemCode), input.commitment.runtime_identity)) {
    return invalidated("runtime_identity_mismatch", "SystemCode runtime identity changed.");
  }
  if (!sameJson(
    cleanProviderIdentity(input.providerIdentity ?? PAPER_TRADING_NO_RUNTIME_PROVIDER_IDENTITY),
    input.commitment.provider_identity
  )) {
    return invalidated("provider_identity_mismatch", "Runtime provider identity changed.");
  }
  if (!sameRef(input.systemCode.capability_policy_ref, input.commitment.capability_policy_ref)) {
    return invalidated("capability_policy_mismatch", "SystemCode capability policy changed.");
  }
  if (!sameRef(input.systemCode.secret_policy_ref, input.commitment.secret_policy_ref)) {
    return invalidated("secret_policy_mismatch", "SystemCode secret policy changed.");
  }
  const policyIdentity = input.policyIdentity ?? PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1;
  const purposeMatchesRelease =
    (input.commitment.evidence_purpose === "research_feedback" &&
      input.commitment.window_policy.release_policy === "closed_observation") ||
    (input.commitment.evidence_purpose === "qualification" &&
      input.commitment.window_policy.release_policy === "sealed_until_adjudication");
  if (
    !sameJson(policyIdentity, input.commitment.policy_identity) ||
    !sameJson(paperTradingEvaluationDataIdentity(input.marketData), input.commitment.data_identity) ||
    input.intervalMs !== input.commitment.window_policy.interval_ms ||
    input.evaluation.interval_ms !== input.commitment.window_policy.interval_ms ||
    input.commitment.window_policy.eligibility_policy_version !==
      PAPER_TRADING_EVIDENCE_ELIGIBILITY_POLICY_VERSION ||
    !purposeMatchesRelease
  ) {
    return invalidated(
      "evaluation_policy_identity_mismatch",
      "Paper evaluation market, policy, purpose, or window identity changed."
    );
  }
  if (
    input.evaluation.observation_count === 0 &&
    !sameJson(
      input.evaluation.paper_account_snapshot,
      input.commitment.initial_account_snapshot
    )
  ) {
    return invalidated(
      "initial_account_identity_mismatch",
      "Paper evaluation initial account anchor changed."
    );
  }
  if (
    input.commitment.authority_status !== "not_live" ||
    input.evaluation.authority_status !== "not_live" ||
    input.systemCode.authority_status !== "not_live" ||
    input.marketData.authority_status !== "read_only" ||
    input.commitment.data_identity.private_exchange_access !== "forbidden" ||
    input.commitment.data_identity.live_order_access !== "forbidden"
  ) {
    return invalidated(
      "paper_only_authority_violation",
      "Paper-only authority boundary changed."
    );
  }
  return { status: "verified" };
}

export function invalidatePaperTradingEvaluation(input: {
  evaluation: PaperTradingEvaluationRecord;
  verification: Extract<PaperTradingEvaluationCommitmentVerification, { status: "invalidated" }>;
  invalidatedAt: string;
}): PaperTradingEvaluationRecord {
  return {
    ...input.evaluation,
    status: "invalidated",
    invalidation_reason: input.verification.reason,
    latest_failure_reason: input.verification.diagnostic,
    next_observation_at: undefined,
    stopped_at: input.invalidatedAt
  };
}

export function paperTradingEvaluationCommitmentDigest(
  commitment: PaperTradingEvaluationCommitmentRecord
): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingEvaluationCommitmentDigestInput(commitment))
    .digest("hex")}`;
}

export function paperTradingMarketDataConfigurationDigest(
  marketData: GatewayMarketDataPort
): string {
  const identity = {
    provider_kind: marketData.provider_kind,
    source_kind: marketData.source_kind,
    rest_base_url: marketData.rest_base_url,
    required_endpoints: [...marketData.required_endpoints],
    authority_status: marketData.authority_status
  };
  return `sha256:${createHash("sha256")
    .update(stableJson(identity))
    .digest("hex")}`;
}

function paperTradingEvaluationDataIdentity(
  marketData: GatewayMarketDataPort
): PaperTradingEvaluationCommitmentRecord["data_identity"] {
  return {
    symbol: "BTCUSDT",
    market_data_port: "gateway_owned",
    allowed_market_data_source: marketData.source_kind,
    market_data_configuration_digest: paperTradingMarketDataConfigurationDigest(marketData),
    private_exchange_access: "forbidden",
    live_order_access: "forbidden"
  };
}

function systemCodeRuntimeIdentity(
  systemCode: SystemCodeRecord
): PaperTradingEvaluationCommitmentRecord["runtime_identity"] {
  return {
    artifact_kind: systemCode.artifact_kind,
    runtime_kind: systemCode.runtime_kind,
    entrypoint: [...systemCode.entrypoint],
    ...(systemCode.artifact_runtime_contract_ref
      ? { artifact_runtime_contract_ref: { ...systemCode.artifact_runtime_contract_ref } }
      : {})
  };
}

function cleanProviderIdentity(
  providerIdentity: PaperTradingEvaluationProviderIdentity
): PaperTradingEvaluationProviderIdentity {
  return {
    runtime_provider_kind: providerIdentity.runtime_provider_kind,
    ...(providerIdentity.agent_profile_ref
      ? { agent_profile_ref: { ...providerIdentity.agent_profile_ref } }
      : {}),
    ...(providerIdentity.model ? { model: providerIdentity.model } : {}),
    ...(providerIdentity.provider_configuration_digest
      ? { provider_configuration_digest: providerIdentity.provider_configuration_digest }
      : {}),
    qualification_eligible: providerIdentity.qualification_eligible,
    ...(providerIdentity.ineligibility_reason
      ? { ineligibility_reason: providerIdentity.ineligibility_reason }
      : {})
  };
}

function invalidated(
  reason: PaperTradingEvaluationInvalidationReason,
  diagnostic: string
): PaperTradingEvaluationCommitmentVerification {
  return { status: "invalidated", reason, diagnostic };
}

function ref(recordKind: string, id: string): Ref {
  return { record_kind: recordKind, id };
}

function sameRef(left: Ref | undefined, right: Ref | undefined): boolean {
  return Boolean(
    left &&
    right &&
    left.record_kind === right.record_kind &&
    left.id === right.id
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("paper_trading_commitment_non_canonical_value");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => {
        if (child === undefined) {
          throw new Error("paper_trading_commitment_non_canonical_value");
        }
        return `${JSON.stringify(key)}:${stableJson(child)}`;
      })
      .join(",")}}`;
  }
  throw new Error("paper_trading_commitment_non_canonical_value");
}
