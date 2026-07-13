import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  researchWorkerMemoryPolicyHasRuntimeShape,
  type CandidateAdmissionDecisionRecord,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerMemoryControlAssignment
} from "@ouroboros/domain";
import type { TradingResearchPriorCheckpoint } from
  "../trading/research/types";
import { buildResearchWorkerMemoryProjection } from
  "./research-worker-memory";

const priorCheckpointRecord = {
  record_kind: "research_worker_checkpoint",
  version: 1,
  research_worker_checkpoint_id: "research-worker-checkpoint-prior",
  research_worker_ref: {
    record_kind: "research_worker",
    id: "research-worker-trend"
  },
  research_direction_ref: {
    record_kind: "research_direction",
    id: "research-direction-trend"
  },
  candidate_arena_tick_id: "tick-prior",
  research_preflight_commitment_ref: {
    record_kind: "research_preflight_commitment",
    id: "research-preflight-prior"
  },
  research_preflight_commitment_digest: `sha256:${"1".repeat(64)}`,
  workspace_key: "candidate-arena-workers/research-worker-trend",
  development_budget: {
    submission_limit: 1,
    recorded_submission_count: 1,
    cumulative_committed_submission_limit: 1,
    cumulative_recorded_submission_count: 1,
    remaining_submission_authority: 0
  },
  notebook: {
    protocol_version: "research_worker_notebook_v1",
    total_entry_count: 1,
    recent_entries: [{
      sequence: 1,
      candidate_arena_tick_id: "tick-prior",
      iteration: 1,
      decision: "discard",
      agent_status: "edited",
      score: -2,
      summary: "Exact baseline behavior was already duplicated.",
      evaluation_status: "accepted",
      risk_decision: "valid_order_request",
      net_revenue_usdt: -2
    }]
  },
  terminal_status: "completed",
  terminal_reason: "admission_recorded",
  candidate_admission_decision_ref: {
    record_kind: "candidate_admission_decision",
    id: "candidate-admission-prior"
  },
  closed_at: "2026-07-13T00:00:00.000Z",
  checkpoint_digest: `sha256:${"2".repeat(64)}`,
  notebook_continuation_authority: true,
  evaluation_authority: false,
  admission_authority: false,
  promotion_authority: false,
  order_submission_authority: false,
  live_exchange_authority: false,
  authority_status: "research_only"
} satisfies ResearchWorkerCheckpointRecord;

const priorCheckpoint = {
  research_worker_checkpoint_id:
    priorCheckpointRecord.research_worker_checkpoint_id,
  terminal_status: "completed",
  terminal_reason: "admission_recorded",
  admission_status: "admitted",
  admission_reason: "evaluation_accepted",
  notebook: structuredClone(priorCheckpointRecord.notebook)
} satisfies TradingResearchPriorCheckpoint;

const priorAdmissionDecision = {
  record_kind: "candidate_admission_decision",
  version: 1,
  candidate_admission_decision_id: "candidate-admission-prior",
  research_preflight_commitment_ref: {
    record_kind: "research_preflight_commitment",
    id: "research-preflight-prior"
  },
  research_preflight_commitment_digest: `sha256:${"1".repeat(64)}`,
  source_system_code_ref: {
    record_kind: "system_code",
    id: "source-system-code-prior"
  },
  system_code_ref: {
    record_kind: "system_code",
    id: "submitted-system-code-prior"
  },
  experiment_run_ref: {
    record_kind: "experiment_run",
    id: "experiment-run-prior"
  },
  trading_evaluation_result_ref: {
    record_kind: "trading_evaluation_result",
    id: "trading-evaluation-prior"
  },
  research_finding_ref: {
    record_kind: "research_finding",
    id: "research-finding-prior"
  },
  source_artifact_digest: `sha256:${"4".repeat(64)}`,
  submitted_artifact_digest: `sha256:${"5".repeat(64)}`,
  research_worker_outcome: "changed",
  experiment_status: "evaluated",
  evaluation_status: "accepted",
  evidence_disposition: "not_counted",
  status: "admitted",
  reason: "evaluation_accepted",
  runnable_paper_handoff: true,
  decided_at: "2026-07-12T23:59:00.000Z",
  authority_status: "not_live"
} satisfies CandidateAdmissionDecisionRecord;

const assignment = {
  study_ref: {
    record_kind: "research_memory_control_study",
    id: "research-memory-control-study-fixture"
  },
  study_digest: `sha256:${"3".repeat(64)}`,
  pair_index: 1,
  arm_kind: "released_memory_treatment"
} satisfies ResearchWorkerMemoryControlAssignment;

describe("ResearchWorker memory projection", () => {
  it("binds the same safe memory source while masking all cross-generation payload", () => {
    const currentContext = {
      requested_direction: "trend_following",
      current_research_selection: {
        direction_kind: "trend_following",
        selection_kind: "explicit",
        priority: 1,
        experiment_budget: 1,
        signal_score: 0,
        reasons: ["explicit_direction"]
      },
      task: "Submit one bounded TradingSystem candidate."
    };
    const memoryContext = {
      latest_findings: [
        { candidate_id: "candidate-a", finding: "duplicate" },
        { candidate_id: "candidate-b", finding: "negative" }
      ],
      finding_clusters: {
        cluster_count: 1,
        authority_status: "not_promotion_authority"
      }
    };

    const released = buildResearchWorkerMemoryProjection({
      mode: "released_memory",
      currentContext,
      memoryContext,
      priorCheckpointRecord,
      priorCheckpoint,
      priorAdmissionDecision,
      controlAssignment: assignment
    });
    const masked = buildResearchWorkerMemoryProjection({
      mode: "memory_masked",
      currentContext,
      memoryContext,
      priorCheckpointRecord,
      priorCheckpoint,
      priorAdmissionDecision,
      controlAssignment: {
        ...assignment,
        arm_kind: "memory_masked_control"
      }
    });

    expect(JSON.parse(released.arenaContext)).toEqual({
      ...currentContext,
      latest_findings: memoryContext.latest_findings,
      finding_clusters: { cluster_count: 1 },
      research_memory_policy: { memory_mode: "released_memory" }
    });
    expect(JSON.parse(masked.arenaContext)).toEqual({
      ...currentContext,
      research_memory_policy: { memory_mode: "memory_masked" }
    });
    expect(released.priorCheckpoint).toEqual(priorCheckpoint);
    expect(masked.priorCheckpoint).toBeUndefined();
    expect(released.policy.memory_source_digest).toBe(
      masked.policy.memory_source_digest
    );
    expect(released.policy.available_memory_item_count).toBe(4);
    expect(masked.policy.available_memory_item_count).toBe(4);
    expect(released.policy.arena_context_digest).not.toBe(
      masked.policy.arena_context_digest
    );
    expect(released.policy.arena_context_digest).toBe(
      `sha256:${createHash("sha256").update(released.arenaContext).digest("hex")}`
    );
    expect(masked.policy.arena_context_digest).toBe(
      `sha256:${createHash("sha256").update(masked.arenaContext).digest("hex")}`
    );
    expect(released.policy.prior_checkpoint.disposition).toBe("included");
    expect(masked.policy.prior_checkpoint.disposition).toBe("masked");
    expect(released.policy.control_assignment).toEqual(assignment);
    expect(masked.policy.control_assignment?.arm_kind).toBe(
      "memory_masked_control"
    );
    expect(released.arenaContext).not.toContain("authority_status");
  });

  it("records no prior checkpoint when none was available", () => {
    const projection = buildResearchWorkerMemoryProjection({
      mode: "released_memory",
      currentContext: {
        requested_direction: "mean_reversion",
        task: "Submit one bounded TradingSystem candidate."
      },
      memoryContext: { latest_findings: [] }
    });

    expect(projection.policy.available_memory_item_count).toBe(0);
    expect(projection.policy.prior_checkpoint).toEqual({
      disposition: "none_available"
    });
    expect(projection.priorCheckpoint).toBeUndefined();
  });

  it("rejects incomplete checkpoint and control assignment evidence", () => {
    expect(() => buildResearchWorkerMemoryProjection({
      mode: "released_memory",
      currentContext: { task: "bounded" },
      memoryContext: {},
      priorCheckpointRecord
    })).toThrow("research_worker_memory_prior_checkpoint_mismatch");

    expect(() => buildResearchWorkerMemoryProjection({
      mode: "released_memory",
      currentContext: { task: "bounded" },
      memoryContext: {},
      controlAssignment: {
        ...assignment,
        pair_index: 0
      }
    })).toThrow("research_worker_memory_control_assignment_invalid");

    const projection = buildResearchWorkerMemoryProjection({
      mode: "released_memory",
      currentContext: { task: "bounded" },
      memoryContext: {},
      priorCheckpointRecord,
      priorCheckpoint,
      priorAdmissionDecision
    });
    expect(researchWorkerMemoryPolicyHasRuntimeShape({
      ...projection.policy,
      memory_mode: "memory_masked"
    })).toBe(false);

    expect(() => buildResearchWorkerMemoryProjection({
      mode: "released_memory",
      currentContext: { task: "bounded" },
      memoryContext: {},
      priorCheckpointRecord,
      priorCheckpoint: {
        ...priorCheckpoint,
        admission_status: "quarantined",
        admission_reason: "evaluation_disqualified"
      },
      priorAdmissionDecision
    })).toThrow("research_worker_memory_prior_admission_mismatch");
  });
});
