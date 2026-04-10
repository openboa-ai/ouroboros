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
  live_lane_ref: string;
  current_checkpoint_ref: string;
  export_policy_ref: string;
};

export type StrategyIndexRefs = {
  checkpoints_ref: string;
  collections_ref: string;
  sessions_ref: string;
  [key: string]: string;
};

export type LiveLaneState = {
  lane_id: string;
  label: string;
  mode: "observer" | "paper" | "live";
  state_refs: {
    memory_ref: string;
    sessions_ref: string;
    positions_ref: string;
    orders_ref: string;
    eval_summaries_ref: string;
  };
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
    created_at?: string;
  }>;
};

export type CollectionRecord = {
  collection_id: CollectionId;
  kind: "raw" | "canonical";
  time_range: {
    start: string;
    end: string;
  };
  content_hash: string;
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
