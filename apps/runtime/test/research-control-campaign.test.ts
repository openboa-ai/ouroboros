import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCandidateArenaTick } from "@ouroboros/application/candidate/arena";
import { FixtureTradingResearchAgentAdapter } from
  "@ouroboros/application/trading/research/agent-adapters";
import type { TradingArtifactRunner } from
  "@ouroboros/application/trading/research/artifact-runner";
import { validateOrderRequest } from
  "@ouroboros/application/trading/research/replay-trading-api-provider";
import type {
  ReplayTradingApiProviderSession,
  ReplayTradingCandidateInput,
  TradingProviderRequestLog,
  TradingResearchAgentAdapter,
  TradingSystemEvent
} from "@ouroboros/application/trading/research/types";
import { researchControlCampaignReportHasRuntimeShape } from "@ouroboros/domain";
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
  it("hashes regular files canonically and excludes only campaign evidence", async () => {
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
    const sourceStore = new LocalStore(sourceRoot);
    await sourceStore.initialize();
    const tickCalls: string[] = [];

    const outcome = await runResearchControlCampaign({
      store: sourceStore,
      workspaceRoot,
      idempotencyKey: "runtime-isolation-001",
      sourceCandidateId: FIXTURE_CANDIDATE_ID,
      researchAgent: "fixture",
      researchAgentIdentity: new FixtureTradingResearchAgentAdapter().agent,
      agentFactory: fixtureAgentFactory,
      tickCountPerArm: 1,
      artifactRunner: networklessArtifactRunner(),
      replayProviderFactory: networklessReplayProvider,
      runTick: async (input) => {
        tickCalls.push(input.tickId!);
        return runCandidateArenaTick(input);
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
    expect(tickCalls).toHaveLength(2);
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

function fixtureAgentFactory(): TradingResearchAgentAdapter {
  return new FixtureTradingResearchAgentAdapter();
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
