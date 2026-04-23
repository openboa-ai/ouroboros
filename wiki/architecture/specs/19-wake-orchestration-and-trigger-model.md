# Wake Orchestration And Trigger Model

## Thesis

autokairos needs an explicit wake-orchestration layer above execution so proactive work does not
collapse into hidden runtime timers.

## Why This Spec Exists

Persistent operation is not only a runtime-readiness question.

autokairos also needs canonical semantics for:

- heartbeat-style contextual checks
- exact scheduled runs
- event-driven wakes
- standing authority that governs both

Without this spec, `heartbeat`, `cron`, `automation`, and `event trigger` drift into the same vague
idea.

## Canonical Object / Interface / Boundary

This spec defines the boundary between:

- signal sources
- wake orchestration
- governed execution requests

The canonical family is:

- `WakePolicy`
- `WakeTrigger`
- `WakeDeliveryMode`

These should be read as stable architectural families, not as a permanently closed product
taxonomy.

## Required Fields Or Required Behaviors

At minimum, a wake-orchestration surface must be able to represent:

- trigger identity
- source family
- target scope
- delivery mode
- timing precision
- context posture
- dedupe policy
- catch-up policy
- wake-class hint
- traceability to the resulting governed execution request

### Required baseline trigger families

- `heartbeat_turn`
- `scheduled_run`
- `event_trigger`
- `review_followup`
- `operator_trigger`

These are the current baseline families.

The architecture may admit new trigger families later if they preserve:

- provenance
- authority linkage
- precedence compatibility
- traceability to resulting governed execution

### Required delivery distinctions

- main-context turn
- detached execution
- no-op / suppressed

## Lifecycle Or State Model

A wake trigger should move through a small explicit lifecycle:

`detected -> evaluated -> emitted or suppressed -> consumed -> recorded`

Suppressed triggers must still be explainable.

## What This Is Not

This is not:

- the execution-attempt contract
- the task ledger
- the review-item contract
- the runtime state machine

In particular:

- a task record is not the scheduler
- the runtime is not the source of wake truth
- the listed trigger families are not a forever-closed enum

## Failure Modes / Invariants

### Invariants

- wake truth must remain outside the runtime
- trigger families must remain distinguishable
- exact schedules and approximate heartbeat turns must not be conflated
- event triggers must support dedupe and burst control
- resulting governed execution requests must be traceable back to the trigger

### Failure modes

- hidden runtime timers create untracked follow-up work
- approximate wakeups are used where exact timing is required
- detached work is fired without durable traceability
- trigger storms overwhelm the runtime

## Relationship To Adjacent Specs

- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
  receives the output of this orchestration layer.
- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)
  records the concrete run launched from that request.
- [15-persistent-operations-and-wake-policy.md](15-persistent-operations-and-wake-policy.md)
  defines runtime readiness after wake orchestration has decided to run.
- [20-governed-self-scheduling-contract.md](20-governed-self-scheduling-contract.md)
  defines how the runtime may propose future trigger changes.
