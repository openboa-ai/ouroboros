# Proactive Standing Projection Updater Contract

## Thesis

`CurrentProactiveStandingView` should be mutated only by one explicit projection-updater boundary
that consumes durable history and active authority, advances watermarks when safe, and requests
rebuild when safe advancement is impossible.

## Why This Spec Exists

autokairos already defines:

- append-only proactive evaluation history
- one rebuildable current standing view per governed scope
- watermark and reconciliation posture

Implementation still needs one narrower contract:

**what component is allowed to mutate standing, what inputs wake it, and what outcomes may it
write?**

Without this spec:

- standing mutation will leak into scheduler code, operator tools, or runtime helpers
- watermark advancement will be inconsistent across code paths
- rebuild and trust downgrade will remain hidden implementation details

## Canonical Object / Interface / Boundary

This spec defines one canonical mutation boundary:

1. `ProactiveStandingProjectionUpdater`

It sits above:

- active `WakePolicy` and `StandingOrder`
- `ProactiveEvaluationRecordHeader`
- `ProactiveEvaluationDownstreamLink`
- `WakeTriggerRecord`
- `ExecutionRequest` linkage when needed

And below:

- `CurrentProactiveStandingView`
- operator and runtime reads

## Required Fields Or Required Behaviors

## 1. Ownership rule

`ProactiveStandingProjectionUpdater` must be the only canonical writer of:

- `CurrentProactiveStandingView`
- standing watermark advancement
- standing reconciliation status
- standing trust posture

No other subsystem should directly mutate those fields opportunistically.

## 2. Input triggers

The updater must support wake-up from at least:

- appended proactive evaluation history
- authority change or supersession
- downstream linkage arrival
- periodic freshness review
- explicit rebuild request

The exact transport is flexible.

The trigger classes are not.

## 3. Read set

For one governed scope, the updater must be able to load:

- current standing view if present
- effective authority envelope
- relevant proactive evaluation history after the current watermark
- relevant downstream linkage for the target posture
- rebuild or drift flags when they already exist

## 4. Allowed outcomes

For each wake-up, the updater must produce one of these classes of outcomes:

- `no_change`
- `incremental_advance`
- `trust_downgrade`
- `mark_catching_up`
- `mark_drift_detected`
- `request_rebuild`
- `complete_rebuild`
- `fail_reconciliation`

The exact enum may vary, but these semantic classes must remain visible.

## 5. Incremental advancement rule

Incremental advancement is allowed only when:

- authority coverage remains valid
- history is contiguous with the current watermark
- required downstream linkage exists or is explicitly `not_applicable`
- no drift reason currently blocks trusted progression

## 6. Rebuild request rule

The updater must request rebuild when:

- authority coverage is invalid or unknown
- history continuity is broken
- current projection state is missing or corrupted
- incremental advancement cannot prove causal coverage

## 7. Idempotency rule

The updater must remain safe under retried or duplicate trigger delivery.

Required behavior:

- replaying the same trigger must not invent new chronology
- repeated incremental application should converge on one standing state
- rebuild completion should supersede older lag or drift flags cleanly

## 8. Required query and operation surfaces

The first implementation should support:

- update one standing scope from one trigger cause
- catch up all standing scopes that are behind
- rebuild one standing scope on demand
- list standing scopes requiring catch-up or rebuild

## Lifecycle Or State Model

The updater lifecycle should be read as:

`triggered -> load authority and history -> decide incremental advance or rebuild -> mutate standing -> expose updated reconciliation and trust posture`

## What This Is Not

This spec is not:

- one daemon process topology
- one database transaction recipe
- one exact queue or scheduler choice
- a replacement for append-only proactive history

It is the canonical mutation boundary only.

## Failure Modes / Invariants

### Invariants

- current standing has one canonical mutation owner
- watermark advancement never outruns causal coverage
- rebuild remains explicit when continuity cannot be proven
- duplicate updater triggers do not create duplicate chronology

### Failure modes

- scheduler code writes current standing directly after emitting work
- runtime reads a standing view that skipped missing linkage
- rebuild silently rewrites trust posture with no explicit reconciliation state
- multiple updaters race and overwrite standing inconsistently

## Relationship To Adjacent Specs

- [41-proactive-standing-view-store-and-rebuild-contract.md](41-proactive-standing-view-store-and-rebuild-contract.md)
  defines the persisted standing-view shape this updater owns.
- [39-proactive-standing-watermark-and-reconciliation-contract.md](39-proactive-standing-watermark-and-reconciliation-contract.md)
  defines the trust and rebuild semantics this updater must preserve.
- [40-proactive-evaluation-record-store-contract.md](40-proactive-evaluation-record-store-contract.md)
  defines the durable history family this updater consumes.
- [43-proactive-standing-trust-downgrade-contract.md](43-proactive-standing-trust-downgrade-contract.md)
  defines the downgrade rules the updater must apply explicitly.
