# Source Note: Claude Managed Agents

## Source

- Title: `Claude Managed Agents` and `Scaling Managed Agents: Decoupling the brain from the hands`
- Primary engineering URL: [https://www.anthropic.com/engineering/managed-agents](https://www.anthropic.com/engineering/managed-agents)
- Primary docs URL: [https://platform.claude.com/docs/en/managed-agents/overview](https://platform.claude.com/docs/en/managed-agents/overview)
- Official docs inspected:
  - [Quickstart](https://platform.claude.com/docs/en/managed-agents/quickstart)
  - [Overview](https://platform.claude.com/docs/en/managed-agents/overview)
  - [Agent setup](https://platform.claude.com/docs/zh-TW/managed-agents/agent-setup)
  - [Environments](https://platform.claude.com/docs/en/managed-agents/environments)
  - [Sessions](https://platform.claude.com/docs/fr/managed-agents/sessions)
  - [Events and streaming](https://platform.claude.com/docs/en/managed-agents/events-and-streaming)
  - [Tools](https://platform.claude.com/docs/en/managed-agents/tools)
  - [MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)
  - [Files](https://platform.claude.com/docs/es/managed-agents/files)
  - [Vaults](https://platform.claude.com/docs/en/managed-agents/vaults)
  - [Memory](https://platform.claude.com/docs/en/managed-agents/memory)
  - [Multiagent](https://platform.claude.com/docs/en/managed-agents/multi-agent)
  - [Outcomes](https://platform.claude.com/docs/zh-TW/managed-agents/define-outcomes)
  - [Observability](https://platform.claude.com/docs/en/managed-agents/observability)
  - [Migration](https://platform.claude.com/docs/en/managed-agents/migration)
- Source type: official engineering post and official platform documentation
- Checked: `2026-04-24`
- Research scope:
  - engineering post on `brain / hands / session`
  - Managed Agents overview
  - agent setup
  - environments
  - sessions
  - events and streaming
  - tools
  - files
  - vaults
  - memory
  - multiagent sessions
  - outcomes
  - observability
  - migration

## What This Source Is

Claude Managed Agents is Anthropic's managed agent harness for long-running autonomous work.

The platform documentation presents four product primitives:

| Primitive | Managed Agents meaning | autokairos reading |
| --- | --- | --- |
| `Agent` | reusable, versioned configuration for model, system prompt, tools, MCP servers, skills, and callable agents | `BrainSpec` or `AgentTeamSpec` |
| `Environment` | configured container template with packages, networking, and mounted resources | `HandsEnvironmentTemplate` |
| `Session` | running agent instance in an environment, with persistent conversation/event history | `BrainSession` / `PodSession` |
| `Events` | event stream between application and agent, including messages, tool requests, status, and spans | external trace/event log |

The engineering post provides the deeper architectural lesson:

**the brain, hands, and session must be decoupled.**

For autokairos this is more important than copying Anthropic's API shape. A trader system should
not be modeled as one magic container that owns everything. It should be modeled as a candidate
system whose brain, hands, and durable session truth can be replaced, inspected, and governed
independently.

## Core Thesis

- Harness assumptions go stale as model capability changes.
- Stable interfaces matter more than one fixed harness implementation.
- Agent execution should separate:
  - `brain`: model plus harness loop
  - `hands`: tools, sandboxes, containers, MCP servers, and external systems
  - `session`: durable event history outside the active model context
- Containers and sessions should be treated as cattle, not pets.
- Credentials should not be reachable from the sandbox where generated code runs.
- Resource injection should be explicit: files, memory stores, tools, MCP credentials, and session
  resources are distinct surfaces.
- Multiagent and outcomes are useful references, but they are research-preview features and should
  not become hard MLP dependencies.

## Official Mechanisms

### Agent

An `Agent` is a reusable, versioned configuration. It includes model, system prompt, tools, MCP
servers, skills, metadata, and optional callable agents.

autokairos should translate this into:

- `BrainSpec`
- `AgentTeamSpec`
- `HarnessProfile`

The important lesson is versioning. A trader-system candidate must be able to pin exactly which
brain configuration produced or ran it.

### Environment

An `Environment` is a container template. It can define packages, runtime dependencies, networking,
and mounted files. Multiple sessions can use the same environment, but each session gets its own
isolated container instance.

autokairos should translate this into:

- `HandsEnvironmentTemplate`
- `EnvironmentBinding`
- `StageBinding`

The important lesson is separation. Environment is not the candidate identity and not the session
truth.

### Session

A `Session` references an agent and an environment. It preserves event history and can be resumed or
interrupted through events.

autokairos should translate this into:

- `BrainSession`
- `PodSession`
- external `Trace`

The important lesson is that durable continuity must sit outside any one workspace, container, or
model context window.

### Events

Managed Agents communicates through events. The application sends user events and receives agent,
session, and span events. Custom tools and permission confirmations pause the session until the
client responds.

autokairos should translate this into:

- trace events
- tool proxy requests and responses
- operator approval events
- wake/intervention events

The important lesson is event externalization. The agent's self-report is not the durable record.

### Tools And Custom Tools

Managed Agents can expose built-in file, bash, search, fetch, MCP, and custom tools. Custom tools
are executed by the client application when the session emits a tool-use event.

autokairos should use this as the model for `ToolProxy`:

- the brain requests a capability
- the control plane or tool proxy executes it
- the result is returned as an event
- the request/result becomes traceable

This is especially important for trading. The agent should not hold raw exchange credentials or
direct execution authority.

### Files, Memory, And Vaults

Managed Agents distinguishes:

- files mounted into a session
- memory stores that persist across sessions and can be read/write or read-only
- vaults that store credentials outside the sandbox and inject access at session time

autokairos should translate these into the `CapabilityPackage` model:

- context files and skills are package artifacts
- secrets are not package artifacts
- credentials are stage/session bindings resolved through a vault or gateway
- read-only context should stay read-only to avoid prompt-injection poisoning

### Multiagent

Managed Agents supports coordinator-style multiagent sessions as research preview. Callable agents
share a container and filesystem but have isolated session threads and their own configurations.
Only one level of delegation is supported in the current documented model: a coordinator may call
configured agents, but those called agents do not recursively call further agents.

autokairos should translate this into:

- `AgentTeamSpec`
- `AgentRuntimeUnit`
- fixed small team configurations for MLP
- coordinator and specialist roles

autokairos should not require dynamic multi-level delegation in the first MLP.

The important boundary is that provider-native multiagent is not the same as independent execution
environments per agent. If autokairos needs independent agent endpoints, the stronger reference is
an A2A-compatible communication seam rather than Managed Agents' shared-container team model.

### Outcomes

Outcomes let a session work toward a rubric-scored deliverable. They use a separate evaluation
context and can iterate until a result is satisfied or max iterations are reached.

autokairos should treat outcomes as useful for artifact-quality checks, not as counted trading
evidence.

Trading evidence must remain owned by the autokairos evaluator because:

- trading metrics are domain-specific
- legitimacy mode matters
- agent self-improvement pressure creates reward-hacking risk
- promotion evidence must be external to the trader-system pod

## Transferable Lessons

- Define stable interfaces around the brain, hands, and session rather than binding product truth to
  one harness.
- Treat `Agent` configuration as versioned artifact input to a candidate system.
- Treat `Environment` as a reusable execution template, not as candidate identity.
- Treat `Session` event history as durable trace, not as model context.
- Put credentials behind vaults or tool proxies, never inside context/tool packages.
- Use mounted files and memory stores as a model for packageable context resources.
- Use custom tool events as the model for trading tool proxy calls.
- Use multiagent as a role-spec pattern, not a required first-release platform feature.
- Use outcomes only for qualitative artifact checks unless external trading evaluation validates the
  result.

## Non-Transferable Baggage

- Anthropic's hosted API shape is not the autokairos product model.
- Managed Agents beta behavior and research-preview features cannot be treated as stable MLP
  dependencies.
- Branding constraints mean autokairos should not present itself as Claude Code or Claude Cowork.
- Anthropic's managed environment does not replace autokairos-owned trading evaluation,
  promotion, live gateway, wake, or audit.

## autokairos Translation

The active autokairos model should be:

```text
TraderSystemCandidate
  -> references a TradingSystemImage
  -> references BrainSpec / AgentTeamSpec
  -> references CapabilityPackage artifacts
  -> runs as TradingSystemPod sessions under StageBinding
  -> produces Trace
  -> is judged by external EvidenceRecord
  -> can be promoted through PromotionDecision
```

The Managed Agents source updates the architecture in one important way:

**a `TradingSystemPod` is not simply an agent inside a container.**

It is a stage-bound execution instance assembled from:

- `TradingSystemImage`
- `CapabilityPackage`
- `StageBinding`
- `BrainSession`
- `HandsEnvironment`
- `ToolProxy`
- external trace/evidence sinks

## Open Questions / Tensions

- Which first harness adapter should be implemented first: Codex, Claude Managed Agents, Claude
  Code, or OpenClaw/ACP?
- How much of `BrainSession` should be stored locally versus delegated to the provider session?
- Which `CapabilityPackage` resources may be read-write, and which must be read-only?
- How much multiagent structure is necessary before it becomes overbuilt for MLP-01?
