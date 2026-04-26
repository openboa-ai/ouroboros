# PRD: Live Runtime Remains Controllable

This PRD is the downstream contract for Slice 4.

Trust question:

**Can I stay in control after delegation?**

## Problem

Live delegation fails if the operator cannot understand and control the live runtime when conditions
change.

Without decisive intervention:

- bounded autonomy still feels unsafe
- the operator returns to shadow monitoring
- live operation becomes hidden human labor
- self-evolution can become silent mutation

## Why This Matters

MLP-01 is lovable only if the operator can step away and still recover control decisively.

## User Trigger

One promoted trader-system runtime is already running under live binding, and the operator needs to
inspect or intervene.

## Desired Outcome

The operator inspects the live runtime context and can pause, resume, stop, override, kill, or route
self-evolution into a cloned candidate version.

## In-Scope Behavior

- inspect context showing candidate, trader-system spec, trader-system program, packages, binding,
  recent intents, gateway decisions, runtime placement, trace summary, and risk state
- agent-session and team trace context when more than one agent participates
- pause one live runtime
- resume one paused live runtime
- stop one live runtime
- override one live runtime through governed action
- kill one runtime when safe stop is unavailable
- record operator actions durably
- create `CandidateVersion` for self-evolution proposals instead of mutating live in place

## Out-Of-Scope Behavior

- proactive operator notification policy
- enterprise incident management
- multi-operator escalation
- per-action manual approval loops
- broad marketplace operations
- unrestricted autonomous self-modification

## What Must Feel Lovable

The operator should feel:

- I can step away
- I can inspect enough context quickly
- pause/stop/kill actually work
- override is governed and auditable
- improvements become new versions for evaluation, not silent live changes

## Critical Constraints

- intervention actions must target a concrete live runtime
- intervention must preserve audit
- runtime state should resume or stop according to explicit lifecycle state
- cloned self-evolution must re-enter evaluation
- intervention cannot bypass gateway, risk, trace, or evidence boundaries

## Failure Scenarios

- operator cannot map an issue to candidate/spec/binding/runtime placement
- operator cannot inspect responsible agent session or communication artifact
- pause, stop, or kill is ambiguous
- override bypasses audit
- live system mutates itself without cloned evidence

## Acceptance Criteria

- operator can inspect live runtime context in product terms
- pause and stop are decisive
- kill is available for emergency termination
- override is auditable
- self-evolution creates a new candidate version for evaluation
- operator can explain the intervention afterward

## Metrics / Proof

- operator can respond without entering technical internals
- shadow monitoring decreases
- intervention history reconstructs what happened
- team trace reconstructs relevant multi-agent communication when it explains an intervention
- no live in-place mutation occurs

## Open Questions

- minimum live inspect context
- first override semantics
- first operator notification policy, if later needed

## Subsystem Impact Map

- control-plane: runtime control decisions, operator actions, audit, candidate versioning
- runtime connector: placement interruption, stop, kill, trace export, recovery
- agent-system/trading-substrate: live runtime status and recent activity

## PR Slicing Guidance

Slice 4 closes:

```text
live runtime -> inspect -> pause/resume/stop/override/kill -> audit -> candidate version if evolving
```
