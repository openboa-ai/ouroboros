import type {
  ResearchControlStudyExecutionLeaseOwner,
  ResearchControlStudyExecutionLeaseRecord,
  ResearchControlStudyRecord
} from "@ouroboros/domain";

export type ResearchControlStudyExecutionLeaseOwnerLiveness =
  | "alive"
  | "absent"
  | "unknown";

export type ResearchControlStudyExecutionLeaseHeldReason =
  | "owner_alive"
  | "owner_liveness_unknown"
  | "lease_unexpired"
  | "transition";

export type ResearchControlStudyExecutionLeaseAcquireResult =
  | {
      status: "acquired";
      lease: ResearchControlStudyExecutionLeaseRecord;
    }
  | {
      status: "held";
      lease: ResearchControlStudyExecutionLeaseRecord;
      reason: ResearchControlStudyExecutionLeaseHeldReason;
    };

export interface ResearchControlStudyExecutionLeasePort {
  acquire(input: {
    study: ResearchControlStudyRecord;
    owner: ResearchControlStudyExecutionLeaseOwner;
    leaseDurationMs: number;
  }): Promise<ResearchControlStudyExecutionLeaseAcquireResult>;
  renew(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord>;
  assertOwned(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord>;
  withFencedWrite<T>(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
    write: () => Promise<T>;
  }): Promise<T>;
  release(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord>;
}
