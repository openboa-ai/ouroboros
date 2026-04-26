# 033 - OpenAI Tools Overview

## Source

- URL: https://developers.openai.com/api/docs/guides/tools
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 33
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This page frames tools as capability extensions: web search, file search, tool search, function
calling, remote MCP, shell, computer use, and other tool surfaces. It also states that tool search
requires newer models.

For autokairos, tools are not just helper calls. They are permissioned side-effect surfaces.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Built-in tools | Provider-native tools need explicit stage permission and trace. |
| Function calling | Custom autokairos tools should be schema-bound and policy-mediated. |
| Remote MCP | External tool servers belong behind `ToolProxy`. |
| Tool search | Deferred tool discovery is useful but must not bypass permissions. |
| Model/tool compatibility | Tool availability is part of provider feasibility. |

## Deep autokairos Insight

This source reinforces a strict boundary:

```text
tool availability != tool authority
```

A model may know a tool exists, but stage binding and policy decide whether it can use it. In
trading, this matters because the same tool family can be safe in backtest and dangerous in live.

## What Not To Copy

- Do not expose broad web/shell/computer tools in live stage by default.
- Do not let tool search discover high-authority tools without approval.
- Do not treat function-call schema as enough risk control.
- Do not let provider tool logs replace autokairos audit.

## Design Questions Forced By This Source

- Which tools are declared by capability package versus granted by stage binding?
- Which tools can be discovered at runtime?
- Which tools require replayable audit?
- Which tools are forbidden in live trader runtimes?

## autokairos Design Pressure

Tooling belongs behind explicit `ToolProxy`, stage permissions, and trace.
