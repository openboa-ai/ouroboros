# Wake Precedence And Overlap

This page defines how autokairos should resolve overlapping proactive wake authority.

It follows:

- [01-overview.md](../../proactive-operations/01-overview.md)
- [02-trigger-model.md](../proactive-operations/02-trigger-model.md)
- [03-governed-self-scheduling.md](../proactive-operations/03-governed-self-scheduling.md)
- [../specs/21-wake-policy-contract.md](../../specs/21-wake-policy-contract.md)
- [../specs/22-standing-order-contract.md](../specs/22-standing-order-contract.md)
- [../specs/23-wake-trigger-record-contract.md](../../specs/23-wake-trigger-record-contract.md)
- [../../sources/synthesis/proactive-operations-and-runtime-control.md](../../../sources/synthesis/proactive-operations-and-runtime-control.md)

It is also informed by additional official documentation:

- [OpenClaw: Automation & Tasks](https://docs.openclaw.ai/automation)
- [OpenClaw: Standing Orders](https://docs.openclaw.ai/automation/standing-orders)
- [Claude Code: Automate work with routines](https://code.claude.com/docs/en/web-scheduled-tasks)
- [Claude Code: Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks)

## Purpose

Define the deterministic rules that resolve:

- multiple active wake policies
- conflicting standing-order bounds
- overlapping periodic and event-driven triggers
- duplicate wake candidates in the same scope and time window

## Scope And Non-Goals

This page covers:

- wake precedence axes
- overlap resolution
- coalescing and suppression posture

This page does not cover:

- exact scheduler implementation
- UI for editing policies
- progression or promotion governance

## Responsibilities

The precedence model should:

- make overlap deterministic
- prefer durable authority over ad hoc timing convenience
- preserve wake history even when work is coalesced or suppressed
- keep identical observations from producing runaway duplicate execution

## System Boundaries

This layer sits between:

- active `WakePolicy` and `StandingOrder` records
- resulting `WakeTriggerRecord` history and `ExecutionRequest` emission

It should not:

- live only in one scheduler process
- be inferred from prompt text
- silently discard lower-priority wake candidates

## Primary Abstractions

- authority precedence
- scope specificity
- trigger urgency
- dedupe and coalescing
- suppression with explicit reason

## Primary Resolution Sequence

### 1. Active-set filtering

Discard policies or standing orders that are:

- paused
- superseded
- expired
- revoked

### 2. Authority resolution

Apply standing-order constraints before trigger timing semantics.

This means:

- mandatory trigger obligations are checked first
- denied or out-of-bounds changes are suppressed before wake timing is considered
- more restrictive authority wins over more permissive authority

### 3. Scope specificity

Among still-eligible candidates:

- narrower scope beats broader scope
- exact instrument or candidate scope beats family or portfolio-wide defaults
- narrower scope may refine behavior inside broader bounds, but may not widen authority beyond them

### 4. Trigger urgency

Among equally authorized candidates for the same effective scope and time window:

- mandatory risk or safety-triggered wake beats optional monitoring
- explicit one-shot follow-up beats ambient recurring observation
- event-driven wake beats periodic observation
- exact scheduled run beats approximate heartbeat

### 5. Coalescing and dedupe

If several candidates still point to materially the same work:

- emit one governed execution request
- preserve all evaluated wake-trigger history
- mark non-primary candidates as coalesced or suppressed by precedence rather than dropping them

## Failure And Recovery Model

The precedence model is failing if:

- two active policies for one scope can both fire with no visible rule
- a weaker ambient heartbeat overrides a more specific one-shot follow-up
- mandatory risk wakeups can be shadowed by lower-priority cadence rules
- duplicate candidates create multiple equivalent execution requests
- suppressed overlap disappears with no durable explanation

Recovery depends on:

- explicit precedence rules
- durable suppression reasons
- coalescing rules that preserve history

## Dependencies On Other Subsystems

- Depends on control-plane wake records as durable truth.
- Depends on the trading substrate for incoming signal families.
- Feeds the agent system through emitted governed execution requests.

## What Is Still Delegated To Specs / ADRs

- the canonical overlap contract remains in
  [../specs/28-wake-policy-precedence-and-overlap-contract.md](../specs/28-wake-policy-precedence-and-overlap-contract.md)
- the architectural decision to adopt deterministic precedence remains in
  [../adrs/0008-wake-policy-precedence.md](../../adrs/0008-wake-policy-precedence.md)

## Core Claim

autokairos should not let overlapping wake policies behave like an accidental scheduler race.

It should resolve overlap in this order:

- authority first
- specificity second
- urgency third
- coalescing last

That is what turns many possible wake candidates into one governed and explainable system.
