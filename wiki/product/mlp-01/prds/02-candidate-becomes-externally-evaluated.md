# PRD: Candidate Becomes Externally Evaluated

This PRD is the downstream contract for Slice 2.

Trust question:

**Why should I trust this candidate?**

## Problem

A durable trader-system candidate is not trustworthy until it is evaluated outside its own runtime and
its evidence is made legible.

Without external evaluation:

- agent self-report becomes fake truth
- convenience runs blur into legitimate evidence
- live promotion becomes ceremonial
- weak human supervision remains overloaded

## Why This Matters

MLP-01 depends on proving that the same candidate artifact can run under a binding and produce
external evidence that the operator can understand.

## User Trigger

The operator has a real `TraderSystemCandidate` and wants to know whether it deserves stronger
bindings.

## Desired Outcome

One candidate runs under an evaluation binding, emits trace, receives externally judged evidence,
and reaches a clear hold/reject/promote-ready state.

## In-Scope Behavior

- run the same `TraderSystemSpec` under a backtest binding
- inject declared `CapabilityPackage` resources
- preserve trace outside the runtime
- create counted and non-counted `EvidenceRecord` objects
- preserve `EvaluationRunRecord`, `EvaluationComparisonSet`, and `EvidenceSealingDecision` context
  before any evidence counts
- make legitimacy mode visible
- show why the candidate is stronger, weaker, held, rejected, or live-gate ready
- present one explicit live gate when eligible

## Out-Of-Scope Behavior

- actual live execution
- operator intervention
- direct exchange access
- broad optimizer or portfolio ranking
- treating Claude outcomes, rubric checks, or self-critique as trading evidence
- treating A2A task results or remote-agent artifacts as trading evidence without evaluator sealing

## What Must Feel Lovable

The operator can tell:

- which candidate was evaluated
- which binding was used
- which packages were active
- what counted
- what did not count
- which agent/runtime artifacts were merely trace context
- why the candidate can or cannot advance

## Critical Constraints

- evaluator truth is outside the runtime
- trace is not evidence by default
- A2A messages, task results, and artifacts are not evidence by default
- convenience mode and legitimate mode stay distinct
- comparable evidence requires provider/model/run, binding, package, and data-window attribution
- evaluator output is not counted evidence until sealed
- live gate is per candidate and evidence-backed
- no promotion can be inferred from successful runtime completion alone

## Failure Scenarios

- the evaluated artifact differs from the candidate artifact
- package assumptions are invisible
- local convenience results count silently
- evidence is just agent narration
- evidence is just remote-agent output or A2A artifact exchange
- operator cannot explain hold/reject/promotion-ready status

## Acceptance Criteria

- one candidate run produces external trace
- one evidence record explicitly marks counted or non-counted status
- evidence links to candidate, trader-system spec, capability packages, binding, and evaluator
- sealing decision shows what evaluator output counted, did not count, or required quarantine/review
- non-comparable or partial runs are visible but cannot create live-gate readiness
- live-gate readiness is visible only when evidence supports it
- the candidate is still not live

## Metrics / Proof

- operator can explain why a candidate advanced, held, or failed
- no counted evidence is sourced from runtime self-report alone
- evaluation can be repeated against the same candidate artifact and binding

## Open Questions

- minimum evaluator API for the first wedge
- minimum legitimacy mode metadata
- minimum evidence window before live gate

## Subsystem Impact Map

- evaluation-and-progression: judged evidence and status meaning
- control-plane: evidence and promotion readiness records
- agent-system/runtime connector: trace export from candidate run

## PR Slicing Guidance

Do not ship live execution until this PRD can show:

```text
same candidate artifact -> binding run -> external evidence -> live-gate readiness
```
