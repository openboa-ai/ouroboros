import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {
  ResearchWorkerSessionError,
  type ResearchWorkerSessionErrorCode
} from "./research-worker-session";
import type {
  ResearchWorkerDevelopmentSelectionInput,
  ResearchWorkerDevelopmentSubmissionInput,
  ResearchWorkerFinishInput,
  ResearchWorkerToolPort
} from "./types";

const LOOPBACK_HOST = "127.0.0.1" as const;
const JSON_CONTENT_TYPE = "application/json";
export const RESEARCH_WORKER_TOOL_MAX_BODY_BYTES = 8 * 1024;

interface ResearchWorkerToolServerHandleBase {
  authorization_token: string;
  close(): Promise<void>;
}

export type ResearchWorkerToolServerHandle =
  | ResearchWorkerToolServerHandleBase & {
      transport: "unix_socket";
      socket_path: string;
      host?: never;
      base_url?: never;
    }
  | ResearchWorkerToolServerHandleBase & {
      transport: "loopback_tcp";
      host: typeof LOOPBACK_HOST;
      base_url: string;
      socket_path?: never;
    };

export interface ResearchWorkerToolClientHandle {
  client_path: string;
  close(): Promise<void>;
}

export async function startResearchWorkerToolServer(
  tools: ResearchWorkerToolPort
): Promise<ResearchWorkerToolServerHandle> {
  const authorizationToken = randomBytes(32).toString("base64url");
  const server = toolServer(tools, authorizationToken);
  if (process.platform !== "win32") {
    return startUnixSocketServer(server, authorizationToken);
  }
  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string" || address.address !== LOOPBACK_HOST) {
    await closeServer(server);
    throw new Error("research_worker_tool_server_loopback_bind_failed");
  }
  let closed = false;
  return {
    transport: "loopback_tcp",
    host: LOOPBACK_HOST,
    base_url: `http://${LOOPBACK_HOST}:${address.port}`,
    authorization_token: authorizationToken,
    async close() {
      if (closed) return;
      closed = true;
      await closeServer(server);
    }
  };
}

async function startUnixSocketServer(
  server: http.Server,
  authorizationToken: string
): Promise<ResearchWorkerToolServerHandle> {
  const directory = await mkdtemp(path.join(
    os.tmpdir(),
    "ouroboros-research-worker-tools-"
  ));
  const socketPath = path.join(directory, "tool.sock");
  try {
    await listenUnixSocket(server, socketPath);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  if (server.address() !== socketPath) {
    await closeServer(server);
    await rm(directory, { recursive: true, force: true });
    throw new Error("research_worker_tool_server_unix_bind_failed");
  }
  let closed = false;
  return {
    transport: "unix_socket",
    socket_path: socketPath,
    authorization_token: authorizationToken,
    async close() {
      if (closed) return;
      closed = true;
      try {
        await closeServer(server);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  };
}

function toolServer(
  tools: ResearchWorkerToolPort,
  authorizationToken: string
): http.Server {
  const server = http.createServer((request, response) => {
    void handleRequest(request, response, tools, authorizationToken);
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 1_000;
  return server;
}

export async function createResearchWorkerToolClient(): Promise<ResearchWorkerToolClientHandle> {
  const directory = await mkdtemp(path.join(
    os.tmpdir(),
    "ouroboros-research-worker-tools-"
  ));
  const clientPath = path.join(directory, "research-worker-tool-client.mjs");
  try {
    await writeFile(clientPath, researchWorkerToolClientSource(), {
      encoding: "utf8",
      mode: 0o600
    });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  let closed = false;
  return {
    client_path: clientPath,
    async close() {
      if (closed) return;
      closed = true;
      await rm(directory, { recursive: true, force: true });
    }
  };
}

async function handleRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  tools: ResearchWorkerToolPort,
  authorizationToken: string
): Promise<void> {
  try {
    if (!authorized(request.headers.authorization, authorizationToken)) {
      sendError(response, 401, "research_worker_tool_unauthorized");
      return;
    }
    const route = request.url ?? "";
    const method = request.method ?? "";
    if (route === "/v1/status") {
      if (method !== "GET") {
        response.setHeader("allow", "GET");
        sendError(response, 405, "research_worker_tool_method_not_allowed");
        return;
      }
      sendJson(response, 200, await tools.status());
      return;
    }
    const expectedMethod = route === "/v1/development-submissions" ||
      route === "/v1/development-selection" ||
      route === "/v1/finish"
      ? "POST"
      : undefined;
    if (!expectedMethod) {
      sendError(response, 404, "research_worker_tool_route_not_found");
      return;
    }
    if (method !== expectedMethod) {
      response.setHeader("allow", expectedMethod);
      sendError(response, 405, "research_worker_tool_method_not_allowed");
      return;
    }
    if (request.headers["content-type"] !== JSON_CONTENT_TYPE) {
      sendError(response, 415, "research_worker_tool_json_required");
      return;
    }
    const body = await readJsonBody(request);
    if (route === "/v1/development-submissions") {
      sendJson(response, 200, await tools.submitDevelopment(submissionInput(body)));
      return;
    }
    if (route === "/v1/development-selection") {
      sendJson(response, 200, await tools.selectDevelopment(selectionInput(body)));
      return;
    }
    sendJson(response, 200, await tools.finishWithoutSubmission(finishInput(body)));
  } catch (error) {
    const mapped = mapRequestError(error);
    sendError(response, mapped.status, mapped.code);
  }
}

function authorized(
  provided: string | string[] | undefined,
  authorizationToken: string
): boolean {
  if (typeof provided !== "string") return false;
  const expected = Buffer.from(`Bearer ${authorizationToken}`, "utf8");
  const actual = Buffer.from(provided, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const declaredLength = request.headers["content-length"];
  if (declaredLength !== undefined) {
    const length = Number(declaredLength);
    if (!Number.isInteger(length) || length < 0) {
      throw new ToolRequestError(400, "research_worker_tool_body_invalid");
    }
    if (length > RESEARCH_WORKER_TOOL_MAX_BODY_BYTES) {
      request.resume();
      throw new ToolRequestError(413, "research_worker_tool_body_too_large");
    }
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const content = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += content.length;
    if (size > RESEARCH_WORKER_TOOL_MAX_BODY_BYTES) {
      throw new ToolRequestError(413, "research_worker_tool_body_too_large");
    }
    chunks.push(content);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ToolRequestError(400, "research_worker_tool_body_invalid");
  }
}

function submissionInput(value: unknown): ResearchWorkerDevelopmentSubmissionInput {
  assertExactObject(value, ["idempotency_key", "research_note"]);
  if (typeof value.idempotency_key !== "string" ||
    typeof value.research_note !== "string") {
    throw new ToolRequestError(400, "research_worker_tool_schema_invalid");
  }
  return {
    idempotency_key: value.idempotency_key,
    research_note: value.research_note
  };
}

function selectionInput(value: unknown): ResearchWorkerDevelopmentSelectionInput {
  assertExactObject(value, ["idempotency_key", "submission_sequence", "reason"]);
  if (typeof value.idempotency_key !== "string" ||
    !Number.isInteger(value.submission_sequence) ||
    typeof value.reason !== "string") {
    throw new ToolRequestError(400, "research_worker_tool_schema_invalid");
  }
  return {
    idempotency_key: value.idempotency_key,
    submission_sequence: value.submission_sequence as number,
    reason: value.reason
  };
}

function finishInput(value: unknown): ResearchWorkerFinishInput {
  assertExactObject(value, ["idempotency_key", "reason"]);
  if (typeof value.idempotency_key !== "string" || typeof value.reason !== "string") {
    throw new ToolRequestError(400, "research_worker_tool_schema_invalid");
  }
  return {
    idempotency_key: value.idempotency_key,
    reason: value.reason
  };
}

function assertExactObject(
  value: unknown,
  expectedKeys: readonly string[]
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolRequestError(400, "research_worker_tool_schema_invalid");
  }
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])) {
    throw new ToolRequestError(400, "research_worker_tool_schema_invalid");
  }
}

function mapRequestError(error: unknown): { status: number; code: string } {
  if (error instanceof ToolRequestError) {
    return { status: error.status, code: error.code };
  }
  if (error instanceof ResearchWorkerSessionError) {
    return {
      status: sessionErrorStatus(error.code),
      code: error.code
    };
  }
  return { status: 500, code: "research_worker_tool_internal_error" };
}

function sessionErrorStatus(code: ResearchWorkerSessionErrorCode): number {
  switch (code) {
    case "research_worker_tool_invalid_request":
    case "research_worker_session_invalid_input":
      return 400;
    case "research_worker_tool_submission_not_found":
      return 404;
    case "research_worker_tool_budget_exhausted":
      return 429;
    case "research_worker_tool_idempotency_conflict":
    case "research_worker_tool_session_closed":
    case "research_worker_tool_operation_in_progress":
      return 409;
    case "research_worker_tool_evaluator_evidence_invalid":
      return 500;
  }
}

function sendError(response: http.ServerResponse, status: number, code: string): void {
  sendJson(response, status, { error: { code } });
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  if (response.headersSent || response.destroyed) return;
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": `${JSON_CONTENT_TYPE}; charset=utf-8`,
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, LOOPBACK_HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function listenUnixSocket(server: http.Server, socketPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    server.closeIdleConnections();
  });
}

class ToolRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
    this.name = "ToolRequestError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function researchWorkerToolClientSource(): string {
  return `import http from "node:http";

const routes = {
  status: ["GET", "/v1/status"],
  submit: ["POST", "/v1/development-submissions"],
  select: ["POST", "/v1/development-selection"],
  finish: ["POST", "/v1/finish"]
};
const [command, payloadText, ...rest] = process.argv.slice(2);
const route = routes[command];
const baseUrl = process.env.OUROBOROS_RESEARCH_TOOL_BASE_URL;
const socketPath = process.env.OUROBOROS_RESEARCH_TOOL_SOCKET_PATH;
const token = process.env.OUROBOROS_RESEARCH_TOOL_TOKEN;
if (!route || (!baseUrl && !socketPath) || (baseUrl && socketPath) || !token || rest.length > 0 ||
  (command === "status" ? payloadText !== undefined : payloadText === undefined)) {
  process.stderr.write("research_worker_tool_client_invalid_invocation\\n");
  process.exit(2);
}
let body;
if (payloadText !== undefined) {
  try {
    body = JSON.parse(payloadText);
  } catch {
    process.stderr.write("research_worker_tool_client_invalid_json\\n");
    process.exit(2);
  }
}
const headers = {
  authorization: "Bearer " + token,
  ...(body === undefined ? {} : { "content-type": "application/json" })
};
let options;
if (socketPath) {
  options = { socketPath, path: route[1], method: route[0], headers };
} else {
  const url = new URL(baseUrl + route[1]);
  if (url.protocol !== "http:") {
    process.stderr.write("research_worker_tool_client_invalid_endpoint\\n");
    process.exit(2);
  }
  options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: route[0],
    headers
  };
}
const result = await new Promise((resolve, reject) => {
  const request = http.request(options, (response) => {
    const chunks = [];
    response.on("data", (chunk) => chunks.push(chunk));
    response.on("end", () => resolve({
      status: response.statusCode ?? 500,
      body: Buffer.concat(chunks).toString("utf8")
    }));
  });
  request.on("error", reject);
  if (body !== undefined) request.write(JSON.stringify(body));
  request.end();
}).catch(() => {
  process.stderr.write("research_worker_tool_client_request_failed\\n");
  process.exit(1);
});
if (result.status < 200 || result.status >= 300) {
  const responseText = result.body;
  process.stderr.write(responseText + "\\n");
  process.exit(1);
}
process.stdout.write(result.body + "\\n");
`;
}
