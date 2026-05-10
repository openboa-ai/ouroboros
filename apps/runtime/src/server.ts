import { createHash } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type {
  BoundedRuntimeAuthorityInput,
  EvaluationExecutionMode,
  Ref,
  RuntimeControlAuditInput
} from "@ouroboros/domain";
import { LocalStore, LocalStoreError } from "@ouroboros/local-store";
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

interface RecordRuntimeAuthorityBody {
  candidate_version_id?: string;
  runtime_id?: string;
  idempotency_key?: string;
  intent?: {
    intent_kind?: string;
    side?: string;
    order_type?: string;
    quantity?: string;
    limit_price?: string;
  };
  gateway_decision?: {
    decision_outcome?: string;
    decision_reason?: string;
    policy_ref?: Ref;
  };
  execution_attempt?: {
    execution_mode?: string;
    status?: string;
    result_reason?: string;
    trace_ref?: Ref;
    completed_at?: string;
  };
  created_at?: string;
}

interface RecordRuntimeControlBody {
  candidate_version_id?: string;
  runtime_id?: string;
  idempotency_key?: string;
  command?: {
    action?: string;
    requested_lifecycle_status?: string;
    actor_kind?: string;
    actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    reason?: string;
    reason_summary?: string;
    trace_ref?: Ref;
    related_order_intent_refs?: Ref[];
    related_gateway_decision_refs?: Ref[];
    related_execution_attempt_refs?: Ref[];
  };
  decision?: {
    decision_outcome?: string;
    decision_reason?: string;
    decided_by_actor_kind?: string;
    decided_by_actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    resulting_lifecycle_status?: string;
    trace_ref?: Ref;
    related_order_intent_refs?: Ref[];
    related_gateway_decision_refs?: Ref[];
    related_execution_attempt_refs?: Ref[];
  };
  audit_event?: {
    event_kind?: string;
    actor_kind?: string;
    actor_ref?: Ref;
    runtime_lifecycle_status?: string;
    message?: string;
    trace_ref?: Ref;
    supporting_record_refs?: Ref[];
    related_order_intent_refs?: Ref[];
    related_gateway_decision_refs?: Ref[];
    related_execution_attempt_refs?: Ref[];
  };
  created_at?: string;
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

  server.get<{ Params: { candidate_id: string } }>(
    "/api/candidates/:candidate_id/runtime-authority",
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
        runtime_id: candidate.runtime.ref.id,
        bounded_authority: candidate.runtime.bounded_authority
      };
    }
  );

  server.post<{
    Params: { candidate_id: string };
    Body: RecordRuntimeAuthorityBody;
  }>("/api/candidates/:candidate_id/runtime-authority", async (request, reply) => {
    const candidate = await store.getCandidate(request.params.candidate_id);
    if (!candidate) {
      return reply.code(404).send({
        error: "candidate_not_found",
        candidate_id: request.params.candidate_id
      });
    }

    const body = request.body ?? {};
    if (!isRuntimeAuthorityRequestComplete(body)) {
      return reply.code(422).send(runtimeAuthorityError({
        reason: "invalid_runtime_authority_request",
        candidateId: request.params.candidate_id,
        candidateVersionId: body.candidate_version_id,
        idempotencyKey: body.idempotency_key
      }));
    }

    try {
      const outcome = await store.recordBoundedRuntimeAuthority({
        idempotency_key: body.idempotency_key,
        candidate_id: request.params.candidate_id,
        candidate_version_id: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
        runtime_id: body.runtime_id,
        intent: body.intent,
        gateway_decision: body.gateway_decision,
        execution_attempt: body.execution_attempt,
        created_at: body.created_at
      } as BoundedRuntimeAuthorityInput);

      return reply.code(201).send({
        status: "recorded",
        ...outcome
      });
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return reply.code(runtimeAuthorityStatusCode(error.code)).send(runtimeAuthorityError({
          reason: error.code,
          candidateId: request.params.candidate_id,
          candidateVersionId: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
          idempotencyKey: body.idempotency_key
        }));
      }
      throw error;
    }
  });

  server.get<{ Params: { candidate_id: string } }>(
    "/api/candidates/:candidate_id/runtime-control",
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
        runtime_id: candidate.runtime.ref.id,
        runtime_control: candidate.runtime.runtime_control
      };
    }
  );

  server.post<{
    Params: { candidate_id: string };
    Body: RecordRuntimeControlBody;
  }>("/api/candidates/:candidate_id/runtime-control", async (request, reply) => {
    const candidate = await store.getCandidate(request.params.candidate_id);
    if (!candidate) {
      return reply.code(404).send({
        error: "candidate_not_found",
        candidate_id: request.params.candidate_id
      });
    }

    const body = request.body ?? {};
    if (!isRuntimeControlRequestComplete(body)) {
      return reply.code(422).send(runtimeControlError({
        reason: "invalid_runtime_control_request",
        candidateId: request.params.candidate_id,
        candidateVersionId: body.candidate_version_id,
        idempotencyKey: body.idempotency_key
      }));
    }

    try {
      const outcome = await store.recordRuntimeControlAudit({
        idempotency_key: body.idempotency_key,
        candidate_id: request.params.candidate_id,
        candidate_version_id: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
        runtime_id: body.runtime_id,
        command: body.command,
        decision: body.decision,
        audit_event: body.audit_event,
        created_at: body.created_at
      } as RuntimeControlAuditInput);

      return reply.code(201).send({
        status: "recorded",
        ...outcome
      });
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return reply.code(runtimeControlStatusCode(error.code)).send(runtimeControlError({
          reason: error.code,
          candidateId: request.params.candidate_id,
          candidateVersionId: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
          idempotencyKey: body.idempotency_key
        }));
      }
      throw error;
    }
  });

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

function isRuntimeAuthorityRequestComplete(
  body: RecordRuntimeAuthorityBody
): body is RecordRuntimeAuthorityBody & {
  idempotency_key: string;
  intent: BoundedRuntimeAuthorityInput["intent"];
  gateway_decision: BoundedRuntimeAuthorityInput["gateway_decision"];
} {
  return Boolean(body.idempotency_key && body.intent && body.gateway_decision);
}

function runtimeAuthorityStatusCode(reason: string): 404 | 422 {
  return reason === "candidate_not_found" ? 404 : 422;
}

function runtimeAuthorityError(input: {
  reason: string;
  candidateId: string;
  candidateVersionId?: string;
  idempotencyKey?: string;
}) {
  return {
    error: "runtime_authority_record_failed",
    reason: input.reason,
    candidate_id: input.candidateId,
    candidate_version_id: input.candidateVersionId,
    idempotency_key: input.idempotencyKey
  };
}

function isRuntimeControlRequestComplete(
  body: RecordRuntimeControlBody
): body is RecordRuntimeControlBody & {
  idempotency_key: string;
  command: RuntimeControlAuditInput["command"];
  decision: RuntimeControlAuditInput["decision"];
  audit_event: RuntimeControlAuditInput["audit_event"];
} {
  return Boolean(body.idempotency_key && body.command && body.decision && body.audit_event);
}

function runtimeControlStatusCode(reason: string): 404 | 422 {
  return reason === "candidate_not_found" ? 404 : 422;
}

function runtimeControlError(input: {
  reason: string;
  candidateId: string;
  candidateVersionId?: string;
  idempotencyKey?: string;
}) {
  return {
    error: "runtime_control_record_failed",
    reason: input.reason,
    candidate_id: input.candidateId,
    candidate_version_id: input.candidateVersionId,
    idempotency_key: input.idempotencyKey
  };
}
