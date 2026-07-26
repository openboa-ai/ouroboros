import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCandidateArenaTick } from "@ouroboros/application/candidate/arena";
import type { ResearchControlCampaignPaperEvaluationProtocolInput } from
  "@ouroboros/application/candidate/research-control-campaign";
import { FixtureTradingResearchAgentAdapter } from
  "@ouroboros/application/trading/research/agent-adapters";
import type { TradingArtifactRunner } from
  "@ouroboros/application/trading/research/artifact-runner";
import { validateOrderRequest } from
  "@ouroboros/application/trading/research/replay-trading-api-provider";
import type {
  AgentEditInput,
  AgentEditResult,
  ManagedResearchAgent,
  ReplayTradingApiProviderSession,
  ReplayTradingCandidateInput,
  ResearchWorkerSessionInput,
  ResearchWorkerSessionResult,
  TradingProviderRequestLog,
  TradingResearchAgentAdapter,
  TradingSystemEvent
} from "@ouroboros/application/trading/research/types";
import {
  researchControlCampaignReportHasRuntimeShape,
  researchWorkerCheckpointDigestInput,
  type ResearchWorkerCheckpointRecord,
  type TradingPromotionRecord
} from "@ouroboros/domain";
import {
  FIXTURE_CANDIDATE_ID,
  FIXTURE_SYSTEM_CODE_ID,
  LocalStore
} from "@ouroboros/local-store";
import { passingPaperHandoffProbe } from "./helpers/paper-handoff";
import {
  ResearchControlCampaignRuntimeError,
  captureResearchControlCampaignSnapshot,
  researchControlCampaignWorkspacePaths,
  runResearchControlCampaign,
  verifyResearchControlCampaignSnapshot
} from "../src/candidate/arena/research-control-campaign";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-control-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("ResearchControlCampaign snapshots", () => {
  it("hashes product state and excludes only control experiment evidence", async () => {
    const root = path.join(tmpDir, "source");
    await mkdir(path.join(root, "nested"), { recursive: true });
    await writeFile(path.join(root, "b.json"), "b\n", "utf8");
    await writeFile(path.join(root, "nested/a.json"), "a\n", "utf8");

    const first = await captureResearchControlCampaignSnapshot({
      root,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });
    await mkdir(path.join(root, "research-control-campaigns/items"), {
      recursive: true
    });
    await writeFile(
      path.join(root, "research-control-campaigns/items/campaign.json"),
      "campaign\n",
      "utf8"
    );
    await mkdir(path.join(root, "research-control-campaign-outcomes/items"), {
      recursive: true
    });
    await writeFile(
      path.join(
        root,
        "research-control-campaign-outcomes/items/outcome.json"
      ),
      "outcome\n",
      "utf8"
    );
    await mkdir(path.join(
      root,
      "research-control-campaign-paper-start-batches/items"
    ), { recursive: true });
    await writeFile(
      path.join(
        root,
        "research-control-campaign-paper-start-batches/items/batch.json"
      ),
      "batch\n",
      "utf8"
    );
    await mkdir(path.join(root, "research-control-studies/items"), {
      recursive: true
    });
    await writeFile(
      path.join(root, "research-control-studies/items/study.json"),
      "study\n",
      "utf8"
    );
    await mkdir(path.join(root, "research-control-study-outcomes/items"), {
      recursive: true
    });
    await writeFile(
      path.join(root, "research-control-study-outcomes/items/outcome.json"),
      "study outcome\n",
      "utf8"
    );
    const second = await captureResearchControlCampaignSnapshot({
      root,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });

    expect(first).toEqual(second);
    expect(first).toEqual({
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      regular_file_count: 2,
      total_bytes: 4,
      exclusion_policy: "research_control_campaign_evidence_only"
    });

    await mkdir(path.join(root, "research-memory-control-studies/items"), {
      recursive: true
    });
    await writeFile(
      path.join(root, "research-memory-control-studies/items/study.json"),
      "memory study\n",
      "utf8"
    );
    const withMemoryEvidence = await captureResearchControlCampaignSnapshot({
      root,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });
    expect(withMemoryEvidence.snapshot_digest).not.toBe(first.snapshot_digest);
    expect(withMemoryEvidence.regular_file_count).toBe(3);

    await writeFile(path.join(root, "ordinary-state.json"), "state\n", "utf8");
    const changed = await captureResearchControlCampaignSnapshot({
      root,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });
    expect(changed.snapshot_digest).not.toBe(first.snapshot_digest);
    expect(changed.regular_file_count).toBe(4);
  });

  it.each([
    ["temporary file", async (root: string) => {
      await writeFile(path.join(root, "record.json.tmp"), "partial", "utf8");
    }, "research_control_campaign_snapshot_temporary_file"],
    ["symlink", async (root: string) => {
      await writeFile(path.join(root, "target.json"), "target", "utf8");
      await symlink("target.json", path.join(root, "link.json"));
    }, "research_control_campaign_snapshot_unsupported_entry"],
    ["file bound", async (root: string) => {
      await writeFile(path.join(root, "a.json"), "a", "utf8");
      await writeFile(path.join(root, "b.json"), "b", "utf8");
    }, "research_control_campaign_snapshot_file_bound_exceeded"],
    ["byte bound", async (root: string) => {
      await writeFile(path.join(root, "a.json"), "12345", "utf8");
    }, "research_control_campaign_snapshot_byte_bound_exceeded"]
  ])("rejects %s", async (label, prepare, code) => {
    const root = path.join(tmpDir, String(label).replaceAll(" ", "-"));
    await mkdir(root, { recursive: true });
    await prepare(root);

    await expect(captureResearchControlCampaignSnapshot({
      root,
      maximumRegularFileCount: label === "file bound" ? 1 : 10,
      maximumTotalBytes: label === "byte bound" ? 4 : 1_000
    })).rejects.toMatchObject({ code });
  });

  it("detects content drift against a frozen snapshot", async () => {
    const root = path.join(tmpDir, "drift");
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "state.json"), "before", "utf8");
    const expected = await captureResearchControlCampaignSnapshot({
      root,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    });
    await writeFile(path.join(root, "state.json"), "after", "utf8");

    await expect(verifyResearchControlCampaignSnapshot({
      root,
      expected,
      maximumRegularFileCount: 10,
      maximumTotalBytes: 1_000
    })).rejects.toMatchObject({
      code: "research_control_campaign_snapshot_digest_mismatch"
    });
  });
});

describe("ResearchControlCampaign runtime", () => {
  it("runs isolated adaptive and static arms from one exact baseline", async () => {
    const sourceRoot = path.join(tmpDir, "source-store");
    const workspaceRoot = path.join(tmpDir, "campaign-workspace");
    const baseStore = new LocalStore(sourceRoot);
    await baseStore.initialize();
    let fencedWrites = 0;
    const sourceStore = baseStore.withWriteTransaction({
      async run<T>(write: () => Promise<T>): Promise<T> {
        fencedWrites += 1;
        return write();
      }
    });
    const tickCalls: string[] = [];
    const researchAgentIdentity = new FixtureTradingResearchAgentAdapter().agent;

    const outcome = await runResearchControlCampaign({
      store: sourceStore,
      workspaceRoot,
      idempotencyKey: "runtime-isolation-001",
      sourceCandidateId: FIXTURE_CANDIDATE_ID,
      researchAgent: "fixture",
      researchAgentIdentity,
      agentFactory: fixtureAgentFactory,
      tickCountPerArm: 1,
      artifactRunner: networklessArtifactRunner(),
      replayProviderFactory: networklessReplayProvider,
      runTick: async (input) => {
        expect(input.researchAgentDescriptor).toEqual(researchAgentIdentity);
        tickCalls.push(input.tickId!);
        const before = fencedWrites;
        const result = await runCandidateArenaTick(input);
        expect(fencedWrites).toBeGreaterThan(before);
        return result;
      }
    });

    expect(researchControlCampaignReportHasRuntimeShape(outcome.report)).toBe(true);
    expect(outcome.report).toMatchObject({
      primary_outcome_status: "unadjudicated",
      causal_conclusion: "not_available_from_research_phase",
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false
    });
    expect(outcome.campaign.paper_comparator).toEqual({
      comparator_status: "unavailable",
      reason: "no_trading_promotion_at_commitment"
    });
    expect(outcome.campaign.paper_evaluation_protocol).toEqual({
      protocol_status: "unavailable",
      reason: "no_trading_promotion_at_commitment"
    });
    expect(tickCalls).toHaveLength(2);
    expect(fencedWrites).toBeGreaterThan(0);
    expect(await sourceStore.listCandidateArenaTicks()).toEqual([]);
    expect(await sourceStore.listResearchControlCampaigns()).toEqual([
      outcome.campaign
    ]);
    expect(await sourceStore.listResearchControlCampaignArmIntents()).toHaveLength(2);
    expect(await sourceStore.listResearchControlCampaignReports()).toEqual([
      outcome.report
    ]);

    const adaptiveStore = new LocalStore(outcome.armRoots.adaptive_treatment);
    const controlStore = new LocalStore(outcome.armRoots.static_control);
    const adaptiveTicks = await adaptiveStore.listCandidateArenaTicks();
    const controlTicks = await controlStore.listCandidateArenaTicks();
    expect(adaptiveTicks).toHaveLength(1);
    expect(controlTicks).toHaveLength(1);
    expect((await adaptiveStore.listCandidateArenaResearchAllocations())[0]
      ?.allocation_mode).toBe("adaptive_default");
    expect((await controlStore.listCandidateArenaResearchAllocations())[0]
      ?.allocation_mode).toBe("static_control");
    expect(adaptiveTicks[0]!.tick_id).not.toBe(controlTicks[0]!.tick_id);
    expect(adaptiveTicks[0]!.direction_results).toHaveLength(3);
    expect(controlTicks[0]!.direction_results).toHaveLength(3);

    const baselineStore = new LocalStore(outcome.baselineRoot);
    expect(await baselineStore.listCandidateArenaTicks()).toEqual([]);
    await verifyResearchControlCampaignSnapshot({
      root: outcome.baselineRoot,
      expected: outcome.campaign.baseline,
      maximumRegularFileCount:
        outcome.campaign.policy.maximum_baseline_regular_file_count,
      maximumTotalBytes: outcome.campaign.policy.maximum_baseline_total_bytes
    });
    expect(JSON.stringify(outcome.report)).not.toMatch(
      /winner|sealed_terminal_score|fingerprint_digest|store_root/
    );
  });

  it("returns an exact terminal report without another worker effect", async () => {
    const sourceStore = new LocalStore(path.join(tmpDir, "replay-source"));
    await sourceStore.initialize();
    let tickCallCount = 0;
    const input = campaignRunInput(sourceStore, path.join(tmpDir, "replay-workspace"),
      async (tickInput) => {
        tickCallCount += 1;
        return runCandidateArenaTick(tickInput);
      });

    const first = await runResearchControlCampaign(input);
    await rm(path.join(
      sourceStore.root(),
      "system-codes/items",
      `${FIXTURE_SYSTEM_CODE_ID}.json`
    ));
    const second = await runResearchControlCampaign(input);

    expect(second.report).toEqual(first.report);
    expect(tickCallCount).toBe(2);
  });

  it("commits and replays the bound paper schedule with the report", async () => {
    const sourceStore = new TradingReviewCampaignStore(
      path.join(tmpDir, "scheduled-source")
    );
    await sourceStore.initialize();
    const paperCalls: string[] = [];
    const input = {
      ...campaignRunInput(
        sourceStore,
        path.join(tmpDir, "scheduled-workspace"),
        runCandidateArenaTick
      ),
      paperEvaluationProtocol: boundPaperEvaluationProtocol(),
      paperExecutor: {
        async advance({ campaignId }: { campaignId: string }) {
          paperCalls.push(campaignId);
          return {
            status: "waiting" as const,
            action: "wait_until" as const,
            sequence: 1,
            wakeAt: "2026-07-12T10:00:01.000Z"
          };
        }
      }
    };

    const first = await runResearchControlCampaign(input);
    const firstSchedules = await sourceStore
      .listResearchControlCampaignPaperSchedules();
    if (first.campaign.paper_evaluation_protocol.protocol_status !== "bound") {
      throw new Error("fixture_expected_bound_paper_protocol");
    }
    expect(firstSchedules).toHaveLength(1);
    expect(first.paperStep).toMatchObject({
      status: "waiting",
      action: "wait_until"
    });
    expect(firstSchedules[0]).toMatchObject({
      campaign_ref: {
        id: first.campaign.research_control_campaign_id
      },
      report_ref: {
        id: first.report.research_control_campaign_report_id
      },
      paper_evaluation_protocol_digest:
        first.campaign.paper_evaluation_protocol.protocol_digest
    });

    const replay = await runResearchControlCampaign(input);
    expect(replay.report).toEqual(first.report);
    expect(await sourceStore.listResearchControlCampaignPaperSchedules())
      .toEqual(firstSchedules);
    expect(replay.paperStep).toEqual(first.paperStep);
    expect(paperCalls).toEqual([
      first.campaign.research_control_campaign_id,
      first.campaign.research_control_campaign_id
    ]);
  });

  it("waits for both arms and reruns only a missing exact tick after interruption", async () => {
    const sourceStore = new LocalStore(path.join(tmpDir, "recovery-source"));
    await sourceStore.initialize();
    const workspaceRoot = path.join(tmpDir, "recovery-workspace");
    const firstCalls: string[] = [];

    await expect(runResearchControlCampaign(campaignRunInput(
      sourceStore,
      workspaceRoot,
      async (tickInput) => {
        firstCalls.push(tickInput.tickId!);
        if (tickInput.researchAllocationMode === "static_control") {
          throw new Error("injected_static_interruption");
        }
        return runCandidateArenaTick(tickInput);
      }
    ))).rejects.toBeInstanceOf(ResearchControlCampaignRuntimeError);
    expect(firstCalls).toHaveLength(2);

    const campaign = (await sourceStore.listResearchControlCampaigns())[0]!;
    const paths = researchControlCampaignWorkspacePaths({
      workspaceRoot,
      campaignId: campaign.research_control_campaign_id,
      sourceRoot: sourceStore.root()
    });
    expect(await new LocalStore(paths.armRoots.adaptive_treatment)
      .listCandidateArenaTicks()).toHaveLength(1);
    expect(await new LocalStore(paths.armRoots.static_control)
      .listCandidateArenaTicks()).toHaveLength(0);

    const resumedCalls: string[] = [];
    const resumed = await runResearchControlCampaign(campaignRunInput(
      sourceStore,
      workspaceRoot,
      async (tickInput) => {
        resumedCalls.push(tickInput.tickId!);
        return runCandidateArenaTick(tickInput);
      }
    ));

    expect(resumedCalls).toEqual([campaign.arms[1].tick_ids[0]]);
    expect(researchControlCampaignReportHasRuntimeShape(resumed.report)).toBe(true);
  });

  it("accounts for a recovered precommitted arm without repeating provider effects", async () => {
    const sourceStore = new LocalStore(path.join(tmpDir, "orphan-source"));
    await sourceStore.initialize();
    const workspaceRoot = path.join(tmpDir, "orphan-workspace");
    let providerEffectCount = 0;
    const baseInput = campaignRunInput(
      sourceStore,
      workspaceRoot,
      runCandidateArenaTick
    );
    const input = {
      ...baseInput,
      idempotencyKey: "runtime-orphan-recovery-001",
      replayProviderFactory: async (
        candidateInput: ReplayTradingCandidateInput
      ) => {
        providerEffectCount += 1;
        return networklessReplayProvider(candidateInput);
      }
    };

    await expect(runResearchControlCampaign({
      ...input,
      runTick: async (tickInput) => {
        if (tickInput.researchAllocationMode !== "static_control") {
          return runCandidateArenaTick(tickInput);
        }
        const store = tickInput.store as LocalStore;
        const recordCommitment =
          store.recordResearchPreflightCommitment.bind(store);
        const recordTick = store.recordCandidateArenaTick.bind(store);
        store.recordResearchPreflightCommitment = async (commitment) => {
          await recordCommitment(commitment);
          throw new Error("synthetic_crash_after_commitment");
        };
        store.recordCandidateArenaTick = async () => {
          throw new Error("synthetic_crash_before_terminal_tick");
        };
        try {
          return await runCandidateArenaTick(tickInput);
        } finally {
          store.recordResearchPreflightCommitment = recordCommitment;
          store.recordCandidateArenaTick = recordTick;
        }
      }
    })).rejects.toMatchObject({
      code: "research_control_campaign_arm_tick_failed"
    });

    const campaign = (await sourceStore.listResearchControlCampaigns())[0]!;
    const paths = researchControlCampaignWorkspacePaths({
      workspaceRoot,
      campaignId: campaign.research_control_campaign_id,
      sourceRoot: sourceStore.root()
    });
    const staticStoreBeforeRestart = new LocalStore(
      paths.armRoots.static_control
    );
    const effectsBeforeRestart = providerEffectCount;
    expect(await staticStoreBeforeRestart.listCandidateArenaTicks()).toEqual([]);
    expect(await staticStoreBeforeRestart.listResearchPreflightCommitments())
      .not.toHaveLength(0);
    expect(await staticStoreBeforeRestart.listResearchWorkerCheckpoints())
      .toEqual([]);

    const resumed = await runResearchControlCampaign(input);

    expect(providerEffectCount).toBe(effectsBeforeRestart);
    const reopenedStaticStore = new LocalStore(paths.armRoots.static_control);
    const [ticks, allocations, checkpoints] = await Promise.all([
      reopenedStaticStore.listCandidateArenaTicks(),
      reopenedStaticStore.listCandidateArenaResearchAllocations(),
      reopenedStaticStore.listResearchWorkerCheckpoints()
    ]);
    const staticCampaignArm = campaign.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )!;
    const recoveredAllocation = allocations.find((allocation) =>
      allocation.tick_id === staticCampaignArm.tick_ids[0]
    )!;
    expect(ticks).toEqual([expect.objectContaining({
      tick_id: staticCampaignArm.tick_ids[0],
      status: "failed",
      created_candidate_refs: [],
      research_allocation_ref: {
        record_kind: "candidate_arena_research_allocation",
        id: recoveredAllocation.candidate_arena_research_allocation_id
      },
      research_allocation_digest: recoveredAllocation.allocation_digest,
      direction_results: recoveredAllocation.selected_directions.map(
        (selection) => expect.objectContaining({
          direction_kind: selection.direction_kind,
          status: "failed",
          error: "candidate_arena_restart_recovery"
        })
      )
    })]);
    expect(checkpoints).not.toHaveLength(0);
    expect(checkpoints.every((checkpoint) =>
      checkpoint.terminal_status === "failed_closed" &&
      checkpoint.terminal_reason === "restart_recovery"
    )).toBe(true);
    const staticArm = resumed.report.arms.find((arm) =>
      arm.arm_kind === "static_control"
    );
    expect(staticArm).toMatchObject({
      diagnostics: {
        attempt_count: ticks[0]!.direction_results.length,
        admitted_candidate_count: 0,
        duplicate_count: 0,
        quarantined_count: 0,
        failed_count: ticks[0]!.direction_results.length,
        provider_request_total: 0,
        runner_command_total: 0,
        scenario_count: 0,
        elapsed_ms: 0
      },
      paper_candidate_slots: [{ status: "no_admitted_candidate" }]
    });
  });

  it("accounts for a post-checkpoint crash without rewriting terminal evidence", async () => {
    const sourceStore = new LocalStore(path.join(tmpDir, "terminal-source"));
    await sourceStore.initialize();
    const workspaceRoot = path.join(tmpDir, "terminal-workspace");
    let providerEffectCount = 0;
    const input = {
      ...campaignRunInput(
        sourceStore,
        workspaceRoot,
        runCandidateArenaTick
      ),
      idempotencyKey: "runtime-terminal-recovery-001",
      replayProviderFactory: async (
        candidateInput: ReplayTradingCandidateInput
      ) => {
        providerEffectCount += 1;
        return networklessReplayProvider(candidateInput);
      }
    };

    await expect(runResearchControlCampaign({
      ...input,
      runTick: async (tickInput) => {
        if (tickInput.researchAllocationMode !== "static_control") {
          return runCandidateArenaTick(tickInput);
        }
        const store = tickInput.store as LocalStore;
        const recordTick = store.recordCandidateArenaTick.bind(store);
        store.recordCandidateArenaTick = async () => {
          throw new Error("synthetic_crash_after_terminal_checkpoints");
        };
        try {
          return await runCandidateArenaTick(tickInput);
        } finally {
          store.recordCandidateArenaTick = recordTick;
        }
      }
    })).rejects.toMatchObject({
      code: "research_control_campaign_arm_tick_failed"
    });

    const campaign = (await sourceStore.listResearchControlCampaigns())[0]!;
    const paths = researchControlCampaignWorkspacePaths({
      workspaceRoot,
      campaignId: campaign.research_control_campaign_id,
      sourceRoot: sourceStore.root()
    });
    const staticStoreBeforeRestart = new LocalStore(
      paths.armRoots.static_control
    );
    const [commitmentsBeforeRestart, checkpointsBeforeRestart] =
      await Promise.all([
        staticStoreBeforeRestart.listResearchPreflightCommitments(),
        staticStoreBeforeRestart.listResearchWorkerCheckpoints()
      ]);
    const effectsBeforeRestart = providerEffectCount;
    expect(effectsBeforeRestart).toBeGreaterThan(0);
    expect(await staticStoreBeforeRestart.listCandidateArenaTicks()).toEqual([]);
    expect(checkpointsBeforeRestart).toHaveLength(
      commitmentsBeforeRestart.length
    );
    expect(checkpointsBeforeRestart).not.toHaveLength(0);
    expect(checkpointsBeforeRestart.some((checkpoint) =>
      checkpoint.terminal_reason === "restart_recovery"
    )).toBe(false);

    const resumed = await runResearchControlCampaign(input);

    expect(providerEffectCount).toBe(effectsBeforeRestart);
    const reopenedStaticStore = new LocalStore(paths.armRoots.static_control);
    const [ticks, allocations, checkpointsAfterRestart] = await Promise.all([
      reopenedStaticStore.listCandidateArenaTicks(),
      reopenedStaticStore.listCandidateArenaResearchAllocations(),
      reopenedStaticStore.listResearchWorkerCheckpoints()
    ]);
    expect(checkpointsAfterRestart).toEqual(checkpointsBeforeRestart);
    const staticCampaignArm = campaign.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )!;
    const recoveredAllocation = allocations.find((allocation) =>
      allocation.tick_id === staticCampaignArm.tick_ids[0]
    )!;
    const terminalResults = recoveredAllocation.selected_directions.map(
      (selection) => checkpointsBeforeRestart.find((checkpoint) =>
        checkpoint.terminal_direction_result?.direction_kind ===
          selection.direction_kind
      )!.terminal_direction_result!
    );
    const createdCandidateIds = terminalResults.flatMap((result) =>
      result.status === "created" && result.candidate_id
        ? [result.candidate_id]
        : []
    );
    expect(ticks).toEqual([expect.objectContaining({
      tick_id: staticCampaignArm.tick_ids[0],
      status: "completed",
      created_candidate_refs: createdCandidateIds.map((candidateId) => ({
        record_kind: "trading_system_candidate",
        id: candidateId
      })),
      direction_results: terminalResults
    })]);
    const expectedProviderRequests = terminalResults.reduce(
      (total, result) =>
        total + (result.research_efficiency?.provider_request_total ?? 0),
      0
    );
    expect(resumed.report.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )).toMatchObject({
      diagnostics: {
        attempt_count: ticks[0]!.direction_results.length,
        admitted_candidate_count: terminalResults.filter((result) =>
          result.status === "created"
        ).length,
        duplicate_count: terminalResults.filter((result) =>
          result.status === "duplicate"
        ).length,
        quarantined_count: 0,
        failed_count: 0,
        provider_request_total: expectedProviderRequests
      },
      paper_candidate_slots: [{ status: "candidate_reserved" }]
    });
  });

  it("preserves exact admitted results beside a restart-recovered direction", async () => {
    const sourceStore = new LocalStore(path.join(tmpDir, "mixed-source"));
    await sourceStore.initialize();
    const workspaceRoot = path.join(tmpDir, "mixed-workspace");
    let providerEffectCount = 0;
    const input = {
      ...campaignRunInput(
        sourceStore,
        workspaceRoot,
        runCandidateArenaTick
      ),
      idempotencyKey: "runtime-mixed-recovery-001",
      replayProviderFactory: async (
        candidateInput: ReplayTradingCandidateInput
      ) => {
        providerEffectCount += 1;
        return networklessReplayProvider(candidateInput);
      }
    };

    await expect(runResearchControlCampaign({
      ...input,
      runTick: async (tickInput) => {
        if (tickInput.researchAllocationMode !== "static_control") {
          return runCandidateArenaTick(tickInput);
        }
        const store = tickInput.store as LocalStore;
        const recordCommitment =
          store.recordResearchPreflightCommitment.bind(store);
        const recordTick = store.recordCandidateArenaTick.bind(store);
        store.recordResearchPreflightCommitment = async (commitment) => {
          await recordCommitment(commitment);
          const direction = await store.getResearchDirection(
            commitment.research_direction_ref.id
          );
          if (direction?.direction_kind === "volatility_regime") {
            throw new Error("synthetic_mixed_crash_after_commitment");
          }
          return commitment;
        };
        store.recordCandidateArenaTick = async () => {
          throw new Error("synthetic_mixed_crash_before_tick");
        };
        try {
          return await runCandidateArenaTick(tickInput);
        } finally {
          store.recordResearchPreflightCommitment = recordCommitment;
          store.recordCandidateArenaTick = recordTick;
        }
      }
    })).rejects.toMatchObject({
      code: "research_control_campaign_arm_tick_failed"
    });

    const campaign = (await sourceStore.listResearchControlCampaigns())[0]!;
    const paths = researchControlCampaignWorkspacePaths({
      workspaceRoot,
      campaignId: campaign.research_control_campaign_id,
      sourceRoot: sourceStore.root()
    });
    const staticStoreBeforeRestart = new LocalStore(
      paths.armRoots.static_control
    );
    const checkpointsBeforeRestart =
      await staticStoreBeforeRestart.listResearchWorkerCheckpoints();
    const effectsBeforeRestart = providerEffectCount;
    expect(checkpointsBeforeRestart).toHaveLength(2);
    expect(checkpointsBeforeRestart.every((checkpoint) =>
      checkpoint.terminal_direction_result !== undefined
    )).toBe(true);

    const resumed = await runResearchControlCampaign(input);

    expect(providerEffectCount).toBe(effectsBeforeRestart);
    const reopenedStaticStore = new LocalStore(paths.armRoots.static_control);
    const [ticks, allocations, checkpointsAfterRestart] = await Promise.all([
      reopenedStaticStore.listCandidateArenaTicks(),
      reopenedStaticStore.listCandidateArenaResearchAllocations(),
      reopenedStaticStore.listResearchWorkerCheckpoints()
    ]);
    const staticCampaignArm = campaign.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )!;
    const allocation = allocations.find((candidate) =>
      candidate.tick_id === staticCampaignArm.tick_ids[0]
    )!;
    const recoveredTick = ticks.find((tick) =>
      tick.tick_id === staticCampaignArm.tick_ids[0]
    )!;
    expect(recoveredTick.direction_results.slice(0, 2)).toEqual(
      allocation.selected_directions.slice(0, 2).map((selection) =>
        checkpointsBeforeRestart.find((checkpoint) =>
          checkpoint.terminal_direction_result?.direction_kind ===
            selection.direction_kind
        )!.terminal_direction_result
      )
    );
    expect(recoveredTick.direction_results[2]).toMatchObject({
      direction_kind: "volatility_regime",
      status: "failed",
      error: "candidate_arena_restart_recovery"
    });
    expect(recoveredTick.direction_results[2]!.research_efficiency)
      .toBeUndefined();
    const restartCheckpoint = checkpointsAfterRestart.find((checkpoint) =>
      checkpoint.terminal_reason === "restart_recovery"
    )!;
    expect(restartCheckpoint).toMatchObject({
      terminal_status: "failed_closed",
      terminal_reason: "restart_recovery"
    });
    expect(restartCheckpoint).not.toHaveProperty(
      "candidate_admission_decision_ref"
    );
    expect(restartCheckpoint).not.toHaveProperty("terminal_direction_result");
    const preservedProviderRequests = recoveredTick.direction_results
      .slice(0, 2)
      .reduce((total, result) =>
        total + (result.research_efficiency?.provider_request_total ?? 0), 0
      );
    expect(preservedProviderRequests).toBeGreaterThan(0);
    expect(resumed.report.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )).toMatchObject({
      diagnostics: {
        admitted_candidate_count: 1,
        duplicate_count: 1,
        failed_count: 1,
        provider_request_total: preservedProviderRequests
      },
      paper_candidate_slots: [{ status: "candidate_reserved" }]
    });
  });

  it.each([
    ["persisted materialization", true],
    ["missing materialization", false]
  ])(
    "fails closed after admission with %s and excludes orphan authority",
    async (_label, materializeBeforeCrash) => {
      const suffix = materializeBeforeCrash ? "materialized" : "unmaterialized";
      const sourceStore = new LocalStore(
        path.join(tmpDir, `orphan-admission-${suffix}-source`)
      );
      await sourceStore.initialize();
      const workspaceRoot = path.join(
        tmpDir,
        `orphan-admission-${suffix}-workspace`
      );
      let providerEffectCount = 0;
      const input = {
        ...campaignRunInput(
          sourceStore,
          workspaceRoot,
          runCandidateArenaTick
        ),
        idempotencyKey: `runtime-orphan-admission-${suffix}-001`,
        replayProviderFactory: async (
          candidateInput: ReplayTradingCandidateInput
        ) => {
          providerEffectCount += 1;
          return networklessReplayProvider(candidateInput);
        }
      };

      await expect(runResearchControlCampaign({
        ...input,
        runTick: async (tickInput) => {
          if (tickInput.researchAllocationMode !== "static_control") {
            return runCandidateArenaTick(tickInput);
          }
          const store = tickInput.store as LocalStore;
          const recordCheckpoint =
            store.recordResearchWorkerCheckpoint.bind(store);
          const recordTick = store.recordCandidateArenaTick.bind(store);
          const materializeCandidate =
            store.materializeCandidate.bind(store);
          store.recordResearchWorkerCheckpoint = async () => {
            throw new Error("synthetic_crash_before_checkpoint");
          };
          store.recordCandidateArenaTick = async () => {
            throw new Error("synthetic_crash_before_terminal_tick");
          };
          if (!materializeBeforeCrash) {
            store.materializeCandidate = async () => {
              throw new Error("synthetic_crash_before_materialization");
            };
          }
          try {
            return await runCandidateArenaTick(tickInput);
          } finally {
            store.recordResearchWorkerCheckpoint = recordCheckpoint;
            store.recordCandidateArenaTick = recordTick;
            store.materializeCandidate = materializeCandidate;
          }
        }
      })).rejects.toMatchObject({
        code: "research_control_campaign_arm_tick_failed"
      });

      const campaign = (await sourceStore.listResearchControlCampaigns())[0]!;
      const paths = researchControlCampaignWorkspacePaths({
        workspaceRoot,
        campaignId: campaign.research_control_campaign_id,
        sourceRoot: sourceStore.root()
      });
      const staticStoreBeforeRestart = new LocalStore(
        paths.armRoots.static_control
      );
      const staticCampaignArm = campaign.arms.find((arm) =>
        arm.arm_kind === "static_control"
      )!;
      const [
        allocationsBeforeRestart,
        commitmentsBeforeRestart,
        admissionsBeforeRestart
      ] = await Promise.all([
        staticStoreBeforeRestart.listCandidateArenaResearchAllocations(),
        staticStoreBeforeRestart.listResearchPreflightCommitments(),
        staticStoreBeforeRestart.listCandidateAdmissionDecisions()
      ]);
      const staticAllocation = allocationsBeforeRestart.find((allocation) =>
        allocation.tick_id === staticCampaignArm.tick_ids[0]
      )!;
      const staticCommitmentIds = new Set(
        commitmentsBeforeRestart
          .filter((commitment) =>
            commitment.research_allocation_ref.id ===
              staticAllocation.candidate_arena_research_allocation_id
          )
          .map((commitment) =>
            commitment.research_preflight_commitment_id
          )
      );
      const staticAdmissions = admissionsBeforeRestart.filter((admission) =>
        staticCommitmentIds.has(
          admission.research_preflight_commitment_ref!.id
        )
      );
      const admittedSystemCodeIds = new Set(
        staticAdmissions
          .filter((admission) => admission.status === "admitted")
          .map((admission) => admission.system_code_ref.id)
      );
      const candidatesBeforeRestart =
        await staticStoreBeforeRestart.listCandidates();
      const candidateVersionsBeforeRestart = await Promise.all(
        candidatesBeforeRestart.map((candidate) =>
          staticStoreBeforeRestart.getCandidateVersion(
            candidate.active_version_id
          )
        )
      );
      const materializedAdmissionCandidates =
        candidateVersionsBeforeRestart.filter((version) =>
          admittedSystemCodeIds.has(version?.system_code_ref?.id ?? "")
        );
      const effectsBeforeRestart = providerEffectCount;
      expect(await staticStoreBeforeRestart.listCandidateArenaTicks())
        .toEqual([]);
      expect(await staticStoreBeforeRestart.listResearchWorkerCheckpoints())
        .toEqual([]);
      expect(staticAdmissions.some((admission) =>
        admission.status === "admitted"
      )).toBe(true);
      expect(materializedAdmissionCandidates.length).toBe(
        materializeBeforeCrash ? 1 : 0
      );

      const resumed = await runResearchControlCampaign(input);

      expect(providerEffectCount).toBe(effectsBeforeRestart);
      const reopenedStaticStore = new LocalStore(
        paths.armRoots.static_control
      );
      const [ticks, checkpoints] = await Promise.all([
        reopenedStaticStore.listCandidateArenaTicks(),
        reopenedStaticStore.listResearchWorkerCheckpoints()
      ]);
      expect(checkpoints).toHaveLength(staticCommitmentIds.size);
      expect(checkpoints.every((checkpoint) =>
        checkpoint.terminal_status === "failed_closed" &&
        checkpoint.terminal_reason === "restart_recovery" &&
        !Object.hasOwn(checkpoint, "candidate_admission_decision_ref") &&
        !Object.hasOwn(checkpoint, "terminal_direction_result")
      )).toBe(true);
      expect(ticks).toEqual([expect.objectContaining({
        tick_id: staticCampaignArm.tick_ids[0],
        status: "failed",
        created_candidate_refs: [],
        direction_results: staticAllocation.selected_directions.map(
          (selection) => expect.objectContaining({
            direction_kind: selection.direction_kind,
            status: "failed",
            error: "candidate_arena_restart_recovery"
          })
        )
      })]);
      expect(ticks[0]!.direction_results.every((result) =>
        result.candidate_id === undefined &&
        result.admission_decision_id === undefined &&
        result.paper_handoff_conformance === undefined &&
        result.research_efficiency === undefined
      )).toBe(true);
      expect(resumed.report.arms.find((arm) =>
        arm.arm_kind === "static_control"
      )).toMatchObject({
        diagnostics: {
          attempt_count: staticAllocation.selected_directions.length,
          admitted_candidate_count: 0,
          duplicate_count: 0,
          quarantined_count: 0,
          failed_count: staticAllocation.selected_directions.length,
          provider_request_total: 0,
          runner_command_total: 0,
          scenario_count: 0,
          elapsed_ms: 0
        },
        population_diversity: {
          observed_behaviors: {
            admitted_submission_count: 0,
            exact_behavior_duplicate_count: 0
          }
        },
        paper_candidate_slots: [{ status: "no_admitted_candidate" }]
      });
    }
  );

  it("does not auto-promote a post-admission execution failure", async () => {
    const sourceStore = new LocalStore(
      path.join(tmpDir, "post-admission-failure-source")
    );
    await sourceStore.initialize();
    const workspaceRoot = path.join(
      tmpDir,
      "post-admission-failure-workspace"
    );
    const outcome = await runResearchControlCampaign({
      ...campaignRunInput(
        sourceStore,
        workspaceRoot,
        runCandidateArenaTick
      ),
      idempotencyKey: "runtime-post-admission-failure-001",
      runTick: async (tickInput) => {
        if (tickInput.researchAllocationMode !== "static_control") {
          return runCandidateArenaTick(tickInput);
        }
        const store = tickInput.store as LocalStore;
        const materializeCandidate = store.materializeCandidate.bind(store);
        store.materializeCandidate = async () => {
          throw new Error("synthetic_post_admission_execution_failure");
        };
        try {
          return await runCandidateArenaTick(tickInput);
        } finally {
          store.materializeCandidate = materializeCandidate;
        }
      }
    });

    const staticStore = new LocalStore(outcome.armRoots.static_control);
    const [ticks, admissions, checkpoints] = await Promise.all([
      staticStore.listCandidateArenaTicks(),
      staticStore.listCandidateAdmissionDecisions(),
      staticStore.listResearchWorkerCheckpoints()
    ]);
    const admitted = admissions.find((admission) =>
      admission.status === "admitted"
    )!;
    const failedCheckpoint = checkpoints.find((checkpoint) =>
      checkpoint.research_preflight_commitment_ref.id ===
        admitted.research_preflight_commitment_ref!.id
    )!;
    expect(failedCheckpoint).toMatchObject({
      terminal_status: "failed_closed",
      terminal_reason: "execution_failed"
    });
    expect(failedCheckpoint).not.toHaveProperty(
      "candidate_admission_decision_ref"
    );
    expect(failedCheckpoint).not.toHaveProperty("terminal_direction_result");
    expect(ticks).toHaveLength(1);
    expect(ticks[0]!.direction_results.some((result) =>
      result.status === "failed" &&
      result.admission_decision_id === undefined &&
      result.candidate_id === undefined &&
      result.paper_handoff_conformance === undefined
    )).toBe(true);
    expect(outcome.report.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )).toMatchObject({
      diagnostics: {
        admitted_candidate_count: 0,
        failed_count: 1
      },
      population_diversity: {
        observed_behaviors: {
          admitted_submission_count: 0
        }
      },
      paper_candidate_slots: [{
        status: "no_admitted_candidate"
      }]
    });
  });

  it("recovers a post-admission failed checkpoint without replay", async () => {
    const sourceStore = new LocalStore(
      path.join(tmpDir, "post-admission-checkpoint-source")
    );
    await sourceStore.initialize();
    const workspaceRoot = path.join(
      tmpDir,
      "post-admission-checkpoint-workspace"
    );
    let providerEffectCount = 0;
    const input = {
      ...campaignRunInput(
        sourceStore,
        workspaceRoot,
        runCandidateArenaTick
      ),
      idempotencyKey: "runtime-post-admission-checkpoint-001",
      replayProviderFactory: async (
        candidateInput: ReplayTradingCandidateInput
      ) => {
        providerEffectCount += 1;
        return networklessReplayProvider(candidateInput);
      }
    };

    await expect(runResearchControlCampaign({
      ...input,
      runTick: async (tickInput) => {
        if (tickInput.researchAllocationMode !== "static_control") {
          return runCandidateArenaTick(tickInput);
        }
        const store = tickInput.store as LocalStore;
        const materializeCandidate = store.materializeCandidate.bind(store);
        const recordTick = store.recordCandidateArenaTick.bind(store);
        store.materializeCandidate = async () => {
          throw new Error("synthetic_post_admission_execution_failure");
        };
        store.recordCandidateArenaTick = async () => {
          throw new Error("synthetic_post_failure_checkpoint_crash");
        };
        try {
          return await runCandidateArenaTick(tickInput);
        } finally {
          store.materializeCandidate = materializeCandidate;
          store.recordCandidateArenaTick = recordTick;
        }
      }
    })).rejects.toMatchObject({
      code: "research_control_campaign_arm_tick_failed"
    });

    const campaign = (await sourceStore.listResearchControlCampaigns())[0]!;
    const paths = researchControlCampaignWorkspacePaths({
      workspaceRoot,
      campaignId: campaign.research_control_campaign_id,
      sourceRoot: sourceStore.root()
    });
    const staticStoreBeforeRestart = new LocalStore(
      paths.armRoots.static_control
    );
    const failedCheckpoints = (await staticStoreBeforeRestart
      .listResearchWorkerCheckpoints()).filter((checkpoint) =>
      checkpoint.terminal_status === "failed_closed" &&
      checkpoint.terminal_reason === "execution_failed"
    );
    const effectsBeforeRestart = providerEffectCount;
    expect(failedCheckpoints).toHaveLength(1);
    expect(failedCheckpoints[0]).not.toHaveProperty(
      "candidate_admission_decision_ref"
    );
    expect(failedCheckpoints[0]).not.toHaveProperty(
      "terminal_direction_result"
    );

    const resumed = await runResearchControlCampaign(input);

    expect(providerEffectCount).toBe(effectsBeforeRestart);
    const reopenedStaticStore = new LocalStore(
      paths.armRoots.static_control
    );
    const [tick] = await reopenedStaticStore.listCandidateArenaTicks();
    expect(tick?.direction_results.some((result) =>
      result.status === "failed" &&
      result.error === "candidate_arena_checkpoint_execution_failed" &&
      result.admission_decision_id === undefined &&
      result.candidate_id === undefined
    )).toBe(true);
    expect(resumed.report.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )).toMatchObject({
      diagnostics: {
        admitted_candidate_count: 0,
        failed_count: 1
      },
      paper_candidate_slots: [{
        status: "no_admitted_candidate"
      }]
    });
  });

  it("reports completed no-submission directions separately from failures", async () => {
    const sourceStore = new LocalStore(
      path.join(tmpDir, "no-submission-source")
    );
    await sourceStore.initialize();
    const agent = new FinishWithoutSubmissionResearchAgent();
    const outcome = await runResearchControlCampaign({
      ...campaignRunInput(
        sourceStore,
        path.join(tmpDir, "no-submission-workspace"),
        runCandidateArenaTick
      ),
      idempotencyKey: "runtime-no-submission-001",
      researchAgent: "codex",
      researchAgentIdentity: agent.agent,
      agentFactory: () => agent
    });

    expect(agent.runSessionCount).toBe(6);
    expect(outcome.report.arms).toEqual([
      expect.objectContaining({
        diagnostics: expect.objectContaining({
          attempt_count: 3,
          admitted_candidate_count: 0,
          duplicate_count: 0,
          quarantined_count: 0,
          failed_count: 0,
          no_submission_count: 3
        }),
        paper_candidate_slots: [{
          sequence: 1,
          tick_ref: expect.objectContaining({
            record_kind: "candidate_arena_tick"
          }),
          status: "no_admitted_candidate"
        }]
      }),
      expect.objectContaining({
        diagnostics: expect.objectContaining({
          attempt_count: 3,
          admitted_candidate_count: 0,
          duplicate_count: 0,
          quarantined_count: 0,
          failed_count: 0,
          no_submission_count: 3
        }),
        paper_candidate_slots: [{
          sequence: 1,
          tick_ref: expect.objectContaining({
            record_kind: "candidate_arena_tick"
          }),
          status: "no_admitted_candidate"
        }]
      })
    ]);
  });

  it("recovers exact no-submission checkpoint results without replay", async () => {
    const sourceStore = new LocalStore(
      path.join(tmpDir, "recovered-no-submission-source")
    );
    await sourceStore.initialize();
    const workspaceRoot = path.join(
      tmpDir,
      "recovered-no-submission-workspace"
    );
    const agent = new FinishWithoutSubmissionResearchAgent();
    const input = {
      ...campaignRunInput(
        sourceStore,
        workspaceRoot,
        runCandidateArenaTick
      ),
      idempotencyKey: "runtime-recovered-no-submission-001",
      researchAgent: "codex" as const,
      researchAgentIdentity: agent.agent,
      agentFactory: () => agent
    };

    await expect(runResearchControlCampaign({
      ...input,
      runTick: async (tickInput) => {
        if (tickInput.researchAllocationMode !== "static_control") {
          return runCandidateArenaTick(tickInput);
        }
        const store = tickInput.store as LocalStore;
        const recordTick = store.recordCandidateArenaTick.bind(store);
        store.recordCandidateArenaTick = async () => {
          throw new Error("synthetic_no_submission_post_checkpoint_crash");
        };
        try {
          return await runCandidateArenaTick(tickInput);
        } finally {
          store.recordCandidateArenaTick = recordTick;
        }
      }
    })).rejects.toMatchObject({
      code: "research_control_campaign_arm_tick_failed"
    });
    const sessionCountBeforeRestart = agent.runSessionCount;

    const resumed = await runResearchControlCampaign(input);

    expect(agent.runSessionCount).toBe(sessionCountBeforeRestart);
    const staticStore = new LocalStore(
      resumed.armRoots.static_control
    );
    const [tick] = await staticStore.listCandidateArenaTicks();
    expect(tick?.direction_results).toHaveLength(3);
    expect(tick?.direction_results.every((result) =>
      result.status === "no_submission"
    )).toBe(true);
    expect(resumed.report.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )).toMatchObject({
      diagnostics: {
        attempt_count: 3,
        admitted_candidate_count: 0,
        duplicate_count: 0,
        quarantined_count: 0,
        failed_count: 0,
        no_submission_count: 3
      },
      paper_candidate_slots: [{
        status: "no_admitted_candidate"
      }]
    });
  });

  it("fails closed legacy admission checkpoints without replay or authority", async () => {
    const sourceStore = new LocalStore(
      path.join(tmpDir, "legacy-admission-source")
    );
    await sourceStore.initialize();
    const workspaceRoot = path.join(
      tmpDir,
      "legacy-admission-workspace"
    );
    let providerEffectCount = 0;
    const input = {
      ...campaignRunInput(
        sourceStore,
        workspaceRoot,
        runCandidateArenaTick
      ),
      idempotencyKey: "runtime-legacy-admission-001",
      replayProviderFactory: async (
        candidateInput: ReplayTradingCandidateInput
      ) => {
        providerEffectCount += 1;
        return networklessReplayProvider(candidateInput);
      }
    };

    await expect(runResearchControlCampaign({
      ...input,
      runTick: async (tickInput) => {
        if (tickInput.researchAllocationMode !== "static_control") {
          return runCandidateArenaTick(tickInput);
        }
        const store = tickInput.store as LocalStore;
        const recordCheckpoint =
          store.recordResearchWorkerCheckpoint.bind(store);
        const recordTick = store.recordCandidateArenaTick.bind(store);
        store.recordResearchWorkerCheckpoint = async (checkpoint) =>
          recordCheckpoint(legacyCheckpointWithoutTerminalResult(checkpoint));
        store.recordCandidateArenaTick = async () => {
          throw new Error("synthetic_legacy_admission_tick_crash");
        };
        try {
          return await runCandidateArenaTick(tickInput);
        } finally {
          store.recordResearchWorkerCheckpoint = recordCheckpoint;
          store.recordCandidateArenaTick = recordTick;
        }
      }
    })).rejects.toMatchObject({
      code: "research_control_campaign_arm_tick_failed"
    });

    const campaign = (await sourceStore.listResearchControlCampaigns())[0]!;
    const paths = researchControlCampaignWorkspacePaths({
      workspaceRoot,
      campaignId: campaign.research_control_campaign_id,
      sourceRoot: sourceStore.root()
    });
    const staticStore = new LocalStore(paths.armRoots.static_control);
    const legacyCheckpoints =
      await staticStore.listResearchWorkerCheckpoints();
    const effectsBeforeRestart = providerEffectCount;
    expect(legacyCheckpoints).not.toHaveLength(0);
    expect(legacyCheckpoints.every((checkpoint) =>
      checkpoint.terminal_reason === "admission_recorded" &&
      checkpoint.terminal_direction_result === undefined
    )).toBe(true);

    const resumed = await runResearchControlCampaign(input);

    expect(providerEffectCount).toBe(effectsBeforeRestart);
    expect(await staticStore.listResearchWorkerCheckpoints())
      .toEqual(legacyCheckpoints);
    const [tick] = await staticStore.listCandidateArenaTicks();
    expect(tick?.direction_results.every((result) =>
      result.status === "failed" &&
      result.error === "candidate_arena_recovery_evidence_unavailable" &&
      result.candidate_id === undefined &&
      result.admission_decision_id === undefined &&
      result.paper_handoff_conformance === undefined &&
      result.research_efficiency === undefined
    )).toBe(true);
    expect(resumed.report.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )).toMatchObject({
      diagnostics: {
        admitted_candidate_count: 0,
        duplicate_count: 0,
        quarantined_count: 0,
        failed_count: 3,
        no_submission_count: 0
      },
      population_diversity: {
        observed_behaviors: {
          admitted_submission_count: 0,
          exact_behavior_duplicate_count: 0
        }
      },
      paper_candidate_slots: [{
        status: "no_admitted_candidate"
      }]
    });
  });

  it("fails closed legacy no-submission checkpoints without replay", async () => {
    const sourceStore = new LocalStore(
      path.join(tmpDir, "legacy-no-submission-source")
    );
    await sourceStore.initialize();
    const workspaceRoot = path.join(
      tmpDir,
      "legacy-no-submission-workspace"
    );
    const agent = new FinishWithoutSubmissionResearchAgent();
    const input = {
      ...campaignRunInput(
        sourceStore,
        workspaceRoot,
        runCandidateArenaTick
      ),
      idempotencyKey: "runtime-legacy-no-submission-001",
      researchAgent: "codex" as const,
      researchAgentIdentity: agent.agent,
      agentFactory: () => agent
    };

    await expect(runResearchControlCampaign({
      ...input,
      runTick: async (tickInput) => {
        if (tickInput.researchAllocationMode !== "static_control") {
          return runCandidateArenaTick(tickInput);
        }
        const store = tickInput.store as LocalStore;
        const recordCheckpoint =
          store.recordResearchWorkerCheckpoint.bind(store);
        const recordTick = store.recordCandidateArenaTick.bind(store);
        store.recordResearchWorkerCheckpoint = async (checkpoint) =>
          recordCheckpoint(legacyCheckpointWithoutTerminalResult(checkpoint));
        store.recordCandidateArenaTick = async () => {
          throw new Error("synthetic_legacy_no_submission_tick_crash");
        };
        try {
          return await runCandidateArenaTick(tickInput);
        } finally {
          store.recordResearchWorkerCheckpoint = recordCheckpoint;
          store.recordCandidateArenaTick = recordTick;
        }
      }
    })).rejects.toMatchObject({
      code: "research_control_campaign_arm_tick_failed"
    });

    const campaign = (await sourceStore.listResearchControlCampaigns())[0]!;
    const paths = researchControlCampaignWorkspacePaths({
      workspaceRoot,
      campaignId: campaign.research_control_campaign_id,
      sourceRoot: sourceStore.root()
    });
    const staticStore = new LocalStore(paths.armRoots.static_control);
    const legacyCheckpoints =
      await staticStore.listResearchWorkerCheckpoints();
    const sessionCountBeforeRestart = agent.runSessionCount;
    expect(legacyCheckpoints).toHaveLength(3);
    expect(legacyCheckpoints.every((checkpoint) =>
      checkpoint.terminal_reason === "finished_without_submission" &&
      checkpoint.terminal_direction_result === undefined
    )).toBe(true);

    const resumed = await runResearchControlCampaign(input);

    expect(agent.runSessionCount).toBe(sessionCountBeforeRestart);
    expect(await staticStore.listResearchWorkerCheckpoints())
      .toEqual(legacyCheckpoints);
    const [tick] = await staticStore.listCandidateArenaTicks();
    expect(tick?.direction_results.every((result) =>
      result.status === "failed" &&
      result.error === "candidate_arena_recovery_evidence_unavailable" &&
      result.candidate_id === undefined &&
      result.admission_decision_id === undefined &&
      result.paper_handoff_conformance === undefined &&
      result.research_efficiency === undefined
    )).toBe(true);
    expect(resumed.report.arms.find((arm) =>
      arm.arm_kind === "static_control"
    )).toMatchObject({
      diagnostics: {
        failed_count: 3,
        no_submission_count: 0
      },
      paper_candidate_slots: [{
        status: "no_admitted_candidate"
      }]
    });
  });

  it("rejects a campaign workspace nested under the source store", async () => {
    const sourceStore = new LocalStore(path.join(tmpDir, "nested-source"));
    await sourceStore.initialize();

    await expect(runResearchControlCampaign(campaignRunInput(
      sourceStore,
      path.join(sourceStore.root(), "campaigns"),
      runCandidateArenaTick
    ))).rejects.toMatchObject({
      code: "research_control_campaign_workspace_overlaps_source"
    });
  });
});

function campaignRunInput(
  store: LocalStore,
  workspaceRoot: string,
  runTick: typeof runCandidateArenaTick
) {
  return {
    store,
    workspaceRoot,
    idempotencyKey: "runtime-recovery-001",
    sourceCandidateId: FIXTURE_CANDIDATE_ID,
    researchAgent: "fixture" as const,
    researchAgentIdentity: new FixtureTradingResearchAgentAdapter().agent,
    agentFactory: fixtureAgentFactory,
    tickCountPerArm: 1,
    artifactRunner: networklessArtifactRunner(),
    replayProviderFactory: networklessReplayProvider,
    runTick
  };
}

function boundPaperEvaluationProtocol():
  ResearchControlCampaignPaperEvaluationProtocolInput {
  return {
    protocol_status: "bound" as const,
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge" as const,
      symbol: "BTCUSDT" as const,
      interval_ms: 60_000,
      minimum_observation_count: 1,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 1,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 2,
      primary_metric: "net_revenue_usdt" as const,
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 1,
      require_non_overlapping_windows: true,
      require_both_qualified: true,
      release_policy: "sealed_until_adjudication" as const
    },
    market_data_configuration_digest: `sha256:${"6".repeat(64)}`,
    paper_policy_identity: {
      market_data_policy_version: "market-v1",
      gateway_policy_version: "gateway-v1",
      cost_policy_version: "cost-v1",
      funding_policy_version: "funding-v1",
      slippage_policy_version: "slippage-v1",
      fill_policy_version: "fill-v1",
      risk_policy_version: "risk-v1",
      paper_account_policy_version: "account-v1",
      decision_event_protocol_version: "decision-v1",
      persistent_state_boundary_version: "state-v1"
    },
    schedule_policy: {
      policy_version: "research-control-paper-schedule-v1" as const,
      source_start_order: "paired_by_sequence" as const,
      maximum_active_source_pairs: 2 as const,
      maximum_cross_arm_first_tick_skew_ms: 5_000,
      source_missed_start_policy: "slot_expired" as const,
      confirmation_precommit_deadline_ms: 600_000
    }
  };
}

class FinishWithoutSubmissionResearchAgent
implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-codex-trading-research",
    provider: "codex",
    permission_policy: "artifact_workspace_only"
  };
  runSessionCount = 0;

  async improveArtifact(_input: AgentEditInput): Promise<AgentEditResult> {
    throw new Error("no_submission_legacy_edit_path_used");
  }

  async runSession(
    input: ResearchWorkerSessionInput
  ): Promise<ResearchWorkerSessionResult> {
    this.runSessionCount += 1;
    const finished = await input.tools.finishWithoutSubmission({
      idempotency_key: "campaign-finish-without-submission",
      reason: "No development submission should enter sealed admission."
    });
    return {
      status: finished.session_status,
      summary: finished.reason,
      provider_command_count: 1
    };
  }
}

class TradingReviewCampaignStore extends LocalStore {
  override async getLatestTradingPromotion(): Promise<TradingPromotionRecord> {
    return runtimeTradingPromotion();
  }

  override async getTradingPromotion(
    promotionId: string
  ): Promise<TradingPromotionRecord | undefined> {
    const promotion = runtimeTradingPromotion();
    return promotion.trading_promotion_id === promotionId
      ? promotion
      : undefined;
  }
}

function runtimeTradingPromotion(): TradingPromotionRecord {
  return {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "runtime-schedule-comparator",
    status: "promoted_for_trading_review",
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "runtime-champion-candidate"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "runtime-champion-version"
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: "runtime-champion-evaluation"
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: "runtime-champion-confirmation"
      },
      campaign_digest: `sha256:${"a".repeat(64)}`,
      campaign_outcome_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: "runtime-champion-confirmation-outcome"
      },
      campaign_outcome_digest: `sha256:${"b".repeat(64)}`,
      final_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "runtime-champion-verdict"
      },
      final_verdict_digest: `sha256:${"c".repeat(64)}`
    },
    promoted_at: "2026-07-12T09:00:00.000Z",
    authority_status: "not_live"
  };
}

function fixtureAgentFactory(): TradingResearchAgentAdapter {
  return new FixtureTradingResearchAgentAdapter();
}

function legacyCheckpointWithoutTerminalResult(
  checkpoint: ResearchWorkerCheckpointRecord
): ResearchWorkerCheckpointRecord {
  const legacy = structuredClone(checkpoint);
  delete legacy.terminal_direction_result;
  legacy.checkpoint_digest = `sha256:${createHash("sha256")
    .update(researchWorkerCheckpointDigestInput(legacy))
    .digest("hex")}`;
  return legacy;
}

function networklessArtifactRunner(): TradingArtifactRunner {
  return {
    kind: "host_process",
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    async run(input) {
      const market = input.provider.candidate_input.market;
      const account = input.provider.candidate_input.account;
      const shouldHold = market.moving_average_fast === market.moving_average_slow;
      const orderRequest = {
        symbol: market.symbol,
        side: shouldHold
          ? "hold" as const
          : market.moving_average_fast < market.moving_average_slow
            ? "sell" as const
            : "buy" as const,
        quantity: shouldHold
          ? 0
          : Number((account.equity * Math.min(0.02, account.max_risk_fraction) /
            market.price).toFixed(8)),
        order_type: shouldHold ? "none" as const : "market" as const,
        reason: "networkless ResearchControlCampaign fixture"
      };
      const validation = validateOrderRequest(orderRequest, market, account);
      const events: TradingSystemEvent[] = [
        { event: "market_snapshot", ...market },
        { event: "account_state", ...account },
        { event: "order_request", ...orderRequest },
        { event: "order_validation", ...validation },
        { event: "run_complete", accepted: validation.accepted }
      ];
      await mkdir(input.output_dir, { recursive: true });
      const eventsPath = path.join(input.output_dir, "events.jsonl");
      await writeFile(
        eventsPath,
        `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
        "utf8"
      );
      return {
        status: "completed",
        runner_kind: "host_process",
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: eventsPath,
        stdout: events.map((event) => JSON.stringify(event)).join("\n"),
        stderr: "",
        events,
        provider_requests: providerRequests(orderRequest)
      };
    }
  };
}

async function networklessReplayProvider(
  candidateInput: ReplayTradingCandidateInput
): Promise<ReplayTradingApiProviderSession> {
  return {
    base_url: "",
    close: async () => undefined,
    requests: () => [],
    candidate_input: candidateInput
  };
}

function providerRequests(body: unknown): TradingProviderRequestLog[] {
  return [
    providerRequest("GET", "/market/snapshot"),
    providerRequest("GET", "/account/state"),
    providerRequest("POST", "/orders/validate", body)
  ];
}

function providerRequest(
  method: string,
  requestPath: string,
  body?: unknown
): TradingProviderRequestLog {
  return {
    at: "2026-07-12T10:00:00.000Z",
    method,
    path: requestPath,
    ...(body === undefined ? {} : { body }),
    response_status: 200
  };
}
