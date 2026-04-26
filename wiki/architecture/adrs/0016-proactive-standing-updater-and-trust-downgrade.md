# ADR 0016: Proactive Standing Updater And Trust Downgrade

## Status

Accepted

## Context

autokairos already distinguishes:

- append-only proactive evaluation history
- one rebuildable current standing view per governed scope
- watermark and reconciliation posture

That still leaves an implementation-critical gap.

If no explicit projection owner exists, standing mutation leaks into scheduler code, runtime code,
or operator tools. If no explicit downgrade rules exist, current standing stays `trusted` too long
and stale posture becomes operationally dangerous.

## Decision

autokairos will treat proactive standing maintenance as one explicit control-plane capability with
two stable rules:

1. `CurrentProactiveStandingView` has one canonical mutation owner:
   `ProactiveStandingProjectionUpdater`
2. trust downgrade is first-class:
   standing loses trust explicitly when freshness, authority coverage, history coverage, or linkage
   coverage becomes uncertain

The architecture will therefore preserve:

- one canonical projection updater boundary
- incremental advancement when causal coverage is explicit
- full rebuild when continuity cannot be proven
- explicit trust classes such as `trusted`, `lagging`, `degraded`, and `blocked`

## Alternatives Considered

### 1. Let scheduler or orchestration code update standing directly

Rejected because it collapses durable standing into opportunistic mutable control logic.

### 2. Treat trust downgrade as monitoring only

Rejected because production reads need trust posture in the standing object itself, not only in
adjacent metrics or alerts.

### 3. Rebuild immediately on every uncertainty

Rejected because it removes useful intermediate postures like `lagging` and `degraded` and makes
the control plane too rigid.

## Consequences

### Positive

- standing mutation remains legible and auditable
- trust posture becomes part of the read contract, not an afterthought
- projection lag, drift, and rebuild remain visible without over-hardening the storage backend

### Negative

- one more explicit service boundary must be implemented
- updater and trust semantics must remain consistent across retries and partial failures

## Supersedes / Superseded By

- Extends [0015-proactive-record-shapes-and-standing-rebuild.md](0015-proactive-record-shapes-and-standing-rebuild.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
