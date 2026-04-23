# ADR 0013: Proactive Evaluation History And Standing

## Status

accepted

## Context

autokairos now has:

- proactive policy programs
- a multi-phase policy-evaluation pipeline
- append-only history versus current-state projection doctrine

One remaining ambiguity was whether proactive evaluation should be represented only as emitted
wake-trigger history plus current active policies, or whether the system also needs a dedicated
evaluation-history layer and a dedicated current-standing projection.

## Decision

autokairos will represent proactive evaluation at two levels:

1. `ProactiveEvaluationRecord`
   append-only durable history for evaluated proactive candidates and their outcomes
2. `CurrentProactiveStandingView`
   rebuildable current-state projection for live proactive posture

This means:

- proactive evaluation chronology will not be reduced to emitted wake-trigger history alone
- current standing will not become the only proactive truth surface
- current standing will remain downstream of active authority plus evaluation history

## Alternatives considered

### Emit-only history

Rejected because suppressed, coalesced, escalated, and rejected proactive outcomes would become
hard to reconstruct.

### Standing-view-only posture

Rejected because current standing would erase the chronology explaining why proactive posture looks
the way it does now.

### Fold proactive evaluation into candidate evidence

Rejected because proactive evaluation is about wake authority and operational readiness, not
candidate quality or promotion.

## Consequences

Positive:

- proactive outcomes become auditable even when no work is emitted
- current proactive posture becomes readable without replaying all history
- proactive evaluation remains clearly separate from candidate evaluation and promotion

Negative:

- the control plane gains another adjacent history/projection pair to maintain
- implementers need to preserve linkage between evaluation history, active authority, and
  downstream emitted objects

## Supersedes / superseded by

- Supersedes: none
- Superseded by: none

## Date / owner

- Date: 2026-04-19
- Owner: Codex
