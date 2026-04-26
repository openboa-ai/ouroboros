# Proactive Standing Rebuild Attempt Record Contract

## Thesis

Each concrete proactive-standing rebuild try should append one attempt record so recovery work
remains inspectable across restart, retry, block, and supersession.

## Why This Spec Exists

autokairos already defines:

- rebuild requests as durable recovery intent
- rebuild workers as detached recovery boundaries
- operator remediation when rebuild cannot safely converge

Implementation still needs one narrower contract:

**what append-only attempt chronology should remain after one concrete rebuild try starts, makes
progress, suspends, blocks, fails, or succeeds?**

Without this spec:

- rebuild work may vanish into worker logs
- blocked requests may not show whether any real attempt actually ran
- restart and supersession behavior becomes harder to reason about

## Canonical Object / Interface / Boundary

This spec defines one append-only operational-history object:

1. `ProactiveStandingRebuildAttemptRecord`

It is the concrete try history beneath one rebuild request.

It is not:

- the rebuild request envelope
- the current progress view
- the standing view itself

## Required Fields Or Required Behaviors

## 1. Required identity and lineage

The record must identify:

- one rebuild attempt id
- one rebuild request ref
- one governed scope key
- one creation timestamp

Strongly recommended:

- one worker or claimant reference
- one superseding or superseded attempt ref when meaningful

## 2. Required lifecycle posture

The architecture should support at least these semantic states:

- `started`
- `running`
- `suspended` or equivalent interrupted-but-resumable posture
- `succeeded`
- `failed`
- `blocked`
- `cancelled` or `superseded`

The exact enum may vary.

## 3. Required start snapshot

The attempt should preserve enough starting context to explain what it was trying to repair.

Required semantics:

- starting authority horizon or equivalent snapshot
- starting history horizon or equivalent snapshot
- chosen rebuild strategy posture when meaningful

## 4. Required terminal visibility

On non-running terminal states, the record must preserve:

- terminal outcome class
- completion or terminal timestamp
- failure, block, or cancel reason when not succeeded
- resulting standing ref or resulting rebuild request/action ref when meaningful

## 5. Progress-event flexibility rule

The architecture does not require one append-only record for every tiny progress tick.

It does require:

- at least one append-only attempt header or terminal record per concrete try
- enough durable data to reconstruct whether the attempt began, ended, blocked, or was superseded

Fine-grained progress can remain implementation-specific.

## 6. Restart and supersession rule

If a rebuild worker restarts or a later worker takes over:

- the previous attempt should remain reconstructable
- the new attempt should not overwrite the old attempt's chronology

## Lifecycle Or State Model

The rebuild-attempt lifecycle should be read as:

`rebuild request claimed -> attempt starts -> attempt runs or suspends -> attempt succeeds, fails, blocks, cancels, or is superseded`

## What This Is Not

This spec is not:

- one verbose step-by-step trace
- one metrics stream
- one replacement for request status or current progress view

It is the append-only attempt chronology only.

## Failure Modes / Invariants

### Invariants

- each concrete rebuild try is reconstructable after the fact
- retries or restarts append new attempt chronology instead of mutating old history
- blocked or failed rebuild does not disappear into transient worker logs

### Failure modes

- request shows blocked but no attempt history explains what happened
- new attempt overwrites the previous try
- operator cannot tell whether rebuild ever really ran
- success is recorded with no linkage to refreshed standing

## Relationship To Adjacent Specs

- [49-proactive-standing-rebuild-request-contract.md](49-proactive-standing-rebuild-request-contract.md)
  defines the durable recovery request beneath which attempts are created.
- [50-proactive-standing-rebuild-worker-contract.md](50-proactive-standing-rebuild-worker-contract.md)
  defines the worker boundary that should emit this attempt history.
- [53-proactive-standing-rebuild-progress-view-contract.md](53-proactive-standing-rebuild-progress-view-contract.md)
  defines the current progress projection that may be rebuilt from attempt chronology plus request
  state.
- [54-proactive-standing-operator-action-record-contract.md](54-proactive-standing-operator-action-record-contract.md)
  defines later manual action history that may follow a blocked attempt.
