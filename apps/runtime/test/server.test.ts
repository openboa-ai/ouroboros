import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { OUROBOROS_COMMAND_KINDS } from "@ouroboros/domain";
import { buildServer } from "../src/server";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("runtime canonical operator API", () => {
  it("serves health, operator state, resource reads, and no removed public routes", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });

    try {
      const health = await server.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toMatchObject({
        status: "ok",
        service: "ouroboros-runtime",
        trading_gateway_environment: {
          authority_status: "not_live"
        }
      });

      const gateway = await server.inject({ method: "GET", url: "/api/gateway/environment" });
      expect(gateway.statusCode).toBe(200);
      expect(gateway.json()).toMatchObject({
        trading_gateway_environment: {
          runtime_environment: "paper",
          live_exchange_authority: false,
          order_submission_authority: false,
          authority_status: "not_live"
        }
      });

      const operator = await server.inject({ method: "GET", url: "/api/operator" });
      expect(operator.statusCode).toBe(200);
      expect(operator.json()).toMatchObject({
        operator: {
          command_descriptors: expect.arrayContaining(
            OUROBOROS_COMMAND_KINDS.map((commandKind) => expect.objectContaining({
              command_kind: commandKind
            }))
          ),
          candidate_arena: {
            runner_status: "stopped",
            authority_status: "not_live"
          },
          selected_candidate_id: null,
          live_disabled: true,
          authority_status: "not_live"
        }
      });

      const candidates = await server.inject({ method: "GET", url: "/api/candidates" });
      expect(candidates.statusCode).toBe(200);
      expect(candidates.json().candidates.map((candidate: { candidate_id: string }) => candidate.candidate_id))
        .toContain(FIXTURE_CANDIDATE_ID);

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode).toBe(200);
      expect(candidate.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID,
        ledger: {
          has_activity: false
        }
      });

      const evaluations = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluations`
      });
      expect(evaluations.statusCode).toBe(200);
      expect(evaluations.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID,
        evaluations: expect.any(Array)
      });

      for (const url of [
        "/api/candidate-arena",
        `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`,
        "/api/candidate-generation-runs",
        "/api/candidate-materialization-attempts",
        "/api/trading-gateway/environment",
        "/api/trading-research/runtime"
      ]) {
        const response = await server.inject({ method: "GET", url });
        expect(response.statusCode).toBe(404);
      }
    } finally {
      await server.close();
    }
  });

  it("runs user mutations through /api/commands and reflects them in /api/operator", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    try {
      const status = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: { command_kind: "arena.status" }
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        command: {
          command_kind: "arena.status",
          status: "succeeded"
        },
        operator: {
          candidate_arena: {
            authority_status: "not_live"
          }
        }
      });

      const selected = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(selected.statusCode).toBe(200);
      expect(selected.json()).toMatchObject({
        command: {
          command_kind: "candidate.select",
          status: "succeeded"
        },
        operator: {
          selected_candidate_id: FIXTURE_CANDIDATE_ID,
          selected_candidate: {
            candidate_id: FIXTURE_CANDIDATE_ID
          },
          selected_paper_evidence: {
            status: "not_run",
            authority_status: "not_live"
          }
        }
      });

      const evidence = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.paper_evidence.run",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(evidence.statusCode, evidence.body).toBe(200);
      expect(evidence.json()).toMatchObject({
        command: {
          command_kind: "candidate.paper_evidence.run",
          status: "succeeded"
        },
        operator: {
          selected_candidate_id: FIXTURE_CANDIDATE_ID,
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
            authority_status: "not_live"
          }
        }
      });

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode).toBe(200);
      expect(candidate.json()).toMatchObject({
        ledger: {
          has_activity: true,
          chain_complete: true
        }
      });
    } finally {
      await server.close();
    }
  });

  it("runs candidate evaluation through the command endpoint and exposes evaluation resources", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    try {
      const created = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.evaluation.run",
          payload: {
            candidate_id: FIXTURE_CANDIDATE_ID,
            idempotency_key: "runtime-test-canonical-evaluation"
          }
        }
      });
      expect(created.statusCode, created.body).toBe(200);
      expect(created.json()).toMatchObject({
        command: {
          command_kind: "candidate.evaluation.run",
          status: "succeeded"
        }
      });

      const evaluationId = created.json().result.evaluation.evaluation_run.evaluation_run_record_id;
      const evaluation = await server.inject({
        method: "GET",
        url: `/api/evaluations/${evaluationId}`
      });
      expect(evaluation.statusCode).toBe(200);
      expect(evaluation.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID,
        evaluation_run: {
          evaluation_run_record_id: evaluationId
        }
      });
    } finally {
      await server.close();
    }
  });
});
