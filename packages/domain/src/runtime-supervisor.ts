export type RuntimeSupervisorStatus =
  | "recovering"
  | "running"
  | "degraded"
  | "blocked"
  | "stopped";

export type RuntimeSupervisorLane =
  | "selected_paper"
  | "candidate_arena"
  | "research_control_study_scheduler";

export interface RuntimeSupervisorLaneReadModel {
  lane: RuntimeSupervisorLane;
  desired: boolean;
  status: RuntimeSupervisorStatus;
  basis_digest: string;
  progress_digest: string;
  attempt_count: number;
  no_progress_count: number;
  next_retry_at?: string;
  reason_code?: string;
}

export interface RuntimeSupervisorReadModel {
  status: RuntimeSupervisorStatus;
  lanes: readonly RuntimeSupervisorLaneReadModel[];
  recorded_at: string;
  checkpoint_sequence: number;
  checkpoint_digest: string;
  runtime_coordination_authority: true;
  evaluation_authority: false;
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "runtime_coordination_only";
}

export interface RuntimeSupervisorCheckpointRecord {
  record_kind: "runtime_supervisor_checkpoint";
  version: 1;
  sequence: number;
  previous_checkpoint_digest?: string;
  status: RuntimeSupervisorStatus;
  lanes: readonly RuntimeSupervisorLaneReadModel[];
  recorded_at: string;
  checkpoint_digest: string;
  runtime_coordination_authority: true;
  evaluation_authority: false;
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "runtime_coordination_only";
}

export type RuntimeSupervisorCheckpointDraft = Pick<
  RuntimeSupervisorCheckpointRecord,
  "status" | "lanes" | "recorded_at"
>;
