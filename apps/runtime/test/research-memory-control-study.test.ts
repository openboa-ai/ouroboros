import { createHash } from "node:crypto";
import {
  cp,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  runCandidateArenaTick,
  type CandidateArenaTickOutcome,
  type RunCandidateArenaTickInput
} from "@ouroboros/application/candidate/arena";
import type {
  AgentEditInput,
  AgentEditResult,
  ManagedResearchAgent,
  TradingResearchAgentAdapter
} from "@ouroboros/application/trading/research/types";
import {
  createTradingResearchAgentAdapter,
  loadTradingResearchRuntimeConfig
} from "@ouroboros/application/trading/research/runtime-config";
import type { ResearchDirectionKind } from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import {
  networklessResearchPreflightArtifactRunner,
  networklessResearchPreflightProvider
} from "./helpers/research-control-study-prospective";
import {
  prepareResearchMemoryControlStudy,
  researchMemoryControlStudyWorkspacePaths,
  runResearchMemoryControlStudy,
  type RunResearchMemoryControlStudyInput
} from "../src/candidate/arena/research-memory-control-study";

const RESEARCH_AGENT: ManagedResearchAgent & { model: string } = {
  id: "managed-agent-memory-sensitive",
  provider: "codex",
  model: "memory-sensitive-v1",
  permission_policy: "artifact_workspace_only"
};

const DIRECTIONS: ResearchDirectionKind[] = [
  "trend_following",
  "mean_reversion",
  "trend_following",
  "mean_reversion",
  "trend_following",
  "mean_reversion"
];
const RAW_PROVIDER_OUTPUT_SENTINEL =
  "raw-provider-output-must-not-persist-7f14e4d3";

let temporaryRoot: string;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "ouroboros-memory-control-runtime-")
  );
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe("ResearchMemoryControlStudy runtime", () => {
  it("runs six fresh paired ticks and derives a supported external outcome", async () => {
    const coordinator = new LocalStore(path.join(temporaryRoot, "coordinator"));
    await coordinator.initialize();
    const workspaceRoot = path.join(temporaryRoot, "workspace");
    const probe = memorySensitiveProbe();
    const before = await coordinatorPopulation(coordinator);

    const result = await runResearchMemoryControlStudy({
      store: coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-supported-001",
      sourceCandidateId: FIXTURE_CANDIDATE_ID,
      directions: DIRECTIONS,
      researchAgent: "codex",
      researchAgentIdentity: RESEARCH_AGENT,
      agentFactory: () => new MemorySensitiveResearchAgent(probe),
      artifactRunner: networklessResearchPreflightArtifactRunner(),
      replayProviderFactory: networklessResearchPreflightProvider,
      now: monotonicClock("2026-07-13T00:00:00.000Z")
    });

    expect(result.pairOutcomes).toHaveLength(6);
    expect(result.pairOutcomes.map((pair) => ({
      eligibility_status: pair.eligibility_status,
      ineligibility_reason: pair.ineligibility_reason,
      released_observation: pair.released_memory.observation,
      released_reason: pair.released_memory.ineligibility_reason,
      masked_observation: pair.memory_masked.observation,
      masked_reason: pair.memory_masked.ineligibility_reason
    }))).toEqual(Array.from({ length: 6 }, () => ({
      eligibility_status: "eligible",
      ineligibility_reason: null,
      released_observation: "distinct_behavior",
      released_reason: null,
      masked_observation: "exact_repeat",
      masked_reason: null
    })));
    expect(result.pairOutcomes.map((pair) => pair.paired_difference)).toEqual(
      [1, 1, 1, 1, 1, 1]
    );
    expect(result.outcome).toMatchObject({
      inference_status: "memory_effect_supported",
      favorable_pair_count: 6,
      unfavorable_pair_count: 0,
      tied_pair_count: 0,
      exact_sign_test_p_value: 0.03125,
      mean_paired_difference: 1,
      evaluation_authority: "external_to_trading_systems",
      memory_policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
    expect(probe.callCount).toBe(12);
    expect(probe.maximumActive).toBe(2);
    expect(probe.calls.filter((call) => call.sawReleasedMemory)).toHaveLength(6);
    expect(probe.calls.filter((call) => !call.sawReleasedMemory)).toHaveLength(6);
    expect(await coordinatorPopulation(coordinator)).toEqual(before);
    await expect(coordinator.listResearchMemoryControlStudies()).resolves.toEqual([
      result.study
    ]);
    await expect(
      coordinator.listResearchMemoryControlPairOutcomes(
        result.study.research_memory_control_study_id
      )
    ).resolves.toEqual(result.pairOutcomes);
    await expect(coordinator.listResearchMemoryControlStudyOutcomes()).resolves
      .toEqual([result.outcome]);

    const paths = researchMemoryControlStudyWorkspacePaths({
      workspaceRoot,
      studyId: result.study.research_memory_control_study_id,
      sourceRoot: coordinator.root(),
      pairCount: 6
    });
    expect(paths.pairRoots.flatMap((roots) => [
      path.basename(roots.releasedMemory),
      path.basename(roots.memoryMasked)
    ]).every((name) => /^side-[ab]$/.test(name))).toBe(true);
    expect(paths.pairRoots.map((roots) =>
      path.basename(roots.releasedMemory) === "side-a"
    ).filter(Boolean)).toHaveLength(3);
    const treatmentStarts: number[] = [];
    const controlStarts: number[] = [];
    for (let index = 0; index < paths.pairRoots.length; index += 1) {
      const pairPlan = result.study.pair_plans[index]!;
      const treatment = new LocalStore(paths.pairRoots[index]!.releasedMemory);
      const control = new LocalStore(paths.pairRoots[index]!.memoryMasked);
      const treatmentTicks = await treatment.listCandidateArenaTicks();
      const controlTicks = await control.listCandidateArenaTicks();
      expect(treatmentTicks.map((tick) => tick.tick_id)).toEqual([
        pairPlan.released_memory_treatment.tick_id
      ]);
      expect(controlTicks.map((tick) => tick.tick_id)).toEqual([
        pairPlan.memory_masked_control.tick_id
      ]);
      treatmentStarts.push(Date.parse(treatmentTicks[0]!.started_at));
      controlStarts.push(Date.parse(controlTicks[0]!.started_at));

      const treatmentStudy = await treatment.getResearchMemoryControlStudy(
        result.study.research_memory_control_study_id
      );
      const controlStudy = await control.getResearchMemoryControlStudy(
        result.study.research_memory_control_study_id
      );
      expect(treatmentStudy).toEqual(result.study);
      expect(controlStudy).toEqual(result.study);

      const treatmentPreflight = exactPreflight(
        await treatment.listResearchPreflightCommitments(),
        pairPlan.released_memory_treatment.tick_id
      );
      const controlPreflight = exactPreflight(
        await control.listResearchPreflightCommitments(),
        pairPlan.memory_masked_control.tick_id
      );
      expect(treatmentPreflight.memory_policy).toMatchObject({
        memory_mode: "released_memory",
        control_assignment: {
          study_ref: {
            record_kind: "research_memory_control_study",
            id: result.study.research_memory_control_study_id
          },
          study_digest: result.study.study_digest,
          pair_index: index + 1,
          arm_kind: "released_memory_treatment"
        }
      });
      expect(controlPreflight.memory_policy).toMatchObject({
        memory_mode: "memory_masked",
        control_assignment: {
          study_ref: {
            record_kind: "research_memory_control_study",
            id: result.study.research_memory_control_study_id
          },
          study_digest: result.study.study_digest,
          pair_index: index + 1,
          arm_kind: "memory_masked_control"
        }
      });
      expect(treatmentPreflight.memory_policy?.memory_source_digest).toBe(
        controlPreflight.memory_policy?.memory_source_digest
      );
      expect(treatmentPreflight.memory_policy?.available_memory_item_count).toBe(
        controlPreflight.memory_policy?.available_memory_item_count
      );
      expect(
        treatmentPreflight.memory_policy?.available_memory_item_count
      ).toBeGreaterThan(0);
      expect(treatmentPreflight.memory_policy?.arena_context_digest).not.toBe(
        controlPreflight.memory_policy?.arena_context_digest
      );
      expect(preflightOpportunity(treatmentPreflight)).toEqual(
        result.study.opportunity_protocol
      );
      expect(preflightOpportunity(controlPreflight)).toEqual(
        result.study.opportunity_protocol
      );
      expect(await treatment.listResearchWorkerCheckpoints()).toHaveLength(1);
      expect(await control.listResearchWorkerCheckpoints()).toHaveLength(1);
    }
    expect(treatmentStarts.every((started, index) =>
      Math.abs(started - controlStarts[index]!) <= 5_000
    )).toBe(true);
    expect(treatmentStarts.filter((started, index) =>
      started < controlStarts[index]!
    )).toHaveLength(3);
    expect(treatmentStarts.slice(1).every((started, index) =>
      started > Math.max(treatmentStarts[index]!, controlStarts[index]!)
    )).toBe(true);
    await expect(treeContains(
      coordinator.root(),
      RAW_PROVIDER_OUTPUT_SENTINEL
    )).resolves.toBe(false);
    await expect(treeContains(
      paths.studyRoot,
      RAW_PROVIDER_OUTPUT_SENTINEL
    )).resolves.toBe(false);
  });

  it("replays a terminal study without another provider effect", async () => {
    const coordinator = await initializedStore("coordinator-replay");
    const workspaceRoot = path.join(temporaryRoot, "workspace-replay");
    const firstProbe = memorySensitiveProbe();
    const first = await runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-replay-001",
      probe: firstProbe
    }));
    const replayProbe = memorySensitiveProbe();

    const replay = await runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-replay-001",
      probe: replayProbe
    }));

    expect(replay).toEqual(first);
    expect(replayProbe.callCount).toBe(0);
  });

  it("reconstructs a missing pair outcome from two complete arm ticks", async () => {
    const coordinator = await initializedStore("coordinator-reconstruct");
    const workspaceRoot = path.join(temporaryRoot, "workspace-reconstruct");
    const firstProbe = memorySensitiveProbe();
    const restorePairWrite = failPairOutcomeWrite(coordinator);

    await expect(runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-reconstruct-001",
      probe: firstProbe
    }))).rejects.toThrow("synthetic_pair_outcome_write_failure");
    restorePairWrite();
    expect(firstProbe.callCount).toBe(2);

    const resumeProbe = memorySensitiveProbe();
    const resumed = await runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-reconstruct-001",
      probe: resumeProbe
    }));

    expect(resumeProbe.callCount).toBe(10);
    expect(resumed.pairOutcomes).toHaveLength(6);
    expect(resumed.pairOutcomes[0]).toMatchObject({
      pair_index: 1,
      eligibility_status: "eligible",
      paired_difference: 1
    });
    expect(resumed.outcome.inference_status).toBe("memory_effect_supported");
  });

  it("does not rerun a missing arm after one side completed", async () => {
    const coordinator = await initializedStore("coordinator-partial");
    const workspaceRoot = path.join(temporaryRoot, "workspace-partial");
    const firstProbe = memorySensitiveProbe();
    const restorePairWrite = failPairOutcomeWrite(coordinator);
    const partialRunTick = async (
      tickInput: RunCandidateArenaTickInput
    ): Promise<CandidateArenaTickOutcome> => {
      if (tickInput.researchMemoryControlAssignment?.pair_index === 1 &&
        tickInput.researchMemoryControlAssignment.arm_kind ===
          "memory_masked_control") {
        throw new Error("synthetic_missing_arm_interruption");
      }
      return runCandidateArenaTick(tickInput);
    };

    await expect(runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-partial-001",
      probe: firstProbe,
      runTick: partialRunTick
    }))).rejects.toThrow("synthetic_pair_outcome_write_failure");
    restorePairWrite();
    expect(firstProbe.callCount).toBe(1);

    let resumedTickCalls = 0;
    const resumed = await runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-partial-001",
      probe: memorySensitiveProbe(),
      runTick: async (tickInput) => {
        resumedTickCalls += 1;
        return runCandidateArenaTick(tickInput);
      }
    }));

    expect(resumedTickCalls).toBe(10);
    expect(resumed.pairOutcomes[0]).toMatchObject({
      eligibility_status: "ineligible",
      ineligibility_reason: "interrupted_or_unpaired_run",
      paired_difference: null
    });
    expect(resumed.outcome).toMatchObject({
      completed_pair_count: 6,
      eligible_pair_count: 5,
      ineligible_pair_count: 1,
      inference_status: "insufficient_memory_control_evidence"
    });
    const paths = researchMemoryControlStudyWorkspacePaths({
      workspaceRoot,
      studyId: resumed.study.research_memory_control_study_id,
      sourceRoot: coordinator.root(),
      pairCount: 6
    });
    await expect(new LocalStore(
      paths.pairRoots[0]!.memoryMasked
    ).listCandidateArenaTicks()).resolves.toEqual([]);
  });

  it("records provider failure and continues later precommitted pairs", async () => {
    const coordinator = await initializedStore("coordinator-provider-failure");
    const probe = memorySensitiveProbe();
    const result = await runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot: path.join(temporaryRoot, "workspace-provider-failure"),
      idempotencyKey: "memory-control-runtime-provider-failure-001",
      probe,
      runTick: async (tickInput) => {
        if (tickInput.researchMemoryControlAssignment?.pair_index === 1) {
          throw new Error("synthetic_provider_failure");
        }
        return runCandidateArenaTick(tickInput);
      }
    }));

    expect(result.pairOutcomes[0]).toMatchObject({
      eligibility_status: "ineligible",
      ineligibility_reason: "worker_or_platform_failure",
      paired_difference: null,
      released_memory: {
        terminal_status: "platform_failed",
        failure_kind: "provider_failed",
        resource_summary: {
          provider_request_total: 0,
          runner_command_total: 0,
          scenario_count: 0,
          elapsed_ms: 0
        }
      },
      memory_masked: {
        terminal_status: "platform_failed",
        failure_kind: "provider_failed"
      }
    });
    expect(result.pairOutcomes.slice(1).map(
      (pair) => pair.paired_difference
    )).toEqual([1, 1, 1, 1, 1]);
    expect(probe.callCount).toBe(10);
    expect(result.outcome).toMatchObject({
      completed_pair_count: 6,
      eligible_pair_count: 5,
      ineligible_pair_count: 1,
      inference_status: "insufficient_memory_control_evidence"
    });
  });

  it("recovers an orphan preflight checkpoint without rerunning that pair", async () => {
    const coordinator = await initializedStore("coordinator-orphan-preflight");
    const workspaceRoot = path.join(
      temporaryRoot,
      "workspace-orphan-preflight"
    );
    const firstProbe = memorySensitiveProbe();
    const restorePairWrite = failPairOutcomeWrite(coordinator);

    await expect(runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-orphan-preflight-001",
      probe: firstProbe,
      runTick: async (tickInput) => {
        if (tickInput.researchMemoryControlAssignment?.pair_index !== 1 ||
          tickInput.researchMemoryControlAssignment.arm_kind !==
            "released_memory_treatment") {
          return runCandidateArenaTick(tickInput);
        }
        const store = tickInput.store as LocalStore;
        const recordAdmission =
          store.recordCandidateAdmissionDecision.bind(store);
        const recordCheckpoint =
          store.recordResearchWorkerCheckpoint.bind(store);
        const recordTick = store.recordCandidateArenaTick.bind(store);
        store.recordCandidateAdmissionDecision = async () => {
          throw new Error("synthetic_admission_publication_failure");
        };
        store.recordResearchWorkerCheckpoint = async () => {
          throw new Error("synthetic_checkpoint_publication_failure");
        };
        store.recordCandidateArenaTick = async () => {
          throw new Error("synthetic_tick_publication_failure");
        };
        try {
          return await runCandidateArenaTick(tickInput);
        } finally {
          store.recordCandidateAdmissionDecision = recordAdmission;
          store.recordResearchWorkerCheckpoint = recordCheckpoint;
          store.recordCandidateArenaTick = recordTick;
        }
      }
    }))).rejects.toThrow("synthetic_pair_outcome_write_failure");
    restorePairWrite();

    let resumedTickCalls = 0;
    const resumed = await runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-orphan-preflight-001",
      probe: memorySensitiveProbe(),
      runTick: async (tickInput) => {
        resumedTickCalls += 1;
        return runCandidateArenaTick(tickInput);
      }
    }));

    expect(resumedTickCalls).toBe(10);
    expect(resumed.pairOutcomes[0]).toMatchObject({
      eligibility_status: "ineligible",
      ineligibility_reason: "interrupted_or_unpaired_run"
    });
    const paths = researchMemoryControlStudyWorkspacePaths({
      workspaceRoot,
      studyId: resumed.study.research_memory_control_study_id,
      sourceRoot: coordinator.root(),
      pairCount: 6
    });
    const treatment = new LocalStore(paths.pairRoots[0]!.releasedMemory);
    await expect(treatment.listCandidateArenaTicks()).resolves.toEqual([]);
    await expect(treatment.listResearchWorkerCheckpoints()).resolves.toEqual([
      expect.objectContaining({
        candidate_arena_tick_id:
          resumed.study.pair_plans[0]!.released_memory_treatment.tick_id,
        terminal_status: "failed_closed",
        terminal_reason: "restart_recovery"
      })
    ]);
    const sourceGraphs = await persistedPairSourceGraphs(coordinator);
    expect(sourceGraphs.find((record) =>
      record.source_graph.pairIndex === 1
    )?.source_graph.releasedMemory.checkpoint).toEqual(
      expect.objectContaining({ terminal_reason: "restart_recovery" })
    );
  });

  it("fails closed when the coordinator baseline mutates after preparation", async () => {
    const coordinator = await initializedStore("coordinator-baseline-drift");
    const workspaceRoot = path.join(temporaryRoot, "workspace-baseline-drift");
    const input = runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-baseline-drift-001",
      probe: memorySensitiveProbe()
    });
    await prepareResearchMemoryControlStudy(input);
    await writeFile(
      path.join(coordinator.root(), "synthetic-baseline-drift.json"),
      "{}\n",
      "utf8"
    );

    await expect(runResearchMemoryControlStudy(input)).rejects.toMatchObject({
      code: "research_experiment_baseline_digest_mismatch"
    });
  });

  it("fails closed when a study-only arm root mutates before resume", async () => {
    const coordinator = await initializedStore("coordinator-arm-drift");
    const workspaceRoot = path.join(temporaryRoot, "workspace-arm-drift");
    const firstInput = runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-arm-drift-001",
      probe: memorySensitiveProbe(),
      runTick: async () => {
        throw new Error("synthetic_pre_effect_interruption");
      }
    });
    const restorePairWrite = failPairOutcomeWrite(coordinator);
    await expect(runResearchMemoryControlStudy(firstInput)).rejects.toThrow(
      "synthetic_pair_outcome_write_failure"
    );
    restorePairWrite();
    const [study] = await coordinator.listResearchMemoryControlStudies();
    const paths = researchMemoryControlStudyWorkspacePaths({
      workspaceRoot,
      studyId: study!.research_memory_control_study_id,
      sourceRoot: coordinator.root(),
      pairCount: 6
    });
    await writeFile(
      path.join(paths.pairRoots[0]!.releasedMemory, "synthetic-arm-drift.json"),
      "{}\n",
      "utf8"
    );

    await expect(runResearchMemoryControlStudy(runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-arm-drift-001",
      probe: memorySensitiveProbe()
    }))).rejects.toMatchObject({
      code: "research_experiment_baseline_digest_mismatch"
    });
  });

  it("rejects an unowned pre-existing pair root", async () => {
    const coordinator = await initializedStore("coordinator-root-collision");
    const workspaceRoot = path.join(temporaryRoot, "workspace-root-collision");
    const input = runtimeInput({
      coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-root-collision-001",
      probe: memorySensitiveProbe()
    });
    const study = await prepareResearchMemoryControlStudy(input);
    const paths = researchMemoryControlStudyWorkspacePaths({
      workspaceRoot,
      studyId: study.research_memory_control_study_id,
      sourceRoot: coordinator.root(),
      pairCount: 6
    });
    await mkdir(path.dirname(paths.pairRoots[0]!.releasedMemory), {
      recursive: true
    });
    await cp(paths.baselineRoot, paths.pairRoots[0]!.releasedMemory, {
      recursive: true
    });

    await expect(runResearchMemoryControlStudy(input)).rejects.toMatchObject({
      code: "research_memory_control_study_workspace_conflict"
    });
  });

  it("rejects a workspace symlink that resolves inside the source store", async () => {
    const coordinator = await initializedStore("coordinator-workspace-alias");
    const alias = path.join(temporaryRoot, "workspace-source-alias");
    await symlink(coordinator.root(), alias, "dir");
    const input = runtimeInput({
      coordinator,
      workspaceRoot: path.join(alias, "nested-study-workspace"),
      idempotencyKey: "memory-control-runtime-workspace-alias-001",
      probe: memorySensitiveProbe()
    });

    await expect(prepareResearchMemoryControlStudy(input)).rejects
      .toMatchObject({
        code: "research_memory_control_study_workspace_overlaps_source"
      });
  });

  it("closes both Codex adapter tool endpoints in a local process probe", async () => {
    const coordinator = await initializedStore("coordinator-local-codex-probe");
    const workspaceRoot = path.join(temporaryRoot, "workspace-local-codex-probe");
    const commandPath = path.join(temporaryRoot, "local-codex-provider.sh");
    const endpointLog = path.join(temporaryRoot, "local-codex-endpoints.log");
    await writeFile(commandPath, [
      "#!/bin/sh",
      "printf '%s|%s\\n' \"$OUROBOROS_RESEARCH_TOOL_SOCKET_PATH\" \"$OUROBOROS_RESEARCH_TOOL_CLIENT\" >> \"$OUROBOROS_TEST_PROVIDER_ENDPOINT_LOG\"",
      "exit 0",
      ""
    ].join("\n"), "utf8");
    await chmod(commandPath, 0o700);
    const loaded = loadTradingResearchRuntimeConfig(process.env);
    const config = {
      ...loaded,
      codex: {
        ...loaded.codex,
        command: commandPath,
        timeout_ms: 5_000,
        reasoning_effort: "low" as const
      }
    };
    const adapterEnv = {
      ...process.env,
      OUROBOROS_TEST_PROVIDER_ENDPOINT_LOG: endpointLog
    };
    const identityAdapter = createTradingResearchAgentAdapter(
      config,
      "codex",
      { env: adapterEnv }
    );
    const identity: ManagedResearchAgent & { model: string } = {
      ...identityAdapter.agent,
      model: identityAdapter.agent.model ?? identityAdapter.agent.provider
    };
    let adapterCount = 0;

    const result = await runResearchMemoryControlStudy({
      store: coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-local-codex-probe-001",
      sourceCandidateId: FIXTURE_CANDIDATE_ID,
      directions: DIRECTIONS,
      researchAgent: "codex",
      researchAgentIdentity: identity,
      agentFactory: () => {
        adapterCount += 1;
        return createTradingResearchAgentAdapter(config, "codex", {
          env: adapterEnv
        });
      },
      artifactRunner: networklessResearchPreflightArtifactRunner(),
      replayProviderFactory: networklessResearchPreflightProvider,
      now: monotonicClock("2026-07-13T00:00:00.000Z"),
      runTick: async (tickInput) => {
        if (tickInput.researchMemoryControlAssignment?.pair_index !== 1) {
          throw new Error("bounded_local_probe_pair_not_run");
        }
        return runCandidateArenaTick(tickInput);
      }
    });

    expect(adapterCount).toBe(2);
    expect(result.pairOutcomes[0]).toMatchObject({
      eligibility_status: "ineligible",
      ineligibility_reason: "no_submission",
      released_memory: { terminal_status: "no_submission" },
      memory_masked: { terminal_status: "no_submission" }
    });
    expect(result.outcome.inference_status).toBe(
      "insufficient_memory_control_evidence"
    );
    const endpointLines = (await readFile(endpointLog, "utf8"))
      .trim().split("\n");
    expect(endpointLines).toHaveLength(2);
    for (const line of endpointLines) {
      const [socketPath, clientPath] = line.split("|");
      expect(socketPath).toBeTruthy();
      expect(clientPath).toBeTruthy();
      await expect(pathExistsForTest(socketPath!)).resolves.toBe(false);
      await expect(pathExistsForTest(clientPath!)).resolves.toBe(false);
    }
  });

  it.runIf(
    process.env.OUROBOROS_RUN_REAL_CODEX_MEMORY_CONTROL_PROBE === "1"
  )("runs one bounded non-inferential pair through the installed Codex CLI", async () => {
    const coordinator = await initializedStore("coordinator-real-codex-probe");
    const workspaceRoot = path.join(temporaryRoot, "workspace-real-codex-probe");
    const config = loadTradingResearchRuntimeConfig(process.env);
    const identityAdapter = createTradingResearchAgentAdapter(config, "codex");
    const identity: ManagedResearchAgent & { model: string } = {
      ...identityAdapter.agent,
      model: identityAdapter.agent.model ?? identityAdapter.agent.provider
    };
    const before = await coordinatorPopulation(coordinator);
    let adapterCount = 0;

    const result = await runResearchMemoryControlStudy({
      store: coordinator,
      workspaceRoot,
      idempotencyKey: "memory-control-runtime-real-codex-probe-001",
      sourceCandidateId: FIXTURE_CANDIDATE_ID,
      directions: DIRECTIONS,
      researchAgent: "codex",
      researchAgentIdentity: identity,
      agentFactory: () => {
        adapterCount += 1;
        return createTradingResearchAgentAdapter(config, "codex");
      },
      artifactRunner: networklessResearchPreflightArtifactRunner(),
      replayProviderFactory: networklessResearchPreflightProvider,
      now: monotonicClock("2026-07-13T00:00:00.000Z"),
      runTick: async (tickInput) => {
        if (tickInput.researchMemoryControlAssignment?.pair_index !== 1) {
          throw new Error("bounded_noninferential_pair_not_run");
        }
        return runCandidateArenaTick(tickInput);
      }
    });

    expect(adapterCount).toBe(2);
    expect(result.pairOutcomes).toHaveLength(6);
    expect(result.pairOutcomes[0]!.eligibility_status).toMatch(
      /eligible|ineligible/
    );
    expect(result.pairOutcomes.slice(1).every((pair) =>
      pair.ineligibility_reason === "worker_or_platform_failure"
    )).toBe(true);
    expect(result.outcome).toMatchObject({
      inference_status: "insufficient_memory_control_evidence",
      memory_policy_decision_eligibility: "not_eligible"
    });
    expect(await coordinatorPopulation(coordinator)).toEqual(before);

    const paths = researchMemoryControlStudyWorkspacePaths({
      workspaceRoot,
      studyId: result.study.research_memory_control_study_id,
      sourceRoot: coordinator.root(),
      pairCount: 6
    });
    const treatment = new LocalStore(paths.pairRoots[0]!.releasedMemory);
    const masked = new LocalStore(paths.pairRoots[0]!.memoryMasked);
    const treatmentPreflight = exactPreflight(
      await treatment.listResearchPreflightCommitments(),
      result.study.pair_plans[0]!.released_memory_treatment.tick_id
    );
    const maskedPreflight = exactPreflight(
      await masked.listResearchPreflightCommitments(),
      result.study.pair_plans[0]!.memory_masked_control.tick_id
    );
    expect(treatmentPreflight.memory_policy?.memory_mode).toBe(
      "released_memory"
    );
    expect(maskedPreflight.memory_policy?.memory_mode).toBe("memory_masked");
    expect(preflightOpportunity(treatmentPreflight)).toEqual(
      preflightOpportunity(maskedPreflight)
    );
    await expect(treatment.listResearchWorkerCheckpoints()).resolves
      .toHaveLength(1);
    await expect(masked.listResearchWorkerCheckpoints()).resolves
      .toHaveLength(1);
    const sourceGraphs = await persistedPairSourceGraphs(coordinator);
    expect(sourceGraphs.find((record) =>
      record.source_graph.pairIndex === 1
    )?.source_graph.releasedMemory.checkpoint).toBeDefined();
  }, 300_000);
});

type MemorySensitiveCall = {
  sawReleasedMemory: boolean;
  contextDigest: string;
};

type MemorySensitiveProbe = {
  active: number;
  maximumActive: number;
  callCount: number;
  calls: MemorySensitiveCall[];
};

function memorySensitiveProbe(): MemorySensitiveProbe {
  return { active: 0, maximumActive: 0, callCount: 0, calls: [] };
}

async function initializedStore(name: string): Promise<LocalStore> {
  const store = new LocalStore(path.join(temporaryRoot, name));
  await store.initialize();
  return store;
}

function runtimeInput(input: {
  coordinator: LocalStore;
  workspaceRoot: string;
  idempotencyKey: string;
  probe: MemorySensitiveProbe;
  runTick?: (
    input: RunCandidateArenaTickInput
  ) => Promise<CandidateArenaTickOutcome>;
}): RunResearchMemoryControlStudyInput {
  return {
    store: input.coordinator,
    workspaceRoot: input.workspaceRoot,
    idempotencyKey: input.idempotencyKey,
    sourceCandidateId: FIXTURE_CANDIDATE_ID,
    directions: DIRECTIONS,
    researchAgent: "codex",
    researchAgentIdentity: RESEARCH_AGENT,
    agentFactory: () => new MemorySensitiveResearchAgent(input.probe),
    artifactRunner: networklessResearchPreflightArtifactRunner(),
    replayProviderFactory: networklessResearchPreflightProvider,
    now: monotonicClock("2026-07-13T00:00:00.000Z"),
    ...(input.runTick ? { runTick: input.runTick } : {})
  };
}

function failPairOutcomeWrite(store: LocalStore): () => void {
  const original = store.recordResearchMemoryControlPairOutcome.bind(store);
  store.recordResearchMemoryControlPairOutcome = async () => {
    throw new Error("synthetic_pair_outcome_write_failure");
  };
  return () => {
    store.recordResearchMemoryControlPairOutcome = original;
  };
}

async function persistedPairSourceGraphs(store: LocalStore): Promise<Array<{
  source_graph: {
    pairIndex: number;
    releasedMemory: {
      checkpoint?: { terminal_reason: string };
    };
  };
}>> {
  const directory = path.join(
    store.root(),
    "research-memory-control-pair-outcomes",
    "source-graphs"
  );
  const names = await readdir(directory);
  return Promise.all(names.sort().map(async (name) => JSON.parse(
    await readFile(path.join(directory, name), "utf8")
  )));
}

class MemorySensitiveResearchAgent implements TradingResearchAgentAdapter {
  readonly agent = RESEARCH_AGENT;

  constructor(private readonly probe: MemorySensitiveProbe) {}

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const context = JSON.parse(input.arena_context ?? "{}") as Record<string, unknown>;
    const sawReleasedMemory = Object.hasOwn(context, "leaderboard") ||
      Object.hasOwn(context, "latest_findings") ||
      Object.hasOwn(context, "research_population_diversity");
    this.probe.callCount += 1;
    this.probe.active += 1;
    this.probe.maximumActive = Math.max(
      this.probe.maximumActive,
      this.probe.active
    );
    this.probe.calls.push({
      sawReleasedMemory,
      contextDigest: `sha256:${createHash("sha256")
        .update(input.arena_context ?? "")
        .digest("hex")}`
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (sawReleasedMemory) {
        const runPath = path.join(input.artifact_dir, "run.py");
        const source = await readFile(runPath, "utf8");
        await writeFile(
          runPath,
          source.replace(/RISK_FRACTION = [0-9.]+/, "RISK_FRACTION = 0.007"),
          "utf8"
        );
      }
      return {
        status: "edited",
        summary: sawReleasedMemory
          ? "Used released aggregate memory to produce distinct behavior."
          : "Repeated the frozen baseline without cross-generation memory.",
        changed_paths: ["run.py"],
        command: ["synthetic-provider", "bounded-command-metadata"],
        stdout: RAW_PROVIDER_OUTPUT_SENTINEL,
        stderr: RAW_PROVIDER_OUTPUT_SENTINEL
      };
    } finally {
      this.probe.active -= 1;
    }
  }
}

function monotonicClock(start: string): () => string {
  let current = Date.parse(start);
  return () => new Date(current++).toISOString();
}

async function coordinatorPopulation(store: LocalStore): Promise<unknown> {
  const [candidates, ticks, allocations, admissions, fingerprints] =
    await Promise.all([
      store.listCandidates(),
      store.listCandidateArenaTicks(),
      store.listCandidateArenaResearchAllocations(),
      store.listCandidateAdmissionDecisions(),
      store.listResearchBehaviorFingerprints()
    ]);
  return { candidates, ticks, allocations, admissions, fingerprints };
}

function exactPreflight<T extends {
  candidate_arena_tick_id: string;
}>(preflights: T[], tickId: string): T {
  const matches = preflights.filter(
    (preflight) => preflight.candidate_arena_tick_id === tickId
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function preflightOpportunity(preflight: {
  development_policy: {
    suite_version: "research_development_replay_v1";
    suite_digest: string;
  };
  sealed_admission_policy: {
    suite_version: "research_sealed_admission_v1";
    generator_version: "research_scenario_generator_v1";
    rotation_commitment_digest: string;
    suite_digest: string;
  };
}) {
  return {
    development_suite_version: preflight.development_policy.suite_version,
    development_suite_digest: preflight.development_policy.suite_digest,
    sealed_suite_version: preflight.sealed_admission_policy.suite_version,
    sealed_generator_version: preflight.sealed_admission_policy.generator_version,
    sealed_rotation_commitment_digest:
      preflight.sealed_admission_policy.rotation_commitment_digest,
    sealed_suite_digest: preflight.sealed_admission_policy.suite_digest
  };
}

async function treeContains(root: string, needle: string): Promise<boolean> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (await treeContains(entryPath, needle)) return true;
    } else if (entry.isFile() && (await readFile(entryPath)).includes(needle)) {
      return true;
    }
  }
  return false;
}

async function pathExistsForTest(candidate: string): Promise<boolean> {
  return Boolean(await stat(candidate).catch(() => undefined));
}
