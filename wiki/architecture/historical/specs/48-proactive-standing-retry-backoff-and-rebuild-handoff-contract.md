# Proactive Standing Retry Backoff And Rebuild Handoff Contract

## Thesis

Standing update retries should be bounded, back off explicitly, and hand off to rebuild when retry
can no longer safely converge.

## Why This Spec Exists

autokairos already defines:

- stable update cycle
- explicit trust downgrade
- explicit scope claim

Implementation still needs one narrower contract:

**when should the system retry, how aggressively should it retry, and when should it stop retrying
and instead request rebuild?**

Without this spec:

- repeated failures can create hot retry loops
- claim-loss and lag scenarios blur into generic failure
- rebuild handoff becomes inconsistent across implementations

## Canonical Object / Interface / Boundary

This spec defines retry and escalation semantics for one standing update cycle.

It sits between:

- failed or aborted cycle outcomes
- later retry attempts
- rebuild request issuance

## Required Fields Or Required Behaviors

## 1. Retry posture classes

The architecture should support at least:

- `retryable_now`
- `retryable_with_backoff`
- `requires_rebuild_handoff`
- `requires_operator_attention`

The exact enum may vary.

## 2. Backoff rule

Retry should not hot-loop.

Required behavior:

- repeated retryable failures increase delay or reduce urgency
- backoff posture remains inspectable

## 3. Safe-retry rule

Retry is appropriate only when:

- the failure does not invalidate the standing model itself
- a fresh claim can be obtained
- a later attempt may plausibly succeed from durable state

Examples:

- transient claim loss
- temporary linkage lag
- temporary store unavailability

## 4. Rebuild-handoff rule

The system should request rebuild instead of retrying indefinitely when:

- repeated retries do not advance confidence or coverage
- continuity of authority or history cannot be proven
- projection state appears corrupted or inconsistent
- claim churn indicates the updater cannot safely converge

## 5. Handoff visibility rule

When rebuild handoff occurs, the system should leave durable visibility of:

- why retry stopped
- what failure class triggered rebuild handoff
- which governed scope now requires rebuild

## 6. Retry idempotency rule

Retried cycles must restart from durable state rather than from hidden in-memory partial progress.

## Lifecycle Or State Model

The retry/escalation posture should be read as:

`cycle failure or abort -> classify retryability -> back off when retryable -> escalate to rebuild handoff when retries stop improving confidence`

## What This Is Not

This spec is not:

- one exponential-backoff formula
- one queue retry implementation
- one SRE runbook

It is the canonical retry and handoff semantics only.

## Failure Modes / Invariants

### Invariants

- retries are bounded and inspectable
- rebuild handoff is explicit rather than accidental
- retried cycles restart from durable truth
- transient failure does not immediately force rebuild

### Failure modes

- repeated failures hot-loop forever
- claim loss is retried endlessly without progress
- rebuild is required but never requested
- retry resumes from hidden local state and diverges from durable history

## Relationship To Adjacent Specs

- [44-proactive-standing-update-cycle-contract.md](44-proactive-standing-update-cycle-contract.md)
  defines the cycle that may fail, abort, or retry.
- [45-proactive-standing-scope-claim-contract.md](45-proactive-standing-scope-claim-contract.md)
  defines claim-loss semantics that may trigger retry.
- [46-proactive-standing-cycle-outcome-record-contract.md](46-proactive-standing-cycle-outcome-record-contract.md)
  defines the durable outcome history that should capture retry/backoff/handoff posture when
  meaningful.
- [47-proactive-standing-claim-lease-and-expiry-contract.md](47-proactive-standing-claim-lease-and-expiry-contract.md)
  defines how dead or expired ownership becomes reclaimable before retry.
- [49-proactive-standing-rebuild-request-contract.md](49-proactive-standing-rebuild-request-contract.md)
  defines the durable recovery request that should exist once rebuild handoff happens.
