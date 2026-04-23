# Proactive Evaluation Record Store Contract

## Thesis

The first persisted proactive-evaluation store should remain small but explicit:

- one append-only evaluation header
- one append-only downstream-link family

## Why This Spec Exists

autokairos now has:

- the conceptual `ProactiveEvaluationRecord`
- a causal-linkage contract from evaluation into execution
- a standing-view contract with watermark and reconciliation rules

Implementation still needs one narrower decision:

**what should the first persisted proactive-evaluation shapes actually be?**

Without that decision, the system will drift toward:

- one opaque evaluation JSON blob
- logs as the only explanation of downstream disposition
- standing rows that carry more causality than the durable history does

## Canonical Object / Interface / Boundary

This spec defines the first-cut persisted proactive-evaluation family:

1. `ProactiveEvaluationRecordHeader`
2. `ProactiveEvaluationDownstreamLink`

It sits above:

- normalized proactive candidates
- clause and precedence evaluation

And below:

- `WakeTriggerRecord`
- `ExecutionRequest`
- review or escalation intake
- current proactive standing

## Required Fields Or Required Behaviors

## 1. ProactiveEvaluationRecordHeader

This is the append-only durable header for one evaluated proactive candidate.

### Required fields

| Field | Notes |
| --- | --- |
| `proactive_evaluation_record_id` | Primary durable identifier |
| `governed_scope_key` | Scope the candidate was evaluated against |
| `candidate_cause_kind` | Cadence, event, self-scheduling proposal, operator change, or equivalent |
| `normalized_candidate_ref` or `candidate_summary_payload` | What was evaluated |
| `evaluation_time` | When evaluation finished |
| `outcome_class` | `emitted`, `suppressed`, `coalesced`, `escalated`, or `rejected` |
| `outcome_reason_code` | Structured outcome explanation |
| `phase_summary_payload` | Authority, clause, and precedence summary |
| `schema_or_program_version_ref` | Versioning for replay and audit |

### Strongly recommended nullable fields

| Field | Notes |
| --- | --- |
| `primary_precedence_reason` | Why this outcome beat alternatives |
| `applied_wake_policy_refs_payload` | Stable envelope for applied policies |
| `applied_standing_order_refs_payload` | Stable envelope for applied standing authority |
| `authority_snapshot_ref` | Optional stable pointer to the authority horizon |
| `history_sequence` | Append-only chronology helper when supported |
| `operator_or_system_origin_ref` | Human or system source when meaningful |

### Required behavior

`ProactiveEvaluationRecordHeader` must be the canonical owner of:

- evaluated proactive candidate identity
- outcome class
- outcome reason
- evaluation chronology

It should not attempt to own all downstream emitted-object linkage inline.

## 2. ProactiveEvaluationDownstreamLink

This is the append-only link family connecting one proactive evaluation to downstream durable
objects or explicit non-emission posture.

### Required fields

| Field | Notes |
| --- | --- |
| `proactive_evaluation_downstream_link_id` | Primary durable link identifier |
| `proactive_evaluation_record_ref` | Owning evaluation record |
| `link_kind` | `wake_trigger`, `execution_request`, `review_item`, `non_emission`, or equivalent |
| `linked_object_ref` | Durable downstream object when one exists |
| `link_role` | `primary`, `coalesced`, `escalation`, `non_emitted`, or equivalent |
| `created_at` | Link creation timestamp |

### Strongly recommended nullable fields

| Field | Notes |
| --- | --- |
| `wake_trigger_record_ref` | Convenience pointer when the linked object is a wake record |
| `execution_request_ref` | Convenience pointer when execution was emitted |
| `review_item_ref` | Convenience pointer when escalation was created |
| `non_emission_reason_code` | Explicit why-no-work posture |
| `causal_rank` | Ordering helper for primary vs coalesced outcomes |

### Required behavior

This link family must make it possible to answer:

- which wake trigger came out of this evaluation?
- which request was ultimately emitted from it?
- was no work emitted, and if so, why?
- did this evaluation escalate into review instead?

## 3. Required query surfaces

The first store should support:

- latest proactive evaluations by `governed_scope_key`
- emitted evaluations by `outcome_class`
- evaluations that produced one `WakeTriggerRecord`
- evaluations that produced one `ExecutionRequest`
- evaluations with only `non_emission` downstream links
- all downstream links for one evaluation in causal order

## Lifecycle Or State Model

The stable persisted path is:

1. append `ProactiveEvaluationRecordHeader`
2. append zero or more `ProactiveEvaluationDownstreamLink`s
3. update or reconcile current proactive standing downstream

The important invariant is that the header and downstream links remain append-only durable history.

## What This Is Not

This spec is not:

- one universal policy-evaluation ledger for every future subsystem
- one denormalized blob carrying all wake, request, and standing state together
- one backend-specific DDL file

It is the first narrow persisted shape for proactive evaluation history only.

## Failure Modes / Invariants

### Invariants

- every proactive evaluation has one durable header
- downstream work or explicit non-emission remains attributable to that header
- emitted and non-emitted outcomes remain equally durable
- current standing stays downstream of this family

### Failure modes

- the only durable record is a current standing row
- emitted work exists but cannot be joined back to one evaluation
- suppressed or escalated outcomes live only in logs
- all downstream causality is hidden inside one free-form payload

## Relationship To Adjacent Specs

- [36-proactive-evaluation-record-contract.md](36-proactive-evaluation-record-contract.md)
  defines the canonical higher-level history object above this persisted shape.
- [38-proactive-evaluation-to-execution-linkage-contract.md](38-proactive-evaluation-to-execution-linkage-contract.md)
  defines the causality rule this store shape must preserve.
- [23-wake-trigger-record-contract.md](23-wake-trigger-record-contract.md)
  defines the adjacent emitted or suppressed wake-history object.
- [41-proactive-standing-view-store-and-rebuild-contract.md](41-proactive-standing-view-store-and-rebuild-contract.md)
  defines the projection layer that should remain downstream of this history family.
