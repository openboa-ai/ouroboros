import { execFile as execFileCallback } from "node:child_process";
import { access, stat } from "node:fs/promises";
import http from "node:http";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { ResearchWorkerDevelopmentSession } from "./research-worker-session";
import {
  createResearchWorkerToolClient,
  RESEARCH_WORKER_TOOL_MAX_BODY_BYTES,
  startResearchWorkerToolServer,
  type ResearchWorkerToolServerHandle
} from "./research-worker-tool-server";
import type {
  ResearchWorkerDevelopmentEvaluationEvidence,
  ResearchWorkerDevelopmentSubmissionRequest
} from "./types";

const execFileAsync = promisify(execFileCallback);

describe("ResearchWorker session tool server", () => {
  it("uses one session-local IPC endpoint and requires the exact bearer token", async () => {
    const server = await startResearchWorkerToolServer(makeSession());
    try {
      if (process.platform === "win32") {
        expect(server).toMatchObject({
          transport: "loopback_tcp",
          host: "127.0.0.1"
        });
        expect(server.base_url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      } else {
        expect(server).toMatchObject({ transport: "unix_socket" });
        expect(server.socket_path).toMatch(/ouroboros-research-worker-tools-.*\/tool\.sock$/);
        expect(server.base_url).toBeUndefined();
      }
      expect(server.authorization_token).toMatch(/^[A-Za-z0-9_-]{32,}$/);

      expect((await toolRequest(server, "/v1/status")).status).toBe(401);
      expect((await toolRequest(server, "/v1/status", {
        headers: { authorization: `Bearer ${"x".repeat(server.authorization_token.length)}` }
      })).status).toBe(401);
      const response = await toolRequest(server, "/v1/status", {
        headers: authorization(server.authorization_token)
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        session_status: "open",
        submission_limit: 1,
        completed_submission_count: 0,
        remaining_submission_count: 1,
        selected_submission_sequence: null
      });
    } finally {
      await server.close();
    }
  });

  it("accepts only exact routes, methods, JSON fields, and bounded bodies", async () => {
    const session = makeSession();
    const submit = vi.spyOn(session, "submitDevelopment");
    const server = await startResearchWorkerToolServer(session);
    try {
      const headers = {
        ...authorization(server.authorization_token),
        "content-type": "application/json"
      };
      expect((await toolRequest(server, "/v1/status?probe=1", {
        headers: authorization(server.authorization_token)
      })).status).toBe(404);
      expect((await toolRequest(server, "/v1/status", {
        method: "POST",
        headers,
        body: "{}"
      })).status).toBe(405);
      expect((await toolRequest(server, "/v1/development-submissions", {
        method: "POST",
        headers: authorization(server.authorization_token),
        body: "{}"
      })).status).toBe(415);
      expect((await toolRequest(server, "/v1/development-submissions", {
        method: "POST",
        headers,
        body: "{"
      })).status).toBe(400);
      expect((await toolRequest(server, "/v1/development-submissions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          idempotency_key: "exact-fields",
          research_note: "Valid note.",
          unexpected: true
        })
      })).status).toBe(400);
      expect((await toolRequest(server, "/v1/development-submissions", {
        method: "POST",
        headers,
        body: `"${"x".repeat(RESEARCH_WORKER_TOOL_MAX_BODY_BYTES)}"`
      })).status).toBe(413);
      expect(submit).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("preserves serialized idempotency, budget, and terminal guards over HTTP", async () => {
    const evaluate = vi.fn(async (input: ResearchWorkerDevelopmentSubmissionRequest) =>
      evidence(input.submission_sequence, 0.7)
    );
    const session = new ResearchWorkerDevelopmentSession({
      submissionLimit: 1,
      evaluate
    });
    const server = await startResearchWorkerToolServer(session);
    try {
      const request = {
        idempotency_key: "http-submit-one",
        research_note: "One concurrent idempotent submission."
      };
      const [left, right] = await Promise.all([
        post(server, "/v1/development-submissions", request),
        post(server, "/v1/development-submissions", { ...request })
      ]);
      expect(left.status).toBe(200);
      expect(right.status).toBe(200);
      expect(await left.json()).toEqual(await right.json());
      expect(evaluate).toHaveBeenCalledTimes(1);

      expect((await post(server, "/v1/development-submissions", {
        ...request,
        research_note: "Conflicting payload."
      })).status).toBe(409);
      expect((await post(server, "/v1/development-submissions", {
        idempotency_key: "http-over-budget",
        research_note: "Must not evaluate."
      })).status).toBe(429);
      expect(evaluate).toHaveBeenCalledTimes(1);

      const selected = await post(server, "/v1/development-selection", {
        idempotency_key: "http-select-one",
        submission_sequence: 1,
        reason: "Select the completed immutable snapshot."
      });
      expect(selected.status).toBe(200);
      expect(await selected.json()).toMatchObject({
        session_status: "selected",
        submission_sequence: 1
      });
      expect((await post(server, "/v1/finish", {
        idempotency_key: "http-finish-after-selection",
        reason: "Must remain selected."
      })).status).toBe(409);
      expect((await post(server, "/v1/development-submissions", {
        idempotency_key: "http-submit-after-selection",
        research_note: "Must remain closed."
      })).status).toBe(409);
    } finally {
      await server.close();
    }
  });

  it("creates a mode-0600 client that reaches only the session endpoint and removes it", async () => {
    const client = await createResearchWorkerToolClient();
    const server = await startResearchWorkerToolServer(makeSession());
    try {
      expect(client.client_path).toMatch(/ouroboros-research-worker-tools/);
      await expect(access(client.client_path)).resolves.toBeUndefined();
      expect((await stat(client.client_path)).mode & 0o777).toBe(0o600);
      const response = await execFileAsync(process.execPath, [client.client_path, "status"], {
        env: {
          ...process.env,
          OUROBOROS_RESEARCH_TOOL_TOKEN: server.authorization_token,
          ...(server.transport === "unix_socket"
            ? { OUROBOROS_RESEARCH_TOOL_SOCKET_PATH: server.socket_path }
            : { OUROBOROS_RESEARCH_TOOL_BASE_URL: server.base_url })
        }
      });
      expect(JSON.parse(response.stdout)).toMatchObject({ session_status: "open" });
    } finally {
      await server.close();
      await client.close();
    }
    await expect(access(client.client_path)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

function authorization(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

function post(
  server: ResearchWorkerToolServerHandle,
  route: string,
  body: unknown
): Promise<Response> {
  return toolRequest(server, route, {
    method: "POST",
    headers: {
      ...authorization(server.authorization_token),
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function toolRequest(
  server: ResearchWorkerToolServerHandle,
  route: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<Response> {
  if (server.transport === "loopback_tcp") {
    return fetch(`${server.base_url}${route}`, init);
  }
  return new Promise((resolve, reject) => {
    const request = http.request({
      socketPath: server.socket_path,
      path: route,
      method: init.method ?? "GET",
      headers: init.headers
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode ?? 500
      })));
    });
    request.on("error", reject);
    request.end(init.body);
  });
}

function makeSession(): ResearchWorkerDevelopmentSession {
  return new ResearchWorkerDevelopmentSession({
    submissionLimit: 1,
    evaluate: async (input) => evidence(input.submission_sequence, 0.5)
  });
}

function evidence(
  submissionSequence: number,
  score: number
): ResearchWorkerDevelopmentEvaluationEvidence {
  const aggregate = {
    status: "accepted" as const,
    score,
    metrics: [{ name: "aggregate", score, detail: "Aggregate feedback." }],
    summary: "Aggregate feedback.",
    risk_decision: "valid_order_request" as const,
    profit_loss: {
      revenue_usdt: score,
      cost_usdt: 0,
      net_revenue_usdt: score,
      net_return_pct: score
    }
  };
  return {
    submission_sequence: submissionSequence,
    artifact_dir: `/host-only/submission-${submissionSequence}`,
    artifact_digest: `sha256:${String(submissionSequence).padStart(64, "0")}`,
    started_at: "2026-07-13T00:00:00.000Z",
    completed_at: "2026-07-13T00:00:01.000Z",
    evaluation: aggregate,
    feedback: aggregate
  };
}
