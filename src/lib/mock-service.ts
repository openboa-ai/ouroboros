import type {
  BootstrapState,
  CheckpointSummary,
  DecisionEntry,
  WorkspaceService
} from "./service-contract";
import type { StrategyManifest } from "./workspace-contract";
import checkpointIndexTemplate from "../../templates/strategy-workspace/checkpoints/index.json";
import exportPolicyTemplate from "../../templates/strategy-workspace/exports/policy.json";
import strategyTemplate from "../../templates/strategy-workspace/strategy.json";

export const mockStrategyManifest = strategyTemplate as StrategyManifest;

const checkpointIndex = checkpointIndexTemplate as {
  current: {
    checkpoint_id: string;
    alias: string;
    type: "promotion" | "export" | "incident";
  };
};

const exportPolicy = exportPolicyTemplate as {
  policy_id: string;
};

const bootstrapState: BootstrapState = {
  mode: "paper",
  automationStatus: "active",
  statusNote: "Research and live-facing context are running through the service layer.",
  workspace: {
    artifactId: mockStrategyManifest.artifact_id,
    slug: mockStrategyManifest.slug,
    liveLaneLabel: "live-lane/main",
    currentCheckpointAlias: checkpointIndex.current.alias,
    exportPolicyLabel: exportPolicy.policy_id
  },
  providers: [
    {
      name: "Codex",
      statusLabel: "Connected via user auth",
      usageLabel: "6.1k tokens this session"
    },
    {
      name: "Claude Code",
      statusLabel: "Connected via user auth",
      usageLabel: "2 managed sessions active"
    }
  ],
  metrics: [
    {
      label: "Net PnL",
      value: "+$4,218",
      delta: "Includes fees, funding, slippage, and model cost",
      description: "Current promoted artifact",
      icon: "up"
    },
    {
      label: "Risk Budget",
      value: "61%",
      delta: "Adaptive budget after BTC momentum expansion",
      description: "Trader-controlled portfolio allocation",
      icon: "risk"
    },
    {
      label: "Leverage",
      value: "4.2x",
      delta: "Dynamic within user cap",
      description: "Live portfolio effective leverage",
      icon: "leverage"
    },
    {
      label: "Intervention Load",
      value: "1 incident",
      delta: "No protective-stop violations in current live state",
      description: "Fixed core evaluation dimension",
      icon: "momentum"
    }
  ],
  priceSeries: [
    { label: "00:00", btc: 68620, eth: 3528 },
    { label: "04:00", btc: 68910, eth: 3554 },
    { label: "08:00", btc: 69580, eth: 3624 },
    { label: "12:00", btc: 69220, eth: 3598 },
    { label: "16:00", btc: 70140, eth: 3660 },
    { label: "20:00", btc: 70610, eth: 3695 }
  ],
  equitySeries: [
    { label: "Mon", value: 1180 },
    { label: "Tue", value: 1670 },
    { label: "Wed", value: 2140 },
    { label: "Thu", value: 2865 },
    { label: "Fri", value: 3340 },
    { label: "Sat", value: 4218 }
  ],
  exposureSeries: [
    { symbol: "BTCUSDT", value: 58 },
    { symbol: "ETHUSDT", value: 31 },
    { symbol: "Dry Powder", value: 11 }
  ],
  positions: [
    {
      symbol: "BTCUSDT",
      side: "LONG",
      size: "0.46 BTC",
      entry: "69,880",
      pnl: "+$1,284",
      protectiveStop: "68,940",
      contextTag: "breakout + flow + risk budget"
    },
    {
      symbol: "ETHUSDT",
      side: "SHORT",
      size: "11.2 ETH",
      entry: "3,674",
      pnl: "+$312",
      protectiveStop: "3,728",
      contextTag: "fade extension + book pressure"
    }
  ],
  orders: [
    {
      id: "order-1",
      symbol: "BTCUSDT",
      kind: "Protective stop",
      status: "Active",
      statusTone: "positive",
      summary: "Exchange-native stop verified after latest position expansion."
    },
    {
      id: "order-2",
      symbol: "ETHUSDT",
      kind: "Scale-out",
      status: "Queued",
      statusTone: "warning",
      summary: "Waiting for volatility band confirmation before partial close."
    }
  ],
  decisions: [
    {
      id: "decision-1",
      kind: "Entry",
      tone: "positive",
      headline: "BTC long still favored",
      reason:
        "Recent breakout remains supported by positive flow and no current liveness degradation. Trader kept leverage below the user cap and refreshed the protective stop path.",
      timestamp: "UTC 2026-04-10 13:42"
    },
    {
      id: "decision-2",
      kind: "Risk",
      tone: "warning",
      headline: "ETH short stays smaller than BTC long",
      reason:
        "Portfolio-level context still prefers BTC as the dominant expression. ETH remains active but receives lower size due to weaker cumulative checkpoint evidence.",
      timestamp: "UTC 2026-04-10 13:36"
    },
    {
      id: "decision-3",
      kind: "Evaluation",
      tone: "neutral",
      headline: "Rejected candidate remains in shadow evaluation",
      reason:
        "A rejected candidate is still running under the same fixed paper policy so the evaluator can inspect whether rejection quality is degrading.",
      timestamp: "UTC 2026-04-10 12:58"
    }
  ],
  checkpoints: [
    {
      id: "0196256c-e9aa-7c4d-967e-cb0ec87907df",
      alias: "promote-btc-eth-apr10",
      type: "promotion",
      typeTone: "positive",
      summary: "Promoted after time-series paper outperformance across recent and cumulative views.",
      createdAt: "UTC 2026-04-10 12:02",
      performance: "Paper +6.4% / Shadow +2.1%"
    },
    {
      id: "0196251f-7e08-76f2-b48d-0f88a2995874",
      alias: "incident-stop-repair",
      type: "incident",
      typeTone: "danger",
      summary: "Execution core repaired a missing stop registration before allowing new entries.",
      createdAt: "UTC 2026-04-09 18:40",
      performance: "No forced flatten required"
    },
    {
      id: "01962489-41de-73ce-9f5b-ff2696878ec9",
      alias: "export-paper-stack",
      type: "export",
      typeTone: "warning",
      summary: "Sanitized export generated from a fresh checkpoint before sharing the live-centered asset.",
      createdAt: "UTC 2026-04-09 08:05",
      performance: "Export policy sanitized-live-centered"
    }
  ]
};

class MockWorkspaceService implements WorkspaceService {
  private state: BootstrapState = structuredClone(bootstrapState);

  async getBootstrapState(): Promise<BootstrapState> {
    return structuredClone(this.state);
  }

  async pauseGlobalAutomation(): Promise<BootstrapState> {
    this.state = {
      ...this.state,
      mode: "observer",
      automationStatus: "paused",
      statusNote: "Global automation was paused through the service boundary."
    };
    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Control",
      tone: "warning",
      headline: "Global automation paused",
      reason:
        "The service layer accepted a pause command, switched the client to observer mode, and preserved the live-centered workspace context for inspection.",
      timestamp: this.nowLabel()
    });

    return structuredClone(this.state);
  }

  async flattenAllPositions(): Promise<BootstrapState> {
    this.state = {
      ...this.state,
      statusNote: "Service-layer intervention flattened all live positions in the mock runtime.",
      positions: [],
      orders: [],
      metrics: this.state.metrics.map((metric) =>
        metric.label === "Risk Budget"
          ? {
              ...metric,
              value: "0%",
              delta: "Reset after flatten-all intervention"
            }
          : metric
      )
    };

    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Intervention",
      tone: "warning",
      headline: "All live positions flattened",
      reason:
        "The service layer executed a mock flatten-all intervention and reset current positions and orders without bypassing the workspace contract.",
      timestamp: this.nowLabel()
    });

    this.prependCheckpoint({
      id: this.nextId("checkpoint"),
      alias: "incident-flatten-all",
      type: "incident",
      typeTone: "danger",
      summary: "Client-triggered flatten-all command captured as an incident checkpoint.",
      createdAt: this.nowLabel(),
      performance: "Live risk reset to flat"
    });

    return structuredClone(this.state);
  }

  async createExportCheckpoint(): Promise<BootstrapState> {
    const alias = `export-${new Date().toISOString().slice(11, 16).replace(":", "")}`;

    this.state = {
      ...this.state,
      statusNote: "A fresh export checkpoint was created from the current live-centered asset."
    };

    this.prependCheckpoint({
      id: this.nextId("checkpoint"),
      alias,
      type: "export",
      typeTone: "warning",
      summary: "Fresh export checkpoint created before generating a sanitized live-centered bundle.",
      createdAt: this.nowLabel(),
      performance: "Export policy sanitized-live-centered"
    });

    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Export",
      tone: "neutral",
      headline: "Export checkpoint created",
      reason:
        "The service layer created a fresh checkpoint before export so the client can share a stable live-centered asset instead of a drifting mutable state.",
      timestamp: this.nowLabel()
    });

    return structuredClone(this.state);
  }

  private prependCheckpoint(checkpoint: CheckpointSummary) {
    this.state = {
      ...this.state,
      workspace: {
        ...this.state.workspace,
        currentCheckpointAlias: checkpoint.alias
      },
      checkpoints: [checkpoint, ...this.state.checkpoints]
    };
  }

  private prependDecision(decision: DecisionEntry) {
    this.state = {
      ...this.state,
      decisions: [decision, ...this.state.decisions]
    };
  }

  private nextId(prefix: string) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  private nowLabel() {
    return `UTC ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  }
}

export const mockWorkspaceService = new MockWorkspaceService();
