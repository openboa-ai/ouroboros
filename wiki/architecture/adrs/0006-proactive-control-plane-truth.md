# ADR 0006: Proactive Control-Plane Truth

- Status: `accepted`
- Date: `2026-04-19`
- Owner: `autokairos architecture`

## Context

autokairos now has a dedicated proactive-operations subsystem above the cognitive runtime.

That resolved one major problem: proactive work is no longer flattened into "some scheduler around
the agent."

But one important question remained open:

> where does durable truth for future wake authority actually live?

The source set points in a consistent direction:

- Claude Code distinguishes `/loop`, local scheduled tasks, and cloud routines, and each surface
  preserves runs, histories, and configuration outside one active foreground turn.
- OpenClaw distinguishes heartbeat, cron, hooks, standing orders, task flow, and a detached task
  ledger, while explicitly saying tasks are records, not schedulers.
- Codex exposes automations, future-work scheduling, and a review queue above the local runtime.

So proactive work is not just runtime behavior. It creates durable policy and history that must
outlive one harness session.

## Decision

autokairos will treat proactive authority as control-plane truth.

The control plane will own durable records for:

- `WakePolicy`
- `StandingOrder`
- `SelfSchedulingIntent` history
- wake-trigger history that matters for audit and reconstruction

The runtime may emit proposals and observe current wake authority.

The runtime will not:

- directly own scheduler truth
- silently mutate wake policy
- widen proactive authority without an explicit durable record path

## Alternatives Considered

### 1. Keep scheduling truth inside the runtime

Rejected because runtime-local timers and process memory are too easy to lose and too hard to
audit.

### 2. Treat all proactive settings as generic config with no dedicated record family

Rejected because standing authority, accepted or rejected self-scheduling proposals, and emitted
wake history would become hard to reconstruct.

### 3. Put proactive truth in an external scheduler only

Rejected because autokairos still needs product-level inspection and review of why future work is
authorized.

## Consequences

### Positive

- future-work authority becomes inspectable
- governed self-scheduling becomes auditable
- wake history can be reconstructed without log archaeology
- proactive operations and control plane now align cleanly

### Negative

- more record families exist before implementation starts
- scheduler integration must now preserve explicit provenance instead of just firing jobs

## Supersedes / Superseded By

- Extends [0005-proactive-operations-layer.md](0005-proactive-operations-layer.md)
- Superseded by: none
