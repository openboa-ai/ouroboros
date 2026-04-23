# PR1 Design: Path Becomes Real

This page is the canonical implementation-shape document for `PR1 / Slice 1`.

It sits between:

- [../product/mlp-01/07-implementation-plan.md](../product/mlp-01/07-implementation-plan.md)
- [../product/mlp-01/prds/01-hypothesis-to-candidate.md](../product/mlp-01/prds/01-hypothesis-to-candidate.md)
- [specs/04-boundaries.md](specs/04-boundaries.md)
- [specs/08-candidate-contract.md](specs/08-candidate-contract.md)

Its job is to make PR1 decision-complete before code starts.

## Goal

Answer the first trust question:

**`Is this path real?`**

PR1 proves that:

- one serious agent-originated path can surface
- that path can be materialized into one durable candidate
- provenance is durable and inspectable
- the operator no longer carries the path manually across chat, tabs, notes, or memory

PR1 does **not** prove:

- counted evidence
- legitimacy judgment
- promotion meaning
- live execution
- wake or intervention

## Canonical PR1 Flow

The PR1 flow is fixed:

1. the agent system surfaces one serious path
2. the surfaced path crosses a bounded handoff into the control plane
3. the control plane materializes one durable `Candidate`
4. the candidate exposes provenance and durable intent summary
5. the operator can inspect the candidate and see that it is now a real tracked object
6. the candidate is marked ready for later evaluation handoff without implying any evaluation result

The flow must not be reordered.

Candidate materialization is the proof.

Path surfacing alone is not the proof.

## Ownership And Boundaries

### Agent system

The agent system owns:

- surfacing one serious path
- providing the bounded handoff payload needed for candidate materialization
- stopping before it becomes the durable record of truth

The agent system does **not** own:

- candidate identity
- durable provenance truth
- durable operator inspection state
- evaluation readiness meaning beyond bounded handoff completeness

### Control plane

The control plane owns:

- candidate materialization
- durable candidate identity
- durable provenance truth
- durable intent summary
- durable PR1 candidate status
- operator-visible inspectable candidate state

The control plane does **not** own:

- runtime cognition
- counted evidence semantics
- promotion or live meaning

### Boundary rules

- surfaced path output is not yet a `Candidate`
- runtime/session/chat/workspace output must not become the durable candidate record
- provenance capture explains why the path appeared, but it does not count as evaluation evidence
- candidate existence proves the path is real, not trustworthy, promotable, approved, or live

## Minimum Durable Candidate Shape

PR1 only requires the minimum candidate shape needed to make one path real and handoff-ready.

| Field | Meaning |
| --- | --- |
| `candidate_id` | Stable durable identity for the candidate |
| `created_at` | When the durable candidate record was created |
| `origin_kind` | What kind of surfaced origin created the candidate |
| `origin_ref` | Durable provenance reference back to the surfaced path source |
| `title` | Short durable operator-facing label |
| `hypothesis_summary` | Durable summary of what the path is trying to do |
| `candidate_status` | Current PR1 candidate state |
| `evaluation_handoff_ready` | Whether the candidate has enough durable structure to enter PRD 2 without reauthoring |

### PR1 candidate status values

PR1 only needs these states:

- `materialized`
- `handoff_ready`
- `archived`

These values must not encode:

- counted evidence
- legitimacy
- promotion
- live posture

## Operator Inspect Surface

The operator must be able to inspect one candidate and answer, from the product surface alone:

- what this path is
- why it surfaced
- where it came from
- that the system now owns it durably
- whether it is ready to hand off into later evaluation

The inspect surface therefore needs to expose:

- durable candidate identity
- title
- hypothesis summary
- origin kind
- origin reference or provenance summary
- created time
- current PR1 candidate status
- evaluation handoff readiness

The inspect surface must not imply:

- that evidence already counted
- that the candidate is stronger or weaker
- that it passed a gate
- that it is approved for live trading

## Risks And Failure Modes

- the surfaced path stays trapped in chat or runtime output and never becomes durable truth
- provenance is too thin for the operator to explain why the path exists
- the candidate summary is too vague to hand off into evaluation without rewriting
- the inspect surface looks like an admin record rather than system ownership
- candidate materialization is mistaken for legitimacy, promotion, or live readiness
- runtime/session state silently remains the real system of record

## Test And Acceptance Criteria

PR1 design is implementation-safe only if:

1. one reader can point to the exact line where path origination ends and candidate materialization begins
2. one reader can list the minimum durable fields required to make a candidate real
3. one reader can explain what the operator must see in order to trust that the path is now real
4. PR1 still stops before evidence, promotion, live execution, and wake/intervention
5. control-plane ownership of durable candidate truth is explicit and not shared with the runtime

## Explicitly Deferred Items

PR1 does not define:

- counted versus non-counted evidence
- stronger, weaker, hold, or reject meaning
- promotion or live-gate rationale
- live execution posture
- wake, pause, stop, or override behavior
- broader lineage, evidence, promotion, or live-association fields beyond what PR1 needs
