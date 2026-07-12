import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CodexTradingResearchAgentAdapter,
  FixtureTradingResearchAgentAdapter,
  NoopTradingResearchAgentAdapter
} from "@ouroboros/application/trading/research/agent-adapters";
import {
  DockerSandboxesSbxTradingArtifactRunner,
  HostTradingArtifactRunner,
  readTradingSystemManifest,
  type TradingArtifactRunner
} from "@ouroboros/application/trading/research/artifact-runner";
import { evaluateTradingRun } from "@ouroboros/application/trading/research/evaluator";
import { sealSingleFileTradingArtifactClosure } from
  "@ouroboros/application/trading/research/artifact-closure";
import { evaluatePaperTradingHandoffProbe } from
  "@ouroboros/application/trading/research/paper-handoff-conformance";
import { PaperTradingHandoffConformanceInfrastructureError } from
  "@ouroboros/application/trading/research/paper-handoff-conformance";
import type {
  ArtifactRunResult,
  ReplayTradingScenario
} from "@ouroboros/application/trading/research/types";
import {
  defaultReplayTradingScenarioSet,
  startReplayTradingApiProvider,
  toReplayTradingCandidateInput
} from "@ouroboros/application/trading/research/replay-trading-api-provider";
import { passingPaperHandoffProbe } from "./helpers/paper-handoff";
import {
  runTradingReplaySet,
} from "@ouroboros/application/trading/research/replay-set-runner";
import {
  readNotebook,
  runTradingResearchLoop
} from "@ouroboros/application/trading/research/run-trading-research";
import {
  createGatewayRuntimeBinding,
  startPaperTradingApiProvider
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-trading-research-"));
});

afterEach(async () => {
  delete process.env.SBX_FAKE_COMMAND_LOG;
  delete process.env.OUROBOROS_TRADING_REPLAY_PROVIDER_LISTEN_HOST;
  delete process.env.OUROBOROS_TRADING_REPLAY_SANDBOX_HOST;
  delete process.env.OUROBOROS_TRADING_REPLAY_PROVIDER_TRANSPORT;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Trading research research loop MVP", () => {
  it("runs one artifact through replay provider, evaluator, keep, discard, and notebook output", async () => {
    const runRoot = path.join(tmpDir, "session");
    const result = await runTradingResearchLoop({
      run_root: runRoot,
      session_id: "test-session",
      iterations: 2,
      agent_adapter: new FixtureTradingResearchAgentAdapter(),
      artifact_runner: new HostTradingArtifactRunner({ allowHostExecution: true })
    });

    expect(result.entries.map((entry) => entry.decision)).toEqual(["keep", "discard"]);
    expect(result.best_score).toBe(1);
    expect(result.best_artifact_dir).toContain("kept-artifact");
    expect(result.entries[0].evaluation.scenario_results?.map((scenario) => scenario.scenario_id)).toEqual([
      "trend_long",
      "range_flat"
    ]);

    const notebook = await readNotebook(result.notebook_path);
    expect(notebook.entries).toHaveLength(2);
    expect(notebook.entries[0]).toMatchObject({
      iteration: 1,
      decision: "keep",
      score: 1,
      agent_status: "edited",
      agent_changed_paths: ["run.py"],
      evaluation: {
        status: "accepted",
        risk_decision: "valid_order_request"
      }
    });
    expect(notebook.entries[0].events_path).toContain("replay-set.json");
    expect(notebook.entries[0].evaluation.scenario_results).toBeUndefined();
    expect(notebook.entries[1]).toMatchObject({
      iteration: 2,
      decision: "discard",
      agent_status: "edited",
      evaluation: {
        status: "disqualified",
        risk_decision: "invalid_order_request"
      }
    });
    expect(notebook.entries[1].evaluation.scenario_results).toBeUndefined();
    const notebookSurface = JSON.stringify(notebook);
    expect(notebookSurface).toContain("provider_boundary");
    expect(notebookSurface).toContain("replay_set_average");
    expect(notebookSurface).not.toMatch(/scenario_results|scenario_id|trend_long|range_flat|runner_command_evidence/i);
    expect(notebookSurface).not.toMatch(
      /proposal|materialization_attempt|lineage|orchestration_run|provider_result|trace_refs|sealed-replay|\bvenue\b/i
    );
    const replayFeedback = await readFile(notebook.entries[0].events_path, "utf8");
    expect(replayFeedback).toContain("replay_set_average");
    expect(replayFeedback).not.toMatch(
      /scenario_results|scenario_id|trend_long|range_flat|expected_direction|exit_price|runner_command_evidence/i
    );
    await expect(readdir(path.dirname(notebook.entries[0].events_path))).resolves.toEqual([
      "paper-handoff-conformance",
      "replay-set.json"
    ]);
    await expect(readdir(path.join(
      path.dirname(notebook.entries[0].events_path),
      "paper-handoff-conformance"
    ))).resolves.toEqual([
      "paper-handoff-heartbeat.jsonl",
      "paper-handoff-output.jsonl"
    ]);
  });

  it("proves the artifact uses the external TradingApiProvider boundary", async () => {
    const artifactDir = path.join(tmpDir, "artifact");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    const manifest = await readTradingSystemManifest(artifactDir);
    const provider = await startReplayTradingApiProvider();
    const run = await new HostTradingArtifactRunner({ allowHostExecution: true }).run({
      artifact_dir: artifactDir,
      manifest,
      provider,
      output_dir: path.join(tmpDir, "run")
    });
    await provider.close();

    expect(run.status).toBe("completed");
    expect(run.provider_requests.map((request) => request.path)).toEqual([
      "/market/snapshot",
      "/account/state",
      "/orders/validate"
    ]);
    expect(run.events.map((event) => event.event)).toEqual([
      "market_snapshot",
      "account_state",
      "order_request",
      "order_validation",
      "run_complete"
    ]);
    expect(evaluateTradingRun(run, defaultReplayTradingScenarioSet[0])).toMatchObject({
      status: "accepted",
      score: 1,
      risk_decision: "valid_order_request"
    });
  });

  it("probes the target paper handoff protocol through the host runner", async () => {
    const artifactDir = path.join(tmpDir, "paper-handoff-host-artifact");
    const outputDir = path.join(tmpDir, "paper-handoff-host-output");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    const provider = await startReplayTradingApiProvider();
    try {
      const probe = await new HostTradingArtifactRunner({ allowHostExecution: true })
        .probePaperHandoff({
          artifact_dir: artifactDir,
          manifest: await readTradingSystemManifest(artifactDir),
          provider,
          output_dir: outputDir,
          instance_id: "paper-handoff-host-system-code-001",
          start_at: "2026-07-12T10:00:00.000Z"
        });

      expect(evaluatePaperTradingHandoffProbe(probe)).toMatchObject({
        status: "passed",
        reason: "passed",
        decision_event_kind: "order_request",
        heartbeat_count: 1,
        runtime_stopped: true
      });
      expect(probe).toMatchObject({
        status: "completed",
        runner_kind: "host_process",
        instance_id: "paper-handoff-host-system-code-001",
        timed_out: false,
        exit_code: 0
      });
      expect(probe.provider_requests.map((request) => request.path)).toEqual([
        "/market/snapshot",
        "/account/state",
        "/orders/validate"
      ]);
      expect(probe.output_lines.map((line) => JSON.parse(line).event)).toEqual([
        "order_request",
        "runtime_heartbeat",
        "runtime_stopped"
      ]);
      expect(JSON.stringify(provider.candidate_input)).not.toMatch(
        /expected_direction|target_risk_fraction|outcome|exit_price|fee_bps|slippage_bps|funding_bps/i
      );
      await expect(readdir(outputDir)).resolves.toEqual([
        "paper-handoff-heartbeat.jsonl",
        "paper-handoff-output.jsonl"
      ]);
    } finally {
      await provider.close();
    }
  });

  it("returns attributable rejection evidence when paper mode exits after replay compatibility", async () => {
    const artifactDir = path.join(tmpDir, "paper-handoff-replay-only-artifact");
    await mkdir(artifactDir, { recursive: true });
    await writeFile(path.join(artifactDir, "manifest.json"), `${JSON.stringify({
      id: "replay-only-artifact",
      name: "Replay-only artifact",
      entrypoint: [process.execPath, "run-artifact.mjs"],
      editable_paths: ["run-artifact.mjs"],
      api_contract: "trading_api_provider_v1"
    }, null, 2)}\n`, "utf8");
    await writeFile(path.join(artifactDir, "run-artifact.mjs"), `
if (process.argv.includes("--output-events")) process.exit(0);
console.error("paper mode unsupported");
process.exit(17);
`, "utf8");
    const provider = await startReplayTradingApiProvider();
    try {
      const probe = await new HostTradingArtifactRunner({ allowHostExecution: true })
        .probePaperHandoff({
          artifact_dir: artifactDir,
          manifest: await readTradingSystemManifest(artifactDir),
          provider,
          output_dir: path.join(tmpDir, "paper-handoff-replay-only-output"),
          instance_id: "paper-handoff-replay-only",
          start_at: "2026-07-12T10:00:00.000Z"
        });

      expect(probe).toMatchObject({
        status: "crashed",
        exit_code: 17,
        timed_out: false,
        stderr: expect.stringContaining("paper mode unsupported")
      });
      expect(evaluatePaperTradingHandoffProbe(probe)).toMatchObject({
        status: "rejected",
        reason: "runner_crash"
      });
    } finally {
      await provider.close();
    }
  });

  it("scores flat replay scenarios as hold decisions instead of long-only behavior", async () => {
    const artifactDir = path.join(tmpDir, "artifact-flat");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    const manifest = await readTradingSystemManifest(artifactDir);
    const flatScenario = defaultReplayTradingScenarioSet.find((scenario) => scenario.id === "range_flat");
    expect(flatScenario).toBeDefined();
    const provider = await startReplayTradingApiProvider(flatScenario);
    const run = await new HostTradingArtifactRunner({ allowHostExecution: true }).run({
      artifact_dir: artifactDir,
      manifest,
      provider,
      output_dir: path.join(tmpDir, "run-flat")
    });
    await provider.close();

    expect(run.status).toBe("completed");
    expect(run.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "order_request",
          side: "hold",
          quantity: 0
        })
      ])
    );
    expect(evaluateTradingRun(run, flatScenario)).toMatchObject({
      status: "accepted",
      score: 1,
      profit_loss: {
        revenue_usdt: 0,
        cost_usdt: 0,
        net_revenue_usdt: 0,
        net_return_pct: 0
      },
      risk_decision: "valid_order_request"
    });
  });

  it("scores accepted replay orders by revenue minus execution costs", () => {
    const scenario: ReplayTradingScenario = {
      id: "costed_long",
      description: "Long replay with hidden exit and execution costs.",
      market: {
        symbol: "BTCUSDT",
        price: 100,
        moving_average_fast: 101,
        moving_average_slow: 100,
        volatility: 0.01,
        expected_direction: "long",
        observed_at: "2026-05-12T01:00:00.000Z"
      },
      account: {
        equity: 10_000,
        max_position_notional: 1_000,
        max_risk_fraction: 0.2,
        target_risk_fraction: 0.01
      },
      outcome: {
        exit_price: 110,
        fee_bps: 10,
        slippage_bps: 5,
        funding_bps: 2
      }
    };
    const run: ArtifactRunResult = {
      status: "completed",
      runner_kind: "host_process",
      artifact_dir: "/tmp/revenue-cost-artifact",
      entrypoint: ["python3", "run.py"],
      events_path: "/tmp/revenue-cost-events.jsonl",
      stdout: "",
      stderr: "",
      exit_code: 0,
      events: [
        { event: "market_snapshot", ...toReplayTradingCandidateInput(scenario).market },
        { event: "account_state", ...scenario.account },
        {
          event: "order_request",
          symbol: "BTCUSDT",
          side: "buy",
          quantity: 1,
          order_type: "market",
          reason: "costed long setup"
        },
        {
          event: "order_validation",
          accepted: true,
          reason: "risk_limits_passed",
          notional: 100,
          risk_fraction: 0.01
        }
      ],
      provider_requests: [
        { at: "2026-05-12T01:00:01.000Z", method: "GET", path: "/market/snapshot", response_status: 200 },
        { at: "2026-05-12T01:00:02.000Z", method: "GET", path: "/account/state", response_status: 200 },
        {
          at: "2026-05-12T01:00:03.000Z",
          method: "POST",
          path: "/orders/validate",
          body: {
            symbol: "BTCUSDT",
            side: "buy",
            quantity: 1,
            order_type: "market",
            reason: "costed long setup"
          },
          response_status: 200
        }
      ]
    };

    expect(evaluateTradingRun(run, scenario)).toMatchObject({
      status: "accepted",
      score: 1,
      risk_decision: "valid_order_request",
      profit_loss: {
        revenue_usdt: 10,
        cost_usdt: 0.17,
        net_revenue_usdt: 9.83,
        net_return_pct: 0.0983
      }
    });
  });

  it("scores sell replay orders and disqualifies malformed risk validation failures", () => {
    const scenario: ReplayTradingScenario = {
      id: "costed_short",
      description: "Short replay with hidden exit and execution costs.",
      market: {
        symbol: "BTCUSDT",
        price: 100,
        moving_average_fast: 99,
        moving_average_slow: 100,
        volatility: 0.01,
        expected_direction: "short",
        observed_at: "2026-05-12T01:00:00.000Z"
      },
      account: {
        equity: 10_000,
        max_position_notional: 1_000,
        max_risk_fraction: 0.2,
        target_risk_fraction: 0.01
      },
      outcome: {
        exit_price: 90,
        fee_bps: 10,
        slippage_bps: 5,
        funding_bps: 2
      }
    };
    const acceptedShort: ArtifactRunResult = replayRunForOrder({
      scenario,
      side: "sell",
      accepted: true,
      validationReason: "risk_limits_passed"
    });
    const malformedShort: ArtifactRunResult = replayRunForOrder({
      scenario,
      side: "sell",
      accepted: false,
      validationReason: "malformed_order_request",
      providerBody: { malformed: true }
    });

    expect(evaluateTradingRun(acceptedShort, scenario)).toMatchObject({
      status: "accepted",
      risk_decision: "valid_order_request",
      profit_loss: {
        revenue_usdt: 10,
        cost_usdt: 0.17,
        net_revenue_usdt: 9.83,
        net_return_pct: 0.0983
      }
    });
    expect(evaluateTradingRun(malformedShort, scenario)).toMatchObject({
      status: "disqualified",
      risk_decision: "invalid_order_request",
      profit_loss: {
        revenue_usdt: 0,
        cost_usdt: 0,
        net_revenue_usdt: 0,
        net_return_pct: 0
      }
    });
  });

  it("uses external request evidence instead of candidate-authored validation", () => {
    const scenario = defaultReplayTradingScenarioSet[0];
    const forgedValidation = replayRunForOrder({
      scenario,
      side: "buy",
      accepted: true,
      validationReason: "candidate_claimed_risk_limits_passed",
      quantity: 100
    });

    expect(evaluateTradingRun(forgedValidation, scenario)).toMatchObject({
      status: "disqualified",
      score: 0,
      risk_decision: "invalid_order_request",
      disqualification_reason: "risk_validation_failed",
      profit_loss: {
        net_revenue_usdt: 0
      }
    });
  });

  it("rejects semantically incoherent hold and directional order combinations", () => {
    const scenario = defaultReplayTradingScenarioSet[0];
    const malformedRuns = [
      replayRunForOrder({
        scenario,
        side: "buy",
        quantity: -0.001,
        accepted: true,
        validationReason: "candidate_claimed_negative_quantity_valid"
      }),
      replayRunForOrder({
        scenario,
        side: "buy",
        quantity: 0,
        orderType: "none",
        accepted: true,
        validationReason: "candidate_claimed_directional_none_valid"
      }),
      replayRunForOrder({
        scenario,
        side: "hold",
        quantity: 0,
        orderType: "market",
        accepted: true,
        validationReason: "candidate_claimed_hold_market_valid"
      })
    ];

    for (const run of malformedRuns) {
      expect(evaluateTradingRun(run, scenario)).toMatchObject({
        status: "disqualified",
        score: 0,
        disqualification_reason: "risk_validation_failed"
      });
    }
  });

  it("rejects a candidate order event that differs from the provider submission", () => {
    const scenario = defaultReplayTradingScenarioSet[0];
    const mismatchedOrder = replayRunForOrder({
      scenario,
      side: "buy",
      accepted: true,
      validationReason: "risk_limits_passed",
      providerBody: {
        symbol: "BTCUSDT",
        side: "buy",
        quantity: 0.01,
        order_type: "market",
        reason: "different submitted order"
      }
    });

    expect(evaluateTradingRun(mismatchedOrder, scenario)).toMatchObject({
      status: "disqualified",
      score: 0,
      risk_decision: "invalid_order_request",
      disqualification_reason: "runtime_self_report_only"
    });
  });

  it("allows trace-only order event metadata while keeping the provider body exact", () => {
    const scenario = defaultReplayTradingScenarioSet[0];
    const run = replayRunForOrder({
      scenario,
      side: "buy",
      accepted: true,
      validationReason: "risk_limits_passed",
      quantity: 0.001
    });
    const orderEvent = run.events.find((event) => event.event === "order_request");
    if (!orderEvent) {
      throw new Error("order_request test event missing");
    }
    orderEvent.event_id = "trace-order-001";
    orderEvent.authority_status = "trace_only";

    expect(evaluateTradingRun(run, scenario)).toMatchObject({
      status: "accepted",
      risk_decision: "valid_order_request"
    });
  });

  it("disqualifies evaluator probing and hidden-field emission", () => {
    const scenario = defaultReplayTradingScenarioSet[0];
    const probingRun = replayRunForOrder({
      scenario,
      side: "buy",
      accepted: true,
      validationReason: "risk_limits_passed"
    });
    probingRun.provider_requests.push({
      at: "2026-05-12T01:00:04.000Z",
      method: "GET",
      path: "/evaluation/outcome",
      response_status: 404
    });
    const lookaheadRun = replayRunForOrder({
      scenario,
      side: "buy",
      accepted: true,
      validationReason: "risk_limits_passed"
    });
    lookaheadRun.events.push({
      event: "candidate_diagnostic",
      expected_direction: "long"
    });
    const hiddenProviderBodyRun = replayRunForOrder({
      scenario,
      side: "buy",
      accepted: true,
      validationReason: "risk_limits_passed",
      providerBody: {
        symbol: "BTCUSDT",
        side: "buy",
        quantity: 1,
        order_type: "market",
        reason: "costed replay setup",
        expected_direction: "long"
      }
    });
    const undeclaredProviderFieldRun = replayRunForOrder({
      scenario,
      side: "buy",
      accepted: true,
      validationReason: "risk_limits_passed",
      providerBody: {
        symbol: "BTCUSDT",
        side: "buy",
        quantity: 1,
        order_type: "market",
        reason: "costed replay setup",
        evaluator_probe: true
      }
    });

    expect(evaluateTradingRun(probingRun, scenario)).toMatchObject({
      status: "disqualified",
      score: 0,
      disqualification_reason: "data_leakage"
    });
    expect(evaluateTradingRun(lookaheadRun, scenario)).toMatchObject({
      status: "disqualified",
      score: 0,
      disqualification_reason: "lookahead_leakage"
    });
    expect(evaluateTradingRun(hiddenProviderBodyRun, scenario)).toMatchObject({
      status: "disqualified",
      score: 0,
      disqualification_reason: "lookahead_leakage"
    });
    expect(evaluateTradingRun(undeclaredProviderFieldRun, scenario)).toMatchObject({
      status: "disqualified",
      score: 0,
      disqualification_reason: "runtime_self_report_only"
    });
  });

  it("preserves a leakage reason when an earlier scenario has an ordinary risk rejection", async () => {
    const artifactDir = path.join(tmpDir, "mixed-disqualification-artifact");
    const manifest = syntheticManifest(
      "mixed-disqualification-artifact",
      "Mixed disqualification artifact"
    );
    await prepareSyntheticArtifact(artifactDir, manifest);
    const replay = await runTradingReplaySet({
      artifact_dir: artifactDir,
      manifest,
      output_dir: path.join(tmpDir, "mixed-disqualification-run"),
      artifact_runner: mixedDisqualificationArtifactRunner()
    });

    expect(replay.scenario_results.map((result) => result.disqualification_reason)).toEqual([
      "risk_validation_failed",
      "data_leakage"
    ]);
    expect(replay.evaluation).toMatchObject({
      status: "disqualified",
      disqualification_reason: "data_leakage"
    });
  });

  it("keeps accepted replay only after bounded paper handoff conformance passes", async () => {
    const artifactDir = path.join(tmpDir, "composed-conformance-pass-artifact");
    const outputDir = path.join(tmpDir, "composed-conformance-pass-run");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    const runner = controlledPaperHandoffArtifactRunner(["passed"]);

    const replay = await runTradingReplaySet({
      artifact_dir: artifactDir,
      manifest: await readTradingSystemManifest(artifactDir),
      output_dir: outputDir,
      scenarios: [defaultReplayTradingScenarioSet[0]],
      artifact_runner: runner
    });

    expect(runner.probe_count()).toBe(1);
    expect(replay.evaluation).toMatchObject({
      status: "accepted",
      score: 1,
      metrics: expect.arrayContaining([
        expect.objectContaining({
          name: "paper_handoff_conformance",
          score: 1
        })
      ]),
      paper_handoff_conformance: {
        protocol_version: "paper_trading_event_protocol_v1",
        status: "passed",
        reason: "passed",
        runner_kind: "host_process",
        provider_request_count: 3,
        heartbeat_count: 1,
        runtime_stopped: true,
        runnable_paper_handoff: true
      }
    });
    const feedback = await readFile(replay.events_path, "utf8");
    expect(feedback).toContain("paper_handoff_conformance");
    expect(feedback).not.toMatch(
      /output_lines|provider_requests|command_evidence|instance_id|paper-handoff-output\.jsonl/i
    );
  });

  it("zeroes an accepted replay when target paper handoff conformance rejects", async () => {
    const artifactDir = path.join(tmpDir, "composed-conformance-reject-artifact");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    const runner = controlledPaperHandoffArtifactRunner(["rejected"]);

    const replay = await runTradingReplaySet({
      artifact_dir: artifactDir,
      manifest: await readTradingSystemManifest(artifactDir),
      output_dir: path.join(tmpDir, "composed-conformance-reject-run"),
      scenarios: [defaultReplayTradingScenarioSet[0]],
      artifact_runner: runner
    });

    expect(runner.probe_count()).toBe(1);
    expect(replay.evaluation).toMatchObject({
      status: "disqualified",
      score: 0,
      disqualification_reason: "unreproducible",
      metrics: expect.arrayContaining([
        expect.objectContaining({
          name: "paper_handoff_conformance",
          score: 0,
          detail: expect.stringContaining("runtime_heartbeat_missing")
        })
      ]),
      paper_handoff_conformance: {
        status: "rejected",
        reason: "runtime_heartbeat_missing",
        runnable_paper_handoff: false
      }
    });
  });

  it("restores and rejects submitted SystemCode that mutates during paper handoff", async () => {
    const artifactDir = path.join(tmpDir, "paper-handoff-mutating-artifact");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    const runPath = path.join(artifactDir, "run.py");
    const submittedBytes = await readFile(runPath);
    const manifest = await readTradingSystemManifest(artifactDir);
    const submittedClosureDigest = (
      await sealSingleFileTradingArtifactClosure(artifactDir, manifest)
    ).closure_digest;
    const runner = controlledPaperHandoffArtifactRunner(["mutated"]);

    const replay = await runTradingReplaySet({
      artifact_dir: artifactDir,
      manifest,
      output_dir: path.join(tmpDir, "paper-handoff-mutating-run"),
      scenarios: [defaultReplayTradingScenarioSet[0]],
      artifact_runner: runner
    });

    expect(replay.evaluation).toMatchObject({
      status: "disqualified",
      score: 0,
      disqualification_reason: "unreproducible",
      paper_handoff_conformance: {
        status: "rejected",
        reason: "artifact_digest_mismatch",
        system_code_artifact_digest: submittedClosureDigest,
        runnable_paper_handoff: false
      }
    });
    await expect(readFile(runPath)).resolves.toEqual(submittedBytes);
  });

  it("restores and rejects undeclared artifact-closure mutation during paper handoff", async () => {
    const artifactDir = path.join(tmpDir, "paper-handoff-closure-mutating-artifact");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    const manifestPath = path.join(artifactDir, "manifest.json");
    const submittedManifest = await readFile(manifestPath);
    const scenario = defaultReplayTradingScenarioSet[0]!;
    const runner: TradingArtifactRunner = {
      kind: "host_process",
      async run(input) {
        return {
          ...replayRunForOrder({
            scenario,
            side: "buy",
            accepted: true,
            validationReason: "risk_limits_passed",
            quantity: 0.0033333333333333335
          }),
          artifact_dir: input.artifact_dir,
          entrypoint: input.manifest.entrypoint,
          events_path: path.join(input.output_dir, "events.jsonl")
        };
      },
      async probePaperHandoff(input) {
        await writeFile(
          path.join(input.artifact_dir, "helper.py"),
          "SIDE = 'sell'\n",
          "utf8"
        );
        await writeFile(manifestPath, "{}\n", "utf8");
        return passingPaperHandoffProbe(input);
      }
    };

    const replay = await runTradingReplaySet({
      artifact_dir: artifactDir,
      manifest: await readTradingSystemManifest(artifactDir),
      output_dir: path.join(tmpDir, "paper-handoff-closure-mutating-run"),
      scenarios: [scenario],
      artifact_runner: runner,
      replay_provider_factory: async (candidateInput) => ({
        base_url: "",
        close: async () => undefined,
        requests: () => [],
        candidate_input: candidateInput
      })
    });

    expect(replay.evaluation).toMatchObject({
      status: "disqualified",
      score: 0,
      disqualification_reason: "unreproducible",
      paper_handoff_conformance: {
        status: "rejected",
        reason: "artifact_digest_mismatch",
        runnable_paper_handoff: false
      }
    });
    await expect(readFile(manifestPath)).resolves.toEqual(submittedManifest);
    await expect(readFile(path.join(artifactDir, "helper.py"))).rejects.toThrow();
  });

  it("rejects an undeclared submitted artifact closure before provider or runner effects", async () => {
    const artifactDir = path.join(tmpDir, "submitted-closure-invalid-artifact");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    await writeFile(path.join(artifactDir, "helper.py"), "SIDE = 'sell'\n", "utf8");
    let providerStarts = 0;
    let runnerCalls = 0;

    const replay = await runTradingReplaySet({
      artifact_dir: artifactDir,
      manifest: await readTradingSystemManifest(artifactDir),
      output_dir: path.join(tmpDir, "submitted-closure-invalid-run"),
      replay_provider_factory: async () => {
        providerStarts += 1;
        throw new Error("provider must not start for invalid artifact closure");
      },
      artifact_runner: {
        kind: "host_process",
        async run() {
          runnerCalls += 1;
          throw new Error("runner must not execute invalid artifact closure");
        },
        async probePaperHandoff() {
          runnerCalls += 1;
          throw new Error("probe must not execute invalid artifact closure");
        }
      }
    });

    expect(replay).toMatchObject({
      scenario_results: [],
      evaluation: {
        status: "disqualified",
        score: 0,
        disqualification_reason: "unreproducible",
        risk_decision: "no_order_request"
      }
    });
    expect(replay.evaluation.paper_handoff_conformance).toBeUndefined();
    expect(providerStarts).toBe(0);
    expect(runnerCalls).toBe(0);
    await expect(readFile(replay.events_path, "utf8"))
      .resolves.toContain("artifact_integrity");
  });

  it("freezes the source manifest before ResearchWorker effects", async () => {
    let providerStarts = 0;
    let runnerCalls = 0;
    const result = await runTradingResearchLoop({
      run_root: path.join(tmpDir, "research-manifest-freeze"),
      session_id: "research-manifest-freeze",
      iterations: 1,
      artifact_source_dir: path.resolve("artifacts/trading-system"),
      agent_adapter: {
        agent: {
          id: "manifest-mutating-worker",
          provider: "fixture",
          model: "manifest-mutating-fixture",
          permission_policy: "fixture_only"
        },
        async improveArtifact(input) {
          const manifestPath = path.join(input.artifact_dir, "manifest.json");
          const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
          await writeFile(
            manifestPath,
            `${JSON.stringify({ ...manifest, name: "mutated after commitment" }, null, 2)}\n`,
            "utf8"
          );
          return {
            status: "edited",
            summary: "mutated manifest",
            changed_paths: ["manifest.json"]
          };
        }
      },
      replay_provider_factory: async () => {
        providerStarts += 1;
        throw new Error("provider must not start after manifest drift");
      },
      artifact_runner: {
        kind: "host_process",
        async run() {
          runnerCalls += 1;
          throw new Error("runner must not execute after manifest drift");
        },
        async probePaperHandoff() {
          runnerCalls += 1;
          throw new Error("probe must not execute after manifest drift");
        }
      }
    });

    expect(result).toMatchObject({
      best_score: undefined,
      best_artifact_dir: undefined,
      entries: [{
        decision: "discard",
        evaluation: {
          status: "disqualified",
          disqualification_reason: "unreproducible"
        }
      }]
    });
    expect(providerStarts).toBe(0);
    expect(runnerCalls).toBe(0);
  });

  it("does not spend a paper handoff probe after replay already rejects", async () => {
    const base = mixedDisqualificationArtifactRunner();
    let probeCount = 0;
    const runner: TradingArtifactRunner = {
      ...base,
      async probePaperHandoff(input) {
        probeCount += 1;
        return base.probePaperHandoff(input);
      }
    };

    const artifactDir = path.join(tmpDir, "skip-conformance-artifact");
    const manifest = syntheticManifest(
      "skip-conformance-artifact",
      "Skip conformance artifact"
    );
    await prepareSyntheticArtifact(artifactDir, manifest);
    const replay = await runTradingReplaySet({
      artifact_dir: artifactDir,
      manifest,
      output_dir: path.join(tmpDir, "skip-conformance-run"),
      artifact_runner: runner
    });

    expect(replay.evaluation.status).toBe("disqualified");
    expect(replay.evaluation).not.toHaveProperty("paper_handoff_conformance");
    expect(probeCount).toBe(0);
  });

  it("retains a prior conformance-passed best when a later paper handoff rejects", async () => {
    const runner = controlledPaperHandoffArtifactRunner(["passed", "rejected"]);
    const result = await runTradingResearchLoop({
      run_root: path.join(tmpDir, "paper-handoff-best-barrier"),
      session_id: "paper-handoff-best-barrier",
      iterations: 2,
      agent_adapter: new NoopTradingResearchAgentAdapter(),
      artifact_runner: runner
    });

    expect(runner.probe_count()).toBe(2);
    expect(result.entries.map((entry) => entry.decision)).toEqual(["keep", "discard"]);
    expect(result.entries[1]).toMatchObject({
      score: 0,
      evaluation: {
        status: "disqualified",
        paper_handoff_conformance: {
          status: "rejected",
          reason: "runtime_heartbeat_missing"
        }
      }
    });
    expect(result.best_score).toBe(1);
    expect(result.best_artifact_dir).toContain(path.join("iterations", "001", "kept-artifact"));

    const notebook = await readNotebook(result.notebook_path);
    const notebookSurface = JSON.stringify(notebook);
    expect(notebookSurface).toContain("paper_handoff_conformance");
    expect(notebookSurface).not.toMatch(
      /output_lines|provider_requests|command_evidence|instance_id|paper-handoff-output\.jsonl/i
    );
    expect(notebook.entries[0].evaluation).not.toHaveProperty("paper_handoff_conformance");
    expect(notebook.entries[1].evaluation).not.toHaveProperty("paper_handoff_conformance");
  });

  it("propagates paper handoff infrastructure failure instead of scoring strategy evidence", async () => {
    const runner = controlledPaperHandoffArtifactRunner(["infrastructure_failed"]);
    const runRoot = path.join(tmpDir, "paper-handoff-infrastructure-failure");

    await expect(runTradingResearchLoop({
      run_root: runRoot,
      session_id: "paper-handoff-infrastructure-failure",
      iterations: 1,
      agent_adapter: new NoopTradingResearchAgentAdapter(),
      artifact_runner: runner
    })).rejects.toMatchObject({
      name: "PaperTradingHandoffConformanceInfrastructureError",
      code: "runner_unavailable",
      candidate_rejection: false
    });
    expect(runner.probe_count()).toBe(1);
    expect((await readNotebook(path.join(runRoot, "notebook.json"))).entries).toEqual([]);
  });

  it("never keeps a disqualified first iteration as the research best", async () => {
    const result = await runTradingResearchLoop({
      run_root: path.join(tmpDir, "disqualified-first-iteration"),
      session_id: "disqualified-first-iteration",
      iterations: 1,
      agent_adapter: new FixtureTradingResearchAgentAdapter(),
      artifact_runner: mixedDisqualificationArtifactRunner()
    });

    expect(result.entries[0]).toMatchObject({
      decision: "discard",
      evaluation: {
        status: "disqualified",
        disqualification_reason: "data_leakage"
      }
    });
    expect(result.best_score).toBeUndefined();
    expect(result.best_artifact_dir).toBeUndefined();
  });

  it("removes evaluator scenario files even when provider close fails", async () => {
    const outputDir = path.join(tmpDir, "provider-close-failure");
    const artifactDir = path.join(tmpDir, "provider-close-failure-artifact");
    const manifest = syntheticManifest(
      "provider-close-failure-artifact",
      "Provider close failure artifact"
    );
    await prepareSyntheticArtifact(artifactDir, manifest);
    await expect(runTradingReplaySet({
      artifact_dir: artifactDir,
      manifest,
      output_dir: outputDir,
      scenarios: [defaultReplayTradingScenarioSet[0]],
      artifact_runner: mixedDisqualificationArtifactRunner(),
      replay_provider_factory: async (candidateInput) => ({
        base_url: "",
        close: async () => {
          throw new Error("provider_close_failed");
        },
        requests: () => [],
        candidate_input: candidateInput
      })
    })).rejects.toThrow("provider_close_failed");
    await expect(readdir(outputDir)).resolves.toEqual([]);
  });

  it("exposes only candidate inputs through replay and paper provider sessions", async () => {
    const scenario = defaultReplayTradingScenarioSet[0];
    const provider = await startReplayTradingApiProvider(toReplayTradingCandidateInput(scenario), {
      listen_host: "0.0.0.0",
      sandbox_host: "host.docker.internal"
    });
    const paperProvider = await startPaperTradingApiProvider(createGatewayRuntimeBinding({
      marketData: fakeGatewayMarketDataPort()
    }));
    try {
      expect(provider.base_url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(provider.sandbox_base_url).toMatch(/^http:\/\/host\.docker\.internal:\d+$/);

      const replayResponse = await fetch(`${provider.base_url}/market/snapshot`);
      const paperResponse = await fetch(`${paperProvider.base_url}/market/snapshot`);
      const replayAccountResponse = await fetch(`${provider.base_url}/account/state`);
      const paperAccountResponse = await fetch(`${paperProvider.base_url}/account/state`);
      expect(replayResponse.status).toBe(200);
      expect(paperResponse.status).toBe(200);
      expect(replayAccountResponse.status).toBe(200);
      expect(paperAccountResponse.status).toBe(200);
      const replayMarket = await replayResponse.json() as Record<string, unknown>;
      const paperMarket = await paperResponse.json() as Record<string, unknown>;
      const replayAccount = await replayAccountResponse.json() as Record<string, unknown>;
      const paperAccount = await paperAccountResponse.json() as Record<string, unknown>;
      expect(replayMarket).toMatchObject({ symbol: "BTCUSDT" });
      expect(paperMarket).toMatchObject({ symbol: "BTCUSDT" });
      expect(replayMarket).not.toHaveProperty("expected_direction");
      expect(paperMarket).not.toHaveProperty("expected_direction");
      expect(replayAccount).not.toHaveProperty("target_risk_fraction");
      expect(paperAccount).not.toHaveProperty("target_risk_fraction");

      for (const session of [provider, paperProvider]) {
        expect(session).toHaveProperty("candidate_input.market.symbol", "BTCUSDT");
        expect(session).not.toHaveProperty("scenario");
        expect(session).not.toHaveProperty("outcome");
        expect(session).not.toHaveProperty("candidate_input.market.expected_direction");
        expect(session).not.toHaveProperty("candidate_input.account.target_risk_fraction");
      }
    } finally {
      await provider.close();
      await paperProvider.close();
    }
  });

  it("rejects oversized TradingApiProvider request bodies before buffering them", async () => {
    const replayProvider = await startReplayTradingApiProvider();
    const paperProvider = await startPaperTradingApiProvider(createGatewayRuntimeBinding({
      marketData: fakeGatewayMarketDataPort()
    }));
    const oversizedBody = JSON.stringify({ payload: "x".repeat(70 * 1024) });
    try {
      const replayResponse = await fetch(`${replayProvider.base_url}/orders/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: oversizedBody
      });
      const paperResponse = await fetch(`${paperProvider.base_url}/orders/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: oversizedBody
      });

      expect(replayResponse.status).toBe(413);
      expect(await replayResponse.json()).toMatchObject({ error: "request_body_too_large" });
      expect(paperResponse.status).toBe(413);
      expect(await paperResponse.json()).toMatchObject({
        error: "request_body_too_large",
        authority_status: "not_live"
      });
    } finally {
      await replayProvider.close();
      await paperProvider.close();
    }
  });

  it("rejects oversized request bodies in the sandbox-local replay sidecar", async () => {
    const fakeSbx = path.join(tmpDir, "sbx-sidecar-body-limit");
    const commandLog = path.join(tmpDir, "sbx-sidecar-body-limit.log");
    const artifactDir = path.join(tmpDir, "oversized-artifact");
    await writeFile(fakeSbx, fakeSbxTradingScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    await mkdir(artifactDir, { recursive: true });
    await writeFile(path.join(artifactDir, "manifest.json"), `${JSON.stringify({
      id: "oversized-sidecar-request",
      name: "Oversized sidecar request",
      entrypoint: [process.execPath, "run-artifact.mjs"],
      editable_paths: ["run-artifact.mjs"],
      api_contract: "trading_api_provider_v1"
    }, null, 2)}\n`, "utf8");
    await writeFile(path.join(artifactDir, "run-artifact.mjs"), oversizedBodyArtifactSource(), "utf8");
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;

    const provider = await startReplayTradingApiProvider();
    try {
      const run = await new DockerSandboxesSbxTradingArtifactRunner({
        sbxPath: fakeSbx,
        workspacePath: tmpDir,
        sandboxNamePrefix: "ouro-sidecar-limit"
      }).run({
        artifact_dir: artifactDir,
        manifest: await readTradingSystemManifest(artifactDir),
        provider,
        output_dir: path.join(tmpDir, "oversized-run")
      });

      expect(run.status).toBe("completed");
      expect(run.events).toEqual([
        expect.objectContaining({
          event: "oversized_order_validation",
          status: 413,
          error: "request_body_too_large"
        })
      ]);
      expect(run.provider_requests).toEqual([
        expect.objectContaining({
          method: "POST",
          path: "/orders/validate",
          body: null,
          response_status: 413
        })
      ]);
    } finally {
      await provider.close();
      delete process.env.SBX_FAKE_COMMAND_LOG;
    }
  });

  it("runs replay scenarios through an explicit sbx artifact runner adapter", async () => {
    const fakeSbx = path.join(tmpDir, "sbx");
    const commandLog = path.join(tmpDir, "sbx-commands.log");
    await writeFile(fakeSbx, fakeSbxTradingScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;

    const result = await runTradingResearchLoop({
      run_root: path.join(tmpDir, "sbx-session"),
      session_id: "sbx-session",
      iterations: 1,
      agent_adapter: new FixtureTradingResearchAgentAdapter(),
      artifact_runner: new DockerSandboxesSbxTradingArtifactRunner({
        sbxPath: fakeSbx,
        workspacePath: tmpDir,
        sandboxNamePrefix: "ouro-s10-test"
      })
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      decision: "keep",
      score: 1,
      evaluation: {
        status: "accepted"
      }
    });
    const scenarioResults = result.entries[0].evaluation.scenario_results ?? [];
    expect(scenarioResults).toEqual([
      expect.objectContaining({
        scenario_id: "trend_long",
        runner_kind: "docker_sandboxes_sbx",
        provider_request_count: 3,
        runner_command_count: 5,
        runner_command_evidence: expect.arrayContaining([
          expect.objectContaining({
            command: expect.arrayContaining(["version"]),
            exit_code: 0
          }),
          expect.objectContaining({
            command: expect.arrayContaining(["create", "--name"]),
            exit_code: 0
          }),
          expect.objectContaining({
            command: expect.arrayContaining([expect.stringContaining("replay-provider-sidecar.py")]),
            exit_code: 0
          }),
          expect.objectContaining({
            command: expect.arrayContaining(["rm", "--force"]),
            exit_code: 0
          })
        ])
      }),
      expect.objectContaining({
        scenario_id: "range_flat",
        runner_kind: "docker_sandboxes_sbx",
        provider_request_count: 3,
        runner_command_count: 5,
        runner_command_evidence: expect.any(Array)
      })
    ]);
    expect(scenarioResults.every((result) => result.sandbox_name?.startsWith("ouro-s10-test-"))).toBe(true);

    const scenarioOutputRoots = ["scenario-001", "scenario-002"].map((scenarioSlot) =>
      path.join(tmpDir, "sbx-session", "iterations", "001", "run", scenarioSlot)
    );
    const executionOutputRoots = [
      ...scenarioOutputRoots,
      path.join(
        tmpDir,
        "sbx-session",
        "iterations",
        "001",
        "run",
        "paper-handoff-conformance"
      )
    ];
    await expect(readdir(path.join(tmpDir, "sbx-session", "iterations", "001", "run")))
      .resolves.toEqual(["paper-handoff-conformance", "replay-set.json"]);

    const commands = (await readFile(commandLog, "utf8")).trim().split("\n");
    expect(commands.join("\n")).not.toMatch(/trend_long|range_flat/i);
    expect(commands.filter((command) => command === "version")).toHaveLength(3);
    expect(commands.filter((command) => command.startsWith("create --name ouro-s10-test-"))).toHaveLength(3);
    expect(executionOutputRoots.every((outputRoot) =>
      commands.some((command) => command.startsWith("create --name ") &&
        command.endsWith(` shell ${path.join(outputRoot, "sandbox-workspace")}`))
    )).toBe(true);
    expect(executionOutputRoots.every((outputRoot) =>
      commands.some((command) => command.startsWith(
        `exec -w ${path.join(outputRoot, "sandbox-workspace", "artifact")} `
      ))
    )).toBe(true);
    expect(commands.filter((command) => command.startsWith("exec -d -w "))).toHaveLength(0);
    expect(commands.filter((command) => command.startsWith("exec -w "))).toHaveLength(3);
    expect(commands.filter((command) => command.startsWith("stop ouro-s10-test-"))).toHaveLength(3);
    expect(commands.filter((command) => command.startsWith("rm --force ouro-s10-test-"))).toHaveLength(3);
    expect(commands.join("\n")).toContain("replay-provider-runner.py --sidecar-script");
    expect(commands.join("\n")).toContain("--provider-base-url http://127.0.0.1:");
    delete process.env.SBX_FAKE_COMMAND_LOG;
  });

  it("probes paper handoff through sandbox-local candidate-only sbx input and cleans up", async () => {
    const fakeSbx = path.join(tmpDir, "sbx-paper-handoff");
    const commandLog = path.join(tmpDir, "sbx-paper-handoff.log");
    const artifactDir = path.join(tmpDir, "sbx-paper-handoff-artifact");
    const outputDir = path.join(tmpDir, "sbx-paper-handoff-output");
    await writeFile(fakeSbx, fakeSbxTradingScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    const provider = await startReplayTradingApiProvider();
    try {
      const probe = await new DockerSandboxesSbxTradingArtifactRunner({
        sbxPath: fakeSbx,
        workspacePath: tmpDir,
        sandboxNamePrefix: "ouro-paper-handoff"
      }).probePaperHandoff({
        artifact_dir: artifactDir,
        manifest: await readTradingSystemManifest(artifactDir),
        provider,
        output_dir: outputDir,
        instance_id: "paper-handoff-sbx-system-code-001",
        start_at: "2026-07-12T10:00:00.000Z"
      });

      expect(evaluatePaperTradingHandoffProbe(probe)).toMatchObject({
        status: "passed",
        reason: "passed",
        decision_event_kind: "order_request"
      });
      const sidecarInput = JSON.parse(await readFile(path.join(
        outputDir,
        "sandbox-workspace",
        "replay-provider-scenario.json"
      ), "utf8"));
      expect(Object.keys(sidecarInput).sort()).toEqual(["account", "market"]);
      expect(JSON.stringify(sidecarInput)).not.toMatch(
        /expected_direction|target_risk_fraction|outcome|exit_price|fee_bps|slippage_bps|funding_bps/i
      );
      const commands = (await readFile(commandLog, "utf8")).trim().split("\n");
      expect(commands).toEqual(expect.arrayContaining([
        "version",
        expect.stringMatching(/^create --name ouro-paper-handoff-/),
        expect.stringContaining("--instance-id paper-handoff-sbx-system-code-001"),
        expect.stringMatching(/^stop ouro-paper-handoff-/),
        expect.stringMatching(/^rm --force ouro-paper-handoff-/)
      ]));
      const execution = commands.find((command) => command.startsWith("exec -w ")) ?? "";
      expect(execution).toContain("--ticks 1");
      expect(execution).toContain("--paper-order-request valid");
      expect(execution).not.toContain("--output-events");
      expect(probe.command_evidence).toHaveLength(5);
    } finally {
      await provider.close();
      delete process.env.SBX_FAKE_COMMAND_LOG;
    }
  });

  it("bounds the sbx paper handoff process and cleans up after timeout", async () => {
    const fakeSbx = path.join(tmpDir, "sbx-paper-handoff-timeout");
    const commandLog = path.join(tmpDir, "sbx-paper-handoff-timeout.log");
    const artifactDir = path.join(tmpDir, "sbx-paper-handoff-timeout-artifact");
    await writeFile(fakeSbx, fakeSbxTimeoutScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    const provider = await startReplayTradingApiProvider();
    try {
      const probe = await new DockerSandboxesSbxTradingArtifactRunner({
        sbxPath: fakeSbx,
        workspacePath: tmpDir,
        sandboxNamePrefix: "ouro-paper-timeout",
        commandTimeoutMs: 30_000
      }).probePaperHandoff({
        artifact_dir: artifactDir,
        manifest: await readTradingSystemManifest(artifactDir),
        provider,
        output_dir: path.join(tmpDir, "sbx-paper-handoff-timeout-output"),
        instance_id: "paper-handoff-sbx-timeout-001",
        start_at: "2026-07-12T10:00:00.000Z",
        timeout_ms: 25
      });

      expect(probe).toMatchObject({
        status: "crashed",
        timed_out: true
      });
      expect(evaluatePaperTradingHandoffProbe(probe)).toMatchObject({
        status: "rejected",
        reason: "execution_timed_out"
      });
      const commands = (await readFile(commandLog, "utf8")).trim().split("\n");
      expect(commands).toEqual(expect.arrayContaining([
        expect.stringMatching(/^stop ouro-paper-timeout-/),
        expect.stringMatching(/^rm --force ouro-paper-timeout-/)
      ]));
    } finally {
      await provider.close();
      delete process.env.SBX_FAKE_COMMAND_LOG;
    }
  });

  it("mounts only candidate input in an opaque sbx workspace before evaluator cleanup", async () => {
    const fakeSbx = path.join(tmpDir, "sbx-direct");
    const commandLog = path.join(tmpDir, "sbx-direct-commands.log");
    const artifactDir = path.join(tmpDir, "sbx-direct-artifact");
    const outputDir = path.join(tmpDir, "sbx-direct-run", "scenario-001");
    const sandboxWorkspace = path.join(outputDir, "sandbox-workspace");
    await writeFile(fakeSbx, fakeSbxTradingScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, "evaluator-owned-sentinel"), "preserve\n", "utf8");
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    const provider = await startReplayTradingApiProvider(
      toReplayTradingCandidateInput(defaultReplayTradingScenarioSet[0])
    );
    try {
      const runner = new DockerSandboxesSbxTradingArtifactRunner({
        sbxPath: fakeSbx,
        workspacePath: tmpDir,
        sandboxNamePrefix: "ouro-s10-direct"
      });
      const run = await runner.run({
        artifact_dir: artifactDir,
        manifest: await readTradingSystemManifest(artifactDir),
        provider,
        output_dir: outputDir
      });
      expect(run.status).toBe("completed");
      const sidecarInput = JSON.parse(
        await readFile(path.join(sandboxWorkspace, "replay-provider-scenario.json"), "utf8")
      ) as Record<string, unknown>;
      expect(Object.keys(sidecarInput).sort()).toEqual(["account", "market"]);
      expect(JSON.stringify(sidecarInput)).not.toMatch(
        /expected_direction|target_risk_fraction|outcome|exit_price|fee_bps|slippage_bps|funding_bps|trend_long|range_flat/i
      );
      await expect(readFile(path.join(outputDir, "evaluator-owned-sentinel"), "utf8"))
        .resolves.toBe("preserve\n");
      const commands = await readFile(commandLog, "utf8");
      expect(commands).toContain(`shell ${sandboxWorkspace}`);
      expect(commands).toContain(`exec -w ${path.join(sandboxWorkspace, "artifact")}`);
      expect(commands).not.toMatch(/trend_long|range_flat/i);
    } finally {
      await provider.close();
      delete process.env.SBX_FAKE_COMMAND_LOG;
    }
  });

  it("records sbx create failure command evidence in replay scenario results", async () => {
    const fakeSbx = path.join(tmpDir, "sbx-create-fails");
    const commandLog = path.join(tmpDir, "sbx-create-fails.log");
    await writeFile(fakeSbx, fakeSbxCreateFailureScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;

    const result = await runTradingResearchLoop({
      run_root: path.join(tmpDir, "sbx-create-failed-session"),
      session_id: "sbx-create-failed-session",
      iterations: 1,
      agent_adapter: new FixtureTradingResearchAgentAdapter(),
      artifact_runner: new DockerSandboxesSbxTradingArtifactRunner({
        sbxPath: fakeSbx,
        workspacePath: tmpDir,
        sandboxNamePrefix: "ouro-s10-create-fails"
      })
    });

    expect(result.entries[0]).toMatchObject({
      decision: "crash",
      score: 0,
      evaluation: {
        status: "disqualified",
        risk_decision: "no_order_request"
      }
    });
    const scenarioResult = result.entries[0].evaluation.scenario_results?.[0];
    expect(scenarioResult).toMatchObject({
      scenario_id: "trend_long",
      run_status: "crashed",
      provider_request_count: 0,
      runner_command_count: 2,
      runner_command_evidence: [
        expect.objectContaining({
          command: [fakeSbx, "version"],
          exit_code: 0,
          stdout_preview: expect.stringContaining("Client Version:")
        }),
        expect.objectContaining({
          command: [
            fakeSbx,
            "create",
            "--name",
            scenarioResult?.sandbox_name,
            "shell",
            path.join(
              tmpDir,
              "sbx-create-failed-session",
              "iterations",
              "001",
              "run",
              "scenario-001",
              "sandbox-workspace"
            )
          ],
          exit_code: 42,
          stderr_preview: "create failed: run-control unavailable\n"
        })
      ]
    });
    expect(await readFile(commandLog, "utf8")).toContain("create --name");
    delete process.env.SBX_FAKE_COMMAND_LOG;
  });

  it("builds a Codex-first artifact edit command without exposing provider proposal internals", async () => {
    const artifactDir = path.join(tmpDir, "artifact");
    const notebookPath = path.join(tmpDir, "notebook.json");
    const programPath = path.join(tmpDir, "program.md");
    const calls: string[][] = [];
    const stdinPrompts: string[] = [];
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    await writeFile(programPath, "Improve the trading system artifact.\n", "utf8");
    await writeFile(notebookPath, "{\"entries\":[]}\n", "utf8");

    const adapter = new CodexTradingResearchAgentAdapter({
      model: "gpt-5.4-test",
      execFile: async (_file, args, options) => {
        calls.push(args);
        stdinPrompts.push(options?.stdin ?? "");
        const runPath = path.join(artifactDir, "run.py");
        const source = await readFile(runPath, "utf8");
        await writeFile(runPath, source.replace("RISK_FRACTION = 0.01", "RISK_FRACTION = 0.02"), "utf8");
        return { stdout: "", stderr: "" };
      }
    });

    const result = await adapter.improveArtifact({
      agent: adapter.agent,
      artifact_dir: artifactDir,
      program_path: programPath,
      notebook_path: notebookPath,
      iteration: 1
    });

    expect(result.status).toBe("edited");
    expect(result.changed_paths).toEqual(["run.py"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(
      expect.arrayContaining([
        "exec",
        "-c",
        "model_reasoning_effort=\"low\"",
        "--cd",
        artifactDir,
        "--model",
        "gpt-5.4-test",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "-"
      ])
    );
    const commandSurface = calls[0].join(" ");
    expect(commandSurface).not.toMatch(/proposal|materialization|lineage|orchestration/i);
    expect(stdinPrompts[0]).toContain("TradingApiProvider");
    expect(stdinPrompts[0]).not.toMatch(/proposal|materialization|lineage|orchestration/i);
    await expect(readFile(path.join(artifactDir, "run.py"), "utf8")).resolves.toContain(
      "RISK_FRACTION = 0.02"
    );
  });

  it("reports no_change when Codex exits without modifying editable artifact files", async () => {
    const artifactDir = path.join(tmpDir, "artifact");
    const notebookPath = path.join(tmpDir, "notebook.json");
    const programPath = path.join(tmpDir, "program.md");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    await writeFile(programPath, "Improve the trading system artifact.\n", "utf8");
    await writeFile(notebookPath, "{\"best_score\":1,\"entries\":[]}\n", "utf8");

    const adapter = new CodexTradingResearchAgentAdapter({
      execFile: async () => ({ stdout: "no edits\n", stderr: "" })
    });

    const result = await adapter.improveArtifact({
      agent: adapter.agent,
      artifact_dir: artifactDir,
      program_path: programPath,
      notebook_path: notebookPath,
      iteration: 2,
      previous_best_score: 1
    });

    expect(result).toMatchObject({
      status: "no_change",
      changed_paths: []
    });
  });

  it("classifies Codex environment blockers with command evidence", async () => {
    const artifactDir = path.join(tmpDir, "artifact");
    const notebookPath = path.join(tmpDir, "notebook.json");
    const programPath = path.join(tmpDir, "program.md");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    await writeFile(programPath, "Improve the trading system artifact.\n", "utf8");
    await writeFile(notebookPath, "{\"entries\":[]}\n", "utf8");

    const adapter = new CodexTradingResearchAgentAdapter({
      execFile: async () => {
        throw new Error("failed to initialize in-process app-server client: Operation not permitted");
      }
    });

    const result = await adapter.improveArtifact({
      agent: adapter.agent,
      artifact_dir: artifactDir,
      program_path: programPath,
      notebook_path: notebookPath,
      iteration: 1
    });

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "codex_environment_blocked",
      command: expect.arrayContaining(["exec", "--skip-git-repo-check", "-"])
    });
  });

  it("records a crash entry when the agent cannot edit before execution", async () => {
    const failingAdapter = new NoopTradingResearchAgentAdapter();
    Object.defineProperty(failingAdapter, "improveArtifact", {
      value: async () => ({
        status: "failed",
        summary: "agent unavailable",
        error: "codex unavailable"
      })
    });

    const result = await runTradingResearchLoop({
      run_root: path.join(tmpDir, "failed-session"),
      session_id: "failed-session",
      iterations: 1,
      agent_adapter: failingAdapter
    });

    expect(result.entries).toEqual([
      expect.objectContaining({
        decision: "crash",
        score: 0,
        agent_status: "failed",
        summary: "codex unavailable"
      })
    ]);
  });
});

function replayRunForOrder(input: {
  scenario: ReplayTradingScenario;
  side: "buy" | "sell" | "hold";
  accepted: boolean;
  validationReason: string;
  quantity?: number;
  orderType?: "market" | "limit" | "none";
  providerBody?: unknown;
}): ArtifactRunResult {
  const order = {
    symbol: "BTCUSDT",
    side: input.side,
    quantity: input.quantity ?? 1,
    order_type: input.orderType ?? "market" as const,
    reason: "costed replay setup"
  };
  return {
    status: "completed",
    runner_kind: "host_process",
    artifact_dir: "/tmp/revenue-cost-artifact",
    entrypoint: ["python3", "run.py"],
    events_path: "/tmp/revenue-cost-events.jsonl",
    stdout: "",
    stderr: "",
    exit_code: 0,
    events: [
      { event: "market_snapshot", ...toReplayTradingCandidateInput(input.scenario).market },
      { event: "account_state", ...input.scenario.account },
      {
        event: "order_request",
        ...order
      },
      {
        event: "order_validation",
        accepted: input.accepted,
        reason: input.validationReason,
        notional: 100,
        risk_fraction: 0.01
      }
    ],
    provider_requests: [
      { at: "2026-05-12T01:00:01.000Z", method: "GET", path: "/market/snapshot", response_status: 200 },
      { at: "2026-05-12T01:00:02.000Z", method: "GET", path: "/account/state", response_status: 200 },
      {
        at: "2026-05-12T01:00:03.000Z",
        method: "POST",
        path: "/orders/validate",
        body: input.providerBody ?? order,
        response_status: 200
      }
    ]
  };
}

async function prepareSyntheticArtifact(
  artifactDir: string,
  manifest: ReturnType<typeof syntheticManifest>
): Promise<void> {
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, "run.py"), "# sealed synthetic artifact\n", "utf8");
  await writeFile(
    path.join(artifactDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

function syntheticManifest(id: string, name: string) {
  return {
    id,
    name,
    entrypoint: ["python3", "run.py"],
    editable_paths: ["run.py"],
    api_contract: "trading_api_provider_v1" as const
  };
}

function mixedDisqualificationArtifactRunner(): TradingArtifactRunner {
  return {
    kind: "host_process",
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    async run(input) {
      await mkdir(input.output_dir, { recursive: true });
      await writeFile(path.join(input.output_dir, "candidate-output"), "sealed\n", "utf8");
      const market = input.provider.candidate_input.market;
      const account = input.provider.candidate_input.account;
      const firstScenario = market.moving_average_fast > market.moving_average_slow;
      const order = firstScenario
        ? {
            symbol: market.symbol,
            side: "buy" as const,
            quantity: 100,
            order_type: "market" as const,
            reason: "ordinary risk rejection before a later boundary probe"
          }
        : {
            symbol: market.symbol,
            side: "hold" as const,
            quantity: 0,
            order_type: "none" as const,
            reason: "flat causal signal"
          };
      const events: ArtifactRunResult["events"] = [
        { event: "market_snapshot", ...market },
        { event: "account_state", ...account },
        { event: "order_request", ...order }
      ];
      const providerRequests: ArtifactRunResult["provider_requests"] = [
        { at: "2026-05-12T01:00:01.000Z", method: "GET", path: "/market/snapshot", response_status: 200 },
        { at: "2026-05-12T01:00:02.000Z", method: "GET", path: "/account/state", response_status: 200 },
        {
          at: "2026-05-12T01:00:03.000Z",
          method: "POST",
          path: "/orders/validate",
          body: order,
          response_status: 200
        },
        ...(!firstScenario
          ? [{
              at: "2026-05-12T01:00:04.000Z",
              method: "GET",
              path: "/evaluation/outcome",
              response_status: 404
            }]
          : [])
      ];
      return {
        status: "completed",
        runner_kind: "host_process",
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: path.join(input.output_dir, "events.jsonl"),
        stdout: "",
        stderr: "",
        exit_code: 0,
        events,
        provider_requests: providerRequests
      };
    }
  };
}

function controlledPaperHandoffArtifactRunner(
  outcomes: Array<"passed" | "rejected" | "mutated" | "infrastructure_failed">
): TradingArtifactRunner & { probe_count(): number } {
  const host = new HostTradingArtifactRunner({ allowHostExecution: true });
  let probeCount = 0;
  return {
    kind: "host_process",
    probe_count: () => probeCount,
    run: (input) => host.run(input),
    async probePaperHandoff(input) {
      const outcome = outcomes[Math.min(probeCount, outcomes.length - 1)];
      probeCount += 1;
      if (outcome === "infrastructure_failed") {
        throw new PaperTradingHandoffConformanceInfrastructureError(
          "runner_unavailable",
          "paper handoff test runner unavailable"
        );
      }
      const probe = passingPaperHandoffProbe(input);
      if (outcome === "mutated") {
        const runPath = path.resolve(input.artifact_dir, input.manifest.entrypoint[1]!);
        await writeFile(runPath, `${await readFile(runPath, "utf8")}\n# probe mutation\n`, "utf8");
      }
      if (outcome === "rejected") {
        return {
          ...probe,
          output_lines: probe.output_lines.filter((line) =>
            JSON.parse(line).event !== "runtime_heartbeat"
          )
        };
      }
      return probe;
    }
  };
}

function oversizedBodyArtifactSource(): string {
  return `import { appendFile } from "node:fs/promises";

const outputIndex = process.argv.indexOf("--output-events");
if (outputIndex === -1 || !process.argv[outputIndex + 1]) {
  throw new Error("missing --output-events");
}
const outputEvents = process.argv[outputIndex + 1];
const baseUrl = process.env.TRADING_API_BASE_URL;
if (!baseUrl) {
  throw new Error("missing TRADING_API_BASE_URL");
}

const response = await fetch(baseUrl + "/orders/validate", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ payload: "x".repeat(70 * 1024) })
});
const body = await response.json();
await appendFile(
  outputEvents,
  JSON.stringify({
    event: "oversized_order_validation",
    status: response.status,
    error: body.error
  }) + "\\n",
  "utf8"
);
`;
}

function fakeSbxTradingScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$SBX_FAKE_COMMAND_LOG"

case "$1" in
  version)
    printf 'Client Version: fake-sbx\\nServer Version: fake-sbx\\n'
    ;;
  create)
    exit 0
    ;;
  exec)
    shift
    workdir=""
    if [ "\${1:-}" = "-w" ]; then
      workdir="$2"
      shift 2
    fi
    shift
    if [ "\${1:-}" = "env" ]; then
      shift
      while [ "$#" -gt 0 ]; do
        case "$1" in
          *=*)
            export "$1"
            shift
            ;;
          *)
            break
            ;;
        esac
      done
    fi
    cd "$workdir"
    "$@"
    ;;
  stop)
    exit 0
    ;;
  rm)
    exit 0
    ;;
  *)
    echo "unexpected sbx command: $*" >&2
    exit 64
    ;;
esac
`;
}

function fakeSbxCreateFailureScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$SBX_FAKE_COMMAND_LOG"

case "$1" in
  version)
    printf 'Client Version: fake-sbx\\nServer Version: fake-sbx\\n'
    ;;
  create)
    echo 'create failed: run-control unavailable' >&2
    exit 42
    ;;
  *)
    echo "unexpected sbx command: $*" >&2
    exit 64
    ;;
esac
`;
}

function fakeSbxTimeoutScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$SBX_FAKE_COMMAND_LOG"

case "$1" in
  version)
    printf 'Client Version: fake-sbx\\nServer Version: fake-sbx\\n'
    ;;
  create|stop|rm)
    exit 0
    ;;
  exec)
    sleep 1
    ;;
  *)
    exit 64
    ;;
esac
`;
}
