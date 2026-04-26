# Wake Policy Precedence And Overlap Contract

## Thesis

autokairos needs a deterministic precedence and overlap contract so multiple active wake policies,
standing orders, and trigger candidates can resolve into one explainable outcome instead of an
accidental scheduler race.

## Why This Spec Exists

The architecture already permits:

- periodic wake policies
- event-driven wake policies
- one-shot follow-ups
- governed self-scheduling
- standing orders that constrain all of the above

That means overlap is inevitable.

Without a precedence contract:

- conflicting policies can both appear active
- weaker ambient monitoring can shadow more urgent follow-up work
- duplicate trigger candidates can create duplicate execution requests
- suppression can become invisible and unanalyzable

## Canonical Object / Interface / Boundary

This spec defines the canonical resolution behavior for overlapping wake authority.

It applies when:

- more than one active `WakePolicy` targets the same governed scope or effective scope window
- one or more `StandingOrder` constraints apply to the same candidate wake
- multiple wake candidates would otherwise create materially equivalent governed execution

It sits above:

- `WakePolicy`
- `StandingOrder`
- `SubstrateSignal`

And below:

- `WakeTriggerRecord`
- `GovernedExecutionRequest`

The precedence contract should operate over durable attributes such as authority, scope, urgency,
and coalescing eligibility.

It should not depend on one forever-closed taxonomy of trigger or policy kinds.

## Required Fields Or Required Behaviors

The resolution layer must provide these behaviors.

### 1. Active-set filtering

Only active authority may participate.

The layer must ignore policies or orders that are:

- paused
- superseded
- expired
- revoked

### 2. Authority-first resolution

Standing-order constraints are evaluated before timing or cadence convenience.

Required behavior:

- mandatory trigger obligations must not be shadowed by optional policies
- out-of-bounds self-scheduling changes must be rejected or clamped before overlap resolution
- more restrictive authority wins over more permissive authority

### 3. Specificity resolution

When multiple still-valid policies target overlapping scope:

- narrower scope wins over broader scope
- exact candidate, account, venue, or instrument scope wins over defaults
- narrower scope may refine inside broader bounds but may not widen beyond them

### 4. Trigger-urgency resolution

When scope and authority are still comparable:

- mandatory safety or risk trigger beats optional monitoring
- explicit one-shot follow-up beats recurring ambient observation
- event-driven trigger beats periodic observation
- exact scheduled run beats approximate heartbeat

### 5. Coalescing and dedupe

If several remaining candidates map to materially equivalent work:

- emit at most one primary `ExecutionRequest`
- preserve all evaluated `WakeTriggerRecord`s
- mark non-primary candidates as coalesced or suppressed by precedence

### 6. Durable suppression reason

Every overlap suppression must be representable durably, including:

- `suppressed_by_authority`
- `suppressed_by_more_specific_policy`
- `suppressed_by_more_urgent_trigger`
- `coalesced_into_existing_request`
- `suppressed_by_dedupe_window`

## Lifecycle Or State Model

A wake candidate under this contract should move through:

- `eligible`
- `authority_checked`
- `precedence_resolved`
- `emitted_primary | emitted_coalesced | suppressed`
- `recorded`

The important point is that suppression after resolution is still a recorded outcome.

## What This Is Not

This contract is not:

- the scheduler itself
- a `WakePolicy`
- a `StandingOrder`
- a `WakeTriggerRecord`
- a runtime-local debounce helper

It defines how overlap is resolved.

It does not define:

- the entire trigger taxonomy
- progression or promotion semantics
- runtime wake posture such as `cold`, `warm`, or `hot`

## Failure Modes / Invariants

### Invariants

- every emitted wake must be attributable to one precedence-resolved primary cause
- every suppressed overlapping candidate must still be durably explainable
- more restrictive authority must never lose to more permissive cadence
- more specific scope must never be widened silently by a broader policy
- coalescing must preserve history even when it reduces emitted work

### Failure modes

- two equal-scope policies both emit duplicate governed execution requests
- a weak heartbeat masks an urgent event-driven follow-up
- mandatory risk wakeups are suppressed by cadence or dedupe convenience
- runtime code implements its own overlap rules that diverge from control-plane truth
- overlap behavior can only be reconstructed from logs instead of durable records

## Relationship To Adjacent Specs

- [21-wake-policy-contract.md](../../specs/21-wake-policy-contract.md)
  defines the durable wake-policy objects this contract resolves.
- [22-standing-order-contract.md](22-standing-order-contract.md)
  defines the durable authority program that constrains precedence.
- [20-governed-self-scheduling-contract.md](20-governed-self-scheduling-contract.md)
  defines one source of proposed wake-policy change that may enter overlap resolution.
- [23-wake-trigger-record-contract.md](../../specs/23-wake-trigger-record-contract.md)
  defines the durable record that preserves emitted or suppressed overlap outcomes.
- [12-governed-execution-request-contract.md](../../specs/12-governed-execution-request-contract.md)
  defines the primary downstream object created after precedence resolution emits work.
