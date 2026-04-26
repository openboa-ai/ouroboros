# Proactive Read Coalescing And Duplicate-Success Suppression Contract

## Thesis

autokairos should allow narrow coalescing only for duplicate healthy success reads that do not
change operational interpretation, and should never coalesce away serious warning, failure, or
fallback chronology.

## Why This Spec Exists

autokairos already defines:

- caller-class-aware write policy
- a canonical classifier that emits write buckets

Implementation still needs one narrower contract:

**what may the system safely suppress or coalesce after classification, and what must remain
durably distinct?**

Without this spec:

- coalescing may erase meaningful chronology
- low-value healthy reads may still flood history
- duplicate-suppression logic may drift across implementations

## Canonical Object / Interface / Boundary

This spec defines coalescing semantics for:

1. admission history
2. fallback invocation history

## Required Fields Or Required Behaviors

## 1. Non-coalescible categories

The following must remain durably distinct by default:

- any `reject_and_fallback`
- any `admit_with_warning`
- any automation-safe or audit-relevant read with material downstream significance
- any fallback invocation that started
- any fallback result that is `failed`, `partial`, or `abandoned`

These categories must not be silently suppressed as duplicates.

## 2. Narrow coalescible category

The architecture may allow coalescing only for reads that are all of the following:

- healthy
- operator-oriented
- repetitive within bounded policy windows
- non-novel in interpretation
- not tied to actual fallback execution

This is the canonical duplicate-success suppression case.

## 3. Required bounded-window rule

Coalescing must be bounded.

Required behavior:

- the system must not suppress duplicate-success forever
- a later read outside the bounded window must be allowed to become durable again

The exact window length may vary by implementation.

## 4. Required anchor rule

Even when duplicate-success suppression happens, the system should preserve enough signal to show
that healthy reads continued to occur.

Allowed implementations may use:

- periodic anchor records
- coalesced counters
- summary markers

The architecture does not require one specific method, but complete invisibility is not preferred.

## 5. Required fallback rule

Actual fallback execution must not be hidden behind duplicate-success suppression.

Required behavior:

- once chronology fallback runs, that invocation remains more durable than a repeated healthy
  projection read

## 6. Required consistency rule

Equivalent duplicate-success cases should be coalesced consistently rather than ad hoc.

## 7. Flexibility rule

This spec does not require:

- one coalescing window
- one anchor-record format
- one counter schema

It fixes only the semantic suppression boundary.

## Lifecycle Or State Model

The coalescing lifecycle should be read as:

`classifier marks read as low-value duplicate-success candidate -> bounded coalescing policy checks
 novelty and window -> either suppress into anchor/summary path or append durable history if the
 case is no longer safely coalescible`

## What This Is Not

This spec is not:

- permission to suppress degraded or failed chronology
- one exact summarization format
- one storage-level dedupe algorithm

It is the semantic coalescing boundary only.

## Failure Modes / Invariants

### Invariants

- serious warning, failure, and fallback chronology remain durably visible
- only narrow duplicate-success cases are eligible for suppression
- bounded windows prevent permanent invisibility

### Failure modes

- duplicate suppression erases warning or fallback history
- low-value healthy reads still flood durable history because no bounded coalescing exists
- suppression windows become effectively infinite

## Relationship To Adjacent Specs

- [62-proactive-read-write-classifier-contract.md](62-proactive-read-write-classifier-contract.md)
  defines the classifier that should identify coalescible low-value reads.
- [60-proactive-read-admission-write-policy-contract.md](60-proactive-read-admission-write-policy-contract.md)
  defines which admission cases may ever be eligible for sampling or suppression.
- [61-proactive-fallback-invocation-write-policy-contract.md](61-proactive-fallback-invocation-write-policy-contract.md)
  defines why actual fallback execution should remain stricter than ordinary duplicate-success
  reads.
- [64-proactive-read-write-coordinator-contract.md](64-proactive-read-write-coordinator-contract.md)
  defines the compressed durability-and-recovery layer that this suppression must remain
  subordinate to.
