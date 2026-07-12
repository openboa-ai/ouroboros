import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TradingArtifactRunner } from "@ouroboros/application/trading/research/artifact-runner";
import { loadTradingResearchRuntimeConfig } from "@ouroboros/application/trading/research/runtime-config";
import { validateOrderRequest } from "@ouroboros/application/trading/research/replay-trading-api-provider";
import type {
  ReplayTradingApiProviderSession,
  ReplayTradingCandidateInput,
  TradingProviderRequestLog,
  TradingSystemEvent
} from "@ouroboros/application/trading/research/types";
import { LocalStore } from "@ouroboros/local-store";
import { buildServer } from "../src/server";
import { passingPaperHandoffProbe } from "./helpers/paper-handoff";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-managed-codex-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("managed Codex researcher execution", () => {
  it("blocks unauthenticated Codex ticks, then runs arena ticks through the managed Codex profile", async () => {
    const fakeCodexLog = path.join(tmpDir, "fake-codex.jsonl");
    const fakeCodex = path.join(tmpDir, "fake-codex");
    await writeFile(fakeCodex, fakeCodexScript(fakeCodexLog), "utf8");
    await chmod(fakeCodex, 0o755);

    const profileExecCalls: Array<{ file: string; args: string[]; env?: NodeJS.ProcessEnv }> = [];
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchRuntimeConfig: loadTradingResearchRuntimeConfig({
        OUROBOROS_TRADING_RESEARCH_CODEX_BIN: fakeCodex
      }),
      candidateArenaArtifactRunner: networklessReplayArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      agentProfileExecFile: async (file, args, options) => {
        profileExecCalls.push({ file, args, env: options?.env });
        return { stdout: args[0] === "--version" ? "codex fake 1.0.0\n" : "authenticated\n", stderr: "" };
      }
    });

    try {
      const initial = await server.inject({ method: "GET", url: "/api/operator" });
      expect(initial.statusCode).toBe(200);
      expect(initial.json().operator).toMatchObject({
        researcher_provider: {
          selected_provider: "codex",
          authority_status: "research_only"
        },
        agent_profiles: expect.arrayContaining([
          expect.objectContaining({
            profile_id: "codex",
            status: "not_configured",
            authority_status: "no_trading_authority"
          })
        ])
      });

      const blockedBeforeSetup = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: { command_kind: "arena.tick" }
      });
      expect(blockedBeforeSetup.statusCode, blockedBeforeSetup.body).toBe(409);
      expect(blockedBeforeSetup.json()).toMatchObject({
        error: "agent_provider_not_configured",
        required_command: "ouroboros agent setup codex",
        command: {
          command_kind: "arena.tick",
          status: "failed"
        }
      });

      const setup = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "agent_provider.setup",
          payload: { provider: "codex" }
        }
      });
      expect(setup.statusCode, setup.body).toBe(200);
      expect(setup.json().operator.agent_profiles).toContainEqual(expect.objectContaining({
        profile_id: "codex",
        status: "configured"
      }));

      const blockedBeforeLogin = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: { command_kind: "arena.tick" }
      });
      expect(blockedBeforeLogin.statusCode, blockedBeforeLogin.body).toBe(409);
      expect(blockedBeforeLogin.json()).toMatchObject({
        error: "agent_provider_not_authenticated",
        profile_status: "configured",
        required_command: "ouroboros agent login codex"
      });

      const probe = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "agent_provider.probe",
          payload: { provider: "codex" }
        }
      });
      expect(probe.statusCode, probe.body).toBe(200);
      expect(profileExecCalls).toEqual([
        expect.objectContaining({
          file: "codex",
          args: ["--version"],
          env: expect.objectContaining({
            CODEX_HOME: path.join(tmpDir, "agent-profiles", "codex", "codex-home"),
            HOME: path.join(tmpDir, "agent-profiles", "codex", "home")
          })
        }),
        expect.objectContaining({
          file: "codex",
          args: ["login", "status"],
          env: expect.objectContaining({
            CODEX_HOME: path.join(tmpDir, "agent-profiles", "codex", "codex-home"),
            HOME: path.join(tmpDir, "agent-profiles", "codex", "home")
          })
        })
      ]);

      const selected = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "researcher.provider.select",
          payload: { provider: "codex" }
        }
      });
      expect(selected.statusCode, selected.body).toBe(200);

      const tick = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: { command_kind: "arena.tick" }
      });
      expect(tick.statusCode, tick.body).toBe(200);
      const tickBody = tick.json();
      expect(tickBody.operator.researcher_provider.selected_provider).toBe("codex");
      expect(tickBody.result.created_candidate_count).toBeGreaterThan(1);
      expect(tickBody.operator.candidate_arena.latest_ticks[0].direction_results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "created",
            agent_provider: "codex"
          })
        ])
      );

      const invocations = (await readFile(fakeCodexLog, "utf8")).trim().split("\n")
        .map((line) => JSON.parse(line) as {
          args: string[];
          code_home?: string;
          home?: string;
          stdin: string;
        });
      expect(invocations.length).toBeGreaterThan(1);
      expect(invocations.every((call) => call.args[0] === "exec")).toBe(true);
      expect(invocations.every((call) =>
        call.code_home === path.join(tmpDir, "agent-profiles", "codex", "codex-home")
      )).toBe(true);
      expect(invocations.every((call) =>
        call.home === path.join(tmpDir, "agent-profiles", "codex", "home")
      )).toBe(true);
      expect(invocations[0]?.stdin).toContain("Candidate Arena context");
      expect(invocations[0]?.stdin).not.toContain("exit_price");

      const leader = tickBody.operator.candidate_arena.leaderboard[0];
      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${leader.candidate_id}`
      });
      expect(candidate.statusCode, candidate.body).toBe(200);
      expect(candidate.json()).toMatchObject({
        candidate_id: leader.candidate_id,
        materialization_attempt: {
          provider_kind: "codex_cli",
          authority_label: "provider_output_not_evidence"
        },
        full_cycle_lineage: {
          generated: {
            generated_by_agent: true
          }
        }
      });
    } finally {
      await server.close();
    }
  });
});

function fakeCodexScript(logPath: string): string {
  return `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  stdin += chunk;
});
process.stdin.on("end", () => {
  fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify({
    args: process.argv.slice(2),
    cwd: process.cwd(),
    code_home: process.env.CODEX_HOME,
    home: process.env.HOME,
    stdin
  }) + "\\n");
  const runPath = path.join(process.cwd(), "run.py");
  if (fs.existsSync(runPath)) {
    const source = fs.readFileSync(runPath, "utf8");
    const direction = stdin.match(/"requested_direction":"([^"]+)"/)?.[1];
    const risk = direction === "mean_reversion" ? "0.018"
      : direction === "volatility_regime" ? "0.006"
      : direction === "funding_aware_risk" ? "0.014"
      : direction === "execution_cost_robustness" ? "0.01"
      : "0.02";
    fs.writeFileSync(runPath, source.replace(/RISK_FRACTION = [0-9.]+/, "RISK_FRACTION = " + risk));
  }
});
`;
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
      const riskFraction = await declaredArtifactRiskFraction(input.artifact_dir);
      const orderRequest = market.moving_average_fast === market.moving_average_slow
        ? {
            symbol: market.symbol,
            side: "hold" as const,
            quantity: 0,
            order_type: "none" as const,
            reason: "flat replay regime holds through provider validation"
          }
        : {
            symbol: market.symbol,
            side: market.moving_average_fast < market.moving_average_slow ? "sell" as const : "buy" as const,
            quantity: Number((account.equity * Math.min(riskFraction, account.max_risk_fraction) / market.price).toFixed(8)),
            order_type: "market" as const,
            reason: "networkless managed Codex runner preserves TradingApiProvider boundary"
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

async function declaredArtifactRiskFraction(artifactDir: string): Promise<number> {
  const source = await readFile(path.join(artifactDir, "run.py"), "utf8");
  const value = Number(source.match(/RISK_FRACTION = ([0-9.]+)/)?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 0.02;
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
