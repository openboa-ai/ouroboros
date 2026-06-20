import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLedgerReadModel, OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS } from "@ouroboros/domain";
import type {
  ImprovementReadModel,
  CandidateEvaluationReadModel,
  CandidateInspectReadModel,
  CandidateLatestValidationStateReadModel,
  ReplayRunComparisonReadModel,
  ReplayRunDetailReadModel,
  ReplayRunEvidenceReadModel,
  ReplayRunValidationStateReadModel,
  OperatorReadModel,
  LedgerSourceRecordsReadModel,
  CandidateArenaReadModel,
  PaperTradingBoardReadModel,
  PaperTradingEvaluationReadModel,
  PublicMarketLivenessSurfaceReadModel,
  RunControlReadModel,
  TradingGatewayEnvironmentReadModel,
  TradingSystemExecutionModeContractReadModel
} from "@ouroboros/domain";
import {
  BINANCE_NO_AUTHORITY_LABEL,
  expectNoOperatorActionControls,
  fixtureAccountPositionRiskMirrorSurface,
  fixtureOrderFillSurface,
  fixturePrivateReadGateDecision,
  fixturePrivateReadinessPolicyDecision,
  fixturePrivateReadinessPosture,
  fixturePrivateReadinessPreflightSurface,
  fixturePublicMarketLivenessSurface,
  fixtureTradingGatewayContract,
  ref
} from "../../../test/support/binance-no-authority";
import {
  App,
  applyOperatorRefreshState,
  badgeVariant,
  CandidateArenaPanel,
  CandidateDetail,
  CandidateSummaryRow,
  candidateDetailFetchKey,
  candidateNeedsDetailFetch,
  isPositiveRiskDecision,
  operatorViewFromSearch,
  PrivateReadinessReviewPacketSections,
  TradingGatewayEnvironmentSection,
  TradingExecutionModesSection
} from "./App";
import {
  privateReadinessPostureDraftFromCandidate,
  privateReadinessPosturePayload,
  replayRunPayload,
  ledgerCommandPayload,
  runControlPausePayload,
  fetchOperatorReadModel,
  buildTradingResearchRuntimeFromOperator,
  runCandidateArenaCommand,
  runPaperEvidenceForCandidate,
  promoteCandidateToTrading,
  probeAgentProvider,
  selectCandidateForOperator,
  selectResearcherProvider,
  setupAgentProvider,
  observeTradingRun,
  startTradingRun,
  stopTradingRun,
  startAgentProviderLogin,
  submitOuroborosCommand,
  type FullCycleOutcome,
  type TradingResearchRuntimeReadModel
} from "./api";
import { CardAction, CardHeader } from "./components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import {
  OPERATOR_DESIGN_TOKENS,
  OperatorActionRow,
  OperatorAppHeader,
  OperatorAppMain,
  OperatorAppShell,
  OperatorCallout,
  OperatorDataTable,
  OperatorDetailText,
  OperatorField,
  OperatorFieldGrid,
  OperatorMetricStrip,
  OperatorPage,
  OperatorPageHeader,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorSelectionItem,
  OperatorSectionStack,
  OperatorStat,
  OperatorStatGrid,
  OperatorStatusStack,
  OperatorTabPanel,
  OperatorViewTabs
} from "./design-system";
import { buildPrivateReadinessReviewPacketProjection } from "./private-readiness-review-packet";

const operatorWebSrcDir = dirname(fileURLToPath(import.meta.url));

describe("operator design system contract", () => {
  it("keeps operator UI color, size, radius, and typography tokens centralized", () => {
    expect(OPERATOR_DESIGN_TOKENS.color.canvas).toBe("bg-background text-foreground");
    expect(OPERATOR_DESIGN_TOKENS.color.surface).toBe("bg-card text-card-foreground");
    expect(OPERATOR_DESIGN_TOKENS.color.surfaceMuted).toContain("bg-card/70");
    expect(OPERATOR_DESIGN_TOKENS.color.borderSubtle).toContain("ring-border/60");
    expect(OPERATOR_DESIGN_TOKENS.size.pageMaxWidth).toBe("max-w-[1360px]");
    expect(OPERATOR_DESIGN_TOKENS.size.appHeaderHeight).toBe("h-11");
    expect(OPERATOR_DESIGN_TOKENS.size.panelPadding).toContain("p-3");
    expect(OPERATOR_DESIGN_TOKENS.radius.panel).toBe("rounded-lg");
    expect(OPERATOR_DESIGN_TOKENS.radius.control).toBe("rounded-md");
    expect(OPERATOR_DESIGN_TOKENS.surface.panel).toContain("min-w-0");
    expect(OPERATOR_DESIGN_TOKENS.surface.panel).toContain("max-w-full");
    expect(OPERATOR_DESIGN_TOKENS.surface.panel).toContain(OPERATOR_DESIGN_TOKENS.color.surface);
    expect(OPERATOR_DESIGN_TOKENS.surface.panel).toContain(OPERATOR_DESIGN_TOKENS.radius.panel);
    expect(OPERATOR_DESIGN_TOKENS.typography.label).toContain("text-[11px]");
    expect(OPERATOR_DESIGN_TOKENS.typography.detail).toContain("max-w-full");
    expect(OPERATOR_DESIGN_TOKENS.typography.calloutValue).toContain("[overflow-wrap:anywhere]");
    expect(OPERATOR_DESIGN_TOKENS.layout.page).toContain("min-w-0");
    expect(OPERATOR_DESIGN_TOKENS.layout.page).toContain(OPERATOR_DESIGN_TOKENS.size.pageMaxWidth);
    expect(OPERATOR_DESIGN_TOKENS.layout.sectionHeader).toContain("max-w-full");
    expect(OPERATOR_DESIGN_TOKENS.layout.denseFieldGrid).toContain("xl:grid-cols-4");
    expect(OPERATOR_DESIGN_TOKENS.layout.pageHeaderTitle).toContain("text-xl");
    expect(OPERATOR_DESIGN_TOKENS.layout.pageHeaderTitle).toContain("sm:text-2xl");

    const exportedClasses = JSON.stringify(OPERATOR_DESIGN_TOKENS);

    expect(exportedClasses).not.toMatch(/rounded-(xl|2xl|3xl|4xl)/);
    expect(exportedClasses).not.toMatch(/space-[xy]-/);
    expect(exportedClasses).not.toContain("sm:text-3xl");
    expect(exportedClasses).not.toContain("max-w-[1500px]");
  });

  it("keeps reusable operator primitives in a directory-based design-system entrypoint", () => {
    const designSystemDir = join(operatorWebSrcDir, "design-system");
    const componentDir = join(designSystemDir, "components");
    const componentFiles = readdirSync(componentDir)
      .filter((fileName) => fileName.endsWith(".tsx"))
      .sort();

    expect(existsSync(join(operatorWebSrcDir, "operator-ui.tsx"))).toBe(false);
    expect(existsSync(join(operatorWebSrcDir, "design-system.ts"))).toBe(false);
    expect(existsSync(join(designSystemDir, "index.ts"))).toBe(true);
    expect(existsSync(join(designSystemDir, "tokens.ts"))).toBe(true);
    expect(componentFiles).toEqual(expect.arrayContaining([
      "action-row.tsx",
      "app-shell.tsx",
      "callout.tsx",
      "empty-state.tsx",
      "evidence.tsx",
      "data-table.tsx",
      "field.tsx",
      "field-grid.tsx",
      "metric-strip.tsx",
      "page.tsx",
      "panel.tsx",
      "section-header.tsx",
      "selection-item.tsx",
      "section-stack.tsx",
      "stat.tsx",
      "stat-grid.tsx",
      "status-stack.tsx",
      "text.tsx",
      "tab-badge.tsx",
      "view-tabs.tsx"
    ]));

    const indexSource = readFileSync(join(designSystemDir, "index.ts"), "utf8");
    expect(indexSource).toContain('export { OPERATOR_DESIGN_TOKENS } from "./tokens"');
    expect(indexSource).toContain('export { OperatorMetricStrip } from "./components/metric-strip"');

    for (const fileName of componentFiles) {
      const source = readFileSync(join(componentDir, fileName), "utf8");

      expect(source).not.toMatch(/@ouroboros\/domain|\.\/api|\.\/App/);
      expect(source).toContain("../tokens");
    }

    expect(readFileSync(join(componentDir, "callout.tsx"), "utf8")).toContain("@/components/ui/alert");
    expect(readFileSync(join(componentDir, "empty-state.tsx"), "utf8")).toContain("@/components/ui/empty");
    for (const fileName of ["evidence.tsx", "stat.tsx"]) {
      expect(readFileSync(join(componentDir, fileName), "utf8")).toContain("@/components/ui/card");
    }
    for (const fileName of ["field.tsx"]) {
      expect(readFileSync(join(componentDir, fileName), "utf8")).not.toContain("@/components/ui/card");
    }
    expect(readFileSync(join(componentDir, "panel.tsx"), "utf8")).toContain("@/components/ui/card");
    expect(readFileSync(join(componentDir, "tab-badge.tsx"), "utf8")).toContain("@/components/ui/badge");
    expect(readFileSync(join(componentDir, "metric-strip.tsx"), "utf8")).toContain("./stat");
    expect(readFileSync(join(componentDir, "stat-grid.tsx"), "utf8")).toContain("./stat");
    expect(readFileSync(join(componentDir, "data-table.tsx"), "utf8")).toContain("@/components/ui/button");
    expect(readFileSync(join(componentDir, "data-table.tsx"), "utf8")).toContain("@/components/ui/table");
    expect(indexSource).toContain('export { OperatorDataTable } from "./components/data-table"');
    expect(indexSource).toContain('export { OperatorFieldGrid } from "./components/field-grid"');
    expect(indexSource).toContain('export { OperatorSectionStack } from "./components/section-stack"');
    expect(indexSource).toContain('export { OperatorStatGrid } from "./components/stat-grid"');
    expect(indexSource).toContain('export { OperatorDetailText } from "./components/text"');
    expect(indexSource).toContain('export { OperatorAppShell, OperatorAppHeader, OperatorAppMain } from "./components/app-shell"');
    expect(indexSource).toContain('export { OperatorSelectionItem } from "./components/selection-item"');
    expect(indexSource).toContain('export { OperatorStatusStack } from "./components/status-stack"');
    expect(indexSource).toContain('export { OperatorViewTabs, OperatorTabPanel } from "./components/view-tabs"');
  });

  it("keeps Trading screen sections as reusable UI-only modules", () => {
    const tradingSectionDir = join(operatorWebSrcDir, "sections", "trading");
    const sectionFiles = readdirSync(tradingSectionDir)
      .filter((fileName) => fileName.endsWith(".tsx"))
      .sort();

    expect(sectionFiles).toEqual(expect.arrayContaining([
      "operator-decision-panel.tsx",
      "paper-review-summary-section.tsx",
      "trading-cockpit-section.tsx",
      "trading-market-chart.tsx",
      "trading-order-status-section.tsx",
      "trading-market-section.tsx",
      "trading-metrics.tsx",
      "trading-paper-readback-section.tsx",
      "trading-promotion-boundary-section.tsx",
      "trading-safety-boundary-section.tsx",
      "trading-review-packet-section.tsx"
    ]));

    for (const fileName of sectionFiles) {
      const source = readFileSync(join(tradingSectionDir, fileName), "utf8");

      expect(source).not.toMatch(/@ouroboros\/domain|\.\/api|\.\/App/);
      expect(source).not.toContain("OPERATOR_DESIGN_TOKENS");
      expect(source).toMatch(/@\/design-system|@\/components\/ui\/badge|\.\/trading-metrics/);
    }

    expect(readFileSync(join(tradingSectionDir, "trading-market-section.tsx"), "utf8")).toContain("OperatorPanel");
    expect(readFileSync(join(tradingSectionDir, "trading-cockpit-section.tsx"), "utf8")).toContain("OperatorSectionHeader");
    expect(readFileSync(join(tradingSectionDir, "trading-cockpit-section.tsx"), "utf8")).toContain("@/components/ui/badge");
    expect(readFileSync(join(tradingSectionDir, "trading-safety-boundary-section.tsx"), "utf8")).toContain("OperatorPanel");
    expect(readFileSync(join(tradingSectionDir, "trading-safety-boundary-section.tsx"), "utf8")).toContain("@/components/ui/badge");
    expect(readFileSync(join(tradingSectionDir, "trading-market-chart.tsx"), "utf8")).toContain("@/components/ui/chart");
    expect(readFileSync(join(tradingSectionDir, "trading-market-chart.tsx"), "utf8")).toContain("OperatorEvidenceRow");
    expect(readFileSync(join(tradingSectionDir, "trading-market-chart.tsx"), "utf8")).toContain("OperatorField");
    expect(readFileSync(join(tradingSectionDir, "trading-metrics.tsx"), "utf8")).toContain("OperatorMetricStrip");
    expect(readFileSync(join(tradingSectionDir, "trading-metrics.tsx"), "utf8")).not.toContain("OPERATOR_DESIGN_TOKENS.layout.statGrid");
    expect(readFileSync(join(tradingSectionDir, "trading-paper-readback-section.tsx"), "utf8")).toContain("OperatorField");
    expect(readFileSync(join(tradingSectionDir, "trading-promotion-boundary-section.tsx"), "utf8")).toContain("@/components/ui/button");
    expect(readFileSync(join(tradingSectionDir, "trading-promotion-boundary-section.tsx"), "utf8")).toContain("@/components/ui/badge");
    expect(readFileSync(join(tradingSectionDir, "trading-promotion-boundary-section.tsx"), "utf8")).toContain("OperatorField");
    expect(readFileSync(join(tradingSectionDir, "trading-promotion-boundary-section.tsx"), "utf8")).toContain("OperatorActionRow");
    expect(readFileSync(join(tradingSectionDir, "trading-order-status-section.tsx"), "utf8")).toContain("@/components/ui/badge");
    expect(readFileSync(join(tradingSectionDir, "trading-order-status-section.tsx"), "utf8")).toContain("@/components/ui/progress");
    expect(readFileSync(join(tradingSectionDir, "trading-order-status-section.tsx"), "utf8")).toContain("OperatorPanel");
    expect(readFileSync(join(tradingSectionDir, "trading-order-status-section.tsx"), "utf8")).toContain("OperatorStat");
    expect(readFileSync(join(tradingSectionDir, "paper-review-summary-section.tsx"), "utf8")).toContain("TradingMetricGrid");
    expect(readFileSync(join(operatorWebSrcDir, "components", "ui", "chart.tsx"), "utf8")).toContain("recharts");
    expect(readFileSync(join(operatorWebSrcDir, "App.tsx"), "utf8")).not.toContain("function BtcFuturesChart");
    expect(readFileSync(join(operatorWebSrcDir, "App.tsx"), "utf8")).not.toContain('<OperatorPanel aria-label="Safety boundary">');
    expect(readFileSync(join(operatorWebSrcDir, "App.tsx"), "utf8")).not.toContain('<section className="grid gap-4" aria-label="Trading cockpit">');
  });

  it("keeps Trading market chart evidence limited to sourced market prices", () => {
    const appSource = readFileSync(join(operatorWebSrcDir, "App.tsx"), "utf8");

    expect(appSource).not.toContain("estimated_settle_price ?? market.index_price");
    expect(appSource).not.toContain("* 1.00025");
    expect(appSource).not.toContain("* 0.99985");
  });

  it("keeps Candidate Arena screen sections as reusable UI-only modules", () => {
    const arenaSectionDir = join(operatorWebSrcDir, "sections", "arena");
    const sectionFiles = readdirSync(arenaSectionDir)
      .filter((fileName) => fileName.endsWith(".tsx"))
      .sort();

    expect(sectionFiles).toEqual(expect.arrayContaining([
      "arena-agent-provider-section.tsx",
      "arena-command-log-section.tsx",
      "arena-command-bar-section.tsx",
      "arena-leaderboard-section.tsx",
      "arena-latest-ticks-section.tsx",
      "arena-metric-strip-section.tsx",
      "arena-paper-board-section.tsx",
      "arena-selected-candidate-section.tsx"
    ]));

    for (const fileName of sectionFiles) {
      const source = readFileSync(join(arenaSectionDir, fileName), "utf8");

      expect(source).not.toMatch(/@ouroboros\/domain|\.\/api|\.\/App/);
      expect(source).not.toContain("OPERATOR_DESIGN_TOKENS");
      expect(source).toContain("@/design-system");
    }

    expect(readFileSync(join(arenaSectionDir, "arena-command-bar-section.tsx"), "utf8")).toContain("@/components/ui/button");
    expect(readFileSync(join(arenaSectionDir, "arena-command-bar-section.tsx"), "utf8")).toContain("OperatorCallout");
    expect(readFileSync(join(arenaSectionDir, "arena-command-bar-section.tsx"), "utf8")).toContain("OperatorSectionHeader");
    expect(readFileSync(join(arenaSectionDir, "arena-leaderboard-section.tsx"), "utf8")).toContain("@/components/ui/button");
    expect(readFileSync(join(arenaSectionDir, "arena-leaderboard-section.tsx"), "utf8")).toContain("@/components/ui/badge");
    expect(readFileSync(join(arenaSectionDir, "arena-leaderboard-section.tsx"), "utf8")).toContain("OperatorDataTable");
    expect(readFileSync(join(arenaSectionDir, "arena-leaderboard-section.tsx"), "utf8")).not.toContain("grid-cols-[44px");
    expect(readFileSync(join(arenaSectionDir, "arena-leaderboard-section.tsx"), "utf8")).not.toContain("border-b pb-2");
    expect(readFileSync(join(arenaSectionDir, "arena-metric-strip-section.tsx"), "utf8")).toContain("OperatorMetricStrip");
    expect(readFileSync(join(arenaSectionDir, "arena-metric-strip-section.tsx"), "utf8")).not.toContain("OPERATOR_DESIGN_TOKENS.layout.statGrid");
    expect(readFileSync(join(arenaSectionDir, "arena-paper-board-section.tsx"), "utf8")).toContain("OperatorEvidenceStatus");
    expect(readFileSync(join(arenaSectionDir, "arena-paper-board-section.tsx"), "utf8")).toContain("OperatorField");
    expect(readFileSync(join(arenaSectionDir, "arena-agent-provider-section.tsx"), "utf8")).toContain("@/components/ui/button");
    expect(readFileSync(join(arenaSectionDir, "arena-agent-provider-section.tsx"), "utf8")).toContain("OperatorActionRow");
    expect(readFileSync(join(arenaSectionDir, "arena-command-log-section.tsx"), "utf8")).toContain("OperatorEvidenceBlock");
    expect(readFileSync(join(arenaSectionDir, "arena-latest-ticks-section.tsx"), "utf8")).toContain("OperatorEmptyState");
    expect(readFileSync(join(arenaSectionDir, "arena-selected-candidate-section.tsx"), "utf8")).toContain("@/components/ui/button");
    expect(readFileSync(join(arenaSectionDir, "arena-selected-candidate-section.tsx"), "utf8")).toContain("OperatorActionRow");
    expect(readFileSync(join(arenaSectionDir, "arena-selected-candidate-section.tsx"), "utf8")).toContain("OperatorField");
  });

  it("keeps Research screen sections as reusable UI-only modules", () => {
    const researchSectionDir = join(operatorWebSrcDir, "sections", "research");
    const sectionFiles = readdirSync(researchSectionDir)
      .filter((fileName) => fileName.endsWith(".tsx"))
      .sort();

    expect(sectionFiles).toEqual(expect.arrayContaining([
      "research-agent-cycle-section.tsx",
      "research-cycle-section.tsx",
      "research-finding-clusters-section.tsx",
      "research-paper-learning-section.tsx",
      "research-signals-section.tsx"
    ]));

    for (const fileName of sectionFiles) {
      const source = readFileSync(join(researchSectionDir, fileName), "utf8");

      expect(source).not.toMatch(/@ouroboros\/domain|\.\/api|\.\/App/);
      expect(source).not.toContain("OPERATOR_DESIGN_TOKENS");
      expect(source).toContain("@/design-system");
    }

    expect(readFileSync(join(researchSectionDir, "research-paper-learning-section.tsx"), "utf8")).toContain("@/components/ui/badge");
    expect(readFileSync(join(researchSectionDir, "research-finding-clusters-section.tsx"), "utf8")).toContain("OperatorEvidenceBlock");
    expect(readFileSync(join(researchSectionDir, "research-finding-clusters-section.tsx"), "utf8")).toContain("grid-cols-[minmax(0,1fr)]");
    expect(readFileSync(join(researchSectionDir, "research-finding-clusters-section.tsx"), "utf8")).toContain("max-w-[calc(100vw-4.5rem)]");
    expect(readFileSync(join(researchSectionDir, "research-signals-section.tsx"), "utf8")).toContain("OperatorStat");
    expect(readFileSync(join(researchSectionDir, "research-cycle-section.tsx"), "utf8")).toContain("OperatorEvidenceStatus");
    expect(readFileSync(join(researchSectionDir, "research-agent-cycle-section.tsx"), "utf8")).toContain("OperatorField");
    expect(readFileSync(join(operatorWebSrcDir, "App.tsx"), "utf8")).not.toContain('<OperatorPanel aria-label="Paper evidence learning">');
    expect(readFileSync(join(operatorWebSrcDir, "App.tsx"), "utf8")).not.toContain('<OperatorPanel aria-label="Research signals">');
    expect(readFileSync(join(operatorWebSrcDir, "App.tsx"), "utf8")).not.toContain('function FullCycleLineageSection');
  });

  it("keeps operator shell navigation as a reusable UI-only module", () => {
    const shellDir = join(operatorWebSrcDir, "shell");
    const operatorSidebarSource = readFileSync(join(shellDir, "operator-sidebar.tsx"), "utf8");

    expect(operatorSidebarSource).not.toMatch(/@ouroboros\/domain|\.\/api|\.\/App/);
    expect(operatorSidebarSource).toContain("@/components/ui/sidebar");
    expect(operatorSidebarSource).toContain("SidebarMenuSkeleton");
    expect(operatorSidebarSource).toContain("export interface OperatorSidebarCandidate");
  });

  it("renders evidence fields and stats from shared primitives without clipping long values", () => {
    const longEvidenceValue = "binance_production_public_rest / public_execution_bookTicker / none_open_0";
    const html = renderToStaticMarkup(
      <div>
        <OperatorField label="Market provenance" value={longEvidenceValue} />
        <OperatorStat label="Paper net" value="2.839997 USDT" detail="revenue - cost" />
      </div>
    );

    expect(html).toContain("data-operator-ui=\"field\"");
    expect(html).toContain("data-operator-ui=\"stat\"");
    expect(html).toContain('data-slot="card"');
    expect(html).toContain('data-size="sm"');
    expect(html).toContain('data-slot="card-content"');
    expect(html).toContain("[overflow-wrap:anywhere]");
    expect(html).toContain("min-w-0");
    expect(html).toContain("break-words");
    expect(html).not.toContain("truncate");
  });

  it("keeps section layout, field grids, stat grids, and detail text behind design-system primitives", () => {
    const html = renderToStaticMarkup(
      <OperatorSectionStack>
        <OperatorDetailText>Evidence remains read-only and paper-only.</OperatorDetailText>
        <OperatorFieldGrid density="dense" aria-label="Boundary fields">
          <OperatorField label="Authority" value="not_live" />
          <OperatorField label="Source" value="PaperTradingEvaluation" />
        </OperatorFieldGrid>
        <OperatorStatGrid
          aria-label="Review stats"
          stats={[
            { label: "Paper net", value: "2.839997 USDT" },
            { label: "Qualification", value: "collecting_evidence" }
          ]}
        />
      </OperatorSectionStack>
    );

    expect(html).toContain('data-operator-ui="section-stack"');
    expect(html).toContain('data-operator-ui="detail-text"');
    expect(html).toContain('data-operator-ui="field-grid"');
    expect(html).toContain('data-density="dense"');
    expect(html).toContain('data-operator-ui="stat-grid"');
    expect(html).toContain('data-slot="card"');
    expect(html).toContain("grid");
    expect(html).toContain("[overflow-wrap:anywhere]");
  });

  it("keeps high-level metric strips compact and mobile-first", () => {
    const html = renderToStaticMarkup(
      <OperatorMetricStrip
        metrics={[
          { label: "Arena runner", value: "running", detail: "3 ticks" },
          { label: "ResearchPreflight net", value: "9.83 USDT", detail: "revenue - cost" },
          { label: "ResearchPreflight return", value: "0.0983%", detail: "secondary rank signal" }
        ]}
      />
    );

    expect(OPERATOR_DESIGN_TOKENS.layout.statGrid).toContain("repeat(auto-fit");
    expect(OPERATOR_DESIGN_TOKENS.layout.statGrid).not.toContain("md:grid-cols-3");
    expect(OPERATOR_DESIGN_TOKENS.surface.stat).not.toMatch(/bg-card\/|ring-border\/|rounded-md/);
    expect(OPERATOR_DESIGN_TOKENS.typography.statValue).toContain("text-lg");
    expect(OPERATOR_DESIGN_TOKENS.typography.statValue).not.toContain("text-[1.35rem]");
    expect(html).toContain('data-operator-ui="metric-strip"');
    expect(html).toContain('data-operator-ui="stat"');
    expect(html).toContain('data-slot="card"');
    expect(html).toContain("repeat(auto-fit");
    expect(html).not.toContain("md:grid-cols-3");
    expect(html).not.toContain("text-[1.35rem]");
  });

  it("builds operator data tables from the shadcn Table primitive", () => {
    const html = renderToStaticMarkup(
      <OperatorDataTable
        aria-label="ResearchPreflight leaderboard"
        columns={[
          { key: "rank", label: "Rank", className: "w-11" },
          { key: "candidate", label: "Candidate" },
          { key: "score", label: "ResearchPreflight net", className: "w-[11rem]" }
        ]}
        rows={[
          {
            id: "candidate-1",
            selected: true,
            label: "Select trend following candidate",
            onSelect: () => undefined,
            cells: {
              rank: "#1",
              candidate: <strong>Trend following BTCUSDT Trading System</strong>,
              score: "2.839997 USDT"
            }
          }
        ]}
      />
    );

    expect(html).toContain('data-operator-ui="data-table"');
    expect(html).toContain('data-slot="table-container"');
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('data-slot="table-header"');
    expect(html).toContain('data-slot="table-row"');
    expect(html).toContain('data-slot="table-cell"');
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-state="selected"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("w-11");
    expect(html).toContain("w-[11rem]");
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("grid-cols-[44px");

    const dataTableSource = readFileSync(join(operatorWebSrcDir, "design-system/components/data-table.tsx"), "utf8");
    expect(dataTableSource).toContain("onClick={interactive ? () => row.onSelect?.() : undefined}");
    expect(dataTableSource).toContain("tabIndex={interactive ? 0 : undefined}");
    expect(dataTableSource).toContain("onKeyDown={interactive ? (event) => handleRowKeyDown(event, row.onSelect) : undefined}");
    expect(dataTableSource).toContain("event.stopPropagation()");
  });

  it("builds operator panels from the shadcn Card primitive while keeping semantic sections", () => {
    const panelHtml = renderToStaticMarkup(
      <OperatorPanel aria-label="Trading review packet">
        <OperatorSectionHeader title="Trading review packet" />
      </OperatorPanel>
    );

    expect(panelHtml).toContain('data-operator-ui="panel"');
    const panelTag = extractOpeningTagForAriaLabel(panelHtml, "Trading review packet");
    const panelSource = readFileSync(
      join(operatorWebSrcDir, "design-system", "components", "panel.tsx"),
      "utf8"
    );

    expect(panelTag).toContain("<section");
    expect(panelTag).toContain('data-slot="card"');
    expect(panelSource).toContain("@/components/ui/card");
    expect(panelSource).toContain("asChild");
    expect(OPERATOR_DESIGN_TOKENS.surface.evidenceBlock).toContain("bg-card");
    expect(OPERATOR_DESIGN_TOKENS.surface.evidenceBlock).toContain("ring-1");
    expect(OPERATOR_DESIGN_TOKENS.surface.field).toContain("bg-transparent");
    expect(OPERATOR_DESIGN_TOKENS.surface.field).toContain("border-t");
    expect(OPERATOR_DESIGN_TOKENS.surface.field).not.toMatch(/ring-1|rounded-(md|lg)|bg-background/);
    expect(OPERATOR_DESIGN_TOKENS.surface.emptyState).not.toContain("ring-1");
  });

  it("renders operator callouts without oversized metric typography", () => {
    const html = renderToStaticMarkup(
      <OperatorCallout
        label="Recommended action"
        value="Promote a selected Paper Trading Evaluation candidate from Arena to Trading review."
      />
    );

    expect(html).toContain("data-operator-ui=\"callout\"");
    expect(html).toContain('data-slot="alert"');
    expect(html).toContain('role="note"');
    expect(html).toContain('data-slot="alert-title"');
    expect(html).toContain('data-slot="alert-description"');
    expect(html).toContain("uppercase");
    expect(html).toContain("text-sm");
    expect(OPERATOR_DESIGN_TOKENS.surface.callout).toContain("py-2");
    expect(OPERATOR_DESIGN_TOKENS.surface.callout).not.toContain("bg-background/20");
    expect(html).not.toContain("text-[1.35rem]");
  });

  it("renders page and section chrome through operator UI primitives", () => {
    const html = renderToStaticMarkup(
      <OperatorPage>
        <OperatorPageHeader
          eyebrow="Paper workspace"
          title="BTCUSDT operator cockpit"
          actions={<OperatorActionRow><span>Trading</span><span>Arena</span></OperatorActionRow>}
        />
        <OperatorSectionHeader
          eyebrow="Review packet"
          title="Trading review packet"
          description="Structured evidence for the active Trading review target."
          actions={<span>collecting</span>}
        />
      </OperatorPage>
    );

    expect(html).toContain("data-operator-ui=\"page\"");
    expect(html).toContain("data-operator-ui=\"page-header\"");
    expect(html).toContain("data-operator-ui=\"section-header\"");
    expect(html).toContain("data-operator-ui=\"action-row\"");
    expect(html).toContain(OPERATOR_DESIGN_TOKENS.size.pageMaxWidth);
    expect(html).toContain("sm:flex-row");
    expect(html).toContain("tracking-normal");
    expect(html).not.toContain("tracking-tight");
    expect(html).not.toContain("max-w-[1500px]");
    expect(html).not.toContain("sm:text-3xl");
  });

  it("keeps page, panel, and section chrome assembled from semantic design tokens", () => {
    const designSystemDir = join(operatorWebSrcDir, "design-system");
    const pageSource = readFileSync(join(designSystemDir, "components/page.tsx"), "utf8");
    const panelSource = readFileSync(join(designSystemDir, "components/panel.tsx"), "utf8");
    const sectionHeaderSource = readFileSync(join(designSystemDir, "components/section-header.tsx"), "utf8");

    expect(pageSource).not.toContain("max-w-[1500px]");
    expect(panelSource).not.toContain("grid min-w-0 content-start grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4");
    expect(sectionHeaderSource).not.toContain("text-sm text-muted-foreground");
    expect(sectionHeaderSource).not.toContain("sm:justify-end");
    expect(pageSource).toContain("OPERATOR_DESIGN_TOKENS.layout.pageEyebrow");
    expect(panelSource).toContain("OPERATOR_DESIGN_TOKENS.layout.panel");
    expect(sectionHeaderSource).toContain("OPERATOR_DESIGN_TOKENS.typography.eyebrow");
    expect(sectionHeaderSource).toContain("OPERATOR_DESIGN_TOKENS.layout.sectionHeaderActions");
  });

  it("keeps operator panels constrained to one shrinkable grid column", () => {
    const html = renderToStaticMarkup(
      <OperatorPanel aria-label="ResearchPreflight Evidence">
        <OperatorSectionHeader
          title="ResearchPreflight Evidence"
          description="pending"
          actions={<span>not_counted</span>}
        />
      </OperatorPanel>
    );

    expect(html).toContain("data-operator-ui=\"panel\"");
    expect(extractOpeningTagForAriaLabel(html, "ResearchPreflight Evidence")).toContain('data-slot="card"');
    expect(html).toContain("grid-cols-[minmax(0,1fr)]");
    expect(html).toContain("content-start");
  });

  it("keeps the app shell and page title mobile-first through shared tokens", () => {
    const tokens = OPERATOR_DESIGN_TOKENS as {
      layout: Record<string, string>;
      surface: Record<string, string>;
    };
    const exportedClasses = JSON.stringify(OPERATOR_DESIGN_TOKENS);
    const html = renderToStaticMarkup(<App />);

    expect(tokens.layout.appHeader).toBeTypeOf("string");
    expect(tokens.layout.appHeader).toContain(OPERATOR_DESIGN_TOKENS.size.appHeaderHeight);
    expect(tokens.layout.appHeader).toContain("border-b");
    expect(tokens.layout.appMain).toBeTypeOf("string");
    expect(tokens.layout.appMain).toContain("p-3");
    expect(OPERATOR_DESIGN_TOKENS.layout.pageHeaderTitle).toContain("text-xl");
    expect(OPERATOR_DESIGN_TOKENS.layout.pageHeaderTitle).toContain("sm:text-2xl");
    expect(exportedClasses).not.toMatch(/text-\[clamp|vw/);
    expect(exportedClasses).not.toContain("sm:text-3xl");
    expect(html).toContain('data-operator-ui="app-header"');
    expect(html).toContain('data-operator-ui="app-main"');
    expect(html).not.toContain("h-14 shrink-0 items-center gap-3 border-b px-4");
    expect(html).not.toContain("min-h-[calc(100svh-3.5rem)] bg-background p-4");
  });

  it("keeps app shell, tabs, status, and selection chrome behind design-system primitives", () => {
    const appSource = readFileSync(join(operatorWebSrcDir, "App.tsx"), "utf8");
    const html = renderToStaticMarkup(
      <OperatorAppShell sidebar={<aside data-testid="sidebar" />}>
        <OperatorAppHeader title="Ouroboros Operator" subtitle="Trading" />
        <OperatorAppMain>
          <Tabs value="trading">
            <OperatorViewTabs
              items={[
                { value: "trading", label: "Trading", badge: "active", badgeAriaLabel: "Trading tab state badge" },
                { value: "arena", label: "Arena" }
              ]}
            />
            <OperatorTabPanel value="trading">
              <OperatorStatusStack
                aria-label="Operator messages"
                messages={[
                  { id: "message", tone: "info", value: "Paper observation recorded." },
                  { id: "error", tone: "error", value: "Runner inactive." }
                ]}
              />
              <OperatorSelectionItem
                active
                title="replay-run-1"
                detail="accepted / fixture / replay_only"
                meta="3/4 accepted"
              />
            </OperatorTabPanel>
          </Tabs>
        </OperatorAppMain>
      </OperatorAppShell>
    );

    expect(appSource).not.toContain("OPERATOR_DESIGN_TOKENS");
    expect(html).toContain('data-operator-ui="app-shell"');
    expect(html).toContain('data-operator-ui="app-header"');
    expect(html).toContain('data-operator-ui="app-main"');
    expect(html).toContain('data-operator-ui="view-tabs"');
    expect(html).toContain('data-operator-ui="tab-panel"');
    expect(html).toContain('data-operator-ui="status-stack"');
    expect(html).toContain('data-operator-ui="status-message"');
    expect(html).toContain('data-tone="error"');
    expect(html).toContain('data-operator-ui="selection-item"');
    expect(html).toContain('data-active="true"');
    expect(html).toContain('data-slot="tabs-list"');
    expect(html).toContain('data-slot="tabs-trigger"');
    expect(html).toContain('data-slot="separator"');
    expect(html).toContain('data-slot="button"');
    expect(html).not.toContain("inline-status");
  });

  it("renders the app loading fallback through operator primitives", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Loading fixture read model...");
    expect(html).toContain('data-operator-ui="operator-sidebar"');
    expect(html).toContain('data-slot="sidebar-menu-skeleton"');
    expect(html).toContain('aria-label="Loading read model"');
    expect(html).toContain('data-operator-ui="panel"');
    expect(html).toContain('data-operator-ui="section-header"');
    expect(extractOpeningTagForAriaLabel(html, "Loading read model")).toContain('data-slot="card"');
    expect(html).not.toContain("Loading trading systems");
    expect(html).not.toContain("No Trading System selected");
  });
});

describe("operator refresh contract", () => {
  it("refreshes replay evidence when the interval observes a different selected candidate", () => {
    const source = readFileSync(join(operatorWebSrcDir, "App.tsx"), "utf8");

    expect(source).toContain("const selectedCandidateIdRef = useRef<string | undefined>(undefined)");
    expect(source).toContain("const selectedChanged = Boolean(");
    expect(source).toContain("fetchReplayRunEvidence(selected.candidate_id)");
    expect(source).toContain("fetchReplayRunSelection(selected.candidate_id, replayRuns)");
  });
});

describe("operator UI primitives", () => {
  it("keeps card actions from squeezing copy on mobile", () => {
    const html = renderToStaticMarkup(
      <CardHeader>
        <div>
          <p>Paper Trading review cockpit. Live exchange authority remains disabled.</p>
        </div>
        <CardAction>
          <span>paper only</span>
        </CardAction>
      </CardHeader>
    );

    expect(html).toContain("sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]");
    expect(html).toContain("sm:col-start-2");
    expect(html).toContain("sm:justify-self-end");
    expect(html).not.toContain("has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]");
  });

  it("keeps segmented tabs tall enough for mobile labels", () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue="trading">
        <TabsList>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(html).toContain("min-h-9");
    expect(html).toContain("min-h-8");
    expect(html).toContain("py-1");
    expect(html).not.toContain("bottom-[-5px]");
    expect(html).not.toContain("-right-1");
  });
});

describe("operator app refresh", () => {
  it("keeps full selected candidate details while merging fresh bounded overview fields", () => {
    const fullCandidate = selectedCandidateWithTranscript(2);
    fullCandidate.runtime.runtime_lifecycle_status = "running";
    const boundedCandidate = {
      ...fullCandidate,
      runtime: {
        ...fullCandidate.runtime,
        runtime_lifecycle_status: "paused" as const,
        transcript: fullCandidate.runtime.transcript
          ? {
              ...fullCandidate.runtime.transcript,
              items: fullCandidate.runtime.transcript.items.slice(-1)
            }
          : undefined
      }
    };
    const operator = operatorReadModelFixture({
      selected_candidate_id: fullCandidate.candidate_id,
      selected_candidate: boundedCandidate
    });
    const currentState = {
      candidates: [],
      executionModes: tradingExecutionModes(),
      replayRuns: [],
      selectedTradingResearchAgent: "codex" as const,
      tradingResearchIterations: 1,
      loading: false,
      runningFullCycle: false,
      runningTradingRun: false,
      recordingImprovement: false,
      recordingRunControl: false,
      recordingPrivateReadinessPosture: false,
      runningCandidateReplay: false,
      runningTradingPromotion: false,
      runningCandidateArenaAction: false,
      operator,
      candidateArena: operator.candidate_arena,
      selected: fullCandidate,
      tradingResearchRuntime: buildTradingResearchRuntimeFromOperator(operator)
    };

    expect(candidateNeedsDetailFetch(boundedCandidate)).toBe(true);
    expect(candidateNeedsDetailFetch(fullCandidate)).toBe(false);
    expect(candidateDetailFetchKey(boundedCandidate)).not.toBe(candidateDetailFetchKey(fullCandidate));

    const refreshed = applyOperatorRefreshState(currentState, operator);

    expect(refreshed.selected?.runtime.transcript?.items).toHaveLength(2);
    expect(refreshed.selected?.runtime.runtime_lifecycle_status).toBe("paused");
  });

  it("treats truncated overview text as needing full candidate details", () => {
    const boundedCandidate = selectedCandidateWithTranscript(1);
    boundedCandidate.runtime.transcript!.items[0] = {
      ...boundedCandidate.runtime.transcript!.items[0]!,
      summary: `${"x".repeat(500)}...`
    };

    expect(candidateNeedsDetailFetch(boundedCandidate)).toBe(true);
  });

  it("merges refreshed paper board state without resetting pending controls", () => {
    const staleOperator = operatorReadModelFixture({
      selected_paper_trading_evaluation: paperTradingEvaluationFixture({
        runner_active: false,
        observation_count: 11,
        latest_failure_reason: "runner_inactive_for_running_evaluation"
      }),
      paper_trading_board: paperTradingBoardFixture({
        runner_status: "needs_resume",
        promotion_gate_status: "needs_resume",
        qualification_status: "blocked_by_quality",
        qualification_reasons: [
          "runner_inactive_for_running_evaluation",
          "failed_observation_ratio_exceeded"
        ],
        observation_count: 11
      })
    });
    const freshOperator = operatorReadModelFixture({
      selected_paper_trading_evaluation: paperTradingEvaluationFixture({
        runner_active: true,
        observation_count: 12,
        latest_failure_reason: undefined
      }),
      paper_trading_board: paperTradingBoardFixture({
        runner_status: "active",
        promotion_gate_status: "collecting_paper_evidence",
        qualification_status: "blocked_by_quality",
        qualification_reasons: ["failed_observation_ratio_exceeded"],
        observation_count: 12
      })
    });
    const currentState = {
      candidates: [],
      executionModes: tradingExecutionModes(),
      replayRuns: [],
      selectedTradingResearchAgent: "codex" as const,
      tradingResearchIterations: 1,
      loading: false,
      runningFullCycle: false,
      runningTradingRun: true,
      recordingImprovement: false,
      recordingRunControl: false,
      recordingPrivateReadinessPosture: false,
      runningCandidateReplay: false,
      runningTradingPromotion: false,
      runningCandidateArenaAction: false,
      operator: staleOperator,
      candidateArena: staleOperator.candidate_arena,
      selected: staleOperator.selected_candidate ?? undefined,
      tradingResearchRuntime: buildTradingResearchRuntimeFromOperator(staleOperator)
    };

    const refreshed = applyOperatorRefreshState(currentState, freshOperator);

    expect(refreshed.operator?.paper_trading_board.entries[0]?.runner_status).toBe("active");
    expect(refreshed.operator?.paper_trading_board.entries[0]?.observation_count).toBe(12);
    expect(refreshed.operator?.selected_paper_trading_evaluation?.runner_active).toBe(true);
    expect(refreshed.operator?.selected_paper_trading_evaluation?.latest_failure_reason).toBeUndefined();
    expect(refreshed.runningTradingRun).toBe(true);
  });
});

describe("operator status helpers", () => {
  it("matches positive replay risk decisions without accepting invalid values by substring", () => {
    expect(isPositiveRiskDecision("valid_order_request")).toBe(true);
    expect(isPositiveRiskDecision("passes_replay_checks")).toBe(true);
    expect(isPositiveRiskDecision("invalid_order_request")).toBe(false);
    expect(isPositiveRiskDecision("no_order_request")).toBe(false);
    expect(isPositiveRiskDecision("not_ready")).toBe(false);
  });

  it("does not style incomplete status badges as successful", () => {
    expect(badgeVariant("complete")).toBe("default");
    expect(badgeVariant("chain complete")).toBe("default");
    expect(badgeVariant("incomplete")).toBe("outline");
    expect(badgeVariant("chain incomplete")).toBe("outline");
    expect(badgeVariant("invalid_order_request")).toBe("destructive");
  });
});

describe("operator view deeplinks", () => {
  it("opens stable screenshot and QA entrypoints from the view query parameter", () => {
    expect(operatorViewFromSearch("?view=trading")).toBe("trading");
    expect(operatorViewFromSearch("?view=arena")).toBe("arena");
    expect(operatorViewFromSearch("?view=research")).toBe("research");
    expect(operatorViewFromSearch("?view=details")).toBe("details");
    expect(operatorViewFromSearch("?view=unknown")).toBe("trading");
    expect(operatorViewFromSearch("?candidate_id=candidate-1")).toBe("trading");
    expect(operatorViewFromSearch(undefined)).toBe("trading");
  });
});

describe("operator command API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches arena actions through the shared command endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      command: {
        command_kind: "arena.tick",
        status: "succeeded"
      },
      operator: {
        candidate_arena: fixtureCandidateArena
      }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const arena = await runCandidateArenaCommand("tick");

    expect(arena).toBe(fixtureCandidateArena);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4173/api/commands",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command_kind: "arena.tick" })
      }
    );
  });

  it("dispatches selected candidate paper evidence through the shared command endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      command: {
        command_kind: "candidate.paper_evidence.run",
        status: "succeeded"
      },
      operator: {
        selected_candidate_id: "candidate-profitable",
        selected_candidate: arenaSelectedCandidate(),
        selected_paper_evidence: {
          status: "ledger_chain_complete",
          ledger_chain_complete: true,
          ledger_chain_count: 1,
          authority_status: "not_live"
        },
        selected_paper_trading_evaluation: paperTradingEvaluationFixture()
      }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runPaperEvidenceForCandidate("candidate-profitable");

    expect(outcome.selected_paper_evidence.status).toBe("ledger_chain_complete");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4173/api/commands",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          command_kind: "candidate.paper_evidence.run",
          payload: { candidate_id: "candidate-profitable" }
        })
      }
    );
  });

  it("exposes provider and researcher actions through the same command endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      command: {
        command_kind: "agent_provider.setup",
        status: "succeeded"
      },
      operator: {
        candidate_arena: fixtureCandidateArena
      }
    }));
    vi.stubGlobal("fetch", fetchMock);

    await setupAgentProvider("codex");
    await probeAgentProvider("codex");
    await startAgentProviderLogin("codex");
    await selectResearcherProvider("fixture");
    await submitOuroborosCommand({ command_kind: "agent_provider.status" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:4173/api/commands",
      expect.objectContaining({
        body: JSON.stringify({
          command_kind: "agent_provider.setup",
          payload: { provider: "codex" }
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:4173/api/commands",
      expect.objectContaining({
        body: JSON.stringify({
          command_kind: "agent_provider.probe",
          payload: { provider: "codex" }
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:4173/api/commands",
      expect.objectContaining({
        body: JSON.stringify({
          command_kind: "agent_provider.login.start",
          payload: { provider: "codex" }
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:4173/api/commands",
      expect.objectContaining({
        body: JSON.stringify({
          command_kind: "researcher.provider.select",
          payload: { provider: "fixture" }
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:4173/api/commands",
      expect.objectContaining({
        body: JSON.stringify({ command_kind: "agent_provider.status" })
      })
    );
  });

  it("surfaces command API next steps without hiding provider readiness failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({
        error: "agent_provider_not_authenticated",
        required_command: "ouroboros agent login codex"
      })
    } as Response));

    await expect(submitOuroborosCommand({ command_kind: "arena.tick" })).rejects.toThrow(
      /Ouroboros command arena\.tick failed: agent_provider_not_authenticated\nNext step: ouroboros agent login codex/
    );
  });

  it("keeps Web UI product loop wrappers aligned with the domain product loop command set", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/api/operator")) {
        return jsonResponse({
          operator: {
            candidate_arena: fixtureCandidateArena,
            selected_candidate_id: "candidate-profitable",
            selected_candidate: arenaSelectedCandidate(),
            selected_paper_evidence: {
              status: "not_run",
              ledger_chain_complete: false,
              authority_status: "not_live"
            },
            selected_paper_trading_evaluation: paperTradingEvaluationFixture({
              status: "not_started",
              observation_count: 0,
              ledger_chain_complete: false
            }),
            researcher_provider: {
              selected_provider: "fixture",
              available_providers: ["codex", "fixture"],
              authority_status: "research_only"
            },
            agent_profiles: [],
            latest_commands: [],
            authority_status: "not_live",
            live_disabled: true
          }
        });
      }
      const request = JSON.parse(String(init?.body));
      return jsonResponse({
        command: {
          command_kind: request.command_kind,
          status: "succeeded"
        },
        operator: {
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: "candidate-profitable",
          selected_candidate: arenaSelectedCandidate(),
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperTradingEvaluationFixture({
            status: "not_started",
            observation_count: 0,
            ledger_chain_complete: false
          }),
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          authority_status: "not_live",
          live_disabled: true
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchOperatorReadModel();
    await runCandidateArenaCommand("status");
    await runCandidateArenaCommand("start");
    await runCandidateArenaCommand("stop");
    await runCandidateArenaCommand("tick");
    await selectCandidateForOperator("candidate-profitable");
    await promoteCandidateToTrading("candidate-profitable");
    await startTradingRun(arenaSelectedCandidate());
    await observeTradingRun(arenaSelectedCandidate());
    await stopTradingRun(arenaSelectedCandidate());
    await submitOuroborosCommand({ command_kind: "agent_provider.status" });
    await setupAgentProvider("codex");
    await startAgentProviderLogin("codex");
    await probeAgentProvider("codex");
    await selectResearcherProvider("fixture");

    expect(OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS).toEqual([
      "arena.status",
      "arena.start",
      "arena.stop",
      "arena.tick",
      "candidate.select",
      "trading_candidate.promote",
      "trading_run.start",
      "trading_run.observe",
      "trading_run.stop",
      "agent_provider.status",
      "agent_provider.setup",
      "agent_provider.login.start",
      "agent_provider.probe",
      "researcher.provider.select"
    ]);
    expect(calls[0]).toEqual({
      url: "http://127.0.0.1:4173/api/operator",
      init: undefined
    });
    expect(calls.slice(1).map((call) => call.url)).toEqual(Array.from(
      { length: 14 },
      () => "http://127.0.0.1:4173/api/commands"
    ));
    expect(calls.slice(1).map((call) => JSON.parse(String(call.init?.body)))).toEqual([
      { command_kind: "arena.status" },
      { command_kind: "arena.start" },
      { command_kind: "arena.stop" },
      { command_kind: "arena.tick" },
      {
        command_kind: "candidate.select",
        payload: { candidate_id: "candidate-profitable" }
      },
      {
        command_kind: "trading_candidate.promote",
        payload: { candidate_id: "candidate-profitable" }
      },
      {
        command_kind: "trading_run.start",
        payload: { candidate_id: "candidate-profitable" }
      },
      {
        command_kind: "trading_run.observe",
        payload: { trading_run_id: "fixture-runtime" }
      },
      {
        command_kind: "trading_run.stop",
        payload: { trading_run_id: "fixture-runtime" }
      },
      { command_kind: "agent_provider.status" },
      {
        command_kind: "agent_provider.setup",
        payload: { provider: "codex" }
      },
      {
        command_kind: "agent_provider.login.start",
        payload: { provider: "codex" }
      },
      {
        command_kind: "agent_provider.probe",
        payload: { provider: "codex" }
      },
      {
        command_kind: "researcher.provider.select",
        payload: { provider: "fixture" }
      }
    ]);
  });

  it("reads the shared operator model for UI state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      operator: {
        candidate_arena: fixtureCandidateArena,
        selected_candidate_id: "candidate-profitable",
        selected_candidate: arenaSelectedCandidate(),
        selected_paper_evidence: {
          status: "not_run",
          ledger_chain_complete: false,
          authority_status: "not_live"
        },
        selected_paper_trading_evaluation: paperTradingEvaluationFixture({
          status: "not_started",
          observation_count: 0,
          ledger_chain_complete: false
        }),
        paper_trading_board: paperTradingBoardFixture(),
        trading_review: tradingReviewFixture({
          paper_trading_evaluation: paperTradingEvaluationFixture({
            status: "not_started",
            observation_count: 0,
            ledger_chain_complete: false
          })
        }),
        researcher_provider: {
          selected_provider: "fixture",
          available_providers: ["codex", "fixture"],
          authority_status: "research_only"
        },
        agent_profiles: [],
        latest_commands: [],
        authority_status: "not_live",
        live_disabled: true
      }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const operator = await fetchOperatorReadModel();

    expect(operator.selected_candidate_id).toBe("candidate-profitable");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4173/api/operator");
  });

  it("derives trading research runtime from an already-loaded operator model", () => {
    const operator = {
      researcher_provider: {
        selected_provider: "fixture",
        available_providers: ["codex", "fixture"],
        authority_status: "research_only"
      },
      agent_profiles: [{
        profile_id: "codex",
        provider: "codex",
        label: "Codex",
        status: "login_required",
        managed_home: "/tmp/ouroboros/agent-profiles/codex/home",
        managed_provider_home: "/tmp/ouroboros/agent-profiles/codex/codex-home",
        authority_status: "no_trading_authority",
        failure_reason: "login_required"
      }]
    } satisfies Pick<OperatorReadModel, "researcher_provider" | "agent_profiles">;

    const runtime = buildTradingResearchRuntimeFromOperator(operator);

    expect(runtime.default_agent).toBe("fixture");
    expect(runtime.available_agents).toEqual(["codex", "fixture"]);
    expect(runtime.agents).toEqual([
      expect.objectContaining({
        agent: "codex",
        readiness_status: "blocked_or_not_installed",
        failure_reason: "login_required"
      }),
      expect.objectContaining({
        agent: "fixture",
        readiness_status: "active_verified",
        model: "scripted-fixture"
      })
    ]);
  });
});

describe("CandidateDetail", () => {
  it("renders Candidate Arena leaderboard around net revenue without fixture controls", () => {
    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={fixtureCandidateArena}
        selectedCandidateId="candidate-profitable"
        selectedCandidate={arenaSelectedCandidate()}
        researcherProvider={{
          selected_provider: "codex",
          available_providers: ["codex", "fixture"],
          authority_status: "research_only"
        }}
        agentProfiles={[{
          profile_id: "codex",
          label: "Codex",
          provider: "codex",
          status: "authenticated",
          managed_home: "/tmp/ouroboros/agent-profiles/codex/home",
          managed_provider_home: "/tmp/ouroboros/agent-profiles/codex/codex-home",
          authority_status: "no_trading_authority"
        }]}
        latestCommands={[{
          command_id: "command-1",
          command_kind: "arena.tick",
          status: "succeeded",
          requested_at: "2026-05-27T00:00:00.000Z",
          completed_at: "2026-05-27T00:00:01.000Z",
          authority_status: "not_live"
        }]}
        selectedPaperEvidence={{
          status: "not_run",
          ledger_chain_complete: false,
          authority_status: "not_live"
        }}
        selectedPaperTradingEvaluation={paperTradingEvaluationFixture()}
        paperTradingBoard={paperTradingBoardFixture()}
        onStart={() => undefined}
        onStop={() => undefined}
        onTick={() => undefined}
        onSelectCandidate={() => undefined}
        onStartPaperTrading={() => undefined}
        actionPending={false}
        runningPaperTrading={false}
      />
    );

    expect(html).toContain("Candidate Arena");
    expect(html).toContain("Operator cockpit");
    expect(html).toContain('data-slot="card"');
    const arenaCommandBar = extractArenaCommandBarSection(html);
    expect(arenaCommandBar).toContain(">Arena command bar<");
    expect(arenaCommandBar).toContain('data-operator-ui="panel"');
    expect(arenaCommandBar).toContain('data-operator-ui="section-header"');
    expect(arenaCommandBar).toContain('data-operator-ui="callout"');
    expect(arenaCommandBar).toContain('data-operator-ui="action-row"');
    expect(arenaCommandBar).not.toContain(">Runtime command bar<");
    const arenaMetricStrip = extractCandidateArenaMetricStripSection(html);
    expect(arenaMetricStrip).toContain('data-operator-ui="metric-strip"');
    expect(arenaMetricStrip).toContain('data-slot="card"');
    expect(arenaMetricStrip).toContain("repeat(auto-fit");
    expect(arenaMetricStrip).not.toContain("md:grid-cols-3");
    expect(arenaMetricStrip).not.toContain("text-[1.35rem]");
    expect(arenaMetricStrip).toContain("Arena runner");
    expect(arenaMetricStrip).toContain("ResearchPreflight net");
    expect(arenaMetricStrip).toContain("ResearchPreflight return");
    expect(arenaMetricStrip).not.toContain(">Net revenue<");
    expect(arenaMetricStrip).not.toContain(">Net return<");
    const leaderboardSection = extractCandidateArenaLeaderboardSection(html);
    expect(leaderboardSection).toContain("ResearchPreflight leaderboard");
    expect(leaderboardSection).toContain('data-slot="button"');
    expect(leaderboardSection).not.toContain("Revenue-cost leaderboard");
    expect(leaderboardSection).not.toContain("bg-muted/35");
    expect(leaderboardSection).not.toContain("ring-primary/30");
    expect(leaderboardSection).toContain("ResearchPreflight net");
    expect(leaderboardSection).toContain("ResearchPreflight return");
    expect(leaderboardSection).not.toContain(">Net revenue<");
    expect(leaderboardSection).not.toContain(">Net return<");
    expect(html).toContain("Arena runner");
    expect(html).toContain("running");
    expect(html).toContain("trend_following");
    expect(html).toContain("9.83 USDT");
    expect(html).toContain("0.0983%");
    expect(html).toContain("Start");
    expect(html).toContain("Stop");
    expect(html).toContain("Selected candidate");
    expect(html).toContain("System Code");
    expect(html).not.toContain(">SystemCode<");
    expect(html).toContain("ResearchPreflight");
    expect(html).toContain("Research leaderboard");
    expect(html).not.toContain(">Evaluation<");
    expect(html).not.toContain("profit_loss");
    expect(html).toContain("Paper runner");
    expect(html).toContain("Paper Board");
    const paperBoardSection = extractCandidateArenaPaperBoardSection(html);
    expect(paperBoardSection).toContain('data-operator-ui="panel"');
    expect(paperBoardSection).toContain('data-operator-ui="evidence-stack"');
    expect(paperBoardSection).toContain('data-operator-ui="evidence-block"');
    expect(paperBoardSection).toContain('data-operator-ui="evidence-status"');
    expect(paperBoardSection).toContain('data-operator-ui="evidence-row"');
    expect(paperBoardSection).not.toContain('class="grid gap-2 md:grid-cols-2"');
    expect(paperBoardSection).not.toContain('class="placeholder"');
    expect(paperBoardSection).not.toContain("bg-background/55");
    expect(paperBoardSection).not.toContain("ring-border/35");
    expect(html).toContain("sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(html).toContain("[overflow-wrap:anywhere]");
    expect(html).toContain("Paper return");
    expect(html).not.toContain(">Return<");
    expect(html).toContain("Qualification");
    expect(html).toContain("collecting_evidence");
    expect(html).toContain("Evidence window");
    expect(html).toContain("1 obs / 0 failed / 60000ms");
    expect(html).toContain("Qualification reasons");
    expect(html).not.toContain(">Reasons<");
    expect(html).toContain("min_observation_count_not_met, min_elapsed_ms_not_met");
    expect(html).toContain("Promotion gate");
    expect(html).not.toContain(">Gate<");
    expect(html).toContain("collecting_paper_evidence");
    expect(html).toContain("Paper runner");
    expect(html).not.toContain(">Runner<");
    expect(html).toContain("active / next");
    expect(html).toContain("Paper observations");
    expect(html).not.toContain(">Observations<");
    expect(html).toContain("Paper market snapshot");
    expect(html).not.toContain(">Market snapshot<");
    expect(html).toContain("Gateway market data");
    expect(html).not.toContain(">Market data<");
    expect(html).toContain("Market provenance");
    expect(html).not.toContain(">Market<");
    expect(html).toContain("binance_production_public_websocket");
    expect(html).toContain("Fill quality");
    expect(html).toContain("filled / open 0");
    expect(html).toContain("Trend");
    expect(html).toContain("insufficient_history / 0 USDT / 0% / 0 obs / not_promotion_authority");
    expect(html).toContain("Blocker density");
    expect(html).toContain("2 blockers / density 2 / failed 0 / top min_observation_count_not_met / not_promotion_authority");
    expect(html).toContain("Public execution evidence");
    expect(html).toContain("binance_production_public_websocket / websocket_primary / fresh / WS connected / marker binance-ws-aggTrade-991");
    expect(html).toContain("Public order book evidence");
    expect(html).not.toContain(">Order book<");
    expect(html).toContain("synced / update 11");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("Paper decision");
    expect(html).toContain("order_request buy limit 0.001 @ 65000");
    expect(html).toContain("Paper account");
    expect(html).toContain("equity 10,004.952 USDT / long 0.001 BTCUSDT / open 0");
    expect(html).toContain("Paper fill");
    expect(html).toContain("filled 0.001 @ 60000 / trade agg-60000-001");
    const selectedCandidateSection = extractSelectedCandidateArenaSection(html);
    expect(selectedCandidateSection).toContain('data-operator-ui="panel"');
    expect(selectedCandidateSection).toContain('data-operator-ui="section-header"');
    expect(selectedCandidateSection).toContain('data-operator-ui="action-row"');
    expect(selectedCandidateSection).toContain("sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(selectedCandidateSection).not.toContain("rounded-md bg-muted/25 p-3");
    expect(selectedCandidateSection).toContain("Candidate lineage");
    expect(selectedCandidateSection).not.toContain(">Lineage<");
    expect(selectedCandidateSection).toContain("Selected candidate authority");
    expect(selectedCandidateSection).not.toContain(">Authority<");
    expect(html).toContain("Observe now");
    expect(html).toContain("Stop paper trading");
    expect(html).toContain("Agent providers");
    const agentProviderSection = extractAgentProviderStatusSection(html);
    expect(agentProviderSection).toContain('data-operator-ui="panel"');
    expect(agentProviderSection).toContain('data-operator-ui="section-header"');
    expect(agentProviderSection).toContain('data-operator-ui="action-row"');
    expect(agentProviderSection).not.toContain("rounded-md bg-muted/25 p-3");
    expect(html).toContain("Codex");
    expect(html).toContain("Command log");
    const commandLogSection = extractCommandLogSection(html);
    expect(commandLogSection).toContain('data-operator-ui="panel"');
    expect(commandLogSection).toContain('data-operator-ui="section-header"');
    expect(commandLogSection).not.toContain("rounded-md bg-muted/25 p-3");
    expect(commandLogSection).not.toContain("rounded-md bg-background/55");
    expect(commandLogSection).not.toContain("ring-border/30");
    expect(html).toContain("arena.tick");
    expect(html).toContain("Latest ticks");
    const latestTicksSection = extractCandidateArenaLatestTicksSection(html);
    expect(latestTicksSection).toContain('data-operator-ui="panel"');
    expect(latestTicksSection).toContain('data-operator-ui="section-header"');
    expect(latestTicksSection).toContain("sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(latestTicksSection).not.toContain("rounded-md bg-muted/25 p-3");
    expect(html).toContain("completed");
    expect(html).toContain("Generated");
    expect(html).toContain("1 created / 1 failed");
    expect(html).toContain("trend_following:created");
    expect(html).toContain("mean_reversion:failed");
    expect(html).toContain("Efficiency");
    expect(html).toContain("trend_following: 6 provider / 0 runner / 2 scenarios / 1000ms / not_promotion_authority");
    expect(html).not.toContain("Fixture");
    expect(html).not.toContain("Research iterations");
  });

  it("points failed promotion commands back to visible blocker surfaces", () => {
    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={fixtureCandidateArena}
        selectedCandidateId="candidate-profitable"
        selectedCandidate={arenaSelectedCandidate()}
        researcherProvider={{
          selected_provider: "codex",
          available_providers: ["codex", "fixture"],
          authority_status: "research_only"
        }}
        agentProfiles={[]}
        latestCommands={[{
          command_id: "command-promote-failed",
          command_kind: "trading_candidate.promote",
          status: "failed",
          requested_at: "2026-05-27T00:00:00.000Z",
          completed_at: "2026-05-27T00:00:01.000Z",
          error: "paper_trading_qualification_required",
          authority_status: "not_live"
        }]}
        selectedPaperEvidence={{
          status: "not_run",
          ledger_chain_complete: false,
          authority_status: "not_live"
        }}
        selectedPaperTradingEvaluation={paperTradingEvaluationFixture()}
        paperTradingBoard={paperTradingBoardFixture()}
        actionPending={false}
        runningPaperTrading={false}
      />
    );

    const commandLog = html.slice(
      html.indexOf('aria-label="Command log"'),
      html.indexOf('aria-label="Candidate Arena latest ticks"')
    );
    expect(commandLog).toContain("trading_candidate.promote");
    expect(commandLog).toContain("paper_trading_qualification_required");
    expect(commandLog).toContain("Remediation group");
    expect(commandLog).not.toContain(">Group<");
    expect(commandLog).toContain("Visible surface");
    expect(commandLog).not.toContain(">Surface<");
    expect(commandLog).toContain("Remediation next step");
    expect(commandLog).not.toContain(">Remediation<");
    expect(commandLog).toContain("Command authority");
    expect(commandLog).not.toContain(">Authority<");
    expect(commandLog).toContain("Trading review promotion");
    expect(commandLog).toContain("Trading review packet, Paper Board");
    expect(commandLog).toContain("Review the Trading review packet blockers and Paper Board qualification before retrying promotion.");
    expect(commandLog).toContain("not_live");
  });

  it("keeps selected arena candidate paper evidence available before Ledger exists", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="arena"
        candidate={arenaSelectedCandidate()}
        candidateArena={fixtureCandidateArena}
        onSelectCandidate={() => undefined}
        onStartTradingRun={() => undefined}
        runningTradingRun={false}
      />
    );

    expect(html).toContain("Selected candidate");
    expect(html).toContain("Start paper trading");
    expect(html).toContain("Paper Trading Evaluation");
    expect(html).not.toContain(">PaperTradingEvaluation<");
    expect(html).toContain("not_started");
    expect(html).not.toContain("Research iterations");
  });

  it("shows resume language when persisted paper evaluation lost the in-memory runner", () => {
    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={fixtureCandidateArena}
        selectedCandidateId="candidate-profitable"
        selectedCandidate={arenaSelectedCandidate()}
        selectedPaperEvidence={{
          status: "ledger_chain_complete",
          ledger_chain_complete: true,
          ledger_chain_count: 1,
          authority_status: "not_live"
        }}
        selectedPaperTradingEvaluation={paperTradingEvaluationFixture({
          status: "running",
          runner_active: false
        })}
        onStart={() => undefined}
        onStop={() => undefined}
        onTick={() => undefined}
        onSelectCandidate={() => undefined}
        onStartPaperTrading={() => undefined}
        actionPending={false}
        runningPaperTrading={false}
      />
    );

    expect(html).toContain("Resume paper trading");
    expect(html).toContain("needs resume / persisted running, timer inactive / next");
    expect(html).not.toContain("Stop paper trading");
  });

  it("renders empty Candidate Arena states through operator empty states", () => {
    const emptyArena: CandidateArenaReadModel = {
      ...fixtureCandidateArena,
      leaderboard: [],
      latest_candidates: [],
      latest_ticks: []
    };
    const emptyPaperBoard: PaperTradingBoardReadModel = {
      ...paperTradingBoardFixture(),
      entries: []
    };
    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={emptyArena}
        selectedCandidateId={fixtureCandidate.candidate_id}
        selectedCandidate={fixtureCandidate}
        selectedPaperEvidence={{
          status: "not_run",
          ledger_chain_complete: false,
          authority_status: "not_live"
        }}
        selectedPaperTradingEvaluation={paperTradingEvaluationFixture()}
        paperTradingBoard={emptyPaperBoard}
        onStart={() => undefined}
        onStop={() => undefined}
        onTick={() => undefined}
        onSelectCandidate={() => undefined}
        onStartPaperTrading={() => undefined}
        actionPending={false}
        runningPaperTrading={false}
      />
    );

    const paperBoardSection = extractCandidateArenaPaperBoardSection(html);
    const leaderboardSection = extractCandidateArenaLeaderboardSection(html);
    const latestTicksSection = extractCandidateArenaLatestTicksSection(html);

    expect(paperBoardSection).toContain('data-operator-ui="empty-state"');
    expect(paperBoardSection).toContain("No paper evaluations yet");
    expect(paperBoardSection).not.toContain('class="placeholder"');
    expect(leaderboardSection).toContain('data-operator-ui="empty-state"');
    expect(leaderboardSection).toContain("No candidates yet");
    expect(leaderboardSection).not.toContain('class="placeholder');
    expect(latestTicksSection).toContain('data-operator-ui="empty-state"');
    expect(latestTicksSection).toContain("No Candidate Arena ticks recorded.");
    expect(latestTicksSection).not.toContain('class="placeholder"');
  });

  it("keeps the cockpit inspector bound to the operator-selected candidate even outside the arena leaderboard", () => {
    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={fixtureCandidateArena}
        selectedCandidateId={fixtureCandidate.candidate_id}
        selectedCandidate={fixtureCandidate}
        selectedPaperEvidence={{
          status: "ledger_chain_complete",
          ledger_chain_complete: true,
          ledger_chain_count: 1,
          authority_status: "not_live"
        }}
        selectedPaperTradingEvaluation={paperTradingEvaluationFixture({
          profit_loss: {
            revenue_usdt: 0,
            cost_usdt: 0.054504,
            net_revenue_usdt: -0.054504,
            net_return_pct: -0.00054504
          },
          observation_count: 3
        })}
        onStart={() => undefined}
        onStop={() => undefined}
        onTick={() => undefined}
        onSelectCandidate={() => undefined}
        onStartPaperTrading={() => undefined}
        actionPending={false}
        runningPaperTrading={false}
      />
    );
    const selectedSection = extractSelectedCandidateArenaSection(html);

    expect(html).toContain("Arena trend Trading System");
    expect(selectedSection).toContain("Fixture generic trading-system candidate");
    expect(selectedSection).toContain("outside_arena_leaderboard");
    expect(selectedSection).toContain("Selected candidate is not in the current arena leaderboard.");
    expect(selectedSection).toContain("-0.054504 USDT / -0.000545%");
    expect(selectedSection).toContain("Ledger chain complete");
    expect(selectedSection).not.toContain("Arena trend Trading System");
  });

  it("treats an empty selected candidate Ledger as paper evidence not run", () => {
    const selectedCandidate = arenaSelectedCandidate({
      ledger: buildLedgerReadModel(emptyLedgerSourceRecords()),
      runtime: {
        ...arenaSelectedCandidate().runtime,
        runtime_lifecycle_status: "registered"
      },
      trading_run: {
        ref: { record_kind: "trading_run", id: "arena-trading-run-placeholder" },
        stage: "paper",
        lifecycle_status: "registered",
        authority_status: "not_live"
      }
    });

    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={fixtureCandidateArena}
        selectedCandidateId="candidate-profitable"
        selectedCandidate={selectedCandidate}
        onStart={() => undefined}
        onStop={() => undefined}
        onTick={() => undefined}
        onSelectCandidate={() => undefined}
        onStartPaperTrading={() => undefined}
        actionPending={false}
        runningPaperTrading={false}
      />
    );

    expect(html).toContain("Paper Trading Evaluation");
    expect(html).toContain("not run");
    expect(html).toContain("Trading Run");
    expect(html).not.toContain(">PaperTradingEvaluation<");
    expect(html).not.toContain(">TradingRun<");
    expect(html).not.toContain("0 Ledger chains");
    expect(html).not.toContain("registered");
  });

  it("shows selected candidate Ledger chain summary after paper evidence completes", () => {
    const html = renderToStaticMarkup(
      <CandidateArenaPanel
        arena={fixtureCandidateArena}
        selectedCandidateId="candidate-profitable"
        selectedCandidate={arenaSelectedCandidate({
          ledger: buildLedgerReadModel(ledgerSourceRecords()),
          trading_run: {
            ref: { record_kind: "trading_run", id: "arena-trading-run-complete" },
            stage: "paper",
            lifecycle_status: "stopped",
            authority_status: "not_live"
          }
        })}
        onStart={() => undefined}
        onStop={() => undefined}
        onTick={() => undefined}
        onSelectCandidate={() => undefined}
        onStartPaperTrading={() => undefined}
        actionPending={false}
        runningPaperTrading={false}
      />
    );

    expect(html).toContain("Paper Trading Evaluation");
    expect(html).toContain("Ledger chain complete");
    expect(html).toContain("Trading Run");
    expect(html).not.toContain(">PaperTradingEvaluation<");
    expect(html).not.toContain(">TradingRun<");
    expect(html).toContain("stopped");
    expect(html).toContain("OrderRequest");
    expect(html).toContain("buy limit 0.001");
    expect(html).toContain("GatewayResult");
    expect(html).toContain("dry_run_only");
    expect(html).toContain("ExecutionResult");
    expect(html).toContain("dry_run_recorded");
  });

  it("renders fixture labels and inspect sections without action controls", () => {
    const html = renderToStaticMarkup(<CandidateDetail candidate={fixtureCandidate} />);

    expect(html).toContain("Fixture / convenience mode");
    expect(html).toContain("fixture_convenience_mode");
    expect(html).toContain("No provider has run.");
    expect(html).toContain("Capability Package");
    expect(html).toContain("Agent And Provider");
    expect(html).toContain("Ledger");
    expect(html).toContain("Run Control");
    expect(html).toContain("Candidate Runs");
    expect(html).toContain("No candidate-id replay runs");
    expect(html).toContain("Trading run state");
    expect(html).toContain("Request / decision / result");
    expect(html).toContain("ResearchPreflight Evidence");
    expect(html).toContain("ResearchPreflight state");
    expect(html).toContain("pending");
    expect(html).toContain("Latest ResearchPreflight run");
    expect(html).toContain("Stage binding");
    expect(html).toContain("Provider trace material");
    expect(html).toContain("Evidence classifications");
    expect(html).toContain("trace_debug_material");
    const gatewayContractSection = extractDetailsInfoSection(html, "Trading gateway contract");
    expect(gatewayContractSection).toContain('data-operator-ui="empty-state"');
    expect(gatewayContractSection).toContain("No trading gateway contract");
    expect(gatewayContractSection).not.toContain('class="placeholder"');
    const materializationAttemptSection = extractMaterializationAttemptSection(html);
    expect(materializationAttemptSection).toContain('data-operator-ui="empty-state"');
    expect(materializationAttemptSection).toContain("No materialization attempt");
    expect(materializationAttemptSection).not.toContain('class="placeholder"');
    expectNoOperatorActionControls(html);
  });

  it("renders the Arena unavailable fallback through operator primitives", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="arena"
        candidate={fixtureCandidate}
      />
    );

    const arenaUnavailableStart = startOfOpeningTagForAriaLabel(html, "Arena unavailable");
    const arenaUnavailableEnd = html.indexOf("</section>", arenaUnavailableStart);
    const arenaUnavailable = html.slice(arenaUnavailableStart, arenaUnavailableEnd);

    expect(arenaUnavailable).toContain('data-operator-ui="panel"');
    expect(arenaUnavailable).toContain('data-operator-ui="section-header"');
    expect(arenaUnavailable).toContain("Continuous paper trading arena state is not projected yet.");
    expect(extractOpeningTagForAriaLabel(arenaUnavailable, "Arena unavailable")).toContain('data-slot="card"');
  });

  it("renders Binance BTCUSDT order-fill substrate posture without action controls", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: null,
            latest_private_readiness_preflight_surface: null,
            latest_private_readiness_posture: null,
            private_readiness_posture_history: [],
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Trading Substrate");
    expect(html).toContain("Binance BTCUSDT order_fill");
    expect(html).toContain("partially_filled");
    expect(html).toContain("PARTIALLY_FILLED");
    expect(html).toContain("TRADE");
    expect(html).toContain("Order side / type");
    expect(html).not.toContain(">Side / type<");
    expect(html).toContain("fixture-backed");
    expect(html).toContain("simulated");
    expect(html).toContain("@binance/derivatives-trading-usds-futures");
    expect(html).toContain("binance/binance-connector-js");
    expect(html).toContain("transport_only");
    expect(html).toContain("fixture_seed_no_live_connector");
    expect(html).toContain(BINANCE_NO_AUTHORITY_LABEL);
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true
    });
  });

  it("renders the trading substrate section through operator UI primitives", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: fixturePrivateReadinessPosture(),
            private_readiness_posture_history: [
              fixturePrivateReadinessPosture(),
              fixturePrivateReadinessPosture({
                posture_id: "fixture-binance-btcusdt-private-readiness-posture-previous"
              })
            ],
            latest_trading_gateway_contract: fixtureTradingGatewayContract(),
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_private_read_gate_decision: fixturePrivateReadGateDecision(),
            latest_account_position_risk_mirror_surface: fixtureAccountPositionRiskMirrorSurface()
          }
        }}
        onRecordPrivateReadinessPosture={() => undefined}
      />
    );

    const substrateSection = extractDetailsInfoSection(html, "Trading Substrate");

    expect(substrateSection).toContain("Public market posture");
    expect(substrateSection).toContain("Private readiness preflight");
    expect(substrateSection).toContain("Private-readiness posture");
    expect(substrateSection).toContain("Private-readiness policy");
    expect(substrateSection).toContain("Account position risk mirror");
    expect(substrateSection).toContain("Order-fill posture");
    expect(substrateSection).toContain("Save local posture");
    expect(substrateSection).toContain('data-operator-ui="evidence-stack"');
    expect(substrateSection).toContain('data-operator-ui="evidence-status"');
    expect(substrateSection).toContain('data-operator-ui="evidence-block"');
    expect(substrateSection).toContain('data-operator-ui="evidence-row"');
    expect(substrateSection).toContain('data-operator-ui="action-row"');
    expect(substrateSection).not.toContain("posture-history");
    expect(substrateSection).not.toContain("posture-history-row");
    expect(substrateSection).not.toContain('class="evaluation-status');
    expect(substrateSection).not.toContain('class="runtime-command');
    expect(substrateSection).not.toContain('class="runtime-command-button');
    expect(substrateSection).not.toContain('class="placeholder"');
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders Binance BTCUSDT public market and liveness posture without action controls", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: null,
            latest_private_readiness_posture: null,
            private_readiness_posture_history: [],
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Public market posture");
    expect(html).toContain("Binance BTCUSDT public_market_liveness");
    expect(html).toContain("TRADING");
    expect(html).toContain("PERPETUAL");
    expect(html).toContain("0.10");
    expect(html).toContain("0.001");
    expect(html).toContain("100");
    expect(html).toContain("65000.12340000");
    expect(html).toContain("64995.00000000");
    expect(html).toContain("0.00010000");
    expect(html).toContain("2026-05-16T08:00:00.000Z");
    expect(html).toContain("2026-05-16T00:00:01.000Z");
    expect(html).toContain("fixture-backed");
    expect(html).toContain("@binance/derivatives-trading-usds-futures");
    expect(html).toContain("transport_only");
    expect(html).toContain("fixture_seed_no_live_connector");
    expect(html).toContain(BINANCE_NO_AUTHORITY_LABEL);
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true
    });
  });

  it("renders Binance BTCUSDT private-readiness preflight gates without action controls", () => {
    const localPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-002",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:08.000Z",
      operator_approval_gate: {
        status: "ready",
        reason: "operator_approval_recorded_in_local_history"
      }
    });
    const secretReference = ref(
      "secret_reference",
      "local-binance-btcusdt-user-data-read-reference"
    );
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: localPosture,
            private_readiness_posture_history: [
              localPosture,
              fixturePrivateReadinessPosture()
            ],
            latest_trading_gateway_contract: fixtureTradingGatewayContract(),
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_private_read_gate_decision: fixturePrivateReadGateDecision({
              credential_reference_status: "reference_only",
              credential_reference_source: "private_readiness_posture",
              credential_reference_ref: secretReference,
              signed_read_permission_preflight_status: "preflight_only",
              signed_read_permission_preflight_source: "policy_decision",
              signed_request_construction_boundary_status: "dry_run_only",
              signed_request_construction_boundary_source: "policy_decision",
              signed_request_construction_required_components: [
                "API key",
                "timestamp",
                "recvWindow",
                "query string",
                "signature",
                "signed endpoint"
              ],
              signed_read_permission_grant_boundary_status: "decision_only",
              signed_read_permission_grant_boundary_source: "policy_decision",
              signed_request_execution_boundary_status: "decision_only",
              signed_request_execution_boundary_source: "policy_decision",
              account_balance_position_read_boundary_status: "decision_only",
              account_balance_position_read_boundary_source: "policy_decision"
            }),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private readiness preflight");
    expect(html).toContain("Binance BTCUSDT private_readiness_preflight");
    expect(html).toContain("no_binance_api_key_configured");
    expect(html).toContain("operator_live_private_read_approval_missing");
    expect(html).toContain("operator_jurisdiction_not_recorded");
    expect(html).toContain("signed_user_data_account_read_deferred");
    expect(html).toContain("listen_key_creation_forbidden_in_preflight");
    expect(html).toContain("trade_endpoint_forbidden");
    expect(html).toContain("GET /fapi/v3/account");
    expect(html).toContain("POST /fapi/v1/listenKey");
    expect(html).toContain("POST /fapi/v1/order");
    expect(html).toContain("configure_private_read_credentials");
    expect(html).toContain("Private-readiness posture");
    expect(html).toContain("Binance BTCUSDT private_readiness_posture");
    expect(html).toContain("Recent posture history");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-002");
    expect(html).toContain("local_config / 2026-05-16T00:00:08.000Z");
    expect(html).toContain("operator=ready, jurisdiction=review_required");
    expect(html).toContain("Posture delta summary");
    expect(html).toContain("Current posture");
    expect(html).toContain("Previous posture");
    expect(html).toContain("fixture-binance-btcusdt-private-readiness-posture-001");
    expect(html).toContain("1 changed gate");
    expect(html).toContain("Operator approval: not_ready -&gt; ready");
    expect(html).toContain(
      "reason operator_live_private_read_approval_missing -&gt; operator_approval_recorded_in_local_history"
    );
    expect(html).toContain("local_config_delta_inspection_only");
    expect(html).toContain("not_counted_evidence_or_promotion");
    expect(html).toContain("Operator approval gate");
    expect(html).toContain("Jurisdiction / risk gate");
    expect(html).toContain("operator_live_private_read_approval_missing");
    expect(html).toContain("operator_jurisdiction_not_recorded");
    expect(html).toContain("live_binding_profile_not_configured");
    expect(html).toContain("secret_handling_profile_not_configured");
    expect(html).toContain("operator_stop_behavior_not_recorded");
    expect(html).toContain("Raw secret material");
    expect(html).toContain("false");
    expect(html).toContain("Private-readiness policy");
    expect(html).toContain("private_readiness_policy_decision");
    expect(html).toContain("Trading gateway contract");
    expect(html).toContain("TradingGateway");
    expect(html).toContain("sandbox_direct_exchange_access=false");
    expect(html).toContain("USER_DATA, TRADE");
    expect(html).toContain("order_request -&gt; gateway_result -&gt; execution_result");
    expect(html).toContain("GET /fapi/v3/account, GET /fapi/v3/positionRisk");
    expect(html).toContain("POST /fapi/v1/order");
    expect(html).toContain("gateway_required=true, authority=not_granted");
    expect(html).toContain("Private-read gate");
    expect(html.indexOf("Trading gateway contract")).toBeLessThan(
      html.indexOf("Private-read gate")
    );
    expect(html).toContain("private_read_gate_decision");
    expect(html).toContain("Gate status");
    expect(html).toContain("not_ready");
    expect(html).toContain("Credential reference");
    expect(html).toContain("reference_only");
    expect(html).toContain("Credential reference source");
    expect(html).toContain("private_readiness_posture");
    expect(html).toContain("Credential reference ref");
    expect(html).toContain("secret_reference:local-binance-btcusdt-user-data-read-reference");
    expect(html).toContain("Signed-read preflight");
    expect(html).toContain("USER_DATA=preflight_only");
    expect(html).toContain("policy_decision");
    expect(html).toContain("Signed request construction");
    expect(html).toContain("USER_DATA=dry_run_only");
    expect(html).toContain("API key, timestamp, recvWindow, query string, signature, signed endpoint");
    expect(html).toContain("Signed-read grant boundary");
    expect(html).toContain("USER_DATA=decision_only");
    expect(html).toContain("Signed request execution boundary");
    expect(html).toContain("Account / balance / position read boundary");
    expect(html).toContain("USER_DATA=not_granted");
    expect(html).toContain("USER_STREAM=not_granted");
    expect(html).toContain("TRADE=not_granted");
    expect(html).toContain("gateway=not_granted, evidence=not_counted, promotion=not_granted");
    expect(html).toContain("private_read_gate_no_secret_not_live");
    expect(html).toContain("Private-readiness review packet index");
    expect(html).toContain("review_packet_index_ready_for_operator_scan");
    expect(html).toContain("01 policy_impact_interpretation");
    expect(html).toContain("02 posture_delta_summary");
    expect(html).toContain("03 review_handoff");
    expect(html).toContain("04 authority_gate_preview");
    expect(html).toContain("05 checked_gate_matrix");
    expect(html).toContain("06 remediation_action_map");
    expect(html).toContain("07 remediation_progress_summary");
    expect(html.indexOf("01 policy_impact_interpretation")).toBeLessThan(
      html.indexOf("02 posture_delta_summary")
    );
    expect(html.indexOf("02 posture_delta_summary")).toBeLessThan(html.indexOf("03 review_handoff"));
    expect(html.indexOf("03 review_handoff")).toBeLessThan(html.indexOf("04 authority_gate_preview"));
    expect(html.indexOf("04 authority_gate_preview")).toBeLessThan(html.indexOf("05 checked_gate_matrix"));
    expect(html.indexOf("05 checked_gate_matrix")).toBeLessThan(html.indexOf("06 remediation_action_map"));
    expect(html.indexOf("06 remediation_action_map")).toBeLessThan(
      html.indexOf("07 remediation_progress_summary")
    );
    expect(html).toContain("review_packet_index_navigation_only");
    expect(html).toContain("Private-readiness review packet availability summary");
    expect(html).toContain(
      "availability_summary=available_for_review=7, needs_posture_context=0, no_current_items=0, policy_context_available=0"
    );
    expect(html).toContain("policy_input_posture_available");
    expect(html).toContain("posture_delta_current_and_previous_available");
    expect(html).toContain("review_handoff_context_available");
    expect(html).toContain("authority_gate_preview_context_available");
    expect(html).toContain("checked_gates=11");
    expect(html).toContain("required_next_actions=6");
    expect(html).toContain("remediation_progress_actions_present");
    expect(html).toContain("review_packet_availability_summary_navigation_only");
    expect(html).toContain("Private-readiness review packet gap summary");
    expect(html).toContain(
      "gap_summary=needs_posture_context=0, no_current_items=0, policy_context_available=0"
    );
    expect(html).toContain(
      "next_gap_focus=configure_private_read_credentials -&gt; checked_gate: configuration"
    );
    expect(html).toContain("review_packet_remediation_focus_present");
    expect(html).toContain("review_packet_gap_summary_navigation_only");
    expect(html).toContain("Private-readiness review packet resolution checklist");
    expect(html).toContain(
      "resolution_checklist=availability_gaps=0, remediation_actions=6, policy_context_available=0, total_items=6"
    );
    expect(html).toContain(
      "next_resolution_focus=configure_private_read_credentials -&gt; checked_gate: configuration"
    );
    expect(html).toContain("resolution_checklist_remediation_actions_present");
    expect(html).toContain("resolve_required_next_action");
    expect(html).toContain("read_only_resolution_guidance");
    expect(html).toContain("review_packet_resolution_checklist_navigation_only");
    expect(html).toContain("Private-readiness review packet source/provenance summary");
    expect(html).toContain(
      "source_provenance=policy_refs=2, posture_refs=1, previous_posture_refs=1, projection_rows=7"
    );
    expect(html).toContain(
      "next_source_focus=01 policy_impact_interpretation -&gt; PrivateReadinessPolicyDecision.source_surface_refs"
    );
    expect(html).toContain("source_provenance_posture_context_available");
    expect(html).toContain("read_only_source_provenance_context");
    expect(html).toContain("review_packet_source_provenance_navigation_only");
    expect(html).toContain("Private-readiness review packet completion/readiness summary");
    expect(html).toContain(
      "completion_readiness=review_surfaces=7, availability_gaps=0, source_gaps=0, resolution_items=6, remediation_actions=6"
    );
    expect(html).toContain(
      "next_completion_focus=configure_private_read_credentials -&gt; checked_gate: configuration"
    );
    expect(html).toContain("completion_readiness_remediation_actions_present");
    expect(html).toContain("read_only_completion_readiness_context");
    expect(html).toContain("review_packet_completion_readiness_navigation_only");
    expect(html.indexOf("Private-readiness review packet completion/readiness summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet index")
    );
    expect(html.indexOf("Private-readiness review packet index")).toBeLessThan(
      html.indexOf("Private-readiness review packet availability summary")
    );
    expect(html.indexOf("Private-readiness review packet availability summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet gap summary")
    );
    expect(html.indexOf("Private-readiness review packet gap summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet resolution checklist")
    );
    expect(html.indexOf("Private-readiness review packet resolution checklist")).toBeLessThan(
      html.indexOf("Private-readiness review packet source/provenance summary")
    );
    expect(html).toContain("Policy impact interpretation");
    expect(html).toContain("Policy input posture");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-002");
    expect(html).toContain("History role");
    expect(html).toContain("inspection_context_only");
    expect(html).toContain("Policy impact");
    expect(html).toContain("status=not_ready");
    expect(html).toContain("local_config_inspection_not_counted_evidence_or_promotion");
    expect(html).toContain("No-authority proof");
    expect(html).toContain("authority_status=not_live");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expect(html).toContain("Private-readiness review handoff");
    expect(html).toContain("Review scope");
    expect(html).toContain("binance_usd_m_futures / BTCUSDT / perpetual_futures");
    expect(html).toContain("Latest posture");
    expect(html).toContain("Posture delta");
    expect(html).toContain("previous=fixture-binance-btcusdt-private-readiness-posture-001, 1 changed gate");
    expect(html).toContain("Policy summary");
    expect(html).toContain("status=not_ready, blocking_conditions=5, required_next_actions=6");
    expect(html).toContain("Required next actions");
    expect(html).toContain("configure_private_read_credentials, configuration, operator_approval, +3 more");
    expect(html).toContain("Review checklist");
    expect(html).toContain(
      "inspect_latest_posture, review_posture_delta, review_policy_impact, resolve_required_next_actions, keep_no_authority_boundary"
    );
    expect(html).toContain("review_handoff_only_not_counted_evidence_or_promotion");
    expect(html).toContain("Private-readiness authority gate preview");
    expect(html).toContain("Private-read authority");
    expect(html).toContain("private_read_authority=not_granted, policy_status=not_ready, authority_status=not_live");
    expect(html).toContain("Gate readiness");
    expect(html).toContain("ready=2, not_ready=8, review_required=1, blocked=0");
    expect(html).toContain("Blocking conditions");
    expect(html).toContain(
      "configuration: no_binance_api_key_configured, operator_approval: operator_live_private_read_approval_missing, jurisdiction_risk: operator_jurisdiction_not_recorded, +2 more"
    );
    expect(html).toContain("Preview next step");
    expect(html).toContain("resolve_blocking_conditions, complete_required_next_actions, keep_authority_status_not_live");
    expect(html).toContain("authority_gate_preview_only_not_private_read_permission_or_execution_authority");
    expect(html).toContain("Private-readiness checked-gate matrix");
    expect(html).toContain("configuration");
    expect(html).toContain("not_ready");
    expect(html).toContain("configuration_not_ready");
    expect(html).toContain("no_binance_api_key_configured");
    expect(html).toContain("blocking_gate");
    expect(html).toContain("jurisdiction_risk");
    expect(html).toContain("jurisdiction_review_required");
    expect(html).toContain("review_required_gate");
    expect(html).toContain("kill_switch");
    expect(html).toContain("ready_gate");
    expect(html).toContain("checked_gate_matrix_inspection_only");
    expect(html).toContain("Private-readiness remediation/action map");
    expect(html).toContain("configure_private_read_credentials");
    expect(html).toContain("checked_gate: configuration");
    expect(html).toContain("not_ready / blocking_gate");
    expect(html).toContain("configuration_not_ready");
    expect(html).toContain("read_only_remediation_guidance");
    expect(html).toContain("remediation_action_map_guidance_only");
    expect(html).toContain("Private-readiness remediation progress summary");
    expect(html).toContain("required_actions=6, mapped_actions=6, unmapped_actions=0");
    expect(html).toContain("blocking_review_focus=6");
    expect(html).toContain("next_review_focus=configure_private_read_credentials -&gt; checked_gate: configuration");
    expect(html).toContain("remediation_progress_summary_guidance_only");
    expect(html).toContain("USER_DATA, USER_STREAM, TRADE");
    expect(html).toContain("configuration_not_ready");
    expect(html).toContain("secret_handling_not_ready");
    expect(html).toContain("no_private_read_performed=true");
    expect(html).toContain("signed_request_authority=false");
    expect(html).toContain("transport_only");
    expect(html).toContain("fixture_seed_no_private_authority");
    expect(html).toContain(BINANCE_NO_AUTHORITY_LABEL);
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders an empty checked-gate matrix from a policy decision without posture context", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: null,
            private_readiness_posture_history: [],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision({
              checked_gates: [],
              reason_codes: ["no_private_read_performed"],
              blocking_conditions: [],
              required_next_actions: []
            }),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private-readiness checked-gate matrix");
    expect(html).toContain("Private-readiness review packet index");
    expect(html).toContain("review_packet_index_policy_only_posture_context_missing");
    expect(html).toContain("01 policy_impact_interpretation");
    expect(html).toContain("07 remediation_progress_summary");
    expect(html).toContain("review_packet_index_navigation_only");
    expect(html).toContain("Private-readiness review packet availability summary");
    expect(html).toContain(
      "availability_summary=available_for_review=0, needs_posture_context=3, no_current_items=3, policy_context_available=1"
    );
    expect(html).toContain("policy_decision_available_posture_input_missing");
    expect(html).toContain("latest_posture_required_for_delta");
    expect(html).toContain("latest_posture_required_for_review_handoff");
    expect(html).toContain("latest_posture_required_for_authority_preview");
    expect(html).toContain("checked_gates_empty");
    expect(html).toContain("required_next_actions_empty");
    expect(html).toContain("review_packet_availability_summary_navigation_only");
    expect(html).toContain("Private-readiness review packet gap summary");
    expect(html).toContain(
      "gap_summary=needs_posture_context=3, no_current_items=3, policy_context_available=1"
    );
    expect(html).toContain(
      "next_gap_focus=02 posture_delta_summary -&gt; latest_posture_required_for_delta"
    );
    expect(html).toContain("review_packet_availability_gaps_present");
    expect(html).toContain("review_packet_gap_summary_navigation_only");
    expect(html).toContain("Private-readiness review packet resolution checklist");
    expect(html).toContain(
      "resolution_checklist=availability_gaps=6, remediation_actions=0, policy_context_available=1, total_items=6"
    );
    expect(html).toContain(
      "next_resolution_focus=02 posture_delta_summary -&gt; latest_posture_required_for_delta"
    );
    expect(html).toContain("resolution_checklist_availability_gaps_present");
    expect(html).toContain("requires_posture_context");
    expect(html).toContain("confirm_empty_review_state");
    expect(html).toContain("review_packet_resolution_checklist_navigation_only");
    expect(html).toContain("Private-readiness review packet source/provenance summary");
    expect(html).toContain(
      "source_provenance=policy_refs=2, posture_refs=0, previous_posture_refs=0, projection_rows=7"
    );
    expect(html).toContain(
      "next_source_focus=02 posture_delta_summary -&gt; private_readiness_posture_history"
    );
    expect(html).toContain("source_provenance_policy_only_posture_context_missing");
    expect(html).toContain("latest_posture_not_available");
    expect(html).toContain("review_packet_source_provenance_navigation_only");
    expect(html).toContain("Private-readiness review packet completion/readiness summary");
    expect(html).toContain(
      "completion_readiness=review_surfaces=7, availability_gaps=6, source_gaps=2, resolution_items=6, remediation_actions=0"
    );
    expect(html).toContain(
      "next_completion_focus=02 posture_delta_summary -&gt; latest_posture_required_for_delta"
    );
    expect(html).toContain("completion_readiness_policy_only_posture_context_missing");
    expect(html).toContain("read_only_completion_readiness_context");
    expect(html).toContain("review_packet_completion_readiness_navigation_only");
    expect(html.indexOf("Private-readiness review packet completion/readiness summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet index")
    );
    expect(html.indexOf("Private-readiness review packet index")).toBeLessThan(
      html.indexOf("Private-readiness review packet availability summary")
    );
    expect(html.indexOf("Private-readiness review packet availability summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet gap summary")
    );
    expect(html.indexOf("Private-readiness review packet gap summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet resolution checklist")
    );
    expect(html.indexOf("Private-readiness review packet resolution checklist")).toBeLessThan(
      html.indexOf("Private-readiness review packet source/provenance summary")
    );
    expect(html).toContain("no_checked_gates");
    expect(html).toContain("Private-readiness remediation/action map");
    expect(html).toContain("no_required_next_actions");
    expect(html).toContain("Private-readiness remediation progress summary");
    expect(html).toContain("required_actions=0, mapped_actions=0, unmapped_actions=0");
    expect(html).toContain("blocking_review_focus=0");
    expect(html).toContain("next_review_focus=no_required_next_actions");
    expect(html).toContain("no_remediation_progress_actions");
    expect(html).toContain("remediation_action_map_guidance_only");
    expect(html).toContain("checked_gate_matrix_inspection_only");
    expect(html).toContain("not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders unmatched private-readiness remediation actions without authority controls", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: null,
            private_readiness_posture_history: [],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision({
              blocking_conditions: ["configuration: no_binance_api_key_configured"],
              required_next_actions: ["manual_tax_review"]
            }),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private-readiness remediation/action map");
    expect(html).toContain("manual_tax_review");
    expect(html).toContain("unmapped_action");
    expect(html).toContain("no_matching_gate_or_blocker");
    expect(html).toContain("read_only_remediation_guidance");
    expect(html).toContain("Private-readiness remediation progress summary");
    expect(html).toContain("required_actions=1, mapped_actions=0, unmapped_actions=1");
    expect(html).toContain("blocking_review_focus=0");
    expect(html).toContain("next_review_focus=manual_tax_review -&gt; unmapped_action");
    expect(html).toContain("remediation_action_map_guidance_only");
    expect(html).toContain("remediation_progress_summary_guidance_only");
    expect(html).toContain("not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders the review packet section stack from its projection without the full candidate detail", () => {
    const projection = buildPrivateReadinessReviewPacketProjection({
      decision: fixturePrivateReadinessPolicyDecision(),
      posture: fixturePrivateReadinessPosture({
        posture_id: "local-binance-btcusdt-private-readiness-posture-history-002"
      }),
      previousPosture: fixturePrivateReadinessPosture()
    });
    const html = renderToStaticMarkup(
      <PrivateReadinessReviewPacketSections
        postureContextAvailable
        projection={projection}
      />
    );

    expect(html).toContain("Private-readiness review packet completion/readiness summary");
    expect(html).toContain("Private-readiness review packet index");
    expect(html).toContain("Private-readiness review packet availability summary");
    expect(html).toContain("Private-readiness review packet gap summary");
    expect(html).toContain("Private-readiness review packet resolution checklist");
    expect(html).toContain("Private-readiness review packet source/provenance summary");
    expect(html).toContain("completion_readiness_remediation_actions_present");
    expect(html).toContain("review_packet_index_ready_for_operator_scan");
    expect(html).toContain("review_packet_source_provenance_navigation_only");
    expect(html).toContain("review-packet-index-row grid min-w-0");
    expect(html).toContain("[&amp;&gt;*]:break-words");
    expect(html).toContain("not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expect(html.indexOf("Private-readiness review packet completion/readiness summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet index")
    );
    expect(html.indexOf("Private-readiness review packet index")).toBeLessThan(
      html.indexOf("Private-readiness review packet availability summary")
    );
    expect(html.indexOf("Private-readiness review packet availability summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet gap summary")
    );
    expect(html.indexOf("Private-readiness review packet gap summary")).toBeLessThan(
      html.indexOf("Private-readiness review packet resolution checklist")
    );
    expect(html.indexOf("Private-readiness review packet resolution checklist")).toBeLessThan(
      html.indexOf("Private-readiness review packet source/provenance summary")
    );
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders an unchanged posture delta summary without action controls", () => {
    const currentPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-003",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:10.000Z"
    });
    const previousPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-002",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:08.000Z"
    });
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: currentPosture,
            private_readiness_posture_history: [
              currentPosture,
              previousPosture
            ],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Posture delta summary");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-003");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-002");
    expect(html).toContain("0 changed gates");
    expect(html).toContain("Gate changes");
    expect(html).toContain("none");
    expect(html).toContain("local_config_delta_inspection_only");
    expect(html).toContain("not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders a private-readiness review handoff without previous posture history", () => {
    const localPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-004",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:12.000Z"
    });
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: localPosture,
            private_readiness_posture_history: [localPosture],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private-readiness review handoff");
    expect(html).toContain("local-binance-btcusdt-private-readiness-posture-history-004");
    expect(html).toContain("previous_posture_not_available");
    expect(html).toContain("record_previous_posture_before_delta_review");
    expect(html).toContain("review_handoff_only_not_counted_evidence_or_promotion");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders an authority gate preview with no blocking conditions or next actions", () => {
    const localPosture = fixturePrivateReadinessPosture({
      posture_id: "local-binance-btcusdt-private-readiness-posture-history-005",
      source_kind: "local_config",
      fixture_backed: false,
      updated_at: "2026-05-16T00:00:14.000Z"
    });
    const basePolicyDecision = fixturePrivateReadinessPolicyDecision();
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: localPosture,
            private_readiness_posture_history: [localPosture],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision({
              status: "ready",
              checked_gates: basePolicyDecision.checked_gates.map((gate) => ({
                ...gate,
                status: "ready" as const,
                reason_code: "ready" as const,
                reason: "ready_for_preview"
              })),
              reason_codes: ["ready", "no_private_read_performed"],
              blocking_conditions: [],
              required_next_actions: []
            }),
            latest_account_position_risk_mirror_surface: null
          }
        }}
      />
    );

    expect(html).toContain("Private-readiness authority gate preview");
    expect(html).toContain("private_read_authority=not_granted, policy_status=ready, authority_status=not_live");
    expect(html).toContain("ready=11, not_ready=0, review_required=0, blocked=0");
    expect(html).toContain("No blocking conditions");
    expect(html).toContain("none");
    expect(html).toContain("Required next actions");
    expect(html).toContain("no_blocking_conditions, no_required_next_actions, keep_authority_status_not_live");
    expect(html).toContain("authority_gate_preview_only_not_private_read_permission_or_execution_authority");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders a local private-readiness posture edit form without live authority language", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: fixturePrivateReadinessPosture(),
            private_readiness_posture_history: [fixturePrivateReadinessPosture()],
            latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
            latest_account_position_risk_mirror_surface: null
          }
        }}
        onRecordPrivateReadinessPosture={() => undefined}
        privateReadinessPostureMessage="local_config recorded: local-binance-btcusdt-private-readiness-posture-001"
      />
    );

    expect(html).toContain("Local posture edit");
    expect(html).toContain("Operator approval");
    expect(html).toContain("Jurisdiction / risk");
    expect(html).toContain("Live binding");
    expect(html).toContain("Secret handling");
    expect(html).toContain("Stop behavior");
    expect(html).toContain("Save local posture");
    expect(html).toContain("local_config / no_secret / not_live");
    expect(html).toContain("local_config recorded: local-binance-btcusdt-private-readiness-posture-001");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders Binance BTCUSDT account-position-risk mirror posture without action controls", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          trading_substrate: {
            latest_order_fill_surface: fixtureOrderFillSurface(),
            latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
            latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
            latest_private_readiness_posture: fixturePrivateReadinessPosture(),
            private_readiness_posture_history: [fixturePrivateReadinessPosture()],
            latest_account_position_risk_mirror_surface: fixtureAccountPositionRiskMirrorSurface()
          }
        }}
      />
    );

    expect(html).toContain("Account position risk mirror");
    expect(html).toContain("Binance BTCUSDT account_position_risk_mirror");
    expect(html).toContain("fixture-binance-usdt-account-mirror");
    expect(html).toContain("1250.00000000");
    expect(html).toContain("1262.50000000");
    expect(html).toContain("1100.00000000");
    expect(html).toContain("0.015");
    expect(html).toContain("65000.00000000");
    expect(html).toContain("65833.33333333");
    expect(html).toContain("42000.00000000");
    expect(html).toContain("987.50000000");
    expect(html).toContain("cross");
    expect(html).toContain("watch");
    expect(html).toContain("inactive");
    expect(html).toContain("not_paused");
    expect(html).toContain("GET /fapi/v3/account");
    expect(html).toContain("GET /fapi/v3/positionRisk");
    expect(html).toContain("POST /fapi/v1/leverage");
    expect(html).toContain("POST /fapi/v1/marginType");
    expect(html).toContain("mirror_is_fixture_backed_no_signed_user_data_read");
    expect(html).toContain("fixture_seed_no_private_account_or_position_read");
    expect(html).toContain("transport_only");
    expect(html).toContain(BINANCE_NO_AUTHORITY_LABEL);
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders candidate-level latest validation state in the sidebar row and detail header", () => {
    const candidate: CandidateInspectReadModel = {
      ...fixtureCandidate,
      latest_validation_state: candidateLatestValidationState()
    };
    const rowHtml = renderToStaticMarkup(
      <CandidateSummaryRow
        active
        candidate={candidate}
        onSelectCandidate={() => undefined}
      />
    );
    const detailHtml = renderToStaticMarkup(<CandidateDetail candidate={candidate} />);

    expect(rowHtml).toContain("latest validation state: passes_replay_checks");
    expect(rowHtml).toContain("active");
    expect(detailHtml).toContain("Latest validation state");
    expect(detailHtml).toContain("Candidate latest validation state");
    expect(detailHtml).toContain("latest-replay-run");
    expect(detailHtml).toContain("baseline-replay-run");
    expect(detailHtml).toContain("validation_state_not_authority");
    const candidateValidationSection = extractCandidateLatestValidationStateSection(detailHtml);
    expect(candidateValidationSection).toContain("Candidate validation authority");
    expect(candidateValidationSection).toContain("Candidate validation no authority");
    expect(candidateValidationSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expect(detailHtml).toContain("live_exchange=false, order_authority=false, credentials=false, paper_trading=false");
    expectNoOperatorActionControls(detailHtml, { includePrivateAuthorityTerms: true });
  });

  it("renders backtest, paper, and live execution mode contracts without action controls", () => {
    const html = renderToStaticMarkup(
      <TradingExecutionModesSection modes={tradingExecutionModes()} />
    );

    expect(html).toContain("Backtest / paper / live contract");
    expect(html).toContain("Backtest replay");
    expect(html).toContain("historical_replay");
    expect(html).toContain("order_validation_only");
    expect(html).toContain("Paper trading");
    expect(html).toContain("paper_order_sink");
    expect(html).toContain("paper_only");
    expect(html).toContain("Live disabled");
    expect(html).toContain("gated_live_order_gateway");
    expect(html).toContain("live_disabled");
    expect(html).toContain("TradingApiProvider");
    expect(html).toContain("forbidden");
    const executionModesSection = extractExecutionModesSection(html);
    expect(executionModesSection).toContain("Execution mode");
    expect(executionModesSection).not.toMatch(/<dt[^>]*>Mode<\/dt>/);
    expect(executionModesSection).toContain("Execution mode authority");
    expect(executionModesSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expect(executionModesSection).toContain('data-operator-ui="evidence-stack"');
    expect(executionModesSection).toContain('data-operator-ui="evidence-block"');
    expect(executionModesSection).toContain('data-operator-ui="evidence-status"');
    expect(executionModesSection).toContain('data-operator-ui="evidence-row"');
    expect(executionModesSection).not.toContain('class="execution-mode-card');
    expect(executionModesSection).not.toContain('class="execution-mode-card-header');
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders replay-run evidence without implying trading authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[
          replayRun({
            run_id: "s18-01-sdx-candidate-id-smoke",
            runner_kind: "docker_sandboxes_sbx",
            runner_command_total: 10
          }),
          replayRun({
            run_id: "s18-01-host-candidate-id-proof",
            runner_kind: "host_process",
            runner_command_total: 0,
            completed_at: "2026-05-13T14:51:42.271Z"
          })
        ]}
      />
    );

    const candidateRunsSection = extractCandidateRunsSection(html);
    expect(candidateRunsSection).toContain("Candidate Runs");
    expect(candidateRunsSection).toContain("Candidate-id replay evidence");
    expect(candidateRunsSection).toContain("s18-01-sdx-candidate-id-smoke");
    expect(candidateRunsSection).toContain("Replay runner");
    expect(candidateRunsSection).not.toContain(">Runner<");
    expect(candidateRunsSection).toContain("docker_sandboxes_sbx");
    expect(candidateRunsSection).toContain("2/2 accepted");
    expect(candidateRunsSection).toContain("Provider requests");
    expect(candidateRunsSection).toContain("Replay runner commands");
    expect(candidateRunsSection).toContain("sha256:fadd2155");
    expect(candidateRunsSection).toContain('data-operator-ui="evidence-block"');
    expect(candidateRunsSection).toContain('data-operator-ui="evidence-stack"');
    expect(candidateRunsSection).toContain('data-operator-ui="evidence-row"');
    expect(candidateRunsSection).not.toContain('class="evaluation-block"');
    expect(candidateRunsSection).not.toContain("run-history-list");
    expect(candidateRunsSection).not.toContain("run-history-row");
    expect(candidateRunsSection).toContain("Replay authority");
    expect(candidateRunsSection).not.toContain(">Authority<");
    expect(candidateRunsSection).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders replay-run detail evidence without adding authority actions", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[replayRun({ run_id: "replay-run-detail" })]}
        replayRunDetail={replayRunDetail({ run_id: "replay-run-detail" })}
      />
    );

    expect(html).toContain("Selected run detail");
    expect(html).toContain("replay-run-detail");
    expect(html).toContain("1 / valid_order_request");
    expect(html).toContain("live_exchange=false, order_authority=false, credentials=false, paper_trading=false");
    const replayDetailSection = extractReplayRunDetailSection(html);
    expect(replayDetailSection).toContain("Replay detail no authority");
    expect(replayDetailSection).toContain("Replay scenario runner");
    expect(replayDetailSection).toContain("Replay scenario runner commands");
    expect(replayDetailSection).not.toContain(">Runner<");
    expect(replayDetailSection).not.toContain(">No authority<");
    expect(html).toContain("promotion-detail");
    expect(html).toContain("research-detail");
    expect(html).toContain("trend_long");
    expect(html).toContain("Accepted order request with score 1.000.");
    expect(html).toContain("Metric provider_boundary");
    expect(html).toContain("0.2: market/account/order validation went through the external provider");
    expect(html).toContain("sbx version");
    expect(html).toContain("not_live");
    expect(replayDetailSection).toContain('data-operator-ui="evidence-block"');
    expect(replayDetailSection).toContain('data-operator-ui="evidence-row"');
    expect(replayDetailSection).not.toContain('class="evaluation-block"');
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders selectable replay-run history with non-latest detail selected", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[
          replayRun({
            run_id: "latest-run",
            runner_kind: "host_process",
            completed_at: "2026-05-14T12:00:00.000Z"
          }),
          replayRun({
            run_id: "older-sdx-run",
            runner_kind: "docker_sandboxes_sbx",
            runner_command_total: 4,
            completed_at: "2026-05-14T11:00:00.000Z"
          })
        ]}
        selectedReplayRunId="older-sdx-run"
        replayRunDetail={replayRunDetail({
          run_id: "older-sdx-run",
          runner_kind: "docker_sandboxes_sbx"
        })}
        onSelectReplayRun={() => undefined}
      />
    );

    expect(html).toContain("Latest run");
    expect(html).toContain("latest-run");
    expect(html).toContain("Selected run");
    expect(html).toContain("older-sdx-run");
    expect(html).toContain("Run history");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain('data-operator-ui="evidence-stack"');
    const runHistorySection = extractReplayRunHistorySection(html);
    expect(runHistorySection).not.toContain("bg-background/35");
    expect(runHistorySection).not.toContain("ring-border/30");
    expect(html).not.toContain("run-history-list");
    expect(html).not.toContain("run-history-row");
    expect(html).toContain("docker_sandboxes_sbx");
    expect(html).toContain("Selected run detail");
    expect(html).toContain("trend_long");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders selected replay-run comparison as non-authority evidence", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[
          replayRun({
            run_id: "latest-run",
            completed_at: "2026-05-14T12:00:00.000Z"
          }),
          replayRun({
            run_id: "baseline-run",
            completed_at: "2026-05-14T11:00:00.000Z"
          })
        ]}
        selectedReplayRunId="latest-run"
        replayRunDetail={replayRunDetail({ run_id: "latest-run" })}
        replayRunComparison={replayRunComparison({
          selected: {
            ...replayRunComparison().selected,
            run_id: "latest-run"
          },
          baseline: {
            ...replayRunComparison().baseline,
            run_id: "baseline-run"
          }
        })}
        replayRunComparisonBaselineId="baseline-run"
        replayRunValidationState={replayRunValidationState({
          selected_run_id: "latest-run",
          baseline_run_id: "baseline-run"
        })}
      />
    );

    expect(html).toContain("Run comparison");
    expect(html).toContain("Selected vs baseline replay evidence");
    expect(html).toContain("improved");
    expect(html).toContain("comparison_not_authority");
    expect(html).toContain("latest-run");
    expect(html).toContain("baseline-run");
    expect(html).toContain("+0.25");
    expect(html).toContain("+1");
    expect(html).toContain("valid_order_request -&gt; valid_order_request");
    const replayComparisonSection = extractReplayRunComparisonSection(html);
    expect(replayComparisonSection).toContain("Replay comparison authority");
    expect(replayComparisonSection).toContain("Replay comparison no authority");
    expect(replayComparisonSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expect(replayComparisonSection).toContain('data-operator-ui="evidence-block"');
    expect(replayComparisonSection).toContain('data-operator-ui="evidence-status"');
    expect(replayComparisonSection).toContain('data-operator-ui="evidence-row"');
    expect(replayComparisonSection).not.toContain('class="evaluation-block"');
    expect(replayComparisonSection).not.toContain('class="evaluation-status');
    expect(html).toContain("Validation state");
    expect(html).toContain("Read-only validation state");
    expect(html).toContain("validation_state_not_authority");
    const replayValidationSection = extractReplayRunValidationStateSection(html);
    expect(replayValidationSection).toContain("Replay validation authority");
    expect(replayValidationSection).toContain("Replay validation no authority");
    expect(replayValidationSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expect(replayValidationSection).toContain('data-operator-ui="evidence-block"');
    expect(replayValidationSection).toContain('data-operator-ui="evidence-status"');
    expect(replayValidationSection).toContain('data-operator-ui="evidence-row"');
    expect(replayValidationSection).not.toContain('class="evaluation-block"');
    expect(replayValidationSection).not.toContain('class="evaluation-status');
    expect(html).toContain("human review of replay evidence; future promotion issue with explicit authority scope");
    expect(html).toContain("live_exchange=false, order_authority=false, credentials=false, paper_trading=false");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders no-baseline replay-run comparison state without authority actions", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={fixtureCandidate}
        replayRuns={[replayRun({ run_id: "single-run" })]}
        selectedReplayRunId="single-run"
        replayRunDetail={replayRunDetail({ run_id: "single-run" })}
        replayRunValidationState={replayRunBaselineRequiredPosture("single-run")}
      />
    );

    expect(html).toContain("Run comparison");
    expect(html).toContain("No comparison baseline");
    expect(html).toContain("single replay-run history");
    expect(html).toContain("comparison_not_authority");
    const replayComparisonSection = extractReplayRunComparisonSection(html);
    expect(replayComparisonSection).toContain('data-operator-ui="empty-state"');
    expect(replayComparisonSection).not.toContain('class="evaluation-block"');
    expect(replayComparisonSection).not.toContain('class="placeholder"');
    expect(html).toContain("Validation state");
    expect(html).toContain("comparison_required");
    expect(html).toContain("record at least one baseline replay run; compare selected run against baseline before posture review");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders promoted local candidate bundles as read-only replay candidates", () => {
    const candidate = promotedCandidate();
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidate}
        onRunCandidateReplay={() => undefined}
        replayRuns={[
          replayRun({
            candidate_id: candidate.candidate_id,
            run_id: "promoted-sdx-run",
            runner_kind: "docker_sandboxes_sbx",
            runner_command_total: 10
          })
        ]}
      />
    );

    expect(html).toContain("Promoted local candidate bundle");
    expect(html).toContain("local_promoted_candidate_bundle");
    expect(html).toContain("Trading System bundle");
    expect(html).toContain("materialized");
    expect(html).toContain("External trading API provider / Trading system");
    expect(html).toContain("docker_sandboxes_sbx");
    expect(html).toContain("Run replay");
    expect(html).toContain("host_process / replay_only / not_live");
    const candidateRunsSection = extractCandidateRunsSection(html);
    expect(candidateRunsSection).toContain('data-operator-ui="action-row"');
    expect(candidateRunsSection).not.toContain('class="runtime-command');
    expect(html).toContain("No ResearchPreflight runs");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
    expect(html).not.toMatch(/Run trading loop|Record pause control/i);
  });

  it("renders Ledger state without implying live authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))}
        tradingGatewayEnvironment={tradingGatewayEnvironment()}
        onStartTradingRun={() => undefined}
        onObserveTradingRun={() => undefined}
        onStopTradingRun={() => undefined}
        tradingRunMessage="dry_run_only recorded: execution-result-001"
      />
    );

    expect(html).toContain("Trading gateway environment");
    expect(html).toContain("paper / mlp_policy");
    expect(html).toContain("Gateway locked / runtime_binding_policy");
    expect(html).toContain("https://fapi.binance.com");
    expect(html).toContain("fake_paper_account");
    expect(html).toContain("fake_paper_order_executor");
    expect(html).toContain("live_gateway_not_enabled_in_mlp");
    expect(html).toContain("api_key=true");
    expect(html).toContain("api_secret=true");
    expect(html).toContain("live_exchange=false");
    const gatewayEnvironmentSection = extractTradingGatewayEnvironmentSection(html);
    expect(gatewayEnvironmentSection).toContain("Gateway environment authority");
    expect(gatewayEnvironmentSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    const tradingRunSection = extractTradingRunSection(html);
    expect(tradingRunSection).toContain("Trading run authority");
    expect(tradingRunSection).toContain("Memory authority");
    expect(tradingRunSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expect(html).toContain("Ledger");
    expect(html).toContain("Ledger");
    expect(html).toContain("chain complete");
    expect(html).toContain("Order request");
    expect(html).toContain("place_order");
    expect(html).toContain("Order side / type");
    expect(html).not.toContain(">Side / type<");
    const ledgerSection = extractLedgerSection(html);
    expect(ledgerSection).toContain("Order request authority");
    expect(ledgerSection).toContain("Gateway result authority");
    expect(ledgerSection).toContain("Execution result mode");
    expect(ledgerSection).toContain("Execution result authority");
    expect(ledgerSection).toContain("Ledger chain authority");
    expect(ledgerSection).not.toMatch(/<dt[^>]*>Mode<\/dt>/);
    expect(ledgerSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expect(html).toContain("buy / limit");
    expect(html).toContain("Gateway result");
    expect(html).toContain("dry_run_only");
    expect(html).toContain("paper_stage_only");
    expect(html).toContain("order_request:order-request-001");
    expect(html).toContain("Execution result");
    expect(html).toContain("gateway_result:gateway-result-001");
    expect(html).toContain("Trading Run Transcript");
    expect(html).toContain("Sandbox heartbeat");
    expect(html).toContain("Order request");
    expect(html).toContain("Gateway result");
    expect(html).toContain("Sandbox");
    const sandboxSection = extractSandboxSection(html);
    expect(sandboxSection).toContain("Sandbox authority");
    expect(sandboxSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    const transcriptSection = extractTradingRunTranscriptSection(html);
    expect(transcriptSection).toContain("Transcript authority");
    expect(transcriptSection).toContain("Transcript event authority");
    expect(transcriptSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expect(html).toContain("deterministic_test");
    expect(html).toContain("sandbox-running-fixture");
    expect(html).toContain("runtime_heartbeat");
    expect(html).toContain("Start trading run");
    expect(html).toContain("Observe");
    expect(html).toContain("Stop");
    expect(html).not.toContain("Compatibility detail");
    expect(html).not.toContain("runtime.ledger");
    expect(html).toContain("not_live");
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true,
      allowTradingRunControls: true
    });
  });

  it("renders a one-click full cycle action over the canonical flow", () => {
    const candidate = {
      ...candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    };
    const tradingHtml = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
        onRunFullCycle={() => undefined}
        fullCycleMessage="full cycle completed: running"
      />
    );
    const arenaHtml = renderToStaticMarkup(
      <CandidateDetail
        activeView="arena"
        candidate={candidate}
        candidateArena={fixtureCandidateArena}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: "candidate-profitable",
          selected_candidate: arenaSelectedCandidate(),
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperTradingEvaluationFixture(),
          paper_trading_board: paperTradingBoardFixture(),
          trading_review: tradingReviewFixture(),
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
        onStartCandidateArena={() => undefined}
        onStopCandidateArena={() => undefined}
        onTickCandidateArena={() => undefined}
        onSelectCandidate={() => undefined}
        onStartTradingRun={() => undefined}
        onObserveTradingRun={() => undefined}
        onStopTradingRun={() => undefined}
      />
    );
    const researchHtml = renderToStaticMarkup(
      <CandidateDetail
        activeView="research"
        candidate={candidate}
        lastFullCycle={fullCycleOutcome(candidate)}
      />
    );
    const detailsHtml = renderToStaticMarkup(
      <CandidateDetail
        activeView="details"
        candidate={candidate}
        executionModes={tradingExecutionModes()}
        onRunFullCycle={() => undefined}
        fullCycleMessage="full cycle completed: running"
      />
    );

    expect(tradingHtml).toContain("BTCUSDT operator cockpit");
    expect(tradingHtml).toContain("Trading");
    expect(tradingHtml).toContain("Arena");
    expect(tradingHtml).toContain("Research");
    expect(tradingHtml).toContain("Details");
    expect(tradingHtml).toContain("overflow-x-auto");
    expect(tradingHtml).toContain("overscroll-x-contain");
    expect(tradingHtml).toContain("Recommended action");
    expect(tradingHtml).not.toContain("Run next cycle");
    expect(tradingHtml).not.toContain("Research iterations");
    expect(tradingHtml).toContain("Trading cockpit");
    expect(tradingHtml).toContain("Trading promotion boundary");
    expect(tradingHtml).toContain("Trading review candidate");
    expect(tradingHtml).toContain("not_promoted");
    expect(tradingHtml).toContain("paper_required");
    expect(tradingHtml).toContain("Move to Trading review");
    expect(tradingHtml).toContain("mlp_paper_only");
    expect(tradingHtml).toContain("BTCUSDT futures chart");
    expect(tradingHtml).toContain("Paper risk equity");
    expect(tradingHtml).toContain("Paper score");
    expect(tradingHtml).toContain("Paper risk position");
    expect(tradingHtml).toContain("Review readiness");
    expect(tradingHtml).toContain("Trading paper readback");
    expect(tradingHtml).toContain("Trading review evidence");
    expect(tradingHtml).toContain("Order / trade status");
    expect(tradingHtml).toContain("OrderRequest");
    expect(tradingHtml).toContain("GatewayResult");
    expect(tradingHtml).toContain("ExecutionResult");
    expect(tradingHtml).toContain("Safety boundary");
    expect(tradingHtml).toContain("Paper Trading review cockpit");
    expect(tradingHtml).not.toContain("Actual trading");
    expect(tradingHtml).not.toContain("realized-profit");
    const decisionSection = extractOperatorDecisionBarSection(tradingHtml);
    expect(decisionSection).toContain('data-operator-ui="panel"');
    expect(decisionSection).toContain('data-operator-ui="section-header"');
    expect(decisionSection).toContain('data-operator-ui="callout"');
    expect(decisionSection).toContain('data-operator-ui="action-row"');
    expect(decisionSection).toContain('data-slot="alert"');
    expect(extractOpeningTagForAriaLabel(tradingHtml, "Operator decision bar")).toContain('data-slot="card"');
    const promotionBoundary = extractTradingPromotionBoundarySection(tradingHtml);
    expect(promotionBoundary).toContain('data-operator-ui="panel"');
    expect(promotionBoundary).toContain('data-operator-ui="section-header"');
    expect(promotionBoundary).toContain('data-operator-ui="action-row"');
    expect(extractOpeningTagForAriaLabel(tradingHtml, "Trading promotion boundary")).toContain('data-slot="card"');
    const safetyBoundary = extractSafetyBoundarySection(tradingHtml);
    expect(safetyBoundary).toContain('data-operator-ui="panel"');
    expect(safetyBoundary).toContain('data-operator-ui="action-row"');
    expect(extractOpeningTagForAriaLabel(tradingHtml, "Safety boundary")).toContain('data-slot="card"');
    expect(extractOpeningTagForAriaLabel(tradingHtml, "Trading cockpit")).not.toContain('data-slot="card"');
    const futuresChart = extractTradingChartSection(tradingHtml);
    expect(futuresChart).toContain('data-operator-ui="panel"');
    expect(futuresChart).toContain('data-operator-ui="section-header"');
    expect(futuresChart).toContain('data-operator-ui="field"');
    expect(futuresChart).toContain('data-operator-ui="stat"');
    expect(futuresChart).toContain('data-slot="card"');
    const paperReadback = extractTradingPaperReadbackSection(tradingHtml);
    expect(paperReadback).toContain('data-operator-ui="panel"');
    expect(paperReadback).toContain('data-operator-ui="section-header"');
    expect(paperReadback).toContain('data-operator-ui="field"');
    expect(extractOpeningTagForAriaLabel(tradingHtml, "Trading paper readback")).toContain('data-slot="card"');
    const tradeStatus = extractTradeStatusSection(tradingHtml);
    expect(tradeStatus).toContain('data-operator-ui="panel"');
    expect(tradeStatus).toContain('data-operator-ui="section-header"');
    expect(tradeStatus).toContain('data-operator-ui="stat"');
    expect(tradeStatus).toContain('data-slot="card"');
    expect(tradingHtml).not.toContain("Candidate Arena cockpit");
    expect(tradingHtml).not.toContain("Runtime command bar");
    expect(tradingHtml).not.toContain("Paper Board");
    expect(tradingHtml).not.toContain("full cycle completed: running");
    expect(tradingHtml).not.toContain("Research cycle");

    expect(arenaHtml).toContain("Candidate Arena");
    expect(arenaHtml).toContain("Candidate Arena cockpit");
    expect(arenaHtml).toContain("Arena command bar");
    expect(arenaHtml).not.toContain("Runtime command bar");
    expect(arenaHtml).toContain("ResearchPreflight leaderboard");
    expect(arenaHtml).not.toContain("Revenue-cost leaderboard");
    expect(arenaHtml).toContain("Paper Board");
    expect(arenaHtml).toContain("Paper Trading Evaluation");
    expect(arenaHtml).not.toContain(">PaperTradingEvaluation<");
    expect(arenaHtml).toContain("Observe now");
    expect(arenaHtml).toContain("Stop paper trading");
    expect(arenaHtml).toContain("ResearchPreflight");
    expect(arenaHtml).toContain("Research leaderboard");
    expect(arenaHtml).not.toContain(">Evaluation<");
    expect(arenaHtml).not.toContain("profit_loss");
    expect(arenaHtml).not.toContain("Trading cockpit");
    expect(arenaHtml).not.toContain("Research cycle");
    expect(arenaHtml).not.toContain("Agent cycle controls");

    expect(researchHtml).toContain("Research");
    expect(researchHtml).toContain("Research cycle");
    expect(researchHtml).toContain("Research signals");
    expect(researchHtml).not.toContain("System performance");
    expect(researchHtml).toContain("Research-facing quality, risk posture, and packet signal for the next candidate cycle.");
    expect(researchHtml).toContain("Trading review signal");
    expect(researchHtml).not.toContain("Operator decision");
    expect(researchHtml).not.toContain("next action for the operator");
    expect(researchHtml).toContain("How CandidateArena evidence, ResearchPreflight, and lineage prepare the next TradingSystem candidate cycle.");
    expect(researchHtml).toContain(">ResearchPreflight<");
    expect(researchHtml).not.toContain(">Evaluation<");
    expect(researchHtml).toContain("Candidate handoff");
    expect(researchHtml).not.toContain("Improvement output");
    expect(researchHtml).toContain("ResearchPreflight score");
    expect(researchHtml).toContain("ResearchPreflight status");
    const researchSignals = extractResearchSignalsSection(researchHtml);
    expect(researchSignals).toContain('data-operator-ui="panel"');
    expect(researchSignals).toContain('data-operator-ui="section-header"');
    expect(researchSignals).toContain('data-slot="card"');
    const researchCycle = extractResearchCycleSection(researchHtml);
    expect(researchCycle).toContain('data-operator-ui="panel"');
    expect(researchCycle).toContain('data-operator-ui="section-header"');
    expect(researchCycle).toContain('data-slot="card"');
    expect(researchHtml).not.toContain("Profit analysis");
    expect(researchHtml).toContain("Selected Trading System");
    expect(researchHtml).toContain("backtest accepted");
    expect(researchHtml).toContain("score 1.00");
    expect(researchHtml).toContain("Next cycle handoff");
    expect(researchHtml).toContain("agent handoff ready");
    expect(researchHtml).toContain("Agent generated Trading System");
    expect(researchHtml).toContain("Full-cycle lineage");
    expect(researchHtml).toContain("Source Trading System");
    expect(researchHtml).toContain("fixture-candidate-sealed-replay-001");
    expect(researchHtml).toContain("Next Trading System");
    expect(researchHtml).toContain("system-code-agent-test");
    expect(researchHtml).toContain("Backtest");
    expect(researchHtml).toContain("Paper Trading Run");
    expect(researchHtml).toContain("Ledger");
    expect(researchHtml).not.toContain("No evaluation result yet.");
    expect(researchHtml).not.toContain("Run a full cycle to produce the next System Code candidate.");
    expect(researchHtml).not.toContain("Trading cockpit");

    expect(detailsHtml).toContain("Details");
    expect(detailsHtml).toContain("Raw evidence boundary");
    expect(detailsHtml).toContain("Developer/detail records");
    expect(detailsHtml).toContain("Product decisions stay in Trading, Arena, and Research.");
    expect(detailsHtml).toContain("Product blockers stay in Trading, Arena, and Research.");
    expect(detailsHtml).toContain("No promotion authority");
    const fixtureNoticeSection = extractFixtureNoticeSection(detailsHtml);
    expect(fixtureNoticeSection).toContain('data-operator-ui="panel"');
    expect(extractOpeningTagForAriaLabel(detailsHtml, "Fixture notice")).toContain('data-slot="card"');
    const detailsBoundary = extractDetailsBoundarySection(detailsHtml);
    expect(detailsBoundary).toContain('data-operator-ui="panel"');
    expect(detailsBoundary).toContain('data-operator-ui="section-header"');
    expect(extractOpeningTagForAriaLabel(detailsHtml, "Details boundary")).toContain('data-slot="card"');
    const detailsShell = extractDetailsShellSection(detailsHtml);
    expect(detailsShell).toContain('data-operator-ui="panel"');
    expect(detailsShell).toContain('data-operator-ui="section-header"');
    expect(extractOpeningTagForAriaLabel(detailsHtml, "Details")).toContain('data-slot="card"');
    const researchPreflightDetails = extractDetailsInfoSection(detailsHtml, "ResearchPreflight Evidence");
    expect(researchPreflightDetails).toContain('data-operator-ui="panel"');
    expect(researchPreflightDetails).toContain('data-operator-ui="section-header"');
    expect(researchPreflightDetails).toContain('data-operator-ui="evidence-stack"');
    expect(researchPreflightDetails).toContain('data-operator-ui="evidence-status"');
    expect(researchPreflightDetails).toContain('data-operator-ui="evidence-block"');
    expect(researchPreflightDetails).toContain('data-operator-ui="evidence-row"');
    expect(researchPreflightDetails).not.toContain('class="evaluation-status');
    expect(researchPreflightDetails).not.toContain('class="evaluation-block"');
    expect(researchPreflightDetails).not.toContain("classification-row");
    expect(researchPreflightDetails).toContain('data-slot="card"');
    const executionModesSection = extractExecutionModesSection(detailsHtml);
    expect(executionModesSection).toContain('data-operator-ui="panel"');
    expect(executionModesSection).toContain('data-operator-ui="section-header"');
    expect(extractOpeningTagForAriaLabel(detailsHtml, "Trading execution modes")).toContain('data-slot="card"');
    const candidateRunsSection = extractCandidateRunsSection(detailsHtml);
    expect(candidateRunsSection).toContain("Replay runner");
    expect(candidateRunsSection).toContain('data-operator-ui="evidence-status"');
    expect(candidateRunsSection).toContain('data-operator-ui="empty-state"');
    expect(candidateRunsSection).not.toContain('class="evaluation-status');
    expect(candidateRunsSection).not.toContain('class="placeholder"');
    expect(candidateRunsSection).not.toContain(">Runner<");
    expect(candidateRunsSection).toContain("Replay authority");
    expect(candidateRunsSection).not.toContain(">Authority<");
    expect(detailsHtml).toContain("Agent cycle controls");
    expect(detailsHtml).toContain("Run next cycle");
    expect(detailsHtml).toContain("full cycle completed: running");
    expect(detailsHtml).toContain("Gateway");
    expect(detailsHtml).toContain("Trading System");
    expect(detailsHtml).toContain("System Code");
    expect(detailsHtml).toContain("Evaluation");
    expect(detailsHtml).toContain("Improvement");
    expect(detailsHtml).toContain("Trading Run");
    expect(detailsHtml).toContain("Sandbox");
    expect(detailsHtml).toContain("Ledger");
    const tradingRunSection = extractTradingRunSection(detailsHtml);
    expect(tradingRunSection).toContain('data-operator-ui="evidence-stack"');
    expect(tradingRunSection).toContain('data-operator-ui="evidence-status"');
    expect(tradingRunSection).toContain('data-operator-ui="evidence-row"');
    expect(tradingRunSection).toContain('data-operator-ui="action-row"');
    expect(tradingRunSection).not.toContain('class="evaluation-status');
    expect(tradingRunSection).not.toContain('class="runtime-command');
    const sandboxSection = extractSandboxSection(detailsHtml);
    expect(sandboxSection).toContain('data-operator-ui="evidence-stack"');
    expect(sandboxSection).toContain('data-operator-ui="evidence-status"');
    expect(sandboxSection).toContain('data-operator-ui="evidence-row"');
    expect(sandboxSection).not.toContain('class="evaluation-status');
    const ledgerSection = extractLedgerSection(detailsHtml);
    expect(ledgerSection).toContain('data-operator-ui="evidence-stack"');
    expect(ledgerSection).toContain('data-operator-ui="evidence-status"');
    expect(ledgerSection).toContain('data-operator-ui="evidence-block"');
    expect(ledgerSection).toContain('data-operator-ui="evidence-row"');
    expect(ledgerSection).not.toContain('class="evaluation-status');
    expect(ledgerSection).not.toContain('class="evaluation-block"');
    const runControlSection = extractDetailsInfoSection(detailsHtml, "Run Control");
    expect(runControlSection).toContain('data-operator-ui="evidence-stack"');
    expect(runControlSection).toContain('data-operator-ui="evidence-status"');
    expect(runControlSection).toContain('data-operator-ui="evidence-block"');
    expect(runControlSection).toContain('data-operator-ui="evidence-row"');
    expect(runControlSection).toContain('data-operator-ui="action-row"');
    expect(runControlSection).not.toContain('class="evaluation-status');
    expect(runControlSection).not.toContain('class="evaluation-block"');
    expect(runControlSection).not.toContain('class="runtime-command');
    const improvementSection = extractImprovementSection(detailsHtml);
    expect(improvementSection).toContain('data-operator-ui="evidence-stack"');
    expect(improvementSection).toContain('data-operator-ui="evidence-status"');
    expect(improvementSection).toContain('data-operator-ui="evidence-block"');
    expect(improvementSection).toContain('data-operator-ui="evidence-row"');
    expect(improvementSection).toContain('data-operator-ui="action-row"');
    expect(improvementSection).not.toContain('class="evaluation-status');
    expect(improvementSection).not.toContain('class="evaluation-block"');
    expect(improvementSection).not.toContain('class="runtime-command');
    const tradingRunTranscriptSection = extractDetailsInfoSection(detailsHtml, "Trading Run Transcript");
    expect(tradingRunTranscriptSection).toContain('data-operator-ui="evidence-stack"');
    expect(tradingRunTranscriptSection).toContain('data-operator-ui="evidence-status"');
    expect(tradingRunTranscriptSection).toContain('data-operator-ui="evidence-block"');
    expect(tradingRunTranscriptSection).toContain('data-operator-ui="evidence-row"');
    expect(tradingRunTranscriptSection).not.toContain('class="evaluation-status');
    expect(tradingRunTranscriptSection).not.toContain('class="evaluation-block"');
    expect(detailsHtml).not.toContain("Trading cockpit");
    expectNoOperatorActionControls(`${tradingHtml}${researchHtml}${detailsHtml}`, {
      includePrivateAuthorityTerms: true,
      allowTradingRunControls: true
    });
  });

  it("shows tab-level state badges only from OperatorReadModel state", () => {
    const operator: OperatorReadModel = {
      operator_kind: "ouroboros_operator",
      command_descriptors: [],
      candidate_arena: fixtureCandidateArena,
      selected_candidate_id: "candidate-profitable",
      selected_candidate: arenaSelectedCandidate(),
      selected_paper_evidence: {
        status: "not_run",
        ledger_chain_complete: false,
        authority_status: "not_live"
      },
      selected_paper_trading_evaluation: paperTradingEvaluationFixture(),
      paper_trading_board: paperTradingBoardFixture(),
      trading_review: tradingReviewFixture(),
      researcher_provider: {
        selected_provider: "codex",
        available_providers: ["codex", "fixture"],
        authority_status: "research_only"
      },
      agent_profiles: [{
        profile_id: "codex",
        label: "Codex",
        provider: "codex",
        status: "login_required",
        managed_home: "/tmp/ouroboros/agent-profiles/codex/home",
        managed_provider_home: "/tmp/ouroboros/agent-profiles/codex/codex-home",
        failure_reason: "codex_login_required",
        authority_status: "no_trading_authority"
      }],
      latest_commands: [],
      live_disabled: true,
      authority_status: "not_live"
    };

    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))}
        candidateArena={fixtureCandidateArena}
        operator={operator}
      />
    );
    const tabShell = html.slice(
      html.indexOf("BTCUSDT operator cockpit"),
      html.indexOf('data-slot="tabs-content"')
    );

    expect(tabShell).toContain('aria-label="Trading tab state badge"');
    expect(tabShell).toContain(">review<");
    expect(tabShell).toContain('aria-label="Arena tab state badge"');
    expect(tabShell).toContain(">collecting<");
    expect(tabShell).toContain('aria-label="Research tab state badge"');
    expect(tabShell).toContain(">provider blocked<");
    expect(tabShell).toContain('data-operator-ui="tab-badge"');
    expect(tabShell).not.toContain("rounded-sm bg-muted px-1 py-0.5");
    expect(tabShell).not.toContain('aria-label="Details tab state badge"');
  });

  it("keeps tab-level state badges absent when OperatorReadModel has no state signal", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))}
      />
    );
    const tabShell = html.slice(
      html.indexOf("BTCUSDT operator cockpit"),
      html.indexOf('data-slot="tabs-content"')
    );

    expect(tabShell).not.toContain("tab state badge");
  });

  it("shows market freshness and fixture source mode before chart movement", () => {
    const candidate = candidateWithPublicMarketSurface(fixturePublicMarketLivenessSurface({
      freshness: "stale",
      liveness: "degraded",
      degraded_reason: "fixture_seed_no_live_connector",
      source_kind: "fixture",
      fixture_backed: true,
      simulated: true
    }));

    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
      />
    );
    const provenance = extractMarketDataProvenanceSection(html);

    expect(provenance).toContain("Source mode");
    expect(provenance).toContain("fixture / simulated");
    expect(provenance).toContain("Freshness / liveness");
    expect(provenance).toContain("market stale / degraded / fixture_seed_no_live_connector");
    expect(provenance).toContain("Boundary");
    expect(provenance).toContain("paper only / live_exchange=false, order_submission=false, credentials=false");
    expect(provenance).toContain('data-operator-ui="evidence-row"');
    expect(provenance).not.toContain("bg-muted/20");
    expect(provenance).not.toContain("bg-muted/20 p-3");
    expect(html.indexOf('aria-label="Market data provenance"')).toBeLessThan(
      html.indexOf('aria-label="BTCUSDT public market snapshot"')
    );
  });

  it("labels REST market data as read-only public context instead of live chart authority", () => {
    const candidate = candidateWithPublicMarketSurface(fixturePublicMarketLivenessSurface({
      freshness: "delayed",
      liveness: "connected",
      degraded_reason: "rest_snapshot_fallback",
      source_kind: "binance_market_data_rest",
      fixture_backed: false,
      simulated: false
    }));

    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
      />
    );
    const provenance = extractMarketDataProvenanceSection(html);

    expect(provenance).toContain("Source mode");
    expect(provenance).toContain("Binance market data REST / read-only public");
    expect(provenance).toContain("Freshness / liveness");
    expect(provenance).toContain("delayed / connected / rest_snapshot_fallback");
    expect(provenance).toContain("Boundary");
    expect(provenance).toContain("paper only / live_exchange=false, order_submission=false, credentials=false");
  });

  it("labels WebSocket market data as primary read-only public context", () => {
    const candidate = candidateWithPublicMarketSurface(fixturePublicMarketLivenessSurface({
      freshness: "fresh",
      liveness: "connected",
      degraded_reason: undefined,
      source_kind: "binance_production_public_websocket",
      fixture_backed: false,
      simulated: false
    }));

    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
      />
    );
    const provenance = extractMarketDataProvenanceSection(html);

    expect(provenance).toContain("Source mode");
    expect(provenance).toContain("Binance public WebSocket / read-only public");
    expect(provenance).toContain("Freshness / liveness");
    expect(provenance).toContain("market fresh / connected");
    expect(provenance).toContain("Boundary");
    expect(provenance).toContain("paper only / live_exchange=false, order_submission=false, credentials=false");
  });

  it("shows why Trading review is blocked until paper qualification is ready", () => {
    const candidate = arenaSelectedCandidate();
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: candidate.candidate_id,
          selected_candidate: candidate,
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperTradingEvaluationFixture(),
          paper_trading_board: paperTradingBoardFixture(),
          trading_review: tradingReviewFixture(),
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
        onPromoteTradingCandidate={() => undefined}
      />
    );
    const promotionSection = extractTradingPromotionBoundarySection(html);

    expect(promotionSection).toContain("Trading review candidate");
    expect(promotionSection).toContain("Paper runner");
    expect(promotionSection).not.toContain(">Runner<");
    expect(promotionSection).toContain("Promotion condition");
    expect(promotionSection).not.toContain("Promotion next action");
    expect(promotionSection).not.toContain(">Next action<");
    expect(promotionSection).toContain("Review authority");
    expect(promotionSection).not.toContain(">Authority<");
    expect(promotionSection).toContain("collecting_evidence");
    expect(promotionSection).toContain("min_observation_count_not_met");
    expect(promotionSection).toContain("min_elapsed_ms_not_met");
    expect(promotionSection).not.toContain("Continue paper trading until the evidence window qualifies.");
    expect(promotionSection).toContain("disabled");
    expect(html).toContain("Trading review packet");
    expect(html.indexOf('aria-label="Trading review packet"')).toBeLessThan(
      html.indexOf('aria-label="Trading promotion boundary"')
    );
    const packetSection = extractTradingReviewPacketSection(html);
    expect(packetSection).toContain('data-operator-ui="panel"');
    expect(packetSection).toContain('data-operator-ui="section-header"');
    expect(packetSection).toContain("sm:grid-cols-2 xl:grid-cols-4");
    expect(packetSection).toContain('data-operator-ui="field"');
    expect(extractOpeningTagForAriaLabel(html, "Trading review packet")).toContain('data-slot="card"');
    expect(packetSection.indexOf("Packet verdict")).toBeLessThan(packetSection.indexOf("Subject"));
    expect(packetSection.indexOf("Subject")).toBeLessThan(packetSection.indexOf("Paper rank"));
    expect(packetSection.indexOf("Paper rank")).toBeLessThan(packetSection.indexOf("Blocker groups"));
    expect(packetSection.indexOf("Blocker groups")).toBeLessThan(packetSection.indexOf("Blocker detail"));
    expect(packetSection.indexOf("Blocker detail")).toBeLessThan(packetSection.indexOf("Evidence window"));
    expect(packetSection.indexOf("Evidence window")).toBeLessThan(packetSection.indexOf("Runner health"));
    expect(packetSection.indexOf("Runner health")).toBeLessThan(packetSection.indexOf("Ledger"));
    expect(packetSection.indexOf("Ledger")).toBeLessThan(packetSection.indexOf("Lineage"));
    expect(packetSection.indexOf("Lineage")).toBeLessThan(packetSection.indexOf("Packet next action"));
    expect(packetSection.indexOf("Packet next action")).toBeLessThan(packetSection.indexOf("Packet authority"));
    expect(packetSection.indexOf("Packet authority")).toBeLessThan(packetSection.indexOf("Provenance"));
    expect(packetSection.indexOf("Provenance")).toBeLessThan(packetSection.indexOf("Risk"));
    expect(packetSection).toContain("candidate-profitable / promoted May 16, 00:00 / selected matches");
    expect(packetSection).toContain("1 obs / 0 failed / 60000ms / first May 16, 00:00 / last May 16, 00:00");
    expect(packetSection).toContain("binance_production_public_websocket / websocket_primary / fresh / WS connected / marker binance-ws-aggTrade-991 / fill filled / order book synced update 11");
    expect(packetSection).toContain("equity 10004.952 USDT / available 10003.652 USDT / position long 0.001 BTCUSDT notional 65 / open 0 / fill filled");
    expect(html).toContain("Packet verdict");
    expect(html).toContain("collecting / min_observation_count_not_met");
    expect(html).toContain("Blocker detail");
    expect(html).toContain("evidence_window / collecting / min_observation_count_not_met, min_elapsed_ms_not_met");
    expect(html).toContain("Paper evidence window is not mature enough for review. / next Continue paper observations until count and elapsed-time gates qualify.");
    expect(html).toContain("Paper risk equity");
    expect(html).toContain("10,004.95 USDT");
    expect(html).toContain("paper risk account; available 10,003.65 USDT");
    expect(html).toContain("Paper score");
    expect(html).toContain("4.952 USDT");
    expect(html).toContain("Runner health");
    expect(html).toContain("active / run running / next May 16, 00:01");
    expect(html).toContain("Ledger");
    expect(html).toContain("complete_chain / chain complete");
    expect(html).toContain("gateway dry_run_only");
    expect(html).toContain("execution dry_run_recorded");
    expect(html).toContain("Lineage");
    expect(html).toContain("available / trend_following / parent candidate-parent");
    expect(html).toContain("Candidate produced non-negative net revenue after costs.");
    expect(packetSection).toContain("rank #1 / collecting_evidence / 4.952 net USDT / 1 obs / top min_observation_count_not_met / next Continue paper observations until count and elapsed-time gates qualify.");
    expect(html).toContain("Packet authority");
    expect(html).toContain("not_live / mlp_paper_only / live_exchange=false, private_read=false, order_submission=false, credentials=false");
    expect(html).toContain("Paper risk position");
    expect(html).toContain("long 0.001");
    expect(html).toContain("Trading review evidence");
    const paperReadbackSection = extractTradingPaperReadbackSection(html);
    expect(paperReadbackSection).toContain("Paper market snapshot");
    expect(paperReadbackSection).toContain("BTCUSDT 65,000 USDT @ May 16, 00:00");
    expect(paperReadbackSection).toContain("Gateway market data");
    const gatewayMarketDataField = paperReadbackSection.slice(
      paperReadbackSection.indexOf("Gateway market data"),
      paperReadbackSection.indexOf("Paper fill")
    );
    expect(gatewayMarketDataField).toContain("binance_production_public_websocket");
    expect(paperReadbackSection).toContain("Paper fill");
    expect(paperReadbackSection).toContain("filled 0.001 @ 60000");
    expect(paperReadbackSection).toContain("Public execution evidence");
    expect(paperReadbackSection).toContain("binance_production_public_websocket / websocket_primary / fresh");
    expect(paperReadbackSection).toContain("Public order book evidence");
    expect(paperReadbackSection).toContain("synced / update 11");
    expect(paperReadbackSection).not.toContain(">Market snapshot<");
    expect(paperReadbackSection).not.toContain(">Market data<");
    expect(paperReadbackSection).not.toContain(">Order book<");
  });

  it("keeps failed promotion command remediation in the Trading first viewport", () => {
    const candidate = arenaSelectedCandidate();
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: candidate.candidate_id,
          selected_candidate: candidate,
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperTradingEvaluationFixture(),
          paper_trading_board: paperTradingBoardFixture(),
          trading_review: tradingReviewFixture(),
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [{
            command_id: "command-promote-failed",
            command_kind: "trading_candidate.promote",
            status: "failed",
            requested_at: "2026-05-27T00:00:00.000Z",
            completed_at: "2026-05-27T00:00:01.000Z",
            error: "paper_trading_qualification_required",
            authority_status: "not_live"
          }],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
      />
    );
    const messagesSection = extractOperatorMessagesSection(html);

    expect(html.indexOf('aria-label="Trading review packet"')).toBeLessThan(
      html.indexOf('aria-label="Operator messages"')
    );
    expect(html.indexOf('aria-label="Operator messages"')).toBeLessThan(
      html.indexOf('aria-label="Safety boundary"')
    );
    expect(messagesSection).toContain("trading_candidate.promote");
    expect(messagesSection).toContain('data-operator-ui="panel"');
    expect(messagesSection).toContain('data-operator-ui="section-header"');
    expect(messagesSection).toContain('data-slot="card"');
    expect(messagesSection).not.toContain("rounded-md bg-muted/25 p-2");
    expect(messagesSection).not.toContain("rounded-md bg-background/55");
    expect(messagesSection).not.toContain("ring-border/30");
    expect(messagesSection).toContain("paper_trading_qualification_required");
    expect(messagesSection).toContain("Remediation group");
    expect(messagesSection).not.toContain(">Group<");
    expect(messagesSection).toContain("Visible surface");
    expect(messagesSection).not.toContain(">Surface<");
    expect(messagesSection).toContain("Remediation next step");
    expect(messagesSection).not.toContain(">Remediation<");
    expect(messagesSection).toContain("Command authority");
    expect(messagesSection).not.toContain(">Authority<");
    expect(messagesSection).toContain("Trading review promotion");
    expect(messagesSection).toContain("Trading review packet, Paper Board");
    expect(messagesSection).toContain("Review the Trading review packet blockers and Paper Board qualification before retrying promotion.");
    expect(messagesSection).toContain("not_live");
  });

  it("renders classified paper failure remediation in the Trading review packet", () => {
    const candidate = arenaSelectedCandidate();
    const latestFailure = {
      failure_kind: "public_execution_evidence_gap" as const,
      reason: "fake public execution stream unavailable",
      summary: "Paper fill or execution evidence could not be tied to public execution data.",
      next_action: "Restore public execution evidence before trusting fills or paper score.",
      authority_status: "not_live" as const
    };
    const paperEvaluation = paperTradingEvaluationFixture({
      latest_failure_reason: latestFailure.reason,
      latest_failure: latestFailure
    });
    const review = tradingReviewFixture({
      paper_trading_evaluation: paperEvaluation
    });
    review.review_packet.risk.latest_failure_reason = latestFailure.reason;
    review.review_packet.risk.latest_failure = latestFailure;

    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: candidate.candidate_id,
          selected_candidate: candidate,
          selected_paper_evidence: {
            status: "failed",
            ledger_chain_complete: false,
            failure_reason: latestFailure.reason,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperEvaluation,
          paper_trading_board: paperTradingBoardFixture(),
          trading_review: review,
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
        onPromoteTradingCandidate={() => undefined}
      />
    );

    expect(html).toContain("Paper failure");
    expect(html).toContain("public_execution_evidence_gap");
    expect(html).toContain("Paper fill or execution evidence could not be tied to public execution data.");
    expect(html).toContain("Restore public execution evidence before trusting fills or paper score.");
    expect(html).toContain("raw fake public execution stream unavailable");
  });

  it("renders no-order checkpoints as valid Trade status evidence", () => {
    const candidate = arenaSelectedCandidate();
    const paperEvaluation = paperTradingEvaluationFixture({
      ledger_chain_complete: false,
      latest_order_request_id: undefined,
      latest_gateway_outcome: undefined,
      latest_execution_status: undefined,
      latest_fill: undefined,
      latest_decision: {
        decision_kind: "hold",
        source_kind: "trading_system_decision",
        reason: "risk_window_closed",
        observed_at: "2026-05-16T00:00:03.000Z",
        authority_status: "trace_only"
      }
    });
    const review = tradingReviewFixture({
      paper_trading_evaluation: paperEvaluation
    });
    review.review_packet.ledger = {
      ...review.review_packet.ledger,
      evidence_status: "no_order_checkpoint",
      ledger_chain_complete: false,
      latest_order_request_id: undefined,
      latest_gateway_outcome: undefined,
      latest_execution_status: undefined,
      latest_decision_kind: "hold"
    };

    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: candidate.candidate_id,
          selected_candidate: candidate,
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperEvaluation,
          paper_trading_board: paperTradingBoardFixture(),
          trading_review: review,
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
      />
    );
    const tradeStatus = extractTradeStatusSection(html);

    expect(tradeStatus).toContain("no_order_checkpoint");
    expect(tradeStatus).toContain("TradingSystemDecision");
    expect(tradeStatus).toContain("hold");
    expect(tradeStatus).toContain("No order emitted");
    expect(tradeStatus).toContain("Paper order / decision");
    expect(tradeStatus).not.toContain(">Side / type<");
    expect(tradeStatus).toContain("Paper filled");
    expect(tradeStatus).not.toContain(">Filled<");
    expect(tradeStatus).toContain("Paper average price");
    expect(tradeStatus).not.toContain(">Average price<");
    expect(tradeStatus).toContain("Paper execution");
    expect(tradeStatus).not.toContain(">Execution<");
    expect(tradeStatus).toContain("not applicable");
    expect(tradeStatus).toContain("no execution expected");
    expect(tradeStatus).not.toContain("no order request");
    expect(tradeStatus).not.toContain("&gt;OrderRequest&lt;");
    expect(tradeStatus).not.toContain("&gt;GatewayResult&lt;");
    expect(tradeStatus).not.toContain("&gt;ExecutionResult&lt;");
  });

  it("does not label account-position mirror data as paper account readback", () => {
    const candidate = {
      ...arenaSelectedCandidate(),
      trading_substrate: {
        latest_order_fill_surface: fixtureOrderFillSurface(),
        latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
        latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
        latest_private_readiness_posture: fixturePrivateReadinessPosture(),
        private_readiness_posture_history: [fixturePrivateReadinessPosture()],
        latest_account_position_risk_mirror_surface: fixtureAccountPositionRiskMirrorSurface()
      }
    };
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
      />
    );

    expect(html).toContain("Paper risk equity");
    expect(html).toContain("not started");
    expect(html).toContain("Paper account waits for Trading review paper evaluation.");
    expect(html).toContain("Paper risk position");
    expect(html).toContain("no paper position");
    expect(html).not.toContain("1,250.00 USDT");
    expect(html).not.toContain("BOTH 0.015");
    expect(html).not.toContain("cross P&amp;L");
  });

  it("does not count a not-started selected paper evaluation placeholder as measured paper evidence", () => {
    const candidate = arenaSelectedCandidate();
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: candidate.candidate_id,
          selected_candidate: candidate,
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperTradingEvaluationFixture({
            evaluation_id: undefined,
            status: "not_started",
            observation_count: 0,
            paper_account_snapshot: undefined,
            latest_fill: undefined,
            latest_public_execution_snapshot: undefined
          }),
          paper_trading_board: {
            ...paperTradingBoardFixture(),
            entries: []
          },
          trading_review: tradingReviewFixture({
            status: "not_promoted",
            readiness_status: "paper_required",
            active_candidate_id: undefined,
            active_candidate_version_id: undefined,
            display_name: undefined,
            paper_trading_evaluation_id: undefined,
            paper_qualification_status: undefined,
            paper_qualification_reasons: [],
            paper_evidence_window: undefined,
            paper_profit_loss: undefined,
            paper_trading_evaluation: paperTradingEvaluationFixture({
              evaluation_id: undefined,
              status: "not_started",
              observation_count: 0,
              paper_account_snapshot: undefined,
              latest_fill: undefined,
              latest_public_execution_snapshot: undefined
            }),
            paper_board_entry: undefined,
            runner_status: undefined,
            selected_candidate_id: candidate.candidate_id,
            selected_matches_trading_review: false,
            next_action: "Promote a selected Paper Trading Evaluation candidate from Arena to Trading review."
          }),
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
      />
    );

    expect(html).toContain("Paper score");
    expect(html).toContain("not measured");
    expect(html).toContain("No paper P&amp;L series has been measured yet.");
    const paperReadbackSection = extractTradingPaperReadbackSection(html);
    expect(paperReadbackSection).toContain("Paper Trading Evaluation");
    expect(paperReadbackSection).not.toContain("Paper evaluation");
    expect(paperReadbackSection).toContain("Paper runner");
    expect(paperReadbackSection).not.toContain(">Runner<");
    expect(paperReadbackSection).toContain("Paper market snapshot");
    expect(paperReadbackSection).not.toContain(">Market snapshot<");
    expect(paperReadbackSection).toContain("Gateway market data");
    expect(paperReadbackSection).not.toContain(">Market data<");
    expect(paperReadbackSection).toContain("Paper fill");
    expect(paperReadbackSection).not.toContain("Latest fill");
    expect(paperReadbackSection).toContain("Public execution evidence");
    expect(paperReadbackSection).toContain("Public order book evidence");
    expect(paperReadbackSection).not.toContain(">Order book<");
    expect(paperReadbackSection).not.toContain("Market source");
    expect(html).toContain("not started");
    expect(html).toContain("not connected");
    expect(paperReadbackSection).toContain("not observed");
    expect(html).not.toContain("0 observations");
    expect(html).not.toContain("return 0%");
  });

  it("scopes Trading review qualification to the selected candidate when another promotion exists", () => {
    const candidate = arenaSelectedCandidate();
    const board = paperTradingBoardFixture();
    const selectedEntry = {
      ...board.entries[0],
      qualification_status: "qualified" as const,
      qualification_reasons: [],
      promotion_gate_status: "paper_evidence_recorded" as const,
      evidence_window: {
        observation_count: 30,
        elapsed_ms: 30 * 60_000,
        failed_observation_count: 0
      }
    };
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: candidate.candidate_id,
          selected_candidate: candidate,
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperTradingEvaluationFixture({
            observation_count: 30
          }),
          paper_trading_board: {
            ...board,
            entries: [selectedEntry]
          },
          trading_promotion: {
            promotion_kind: "trading_promotion",
            status: "promoted_for_trading_review",
            readiness_status: "needs_resume",
            candidate_id: "candidate-other",
            candidate_version_id: "candidate-version-other",
            display_name: "Other Trading System",
            promoted_at: "2026-05-16T00:40:00.000Z",
            paper_trading_evaluation_id: "paper-evaluation-other",
            paper_qualification_status: "needs_resume",
            paper_qualification_reasons: ["runner_inactive_for_running_evaluation"],
            runner_status: "needs_resume",
            next_action: "Resume paper trading before treating this Trading review candidate as current.",
            live_disabled_reason: "mlp_paper_only",
            authority_status: "not_live"
          },
          trading_review: tradingReviewFixture({
            readiness_status: "needs_resume",
            active_candidate_id: "candidate-other",
            active_candidate_version_id: "candidate-version-other",
            display_name: "Other Trading System",
            promoted_at: "2026-05-16T00:40:00.000Z",
            paper_trading_evaluation_id: "paper-evaluation-other",
            paper_qualification_status: "needs_resume",
            paper_qualification_reasons: ["runner_inactive_for_running_evaluation"],
            paper_trading_evaluation: paperTradingEvaluationFixture({
              evaluation_id: "paper-evaluation-other",
              candidate_id: "candidate-other",
              candidate_version_id: "candidate-version-other",
              trading_run_id: "trading-run-candidate-other"
            }),
            runner_status: "needs_resume",
            selected_candidate_id: candidate.candidate_id,
            selected_matches_trading_review: false,
            next_action: "Resume paper trading before treating this Trading review candidate as current."
          }),
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
        onPromoteTradingCandidate={() => undefined}
      />
    );
    const promotionSection = extractTradingPromotionBoundarySection(html);

    expect(promotionSection).toContain("Other Trading System");
    expect(promotionSection).toContain("Arena trend Trading System");
    expect(promotionSection).toContain("Arena selection differs");
    expect(promotionSection).toContain("runner_inactive_for_running_evaluation");
    expect(promotionSection).toContain("needs_resume");
    expect(promotionSection).toContain("Open Trading review candidate");
    expect(promotionSection).toContain("Replace Trading review target");
    expect(promotionSection).not.toContain("ready_to_promote");
  });

  it("derives Trading first-viewport recommendation from the Trading review packet", () => {
    const candidate = arenaSelectedCandidate();
    const review = tradingReviewFixture({
      readiness_status: "collecting_paper_evidence",
      paper_qualification_status: "collecting_evidence",
      paper_qualification_reasons: ["min_observation_count_not_met"],
      next_action: "Continue paper trading until the evidence window qualifies."
    });
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="trading"
        candidate={candidate}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: candidate.candidate_id,
          selected_candidate: candidate,
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperTradingEvaluationFixture(),
          paper_trading_board: paperTradingBoardFixture(),
          trading_review: review,
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
        onObserveTradingRun={() => undefined}
        onStopTradingRun={() => undefined}
      />
    );
    const decisionSection = extractOperatorDecisionBarSection(html);

    expect(decisionSection).toContain("Recommended action");
    expect(decisionSection).toContain("Continue paper trading until the evidence window qualifies.");
    expect(decisionSection).toContain("collecting / min_observation_count_not_met");
    expect(decisionSection).toContain(">Observe paper<");
    expect(decisionSection).toContain(">Stop paper<");
    expect(decisionSection).not.toContain(">Observe<");
    expect(decisionSection).not.toContain(">Stop<");
    expect(decisionSection).not.toContain("Run first cycle");
    expect(decisionSection).not.toContain("Create improvement");
    expect(decisionSection).not.toContain("Evaluate then improve");
  });

  it("renders Codex researcher selection in full-cycle developer controls", () => {
    const candidate = {
      ...candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    };
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="details"
        candidate={candidate}
        onRunFullCycle={() => undefined}
        tradingResearchRuntime={tradingResearchRuntimeFixture({
          codexReadiness: "active_verified"
        })}
        selectedTradingResearchAgent="codex"
        tradingResearchIterations={2}
      />
    );

    expect(html).toContain("aria-label=\"Researcher\"");
    expect(html).toContain("Codex");
    expect(html).toContain("Fixture");
    expect(html).toContain("aria-label=\"Research iterations\"");
    expect(html).toContain("value=\"2\"");
    expect(html).toContain("Codex researcher ready");
    expect(html).toContain("Run next cycle");
  });

  it("disables full-cycle developer action when selected Codex researcher is unavailable", () => {
    const candidate = {
      ...candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    };
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="details"
        candidate={candidate}
        onRunFullCycle={() => undefined}
        tradingResearchRuntime={tradingResearchRuntimeFixture({
          codexReadiness: "blocked_or_not_installed"
        })}
        selectedTradingResearchAgent="codex"
      />
    );

    expect(html).toContain("Codex unavailable: codex_cli_unavailable");
    expect(html).toContain("disabled");
  });

  it("counts accepted full-cycle scenarios from scenario result status", () => {
    const candidate = {
      ...candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    };
    const outcome = fullCycleOutcome(candidate);
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="research"
        candidate={candidate}
        lastFullCycle={{
          ...outcome,
          backtest: {
            ...outcome.backtest,
            scenario_results: [
              {
                scenario_id: "trend_long",
                status: "accepted",
                score: 1,
                risk_decision: "valid_order_request",
                summary: "Accepted order request."
              },
              {
                scenario_id: "range_flat",
                status: "disqualified",
                score: 0,
                risk_decision: "no_order_request",
                summary: "No order request."
              }
            ]
          }
        }}
      />
    );

    expect(html).toContain("1/2 scenarios accepted");
    expect(html).not.toContain("2/2 scenarios accepted");
  });

  it("surfaces paper evidence learning in Research without creating promotion authority", () => {
    const candidate = arenaSelectedCandidate();
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="research"
        candidate={candidate}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: fixtureCandidateArena,
          selected_candidate_id: candidate.candidate_id,
          selected_candidate: candidate,
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
            ledger_chain_count: 1,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperTradingEvaluationFixture(),
          paper_trading_board: paperTradingBoardFixture(),
          trading_review: tradingReviewFixture(),
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
      />
    );

    expect(html).toContain("Paper evidence learning");
    expect(html).toContain("Paper board rank #1");
    expect(html).toContain("Continue paper observations until count and elapsed-time gates qualify.");
    expect(html).toContain("lineage_only");
    expect(html).not.toContain("Move to Trading review");
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true,
      allowTradingRunControls: false
    });
  });

  it("surfaces finding clusters in Research without creating promotion authority", () => {
    const candidate = arenaSelectedCandidate();
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="research"
        candidate={candidate}
        operator={{
          operator_kind: "ouroboros_operator",
          command_descriptors: [],
          candidate_arena: {
            ...fixtureCandidateArena,
            finding_clusters: [
              {
                direction_kind: "trend_following",
                top_blocker: "paper_evaluation_failed",
                blocker_group_kind: "observation_quality",
                market_regime: "long",
                protocol_failure_kind: "trading_system_protocol_error",
                candidate_count: 2,
                candidate_ids: ["candidate-profitable", "candidate-protocol-failed"],
                latest_finding: "Candidate was disqualified by evaluation guardrails.",
                next_research_focus: "Inspect the latest paper failure and fix the runtime or protocol issue before review.",
                authority_status: "not_promotion_authority"
              }
            ]
          } as CandidateArenaReadModel,
          selected_candidate_id: candidate.candidate_id,
          selected_candidate: candidate,
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
            ledger_chain_count: 1,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: paperTradingEvaluationFixture(),
          paper_trading_board: paperTradingBoardFixture(),
          trading_review: tradingReviewFixture(),
          researcher_provider: {
            selected_provider: "fixture",
            available_providers: ["codex", "fixture"],
            authority_status: "research_only"
          },
          agent_profiles: [],
          latest_commands: [],
          live_disabled: true,
          authority_status: "not_live"
        } as OperatorReadModel}
      />
    );

    expect(html).toContain("Finding clusters");
    expect(html).toContain("trend_following / long");
    expect(html).toContain("paper_evaluation_failed");
    expect(html).toContain("observation_quality");
    expect(html).toContain("trading_system_protocol_error");
    expect(html).toContain("2 candidates");
    expect(html).toContain("Inspect the latest paper failure and fix the runtime or protocol issue before review.");
    expect(html).toContain("ResearchWorker input");
    expect(html).toContain("next-generation context only");
    expect(html).toContain("Cluster boundary");
    expect(html).toContain("no rank, no qualification, no Trading review blocker, no direction scheduling, no promotion");
    expect(html).toContain("not_promotion_authority");
    const findingClustersSection = extractFindingClustersSection(html);
    expect(findingClustersSection).toContain('data-operator-ui="evidence-stack"');
    expect(findingClustersSection).toContain('data-operator-ui="evidence-block"');
    expect(findingClustersSection).toContain('data-operator-ui="evidence-status"');
    expect(findingClustersSection).toContain('data-operator-ui="evidence-row"');
    expect(findingClustersSection).not.toContain("rounded-md bg-muted/25 p-3");
    expect(html).not.toContain("Move to Trading review");
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true,
      allowTradingRunControls: false
    });
  });

  it("keeps agent-created Trading System evidence visible after reload", () => {
    const candidate = candidateWithAgentCycleMaterialization(
      candidateWithSandbox(candidateWithLedgerSource(ledgerSourceRecords()))
    );
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="research"
        candidate={candidate}
      />
    );

    expect(html).toContain("Agent generated Trading System");
    expect(html).toContain("agent handoff ready");
    expect(html).toContain("backtest recorded");
    expect(html).toContain("system-code-agent-reloaded");
    expect(html).toContain("Full-cycle lineage");
    expect(html).toContain("Source Trading System");
    expect(html).toContain("fixture-candidate-sealed-replay-001");
    expect(html).toContain("Next Trading System");
    expect(html).toContain("candidate-agent-generated-reloaded");
    expect(html).toContain("Ledger chain complete");
    expect(html).not.toContain("No evaluation result yet.");
    expect(html).not.toContain("Run a full cycle to produce the next System Code candidate.");
    expectNoOperatorActionControls(html, {
      includePrivateAuthorityTerms: true,
      allowTradingRunControls: true
    });
  });

  it("keeps pending Research next-cycle state neutral instead of failed", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        activeView="research"
        candidate={fixtureCandidate}
      />
    );
    const researchCycle = extractResearchCycleSection(html);

    expect(researchCycle).toContain("Next cycle");
    expect(researchCycle).toContain("not produced");
    expect(researchCycle).toMatch(
      /data-operator-ui="evidence-status" data-tone="neutral"(?:(?!data-operator-ui="evidence-status")[\s\S])*?>Next cycle</
    );
    expect(researchCycle).not.toMatch(
      /data-operator-ui="evidence-status" data-tone="failed"(?:(?!data-operator-ui="evidence-status")[\s\S])*?>Next cycle</
    );
  });

  it("renders Improvement without promotion or trading authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithImprovementLoop(artifactImprovementLoop())}
        onRecordImprovement={() => undefined}
        improvementMessage="evaluation recorded: trading-evaluation-result-001"
      />
    );

    expect(html).toContain("Improvement");
    expect(html).toContain("automated_alignment_researcher");
    expect(html).toContain("chain complete");
    expect(html).toContain("Source finding");
    expect(html).toContain("Change proposal");
    expect(html).not.toContain("ImprovementProposal");
    expect(html).toContain("improvement-proposal-001");
    expect(html).toContain("Experiment");
    expect(html).toContain("experiment-run-001");
    expect(html).toContain("Evaluation result");
    expect(html).toContain("accepted");
    expect(html).toContain("not_counted");
    const improvementSection = extractImprovementSection(html);
    expect(improvementSection).toContain("Source finding authority");
    expect(improvementSection).toContain("Change proposal authority");
    expect(improvementSection).toContain("Materialization authority");
    expect(improvementSection).toContain("Experiment authority");
    expect(improvementSection).toContain("Evaluation result authority");
    expect(improvementSection).toContain("Improvement evidence authority");
    expect(improvementSection).toContain("Improvement promotion authority");
    expect(improvementSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expect(html).toContain("Evidence");
    expect(html).toContain("not_sealed");
    expect(html).toContain("Promotion");
    expect(html).toContain("not_promoted");
    expect(html).toContain("Record improvement");
    expect(html).not.toContain("Run improvement loop");
    expect(html).not.toContain("Run provider");
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
  });

  it("renders trading gateway environment without exposing secret values", () => {
    const html = renderToStaticMarkup(
      <TradingGatewayEnvironmentSection environment={tradingGatewayEnvironment()} />
    );

    expect(html).toContain("Trading gateway environment");
    expect(html).toContain("OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL");
    expect(html).toContain("OUROBOROS_BINANCE_API_KEY");
    expect(html).not.toContain("OUROBOROS_TRADING_GATEWAY_MODE");
    expect(html).toContain("api_secret=true");
    const gatewayEnvironmentSection = extractTradingGatewayEnvironmentSection(html);
    expect(gatewayEnvironmentSection).toContain("Gateway environment authority");
    expect(gatewayEnvironmentSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expect(html).not.toContain("secretKey");
    expect(html).not.toContain("signature=");
  });

  it("renders runtime control state and bounded pause command without implying live authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithRunControl(
          runtimeControl(),
          fixturePrivateReadinessPolicyDecision()
        )}
        onRecordRunControl={() => undefined}
        runtimeControlMessage="Run control recorded"
      />
    );

    expect(html).toContain("Run Control");
    expect(html).toContain("Private-readiness policy alignment");
    expect(html).toContain("policy_not_ready");
    expect(html).toContain("not_private_read_permission_or_execution_authority");
    expect(html).toContain("not_order_request_gateway_result_evidence_or_promotion");
    expect(html).toContain("chain complete");
    expect(html).toContain("Latest control command");
    expect(html).toContain("pause");
    expect(html).toContain("human_operator");
    expect(html).toContain("Latest control decision");
    expect(html).toContain("policy_allows_control");
    expect(html).toContain("run_control_command:run-control-command-001");
    expect(html).toContain("Latest audit event");
    expect(html).toContain("runtime_lifecycle_transitioned");
    expect(html).toContain("Record pause");
    expect(html).toContain("control_only");
    expect(html).toContain("audit_only");
    const runControlSection = extractRunControlSection(html);
    expect(runControlSection).toContain("Command authority");
    expect(runControlSection).toContain("Decision authority");
    expect(runControlSection).toContain("Audit authority");
    expect(runControlSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expectNoOperatorActionControls(html, { includePrivateAuthorityTerms: true });
    expect(html).not.toMatch(/\bKill\b/i);
  });

  it("distinguishes runtime control policy alignment states without granting authority", () => {
    const reviewRequiredHtml = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithRunControl(
          runtimeControl(),
          fixturePrivateReadinessPolicyDecision({
            status: "review_required",
            reason_codes: ["jurisdiction_review_required", "no_private_read_performed"],
            blocking_conditions: ["jurisdiction: operator_jurisdiction_requires_review"],
            required_next_actions: ["review_operator_jurisdiction"]
          })
        )}
        onRecordRunControl={() => undefined}
      />
    );

    const readyHtml = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithRunControl(
          runtimeControl(),
          fixturePrivateReadinessPolicyDecision({
            status: "ready",
            reason_codes: ["ready", "no_private_read_performed"],
            blocking_conditions: [],
            required_next_actions: []
          })
        )}
        onRecordRunControl={() => undefined}
      />
    );

    expect(reviewRequiredHtml).toContain("policy_review_required");
    expect(reviewRequiredHtml).toContain("not_private_read_permission_or_execution_authority");
    expect(reviewRequiredHtml).toContain("control_only / audit_only / not_live");
    expectNoOperatorActionControls(reviewRequiredHtml, { includePrivateAuthorityTerms: true });

    expect(readyHtml).toContain("policy_ready_but_not_live_authority");
    expect(readyHtml).toContain("not_private_read_permission_or_execution_authority");
    expect(readyHtml).toContain("control_only / audit_only / not_live");
    expectNoOperatorActionControls(readyHtml, { includePrivateAuthorityTerms: true });
  });

  it("builds fixture-safe Ledger command payloads", () => {
    const payload = ledgerCommandPayload(fixtureCandidate);
    expect(payload).toMatchObject({
      candidate_version_id: fixtureCandidate.candidate_version.candidate_version_id,
      intent: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit"
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only"
      },
      execution_result: {
        execution_mode: "host_local"
      }
    });
    expect(payload.idempotency_key).toContain("operator-web-ledger");
    expect(JSON.stringify(payload)).not.toMatch(/exchange_credentials|live_order|broker/i);
  });

  it("builds fixture-safe run control pause payloads", () => {
    const payload = runControlPausePayload(fixtureCandidate);
    expect(payload).toMatchObject({
      candidate_version_id: fixtureCandidate.candidate_version.candidate_version_id,
      command: {
        action: "pause",
        requested_lifecycle_status: "paused",
        actor_kind: "human_operator",
        reason: "operator_request"
      },
      decision: {
        decision_outcome: "allowed",
        decision_reason: "policy_allows_control",
        resulting_lifecycle_status: "paused"
      },
      audit_event: {
        event_kind: "runtime_lifecycle_transitioned"
      }
    });
    expect(payload.idempotency_key).toContain("operator-web-run-control-pause");
    expect(JSON.stringify(payload)).not.toMatch(/exchange_credentials|live_order|broker|provider_api_key/i);
  });

  it("builds fixture-safe private-readiness posture payloads", () => {
    const candidate: CandidateInspectReadModel = {
      ...fixtureCandidate,
      trading_substrate: {
        latest_order_fill_surface: fixtureOrderFillSurface(),
        latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
        latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
        latest_private_readiness_posture: fixturePrivateReadinessPosture(),
        private_readiness_posture_history: [fixturePrivateReadinessPosture()],
        latest_private_readiness_policy_decision: fixturePrivateReadinessPolicyDecision(),
        latest_account_position_risk_mirror_surface: null
      }
    };

    const draft = privateReadinessPostureDraftFromCandidate(candidate);
    const payload = privateReadinessPosturePayload(candidate, draft);
    const editedPayload = privateReadinessPosturePayload(candidate, {
      ...draft,
      operator_approval_gate: {
        status: "ready",
        reason: "operator_approval_recorded_in_local_posture_form"
      },
      secret_handling_gate: {
        status: "review_required",
        reason: "secret_handling_review_recorded_without_secret_material"
      }
    });

    expect(payload).toMatchObject({
      idempotency_key: expect.stringContaining("operator-web-private-readiness-posture"),
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      product_category: "perpetual_futures",
      operator_approval_gate: {
        status: "not_ready",
        reason: "operator_live_private_read_approval_missing"
      },
      jurisdiction_risk_gate: {
        status: "review_required",
        reason: "operator_jurisdiction_not_recorded"
      },
      secret_reference_configured: false,
      source_ref: {
        record_kind: "operator",
        id: "operator-web"
      }
    });
    expect(payload.idempotency_key).toContain("draft-");
    expect(editedPayload.idempotency_key).toContain("draft-");
    expect(editedPayload.idempotency_key).not.toEqual(payload.idempotency_key);
    expect(editedPayload).toMatchObject({
      operator_approval_gate: {
        status: "ready",
        reason: "operator_approval_recorded_in_local_posture_form"
      },
      secret_handling_gate: {
        status: "review_required",
        reason: "secret_handling_review_recorded_without_secret_material"
      },
      secret_reference_configured: false
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /exchange_credentials|provider_api_key|apiKey|secretKey|signature|direct_exchange_order/
    );
    expect(JSON.stringify(editedPayload)).not.toMatch(
      /exchange_credentials|provider_api_key|apiKey|secretKey|signature|direct_exchange_order/
    );
  });

  it("builds replay-only replay-run payloads", () => {
    const payload = replayRunPayload();

    expect(payload).toEqual({
      runner_kind: "host_process"
    });
    expect(JSON.stringify(payload)).not.toMatch(/exchange_credentials|live_order|paper_order|broker|provider_api_key/i);
  });

  it("renders materialization attempts as provider output, not evidence", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          status: "materialized",
          display_name: "generic market Perp Breakout Candidate",
          materialization_attempt: {
            attempt_id: "candidate-materialization-attempt-001",
            idempotency_key: "codex-run-success-output-hash-001",
            provider_kind: "codex_cli",
            model: "gpt-5.4",
            agent_run_ref: { record_kind: "agent_run", id: "agent-run-codex-success-001" },
            trace_ref: { record_kind: "trace_placeholder", id: "trace-codex-success-001" },
            status: "materialized",
            validation_status: "accepted",
            resulting_candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-001" },
            artifact_refs: [{ record_kind: "provider_output_artifact", id: "codex-output-success-001" }],
            created_at: "2026-04-27T00:00:00.000Z",
            authority_label: "provider_output_not_evidence"
          }
        }}
      />
    );

    const materializationAttemptSection = extractMaterializationAttemptSection(html);
    expect(materializationAttemptSection).toContain("Materialization Attempt");
    expect(materializationAttemptSection).toContain("codex_cli / gpt-5.4");
    expect(materializationAttemptSection).toContain("Provider trace");
    expect(materializationAttemptSection).not.toMatch(/<dt[^>]*>Trace<\/dt>/);
    expect(materializationAttemptSection).toContain("provider_output_not_evidence");
    expect(materializationAttemptSection).not.toMatch(/Counted evidence|Promotion approved|Live authority/);
  });

  it("renders an empty evaluation state separately from failure", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail candidate={candidateWithEvaluation(emptyEvaluation())} />
    );

    expect(html).toContain("ResearchPreflight state");
    expect(html).toContain("empty");
    expect(html).toContain("No ResearchPreflight runs");
    expect(html).toContain("no_evaluation_runs");
    expect(html).not.toContain("evaluation_failed");
  });

  it("renders failed evaluation run state with the run error", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail candidate={candidateWithEvaluation(failedEvaluation())} />
    );

    expect(html).toContain("ResearchPreflight state");
    expect(html).toContain("failed");
    expect(html).toContain("evaluation engine rejected metrics");
    expect(html).not.toContain("No evaluation runs");
  });

  it("renders sealed counted and rejected evidence classifications distinctly", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail candidate={candidateWithEvaluation(sealedEvaluation())} />
    );

    expect(html).toContain("sealed");
    expect(html).toContain("counted_evidence");
    expect(html).toContain("rejected_evidence");
    expect(html).toContain("sealed_counted_fixture_only_allowed_by_test");
    expect(html).toContain("partial_trace");
    expect(html).toContain("evidence_sealing_decision:fixture-sealing");
    const researchPreflightEvidenceSection = extractResearchPreflightEvidenceSection(html);
    expect(researchPreflightEvidenceSection).toContain("ResearchPreflight run authority");
    expect(researchPreflightEvidenceSection).toContain("Comparison set authority");
    expect(researchPreflightEvidenceSection).toContain("Trace material authority");
    expect(researchPreflightEvidenceSection).toContain("Counted evidence authority");
    expect(researchPreflightEvidenceSection).toContain("Sealing decision authority");
    expect(researchPreflightEvidenceSection).toContain('data-operator-ui="evidence-stack"');
    expect(researchPreflightEvidenceSection).toContain('data-operator-ui="evidence-status"');
    expect(researchPreflightEvidenceSection).toContain('data-operator-ui="evidence-block"');
    expect(researchPreflightEvidenceSection).toContain('data-operator-ui="evidence-row"');
    expect(researchPreflightEvidenceSection).not.toContain('class="evaluation-status');
    expect(researchPreflightEvidenceSection).not.toContain('class="evaluation-block"');
    expect(researchPreflightEvidenceSection).not.toContain("classification-row");
    expect(researchPreflightEvidenceSection).not.toMatch(/<dt[^>]*>Authority<\/dt>/);
    expectNoOperatorActionControls(html);
  });
});

function candidateWithEvaluation(evaluation: CandidateEvaluationReadModel): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    evaluation
  };
}

function candidateWithLedgerSource(
  ledgerSource: LedgerSourceRecordsReadModel
): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    ledger: buildLedgerReadModel(ledgerSource),
    runtime: {
      ...fixtureCandidate.runtime,
      ledger: ledgerSource
    }
  };
}

function candidateWithSandbox(
  candidate: CandidateInspectReadModel
): CandidateInspectReadModel {
  return {
    ...candidate,
    runtime: {
      ...candidate.runtime,
      runtime_lifecycle_status: "running",
      transcript: {
        transcript_kind: "trading_run_transcript",
        has_activity: true,
        item_count: 4,
        latest_item: {
          item_id: "gateway-result:gateway-result-001",
          item_kind: "gateway_result",
          occurred_at: "2026-05-20T00:00:04.000Z",
          label: "Gateway result",
          summary: "dry_run_only / paper_stage_only",
          ref: { record_kind: "gateway_result", id: "gateway-result-001" },
          authority_status: "dry_run_only"
        },
        items: [
          {
            item_id: "run-control-audit:runtime-audit-start-001",
            item_kind: "run_control_audit",
            occurred_at: "2026-05-20T00:00:00.000Z",
            label: "Run Control audit",
            summary: "Trading Run start recorded.",
            ref: { record_kind: "runtime_audit_event", id: "runtime-audit-start-001" },
            authority_status: "audit_only",
            lifecycle_status: "running"
          },
          {
            item_id: "sandbox-heartbeat:runtime-heartbeat-running-fixture",
            item_kind: "sandbox_heartbeat",
            occurred_at: "2026-05-20T00:00:01.000Z",
            label: "Sandbox heartbeat",
            summary: "{\"event\":\"runtime_heartbeat\",\"tick\":1}",
            ref: { record_kind: "runtime_heartbeat", id: "runtime-heartbeat-running-fixture" },
            authority_status: "trace_only"
          },
          {
            item_id: "order-request:order-request-001",
            item_kind: "order_request",
            occurred_at: "2026-05-20T00:00:03.000Z",
            label: "Order request",
            summary: "buy / limit / 0.001 @ 60000",
            ref: { record_kind: "order_request", id: "order-request-001" },
            authority_status: "draft_only"
          },
          {
            item_id: "gateway-result:gateway-result-001",
            item_kind: "gateway_result",
            occurred_at: "2026-05-20T00:00:04.000Z",
            label: "Gateway result",
            summary: "dry_run_only / paper_stage_only",
            ref: { record_kind: "gateway_result", id: "gateway-result-001" },
            authority_status: "dry_run_only"
          }
        ],
        authority_status: "not_live",
        no_authority: {
          live_exchange_authority: false,
          private_read_authority: false,
          order_submission_authority: false,
          credentials: false
        }
      },
      sandbox: {
        sandbox_id: "sandbox-running-fixture",
        adapter_kind: "deterministic_test",
        system_code_ref: { record_kind: "system_code", id: "fixture-system-code" },
        runtime_ref: candidate.runtime.ref,
        sandbox_placement_ref: { record_kind: "sandbox_placement", id: "sandbox-placement-running-fixture" },
        lifecycle_status: "running",
        sandbox_name: "ouro-sandbox-running-fixture",
        sandbox_ref: { record_kind: "docker_sandbox", id: "ouro-sandbox-running-fixture" },
        created_at: "2026-05-20T00:00:00.000Z",
        started_at: "2026-05-20T00:00:00.000Z",
        last_heartbeat_at: "2026-05-20T00:00:01.000Z",
        log_refs: [{ record_kind: "sandbox_log", id: "sandbox-log-running-fixture" }],
        heartbeat_refs: [{ record_kind: "runtime_heartbeat", id: "runtime-heartbeat-running-fixture" }],
        command_evidence_refs: [],
        authority_status: "not_live",
        logs: [
          {
            log_ref: { record_kind: "sandbox_log", id: "sandbox-log-running-fixture" },
            lines: ["{\"event\":\"runtime_heartbeat\",\"tick\":1}"],
            captured_at: "2026-05-20T00:00:01.000Z",
            authority_status: "trace_only"
          }
        ],
        heartbeats: [
          {
            heartbeat_ref: { record_kind: "runtime_heartbeat", id: "runtime-heartbeat-running-fixture" },
            heartbeat_line: "{\"event\":\"runtime_heartbeat\",\"tick\":1}",
            observed_at: "2026-05-20T00:00:01.000Z",
            authority_status: "trace_only"
          }
        ],
        command_evidence: []
      }
    }
  };
}

function candidateWithAgentCycleMaterialization(
  candidate: CandidateInspectReadModel
): CandidateInspectReadModel {
  return {
    ...candidate,
    candidate_id: "candidate-agent-generated-reloaded",
    display_name: "Agent generated BTCUSDT Trading System",
    status: "materialized",
    spec: {
      ...candidate.spec,
      market: "Binance USD-M Futures",
      instrument: "BTCUSDT"
    },
    system_code: {
      ref: { record_kind: "system_code", id: "system-code-agent-reloaded" },
      summary: "Agent-generated Python SystemCode using the TradingApiProvider boundary.",
      declared_runtime: "python",
      declared_outputs: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
    },
    materialization_attempt: {
      attempt_id: "candidate-materialization-attempt-agent-cycle-reloaded",
      idempotency_key: "agent-cycle-materialize:fixture-candidate-sealed-replay-001:fixture-candidate-version-001",
      provider_kind: "codex_cli",
      model: "gpt-5",
      agent_run_ref: { record_kind: "agent_run", id: "agent-run-agent-cycle-reloaded" },
      trace_ref: { record_kind: "trace_placeholder", id: "trace-agent-cycle-reloaded" },
      status: "materialized",
      validation_status: "accepted",
      resulting_candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-agent-generated-reloaded" },
      artifact_refs: [{ record_kind: "system_code", id: "system-code-agent-reloaded" }],
      created_at: "2026-05-23T00:00:00.000Z",
      authority_label: "provider_output_not_evidence"
    },
    full_cycle_lineage: {
      handoff_status: "runnable",
      source: {
        trading_system_id: "fixture-candidate-sealed-replay-001",
        candidate_version_id: "fixture-candidate-version-001",
        system_code_ref: {
          record_kind: "system_code",
          id: "fixture-system-code-clock-python-001"
        }
      },
      generated: {
        system_code_ref: {
          record_kind: "system_code",
          id: "system-code-agent-reloaded"
        },
        artifact_digest: "sha256:agent-reloaded",
        generated_by_agent: true
      },
      materialized: {
        trading_system_id: "candidate-agent-generated-reloaded",
        candidate_version_id: candidate.candidate_version.candidate_version_id,
        system_code_ref: {
          record_kind: "system_code",
          id: "system-code-agent-reloaded"
        }
      },
      evidence: {
        evaluation_status: "accepted",
        evaluation_score: 1,
        trading_run_id: candidate.runtime.ref.id,
        gateway_result_outcome: "dry_run_only",
        ledger_chain_complete: true
      }
    }
  };
}

function candidateWithImprovementLoop(
  improvementLoop: ImprovementReadModel
): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    improvement: improvementFromLoop(improvementLoop)
  };
}

function improvementFromLoop(loop: ImprovementReadModel): ImprovementReadModel {
  return {
    improvement_kind: "improvement",
    source_model: loop.source_model,
    has_activity: loop.has_activity,
    proposal_chain_complete: loop.proposal_chain_complete,
    evaluation_chain_complete: loop.evaluation_chain_complete,
    chain_complete: loop.chain_complete,
    latest_source_finding: loop.latest_source_finding,
    latest_change_proposal: loop.latest_change_proposal,
    latest_materialization: loop.latest_materialization,
    latest_research_run: loop.latest_research_run,
    latest_experiment: loop.latest_experiment,
    latest_evaluation_result: loop.latest_evaluation_result,
    evidence: loop.evidence,
    promotion: loop.promotion,
    no_authority: loop.no_authority
  };
}

function candidateWithRunControl(
  runtimeControl: RunControlReadModel,
  privateReadinessPolicyDecision?: NonNullable<
    CandidateInspectReadModel["trading_substrate"]
  >["latest_private_readiness_policy_decision"]
): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    runtime: {
      ...fixtureCandidate.runtime,
      run_control: runtimeControl
    },
    trading_substrate: {
      latest_order_fill_surface: fixtureOrderFillSurface(),
      latest_public_market_liveness_surface: fixturePublicMarketLivenessSurface(),
      latest_private_readiness_preflight_surface: fixturePrivateReadinessPreflightSurface(),
      latest_private_readiness_posture: fixturePrivateReadinessPosture(),
      private_readiness_posture_history: [fixturePrivateReadinessPosture()],
      latest_private_readiness_policy_decision: privateReadinessPolicyDecision ?? null,
      latest_account_position_risk_mirror_surface: null
    }
  };
}

function promotedCandidate(): CandidateInspectReadModel {
  const candidateId = "trading-system-candidate-8d42977b8c79";
  return {
    ...fixtureCandidate,
    candidate_id: candidateId,
    display_name: "Trading System s15-02-seeded-codex-real-sdx-proof",
    status: "materialized",
    active_version_id: `${candidateId}-v1`,
    fixture_notice: {
      mode: "local_promoted_candidate_bundle",
      label: "Promoted local candidate bundle",
      statements: [
        "Read-only Trading System bundle promoted from research.",
        "No exchange credentials or order authority are mounted.",
        "Replay-run evidence is replay-only and not counted trading authority."
      ]
    },
    candidate_version: {
      candidate_version_id: `${candidateId}-v1`,
      version_label: "trading-research-v1",
      provenance_refs: [
        { record_kind: "trading_research_notebook", id: "s15-02-seeded-codex-real-sdx-proof" },
        { record_kind: "system_code", id: "system-code-8d42977b8c79" }
      ]
    },
    spec: {
      ref: { record_kind: "trading_system_spec", id: `${candidateId}-spec` },
      summary: "Promoted from Trading research seeded-stability gate using artifact trading-system-mvp.",
      market: "External trading API provider",
      instrument: "Trading system",
      supported_stage_binding_profiles: ["backtest"]
    },
    program: {
      ref: { record_kind: "trading_system_program", id: `${candidateId}-program` },
      summary: "Minimal Trading System MVP / sha256:fadd2155",
      manifest: {
        ref: { record_kind: "program_manifest", id: "trading-system-mvp-manifest" },
        declared_runtime: "python python3 run.py",
        declared_outputs: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
      },
      validation: {
        ref: { record_kind: "program_validation_record", id: `${candidateId}-validation` },
        label: "Program validation",
        status: "promoted_from_seeded_stability_gate",
        authority_status: "not_counted"
      }
    },
    capability_package: {
      ref: { record_kind: "capability_package", id: `${candidateId}-capabilities` },
      summary: "Read-only replay capability for promoted local candidate artifacts.",
      manifest: {
        ref: { record_kind: "capability_manifest", id: `${candidateId}-capabilities-manifest` },
        allowed_stages: ["backtest"],
        declared_permissions: ["trading_api_provider_v1"],
        forbidden_contents: ["exchange_credentials", "live_order_submission", "paper_order_submission"]
      },
      admission: placeholder("capability_package_admission_record", `${candidateId}-admission`, "Capability admission"),
      grant: placeholder("capability_grant", `${candidateId}-grant`, "Capability grant"),
      mount: placeholder("capability_mount_record", `${candidateId}-mount`, "Capability mount")
    },
    runtime: {
      ref: { record_kind: "trading_run", id: `${candidateId}-runtime` },
      stage_binding_profile: "backtest",
      runtime_lifecycle_status: "registered",
      authority_status: "not_live",
      placement: {
        ref: { record_kind: "sandbox_placement", id: `${candidateId}-placement` },
        label: "Sandbox placement",
        status: "candidate_replay_only",
        authority_status: "not_live"
      },
      hands_environment: {
        ref: { record_kind: "hands_environment", id: `${candidateId}-hands` },
        label: "Hands environment",
        status: "not_mounted",
        authority_status: "not_mounted"
      },
      memory_surface: {
        ref: { record_kind: "runtime_memory_surface", id: `${candidateId}-memory` },
        trust_class: "local_promoted_candidate_bundle",
        access_mode: "read_only",
        surface_version: "v1",
        visibility: "operator_visible",
        quarantine_status: "not_quarantined",
        authority_status: "not_evidence"
      }
    },
    trace: {
      ref: { record_kind: "trace_placeholder", id: `${candidateId}-trace` },
      label: "Trace placeholder",
      status: "source_trace_only",
      authority_status: "not_counted"
    },
    evaluation: emptyEvaluation()
  };
}

function replayRun(overrides: Partial<ReplayRunEvidenceReadModel> = {}): ReplayRunEvidenceReadModel {
  return {
    run_id: "replay-run-001",
    run_dir: "/tmp/replay-run-001",
    candidate_id: fixtureCandidate.candidate_id,
    runner_kind: "host_process",
    status: "accepted",
    run_status: "completed",
    scenario_accepted: 2,
    scenario_total: 2,
    provider_request_total: 6,
    runner_command_total: 0,
    artifact_digest: "sha256:fadd2155",
    completed_at: "2026-05-13T15:00:00.000Z",
    authority_status: "not_live",
    ...overrides
  };
}

function replayRunDetail(overrides: Partial<ReplayRunDetailReadModel> = {}): ReplayRunDetailReadModel {
  const summary = replayRun(overrides);
  return {
    ...summary,
    score: 1,
    risk_decision: "valid_order_request",
    scenario_ids: ["trend_long"],
    output_dir: "/tmp/replay-run-001/output",
    events_path: "/tmp/replay-run-001/output/replay-set.json",
    started_at: "2026-05-13T14:59:00.000Z",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    },
    provenance: {
      promotion_id: "promotion-detail",
      source_session_id: "research-detail"
    },
    scenarios: [
      {
        scenario_id: "trend_long",
        runner_kind: "docker_sandboxes_sbx",
        sandbox_name: "ouro-s22-detail",
        status: "accepted",
        run_status: "completed",
        score: 1,
        risk_decision: "valid_order_request",
        summary: "Accepted order request with score 1.000.",
        events_path: "/tmp/replay-run-001/output/trend_long/events.jsonl",
        provider_request_count: 3,
        runner_command_count: 1,
        metrics: [
          {
            name: "provider_boundary",
            score: 0.2,
            detail: "market/account/order validation went through the external provider"
          }
        ],
        runner_command_evidence: [
          {
            command: ["sbx", "version"],
            exit_code: 0,
            stdout_preview: "Docker Sandboxes",
            stderr_preview: "",
            started_at: "2026-05-13T14:59:01.000Z",
            completed_at: "2026-05-13T14:59:02.000Z"
          }
        ]
      }
    ],
    ...overrides
  };
}

function replayRunComparison(
  overrides: Partial<ReplayRunComparisonReadModel> = {}
): ReplayRunComparisonReadModel {
  return {
    candidate_id: fixtureCandidate.candidate_id,
    selected: {
      run_id: "selected-run",
      status: "accepted",
      run_status: "completed",
      score: 0.85,
      risk_decision: "valid_order_request",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 4,
      completed_at: "2026-05-14T12:00:00.000Z",
      authority_status: "not_live"
    },
    baseline: {
      run_id: "baseline-run",
      status: "accepted",
      run_status: "completed",
      score: 0.6,
      risk_decision: "valid_order_request",
      scenario_accepted: 1,
      scenario_total: 2,
      provider_request_total: 5,
      runner_command_total: 0,
      completed_at: "2026-05-14T11:00:00.000Z",
      authority_status: "not_live"
    },
    baseline_selection: "explicit_baseline_run_id",
    deltas: {
      score: 0.25,
      scenario_accepted: 1,
      scenario_total: 0,
      provider_request_total: 1,
      runner_command_total: 4
    },
    risk_transition: "valid_order_request -> valid_order_request",
    verdict: "improved",
    verdict_reason: "selected run improved score by 0.25 and accepted scenarios by 1",
    authority_status: "not_live",
    validation_label: "comparison_not_authority",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    },
    ...overrides
  };
}

function replayRunValidationState(
  overrides: Partial<ReplayRunValidationStateReadModel> = {}
): ReplayRunValidationStateReadModel {
  return {
    candidate_id: fixtureCandidate.candidate_id,
    selected_run_id: "selected-run",
    baseline_run_id: "baseline-run",
    comparison_verdict: "improved",
    validation_state: "passes_replay_checks",
    reasons: [
      "selected run improved against baseline",
      "all selected scenarios were accepted",
      "selected score meets the evidence threshold"
    ],
    required_next_evidence: [
      "human review of replay evidence",
      "future promotion issue with explicit authority scope"
    ],
    authority_status: "not_live",
    validation_label: "validation_state_not_authority",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    },
    ...overrides
  };
}

function replayRunBaselineRequiredPosture(selectedRunId: string): ReplayRunValidationStateReadModel {
  return {
    candidate_id: fixtureCandidate.candidate_id,
    selected_run_id: selectedRunId,
    validation_state: "comparison_required",
    reasons: [
      "no baseline run was available for evidence comparison",
      "validation state cannot advance from a single run"
    ],
    required_next_evidence: [
      "record at least one baseline replay run",
      "compare selected run against baseline before posture review"
    ],
    authority_status: "not_live",
    validation_label: "validation_state_not_authority",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    }
  };
}

function candidateLatestValidationState(
  overrides: Partial<CandidateLatestValidationStateReadModel> = {}
): CandidateLatestValidationStateReadModel {
  return {
    candidate_id: fixtureCandidate.candidate_id,
    selected_run_id: "latest-replay-run",
    baseline_run_id: "baseline-replay-run",
    comparison_verdict: "improved",
    validation_state: "passes_replay_checks",
    reasons: [
      "selected run improved against baseline",
      "all selected scenarios were accepted",
      "selected score meets the evidence threshold"
    ],
    required_next_evidence: [
      "human review of replay evidence",
      "future promotion issue with explicit authority scope"
    ],
    authority_status: "not_live",
    validation_label: "validation_state_not_authority",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    },
    ...overrides
  };
}

function fullCycleOutcome(candidate: CandidateInspectReadModel): FullCycleOutcome {
  const ledger = candidate.ledger ?? buildLedgerReadModel(ledgerSourceRecords());
  return {
    status: "completed",
    source_system_id: "fixture-candidate-sealed-replay-001",
    source_candidate_version_id: "fixture-candidate-version-001",
    agent_research: {
      session_id: "agent-cycle-test",
      run_root: "/tmp/agent-cycle-test",
      notebook_path: "/tmp/agent-cycle-test/notebook.json",
      agent: {
        id: "managed-agent-fixture-trading-research",
        provider: "fixture",
        model: "scripted-fixture",
        permission_policy: "fixture_only"
      },
      best_score: 1,
      best_artifact_dir: "/tmp/agent-cycle-test/best",
      latest_decision: "keep",
      latest_summary: "Accepted replay set with average score 1.000 across 2 scenarios."
    },
    system_code_handoff: {
      system_code_id: "system-code-agent-test",
      artifact_path: "/tmp/agent-cycle-test/best/run.py",
      artifact_digest: "sha256:test",
      runtime_kind: "python",
      declared_output_kinds: ["order_request"],
      generated_by_agent: true,
      authority_status: "not_live"
    },
    full_cycle_lineage: {
      handoff_status: "runnable",
      source: {
        trading_system_id: "fixture-candidate-sealed-replay-001",
        candidate_version_id: "fixture-candidate-version-001",
        system_code_ref: {
          record_kind: "system_code",
          id: "fixture-system-code-clock-python-001"
        }
      },
      generated: {
        system_code_ref: {
          record_kind: "system_code",
          id: "system-code-agent-test"
        },
        artifact_digest: "sha256:test",
        generated_by_agent: true
      },
      materialized: {
        trading_system_id: candidate.candidate_id,
        candidate_version_id: candidate.candidate_version.candidate_version_id,
        system_code_ref: {
          record_kind: "system_code",
          id: "system-code-agent-test"
        }
      },
      evidence: {
        evaluation_status: "accepted",
        evaluation_score: 1,
        trading_run_id: candidate.runtime.ref.id,
        gateway_result_outcome: "dry_run_only",
        ledger_chain_complete: true
      }
    },
    backtest: {
      status: "accepted",
      score: 1,
      risk_decision: "valid_order_request",
      summary: "Accepted replay set with average score 1.000 across 2 scenarios.",
      scenario_results: [
        {
          scenario_id: "trend_long",
          status: "accepted",
          score: 1,
          risk_decision: "valid_order_request",
          summary: "Accepted order request with score 1.000."
        }
      ]
    },
    next_trading_system: candidate,
    trading_run_id: candidate.runtime.ref.id,
    trading_run: {
      ref: { record_kind: "trading_run", id: candidate.runtime.ref.id },
      stage: candidate.runtime.stage_binding_profile,
      lifecycle_status: candidate.runtime.runtime_lifecycle_status,
      authority_status: "not_live"
    },
    paper_trading: {
      run_status: "completed",
      events_path: "/tmp/agent-cycle-test/paper/events.jsonl",
      provider_request_count: 3,
      authority_status: "not_live"
    },
    order_request: ledger.latest_order_request,
    gateway_result: ledger.latest_gateway_result,
    execution_result: ledger.latest_execution_result,
    ledger,
    trading_gateway_environment: tradingGatewayEnvironment()
  };
}

function ledgerSourceRecords(): LedgerSourceRecordsReadModel {
  return {
    has_activity: true,
    chain_complete: true,
    chain_count: 1,
    chains: [
      {
        chain_id: "order-request-001",
        chain_complete: true,
        occurred_at: "2026-05-10T00:00:00.000Z",
        order_request: {
          order_request_id: "order-request-001",
          intent_kind: "place_order",
          market_scope: "external_trading_api_fixture",
          side: "buy",
          order_type: "limit",
          quantity: "0.001",
          limit_price: "60000",
          status: "proposed",
          created_at: "2026-05-10T00:00:00.000Z",
          authority_status: "not_submitted"
        },
        gateway_result: {
          gateway_result_id: "gateway-result-001",
          order_request_ref: { record_kind: "order_request", id: "order-request-001" },
          decision_outcome: "dry_run_only",
          decision_reason: "paper_stage_only",
          decided_at: "2026-05-10T00:00:00.000Z",
          authority_status: "dry_run_only"
        },
        execution_result: {
          execution_result_id: "execution-result-001",
          order_request_ref: { record_kind: "order_request", id: "order-request-001" },
          gateway_result_ref: { record_kind: "gateway_result", id: "gateway-result-001" },
          stage: "paper",
          execution_mode: "host_local",
          venue_scope: "external_trading_api_fixture",
          status: "dry_run_recorded",
          result_reason: "paper_stage_only",
          created_at: "2026-05-10T00:00:00.000Z",
          authority_status: "dry_run_only"
        },
        authority_status: "not_live"
      }
    ],
    latest_order_request: {
      order_request_id: "order-request-001",
      intent_kind: "place_order",
      market_scope: "external_trading_api_fixture",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000",
      status: "proposed",
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "not_submitted"
    },
    latest_gateway_result: {
      gateway_result_id: "gateway-result-001",
      order_request_ref: { record_kind: "order_request", id: "order-request-001" },
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      decided_at: "2026-05-10T00:00:00.000Z",
      authority_status: "dry_run_only"
    },
    latest_execution_result: {
      execution_result_id: "execution-result-001",
      order_request_ref: { record_kind: "order_request", id: "order-request-001" },
      gateway_result_ref: { record_kind: "gateway_result", id: "gateway-result-001" },
      stage: "paper",
      execution_mode: "host_local",
      venue_scope: "external_trading_api_fixture",
      status: "dry_run_recorded",
      result_reason: "paper_stage_only",
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "dry_run_only"
    },
    order_request: {
      ref: { record_kind: "order_request", id: "order-request-001" },
      label: "Order request",
      status: "proposed",
      authority_status: "not_submitted"
    },
    gateway_result: {
      ref: { record_kind: "gateway_result", id: "gateway-result-001" },
      label: "Gateway result",
      status: "dry_run_only",
      authority_status: "dry_run_only"
    },
    execution_result: {
      ref: { record_kind: "execution_result", id: "execution-result-001" },
      label: "Execution result",
      status: "dry_run_recorded",
      authority_status: "dry_run_only"
    }
  };
}

function tradingResearchRuntimeFixture(input: {
  codexReadiness: "active_verified" | "blocked_or_not_installed";
}): TradingResearchRuntimeReadModel {
  return {
    default_agent: "codex",
    available_agents: ["codex", "fixture"],
    iterations: 1,
    agents: [
      {
        agent: "codex",
        provider: "codex",
        readiness_status: input.codexReadiness,
        permission_policy: "artifact_workspace_only",
        command: "codex",
        model: "test-model",
        timeout_ms: 120_000,
        reasoning_effort: "low",
        version: input.codexReadiness === "active_verified" ? "codex-cli 0.130.0" : undefined,
        failure_reason: input.codexReadiness === "blocked_or_not_installed" ? "codex_cli_unavailable" : undefined
      },
      {
        agent: "fixture",
        provider: "fixture",
        readiness_status: "active_verified",
        permission_policy: "fixture_only",
        model: "scripted-fixture"
      }
    ]
  };
}

function artifactImprovementLoop(): ImprovementReadModel {
  return {
    improvement_kind: "improvement",
    source_model: "automated_alignment_researcher",
    has_activity: true,
    proposal_chain_complete: true,
    evaluation_chain_complete: true,
    chain_complete: true,
    latest_source_finding: {
      finding_id: "research-finding-001",
      finding_kind: "failure_analysis",
      summary: "Limit-order sizing is too brittle in a flat market fixture.",
      research_worker_ref: { record_kind: "research_worker", id: "research-worker-001" },
      research_direction_ref: { record_kind: "research_direction", id: "research-direction-001" },
      created_at: "2026-05-18T00:00:00.000Z",
      authority_status: "research_trace_only"
    },
    latest_change_proposal: {
      proposal_id: "improvement-proposal-001",
      proposed_system_code_ref: { record_kind: "system_code", id: "system-code-002" },
      parent_system_code_ref: { record_kind: "system_code", id: "system-code-001" },
      proposal_summary: "Adjust the fixture trading artifact to emit a valid dry-run order intent.",
      requested_change_summary: "Keep the change limited to the generated artifact.",
      expected_improvement_summary: "The next sandbox experiment should produce an accepted evaluation result.",
      source_finding_refs: [{ record_kind: "research_finding", id: "research-finding-001" }],
      anti_hacking_finding_refs: [],
      status: "proposed",
      created_at: "2026-05-18T00:01:00.000Z",
      authority_status: "proposal_only"
    },
    latest_materialization: {
      attempt_id: "materialization-attempt-001",
      provider: {
        provider_kind: "codex_cli",
        model: "fixture-model",
        invocation_surface: "local_fixture"
      },
      status: "materialized",
      validation_status: "accepted",
      output_artifact_proposal_ref: { record_kind: "improvement_proposal", id: "improvement-proposal-001" },
      output_system_code_ref: { record_kind: "system_code", id: "system-code-002" },
      output_lineage_ref: { record_kind: "artifact_lineage", id: "artifact-lineage-001" },
      created_at: "2026-05-18T00:02:00.000Z",
      authority_status: "proposal_input_only"
    },
    latest_research_run: {
      run_id: "research-orchestration-run-001",
      input_finding_refs: [{ record_kind: "research_finding", id: "research-finding-001" }],
      input_lineage_refs: [{ record_kind: "artifact_lineage", id: "artifact-lineage-000" }],
      output_artifact_proposal_ref: { record_kind: "improvement_proposal", id: "improvement-proposal-001" },
      output_system_code_ref: { record_kind: "system_code", id: "system-code-002" },
      output_lineage_ref: { record_kind: "artifact_lineage", id: "artifact-lineage-001" },
      trace_ref: { record_kind: "trace", id: "trace-001" },
      status: "proposed",
      started_at: "2026-05-18T00:00:30.000Z",
      completed_at: "2026-05-18T00:02:30.000Z",
      authority_status: "research_only"
    },
    latest_experiment: {
      experiment_id: "experiment-run-001",
      system_code_ref: { record_kind: "system_code", id: "system-code-002" },
      sandbox_ref: { record_kind: "sandbox", id: "sandbox-runtime-001" },
      runtime_trace_refs: [{ record_kind: "trace", id: "runtime-trace-001" }],
      trace_ref: { record_kind: "trace", id: "experiment-trace-001" },
      status: "evaluated",
      submitted_at: "2026-05-18T00:03:00.000Z",
      authority_status: "not_live"
    },
    latest_evaluation_result: {
      result_id: "trading-evaluation-result-001",
      experiment_run_ref: { record_kind: "experiment_run", id: "experiment-run-001" },
      result_status: "accepted",
      evidence_disposition: "not_counted",
      total_score: 1,
      evaluator_trace_ref: { record_kind: "trace", id: "evaluator-trace-001" },
      completed_at: "2026-05-18T00:04:00.000Z",
      authority_status: "not_counted"
    },
    evidence: {
      status: "not_sealed",
      reason: "evidence_sealing_not_run",
      authority_status: "not_counted"
    },
    promotion: {
      status: "not_promoted",
      reason: "promotion_requires_sealed_evidence",
      authority_status: "not_live"
    },
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      promotion: false
    }
  };
}

function tradingGatewayEnvironment(): TradingGatewayEnvironmentReadModel {
  return {
    environment_kind: "trading_gateway_environment",
    venue: "binance_usd_m_futures",
    instrument: "BTCUSDT",
    product_category: "perpetual_futures",
    runtime_environment: "paper",
    runtime_environment_source: "mlp_policy",
    exchange_environment: "unbound",
    exchange_environment_source: "runtime_binding_policy",
    rest_base_url: null,
    credential_scope: "none",
    credential_source: "environment_variables",
    api_key_configured: true,
    api_secret_configured: true,
    configuration_status: "configured",
    configuration_reason: "credentials_configured_but_not_used_by_paper_runtime",
    authority_status: "not_live",
    live_exchange_authority: false,
    order_submission_authority: false,
    live_disabled_reason: "live_gateway_not_enabled_in_mlp",
    runtime_bindings: {
      paper: {
        status: "enabled",
        market_data_source: "binance_production_public_rest",
        rest_base_url: "https://fapi.binance.com",
        account_provider: "fake_paper_account",
        executor: "fake_paper_order_executor",
        ledger: "fake_ledger",
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "dry_run_only"
      },
      live: {
        status: "disabled",
        disabled_reason: "live_gateway_not_enabled_in_mlp",
        market_data_source: "binance_production_public_rest",
        rest_base_url: "https://fapi.binance.com",
        account_provider: "live_account",
        executor: "live_order_executor",
        ledger: "ledger",
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "not_live"
      }
    },
    env_var_names: {
      rest_base_url: "OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL",
      api_key: "OUROBOROS_BINANCE_API_KEY",
      api_secret: "OUROBOROS_BINANCE_API_SECRET"
    },
    warnings: []
  };
}

function runtimeControl(): RunControlReadModel {
  return {
    has_activity: true,
    chain_complete: true,
    latest_command: {
      command_id: "run-control-command-001",
      action: "pause",
      requested_lifecycle_status: "paused",
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-web" },
      reason: "operator_request",
      requested_at: "2026-05-10T00:10:00.000Z",
      status: "decided",
      authority_status: "control_only"
    },
    latest_decision: {
      decision_id: "run-control-decision-001",
      command_ref: { record_kind: "run_control_command", id: "run-control-command-001" },
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      decided_by_actor_ref: { record_kind: "runtime_policy_engine", id: "runtime-policy-engine-fixture" },
      resulting_lifecycle_status: "paused",
      decided_at: "2026-05-10T00:10:00.000Z",
      authority_status: "control_only"
    },
    latest_audit_event: {
      audit_event_id: "runtime-audit-event-001",
      event_kind: "runtime_lifecycle_transitioned",
      command_ref: { record_kind: "run_control_command", id: "run-control-command-001" },
      decision_ref: { record_kind: "run_control_decision", id: "run-control-decision-001" },
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-web" },
      runtime_lifecycle_status: "paused",
      message: "Paper runtime paused through operator-web.",
      created_at: "2026-05-10T00:10:00.000Z",
      authority_status: "audit_only"
    },
    command: {
      ref: { record_kind: "run_control_command", id: "run-control-command-001" },
      label: "Runtime control command",
      status: "decided",
      authority_status: "control_only"
    },
    decision: {
      ref: { record_kind: "run_control_decision", id: "run-control-decision-001" },
      label: "Runtime control decision",
      status: "allowed",
      authority_status: "control_only"
    },
    audit_event: {
      ref: { record_kind: "runtime_audit_event", id: "runtime-audit-event-001" },
      label: "Runtime audit event",
      status: "runtime_lifecycle_transitioned",
      authority_status: "audit_only"
    }
  };
}

function emptyEvaluation(): CandidateEvaluationReadModel {
  return {
    ...fixtureCandidate.evaluation,
    has_runs: false,
    latest_run: null,
    latest_comparison_set: null,
    latest_sealing_decision: null,
    trace: {
      state: "none",
      trace_ref: null,
      authority_status: "not_counted",
      provider_output_artifact_refs: [],
      debug_artifact_refs: []
    },
    evidence_classifications: [],
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "no_evaluation_runs",
      authority_status: "not_counted"
    },
    error_state: null,
    run: placeholder("evaluation_run_record", "missing-eval", "Evaluation run"),
    comparison_set: placeholder("evaluation_comparison_set", "missing-comparison", "Evaluation comparison set"),
    sealing_decision: placeholder("evidence_sealing_decision", "missing-sealing", "Evidence sealing decision")
  };
}

function failedEvaluation(): CandidateEvaluationReadModel {
  return {
    ...fixtureCandidate.evaluation,
    latest_run: {
      ...fixtureCandidate.evaluation.latest_run!,
      status: "failed",
      error_state: {
        code: "evaluation_failed",
        message: "evaluation engine rejected metrics"
      }
    },
    latest_sealing_decision: {
      ...fixtureCandidate.evaluation.latest_sealing_decision!,
      evidence_disposition: "not_counted",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    },
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    },
    error_state: {
      code: "evaluation_failed",
      message: "evaluation engine rejected metrics"
    }
  };
}

function sealedEvaluation(): CandidateEvaluationReadModel {
  return {
    ...fixtureCandidate.evaluation,
    latest_run: {
      ...fixtureCandidate.evaluation.latest_run!,
      status: "succeeded",
      completed_at: "2026-05-05T00:02:00.000Z"
    },
    latest_comparison_set: {
      ...fixtureCandidate.evaluation.latest_comparison_set!,
      comparability_status: "comparable",
      comparability_reason: "fixture_only"
    },
    latest_sealing_decision: {
      ...fixtureCandidate.evaluation.latest_sealing_decision!,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      authority_status: "counted",
      sealed_at: "2026-05-05T00:03:00.000Z"
    },
    evidence_classifications: [
      {
        classification_id: "fixture-classification-counted",
        classified_ref: { record_kind: "evaluation_run_record", id: "fixture-eval" },
        classification_kind: "counted_evidence",
        classification_status: "counted",
        classification_reason: "sealed_counted_fixture_only_allowed_by_test",
        authority_status: "counted",
        sealed_by_decision_ref: { record_kind: "evidence_sealing_decision", id: "fixture-sealing" },
        created_at: "2026-05-05T00:03:00.000Z"
      },
      {
        classification_id: "fixture-classification-rejected",
        classified_ref: { record_kind: "provider_output_artifact", id: "fixture-provider-output" },
        classification_kind: "rejected_evidence",
        classification_status: "rejected",
        classification_reason: "partial_trace",
        authority_status: "not_counted",
        sealed_by_decision_ref: { record_kind: "evidence_sealing_decision", id: "fixture-sealing" },
        created_at: "2026-05-05T00:03:00.000Z"
      }
    ],
    counted_evidence: {
      counted: true,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      authority_status: "counted",
      sealed_at: "2026-05-05T00:03:00.000Z"
    }
  };
}

function tradingExecutionModes(): TradingSystemExecutionModeContractReadModel[] {
  const baseArtifactContract = {
    artifact_shape: "opaque_trading_system" as const,
    api_provider_boundary: "TradingApiProvider" as const,
    credentials_access: "forbidden" as const,
    order_submission: "forbidden" as const
  };
  const forbiddenArtifactCapabilities = ["credentials", "direct_exchange_client"];
  return [
    {
      mode: "backtest",
      label: "Backtest replay",
      support_status: "available",
      stage_binding_profile: "backtest",
      artifact_contract: baseArtifactContract,
      provider_contract: {
        market_data: "historical_replay",
        account: "simulated_account",
        order_plane: "order_validation_only",
        credentials_scope: "none_required"
      },
      authority: {
        artifact_has_credentials: false,
        artifact_has_order_authority: false,
        provider_may_submit_orders: false,
        live_exchange_authority: false,
        status: "not_live"
      },
      required_controls: ["external TradingApiProvider boundary"],
      forbidden_artifact_capabilities: forbiddenArtifactCapabilities
    },
    {
      mode: "paper",
      label: "Paper trading",
      support_status: "available",
      stage_binding_profile: "paper",
      artifact_contract: baseArtifactContract,
      provider_contract: {
        market_data: "realtime_market_data",
        account: "paper_account",
        order_plane: "paper_order_sink",
        credentials_scope: "none_required"
      },
      authority: {
        artifact_has_credentials: false,
        artifact_has_order_authority: false,
        provider_may_submit_orders: false,
        live_exchange_authority: false,
        status: "paper_only"
      },
      required_controls: ["fake paper account isolation"],
      forbidden_artifact_capabilities: forbiddenArtifactCapabilities
    },
    {
      mode: "live",
      label: "Live disabled",
      support_status: "disabled",
      stage_binding_profile: "live",
      artifact_contract: baseArtifactContract,
      provider_contract: {
        market_data: "realtime_market_data",
        account: "live_account",
        order_plane: "gated_live_order_gateway",
        credentials_scope: "provider_side_only"
      },
      authority: {
        artifact_has_credentials: false,
        artifact_has_order_authority: false,
        provider_may_submit_orders: false,
        live_exchange_authority: false,
        status: "live_disabled"
      },
      required_controls: ["live_gateway_not_enabled_in_mlp"],
      forbidden_artifact_capabilities: forbiddenArtifactCapabilities
    }
  ];
}

const fixtureCandidateArena: CandidateArenaReadModel = {
  arena_kind: "candidate_arena",
  runner_status: "running",
  tick_count: 1,
  authority_status: "not_live",
  active_researchers: [
    {
      researcher_id: "research-worker-trend-following",
      direction_kind: "trend_following",
      status: "active",
      authority_status: "research_only"
    }
  ],
  leaderboard: [
    {
      rank: 1,
      candidate_id: "candidate-profitable",
      display_name: "Arena trend Trading System",
      direction_kind: "trend_following",
      parent_candidate_id: "fixture-candidate-sealed-replay-001",
      status: "accepted",
      profit_loss: {
        revenue_usdt: 10,
        cost_usdt: 0.17,
        net_revenue_usdt: 9.83,
        net_return_pct: 0.0983
      },
      latest_finding: "Positive net revenue after costs.",
      authority_status: "not_live"
    }
  ],
  latest_candidates: [
    {
      candidate_id: "candidate-profitable",
      display_name: "Arena trend Trading System",
      direction_kind: "trend_following",
      net_revenue_usdt: 9.83,
      authority_status: "not_live"
    }
  ],
  latest_ticks: [
    {
      tick_id: "tick-1",
      started_at: "2026-05-24T00:00:00.000Z",
      completed_at: "2026-05-24T00:00:01.000Z",
      status: "completed",
      created_candidate_ids: ["candidate-profitable"],
      direction_results: [
        {
          direction_kind: "trend_following",
          status: "created",
          candidate_id: "candidate-profitable",
          finding: "Positive net revenue after costs.",
          net_revenue_usdt: 9.83,
          research_efficiency: {
            provider_request_total: 6,
            runner_command_total: 0,
            scenario_count: 2,
            elapsed_ms: 1000,
            authority_status: "not_promotion_authority"
          }
        },
        {
          direction_kind: "mean_reversion",
          status: "failed",
          error: "fixture direction failed"
        }
      ],
      authority_status: "not_live"
    }
  ],
  finding_clusters: [],
  live_disabled: true
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

function extractSelectedCandidateArenaSection(html: string): string {
  const ariaStart = html.indexOf('aria-label="Selected Candidate Arena candidate"');
  const start = html.lastIndexOf("<section", ariaStart);
  const end = html.indexOf('aria-label="Agent provider status"', ariaStart);
  if (ariaStart < 0 || start < 0 || end < 0) {
    throw new Error("selected candidate arena section not found");
  }
  return html.slice(start, end);
}

function extractAgentProviderStatusSection(html: string): string {
  const ariaStart = html.indexOf('aria-label="Agent provider status"');
  const start = html.lastIndexOf("<section", ariaStart);
  const end = html.indexOf('aria-label="Command log"', ariaStart);
  if (ariaStart < 0 || start < 0 || end < 0) {
    throw new Error("agent provider status section not found");
  }
  return html.slice(start, end);
}

function extractCommandLogSection(html: string): string {
  const ariaStart = html.indexOf('aria-label="Command log"');
  const start = html.lastIndexOf("<section", ariaStart);
  const end = html.indexOf('aria-label="Candidate Arena latest ticks"', ariaStart);
  if (ariaStart < 0 || start < 0 || end < 0) {
    throw new Error("command log section not found");
  }
  return html.slice(start, end);
}

function extractCandidateArenaLatestTicksSection(html: string): string {
  const ariaStart = html.indexOf('aria-label="Candidate Arena latest ticks"');
  const start = html.lastIndexOf("<section", ariaStart);
  const end = html.indexOf("</aside>", ariaStart);
  if (ariaStart < 0 || start < 0 || end < 0) {
    throw new Error("candidate arena latest ticks section not found");
  }
  return html.slice(start, end);
}

function extractArenaCommandBarSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Arena command bar");
  const end = startOfOpeningTagForAriaLabel(html, "Paper trading board");
  if (start < 0 || end < 0) {
    throw new Error("arena command bar section not found");
  }
  return html.slice(start, end);
}

function extractCandidateArenaPaperBoardSection(html: string): string {
  const ariaStart = html.indexOf('aria-label="Paper trading board"');
  const start = html.lastIndexOf("<section", ariaStart);
  const end = html.indexOf('aria-label="Candidate Arena leaderboard"', ariaStart);
  if (ariaStart < 0 || start < 0 || end < 0) {
    throw new Error("candidate arena paper board section not found");
  }
  return html.slice(start, end);
}

function extractCandidateArenaMetricStripSection(html: string): string {
  const labelStart = html.indexOf(">Arena runner<");
  const wrapperStart = html.lastIndexOf('data-operator-ui="metric-strip"', labelStart);
  const start = html.lastIndexOf("<div", wrapperStart);
  const end = html.indexOf('aria-label="Paper trading board"', labelStart);
  if (labelStart < 0 || wrapperStart < 0 || start < 0 || end < 0) {
    throw new Error("candidate arena metric strip not found");
  }
  return html.slice(start, end);
}

function extractCandidateArenaLeaderboardSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Candidate Arena leaderboard");
  const end = html.indexOf('aria-label="Candidate Arena inspector"', start);
  if (start < 0 || end < 0) {
    throw new Error("candidate arena leaderboard section not found");
  }
  return html.slice(start, end);
}

function extractTradingPromotionBoundarySection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Trading promotion boundary");
  const messagesStart = html.indexOf('aria-label="Operator messages"', start);
  const safetyStart = html.indexOf('aria-label="Safety boundary"', start);
  const endCandidates = [messagesStart, safetyStart].filter((index) => index >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : -1;
  if (start < 0) {
    throw new Error("trading promotion boundary section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractOperatorDecisionBarSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Operator decision bar");
  const packetStart = html.indexOf('aria-label="Trading review packet"', start);
  const promotionStart = html.indexOf('aria-label="Trading promotion boundary"', start);
  const endCandidates = [packetStart, promotionStart].filter((index) => index >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : -1;
  if (start < 0) {
    throw new Error("operator decision bar section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractTradingReviewPacketSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Trading review packet");
  const promotionStart = html.indexOf('aria-label="Trading promotion boundary"', start);
  const messagesStart = html.indexOf('aria-label="Operator messages"', start);
  const endCandidates = [promotionStart, messagesStart].filter((index) => index >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : -1;
  if (start < 0) {
    throw new Error("trading review packet section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractTradingPaperReadbackSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Trading paper readback");
  const tradeStatusStart = html.indexOf('aria-label="Trade status"', start);
  if (start < 0) {
    throw new Error("trading paper readback section not found");
  }
  return html.slice(start, tradeStatusStart < 0 ? undefined : tradeStatusStart);
}

function extractTradingChartSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "BTCUSDT futures chart");
  const paperSummaryStart = html.indexOf('aria-label="Paper trading review summary"', start);
  if (start < 0) {
    throw new Error("trading chart section not found");
  }
  return html.slice(start, paperSummaryStart < 0 ? undefined : paperSummaryStart);
}

function extractResearchSignalsSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Research signals");
  const end = html.indexOf('aria-label="Research cycle"', start);
  if (start < 0 || end < 0) {
    throw new Error("research signals section not found");
  }
  return html.slice(start, end);
}

function extractFindingClustersSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Finding clusters");
  const end = html.indexOf('aria-label="Research signals"', start);
  if (start < 0 || end < 0) {
    throw new Error("finding clusters section not found");
  }
  return html.slice(start, end);
}

function extractResearchCycleSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Research cycle");
  const end = firstPositiveIndex([
    html.indexOf('aria-label="Agent generated Trading System"', start),
    html.indexOf('aria-label="Fixture notice"', start),
    html.indexOf('aria-label="Details boundary"', start)
  ]);
  if (start < 0) {
    throw new Error("research cycle section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function firstPositiveIndex(indexes: number[]): number {
  const positives = indexes.filter((index) => index >= 0);
  return positives.length ? Math.min(...positives) : -1;
}

function extractFixtureNoticeSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Fixture notice");
  const end = html.indexOf('aria-label="Details boundary"', start);
  if (start < 0 || end < 0) {
    throw new Error("fixture notice section not found");
  }
  return html.slice(start, end);
}

function extractDetailsBoundarySection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Details boundary");
  const end = html.indexOf('aria-label="Details"', start);
  if (start < 0 || end < 0) {
    throw new Error("details boundary section not found");
  }
  return html.slice(start, end);
}

function extractDetailsShellSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Details");
  const end = html.indexOf('aria-label="ResearchPreflight Evidence"', start);
  if (start < 0 || end < 0) {
    throw new Error("details shell section not found");
  }
  return html.slice(start, end);
}

function extractDetailsInfoSection(html: string, label: string): string {
  const ariaStart = html.indexOf(`aria-label="${label}"`);
  const start = startOfOpeningTagForAriaLabel(html, label);
  if (ariaStart < 0 || start < 0) {
    throw new Error(`${label} section not found`);
  }
  const nextPanel = html.indexOf('<section data-operator-ui="panel"', ariaStart + label.length);
  return html.slice(start, nextPanel < 0 ? undefined : nextPanel);
}

function extractOperatorMessagesSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Operator messages");
  const end = html.indexOf('aria-label="Safety boundary"', start);
  if (start < 0) {
    throw new Error("operator messages section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractSafetyBoundarySection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Safety boundary");
  const end = html.indexOf('aria-label="Trading cockpit"', start);
  if (start < 0) {
    throw new Error("safety boundary section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function startOfOpeningTagForAriaLabel(html: string, label: string): number {
  const ariaStart = html.indexOf(`aria-label="${label}"`);
  if (ariaStart < 0) {
    return -1;
  }
  const sectionStart = html.lastIndexOf("<section", ariaStart);
  const divStart = html.lastIndexOf("<div", ariaStart);
  return Math.max(sectionStart, divStart);
}

function extractCandidateRunsSection(html: string): string {
  const start = html.indexOf("Candidate Runs");
  const endCandidates = [
    html.indexOf("Run history", start),
    html.indexOf("Agent cycle controls", start)
  ].filter((index) => index >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : -1;
  if (start < 0) {
    throw new Error("candidate runs section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractReplayRunComparisonSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Run comparison");
  const end = startOfOpeningTagForAriaLabel(html, "Validation state");
  if (start < 0 || end < 0) {
    throw new Error("replay run comparison section not found");
  }
  return html.slice(start, end);
}

function extractReplayRunValidationStateSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Validation state");
  const endCandidates = [
    startOfOpeningTagForAriaLabel(html.slice(start), "Selected run detail") >= 0
      ? start + startOfOpeningTagForAriaLabel(html.slice(start), "Selected run detail")
      : -1,
    html.indexOf(">Run replay<", start)
  ].filter((index) => index >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : -1;
  if (start < 0) {
    throw new Error("replay run validation state section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractReplayRunDetailSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Selected run detail");
  const endCandidates = [
    html.indexOf(">Run replay<", start),
    startOfOpeningTagForAriaLabel(html.slice(start), "ResearchPreflight Evidence") >= 0
      ? start + startOfOpeningTagForAriaLabel(html.slice(start), "ResearchPreflight Evidence")
      : -1
  ].filter((index) => index >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : -1;
  if (start < 0) {
    throw new Error("replay run detail section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractReplayRunHistorySection(html: string): string {
  const start = html.indexOf(">Run history<");
  const end = startOfOpeningTagForAriaLabel(html.slice(start), "Selected run detail") >= 0
    ? start + startOfOpeningTagForAriaLabel(html.slice(start), "Selected run detail")
    : -1;
  if (start < 0) {
    throw new Error("replay run history section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractCandidateLatestValidationStateSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Candidate latest validation state");
  const end = html.indexOf(">Spec</div>", start);
  if (start < 0) {
    throw new Error("candidate latest validation state section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractRunControlSection(html: string): string {
  const start = html.indexOf("Run Control");
  const end = html.indexOf(">Improvement<", start);
  if (start < 0) {
    throw new Error("run control section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractLedgerSection(html: string): string {
  return extractDetailsInfoSection(html, "Ledger");
}

function extractTradingRunSection(html: string): string {
  return extractDetailsInfoSection(html, "Trading Run");
}

function extractTradingGatewayEnvironmentSection(html: string): string {
  return extractDetailsInfoSection(html, "Trading gateway environment");
}

function extractImprovementSection(html: string): string {
  return extractDetailsInfoSection(html, "Improvement");
}

function extractResearchPreflightEvidenceSection(html: string): string {
  return extractDetailsInfoSection(html, "ResearchPreflight Evidence");
}

function extractMaterializationAttemptSection(html: string): string {
  return extractDetailsInfoSection(html, "Materialization Attempt");
}

function extractSandboxSection(html: string): string {
  return extractDetailsInfoSection(html, "Sandbox");
}

function extractTradingRunTranscriptSection(html: string): string {
  const start = html.indexOf("Trading Run Transcript");
  const end = html.indexOf(">Trading System<", start);
  if (start < 0) {
    throw new Error("trading run transcript section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractExecutionModesSection(html: string): string {
  const start = html.indexOf('aria-label="Trading execution modes"');
  if (start < 0) {
    throw new Error("trading execution modes section not found");
  }
  return html.slice(start);
}

function extractMarketDataProvenanceSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Market data provenance");
  const end = html.indexOf('aria-label="BTCUSDT public market snapshot"', start);
  if (start < 0 || end < 0) {
    throw new Error("market data provenance section not found");
  }
  return html.slice(start, end);
}

function extractTradeStatusSection(html: string): string {
  const start = startOfOpeningTagForAriaLabel(html, "Trade status");
  const end = html.indexOf('data-slot="tabs-content"', start + 1);
  if (start < 0) {
    throw new Error("trade status section not found");
  }
  return html.slice(start, end < 0 ? undefined : end);
}

function extractOpeningTagForAriaLabel(html: string, label: string): string {
  const labelIndex = html.indexOf(`aria-label="${label}"`);
  const start = html.lastIndexOf("<", labelIndex);
  const end = html.indexOf(">", labelIndex);
  if (labelIndex < 0 || start < 0 || end < 0) {
    throw new Error(`${label} opening tag not found`);
  }
  return html.slice(start, end + 1);
}

function candidateWithPublicMarketSurface(
  surface: PublicMarketLivenessSurfaceReadModel
): CandidateInspectReadModel {
  const baseCandidate = arenaSelectedCandidate();
  return {
    ...baseCandidate,
    trading_substrate: {
      latest_order_fill_surface: baseCandidate.trading_substrate?.latest_order_fill_surface ?? null,
      latest_public_market_liveness_surface: surface,
      latest_private_readiness_preflight_surface:
        baseCandidate.trading_substrate?.latest_private_readiness_preflight_surface ?? null,
      latest_private_readiness_posture:
        baseCandidate.trading_substrate?.latest_private_readiness_posture ?? null,
      private_readiness_posture_history:
        baseCandidate.trading_substrate?.private_readiness_posture_history ?? [],
      latest_private_readiness_policy_decision:
        baseCandidate.trading_substrate?.latest_private_readiness_policy_decision ?? null,
      latest_private_read_gate_decision:
        baseCandidate.trading_substrate?.latest_private_read_gate_decision ?? null,
      latest_trading_gateway_contract:
        baseCandidate.trading_substrate?.latest_trading_gateway_contract ?? null,
      latest_account_position_risk_mirror_surface:
        baseCandidate.trading_substrate?.latest_account_position_risk_mirror_surface ?? null
    }
  };
}

function paperTradingEvaluationFixture(overrides: Record<string, unknown> = {}) {
  return {
    evaluation_kind: "paper_trading_evaluation",
    evaluation_id: "paper-evaluation-candidate-profitable",
    candidate_id: "candidate-profitable",
    candidate_version_id: "candidate-version-profitable",
    status: "running",
    trading_run_id: "trading-run-candidate-profitable",
    trading_run_status: "running",
    runner_active: true,
    interval_ms: 60_000,
    next_observation_at: "2026-05-16T00:01:03.000Z",
    observation_count: 1,
    ledger_chain_complete: true,
    profit_loss: {
      revenue_usdt: 5,
      cost_usdt: 0.048,
      net_revenue_usdt: 4.952,
      net_return_pct: 0.04952
    },
    latest_order_request_id: "order-request-001",
    latest_gateway_outcome: "dry_run_only",
    latest_execution_status: "dry_run_recorded",
    latest_market_snapshot: {
      symbol: "BTCUSDT",
      price: 65_000,
      moving_average_fast: 65_025,
      moving_average_slow: 64_975,
      volatility: 0.001,
      expected_direction: "long",
      observed_at: "2026-05-16T00:00:03.000Z",
      source_kind: "binance_production_public_rest",
      authority_status: "read_only"
    },
    latest_decision: {
      decision_kind: "order_request",
      source_kind: "trading_system_decision",
      reason: "trading_system_order_request",
      observed_at: "2026-05-16T00:00:03.000Z",
      order_request: {
        intent_kind: "place_order",
        symbol: "BTCUSDT",
        side: "buy",
        order_type: "limit",
        quantity: "0.001",
        limit_price: "65000"
      },
      authority_status: "trace_only"
    },
    paper_account_snapshot: {
      wallet_balance_usdt: "9999.952",
      available_balance_usdt: "10003.652",
      equity_usdt: "10004.952",
      realized_pnl_usdt: "0",
      unrealized_pnl_usdt: "5",
      fee_paid_usdt: "0.024",
      slippage_paid_usdt: "0.018",
      funding_paid_usdt: "0.006",
      margin_reserved_usdt: "1.3",
      position: {
        symbol: "BTCUSDT",
        quantity: "0.001",
        side: "long",
        average_entry_price: "60000",
        mark_price: "65000",
        notional_usdt: "65"
      },
      open_order_count: 0,
      authority_status: "not_live"
    },
    latest_fill: {
      fill_id: "paper-fill-order-1-fill-1",
      order_id: "paper-order-1",
      fill_status: "filled",
      fill_price: "60000",
      fill_quantity: "0.001",
      fee_usdt: "0.024",
      slippage_usdt: "0.018",
      funding_usdt: "0.006",
      trade_time: "2026-05-16T00:00:03.500Z",
      source_trade_id: "agg-60000-001"
    },
    latest_public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: "2026-05-16T00:00:03.000Z",
      source_kind: "binance_production_public_websocket",
      source_priority: "websocket_primary",
      freshness: "fresh",
      ws_connected: true,
      rest_fallback_used: false,
      gap_detected: false,
      last_update_id: "11",
      stream_marker: "binance-ws-aggTrade-991",
      agg_trades: [],
      order_book: {
        symbol: "BTCUSDT",
        observed_at: "2026-05-16T00:00:03.000Z",
        source_kind: "binance_production_public_hybrid",
        sync_status: "synced",
        last_update_id: "11",
        top_bid_price: "64999.9",
        top_bid_quantity: "1.2",
        top_ask_price: "65000.1",
        top_ask_quantity: "1.1",
        gap_detected: false,
        authority_status: "read_only"
      },
      authority_status: "read_only"
    },
    market_data_source: "binance_production_public_websocket",
    account_provider: "fake_paper_account",
    executor: "fake_paper_order_executor",
    score_source: "paper_trading_engine",
    authority_status: "not_live",
    ...overrides
  } as PaperTradingEvaluationReadModel;
}

function tradingReviewFixture(
  overrides: Partial<OperatorReadModel["trading_review"]> = {}
): OperatorReadModel["trading_review"] {
  const reviewBase: Omit<OperatorReadModel["trading_review"], "review_packet"> = {
    review_kind: "trading_review",
    status: "promoted_for_trading_review",
    readiness_status: "collecting_paper_evidence",
    active_candidate_id: "candidate-profitable",
    active_candidate_version_id: "candidate-version-profitable",
    display_name: "candidate-profitable",
    promoted_at: "2026-05-16T00:00:04.000Z",
    paper_trading_evaluation_id: "paper-evaluation-candidate-profitable",
    paper_qualification_status: "collecting_evidence",
    paper_qualification_reasons: [
      "min_observation_count_not_met",
      "min_elapsed_ms_not_met"
    ],
    paper_evidence_window: {
      observation_count: 1,
      elapsed_ms: 60_000,
      failed_observation_count: 0,
      first_observed_at: "2026-05-16T00:00:03.000Z",
      last_observed_at: "2026-05-16T00:00:03.000Z"
    },
    paper_profit_loss: {
      revenue_usdt: 5,
      cost_usdt: 0.048,
      net_revenue_usdt: 4.952,
      net_return_pct: 0.04952
    },
    paper_trading_evaluation: paperTradingEvaluationFixture(),
    runner_status: "active",
    selected_candidate_id: "candidate-profitable",
    selected_matches_trading_review: true,
    next_action: "Continue paper trading until the evidence window qualifies.",
    live_disabled_reason: "mlp_paper_only",
    authority_status: "not_live"
  };
  const review = {
    ...reviewBase,
    ...overrides
  };
  return {
    ...review,
    review_packet: overrides.review_packet ?? tradingReviewPacketFixture(review)
  };
}

function tradingReviewPacketFixture(
  review: Omit<OperatorReadModel["trading_review"], "review_packet">
): OperatorReadModel["trading_review"]["review_packet"] {
  const topBlocker = review.paper_qualification_reasons[0];
  const publicExecutionSnapshot = review.paper_trading_evaluation.latest_public_execution_snapshot;
  return {
    packet_kind: "trading_review_packet",
    verdict: {
      readiness_status: review.readiness_status,
      qualification_status: review.paper_qualification_status,
      severity: review.selected_matches_trading_review ? "collecting" : "mismatch",
      top_blocker: review.selected_matches_trading_review ? topBlocker : "arena_selection_mismatch"
    },
    subject: {
      candidate_id: review.active_candidate_id,
      candidate_version_id: review.active_candidate_version_id,
      display_name: review.display_name,
      paper_trading_evaluation_id: review.paper_trading_evaluation_id,
      promoted_at: review.promoted_at,
      selected_candidate_id: review.selected_candidate_id,
      selected_matches_trading_review: review.selected_matches_trading_review
    },
    performance: {
      rank: 1,
      primary_rank_metric: "net_revenue_usdt",
      secondary_rank_metric: "net_return_pct",
      profit_loss: review.paper_profit_loss
    },
    evidence_quality: {
      evidence_window: review.paper_evidence_window,
      qualification_reasons: review.paper_qualification_reasons,
      blocker_groups: topBlocker ? [
        {
          group_kind: "evidence_window",
          severity: "collecting",
          blockers: review.paper_qualification_reasons,
          summary: "Paper evidence window is not mature enough for review.",
          next_action: "Continue paper observations until count and elapsed-time gates qualify."
        }
      ] : []
    },
    provenance: {
      market_data_source: review.paper_trading_evaluation.market_data_source,
      latest_public_execution_source: publicExecutionSnapshot?.source_priority,
      latest_public_execution_freshness: publicExecutionSnapshot?.freshness,
      latest_public_execution_ws_connected: publicExecutionSnapshot?.ws_connected,
      latest_public_execution_rest_fallback_used: publicExecutionSnapshot?.rest_fallback_used,
      latest_public_execution_stream_marker: publicExecutionSnapshot?.stream_marker,
      latest_fill_status: review.paper_trading_evaluation.latest_fill?.fill_status,
      order_book: publicExecutionSnapshot?.order_book
        ? {
            sync_status: publicExecutionSnapshot.order_book.sync_status,
            last_update_id: publicExecutionSnapshot.order_book.last_update_id,
            previous_final_update_id: publicExecutionSnapshot.order_book.previous_final_update_id,
            gap_detected: publicExecutionSnapshot.order_book.gap_detected,
            depth_level_count: publicExecutionSnapshot.order_book.depth_level_count,
            authority_status: "read_only"
          }
        : undefined
    },
    risk: tradingReviewPacketRiskFixture(review),
    runner: {
      runner_status: review.runner_status,
      runner_active: review.paper_trading_evaluation.runner_active,
      trading_run_status: review.paper_trading_evaluation.trading_run_status,
      last_observed_at: review.paper_trading_evaluation.last_observed_at,
      next_observation_at: review.paper_trading_evaluation.next_observation_at,
      authority_status: "not_live"
    },
    ledger: {
      evidence_status: review.paper_trading_evaluation.ledger_chain_complete
        ? "complete_chain"
        : "incomplete_chain",
      ledger_chain_complete: review.paper_trading_evaluation.ledger_chain_complete,
      latest_order_request_id: review.paper_trading_evaluation.latest_order_request_id,
      latest_gateway_outcome: review.paper_trading_evaluation.latest_gateway_outcome,
      latest_execution_status: review.paper_trading_evaluation.latest_execution_status,
      latest_decision_kind: review.paper_trading_evaluation.latest_decision?.decision_kind,
      authority_status: "not_live"
    },
    lineage: {
      lineage_status: "available",
      direction_kind: "trend_following",
      parent_candidate_id: "candidate-parent",
      parent_candidate_version_id: "candidate-version-parent",
      generated_by_agent: true,
      latest_finding: "Candidate produced non-negative net revenue after costs.",
      evaluation_status: "accepted",
      evaluation_score: 9.83,
      paper_board_learning: {
        rank: 1,
        net_revenue_usdt: 4.952,
        net_return_pct: 0.04952,
        observation_count: 1,
        qualification_status: "collecting_evidence",
        qualification_reasons: review.paper_qualification_reasons,
        top_blocker: "min_observation_count_not_met",
        summary: "Paper board rank #1: 4.952 net_revenue_usdt, 0.04952 net_return_pct, 1 observations, collecting_evidence.",
        next_research_focus: "Continue paper observations until count and elapsed-time gates qualify.",
        authority_status: "lineage_only"
      },
      authority_status: "lineage_only"
    },
    authority: {
      authority_status: "not_live",
      live_disabled_reason: "mlp_paper_only",
      no_authority: {
        live_exchange_authority: false,
        private_read_authority: false,
        order_submission_authority: false,
        credentials: false
      }
    },
    next_action: review.next_action
  };
}

function tradingReviewPacketRiskFixture(
  review: Omit<OperatorReadModel["trading_review"], "review_packet">
): OperatorReadModel["trading_review"]["review_packet"]["risk"] {
  const accountSnapshot = review.paper_trading_evaluation.paper_account_snapshot;
  return {
    open_order_count: review.paper_trading_evaluation.open_orders?.length ?? 0,
    account: accountSnapshot
      ? {
          equity_usdt: accountSnapshot.equity_usdt,
          available_balance_usdt: accountSnapshot.available_balance_usdt,
          wallet_balance_usdt: accountSnapshot.wallet_balance_usdt,
          margin_reserved_usdt: accountSnapshot.margin_reserved_usdt,
          authority_status: "not_live"
        }
      : undefined,
    position: accountSnapshot
      ? {
          symbol: accountSnapshot.position.symbol,
          side: accountSnapshot.position.side,
          quantity: accountSnapshot.position.quantity,
          notional_usdt: accountSnapshot.position.notional_usdt,
          average_entry_price: accountSnapshot.position.average_entry_price,
          mark_price: accountSnapshot.position.mark_price,
          authority_status: "not_live"
        }
      : undefined,
    latest_fill_status: review.paper_trading_evaluation.latest_fill?.fill_status,
    latest_failure_reason: review.latest_failure_reason
  };
}

function paperTradingBoardFixture(
  entryOverrides: Partial<PaperTradingBoardReadModel["entries"][number]> = {}
): PaperTradingBoardReadModel {
  return {
    board_kind: "paper_trading_board",
    primary_rank_metric: "net_revenue_usdt",
    secondary_rank_metric: "net_return_pct",
    evaluation_authority: "continuous_paper_trading",
    entries: [
      {
        rank: 1,
        candidate_id: "candidate-profitable",
        display_name: "candidate-profitable",
        evaluation_id: "paper-evaluation-candidate-profitable",
        status: "running",
        runner_status: "active",
        promotion_gate_status: "collecting_paper_evidence",
        qualification_status: "collecting_evidence",
        qualification_reasons: [
          "min_observation_count_not_met",
          "min_elapsed_ms_not_met"
        ],
        evidence_window: {
          observation_count: 1,
          elapsed_ms: 60_000,
          failed_observation_count: 0
        },
        risk_summary: {
          open_order_count: 0,
          latest_fill_status: "filled"
        },
        trend: {
          direction: "insufficient_history",
          net_revenue_delta_usdt: 0,
          net_return_delta_pct: 0,
          observation_count_delta: 0,
          authority_status: "not_promotion_authority"
        },
        blocker_density: {
          blocker_count: 2,
          blocker_density: 2,
          failed_observation_ratio: 0,
          top_blocker: "min_observation_count_not_met",
          authority_status: "not_promotion_authority"
        },
        observation_count: 1,
        trading_run_id: "trading-run-candidate-profitable",
        last_observed_at: "2026-05-16T00:00:03.000Z",
        next_observation_at: "2026-05-16T00:01:03.000Z",
        profit_loss: {
          revenue_usdt: 5,
          cost_usdt: 0.048,
          net_revenue_usdt: 4.952,
          net_return_pct: 0.04952
        },
        market_data_source: "binance_production_public_websocket",
        latest_public_execution_source: "websocket_primary",
        latest_fill_status: "filled",
        open_order_count: 0,
        authority_status: "not_live",
        ...entryOverrides
      }
    ],
    live_disabled: true,
    authority_status: "not_live"
  };
}

function operatorReadModelFixture(overrides: Partial<OperatorReadModel> = {}): OperatorReadModel {
  return {
    operator_kind: "ouroboros_operator",
    command_descriptors: [],
    candidate_arena: fixtureCandidateArena,
    selected_candidate_id: "candidate-profitable",
    selected_candidate: arenaSelectedCandidate(),
    selected_paper_evidence: {
      status: "not_run",
      ledger_chain_complete: false,
      authority_status: "not_live"
    },
    selected_paper_trading_evaluation: paperTradingEvaluationFixture(),
    paper_trading_board: paperTradingBoardFixture(),
    trading_review: tradingReviewFixture(),
    researcher_provider: {
      selected_provider: "codex",
      available_providers: ["codex", "fixture"],
      authority_status: "research_only"
    },
    agent_profiles: [],
    latest_commands: [],
    live_disabled: true,
    authority_status: "not_live",
    ...overrides
  };
}

function arenaSelectedCandidate(
  overrides: Partial<CandidateInspectReadModel> = {}
): CandidateInspectReadModel {
  const candidate = candidateWithAgentCycleMaterialization(fixtureCandidate);
  return {
    ...candidate,
    candidate_id: "candidate-profitable",
    display_name: "Arena trend Trading System",
    full_cycle_lineage: candidate.full_cycle_lineage
      ? {
          ...candidate.full_cycle_lineage,
          generated: {
            system_code_ref: { record_kind: "system_code", id: "system-code-arena-profitable" },
            artifact_digest: "sha256:arena-profitable",
            generated_by_agent: true
          },
          evidence: candidate.full_cycle_lineage.evidence
            ? {
                ...candidate.full_cycle_lineage.evidence,
                evaluation_status: "accepted",
                evaluation_score: 1,
                profit_loss: {
                  revenue_usdt: 10,
                  cost_usdt: 0.17,
                  net_revenue_usdt: 9.83,
                  net_return_pct: 0.0983
                },
                direction_kind: "trend_following"
              }
            : undefined
        }
      : undefined,
    ...overrides
  };
}

function selectedCandidateWithTranscript(itemCount: number): CandidateInspectReadModel {
  const candidate = arenaSelectedCandidate();
  const items = Array.from({ length: itemCount }, (_, index) => ({
    item_id: `transcript-item-${index + 1}`,
    item_kind: "sandbox_log" as const,
    occurred_at: `2026-05-16T00:00:${String(index + 1).padStart(2, "0")}.000Z`,
    label: `Sandbox log ${index + 1}`,
    summary: `Sandbox log summary ${index + 1}`,
    ref: { record_kind: "sandbox_log", id: `sandbox-log-${index + 1}` },
    authority_status: "trace_only"
  }));

  return {
    ...candidate,
    runtime: {
      ...candidate.runtime,
      transcript: {
        transcript_kind: "trading_run_transcript",
        has_activity: true,
        item_count: items.length,
        latest_item: items.at(-1) ?? null,
        items,
        authority_status: "not_live",
        no_authority: {
          live_exchange_authority: false,
          private_read_authority: false,
          order_submission_authority: false,
          credentials: false
        }
      }
    }
  };
}

function emptyLedgerSourceRecords(): LedgerSourceRecordsReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    chain_count: 0,
    chains: [],
    latest_order_request: null,
    latest_gateway_result: null,
    latest_execution_result: null,
    order_request: {
      ref: { record_kind: "order_request", id: "none" },
      label: "Order request",
      status: "not_submitted",
      authority_status: "not_submitted"
    },
    gateway_result: {
      ref: { record_kind: "gateway_result", id: "none" },
      label: "Gateway result",
      status: "not_evaluated",
      authority_status: "not_live"
    },
    execution_result: {
      ref: { record_kind: "execution_result", id: "none" },
      label: "Execution result",
      status: "not_submitted",
      authority_status: "not_submitted"
    }
  };
}

const fixtureCandidate: CandidateInspectReadModel = {
  candidate_id: "fixture-candidate-sealed-replay-001",
  display_name: "Fixture generic trading-system candidate",
  status: "fixture_only",
  active_version_id: "fixture-candidate-version-001",
  fixture_notice: {
    mode: "fixture_convenience_mode",
    label: "Fixture / convenience mode",
    statements: [
      "No provider has run.",
      "No trading-system program has executed.",
      "No evaluator has run and no evidence has counted."
    ]
  },
  candidate_version: {
    candidate_version_id: "fixture-candidate-version-001",
    version_label: "fixture-v1",
    provenance_refs: [{ record_kind: "agent_run", id: "fixture-agent-run-001" }]
  },
  spec: {
    ref: { record_kind: "trading_system_spec", id: "fixture-spec" },
    summary: "Fixture spec",
    market: "ExternalTradingApiProvider",
    instrument: "generic trading instruments",
    supported_stage_binding_profiles: ["backtest", "paper", "live"]
  },
  program: {
    ref: { record_kind: "trading_system_program", id: "fixture-program" },
    summary: "Fixture program",
    manifest: {
      ref: { record_kind: "program_manifest", id: "fixture-manifest" },
      declared_runtime: "fixture-sandbox-placeholder",
      declared_outputs: ["OrderRequest placeholder"]
    },
    validation: {
      ref: { record_kind: "program_validation_record", id: "fixture-validation" },
      label: "Program validation",
      status: "fixture_placeholder",
      authority_status: "not_executable"
    }
  },
  capability_package: {
    ref: { record_kind: "capability_package", id: "fixture-package" },
    summary: "Fixture package",
    manifest: {
      ref: { record_kind: "capability_manifest", id: "fixture-capability-manifest" },
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_fixture_market_context"],
      forbidden_contents: ["exchange_credentials"]
    },
    admission: {
      ref: { record_kind: "capability_package_admission_record", id: "fixture-admission" },
      label: "Capability admission",
      status: "fixture_placeholder",
      authority_status: "not_scanned"
    },
    grant: {
      ref: { record_kind: "capability_grant", id: "fixture-grant" },
      label: "Capability grant",
      status: "fixture_placeholder",
      authority_status: "not_granted"
    },
    mount: {
      ref: { record_kind: "capability_mount_record", id: "fixture-mount" },
      label: "Capability mount",
      status: "fixture_placeholder",
      authority_status: "not_mounted"
    }
  },
  agent_provider: {
    agent_spec: placeholder("agent_spec", "fixture-agent-spec", "Agent spec"),
    agent_session: placeholder("agent_session", "fixture-agent-session", "Agent session"),
    agent_run: placeholder("agent_run", "fixture-agent-run", "Agent run"),
    agent_event: placeholder("agent_event", "fixture-agent-event", "Agent event"),
    provider_readiness: placeholder("provider_readiness_record", "fixture-readiness", "Provider readiness"),
    provider_probe_attempt: placeholder("provider_probe_attempt", "fixture-probe", "Provider probe")
  },
  runtime: {
    ref: { record_kind: "trading_run", id: "fixture-runtime" },
    stage_binding_profile: "paper",
    authority_status: "not_live",
    placement: placeholder("sandbox_placement", "fixture-placement", "Sandbox placement"),
    hands_environment: placeholder("hands_environment", "fixture-hands", "Hands environment"),
    memory_surface: {
      ref: { record_kind: "runtime_memory_surface", id: "fixture-memory" },
      trust_class: "fixture_context",
      access_mode: "read_only",
      surface_version: "fixture-v1",
      visibility: "operator_visible",
      quarantine_status: "not_quarantined",
      authority_status: "not_evidence"
    }
  },
  trace: placeholder("trace_placeholder", "fixture-trace", "Trace placeholder"),
  evaluation: {
    has_runs: true,
    latest_run: {
      run_id: "fixture-eval",
      status: "created",
      stage: "backtest",
      profile: "backtest",
      execution_mode: "host_local",
      trace_ref: { record_kind: "trace_placeholder", id: "fixture-trace" },
      authority_status: "not_counted",
      created_at: "2026-05-05T00:00:00.000Z",
      error_state: null
    },
    latest_comparison_set: {
      comparison_set_id: "fixture-comparison",
      stage_binding_ref: { record_kind: "stage_binding", id: "fixture-stage-binding" },
      evaluation_run_refs: [{ record_kind: "evaluation_run_record", id: "fixture-eval" }],
      comparability_status: "not_evaluated",
      comparability_reason: "no_external_evaluator",
      authority_status: "not_counted",
      created_at: "2026-05-05T00:00:00.000Z"
    },
    latest_sealing_decision: {
      sealing_decision_id: "fixture-sealing",
      evaluation_comparison_set_ref: { record_kind: "evaluation_comparison_set", id: "fixture-comparison" },
      evaluation_run_refs: [{ record_kind: "evaluation_run_record", id: "fixture-eval" }],
      evidence_disposition: "not_counted",
      disposition_reason: "no_external_evaluator",
      authority_status: "not_counted",
      created_at: "2026-05-05T00:00:00.000Z"
    },
    trace: {
      state: "linked",
      trace_ref: { record_kind: "trace_placeholder", id: "fixture-trace" },
      authority_status: "not_counted",
      provider_output_artifact_refs: [],
      debug_artifact_refs: []
    },
    evidence_classifications: [
      {
        classification_id: "fixture-classification-trace",
        classified_ref: { record_kind: "trace_placeholder", id: "fixture-trace" },
        classification_kind: "trace_debug_material",
        classification_status: "trace_only",
        classification_reason: "no_external_evaluator",
        authority_status: "not_counted",
        created_at: "2026-05-05T00:00:00.000Z"
      }
    ],
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "no_external_evaluator",
      authority_status: "not_counted"
    },
    error_state: null,
    run: placeholder("evaluation_run_record", "fixture-eval", "Evaluation run"),
    comparison_set: placeholder("evaluation_comparison_set", "fixture-comparison", "Evaluation comparison set"),
    sealing_decision: placeholder("evidence_sealing_decision", "fixture-sealing", "Evidence sealing decision")
  }
};

function placeholder(record_kind: string, id: string, label: string) {
  return {
    ref: { record_kind, id },
    label,
    status: "fixture_placeholder",
    authority_status: "not_executed"
  };
}
