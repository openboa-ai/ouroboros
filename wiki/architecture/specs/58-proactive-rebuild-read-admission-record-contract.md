# Proactive Rebuild Read Admission Record Contract

## Thesis

Non-trivial proactive rebuild read-admission decisions should be durably recorded so serious
current-progress usage remains reconstructable after the moment of evaluation.

## Why This Spec Exists

autokairos already defines:

- one canonical read-admission evaluator
- explicit outcomes: `admit`, `admit_with_warning`, `reject_and_fallback`

Implementation still needs one narrower contract:

**when a serious caller evaluates current rebuild progress, what append-only record keeps that
decision inspectable later?**

Without this spec:

- automation-safe reads may influence behavior with no durable trail
- warning or rejection paths may disappear into transient logs
- audit cannot reconstruct which caller class was admitted against which projection state

## Canonical Object / Interface / Boundary

This spec defines:

1. `ProactiveRebuildReadAdmissionRecord`

This is an append-only operational-history object.

## Required Fields Or Required Behaviors

## 1. Required identity and linkage

The record must preserve enough linkage to answer:

- which governed scope was being read?
- which caller class requested the read?
- which current progress view or equivalent projection state was evaluated?
- which admission evaluator or evaluator version made the decision?

Required semantic fields:

- `governed_scope_key`
- `requested_read_class`
- `evaluated_progress_ref` or equivalent
- `admission_evaluator_ref` or equivalent

## 2. Required decision outcome

The record must preserve:

- `admission_outcome`
- primary reason codes
- whether fallback was required

Required semantic fields:

- `admission_outcome`
- `primary_reason_codes`
- `fallback_required`

## 3. Required timing and chronology

The record must preserve:

- when the admission decision happened
- what freshness/coverage posture the evaluator saw at that moment

Required semantic fields:

- `decided_at`
- `evaluated_freshness_posture`
- `evaluated_coverage_posture`
- optional `evaluated_posture`

## 4. Required durability threshold

The architecture does not require every read to become durable history.

Required behavior:

- `admit_with_warning` decisions should be durably recordable
- `reject_and_fallback` decisions should be durably recordable
- automation-safe reads that materially influence downstream behavior should be durably recordable
- harmless operator `admit` reads may remain ephemeral, sampled, or downstream by implementation

The exact write policy may vary, but the system must support durable non-trivial admission history.

## 5. Required relationship to fallback

If the decision requires chronology fallback, the admission record must remain linkable to a
fallback invocation record.

Required behavior:

- admission history and fallback history must be causally joinable

## 6. Flexibility rule

This spec does not require:

- one write-on-every-read policy
- one storage engine
- one analytics sink

It fixes the append-only admission-history object only.

## Lifecycle Or State Model

The admission-record lifecycle should be read as:

`serious caller requests current read -> evaluator decides outcome -> non-trivial decision is
 appended as admission history -> optional fallback invocation is linked if needed`

## What This Is Not

This spec is not:

- one final logging policy for every product surface
- one mutable cache row
- one replacement for fallback history

It is the append-only admission-history contract only.

## Failure Modes / Invariants

### Invariants

- serious current-progress usage can be reconstructed after the moment of evaluation
- warning and rejection paths do not disappear into ephemeral logs
- fallback-required decisions remain causally linked to later fallback work

### Failure modes

- automation-safe reads act with no durable admission trail
- rejected current reads cannot be distinguished from absent reads
- one mutable row overwrites prior read-admission decisions

## Relationship To Adjacent Specs

- [57-proactive-rebuild-read-admission-and-fallback-contract.md](57-proactive-rebuild-read-admission-and-fallback-contract.md)
  defines the evaluator that emits this record.
- [59-proactive-rebuild-fallback-invocation-record-contract.md](59-proactive-rebuild-fallback-invocation-record-contract.md)
  defines the chronology-fallback history that should link from fallback-required admissions.
- [60-proactive-read-admission-write-policy-contract.md](60-proactive-read-admission-write-policy-contract.md)
  defines which admission decisions must be durable and which may remain sampled or ephemeral.
- [53-proactive-standing-rebuild-progress-view-contract.md](53-proactive-standing-rebuild-progress-view-contract.md)
  defines the current projection this record should reference.
- [52-proactive-standing-rebuild-attempt-record-contract.md](52-proactive-standing-rebuild-attempt-record-contract.md)
  defines one chronology family this admission may force callers toward.
