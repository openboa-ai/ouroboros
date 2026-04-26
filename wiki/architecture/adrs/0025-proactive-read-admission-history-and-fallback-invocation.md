# ADR 0025: Proactive Read Admission History And Fallback Invocation

## Status

Accepted

## Context

autokairos already fixes:

- one canonical read-admission evaluator
- explicit admission outcomes
- chronology fallback when current progress is insufficient

That still leaves one operational-visibility gap.

If no durable history remains for serious admission decisions or actual fallback invocations, the
architecture cannot later explain how current progress was trusted, warned, rejected, or replaced
with chronology.

## Decision

autokairos will preserve:

- append-only admission history for non-trivial read-admission decisions
- append-only fallback invocation history when chronology fallback actually runs

The architecture keeps flexible:

- exact sampling policy for harmless reads
- exact transport or query implementation for fallback
- exact observability product surfaces

But fixes:

- that serious admission decisions can become durable operational history
- that actual chronology fallback is durably visible
- that harmless operator polling does not need to become permanent history by default

## Alternatives Considered

### 1. Record every read durably

Rejected because harmless polling would flood history and weaken the signal of serious reads.

### 2. Keep admission and fallback visibility only in transient logs

Rejected because auditability and recovery forensics would be too weak.

### 3. Record admission but not actual fallback invocation

Rejected because the architecture must distinguish "fallback required" from "fallback actually
ran and produced a result."

## Consequences

### Positive

- serious current-read trust becomes reconstructable
- fallback execution becomes operationally visible
- low-value reads can stay flexible and lightweight

### Negative

- control-plane history gains two more narrow operational families
- implementations must decide which harmless reads remain ephemeral or sampled

## Supersedes / Superseded By

- Extends [0024-proactive-rebuild-read-admission-and-fallback.md](0024-proactive-rebuild-read-admission-and-fallback.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
