import type { FastifyInstance, FastifyReply, RouteShorthandOptions } from "fastify";

export interface RuntimeControllerResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

export interface ResourceControllerRoutesContext {
  filesystemReadRateLimit: object;
  operatorApiAuthPreHandler: RouteShorthandOptions["preHandler"];
  readOrderFillLatest(query: { venue?: string; instrument?: string }): Promise<RuntimeControllerResponse>;
  readPublicMarketLatest(query: { venue?: string; instrument?: string }): Promise<RuntimeControllerResponse>;
  readPrivateReadinessLatest(query: { venue?: string; instrument?: string }): Promise<RuntimeControllerResponse>;
  readPrivateReadinessPostureLatest(query: { venue?: string; instrument?: string }): Promise<RuntimeControllerResponse>;
  readAccountPositionRiskLatest(query: { venue?: string; instrument?: string }): Promise<RuntimeControllerResponse>;
  listCandidates(): Promise<RuntimeControllerResponse>;
  getCandidate(candidateId: string): Promise<RuntimeControllerResponse>;
  listCandidateEvaluations(candidateId: string): Promise<RuntimeControllerResponse>;
  listCandidateReplayRuns(candidateId: string, query: { limit?: string }): Promise<RuntimeControllerResponse>;
  getReplayRun(runId: string, query: { candidate_id?: string }): Promise<RuntimeControllerResponse>;
  getReplayRunValidationState(
    runId: string,
    query: { candidate_id?: string; baseline_run_id?: string }
  ): Promise<RuntimeControllerResponse>;
  getReplayRunComparison(
    runId: string,
    query: { candidate_id?: string; baseline_run_id?: string }
  ): Promise<RuntimeControllerResponse>;
  getTradingRun(runId: string): Promise<RuntimeControllerResponse>;
  getEvaluation(evaluationId: string): Promise<RuntimeControllerResponse>;
  listSandboxes(): Promise<RuntimeControllerResponse>;
  getSandbox(sandboxId: string): Promise<RuntimeControllerResponse>;
  getSandboxLogs(sandboxId: string): Promise<RuntimeControllerResponse>;
}

export function registerResourceControllerRoutes(context: ResourceControllerRoutesContext) {
  return (server: FastifyInstance): void => {
    const readOptions = authRouteOptions(context.filesystemReadRateLimit, context.operatorApiAuthPreHandler);
    server.get<{ Querystring: { venue?: string; instrument?: string } }>(
      "/api/trading-substrate/order-fill/latest",
      readOptions,
      async (request, reply) => send(reply, await context.readOrderFillLatest(request.query))
    );
    server.get<{ Querystring: { venue?: string; instrument?: string } }>(
      "/api/trading-substrate/public-market/latest",
      readOptions,
      async (request, reply) => send(reply, await context.readPublicMarketLatest(request.query))
    );
    server.get<{ Querystring: { venue?: string; instrument?: string } }>(
      "/api/trading-substrate/private-readiness/latest",
      readOptions,
      async (request, reply) => send(reply, await context.readPrivateReadinessLatest(request.query))
    );
    server.get<{ Querystring: { venue?: string; instrument?: string } }>(
      "/api/trading-substrate/private-readiness-posture/latest",
      readOptions,
      async (request, reply) => send(reply, await context.readPrivateReadinessPostureLatest(request.query))
    );
    server.get<{ Querystring: { venue?: string; instrument?: string } }>(
      "/api/trading-substrate/account-position-risk/latest",
      readOptions,
      async (request, reply) => send(reply, await context.readAccountPositionRiskLatest(request.query))
    );
    server.get(
      "/api/candidates",
      readOptions,
      async (_request, reply) => send(reply, await context.listCandidates())
    );
    server.get<{ Params: { candidate_id: string } }>(
      "/api/candidates/:candidate_id",
      readOptions,
      async (request, reply) => send(reply, await context.getCandidate(request.params.candidate_id))
    );
    server.get<{ Params: { candidate_id: string } }>(
      "/api/candidates/:candidate_id/evaluations",
      readOptions,
      async (request, reply) => send(reply, await context.listCandidateEvaluations(request.params.candidate_id))
    );
    server.get<{ Params: { candidate_id: string }; Querystring: { limit?: string } }>(
      "/api/candidates/:candidate_id/replay-runs",
      readOptions,
      async (request, reply) => send(
        reply,
        await context.listCandidateReplayRuns(request.params.candidate_id, request.query)
      )
    );
    server.get<{ Params: { run_id: string }; Querystring: { candidate_id?: string } }>(
      "/api/replay-runs/:run_id",
      readOptions,
      async (request, reply) => send(reply, await context.getReplayRun(request.params.run_id, request.query))
    );
    server.get<{
      Params: { run_id: string };
      Querystring: { candidate_id?: string; baseline_run_id?: string };
    }>(
      "/api/replay-runs/:run_id/validation-state",
      readOptions,
      async (request, reply) => send(
        reply,
        await context.getReplayRunValidationState(request.params.run_id, request.query)
      )
    );
    server.get<{
      Params: { run_id: string };
      Querystring: { candidate_id?: string; baseline_run_id?: string };
    }>(
      "/api/replay-runs/:run_id/comparison",
      readOptions,
      async (request, reply) => send(
        reply,
        await context.getReplayRunComparison(request.params.run_id, request.query)
      )
    );
    server.get<{ Params: { run_id: string } }>(
      "/api/trading-runs/:run_id",
      readOptions,
      async (request, reply) => send(reply, await context.getTradingRun(request.params.run_id))
    );
    server.get<{ Params: { evaluation_id: string } }>(
      "/api/evaluations/:evaluation_id",
      readOptions,
      async (request, reply) => send(reply, await context.getEvaluation(request.params.evaluation_id))
    );
    server.get(
      "/api/sandboxes",
      readOptions,
      async (_request, reply) => send(reply, await context.listSandboxes())
    );
    server.get<{ Params: { sandbox_id: string } }>(
      "/api/sandboxes/:sandbox_id",
      readOptions,
      async (request, reply) => send(reply, await context.getSandbox(request.params.sandbox_id))
    );
    server.get<{ Params: { sandbox_id: string } }>(
      "/api/sandboxes/:sandbox_id/logs",
      readOptions,
      async (request, reply) => send(reply, await context.getSandboxLogs(request.params.sandbox_id))
    );
  };
}

function send(reply: FastifyReply, response: RuntimeControllerResponse) {
  return reply.code(response.statusCode).send(response.body);
}

function authRouteOptions(
  options: object,
  preHandler: RouteShorthandOptions["preHandler"]
): RouteShorthandOptions {
  return {
    ...options,
    preHandler
  };
}
