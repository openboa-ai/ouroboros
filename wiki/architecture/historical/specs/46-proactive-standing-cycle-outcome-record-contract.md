# Proactive Standing Cycle Outcome Record Contract

## Thesis

Non-trivial proactive standing update cycles should leave one append-only outcome record so retries,
claim loss, rebuild requests, and failed cycles remain inspectable after the fact.

## Why This Spec Exists

autokairos already defines:

- a stable standing update cycle
- explicit trust downgrade
- explicit rebuild request semantics

Implementation still needs one narrower contract:

**what minimal outcome visibility should remain after one cycle attempt so operators and later
workers can understand what happened?**

Without this spec:

- cycle failures disappear into transient logs
- rebuild requests have weak provenance
- retries become harder to reason about

## Canonical Object / Interface / Boundary

This spec defines one append-only operational history object:

1. `ProactiveStandingCycleOutcomeRecord`

This is not the same as:

- `ProactiveEvaluationRecord`
- `WakeTriggerRecord`
- `ExecutionAttemptLifecycleEvent`

It is a narrow operational record for standing-maintenance outcomes only.

## Required Fields Or Required Behaviors

## 1. Required identity fields

The record must identify:

- one outcome record id
- one governed scope
- one cycle cause class
- one claim token or equivalent ownership reference when meaningful
- one completion timestamp

## 2. Required outcome fields

The record must preserve:

- primary outcome class
- resulting standing trust posture or reconciliation posture when changed
- rebuild requested flag or reference when applicable
- failure or abort reason when the cycle did not complete normally

## 3. Required durability rule

The first implementation must durably keep outcome records for at least:

- `trust_downgrade`
- `request_rebuild`
- `complete_rebuild`
- `fail_cycle`
- `aborted_due_to_claim_loss`

`no_change` and low-signal successful catch-up outcomes may be sampled, compacted, or omitted if
the implementation chooses, as long as non-trivial outcomes remain visible.

## 4. Required causality references

When meaningful, the record should reference:

- the latest standing view version or standing ref after mutation
- the triggering history horizon or authority revision
- one resulting rebuild request or follow-up action

## 5. Retry rule

Retried cycles may create additional outcome records, but each record must describe one concrete
attempt outcome rather than overwriting prior operational history.

## Lifecycle Or State Model

The outcome-record lifecycle should be read as:

`cycle attempt starts -> cycle ends with one primary outcome -> append one outcome record if outcome is non-trivial`

## What This Is Not

This spec is not:

- one metrics pipeline
- one distributed trace span
- one replacement for standing view state
- a requirement to durably log every `no_change` outcome forever

It is the minimal append-only operational record contract only.

## Failure Modes / Invariants

### Invariants

- non-trivial cycle outcomes remain inspectable after the cycle ends
- rebuild and downgrade provenance do not depend on ephemeral logs only
- retries append new attempt outcomes instead of rewriting prior ones

### Failure modes

- claim loss causes silent retry with no durable trace
- rebuild was requested but no operator can tell why
- a failed cycle leaves standing degraded but no outcome record explains it
- every no-op outcome becomes mandatory history and overwhelms the layer

## Relationship To Adjacent Specs

- [44-proactive-standing-update-cycle-contract.md](44-proactive-standing-update-cycle-contract.md)
  defines the cycle that emits these outcomes.
- [45-proactive-standing-scope-claim-contract.md](45-proactive-standing-scope-claim-contract.md)
  defines the ownership context many outcome records should reference.
- [43-proactive-standing-trust-downgrade-contract.md](43-proactive-standing-trust-downgrade-contract.md)
  defines downgrade semantics that these outcome records may capture.
- [49-proactive-standing-rebuild-request-contract.md](49-proactive-standing-rebuild-request-contract.md)
  defines the recovery request many `request_rebuild` outcomes should point toward.
