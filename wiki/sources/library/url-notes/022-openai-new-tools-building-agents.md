# 022 - OpenAI New Tools For Building Agents

## Source

- URL: https://openai.com/index/new-tools-for-building-agents/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 22
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This announcement is OpenAI's product-level statement that production agents need more than a model:
Responses API, built-in tools, Agents SDK, orchestration, and observability. It explicitly frames
agents as systems that independently complete tasks for users, and it identifies the production gap
as orchestration, prompt iteration, and insufficient visibility.

For autokairos, the important point is not that OpenAI has all the pieces. The important point is
that provider-backed agent execution is becoming a stack:

```text
model + tools + orchestration + tracing + evals + safety controls
```

autokairos should borrow these surfaces where useful, but keep trading truth outside them.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Responses API as agent primitive | Provider invocations can be richer than a chat completion; `RuntimeProviderAdapter` must capture exact surface used. |
| Built-in web/file/computer tools | Tool use must be mediated by `ToolProxy` and traced; provider tools are not default trading authority. |
| Agents SDK | Useful reference for `AgentSpec`, `AgentRun`, handoff, guardrail, and trace concepts. |
| Observability tools | `AgentEvent` and provider traces must normalize into autokairos `Trace`. |
| Platform direction | OpenAI provider capabilities will evolve; autokairos needs adapter seams instead of hard-coding one API. |

## Deep autokairos Insight

This source supports a core design decision:

```text
autokairos should not build a generic agent platform first
```

OpenAI is already building generic primitives for agent execution. autokairos should specialize in
trading-system lifecycle:

- candidate identity
- stage binding
- trace/evidence separation
- promotion
- live gateway
- wake/intervention/audit

Provider APIs can run the agent. autokairos decides what counts.

## What Not To Copy

- Do not treat Responses/Agents SDK product direction as a stable runtime contract without adapter
  probes.
- Do not let built-in tools bypass autokairos permission, trace, and gateway boundaries.
- Do not equate OpenAI tracing with autokairos evidence.
- Do not overbuild multi-agent orchestration before a single runtime proves useful.

## Design Questions Forced By This Source

- Which OpenAI surface is used for each `AgentRun`: Codex CLI, Responses API, Agents SDK, or hosted
  tool?
- Which provider trace fields must be copied into autokairos trace?
- Which built-in tools are allowed per stage binding?
- What falls back if OpenAI product availability changes?

## autokairos Design Pressure

Use OpenAI's agent stack as a provider capability layer, not a product truth layer.
