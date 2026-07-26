import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ResearchOperationsProjectionService } from "@ouroboros/application";
import { decideResearchMemoryControlStudy } from
  "../../application/src/candidate/research-memory-control-study";
import { researchWorkItemId } from
  "../../application/src/candidate/research-work-item";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  canonicalResearchEvidenceArtifactSummary,
  decideCandidateAdmission,
  paperTradingHandoffConformanceDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonSystemCodeRecordDigestInput,
  researchEvidenceArtifactDigestInput,
  researchPreflightCommitmentDigestInput,
  researchWorkerCheckpointDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickDirectionResultReadModel,
  type CandidateArenaTickRecord,
  type ExperimentRunRecord,
  type PaperTradingHandoffConformanceRecord,
  type ResearchDirectionRecord,
  type ResearchEvidenceArtifactRecord,
  type ResearchFindingRecord,
  type ResearchMemoryControlStudyRecord,
  type ResearchPreflightCommitmentRecord,
  type ResearchSessionDetailReadModel,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerRecord,
  type SystemCodeRecord,
  type TradingEvaluationResultRecord
} from "@ouroboros/domain";
import { LocalStore } from "../src/index";

type OracleCase =
  | "admitted"
  | "duplicate"
  | "quarantined"
  | "finished_without_submission"
  | "execution_failed"
  | "restart_recovery";

describe("LocalStore ResearchOperationsProjectionService oracle", () => {
  it("restart-projects every canonical terminal graph written by LocalStore", async () => {
    const cases: Array<{
      kind: OracleCase;
      expectedStatus: string;
      expectedBasis: string;
      expectsTick: boolean;
    }> = [
      {
        kind: "admitted",
        expectedStatus: "admitted",
        expectedBasis: "candidate_admission_decision",
        expectsTick: true
      },
      {
        kind: "duplicate",
        expectedStatus: "duplicate",
        expectedBasis: "candidate_admission_decision",
        expectsTick: true
      },
      {
        kind: "quarantined",
        expectedStatus: "quarantined",
        expectedBasis: "candidate_admission_decision",
        expectsTick: true
      },
      {
        kind: "finished_without_submission",
        expectedStatus: "finished_without_submission",
        expectedBasis: "research_worker_checkpoint",
        expectsTick: true
      },
      {
        kind: "execution_failed",
        expectedStatus: "failed_closed",
        expectedBasis: "research_worker_checkpoint",
        expectsTick: true
      },
      {
        kind: "restart_recovery",
        expectedStatus: "failed_closed",
        expectedBasis: "research_worker_checkpoint",
        expectsTick: false
      }
    ];

    for (const testCase of cases) {
      const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-operations-"));
      try {
        const store = new LocalStore(root);
        await store.initialize();
        const graph = await persistBaseGraph(store, testCase.kind);
        if (testCase.kind === "admitted" || testCase.kind === "duplicate" ||
          testCase.kind === "quarantined") {
          await persistAdmissionClosure(store, graph, testCase.kind);
        } else {
          await persistNonAdmissionClosure(store, graph, testCase.kind);
        }

        const restarted = new LocalStore(root);
        await restarted.initialize();
        const service = new ResearchOperationsProjectionService({
          store: restarted,
          runnerHealth: () => ({
            status: "stopped",
            tick_count: testCase.expectsTick ? 1 : 0,
            completed_tick_count: testCase.expectsTick ? 1 : 0,
            active_tick: false,
            active_research_work_items: [],
            consecutive_failure_count: 0,
            runtime_coordination_authority: true,
            evaluation_authority: false,
            promotion_authority: false,
            order_submission_authority: false,
            live_exchange_authority: false,
            authority_status: "runtime_coordination_only"
          })
        });

        const operations = await service.readOperations();
        expect(operations.sessions, testCase.kind).toHaveLength(1);
        expect(operations.sessions[0], testCase.kind).toMatchObject({
          status: testCase.expectedStatus,
          status_basis: { basis_kind: testCase.expectedBasis }
        });
        const detail = await service.readSessionDetail(
          operations.sessions[0]!.research_work_item_id
        );
        expectTerminalAuthorityMatrix(detail, testCase.kind);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("rejects a distinct admission ID rebinding one commitment and Evaluation after restart", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-restart-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "admission-restart-owner");
      const admission = await persistAdmissionClosure(store, graph, "admitted", {
        prepareOnly: true
      });
      await store.recordCandidateAdmissionDecision(admission);

      const restarted = new LocalStore(root);
      await expect(restarted.recordCandidateAdmissionDecision(
        structuredClone(admission)
      )).resolves.toEqual(admission);
      const rebound = {
        ...structuredClone(admission),
        candidate_admission_decision_id: "admission-restart-second-owner"
      };

      await expect(restarted.recordCandidateAdmissionDecision(rebound)).rejects.toMatchObject({
        code: "candidate_admission_graph_conflict",
        details: {
          candidate_admission_decision_id: rebound.candidate_admission_decision_id,
          conflicting_candidate_admission_decision_id:
            admission.candidate_admission_decision_id,
          research_preflight_commitment_id:
            graph.commitment.research_preflight_commitment_id,
          trading_evaluation_result_id: admission.trading_evaluation_result_ref.id
        }
      });
      await expect(restarted.listCandidateAdmissionDecisions()).resolves.toEqual([admission]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a distinct admission ID sharing only the Evaluation identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-evaluation-owner-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "admission-evaluation-owner");
      const admission = await persistAdmissionClosure(store, graph, "admitted", {
        prepareOnly: true
      });
      await store.recordCandidateAdmissionDecision(admission);

      const legacyEvaluationOwner = {
        ...structuredClone(admission),
        candidate_admission_decision_id: "admission-evaluation-second-owner",
        research_preflight_commitment_ref: undefined,
        research_preflight_commitment_digest: undefined
      };

      await expect(new LocalStore(root).recordCandidateAdmissionDecision(
        legacyEvaluationOwner
      )).rejects.toMatchObject({
        code: "candidate_admission_graph_conflict",
        details: {
          candidate_admission_decision_id:
            legacyEvaluationOwner.candidate_admission_decision_id,
          conflicting_candidate_admission_decision_id:
            admission.candidate_admission_decision_id,
          trading_evaluation_result_id: admission.trading_evaluation_result_ref.id
        }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a distinct admission ID sharing only the commitment identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-commitment-owner-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "admission-commitment-owner");
      const admission = await persistAdmissionClosure(store, graph, "admitted", {
        prepareOnly: true
      });
      await store.recordCandidateAdmissionDecision(admission);
      const alternateEvaluationId = "evaluation-admitted-commitment-owner";
      const alternateFindingId = "finding-admitted-commitment-owner";
      const persistedEvaluation = JSON.parse(await readFile(path.join(
        root,
        "trading-evaluation-results",
        "items",
        `${admission.trading_evaluation_result_ref.id}.json`
      ), "utf8")) as TradingEvaluationResultRecord;
      const alternateEvaluation = {
        ...persistedEvaluation,
        trading_evaluation_result_id: alternateEvaluationId
      };
      await writeFile(
        path.join(
          root,
          "trading-evaluation-results",
          "items",
          `${alternateEvaluationId}.json`
        ),
        `${JSON.stringify(alternateEvaluation, null, 2)}\n`,
        "utf8"
      );
      const persistedFinding = JSON.parse(await readFile(path.join(
        root,
        "research-findings",
        "items",
        `${admission.research_finding_ref.id}.json`
      ), "utf8")) as ResearchFindingRecord;
      const alternateFinding: ResearchFindingRecord = {
        ...persistedFinding,
        research_finding_id: alternateFindingId,
        trading_evaluation_result_ref: ref(
          "trading_evaluation_result",
          alternateEvaluationId
        ),
        supporting_record_refs: persistedFinding.supporting_record_refs.map((supportingRef) =>
          supportingRef.record_kind === "trading_evaluation_result"
            ? ref("trading_evaluation_result", alternateEvaluationId)
            : supportingRef
        )
      };
      await writeFile(
        path.join(root, "research-findings", "items", `${alternateFindingId}.json`),
        `${JSON.stringify(alternateFinding, null, 2)}\n`,
        "utf8"
      );
      const commitmentOwner = {
        ...structuredClone(admission),
        candidate_admission_decision_id: "admission-commitment-second-owner",
        trading_evaluation_result_ref: ref(
          "trading_evaluation_result",
          alternateEvaluationId
        ),
        research_finding_ref: ref("research_finding", alternateFindingId)
      };

      await expect(new LocalStore(root).recordCandidateAdmissionDecision(
        commitmentOwner
      )).rejects.toMatchObject({
        code: "candidate_admission_graph_conflict",
        details: {
          candidate_admission_decision_id:
            commitmentOwner.candidate_admission_decision_id,
          conflicting_candidate_admission_decision_id:
            admission.candidate_admission_decision_id,
          research_preflight_commitment_id:
            graph.commitment.research_preflight_commitment_id,
          trading_evaluation_result_id: alternateEvaluationId
        }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("admits only one distinct ID when separate LocalStore writers race for one graph", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-race-"));
    try {
      const preparationStore = new LocalStore(root);
      await preparationStore.initialize();
      const graph = await persistBaseGraph(preparationStore, "admission-race-owner");
      const first = await persistAdmissionClosure(
        preparationStore,
        graph,
        "admitted",
        { prepareOnly: true }
      );
      const second = {
        ...structuredClone(first),
        candidate_admission_decision_id: "admission-race-second-owner"
      };
      const firstWriter = new LocalStore(root);
      const secondWriter = new LocalStore(root);

      const results = await Promise.allSettled([
        firstWriter.recordCandidateAdmissionDecision(first),
        secondWriter.recordCandidateAdmissionDecision(second)
      ]);
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toMatchObject({
        code: "candidate_admission_graph_conflict"
      });
      const persisted = await new LocalStore(root).listCandidateAdmissionDecisions();
      expect(persisted).toHaveLength(1);
      expect([
        first.candidate_admission_decision_id,
        second.candidate_admission_decision_id
      ]).toContain(persisted[0]!.candidate_admission_decision_id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart-projects legacy duplicate admission owners as an explicit graph conflict", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-legacy-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "admission-legacy-owner");
      const admission = await persistAdmissionClosure(store, graph, "admitted");
      const legacyDuplicate = {
        ...structuredClone(admission),
        candidate_admission_decision_id: "admission-legacy-second-owner"
      };
      await writeFile(
        path.join(
          root,
          "candidate-admission-decisions",
          "items",
          `${legacyDuplicate.candidate_admission_decision_id}.json`
        ),
        `${JSON.stringify(legacyDuplicate, null, 2)}\n`,
        "utf8"
      );

      const restarted = new LocalStore(root);
      await expect(restarted.listCandidateAdmissionDecisions()).resolves.toHaveLength(2);
      const service = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "stopped",
          tick_count: 1,
          completed_tick_count: 1,
          active_tick: false,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      const operations = await service.readOperations();
      const detail = await service.readSessionDetail(
        operations.sessions[0]!.research_work_item_id
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
      expect(detail?.terminal_graph).not.toHaveProperty("admission");
      expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart-projects a memory-control duplicate with a distinct source closure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-memory-control-operations-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const { graph, study } = await persistMemoryControlBaseGraph(store);
      expect(graph.source.artifact_digest).not.toBe(
        study.source.research_artifact_closure_digest
      );
      await persistAdmissionClosure(store, graph, "duplicate");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      const service = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "stopped",
          tick_count: 1,
          completed_tick_count: 1,
          active_tick: false,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      const operations = await service.readOperations();
      expect(operations.sessions).toHaveLength(1);
      expect(operations.sessions[0]).toMatchObject({
        status: "duplicate",
        status_basis: { basis_kind: "candidate_admission_decision" }
      });
      const detail = await service.readSessionDetail(
        operations.sessions[0]!.research_work_item_id
      );
      expectTerminalAuthorityMatrix(detail, "duplicate");
      expect(detail?.terminal_graph).toMatchObject({
        selected_sealed_evaluation: {
          trading_evaluation_result_ref: { id: "evaluation-duplicate" }
        },
        admission: {
          candidate_admission_decision_ref: { id: "admission-duplicate" },
          status: "duplicate"
        },
        finding: {
          research_finding_ref: { id: "finding-duplicate" }
        }
      });
      expect(detail?.lifecycle_events).toEqual(expect.arrayContaining([
        expect.objectContaining({ event_kind: "checkpoint" }),
        expect.objectContaining({ event_kind: "tick" })
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses a persisted Evaluation corrupted to predate commitment", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-evaluation-corruption-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "corrupt-evaluation-chronology");
      await persistAdmissionClosure(store, graph, "admitted");
      const evaluationPath = path.join(
        root,
        "trading-evaluation-results",
        "items",
        "evaluation-admitted.json"
      );
      const persisted = JSON.parse(await readFile(evaluationPath, "utf8")) as
        TradingEvaluationResultRecord;
      persisted.completed_at = "2026-07-23T00:00:00.999Z";
      expect(Date.parse(persisted.completed_at)).toBeLessThan(
        Date.parse(graph.commitment.committed_at)
      );
      await writeFile(evaluationPath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      const service = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "stopped",
          tick_count: 1,
          completed_tick_count: 1,
          active_tick: false,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      const operations = await service.readOperations();
      expect(operations.sessions).toHaveLength(1);
      expect(operations.sessions[0]!.status).not.toBe("admitted");
      const detail = await service.readSessionDetail(
        operations.sessions[0]!.research_work_item_id
      );
      expect(detail?.budget.completed_experiment_count).toBe(1);
      expectNoTerminalAuthority(detail, "unavailable");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses a valid terminal beside a second raw Evaluation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-evaluation-ambiguity-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "duplicate-evaluation-corruption");
      await persistAdmissionClosure(store, graph, "admitted");
      const validPath = path.join(
        root,
        "trading-evaluation-results",
        "items",
        "evaluation-admitted.json"
      );
      const sibling = JSON.parse(await readFile(validPath, "utf8")) as
        TradingEvaluationResultRecord;
      sibling.trading_evaluation_result_id = "evaluation-admitted-raw-sibling";
      sibling.submitted_artifact_digest = "malformed-second-terminal";
      sibling.completed_at = "2026-07-23T00:00:00.999Z";
      const siblingPath = path.join(
        root,
        "trading-evaluation-results",
        "items",
        `${encodeURIComponent(sibling.trading_evaluation_result_id)}.json`
      );
      await writeFile(siblingPath, `${JSON.stringify(sibling, null, 2)}\n`, "utf8");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      const service = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "stopped",
          tick_count: 1,
          completed_tick_count: 1,
          active_tick: false,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      const operations = await service.readOperations();
      expect(operations.sessions).toHaveLength(1);
      expect(operations.sessions[0]).toMatchObject({
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
      });
      expect(operations.sessions[0]!.status).not.toBe("admitted");
      const detail = await service.readSessionDetail(
        operations.sessions[0]!.research_work_item_id
      );
      expect(detail?.budget.completed_experiment_count).toBe(1);
      expectNoTerminalAuthority(detail, "unavailable");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses every allocation whose persisted origin ID is duplicated", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-allocation-origin-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "duplicate-allocation-origin");
      await persistAdmissionClosure(store, graph, "admitted");
      const allocationPath = path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        `${encodeURIComponent(graph.allocation.candidate_arena_research_allocation_id)}.json`
      );
      const copiedPath = path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        "copied-allocation-origin.json"
      );
      await writeFile(copiedPath, await readFile(allocationPath, "utf8"), "utf8");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      expect(await restarted.listCandidateArenaResearchAllocations()).toHaveLength(2);
      const service = stoppedService(restarted);

      await expect(service.readOperations()).resolves.toMatchObject({ sessions: [] });
      await expect(service.readSessionDetail(researchWorkItemId({
        research_allocation_id:
          graph.allocation.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      }))).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses both Arena-event allocations that claim one canonical evidence digest", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-arena-event-evidence-ownership-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const findings = [
        standaloneFinding("arena-event-first", "2026-07-22T23:59:58.000Z"),
        standaloneFinding("arena-event-second", "2026-07-22T23:59:59.000Z")
      ];
      await Promise.all(findings.map((finding) =>
        store.recordResearchFinding(finding)
      ));
      const evidence = findings.map(findingEvidenceArtifact);
      await Promise.all(evidence.map((artifact) =>
        store.recordResearchEvidenceArtifact(artifact)
      ));
      const allocations = [
        allocationFixture("arena-event-first"),
        allocationFixture("arena-event-second")
      ];
      allocations.forEach((allocation, index) => {
        const artifact = evidence[index]!;
        allocation.trigger = {
          trigger_kind: "arena_event",
          trigger_id: `arena-event-trigger-${index + 1}`,
          goal: "Respond to one exact sanitized Arena event.",
          triggered_at: allocation.allocated_at,
          source_ref: { ...artifact.artifact_ref },
          evidence_artifact_ref: ref(
            "research_evidence_artifact",
            artifact.research_evidence_artifact_id
          ) as {
            record_kind: "research_evidence_artifact";
            id: string;
          },
          evidence_artifact_digest: artifact.artifact_digest,
          authority_status: "research_only"
        };
        allocation.allocation_digest = digest(
          candidateArenaResearchAllocationDigestInput(allocation)
        );
      });
      for (const allocation of allocations) {
        await store.recordCandidateArenaResearchAllocation(allocation);
      }
      expect((await stoppedService(store).readOperations()).sessions).toHaveLength(2);

      const aliasedEvidence = structuredClone(evidence[0]!);
      aliasedEvidence.research_evidence_artifact_id =
        evidence[1]!.research_evidence_artifact_id;
      const secondEvidencePath = path.join(
        root,
        "research-evidence-artifacts",
        "items",
        `${encodeURIComponent(aliasedEvidence.research_evidence_artifact_id)}.json`
      );
      await writeFile(
        secondEvidencePath,
        `${JSON.stringify(aliasedEvidence, null, 2)}\n`,
        "utf8"
      );

      const secondAllocation = allocations[1]!;
      secondAllocation.trigger!.source_ref = {
        ...aliasedEvidence.artifact_ref
      };
      secondAllocation.trigger!.evidence_artifact_digest =
        aliasedEvidence.artifact_digest;
      secondAllocation.allocation_digest = digest(
        candidateArenaResearchAllocationDigestInput(secondAllocation)
      );
      const secondAllocationPath = path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        `${encodeURIComponent(
          secondAllocation.candidate_arena_research_allocation_id
        )}.json`
      );
      await writeFile(
        secondAllocationPath,
        `${JSON.stringify(secondAllocation, null, 2)}\n`,
        "utf8"
      );

      const restarted = new LocalStore(root);
      await restarted.initialize();
      const reloadedEvidence = await restarted.listResearchEvidenceArtifacts();
      expect(reloadedEvidence).toHaveLength(2);
      expect(new Set(reloadedEvidence.map((artifact) =>
        artifact.artifact_digest)).size).toBe(1);
      const reloadedAllocations =
        await restarted.listCandidateArenaResearchAllocations();
      expect(reloadedAllocations).toHaveLength(2);
      expect(new Set(reloadedAllocations.map((allocation) =>
        allocation.trigger?.evidence_artifact_digest)).size).toBe(1);

      const service = stoppedService(restarted);
      const operations = await service.readOperations();
      expect(operations.sessions).toEqual([]);
      expect(operations).not.toHaveProperty("latest_session_id");
      for (const allocation of allocations) {
        await expect(service.readSessionDetail(researchWorkItemId({
          research_allocation_id:
            allocation.candidate_arena_research_allocation_id,
          direction_kind: "trend_following"
        }))).resolves.toBeUndefined();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart fails both commitment owners closed when sealed material is reused", async () => {
    for (const field of ["rotation_commitment_digest", "suite_digest"] as const) {
      const root = await mkdtemp(path.join(os.tmpdir(), `ouroboros-sealed-${field}-`));
      try {
        const store = new LocalStore(root);
        await store.initialize();
        const original = await persistBaseGraph(store, `sealed-original-${field}`);
        await persistAdmissionClosure(store, original, "admitted");
        const sibling = await persistBaseGraph(store, `sealed-sibling-${field}`);
        const baseline = await stoppedService(store).readOperations();
        expect(baseline.sessions.find((session) => session.research_allocation_id ===
          original.allocation.candidate_arena_research_allocation_id)?.status).toBe("admitted");
        const siblingPath = path.join(
          root,
          "research-preflight-commitments",
          "items",
          `${encodeURIComponent(sibling.commitment.research_preflight_commitment_id)}.json`
        );
        const persisted = JSON.parse(await readFile(siblingPath, "utf8")) as
          ResearchPreflightCommitmentRecord;
        persisted.sealed_admission_policy[field] =
          original.commitment.sealed_admission_policy[field];
        persisted.commitment_digest = digest(
          researchPreflightCommitmentDigestInput(persisted)
        );
        await writeFile(siblingPath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

        const restarted = new LocalStore(root);
        await restarted.initialize();
        const commitments = await restarted.listResearchPreflightCommitments();
        expect(commitments).toHaveLength(2);
        expect(new Set(commitments.map((entry) =>
          entry.research_preflight_commitment_id)).size).toBe(2);
        expect(new Set(commitments.map((entry) => entry.research_allocation_ref.id)).size)
          .toBe(2);
        expect(new Set(commitments.map((entry) =>
          entry.sealed_admission_policy[field])).size).toBe(1);
        const operations = await stoppedService(restarted).readOperations();
        expect(operations.sessions).toHaveLength(2);
        for (const allocation of [original.allocation, sibling.allocation]) {
          const row = operations.sessions.find((session) =>
            session.research_allocation_id ===
              allocation.candidate_arena_research_allocation_id
          );
          expect(row, field).toMatchObject({
            status: "recovering",
            status_basis: { basis_kind: "incomplete_persisted_graph" },
            projection_health: "degraded",
            degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
          });
          const selectedArtifactAvailability =
            allocation.candidate_arena_research_allocation_id ===
              original.allocation.candidate_arena_research_allocation_id
            ? "unavailable"
            : "not_selected";
          expectNoTerminalAuthority(await stoppedService(restarted).readSessionDetail(
            row!.research_work_item_id
          ), selectedArtifactAvailability);
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("restart suppresses a descendant terminal when its prior checkpoint has two raw owners", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-checkpoint-ownership-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const prior = await persistBaseGraph(store, "checkpoint-prior");
      await persistNonAdmissionClosure(store, prior, "finished_without_submission");
      const priorCheckpoint = (await store.listResearchWorkerCheckpoints()).find((candidate) =>
        candidate.research_preflight_commitment_ref.id ===
          prior.commitment.research_preflight_commitment_id
      )!;
      const currentAllocation = allocationFixture("z-checkpoint-current");
      const currentSource = systemCode(
        "source-code-z-checkpoint-current",
        digest("source-z-checkpoint-current"),
        "2026-07-23T00:00:00.000Z"
      );
      const currentCommitment = structuredClone(prior.commitment);
      currentCommitment.research_preflight_commitment_id =
        "research-preflight-z-checkpoint-current";
      currentCommitment.candidate_arena_tick_id = currentAllocation.tick_id;
      currentCommitment.research_allocation_ref = ref(
        "candidate_arena_research_allocation",
        currentAllocation.candidate_arena_research_allocation_id
      );
      currentCommitment.research_allocation_digest = currentAllocation.allocation_digest;
      currentCommitment.source_system_code_ref = ref(
        "system_code",
        currentSource.system_code_id
      );
      currentCommitment.source_artifact_digest = currentSource.artifact_digest;
      currentCommitment.development_policy.suite_digest =
        digest("development-z-checkpoint-current");
      currentCommitment.sealed_admission_policy.rotation_commitment_digest =
        digest("rotation-z-checkpoint-current");
      currentCommitment.sealed_admission_policy.suite_digest =
        digest("sealed-z-checkpoint-current");
      currentCommitment.commitment_digest = digest(
        researchPreflightCommitmentDigestInput(currentCommitment)
      );
      const current: BaseGraph = {
        allocation: currentAllocation,
        direction: prior.direction,
        worker: prior.worker,
        source: currentSource,
        commitment: currentCommitment
      };
      await store.recordCandidateArenaResearchAllocation(currentAllocation);
      await store.recordSystemCode(currentSource);
      await store.recordResearchPreflightCommitment(currentCommitment);
      await persistAdmissionClosure(store, current, "admitted", {
        priorCheckpoint
      });
      const baseline = await stoppedService(store).readOperations();
      expect(baseline.sessions.find((session) => session.research_allocation_id ===
        currentAllocation.candidate_arena_research_allocation_id)?.status).toBe("admitted");

      const duplicate = structuredClone(priorCheckpoint);
      duplicate.research_worker_checkpoint_id =
        `zz-duplicate-${priorCheckpoint.research_worker_checkpoint_id}`;
      duplicate.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(duplicate));
      const duplicatePath = path.join(
        root,
        "research-worker-checkpoints",
        "items",
        `${encodeURIComponent(duplicate.research_worker_checkpoint_id)}.json`
      );
      await writeFile(duplicatePath, `${JSON.stringify(duplicate, null, 2)}\n`, "utf8");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      expect(await restarted.listResearchWorkerCheckpoints()).toHaveLength(3);
      const operations = await stoppedService(restarted).readOperations();
      const currentRow = operations.sessions.find((session) =>
        session.research_allocation_id ===
          currentAllocation.candidate_arena_research_allocation_id
      );
      expect(currentRow).toMatchObject({
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
      });
      const detail = await stoppedService(restarted).readSessionDetail(
        currentRow!.research_work_item_id
      );
      expectNoTerminalAuthority(detail, "unavailable");
      expect(detail?.submission_history_availability).toBe("unavailable_until_checkpoint");
      expect(detail?.development_submissions).toEqual([]);
      expect(detail?.lifecycle_events.map((event) => event.event_kind)).not.toEqual(
        expect.arrayContaining(["evaluation", "checkpoint", "handoff_conformance", "admission"])
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses a memory descendant for duplicate prior checkpoints without a current checkpoint", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-memory-prior-no-current-checkpoint-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const prior = await persistBaseGraph(store, "memory-prior-no-current");
      const priorCheckpoint = checkpointFixture(prior, {
        terminalReason: "finished_without_submission"
      });
      priorCheckpoint.closed_at = "2026-07-23T00:00:01.500Z";
      priorCheckpoint.checkpoint_digest = digest(
        researchWorkerCheckpointDigestInput(priorCheckpoint)
      );
      await store.recordResearchWorkerCheckpoint(priorCheckpoint);

      const currentAllocation = allocationFixture("z-memory-current-no-checkpoint");
      const currentSource = systemCode(
        "source-code-z-memory-current-no-checkpoint",
        digest("source-z-memory-current-no-checkpoint"),
        "2026-07-23T00:00:00.000Z"
      );
      const currentCommitment = structuredClone(prior.commitment);
      currentCommitment.research_preflight_commitment_id =
        "research-preflight-z-memory-current-no-checkpoint";
      currentCommitment.candidate_arena_tick_id = currentAllocation.tick_id;
      currentCommitment.research_allocation_ref = ref(
        "candidate_arena_research_allocation",
        currentAllocation.candidate_arena_research_allocation_id
      );
      currentCommitment.research_allocation_digest =
        currentAllocation.allocation_digest;
      currentCommitment.source_system_code_ref = ref(
        "system_code",
        currentSource.system_code_id
      );
      currentCommitment.source_artifact_digest = currentSource.artifact_digest;
      currentCommitment.development_policy.suite_digest =
        digest("development-z-memory-current-no-checkpoint");
      currentCommitment.sealed_admission_policy.rotation_commitment_digest =
        digest("rotation-z-memory-current-no-checkpoint");
      currentCommitment.sealed_admission_policy.suite_digest =
        digest("sealed-z-memory-current-no-checkpoint");
      currentCommitment.memory_policy = {
        protocol_version: "research_worker_memory_v1",
        memory_mode: "released_memory",
        memory_source_digest: digest("memory-z-current-source"),
        available_memory_item_count: 1,
        arena_context_digest: digest("memory-z-current-context"),
        prior_checkpoint: {
          disposition: "included",
          checkpoint_ref: ref(
            "research_worker_checkpoint",
            priorCheckpoint.research_worker_checkpoint_id
          ),
          checkpoint_digest: priorCheckpoint.checkpoint_digest
        }
      };
      currentCommitment.committed_at = priorCheckpoint.closed_at;
      currentCommitment.commitment_digest = digest(
        researchPreflightCommitmentDigestInput(currentCommitment)
      );
      const current: BaseGraph = {
        allocation: currentAllocation,
        direction: prior.direction,
        worker: prior.worker,
        source: currentSource,
        commitment: currentCommitment
      };
      await store.recordCandidateArenaResearchAllocation(currentAllocation);
      await store.recordSystemCode(currentSource);
      await store.recordResearchPreflightCommitment(currentCommitment);
      await persistAdmissionClosure(store, current, "admitted", {
        recordCheckpoint: false
      });

      const cleanService = stoppedService(store);
      const cleanRow = (await cleanService.readOperations()).sessions.find((session) =>
        session.research_allocation_id ===
          currentAllocation.candidate_arena_research_allocation_id
      );
      expect(cleanRow).toMatchObject({ status: "admitted" });
      const cleanDetail = await cleanService.readSessionDetail(
        cleanRow!.research_work_item_id
      );
      expect(cleanDetail).toMatchObject({
        submission_history_availability: "unavailable_until_checkpoint",
        selected_artifact_availability: "available"
      });
      expect(cleanDetail?.lifecycle_events.map((event) => event.event_kind))
        .not.toContain("checkpoint");

      const duplicate = structuredClone(priorCheckpoint);
      duplicate.research_worker_checkpoint_id =
        `zz-duplicate-${priorCheckpoint.research_worker_checkpoint_id}`;
      duplicate.checkpoint_digest = digest(
        researchWorkerCheckpointDigestInput(duplicate)
      );
      const duplicatePath = path.join(
        root,
        "research-worker-checkpoints",
        "items",
        `${encodeURIComponent(duplicate.research_worker_checkpoint_id)}.json`
      );
      await writeFile(
        duplicatePath,
        `${JSON.stringify(duplicate, null, 2)}\n`,
        "utf8"
      );

      const restarted = new LocalStore(root);
      await restarted.initialize();
      const checkpoints = await restarted.listResearchWorkerCheckpoints();
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints.every((candidate) =>
        candidate.research_preflight_commitment_ref.id ===
          prior.commitment.research_preflight_commitment_id)).toBe(true);
      const restartedService = stoppedService(restarted);
      const currentRow = (await restartedService.readOperations()).sessions.find((session) =>
        session.research_allocation_id ===
          currentAllocation.candidate_arena_research_allocation_id
      );
      expect(currentRow).toMatchObject({
        status_basis: { basis_kind: "incomplete_persisted_graph" },
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
      });
      const detail = await restartedService.readSessionDetail(
        currentRow!.research_work_item_id
      );
      expectNoTerminalAuthority(detail, "unavailable");
      expect(detail).toMatchObject({
        degraded_reasons: expect.arrayContaining(["selected_artifact_unavailable"]),
        submission_history_availability: "unavailable_until_checkpoint",
        development_submissions: []
      });
      expect(detail?.lifecycle_events.map((event) => event.event_kind)).not.toEqual(
        expect.arrayContaining([
          "evaluation",
          "checkpoint",
          "handoff_conformance",
          "admission"
        ])
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function stoppedService(store: LocalStore): ResearchOperationsProjectionService {
  return new ResearchOperationsProjectionService({
    store,
    runnerHealth: () => ({
      status: "stopped",
      tick_count: 1,
      completed_tick_count: 1,
      active_tick: false,
      active_research_work_items: [],
      consecutive_failure_count: 0,
      runtime_coordination_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "runtime_coordination_only"
    })
  });
}

function expectNoTerminalAuthority(
  detail: ResearchSessionDetailReadModel | undefined,
  selectedArtifactAvailability: "not_selected" | "unavailable" = "not_selected"
): void {
  expect(detail).toBeDefined();
  expect(detail).toMatchObject({
    selected_artifact_availability: selectedArtifactAvailability
  });
  expect(detail?.status).not.toBe("admitted");
  expect(detail).not.toHaveProperty("selected_submission_sequence");
  expect(detail).not.toHaveProperty("selected_system_code_ref");
  expect(detail).not.toHaveProperty("selected_system_code_artifact_digest");
  expect(detail).not.toHaveProperty("admission_decision_ref");
  expect(detail).not.toHaveProperty("paper_handoff_conformance_ref");
  expect(detail).not.toHaveProperty("admitted_candidate_id");
  for (const submission of detail?.development_submissions ?? []) {
    expect(submission.selected).toBe(false);
    expect(submission).not.toHaveProperty("selected_system_code_ref");
    expect(submission).not.toHaveProperty("selected_system_code_artifact_digest");
  }
  expect(detail?.terminal_graph).not.toHaveProperty("selected_sealed_evaluation");
  expect(detail?.terminal_graph).not.toHaveProperty("admission");
  expect(detail?.terminal_graph).not.toHaveProperty("finding");
  expect(detail?.terminal_graph).not.toHaveProperty("artifact_lineage");
  expect(detail?.terminal_graph).not.toHaveProperty("paper_handoff_conformance");
  expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  expect(detail?.lifecycle_events.map((event) => event.event_kind)).not.toEqual(
    expect.arrayContaining(["evaluation", "handoff_conformance", "admission"])
  );
}

function expectTerminalAuthorityMatrix(
  detail: ResearchSessionDetailReadModel | undefined,
  kind: OracleCase
): void {
  expect(detail, kind).toBeDefined();
  expect(detail?.provider_logs_availability, kind).toBe("not_persisted");
  expect(detail?.terminal_graph, kind).not.toHaveProperty("artifact_lineage");
  expect(detail?.submission_history_availability, kind).toBe("checkpoint_summary");
  const lifecycle = detail?.lifecycle_events.map((event) => event.event_kind);
  const isAdmission = kind === "admitted" || kind === "duplicate" ||
    kind === "quarantined";
  if (isAdmission) {
    expect(detail?.budget.completed_experiment_count, kind).toBe(1);
    expect(detail, kind).toMatchObject({
      selected_artifact_availability: "available",
      recorded_submission_count: 1,
      projected_submission_count: 1,
      omitted_submission_count: 0,
      submission_history_truncated: false,
      terminal_graph: {
        selected_sealed_evaluation: {},
        admission: {},
        finding: {}
      }
    });
    expect(detail?.development_submissions, kind).toHaveLength(1);
    expect(lifecycle, kind).toEqual(kind === "admitted"
      ? [
          "allocation",
          "commitment",
          "evaluation",
          "handoff_conformance",
          "admission",
          "checkpoint",
          "tick"
        ]
      : [
          "allocation",
          "commitment",
          "evaluation",
          "admission",
          "checkpoint",
          "tick"
        ]);
    if (kind === "admitted") {
      expect(detail, kind).toHaveProperty("admitted_candidate_id");
      expect(detail, kind).toHaveProperty("paper_handoff_conformance_ref");
      expect(detail?.terminal_graph, kind).toHaveProperty(
        "paper_handoff_conformance"
      );
      expect(detail?.terminal_graph, kind).toHaveProperty(
        "admitted_arena_handoff"
      );
    } else {
      expect(detail, kind).not.toHaveProperty("admitted_candidate_id");
      expect(detail, kind).not.toHaveProperty("paper_handoff_conformance_ref");
      expect(detail?.terminal_graph, kind).not.toHaveProperty(
        "paper_handoff_conformance"
      );
      expect(detail?.terminal_graph, kind).not.toHaveProperty(
        "admitted_arena_handoff"
      );
    }
    return;
  }

  expectNoTerminalAuthority(detail);
  expect(detail, kind).toMatchObject({
    recorded_submission_count: 0,
    projected_submission_count: 0,
    omitted_submission_count: 0,
    submission_history_truncated: false
  });
  expect(detail?.development_submissions, kind).toEqual([]);
  expect(lifecycle, kind).toEqual(kind === "restart_recovery"
    ? ["allocation", "commitment", "checkpoint"]
    : ["allocation", "commitment", "checkpoint", "tick"]);
}

interface BaseGraph {
  allocation: CandidateArenaResearchAllocationRecord;
  direction: ResearchDirectionRecord;
  worker: ResearchWorkerRecord;
  source: SystemCodeRecord;
  commitment: ResearchPreflightCommitmentRecord;
}

async function persistBaseGraph(store: LocalStore, suffix: string): Promise<BaseGraph> {
  const safeSuffix = suffix.replaceAll("_", "-");
  const allocation = allocationFixture(suffix);
  const direction: ResearchDirectionRecord = {
    record_kind: "research_direction",
    version: 1,
    research_direction_id: `research-direction-${suffix}`,
    direction_kind: "trend_following",
    market_scope: "external_trading_api_fixture",
    prompt_seed: "Explore robust trend behavior without prescribing an implementation.",
    created_at: "2026-07-23T00:00:00.000Z",
    authority_status: "research_seed_only"
  };
  const worker: ResearchWorkerRecord = {
    record_kind: "research_worker",
    version: 1,
    research_worker_id: `research-worker-${safeSuffix}`,
    display_name: `ResearchWorker ${suffix}`,
    model: "fixture",
    provider_kind: "fixture_only",
    agent_profile_id: `managed-agent-${safeSuffix}`,
    research_direction_ref: ref("research_direction", direction.research_direction_id),
    workspace_key: `candidate-arena-workers/research-worker-${safeSuffix}`,
    lifecycle_protocol: "research_worker_checkpoint_v1",
    created_at: "2026-07-23T00:00:00.000Z",
    status: "active",
    authority_status: "research_only"
  };
  const source = systemCode(`source-code-${suffix}`, digest(`source-${suffix}`),
    "2026-07-23T00:00:00.000Z");
  const commitment: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: `research-preflight-${suffix}`,
    candidate_arena_tick_id: allocation.tick_id,
    research_direction_ref: ref("research_direction", direction.research_direction_id),
    research_worker_ref: ref("research_worker", worker.research_worker_id),
    research_allocation_ref: ref(
      "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id
    ),
    research_allocation_digest: allocation.allocation_digest,
    source_system_code_ref: ref("system_code", source.system_code_id),
    source_artifact_digest: source.artifact_digest,
    methodology: {
      direction_kind: "trend_following",
      hypothesis: "A bounded trend candidate may improve robust behavior.",
      method: "Use the fixed development replay before sealed admission.",
      evidence_bindings: []
    },
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: digest(`development-${suffix}`),
      submission_limit: 1,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest(`rotation-${suffix}`),
      suite_digest: digest(`sealed-${suffix}`),
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: "2026-07-23T00:00:01.000Z",
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("pending")
  };
  commitment.commitment_digest = digest(researchPreflightCommitmentDigestInput(commitment));
  await store.recordCandidateArenaResearchAllocation(allocation);
  await store.recordResearchDirection(direction);
  await store.recordResearchWorker(worker);
  await store.recordSystemCode(source);
  await store.recordResearchPreflightCommitment(commitment);
  return { allocation, direction, worker, source, commitment };
}

async function persistMemoryControlBaseGraph(store: LocalStore): Promise<{
  graph: BaseGraph;
  study: ResearchMemoryControlStudyRecord;
}> {
  const source = systemCode(
    "source-code-memory-control",
    digest("memory-control-system-code-artifact"),
    "2026-07-22T23:59:58.000Z"
  );
  const direction: ResearchDirectionRecord = {
    record_kind: "research_direction",
    version: 1,
    research_direction_id: "research-direction-memory-control",
    direction_kind: "trend_following",
    market_scope: "external_trading_api_fixture",
    prompt_seed: "Measure released memory without changing candidate authority.",
    created_at: "2026-07-22T23:59:58.000Z",
    authority_status: "research_seed_only"
  };
  const worker: ResearchWorkerRecord = {
    record_kind: "research_worker",
    version: 1,
    research_worker_id: "research-worker-memory-control",
    display_name: "ResearchWorker memory control",
    model: "gpt-test",
    provider_kind: "codex_cli",
    agent_profile_id: "memory-control-agent",
    research_direction_ref: ref("research_direction", direction.research_direction_id),
    workspace_key: "candidate-arena-workers/research-worker-memory-control",
    lifecycle_protocol: "research_worker_checkpoint_v1",
    created_at: "2026-07-22T23:59:58.000Z",
    status: "active",
    authority_status: "research_only"
  };
  const study = decideResearchMemoryControlStudy({
    idempotencyKey: "research-operations-memory-control-admission",
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("memory-control-baseline"),
      regular_file_count: 1,
      total_bytes: 1,
      exclusion_policy: "research_experiment_evidence_only"
    },
    source: {
      candidate_ref: ref("trading_system_candidate", "memory-control-source-candidate"),
      candidate_version_ref: ref("candidate_version", "memory-control-source-version"),
      system_code_ref: ref("system_code", source.system_code_id),
      system_code_artifact_digest: source.artifact_digest,
      system_code_record_digest: digest(
        paperTradingComparisonSystemCodeRecordDigestInput(source)
      ),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("memory-control-research-artifact-closure")
    },
    researchAgent: {
      id: worker.agent_profile_id!,
      provider: "codex",
      model: worker.model!,
      permission_policy: "artifact_workspace_only"
    },
    opportunityProtocol: {
      development_suite_version: "research_development_replay_v1",
      development_suite_digest: digest("memory-control-development"),
      sealed_suite_version: "research_sealed_admission_v1",
      sealed_generator_version: "research_scenario_generator_v1",
      sealed_rotation_commitment_digest: digest("memory-control-rotation"),
      sealed_suite_digest: digest("memory-control-sealed")
    },
    directions: Array.from({ length: 6 }, (_, index) => index % 2 === 0 ? {
      research_direction_id: direction.research_direction_id,
      direction_kind: "trend_following" as const
    } : {
      research_direction_id: "research-direction-memory-control-mean",
      direction_kind: "mean_reversion" as const
    }),
    committedAt: "2026-07-22T23:59:59.000Z"
  });
  const arm = study.pair_plans[0]!.released_memory_treatment;
  const allocation = allocationFixture("memory-control-admitted");
  allocation.tick_id = arm.tick_id;
  allocation.allocation_digest = digest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
  const commitment: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: "research-preflight-memory-control-admitted",
    candidate_arena_tick_id: arm.tick_id,
    research_direction_ref: ref("research_direction", direction.research_direction_id),
    research_worker_ref: ref("research_worker", worker.research_worker_id),
    research_allocation_ref: ref(
      "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id
    ),
    research_allocation_digest: allocation.allocation_digest,
    source_system_code_ref: ref("system_code", source.system_code_id),
    source_artifact_digest: study.source.research_artifact_closure_digest,
    methodology: {
      direction_kind: "trend_following",
      hypothesis: "Released memory may reduce exact behavioral repeats.",
      method: "Use the exact precommitted memory-control opportunity.",
      evidence_bindings: []
    },
    development_policy: {
      suite_version: study.opportunity_protocol.development_suite_version,
      suite_digest: study.opportunity_protocol.development_suite_digest,
      submission_limit: 1,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: study.opportunity_protocol.sealed_suite_version,
      generator_version: study.opportunity_protocol.sealed_generator_version,
      rotation_commitment_digest:
        study.opportunity_protocol.sealed_rotation_commitment_digest,
      suite_digest: study.opportunity_protocol.sealed_suite_digest,
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    memory_policy: {
      protocol_version: "research_worker_memory_v1",
      memory_mode: arm.memory_mode,
      memory_source_digest: digest("memory-control-source-memory"),
      available_memory_item_count: 1,
      arena_context_digest: digest("memory-control-arena-context"),
      prior_checkpoint: { disposition: "none_available" },
      control_assignment: {
        study_ref: ref(
          "research_memory_control_study",
          study.research_memory_control_study_id
        ),
        study_digest: study.study_digest,
        pair_index: 1,
        arm_kind: arm.arm_kind
      }
    },
    committed_at: "2026-07-23T00:00:01.000Z",
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("pending")
  };
  commitment.commitment_digest = digest(researchPreflightCommitmentDigestInput(commitment));

  await store.recordResearchMemoryControlStudy(study);
  await store.recordResearchDirection(direction);
  await store.recordResearchWorker(worker);
  await store.recordSystemCode(source);
  await store.recordCandidateArenaResearchAllocation(allocation);
  await store.recordResearchPreflightCommitment(commitment);
  return { graph: { allocation, direction, worker, source, commitment }, study };
}

async function persistAdmissionClosure(
  store: LocalStore,
  graph: BaseGraph,
  kind: "admitted" | "duplicate" | "quarantined",
  options: {
    priorCheckpoint?: ResearchWorkerCheckpointRecord;
    recordCheckpoint?: boolean;
    prepareOnly?: boolean;
  } = {}
): Promise<CandidateAdmissionDecisionRecord> {
  const selected = systemCode(
    `selected-code-${kind}`,
    kind === "duplicate"
      ? graph.commitment.source_artifact_digest
      : digest(`selected-${kind}`),
    "2026-07-23T00:00:04.000Z"
  );
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-${kind}`,
    research_worker_ref: { ...graph.commitment.research_worker_ref },
    research_direction_ref: { ...graph.commitment.research_direction_ref },
    system_code_ref: ref("system_code", selected.system_code_id),
    trading_evaluation_task_ref: ref("trading_evaluation_task", `task-${kind}`),
    trace_ref: ref("trace_placeholder", `experiment-trace-${kind}`),
    submitted_at: "2026-07-23T00:00:02.100Z",
    status: kind === "quarantined" ? "failed" : "evaluated",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: `evaluation-${kind}`,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    evaluator_ref: ref("external_evaluator", `evaluator-${kind}`),
    result_status: kind === "quarantined" ? "disqualified" : "accepted",
    evidence_disposition: kind === "quarantined" ? "quarantined_for_review" : "not_counted",
    score_summary: {
      total_score: kind === "quarantined" ? 0 : 1,
      oos_score: 1,
      drawdown_score: 1,
      turnover_score: 1,
      cost_survival_score: 1,
      reproducibility_score: 1,
      complexity_penalty: 0
    },
    metric_refs: [],
    evaluator_trace_ref: ref("trace_placeholder", `evaluator-trace-${kind}`),
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      graph.commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: graph.commitment.commitment_digest,
    submitted_system_code_ref: ref("system_code", selected.system_code_id),
    submitted_artifact_digest: selected.artifact_digest,
    sealed_admission_suite_digest: graph.commitment.sealed_admission_policy.suite_digest,
    evaluation_phase: "sealed_admission",
    submission_sequence: 1,
    selected_development_submission_sequence: 1,
    ...(kind === "quarantined" ? { disqualification_reason: "research_worker_failed" } : {}),
    completed_at: "2026-07-23T00:00:04.000Z",
    authority_status: "not_counted"
  };
  const conformance = kind === "admitted"
    ? conformanceFixture(selected, experiment)
    : undefined;
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `finding-${kind}`,
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      evaluation.trading_evaluation_result_id
    ),
    finding_kind: kind === "admitted" ? "positive_result" :
      kind === "duplicate" ? "duplicate_result" : "failure_analysis",
    summary: `Canonical ${kind} Finding.`,
    supporting_record_refs: [ref(
      "trading_evaluation_result",
      evaluation.trading_evaluation_result_id
    )],
    created_at: "2026-07-23T00:00:04.100Z",
    authority_status: "research_trace_only"
  };
  const admissionInput = kind === "admitted" ? {
    research_worker_outcome: "changed" as const,
    experiment_status: "evaluated" as const,
    evaluation_status: "accepted" as const,
    evidence_disposition: "not_counted" as const,
    paper_handoff_conformance_status: "passed" as const
  } : kind === "duplicate" ? {
    research_worker_outcome: "unchanged" as const,
    experiment_status: "evaluated" as const,
    evaluation_status: "accepted" as const,
    evidence_disposition: "not_counted" as const
  } : {
    research_worker_outcome: "failed" as const,
    experiment_status: "failed" as const,
    evaluation_status: "disqualified" as const,
    evidence_disposition: "quarantined_for_review" as const
  };
  const admission: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: `admission-${kind}`,
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      graph.commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: graph.commitment.commitment_digest,
    source_system_code_ref: ref("system_code", graph.source.system_code_id),
    system_code_ref: ref("system_code", selected.system_code_id),
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      evaluation.trading_evaluation_result_id
    ),
    research_finding_ref: ref("research_finding", finding.research_finding_id),
    source_artifact_digest: graph.commitment.source_artifact_digest,
    submitted_artifact_digest: selected.artifact_digest,
    ...admissionInput,
    ...decideCandidateAdmission(admissionInput),
    ...(conformance ? {
      paper_trading_handoff_conformance_ref: ref(
        "paper_trading_handoff_conformance",
        conformance.paper_trading_handoff_conformance_id
      ),
      paper_trading_handoff_conformance_digest: conformance.evidence_digest
    } : {}),
    decided_at: "2026-07-23T00:00:05.000Z",
    authority_status: "not_live"
  };
  await store.recordSystemCode(selected);
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  if (conformance) await store.recordPaperTradingHandoffConformance(conformance);
  await store.recordResearchFinding(finding);
  if (options.prepareOnly) return admission;
  await store.recordCandidateAdmissionDecision(admission);
  const admittedCandidateId = kind === "admitted"
    ? await materializeAdmittedCandidate(store, graph, selected)
    : undefined;
  if (options.recordCheckpoint !== false) {
    await store.recordResearchWorkerCheckpoint(checkpointFixture(graph, {
      terminalReason: "admission_recorded",
      admission,
      evaluation,
      priorCheckpoint: options.priorCheckpoint
    }));
  }
  await store.recordCandidateArenaTick(tickFixture(graph.allocation, {
    direction_kind: "trend_following",
    status: kind === "admitted" ? "created" : kind,
    ...(kind === "admitted" ? { candidate_id: admittedCandidateId! } : {
      finding: finding.summary
    }),
    admission_decision_id: admission.candidate_admission_decision_id,
    admission_reason: admission.reason,
    ...(kind === "admitted" && conformance ? {
      research_preflight: {
        commitment_id: graph.commitment.research_preflight_commitment_id,
        development_submission_count: 1,
        sealed_terminal_status: "accepted",
        reason: "accepted",
        authority_status: "not_promotion_authority"
      },
      paper_handoff_conformance: {
        conformance_id: conformance.paper_trading_handoff_conformance_id,
        status: conformance.status,
        reason: conformance.reason,
        authority_status: "research_only"
      }
    } : {})
  }));
  return admission;
}

async function materializeAdmittedCandidate(
  store: LocalStore,
  graph: BaseGraph,
  selected: SystemCodeRecord
): Promise<string> {
  const selectedSystemCodeRef = ref("system_code", selected.system_code_id);
  const outcome = await store.materializeCandidate({
    idempotency_key: `research-operations-${graph.allocation.tick_id}`,
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-test",
      invocation_surface: "local-store-research-operations-oracle",
      agent_run_id: `materialization-agent-run-${graph.allocation.tick_id}`,
      agent_event_id: `materialization-agent-event-${graph.allocation.tick_id}`,
      trace_id: `materialization-trace-${graph.allocation.tick_id}`,
      output_artifact_hash: selected.artifact_digest
    },
    candidate: {
      title: `Materialized ${graph.allocation.tick_id}`,
      system_summary: "Canonical admitted CandidateArena materialization fixture.",
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: "Bounded trend-following research candidate.",
      market: "ExternalTradingApiProvider",
      instrument: "generic trading instruments",
      supported_stage_binding_profiles: ["backtest", "paper"]
    },
    program: {
      summary: "Exact selected SystemCode emitted by the ResearchWorker.",
      declared_runtime: "python-sandbox-placeholder",
      declared_outputs: ["OrderRequest"]
    },
    capability_package: {
      summary: "Public-market research-only capability package.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_market_bars"],
      forbidden_contents: ["exchange_credentials", "live_order_authority"]
    },
    artifact_refs: [selectedSystemCodeRef],
    system_code_ref: selectedSystemCodeRef,
    full_cycle_lineage: {
      source: {
        trading_system_id: `source-${graph.allocation.tick_id}`,
        candidate_version_id: `source-version-${graph.allocation.tick_id}`,
        system_code_ref: { ...graph.commitment.source_system_code_ref }
      },
      generated: {
        system_code_ref: selectedSystemCodeRef,
        artifact_digest: selected.artifact_digest,
        generated_by_agent: true
      },
      evaluation: {
        status: "accepted",
        score: 1,
        direction_kind: "trend_following"
      }
    }
  });
  if (outcome.status !== "materialized") {
    throw new Error("expected admitted LocalStore candidate materialization");
  }
  return outcome.candidate.candidate_id;
}

async function persistNonAdmissionClosure(
  store: LocalStore,
  graph: BaseGraph,
  kind: "finished_without_submission" | "execution_failed" | "restart_recovery"
): Promise<void> {
  await store.recordResearchWorkerCheckpoint(checkpointFixture(graph, {
    terminalReason: kind
  }));
  if (kind === "restart_recovery") return;
  await store.recordCandidateArenaTick(tickFixture(graph.allocation, kind ===
    "finished_without_submission" ? {
      direction_kind: "trend_following",
      status: "no_submission",
      finding: "ResearchWorker finished without selecting a submission."
    } : {
      direction_kind: "trend_following",
      status: "failed",
      error: "Research execution failed closed."
    }));
}

function allocationFixture(suffix: string): CandidateArenaResearchAllocationRecord {
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
      direction_kind: "trend_following",
      selection_kind: "explicit",
      priority: 1,
      experiment_budget: 1,
      signal_score: 0,
      reasons: ["test_explicit_direction"]
    }],
    deferred_directions: [
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk",
      "execution_cost_robustness"
    ],
    allocated_at: "2026-07-23T00:00:00.000Z",
    allocation_digest: digest("pending"),
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  allocation.allocation_digest = digest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
  return allocation;
}

function checkpointFixture(
  graph: BaseGraph,
  input: {
    terminalReason: ResearchWorkerCheckpointRecord["terminal_reason"];
    admission?: CandidateAdmissionDecisionRecord;
    evaluation?: TradingEvaluationResultRecord;
    priorCheckpoint?: ResearchWorkerCheckpointRecord;
  }
): ResearchWorkerCheckpointRecord {
  const completed = input.terminalReason === "admission_recorded" ||
    input.terminalReason === "finished_without_submission";
  const hasSubmission = input.admission !== undefined;
  const previousCommitted = input.priorCheckpoint
    ?.development_budget.cumulative_committed_submission_limit ?? 0;
  const previousRecorded = input.priorCheckpoint
    ?.development_budget.cumulative_recorded_submission_count ?? 0;
  const currentEntries: ResearchWorkerCheckpointRecord["notebook"]["recent_entries"] =
    hasSubmission ? [{
      sequence: previousRecorded + 1,
      candidate_arena_tick_id: graph.commitment.candidate_arena_tick_id,
      iteration: 1,
      decision: input.admission?.status === "quarantined" ? "crash" : "keep",
      agent_status: input.admission?.status === "quarantined" ? "failed" : "edited",
      score: input.admission?.status === "admitted" ? 1 : 0,
      summary: `Canonical ${input.admission?.status} development submission.`,
      evaluation_status: input.evaluation?.result_status === "accepted"
        ? "accepted"
        : "disqualified",
      risk_decision: input.admission?.status === "admitted"
        ? "valid_order_request"
        : "no_order_request",
      net_revenue_usdt: input.admission?.status === "admitted" ? 1 : 0
    }] : [];
  const record: ResearchWorkerCheckpointRecord = {
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id: `checkpoint-${graph.allocation.tick_id}`,
    research_worker_ref: { ...graph.commitment.research_worker_ref },
    research_direction_ref: { ...graph.commitment.research_direction_ref },
    candidate_arena_tick_id: graph.commitment.candidate_arena_tick_id,
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      graph.commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: graph.commitment.commitment_digest,
    workspace_key: graph.worker.workspace_key!,
    ...(input.priorCheckpoint ? {
      previous_checkpoint_ref: ref(
        "research_worker_checkpoint",
        input.priorCheckpoint.research_worker_checkpoint_id
      ),
      previous_checkpoint_digest: input.priorCheckpoint.checkpoint_digest
    } : {}),
    development_budget: {
      submission_limit: 1,
      recorded_submission_count: hasSubmission ? 1 : 0,
      cumulative_committed_submission_limit: previousCommitted + 1,
      cumulative_recorded_submission_count: previousRecorded + (hasSubmission ? 1 : 0),
      remaining_submission_authority: 0
    },
    notebook: {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: previousRecorded + (hasSubmission ? 1 : 0),
      recent_entries: [
        ...(input.priorCheckpoint?.notebook.recent_entries ?? []),
        ...currentEntries
      ]
    },
    terminal_status: completed ? "completed" : "failed_closed",
    terminal_reason: input.terminalReason,
    ...(input.admission ? {
      candidate_admission_decision_ref: ref(
        "candidate_admission_decision",
        input.admission.candidate_admission_decision_id
      )
    } : {}),
    closed_at: "2026-07-23T00:00:06.000Z",
    checkpoint_digest: digest("pending"),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(record));
  return record;
}

function tickFixture(
  allocation: CandidateArenaResearchAllocationRecord,
  result: CandidateArenaTickDirectionResultReadModel
): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-${allocation.tick_id}`,
    tick_id: allocation.tick_id,
    started_at: allocation.allocated_at,
    completed_at: "2026-07-23T00:00:07.000Z",
    status: result.status === "failed" ? "completed_with_errors" : "completed",
    created_candidate_refs: result.candidate_id
      ? [ref("trading_system_candidate", result.candidate_id)]
      : [],
    direction_results: [result],
    research_allocation_ref: ref(
      "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id
    ),
    research_allocation_digest: allocation.allocation_digest,
    authority_status: "not_live"
  };
}

function conformanceFixture(
  systemCode: SystemCodeRecord,
  experiment: ExperimentRunRecord
): PaperTradingHandoffConformanceRecord {
  const record: PaperTradingHandoffConformanceRecord = {
    record_kind: "paper_trading_handoff_conformance",
    version: 1,
    paper_trading_handoff_conformance_id: "conformance-admitted",
    system_code_ref: ref("system_code", systemCode.system_code_id),
    system_code_artifact_digest: systemCode.artifact_digest,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    protocol_version: "paper_trading_event_protocol_v1",
    runner_kind: "host_process",
    status: "passed",
    reason: "passed",
    provider_request_count: 3,
    decision_event_kind: "order_request",
    heartbeat_count: 1,
    runtime_stopped: true,
    started_at: "2026-07-23T00:00:03.100Z",
    completed_at: "2026-07-23T00:00:04.000Z",
    evidence_digest: digest("pending"),
    research_preflight_authority: true,
    runnable_paper_handoff: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  record.evidence_digest = digest(paperTradingHandoffConformanceDigestInput(record));
  return record;
}

function systemCode(id: string, artifactDigest: string, createdAt: string): SystemCodeRecord {
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
      declared_output_kinds: ["order_request"]
    },
    secret_policy_ref: ref("secret_policy", "no-raw-secrets"),
    capability_policy_ref: ref("capability_policy", "research-only"),
    provenance_refs: [],
    status: "registered",
    created_at: createdAt,
    authority_status: "not_live"
  };
}

function standaloneFinding(
  suffix: string,
  createdAt: string
): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `finding-${suffix}`,
    research_worker_ref: ref("research_worker", `worker-${suffix}`),
    research_direction_ref: ref("research_direction", `direction-${suffix}`),
    experiment_run_ref: ref("experiment_run", `experiment-${suffix}`),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      `evaluation-${suffix}`
    ),
    finding_kind: "failure_analysis",
    summary: `Canonical standalone ${suffix} Finding.`,
    supporting_record_refs: [],
    created_at: createdAt,
    authority_status: "research_trace_only"
  };
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
    artifact_ref: ref("research_finding", finding.research_finding_id),
    source_digest: digest(
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
  record.artifact_digest = digest(researchEvidenceArtifactDigestInput(record));
  return record;
}

function ref(record_kind: string, id: string): { record_kind: string; id: string } {
  return { record_kind, id };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
