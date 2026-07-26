import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS,
  candidateArenaResearchAllocationDigestInput,
  candidateEgressAttestationDigestInput,
  candidateEgressNetworkPolicyDigestInput,
  paperTradingHandoffConformanceDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonSystemCodeRecordDigestInput,
  researchEvidenceArtifactDigestInput,
  researchAllocationPolicyDecisionDigestInput,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyOutcomeDigestInput,
  researchGeneralizationOutcomeDigestInput,
  researchGeneralizationProtocolDigestInput,
  researchGeneralizationPolicyDecisionDigestInput,
  researchBehaviorFingerprintDigestInput,
  researchMemoryControlStudyDigestInput,
  researchPreflightCommitmentDigestInput,
  researchWorkerCheckpointDigestInput
} from "@ouroboros/domain";
import type {
  ArtifactLineageRecord,
  CandidateAdmissionDecisionRecord,
  CandidateInspectReadModel,
  CandidateArenaResearchAllocationRecord,
  CandidateArenaTickRecord,
  CandidateEgressAttestation,
  ExperimentRunRecord,
  PaperTradingHandoffConformanceRecord,
  ResearchDirectionKind,
  ResearchDirectionRecord,
  ResearchEvidenceArtifactRecord,
  ResearchFindingRecord,
  ResearchAllocationPolicyDecisionRecord,
  ResearchBehaviorFingerprintRecord,
  ResearchControlStudyOutcomeRecord,
  ResearchControlStudyRecord,
  ResearchGeneralizationOutcomeBlockResult,
  ResearchGeneralizationOutcomeRecord,
  ResearchGeneralizationPolicyDecisionRecord,
  ResearchGeneralizationProtocolRecord,
  ResearchMemoryControlStudyRecord,
  ResearchPreflightCommitmentRecord,
  ResearchSessionDetailReadModel,
  ResearchWorkerCheckpointNotebookEntry,
  ResearchWorkerCheckpointRecord,
  ResearchWorkerRecord,
  SystemCodeRecord,
  TradingEvaluationResultRecord
} from "@ouroboros/domain";
import type { CandidateArenaRunnerHealthReadModel } from "../candidate/arena";
import { decideResearchAllocationPolicyDecision } from
  "../candidate/research-allocation-policy-decision";
import { decideResearchControlStudy } from "../candidate/research-control-study";
import { researchControlStudyOutcomeId } from
  "../candidate/research-control-study-outcome";
import { decideResearchGeneralizationProtocol } from
  "../candidate/research-generalization-protocol";
import { researchGeneralizationOutcomeId } from
  "../candidate/research-generalization-outcome";
import { decideResearchGeneralizationPolicyDecision } from
  "../candidate/research-generalization-policy-decision";
import { decideResearchMemoryControlStudy } from
  "../candidate/research-memory-control-study";
import { researchWorkItemId } from "../candidate/research-work-item";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";
import { ResearchOperationsProjectionService } from "./research-operations";

describe("ResearchOperationsProjectionService", () => {
  it("returns an authoritative empty projection", async () => {
    const fixture = graphFixture();
    fixture.directions.push(direction("trend_following"));

    await expect(fixture.service.readOperations()).resolves.toEqual({
      projection_kind: "research_operations",
      availability: "available",
      loop_status: "stopped",
      capacity: {
        max_concurrent_sessions: 2,
        active_session_count: 0,
        queued_session_count: 0
      },
      sessions: [],
      recorded_session_count: 0,
      projected_session_count: 0,
      omitted_session_count: 0,
      sessions_truncated: false,
      authority_status: "research_only"
    });
  });

  it("uses one supplied Arena evidence snapshot without rereading the store", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("shared-snapshot", [
      "trend_following"
    ]);
    const allocationReads = vi.spyOn(
      fixture.store,
      "listCandidateArenaResearchAllocations"
    );
    const tickReads = vi.spyOn(fixture.store, "listCandidateArenaTicks");

    const result = await fixture.service.readOperations({
      allocations: [allocation],
      ticks: []
    });

    expect(result.sessions).toHaveLength(1);
    expect(allocationReads).not.toHaveBeenCalled();
    expect(tickReads).not.toHaveBeenCalled();
  });

  it("projects two exact active entries and queues only the unstarted third selection", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("active", [
      "trend_following",
      "mean_reversion",
      "volatility_regime"
    ]);
    const running = fixture.addCommitment(allocation, "mean_reversion");
    fixture.health = runningHealth(allocation.tick_id, [{
      allocation,
      direction_kind: "trend_following",
      phase: "allocating"
    }, {
      allocation,
      direction_kind: "mean_reversion",
      phase: "running",
      commitment_id: running.research_preflight_commitment_id
    }]);

    const result = await fixture.service.readOperations();

    expect(result.capacity).toEqual({
      max_concurrent_sessions: 2,
      active_session_count: 2,
      queued_session_count: 1
    });
    expect(result.sessions.map((entry) => [entry.direction_kind, entry.status])).toEqual([
      ["mean_reversion", "running"],
      ["trend_following", "allocating"],
      ["volatility_regime", "queued"]
    ]);
    expect(result.sessions).toHaveLength(3);
    expect(result.sessions.find((entry) => entry.direction_kind === "mean_reversion"))
      .toMatchObject({ provider: "codex_cli" });
    expect(result.sessions.map((entry) => String(entry.status)))
      .not.toContain("awaiting_selection");
    expect(result.sessions.map((entry) => String(entry.status)))
      .not.toContain("sealed_admission");
  });

  it("does not apply active-tick state to an older orphan", async () => {
    const fixture = graphFixture();
    const older = fixture.addAllocation("older", ["trend_following"], -86_400_000);
    fixture.addCommitment(older, "trend_following");
    const active = fixture.addAllocation("active", ["mean_reversion"]);
    const commitment = fixture.addCommitment(active, "mean_reversion");
    fixture.health = runningHealth(active.tick_id, [{
      allocation: active,
      direction_kind: "mean_reversion",
      phase: "running",
      commitment_id: commitment.research_preflight_commitment_id
    }]);

    const result = await fixture.service.readOperations();

    expect(result.sessions.map((entry) => ({
      id: entry.research_allocation_id,
      status: entry.status,
      basis: entry.status_basis.basis_kind,
      degraded: entry.degraded_reasons
    }))).toEqual([{
      id: active.candidate_arena_research_allocation_id,
      status: "running",
      basis: "runtime_research_work_item",
      degraded: []
    }, {
      id: older.candidate_arena_research_allocation_id,
      status: "recovering",
      basis: "incomplete_persisted_graph",
      degraded: ["inactive_incomplete_graph"]
    }]);
  });

  it("projects active pre-commit failure as failed closed pending terminal tick", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("runtime-precommit-failure", ["other"]);
    fixture.health = runningHealth(allocation.tick_id, [{
      allocation,
      direction_kind: "other",
      phase: "failed_closed_pending_tick"
    }]);

    const result = await fixture.service.readOperations();

    expect(result.loop_status).toBe("degraded");
    expect(result.sessions[0]).toMatchObject({
      status: "failed_closed",
      status_basis: { basis_kind: "runtime_research_work_item" },
      latest_progress_summary: "Research failed closed."
    });
  });

  it("gives admission, checkpoint, and terminal tick evidence precedence over runtime", async () => {
    const fixture = graphFixture();
    const admitted = fixture.addAllocation("admitted", ["trend_following"]);
    fixture.addTerminalGraph(admitted, "trend_following", "admitted");
    const duplicate = fixture.addAllocation("duplicate", ["mean_reversion"], 1_000);
    fixture.addTerminalGraph(duplicate, "mean_reversion", "duplicate");
    const quarantined = fixture.addAllocation("quarantined", ["volatility_regime"], 2_000);
    const quarantinedGraph = fixture.addTerminalGraph(
      quarantined,
      "volatility_regime",
      "quarantined"
    );
    delete quarantinedGraph.admission.paper_handoff_conformance_status;
    delete quarantinedGraph.admission.paper_trading_handoff_conformance_ref;
    delete quarantinedGraph.admission.paper_trading_handoff_conformance_digest;
    fixture.conformances.splice(fixture.conformances.indexOf(quarantinedGraph.conformance), 1);
    delete fixture.ticks.at(-1)!.direction_results[0]!.paper_handoff_conformance;
    const finished = fixture.addAllocation("finished", ["funding_aware_risk"], 3_000);
    fixture.checkpoints.push(checkpoint(fixture,
      fixture.addCommitment(finished, "funding_aware_risk"),
      "finished_without_submission"
    ));
    const restart = fixture.addAllocation("restart", ["execution_cost_robustness"], 4_000);
    fixture.checkpoints.push(checkpoint(fixture,
      fixture.addCommitment(restart, "execution_cost_robustness"),
      "restart_recovery"
    ));
    const precommit = fixture.addAllocation("precommit", ["other"], 5_000);
    fixture.ticks.push(tick(precommit, [{
      direction_kind: "other",
      status: "failed",
      error: "raw provider failure at /Users/private-owner/run"
    }]));
    fixture.health = runningHealth(admitted.tick_id, [
      admitted,
      duplicate,
      quarantined,
      finished,
      restart,
      precommit
    ].map((allocation) => ({
      allocation,
      direction_kind: allocation.selected_directions[0]!.direction_kind,
      phase: "running" as const
    })));

    const result = await fixture.service.readOperations();
    const statuses = Object.fromEntries(result.sessions.map((entry) => [
      entry.research_allocation_id,
      entry.status
    ]));

    expect(statuses).toEqual({
      "allocation-precommit": "failed_closed",
      "allocation-restart": "failed_closed",
      "allocation-finished": "finished_without_submission",
      "allocation-quarantined": "quarantined",
      "allocation-duplicate": "duplicate",
      "allocation-admitted": "admitted"
    });
    expect(JSON.stringify(result)).not.toContain("raw provider failure");
    expect(JSON.stringify(result)).not.toContain("private-owner");
  });

  it("keeps an exact admission terminal when a lower-precedence tick conflicts", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("admission-over-tick-conflict", [
      "trend_following"
    ]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const conflictingTick = structuredClone(fixture.ticks[0]!);
    conflictingTick.candidate_arena_tick_id =
      `${conflictingTick.candidate_arena_tick_id}-conflict`;
    fixture.ticks.push(conflictingTick);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      status: "admitted",
      status_basis: {
        basis_kind: "candidate_admission_decision",
        source_ref: { id: graph.admission.candidate_admission_decision_id }
      },
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"]),
      terminal_graph: {
        admission: {
          candidate_admission_decision_ref: {
            id: graph.admission.candidate_admission_decision_id
          },
          status: "admitted"
        }
      }
    });
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("explicitly degrades a legacy graph with two admission decision owners", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "duplicate-admission-graph",
      ["trend_following"]
    );
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    fixture.admissions.push({
      ...structuredClone(graph.admission),
      candidate_admission_decision_id: "legacy-second-admission-owner"
    });

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      status: "recovering",
      projection_health: "degraded",
      selected_artifact_availability: "unavailable",
      degraded_reasons: expect.arrayContaining([
        "admission_graph_conflict",
        "selected_artifact_unavailable",
        "terminal_admission_unavailable",
        "inactive_incomplete_graph"
      ])
    });
    expect(detail).not.toHaveProperty("admission_decision_ref");
    expect(detail?.terminal_graph).not.toHaveProperty("admission");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("does not erase a malformed second raw admission owner", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "malformed-duplicate-admission-graph",
      ["trend_following"]
    );
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const malformedOwner = {
      ...structuredClone(graph.admission),
      candidate_admission_decision_id: "legacy-malformed-second-admission-owner",
      research_preflight_commitment_digest: digest("wrong-commitment-owner")
    };
    fixture.admissions.push(malformedOwner);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      status: "recovering",
      projection_health: "degraded",
      selected_artifact_availability: "unavailable",
      degraded_reasons: expect.arrayContaining([
        "admission_graph_conflict",
        "selected_artifact_unavailable",
        "terminal_admission_unavailable",
        "inactive_incomplete_graph"
      ])
    });
    expect(detail).not.toHaveProperty("admission_decision_ref");
    expect(detail?.terminal_graph).not.toHaveProperty("admission");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("fails both independent terminal graphs closed when they share one admission ID", async () => {
    const fixture = graphFixture();
    const earlierAllocation = fixture.addAllocation(
      "shared-admission-id-earlier",
      ["trend_following"],
      -1_000
    );
    const earlier = fixture.addTerminalGraph(
      earlierAllocation,
      "trend_following",
      "admitted"
    );
    const laterAllocation = fixture.addAllocation(
      "shared-admission-id-later",
      ["mean_reversion"]
    );
    const later = fixture.addTerminalGraph(
      laterAllocation,
      "mean_reversion",
      "admitted"
    );
    later.admission.candidate_admission_decision_id =
      earlier.admission.candidate_admission_decision_id;
    fixture.ticks.at(-1)!.direction_results[0]!.admission_decision_id =
      earlier.admission.candidate_admission_decision_id;

    const details = await Promise.all([
      fixture.service.readSessionDetail(workId(earlierAllocation, "trend_following")),
      fixture.service.readSessionDetail(workId(laterAllocation, "mean_reversion"))
    ]);

    for (const detail of details) {
      expect(detail).toMatchObject({
        status: "recovering",
        projection_health: "degraded",
        selected_artifact_availability: "unavailable",
        degraded_reasons: expect.arrayContaining([
          "admission_graph_conflict",
          "selected_artifact_unavailable",
          "terminal_admission_unavailable",
          "inactive_incomplete_graph"
        ])
      });
      expect(detail).not.toHaveProperty("admission_decision_ref");
      expect(detail?.terminal_graph).not.toHaveProperty("admission");
      expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    }
  });

  it("fails both graphs closed when commitments share one Evaluation ID", async () => {
    const fixture = graphFixture();
    const admittedAllocation = fixture.addAllocation(
      "shared-evaluation-id-admitted",
      ["trend_following"],
      -1_000
    );
    const admitted = fixture.addTerminalGraph(
      admittedAllocation,
      "trend_following",
      "admitted"
    );
    const orphanAllocation = fixture.addAllocation(
      "shared-evaluation-id-orphan",
      ["mean_reversion"]
    );
    const orphan = fixture.addTerminalGraph(
      orphanAllocation,
      "mean_reversion",
      "admitted"
    );
    orphan.evaluation.trading_evaluation_result_id =
      admitted.evaluation.trading_evaluation_result_id;
    fixture.admissions.splice(fixture.admissions.indexOf(orphan.admission), 1);

    const details = await Promise.all([
      fixture.service.readSessionDetail(workId(admittedAllocation, "trend_following")),
      fixture.service.readSessionDetail(workId(orphanAllocation, "mean_reversion"))
    ]);

    for (const detail of details) {
      expect(detail).toMatchObject({
        status: "recovering",
        projection_health: "degraded",
        selected_artifact_availability: "unavailable",
        degraded_reasons: expect.arrayContaining([
          "evaluation_graph_conflict",
          "selected_artifact_unavailable",
          "inactive_incomplete_graph"
        ])
      });
      expect(detail).not.toHaveProperty("admission_decision_ref");
      expect(detail?.terminal_graph).not.toHaveProperty("selected_sealed_evaluation");
      expect(detail?.terminal_graph).not.toHaveProperty("admission");
      expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    }
  });

  it("orders newest-first with a stable identity tie-break and returns exact detail only", async () => {
    const fixture = graphFixture();
    const old = fixture.addAllocation("z-old", ["trend_following"], -86_400_000);
    const b = fixture.addAllocation("b-new", ["mean_reversion"]);
    const a = fixture.addAllocation("a-new", ["volatility_regime"]);

    const operations = await fixture.service.readOperations();
    const detail = await fixture.service.readSessionDetail(workId(a, "volatility_regime"));

    expect(operations.sessions.map((entry) => entry.research_allocation_id)).toEqual([
      a.candidate_arena_research_allocation_id,
      b.candidate_arena_research_allocation_id,
      old.candidate_arena_research_allocation_id
    ]);
    expect(detail).toMatchObject({
      research_work_item_id: workId(a, "volatility_regime"),
      provider_logs_availability: "not_persisted",
      terminal_graph: { authority_status: "read_only" }
    });
    await expect(fixture.service.readSessionDetail("research-session-v1-missing"))
      .resolves.toBeUndefined();
  });

  it("bounds a 365-session summary while resolving an omitted exact detail directly", async () => {
    const fixture = graphFixture();
    const sessionCount = 365;
    let oldest:
      | CandidateArenaResearchAllocationRecord
      | undefined;
    for (let index = 0; index < sessionCount; index += 1) {
      const allocation = fixture.addAllocation(
        `year-${String(index).padStart(3, "0")}`,
        ["trend_following"],
        index * 86_400_000
      );
      fixture.addCommitment(
        allocation,
        "trend_following",
        `worker-year-${String(index).padStart(3, "0")}`
      );
      oldest ??= allocation;
    }
    const systemCodeReads = vi.spyOn(fixture.store, "getSystemCode");

    const summaryStartedAt = Date.now();
    const operations = await fixture.service.readOperations();
    const summaryElapsedMs = Date.now() - summaryStartedAt;
    const summaryPayloadBytes = Buffer.byteLength(JSON.stringify(operations), "utf8");

    expect(operations).toMatchObject({
      recorded_session_count: 365,
      projected_session_count: 100,
      omitted_session_count: 265,
      sessions_truncated: true
    });
    expect(operations.sessions).toHaveLength(100);
    expect(operations.sessions.at(-1)?.research_allocation_id).toBe("allocation-year-265");
    expect(operations.sessions.some((entry) =>
      entry.research_allocation_id === oldest!.candidate_arena_research_allocation_id
    )).toBe(false);
    expect(summaryPayloadBytes).toBeLessThan(250_000);
    expect(summaryElapsedMs).toBeLessThan(2_000);

    systemCodeReads.mockClear();
    const detailStartedAt = Date.now();
    const detail = await fixture.service.readSessionDetail(
      workId(oldest!, "trend_following")
    );
    const detailElapsedMs = Date.now() - detailStartedAt;

    expect(detail).toMatchObject({
      research_allocation_id: oldest!.candidate_arena_research_allocation_id,
      research_work_item_id: workId(oldest!, "trend_following")
    });
    expect(systemCodeReads).toHaveBeenCalledTimes(1);
    expect(detailElapsedMs).toBeLessThan(2_000);
  });

  it("does not let malformed future evidence displace the newest bounded sessions", async () => {
    const fixture = graphFixture();
    const poisoned = fixture.addAllocation(
      "future-poisoned-oldest",
      ["trend_following"]
    );
    const poisonedGraph = fixture.addTerminalGraph(
      poisoned,
      "trend_following",
      "admitted"
    );
    poisonedGraph.commitment.committed_at = "2097-01-01T00:00:00.000Z";
    poisonedGraph.commitment.commitment_digest = digest(
      researchPreflightCommitmentDigestInput(poisonedGraph.commitment)
    );
    poisonedGraph.evaluation.research_preflight_commitment_digest =
      poisonedGraph.commitment.commitment_digest;
    poisonedGraph.admission.research_preflight_commitment_digest =
      poisonedGraph.commitment.commitment_digest;
    fixture.systemCodes.delete(poisonedGraph.commitment.source_system_code_ref.id);
    poisonedGraph.evaluation.completed_at = "2099-01-01T00:00:00.000Z";
    poisonedGraph.evaluation.submitted_artifact_digest = digest("malformed-future-evaluation");
    const poisonedCheckpoint = checkpoint(
      fixture,
      poisonedGraph.commitment,
      "admission_recorded",
      [],
      0,
      0,
      poisonedGraph.admission.candidate_admission_decision_id
    );
    poisonedCheckpoint.closed_at = "2098-01-01T00:00:00.000Z";
    fixture.checkpoints.push(poisonedCheckpoint);
    for (let index = 1; index <= 100; index += 1) {
      fixture.addAllocation(
        `future-safe-${String(index).padStart(3, "0")}`,
        ["mean_reversion"],
        index * 86_400_000
      );
    }

    const operations = await fixture.service.readOperations();

    expect(operations.sessions).toHaveLength(100);
    expect(operations.sessions[0]?.research_allocation_id)
      .toBe("allocation-future-safe-100");
    expect(operations.sessions.at(-1)?.research_allocation_id)
      .toBe("allocation-future-safe-001");
    expect(operations.sessions.some((session) =>
      session.research_allocation_id === poisoned.candidate_arena_research_allocation_id
    )).toBe(false);
  });

  it("bounds mature fingerprinted history and loads artifacts only for projected or exact sessions", async () => {
    const fixture = graphFixture();
    let oldest:
      | CandidateArenaResearchAllocationRecord
      | undefined;
    for (let index = 0; index < 365; index += 1) {
      const suffix = `mature-year-${String(index).padStart(3, "0")}`;
      const allocation = fixture.addAllocation(
        suffix,
        ["trend_following"],
        index * 10_000
      );
      const graph = fixture.addTerminalGraph(
        allocation,
        "trend_following",
        "admitted",
        `worker-${suffix}`
      );
      graph.systemCode.created_at = after(graph.conformance.completed_at, 100);
      const fingerprint = behaviorFingerprint(graph, suffix);
      fingerprint.created_at = after(graph.systemCode.created_at, 100);
      fingerprint.fingerprint_digest = digest(
        researchBehaviorFingerprintDigestInput(fingerprint)
      );
      fixture.fingerprints.push(fingerprint);
      bindBehaviorComparison(graph, fingerprint, "distinct");
      oldest ??= allocation;
    }
    const systemCodeReads = vi.spyOn(fixture.store, "getSystemCode");

    const operations = await fixture.service.readOperations();

    expect(operations).toMatchObject({
      recorded_session_count: 365,
      projected_session_count: 100,
      omitted_session_count: 265,
      sessions_truncated: true
    });
    expect(operations.sessions).toHaveLength(100);
    expect(operations.sessions.every((session) => session.status === "admitted")).toBe(true);
    expect(operations.sessions.at(0)?.research_allocation_id)
      .toBe("allocation-mature-year-364");
    expect(operations.sessions.at(-1)?.research_allocation_id)
      .toBe("allocation-mature-year-265");
    expect(systemCodeReads).toHaveBeenCalledTimes(200);

    systemCodeReads.mockClear();
    const detail = await fixture.service.readSessionDetail(
      workId(oldest!, "trend_following")
    );

    expect(detail).toMatchObject({
      research_allocation_id: oldest!.candidate_arena_research_allocation_id,
      status: "admitted",
      selected_artifact_availability: "available"
    });
    expect(systemCodeReads).toHaveBeenCalledTimes(2);
    expect(systemCodeReads.mock.calls.map(([id]) => id).sort()).toEqual([
      `selected-code-${oldest!.tick_id}`,
      `source-code-${oldest!.tick_id}`
    ]);
  }, 30_000);

  it("keeps healthy omitted admitted sessions terminal for stopped-loop health", async () => {
    const fixture = graphFixture();
    for (let index = 0; index < 101; index += 1) {
      const suffix = `healthy-omitted-${String(index).padStart(3, "0")}`;
      const allocation = fixture.addAllocation(
        suffix,
        ["trend_following"],
        index * 10_000
      );
      fixture.addTerminalGraph(
        allocation,
        "trend_following",
        "admitted",
        `worker-${suffix}`
      );
    }

    const operations = await fixture.service.readOperations();

    expect(operations).toMatchObject({
      loop_status: "stopped",
      capacity: {
        active_session_count: 0,
        queued_session_count: 0
      },
      recorded_session_count: 101,
      projected_session_count: 100,
      omitted_session_count: 1,
      sessions_truncated: true
    });
  });

  it("loads only the exact duplicate and its distinct owner from a same-key cohort", async () => {
    const fixture = graphFixture();
    const ownerAllocation = fixture.addAllocation(
      "same-key-owner",
      ["trend_following"]
    );
    const owner = fixture.addTerminalGraph(
      ownerAllocation,
      "trend_following",
      "admitted",
      "worker-same-key-owner"
    );
    owner.systemCode.created_at = after(owner.conformance.completed_at, 100);
    const ownerFingerprint = behaviorFingerprint(owner, "same-key-owner");
    ownerFingerprint.created_at = after(owner.systemCode.created_at, 100);
    ownerFingerprint.fingerprint_digest = digest(
      researchBehaviorFingerprintDigestInput(ownerFingerprint)
    );
    fixture.fingerprints.push(ownerFingerprint);
    bindBehaviorComparison(owner, ownerFingerprint, "distinct");

    let newest:
      | CandidateArenaResearchAllocationRecord
      | undefined;
    for (let index = 1; index <= 365; index += 1) {
      const suffix = `same-key-duplicate-${String(index).padStart(3, "0")}`;
      const allocation = fixture.addAllocation(
        suffix,
        ["trend_following"],
        index * 10_000
      );
      const graph = fixture.addTerminalGraph(
        allocation,
        "trend_following",
        "admitted",
        `worker-${suffix}`
      );
      graph.systemCode.created_at = after(graph.conformance.completed_at, 100);
      graph.commitment.development_policy.suite_digest =
        owner.commitment.development_policy.suite_digest;
      resealCommitmentGraph(graph);
      const fingerprint = behaviorFingerprint(graph, suffix);
      fingerprint.created_at = after(graph.systemCode.created_at, 100);
      fingerprint.fingerprint_digest = digest(
        researchBehaviorFingerprintDigestInput(fingerprint)
      );
      fixture.fingerprints.push(fingerprint);
      bindBehaviorComparison(graph, fingerprint, "duplicate", ownerFingerprint);
      newest = allocation;
    }
    const systemCodeReads = vi.spyOn(fixture.store, "getSystemCode");

    const operations = await fixture.service.readOperations();

    expect(operations).toMatchObject({
      recorded_session_count: 366,
      projected_session_count: 100,
      omitted_session_count: 266,
      sessions_truncated: true
    });
    expect(operations.sessions.every((session) => session.status === "duplicate")).toBe(true);
    expect(systemCodeReads).toHaveBeenCalledTimes(201);

    systemCodeReads.mockClear();
    const detail = await fixture.service.readSessionDetail(
      workId(newest!, "trend_following")
    );

    expect(detail).toMatchObject({
      research_allocation_id: newest!.candidate_arena_research_allocation_id,
      status: "duplicate",
      selected_artifact_availability: "available"
    });
    expect(systemCodeReads).toHaveBeenCalledTimes(3);
  }, 30_000);

  it("keeps off-page active capacity while bounding the visible session page", async () => {
    const fixture = graphFixture();
    const active = fixture.addAllocation("off-page-active", ["trend_following"]);
    const commitment = fixture.addCommitment(active, "trend_following");
    for (let index = 0; index < 100; index += 1) {
      fixture.addAllocation(
        `newer-page-${String(index).padStart(3, "0")}`,
        ["mean_reversion"],
        (index + 1) * 1_000
      );
    }
    fixture.health = runningHealth(active.tick_id, [{
      allocation: active,
      direction_kind: "trend_following",
      phase: "running",
      commitment_id: commitment.research_preflight_commitment_id
    }]);

    const operations = await fixture.service.readOperations();

    expect(operations.sessions).toHaveLength(100);
    expect(operations.sessions.some((entry) =>
      entry.research_allocation_id === active.candidate_arena_research_allocation_id
    )).toBe(false);
    expect(operations).toMatchObject({
      loop_status: "degraded",
      capacity: {
        active_session_count: 1,
        queued_session_count: 0
      },
      recorded_session_count: 101,
      projected_session_count: 100,
      omitted_session_count: 1,
      sessions_truncated: true
    });
  });

  it("keeps corrupt off-page terminal evidence degraded without hiding active capacity", async () => {
    const fixture = graphFixture();
    const active = fixture.addAllocation(
      "off-page-corrupt-terminal",
      ["trend_following"]
    );
    const commitment = fixture.addCommitment(active, "trend_following");
    const corruptTick = tick(active, [{
      direction_kind: "trend_following",
      status: "no_submission",
      finding: "Research finished without a selection."
    }]);
    corruptTick.research_allocation_digest = digest("wrong-off-page-allocation");
    fixture.ticks.push(corruptTick);
    for (let index = 1; index <= 100; index += 1) {
      const allocation = fixture.addAllocation(
        `off-page-terminal-${String(index).padStart(3, "0")}`,
        ["mean_reversion"],
        index * 86_400_000
      );
      fixture.addTerminalGraph(
        allocation,
        "mean_reversion",
        "admitted",
        `worker-off-page-terminal-${index}`
      );
    }
    fixture.health = runningHealth(active.tick_id, [{
      allocation: active,
      direction_kind: "trend_following",
      phase: "running",
      commitment_id: commitment.research_preflight_commitment_id
    }]);

    const operations = await fixture.service.readOperations();

    expect(operations.sessions).toHaveLength(100);
    expect(operations.sessions.some((session) =>
      session.research_allocation_id === active.candidate_arena_research_allocation_id
    )).toBe(false);
    expect(operations).toMatchObject({
      loop_status: "degraded",
      capacity: {
        active_session_count: 1,
        queued_session_count: 0
      }
    });
  });

  it("fails closed for each malformed single-record terminal graph beyond the session page", async () => {
    const cases: Array<{
      suffix: string;
      mutate(
        graph: TerminalFixture,
        fixture: Fixture,
        allocation: CandidateArenaResearchAllocationRecord
      ): void;
    }> = [{
      suffix: "evaluation",
      mutate: (graph) => {
        graph.evaluation.submitted_artifact_digest = digest("off-page-evaluation-mismatch");
      }
    }, {
      suffix: "admission",
      mutate: (graph) => {
        graph.admission.submitted_artifact_digest = digest("off-page-admission-mismatch");
      }
    }, {
      suffix: "conformance",
      mutate: (graph) => {
        graph.conformance.started_at = after(graph.commitment.committed_at, -1);
        graph.conformance.evidence_digest = digest(
          paperTradingHandoffConformanceDigestInput(graph.conformance)
        );
        graph.admission.paper_trading_handoff_conformance_digest =
          graph.conformance.evidence_digest;
      }
    }, {
      suffix: "tick-admission-status",
      mutate: (_graph, fixture, allocation) => {
        const tickIndex = fixture.ticks.findIndex((candidate) =>
          candidate.tick_id === allocation.tick_id
        );
        fixture.ticks[tickIndex] = tick(allocation, [{
          direction_kind: "trend_following",
          status: "failed",
          error: "Persisted admission recovery failed closed."
        }]);
      }
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const omitted = fixture.addAllocation(
        `off-page-single-${testCase.suffix}`,
        ["trend_following"]
      );
      const omittedGraph = fixture.addTerminalGraph(
        omitted,
        "trend_following",
        "admitted",
        `worker-off-page-single-${testCase.suffix}`
      );
      testCase.mutate(omittedGraph, fixture, omitted);
      for (let index = 1; index <= 100; index += 1) {
        const allocation = fixture.addAllocation(
          `off-page-single-${testCase.suffix}-${String(index).padStart(3, "0")}`,
          ["mean_reversion"],
          index * 10_000
        );
        fixture.addTerminalGraph(
          allocation,
          "mean_reversion",
          "admitted",
          `worker-off-page-single-${testCase.suffix}-${index}`
        );
      }
      const systemCodeReads = vi.spyOn(fixture.store, "getSystemCode");

      const operations = await fixture.service.readOperations();

      expect(operations.loop_status, testCase.suffix).toBe("degraded");
      expect(operations.sessions, testCase.suffix).toHaveLength(100);
      expect(operations.sessions.some((session) =>
        session.research_allocation_id === omitted.candidate_arena_research_allocation_id
      ), testCase.suffix).toBe(false);
      expect(systemCodeReads, testCase.suffix).toHaveBeenCalledTimes(200);
    }
  }, 30_000);

  it("returns an exact-detail miss after allocation lookup without loading the graph", async () => {
    const fixture = graphFixture();
    fixture.addAllocation("known-session", ["trend_following"]);
    const commitmentReads = vi.spyOn(
      fixture.store,
      "listResearchPreflightCommitments"
    );
    const evaluationReads = vi.spyOn(fixture.store, "listTradingEvaluationResults");
    const systemCodeReads = vi.spyOn(fixture.store, "getSystemCode");

    await expect(fixture.service.readSessionDetail("research-session-v1-missing"))
      .resolves.toBeUndefined();

    expect(commitmentReads).not.toHaveBeenCalled();
    expect(evaluationReads).not.toHaveBeenCalled();
    expect(systemCodeReads).not.toHaveBeenCalled();
  });

  it("keeps same-worker checkpoint sessions isolated and uses session iteration/count semantics", async () => {
    const fixture = graphFixture();
    const older = fixture.addAllocation("same-worker-old", ["trend_following"], -86_400_000);
    const oldCommitment = fixture.addCommitment(older, "trend_following", "worker-shared");
    fixture.checkpoints.push(checkpoint(
      fixture,
      oldCommitment,
      "finished_without_submission"
    ));
    const current = fixture.addAllocation("same-worker-new", ["trend_following"]);
    const graph = fixture.addTerminalGraph(
      current,
      "trend_following",
      "admitted",
      "worker-shared"
    );
    fixture.checkpoints.push(checkpoint(fixture, graph.commitment, "admission_recorded", [
      entry(graph.commitment.candidate_arena_tick_id, 1)
    ], 1, 1, graph.admission.candidate_admission_decision_id));

    const detail = await fixture.service.readSessionDetail(workId(current, "trend_following"));

    expect(detail).toMatchObject({
      submission_history_availability: "checkpoint_summary",
      recorded_submission_count: 1,
      projected_submission_count: 1,
      omitted_submission_count: 0,
      submission_history_truncated: false,
      selected_artifact_availability: "available",
      selected_submission_sequence: 1,
      development_submissions: [{
        submission_sequence: 1,
        selected: true,
        artifact_availability: "selected_system_code_available"
      }]
    });
    expect(JSON.stringify(detail)).not.toContain("iteration-99");
  });

  it("emits the admitted Arena handoff only for the complete exact accepted graph", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("terminal", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    graph.finding.summary = "Finding at /Users/private-owner/research Bearer finding-secret";

    const detail = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));

    expect(detail?.terminal_graph).toMatchObject({
      selected_sealed_evaluation: {
        trading_evaluation_result_ref: {
          record_kind: "trading_evaluation_result",
          id: graph.evaluation.trading_evaluation_result_id
        },
        result_status: "accepted",
        evidence_disposition: "not_counted"
      },
      admission: { status: "admitted", reason: "evaluation_accepted" },
      paper_handoff_conformance: { status: "passed", reason: "passed" },
      finding: {
        research_finding_ref: {
          record_kind: "research_finding",
          id: graph.finding.research_finding_id
        },
        summary: "Finding at [private-path] Bearer [redacted]"
      },
      artifact_lineage: {
        artifact_lineage_ref: {
          record_kind: "artifact_lineage",
          id: graph.lineage.artifact_lineage_id
        }
      },
      admitted_arena_handoff: {
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: "candidate-tick-terminal"
        }
      }
    });
    expect(detail?.lifecycle_events).toContainEqual(expect.objectContaining({
      event_kind: "tick",
      source_ref: {
        record_kind: "candidate_arena_tick",
        id: `candidate-arena-tick-${safeId(allocation.tick_id)}`
      }
    }));
  });

  it("keeps admission visible but suppresses candidate authority for missing or mismatched materialization", async () => {
    for (const condition of ["missing", "mismatched"] as const) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(
        `candidate-materialization-${condition}`,
        ["trend_following"]
      );
      fixture.addTerminalGraph(allocation, "trend_following", "admitted");
      const candidateId = `candidate-${allocation.tick_id}`;
      if (condition === "missing") {
        fixture.candidates.delete(candidateId);
      } else {
        fixture.candidates.get(candidateId)!.full_cycle_lineage!.generated!
          .artifact_digest = digest("mismatched-generated-artifact");
      }
      const candidateReads = vi.spyOn(fixture.store, "getCandidate");

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );

      expect(detail, condition).toMatchObject({
        status: "admitted",
        status_basis: { basis_kind: "candidate_admission_decision" },
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining(["terminal_admission_unavailable"]),
        terminal_graph: {
          admission: { status: "admitted", reason: "evaluation_accepted" }
        }
      });
      expect(detail, condition).not.toHaveProperty("admitted_candidate_id");
      expect(detail?.terminal_graph, condition)
        .not.toHaveProperty("admitted_arena_handoff");
      expect(candidateReads, condition).toHaveBeenCalledTimes(1);
      expect(candidateReads, condition).toHaveBeenCalledWith(candidateId);
    }
  });

  it("suppresses globally reused candidate claims across the page boundary with bounded loads", async () => {
    const fixture = graphFixture();
    const ownerAllocation = fixture.addAllocation(
      "candidate-claim-owner-off-page",
      ["trend_following"]
    );
    fixture.addTerminalGraph(ownerAllocation, "trend_following", "admitted");
    const reusedCandidateId = `candidate-${ownerAllocation.tick_id}`;
    let conflictingAllocation:
      | CandidateArenaResearchAllocationRecord
      | undefined;
    for (let index = 1; index <= 100; index += 1) {
      const suffix = `candidate-claim-page-${String(index).padStart(3, "0")}`;
      const allocation = fixture.addAllocation(
        suffix,
        ["trend_following"],
        index * 10_000
      );
      fixture.addTerminalGraph(
        allocation,
        "trend_following",
        "admitted",
        `worker-${suffix}`
      );
      if (index === 100) {
        const tickRecord = fixture.ticks.at(-1)!;
        tickRecord.direction_results[0]!.candidate_id = reusedCandidateId;
        tickRecord.created_candidate_refs = [
          ref("trading_system_candidate", reusedCandidateId)
        ];
        conflictingAllocation = allocation;
      }
    }
    const candidateReads = vi.spyOn(fixture.store, "getCandidate");

    const operations = await fixture.service.readOperations();

    expect(operations).toMatchObject({
      recorded_session_count: 101,
      projected_session_count: 100,
      omitted_session_count: 1,
      sessions_truncated: true
    });
    const conflictingSummary = operations.sessions.find((session) =>
      session.research_allocation_id ===
        conflictingAllocation!.candidate_arena_research_allocation_id
    );
    expect(conflictingSummary).toMatchObject({
      status: "admitted",
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["terminal_admission_unavailable"])
    });
    expect(conflictingSummary).not.toHaveProperty("admitted_candidate_id");
    expect(candidateReads).toHaveBeenCalledTimes(100);

    candidateReads.mockClear();
    const ownerDetail = await fixture.service.readSessionDetail(
      workId(ownerAllocation, "trend_following")
    );
    expect(ownerDetail).toMatchObject({
      status: "admitted",
      degraded_reasons: expect.arrayContaining(["terminal_admission_unavailable"])
    });
    expect(ownerDetail).not.toHaveProperty("admitted_candidate_id");
    expect(ownerDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    expect(candidateReads).toHaveBeenCalledTimes(1);

    candidateReads.mockClear();
    const conflictingDetail = await fixture.service.readSessionDetail(
      workId(conflictingAllocation!, "trend_following")
    );
    expect(conflictingDetail).toMatchObject({
      status: "admitted",
      degraded_reasons: expect.arrayContaining(["terminal_admission_unavailable"])
    });
    expect(conflictingDetail).not.toHaveProperty("admitted_candidate_id");
    expect(conflictingDetail?.terminal_graph)
      .not.toHaveProperty("admitted_arena_handoff");
    expect(candidateReads).toHaveBeenCalledTimes(1);
  });

  it("projects exact rejected handoff conformance for a quarantined decision", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("rejected-handoff", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    graph.conformance.status = "rejected";
    graph.conformance.reason = "paper_decision_missing";
    graph.conformance.provider_request_count = 0;
    delete graph.conformance.decision_event_kind;
    graph.conformance.heartbeat_count = 0;
    graph.conformance.runnable_paper_handoff = false;
    graph.conformance.evidence_digest = digest(
      paperTradingHandoffConformanceDigestInput(graph.conformance)
    );
    graph.admission.paper_handoff_conformance_status = "rejected";
    graph.admission.paper_trading_handoff_conformance_digest =
      graph.conformance.evidence_digest;
    graph.admission.status = "quarantined";
    graph.admission.reason = "paper_handoff_conformance_failed";
    graph.admission.runnable_paper_handoff = false;
    const tickRecord = fixture.ticks[0]!;
    const tickResult = tickRecord.direction_results[0]!;
    tickRecord.created_candidate_refs = [];
    tickResult.status = "quarantined";
    delete tickResult.candidate_id;
    tickResult.finding = graph.finding.summary;
    tickResult.admission_reason = graph.admission.reason;
    tickResult.paper_handoff_conformance = {
      conformance_id: graph.conformance.paper_trading_handoff_conformance_id,
      status: "rejected",
      reason: graph.conformance.reason,
      authority_status: "research_only"
    };

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      status: "quarantined",
      status_basis: { basis_kind: "candidate_admission_decision" },
      paper_handoff_conformance_ref: {
        id: graph.conformance.paper_trading_handoff_conformance_id
      },
      terminal_graph: {
        admission: {
          status: "quarantined",
          reason: "paper_handoff_conformance_failed"
        },
        paper_handoff_conformance: {
          status: "rejected",
          reason: "paper_decision_missing"
        }
      }
    });
    expect(detail?.lifecycle_events).toContainEqual(expect.objectContaining({
      event_kind: "handoff_conformance",
      source_ref: expect.objectContaining({
        id: graph.conformance.paper_trading_handoff_conformance_id
      })
    }));
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("rejects malformed evaluation, admission, and conformance digest/ref chains", async () => {
    const cases: Array<{
      suffix: string;
      mutate(graph: TerminalFixture): void;
      exactEvaluation?: boolean;
      commitmentUnavailable?: boolean;
    }> = [{
      suffix: "all-equal-malformed",
      mutate: (graph) => {
        graph.systemCode.artifact_digest = "not-a-digest";
        graph.evaluation.submitted_artifact_digest = "not-a-digest";
        graph.admission.submitted_artifact_digest = "not-a-digest";
        graph.admission.paper_trading_handoff_conformance_digest = "not-a-digest";
        graph.conformance.system_code_artifact_digest = "not-a-digest";
        graph.conformance.evidence_digest = "not-a-digest";
      }
    }, {
      suffix: "commitment-source-malformed",
      commitmentUnavailable: true,
      mutate: (graph) => {
        graph.commitment.source_artifact_digest = "not-a-digest";
        graph.sourceSystemCode.artifact_digest = "not-a-digest";
        graph.admission.source_artifact_digest = "not-a-digest";
      }
    }, {
      suffix: "suite-mismatch",
      mutate: (graph) => {
        graph.evaluation.sealed_admission_suite_digest = digest("other-suite");
      }
    }, {
      suffix: "task-mismatch",
      mutate: (graph) => {
        graph.evaluation.trading_evaluation_task_ref = ref(
          "trading_evaluation_task",
          "other-task"
        );
      }
    }, {
      suffix: "wrong-kind",
      mutate: (graph) => {
        graph.experiment.research_worker_ref = ref(
          "research_direction",
          graph.commitment.research_worker_ref.id
        );
      }
    }, {
      suffix: "conformance-digest",
      exactEvaluation: true,
      mutate: (graph) => {
        graph.admission.paper_trading_handoff_conformance_digest = "not-a-digest";
        graph.conformance.evidence_digest = "not-a-digest";
      }
    }, {
      suffix: "missing-artifact-path",
      mutate: (graph) => {
        delete (graph.systemCode as unknown as { artifact_path?: string }).artifact_path;
      }
    }, {
      suffix: "missing-output-contract",
      mutate: (graph) => {
        delete (graph.systemCode as unknown as {
          declared_output_contract?: SystemCodeRecord["declared_output_contract"];
        }).declared_output_contract;
      }
    }, {
      suffix: "wrong-evaluator-kind",
      mutate: (graph) => {
        graph.evaluation.evaluator_ref = ref("evaluator", "wrong-kind");
      }
    }, {
      suffix: "wrong-trace-kind",
      mutate: (graph) => {
        graph.evaluation.evaluator_trace_ref = ref("trace", "wrong-kind");
      }
    }, {
      suffix: "wrong-metric-kind",
      mutate: (graph) => {
        graph.evaluation.metric_refs = [ref("research_finding", "wrong-kind")];
      }
    }, {
      suffix: "malformed-score",
      mutate: (graph) => {
        graph.evaluation.score_summary.total_score = Number.NaN;
      }
    }, {
      suffix: "malformed-reason",
      mutate: (graph) => {
        graph.evaluation.disqualification_reason = "invented_reason" as
          NonNullable<TradingEvaluationResultRecord["disqualification_reason"]>;
      }
    }, {
      suffix: "python-with-image-ref",
      mutate: (graph) => {
        (graph.systemCode as unknown as { image_ref?: string }).image_ref = "image:latest";
      }
    }, {
      suffix: "output-contract-extra-key",
      mutate: (graph) => {
        (graph.systemCode.declared_output_contract as unknown as { extra?: boolean }).extra = true;
      }
    }, {
      suffix: "duplicate-output-kind",
      mutate: (graph) => {
        graph.systemCode.declared_output_contract.declared_output_kinds = [
          "order_request",
          "order_request"
        ];
      }
    }, {
      suffix: "invalid-artifact-ref",
      mutate: (graph) => {
        graph.systemCode.artifact_ref = ref("system_code", "/private/unsafe");
      }
    }, {
      suffix: "wrong-sandbox-ref",
      mutate: (graph) => {
        graph.experiment.sandbox_ref = ref("research_worker", "wrong-kind");
      }
    }, {
      suffix: "wrong-experiment-trace-ref",
      mutate: (graph) => {
        graph.experiment.trace_ref = ref("trace", "wrong-kind");
      }
    }, {
      suffix: "invalid-runtime-trace-ref",
      mutate: (graph) => {
        graph.experiment.runtime_trace_refs = [ref("trace_placeholder", "/private/unsafe")];
      }
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, ["trend_following"]);
      const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
      testCase.mutate(graph);

      const detail = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));

      expect(detail?.selected_artifact_availability, testCase.suffix).toBe(
        testCase.commitmentUnavailable ? "not_selected" : "unavailable"
      );
      expect(detail?.terminal_graph, testCase.suffix).not.toHaveProperty("admitted_arena_handoff");
      if (!testCase.exactEvaluation) {
        expect(detail?.degraded_reasons, testCase.suffix).toEqual(
          expect.arrayContaining(testCase.commitmentUnavailable
            ? ["inactive_incomplete_graph"]
            : ["selected_artifact_unavailable", "inactive_incomplete_graph"])
        );
        expect(detail?.terminal_graph, testCase.suffix).not.toHaveProperty(
          "selected_sealed_evaluation"
        );
        expect(detail?.budget.completed_experiment_count, testCase.suffix).toBe(0);
        expect(detail?.lifecycle_events.map((event) => event.event_kind), testCase.suffix)
          .not.toContain("evaluation");
      } else {
        expect(detail?.degraded_reasons, testCase.suffix)
          .toContain("selected_artifact_unavailable");
        expect(detail?.terminal_graph, testCase.suffix)
          .toHaveProperty("selected_sealed_evaluation");
      }
    }
  });

  it("gives a pre-commit Evaluation zero terminal authority", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("evaluation-before-commitment", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    graph.evaluation.completed_at = after(graph.commitment.committed_at, -1);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      budget: { completed_experiment_count: 0 },
      selected_artifact_availability: "unavailable",
      degraded_reasons: expect.arrayContaining([
        "selected_artifact_unavailable",
        "inactive_incomplete_graph"
      ])
    });
    expect(detail?.status).not.toBe("admitted");
    expect(detail?.terminal_graph).not.toHaveProperty("selected_sealed_evaluation");
    expect(detail?.terminal_graph).not.toHaveProperty("admission");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("gives writer-incompatible terminal chronology zero selected-artifact authority", async () => {
    const cases: Array<{
      suffix: string;
      mutate(graph: TerminalFixture): void;
    }> = [{
      suffix: "experiment-before-commitment",
      mutate: (graph) => {
        graph.experiment.submitted_at = after(graph.commitment.committed_at, -1);
      }
    }, {
      suffix: "conformance-before-experiment",
      mutate: (graph) => {
        graph.conformance.started_at = after(graph.experiment.submitted_at, -1);
        graph.conformance.evidence_digest = digest(
          paperTradingHandoffConformanceDigestInput(graph.conformance)
        );
        graph.admission.paper_trading_handoff_conformance_digest =
          graph.conformance.evidence_digest;
      }
    }, {
      suffix: "evaluation-before-conformance-completion",
      mutate: (graph) => {
        graph.evaluation.completed_at = after(graph.conformance.completed_at, -1);
      }
    }, {
      suffix: "selected-code-before-conformance-completion",
      mutate: (graph) => {
        graph.systemCode.created_at = after(graph.conformance.completed_at, -1);
      }
    }, {
      suffix: "selected-code-before-commitment",
      mutate: (graph) => {
        graph.systemCode.created_at = after(graph.commitment.committed_at, -1);
      }
    }, {
      suffix: "selected-code-after-evaluation",
      mutate: (graph) => {
        graph.systemCode.created_at = after(graph.evaluation.completed_at, 1);
      }
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, ["trend_following"]);
      const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
      testCase.mutate(graph);

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );

      expect(detail?.selected_artifact_availability, testCase.suffix).toBe("unavailable");
      expect(detail?.status, testCase.suffix).not.toBe("admitted");
      expect(detail?.terminal_graph, testCase.suffix)
        .not.toHaveProperty("admitted_arena_handoff");
    }
  });

  it("omits terminal Finding and lineage records that predate their writer inputs", async () => {
    const findingFixture = graphFixture();
    const findingAllocation = findingFixture.addAllocation(
      "finding-before-evaluation",
      ["trend_following"]
    );
    const findingGraph = findingFixture.addTerminalGraph(
      findingAllocation,
      "trend_following",
      "admitted"
    );
    findingGraph.finding.created_at = after(findingGraph.evaluation.completed_at, -1);

    const findingDetail = await findingFixture.service.readSessionDetail(
      workId(findingAllocation, "trend_following")
    );

    expect(findingDetail?.selected_artifact_availability).toBe("unavailable");
    expect(findingDetail?.terminal_graph).not.toHaveProperty("finding");
    expect(findingDetail?.terminal_graph).not.toHaveProperty("admission");
    expect(findingDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");

    const lineageFixture = graphFixture();
    const lineageAllocation = lineageFixture.addAllocation(
      "lineage-before-writer-inputs",
      ["trend_following"]
    );
    const lineageGraph = lineageFixture.addTerminalGraph(
      lineageAllocation,
      "trend_following",
      "admitted"
    );
    lineageGraph.lineage.created_at = after(lineageGraph.finding.created_at, -1);

    const lineageDetail = await lineageFixture.service.readSessionDetail(
      workId(lineageAllocation, "trend_following")
    );

    expect(lineageDetail?.terminal_graph).not.toHaveProperty("artifact_lineage");
  });

  it("fails the whole terminal graph closed for a malformed second raw Evaluation", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("ambiguous-raw-evaluation", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const malformed = structuredClone(graph.evaluation);
    malformed.trading_evaluation_result_id = "evaluation-ambiguous-raw-sibling";
    malformed.submitted_artifact_digest = "malformed-second-terminal";
    malformed.completed_at = after(graph.commitment.committed_at, -1);
    fixture.evaluations.push(malformed);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"]),
      budget: { completed_experiment_count: 0 },
      selected_artifact_availability: "unavailable"
    });
    expect(detail?.status).not.toBe("admitted");
    expect(detail).not.toHaveProperty("selected_submission_sequence");
    expect(detail).not.toHaveProperty("selected_system_code_ref");
    expect(detail).not.toHaveProperty("selected_system_code_artifact_digest");
    expect(detail).not.toHaveProperty("admission_decision_ref");
    expect(detail).not.toHaveProperty("paper_handoff_conformance_ref");
    expect(detail).not.toHaveProperty("admitted_candidate_id");
    expect(detail?.terminal_graph).not.toHaveProperty("selected_sealed_evaluation");
    expect(detail?.terminal_graph).not.toHaveProperty("admission");
    expect(detail?.terminal_graph).not.toHaveProperty("finding");
    expect(detail?.terminal_graph).not.toHaveProperty("paper_handoff_conformance");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    expect(detail?.lifecycle_events.map((event) => event.event_kind)).not.toEqual(
      expect.arrayContaining(["evaluation", "handoff_conformance", "admission"])
    );
  });

  it("gives pre-commit and pre-Evaluation admissions zero status authority", async () => {
    const cases: Array<{
      suffix: string;
      mutate(graph: TerminalFixture): void;
    }> = [{
      suffix: "admission-before-commitment",
      mutate: (graph) => {
        graph.admission.decided_at = after(graph.commitment.committed_at, -1);
      }
    }, {
      suffix: "admission-before-evaluation",
      mutate: (graph) => {
        graph.conformance.completed_at = after(graph.evaluation.completed_at, -1_000);
        graph.conformance.evidence_digest = digest(
          paperTradingHandoffConformanceDigestInput(graph.conformance)
        );
        graph.admission.paper_trading_handoff_conformance_digest =
          graph.conformance.evidence_digest;
        graph.admission.decided_at = after(graph.evaluation.completed_at, -1);
      }
    }];
    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, ["trend_following"]);
      const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
      testCase.mutate(graph);

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );
      expect(detail?.status, testCase.suffix).not.toBe("admitted");
      expect(detail?.terminal_graph, testCase.suffix).not.toHaveProperty("admission");
      expect(detail?.terminal_graph, testCase.suffix)
        .not.toHaveProperty("admitted_arena_handoff");
    }
  });

  it("gives an admitted decision before exact conformance zero status authority", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("admission-before-conformance", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    graph.conformance.completed_at = after(graph.evaluation.completed_at, 1_000);
    graph.conformance.evidence_digest = digest(
      paperTradingHandoffConformanceDigestInput(graph.conformance)
    );
    graph.admission.paper_trading_handoff_conformance_digest = graph.conformance.evidence_digest;
    graph.admission.decided_at = graph.evaluation.completed_at;

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(Date.parse(graph.admission.decided_at)).toBeLessThan(
      Date.parse(graph.conformance.completed_at)
    );
    expect(detail?.status).not.toBe("admitted");
    expect(detail?.terminal_graph).not.toHaveProperty("admission");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("denies materialization authority when its tick predates exact terminal evidence", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "materialization-before-terminal-evidence",
      ["trend_following"]
    );
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const materializationTick = fixture.ticks[0]!;
    materializationTick.completed_at = after(graph.commitment.committed_at, 500);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(Date.parse(materializationTick.completed_at)).toBeGreaterThan(
      Date.parse(graph.commitment.committed_at)
    );
    expect(Date.parse(materializationTick.completed_at)).toBeLessThan(
      Date.parse(graph.evaluation.completed_at)
    );
    expect(detail).toMatchObject({
      status: "admitted",
      status_basis: { basis_kind: "candidate_admission_decision" },
      completed_at: graph.admission.decided_at,
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["terminal_admission_unavailable"]),
      terminal_graph: { admission: { status: "admitted" } }
    });
    expect(detail).not.toHaveProperty("admitted_candidate_id");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("requires the commitment and agreeing checkpoint inside the handoff tick window", async () => {
    const lateStartFixture = graphFixture();
    const lateStartAllocation = lateStartFixture.addAllocation(
      "materialization-after-commitment-start",
      ["trend_following"]
    );
    const lateStartGraph = lateStartFixture.addTerminalGraph(
      lateStartAllocation,
      "trend_following",
      "admitted"
    );
    lateStartFixture.ticks[0]!.started_at = after(
      lateStartGraph.commitment.committed_at,
      1
    );

    const lateStartDetail = await lateStartFixture.service.readSessionDetail(
      workId(lateStartAllocation, "trend_following")
    );

    expect(lateStartDetail).toMatchObject({
      status: "admitted",
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["terminal_admission_unavailable"])
    });
    expect(lateStartDetail).not.toHaveProperty("admitted_candidate_id");
    expect(lateStartDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");

    const checkpointFixture = graphFixture();
    const checkpointAllocation = checkpointFixture.addAllocation(
      "materialization-before-checkpoint",
      ["trend_following"]
    );
    const checkpointGraph = checkpointFixture.addTerminalGraph(
      checkpointAllocation,
      "trend_following",
      "admitted"
    );
    const agreeingCheckpoint = checkpoint(
      checkpointFixture,
      checkpointGraph.commitment,
      "admission_recorded",
      [entry(checkpointGraph.commitment.candidate_arena_tick_id, 1)],
      1,
      1,
      checkpointGraph.admission.candidate_admission_decision_id
    );
    checkpointFixture.checkpoints.push(agreeingCheckpoint);

    const checkpointDetail = await checkpointFixture.service.readSessionDetail(
      workId(checkpointAllocation, "trend_following")
    );

    expect(Date.parse(checkpointFixture.ticks[0]!.completed_at)).toBeLessThan(
      Date.parse(agreeingCheckpoint.closed_at)
    );
    expect(checkpointDetail).toMatchObject({
      status: "admitted",
      completed_at: agreeingCheckpoint.closed_at,
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["terminal_admission_unavailable"])
    });
    expect(checkpointDetail).not.toHaveProperty("admitted_candidate_id");
    expect(checkpointDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("preserves writer-valid equality at every terminal chronology boundary", async () => {
    const evaluationFixture = graphFixture();
    const evaluationAllocation = evaluationFixture.addAllocation(
      "evaluation-equals-commitment",
      ["trend_following"]
    );
    const evaluationGraph = evaluationFixture.addTerminalGraph(
      evaluationAllocation,
      "trend_following",
      "admitted"
    );
    const equalityAt = evaluationGraph.commitment.committed_at;
    evaluationGraph.experiment.submitted_at = equalityAt;
    evaluationGraph.conformance.started_at = equalityAt;
    evaluationGraph.conformance.completed_at = equalityAt;
    evaluationGraph.conformance.evidence_digest = digest(
      paperTradingHandoffConformanceDigestInput(evaluationGraph.conformance)
    );
    evaluationGraph.systemCode.created_at = equalityAt;
    evaluationGraph.evaluation.completed_at = equalityAt;
    evaluationGraph.admission.paper_trading_handoff_conformance_digest =
      evaluationGraph.conformance.evidence_digest;
    evaluationGraph.admission.decided_at = equalityAt;
    evaluationGraph.finding.created_at = equalityAt;
    evaluationGraph.lineage.created_at = equalityAt;
    expect((await evaluationFixture.service.readSessionDetail(
      workId(evaluationAllocation, "trend_following")
    ))?.status).toBe("admitted");

    const admittedFixture = graphFixture();
    const admittedAllocation = admittedFixture.addAllocation(
      "admission-equals-terminal-evidence",
      ["trend_following"]
    );
    const admittedGraph = admittedFixture.addTerminalGraph(
      admittedAllocation,
      "trend_following",
      "admitted"
    );
    admittedGraph.evaluation.completed_at = admittedGraph.conformance.completed_at;
    admittedGraph.systemCode.created_at = admittedGraph.conformance.completed_at;
    admittedGraph.admission.decided_at = admittedGraph.conformance.completed_at;
    admittedGraph.finding.created_at = admittedGraph.conformance.completed_at;
    admittedGraph.lineage.created_at = admittedGraph.conformance.completed_at;
    admittedFixture.ticks[0]!.started_at = admittedGraph.commitment.committed_at;
    admittedFixture.ticks[0]!.completed_at = admittedGraph.conformance.completed_at;
    const equalityCheckpoint = checkpoint(
      admittedFixture,
      admittedGraph.commitment,
      "admission_recorded",
      [entry(admittedGraph.commitment.candidate_arena_tick_id, 1)],
      1,
      1,
      admittedGraph.admission.candidate_admission_decision_id
    );
    equalityCheckpoint.closed_at = admittedGraph.conformance.completed_at;
    equalityCheckpoint.checkpoint_digest = digest(
      researchWorkerCheckpointDigestInput(equalityCheckpoint)
    );
    admittedFixture.checkpoints.push(equalityCheckpoint);
    expect((await admittedFixture.service.readSessionDetail(
      workId(admittedAllocation, "trend_following")
    ))).toMatchObject({
      status: "admitted",
      completed_at: admittedGraph.conformance.completed_at,
      admitted_candidate_id: `candidate-${admittedAllocation.tick_id}`,
      terminal_graph: {
        admitted_arena_handoff: {
          completed_at: admittedGraph.conformance.completed_at
        }
      }
    });

    const duplicateFixture = graphFixture();
    const duplicateAllocation = duplicateFixture.addAllocation(
      "admission-equals-commitment",
      ["trend_following"]
    );
    const duplicateGraph = duplicateFixture.addTerminalGraph(
      duplicateAllocation,
      "trend_following",
      "duplicate"
    );
    duplicateGraph.evaluation.completed_at = duplicateGraph.conformance.completed_at;
    duplicateGraph.systemCode.created_at = duplicateGraph.conformance.completed_at;
    duplicateGraph.admission.decided_at = duplicateGraph.conformance.completed_at;
    duplicateGraph.finding.created_at = duplicateGraph.conformance.completed_at;
    duplicateGraph.lineage.created_at = duplicateGraph.conformance.completed_at;
    expect((await duplicateFixture.service.readSessionDetail(
      workId(duplicateAllocation, "trend_following")
    ))?.status).toBe("duplicate");
  });

  it("rejects non-canonical passed conformance before selected or handoff authority", async () => {
    const cases: Array<{
      suffix: string;
      mutate(record: PaperTradingHandoffConformanceRecord): void;
    }> = [{
      suffix: "passed-request-count",
      mutate: (record) => { record.provider_request_count = 2; }
    }, {
      suffix: "passed-decision",
      mutate: (record) => { delete record.decision_event_kind; }
    }, {
      suffix: "passed-runtime-stop",
      mutate: (record) => { record.runtime_stopped = false; }
    }, {
      suffix: "passed-time-order",
      mutate: (record) => { record.completed_at = after(record.started_at, -1); }
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, ["trend_following"]);
      const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
      testCase.mutate(graph.conformance);

      const detail = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));

      expect(detail, testCase.suffix).toMatchObject({
        selected_artifact_availability: "unavailable",
        degraded_reasons: expect.arrayContaining(["selected_artifact_unavailable"])
      });
      expect(detail?.terminal_graph, testCase.suffix).toHaveProperty("selected_sealed_evaluation");
      expect(detail?.terminal_graph, testCase.suffix).not.toHaveProperty("admitted_arena_handoff");
    }
  });

  it("requires exact v2 compact egress attestation agreement and forbids it for v1", async () => {
    const cases: Array<{
      suffix: string;
      version: 1 | 2;
      mutate(result: CandidateArenaTickRecord["direction_results"][number]): void;
      handoff: boolean;
    }> = [{
      suffix: "v2-exact",
      version: 2,
      mutate: () => {},
      handoff: true
    }, {
      suffix: "v2-absent",
      version: 2,
      mutate: (result) => { delete result.paper_handoff_conformance!
        .candidate_egress_attestation; },
      handoff: false
    }, {
      suffix: "v2-mismatch",
      version: 2,
      mutate: (result) => {
        result.paper_handoff_conformance!.candidate_egress_attestation!
          .network_policy_digest = digest("wrong-policy");
      },
      handoff: false
    }, {
      suffix: "v2-id-mismatch",
      version: 2,
      mutate: (result) => {
        result.paper_handoff_conformance!.candidate_egress_attestation!.attestation_id =
          "wrong-attestation";
      },
      handoff: false
    }, {
      suffix: "v2-state-mismatch",
      version: 2,
      mutate: (result) => {
        (result.paper_handoff_conformance!.candidate_egress_attestation as unknown as {
          verification_status: string;
          enforcement_result: string;
        }).verification_status = "rejected";
        (result.paper_handoff_conformance!.candidate_egress_attestation as unknown as {
          enforcement_result: string;
        }).enforcement_result = "policy_mismatch";
      },
      handoff: false
    }, {
      suffix: "v2-denial-mismatch",
      version: 2,
      mutate: (result) => {
        result.paper_handoff_conformance!.candidate_egress_attestation!.denial_summary
          .end_denied_probe_count -= 1;
      },
      handoff: false
    }, {
      suffix: "v2-authority-mismatch",
      version: 2,
      mutate: (result) => {
        (result.paper_handoff_conformance!.candidate_egress_attestation as unknown as {
          authority_status: string;
        }).authority_status = "not_live";
      },
      handoff: false
    }, {
      suffix: "v1-unexpected",
      version: 1,
      mutate: (result) => {
        result.paper_handoff_conformance!.candidate_egress_attestation = {
          attestation_id: "unexpected-v1-attestation",
          verification_status: "verified",
          enforcement_result: "enforced",
          network_policy_digest: digest("unexpected-v1-policy"),
          denial_summary: {
            required_probe_count: 7,
            start_denied_probe_count: 7,
            end_denied_probe_count: 7,
            unexpected_allow_count: 0
          },
          authority_status: "research_only"
        };
      },
      handoff: false
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, ["trend_following"]);
      const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
      const result = fixture.ticks.at(-1)!.direction_results[0]!;
      if (testCase.version === 2) upgradeConformanceToV2(graph, result);
      testCase.mutate(result);

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );

      if (testCase.handoff) {
        expect(detail?.terminal_graph, testCase.suffix).toHaveProperty(
          "admitted_arena_handoff"
        );
      } else {
        expect(detail?.terminal_graph, testCase.suffix).not.toHaveProperty(
          "admitted_arena_handoff"
        );
        expect(detail?.degraded_reasons.some((reason) =>
          reason === "terminal_admission_unavailable" ||
          reason === "inactive_incomplete_graph"
        ), testCase.suffix).toBe(true);
      }
    }

    const historicalFixture = graphFixture();
    const historicalAllocation = historicalFixture.addAllocation(
      "v1-docker-admitted",
      ["trend_following"]
    );
    const historicalGraph = historicalFixture.addTerminalGraph(
      historicalAllocation,
      "trend_following",
      "admitted"
    );
    historicalGraph.conformance.runner_kind = "docker_sandboxes_sbx";
    historicalGraph.conformance.evidence_digest = digest(
      paperTradingHandoffConformanceDigestInput(historicalGraph.conformance)
    );
    historicalGraph.admission.paper_trading_handoff_conformance_digest =
      historicalGraph.conformance.evidence_digest;
    const historicalDetail = await historicalFixture.service.readSessionDetail(
      workId(historicalAllocation, "trend_following")
    );
    expect(historicalDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    expect(historicalDetail?.degraded_reasons).toContain("selected_artifact_unavailable");
  });

  it("rejects malformed Finding, lineage, and compact terminal tick edges", async () => {
    const fixture = graphFixture();
    const malformedFindingAllocation = fixture.addAllocation(
      "malformed-finding",
      ["trend_following"]
    );
    const malformedFinding = fixture.addTerminalGraph(
      malformedFindingAllocation,
      "trend_following",
      "admitted"
    );
    malformedFinding.finding.finding_kind = "invented_kind" as "positive_result";

    const missingFindingAllocation = fixture.addAllocation(
      "missing-finding",
      ["other"],
      500
    );
    const missingFinding = fixture.addTerminalGraph(
      missingFindingAllocation,
      "other",
      "admitted"
    );
    fixture.findings.splice(fixture.findings.indexOf(missingFinding.finding), 1);

    const malformedLineageAllocation = fixture.addAllocation(
      "malformed-lineage",
      ["mean_reversion"],
      1_000
    );
    const malformedLineage = fixture.addTerminalGraph(
      malformedLineageAllocation,
      "mean_reversion",
      "admitted"
    );
    malformedLineage.lineage.authority_status = "not_live" as "lineage_only";

    const wrongTickAllocation = fixture.addAllocation(
      "wrong-tick-edge",
      ["volatility_regime"],
      2_000
    );
    fixture.addTerminalGraph(wrongTickAllocation, "volatility_regime", "admitted");
    fixture.ticks.at(-1)!.direction_results[0]!.research_preflight!.commitment_id =
      "wrong-commitment";

    const wrongAdmissionReasonAllocation = fixture.addAllocation(
      "wrong-admission-reason",
      ["funding_aware_risk"],
      3_000
    );
    fixture.addTerminalGraph(wrongAdmissionReasonAllocation, "funding_aware_risk", "admitted");
    fixture.ticks.at(-1)!.direction_results[0]!.admission_reason = "behavior_duplicate";

    const wrongConformanceAllocation = fixture.addAllocation(
      "wrong-compact-conformance",
      ["execution_cost_robustness"],
      4_000
    );
    fixture.addTerminalGraph(
      wrongConformanceAllocation,
      "execution_cost_robustness",
      "admitted"
    );
    fixture.ticks.at(-1)!.direction_results[0]!.paper_handoff_conformance!.conformance_id =
      "wrong-conformance";

    const findingDetail = await fixture.service.readSessionDetail(
      workId(malformedFindingAllocation, "trend_following")
    );
    const lineageDetail = await fixture.service.readSessionDetail(
      workId(malformedLineageAllocation, "mean_reversion")
    );
    const missingFindingDetail = await fixture.service.readSessionDetail(
      workId(missingFindingAllocation, "other")
    );
    const tickDetail = await fixture.service.readSessionDetail(
      workId(wrongTickAllocation, "volatility_regime")
    );
    const admissionReasonDetail = await fixture.service.readSessionDetail(
      workId(wrongAdmissionReasonAllocation, "funding_aware_risk")
    );
    const conformanceDetail = await fixture.service.readSessionDetail(
      workId(wrongConformanceAllocation, "execution_cost_robustness")
    );

    expect(findingDetail?.terminal_graph).not.toHaveProperty("finding");
    expect(findingDetail?.terminal_graph).not.toHaveProperty("artifact_lineage");
    expect(findingDetail?.terminal_graph).not.toHaveProperty("admission");
    expect(findingDetail?.terminal_graph).not.toHaveProperty(
      "paper_handoff_conformance"
    );
    expect(findingDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    expect(findingDetail?.degraded_reasons).toContain("terminal_admission_unavailable");
    expect(findingDetail?.status).toBe("failed_closed");
    expect(findingDetail?.status_basis.basis_kind).toBe("candidate_arena_tick");
    expect(missingFindingDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    expect(missingFindingDetail?.terminal_graph).not.toHaveProperty("admission");
    expect(missingFindingDetail?.terminal_graph).not.toHaveProperty(
      "paper_handoff_conformance"
    );
    expect(missingFindingDetail?.degraded_reasons).toContain(
      "terminal_admission_unavailable"
    );
    expect(missingFindingDetail?.status).toBe("failed_closed");
    expect(lineageDetail?.terminal_graph).not.toHaveProperty("artifact_lineage");
    expect(lineageDetail).toMatchObject({
      projection_health: "complete",
      degraded_reasons: [],
      terminal_graph: {
        admitted_arena_handoff: {
          candidate_ref: { record_kind: "trading_system_candidate" }
        }
      }
    });
    expect(tickDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    expect(admissionReasonDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    expect(conformanceDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("degrades malformed selected joins without choosing an arbitrary graph", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("malformed", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    graph.evaluation.submitted_artifact_digest = digest("tampered");

    const detail = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));

    expect(detail).toMatchObject({
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining([
        "selected_artifact_unavailable",
        "inactive_incomplete_graph"
      ]),
      selected_artifact_availability: "unavailable",
      terminal_graph: {
        authority_status: "read_only"
      }
    });
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("fails closed when matching checkpoints are ambiguous even with exact admission", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("ambiguous-checkpoint", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const first = checkpoint(fixture,
      graph.commitment,
      "admission_recorded",
      [],
      0,
      0,
      graph.admission.candidate_admission_decision_id
    );
    const second = {
      ...first,
      research_worker_checkpoint_id: `${first.research_worker_checkpoint_id}-duplicate`
    };
    second.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(second));
    fixture.checkpoints.push(first, second);

    const detail = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));

    expect(detail).toMatchObject({
      status: "failed_closed",
      status_basis: {
        basis_kind: "incomplete_persisted_graph",
        authority_status: "read_only"
      },
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
    });
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("does not let legacy admission checkpoints override failed or no-submission recovery ticks", async () => {
    const cases: Array<{
      suffix: string;
      result: CandidateArenaTickRecord["direction_results"][number];
    }> = [{
      suffix: "failed",
      result: {
        direction_kind: "trend_following",
        status: "failed",
        error: "Persisted admission recovery failed closed."
      }
    }, {
      suffix: "no-submission",
      result: {
        direction_kind: "trend_following",
        status: "no_submission",
        finding: "Legacy checkpoint lacks exact terminal direction evidence."
      }
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(
        `legacy-checkpoint-${testCase.suffix}-recovery`,
        ["trend_following"]
      );
      const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
      const legacyCheckpoint = checkpoint(
        fixture,
        graph.commitment,
        "admission_recorded",
        [entry(graph.commitment.candidate_arena_tick_id, 1)],
        1,
        1,
        graph.admission.candidate_admission_decision_id
      );
      legacyCheckpoint.closed_at = after(allocation.allocated_at, 4_500);
      legacyCheckpoint.checkpoint_digest = digest(
        researchWorkerCheckpointDigestInput(legacyCheckpoint)
      );
      fixture.checkpoints.push(legacyCheckpoint);
      fixture.ticks[0] = tick(allocation, [testCase.result]);

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );

      expect(detail, testCase.suffix).toMatchObject({
        status: "failed_closed",
        status_basis: { basis_kind: "research_worker_checkpoint" },
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining(["terminal_admission_unavailable"])
      });
      expect(detail?.status_basis.basis_kind, testCase.suffix)
        .not.toBe("candidate_admission_decision");
      expect(detail?.terminal_graph, testCase.suffix)
        .not.toHaveProperty("admitted_arena_handoff");
    }
  });

  it("keeps exact successful terminal ticks compatible with legacy admission checkpoints", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "legacy-checkpoint-successful-tick",
      ["trend_following"]
    );
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const legacyCheckpoint = checkpoint(
      fixture,
      graph.commitment,
      "admission_recorded",
      [entry(graph.commitment.candidate_arena_tick_id, 1)],
      1,
      1,
      graph.admission.candidate_admission_decision_id
    );
    legacyCheckpoint.closed_at = after(allocation.allocated_at, 4_500);
    legacyCheckpoint.checkpoint_digest = digest(
      researchWorkerCheckpointDigestInput(legacyCheckpoint)
    );
    fixture.checkpoints.push(legacyCheckpoint);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      status: "admitted",
      status_basis: { basis_kind: "candidate_admission_decision" },
      terminal_graph: {
        admitted_arena_handoff: {
          candidate_ref: { record_kind: "trading_system_candidate" }
        }
      }
    });
  });

  it("fails the complete terminal graph closed when one raw current checkpoint is invalid", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("invalid-current-checkpoint", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const invalid = checkpoint(
      fixture,
      graph.commitment,
      "admission_recorded",
      [entry(graph.commitment.candidate_arena_tick_id, 1)],
      1,
      1,
      graph.admission.candidate_admission_decision_id
    );
    invalid.workspace_key = "candidate-arena-workers/wrong-worker";
    invalid.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(invalid));
    fixture.checkpoints.push(invalid);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expectNoTerminalAuthority(detail, "unavailable");
    expect(detail).toMatchObject({
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"]),
      submission_history_availability: "unavailable_until_checkpoint"
    });
    expect(detail?.lifecycle_events.map((event) => event.event_kind))
      .not.toEqual(expect.arrayContaining([
        "evaluation", "checkpoint", "handoff_conformance", "admission"
      ]));
  });

  it("fails a descendant closed when its prior commitment has an invalid raw checkpoint sibling", async () => {
    const fixture = graphFixture();
    const priorAllocation = fixture.addAllocation(
      "prior-checkpoint-owner",
      ["trend_following"],
      -10_000
    );
    const priorCommitment = fixture.addCommitment(
      priorAllocation,
      "trend_following",
      "worker-checkpoint-owner-chain"
    );
    const priorCheckpoint = checkpoint(
      fixture,
      priorCommitment,
      "finished_without_submission"
    );
    priorCheckpoint.closed_at = after(priorCommitment.committed_at, 1_000);
    priorCheckpoint.checkpoint_digest = digest(
      researchWorkerCheckpointDigestInput(priorCheckpoint)
    );
    fixture.checkpoints.push(priorCheckpoint);
    const currentAllocation = fixture.addAllocation(
      "current-checkpoint-owner",
      ["trend_following"]
    );
    const graph = fixture.addTerminalGraph(
      currentAllocation,
      "trend_following",
      "admitted",
      "worker-checkpoint-owner-chain"
    );
    fixture.checkpoints.push(checkpoint(
      fixture,
      graph.commitment,
      "admission_recorded",
      [entry(graph.commitment.candidate_arena_tick_id, 1)],
      1,
      1,
      graph.admission.candidate_admission_decision_id
    ));
    const invalidSibling = structuredClone(priorCheckpoint);
    invalidSibling.research_worker_checkpoint_id =
      `zz-duplicate-${priorCheckpoint.research_worker_checkpoint_id}`;
    invalidSibling.checkpoint_digest = digest("invalid-raw-prior-checkpoint");
    fixture.checkpoints.push(invalidSibling);

    const detail = await fixture.service.readSessionDetail(
      workId(currentAllocation, "trend_following")
    );

    expectNoTerminalAuthority(detail, "unavailable");
    expect(detail).toMatchObject({
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
    });
  });

  it("fails a memory descendant closed for duplicate prior checkpoints without a current checkpoint", async () => {
    const fixture = graphFixture();
    const workerId = "worker-memory-prior-without-current-checkpoint";
    const priorAllocation = fixture.addAllocation(
      "memory-prior-without-current-checkpoint",
      ["trend_following"],
      -10_000
    );
    const priorCommitment = fixture.addCommitment(
      priorAllocation,
      "trend_following",
      workerId
    );
    const priorCheckpoint = checkpoint(
      fixture,
      priorCommitment,
      "finished_without_submission"
    );
    priorCheckpoint.closed_at = after(priorCommitment.committed_at, 1_000);
    priorCheckpoint.checkpoint_digest = digest(
      researchWorkerCheckpointDigestInput(priorCheckpoint)
    );
    fixture.checkpoints.push(priorCheckpoint);

    const currentAllocation = fixture.addAllocation(
      "memory-current-without-checkpoint",
      ["trend_following"]
    );
    const current = fixture.addTerminalGraph(
      currentAllocation,
      "trend_following",
      "admitted",
      workerId
    );
    current.commitment.memory_policy = {
      protocol_version: "research_worker_memory_v1",
      memory_mode: "released_memory",
      memory_source_digest: digest("memory-current-without-checkpoint-source"),
      available_memory_item_count: 1,
      arena_context_digest: digest("memory-current-without-checkpoint-context"),
      prior_checkpoint: {
        disposition: "included",
        checkpoint_ref: ref(
          "research_worker_checkpoint",
          priorCheckpoint.research_worker_checkpoint_id
        ),
        checkpoint_digest: priorCheckpoint.checkpoint_digest
      }
    };
    resealCommitmentGraph(current);

    const clean = await fixture.service.readSessionDetail(
      workId(currentAllocation, "trend_following")
    );
    expect(clean).toMatchObject({
      status: "admitted",
      submission_history_availability: "unavailable_until_checkpoint"
    });

    const duplicatePrior = structuredClone(priorCheckpoint);
    duplicatePrior.research_worker_checkpoint_id =
      `zz-duplicate-${priorCheckpoint.research_worker_checkpoint_id}`;
    duplicatePrior.checkpoint_digest = digest(
      researchWorkerCheckpointDigestInput(duplicatePrior)
    );
    fixture.checkpoints.push(duplicatePrior);

    const conflicted = await fixture.service.readSessionDetail(
      workId(currentAllocation, "trend_following")
    );
    expectNoTerminalAuthority(conflicted);
    expect(conflicted).toMatchObject({
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"]),
      submission_history_availability: "unavailable_until_checkpoint"
    });
  });

  it("fails every checkpoint graph sharing one raw checkpoint ID closed", async () => {
    const fixture = graphFixture();
    const terminalAllocation = fixture.addAllocation(
      "checkpoint-id-owner",
      ["trend_following"]
    );
    const terminal = fixture.addTerminalGraph(
      terminalAllocation,
      "trend_following",
      "admitted"
    );
    const terminalCheckpoint = checkpoint(
      fixture,
      terminal.commitment,
      "admission_recorded",
      [],
      0,
      0,
      terminal.admission.candidate_admission_decision_id
    );
    const siblingAllocation = fixture.addAllocation(
      "checkpoint-id-sibling",
      ["mean_reversion"],
      1_000
    );
    const siblingCommitment = fixture.addCommitment(
      siblingAllocation,
      "mean_reversion",
      "worker-checkpoint-id-sibling"
    );
    const siblingCheckpoint = checkpoint(
      fixture,
      siblingCommitment,
      "finished_without_submission"
    );
    siblingCheckpoint.research_worker_checkpoint_id =
      terminalCheckpoint.research_worker_checkpoint_id;
    siblingCheckpoint.checkpoint_digest = digest(
      researchWorkerCheckpointDigestInput(siblingCheckpoint)
    );
    fixture.checkpoints.push(terminalCheckpoint, siblingCheckpoint);

    const terminalDetail = await fixture.service.readSessionDetail(
      workId(terminalAllocation, "trend_following")
    );

    expectNoTerminalAuthority(terminalDetail, "unavailable");
    expect(terminalDetail?.degraded_reasons).toContain("inactive_incomplete_graph");
  });

  it("accepts only canonical digest-bound checkpoints and honors exact terminal conflicts", async () => {
    const cases: Array<{
      suffix: string;
      mutate(record: ResearchWorkerCheckpointRecord): void;
      expectedStatus: "failed_closed";
    }> = [{
      suffix: "checkpoint-terminal-conflict",
      expectedStatus: "failed_closed",
      mutate: (record) => {
        record.terminal_status = "failed_closed";
        record.terminal_reason = "execution_failed";
        delete record.candidate_admission_decision_ref;
        record.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(record));
      }
    }, {
      suffix: "checkpoint-admission-ref-conflict",
      expectedStatus: "failed_closed",
      mutate: (record) => {
        record.candidate_admission_decision_ref = ref(
          "candidate_admission_decision",
          "other-admission"
        );
        record.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(record));
      }
    }, {
      suffix: "checkpoint-budget-malformed",
      expectedStatus: "failed_closed",
      mutate: (record) => {
        record.development_budget.recorded_submission_count = 3;
      }
    }, {
      suffix: "checkpoint-notebook-malformed",
      expectedStatus: "failed_closed",
      mutate: (record) => {
        record.notebook.total_entry_count = 7;
      }
    }, {
      suffix: "checkpoint-digest-mismatch",
      expectedStatus: "failed_closed",
      mutate: (record) => {
        record.checkpoint_digest = digest("wrong-checkpoint");
      }
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, ["trend_following"]);
      const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
      const record = checkpoint(fixture,
        graph.commitment,
        "admission_recorded",
        [],
        0,
        0,
        graph.admission.candidate_admission_decision_id
      );
      testCase.mutate(record);
      fixture.checkpoints.push(record);

      const detail = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));

      expect(detail?.status, testCase.suffix).toBe(testCase.expectedStatus);
      expect(detail?.terminal_graph, testCase.suffix)
        .not.toHaveProperty("admitted_arena_handoff");
      if (testCase.suffix !== "checkpoint-terminal-conflict") {
        expectNoTerminalAuthority(detail, "unavailable");
      }
    }
  });

  it("omits re-digested checkpoints with invalid lifecycle, chronology, budget, or notebook graph", async () => {
    const cases: Array<{
      suffix: string;
      mutate(
        record: ResearchWorkerCheckpointRecord,
        fixture: Fixture,
        graph: TerminalFixture
      ): void;
    }> = [{
      suffix: "checkpoint-worker-lifecycle",
      mutate: (_record, fixture, graph) => {
        const worker = fixture.workers.find((candidate) =>
          candidate.research_worker_id === graph.commitment.research_worker_ref.id
        )!;
        delete worker.lifecycle_protocol;
      }
    }, {
      suffix: "checkpoint-before-commitment",
      mutate: (record, _fixture, graph) => {
        record.closed_at = after(graph.commitment.committed_at, -1);
        record.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(record));
      }
    }, {
      suffix: "checkpoint-before-admission",
      mutate: (record, _fixture, graph) => {
        record.closed_at = after(graph.admission.decided_at, -1);
        record.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(record));
      }
    }, {
      suffix: "checkpoint-cumulative-budget",
      mutate: (record) => {
        record.development_budget.cumulative_committed_submission_limit += 1;
        record.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(record));
      }
    }, {
      suffix: "checkpoint-notebook-continuity",
      mutate: (record) => {
        record.notebook.recent_entries[0]!.candidate_arena_tick_id = "wrong-tick";
        record.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(record));
      }
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, ["trend_following"]);
      const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
      const record = checkpoint(
        fixture,
        graph.commitment,
        "admission_recorded",
        [entry(graph.commitment.candidate_arena_tick_id, 1)],
        1,
        1,
        graph.admission.candidate_admission_decision_id
      );
      testCase.mutate(record, fixture, graph);
      fixture.checkpoints.push(record);

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );

      expectNoTerminalAuthority(detail, "unavailable");
      expect(detail?.status, testCase.suffix).toBe("failed_closed");
      expect(detail?.lifecycle_events.map((event) => event.event_kind), testCase.suffix)
        .not.toContain("checkpoint");
      expect(detail?.submission_history_availability, testCase.suffix)
        .toBe("unavailable_until_checkpoint");
    }
  });

  it("omits a checkpoint whose immediate predecessor continuity is re-digested but false", async () => {
    const fixture = graphFixture();
    const older = fixture.addAllocation("predecessor-old", ["trend_following"], -10_000);
    const olderCommitment = fixture.addCommitment(
      older,
      "trend_following",
      "worker-predecessor"
    );
    fixture.checkpoints.push(checkpoint(
      fixture,
      olderCommitment,
      "finished_without_submission"
    ));
    const current = fixture.addAllocation("predecessor-current", ["trend_following"]);
    const graph = fixture.addTerminalGraph(
      current,
      "trend_following",
      "admitted",
      "worker-predecessor"
    );
    const currentCheckpoint = checkpoint(
      fixture,
      graph.commitment,
      "admission_recorded",
      [entry(graph.commitment.candidate_arena_tick_id, 1)],
      1,
      2,
      graph.admission.candidate_admission_decision_id
    );
    currentCheckpoint.previous_checkpoint_ref = ref(
      "research_worker_checkpoint",
      "wrong-predecessor"
    );
    currentCheckpoint.checkpoint_digest = digest(
      researchWorkerCheckpointDigestInput(currentCheckpoint)
    );
    fixture.checkpoints.push(currentCheckpoint);

    const detail = await fixture.service.readSessionDetail(
      workId(current, "trend_following")
    );

    expectNoTerminalAuthority(detail, "unavailable");
    expect(detail?.status).toBe("failed_closed");
    expect(detail?.lifecycle_events.map((event) => event.event_kind))
      .not.toContain("checkpoint");
    expect(detail?.submission_history_availability).toBe("unavailable_until_checkpoint");
  });

  it("keeps partial post-evaluation evidence inspectable before admission", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("partial-evaluation", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    fixture.admissions.length = 0;
    fixture.conformances.length = 0;
    fixture.findings.length = 0;
    fixture.lineages.length = 0;
    fixture.ticks.length = 0;

    const detail = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));

    expect(detail).toMatchObject({
      selected_artifact_availability: "unavailable",
      degraded_reasons: expect.arrayContaining(["selected_artifact_unavailable"]),
      terminal_graph: {
        selected_sealed_evaluation: {
          trading_evaluation_result_ref: {
            record_kind: "trading_evaluation_result",
            id: graph.evaluation.trading_evaluation_result_id
          }
        },
        authority_status: "read_only"
      }
    });
    expect(detail?.terminal_graph).not.toHaveProperty("admission");
  });

  it("keeps a commitment-owned Evaluation selection unavailable when its checkpoint conflicts", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "checkpoint-conflict-selected-evaluation",
      ["trend_following"]
    );
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const conflictedCheckpoint = checkpoint(
      fixture,
      graph.commitment,
      "admission_recorded",
      [entry(graph.commitment.candidate_arena_tick_id, 1)],
      1,
      1,
      graph.admission.candidate_admission_decision_id
    );
    conflictedCheckpoint.checkpoint_digest = digest("conflicting-checkpoint-digest");
    fixture.checkpoints.push(conflictedCheckpoint);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      status: "failed_closed",
      selected_artifact_availability: "unavailable",
      degraded_reasons: expect.arrayContaining([
        "selected_artifact_unavailable",
        "inactive_incomplete_graph"
      ])
    });
    expect(detail).not.toHaveProperty("selected_system_code_ref");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("projects a long canonical checkpoint chain without recursive rescans", async () => {
    const fixture = graphFixture();
    const workerId = "worker-long-checkpoint-chain";
    const chainLength = 400;
    let previous: ResearchWorkerCheckpointRecord | undefined;
    let latestAllocation: CandidateArenaResearchAllocationRecord | undefined;
    for (let index = 0; index < chainLength; index += 1) {
      latestAllocation = fixture.addAllocation(
        `long-checkpoint-chain-${index}`,
        ["trend_following"],
        index * 10
      );
      const commitment = fixture.addCommitment(
        latestAllocation,
        "trend_following",
        workerId
      );
      const worker = fixture.workers.find((candidate) =>
        candidate.research_worker_id === workerId
      )!;
      previous = chainCheckpoint(commitment, worker, index + 1, previous);
      fixture.checkpoints.push(previous);
    }
    fixture.allocations.splice(0, fixture.allocations.length - 1);

    const startedAt = Date.now();
    const detail = await fixture.service.readSessionDetail(
      workId(latestAllocation!, "trend_following")
    );
    const elapsedMs = Date.now() - startedAt;

    expect(detail).toMatchObject({
      status: "finished_without_submission",
      status_basis: { basis_kind: "research_worker_checkpoint" },
      projection_health: "complete",
      submission_history_availability: "checkpoint_summary",
      recorded_submission_count: 0
    });
    expect(elapsedMs).toBeLessThan(2_000);
  });

  it("does not count predecessor notebook entries as current-session truncation", async () => {
    const fixture = graphFixture();
    const older = fixture.addAllocation("prior-heavy", ["trend_following"], -86_400_000);
    const olderCommitment = fixture.addCommitment(older, "trend_following", "worker-shared");
    fixture.checkpoints.push(checkpoint(
      fixture,
      olderCommitment,
      "execution_failed",
      [entry(olderCommitment.candidate_arena_tick_id, 1)],
      1,
      1
    ));
    const current = fixture.addAllocation("current-complete", ["trend_following"]);
    const currentCommitment = fixture.addCommitment(current, "trend_following", "worker-shared");
    fixture.checkpoints.push(checkpoint(
      fixture,
      currentCommitment,
      "execution_failed",
      [entry(currentCommitment.candidate_arena_tick_id, 1)],
      1,
      2
    ));

    const detail = await fixture.service.readSessionDetail(workId(current, "trend_following"));

    expect(detail).toMatchObject({
      recorded_submission_count: 1,
      projected_submission_count: 1,
      omitted_submission_count: 0,
      submission_history_truncated: false
    });
  });

  it("fails ambiguous and malformed commitment joins closed without arbitrary latest selection", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("ambiguous", ["trend_following"]);
    const first = fixture.addCommitment(allocation, "trend_following", "worker-first");
    const second = fixture.addCommitment(allocation, "trend_following", "worker-second");
    second.research_preflight_commitment_id += "-second";
    second.committed_at = after(first.committed_at, 60_000);
    second.commitment_digest = digest(researchPreflightCommitmentDigestInput(second));

    const ambiguous = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));
    expect(ambiguous).toMatchObject({
      status: "recovering",
      methodology_availability: "unavailable",
      provider_availability: "unavailable",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
    });
    expect(ambiguous).not.toHaveProperty("commitment_id");

    fixture.commitments.splice(1, 1);
    first.research_allocation_digest = "not-a-digest";
    const malformed = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));
    expect(malformed).toMatchObject({
      status: "recovering",
      methodology_availability: "unavailable"
    });
    expect(malformed).not.toHaveProperty("commitment_id");

    first.research_allocation_digest = allocation.allocation_digest;
    first.research_allocation_ref = ref("research_finding", allocation.candidate_arena_research_allocation_id);
    const wrongRef = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));
    expect(wrongRef).not.toHaveProperty("commitment_id");
    expect(wrongRef).toMatchObject({ status: "recovering" });
  });

  it("rejects duplicate commitment IDs and globally reused sealed material before validation", async () => {
    const cases = ["duplicate-id", "reused-rotation", "reused-suite"] as const;
    for (const kind of cases) {
      const fixture = graphFixture();
      const terminalAllocation = fixture.addAllocation(
        `commitment-owner-${kind}`,
        ["trend_following"]
      );
      const terminal = fixture.addTerminalGraph(
        terminalAllocation,
        "trend_following",
        "admitted"
      );
      const otherAllocation = fixture.addAllocation(
        `commitment-contender-${kind}`,
        ["mean_reversion"],
        1_000
      );
      const contender = fixture.addCommitment(otherAllocation, "mean_reversion");
      if (kind === "duplicate-id") {
        contender.research_preflight_commitment_id =
          terminal.commitment.research_preflight_commitment_id;
      } else if (kind === "reused-rotation") {
        contender.sealed_admission_policy.rotation_commitment_digest =
          terminal.commitment.sealed_admission_policy.rotation_commitment_digest;
      } else {
        contender.sealed_admission_policy.suite_digest =
          terminal.commitment.sealed_admission_policy.suite_digest;
      }
      contender.commitment_digest = digest(
        researchPreflightCommitmentDigestInput(contender)
      );

      const result = await fixture.service.readOperations();
      expect(result.sessions, kind).toHaveLength(2);
      for (const session of result.sessions) {
        expect(session, `${kind}:${session.research_allocation_id}`).toMatchObject({
          status: "recovering",
          status_basis: { basis_kind: "incomplete_persisted_graph" }
        });
        expect(session, `${kind}:${session.research_allocation_id}`).toMatchObject({
          projection_health: "degraded",
          degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
        });
        expect(session, `${kind}:${session.research_allocation_id}`)
          .not.toHaveProperty("admitted_candidate_id");
      }
      for (const session of result.sessions) {
        expectNoTerminalAuthority(await fixture.service.readSessionDetail(
          session.research_work_item_id
        ));
      }
    }
  });

  it("groups raw claims while preserving higher-precedence admission authority", async () => {
    const invalidCommitmentFixture = graphFixture();
    const invalidCommitmentAllocation = invalidCommitmentFixture.addAllocation(
      "raw-commitment-sibling",
      ["trend_following"]
    );
    const invalidCommitmentGraph = invalidCommitmentFixture.addTerminalGraph(
      invalidCommitmentAllocation,
      "trend_following",
      "admitted"
    );
    const invalidSibling = structuredClone(invalidCommitmentGraph.commitment);
    invalidSibling.research_preflight_commitment_id += "-invalid-sibling";
    invalidSibling.sealed_admission_policy.rotation_commitment_digest =
      digest("raw-commitment-sibling-rotation");
    invalidSibling.sealed_admission_policy.suite_digest =
      digest("raw-commitment-sibling-suite");
    invalidSibling.source_artifact_digest = digest("raw-commitment-sibling-wrong-source");
    invalidSibling.commitment_digest = digest(
      researchPreflightCommitmentDigestInput(invalidSibling)
    );
    invalidCommitmentFixture.commitments.push(invalidSibling);

    const commitmentDetail = await invalidCommitmentFixture.service.readSessionDetail(
      workId(invalidCommitmentAllocation, "trend_following")
    );
    expectNoTerminalAuthority(commitmentDetail);
    expect(commitmentDetail).toMatchObject({
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
    });

    const duplicateTickFixture = graphFixture();
    const duplicateTickAllocation = duplicateTickFixture.addAllocation(
      "raw-tick-sibling",
      ["trend_following"]
    );
    duplicateTickFixture.addTerminalGraph(
      duplicateTickAllocation,
      "trend_following",
      "admitted"
    );
    const duplicateTick = structuredClone(duplicateTickFixture.ticks[0]!);
    duplicateTick.candidate_arena_tick_id += "-duplicate-claim";
    duplicateTickFixture.ticks.push(duplicateTick);

    const duplicateTickDetail = await duplicateTickFixture.service.readSessionDetail(
      workId(duplicateTickAllocation, "trend_following")
    );
    expect(duplicateTickDetail).toMatchObject({
      status: "admitted",
      status_basis: { basis_kind: "candidate_admission_decision" },
      selected_artifact_availability: "available",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"]),
      terminal_graph: { admission: { status: "admitted" } }
    });
    expect(duplicateTickDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");

    const invalidTickFixture = graphFixture();
    const invalidTickAllocation = invalidTickFixture.addAllocation(
      "raw-invalid-tick",
      ["trend_following"]
    );
    invalidTickFixture.addTerminalGraph(
      invalidTickAllocation,
      "trend_following",
      "admitted"
    );
    invalidTickFixture.ticks[0]!.research_allocation_digest = digest("wrong-allocation");

    const invalidTickDetail = await invalidTickFixture.service.readSessionDetail(
      workId(invalidTickAllocation, "trend_following")
    );
    expect(invalidTickDetail).toMatchObject({
      status: "admitted",
      status_basis: { basis_kind: "candidate_admission_decision" },
      selected_artifact_availability: "available",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"]),
      terminal_graph: { admission: { status: "admitted" } }
    });
    expect(invalidTickDetail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("marks a sole invalid raw Evaluation unavailable and suppresses terminal authority", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("sole-invalid-evaluation", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    graph.evaluation.submitted_artifact_digest = digest("sole-invalid-evaluation-artifact");

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expectNoTerminalAuthority(detail, "unavailable");
    expect(detail).toMatchObject({
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      degraded_reasons: expect.arrayContaining([
        "selected_artifact_unavailable",
        "inactive_incomplete_graph"
      ])
    });
  });

  it("requires a canonical current behavior fingerprint for admission authority", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("missing-current-fingerprint", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const missing = behaviorFingerprint(graph, "missing-current-fingerprint");
    bindBehaviorComparison(graph, missing, "distinct");

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining([
        "selected_artifact_unavailable",
        "terminal_admission_unavailable",
        "inactive_incomplete_graph"
      ]),
      selected_artifact_availability: "unavailable",
      status_basis: { basis_kind: "incomplete_persisted_graph" }
    });
    expect(detail).not.toHaveProperty("admission_decision_ref");
    expect(detail?.terminal_graph).not.toHaveProperty("admission");
    expect(detail?.terminal_graph).not.toHaveProperty("finding");
    expect(detail?.terminal_graph).not.toHaveProperty("paper_handoff_conformance");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("rejects false distinct and duplicate behavior comparison claims", async () => {
    const fixture = graphFixture();
    const earlierAllocation = fixture.addAllocation(
      "behavior-earlier-owner",
      ["trend_following"],
      -1_000
    );
    const earlier = fixture.addTerminalGraph(
      earlierAllocation,
      "trend_following",
      "admitted"
    );
    const earlierFingerprint = behaviorFingerprint(earlier, "behavior-earlier-owner");
    fixture.fingerprints.push(earlierFingerprint);
    bindBehaviorComparison(earlier, earlierFingerprint, "distinct");

    const currentAllocation = fixture.addAllocation(
      "behavior-false-distinct",
      ["trend_following"]
    );
    const current = fixture.addTerminalGraph(
      currentAllocation,
      "trend_following",
      "admitted"
    );
    current.commitment.development_policy.suite_digest =
      earlier.commitment.development_policy.suite_digest;
    resealCommitmentGraph(current);
    const currentFingerprint = behaviorFingerprint(current, "behavior-false-distinct");
    fixture.fingerprints.push(currentFingerprint);
    bindBehaviorComparison(current, currentFingerprint, "distinct");

    expect(await fixture.service.readSessionDetail(
      workId(earlierAllocation, "trend_following")
    )).toMatchObject({ status: "admitted" });
    const falseDistinct = await fixture.service.readSessionDetail(
      workId(currentAllocation, "trend_following")
    );
    expect(falseDistinct).toMatchObject({
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      selected_artifact_availability: "unavailable",
      degraded_reasons: expect.arrayContaining([
        "selected_artifact_unavailable",
        "terminal_admission_unavailable",
        "inactive_incomplete_graph"
      ])
    });
    expect(falseDistinct).not.toHaveProperty("admission_decision_ref");

    const orphanFixture = graphFixture();
    const orphanAllocation = orphanFixture.addAllocation(
      "behavior-orphan",
      ["trend_following"],
      -1_000
    );
    const orphan = orphanFixture.addTerminalGraph(
      orphanAllocation,
      "trend_following",
      "admitted"
    );
    const orphanFingerprint = behaviorFingerprint(orphan, "behavior-orphan");
    orphanFixture.fingerprints.push(orphanFingerprint);

    const duplicateAllocation = orphanFixture.addAllocation(
      "behavior-false-duplicate",
      ["trend_following"]
    );
    const duplicate = orphanFixture.addTerminalGraph(
      duplicateAllocation,
      "trend_following",
      "admitted"
    );
    duplicate.commitment.development_policy.suite_digest =
      orphan.commitment.development_policy.suite_digest;
    resealCommitmentGraph(duplicate);
    const duplicateFingerprint = behaviorFingerprint(
      duplicate,
      "behavior-false-duplicate"
    );
    orphanFixture.fingerprints.push(duplicateFingerprint);
    bindBehaviorComparison(
      duplicate,
      duplicateFingerprint,
      "duplicate",
      orphanFingerprint
    );

    const falseDuplicate = await orphanFixture.service.readSessionDetail(
      workId(duplicateAllocation, "trend_following")
    );
    expect(falseDuplicate).toMatchObject({
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      selected_artifact_availability: "unavailable",
      degraded_reasons: expect.arrayContaining([
        "selected_artifact_unavailable",
        "terminal_admission_unavailable",
        "inactive_incomplete_graph"
      ])
    });
    expect(falseDuplicate).not.toHaveProperty("admission_decision_ref");
  });

  it("accepts the first canonical distinct fingerprint and an exact admitted duplicate baseline", async () => {
    const fixture = graphFixture();
    const earlierAllocation = fixture.addAllocation(
      "behavior-valid-earlier",
      ["trend_following"],
      -1_000
    );
    const earlier = fixture.addTerminalGraph(
      earlierAllocation,
      "trend_following",
      "admitted"
    );
    const earlierFingerprint = behaviorFingerprint(earlier, "behavior-valid-earlier");
    fixture.fingerprints.push(earlierFingerprint);
    bindBehaviorComparison(earlier, earlierFingerprint, "distinct");

    const duplicateAllocation = fixture.addAllocation(
      "behavior-valid-duplicate",
      ["trend_following"]
    );
    const duplicate = fixture.addTerminalGraph(
      duplicateAllocation,
      "trend_following",
      "admitted"
    );
    duplicate.commitment.development_policy.suite_digest =
      earlier.commitment.development_policy.suite_digest;
    resealCommitmentGraph(duplicate);
    const duplicateFingerprint = behaviorFingerprint(
      duplicate,
      "behavior-valid-duplicate"
    );
    fixture.fingerprints.push(duplicateFingerprint);
    bindBehaviorComparison(
      duplicate,
      duplicateFingerprint,
      "duplicate",
      earlierFingerprint
    );

    await expect(fixture.service.readSessionDetail(
      workId(earlierAllocation, "trend_following")
    )).resolves.toMatchObject({ status: "admitted" });
    const detail = await fixture.service.readSessionDetail(
      workId(duplicateAllocation, "trend_following")
    );
    expect(detail).toMatchObject({
      status: "duplicate",
      status_basis: { basis_kind: "candidate_admission_decision" },
      selected_artifact_availability: "available",
      terminal_graph: {
        admission: { status: "duplicate", reason: "behavior_duplicate" },
        finding: {
          research_finding_ref: { id: duplicate.finding.research_finding_id }
        }
      }
    });
    expect(detail?.terminal_graph).toHaveProperty("paper_handoff_conformance.status", "passed");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("rejects re-digested writer-invalid allocation, methodology, and memory policy roots", async () => {
    const invalidAllocationFixture = graphFixture();
    const invalidAllocation = invalidAllocationFixture.addAllocation(
      "invalid-policy",
      ["trend_following"]
    );
    (invalidAllocation.policy as unknown as {
      maximum_total_experiment_budget: number;
    }).maximum_total_experiment_budget = 4;
    invalidAllocation.allocation_digest = digest(
      candidateArenaResearchAllocationDigestInput(invalidAllocation)
    );
    expect(await invalidAllocationFixture.service.readSessionDetail(
      workId(invalidAllocation, "trend_following")
    )).toBeUndefined();

    const commitmentCases: Array<{
      suffix: string;
      mutate(commitment: ResearchPreflightCommitmentRecord): void;
    }> = [{
      suffix: "invalid-methodology",
      mutate: (commitment) => {
        commitment.methodology!.method = "Bearer writer-invalid-secret";
      }
    }, {
      suffix: "invalid-memory-policy",
      mutate: (commitment) => {
        commitment.memory_policy = {
          protocol_version: "research_worker_memory_v1",
          memory_mode: "released_memory",
          memory_source_digest: digest("memory-source"),
          available_memory_item_count: 0,
          arena_context_digest: digest("arena-context"),
          prior_checkpoint: { disposition: "masked" }
        } as ResearchPreflightCommitmentRecord["memory_policy"];
      }
    }, {
      suffix: "invalid-memory-graph",
      mutate: (commitment) => {
        commitment.memory_policy = {
          protocol_version: "research_worker_memory_v1",
          memory_mode: "released_memory",
          memory_source_digest: digest("memory-source"),
          available_memory_item_count: 1,
          arena_context_digest: digest("arena-context"),
          prior_checkpoint: {
            disposition: "included",
            checkpoint_ref: ref("research_worker_checkpoint", "missing-checkpoint"),
            checkpoint_digest: digest("missing-checkpoint")
          }
        };
      }
    }, {
      suffix: "invalid-selection-budget",
      mutate: (commitment) => {
        commitment.development_policy.submission_limit = 2;
      }
    }, {
      suffix: "invalid-source-digest",
      mutate: (commitment) => {
        commitment.source_artifact_digest = digest("other-source-artifact");
      }
    }, {
      suffix: "invalid-commitment-chronology",
      mutate: (commitment) => {
        commitment.committed_at = after(commitment.committed_at, -2_000);
      }
    }, {
      suffix: "invalid-methodology-evidence",
      mutate: (commitment) => {
        commitment.methodology!.evidence_bindings = [{
          evidence_artifact_ref: ref(
            "research_evidence_artifact",
            "missing-evidence"
          ) as { record_kind: "research_evidence_artifact"; id: string },
          evidence_artifact_digest: digest("missing-evidence")
        }];
      }
    }];
    for (const testCase of commitmentCases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, ["trend_following"]);
      const commitment = fixture.addCommitment(allocation, "trend_following");
      testCase.mutate(commitment);
      commitment.commitment_digest = digest(
        researchPreflightCommitmentDigestInput(commitment)
      );

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );

      expect(detail, testCase.suffix).not.toHaveProperty("commitment_id");
      expect(detail?.selected_artifact_availability, testCase.suffix).toBe("not_selected");
      expect(detail?.terminal_graph, testCase.suffix).not.toHaveProperty(
        "admitted_arena_handoff"
      );
    }
  });

  it("emits no rows for either re-digested forged decision provenance family", async () => {
    for (const family of ["allocation", "generalization"] as const) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(`forged-${family}-decision`, [
        "trend_following",
        "mean_reversion",
        "volatility_regime"
      ]);
      makeAdaptiveDecisionAllocation(allocation, family);

      const operations = await fixture.service.readOperations();

      expect(operations.sessions, family).toEqual([]);
      await expect(fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      )).resolves.toBeUndefined();
    }
  });

  it("emits no rows when either approved decision is missing its source graph", async () => {
    for (const family of ["allocation", "generalization"] as const) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(`missing-${family}-source`, [
        "trend_following",
        "mean_reversion",
        "volatility_regime"
      ]);
      const graph = family === "allocation"
        ? sameBaselineDecisionGraph("supported", `missing-${family}`)
        : generalizationDecisionGraph("supported", `missing-${family}`);
      if (family === "allocation") {
        fixture.allocationPolicyDecisions.push(graph.decision as
          ResearchAllocationPolicyDecisionRecord);
      } else {
        fixture.generalizationPolicyDecisions.push(graph.decision as
          ResearchGeneralizationPolicyDecisionRecord);
      }
      bindAllocationToDecision(allocation, graph.decision);

      expect((await fixture.service.readOperations()).sessions, family).toEqual([]);
    }
  });

  it("suppresses every allocation with a duplicate raw origin ID", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("duplicate-origin", ["trend_following"]);
    fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    fixture.allocations.push(structuredClone(allocation));

    const result = await fixture.service.readOperations();

    expect(result.sessions).toEqual([]);
    await expect(fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    )).resolves.toBeUndefined();
  });

  it("suppresses every arena-event allocation claiming the same evidence digest", async () => {
    const fixture = graphFixture();
    const first = fixture.addAllocation(
      "arena-claim-first",
      ["trend_following"],
      0,
      false
    );
    const second = fixture.addAllocation(
      "arena-claim-second",
      ["mean_reversion"],
      1_000,
      false
    );
    const evidenceDigest = digest("shared-arena-event-evidence");
    const sourceRef = ref("research_finding", "shared-arena-event-source");
    for (const [index, allocation] of [first, second].entries()) {
      const evidenceId = `arena-event-evidence-${index + 1}`;
      fixture.evidence.push({
        record_kind: "research_evidence_artifact",
        version: 1,
        research_evidence_artifact_id: evidenceId,
        source_kind: "research_finding",
        subject_ref: { ...sourceRef },
        artifact_ref: { ...sourceRef },
        source_digest: digest(`arena-event-source-${index + 1}`),
        summary: "Sanitized Arena event evidence.",
        supporting_record_refs: [],
        captured_at: allocation.allocated_at,
        sanitization_policy: "research_evidence_sanitization_v1",
        sanitization_status: "sanitized",
        qualification_evidence_hidden: true,
        secrets_removed: true,
        host_paths_removed: true,
        truncated: false,
        artifact_digest: evidenceDigest,
        promotion_authority: false,
        order_submission_authority: false,
        live_exchange_authority: false,
        authority_status: "research_only"
      });
      allocation.trigger = {
        trigger_kind: "arena_event",
        trigger_id: `arena-event-trigger-${index + 1}`,
        goal: "Respond to one exact sanitized Arena event.",
        triggered_at: allocation.allocated_at,
        source_ref: { ...sourceRef },
        evidence_artifact_ref: ref("research_evidence_artifact", evidenceId) as {
          record_kind: "research_evidence_artifact";
          id: string;
        },
        evidence_artifact_digest: evidenceDigest,
        authority_status: "research_only"
      };
      allocation.allocation_digest = digest(
        candidateArenaResearchAllocationDigestInput(allocation)
      );
    }
    fixture.addTerminalGraph(first, "trend_following", "admitted");

    const result = await fixture.service.readOperations();

    expect(result.sessions).toEqual([]);
    await expect(fixture.service.readSessionDetail(
      workId(first, "trend_following")
    )).resolves.toBeUndefined();
    await expect(fixture.service.readSessionDetail(
      workId(second, "mean_reversion")
    )).resolves.toBeUndefined();
  });

  it("accepts only canonical uniquely owned evidence records for trigger and methodology joins", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "canonical-evidence",
      ["trend_following"],
      0,
      false
    );
    const evidence = evidenceArtifact("canonical-evidence", allocation.allocated_at);
    fixture.evidence.push(evidence);
    bindArenaEvidence(allocation, evidence);
    const commitment = fixture.addCommitment(allocation, "trend_following");
    commitment.methodology!.evidence_bindings = [{
      evidence_artifact_ref: ref(
        "research_evidence_artifact",
        evidence.research_evidence_artifact_id
      ) as { record_kind: "research_evidence_artifact"; id: string },
      evidence_artifact_digest: evidence.artifact_digest
    }];
    commitment.commitment_digest = digest(
      researchPreflightCommitmentDigestInput(commitment)
    );

    const clean = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );
    expect(clean).toMatchObject({
      commitment_id: commitment.research_preflight_commitment_id,
      trigger: {
        evidence_artifact_ref: {
          id: evidence.research_evidence_artifact_id
        }
      },
      evidence_inputs: [{
        evidence_artifact_id: evidence.research_evidence_artifact_id,
        summary: evidence.summary,
        truncated: false
      }]
    });

    const alias = structuredClone(evidence);
    alias.research_evidence_artifact_id = "evidence-canonical-evidence-alias";
    fixture.evidence.push(alias);

    const conflicted = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );
    expect(conflicted).not.toHaveProperty("commitment_id");
    expect(conflicted).toMatchObject({
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      degraded_reasons: expect.arrayContaining([
        "evidence_artifact_unavailable",
        "inactive_incomplete_graph"
      ])
    });
    expect(conflicted?.trigger).not.toHaveProperty("evidence_artifact_ref");

    const malformedFixture = graphFixture();
    const malformedAllocation = malformedFixture.addAllocation(
      "malformed-evidence",
      ["trend_following"],
      0,
      false
    );
    const malformedEvidence = evidenceArtifact(
      "malformed-evidence",
      malformedAllocation.allocated_at
    );
    (malformedEvidence as unknown as { secrets_removed: boolean })
      .secrets_removed = false;
    malformedEvidence.artifact_digest = digest(
      researchEvidenceArtifactDigestInput(malformedEvidence)
    );
    malformedFixture.evidence.push(malformedEvidence);
    bindArenaEvidence(malformedAllocation, malformedEvidence);
    const malformedCommitment = malformedFixture.addCommitment(
      malformedAllocation,
      "trend_following"
    );
    malformedCommitment.methodology!.evidence_bindings = [{
      evidence_artifact_ref: ref(
        "research_evidence_artifact",
        malformedEvidence.research_evidence_artifact_id
      ) as { record_kind: "research_evidence_artifact"; id: string },
      evidence_artifact_digest: malformedEvidence.artifact_digest
    }];
    malformedCommitment.commitment_digest = digest(
      researchPreflightCommitmentDigestInput(malformedCommitment)
    );

    const malformed = await malformedFixture.service.readSessionDetail(
      workId(malformedAllocation, "trend_following")
    );
    expect(malformed).not.toHaveProperty("commitment_id");
    expect(malformed).toMatchObject({
      degraded_reasons: expect.arrayContaining(["evidence_artifact_unavailable"])
    });
  });

  it("rejects privacy-unsafe evidence ref IDs before they reach the projection", async () => {
    const cases = [{
      suffix: "subject-path",
      field: "subject_ref" as const,
      unsafeId: "/Users/private-owner/research-subject"
    }, {
      suffix: "artifact-url",
      field: "artifact_ref" as const,
      unsafeId: "https://secret-user:secret-pass@example.test/evidence?token=url-secret"
    }, {
      suffix: "artifact-credential",
      field: "artifact_ref" as const,
      unsafeId: "OPENAI_API_KEY=assignment-secret"
    }, {
      suffix: "artifact-relative-path",
      field: "artifact_ref" as const,
      unsafeId: "../../private/notebook"
    }];
    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(
        `privacy-ref-${testCase.suffix}`,
        ["trend_following"],
        0,
        false
      );
      const evidence = evidenceArtifact(
        `privacy-ref-${testCase.suffix}`,
        allocation.allocated_at
      );
      evidence[testCase.field].id = testCase.unsafeId;
      evidence.artifact_digest = digest(researchEvidenceArtifactDigestInput(evidence));
      fixture.evidence.push(evidence);
      bindArenaEvidence(allocation, evidence);
      const commitment = fixture.addCommitment(allocation, "trend_following");
      commitment.methodology!.evidence_bindings = [{
        evidence_artifact_ref: ref(
          "research_evidence_artifact",
          evidence.research_evidence_artifact_id
        ) as { record_kind: "research_evidence_artifact"; id: string },
        evidence_artifact_digest: evidence.artifact_digest
      }];
      commitment.commitment_digest = digest(
        researchPreflightCommitmentDigestInput(commitment)
      );

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );
      const rendered = JSON.stringify(detail);

      expect(detail, testCase.suffix).not.toHaveProperty("commitment_id");
      expect(detail, testCase.suffix).toMatchObject({
        evidence_inputs: [],
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining([
          "evidence_artifact_unavailable",
          "inactive_incomplete_graph"
        ])
      });
      expect(rendered, testCase.suffix).not.toContain(testCase.unsafeId);
      for (const secret of [
        "private-owner",
        "secret-user",
        "secret-pass",
        "url-secret",
        "assignment-secret",
        "private/notebook"
      ]) {
        expect(rendered, `${testCase.suffix}:${secret}`).not.toContain(secret);
      }
    }
  });

  it("rejects every privacy-unsafe allocation ID before hashing or projection", async () => {
    const cases = [{
      suffix: "credential",
      unsafeId: "OPENAI_API_KEY=allocation-private-marker-credential"
    }, {
      suffix: "absolute-path",
      unsafeId: "/Users/allocation-private-marker-absolute/run"
    }, {
      suffix: "url",
      unsafeId: "https://example.test/allocation-private-marker-url?token=private"
    }, {
      suffix: "relative-path",
      unsafeId: "../../allocation-private-marker-relative/run"
    }, {
      suffix: "control",
      unsafeId: "allocation-private-marker-control\nvalue"
    }, {
      suffix: "oversize",
      unsafeId: `${"x".repeat(501)}-allocation-private-marker-oversize`
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(
        `privacy-allocation-${testCase.suffix}`,
        ["trend_following"]
      );
      allocation.candidate_arena_research_allocation_id = testCase.unsafeId;
      const requestedId = workId(allocation, "trend_following");

      const operations = await fixture.service.readOperations();
      const detail = await fixture.service.readSessionDetail(requestedId);
      const rendered = JSON.stringify({ operations, detail });

      expect(operations.sessions, testCase.suffix).toEqual([]);
      expect(detail, testCase.suffix).toBeUndefined();
      expect(rendered, testCase.suffix).not.toContain("allocation-private-marker");
    }
  });

  it("never serializes privacy-unsafe persisted record IDs or copied refs", async () => {
    const cases: Array<{
      suffix: string;
      marker: string;
      prepare(fixture: Fixture): string;
    }> = [{
      suffix: "commitment-id",
      marker: "commitment-private-marker",
      prepare: (fixture) => {
        const allocation = fixture.addAllocation("privacy-commitment-id", ["trend_following"]);
        const commitment = fixture.addCommitment(allocation, "trend_following");
        commitment.research_preflight_commitment_id =
          "OPENAI_API_KEY=commitment-private-marker";
        commitment.commitment_digest = digest(researchPreflightCommitmentDigestInput(commitment));
        return workId(allocation, "trend_following");
      }
    }, {
      suffix: "checkpoint-id",
      marker: "checkpoint-private-marker",
      prepare: (fixture) => {
        const allocation = fixture.addAllocation("privacy-checkpoint-id", ["trend_following"]);
        const commitment = fixture.addCommitment(allocation, "trend_following");
        const record = checkpoint(fixture, commitment, "finished_without_submission");
        record.research_worker_checkpoint_id = "/Users/checkpoint-private-marker/run";
        record.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(record));
        fixture.checkpoints.push(record);
        return workId(allocation, "trend_following");
      }
    }, {
      suffix: "tick-id",
      marker: "tick-private-marker",
      prepare: (fixture) => {
        const allocation = fixture.addAllocation("privacy-tick-id", ["trend_following"]);
        const record = tick(allocation, [{
          direction_kind: "trend_following",
          status: "no_submission",
          finding: "Research finished without a selection."
        }]);
        record.candidate_arena_tick_id =
          "https://example.test/tick-private-marker?token=private";
        fixture.ticks.push(record);
        return workId(allocation, "trend_following");
      }
    }, {
      suffix: "conformance-id",
      marker: "conformance-private-marker",
      prepare: (fixture) => {
        const allocation = fixture.addAllocation("privacy-conformance-id", ["trend_following"]);
        const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
        const unsafeId = `${"x".repeat(501)}-conformance-private-marker`;
        graph.conformance.paper_trading_handoff_conformance_id = unsafeId;
        graph.admission.paper_trading_handoff_conformance_ref!.id = unsafeId;
        fixture.ticks.at(-1)!.direction_results[0]!
          .paper_handoff_conformance!.conformance_id = unsafeId;
        return workId(allocation, "trend_following");
      }
    }, {
      suffix: "evidence-id",
      marker: "evidence-private-marker",
      prepare: (fixture) => {
        const allocation = fixture.addAllocation(
          "privacy-evidence-id",
          ["trend_following"],
          0,
          false
        );
        const evidence = evidenceArtifact("privacy-evidence-id", allocation.allocated_at);
        evidence.research_evidence_artifact_id = "../../evidence-private-marker/run";
        fixture.evidence.push(evidence);
        bindArenaEvidence(allocation, evidence);
        const commitment = fixture.addCommitment(allocation, "trend_following");
        commitment.methodology!.evidence_bindings = [{
          evidence_artifact_ref: ref(
            "research_evidence_artifact",
            evidence.research_evidence_artifact_id
          ) as { record_kind: "research_evidence_artifact"; id: string },
          evidence_artifact_digest: evidence.artifact_digest
        }];
        commitment.commitment_digest = digest(
          researchPreflightCommitmentDigestInput(commitment)
        );
        return workId(allocation, "trend_following");
      }
    }, {
      suffix: "copied-supporting-ref",
      marker: "supporting-ref-private-marker",
      prepare: (fixture) => {
        const allocation = fixture.addAllocation("privacy-supporting-ref", ["trend_following"]);
        const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
        graph.finding.supporting_record_refs.push({
          record_kind: "research_finding",
          id: "../../supporting-ref-private-marker/run"
        });
        return workId(allocation, "trend_following");
      }
    }];

    for (const testCase of cases) {
      const fixture = graphFixture();
      const requestedId = testCase.prepare(fixture);

      const detail = await fixture.service.readSessionDetail(requestedId);
      const rendered = JSON.stringify(detail);

      expect(rendered, testCase.suffix).not.toContain(testCase.marker);
    }
  });

  it("emits rows for both exact canonically re-derived approved decision graphs", async () => {
    const sameBaselineFixture = graphFixture();
    const sameBaselineAllocation = sameBaselineFixture.addAllocation(
      "valid-same-baseline",
      ["trend_following", "mean_reversion", "volatility_regime"]
    );
    const sameBaseline = sameBaselineDecisionGraph("supported", "valid-same-baseline");
    sameBaselineFixture.controlStudies.push(sameBaseline.study);
    sameBaselineFixture.controlStudyOutcomes.push(sameBaseline.outcome);
    sameBaselineFixture.allocationPolicyDecisions.push(sameBaseline.decision);
    bindAllocationToDecision(sameBaselineAllocation, sameBaseline.decision);
    expect((await sameBaselineFixture.service.readOperations()).sessions).toHaveLength(3);

    const broadFixture = graphFixture();
    const broadAllocation = broadFixture.addAllocation(
      "valid-generalization",
      ["trend_following", "mean_reversion", "volatility_regime"]
    );
    const broad = generalizationDecisionGraph("supported", "valid-generalization");
    broadFixture.generalizationProtocols.push(broad.protocol);
    broadFixture.generalizationOutcomes.push(broad.outcome);
    broadFixture.generalizationPolicyDecisions.push(broad.decision);
    bindAllocationToDecision(broadAllocation, broad.decision);
    expect((await broadFixture.service.readOperations()).sessions).toHaveLength(3);
  });

  it("rejects mutually re-sealed forged policy source roots", async () => {
    const sameBaselineFixture = graphFixture();
    const sameBaselineAllocation = sameBaselineFixture.addAllocation(
      "forged-campaign-root",
      ["trend_following", "mean_reversion", "volatility_regime"]
    );
    const sameBaseline = sameBaselineDecisionGraph("supported", "forged-campaign-root");
    sameBaseline.study.replications[0]!.campaign_ref.id =
      "research-control-campaign-forged-root";
    sameBaseline.outcome.replication_results[0]!.campaign_ref.id =
      sameBaseline.study.replications[0]!.campaign_ref.id;
    sameBaseline.study.study_digest = digest(
      researchControlStudyDigestInput(sameBaseline.study)
    );
    sameBaseline.outcome.study_digest = sameBaseline.study.study_digest;
    sameBaseline.outcome.study_outcome_digest = digest(
      researchControlStudyOutcomeDigestInput(sameBaseline.outcome)
    );
    sameBaseline.decision = decideResearchAllocationPolicyDecision({
      study: sameBaseline.study,
      outcome: sameBaseline.outcome,
      decidedAt: sameBaseline.decision.decided_at
    });
    sameBaselineFixture.controlStudies.push(sameBaseline.study);
    sameBaselineFixture.controlStudyOutcomes.push(sameBaseline.outcome);
    sameBaselineFixture.allocationPolicyDecisions.push(sameBaseline.decision);
    bindAllocationToDecision(sameBaselineAllocation, sameBaseline.decision);
    expect((await sameBaselineFixture.service.readOperations()).sessions).toEqual([]);

    const broadFixture = graphFixture();
    const broadAllocation = broadFixture.addAllocation(
      "forged-generalization-root",
      ["trend_following", "mean_reversion", "volatility_regime"]
    );
    const broad = generalizationDecisionGraph("supported", "forged-generalization-root");
    broad.protocol.paper_evaluation_protocol.protocol_digest =
      digest("forged-generalization-paper-protocol");
    broad.protocol.protocol_digest = digest(
      researchGeneralizationProtocolDigestInput(broad.protocol)
    );
    broad.outcome.protocol_digest = broad.protocol.protocol_digest;
    broad.outcome.slot_results[0]!.planned_study_ref.id =
      "research-control-study-forged-slot";
    broad.outcome.slot_results[0]!.study_ref!.id =
      broad.outcome.slot_results[0]!.planned_study_ref.id;
    broad.outcome.outcome_digest = digest(
      researchGeneralizationOutcomeDigestInput(broad.outcome)
    );
    broad.decision = decideResearchGeneralizationPolicyDecision({
      protocol: broad.protocol,
      outcome: broad.outcome,
      decidedAt: broad.decision.decided_at
    });
    broadFixture.generalizationProtocols.push(broad.protocol);
    broadFixture.generalizationOutcomes.push(broad.outcome);
    broadFixture.generalizationPolicyDecisions.push(broad.decision);
    bindAllocationToDecision(broadAllocation, broad.decision);
    expect((await broadFixture.service.readOperations()).sessions).toEqual([]);
  });

  it("rejects mutually re-digested approved shells over ineligible source outcomes", async () => {
    const sameBaselineFixture = graphFixture();
    const sameBaselineAllocation = sameBaselineFixture.addAllocation(
      "forged-ineligible-same-baseline",
      ["trend_following", "mean_reversion", "volatility_regime"]
    );
    const sameBaseline = sameBaselineDecisionGraph(
      "not_supported",
      "forged-ineligible-same-baseline"
    );
    forgeApprovedDecision(sameBaseline.decision);
    sameBaselineFixture.controlStudies.push(sameBaseline.study);
    sameBaselineFixture.controlStudyOutcomes.push(sameBaseline.outcome);
    sameBaselineFixture.allocationPolicyDecisions.push(sameBaseline.decision);
    bindAllocationToDecision(sameBaselineAllocation, sameBaseline.decision);
    expect((await sameBaselineFixture.service.readOperations()).sessions).toEqual([]);

    const broadFixture = graphFixture();
    const broadAllocation = broadFixture.addAllocation(
      "forged-ineligible-generalization",
      ["trend_following", "mean_reversion", "volatility_regime"]
    );
    const broad = generalizationDecisionGraph(
      "not_supported",
      "forged-ineligible-generalization"
    );
    forgeApprovedDecision(broad.decision);
    broadFixture.generalizationProtocols.push(broad.protocol);
    broadFixture.generalizationOutcomes.push(broad.outcome);
    broadFixture.generalizationPolicyDecisions.push(broad.decision);
    bindAllocationToDecision(broadAllocation, broad.decision);
    expect((await broadFixture.service.readOperations()).sessions).toEqual([]);
  });

  it("does not join a re-digested forged memory-control assignment", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("forged-control", ["trend_following"]);
    const commitment = fixture.addCommitment(allocation, "trend_following");
    commitment.memory_policy = {
      protocol_version: "research_worker_memory_v1",
      memory_mode: "released_memory",
      memory_source_digest: digest("memory-source"),
      available_memory_item_count: 1,
      arena_context_digest: digest("arena-context"),
      prior_checkpoint: { disposition: "none_available" },
      control_assignment: {
        study_ref: ref("research_memory_control_study", "missing-study"),
        study_digest: digest("missing-study"),
        pair_index: 1,
        arm_kind: "released_memory_treatment"
      }
    };
    commitment.commitment_digest = digest(
      researchPreflightCommitmentDigestInput(commitment)
    );

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).not.toHaveProperty("commitment_id");
    expect(detail?.selected_artifact_availability).toBe("not_selected");
    expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  });

  it("preserves exact memory-control source closure through terminal joins", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("memory-control-terminal", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    const study = bindMemoryControlTerminalGraph(fixture, allocation, graph);
    fixture.checkpoints.push(checkpoint(
      fixture,
      graph.commitment,
      "admission_recorded",
      [entry(graph.commitment.candidate_arena_tick_id, 1)],
      1,
      1,
      graph.admission.candidate_admission_decision_id
    ));

    expect(graph.sourceSystemCode.artifact_digest).not.toBe(
      study.source.research_artifact_closure_digest
    );
    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );
    expect(detail).toMatchObject({
      status: "admitted",
      status_basis: { basis_kind: "candidate_admission_decision" },
      terminal_graph: {
        selected_sealed_evaluation: {
          trading_evaluation_result_ref: {
            id: graph.evaluation.trading_evaluation_result_id
          }
        },
        admission: {
          candidate_admission_decision_ref: { id: graph.admission.candidate_admission_decision_id },
          status: "admitted"
        },
        finding: {
          research_finding_ref: { id: graph.finding.research_finding_id }
        }
      }
    });
    expect(detail?.lifecycle_events).toContainEqual(expect.objectContaining({
      event_kind: "checkpoint"
    }));

    const forgedFixture = graphFixture();
    const forgedAllocation = forgedFixture.addAllocation(
      "memory-control-forged-closure",
      ["trend_following"]
    );
    const forgedGraph = forgedFixture.addTerminalGraph(
      forgedAllocation,
      "trend_following",
      "admitted"
    );
    bindMemoryControlTerminalGraph(forgedFixture, forgedAllocation, forgedGraph);
    forgedGraph.commitment.source_artifact_digest = digest("forged-memory-control-closure");
    forgedGraph.commitment.commitment_digest = digest(
      researchPreflightCommitmentDigestInput(forgedGraph.commitment)
    );
    forgedGraph.evaluation.research_preflight_commitment_digest =
      forgedGraph.commitment.commitment_digest;
    forgedGraph.admission.research_preflight_commitment_digest =
      forgedGraph.commitment.commitment_digest;
    forgedGraph.admission.source_artifact_digest =
      forgedGraph.commitment.source_artifact_digest;

    const forgedDetail = await forgedFixture.service.readSessionDetail(
      workId(forgedAllocation, "trend_following")
    );
    expect(forgedDetail).not.toHaveProperty("commitment_id");
    expect(forgedDetail?.status).not.toBe("admitted");
    expect(forgedDetail?.terminal_graph).not.toHaveProperty("admission");
  });

  it("rejects a re-sealed memory-control source with a false SystemCode record digest", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "memory-control-system-code-record",
      ["trend_following"]
    );
    const graph = fixture.addTerminalGraph(
      allocation,
      "trend_following",
      "admitted"
    );
    const study = bindMemoryControlTerminalGraph(fixture, allocation, graph);
    study.source.system_code_record_digest = digest("forged-system-code-record");
    study.study_digest = digest(researchMemoryControlStudyDigestInput(study));
    graph.commitment.memory_policy!.control_assignment!.study_digest = study.study_digest;
    resealCommitmentGraph(graph);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expectNoTerminalAuthority(detail);
    expect(detail).not.toHaveProperty("commitment_id");
    expect(detail).toMatchObject({
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
    });
  });

  it("ignores terminal ticks with malformed selected-direction shape or ordering", async () => {
    const cases: Array<{
      suffix: string;
      mutate(record: CandidateArenaTickRecord): void;
    }> = [{
      suffix: "tick-direction-order",
      mutate: (record) => { record.direction_results.reverse(); }
    }, {
      suffix: "tick-direction-shape",
      mutate: (record) => { delete record.direction_results[0]!.error; }
    }];
    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, [
        "trend_following",
        "mean_reversion"
      ]);
      const record = tick(allocation, allocation.selected_directions.map((selection) => ({
        direction_kind: selection.direction_kind,
        status: "failed" as const,
        error: "Research failed closed."
      })));
      testCase.mutate(record);
      fixture.ticks.push(record);

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );

      expect(detail?.status, testCase.suffix).toBe("recovering");
      expect(detail?.status_basis.basis_kind, testCase.suffix)
        .toBe("incomplete_persisted_graph");
    }
  });

  it("keeps malformed tick chronology visible but denies it terminal authority", async () => {
    const cases: Array<{
      suffix: string;
      mutate(record: CandidateArenaTickRecord, allocation: CandidateArenaResearchAllocationRecord): void;
    }> = [{
      suffix: "legacy-timestamps",
      mutate: (record) => {
        record.started_at = "legacy-start-timestamp";
        record.completed_at = "legacy-completed-timestamp";
      }
    }, {
      suffix: "start-before-allocation",
      mutate: (record, allocation) => {
        record.started_at = after(allocation.allocated_at, -1);
      }
    }, {
      suffix: "completion-before-start",
      mutate: (record) => {
        record.completed_at = after(record.started_at, -1);
      }
    }];
    for (const testCase of cases) {
      const fixture = graphFixture();
      const allocation = fixture.addAllocation(testCase.suffix, ["trend_following"]);
      const record = tick(allocation, [{
        direction_kind: "trend_following",
        status: "failed",
        error: "Research failed closed."
      }]);
      testCase.mutate(record, allocation);
      fixture.ticks.push(record);

      const detail = await fixture.service.readSessionDetail(
        workId(allocation, "trend_following")
      );

      expect(detail, testCase.suffix).toMatchObject({
        status: "recovering",
        status_basis: { basis_kind: "incomplete_persisted_graph" },
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
      });
      expect(detail, testCase.suffix).not.toHaveProperty("completed_at");
      expect(detail?.lifecycle_events, testCase.suffix).not.toContainEqual(
        expect.objectContaining({ event_kind: "tick" })
      );
    }
  });

  it("does not let a tick complete a session before its exact commitment starts", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "tick-before-commitment",
      ["trend_following"]
    );
    const commitment = fixture.addCommitment(allocation, "trend_following");
    commitment.committed_at = after(allocation.allocated_at, 6_000);
    commitment.commitment_digest = digest(
      researchPreflightCommitmentDigestInput(commitment)
    );
    fixture.ticks.push(tick(allocation, [{
      direction_kind: "trend_following",
      status: "no_submission",
      finding: "Research finished without a selection."
    }]));

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      started_at: commitment.committed_at,
      status: "recovering",
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
    });
    expect(detail).not.toHaveProperty("completed_at");
    expect(detail?.lifecycle_events).not.toContainEqual(
      expect.objectContaining({ event_kind: "tick" })
    );
  });

  it("does not let a tick start after its exact commitment and supply terminal authority", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "tick-starts-after-commitment",
      ["trend_following"]
    );
    const commitment = fixture.addCommitment(allocation, "trend_following");
    const lateTick = tick(allocation, [{
      direction_kind: "trend_following",
      status: "no_submission",
      finding: "Research finished without a selection."
    }]);
    lateTick.started_at = after(commitment.committed_at, 1);
    lateTick.completed_at = after(lateTick.started_at, 1);
    fixture.ticks.push(lateTick);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      started_at: commitment.committed_at,
      status: "recovering",
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
    });
    expect(detail).not.toHaveProperty("completed_at");
    expect(detail?.lifecycle_events).not.toContainEqual(
      expect.objectContaining({ event_kind: "tick" })
    );
  });

  it("fails the preflight join closed when its worker is unavailable", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("degraded", ["other"], 0, false);
    fixture.addCommitment(allocation, "other");
    fixture.workers.length = 0;

    const detail = await fixture.service.readSessionDetail(workId(allocation, "other"));

    expect(detail).toMatchObject({
      trigger_availability: "unavailable",
      methodology_availability: "unavailable",
      provider_availability: "unavailable",
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining([
        "trigger_unavailable",
        "methodology_unavailable",
        "worker_unavailable",
        "provider_unavailable",
        "inactive_incomplete_graph"
      ])
    });
  });

  it("rejects a re-sealed memory-control study with a forged deterministic identity", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation(
      "memory-control-forged-root",
      ["trend_following"]
    );
    const graph = fixture.addTerminalGraph(
      allocation,
      "trend_following",
      "admitted"
    );
    const study = bindMemoryControlTerminalGraph(fixture, allocation, graph);
    study.research_memory_control_study_id =
      "research-memory-control-study-forged-root";
    study.study_digest = digest(researchMemoryControlStudyDigestInput(study));
    graph.commitment.memory_policy!.control_assignment!.study_ref.id =
      study.research_memory_control_study_id;
    graph.commitment.memory_policy!.control_assignment!.study_digest =
      study.study_digest;
    resealCommitmentGraph(graph);

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expectNoTerminalAuthority(detail);
    expect(detail).not.toHaveProperty("commitment_id");
    expect(detail).toMatchObject({
      status_basis: { basis_kind: "incomplete_persisted_graph" },
      degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
    });
  });

  it("re-sanitizes and bounds rendered text, checkpoint history, and controlled events", async () => {
    const fixture = graphFixture();
    const pem = ["-----BEGIN ", "PRIVATE", " KEY-----\npem-secret\n-----END ", "PRIVATE", " KEY-----"].join("");
    const unsafe = [
      "/Users/private-owner/run/notebook.json",
      "C:\\Users\\private-owner\\run\\notebook.json",
      "https://secret-user:secret-pass@example.test/private?token=url-secret",
      "Bearer bearer-secret",
      "OPENAI_API_KEY=assignment-secret",
      pem,
      "control\u0001text",
      "x".repeat(2_000)
    ].join(" ");
    const allocation = fixture.addAllocation("private", ["trend_following"]);
    const commitment = fixture.addCommitment(allocation, "trend_following");
    fixture.checkpoints.push(checkpoint(fixture,
      commitment,
      "execution_failed",
      [{
        ...entry(commitment.candidate_arena_tick_id, 1),
        summary: unsafe.slice(0, 500)
      }],
      1,
      1
    ));
    fixture.ticks.push(tick(allocation, [{
      direction_kind: "trend_following",
      status: "failed",
      error: unsafe
    }]));

    const detail = await fixture.service.readSessionDetail(workId(allocation, "trend_following"));
    const rendered = JSON.stringify(detail);

    for (const secret of [
      "private-owner",
      "secret-pass",
      "url-secret",
      "bearer-secret",
      "assignment-secret",
      "pem-secret",
      "\u0001"
    ]) {
      expect(rendered).not.toContain(secret);
    }
    expect(detail?.trigger_availability === "available" && detail.trigger.goal.length)
      .toBeLessThanOrEqual(500);
    expect(detail?.methodology_availability === "available" && detail.methodology.method.length)
      .toBeLessThanOrEqual(500);
    expect(detail?.development_submissions).toHaveLength(1);
    expect(detail?.notebook_summary).toHaveLength(1);
    expect(detail?.provider_logs_availability).toBe("not_persisted");
    expect(detail?.submission_history_truncated).toBe(false);
  });

  it("signals every projected free-text truncation without silently slicing", async () => {
    const fixture = graphFixture();
    const allocation = fixture.addAllocation("text-truncation", ["trend_following"]);
    const graph = fixture.addTerminalGraph(allocation, "trend_following", "admitted");
    allocation.trigger!.goal = "g".repeat(700);
    allocation.allocation_digest = digest(
      candidateArenaResearchAllocationDigestInput(allocation)
    );
    graph.commitment.research_allocation_digest = allocation.allocation_digest;
    fixture.ticks[0]!.research_allocation_digest = allocation.allocation_digest;
    graph.commitment.methodology!.hypothesis = "h".repeat(700);
    graph.commitment.methodology!.method = "m".repeat(700);
    const worker = fixture.workers.find((candidate) =>
      candidate.research_worker_id === graph.commitment.research_worker_ref.id
    )!;
    worker.model = "p".repeat(700);
    graph.finding.summary = "f".repeat(700);
    resealCommitmentGraph(graph);
    fixture.checkpoints.push(checkpoint(
      fixture,
      graph.commitment,
      "admission_recorded",
      [{
        ...entry(graph.commitment.candidate_arena_tick_id, 1),
        summary: "s".repeat(500)
      }],
      1,
      1,
      graph.admission.candidate_admission_decision_id
    ));

    const detail = await fixture.service.readSessionDetail(
      workId(allocation, "trend_following")
    );

    expect(detail).toMatchObject({
      latest_progress_summary_truncated: false,
      trigger: { goal_truncated: true },
      methodology: {
        hypothesis_truncated: true,
        method_truncated: true
      },
      provider_availability: "available",
      model_truncated: true,
      development_submissions: [{
        summary_truncated: false
      }],
      notebook_summary_truncated: false,
      terminal_graph: {
        finding: { summary_truncated: true }
      }
    });
    expect(detail?.trigger_availability === "available" && detail.trigger.goal.length)
      .toBe(500);
    expect(detail?.methodology_availability === "available" &&
      detail.methodology.hypothesis.length).toBe(500);
    expect(detail?.provider_availability === "available" && detail.model?.length)
      .toBe(500);
    expect(detail?.terminal_graph.finding?.summary.length).toBe(500);
    expect(detail?.lifecycle_events.every((event) =>
      event.summary_truncated === false)).toBe(true);

    const evidenceFixture = graphFixture();
    const evidenceAllocation = evidenceFixture.addAllocation(
      "evidence-text-truncation",
      ["trend_following"],
      0,
      false
    );
    const evidence = evidenceArtifact(
      "evidence-text-truncation",
      evidenceAllocation.allocated_at,
      "e".repeat(700)
    );
    evidenceFixture.evidence.push(evidence);
    bindArenaEvidence(evidenceAllocation, evidence);
    const evidenceCommitment = evidenceFixture.addCommitment(
      evidenceAllocation,
      "trend_following"
    );
    evidenceCommitment.methodology!.evidence_bindings = [{
      evidence_artifact_ref: ref(
        "research_evidence_artifact",
        evidence.research_evidence_artifact_id
      ) as { record_kind: "research_evidence_artifact"; id: string },
      evidence_artifact_digest: evidence.artifact_digest
    }];
    evidenceCommitment.commitment_digest = digest(
      researchPreflightCommitmentDigestInput(evidenceCommitment)
    );

    const evidenceDetail = await evidenceFixture.service.readSessionDetail(
      workId(evidenceAllocation, "trend_following")
    );
    expect(evidenceDetail).toMatchObject({
      latest_progress_summary_truncated: true,
      evidence_inputs: [{
        summary: "e".repeat(500),
        truncated: true
      }]
    });
  });

  it("derives degraded, stopping, and stopped loop states from health and recovery", async () => {
    const recoveringFixture = graphFixture();
    const older = recoveringFixture.addAllocation("recovering-loop", ["trend_following"]);
    const active = recoveringFixture.addAllocation("active-loop", ["mean_reversion"], 1_000);
    recoveringFixture.health = runningHealth(active.tick_id, []);
    await expect(recoveringFixture.service.readOperations()).resolves.toMatchObject({
      loop_status: "degraded"
    });

    const failureFixture = graphFixture();
    const failureActive = failureFixture.addAllocation("failure-loop", ["trend_following"]);
    failureFixture.health = {
      ...runningHealth(failureActive.tick_id, []),
      consecutive_failure_count: 1
    };
    await expect(failureFixture.service.readOperations()).resolves.toMatchObject({
      loop_status: "degraded"
    });

    const drainingFixture = graphFixture();
    drainingFixture.health = {
      ...stoppedHealth(),
      active_tick: true,
      active_tick_id: "tick-draining"
    };
    await expect(drainingFixture.service.readOperations()).resolves.toMatchObject({
      loop_status: "stopping"
    });

    const stoppedFixture = graphFixture();
    await expect(stoppedFixture.service.readOperations()).resolves.toMatchObject({
      loop_status: "stopped"
    });

    expect(older.tick_id).toBe("tick-recovering-loop");
  });
});

function stoppedHealth(): CandidateArenaRunnerHealthReadModel {
  return {
    status: "stopped",
    tick_count: 0,
    completed_tick_count: 0,
    active_tick: false,
    active_research_work_items: [],
    consecutive_failure_count: 0,
    runtime_coordination_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "runtime_coordination_only"
  };
}

interface Fixture {
  store: OuroborosStorePort;
  allocations: CandidateArenaResearchAllocationRecord[];
  ticks: CandidateArenaTickRecord[];
  commitments: ResearchPreflightCommitmentRecord[];
  workers: ResearchWorkerRecord[];
  directions: ResearchDirectionRecord[];
  evidence: ResearchEvidenceArtifactRecord[];
  fingerprints: ResearchBehaviorFingerprintRecord[];
  checkpoints: ResearchWorkerCheckpointRecord[];
  evaluations: TradingEvaluationResultRecord[];
  experiments: ExperimentRunRecord[];
  admissions: CandidateAdmissionDecisionRecord[];
  conformances: PaperTradingHandoffConformanceRecord[];
  findings: ResearchFindingRecord[];
  lineages: ArtifactLineageRecord[];
  allocationPolicyDecisions: ResearchAllocationPolicyDecisionRecord[];
  generalizationPolicyDecisions: ResearchGeneralizationPolicyDecisionRecord[];
  controlStudies: ResearchControlStudyRecord[];
  controlStudyOutcomes: ResearchControlStudyOutcomeRecord[];
  generalizationProtocols: ResearchGeneralizationProtocolRecord[];
  generalizationOutcomes: ResearchGeneralizationOutcomeRecord[];
  memoryControlStudies: ResearchMemoryControlStudyRecord[];
  systemCodes: Map<string, SystemCodeRecord>;
  candidates: Map<string, CandidateInspectReadModel>;
  health: CandidateArenaRunnerHealthReadModel;
  service: ResearchOperationsProjectionService;
  addAllocation(
    suffix: string,
    directions: ResearchDirectionKind[],
    timeOffset?: number,
    withTrigger?: boolean
  ): CandidateArenaResearchAllocationRecord;
  addCommitment(
    allocation: CandidateArenaResearchAllocationRecord,
    direction: ResearchDirectionKind,
    workerId?: string
  ): ResearchPreflightCommitmentRecord;
  addTerminalGraph(
    allocation: CandidateArenaResearchAllocationRecord,
    direction: ResearchDirectionKind,
    status: "admitted" | "duplicate" | "quarantined",
    workerId?: string
  ): TerminalFixture;
}

interface TerminalFixture {
  commitment: ResearchPreflightCommitmentRecord;
  sourceSystemCode: SystemCodeRecord;
  evaluation: TradingEvaluationResultRecord;
  experiment: ExperimentRunRecord;
  admission: CandidateAdmissionDecisionRecord;
  conformance: PaperTradingHandoffConformanceRecord;
  finding: ResearchFindingRecord;
  lineage: ArtifactLineageRecord;
  systemCode: SystemCodeRecord;
}

function graphFixture(): Fixture {
  const fixture = {
    allocations: [], ticks: [], commitments: [], workers: [], directions: [],
    evidence: [], fingerprints: [], checkpoints: [], evaluations: [], experiments: [], admissions: [],
    conformances: [], findings: [], lineages: [], systemCodes: new Map(),
    candidates: new Map(),
    allocationPolicyDecisions: [], generalizationPolicyDecisions: [],
    controlStudies: [], controlStudyOutcomes: [],
    generalizationProtocols: [], generalizationOutcomes: [],
    memoryControlStudies: [],
    health: stoppedHealth()
  } as unknown as Fixture;
  const store = {
    listCandidateArenaResearchAllocations: async () => fixture.allocations,
    listCandidateArenaTicks: async () => fixture.ticks,
    listResearchPreflightCommitments: async () => fixture.commitments,
    listResearchWorkers: async () => fixture.workers,
    listResearchDirections: async () => fixture.directions,
    listResearchEvidenceArtifacts: async () => fixture.evidence,
    listResearchBehaviorFingerprints: async () => fixture.fingerprints,
    listResearchWorkerCheckpoints: async () => fixture.checkpoints,
    listTradingEvaluationResults: async () => fixture.evaluations,
    listExperimentRuns: async () => fixture.experiments,
    listCandidateAdmissionDecisions: async () => fixture.admissions,
    listPaperTradingHandoffConformances: async () => fixture.conformances,
    listResearchFindings: async () => fixture.findings,
    listArtifactLineages: async () => fixture.lineages,
    listResearchAllocationPolicyDecisions: async () => fixture.allocationPolicyDecisions,
    listResearchGeneralizationPolicyDecisions: async () =>
      fixture.generalizationPolicyDecisions,
    listResearchControlStudies: async () => fixture.controlStudies,
    listResearchControlStudyOutcomes: async () => fixture.controlStudyOutcomes,
    listResearchGeneralizationProtocols: async () => fixture.generalizationProtocols,
    listResearchGeneralizationOutcomes: async () => fixture.generalizationOutcomes,
    listResearchMemoryControlStudies: async () => fixture.memoryControlStudies,
    getSystemCode: async (id: string) => fixture.systemCodes.get(id),
    getCandidate: async (id: string) => fixture.candidates.get(id)
  } as unknown as OuroborosStorePort;
  fixture.store = store;
  fixture.service = new ResearchOperationsProjectionService({
    store,
    runnerHealth: () => fixture.health
  });
  fixture.addAllocation = (suffix, directions, timeOffset = 0, withTrigger = true) =>
    addAllocation(fixture, suffix, directions, timeOffset, withTrigger);
  fixture.addCommitment = (allocation, kind, workerId) =>
    addCommitment(fixture, allocation, kind, workerId);
  fixture.addTerminalGraph = (allocation, kind, status, workerId) =>
    addTerminalGraph(fixture, allocation, kind, status, workerId);
  return fixture;
}

function materializedCandidate(
  candidateId: string,
  systemCode: SystemCodeRecord
): CandidateInspectReadModel {
  const versionId = `version-${candidateId}`;
  const attemptId = `materialization-${candidateId}`;
  const systemCodeRef = ref("system_code", systemCode.system_code_id);
  return {
    candidate_id: candidateId,
    display_name: `Candidate ${candidateId}`,
    status: "materialized",
    active_version_id: versionId,
    fixture_notice: { is_fixture: false, message: "materialized" },
    trading_system: {
      system_id: candidateId,
      version_id: versionId,
      ref: ref("trading_system_candidate", candidateId),
      status: "materialized",
      summary: `Trading system ${candidateId}`
    },
    system_code: {
      ref: systemCodeRef,
      summary: `SystemCode ${systemCode.system_code_id}`,
      declared_outputs: ["order_request"]
    },
    candidate_version: {
      candidate_version_id: versionId,
      version_label: "v1",
      provenance_refs: [],
      materialization_attempt_ref: ref("candidate_materialization_attempt", attemptId)
    },
    materialization_attempt: {
      attempt_id: attemptId,
      idempotency_key: `materialize-${candidateId}`,
      provider_kind: "codex_cli",
      model: "gpt-test",
      agent_run_ref: ref("agent_run", `agent-run-${candidateId}`),
      trace_ref: ref("trace_placeholder", `trace-${candidateId}`),
      status: "materialized",
      validation_status: "accepted",
      resulting_candidate_ref: ref("trading_system_candidate", candidateId),
      artifact_refs: [systemCodeRef],
      created_at: systemCode.created_at,
      authority_label: "provider_output_not_evidence"
    },
    full_cycle_lineage: {
      handoff_status: "runnable",
      source: {
        trading_system_id: `source-${candidateId}`,
        candidate_version_id: `source-version-${candidateId}`
      },
      generated: {
        system_code_ref: systemCodeRef,
        artifact_digest: systemCode.artifact_digest,
        generated_by_agent: true
      },
      materialized: {
        trading_system_id: candidateId,
        candidate_version_id: versionId,
        system_code_ref: systemCodeRef
      }
    }
  } as unknown as CandidateInspectReadModel;
}

function addAllocation(
  fixture: Fixture,
  suffix: string,
  kinds: ResearchDirectionKind[],
  timeOffset: number,
  withTrigger: boolean
): CandidateArenaResearchAllocationRecord {
  const allocatedAt = new Date(Date.parse("2026-07-23T00:00:00.000Z") + timeOffset)
    .toISOString();
  const allocation = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id: `allocation-${suffix}`,
    tick_id: `tick-${suffix}`,
    allocation_mode: "explicit",
    allocation_policy_basis: { basis_kind: "explicit_request" },
    ...(withTrigger ? {
      trigger: {
        trigger_kind: "goal",
        trigger_id: `trigger-${suffix}`,
        goal: `Goal ${suffix}`,
        triggered_at: allocatedAt,
        authority_status: "research_only"
      }
    } : {}),
    policy: {
      policy_kind: "bounded_adaptive_v1",
      default_direction_slot_count: 3,
      maximum_focus_direction_count: 2,
      minimum_exploration_direction_count: 1,
      concurrency_limit: 2,
      focus_experiment_budget: 2,
      exploration_experiment_budget: 1,
      explicit_experiment_budget: 1,
      maximum_total_experiment_budget: 5
    },
    source_tick_refs: [],
    signal_snapshot: [],
    selected_directions: kinds.map((directionKind, index) => ({
      direction_kind: directionKind,
      selection_kind: "explicit",
      priority: index + 1,
      experiment_budget: 1,
      signal_score: 0,
      reasons: ["explicit request"]
    })),
    deferred_directions: ([
      "trend_following",
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk",
      "execution_cost_robustness"
    ] as ResearchDirectionKind[]).filter((kind) => !kinds.includes(kind)),
    allocated_at: allocatedAt,
    allocation_digest: digest("allocation-placeholder"),
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  } as CandidateArenaResearchAllocationRecord;
  allocation.allocation_digest = digest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
  fixture.allocations.push(allocation);
  for (const kind of kinds) {
    if (!fixture.directions.some((candidate) => candidate.direction_kind === kind)) {
      fixture.directions.push(direction(kind, allocatedAt));
    }
  }
  return allocation;
}

function makeAdaptiveDecisionAllocation(
  allocation: CandidateArenaResearchAllocationRecord,
  family: "allocation" | "generalization" = "allocation"
): void {
  const directions: ResearchDirectionKind[] = [
    "trend_following",
    "mean_reversion",
    "volatility_regime",
    "funding_aware_risk",
    "execution_cost_robustness"
  ];
  allocation.allocation_mode = "adaptive_default";
  allocation.allocation_policy_basis = family === "allocation" ? {
    basis_kind: "research_allocation_policy_decision",
    policy_decision_ref: ref(
      "research_allocation_policy_decision",
      "forged-approved-decision"
    ),
    policy_decision_digest: digest("forged-approved-decision"),
    study_outcome_ref: ref("research_control_study_outcome", "forged-outcome"),
    study_outcome_digest: digest("forged-outcome")
  } : {
    basis_kind: "research_generalization_policy_decision",
    policy_decision_ref: ref(
      "research_generalization_policy_decision",
      "forged-generalization-decision"
    ),
    policy_decision_digest: digest("forged-generalization-decision"),
    generalization_outcome_ref: ref(
      "research_generalization_outcome",
      "forged-generalization-outcome"
    ),
    generalization_outcome_digest: digest("forged-generalization-outcome")
  };
  allocation.signal_snapshot = directions.map((directionKind, index) => ({
    direction_kind: directionKind,
    finding_pressure_score: index < 2 ? 2 : 0,
    research_efficiency_score: 0,
    recent_outcome_score: 0,
    focus_score: index < 2 ? 2 : 0,
    completed_selection_count: 0,
    source_candidate_ids: [],
    source_tick_ids: [],
    reasons: ["bounded signal"]
  }));
  allocation.selected_directions = directions.slice(0, 3).map(
    (directionKind, index) => ({
      direction_kind: directionKind,
      selection_kind: index < 2 ? "focus" : "exploration",
      priority: index + 1,
      experiment_budget: index < 2 ? 2 : 1,
      signal_score: index < 2 ? 2 : 0,
      reasons: ["bounded selection"]
    })
  );
  allocation.deferred_directions = directions.slice(3);
  allocation.allocation_digest = digest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
}

function bindAllocationToDecision(
  allocation: CandidateArenaResearchAllocationRecord,
  decision: ResearchAllocationPolicyDecisionRecord |
    ResearchGeneralizationPolicyDecisionRecord
): void {
  makeAdaptiveDecisionAllocation(allocation);
  allocation.allocation_policy_basis = decision.record_kind ===
    "research_allocation_policy_decision" ? {
      basis_kind: "research_allocation_policy_decision",
      policy_decision_ref: ref(
        "research_allocation_policy_decision",
        decision.research_allocation_policy_decision_id
      ),
      policy_decision_digest: decision.policy_decision_digest,
      study_outcome_ref: { ...decision.study_outcome_ref },
      study_outcome_digest: decision.study_outcome_digest
    } : {
      basis_kind: "research_generalization_policy_decision",
      policy_decision_ref: ref(
        "research_generalization_policy_decision",
        decision.research_generalization_policy_decision_id
      ),
      policy_decision_digest: decision.policy_decision_digest,
      generalization_outcome_ref: { ...decision.generalization_outcome_ref },
      generalization_outcome_digest: decision.generalization_outcome_digest
    };
  allocation.allocation_digest = digest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
}

function forgeApprovedDecision(
  decision: ResearchAllocationPolicyDecisionRecord |
    ResearchGeneralizationPolicyDecisionRecord
): void {
  decision.decision_status = "approved";
  decision.effective_default_mode = "adaptive_default";
  if (decision.record_kind === "research_allocation_policy_decision") {
    decision.decision_reason = "supported_same_baseline_adaptive_effect";
    decision.policy_decision_digest = digest(
      researchAllocationPolicyDecisionDigestInput(decision)
    );
  } else {
    decision.decision_reason = "supported_cross_condition_adaptive_effect";
    decision.policy_decision_digest = digest(
      researchGeneralizationPolicyDecisionDigestInput(decision)
    );
  }
}

function sameBaselineDecisionGraph(
  kind: "supported" | "not_supported",
  token: string
): {
  study: ResearchControlStudyRecord;
  outcome: ResearchControlStudyOutcomeRecord;
  decision: ResearchAllocationPolicyDecisionRecord;
} {
  const differences = Array.from({ length: 6 }, () => kind === "supported" ? 1 : -1);
  const study = decideResearchControlStudy({
    idempotencyKey: `${token}-study`,
    baselineSnapshotDigest: digest(`${token}-baseline`),
    condition: researchControlStudyCondition(token),
    replicationIdempotencyKeys: differences.map((_, index) =>
      `${token}-replication-${index + 1}`
    ),
    committedAt: "2026-07-12T09:00:00.000Z"
  });
  const positive = differences.filter((value) => value > 0).length;
  const negative = differences.filter((value) => value < 0).length;
  const tied = differences.length - positive - negative;
  const nonTied = positive + negative;
  const mean = round6(differences.reduce((sum, value) => sum + value, 0) /
    differences.length);
  const pValue = exactSignPValue(positive, negative);
  const supported = nonTied >= 6 && positive > negative && pValue <= 0.05 && mean > 0;
  const outcome: ResearchControlStudyOutcomeRecord = {
    record_kind: "research_control_study_outcome",
    version: 1,
    research_control_study_outcome_id: researchControlStudyOutcomeId(study),
    study_ref: ref("research_control_study", study.research_control_study_id),
    study_digest: study.study_digest,
    replication_results: differences.map((difference, index) => ({
      replication_index: index + 1,
      campaign_ref: { ...study.replications[index]!.campaign_ref },
      campaign_digest: digest(`${token}-campaign-${index}`),
      campaign_outcome_ref: ref(
        "research_control_campaign_outcome",
        `${study.replications[index]!.campaign_ref.id}-outcome`
      ),
      campaign_outcome_digest: digest(`${token}-campaign-${index}`),
      observed_rate_difference: difference
    })),
    planned_replication_count: differences.length,
    completed_replication_count: differences.length,
    adaptive_positive_count: positive,
    static_positive_count: negative,
    tied_count: tied,
    non_tied_count: nonTied,
    mean_rate_difference: mean,
    exact_sign_test_p_value: pValue,
    inference_status: supported
      ? "adaptive_effect_supported"
      : "adaptive_effect_not_supported",
    causal_scope: "same_baseline_stochastic_replication_only",
    policy_decision_eligibility: supported
      ? "eligible_for_separate_policy_decision"
      : "not_eligible",
    next_action: supported
      ? "review_research_allocation_policy"
      : "accumulate_or_redesign_precommitted_study",
    adjudicated_at: "2026-07-12T12:00:00.000Z",
    study_outcome_digest: digest("pending"),
    evaluation_authority: "external_to_trading_systems",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  outcome.study_outcome_digest = digest(
    researchControlStudyOutcomeDigestInput(outcome)
  );
  const decision = decideResearchAllocationPolicyDecision({
    study,
    outcome,
    decidedAt: "2026-07-12T13:00:00.000Z"
  });
  return { study, outcome, decision };
}

function researchControlStudyCondition(token: string) {
  const paperProtocol = boundPaperProtocol(`${token}-paper`);
  return {
    source: {
      candidate_ref: ref("trading_system_candidate", `${token}-source-candidate`),
      candidate_version_ref: ref("candidate_version", `${token}-source-version`),
      system_code_ref: ref("system_code", `${token}-source-system-code`),
      system_code_artifact_digest: digest(`${token}-source-artifact`),
      system_code_record_digest: digest(`${token}-source-record`),
      research_artifact_protocol: "single_file_python_v1" as const,
      research_artifact_closure_digest: digest(`${token}-source-closure`)
    },
    research_agent: {
      provider: "fixture" as const,
      model: "scripted-fixture",
      permission_policy: "fixture_only" as const,
      identity_digest: digest(`${token}-agent`)
    },
    paper_comparator: {
      comparator_status: "trading_review" as const,
      trading_promotion_ref: ref("trading_promotion", `${token}-promotion`),
      trading_promotion_digest: digest(`${token}-promotion`),
      candidate_ref: ref("trading_system_candidate", `${token}-champion`),
      candidate_version_ref: ref("candidate_version", `${token}-champion-version`),
      paper_trading_evaluation_ref: ref(
        "paper_trading_evaluation",
        `${token}-champion-evaluation`
      )
    },
    paper_evaluation_protocol: paperProtocol,
    allocation_policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    allocation_policy_digest: digest(
      paperTradingComparisonPersistedRecordDigestInput(
        CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
      )
    ),
    campaign_policy: researchCampaignPolicy()
  };
}

function generalizationDecisionGraph(
  kind: "supported" | "not_supported",
  token: string
): {
  protocol: ResearchGeneralizationProtocolRecord;
  outcome: ResearchGeneralizationOutcomeRecord;
  decision: ResearchGeneralizationPolicyDecisionRecord;
} {
  const protocol = decideResearchGeneralizationProtocol({
    idempotencyKey: token,
    targetAllocationPolicy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
    researchAgent: {
      provider: "fixture",
      model: "scripted-fixture",
      permission_policy: "fixture_only"
    },
    paperEvaluationProtocol: boundPaperProtocol(`${token}-paper`),
    campaignPolicy: researchCampaignPolicy(),
    committedAt: "2026-07-13T00:00:00.000Z"
  });
  const effects = kind === "supported"
    ? [1, 0.8, 0.6, 0.4, 0.2, 0.1]
    : [1, 0.8, 0.6, 0.4, -0.1, -0.3];
  const outcome = generalizationOutcomeFixture(protocol, effects, token);
  const decision = decideResearchGeneralizationPolicyDecision({
    protocol,
    outcome,
    decidedAt: "2026-07-20T00:00:01.000Z"
  });
  return { protocol, outcome, decision };
}

function generalizationOutcomeFixture(
  protocol: ResearchGeneralizationProtocolRecord,
  effects: number[],
  token: string
): ResearchGeneralizationOutcomeRecord {
  const baselineTokens = ["one", "two", "three", "one", "two", "three"];
  const slots = protocol.study_slots.map((slot, index) => {
    const effect = effects[index]!;
    return {
      slot_index: slot.slot_index,
      condition_block: slot.condition_block,
      condition_block_study_index: slot.condition_block_study_index,
      planned_study_ref: { ...slot.study_ref },
      slot_status: "completed" as const,
      status_reason: "eligible_terminal_study" as const,
      study_ref: { ...slot.study_ref },
      study_digest: digest(`${token}-study-${index}`),
      study_outcome_ref: ref(
        "research_control_study_outcome",
        `${slot.study_ref.id}-outcome`
      ),
      study_outcome_digest: digest(`${token}-study-outcome-${index}`),
      baseline_snapshot_digest: digest(`${token}-${baselineTokens[index]}`),
      source_system_code_artifact_digest: digest(`${token}-source-${index}`),
      observed_rate_difference: effect,
      study_effect_status: effect > 0
        ? "adaptive_positive" as const
        : effect < 0 ? "static_positive" as const : "tied" as const
    };
  });
  const blocks = (["long", "short", "flat"] as const).map((block, index) =>
    generalizationBlockResult(block, slots.slice(index * 2, index * 2 + 2))
  ) as [
    ResearchGeneralizationOutcomeBlockResult,
    ResearchGeneralizationOutcomeBlockResult,
    ResearchGeneralizationOutcomeBlockResult
  ];
  const positive = effects.filter((value) => value > 0).length;
  const negative = effects.filter((value) => value < 0).length;
  const tied = effects.length - positive - negative;
  const nonTied = positive + negative;
  const pValue = exactSignPValue(positive, negative);
  const mean = round6(blocks.reduce((sum, block) =>
    sum + Number(block.mean_rate_difference), 0) / 3);
  const harmful = blocks.filter((block) => Number(block.mean_rate_difference) <= 0)
    .map((block) => block.condition_block);
  const supported = nonTied === 6 && pValue <= 0.05 && mean > 0 && harmful.length === 0;
  const outcome: ResearchGeneralizationOutcomeRecord = {
    record_kind: "research_generalization_outcome",
    version: 1,
    research_generalization_outcome_id: researchGeneralizationOutcomeId(protocol),
    protocol_ref: ref(
      "research_generalization_protocol",
      protocol.research_generalization_protocol_id
    ),
    protocol_digest: protocol.protocol_digest,
    target_allocation_policy_digest: protocol.target_allocation_policy_digest,
    slot_results: slots,
    block_results: blocks,
    planned_study_count: 6,
    completed_study_count: 6,
    non_tied_study_count: nonTied,
    tied_study_count: tied,
    missing_study_count: 0,
    ineligible_study_count: 0,
    adaptive_positive_count: positive,
    static_positive_count: negative,
    distinct_baseline_count: 3,
    equal_weight_mean_rate_difference: mean,
    exact_sign_test_p_value: pValue,
    harmful_condition_blocks: harmful,
    inference_status: supported
      ? "generalization_supported"
      : "generalization_not_supported",
    causal_scope: "pre_effect_market_condition_blocked_cross_baseline_study_effects",
    policy_decision_eligibility: supported
      ? "eligible_for_separate_generalization_policy_decision"
      : "not_eligible",
    next_action: supported
      ? "review_broad_research_allocation_policy"
      : "retain_negative_generalization_evidence",
    adjudicated_at: "2026-07-20T00:00:00.000Z",
    outcome_digest: digest("pending"),
    evaluation_authority: "external_to_trading_systems",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  outcome.outcome_digest = digest(researchGeneralizationOutcomeDigestInput(outcome));
  return outcome;
}

function generalizationBlockResult(
  block: "long" | "short" | "flat",
  slots: Array<{ observed_rate_difference: number; baseline_snapshot_digest: string }>
): ResearchGeneralizationOutcomeBlockResult {
  const effects = slots.map((slot) => slot.observed_rate_difference);
  const positive = effects.filter((value) => value > 0).length;
  const negative = effects.filter((value) => value < 0).length;
  const tied = effects.length - positive - negative;
  const mean = round6(effects.reduce((sum, value) => sum + value, 0) / effects.length);
  return {
    condition_block: block,
    planned_study_count: 2,
    completed_study_count: 2,
    non_tied_study_count: positive + negative,
    tied_study_count: tied,
    missing_study_count: 0,
    ineligible_study_count: 0,
    adaptive_positive_count: positive,
    static_positive_count: negative,
    distinct_baseline_count: new Set(slots.map((slot) =>
      slot.baseline_snapshot_digest)).size,
    mean_rate_difference: mean,
    block_status: mean > 0 ? "complete_positive" : "complete_non_positive"
  };
}

function researchCampaignPolicy() {
  return {
    policy_version: "research_control_campaign_v1" as const,
    tick_count_per_arm: 1,
    worker_slot_count_per_tick: 3 as const,
    concurrency_limit_per_arm: 2 as const,
    maximum_total_development_submissions_per_tick: 5 as const,
    arm_execution_policy: "concurrent_per_sequence" as const,
    maximum_baseline_regular_file_count: 10_000,
    maximum_baseline_total_bytes: 1_000_000_000,
    paper_candidate_slot_count_per_arm: 1,
    paper_candidate_reservation_rule:
      "first_admitted_per_tick_in_allocation_order" as const,
    primary_metric_kind: "prospective_qualified_candidate_discovery_rate" as const,
    required_future_evidence: "confirmed_comparison_research_release" as const
  };
}

function boundPaperProtocol(token: string) {
  const protocol = {
    protocol_status: "bound" as const,
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge" as const,
      symbol: "BTCUSDT" as const,
      interval_ms: 60_000,
      minimum_observation_count: 2,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 2,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 2,
      primary_metric: "net_revenue_usdt" as const,
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true as const,
      require_both_qualified: true as const,
      release_policy: "sealed_until_adjudication" as const
    },
    market_data_configuration_digest: digest(`${token}-market`),
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
    },
    protocol_digest: digest("pending")
  };
  protocol.protocol_digest = digest(
    researchControlCampaignPaperEvaluationProtocolDigestInput(protocol)
  );
  return protocol;
}

function exactSignPValue(positive: number, negative: number): number {
  const count = positive + negative;
  if (count === 0) return 1;
  const lower = Math.min(positive, negative);
  let combinations = 0;
  for (let index = 0; index <= lower; index += 1) {
    combinations += combination(count, index);
  }
  return round6(Math.min(1, 2 * combinations / 2 ** count));
}

function combination(count: number, selected: number): number {
  let result = 1;
  for (let index = 1; index <= selected; index += 1) {
    result = result * (count - index + 1) / index;
  }
  return result;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function bindMemoryControlTerminalGraph(
  fixture: Fixture,
  allocation: CandidateArenaResearchAllocationRecord,
  graph: TerminalFixture
): ResearchMemoryControlStudyRecord {
  const worker = fixture.workers.find((candidate) =>
    candidate.research_worker_id === graph.commitment.research_worker_ref.id
  )!;
  const study = decideResearchMemoryControlStudy({
    idempotencyKey: `memory-control-${allocation.candidate_arena_research_allocation_id}`,
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest(`memory-control-baseline-${allocation.tick_id}`),
      regular_file_count: 1,
      total_bytes: 1,
      exclusion_policy: "research_experiment_evidence_only"
    },
    source: {
      candidate_ref: ref("trading_system_candidate", `source-candidate-${allocation.tick_id}`),
      candidate_version_ref: ref("candidate_version", `source-version-${allocation.tick_id}`),
      system_code_ref: { ...graph.commitment.source_system_code_ref },
      system_code_artifact_digest: graph.sourceSystemCode.artifact_digest,
      system_code_record_digest: digest(
        paperTradingComparisonSystemCodeRecordDigestInput(graph.sourceSystemCode)
      ),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest(`source-closure-${allocation.tick_id}`)
    },
    researchAgent: {
      id: worker.agent_profile_id!,
      provider: "codex",
      model: worker.model!,
      permission_policy: "artifact_workspace_only"
    },
    opportunityProtocol: {
      development_suite_version: graph.commitment.development_policy.suite_version,
      development_suite_digest: graph.commitment.development_policy.suite_digest,
      sealed_suite_version: graph.commitment.sealed_admission_policy.suite_version,
      sealed_generator_version: graph.commitment.sealed_admission_policy.generator_version,
      sealed_rotation_commitment_digest:
        graph.commitment.sealed_admission_policy.rotation_commitment_digest,
      sealed_suite_digest: graph.commitment.sealed_admission_policy.suite_digest
    },
    directions: Array.from({ length: 6 }, (_, index) => index % 2 === 0 ? {
      research_direction_id: graph.commitment.research_direction_ref.id,
      direction_kind: "trend_following" as const
    } : {
      research_direction_id: `memory-control-mean-direction-${allocation.tick_id}`,
      direction_kind: "mean_reversion" as const
    }),
    committedAt: after(allocation.allocated_at, -1_000)
  });
  study.pair_plans[0]!.released_memory_treatment.tick_id = allocation.tick_id;
  study.study_digest = digest(researchMemoryControlStudyDigestInput(study));
  graph.commitment.memory_policy = {
    protocol_version: "research_worker_memory_v1",
    memory_mode: "released_memory",
    memory_source_digest: digest(`memory-source-${allocation.tick_id}`),
    available_memory_item_count: 1,
    arena_context_digest: digest(`arena-context-${allocation.tick_id}`),
    prior_checkpoint: { disposition: "none_available" },
    control_assignment: {
      study_ref: ref(
        "research_memory_control_study",
        study.research_memory_control_study_id
      ),
      study_digest: study.study_digest,
      pair_index: 1,
      arm_kind: "released_memory_treatment"
    }
  };
  graph.commitment.source_artifact_digest = study.source.research_artifact_closure_digest;
  graph.commitment.commitment_digest = digest(
    researchPreflightCommitmentDigestInput(graph.commitment)
  );
  graph.evaluation.research_preflight_commitment_digest = graph.commitment.commitment_digest;
  graph.admission.research_preflight_commitment_digest = graph.commitment.commitment_digest;
  graph.admission.source_artifact_digest = graph.commitment.source_artifact_digest;
  fixture.memoryControlStudies.push(study);
  return study;
}

function addCommitment(
  fixture: Fixture,
  allocation: CandidateArenaResearchAllocationRecord,
  directionKind: ResearchDirectionKind,
  workerId = safeId(`worker-${allocation.tick_id}-${directionKind}`).replaceAll("_", "-")
): ResearchPreflightCommitmentRecord {
  const directionRecord = fixture.directions.find((candidate) =>
    candidate.direction_kind === directionKind
  )!;
  if (!fixture.workers.some((candidate) => candidate.research_worker_id === workerId)) {
    fixture.workers.push({
      record_kind: "research_worker",
      version: 1,
      research_worker_id: workerId,
      display_name: `Worker ${directionKind}`,
      model: "gpt-test",
      provider_kind: "codex_cli",
      agent_profile_id: `agent-${safeId(workerId)}`,
      research_direction_ref: ref("research_direction", directionRecord.research_direction_id),
      workspace_key: `candidate-arena-workers/${workerId}`,
      lifecycle_protocol: "research_worker_checkpoint_v1",
      created_at: allocation.allocated_at,
      status: "active",
      authority_status: "research_only"
    } as ResearchWorkerRecord);
  }
  const commitment = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: `commitment-${allocation.tick_id}-${directionKind}`,
    candidate_arena_tick_id: allocation.tick_id,
    research_direction_ref: ref("research_direction", directionRecord.research_direction_id),
    research_worker_ref: ref("research_worker", workerId),
    research_allocation_ref: ref(
      "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id
    ),
    research_allocation_digest: allocation.allocation_digest,
    source_system_code_ref: ref("system_code", `source-code-${allocation.tick_id}`),
    source_artifact_digest: digest(`source-code-${allocation.tick_id}`),
    methodology: {
      direction_kind: directionKind,
      hypothesis: `Hypothesis ${directionKind}`,
      method: `Method ${directionKind}`,
      evidence_bindings: []
    },
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: digest(`development-${allocation.tick_id}`),
      submission_limit: 1,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest(`rotation-${allocation.tick_id}`),
      suite_digest: digest(`sealed-${allocation.tick_id}`),
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: after(allocation.allocated_at, 1_000),
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("commitment-placeholder")
  } as ResearchPreflightCommitmentRecord;
  commitment.commitment_digest = digest(researchPreflightCommitmentDigestInput(commitment));
  fixture.systemCodes.set(commitment.source_system_code_ref.id, {
    ...systemCodeRecord(commitment.source_system_code_ref.id),
    created_at: allocation.allocated_at
  });
  fixture.commitments.push(commitment);
  return commitment;
}

function addTerminalGraph(
  fixture: Fixture,
  allocation: CandidateArenaResearchAllocationRecord,
  directionKind: ResearchDirectionKind,
  status: "admitted" | "duplicate" | "quarantined",
  workerId?: string
): TerminalFixture {
  const commitment = addCommitment(fixture, allocation, directionKind, workerId);
  const systemCode = systemCodeRecord(`selected-code-${allocation.tick_id}`);
  systemCode.created_at = after(allocation.allocated_at, 2_750);
  if (status === "duplicate") {
    systemCode.artifact_digest = commitment.source_artifact_digest;
  }
  fixture.systemCodes.set(systemCode.system_code_id, systemCode);
  const experiment = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-${allocation.tick_id}`,
    research_worker_ref: commitment.research_worker_ref,
    research_direction_ref: commitment.research_direction_ref,
    system_code_ref: ref("system_code", systemCode.system_code_id),
    trading_evaluation_task_ref: ref("trading_evaluation_task", `task-${allocation.tick_id}`),
    submitted_at: after(allocation.allocated_at, 2_000),
    status: "evaluated",
    authority_status: "not_live"
  } as ExperimentRunRecord;
  const evaluation = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: `evaluation-${allocation.tick_id}`,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_task_ref: experiment.trading_evaluation_task_ref,
    evaluator_ref: ref("external_evaluator", `evaluator-${allocation.tick_id}`),
    result_status: status === "quarantined" ? "disqualified" : "accepted",
    evidence_disposition: status === "quarantined" ? "quarantined_for_review" : "not_counted",
    score_summary: {
      total_score: 1,
      oos_score: 1,
      drawdown_score: 1,
      turnover_score: 1,
      cost_survival_score: 1,
      reproducibility_score: 1,
      complexity_penalty: 0
    },
    metric_refs: [ref("metric_snapshot", `metric-${allocation.tick_id}`)],
    evaluator_trace_ref: ref("trace_placeholder", `trace-${allocation.tick_id}`),
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: commitment.commitment_digest,
    submitted_system_code_ref: ref("system_code", systemCode.system_code_id),
    submitted_artifact_digest: systemCode.artifact_digest,
    sealed_admission_suite_digest: commitment.sealed_admission_policy.suite_digest,
    evaluation_phase: "sealed_admission",
    submission_sequence: 1,
    selected_development_submission_sequence: 1,
    ...(status === "quarantined" ? {
      disqualification_reason: "risk_validation_failed"
    } : {}),
    completed_at: after(allocation.allocated_at, 3_000),
    authority_status: "not_counted"
  } as unknown as TradingEvaluationResultRecord;
  const conformance = {
    record_kind: "paper_trading_handoff_conformance",
    version: 1,
    paper_trading_handoff_conformance_id: `conformance-${allocation.tick_id}`,
    system_code_ref: ref("system_code", systemCode.system_code_id),
    system_code_artifact_digest: systemCode.artifact_digest,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_task_ref: experiment.trading_evaluation_task_ref,
    protocol_version: "paper_trading_event_protocol_v1",
    runner_kind: "host_process",
    status: "passed",
    reason: "passed",
    provider_request_count: 3,
    decision_event_kind: "order_request",
    heartbeat_count: 1,
    runtime_stopped: true,
    started_at: experiment.submitted_at,
    completed_at: after(allocation.allocated_at, 2_500),
    evidence_digest: digest("conformance-placeholder"),
    research_preflight_authority: true,
    runnable_paper_handoff: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  } as PaperTradingHandoffConformanceRecord;
  conformance.evidence_digest = digest(paperTradingHandoffConformanceDigestInput(conformance));
  const finding = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `finding-${allocation.tick_id}`,
    research_worker_ref: commitment.research_worker_ref,
    research_direction_ref: commitment.research_direction_ref,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      evaluation.trading_evaluation_result_id
    ),
    finding_kind: status === "admitted" ? "positive_result" : "negative_result",
    summary: `Finding ${allocation.tick_id}`,
    supporting_record_refs: [],
    created_at: after(allocation.allocated_at, 3_100),
    authority_status: "research_trace_only"
  } as ResearchFindingRecord;
  const reason = status === "admitted"
    ? "evaluation_accepted"
    : status === "duplicate" ? "no_candidate_change" : "evaluation_disqualified";
  const admission = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: `admission-${allocation.tick_id}`,
    research_worker_outcome: status === "duplicate" ? "unchanged" : "changed",
    experiment_status: "evaluated",
    evaluation_status: status === "quarantined" ? "disqualified" : "accepted",
    evidence_disposition: evaluation.evidence_disposition,
    paper_handoff_conformance_status: conformance.status,
    status,
    reason,
    runnable_paper_handoff: status === "admitted",
    authority_status: "not_live",
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: commitment.commitment_digest,
    source_system_code_ref: commitment.source_system_code_ref,
    system_code_ref: ref("system_code", systemCode.system_code_id),
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      evaluation.trading_evaluation_result_id
    ),
    research_finding_ref: ref("research_finding", finding.research_finding_id),
    source_artifact_digest: commitment.source_artifact_digest,
    submitted_artifact_digest: systemCode.artifact_digest,
    paper_trading_handoff_conformance_ref: ref(
      "paper_trading_handoff_conformance",
      conformance.paper_trading_handoff_conformance_id
    ),
    paper_trading_handoff_conformance_digest: conformance.evidence_digest,
    decided_at: after(allocation.allocated_at, 4_000)
  } as CandidateAdmissionDecisionRecord;
  const lineage = {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: `lineage-${allocation.tick_id}`,
    child_system_code_ref: ref("system_code", systemCode.system_code_id),
    parent_system_code_ref: commitment.source_system_code_ref,
    source_finding_refs: [ref("research_finding", finding.research_finding_id)],
    created_by_research_worker_ref: commitment.research_worker_ref,
    created_at: after(allocation.allocated_at, 4_100),
    authority_status: "lineage_only"
  } as ArtifactLineageRecord;
  fixture.experiments.push(experiment);
  fixture.evaluations.push(evaluation);
  fixture.conformances.push(conformance);
  fixture.findings.push(finding);
  fixture.admissions.push(admission);
  fixture.lineages.push(lineage);
  if (status === "admitted") {
    const candidateId = `candidate-${allocation.tick_id}`;
    fixture.candidates.set(
      candidateId,
      materializedCandidate(candidateId, systemCode)
    );
  }
  fixture.ticks.push(tick(allocation, [{
    direction_kind: directionKind,
    status: status === "admitted" ? "created" : status,
    ...(status === "admitted" ? { candidate_id: `candidate-${allocation.tick_id}` } : {}),
    ...(status === "admitted" ? {} : { finding: finding.summary }),
    admission_decision_id: admission.candidate_admission_decision_id,
    admission_reason: admission.reason,
    research_preflight: {
      commitment_id: commitment.research_preflight_commitment_id,
      development_submission_count: 1,
      sealed_terminal_status: status === "admitted" ? "accepted" : "rejected",
      reason: status === "admitted" ? "accepted" : "candidate_rejected",
      authority_status: "not_promotion_authority"
    },
    paper_handoff_conformance: {
      conformance_id: conformance.paper_trading_handoff_conformance_id,
      status: conformance.status,
      reason: conformance.reason,
      authority_status: "research_only"
    }
  }]));
  return {
    commitment,
    sourceSystemCode: fixture.systemCodes.get(commitment.source_system_code_ref.id)!,
    evaluation,
    experiment,
    admission,
    conformance,
    finding,
    lineage,
    systemCode
  };
}

function upgradeConformanceToV2(
  graph: TerminalFixture,
  result: CandidateArenaTickRecord["direction_results"][number]
): void {
  const networkPolicy = {
    protocol_version: "candidate_sandbox_network_policy_v1" as const,
    inherited_allow_digest: digest("inherited-allow"),
    inherited_allow_count: 0,
    owned_allow_rule_ids: [],
    owned_deny_rule_ids: [],
    deny_targets: [...CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS]
  };
  const networkPolicyDigest = digest(
    candidateEgressNetworkPolicyDigestInput(networkPolicy)
  );
  const attestation: CandidateEgressAttestation = {
    protocol_version: "candidate_egress_attestation_v1",
    attestation_id: `candidate-egress-attestation-${graph.conformance
      .paper_trading_handoff_conformance_id}`,
    attested_by: {
      record_kind: "external_evaluator",
      id: "candidate-egress-evaluator-v1"
    },
    candidate_authored: false,
    system_code_ref: { ...graph.conformance.system_code_ref },
    system_code_artifact_digest: graph.conformance.system_code_artifact_digest,
    execution_ref: { ...graph.conformance.experiment_run_ref },
    sandbox: {
      adapter_kind: "docker_sandboxes_sbx",
      sandbox_name: `sandbox-${graph.conformance.paper_trading_handoff_conformance_id}`,
      implementation_version: "0.35.0"
    },
    network_policy: networkPolicy,
    network_policy_digest: networkPolicyDigest,
    start: {
      observed_at: after(graph.conformance.started_at, 100),
      policy_digest: networkPolicyDigest
    },
    end: {
      observed_at: after(graph.conformance.completed_at, -100),
      policy_digest: networkPolicyDigest
    },
    candidate_effect: {
      started_at: after(graph.conformance.started_at, 200),
      completed_at: after(graph.conformance.completed_at, -200)
    },
    cleanup_status: "released",
    enforcement_result: "enforced",
    denial_summary: {
      required_probe_count: CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length,
      start_denied_probe_count: CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length,
      end_denied_probe_count: CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length,
      unexpected_allow_count: 0
    },
    issued_at: graph.conformance.completed_at,
    attestation_digest: digest("attestation-placeholder"),
    research_preflight_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  attestation.attestation_digest = digest(
    candidateEgressAttestationDigestInput(attestation)
  );
  const upgraded = graph.conformance as PaperTradingHandoffConformanceRecord & {
    candidate_egress_attestation?: CandidateEgressAttestation;
  };
  upgraded.version = 2;
  upgraded.runner_kind = "docker_sandboxes_sbx";
  upgraded.candidate_egress_attestation = attestation;
  upgraded.evidence_digest = digest(
    paperTradingHandoffConformanceDigestInput(upgraded)
  );
  graph.admission.paper_trading_handoff_conformance_digest = upgraded.evidence_digest;
  result.paper_handoff_conformance!.candidate_egress_attestation = {
    attestation_id: attestation.attestation_id,
    verification_status: "verified",
    enforcement_result: "enforced",
    network_policy_digest: attestation.network_policy_digest,
    denial_summary: { ...attestation.denial_summary, unexpected_allow_count: 0 },
    authority_status: "research_only"
  };
}

function chainCheckpoint(
  commitment: ResearchPreflightCommitmentRecord,
  worker: ResearchWorkerRecord,
  cumulativeCommittedSubmissionLimit: number,
  previous?: ResearchWorkerCheckpointRecord
): ResearchWorkerCheckpointRecord {
  const checkpoint = {
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id: `checkpoint-${commitment.candidate_arena_tick_id}`,
    research_worker_ref: commitment.research_worker_ref,
    research_direction_ref: commitment.research_direction_ref,
    candidate_arena_tick_id: commitment.candidate_arena_tick_id,
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: commitment.commitment_digest,
    workspace_key: worker.workspace_key!,
    ...(previous ? {
      previous_checkpoint_ref: ref(
        "research_worker_checkpoint",
        previous.research_worker_checkpoint_id
      ),
      previous_checkpoint_digest: previous.checkpoint_digest
    } : {}),
    development_budget: {
      submission_limit: commitment.development_policy.submission_limit,
      recorded_submission_count: 0,
      cumulative_committed_submission_limit: cumulativeCommittedSubmissionLimit,
      cumulative_recorded_submission_count: 0,
      remaining_submission_authority: 0
    },
    notebook: {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: 0,
      recent_entries: []
    },
    terminal_status: "completed",
    terminal_reason: "finished_without_submission",
    closed_at: after(commitment.committed_at, 1),
    checkpoint_digest: digest("checkpoint-placeholder"),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  } as ResearchWorkerCheckpointRecord;
  checkpoint.checkpoint_digest = digest(
    researchWorkerCheckpointDigestInput(checkpoint)
  );
  return checkpoint;
}

function checkpoint(
  fixture: Fixture,
  commitment: ResearchPreflightCommitmentRecord,
  reason: ResearchWorkerCheckpointRecord["terminal_reason"],
  entries: ResearchWorkerCheckpointNotebookEntry[] = [],
  recorded = entries.filter((candidate) =>
    candidate.candidate_arena_tick_id === commitment.candidate_arena_tick_id
  ).length,
  totalEntryCount = entries.length,
  admissionId?: string
): ResearchWorkerCheckpointRecord {
  const submissionLimit = commitment.development_policy.submission_limit;
  const worker = fixture.workers.find((candidate) =>
    candidate.research_worker_id === commitment.research_worker_ref.id
  )!;
  const priorCommitments = fixture.commitments.filter((candidate) =>
    candidate.research_worker_ref.id === commitment.research_worker_ref.id &&
    (candidate.committed_at < commitment.committed_at ||
      candidate.committed_at === commitment.committed_at &&
      candidate.research_preflight_commitment_id <
        commitment.research_preflight_commitment_id)
  ).sort((left, right) => left.committed_at.localeCompare(right.committed_at) ||
    left.research_preflight_commitment_id.localeCompare(
      right.research_preflight_commitment_id
    ));
  const priorCommitment = priorCommitments.at(-1);
  const priorCheckpoint = priorCommitment
    ? fixture.checkpoints.find((candidate) =>
        candidate.research_preflight_commitment_ref.id ===
          priorCommitment.research_preflight_commitment_id)
    : undefined;
  const previousCommitted = priorCheckpoint
    ?.development_budget.cumulative_committed_submission_limit ?? 0;
  const previousRecorded = priorCheckpoint
    ?.development_budget.cumulative_recorded_submission_count ?? 0;
  const normalizedEntries = entries.map((candidate, index) => ({
    ...candidate,
    sequence: previousRecorded + index + 1,
    candidate_arena_tick_id: commitment.candidate_arena_tick_id,
    iteration: index + 1
  }));
  const notebookEntries = [
    ...(priorCheckpoint?.notebook.recent_entries ?? []),
    ...normalizedEntries
  ].slice(-6);
  const cumulativeRecorded = previousRecorded + recorded;
  const checkpoint = {
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id: `checkpoint-${commitment.candidate_arena_tick_id}`,
    research_worker_ref: commitment.research_worker_ref,
    research_direction_ref: commitment.research_direction_ref,
    candidate_arena_tick_id: commitment.candidate_arena_tick_id,
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: commitment.commitment_digest,
    workspace_key: worker.workspace_key!,
    ...(priorCheckpoint ? {
      previous_checkpoint_ref: ref(
        "research_worker_checkpoint",
        priorCheckpoint.research_worker_checkpoint_id
      ),
      previous_checkpoint_digest: priorCheckpoint.checkpoint_digest
    } : {}),
    development_budget: {
      submission_limit: submissionLimit,
      recorded_submission_count: recorded,
      cumulative_committed_submission_limit: previousCommitted + submissionLimit,
      cumulative_recorded_submission_count: cumulativeRecorded,
      remaining_submission_authority: 0
    },
    notebook: {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: cumulativeRecorded,
      recent_entries: notebookEntries
    },
    terminal_status: reason === "finished_without_submission" ||
      reason === "admission_recorded" ? "completed" : "failed_closed",
    terminal_reason: reason,
    ...(reason === "admission_recorded" && admissionId ? {
      candidate_admission_decision_ref: ref("candidate_admission_decision", admissionId)
    } : {}),
    closed_at: "2026-07-23T00:10:00.000Z",
    checkpoint_digest: digest("checkpoint-placeholder"),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  } as ResearchWorkerCheckpointRecord;
  checkpoint.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(checkpoint));
  return checkpoint;
}

function expectNoTerminalAuthority(
  detail: ResearchSessionDetailReadModel | undefined,
  selectedArtifactAvailability: "not_selected" | "unavailable" = "not_selected"
): void {
  expect(detail).toBeDefined();
  expect(detail).toMatchObject({
    budget: { completed_experiment_count: 0 },
    selected_artifact_availability: selectedArtifactAvailability
  });
  expect(detail?.status).not.toBe("admitted");
  expect(detail).not.toHaveProperty("selected_submission_sequence");
  expect(detail).not.toHaveProperty("selected_system_code_ref");
  expect(detail).not.toHaveProperty("selected_system_code_artifact_digest");
  expect(detail).not.toHaveProperty("admission_decision_ref");
  expect(detail).not.toHaveProperty("paper_handoff_conformance_ref");
  expect(detail).not.toHaveProperty("admitted_candidate_id");
  expect(detail?.terminal_graph).not.toHaveProperty("selected_sealed_evaluation");
  expect(detail?.terminal_graph).not.toHaveProperty("admission");
  expect(detail?.terminal_graph).not.toHaveProperty("finding");
  expect(detail?.terminal_graph).not.toHaveProperty("artifact_lineage");
  expect(detail?.terminal_graph).not.toHaveProperty("paper_handoff_conformance");
  expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
}

function resealCommitmentGraph(graph: TerminalFixture): void {
  graph.commitment.commitment_digest = digest(
    researchPreflightCommitmentDigestInput(graph.commitment)
  );
  graph.evaluation.research_preflight_commitment_digest =
    graph.commitment.commitment_digest;
  graph.admission.research_preflight_commitment_digest =
    graph.commitment.commitment_digest;
  graph.admission.source_artifact_digest = graph.commitment.source_artifact_digest;
}

function behaviorFingerprint(
  graph: TerminalFixture,
  suffix: string,
  side: "buy" | "sell" = "buy"
): ResearchBehaviorFingerprintRecord {
  const record = {
    record_kind: "research_behavior_fingerprint",
    version: 1,
    research_behavior_fingerprint_id: `fingerprint-${suffix}`,
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      graph.commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: graph.commitment.commitment_digest,
    system_code_ref: ref("system_code", graph.systemCode.system_code_id),
    system_code_artifact_digest: graph.systemCode.artifact_digest,
    protocol_version: "research_behavior_fingerprint_v1",
    development_suite_version: graph.commitment.development_policy.suite_version,
    development_suite_digest: graph.commitment.development_policy.suite_digest,
    observations: [{
      scenario_id: "scenario-1",
      decision: {
        symbol: "BTCUSDT",
        side,
        quantity: 0.01,
        order_type: "market"
      }
    }],
    observation_count: 1,
    fingerprint_digest: digest("fingerprint-placeholder"),
    created_at: after(graph.systemCode.created_at, 100),
    duplicate_detection_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  } as ResearchBehaviorFingerprintRecord;
  record.fingerprint_digest = digest(
    researchBehaviorFingerprintDigestInput(record)
  );
  return record;
}

function bindBehaviorComparison(
  graph: TerminalFixture,
  current: ResearchBehaviorFingerprintRecord,
  status: "distinct" | "duplicate",
  matching?: ResearchBehaviorFingerprintRecord
): void {
  graph.admission.behavior_comparison_status = status;
  graph.admission.research_behavior_fingerprint_ref = ref(
    "research_behavior_fingerprint",
    current.research_behavior_fingerprint_id
  );
  graph.admission.research_behavior_fingerprint_digest = current.fingerprint_digest;
  if (status === "duplicate" && matching) {
    graph.admission.matching_research_behavior_fingerprint_ref = ref(
      "research_behavior_fingerprint",
      matching.research_behavior_fingerprint_id
    );
    graph.admission.matching_research_behavior_fingerprint_digest =
      matching.fingerprint_digest;
    graph.admission.status = "duplicate";
    graph.admission.reason = "behavior_duplicate";
    graph.admission.runnable_paper_handoff = false;
  }
  graph.finding.supporting_record_refs.push(ref(
    "research_behavior_fingerprint",
    current.research_behavior_fingerprint_id
  ));
}

function entry(tickId: string, iteration: number): ResearchWorkerCheckpointNotebookEntry {
  return {
    sequence: iteration,
    candidate_arena_tick_id: tickId,
    iteration,
    decision: iteration === 2 ? "keep" : "discard",
    agent_status: "edited",
    score: iteration,
    summary: `iteration-${iteration}`,
    evaluation_status: "accepted",
    risk_decision: "valid_order_request",
    net_revenue_usdt: iteration
  };
}

function tick(
  allocation: CandidateArenaResearchAllocationRecord,
  results: CandidateArenaTickRecord["direction_results"]
): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-tick-${safeId(allocation.tick_id)}`,
    tick_id: allocation.tick_id,
    started_at: allocation.allocated_at,
    completed_at: after(allocation.allocated_at, 5_000),
    status: results.some((candidate) => candidate.status === "failed")
      ? "completed_with_errors"
      : "completed",
    created_candidate_refs: results.flatMap((candidate) => candidate.candidate_id
      ? [ref("trading_system_candidate", candidate.candidate_id)]
      : []),
    direction_results: results,
    research_allocation_ref: ref(
      "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id
    ),
    research_allocation_digest: allocation.allocation_digest,
    authority_status: "not_live"
  };
}

function direction(
  kind: ResearchDirectionKind,
  createdAt = "2026-07-23T00:00:00.000Z"
): ResearchDirectionRecord {
  return {
    record_kind: "research_direction",
    version: 1,
    research_direction_id: `direction-${kind}`,
    direction_kind: kind,
    market_scope: "external_trading_api_fixture",
    prompt_seed: `Prompt ${kind}`,
    created_at: createdAt,
    authority_status: "research_seed_only"
  } as ResearchDirectionRecord;
}

function systemCodeRecord(id: string): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: id,
    artifact_kind: "python_file",
    artifact_digest: digest(id),
    artifact_path: `/private/${id}.py`,
    runtime_kind: "python",
    entrypoint: ["python", "main.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["order_request"]
    },
    secret_policy_ref: ref("secret_policy", "secret-policy"),
    capability_policy_ref: ref("capability_policy", "capability-policy"),
    provenance_refs: [],
    status: "registered",
    created_at: "2026-07-23T00:00:02.000Z",
    authority_status: "not_live"
  } as SystemCodeRecord;
}

function evidenceArtifact(
  suffix: string,
  capturedAt: string,
  summary = "Sanitized Arena evidence."
): ResearchEvidenceArtifactRecord {
  const record = {
    record_kind: "research_evidence_artifact",
    version: 1,
    research_evidence_artifact_id: `evidence-${suffix}`,
    source_kind: "research_finding",
    subject_ref: ref("research_worker", `worker-${suffix}`),
    artifact_ref: ref("research_finding", `finding-${suffix}`),
    source_digest: digest(`source-${suffix}`),
    summary,
    supporting_record_refs: [],
    captured_at: capturedAt,
    sanitization_policy: "research_evidence_sanitization_v1",
    sanitization_status: "sanitized",
    qualification_evidence_hidden: true,
    secrets_removed: true,
    host_paths_removed: true,
    truncated: false,
    artifact_digest: digest("evidence-placeholder"),
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  } as ResearchEvidenceArtifactRecord;
  record.artifact_digest = digest(researchEvidenceArtifactDigestInput(record));
  return record;
}

function bindArenaEvidence(
  allocation: CandidateArenaResearchAllocationRecord,
  evidence: ResearchEvidenceArtifactRecord
): void {
  allocation.trigger = {
    trigger_kind: "arena_event",
    trigger_id: `arena-event-${allocation.tick_id}`,
    goal: "Respond to one exact sanitized Arena event.",
    triggered_at: allocation.allocated_at,
    source_ref: { ...evidence.artifact_ref },
    evidence_artifact_ref: ref(
      "research_evidence_artifact",
      evidence.research_evidence_artifact_id
    ) as { record_kind: "research_evidence_artifact"; id: string },
    evidence_artifact_digest: evidence.artifact_digest,
    authority_status: "research_only"
  };
  allocation.allocation_digest = digest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
}

function runningHealth(
  tickId: string,
  items: Array<{
    allocation: CandidateArenaResearchAllocationRecord;
    direction_kind: ResearchDirectionKind;
    phase: "allocating" | "running" | "failed_closed_pending_tick";
    commitment_id?: string;
  }>
): CandidateArenaRunnerHealthReadModel {
  return {
    ...stoppedHealth(),
    status: "running",
    active_tick: true,
    active_tick_id: tickId,
    active_research_work_items: items.map((item) => ({
      identity_kind: "derived_projection",
      research_work_item_id: workId(item.allocation, item.direction_kind),
      research_allocation_id: item.allocation.candidate_arena_research_allocation_id,
      direction_kind: item.direction_kind,
      phase: item.phase,
      ...(item.commitment_id ? { commitment_id: item.commitment_id } : {})
    }))
  };
}

function workId(
  allocation: CandidateArenaResearchAllocationRecord,
  directionKind: ResearchDirectionKind
): string {
  return researchWorkItemId({
    research_allocation_id: allocation.candidate_arena_research_allocation_id,
    direction_kind: directionKind
  });
}

function ref(record_kind: string, id: string): { record_kind: string; id: string } {
  return { record_kind, id };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function after(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}
