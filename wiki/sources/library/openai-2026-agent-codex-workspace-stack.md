# OpenAI 2026 Agent, Codex, And Workspace Stack

## Source

This note clusters the OpenAI product and developer references supplied in the April 2026 ingestion:

- [Introducing workspace agents in ChatGPT](https://openai.com/index/introducing-workspace-agents-in-chatgpt/)
- [Workspace agents academy](https://openai.com/academy/workspace-agents/)
- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [Codex product page](https://openai.com/codex/)
- [Codex for almost everything](https://openai.com/index/codex-for-almost-everything/)
- [Codex Security research preview](https://openai.com/index/codex-security-now-in-research-preview/)
- [New tools for building agents](https://openai.com/index/new-tools-for-building-agents/)
- [Introducing AgentKit](https://openai.com/index/introducing-agentkit/)
- OpenAI API docs for Agents SDK, sandboxes, running agents, orchestration, guardrails, observability,
  evals, tools, MCP/connectors, skills, shell, computer use, compaction, token counting, reasoning,
  and latest model guidance.

## Consumed By Synthesis

- [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md)
- [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md)
- [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md)

## URL Coverage

| URL | Ingestion role | autokairos design implication |
| --- | --- | --- |
| https://openai.com/ko-KR/index/introducing-workspace-agents-in-chatgpt/ | Localized alias of Workspace Agents launch | Alias only; preserve in ledger so localized refs are not mistaken for omissions. |
| https://openai.com/index/introducing-workspace-agents-in-chatgpt/ | Workspace Agents product launch | Use as product posture for repeatable governed workspace delegation, schedules, tools, memory, and approvals. |
| https://openai.com/academy/workspace-agents/ | Workspace Agents education | Distinguish deterministic workflow design from probabilistic agent work with tools and guardrails. |
| https://openai.com/index/introducing-the-codex-app/ | Codex app launch | Treat Codex as provider/harness surface producing reviewable artifacts, not autokairos truth owner. |
| https://openai.com/codex/ | Codex product page | Keep Codex provider labels tied to concrete local/cloud/app invocation surfaces. |
| https://openai.com/index/codex-for-almost-everything/ | Codex use-case/product posture | Codex can cover broad coding work, but autokairos must restrict provider capability by runtime purpose and authority. |
| https://openai.com/index/codex-security-now-in-research-preview/ | Codex security posture | Security posture informs sandbox and approval boundaries; it does not replace trading gateway controls. |
| https://openai.com/index/new-tools-for-building-agents/ | Agent tooling announcement | Use as broad tool/sandbox/connector direction, not as a stable implementation contract without docs. |
| https://openai.com/index/introducing-agentkit/ | AgentKit product posture | Treat as product/workflow-building reference; not a reason to overbuild UI or platform breadth. |
| https://developers.openai.com/api/docs/guides/agents/sandboxes | Sandbox agents docs | Map to `HandsEnvironment`; sandbox state is execution state, not evidence or promotion truth. |
| https://developers.openai.com/api/docs/guides/agents/running-agents | Running agents docs | Map explicit invocations to `AgentRun` through `RuntimeProviderAdapter`. |
| https://developers.openai.com/api/docs/guides/agents/orchestration | Orchestration docs | Use for handoffs/multi-agent seams only when needed; do not replace semantic wake with central workflow. |
| https://developers.openai.com/api/docs/guides/agents/guardrails-approvals | Guardrails/approvals docs | Reinforces explicit guardrail and human-review records outside model self-governance. |
| https://developers.openai.com/api/docs/guides/agents/integrations-observability | Observability docs | Trace agent runs, tools, guardrails, and handoffs as inspectable records. |
| https://developers.openai.com/api/docs/guides/agent-evals | Agent evals docs | Support `EvidenceRecord` as sealed evaluation output beyond raw traces. |
| https://developers.openai.com/api/docs/guides/tools-connectors-mcp | MCP/connectors docs | Treat MCP/connectors as tool/resource access, not agent identity or live authority. |
| https://developers.openai.com/api/docs/guides/tools-skills | Skills docs | Map reusable procedural/context packaging to `CapabilityPackage`. |
| https://developers.openai.com/api/docs/guides/latest-model | Latest model guidance | Use for current provider selection research only; never silently mutate reproducible defaults. |
| https://developers.openai.com/api/docs/guides/tools | Tools overview | Tool access must be scoped, observable, and mediated by `ToolProxy`. |
| https://developers.openai.com/api/docs/guides/tools-shell | Shell tool docs | Shell capability belongs in sandbox/hands with explicit permissions and trace. |
| https://developers.openai.com/api/docs/guides/tools-computer-use | Computer-use tool docs | Computer-use is a high-authority tool surface; require strict permission and audit boundaries. |
| https://developers.openai.com/api/docs/guides/compaction | Compaction docs | Long context needs controlled summarization; compaction cannot erase durable trace. |
| https://developers.openai.com/api/docs/guides/token-counting | Token-counting docs | Provider cost/context controls are runtime concerns, not product truth. |
| https://developers.openai.com/api/docs/guides/reasoning | Reasoning docs | Reasoning controls inform provider run configuration; output still enters autokairos as trace. |

## What This Source Is

This cluster is OpenAI's current agent runtime, Codex, workspace-agent, tools, and guardrail surface.

It is the strongest source family for:

- concrete provider invocation surfaces
- sandbox and tool execution posture
- tracing and observability
- guardrails and human review
- tool/capability boundaries
- Codex as a provider/harness, not product truth

## Core Thesis

OpenAI's agent stack treats agents as systems with:

- configured agents and runs
- tools and connector permissions
- sandboxes for real work
- traces and observability
- guardrails/human review
- evals for agent workflows
- shared workspace agents for repeatable organizational workflows

For autokairos, this supports the provider-backed runtime model, but it does not move trading
authority into Codex or the Agents SDK.

## Key Mechanisms / Architecture

| Mechanism | OpenAI posture | autokairos translation |
| --- | --- | --- |
| Workspace agents | Shared long-running agents can work across tools, memory, schedules, Slack, and approvals. | Product posture reference for repeatable governed delegation, not a trading runtime spec. |
| Codex app / Codex product | Coding agent surfaces can run in local/cloud/workspace contexts and produce artifacts for review. | `codex_cli`, Codex app, and Codex cloud are provider surfaces behind `RuntimeProviderAdapter`. |
| Agents SDK running agents | Agent runs are explicit invocations with results/state. | `AgentRun` should be durable and trace-linked. |
| Sandbox agents | Agents can perform real work in a configured filesystem/computer environment. | `HandsEnvironment` can be sandbox-backed; sandbox state is not product truth. |
| Orchestration/handoffs | Agents can delegate or hand off, but the framework boundary remains explicit. | Multi-agent autokairos needs `RuntimeCommunicationPolicy` and `TeamTrace`. |
| Guardrails/approvals | Human review and guardrails are explicit control surfaces. | Live trading uses gateway and operator-control boundaries, not provider self-governance. |
| Observability | Agent runs, tool calls, guardrails, and handoffs are traceable. | `Trace` must capture provider events, tool requests, program events, and gateway decisions. |
| Agent evals | Agent workflows should be evaluated beyond unit tests. | `EvidenceRecord` must be externally sealed; trace alone is not success. |
| Tools, shell, computer use | Powerful tools need scoped authority, approvals, and environment controls. | ToolProxy/Gateway are mandatory for side effects and exchange access. |
| Compaction/token/reasoning | Long contexts require explicit management and reasoning controls. | Runtime memory and trace summaries need controlled compaction, not hidden deletion. |

## Important Passages Or Facts

- Workspace Agents are Codex-powered, cloud-running agents for repeatable workflows, shared within
  organizations, with schedules, Slack surfaces, memory, tools, approvals, analytics, admin controls,
  and compliance visibility.
- The Workspace Agents academy distinguishes deterministic workflows from probabilistic agents that
  operate inside instructions, tools, and guardrails.
- OpenAI Agents SDK docs expose agent definitions, running agents, sandbox agents, orchestration,
  guardrails, state/results, observability, and evals as separate concerns.
- OpenAI tools docs include MCP/connectors, skills, shell, and computer use as explicit tool
  surfaces, reinforcing the need for permission and trace boundaries.
- The latest-model page is dynamic product guidance; it should not silently overwrite provider
  defaults without explicit feasibility evidence.

## Vocabulary And Mental Models

| OpenAI term | autokairos term |
| --- | --- |
| Agent | `AgentSpec` |
| Runner / run | `AgentRun` through `RuntimeProviderAdapter` |
| Sandbox agent | `AgentSession` plus sandbox-backed `HandsEnvironment` |
| Trace | `Trace` / `AgentEvent` / spans |
| Handoff | `RuntimeCommunicationPolicy` / future multi-agent handoff |
| Guardrail | tool, output, gateway, evaluator, or operator-control boundary |
| Skill | `CapabilityPackage` / capability artifact |
| Connector / MCP | tool/resource access, not agent identity |
| Workspace agent | product posture for repeatable governed delegation |

## Transferable Lessons

- Provider adapters must be concrete: CLI, SDK, cloud task, or API surface.
- A provider run is not product truth; it emits trace and artifacts for autokairos to judge.
- Sandboxes are execution surfaces, not candidate/evidence/promotion authority.
- Tool access must be scoped, observable, and revocable.
- Human review and guardrails should be explicit control-plane records.
- Agent workflow evals are necessary before claiming product success.

## Non-transferable Baggage

- Workspace Agents are general organizational agents; they do not define trading legitimacy.
- Codex Security is a security product posture, not a replacement for autokairos gateway risk
  controls.
- OpenAI model/latest guidance is current-provider information, not a stable product contract.
- Shell/computer-use tools are dangerous in trading unless mediated by strict policy and trace.

## Open Questions / Tensions

- Which OpenAI surface should become the first serious provider beyond `codex_cli`: Codex SDK,
  Agents SDK sandbox, or Codex cloud?
- How should autokairos map OpenAI trace spans into provider-neutral `Trace` without losing detail?
- Which tool calls can be allowed in a live stage without operator review?
- How should model/latest guidance update provider defaults without breaking reproducibility?
