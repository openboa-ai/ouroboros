import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  researchWorkerCheckpointDigestInput,
  researchWorkerCheckpointHasRuntimeShape,
  type ResearchWorkerCheckpointRecord
} from "./index";

describe("ResearchWorkerCheckpoint", () => {
  it("canonically binds lifecycle, budget, notebook, and terminal admission evidence", () => {
    const baseline = checkpointFixture();
    const digestInput = researchWorkerCheckpointDigestInput(baseline);
    const mutations: Array<[
      string,
      (record: ResearchWorkerCheckpointRecord) => void
    ]> = [
      ["worker", (record) => { record.research_worker_ref.id = "research-worker-other"; }],
      ["direction", (record) => { record.research_direction_ref.id = "research-direction-other"; }],
      ["tick", (record) => { record.candidate_arena_tick_id = "tick-8"; }],
      ["commitment", (record) => {
        record.research_preflight_commitment_digest = digest("other-preflight");
      }],
      ["previous checkpoint", (record) => {
        record.previous_checkpoint_digest = digest("other-checkpoint");
      }],
      ["budget", (record) => { record.development_budget.submission_limit = 2; }],
      ["notebook", (record) => { record.notebook.recent_entries[0]!.decision = "keep"; }],
      ["terminal status", (record) => { record.terminal_status = "failed_closed"; }],
      ["close time", (record) => { record.closed_at = "2026-07-12T10:00:03.000Z"; }]
    ];

    for (const [label, mutate] of mutations) {
      const changed = structuredClone(baseline);
      mutate(changed);
      expect(researchWorkerCheckpointDigestInput(changed), label).not.toBe(digestInput);
    }

    const digestOnly = structuredClone(baseline);
    digestOnly.checkpoint_digest = digest("replacement");
    expect(researchWorkerCheckpointDigestInput(digestOnly)).toBe(digestInput);
  });

  it("accepts completed and failed-closed records with exact terminal cardinality", () => {
    expect(researchWorkerCheckpointHasRuntimeShape(checkpointFixture())).toBe(true);

    const failed = checkpointFixture();
    failed.terminal_status = "failed_closed";
    failed.terminal_reason = "restart_recovery";
    delete failed.candidate_admission_decision_ref;
    expect(researchWorkerCheckpointHasRuntimeShape(failed)).toBe(true);
  });

  it("accepts a completed no-submission closure without an admission reference", () => {
    const noSubmission = checkpointFixture();
    noSubmission.terminal_status = "completed";
    noSubmission.terminal_reason = "finished_without_submission";
    delete noSubmission.candidate_admission_decision_ref;

    expect(researchWorkerCheckpointHasRuntimeShape(noSubmission)).toBe(true);
  });

  it("accepts an empty first checkpoint after pre-entry process loss", () => {
    const failed = checkpointFixture();
    delete failed.previous_checkpoint_ref;
    delete failed.previous_checkpoint_digest;
    delete failed.candidate_admission_decision_ref;
    failed.development_budget = {
      submission_limit: 2,
      recorded_submission_count: 0,
      cumulative_committed_submission_limit: 2,
      cumulative_recorded_submission_count: 0,
      remaining_submission_authority: 0
    };
    failed.notebook = {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: 0,
      recent_entries: []
    };
    failed.terminal_status = "failed_closed";
    failed.terminal_reason = "execution_failed";

    expect(researchWorkerCheckpointHasRuntimeShape(failed)).toBe(true);
  });

  it.each([
    ["missing property", (record: any) => { delete record.workspace_key; }],
    ["extra property", (record: any) => { record.sealed_score = 1; }],
    ["wrong record kind", (record: any) => { record.record_kind = "other"; }],
    ["wrong worker ref", (record: any) => {
      record.research_worker_ref.record_kind = "agent_profile";
    }],
    ["wrong direction ref", (record: any) => {
      record.research_direction_ref.record_kind = "research_worker";
    }],
    ["wrong commitment ref", (record: any) => {
      record.research_preflight_commitment_ref.record_kind = "experiment_run";
    }],
    ["invalid commitment digest", (record: any) => {
      record.research_preflight_commitment_digest = "pending";
    }],
    ["absolute workspace", (record: any) => {
      record.workspace_key = "/tmp/candidate-arena-workers/research-worker-trend";
    }],
    ["traversing workspace", (record: any) => {
      record.workspace_key = "candidate-arena-workers/../escaped";
    }],
    ["unpaired previous ref", (record: any) => { delete record.previous_checkpoint_digest; }],
    ["wrong previous ref", (record: any) => {
      record.previous_checkpoint_ref.record_kind = "research_preflight_commitment";
    }],
    ["invalid previous digest", (record: any) => {
      record.previous_checkpoint_digest = "sha256:short";
    }],
    ["zero submission limit", (record: any) => {
      record.development_budget.submission_limit = 0;
    }],
    ["recorded over limit", (record: any) => {
      record.development_budget.recorded_submission_count = 2;
    }],
    ["cumulative committed under current", (record: any) => {
      record.development_budget.cumulative_committed_submission_limit = 0;
    }],
    ["cumulative recorded under current", (record: any) => {
      record.development_budget.cumulative_recorded_submission_count = 0;
    }],
    ["remaining submission authority", (record: any) => {
      record.development_budget.remaining_submission_authority = 1;
    }],
    ["unknown notebook protocol", (record: any) => {
      record.notebook.protocol_version = "research_worker_notebook_v2";
    }],
    ["notebook count mismatch", (record: any) => {
      record.notebook.total_entry_count += 1;
    }],
    ["too many recent entries", (record: any) => {
      record.notebook.total_entry_count = 7;
      record.development_budget.cumulative_recorded_submission_count = 7;
      record.notebook.recent_entries = Array.from({ length: 7 }, (_, index) => ({
        ...structuredClone(record.notebook.recent_entries[0]),
        sequence: index + 1
      }));
    }],
    ["non-tail sequence", (record: any) => {
      record.notebook.recent_entries[0].sequence = 4;
    }],
    ["extra notebook entry property", (record: any) => {
      record.notebook.recent_entries[0].sealed_outcome = "accepted";
    }],
    ["invalid entry iteration", (record: any) => {
      record.notebook.recent_entries[0].iteration = 0;
    }],
    ["unknown decision", (record: any) => {
      record.notebook.recent_entries[0].decision = "retry";
    }],
    ["unknown agent status", (record: any) => {
      record.notebook.recent_entries[0].agent_status = "running";
    }],
    ["non-finite score", (record: any) => {
      record.notebook.recent_entries[0].score = Number.NaN;
    }],
    ["oversized summary", (record: any) => {
      record.notebook.recent_entries[0].summary = "x".repeat(501);
    }],
    ["unknown evaluation status", (record: any) => {
      record.notebook.recent_entries[0].evaluation_status = "pending";
    }],
    ["unknown risk decision", (record: any) => {
      record.notebook.recent_entries[0].risk_decision = "live_order";
    }],
    ["non-finite net revenue", (record: any) => {
      record.notebook.recent_entries[0].net_revenue_usdt = Number.POSITIVE_INFINITY;
    }],
    ["completed execution failure", (record: any) => {
      record.terminal_reason = "execution_failed";
    }],
    ["failed admission closure", (record: any) => {
      record.terminal_status = "failed_closed";
    }],
    ["completed without admission", (record: any) => {
      delete record.candidate_admission_decision_ref;
    }],
    ["failed with admission", (record: any) => {
      record.terminal_status = "failed_closed";
      record.terminal_reason = "restart_recovery";
    }],
    ["wrong admission ref", (record: any) => {
      record.candidate_admission_decision_ref.record_kind = "trading_evaluation_result";
    }],
    ["non-canonical close time", (record: any) => {
      record.closed_at = "2026-07-12 10:00:02";
    }],
    ["invalid checkpoint digest", (record: any) => {
      record.checkpoint_digest = "pending";
    }],
    ["no notebook continuation authority", (record: any) => {
      record.notebook_continuation_authority = false;
    }],
    ["evaluation authority", (record: any) => { record.evaluation_authority = true; }],
    ["admission authority", (record: any) => { record.admission_authority = true; }],
    ["promotion authority", (record: any) => { record.promotion_authority = true; }],
    ["order authority", (record: any) => { record.order_submission_authority = true; }],
    ["live authority", (record: any) => { record.live_exchange_authority = true; }],
    ["wrong authority status", (record: any) => { record.authority_status = "not_live"; }]
  ])("rejects invalid %s", (_label, mutate) => {
    const record = checkpointFixture() as any;
    mutate(record);
    expect(researchWorkerCheckpointHasRuntimeShape(record)).toBe(false);
  });
});

function checkpointFixture(): ResearchWorkerCheckpointRecord {
  return {
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id: "research-worker-checkpoint-preflight-tick-7",
    research_worker_ref: {
      record_kind: "research_worker",
      id: "research-worker-trend-codex"
    },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "research-direction-trend-following"
    },
    candidate_arena_tick_id: "tick-7",
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: "research-preflight-tick-7"
    },
    research_preflight_commitment_digest: digest("preflight-tick-7"),
    workspace_key: "candidate-arena-workers/research-worker-trend-codex",
    previous_checkpoint_ref: {
      record_kind: "research_worker_checkpoint",
      id: "research-worker-checkpoint-preflight-tick-6"
    },
    previous_checkpoint_digest: digest("checkpoint-tick-6"),
    development_budget: {
      submission_limit: 1,
      recorded_submission_count: 1,
      cumulative_committed_submission_limit: 3,
      cumulative_recorded_submission_count: 3,
      remaining_submission_authority: 0
    },
    notebook: {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: 3,
      recent_entries: [
        {
          sequence: 1,
          candidate_arena_tick_id: "tick-5",
          iteration: 1,
          decision: "discard",
          agent_status: "edited",
          score: 0.2,
          summary: "Earlier development candidate increased cost.",
          evaluation_status: "accepted",
          risk_decision: "valid_order_request",
          net_revenue_usdt: -0.5
        },
        {
          sequence: 2,
          candidate_arena_tick_id: "tick-6",
          iteration: 1,
          decision: "crash",
          agent_status: "failed",
          score: 0,
          summary: "Provider process exited before development evaluation.",
          evaluation_status: "disqualified",
          risk_decision: "no_order_request",
          net_revenue_usdt: 0
        },
        {
          sequence: 3,
          candidate_arena_tick_id: "tick-7",
          iteration: 1,
          decision: "keep",
          agent_status: "edited",
          score: 0.8,
          summary: "Development net revenue improved after costs.",
          evaluation_status: "accepted",
          risk_decision: "valid_order_request",
          net_revenue_usdt: 1.25
        }
      ]
    },
    terminal_status: "completed",
    terminal_reason: "admission_recorded",
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: "candidate-admission-decision-tick-7"
    },
    closed_at: "2026-07-12T10:00:02.000Z",
    checkpoint_digest: digest("checkpoint-tick-7"),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
