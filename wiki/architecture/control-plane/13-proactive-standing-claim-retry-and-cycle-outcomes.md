# Proactive Standing Claim, Retry, And Cycle Outcomes

This page defines how the standing update cycle should coordinate ownership, retries, and outcome
visibility without hard-coding one lock or worker implementation.

It follows:

- [11-proactive-standing-updater-and-trust-management.md](11-proactive-standing-updater-and-trust-management.md)
- [12-proactive-standing-update-cycle.md](12-proactive-standing-update-cycle.md)
- [../specs/45-proactive-standing-scope-claim-contract.md](../specs/45-proactive-standing-scope-claim-contract.md)
- [../specs/46-proactive-standing-cycle-outcome-record-contract.md](../specs/46-proactive-standing-cycle-outcome-record-contract.md)
- [../adrs/0018-proactive-standing-claim-and-cycle-outcomes.md](../adrs/0018-proactive-standing-claim-and-cycle-outcomes.md)

## Purpose

Keep proactive standing mutation deterministic under concurrent triggers, retries, and partial
failures.

## Scope And Non-Goals

This page covers:

- single-scope claim semantics
- retry and lost-claim behavior
- cycle outcome visibility after one update attempt

This page does not cover:

- one distributed lock service
- one database transaction recipe
- one queue implementation
- broad execution tracing outside standing maintenance

## Responsibilities

- ensure one governed scope has one active updater owner per cycle attempt
- ensure retries do not invent conflicting current standing
- make non-trivial cycle outcomes durably inspectable

## System Boundaries

This layer sits:

- above trigger delivery and wake transport
- above durable proactive history and standing view storage
- below operator debugging, replay, and rebuild coordination

It should not collapse into:

- hidden in-memory locks
- best-effort retry with no claim semantics
- silent cycle failures that never surface as inspectable outcomes

## Primary Abstractions

- `ProactiveStandingScopeClaim`
- `ProactiveStandingCycleOutcomeRecord`
- claim loss
- retryable cycle failure
- non-trivial cycle outcome visibility

## Primary Flow

The stable coordination flow should be read as:

`cycle cause arrives -> attempt single-scope claim -> run canonical update cycle -> persist standing mutation if still owner -> persist non-trivial cycle outcome -> release or expire claim`

When claim is lost or continuity cannot be proven:

`claim lost or cycle fails -> do not force standing mutation -> record failed or aborted outcome -> retry or rebuild through canonical follow-up`

## Failure And Recovery Model

This layer has failed when:

- two workers both believe they own the same standing scope
- a lost claim still writes current standing
- retries create contradictory standing posture
- degraded or failed cycle outcomes disappear into logs only

Recovery means:

- stale claims expire or are superseded
- retried cycles re-read durable state before mutation
- non-trivial cycle outcomes remain inspectable after failure

## Dependencies On Other Subsystems

- depends on the proactive standing update cycle
- depends on current standing store and durable proactive history
- feeds rebuild coordination and operator diagnostics

## What Is Still Delegated To Specs / ADRs

- claim invariants remain in
  [../specs/45-proactive-standing-scope-claim-contract.md](../specs/45-proactive-standing-scope-claim-contract.md)
- cycle outcome persistence remains in
  [../specs/46-proactive-standing-cycle-outcome-record-contract.md](../specs/46-proactive-standing-cycle-outcome-record-contract.md)
- the design decision remains in
  [../adrs/0018-proactive-standing-claim-and-cycle-outcomes.md](../adrs/0018-proactive-standing-claim-and-cycle-outcomes.md)

## Core Rule

The updater should not rely on "probably single-threaded" execution.

It should always behave as if:

- claim could be lost
- retries could happen
- a non-trivial cycle outcome may need later inspection

## One Sentence Summary

autokairos should maintain proactive standing with explicit single-scope claims, safe retries, and
inspectable cycle outcomes, while keeping lock and queue mechanisms downstream of the architecture.
