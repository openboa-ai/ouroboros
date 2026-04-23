# ADR 0020: Proactive Standing Rebuild And Remediation

## Status

Accepted

## Context

autokairos already fixes:

- single-scope standing mutation
- expiring claim leases
- bounded retry with explicit rebuild handoff

That still leaves one recovery gap.

Once rebuild is required, the architecture needs a stable answer to three questions:

- what durable request represents the need for rebuild?
- how should detached rebuild work derive new standing safely?
- what happens when automated rebuild still cannot safely converge?

Without explicit answers, recovery slips back into worker-local behavior or ad hoc operator repair.

## Decision

autokairos will treat proactive-standing rebuild as explicit detached recovery work and will treat
blocked rebuild as a durable operator-remediation or unblock problem rather than a hidden retry
loop.

The architecture keeps flexible:

- queue or task backend
- rebuild algorithm
- operator tooling and work-item product

But fixes:

- explicit rebuild-request causality
- detached rebuild-worker semantics above durable authority and history
- audit-visible remediation and unblock semantics when automated rebuild stops being safe

## Alternatives Considered

### 1. Let workers perform implicit rebuild with no explicit request

Rejected because recovery causality and blocked scopes would remain too hard to inspect.

### 2. Skip detached rebuild and hand every blocked scope directly to an operator

Rejected because many rebuild cases should remain automatable and restartable without human
intervention.

### 3. Allow operator acknowledgement to restore trusted standing directly

Rejected because it would let manual workflow bypass causal proof and rebuild discipline.

## Consequences

### Positive

- recovery work becomes durable and inspectable
- automated rebuild stays restartable and backend-flexible
- blocked scopes can be audited without over-hard-coding one workflow product

### Negative

- one more explicit recovery layer must be implemented
- operator remediation now needs durable linkage and audit visibility

## Supersedes / Superseded By

- Extends [0019-proactive-standing-lease-retry-and-rebuild-handoff.md](0019-proactive-standing-lease-retry-and-rebuild-handoff.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
