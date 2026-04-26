# 002 - Claude Managed Agents Overview

## Source

- URL: https://platform.claude.com/docs/en/managed-agents/overview
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 2
- Related cluster note:
  [anthropic-2026-runtime-and-managed-agent-stack.md](../anthropic-2026-runtime-and-managed-agent-stack.md)

## What This Source Actually Proves

Claude Managed Agents is a managed harness API, not just "Claude with tools."

The page defines a strong boundary model:

- `Agent`: model, system prompt, tools, MCP servers, skills
- `Environment`: configured container template with packages and network access
- `Session`: running agent instance inside an environment
- `Events`: messages, tool results, and status updates exchanged with the agent

For autokairos, this is the cleanest external reference for splitting:

```text
AgentSpec
HandsEnvironment / RuntimePlacement
AgentSession
AgentEvent
Trace
```

It also says the provider supplies harness and infrastructure. That maps directly to autokairos'
provider-backed runtime decision: autokairos should not own every agent harness if Codex, Claude,
OpenClaw, A2A, or local providers can supply execution capability.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Agent config reused across sessions | `AgentSpec` should be versioned and reusable; it is not a live run. |
| Environment as container template | `HandsEnvironment` is physical/sandbox shape; it is not product truth. |
| Session as running instance | `AgentSession` is provider continuity; it does not own candidate/evidence/promotion. |
| Event streaming | Provider events must be normalized into durable `Trace`. |
| Steering/interrupting mid-execution | Runtime control must allow lifecycle control and interruption without becoming a central workflow engine. |
| Built-in tools and MCP | Tool access must be declared and mediated; tools are not agent identity. |
| Beta/research-preview caveat | Provider feature availability is not a stable product contract. |

## Deep autokairos Insight

The strongest insight is that a production agent runtime should be decomposed by lifetime.

- `AgentSpec` lives longer than one run.
- `Environment` or `RuntimePlacement` can be replaced.
- `AgentSession` may continue or die depending on provider support.
- `AgentEvent` is raw observable behavior.
- `Trace` is autokairos durable truth outside the provider.

This solves the user's concern about Docker-like portability without confusing terms. The
trader-system artifact can be stable while the physical hands environment changes across local,
container, provider-managed, or remote endpoint placements.

## What Not To Copy

- Do not brand autokairos as Claude Cowork, Claude Code, or Claude Managed Agents.
- Do not assume Claude Managed Agents beta features are first-MLP dependencies.
- Do not let provider session history become the only durable runtime history.
- Do not treat a managed environment's filesystem as evidence or promotion truth.
- Do not copy hosted-agent infrastructure breadth before the local bootstrap proves the boundary.

## Design Questions Forced By This Source

- What is the autokairos equivalent of Agent, Environment, Session, and Events?
- Which parts are provider-owned, and which are autokairos-owned?
- If a provider session is lost, what can be recovered from trace?
- Which events must be persisted for audit before a live runtime can be trusted?
- What exact provider features must be probed before a provider label is runnable?

## autokairos Design Pressure

This source supports:

```text
TraderSystemRuntime
-> RuntimePlacement
-> AgentSession
-> RuntimeProviderAdapter
-> provider event stream
-> Trace
```

It rejects any design where `TraderSystemRuntime = provider session` or where the provider
environment becomes the system of record.
