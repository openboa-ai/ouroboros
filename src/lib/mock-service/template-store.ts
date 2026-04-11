import type {
  BootstrapState,
  DecisionEntry,
  LiveOrder,
  LivePosition,
  MetricCardData,
  ProviderStatus,
  TradingMode
} from "../service-contract";
import type {
  CheckpointIndex,
  CollectionRecord,
  LiveLaneState,
  StrategyManifest
} from "../workspace-contract";
import checkpointIndexTemplate from "../../../templates/strategy-workspace/checkpoints/index.json";
import exportPolicyTemplate from "../../../templates/strategy-workspace/exports/policy.json";
import collectionsTemplate from "../../../templates/strategy-workspace/indexes/collections.json";
import importsTemplate from "../../../templates/strategy-workspace/imports/index.json";
import operationsTemplate from "../../../templates/strategy-workspace/operations/index.json";
import btcAggEntriesRaw from "../../../templates/strategy-workspace/collections/items/019626b0-4d0a-7a72-9b4e-9d8e11d0f901/entries.ndjson?raw";
import macroNewsEntriesRaw from "../../../templates/strategy-workspace/collections/items/019626b6-c73a-7fe6-b0a5-64ac631d5102/entries.ndjson?raw";
import btcAggBlobOneRaw from "../../../templates/strategy-workspace/blobs/sha256/cd36e47d463d9e2efe3e2030670ca7694a9f303a8837cad4e4e5135c427f945f.txt?raw";
import btcAggBlobTwoRaw from "../../../templates/strategy-workspace/blobs/sha256/aef3c2aa9075dc26b7484d71d06d10c152f5310cd34d5eb2b3b3b6fa915e4b3c.txt?raw";
import btcAggBlobThreeRaw from "../../../templates/strategy-workspace/blobs/sha256/7bbdd0eec8d01854af7185348af542fb665987debe396f2ce2e88f4e35f8af0e.txt?raw";
import macroNewsBlobOneRaw from "../../../templates/strategy-workspace/blobs/sha256/2b0f06db4a1f0530763ad7aa5a10bc2e47017dcaf4f79f8fa0e6a5819d57081f.txt?raw";
import macroNewsBlobTwoRaw from "../../../templates/strategy-workspace/blobs/sha256/e2d312f2f5767f7334ba8d3fa90fc2c9d66b2d05d4c77db8bc8d289d5fc5f7ec.txt?raw";
import liveLaneTemplate from "../../../templates/strategy-workspace/live/live-lane.json";
import strategyTemplate from "../../../templates/strategy-workspace/strategy.json";
import dashboardTemplate from "../../../templates/strategy-workspace/state/dashboard.json";
import decisionsTemplate from "../../../templates/strategy-workspace/state/decisions.json";
import evalSummariesTemplate from "../../../templates/strategy-workspace/state/eval-summaries.json";
import liveMemoryTemplate from "../../../templates/strategy-workspace/state/live-memory.json";
import ordersTemplate from "../../../templates/strategy-workspace/state/orders.json";
import positionsTemplate from "../../../templates/strategy-workspace/state/positions.json";
import sessionsTemplate from "../../../templates/strategy-workspace/indexes/sessions.json";
import type { CollectionEntryRecord, MockWorkspaceStore } from "./types";

export const mockStrategyManifest = strategyTemplate as StrategyManifest;

const liveLaneSeed = liveLaneTemplate as LiveLaneState;
const checkpointIndexSeed = checkpointIndexTemplate as CheckpointIndex;
const exportPolicySeed = exportPolicyTemplate as MockWorkspaceStore["exportPolicy"];
const collectionsSeed = collectionsTemplate as { items: CollectionRecord[] };
const importsSeed = importsTemplate as MockWorkspaceStore["importsState"];
const operationsSeed = operationsTemplate as MockWorkspaceStore["operationsState"];
const dashboardSeed = dashboardTemplate as {
  mode: TradingMode;
  automationStatus: BootstrapState["automationStatus"];
  statusNote: string;
  providers: ProviderStatus[];
  metrics: MetricCardData[];
  priceSeries: BootstrapState["priceSeries"];
  equitySeries: BootstrapState["equitySeries"];
  exposureSeries: BootstrapState["exposureSeries"];
};
const decisionsSeed = decisionsTemplate as { decisions: DecisionEntry[] };
const ordersSeed = ordersTemplate as {
  current: LiveOrder[];
  events: MockWorkspaceStore["ordersState"]["events"];
};
const positionsSeed = positionsTemplate as {
  current: LivePosition[];
  events: MockWorkspaceStore["positionsState"]["events"];
};
const liveMemorySeed = liveMemoryTemplate as MockWorkspaceStore["liveMemoryState"];
const sessionsSeed = sessionsTemplate as MockWorkspaceStore["sessionsState"];
const evalSummariesSeed = evalSummariesTemplate as MockWorkspaceStore["evalSummariesState"];

function parseEntries(raw: string): CollectionEntryRecord[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CollectionEntryRecord);
}

export function createMockWorkspaceStore(): MockWorkspaceStore {
  return {
    strategyManifest: structuredClone(strategyTemplate) as StrategyManifest,
    liveLane: structuredClone(liveLaneSeed),
    checkpointIndexSeed: structuredClone(checkpointIndexSeed),
    exportPolicy: structuredClone(exportPolicySeed),
    collectionsState: structuredClone(collectionsSeed),
    importsState: structuredClone(importsSeed),
    operationsState: structuredClone(operationsSeed),
    dashboardSeedState: structuredClone(dashboardSeed),
    decisionsState: structuredClone(decisionsSeed),
    ordersState: structuredClone(ordersSeed),
    positionsState: structuredClone(positionsSeed),
    liveMemoryState: structuredClone(liveMemorySeed),
    sessionsState: structuredClone(sessionsSeed),
    evalSummariesState: structuredClone(evalSummariesSeed),
    entriesByCollection: {
      "019626b0-4d0a-7a72-9b4e-9d8e11d0f901": parseEntries(btcAggEntriesRaw),
      "019626b6-c73a-7fe6-b0a5-64ac631d5102": parseEntries(macroNewsEntriesRaw)
    },
    blobContents: {
      "sha256:cd36e47d463d9e2efe3e2030670ca7694a9f303a8837cad4e4e5135c427f945f":
        btcAggBlobOneRaw,
      "sha256:aef3c2aa9075dc26b7484d71d06d10c152f5310cd34d5eb2b3b3b6fa915e4b3c":
        btcAggBlobTwoRaw,
      "sha256:7bbdd0eec8d01854af7185348af542fb665987debe396f2ce2e88f4e35f8af0e":
        btcAggBlobThreeRaw,
      "sha256:2b0f06db4a1f0530763ad7aa5a10bc2e47017dcaf4f79f8fa0e6a5819d57081f":
        macroNewsBlobOneRaw,
      "sha256:e2d312f2f5767f7334ba8d3fa90fc2c9d66b2d05d4c77db8bc8d289d5fc5f7ec":
        macroNewsBlobTwoRaw
    }
  };
}
