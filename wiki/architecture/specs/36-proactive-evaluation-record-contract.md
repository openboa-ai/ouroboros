# Proactive Evaluation Record Contract

## Thesis

Each evaluated proactive candidate should produce a durable `ProactiveEvaluationRecord` so emitted,
suppressed, coalesced, escalated, or rejected outcomes remain reconstructable after the fact.

## Why This Spec Exists

autokairos now has:

- extensible proactive policy programs
- a stable multi-phase evaluation pipeline
- wake-trigger history
- governed execution requests

That still leaves one gap.

Without a dedicated evaluation-history object:

- only emitted wake triggers stay visible
- suppressed or rejected proactive work becomes hard to audit
- current standing views cannot point back to one canonical last-evaluation record

## Canonical Object / Interface / Boundary

This spec defines `ProactiveEvaluationRecord`.

This object sits:

- above normalized proactive candidates and applicable authority snapshots
- below wake-trigger history, execution-request creation, and review/escalation work

It is append-only durable history.

It is not a projection and not a scheduler-local cache.

## Required Fields Or Required Behaviors

A `ProactiveEvaluationRecord` must preserve:

- `proactive_evaluation_record_id`
- evaluated scope key or governed scope reference
- normalized candidate reference or inline candidate summary
- candidate cause kind
  - cadence, event, self-scheduling proposal, operator change, or equivalent
- applicable `WakePolicy` references
- applicable `StandingOrder` references
- evaluation timestamp
- evaluation phase summary
  - authority checked, clauses evaluated, precedence resolved
- outcome class
  - emitted, suppressed, coalesced, escalated, rejected
- structured outcome reason
- primary precedence reason when applicable
- downstream linkage when applicable
  - `WakeTriggerRecord`, `ExecutionRequest`, `ReviewItem`, or equivalent
- non-emission posture when applicable
  - explicit indication that no wake or request was emitted
- provenance and schema/program version references

### Required behavior

The record must remain expressive enough to explain:

- what was evaluated
- under which authority
- why the final proactive outcome happened
- what object was emitted or not emitted as a consequence

## Lifecycle Or State Model

`ProactiveEvaluationRecord` is history, so its lifecycle is simple:

`evaluated -> stored durably -> referenced by projections, audit, and downstream reads`

It may later be archived or replayed, but should not be rewritten to mean a different evaluation
occurred.

## What This Is Not

This object is not:

- one `WakePolicy`
- one `StandingOrder`
- one `WakeTriggerRecord`
- one `ExecutionRequest`
- one current-state proactive view
- one candidate `EvidenceRecord`

This spec is specifically about proactive-policy evaluation history, not candidate evaluation or
promotion governance.

## Failure Modes / Invariants

### Invariants

- suppressed, coalesced, escalated, and emitted proactive outcomes remain durably explainable
- a current standing view can point back to one or more concrete evaluation records
- evaluation chronology remains distinct from trigger-emission chronology

### Failure modes

- only emitted wakes are recorded, while suppressions disappear
- proactive evaluation explanation lives only in logs
- one mutable standing row is the only surviving evidence of evaluation
- proactive evaluation is confused with candidate evidence or promotion history

## Relationship To Adjacent Specs

- [35-policy-program-evaluation-and-resolution-contract.md](35-policy-program-evaluation-and-resolution-contract.md)
  defines the stable phase pipeline that produces this record.
- [23-wake-trigger-record-contract.md](23-wake-trigger-record-contract.md)
  defines the adjacent history object for emitted or suppressed wake-trigger outcomes.
- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
  defines the downstream execution object that may be created from this evaluation.
- [37-current-proactive-standing-view-contract.md](37-current-proactive-standing-view-contract.md)
  defines the projection surface that should remain downstream of this history.
- [38-proactive-evaluation-to-execution-linkage-contract.md](38-proactive-evaluation-to-execution-linkage-contract.md)
  defines the stricter causality rule that keeps this record attributable to emitted wake and
  execution history when work is started.
- [40-proactive-evaluation-record-store-contract.md](40-proactive-evaluation-record-store-contract.md)
  defines the first persisted history shapes that should carry this record's durable meaning.
