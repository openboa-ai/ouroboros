# 006 - Proactive Agent Paper

## Source

- URL: https://arxiv.org/pdf/2410.12361
- Canonical page used for inspection: https://arxiv.org/abs/2410.12361
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 6
- Related cluster note:
  [proactive-agent-research-papers.md](../proactive-agent-research-papers.md)

## What This Source Actually Proves

This paper argues that proactive agents require a different evaluation problem from reactive chat.
The agent must decide whether assistance should be initiated before an explicit user request.

The important detail for autokairos is that proactivity is learned and judged from human activity
context, accepted/rejected proactive predictions, and an automatic evaluator trained to simulate
human judgment. It is not "run every N minutes."

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Real-world activity context | runtime/program context must preserve contextual facts and refs, not just a source enum. |
| Accepted/rejected proactive predictions | Timing quality should be evaluated as useful/noisy, not only delivered. |
| ProactiveBench dataset | Proactivity needs benchmark-like historical cases, not only live intuition. |
| Reward model for proactiveness | A future evaluator can judge whether runtime timing/action was justified. |
| Assistance F1 score | Proactive systems need false-positive/false-negative metrics, not only action PnL. |

## Deep autokairos Insight

The paper should make autokairos reject a simplistic event-trigger design.

In trading, a price move, fill, risk change, or time condition is not enough by itself. The runtime
needs semantic context:

- what changed
- why it may matter
- what historical or current state is relevant
- what authority envelope applies
- what budget/deadline exists
- what previous trace says about similar moments

That is why context must remain available inside the trader-system runtime rather than being
flattened into a fixed event handler. The runtime/program context should preserve enough information
for the trader system to decide whether to act, observe, ask for human input, or ignore.

## What Not To Copy

- Do not copy consumer proactive-assistance metrics directly into trading.
- Do not assume human accepted/rejected labels are enough for live trading safety.
- Do not let a learned wake model bypass risk/gateway boundaries.
- Do not turn proactivity into a hidden model that cannot be audited.

## Design Questions Forced By This Source

- What makes a proactive trading action useful versus noisy?
- What pre-action context must be preserved to evaluate that later?
- How should autokairos track false-positive and false-negative proactive behavior?
- Can a runtime learn from rejected proactive actions without silently changing live authority?

## autokairos Design Pressure

This source supports:

```text
semantic runtime context
-> trace pre-context
-> runtime decision
-> evaluated timing/action usefulness
```

It argues against cron-only or enum-handler-only trader-system behavior.
