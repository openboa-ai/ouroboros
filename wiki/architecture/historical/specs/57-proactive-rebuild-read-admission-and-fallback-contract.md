# Proactive Rebuild Read Admission And Fallback Contract

## Thesis

`CurrentProactiveRebuildProgressView` should pass through one canonical read-admission evaluator so
serious callers either receive an explicitly admitted projection or an explicit fallback to deeper
chronology.

## Why This Spec Exists

autokairos already defines:

- current rebuild progress as a projection
- field families for posture, freshness, coverage, and read safety
- caller classes for operator, automation-safe, and audit reads

Implementation still needs one narrower contract:

**who decides whether the current projection is good enough for the requested read class, and what
happens when it is not?**

Without this spec:

- each API surface will invent its own threshold
- caller-class semantics will drift in implementation
- fallback to chronology will become optional instead of architectural

## Canonical Object / Interface / Boundary

This spec defines a canonical boundary:

1. `ProactiveRebuildReadAdmissionEvaluator`

This is a semantic boundary, not one concrete service name.

## Required Fields Or Required Behaviors

## 1. Required inputs

The evaluator must take enough input to determine whether the current projection is usable for the
requested read.

Required semantic inputs:

- `requested_read_class`
- `current_progress_view`
- current posture
- freshness posture
- coverage posture
- relevant reason codes when posture is blocked, degraded, or unknown

Optional implementations may add:

- caller feature flags
- preferred fallback mode
- local cache hints

## 2. Required outcomes

The evaluator must produce an explicit admission outcome.

Required semantic outcomes:

- `admit`
- `admit_with_warning`
- `reject_and_fallback`

The exact enum names may vary, but these three outcomes must remain distinguishable.

## 3. Required class handling

### Operator reads

Required behavior:

- may admit lagging or partial views with warning
- must not silently hide freshness or coverage problems

### Automation-safe reads

Required behavior:

- must reject or strictly downgrade stale, unknown, or coverage-insufficient views
- must not treat `running` as sufficient by default
- must choose fallback or explicit no-op over optimistic trust

### Audit reads

Required behavior:

- may admit current projection as a summary
- must preserve the ability to pivot to chronology when evidentiary confidence is insufficient

## 4. Required fallback behavior

When outcome is `reject_and_fallback`, the evaluator must direct the caller toward deeper
chronology rather than fabricating a synthetic current truth.

Fallback sources may include:

- rebuild request history
- rebuild attempt chronology
- operator action history

The architecture does not require one concrete fallback transport.

## 5. Required warning behavior

When outcome is `admit_with_warning`, the evaluator must preserve the reason for degraded
admission.

Required semantic warning causes include:

- freshness lag
- partial chronology coverage
- blocked or unknown posture
- missing linkage needed for stronger confidence

## 6. Required consistency rule

For the same requested read class and materially equivalent current progress inputs, the evaluator
should produce the same admission outcome regardless of which downstream surface invoked it.

Required behavior:

- one product surface must not silently admit what another rejects for the same class

## 7. Flexibility rule

This spec does not require:

- one RPC endpoint
- one UI component
- one cache strategy
- one storage backend

It fixes the read-admission boundary and its outcomes only.

## Lifecycle Or State Model

The evaluator lifecycle should be read as:

`receive requested read class -> inspect current projection inputs -> classify admission outcome ->
 return current projection with or without warning, or redirect to chronology fallback`

## What This Is Not

This spec is not:

- one authorization matrix
- one dashboard presentation rule
- one replacement for chronology
- one store-schema definition

It is the admission-and-fallback boundary only.

## Failure Modes / Invariants

### Invariants

- serious callers never consume current progress without an explicit admission outcome
- automation-safe reads remain stricter than operator reads
- fallback to chronology remains available when projection confidence is insufficient
- admission decisions remain consistent across surfaces for equivalent inputs

### Failure modes

- two surfaces interpret the same lagging view differently with no canonical evaluator
- automation reuses an operator-facing current projection as if it were machine-safe
- audit reads stop at stale projection and lose chronology
- warning-worthy reads are admitted silently

## Relationship To Adjacent Specs

- [53-proactive-standing-rebuild-progress-view-contract.md](53-proactive-standing-rebuild-progress-view-contract.md)
  defines the projection this evaluator reads.
- [55-proactive-rebuild-progress-field-families-contract.md](55-proactive-rebuild-progress-field-families-contract.md)
  defines the field families this evaluator must inspect.
- [56-proactive-rebuild-read-safety-classes-contract.md](56-proactive-rebuild-read-safety-classes-contract.md)
  defines the caller classes whose guarantees this evaluator must enforce.
- [58-proactive-rebuild-read-admission-record-contract.md](58-proactive-rebuild-read-admission-record-contract.md)
  defines the append-only admission history for non-trivial evaluator outcomes.
- [59-proactive-rebuild-fallback-invocation-record-contract.md](59-proactive-rebuild-fallback-invocation-record-contract.md)
  defines the append-only history for chronology fallback that actually runs.
- [52-proactive-standing-rebuild-attempt-record-contract.md](52-proactive-standing-rebuild-attempt-record-contract.md)
  defines one chronology fallback source.
- [54-proactive-standing-operator-action-record-contract.md](54-proactive-standing-operator-action-record-contract.md)
  defines another chronology fallback source used for remediation-aware reads.
