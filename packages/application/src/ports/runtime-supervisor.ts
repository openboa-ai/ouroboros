import type {
  RuntimeSupervisorCheckpointDraft,
  RuntimeSupervisorCheckpointRecord
} from "@ouroboros/domain";

export interface RuntimeSupervisorCheckpointStorePort {
  latest(): Promise<RuntimeSupervisorCheckpointRecord | undefined>;
  history(): Promise<RuntimeSupervisorCheckpointRecord[]>;
  append(
    draft: RuntimeSupervisorCheckpointDraft,
    expectedPreviousDigest?: string
  ): Promise<RuntimeSupervisorCheckpointRecord>;
}

