---
name: project-context
description: Use when a worker needs the current repository's thesis, domain, product, architecture, constraints, active docs, or wiki-grounded context before planning, coding, QA, reviewing, or explaining a decision.
---

# Project Context

## Role

`project-context` gives a concise, repo-grounded framing of the current project.

It reads the current repo's own truth sources. It must not embed one project's domain assumptions in
the skill itself.

## Workflow

1. Read root `AGENTS.md`.
2. Read `README.md`.
3. Read `knowledge-index.md`, if present.
4. Read the most relevant wiki/docs pages.
5. Explain only the smallest relevant boundary.
6. State affected docs or owner.
7. Decide writeback status.

## Required Output

- goal
- owned boundary
- concise context answer
- source pages used
- evidence
- decision: `answered`, `reroute`, or `blocked`
- key tradeoffs or tensions
- affected docs or owner
- next owner
- `writeback_needed`

## Handoff

If the explanation corrects or changes durable project understanding, route to `llm-wiki`.

## Hard Boundaries

- Do not invent project truth from chat memory.
- Do not treat delivery slicing as system architecture.
- Do not replace source-first research when current docs are missing or stale.
