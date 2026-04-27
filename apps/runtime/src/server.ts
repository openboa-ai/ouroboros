import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { LocalStore } from "@autokairos/local-store";
import { runCandidateGeneration } from "./candidate-materialization";
import { CodexCliProviderAdapter } from "./providers/codex-cli-provider";
import type { RuntimeProviderAdapter } from "./providers/runtime-provider-adapter";

export interface BuildServerOptions {
  store?: LocalStore;
  providerAdapter?: RuntimeProviderAdapter;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const store = options.store ?? new LocalStore();
  const providerAdapter = options.providerAdapter ?? new CodexCliProviderAdapter();
  await store.initialize();

  const server = Fastify({
    logger: false
  });

  await server.register(cors, {
    origin: true,
    methods: ["GET"]
  });

  server.get("/health", async () => ({
    status: "ok",
    service: "autokairos-runtime",
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
