import { describe, expect, it } from "vitest";
import {
  fixturePrivateReadinessPolicyDecision,
  fixturePrivateReadinessPosture
} from "../../../test/support/binance-no-authority";
import { buildPrivateReadinessReviewPacketProjection } from "./private-readiness-review-packet";

describe("buildPrivateReadinessReviewPacketProjection", () => {
  it("projects review packet state with posture context from one source", () => {
    const projection = buildPrivateReadinessReviewPacketProjection({
      decision: fixturePrivateReadinessPolicyDecision(),
      posture: fixturePrivateReadinessPosture({
        posture_id: "local-binance-btcusdt-private-readiness-posture-history-002"
      }),
      previousPosture: fixturePrivateReadinessPosture()
    });

    expect(projection.indexEntries).toHaveLength(7);
    expect(projection.remediationActionRows).toHaveLength(6);
    expect(projection.remediationProgressSummary.coverage).toBe(
      "required_actions=6, mapped_actions=6, unmapped_actions=0"
    );
    expect(projection.remediationProgressSummary.nextReviewFocus).toBe(
      "next_review_focus=configure_private_read_credentials -> checked_gate: configuration"
    );
    expect(projection.availabilitySummary.countSummary).toBe(
      "availability_summary=available_for_review=7, needs_posture_context=0, no_current_items=0, policy_context_available=0"
    );
    expect(projection.gapSummary.countSummary).toBe(
      "gap_summary=needs_posture_context=0, no_current_items=0, policy_context_available=0"
    );
    expect(projection.gapSummary.gapState).toBe("review_packet_remediation_focus_present");
    expect(projection.resolutionChecklist.countSummary).toBe(
      "resolution_checklist=availability_gaps=0, remediation_actions=6, policy_context_available=0, total_items=6"
    );
    expect(projection.resolutionChecklist.nextResolutionFocus).toBe(
      "next_resolution_focus=configure_private_read_credentials -> checked_gate: configuration"
    );
    expect(projection.resolutionChecklist.checklistState).toBe(
      "resolution_checklist_remediation_actions_present"
    );
    expect(projection.sourceProvenanceSummary.countSummary).toBe(
      "source_provenance=policy_refs=2, posture_refs=1, previous_posture_refs=1, projection_rows=7"
    );
    expect(projection.sourceProvenanceSummary.nextSourceFocus).toBe(
      "next_source_focus=01 policy_impact_interpretation -> PrivateReadinessPolicyDecision.source_surface_refs"
    );
    expect(projection.sourceProvenanceSummary.sourceState).toBe(
      "source_provenance_posture_context_available"
    );
    expect(projection.sourceProvenanceSummary.rows).toContainEqual({
      item: "02 posture_delta_summary",
      source: "private_readiness_posture_history",
      provenance:
        "local-binance-btcusdt-private-readiness-posture-history-002 -> fixture-binance-btcusdt-private-readiness-posture-001",
      detail: "availability=available_for_review / posture_delta_current_and_previous_available",
      boundary: "read_only_source_provenance_context"
    });
  });

  it("projects sparse policy-only state without adding authority", () => {
    const projection = buildPrivateReadinessReviewPacketProjection({
      decision: fixturePrivateReadinessPolicyDecision({
        checked_gates: [],
        reason_codes: ["no_private_read_performed"],
        blocking_conditions: [],
        required_next_actions: []
      }),
      posture: null
    });

    expect(projection.indexEntries).toHaveLength(7);
    expect(projection.remediationActionRows).toHaveLength(0);
    expect(projection.remediationProgressSummary.coverage).toBe(
      "required_actions=0, mapped_actions=0, unmapped_actions=0"
    );
    expect(projection.remediationProgressSummary.nextReviewFocus).toBe(
      "next_review_focus=no_required_next_actions"
    );
    expect(projection.availabilitySummary.countSummary).toBe(
      "availability_summary=available_for_review=0, needs_posture_context=3, no_current_items=3, policy_context_available=1"
    );
    expect(projection.gapSummary.countSummary).toBe(
      "gap_summary=needs_posture_context=3, no_current_items=3, policy_context_available=1"
    );
    expect(projection.gapSummary.nextGapFocus).toBe(
      "next_gap_focus=02 posture_delta_summary -> latest_posture_required_for_delta"
    );
    expect(projection.gapSummary.gapState).toBe("review_packet_availability_gaps_present");
    expect(projection.resolutionChecklist.countSummary).toBe(
      "resolution_checklist=availability_gaps=6, remediation_actions=0, policy_context_available=1, total_items=6"
    );
    expect(projection.resolutionChecklist.nextResolutionFocus).toBe(
      "next_resolution_focus=02 posture_delta_summary -> latest_posture_required_for_delta"
    );
    expect(projection.resolutionChecklist.checklistState).toBe(
      "resolution_checklist_availability_gaps_present"
    );
    expect(projection.sourceProvenanceSummary.countSummary).toBe(
      "source_provenance=policy_refs=2, posture_refs=0, previous_posture_refs=0, projection_rows=7"
    );
    expect(projection.sourceProvenanceSummary.nextSourceFocus).toBe(
      "next_source_focus=02 posture_delta_summary -> private_readiness_posture_history"
    );
    expect(projection.sourceProvenanceSummary.sourceState).toBe(
      "source_provenance_policy_only_posture_context_missing"
    );
    expect(projection.sourceProvenanceSummary.rows).toContainEqual({
      item: "02 posture_delta_summary",
      source: "private_readiness_posture_history",
      provenance: "latest_posture_not_available",
      detail: "availability=needs_posture_context / latest_posture_required_for_delta",
      boundary: "read_only_source_provenance_context"
    });
  });
});
