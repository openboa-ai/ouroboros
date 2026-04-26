# Proactive Rebuild Read Safety Classes Contract

## Thesis

`CurrentProactiveRebuildProgressView` should advertise different minimum guarantees for operator,
automation-safe, and audit reads so stale or partial recovery state is not over-trusted.

## Why This Spec Exists

autokairos already defines:

- rebuild progress as a current projection
- stable field families for posture, freshness, coverage, and read safety

Implementation still needs one narrower contract:

**what minimum guarantees should the system require before one caller class may treat the current
progress view as usable?**

Without this spec:

- automation may over-trust operator-oriented reads
- audit may rely on projection when it should pivot to history
- different surfaces may invent conflicting meanings for "safe enough to read"

## Canonical Object / Interface / Boundary

This spec defines read-safety classes for:

1. `CurrentProactiveRebuildProgressView`

It fixes caller-class semantics, not one payload or endpoint shape.

## Required Fields Or Required Behaviors

## 1. Operator read class

An operator read is allowed to tolerate some lag or partiality if the view still exposes:

- current posture
- primary reason
- explicit freshness posture
- explicit coverage posture

Required behavior:

- operator read may admit `lagging` or partially covered views
- operator read must still show when deeper chronology is recommended

## 2. Automation-safe read class

An automation-safe read has the strictest requirements.

Required behavior:

- automation-safe read must reject or downgrade views whose freshness or coverage is insufficient
- `running` must not be treated as machine-safe unless freshness and coverage are both adequate
- `unknown` and coverage-partial views must trigger fallback to deeper chronology or explicit
  no-op behavior rather than optimistic action

The exact fallback behavior may vary, but optimistic trust is not allowed.

## 3. Audit read class

An audit read is allowed to use the current view as a summary, but must preserve chronology
reconstructability.

Required behavior:

- audit read may summarize from current progress view
- audit tooling must still be able to pivot to request, attempt, and operator action history
- stale projection alone is insufficient as final evidence if chronology is disputed

## 4. Required admission rule

The architecture should support an explicit admission decision per read class:

- `admit`
- `admit_with_warning`
- `reject_and_fallback`

The exact enum may vary, but one implicit boolean is not enough.

## 5. Required fallback rule

When the current progress view is not good enough for a requested class, the system should fall
back to deeper chronology rather than fabricating confidence.

Fallback sources may include:

- rebuild request history
- rebuild attempt chronology
- operator action history

## 6. Required read-safety inputs

Read-safety classification must consider at least:

- current posture
- freshness posture
- coverage posture
- reason codes when posture is degraded, blocked, or unknown

It must not rely on:

- one timestamp only
- one status string only

## 7. Flexibility rule

This spec does not require:

- one API contract
- one authorization system
- one alerting workflow

It fixes read-safety class semantics only.

## Lifecycle Or State Model

The read-safety lifecycle should be read as:

`caller class requests view -> evaluate progress posture, freshness, and coverage -> admit or warn or reject -> fall back to deeper chronology when required`

## What This Is Not

This spec is not:

- one RBAC matrix
- one product UX rule
- one replacement for progress field-family semantics

It is the read-safety class contract only.

## Failure Modes / Invariants

### Invariants

- automation-safe reads never silently over-trust stale or partial progress
- operator reads can still inspect lagging views without pretending they are machine-safe
- audit reads remain reconstructable from deeper chronology
- read-class admission is explicit rather than hidden in caller convention

### Failure modes

- an automation treats a lagging operator read as authoritative
- audit trail relies on stale current progress with no pivot to chronology
- callers cannot tell whether current view was admitted with warning or rejected
- progress safety is inferred differently by every surface

## Relationship To Adjacent Specs

- [53-proactive-standing-rebuild-progress-view-contract.md](53-proactive-standing-rebuild-progress-view-contract.md)
  defines the current progress view this contract classifies.
- [55-proactive-rebuild-progress-field-families-contract.md](55-proactive-rebuild-progress-field-families-contract.md)
  defines the field families whose values this contract evaluates.
- [57-proactive-rebuild-read-admission-and-fallback-contract.md](57-proactive-rebuild-read-admission-and-fallback-contract.md)
  defines the canonical evaluator that should turn these class semantics into explicit admission or
  fallback outcomes.
- [52-proactive-standing-rebuild-attempt-record-contract.md](52-proactive-standing-rebuild-attempt-record-contract.md)
  defines one fallback chronology source for insufficient current reads.
- [54-proactive-standing-operator-action-record-contract.md](54-proactive-standing-operator-action-record-contract.md)
  defines the manual-action chronology that audit or fallback reads may need.
