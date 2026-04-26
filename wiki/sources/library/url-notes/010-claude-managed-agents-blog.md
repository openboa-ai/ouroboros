# 010 - Claude Managed Agents Blog

## Source

- URL: https://claude.com/blog/claude-managed-agents
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 10
- Related cluster note:
  [anthropic-2026-runtime-and-managed-agent-stack.md](../anthropic-2026-runtime-and-managed-agent-stack.md)

## What This Source Actually Proves

This product announcement is useful because it states what teams normally have to build before a
production agent is usable:

- sandboxed code execution
- checkpointing
- credential management
- scoped permissions
- tracing
- recovery from errors
- long-running sessions
- multi-agent coordination
- governance over real-system access

The source frames Managed Agents as a way to avoid rebuilding that infrastructure for every product.
For autokairos, that validates the decision to borrow provider/harness execution capability instead
of owning the whole agent harness.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Production agent infrastructure stack | `RuntimeProviderAdapter` must probe for sandbox, session, permissions, tracing, and output contracts. |
| Long-running sessions | `AgentSession` continuity matters, but trace must survive provider disconnects. |
| Scoped permissions | Live trading permissions must be bounded through autokairos gateway, not provider self-permission. |
| Session tracing | Provider events must become durable `Trace`. |
| Multi-agent research preview | Multi-agent support should stay optional until a concrete acceptance criterion requires it. |
| Outcomes/self-evaluation | Self-evaluation is useful feedback, but not counted evidence or promotion authority. |

## Deep autokairos Insight

The announcement makes a practical point: building a real agent harness is expensive. autokairos
should not compete with Claude/Codex/OpenClaw/ADK on generic harness infrastructure.

autokairos should instead own the domain-specific control plane:

- trader-system candidate identity
- stage binding
- trace normalization
- external trading evaluation
- promotion decision
- live order gateway
- wake/intervention/audit

The provider can supply session execution, tools, sandboxing, tracing, and model upgrades. But the
trading legitimacy layer must remain outside the provider.

## What Not To Copy

- Do not make Claude Managed Agents the only supported runtime.
- Do not treat Managed Agents' outcomes feature as trading evidence.
- Do not treat provider governance as sufficient for exchange authority.
- Do not adopt multi-agent pipelines by default just because the provider offers them.

## Design Questions Forced By This Source

- Which provider capabilities are mandatory before a provider can back a live runtime?
- What fallback exists when provider session tracing is incomplete?
- How do provider permissions map to autokairos `ToolProxy` and `TradingGateway` permissions?
- What provider-managed state must be mirrored into autokairos trace?

## autokairos Design Pressure

This source supports:

```text
borrow generic agent infrastructure
own trading-specific truth and authority
```

It is one of the clearest business reasons to avoid building a bespoke full agent harness too early.
