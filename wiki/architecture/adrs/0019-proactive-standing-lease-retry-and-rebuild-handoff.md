# ADR 0019: Proactive Standing Lease, Retry, And Rebuild Handoff

## Status

Accepted

## Context

autokairos already fixes:

- single-scope standing claim
- stable update cycle
- visible cycle outcomes

That still leaves one recovery gap.

Without explicit lease and retry semantics, stale claims may block progress, repeated failures may
hot-loop, and rebuild may be requested too late or too inconsistently.

## Decision

autokairos will treat standing-claim ownership as an expiring lease and treat retry as a bounded
recovery mode that hands off to rebuild when confidence stops improving.

The architecture keeps:

- lease backend flexible
- retry transport flexible
- exact timing and formulas flexible

But fixes:

- expiry and reclaim semantics
- the requirement that retry be bounded and inspectable
- the requirement that rebuild handoff become explicit once retry is no longer safe

## Alternatives Considered

### 1. Permanent claims with manual cleanup

Rejected because recovery would depend too much on operator repair.

### 2. Infinite retry until success

Rejected because it creates hot loops and hides the point where rebuild became the safer choice.

### 3. Immediate rebuild on first failure

Rejected because transient claim loss and temporary lag should stay recoverable without forcing full
rebuild.

## Consequences

### Positive

- stale ownership becomes recoverable by default
- retry and rebuild become easier to reason about
- concurrency and failure posture stay explicit without hard-wiring one backend

### Negative

- one more recovery-specific semantic layer must be implemented
- claim renewal and rebuild handoff need careful observability

## Supersedes / Superseded By

- Extends [0018-proactive-standing-claim-and-cycle-outcomes.md](0018-proactive-standing-claim-and-cycle-outcomes.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
