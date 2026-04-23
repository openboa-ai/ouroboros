# ADR 0022: Proactive Rebuild Progress Field Families

## Status

Accepted

## Context

autokairos already fixes:

- append-only rebuild attempt history
- rebuildable current progress view
- append-only operator action history

That still leaves one read-shape gap.

Without a stable field-family contract, implementations may expose:

- only status strings
- only timestamps
- inconsistent automation-safe read signals

This would weaken recovery visibility exactly where stale versus current posture matters most.

## Decision

autokairos will shape `CurrentProactiveRebuildProgressView` through stable semantic field families:

- identity and linkage
- posture and reason
- freshness
- coverage
- terminal summary
- read safety

The architecture keeps flexible:

- exact storage schema
- exact wire payload
- exact UI model

But fixes:

- which semantic groups must be present
- the requirement that freshness and coverage stay distinct
- the requirement that callers can tell when deeper chronology is required

## Alternatives Considered

### 1. Keep only a high-level progress-view contract with no field families

Rejected because different implementations would likely drift toward incompatible read semantics.

### 2. Freeze one exact relational schema

Rejected because it would over-harden the upper layer too early.

### 3. Treat read safety as UI concern only

Rejected because automation-safe reads and operator reads both need explicit semantics.

## Consequences

### Positive

- progress semantics stay consistent across implementations
- stale and partial reads become easier to detect
- storage and transport choices remain flexible

### Negative

- one more narrow shaping spec must be maintained
- implementers must translate semantic families into local schemas deliberately

## Supersedes / Superseded By

- Extends [0021-proactive-rebuild-progress-and-action-history.md](0021-proactive-rebuild-progress-and-action-history.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
