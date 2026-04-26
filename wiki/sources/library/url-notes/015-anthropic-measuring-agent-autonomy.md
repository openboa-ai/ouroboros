# 015 - Anthropic Measuring Agent Autonomy

## Source

- URL: https://www.anthropic.com/news/measuring-agent-autonomy
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 15
- Related cluster note:
  [anthropic-2026-runtime-and-managed-agent-stack.md](../anthropic-2026-runtime-and-managed-agent-stack.md)

## What This Source Actually Proves

The source argues that autonomy should be measured from real usage, not inferred from product labels.

It reports several important patterns:

- long-running Claude Code sessions are getting longer
- experienced users grant more autonomy over time
- experienced users also interrupt more often
- agent-initiated clarification stops are an important oversight path
- agent use is emerging in risky domains such as finance and cybersecurity, but not yet at huge
  scale

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Session duration | Runtime autonomy should be measured by uninterrupted useful work, not "continuous loop" labels. |
| Auto-approve rate | Delegation level is an operator behavior metric. |
| Interrupt rate | More autonomy can increase targeted intervention, not eliminate human control. |
| Agent-initiated clarification | A good live runtime should know when to ask, pause, or escalate. |
| Risk-domain tracking | Finance/trading stages need separate risk posture, not generic agent metrics. |

## Deep autokairos Insight

This source reframes "full autonomy."

The right target is not:

```text
agent never asks for help
```

The right target is:

```text
operator no longer has to be the runtime
but can intervene at high-leverage moments
```

For autokairos, autonomy should be measured by:

- how long a live runtime operates within limits
- how often it needs operator intervention
- whether its wake/escalation moments are useful
- how often gateway rejects or clips its intents
- whether external evidence supports promotion
- whether operator trust increases without hidden labor

## What Not To Copy

- Do not use Claude Code autonomy metrics as trading safety metrics directly.
- Do not equate fewer approvals with safer delegation.
- Do not ignore interruptions; they are part of the control system.
- Do not claim autonomy from architecture alone.

## Design Questions Forced By This Source

- What are autokairos' autonomy telemetry fields?
- What is a healthy interrupt/wake rate for live trading?
- When should a runtime ask for clarification instead of acting?
- Which autonomy signals affect promotion, demotion, or live limits?

## autokairos Design Pressure

This source supports:

```text
autonomy = observed delegation behavior
not a static mode flag
```

It should feed evaluation, runtime lifecycle control, and product metrics.
