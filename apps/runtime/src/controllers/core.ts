import type { FastifyInstance, RouteShorthandOptions } from "fastify";
import type {
  OuroborosCommandRequest,
  RuntimeSupervisorReadModel,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import type { OperatorController } from "@ouroboros/application/controllers/operator";
import { listTradingSystemExecutionModeContracts } from "@ouroboros/application/trading/execution-mode-contracts";

export const OPERATOR_LOOP_CONTRACT_VERSION = "paper-loop-continuation-v2";

export interface CoreControllerRoutesContext {
  operatorController: OperatorController;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
  runtimeSupervisor: {
    status(): RuntimeSupervisorReadModel;
  };
  storeRoot: string;
  filesystemReadRateLimit: object;
  commandMutationRateLimit: object;
  operatorApiAuthPreHandler: RouteShorthandOptions["preHandler"];
}

export function registerCoreControllerRoutes(context: CoreControllerRoutesContext) {
  return (server: FastifyInstance): void => {
    server.get("/health", async () => ({
      status: "ok",
      service: "ouroboros-runtime",
      mode: "fixture_convenience_mode",
      operator_loop_contract_version: OPERATOR_LOOP_CONTRACT_VERSION,
      store_root: context.storeRoot,
      runtime_supervisor: context.runtimeSupervisor.status(),
      trading_gateway_environment: context.tradingGatewayEnvironment,
      projections: "rebuilt_from_authoritative_item_files"
    }));

    server.get(
      "/api/gateway/environment",
      authRouteOptions(context.filesystemReadRateLimit, context.operatorApiAuthPreHandler),
      async () => ({
        trading_gateway_environment: context.tradingGatewayEnvironment
      })
    );

    server.get(
      "/api/trading-system/execution-mode-contracts",
      authRouteOptions(context.filesystemReadRateLimit, context.operatorApiAuthPreHandler),
      async () => ({
        trading_system_execution_mode_contracts: listTradingSystemExecutionModeContracts()
      })
    );

    server.get(
      "/api/operator",
      authRouteOptions(context.filesystemReadRateLimit, context.operatorApiAuthPreHandler),
      async () => ({
        operator: await context.operatorController.readOperator()
      })
    );

    server.get<{ Params: { candidateId: string } }>(
      "/api/arena/trading-systems/:candidateId",
      authRouteOptions(context.filesystemReadRateLimit, context.operatorApiAuthPreHandler),
      async (request, reply) => {
        const response = await context.operatorController
          .readArenaTradingSystemDetail(request.params.candidateId);
        return reply.code(response.statusCode).send(response.body);
      }
    );

    server.post<{ Body: OuroborosCommandRequest }>(
      "/api/commands",
      authRouteOptions(context.commandMutationRateLimit, context.operatorApiAuthPreHandler),
      async (request, reply) => {
        const response = await context.operatorController.dispatchCommand(request.body);
        return reply.code(response.statusCode).send(response.body);
      }
    );
  };
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
