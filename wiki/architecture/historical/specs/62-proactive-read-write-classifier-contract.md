# Proactive Read Write Classifier Contract

## Thesis

Proactive rebuild read behavior should pass through one canonical classifier that maps it into
stable durability buckets before any persistence or sampling implementation makes its own choice.

## Why This Spec Exists

autokairos already defines:

- write-policy rules for admission history
- write-policy rules for fallback-invocation history

Implementation still needs one narrower contract:

**who combines caller class, outcome severity, novelty, and fallback posture into one canonical
durability class?**

Without this spec:

- surfaces will hard-code different write rules
- sampling and persistence code will need to reimplement policy logic
- equivalent read behavior may be persisted differently for no architectural reason

## Canonical Object / Interface / Boundary

This spec defines:

1. `ProactiveReadWriteClassifier`

This is a semantic boundary, not one class name or one service process.

## Required Fields Or Required Behaviors

## 1. Required classifier inputs

The classifier must consider enough information to assign a durability bucket.

Required semantic inputs:

- caller class
- admission outcome
- warning/failure severity
- whether actual fallback ran
- fallback result posture when fallback ran
- whether the read introduces materially new operational interpretation

Optional implementations may add:

- repetition count
- local coalescing-window hints
- backend cost hints

## 2. Required output buckets

The classifier must produce one stable write class.

Required semantic buckets:

- `must_write`
- `write_if_non_trivial`
- `sample_or_ephemeral`

The exact enum names may vary, but these buckets must remain distinguishable.

## 3. Required severity rule

The classifier must treat these as `must_write` by default:

- `reject_and_fallback`
- actual fallback that failed, partially completed, or was abandoned
- automation-safe behavior that materially influences downstream action
- audit-relevant behavior needed for later reconstruction

## 4. Required novelty rule

The classifier may downgrade to `sample_or_ephemeral` only when the read is both:

- low-severity
- non-novel in operational interpretation

Required behavior:

- repeated healthy operator success with no new interpretation may become `sample_or_ephemeral`
- degraded or ambiguous reads must not be treated as non-novel by default

## 5. Required consistency rule

Materially equivalent inputs should classify to the same write bucket regardless of the surface
that invoked the classifier.

## 6. Required separation rule

The classifier should decide the write bucket, but not the final batching/export/storage strategy.

Required behavior:

- persistence code must not silently reinterpret the write bucket

## 7. Flexibility rule

This spec does not require:

- one batching implementation
- one storage backend
- one exporter
- one sampling ratio

It fixes the classifier boundary and output buckets only.

## Lifecycle Or State Model

The classifier lifecycle should be read as:

`read behavior occurs -> gather caller/outcome/novelty/fallback signals -> assign stable write
 bucket -> downstream persistence or coalescing layer applies that bucket`

## What This Is Not

This spec is not:

- one storage writer
- one sampling algorithm
- one deduplication implementation

It is the write-classification boundary only.

## Failure Modes / Invariants

### Invariants

- equivalent read behavior maps to equivalent write classes
- serious fallback and failure behavior remains harder to suppress than benign reads
- novelty and severity both matter before a read is downgraded

### Failure modes

- every surface reimplements write policy
- healthy reads and serious reads collapse into one write class
- downstream systems ignore the classifier and reinterpret policy ad hoc

## Relationship To Adjacent Specs

- [60-proactive-read-admission-write-policy-contract.md](60-proactive-read-admission-write-policy-contract.md)
  defines the policy constraints this classifier must respect for admission history.
- [61-proactive-fallback-invocation-write-policy-contract.md](61-proactive-fallback-invocation-write-policy-contract.md)
  defines the stricter policy constraints this classifier must respect for fallback execution.
- [63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md](63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md)
  defines what downstream coalescing may do after classification.
- [64-proactive-read-write-coordinator-contract.md](64-proactive-read-write-coordinator-contract.md)
  defines the coordinator that should consume this classification and choose the final write path.
