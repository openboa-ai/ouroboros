# Policy Program Evaluation And Resolution Contract

## Thesis

autokairos should evaluate proactive authority through a stable multi-phase resolution pipeline
rather than through one opaque scheduler implementation or one closed policy schema.

## Why This Spec Exists

The architecture now has:

- `WakePolicy` as a durable policy program
- `StandingOrder` as a durable authority program
- extensible clause families for both
- deterministic overlap rules for emitted work

That is still insufficient unless the architecture fixes how those inputs are evaluated into an
outcome.

Without this spec:

- different schedulers or services can diverge in behavior
- clause programs become descriptive but not operational
- emitted and suppressed wake outcomes stop being reconstructable

## Canonical Object / Interface / Boundary

This spec defines the canonical evaluation and resolution boundary for proactive policy programs.

It sits above:

- `SubstrateSignal`
- `WakePolicy`
- `StandingOrder`
- `SelfSchedulingIntent`

And below:

- `WakeTriggerRecord`
- `ExecutionRequest`
- review or escalation intake for out-of-bounds changes

It is a behavioral contract, not one concrete service or storage layout.

## Required Fields Or Required Behaviors

The resolution layer must provide these stable behaviors.

### 1. Candidate normalization

Every input must become a normalized evaluation candidate before policy logic runs.

The contract must support candidates derived from at least:

- cadence or schedule ticks
- event-driven substrate signals
- one-shot follow-up intents
- self-scheduling change proposals
- operator or system policy changes

### 2. Applicable-program selection

For each normalized candidate, the layer must determine:

- which active `StandingOrder`s apply
- which active `WakePolicy` objects apply
- which scope and stage bounds are currently effective

Only active records may participate.

### 3. Decomposed clause evaluation

The layer must evaluate clause programs in a decomposed manner rather than as one opaque boolean.

At minimum it must be able to distinguish:

- selector match
- trigger-family match
- timing-window match
- allowance versus obligation
- constraint or clamp result
- approval or escalation requirement

### 4. Authority-first evaluation

Standing-order authority must constrain downstream wake-policy evaluation.

Required behavior:

- forbidden changes must be rejected before overlap or scheduling convenience is considered
- mandatory obligations must not be shadowed by optional behavior
- clamp rules must be applied before emit-versus-suppress decisions

### 5. Precedence and overlap resolution

If multiple still-eligible outcomes remain, the layer must apply the precedence contract from:

- [28-wake-policy-precedence-and-overlap-contract.md](28-wake-policy-precedence-and-overlap-contract.md)

The evaluation layer must preserve:

- primary cause
- coalesced causes
- suppression reasons

### 6. Stable outcome classes

The resolution layer must be able to produce these outcome classes:

- `emit_trigger_only`
- `emit_trigger_and_request`
- `coalesced`
- `suppressed`
- `escalate_for_review`
- `reject_change`

These are stable architectural classes, not necessarily the final storage enum.

### 7. Durable explainability

For every outcome, the layer must preserve enough information to reconstruct:

- which candidate was evaluated
- which authority and policy programs applied
- which precedence rule decided the winner
- why emission, suppression, coalescing, or escalation occurred

## Lifecycle Or State Model

A normalized candidate under this contract should move through:

`normalized -> applicable_programs_selected -> clauses_evaluated -> precedence_resolved -> outcome_decided -> history_recorded -> projections_refreshed`

The important invariant is that history recording happens after outcome decision, but before the
system considers the evaluation complete.

## What This Is Not

This contract is not:

- one scheduler daemon
- one cron engine
- one trigger taxonomy
- one storage backend
- one runtime wake implementation
- one permanently closed DSL

It defines the stable evaluation boundary only.

## Failure Modes / Invariants

### Invariants

- wake evaluation must remain attributable to authority plus policy plus cause
- the same evaluated inputs and authority snapshot should produce the same outcome class
- mandatory obligations must survive dedupe or coalescing convenience
- suppressed and coalesced candidates must remain durably explainable
- extensible clause kinds must plug into the same stable phase model

### Failure modes

- one scheduler implementation emits work that another would suppress under the same authority
- a new clause kind bypasses authority-first evaluation
- history records show that something happened, but not why
- wake behavior can only be inferred from runtime logs
- policy evaluation logic fragments into per-trigger special cases

## Relationship To Adjacent Specs

- [21-wake-policy-contract.md](../../specs/21-wake-policy-contract.md)
  defines the policy-program envelope evaluated here.
- [22-standing-order-contract.md](22-standing-order-contract.md)
  defines the authority envelope that constrains policy evaluation here.
- [33-wake-policy-program-clause-model.md](33-wake-policy-program-clause-model.md)
  defines the baseline clause families for wake policies.
- [34-standing-order-program-clause-model.md](34-standing-order-program-clause-model.md)
  defines the baseline clause families for standing orders.
- [28-wake-policy-precedence-and-overlap-contract.md](28-wake-policy-precedence-and-overlap-contract.md)
  defines the overlap rules used after clause evaluation.
- [23-wake-trigger-record-contract.md](../../specs/23-wake-trigger-record-contract.md)
  defines the durable history object emitted from this evaluation boundary.
- [12-governed-execution-request-contract.md](../../specs/12-governed-execution-request-contract.md)
  defines the downstream execution object emitted when proactive work should start.
