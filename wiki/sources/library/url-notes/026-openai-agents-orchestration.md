# 026 - OpenAI Agents SDK Orchestration And Handoffs

## Source

- URL: https://developers.openai.com/api/docs/guides/agents/orchestration
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 26
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This page provides a clean ownership distinction for multi-agent systems:

- handoffs are for delegated ownership, where a specialist takes over
- agents-as-tools are for manager-style workflows, where the manager remains responsible and calls
  specialists as bounded capabilities

The page also says to split only when another branch truly needs different instructions, tools, or
policy.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Handoff | If a specialist owns the next decision, trace must show ownership transfer. |
| Agent as tool | A specialist can be called as a bounded capability without owning the runtime. |
| Narrow specialist jobs | Multi-agent runtime needs an admission rule, not provider-driven overbuild. |
| Structured metadata/history filtering | Shared context must be explicit and non-secret. |
| Ownership first | Runtime communication policy must answer who owns final action/output. |

## Deep autokairos Insight

This source strengthens the rule that multi-agent is not a default.

For autokairos, there are at least two different patterns:

```text
live runtime owns decision
-> calls risk critic as bounded specialist tool

or

runtime hands off a research/evaluation task
-> specialist owns that branch
```

These have different audit and authority implications. In live trading, no specialist should gain
direct exchange authority just because a handoff occurred.

## What Not To Copy

- Do not make triage-style routing the main trading architecture.
- Do not add multi-agent complexity before one runtime fails a concrete acceptance criterion.
- Do not let handoff blur evidence, promotion, or gateway ownership.
- Do not hide which agent/provider produced which output.

## Design Questions Forced By This Source

- When does a remote/specialist agent own work versus act as a tool?
- What context is shared during handoff?
- Who can emit `OrderIntent` in a multi-agent runtime?
- How is a `TeamTrace` reconstructed?

## autokairos Design Pressure

Use provider orchestration patterns only after ownership is explicit:

```text
handoff = ownership transfer
agent-as-tool = bounded assistance
```
