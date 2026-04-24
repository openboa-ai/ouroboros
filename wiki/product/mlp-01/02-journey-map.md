# Journey Map

## Purpose

This page defines the trust journey for a weak human operator delegating to stronger
trader-system candidates.

## Journey Thesis

Trust forms when the operator can see the same candidate system move across stronger bindings
without losing identity, evidence, or control.

The journey fails when the operator must mentally stitch together:

- what the system is
- which tools/context it used
- what environment it ran in
- what evidence counted
- why it can trade live
- how control returns during live operation

## As-Is Narrative

Today the operator sees fragments:

- a coding agent proposes or writes something
- a backtest runs somewhere
- context and tools are mixed into prompts or local files
- live deployment requires manual translation
- the operator watches because they cannot tell what is really trusted

The human carries trust manually across every transition.

## To-Be Narrative

With autokairos:

- a small candidate pool appears as durable trader-system candidates
- each candidate exposes image, capability packages, and binding history
- backtest and paper runs are understood as environment bindings for the same candidate artifact
- counted evidence is external and visible
- one live gate promotes a specific candidate into a bounded live pod
- live actions pass through a gateway
- wake and intervention preserve control

## To-Be Journey Map

| Stage | Operator question | Product proof | Trust failure if missing |
| --- | --- | --- | --- |
| Candidate pool appears | What systems are being tried? | Durable `TraderSystemCandidate` records | output feels like chat residue |
| Candidate artifact is inspectable | What exactly is this system? | `TradingSystemImage` and `CapabilityPackage` refs | operator cannot compare or rerun it |
| Backtest binding runs | Did the same system get evaluated? | `StageBinding=backtest` with external trace | evaluation feels detached from the candidate |
| Evidence is sealed | What counted? | `EvidenceRecord` from evaluator outside the pod | agent self-report becomes truth |
| Live gate appears | What am I approving? | `PromotionDecision` for one candidate and binding | gate feels ceremonial |
| Live pod runs | Is this really bounded live autonomy? | `OrderIntent -> GatewayDecision -> ExecutionAttempt` | agent has either no autonomy or unsafe authority |
| Intervention remains decisive | Can I still control it? | pause, stop, override, audit | operator becomes shadow runtime |

## Canonical Trust Journey

```text
small candidate pool
-> one TraderSystemCandidate becomes inspectable
-> same artifact runs under backtest binding
-> evidence is externally judged
-> live gate promotes one candidate
-> live binding runs through bounded gateway
-> wake/intervention preserves control
```

## Trust Breakpoints

1. Candidate identity:
   Can the operator tell this is a durable trader-system candidate, not a disposable message?
2. Capability packaging:
   Can the operator tell what context/tools/skills/data access were used?
3. Binding continuity:
   Can the operator tell backtest, paper, and live are running the same artifact?
4. Evidence legitimacy:
   Can the operator tell what counted and why?
5. Live authority:
   Can the operator tell the agent is bounded by the gateway?
6. Intervention:
   Can the operator stop or override without rebuilding trust manually?

## Failure Branches

- `Hold`: candidate remains durable but lacks enough legitimate evidence.
- `Reject`: candidate is disqualified with explicit evidence/rationale.
- `Clone`: candidate proposes a new version for re-evaluation.
- `Intervene`: live pod is paused, stopped, or overridden with audit.

## Reference Scenario

For Binance BTC perpetual futures, the same candidate image can run with:

- backtest binding: historical market data, simulated exchange, evaluator
- paper binding: live market data, paper gateway, paper risk envelope
- live binding: live market data, live gateway, strict risk envelope, wake policy

The candidate's identity must remain stable across those bindings.

## Journey Acceptance Test

A reader of this page should be able to explain:

- why the candidate is a system, not a strategy note
- why tools/context are packaged
- why backtest/paper/live are bindings
- why evidence must be external
- why live agent authority is bounded
- why intervention is part of the lovable journey
