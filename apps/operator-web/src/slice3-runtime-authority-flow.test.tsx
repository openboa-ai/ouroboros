import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CandidateInspectReadModel,
  ExecutionAttemptRecord,
  GatewayDecisionRecord,
  OrderIntentDraftRecord,
  StageBindingRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { buildServer } from "../../runtime/src/server";
import { CandidateDetail } from "./App";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-slice3-authority-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Slice 3 runtime authority MLP flow", () => {
  it("records dry-run authority through runtime API and renders bounded operator state", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({ store });

    try {
      const initialRead = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(initialRead.statusCode).toBe(200);
      const initialCandidate = initialRead.json() as CandidateInspectReadModel;
      expect(initialCandidate.runtime.bounded_authority).toMatchObject({
        has_activity: false,
        chain_complete: false
      });

      const payload = {
        idempotency_key: "slice3-mlp-runtime-authority",
        candidate_version_id: initialCandidate.candidate_version.candidate_version_id,
        intent: {
          intent_kind: "place_order",
          side: "buy",
          order_type: "limit",
          quantity: "0.001",
          limit_price: "60000"
        },
        gateway_decision: {
          decision_outcome: "dry_run_only",
          decision_reason: "paper_stage_only",
          policy_ref: {
            record_kind: "runtime_operating_policy",
            id: "runtime-operating-policy-paper-v1"
          }
        },
        execution_attempt: {
          execution_mode: "host_local",
          trace_ref: {
            record_kind: "trace_placeholder",
            id: "trace-slice3-mlp-runtime-authority"
          },
          completed_at: "2026-05-10T00:01:00.000Z"
        },
        created_at: "2026-05-10T00:00:00.000Z"
      };

      const recorded = await server.inject({
        method: "POST",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-authority`,
        payload
      });
      const duplicate = await server.inject({
        method: "POST",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-authority`,
        payload
      });
      expect(recorded.statusCode).toBe(201);
      expect(duplicate.statusCode).toBe(201);
      expect(duplicate.json()).toEqual(recorded.json());

      const outcome = recorded.json();
      expect(outcome).toMatchObject({
        status: "recorded",
        order_intent_draft: {
          status: "proposed",
          authority_status: "not_submitted"
        },
        gateway_decision: {
          decision_outcome: "dry_run_only",
          decision_reason: "paper_stage_only",
          authority_status: "dry_run_only"
        },
        execution_attempt: {
          stage: "paper",
          execution_mode: "host_local",
          status: "dry_run_recorded",
          authority_status: "dry_run_only"
        }
      });

      const orderIntent = await readStoreJson<OrderIntentDraftRecord>(
        "order-intent-drafts",
        "items",
        `${outcome.order_intent_draft.order_intent_draft_id}.json`
      );
      const gatewayDecision = await readStoreJson<GatewayDecisionRecord>(
        "gateway-decisions",
        "items",
        `${outcome.gateway_decision.gateway_decision_id}.json`
      );
      const executionAttempt = await readStoreJson<ExecutionAttemptRecord>(
        "execution-attempts",
        "items",
        `${outcome.execution_attempt.execution_attempt_id}.json`
      );
      const stageBinding = await readStoreJson<StageBindingRecord>(
        "stage-bindings",
        "items",
        `${orderIntent.stage_binding_ref.id}.json`
      );

      expect(orderIntent.runtime_ref.id).toBe(initialCandidate.runtime.ref.id);
      expect(gatewayDecision.order_intent_draft_ref.id).toBe(orderIntent.order_intent_draft_id);
      expect(executionAttempt.gateway_decision_ref.id).toBe(gatewayDecision.gateway_decision_id);
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
      expect(candidate.runtime.bounded_authority).toMatchObject({
        has_activity: true,
        chain_complete: true,
        latest_order_intent_draft: {
          order_intent_draft_id: orderIntent.order_intent_draft_id,
          authority_status: "not_submitted"
        },
        latest_gateway_decision: {
          gateway_decision_id: gatewayDecision.gateway_decision_id,
          authority_status: "dry_run_only"
        },
        latest_execution_attempt: {
          execution_attempt_id: executionAttempt.execution_attempt_id,
          authority_status: "dry_run_only"
        }
      });

      const html = renderToStaticMarkup(
        <CandidateDetail candidate={candidate} onRecordRuntimeAuthority={() => undefined} />
      );
      expect(html).toContain("Runtime Authority");
      expect(html).toContain("chain complete");
      expect(html).toContain("dry_run_only");
      expect(html).toContain("paper_stage_only");
      expect(html).toContain(`order_intent_draft:${orderIntent.order_intent_draft_id}`);
      expect(html).toContain(`gateway_decision:${gatewayDecision.gateway_decision_id}`);
      expect(html).toContain("Record dry-run intent");
      expect(html).not.toMatch(/Start|Pause|Resume|Stop|Promote|Run provider|Run evaluator|Live order/i);
      expect(html).not.toMatch(/broker|api key|secret|runtime stack launch/i);
    } finally {
      await server.close();
    }
  });
});

async function readStoreJson<T>(...segments: string[]): Promise<T> {
  const text = await readFile(path.join(tmpDir, ...segments), "utf8");
  return JSON.parse(text) as T;
}
