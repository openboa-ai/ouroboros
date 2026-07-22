import { createHash } from "node:crypto";
import {
  candidateEgressAttestationIdForConformance,
  paperTradingComparisonPersistedRecordDigestInput,
  type ArenaComparisonCohortReadModel,
  type ArenaIsolationReadModel,
  type ArenaLogEntryReadModel,
  type ArenaOperationsReadModel,
  type ArenaPaperSessionStatus,
  type ArenaTraceEventKind,
  type ArenaTraceEventReadModel,
  type ArenaTradingSystemDetailReadModel,
  type ArenaTradingSystemSummaryReadModel,
  type ArenaUnrankedReason,
  type CandidateInspectReadModel,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingHandoffConformanceRecord,
  type PaperTradingObservationRecord,
  type Ref,
  type TradingProfitLossReadModel,
  verifyCandidateEgressAttestation
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import {
  paperTradingEvaluationCommitmentMatchesEvaluation
} from "../trading/paper/commitment";
import { classifyPaperTradingFailure } from "../trading/paper/failures";
import type {
  ArenaPaperRuntimeService,
  ArenaPaperRuntimeSnapshot,
  ArenaPaperRuntimeSystem
} from "../trading/paper/arena-runtime";

const ARENA_TRACE_LIMIT = 100;
const ARENA_LOG_LIMIT = 100;
const ARENA_TEXT_LIMIT = 500;
const POSIX_ABSOLUTE_PATH_PATTERN =
  /(^|[^A-Za-z0-9._~\/-])\/(?!\/)[^\s<>"']+/g;
const WINDOWS_DRIVE_ABSOLUTE_PATH_PATTERN =
  /\b[A-Za-z]:[\\\/](?![\\\/])[^\s<>"']+/g;
const WINDOWS_UNC_ABSOLUTE_PATH_PATTERN =
  /(^|[^\\])\\\\(?!\\)[^\s<>"']+/g;
const SECRET_ASSIGNMENT_PATTERN =
  /(^|[^A-Za-z0-9_])((?:[A-Za-z][A-Za-z0-9_]*_)?(?:api[_-]?key|api[_-]?secret|token|password))\s*[:=]\s*\S+/gi;

type ArenaOperationsStore = Pick<
  OuroborosStorePort,
  | "getCandidate"
  | "getPaperTradingEvaluation"
  | "getPaperTradingEvaluationCommitment"
  | "listPaperTradingObservations"
  | "getPaperTradingHandoffConformance"
>;

export interface ArenaOperationsProjectionServiceOptions {
  store: ArenaOperationsStore;
  arenaPaperRuntime: Pick<ArenaPaperRuntimeService, "snapshot">;
}

interface LoadedArenaSystem {
  runtime: ArenaPaperRuntimeSystem;
  candidate?: CandidateInspectReadModel;
  evaluation?: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
  observations: PaperTradingObservationRecord[];
}

interface PreparedArenaSystem extends LoadedArenaSystem {
  base: ArenaSummaryBase;
  cohort?: ArenaComparisonCohortReadModel;
  evidenceComplete: boolean;
  rankLifecycleEligible: boolean;
}

type ArenaSummaryBase = Omit<
  ArenaTradingSystemSummaryReadModel,
  | "rank_status"
  | "rank"
  | "comparability_status"
  | "unranked_reasons"
  | "comparison_cohort"
  | "comparison_sequence"
  | "comparison_cutoff_at"
>;

interface CommonBoundary {
  sequence: number;
  cutoffAt: string;
}

interface PendingTraceEvent {
  occurredAt: string;
  eventKind: ArenaTraceEventKind;
  summary: string;
  recordRef?: Ref;
  insertionOrder: number;
}

interface PendingLogEntry {
  occurredAt: string;
  level: ArenaLogEntryReadModel["level"];
  source: ArenaLogEntryReadModel["source"];
  message: string;
  insertionOrder: number;
}

export class ArenaOperationsProjectionService {
  constructor(private readonly options: ArenaOperationsProjectionServiceOptions) {}

  async readOperations(): Promise<ArenaOperationsReadModel> {
    const { snapshot, loaded } = await this.load();
    return projectOperations(snapshot, loaded);
  }

  async readSystemDetail(
    candidateId: string
  ): Promise<ArenaTradingSystemDetailReadModel | undefined> {
    const { snapshot, loaded } = await this.load();
    const operations = projectOperations(snapshot, loaded);
    const summary = operations.systems.find((entry) =>
      entry.candidate_id === candidateId
    );
    const source = loaded.find((entry) =>
      entry.runtime.candidate_ref.id === candidateId
    );
    if (!summary || !source?.candidate) {
      return undefined;
    }
    const conformance = await this.options.store.getPaperTradingHandoffConformance(
      source.runtime.paper_trading_handoff_conformance_ref.id
    );
    return projectDetail(summary, source, conformance);
  }

  private async load(): Promise<{
    snapshot: ArenaPaperRuntimeSnapshot;
    loaded: LoadedArenaSystem[];
  }> {
    const snapshot = await this.options.arenaPaperRuntime.snapshot();
    const loaded = await Promise.all(snapshot.systems.map(async (runtime) => {
      const [candidate, evaluation] = await Promise.all([
        this.options.store.getCandidate(runtime.candidate_ref.id),
        runtime.paper_trading_evaluation_ref
          ? this.options.store.getPaperTradingEvaluation(
              runtime.paper_trading_evaluation_ref.id
            )
          : Promise.resolve(undefined)
      ]);
      const commitment = evaluation?.paper_trading_evaluation_commitment_ref
        ? await this.options.store.getPaperTradingEvaluationCommitment(
            evaluation.paper_trading_evaluation_commitment_ref.id
          )
        : undefined;
      const observations = evaluation
        ? await this.options.store.listPaperTradingObservations(
            evaluation.paper_trading_evaluation_id
          )
        : [];
      return {
        runtime,
        candidate,
        evaluation,
        commitment,
        observations: [...observations].sort((left, right) =>
          left.sequence - right.sequence ||
          left.paper_trading_observation_id.localeCompare(
            right.paper_trading_observation_id
          )
        )
      };
    }));
    return { snapshot, loaded };
  }
}

function projectOperations(
  snapshot: ArenaPaperRuntimeSnapshot,
  loaded: LoadedArenaSystem[]
): ArenaOperationsReadModel {
  const prepared = loaded.map(prepareSystem);
  const activeCohortId = selectActiveCohortId(prepared);
  const comparable = activeCohortId
    ? prepared.filter((entry) =>
        entry.cohort?.cohort_id === activeCohortId &&
        entry.evidenceComplete &&
        entry.rankLifecycleEligible &&
        entry.observations.length > 0
      )
    : [];
  const boundary = comparable.length >= 2
    ? commonBoundary(comparable)
    : undefined;
  const ranked = boundary
    ? comparable
        .map((entry) => ({
          entry,
          score: scoreAtBoundary(entry.observations, boundary)
        }))
        .filter((value): value is {
          entry: PreparedArenaSystem;
          score: TradingProfitLossReadModel;
        } => value.score !== undefined)
        .sort((left, right) => compareScores(left.score, right.score) ||
          left.entry.runtime.candidate_ref.id.localeCompare(
            right.entry.runtime.candidate_ref.id
          ))
    : [];
  const rankByCandidateId = new Map(ranked.map((entry, index) => [
    entry.entry.runtime.candidate_ref.id,
    { rank: index + 1, score: entry.score }
  ]));
  const systems = prepared
    .map((entry): ArenaTradingSystemSummaryReadModel => {
      const rankedEntry = rankByCandidateId.get(
        entry.runtime.candidate_ref.id
      );
      if (rankedEntry && boundary && entry.cohort) {
        return {
          ...entry.base,
          evaluation_id: entry.evaluation!.paper_trading_evaluation_id,
          trading_run_id: entry.evaluation!.trading_run_ref.id,
          profit_loss: { ...rankedEntry.score },
          rank: rankedEntry.rank,
          comparability_status: "comparable",
          unranked_reasons: [],
          comparison_cohort: cloneJson(entry.cohort),
          comparison_sequence: boundary.sequence,
          comparison_cutoff_at: boundary.cutoffAt,
          ...(entry.runtime.lifecycle_status === "running" ||
            entry.runtime.lifecycle_status === "recovering"
            ? {
                session_status: entry.runtime.lifecycle_status,
                rank_status: "provisional_ranked" as const
              }
            : {
                session_status: entry.runtime.lifecycle_status as
                  "stopped" | "completed",
                rank_status: "ranked" as const
              })
        };
      }
      return unrankedSystem(entry, activeCohortId, boundary);
    })
    .sort((left, right) => {
      const leftRank = left.rank_status === "unranked"
        ? Number.POSITIVE_INFINITY
        : left.rank;
      const rightRank = right.rank_status === "unranked"
        ? Number.POSITIVE_INFINITY
        : right.rank;
      return leftRank - rightRank ||
        left.queued_at.localeCompare(right.queued_at) ||
        left.candidate_id.localeCompare(right.candidate_id);
    });

  return {
    projection_kind: "arena_operations",
    loop_status: arenaLoopStatus(snapshot),
    capacity: {
      max_concurrent_sessions: snapshot.capacity,
      active_session_count: snapshot.running_count + snapshot.recovering_count,
      queued_session_count: snapshot.queued_count + snapshot.starting_count
    },
    systems,
    ...(latestSystemId(snapshot.systems)
      ? { latest_system_id: latestSystemId(snapshot.systems) }
      : {}),
    live_disabled: true,
    authority_status: "not_live"
  };
}

function prepareSystem(source: LoadedArenaSystem): PreparedArenaSystem {
  const latestObservation = source.observations.at(-1);
  const latestFailureReason = latestObservation?.failure_reason ??
    source.evaluation?.latest_failure_reason ??
    source.runtime.failure_reason;
  const commitmentValid = Boolean(
    source.commitment &&
    source.evaluation &&
    paperTradingEvaluationCommitmentMatchesEvaluation(
      source.commitment,
      source.evaluation
    ) &&
    source.commitment.system_code_ref.record_kind === "system_code" &&
    source.commitment.system_code_ref.id === source.runtime.system_code_ref.id &&
    source.commitment.candidate_ref.id === source.runtime.candidate_ref.id &&
    source.commitment.candidate_version_ref.id ===
      source.runtime.candidate_version_ref.id &&
    source.commitment.trading_run_ref.id === source.runtime.trading_run_ref.id
  );
  const evidenceComplete = commitmentValid && Boolean(
    source.evaluation && observationChainComplete(
      source.evaluation,
      source.commitment!,
      source.observations
    )
  );
  const cohort = commitmentValid
    ? comparisonCohort(source.commitment!)
    : undefined;
  const base: ArenaSummaryBase = {
    candidate_id: source.runtime.candidate_ref.id,
    candidate_version_id: source.runtime.candidate_version_ref.id,
    system_code_ref: {
      record_kind: "system_code",
      id: source.runtime.system_code_ref.id
    },
    display_name: sanitizeText(
      source.candidate?.display_name ?? source.runtime.candidate_ref.id
    ),
    direction_kind: source.candidate?.full_cycle_lineage?.evidence?.direction_kind ??
      "other",
    runner_status: runnerStatus(source.runtime),
    sandbox_status: sandboxStatus(source.candidate, source.runtime),
    ...(source.evaluation
      ? {
          evaluation_id: source.evaluation.paper_trading_evaluation_id,
          trading_run_id: source.evaluation.trading_run_ref.id,
          profit_loss: { ...source.evaluation.latest_score }
        }
      : {}),
    observation_count: source.evaluation?.observation_count ?? 0,
    failed_observation_count: source.observations.filter((entry) =>
      entry.status === "failed"
    ).length,
    queued_at: source.runtime.admission_decided_at,
    ...((source.runtime.lifecycle_status !== "queued" &&
      source.runtime.lifecycle_status !== "starting" &&
      source.evaluation)
      ? { started_at: source.evaluation.started_at }
      : {}),
    ...(source.evaluation?.last_observed_at
      ? { last_observed_at: source.evaluation.last_observed_at }
      : {}),
    ...(source.evaluation?.next_observation_at
      ? { next_observation_at: source.evaluation.next_observation_at }
      : {}),
    ...(source.evaluation?.stopped_at
      ? { stopped_at: source.evaluation.stopped_at }
      : {}),
    ...(classifyPaperTradingFailure(latestFailureReason)
      ? { latest_failure: classifyPaperTradingFailure(latestFailureReason) }
      : {}),
    ...(latestObservation?.decision
      ? { latest_decision: sanitizeDecision(latestObservation.decision) }
      : {}),
    ...((latestObservation?.latest_fill ?? source.evaluation?.latest_fill)
      ? {
          latest_fill: cloneJson(
            latestObservation?.latest_fill ?? source.evaluation!.latest_fill!
          )
        }
      : {}),
    session_status: source.runtime.lifecycle_status as ArenaPaperSessionStatus,
    authority_status: "not_live"
  };
  return {
    ...source,
    base,
    cohort,
    evidenceComplete,
    rankLifecycleEligible:
      source.runtime.lifecycle_status === "running" ||
      source.runtime.lifecycle_status === "recovering" ||
      source.runtime.lifecycle_status === "stopped"
  };
}

function unrankedSystem(
  entry: PreparedArenaSystem,
  activeCohortId: string | undefined,
  boundary: CommonBoundary | undefined
): ArenaTradingSystemSummaryReadModel {
  const evaluation = entry.evaluation;
  if (!evaluation || evaluation.status === "not_started") {
    return nonComparable(entry, "ineligible", ["paper_evaluation_not_started"]);
  }
  if (evaluation.status === "invalidated" ||
    entry.runtime.lifecycle_status === "invalidated") {
    return nonComparable(entry, "ineligible", ["paper_evaluation_invalidated"]);
  }
  if (!entry.commitment) {
    return nonComparable(entry, "ineligible", ["comparison_cohort_missing"]);
  }
  if (!entry.cohort || !entry.evidenceComplete ||
    evaluation.status === "failed" ||
    entry.runtime.lifecycle_status === "failed") {
    return nonComparable(entry, "ineligible", ["comparison_evidence_incomplete"]);
  }
  if (!activeCohortId || entry.cohort.cohort_id !== activeCohortId) {
    return nonComparable(entry, "incomparable", ["comparison_cohort_mismatch"]);
  }
  if (!entry.rankLifecycleEligible || !boundary ||
    !scoreAtBoundary(entry.observations, boundary)) {
    return {
      ...entry.base,
      session_status: entry.runtime.lifecycle_status as ArenaPaperSessionStatus,
      rank_status: "unranked",
      comparability_status: "comparable",
      unranked_reasons: ["common_observation_boundary_missing"],
      comparison_cohort: cloneJson(entry.cohort)
    };
  }
  return nonComparable(entry, "ineligible", ["comparison_evidence_incomplete"]);
}

function nonComparable(
  entry: PreparedArenaSystem,
  status: "ineligible" | "incomparable",
  reasons: [ArenaUnrankedReason, ...ArenaUnrankedReason[]]
): ArenaTradingSystemSummaryReadModel {
  return {
    ...entry.base,
    session_status: entry.runtime.lifecycle_status as ArenaPaperSessionStatus,
    rank_status: "unranked",
    comparability_status: status,
    unranked_reasons: reasons
  };
}

function selectActiveCohortId(
  systems: PreparedArenaSystem[]
): string | undefined {
  const groups = new Map<string, PreparedArenaSystem[]>();
  for (const system of systems) {
    if (!system.cohort || !system.evidenceComplete ||
      !system.rankLifecycleEligible) {
      continue;
    }
    const group = groups.get(system.cohort.cohort_id) ?? [];
    group.push(system);
    groups.set(system.cohort.cohort_id, group);
  }
  return [...groups.entries()]
    .sort(([leftId, left], [rightId, right]) =>
      right.length - left.length ||
      newestCommitmentAt(right).localeCompare(newestCommitmentAt(left)) ||
      leftId.localeCompare(rightId)
    )[0]?.[0];
}

function newestCommitmentAt(systems: PreparedArenaSystem[]): string {
  return systems.reduce((latest, entry) =>
    (entry.commitment?.committed_at ?? "") > latest
      ? entry.commitment!.committed_at
      : latest, "");
}

function commonBoundary(
  systems: PreparedArenaSystem[]
): CommonBoundary | undefined {
  const [first, ...rest] = systems;
  if (!first) return undefined;
  const sharedSequences = new Set(first.observations.map((entry) =>
    entry.sequence
  ));
  for (const system of rest) {
    const sequences = new Set(system.observations.map((entry) =>
      entry.sequence
    ));
    for (const sequence of sharedSequences) {
      if (!sequences.has(sequence)) sharedSequences.delete(sequence);
    }
  }
  const sequence = [...sharedSequences].sort((left, right) =>
    right - left
  )[0];
  if (sequence === undefined) return undefined;
  const observations = systems
    .map((system) => system.observations.find((entry) =>
      entry.sequence === sequence
    ))
    .filter((entry): entry is PaperTradingObservationRecord =>
      entry !== undefined
    );
  if (observations.length !== systems.length) return undefined;
  const cutoffAt = observations.reduce((latest, entry) =>
    entry.observed_at > latest ? entry.observed_at : latest, "");
  return cutoffAt ? { sequence, cutoffAt } : undefined;
}

function scoreAtBoundary(
  observations: PaperTradingObservationRecord[],
  boundary: CommonBoundary
): TradingProfitLossReadModel | undefined {
  const observation = observations.find((entry) =>
    entry.sequence === boundary.sequence
  );
  return observation ? { ...observation.cumulative_score } : undefined;
}

function compareScores(
  left: TradingProfitLossReadModel,
  right: TradingProfitLossReadModel
): number {
  return right.net_revenue_usdt - left.net_revenue_usdt ||
    right.net_return_pct - left.net_return_pct;
}

function observationChainComplete(
  evaluation: PaperTradingEvaluationRecord,
  commitment: PaperTradingEvaluationCommitmentRecord,
  observations: PaperTradingObservationRecord[]
): boolean {
  if (evaluation.observation_count !== observations.length) return false;
  return observations.every((entry, index) =>
    entry.sequence === index + 1 &&
    entry.paper_trading_evaluation_ref.id ===
      evaluation.paper_trading_evaluation_id &&
    entry.paper_trading_evaluation_commitment_ref?.id ===
      commitment.paper_trading_evaluation_commitment_id &&
    entry.candidate_ref.id === commitment.candidate_ref.id &&
    entry.candidate_version_ref.id === commitment.candidate_version_ref.id &&
    entry.trading_run_ref.id === commitment.trading_run_ref.id
  );
}

function comparisonCohort(
  commitment: PaperTradingEvaluationCommitmentRecord
): ArenaComparisonCohortReadModel {
  const marketOpportunity = {
    data_identity: commitment.data_identity,
    window_policy: commitment.window_policy
  };
  const account = {
    initial_account_snapshot: commitment.initial_account_snapshot,
    policy_version: commitment.policy_identity.paper_account_policy_version
  };
  const cost = {
    cost_policy_version: commitment.policy_identity.cost_policy_version,
    funding_policy_version: commitment.policy_identity.funding_policy_version,
    slippage_policy_version: commitment.policy_identity.slippage_policy_version,
    fill_policy_version: commitment.policy_identity.fill_policy_version
  };
  const risk = {
    risk_policy_version: commitment.policy_identity.risk_policy_version
  };
  return {
    cohort_id: digest({
      evidence_purpose: commitment.evidence_purpose,
      market_opportunity: marketOpportunity,
      account,
      cost,
      risk,
      policy_identity: commitment.policy_identity,
      window_policy: commitment.window_policy
    }),
    symbol: "BTCUSDT",
    evidence_purpose: commitment.evidence_purpose,
    market_opportunity_policy_digest: digest(marketOpportunity),
    account_policy_digest: digest(account),
    cost_policy_digest: digest(cost),
    risk_policy_digest: digest(risk),
    evaluation_policy_identity: cloneJson(commitment.policy_identity),
    evaluation_window_policy: cloneJson(commitment.window_policy),
    authority_status: "not_live"
  };
}

function projectDetail(
  summary: ArenaTradingSystemSummaryReadModel,
  source: LoadedArenaSystem,
  conformance: PaperTradingHandoffConformanceRecord | undefined
): ArenaTradingSystemDetailReadModel {
  const candidate = source.candidate!;
  const latestObservation = source.observations.at(-1);
  const trace = traceEvents(source);
  const logs = logEntries(candidate);
  const declaredRuntime = candidate.system_code?.declared_runtime ??
    candidate.program?.manifest?.declared_runtime;
  return {
    ...summary,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: source.runtime.candidate_admission_decision_ref.id
    },
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: source.runtime.paper_trading_handoff_conformance_ref.id
    },
    isolation: isolationReadModel(source, conformance),
    trading_system_manifest: {
      summary: sanitizeText(candidate.system_code?.summary ?? candidate.display_name),
      ...(declaredRuntime
        ? {
            declared_runtime: sanitizeText(declaredRuntime)
          }
        : {}),
      declared_outputs: [
        ...(candidate.system_code?.declared_outputs ??
          candidate.program?.manifest?.declared_outputs ?? [])
      ].map(sanitizeText),
      allowed_stages: [
        ...(candidate.capability_package?.manifest?.allowed_stages ?? [])
      ].map(sanitizeText),
      declared_permissions: [
        ...(candidate.capability_package?.manifest?.declared_permissions ?? [])
      ].map(sanitizeText),
      forbidden_contents: [
        ...(candidate.capability_package?.manifest?.forbidden_contents ?? [])
      ].map(sanitizeText)
    },
    ...(candidate.full_cycle_lineage
      ? { lineage: sanitizeLineage(candidate.full_cycle_lineage) }
      : {}),
    ...(latestObservation?.market_snapshot
      ? { latest_market_snapshot: cloneJson(latestObservation.market_snapshot) }
      : {}),
    ...(latestObservation?.decision
      ? { latest_decision: sanitizeDecision(latestObservation.decision) }
      : {}),
    ...((latestObservation?.paper_account_snapshot ??
      source.evaluation?.paper_account_snapshot)
      ? {
          paper_account_snapshot: cloneJson(
            latestObservation?.paper_account_snapshot ??
              source.evaluation!.paper_account_snapshot!
          )
        }
      : {}),
    open_orders: cloneJson(
      latestObservation?.open_orders ?? source.evaluation?.open_orders ?? []
    ),
    ...((latestObservation?.latest_fill ?? source.evaluation?.latest_fill)
      ? {
          latest_fill: cloneJson(
            latestObservation?.latest_fill ?? source.evaluation!.latest_fill!
          )
        }
      : {}),
    trace_events: trace.items,
    log_entries: logs.items,
    artifact_refs: artifactRefs(source),
    trace_truncated: trace.truncated,
    logs_truncated: logs.truncated
  };
}

function isolationReadModel(
  source: LoadedArenaSystem,
  conformance: PaperTradingHandoffConformanceRecord | undefined
): ArenaIsolationReadModel {
  const sandbox = source.candidate?.runtime.sandbox;
  const workspaceIdentity = exactWorkspaceIdentity(
    source.runtime.workspace_key,
    sandbox?.workspace_key
  );
  const adapterConsistent = sandboxConformanceAdapterConsistent(
    sandbox,
    conformance
  );
  const sandboxIdentityConsistent = !sandbox ||
    !source.runtime.sandbox_ref ||
    source.runtime.sandbox_ref.id === sandbox.sandbox_id;
  return {
    ...(sandbox ? { isolation_id: sandbox.sandbox_id } : {}),
    sandbox_status: sandboxStatus(source.candidate, source.runtime),
    ...(workspaceIdentity
      ? { workspace_identity: workspaceIdentity }
      : {}),
    network_policy_status: networkPolicyStatus(
      sandbox,
      conformance,
      workspaceIdentity !== undefined,
      adapterConsistent && sandboxIdentityConsistent
    ),
    egress_attestation_status: egressAttestationStatus(
      sandbox,
      conformance,
      adapterConsistent && sandboxIdentityConsistent &&
        conformanceMatchesRuntime(source, conformance)
    ),
    authority_status: "not_live"
  };
}

function networkPolicyStatus(
  sandbox: CandidateInspectReadModel["runtime"]["sandbox"],
  conformance: PaperTradingHandoffConformanceRecord | undefined,
  workspaceConsistent: boolean,
  evidenceConsistent: boolean
): ArenaIsolationReadModel["network_policy_status"] {
  const adapterKind = sandbox?.adapter_kind ?? conformance?.runner_kind;
  if (!evidenceConsistent) return "failed";
  if (adapterKind === "host_process" || adapterKind === "deterministic_test") {
    return "not_required";
  }
  if (adapterKind !== "docker_sandboxes_sbx" || !sandbox) return "pending";
  if (!workspaceConsistent) return "failed";
  if (sandbox.lifecycle_status === "requested" ||
    sandbox.lifecycle_status === "created" ||
    sandbox.lifecycle_status === "starting") {
    return "pending";
  }
  if (sandbox.lifecycle_status === "running" ||
    sandbox.lifecycle_status === "removed") {
    return "verified";
  }
  return "failed";
}

function egressAttestationStatus(
  sandbox: CandidateInspectReadModel["runtime"]["sandbox"],
  conformance: PaperTradingHandoffConformanceRecord | undefined,
  evidenceConsistent: boolean
): ArenaIsolationReadModel["egress_attestation_status"] {
  const adapterKind = sandbox?.adapter_kind ?? conformance?.runner_kind;
  if (!evidenceConsistent) return "failed";
  if (adapterKind === "host_process" || adapterKind === "deterministic_test") {
    return "not_required";
  }
  if (!conformance || conformance.version !== 2 ||
    conformance.status !== "passed" || !conformance.runnable_paper_handoff) {
    return "failed";
  }
  const attestation = conformance.candidate_egress_attestation;
  return verifyCandidateEgressAttestation({
    attestation,
    expected: {
      attestation_id: candidateEgressAttestationIdForConformance(
        conformance.paper_trading_handoff_conformance_id
      ),
      system_code_ref: conformance.system_code_ref,
      system_code_artifact_digest: conformance.system_code_artifact_digest,
      execution_ref: conformance.experiment_run_ref,
      sandbox_name: attestation.sandbox.sandbox_name,
      sandbox_implementation_version: attestation.sandbox.implementation_version,
      conformance_started_at: conformance.started_at,
      conformance_completed_at: conformance.completed_at
    },
    consumed_attestation_digests: [],
    sha256: sha256Text
  }).status === "verified"
    ? "verified"
    : "failed";
}

function sandboxConformanceAdapterConsistent(
  sandbox: CandidateInspectReadModel["runtime"]["sandbox"],
  conformance: PaperTradingHandoffConformanceRecord | undefined
): boolean {
  if (!conformance) return true;
  if (!sandbox) return conformance.runner_kind !== "docker_sandboxes_sbx";
  return sandbox.adapter_kind === "docker_sandboxes_sbx"
    ? conformance.runner_kind === "docker_sandboxes_sbx"
    : conformance.runner_kind === "host_process";
}

function conformanceMatchesRuntime(
  source: LoadedArenaSystem,
  conformance: PaperTradingHandoffConformanceRecord | undefined
): boolean {
  return Boolean(
    conformance &&
    conformance.paper_trading_handoff_conformance_id ===
      source.runtime.paper_trading_handoff_conformance_ref.id &&
    conformance.system_code_ref.record_kind === "system_code" &&
    conformance.system_code_ref.id === source.runtime.system_code_ref.id
  );
}

function traceEvents(source: LoadedArenaSystem): {
  items: ArenaTraceEventReadModel[];
  truncated: boolean;
} {
  const pending: PendingTraceEvent[] = [];
  let insertionOrder = 0;
  for (const observation of source.observations) {
    const observationRef = {
      record_kind: "paper_trading_observation",
      id: observation.paper_trading_observation_id
    };
    if (observation.market_snapshot) {
      pending.push({
        occurredAt: observation.observed_at,
        eventKind: "market_observation",
        summary: `${observation.market_snapshot.symbol} public price ${observation.market_snapshot.price}`,
        recordRef: observationRef,
        insertionOrder: insertionOrder++
      });
    }
    if (observation.decision) {
      pending.push({
        occurredAt: observation.decision.observed_at,
        eventKind: "trading_system_decision",
        summary: `${observation.decision.decision_kind}: ${observation.decision.reason}`,
        recordRef: observationRef,
        insertionOrder: insertionOrder++
      });
    }
  }
  for (const item of source.candidate?.runtime.transcript?.items ?? []) {
    if (item.item_kind === "sandbox_log" ||
      item.item_kind === "sandbox_heartbeat") continue;
    pending.push({
      occurredAt: item.occurred_at,
      eventKind: transcriptEventKind(item.item_kind),
      summary: `${item.label}: ${item.summary}`,
      ...(item.ref ? { recordRef: { ...item.ref } } : {}),
      insertionOrder: insertionOrder++
    });
  }
  pending.sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.insertionOrder - right.insertionOrder
  );
  const bounded = pending.length > ARENA_TRACE_LIMIT
    ? pending.slice(-ARENA_TRACE_LIMIT)
    : pending;
  return {
    items: bounded.map((entry, index) => ({
      sequence: index + 1,
      occurred_at: entry.occurredAt,
      event_kind: entry.eventKind,
      summary: sanitizeText(entry.summary),
      sanitized: true,
      ...(entry.recordRef ? { record_ref: entry.recordRef } : {}),
      authority_status: "read_only"
    })),
    truncated: pending.length > ARENA_TRACE_LIMIT
  };
}

function transcriptEventKind(
  kind: NonNullable<CandidateInspectReadModel["runtime"]["transcript"]>["items"][number]["item_kind"]
): ArenaTraceEventKind {
  if (kind === "gateway_result") return "gateway_outcome";
  if (kind === "order_request" || kind === "sandbox_order_request") {
    return "trading_system_decision";
  }
  if (kind === "execution_result") return "ledger_entry";
  return "lifecycle";
}

function logEntries(candidate: CandidateInspectReadModel): {
  items: ArenaLogEntryReadModel[];
  truncated: boolean;
} {
  const pending: PendingLogEntry[] = [];
  let insertionOrder = 0;
  let omittedCount = 0;
  for (const log of candidate.runtime.sandbox?.logs ?? []) {
    for (const line of log.lines) {
      const parsed = parseStructuredTradingSystemLog(line);
      if (!parsed) {
        omittedCount += 1;
        continue;
      }
      pending.push({
        occurredAt: log.captured_at,
        level: parsed.level,
        source: "trading_system",
        message: parsed.message,
        insertionOrder: insertionOrder++
      });
    }
  }
  pending.sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.insertionOrder - right.insertionOrder
  );
  const bounded = pending.length > ARENA_LOG_LIMIT
    ? pending.slice(-ARENA_LOG_LIMIT)
    : pending;
  return {
    items: bounded.map((entry, index) => ({
      sequence: index + 1,
      occurred_at: entry.occurredAt,
      level: entry.level,
      source: entry.source,
      message: sanitizeText(entry.message),
      sanitized: true,
      authority_status: "read_only"
    })),
    truncated: pending.length > ARENA_LOG_LIMIT || omittedCount > 0
  };
}

function parseStructuredTradingSystemLog(line: string): {
  level: ArenaLogEntryReadModel["level"];
  message: string;
} | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = new Set([
    "level",
    "event",
    "status",
    "reason_code",
    "sequence"
  ]);
  if (Object.keys(record).some((key) => !allowedKeys.has(key)) ||
    !safeLogToken(record.event) ||
    (record.level !== undefined &&
      record.level !== "debug" && record.level !== "info" &&
      record.level !== "warn" && record.level !== "error") ||
    (record.status !== undefined && !safeLogToken(record.status)) ||
    (record.reason_code !== undefined && !safeLogToken(record.reason_code)) ||
    (record.sequence !== undefined &&
      (!Number.isInteger(record.sequence) || Number(record.sequence) < 0))) {
    return undefined;
  }
  const fields = [`event=${record.event}`];
  if (record.status !== undefined) fields.push(`status=${record.status}`);
  if (record.reason_code !== undefined) {
    fields.push(`reason_code=${record.reason_code}`);
  }
  if (record.sequence !== undefined) fields.push(`sequence=${record.sequence}`);
  return {
    level: (record.level ?? "info") as ArenaLogEntryReadModel["level"],
    message: fields.join(" ")
  };
}

function safeLogToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,80}$/.test(value);
}

function sanitizeDecision(
  decision: NonNullable<PaperTradingObservationRecord["decision"]>
): NonNullable<PaperTradingObservationRecord["decision"]> {
  return {
    ...cloneJson(decision),
    reason: sanitizeText(decision.reason)
  };
}

function sanitizeLineage(
  lineage: NonNullable<CandidateInspectReadModel["full_cycle_lineage"]>
): NonNullable<CandidateInspectReadModel["full_cycle_lineage"]> {
  const sanitized = cloneJson(lineage);
  if (sanitized.blocked_stage) {
    sanitized.blocked_stage = sanitizeText(sanitized.blocked_stage);
  }
  if (sanitized.blocked_reason) {
    sanitized.blocked_reason = sanitizeText(sanitized.blocked_reason);
  }
  if (sanitized.evidence) {
    sanitized.evidence.evaluation_status = sanitizeText(
      sanitized.evidence.evaluation_status
    );
    sanitized.evidence.gateway_result_outcome = sanitizeText(
      sanitized.evidence.gateway_result_outcome
    );
  }
  return sanitized;
}

function artifactRefs(source: LoadedArenaSystem): Ref[] {
  const refs: Ref[] = [
    { record_kind: "trading_system_candidate", id: source.runtime.candidate_ref.id },
    { record_kind: "candidate_version", id: source.runtime.candidate_version_ref.id },
    { record_kind: "system_code", id: source.runtime.system_code_ref.id },
    { record_kind: "candidate_admission_decision", id: source.runtime.candidate_admission_decision_ref.id },
    { record_kind: "paper_trading_handoff_conformance", id: source.runtime.paper_trading_handoff_conformance_ref.id },
    { record_kind: "trading_run", id: source.runtime.trading_run_ref.id },
    ...(source.evaluation
      ? [{
          record_kind: "paper_trading_evaluation",
          id: source.evaluation.paper_trading_evaluation_id
        }]
      : []),
    ...(source.commitment
      ? [{
          record_kind: "paper_trading_evaluation_commitment",
          id: source.commitment.paper_trading_evaluation_commitment_id
        }]
      : []),
    ...(source.candidate?.candidate_version.provenance_refs ?? []),
    ...source.observations.flatMap((entry) => entry.ledger_ref ? [entry.ledger_ref] : [])
  ];
  const unique = new Map(refs.map((entry) => [
    `${entry.record_kind}\u0000${entry.id}`,
    { ...entry }
  ]));
  return [...unique.values()];
}

function runnerStatus(
  system: ArenaPaperRuntimeSystem
): ArenaTradingSystemSummaryReadModel["runner_status"] {
  if (system.lifecycle_status === "recovering") return "needs_resume";
  if (system.active && system.lifecycle_status === "running") return "active";
  return "inactive";
}

function sandboxStatus(
  candidate: CandidateInspectReadModel | undefined,
  system: ArenaPaperRuntimeSystem
): ArenaIsolationReadModel["sandbox_status"] {
  const lifecycle = candidate?.runtime.sandbox?.lifecycle_status;
  if (lifecycle === "requested" || lifecycle === "created") return "starting";
  if (lifecycle === "removed") return "stopped";
  if (lifecycle) return lifecycle;
  if (system.lifecycle_status === "starting") return "starting";
  if (system.lifecycle_status === "failed" ||
    system.lifecycle_status === "invalidated") return "failed";
  return "not_started";
}

function arenaLoopStatus(
  snapshot: ArenaPaperRuntimeSnapshot
): ArenaOperationsReadModel["loop_status"] {
  if (snapshot.failed_count > 0 || snapshot.invalidated_count > 0) {
    return "degraded";
  }
  if (snapshot.starting_count > 0 || snapshot.recovering_count > 0) {
    return "starting";
  }
  if (snapshot.running_count > 0 || snapshot.queued_count > 0) {
    return "running";
  }
  return "stopped";
}

function latestSystemId(systems: ArenaPaperRuntimeSystem[]): string | undefined {
  return [...systems].sort((left, right) =>
    right.admission_decided_at.localeCompare(left.admission_decided_at) ||
    right.candidate_ref.id.localeCompare(left.candidate_ref.id)
  )[0]?.candidate_ref.id;
}

function exactWorkspaceIdentity(
  runtimeWorkspace: string | undefined,
  sandboxWorkspace: string | undefined
): string | undefined {
  return runtimeWorkspace && runtimeWorkspace === sandboxWorkspace &&
    /^sha256:[a-f0-9]{64}$/.test(runtimeWorkspace)
    ? runtimeWorkspace
    : undefined;
}

function sanitizeText(value: string): string {
  const sanitized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(WINDOWS_UNC_ABSOLUTE_PATH_PATTERN, "$1[private-path]")
    .replace(WINDOWS_DRIVE_ABSOLUTE_PATH_PATTERN, "[private-path]")
    .replace(POSIX_ABSOLUTE_PATH_PATTERN, "$1[private-path]")
    .replace(/\b(?:https?|wss?|file):\/\/[^\s<>"']+/gi, "[external-url]")
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+\/-]+=*/gi, "$1 [redacted]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1$2=[redacted]");
  return sanitized.length <= ARENA_TEXT_LIMIT
    ? sanitized
    : `${sanitized.slice(0, ARENA_TEXT_LIMIT)}...`;
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonPersistedRecordDigestInput(value))
    .digest("hex")}`;
}

function sha256Text(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
