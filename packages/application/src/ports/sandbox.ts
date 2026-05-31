import type {
  SandboxLogRecord,
  SandboxPlacementRecord,
  SandboxCommandEvidenceRecord,
  RuntimeHeartbeatRecord,
  SandboxAdapterKind,
  SandboxDetailReadModel,
  SandboxLifecycleStatus,
  SandboxRecord,
  SystemCodeRecord,
  Ref
} from "@ouroboros/domain";

export type PaperOrderRequestFixture = "valid" | "rejected";

export interface SandboxRuntimeEnv {
  TRADING_API_BASE_URL?: string;
}

export interface SandboxStartInput {
  artifact: SystemCodeRecord;
  instance_id: string;
  sandbox_name: string;
  sandbox_placement_id: string;
  runtime_ref?: Ref;
  created_at: string;
  trace_ref?: Ref;
  test_ticks?: number;
  interval_ms?: number;
  paper_order_request?: PaperOrderRequestFixture;
  env?: SandboxRuntimeEnv;
}

export interface SandboxStartResult {
  instance: SandboxRecord;
  placement: SandboxPlacementRecord;
  logs: SandboxLogRecord[];
  heartbeats: RuntimeHeartbeatRecord[];
  command_evidence: SandboxCommandEvidenceRecord[];
}

export interface SandboxAdapterPort {
  readonly kind?: SandboxAdapterKind;
  startArtifactInstance(input: SandboxStartInput): Promise<SandboxStartResult>;
  getArtifactInstanceStatus?(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult>;
  getArtifactInstanceLogs?(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult>;
  stopArtifactInstance?(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult>;
}

export interface SandboxAdapterObservationResult {
  lifecycle_status?: SandboxLifecycleStatus;
  logs?: SandboxLogRecord[];
  heartbeats?: RuntimeHeartbeatRecord[];
  command_evidence?: SandboxCommandEvidenceRecord[];
  stopped_at?: string;
  removed_at?: string;
}

export type SandboxAdapterRegistryPort = Readonly<Record<SandboxAdapterKind, SandboxAdapterPort>>;
