import type {
  SandboxHeartbeatReadModel,
  SandboxLogReadModel,
  SandboxLogRecord,
  SandboxPlacementRecord,
  SandboxCommandEvidenceReadModel,
  SandboxCommandEvidenceRecord,
  RuntimeHeartbeatRecord,
  SandboxRecord,
  SystemCodeRecord,
  Ref
} from "@ouroboros/domain";

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
}

export interface SandboxStartResult {
  instance: SandboxRecord;
  placement: SandboxPlacementRecord;
  logs: Array<SandboxLogRecord | SandboxLogReadModel>;
  heartbeats: Array<RuntimeHeartbeatRecord | SandboxHeartbeatReadModel>;
  command_evidence: Array<SandboxCommandEvidenceRecord | SandboxCommandEvidenceReadModel>;
}

export interface SandboxAdapterPort {
  startArtifactInstance(input: SandboxStartInput): Promise<SandboxStartResult>;
}
