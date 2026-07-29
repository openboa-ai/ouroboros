import {
  sanitizeResearchEvidenceText,
  type ResearchSessionDetailReadModel
} from "@ouroboros/domain";

const MAX_IDENTIFIER_LENGTH = 200;
const MAX_TEXT_LENGTH = 500;
const MAX_DETAIL_ARRAY_LENGTH = 100;

const RESEARCH_DIRECTIONS = [
  "trend_following",
  "mean_reversion",
  "volatility_regime",
  "funding_aware_risk",
  "liquidation_aware_risk",
  "execution_cost_robustness",
  "other"
] as const;
const SESSION_STATUSES = [
  "queued",
  "allocating",
  "running",
  "admitted",
  "duplicate",
  "quarantined",
  "finished_without_submission",
  "failed_closed",
  "recovering"
] as const;
const STATUS_BASES = [
  "candidate_admission_decision",
  "research_worker_checkpoint",
  "candidate_arena_tick",
  "runtime_research_work_item",
  "active_tick_queue",
  "incomplete_persisted_graph"
] as const;
const DEGRADED_REASONS = [
  "trigger_unavailable",
  "methodology_unavailable",
  "provider_unavailable",
  "worker_unavailable",
  "evidence_artifact_unavailable",
  "selected_artifact_unavailable",
  "evaluation_graph_conflict",
  "admission_graph_conflict",
  "terminal_admission_unavailable",
  "inactive_incomplete_graph"
] as const;
const PROVIDERS = [
  "codex_cli",
  "claude_code",
  "local_process",
  "fixture_only"
] as const;
const TRIGGER_KINDS = ["goal", "time", "arena_event", "live_event", "recovery"] as const;
const EVIDENCE_SOURCES = [
  "arena_paper_result",
  "arena_trace",
  "arena_failure",
  "research_finding"
] as const;
const LIFECYCLE_EVENTS = [
  "allocation",
  "commitment",
  "evaluation",
  "checkpoint",
  "tick",
  "admission",
  "handoff_conformance"
] as const;
const ADMISSION_REASONS = [
  "evaluation_accepted",
  "research_worker_failed",
  "no_candidate_change",
  "experiment_failed",
  "evaluation_disqualified",
  "evaluation_quarantined",
  "evidence_already_counted",
  "evidence_quarantined",
  "paper_handoff_conformance_failed",
  "behavior_duplicate",
  "behavior_fingerprint_unavailable"
] as const;
const CONFORMANCE_REASONS = [
  "passed",
  "runner_crash",
  "execution_timed_out",
  "provider_protocol_incomplete",
  "provider_protocol_violation",
  "provider_request_limit_exceeded",
  "paper_decision_missing",
  "paper_decision_ambiguous",
  "paper_event_invalid",
  "runtime_heartbeat_missing",
  "runtime_stop_missing",
  "instance_identity_mismatch",
  "artifact_digest_mismatch",
  "hidden_evaluator_field",
  "candidate_self_report",
  "private_or_live_authority"
] as const;

type UnknownRecord = Record<string, unknown>;

export function isSafeResearchSessionDetailResponse(
  value: unknown,
  requestedResearchWorkItemId: string
): value is ResearchSessionDetailReadModel {
  if (!isRecord(value) ||
    !detailHasExactKeys(value) ||
    !isCanonicalResearchWorkItemId(requestedResearchWorkItemId) ||
    value.identity_kind !== "derived_projection" ||
    value.research_work_item_id !== requestedResearchWorkItemId ||
    !identifier(value.research_work_item_id) ||
    !identifier(value.research_allocation_id) ||
    !identifier(value.tick_id) ||
    !optionalIdentifier(value.research_worker_id) ||
    !optionalIdentifier(value.commitment_id) ||
    !enumValue(value.direction_kind, RESEARCH_DIRECTIONS) ||
    !isCanonicalResearchWorkItemIdentity(
      value.research_work_item_id,
      value.research_allocation_id,
      value.direction_kind
    ) ||
    !enumValue(value.status, SESSION_STATUSES) ||
    !statusBasis(value.status_basis, value.status) ||
    !researchSessionStatusBasisBindingsMatch(value) ||
    !["complete", "degraded"].includes(String(value.projection_health)) ||
    !enumArray(value.degraded_reasons, DEGRADED_REASONS) ||
    new Set(value.degraded_reasons as unknown[]).size !==
      (value.degraded_reasons as unknown[]).length ||
    (value.projection_health === "complete") !==
      ((value.degraded_reasons as unknown[]).length === 0) ||
    !budget(value.budget) ||
    !iso(value.allocated_at) ||
    !optionalIso(value.started_at) ||
    !iso(value.last_progress_at) ||
    !optionalIso(value.completed_at) ||
    !optionalPositiveInteger(value.selected_submission_sequence) ||
    !optionalIdentifier(value.admitted_candidate_id) ||
    !text(value.latest_progress_summary) ||
    typeof value.latest_progress_summary_truncated !== "boolean" ||
    value.authority_status !== "research_only" ||
    !triggerProjection(value) ||
    !methodologyProjection(value) ||
    !providerProjection(value) ||
    !boundedArray(value.evidence_inputs, evidenceInput, 24) ||
    new Set((value.evidence_inputs as UnknownRecord[]).map((entry) =>
      entry.evidence_artifact_id
    )).size !== (value.evidence_inputs as unknown[]).length ||
    !triggerEvidenceMatches(value) ||
    !methodologyEvidenceMatches(value) ||
    !developmentSubmissions(value.development_submissions) ||
    !stringArray(value.notebook_summary) ||
    typeof value.notebook_summary_truncated !== "boolean" ||
    !notebookMatchesSubmissions(value) ||
    !lifecycleEventsMatchDetail(value) ||
    value.provider_logs_availability !== "not_persisted" ||
    !terminalGraph(value.terminal_graph, value) ||
    !authorityBindingsMatch(value) ||
    !optionalRef(value.admission_decision_ref,
      "candidate_admission_decision") ||
    !optionalRef(value.paper_handoff_conformance_ref,
      "paper_trading_handoff_conformance") ||
    !submissionHistory(value) ||
    !selectedArtifact(value) ||
    !degradedReasonsMatchVisibleState(value)) {
    return false;
  }
  return true;
}

export function isCanonicalResearchWorkItemId(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_IDENTIFIER_LENGTH &&
    /^research-session-v1-[0-9a-f]{64}$/.test(value);
}

export function isCanonicalResearchWorkItemIdentity(
  value: unknown,
  researchAllocationId: unknown,
  directionKind: unknown
): value is string {
  return isCanonicalResearchWorkItemId(value) &&
    identifier(researchAllocationId) &&
    enumValue(directionKind, RESEARCH_DIRECTIONS) &&
    value === canonicalResearchWorkItemId(researchAllocationId, directionKind);
}

export function researchSessionStatusBasisBindingsMatch(
  value: unknown
): boolean {
  if (!isRecord(value) || !isRecord(value.status_basis)) return false;
  const basis = value.status_basis;
  if (basis.basis_kind === "active_tick_queue") {
    return value.status === "queued" &&
      identifier(value.research_allocation_id) &&
      ref(basis.source_ref, "candidate_arena_research_allocation") &&
      refId(basis.source_ref) === value.research_allocation_id;
  }
  if (basis.basis_kind === "runtime_research_work_item") {
    if (value.status !== "running") {
      return !Object.hasOwn(basis, "source_ref");
    }
    return identifier(value.commitment_id) &&
      ref(basis.source_ref, "research_preflight_commitment") &&
      refId(basis.source_ref) === value.commitment_id;
  }
  return true;
}

function detailHasExactKeys(value: UnknownRecord): boolean {
  const optionalBaseKeys = [
    "research_worker_id",
    "commitment_id",
    "allocated_at",
    "started_at",
    "last_progress_at",
    "completed_at",
    "selected_submission_sequence",
    "admitted_candidate_id"
  ].filter((key) => key in value);
  const projectionKeys = [
    ...(value.trigger_availability === "available" ? ["trigger"] : []),
    ...(value.methodology_availability === "available" ? ["methodology"] : []),
    ...(value.provider_availability === "available" ? ["provider"] : []),
    ...(Object.hasOwn(value, "model") ? ["model"] : []),
    ...(Object.hasOwn(value, "model_truncated") ? ["model_truncated"] : [])
  ];
  const optionalDetailKeys = [
    "admission_decision_ref",
    "paper_handoff_conformance_ref"
  ].filter((key) => key in value);
  const historyKeys = value.submission_history_availability ===
      "checkpoint_summary"
    ? [
        "recorded_submission_count",
        "projected_submission_count",
        "omitted_submission_count",
        "submission_history_truncated"
      ]
    : [];
  const selectedArtifactKeys = value.selected_artifact_availability ===
      "available"
    ? ["selected_system_code_ref", "selected_system_code_artifact_digest"]
    : [];
  return hasExactKeys(value, [...new Set([
    "identity_kind",
    "research_work_item_id",
    "research_allocation_id",
    "tick_id",
    "direction_kind",
    ...optionalBaseKeys,
    "status",
    "status_basis",
    "projection_health",
    "degraded_reasons",
    "budget",
    "latest_progress_summary",
    "latest_progress_summary_truncated",
    "trigger_availability",
    "methodology_availability",
    "provider_availability",
    ...projectionKeys,
    "authority_status",
    "evidence_inputs",
    "development_submissions",
    ...optionalDetailKeys,
    "notebook_summary",
    "notebook_summary_truncated",
    "lifecycle_events",
    "provider_logs_availability",
    "terminal_graph",
    "submission_history_availability",
    ...historyKeys,
    "selected_artifact_availability",
    ...selectedArtifactKeys
  ])]);
}

function triggerProjection(value: UnknownRecord): boolean {
  if (value.trigger_availability === "unavailable") {
    return !Object.hasOwn(value, "trigger");
  }
  if (value.trigger_availability !== "available" || !isRecord(value.trigger)) {
    return false;
  }
  const trigger = value.trigger;
  const hasSource = trigger.source_ref !== undefined;
  const hasEvidence = trigger.evidence_artifact_ref !== undefined;
  return hasExactKeys(trigger, [
    "trigger_kind",
    "trigger_id",
    "goal",
    "goal_truncated",
    "triggered_at",
    ...(hasSource ? ["source_ref"] : []),
    ...(hasEvidence
      ? ["evidence_artifact_ref", "evidence_artifact_digest"]
      : []),
    "authority_status"
  ]) && enumValue(trigger.trigger_kind, TRIGGER_KINDS) &&
    identifier(trigger.trigger_id) &&
    text(trigger.goal) && typeof trigger.goal_truncated === "boolean" &&
    iso(trigger.triggered_at) && optionalRef(trigger.source_ref) &&
    optionalRef(trigger.evidence_artifact_ref, "research_evidence_artifact") &&
    (trigger.evidence_artifact_digest === undefined ||
      digest(trigger.evidence_artifact_digest)) &&
    ((trigger.evidence_artifact_ref === undefined) ===
      (trigger.evidence_artifact_digest === undefined)) &&
    trigger.authority_status === "research_only";
}

function triggerEvidenceMatches(value: UnknownRecord): boolean {
  if (value.trigger_availability !== "available" ||
    !isRecord(value.trigger) || !Array.isArray(value.evidence_inputs)) {
    return value.trigger_availability === "unavailable";
  }
  const trigger = value.trigger;
  if (Date.parse(String(trigger.triggered_at)) >
    Date.parse(String(value.allocated_at))) return false;
  const hasEvidence = trigger.evidence_artifact_ref !== undefined;
  const sourceRequired = hasEvidence || trigger.trigger_kind === "arena_event" ||
    trigger.trigger_kind === "live_event";
  const evidenceRequired = trigger.trigger_kind === "arena_event" ||
    trigger.trigger_kind === "live_event";
  if (sourceRequired && !ref(trigger.source_ref) ||
    evidenceRequired && !hasEvidence) return false;
  if (!hasEvidence) return true;
  const evidenceId = refId(trigger.evidence_artifact_ref);
  const matchingEvidence = value.evidence_inputs.filter((entry) =>
    isRecord(entry) && entry.evidence_artifact_id === evidenceId
  );
  if (matchingEvidence.length !== 1) return false;
  const evidence = matchingEvidence[0]!;
  return evidence.artifact_digest === trigger.evidence_artifact_digest &&
    Date.parse(String(evidence.captured_at)) <=
      Date.parse(String(trigger.triggered_at)) &&
    sameRef(evidence.artifact_ref, trigger.source_ref);
}

function methodologyProjection(value: UnknownRecord): boolean {
  if (value.methodology_availability === "unavailable") {
    return !Object.hasOwn(value, "methodology");
  }
  if (value.methodology_availability !== "available" ||
    !isRecord(value.methodology)) return false;
  const methodology = value.methodology;
  const hasSourceCandidate = methodology.source_candidate_id !== undefined;
  return hasExactKeys(methodology, [
    "direction_kind",
    "hypothesis",
    "hypothesis_truncated",
    "method",
    "method_truncated",
    ...(hasSourceCandidate ? ["source_candidate_id"] : []),
    "evidence_artifact_ids",
    "authority_status"
  ]) && enumValue(methodology.direction_kind, RESEARCH_DIRECTIONS) &&
    methodology.direction_kind === value.direction_kind &&
    text(methodology.hypothesis) &&
    typeof methodology.hypothesis_truncated === "boolean" &&
    text(methodology.method) &&
    typeof methodology.method_truncated === "boolean" &&
    optionalIdentifier(methodology.source_candidate_id) &&
    uniqueIdentifierArray(methodology.evidence_artifact_ids, 24) &&
    methodology.authority_status === "research_only";
}

function providerProjection(value: UnknownRecord): boolean {
  if (value.provider_availability === "unavailable") {
    return !Object.hasOwn(value, "provider") && !Object.hasOwn(value, "model") &&
      !Object.hasOwn(value, "model_truncated");
  }
  if (value.provider_availability !== "available" ||
    !enumValue(value.provider, PROVIDERS)) return false;
  const hasModel = value.model !== undefined;
  return hasModel === (value.model_truncated !== undefined) &&
    (!hasModel || text(value.model) &&
      typeof value.model_truncated === "boolean");
}

function budget(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, [
    "max_experiment_count",
    "completed_experiment_count",
    "max_development_submission_count",
    "development_submission_count",
    "remaining_development_submission_count",
    "authority_status"
  ]) &&
    positiveInteger(value.max_experiment_count) &&
    nonNegativeInteger(value.completed_experiment_count) &&
    Number(value.completed_experiment_count) <= Number(value.max_experiment_count) &&
    positiveInteger(value.max_development_submission_count) &&
    nonNegativeInteger(value.development_submission_count) &&
    Number(value.development_submission_count) <=
      Number(value.max_development_submission_count) &&
    nonNegativeInteger(value.remaining_development_submission_count) &&
    value.remaining_development_submission_count ===
      Number(value.max_development_submission_count) -
        Number(value.development_submission_count) &&
    value.authority_status === "research_only";
}

function statusBasis(value: unknown, status: unknown): boolean {
  if (!isRecord(value) || !enumValue(value.basis_kind, STATUS_BASES) ||
    !enumValue(status, SESSION_STATUSES) || !hasExactKeys(value, [
      "basis_kind",
      ...(value.source_ref !== undefined ? ["source_ref"] : []),
      "authority_status"
    ]) ||
    value.authority_status !== "read_only") return false;
  if (value.basis_kind === "candidate_admission_decision") {
    return ["admitted", "duplicate", "quarantined"].includes(status) &&
      ref(value.source_ref, "candidate_admission_decision");
  }
  if (value.basis_kind === "research_worker_checkpoint") {
    return ["finished_without_submission", "failed_closed"].includes(status) &&
      ref(value.source_ref, "research_worker_checkpoint");
  }
  if (value.basis_kind === "candidate_arena_tick") {
    return ["finished_without_submission", "failed_closed"].includes(status) &&
      ref(value.source_ref, "candidate_arena_tick");
  }
  if (value.basis_kind === "runtime_research_work_item") {
    return ["allocating", "running", "failed_closed"].includes(status) &&
      (status === "running"
        ? ref(value.source_ref, "research_preflight_commitment")
        : !Object.hasOwn(value, "source_ref"));
  }
  if (value.basis_kind === "active_tick_queue") {
    return status === "queued" && ref(
      value.source_ref,
      "candidate_arena_research_allocation"
    );
  }
  return value.basis_kind === "incomplete_persisted_graph" &&
    ["recovering", "failed_closed"].includes(status) &&
    !Object.hasOwn(value, "source_ref");
}

function evidenceInput(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    "evidence_artifact_id",
    "source_kind",
    "subject_ref",
    "artifact_ref",
    "artifact_digest",
    "summary",
    "truncated",
    "captured_at",
    "sanitization_status",
    "qualification_evidence_hidden",
    "authority_status"
  ]) || !identifier(value.evidence_artifact_id) ||
    !enumValue(value.source_kind, EVIDENCE_SOURCES) ||
    !ref(value.subject_ref) || !ref(value.artifact_ref) ||
    !digest(value.artifact_digest) || !text(value.summary) ||
    typeof value.truncated !== "boolean" || !iso(value.captured_at) ||
    value.sanitization_status !== "sanitized" ||
    value.qualification_evidence_hidden !== true ||
    value.authority_status !== "research_only") return false;
  if (value.source_kind === "arena_paper_result" ||
    value.source_kind === "arena_failure") {
    return value.subject_ref.record_kind === "trading_system_candidate" &&
      value.artifact_ref.record_kind === "paper_trading_evaluation";
  }
  if (value.source_kind === "arena_trace") {
    return value.subject_ref.record_kind === "trading_system_candidate" &&
      value.artifact_ref.record_kind === "paper_trading_observation";
  }
  return value.subject_ref.record_kind === "research_worker" &&
    value.artifact_ref.record_kind === "research_finding";
}

function developmentSubmission(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const selected = value.selected === true;
  if (!hasExactKeys(value, [
    "submission_sequence",
    "decision",
    "agent_status",
    "evaluation_status",
    "risk_decision",
    "net_revenue_usdt",
    "summary",
    "summary_truncated",
    "selected",
    "artifact_availability",
    ...(selected
      ? ["selected_system_code_ref", "selected_system_code_artifact_digest"]
      : []),
    "authority_status"
  ]) || !positiveInteger(value.submission_sequence) ||
    !enumValue(value.decision, ["keep", "discard", "crash"]) ||
    !enumValue(value.agent_status, ["edited", "no_change", "failed"]) ||
    !enumValue(value.evaluation_status, ["accepted", "disqualified"]) ||
    !enumValue(value.risk_decision, [
      "valid_order_request",
      "invalid_order_request",
      "no_order_request"
    ]) ||
    !finiteNumber(value.net_revenue_usdt) || !text(value.summary) ||
    typeof value.summary_truncated !== "boolean" ||
    typeof value.selected !== "boolean" ||
    !identifier(value.artifact_availability) ||
    value.authority_status !== "research_only") return false;
  return selected
    ? value.artifact_availability === "selected_system_code_available" &&
      ref(value.selected_system_code_ref, "system_code") &&
      digest(value.selected_system_code_artifact_digest)
    : value.artifact_availability === "not_persisted" &&
      value.selected_system_code_ref === undefined &&
      value.selected_system_code_artifact_digest === undefined;
}

function lifecycleEvent(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    "sequence",
    "occurred_at",
    "event_kind",
    "summary",
    "summary_truncated",
    "source_ref",
    "sanitized",
    "authority_status"
  ]) || !positiveInteger(value.sequence) ||
    !iso(value.occurred_at) ||
    !enumValue(value.event_kind, LIFECYCLE_EVENTS) ||
    !text(value.summary) || typeof value.summary_truncated !== "boolean" ||
    value.sanitized !== true || value.authority_status !== "read_only") {
    return false;
  }
  const sourceKinds: Record<string, string> = {
    allocation: "candidate_arena_research_allocation",
    commitment: "research_preflight_commitment",
    evaluation: "trading_evaluation_result",
    checkpoint: "research_worker_checkpoint",
    tick: "candidate_arena_tick",
    admission: "candidate_admission_decision",
    handoff_conformance: "paper_trading_handoff_conformance"
  };
  return ref(value.source_ref, sourceKinds[value.event_kind]);
}

function terminalGraph(value: unknown, detail: UnknownRecord): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    ...(value.selected_sealed_evaluation !== undefined
      ? ["selected_sealed_evaluation"]
      : []),
    ...(value.admission !== undefined ? ["admission"] : []),
    ...(value.paper_handoff_conformance !== undefined
      ? ["paper_handoff_conformance"]
      : []),
    ...(value.finding !== undefined ? ["finding"] : []),
    ...(value.artifact_lineage !== undefined ? ["artifact_lineage"] : []),
    ...(value.admitted_arena_handoff !== undefined
      ? ["admitted_arena_handoff"]
      : []),
    "authority_status"
  ]) || value.authority_status !== "read_only") return false;
  if (!(optionalObject(value.selected_sealed_evaluation, selectedEvaluation) &&
    optionalObject(value.admission, admission) &&
    optionalObject(value.paper_handoff_conformance, handoffConformance) &&
    optionalObject(value.finding, finding) &&
    optionalObject(value.artifact_lineage, artifactLineage) &&
    optionalObject(value.admitted_arena_handoff, arenaHandoff))) {
    return false;
  }
  const terminalAdmission = isRecord(value.admission)
    ? value.admission
    : undefined;
  const terminalConformance = isRecord(value.paper_handoff_conformance)
    ? value.paper_handoff_conformance
    : undefined;
  if ((detail.admission_decision_ref === undefined) !==
      (terminalAdmission === undefined) || terminalAdmission !== undefined &&
    refId(detail.admission_decision_ref) !==
      refId(terminalAdmission.candidate_admission_decision_ref) ||
    (detail.paper_handoff_conformance_ref === undefined) !==
      (terminalConformance === undefined) || terminalConformance !== undefined &&
    refId(detail.paper_handoff_conformance_ref) !==
      refId(terminalConformance.paper_trading_handoff_conformance_ref)) {
    return false;
  }
  if ((value.admitted_arena_handoff === undefined) !==
    (detail.admitted_candidate_id === undefined)) return false;
  if (value.artifact_lineage !== undefined) {
    const terminalFinding = isRecord(value.finding) ? value.finding : undefined;
    if (!isRecord(value.artifact_lineage) || terminalFinding === undefined ||
      detail.selected_artifact_availability !== "available" ||
      !ref(detail.selected_system_code_ref, "system_code") ||
      refId(value.artifact_lineage.child_system_code_ref) !==
        refId(detail.selected_system_code_ref) ||
      !Array.isArray(value.artifact_lineage.source_finding_refs) ||
      !value.artifact_lineage.source_finding_refs.some((sourceFindingRef) =>
        sameRef(sourceFindingRef, terminalFinding.research_finding_ref)
      )) {
      return false;
    }
  }
  if (value.admitted_arena_handoff === undefined) return true;
  if (!isRecord(value.selected_sealed_evaluation) ||
    !isRecord(value.admission) ||
    !isRecord(value.paper_handoff_conformance) ||
    !isRecord(value.finding) ||
    !isRecord(value.admitted_arena_handoff) ||
    detail.selected_artifact_availability !== "available" ||
    !positiveInteger(detail.selected_submission_sequence) ||
    !ref(detail.selected_system_code_ref, "system_code") ||
    !digest(detail.selected_system_code_artifact_digest) ||
    !Array.isArray(detail.development_submissions)) return false;
  const selectedSubmissions = detail.development_submissions.filter(
    (submission) => isRecord(submission) && submission.selected === true
  );
  if (selectedSubmissions.length > 1) return false;
  const selectedSubmission = selectedSubmissions[0];
  return value.selected_sealed_evaluation.result_status === "accepted" &&
    value.selected_sealed_evaluation.evidence_disposition === "not_counted" &&
    value.admission.status === "admitted" &&
    value.admission.reason === "evaluation_accepted" &&
    value.paper_handoff_conformance.status === "passed" &&
    value.paper_handoff_conformance.reason === "passed" &&
    refId(value.admitted_arena_handoff.candidate_ref) ===
      detail.admitted_candidate_id &&
    refId(value.admitted_arena_handoff.candidate_admission_decision_ref) ===
      refId(value.admission.candidate_admission_decision_ref) &&
    (selectedSubmission === undefined ||
      selectedSubmission.submission_sequence ===
        detail.selected_submission_sequence &&
      refId(selectedSubmission.selected_system_code_ref) ===
        refId(detail.selected_system_code_ref) &&
      selectedSubmission.selected_system_code_artifact_digest ===
        detail.selected_system_code_artifact_digest) &&
    value.admitted_arena_handoff.direction_kind === detail.direction_kind &&
    value.admitted_arena_handoff.completed_at === detail.completed_at;
}

function authorityBindingsMatch(detail: UnknownRecord): boolean {
  if (!isRecord(detail.status_basis) ||
    !isRecord(detail.terminal_graph) ||
    !Array.isArray(detail.lifecycle_events)) return false;
  const basis = detail.status_basis;
  const terminal = detail.terminal_graph;
  if (basis.basis_kind === "candidate_admission_decision") {
    if (!isRecord(terminal.admission) ||
      detail.status !== terminal.admission.status ||
      refId(basis.source_ref) !==
        refId(terminal.admission.candidate_admission_decision_ref)) {
      return false;
    }
  } else if (basis.basis_kind === "active_tick_queue") {
    if (refId(basis.source_ref) !== detail.research_allocation_id) return false;
  } else if (basis.basis_kind === "runtime_research_work_item") {
    if (detail.status === "running") {
      if (!identifier(detail.commitment_id) ||
        refId(basis.source_ref) !== detail.commitment_id) return false;
    } else if (basis.source_ref !== undefined) {
      return false;
    }
  }

  const basisEventKinds: Record<string, string> = {
    candidate_admission_decision: "admission",
    research_worker_checkpoint: "checkpoint",
    candidate_arena_tick: "tick",
    active_tick_queue: "allocation",
    ...(detail.status === "running"
      ? { runtime_research_work_item: "commitment" }
      : {})
  };
  const basisEventKind = basisEventKinds[String(basis.basis_kind)];
  if (basisEventKind !== undefined) {
    const matchingEvents = detail.lifecycle_events.filter((event) =>
      isRecord(event) && event.event_kind === basisEventKind
    );
    if (matchingEvents.length !== 1 ||
      refId(matchingEvents[0]!.source_ref) !== refId(basis.source_ref)) {
      return false;
    }
  }

  const terminalBindings: Array<{
    eventKind: string;
    terminalRef: unknown;
    terminalAt: unknown;
  }> = [{
    eventKind: "evaluation",
    terminalRef: isRecord(terminal.selected_sealed_evaluation)
      ? terminal.selected_sealed_evaluation.trading_evaluation_result_ref
      : undefined,
    terminalAt: isRecord(terminal.selected_sealed_evaluation)
      ? terminal.selected_sealed_evaluation.completed_at
      : undefined
  }, {
    eventKind: "admission",
    terminalRef: isRecord(terminal.admission)
      ? terminal.admission.candidate_admission_decision_ref
      : undefined,
    terminalAt: isRecord(terminal.admission)
      ? terminal.admission.decided_at
      : undefined
  }, {
    eventKind: "handoff_conformance",
    terminalRef: isRecord(terminal.paper_handoff_conformance)
      ? terminal.paper_handoff_conformance.paper_trading_handoff_conformance_ref
      : undefined,
    terminalAt: isRecord(terminal.paper_handoff_conformance)
      ? terminal.paper_handoff_conformance.completed_at
      : undefined
  }];
  for (const { eventKind, terminalRef, terminalAt } of terminalBindings) {
    const events = detail.lifecycle_events.filter((event) =>
      isRecord(event) && event.event_kind === eventKind
    );
    if ((terminalRef === undefined) !== (events.length === 0) ||
      terminalRef !== undefined && (events.length !== 1 ||
        refId(events[0]!.source_ref) !== refId(terminalRef) ||
        events[0]!.occurred_at !== terminalAt)) {
      return false;
    }
  }

  if (isRecord(terminal.admitted_arena_handoff)) {
    const tickEvents = detail.lifecycle_events.filter((event) =>
      isRecord(event) && event.event_kind === "tick"
    );
    if (tickEvents.length !== 1 ||
      refId(tickEvents[0]!.source_ref) !==
        refId(terminal.admitted_arena_handoff.candidate_arena_tick_ref) ||
      tickEvents[0]!.occurred_at !==
        terminal.admitted_arena_handoff.completed_at) {
      return false;
    }
  }
  return true;
}

function selectedEvaluation(value: UnknownRecord): boolean {
  return hasExactKeys(value, [
    "trading_evaluation_result_ref",
    "experiment_run_ref",
    "evaluation_phase",
    "result_status",
    "evidence_disposition",
    "completed_at",
    "authority_status"
  ]) && ref(value.trading_evaluation_result_ref, "trading_evaluation_result") &&
    ref(value.experiment_run_ref, "experiment_run") &&
    value.evaluation_phase === "sealed_admission" &&
    enumValue(value.result_status, [
      "accepted",
      "quarantined_for_review",
      "disqualified"
    ]) && enumValue(value.evidence_disposition, [
      "not_counted",
      "counted",
      "quarantined_for_review"
    ]) &&
    iso(value.completed_at) && value.authority_status === "read_only";
}

function admission(value: UnknownRecord): boolean {
  if (!hasExactKeys(value, [
    "candidate_admission_decision_ref",
    "status",
    "reason",
    "decided_at",
    "authority_status"
  ]) || !ref(
    value.candidate_admission_decision_ref,
    "candidate_admission_decision"
  )) return false;
  if (!enumValue(value.status, ["admitted", "duplicate", "quarantined"]) ||
    !enumValue(value.reason, ADMISSION_REASONS) ||
    !iso(value.decided_at) || value.authority_status !== "read_only") {
    return false;
  }
  if (value.status === "admitted") return value.reason === "evaluation_accepted";
  if (value.status === "duplicate") {
    return value.reason === "no_candidate_change" ||
      value.reason === "behavior_duplicate";
  }
  return value.reason !== "evaluation_accepted" &&
    value.reason !== "no_candidate_change" &&
    value.reason !== "behavior_duplicate";
}

function handoffConformance(value: UnknownRecord): boolean {
  return hasExactKeys(value, [
    "paper_trading_handoff_conformance_ref",
    "status",
    "reason",
    "completed_at",
    "evidence_digest",
    "authority_status"
  ]) && ref(value.paper_trading_handoff_conformance_ref,
    "paper_trading_handoff_conformance") &&
    enumValue(value.status, ["passed", "rejected"]) &&
    enumValue(value.reason, CONFORMANCE_REASONS) &&
    (value.status === "passed") === (value.reason === "passed") &&
    iso(value.completed_at) && digest(value.evidence_digest) &&
    value.authority_status === "read_only";
}

function finding(value: UnknownRecord): boolean {
  return hasExactKeys(value, [
    "research_finding_ref",
    "finding_kind",
    "summary",
    "summary_truncated",
    "supporting_record_refs",
    "created_at",
    "sanitized",
    "authority_status"
  ]) && ref(value.research_finding_ref, "research_finding") &&
    enumValue(value.finding_kind, [
      "positive_result",
      "negative_result",
      "failure_analysis",
      "anti_hacking_case",
      "duplicate_result",
      "next_artifact_hint"
    ]) &&
    text(value.summary) && typeof value.summary_truncated === "boolean" &&
    uniqueRefArray(value.supporting_record_refs) && iso(value.created_at) &&
    value.sanitized === true && value.authority_status === "read_only";
}

function artifactLineage(value: UnknownRecord): boolean {
  const hasParent = value.parent_system_code_ref !== undefined;
  const hasWorker = value.created_by_research_worker_ref !== undefined;
  return hasExactKeys(value, [
    "artifact_lineage_ref",
    "child_system_code_ref",
    ...(hasParent ? ["parent_system_code_ref"] : []),
    "source_finding_refs",
    ...(hasWorker ? ["created_by_research_worker_ref"] : []),
    "created_at",
    "authority_status"
  ]) && ref(value.artifact_lineage_ref, "artifact_lineage") &&
    ref(value.child_system_code_ref, "system_code") &&
    optionalRef(value.parent_system_code_ref, "system_code") &&
    uniqueRefArray(value.source_finding_refs, "research_finding", true) &&
    optionalRef(value.created_by_research_worker_ref, "research_worker") &&
    iso(value.created_at) && value.authority_status === "read_only";
}

function arenaHandoff(value: UnknownRecord): boolean {
  return hasExactKeys(value, [
    "candidate_arena_tick_ref",
    "candidate_ref",
    "direction_kind",
    "candidate_admission_decision_ref",
    "completed_at",
    "authority_status"
  ]) && ref(value.candidate_arena_tick_ref, "candidate_arena_tick") &&
    ref(value.candidate_ref, "trading_system_candidate") &&
    enumValue(value.direction_kind, RESEARCH_DIRECTIONS) &&
    ref(value.candidate_admission_decision_ref,
      "candidate_admission_decision") && iso(value.completed_at) &&
    value.authority_status === "read_only";
}

function submissionHistory(value: UnknownRecord): boolean {
  if (value.submission_history_availability ===
    "unavailable_until_checkpoint") {
    return Array.isArray(value.development_submissions) &&
      value.development_submissions.length === 0 &&
      isRecord(value.budget) &&
      value.budget.development_submission_count === 0 &&
      value.recorded_submission_count === undefined &&
      value.projected_submission_count === undefined &&
      value.omitted_submission_count === undefined &&
      value.submission_history_truncated === undefined;
  }
  if (!Array.isArray(value.development_submissions)) return false;
  return value.submission_history_availability === "checkpoint_summary" &&
    nonNegativeInteger(value.recorded_submission_count) &&
    isRecord(value.budget) &&
    value.recorded_submission_count ===
      value.budget.development_submission_count &&
    nonNegativeInteger(value.projected_submission_count) &&
    nonNegativeInteger(value.omitted_submission_count) &&
    value.projected_submission_count === value.development_submissions.length &&
    Number(value.recorded_submission_count) >=
      Number(value.projected_submission_count) &&
    value.omitted_submission_count === Number(value.recorded_submission_count) -
      Number(value.projected_submission_count) &&
    value.submission_history_truncated ===
      (Number(value.omitted_submission_count) > 0);
}

function selectedArtifact(value: UnknownRecord): boolean {
  if (!Array.isArray(value.development_submissions) || !isRecord(value.budget)) {
    return false;
  }
  const submissions = value.development_submissions;
  const detailBudget = value.budget;
  if (
    submissions.some((submission) =>
      !isRecord(submission) || Number(submission.submission_sequence) >
        Number(detailBudget.max_development_submission_count)
    ) || submissions.length >
      Number(detailBudget.development_submission_count) ||
    value.selected_submission_sequence !== undefined && (
      Number(value.selected_submission_sequence) >
        Number(detailBudget.max_development_submission_count) ||
      value.submission_history_availability === "checkpoint_summary" &&
        Number(value.selected_submission_sequence) >
          Number(value.recorded_submission_count)
    ) || value.submission_history_availability === "checkpoint_summary" &&
      submissions.some((submission) =>
        isRecord(submission) && Number(submission.submission_sequence) >
          Number(value.recorded_submission_count)
      )) return false;
  const selectedSubmissions = submissions.filter(
    (submission) => isRecord(submission) && submission.selected === true
  );
  if (selectedSubmissions.length > 1) return false;
  if (value.selected_artifact_availability === "available") {
    if (!positiveInteger(value.selected_submission_sequence) ||
      !ref(value.selected_system_code_ref, "system_code") ||
      !digest(value.selected_system_code_artifact_digest)) return false;
    const selected = selectedSubmissions[0];
    return selected === undefined ||
      selected.submission_sequence === value.selected_submission_sequence &&
      refId(selected.selected_system_code_ref) ===
        refId(value.selected_system_code_ref) &&
      selected.selected_system_code_artifact_digest ===
        value.selected_system_code_artifact_digest;
  }
  if (selectedSubmissions.length !== 0) return false;
  if (value.selected_artifact_availability === "not_selected") {
    return value.selected_submission_sequence === undefined &&
      value.selected_system_code_ref === undefined &&
      value.selected_system_code_artifact_digest === undefined;
  }
  return value.selected_artifact_availability === "unavailable" &&
    optionalPositiveInteger(value.selected_submission_sequence) &&
    value.selected_system_code_ref === undefined &&
    value.selected_system_code_artifact_digest === undefined;
}

function methodologyEvidenceMatches(value: UnknownRecord): boolean {
  if (value.methodology_availability !== "available") return true;
  if (!isRecord(value.methodology) ||
    !Array.isArray(value.methodology.evidence_artifact_ids) ||
    !Array.isArray(value.evidence_inputs)) return false;
  return JSON.stringify(value.methodology.evidence_artifact_ids) ===
    JSON.stringify(value.evidence_inputs.map((entry) =>
      isRecord(entry) ? entry.evidence_artifact_id : undefined
    ));
}

function developmentSubmissions(value: unknown): boolean {
  if (!boundedArray(value, developmentSubmission)) return false;
  const submissions = value as UnknownRecord[];
  return new Set(submissions.map((entry) => entry.submission_sequence)).size ===
    submissions.length && submissions.every((entry, index) => index === 0 ||
      Number(submissions[index - 1]!.submission_sequence) <
        Number(entry.submission_sequence));
}

function notebookMatchesSubmissions(value: UnknownRecord): boolean {
  if (!Array.isArray(value.notebook_summary) ||
    !Array.isArray(value.development_submissions)) return false;
  const summaries = value.development_submissions.map((entry) =>
    isRecord(entry) ? entry.summary : undefined
  );
  const truncated = value.development_submissions.some((entry) =>
    isRecord(entry) && entry.summary_truncated === true
  );
  return JSON.stringify(value.notebook_summary) === JSON.stringify(summaries) &&
    value.notebook_summary_truncated === truncated;
}

function lifecycleEventsMatchDetail(value: UnknownRecord): boolean {
  const rawEvents = value.lifecycle_events;
  if (!Array.isArray(rawEvents) ||
    !boundedArray(rawEvents, lifecycleEvent) || rawEvents.length === 0) {
    return false;
  }
  const events = rawEvents as UnknownRecord[];
  if (!events.every((event, index) => event.sequence === index + 1 &&
    (index === 0 || String(events[index - 1]!.occurred_at) <
      String(event.occurred_at) || events[index - 1]!.occurred_at ===
        event.occurred_at && String(events[index - 1]!.event_kind) <
          String(event.event_kind))) ||
    new Set(events.map((event) => event.event_kind)).size !== events.length) {
    return false;
  }
  const allocationEvent = events.find((event) =>
    event.event_kind === "allocation"
  );
  const commitmentEvent = events.find((event) =>
    event.event_kind === "commitment"
  );
  const terminalEvent = events.filter((event) =>
    ["tick", "checkpoint", "admission"].includes(String(event.event_kind))
  ).at(-1);
  const expectedCompletedAt = ["queued", "allocating", "running", "recovering"]
    .includes(String(value.status))
    ? undefined
    : terminalEvent?.occurred_at;
  return events[0] === allocationEvent && allocationEvent !== undefined &&
    refId(allocationEvent.source_ref) === value.research_allocation_id &&
    allocationEvent.occurred_at === value.allocated_at &&
    (value.started_at === undefined ||
      String(value.started_at) >= String(value.allocated_at)) &&
    (value.commitment_id === undefined) === (commitmentEvent === undefined) &&
    (commitmentEvent === undefined ||
      refId(commitmentEvent.source_ref) === value.commitment_id &&
      commitmentEvent.occurred_at === value.started_at) &&
    value.completed_at === expectedCompletedAt &&
    events.at(-1)!.occurred_at === value.last_progress_at;
}

function degradedReasonsMatchVisibleState(value: UnknownRecord): boolean {
  if (!Array.isArray(value.degraded_reasons) || !isRecord(value.status_basis) ||
    !isRecord(value.terminal_graph)) return false;
  const reasons = value.degraded_reasons as unknown[];
  const hasReason = (reason: string): boolean => reasons.includes(reason);
  return (value.trigger_availability === "unavailable") ===
      hasReason("trigger_unavailable") &&
    (value.methodology_availability === "unavailable") ===
      hasReason("methodology_unavailable") &&
    (value.provider_availability === "unavailable") ===
      hasReason("provider_unavailable") &&
    (value.research_worker_id === undefined) ===
      hasReason("worker_unavailable") &&
    (value.status_basis.basis_kind !== "incomplete_persisted_graph" ||
      hasReason("inactive_incomplete_graph")) &&
    (value.selected_artifact_availability === "unavailable") ===
      hasReason("selected_artifact_unavailable") &&
    (!(isRecord(value.terminal_graph.admission) &&
      value.terminal_graph.admission.status === "admitted") ||
      value.terminal_graph.admitted_arena_handoff !== undefined ||
      hasReason("terminal_admission_unavailable"));
}

function optionalObject(
  value: unknown,
  validate: (record: UnknownRecord) => boolean
): boolean {
  return value === undefined || isRecord(value) && validate(value);
}

function ref(
  value: unknown,
  recordKind?: string
): value is UnknownRecord & { record_kind: string; id: string } {
  return isRecord(value) && hasExactKeys(value, ["record_kind", "id"]) &&
    identifier(value.record_kind) &&
    identifier(value.id) &&
    (recordKind === undefined || value.record_kind === recordKind);
}

function optionalRef(value: unknown, recordKind?: string): boolean {
  return value === undefined || ref(value, recordKind);
}

function refId(value: unknown): string | undefined {
  return ref(value) ? value.id : undefined;
}

function sameRef(left: unknown, right: unknown): boolean {
  return ref(left) && ref(right) && left.record_kind === right.record_kind &&
    left.id === right.id;
}

function boundedArray(
  value: unknown,
  validate: (entry: unknown) => boolean,
  limit = MAX_DETAIL_ARRAY_LENGTH
): boolean {
  return Array.isArray(value) && value.length <= limit &&
    value.every((entry) => validate(entry));
}

function uniqueIdentifierArray(value: unknown, limit: number): boolean {
  return boundedArray(value, identifier, limit) &&
    new Set(value as string[]).size === (value as string[]).length;
}

function uniqueRefArray(
  value: unknown,
  recordKind?: string,
  requireNonEmpty = false
): boolean {
  if (!boundedArray(value, (entry) => ref(entry, recordKind)) ||
    requireNonEmpty && (value as unknown[]).length === 0) return false;
  const keys = (value as UnknownRecord[]).map((entry) =>
    `${String(entry.record_kind)}:${String(entry.id)}`
  );
  return new Set(keys).size === keys.length;
}

function stringArray(value: unknown, limit = MAX_DETAIL_ARRAY_LENGTH): boolean {
  return boundedArray(value, text, limit);
}

function enumArray(
  value: unknown,
  allowed: readonly string[],
  limit = MAX_DETAIL_ARRAY_LENGTH
): boolean {
  return boundedArray(value, (entry) => enumValue(entry, allowed), limit);
}

function enumValue(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    /^[A-Za-z0-9_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?$/.test(value);
}

function optionalIdentifier(value: unknown): boolean {
  return value === undefined || identifier(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= MAX_TEXT_LENGTH &&
    sanitizeResearchEvidenceText(value) === value;
}

function iso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function optionalIso(value: unknown): boolean {
  return value === undefined || iso(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function optionalPositiveInteger(value: unknown): boolean {
  return value === undefined || positiveInteger(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function canonicalResearchWorkItemId(
  researchAllocationId: string,
  directionKind: string
): string {
  return `research-session-v1-${sha256Hex(JSON.stringify({
    research_allocation_id: researchAllocationId,
    direction_kind: directionKind
  }))}`;
}

function sha256Hex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const constants = SHA256_CONSTANTS;
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]!;
      const right = words[index - 2]!;
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ left >>> 3;
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ right >>> 10;
      words[index] = (words[index - 16]! + sigma0 +
        words[index - 7]! + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^
        rotateRight(e!, 25);
      const choice = (e! & f!) ^ (~e! & g!);
      const temp1 = (h! + sum1 + choice + constants[index]! +
        words[index]!) >>> 0;
      const sum0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^
        rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0]! + a!) >>> 0;
    state[1] = (state[1]! + b!) >>> 0;
    state[2] = (state[2]! + c!) >>> 0;
    state[3] = (state[3]! + d!) >>> 0;
    state[4] = (state[4]! + e!) >>> 0;
    state[5] = (state[5]! + f!) >>> 0;
    state[6] = (state[6]! + g!) >>> 0;
    state[7] = (state[7]! + h!) >>> 0;
  }
  return [...state].map((word) => word.toString(16).padStart(8, "0")).join("");
}

function rotateRight(value: number, count: number): number {
  return value >>> count | value << 32 - count;
}

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function hasExactKeys(value: unknown, expected: string[]): boolean {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const canonicalExpected = [...expected].sort();
  return actual.length === canonicalExpected.length &&
    actual.every((key, index) => key === canonicalExpected[index]);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
