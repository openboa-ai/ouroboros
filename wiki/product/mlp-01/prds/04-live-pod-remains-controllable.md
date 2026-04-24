# PRD: Live Pod Remains Controllable

This PRD is the downstream contract for Slice 4.

Trust question:

**Can I stay in control after delegation?**

## Problem

Live delegation fails if the operator cannot understand and control the live pod when conditions
change.

Without wake and intervention:

- bounded autonomy still feels unsafe
- the operator returns to shadow monitoring
- live operation becomes hidden human labor
- self-evolution can become silent mutation

## Why This Matters

MLP-01 is lovable only if the operator can step away and still recover control decisively.

## User Trigger

One promoted trader-system pod is already running under live binding, and something meaningful
requires operator attention.

## Desired Outcome

The operator receives a meaningful wake, inspects the live pod context, and can pause, stop,
override, or route self-evolution into a cloned candidate version.

## In-Scope Behavior

- meaningful wake reason for one live pod
- inspect context showing candidate, image, packages, binding, recent intents, gateway decisions,
  and risk state
- runtime-unit and team trace context when more than one agent participates
- pause one live pod
- stop one live pod
- override one live pod through governed action
- record operator actions durably
- create `CandidateVersion` for self-evolution proposals instead of mutating live in place

## Out-Of-Scope Behavior

- enterprise incident management
- multi-operator escalation
- noisy low-value wakes
- per-action manual approval loops
- broad marketplace operations
- unrestricted autonomous self-modification

## What Must Feel Lovable

The operator should feel:

- I can step away
- if I am woken, the reason matters
- I can inspect enough context quickly
- pause/stop/override actually work
- improvements become new versions for evaluation, not silent live changes

## Critical Constraints

- wake reason must be explicit
- intervention actions must target a concrete live pod
- intervention must preserve audit
- autonomy should resume or stop according to explicit state
- cloned self-evolution must re-enter evaluation

## Failure Scenarios

- wakes are noisy
- wake reason lacks context
- operator cannot map wake to candidate/image/binding
- operator cannot map wake to the responsible agent runtime unit or communication artifact
- pause or stop is ambiguous
- override bypasses audit
- live system mutates itself without cloned evidence

## Acceptance Criteria

- one meaningful wake is durable and explainable
- operator can inspect live pod context in product terms
- pause and stop are decisive
- override is auditable
- self-evolution creates a new candidate version for evaluation
- operator can explain the intervention afterward

## Metrics / Proof

- operator can respond without entering technical internals
- shadow monitoring decreases
- wake/intervention history reconstructs what happened
- team trace reconstructs relevant multi-agent communication when it caused or explains the wake
- no live in-place mutation occurs

## Open Questions

- first wake channel
- minimum live inspect context
- first override semantics

## Subsystem Impact Map

- proactive-operations: wake policy and trigger meaning
- control-plane: wake records, operator actions, audit, candidate versioning
- agent-system/trading-substrate: live pod status and recent activity

## PR Slicing Guidance

Slice 4 closes:

```text
live pod -> meaningful wake -> inspect -> pause/stop/override -> audit -> candidate version if evolving
```
