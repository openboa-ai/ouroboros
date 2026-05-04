# Generic Project Operating Manual

This file contains reusable repo-work rules for coding agents. It must not contain project-specific product architecture or domain vocabulary. Project-specific truth belongs in the repo root `AGENTS.md`, `README.md`, `LINEAR.md`, external tracker documents, and implementation files.

Skills live under [skills/](skills/) and are loaded only when the task calls for them.

## Operating Model

Keep three layers distinct: project truth, repo workflow, and skills. Use [skills/AGENTS.md](skills/AGENTS.md) as the routing registry.

## Project Truth First Rule

Default read order: root `AGENTS.md`, `README.md`, `LINEAR.md` if present, active issue/PR/project document references, nearest maintained repo docs needed for the task, then external references only when maintained sources are missing or stale.

Do not let chat history become the only memory of a durable decision.

## Source-First Design Gate

Do not change architecture, security, provider, infrastructure, data, evaluation, or product behavior from memory or taste. Read maintained source first and prefer primary sources.

## Bounded Frontier Rule

Work on one frontier at a time. Each frontier needs goal, owned boundary, non-goals, acceptance criteria, validation evidence, current owner, and writeback target when durable.

## Skill And Writeback Rules

- Use repo-local skills when their description matches the task.
- Use [skills/AGENTS.md](skills/AGENTS.md) before routing multi-step repo work.
- `auto-project` owns routing and next-owner selection.
- `llm-wiki` owns durable source/project-document/repo-memory writeback.
- Do not create a second durable-writeback skill. Use `llm-wiki`.
- Every completed worker path must state `writeback_needed: yes/no`.

## Validation

```bash
bash scripts/check-docs.sh
bash scripts/check-secrets.sh
git diff --check
```
