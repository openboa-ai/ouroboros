# Wake Trigger Record Contract

## Thesis

`WakeTriggerRecord` is the durable control-plane record of one evaluated wake event, whether that
event emitted work or was suppressed.

## Why This Spec Exists

`WakePolicy` and `StandingOrder` define future authority.

That is not enough to reconstruct actual behavior.

autokairos also needs a durable answer to:

> what actually fired, what was suppressed, why, and what execution request came out of it?

Without this record:

- the system cannot explain why it woke
- the system cannot explain why it did not wake
- trigger behavior becomes a log-forensics problem

## Canonical Object / Interface / Boundary

This spec defines `WakeTriggerRecord`.

That object sits between:

- a signal or timer becoming eligible for evaluation
- a resulting `ExecutionRequest`, if one is emitted

It is a control-plane history object, not a runtime event stream.

## Required Fields Or Required Behaviors

A `WakeTriggerRecord` must be able to express:

- `wake_trigger_record_id`
- originating `ProactiveEvaluationRecord`
- source family
  - heartbeat, scheduled run, event trigger, review follow-up, operator trigger, or equivalent
- governing scope
- originating `WakePolicy`
- originating `StandingOrder` when applicable
- detection time
- evaluation result
  - emitted or suppressed
- suppression reason when suppressed
- dedupe or burst-control result when applicable
- resulting `ExecutionRequest` reference when emitted
- provenance and audit linkage

### Required behavioral coverage

The record must be able to answer:

- what was detected?
- what policy or authority was consulted?
- was work emitted or suppressed?
- if suppressed, why?
- if emitted, what governed request was created?

## Lifecycle Or State Model

The minimal lifecycle is:

`detected -> evaluated -> emitted | suppressed -> recorded`

### Required meaning

- `detected`
  a trigger candidate was observed
- `evaluated`
  policy and authority were consulted
- `emitted`
  a governed execution request was created
- `suppressed`
  no governed request was created and the reason is durable

## What This Is Not

`WakeTriggerRecord` is not:

- the scheduler itself
- a `WakePolicy`
- a `StandingOrder`
- an `ExecutionRequest`
- an `ExecutionAttempt`
- a runtime-local callback log

It is the durable history of one wake evaluation.

## Failure Modes / Invariants

### Invariants

- every emitted governed request created by proactive orchestration should be attributable to a wake-trigger record
- every wake-trigger record should remain attributable to one originating proactive evaluation
- suppressed triggers must remain explainable
- wake-trigger history must remain outside the runtime
- dedupe and burst control must not erase the fact that a trigger candidate existed

### Failure modes

- trigger suppression happens silently
- emitted work has no traceable wake origin
- repeated triggers overwrite one another with no history
- trigger history depends on one live scheduler process

## Relationship To Adjacent Specs

- [19-wake-orchestration-and-trigger-model.md](19-wake-orchestration-and-trigger-model.md)
  defines the trigger families a record may represent.
- [21-wake-policy-contract.md](21-wake-policy-contract.md)
  defines the durable policy consulted during evaluation.
- [22-standing-order-contract.md](22-standing-order-contract.md)
  defines the durable authority program that may constrain emission.
- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
  is the downstream object created when the trigger is emitted.
- [38-proactive-evaluation-to-execution-linkage-contract.md](38-proactive-evaluation-to-execution-linkage-contract.md)
  defines the stricter causal spine that keeps this record attributable to one proactive
  evaluation and one downstream execution path.
