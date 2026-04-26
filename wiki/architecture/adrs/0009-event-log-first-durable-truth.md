# ADR 0009: Event-Log-First Durable Truth

## Status

accepted

## Context

autokairos now has a normalized execution and proactive record family:

- `WakePolicy`
- `StandingOrder`
- `WakeTriggerRecord`
- `ExecutionRequestHeader`
- `ExecutionRequestWakeOriginLink`
- `ExecutionAttemptHeader`
- `ExecutionAttemptLifecycleEvent`

The architecture had started drifting toward storage-brand-first language:

- SQLite as the natural first concrete store
- Postgres/Supabase as the serious baseline
- MongoDB as the rejected alternative

That drift is too implementation-led for autokairos.

The missing decision is:

**what truth posture should define the first serious canonical execution and control-plane
truth?**

## Decision

autokairos will treat the first serious execution and control-plane truth as
**event-log-first with explicit current-state projections**.

More concretely:

- append-only history is the primary durable truth
- current-state records are explicit projections over that history
- backend choice is downstream of that truth shape
- Postgres and Supabase-backed Postgres remain strong serious implementation options
- SQLite remains allowed for local bootstrap and single-node development
- MongoDB remains allowed for secondary projections or analytics, but not as the canonical first
  truth path

The architecture is therefore centered on durable history plus projections, not on any one
database product.

## Alternatives Considered

### 1. SQLite-first as the architectural baseline

This keeps local development simple and aligns well with one-machine bootstrap work.

It was rejected as the serious baseline because:

- it over-centers one-host assumptions
- it lets bootstrap convenience define architecture
- it says too little about history vs projection

### 2. Postgres/Supabase-first as the architecture thesis

This offers a good serious implementation path.

It was rejected as the architecture thesis because:

- it still confuses backend choice with truth shape
- it is too easy for product/platform features to become the model
- it does not make append-only history primary enough

### 3. MongoDB-first document store

This offers flexible documents and denormalized read models.

It was rejected as the canonical first-truth baseline because:

- the canonical model still wants explicit history and provenance linkage
- lifecycle arrays inside mutable documents are too likely to blur event history and current state
- MongoDB's own guidance still treats multi-document transaction dependence as a design smell

## Consequences

autokairos now has a clearer truth direction.

Positive consequences:

- the architecture now says what must be durable before it says how to persist it
- append-only history becomes first-class
- current-state records are demoted to explicit projections
- Postgres/Supabase remain strong implementation options without becoming the design thesis
- SQLite remains useful locally without owning the long-term design

Negative consequences:

- the storage design discussion gets one layer more abstract before it becomes concrete
- some implementation questions are deferred until after history/projection boundaries are clearer
- future MongoDB-first proposals would need a new ADR if they tried to replace event-log-first
  truth

## Supersedes / Superseded By

- supersedes: none
- superseded by: none

## Date / Owner

- date: 2026-04-19
- owner: Codex
