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

## Repository Responsibility

The repo owns implementation truth: code, tests, fixtures, local validation scripts, compact developer-facing repo docs, executable agent instructions, and review evidence.

Linear owns project truth: Initiative, Project, Milestone, Cycle, Issue, comments, project updates, Project Documents, product brief, PRD, roadmap, source synthesis, architecture archive, active frontier ledger, and durable project outcomes.

When the two disagree, stop and reconcile through Linear before extending local repo docs.

## Agent Workflow

1. Recover the current branch, issue, dirty state, and nearest validation evidence.
2. Read the relevant Linear document set through [LINEAR.md](LINEAR.md).
3. Route work through `.agents/skills/AGENTS.md` when the task is multi-step or ambiguous.
4. Keep implementation changes bounded to the active issue.
5. Run the narrowest meaningful validation, then the repo's required checks.
6. Write durable project outcomes back to Linear. Only update repo docs when developer execution would be wrong without the local change.

## Skill-First Gate

Use `.agents/skills/AGENTS.md` before routing multi-step repo work. Keep `project-context`, `llm-wiki`, `writeback_needed`, `superpowers:using-superpowers`, and Skill-First Gate active.

`llm-wiki` remains the durable-writeback skill name for compatibility, but its target is now Linear Project Documents, Linear comments, Linear project updates, or the minimal repo docs listed above.

## Taxonomy and Naming

For durable domain names, schema families, public/persisted keys, or naming cleanup, use `.agents/skills/taxonomy-design` before implementation.

Ouroboros taxonomy should be maintained as vocabulary guidance, not as a mechanical blocklist. Prefer compact canonical nouns plus explicit fields for product scope, authority, source/provenance, lifecycle, audience, and compatibility. Do not add naming/audit blockers unless an active Linear issue explicitly asks for enforcement.

Use the most authoritative vocabulary source for each domain before inventing project-local terms:

1. Agent, harness, AI, model, tool, MCP, guardrail, eval, trace, workflow, and memory terms should follow OpenAI and Claude/Anthropic terminology when those products have established names. Treat frontier product language as de facto standard vocabulary before coining local synonyms.
2. Bitcoin perpetual futures and trading substrate terms should follow Binance USD-M Futures terminology for `BTCUSDT`, including account, asset, balance, position, position side, order, trade, user data stream, listenKey, margin, leverage, mark price, liquidation price, notional, `USER_DATA`, and `TRADE`.
3. Planning and execution-state terms should follow Linear when the concept is a Linear issue, project, initiative, milestone, cycle, document, comment, status update, or project update.
4. Other concepts should use conventional engineering, product, finance, and trading terms where they exist.
5. Coin an Ouroboros-specific term only when the project introduces a genuinely new concept or no standard term fits. Record that decision in Linear.

At external API, persisted-schema, fixture, or connector boundaries, preserve official spelling and casing unless a compatibility layer explicitly maps it. Internal aliases can be clearer, but they must name the source term they represent.

Project-specific taxonomy truth currently starts from the Linear document `37 Source Addendum - Trading Taxonomy References` and the active Linear issue that owns the change.

## Validation

```bash
bash scripts/check-docs.sh
bash scripts/check-secrets.sh
git diff --check
```

For implementation changes, also run the relevant package tests and type checks.
