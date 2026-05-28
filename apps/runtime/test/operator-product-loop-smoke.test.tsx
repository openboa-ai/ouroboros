import React from "react";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderToString } from "ink";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runOuroborosCli } from "@ouroboros/cli";
import type {
  CandidateArenaReadModel,
  OperatorReadModel,
  OuroborosCommandKind,
  OuroborosCommandRequest
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { OperatorTuiScreen } from "@ouroboros/operator-tui";
import { buildServer } from "../src/server";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-product-loop-smoke-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("operator product loop smoke", () => {
  it("runs status, provider setup, arena tick, selection, paper evidence, and readback through shared surfaces", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const runtimeBaseUrl = "http://runtime.test";
    const fetcher = serverFetch(server);

    try {
      const initialStatus = await runOuroborosCli(["status"], {
        runtimeBaseUrl,
        fetch: fetcher
      });
      expect(initialStatus.exitCode, initialStatus.stderr).toBe(0);
      expect(initialStatus.stdout).toContain("Ouroboros status");
      expect(initialStatus.stdout).toContain("Arena: stopped");
      expect(initialStatus.stdout).toContain("Selected candidate: none");
      expect(initialStatus.stdout).toContain("Paper evidence: not_run");
      expect(initialStatus.stdout).toContain("Live authority: disabled / not_live");

      await postCommand(server, {
        command_kind: "agent_provider.setup",
        payload: { provider: "fixture" }
      });
      const probed = await postCommand(server, {
        command_kind: "agent_provider.probe",
        payload: { provider: "fixture" }
      });
      expect(probed.operator.agent_profiles).toContainEqual(expect.objectContaining({
        provider: "fixture",
        status: "authenticated",
        authority_status: "no_trading_authority"
      }));

      const providerSelected = await runOuroborosCli(
        ["researcher", "provider", "set", "fixture"],
        { runtimeBaseUrl, fetch: fetcher }
      );
      expect(providerSelected.exitCode, providerSelected.stderr).toBe(0);
      expect(providerSelected.stdout).toContain("OK Researcher provider selected: fixture.");

      const tick = await runOuroborosCli(["arena", "tick", "--json"], {
        runtimeBaseUrl,
        fetch: fetcher
      });
      expect(tick.exitCode, tick.stderr).toBe(0);
      const tickBody = JSON.parse(tick.stdout) as {
        result: {
          created_candidate_count: number;
          created_candidate_ids: string[];
          arena: CandidateArenaReadModel;
        };
        operator: OperatorReadModel;
      };
      expect(
        tickBody.result.created_candidate_count,
        JSON.stringify(tickBody.result.arena.latest_ticks[0]?.direction_results, null, 2)
      ).toBeGreaterThan(1);
      expect(tickBody.result.created_candidate_ids).not.toContain(FIXTURE_CANDIDATE_ID);
      expect(tickBody.operator.candidate_arena.leaderboard.length).toBeGreaterThanOrEqual(
        tickBody.result.created_candidate_count
      );
      expect(sortedByNetRevenue(tickBody.operator.candidate_arena)).toBe(true);
      expect(tickBody.operator.candidate_arena.latest_ticks[0]).toMatchObject({
        status: "completed",
        authority_status: "not_live"
      });

      const leader = tickBody.operator.candidate_arena.leaderboard[0]!;
      const selected = await runOuroborosCli(
        ["candidate", "select", leader.candidate_id, "--json"],
        { runtimeBaseUrl, fetch: fetcher }
      );
      expect(selected.exitCode, selected.stderr).toBe(0);
      const selectedBody = JSON.parse(selected.stdout) as { operator: OperatorReadModel };
      expect(selectedBody.operator.selected_candidate_id).toBe(leader.candidate_id);
      expect(selectedBody.operator.selected_paper_evidence).toMatchObject({
        status: "not_run",
        ledger_chain_complete: false,
        authority_status: "not_live"
      });

      const evidence = await runOuroborosCli(
        ["candidate", "evidence", "run", leader.candidate_id, "--json"],
        { runtimeBaseUrl, fetch: fetcher }
      );
      expect(evidence.exitCode, evidence.stderr).toBe(0);
      const evidenceBody = JSON.parse(evidence.stdout) as { operator: OperatorReadModel };
      expect(evidenceBody.operator).toMatchObject({
        selected_candidate_id: leader.candidate_id,
        selected_paper_evidence: {
          status: "ledger_chain_complete",
          ledger_chain_complete: true,
          ledger_chain_count: expect.any(Number),
          latest_order_request_id: expect.any(String),
          latest_gateway_outcome: "dry_run_only",
          latest_execution_status: "dry_run_recorded",
          authority_status: "not_live"
        },
        live_disabled: true,
        authority_status: "not_live"
      });

      const finalStatus = await runOuroborosCli(["--json", "status"], {
        runtimeBaseUrl,
        fetch: fetcher
      });
      expect(finalStatus.exitCode, finalStatus.stderr).toBe(0);
      const finalOperator = JSON.parse(finalStatus.stdout) as OperatorReadModel;
      expect(finalOperator.selected_paper_evidence).toMatchObject({
        status: "ledger_chain_complete",
        ledger_chain_complete: true,
        latest_order_request_id: expect.any(String),
        latest_gateway_outcome: "dry_run_only",
        latest_execution_status: "dry_run_recorded",
        authority_status: "not_live"
      });
      expect(finalOperator.latest_commands.map((command) => command.command_kind)).toEqual(
        expect.arrayContaining([
          "arena.tick",
          "candidate.select",
          "candidate.paper_evidence.run",
          "researcher.provider.select"
        ])
      );

      const restartedServer = await buildServer({ store: new LocalStore(tmpDir) });
      try {
        const restartedOperator = await restartedServer.inject({
          method: "GET",
          url: "/api/operator"
        });
        expect(restartedOperator.statusCode, restartedOperator.body).toBe(200);
        expect(restartedOperator.json().operator).toMatchObject({
          selected_candidate_id: leader.candidate_id,
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
            latest_gateway_outcome: "dry_run_only",
            latest_execution_status: "dry_run_recorded",
            authority_status: "not_live"
          }
        });
      } finally {
        await restartedServer.close();
      }

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${leader.candidate_id}`
      });
      expect(candidate.statusCode, candidate.body).toBe(200);
      expect(candidate.json()).toMatchObject({
        candidate_id: leader.candidate_id,
        ledger: {
          has_activity: true,
          chain_complete: true,
          authority_status: "not_live"
        }
      });

      const tui = renderToString(
        <OperatorTuiScreen
          operator={finalOperator}
          cursor={0}
          message="product loop smoke"
        />
      );
      expect(tui).toContain("Ouroboros Action Console");
      expect(tui).toContain("Researcher provider: fixture");
      expect(tui).toContain("Authority: not_live / live disabled");
      expect(tui).toContain(`Selected Candidate\n${leader.candidate_id}`);
      expect(tui).toContain("Paper evidence: ledger_chain_complete");
      expect(tui).toContain("Ledger chain: complete");
      expect(tui).toContain("candidate.paper_evidence.run: succeeded");
    } finally {
      await server.close();
    }
  });
});

function sortedByNetRevenue(arena: CandidateArenaReadModel): boolean {
  return arena.leaderboard.every((entry, index, entries) =>
    index === 0
      || entries[index - 1]!.profit_loss.net_revenue_usdt >= entry.profit_loss.net_revenue_usdt
  );
}

async function postCommand(
  server: Awaited<ReturnType<typeof buildServer>>,
  request: OuroborosCommandRequest
): Promise<{
  command: { command_kind: OuroborosCommandKind; status: string };
  operator: OperatorReadModel;
}> {
  const response = await server.inject({
    method: "POST",
    url: "/api/commands",
    payload: request
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}

function serverFetch(server: Awaited<ReturnType<typeof buildServer>>) {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const payload = init?.body ? JSON.parse(String(init.body)) : undefined;
    const method = init?.method === "POST" ? "POST" : "GET";
    const response = await server.inject({
      method,
      url: `${url.pathname}${url.search}`,
      payload
    });
    return {
      ok: response.statusCode >= 200 && response.statusCode < 300,
      status: response.statusCode,
      json: async () => response.json(),
      text: async () => response.body
    } as unknown as Response;
  };
}
