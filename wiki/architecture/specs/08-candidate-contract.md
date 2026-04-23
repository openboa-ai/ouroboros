# Candidate Contract

This page defines the active `Candidate` contract for autokairos.

It is written `PR1 first`.

That means the contract below is the minimum durable shape required to implement
`PRD 1 / Slice 1: Path Becomes Real` safely without dragging later evaluation or live meaning into
the first implementation milestone.

It follows:

- [../../product/mlp-01/prds/01-hypothesis-to-candidate.md](../../product/mlp-01/prds/01-hypothesis-to-candidate.md)
- [../01-pr1-path-becomes-real-design.md](../01-pr1-path-becomes-real-design.md)
- [02-core-primitives.md](02-core-primitives.md)
- [04-boundaries.md](04-boundaries.md)

## Thesis

For PR1, a `Candidate` is the first durable, inspectable record that makes one surfaced path real.

It is the object that proves:

- this path is no longer disposable runtime output
- the control plane now owns the durable record
- the operator can inspect what the path is and why it exists
- later evaluation can begin without manual reauthoring

If this contract is too weak, the operator remains the hidden runtime.

If this contract is too broad in PR1, candidate creation will blur into evaluation, promotion, or
live meaning too early.

## Why This Spec Exists

PR1 does not need the full lifecycle of a mature candidate.

It needs a durable record strong enough to survive:

- one runtime session ending
- one chat or notebook disappearing
- one workspace being discarded
- one operator forgetting the exact original wording

The purpose of this spec is to define the smallest candidate shape that closes that gap.

## What This Spec Is Not

For PR1, `Candidate` is not:

- an `AgentIdentity`
- a `Session`
- a `Workspace`
- a `Trace`
- an `EvidenceRecord`
- a `PromotionDecision`
- a live deployment record
- a single runtime attempt

Those may link to a candidate later.

They are not required to make a candidate real in PR1.

## PR1 Applicability First

The active PR1 contract only needs to guarantee:

- durable identity
- durable provenance
- durable intent summary
- current PR1 candidate status
- evaluation handoff readiness

Everything beyond that belongs to later slices unless it is needed to keep this boundary from
drifting.

## Minimum Durable Candidate Shape For PR1

| Field | Meaning |
| --- | --- |
| `candidate_id` | Stable durable identity for the candidate |
| `created_at` | When the control plane materialized the candidate |
| `origin_kind` | What kind of surfaced path produced the candidate |
| `origin_ref` | Durable provenance reference to the surfaced origin |
| `title` | Short operator-facing durable label |
| `hypothesis_summary` | Durable summary of the path being proposed |
| `candidate_status` | Current PR1 candidate state |
| `evaluation_handoff_ready` | Whether the candidate can enter PRD 2 without reauthoring |

These are the only required candidate fields for PR1.

## PR1 Candidate Status Values

PR1 only needs these values:

- `materialized`
- `handoff_ready`
- `archived`

These values mean:

- `materialized`
  The candidate exists durably, but handoff completeness may still be pending.
- `handoff_ready`
  The candidate now has enough durable structure to enter evaluation without manual rewriting.
- `archived`
  The candidate remains durable, but it is no longer the active path.

These values must **not** imply:

- counted evidence
- legitimacy judgment
- promotion eligibility
- live approval
- live posture

## Materialization Rule

A candidate does not exist when a path is merely surfaced in runtime output.

A candidate exists only when the control plane durably records the minimum candidate shape above.

That durable write is the candidate materialization boundary.

## Operator-Visible Meaning

From the candidate record alone, the operator must be able to answer:

- what this path is
- why it appeared
- where it came from
- that the system now owns it durably
- whether it can move into later evaluation without rewriting

If the operator still needs chat history, private notes, or runtime-local memory to answer those
questions, the candidate contract has failed.

## Not Required By PR1

The following may be added later, but they are not active PR1 requirements:

- explicit lineage fields such as parent or root candidate references
- runtime/session association histories
- trace, evidence, or promotion decision links
- richer governance flags
- live execution references
- broader candidate-stage lifecycle detail

PR1 code must not block on those fields.

## Extension Rule

Later slices may extend `Candidate` to carry more lineage, evidence, promotion, or live
associations.

Those extensions must preserve the PR1 boundary:

- candidate materialization makes the path real
- later evaluation and promotion make the path trustworthy or live

The later lifecycle must extend the candidate.

It must not redefine what made the candidate real in the first place.

## Relationship To Adjacent Specs

This spec depends on:

- [02-core-primitives.md](02-core-primitives.md)
- [03-staged-evaluation.md](03-staged-evaluation.md)

It is elaborated by:

- [09-trace-contract.md](09-trace-contract.md)
- [10-evidence-record-contract.md](10-evidence-record-contract.md)
- [11-promotion-decision-contract.md](11-promotion-decision-contract.md)
