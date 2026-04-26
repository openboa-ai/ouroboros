# Source Note: anthropics/claude-code

## Source

- Title: `anthropics/claude-code`
- Primary URL: [https://github.com/anthropics/claude-code](https://github.com/anthropics/claude-code)
- Source type: implementation repository
- Checked: `2026-04-19`
- Research scope:
  - root `README.md`
  - `plugins/README.md`
  - adjacent official docs:
    - `https://code.claude.com/docs/en/features-overview`
    - `https://code.claude.com/docs/en/memory`
    - `https://code.claude.com/docs/en/hooks`
    - `https://code.claude.com/docs/en/checkpointing`
    - `https://code.claude.com/docs/en/security`
    - `https://code.claude.com/docs/en/permissions`
    - `https://code.claude.com/docs/en/server-managed-settings`
    - `https://code.claude.com/docs/en/monitoring-usage`
    - `https://code.claude.com/docs/en/how-claude-code-works`
    - `https://code.claude.com/docs/en/platforms`
    - `https://code.claude.com/docs/en/web-scheduled-tasks`
    - `https://code.claude.com/docs/en/desktop-scheduled-tasks`
    - `https://code.claude.com/docs/en/scheduled-tasks`
    - `https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk`
  - repository landing-page file tree

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| `README.md` | repo root readme | product framing, install, plugin entrypoint | establishes product posture |
| `plugins/README.md` | extension-system doc | plugin structure, commands/agents/skills/hooks/MCP | core extension vocabulary |
| `features-overview` | official product doc | CLAUDE.md vs rules vs skills loading and scope | clarifies runtime instruction surfaces beyond the repo root |
| `memory` | official product doc | auto-memory storage, project memory layout, repo sharing boundary | clarifies durable memory posture |
| `hooks` | official product doc | lifecycle events, hook locations, component-scoped hooks | clarifies governance and interception surfaces |
| `checkpointing` | official product doc | local rewind model, persistence across resumed sessions, limits of local recovery | clarifies session-local recovery posture |
| `security` | official product doc | permission-based architecture, prompt-injection defenses, cloud execution audit/logging | clarifies trust and approval posture |
| `permissions` | official product doc | tiered permission system, deny/ask/allow rules, subagent permissions, managed settings | clarifies explicit approval surfaces |
| `server-managed-settings` | official administration doc | centralized settings delivery, precedence, fail-closed startup, audit logging | clarifies control-plane style policy layer |
| `monitoring-usage` | official administration doc | OpenTelemetry metrics, events, optional traces, privacy limits | clarifies external telemetry and audit surfaces |
| `how-claude-code-works` | official product doc | permission modes, checkpoints, side-effect safety | clarifies execution gating |
| `platforms` | official product doc | CLI/Desktop/cloud scheduling surfaces, Dispatch, Remote Control | clarifies where proactive work lives across product surfaces |
| `web-scheduled-tasks` | official product doc | cloud routines, trigger types, connector/environment scope | clarifies durable autonomous remote execution posture |
| `desktop-scheduled-tasks` | official product doc | local scheduled sessions, missed-run behavior, per-task approvals | clarifies local persistent scheduling posture |
| `scheduled-tasks` | official product doc | session-scoped `/loop`, monitor-backed polling, restore limits | clarifies transient scheduling posture inside a live session |
| `building-agents-with-the-claude-agent-sdk` | Anthropic engineering article | Claude Code harness generalized into a broader agent SDK | clarifies harness-vs-product posture |
| repo tree | repository structure | presence of official plugin examples | confirms extension surfaces are first-class in the repo |

## What This Source Is

This repository is Claude Code's public product repository. It is most useful as a harness-product
reference rather than as a control-plane reference. It shows how Anthropic packages an interactive
coding agent, what extension surfaces it treats as first-class, and how those surfaces are grouped
into a plugin system.

## Core Thesis

- Claude Code is a terminal-first coding agent product.
- The repository presents plugins as the main extensibility package.
- Plugins can contain commands, agents, skills, hooks, and MCP configuration.
- The product posture is interactive, repo-aware, and workflow-oriented rather than control-plane
  heavy.
- Claude Code now exposes multiple proactive-work surfaces with different durability and context
  semantics: session-scoped `/loop`, local Desktop scheduled tasks, and cloud routines.
- Project-local configuration and shared plugin distribution coexist.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Terminal coding agent` | natural-language coding agent in the terminal | root `README.md`, opening description |
| `Plugin` | extension package shared across projects and teams | `plugins/README.md`, `What are Claude Code Plugins?` |
| `Command` | slash-command workflow surface | `plugins/README.md`, plugin list and structure |
| `Agent` | specialized sub-agent packaged in a plugin | `plugins/README.md`, plugin list and structure |
| `Skill` | reusable instruction/workflow asset packaged in a plugin | `plugins/README.md`, plugin list and structure |
| `Hook` | event-driven extension point such as `SessionStart` or `PreToolUse` | `plugins/README.md`, plugin list and structure |
| `.mcp.json` | optional MCP configuration in a plugin | `plugins/README.md`, plugin structure |
| `CLAUDE.md` | always-loaded project instruction surface | `features-overview`, instruction-loading comparison |
| `.claude/rules/` | path- or scope-specific rules loaded more selectively than `CLAUDE.md` | `features-overview` |
| `Auto memory` | machine-local project memory directory shared across worktrees in one repo | `memory` |
| `Hook lifecycle` | lifecycle/event model covering session, turn, tool, task, subagent, compaction, and worktree events | `hooks` |
| `Checkpoint` | local session-level rewind point before file edits | `checkpointing` |
| `Permission system` | explicit allow/ask/deny rules over tools, MCP, bash, edits, and subagents | `security`; `permissions` |
| `Managed settings` | organization-controlled non-overridable policy layer | `permissions` |
| `Server-managed settings` | central policy delivery and precedence layer above local settings | `server-managed-settings` |
| `Telemetry / monitoring` | external metrics, events, and optional trace export | `monitoring-usage` |
| `Plan mode` | read-only planning mode before execution | `how-claude-code-works` |
| `Routine` | cloud-side recurring or externally triggered autonomous Claude Code session | `web-scheduled-tasks` |
| `Desktop scheduled task` | local recurring Claude Code session with its own saved approvals | `desktop-scheduled-tasks` |
| ``/loop`` | session-scoped scheduling surface inside a live CLI session | `scheduled-tasks` |
| `Claude Agent SDK` | broader harness/runtime layer behind Claude Code | `building-agents-with-the-claude-agent-sdk` |

### Architectural Reading

- The repo treats extension taxonomy as part of the product model.
- It does not define a larger governance or promotion system.
- It is a strong reference for harness UX and extension-surface decomposition, not for durable
  external evaluation.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| Claude Code is described as an agentic coding tool that lives in the terminal | root `README.md`, opening description |
| the root README explicitly says the repo includes Claude Code plugins | root `README.md`, `Plugins` section |
| plugins are described as extensions with custom slash commands, specialized agents, hooks, and MCP servers | `plugins/README.md`, `What are Claude Code Plugins?` |
| the plugin directory includes official examples such as code review, feature development, hook creation, and PR review toolkits | `plugins/README.md`, `Plugins in This Directory` |
| plugin contents are explicitly structured under `.claude-plugin/`, `commands/`, `agents/`, `skills/`, `hooks/`, and optional `.mcp.json` | `plugins/README.md`, `Plugin Structure` |
| some official plugins are explicitly multi-agent, such as `code-review` and `pr-review-toolkit` | `plugins/README.md`, plugin list |
| project-level configuration is referenced via `.claude/settings.json` in the plugin installation instructions | `plugins/README.md`, `Installation` |
| official docs distinguish `CLAUDE.md` as always-loaded project guidance from skills as on-demand reference or workflow material | `features-overview`, comparison table around `CLAUDE.md` and `Skill` |
| official docs distinguish `CLAUDE.md`, `.claude/rules/`, and `Skill` by load timing and scope | `features-overview`, instruction-loading table |
| project auto memory is stored under `~/.claude/projects/<project>/memory/`, shared across worktrees in the same repo, and uses `MEMORY.md` as an index | `memory`, `Storage location` |
| hooks are lifecycle-bound and can be declared in settings, plugins, or directly inside skills and agents | `hooks`, `Hook locations`; `Hooks in skills and agents` |
| hook events cover session start/end, tool-use, permission, subagent, task, compaction, worktree, and file/config changes | `hooks`, `Hook lifecycle` and event table |
| checkpointing automatically captures state before each edit, persists across resumed sessions, and is not a replacement for version control | `checkpointing`, `How checkpoints work` |
| checkpointing does not cover bash-modified files or remote side effects | `checkpointing`, `Bash command changes not tracked`; `how-claude-code-works`, safety section |
| the security docs describe Claude Code as permission-based by default, with explicit approval required for sensitive operations and network requests | `security`, `Permission-based architecture`; `Additional safeguards` |
| the permissions docs define tiered approval behavior for read-only tools, bash commands, and file modification | `permissions`, `Permission system` |
| the permissions docs expose explicit allow / ask / deny rules and a dedicated `/permissions` management surface | `permissions`, `Manage permissions` |
| the permissions docs include explicit subagent permission rules such as `Agent(Explore)` and managed settings that can centrally enforce permissions and trusted infrastructure | `permissions`, `Agent (subagents)`; `Managed settings` |
| the server-managed settings docs describe centrally delivered policy with highest precedence, hourly polling, optional fail-closed startup, and audit logging for settings changes | `server-managed-settings`, `Settings precedence`; `Fetch and caching behavior`; `Enforce fail-closed startup`; `Audit logging` |
| the monitoring docs describe external OpenTelemetry export of metrics, events, and optional distributed traces, with privacy controls around tool inputs and trace content | `monitoring-usage`, opening section; `Security and privacy` |
| official docs describe `Plan mode` as a read-only mode that creates a plan before execution | `how-claude-code-works`, `Control what Claude can do` |
| the platforms docs explicitly position scheduled tasks as available in CLI, Desktop, or cloud, and distinguish Dispatch and Remote Control as separate ways to work when away from the terminal | `platforms`, `Work when you are away from your terminal`; `Remote access` |
| routines run as autonomous full Claude Code cloud sessions and can be triggered by schedule, API, or GitHub events | `web-scheduled-tasks`, `Create a routine`; `Configure triggers` |
| routine runs have no permission-mode picker and no approval prompts during execution | `web-scheduled-tasks`, `Create a routine` |
| a single routine can combine multiple triggers and each run creates a new session for review afterward | `web-scheduled-tasks`, `Configure triggers`; `Create from the web` |
| Desktop scheduled tasks start a new local session automatically and persist across restarts, with one catch-up run for the most recently missed fire | `desktop-scheduled-tasks`, opening section; `How scheduled tasks run` |
| Desktop scheduled tasks have per-task permission modes, can stall waiting for approval, and can save future allow rules from the task detail page | `desktop-scheduled-tasks`, `Permissions for scheduled tasks` |
| session-scoped `/loop` scheduling only fires while Claude Code is running and idle, has no catch-up for missed fires, and restores only limited task classes on resume | `scheduled-tasks`, `Limitations` |
| dynamic `/loop` schedules may be implemented with the Monitor tool directly instead of interval reprompting | `scheduled-tasks`, opening discussion of dynamic schedules |
| Anthropic describes the harness behind Claude Code as something that can power many non-coding agents and renames the Claude Code SDK to the Claude Agent SDK | `building-agents-with-the-claude-agent-sdk`, opening framing |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `Claude Code` | terminal-first coding agent product | root `README.md` | establishes the repo as a product repo, not a general framework |
| `plugin` | main extension packaging unit | `plugins/README.md` | core extensibility primitive |
| `command` | slash-command-driven workflow surface | plugin list / structure | one extension modality |
| `agent` | specialized packaged sub-agent | plugin list / structure | explicit sub-agent concept |
| `skill` | reusable instruction/workflow asset | plugin list / structure | reusable knowledge surface |
| `hook` | lifecycle/event interception point | plugin list / structure | event-driven extension model |
| `MCP server` | external tool surface included via plugin config | `plugins/README.md` | protocol-level tool extension point |
| `CLAUDE.md` | always-loaded project instruction surface | `features-overview` | root project guidance primitive |
| `.claude/rules/` | selectively loaded rule files | `features-overview` | scoped instruction primitive |
| `auto memory` | machine-local per-project memory directory with a `MEMORY.md` index | `memory` | durable local memory primitive |
| `SessionStart`, `PreToolUse`, `TaskCreated`, `WorktreeCreate`, etc. | explicit lifecycle events in the product | `hooks` | governance/interception vocabulary |
| `checkpoint` | session-local reversible file-edit state | `checkpointing` | recovery primitive |
| `permission-based architecture` | explicit approvals and configurable permission rules as a core safety model | `security` | separates local execution approval from higher-level governance |
| `allow / ask / deny` | the three rule outcomes in Claude Code permissions | `permissions` | explicit approval vocabulary |
| `managed settings` | centrally enforced org policy layer | `permissions` | shows governance can exist above project-local config |
| `server-managed settings` | Anthropic-delivered organization policy with precedence and cached enforcement behavior | `server-managed-settings` | clearest control-plane-like policy surface in Claude Code docs |
| `audit logging` | external record of settings changes via compliance export | `server-managed-settings` | explicit governance history surface |
| `telemetry` | OTel metrics, events, and optional traces exported outside the active session | `monitoring-usage` | external observability surface |
| `Plan mode` | read-only planning mode before edits or commands | `how-claude-code-works` | execution-gating primitive |
| `routine` | durable cloud task that runs Claude Code autonomously on schedule, API, or GitHub events | `web-scheduled-tasks` | remote proactive-work primitive |
| `local scheduled task` | durable local recurring session managed by Desktop | `desktop-scheduled-tasks` | local proactive-work primitive |
| `remote task` | Desktop entrypoint to a cloud routine | `desktop-scheduled-tasks`; `web-scheduled-tasks` | shows one UI can front multiple execution backends |
| ``/loop`` | session-scoped scheduling surface inside a live session | `scheduled-tasks` | transient proactive-work primitive |
| `Dispatch` | mobile-to-desktop spawn surface | `platforms` | remote wake / delegation surface distinct from scheduling |
| `Remote Control` | steer a running session from another device | `platforms` | live-session supervision surface distinct from autonomous scheduling |
| `Claude Agent SDK` | generalized harness layer behind Claude Code | Anthropic engineering article | separates harness from one product surface |

## Transferable Lessons

- Separate extension surfaces by type instead of forcing everything into one generic plugin API.
- Distinguish commands, agents, hooks, skills, and MCP integration as different kinds of runtime
  surface.
- Distinguish always-loaded guidance, selectively loaded rules, and on-demand workflow/reference
  material.
- Keep auto memory and durable notes outside one foreground turn.
- Treat hook lifecycles as a real control surface rather than an afterthought.
- Treat checkpointing and permission modes as distinct from long-term truth or version history.
- Keep runtime approval surfaces distinct from higher-level progression or promotion decisions.
- A product can expose a meaningful administration layer for policy precedence and telemetry without becoming a full progression control plane.
- It is useful to distinguish the underlying harness layer from the product built on top of it.
- A harness product can stay interactive while still supporting rich packaged extensions.
- Repo-local/project-local configuration can coexist with a broader plugin ecosystem.
- Proactive work should be split by context and durability instead of flattened into one scheduler:
  session-scoped loops, local persistent tasks, and remote autonomous routines behave differently.
- Saved approvals and scheduling surfaces are part of the operating model, not just convenience UI.

## Non-transferable Baggage

- Claude Code is a coding harness product, not a multi-stage evaluation or promotion system.
- Its plugin taxonomy is tightly tied to product ergonomics.
- It is not itself a reference for durable external truth, audit, or control-plane governance.

## Open Questions / Tensions

- Which pieces of the Claude Code extension taxonomy are universal versus product-specific?
- How much should stay project-local versus marketplace/plugin-distributed?
- Where should durable memory live relative to repo files, project-local settings, and machine-local
  storage?
- What should count as session-local recovery versus durable external record?
- Where do powerful hook and MCP surfaces begin to require stronger governance than the repo
  exposes here?
- Which proactive-work surface should own future work: ephemeral `/loop`, local durable task, or
  cloud routine?
