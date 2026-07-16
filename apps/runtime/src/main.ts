import { buildServer } from "./server";
import { loadTradingResearchRuntimeConfig } from "@ouroboros/application/trading/research/runtime-config";
import { installRuntimeShutdownHandlers } from "./runtime-shutdown";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

const server = await buildServer({
  tradingResearchRuntimeConfig: loadTradingResearchRuntimeConfig(process.env)
});
const shutdown = installRuntimeShutdownHandlers(server);

try {
  await server.listen({ host, port });
  server.log.info(`ouroboros runtime listening on http://${host}:${port}`);
} catch (error) {
  server.log.error(error);
  try {
    await shutdown.shutdown();
  } catch {
    process.exit(1);
  }
  process.exitCode = 1;
}
