# AGENTS.md

## Canonical Sources

Linear is the source of truth for Ouroboros product, planning, project state, documentation, comments, project updates, and durable operating history.

Start every non-trivial task from:

1. the active Linear issue, milestone, blockers, comments, and project updates
2. the Ouroboros Linear project: https://linear.app/openboa/project/ouroboros-113fef53f6d1
3. the Linear Documentation Index: https://linear.app/openboa/document/ouroboros-documentation-index-953f443725df
4. [LINEAR.md](LINEAR.md), which maps the Project Documents
5. this file, [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and `.agents/skills/AGENTS.md`

The repo is the implementation surface. Linear is the documentation and execution-state authority.

## Codex Operating Contract

This repository uses Codex features as an operating system for quality, not as a second source of
truth.

| Codex surface | Repo role |
| --- | --- |
| `AGENTS.md` | Always-on policy for source order, boundaries, naming, validation, and writeback. |
| `.agents/skills` | Bounded workflow instructions loaded only when the task matches the skill. |
| Plugins | External app, MCP, and reusable workflow bundles such as Linear, GitHub, browser, security, and OpenAI docs access. |
| Project-scoped subagents | Explicitly requested read-only exploration or review workers for parallel evidence gathering. |
| Hooks | Local pre-tool and post-tool safety checks; Git hooks and CI remain the final guard. |

Use plugins to access the authoritative system that owns the fact: Linear for project truth,
GitHub for PR/CI/review evidence, OpenAI docs for Codex/OpenAI behavior, and browser tooling for
rendered local UI evidence. Do not replace maintained project truth with chat memory.

Use project-scoped subagents only when the task benefits from parallel read-only work, such as
Linear context recovery, code path mapping, PR review, or UI reproduction. Subagents are advisory:
the main Codex worker remains responsible for the final patch, validation, and writeback decision.

## Repository Responsibility

The repo owns implementation truth: code, tests, fixtures, local validation scripts, compact developer-facing repo docs, executable agent instructions, and review evidence.

Linear owns project truth: Initiative, Project, Milestone, Cycle, Issue, comments, project updates, Project Documents, product brief, PRD, roadmap, source synthesis, architecture archive, active frontier ledger, and durable project outcomes.

When the two disagree, stop and reconcile through Linear before extending local repo docs.

## Agent Workflow

1. Recover the current branch, issue, dirty state, and nearest validation evidence.
2. Read the active Linear frontier first: `04`, then `05`, then the active issue or project update.
3. Read the relevant architecture, contract, source, and service documents through [LINEAR.md](LINEAR.md).
4. Read this file, [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and `.agents/skills/AGENTS.md`.
5. Route work through `.agents/skills/AGENTS.md` when the task is multi-step or ambiguous.
6. Keep implementation changes bounded to the active issue.
7. Run the narrowest meaningful validation, then the repo's required checks.
8. Write durable project outcomes back to Linear. Only update repo docs when developer execution would be wrong without the local change.

## Skill-First Gate

Use `.agents/skills/AGENTS.md` before routing multi-step repo work. Keep `project-context`, `llm-wiki`, `writeback_needed`, `superpowers:using-superpowers`, and Skill-First Gate active.

`llm-wiki` remains the durable-writeback skill name for compatibility, but its target is now Linear Project Documents, Linear comments, Linear project updates, or the minimal repo docs listed above.

Default skill routing:

| Work shape | Skill route |
| --- | --- |
| Recover branch, dirty state, PR, task, and nearest evidence | `auto-run-memory` |
| Explain current product, architecture, or repo posture | `project-context` |
| Decide the next bounded frontier or owner | `auto-project` |
| Shape a rough request into acceptance criteria | `auto-pm` |
| Implement one approved docs, code, config, or CI change | `auto-coding` |
| Review scenarios, regressions, risks, or acceptance | `auto-qa` |
| Decide PR readiness, landing, or reroute | `auto-promotion-protocol` |
| Update Linear durable truth or project-document memory | `llm-wiki` |
| Design durable vocabulary or schema names | `taxonomy-design` |

When an external Superpowers skill is available, use it as process support behind the same
repo-local ownership model. Project truth still comes from Linear and this repo.

## Taxonomy and Naming

For durable domain names, schema families, public/persisted keys, or naming cleanup, use `.agents/skills/taxonomy-design` before implementation.

Ouroboros taxonomy should be maintained as vocabulary guidance, not as a mechanical blocklist. Prefer compact canonical nouns plus explicit fields for product scope, authority, source/provenance, lifecycle, audience, and compatibility. Do not add naming/audit blockers unless an active Linear issue explicitly asks for enforcement.

Canonical Ouroboros nouns for the current product surface:

| Canonical noun | Meaning |
| --- | --- |
| `TradingSystem` | Agent-built BTCUSDT USD-M futures trading system. |
| `SystemCode` | Executable code produced for a TradingSystem. |
| `Evaluation` | Backtest or evaluation evidence. |
| `Improvement` | AAR-inspired proposal, experiment, and evaluation flow. |
| `TradingRun` | One execution session for a TradingSystem. |
| `Sandbox` | Isolated execution boundary for a TradingRun. |
| `Gateway` | Boundary that handles OrderRequest before exchange authority. |
| `Ledger` | OrderRequest, GatewayResult, and ExecutionResult record chain. |

Use the canonical nouns above for new code, tests, docs, API paths, UI labels, and persisted keys.
When a name drifts, replace it directly with the canonical term instead of adding aliases or
compatibility reads.

`npm run check:naming` is the repo-local naming quality gate. It checks public routes, UI labels,
compact docs, and canonical read-model exports. If it fails, fix the vocabulary decision instead
of widening the allowlist unless the old name is explicitly a compatibility boundary.

Use the most authoritative vocabulary source for each domain before inventing project-local terms:

1. Agent, harness, AI, model, tool, MCP, guardrail, eval, trace, workflow, and memory terms should follow OpenAI and Claude/Anthropic terminology when those products have established names. Treat frontier product language as de facto standard vocabulary before coining local synonyms.
2. Bitcoin perpetual futures and trading substrate terms should follow Binance USD-M Futures terminology for `BTCUSDT`, including account, asset, balance, position, position side, order, trade, user data stream, listenKey, margin, leverage, mark price, liquidation price, notional, `USER_DATA`, and `TRADE`.
3. Planning and execution-state terms should follow Linear when the concept is a Linear issue, project, initiative, milestone, cycle, document, comment, status update, or project update.
4. Other concepts should use conventional engineering, product, finance, and trading terms where they exist.
5. Coin an Ouroboros-specific term only when the project introduces a genuinely new concept or no standard term fits. Record that decision in Linear.

At external API, persisted-schema, fixture, or connector boundaries, preserve official spelling and casing unless a compatibility layer explicitly maps it. Internal aliases can be clearer, but they must name the source term they represent.

Project-specific taxonomy truth currently starts from the Linear document `37 Source Addendum - Trading Taxonomy References` and the active Linear issue that owns the change.

## Validation

Before a PR is ready for merge, collect all of the following evidence unless the active issue
explicitly narrows the scope:

```bash
bash scripts/check-docs.sh
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

For implementation changes, also run the relevant package tests and type checks.
For PR completion, wait for GitHub CI and Codex review. If review leaves actionable comments, fix
or explicitly reroute them before merge. After merge, write the durable outcome to Linear when the
change affects project state, operating policy, source interpretation, architecture, CI evidence,
or the active frontier.
