# 046 - Google Developer's Guide To AI Agent Protocols

## Source

- URL: https://developers.googleblog.com/developers-guide-to-ai-agent-protocols/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 46
- Duplicate alias note:
  [047-google-agent-protocols-guide-duplicate.md](047-google-agent-protocols-guide-duplicate.md)
- Related cluster note:
  [google-2026-agent-platform-and-protocols.md](../google-2026-agent-platform-and-protocols.md)

## What This Source Actually Proves

This guide is valuable because it separates protocol layers:

- MCP connects agents to tools, data, APIs, and resources
- A2A connects agents to other agents via agent cards, messages, tasks, and artifacts
- commerce/payment protocols add typed mandates, authorization, receipts, and audit trails
- UI protocols address result presentation

For autokairos, this prevents protocol collapse.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| MCP tool discovery | `CapabilityPackage` can request tool access; `ToolProxy` grants it. |
| A2A Agent Card | Remote specialist/trader agents need advertised capabilities and endpoint metadata. |
| A2A Task/Message/Artifact | Remote agent outputs enter as trace/artifacts, not evidence. |
| Typed commerce mandates | Live trading should use explicit intent/authorization/receipt chains. |
| Manager approval over limits | `GatewayDecision` can auto-accept within envelope and require review outside. |
| Audit trail | Every side-effecting path needs intent, authorization, execution, receipt/result. |

## Deep autokairos Insight

The protocol guide gives a useful analogy for trading:

```text
IntentMandate -> PaymentMandate -> PaymentReceipt
```

maps conceptually to:

```text
OrderIntent -> GatewayDecision -> ExecutionAttempt
```

The agent can express intent, but a separate authority boundary binds it to a permitted action and
records the outcome.

## What Not To Copy

- Do not use UCP/AP2 directly for trading unless a future integration requires it.
- Do not confuse A2A remote agent communication with MCP tool use.
- Do not let protocol-level auth replace autokairos stage/gateway policy.
- Do not make UI protocols a core runtime dependency.

## Design Questions Forced By This Source

- Which integrations are tools, agents, commerce/execution, or UI?
- What is the trading equivalent of a signed mandate?
- How does autokairos discover and trust remote agent endpoints?
- Which protocol artifacts become trace versus evidence?

## autokairos Design Pressure

Keep protocol boundaries explicit:

```text
MCP = tools/resources
A2A = remote agents
Gateway = side-effect authority
Evidence = evaluator judgment
```
