import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CandidateInspectReadModel,
  ExecutionResultRecord,
  GatewayResultRecord,
  OrderRequestRecord,
  StageBindingRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { buildServer } from "../../runtime/src/server";
import { expectNoOperatorActionControls } from "../../../test/support/binance-no-authority";
import { CandidateDetail } from "./App";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-slice3-authority-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Slice 3 trading run MLP flow", () => {
  it("records a dry-run trading run through runtime API and renders Ledger state", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({ store });

    try {
      const initialRead = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(initialRead.statusCode).toBe(200);
      const initialCandidate = initialRead.json() as CandidateInspectReadModel;
      expect(initialCandidate.ledger).toMatchObject({
        ledger_kind: "ledger",
        has_activity: false,
        chain_complete: false
      });

      const recorded = await server.inject({
        method: "POST",
        url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/trading-runs`
      });
      const duplicate = await server.inject({
        method: "POST",
        url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/trading-runs`
      });
      expect(recorded.statusCode).toBe(201);
      expect(duplicate.statusCode).toBe(201);
      expect(duplicate.json()).toEqual(recorded.json());

      const outcome = recorded.json();
      expect(outcome).toMatchObject({
        status: "started",
        trading_run: {
          lifecycle_status: "running",
          authority_status: "not_live"
        },
        run_control: {
          latest_command: {
            action: "start",
            status: "decided"
          },
          latest_decision: {
            resulting_lifecycle_status: "running"
          }
        },
        order_request: {
          intent_kind: "place_order",
          side: "buy",
          order_type: "limit",
          quantity: "0.001",
          limit_price: "60000",
          status: "proposed",
          authority_status: "not_submitted"
        },
        gateway_result: {
          decision_outcome: "dry_run_only",
          decision_reason: "paper_stage_only",
          authority_status: "dry_run_only"
        },
        execution_result: {
          stage: "paper",
          execution_mode: "host_local",
          status: "dry_run_recorded",
          authority_status: "dry_run_only"
        },
        ledger: {
          ledger_kind: "ledger",
          chain_complete: true
        },
        sandbox: {
          adapter_kind: "deterministic_test",
          lifecycle_status: "running",
          authority_status: "not_live"
        },
        transcript: {
          transcript_kind: "trading_run_transcript",
          has_activity: true,
          authority_status: "not_live"
        }
      });
      expect(outcome.transcript.item_count).toBeGreaterThanOrEqual(9);
      expect(outcome.sandbox.runtime_ref.id).toBe(outcome.trading_run_id);
      expect(outcome.sandbox.logs[0].lines.join("\n")).toContain("runtime_heartbeat");
      expect(outcome.transcript.items.map((item: { item_kind: string }) => item.item_kind)).toEqual(
        expect.arrayContaining(["order_request", "gateway_result", "execution_result", "sandbox_heartbeat"])
      );

      const orderIntent = await readStoreJson<OrderRequestRecord>(
        "order-requests",
        "items",
        `${outcome.order_request.order_request_id}.json`
      );
      const gatewayDecision = await readStoreJson<GatewayResultRecord>(
        "gateway-results",
        "items",
        `${outcome.gateway_result.gateway_result_id}.json`
      );
      const executionAttempt = await readStoreJson<ExecutionResultRecord>(
        "execution-results",
        "items",
        `${outcome.execution_result.execution_result_id}.json`
      );
      const stageBinding = await readStoreJson<StageBindingRecord>(
        "stage-bindings",
        "items",
        `${orderIntent.stage_binding_ref.id}.json`
      );

      expect(orderIntent.runtime_ref.id).toBe(initialCandidate.runtime.ref.id);
      expect(gatewayDecision.order_request_ref.id).toBe(orderIntent.order_request_id);
      expect(executionAttempt.gateway_result_ref.id).toBe(gatewayDecision.gateway_result_id);
      expect(stageBinding).toMatchObject({
        stage: "paper",
        profile: "paper",
        execution_mode: "host_local",
        authority_status: "not_live"
      });

      await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
      await store.rebuildProjections();

      const readback = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(readback.statusCode).toBe(200);
      const candidate = readback.json() as CandidateInspectReadModel;
      expect(candidate.runtime.runtime_lifecycle_status).toBe("running");
      expect(candidate.runtime.run_control).toBeDefined();
      expect(candidate.runtime.run_control?.latest_command).toMatchObject({
        action: "start",
        status: "decided"
      });
      expect(candidate.runtime.sandbox).toMatchObject({
        sandbox_id: outcome.sandbox.sandbox_id,
        lifecycle_status: "running"
      });
      expect(candidate.runtime.transcript).toMatchObject({
        authority_status: "not_live"
      });
      expect(candidate.runtime.transcript?.item_count).toBeGreaterThanOrEqual(9);
      expect(candidate.ledger).toMatchObject({
        ledger_kind: "ledger",
        has_activity: true,
        chain_complete: true,
        latest_order_request: {
          order_request_id: orderIntent.order_request_id,
          authority_status: "not_submitted"
        },
        latest_gateway_result: {
          gateway_result_id: gatewayDecision.gateway_result_id,
          authority_status: "dry_run_only"
        },
        latest_execution_result: {
          execution_result_id: executionAttempt.execution_result_id,
          authority_status: "dry_run_only"
        }
      });

      const html = renderToStaticMarkup(
        <CandidateDetail
          candidate={candidate}
          onStartTradingRun={() => undefined}
          onObserveTradingRun={() => undefined}
          onStopTradingRun={() => undefined}
        />
      );
      expect(html).toContain("Ledger");
      expect(html).toContain("Ledger");
      expect(html).toContain("chain complete");
      expect(html).toContain("dry_run_only");
      expect(html).toContain("paper_stage_only");
      expect(html).toContain(`order_request:${outcome.order_request.order_request_id}`);
      expect(html).toContain(`gateway_result:${outcome.gateway_result.gateway_result_id}`);
      expect(html).toContain("running");
      expect(html).toContain("Trading Run Transcript");
      expect(html).toContain("Sandbox heartbeat");
      expect(html).toContain("Order request");
      expect(html).toContain("Sandbox");
      expect(html).toContain("deterministic_test");
      expect(html).toContain("runtime_heartbeat");
      expect(html).toContain("Start trading run");
      expect(html).toContain("Observe");
      expect(html).toContain("Stop");
      expectNoOperatorActionControls(html, {
        includePrivateAuthorityTerms: true,
        allowTradingRunControls: true
      });
      expect(html).not.toMatch(/runtime stack launch/i);

      const observed = await server.inject({
        method: "POST",
        url: `/api/trading-runs/${candidate.runtime.ref.id}/observe`
      });
      expect(observed.statusCode).toBe(200);
      expect(observed.json()).toMatchObject({
        status: "observed",
        trading_run: {
          lifecycle_status: "running"
        },
        ledger: {
          chain_complete: true
        },
        sandbox: {
          lifecycle_status: "running"
        },
        transcript: {
          authority_status: "not_live"
        }
      });
      expect(observed.json().transcript.item_count).toBeGreaterThanOrEqual(9);

      const stopped = await server.inject({
        method: "POST",
        url: `/api/trading-runs/${candidate.runtime.ref.id}/stop`
      });
      expect(stopped.statusCode).toBe(201);
      expect(stopped.json()).toMatchObject({
        status: "stopped",
        trading_run: {
          lifecycle_status: "stopped"
        },
        run_control: {
          latest_command: {
            action: "stop"
          }
        },
        sandbox: {
          sandbox_id: outcome.sandbox.sandbox_id,
          lifecycle_status: "stopped"
        },
        transcript: {
          has_activity: true
        }
      });
      expect(stopped.json().transcript.items
        .some((item: { summary: string }) => item.summary.includes("runtime_stopped")))
        .toBe(true);

      const stoppedRead = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      const stoppedCandidate = stoppedRead.json() as CandidateInspectReadModel;
      const stoppedHtml = renderToStaticMarkup(
        <CandidateDetail
          candidate={stoppedCandidate}
          onStartTradingRun={() => undefined}
          onObserveTradingRun={() => undefined}
          onStopTradingRun={() => undefined}
        />
      );
      expect(stoppedHtml).toContain("stopped");
      expect(stoppedHtml).toContain("Trading Run Transcript");
      expect(stoppedHtml).toContain("runtime_stopped");
      expect(stoppedHtml).toContain("Latest control command");
    } finally {
      await server.close();
    }
  });
});

async function readStoreJson<T>(...segments: string[]): Promise<T> {
  const text = await readFile(path.join(tmpDir, ...segments), "utf8");
  return JSON.parse(text) as T;
}
