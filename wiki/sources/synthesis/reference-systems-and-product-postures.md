# Reference Systems And Product Postures

This page compares the main reference repositories as products, not just as codebases. The goal is
to avoid flattening very different systems into one vague idea of an "agent platform."

For autokairos, this page is secondary to the W2S/AAR synthesis. It exists to inform runtime and
orchestration posture, not to redefine the product thesis.

## Sources Used

- [anthropic-2026-runtime-and-managed-agent-stack.md](../library/anthropic-2026-runtime-and-managed-agent-stack.md)
- [openai-2026-agent-codex-workspace-stack.md](../library/openai-2026-agent-codex-workspace-stack.md)
- [google-2026-agent-platform-and-protocols.md](../library/google-2026-agent-platform-and-protocols.md)
- [051-anthropic-project-deal.md](../library/url-notes/051-anthropic-project-deal.md)
- [anthropic-managed-agents.md](../library/anthropic-managed-agents.md)
- [anthropic-claude-agent-sdk.md](../library/anthropic-claude-agent-sdk.md)
- [openai-agents-sdk-and-sandbox.md](../library/openai-agents-sdk-and-sandbox.md)
- [google-agent-development-kit.md](../library/google-agent-development-kit.md)
- [google-agent2agent-a2a.md](../library/google-agent2agent-a2a.md)
- [model-context-protocol.md](../library/model-context-protocol.md)
- [agent-client-protocol.md](../library/agent-client-protocol.md)
- [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md)
- [repo-openai-codex.md](../library/repo-openai-codex.md)
- [repo-openclaw.md](../library/repo-openclaw.md)
- [repo-multica.md](../library/repo-multica.md)
- [repo-paperclip.md](../library/repo-paperclip.md)

## Post-URL-Ingestion Product-Posture Rules

The URL-level notes make one product rule stricter: platform breadth is not product truth.

| Reference family | What transfers | What must not transfer |
| --- | --- | --- |
| Anthropic Managed Agents / Claude Cowork / Project Deal | long-running session, memory, skills, delegated work, human representation, objective-vs-subjective outcome gaps | hosted cowork UX or marketplace shape as autokairos product truth |
| OpenAI Workspace Agents / Codex / AgentKit / Agents SDK | background work, review surfaces, sandbox/tool/trace/eval/guardrail boundaries, provider-backed coding execution | Codex app UX, generic software-agent platform, or provider-owned truth |
| Google Gemini Enterprise / Agent Runtime / Memory Bank / ADK / A2A / Jules / Cloud Assist | runtime/memory/gateway/identity/registry/observability/evaluation/protocol decomposition | enterprise fleet platform scope, graph-first framework mandate, or A2A as authority |

autokairos should stay a trading-system control plane:

- external systems supply execution capability, communication, memory patterns, and platform
  decomposition lessons
- autokairos owns candidate truth, evaluation truth, promotion, trading gateway authority,
  runtime lifecycle control, and audit

## Reference Impact Audit 2026-04 Result

[reference-impact-audit-2026-04.md](reference-impact-audit-2026-04.md) reinforces that the broad
reference systems should not redefine the product category.

The audit explicitly rejects these drifts:

- autokairos as a generic enterprise agent platform.
- autokairos as a Codex app, Claude Cowork, Workspace Agents, Jules, or Cloud Assist clone.
- A2A mesh, ADK graph orchestration, AgentKit breadth, or Gemini Enterprise fleet management as
  first-MLP scope.
- provider memory, provider review queues, or provider eval outputs as autokairos product truth.

The product posture stays: a trading-system control plane for weak-to-strong candidate creation,
external evaluation, promotion, live gateway authority, runtime lifecycle control, and audit.

## Comparison Table

| Source | Product posture | What the core system is | Where durable truth lives | Where autonomy lives | Where governance lives | Best used as a reference for |
| --- | --- | --- | --- | --- | --- | --- |
| [Anthropic 2026 runtime stack](../library/anthropic-2026-runtime-and-managed-agent-stack.md) | Hosted long-running agent and cowork/product ecosystem | Managed agents, sessions, memory, skills, auto mode, long-running app harnesses, and autonomy measurement | Session/events, files, memory, handoff artifacts, and measurement records | Claude-backed brain plus hands environment | environment, vault, skills, event/session, permission, and measurement boundaries | brain/hands/session, memory/skills packaging, autonomy measurement |
| [OpenAI 2026 agent stack](../library/openai-2026-agent-codex-workspace-stack.md) | Workspace-agent, Codex, AgentKit, and Agents SDK ecosystem | Codex/workspace agents plus developer/runtime docs for sandboxes, runs, guardrails, observability, evals, tools, and skills | workspace threads, memory, sessions, traces, run metadata, eval/review records | Codex/agent runs through tools and sandboxes | guardrails, approvals, sandbox/tool policy, observability, admin/review controls | provider adapter feasibility, sandbox/tool posture, trace/eval/review posture |
| [Google 2026 platform/protocol stack](../library/google-2026-agent-platform-and-protocols.md) | Enterprise agent platform and protocol ecosystem | Gemini Enterprise Agent Platform, ADK, A2A, memory bank, Jules, Cloud Assist | platform runtime records, memory bank, task/message/artifact records, observability/evaluation records | platform-managed and A2A-connected agents | agent gateway, identity, registry, observability, evaluation, protocol policy | platform boundary decomposition and A2A/MCP separation |
| [Project Deal](../library/url-notes/051-anthropic-project-deal.md) | Agent-mediated marketplace experiment | Custom agents representing human preferences in real negotiations | experimental run logs, transactions, surveys, and analysis outside one agent | autonomous negotiation by AI representatives | experiment setup, post-run evaluation, disclosure, and real-world exchange | agent-to-agent commerce, model-quality advantage, subjective/objective outcome gap |
| [Claude Managed Agents](../library/anthropic-managed-agents.md) | Hosted meta-harness interface | Versioned agent definition, environment, session event stream, files, memory, vaults, tools | External session/event service and resources outside a single hands environment | Brain session plus harness loop | Environment, vault, tool permission, event, and session boundaries | Brain/hands/session split, resource injection, vault-backed auth, and tool proxy posture |
| [OpenAI Agents SDK / SandboxAgent](../library/openai-agents-sdk-and-sandbox.md) | Programmable harness and sandbox interface | Agent, Runner, RunConfig, Session, Trace, SandboxAgent, Manifest, Capability | Sessions, traces, run metadata, manifests | Runner-invoked agent runs | RunConfig, guardrails, tracing, sandbox capability limits | `AgentSpec` / `AgentRun` / `AgentSession` split and sandbox capability posture |
| [Claude Agent SDK](../library/anthropic-claude-agent-sdk.md) | Embeddable Claude Code-style harness | Agent loop, SDK session, streamed result, tools, MCP, subagents | SDK session and streamed events | Claude agent loop plus SDK tools | Scoped tools, MCP loading, compaction, session continuity | Agent-loop feasibility and context pressure boundaries |
| [Google ADK](../library/google-agent-development-kit.md) | Agent framework | Agent, Runner, Session, State, Event, Artifact, Tool | Session/artifact services and events | Runner-invoked agent loops | Runner boundary and session-state lifecycle | Event/artifact/session naming reference |
| [Google A2A](../library/google-agent2agent-a2a.md) | Agent interoperability protocol | Agent cards, task lifecycle, messages, artifacts, streaming and push updates | Task/message/artifact records outside either participant's hidden state | Independent participating agents | Communication policy, auth, task boundary, capability discovery | Agent-to-agent communication seam between independent runtimes |
| [MCP](../library/model-context-protocol.md) | Tool/resource/prompt protocol | Tools, resources, prompts, elicitation, sampling, capability negotiation | Client/server call records and resource/prompt definitions | Model-selected tool/resource interaction | Permission, schema, and user-control boundary | Tool/resource/prompt access, not agent communication |
| [ACP](../library/agent-client-protocol.md) | Client-to-coding-harness bridge | External coding harness sessions and streamed outputs | Client/session records and harness output | External coding harness | Client/session routing | Replaceable Codex/Claude/OpenClaw harness adapter seam |
| [Claude Code](../library/repo-anthropics-claude-code.md) | Interactive coding harness product | Terminal coding agent plus plugin surfaces | Project files, config, and external session context | The coding agent loop | User controls, plugins, project config | Harness UX and extension surfaces |
| [Codex](../library/repo-openai-codex.md) | Local coding agent runtime plus background-work product | Agent loop plus local sandbox/approval controls, threads, automations, and review queue | Repository docs, AGENTS layering, local runtime state, app threads, memory | The Codex execution loop plus background automations | Approval mode, sandbox mode, review queue, repo guidance | Local runtime behavior plus proactive background-work posture |
| [OpenClaw](../library/repo-openclaw.md) | Always-on assistant platform | Gateway, embedded runtime, ACP-connected tools, heartbeat/cron/standing-order operations | Gateway-owned session and runtime state | Embedded assistant runtime | Gateway, standing orders, and automation surfaces | Persistent assistant posture plus proactive orchestration vocabulary |
| [Multica](../library/repo-multica.md) | Managed-agents platform | Daemon, runtime registry, agent profiles, task lifecycle, autopilot surfaces | Runtime state, agent/task records, workspace dirs, daemon/runtime records | Managed agents executed through daemon and runtimes | Platform-level management, task orchestration, runtime liveness | Control-plane, runtime inventory, daemon bridge, and recurring work above task execution |
| [Paperclip](../library/repo-paperclip.md) | Governance-heavy agent company/control plane | Persistent agents pursuing company goals under control surfaces and scheduled/event operations | Goal ancestry, budgets, approvals, audit, rollback | Agents operating across goals and heartbeats | Human approvals, budgets, rollback, company policy | Promotion, governance, and persistent supervision |

## Core Distinctions

### Source-role boundary for autokairos

This page should be read under one explicit boundary:

- `OpenAI Agents SDK`, `Claude Managed Agents`, `Claude Agent SDK`, `Google ADK`, `Google A2A`,
  `MCP`, `ACP`, `Codex`, `Claude Code`, `OpenClaw`, and `Multica` are
  runtime/orchestration references
- they can inform harness shape, brain/hands/session boundaries, session posture, resource
  injection, agent-to-agent communication, background work, and operator re-entry
- they should not redefine:
  the weak-supervision thesis, evaluation bottleneck, legitimacy boundary, or promotion meaning

Those core product constraints come from the W2S/AAR source cluster instead.

The 2026 cluster notes strengthen that boundary. Anthropic, OpenAI, and Google each expose broad
agent-platform/product surfaces, but their breadth should not drag autokairos into platform
cloning. They are reference systems for interface seams, provider execution, sandbox/tool posture,
memory/session shape, observability, evals, and product re-entry. They are not substitutes for the
autokairos trading evidence, promotion, gateway, or audit model.

### Claude Managed Agents is the strongest interface reference

[Claude Managed Agents](../library/anthropic-managed-agents.md) is the strongest source for the
interface shape around long-running agents: a versioned agent definition, an environment template, a
session/event stream, resource injection, custom tool events, memory/files, and vault-backed
credentials. For autokairos, it should shape the `TraderSystemRuntime` mental model but not force
Claude Managed Agents to be the only runtime provider.

### Google A2A is the strongest communication reference

[Google A2A](../library/google-agent2agent-a2a.md) is the strongest source for communication
between independent agent systems. It should shape the seam between distributed trader-system runtimes,
external specialist agents, and remote evaluator/risk-review agents.

It should not replace the autokairos evaluator, gateway, or audit log. A2A task results and
artifacts are communication outputs until autokairos records them as trace artifacts or seals them
through an external evaluator.

The Google 2026 platform cluster adds an important enterprise-platform warning: registry, identity,
gateway, observability, memory, and evaluation are separate layers. autokairos should borrow that
layering discipline without adopting the full enterprise fleet scope before the trader-system
runtime proof exists.

### MCP and ACP are different boundaries

[MCP](../library/model-context-protocol.md) is the tool/resource/prompt access boundary. It should
shape `CapabilityPackage`, `CapabilityManifest`, and `ToolProxy`, but it is not a multi-agent
communication protocol and does not grant live trading authority.

[ACP](../library/agent-client-protocol.md) is a client-to-coding-harness bridge. It can help
autokairos invoke Codex, Claude Code, OpenClaw, Gemini CLI, or similar external harnesses, but ACP
output still enters autokairos only as `AgentEvent` / `Trace` until materialization or evaluation
accepts it.

### Codex and Claude Code are closest to harness/runtime product references

[Claude Code](../library/repo-anthropics-claude-code.md) and
[Codex](../library/repo-openai-codex.md) are the cleanest references for repository-facing coding
agent behavior. They expose instructions, config, approval, skills/plugins, and project guidance
surfaces close to the developer workflow.

They are less useful as examples of a full multi-agent control plane.

### OpenClaw sits between runtime product and assistant platform

[OpenClaw](../library/repo-openclaw.md) is not just a thin harness. It has a strong product view:
Gateway ownership, long-lived sessions, always-on assistant posture, ACP integration, and bootstrap
rules. It can still inform runtime design, but it already carries more product-management posture
than Codex or Claude Code.

### Multica and Paperclip are closer to management layers than raw runtimes

[Multica](../library/repo-multica.md) emphasizes agent records, runtime registries, daemon-based
execution, external task progress, and workspace skill distribution. [Paperclip](../library/repo-paperclip.md) emphasizes
budgets, approvals, goal ancestry, heartbeats, and rollback. Both are useful, but neither should
be mistaken for a simple runtime harness reference.

They are strongest as control-plane references.

## Durable Truth By Product Posture

- Hosted meta-harness interface:
  [Claude Managed Agents](../library/anthropic-managed-agents.md)
  centers durable truth in session events and attached resources outside one hands environment.
- Harness/runtime products:
  [Claude Code](../library/repo-anthropics-claude-code.md),
  [Codex](../library/repo-openai-codex.md)
  tend to rely on repository files, local config, and explicit user control surfaces.
- Persistent assistant platform:
  [OpenClaw](../library/repo-openclaw.md)
  centers durable truth in a long-lived platform component, the Gateway.
- Managed control planes:
  [Multica](../library/repo-multica.md),
  [Paperclip](../library/repo-paperclip.md)
  place durable truth in platform-managed records such as tasks, goals, runtimes, approvals, and
  budgets.

## Autonomy And Governance Placement

- [Claude Code](../library/repo-anthropics-claude-code.md) and
  [Codex](../library/repo-openai-codex.md)
  place autonomy close to a user-invoked coding loop and governance in config, approvals, and repo
  instructions.
- [OpenClaw](../library/repo-openclaw.md)
  places autonomy in a persistent assistant runtime and governance in the Gateway/session layer.
- [Multica](../library/repo-multica.md)
  places autonomy in managed agents but governance in platform orchestration, runtime selection,
  daemon liveness, and task/autopilot records.
- [Paperclip](../library/repo-paperclip.md)
  allows persistent autonomy but makes governance first-class through approvals, budgets, and
  rollback.

## Vocabulary Comparison

| Term | Managed Agents | Claude Code | Codex | OpenClaw | Multica | Paperclip |
| --- | --- | --- | --- | --- | --- | --- |
| main product unit | managed agent session | coding agent | coding agent / CLI | personal assistant | managed agent teammate | agent company / worker |
| extension package | tools, MCP, files, memory resources | plugin | repo guidance + runtime features | plugin | skill plus runtime provider | plugin plus adapter |
| execution bridge | environment + custom tool events | terminal session | local CLI runtime | Gateway + native runtime | daemon | adapter / runtime connector |
| durable coordination object | session event stream and resources | project config and plugin structure | repo files, config, memories | session owned by Gateway | runtime + task + agent records | ticket + goal + budget + approval |
| governance term | environment, event stream, vault, permission policy | hooks/config/user control | sandbox/approval mode | Gateway ownership and security policy | workspace/runtime management | governance, board, rollback |

| Term | Google A2A |
| --- | --- |
| main product unit | remote agent endpoint participating in tasks |
| extension package | agent card plus advertised skills/capabilities |
| execution bridge | task/message/artifact protocol |
| durable coordination object | task status, messages, artifacts, streaming or push events |
| governance term | communication policy, auth, task lifecycle |

These systems use very different product nouns. `Agent` in Claude Code and Codex is close to a
harnessed coding loop. In Multica it is a managed teammate record. In Paperclip it is a company
worker under governance. In OpenClaw it sits inside a broader assistant product anchored by the
Gateway. In Managed Agents it is a versioned hosted configuration whose work is realized through
sessions and environments.

## Source Classification

- Runtime/interface references:
  [anthropic-managed-agents.md](../library/anthropic-managed-agents.md),
  [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md),
  [repo-openai-codex.md](../library/repo-openai-codex.md)
- Agent communication reference:
  [google-agent2agent-a2a.md](../library/google-agent2agent-a2a.md)
- Runtime-plus-platform reference:
  [repo-openclaw.md](../library/repo-openclaw.md)
- Control-plane references:
  [repo-multica.md](../library/repo-multica.md),
  [repo-paperclip.md](../library/repo-paperclip.md)

## Transferable Mindset Vs Non-Transferable Baggage

What is transferable:

- brain, hands, session, and control layers should be separated
- independent agent runtimes should communicate through explicit task/message/artifact seams
- secrets should be injected through vault/binding/tool-proxy layers, not package artifacts
- background work needs explicit operator re-entry
- recurring work belongs above one-off task execution
- long-running autonomy needs durable orchestration records

What is not transferable by default:

- coding-agent-specific UX as product truth for trading
- any one reference product's full session model as a mandatory baseline
- Claude Managed Agents beta/research-preview features as hard MLP dependencies
- A2A as evidence, execution authority, or product governance by itself
- platform breadth before one lovable trader-system runtime proof is proven

For autokairos, these references should shape implementation posture only after product truth is
already locked upstream.

## Tensions To Preserve

- When does a runtime product become a platform product?
- How much of session truth should stay local to the workspace versus platform-managed?
- Which extension surfaces are actually runtime concerns, and which are control-plane concerns?
- How much governance should a reference product carry before it stops being a good runtime model?
