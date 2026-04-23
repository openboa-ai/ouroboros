# Wake Policy Contract

## Thesis

`WakePolicy` is the durable control-plane policy program that defines when future work may be
awakened for a given scope.

## Why This Spec Exists

autokairos now distinguishes:

- heartbeat turns
- scheduled runs
- event triggers
- governed self-scheduling

That distinction is not enough unless one durable object says what future wake behavior is
currently authorized.

Without this spec:

- scheduler truth drifts into runtime-local timers
- self-scheduling proposals have no durable target to modify
- operators cannot inspect or audit current wake authority

## Canonical Object / Interface / Boundary

This spec defines `WakePolicy`.

That object sits between:

- proactive signal sources and self-scheduling proposals
- governed execution requests that future trigger firings may create

`WakePolicy` is durable control-plane truth, not a runtime-local convenience object.

It should be read as:

- a stable outer envelope for authority, scope, provenance, and status
- an extensible declarative program for trigger, timing, suppression, and delivery clauses

## Required Fields Or Required Behaviors

A `WakePolicy` must be able to express:

- `wake_policy_id`
- target scope
  - candidate, agent, session line, workspace group, or other explicit scope
- policy family or program kind
- schema or program version
- trigger definitions, trigger references, or family-specific clauses
- active window or time-range constraints
- precision posture
  - approximate or exact
- delivery posture
  - main-context turn, detached execution, or explicit suppression
- dedupe and catch-up posture
- authority basis
  - standing-order or policy reference when applicable
- current status
  - enabled, paused, superseded, expired, or revoked
- provenance
  - operator-created, system-created, review-created, or self-scheduling-derived
- audit linkage
  - who changed it and why

### Required interpretation

The architecture should be rigid about:

- scope
- authority basis
- provenance
- status

The architecture should stay flexible about:

- exact cadence clauses
- exact event predicates
- optional suppression hints
- family-specific clause sets

## Lifecycle Or State Model

The minimal lifecycle is:

`proposed or created -> enabled -> paused | superseded | expired | revoked`

### Required meaning

- `enabled`
  the policy may currently produce wake triggers
- `paused`
  the policy exists but should not currently fire
- `superseded`
  a newer policy replaced it
- `expired`
  the policy's time window ended naturally
- `revoked`
  the policy was explicitly canceled or blocked

## What This Is Not

`WakePolicy` is not:

- one fired trigger
- one execution request
- one execution attempt
- one standing order
- one runtime-local timer
- one permanently frozen row schema for every future wake family

It defines future wake authority. It does not itself perform execution.

## Failure Modes / Invariants

### Invariants

- there must be exactly one inspectable current wake policy posture per governed scope
- wake policy truth must remain outside the runtime
- every material policy change must be attributable to an actor, rule, or intent
- a paused or revoked policy must not continue firing
- supersession must remain explicit rather than silently overwriting history

### Failure modes

- multiple conflicting policies exist for the same scope with no precedence rule
- runtime-local scheduling diverges from the stored policy
- expired follow-up wakes remain active
- policy changes happen without provenance

## Relationship To Adjacent Specs

- [19-wake-orchestration-and-trigger-model.md](19-wake-orchestration-and-trigger-model.md)
  defines the trigger families the policy may authorize.
- [20-governed-self-scheduling-contract.md](20-governed-self-scheduling-contract.md)
  defines how runtime may propose policy change.
- [22-standing-order-contract.md](22-standing-order-contract.md)
  defines the durable authority program that may constrain auto-apply behavior.
- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
  is the downstream invocation object created when a trigger under this policy is emitted.
