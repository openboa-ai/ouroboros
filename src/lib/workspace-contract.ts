export type ArtifactId = string;
export type CheckpointId = string;
export type CollectionId = string;
export type EntryId = string;
export type BlobId = `sha256:${string}`;

export type ArtifactAlias = string;

export type StrategyManifest = {
  artifact_id: ArtifactId;
  slug: ArtifactAlias;
  schema_version: string;
  active: StrategyActiveRefs;
  indexes: StrategyIndexRefs;
};

export type StrategyActiveRefs = {
  orchestrator_ref: string;
  live_lane_ref: string;
  current_checkpoint_ref: string;
  export_policy_ref: string;
};

export type StrategyIndexRefs = {
  checkpoints_ref: string;
  agents_ref: string;
  environments_ref: string;
  collections_ref: string;
  imports_ref: string;
  operations_ref: string;
  sessions_ref: string;
  [key: string]: string;
};

export type LiveLaneState = {
  lane_id: string;
  label: string;
  mode: "observer" | "paper" | "live";
  state_refs: {
    dashboard_ref: string;
    decisions_ref: string;
    memory_ref: string;
    sessions_ref: string;
    positions_ref: string;
    orders_ref: string;
  eval_summaries_ref: string;
  };
};

export type OrchestratorRecord = {
  orchestrator_id: string;
  name: string;
  mode: string;
  topology_refs: {
    agents_ref: string;
    environments_ref: string;
    sessions_ref: string;
    live_lane_ref: string;
  };
  notes?: string[];
};

export type AgentsIndex = {
  agents: Array<{
    id: string;
    kind: string;
    name: string;
    provider_mode: string;
    definition_ref: string;
  }>;
};

export type AgentDefinition = {
  agent_id: string;
  name: string;
  kind: string;
  environment_ref: string;
  provider_policy: {
    mode: string;
    preferred_providers: string[];
  };
  workspace_refs: Record<string, string>;
};

export type EnvironmentsIndex = {
  environments: Array<{
    id: string;
    name: string;
    definition_ref: string;
  }>;
};

export type EnvironmentDefinition = {
  environment_id: string;
  name: string;
  kind: string;
  capabilities: string[];
  notes?: string;
};

export type CheckpointIndex = {
  current: {
    checkpoint_id: CheckpointId;
    alias: string;
    type: "promotion" | "export" | "incident";
  };
  items: Array<{
    checkpoint_id: CheckpointId;
    alias: string;
    type: "promotion" | "export" | "incident";
    type_tone?: "positive" | "warning" | "danger";
    summary?: string;
    performance?: string;
    path_ref?: string;
    created_at?: string;
  }>;
};

export type CollectionRecord = {
  collection_id: CollectionId;
  kind: "raw" | "canonical";
  source_ref: string;
  time_bucket: string;
  time_range: {
    start: string;
    end: string;
  };
  content_hash: string;
  entry_count?: number;
  path_ref?: string;
  entry_shard_ref?: string;
  notes?: string;
  parent_collection_ref?: string;
  transform_version?: string;
};

export type EntryRecord = {
  entry_id: EntryId;
  collection_id: CollectionId;
  source_ref: string;
  event_time: string;
  ingested_at: string;
  content_hash: string;
  blob_ref?: BlobId;
  preview?: string;
};
