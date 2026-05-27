import {
  isOuroborosCommandKind,
  OUROBOROS_COMMAND_KINDS,
  type OperatorReadModel,
  type OuroborosCommandRequest
} from "@ouroboros/domain";
import { OperatorCommandError, type OperatorService } from "../services/operator-service";

export interface OperatorControllerResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

export interface OperatorController {
  readOperator(): Promise<OperatorReadModel>;
  dispatchCommand(request: OuroborosCommandRequest | undefined): Promise<OperatorControllerResponse>;
}

export function createOperatorController(service: OperatorService): OperatorController {
  return {
    readOperator: () => service.readOperator(),
    dispatchCommand: (request) => dispatchOperatorCommand(service, request)
  };
}

async function dispatchOperatorCommand(
  service: OperatorService,
  request: OuroborosCommandRequest | undefined
): Promise<OperatorControllerResponse> {
  if (!isOuroborosCommandKind(request?.command_kind)) {
    return {
      statusCode: 400,
      body: {
        error: "invalid_command_kind",
        allowed_values: OUROBOROS_COMMAND_KINDS
      }
    };
  }

  const commandKind = request.command_kind;
  const requestedAt = new Date().toISOString();
  try {
    const { result, summary } = await service.executeCommand(commandKind, request.payload);
    const command = await service.recordCommand({
      commandKind,
      requestId: request.request_id,
      status: "succeeded",
      requestedAt,
      summary
    });
    return {
      statusCode: 200,
      body: {
        command,
        result,
        operator: await service.readOperator()
      }
    };
  } catch (error) {
    const commandError = error instanceof OperatorCommandError
      ? error
      : new OperatorCommandError(500, "command_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
    const command = await service.recordCommand({
      commandKind,
      requestId: request.request_id,
      status: "failed",
      requestedAt,
      error: commandError.error
    });
    return {
      statusCode: commandError.statusCode,
      body: {
        command,
        error: commandError.error,
        ...commandError.details,
        operator: await service.readOperator()
      }
    };
  }
}
