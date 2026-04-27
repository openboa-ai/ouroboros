import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { LocalStore } from "@autokairos/local-store";

export interface BuildServerOptions {
  store?: LocalStore;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const store = options.store ?? new LocalStore();
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

  return server;
}
