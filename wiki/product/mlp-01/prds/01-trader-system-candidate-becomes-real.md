# PRD: Trader-System Candidate Becomes Real

This PRD is the downstream contract for Slice 1.

Trust question:

**What system is this?**

## Problem

External agent providers can produce useful trading-system work, but that work is transient unless
autokairos can invoke a concrete provider, capture its output, and materialize it as a durable
`TraderSystemCandidate`.

If candidate identity is not durable:

- the operator remains the system of record
- capability/context assumptions stay hidden
- evaluation cannot compare systems fairly
- later promotion has no stable object to promote

## Why This Matters

This is the first proof that autokairos is not idea spam. It turns an agent-built candidate system
into a product-owned object.

## User Trigger

The operator wants autokairos to create a small pool of candidate trader systems for the first
market wedge without requiring manual strategy authoring.

## Desired Outcome

One agent-built trader-system candidate becomes durable, inspectable, and ready for evaluation
handoff.

## In-Scope Behavior

- create one or more `TraderSystemCandidate` records in a small pool
- capture `TradingSystemImage` reference
- capture `CapabilityPackage` references
- capture `AgentRuntimeUnit` shape and `PodCommunicationPolicy`
- capture brain/harness provenance
- capture first-market scope as Binance BTC perpetual futures
- make the candidate inspectable to the operator
- mark whether it is ready for evaluation handoff
- for the first real provider path, use a concrete adapter contract rather than an abstract
  provider label
- preserve provider/materialization failure as an inspectable failed run without creating a false
  candidate

## Out-Of-Scope Behavior

- counted evidence
- promotion eligibility
- live deployment
- wake/intervention
- full marketplace packaging
- broad candidate ranking/portfolio optimization

## What Must Feel Lovable

The operator should immediately understand:

- this is a candidate trading system
- what image/artifact represents it
- what capability packages it expects
- whether it is single-agent now or shaped for a future managed/distributed team
- what harness or brain created it
- why it can now enter evaluation

## Critical Constraints

- candidate creation does not imply legitimacy
- tool/context packages are separate artifacts, not hidden prompt text
- credentials are not included in packages
- agent runtime output is not durable product truth
- Codex, Claude, OpenClaw/ACP, or A2A labels are not enough; implementation must specify an
  invocation surface, trace mode, and output contract
- first active provider path is `runtime_unit_role=builder_agent`, `provider_kind=codex_cli`,
  `model=gpt-5.4` until feasibility evidence changes
- agent-to-agent messages or artifacts are not durable candidate truth unless materialized by
  autokairos
- candidate identity must survive across runs and bindings

## Failure Scenarios

- candidate is just a strategy note
- candidate depends on chat history to be understood
- capability assumptions are buried in text
- the product cannot tell which artifact was evaluated later
- candidate creation is mistaken for evidence
- failed provider output creates a candidate anyway

## Acceptance Criteria

- one `TraderSystemCandidate` exists durably
- the candidate links to a `TradingSystemImage`
- the candidate links to at least one `CapabilityPackage`
- the candidate exposes its current runtime-unit shape and communication policy
- the operator can inspect provenance and current status
- the candidate can enter evaluation without reauthoring
- no evidence, promotion, or live meaning is implied
- missing, invalid, or rejected provider output leaves trace/failure context but no candidate

## Metrics / Proof

- candidate can be reloaded after runtime restart
- operator can explain what system is under judgment
- evaluation handoff does not depend on private notes or provider session context

## Open Questions

- minimum first `TradingSystemImage` manifest shape
- minimum first `CapabilityPackage` manifest shape
- minimum first `AgentRuntimeUnit` placeholder shape
- whether first pool size is one, two, or three candidates

These are execution-detail questions only.

## Subsystem Impact Map

- agent-system: concrete runtime-provider invocation and handoff
- control-plane: durable candidate/image/package/runtime-unit references
- foundation: naming and artifact invariants

## PR Slicing Guidance

The first feature PR should close:

```text
concrete provider output -> durable TraderSystemCandidate -> operator inspect surface
```
