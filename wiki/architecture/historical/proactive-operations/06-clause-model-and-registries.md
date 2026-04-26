# Clause Model And Registries

This page defines the baseline clause families and registry posture for proactive authority.

It follows:

- [05-policy-programs-and-extensibility.md](../proactive-operations/05-policy-programs-and-extensibility.md)
- [../specs/33-wake-policy-program-clause-model.md](../specs/33-wake-policy-program-clause-model.md)
- [../specs/34-standing-order-program-clause-model.md](../specs/34-standing-order-program-clause-model.md)

## Purpose

Explain how proactive policy programs should be composed from baseline clause families instead of
one closed object schema.

## Scope And Non-Goals

This page covers:

- baseline clause families for proactive authority
- registry posture for evolving clause kinds
- how clause composition should stay governable

This page does not cover:

- one serialization format
- one expression language
- one storage schema
- low-level evaluation engine implementation

## Responsibilities

- define shared clause categories across proactive policy programs
- explain how new clause kinds may be introduced safely
- keep program growth compatible with provenance, authority, and precedence

## System Boundaries

This page sits between:

- upper-layer extensibility doctrine
- concrete proactive policy specs

It is downstream of foundation and upstream of concrete orchestration implementations.

## Primary Abstractions

- clause family
- baseline registry
- versioned clause kind
- envelope/program split
- clause composition

## Primary Flows

The intended modeling flow is:

`stable envelope -> clause family composition -> precedence and authority evaluation -> durable history and projections`

## Failure And Recovery Model

This layer has failed when:

- one first implementation clause shape becomes permanent architecture law
- policy programs cannot grow without redesigning the whole object
- new clauses appear without provenance or precedence compatibility

Recovery means:

- move fixed meaning back into baseline clause families
- put evolving mechanism detail in versioned clause kinds
- reject clause additions that do not preserve authority and chronology

## Dependencies On Other Subsystems

- depends on foundation doctrine for invariants and extensibility
- depends on proactive operations for trigger families and self-scheduling
- depends on control plane for durable storage and audit

## What Is Still Delegated To Specs / ADRs

- exact clause-model contracts remain in `../specs/`
- major doctrine changes remain in `../adrs/`

## Shared Clause Families

Across proactive policy programs, the stable clause categories should be:

### 1. Selector clauses

Define:

- governed scope
- asset or venue subsets
- signal family subsets
- target execution surface or delivery target

### 2. Trigger clauses

Define:

- trigger families
- cadence triggers
- event watches
- one-shot follow-up triggers

### 3. Time and activation clauses

Define:

- active windows
- expiry
- session-bound versus durable behavior
- market-hours or stage-bound activation

### 4. Constraint clauses

Define:

- cadence bounds
- suppression bounds
- dedupe windows
- catch-up behavior
- freshness or liveness requirements

### 5. Obligation clauses

Define:

- mandatory triggers
- non-disableable monitoring obligations
- minimum review or notification obligations

### 6. Approval and escalation clauses

Define:

- approval gates
- escalation routes
- review-required conditions
- clamp behavior for unsafe self-scheduling proposals

## Registry Posture

The architecture should maintain:

- baseline clause families
- versioned clause kinds inside those families

That means autokairos can add a new clause kind without redesigning the whole object, if the new
kind still preserves:

- provenance
- authority interpretation
- precedence compatibility
- durable explainability

## One Sentence Summary

autokairos should compose proactive authority from stable clause families with versioned clause
kinds, rather than from one permanently closed policy schema.
