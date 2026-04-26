# 004 - Anthropic Harness Design For Long-Running Application Development

## Source

- URL: https://www.anthropic.com/engineering/harness-design-long-running-apps
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 4
- Related cluster note:
  [anthropic-2026-runtime-and-managed-agent-stack.md](../anthropic-2026-runtime-and-managed-agent-stack.md)

## What This Source Actually Proves

This source goes deeper than "use multiple agents." It identifies why naive long-running agent
systems fail:

- context windows fill and coherence degrades
- compaction preserves some continuity but does not remove context anxiety
- reset plus structured handoff can work better than endless continuation
- agents are weak self-evaluators, especially for subjective quality
- separating generator and evaluator is a powerful lever, but evaluator quality itself must be tuned
- every harness component encodes an assumption about model weakness and should be stress-tested

For autokairos, this is a direct warning against both extremes:

- do not force a central deterministic workflow that kills agent flexibility
- do not trust a single live agent to generate, trade, evaluate, and approve itself

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Planner / generator / evaluator pattern | Separate candidate generation, runtime execution, and evaluation/promotion. |
| Context reset plus handoff | Recovery should support fresh provider sessions using trace and artifacts. |
| External evaluator prompt tuning | Evaluation itself is a product surface that must be inspected and improved. |
| Harness simplification pressure | Do not overbuild multi-agent scaffolding until one-agent runtime fails a concrete acceptance bar. |
| Component ablation | Every runtime harness component should justify itself through observed benefit. |

## Deep autokairos Insight

The core insight is evaluator independence.

In trading terms:

- the trader-system runtime can propose behavior
- the runtime can produce traces, actions, code, analysis, and self-critiques
- a critic or evaluator can inspect those outputs
- but the candidate itself cannot own its own legitimacy

This maps cleanly to:

```text
AgentEvent / ProgramEvent
-> Trace
-> External evaluation
-> EvidenceRecord
-> PromotionDecision
```

The source also supports the user's objection to deterministic event handlers. The work agent should
retain freedom to solve the problem, but the evaluator/gateway/control plane should own the
decision boundaries.

## What Not To Copy

- Do not copy a three-agent architecture as a mandatory first design.
- Do not treat an LLM evaluator as automatically objective.
- Do not confuse "external evaluator" with "true evaluator"; evaluator quality requires its own
  trace, calibration, and review.
- Do not keep harness complexity just because it worked for an older model.

## Design Questions Forced By This Source

- Which autokairos decisions require an evaluator separate from the runtime?
- How do we inspect evaluator failures and recalibrate the evaluator?
- When should a runtime be reset rather than compacted?
- What is the minimum handoff artifact that lets a fresh trader-system runtime continue safely?
- Which harness components are load-bearing versus historical scaffolding?

## autokairos Design Pressure

This source pushes autokairos toward a design where:

```text
runtime autonomy is preserved
self-evaluation is distrusted
external evaluation is inspectable
harness complexity is justified by evidence
```

It is one of the strongest sources for keeping evaluation/promotion outside the provider-backed
runtime.
