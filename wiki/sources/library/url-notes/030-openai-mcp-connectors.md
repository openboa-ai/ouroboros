# 030 - OpenAI MCP And Connectors

## Source

- URL: https://developers.openai.com/api/docs/guides/tools-connectors-mcp
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 30
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This page treats connectors and remote MCP servers as a way to give models access to external
capabilities through a tool interface. It distinguishes OpenAI-maintained connectors from arbitrary
remote MCP servers, and emphasizes server URLs, OAuth, tool availability, and authorization.

For autokairos, this reinforces that MCP/connectors are tool/resource boundaries, not agent identity
or trading authority.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Remote MCP server | External tool providers can be attached through `ToolProxy`/capability manifests. |
| Connector | Managed wrappers are still tools, not evidence or authority. |
| OAuth/authorization | Credentials belong in binding/vault/proxy layers, not capability packages. |
| Tool listings | Runtime should know available tools, but availability is not permission. |
| Approval/trust settings | Tool calls need policy, trace, and possibly operator review. |

## Deep autokairos Insight

MCP is not A2A.

For autokairos:

```text
MCP = tool/resource access
A2A = remote agent communication
TradingGateway = live execution authority
EvidenceRecord = judged evaluation result
```

If an external service is a market-data API, backtest runner, file store, or research database, MCP
or connector patterns fit. If the external service is an autonomous specialist agent, A2A-like
semantics fit better. Neither grants live trading authority.

## What Not To Copy

- Do not put secrets inside `CapabilityPackage`.
- Do not let remote MCP tools call exchanges directly.
- Do not confuse connector admin with promotion governance.
- Do not let model-visible tool descriptions become the only permission boundary.

## Design Questions Forced By This Source

- Which capabilities are MCP-like tools versus A2A-like agents?
- How are OAuth tokens stored and injected?
- Which tool calls require approval by stage?
- How are remote tool outputs marked as untrusted until evaluated?

## autokairos Design Pressure

Tool access must be explicit, mediated, traceable, and separate from agent communication and trading
authority.
