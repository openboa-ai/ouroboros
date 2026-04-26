# 008 - ProAgentBench Paper

## Source

- URL: https://arxiv.org/pdf/2602.04482
- Canonical page used for inspection: https://arxiv.org/abs/2602.04482
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 8
- Related cluster note:
  [proactive-agent-research-papers.md](../proactive-agent-research-papers.md)

## What This Source Actually Proves

This paper sharpens proactive-agent evaluation.

It argues that many datasets fail because they use synthetic data or isolated tasks, while real
proactive assistance depends on continuous workflow context before the assistance moment. It
decomposes proactive assistance into:

- timing prediction
- assistance content generation

It also reports that long-term memory and historical context improve prediction accuracy.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Real user-session data | Trading timing/action quality should be evaluated against realistic runtime histories, not toy event examples. |
| Pre-assistance behavioral context | runtime/program context must include context refs and trace cursor, not just a trigger label. |
| Timing/content decomposition | Evaluate whether the runtime acted at the right time separately from whether its action was good. |
| Long-term memory impact | Memory is a performance lever, but must be scoped and auditable. |
| Burstiness of real workflows | Trading events may cluster; dedupe and attention budgeting matter. |

## Deep autokairos Insight

This paper is a direct argument against turning proactive runtime behavior into a fixed event enum.

In live trading, a 10% price move can be noise, emergency, opportunity, irrelevant if no position is
open, or dangerous if risk limits are already tight. The same typed event means different things
depending on context.

Therefore the correct runtime context is semantic:

```text
runtime context = reason text + observed facts + context refs + authority envelope + trace cursor
```

The runtime receives context through its artifact/program/environment boundary and decides what
internal path is appropriate. The control plane records and evaluates the result.

## What Not To Copy

- Do not copy the benchmark tasks as trading tasks.
- Do not treat proactive accuracy as sufficient for live trading authority.
- Do not let memory improve attention while becoming invisible to audit.
- Do not optimize proactive frequency without measuring usefulness.

## Design Questions Forced By This Source

- How will autokairos label or judge proactive usefulness after the fact?
- What context must be stored before an action so future evaluation can judge timing?
- How does a runtime avoid over-acting during bursty market periods?
- Which memory is allowed to affect live runtime behavior?

## autokairos Design Pressure

This source pushes autokairos toward:

```text
semantic runtime context logs
timing quality evaluation
action quality evaluation
auditable memory influence
```

It makes runtime context and trace quality a governance boundary, not a scheduler abstraction.
