# Trigger Model

This page defines the trigger taxonomy for autokairos proactive operations.

It follows:

- [01-overview.md](01-overview.md)
- [../trading-substrate/03-signal-and-liveness.md](../trading-substrate/03-signal-and-liveness.md)
- [../specs/19-wake-orchestration-and-trigger-model.md](../specs/19-wake-orchestration-and-trigger-model.md)
- [../../sources/synthesis/proactive-operations-and-wake-orchestration.md](../../sources/synthesis/proactive-operations-and-wake-orchestration.md)

## Purpose

Define the small set of trigger families autokairos should recognize before implementation.

## Scope And Non-Goals

This page covers:

- trigger families
- context and timing semantics
- how those triggers should map into governed execution

This page does not cover:

- exact persistence schemas
- detailed policy record shapes
- human review workflow itself

## Responsibilities

The trigger model should:

- separate approximate heartbeat turns from precise schedules
- separate event-driven wakes from detached scheduled runs
- separate standing authority from one-shot trigger fires
- preserve what should and should not create detached execution records

## System Boundaries

The trigger model sits between signal sources and governed execution requests.

It should not:

- be implemented as ad hoc timers inside the runtime
- infer governance rules from prompt prose alone

## Primary Abstractions

### 1. Heartbeat turn

Approximate periodic turn using a richer existing context.

Use this when:

- the system should check routine conditions
- exact timing is not critical
- reusing continuity is more valuable than detached execution purity

### 2. Scheduled run

Durable periodic or one-shot scheduled execution.

Use this when:

- timing matters
- the run should be auditable as detached work
- catch-up and dedupe rules need to be explicit

### 3. Event trigger

Wake caused by a state change.

Examples:

- price-band or volatility event
- fill or order rejection
- risk threshold crossing
- operator command
- review follow-up

### 4. Standing order

Durable program defining:

- scope
- triggers
- approval gates
- escalation rules

This is not a single fire. It is durable operating authority.

## Primary Flows

### Heartbeat path

`periodic check -> orchestration layer -> governed execution request`

### Scheduled-run path

`durable schedule -> detached wake -> governed execution request`

### Event path

`state change -> trigger evaluation -> governed execution request`

### Standing-order path

`standing-order program + matching trigger -> governed execution request or escalation`

## Failure And Recovery Model

- approximate heartbeat should tolerate missed intervals
- exact schedules need explicit catch-up and dedupe rules
- event triggers need suppression and burst control
- standing orders need explicit disable and escalation paths

## Dependencies On Other Subsystems

- The agent system consumes the resulting governed request.
- The control plane owns durable policy truth and trigger history.
- The trading substrate emits most of the meaningful event sources.

## What Is Still Delegated To Specs / ADRs

- detailed trigger invariants remain in
  [../specs/19-wake-orchestration-and-trigger-model.md](../specs/19-wake-orchestration-and-trigger-model.md)
- self-scheduling remains in
  [03-governed-self-scheduling.md](03-governed-self-scheduling.md)

## Trigger Taxonomy Table

| Trigger family | Timing precision | Context posture | Creates detached execution record by default | Best used for |
| --- | --- | --- | --- | --- |
| `heartbeat turn` | approximate | existing or reduced continuity context | no | routine observation and reconciliation |
| `scheduled run` | exact or policy-bound | detached run context | yes | durable recurring work and time-sensitive checks |
| `event trigger` | immediate or near-immediate | minimal trigger payload plus reconstructed context | yes or policy-dependent | market, order, risk, and operator events |
| `standing order` | not itself a timing primitive | durable authority program | n/a | governing what future triggers are allowed to do |

## Core Claim

autokairos should not implement proactive work as "one scheduler that starts the agent sometimes."

It should implement:

- heartbeat-style contextual checks
- detached scheduled runs
- event-driven wakes
- standing authority that governs both
