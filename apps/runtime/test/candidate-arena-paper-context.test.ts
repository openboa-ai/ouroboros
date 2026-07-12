import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCandidateArenaTick } from "@ouroboros/application/candidate/arena";
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
  Ref
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
    await expect(store.listTradingEvaluationResults()).resolves.toEqual([]);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([]);
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
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([
      expect.objectContaining({
        status: "duplicate",
        reason: "no_candidate_change",
        runnable_paper_handoff: false
      })
    ]);
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

  it("feeds rejected research into the next generation without rewarding rejection efficiency", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
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
          status: "passed",
          reason: "passed",
          runnable_paper_handoff: true
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
      artifactRunner: acceptedNegativeReplayArtifactRunner(),
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
          authority_status: "research_only"
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
    expect(candidate?.full_cycle_lineage?.evidence?.evaluation_status).toBe("accepted");
    const notebook = JSON.parse(await readFile(path.join(
      tmpDir,
      "candidate-arena-runs",
      `candidate-arena-${outcome.tick_id}-trend_following`,
      "notebook.json"
    ), "utf8")) as {
      entries: Array<{
        decision: string;
        evaluation: { profit_loss: unknown };
      }>;
    };
    expect(candidate?.full_cycle_lineage?.evidence?.profit_loss).toEqual(
      notebook.entries.find((entry) => entry.decision === "keep")?.evaluation.profit_loss
    );
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

  it("feeds latest paper trading evidence into the next researcher context even before replay leaderboard ranking", async () => {
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
      selected_paper_evidence: Array<{
        candidate_id: string;
        paper_trading_status?: string;
        paper_observation_count: number;
        paper_score?: { net_revenue_usdt: number };
        latest_market_snapshot?: { price: number; source_kind: string };
        latest_paper_decision?: {
          decision_kind: string;
          source_kind: string;
          reason: string;
          observed_at: string;
          authority_status: string;
        };
        latest_fill?: { source_trade_id?: string };
        authority_status: string;
      }>;
      paper_trading_board: Array<{
        rank: number;
        candidate_id: string;
        paper_runner_status: string;
        net_revenue_usdt: number;
        observation_count: number;
        qualification_status: string;
        qualification_reasons: string[];
        blocker_groups: Array<{
          group_kind: string;
          severity: string;
          blockers: string[];
          next_action: string;
        }>;
        trend: {
          direction: string;
          net_revenue_delta_usdt: number;
          net_return_delta_pct: number;
          observation_count_delta: number;
          authority_status: string;
        };
        blocker_density: {
          blocker_count: number;
          blocker_density: number;
          failed_observation_ratio: number;
          top_blocker?: string;
          authority_status: string;
        };
        promotion_gate_status?: string;
        authority_status: string;
      }>;
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
    };
    expect(context.selected_paper_evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidate_id: FIXTURE_CANDIDATE_ID,
        paper_trading_status: "running",
        paper_observation_count: 7,
        paper_score: expect.objectContaining({
          net_revenue_usdt: 12.34
        }),
        latest_market_snapshot: expect.objectContaining({
          price: 65_123,
          source_kind: "binance_production_public_hybrid"
        }),
        latest_paper_decision: {
          decision_kind: "hold",
          source_kind: "trading_system_decision",
          reason: "paper context seed preserved selected candidate evidence",
          observed_at: "2026-05-16T00:07:00.000Z",
          authority_status: "trace_only"
        },
        latest_fill: expect.objectContaining({
          source_trade_id: "paper-context-trade-0007"
        }),
        authority_status: "not_live"
      })
    ]));
    const releasedEvidence = context.selected_paper_evidence.find((entry) =>
      entry.candidate_id === FIXTURE_CANDIDATE_ID
    );
    expect(releasedEvidence).not.toHaveProperty("ledger_chain_complete");
    expect(releasedEvidence).not.toHaveProperty("latest_order_request_id");
    expect(releasedEvidence).not.toHaveProperty("latest_gateway_outcome");
    expect(releasedEvidence).not.toHaveProperty("latest_execution_status");
    expect(context.paper_trading_board).toEqual([
      expect.objectContaining({
        rank: 1,
        candidate_id: FIXTURE_CANDIDATE_ID,
        paper_runner_status: "unknown_at_tick_context",
        net_revenue_usdt: 12.34,
        observation_count: 7,
        qualification_status: "not_qualification_evidence",
        qualification_reasons: ["evidence_purpose_not_qualification"],
        blocker_groups: [
          expect.objectContaining({
            group_kind: "evidence_authority",
            severity: "blocked",
            blockers: ["evidence_purpose_not_qualification"],
            next_action:
              "Run a prospective qualification comparison; research-feedback evidence remains research-only."
          })
        ],
        trend: {
          direction: "improving",
          net_revenue_delta_usdt: 10.577143,
          net_return_delta_pct: 0.105771,
          observation_count_delta: 6,
          authority_status: "not_promotion_authority"
        },
        blocker_density: {
          blocker_count: 1,
          blocker_density: 0.142857,
          failed_observation_ratio: 0,
          top_blocker: "evidence_purpose_not_qualification",
          authority_status: "not_promotion_authority"
        },
        authority_status: "not_live"
      })
    ]);
    expect(context.paper_trading_board[0]).not.toHaveProperty("promotion_gate_status");
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
      selected_paper_evidence: Array<{ candidate_id: string }>;
      paper_trading_board: Array<{ candidate_id: string }>;
      finding_clusters: Array<{ candidate_ids: string[] }>;
      adaptive_direction_focus: unknown[];
    };
    expect(context.selected_paper_evidence.map((entry) => entry.candidate_id))
      .toContain(researchCandidate.candidate_id);
    expect(context.selected_paper_evidence.map((entry) => entry.candidate_id))
      .not.toContain(qualificationCandidate.candidate_id);
    expect(context.paper_trading_board.map((entry) => entry.candidate_id))
      .not.toContain(qualificationCandidate.candidate_id);
    expect(context.finding_clusters.flatMap((entry) => entry.candidate_ids))
      .not.toContain(qualificationCandidate.candidate_id);

    const paperResearchProjection = JSON.stringify({
      selected_paper_evidence: context.selected_paper_evidence,
      paper_trading_board: context.paper_trading_board,
      finding_clusters: context.finding_clusters,
      adaptive_direction_focus: context.adaptive_direction_focus
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
      selected_paper_evidence: Array<{ candidate_id: string }>;
      paper_trading_board: Array<{ candidate_id: string }>;
      finding_clusters: Array<{ candidate_ids: string[] }>;
      adaptive_direction_focus: unknown[];
    };
    const paperResearchProjection = JSON.stringify({
      selected_paper_evidence: context.selected_paper_evidence,
      paper_trading_board: context.paper_trading_board,
      finding_clusters: context.finding_clusters,
      adaptive_direction_focus: context.adaptive_direction_focus
    });
    expect(context.selected_paper_evidence.map((entry) => entry.candidate_id))
      .not.toContain(candidate.candidate_id);
    expect(context.paper_trading_board.map((entry) => entry.candidate_id))
      .not.toContain(candidate.candidate_id);
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
      selected_paper_evidence: unknown[];
      paper_trading_board: unknown[];
      finding_clusters: unknown[];
      adaptive_direction_focus: unknown[];
    };
    const paperResearchProjection = JSON.stringify({
      selected_paper_evidence: context.selected_paper_evidence,
      paper_trading_board: context.paper_trading_board,
      finding_clusters: context.finding_clusters,
      adaptive_direction_focus: context.adaptive_direction_focus
    });
    const tick = outcome.arena.latest_ticks.find((entry) => entry.tick_id === outcome.tick_id);
    expect(tick?.source_candidate?.source_kind).not.toBe("paper_trading_evaluation_leader");
    expect(tick?.source_candidate?.net_revenue_usdt).not.toBe(tamperedNetRevenue);
    expect(paperResearchProjection).not.toContain(String(tamperedNetRevenue));
    expect(paperResearchProjection).not.toContain("research-feedback-account-mismatch");
  });

  it("feeds paper observation cadence into the next researcher context without promotion authority", async () => {
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
    const context = JSON.parse(capturedContexts[0]!) as {
      selected_paper_evidence: Array<{
        candidate_id: string;
        paper_loop_latency?: {
          expected_interval_ms: number;
          latest_observation_interval_ms?: number;
          latest_interval_lag_ms?: number;
          max_interval_lag_ms?: number;
          observed_interval_count: number;
          cadence_status: string;
          authority_status: string;
        };
      }>;
    };
    expect(context.selected_paper_evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidate_id: FIXTURE_CANDIDATE_ID,
        paper_loop_latency: {
          expected_interval_ms: 60_000,
          latest_observation_interval_ms: 100_000,
          latest_interval_lag_ms: 40_000,
          max_interval_lag_ms: 40_000,
          observed_interval_count: 2,
          cadence_status: "lagging",
          authority_status: "not_promotion_authority"
        }
      })
    ]));
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
      selected_paper_evidence: Array<{
        candidate_id: string;
        lineage?: {
          lineage_status: string;
          direction_kind?: string;
          parent_candidate_id?: string;
          latest_finding?: string;
          evaluation_status?: string;
          authority_status: string;
        };
        paper_board_learning?: {
          rank: number;
          net_revenue_usdt: number;
          observation_count: number;
          qualification_status: string;
          summary: string;
          next_research_focus: string;
          authority_status: string;
        };
      }>;
    };
    expect(context.selected_paper_evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidate_id: createdCandidate.candidate_id,
        lineage: expect.objectContaining({
          lineage_status: "available",
          direction_kind: "trend_following",
          parent_candidate_id: FIXTURE_CANDIDATE_ID,
          latest_finding: "Candidate produced non-negative net revenue after costs.",
          evaluation_status: "accepted",
          authority_status: "lineage_only"
        }),
        paper_board_learning: expect.objectContaining({
          rank: 1,
          net_revenue_usdt: 12.34,
          observation_count: 7,
          qualification_status: "not_qualification_evidence",
          summary: "Paper board rank #1: 12.34 net_revenue_usdt, 0.1234 net_return_pct, 7 observations, not_qualification_evidence.",
          next_research_focus:
            "Preserve the profitable lineage and generate controlled variants under paper evidence.",
          authority_status: "lineage_only"
        })
      })
    ]));
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
      selected_paper_evidence: Array<{
        candidate_id: string;
        latest_paper_failure?: string;
        latest_paper_failure_classification?: {
          failure_kind: string;
          reason: string;
          summary: string;
          next_action: string;
          authority_status: string;
        };
        failed_observations: Array<{
          sequence: number;
          failure_reason?: string;
          failure?: {
            failure_kind: string;
            reason: string;
            summary: string;
            next_action: string;
            authority_status: string;
          };
        }>;
      }>;
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
        authority_status: string;
      }>;
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
        next_research_focus: "Inspect the latest paper failure and fix the runtime or protocol issue before review.",
        authority_status: "not_promotion_authority"
      }
    ]);
    expect(context.selected_paper_evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidate_id: createdCandidate.candidate_id,
        latest_paper_failure: "malformed TradingSystem paper event protocol: invalid order_request",
        latest_paper_failure_classification: {
          failure_kind: "trading_system_protocol_error",
          reason: "malformed TradingSystem paper event protocol: invalid order_request",
          summary: "TradingSystem emitted an invalid paper event or protocol shape.",
          next_action: "Fix the TradingSystem paper event protocol before retrying observation.",
          authority_status: "not_live"
        },
        failed_observations: [
          expect.objectContaining({
            sequence: 7,
            failure_reason: "malformed TradingSystem paper event protocol: invalid order_request",
            failure: {
              failure_kind: "trading_system_protocol_error",
              reason: "malformed TradingSystem paper event protocol: invalid order_request",
              summary: "TradingSystem emitted an invalid paper event or protocol shape.",
              next_action: "Fix the TradingSystem paper event protocol before retrying observation.",
              authority_status: "not_live"
            }
          })
        ]
      })
    ]));
    expect((second.arena as {
      finding_clusters?: typeof context.finding_clusters;
    }).finding_clusters).toEqual(context.finding_clusters);
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
        authority_status: string;
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
      next_research_focus: "Restore public execution evidence before trusting fills or paper score.",
      authority_status: "not_promotion_authority"
    });
  });

  it("persists research allocation before effects and bounds default concurrency", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const probe: AllocationExecutionProbe = {
      active: 0,
      maximumActive: 0,
      calls: [],
      visibleAllocationIds: []
    };

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
      findingClusters: [],
      latestTicks: []
    })).rejects.toMatchObject({
      code: "candidate_arena_research_allocation_request_conflict"
    });
    await expect(restartedService.allocate({
      tickId: "restart-allocation-tick",
      allocationMode: "static_control",
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
          authority_status: string;
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
      released_at: release.released_at,
      authority_status: "not_promotion_authority"
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
      next_research_focus: release.next_research_focus,
      authority_status: "not_promotion_authority"
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
        provider_request_total: number;
        runner_command_total: number;
        scenario_count: number;
        development: {
          submission_count: number;
          provider_request_total: number;
          scenario_count: number;
        };
        sealed_admission: {
          submission_count: number;
          provider_request_total: number;
          scenario_count: number;
        };
        authority_status: string;
      }>;
    };
    expect(context.latest_research_efficiency).toEqual([
      expect.objectContaining({
        tick_id: "efficiency-tick-1",
        direction_kind: "trend_following",
        provider_request_total: 6,
        runner_command_total: 0,
        scenario_count: 2,
        development: expect.objectContaining({
          submission_count: 1,
          provider_request_total: 6,
          scenario_count: 2
        }),
        sealed_admission: expect.objectContaining({
          submission_count: 1,
          provider_request_total: 21,
          scenario_count: 6
        }),
        authority_status: "not_promotion_authority"
      })
    ]);
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
        authority_status: string;
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
      next_research_focus: "Favor lower-cost ResearchDirection lanes while expensive lanes cool down.",
      authority_status: "not_promotion_authority"
    });
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

class CapturingResearchAgent implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-capturing-context",
    provider: "codex",
    model: "capturing-context",
    permission_policy: "artifact_workspace_only"
  };

  constructor(
    private readonly contexts: string[],
    private readonly beforeImprove?: () => void | Promise<void>
  ) {}

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    await this.beforeImprove?.();
    this.contexts.push(input.arena_context ?? "");
    const runPath = path.join(input.artifact_dir, "run.py");
    const source = await readFile(runPath, "utf8");
    await writeFile(
      runPath,
      `${source}\n# CandidateArena context captured for iteration ${input.iteration}.\n`,
      "utf8"
    );
    return {
      status: "edited",
      summary: "Captured arena context and versioned the candidate artifact.",
      changed_paths: ["run.py"]
    };
  }
}

type AllocationExecutionProbe = {
  active: number;
  maximumActive: number;
  calls: string[];
  visibleAllocationIds: Array<string | undefined>;
};

class AllocationProbeResearchAgent implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-allocation-probe",
    provider: "codex",
    model: "allocation-probe",
    permission_policy: "artifact_workspace_only"
  };

  constructor(
    private readonly store: LocalStore,
    private readonly probe: AllocationExecutionProbe
  ) {}

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const context = JSON.parse(input.arena_context ?? "{}") as {
      requested_direction?: string;
    };
    const direction = context.requested_direction ?? "missing";
    this.probe.active += 1;
    this.probe.maximumActive = Math.max(
      this.probe.maximumActive,
      this.probe.active
    );
    this.probe.calls.push(`${direction}:${input.iteration}`);
    this.probe.visibleAllocationIds.push(
      (await this.store.listCandidateArenaResearchAllocations())[0]
        ?.candidate_arena_research_allocation_id
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
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
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-failed-researcher",
    provider: "codex",
    model: "failed-researcher",
    permission_policy: "artifact_workspace_only"
  };

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
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-throwing-researcher",
    provider: "codex",
    model: "throwing-researcher",
    permission_policy: "artifact_workspace_only"
  };

  async improveArtifact(): Promise<AgentEditResult> {
    throw new Error("research worker process terminated");
  }
}

class NoChangeResearchAgent implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-no-change-researcher",
    provider: "codex",
    model: "no-change-researcher",
    permission_policy: "artifact_workspace_only"
  };

  async improveArtifact(): Promise<AgentEditResult> {
    return {
      status: "no_change",
      summary: "No candidate change was produced.",
      changed_paths: []
    };
  }
}

class MisreportedEditResearchAgent implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-misreported-edit-researcher",
    provider: "codex",
    model: "misreported-edit-researcher",
    permission_policy: "artifact_workspace_only"
  };

  async improveArtifact(): Promise<AgentEditResult> {
    return {
      status: "edited",
      summary: "Reported an edit without changing the submitted SystemCode.",
      changed_paths: ["run.py"]
    };
  }
}

class EscapingEntrypointResearchAgent implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-escaping-entrypoint",
    provider: "codex",
    model: "escaping-entrypoint",
    permission_policy: "artifact_workspace_only"
  };

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
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-missing-editable-paths",
    provider: "codex",
    model: "missing-editable-paths",
    permission_policy: "artifact_workspace_only"
  };

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
      : {
          revenue_usdt: roundPaperContextValue(
            latestScore.revenue_usdt * sequence / observationCount
          ),
          cost_usdt: roundPaperContextValue(
            latestScore.cost_usdt * sequence / observationCount
          ),
          net_revenue_usdt: roundPaperContextValue(
            latestScore.net_revenue_usdt * sequence / observationCount
          ),
          net_return_pct: roundPaperContextValue(
            latestScore.net_return_pct * sequence / observationCount
          )
        });
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

function networklessReplayArtifactRunner(): TradingArtifactRunner {
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
          : Number((account.equity * Math.min(0.02, account.max_risk_fraction) / market.price).toFixed(8)),
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
