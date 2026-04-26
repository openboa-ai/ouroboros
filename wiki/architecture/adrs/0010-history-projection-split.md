# ADR 0010: History/Projection Split

## Status

accepted

## Context

ADR 0009 established that autokairos should stay event-log-first and should not let one database
product define the architecture.

That still left one important ambiguity:

**which records are durable history, and which records are current-state projections?**

Without an explicit split, the design could still drift into:

- projection-only truth
- mutable status rows with no durable chronology
- event-heavy prose with no usable operational view

## Decision

autokairos will explicitly split durable truth into two layers:

- append-only history record families
- current-state projection families

History is authoritative for chronology and causality.

Projections are authoritative for current operational standing.

Projections remain downstream of history and should be rebuildable or reconcilable from it.

## Alternatives Considered

### 1. Projection-only control plane

This keeps reads simple, but it loses durable chronology and weakens auditability.

### 2. Event-only system with no first-class projections

This preserves chronology, but makes live operations and operator inspection too expensive and too
indirect.

### 3. Let each backend define the split ad hoc

This keeps implementation flexible, but it makes the architecture too dependent on storage product
defaults.

## Consequences

Positive consequences:

- the architecture now distinguishes what happened from what currently stands
- execution, proactive, and governance records can be classified more clearly
- backend selection can happen later without losing truth-shape discipline

Negative consequences:

- some existing contracts now need to be read as projection contracts rather than universal truth
- future implementation docs must define watermarks, reconciliation, and rebuild posture

## Supersedes / Superseded By

- supersedes: none
- superseded by: none

## Date / Owner

- date: 2026-04-19
- owner: Codex
