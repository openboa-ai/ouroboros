# 007 - Generative Agents Paper

## Source

- URL: https://arxiv.org/pdf/2304.03442
- Canonical page used for inspection: https://arxiv.org/abs/2304.03442
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 7
- Related cluster note:
  [proactive-agent-research-papers.md](../proactive-agent-research-papers.md)

## What This Source Actually Proves

The paper is not about trading and not about production control planes. Its value is the memory and
behavior architecture:

- agents store natural-language records of experience
- they synthesize those memories into higher-level reflections
- they retrieve relevant memories dynamically
- they plan future behavior from observation, memory, and reflection

The key result is not "agents can roleplay humans." The key design insight is that long-lived
behavior emerges from an architecture that treats observation, memory, reflection, retrieval, and
planning as separate mechanisms.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Complete experience record | `Trace` must preserve enough runtime history for later reconstruction. |
| Reflection | Runtime summaries or candidate insights can be useful, but they remain generated artifacts. |
| Retrieval | Memory should be selected by relevance, not blindly stuffed into context. |
| Planning | Runtime behavior can be forward-looking without being centrally scripted. |
| Ablation of observation/planning/reflection | Each memory/agent component should justify its role through behavior improvement. |

## Deep autokairos Insight

This paper supports the user's intuition that a trader system is not one variable.

A trader system needs to adapt to:

- market conditions
- position state
- prior mistakes
- regime assumptions
- open hypotheses
- current authority limits
- learned operator preferences

But the paper also creates a danger: memory and reflection can become hidden authority if not
governed.

For autokairos:

- memory is context, not evidence
- reflection is candidate/runtime self-understanding, not promotion
- plans are proposals, not gateway decisions
- retrieved memory must be visible and auditable

## What Not To Copy

- Do not copy social-simulation behavior as a trading authority model.
- Do not let natural-language reflection become counted evidence.
- Do not let retrieved memory contain secrets, evaluator ground truth, or live credentials.
- Do not overfit live trading to narrative memory without external evaluation.

## Design Questions Forced By This Source

- What runtime memories should be retained across sessions?
- Which memories are candidate-local, operator-local, market-regime-local, or global?
- How does an operator inspect what memory influenced a decision?
- When should reflection create a new `CandidateVersion` instead of mutating a live runtime?

## autokairos Design Pressure

This source supports memory as a real runtime primitive, but only under governance:

```text
observation -> trace
trace/memory -> reflection
reflection -> context for future behavior
external evaluation -> evidence
```

The architecture must not collapse memory/reflection into evidence or authority.
