import { createHash } from "node:crypto";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchBehaviorFingerprintDigestInput,
  researchBehaviorFingerprintHasRuntimeShape,
  researchPreflightCommitmentDigestInput,
  researchPreflightCommitmentHasRuntimeShape,
  type Ref,
  type ResearchBehaviorFingerprintDecision,
  type ResearchBehaviorFingerprintObservation,
  type ResearchBehaviorFingerprintRecord,
  type ResearchPreflightCommitmentRecord
} from "@ouroboros/domain";
import { researchDevelopmentReplayScenarios } from "./replay-trading-api-provider";
import { tradingResearchOrderRequestFrom } from "./provider-protocol";
import type { TradingScenarioEvaluationResult } from "./types";

export type ResearchBehaviorFingerprintUnavailableReason =
  | "commitment_invalid"
  | "system_code_identity_invalid"
  | "created_at_invalid"
  | "scenario_results_empty"
  | "scenario_results_incomplete"
  | "scenario_id_duplicate"
  | "effective_decision_missing"
  | "effective_decision_invalid";

export class ResearchBehaviorFingerprintUnavailableError extends Error {
  readonly reason: ResearchBehaviorFingerprintUnavailableReason;

  constructor(reason: ResearchBehaviorFingerprintUnavailableReason) {
    super(`research_behavior_fingerprint_unavailable:${reason}`);
    this.name = "ResearchBehaviorFingerprintUnavailableError";
    this.reason = reason;
  }
}

export interface DeriveResearchBehaviorFingerprintInput {
  commitment: ResearchPreflightCommitmentRecord;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  scenario_results: TradingScenarioEvaluationResult[];
  created_at: string;
}

export function deriveResearchBehaviorFingerprint(
  input: DeriveResearchBehaviorFingerprintInput
): ResearchBehaviorFingerprintRecord {
  assertCommitment(input.commitment);
  if (!isRef(input.system_code_ref, "system_code") ||
    !sha256Digest(input.system_code_artifact_digest)) {
    unavailable("system_code_identity_invalid");
  }
  if (!canonicalIso(input.created_at) ||
    Date.parse(input.created_at) < Date.parse(input.commitment.committed_at)) {
    unavailable("created_at_invalid");
  }
  const observations = normalizedObservations(input.scenario_results);
  const record: ResearchBehaviorFingerprintRecord = {
    record_kind: "research_behavior_fingerprint",
    version: 1,
    research_behavior_fingerprint_id: "pending",
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: input.commitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: input.commitment.commitment_digest,
    system_code_ref: { ...input.system_code_ref },
    system_code_artifact_digest: input.system_code_artifact_digest,
    protocol_version: "research_behavior_fingerprint_v1",
    development_suite_version: input.commitment.development_policy.suite_version,
    development_suite_digest: input.commitment.development_policy.suite_digest,
    observations,
    observation_count: observations.length,
    fingerprint_digest: "sha256:" + "0".repeat(64),
    created_at: input.created_at,
    duplicate_detection_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.fingerprint_digest = sha256(researchBehaviorFingerprintDigestInput(record));
  record.research_behavior_fingerprint_id = `research-behavior-fingerprint-${sha256(
    paperTradingComparisonPersistedRecordDigestInput({
      research_preflight_commitment_ref: record.research_preflight_commitment_ref,
      system_code_ref: record.system_code_ref,
      system_code_artifact_digest: record.system_code_artifact_digest,
      fingerprint_digest: record.fingerprint_digest
    })
  ).slice(-24)}`;
  if (!researchBehaviorFingerprintHasRuntimeShape(record)) {
    unavailable("effective_decision_invalid");
  }
  return record;
}

function assertCommitment(commitment: ResearchPreflightCommitmentRecord): void {
  const expectedDevelopmentSuiteDigest = sha256(
    paperTradingComparisonPersistedRecordDigestInput(
      researchDevelopmentReplayScenarios()
    )
  );
  if (!researchPreflightCommitmentHasRuntimeShape(commitment) ||
    commitment.commitment_digest !== sha256(
      researchPreflightCommitmentDigestInput(commitment)
    ) || commitment.development_policy.suite_digest !== expectedDevelopmentSuiteDigest) {
    unavailable("commitment_invalid");
  }
}

function normalizedObservations(
  scenarioResults: TradingScenarioEvaluationResult[]
): ResearchBehaviorFingerprintObservation[] {
  if (!Array.isArray(scenarioResults) || scenarioResults.length === 0) {
    unavailable("scenario_results_empty");
  }
  const scenarioIds = scenarioResults.map((result) => result.scenario_id);
  if (scenarioIds.some((id) => typeof id !== "string" || id.length === 0)) {
    unavailable("scenario_results_incomplete");
  }
  if (new Set(scenarioIds).size !== scenarioIds.length) {
    unavailable("scenario_id_duplicate");
  }
  const expectedScenarioIds = researchDevelopmentReplayScenarios()
    .map((scenario) => scenario.id)
    .sort();
  const actualScenarioIds = [...scenarioIds].sort();
  if (actualScenarioIds.length !== expectedScenarioIds.length ||
    actualScenarioIds.some((id, index) => id !== expectedScenarioIds[index])) {
    unavailable("scenario_results_incomplete");
  }
  return scenarioResults.map((result) => ({
    scenario_id: result.scenario_id,
    decision: effectiveDecision(result)
  })).sort((left, right) => left.scenario_id.localeCompare(right.scenario_id));
}

function effectiveDecision(
  result: TradingScenarioEvaluationResult
): ResearchBehaviorFingerprintDecision {
  const request = [...result.provider_requests].reverse().find((candidate) =>
    candidate.method === "POST" && candidate.path === "/orders/validate"
  );
  if (!request) {
    const noOrderDecision = [...result.candidate_events].reverse().find((event) =>
      event.event === "hold" || event.event === "no_action"
    );
    if (noOrderDecision) {
      return {
        symbol: "BTCUSDT",
        side: "hold",
        quantity: 0,
        order_type: "none"
      };
    }
    unavailable("effective_decision_missing");
  }
  const body = tradingResearchOrderRequestFrom(request.body);
  if (!body || body.symbol !== "BTCUSDT") {
    unavailable("effective_decision_invalid");
  }
  const isHold = body.side === "hold" && body.order_type === "none" &&
    Object.is(body.quantity, 0);
  const isDirectional = (body.side === "buy" || body.side === "sell") &&
    (body.order_type === "market" || body.order_type === "limit") &&
    body.quantity > 0;
  if (!isHold && !isDirectional) {
    unavailable("effective_decision_invalid");
  }
  return {
    symbol: body.symbol,
    side: body.side,
    quantity: body.quantity,
    order_type: body.order_type
  };
}

function unavailable(reason: ResearchBehaviorFingerprintUnavailableReason): never {
  throw new ResearchBehaviorFingerprintUnavailableError(reason);
}

function isRef(value: Ref, recordKind: string): boolean {
  return Boolean(value) && value.record_kind === recordKind &&
    typeof value.id === "string" && value.id.length > 0;
}

function canonicalIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function sha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function sha256(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}
