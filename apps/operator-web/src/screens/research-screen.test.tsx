import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ResearchSessionDetailReadModel } from "@ouroboros/domain";
import type { ResearchSessionViewModel, ResearchWorkspaceViewModel } from "@/app/operator-view-model";
import {
  closeResearchDetail,
  preserveResearchOrigin,
  ResearchScreen,
  resolveResearchDetailFocusPhase,
  resolveResearchMasterTab,
  settleResearchOrigin
} from "./research-screen";

function session(overrides: Partial<ResearchSessionViewModel> = {}): ResearchSessionViewModel {
  return {
    id: "research-1", allocationId: "allocation-1", workerId: "worker-1", commitmentId: "commitment-1",
    status: "running", projectionHealth: "complete", degradedReasons: [],
    triggerAvailability: "available", triggerKind: "arena_event",
    goal: "Improve spread robustness", triggeredAt: "2026-07-23T00:00:00.000Z",
    methodologyAvailability: "available", direction: "execution_cost_robustness",
    hypothesis: "A spread gate helps.", method: "Compare bounded variants.", evidenceArtifactCount: 1,
    providerAvailability: "available", provider: "codex_cli", model: "gpt-5",
    completedExperimentCount: 1, maxExperimentCount: 2, developmentSubmissionCount: 1,
    maxDevelopmentSubmissionCount: 2, lastProgressAt: "2026-07-23T00:02:00.000Z",
    latestProgressSummary: "Evaluating a persisted submission.", detailAvailability: "summary_only",
    ...overrides
  };
}

function view(sessions: ResearchSessionViewModel[] = [session()]): ResearchWorkspaceViewModel {
  return {
    availability: "authoritative", loopStatus: "running",
    capacity: { max_concurrent_sessions: 2, active_session_count: sessions.length, queued_session_count: 0 },
    sessions,
    history: [{
      id: "tick-1", status: "completed", startedAt: "2026-07-23T00:00:00.000Z",
      completedAt: "2026-07-23T00:01:00.000Z", createdCandidateCount: 0, createdCandidateIds: [],
      directionCount: 1, failedDirectionCount: 0, directions: []
    }],
    findingClusters: [], emptyState: "none"
  };
}

function minimalDetail(id = "research-1"): ResearchSessionDetailReadModel {
  return {
    identity_kind: "derived_projection", research_work_item_id: id, research_allocation_id: "allocation-1",
    direction_kind: "execution_cost_robustness", status: "running",
    status_basis: { basis_kind: "runtime_research_work_item", authority_status: "read_only" },
    projection_health: "complete", degraded_reasons: [], trigger_availability: "available",
    trigger: {
      trigger_kind: "arena_event", trigger_id: "trigger-detail-unique", goal: "EXACT-DETAIL-GOAL",
      goal_truncated: false, triggered_at: "2026-07-23T00:00:00.000Z", authority_status: "research_only"
    },
    methodology_availability: "available",
    methodology: {
      direction_kind: "execution_cost_robustness", hypothesis: "Exact detail hypothesis.",
      hypothesis_truncated: false, method: "Exact detail method.", method_truncated: false,
      evidence_artifact_ids: [], authority_status: "research_only"
    },
    provider_availability: "available", provider: "codex_cli",
    budget: {
      max_experiment_count: 2, completed_experiment_count: 1, max_development_submission_count: 2,
      development_submission_count: 1, remaining_development_submission_count: 1, authority_status: "research_only"
    },
    last_progress_at: "2026-07-23T00:02:00.000Z", latest_progress_summary: "EXACT-DETAIL-PROGRESS",
    latest_progress_summary_truncated: false, authority_status: "research_only", evidence_inputs: [],
    development_submissions: [], submission_history_availability: "unavailable_until_checkpoint",
    selected_artifact_availability: "unavailable", notebook_summary: [], notebook_summary_truncated: false,
    lifecycle_events: [], provider_logs_availability: "not_persisted", terminal_graph: { authority_status: "read_only" }
  };
}

function markup(options: {
  selectedId?: string; sessions?: ResearchSessionViewModel[]; detail?: ResearchSessionDetailReadModel;
  detailLoading?: boolean; detailError?: string;
} = {}): string {
  return renderToStaticMarkup(
    <ResearchScreen
      view={view(options.sessions)} selectedId={options.selectedId} detail={options.detail}
      detailLoading={options.detailLoading ?? false} detailError={options.detailError}
      commandRunning={false} onSelect={vi.fn()} onCommand={vi.fn()}
    />
  );
}

describe("ResearchScreen", () => {
  it("renders the authoritative desktop table with nine ordered semantic headers", () => {
    const rendered = markup();
    const headers = [
      "Lifecycle", "Methodology", "Direction", "Trigger", "Provider",
      "Budget", "Submissions", "Result", "Latest progress"
    ];
    const actual = Array.from(rendered.matchAll(/<th\b[^>]*scope="col"[^>]*>([\s\S]*?)<\/th>/g))
      .map((match) => match[1]!.replace(/<[^>]+>/g, ""));
    expect(actual).toEqual(headers);
    expect(rendered).toContain("hidden lg:block");
    expect(rendered).toContain("lg:hidden");
    expect(rendered).toContain("min-w-[1100px]");
    expect(rendered).toContain("focus-visible:ring-2");
  });

  it("renders bounded degraded copy while keeping CandidateArena history visible", () => {
    const unavailableView = view([]);
    unavailableView.availability = "unavailable";
    unavailableView.loopStatus = "degraded";
    unavailableView.emptyState = "projection_unavailable";
    unavailableView.capacity = undefined;

    const rendered = renderToStaticMarkup(
      <ResearchScreen
        view={unavailableView}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(rendered).toContain("Research projection unavailable");
    expect(rendered).toContain("could not be rebuilt");
    expect(rendered).toContain("CandidateArena history and other Operator surfaces remain available");
    expect(rendered).toContain("Loop degraded");
    expect(rendered).toContain("Tick history 1");
    expect(rendered).not.toContain("The Research projection is available");
  });

  it("keeps Tick history separately labeled and marks native selections with aria-current", () => {
    const rendered = markup({ selectedId: "research-1", detail: minimalDetail() });
    expect(rendered).toContain("Sessions 1");
    expect(rendered).toContain("Tick history 1");
    expect(rendered).toMatch(/<button\b[^>]*aria-current="true"/);
    expect(rendered).toContain('type="button"');
  });

  it("renders bounded degraded health reasons in both desktop rows and narrow cards", () => {
    const rendered = markup({
      sessions: [session({
        projectionHealth: "degraded",
        degradedReasons: [
          "trigger_unavailable",
          "methodology_unavailable",
          "admission_graph_conflict",
          "worker_unavailable",
          "evidence_artifact_unavailable"
        ]
      })]
    });

    expect(rendered.split(">Degraded<")).toHaveLength(3);
    expect(rendered.split("Trigger Unavailable")).toHaveLength(3);
    expect(rendered.split("Methodology Unavailable")).toHaveLength(3);
    expect(rendered.split("Admission Graph Conflict")).toHaveLength(3);
    expect(rendered.split("+2 more")).toHaveLength(3);
    expect(rendered).not.toContain("Worker Unavailable");
    expect(rendered).not.toContain("Evidence Artifact Unavailable");
  });

  it("renders Evaluation and admission graph conflicts as distinct bounded reasons", () => {
    const rendered = markup({
      sessions: [session({
        projectionHealth: "degraded",
        degradedReasons: [
          "evaluation_graph_conflict",
          "admission_graph_conflict"
        ]
      })]
    });

    expect(rendered.split("Evaluation Graph Conflict")).toHaveLength(3);
    expect(rendered.split("Admission Graph Conflict")).toHaveLength(3);
    expect(rendered).not.toContain("Unknown degradation reason");
  });

  it("bounds Research session rows while preserving a selected session outside the first page", () => {
    const sessions = Array.from({ length: 65 }, (_, index) => session({
      id: `research-${String(index).padStart(3, "0")}`,
      goal: `Research goal ${String(index).padStart(3, "0")}`
    }));

    const rendered = markup({
      sessions,
      selectedId: "research-064",
      detail: minimalDetail("research-064")
    });

    expect(rendered).toContain("Research goal 058");
    expect(rendered).not.toContain("Research goal 059");
    expect(rendered).toContain("Research goal 064");
    expect(rendered).toContain("Showing 60 of 65 matching sessions");
  });

  it("distinguishes server-projected summaries from the recorded Research session total", () => {
    const truncatedView = view();
    truncatedView.sessionWindow = {
      recordedCount: 4,
      projectedCount: 1,
      omittedCount: 3,
      truncated: true
    };
    const rendered = renderToStaticMarkup(
      <ResearchScreen
        view={truncatedView}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(rendered).toContain("1 projected · 3 omitted");
    expect(rendered).toContain(
      "Bounded summary projection: 1 of 4 sessions · 3 omitted · exact URL detail remains available."
    );
  });

  it("never renders arbitrary CandidateArena direction failure text from history", () => {
    const historyView = view([]);
    historyView.history[0]!.directions = [{
      direction: "trend_following",
      status: "failed",
      error: "RAW-HISTORY-FAILURE-POISON",
      researchEfficiency: undefined
    }];
    const rendered = renderToStaticMarkup(
      <ResearchScreen
        view={historyView}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(rendered).not.toContain("RAW-HISTORY-FAILURE-POISON");
    expect(rendered).toContain("Research direction failed; failure detail is unavailable.");
  });

  it("gates trigger and methodology text independently across table, card, and detail", () => {
    const triggerUnavailable = session({
      id: "research-trigger-unavailable",
      triggerAvailability: "unavailable",
      goal: "TRIGGER-GOAL-POISON",
      methodologyAvailability: "available",
      hypothesis: "Safe methodology hypothesis.",
      method: "Safe bounded method."
    });
    const triggerUnavailableMarkup = markup({
      selectedId: triggerUnavailable.id,
      sessions: [triggerUnavailable]
    });

    expect(triggerUnavailableMarkup).not.toContain("TRIGGER-GOAL-POISON");
    expect(triggerUnavailableMarkup).toContain("Safe methodology hypothesis.");
    expect(triggerUnavailableMarkup).toContain("Safe bounded method.");
    expect(triggerUnavailableMarkup).toContain("Trigger unavailable");
    expect(triggerUnavailableMarkup).toMatch(/<h3\b[^>]*>Safe methodology hypothesis\.<\/h3>/);

    const methodologyUnavailable = session({
      id: "research-methodology-unavailable",
      triggerAvailability: "available",
      triggerKind: "goal",
      goal: "Safe trigger goal.",
      methodologyAvailability: "unavailable",
      hypothesis: "HYPOTHESIS-POISON",
      method: "METHOD-POISON"
    });
    const methodologyUnavailableMarkup = markup({
      selectedId: methodologyUnavailable.id,
      sessions: [methodologyUnavailable]
    });

    expect(methodologyUnavailableMarkup).toContain("Safe trigger goal.");
    expect(methodologyUnavailableMarkup).toContain("Methodology unavailable");
    expect(methodologyUnavailableMarkup).not.toContain("HYPOTHESIS-POISON");
    expect(methodologyUnavailableMarkup).not.toContain("METHOD-POISON");

    const bothUnavailable = session({
      id: "research-source-unavailable",
      triggerAvailability: "unavailable",
      goal: "",
      methodologyAvailability: "unavailable",
      hypothesis: "",
      method: ""
    });
    expect(markup({ selectedId: bothUnavailable.id, sessions: [bothUnavailable] }))
      .toMatch(/<h3\b[^>]*>Research session<\/h3>/);
  });

  it("suppresses cross-ID retained evidence for a stale selected URL", () => {
    const rendered = markup({ selectedId: "removed-research-id", detail: minimalDetail("research-1") });
    expect(rendered).toContain("Selected session is not in the current projection");
    expect(rendered).not.toContain("EXACT-DETAIL-GOAL");
    expect(rendered).not.toContain("EXACT-DETAIL-PROGRESS");
  });

  it("renders exact URL-selected detail even when the bounded summary list omits it", () => {
    const emptyView = view([]);
    emptyView.history = [];
    emptyView.emptyState = "available_empty";
    const rendered = renderToStaticMarkup(
      <ResearchScreen
        view={emptyView}
        selectedId="research-outside-summary-bound"
        detail={minimalDetail("research-outside-summary-bound")}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(rendered).not.toContain("Selected session is not in the current projection");
    expect(rendered).not.toContain("No Research sessions");
    expect(rendered).toContain("EXACT-DETAIL-GOAL");
    expect(rendered).toContain("EXACT-DETAIL-PROGRESS");
  });

  it("shows an exact-detail loading state instead of declaring an outside-list URL stale", () => {
    const emptyView = view([]);
    emptyView.history = [];
    emptyView.emptyState = "available_empty";
    const rendered = renderToStaticMarkup(
      <ResearchScreen
        view={emptyView}
        selectedId="research-outside-summary-bound"
        detailLoading
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(rendered).toContain("Loading persisted Research evidence");
    expect(rendered).not.toContain("Selected session is not in the current projection");
  });

  it("shows cold outside-list transport failure as unavailable instead of a 404 miss", () => {
    const emptyView = view([]);
    emptyView.history = [];
    emptyView.emptyState = "available_empty";
    const rendered = renderToStaticMarkup(
      <ResearchScreen
        view={emptyView}
        selectedId="research-outside-summary-bound"
        detailError="Failed to load Research session: 503"
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(rendered).toContain("Research detail unavailable");
    expect(rendered).toContain("Failed to load Research session: 503");
    expect(rendered).not.toContain("Selected session is not in the current projection");
    expect(rendered).not.toContain("current Research evidence no longer contains it");
  });

  it("keeps exact same-ID evidence visible with a distinct refresh warning", () => {
    const rendered = markup({
      selectedId: "research-1", detail: minimalDetail(), detailError: "runtime transport unavailable"
    });
    expect(rendered).toContain("Research detail refresh degraded");
    expect(rendered).toContain("runtime transport unavailable");
    expect(rendered).toContain("EXACT-DETAIL-GOAL");
    expect(rendered).toContain("EXACT-DETAIL-PROGRESS");
  });

  it("resolves direct, stale, and empty-to-live state to the authoritative Sessions tab", () => {
    expect(resolveResearchMasterTab({ currentTab: "history", previousSessionCount: 0, sessionCount: 1 })).toBe("sessions");
    expect(resolveResearchMasterTab({
      currentTab: "history", previousSessionCount: 0, sessionCount: 0, selectedId: "direct-url-id"
    })).toBe("sessions");
    expect(resolveResearchMasterTab({ currentTab: "history", previousSessionCount: 0, sessionCount: 0 })).toBe("history");
  });

  it("clears only the Research selection before restoring focus after the route commit", () => {
    const onSelect = vi.fn();
    closeResearchDetail({ onSelect });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(undefined);

    const focusOrigin = vi.fn();
    expect(settleResearchOrigin({
      originId: "research-1", selectedId: "research-1", focusOrigin
    })).toBe("research-1");
    expect(focusOrigin).not.toHaveBeenCalled();
    expect(settleResearchOrigin({
      originId: "research-1", selectedId: undefined, focusOrigin
    })).toBeUndefined();
    expect(focusOrigin).toHaveBeenCalledOnce();
    expect(focusOrigin).toHaveBeenCalledWith("research-1");
    expect(preserveResearchOrigin("research-1", "research-1")).toBe("research-1");
    expect(preserveResearchOrigin("research-1", "direct-url-id")).toBeUndefined();
  });

  it("changes the detail focus phase when an async deep link replaces its loading heading", () => {
    expect(resolveResearchDetailFocusPhase({
      selectedId: "deep-link-id", sessionAvailable: false, detailLoading: true
    })).toBe("loading");
    expect(resolveResearchDetailFocusPhase({
      selectedId: "deep-link-id", sessionAvailable: true, detailLoading: false
    })).toBe("loaded");
    expect(resolveResearchDetailFocusPhase({
      selectedId: "deep-link-id", sessionAvailable: false, detailLoading: false
    })).toBe("unavailable");
    expect(resolveResearchDetailFocusPhase({
      selectedId: undefined, sessionAvailable: false, detailLoading: false
    })).toBe("none");
  });

  it("stacks long terminal badges below the narrow-card heading before the sm breakpoint", () => {
    const rendered = markup({
      sessions: [session({ status: "finished_without_submission", projectionHealth: "complete" })]
    });
    const source = readFileSync(new URL("./research-screen.tsx", import.meta.url), "utf8");

    expect(rendered).toContain('data-research-card-heading="true"');
    expect(rendered).toContain('data-research-card-badges="true"');
    expect(source).toContain("flex min-w-0 flex-col items-start gap-2 sm:flex-row");
    expect(source).toContain("flex max-w-full flex-wrap gap-1 sm:shrink-0 sm:justify-end");
  });

  it("wires narrow detail focus to the heading and preserves a 40px Back target", () => {
    const rendered = markup({ selectedId: "research-1", detail: minimalDetail() });
    const source = readFileSync(new URL("./research-screen.tsx", import.meta.url), "utf8");
    expect(rendered).toContain('tabindex="-1"');
    expect(rendered).toContain("min-h-10");
    expect(source).toContain("focusNarrowDetail(detailHeadingRef.current)");
    expect(source).toContain("[selectedId, detailFocusPhase]");
    expect(source).toContain("settleResearchOrigin({");
    expect(source).toContain("narrowCardRefs.current.set(session.id, node)");
  });
});
