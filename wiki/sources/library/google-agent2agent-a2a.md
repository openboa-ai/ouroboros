# Source Note: Google Agent2Agent Protocol

## Source

- Title: `Agent2Agent (A2A) Protocol`
- Primary announcement URL: [https://developers.googleblog.com/ko/a2a-a-new-era-of-agent-interoperability/](https://developers.googleblog.com/ko/a2a-a-new-era-of-agent-interoperability/)
- Primary spec URL: [https://a2a-protocol.org/latest/specification/](https://a2a-protocol.org/latest/specification/)
- MCP comparison URL: [https://a2a-protocol.org/v0.2.6/topics/a2a-and-mcp/](https://a2a-protocol.org/v0.2.6/topics/a2a-and-mcp/)
- Google codelab URL: [https://codelabs.developers.google.com/intro-a2a-purchasing-concierge?hl=ko](https://codelabs.developers.google.com/intro-a2a-purchasing-concierge?hl=ko)
- Source type: official Google announcement, open protocol specification, official codelab
- Checked: `2026-04-24`

## What This Source Is

A2A is an interoperability protocol for communication between independent agent systems.

Its most important product lesson for autokairos is not "use Google Cloud." The lesson is that
multi-agent systems need an explicit communication layer when agents are independent, opaque, or
owned by different frameworks, vendors, runtimes, or execution environments.

## Core Thesis

- Agent-to-agent collaboration is a different problem from agent-to-tool access.
- A2A is meant for independent agents that need to discover capabilities, negotiate interaction
  modes, manage long-running tasks, exchange context, and return artifacts.
- MCP remains the better mental model for connecting an agent to tools, APIs, data sources, and
  resources.
- A2A is useful when another participant is itself an agent with its own state, reasoning loop,
  tools, memory, and task lifecycle.
- A2A communication does not by itself solve evaluation legitimacy, execution authority, credential
  safety, or audit truth.

## Key Mechanisms / Architecture

| A2A concept | Meaning | autokairos reading |
| --- | --- | --- |
| `AgentCard` | self-describing manifest for a remote agent's identity, capabilities, skills, interfaces, and security requirements | `A2AAgentEndpoint` discovery metadata |
| `Task` | stateful unit of work between a client agent and a remote agent | `A2ATaskRecord` or communication trace input |
| `Message` | conversational exchange inside a task | traceable agent-to-agent communication |
| `Artifact` | output produced by the remote agent | candidate input or trace artifact, not automatically evidence |
| streaming / push | status, message, and artifact updates for long-running work | trace source for remote agent collaboration |
| auth / security schemes | how the remote agent is contacted | communication policy, not trading authority |

## Important Facts

- Google's announcement frames A2A as a protocol for cross-vendor, cross-framework agent
  interoperability.
- A2A uses existing web standards such as HTTP, SSE, and JSON-RPC-style interactions.
- The announcement emphasizes capability discovery through agent cards, task management,
  collaboration through messages, and modality negotiation.
- The official A2A/MCP comparison says MCP is recommended for tools and A2A for agents.
- The Google codelab demonstrates a client agent coordinating with remote seller agents deployed
  as separate services and configured through remote agent URLs.

## Vocabulary And Mental Models

### Agent-to-tool vs agent-to-agent

For autokairos:

- MCP / tool proxy style access is for structured capabilities:
  market data lookup, backtest invocation, file fetch, exchange gateway request.
- A2A style access is for another agent system:
  evaluator agent, risk reviewer agent, researcher agent, remote specialist trader system.

### Independent agent endpoint

An A2A remote agent should be understood as an endpoint with its own:

- configuration
- runtime
- memory or state
- tools
- task lifecycle
- security policy

That maps well to autokairos' need to support both:

- single-agent pods
- multi-agent pods or distributed pod teams

### Communication artifact is not evidence

A2A artifacts are useful outputs of agent work.

They are not automatically:

- counted trading evidence
- promotion decisions
- live execution authority
- evaluator ground truth

autokairos must preserve the W2S/AAR boundary: external evaluation decides what counts.

## Transferable Lessons

- Model a multi-agent trader system as multiple `AgentRuntimeUnit` records, not as one blended
  prompt.
- Give each agent participant an explicit communication identity and capability declaration.
- Treat agent-to-agent work as task-oriented, statusful, and traceable.
- Preserve a shared control-plane surface when multiple agents collaborate in one trader-system
  pod.
- Use A2A-compatible concepts for communication seams between independent pods or external agents.
- Keep MCP/tool-proxy style interfaces for structured tools and side-effecting capabilities.

## Non-transferable Baggage

- Google Cloud Agent Engine, Cloud Run, and the codelab's commerce workflow are not autokairos
  product truth.
- A2A should not be a hard dependency for MLP-01 if a simpler local harness can prove the first
  trader-system pod.
- A2A does not replace the autokairos evaluator, risk gateway, vault, audit log, or promotion
  decision.
- A2A does not make a remote agent trustworthy merely because it is discoverable.

## autokairos Translation

The active autokairos model should become:

```text
TradingSystemPod
  -> one or more AgentRuntimeUnits
  -> optional PodCommunicationPolicy
  -> shared control-plane context surface
  -> traceable A2A-compatible task/message/artifact records
  -> external evaluator decides what counts
```

For MLP-01, single-agent pod execution remains the simplest first proof.

But the architecture must preserve the seam for:

- managed-team pods inside one execution environment
- distributed multi-pod trader systems
- external specialist agents reached through A2A-compatible endpoints

## Open Questions / Tensions

- Should the first multi-agent implementation use provider-native threads, A2A-compatible remote
  endpoints, or both behind an autokairos adapter?
- Which agent outputs should become trace artifacts versus candidate materialization inputs?
- How much `AgentCard` metadata belongs in `CapabilityPackage`, and how much belongs in runtime
  endpoint registry?
- What minimum communication policy prevents a multi-agent trader system from becoming an
  uncontrolled mesh?
