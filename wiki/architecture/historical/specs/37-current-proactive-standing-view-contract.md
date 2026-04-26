# Current Proactive Standing View Contract

## Thesis

autokairos should maintain a `CurrentProactiveStandingView` so operators and downstream systems can
read the present proactive posture without replaying all proactive history on every query.

## Why This Spec Exists

The architecture now distinguishes:

- durable proactive authority
- append-only proactive evaluation history
- emitted wake-trigger and execution-request history

That is still not enough for live operations.

The system also needs a readable current surface answering:

- what proactive authority is active now
- what the most recent evaluation standing is
- whether escalation or review is pending
- how fresh this standing surface is

## Canonical Object / Interface / Boundary

This spec defines `CurrentProactiveStandingView`.

It is a rebuildable current-state projection derived from:

- active `WakePolicy` and `StandingOrder` objects
- `ProactiveEvaluationRecord` history
- related wake-trigger and escalation history where needed

It is a current read surface, not the deeper chronology.

## Required Fields Or Required Behaviors

A `CurrentProactiveStandingView` must be able to express:

- standing scope key
- currently effective `WakePolicy` references
- currently effective `StandingOrder` references
- latest meaningful proactive evaluation reference
- latest outcome posture
  - emitted, suppressed, coalesced, escalated, or quiet
- active escalation or review posture when applicable
- current next-step or next-eligible posture when meaningful
- freshness or watermark posture
- reconciliation status
- trust posture
- last-updated timestamp

### Required behavior

The projection should support operational reads such as:

- what proactive authority is currently in effect for this scope?
- what happened most recently?
- is there pending escalation or blocked work?
- is this standing view fresh enough to trust for a live decision?

## Lifecycle Or State Model

`CurrentProactiveStandingView` behaves like a projection:

`initialized -> updated from new history -> reconciled or rebuilt when drift is detected`

Unlike `ProactiveEvaluationRecord`, it is expected to change over time.

## What This Is Not

This object is not:

- the source of proactive chronology
- a substitute for `WakePolicy` or `StandingOrder`
- one scheduler implementation state blob
- one candidate standing view

It is a current proactive read surface only.

## Failure Modes / Invariants

### Invariants

- current proactive posture is cheaply readable
- the standing view points back to explicit history and authority references
- losing the standing view is recoverable from durable history and active authority objects

### Failure modes

- this projection becomes the only surviving proactive truth
- no freshness or reconciliation posture exists
- current standing cannot explain which evaluation changed it
- operator reads require full replay of proactive history every time

## Relationship To Adjacent Specs

- [36-proactive-evaluation-record-contract.md](36-proactive-evaluation-record-contract.md)
  defines the append-only proactive-evaluation history beneath this view.
- [21-wake-policy-contract.md](../../specs/21-wake-policy-contract.md)
  defines one source of durable current authority referenced by this view.
- [22-standing-order-contract.md](22-standing-order-contract.md)
  defines the durable authority program referenced by this view.
- [32-current-state-projection-families-contract.md](32-current-state-projection-families-contract.md)
  defines the broader projection-family posture this view belongs to.
- [39-proactive-standing-watermark-and-reconciliation-contract.md](39-proactive-standing-watermark-and-reconciliation-contract.md)
  defines the stricter watermark, freshness, and rebuild semantics that make this view safe to
  trust operationally.
- [41-proactive-standing-view-store-and-rebuild-contract.md](41-proactive-standing-view-store-and-rebuild-contract.md)
  defines the first persisted standing-view shape and rebuild rules beneath this higher-level
  projection contract.
