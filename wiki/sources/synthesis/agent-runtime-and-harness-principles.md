# Agent Runtime And Harness Principles

This page compares the runtime and harness ideas spread across Anthropic engineering notes, OpenAI
engineering notes, and reference runtime products.

## Sources Used

- [anthropic-managed-agents.md](../library/anthropic-managed-agents.md)
- [anthropic-effective-harnesses-for-long-running-agents.md](../library/anthropic-effective-harnesses-for-long-running-agents.md)
- [anthropic-building-effective-agents.md](../library/anthropic-building-effective-agents.md)
- [openai-next-evolution-of-the-agents-sdk.md](../library/openai-next-evolution-of-the-agents-sdk.md)
- [openai-harness-engineering.md](../library/openai-harness-engineering.md)
- [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md)
- [repo-openai-codex.md](../library/repo-openai-codex.md)
- [repo-openclaw.md](../library/repo-openclaw.md)

## Comparison Table

| Source | What the core system is | Where durable truth lives | Where autonomy lives | Where governance lives |
| --- | --- | --- | --- | --- |
| [Managed Agents](../library/anthropic-managed-agents.md) | A hosted agent system split into brain, hands, and session | Session service outside the harness container | The agent brain plus harness loop | Session interface, harness boundary, credential isolation |
| [Effective Harnesses For Long-Running Agents](../library/anthropic-effective-harnesses-for-long-running-agents.md) | A harness workflow that keeps fresh sessions productive over long tasks | Progress files and setup artifacts in the workspace | The coding agent operating inside a prepared task environment | Harness setup, initializer flow, verification loop |
| [Building Effective Agents](../library/anthropic-building-effective-agents.md) | A spectrum from workflows to agents | Mostly the surrounding application and tool outputs | The model where paths are open-ended | Code-defined workflows and tool design |
| [Next Evolution Of The Agents SDK](../library/openai-next-evolution-of-the-agents-sdk.md) | A model-native harness plus native compute platform | Snapshots, manifests, and external runtime state | The model-native harness | Harness/compute separation, manifests, resumability surfaces |
| [Harness Engineering](../library/openai-harness-engineering.md) | A human-steered engineering system around an agent | Repository docs, AGENTS files, and system-of-record docs | The agent working inside the repository map | Humans, repo docs, and repeated cleanup loops |
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

### Durable truth should survive the current run

[Managed Agents](../library/anthropic-managed-agents.md) is explicit that session history should
live outside the harness container. [Next Evolution Of The Agents SDK](../library/openai-next-evolution-of-the-agents-sdk.md)
adds snapshots and manifests so the system can resume without trusting ephemeral process memory.
[Harness Engineering](../library/openai-harness-engineering.md) treats repository docs as the
system of record that outlives one run. [OpenClaw](../library/repo-openclaw.md) puts session
ownership in the Gateway, not inside a transient tool loop.

The shared pattern is durable state outside the currently running agent process.

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

| Concept | Anthropic engineering | OpenAI engineering | Codex / Claude Code | OpenClaw |
| --- | --- | --- | --- | --- |
| core loop | `harness` in [anthropic-managed-agents.md](../library/anthropic-managed-agents.md) and [anthropic-effective-harnesses-for-long-running-agents.md](../library/anthropic-effective-harnesses-for-long-running-agents.md) | `harness` and `model-native harness` in [openai-next-evolution-of-the-agents-sdk.md](../library/openai-next-evolution-of-the-agents-sdk.md) and repo-legibility framing in [openai-harness-engineering.md](../library/openai-harness-engineering.md) | `coding agent`, `CLI`, `plugin` surfaces in [repo-openai-codex.md](../library/repo-openai-codex.md) and [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md) | `embedded runtime` plus ACP in [repo-openclaw.md](../library/repo-openclaw.md) |
| durable truth | `session` | `Manifest`, snapshots, repo docs as system of record | repo files, `AGENTS.md`, config, local state | `Gateway` plus gateway-owned sessions |
| execution boundary | `sandbox` | `sandbox` / `compute` | `sandbox` policies, local execution modes | `Gateway` vs native runtime vs ACP session |
| workspace surface | progress artifacts, feature lists, setup scripts | manifest-described workspace, `AGENTS.md`, skills | repo guidance, plugin surfaces, local project files | bound chat/thread session plus runtime workspace |
| governance term | workflow constraints, credential isolation | harness/compute split, invariants, merge philosophy | approval mode, sandbox mode, user config | gateway ownership, pairing, session routing |

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

## Tensions To Preserve

- How much truth should live in repository files versus an external session service?
- How much of the harness should be model-native versus code-defined workflow?
- How much workspace preparation is a reusable runtime concern versus product-specific scaffolding?
- Which systems are truly runtime references, and which are partly control-plane products wearing a
  runtime face?
