# Standing Order Contract

## Thesis

`StandingOrder` is the durable authority program that constrains what proactive work,
self-scheduling, and escalation behavior is allowed for a governed scope.

## Why This Spec Exists

A living agent system needs more than schedules.

It also needs durable authority boundaries saying:

- what may be monitored
- when it may be monitored
- what can auto-apply
- what must escalate
- what must never be silently suppressed

Without this spec, wake authority drifts into prompt prose, scattered configuration, or operator
memory.

## Canonical Object / Interface / Boundary

This spec defines `StandingOrder`.

That object sits above:

- `WakePolicy`
- `SelfSchedulingIntent`
- emitted `WakeTrigger`s

And below:

- broader governance and review surfaces

Operationally, it is the durable policy-program boundary that says which future-work changes are
within authority and which require review.

It should be read as:

- a stable outer envelope for governed scope, authority, provenance, and lifecycle
- an extensible declarative program for allowed families, limits, obligations, and escalation

## Required Fields Or Required Behaviors

A `StandingOrder` must be able to express:

- `standing_order_id`
- governed scope
- objective or program class
- authority-program kind
- schema or program version
- authorized trigger families or family-specific clauses
- authorized assets, domains, or signal families
- active time windows
- permitted cadence bounds
- mandatory trigger classes that may not be disabled automatically
- approval gates
- escalation rules
- self-scheduling auto-apply rules
- status
  - active, paused, superseded, revoked
- provenance and audit linkage

### Required behavioral coverage

A standing order must be able to answer:

- may this self-scheduling change auto-apply?
- may this trigger family be added?
- may this trigger be paused?
- which trigger classes are mandatory?
- when must a review item be created instead of auto-applying?

### Required interpretation

The architecture should be rigid about:

- governed scope
- authority basis
- mandatory versus optional behavior
- provenance and supersession

The architecture should stay flexible about:

- exact selector language
- exact obligation clauses
- exact escalation clauses
- family-specific parameter shapes

## Lifecycle Or State Model

The minimal lifecycle is:

`created -> active -> paused | superseded | revoked`

### Required meaning

- `active`
  the order currently constrains wake authority
- `paused`
  the order remains durable history but is not actively governing new changes
- `superseded`
  a newer standing order replaced it
- `revoked`
  the order was explicitly canceled

## What This Is Not

`StandingOrder` is not:

- one schedule entry
- one trigger firing
- one review item
- one promotion decision
- one execution attempt

It is also not a synonym for generic instructions.

It is a durable governance program for proactive operations.

It is not a permanently closed catalog of every allowable authority rule.

## Failure Modes / Invariants

### Invariants

- every auto-applied self-scheduling change must be justifiable under an active standing order or equivalent explicit authority rule
- standing orders must remain inspectable outside the runtime
- widening authority must never occur as an undocumented side effect of one successful run
- mandatory wake obligations must not be silently disabled by lower layers

### Failure modes

- the runtime widens its own monitoring authority with no standing-order basis
- standing orders conflict and no precedence is visible
- review-required changes auto-apply because authority bounds were too vague
- a revoked order still constrains or authorizes work

## Relationship To Adjacent Specs

- [21-wake-policy-contract.md](../../specs/21-wake-policy-contract.md)
  defines the durable wake-policy object this authority constrains.
- [20-governed-self-scheduling-contract.md](20-governed-self-scheduling-contract.md)
  defines the runtime proposal object evaluated against this authority.
- [14-review-item-contract.md](../../specs/14-review-item-contract.md)
  may be created when a change exceeds standing-order authority.
- [11-promotion-decision-contract.md](../../specs/11-promotion-decision-contract.md)
  remains separate; proactive authority is not candidate progression authority.
