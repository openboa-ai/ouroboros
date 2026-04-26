# ADR 0014: Proactive Causality And Reconciliation

## Status

accepted

## Context

autokairos already had:

- append-only proactive evaluation history
- rebuildable current proactive standing
- durable wake-trigger history
- governed execution requests with primary wake-cause linkage

One remaining ambiguity was whether this was enough to preserve:

- the exact causal path from proactive evaluation into execution issuance
- the trust posture of current proactive standing when projections lag or drift

## Decision

autokairos will fix two adjacent rules.

1. Proactive causality will remain reconstructable through the explicit spine:
   `ProactiveEvaluationRecord -> WakeTriggerRecord -> ExecutionRequest`
2. `CurrentProactiveStandingView` will only be operationally trustworthy when it exposes explicit
   watermark and reconciliation posture.

This means:

- emitted requests must remain attributable not only to one wake trigger, but also to one
  originating proactive evaluation
- primary and coalesced causes must remain distinct
- current proactive standing must advertise freshness, reconciliation state, and coverage horizon
  rather than silently implying completeness

## Alternatives considered

### Wake-trigger-only provenance

Rejected because it leaves proactive evaluation durable on paper but disconnected from the exact
execution work that eventually starts.

### Request-direct-from-policy posture

Rejected because it collapses wake history into request creation and makes overlap, suppression,
and coalescing harder to reconstruct.

### Standing view without watermarks

Rejected because a mutable current view with no freshness or rebuild posture is convenient but
unsafe for a living system.

## Consequences

Positive:

- proactive chronology and execution chronology remain causally joinable
- coalesced and suppressed proactive causes remain explainable after execution starts
- current proactive standing becomes safer to consume operationally

Negative:

- linkage and projection trust posture become explicit design work rather than hidden
  implementation detail
- implementers need to preserve watermark and reconciliation signals in projection reads

## Supersedes / superseded by

- Supersedes: none
- Superseded by: none

## Date / owner

- Date: 2026-04-19
- Owner: Codex
