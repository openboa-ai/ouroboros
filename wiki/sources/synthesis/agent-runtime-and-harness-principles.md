# Agent Runtime And Harness Principles

This page compares the runtime and harness ideas spread across Anthropic engineering notes, OpenAI
engineering notes, and reference runtime products.

## Sources Used

- [anthropic-2026-runtime-and-managed-agent-stack.md](../library/anthropic-2026-runtime-and-managed-agent-stack.md)
- [openai-2026-agent-codex-workspace-stack.md](../library/openai-2026-agent-codex-workspace-stack.md)
- [google-2026-agent-platform-and-protocols.md](../library/google-2026-agent-platform-and-protocols.md)
- [anthropic-managed-agents.md](../library/anthropic-managed-agents.md)
- [anthropic-claude-agent-sdk.md](../library/anthropic-claude-agent-sdk.md)
- [google-agent2agent-a2a.md](../library/google-agent2agent-a2a.md)
- [google-agent-development-kit.md](../library/google-agent-development-kit.md)
- [anthropic-effective-harnesses-for-long-running-agents.md](../library/anthropic-effective-harnesses-for-long-running-agents.md)
- [anthropic-building-effective-agents.md](../library/anthropic-building-effective-agents.md)
- [openai-next-evolution-of-the-agents-sdk.md](../library/openai-next-evolution-of-the-agents-sdk.md)
- [openai-agents-sdk-and-sandbox.md](../library/openai-agents-sdk-and-sandbox.md)
- [openai-harness-engineering.md](../library/openai-harness-engineering.md)
- [phil-schmid-why-engineers-struggle-building-agents.md](../library/phil-schmid-why-engineers-struggle-building-agents.md)
- [model-context-protocol.md](../library/model-context-protocol.md)
- [agent-client-protocol.md](../library/agent-client-protocol.md)
- [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md)
- [repo-openai-codex.md](../library/repo-openai-codex.md)
- [repo-openclaw.md](../library/repo-openclaw.md)

## Post-URL-Ingestion Design Rules

The URL-level notes for OpenAI rows 22-38 and Google rows 39-50 strengthen these active rules:

| Source pressure | autokairos design rule |
| --- | --- |
| OpenAI Agents SDK, sandboxes, tools, guardrails, observability, and evals | provider execution, sandbox compute, trace, guardrail, review, and eval boundaries must remain separate |
| OpenAI shell/computer-use/tools docs | tool availability is not authority; every side-effecting surface still needs `ToolProxy`, permission, trace, and stage binding |
| OpenAI reasoning/compaction/token docs | model choice, context pressure, and compaction are runtime/provider concerns, not product truth |
| Google Agent Runtime | `RuntimePlacement` is replaceable execution infrastructure, not the durable runtime object |
| Google Memory Bank | memory-like context must become scoped `RuntimeMemorySurface`, not evidence or hidden provider truth |
| Google Agent Gateway / Identity / Registry / Observability / Evaluation | gateway, identity, registry, trace, and evaluation are separate control surfaces |
| Google ADK | `Agent / Runner / Session / Event / Artifact / Tool` is useful vocabulary, not a mandate to build a graph-first architecture |
| Google A2A | remote agent communication is agent-to-agent task/message/artifact exchange, not tool access, evidence, or live authority |
| ACP/OpenClaw | external coding harnesses are callable provider surfaces, not autokairos control-plane replacements |
| OpenAI tools/skills/MCP and Anthropic Skills | capability declarations are not authority; access must be admitted, granted, mounted, traced, and mediated |

The resulting active autokairos boundary is:

```text
TraderSystemRuntime
-> RuntimePlacement
-> AgentSession
-> RuntimeProviderAdapter
-> external provider / harness
-> AgentRun
-> AgentEvent
-> Trace
```

Everything after `AgentEvent` is raw runtime history until autokairos evaluation, materialization,
gateway, or audit boundaries accept it.

Capability injection follows the same principle:

```text
CapabilityPackage
-> CapabilityManifest
-> CapabilityPackageAdmissionRecord
-> CapabilityGrant
-> CapabilityMountRecord
-> Trace
```

A package may describe tools, skills, context, and data access. It does not grant its own
permissions, carry secrets, expose evaluator ground truth, or bypass `ToolProxy` / gateway policy.

## Reference Impact Audit 2026-04 Result

[reference-impact-audit-2026-04.md](reference-impact-audit-2026-04.md) rechecked rows 1-51 and
reinforced the current provider-backed runtime model. The audit did not find a reason to replace
`TraderSystemRuntime`, `RuntimePlacement`, `AgentSession`, `AgentRun`, `AgentEvent`, or `Trace`.

The audit does require future boundary hardening before implementation depends on these areas:

- `RuntimeMemorySurface` needs trust classes, read/write posture, influence tracing, poisoning
  review, and rollback rules.
- provider labels such as Codex, Claude, ADK, A2A, ACP, or local process need concrete invocation,
  auth/model/tool access, schema/output, timeout, and trace-export probes before being treated as
  executable.
- framework references such as ADK and AgentKit remain provider/framework options, not mandates for
  graph-first orchestration or product-platform scope.

## Comparison Table

| Source | What the core system is | Where durable truth lives | Where autonomy lives | Where governance lives |
| --- | --- | --- | --- | --- |
| [Anthropic 2026 runtime stack](../library/anthropic-2026-runtime-and-managed-agent-stack.md) | Managed-agent, long-running harness, memory, skills, auto-mode, and autonomy-measurement cluster | Session/events, files/memory/vault resources, handoff artifacts, and measurement records outside one harness | Provider-backed brain plus hands environment | Environment, vault, skill, event, permission, and autonomy-measurement boundaries |
| [OpenAI 2026 agent stack](../library/openai-2026-agent-codex-workspace-stack.md) | Workspace Agents, Codex, AgentKit, Agents SDK, sandbox, tools, guardrails, evals, and observability cluster | Workspace/thread memory, sessions, traces, sandbox/run metadata, eval records, and review surfaces | Agent runs over tools/sandboxes through provider surfaces | Guardrails, approvals, traces, evals, sandbox/tool permissions, and admin/review controls |
| [Google 2026 platform/protocol stack](../library/google-2026-agent-platform-and-protocols.md) | Enterprise agent platform, ADK, A2A, runtime, memory bank, Jules, and Cloud Assist cluster | Platform runtime, memory bank, task/message/artifact records, observability/evaluation records | Platform-managed agents and A2A-connected independent agents | Agent gateway, identity, registry, observability, evaluation, and protocol policy |
| [Managed Agents](../library/anthropic-managed-agents.md) | A hosted agent system split into brain, hands, and session | Session service outside the harness container | The agent brain plus harness loop | Session interface, harness boundary, credential isolation |
| [Claude Agent SDK](../library/anthropic-claude-agent-sdk.md) | An embeddable Claude Code-style agent loop | SDK session and streamed events | Claude agent loop plus SDK tools | Scoped tools, MCP loading, session IDs, context compaction |
| [Google A2A](../library/google-agent2agent-a2a.md) | An interoperability protocol between independent agent systems | Task/message/artifact records outside either agent's hidden state | The participating remote agents | Agent card, task boundary, auth, communication policy |
| [Google ADK](../library/google-agent-development-kit.md) | A framework with Agent, Runner, Session, Event, Artifact, and Tool concepts | Session/artifact services and event records | Runner-invoked agent loops | Runner boundary, session state lifecycle, artifact services |
| [Effective Harnesses For Long-Running Agents](../library/anthropic-effective-harnesses-for-long-running-agents.md) | A harness workflow that keeps fresh sessions productive over long tasks | Progress files and setup artifacts in the workspace | The coding agent operating inside a prepared task environment | Harness setup, initializer flow, verification loop |
| [Building Effective Agents](../library/anthropic-building-effective-agents.md) | A spectrum from workflows to agents | Mostly the surrounding application and tool outputs | The model where paths are open-ended | Code-defined workflows and tool design |
| [Next Evolution Of The Agents SDK](../library/openai-next-evolution-of-the-agents-sdk.md) | A model-native harness plus native compute platform | Snapshots, manifests, and external runtime state | The model-native harness | Harness/compute separation, manifests, resumability surfaces |
| [OpenAI Agents SDK / SandboxAgent](../library/openai-agents-sdk-and-sandbox.md) | A programmable agent harness with Runner, RunConfig, Session, Trace, and SandboxAgent | Sessions, traces, sandbox manifest, and run metadata | Runner-invoked agent runs | RunConfig, trace, sandbox capability, approval/guardrail surfaces |
| [Harness Engineering](../library/openai-harness-engineering.md) | A human-steered engineering system around an agent | Repository docs, AGENTS files, and system-of-record docs | The agent working inside the repository map | Humans, repo docs, and repeated cleanup loops |
| [Why Engineers Struggle Building Agents](../library/phil-schmid-why-engineers-struggle-building-agents.md) | Agent-engineering guidance against over-deterministic route design | Semantic context and trace outside a narrow enum route | The model navigating ambiguous context | Evals, trace, and explicit safety boundaries |
| [MCP](../library/model-context-protocol.md) | Tool/resource/prompt protocol | Tool/resource/prompt definitions and call records | Model-chosen tool use through a client/server boundary | Capability negotiation, permissioning, user-controlled prompts |
| [ACP](../library/agent-client-protocol.md) | Client-to-coding-agent bridge | Client/session records and streamed harness output | External coding harness | Replaceable harness adapter, not product truth |
| [Claude Code repo](../library/repo-anthropics-claude-code.md) | A coding harness product with plugin surfaces | Project files, settings, and session behavior outside any single prompt | The interactive coding agent | Plugin/config surfaces and external user control |
| [Codex repo](../library/repo-openai-codex.md) | A local coding agent CLI and runtime | Local project files, AGENTS layering, sandbox and approval state | The Codex agent loop | Sandbox mode, approval mode, AGENTS layering |
| [OpenClaw repo](../library/repo-openclaw.md) | An always-on assistant product around a long-lived Gateway | Gateway-owned sessions and runtime state | The embedded runtime plus ACP-connected tools | Gateway, session ownership, workspace bootstrap rules |

## Shared Principles

### The harness is not the whole system

The strongest common thread is that the harness should not be mistaken for the whole product.
[Managed Agents](../library/anthropic-managed-agents.md) separates `brain`, `hands`, and
`session`. [Next Evolution Of The Agents SDK](../library/openai-next-evolution-of-the-agents-sdk.md)
separates harness from compute. [OpenClaw](../library/repo-openclaw.md) separates its Gateway from
the agent runtime. [Harness Engineering](../library/openai-harness-engineering.md) pushes the same
idea indirectly by treating repository docs and human steering as part of the real system.

Across these sources, the harness is the execution loop, not the full source of truth.

The 2026 product stacks make the same point at larger scale. Anthropic exposes managed
Agent/Environment/Session/Event concepts, OpenAI exposes agents, runs, sandboxes, traces, guardrails,
and evals, and Google exposes runtime, memory, gateway, observability, evaluation, ADK, and A2A
surfaces. The shared lesson is that `provider_kind` is only an invocation surface. It does not own
candidate truth, evidence, promotion, trading authority, or audit.

### Executable program freedom belongs inside sandbox boundaries

Managed Agents and OpenAI's sandbox direction both support the same autokairos rule:

- the model/harness can author or run code
- the sandbox/compute environment can execute that code
- the durable session/event log stays outside that compute environment
- credentials and privileged authority stay outside generated-code reach

For autokairos, this means `TraderSystemProgram` should be open-ended agent-authored executable
behavior, not a human-authored strategy DSL. The restriction should be at the boundary:
`OrderIntent`, `ProgramEvent`, trace/artifacts, review requests, and gateway-mediated side effects.

That freedom still needs artifact identity. The active autokairos translation is:

```text
TraderSystemSpec
-> TraderSystemProgram
-> ProgramManifest
-> ProgramValidationRecord
-> ProgramEvent / Trace
```

The spec defines the trader-system artifact. The program is the executable behavior bundle. The
manifest declares entrypoint, runtime kind, artifacts, output contract, sandbox requirement, and
required grants. The validation record decides whether the program is safe enough to mount or
execute. None of these records are evidence, promotion, credentials, or live authority.

### Observation is the control surface

The control plane should not decide every internal runtime step. That would turn autokairos into a
workflow engine and collapse the agent-driven premise.

Managed Agents points to a better boundary: let the agent/session/environment work internally, but
externalize events, tool calls, span/status events, file/artifact exports, errors, and session
state. For autokairos this means `TraderSystemRuntime` owns internal autonomy, while autokairos owns:

- injected input surfaces
- event and trace export
- tool-proxy and gateway mediation
- runtime lifecycle control and intervention records
- external evaluation and promotion records
- audit reconstruction after restart

The product should know what happened inside the runtime well enough to inspect, debug, recover, and
evaluate it. It should not need to pre-script the runtime's internal reasoning path.

OpenAI observability/evals docs, Anthropic events/session docs, and Google ADK/A2A event/artifact
models all reinforce the same rule: the safest control plane observes runs through structured events,
traces, artifacts, evals, and review records rather than trying to convert agent reasoning into a
static workflow graph.

### Runtime control beats event dispatch

[Why Engineers Struggle Building Agents](../library/phil-schmid-why-engineers-struggle-building-agents.md)
adds a useful warning: agent systems become weaker when engineers flatten rich intent and context
into narrow booleans, enums, and route handlers.

For autokairos, this warning now applies inside the trader-system boundary, not as a control-plane
activation API.

The active boundary should be:

```text
RuntimeControl controls lifecycle.
TraderSystemProgram owns internal trading behavior.
```

The runtime can preserve rich semantic context internally and decide whether to call a
provider-backed agent, run a script, request a tool, emit an `OrderIntent`, ask for review, or do
nothing. The control plane should not flatten that into event handlers.

Deterministic structure still belongs at the safety boundary: credential access, tool proxy,
trading gateway, evaluator, trace persistence, and audit.

### Agent-to-agent communication is not tool access

[Google A2A](../library/google-agent2agent-a2a.md) adds a missing distinction for multi-agent
systems. It treats a remote agent as an independent, often opaque participant with its own
capabilities, task lifecycle, messages, and artifacts. The A2A/MCP comparison is the cleanest
boundary: MCP-style protocols are for tools and resources; A2A-style protocols are for agents.

For autokairos, that means:

- a market-data lookup, backtest run, or exchange gateway request is a tool-proxy concern
- a researcher agent, evaluator agent, risk reviewer agent, or external trader-system runtime is an
  agent-communication concern
- A2A task results and artifacts are trace inputs unless the autokairos evaluator later seals them
  as counted evidence

### Durable truth should survive the current run

[Managed Agents](../library/anthropic-managed-agents.md) is explicit that session history should
live outside the harness container. [Next Evolution Of The Agents SDK](../library/openai-next-evolution-of-the-agents-sdk.md)
adds snapshots and manifests so the system can resume without trusting ephemeral process memory.
[Harness Engineering](../library/openai-harness-engineering.md) treats repository docs as the
system of record that outlives one run. [OpenClaw](../library/repo-openclaw.md) puts session
ownership in the Gateway, not inside a transient tool loop.

The shared pattern is durable state outside the currently running agent process.

For autokairos this becomes a hard split:

```text
TraderSystemRuntime = logical runtime boundary
RuntimePlacement = replaceable physical process/container/provider/endpoint placement
Trace = durable recoverable session/event log
```

The runtime can be autonomous internally, but recovery cannot depend on private container memory or a
provider session that happens to still be alive. The connector should reattach, recreate, stop for
review, or abandon from trace and control-plane records.

### Workspace shape matters, but workspace is still a boundary object

[Effective Harnesses For Long-Running Agents](../library/anthropic-effective-harnesses-for-long-running-agents.md)
shows how much performance depends on prepared workspace artifacts such as `init.sh`,
`claude-progress.txt`, and `feature_list.json`. [Codex](../library/repo-openai-codex.md) and
[Harness Engineering](../library/openai-harness-engineering.md) emphasize `AGENTS.md` and repo
docs. [Claude Code](../library/repo-anthropics-claude-code.md) exposes plugins, commands, hooks,
skills, and MCP as ways to shape the work surface. [OpenClaw](../library/repo-openclaw.md) adds
ACP and bootstrap documentation.

The workspace is therefore not just a filesystem path. It is the curated surface through which the
agent understands the task. But these sources still avoid treating the workspace as the ultimate
system of truth.

### Governance is usually outside the model loop

[Building Effective Agents](../library/anthropic-building-effective-agents.md) argues that
predictable logic should stay in workflows. [Codex](../library/repo-openai-codex.md) expresses
governance through sandbox and approval modes. [Managed Agents](../library/anthropic-managed-agents.md)
uses infrastructure boundaries and credential isolation. [OpenAI's Agents SDK evolution](../library/openai-next-evolution-of-the-agents-sdk.md)
adds manifests and compute boundaries. [OpenClaw](../library/repo-openclaw.md) centralizes control
in the Gateway.

The common posture is not "trust the model to govern itself." It is "let the model act inside a
surface whose risk boundaries are already decided elsewhere."

For autokairos, those risk boundaries are not optional implementation details. Provider-backed
agents may reason, write programs, call tools, and emit proposed actions, but live side effects still
cross the autokairos `ToolProxy` or `TradingGateway`, and evaluation truth still crosses an external
evaluator before it becomes counted evidence.

## Important Differences

### Anthropic emphasizes session and infrastructure separation

[Managed Agents](../library/anthropic-managed-agents.md) is the clearest statement that session,
harness, and sandbox should be separate concerns. [Effective Harnesses For Long-Running Agents](../library/anthropic-effective-harnesses-for-long-running-agents.md)
then shows a more tactical, repository-facing version of the same concern.

### OpenAI emphasizes model-native harnesses and repository maps

[Next Evolution Of The Agents SDK](../library/openai-next-evolution-of-the-agents-sdk.md) leans
hard into model-native harnesses, native compute, manifests, and resumability. [Harness
Engineering](../library/openai-harness-engineering.md) is more grounded in coding practice:
`AGENTS.md` as map, docs as system of record, humans steering while the agent executes.

### Product repos expose different operating surfaces

[Claude Code](../library/repo-anthropics-claude-code.md) is a plugin-rich coding harness.
[Codex](../library/repo-openai-codex.md) is a coding agent CLI with explicit local control
surfaces. [OpenClaw](../library/repo-openclaw.md) is closer to an always-on assistant platform with
its own long-lived Gateway and ACP bridges.

They all speak to harness design, but they do not represent the same product posture.

## Vocabulary Comparison

## Reference-Grounded autokairos Naming

autokairos should not invent a blended term for configured agent, session, invocation, provider, and
purpose. The cross-reference pattern is stable enough to lock this vocabulary:

| autokairos term | Reference grounding | Boundary rule |
| --- | --- | --- |
| `AgentSpec` | OpenAI `Agent`, Claude Managed Agents `Agent`, Claude Agent SDK agent definition, Google ADK `Agent` | configured behavior only; no live run |
| `AgentSession` | Claude Managed Agents `Session`, OpenAI session/conversation continuity, Google ADK `Session` | provider/session continuity only; no durable product truth |
| `AgentRun` | OpenAI `Runner.run`, Google ADK Runner invocation, Claude Agent SDK query/turn, Codex CLI exec, A2A task call | one invocation attempt with purpose, input, output, status, and failure |
| `AgentEvent` | Claude Events, Google ADK Events, OpenAI trace/span stream, Codex events, A2A task/status/artifact updates | raw provider/runtime event; not counted evidence |
| `TraderSystemSpec` | OpenAI Manifest is only a partial analogy; Claude Agent/Environment separation is another | versioned trader-system definition; not Docker image |
| `TraderSystemProgram` | Managed Agents hands, OpenAI sandbox, Codex artifacts, Google ADK artifacts | agent-authored executable behavior; not a human DSL or live authority |
| `ProgramManifest` | OpenAI manifest/artifact posture and long-running harness setup artifacts | declares program entrypoint/runtime/output/sandbox needs; grants nothing |
| `ProgramValidationRecord` | sandbox/guardrail/permission posture across OpenAI, Anthropic, and Google docs | records whether program is safe enough to mount or execute; not promotion |
| `TraderSystemRuntime` | Kubernetes-like mental model plus Managed Agents brain/hands/session split | stage-bound runtime composite; may use containers but is not a container |
| `RuntimePlacement` | Managed Agents `Environment` / session placement and OpenAI sandbox/compute placement | physical execution mapping; replaceable and recoverable from trace |
| `CapabilityManifest` | OpenAI Manifest/Capability and MCP capability declarations | declares requested capabilities; grants nothing by itself |
| `CapabilityPackageAdmissionRecord` | OpenAI/Anthropic tool and skill permission postures plus package/sandbox validation | records whether package content is safe enough to consider |
| `CapabilityGrant` | ToolProxy, stage binding, vault, and gateway policy boundary | records actual granted access; package declarations grant nothing |
| `CapabilityMountRecord` | sandbox/container/managed environment resource injection | records what package content reached one placement and hands environment |

This naming is intentionally reference-grounded but provider-neutral.

The key rule is:

```text
provider_kind lives on AgentSession
AgentRun.purpose lives on AgentRun
product truth lives outside both
```

| Concept | Anthropic engineering | OpenAI engineering | Codex / Claude Code | OpenClaw |
| --- | --- | --- | --- | --- |
| core loop | `harness` in [anthropic-managed-agents.md](../library/anthropic-managed-agents.md) and [anthropic-effective-harnesses-for-long-running-agents.md](../library/anthropic-effective-harnesses-for-long-running-agents.md) | `harness` and `model-native harness` in [openai-next-evolution-of-the-agents-sdk.md](../library/openai-next-evolution-of-the-agents-sdk.md) and repo-legibility framing in [openai-harness-engineering.md](../library/openai-harness-engineering.md) | `coding agent`, `CLI`, `plugin` surfaces in [repo-openai-codex.md](../library/repo-openai-codex.md) and [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md) | `embedded runtime` plus ACP in [repo-openclaw.md](../library/repo-openclaw.md) |
| durable truth | `session` | `Manifest`, snapshots, repo docs as system of record | repo files, `AGENTS.md`, config, local state | `Gateway` plus gateway-owned sessions |
| execution boundary | `sandbox` | `sandbox` / `compute` | `sandbox` policies, local execution modes | `Gateway` vs native runtime vs ACP session |
| workspace surface | progress artifacts, feature lists, setup scripts | manifest-described workspace, `AGENTS.md`, skills | repo guidance, plugin surfaces, local project files | bound chat/thread session plus runtime workspace |
| governance term | workflow constraints, credential isolation | harness/compute split, invariants, merge philosophy | approval mode, sandbox mode, user config | gateway ownership, pairing, session routing |

| Concept | Google A2A |
| --- | --- |
| core loop | client agent delegates work to remote agent through task/message protocol |
| durable truth | task, message, artifact, and status records outside either agent's hidden runtime |
| execution boundary | remote agent endpoint with its own runtime and tools |
| workspace surface | agent card, supported interfaces, skills, task artifacts |
| governance term | communication policy, auth, task lifecycle, status updates |

The main terminology warning is that the same word does not always indicate the same layer.
`Harness` in the Anthropic/OpenAI essays is an execution-loop concept. In the product repos,
similar responsibilities are sometimes spread across `CLI`, `plugin`, `Gateway`, `runtime`, or
`session` surfaces instead.

## Source Classification

- Runtime and harness theory:
  [anthropic-managed-agents.md](../library/anthropic-managed-agents.md),
  [anthropic-effective-harnesses-for-long-running-agents.md](../library/anthropic-effective-harnesses-for-long-running-agents.md),
  [openai-next-evolution-of-the-agents-sdk.md](../library/openai-next-evolution-of-the-agents-sdk.md),
  [openai-harness-engineering.md](../library/openai-harness-engineering.md)
- Workflow-vs-agent constraint:
  [anthropic-building-effective-agents.md](../library/anthropic-building-effective-agents.md)
- Concrete runtime products:
  [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md),
  [repo-openai-codex.md](../library/repo-openai-codex.md),
  [repo-openclaw.md](../library/repo-openclaw.md)
- Agent communication / interoperability:
  [google-agent2agent-a2a.md](../library/google-agent2agent-a2a.md)

## Tensions To Preserve

- How much truth should live in repository files versus an external session service?
- How much of the harness should be model-native versus code-defined workflow?
- How much workspace preparation is a reusable runtime concern versus product-specific scaffolding?
- Which systems are truly runtime references, and which are partly control-plane products wearing a
  runtime face?
- When should a multi-agent trader system use provider-native subagent threads versus
  A2A-compatible independent endpoints?
