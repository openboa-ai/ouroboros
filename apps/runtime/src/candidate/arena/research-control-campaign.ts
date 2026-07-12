import { createHash, randomBytes } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat
} from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  ResearchControlCampaignService,
  buildResearchControlCampaignReport,
  type ResearchControlCampaignArmEvidenceInput,
  type ResearchControlCampaignCandidateClosure
} from "@ouroboros/application/candidate/research-control-campaign";
import {
  ResearchControlCampaignOutcomeService,
  type ResearchControlCampaignOutcomeArmEvidence,
  type ResearchControlCampaignOutcomePaperClosure
} from "@ouroboros/application/candidate/research-control-campaign-outcome";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import {
  resolveCandidateArenaSourceArtifactDir,
  runCandidateArenaTick,
  type CandidateArenaTickOutcome,
  type RunCandidateArenaTickInput
} from "@ouroboros/application/candidate/arena";
import { buildResearchPopulationDiversity } from
  "@ouroboros/application/candidate/research-population-diversity";
import {
  readTradingSystemManifest,
  type TradingArtifactRunner
} from "@ouroboros/application/trading/research/artifact-runner";
import { sealSingleFileTradingArtifactClosure } from
  "@ouroboros/application/trading/research/artifact-closure";
import type { ReplayTradingApiProviderFactory } from
  "@ouroboros/application/trading/research/replay-set-runner";
import type {
  ManagedResearchAgent,
  TradingResearchAgentAdapter
} from "@ouroboros/application/trading/research/types";
import type { TradingResearchRuntimeAgent } from
  "@ouroboros/application/trading/research/runtime-config";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingComparisonTradingPromotionHasRuntimeShape,
  type ResearchControlCampaignArmIntentRecord,
  type ResearchControlCampaignArmKind,
  type ResearchControlCampaignBaselineSnapshot,
  type ResearchControlCampaignPaperComparator,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchControlCampaignSource,
  type ResearchControlCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonResearchReleaseRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";

const SNAPSHOT_EXCLUDED_COLLECTIONS = new Set([
  "research-control-campaigns",
  "research-control-campaign-arm-intents",
  "research-control-campaign-reports",
  "research-control-campaign-outcomes"
]);
const DEFAULT_MAXIMUM_REGULAR_FILE_COUNT = 10_000;
const DEFAULT_MAXIMUM_TOTAL_BYTES = 1_000_000_000;

export type ResearchControlCampaignRuntimeErrorCode =
  | "research_control_campaign_snapshot_root_invalid"
  | "research_control_campaign_snapshot_empty"
  | "research_control_campaign_snapshot_temporary_file"
  | "research_control_campaign_snapshot_unsupported_entry"
  | "research_control_campaign_snapshot_file_bound_exceeded"
  | "research_control_campaign_snapshot_byte_bound_exceeded"
  | "research_control_campaign_snapshot_unstable"
  | "research_control_campaign_snapshot_digest_mismatch"
  | "research_control_campaign_workspace_overlaps_source"
  | "research_control_campaign_workspace_conflict"
  | "research_control_campaign_source_candidate_invalid"
  | "research_control_campaign_source_artifact_invalid"
  | "research_control_campaign_source_artifact_mismatch"
  | "research_control_campaign_agent_identity_mismatch"
  | "research_control_campaign_arm_tick_failed"
  | "research_control_campaign_arm_evidence_invalid"
  | "research_control_campaign_outcome_source_not_found"
  | "research_control_campaign_outcome_source_ambiguous"
  | "research_control_campaign_outcome_evidence_incomplete"
  | "research_control_campaign_outcome_evidence_ambiguous"
  | "research_control_campaign_outcome_evidence_invalid";

export class ResearchControlCampaignRuntimeError extends Error {
  constructor(
    readonly code: ResearchControlCampaignRuntimeErrorCode,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ResearchControlCampaignRuntimeError";
  }
}

export interface CaptureResearchControlCampaignSnapshotInput {
  root: string;
  maximumRegularFileCount: number;
  maximumTotalBytes: number;
}

export interface RunResearchControlCampaignInput {
  store: LocalStore;
  workspaceRoot: string;
  idempotencyKey: string;
  sourceCandidateId?: string;
  researchAgent: TradingResearchRuntimeAgent;
  researchAgentIdentity: ManagedResearchAgent;
  agentFactory: (
    agent: TradingResearchRuntimeAgent
  ) => TradingResearchAgentAdapter;
  tickCountPerArm: number;
  maximumBaselineRegularFileCount?: number;
  maximumBaselineTotalBytes?: number;
  now?: () => string;
  repoRoot?: string;
  artifactRunner?: TradingArtifactRunner;
  replayProviderFactory?: ReplayTradingApiProviderFactory;
  runTick?: (
    input: RunCandidateArenaTickInput
  ) => Promise<CandidateArenaTickOutcome>;
}

export interface ResearchControlCampaignWorkspacePaths {
  campaignRoot: string;
  baselineRoot: string;
  sourceArtifactRoot: string;
  armRoots: Record<ResearchControlCampaignArmKind, string>;
}

export interface RunResearchControlCampaignOutcome
  extends ResearchControlCampaignWorkspacePaths {
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
}

export interface ResearchControlCampaignOutcomeArmReader {
  listPaperTradingComparisonResearchReleases(): Promise<
    PaperTradingComparisonResearchReleaseRecord[]
  >;
  getPaperTradingComparisonConfirmationCampaign(
    campaignId: string
  ): Promise<PaperTradingComparisonConfirmationCampaignRecord | undefined>;
  getPaperTradingComparisonConfirmationCampaignOutcome(
    outcomeId: string
  ): Promise<
    PaperTradingComparisonConfirmationCampaignOutcomeRecord | undefined
  >;
}

export interface CollectResearchControlCampaignOutcomeInput {
  store: OuroborosStorePort;
  workspaceRoot: string;
  campaignId: string;
  now?: () => string;
  openArmStore?: (
    root: string,
    armKind: ResearchControlCampaignArmKind
  ) => ResearchControlCampaignOutcomeArmReader;
}

export interface CollectResearchControlCampaignOutcomeResult
  extends ResearchControlCampaignWorkspacePaths {
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
  outcome: ResearchControlCampaignOutcomeRecord;
}

interface SnapshotEntry {
  relative_path: string;
  byte_count: number;
  content_digest: string;
}

interface ArmRuntime {
  armKind: ResearchControlCampaignArmKind;
  intent: ResearchControlCampaignArmIntentRecord;
  store: LocalStore;
  root: string;
}

export async function captureResearchControlCampaignSnapshot(
  input: CaptureResearchControlCampaignSnapshotInput
): Promise<ResearchControlCampaignBaselineSnapshot> {
  const root = path.resolve(canonicalPath(input.root));
  const maximumFileCount = positiveBound(
    input.maximumRegularFileCount,
    100_000,
    "research_control_campaign_snapshot_file_bound_exceeded"
  );
  const maximumBytes = positiveBound(
    input.maximumTotalBytes,
    1_000_000_000,
    "research_control_campaign_snapshot_byte_bound_exceeded"
  );
  const rootStat = await stat(root).catch(() => undefined);
  if (!rootStat?.isDirectory()) {
    throw runtimeError(
      "research_control_campaign_snapshot_root_invalid",
      "ResearchControlCampaign snapshot root must be a directory."
    );
  }

  const entries: SnapshotEntry[] = [];
  let totalBytes = 0;
  const walk = async (directory: string, relativeDirectory: string) => {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      if (!relativeDirectory && child.isDirectory() &&
        SNAPSHOT_EXCLUDED_COLLECTIONS.has(child.name)) {
        continue;
      }
      const relativePath = relativeDirectory
        ? path.posix.join(relativeDirectory, child.name)
        : child.name;
      const absolutePath = path.join(directory, child.name);
      const entryStat = await lstat(absolutePath, { bigint: true });
      if (entryStat.isSymbolicLink()) {
        throw runtimeError(
          "research_control_campaign_snapshot_unsupported_entry",
          "ResearchControlCampaign snapshot rejects symbolic links.",
          { relative_path: relativePath }
        );
      }
      if (entryStat.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!entryStat.isFile()) {
        throw runtimeError(
          "research_control_campaign_snapshot_unsupported_entry",
          "ResearchControlCampaign snapshot accepts regular files only.",
          { relative_path: relativePath }
        );
      }
      if (child.name.endsWith(".tmp") || child.name.includes(".tmp-")) {
        throw runtimeError(
          "research_control_campaign_snapshot_temporary_file",
          "ResearchControlCampaign snapshot rejects temporary files.",
          { relative_path: relativePath }
        );
      }
      if (entries.length + 1 > maximumFileCount) {
        throw runtimeError(
          "research_control_campaign_snapshot_file_bound_exceeded",
          "ResearchControlCampaign snapshot file bound was exceeded."
        );
      }
      const captured = await captureRegularFile(absolutePath, relativePath);
      totalBytes += captured.byte_count;
      if (totalBytes > maximumBytes) {
        throw runtimeError(
          "research_control_campaign_snapshot_byte_bound_exceeded",
          "ResearchControlCampaign snapshot byte bound was exceeded."
        );
      }
      entries.push(captured);
    }
  };
  await walk(root, "");
  if (entries.length === 0) {
    throw runtimeError(
      "research_control_campaign_snapshot_empty",
      "ResearchControlCampaign snapshot cannot be empty."
    );
  }
  entries.sort((left, right) =>
    left.relative_path.localeCompare(right.relative_path)
  );
  return {
    protocol_version: "local_store_regular_files_v1",
    snapshot_digest: canonicalDigest({
      protocol_version: "local_store_regular_files_v1",
      entries
    }),
    regular_file_count: entries.length,
    total_bytes: totalBytes,
    exclusion_policy: "research_control_campaign_evidence_only"
  };
}

export async function verifyResearchControlCampaignSnapshot(input: {
  root: string;
  expected: ResearchControlCampaignBaselineSnapshot;
  maximumRegularFileCount: number;
  maximumTotalBytes: number;
}): Promise<void> {
  const actual = await captureResearchControlCampaignSnapshot(input);
  if (!isDeepStrictEqual(actual, input.expected)) {
    throw runtimeError(
      "research_control_campaign_snapshot_digest_mismatch",
      "ResearchControlCampaign snapshot does not match frozen baseline.",
      {
        expected_digest: input.expected.snapshot_digest,
        actual_digest: actual.snapshot_digest
      }
    );
  }
}

export function researchControlCampaignWorkspacePaths(input: {
  workspaceRoot: string;
  campaignId: string;
  sourceRoot: string;
}): ResearchControlCampaignWorkspacePaths {
  const workspaceRoot = path.resolve(canonicalPath(input.workspaceRoot));
  const sourceRoot = path.resolve(canonicalPath(input.sourceRoot));
  if (pathsOverlap(workspaceRoot, sourceRoot)) {
    throw runtimeError(
      "research_control_campaign_workspace_overlaps_source",
      "ResearchControlCampaign workspace must be outside the source store."
    );
  }
  const campaignRoot = path.join(
    workspaceRoot,
    safePathSegment(input.campaignId)
  );
  return {
    campaignRoot,
    baselineRoot: path.join(campaignRoot, "baseline-store"),
    sourceArtifactRoot: path.join(campaignRoot, "source-artifact"),
    armRoots: {
      adaptive_treatment: path.join(campaignRoot, "arms/adaptive-treatment"),
      static_control: path.join(campaignRoot, "arms/static-control")
    }
  };
}

export async function runResearchControlCampaign(
  input: RunResearchControlCampaignInput
): Promise<RunResearchControlCampaignOutcome> {
  assertAgentIdentity(input.researchAgent, input.researchAgentIdentity);
  const existingCampaigns = (await input.store.listResearchControlCampaigns())
    .filter((campaign) => campaign.idempotency_key === input.idempotencyKey);
  if (existingCampaigns.length > 1) {
    throw runtimeError(
      "research_control_campaign_workspace_conflict",
      "Multiple ResearchControlCampaign records share one idempotency key."
    );
  }
  const existingCampaign = existingCampaigns[0];
  const sourceCandidateId = input.sourceCandidateId ?? FIXTURE_CANDIDATE_ID;
  const repoRoot = input.repoRoot ?? process.cwd();
  const maximumFileCount = input.maximumBaselineRegularFileCount ??
    DEFAULT_MAXIMUM_REGULAR_FILE_COUNT;
  const maximumBytes = input.maximumBaselineTotalBytes ??
    DEFAULT_MAXIMUM_TOTAL_BYTES;

  let campaign: ResearchControlCampaignRecord;
  let sourceArtifactDirectory: string | undefined;
  if (existingCampaign) {
    campaign = existingCampaign;
    if (campaign.source.candidate_ref.id !== sourceCandidateId ||
      !campaignAgentMatches(campaign, input.researchAgentIdentity) ||
      campaign.policy.tick_count_per_arm !== input.tickCountPerArm) {
      throw runtimeError(
        "research_control_campaign_workspace_conflict",
        "ResearchControlCampaign resume request conflicts with frozen intent."
      );
    }
  } else {
    const baseline = await captureResearchControlCampaignSnapshot({
      root: input.store.root(),
      maximumRegularFileCount: maximumFileCount,
      maximumTotalBytes: maximumBytes
    });
    const source = await resolveCampaignSource({
      store: input.store,
      candidateId: sourceCandidateId,
      repoRoot
    });
    sourceArtifactDirectory = source.artifactDirectory;
    const service = new ResearchControlCampaignService({
      store: input.store,
      now: input.now
    });
    const paperComparator = await resolvePaperComparator(input.store);
    campaign = await service.commit({
      idempotencyKey: input.idempotencyKey,
      baseline,
      source: source.source,
      researchAgent: input.researchAgentIdentity,
      paperComparator,
      tickCountPerArm: input.tickCountPerArm,
      maximumBaselineRegularFileCount: maximumFileCount,
      maximumBaselineTotalBytes: maximumBytes
    });
  }

  const paths = researchControlCampaignWorkspacePaths({
    workspaceRoot: input.workspaceRoot,
    campaignId: campaign.research_control_campaign_id,
    sourceRoot: input.store.root()
  });
  const existingReport = (await input.store.listResearchControlCampaignReports())
    .find((report) => report.campaign_ref.id ===
      campaign.research_control_campaign_id);
  if (existingReport) {
    return { ...paths, campaign, report: existingReport };
  }

  if (!sourceArtifactDirectory && !await pathExists(paths.sourceArtifactRoot)) {
    const resolved = await resolveCampaignSource({
      store: input.store,
      candidateId: sourceCandidateId,
      repoRoot
    });
    if (!isDeepStrictEqual(resolved.source, campaign.source)) {
      throw runtimeError(
        "research_control_campaign_source_candidate_invalid",
        "ResearchControlCampaign source changed after commitment."
      );
    }
    sourceArtifactDirectory = resolved.artifactDirectory;
  }

  await ensureVerifiedStoreCopy({
    sourceRoot: input.store.root(),
    destinationRoot: paths.baselineRoot,
    expected: campaign.baseline,
    maximumRegularFileCount:
      campaign.policy.maximum_baseline_regular_file_count,
    maximumTotalBytes: campaign.policy.maximum_baseline_total_bytes
  });
  await ensureVerifiedSourceArtifact({
    sourceArtifactDirectory: sourceArtifactDirectory ?? paths.sourceArtifactRoot,
    destinationRoot: paths.sourceArtifactRoot,
    expectedClosureDigest: campaign.source.research_artifact_closure_digest
  });

  const coordinatorService = new ResearchControlCampaignService({
    store: input.store,
    now: input.now
  });
  const armRuntimes: [ArmRuntime, ArmRuntime] = [
    await prepareArm({
      armKind: "adaptive_treatment",
      campaign,
      coordinatorService,
      root: paths.armRoots.adaptive_treatment,
      baselineRoot: paths.baselineRoot
    }),
    await prepareArm({
      armKind: "static_control",
      campaign,
      coordinatorService,
      root: paths.armRoots.static_control,
      baselineRoot: paths.baselineRoot
    })
  ];

  const runTick = input.runTick ?? ((tickInput) =>
    runCandidateArenaTick(tickInput));
  for (let sequence = 0; sequence < campaign.policy.tick_count_per_arm; sequence += 1) {
    const settled = await Promise.allSettled(armRuntimes.map(async (armRuntime) => {
      const tickId = armRuntime.intent.tick_ids[sequence]!;
      const existing = (await armRuntime.store.listCandidateArenaTicks())
        .find((tick) => tick.tick_id === tickId);
      if (existing) return;
      await runTick({
        store: armRuntime.store,
        sourceSystemId: campaign.source.candidate_ref.id,
        sourceCandidateVersionId: campaign.source.candidate_version_ref.id,
        researchAllocationMode: armRuntime.intent.allocation_mode,
        tickId,
        ...(input.now ? { now: input.now } : {}),
        repoRoot,
        sourceArtifactDir: paths.sourceArtifactRoot,
        researchAgent: input.researchAgent,
        agentFactory: input.agentFactory,
        artifactRunner: input.artifactRunner,
        replayProviderFactory: input.replayProviderFactory
      });
    }));
    const failures = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [{
            arm_kind: armRuntimes[index]!.armKind,
            reason: conciseError(result.reason)
          }]
        : []
    );
    if (failures.length > 0) {
      throw runtimeError(
        "research_control_campaign_arm_tick_failed",
        "ResearchControlCampaign arm tick failed before paired completion.",
        { sequence: sequence + 1, failures }
      );
    }
  }

  const armEvidence: [
    ResearchControlCampaignArmEvidenceInput,
    ResearchControlCampaignArmEvidenceInput
  ] = [
    await loadArmEvidence(campaign, armRuntimes[0]),
    await loadArmEvidence(campaign, armRuntimes[1])
  ];
  const completedAt = timeAtOrAfter(
    campaign.committed_at,
    ...armEvidence.map((arm) => arm.completedAt)
  );
  const report = buildResearchControlCampaignReport({
    campaign,
    arms: armEvidence,
    completedAt
  });
  await coordinatorService.recordReport(report);
  return { ...paths, campaign, report };
}

export async function collectResearchControlCampaignOutcome(
  input: CollectResearchControlCampaignOutcomeInput
): Promise<CollectResearchControlCampaignOutcomeResult> {
  const campaignId = canonicalIdentifier(input?.campaignId);
  const campaign = await input.store.getResearchControlCampaign(campaignId);
  if (!campaign) {
    throw runtimeError(
      "research_control_campaign_outcome_source_not_found",
      "ResearchControlCampaign outcome source campaign was not found."
    );
  }
  const reports = (await input.store.listResearchControlCampaignReports())
    .filter((report: ResearchControlCampaignReportRecord) =>
      report.campaign_ref.id === campaign.research_control_campaign_id
    );
  if (reports.length === 0) {
    throw runtimeError(
      "research_control_campaign_outcome_source_not_found",
      "ResearchControlCampaign outcome source report was not found."
    );
  }
  if (reports.length !== 1) {
    throw runtimeError(
      "research_control_campaign_outcome_source_ambiguous",
      "ResearchControlCampaign outcome source report is ambiguous."
    );
  }
  const report = reports[0]!;
  const paths = researchControlCampaignWorkspacePaths({
    workspaceRoot: input.workspaceRoot,
    campaignId: campaign.research_control_campaign_id,
    sourceRoot: input.store.root()
  });
  const outcomeService = new ResearchControlCampaignOutcomeService({
    store: input.store,
    now: input.now
  });

  try {
    const replay = await outcomeService.replay({ campaign, report });
    if (replay) return { ...paths, campaign, report, outcome: replay };

    const openArmStore = input.openArmStore ?? ((root: string) =>
      new LocalStore(root));
    const arms: [
      ResearchControlCampaignOutcomeArmEvidence,
      ResearchControlCampaignOutcomeArmEvidence
    ] = [
      await collectArmOutcomeEvidence(
        report.arms[0],
        openArmStore(
          paths.armRoots.adaptive_treatment,
          "adaptive_treatment"
        )
      ),
      await collectArmOutcomeEvidence(
        report.arms[1],
        openArmStore(paths.armRoots.static_control, "static_control")
      )
    ];
    const outcome = await outcomeService.adjudicate({ campaign, report, arms });
    return { ...paths, campaign, report, outcome };
  } catch (error) {
    if (error instanceof ResearchControlCampaignRuntimeError) throw error;
    throw runtimeError(
      "research_control_campaign_outcome_evidence_invalid",
      "ResearchControlCampaign terminal outcome evidence is invalid.",
      { reason: conciseError(error) }
    );
  }
}

async function collectArmOutcomeEvidence(
  reportArm: ResearchControlCampaignReportRecord["arms"][number],
  store: ResearchControlCampaignOutcomeArmReader
): Promise<ResearchControlCampaignOutcomeArmEvidence> {
  const releases = await store.listPaperTradingComparisonResearchReleases();
  const paperClosures: ResearchControlCampaignOutcomePaperClosure[] = [];
  for (const slot of reportArm.paper_candidate_slots) {
    if (slot.status === "no_admitted_candidate") continue;
    const matches = releases.filter((release) =>
      release.candidate_ref.record_kind === slot.candidate_ref.record_kind &&
      release.candidate_ref.id === slot.candidate_ref.id &&
      release.candidate_version_ref.record_kind ===
        slot.candidate_version_ref.record_kind &&
      release.candidate_version_ref.id === slot.candidate_version_ref.id &&
      release.system_code_ref.record_kind === slot.system_code_ref.record_kind &&
      release.system_code_ref.id === slot.system_code_ref.id &&
      release.system_code_artifact_digest === slot.system_code_artifact_digest
    );
    if (matches.length === 0) {
      throw runtimeError(
        "research_control_campaign_outcome_evidence_incomplete",
        "ResearchControlCampaign reserved paper slot has no terminal release.",
        { arm_kind: reportArm.arm_kind, sequence: slot.sequence }
      );
    }
    if (matches.length !== 1) {
      throw runtimeError(
        "research_control_campaign_outcome_evidence_ambiguous",
        "ResearchControlCampaign reserved paper slot has multiple terminal releases.",
        { arm_kind: reportArm.arm_kind, sequence: slot.sequence }
      );
    }
    const researchRelease = matches[0]!;
    if (researchRelease.campaign_ref.record_kind !==
        "paper_trading_comparison_confirmation_campaign" ||
      researchRelease.campaign_outcome_ref.record_kind !==
        "paper_trading_comparison_confirmation_campaign_outcome") {
      throw runtimeError(
        "research_control_campaign_outcome_evidence_invalid",
        "ResearchControlCampaign terminal release references are malformed."
      );
    }
    const [confirmationCampaign, confirmationOutcome] = await Promise.all([
      store.getPaperTradingComparisonConfirmationCampaign(
        researchRelease.campaign_ref.id
      ),
      store.getPaperTradingComparisonConfirmationCampaignOutcome(
        researchRelease.campaign_outcome_ref.id
      )
    ]);
    if (!confirmationCampaign || !confirmationOutcome) {
      throw runtimeError(
        "research_control_campaign_outcome_evidence_incomplete",
        "ResearchControlCampaign terminal release closure is incomplete.",
        { arm_kind: reportArm.arm_kind, sequence: slot.sequence }
      );
    }
    paperClosures.push({
      sequence: slot.sequence,
      tickRef: { ...slot.tick_ref },
      confirmationCampaign,
      confirmationOutcome,
      researchRelease
    });
  }
  return {
    armKind: reportArm.arm_kind,
    paperClosures
  };
}

async function resolvePaperComparator(
  store: LocalStore
): Promise<ResearchControlCampaignPaperComparator> {
  const promotion = await store.getLatestTradingPromotion();
  if (!promotion) {
    return {
      comparator_status: "unavailable",
      reason: "no_trading_promotion_at_commitment"
    };
  }
  if (!paperTradingComparisonTradingPromotionHasRuntimeShape(promotion)) {
    throw runtimeError(
      "research_control_campaign_source_candidate_invalid",
      "ResearchControlCampaign Trading review comparator is malformed."
    );
  }
  return {
    comparator_status: "trading_review",
    trading_promotion_ref: {
      record_kind: "trading_promotion",
      id: promotion.trading_promotion_id
    },
    trading_promotion_digest: canonicalDigest(
      paperTradingComparisonTradingPromotionDigestInput(promotion)
    ),
    candidate_ref: { ...promotion.candidate_ref },
    candidate_version_ref: { ...promotion.candidate_version_ref },
    paper_trading_evaluation_ref: {
      ...promotion.paper_trading_evaluation_ref
    }
  };
}

async function captureRegularFile(
  filePath: string,
  relativePath: string
): Promise<SnapshotEntry> {
  const handle = await open(filePath, "r");
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) {
      throw runtimeError(
        "research_control_campaign_snapshot_unsupported_entry",
        "ResearchControlCampaign snapshot entry changed type during capture.",
        { relative_path: relativePath }
      );
    }
    const content = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs || BigInt(content.byteLength) !== after.size) {
      throw runtimeError(
        "research_control_campaign_snapshot_unstable",
        "ResearchControlCampaign snapshot file changed during capture.",
        { relative_path: relativePath }
      );
    }
    return {
      relative_path: relativePath.split(path.sep).join(path.posix.sep),
      byte_count: content.byteLength,
      content_digest: `sha256:${createHash("sha256").update(content).digest("hex")}`
    };
  } finally {
    await handle.close();
  }
}

async function ensureVerifiedStoreCopy(input: {
  sourceRoot: string;
  destinationRoot: string;
  expected: ResearchControlCampaignBaselineSnapshot;
  maximumRegularFileCount: number;
  maximumTotalBytes: number;
}): Promise<void> {
  if (await pathExists(input.destinationRoot)) {
    await verifyResearchControlCampaignSnapshot({
      root: input.destinationRoot,
      expected: input.expected,
      maximumRegularFileCount: input.maximumRegularFileCount,
      maximumTotalBytes: input.maximumTotalBytes
    });
    return;
  }
  await verifyResearchControlCampaignSnapshot({
    root: input.sourceRoot,
    expected: input.expected,
    maximumRegularFileCount: input.maximumRegularFileCount,
    maximumTotalBytes: input.maximumTotalBytes
  });
  const temporaryRoot = temporarySibling(input.destinationRoot);
  await mkdir(path.dirname(input.destinationRoot), { recursive: true });
  await rm(temporaryRoot, { recursive: true, force: true });
  try {
    await cp(input.sourceRoot, temporaryRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
      preserveTimestamps: true
    });
    await verifyResearchControlCampaignSnapshot({
      root: temporaryRoot,
      expected: input.expected,
      maximumRegularFileCount: input.maximumRegularFileCount,
      maximumTotalBytes: input.maximumTotalBytes
    });
    await verifyResearchControlCampaignSnapshot({
      root: input.sourceRoot,
      expected: input.expected,
      maximumRegularFileCount: input.maximumRegularFileCount,
      maximumTotalBytes: input.maximumTotalBytes
    });
    await rename(temporaryRoot, input.destinationRoot);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

async function ensureVerifiedSourceArtifact(input: {
  sourceArtifactDirectory: string;
  destinationRoot: string;
  expectedClosureDigest: string;
}): Promise<void> {
  if (await pathExists(input.destinationRoot)) {
    await verifySourceArtifactClosure(
      input.destinationRoot,
      input.expectedClosureDigest
    );
    return;
  }
  await verifySourceArtifactClosure(
    input.sourceArtifactDirectory,
    input.expectedClosureDigest
  );
  const temporaryRoot = temporarySibling(input.destinationRoot);
  await mkdir(path.dirname(input.destinationRoot), { recursive: true });
  await rm(temporaryRoot, { recursive: true, force: true });
  try {
    await cp(input.sourceArtifactDirectory, temporaryRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
      preserveTimestamps: true
    });
    await verifySourceArtifactClosure(
      temporaryRoot,
      input.expectedClosureDigest
    );
    await verifySourceArtifactClosure(
      input.sourceArtifactDirectory,
      input.expectedClosureDigest
    );
    await rename(temporaryRoot, input.destinationRoot);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

async function prepareArm(input: {
  armKind: ResearchControlCampaignArmKind;
  campaign: ResearchControlCampaignRecord;
  coordinatorService: ResearchControlCampaignService;
  root: string;
  baselineRoot: string;
}): Promise<ArmRuntime> {
  const intent = await input.coordinatorService.commitArmIntent({
    campaign: input.campaign,
    armKind: input.armKind
  });
  if (!await pathExists(input.root)) {
    await ensureVerifiedStoreCopy({
      sourceRoot: input.baselineRoot,
      destinationRoot: input.root,
      expected: input.campaign.baseline,
      maximumRegularFileCount:
        input.campaign.policy.maximum_baseline_regular_file_count,
      maximumTotalBytes: input.campaign.policy.maximum_baseline_total_bytes
    });
  }
  const store = new LocalStore(input.root);
  const armCampaign = await store.getResearchControlCampaign(
    input.campaign.research_control_campaign_id
  );
  if (!armCampaign || !isDeepStrictEqual(armCampaign, input.campaign)) {
    throw runtimeError(
      "research_control_campaign_workspace_conflict",
      "ResearchControlCampaign arm does not contain exact campaign evidence.",
      { arm_kind: input.armKind }
    );
  }
  const existingIntent = await store.getResearchControlCampaignArmIntent(
    intent.research_control_campaign_arm_intent_id
  );
  if (!existingIntent) {
    const ticks = await store.listCandidateArenaTicks();
    const allocations = await store.listCandidateArenaResearchAllocations();
    if (ticks.some((tick) => intent.tick_ids.includes(tick.tick_id)) ||
      allocations.some((allocation) => intent.tick_ids.includes(allocation.tick_id))) {
      throw runtimeError(
        "research_control_campaign_workspace_conflict",
        "ResearchControlCampaign arm effect exists without pre-effect intent.",
        { arm_kind: input.armKind }
      );
    }
    await verifyResearchControlCampaignSnapshot({
      root: input.root,
      expected: input.campaign.baseline,
      maximumRegularFileCount:
        input.campaign.policy.maximum_baseline_regular_file_count,
      maximumTotalBytes: input.campaign.policy.maximum_baseline_total_bytes
    });
    await store.recordResearchControlCampaignArmIntent(intent);
  } else if (!isDeepStrictEqual(existingIntent, intent)) {
    throw runtimeError(
      "research_control_campaign_workspace_conflict",
      "ResearchControlCampaign arm intent conflicts with coordinator evidence.",
      { arm_kind: input.armKind }
    );
  }
  return { armKind: input.armKind, intent, store, root: input.root };
}

async function loadArmEvidence(
  campaign: ResearchControlCampaignRecord,
  arm: ArmRuntime
): Promise<ResearchControlCampaignArmEvidenceInput> {
  try {
    const tickIdSet = new Set(arm.intent.tick_ids);
    const ticks = (await arm.store.listCandidateArenaTicks())
      .filter((tick) => tickIdSet.has(tick.tick_id));
    const allocations = (await arm.store.listCandidateArenaResearchAllocations())
      .filter((allocation) => tickIdSet.has(allocation.tick_id));
    const [directions, commitments, fingerprints, admissions] = await Promise.all([
      arm.store.listResearchDirections(),
      arm.store.listResearchPreflightCommitments(),
      arm.store.listResearchBehaviorFingerprints(),
      arm.store.listCandidateAdmissionDecisions()
    ]);
    const populationDiversity = buildResearchPopulationDiversity({
      ticks,
      directions,
      commitments,
      fingerprints,
      admissions
    });
    const candidateClosures = await resolveCandidateClosures(
      arm.store,
      ticks
    );
    const finalSnapshot = await captureResearchControlCampaignSnapshot({
      root: arm.root,
      maximumRegularFileCount:
        campaign.policy.maximum_baseline_regular_file_count,
      maximumTotalBytes: campaign.policy.maximum_baseline_total_bytes
    });
    const completedAt = timeAtOrAfter(
      arm.intent.committed_at,
      ...ticks.map((tick) => tick.completed_at)
    );
    return {
      intent: arm.intent,
      ticks,
      allocations,
      populationDiversity,
      candidateClosures,
      finalStoreSnapshotDigest: finalSnapshot.snapshot_digest,
      completedAt
    };
  } catch (error) {
    if (error instanceof ResearchControlCampaignRuntimeError) throw error;
    throw runtimeError(
      "research_control_campaign_arm_evidence_invalid",
      "ResearchControlCampaign arm evidence could not be reconstructed.",
      { arm_kind: arm.armKind, reason: conciseError(error) }
    );
  }
}

async function resolveCandidateClosures(
  store: LocalStore,
  ticks: Awaited<ReturnType<LocalStore["listCandidateArenaTicks"]>>
): Promise<ResearchControlCampaignCandidateClosure[]> {
  const admissions = new Map((await store.listCandidateAdmissionDecisions())
    .map((admission) => [admission.candidate_admission_decision_id, admission]));
  const closures: ResearchControlCampaignCandidateClosure[] = [];
  for (const result of ticks.flatMap((tick) => tick.direction_results)) {
    if (result.status !== "created" || !result.candidate_id ||
      !result.admission_decision_id) {
      continue;
    }
    const candidate = await store.getCandidate(result.candidate_id);
    const admission = admissions.get(result.admission_decision_id);
    const systemCodeRef = candidate?.system_code?.ref;
    const systemCode = systemCodeRef
      ? await store.getSystemCode(systemCodeRef.id)
      : undefined;
    if (!candidate || !admission || admission.status !== "admitted" ||
      admission.reason !== "evaluation_accepted" || !systemCode ||
      admission.system_code_ref.id !== systemCode.system_code_id ||
      admission.submitted_artifact_digest !== systemCode.artifact_digest ||
      !/^sha256:[a-f0-9]{64}$/.test(systemCode.artifact_digest)) {
      throw runtimeError(
        "research_control_campaign_arm_evidence_invalid",
        "Reserved campaign candidate closure is incomplete.",
        { candidate_id: result.candidate_id }
      );
    }
    closures.push({
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      system_code_id: systemCode.system_code_id,
      system_code_artifact_digest: systemCode.artifact_digest,
      admission_decision_id: admission.candidate_admission_decision_id
    });
  }
  return closures;
}

async function resolveCampaignSource(input: {
  store: LocalStore;
  candidateId: string;
  repoRoot: string;
}): Promise<{ source: ResearchControlCampaignSource; artifactDirectory: string }> {
  const candidate = await input.store.getCandidate(input.candidateId);
  const systemCodeRef = candidate?.system_code?.ref;
  const systemCode = systemCodeRef
    ? await input.store.getSystemCode(systemCodeRef.id)
    : undefined;
  if (!candidate || !systemCode || systemCode.artifact_kind !== "python_file") {
    throw runtimeError(
      "research_control_campaign_source_candidate_invalid",
      "ResearchControlCampaign source candidate must bind Python SystemCode."
    );
  }
  const artifactDirectory = await resolveCandidateArenaSourceArtifactDir({
    store: input.store,
    source: candidate,
    repoRoot: input.repoRoot
  });
  const closureDigest = await sourceArtifactClosureDigest(artifactDirectory);
  return {
    source: {
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: candidate.candidate_id
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: candidate.candidate_version.candidate_version_id
      },
      system_code_ref: {
        record_kind: "system_code",
        id: systemCode.system_code_id
      },
      system_code_artifact_digest: systemCode.artifact_digest,
      system_code_record_digest: canonicalDigest(
        paperTradingComparisonSystemCodeRecordDigestInput(systemCode)
      ),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: closureDigest
    },
    artifactDirectory
  };
}

async function verifySourceArtifactClosure(
  artifactDirectory: string,
  expectedClosureDigest: string
): Promise<void> {
  const actual = await sourceArtifactClosureDigest(artifactDirectory);
  if (actual !== expectedClosureDigest) {
    throw runtimeError(
      "research_control_campaign_source_artifact_mismatch",
      "ResearchControlCampaign source artifact closure changed.",
      { expected_digest: expectedClosureDigest, actual_digest: actual }
    );
  }
}

async function sourceArtifactClosureDigest(
  artifactDirectory: string
): Promise<string> {
  try {
    const manifest = await readTradingSystemManifest(artifactDirectory);
    const sealed = await sealSingleFileTradingArtifactClosure(
      artifactDirectory,
      manifest
    );
    return sealed.closure_digest;
  } catch (error) {
    if (error instanceof ResearchControlCampaignRuntimeError) throw error;
    throw runtimeError(
      "research_control_campaign_source_artifact_invalid",
      "ResearchControlCampaign source artifact is not a sealed single-file system.",
      { reason: conciseError(error) }
    );
  }
}

function assertAgentIdentity(
  runtimeAgent: TradingResearchRuntimeAgent,
  identity: ManagedResearchAgent
): void {
  if (!identity || identity.provider !== runtimeAgent ||
    (runtimeAgent === "fixture"
      ? identity.permission_policy !== "fixture_only"
      : identity.permission_policy !== "artifact_workspace_only")) {
    throw runtimeError(
      "research_control_campaign_agent_identity_mismatch",
      "ResearchControlCampaign runtime agent does not match frozen identity."
    );
  }
}

function campaignAgentMatches(
  campaign: ResearchControlCampaignRecord,
  identity: ManagedResearchAgent
): boolean {
  const compact = {
    provider: identity.provider,
    ...(identity.model ? { model: identity.model } : {}),
    permission_policy: identity.permission_policy
  };
  return campaign.research_agent.provider === compact.provider &&
    campaign.research_agent.model === compact.model &&
    campaign.research_agent.permission_policy === compact.permission_policy &&
    campaign.research_agent.identity_digest === canonicalDigest(compact);
}

function positiveBound(
  value: unknown,
  hardMaximum: number,
  code:
    | "research_control_campaign_snapshot_file_bound_exceeded"
    | "research_control_campaign_snapshot_byte_bound_exceeded"
): number {
  if (!Number.isInteger(value) || Number(value) < 1 ||
    Number(value) > hardMaximum) {
    throw runtimeError(code, "ResearchControlCampaign snapshot bound is invalid.");
  }
  return Number(value);
}

function canonicalPath(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw runtimeError(
      "research_control_campaign_snapshot_root_invalid",
      "ResearchControlCampaign path is invalid."
    );
  }
  return value;
}

function canonicalIdentifier(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value ||
    !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw runtimeError(
      "research_control_campaign_outcome_source_not_found",
      "ResearchControlCampaign outcome source ID is invalid."
    );
  }
  return value;
}

function safePathSegment(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw runtimeError(
      "research_control_campaign_workspace_conflict",
      "ResearchControlCampaign ID is not path-safe."
    );
  }
  return value;
}

function pathsOverlap(left: string, right: string): boolean {
  return pathContains(left, right) || pathContains(right, left);
}

function pathContains(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) &&
    relative !== ".." && !path.isAbsolute(relative));
}

function temporarySibling(destination: string): string {
  return `${destination}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
}

async function pathExists(candidate: string): Promise<boolean> {
  return Boolean(await stat(candidate).catch(() => undefined));
}

function canonicalDigest(value: unknown): string {
  const text = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function timeAtOrAfter(...times: string[]): string {
  const latest = Math.max(Date.now(), ...times.map((time) => Date.parse(time)));
  return new Date(latest).toISOString();
}

function conciseError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function runtimeError(
  code: ResearchControlCampaignRuntimeErrorCode,
  message: string,
  details?: Record<string, unknown>
): ResearchControlCampaignRuntimeError {
  return new ResearchControlCampaignRuntimeError(code, message, details);
}
