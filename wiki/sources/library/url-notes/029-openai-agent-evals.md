# 029 - OpenAI Evaluate Agent Workflows

## Source

- URL: https://developers.openai.com/api/docs/guides/agent-evals
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 29
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This page separates debugging traces from evaluation workflows. It recommends trace grading while
debugging behavior, then datasets, graders, and eval runs to improve agent quality consistently.

For autokairos, this maps to the difference between:

- runtime trace inspection
- judged evidence
- promotion eligibility

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Trace grading | Debug workflow-level failures before formal promotion. |
| Structured graders | Evaluation criteria must be explicit and reproducible. |
| Datasets | Candidate comparisons need stable backtest/evaluation cases. |
| Eval runs | Promotion should depend on durable evaluation records, not chat summaries. |
| Regression detection | Candidate versions must be compared over time. |

## Deep autokairos Insight

This source is useful because it does not treat trace as the final answer. It shows trace can be
graded, and graders can reveal regressions. That matches autokairos:

```text
Trace
-> evaluator / grader
-> EvidenceRecord
-> PromotionDecision
```

For trading, the grader cannot just check whether the agent used the right tool. It must also judge
data legitimacy, leakage, risk behavior, stage binding, and whether results are comparable.

## What Not To Copy

- Do not copy generic agent eval criteria as trading criteria.
- Do not treat OpenAI eval platform outputs as automatically counted evidence.
- Do not use evals to optimize toward a single exploitable metric.
- Do not skip human/operator review of ambiguous evidence.

## Design Questions Forced By This Source

- What graders are needed before a candidate can move from backtest to paper?
- What datasets or scenario sets define fair candidate comparison?
- What is a regression for a trader-system runtime?
- How are evaluator failures themselves audited?

## autokairos Design Pressure

Formal evaluation is a product boundary, not a dashboard afterthought.
