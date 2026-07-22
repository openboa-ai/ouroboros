import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  canonicalResearchEvidenceArtifactSummary,
  decideCandidateAdmission,
  paperTradingComparisonPersistedRecordDigestInput,
  researchEvidenceArtifactDigestInput,
  researchPreflightCommitmentDigestInput,
  researchWorkerCheckpointDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateArenaResearchAllocationRecord,
  type ExperimentRunRecord,
  type ResearchDirectionRecord,
  type ResearchEvidenceArtifactRecord,
  type ResearchFindingRecord,
  type ResearchPreflightCommitmentRecord,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerMemoryPolicy,
  type ResearchWorkerRecord,
  type SystemCodeRecord,
  type TradingEvaluationResultRecord
} from "@ouroboros/domain";
import { LocalStore } from "../src/index";

describe("LocalStore ResearchWorkerCheckpoint", () => {
  let storeRoot: string;
  let store: LocalStore;

  beforeEach(async () => {
    storeRoot = await mkdtemp(path.join(os.tmpdir(), "ouroboros-worker-checkpoint-store-"));
    store = new LocalStore(storeRoot);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(storeRoot, { recursive: true, force: true });
  });

  it("persists, exactly replays, lists, and reloads a first failed-closed checkpoint", async () => {
    const graph = await persistWorkerGraph(store);
    const commitment = await persistCommitment(store, graph, "first", 10, 1);
    const checkpoint = failedCheckpoint(graph, commitment, {
      closedAt: "2026-07-12T10:10:00.000Z",
      reason: "execution_failed"
    });

    await expect(store.recordResearchWorkerCheckpoint(checkpoint)).resolves.toEqual(checkpoint);
    await expect(store.recordResearchWorkerCheckpoint(checkpoint)).resolves.toEqual(checkpoint);
    await expect(store.getResearchWorkerCheckpoint(
      checkpoint.research_worker_checkpoint_id
    )).resolves.toEqual(checkpoint);
    await expect(store.listResearchWorkerCheckpoints()).resolves.toEqual([checkpoint]);

    const restarted = new LocalStore(storeRoot);
    await restarted.initialize();
    await expect(restarted.listResearchWorkerCheckpoints()).resolves.toEqual([checkpoint]);
  });

  it("rejects a triggered preflight commitment without methodology", async () => {
    const graph = await persistWorkerGraph(store);
    const allocation = allocationFixture(
      "trigger-without-methodology",
      graph.direction.direction_kind,
      1,
      "2026-07-12T10:00:00.000Z"
    );
    allocation.trigger = {
      trigger_kind: "goal",
      trigger_id: "trigger-without-methodology",
      goal: "Run one bounded CandidateArena Research cycle.",
      triggered_at: "2026-07-12T10:00:00.000Z",
      authority_status: "research_only"
    };
    allocation.allocation_digest = exactDigest(
      candidateArenaResearchAllocationDigestInput(allocation)
    );
    await store.recordCandidateArenaResearchAllocation(allocation);
    const commitment = commitmentFixture({
      graph,
      allocation,
      suffix: "trigger-without-methodology",
      committedAt: "2026-07-12T10:01:00.000Z",
      submissionLimit: 1
    });

    await expect(store.recordResearchPreflightCommitment(commitment))
      .rejects.toMatchObject({
        code: "research_preflight_commitment_evidence_mismatch"
      });
  });

  it("persists a contiguous completed checkpoint with exact admission and cumulative budget", async () => {
    const graph = await persistWorkerGraph(store);
    const firstCommitment = await persistCommitment(store, graph, "first", 10, 1);
    const first = failedCheckpoint(graph, firstCommitment, {
      closedAt: "2026-07-12T10:10:00.000Z",
      reason: "restart_recovery"
    });
    await store.recordResearchWorkerCheckpoint(first);

    const secondCommitment = await persistCommitment(store, graph, "second", 11, 1);
    const admission = await persistAdmission(store, graph, secondCommitment, 11);
    const second = completedCheckpoint(graph, secondCommitment, first, admission);

    await expect(store.recordResearchWorkerCheckpoint(second)).resolves.toEqual(second);
    await expect(store.listResearchWorkerCheckpoints()).resolves.toEqual([second, first]);
    expect(second.development_budget).toEqual({
      submission_limit: 1,
      recorded_submission_count: 1,
      cumulative_committed_submission_limit: 2,
      cumulative_recorded_submission_count: 1,
      remaining_submission_authority: 0
    });
  });

  it("requires a preflight memory policy to bind the exact prior checkpoint graph", async () => {
    const graph = await persistWorkerGraph(store);
    const firstCommitment = await persistCommitment(store, graph, "memory-first", 10, 1);
    const first = failedCheckpoint(graph, firstCommitment, {
      closedAt: "2026-07-12T10:10:00.000Z",
      reason: "execution_failed"
    });
    await store.recordResearchWorkerCheckpoint(first);
    const valid = await persistCommitment(
      store,
      graph,
      "memory-valid",
      11,
      1,
      memoryPolicy(first, "included")
    );
    expect(valid.memory_policy?.prior_checkpoint).toEqual({
      disposition: "included",
      checkpoint_ref: {
        record_kind: "research_worker_checkpoint",
        id: first.research_worker_checkpoint_id
      },
      checkpoint_digest: first.checkpoint_digest
    });
    const validCheckpoint = failedCheckpoint(graph, valid, {
      closedAt: "2026-07-12T11:10:00.000Z",
      reason: "execution_failed",
      previous: first,
      cumulativeCommitted: 2
    });
    await store.recordResearchWorkerCheckpoint(validCheckpoint);

    await expect(persistCommitment(
      store,
      graph,
      "memory-stale-reference",
      12,
      1,
      memoryPolicy(first, "included")
    )).rejects.toMatchObject({
      code: "research_preflight_commitment_memory_checkpoint_mismatch",
      details: {
        mismatch_fields: expect.arrayContaining([
          "memory_policy.prior_checkpoint_not_immediate"
        ])
      }
    });

    const missing = withCommitmentDigest({
      ...structuredClone(valid),
      research_preflight_commitment_id: "research-preflight-memory-missing",
      memory_policy: {
        ...structuredClone(valid.memory_policy!),
        prior_checkpoint: {
          disposition: "included",
          checkpoint_ref: {
            record_kind: "research_worker_checkpoint",
            id: "missing-checkpoint"
          },
          checkpoint_digest: first.checkpoint_digest
        }
      },
      sealed_admission_policy: {
        ...valid.sealed_admission_policy,
        rotation_commitment_digest: digest("rotation-memory-missing"),
        suite_digest: digest("sealed-suite-memory-missing")
      }
    });
    await expect(store.recordResearchPreflightCommitment(missing)).rejects.toMatchObject({
      code: "research_preflight_commitment_memory_checkpoint_not_found"
    });

    const digestDrift = withCommitmentDigest({
      ...structuredClone(valid),
      research_preflight_commitment_id: "research-preflight-memory-drift",
      memory_policy: {
        ...structuredClone(valid.memory_policy!),
        prior_checkpoint: {
          disposition: "included",
          checkpoint_ref: {
            record_kind: "research_worker_checkpoint",
            id: first.research_worker_checkpoint_id
          },
          checkpoint_digest: digest("other-checkpoint")
        }
      },
      sealed_admission_policy: {
        ...valid.sealed_admission_policy,
        rotation_commitment_digest: digest("rotation-memory-drift"),
        suite_digest: digest("sealed-suite-memory-drift")
      }
    });
    await expect(store.recordResearchPreflightCommitment(digestDrift)).rejects.toMatchObject({
      code: "research_preflight_commitment_memory_checkpoint_mismatch"
    });

    await expect(persistCommitment(
      store,
      graph,
      "memory-before-close",
      11,
      1,
      memoryPolicy(validCheckpoint, "included"),
      5
    )).rejects.toMatchObject({
      code: "research_preflight_commitment_memory_checkpoint_mismatch",
      details: {
        mismatch_fields: expect.arrayContaining([
          "memory_policy.prior_checkpoint_closed_after_commitment"
        ])
      }
    });

    const foreignWorker: ResearchWorkerRecord = {
      ...graph.worker,
      research_worker_id: "research-worker-execution-cost-codex",
      research_direction_ref: {
        record_kind: "research_direction",
        id: graph.alternateDirection.research_direction_id
      },
      workspace_key:
        "candidate-arena-workers/research-worker-execution-cost-codex"
    };
    await store.recordResearchWorker(foreignWorker);
    const foreignGraph = {
      ...graph,
      direction: graph.alternateDirection,
      worker: foreignWorker
    };
    const foreignCommitment = await persistCommitment(
      store,
      foreignGraph,
      "memory-foreign-checkpoint",
      12,
      1
    );
    const foreignCheckpoint = failedCheckpoint(foreignGraph, foreignCommitment, {
      closedAt: "2026-07-12T12:10:00.000Z",
      reason: "execution_failed"
    });
    await store.recordResearchWorkerCheckpoint(foreignCheckpoint);
    await expect(persistCommitment(
      store,
      graph,
      "memory-foreign-reference",
      13,
      1,
      memoryPolicy(foreignCheckpoint, "included")
    )).rejects.toMatchObject({
      code: "research_preflight_commitment_memory_checkpoint_mismatch",
      details: {
        mismatch_fields: expect.arrayContaining([
          "memory_policy.prior_checkpoint_worker",
          "memory_policy.prior_checkpoint_direction",
          "memory_policy.prior_checkpoint_not_immediate"
        ])
      }
    });
  });

  it("rejects malformed, digest-drifted, and same-ID-mutated checkpoints", async () => {
    const graph = await persistWorkerGraph(store);
    const commitment = await persistCommitment(store, graph, "integrity", 10, 1);
    const checkpoint = failedCheckpoint(graph, commitment, {
      closedAt: "2026-07-12T10:10:00.000Z",
      reason: "execution_failed"
    });

    const malformed = structuredClone(checkpoint) as any;
    malformed.development_budget.remaining_submission_authority = 1;
    await expect(store.recordResearchWorkerCheckpoint(malformed)).rejects.toMatchObject({
      code: "invalid_research_worker_checkpoint_input"
    });

    const digestDrift = { ...checkpoint, checkpoint_digest: digest("drift") };
    await expect(store.recordResearchWorkerCheckpoint(digestDrift)).rejects.toMatchObject({
      code: "research_worker_checkpoint_digest_mismatch"
    });

    await store.recordResearchWorkerCheckpoint(checkpoint);
    const changed = withCheckpointDigest({
      ...structuredClone(checkpoint),
      terminal_reason: "restart_recovery"
    });
    await expect(store.recordResearchWorkerCheckpoint(changed)).rejects.toMatchObject({
      code: "research_worker_checkpoint_conflict"
    });
  });

  it("rejects historical workers and checkpoint graph identity drift", async () => {
    const graph = await persistWorkerGraph(store);
    const commitment = await persistCommitment(store, graph, "graph", 10, 1);
    const cases: Array<{
      label: string;
      code: string;
      mutate(record: ResearchWorkerCheckpointRecord): void;
    }> = [
      {
        label: "missing worker",
        code: "research_worker_checkpoint_reference_not_found",
        mutate: (record) => { record.research_worker_ref.id = "missing-worker"; }
      },
      {
        label: "missing direction",
        code: "research_worker_checkpoint_reference_not_found",
        mutate: (record) => { record.research_direction_ref.id = "missing-direction"; }
      },
      {
        label: "missing commitment",
        code: "research_worker_checkpoint_reference_not_found",
        mutate: (record) => { record.research_preflight_commitment_ref.id = "missing-preflight"; }
      },
      {
        label: "commitment digest",
        code: "research_worker_checkpoint_graph_mismatch",
        mutate: (record) => {
          record.research_preflight_commitment_digest = digest("other-commitment");
        }
      },
      {
        label: "direction",
        code: "research_worker_checkpoint_graph_mismatch",
        mutate: (record) => {
          record.research_direction_ref.id = graph.alternateDirection.research_direction_id;
        }
      },
      {
        label: "tick",
        code: "research_worker_checkpoint_graph_mismatch",
        mutate: (record) => { record.candidate_arena_tick_id = "tick-other"; }
      },
      {
        label: "workspace",
        code: "research_worker_checkpoint_graph_mismatch",
        mutate: (record) => {
          record.workspace_key = "candidate-arena-workers/research-worker-other";
        }
      },
      {
        label: "submission limit",
        code: "research_worker_checkpoint_graph_mismatch",
        mutate: (record) => {
          record.development_budget.submission_limit = 2;
          record.development_budget.cumulative_committed_submission_limit = 2;
        }
      },
      {
        label: "closed before commitment",
        code: "research_worker_checkpoint_graph_mismatch",
        mutate: (record) => { record.closed_at = "2026-07-12T09:59:59.999Z"; }
      }
    ];
    for (const [index, testCase] of cases.entries()) {
      const changed = failedCheckpoint(graph, commitment, {
        closedAt: "2026-07-12T10:10:00.000Z",
        reason: "execution_failed"
      });
      changed.research_worker_checkpoint_id += `-${index}`;
      testCase.mutate(changed);
      withCheckpointDigest(changed);
      await expect(store.recordResearchWorkerCheckpoint(changed), testCase.label)
        .rejects.toMatchObject({ code: testCase.code });
    }

    const historicalWorker: ResearchWorkerRecord = {
      ...graph.worker,
      research_worker_id: "research-worker-historical"
    };
    delete historicalWorker.agent_profile_id;
    delete historicalWorker.workspace_key;
    delete historicalWorker.lifecycle_protocol;
    await store.recordResearchWorker(historicalWorker);
    const historicalCommitment = await persistCommitment(store, {
      ...graph,
      worker: historicalWorker
    }, "historical", 12, 1);
    const historicalCheckpoint = failedCheckpoint({
      ...graph,
      worker: historicalWorker
    }, historicalCommitment, {
      closedAt: "2026-07-12T12:10:00.000Z",
      reason: "restart_recovery"
    });
    historicalCheckpoint.workspace_key =
      "candidate-arena-workers/research-worker-historical";
    withCheckpointDigest(historicalCheckpoint);
    await expect(store.recordResearchWorkerCheckpoint(historicalCheckpoint)).rejects.toMatchObject({
      code: "research_worker_checkpoint_lifecycle_required"
    });
  });

  it("rejects missing, forked, and arithmetically discontinuous previous checkpoints", async () => {
    const graph = await persistWorkerGraph(store);
    const firstCommitment = await persistCommitment(store, graph, "chain-first", 10, 1);
    const first = failedCheckpoint(graph, firstCommitment, {
      closedAt: "2026-07-12T10:10:00.000Z",
      reason: "execution_failed"
    });
    await store.recordResearchWorkerCheckpoint(first);
    const secondCommitment = await persistCommitment(store, graph, "chain-second", 11, 1);

    const noPrevious = failedCheckpoint(graph, secondCommitment, {
      closedAt: "2026-07-12T11:10:00.000Z",
      reason: "restart_recovery",
      cumulativeCommitted: 1
    });
    await expect(store.recordResearchWorkerCheckpoint(noPrevious)).rejects.toMatchObject({
      code: "research_worker_checkpoint_previous_mismatch"
    });

    const wrongPrevious = failedCheckpoint(graph, secondCommitment, {
      closedAt: "2026-07-12T11:10:00.000Z",
      reason: "restart_recovery",
      previous: first,
      cumulativeCommitted: 2
    });
    wrongPrevious.previous_checkpoint_digest = digest("wrong-previous");
    withCheckpointDigest(wrongPrevious);
    await expect(store.recordResearchWorkerCheckpoint(wrongPrevious)).rejects.toMatchObject({
      code: "research_worker_checkpoint_previous_mismatch"
    });

    const badBudget = failedCheckpoint(graph, secondCommitment, {
      closedAt: "2026-07-12T11:10:00.000Z",
      reason: "restart_recovery",
      previous: first,
      cumulativeCommitted: 3
    });
    await expect(store.recordResearchWorkerCheckpoint(badBudget)).rejects.toMatchObject({
      code: "research_worker_checkpoint_budget_mismatch"
    });
  });

  it("requires a completed checkpoint to bind the exact commitment admission", async () => {
    const graph = await persistWorkerGraph(store);
    const commitment = await persistCommitment(store, graph, "admission", 10, 1);
    const admission = await persistAdmission(store, graph, commitment, 10);
    const checkpoint = completedCheckpoint(graph, commitment, undefined, admission);

    const missing = structuredClone(checkpoint);
    missing.candidate_admission_decision_ref!.id = "missing-admission";
    withCheckpointDigest(missing);
    await expect(store.recordResearchWorkerCheckpoint(missing)).rejects.toMatchObject({
      code: "research_worker_checkpoint_reference_not_found"
    });

    const foreignCommitment = await persistCommitment(store, graph, "foreign", 11, 1);
    const foreignAdmission = await persistAdmission(store, graph, foreignCommitment, 11);
    const mismatched = structuredClone(checkpoint);
    mismatched.candidate_admission_decision_ref!.id =
      foreignAdmission.candidate_admission_decision_id;
    withCheckpointDigest(mismatched);
    await expect(store.recordResearchWorkerCheckpoint(mismatched)).rejects.toMatchObject({
      code: "research_worker_checkpoint_graph_mismatch"
    });
  });

  it("persists exact sanitized evidence across restart", async () => {
    const graph = await persistWorkerGraph(store);
    const priorCommitment = await persistCommitment(
      store,
      graph,
      "evidence-prior",
      10,
      1
    );
    const priorAdmission = await persistAdmission(
      store,
      graph,
      priorCommitment,
      10
    );
    await store.recordResearchWorkerCheckpoint(completedCheckpoint(
      graph,
      priorCommitment,
      undefined,
      priorAdmission
    ));
    const finding = (await store.listResearchFindings()).find((entry) =>
      entry.research_finding_id === priorAdmission.research_finding_ref.id
    )!;
    const artifact = findingEvidenceArtifact(finding);

    await expect(store.recordResearchEvidenceArtifact(artifact))
      .resolves.toEqual(artifact);
    await expect(store.recordResearchEvidenceArtifact(artifact))
      .resolves.toEqual(artifact);

    await expect(store.listResearchEvidenceArtifacts()).resolves.toEqual([artifact]);

    const restarted = new LocalStore(storeRoot);
    await restarted.initialize();
    await expect(restarted.getResearchEvidenceArtifact(
      artifact.research_evidence_artifact_id
    )).resolves.toEqual(artifact);

    await expect(store.recordResearchEvidenceArtifact({
      ...artifact,
      artifact_digest: digest("drift")
    })).rejects.toMatchObject({
      code: "research_evidence_artifact_digest_mismatch"
    });

    const wrongSource = {
      ...artifact,
      research_evidence_artifact_id: `${artifact.research_evidence_artifact_id}-wrong`,
      source_digest: digest("wrong-source")
    };
    wrongSource.artifact_digest = exactDigest(
      researchEvidenceArtifactDigestInput(wrongSource)
    );
    await expect(store.recordResearchEvidenceArtifact(wrongSource))
      .rejects.toMatchObject({
        code: "research_evidence_artifact_source_mismatch"
      });

    const unsafeSummary = {
      ...artifact,
      research_evidence_artifact_id: `${artifact.research_evidence_artifact_id}-unsafe`,
      summary: "/Users/private/research token=secret-value"
    };
    unsafeSummary.artifact_digest = exactDigest(
      researchEvidenceArtifactDigestInput(unsafeSummary)
    );
    await expect(store.recordResearchEvidenceArtifact(unsafeSummary))
      .rejects.toMatchObject({
        code: "invalid_research_evidence_artifact_input"
      });

    const inventedSummaryAlias = {
      ...artifact,
      research_evidence_artifact_id:
        `${artifact.research_evidence_artifact_id}-invented`,
      summary: "Safe-looking but source-unbound Research instruction."
    };
    inventedSummaryAlias.artifact_digest = exactDigest(
      researchEvidenceArtifactDigestInput(inventedSummaryAlias)
    );
    await expect(store.recordResearchEvidenceArtifact(inventedSummaryAlias))
      .rejects.toMatchObject({
        code: "research_evidence_artifact_alias_conflict"
      });

    const contenders = [
      eventAllocation("event-claim-a", artifact, "2026-07-12T10:11:00.000Z"),
      eventAllocation("event-claim-b", artifact, "2026-07-12T10:11:01.000Z")
    ];
    const claims = await Promise.allSettled([
      store.recordCandidateArenaResearchAllocation(contenders[0]!),
      new LocalStore(storeRoot).recordCandidateArenaResearchAllocation(
        contenders[1]!
      )
    ]);
    expect(claims.filter((claim) => claim.status === "fulfilled"))
      .toHaveLength(1);
    expect(claims.filter((claim) => claim.status === "rejected"))
      .toEqual([expect.objectContaining({
        reason: expect.objectContaining({
          code:
            "candidate_arena_research_allocation_trigger_claim_conflict"
        })
      })]);
  });
});

interface WorkerGraph {
  direction: ResearchDirectionRecord;
  alternateDirection: ResearchDirectionRecord;
  worker: ResearchWorkerRecord;
  source: SystemCodeRecord;
}

async function persistWorkerGraph(store: LocalStore): Promise<WorkerGraph> {
  const direction: ResearchDirectionRecord = {
    record_kind: "research_direction",
    version: 1,
    research_direction_id: "research-direction-trend-following",
    direction_kind: "trend_following",
    market_scope: "external_trading_api_fixture",
    prompt_seed: "Explore robust trend behavior without prescribing an implementation.",
    diversity_axis: "trend_following",
    created_at: "2026-07-12T09:00:00.000Z",
    authority_status: "research_seed_only"
  };
  const alternateDirection: ResearchDirectionRecord = {
    ...direction,
    research_direction_id: "research-direction-execution-cost",
    direction_kind: "execution_cost_robustness",
    prompt_seed: "Explore execution-cost robustness without prescribing an implementation.",
    diversity_axis: "execution_cost_robustness"
  };
  const worker: ResearchWorkerRecord = {
    record_kind: "research_worker",
    version: 1,
    research_worker_id: "research-worker-trend-codex",
    display_name: "Trend following ResearchWorker",
    model: "gpt-5",
    provider_kind: "codex_cli",
    agent_profile_id: "managed-agent-codex-research",
    research_direction_ref: { record_kind: "research_direction", id: direction.research_direction_id },
    workspace_key: "candidate-arena-workers/research-worker-trend-codex",
    lifecycle_protocol: "research_worker_checkpoint_v1",
    created_at: "2026-07-12T09:00:00.000Z",
    status: "active",
    authority_status: "research_only"
  };
  const source = systemCodeFixture(
    "source-system-code",
    digest("source-system-code"),
    "2026-07-12T09:00:00.000Z"
  );
  await store.recordResearchDirection(direction);
  await store.recordResearchDirection(alternateDirection);
  await store.recordResearchWorker(worker);
  await store.recordSystemCode(source);
  return { direction, alternateDirection, worker, source };
}

async function persistCommitment(
  store: LocalStore,
  graph: WorkerGraph,
  suffix: string,
  hour: number,
  submissionLimit: number,
  memoryPolicyInput?: ResearchWorkerMemoryPolicy,
  committedMinute = 1
): Promise<ResearchPreflightCommitmentRecord> {
  const at = (minute: number) =>
    `2026-07-12T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
  const allocation = allocationFixture(suffix, graph.direction.direction_kind, submissionLimit, at(0));
  await store.recordCandidateArenaResearchAllocation(allocation);
  const commitment = commitmentFixture({
    graph,
    allocation,
    suffix,
    committedAt: at(committedMinute),
    submissionLimit,
    memoryPolicyInput
  });
  await store.recordResearchPreflightCommitment(commitment);
  return commitment;
}

function commitmentFixture(input: {
  graph: WorkerGraph;
  allocation: CandidateArenaResearchAllocationRecord;
  suffix: string;
  committedAt: string;
  submissionLimit: number;
  memoryPolicyInput?: ResearchWorkerMemoryPolicy;
}): ResearchPreflightCommitmentRecord {
  const commitment: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: `research-preflight-${input.suffix}`,
    candidate_arena_tick_id: input.allocation.tick_id,
    research_direction_ref: {
      record_kind: "research_direction",
      id: input.graph.direction.research_direction_id
    },
    research_worker_ref: {
      record_kind: "research_worker",
      id: input.graph.worker.research_worker_id
    },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: input.allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: input.allocation.allocation_digest,
    source_system_code_ref: {
      record_kind: "system_code",
      id: input.graph.source.system_code_id
    },
    source_artifact_digest: input.graph.source.artifact_digest,
    ...(input.memoryPolicyInput
      ? { memory_policy: structuredClone(input.memoryPolicyInput) }
      : {}),
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: digest("development-suite"),
      submission_limit: input.submissionLimit,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest(`rotation-${input.suffix}`),
      suite_digest: digest(`sealed-suite-${input.suffix}`),
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: input.committedAt,
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("pending")
  };
  commitment.commitment_digest = exactDigest(researchPreflightCommitmentDigestInput(commitment));
  return commitment;
}

function memoryPolicy(
  checkpoint: ResearchWorkerCheckpointRecord,
  disposition: "included" | "masked"
): ResearchWorkerMemoryPolicy {
  return {
    protocol_version: "research_worker_memory_v1",
    memory_mode: disposition === "included"
      ? "released_memory"
      : "memory_masked",
    memory_source_digest: digest("memory-source"),
    available_memory_item_count: 1,
    arena_context_digest: digest(`arena-context-${disposition}`),
    prior_checkpoint: {
      disposition,
      checkpoint_ref: {
        record_kind: "research_worker_checkpoint",
        id: checkpoint.research_worker_checkpoint_id
      },
      checkpoint_digest: checkpoint.checkpoint_digest
    }
  };
}

function allocationFixture(
  suffix: string,
  directionKind: ResearchDirectionRecord["direction_kind"],
  experimentBudget: number,
  allocatedAt: string
): CandidateArenaResearchAllocationRecord {
  const otherDirections: CandidateArenaResearchAllocationRecord["deferred_directions"] = [
    "trend_following",
    "mean_reversion",
    "volatility_regime",
    "funding_aware_risk",
    "execution_cost_robustness"
  ].filter((candidate) => candidate !== directionKind) as
    CandidateArenaResearchAllocationRecord["deferred_directions"];
  const allocation: CandidateArenaResearchAllocationRecord = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id: `allocation-${suffix}`,
    tick_id: `tick-${suffix}`,
    allocation_mode: "explicit",
    allocation_policy_basis: { basis_kind: "explicit_request" },
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: [],
    signal_snapshot: [],
    selected_directions: [{
      direction_kind: directionKind,
      selection_kind: "explicit",
      priority: 1,
      experiment_budget: experimentBudget,
      signal_score: 0,
      reasons: ["test_explicit_direction"]
    }],
    deferred_directions: otherDirections,
    allocated_at: allocatedAt,
    allocation_digest: digest("pending"),
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  allocation.allocation_digest = exactDigest(candidateArenaResearchAllocationDigestInput(allocation));
  return allocation;
}

function eventAllocation(
  suffix: string,
  artifact: ResearchEvidenceArtifactRecord,
  at: string
): CandidateArenaResearchAllocationRecord {
  const allocation = allocationFixture(
    suffix,
    "trend_following",
    1,
    at
  );
  allocation.trigger = {
    trigger_kind: "arena_event",
    trigger_id: `trigger-${suffix}`,
    goal: "Consume one exact Arena evidence event.",
    triggered_at: at,
    source_ref: { ...artifact.artifact_ref },
    evidence_artifact_ref: {
      record_kind: "research_evidence_artifact",
      id: artifact.research_evidence_artifact_id
    },
    evidence_artifact_digest: artifact.artifact_digest,
    authority_status: "research_only"
  };
  allocation.allocation_digest = exactDigest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
  return allocation;
}

function failedCheckpoint(
  graph: WorkerGraph,
  commitment: ResearchPreflightCommitmentRecord,
  input: {
    closedAt: string;
    reason: "execution_failed" | "restart_recovery";
    previous?: ResearchWorkerCheckpointRecord;
    cumulativeCommitted?: number;
  }
): ResearchWorkerCheckpointRecord {
  return withCheckpointDigest({
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id:
      `research-worker-checkpoint-${commitment.research_preflight_commitment_id}`,
    research_worker_ref: { record_kind: "research_worker", id: graph.worker.research_worker_id },
    research_direction_ref: {
      record_kind: "research_direction",
      id: graph.direction.research_direction_id
    },
    candidate_arena_tick_id: commitment.candidate_arena_tick_id,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: commitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: commitment.commitment_digest,
    workspace_key: graph.worker.workspace_key ?? "candidate-arena-workers/missing",
    ...(input.previous
      ? {
          previous_checkpoint_ref: {
            record_kind: "research_worker_checkpoint",
            id: input.previous.research_worker_checkpoint_id
          },
          previous_checkpoint_digest: input.previous.checkpoint_digest
        }
      : {}),
    development_budget: {
      submission_limit: commitment.development_policy.submission_limit,
      recorded_submission_count: 0,
      cumulative_committed_submission_limit: input.cumulativeCommitted ??
        commitment.development_policy.submission_limit,
      cumulative_recorded_submission_count:
        input.previous?.development_budget.cumulative_recorded_submission_count ?? 0,
      remaining_submission_authority: 0
    },
    notebook: input.previous?.notebook ?? {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: 0,
      recent_entries: []
    },
    terminal_status: "failed_closed",
    terminal_reason: input.reason,
    closed_at: input.closedAt,
    checkpoint_digest: digest("pending"),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  });
}

function completedCheckpoint(
  graph: WorkerGraph,
  commitment: ResearchPreflightCommitmentRecord,
  previous: ResearchWorkerCheckpointRecord | undefined,
  admission: CandidateAdmissionDecisionRecord
): ResearchWorkerCheckpointRecord {
  const previousCommitted = previous?.development_budget.cumulative_committed_submission_limit ?? 0;
  const previousRecorded = previous?.development_budget.cumulative_recorded_submission_count ?? 0;
  const sequence = previousRecorded + 1;
  return withCheckpointDigest({
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id:
      `research-worker-checkpoint-${commitment.research_preflight_commitment_id}`,
    research_worker_ref: { record_kind: "research_worker", id: graph.worker.research_worker_id },
    research_direction_ref: {
      record_kind: "research_direction",
      id: graph.direction.research_direction_id
    },
    candidate_arena_tick_id: commitment.candidate_arena_tick_id,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: commitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: commitment.commitment_digest,
    workspace_key: graph.worker.workspace_key ?? "candidate-arena-workers/missing",
    ...(previous
      ? {
          previous_checkpoint_ref: {
            record_kind: "research_worker_checkpoint",
            id: previous.research_worker_checkpoint_id
          },
          previous_checkpoint_digest: previous.checkpoint_digest
        }
      : {}),
    development_budget: {
      submission_limit: commitment.development_policy.submission_limit,
      recorded_submission_count: 1,
      cumulative_committed_submission_limit:
        previousCommitted + commitment.development_policy.submission_limit,
      cumulative_recorded_submission_count: sequence,
      remaining_submission_authority: 0
    },
    notebook: {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: sequence,
      recent_entries: [
        ...(previous?.notebook.recent_entries ?? []),
        {
          sequence,
          candidate_arena_tick_id: commitment.candidate_arena_tick_id,
          iteration: 1,
          decision: "crash" as const,
          agent_status: "failed" as const,
          score: 0,
          summary: "Development worker failed and the candidate was quarantined.",
          evaluation_status: "disqualified" as const,
          risk_decision: "no_order_request" as const,
          net_revenue_usdt: 0
        }
      ].slice(-6)
    },
    terminal_status: "completed",
    terminal_reason: "admission_recorded",
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: admission.candidate_admission_decision_id
    },
    closed_at: admission.decided_at,
    checkpoint_digest: digest("pending"),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  });
}

async function persistAdmission(
  store: LocalStore,
  graph: WorkerGraph,
  commitment: ResearchPreflightCommitmentRecord,
  hour: number
): Promise<CandidateAdmissionDecisionRecord> {
  const at = (minute: number) =>
    `2026-07-12T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
  const submitted = systemCodeFixture(
    `submitted-${commitment.research_preflight_commitment_id}`,
    digest(`submitted-${commitment.research_preflight_commitment_id}`),
    at(2)
  );
  await store.recordSystemCode(submitted);
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-${commitment.research_preflight_commitment_id}`,
    research_worker_ref: { ...commitment.research_worker_ref },
    research_direction_ref: { ...commitment.research_direction_ref },
    system_code_ref: { record_kind: "system_code", id: submitted.system_code_id },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "candidate-arena-revenue-cost-v1"
    },
    trace_ref: { record_kind: "trace_placeholder", id: `trace-${commitment.research_preflight_commitment_id}` },
    submitted_at: at(3),
    status: "failed",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: `evaluation-${commitment.research_preflight_commitment_id}`,
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    evaluator_ref: { record_kind: "external_evaluator", id: "arena-evaluator-v1" },
    result_status: "disqualified",
    evidence_disposition: "quarantined_for_review",
    score_summary: {
      total_score: 0,
      oos_score: 0,
      drawdown_score: 0,
      turnover_score: 0,
      cost_survival_score: 0,
      reproducibility_score: 0,
      complexity_penalty: 0
    },
    metric_refs: [],
    evaluator_trace_ref: {
      record_kind: "trace_placeholder",
      id: `evaluator-trace-${commitment.research_preflight_commitment_id}`
    },
    disqualification_reason: "research_worker_failed",
    completed_at: at(4),
    authority_status: "not_counted"
  };
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `finding-${commitment.research_preflight_commitment_id}`,
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    finding_kind: "failure_analysis",
    summary: "ResearchWorker failed before artifact execution.",
    supporting_record_refs: [{
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    }],
    created_at: at(5),
    authority_status: "research_trace_only"
  };
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  await store.recordResearchFinding(finding);
  const input = {
    research_worker_outcome: "changed" as const,
    experiment_status: "failed" as const,
    evaluation_status: "disqualified" as const,
    evidence_disposition: "quarantined_for_review" as const
  };
  const admission: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: `admission-${commitment.research_preflight_commitment_id}`,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: commitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: commitment.commitment_digest,
    source_system_code_ref: { record_kind: "system_code", id: graph.source.system_code_id },
    system_code_ref: { record_kind: "system_code", id: submitted.system_code_id },
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    research_finding_ref: { record_kind: "research_finding", id: finding.research_finding_id },
    source_artifact_digest: graph.source.artifact_digest,
    submitted_artifact_digest: submitted.artifact_digest,
    ...input,
    ...decideCandidateAdmission(input),
    decided_at: at(6),
    authority_status: "not_live"
  };
  await store.recordCandidateAdmissionDecision(admission);
  return admission;
}

function findingEvidenceArtifact(
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
    source_digest: exactDigest(
      paperTradingComparisonPersistedRecordDigestInput(finding)
    ),
    summary: canonicalResearchEvidenceArtifactSummary(
      "research_finding",
      finding
    ),
    supporting_record_refs: structuredClone(finding.supporting_record_refs),
    captured_at: finding.created_at,
    sanitization_policy: "research_evidence_sanitization_v1",
    sanitization_status: "sanitized",
    qualification_evidence_hidden: true,
    secrets_removed: true,
    host_paths_removed: true,
    truncated: false,
    artifact_digest: digest("pending"),
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.artifact_digest = exactDigest(
    researchEvidenceArtifactDigestInput(record)
  );
  return record;
}

function systemCodeFixture(id: string, artifactDigest: string, createdAt: string): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: id,
    artifact_kind: "python_file",
    artifact_path: `/tmp/${id}.py`,
    artifact_digest: artifactDigest,
    runtime_kind: "python",
    entrypoint: ["python3", `/tmp/${id}.py`],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "research-only" },
    provenance_refs: [],
    status: "registered",
    created_at: createdAt,
    authority_status: "not_live"
  };
}

function withCheckpointDigest<T extends ResearchWorkerCheckpointRecord>(record: T): T {
  record.checkpoint_digest = exactDigest(researchWorkerCheckpointDigestInput(record));
  return record;
}

function withCommitmentDigest<T extends ResearchPreflightCommitmentRecord>(record: T): T {
  record.commitment_digest = exactDigest(
    researchPreflightCommitmentDigestInput(record)
  );
  return record;
}

function digest(value: string): string {
  return exactDigest(value);
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
