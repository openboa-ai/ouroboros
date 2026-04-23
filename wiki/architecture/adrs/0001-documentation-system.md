# ADR 0001: Documentation System

## Status

`accepted`

## Context

autokairos had already accumulated a large amount of architecture material, but the repository was
still at risk of three failures:

- architectural reasoning being spread across README pages, section guides, and flat spec pages
- major decisions existing without durable decision history
- implementation beginning before the documentation set became decision-complete

At the same time, the project depends heavily on source-grounded architecture work and expects to
use those documents directly during implementation.

This requires a documentation system that is:

- durable in git
- source-grounded
- explicit about document roles
- strong enough to block premature implementation

## Decision

autokairos adopts an English-first, prescriptive-spec architecture documentation system.

The system has these permanent layers:

- `wiki/sources/` for source notes and synthesis
- `wiki/architecture/00-system-map.md` for top-level reading order
- `wiki/architecture/<subsystem>/` for subsystem design docs
- `wiki/architecture/specs/` for lower-level canonical contracts
- `wiki/architecture/adrs/` for immutable decision history

The repository also adopts these rules.

- one document should answer one primary question
- subsystem docs, specs, and ADRs must stay role-separated
- diagrams must follow a C4-style view hierarchy
- implementation should begin only when the design set is decision-complete

## Alternatives Considered

### 1. Keep the current mixed structure without ADRs

Rejected because it leaves major decisions without durable history and keeps too much architectural
meaning spread across guide pages and specs.

### 2. Use a narrative handbook as the primary architecture artifact

Rejected because the project needs prescriptive contracts that implementers can follow without
making new design decisions in code.

### 3. Move decision history outside the repository

Rejected because autokairos already relies on markdown-in-git as its maintained knowledge system.
Keeping ADRs elsewhere would break locality and versioned review.

## Consequences

### Positive

- major design decisions become traceable and reviewable
- implementers can distinguish between subsystem guidance, contract specs, and decision history
- the architecture set becomes easier to evolve without rewriting history
- the repository gains a clear gate between design and implementation

### Negative

- documentation upkeep becomes more deliberate
- more decisions will need explicit ADRs instead of staying implicit
- existing docs need periodic refactoring to stay aligned with the doctrine

## Supersedes / Superseded By

- Supersedes: none
- Superseded by: none

## Date / Owner

- Date: `2026-04-19`
- Owner: `autokairos architecture`
