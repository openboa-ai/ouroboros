# Proactive Fallback Invocation Write Policy Contract

## Thesis

`ProactiveRebuildFallbackInvocationRecord` should use stricter durability policy than admission
history because actual chronology fallback is an operational action, not just a read interpretation.

## Why This Spec Exists

autokairos already defines:

- append-only fallback invocation history
- explicit admission decisions that may require fallback

Implementation still needs one narrower contract:

**how durable should fallback invocation history be, relative to ordinary current-progress reads?**

Without this spec:

- actual fallback may be treated as optional telemetry
- repeated chronology handoffs may become less visible than benign projection reads
- fallback failure may disappear into sampled noise

## Canonical Object / Interface / Boundary

This spec defines write-policy semantics for:

1. `ProactiveRebuildFallbackInvocationRecord`

## Required Fields Or Required Behaviors

## 1. Must-write categories

The system must durably preserve:

- every fallback invocation that actually starts
- every partial fallback
- every failed fallback
- every abandoned fallback
- every fallback used by automation-safe or audit-relevant reads

These categories must not be sampled away by default.

## 2. Stronger-than-admission rule

Fallback invocation history should be stricter than ordinary admission history.

Required behavior:

- actual fallback execution should generally be more durable than the benign admission decision
  that preceded it

## 3. Limited flexibility rule

The architecture may still allow:

- coalescing of obviously duplicate low-value successful operator fallbacks within bounded policy
  windows
- downstream summarization views above append-only fallback history

But this flexibility must not erase:

- failure
- partiality
- abandonment
- automation-safe or audit-relevant fallback execution

## 4. Required failure visibility

If fallback execution fails, that failure must remain durable.

Required behavior:

- fallback failure must never be sampled away like harmless reads

## 5. Required result-severity rule

Write policy must treat these result classes as durable by default:

- `failed`
- `partial`
- `abandoned`

The architecture may be more flexible only for clean, repetitive, low-value success cases.

## 6. Flexibility rule

This spec does not require:

- one deduplication window
- one coalescing algorithm
- one storage engine

It fixes the durability priority of actual fallback execution only.

## Lifecycle Or State Model

The write-policy lifecycle should be read as:

`fallback starts -> classify execution/result severity -> append durable invocation history ->
 optionally summarize or coalesce only low-value repetitive success cases downstream`

## What This Is Not

This spec is not:

- one final analytics strategy
- one query result cache
- one replacement for the fallback invocation record itself

It is the write-policy contract for fallback invocation history only.

## Failure Modes / Invariants

### Invariants

- actual fallback execution is more durable than benign projection reads
- failed or partial fallback remains visible
- automation-safe and audit-relevant fallback execution is not sampled away

### Failure modes

- fallback execution is less visible than a healthy projection read
- failed fallback disappears into low-value telemetry sampling
- duplicate-success coalescing erases non-trivial fallback chronology

## Relationship To Adjacent Specs

- [59-proactive-rebuild-fallback-invocation-record-contract.md](59-proactive-rebuild-fallback-invocation-record-contract.md)
  defines the record this policy governs.
- [58-proactive-rebuild-read-admission-record-contract.md](58-proactive-rebuild-read-admission-record-contract.md)
  defines the preceding admission history whose durability may be lower than actual fallback.
- [60-proactive-read-admission-write-policy-contract.md](60-proactive-read-admission-write-policy-contract.md)
  defines the lighter write policy for ordinary admission history.
- [62-proactive-read-write-classifier-contract.md](62-proactive-read-write-classifier-contract.md)
  defines the classifier that should honor this stricter fallback durability.
- [63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md](63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md)
  defines why actual fallback execution must remain outside narrow duplicate-success suppression.
