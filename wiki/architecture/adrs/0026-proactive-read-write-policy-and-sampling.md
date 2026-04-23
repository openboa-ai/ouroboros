# ADR 0026: Proactive Read Write Policy And Sampling

## Status

Accepted

## Context

autokairos already fixes:

- append-only admission history for non-trivial reads
- append-only fallback invocation history when chronology fallback runs

That still leaves a signal-to-noise problem.

If every harmless operator poll becomes durable history, serious recovery events will be harder to
see. If sampling is too aggressive, automation-safe or audit-relevant read behavior will disappear.

## Decision

autokairos will use caller-class-aware write policy:

- harmless healthy operator reads may remain sampled or ephemeral
- non-trivial admission outcomes should be durably preservable
- actual fallback execution should use stricter durability than ordinary admission history
- failed, partial, abandoned, automation-safe, and audit-relevant fallback execution should remain
  durable by default

The architecture keeps flexible:

- exact sampling percentages
- exact coalescing windows
- exact exporter and backend choices

But fixes:

- that `reject_and_fallback` and other serious read outcomes remain durably visible
- that fallback execution is more durable than benign projection reads
- that harmless polling is allowed to stay lightweight

## Alternatives Considered

### 1. Write every read durably

Rejected because history would fill with low-value healthy polling.

### 2. Treat admission and fallback history the same

Rejected because actual chronology fallback is operationally more significant than a benign current
 read.

### 3. Sample everything uniformly

Rejected because automation-safe and audit-relevant paths cannot tolerate the same loss profile as
 harmless operator reads.

## Consequences

### Positive

- control-plane history keeps more signal
- serious read behavior remains reconstructable
- fallback execution becomes easier to audit than mere projection peeks

### Negative

- implementations must classify caller class and outcome severity before writing
- write policy is now another narrow control-plane rule to maintain

## Supersedes / Superseded By

- Extends [0025-proactive-read-admission-history-and-fallback-invocation.md](0025-proactive-read-admission-history-and-fallback-invocation.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
