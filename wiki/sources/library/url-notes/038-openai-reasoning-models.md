# 038 - OpenAI Reasoning Models

## Source

- URL: https://developers.openai.com/api/docs/guides/reasoning
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 38
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

Reasoning models use internal reasoning tokens before producing output. The docs position reasoning
models as useful for complex problem solving, coding, scientific reasoning, and multi-step agentic
workflows, and mention them as strong models for Codex CLI-style coding agents.

For autokairos, reasoning effort is an execution parameter, not product truth.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Internal reasoning tokens | Reasoning budget affects quality, latency, and cost; record it on `AgentRun`. |
| Tool-heavy reasoning | Strong reasoning models can drive candidate generation and complex runtime analysis. |
| Ambiguity recovery | Reasoning models are valuable inside `TraderSystemProgram` and provider-backed runtime context. |
| Coding fit | Reasoning models support agent-authored `TraderSystemProgram`. |
| Reasoning controls | Effort settings should be explicit, tested, and versioned. |

## Deep autokairos Insight

This source supports using stronger reasoning models for:

- candidate generation
- program/script authoring
- ambiguous market-context analysis
- evaluator/critic assistance
- runtime redesign proposals

But stronger reasoning does not remove external boundaries. A better reasoning model may produce
better `OrderIntent`, but the gateway still decides.

## What Not To Copy

- Do not expose hidden reasoning as audit evidence.
- Do not assume higher reasoning effort is always better for live latency or cost.
- Do not mix evidence across different reasoning settings without metadata.
- Do not let reasoning model confidence bypass evaluator/gateway review.

## Design Questions Forced By This Source

- Which `AgentRun.purpose` values require high reasoning effort?
- What is the latency/cost ceiling for live attention?
- How are reasoning settings pinned in candidate evaluation?
- When should a runtime use a fast model versus a stronger reasoning model?

## autokairos Design Pressure

Reasoning configuration is part of reproducible provider-backed execution and must be trace-linked.
