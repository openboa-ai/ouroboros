import { createHash, createHmac, randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchPreflightCommitmentDigestInput,
  researchPreflightCommitmentHasRuntimeShape,
  researchPreflightMethodologyHasRuntimeShape,
  researchWorkerMemoryPolicyHasRuntimeShape,
  type Ref,
  type ResearchPreflightCommitmentRecord,
  type ResearchPreflightMethodology,
  type ResearchWorkerMemoryPolicy
} from "@ouroboros/domain";
import { researchDevelopmentReplayScenarios } from "./replay-trading-api-provider";
import type { ReplayTradingScenario } from "./types";

export interface BuildResearchPreflightPlanInput {
  candidate_arena_tick_id: string;
  research_direction_ref: Ref;
  research_worker_ref: Ref;
  research_allocation_ref: Ref;
  research_allocation_digest: string;
  source_system_code_ref: Ref;
  source_artifact_digest: string;
  memory_policy?: ResearchWorkerMemoryPolicy;
  methodology?: ResearchPreflightMethodology;
  development_submission_limit: number;
  committed_at: string;
  evaluator_seed: Uint8Array;
  evaluation_opportunity?: ResearchPreflightEvaluationOpportunityHandle;
}

export interface ResearchPreflightEvaluationSuite {
  suite_digest: string;
  scenarios: ReplayTradingScenario[];
}

export interface ResearchPreflightEvaluationOpportunityDescriptor {
  development_suite_version: "research_development_replay_v1";
  development_suite_digest: string;
  sealed_suite_version: "research_sealed_admission_v1";
  sealed_generator_version: "research_scenario_generator_v1";
  sealed_rotation_commitment_digest: string;
  sealed_suite_digest: string;
}

export class ResearchPreflightEvaluationOpportunityHandle {
  #developmentSuite: ResearchPreflightEvaluationSuite;
  #sealedAdmissionSuite: ResearchPreflightEvaluationSuite;
  #rotationCommitmentDigest: string;

  private constructor(input: {
    developmentSuite: ResearchPreflightEvaluationSuite;
    sealedAdmissionSuite: ResearchPreflightEvaluationSuite;
    rotationCommitmentDigest: string;
  }) {
    this.#developmentSuite = deepFreeze(structuredClone(input.developmentSuite));
    this.#sealedAdmissionSuite = deepFreeze(
      structuredClone(input.sealedAdmissionSuite)
    );
    this.#rotationCommitmentDigest = input.rotationCommitmentDigest;
  }

  static create(input: {
    developmentSuite: ResearchPreflightEvaluationSuite;
    sealedAdmissionSuite: ResearchPreflightEvaluationSuite;
    rotationCommitmentDigest: string;
  }): ResearchPreflightEvaluationOpportunityHandle {
    return new ResearchPreflightEvaluationOpportunityHandle(input);
  }

  descriptor(): ResearchPreflightEvaluationOpportunityDescriptor {
    return {
      development_suite_version: "research_development_replay_v1",
      development_suite_digest: this.#developmentSuite.suite_digest,
      sealed_suite_version: "research_sealed_admission_v1",
      sealed_generator_version: "research_scenario_generator_v1",
      sealed_rotation_commitment_digest: this.#rotationCommitmentDigest,
      sealed_suite_digest: this.#sealedAdmissionSuite.suite_digest
    };
  }

  developmentSuite(): ResearchPreflightEvaluationSuite {
    return structuredClone(this.#developmentSuite);
  }

  sealedAdmissionSuite(): ResearchPreflightEvaluationSuite {
    return structuredClone(this.#sealedAdmissionSuite);
  }

  rotationCommitmentDigest(): string {
    return this.#rotationCommitmentDigest;
  }
}

export class ResearchPreflightPlanHandle {
  readonly commitment: ResearchPreflightCommitmentRecord;
  #developmentSuite: ResearchPreflightEvaluationSuite;
  #sealedAdmissionSuite: ResearchPreflightEvaluationSuite;
  #sealedAdmissionClaimed = false;

  constructor(input: {
    commitment: ResearchPreflightCommitmentRecord;
    developmentSuite: ResearchPreflightEvaluationSuite;
    sealedAdmissionSuite: ResearchPreflightEvaluationSuite;
  }) {
    this.commitment = deepFreeze(structuredClone(input.commitment));
    this.#developmentSuite = deepFreeze(structuredClone(input.developmentSuite));
    this.#sealedAdmissionSuite = deepFreeze(structuredClone(input.sealedAdmissionSuite));
  }

  evaluatorDevelopmentSuite(): ResearchPreflightEvaluationSuite {
    return structuredClone(this.#developmentSuite);
  }

  assertSealedAdmissionUnclaimed(): void {
    if (this.#sealedAdmissionClaimed) {
      throw new Error("research_preflight_sealed_submission_already_claimed");
    }
  }

  claimSealedAdmissionSuite(): ResearchPreflightEvaluationSuite {
    this.assertSealedAdmissionUnclaimed();
    this.#sealedAdmissionClaimed = true;
    return structuredClone(this.#sealedAdmissionSuite);
  }

  toJSON(): { commitment: ResearchPreflightCommitmentRecord } {
    return { commitment: this.commitment };
  }
}

export function generateResearchPreflightEvaluatorSeed(): Uint8Array {
  return randomBytes(32);
}

export function createResearchPreflightEvaluationOpportunity(input: {
  evaluator_seed: Uint8Array;
  opportunity_context: string;
  observed_at: string;
}): ResearchPreflightEvaluationOpportunityHandle {
  if (!(input?.evaluator_seed instanceof Uint8Array) ||
    input.evaluator_seed.byteLength !== 32 ||
    !nonEmpty(input.opportunity_context) || !canonicalIso(input.observed_at)) {
    throw new Error("research_preflight_evaluation_opportunity_input_invalid");
  }
  const evaluatorSeed = Buffer.from(input.evaluator_seed);
  const developmentSuite = evaluationSuite(
    researchDevelopmentReplayScenarios()
  );
  const sealedAdmissionSuite = evaluationSuite(sealedAdmissionScenarios(
    evaluatorSeed,
    input.opportunity_context,
    input.observed_at
  ));
  const rotationCommitmentDigest = sha256(Buffer.concat([
    Buffer.from("ouroboros:research-preflight-rotation:v1\0"),
    Buffer.from(input.opportunity_context),
    Buffer.from("\0"),
    evaluatorSeed
  ]));
  return ResearchPreflightEvaluationOpportunityHandle.create({
    developmentSuite,
    sealedAdmissionSuite,
    rotationCommitmentDigest
  });
}

export function buildResearchPreflightPlan(
  input: BuildResearchPreflightPlanInput
): ResearchPreflightPlanHandle {
  assertBuildInput(input);
  const context = planContext(input);
  const opportunity = input.evaluation_opportunity ??
    createResearchPreflightEvaluationOpportunity({
      evaluator_seed: input.evaluator_seed,
      opportunity_context: context,
      observed_at: input.committed_at
    });
  const developmentSuite = opportunity.developmentSuite();
  const sealedAdmissionSuite = opportunity.sealedAdmissionSuite();
  const rotationCommitmentDigest = opportunity.rotationCommitmentDigest();
  const commitmentIdentity = sha256(Buffer.from(paperTradingComparisonPersistedRecordDigestInput({
    context,
    rotation_commitment_digest: rotationCommitmentDigest,
    sealed_suite_digest: sealedAdmissionSuite.suite_digest,
    ...(input.memory_policy
      ? { memory_policy: input.memory_policy }
      : {}),
    ...(input.methodology
      ? { methodology: input.methodology }
      : {})
  })));
  const commitment: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: `research-preflight-${commitmentIdentity.slice(-24)}`,
    candidate_arena_tick_id: input.candidate_arena_tick_id,
    research_direction_ref: { ...input.research_direction_ref },
    research_worker_ref: { ...input.research_worker_ref },
    research_allocation_ref: { ...input.research_allocation_ref },
    research_allocation_digest: input.research_allocation_digest,
    source_system_code_ref: { ...input.source_system_code_ref },
    source_artifact_digest: input.source_artifact_digest,
    ...(input.memory_policy
      ? { memory_policy: structuredClone(input.memory_policy) }
      : {}),
    ...(input.methodology
      ? { methodology: structuredClone(input.methodology) }
      : {}),
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: developmentSuite.suite_digest,
      submission_limit: input.development_submission_limit,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: rotationCommitmentDigest,
      suite_digest: sealedAdmissionSuite.suite_digest,
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: input.committed_at,
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: "sha256:" + "0".repeat(64)
  };
  commitment.commitment_digest = sha256(Buffer.from(
    researchPreflightCommitmentDigestInput(commitment)
  ));
  if (!researchPreflightCommitmentHasRuntimeShape(commitment)) {
    throw new Error("research_preflight_plan_commitment_invalid");
  }
  return new ResearchPreflightPlanHandle({
    commitment,
    developmentSuite,
    sealedAdmissionSuite
  });
}

function sealedAdmissionScenarios(
  seed: Buffer,
  context: string,
  observedAt: string
): ReplayTradingScenario[] {
  const templates = (["long", "short", "flat"] as const).flatMap((direction) => [
    { direction, stress: false },
    { direction, stress: true }
  ]).map((template) => {
    const key = `${template.direction}:${template.stress ? "stress" : "standard"}`;
    const price = round(60_000 + (fraction(seed, context, `${key}:price`) - 0.5) * 2_000, 2);
    const spread = round(price * (0.003 + fraction(seed, context, `${key}:spread`) * 0.002), 2);
    const move = 0.012 + fraction(seed, context, `${key}:move`) * 0.004;
    const direction = template.direction;
    const exitPrice = direction === "long"
      ? price * (1 + move)
      : direction === "short"
        ? price * (1 - move)
        : price;
    const shuffleKey = derive(seed, context, `${key}:shuffle`).toString("hex");
    return {
      shuffleKey,
      scenario: {
        id: `sealed-${derive(seed, context, `${key}:id`).toString("hex").slice(0, 20)}`,
        description: "pending",
        market: {
          symbol: "BTCUSDT",
          price,
          moving_average_fast: direction === "long"
            ? round(price + spread, 2)
            : direction === "short" ? round(price - spread, 2) : price,
          moving_average_slow: price,
          volatility: template.stress
            ? round(0.04 + fraction(seed, context, `${key}:volatility`) * 0.015, 6)
            : round(0.012 + fraction(seed, context, `${key}:volatility`) * 0.008, 6),
          expected_direction: direction,
          observed_at: observedAt
        },
        account: {
          equity: 10_000,
          max_position_notional: 350,
          max_risk_fraction: 0.03,
          target_risk_fraction: 0.02
        },
        outcome: {
          exit_price: round(exitPrice, 2),
          fee_bps: template.stress ? 6 : 4,
          slippage_bps: template.stress ? 8 : 3,
          funding_bps: template.stress ? 5 : 1
        }
      } satisfies ReplayTradingScenario
    };
  });
  return templates
    .sort((left, right) => left.shuffleKey === right.shuffleKey
      ? 0
      : left.shuffleKey < right.shuffleKey ? -1 : 1)
    .map((entry, index) => ({
      ...entry.scenario,
      description: `Sealed admission scenario ${index + 1}`
    }));
}

function evaluationSuite(scenarios: ReplayTradingScenario[]): ResearchPreflightEvaluationSuite {
  const copied = structuredClone(scenarios);
  return {
    suite_digest: sha256(Buffer.from(
      paperTradingComparisonPersistedRecordDigestInput(copied)
    )),
    scenarios: copied
  };
}

function planContext(input: BuildResearchPreflightPlanInput): string {
  return paperTradingComparisonPersistedRecordDigestInput({
    candidate_arena_tick_id: input.candidate_arena_tick_id,
    research_direction_ref: input.research_direction_ref,
    research_worker_ref: input.research_worker_ref,
    research_allocation_ref: input.research_allocation_ref,
    research_allocation_digest: input.research_allocation_digest,
    source_system_code_ref: input.source_system_code_ref,
    source_artifact_digest: input.source_artifact_digest,
    ...(input.methodology
      ? { methodology: input.methodology }
      : {}),
    development_submission_limit: input.development_submission_limit,
    committed_at: input.committed_at
  });
}

function derive(seed: Buffer, context: string, label: string): Buffer {
  return createHmac("sha256", seed)
    .update("ouroboros:research-preflight-scenario:v1\0")
    .update(context)
    .update("\0")
    .update(label)
    .digest();
}

function fraction(seed: Buffer, context: string, label: string): number {
  return derive(seed, context, label).readUInt32BE(0) / 0xffff_ffff;
}

function assertBuildInput(input: BuildResearchPreflightPlanInput): void {
  const invalidFields = !input || typeof input !== "object"
    ? ["input"]
    : [
        !nonEmpty(input.candidate_arena_tick_id)
          ? "candidate_arena_tick_id"
          : undefined,
        !refKind(input.research_direction_ref, "research_direction")
          ? "research_direction_ref"
          : undefined,
        !refKind(input.research_worker_ref, "research_worker")
          ? "research_worker_ref"
          : undefined,
        !refKind(
          input.research_allocation_ref,
          "candidate_arena_research_allocation"
        ) ? "research_allocation_ref" : undefined,
        !sha256Digest(input.research_allocation_digest)
          ? "research_allocation_digest"
          : undefined,
        !refKind(input.source_system_code_ref, "system_code")
          ? "source_system_code_ref"
          : undefined,
        !sha256Digest(input.source_artifact_digest)
          ? "source_artifact_digest"
          : undefined,
        input.memory_policy !== undefined &&
          !researchWorkerMemoryPolicyHasRuntimeShape(input.memory_policy)
          ? "memory_policy"
          : undefined,
        input.methodology !== undefined &&
          !researchPreflightMethodologyHasRuntimeShape(input.methodology)
          ? "methodology"
          : undefined,
        input.evaluation_opportunity !== undefined &&
          !researchPreflightEvaluationOpportunityIsValid(
            input.evaluation_opportunity
          ) ? "evaluation_opportunity" : undefined,
        !Number.isInteger(input.development_submission_limit) ||
          input.development_submission_limit < 1 ||
          input.development_submission_limit > 2
          ? "development_submission_limit"
          : undefined,
        !canonicalIso(input.committed_at) ? "committed_at" : undefined,
        !(input.evaluator_seed instanceof Uint8Array) ||
          input.evaluator_seed.byteLength !== 32
          ? "evaluator_seed"
          : undefined
      ].filter((field): field is string => Boolean(field));
  if (invalidFields.length > 0) {
    throw new Error(
      `research_preflight_plan_input_invalid:${invalidFields.join(",")}`
    );
  }
}

function researchPreflightEvaluationOpportunityIsValid(
  value: ResearchPreflightEvaluationOpportunityHandle
): boolean {
  try {
    if (!(value instanceof ResearchPreflightEvaluationOpportunityHandle) ||
      typeof value.descriptor !== "function" ||
      typeof value.developmentSuite !== "function" ||
      typeof value.sealedAdmissionSuite !== "function" ||
      typeof value.rotationCommitmentDigest !== "function") {
      return false;
    }
    const descriptor = value.descriptor();
    const development = value.developmentSuite();
    const sealed = value.sealedAdmissionSuite();
    const canonicalDevelopment = evaluationSuite(
      researchDevelopmentReplayScenarios()
    );
    return descriptor.development_suite_version ===
        "research_development_replay_v1" &&
      descriptor.sealed_suite_version === "research_sealed_admission_v1" &&
      descriptor.sealed_generator_version ===
        "research_scenario_generator_v1" &&
      descriptor.development_suite_digest === development.suite_digest &&
      descriptor.sealed_suite_digest === sealed.suite_digest &&
      descriptor.sealed_rotation_commitment_digest ===
        value.rotationCommitmentDigest() &&
      isDeepStrictEqual(development, canonicalDevelopment) &&
      evaluationSuite(sealed.scenarios).suite_digest === sealed.suite_digest &&
      sha256Digest(descriptor.sealed_rotation_commitment_digest);
  } catch {
    return false;
  }
}

function refKind(value: Ref, recordKind: string): boolean {
  return Boolean(value) && value.record_kind === recordKind && nonEmpty(value.id);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function sha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function canonicalIso(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function sha256(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function round(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}
