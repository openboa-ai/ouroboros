import type {
  Ref,
  RuntimeProcessKind,
  RuntimeProcessOwnershipRecord,
  RuntimeProcessTerminalReason
} from "@ouroboros/domain";

export interface RuntimeProcessExpectedIdentity {
  process_kind: RuntimeProcessKind;
  subject_ref: Ref;
  runtime_ref: Ref;
  host_id: string;
  executable: string;
  profile_digest: string;
}

export type RuntimeProcessOwnershipBlockedReason =
  | "owner_liveness_unknown"
  | "identity_mismatch"
  | "ownership_metadata_invalid"
  | "host_mismatch"
  | "termination_failed"
  | "transition";

export type RuntimeProcessOwnershipReconcileResult =
  | {
      status: "vacant";
      previous?: RuntimeProcessOwnershipRecord;
    }
  | {
      status: "adopted";
      ownership: RuntimeProcessOwnershipRecord;
    }
  | {
      status: "terminated";
      ownership: RuntimeProcessOwnershipRecord;
    }
  | {
      status: "blocked";
      reason: RuntimeProcessOwnershipBlockedReason;
      ownership?: RuntimeProcessOwnershipRecord;
    };

export type RuntimeProcessOwnershipInspectionResult =
  | { status: "vacant" }
  | { status: "owned"; ownership: RuntimeProcessOwnershipRecord }
  | {
      status: "stale";
      liveness: "absent" | "reused" | "orphaned";
      ownership: RuntimeProcessOwnershipRecord;
    }
  | {
      status: "blocked";
      reason: RuntimeProcessOwnershipBlockedReason;
      ownership?: RuntimeProcessOwnershipRecord;
    };

export interface RuntimeProcessOwnershipPort {
  active(
    expected: Pick<RuntimeProcessExpectedIdentity, "process_kind" | "subject_ref">
  ): Promise<RuntimeProcessOwnershipRecord | undefined>;
  inspect(
    expected: RuntimeProcessExpectedIdentity
  ): Promise<RuntimeProcessOwnershipInspectionResult>;
  claim(input: {
    expected: RuntimeProcessExpectedIdentity;
    processId: number;
    sessionToken: string;
    startedAt: string;
  }): Promise<RuntimeProcessOwnershipRecord>;
  reconcile(input: {
    expected: RuntimeProcessExpectedIdentity;
    mode: "adopt" | "terminate";
    reconciledAt: string;
  }): Promise<RuntimeProcessOwnershipReconcileResult>;
  close(input: {
    ownership: RuntimeProcessOwnershipRecord;
    terminalReason: RuntimeProcessTerminalReason;
    closedAt: string;
  }): Promise<RuntimeProcessOwnershipRecord>;
  terminate(input: {
    ownership: RuntimeProcessOwnershipRecord;
    terminalReason: "shutdown" | "restart_terminated" | "timed_out";
    closedAt: string;
  }): Promise<RuntimeProcessOwnershipRecord>;
  history(
    expected: Pick<RuntimeProcessExpectedIdentity, "process_kind" | "subject_ref">
  ): Promise<RuntimeProcessOwnershipRecord[]>;
}
