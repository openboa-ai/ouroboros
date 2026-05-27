import { buildServer } from "./server";
import { loadTradingResearchRuntimeConfig } from "@ouroboros/application/trading-research/runtime-config";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

const server = await buildServer({
  tradingResearchRuntimeConfig: loadTradingResearchRuntimeConfig(process.env)
});

try {
  await server.listen({ host, port });
  server.log.info(`ouroboros runtime listening on http://${host}:${port}`);
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
