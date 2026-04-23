# Governed Self-Scheduling Contract

## Thesis

autokairos should allow the agent to propose future wake behavior, but the runtime must never own
the scheduler directly.

## Why This Spec Exists

A living trading system needs more than fixed cron.

The agent may legitimately discover that it should:

- look more often for a while
- register a specific event watch
- pause a noisy optional trigger
- request a follow-up run after a market condition changes

Those changes need a canonical contract.

## Canonical Object / Interface / Boundary

This spec defines `SelfSchedulingIntent`.

That object sits between:

- a running execution attempt that proposes a future wake change
- the proactive-operations layer that owns durable wake policy truth
- the control plane that records proposal disposition durably

The intent should be read as an extensible proposal envelope rather than a permanently frozen set
of narrow change rows.

## Required Fields Or Required Behaviors

A `SelfSchedulingIntent` must be able to express:

- intent identity
- originating `AgentIdentity`
- originating `ExecutionAttempt`
- target scope
- proposed change type
- proposed trigger or cadence shape
- rationale
- urgency
- requested time window or effective range
- whether policy allows auto-apply
- final disposition
- schema or clause version when family-specific meaning evolves

### Required baseline change classes

- `set_cadence`
- `tighten_cadence`
- `relax_cadence`
- `add_event_watch`
- `pause_trigger`
- `resume_trigger`
- `request_followup`

These are the current baseline registry of change classes.

Future classes are allowed if they still preserve:

- explicit provenance
- explicit authority evaluation
- explicit disposition
- explicit downstream effect on durable wake truth

## Lifecycle Or State Model

`proposed -> evaluated -> auto_applied | pending_review | rejected -> recorded`

If review is required, the old wake policy remains authoritative until a new one is committed.

## What This Is Not

This is not:

- direct scheduler mutation
- a promotion decision
- a runtime-local timer
- a blanket request for more autonomy
- a permanently closed enum of all future scheduling changes

The runtime may propose. It may not silently commit.

## Failure Modes / Invariants

### Invariants

- wake-policy truth remains outside the runtime
- every applied change is attributable to an intent
- policy may clamp or reject unsafe proposals
- self-scheduling cannot bypass stage or approval policy

### Failure modes

- the agent creates runaway monitoring loops
- the agent suppresses critical risk triggers
- the system auto-applies cadence changes that should have required review
- multiple intents race and leave wake policy ambiguous

## Relationship To Adjacent Specs

- [19-wake-orchestration-and-trigger-model.md](19-wake-orchestration-and-trigger-model.md)
  defines the trigger families this intent may affect.
- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
  is the downstream execution object eventually produced by accepted wake-policy changes.
- [14-review-item-contract.md](14-review-item-contract.md)
  may be used when the intent requires explicit review.
- [21-wake-policy-contract.md](21-wake-policy-contract.md)
  defines the durable target whose future behavior may change if the intent is accepted.
- [22-standing-order-contract.md](22-standing-order-contract.md)
  defines the durable authority program that may permit, clamp, or reject the intent.
