# Risks And Open Questions

## Purpose

This page manages uncertainty without reopening product truth casually.

## Uncertainty Thesis

The current product truth is:

- candidate identity is `TraderSystemCandidate`
- execution unit is `TradingSystemPod`
- tools/context are `CapabilityPackage` artifacts
- backtest/paper/live are bindings
- evidence is external
- live authority is bounded
- self-evolution is clone/evaluate/promote

Unknowns should be classified by whether they threaten this identity or only affect execution
quality.

## Identity-Blocking Risks

| Risk | Why it matters | Evidence that reduces it | If it flips, update first |
| --- | --- | --- | --- |
| Operators do not value trader-system candidates over strategy authoring | Product thesis fails | operator interviews and prototype reactions | product strategy |
| Same-artifact binding model is not practical for trading systems | Pod model fails | one candidate image run through backtest and paper bindings | MLP brief and architecture primitives |
| Capability packages are not separable enough from candidate systems | Marketplace-ready boundary fails | package reuse across two candidate systems | product principles |
| External evaluation cannot judge candidate systems credibly | W2S thesis fails | evaluator produces trusted evidence for one candidate | PRD 2 and evaluation architecture |
| Bounded live authority is too weak to feel autonomous | lovable proof fails | operator accepts live pod with gateway-controlled order intent | PRD 3 |

## Lovable-Quality Risks

- candidate pool feels like noisy agent output
- package boundaries confuse the operator
- evidence summaries are too subtle
- live gate still feels ceremonial
- wake reasons are too noisy
- intervention collapses back into manual runtime
- cloned self-evolution versions are hard to compare

These risks can block launch quality without immediately changing product identity.

## Execution-Detail Questions

These may be resolved in implementation design without reopening product truth.

- Which first harness adapter should be built first?
- What is the minimum `TradingSystemImage` manifest?
- What is the first `CapabilityPackage` manifest shape?
- Which package resources are read-only versus read-write?
- What local store layout best supports pod/image/package references?
- What first evaluator boundary is enough for PRD 2?
- What first live gateway API is enough for order-intent control?

## Questions Already Settled

- Candidate is not a static note.
- A pod is not a single magic container.
- Backtest, paper, and live are bindings.
- Capability packages cannot contain secrets.
- Agent self-report is not counted evidence.
- Live agent authority is bounded by autokairos gateway.
- Self-evolution cannot mutate a live system in place.

## Decision Escalation Rule

If new evidence would change candidate identity, pod model, capability packaging, evidence
ownership, live authority, or self-evolution semantics, it is not an open question here.

Escalate first to:

1. [../05-product-decision-log.md](../05-product-decision-log.md)
2. the affected MLP page
3. PRD and architecture pages
4. implementation plans

## Read Next

1. [07-implementation-plan.md](07-implementation-plan.md)
2. [08-greenfield-bootstrap-plan.md](08-greenfield-bootstrap-plan.md)
