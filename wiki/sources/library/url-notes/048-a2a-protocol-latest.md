# 048 - A2A Protocol Latest

## Source

- URL: https://a2a-protocol.org/latest/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 48
- Related cluster note:
  [google-2026-agent-platform-and-protocols.md](../google-2026-agent-platform-and-protocols.md)

## What This Source Actually Proves

A2A is a protocol for agent-to-agent communication. It emphasizes interoperability between agents
built on different platforms, delegation of subtasks, secure opaque collaboration, and
complementarity with MCP.

The page explicitly frames MCP as agent-to-tool communication and A2A as agent-to-agent
communication.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Client agent / remote agent | A trader runtime can call remote specialists without sharing internal state. |
| Agent card | Remote agent capability discovery needs a durable endpoint/capability record. |
| Task/message/artifact | A2A interactions should normalize into `AgentEvent` / `Trace`. |
| Opaque agents | Remote agents do not reveal internal memory/tools; trust must come from protocol, trace, and evaluation. |
| Complementary to MCP | Do not use A2A for tools or MCP for autonomous agents. |

## Deep autokairos Insight

A2A is useful for future multi-agent trader-system composition, but it must not become authority.

For autokairos:

```text
A2A output = remote agent communication artifact
Trace = durable record of that artifact
EvidenceRecord = only after evaluation seals it
GatewayDecision = only autokairos live authority
```

This lets external specialist agents contribute without owning promotion or live execution.

## What Not To Copy

- Do not make A2A a first-MLP dependency.
- Do not assume remote agents are trustworthy because they expose an Agent Card.
- Do not send secrets/evaluator ground truth over A2A by default.
- Do not let A2A agents emit exchange orders directly.

## Design Questions Forced By This Source

- What minimal `A2AAgentEndpoint` record is needed later?
- Which runtime contexts can be shared with remote agents?
- How are remote-agent artifacts evaluated?
- What communication policy prevents remote agents from reaching live authority?

## autokairos Design Pressure

A2A is future-compatible remote agent communication, not tool access, evidence, or live authority.
