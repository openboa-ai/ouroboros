# Governed Self-Scheduling

This page defines how autokairos should let the agent influence future wake behavior without
letting the runtime silently take over orchestration truth.

It follows:

- [01-overview.md](01-overview.md)
- [02-trigger-model.md](02-trigger-model.md)
- [../specs/20-governed-self-scheduling-contract.md](../specs/20-governed-self-scheduling-contract.md)
- [../control-plane/05-proactive-policy-and-wake-records.md](../control-plane/05-proactive-policy-and-wake-records.md)
- [../../sources/synthesis/proactive-operations-and-wake-orchestration.md](../../sources/synthesis/proactive-operations-and-wake-orchestration.md)

## Purpose

Define the policy for agent-proposed wake-policy changes.

## Scope And Non-Goals

This page covers:

- what the agent may propose
- what it must never change directly
- how proposals should be auto-applied or escalated

This page does not cover:

- exact review queue mechanics
- generic candidate promotion semantics
- detailed scheduler implementation

## Responsibilities

Governed self-scheduling should:

- let the agent request future monitoring or follow-up work
- keep scheduler truth outside the runtime
- preserve auditability for schedule changes
- prevent runaway self-escalation or infinite monitoring loops

## System Boundaries

The runtime may emit a `SelfSchedulingIntent`.

It may not:

- directly rewrite scheduler state
- directly widen its own authority beyond policy
- directly bypass approval gates

## Primary Abstractions

### `SelfSchedulingIntent`

Agent proposal to change:

- cadence
- event watches
- observation windows
- pause or resume of an existing wake policy

### `WakePolicy`

Durable orchestration truth owned outside the runtime.

### `StandingOrder`

Durable authority program that determines whether certain self-scheduling changes can be
auto-applied.

## Primary Flows

### Safe auto-apply path

`agent proposes -> policy says auto-apply is allowed -> wake policy updated -> change recorded`

### Review path

`agent proposes -> policy says review required -> review work created -> accepted or rejected`

### Rejected path

`agent proposes -> violates standing authority or policy bounds -> rejected and traced`

## Failure And Recovery Model

Potential failure modes:

- the agent tries to wake too often
- the agent suppresses a required trigger
- the agent widens active hours or authority improperly
- loops of self-generated follow-up work accumulate

The recovery posture should be:

- reject or clamp unsafe changes
- emit trace and review signals
- keep the old wake policy until a new one is explicitly committed

## Dependencies On Other Subsystems

- Depends on proactive-operations trigger taxonomy.
- Depends on control-plane review and audit.
- Depends on control-plane wake-policy and standing-authority records as durable truth.
- Feeds governed execution by changing future wake conditions, not current execution truth.

## What Is Still Delegated To Specs / ADRs

- object shape belongs in
  [../specs/20-governed-self-scheduling-contract.md](../specs/20-governed-self-scheduling-contract.md)
- major design decision belongs in the proactive-operations ADR

## Allowed Proposal Classes

- tighten periodic observation cadence within policy bounds
- add an event watch from an approved family
- request a one-time follow-up wake
- pause a noisy optional trigger
- narrow active monitoring windows

## Proposal Classes That Must Not Apply Directly

- switching `live` into an unrestricted hot loop
- widening approval authority
- adding new destructive trigger families
- changing promotion or review policy
- disabling mandatory risk-driven wakeups

## Core Claim

autokairos should support self-scheduling, but only as:

**agent-proposed orchestration change, owned and committed by a governed layer outside the runtime.**
