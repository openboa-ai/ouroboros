# ADR 0023: Proactive Rebuild Read Safety Classes

## Status

Accepted

## Context

autokairos already fixes:

- current rebuild progress as a projection
- field families for freshness, coverage, posture, and read safety

That still leaves one caller-interpretation gap.

The same current view is not equally trustworthy for:

- an operator glancing at live status
- an automation deciding whether to act
- an audit surface reconstructing what happened

Without explicit read classes, each surface will invent its own safety threshold.

## Decision

autokairos will classify proactive rebuild reads into:

- operator read
- automation-safe read
- audit read

The architecture keeps flexible:

- exact APIs
- exact fallback implementations
- exact product UX

But fixes:

- that each class has different minimum guarantees
- that automation-safe reads are the strictest
- that deeper chronology is the required fallback when current progress is insufficient

## Alternatives Considered

### 1. Treat all current progress reads the same

Rejected because operator convenience and automation safety have different tolerance for lag and
partiality.

### 2. Push all read-safety logic into individual products

Rejected because recovery semantics would drift too easily across implementations.

### 3. Allow automation to interpret `running` as sufficient by default

Rejected because stale or partially covered running posture would be over-trusted.

## Consequences

### Positive

- automation-safe recovery decisions become harder to misuse
- operator views remain useful without pretending they are machine-safe
- audit retains clear fallback to chronology

### Negative

- one more narrow semantic layer must be implemented
- APIs must now map caller intent to explicit read-safety admission

## Supersedes / Superseded By

- Extends [0022-proactive-rebuild-progress-field-families.md](0022-proactive-rebuild-progress-field-families.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
