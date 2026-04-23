# ADR 0005: Proactive Operations Layer

## Status

accepted

## Context

autokairos already had a strong runtime-side story:

- always-on substrate plus wakeable runtime
- governed execution requests
- execution attempts
- production-agent state, guardrails, and observability

That was still incomplete for a living trading system.

The stronger source pass showed that the reference systems do not treat proactive work as one
feature:

- Claude Code splits `/loop`, local scheduled tasks, and cloud routines
- OpenClaw splits heartbeat, cron, standing orders, task flow, and hooks
- Codex now treats automations, future-work wakeups, review queues, memory, and proactive
  suggestions as first-class product primitives
- Multica places autopilot above task execution
- Paperclip treats scheduled heartbeats and event triggers as governed company behavior

So proactive work could not remain an incidental detail under `agent-system`.

## Decision

autokairos adopts a distinct `proactive-operations` subsystem above the agent runtime.

The architecture now separates:

1. always-on trading substrate
2. proactive wake orchestration
3. wakeable cognitive runtime
4. downstream evaluation and governance

The new subsystem is responsible for:

- trigger taxonomy
- wake-policy truth
- periodic vs exact vs event-driven wake semantics
- standing authority
- governed self-scheduling

## Alternatives Considered

### 1. Keep scheduling and heartbeat inside `agent-system`

Rejected because it keeps collapsing orchestration and runtime into one layer and hides where
future-work truth should live.

### 2. Treat proactive behavior as just another control-plane concern

Rejected because control-plane governance and proactive wake orchestration are related but not the
same question.

### 3. Ignore self-scheduling until after implementation

Rejected because trading behavior and "living system" posture depend on wake authority from the
start.

## Consequences

- the architecture gains a fifth subsystem before ADRs
- agent docs must stop implying that scheduler truth belongs to the runtime
- proactive triggers and self-scheduling must be modeled before implementation starts
- `governed self-scheduling` becomes an explicit design commitment

## Supersedes / superseded by

- supersedes: none
- superseded by: none

## Date / owner

- Date: `2026-04-19`
- Owner: `Codex`
