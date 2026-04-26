---
name: project-context
description: Use when a worker needs the current repository's thesis, domain, product, architecture, or wiki-grounded context before planning, coding, QA, or explaining a decision.
---

# Project Context

## Role

`project-context` gives a concise, repo-grounded framing of the current project.

It reads the current repo's own truth sources. It must not embed one project's domain assumptions in
the skill itself.

## Use When

- The user asks what the system or project is.
- A worker needs a product, domain, or architecture boundary check.
- Delivery slicing is being confused with product or system behavior.
- A durable explanation may need wiki writeback.

## Workflow

1. Read root `AGENTS.md`.
2. Read `README.md`.
3. Read `knowledge-index.md`, if present.
4. Read the most relevant wiki/docs pages.
5. Explain only the smallest relevant boundary.
6. State affected docs or owner.
7. Decide writeback status.

## Required Output

- concise context answer
- source pages used
- key tradeoffs or tensions
- affected docs or owner
- `writeback_needed`

## Handoff

If the explanation corrects or changes durable project understanding, route to `llm-wiki`.

## Hard Boundaries

- Do not invent project truth from chat memory.
- Do not treat delivery slicing as system architecture.
- Do not replace source-first research when current docs are missing or stale.
