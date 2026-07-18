import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArenaWorkspaceViewModel, ResearchWorkspaceViewModel } from "./app/operator-view-model";
import { ArenaScreen } from "./screens/arena-screen";
import { ResearchScreen } from "./screens/research-screen";

const srcRoot = dirname(fileURLToPath(import.meta.url));
const appRoot = dirname(srcRoot);

describe("greenfield Operator entrypoint", () => {
  it("routes the application through the new shell and five owned screens", () => {
    const source = readFileSync(join(srcRoot, "App.tsx"), "utf8");

    expect(source).toContain("OperatorShell");
    expect(source).toContain("ArenaScreen");
    expect(source).toContain("ResearchScreen");
    expect(source).toContain("TradingScreen");
    expect(source).toContain("EvidenceScreen");
    expect(source).toContain("SystemScreen");
    expect(source).not.toContain("active_researchers");
  });

  it("removes the old presentation hierarchy instead of retaining a migration shell", () => {
    for (const legacyPath of ["design-system", "sections", "shell"]) {
      expect(existsSync(join(srcRoot, legacyPath))).toBe(false);
    }
  });

  it("keeps boot and fatal states inside the same brand contract", () => {
    const indexSource = readFileSync(join(appRoot, "index.html"), "utf8");
    const mainSource = readFileSync(join(srcRoot, "main.tsx"), "utf8");

    for (const source of [indexSource, mainSource]) {
      expect(source).toContain("#F37021");
      expect(source).toContain("#17120F");
      expect(source).not.toContain("#111827");
    }

    expect(indexSource).toContain('aria-label="Loading Ouroboros Operator"');
    expect(mainSource).toContain('aria-label="Ouroboros Operator render failure"');
  });

  it("skips automatic runtime polling while the document is hidden", () => {
    const source = readFileSync(join(srcRoot, "app", "use-operator-runtime.ts"), "utf8");

    expect(source).toContain("document.visibilityState");
    expect(source).toContain('"hidden"');
  });

  it("moves focus into narrow Arena and Research detail panes", () => {
    for (const screen of ["arena-screen.tsx", "research-screen.tsx"]) {
      const source = readFileSync(join(srcRoot, "screens", screen), "utf8");

      expect(source).toContain("focusNarrowDetail(detailFocusRef.current)");
      expect(source).toContain("backButtonRef={detailFocusRef}");
      expect(source).toContain("ref={backButtonRef}");
    }
  });

  it("renders actual Arena summary evidence with inspectable commands", () => {
    const view: ArenaWorkspaceViewModel = {
      availability: "authoritative",
      loopStatus: "running",
      capacity: {
        max_concurrent_sessions: 2,
        active_session_count: 1,
        queued_session_count: 0
      },
      latestSystemId: "candidate-1",
      emptyState: "none",
      systems: [{
        id: "candidate-1",
        versionId: "candidate-1-v1",
        evaluationId: "evaluation-1",
        tradingRunId: "run-1",
        name: "Adaptive trend",
        direction: "trend_following",
        lifecycle: "running",
        rankStatus: "provisional_ranked",
        rank: 1,
        comparability: "comparable",
        unrankedReasons: [],
        qualificationReasons: [],
        netRevenueUsdt: 12,
        netReturnPct: 1.2,
        revenueUsdt: 15,
        costUsdt: 3,
        observationCount: 20,
        failedObservationCount: 0,
        source: "arena_operations",
        detailAvailability: "summary_only"
      }]
    };

    const markup = renderToStaticMarkup(
      <ArenaScreen
        view={view}
        selectedId="candidate-1"
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Adaptive trend");
    expect(markup).toContain("12.00 USDT");
    expect(markup).toContain("> Evidence</button>");
    expect(markup).toContain("Trace, logs, and sandbox detail unavailable");
  });

  it("bounds Arena rows while preserving a selected system outside the first page", () => {
    const systems: ArenaWorkspaceViewModel["systems"] = Array.from(
      { length: 65 },
      (_, index) => ({
        id: `candidate-${String(index).padStart(3, "0")}`,
        name: `Candidate ${String(index).padStart(3, "0")}`,
        lifecycle: "stopped",
        rankStatus: "unranked",
        comparability: "comparable",
        unrankedReasons: [],
        qualificationReasons: [],
        observationCount: 0,
        failedObservationCount: 0,
        source: "arena_operations",
        detailAvailability: "summary_only"
      })
    );
    const view: ArenaWorkspaceViewModel = {
      availability: "authoritative",
      loopStatus: "stopped",
      emptyState: "none",
      systems
    };

    const markup = renderToStaticMarkup(
      <ArenaScreen
        view={view}
        selectedId="candidate-064"
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain(">Candidate 058<");
    expect(markup).not.toContain(">Candidate 059<");
    expect(markup.split(">Candidate 064<")).toHaveLength(3);
  });

  it("renders completed Research ticks as history without inventing sessions", () => {
    const view: ResearchWorkspaceViewModel = {
      availability: "history_only",
      loopStatus: "projection_pending",
      sessions: [],
      history: [{
        id: "tick-1",
        status: "completed",
        startedAt: "2026-07-18T00:00:00.000Z",
        completedAt: "2026-07-18T00:05:00.000Z",
        createdCandidateCount: 1,
        createdCandidateIds: ["candidate-1"],
        directionCount: 2
      }],
      findingClusters: [],
      emptyState: "projection_unavailable"
    };

    const markup = renderToStaticMarkup(
      <ResearchScreen
        view={view}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Research session projection pending");
    expect(markup).toContain("Tick history 1");
    expect(markup).toContain("1 candidates across 2 directions");
    expect(markup).not.toContain("Filter Research sessions");
    expect(markup).not.toContain("configured-only");
  });

  it("renders read-only Research learning context without inventing a session", () => {
    const view = {
      availability: "history_only",
      loopStatus: "stopped",
      sessions: [],
      history: [],
      emptyState: "projection_unavailable",
      paperLearning: {
        rank: 2,
        net_revenue_usdt: 7,
        net_return_pct: 0.7,
        observation_count: 18,
        qualification_status: "collecting_evidence",
        qualification_reasons: ["min_observation_count_not_met"],
        top_blocker: "min_observation_count_not_met",
        summary: "Paper evidence is positive but incomplete.",
        next_research_focus: "Test slower cadence variants.",
        authority_status: "lineage_only"
      },
      generalization: {
        status: "collecting",
        protocol_count: 1,
        outcome_count: 0,
        active_protocol: null,
        latest_outcome: null,
        latest_policy_decision: null,
        effective_policy_decision: null,
        authority_status: "not_promotion_authority"
      },
      findingClusters: [{
        direction_kind: "trend_following",
        top_blocker: "min_observation_count_not_met",
        blocker_group_kind: "evidence_window",
        market_regime: "long",
        candidate_count: 2,
        candidate_ids: ["candidate-1", "candidate-2"],
        latest_finding: "Needs a longer evidence window.",
        next_research_focus: "Test slower cadence variants.",
        authority_status: "not_promotion_authority"
      }]
    } as unknown as ResearchWorkspaceViewModel;

    const markup = renderToStaticMarkup(
      <ResearchScreen
        view={view}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Paper evidence learning");
    expect(markup).toContain("Paper evidence is positive but incomplete.");
    expect(markup).toContain("Research generalization");
    expect(markup).toContain("Research learning clusters");
    expect(markup).toContain("Test slower cadence variants.");
    expect(markup).not.toContain("Filter Research sessions");
  });

  it("distinguishes loop state from projection availability", () => {
    const view: ArenaWorkspaceViewModel = {
      availability: "unavailable",
      loopStatus: "stopped",
      systems: [],
      emptyState: "projection_unavailable"
    };

    const markup = renderToStaticMarkup(
      <ArenaScreen
        view={view}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Loop stopped");
    expect(markup).toContain("Projection unavailable");
  });
});
