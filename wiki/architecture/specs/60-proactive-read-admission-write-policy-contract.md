# Proactive Read Admission Write Policy Contract

## Thesis

`ProactiveRebuildReadAdmissionRecord` should use caller-class-aware write policy so serious or
non-trivial admission decisions remain durable while harmless healthy reads may stay sampled or
ephemeral.

## Why This Spec Exists

autokairos already defines:

- append-only admission history for non-trivial read decisions
- different caller classes with different trust requirements

Implementation still needs one narrower contract:

**which admission outcomes must always be durable, which may be conditionally durable, and which
may remain sampled or ephemeral?**

Without this spec:

- history may be flooded with healthy operator polling
- automation-safe or audit-relevant decisions may be under-recorded
- write policy may drift across implementations

## Canonical Object / Interface / Boundary

This spec defines write-policy semantics for:

1. `ProactiveRebuildReadAdmissionRecord`

It does not define one storage engine or one telemetry exporter.

## Required Fields Or Required Behaviors

## 1. Must-write categories

The system must support durable append-only writing for admission decisions in these categories:

- any `reject_and_fallback`
- any automation-safe admission outcome that materially influences downstream behavior
- any audit-relevant admission outcome used as more than a casual summary
- any `admit_with_warning` where the warning meaningfully changes operational interpretation

These categories must not be sampled away by default.

## 2. Write-if-non-trivial categories

The system should support conditional durable writing for:

- operator `admit_with_warning`
- operator reads whose freshness or coverage posture is degraded but still usable
- repeated non-terminal reads that indicate sustained ambiguity, lag, or blocked posture

The exact threshold may vary, but implementations must preserve the ability to keep non-trivial
operator reads durable when they matter.

## 3. Sample-or-ephemeral categories

The system may allow these reads to remain sampled or ephemeral:

- operator `admit` of healthy, fresh, fully covered current progress
- repetitive healthy polls that add no new operational interpretation

This flexibility exists to protect signal quality and storage cost.

## 4. Required caller-class rule

Write policy must remain stricter for:

- automation-safe
- audit

than for:

- casual operator status checks

Required behavior:

- the same healthy `admit` may be ephemeral for operator use while still being durably preserved if
  an automation-safe or audit workflow depends on it

## 5. Required outcome rule

Write policy must pay attention to outcome severity, not only caller class.

Required behavior:

- `reject_and_fallback` always outranks caller convenience
- `admit_with_warning` should usually outrank plain `admit`

## 6. Required consistency rule

Materially equivalent reads in the same caller class should follow the same durability policy.

Required behavior:

- one product must not durably write a benign operator read while another silently drops an
  equivalent one with no architectural reason

## 7. Flexibility rule

This spec does not require:

- one exact sampling percentage
- one time window for coalescing reads
- one exporter or logging backend

It fixes the durability categories only.

## Lifecycle Or State Model

The write-policy lifecycle should be read as:

`admission outcome produced -> classify durability obligation -> append durable record when policy
 requires or justifies it -> otherwise keep the read sampled or ephemeral`

## What This Is Not

This spec is not:

- one telemetry budget
- one final UI polling policy
- one replacement for the admission record itself

It is the write-policy contract for admission history only.

## Failure Modes / Invariants

### Invariants

- `reject_and_fallback` admissions remain durably visible
- healthy low-value operator polling does not need to dominate history
- automation-safe and audit-relevant reads remain harder to lose than casual reads

### Failure modes

- history is flooded by benign operator polling
- automation-safe decisions are sampled away like harmless reads
- write policy differs arbitrarily across surfaces

## Relationship To Adjacent Specs

- [58-proactive-rebuild-read-admission-record-contract.md](58-proactive-rebuild-read-admission-record-contract.md)
  defines the record this policy governs.
- [57-proactive-rebuild-read-admission-and-fallback-contract.md](57-proactive-rebuild-read-admission-and-fallback-contract.md)
  defines the evaluator outcomes this policy classifies.
- [56-proactive-rebuild-read-safety-classes-contract.md](56-proactive-rebuild-read-safety-classes-contract.md)
  defines the caller classes that should influence durability.
- [61-proactive-fallback-invocation-write-policy-contract.md](61-proactive-fallback-invocation-write-policy-contract.md)
  defines the stricter write policy for actual fallback execution history.
- [62-proactive-read-write-classifier-contract.md](62-proactive-read-write-classifier-contract.md)
  defines the canonical classifier that should apply this write policy consistently.
