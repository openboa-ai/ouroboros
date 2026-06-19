import type { FastifyInstance } from "fastify";
import type {
  OuroborosCommandRequest,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import type { OperatorController } from "@ouroboros/application/controllers/operator";
import { listTradingSystemExecutionModeContracts } from "@ouroboros/application/trading/execution-mode-contracts";

export interface CoreControllerRoutesContext {
  operatorController: OperatorController;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
  storeRoot: string;
  filesystemReadRateLimit: object;
  commandMutationRateLimit: object;
}

export function registerCoreControllerRoutes(context: CoreControllerRoutesContext) {
  return (server: FastifyInstance): void => {
    server.get("/health", async () => ({
      status: "ok",
      service: "ouroboros-runtime",
      mode: "fixture_convenience_mode",
      store_root: context.storeRoot,
      trading_gateway_environment: context.tradingGatewayEnvironment,
      projections: "rebuilt_from_authoritative_item_files"
    }));

    server.get("/api/gateway/environment", async () => ({
      trading_gateway_environment: context.tradingGatewayEnvironment
    }));

    server.get("/api/trading-system/execution-mode-contracts", async () => ({
      trading_system_execution_mode_contracts: listTradingSystemExecutionModeContracts()
    }));

    server.get(
      "/api/operator",
      context.filesystemReadRateLimit,
      async () => ({
        operator: await context.operatorController.readOperator()
      })
    );

    server.post<{ Body: OuroborosCommandRequest }>(
      "/api/commands",
      context.commandMutationRateLimit,
      async (request, reply) => {
        const response = await context.operatorController.dispatchCommand(request.body);
        return reply.code(response.statusCode).send(response.body);
      }
    );
  };
}
