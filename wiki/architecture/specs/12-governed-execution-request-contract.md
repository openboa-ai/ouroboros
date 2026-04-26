# Governed Execution Request Contract

This page defines the minimum `GovernedExecutionRequest` contract needed by the current MLP-01
baseline.

It follows:

- [11-promotion-decision-contract.md](11-promotion-decision-contract.md)
- [../03-pr3-bounded-live-trader-system-runtime-design.md](../03-pr3-bounded-live-trader-system-runtime-design.md)

## Thesis

`GovernedExecutionRequest` is the durable invocation object between sealed live approval and real
runtime launch.

It is where autokairos says:

- which approved candidate should start live work
- which promotion decision authorized that start
- which first-venue scope should be used
- which explicit limit envelope must be honored

Without this object, live approval and real execution collapse into one unsafe step.

## Current Active Applicability

This spec is currently active for PR3.

Its job is to make one live launch request durable before any concrete runtime attempt exists.

## What This Is Not

`GovernedExecutionRequest` is not:

- a `PromotionDecision`
- an `ExecutionAttempt`
- an operator alert or intervention record
- a brain session or runtime handle

Most importantly:

- `PromotionDecision` is the gate
- `GovernedExecutionRequest` is the governed launch request
- `ExecutionAttempt` is the concrete live try

## Canonical Role In The System

```mermaid
flowchart LR
    A["PromotionDecision"] --> B["GovernedExecutionRequest"]
    B --> C["ExecutionAttempt"]
```

The separation must remain explicit:

- gate meaning does not yet launch runtime
- governed request does not yet prove the path is live

## Minimum Contract

A `GovernedExecutionRequest` must carry at least:

| Field | Meaning |
| --- | --- |
| `governed_execution_request_id` | Stable durable identity |
| `candidate_ref` | Candidate being launched |
| `promotion_decision_ref` | Live-gate act authorizing execution |
| `requested_stage` | Current baseline requires `live` |
| `venue_binding_ref` | First-venue binding for Binance BTC perpetual futures |
| `live_limit_profile_ref` | Explicit limit envelope for routine live behavior |
| `live_binding_profile_ref` | Concrete `LiveBindingProfile` to resolve live data, gateway, credentials, and risk policy |
| `runtime_operating_policy_ref` | lifecycle, placement, trace, gateway, stop, recovery, and audit envelope for the launched runtime |
| `origin` | Why this request exists |
| `created_at` | When the request became durable |
| `status` | `queued`, `accepted`, `fulfilled`, `canceled`, or `superseded` |

## Required Interpretation

The request must preserve enough meaning to answer:

- which candidate is being launched?
- what gate act authorized it?
- what live scope is intended?
- which limits must be honored before routine live actions begin?
- which live binding and operating envelope are being launched?

It must not require:

- private operator memory
- runtime-local config as the only authority
- a later notification contract to explain the initial live launch

## Boundary Rules

- every real live launch must be attributable to one governed execution request
- the request must cite the upstream `PromotionDecision`
- the request must stay upstream of runtime launch and downstream of live-gate approval
- live binding cannot be created from prompt text alone; it must cite this request and the
  promotion decision
- the request may authorize launching a live runtime, but it does not authorize any specific
  exchange order
- the request may later be referenced by intervention history, but broad proactive notification
  metadata is not part of the active minimum

## Not In The Active Baseline

The current active baseline does not require:

- broad scheduler or overlap-resolution metadata
- multi-venue routing plans
- complex retry orchestration

If later work needs those, it should add them deliberately rather than broadening this contract by
default.

- `queued`
  the request exists but has not yet produced an execution attempt
- `accepted`
  the control plane has accepted it as runnable work
- `fulfilled`
  at least one execution attempt has been created from it
- `canceled`
  the request was intentionally stopped before fulfillment
- `superseded`
  a newer request replaced it

One request may later be associated with multiple attempts if retries are allowed.

## What This Spec Is Not

`GovernedExecutionRequest` is not:

- a prompt string
- an execution attempt
- a brain session handle
- a hands environment
- a trace
- a review item
- a promotion decision

Most importantly, it is not the live run itself.

## Failure Modes / Invariants

The key invariants are:

- a request exists before the first execution attempt exists
- a request names candidate, stage, and continuity explicitly
- a request may carry posture hints, but does not become the resolved runtime binding
- a request remains durable even if launch never happens

The design is failing if:

- the runtime connector is called without a durable request object
- prompt text becomes the only invocation boundary
- live binding or operating policy exists only inside provider context
- request provenance from review, promotion, or operator action disappears
- retries silently overwrite the original request instead of relating to it

## Relationship To Adjacent Specs

This spec depends on:

- [08-candidate-contract.md](08-candidate-contract.md)
- [07-runtime-connector-contract.md](07-runtime-connector-contract.md)
- [15-runtime-operating-policy-contract.md](15-runtime-operating-policy-contract.md)
- [16-order-intent-and-gateway-decision-contract.md](16-order-intent-and-gateway-decision-contract.md)

It feeds directly into:

- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)
- [09-trace-contract.md](09-trace-contract.md)
- [../09-trader-system-runtime-operating-model.md](../09-trader-system-runtime-operating-model.md)
