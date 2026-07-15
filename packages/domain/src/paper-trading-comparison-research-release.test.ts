import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonResearchReleaseDigestInput,
  paperTradingComparisonResearchReleaseHasRuntimeShape,
  type ArtifactLineageRecord,
  type PaperTradingComparisonResearchReleaseKind,
  type PaperTradingComparisonResearchReleaseRecord,
  type ResearchFindingKind,
  type ResearchFindingRecord
} from "./index";

describe("paper trading comparison research release evidence", () => {
  it.each([
    ["confirmed_improvement", "positive_result"],
    ["challenger_not_reproduced", "negative_result"],
    ["comparison_evidence_ineligible", "failure_analysis"],
    ["campaign_slot_expired", "failure_analysis"]
  ] as const)("accepts %s research evidence", (releaseKind, findingKind) => {
    expect(paperTradingComparisonResearchReleaseHasRuntimeShape(
      releaseFixture(releaseKind, findingKind)
    )).toBe(true);
  });

  it("uses the canonical release digest payload", () => {
    const release = releaseFixture();
    const {
      record_kind: _kind,
      version: _version,
      paper_trading_comparison_research_release_id: _id,
      release_digest: _digest,
      ...payload
    } = release;

    expect(paperTradingComparisonResearchReleaseDigestInput(release)).toBe(
      paperTradingComparisonPersistedRecordDigestInput(payload)
    );
  });

  it.each([
    ["wrong campaign ref", (value: any) => {
      value.campaign_ref.record_kind = "paper_trading_comparison_verdict";
    }],
    ["wrong outcome ref", (value: any) => {
      value.campaign_outcome_ref.record_kind =
        "paper_trading_comparison_confirmation_campaign";
    }],
    ["non-canonical release ID", (value: any) => {
      value.paper_trading_comparison_research_release_id = "release-001";
    }],
    ["non-canonical finding ID", (value: any) => {
      value.finding.research_finding_id = "finding-001";
    }],
    ["non-canonical lineage ID", (value: any) => {
      value.lineage.artifact_lineage_id = "lineage-001";
    }],
    ["unsupported finding mapping", (value: any) => {
      value.finding.finding_kind = "negative_result";
    }],
    ["mismatched child SystemCode", (value: any) => {
      value.lineage.child_system_code_ref.id = "other-code";
    }],
    ["missing source finding lineage", (value: any) => {
      value.lineage.source_finding_refs.shift();
    }],
    ["missing released finding lineage", (value: any) => {
      value.lineage.source_finding_refs.pop();
    }],
    ["empty next focus", (value: any) => {
      value.next_research_focus = "";
    }],
    ["bad release time", (value: any) => {
      value.released_at = "2026-07-12 04:00:01";
    }],
    ["changed finding digest", (value: any) => {
      value.finding_record_digest = "";
    }],
    ["changed lineage digest", (value: any) => {
      value.lineage_record_digest = "";
    }],
    ["unreleased visibility", (value: any) => {
      value.research_visibility = "sealed";
    }],
    ["promotion authority", (value: any) => {
      value.promotion_authority = true;
    }],
    ["live authority", (value: any) => {
      value.live_exchange_authority = true;
    }],
    ["order authority", (value: any) => {
      value.order_submission_authority = true;
    }]
  ])("rejects %s", (_label, mutate) => {
    const release = releaseFixture() as any;
    mutate(release);

    expect(paperTradingComparisonResearchReleaseHasRuntimeShape(release)).toBe(false);
  });

  it.each([
    ["undefined", (value: any) => {
      value.next_research_focus = undefined;
    }],
    ["sparse array", (value: any) => {
      value.finding.supporting_record_refs = new Array(2);
    }],
    ["non-finite number", (value: any) => {
      value.non_canonical = Number.POSITIVE_INFINITY;
    }],
    ["cycle", (value: any) => {
      value.non_canonical = value;
    }]
  ])("rejects %s from canonical digest input", (_label, mutate) => {
    const release = releaseFixture() as any;
    mutate(release);

    expect(() => paperTradingComparisonResearchReleaseDigestInput(release)).toThrow(
      "paper_trading_comparison_non_persistable_record"
    );
  });
});

function releaseFixture(
  releaseKind: PaperTradingComparisonResearchReleaseKind = "confirmed_improvement",
  findingKind: ResearchFindingKind = "positive_result"
): PaperTradingComparisonResearchReleaseRecord {
  const releaseId = "campaign-outcome-001-research-release";
  const releasedAt = "2026-07-12T04:00:01.000Z";
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `${releaseId}-finding`,
    research_worker_ref: { record_kind: "research_worker", id: "worker-001" },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "direction-001"
    },
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment-001" },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: "evaluation-001"
    },
    finding_kind: findingKind,
    summary: "Campaign slots: improved=2, not_improved=0, ineligible=0, expired=0.",
    supporting_record_refs: [
      { record_kind: "research_finding", id: "source-finding" },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: "campaign-001"
      },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: "campaign-outcome-001"
      },
      { record_kind: "paper_trading_comparison_verdict", id: "slot-verdict-001" }
    ],
    created_at: releasedAt,
    authority_status: "research_trace_only"
  };
  const lineage: ArtifactLineageRecord = {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: `${releaseId}-lineage`,
    child_system_code_ref: { record_kind: "system_code", id: "challenger-code" },
    parent_system_code_ref: { record_kind: "system_code", id: "parent-code" },
    source_finding_refs: [
      { record_kind: "research_finding", id: "source-finding" },
      { record_kind: "research_finding", id: finding.research_finding_id }
    ],
    created_by_research_worker_ref: finding.research_worker_ref,
    created_at: releasedAt,
    authority_status: "lineage_only"
  };

  return {
    record_kind: "paper_trading_comparison_research_release",
    version: 1,
    paper_trading_comparison_research_release_id: releaseId,
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: "campaign-001"
    },
    campaign_digest: "sha256:campaign",
    campaign_outcome_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: "campaign-outcome-001"
    },
    campaign_outcome_digest: "sha256:outcome",
    candidate_ref: { record_kind: "trading_system_candidate", id: "challenger" },
    candidate_version_ref: { record_kind: "candidate_version", id: "challenger-v1" },
    system_code_ref: { record_kind: "system_code", id: "challenger-code" },
    system_code_artifact_digest: "sha256:challenger",
    source_finding_ref: { record_kind: "research_finding", id: "source-finding" },
    source_finding_record_digest: "sha256:source-finding",
    source_lineage_ref: { record_kind: "artifact_lineage", id: "source-lineage" },
    source_lineage_record_digest: "sha256:source-lineage",
    direction_kind: "mean_reversion",
    release_kind: releaseKind,
    finding,
    finding_record_digest: "sha256:finding",
    lineage,
    lineage_record_digest: "sha256:lineage",
    next_research_focus:
      "Preserve the confirmed artifact lineage and generate controlled variants under new prospective evidence.",
    released_at: releasedAt,
    release_digest: "sha256:release",
    research_visibility: "released_to_research",
    evaluation_authority: "external_to_trading_systems",
    promotion_authority: false,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "lineage_only"
  };
}
