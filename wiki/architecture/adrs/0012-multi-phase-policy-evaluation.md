# ADR 0012: Multi-Phase Policy Evaluation

## Status

accepted

## Context

autokairos now treats proactive authority as:

- stable envelopes
- extensible declarative programs
- deterministic precedence rules

That creates a risk.

If the system does not also define one stable evaluation pipeline, each scheduler or service may
start interpreting proactive authority differently. The architecture would then remain flexible in
the wrong place: implementation behavior instead of clause structure.

## Decision

autokairos will evaluate proactive authority through a stable multi-phase pipeline.

The stable phases are:

1. normalize incoming causes into evaluation candidates
2. select applicable standing orders and wake policies
3. evaluate clause programs in decomposed form
4. resolve precedence and overlap
5. decide outcome: emit, coalesce, suppress, escalate, or reject
6. record durable history and refresh current projections

The architecture will stay rigid about:

- phase ordering
- authority-first evaluation
- durable explainability
- chronology before projection refresh

The architecture will stay flexible about:

- expression language
- clause registry growth
- storage backend
- service topology

## Alternatives considered

### Closed scheduler-first design

Rejected because it hardens implementation detail into architecture too early and reduces future
runtime and backend flexibility.

### Fully ad hoc per-trigger evaluation

Rejected because different trigger families or services would drift into inconsistent behavior and
make proactive authority impossible to audit cleanly.

### Pure rule-engine thesis

Rejected because it over-commits to one mechanism. The architecture needs stable evaluation
phases, not one mandatory engine product or one DSL.

## Consequences

Positive:

- proactive authority remains extensible at the clause level
- behavior remains deterministic at the evaluation level
- emitted and suppressed outcomes stay reconstructable
- scheduler implementations can vary without redefining the architecture

Negative:

- the control plane now needs clearer evaluation records and explainability surfaces
- implementers must respect the phase model instead of fusing logic opportunistically

## Supersedes / superseded by

- Supersedes: none
- Superseded by: none

## Date / owner

- Date: 2026-04-19
- Owner: Codex
