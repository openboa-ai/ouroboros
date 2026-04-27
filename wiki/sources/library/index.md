# Source Map

This page is the primary map for the source-of-provenance layer.

The goal of `wiki/sources/` is not to restate the architecture. The goal is to preserve the
background material that should constrain future architecture and implementation work.

Read this layer before changing `wiki/architecture/` so that project decisions stay grounded in
actual source material instead of drifting into shallow analogy or taste.

## Reading Order

1. Check [../reference-ledger.md](../reference-ledger.md) for the supplied URL and ingestion status.
2. Read the matching URL-level note in [url-notes/](url-notes/), if it exists.
3. Read the most relevant per-source or cluster note in `library/`.
4. Read neighboring notes in the same cluster.
5. Read the derived comparisons in `../synthesis/`.
6. Only then update or reinterpret `wiki/architecture/`.

## Note Schema

Every source note in this directory follows the same schema:

- `Source`
- `What This Source Is`
- `Core Thesis`
- `Key Mechanisms / Architecture`
- `Important Passages Or Facts`
- `Vocabulary And Mental Models`
- `Transferable Lessons`
- `Non-transferable Baggage`
- `Open Questions / Tensions`

The notes are intentionally mostly neutral. They are evidence files, not architecture pages.

This library covers both individual source notes and cluster notes. Cluster notes are allowed when
one product or documentation family has many URLs, but every supplied URL should remain traceable
through [../reference-ledger.md](../reference-ledger.md).

For high-value or user-supplied references, use [url-notes/](url-notes/) for one-file-per-URL
deep extraction. Cluster notes should synthesize; URL notes should preserve the specific source's
design pressure.

## Coverage View

| Primary source | Adjacent docs inspected | Local note | Consumed by synthesis |
| --- | --- | --- | --- |
| April 2026 supplied reference list | all supplied URLs preserved with status and source/synthesis targets | [../reference-ledger.md](../reference-ledger.md) | all synthesis pages below |
| URL-level deep notes | one maintained note per deeply ingested URL | [url-notes/](url-notes/) | cluster notes and synthesis pages below |
| Anthropic 2026 runtime / Managed Agents stack | Managed Agents overview and memory, Managed Agents engineering post, long-running harness/application harness posts, Claude Managed Agents blog, Claude Cowork, Claude Code auto mode, Agent Skills, measuring agent autonomy | [anthropic-2026-runtime-and-managed-agent-stack.md](anthropic-2026-runtime-and-managed-agent-stack.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [proactive-operations-and-runtime-control.md](../synthesis/proactive-operations-and-runtime-control.md), [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| OpenAI 2026 agent / Codex / workspace stack | Workspace Agents, Codex app/product/security/use-case pages, AgentKit, new tools for building agents, Agents SDK docs for sandboxes, running agents, orchestration, guardrails, observability, evals, MCP, skills, tools, shell, computer use, compaction, token counting, reasoning, latest model guidance | [openai-2026-agent-codex-workspace-stack.md](openai-2026-agent-codex-workspace-stack.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| Google 2026 agent platform and protocols | Cloud Next '26, Gemini Enterprise Agent Platform, runtime, memory bank, ADK, agent-protocol guide, A2A latest, Jules, Gemini Cloud Assist | [google-2026-agent-platform-and-protocols.md](google-2026-agent-platform-and-protocols.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [proactive-operations-and-runtime-control.md](../synthesis/proactive-operations-and-runtime-control.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| Proactive agent research papers and package reference | Proactive Agent, Generative Agents, ProAgentBench, ClawHub proactive-agent package | [proactive-agent-research-papers.md](proactive-agent-research-papers.md) | [proactive-operations-and-runtime-control.md](../synthesis/proactive-operations-and-runtime-control.md), [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md) |
| [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | article sections on workflows, agents, appendices | [anthropic-building-effective-agents.md](anthropic-building-effective-agents.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [Anthropic: Managed agents](https://www.anthropic.com/engineering/managed-agents) | engineering post plus official docs for Agent, Environment, Session, Events, tools, files, memory, vaults, multiagent, outcomes, observability, and migration | [anthropic-managed-agents.md](anthropic-managed-agents.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk) | official SDK overview and agent-loop docs | [anthropic-claude-agent-sdk.md](anthropic-claude-agent-sdk.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [Google: Agent2Agent Protocol](https://developers.googleblog.com/ko/a2a-a-new-era-of-agent-interoperability/) | Google announcement, current A2A protocol specification, A2A/MCP comparison, purchasing concierge codelab | [google-agent2agent-a2a.md](google-agent2agent-a2a.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [Google Agent Development Kit](https://adk.dev/runtime/) | official runtime, state, and artifact docs | [google-agent-development-kit.md](google-agent-development-kit.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | article sections on initializer/coding agents, artifacts, future work | [anthropic-effective-harnesses-for-long-running-agents.md](anthropic-effective-harnesses-for-long-running-agents.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [OpenAI: The next evolution of the Agents SDK](https://openai.com/index/the-next-evolution-of-the-agents-sdk/) | article sections on harness primitives, native sandbox, Manifest, harness/compute split | [openai-next-evolution-of-the-agents-sdk.md](openai-next-evolution-of-the-agents-sdk.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [OpenAI Agents SDK / SandboxAgent](https://openai.github.io/openai-agents-python/ref/sandbox/sandbox_agent/) | official Runner, RunConfig, Sessions, Trace, SandboxAgent, Manifest, and Capability docs | [openai-agents-sdk-and-sandbox.md](openai-agents-sdk-and-sandbox.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [Model Context Protocol](https://modelcontextprotocol.io/docs/learn/architecture) | official MCP architecture, tools, resources, prompts, elicitation docs | [model-context-protocol.md](model-context-protocol.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [Agent Client Protocol](https://zed-industries.github.io/agent-client-protocol/) | official ACP docs, Zed overview, OpenClaw ACP agent docs | [agent-client-protocol.md](agent-client-protocol.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [Anthropic: Automated Alignment Researchers](https://www.anthropic.com/research/automated-alignment-researchers) | article sections on setup, results, implications, reward hacking | [anthropic-automated-alignment-researchers.md](anthropic-automated-alignment-researchers.md) | [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md) |
| [Anthropic: Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) | write-up sections on setup, method discovery, reward hacking, finding sharing | [anthropic-automated-w2s-researcher.md](anthropic-automated-w2s-researcher.md) | [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md) |
| [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/) | article sections on docs as system of record, AGENTS, merge philosophy, garbage collection | [openai-harness-engineering.md](openai-harness-engineering.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [AGENTS.md](https://agents.md/) and [Agent Skills](https://agentskills.io/home) | repo instructions, skill specification, descriptions, evaluation, scripts, and progressive disclosure | [agents-md-and-agent-skills.md](agents-md-and-agent-skills.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [obra/superpowers](https://github.com/obra/superpowers) | composable agentic workflow skills for design, planning, execution, review, verification, and branch finishing | [superpowers-agentic-skill-methodology.md](superpowers-agentic-skill-methodology.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [Phil Schmid: Why engineers struggle building agents](https://www.philschmid.de/why-engineers-struggle-building-agents) | essay sections on semantic state, handing over control, errors as inputs, evals, and agent-friendly APIs | [phil-schmid-why-engineers-struggle-building-agents.md](phil-schmid-why-engineers-struggle-building-agents.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [anthropics/claude-code](https://github.com/anthropics/claude-code) | root `README.md`, `plugins/README.md`, official docs for routines, desktop tasks, `/loop`, platforms, and repo tree | [repo-anthropics-claude-code.md](repo-anthropics-claude-code.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [proactive-operations-and-runtime-control.md](../synthesis/proactive-operations-and-runtime-control.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [openai/codex](https://github.com/openai/codex) | root `README.md`, `codex-rs/README.md`, `docs/contributing.md`, official Codex app/product pages, repo tree | [repo-openai-codex.md](repo-openai-codex.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [proactive-operations-and-runtime-control.md](../synthesis/proactive-operations-and-runtime-control.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [safety-research/automated-w2s-research](https://github.com/safety-research/automated-w2s-research) | root `README.md`, execution-mode descriptions, project structure | [repo-safety-research-automated-w2s-research.md](repo-safety-research-automated-w2s-research.md) | [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md) |
| [multica-ai/multica](https://github.com/multica-ai/multica) | root `README.md`, `packages/core/types/agent.ts`, `apps/docs/.../agents.mdx` | [repo-multica.md](repo-multica.md) | [proactive-operations-and-runtime-control.md](../synthesis/proactive-operations-and-runtime-control.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [openclaw/openclaw](https://github.com/openclaw/openclaw) | root `README.md`, `VISION.md`, root `AGENTS.md`, `docs/concepts/architecture.md`, `docs/concepts/session.md`, `docs/tools/acp-agents.md`, and official automation docs | [repo-openclaw.md](repo-openclaw.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [proactive-operations-and-runtime-control.md](../synthesis/proactive-operations-and-runtime-control.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [paperclipai/paperclip](https://github.com/paperclipai/paperclip) | root `README.md`, `ROADMAP.md`, root `AGENTS.md`, repo tree | [repo-paperclip.md](repo-paperclip.md) | [proactive-operations-and-runtime-control.md](../synthesis/proactive-operations-and-runtime-control.md), [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |

## Anthropic Engineering

- [anthropic-building-effective-agents.md](anthropic-building-effective-agents.md)
  Practical guidance on workflows vs agents, simplicity-first design, and agent-computer interface
  quality.
- [anthropic-managed-agents.md](anthropic-managed-agents.md)
  Long-horizon hosted-agent system design centered on decoupling `brain`, `hands`, and `session`.
- [anthropic-claude-agent-sdk.md](anthropic-claude-agent-sdk.md)
  SDK-level Claude agent loop, session, context, tool, MCP, and subagent boundaries.
- [anthropic-effective-harnesses-for-long-running-agents.md](anthropic-effective-harnesses-for-long-running-agents.md)
  Harness patterns for fresh-session continuity: initializer setup, progress artifacts, feature
  lists, and end-to-end verification.

## Google Agent Interoperability

- [google-agent2agent-a2a.md](google-agent2agent-a2a.md)
  Agent-to-agent interoperability protocol centered on agent cards, tasks, messages, artifacts,
  streaming updates, and the MCP-vs-A2A boundary.
- [google-agent-development-kit.md](google-agent-development-kit.md)
  Agent, Runner, Session, State, Event, Artifact, and Tool vocabulary from Google ADK.

## OpenAI Engineering

- [openai-next-evolution-of-the-agents-sdk.md](openai-next-evolution-of-the-agents-sdk.md)
  Model-native harnesses, native sandbox execution, manifests, and harness/compute separation.
- [openai-agents-sdk-and-sandbox.md](openai-agents-sdk-and-sandbox.md)
  Agent, Runner, RunConfig, Session, Trace, SandboxAgent, Manifest, and Capability boundaries.
- [openai-harness-engineering.md](openai-harness-engineering.md)
  Agent-first repository design, docs as system of record, `AGENTS.md` as map, and recurring
  cleanup for drift control.
- [agents-md-and-agent-skills.md](agents-md-and-agent-skills.md)
  Open-format guidance for always-on `AGENTS.md` files and progressive-disclosure skill folders.
- [superpowers-agentic-skill-methodology.md](superpowers-agentic-skill-methodology.md)
  Agentic workflow-skill methodology for skill-first routing, planning, execution, verification,
  review, and branch finishing.
- [phil-schmid-why-engineers-struggle-building-agents.md](phil-schmid-why-engineers-struggle-building-agents.md)
  Agent-engineering essay warning against deterministic route/enum design where semantic context
  should drive agent behavior.

## Protocol Boundaries

- [model-context-protocol.md](model-context-protocol.md)
  MCP as the tool/resource/prompt boundary, not an agent identity or trading authority boundary.
- [agent-client-protocol.md](agent-client-protocol.md)
  ACP as an external coding-harness bridge for Codex/Claude/OpenClaw-like systems.

## Anthropic Research

- [anthropic-automated-alignment-researchers.md](anthropic-automated-alignment-researchers.md)
  Parallel automated researchers, scalable oversight, and the shift from idea generation to
  evaluation bottlenecks.
- [anthropic-automated-w2s-researcher.md](anthropic-automated-w2s-researcher.md)
  Detailed execution model for AARs: independent sandboxes, remote evaluation, external logs,
  finding sharing, and reward hacking pressure.

## Reference Repositories: Runtime / Harness Products

- [repo-anthropics-claude-code.md](repo-anthropics-claude-code.md)
  Terminal coding agent with plugin surfaces for commands, agents, hooks, skills, and MCP.
- [repo-openai-codex.md](repo-openai-codex.md)
  Local coding agent with multiple surfaces, in-repo skills, sandbox modes, and AGENTS-based
  project guidance.
- [repo-openclaw.md](repo-openclaw.md)
  Always-on assistant centered on a long-lived Gateway, embedded agent runtime, session ownership,
  and ACP integration with external harnesses.

## Reference Repositories: Evaluation / Orchestration / Control Plane

- [repo-safety-research-automated-w2s-research.md](repo-safety-research-automated-w2s-research.md)
  Automated W2S sandbox with server-side evaluation, Docker isolation, and findings sharing.
- [repo-multica.md](repo-multica.md)
  Managed-agents platform with daemon-driven runtimes, agent/task lifecycle, and workspace skills.
- [repo-paperclip.md](repo-paperclip.md)
  Governance-heavy agent company control plane with heartbeats, budgets, approvals, and persistent
  task context.

## Synthesis

After reading the source notes, continue with:

- [../synthesis/index.md](../synthesis/index.md)

That directory contains the first interpretation layer above the raw notes.
