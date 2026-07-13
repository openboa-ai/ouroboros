import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  decideResearchMemoryControlStudy,
  researchMemoryControlPairBlindSides,
  researchMemoryControlStudyId,
  type DecideResearchMemoryControlStudyInput
} from "@ouroboros/application/candidate/research-memory-control-study";
import {
  decideResearchMemoryControlPairOutcome,
  decideResearchMemoryControlStudyOutcome,
  researchMemoryControlStudyOutcomeId,
  type DecideResearchMemoryControlPairOutcomeInput,
  type ResearchMemoryControlArmEvidenceInput
} from "@ouroboros/application/candidate/research-memory-control-study-outcome";
import {
  recoverIncompleteResearchWorkerCheckpoints,
  runCandidateArenaTick,
  type CandidateArenaTickOutcome,
  type RunCandidateArenaTickInput
} from "@ouroboros/application/candidate/arena";
import { resolveResearchWorkerLifecycle } from
  "@ouroboros/application/candidate/research-worker-lifecycle";
import {
  createResearchPreflightEvaluationOpportunity,
  type ResearchPreflightEvaluationOpportunityHandle
} from "@ouroboros/application/trading/research/preflight-plan";
import type { TradingArtifactRunner } from
  "@ouroboros/application/trading/research/artifact-runner";
import type { ReplayTradingApiProviderFactory } from
  "@ouroboros/application/trading/research/replay-set-runner";
import type {
  ManagedResearchAgent,
  TradingResearchAgentAdapter
} from "@ouroboros/application/trading/research/types";
import type { TradingResearchRuntimeAgent } from
  "@ouroboros/application/trading/research/runtime-config";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickDirectionResultReadModel,
  type CandidateArenaTickRecord,
  type ResearchBehaviorFingerprintRecord,
  type ResearchDirectionKind,
  type ResearchMemoryControlArmKind,
  type ResearchMemoryControlArmTerminalStatus,
  type ResearchMemoryControlFailureKind,
  type ResearchMemoryControlPairOutcomeRecord,
  type ResearchMemoryControlStudyOutcomeRecord,
  type ResearchMemoryControlStudyRecord,
  type ResearchPreflightCommitmentRecord,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import {
  captureResearchExperimentBaseline,
  ensureResearchExperimentStoreCopy,
  verifyResearchExperimentBaseline
} from "./research-experiment-baseline";
import {
  ensureResearchExperimentSourceArtifact,
  resolveResearchExperimentSource
} from "./research-experiment-source";

const DEFAULT_MAXIMUM_REGULAR_FILE_COUNT = 10_000;
const DEFAULT_MAXIMUM_TOTAL_BYTES = 1_000_000_000;
const OPPORTUNITY_SECRET_KIND =
  "research_preflight_evaluation_opportunity_secret" as const;
const ARM_OWNER_KIND = "research_memory_control_arm_owner" as const;

export type ResearchMemoryControlStudyRuntimeErrorCode =
  | "research_memory_control_study_workspace_invalid"
  | "research_memory_control_study_workspace_overlaps_source"
  | "research_memory_control_study_workspace_conflict"
  | "research_memory_control_study_agent_identity_mismatch"
  | "research_memory_control_study_opportunity_secret_invalid"
  | "research_memory_control_study_arm_evidence_invalid";

export class ResearchMemoryControlStudyRuntimeError extends Error {
  constructor(
    readonly code: ResearchMemoryControlStudyRuntimeErrorCode,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ResearchMemoryControlStudyRuntimeError";
  }
}

export interface PrepareResearchMemoryControlStudyInput {
  store: LocalStore;
  workspaceRoot: string;
  idempotencyKey: string;
  sourceCandidateId?: string;
  directions: ResearchDirectionKind[];
  researchAgentIdentity: ManagedResearchAgent & { model: string };
  maximumBaselineRegularFileCount?: number;
  maximumBaselineTotalBytes?: number;
  now?: () => string;
  repoRoot?: string;
}

export interface RunResearchMemoryControlStudyInput
  extends PrepareResearchMemoryControlStudyInput {
  researchAgent: TradingResearchRuntimeAgent;
  agentFactory: (
    agent: TradingResearchRuntimeAgent
  ) => TradingResearchAgentAdapter;
  artifactRunner?: TradingArtifactRunner;
  replayProviderFactory?: ReplayTradingApiProviderFactory;
  runTick?: (
    input: RunCandidateArenaTickInput
  ) => Promise<CandidateArenaTickOutcome>;
}

export interface RunResearchMemoryControlStudyOutcome {
  study: ResearchMemoryControlStudyRecord;
  pairOutcomes: ResearchMemoryControlPairOutcomeRecord[];
  outcome: ResearchMemoryControlStudyOutcomeRecord;
}

export interface ResearchMemoryControlStudyWorkspacePaths {
  studyRoot: string;
  baselineRoot: string;
  sourceArtifactRoot: string;
  pairRoots: Array<{
    releasedMemory: string;
    memoryMasked: string;
  }>;
}

interface ResearchPreflightOpportunitySecret {
  record_kind: typeof OPPORTUNITY_SECRET_KIND;
  version: 1;
  study_id: string;
  opportunity_context: string;
  observed_at: string;
  study_committed_at: string;
  evaluator_seed_hex: string;
  secret_digest: string;
}

interface ResearchMemoryControlArmOwner {
  record_kind: typeof ARM_OWNER_KIND;
  version: 1;
  study_id: string;
  study_digest: string;
  pair_index: number;
  arm_kind: ResearchMemoryControlArmKind;
  tick_id: string;
  arm_root: string;
  owner_digest: string;
}

interface PreparedResearchMemoryControlRuntime {
  study: ResearchMemoryControlStudyRecord;
  paths: ResearchMemoryControlStudyWorkspacePaths;
  opportunity: ResearchPreflightEvaluationOpportunityHandle;
  repoRoot: string;
}

interface ArmRuntime {
  armKind: ResearchMemoryControlArmKind;
  tickId: string;
  root: string;
  store: LocalStore;
}

export function researchMemoryControlStudyWorkspacePaths(input: {
  workspaceRoot: string;
  studyId: string;
  sourceRoot: string;
  pairCount: number;
}): ResearchMemoryControlStudyWorkspacePaths {
  const workspaceRoot = path.resolve(canonicalPath(input.workspaceRoot));
  const sourceRoot = path.resolve(canonicalPath(input.sourceRoot));
  const studyId = canonicalIdentifier(input.studyId);
  if (!Number.isInteger(input.pairCount) || input.pairCount < 6 ||
    input.pairCount > 30 || pathsOverlap(workspaceRoot, sourceRoot)) {
    throw runtimeError(
      pathsOverlap(workspaceRoot, sourceRoot)
        ? "research_memory_control_study_workspace_overlaps_source"
        : "research_memory_control_study_workspace_invalid",
      pathsOverlap(workspaceRoot, sourceRoot)
        ? "ResearchMemoryControlStudy workspace must be outside the source store."
        : "ResearchMemoryControlStudy workspace input is invalid."
    );
  }
  const studyRoot = path.join(workspaceRoot, safePathSegment(studyId));
  return {
    studyRoot,
    baselineRoot: path.join(studyRoot, "baseline-store"),
    sourceArtifactRoot: path.join(studyRoot, "source-artifact"),
    pairRoots: Array.from({ length: input.pairCount }, (_, index) => {
      const sides = researchMemoryControlPairBlindSides(studyId, index + 1);
      const pairRoot = path.join(
        studyRoot,
        "pairs",
        `pair-${String(index + 1).padStart(2, "0")}`
      );
      return {
        releasedMemory: path.join(pairRoot, sides.releasedMemory),
        memoryMasked: path.join(pairRoot, sides.memoryMasked)
      };
    })
  };
}

export async function prepareResearchMemoryControlStudy(
  input: PrepareResearchMemoryControlStudyInput
): Promise<ResearchMemoryControlStudyRecord> {
  return (await prepareResearchMemoryControlRuntime(input)).study;
}

export async function runResearchMemoryControlStudy(
  input: RunResearchMemoryControlStudyInput
): Promise<RunResearchMemoryControlStudyOutcome> {
  assertRuntimeAgentIdentity(input.researchAgent, input.researchAgentIdentity);
  const prepared = await prepareResearchMemoryControlRuntime(input);
  const { study, paths, opportunity } = prepared;
  const existingOutcome = await input.store.getResearchMemoryControlStudyOutcome(
    researchMemoryControlStudyOutcomeId(
      study.research_memory_control_study_id
    )
  );
  if (existingOutcome) {
    const pairOutcomes = await exactPersistedPairOutcomes(input.store, study);
    return { study, pairOutcomes, outcome: existingOutcome };
  }

  const clock = strictMonotonicClock(input.now, study.committed_at);
  const runTick = input.runTick ?? ((tickInput) =>
    runCandidateArenaTick(tickInput));
  const pairOutcomes: ResearchMemoryControlPairOutcomeRecord[] = [];

  for (let index = 0; index < study.pair_plans.length; index += 1) {
    const pairPlan = study.pair_plans[index]!;
    const existingPair = (await input.store.listResearchMemoryControlPairOutcomes(
      study.research_memory_control_study_id
    )).find((pair) => pair.pair_index === pairPlan.pair_index);
    if (existingPair) {
      pairOutcomes.push(existingPair);
      continue;
    }

    const roots = paths.pairRoots[index]!;
    const arms: [ArmRuntime, ArmRuntime] = [
      await prepareArm({
        study,
        pairIndex: pairPlan.pair_index,
        armKind: "released_memory_treatment",
        tickId: pairPlan.released_memory_treatment.tick_id,
        root: roots.releasedMemory,
        baselineRoot: paths.baselineRoot
      }),
      await prepareArm({
        study,
        pairIndex: pairPlan.pair_index,
        armKind: "memory_masked_control",
        tickId: pairPlan.memory_masked_control.tick_id,
        root: roots.memoryMasked,
        baselineRoot: paths.baselineRoot
      })
    ];
    const states = await Promise.all(arms.map((arm) => plannedArmState(arm)));
    let settled: PromiseSettledResult<CandidateArenaTickOutcome>[] | undefined;
    if (states.every((state) => !state.hasEffect)) {
      const executionArms = [...arms].sort((left, right) =>
        left.root.localeCompare(right.root)
      );
      const executionSettled = await Promise.allSettled(
        executionArms.map((arm) => runTick({
          store: arm.store,
          sourceSystemId: study.source.candidate_ref.id,
          sourceCandidateVersionId: study.source.candidate_version_ref.id,
          directions: [pairPlan.direction_kind],
          researchMemoryMode: arm.armKind === "released_memory_treatment"
            ? "released_memory"
            : "memory_masked",
          researchMemoryControlAssignment: {
            study_ref: {
              record_kind: "research_memory_control_study",
              id: study.research_memory_control_study_id
            },
            study_digest: study.study_digest,
            pair_index: pairPlan.pair_index,
            arm_kind: arm.armKind
          },
          researchPreflightEvaluationOpportunity: opportunity,
          tickId: arm.tickId,
          now: clock.next,
          repoRoot: prepared.repoRoot,
          sourceArtifactDir: paths.sourceArtifactRoot,
          researchAgent: input.researchAgent,
          agentFactory: input.agentFactory,
          artifactRunner: input.artifactRunner,
          replayProviderFactory: input.replayProviderFactory
        }))
      );
      settled = arms.map((arm) =>
        executionSettled[executionArms.indexOf(arm)]!
      );
    } else if (!states.every((state) => state.hasCompleteTick)) {
      const recoveredAt = clock.next();
      await Promise.all(arms.map((arm) =>
        recoverIncompleteResearchWorkerCheckpoints({
          store: arm.store,
          recovered_at: recoveredAt
        })
      ));
    }

    const evidence = await Promise.all(arms.map((arm, armIndex) =>
      collectArmEvidence({
        arm,
        directionKind: pairPlan.direction_kind,
        settled: settled?.[armIndex]
      })
    ));
    const terminalAt = clock.after(...evidenceTimes(evidence));
    const sourceGraph: DecideResearchMemoryControlPairOutcomeInput = {
      study,
      pairIndex: pairPlan.pair_index,
      releasedMemory: evidence[0],
      memoryMasked: evidence[1],
      terminalAt
    };
    const pairOutcome = decideResearchMemoryControlPairOutcome(sourceGraph);
    await input.store.recordResearchMemoryControlPairOutcome({
      outcome: pairOutcome,
      source_graph: sourceGraph
    });
    pairOutcomes.push(pairOutcome);
  }

  const outcome = decideResearchMemoryControlStudyOutcome({
    study,
    pairOutcomes,
    adjudicatedAt: clock.after(...pairOutcomes.map((pair) => pair.terminal_at))
  });
  await input.store.recordResearchMemoryControlStudyOutcome(outcome);
  return { study, pairOutcomes, outcome };
}

async function prepareResearchMemoryControlRuntime(
  input: PrepareResearchMemoryControlStudyInput
): Promise<PreparedResearchMemoryControlRuntime> {
  assertAgentIdentity(input.researchAgentIdentity);
  await assertPhysicalPathsDisjoint(
    input.workspaceRoot,
    input.store.root(),
    "ResearchMemoryControlStudy workspace must be outside the source store."
  );
  const sourceCandidateId = input.sourceCandidateId ?? FIXTURE_CANDIDATE_ID;
  const repoRoot = input.repoRoot ?? process.cwd();
  const maximumFileCount = input.maximumBaselineRegularFileCount ??
    DEFAULT_MAXIMUM_REGULAR_FILE_COUNT;
  const maximumBytes = input.maximumBaselineTotalBytes ??
    DEFAULT_MAXIMUM_TOTAL_BYTES;
  const existingMatches = (await input.store.listResearchMemoryControlStudies())
    .filter((study) => study.idempotency_key === input.idempotencyKey);
  if (existingMatches.length > 1) {
    throw runtimeError(
      "research_memory_control_study_workspace_conflict",
      "Multiple ResearchMemoryControlStudy records share one idempotency key."
    );
  }
  const existing = existingMatches[0];
  if (existing && (existing.source.candidate_ref.id !== sourceCandidateId ||
    existing.pair_plans.length !== input.directions.length ||
    existing.pair_plans.some((pair, index) =>
      pair.direction_kind !== input.directions[index]))) {
    throw runtimeError(
      "research_memory_control_study_workspace_conflict",
      "ResearchMemoryControlStudy resume request conflicts with frozen intent."
    );
  }

  const preparationAt = existing?.committed_at ?? canonicalNow(input.now);
  const directions = existing
    ? await verifyExistingDirections(input.store, existing)
    : await materializeDirections(
        input.store,
        input.directions,
        input.researchAgentIdentity,
        preparationAt
      );
  const baseline = await captureResearchExperimentBaseline({
    root: input.store.root(),
    maximumRegularFileCount: maximumFileCount,
    maximumTotalBytes: maximumBytes
  });
  const resolvedSource = await resolveResearchExperimentSource({
    store: input.store,
    candidateId: sourceCandidateId,
    repoRoot
  });
  const studyId = researchMemoryControlStudyId(input.idempotencyKey);
  const paths = researchMemoryControlStudyWorkspacePaths({
    workspaceRoot: input.workspaceRoot,
    studyId,
    sourceRoot: input.store.root(),
    pairCount: input.directions.length
  });
  if (pathsOverlap(paths.studyRoot, resolvedSource.artifactDirectory)) {
    throw runtimeError(
      "research_memory_control_study_workspace_overlaps_source",
      "ResearchMemoryControlStudy workspace must not overlap its source artifact."
    );
  }
  await assertPhysicalPathsDisjoint(
    paths.studyRoot,
    resolvedSource.artifactDirectory,
    "ResearchMemoryControlStudy workspace must not overlap its source artifact."
  );
  await ensureResearchExperimentStoreCopy({
    sourceRoot: input.store.root(),
    destinationRoot: paths.baselineRoot,
    expected: baseline,
    maximumRegularFileCount: maximumFileCount,
    maximumTotalBytes: maximumBytes
  });
  await ensureResearchExperimentSourceArtifact({
    sourceArtifactDirectory: resolvedSource.artifactDirectory,
    destinationRoot: paths.sourceArtifactRoot,
    expectedClosureDigest: resolvedSource.source.research_artifact_closure_digest
  });
  const secret = await ensureOpportunitySecret({
    studyRoot: paths.studyRoot,
    studyId,
    studyCommittedAt: existing?.committed_at ?? strictlyAfter(
      preparationAt,
      canonicalNow(input.now)
    )
  });
  const opportunity = createResearchPreflightEvaluationOpportunity({
    evaluator_seed: Buffer.from(secret.evaluator_seed_hex, "hex"),
    opportunity_context: secret.opportunity_context,
    observed_at: secret.observed_at
  });
  const decisionInput: DecideResearchMemoryControlStudyInput = {
    idempotencyKey: input.idempotencyKey,
    baseline,
    source: resolvedSource.source,
    researchAgent: input.researchAgentIdentity,
    opportunityProtocol: opportunity.descriptor(),
    directions,
    maximumBaselineRegularFileCount: maximumFileCount,
    maximumBaselineTotalBytes: maximumBytes,
    committedAt: secret.study_committed_at
  };
  const study = decideResearchMemoryControlStudy(decisionInput);
  if (existing && !isDeepStrictEqual(existing, study)) {
    throw runtimeError(
      "research_memory_control_study_workspace_conflict",
      "ResearchMemoryControlStudy source, baseline, or protocol drifted."
    );
  }
  await input.store.recordResearchMemoryControlStudy(study);
  return { study, paths, opportunity, repoRoot };
}

async function materializeDirections(
  store: LocalStore,
  directionKinds: ResearchDirectionKind[],
  researchAgent: ManagedResearchAgent & { model: string },
  createdAt: string
): Promise<Array<{
  research_direction_id: string;
  direction_kind: ResearchDirectionKind;
}>> {
  const resolved = new Map<ResearchDirectionKind, string>();
  for (const directionKind of new Set(directionKinds)) {
    const lifecycle = await resolveResearchWorkerLifecycle({
      store,
      direction_kind: directionKind,
      agent: researchAgent,
      provider_kind: researchAgent.provider === "codex"
        ? "codex_cli"
        : researchAgent.provider === "claude_code"
        ? "claude_code"
        : "fixture_only",
      candidate_arena_tick_id: `research-memory-control-preparation-${directionKind}`,
      created_at: createdAt
    });
    resolved.set(directionKind, lifecycle.direction.research_direction_id);
  }
  return directionKinds.map((directionKind) => ({
    research_direction_id: resolved.get(directionKind)!,
    direction_kind: directionKind
  }));
}

async function verifyExistingDirections(
  store: LocalStore,
  study: ResearchMemoryControlStudyRecord
): Promise<Array<{
  research_direction_id: string;
  direction_kind: ResearchDirectionKind;
}>> {
  const directions = [];
  for (const pair of study.pair_plans) {
    const direction = await store.getResearchDirection(
      pair.research_direction_ref.id
    );
    if (!direction || direction.direction_kind !== pair.direction_kind) {
      throw runtimeError(
        "research_memory_control_study_workspace_conflict",
        "ResearchMemoryControlStudy direction graph is incomplete."
      );
    }
    directions.push({
      research_direction_id: direction.research_direction_id,
      direction_kind: direction.direction_kind
    });
  }
  return directions;
}

async function prepareArm(input: {
  study: ResearchMemoryControlStudyRecord;
  pairIndex: number;
  armKind: ResearchMemoryControlArmKind;
  tickId: string;
  root: string;
  baselineRoot: string;
}): Promise<ArmRuntime> {
  const rootExists = await pathExists(input.root);
  await claimArmRoot({
    study: input.study,
    pairIndex: input.pairIndex,
    armKind: input.armKind,
    tickId: input.tickId,
    root: input.root,
    rootExists
  });
  if (!rootExists) {
    await ensureResearchExperimentStoreCopy({
      sourceRoot: input.baselineRoot,
      destinationRoot: input.root,
      expected: input.study.baseline,
      maximumRegularFileCount:
        input.study.policy.maximum_baseline_regular_file_count,
      maximumTotalBytes: input.study.policy.maximum_baseline_total_bytes
    });
  }
  const store = new LocalStore(input.root);
  const existingStudy = await store.getResearchMemoryControlStudy(
    input.study.research_memory_control_study_id
  );
  const state = await plannedArmState({
    armKind: input.armKind,
    tickId: input.tickId,
    root: input.root,
    store
  });
  if (!existingStudy) {
    if (state.hasEffect) {
      throw runtimeError(
        "research_memory_control_study_workspace_conflict",
        "ResearchMemoryControlStudy arm effect exists without study evidence.",
        { arm_kind: input.armKind }
      );
    }
    await verifyResearchExperimentBaseline({
      root: input.root,
      expected: input.study.baseline,
      maximumRegularFileCount:
        input.study.policy.maximum_baseline_regular_file_count,
      maximumTotalBytes: input.study.policy.maximum_baseline_total_bytes
    });
    await store.recordResearchMemoryControlStudy(input.study);
  } else if (!isDeepStrictEqual(existingStudy, input.study)) {
    throw runtimeError(
      "research_memory_control_study_workspace_conflict",
      "ResearchMemoryControlStudy arm contains conflicting study evidence.",
      { arm_kind: input.armKind }
    );
  } else if (!state.hasEffect) {
    await verifyResearchExperimentBaseline({
      root: input.root,
      expected: input.study.baseline,
      maximumRegularFileCount:
        input.study.policy.maximum_baseline_regular_file_count,
      maximumTotalBytes: input.study.policy.maximum_baseline_total_bytes
    });
  }
  return {
    armKind: input.armKind,
    tickId: input.tickId,
    root: input.root,
    store
  };
}

async function plannedArmState(arm: ArmRuntime): Promise<{
  hasEffect: boolean;
  hasCompleteTick: boolean;
}> {
  const [ticks, allocations, preflights, checkpoints] = await Promise.all([
    arm.store.listCandidateArenaTicks(),
    arm.store.listCandidateArenaResearchAllocations(),
    arm.store.listResearchPreflightCommitments(),
    arm.store.listResearchWorkerCheckpoints()
  ]);
  const matchingTicks = ticks.filter((tick) => tick.tick_id === arm.tickId);
  const matchingAllocations = allocations.filter(
    (allocation) => allocation.tick_id === arm.tickId
  );
  const matchingPreflights = preflights.filter(
    (preflight) => preflight.candidate_arena_tick_id === arm.tickId
  );
  const matchingCheckpoints = checkpoints.filter(
    (checkpoint) => checkpoint.candidate_arena_tick_id === arm.tickId
  );
  if (matchingTicks.length > 1 || matchingAllocations.length > 1 ||
    matchingPreflights.length > 1 || matchingCheckpoints.length > 1) {
    throw runtimeError(
      "research_memory_control_study_arm_evidence_invalid",
      "ResearchMemoryControlStudy arm evidence is ambiguous.",
      { arm_kind: arm.armKind, tick_id: arm.tickId }
    );
  }
  return {
    hasEffect: matchingTicks.length + matchingAllocations.length +
      matchingPreflights.length + matchingCheckpoints.length > 0,
    hasCompleteTick: matchingTicks.length === 1
  };
}

async function collectArmEvidence(input: {
  arm: ArmRuntime;
  directionKind: ResearchDirectionKind;
  settled?: PromiseSettledResult<CandidateArenaTickOutcome>;
}): Promise<ResearchMemoryControlArmEvidenceInput> {
  try {
    const [ticks, allocations, preflights, checkpoints] = await Promise.all([
      input.arm.store.listCandidateArenaTicks(),
      input.arm.store.listCandidateArenaResearchAllocations(),
      input.arm.store.listResearchPreflightCommitments(),
      input.arm.store.listResearchWorkerCheckpoints()
    ]);
    const tick = exactOptional(
      ticks.filter((entry) => entry.tick_id === input.arm.tickId)
    );
    const allocation = exactOptional(allocations.filter(
      (entry) => entry.tick_id === input.arm.tickId
    ));
    const preflight = exactOptional(preflights.filter(
      (entry) => entry.candidate_arena_tick_id === input.arm.tickId
    ));
    const checkpoint: ResearchWorkerCheckpointRecord | undefined =
      exactOptional(checkpoints.filter(
        (entry) => entry.candidate_arena_tick_id === input.arm.tickId
      ));
    const researchWorker = preflight
      ? await input.arm.store.getResearchWorker(
          preflight.research_worker_ref.id
        )
      : undefined;
    const result = exactDirectionResult(tick, input.directionKind);
    const admission = result?.admission_decision_id
      ? await input.arm.store.getCandidateAdmissionDecision(
          result.admission_decision_id
        )
      : undefined;
    const fingerprint = admission?.research_behavior_fingerprint_ref
      ? await input.arm.store.getResearchBehaviorFingerprint(
          admission.research_behavior_fingerprint_ref.id
        )
      : undefined;
    const terminal = armTerminalState({
      tick,
      result,
      admission,
      settled: input.settled
    });
    return {
      armKind: input.arm.armKind,
      terminalStatus: terminal.status,
      ...(tick ? { tick } : {}),
      ...(preflight ? { preflight } : {}),
      ...(checkpoint ? { checkpoint } : {}),
      ...(researchWorker ? { researchWorker } : {}),
      ...(allocation ? { allocation } : {}),
      ...(admission ? { admission } : {}),
      ...(fingerprint ? { fingerprint } : {}),
      ...(terminal.failureKind
        ? { failureKind: terminal.failureKind }
        : {}),
      ...(!result?.research_efficiency && terminal.status !== "completed"
        ? {
            resourceSummary: {
              provider_request_total: 0,
              runner_command_total: 0,
              scenario_count: 0,
              elapsed_ms: 0
            }
          }
        : {})
    };
  } catch (error) {
    if (error instanceof ResearchMemoryControlStudyRuntimeError) throw error;
    throw runtimeError(
      "research_memory_control_study_arm_evidence_invalid",
      "ResearchMemoryControlStudy arm evidence could not be reconstructed.",
      {
        arm_kind: input.arm.armKind,
        tick_id: input.arm.tickId,
        reason: conciseError(error)
      }
    );
  }
}

async function claimArmRoot(input: {
  study: ResearchMemoryControlStudyRecord;
  pairIndex: number;
  armKind: ResearchMemoryControlArmKind;
  tickId: string;
  root: string;
  rootExists: boolean;
}): Promise<void> {
  const ownerPath = `${path.resolve(input.root)}.owner.json`;
  const expected: ResearchMemoryControlArmOwner = {
    record_kind: ARM_OWNER_KIND,
    version: 1,
    study_id: input.study.research_memory_control_study_id,
    study_digest: input.study.study_digest,
    pair_index: input.pairIndex,
    arm_kind: input.armKind,
    tick_id: input.tickId,
    arm_root: path.resolve(input.root),
    owner_digest: "sha256:" + "0".repeat(64)
  };
  expected.owner_digest = canonicalDigest(armOwnerDigestInput(expected));
  const existing = await readJsonIfExists(ownerPath);
  if (input.rootExists && !existing) {
    throw armRootConflict(input);
  }
  if (!existing) {
    await openCreateOnlyJson(ownerPath, expected);
  }
  const winner = await readJsonIfExists(ownerPath);
  if (!isDeepStrictEqual(winner, expected)) {
    throw armRootConflict(input);
  }
}

function armOwnerDigestInput(
  owner: ResearchMemoryControlArmOwner
): Omit<ResearchMemoryControlArmOwner, "owner_digest"> {
  const { owner_digest: _ownerDigest, ...input } = owner;
  return input;
}

function armRootConflict(input: {
  pairIndex: number;
  armKind: ResearchMemoryControlArmKind;
}): ResearchMemoryControlStudyRuntimeError {
  return runtimeError(
    "research_memory_control_study_workspace_conflict",
    "ResearchMemoryControlStudy arm root is not owned by the planned arm.",
    { pair_index: input.pairIndex, arm_kind: input.armKind }
  );
}

function armTerminalState(input: {
  tick?: CandidateArenaTickRecord;
  result?: CandidateArenaTickDirectionResultReadModel;
  admission?: CandidateAdmissionDecisionRecord;
  settled?: PromiseSettledResult<CandidateArenaTickOutcome>;
}): {
  status: ResearchMemoryControlArmTerminalStatus;
  failureKind?: ResearchMemoryControlFailureKind;
} {
  if (!input.tick) {
    return input.settled?.status === "rejected"
      ? { status: "platform_failed", failureKind: "provider_failed" }
      : { status: "interrupted", failureKind: "restart_interrupted" };
  }
  if (!input.result || input.result.status === "failed" ||
    input.admission?.research_worker_outcome === "failed") {
    return { status: "worker_failed", failureKind: "research_worker_failed" };
  }
  if (input.result.status === "no_submission") {
    return { status: "no_submission" };
  }
  return { status: "completed" };
}

function exactDirectionResult(
  tick: CandidateArenaTickRecord | undefined,
  directionKind: ResearchDirectionKind
): CandidateArenaTickDirectionResultReadModel | undefined {
  if (!tick) return undefined;
  const matches = tick.direction_results.filter(
    (result) => result.direction_kind === directionKind
  );
  if (matches.length !== 1) {
    throw runtimeError(
      "research_memory_control_study_arm_evidence_invalid",
      "ResearchMemoryControlStudy tick must contain one exact direction result."
    );
  }
  return matches[0];
}

async function exactPersistedPairOutcomes(
  store: LocalStore,
  study: ResearchMemoryControlStudyRecord
): Promise<ResearchMemoryControlPairOutcomeRecord[]> {
  const pairs = await store.listResearchMemoryControlPairOutcomes(
    study.research_memory_control_study_id
  );
  if (pairs.length !== study.pair_plans.length || pairs.some(
    (pair, index) => pair.pair_index !== index + 1
  )) {
    throw runtimeError(
      "research_memory_control_study_arm_evidence_invalid",
      "ResearchMemoryControlStudy terminal outcome has an incomplete pair graph."
    );
  }
  return pairs;
}

async function ensureOpportunitySecret(input: {
  studyRoot: string;
  studyId: string;
  studyCommittedAt: string;
}): Promise<ResearchPreflightOpportunitySecret> {
  const secretPath = path.join(
    input.studyRoot,
    "runtime-private",
    "evaluation-opportunity.json"
  );
  const existing = await readOpportunitySecret(secretPath);
  if (existing) return assertOpportunitySecret(existing, input.studyId);
  const opportunityContext = `research-memory-control:${input.studyId}`;
  const record: ResearchPreflightOpportunitySecret = {
    record_kind: OPPORTUNITY_SECRET_KIND,
    version: 1,
    study_id: input.studyId,
    opportunity_context: opportunityContext,
    observed_at: input.studyCommittedAt,
    study_committed_at: input.studyCommittedAt,
    evaluator_seed_hex: randomBytes(32).toString("hex"),
    secret_digest: "sha256:" + "0".repeat(64)
  };
  record.secret_digest = canonicalDigest(opportunitySecretDigestInput(record));
  await openCreateOnlyJson(secretPath, record);
  const winner = await readOpportunitySecret(secretPath);
  if (!winner) {
    throw runtimeError(
      "research_memory_control_study_opportunity_secret_invalid",
      "ResearchMemoryControlStudy opportunity secret was not published."
    );
  }
  return assertOpportunitySecret(winner, input.studyId);
}

async function readOpportunitySecret(
  secretPath: string
): Promise<unknown | undefined> {
  return readJsonIfExists(secretPath, () => runtimeError(
    "research_memory_control_study_opportunity_secret_invalid",
    "ResearchMemoryControlStudy opportunity secret is unreadable."
  ));
}

async function readJsonIfExists(
  filePath: string,
  invalidJson: () => Error = () => runtimeError(
    "research_memory_control_study_workspace_conflict",
    "ResearchMemoryControlStudy runtime ownership evidence is unreadable."
  )
): Promise<unknown | undefined> {
  const content = await readFile(filePath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (content === undefined) return undefined;
  try {
    return JSON.parse(content);
  } catch {
    throw invalidJson();
  }
}

function assertOpportunitySecret(
  value: unknown,
  studyId: string
): ResearchPreflightOpportunitySecret {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).sort().join("\0") !== [
      "evaluator_seed_hex",
      "observed_at",
      "opportunity_context",
      "record_kind",
      "secret_digest",
      "study_committed_at",
      "study_id",
      "version"
    ].sort().join("\0")) {
    throw invalidOpportunitySecret();
  }
  const record = value as ResearchPreflightOpportunitySecret;
  if (record.record_kind !== OPPORTUNITY_SECRET_KIND || record.version !== 1 ||
    record.study_id !== studyId || record.opportunity_context !==
      `research-memory-control:${studyId}` ||
    !/^[a-f0-9]{64}$/.test(record.evaluator_seed_hex) ||
    !canonicalIso(record.observed_at) ||
    !canonicalIso(record.study_committed_at) ||
    record.observed_at !== record.study_committed_at ||
    canonicalDigest(opportunitySecretDigestInput(record)) !==
      record.secret_digest) {
    throw invalidOpportunitySecret();
  }
  return record;
}

async function openCreateOnlyJson(
  filePath: string,
  value: unknown
): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  let handle;
  try {
    handle = await open(filePath, "wx", 0o600);
    await handle.writeFile(
      `${paperTradingComparisonPersistedRecordDigestInput(value)}\n`,
      "utf8"
    );
    await handle.sync();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  } finally {
    await handle?.close();
  }
}

function opportunitySecretDigestInput(
  secret: ResearchPreflightOpportunitySecret
): Omit<ResearchPreflightOpportunitySecret, "secret_digest"> {
  const { secret_digest: _secretDigest, ...input } = secret;
  return input;
}

function evidenceTimes(
  evidence: ResearchMemoryControlArmEvidenceInput[]
): string[] {
  return evidence.flatMap((arm) => [
    arm.tick?.started_at,
    arm.tick?.completed_at,
    arm.preflight?.committed_at,
    arm.checkpoint?.closed_at,
    arm.researchWorker?.created_at,
    arm.allocation?.allocated_at,
    arm.admission?.decided_at,
    arm.fingerprint?.created_at
  ].filter((value): value is string => value !== undefined));
}

function exactOptional<T>(values: T[]): T | undefined {
  if (values.length > 1) {
    throw runtimeError(
      "research_memory_control_study_arm_evidence_invalid",
      "ResearchMemoryControlStudy evidence identity is ambiguous."
    );
  }
  return values[0];
}

function assertAgentIdentity(
  identity: ManagedResearchAgent & { model: string }
): void {
  if (!identity || !identity.id || !identity.model || ![
    "codex",
    "claude_code",
    "fixture"
  ].includes(identity.provider) || (identity.provider === "fixture"
    ? identity.permission_policy !== "fixture_only"
    : identity.permission_policy !== "artifact_workspace_only")) {
    throw runtimeError(
      "research_memory_control_study_agent_identity_mismatch",
      "ResearchMemoryControlStudy requires one exact managed-agent identity."
    );
  }
}

function assertRuntimeAgentIdentity(
  runtimeAgent: TradingResearchRuntimeAgent,
  identity: ManagedResearchAgent & { model: string }
): void {
  assertAgentIdentity(identity);
  if ((runtimeAgent === "codex" && identity.provider !== "codex") ||
    (runtimeAgent === "fixture" && identity.provider !== "fixture")) {
    throw runtimeError(
      "research_memory_control_study_agent_identity_mismatch",
      "ResearchMemoryControlStudy runtime agent differs from frozen identity."
    );
  }
}

function strictMonotonicClock(
  now: (() => string) | undefined,
  floor: string
): { next: () => string; after: (...times: string[]) => string } {
  let latest = Date.parse(floor);
  const next = () => {
    const requested = Date.parse(canonicalNow(now));
    latest = Math.max(latest + 1, requested);
    return new Date(latest).toISOString();
  };
  const after = (...times: string[]) => {
    for (const time of times) {
      if (canonicalIso(time)) latest = Math.max(latest, Date.parse(time));
    }
    return next();
  };
  return { next, after };
}

function canonicalNow(now: (() => string) | undefined): string {
  const value = now?.() ?? new Date().toISOString();
  if (!canonicalIso(value)) {
    throw runtimeError(
      "research_memory_control_study_workspace_invalid",
      "ResearchMemoryControlStudy clock is invalid."
    );
  }
  return value;
}

function strictlyAfter(left: string, right: string): string {
  return new Date(Math.max(Date.parse(left) + 1, Date.parse(right))).toISOString();
}

function canonicalIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function canonicalPath(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw runtimeError(
      "research_memory_control_study_workspace_invalid",
      "ResearchMemoryControlStudy path is invalid."
    );
  }
  return value;
}

function canonicalIdentifier(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw runtimeError(
      "research_memory_control_study_workspace_invalid",
      "ResearchMemoryControlStudy identifier is invalid."
    );
  }
  return value;
}

function safePathSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (!normalized || normalized === "." || normalized === "..") {
    throw runtimeError(
      "research_memory_control_study_workspace_invalid",
      "ResearchMemoryControlStudy path segment is invalid."
    );
  }
  return normalized;
}

function pathsOverlap(left: string, right: string): boolean {
  return pathContains(left, right) || pathContains(right, left);
}

async function assertPhysicalPathsDisjoint(
  left: string,
  right: string,
  message: string
): Promise<void> {
  const [physicalLeft, physicalRight] = await Promise.all([
    resolvePhysicalTarget(left),
    resolvePhysicalTarget(right)
  ]);
  if (pathsOverlap(physicalLeft, physicalRight)) {
    throw runtimeError(
      "research_memory_control_study_workspace_overlaps_source",
      message
    );
  }
}

async function resolvePhysicalTarget(candidate: string): Promise<string> {
  const suffix: string[] = [];
  let current = path.resolve(canonicalPath(candidate));
  while (true) {
    try {
      return path.join(await realpath(current), ...suffix.reverse());
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(candidate);
      suffix.push(path.basename(current));
      current = parent;
    }
  }
}

function pathContains(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") &&
    !path.isAbsolute(relative));
}

async function pathExists(candidate: string): Promise<boolean> {
  return Boolean(await stat(candidate).catch(() => undefined));
}

function canonicalDigest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonPersistedRecordDigestInput(value))
    .digest("hex")}`;
}

function conciseError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function invalidOpportunitySecret(): ResearchMemoryControlStudyRuntimeError {
  return runtimeError(
    "research_memory_control_study_opportunity_secret_invalid",
    "ResearchMemoryControlStudy opportunity secret is invalid."
  );
}

function runtimeError(
  code: ResearchMemoryControlStudyRuntimeErrorCode,
  message: string,
  details?: Record<string, unknown>
): ResearchMemoryControlStudyRuntimeError {
  return new ResearchMemoryControlStudyRuntimeError(code, message, details);
}
