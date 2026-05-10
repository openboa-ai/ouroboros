import { createHash } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { EvaluationExecutionMode } from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { runCandidateEvaluation } from "./candidate-evaluation";
import { runCandidateGeneration } from "./candidate-materialization";
import { CodexCliProviderAdapter } from "./providers/codex-cli-provider";
import { FixtureEvaluationProviderAdapter } from "./providers/fixture-evaluation-provider";
import type {
  EvaluationProviderAdapter,
  RuntimeProviderAdapter
} from "./providers/runtime-provider-adapter";

export interface BuildServerOptions {
  store?: LocalStore;
  providerAdapter?: RuntimeProviderAdapter;
  evaluationProviderAdapter?: EvaluationProviderAdapter;
}

interface CreateEvaluationRunBody {
  candidate_version_id?: string;
  idempotency_key?: string;
  stage?: string;
  execution_mode?: EvaluationExecutionMode;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const store = options.store ?? new LocalStore();
  const providerAdapter = options.providerAdapter ?? new CodexCliProviderAdapter();
  const evaluationProviderAdapter = options.evaluationProviderAdapter ?? new FixtureEvaluationProviderAdapter();
  await store.initialize();

  const server = Fastify({
    logger: false
  });

  await server.register(cors, {
    origin: true,
    methods: ["GET", "POST"]
  });

  server.get("/health", async () => ({
    status: "ok",
    service: "ouroboros-runtime",
    mode: "fixture_convenience_mode",
    store_root: store.root(),
    projections: "rebuilt_from_authoritative_item_files"
  }));

  server.get("/api/candidates", async () => ({
    candidates: await store.listCandidates()
  }));

  server.get<{ Params: { candidate_id: string } }>(
    "/api/candidates/:candidate_id",
    async (request, reply) => {
      const candidate = await store.getCandidate(request.params.candidate_id);
      if (!candidate) {
        return reply.code(404).send({
          error: "candidate_not_found",
          candidate_id: request.params.candidate_id
        });
      }
      return candidate;
    }
  );

  server.get<{ Params: { candidate_id: string } }>(
    "/api/candidates/:candidate_id/evaluation-runs",
    async (request, reply) => {
      const candidate = await store.getCandidate(request.params.candidate_id);
      if (!candidate) {
        return reply.code(404).send({
          error: "candidate_not_found",
          candidate_id: request.params.candidate_id
        });
      }

      return {
        candidate_id: request.params.candidate_id,
        evaluation_runs: await store.listCandidateEvaluationRuns(request.params.candidate_id)
      };
    }
  );

  server.post<{
    Params: { candidate_id: string };
    Body: CreateEvaluationRunBody;
  }>("/api/candidates/:candidate_id/evaluation-runs", async (request, reply) => {
    const candidate = await store.getCandidate(request.params.candidate_id);
    if (!candidate) {
      return reply.code(404).send({
        error: "candidate_not_found",
        candidate_id: request.params.candidate_id
      });
    }

    const body = request.body ?? {};
    if (body.stage !== undefined && body.stage !== "backtest") {
      return reply.code(422).send({
        error: "evaluation_run_failed",
        reason: "unsupported_evaluation_stage",
        candidate_id: request.params.candidate_id
      });
    }

    const candidateVersionId = body.candidate_version_id ?? candidate.candidate_version.candidate_version_id;
    const requestedExecutionMode = body.execution_mode ?? "host_local";
    const idempotencyKey = body.idempotency_key
      ?? `runtime-api-evaluation-${request.params.candidate_id}-${candidateVersionId}-backtest-${requestedExecutionMode}`;
    const stableRequestId = safeRouteId(`${request.params.candidate_id}-${candidateVersionId}-${idempotencyKey}`);
    const outcome = await runCandidateEvaluation(store, evaluationProviderAdapter, {
      candidate_id: request.params.candidate_id,
      candidate_version_id: candidateVersionId,
      idempotency_key: idempotencyKey,
      stage_binding_ref: {
        record_kind: "stage_binding",
        id: `stage-binding-api-evaluation-${stableRequestId}`
      },
      trace_id: `trace-api-evaluation-${stableRequestId}`,
      execution_mode: requestedExecutionMode
    });

    if (outcome.status === "failed") {
      const statusCode = outcome.failure_reason === "candidate_not_found" ? 404 : 422;
      const error = statusCode === 404 ? "candidate_not_found" : "evaluation_run_failed";
      return reply.code(statusCode).send({
        error,
        reason: outcome.failure_reason,
        candidate_id: request.params.candidate_id,
        candidate_version_id: candidateVersionId,
        idempotency_key: idempotencyKey
      });
    }

    return reply.code(201).send(outcome);
  });

  server.get<{ Params: { evaluation_run_id: string } }>(
    "/api/evaluation-runs/:evaluation_run_id",
    async (request, reply) => {
      const evaluationRun = await store.getCandidateEvaluationRun(request.params.evaluation_run_id);
      if (!evaluationRun) {
        return reply.code(404).send({
          error: "evaluation_run_not_found",
          evaluation_run_id: request.params.evaluation_run_id
        });
      }
      return evaluationRun;
    }
  );

  server.get("/api/candidate-materialization-attempts", async () => ({
    attempts: await store.listCandidateMaterializationAttempts()
  }));

  server.get<{ Params: { attempt_id: string } }>(
    "/api/candidate-materialization-attempts/:attempt_id",
    async (request, reply) => {
      const attempt = await store.getCandidateMaterializationAttempt(request.params.attempt_id);
      if (!attempt) {
        return reply.code(404).send({
          error: "candidate_materialization_attempt_not_found",
          attempt_id: request.params.attempt_id
        });
      }
      return attempt;
    }
  );

  server.post<{ Body: { prompt?: string } }>("/api/candidate-generation-runs", async (request, reply) => {
    const outcome = await runCandidateGeneration(store, providerAdapter, {
      prompt: request.body?.prompt ?? "Create one MLP-01 BTC perpetual trader-system candidate."
    });
    if (outcome.status === "failed") {
      return reply.code(422).send(outcome);
    }
    return reply.code(201).send(outcome);
  });

  return server;
}

function safeRouteId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const prefix = normalized.slice(0, 72) || "empty";
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${prefix}-${digest}`;
}
