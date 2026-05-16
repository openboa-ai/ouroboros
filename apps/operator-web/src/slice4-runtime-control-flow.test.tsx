import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CandidateInspectReadModel,
  RuntimeAuditEventRecord,
  RuntimeControlCommandRecord,
  RuntimeControlDecisionRecord,
  TradingSystemRuntimeRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { buildServer } from "../../runtime/src/server";
import { CandidateDetail } from "./App";
import { runtimeControlPausePayload } from "./api";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-slice4-control-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Slice 4 runtime control MLP flow", () => {
  it("records pause control through runtime API and renders auditable operator state", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({ store });

    try {
      const initialRead = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(initialRead.statusCode).toBe(200);
      const initialCandidate = initialRead.json() as CandidateInspectReadModel;
      expect(initialCandidate.runtime.runtime_control).toMatchObject({
        has_activity: false,
        chain_complete: false
      });

      const payload = {
        ...runtimeControlPausePayload(initialCandidate),
        idempotency_key: "slice4-mlp-runtime-control-pause"
      };
      const recorded = await server.inject({
        method: "POST",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
        payload
      });
      const duplicate = await server.inject({
        method: "POST",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/runtime-control`,
        payload
      });

      expect(recorded.statusCode).toBe(201);
      expect(duplicate.statusCode).toBe(201);
      expect(duplicate.json()).toEqual(recorded.json());
      expect(recorded.json()).toMatchObject({
        status: "recorded",
        command: {
          action: "pause",
          status: "decided",
          authority_status: "control_only"
        },
        decision: {
          decision_outcome: "allowed",
          decision_reason: "policy_allows_control",
          resulting_lifecycle_status: "paused",
          authority_status: "control_only"
        },
        audit_event: {
          event_kind: "runtime_lifecycle_transitioned",
          runtime_lifecycle_status: "paused",
          authority_status: "audit_only"
        }
      });

      const outcome = recorded.json();
      const command = await readStoreJson<RuntimeControlCommandRecord>(
        "runtime-control-commands",
        "items",
        `${outcome.command.runtime_control_command_id}.json`
      );
      const decision = await readStoreJson<RuntimeControlDecisionRecord>(
        "runtime-control-decisions",
        "items",
        `${outcome.decision.runtime_control_decision_id}.json`
      );
      const auditEvent = await readStoreJson<RuntimeAuditEventRecord>(
        "runtime-audit-events",
        "items",
        `${outcome.audit_event.runtime_audit_event_id}.json`
      );
      const runtime = await readStoreJson<TradingSystemRuntimeRecord>(
        "trading-system-runtimes",
        "items",
        `${initialCandidate.runtime.ref.id}.json`
      );

      expect(command.runtime_ref).toEqual(initialCandidate.runtime.ref);
      expect(command.runtime_ref.id).not.toBe(initialCandidate.runtime.placement.ref.id);
      expect(decision.command_ref).toEqual({
        record_kind: "runtime_control_command",
        id: command.runtime_control_command_id
      });
      expect(auditEvent.command_ref).toEqual(decision.command_ref);
      expect(auditEvent.decision_ref).toEqual({
        record_kind: "runtime_control_decision",
        id: decision.runtime_control_decision_id
      });
      expect(auditEvent.supporting_record_refs).toEqual([
        { record_kind: "runtime_control_command", id: command.runtime_control_command_id },
        { record_kind: "runtime_control_decision", id: decision.runtime_control_decision_id }
      ]);
      expect(runtime.runtime_lifecycle_status).toBe("paused");
      expect(runtime.runtime_control_command_refs).toEqual([
        { record_kind: "runtime_control_command", id: command.runtime_control_command_id }
      ]);
      expect(runtime.runtime_control_decision_refs).toEqual([
        { record_kind: "runtime_control_decision", id: decision.runtime_control_decision_id }
      ]);
      expect(runtime.runtime_audit_event_refs).toEqual([
        { record_kind: "runtime_audit_event", id: auditEvent.runtime_audit_event_id }
      ]);

      await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
      await store.rebuildProjections();

      const readback = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(readback.statusCode).toBe(200);
      const candidate = readback.json() as CandidateInspectReadModel;
      expect(candidate.runtime.runtime_control).toMatchObject({
        has_activity: true,
        chain_complete: true,
        latest_command: {
          command_id: command.runtime_control_command_id,
          action: "pause",
          status: "decided",
          authority_status: "control_only"
        },
        latest_decision: {
          decision_id: decision.runtime_control_decision_id,
          decision_outcome: "allowed",
          resulting_lifecycle_status: "paused",
          authority_status: "control_only"
        },
        latest_audit_event: {
          audit_event_id: auditEvent.runtime_audit_event_id,
          event_kind: "runtime_lifecycle_transitioned",
          runtime_lifecycle_status: "paused",
          authority_status: "audit_only"
        }
      });
      expect(candidate.runtime.placement.authority_status).toBe("not_launched");
      expect(JSON.stringify(candidate.runtime.runtime_control)).not.toMatch(
        /exchange_credentials|provider_api_key|direct_exchange_order|gateway_signing_material/
      );

      const html = renderToStaticMarkup(
        <CandidateDetail candidate={candidate} onRecordRuntimeControl={() => undefined} />
      );
      expect(html).toContain("Runtime Control");
      expect(html).toContain("Logical TradingSystemRuntime state");
      expect(html).toContain("chain complete");
      expect(html).toContain("pause");
      expect(html).toContain("allowed");
      expect(html).toContain("policy_allows_control");
      expect(html).toContain("runtime_lifecycle_transitioned");
      expect(html).toContain(`runtime_control_command:${command.runtime_control_command_id}`);
      expect(html).toContain(`runtime_control_decision:${decision.runtime_control_decision_id}`);
      expect(html).toContain("Record pause control");
      expect(html).toContain("control_only / audit_only / not_live");
      expect(html).not.toMatch(/\b(Start|Resume|Stop|Promote)\b|Run provider|Run evaluator|Live order/i);
      expect(html).not.toMatch(/broker|provider_api_key|direct_exchange_order|gateway_signing_material/i);
      expect(html).not.toMatch(/\/runtime-control\/(pause|kill|start)/i);
    } finally {
      await server.close();
    }
  });
});

async function readStoreJson<T>(...segments: string[]): Promise<T> {
  const text = await readFile(path.join(tmpDir, ...segments), "utf8");
  return JSON.parse(text) as T;
}
