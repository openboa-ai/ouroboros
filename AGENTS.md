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

## Validation

```bash
bash scripts/check-docs.sh
bash scripts/check-secrets.sh
git diff --check
```

For implementation changes, also run the relevant package tests and type checks.
