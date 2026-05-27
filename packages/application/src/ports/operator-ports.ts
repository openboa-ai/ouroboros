import type { OuroborosCommandKind } from "@ouroboros/domain";

export interface OperatorCommandExecution {
  result: unknown;
  summary?: string;
}

export type OperatorCommandHandler = (
  payload: Record<string, unknown> | undefined
) => Promise<OperatorCommandExecution>;

export type OperatorCommandHandlerRegistry = Readonly<Record<
  OuroborosCommandKind,
  OperatorCommandHandler
>>;

export interface SelectedCandidatePaperEvidencePort {
  run(candidateId: string): Promise<{
    statusCode: number;
    body: Record<string, unknown>;
  }>;
}

export interface OperatorMutationPort {
  run(commandKind: OuroborosCommandKind, payload: Record<string, unknown> | undefined): Promise<{
    statusCode: number;
    body: Record<string, unknown>;
  }>;
}
