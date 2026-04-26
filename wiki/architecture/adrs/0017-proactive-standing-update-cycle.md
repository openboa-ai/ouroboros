# ADR 0017: Proactive Standing Update Cycle

## Status

Accepted

## Context

autokairos already commits to:

- one canonical updater for current proactive standing
- explicit trust downgrade when coverage becomes uncertain
- rebuildable current standing above append-only history

That still leaves a risk.

If the updater boundary exists only in principle, different call sites can still implement
different mutation sequences, causing partial writes, inconsistent downgrade timing, or unsafe
watermark advancement.

## Decision

autokairos will define one stable update cycle for one governed scope:

`intake -> claim -> load -> decide -> persist -> follow-up`

The architecture keeps:

- trigger transport flexible
- storage backend flexible
- claim implementation flexible

But fixes:

- the order of mutation work
- the single-scope nature of one update attempt
- the requirement to choose one primary outcome class before persisting standing

## Alternatives Considered

### 1. Leave the cycle implicit in implementation

Rejected because the standing layer would drift across scheduler, projection, and operator code
paths.

### 2. Force rebuild on every non-trivial trigger

Rejected because it removes useful incremental advancement and over-hardens the system.

### 3. Allow direct trust mutations without a canonical cycle

Rejected because stale standing could be marked degraded or trusted inconsistently depending on the
caller.

## Consequences

### Positive

- current standing mutation remains deterministic
- retry behavior becomes easier to reason about
- rebuild and trust downgrade stay explicit without over-fixing transport choices

### Negative

- implementation must honor one more explicit loop boundary
- single-scope claim and retry semantics need deliberate handling

## Supersedes / Superseded By

- Extends [0016-proactive-standing-updater-and-trust-downgrade.md](0016-proactive-standing-updater-and-trust-downgrade.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
