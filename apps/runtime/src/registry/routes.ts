import type { FastifyInstance } from "fastify";

export type RuntimeRouteModule = (server: FastifyInstance) => Promise<void> | void;

export async function registerRuntimeRouteModules(
  server: FastifyInstance,
  modules: readonly RuntimeRouteModule[]
): Promise<void> {
  for (const registerModule of modules) {
    await registerModule(server);
  }
}
