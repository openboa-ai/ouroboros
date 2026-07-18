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
