# ADR 0018: Proactive Standing Claim And Cycle Outcomes

## Status

Accepted

## Context

autokairos already fixes:

- one canonical updater
- one stable standing update cycle
- explicit trust downgrade and rebuild semantics

That still leaves two operational gaps:

1. concurrent updaters need a canonical ownership invariant per governed scope
2. non-trivial cycle outcomes need durable visibility after retries, aborts, or rebuild requests

## Decision

autokairos will add two explicit control-plane rules:

1. one governed scope must have at most one valid standing-mutation owner at a time
2. non-trivial standing-cycle outcomes must be durably inspectable as append-only operational
   history

The architecture keeps:

- claim mechanism flexible
- retry transport flexible
- storage backend flexible

But fixes:

- single-scope ownership semantics
- lost-claim behavior before persist
- outcome visibility for downgrade, rebuild, claim-loss, and failed cycles

## Alternatives Considered

### 1. Leave claim handling implicit in worker implementation

Rejected because concurrent retries would become too dependent on hidden runtime behavior.

### 2. Keep cycle outcomes only in logs or metrics

Rejected because rebuild and downgrade provenance should survive worker restarts and log rotation.

### 3. Durably record every no-op cycle forever

Rejected because it would harden the layer too early and create unnecessary operational noise.

## Consequences

### Positive

- standing mutation remains safer under retries and partial failures
- non-trivial updater behavior becomes inspectable
- rebuild and trust downgrade gain durable provenance

### Negative

- one more narrow operational record family is introduced
- claim loss and retry handling need deliberate implementation

## Supersedes / Superseded By

- Extends [0017-proactive-standing-update-cycle.md](0017-proactive-standing-update-cycle.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
