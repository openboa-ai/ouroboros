# Proactive Read Durability And Recovery Contract

## Thesis

Proactive read durability should keep healthy duplicate-success suppression bounded and operational
while preserving explicit durable visibility and restart-safe recovery above it.

## Why This Spec Exists

autokairos already defines:

- a canonical write classifier
- narrow duplicate-success suppression rules

Implementation still needs one narrower contract:

**what durability and recovery rules must hold once healthy duplicate-success reads stop being
written one-by-one?**

Without this spec:

- local optimization state may drift into durable truth
- recovery behavior may depend on hidden implementation details
- suppression, visibility, and restart semantics may be designed independently and then conflict

## Canonical Object / Interface / Boundary

This spec defines:

1. `ProactiveReadDurabilityAndRecovery`

This is a semantic durability boundary, not one required process topology.

## Required Fields Or Required Behaviors

## 1. Required bypass rule

Serious chronology must bypass coalescing.

Required behavior:

- `must_write` categories should go directly to durable history
- actual fallback execution should not wait inside duplicate-success suppression
- warning/failure/fallback categories must not be downgraded into window updates

## 2. Required bounded healthy-window rule

Only low-value duplicate-success reads may enter the coalescing-window path.

Required behavior:

- bounded healthy suppression may exist only for duplicate-success reads that do not change
  operational meaning
- that suppression must remain explicitly bounded rather than indefinite

## 3. Required durable-visibility rule

Healthy suppression must still leave durable visibility behind it.

Required behavior:

- suppressed healthy continuity must reappear through append-only durable visibility before it
  becomes operationally invisible
- exact record shape remains flexible at this level

## 4. Required resettability rule

Local suppression state must not be treated as irreplaceable truth.

Required behavior:

- loss of local coalescing state may increase write volume
- loss of local coalescing state must not erase serious durable chronology

## 5. Required flush-and-restart rule

Visibility and recovery must remain explicit.

Required behavior:

- healthy suppression must close on explicit bounded visibility semantics rather than silent drift
- clean shutdown and crash restart must remain semantically distinct
- restart may lose optimization state but must not invent chronology it cannot prove

## 6. Required separation rule

This layer must not collapse history, projection, and optimization state into one thing.

Required behavior:

- serious admission/fallback chronology stays canonical durable history
- any current operational visibility above suppression remains subordinate to durable history
- optimization state remains operational and resettable

## 7. Flexibility rule

This spec does not require:

- one worker model
- one scheduler
- one queue
- one storage engine
- one current-view shape
- one retry loop

It fixes only the durability and recovery constraints.

## Lifecycle Or State Model

The lifecycle should be read as:

`classified read arrives -> serious chronology writes immediately or healthy duplicate-success
 enters bounded operational suppression -> healthy continuity later becomes durably visible ->
 restart may discard optimization state without losing durable truth`

## What This Is Not

This spec is not:

- one service loop implementation
- one cache schema
- one retry algorithm
- one database schema

It is the durability-and-recovery contract only.

## Failure Modes / Invariants

### Invariants

- serious chronology bypasses coalescing
- bounded healthy suppression remains operational rather than canonical truth
- restart may lose optimization state without losing serious truth
- suppressed healthy continuity still becomes durably visible

### Failure modes

- duplicate-success suppression absorbs warning or fallback chronology
- local suppression state becomes hidden durable truth
- restart or shutdown semantics fabricate chronology they cannot justify

## Relationship To Adjacent Specs

- [62-proactive-read-write-classifier-contract.md](62-proactive-read-write-classifier-contract.md)
  defines the upstream classifier this durability layer consumes.
- [63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md](63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md)
  defines the semantic suppression limits this durability layer must honor.
