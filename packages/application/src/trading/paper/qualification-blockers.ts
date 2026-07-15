import type { PaperTradingQualificationReason } from "@ouroboros/domain";

export type PaperTradingQualificationBlockerSeverity =
  | "collecting"
  | "needs_resume"
  | "blocked"
  | "failed";

export type PaperTradingQualificationBlockerGroupKind =
  | "evidence_authority"
  | "evidence_window"
  | "runner_health"
  | "observation_quality"
  | "market_provenance"
  | "fill_provenance";

export interface PaperTradingQualificationBlockerGroup {
  group_kind: PaperTradingQualificationBlockerGroupKind;
  severity: PaperTradingQualificationBlockerSeverity;
  blockers: PaperTradingQualificationReason[];
  summary: string;
  next_action: string;
}

export function paperTradingQualificationBlockerGroups(
  qualificationReasons: PaperTradingQualificationReason[]
): PaperTradingQualificationBlockerGroup[] {
  const groups: PaperTradingQualificationBlockerGroup[] = [];

  pushReasonGroup(
    groups,
    qualificationReasons,
    "evidence_authority",
    ["evidence_purpose_not_qualification"],
    "blocked",
    "Research-feedback paper evidence is not qualification authority.",
    "Run a prospective qualification comparison; research-feedback evidence remains research-only."
  );
  pushReasonGroup(
    groups,
    qualificationReasons,
    "evidence_authority",
    ["provider_identity_not_qualification_eligible"],
    "blocked",
    "The frozen runtime provider identity is not eligible for qualification.",
    "Create a new prospective qualification commitment with a verifiable provider identity; this window remains ineligible."
  );
  pushReasonGroup(
    groups,
    qualificationReasons,
    "evidence_authority",
    ["paper_evaluation_commitment_missing"],
    "blocked",
    "Paper evidence has no frozen execution commitment and cannot qualify.",
    "Start a new prospective qualification evaluation with a persisted commitment; uncommitted history remains ineligible."
  );
  pushReasonGroup(
    groups,
    qualificationReasons,
    "evidence_authority",
    ["paper_evaluation_invalidated"],
    "blocked",
    "The frozen paper execution identity was invalidated.",
    "Create a new candidate version and qualification commitment; invalidated evidence cannot resume."
  );

  pushReasonGroup(
    groups,
    qualificationReasons,
    "evidence_window",
    ["min_observation_count_not_met", "min_elapsed_ms_not_met"],
    "collecting",
    "Paper evidence window is not mature enough for review.",
    "Continue paper observations until count and elapsed-time gates qualify."
  );
  pushReasonGroup(
    groups,
    qualificationReasons,
    "runner_health",
    ["runner_inactive_for_running_evaluation"],
    "needs_resume",
    "Persisted paper evaluation needs an active runner before review.",
    "Resume paper trading before treating this Trading review candidate as current."
  );
  pushReasonGroup(
    groups,
    qualificationReasons,
    "observation_quality",
    [
      "paper_observation_chain_incomplete",
      "paper_score_account_mismatch"
    ],
    "blocked",
    "Paper observation and account evidence do not form a trustworthy chain.",
    "Preserve the inconsistent evidence for audit and start a new prospective qualification window after repairing persistence or accounting."
  );
  pushReasonGroup(
    groups,
    qualificationReasons,
    "observation_quality",
    [
      "failed_observation_ratio_exceeded",
      "paper_evaluation_failed"
    ],
    qualificationReasons.includes("paper_evaluation_failed") ? "failed" : "blocked",
    "Paper observation quality blocks trust in the score.",
    "Inspect the latest paper failure and fix the runtime or protocol issue before review."
  );
  pushReasonGroup(
    groups,
    qualificationReasons,
    "market_provenance",
    ["latest_market_snapshot_missing"],
    "blocked",
    "Paper score lacks current public market context.",
    "Restore Gateway market data evidence before review."
  );
  pushReasonGroup(
    groups,
    qualificationReasons,
    "fill_provenance",
    ["fill_public_execution_evidence_missing"],
    "blocked",
    "Fill-bearing paper evidence lacks matching public execution provenance.",
    "Restore public execution stream or backfill evidence and retry observation."
  );

  return groups;
}

function pushReasonGroup(
  groups: PaperTradingQualificationBlockerGroup[],
  qualificationReasons: PaperTradingQualificationReason[],
  group_kind: PaperTradingQualificationBlockerGroupKind,
  blockers: PaperTradingQualificationReason[],
  severity: PaperTradingQualificationBlockerSeverity,
  summary: string,
  next_action: string
) {
  const present = blockers.filter((blocker) => qualificationReasons.includes(blocker));
  if (present.length > 0) {
    groups.push({ group_kind, severity, blockers: present, summary, next_action });
  }
}
