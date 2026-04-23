# Proactive Standing Rebuild Worker Contract

## Thesis

Rebuild should run as detached recovery work that reconstructs one governed scope from active
authority plus durable history before replacing current standing.

## Why This Spec Exists

autokairos already defines:

- explicit rebuild requests
- explicit current standing views with watermarks and trust posture
- explicit standing-claim and retry semantics

Implementation still needs one narrower contract:

**what does a rebuild worker actually owe the system so rebuild is trustworthy, restartable, and
not just a stronger form of retry?**

Without this spec:

- rebuild may silently reuse stale projection state as truth
- rebuild completion may not clearly replace blocked posture
- request consumption and standing mutation may diverge across implementations

## Canonical Object / Interface / Boundary

This spec defines one canonical recovery boundary:

1. `ProactiveStandingRebuildWorker`

This is a semantic worker boundary, not one fixed process model.

## Required Fields Or Required Behaviors

## 1. Intake-from-request rule

Rebuild work should start from one explicit rebuild request or an equivalent durable recovery
handoff.

It must not depend on:

- hidden worker-local flags
- a manual operator note with no durable request

## 2. Safe-mutation ownership rule

Before publishing rebuilt standing, the worker must hold mutation authority compatible with the
single-scope standing-claim model.

Required behavior:

- rebuild and incremental updater must not both commit standing mutation for the same governed
  scope concurrently
- loss or invalidation of recovery ownership prevents publish

The exact lock, lease, or claim mechanism may vary.

## 3. Rebuild input rule

Rebuild must derive from:

- active authority for the governed scope
- durable proactive evaluation history
- durable causal linkage needed for current posture

Current standing may be used as:

- a hint
- a checkpoint
- a debug aid

But not as the only authoritative source of truth.

## 4. Rebuild strategy rule

The architecture should support more than one rebuild strategy posture.

At minimum:

- full recomputation from durable history
- bounded repair or replay when continuity remains provable

The exact algorithm remains flexible.

## 5. Completion rule

On successful rebuild, the worker should durably leave:

- refreshed current standing
- updated watermarks
- explicit trust and reconciliation posture
- completed rebuild request state or equivalent terminal status
- durable linkage to the request that was satisfied

## 6. Blocked-rebuild rule

If rebuild cannot safely converge, the worker must not silently keep retrying forever.

Required behavior:

- classify the scope as blocked or operator-dependent
- preserve why automated rebuild stopped
- hand off to explicit operator remediation or unblock logic

## 7. Restart and idempotency rule

Rebuild work must be restartable from durable state.

Required behavior:

- repeated delivery or restart does not require hidden in-memory progress
- rebuild may restart from checkpoint or from the beginning
- later workers can safely continue or supersede earlier incomplete work

## 8. Progress visibility rule

The first implementation should expose enough visibility to answer:

- which scope is rebuilding?
- what request is it satisfying?
- is it catching up, blocked, or complete?

It does not need one fixed telemetry schema in this spec.

## Lifecycle Or State Model

The rebuild-worker lifecycle should be read as:

`claim rebuild request -> acquire safe mutation ownership -> load active authority and durable history -> replay or recompute standing -> publish refreshed standing or declare blocked handoff -> complete or supersede request state`

## What This Is Not

This spec is not:

- one background task runtime
- one queue consumer implementation
- one projection library
- permission to flip trust posture manually without rebuilt coverage

It is the canonical rebuild-worker boundary only.

## Failure Modes / Invariants

### Invariants

- rebuild starts from durable request and durable truth
- rebuild never publishes standing after losing mutation ownership
- successful rebuild makes refreshed coverage and trust posture explicit
- blocked rebuild hands off visibly instead of disappearing into retries

### Failure modes

- rebuild reuses stale standing as its main truth source
- request is marked complete but standing never changes
- rebuild loops forever on corrupted input with no blocked handoff
- rebuild and incremental updater both mutate one scope concurrently

## Relationship To Adjacent Specs

- [49-proactive-standing-rebuild-request-contract.md](49-proactive-standing-rebuild-request-contract.md)
  defines the explicit recovery request this worker should consume.
- [41-proactive-standing-view-store-and-rebuild-contract.md](41-proactive-standing-view-store-and-rebuild-contract.md)
  defines the standing surface and rebuild posture this worker must refresh.
- [47-proactive-standing-claim-lease-and-expiry-contract.md](47-proactive-standing-claim-lease-and-expiry-contract.md)
  defines lease semantics that recovery ownership must remain compatible with.
- [51-proactive-standing-operator-remediation-and-unblock-contract.md](51-proactive-standing-operator-remediation-and-unblock-contract.md)
  defines what should happen when rebuild cannot safely finish automatically.
- [52-proactive-standing-rebuild-attempt-record-contract.md](52-proactive-standing-rebuild-attempt-record-contract.md)
  defines the attempt chronology this worker should emit.
- [53-proactive-standing-rebuild-progress-view-contract.md](53-proactive-standing-rebuild-progress-view-contract.md)
  defines the current recovery view that should summarize active or latest rebuild posture.
