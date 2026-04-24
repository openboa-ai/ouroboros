# Governed Execution Request Contract

This page defines the minimum `GovernedExecutionRequest` contract needed by the current MLP-01
baseline.

It follows:

- [11-promotion-decision-contract.md](11-promotion-decision-contract.md)
- [../03-pr3-bounded-live-trading-system-pod-design.md](../03-pr3-bounded-live-trading-system-pod-design.md)

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
- a wake-trigger record
- a brain session or pod runtime handle

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
| `live_binding_profile_ref` | Concrete `LiveBindingProfile` to resolve live data, gateway, credentials, risk, and wake policy |
| `agent_loop_policy_ref` | `continuous_live` loop envelope for the launched pod |
| `origin` | Why this request exists |
| `created_at` | When the request became durable |
| `status` | `queued`, `accepted`, `fulfilled`, `canceled`, or `superseded` |

## Required Interpretation

The request must preserve enough meaning to answer:

- which candidate is being launched?
- what gate act authorized it?
- what live scope is intended?
- which limits must be honored before routine live actions begin?
- which live binding and loop envelope are being launched?

It must not require:

- private operator memory
- runtime-local config as the only authority
- a later wake contract to explain the initial live launch

## Boundary Rules

- every real live launch must be attributable to one governed execution request
- the request must cite the upstream `PromotionDecision`
- the request must stay upstream of runtime launch and downstream of live-gate approval
- live binding cannot be created from prompt text alone; it must cite this request and the
  promotion decision
- the request may authorize a live loop, but it does not authorize any specific exchange order
- the request may later be referenced by wake/intervention history, but wake provenance is not part
  of the current PR3 minimum

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
- a proactively emitted request has one durable primary wake-trigger reference
- overlap or coalescing must not erase the non-primary wake candidates that contributed to the
  request
- a request may carry posture hints, but does not become the resolved runtime binding
- a request remains durable even if launch never happens

The design is failing if:

- the runtime bridge is called without a durable request object
- prompt text becomes the only invocation boundary
- live binding or loop policy exists only inside provider context
- request provenance from review or scheduling disappears
- a proactively emitted request can only be traced back to a generic `scheduler` origin instead of
  one primary wake record
- coalesced wake candidates disappear once the request is created
- retries silently overwrite the original request instead of relating to it

## Relationship To Adjacent Specs

This spec depends on:

- [08-candidate-contract.md](08-candidate-contract.md)
- [05-agent-execution-architecture.md](05-agent-execution-architecture.md)
- [07-runtime-bridge-interface.md](07-runtime-bridge-interface.md)
- [15-agent-loop-policy-contract.md](15-agent-loop-policy-contract.md)
- [16-order-intent-and-gateway-decision-contract.md](16-order-intent-and-gateway-decision-contract.md)
- [23-wake-trigger-record-contract.md](23-wake-trigger-record-contract.md)
- [28-wake-policy-precedence-and-overlap-contract.md](28-wake-policy-precedence-and-overlap-contract.md)

It feeds directly into:

- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)
- [09-trace-contract.md](09-trace-contract.md)
- [../agent-system/06-first-code-seam.md](../agent-system/06-first-code-seam.md)
- [38-proactive-evaluation-to-execution-linkage-contract.md](38-proactive-evaluation-to-execution-linkage-contract.md)
