# ADR 0024: Proactive Rebuild Read Admission And Fallback

## Status

Accepted

## Context

autokairos already fixes:

- current rebuild progress as a projection
- stable field families for posture, freshness, coverage, and read safety
- different minimum guarantees for operator, automation-safe, and audit reads

That still leaves an implementation gap.

If every caller interprets those semantics independently, the architecture will drift at the
surface layer even if the underlying projection is correct.

## Decision

autokairos will place one canonical read-admission boundary in front of current proactive rebuild
progress.

That boundary will:

- evaluate the requested read class against the current projection
- return one explicit outcome: `admit`, `admit_with_warning`, or `reject_and_fallback`
- require fallback to deeper chronology when the projection is insufficient

The architecture keeps flexible:

- exact APIs
- exact fallback transports
- exact UI products

But fixes:

- that serious callers do not bypass admission evaluation
- that automation-safe reads remain stricter than operator reads
- that chronology fallback remains required when current projection is insufficient

## Alternatives Considered

### 1. Let every surface interpret read classes locally

Rejected because caller-specific thresholds would drift and eventually contradict each other.

### 2. Treat current projection as always preferable to chronology

Rejected because stale or partial progress would be over-trusted.

### 3. Skip current projection entirely and always read chronology

Rejected because operators still need efficient live status reads and the architecture already
commits to rebuildable current views.

## Consequences

### Positive

- rebuild-progress trust becomes consistent across surfaces
- automation-safe behavior becomes harder to misuse
- chronology fallback remains explicit instead of incidental

### Negative

- one more narrow control-plane boundary must be implemented
- downstream APIs must pass caller intent or caller class explicitly

## Supersedes / Superseded By

- Extends [0023-proactive-rebuild-read-safety-classes.md](0023-proactive-rebuild-read-safety-classes.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
