# Source Map

This page is the primary map for the source-of-provenance layer.

The goal of `wiki/sources/` is not to restate the architecture. The goal is to preserve the
background material that should constrain future architecture and implementation work.

Read this layer before changing `wiki/architecture/` so that project decisions stay grounded in
actual source material instead of drifting into shallow analogy or taste.

## Reading Order

1. Read the most relevant per-source note in `library/`.
2. Read neighboring notes in the same cluster.
3. Read the derived comparisons in `../synthesis/`.
4. Only then update or reinterpret `wiki/architecture/`.

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

This library currently covers the 13 explicit source links collected for the current autokairos
research pass.

## Coverage View

| Primary source | Adjacent docs inspected | Local note | Consumed by synthesis |
| --- | --- | --- | --- |
| [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | article sections on workflows, agents, appendices | [anthropic-building-effective-agents.md](anthropic-building-effective-agents.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [Anthropic: Managed agents](https://www.anthropic.com/engineering/managed-agents) | article passages on `session / harness / sandbox`, security boundary, pets vs cattle | [anthropic-managed-agents.md](anthropic-managed-agents.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | article sections on initializer/coding agents, artifacts, future work | [anthropic-effective-harnesses-for-long-running-agents.md](anthropic-effective-harnesses-for-long-running-agents.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [OpenAI: The next evolution of the Agents SDK](https://openai.com/index/the-next-evolution-of-the-agents-sdk/) | article sections on harness primitives, native sandbox, Manifest, harness/compute split | [openai-next-evolution-of-the-agents-sdk.md](openai-next-evolution-of-the-agents-sdk.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [Anthropic: Automated Alignment Researchers](https://www.anthropic.com/research/automated-alignment-researchers) | article sections on setup, results, implications, reward hacking | [anthropic-automated-alignment-researchers.md](anthropic-automated-alignment-researchers.md) | [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md) |
| [Anthropic: Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) | write-up sections on setup, method discovery, reward hacking, finding sharing | [anthropic-automated-w2s-researcher.md](anthropic-automated-w2s-researcher.md) | [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md) |
| [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/) | article sections on docs as system of record, AGENTS, merge philosophy, garbage collection | [openai-harness-engineering.md](openai-harness-engineering.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md) |
| [anthropics/claude-code](https://github.com/anthropics/claude-code) | root `README.md`, `plugins/README.md`, official docs for routines, desktop tasks, `/loop`, platforms, and repo tree | [repo-anthropics-claude-code.md](repo-anthropics-claude-code.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [proactive-operations-and-wake-orchestration.md](../synthesis/proactive-operations-and-wake-orchestration.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [openai/codex](https://github.com/openai/codex) | root `README.md`, `codex-rs/README.md`, `docs/contributing.md`, official Codex app/product pages, repo tree | [repo-openai-codex.md](repo-openai-codex.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [proactive-operations-and-wake-orchestration.md](../synthesis/proactive-operations-and-wake-orchestration.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [safety-research/automated-w2s-research](https://github.com/safety-research/automated-w2s-research) | root `README.md`, execution-mode descriptions, project structure | [repo-safety-research-automated-w2s-research.md](repo-safety-research-automated-w2s-research.md) | [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md) |
| [multica-ai/multica](https://github.com/multica-ai/multica) | root `README.md`, `packages/core/types/agent.ts`, `apps/docs/.../agents.mdx` | [repo-multica.md](repo-multica.md) | [proactive-operations-and-wake-orchestration.md](../synthesis/proactive-operations-and-wake-orchestration.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [openclaw/openclaw](https://github.com/openclaw/openclaw) | root `README.md`, `VISION.md`, root `AGENTS.md`, `docs/concepts/architecture.md`, `docs/concepts/session.md`, `docs/tools/acp-agents.md`, and official automation docs | [repo-openclaw.md](repo-openclaw.md) | [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md), [proactive-operations-and-wake-orchestration.md](../synthesis/proactive-operations-and-wake-orchestration.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |
| [paperclipai/paperclip](https://github.com/paperclipai/paperclip) | root `README.md`, `ROADMAP.md`, root `AGENTS.md`, repo tree | [repo-paperclip.md](repo-paperclip.md) | [proactive-operations-and-wake-orchestration.md](../synthesis/proactive-operations-and-wake-orchestration.md), [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md), [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md) |

## Anthropic Engineering

- [anthropic-building-effective-agents.md](anthropic-building-effective-agents.md)
  Practical guidance on workflows vs agents, simplicity-first design, and agent-computer interface
  quality.
- [anthropic-managed-agents.md](anthropic-managed-agents.md)
  Long-horizon hosted-agent system design centered on decoupling `brain`, `hands`, and `session`.
- [anthropic-effective-harnesses-for-long-running-agents.md](anthropic-effective-harnesses-for-long-running-agents.md)
  Harness patterns for fresh-session continuity: initializer setup, progress artifacts, feature
  lists, and end-to-end verification.

## OpenAI Engineering

- [openai-next-evolution-of-the-agents-sdk.md](openai-next-evolution-of-the-agents-sdk.md)
  Model-native harnesses, native sandbox execution, manifests, and harness/compute separation.
- [openai-harness-engineering.md](openai-harness-engineering.md)
  Agent-first repository design, docs as system of record, `AGENTS.md` as map, and recurring
  cleanup for drift control.

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
