---
name: linear-graphql
description: Use when the linear skill has selected a Linear operation and the repo-local GraphQL execution path must read or write Linear state.
---

# Linear GraphQL

## Role

Provide the repo-local main execution path for Linear issue workpad, comment, and raw GraphQL
operations after the `linear` skill has established the target, purpose, and operation shape.

## Workflow

1. Load and follow the `linear` skill first for Linear-related work.
2. Confirm the issue, project, document, comment, or project update target from the Linear workflow.
3. Use `npm run linear:workpad` for one issue workpad upsert or `npm run linear:graphql` for one
   explicit GraphQL operation.
4. Read `LINEAR_API_KEY` from the environment or local `.env`; never print raw token values.
5. Use one durable issue workpad comment headed `## Codex Workpad` for execution state.
6. Treat GraphQL execution failure as a blocker until the Linear operation is retried or rerouted.

## Required Output

- Command evidence showing whether the writeback succeeded.
- Linear issue identifier, comment id, and URL when a comment mutation succeeds.
- Redacted error evidence when auth, transport, or GraphQL errors block writeback.

## Handoff

When handing off, include the command used, the target issue or GraphQL operation, the comment id or
URL if present, and whether another worker must retry writeback.

## Hard Boundaries

- Do not print, log, commit, or paste API tokens.
- Do not use this execution path before selecting the `linear` skill for Linear-related work.
- Do not use GraphQL execution to skip product ownership review.
- Do not create duplicate workpad comments when an existing marker comment can be updated.
