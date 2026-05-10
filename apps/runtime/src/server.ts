import { createHash } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type {
  BoundedRuntimeAuthorityInput,
  EvaluationExecutionMode,
  Ref,
  RuntimeControlAuditInput,
  SandboxRuntimeAdapterKind
} from "@ouroboros/domain";
import { FIXTURE_RUNNABLE_ARTIFACT_ID, LocalStore, LocalStoreError } from "@ouroboros/local-store";
import { runCandidateEvaluation } from "./candidate-evaluation";
import { runCandidateGeneration } from "./candidate-materialization";
import { CodexCliProviderAdapter } from "./providers/codex-cli-provider";
import { FixtureEvaluationProviderAdapter } from "./providers/fixture-evaluation-provider";
import type {
  EvaluationProviderAdapter,
  RuntimeProviderAdapter
} from "./providers/runtime-provider-adapter";
import {
  DeterministicSandboxRuntimeAdapter,
  DockerSandboxesSbxRuntimeAdapter,
  type SandboxRuntimeAdapter
} from "./runtime-instances/sandbox-runtime-adapter";

export interface BuildServerOptions {
  store?: LocalStore;
  providerAdapter?: RuntimeProviderAdapter;
  evaluationProviderAdapter?: EvaluationProviderAdapter;
  runtimeInstanceAdapters?: Partial<Record<SandboxRuntimeAdapterKind, SandboxRuntimeAdapter>>;
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

interface StartRuntimeInstanceBody {
  idempotency_key?: string;
  adapter_kind?: string;
  runnable_artifact_id?: string;
  runtime_id?: string;
  instance_id?: string;
  sandbox_name?: string;
  test_ticks?: number;
  interval_ms?: number;
  created_at?: string;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const store = options.store ?? new LocalStore();
  const providerAdapter = options.providerAdapter ?? new CodexCliProviderAdapter();
  const evaluationProviderAdapter = options.evaluationProviderAdapter ?? new FixtureEvaluationProviderAdapter();
  const runtimeInstanceAdapters: Record<SandboxRuntimeAdapterKind, SandboxRuntimeAdapter> = {
    deterministic_test: options.runtimeInstanceAdapters?.deterministic_test
      ?? new DeterministicSandboxRuntimeAdapter(),
    docker_sandboxes_sbx: options.runtimeInstanceAdapters?.docker_sandboxes_sbx
      ?? new DockerSandboxesSbxRuntimeAdapter()
  };
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

  server.post<{ Body: StartRuntimeInstanceBody }>("/api/runtime-instances", async (request, reply) => {
    const body = request.body ?? {};
    const rawSecretPath = rawSecretMaterialPath(body);
    if (rawSecretPath) {
      return reply.code(422).send(runtimeInstanceError({
        reason: "raw_secret_material_rejected",
        idempotencyKey: body.idempotency_key,
        detail: rawSecretPath
      }));
    }

    const adapterKind = parseRuntimeInstanceAdapterKind(body.adapter_kind);
    if (!adapterKind) {
      return reply.code(422).send(runtimeInstanceError({
        reason: "invalid_runtime_instance_adapter",
        idempotencyKey: body.idempotency_key
      }));
    }
    if (adapterKind === "docker_sandboxes_sbx" && !isSbxRuntimeEnabled()) {
      return reply.code(422).send(runtimeInstanceError({
        reason: "docker_sandboxes_sbx_runtime_disabled",
        idempotencyKey: body.idempotency_key
      }));
    }
    if (
      (body.test_ticks !== undefined && !isNonNegativeInteger(body.test_ticks)) ||
      (body.interval_ms !== undefined && !isPositiveInteger(body.interval_ms))
    ) {
      return reply.code(422).send(runtimeInstanceError({
        reason: "invalid_runtime_instance_input",
        idempotencyKey: body.idempotency_key
      }));
    }

    const runnableArtifactId = body.runnable_artifact_id ?? FIXTURE_RUNNABLE_ARTIFACT_ID;
    const artifact = await store.getRunnableArtifact(runnableArtifactId);
    if (!artifact) {
      return reply.code(404).send(runtimeInstanceError({
        reason: "runnable_artifact_not_found",
        idempotencyKey: body.idempotency_key,
        runnableArtifactId
      }));
    }

    const createdAt = body.created_at ?? new Date().toISOString();
    const idempotencyKey = body.idempotency_key
      ?? `${adapterKind}:${runnableArtifactId}:${body.runtime_id ?? "standalone"}`;
    const instanceId = body.instance_id ?? `sandbox-runtime-instance-${safeRouteId(idempotencyKey)}`;
    const sandboxName = body.sandbox_name ?? `ouro-s5-${safeRouteId(instanceId).slice(0, 48)}`;

    try {
      const adapterResult = await runtimeInstanceAdapters[adapterKind].startArtifactInstance({
        artifact,
        instance_id: instanceId,
        sandbox_name: sandboxName,
        runtime_ref: body.runtime_id
          ? { record_kind: "trader_system_runtime", id: body.runtime_id }
          : undefined,
        runtime_placement_id: `runtime-placement-${safeRouteId(instanceId)}`,
        created_at: createdAt,
        test_ticks: body.test_ticks,
        interval_ms: body.interval_ms
      });
      const outcome = await store.recordRuntimeInstanceStart(adapterResult);
      const lifecycleStatus = outcome.runtime_instance.lifecycle_status;
      return reply.code(201).send({
        status: lifecycleStatus === "running" ? "started" : lifecycleStatus,
        ...outcome
      });
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return reply.code(runtimeInstanceStatusCode(error.code)).send(runtimeInstanceError({
          reason: error.code,
          idempotencyKey,
          runnableArtifactId
        }));
      }
      throw error;
    }
  });

  server.get("/api/runtime-instances", async () => ({
    runtime_instances: await store.listRuntimeInstances()
  }));

  server.get<{ Params: { instance_id: string } }>(
    "/api/runtime-instances/:instance_id",
    async (request, reply) => {
      const runtimeInstance = await store.getRuntimeInstance(request.params.instance_id);
      if (!runtimeInstance) {
        return reply.code(404).send(runtimeInstanceError({
          reason: "runtime_instance_not_found",
          instanceId: request.params.instance_id
        }));
      }
      if (shouldRefreshRuntimeInstanceStatus(runtimeInstance.lifecycle_status)) {
        const observations = await runtimeInstanceAdapters[runtimeInstance.adapter_kind]
          .getArtifactInstanceStatus(runtimeInstance);
        if (
          observations.lifecycle_status ||
          observations.logs?.length ||
          observations.heartbeats?.length ||
          observations.command_evidence?.length
        ) {
          await store.recordRuntimeInstanceObservations(runtimeInstance.instance_id, observations);
          return await store.getRuntimeInstance(runtimeInstance.instance_id);
        }
      }
      return runtimeInstance;
    }
  );

  server.get<{ Params: { instance_id: string } }>(
    "/api/runtime-instances/:instance_id/logs",
    async (request, reply) => {
      const runtimeInstance = await store.getRuntimeInstance(request.params.instance_id);
      if (!runtimeInstance) {
        return reply.code(404).send(runtimeInstanceError({
          reason: "runtime_instance_not_found",
          instanceId: request.params.instance_id
        }));
      }
      if (!shouldRefreshRuntimeInstanceStatus(runtimeInstance.lifecycle_status)) {
        return {
          runtime_instance: runtimeInstance,
          logs: runtimeInstance.logs,
          heartbeats: runtimeInstance.heartbeats,
          command_evidence: runtimeInstance.command_evidence
        };
      }

      const observations = await runtimeInstanceAdapters[runtimeInstance.adapter_kind]
        .getArtifactInstanceLogs(runtimeInstance);
      const outcome = await store.recordRuntimeInstanceObservations(
        runtimeInstance.instance_id,
        observations
      );
      return outcome;
    }
  );

  server.post<{ Params: { instance_id: string } }>(
    "/api/runtime-instances/:instance_id/stop",
    async (request, reply) => {
      const runtimeInstance = await store.getRuntimeInstance(request.params.instance_id);
      if (!runtimeInstance) {
        return reply.code(404).send(runtimeInstanceError({
          reason: "runtime_instance_not_found",
          instanceId: request.params.instance_id
        }));
      }
      if (!shouldRefreshRuntimeInstanceStatus(runtimeInstance.lifecycle_status)) {
        return {
          status: runtimeInstance.lifecycle_status,
          runtime_instance: runtimeInstance
        };
      }

      const observations = await runtimeInstanceAdapters[runtimeInstance.adapter_kind]
        .stopArtifactInstance(runtimeInstance);
      const outcome = await store.stopRuntimeInstance(
        {
          instance_id: runtimeInstance.instance_id,
          stopped_at: observations.stopped_at,
          removed_at: observations.removed_at
        },
        observations
      );
      return {
        status: outcome.runtime_instance.lifecycle_status,
        ...outcome
      };
    }
  );

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

function parseRuntimeInstanceAdapterKind(value: string | undefined): SandboxRuntimeAdapterKind | undefined {
  if (value === undefined) {
    return process.env.OUROBOROS_RUNTIME_INSTANCE_ADAPTER === "docker_sandboxes_sbx"
      ? "docker_sandboxes_sbx"
      : "deterministic_test";
  }
  return value === "deterministic_test" || value === "docker_sandboxes_sbx" ? value : undefined;
}

function isSbxRuntimeEnabled(): boolean {
  return process.env.OUROBOROS_ENABLE_SBX_RUNTIME === "1" ||
    process.env.OUROBOROS_RUNTIME_INSTANCE_ADAPTER === "docker_sandboxes_sbx";
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function runtimeInstanceStatusCode(reason: string): 404 | 422 {
  return (
    reason === "runnable_artifact_not_found" ||
    reason === "runtime_instance_not_found" ||
    reason === "runtime_not_found"
  ) ? 404 : 422;
}

function runtimeInstanceError(input: {
  reason: string;
  idempotencyKey?: string;
  runnableArtifactId?: string;
  instanceId?: string;
  detail?: string;
}) {
  return {
    error: "runtime_instance_request_failed",
    reason: input.reason,
    idempotency_key: input.idempotencyKey,
    runnable_artifact_id: input.runnableArtifactId,
    instance_id: input.instanceId,
    detail: input.detail
  };
}

function shouldRefreshRuntimeInstanceStatus(lifecycleStatus: string): boolean {
  return lifecycleStatus !== "stopped" && lifecycleStatus !== "removed" && lifecycleStatus !== "failed";
}

function rawSecretMaterialPath(value: unknown, currentPath = "$"): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${currentPath}.${key}`;
    if (isRawSecretMaterialKey(key)) {
      return nestedPath;
    }
    const descendantPath = rawSecretMaterialPath(nestedValue, nestedPath);
    if (descendantPath) {
      return descendantPath;
    }
  }
  return undefined;
}

function isRawSecretMaterialKey(key: string): boolean {
  return /^(raw_)?secret(_values?)?$/i.test(key) ||
    /^(api[_-]?key|token|password|credentials?|private[_-]?key)$/i.test(key);
}
