import type {
  PrivateReadinessPolicyDecision,
  PrivateReadinessPostureReadModel
} from "@ouroboros/domain";

export interface PrivateReadinessRemediationActionRow {
  action: string;
  target: string;
  posture: string;
  detail: string;
  guidanceBoundary: string;
}

export interface PrivateReadinessRemediationProgressSummary {
  coverage: string;
  blockingReviewFocus: string;
  nextReviewFocus: string;
  progressState: string;
}

export interface PrivateReadinessReviewPacketIndexEntry {
  step: string;
  surface: string;
  role: string;
  boundary: string;
}

export type PrivateReadinessReviewPacketAvailabilityState =
  | "available_for_review"
  | "needs_posture_context"
  | "no_current_items"
  | "policy_context_available";

export interface PrivateReadinessReviewPacketAvailabilityRow {
  step: string;
  surface: string;
  availability: PrivateReadinessReviewPacketAvailabilityState;
  detail: string;
  boundary: string;
}

export interface PrivateReadinessReviewPacketAvailabilitySummary {
  countSummary: string;
  rows: PrivateReadinessReviewPacketAvailabilityRow[];
}

export interface PrivateReadinessReviewPacketGapSummary {
  countSummary: string;
  nextGapFocus: string;
  gapState: string;
}

export interface PrivateReadinessReviewPacketResolutionChecklistItem {
  item: string;
  source: string;
  status: string;
  detail: string;
  boundary: string;
}

export interface PrivateReadinessReviewPacketResolutionChecklist {
  countSummary: string;
  nextResolutionFocus: string;
  checklistState: string;
  items: PrivateReadinessReviewPacketResolutionChecklistItem[];
}

export interface PrivateReadinessReviewPacketSourceProvenanceRow {
  item: string;
  source: string;
  provenance: string;
  detail: string;
  boundary: string;
}

export interface PrivateReadinessReviewPacketSourceProvenanceSummary {
  countSummary: string;
  nextSourceFocus: string;
  sourceState: string;
  rows: PrivateReadinessReviewPacketSourceProvenanceRow[];
}

export interface PrivateReadinessReviewPacketCompletionReadinessSummary {
  countSummary: string;
  nextReviewFocus: string;
  nextCompletionFocus: string;
  readinessState: string;
  boundary: string;
}

export interface PrivateReadinessReviewPacketProjection {
  indexEntries: PrivateReadinessReviewPacketIndexEntry[];
  remediationActionRows: PrivateReadinessRemediationActionRow[];
  remediationProgressSummary: PrivateReadinessRemediationProgressSummary;
  availabilitySummary: PrivateReadinessReviewPacketAvailabilitySummary;
  gapSummary: PrivateReadinessReviewPacketGapSummary;
  resolutionChecklist: PrivateReadinessReviewPacketResolutionChecklist;
  sourceProvenanceSummary: PrivateReadinessReviewPacketSourceProvenanceSummary;
  completionReadinessSummary: PrivateReadinessReviewPacketCompletionReadinessSummary;
}

export const PRIVATE_READINESS_REVIEW_PACKET_INDEX_ENTRIES: PrivateReadinessReviewPacketIndexEntry[] = [
  {
    step: "01 policy_impact_interpretation",
    surface: "Policy impact interpretation",
    role: "review_policy_status_and_required_actions",
    boundary: "read_only_review_context"
  },
  {
    step: "02 posture_delta_summary",
    surface: "Posture delta summary",
    role: "compare_current_and_previous_local_posture",
    boundary: "read_only_review_context"
  },
  {
    step: "03 review_handoff",
    surface: "Private-readiness review handoff",
    role: "collect_operator_review_context",
    boundary: "read_only_review_context"
  },
  {
    step: "04 authority_gate_preview",
    surface: "Private-readiness authority gate preview",
    role: "confirm_private_read_authority_not_granted",
    boundary: "read_only_review_context"
  },
  {
    step: "05 checked_gate_matrix",
    surface: "Private-readiness checked-gate matrix",
    role: "inspect_checked_gate_statuses",
    boundary: "read_only_review_context"
  },
  {
    step: "06 remediation_action_map",
    surface: "Private-readiness remediation/action map",
    role: "map_required_actions_to_gates_or_blockers",
    boundary: "read_only_review_context"
  },
  {
    step: "07 remediation_progress_summary",
    surface: "Private-readiness remediation progress summary",
    role: "scan_action_coverage_and_next_focus",
    boundary: "read_only_review_context"
  }
];

const PRIVATE_READINESS_ACTION_DIMENSION_ALIASES: Record<string, string> = {
  configure_private_read_credentials: "configuration"
};

export function buildPrivateReadinessReviewPacketProjection({
  decision,
  posture,
  previousPosture
}: {
  decision: PrivateReadinessPolicyDecision;
  posture?: PrivateReadinessPostureReadModel | null;
  previousPosture?: PrivateReadinessPostureReadModel;
}): PrivateReadinessReviewPacketProjection {
  const remediationActionRows = privateReadinessRemediationActionRows(decision);
  const remediationProgressSummary =
    privateReadinessRemediationProgressSummary(remediationActionRows);
  const availabilitySummary = privateReadinessReviewPacketAvailabilitySummary({
    decision,
    posture,
    previousPosture,
    remediationActionRows,
    remediationProgressSummary
  });
  const gapSummary = privateReadinessReviewPacketGapSummary({
    availabilitySummary,
    remediationProgressSummary
  });
  const resolutionChecklist = privateReadinessReviewPacketResolutionChecklist({
    availabilitySummary,
    gapSummary,
    remediationActionRows
  });
  const sourceProvenanceSummary = privateReadinessReviewPacketSourceProvenanceSummary({
    decision,
    posture,
    previousPosture,
    availabilitySummary,
    remediationActionRows,
    remediationProgressSummary,
    resolutionChecklist
  });

  return {
    indexEntries: PRIVATE_READINESS_REVIEW_PACKET_INDEX_ENTRIES,
    remediationActionRows,
    remediationProgressSummary,
    availabilitySummary,
    gapSummary,
    resolutionChecklist,
    sourceProvenanceSummary,
    completionReadinessSummary: privateReadinessReviewPacketCompletionReadinessSummary({
      availabilitySummary,
      gapSummary,
      remediationActionRows,
      remediationProgressSummary,
      resolutionChecklist,
      sourceProvenanceSummary
    })
  };
}

export function formatPrivateReadinessCheckedGatePosture(
  status: PrivateReadinessPolicyDecision["status"]
): string {
  if (status === "ready") {
    return "ready_gate";
  }
  if (status === "review_required") {
    return "review_required_gate";
  }
  return "blocking_gate";
}

function privateReadinessRemediationActionRows(
  decision: PrivateReadinessPolicyDecision
): PrivateReadinessRemediationActionRow[] {
  return decision.required_next_actions.map((action) => {
    const gate = findPrivateReadinessRemediationGate(action, decision);
    if (gate) {
      return {
        action,
        target: `checked_gate: ${gate.dimension}`,
        posture: `${gate.status} / ${formatPrivateReadinessCheckedGatePosture(gate.status)}`,
        detail: gate.reason_code,
        guidanceBoundary: "read_only_remediation_guidance"
      };
    }

    const blocker = findPrivateReadinessRemediationBlocker(action, decision);
    if (blocker) {
      return {
        action,
        target: `blocking_condition: ${blocker.dimension}`,
        posture: "blocking_condition",
        detail: blocker.condition,
        guidanceBoundary: "read_only_remediation_guidance"
      };
    }

    return {
      action,
      target: "unmapped_action",
      posture: "unmapped_action",
      detail: "no_matching_gate_or_blocker",
      guidanceBoundary: "read_only_remediation_guidance"
    };
  });
}

function privateReadinessRemediationProgressSummary(
  rows: PrivateReadinessRemediationActionRow[]
): PrivateReadinessRemediationProgressSummary {
  const mappedCount = rows.filter((row) => row.target !== "unmapped_action").length;
  const unmappedCount = rows.length - mappedCount;
  const blockingReviewRows = rows.filter((row) =>
    row.posture.includes("blocking_gate") ||
    row.posture.includes("review_required_gate") ||
    row.posture === "blocking_condition"
  );
  const nextFocus =
    rows.find((row) => row.target === "unmapped_action") ??
    blockingReviewRows[0] ??
    rows[0];
  return {
    coverage: [
      `required_actions=${rows.length}`,
      `mapped_actions=${mappedCount}`,
      `unmapped_actions=${unmappedCount}`
    ].join(", "),
    blockingReviewFocus: `blocking_review_focus=${blockingReviewRows.length}`,
    nextReviewFocus: nextFocus
      ? `next_review_focus=${nextFocus.action} -> ${nextFocus.target}`
      : "next_review_focus=no_required_next_actions",
    progressState: rows.length > 0
      ? "remediation_progress_actions_present"
      : "no_remediation_progress_actions"
  };
}

function privateReadinessReviewPacketAvailabilitySummary({
  decision,
  posture,
  previousPosture,
  remediationActionRows,
  remediationProgressSummary
}: {
  decision: PrivateReadinessPolicyDecision;
  posture?: PrivateReadinessPostureReadModel | null;
  previousPosture?: PrivateReadinessPostureReadModel;
  remediationActionRows: PrivateReadinessRemediationActionRow[];
  remediationProgressSummary: PrivateReadinessRemediationProgressSummary;
}): PrivateReadinessReviewPacketAvailabilitySummary {
  const rows = PRIVATE_READINESS_REVIEW_PACKET_INDEX_ENTRIES.map((entry) =>
    privateReadinessReviewPacketAvailabilityRow({
      entry,
      decision,
      posture,
      previousPosture,
      remediationActionRows,
      remediationProgressSummary
    })
  );
  const countFor = (state: PrivateReadinessReviewPacketAvailabilityState) =>
    rows.filter((row) => row.availability === state).length;
  return {
    countSummary: [
      `availability_summary=available_for_review=${countFor("available_for_review")}`,
      `needs_posture_context=${countFor("needs_posture_context")}`,
      `no_current_items=${countFor("no_current_items")}`,
      `policy_context_available=${countFor("policy_context_available")}`
    ].join(", "),
    rows
  };
}

function privateReadinessReviewPacketGapSummary({
  availabilitySummary,
  remediationProgressSummary
}: {
  availabilitySummary: PrivateReadinessReviewPacketAvailabilitySummary;
  remediationProgressSummary: PrivateReadinessRemediationProgressSummary;
}): PrivateReadinessReviewPacketGapSummary {
  const rows = availabilitySummary.rows;
  const needsPostureContextRows = rows.filter((row) => row.availability === "needs_posture_context");
  const noCurrentItemRows = rows.filter((row) => row.availability === "no_current_items");
  const policyContextRows = rows.filter((row) => row.availability === "policy_context_available");
  const nextAvailabilityGap = needsPostureContextRows[0] ?? noCurrentItemRows[0];
  const hasAvailabilityGaps = needsPostureContextRows.length > 0 || noCurrentItemRows.length > 0;

  return {
    countSummary: [
      `gap_summary=needs_posture_context=${needsPostureContextRows.length}`,
      `no_current_items=${noCurrentItemRows.length}`,
      `policy_context_available=${policyContextRows.length}`
    ].join(", "),
    nextGapFocus: nextAvailabilityGap
      ? `next_gap_focus=${nextAvailabilityGap.step} -> ${nextAvailabilityGap.detail}`
      : remediationProgressSummary.nextReviewFocus.replace("next_review_focus=", "next_gap_focus="),
    gapState: hasAvailabilityGaps
      ? "review_packet_availability_gaps_present"
      : remediationProgressSummary.progressState === "remediation_progress_actions_present"
        ? "review_packet_remediation_focus_present"
        : "review_packet_no_current_gaps"
  };
}

function privateReadinessReviewPacketResolutionChecklist({
  availabilitySummary,
  gapSummary,
  remediationActionRows
}: {
  availabilitySummary: PrivateReadinessReviewPacketAvailabilitySummary;
  gapSummary: PrivateReadinessReviewPacketGapSummary;
  remediationActionRows: PrivateReadinessRemediationActionRow[];
}): PrivateReadinessReviewPacketResolutionChecklist {
  const availabilityGapItems = availabilitySummary.rows
    .filter((row) => row.availability === "needs_posture_context" || row.availability === "no_current_items")
    .map((row) => ({
      item: row.step,
      source: row.availability,
      status: row.availability === "needs_posture_context"
        ? "requires_posture_context"
        : "confirm_empty_review_state",
      detail: row.detail,
      boundary: "read_only_resolution_guidance"
    }));
  const remediationItems = remediationActionRows.map((row) => ({
    item: row.action,
    source: row.target,
    status: "resolve_required_next_action",
    detail: `${row.posture} / ${row.detail}`,
    boundary: "read_only_resolution_guidance"
  }));
  const policyContextCount = availabilitySummary.rows
    .filter((row) => row.availability === "policy_context_available").length;
  const items = [...availabilityGapItems, ...remediationItems];

  return {
    countSummary: [
      `resolution_checklist=availability_gaps=${availabilityGapItems.length}`,
      `remediation_actions=${remediationActionRows.length}`,
      `policy_context_available=${policyContextCount}`,
      `total_items=${items.length}`
    ].join(", "),
    nextResolutionFocus: gapSummary.nextGapFocus.replace("next_gap_focus=", "next_resolution_focus="),
    checklistState: availabilityGapItems.length > 0
      ? "resolution_checklist_availability_gaps_present"
      : remediationActionRows.length > 0
        ? "resolution_checklist_remediation_actions_present"
        : "resolution_checklist_no_current_items",
    items
  };
}

function privateReadinessReviewPacketSourceProvenanceSummary({
  decision,
  posture,
  previousPosture,
  availabilitySummary,
  remediationActionRows,
  remediationProgressSummary,
  resolutionChecklist
}: {
  decision: PrivateReadinessPolicyDecision;
  posture?: PrivateReadinessPostureReadModel | null;
  previousPosture?: PrivateReadinessPostureReadModel;
  availabilitySummary: PrivateReadinessReviewPacketAvailabilitySummary;
  remediationActionRows: PrivateReadinessRemediationActionRow[];
  remediationProgressSummary: PrivateReadinessRemediationProgressSummary;
  resolutionChecklist: PrivateReadinessReviewPacketResolutionChecklist;
}): PrivateReadinessReviewPacketSourceProvenanceSummary {
  const rows = PRIVATE_READINESS_REVIEW_PACKET_INDEX_ENTRIES.map((entry) => {
    const availabilityRow = availabilitySummary.rows.find((row) => row.step === entry.step);
    return privateReadinessReviewPacketSourceProvenanceRow({
      entry,
      decision,
      posture,
      previousPosture,
      availabilityRow,
      remediationActionRows,
      remediationProgressSummary,
      resolutionChecklist
    });
  });
  const nextSourceRow =
    rows.find((row) => row.provenance.includes("not_available")) ??
    rows[0];

  return {
    countSummary: [
      `source_provenance=policy_refs=${decision.source_surface_refs.length}`,
      `posture_refs=${posture ? 1 : 0}`,
      `previous_posture_refs=${previousPosture ? 1 : 0}`,
      `projection_rows=${rows.length}`
    ].join(", "),
    nextSourceFocus: nextSourceRow
      ? `next_source_focus=${nextSourceRow.item} -> ${nextSourceRow.source}`
      : "next_source_focus=no_review_packet_sources",
    sourceState: !posture
      ? "source_provenance_policy_only_posture_context_missing"
      : previousPosture
        ? "source_provenance_posture_context_available"
        : "source_provenance_previous_posture_missing",
    rows
  };
}

function privateReadinessReviewPacketCompletionReadinessSummary({
  availabilitySummary,
  gapSummary,
  remediationActionRows,
  remediationProgressSummary,
  resolutionChecklist,
  sourceProvenanceSummary
}: {
  availabilitySummary: PrivateReadinessReviewPacketAvailabilitySummary;
  gapSummary: PrivateReadinessReviewPacketGapSummary;
  remediationActionRows: PrivateReadinessRemediationActionRow[];
  remediationProgressSummary: PrivateReadinessRemediationProgressSummary;
  resolutionChecklist: PrivateReadinessReviewPacketResolutionChecklist;
  sourceProvenanceSummary: PrivateReadinessReviewPacketSourceProvenanceSummary;
}): PrivateReadinessReviewPacketCompletionReadinessSummary {
  const availabilityGapCount = availabilitySummary.rows.filter((row) =>
    row.availability === "needs_posture_context" || row.availability === "no_current_items"
  ).length;
  const sourceGapCount = sourceProvenanceSummary.rows.filter((row) =>
    row.provenance.includes("not_available")
  ).length;
  const nextCompletionFocus = availabilityGapCount > 0
    ? gapSummary.nextGapFocus.replace("next_gap_focus=", "next_completion_focus=")
    : sourceGapCount > 0
      ? sourceProvenanceSummary.nextSourceFocus.replace("next_source_focus=", "next_completion_focus=")
      : resolutionChecklist.items.length > 0
        ? resolutionChecklist.nextResolutionFocus.replace(
            "next_resolution_focus=",
            "next_completion_focus="
          )
        : "next_completion_focus=review_packet_ready_for_operator_scan";

  return {
    countSummary: [
      `completion_readiness=review_surfaces=${availabilitySummary.rows.length}`,
      `availability_gaps=${availabilityGapCount}`,
      `source_gaps=${sourceGapCount}`,
      `resolution_items=${resolutionChecklist.items.length}`,
      `remediation_actions=${remediationActionRows.length}`
    ].join(", "),
    nextReviewFocus: remediationProgressSummary.nextReviewFocus,
    nextCompletionFocus,
    readinessState: privateReadinessReviewPacketCompletionReadinessState({
      availabilityGapCount,
      sourceGapCount,
      remediationActionRows,
      sourceProvenanceSummary
    }),
    boundary: "read_only_completion_readiness_context"
  };
}

function privateReadinessReviewPacketCompletionReadinessState({
  availabilityGapCount,
  sourceGapCount,
  remediationActionRows,
  sourceProvenanceSummary
}: {
  availabilityGapCount: number;
  sourceGapCount: number;
  remediationActionRows: PrivateReadinessRemediationActionRow[];
  sourceProvenanceSummary: PrivateReadinessReviewPacketSourceProvenanceSummary;
}): string {
  if (sourceProvenanceSummary.sourceState === "source_provenance_policy_only_posture_context_missing") {
    return "completion_readiness_policy_only_posture_context_missing";
  }
  if (availabilityGapCount > 0) {
    return "completion_readiness_availability_gaps_present";
  }
  if (sourceGapCount > 0) {
    return "completion_readiness_source_gaps_present";
  }
  if (remediationActionRows.length > 0) {
    return "completion_readiness_remediation_actions_present";
  }
  return "completion_readiness_ready_for_operator_scan";
}

function privateReadinessReviewPacketSourceProvenanceRow({
  entry,
  decision,
  posture,
  previousPosture,
  availabilityRow,
  remediationActionRows,
  remediationProgressSummary,
  resolutionChecklist
}: {
  entry: PrivateReadinessReviewPacketIndexEntry;
  decision: PrivateReadinessPolicyDecision;
  posture?: PrivateReadinessPostureReadModel | null;
  previousPosture?: PrivateReadinessPostureReadModel;
  availabilityRow?: PrivateReadinessReviewPacketAvailabilityRow;
  remediationActionRows: PrivateReadinessRemediationActionRow[];
  remediationProgressSummary: PrivateReadinessRemediationProgressSummary;
  resolutionChecklist: PrivateReadinessReviewPacketResolutionChecklist;
}): PrivateReadinessReviewPacketSourceProvenanceRow {
  const detail = `availability=${availabilityRow?.availability ?? "unknown"} / ${
    availabilityRow?.detail ?? "availability_not_projected"
  }`;
  const boundary = "read_only_source_provenance_context";

  if (entry.step === "01 policy_impact_interpretation") {
    return {
      item: entry.step,
      source: "PrivateReadinessPolicyDecision.source_surface_refs",
      provenance: formatPrivateReadinessReviewPacketRefs(decision.source_surface_refs),
      detail,
      boundary
    };
  }

  if (entry.step === "02 posture_delta_summary") {
    return {
      item: entry.step,
      source: "private_readiness_posture_history",
      provenance: posture
        ? `${posture.posture_id} -> ${previousPosture?.posture_id ?? "previous_posture_not_available"}`
        : "latest_posture_not_available",
      detail,
      boundary
    };
  }

  if (entry.step === "03 review_handoff") {
    return {
      item: entry.step,
      source: "review_packet_projection",
      provenance: posture ? `latest_posture=${posture.posture_id}` : "latest_posture_not_available",
      detail: `${detail} / policy_status=${decision.status}`,
      boundary
    };
  }

  if (entry.step === "04 authority_gate_preview") {
    return {
      item: entry.step,
      source: "PrivateReadinessPolicyDecision.authority_status",
      provenance: `authority_status=${decision.authority_status}`,
      detail: `${detail} / private_read_authority=not_granted`,
      boundary
    };
  }

  if (entry.step === "05 checked_gate_matrix") {
    return {
      item: entry.step,
      source: "PrivateReadinessPolicyDecision.checked_gates",
      provenance: `checked_gates=${decision.checked_gates.length}`,
      detail: `${detail} / ${privateReadinessGateStatusSummary(decision)}`,
      boundary
    };
  }

  if (entry.step === "06 remediation_action_map") {
    return {
      item: entry.step,
      source: "PrivateReadinessPolicyDecision.required_next_actions",
      provenance: `required_next_actions=${decision.required_next_actions.length}`,
      detail: `${detail} / ${remediationProgressSummary.coverage}`,
      boundary
    };
  }

  return {
    item: entry.step,
    source: "review_packet_projection.remediationProgressSummary",
    provenance: `remediation_rows=${remediationActionRows.length}`,
    detail: `${detail} / ${resolutionChecklist.checklistState}`,
    boundary
  };
}

function privateReadinessReviewPacketAvailabilityRow({
  entry,
  decision,
  posture,
  previousPosture,
  remediationActionRows,
  remediationProgressSummary
}: {
  entry: PrivateReadinessReviewPacketIndexEntry;
  decision: PrivateReadinessPolicyDecision;
  posture?: PrivateReadinessPostureReadModel | null;
  previousPosture?: PrivateReadinessPostureReadModel;
  remediationActionRows: PrivateReadinessRemediationActionRow[];
  remediationProgressSummary: PrivateReadinessRemediationProgressSummary;
}): PrivateReadinessReviewPacketAvailabilityRow {
  const base = {
    step: entry.step,
    surface: entry.surface,
    boundary: "read_only_availability_context"
  };

  if (entry.step === "01 policy_impact_interpretation") {
    return posture
      ? {
          ...base,
          availability: "available_for_review",
          detail: "policy_input_posture_available"
        }
      : {
          ...base,
          availability: "policy_context_available",
          detail: "policy_decision_available_posture_input_missing"
        };
  }

  if (entry.step === "02 posture_delta_summary") {
    if (!posture) {
      return {
        ...base,
        availability: "needs_posture_context",
        detail: "latest_posture_required_for_delta"
      };
    }
    return previousPosture
      ? {
          ...base,
          availability: "available_for_review",
          detail: "posture_delta_current_and_previous_available"
        }
      : {
          ...base,
          availability: "no_current_items",
          detail: "previous_posture_not_available"
        };
  }

  if (entry.step === "03 review_handoff") {
    return posture
      ? {
          ...base,
          availability: "available_for_review",
          detail: "review_handoff_context_available"
        }
      : {
          ...base,
          availability: "needs_posture_context",
          detail: "latest_posture_required_for_review_handoff"
        };
  }

  if (entry.step === "04 authority_gate_preview") {
    return posture
      ? {
          ...base,
          availability: "available_for_review",
          detail: "authority_gate_preview_context_available"
        }
      : {
          ...base,
          availability: "needs_posture_context",
          detail: "latest_posture_required_for_authority_preview"
        };
  }

  if (entry.step === "05 checked_gate_matrix") {
    return decision.checked_gates.length > 0
      ? {
          ...base,
          availability: "available_for_review",
          detail: `checked_gates=${decision.checked_gates.length}`
        }
      : {
          ...base,
          availability: "no_current_items",
          detail: "checked_gates_empty"
        };
  }

  if (entry.step === "06 remediation_action_map") {
    return remediationActionRows.length > 0
      ? {
          ...base,
          availability: "available_for_review",
          detail: `required_next_actions=${remediationActionRows.length}`
        }
      : {
          ...base,
          availability: "no_current_items",
          detail: "required_next_actions_empty"
        };
  }

  return remediationActionRows.length > 0
    ? {
        ...base,
        availability: "available_for_review",
        detail: remediationProgressSummary.progressState
      }
    : {
        ...base,
        availability: "no_current_items",
        detail: "no_required_next_actions"
      };
}

function findPrivateReadinessRemediationGate(
  action: string,
  decision: PrivateReadinessPolicyDecision
): PrivateReadinessPolicyDecision["checked_gates"][number] | undefined {
  const dimension = privateReadinessRemediationActionDimension(action);
  return decision.checked_gates.find((gate) =>
    gate.dimension === dimension ||
    gate.dimension === action ||
    gate.reason_code === action ||
    gate.reason === action
  );
}

function findPrivateReadinessRemediationBlocker(
  action: string,
  decision: PrivateReadinessPolicyDecision
): { dimension: string; condition: string } | undefined {
  const dimension = privateReadinessRemediationActionDimension(action);
  for (const condition of decision.blocking_conditions) {
    const conditionDimension = privateReadinessBlockingConditionDimension(condition);
    if (
      conditionDimension &&
      (conditionDimension === dimension || conditionDimension === action || condition.includes(action))
    ) {
      return { dimension: conditionDimension, condition };
    }
  }
  return undefined;
}

function privateReadinessRemediationActionDimension(action: string): string {
  return PRIVATE_READINESS_ACTION_DIMENSION_ALIASES[action] ?? action;
}

function privateReadinessBlockingConditionDimension(condition: string): string | undefined {
  const separator = condition.indexOf(":");
  if (separator === -1) {
    return undefined;
  }
  const dimension = condition.slice(0, separator).trim();
  return dimension.length > 0 ? dimension : undefined;
}

function privateReadinessGateStatusSummary(decision: PrivateReadinessPolicyDecision): string {
  const gateCounts: Record<PrivateReadinessPolicyDecision["status"], number> = {
    ready: 0,
    not_ready: 0,
    review_required: 0,
    blocked: 0
  };
  for (const gate of decision.checked_gates) {
    gateCounts[gate.status] += 1;
  }
  return [
    `ready=${gateCounts.ready}`,
    `not_ready=${gateCounts.not_ready}`,
    `review_required=${gateCounts.review_required}`,
    `blocked=${gateCounts.blocked}`
  ].join(", ");
}

function formatPrivateReadinessReviewPacketRefs(
  refs: Array<{ record_kind: string; id: string }>
): string {
  return refs.length > 0
    ? refs.map((ref) => `${ref.record_kind}:${ref.id}`).join(" / ")
    : "no_source_surface_refs";
}
