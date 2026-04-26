---
name: auto-run-memory
description: Use when a worker needs to reconstruct current project state, assumptions, failed attempts, winning evidence, owner, and writeback gaps from repo state instead of chat history.
---

# Auto Run Memory

## Role

`auto-run-memory` recovers project state without relying on chat history.

## Use When

- A thread resumes after context loss.
- The branch, PR, task, or run has multiple changes and current owner is unclear.
- A worker needs latest accepted assumptions and failed attempts.

## Workflow

1. Read current branch and available task/PR metadata.
2. Read repo-level `AGENTS.md`.
3. Read `.agents/AGENTS.md`.
4. Read `.agents/skills/AGENTS.md`.
5. Read `knowledge-index.md` and `knowledge-log.md`.
6. Read relevant active wiki pages.
7. Inspect CI/check outputs and raw diffs only when needed.

## Required Output

- current frontier
- latest accepted assumptions
- failed attempts
- latest winning evidence
- current owner
- open risks
- `writeback_needed`

## Handoff

If recovery finds missing durable memory, route to `llm-wiki` to repair the gap before more work
depends on chat history.

## Hard Boundaries

- Do not treat chat history as primary memory.
- Do not invent missing project state; report the gap.
- Do not read the whole repo when targeted recovery is enough.
