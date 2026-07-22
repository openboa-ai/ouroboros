import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  recoverIncompleteResearchWorkerCheckpoints,
  runCandidateArenaTick
} from "@ouroboros/application/candidate/arena";
import { researchWorkerNotebookPath } from
  "@ouroboros/application/candidate/research-worker-lifecycle";
import {
  CandidateArenaResearchAllocationService,
  CandidateArenaResearchAllocationServiceError,
  decideCandidateArenaResearchAllocation,
  toCandidateArenaResearchAllocationReadModel
} from
  "@ouroboros/application/candidate/research-allocation";
import { createPaperTradingEvaluationCommitment } from "@ouroboros/application/trading/paper/commitment";
import { initialPaperTradingEngineState } from "@ouroboros/application/trading/paper/engine";
import type { TradingArtifactRunner } from "@ouroboros/application/trading/research/artifact-runner";
import { PaperTradingHandoffConformanceInfrastructureError } from
  "@ouroboros/application/trading/research/paper-handoff-conformance";
import { validateOrderRequest } from "@ouroboros/application/trading/research/replay-trading-api-provider";
import type {
  AgentEditInput,
  AgentEditResult,
  ManagedResearchAgent,
  ReplayTradingApiProviderSession,
  ReplayTradingCandidateInput,
  ResearchWorkerSessionAdapter,
  ResearchWorkerSessionInput,
  ResearchWorkerSessionResult,
  TradingProviderRequestLog,
  TradingResearchAgentAdapter,
  TradingSystemEvent
} from "@ouroboros/application/trading/research/types";
import type {
  CandidateArenaTickRecord,
  CandidateInspectReadModel,
  PaperTradingComparisonResearchReleaseRecord,
  PaperTradingEvaluationRecord,
  PaperTradingEvidencePurpose,
  PaperTradingObservationRecord,
  Ref,
  ResearchAllocationPolicyDecisionRecord,
  ResearchEvidenceArtifactRecord,
  ResearchFindingRecord,
  ResearchWorkerCheckpointRecord
} from "@ouroboros/domain";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS,
  candidateEgressNetworkPolicyDigestInput,
  canonicalResearchEvidenceArtifactSummary,
  paperTradingComparisonPersistedRecordDigestInput,
  researchAllocationPolicyDecisionDigestInput,
  researchEvidenceArtifactDigestInput
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";
import { passingPaperHandoffProbe } from "./helpers/paper-handoff";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-arena-paper-context-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("CandidateArena paper evidence context", () => {
  it("binds a default goal and methodology for direct Arena ticks", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    let preflightVisibleWhenFactoryCalled = false;

    await runCandidateArenaTick({
      store,
      tickId: "default-goal-methodology",
      now: () => "2026-07-22T09:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => {
        const preflightDir = path.join(
          tmpDir,
          "research-preflight-commitments",
          "items"
        );
        preflightVisibleWhenFactoryCalled = existsSync(preflightDir) &&
          readdirSync(preflightDir).some((entry) => entry.endsWith(".json"));
        return new CapturingResearchAgent([]);
      },
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(preflightVisibleWhenFactoryCalled).toBe(true);
    await expect(store.getCandidateArenaResearchAllocation(
      "candidate-arena-research-allocation-default-goal-methodology"
    )).resolves.toMatchObject({
      trigger: {
        trigger_kind: "goal",
        goal: "Run one bounded CandidateArena Research cycle."
      }
    });
    const commitment = (await store.listResearchPreflightCommitments())
      .find((commitment) => commitment.candidate_arena_tick_id ===
        "default-goal-methodology");
    expect(commitment?.methodology).toMatchObject({
      direction_kind: "trend_following",
      evidence_bindings: []
    });
  });

  it("fails closed before provider effects when the agent descriptor drifts", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const contexts: string[] = [];

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "agent-descriptor-drift",
      now: () => "2026-07-22T09:30:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: lifecycleResearchAgentDescriptor(),
      agentFactory: () => new CapturingResearchAgent(contexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(contexts).toEqual([]);
    expect((await store.listResearchWorkerCheckpoints())).toEqual([
      expect.objectContaining({
        candidate_arena_tick_id: "agent-descriptor-drift",
        terminal_status: "failed_closed",
        terminal_reason: "execution_failed"
      })
    ]);
    expect((await store.listCandidateArenaTicks())[0]?.direction_results[0])
      .toMatchObject({
        status: "failed",
        error: "candidate_arena_research_agent_descriptor_mismatch"
      });
  });

  it("accepts equivalent agent descriptors with an omitted optional model", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const contexts: string[] = [];
    const committedAgent: ManagedResearchAgent = {
      id: "managed-agent-model-omitted",
      provider: "codex",
      permission_policy: "artifact_workspace_only"
    };
    const reportedAgent: ManagedResearchAgent = {
      ...committedAgent,
      model: undefined
    };

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "agent-descriptor-optional-model",
      now: () => "2026-07-22T09:45:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: committedAgent,
      agentFactory: () => new CapturingResearchAgent(
        contexts,
        undefined,
        reportedAgent
      ),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(1);
    expect(contexts).toHaveLength(1);
  });

  it("binds new Arena evidence and distinct methodologies before provider effects", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const firstContexts: string[] = [];
    await runCandidateArenaTick({
      store,
      tickId: "evidence-source",
      now: () => "2026-07-22T10:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: capturingResearchAgentDescriptor(),
      agentFactory: () => new CapturingResearchAgent(
        firstContexts,
        undefined,
        capturingResearchAgentDescriptor()
      ),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const finding = (await store.listResearchFindings()).at(-1);
    expect(finding).toBeDefined();
    const evidence = researchFindingEvidence(finding!);
    const evidenceReadyAt = new Date(
      Date.parse(evidence.captured_at) + 1_000
    ).toISOString();

    const eventContexts: string[] = [];
    await runCandidateArenaTick({
      store,
      tickId: "evidence-event",
      now: () => evidenceReadyAt,
      directions: ["trend_following", "mean_reversion"],
      researchTrigger: {
        trigger_kind: "time",
        goal: "Run the next bounded Research cycle."
      },
      researchEvidenceSource: async () => [evidence],
      researchAgent: "codex",
      researchAgentDescriptor: capturingResearchAgentDescriptor(),
      agentFactory: () => new CapturingResearchAgent(
        eventContexts,
        undefined,
        capturingResearchAgentDescriptor()
      ),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    const allocation = await store.getCandidateArenaResearchAllocation(
      "candidate-arena-research-allocation-evidence-event"
    );
    expect(allocation?.trigger).toMatchObject({
      trigger_kind: "arena_event",
      source_ref: evidence.artifact_ref,
      evidence_artifact_ref: {
        record_kind: "research_evidence_artifact",
        id: evidence.research_evidence_artifact_id
      },
      evidence_artifact_digest: evidence.artifact_digest
    });
    const commitments = (await store.listResearchPreflightCommitments())
      .filter((commitment) => commitment.candidate_arena_tick_id ===
        "evidence-event");
    expect(commitments).toHaveLength(2);
    expect(new Set(commitments.map((commitment) =>
      commitment.methodology?.direction_kind
    ))).toEqual(new Set(["trend_following", "mean_reversion"]));
    expect(commitments.every((commitment) =>
      commitment.methodology?.evidence_bindings.some((binding) =>
        binding.evidence_artifact_ref.id ===
          evidence.research_evidence_artifact_id &&
        binding.evidence_artifact_digest === evidence.artifact_digest
      )
    )).toBe(true);
    const workers = await store.listResearchWorkers();
    expect(commitments.every((commitment) => {
      const worker = workers.find((entry) =>
        entry.research_worker_id === commitment.research_worker_ref.id
      );
      const selection = allocation?.selected_directions.find((entry) =>
        entry.direction_kind === commitment.methodology?.direction_kind
      );
      return worker?.provider_kind === "codex_cli" &&
        worker.model === "capturing-context" &&
        selection?.experiment_budget ===
          commitment.development_policy.submission_limit;
    })).toBe(true);
    expect((await store.listResearchWorkerCheckpoints()).filter((checkpoint) =>
      checkpoint.candidate_arena_tick_id === "evidence-event"
    )).toEqual([
      expect.objectContaining({ terminal_status: "completed" }),
      expect.objectContaining({ terminal_status: "completed" })
    ]);
    expect(eventContexts).toHaveLength(2);
    expect(eventContexts.every((context) =>
      context.includes(evidence.research_evidence_artifact_id) &&
      context.includes(evidence.summary)
    )).toBe(true);

    const restarted = new LocalStore(tmpDir);
    await restarted.initialize();
    await expect(restarted.getResearchEvidenceArtifact(
      evidence.research_evidence_artifact_id
    )).resolves.toEqual(evidence);
    await runCandidateArenaTick({
      store: restarted,
      tickId: "evidence-unchanged",
      now: () => new Date(
        Date.parse(evidenceReadyAt) + 1_000
      ).toISOString(),
      directions: ["volatility_regime"],
      researchTrigger: {
        trigger_kind: "time",
        goal: "Run the next bounded Research cycle."
      },
      researchEvidenceSource: async () => [evidence],
      researchAgent: "codex",
      researchAgentDescriptor: capturingResearchAgentDescriptor(),
      agentFactory: () => new CapturingResearchAgent(
        [],
        undefined,
        capturingResearchAgentDescriptor()
      ),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    await expect(restarted.getCandidateArenaResearchAllocation(
      "candidate-arena-research-allocation-evidence-unchanged"
    )).resolves.toMatchObject({
      trigger: { trigger_kind: "time" }
    });
  });

  it("accepts evidence captured while the preflight snapshot is collected", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await runCandidateArenaTick({
      store,
      tickId: "collection-window-source",
      now: () => "2026-07-22T10:00:01.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const finding = (await store.listResearchFindings()).at(-1)!;
    const evidence = researchFindingEvidence(finding);
    const contexts: string[] = [];
    let nowMs = Date.parse(evidence.captured_at) - 1_000;

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "collection-window-consumer",
      now: () => {
        const value = new Date(nowMs).toISOString();
        nowMs += 1_000;
        return value;
      },
      directions: ["mean_reversion"],
      researchTrigger: {
        trigger_kind: "time",
        goal: "Use evidence captured during this collection window."
      },
      researchEvidenceSource: async () => [evidence],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(contexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(1);
    expect(contexts[0]).toContain(evidence.research_evidence_artifact_id);
    expect(await store.getCandidateArenaResearchAllocation(
      "candidate-arena-research-allocation-collection-window-consumer"
    )).toMatchObject({
      trigger: {
        trigger_kind: "arena_event",
        triggered_at: evidence.captured_at,
        evidence_artifact_digest: evidence.artifact_digest
      }
    });
    expect((await store.listCandidateArenaTicks()).find(
      (tick) => tick.tick_id === "collection-window-consumer"
    )?.started_at).toBe(evidence.captured_at);
    expect((await store.listResearchPreflightCommitments()).find(
      (commitment) => commitment.candidate_arena_tick_id ===
        "collection-window-consumer"
    )?.methodology?.evidence_bindings).toContainEqual({
      evidence_artifact_ref: {
        record_kind: "research_evidence_artifact",
        id: evidence.research_evidence_artifact_id
      },
      evidence_artifact_digest: evidence.artifact_digest
    });
  });

  it("does not reclaim an Arena event after a crash leaves only its allocation", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await runCandidateArenaTick({
      store,
      tickId: "event-claim-source",
      now: () => "2026-07-22T10:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const finding = (await store.listResearchFindings()).at(-1)!;
    const evidence = researchFindingEvidence(finding);
    const triggerAt = new Date(
      Date.parse(evidence.captured_at) + 1_000
    ).toISOString();
    await store.recordResearchEvidenceArtifact(evidence);
    await new CandidateArenaResearchAllocationService({
      store,
      now: () => triggerAt
    }).allocate({
      tickId: "event-claim-orphan",
      allocationMode: "explicit",
      allocationPolicyBasis: { basis_kind: "explicit_request" },
      explicitDirections: ["trend_following"],
      findingClusters: [],
      latestTicks: [],
      trigger: {
        trigger_kind: "arena_event",
        trigger_id: "event-claim-orphan-trigger",
        goal: "Use this exact event once.",
        triggered_at: triggerAt,
        source_ref: { ...evidence.artifact_ref },
        evidence_artifact_ref: {
          record_kind: "research_evidence_artifact",
          id: evidence.research_evidence_artifact_id
        },
        evidence_artifact_digest: evidence.artifact_digest,
        authority_status: "research_only"
      }
    });

    await runCandidateArenaTick({
      store,
      tickId: "event-claim-after-restart",
      now: () => new Date(Date.parse(triggerAt) + 1_000).toISOString(),
      directions: ["mean_reversion"],
      researchTrigger: {
        trigger_kind: "time",
        goal: "Continue after restart."
      },
      researchEvidenceSource: async () => [evidence],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    await expect(store.getCandidateArenaResearchAllocation(
      "candidate-arena-research-allocation-event-claim-after-restart"
    )).resolves.toMatchObject({
      trigger: { trigger_kind: "time" }
    });
  });

  it("hydrates frozen Arena event evidence when its allocation retries", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await runCandidateArenaTick({
      store,
      tickId: "event-retry-source",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const finding = (await store.listResearchFindings()).at(-1)!;
    const evidence = researchFindingEvidence(finding);
    const triggerAt = new Date(
      Date.parse(evidence.captured_at) + 1_000
    ).toISOString();
    await store.recordResearchEvidenceArtifact(evidence);
    await new CandidateArenaResearchAllocationService({
      store,
      now: () => triggerAt
    }).allocate({
      tickId: "event-allocation-retry",
      allocationMode: "explicit",
      allocationPolicyBasis: { basis_kind: "explicit_request" },
      explicitDirections: ["mean_reversion"],
      findingClusters: [],
      latestTicks: [],
      trigger: {
        trigger_kind: "arena_event",
        trigger_id: "event-allocation-retry-trigger",
        goal: "Use this exact event once.",
        triggered_at: triggerAt,
        source_ref: { ...evidence.artifact_ref },
        evidence_artifact_ref: {
          record_kind: "research_evidence_artifact",
          id: evidence.research_evidence_artifact_id
        },
        evidence_artifact_digest: evidence.artifact_digest,
        authority_status: "research_only"
      }
    });
    const contexts: string[] = [];

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "event-allocation-retry",
      now: () => new Date(Date.parse(triggerAt) + 1_000).toISOString(),
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(contexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(1);
    expect(contexts[0]).toContain(evidence.research_evidence_artifact_id);
    expect((await store.listResearchPreflightCommitments()).find(
      (commitment) => commitment.candidate_arena_tick_id ===
        "event-allocation-retry"
    )?.methodology?.evidence_bindings).toContainEqual({
      evidence_artifact_ref: {
        record_kind: "research_evidence_artifact",
        id: evidence.research_evidence_artifact_id
      },
      evidence_artifact_digest: evidence.artifact_digest
    });
  });

  it("reuses the exact persisted allocation intent after restart", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const trigger = {
      trigger_kind: "goal" as const,
      trigger_id: "research-trigger-trigger-recovery-tick",
      goal: "Run one bounded CandidateArena Research cycle.",
      triggered_at: "2026-07-22T11:00:00.000Z",
      authority_status: "research_only" as const
    };
    const frozen = await new CandidateArenaResearchAllocationService({
      store,
      now: () => trigger.triggered_at
    }).allocate({
      tickId: "trigger-recovery-tick",
      allocationMode: "explicit",
      allocationPolicyBasis: { basis_kind: "explicit_request" },
      explicitDirections: ["trend_following"],
      findingClusters: [],
      latestTicks: [],
      trigger
    });
    const contexts: string[] = [];

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "trigger-recovery-tick",
      now: () => "2026-07-22T12:00:00.000Z",
      researchAllocationMode: "static_control",
      researchAgent: "codex",
      researchAgentDescriptor: capturingResearchAgentDescriptor(),
      agentFactory: () => new CapturingResearchAgent(
        contexts,
        undefined,
        capturingResearchAgentDescriptor()
      ),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(1);
    await expect(store.getCandidateArenaResearchAllocation(
      frozen.candidate_arena_research_allocation_id
    )).resolves.toEqual(frozen);
    expect(JSON.parse(contexts[0] ?? "{}") as Record<string, unknown>)
      .toMatchObject({
        research_trigger: {
          trigger_kind: trigger.trigger_kind,
          trigger_id: trigger.trigger_id,
          goal: trigger.goal,
          triggered_at: trigger.triggered_at
        }
      });
  });

  it("reuses a triggerless persisted allocation after an upgrade restart", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const frozen = await new CandidateArenaResearchAllocationService({
      store,
      now: () => "2026-07-22T11:00:00.000Z"
    }).allocate({
      tickId: "triggerless-recovery-tick",
      allocationMode: "explicit",
      allocationPolicyBasis: { basis_kind: "explicit_request" },
      explicitDirections: ["trend_following"],
      findingClusters: [],
      latestTicks: []
    });
    const contexts: string[] = [];

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "triggerless-recovery-tick",
      now: () => "2026-07-22T12:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: capturingResearchAgentDescriptor(),
      agentFactory: () => new CapturingResearchAgent(
        contexts,
        undefined,
        capturingResearchAgentDescriptor()
      ),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(1);
    await expect(store.getCandidateArenaResearchAllocation(
      frozen.candidate_arena_research_allocation_id
    )).resolves.toEqual(frozen);
    expect(JSON.parse(contexts[0] ?? "{}") as Record<string, unknown>)
      .not.toHaveProperty("research_trigger");
  });

  it("uses the injected clock for both tick boundaries", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const now = "2035-07-12T10:00:00.000Z";

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "injected-clock-boundaries",
      now: () => now,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.arena.latest_ticks).toContainEqual(expect.objectContaining({
      tick_id: "injected-clock-boundaries",
      started_at: now,
      completed_at: now
    }));
  });

  it("reuses one stable worker workspace and sanitized notebook across new tick commitments", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const captures: LifecycleResearchCapture[] = [];

    await runCandidateArenaTick({
      store,
      tickId: "worker-lifecycle-first",
      now: () => "2026-07-12T10:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: lifecycleResearchAgentDescriptor(),
      agentFactory: () => new LifecycleResearchAgent(captures),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    await runCandidateArenaTick({
      store,
      tickId: "worker-lifecycle-second",
      now: () => "2026-07-12T11:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: lifecycleResearchAgentDescriptor(),
      agentFactory: () => new LifecycleResearchAgent(captures),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    const directions = await store.listResearchDirections();
    const workers = await store.listResearchWorkers();
    const commitments = await store.listResearchPreflightCommitments();
    const checkpoints = await store.listResearchWorkerCheckpoints();
    expect(directions).toHaveLength(1);
    expect(workers).toEqual([expect.objectContaining({
      agent_profile_id: "managed-agent-lifecycle-researcher",
      workspace_key: expect.stringMatching(
        /^candidate-arena-workers\/research-worker-trend-following-/
      ),
      lifecycle_protocol: "research_worker_checkpoint_v1"
    })]);
    expect(commitments).toHaveLength(2);
    expect(new Set(commitments.map((commitment) =>
      commitment.research_worker_ref.id))).toEqual(new Set([
      workers[0]!.research_worker_id
    ]));
    expect(new Set(commitments.map((commitment) =>
      commitment.research_preflight_commitment_id)).size).toBe(2);
    expect(checkpoints).toHaveLength(2);
    const first = checkpoints.find((checkpoint) =>
      checkpoint.candidate_arena_tick_id === "worker-lifecycle-first"
    );
    const second = checkpoints.find((checkpoint) =>
      checkpoint.candidate_arena_tick_id === "worker-lifecycle-second"
    );
    expect(first).toMatchObject({
      terminal_status: "completed",
      terminal_reason: "admission_recorded",
      development_budget: {
        submission_limit: 1,
        recorded_submission_count: 1,
        cumulative_committed_submission_limit: 1,
        cumulative_recorded_submission_count: 1,
        remaining_submission_authority: 0
      }
    });
    expect(second).toMatchObject({
      previous_checkpoint_ref: {
        record_kind: "research_worker_checkpoint",
        id: first?.research_worker_checkpoint_id
      },
      previous_checkpoint_digest: first?.checkpoint_digest,
      terminal_status: "completed",
      terminal_reason: "admission_recorded",
      development_budget: {
        submission_limit: 1,
        recorded_submission_count: 1,
        cumulative_committed_submission_limit: 2,
        cumulative_recorded_submission_count: 2,
        remaining_submission_authority: 0
      },
      notebook: {
        total_entry_count: 2
      }
    });
    expect(captures).toHaveLength(2);
    expect(path.dirname(path.dirname(captures[0]!.input.notebook_path))).toBe(
      path.join(tmpDir, workers[0]!.workspace_key!)
    );
    expect(path.dirname(path.dirname(captures[1]!.input.notebook_path))).toBe(
      path.join(tmpDir, workers[0]!.workspace_key!)
    );
    expect(captures[0]!.notebook.prior_checkpoint).toBeUndefined();
    expect(captures[0]!.notebook.entries).toEqual([]);
    expect(captures[1]!.notebook).toMatchObject({
      prior_checkpoint: {
        research_worker_checkpoint_id: first?.research_worker_checkpoint_id,
        terminal_status: "completed",
        terminal_reason: "admission_recorded",
        notebook: { total_entry_count: 1 }
      },
      entries: []
    });
  });

  it("binds and enforces a memory-masked worker projection before the provider effect", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const captures: LifecycleResearchCapture[] = [];

    await runCandidateArenaTick({
      store,
      tickId: "worker-memory-source",
      now: () => "2026-07-12T10:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: lifecycleResearchAgentDescriptor(),
      agentFactory: () => new LifecycleResearchAgent(captures),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    await runCandidateArenaTick({
      store,
      tickId: "worker-memory-masked",
      now: () => "2026-07-12T11:00:00.000Z",
      directions: ["trend_following"],
      researchMemoryMode: "memory_masked",
      researchAgent: "codex",
      researchAgentDescriptor: lifecycleResearchAgentDescriptor(),
      agentFactory: () => new LifecycleResearchAgent(captures),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(captures).toHaveLength(2);
    expect(captures[1]!.notebook.prior_checkpoint).toBeUndefined();
    const maskedContext = JSON.parse(
      captures[1]!.input.arena_context ?? "{}"
    ) as Record<string, unknown>;
    expect(Object.keys(maskedContext).sort()).toEqual([
      "current_research_allocation",
      "current_research_selection",
      "requested_direction",
      "research_trigger",
      "task"
    ]);
    expect(maskedContext).not.toHaveProperty("research_memory_policy");
    for (const key of [
      "research_population_diversity",
      "leaderboard",
      "negative_findings",
      "latest_findings",
      "latest_research_efficiency",
      "released_campaign_findings",
      "adaptive_direction_focus",
      "finding_clusters",
      "latest_candidate_admission_rejections"
    ]) {
      expect(maskedContext).not.toHaveProperty(key);
    }

    const commitment = (await store.listResearchPreflightCommitments())
      .find((entry) => entry.candidate_arena_tick_id ===
        "worker-memory-masked");
    expect(commitment?.memory_policy).toMatchObject({
      protocol_version: "research_worker_memory_v1",
      memory_mode: "memory_masked",
      available_memory_item_count: expect.any(Number),
      prior_checkpoint: {
        disposition: "masked",
        checkpoint_ref: {
          record_kind: "research_worker_checkpoint"
        }
      }
    });
    expect(commitment!.memory_policy!.available_memory_item_count).toBeGreaterThan(0);
    expect(commitment?.memory_policy?.arena_context_digest).toBe(
      `sha256:${createHash("sha256").update(
        captures[1]!.input.arena_context ?? ""
      ).digest("hex")}`
    );
  });

  it("rotates stable worker identity on model, profile, provider, or direction changes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const captures: LifecycleResearchCapture[] = [];
    const runs: Array<{
      tickId: string;
      direction: "trend_following" | "mean_reversion";
      identity: Partial<ManagedResearchAgent>;
    }> = [
      {
        tickId: "worker-identity-base",
        direction: "trend_following",
        identity: { model: "model-v1" }
      },
      {
        tickId: "worker-identity-model",
        direction: "trend_following",
        identity: { model: "model-v2" }
      },
      {
        tickId: "worker-identity-profile",
        direction: "trend_following",
        identity: { id: "managed-agent-lifecycle-profile-2", model: "model-v2" }
      },
      {
        tickId: "worker-identity-provider",
        direction: "trend_following",
        identity: {
          id: "managed-agent-lifecycle-profile-2",
          provider: "claude_code",
          model: "model-v2"
        }
      },
      {
        tickId: "worker-identity-direction",
        direction: "mean_reversion",
        identity: {
          id: "managed-agent-lifecycle-profile-2",
          provider: "claude_code",
          model: "model-v2"
        }
      }
    ];
    for (const [index, run] of runs.entries()) {
      const agent = new LifecycleResearchAgent(
        captures,
        "edit",
        undefined,
        run.identity
      );
      await runCandidateArenaTick({
        store,
        tickId: run.tickId,
        now: () => `2026-07-12T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
        directions: [run.direction],
        researchAgent: "codex",
        researchAgentDescriptor: agent.agent,
        agentFactory: () => agent,
        artifactRunner: networklessReplayArtifactRunner(),
        replayProviderFactory: networklessReplayTradingApiProvider
      });
    }

    const workers = await store.listResearchWorkers();
    const directions = await store.listResearchDirections();
    const commitments = await store.listResearchPreflightCommitments();
    expect(workers).toHaveLength(5);
    expect(directions).toHaveLength(2);
    expect(commitments).toHaveLength(5);
    expect(new Set(commitments.map((commitment) =>
      commitment.research_worker_ref.id)).size).toBe(5);
    expect(captures).toHaveLength(5);
    expect(captures.every((capture) =>
      capture.notebook.prior_checkpoint === undefined)).toBe(true);
  });

  it("preserves Claude provenance in candidate materialization", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const materializeCandidate = store.materializeCandidate.bind(store);
    let materializedProvider: string | undefined;
    store.materializeCandidate = async (input) => {
      materializedProvider = input.provider.provider_kind;
      return materializeCandidate(input);
    };
    const delegate = new CapturingResearchAgent([]);
    const claudeAgent: TradingResearchAgentAdapter = {
      agent: {
        id: "managed-agent-claude-candidate-arena",
        provider: "claude_code",
        model: "claude-candidate-arena",
        permission_policy: "artifact_workspace_only"
      },
      improveArtifact: (input) => delegate.improveArtifact(input)
    };

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: claudeAgent.agent,
      agentFactory: () => claudeAgent,
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(1);
    expect(materializedProvider).toBe("claude_code");
  });

  it("records generated SystemCode paths as absolute when the store root is relative", async () => {
    const repoRoot = process.cwd();
    const previousCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const store = new LocalStore(path.join(".ouroboros", "dev-store"));
      await store.initialize();
      const outcome = await runCandidateArenaTick({
        store,
        directions: ["trend_following"],
        researchAgent: "codex",
        agentFactory: () => new CapturingResearchAgent([]),
        artifactRunner: networklessReplayArtifactRunner(),
        replayProviderFactory: networklessReplayTradingApiProvider,
        repoRoot
      });
      const candidate = await store.getCandidate(outcome.created_candidate_ids[0]!);
      const systemCodeId = candidate?.system_code?.ref?.id;
      if (!systemCodeId) {
        throw new Error("arena-generated candidate missing SystemCode ref");
      }
      const systemCode = await store.getSystemCode(systemCodeId);
      if (!systemCode || systemCode.artifact_kind !== "python_file") {
        throw new Error("arena-generated SystemCode missing");
      }

      expect(path.isAbsolute(systemCode.artifact_path)).toBe(true);
      expect(path.isAbsolute(systemCode.entrypoint[1]!)).toBe(true);
      expect(systemCode.entrypoint).toEqual(["python3", systemCode.artifact_path]);
      expect(systemCode.artifact_path).toContain(path.join(
        tmpDir,
        ".ouroboros",
        "dev-store",
        "candidate-arena-runs"
      ));
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("preserves directional decisions in post-activation generated SystemCode", async () => {
    const sourceByDirection = new Map<string, string>();
    for (const direction of [
      "trend_following",
      "mean_reversion",
      "funding_aware_risk"
    ] as const) {
      const store = new LocalStore(path.join(tmpDir, direction));
      await store.initialize();
      const outcome = await runCandidateArenaTick({
        store,
        tickId: `post-activation-${direction}`,
        directions: [direction],
        researchAgent: "fixture",
        agentFactory: () => new CapturingResearchAgent([]),
        artifactRunner: networklessReplayArtifactRunner(),
        replayProviderFactory: networklessReplayTradingApiProvider
      });
      const result = outcome.arena.latest_ticks.find((entry) =>
        entry.tick_id === outcome.tick_id)?.direction_results[0];
      if (!result || result.status !== "created" || !result.candidate_id) {
        throw new Error(`directional candidate missing: ${JSON.stringify(result)}`);
      }
      const candidate = await store.getCandidate(result.candidate_id);
      const systemCodeId = candidate?.system_code?.ref?.id;
      const systemCode = systemCodeId
        ? await store.getSystemCode(systemCodeId)
        : undefined;
      if (!systemCode || systemCode.artifact_kind !== "python_file") {
        throw new Error(`directional SystemCode missing: ${result.direction_kind}`);
      }
      const researchDirection = (await store.listResearchDirections()).find((entry) =>
        entry.direction_kind === direction
      );
      const worker = (await store.listResearchWorkers()).find((entry) =>
        entry.research_direction_ref.id === researchDirection?.research_direction_id
      );
      if (!worker) throw new Error(`directional ResearchWorker missing: ${direction}`);
      const notebook = JSON.parse(await readFile(researchWorkerNotebookPath(
        store,
        worker,
        outcome.tick_id
      ), "utf8")) as {
        session_protocol_version?: string;
        session_status?: string;
        selected_development_submission?: number;
        entries?: Array<{ selected_for_sealed_submission?: boolean }>;
      };
      expect(notebook).toMatchObject({
        session_protocol_version: "research_worker_autonomous_session_v1",
        session_status: "selected",
        selected_development_submission: 1
      });
      expect(notebook.entries?.[0]?.selected_for_sealed_submission).toBe(true);
      sourceByDirection.set(
        direction,
        await readFile(systemCode.artifact_path, "utf8")
      );
    }

    const trend = sourceByDirection.get("trend_following") ?? "";
    const meanReversion = sourceByDirection.get("mean_reversion") ?? "";
    const fundingAware = sourceByDirection.get("funding_aware_risk") ?? "";
    for (const source of sourceByDirection.values()) {
      expect(source).toContain("comparison_tick_delivery_ref");
      expect(source).toContain("paper_decision_from_market");
      expect(source).toContain("last_delivery_id = acknowledge_comparison_tick");
    }
    expect(trend).toMatch(
      /"side": "buy",[\s\S]+fast average is above slow average with bounded account risk/
    );
    expect(meanReversion).toMatch(
      /"side": "sell",[\s\S]+mean reversion candidate shorts the long trend replay with bounded risk/
    );
    expect(fundingAware).toContain("if True:");
    expect(fundingAware).toContain(
      "funding-aware candidate holds until net carry clears cost"
    );
  });

  it("binds selected snapshot bytes, sealed Evaluation, and candidate lineage to the explicit sequence", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const agent = new AutonomousSessionResearchAgent("select-second");

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "explicit-selected-snapshot-lineage",
      researchAllocationMode: "static_control",
      researchAgent: "codex",
      agentFactory: () => agent,
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(agent.runSessionCount).toBe(3);
    expect(
      outcome.created_candidate_count,
      JSON.stringify(outcome.arena.latest_ticks[0]?.direction_results)
    ).toBe(1);
    const trendResult = outcome.arena.latest_ticks[0]?.direction_results.find((result) =>
      result.direction_kind === "trend_following"
    );
    const candidate = trendResult?.candidate_id
      ? await store.getCandidate(trendResult.candidate_id)
      : undefined;
    const systemCodeId = candidate?.system_code?.ref?.id;
    const systemCode = systemCodeId ? await store.getSystemCode(systemCodeId) : undefined;
    if (!systemCode || systemCode.artifact_kind !== "python_file") {
      throw new Error("selected session SystemCode missing");
    }
    expect(await readFile(systemCode.artifact_path, "utf8")).toContain(
      "RISK_FRACTION = 0.005"
    );
    const [terminalEvaluation] = (await store.listTradingEvaluationResults())
      .filter((entry) => entry.evaluation_phase === "sealed_admission");
    expect(terminalEvaluation).toMatchObject({
      submitted_system_code_ref: { id: systemCode.system_code_id },
      submitted_artifact_digest: systemCode.artifact_digest,
      selected_development_submission_sequence: 2
    });
    expect(candidate?.full_cycle_lineage?.evidence?.evaluation_score).toBe(
      terminalEvaluation?.score_summary.total_score
    );
    const trendDirection = (await store.listResearchDirections()).find((entry) =>
      entry.direction_kind === "trend_following"
    );
    const trendWorker = (await store.listResearchWorkers()).find((entry) =>
      entry.research_direction_ref.id === trendDirection?.research_direction_id
    );
    const checkpoint = (await store.listResearchWorkerCheckpoints()).find((entry) =>
      entry.research_worker_ref.id === trendWorker?.research_worker_id
    );
    if (!checkpoint) {
      throw new Error("selected trend ResearchWorker checkpoint missing");
    }
    const notebook = JSON.parse(await readFile(path.join(
      tmpDir,
      checkpoint.workspace_key,
      "notebooks",
      `${outcome.tick_id}.json`
    ), "utf8")) as {
      selected_development_submission?: number;
      entries: Array<{ iteration: number; selected_for_sealed_submission?: boolean }>;
    };
    expect(notebook.selected_development_submission).toBe(2);
    expect(notebook.entries.map((entry) => ({
      iteration: entry.iteration,
      selected: entry.selected_for_sealed_submission
    }))).toEqual([
      { iteration: 1, selected: false },
      { iteration: 2, selected: true }
    ]);
  });

  it("closes an explicit no-selection outcome without SystemCode submission or admission", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const agent = new AutonomousSessionResearchAgent("finish-unselected");
    const now = "2026-07-12T10:00:00.000Z";

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "explicit-finish-without-selection",
      now: () => now,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => agent,
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(agent.runSessionCount).toBe(1);
    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        status: "no_submission",
        finding: "ResearchWorker finished without selecting a development submission.",
        research_preflight: expect.objectContaining({
          development_submission_count: 1,
          sealed_terminal_status: "not_run",
          reason: "no_development_winner"
        })
      })
    ]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([]);
    await expect(store.listTradingEvaluationResults()).resolves.toEqual([]);
    await expect(store.listResearchFindings()).resolves.toEqual([]);
    const checkpoints = await store.listResearchWorkerCheckpoints();
    expect(checkpoints).toEqual([
      expect.objectContaining({
        terminal_status: "completed",
        terminal_reason: "finished_without_submission",
        closed_at: now,
        development_budget: expect.objectContaining({
          recorded_submission_count: 1,
          remaining_submission_authority: 0
        })
      })
    ]);
    expect(checkpoints[0]?.candidate_admission_decision_ref).toBeUndefined();
  });

  it("continues the stable ResearchWorker after a completed no-submission checkpoint", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const agent = new AutonomousSessionResearchAgent("finish-unselected");
    const run = (tickId: string) => runCandidateArenaTick({
      store,
      tickId,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => agent,
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    const first = await run("no-submission-continuation-one");
    const second = await run("no-submission-continuation-two");

    expect(agent.runSessionCount).toBe(2);
    expect(first.arena.latest_ticks.find((tick) => tick.tick_id === first.tick_id)
      ?.direction_results[0]).toMatchObject({ status: "no_submission" });
    expect(second.arena.latest_ticks.find((tick) => tick.tick_id === second.tick_id)
      ?.direction_results[0]).toMatchObject({ status: "no_submission" });
    const checkpoints = await store.listResearchWorkerCheckpoints();
    const firstCheckpoint = checkpoints.find((entry) =>
      entry.candidate_arena_tick_id === first.tick_id
    );
    const secondCheckpoint = checkpoints.find((entry) =>
      entry.candidate_arena_tick_id === second.tick_id
    );
    expect(firstCheckpoint).toMatchObject({
      terminal_status: "completed",
      terminal_reason: "finished_without_submission"
    });
    expect(secondCheckpoint).toMatchObject({
      terminal_status: "completed",
      terminal_reason: "finished_without_submission",
      previous_checkpoint_ref: {
        record_kind: "research_worker_checkpoint",
        id: firstCheckpoint?.research_worker_checkpoint_id
      }
    });
  });

  it("retains completed development evidence when an autonomous session fails later", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const agent = new AutonomousSessionResearchAgent("throw-after-first");

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "autonomous-session-mid-failure",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => agent,
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(agent.runSessionCount).toBe(1);
    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        status: "failed",
        error: "research worker failed after one completed submission",
        research_preflight: expect.objectContaining({
          development_submission_count: 1,
          sealed_terminal_status: "not_run",
          reason: "execution_failed"
        })
      })
    ]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([]);
    await expect(store.listResearchWorkerCheckpoints()).resolves.toEqual([
      expect.objectContaining({
        terminal_status: "failed_closed",
        terminal_reason: "execution_failed",
        development_budget: expect.objectContaining({
          recorded_submission_count: 1,
          remaining_submission_authority: 0
        })
      })
    ]);
  });

  it("rejects arena SystemCode entrypoints that escape the artifact directory", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new EscapingEntrypointResearchAgent(),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.created_candidate_ids).toEqual([]);
    const tick = outcome.arena.latest_ticks.find((entry) => entry.tick_id === outcome.tick_id);
    expect(tick).toEqual(expect.objectContaining({
      status: "failed",
      created_candidate_ids: []
    }));
    expect(tick?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        status: "failed",
        error: "candidate_arena_entrypoint_escapes_artifact_dir"
      })
    ]);
  });

  it("rejects malformed arena manifests without leaking an internal TypeError", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new MissingEditablePathsResearchAgent(),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    const tick = outcome.arena.latest_ticks.find((entry) => entry.tick_id === outcome.tick_id);
    expect(tick?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        status: "failed",
        error: "candidate_arena_research_manifest_invalid"
      })
    ]);
  });

  it("quarantines a failed ResearchWorker before runnable candidate materialization", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new FailedResearchAgent(),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.created_candidate_ids).toEqual([]);
    expect((await store.listCandidates()).filter((candidate) => candidate.status === "materialized"))
      .toHaveLength(0);
    expect(outcome.arena.latest_ticks[0]?.status).toBe("completed");
    expect(outcome.arena.active_researchers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction_kind: "trend_following",
        status: "failed"
      })
    ]));
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        status: "quarantined",
        admission_reason: "research_worker_failed",
        finding: "ResearchWorker failed before artifact execution: diagnostic_worker_failed",
        research_preflight: expect.objectContaining({
          development_submission_count: 1,
          sealed_terminal_status: "not_run",
          reason: "no_development_winner"
        })
      })
    ]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([
      expect.objectContaining({
        status: "quarantined",
        reason: "research_worker_failed",
        runnable_paper_handoff: false
      })
    ]);
    await expect(store.listTradingEvaluationResults()).resolves.toEqual([
      expect.objectContaining({
        result_status: "disqualified",
        evidence_disposition: "quarantined_for_review",
        disqualification_reason: "research_worker_failed"
      })
    ]);
    await expect(store.listResearchFindings()).resolves.toEqual([
      expect.objectContaining({
        finding_kind: "failure_analysis",
        summary: "ResearchWorker failed before artifact execution: diagnostic_worker_failed"
      })
    ]);
    await expect(store.listResearchPreflightCommitments()).resolves.toHaveLength(1);
    expect((await store.listTradingEvaluationResults()).every((evaluation) =>
      evaluation.research_preflight_commitment_ref === undefined
    )).toBe(true);
  });

  it("retains the pre-effect commitment when a ResearchWorker process throws", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new ThrowingResearchAgent(),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        status: "failed",
        error: "research worker process terminated",
        research_preflight: expect.objectContaining({
          development_submission_count: 0,
          sealed_terminal_status: "not_run",
          reason: "execution_failed"
        })
      })
    ]);
    await expect(store.listResearchPreflightCommitments()).resolves.toHaveLength(1);
    await expect(store.listResearchWorkerCheckpoints()).resolves.toEqual([
      expect.objectContaining({
        terminal_status: "failed_closed",
        terminal_reason: "execution_failed",
        development_budget: expect.objectContaining({
          recorded_submission_count: 0,
          remaining_submission_authority: 0
        })
      })
    ]);
    await expect(store.listTradingEvaluationResults()).resolves.toEqual([]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([]);
  });

  it("closes an orphan commitment after restart before the next worker effect", async () => {
    const interrupted = new CheckpointDisabledStore(tmpDir);
    await interrupted.initialize();
    await runCandidateArenaTick({
      store: interrupted,
      tickId: "worker-restart-orphan",
      now: () => "2026-07-12T10:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: lifecycleResearchAgentDescriptor(),
      agentFactory: () => new LifecycleResearchAgent([], "throw"),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    await expect(interrupted.listResearchPreflightCommitments()).resolves.toHaveLength(1);
    await expect(interrupted.listResearchWorkerCheckpoints()).resolves.toEqual([]);

    const restarted = new LocalStore(tmpDir);
    await restarted.initialize();
    const captures: LifecycleResearchCapture[] = [];
    await runCandidateArenaTick({
      store: restarted,
      tickId: "worker-restart-next",
      now: () => "2026-07-12T11:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: lifecycleResearchAgentDescriptor(),
      agentFactory: () => new LifecycleResearchAgent(
        captures,
        "edit",
        async () => {
          const recovered = (await restarted.listResearchWorkerCheckpoints())
            .find((checkpoint) =>
              checkpoint.candidate_arena_tick_id === "worker-restart-orphan"
            );
          expect(recovered).toMatchObject({
            terminal_status: "failed_closed",
            terminal_reason: "restart_recovery"
          });
        }
      ),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(captures).toHaveLength(1);
    const checkpoints = await restarted.listResearchWorkerCheckpoints();
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints.find((checkpoint) =>
      checkpoint.candidate_arena_tick_id === "worker-restart-orphan"
    )).toMatchObject({
      terminal_status: "failed_closed",
      terminal_reason: "restart_recovery"
    });
  });

  it("starts a fresh autonomous session after restart without adopting the interrupted provider", async () => {
    const interrupted = new CheckpointDisabledStore(tmpDir);
    await interrupted.initialize();
    const interruptedAgent = new AutonomousSessionResearchAgent("throw-after-first");
    await runCandidateArenaTick({
      store: interrupted,
      tickId: "autonomous-restart-interrupted",
      now: () => "2026-07-12T10:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => interruptedAgent,
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    expect(interruptedAgent.runSessionCount).toBe(1);
    await expect(interrupted.listResearchWorkerCheckpoints()).resolves.toEqual([]);

    const restarted = new LocalStore(tmpDir);
    await restarted.initialize();
    const freshAgent = new AutonomousSessionResearchAgent(
      "finish-unselected",
      async () => {
        const recovered = (await restarted.listResearchWorkerCheckpoints()).find((checkpoint) =>
          checkpoint.candidate_arena_tick_id === "autonomous-restart-interrupted"
        );
        expect(recovered).toMatchObject({
          terminal_status: "failed_closed",
          terminal_reason: "restart_recovery",
          development_budget: expect.objectContaining({
            recorded_submission_count: 1,
            remaining_submission_authority: 0
          })
        });
      }
    );
    const next = await runCandidateArenaTick({
      store: restarted,
      tickId: "autonomous-restart-fresh",
      now: () => "2026-07-12T11:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => freshAgent,
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(interruptedAgent.runSessionCount).toBe(1);
    expect(freshAgent.runSessionCount).toBe(1);
    expect(next.created_candidate_count).toBe(0);
    expect(next.arena.latest_ticks.find((tick) => tick.tick_id === next.tick_id)
      ?.direction_results[0]).toMatchObject({
      status: "no_submission",
      finding: "ResearchWorker finished without selecting a development submission."
    });
    expect((await restarted.listResearchWorkerCheckpoints()).find((checkpoint) =>
      checkpoint.candidate_arena_tick_id === "autonomous-restart-fresh"
    )).toMatchObject({
      terminal_status: "completed",
      terminal_reason: "finished_without_submission",
      previous_checkpoint_ref: expect.objectContaining({
        record_kind: "research_worker_checkpoint"
      })
    });
  });

  it("reconstructs terminal admission closure without replaying materialization", async () => {
    const interrupted = new CheckpointDisabledStore(tmpDir);
    await interrupted.initialize();
    await runCandidateArenaTick({
      store: interrupted,
      tickId: "worker-restart-admission",
      now: () => "2026-07-12T10:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: lifecycleResearchAgentDescriptor(),
      agentFactory: () => new LifecycleResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    await expect(interrupted.listCandidateAdmissionDecisions()).resolves.toHaveLength(1);
    await expect(interrupted.listResearchWorkerCheckpoints()).resolves.toEqual([]);

    const restarted = new LocalStore(tmpDir);
    await restarted.initialize();
    let materializationCount = 0;
    const materializeCandidate = restarted.materializeCandidate.bind(restarted);
    restarted.materializeCandidate = async (input) => {
      materializationCount += 1;
      return materializeCandidate(input);
    };
    const recovered = await recoverIncompleteResearchWorkerCheckpoints({
      store: restarted,
      recovered_at: "2026-07-12T11:00:00.000Z"
    });

    expect(materializationCount).toBe(0);
    expect(recovered).toEqual([expect.objectContaining({
      candidate_arena_tick_id: "worker-restart-admission",
      terminal_status: "completed",
      terminal_reason: "admission_recorded",
      candidate_admission_decision_ref: expect.objectContaining({
        record_kind: "candidate_admission_decision"
      })
    })]);
    await expect(restarted.listResearchWorkerCheckpoints()).resolves.toEqual(recovered);
  });

  it("quarantines a crashed candidate run before runnable candidate materialization", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["execution_cost_robustness"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: crashedReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "execution_cost_robustness",
        status: "quarantined",
        admission_reason: "experiment_failed"
      })
    ]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([
      expect.objectContaining({
        experiment_status: "failed",
        status: "quarantined",
        reason: "experiment_failed",
        runnable_paper_handoff: false
      })
    ]);
    await expect(store.listTradingEvaluationResults()).resolves.toEqual([
      expect.objectContaining({
        result_status: "disqualified",
        evidence_disposition: "quarantined_for_review",
        disqualification_reason: "runtime_crash"
      })
    ]);
  });

  it("quarantines evaluator probing as anti-hacking memory without a runnable candidate", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: evaluatorProbingReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.created_candidate_ids).toEqual([]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([
      expect.objectContaining({
        status: "quarantined",
        reason: "evaluation_disqualified",
        runnable_paper_handoff: false
      })
    ]);
    await expect(store.listTradingEvaluationResults()).resolves.toEqual([
      expect.objectContaining({
        result_status: "disqualified",
        disqualification_reason: "data_leakage"
      })
    ]);
    await expect(store.listResearchFindings()).resolves.toEqual([
      expect.objectContaining({
        finding_kind: "anti_hacking_case",
        summary: expect.stringContaining("data_leakage")
      })
    ]);
  });

  it("records unchanged ResearchWorker output as a duplicate without a population slot", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new NoChangeResearchAgent(),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.created_candidate_ids).toEqual([]);
    expect(outcome.arena.latest_ticks[0]?.status).toBe("completed");
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "mean_reversion",
        status: "duplicate",
        admission_reason: "no_candidate_change",
        finding: "ResearchWorker reported no candidate change; duplicate population entry rejected."
      })
    ]);
    const [admission] = await store.listCandidateAdmissionDecisions();
    expect(admission).toEqual(expect.objectContaining({
      status: "duplicate",
      reason: "no_candidate_change",
      runnable_paper_handoff: false
    }));
    expect(admission).not.toHaveProperty("behavior_comparison_status");
    expect(admission).not.toHaveProperty("research_behavior_fingerprint_ref");
    await expect(store.listResearchBehaviorFingerprints()).resolves.toEqual([]);
    await expect(store.listResearchFindings()).resolves.toEqual([
      expect.objectContaining({
        finding_kind: "duplicate_result"
      })
    ]);
  });

  it("rejects unchanged SystemCode even when the ResearchWorker reports an edit", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["volatility_regime"],
      researchAgent: "codex",
      agentFactory: () => new MisreportedEditResearchAgent(),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "volatility_regime",
        status: "duplicate",
        admission_reason: "no_candidate_change"
      })
    ]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([
      expect.objectContaining({
        research_worker_outcome: "unchanged",
        status: "duplicate",
        runnable_paper_handoff: false
      })
    ]);
  });

  it("rejects different artifacts with identical development behavior as one population duplicate", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "behavior-fingerprint-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: invariantBehaviorReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const second = await runCandidateArenaTick({
      store,
      tickId: "behavior-fingerprint-tick-2",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: invariantBehaviorReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(first.created_candidate_count).toBe(1);
    expect(second.created_candidate_count).toBe(0);
    expect(second.arena.leaderboard).toHaveLength(1);
    expect(second.arena.latest_ticks.find((tick) =>
      tick.tick_id === second.tick_id
    )?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "mean_reversion",
        status: "duplicate",
        admission_reason: "behavior_duplicate",
        finding: "ResearchWorker produced behavior already admitted under the exact development protocol; duplicate population entry rejected."
      })
    ]);
    const expectedPopulationDiversity = {
      protocol_version: "research_population_diversity_v1",
      window_tick_count: 2,
      assigned_directions: {
        measurement_status: "measured",
        sample_count: 2,
        unique_count: 2,
        entropy_bits: 1,
        normalized_entropy: 1
      },
      observed_behaviors: {
        measurement_status: "measured",
        sample_count: 2,
        unique_count: 1,
        entropy_bits: 0,
        normalized_entropy: 0,
        cohort_count: 1,
        admitted_submission_count: 1,
        exact_behavior_duplicate_count: 1,
        artifact_duplicate_count: 0,
        unavailable_fingerprint_count: 0
      },
      by_direction: [
        {
          direction_kind: "trend_following",
          attempt_count: 1,
          observed_behavior_count: 1,
          unique_behavior_count: 1,
          admitted_submission_count: 1,
          exact_behavior_duplicate_count: 0
        },
        {
          direction_kind: "mean_reversion",
          attempt_count: 1,
          observed_behavior_count: 1,
          unique_behavior_count: 1,
          admitted_submission_count: 0,
          exact_behavior_duplicate_count: 1
        }
      ],
      tick_series: [
        {
          tick_id: "behavior-fingerprint-tick-2",
          completed_at: expect.any(String),
          assigned_directions: {
            measurement_status: "insufficient_evidence",
            sample_count: 1,
            unique_count: 1,
            entropy_bits: 0,
            normalized_entropy: 0
          },
          observed_behaviors: {
            measurement_status: "insufficient_evidence",
            sample_count: 1,
            unique_count: 1,
            entropy_bits: 0,
            normalized_entropy: 0,
            cohort_count: 1,
            admitted_submission_count: 0,
            exact_behavior_duplicate_count: 1,
            artifact_duplicate_count: 0,
            unavailable_fingerprint_count: 0
          },
          evaluation_authority: false,
          promotion_authority: false,
          authority_status: "not_promotion_authority"
        },
        {
          tick_id: "behavior-fingerprint-tick-1",
          completed_at: expect.any(String),
          assigned_directions: {
            measurement_status: "insufficient_evidence",
            sample_count: 1,
            unique_count: 1,
            entropy_bits: 0,
            normalized_entropy: 0
          },
          observed_behaviors: {
            measurement_status: "insufficient_evidence",
            sample_count: 1,
            unique_count: 1,
            entropy_bits: 0,
            normalized_entropy: 0,
            cohort_count: 1,
            admitted_submission_count: 1,
            exact_behavior_duplicate_count: 0,
            artifact_duplicate_count: 0,
            unavailable_fingerprint_count: 0
          },
          evaluation_authority: false,
          promotion_authority: false,
          authority_status: "not_promotion_authority"
        }
      ],
      evaluation_authority: false,
      promotion_authority: false,
      authority_status: "not_promotion_authority"
    };
    expect(second.arena.research_population_diversity).toEqual(
      expectedPopulationDiversity
    );

    const fingerprints = await store.listResearchBehaviorFingerprints();
    expect(fingerprints).toHaveLength(2);
    expect(new Set(fingerprints.map((fingerprint) =>
      fingerprint.system_code_artifact_digest
    )).size).toBe(2);
    expect(new Set(fingerprints.map((fingerprint) =>
      fingerprint.fingerprint_digest
    )).size).toBe(1);

    const admissions = await store.listCandidateAdmissionDecisions();
    const admitted = admissions.find((admission) => admission.status === "admitted");
    const duplicate = admissions.find((admission) =>
      admission.reason === "behavior_duplicate"
    );
    expect(admitted).toEqual(expect.objectContaining({
      behavior_comparison_status: "distinct",
      research_behavior_fingerprint_ref: expect.any(Object)
    }));
    expect(duplicate).toEqual(expect.objectContaining({
      status: "duplicate",
      behavior_comparison_status: "duplicate",
      matching_research_behavior_fingerprint_ref:
        admitted?.research_behavior_fingerprint_ref
    }));
    await expect(store.listResearchFindings()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        finding_kind: "duplicate_result",
        summary: expect.stringContaining("exact development protocol")
      })
    ]));
    expect((await store.listArtifactLineages()).some((lineage) =>
      lineage.child_system_code_ref.id === duplicate?.system_code_ref.id
    )).toBe(true);
    expect((await store.listCandidates()).filter((candidate) =>
      candidate.status === "materialized"
    )).toHaveLength(1);

    const capturedContexts: string[] = [];
    await runCandidateArenaTick({
      store,
      tickId: "behavior-fingerprint-tick-3",
      directions: ["volatility_regime"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const nextContext = JSON.parse(capturedContexts[0]!) as {
      research_population_diversity: unknown;
      latest_candidate_admission_rejections: Array<{
        tick_id: string;
        admission_reason?: string;
        finding?: string;
      }>;
    };
    const expectedWorkerPopulationDiversity = {
      ...expectedPopulationDiversity,
      tick_series: expectedPopulationDiversity.tick_series.map((entry) => ({
        ...entry
      }))
    };
    delete (expectedWorkerPopulationDiversity as { authority_status?: unknown })
      .authority_status;
    for (const tick of expectedWorkerPopulationDiversity.tick_series) {
      delete (tick as { authority_status?: unknown }).authority_status;
    }
    expect(nextContext.research_population_diversity).toEqual(
      expectedWorkerPopulationDiversity
    );
    expect(nextContext.latest_candidate_admission_rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tick_id: "behavior-fingerprint-tick-2",
          admission_reason: "behavior_duplicate",
          finding: expect.stringContaining("exact development protocol")
        })
      ])
    );
    expect(capturedContexts[0]).not.toMatch(
      /research_behavior_fingerprint|fingerprint_digest|development_suite_digest/
    );
  });

  it("quarantines an otherwise accepted candidate when behavior observations are unavailable", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "behavior-fingerprint-unavailable-tick",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: fingerprintUnavailableReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        status: "quarantined",
        admission_reason: "behavior_fingerprint_unavailable",
        finding: "Candidate behavior fingerprint was unavailable; admission quarantined before population materialization."
      })
    ]);
    await expect(store.listResearchBehaviorFingerprints()).resolves.toEqual([]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([
      expect.objectContaining({
        evaluation_status: "accepted",
        paper_handoff_conformance_status: "passed",
        behavior_comparison_status: "unavailable",
        status: "quarantined",
        reason: "behavior_fingerprint_unavailable",
        runnable_paper_handoff: false
      })
    ]);
    expect((await store.listCandidates()).filter((candidate) =>
      candidate.status === "materialized"
    )).toHaveLength(0);
  });

  it("feeds rejected research into the next generation without rewarding rejection efficiency", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await runCandidateArenaTick({
      store,
      tickId: "rejected-learning-tick-1",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new NoChangeResearchAgent(),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    const capturedContexts: string[] = [];
    const second = await runCandidateArenaTick({
      store,
      tickId: "rejected-learning-tick-2",
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick?.direction_results.map((entry) => entry.direction_kind)).toEqual([
      "trend_following",
      "volatility_regime",
      "funding_aware_risk"
    ]);
    expect(capturedContexts).toHaveLength(3);
    const context = JSON.parse(capturedContexts[0]!) as {
      latest_research_efficiency: Array<{
        tick_id: string;
        direction_kind: string;
        status: string;
        admission_reason?: string;
      }>;
      latest_candidate_admission_rejections: Array<{
        tick_id: string;
        direction_kind: string;
        status: string;
        admission_reason?: string;
        finding?: string;
      }>;
      adaptive_direction_focus: Array<{
        direction_kind: string;
        focus_reason: string;
      }>;
    };
    expect(context.latest_research_efficiency).toEqual([
      expect.objectContaining({
        tick_id: "rejected-learning-tick-1",
        direction_kind: "mean_reversion",
        status: "duplicate",
        admission_reason: "no_candidate_change"
      })
    ]);
    expect(context.latest_candidate_admission_rejections).toEqual([
      expect.objectContaining({
        tick_id: "rejected-learning-tick-1",
        direction_kind: "mean_reversion",
        status: "duplicate",
        admission_reason: "no_candidate_change",
        finding: "ResearchWorker reported no candidate change; duplicate population entry rejected."
      })
    ]);
    expect(context.adaptive_direction_focus).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction_kind: "mean_reversion",
        focus_reason: "research_efficiency_budget:low_cost_latency"
      })
    ]));
  });

  it("admits a changed loss-making candidate after recording its negative research evidence", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const writeOrder: string[] = [];
    const recordDirection = store.recordResearchDirection.bind(store);
    store.recordResearchDirection = async (record) => {
      writeOrder.push(`research_direction:${record.research_direction_id}`);
      return recordDirection(record);
    };
    const recordWorker = store.recordResearchWorker.bind(store);
    store.recordResearchWorker = async (record) => {
      writeOrder.push(`research_worker:${record.research_worker_id}`);
      return recordWorker(record);
    };
    const recordSystemCode = store.recordSystemCode.bind(store);
    store.recordSystemCode = async (record) => {
      writeOrder.push(`${record.system_code_id.startsWith("system-code-arena-source-")
        ? "source_system_code"
        : "submitted_system_code"}:${record.system_code_id}`);
      return recordSystemCode(record);
    };
    const recordCommitment = store.recordResearchPreflightCommitment.bind(store);
    store.recordResearchPreflightCommitment = async (record) => {
      writeOrder.push(`preflight_commitment:${record.research_preflight_commitment_id}`);
      return recordCommitment(record);
    };
    const recordExperimentRun = store.recordExperimentRun.bind(store);
    store.recordExperimentRun = async (record) => {
      writeOrder.push(`experiment_run:${record.experiment_run_id}`);
      return recordExperimentRun(record);
    };
    const recordConformance = store.recordPaperTradingHandoffConformance.bind(store);
    store.recordPaperTradingHandoffConformance = async (record) => {
      writeOrder.push(`paper_handoff:${record.paper_trading_handoff_conformance_id}`);
      return recordConformance(record);
    };
    const recordEvaluation = store.recordTradingEvaluationResult.bind(store);
    store.recordTradingEvaluationResult = async (record) => {
      writeOrder.push(`evaluation:${record.trading_evaluation_result_id}`);
      return recordEvaluation(record);
    };
    const recordFinding = store.recordResearchFinding.bind(store);
    store.recordResearchFinding = async (record) => {
      writeOrder.push(`finding:${record.research_finding_id}`);
      return recordFinding(record);
    };
    const recordLineage = store.recordArtifactLineage.bind(store);
    store.recordArtifactLineage = async (record) => {
      writeOrder.push(`lineage:${record.artifact_lineage_id}`);
      return recordLineage(record);
    };
    const recordAdmission = store.recordCandidateAdmissionDecision.bind(store);
    store.recordCandidateAdmissionDecision = async (record) => {
      writeOrder.push(`admission:${record.candidate_admission_decision_id}`);
      return recordAdmission(record);
    };
    const materializeCandidate = store.materializeCandidate.bind(store);
    store.materializeCandidate = async (input) => {
      writeOrder.push("materialize");
      await expect(store.listPaperTradingHandoffConformances()).resolves.toEqual([
        expect.objectContaining({
          version: 2,
          status: "passed",
          reason: "passed",
          runnable_paper_handoff: true,
          candidate_egress_attestation: expect.objectContaining({
            execution_ref: expect.objectContaining({
              record_kind: "experiment_run"
            }),
            system_code_ref: expect.objectContaining({
              record_kind: "system_code"
            }),
            enforcement_result: "enforced"
          })
        })
      ]);
      await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([
        expect.objectContaining({
          status: "admitted",
          reason: "evaluation_accepted",
          runnable_paper_handoff: true,
          paper_handoff_conformance_status: "passed",
          paper_trading_handoff_conformance_ref: expect.objectContaining({
            record_kind: "paper_trading_handoff_conformance"
          }),
          paper_trading_handoff_conformance_digest: expect.stringMatching(/^sha256:/)
        })
      ]);
      return materializeCandidate(input);
    };

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([], async () => {
        writeOrder.push("agent_effect");
        await expect(store.listResearchPreflightCommitments()).resolves.toHaveLength(1);
      }),
      artifactRunner: attestedNegativeReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(1);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        status: "created",
        candidate_id: outcome.created_candidate_ids[0],
        admission_decision_id: expect.any(String),
        admission_reason: "evaluation_accepted",
        paper_handoff_conformance: expect.objectContaining({
          status: "passed",
          reason: "passed",
          authority_status: "research_only",
          candidate_egress_attestation: expect.objectContaining({
            verification_status: "verified",
            enforcement_result: "enforced",
            network_policy_digest: expect.stringMatching(/^sha256:/),
            authority_status: "research_only"
          })
        }),
        research_preflight: {
          commitment_id: expect.any(String),
          development_submission_count: 1,
          sealed_terminal_status: "accepted",
          reason: "accepted",
          authority_status: "not_promotion_authority"
        },
        research_efficiency: expect.objectContaining({
          development: expect.objectContaining({
            submission_count: 1,
            provider_request_total: 6,
            scenario_count: 2
          }),
          sealed_admission: expect.objectContaining({
            submission_count: 1,
            provider_request_total: 21,
            scenario_count: 6
          })
        })
      })
    ]);
    const compactPreflight = outcome.arena.latest_ticks[0]
      ?.direction_results[0]?.research_preflight;
    expect(Object.keys(compactPreflight ?? {}).sort()).toEqual([
      "authority_status",
      "commitment_id",
      "development_submission_count",
      "reason",
      "sealed_terminal_status"
    ]);
    expect(JSON.stringify(compactPreflight)).not.toMatch(
      /digest|seed|suite|scenario|score|metric|event|path|command|evaluator/i
    );
    const compactEgress = outcome.arena.latest_ticks[0]
      ?.direction_results[0]?.paper_handoff_conformance
      ?.candidate_egress_attestation;
    expect(Object.keys(compactEgress ?? {}).sort()).toEqual([
      "attestation_id",
      "authority_status",
      "denial_summary",
      "enforcement_result",
      "network_policy_digest",
      "verification_status"
    ]);
    expect(JSON.stringify(compactEgress)).not.toMatch(
      /owned_|inherited_allow|gateway_resource|command|policy_log|credential/i
    );
    const [admission] = await store.listCandidateAdmissionDecisions();
    const sourceSnapshot = admission
      ? await store.getSystemCode(admission.source_system_code_ref.id)
      : undefined;
    expect(sourceSnapshot).toMatchObject({
      artifact_digest: admission?.source_artifact_digest
    });
    if (!sourceSnapshot || sourceSnapshot.artifact_kind !== "python_file") {
      throw new Error("candidate admission source SystemCode snapshot missing");
    }
    expect(sourceSnapshot.artifact_path).toContain("candidate-arena-runs");
    expect(sourceSnapshot.artifact_path).toContain(path.join("seed", "run.py"));
    const candidate = await store.getCandidate(outcome.created_candidate_ids[0]!);
    expect(candidate?.full_cycle_lineage?.source.system_code_ref).toEqual(
      admission?.source_system_code_ref
    );
    const generatedLineage = (await store.listArtifactLineages()).find((lineage) =>
      lineage.child_system_code_ref.id === admission?.system_code_ref.id
    );
    expect(generatedLineage?.parent_system_code_ref).toEqual(
      admission?.source_system_code_ref
    );
    expect(sourceSnapshot.provenance_refs).toEqual([
      expect.objectContaining({ record_kind: "system_code" })
    ]);
    expect(candidate?.full_cycle_lineage?.evidence?.evaluation_status).toBe("accepted");
    const checkpoint = (await store.listResearchWorkerCheckpoints()).find((entry) =>
      entry.candidate_arena_tick_id === outcome.tick_id
    );
    if (!checkpoint) {
      throw new Error("candidate admission ResearchWorker checkpoint missing");
    }
    const netRevenue = candidate?.full_cycle_lineage?.evidence?.profit_loss?.net_revenue_usdt;
    if (netRevenue === undefined) {
      throw new Error("admitted negative candidate missing profit and loss evidence");
    }
    expect(netRevenue).toBeLessThan(0);
    await expect(store.listResearchFindings()).resolves.toEqual([
      expect.objectContaining({
        finding_kind: "negative_result",
        summary: "Candidate remained executable but lost money after costs."
      })
    ]);
    const [commitment] = await store.listResearchPreflightCommitments();
    const [terminalEvaluation] = await store.listTradingEvaluationResults();
    if (!commitment || !admission) {
      throw new Error("sealed admission graph missing");
    }
    expect(commitment).toEqual(expect.objectContaining({
      candidate_arena_tick_id: outcome.tick_id,
      commitment_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/)
    }));
    expect(JSON.stringify(commitment)).not.toContain("evaluator_seed");
    expect(terminalEvaluation).toEqual(expect.objectContaining({
      research_preflight_commitment_ref: {
        record_kind: "research_preflight_commitment",
        id: commitment.research_preflight_commitment_id
      },
      research_preflight_commitment_digest: commitment.commitment_digest,
      submitted_system_code_ref: admission.system_code_ref,
      submitted_artifact_digest: admission.submitted_artifact_digest,
      sealed_admission_suite_digest: commitment.sealed_admission_policy.suite_digest,
      evaluation_phase: "sealed_admission",
      submission_sequence: 1
    }));
    expect(candidate?.full_cycle_lineage?.evidence?.evaluation_score).toBe(
      terminalEvaluation?.score_summary.total_score
    );
    const orderKinds = writeOrder.map((item) => item.split(":")[0]);
    expect(orderKinds.indexOf("research_direction")).toBeLessThan(orderKinds.indexOf("research_worker"));
    expect(orderKinds.indexOf("research_worker")).toBeLessThan(orderKinds.indexOf("source_system_code"));
    expect(orderKinds.indexOf("source_system_code")).toBeLessThan(orderKinds.indexOf("preflight_commitment"));
    expect(orderKinds.indexOf("preflight_commitment")).toBeLessThan(orderKinds.indexOf("agent_effect"));
    expect(orderKinds.indexOf("agent_effect")).toBeLessThan(orderKinds.indexOf("submitted_system_code"));
    expect(orderKinds.indexOf("submitted_system_code")).toBeLessThan(orderKinds.indexOf("experiment_run"));
    expect(orderKinds.indexOf("experiment_run")).toBeLessThan(orderKinds.indexOf("evaluation"));
    expect(orderKinds.indexOf("evaluation")).toBeLessThan(orderKinds.indexOf("paper_handoff"));
    expect(orderKinds.indexOf("paper_handoff")).toBeLessThan(orderKinds.indexOf("finding"));
    expect(orderKinds.indexOf("finding")).toBeLessThan(orderKinds.indexOf("lineage"));
    expect(orderKinds.indexOf("lineage")).toBeLessThan(orderKinds.indexOf("admission"));
    expect(orderKinds.indexOf("admission")).toBeLessThan(orderKinds.indexOf("materialize"));
  });

  it("quarantines replay-passed paper-rejected evidence without materialization", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    let materializationCount = 0;
    const materializeCandidate = store.materializeCandidate.bind(store);
    store.materializeCandidate = async (input) => {
      materializationCount += 1;
      return materializeCandidate(input);
    };

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: paperRejectedReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(materializationCount).toBe(0);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        status: "quarantined",
        admission_reason: "paper_handoff_conformance_failed",
        paper_handoff_conformance: expect.objectContaining({
          status: "rejected",
          reason: "runtime_heartbeat_missing",
          authority_status: "research_only"
        }),
        research_preflight: expect.objectContaining({
          development_submission_count: 1,
          sealed_terminal_status: "rejected",
          reason: "candidate_rejected",
          authority_status: "not_promotion_authority"
        })
      })
    ]);
    await expect(store.listPaperTradingHandoffConformances()).resolves.toEqual([
      expect.objectContaining({
        status: "rejected",
        reason: "runtime_heartbeat_missing",
        runnable_paper_handoff: false
      })
    ]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([
      expect.objectContaining({
        status: "quarantined",
        reason: "paper_handoff_conformance_failed",
        runnable_paper_handoff: false,
        paper_handoff_conformance_status: "rejected"
      })
    ]);
    await expect(store.listResearchFindings()).resolves.toEqual([
      expect.objectContaining({
        finding_kind: "failure_analysis",
        summary: expect.stringContaining("runtime_heartbeat_missing")
      })
    ]);
  });

  it.each([
    [
      "handoff payload smuggling",
      paperHandoffPayloadSmugglingArtifactRunner,
      "provider_protocol_violation"
    ],
    [
      "handoff hidden evaluator output",
      paperHandoffHiddenFieldArtifactRunner,
      "hidden_evaluator_field"
    ]
  ] as const)("quarantines %s as causal anti-hacking memory", async (
    _label,
    artifactRunnerFactory,
    conformanceReason
  ) => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    let materializationCount = 0;
    const materializeCandidate = store.materializeCandidate.bind(store);
    store.materializeCandidate = async (input) => {
      materializationCount += 1;
      return materializeCandidate(input);
    };

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: artifactRunnerFactory(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(materializationCount).toBe(0);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        status: "quarantined",
        admission_reason: "paper_handoff_conformance_failed",
        paper_handoff_conformance: expect.objectContaining({
          status: "rejected",
          reason: conformanceReason
        })
      })
    ]);
    await expect(store.listResearchFindings()).resolves.toEqual([
      expect.objectContaining({
        finding_kind: "anti_hacking_case",
        summary: expect.stringContaining(
          `PaperTradingHandoffConformance (${conformanceReason})`
        )
      })
    ]);
    expect((await store.listCandidates()).filter((candidate) =>
      candidate.status === "materialized"
    )).toEqual([]);
  });

  it("records paper handoff infrastructure failure as a failed direction without strategy evidence", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    let materializationCount = 0;
    const materializeCandidate = store.materializeCandidate.bind(store);
    store.materializeCandidate = async (input) => {
      materializationCount += 1;
      return materializeCandidate(input);
    };

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: paperInfrastructureFailureArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(materializationCount).toBe(0);
    expect(outcome.arena.latest_ticks[0]?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        status: "failed",
        error: "paper handoff test runner unavailable",
        research_preflight: expect.objectContaining({
          development_submission_count: 1,
          sealed_terminal_status: "not_run",
          reason: "execution_failed"
        })
      })
    ]);
    await expect(store.listPaperTradingHandoffConformances()).resolves.toEqual([]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([]);
    await expect(store.listResearchFindings()).resolves.toEqual([]);
    await expect(store.listResearchPreflightCommitments()).resolves.toHaveLength(1);
    expect((await store.listTradingEvaluationResults()).filter((evaluation) =>
      evaluation.research_preflight_commitment_ref !== undefined
    )).toEqual([]);
  });

  it("feeds paper-backed FindingClusters without raw paper observations or account state", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const source = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!source) {
      throw new Error("fixture candidate missing");
    }
    await seedPaperTradingEvidence(store, source);

    const capturedContexts: string[] = [];
    await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(capturedContexts).toHaveLength(1);
    const context = JSON.parse(capturedContexts[0]!) as {
      finding_clusters: Array<{
        direction_kind: string;
        top_blocker?: string;
        blocker_group_kind?: string;
        next_research_focus: string;
      }>;
      adaptive_direction_focus: Array<{
        direction_kind: string;
        focus_reason: string;
        focus_score: number;
        next_research_focus: string;
      }>;
      [key: string]: unknown;
    };
    expect(context).not.toHaveProperty("selected_paper_evidence");
    expect(context).not.toHaveProperty("paper_trading_board");
    expect(context).not.toHaveProperty("latest_tick_failures");
    expect(JSON.stringify(context)).not.toMatch(
      /latest_market_snapshot|latest_public_execution_snapshot|latest_paper_account|latest_open_orders|latest_fill|paper-context-trade-0007|paper context seed preserved selected candidate evidence/
    );
    expect(context.finding_clusters).toEqual([
      expect.objectContaining({
        direction_kind: "other",
        next_research_focus:
          "Preserve the profitable lineage and generate controlled variants under paper evidence."
      })
    ]);
    expect(context.finding_clusters[0]).not.toHaveProperty("top_blocker");
    expect(context.finding_clusters[0]).not.toHaveProperty("blocker_group_kind");
    expect(context.adaptive_direction_focus).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction_kind: "other",
        focus_reason: "paper_finding_cluster",
        focus_score: 10,
        next_research_focus:
          "Preserve the profitable lineage and generate controlled variants under paper evidence."
      })
    ]));
  });

  it("keeps qualification-purpose evidence sealed from every paper research projection", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const capturedContexts: string[] = [];
    const researchTick = await runCandidateArenaTick({
      store,
      tickId: "research-feedback-barrier-tick",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const researchCandidate = await store.getCandidate(researchTick.created_candidate_ids[0]!);
    if (!researchCandidate) {
      throw new Error("research feedback candidate missing");
    }
    await seedPaperTradingEvidence(store, researchCandidate, {
      evaluationId: "released-research-feedback-evaluation"
    });

    const qualificationTick = await runCandidateArenaTick({
      store,
      tickId: "qualification-barrier-tick",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const qualificationCandidate = await store.getCandidate(
      qualificationTick.created_candidate_ids[0]!
    );
    if (!qualificationCandidate) {
      throw new Error("qualification candidate missing");
    }
    const qualificationEvaluationId = "sealed-qualification-evaluation";
    const sealedFailure = "SEALED_QUALIFICATION_FAILURE_MUST_NOT_LEAK";
    const sealedScore = 987_654.321;
    const { evaluation: qualificationEvaluation } = await seedPaperTradingEvidence(
      store,
      qualificationCandidate,
      {
        evaluationId: qualificationEvaluationId,
        evidencePurpose: "qualification",
        status: "failed",
        observationStatus: "failed",
        failureReason: sealedFailure,
        latestScore: {
          revenue_usdt: sealedScore + 1,
          cost_usdt: 1,
          net_revenue_usdt: sealedScore,
          net_return_pct: 98.7654321
        }
      }
    );
    const qualificationCommitment = await store.getPaperTradingEvaluationCommitment(
      qualificationEvaluation.paper_trading_evaluation_commitment_ref!.id
    );
    if (!qualificationCommitment) {
      throw new Error("qualification commitment missing");
    }
    await store.recordLedger({
      idempotency_key: "sealed-qualification-ledger",
      candidate_id: qualificationCandidate.candidate_id,
      candidate_version_id: qualificationCandidate.candidate_version.candidate_version_id,
      runtime_id: qualificationCandidate.runtime.ref.id,
      intent: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit",
        quantity: "0.001",
        limit_price: "65000"
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        decision_reason: "dry_run_allowed"
      },
      execution_result: {
        status: "dry_run_recorded",
        result_reason: "dry_run_allowed",
        completed_at: "2026-05-16T00:31:01.000Z"
      },
      created_at: "2026-05-16T00:31:00.000Z"
    });
    const readObservations = store.listPaperTradingObservations.bind(store);
    const readEvaluationIds: string[] = [];
    store.listPaperTradingObservations = async (evaluationId) => {
      readEvaluationIds.push(evaluationId);
      return readObservations(evaluationId);
    };

    await runCandidateArenaTick({
      store,
      tickId: "post-qualification-barrier-tick",
      directions: ["volatility_regime"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    const context = JSON.parse(capturedContexts.at(-1)!) as {
      finding_clusters: Array<{ candidate_ids: string[] }>;
      adaptive_direction_focus: unknown[];
      released_campaign_findings?: unknown[];
      [key: string]: unknown;
    };
    expect(context).not.toHaveProperty("selected_paper_evidence");
    expect(context).not.toHaveProperty("paper_trading_board");
    expect(context.finding_clusters.flatMap((entry) => entry.candidate_ids))
      .toContain(researchCandidate.candidate_id);
    expect(context.finding_clusters.flatMap((entry) => entry.candidate_ids))
      .not.toContain(qualificationCandidate.candidate_id);

    const paperResearchProjection = JSON.stringify({
      finding_clusters: context.finding_clusters,
      adaptive_direction_focus: context.adaptive_direction_focus,
      released_campaign_findings: context.released_campaign_findings
    });
    expect(paperResearchProjection).not.toContain(qualificationCandidate.candidate_id);
    expect(paperResearchProjection).not.toContain(qualificationEvaluationId);
    expect(paperResearchProjection).not.toContain(sealedFailure);
    expect(paperResearchProjection).not.toContain(String(sealedScore));
    expect(paperResearchProjection).not.toContain(qualificationCommitment.commitment_digest);
    expect(readEvaluationIds).not.toContain(qualificationEvaluationId);
  });

  it("quarantines invalidated research-feedback scores from later ResearchWorkers", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const capturedContexts: string[] = [];
    const first = await runCandidateArenaTick({
      store,
      tickId: "invalidated-research-feedback-source",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const candidate = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!candidate) {
      throw new Error("invalidated research feedback candidate missing");
    }
    const { evaluation } = await seedPaperTradingEvidence(store, candidate, {
      evaluationId: "invalidated-research-feedback-evaluation"
    });
    const invalidationFailure = "INVALIDATED_RESEARCH_FAILURE_MUST_NOT_SCORE";
    await store.recordPaperTradingEvaluation({
      ...evaluation,
      status: "invalidated",
      invalidation_reason: "resolved_artifact_digest_mismatch",
      latest_failure_reason: invalidationFailure,
      next_observation_at: undefined,
      stopped_at: "2026-05-16T00:08:00.000Z"
    });

    await runCandidateArenaTick({
      store,
      tickId: "invalidated-research-feedback-consumer",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    const context = JSON.parse(capturedContexts.at(-1)!) as {
      finding_clusters: Array<{ candidate_ids: string[] }>;
      adaptive_direction_focus: unknown[];
      released_campaign_findings?: unknown[];
      [key: string]: unknown;
    };
    const paperResearchProjection = JSON.stringify({
      finding_clusters: context.finding_clusters,
      adaptive_direction_focus: context.adaptive_direction_focus,
      released_campaign_findings: context.released_campaign_findings
    });
    expect(context).not.toHaveProperty("selected_paper_evidence");
    expect(context).not.toHaveProperty("paper_trading_board");
    expect(context.finding_clusters.flatMap((entry) => entry.candidate_ids))
      .not.toContain(candidate.candidate_id);
    expect(paperResearchProjection).not.toContain(invalidationFailure);
  });

  it("does not feed account-unreconciled research scores into later ResearchWorkers", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const source = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!source) {
      throw new Error("fixture candidate missing");
    }
    await seedPaperTradingEvidence(store, source, {
      evaluationId: "research-feedback-account-mismatch"
    });
    const readEvaluation = store.getLatestPaperTradingEvaluationForCandidate.bind(store);
    const listEvaluations = store.listPaperTradingEvaluations.bind(store);
    const tamperedNetRevenue = 876_543.21;
    store.getLatestPaperTradingEvaluationForCandidate = async (candidateId) => {
      const evaluation = await readEvaluation(candidateId);
      return evaluation
        ? {
            ...evaluation,
            latest_score: {
              revenue_usdt: tamperedNetRevenue + 1,
              cost_usdt: 1,
              net_revenue_usdt: tamperedNetRevenue,
              net_return_pct: 8_765.4321
            }
          }
        : undefined;
    };
    store.listPaperTradingEvaluations = async () => (await listEvaluations()).map((evaluation) =>
      evaluation.paper_trading_evaluation_id === "research-feedback-account-mismatch"
        ? {
            ...evaluation,
            latest_score: {
              revenue_usdt: tamperedNetRevenue + 1,
              cost_usdt: 1,
              net_revenue_usdt: tamperedNetRevenue,
              net_return_pct: 8_765.4321
            }
          }
        : evaluation
    );

    const capturedContexts: string[] = [];
    const outcome = await runCandidateArenaTick({
      store,
      tickId: "account-mismatch-barrier-tick",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    const context = JSON.parse(capturedContexts[0]!) as {
      finding_clusters: unknown[];
      adaptive_direction_focus: unknown[];
      released_campaign_findings?: unknown[];
      [key: string]: unknown;
    };
    const paperResearchProjection = JSON.stringify({
      finding_clusters: context.finding_clusters,
      adaptive_direction_focus: context.adaptive_direction_focus,
      released_campaign_findings: context.released_campaign_findings
    });
    const tick = outcome.arena.latest_ticks.find((entry) => entry.tick_id === outcome.tick_id);
    expect(tick?.source_candidate?.source_kind).not.toBe("paper_trading_evaluation_leader");
    expect(tick?.source_candidate?.net_revenue_usdt).not.toBe(tamperedNetRevenue);
    expect(context).not.toHaveProperty("selected_paper_evidence");
    expect(context).not.toHaveProperty("paper_trading_board");
    expect(paperResearchProjection).not.toContain(String(tamperedNetRevenue));
    expect(paperResearchProjection).not.toContain("research-feedback-account-mismatch");
  });

  it("keeps paper observation cadence telemetry outside the ResearchWorker context", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const source = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!source) {
      throw new Error("fixture candidate missing");
    }
    await seedPaperTradingCadenceEvidence(store, source);

    const capturedContexts: string[] = [];
    await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(capturedContexts).toHaveLength(1);
    const context = JSON.parse(capturedContexts[0]!) as Record<string, unknown>;
    expect(context).not.toHaveProperty("selected_paper_evidence");
    expect(context).not.toHaveProperty("paper_trading_board");
    expect(JSON.stringify(context)).not.toMatch(
      /paper_loop_latency|latest_observation_interval_ms|latest_interval_lag_ms|max_interval_lag_ms/
    );
  });

  it("feeds paper candidate lineage and findings into the next researcher context", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const capturedContexts: string[] = [];
    const first = await runCandidateArenaTick({
      store,
      tickId: "lineage-feedback-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const createdCandidate = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!createdCandidate) {
      throw new Error("lineage feedback candidate missing");
    }
    await seedPaperTradingEvidence(store, createdCandidate);

    await runCandidateArenaTick({
      store,
      tickId: "lineage-feedback-tick-2",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(capturedContexts).toHaveLength(2);
    const context = JSON.parse(capturedContexts[1]!) as {
      finding_clusters: Array<{
        direction_kind: string;
        candidate_ids: string[];
        latest_finding?: string;
        next_research_focus: string;
      }>;
      [key: string]: unknown;
    };
    expect(context.finding_clusters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction_kind: "trend_following",
        candidate_ids: [createdCandidate.candidate_id],
        latest_finding: "Candidate produced non-negative net revenue after costs.",
        next_research_focus:
          "Preserve the profitable lineage and generate controlled variants under paper evidence."
      })
    ]));
    expect(context).not.toHaveProperty("selected_paper_evidence");
    expect(JSON.stringify(context)).not.toMatch(
      /parent_candidate_id|paper_board_learning|paper_score|paper_account/
    );
  });

  it("uses the latest evaluated arena leader as the next generation source by default", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "iterative-source-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const firstLeaderId = first.arena.leaderboard[0]?.candidate_id;
    expect(firstLeaderId).toBe(first.created_candidate_ids[0]);

    const second = await runCandidateArenaTick({
      store,
      tickId: "iterative-source-tick-2",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondCandidate = await store.getCandidate(second.created_candidate_ids[0]!);
    const firstTick = first.arena.latest_ticks.find((entry) => entry.tick_id === first.tick_id);
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(firstTick).toMatchObject({
      source_candidate: {
        source_kind: "fixture_seed",
        candidate_id: FIXTURE_CANDIDATE_ID,
        display_name: "Fixture generic trading-system candidate",
        authority_status: "not_live"
      }
    });
    expect(secondTick).toMatchObject({
      source_candidate: {
        source_kind: "evaluated_arena_leader",
        candidate_id: firstLeaderId,
        display_name: "Arena trend following BTCUSDT Trading System",
        net_revenue_usdt: expect.any(Number),
        authority_status: "not_live"
      }
    });
    expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).toBe(firstLeaderId);
    expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).not.toBe(FIXTURE_CANDIDATE_ID);
  });

  it("uses the latest paper trading evaluation leader as the next generation source by default", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "paper-source-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const paperLeader = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!paperLeader) {
      throw new Error("paper source leader missing");
    }
    await seedPaperTradingEvidence(store, paperLeader);

    const second = await runCandidateArenaTick({
      store,
      tickId: "paper-source-tick-2",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondCandidate = await store.getCandidate(second.created_candidate_ids[0]!);
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick).toMatchObject({
      source_candidate: {
        source_kind: "paper_trading_evaluation_leader",
        candidate_id: paperLeader.candidate_id,
        display_name: "Arena trend following BTCUSDT Trading System",
        net_revenue_usdt: 12.34,
        authority_status: "not_live"
      }
    });
    expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).toBe(paperLeader.candidate_id);
    expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).not.toBe(FIXTURE_CANDIDATE_ID);
  });

  it("never selects qualification-purpose paper scores as the next generation source", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const first = await runCandidateArenaTick({
      store,
      tickId: "paper-source-purpose-barrier-1",
      directions: ["trend_following", "mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const researchCandidate = await store.getCandidate(first.created_candidate_ids[0]!);
    const qualificationCandidate = await store.getCandidate(first.created_candidate_ids[1]!);
    if (!researchCandidate || !qualificationCandidate) {
      throw new Error("paper source purpose candidates missing");
    }
    await seedPaperTradingEvidence(store, researchCandidate, {
      evaluationId: "paper-source-released-research",
      latestScore: {
        revenue_usdt: 6,
        cost_usdt: 1,
        net_revenue_usdt: 5,
        net_return_pct: 0.05
      }
    });
    await seedPaperTradingEvidence(store, qualificationCandidate, {
      evaluationId: "paper-source-sealed-qualification",
      evidencePurpose: "qualification",
      latestScore: {
        revenue_usdt: 501,
        cost_usdt: 1,
        net_revenue_usdt: 500,
        net_return_pct: 5
      }
    });

    const second = await runCandidateArenaTick({
      store,
      tickId: "paper-source-purpose-barrier-2",
      directions: ["volatility_regime"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick?.source_candidate).toMatchObject({
      source_kind: "paper_trading_evaluation_leader",
      candidate_id: researchCandidate.candidate_id,
      net_revenue_usdt: 5
    });
    expect(secondTick?.source_candidate?.candidate_id).not.toBe(qualificationCandidate.candidate_id);
  });

  it("ranks only each candidate's latest paper trading evaluation when choosing the next source", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "paper-source-latest-only-tick-1",
      directions: ["trend_following", "mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const staleHighCandidate = await store.getCandidate(first.created_candidate_ids[0]!);
    const currentLeader = await store.getCandidate(first.created_candidate_ids[1]!);
    if (!staleHighCandidate || !currentLeader) {
      throw new Error("paper source candidates missing");
    }

    await seedPaperTradingEvidence(store, staleHighCandidate, {
      evaluationId: "paper-source-stale-high",
      startedAt: "2026-05-15T00:00:00.000Z",
      latestScore: {
        revenue_usdt: 50,
        cost_usdt: 1,
        net_revenue_usdt: 49,
        net_return_pct: 0.49
      }
    });
    await seedPaperTradingEvidence(store, staleHighCandidate, {
      evaluationId: "paper-source-current-low",
      startedAt: "2026-05-16T00:00:00.000Z",
      latestScore: {
        revenue_usdt: 1,
        cost_usdt: 2,
        net_revenue_usdt: -1,
        net_return_pct: -0.01
      }
    });
    await seedPaperTradingEvidence(store, currentLeader, {
      evaluationId: "paper-source-current-leader",
      startedAt: "2026-05-16T00:01:00.000Z",
      latestScore: {
        revenue_usdt: 14,
        cost_usdt: 1,
        net_revenue_usdt: 13,
        net_return_pct: 0.13
      }
    });

    const second = await runCandidateArenaTick({
      store,
      tickId: "paper-source-latest-only-tick-2",
      directions: ["volatility_regime"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick).toMatchObject({
      source_candidate: {
        source_kind: "paper_trading_evaluation_leader",
        candidate_id: currentLeader.candidate_id,
        net_revenue_usdt: 13,
        authority_status: "not_live"
      }
    });
    expect(secondTick?.source_candidate?.candidate_id).not.toBe(staleHighCandidate.candidate_id);
  });

  it("does not revive a stale paper score when a candidate's latest evaluation is failed", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "paper-source-latest-failed-tick-1",
      directions: ["trend_following", "mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const staleHighCandidate = await store.getCandidate(first.created_candidate_ids[0]!);
    const currentLeader = await store.getCandidate(first.created_candidate_ids[1]!);
    if (!staleHighCandidate || !currentLeader) {
      throw new Error("paper source candidates missing");
    }

    await seedPaperTradingEvidence(store, staleHighCandidate, {
      evaluationId: "paper-source-stale-before-failed",
      startedAt: "2026-05-15T00:00:00.000Z",
      status: "stopped",
      latestScore: {
        revenue_usdt: 50,
        cost_usdt: 1,
        net_revenue_usdt: 49,
        net_return_pct: 0.49
      }
    });
    await seedPaperTradingEvidence(store, staleHighCandidate, {
      evaluationId: "paper-source-latest-failed",
      startedAt: "2026-05-16T00:00:00.000Z",
      status: "failed",
      observationStatus: "failed",
      failureReason: "candidate crashed during paper observation",
      latestScore: {
        revenue_usdt: 0,
        cost_usdt: 0,
        net_revenue_usdt: 0,
        net_return_pct: 0
      }
    });
    await seedPaperTradingEvidence(store, currentLeader, {
      evaluationId: "paper-source-current-after-failed",
      startedAt: "2026-05-16T00:01:00.000Z",
      latestScore: {
        revenue_usdt: 14,
        cost_usdt: 1,
        net_revenue_usdt: 13,
        net_return_pct: 0.13
      }
    });

    const second = await runCandidateArenaTick({
      store,
      tickId: "paper-source-latest-failed-tick-2",
      directions: ["execution_cost_robustness"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick).toMatchObject({
      source_candidate: {
        source_kind: "paper_trading_evaluation_leader",
        candidate_id: currentLeader.candidate_id,
        net_revenue_usdt: 13,
        authority_status: "not_live"
      }
    });
    expect(secondTick?.source_candidate?.candidate_id).not.toBe(staleHighCandidate.candidate_id);
  });

  it("does not revive a paper-ineligible candidate through the evaluated arena fallback", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "paper-source-ineligible-fallback-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const paperIneligibleLeader = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!paperIneligibleLeader) {
      throw new Error("paper ineligible source candidate missing");
    }

    await seedPaperTradingEvidence(store, paperIneligibleLeader, {
      evaluationId: "paper-source-stale-before-ineligible",
      startedAt: "2026-05-15T00:00:00.000Z",
      status: "stopped",
      latestScore: {
        revenue_usdt: 50,
        cost_usdt: 1,
        net_revenue_usdt: 49,
        net_return_pct: 0.49
      }
    });
    await seedPaperTradingEvidence(store, paperIneligibleLeader, {
      evaluationId: "paper-source-latest-ineligible",
      startedAt: "2026-05-16T00:00:00.000Z",
      status: "failed",
      observationStatus: "failed",
      failureReason: "candidate crashed during paper observation",
      latestScore: {
        revenue_usdt: 0,
        cost_usdt: 0,
        net_revenue_usdt: 0,
        net_return_pct: 0
      }
    });

    const second = await runCandidateArenaTick({
      store,
      tickId: "paper-source-ineligible-fallback-tick-2",
      directions: ["funding_aware_risk"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick).toMatchObject({
      source_candidate: {
        source_kind: "fixture_seed",
        candidate_id: FIXTURE_CANDIDATE_ID,
        authority_status: "not_live"
      }
    });
    expect(secondTick?.source_candidate?.candidate_id).not.toBe(paperIneligibleLeader.candidate_id);
  });

  it("does not source a stopped paper evaluation that still carries a failure", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "paper-source-stopped-failed-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const stoppedFailedLeader = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!stoppedFailedLeader) {
      throw new Error("stopped failed paper source candidate missing");
    }

    await seedPaperTradingEvidence(store, stoppedFailedLeader, {
      evaluationId: "paper-source-stopped-with-failure",
      startedAt: "2026-05-16T00:00:00.000Z",
      status: "stopped",
      observationStatus: "failed",
      failureReason: "candidate crashed before operator stop",
      latestScore: {
        revenue_usdt: 50,
        cost_usdt: 1,
        net_revenue_usdt: 49,
        net_return_pct: 0.49
      }
    });

    const second = await runCandidateArenaTick({
      store,
      tickId: "paper-source-stopped-failed-tick-2",
      directions: ["execution_cost_robustness"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick).toMatchObject({
      source_candidate: {
        source_kind: "fixture_seed",
        candidate_id: FIXTURE_CANDIDATE_ID,
        authority_status: "not_live"
      }
    });
    expect(secondTick?.source_candidate?.candidate_id).not.toBe(stoppedFailedLeader.candidate_id);
  });

  it("clusters findings for the next ResearchWorker by direction, blocker, market regime, and protocol failure", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const capturedContexts: string[] = [];
    const first = await runCandidateArenaTick({
      store,
      tickId: "finding-cluster-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const createdCandidate = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!createdCandidate) {
      throw new Error("finding cluster candidate missing");
    }
    await seedPaperTradingEvidence(store, createdCandidate, {
      status: "failed",
      observationStatus: "failed",
      failureReason: "malformed TradingSystem paper event protocol: invalid order_request",
      expectedDirection: "long",
      volatility: 0.024
    });

    const second = await runCandidateArenaTick({
      store,
      tickId: "finding-cluster-tick-2",
      directions: ["execution_cost_robustness"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(capturedContexts).toHaveLength(2);
    const context = JSON.parse(capturedContexts[1]!) as {
      finding_clusters: Array<{
        direction_kind: string;
        top_blocker?: string;
        blocker_group_kind?: string;
        market_regime: string;
        protocol_failure_kind?: string;
        candidate_count: number;
        candidate_ids: string[];
        latest_finding?: string;
        next_research_focus: string;
      }>;
      [key: string]: unknown;
    };

    expect(context.finding_clusters).toEqual([
      {
        direction_kind: "trend_following",
        top_blocker: "paper_evaluation_failed",
        blocker_group_kind: "observation_quality",
        market_regime: "long",
        protocol_failure_kind: "trading_system_protocol_error",
        candidate_count: 1,
        candidate_ids: [createdCandidate.candidate_id],
        latest_finding: "Candidate produced non-negative net revenue after costs.",
        next_research_focus: "Inspect the latest paper failure and fix the runtime or protocol issue before review."
      }
    ]);
    expect(context.finding_clusters[0]).not.toHaveProperty("authority_status");
    expect(context).not.toHaveProperty("selected_paper_evidence");
    expect(JSON.stringify(context)).not.toContain(
      "malformed TradingSystem paper event protocol: invalid order_request"
    );
    expect(JSON.stringify(context)).not.toMatch(/failed_observations|latest_paper_failure/);
    expect(second.arena.finding_clusters).toEqual([
      expect.objectContaining({
        ...context.finding_clusters[0],
        authority_status: "not_promotion_authority"
      })
    ]);
  });

  it("prioritizes default research directions from paper failure pressure without promotion authority", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const capturedContexts: string[] = [];
    const first = await runCandidateArenaTick({
      store,
      tickId: "adaptive-direction-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const createdCandidate = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!createdCandidate) {
      throw new Error("adaptive direction candidate missing");
    }
    await seedPaperTradingEvidence(store, createdCandidate, {
      status: "failed",
      observationStatus: "failed",
      failureReason: "public execution evidence stream unavailable for fill-bearing paper observation"
    });

    const second = await runCandidateArenaTick({
      store,
      tickId: "adaptive-direction-tick-2",
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick?.direction_results.map((entry) => entry.direction_kind)).toEqual([
      "execution_cost_robustness",
      "trend_following",
      "mean_reversion"
    ]);

    const secondTickContexts = capturedContexts.slice(-5).map((rawContext) => JSON.parse(rawContext) as {
      requested_direction: string;
      adaptive_direction_focus: Array<{
        direction_kind: string;
        source_direction_kind?: string;
        focus_score: number;
        focus_reason: string;
        next_research_focus: string;
      }>;
    });
    expect(secondTickContexts.reduce<Record<string, number>>((counts, entry) => {
      counts[entry.requested_direction] =
        (counts[entry.requested_direction] ?? 0) + 1;
      return counts;
    }, {})).toEqual({
      execution_cost_robustness: 2,
      trend_following: 2,
      mean_reversion: 1
    });
    expect(secondTick?.research_allocation?.selected_directions).toEqual([
      expect.objectContaining({
        direction_kind: "execution_cost_robustness",
        selection_kind: "focus",
        experiment_budget: 2
      }),
      expect.objectContaining({
        direction_kind: "trend_following",
        selection_kind: "focus",
        experiment_budget: 2
      }),
      expect.objectContaining({
        direction_kind: "mean_reversion",
        selection_kind: "exploration",
        experiment_budget: 1
      })
    ]);
    const context = secondTickContexts.find((entry) => entry.requested_direction === "execution_cost_robustness");
    if (!context) {
      throw new Error("execution cost robustness context missing");
    }
    expect(context.requested_direction).toBe("execution_cost_robustness");
    expect(context.adaptive_direction_focus[0]).toEqual({
      direction_kind: "execution_cost_robustness",
      source_direction_kind: "trend_following",
      focus_score: 37,
      focus_reason: "public_execution_evidence_gap:observation_quality:paper_evaluation_failed",
      next_research_focus: "Restore public execution evidence before trusting fills or paper score."
    });
    expect(context.adaptive_direction_focus[0]).not.toHaveProperty(
      "authority_status"
    );
  });

  it("persists research allocation before effects and bounds default concurrency", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const probe = createAllocationExecutionProbe();

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "allocation-pre-effect-tick",
      researchAgent: "codex",
      agentFactory: () => new AllocationProbeResearchAgent(store, probe),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const tick = outcome.arena.latest_ticks.find((entry) =>
      entry.tick_id === outcome.tick_id
    ) as typeof outcome.arena.latest_ticks[number] & {
      research_allocation?: {
        allocation_id: string;
        allocation_mode: string;
        selected_directions: Array<{
          direction_kind: string;
          selection_kind: string;
          experiment_budget: number;
        }>;
        policy: { concurrency_limit: number };
      };
    };
    const allocations = await store.listCandidateArenaResearchAllocations();

    expect(allocations).toHaveLength(1);
    expect(probe.visibleAllocationIds).toEqual([
      allocations[0]!.candidate_arena_research_allocation_id,
      allocations[0]!.candidate_arena_research_allocation_id,
      allocations[0]!.candidate_arena_research_allocation_id
    ]);
    expect(probe.maximumActive).toBe(2);
    expect([...probe.calls].sort()).toEqual([
      "mean_reversion:1",
      "trend_following:1",
      "volatility_regime:1"
    ]);
    expect(tick.direction_results.map((entry) => entry.direction_kind)).toEqual([
      "trend_following",
      "mean_reversion",
      "volatility_regime"
    ]);
    expect(tick.research_allocation).toMatchObject({
      allocation_id: allocations[0]!
        .candidate_arena_research_allocation_id,
      allocation_mode: "adaptive_default",
      allocation_policy_basis: { basis_kind: "repository_default" },
      policy: { concurrency_limit: 2 },
      selected_directions: [
        {
          direction_kind: "trend_following",
          selection_kind: "exploration",
          experiment_budget: 1
        },
        {
          direction_kind: "mean_reversion",
          selection_kind: "exploration",
          experiment_budget: 1
        },
        {
          direction_kind: "volatility_regime",
          selection_kind: "exploration",
          experiment_budget: 1
        }
      ]
    });
  });

  it("seals the latest applicable policy approval into an uncontrolled tick", async () => {
    const decision = allocationPolicyDecisionFixture();
    const store = new ResearchAllocationPolicyOverlayStore(
      tmpDir,
      [decision]
    );
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "policy-backed-allocation-tick",
      now: () => "2026-07-12T10:00:00.000Z",
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const allocation = (await store.listCandidateArenaResearchAllocations())
      .find((entry) => entry.tick_id === outcome.tick_id);
    const tick = outcome.arena.latest_ticks.find((entry) =>
      entry.tick_id === outcome.tick_id
    );
    const expectedBasis = {
      basis_kind: "research_allocation_policy_decision",
      policy_decision_ref: {
        record_kind: "research_allocation_policy_decision",
        id: decision.research_allocation_policy_decision_id
      },
      policy_decision_digest: decision.policy_decision_digest,
      study_outcome_ref: { ...decision.study_outcome_ref },
      study_outcome_digest: decision.study_outcome_digest
    };

    expect(allocation?.allocation_policy_basis).toEqual(expectedBasis);
    expect(tick?.research_allocation?.allocation_policy_basis).toEqual(
      expectedBasis
    );
  });

  it("keeps explicit modes and directions ahead of an available approval", async () => {
    const store = new ResearchAllocationPolicyOverlayStore(
      tmpDir,
      [allocationPolicyDecisionFixture()]
    );
    await store.initialize();

    await runCandidateArenaTick({
      store,
      tickId: "policy-explicit-static-tick",
      now: () => "2026-07-12T10:00:00.000Z",
      researchAllocationMode: "static_control",
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    await runCandidateArenaTick({
      store,
      tickId: "policy-explicit-direction-tick",
      now: () => "2026-07-12T11:00:00.000Z",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const allocations = await store.listCandidateArenaResearchAllocations();

    expect(allocations.find((entry) =>
      entry.tick_id === "policy-explicit-static-tick"
    )?.allocation_policy_basis).toEqual({ basis_kind: "explicit_request" });
    expect(allocations.find((entry) =>
      entry.tick_id === "policy-explicit-direction-tick"
    )?.allocation_policy_basis).toEqual({ basis_kind: "explicit_request" });
  });

  it("applies static allocation budgets to iterations and aggregate efficiency", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const contexts: string[] = [];

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "static-allocation-budget-tick",
      researchAllocationMode: "static_control",
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(contexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    } as Parameters<typeof runCandidateArenaTick>[0]);
    const tick = outcome.arena.latest_ticks.find((entry) =>
      entry.tick_id === outcome.tick_id
    ) as typeof outcome.arena.latest_ticks[number] & {
      research_allocation?: { allocation_mode: string };
    };
    const callsByDirection = contexts.reduce<Record<string, number>>(
      (counts, rawContext) => {
        const direction = (JSON.parse(rawContext) as {
          requested_direction: string;
        }).requested_direction;
        counts[direction] = (counts[direction] ?? 0) + 1;
        return counts;
      },
      {}
    );

    expect(callsByDirection).toEqual({
      trend_following: 2,
      mean_reversion: 2,
      volatility_regime: 1
    });
    expect(tick.research_allocation?.allocation_mode).toBe("static_control");
    expect(tick.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        research_efficiency: expect.objectContaining({
          provider_request_total: 12,
          runner_command_total: 0,
          scenario_count: 4
        })
      }),
      expect.objectContaining({
        direction_kind: "mean_reversion",
        research_efficiency: expect.objectContaining({
          provider_request_total: 12,
          runner_command_total: 0,
          scenario_count: 4
        })
      }),
      expect.objectContaining({
        direction_kind: "volatility_regime",
        research_efficiency: expect.objectContaining({
          provider_request_total: 6,
          runner_command_total: 0,
          scenario_count: 2
        })
      })
    ]);
  });

  it("retains failed selected workers under persisted allocation intent", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      tickId: "failed-allocation-tick",
      researchAgent: "codex",
      agentFactory: () => new FailedResearchAgent(),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const allocation = (await store.listCandidateArenaResearchAllocations())[0];
    const tick = outcome.arena.latest_ticks.find((entry) =>
      entry.tick_id === outcome.tick_id
    ) as typeof outcome.arena.latest_ticks[number] & {
      research_allocation?: { allocation_id: string };
    };

    expect(allocation?.selected_directions).toHaveLength(3);
    expect(tick.direction_results).toHaveLength(3);
    expect(tick.direction_results.every((entry) =>
      entry.status === "quarantined" || entry.status === "failed"
    )).toBe(true);
    expect(tick.research_allocation?.allocation_id).toBe(
      allocation?.candidate_arena_research_allocation_id
    );
  });

  it("replays frozen allocation after restart and rejects request drift", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const first = await new CandidateArenaResearchAllocationService({
      store,
      now: () => "2026-07-12T10:00:00.000Z"
    }).allocate({
      tickId: "restart-allocation-tick",
      allocationMode: "adaptive_default",
      allocationPolicyBasis: { basis_kind: "repository_default" },
      findingClusters: [],
      latestTicks: []
    });

    const restartedStore = new LocalStore(tmpDir);
    await restartedStore.initialize();
    const restartedService = new CandidateArenaResearchAllocationService({
      store: restartedStore,
      now: () => "2026-07-13T10:00:00.000Z"
    });
    const replay = await restartedService.allocate({
      tickId: "restart-allocation-tick",
      allocationMode: "adaptive_default",
      allocationPolicyBasis: { basis_kind: "repository_default" },
      findingClusters: [{
        direction_kind: "trend_following",
        top_blocker: "paper_evaluation_failed",
        blocker_group_kind: "observation_quality",
        market_regime: "unknown",
        protocol_failure_kind: "public_execution_evidence_gap",
        candidate_count: 1,
        candidate_ids: ["new-candidate"],
        next_research_focus: "New evidence would focus execution robustness.",
        authority_status: "not_promotion_authority"
      }],
      latestTicks: []
    });

    expect(replay).toEqual(first);
    expect(toCandidateArenaResearchAllocationReadModel(replay)).toEqual(
      toCandidateArenaResearchAllocationReadModel(first)
    );
    await expect(restartedStore.listCandidateArenaResearchAllocations())
      .resolves.toEqual([first]);
    await expect(readdir(path.join(
      tmpDir,
      "candidate-arena-research-allocations",
      "items"
    ))).resolves.toHaveLength(1);
    await expect(restartedService.allocate({
      tickId: "restart-allocation-tick",
      allocationMode: "static_control",
      allocationPolicyBasis: { basis_kind: "explicit_request" },
      findingClusters: [],
      latestTicks: []
    })).rejects.toMatchObject({
      code: "candidate_arena_research_allocation_request_conflict"
    });
    await expect(restartedService.allocate({
      tickId: "restart-allocation-tick",
      allocationMode: "static_control",
      allocationPolicyBasis: { basis_kind: "explicit_request" },
      findingClusters: [],
      latestTicks: []
    })).rejects.toThrowError(CandidateArenaResearchAllocationServiceError);
  });

  it("uses only released campaign findings for context and direction ablation", async () => {
    const store = new ResearchReleaseOverlayStore(tmpDir);
    await store.initialize();
    const source = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!source?.system_code?.ref) {
      throw new Error("release ablation source candidate missing");
    }
    const release = releasedCampaignFindingFixture(source);
    const capturedContexts: string[] = [];

    const unreleased = await runCandidateArenaTick({
      store,
      tickId: "unreleased-campaign-direction-ablation",
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    expect(unreleased.arena.latest_ticks.find((tick) =>
      tick.tick_id === unreleased.tick_id)?.direction_results[0]?.direction_kind
    ).toBe("trend_following");
    const unreleasedContexts = capturedContexts.slice(0, 3).map((value) =>
      JSON.parse(value) as {
        released_campaign_findings?: unknown[];
        finding_clusters: Array<{ candidate_ids: string[] }>;
      });
    expect(unreleasedContexts).toHaveLength(3);
    expect(unreleasedContexts.every((context) =>
      context.released_campaign_findings?.length === 0)).toBe(true);
    expect(unreleasedContexts.flatMap((context) =>
      context.finding_clusters.flatMap((cluster) => cluster.candidate_ids))
    ).not.toContain(FIXTURE_CANDIDATE_ID);

    store.releases = [release, structuredClone(release)];
    const released = await runCandidateArenaTick({
      store,
      tickId: "released-campaign-direction-ablation",
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const releasedTick = released.arena.latest_ticks.find((tick) =>
      tick.tick_id === released.tick_id);
    expect(releasedTick?.direction_results[0]?.direction_kind).toBe("mean_reversion");

    const releasedContexts = capturedContexts.slice(-4).map((value) =>
      JSON.parse(value) as {
        requested_direction: string;
        released_campaign_findings: Array<Record<string, unknown>>;
        finding_clusters: Array<{
          direction_kind: string;
          candidate_count: number;
          candidate_ids: string[];
          latest_finding?: string;
          next_research_focus: string;
        }>;
        adaptive_direction_focus: Array<{
          direction_kind: string;
          focus_score: number;
        }>;
      });
    const context = releasedContexts.find((entry) =>
      entry.requested_direction === "mean_reversion");
    if (!context) throw new Error("released mean-reversion context missing");
    expect(context.released_campaign_findings).toEqual([{
      release_id: release.paper_trading_comparison_research_release_id,
      candidate_id: FIXTURE_CANDIDATE_ID,
      direction_kind: "mean_reversion",
      release_kind: "challenger_not_reproduced",
      finding_kind: "negative_result",
      summary: release.finding.summary,
      next_research_focus: release.next_research_focus,
      released_at: release.released_at
    }]);
    const projected = context.released_campaign_findings[0]!;
    expect(projected).not.toHaveProperty("slot_results");
    expect(projected).not.toHaveProperty("promotion_eligibility");
    expect(projected).not.toHaveProperty("ledger_chain_refs");
    expect(projected).not.toHaveProperty("credentials");
    expect(projected).not.toHaveProperty("live_exchange_authority");
    expect(context.finding_clusters).toEqual(expect.arrayContaining([{
      direction_kind: "mean_reversion",
      market_regime: "unknown",
      candidate_count: 1,
      candidate_ids: [FIXTURE_CANDIDATE_ID],
      latest_finding: release.finding.summary,
      next_research_focus: release.next_research_focus
    }]));
    expect(context.adaptive_direction_focus).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction_kind: "mean_reversion",
        focus_score: 10
      })
    ]));
    expect(released.arena.finding_clusters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction_kind: "mean_reversion",
        candidate_count: 1,
        candidate_ids: [FIXTURE_CANDIDATE_ID]
      })
    ]));
  });

  it("feeds previous tick research efficiency into the next researcher context without promotion authority", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const capturedContexts: string[] = [];
    const first = await runCandidateArenaTick({
      store,
      tickId: "efficiency-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    const firstTick = first.arena.latest_ticks.find((entry) => entry.tick_id === first.tick_id);
    expect(firstTick?.direction_results[0]).toMatchObject({
      direction_kind: "trend_following",
      status: "created",
      research_efficiency: {
        provider_request_total: 6,
        runner_command_total: 0,
        scenario_count: 2,
        development: {
          submission_count: 1,
          provider_request_total: 6,
          runner_command_total: 0,
          scenario_count: 2,
          elapsed_ms: expect.any(Number)
        },
        sealed_admission: {
          submission_count: 1,
          provider_request_total: 21,
          runner_command_total: 0,
          scenario_count: 6,
          elapsed_ms: expect.any(Number)
        },
        authority_status: "not_promotion_authority"
      }
    });

    await runCandidateArenaTick({
      store,
      tickId: "efficiency-tick-2",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(capturedContexts).toHaveLength(2);
    const context = JSON.parse(capturedContexts[1]!) as {
      latest_research_efficiency: Array<{
        tick_id: string;
        direction_kind: string;
        runner_command_total: number;
        development: {
          submission_count: number;
          runner_command_total: number;
          elapsed_ms: number;
        };
      }>;
    };
    expect(context.latest_research_efficiency).toEqual([
      expect.objectContaining({
        tick_id: "efficiency-tick-1",
        direction_kind: "trend_following",
        runner_command_total: 0,
        development: expect.objectContaining({
          submission_count: 1,
          runner_command_total: 0,
          elapsed_ms: expect.any(Number)
        })
      })
    ]);
    expect(context.latest_research_efficiency[0]).not.toHaveProperty(
      "provider_request_total"
    );
    expect(context.latest_research_efficiency[0]).not.toHaveProperty(
      "scenario_count"
    );
    expect(context.latest_research_efficiency[0]).not.toHaveProperty(
      "sealed_admission"
    );
    expect(context.latest_research_efficiency[0]).not.toHaveProperty(
      "authority_status"
    );
    const workerContextSurface = JSON.stringify(context);
    expect(workerContextSurface).not.toMatch(
      /research_preflight|commitment_id|sealed_terminal_status|sealed_admission_suite_digest|rotation_commitment_digest|scenario_id|scenario_results|evaluator_trace|events_path|runner_command_evidence/i
    );
  });

  it("prioritizes default research directions from research efficiency budget pressure", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await seedResearchEfficiencyTick(store);

    const capturedContexts: string[] = [];
    const outcome = await runCandidateArenaTick({
      store,
      tickId: "budget-aware-direction-tick-2",
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const tick = outcome.arena.latest_ticks.find((entry) => entry.tick_id === outcome.tick_id);

    expect(tick?.direction_results.map((entry) => entry.direction_kind)).toEqual([
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk"
    ]);

    const budgetContexts = capturedContexts.map((rawContext) => JSON.parse(rawContext) as {
      requested_direction: string;
      adaptive_direction_focus: Array<{
        direction_kind: string;
        focus_score: number;
        focus_reason: string;
        next_research_focus: string;
      }>;
    });
    const meanReversionContext = budgetContexts.find((entry) => entry.requested_direction === "mean_reversion");
    if (!meanReversionContext) {
      throw new Error("mean reversion budget-aware context missing");
    }
    expect(meanReversionContext.adaptive_direction_focus[0]).toEqual({
      direction_kind: "mean_reversion",
      focus_score: 21,
      focus_reason: "research_efficiency_budget:low_cost_latency",
      next_research_focus: "Favor lower-cost ResearchDirection lanes while expensive lanes cool down."
    });
    expect(meanReversionContext.adaptive_direction_focus[0]).not.toHaveProperty(
      "authority_status"
    );
  });
});

class ResearchReleaseOverlayStore extends LocalStore {
  releases: PaperTradingComparisonResearchReleaseRecord[] = [];

  override async listPaperTradingComparisonResearchReleases(): Promise<
    PaperTradingComparisonResearchReleaseRecord[]
  > {
    return structuredClone(this.releases);
  }
}

class ResearchAllocationPolicyOverlayStore extends LocalStore {
  constructor(
    root: string,
    private readonly decisions: ResearchAllocationPolicyDecisionRecord[]
  ) {
    super(root);
  }

  override async listResearchAllocationPolicyDecisions(): Promise<
    ResearchAllocationPolicyDecisionRecord[]
  > {
    return structuredClone(this.decisions);
  }

  override async getResearchAllocationPolicyDecision(
    decisionId: string
  ): Promise<ResearchAllocationPolicyDecisionRecord | undefined> {
    const decision = this.decisions.find((entry) =>
      entry.research_allocation_policy_decision_id === decisionId
    );
    return decision ? structuredClone(decision) : undefined;
  }
}

function allocationPolicyDecisionFixture():
ResearchAllocationPolicyDecisionRecord {
  const decision: ResearchAllocationPolicyDecisionRecord = {
    record_kind: "research_allocation_policy_decision",
    version: 1,
    research_allocation_policy_decision_id:
      "research-allocation-policy-decision-runtime",
    study_ref: {
      record_kind: "research_control_study",
      id: "research-control-study-runtime"
    },
    study_digest: `sha256:${"a".repeat(64)}`,
    study_outcome_ref: {
      record_kind: "research_control_study_outcome",
      id: "research-control-study-outcome-runtime"
    },
    study_outcome_digest: `sha256:${"b".repeat(64)}`,
    target_allocation_policy_digest: allocationPolicyExactDigest(
      paperTradingComparisonPersistedRecordDigestInput(
        CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
      )
    ),
    decision_policy: {
      policy_version: "adaptive_supported_effect_v1",
      target_allocation_mode: "adaptive_default",
      required_inference_status: "adaptive_effect_supported",
      required_causal_scope: "same_baseline_stochastic_replication_only",
      required_policy_decision_eligibility:
        "eligible_for_separate_policy_decision",
      application_scope: "future_uncontrolled_candidate_arena_ticks"
    },
    decision_status: "approved",
    decision_reason: "supported_same_baseline_adaptive_effect",
    effective_default_mode: "adaptive_default",
    decided_at: "2026-07-12T09:00:00.000Z",
    policy_decision_digest: "pending",
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
  decision.policy_decision_digest = allocationPolicyExactDigest(
    researchAllocationPolicyDecisionDigestInput(decision)
  );
  return decision;
}

function allocationPolicyExactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function releasedCampaignFindingFixture(
  candidate: CandidateInspectReadModel
): PaperTradingComparisonResearchReleaseRecord {
  const candidateSystemCodeRef = candidate.system_code?.ref;
  if (!candidateSystemCodeRef?.record_kind || !candidateSystemCodeRef.id) {
    throw new Error("release ablation candidate SystemCode ref missing");
  }
  const systemCodeRef: Ref = {
    record_kind: candidateSystemCodeRef.record_kind,
    id: candidateSystemCodeRef.id
  };
  const releaseId = "campaign-outcome-direction-ablation-research-release";
  const findingId = `${releaseId}-finding`;
  const finding = {
    record_kind: "research_finding" as const,
    version: 1 as const,
    research_finding_id: findingId,
    research_worker_ref: { record_kind: "research_worker", id: "worker-ablation" },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "direction-mean-reversion"
    },
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment-ablation" },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: "evaluation-ablation"
    },
    finding_kind: "negative_result" as const,
    summary:
      "Paper comparison confirmation campaign campaign-direction-ablation: improved=1, not_improved=1, ineligible=0, expired=0; release=challenger_not_reproduced.",
    supporting_record_refs: [
      { record_kind: "research_finding", id: "source-finding-ablation" },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: "campaign-direction-ablation"
      },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: "campaign-outcome-direction-ablation"
      },
      { record_kind: "paper_trading_comparison_verdict", id: "verdict-ablation" }
    ],
    created_at: "2026-07-12T08:00:00.000Z",
    authority_status: "research_trace_only" as const
  };
  const lineage = {
    record_kind: "artifact_lineage" as const,
    version: 1 as const,
    artifact_lineage_id: `${releaseId}-lineage`,
    child_system_code_ref: { ...systemCodeRef },
    source_finding_refs: [
      { record_kind: "research_finding", id: "source-finding-ablation" },
      { record_kind: "research_finding", id: findingId }
    ],
    created_by_research_worker_ref: { ...finding.research_worker_ref },
    created_at: finding.created_at,
    authority_status: "lineage_only" as const
  };
  return {
    record_kind: "paper_trading_comparison_research_release",
    version: 1,
    paper_trading_comparison_research_release_id: releaseId,
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: "campaign-direction-ablation"
    },
    campaign_digest: "sha256:campaign-ablation",
    campaign_outcome_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: "campaign-outcome-direction-ablation"
    },
    campaign_outcome_digest: "sha256:outcome-ablation",
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: candidate.candidate_id
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: candidate.candidate_version.candidate_version_id
    },
    system_code_ref: { ...systemCodeRef },
    system_code_artifact_digest: "sha256:artifact-ablation",
    source_finding_ref: {
      record_kind: "research_finding",
      id: "source-finding-ablation"
    },
    source_finding_record_digest: "sha256:source-finding-ablation",
    source_lineage_ref: {
      record_kind: "artifact_lineage",
      id: "source-lineage-ablation"
    },
    source_lineage_record_digest: "sha256:source-lineage-ablation",
    direction_kind: "mean_reversion",
    release_kind: "challenger_not_reproduced",
    finding,
    finding_record_digest: "sha256:finding-ablation",
    lineage,
    lineage_record_digest: "sha256:lineage-ablation",
    next_research_focus:
      "Explain non-reproduction, preserve the negative result, and generate differentiated candidates under new prospective evidence.",
    released_at: finding.created_at,
    release_digest: "sha256:release-ablation",
    research_visibility: "released_to_research",
    evaluation_authority: "external_to_trading_systems",
    promotion_authority: false,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "lineage_only"
  };
}

function capturingResearchAgentDescriptor(): ManagedResearchAgent {
  return {
    id: "managed-agent-capturing-context",
    provider: "codex",
    model: "capturing-context",
    permission_policy: "artifact_workspace_only"
  };
}

function defaultCodexResearchAgentDescriptor(): ManagedResearchAgent {
  return {
    id: "managed-agent-codex-trading-research",
    provider: "codex",
    model: undefined,
    permission_policy: "artifact_workspace_only"
  };
}

function lifecycleResearchAgentDescriptor(): ManagedResearchAgent {
  return {
    id: "managed-agent-lifecycle-researcher",
    provider: "codex",
    model: "lifecycle-researcher-v1",
    permission_policy: "artifact_workspace_only"
  };
}

class CapturingResearchAgent implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent;

  constructor(
    private readonly contexts: string[],
    private readonly beforeImprove?: () => void | Promise<void>,
    agent: ManagedResearchAgent = defaultCodexResearchAgentDescriptor()
  ) {
    this.agent = structuredClone(agent);
  }

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    await this.beforeImprove?.();
    this.contexts.push(input.arena_context ?? "");
    const runPath = path.join(input.artifact_dir, "run.py");
    const source = await readFile(runPath, "utf8");
    const requestedDirection = (JSON.parse(input.arena_context ?? "{}") as {
      requested_direction?: string;
    }).requested_direction;
    const riskFraction = requestedDirection === "mean_reversion"
      ? "0.018"
      : requestedDirection === "volatility_regime"
        ? "0.006"
        : requestedDirection === "funding_aware_risk"
          ? "0.014"
          : requestedDirection === "execution_cost_robustness"
            ? "0.01"
            : "0.02";
    const directionAdjusted = source.replace(
      /RISK_FRACTION = [0-9.]+/,
      `RISK_FRACTION = ${riskFraction}`
    );
    await writeFile(
      runPath,
      `${directionAdjusted}\n# CandidateArena context captured for iteration ${input.iteration}.\n`,
      "utf8"
    );
    return {
      status: "edited",
      summary: "Captured arena context and versioned the candidate artifact.",
      changed_paths: ["run.py"]
    };
  }
}

class AutonomousSessionResearchAgent
implements TradingResearchAgentAdapter, ResearchWorkerSessionAdapter {
  readonly agent = defaultCodexResearchAgentDescriptor();
  runSessionCount = 0;

  constructor(
    private readonly mode: "select-second" | "finish-unselected" | "throw-after-first",
    private readonly beforeSession?: () => void | Promise<void>
  ) {}

  async improveArtifact(): Promise<AgentEditResult> {
    throw new Error("autonomous_session_legacy_edit_path_used");
  }

  async runSession(input: ResearchWorkerSessionInput): Promise<ResearchWorkerSessionResult> {
    this.runSessionCount += 1;
    await this.beforeSession?.();
    const requestedDirection = (JSON.parse(input.arena_context ?? "{}") as {
      requested_direction?: string;
    }).requested_direction;
    await setAutonomousSessionRisk(input.artifact_dir, "0.02");
    await input.tools.submitDevelopment({
      idempotency_key: `${this.mode}-submission-one`,
      research_note: "Evaluate the first autonomous session snapshot."
    });
    if (this.mode === "throw-after-first") {
      throw new Error("research worker failed after one completed submission");
    }
    if (this.mode === "finish-unselected") {
      const finished = await input.tools.finishWithoutSubmission({
        idempotency_key: "finish-without-selected-submission",
        reason: "No completed development snapshot should enter sealed admission."
      });
      return {
        status: finished.session_status,
        summary: finished.reason,
        provider_command_count: 1
      };
    }
    if (requestedDirection !== "trend_following") {
      const finished = await input.tools.finishWithoutSubmission({
        idempotency_key: `finish-non-target-${requestedDirection ?? "unknown"}`,
        reason: "This control direction is outside the selected-snapshot assertion."
      });
      return {
        status: finished.session_status,
        summary: finished.reason,
        provider_command_count: 1
      };
    }
    await setAutonomousSessionRisk(input.artifact_dir, "0.005");
    const second = await input.tools.submitDevelopment({
      idempotency_key: "select-second-submission-two",
      research_note: "Evaluate a lower-risk snapshot and select it deliberately."
    });
    const selected = await input.tools.selectDevelopment({
      idempotency_key: "select-second-explicit-selection",
      submission_sequence: second.submission_sequence,
      reason: "Select the lower-risk immutable snapshot despite its development rank."
    });
    return {
      status: selected.session_status,
      summary: selected.reason,
      selected_submission_sequence: selected.submission_sequence,
      provider_command_count: 2
    };
  }
}

async function setAutonomousSessionRisk(
  artifactDir: string,
  riskFraction: string
): Promise<void> {
  const runPath = path.join(artifactDir, "run.py");
  const source = await readFile(runPath, "utf8");
  await writeFile(
    runPath,
    source.replace(/RISK_FRACTION = [0-9.]+/, `RISK_FRACTION = ${riskFraction}`),
    "utf8"
  );
}

type LifecycleResearchCapture = {
  input: AgentEditInput;
  notebook: {
    prior_checkpoint?: unknown;
    entries: unknown[];
  };
};

class LifecycleResearchAgent implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent;

  constructor(
    private readonly captures: LifecycleResearchCapture[],
    private readonly mode: "edit" | "throw" = "edit",
    private readonly beforeImprove?: () => void | Promise<void>,
    identity: Partial<ManagedResearchAgent> = {}
  ) {
    this.agent = {
      ...lifecycleResearchAgentDescriptor(),
      ...identity
    };
  }

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    await this.beforeImprove?.();
    const notebook = JSON.parse(await readFile(input.notebook_path, "utf8")) as
      LifecycleResearchCapture["notebook"];
    this.captures.push({ input: { ...input }, notebook });
    if (this.mode === "throw") {
      throw new Error("research worker process terminated");
    }
    const runPath = path.join(input.artifact_dir, "run.py");
    const source = await readFile(runPath, "utf8");
    const riskAdjusted = source.replace(/RISK_FRACTION = [0-9.]+/, "RISK_FRACTION = 0.02");
    await writeFile(
      runPath,
      `${riskAdjusted}\n# Lifecycle notebook ${path.basename(input.notebook_path)}.\n`,
      "utf8"
    );
    return {
      status: "edited",
      summary: "Continued one bounded hypothesis from sanitized worker history.",
      changed_paths: ["run.py"]
    };
  }
}

class CheckpointDisabledStore extends LocalStore {
  override async recordResearchWorkerCheckpoint(
    _checkpoint: ResearchWorkerCheckpointRecord
  ): Promise<ResearchWorkerCheckpointRecord> {
    throw new Error("simulated checkpoint persistence interruption");
  }
}

type AllocationExecutionProbe = {
  active: number;
  maximumActive: number;
  calls: string[];
  visibleAllocationIds: Array<string | undefined>;
  firstPairReady: Promise<void>;
  releaseFirstPair: () => void;
};

function createAllocationExecutionProbe(): AllocationExecutionProbe {
  let releaseFirstPair = () => {};
  const firstPairReady = new Promise<void>((resolve) => {
    releaseFirstPair = resolve;
  });
  return {
    active: 0,
    maximumActive: 0,
    calls: [],
    visibleAllocationIds: [],
    firstPairReady,
    releaseFirstPair
  };
}

async function waitForAllocationProbePair(
  probe: AllocationExecutionProbe
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      probe.firstPairReady,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("allocation_probe_concurrency_timeout")),
          1_000
        );
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

class AllocationProbeResearchAgent implements TradingResearchAgentAdapter {
  readonly agent = defaultCodexResearchAgentDescriptor();

  constructor(
    private readonly store: LocalStore,
    private readonly probe: AllocationExecutionProbe
  ) {}

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const context = JSON.parse(input.arena_context ?? "{}") as {
      requested_direction?: string;
    };
    const direction = context.requested_direction ?? "missing";
    this.probe.calls.push(`${direction}:${input.iteration}`);
    this.probe.visibleAllocationIds.push(
      (await this.store.listCandidateArenaResearchAllocations())[0]
        ?.candidate_arena_research_allocation_id
    );
    this.probe.active += 1;
    this.probe.maximumActive = Math.max(
      this.probe.maximumActive,
      this.probe.active
    );
    if (this.probe.active === 2) {
      this.probe.releaseFirstPair();
    }
    try {
      await waitForAllocationProbePair(this.probe);
      const runPath = path.join(input.artifact_dir, "run.py");
      const source = await readFile(runPath, "utf8");
      await writeFile(
        runPath,
        `${source}\n# Allocation probe ${direction} ${input.iteration}.\n`,
        "utf8"
      );
      return {
        status: "edited",
        summary: `Allocation probe edited ${direction}.`,
        changed_paths: ["run.py"]
      };
    } finally {
      this.probe.active -= 1;
    }
  }
}

class FailedResearchAgent implements TradingResearchAgentAdapter {
  readonly agent = defaultCodexResearchAgentDescriptor();

  async improveArtifact(): Promise<AgentEditResult> {
    return {
      status: "failed",
      summary: "ResearchWorker failed before artifact execution.",
      failure_reason: "codex_cli_failed",
      error: "diagnostic_worker_failed",
      changed_paths: []
    };
  }
}

class ThrowingResearchAgent implements TradingResearchAgentAdapter {
  readonly agent = defaultCodexResearchAgentDescriptor();

  async improveArtifact(): Promise<AgentEditResult> {
    throw new Error("research worker process terminated");
  }
}

class NoChangeResearchAgent implements TradingResearchAgentAdapter {
  readonly agent = defaultCodexResearchAgentDescriptor();

  async improveArtifact(): Promise<AgentEditResult> {
    return {
      status: "no_change",
      summary: "No candidate change was produced.",
      changed_paths: []
    };
  }
}

class MisreportedEditResearchAgent implements TradingResearchAgentAdapter {
  readonly agent = defaultCodexResearchAgentDescriptor();

  async improveArtifact(): Promise<AgentEditResult> {
    return {
      status: "edited",
      summary: "Reported an edit without changing the submitted SystemCode.",
      changed_paths: ["run.py"]
    };
  }
}

class EscapingEntrypointResearchAgent implements TradingResearchAgentAdapter {
  readonly agent = defaultCodexResearchAgentDescriptor();

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const outsidePath = path.join(input.artifact_dir, "..", "outside.py");
    await writeFile(outsidePath, "print('outside artifact root')\n", "utf8");
    await writeFile(path.join(input.artifact_dir, "manifest.json"), `${JSON.stringify({
      id: "escaping-entrypoint",
      name: "Escaping Entrypoint",
      api_contract: "trading_api_provider_v1",
      entrypoint: ["python3", "../outside.py"],
      editable_paths: ["../outside.py"]
    }, null, 2)}\n`, "utf8");
    return {
      status: "edited",
      summary: "Repointed manifest outside the artifact root.",
      changed_paths: ["manifest.json"]
    };
  }
}

class MissingEditablePathsResearchAgent implements TradingResearchAgentAdapter {
  readonly agent = defaultCodexResearchAgentDescriptor();

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    await writeFile(path.join(input.artifact_dir, "manifest.json"), `${JSON.stringify({
      id: "missing-editable-paths",
      name: "Missing Editable Paths",
      api_contract: "trading_api_provider_v1",
      entrypoint: ["python3", "run.py"]
    }, null, 2)}\n`, "utf8");
    return {
      status: "edited",
      summary: "Removed required editable path declaration.",
      changed_paths: ["manifest.json"]
    };
  }
}

async function seedPaperTradingEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel,
  options: {
    status?: PaperTradingEvaluationRecord["status"];
    observationStatus?: PaperTradingObservationRecord["status"];
    evaluationId?: string;
    startedAt?: string;
    lastObservedAt?: string;
    latestScore?: PaperTradingEvaluationRecord["latest_score"];
    failureReason?: string;
    expectedDirection?: "long" | "short" | "flat";
    volatility?: number;
    evidencePurpose?: PaperTradingEvidencePurpose;
    observationCount?: number;
    priorObservations?: Array<{
      sequence: number;
      observedAt: string;
      cumulativeScore: PaperTradingObservationRecord["cumulative_score"];
    }>;
  } = {}
): Promise<{
  evaluation: PaperTradingEvaluationRecord;
  observation: PaperTradingObservationRecord;
}> {
  const evaluationId = options.evaluationId ?? `paper-trading-evaluation-${candidate.candidate_id}-context`;
  const startedAt = options.startedAt ?? "2026-05-16T00:00:00.000Z";
  const lastObservedAt = options.lastObservedAt ?? "2026-05-16T00:07:00.000Z";
  const latestScore = options.latestScore ?? {
    revenue_usdt: 13,
    cost_usdt: 0.66,
    net_revenue_usdt: 12.34,
    net_return_pct: 0.1234
  };
  const observationCount = options.observationCount ?? 7;
  const evidencePurpose = options.evidencePurpose ?? "research_feedback";
  let paperCandidate = candidate;
  if (evidencePurpose === "qualification") {
    const paperRun = await store.createPaperTradingRun({
      idempotency_key: `arena-paper-context:${evaluationId}:qualification`,
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification",
      created_at: startedAt
    });
    const projected = await store.getCandidateForTradingRun(paperRun.trading_run_id);
    if (!projected) {
      throw new Error(`missing qualification TradingRun projection for ${evaluationId}`);
    }
    paperCandidate = projected;
  }
  const systemCodeId = candidate.system_code?.ref?.id;
  const systemCode = systemCodeId ? await store.getSystemCode(systemCodeId) : undefined;
  if (!systemCode) {
    throw new Error(`missing SystemCode for ${candidate.candidate_id}`);
  }
  const initialState = initialPaperTradingEngineState();
  const commitment = createPaperTradingEvaluationCommitment({
    commitmentId: `paper-context-commitment-${evaluationId}`,
    evidencePurpose,
    candidate: paperCandidate,
    systemCode,
    resolvedArtifactDigest: systemCode.artifact_digest,
    marketData: fakeGatewayMarketDataPort(),
    intervalMs: 60_000,
    initialAccountSnapshot: initialState.account,
    committedAt: startedAt
  });
  await store.recordPaperTradingEvaluationCommitment(commitment);
  const finalEvaluation: PaperTradingEvaluationRecord = {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: evaluationId,
    candidate_ref: commitment.candidate_ref,
    candidate_version_ref: commitment.candidate_version_ref,
    trading_run_ref: commitment.trading_run_ref,
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: options.status ?? "running",
    interval_ms: 60_000,
    observation_count: observationCount,
    started_at: startedAt,
    last_observed_at: lastObservedAt,
    next_observation_at: "2026-05-16T00:08:00.000Z",
    latest_score: latestScore,
    paper_account_snapshot: paperContextAccountForScore(latestScore),
    open_orders: [],
    latest_fill: {
      fill_id: "paper-context-fill-0007",
      order_id: "paper-context-order-0001",
      fill_status: "filled",
      fill_price: "65123",
      fill_quantity: "0.001",
      fee_usdt: "0.26",
      slippage_usdt: "0.20",
      funding_usdt: "0.20",
      trade_time: "2026-05-16T00:07:00.000Z",
      source_trade_id: "paper-context-trade-0007"
    },
    processed_trading_system_event_ids: ["paper-context-order-0001", "paper-context-hold-0002"],
    processed_public_trade_ids: ["paper-context-trade-0007"],
    latest_public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: "2026-05-16T00:07:00.000Z",
      source_kind: "binance_production_public_hybrid",
      source_priority: "websocket_primary",
      freshness: "fresh",
      ws_connected: true,
      rest_fallback_used: false,
      gap_detected: false,
      stream_marker: "aggTrade:paper-context-trade-0007",
      agg_trades: [{
        trade_id: "paper-context-trade-0007",
        price: "65123",
        quantity: "0.001",
        trade_time: "2026-05-16T00:07:00.000Z"
      }],
      authority_status: "read_only"
    },
    latest_failure_reason: options.failureReason,
    authority_status: "not_live"
  };
  const observation: PaperTradingObservationRecord = {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: `${evaluationId}-observation-0007`,
    paper_trading_evaluation_ref: { record_kind: "paper_trading_evaluation", id: evaluationId },
    candidate_ref: commitment.candidate_ref,
    candidate_version_ref: commitment.candidate_version_ref,
    trading_run_ref: commitment.trading_run_ref,
    sequence: observationCount,
    status: options.observationStatus ?? "recorded",
    observed_at: lastObservedAt,
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 65_123,
      moving_average_fast: 65_180,
      moving_average_slow: 65_000,
      volatility: options.volatility,
      expected_direction: options.expectedDirection,
      observed_at: "2026-05-16T00:07:00.000Z",
      source_kind: "binance_production_public_hybrid",
      source_priority: "websocket_primary",
      freshness: "fresh",
      ws_connected: true,
      rest_fallback_used: false,
      gap_detected: false,
      stream_marker: "bookTicker:paper-context-0007",
      authority_status: "read_only"
    },
    paper_trading_evaluation_commitment_ref:
      finalEvaluation.paper_trading_evaluation_commitment_ref,
    public_execution_snapshot: finalEvaluation.latest_public_execution_snapshot,
    decision: {
      decision_kind: "hold",
      source_kind: "trading_system_decision",
      reason: "paper context seed preserved selected candidate evidence",
      observed_at: "2026-05-16T00:07:00.000Z",
      authority_status: "trace_only"
    },
    paper_account_snapshot: finalEvaluation.paper_account_snapshot,
    open_orders: [],
    latest_fill: finalEvaluation.latest_fill,
    processed_trading_system_event_ids: finalEvaluation.processed_trading_system_event_ids,
    processed_public_trade_ids: finalEvaluation.processed_public_trade_ids,
    score_delta: {
      revenue_usdt: 1,
      cost_usdt: 0.04,
      net_revenue_usdt: 0.96,
      net_return_pct: 0.0096
    },
    cumulative_score: latestScore,
    failure_reason: options.failureReason,
    authority_status: "not_live"
  };
  let evaluation: PaperTradingEvaluationRecord = {
    ...finalEvaluation,
    status: "not_started",
    observation_count: 0,
    last_observed_at: undefined,
    next_observation_at: undefined,
    latest_score: {
      revenue_usdt: 0,
      cost_usdt: 0,
      net_revenue_usdt: 0,
      net_return_pct: 0
    },
    paper_account_snapshot: commitment.initial_account_snapshot,
    latest_fill: undefined,
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    latest_public_execution_snapshot: undefined,
    latest_failure_reason: undefined
  };
  await store.recordPaperTradingEvaluation(evaluation);
  let latestObservation = observation;
  for (let sequence = 1; sequence <= observationCount; sequence += 1) {
    const isFinal = sequence === observationCount;
    const override = options.priorObservations?.find((item) => item.sequence === sequence);
    const observedAt = override?.observedAt ?? (isFinal
      ? lastObservedAt
      : new Date(
          Date.parse(startedAt) +
          (Date.parse(lastObservedAt) - Date.parse(startedAt)) * sequence / observationCount
        ).toISOString());
    const cumulativeScore = override?.cumulativeScore ?? (isFinal
      ? latestScore
      : scaledPaperContextScore(latestScore, sequence, observationCount));
    const nextEvaluation: PaperTradingEvaluationRecord = {
      ...evaluation,
      status: isFinal ? finalEvaluation.status : "running",
      observation_count: sequence,
      last_observed_at: observedAt,
      next_observation_at: isFinal ? finalEvaluation.next_observation_at : undefined,
      latest_score: cumulativeScore,
      paper_account_snapshot: paperContextAccountForScore(cumulativeScore),
      latest_fill: isFinal ? finalEvaluation.latest_fill : evaluation.latest_fill,
      processed_trading_system_event_ids: isFinal
        ? finalEvaluation.processed_trading_system_event_ids
        : evaluation.processed_trading_system_event_ids,
      processed_public_trade_ids: isFinal
        ? finalEvaluation.processed_public_trade_ids
        : evaluation.processed_public_trade_ids,
      latest_public_execution_snapshot: isFinal
        ? finalEvaluation.latest_public_execution_snapshot
        : evaluation.latest_public_execution_snapshot,
      latest_failure_reason: isFinal ? finalEvaluation.latest_failure_reason : undefined
    };
    const nextObservation: PaperTradingObservationRecord = {
      ...observation,
      paper_trading_observation_id:
        `${evaluationId}-observation-${String(sequence).padStart(4, "0")}`,
      sequence,
      status: isFinal ? observation.status : "recorded",
      observed_at: observedAt,
      market_snapshot: observation.market_snapshot
        ? { ...observation.market_snapshot, observed_at: observedAt }
        : undefined,
      public_execution_snapshot: isFinal
        ? observation.public_execution_snapshot
        : undefined,
      decision: observation.decision
        ? { ...observation.decision, observed_at: observedAt }
        : undefined,
      paper_account_snapshot: nextEvaluation.paper_account_snapshot,
      latest_fill: isFinal ? observation.latest_fill : undefined,
      processed_trading_system_event_ids:
        nextEvaluation.processed_trading_system_event_ids,
      processed_public_trade_ids: nextEvaluation.processed_public_trade_ids,
      score_delta: {
        revenue_usdt: roundPaperContextValue(
          cumulativeScore.revenue_usdt - evaluation.latest_score.revenue_usdt
        ),
        cost_usdt: roundPaperContextValue(
          cumulativeScore.cost_usdt - evaluation.latest_score.cost_usdt
        ),
        net_revenue_usdt: roundPaperContextValue(
          cumulativeScore.net_revenue_usdt - evaluation.latest_score.net_revenue_usdt
        ),
        net_return_pct: roundPaperContextValue(
          cumulativeScore.net_return_pct - evaluation.latest_score.net_return_pct
        )
      },
      cumulative_score: cumulativeScore,
      failure_reason: isFinal ? observation.failure_reason : undefined
    };
    await store.recordPaperTradingObservation(nextObservation, nextEvaluation);
    evaluation = nextEvaluation;
    latestObservation = nextObservation;
  }
  return { evaluation, observation: latestObservation };
}

function scaledPaperContextScore(
  score: PaperTradingEvaluationRecord["latest_score"],
  sequence: number,
  observationCount: number
): PaperTradingEvaluationRecord["latest_score"] {
  const revenue = roundPaperContextValue(
    score.revenue_usdt * sequence / observationCount
  );
  const cost = roundPaperContextValue(
    score.cost_usdt * sequence / observationCount
  );
  const net = roundPaperContextValue(revenue - cost);
  return {
    revenue_usdt: revenue,
    cost_usdt: cost,
    net_revenue_usdt: net,
    net_return_pct: roundPaperContextValue(net / 10_000 * 100)
  };
}

function paperContextAccountForScore(
  score: PaperTradingEvaluationRecord["latest_score"]
): NonNullable<PaperTradingEvaluationRecord["paper_account_snapshot"]> {
  const fee = roundPaperContextValue(score.cost_usdt * 0.4);
  const slippage = roundPaperContextValue(score.cost_usdt * 0.3);
  const funding = roundPaperContextValue(score.cost_usdt - fee - slippage);
  const equity = roundPaperContextValue(10_000 + score.net_revenue_usdt);
  return {
    wallet_balance_usdt: `${equity}`,
    available_balance_usdt: `${equity}`,
    equity_usdt: `${equity}`,
    realized_pnl_usdt: `${score.revenue_usdt}`,
    unrealized_pnl_usdt: "0",
    fee_paid_usdt: `${fee}`,
    slippage_paid_usdt: `${slippage}`,
    funding_paid_usdt: `${funding}`,
    margin_reserved_usdt: "0",
    position: {
      symbol: "BTCUSDT",
      quantity: "0.001",
      side: "long",
      average_entry_price: "65000",
      mark_price: "65123",
      notional_usdt: "65.123"
    },
    open_order_count: 0,
    authority_status: "not_live"
  };
}

function roundPaperContextValue(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

async function seedPaperTradingCadenceEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel
): Promise<void> {
  await seedPaperTradingEvidence(store, candidate, {
    evaluationId: `paper-trading-evaluation-${candidate.candidate_id}-cadence`,
    startedAt: "2026-05-16T00:00:00.000Z",
    lastObservedAt: "2026-05-16T00:03:00.000Z",
    observationCount: 3,
    priorObservations: [
      {
        sequence: 1,
        observedAt: "2026-05-16T00:00:00.000Z",
        cumulativeScore: {
          revenue_usdt: 11,
          cost_usdt: 0.5,
          net_revenue_usdt: 10.5,
          net_return_pct: 0.105
        }
      },
      {
        sequence: 2,
        observedAt: "2026-05-16T00:01:20.000Z",
        cumulativeScore: {
          revenue_usdt: 12,
          cost_usdt: 0.6,
          net_revenue_usdt: 11.4,
          net_return_pct: 0.114
        }
      }
    ]
  });
}

async function seedResearchEfficiencyTick(store: LocalStore): Promise<void> {
  const allocation = decideCandidateArenaResearchAllocation({
    tickId: "budget-aware-direction-tick-1",
    allocatedAt: "2026-05-16T00:00:00.000Z",
    allocationMode: "explicit",
    allocationPolicyBasis: { basis_kind: "explicit_request" },
    explicitDirections: ["trend_following", "mean_reversion"],
    findingClusters: [],
    latestTicks: [],
    priorAllocations: [],
    completedTickIds: []
  });
  await store.recordCandidateArenaResearchAllocation(allocation);
  const tick: CandidateArenaTickRecord = {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: "candidate-arena-tick-budget-aware-direction-1",
    tick_id: "budget-aware-direction-tick-1",
    started_at: "2026-05-16T00:00:00.000Z",
    completed_at: "2026-05-16T00:02:00.000Z",
    status: "completed",
    source_candidate: {
      source_kind: "fixture_seed",
      candidate_id: FIXTURE_CANDIDATE_ID,
      display_name: "Fixture generic trading-system candidate",
      authority_status: "not_live"
    },
    created_candidate_refs: [{ record_kind: "trading_system_candidate", id: FIXTURE_CANDIDATE_ID }],
    direction_results: [
      {
        direction_kind: "trend_following",
        status: "created",
        candidate_id: FIXTURE_CANDIDATE_ID,
        finding: "Trend following was executable but expensive for the last tick.",
        net_revenue_usdt: 1,
        research_efficiency: {
          provider_request_total: 48,
          runner_command_total: 12,
          scenario_count: 4,
          elapsed_ms: 120_000,
          authority_status: "not_promotion_authority"
        }
      },
      {
        direction_kind: "mean_reversion",
        status: "created",
        candidate_id: FIXTURE_CANDIDATE_ID,
        finding: "Mean reversion was executable with lower research cost.",
        net_revenue_usdt: 0.8,
        research_efficiency: {
          provider_request_total: 2,
          runner_command_total: 0,
          scenario_count: 2,
          elapsed_ms: 1_000,
          authority_status: "not_promotion_authority"
        }
      }
    ],
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: allocation.allocation_digest,
    authority_status: "not_live"
  };
  await store.recordCandidateArenaTick(tick);
}

function networklessReplayArtifactRunner(options: {
  useArtifactRisk?: boolean;
} = {}): TradingArtifactRunner {
  return {
    kind: "host_process",
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    async run(input) {
      const market = input.provider.candidate_input.market;
      const account = input.provider.candidate_input.account;
      const shouldHold = market.moving_average_fast === market.moving_average_slow;
      const riskFraction = options.useArtifactRisk === false
        ? 0.02
        : await declaredArtifactRiskFraction(input.artifact_dir);
      const orderRequest = {
        symbol: market.symbol,
        side: shouldHold
          ? "hold" as const
          : market.moving_average_fast < market.moving_average_slow
            ? "sell" as const
            : "buy" as const,
        quantity: shouldHold
          ? 0
          : Number((account.equity * Math.min(riskFraction, account.max_risk_fraction) / market.price).toFixed(8)),
        order_type: shouldHold ? "none" as const : "market" as const,
        reason: "networkless arena context runner preserves TradingApiProvider boundary"
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
      await writeFile(eventsPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
      return {
        status: "completed",
        runner_kind: "host_process",
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: eventsPath,
        stdout: events.map((event) => JSON.stringify(event)).join("\n"),
        stderr: "",
        events,
        provider_requests: providerBoundaryRequests(orderRequest)
      };
    }
  };
}

function invariantBehaviorReplayArtifactRunner(): TradingArtifactRunner {
  return networklessReplayArtifactRunner({ useArtifactRisk: false });
}

function fingerprintUnavailableReplayArtifactRunner(): TradingArtifactRunner {
  const runner = networklessReplayArtifactRunner();
  return {
    ...runner,
    async run(input) {
      const run = await runner.run(input);
      const providerRequests = new Proxy(run.provider_requests, {
        get(target, property, receiver) {
          if (property === "map") {
            return (callback: (
              request: TradingProviderRequestLog,
              index: number,
              requests: TradingProviderRequestLog[]
            ) => unknown) => target
              .filter((request) => !(
                request.method === "POST" && request.path === "/orders/validate"
              ))
              .map(callback);
          }
          return Reflect.get(target, property, receiver);
        }
      });
      return { ...run, provider_requests: providerRequests };
    }
  };
}

async function declaredArtifactRiskFraction(artifactDir: string): Promise<number> {
  const source = await readFile(path.join(artifactDir, "run.py"), "utf8");
  const value = Number(source.match(/RISK_FRACTION = ([0-9.]+)/)?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 0.02;
}

function acceptedNegativeReplayArtifactRunner(): TradingArtifactRunner {
  return {
    kind: "host_process",
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    async run(input) {
      const market = input.provider.candidate_input.market;
      const account = input.provider.candidate_input.account;
      const orderRequest = {
        symbol: market.symbol,
        side: "sell" as const,
        quantity: Number((account.equity * 0.02 / market.price).toFixed(8)),
        order_type: "market" as const,
        reason: "valid bounded candidate intentionally produces negative research evidence"
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
      await writeFile(eventsPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
      return {
        status: "completed",
        runner_kind: "host_process",
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: eventsPath,
        stdout: events.map((event) => JSON.stringify(event)).join("\n"),
        stderr: "",
        events,
        provider_requests: providerBoundaryRequests(orderRequest)
      };
    }
  };
}

function attestedNegativeReplayArtifactRunner(): TradingArtifactRunner {
  const base = acceptedNegativeReplayArtifactRunner();
  return {
    kind: "docker_sandboxes_sbx",
    async probePaperHandoff(input) {
      const probe = passingPaperHandoffProbe(input, "docker_sandboxes_sbx");
      const networkPolicy = {
        protocol_version: "candidate_sandbox_network_policy_v1" as const,
        inherited_allow_digest: sha256Digest("[]"),
        inherited_allow_count: 0,
        owned_allow_rule_ids: [],
        owned_deny_rule_ids: [],
        deny_targets: [...CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS]
      };
      const networkPolicyDigest = sha256Digest(
        candidateEgressNetworkPolicyDigestInput(networkPolicy)
      );
      return {
        ...probe,
        candidate_effect: {
          started_at: probe.started_at,
          completed_at: probe.completed_at
        },
        candidate_egress_policy_evidence: {
          sandbox: {
            adapter_kind: "docker_sandboxes_sbx",
            sandbox_name: "ouro-arena-attested-fixture",
            implementation_version: "0.35.0"
          },
          network_policy: networkPolicy,
          network_policy_digest: networkPolicyDigest,
          start: {
            observed_at: probe.started_at,
            policy_digest: networkPolicyDigest
          },
          end: {
            observed_at: probe.completed_at,
            policy_digest: networkPolicyDigest
          },
          denial_summary: {
            required_probe_count: CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length,
            start_denied_probe_count: CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length,
            end_denied_probe_count: CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length,
            unexpected_allow_count: 0
          },
          cleanup_status: "released",
          enforcement_result: "enforced"
        }
      };
    },
    async run(input) {
      return {
        ...await base.run(input),
        runner_kind: "docker_sandboxes_sbx"
      };
    }
  };
}

function researchFindingEvidence(
  finding: ResearchFindingRecord
): ResearchEvidenceArtifactRecord {
  const record: ResearchEvidenceArtifactRecord = {
    record_kind: "research_evidence_artifact",
    version: 1,
    research_evidence_artifact_id:
      `research-evidence-${finding.research_finding_id}`,
    source_kind: "research_finding",
    subject_ref: { ...finding.research_worker_ref },
    artifact_ref: {
      record_kind: "research_finding",
      id: finding.research_finding_id
    },
    source_digest: sha256Digest(
      paperTradingComparisonPersistedRecordDigestInput(finding)
    ),
    summary: canonicalResearchEvidenceArtifactSummary(
      "research_finding",
      finding
    ),
    supporting_record_refs: [
      { ...finding.research_direction_ref },
      { ...finding.experiment_run_ref },
      { ...finding.trading_evaluation_result_ref },
      ...finding.supporting_record_refs.map((reference) => ({ ...reference }))
    ].filter((reference, index, references) => references.findIndex(
      (candidate) => candidate.record_kind === reference.record_kind &&
        candidate.id === reference.id
    ) === index),
    captured_at: finding.created_at,
    sanitization_policy: "research_evidence_sanitization_v1",
    sanitization_status: "sanitized",
    qualification_evidence_hidden: true,
    secrets_removed: true,
    host_paths_removed: true,
    truncated: false,
    artifact_digest: "",
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.artifact_digest = sha256Digest(
    researchEvidenceArtifactDigestInput(record)
  );
  return record;
}

function sha256Digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function crashedReplayArtifactRunner(): TradingArtifactRunner {
  return {
    kind: "host_process",
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    async run(input) {
      await mkdir(input.output_dir, { recursive: true });
      return {
        status: "crashed",
        runner_kind: "host_process",
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: path.join(input.output_dir, "events.jsonl"),
        stdout: "",
        stderr: "candidate runtime crashed during sealed ResearchPreflight",
        exit_code: 1,
        events: [],
        provider_requests: input.provider.requests(),
        error: "candidate_runtime_crash_for_admission_test"
      };
    }
  };
}

function evaluatorProbingReplayArtifactRunner(): TradingArtifactRunner {
  const runner = networklessReplayArtifactRunner();
  return {
    kind: "host_process",
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    async run(input) {
      const run = await runner.run(input);
      return {
        ...run,
        provider_requests: [
          ...run.provider_requests,
          providerRequest("GET", "/evaluation/outcome")
        ]
      };
    }
  };
}

function paperRejectedReplayArtifactRunner(): TradingArtifactRunner {
  const runner = networklessReplayArtifactRunner();
  return {
    ...runner,
    async probePaperHandoff(input) {
      const probe = passingPaperHandoffProbe(input);
      return {
        ...probe,
        output_lines: probe.output_lines.filter((line) =>
          JSON.parse(line).event !== "runtime_heartbeat"
        )
      };
    }
  };
}

function paperHandoffPayloadSmugglingArtifactRunner(): TradingArtifactRunner {
  const runner = networklessReplayArtifactRunner();
  return {
    ...runner,
    async probePaperHandoff(input) {
      const probe = passingPaperHandoffProbe(input);
      const validationRequest = probe.provider_requests.find((request) =>
        request.method === "POST" && request.path === "/orders/validate"
      );
      if (!validationRequest || !validationRequest.body ||
        typeof validationRequest.body !== "object" ||
        Array.isArray(validationRequest.body)) {
        throw new Error("paper handoff validation request fixture missing");
      }
      validationRequest.body = {
        ...validationRequest.body,
        undeclared_payload: true
      };
      return probe;
    }
  };
}

function paperHandoffHiddenFieldArtifactRunner(): TradingArtifactRunner {
  const runner = networklessReplayArtifactRunner();
  return {
    ...runner,
    async probePaperHandoff(input) {
      const probe = passingPaperHandoffProbe(input);
      probe.output_lines.push(JSON.stringify({
        event: "diagnostic",
        expectedDirection: "long"
      }));
      return probe;
    }
  };
}

function paperInfrastructureFailureArtifactRunner(): TradingArtifactRunner {
  const runner = networklessReplayArtifactRunner();
  return {
    ...runner,
    async probePaperHandoff() {
      throw new PaperTradingHandoffConformanceInfrastructureError(
        "runner_unavailable",
        "paper handoff test runner unavailable"
      );
    }
  };
}

async function networklessReplayTradingApiProvider(
  candidateInput: ReplayTradingCandidateInput
): Promise<ReplayTradingApiProviderSession> {
  return {
    base_url: "",
    close: async () => undefined,
    requests: () => [],
    candidate_input: candidateInput
  };
}

function providerBoundaryRequests(orderRequest?: unknown): TradingProviderRequestLog[] {
  return [
    providerRequest("GET", "/market/snapshot"),
    providerRequest("GET", "/account/state"),
    providerRequest("POST", "/orders/validate", orderRequest)
  ];
}

function providerRequest(method: string, requestPath: string, body?: unknown): TradingProviderRequestLog {
  return {
    at: "2026-05-16T00:00:00.000Z",
    method,
    path: requestPath,
    ...(body === undefined ? {} : { body }),
    response_status: 200
  };
}
