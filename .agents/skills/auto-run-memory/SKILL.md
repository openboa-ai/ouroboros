---
name: auto-run-memory
description: Shared recovery protocol for autokairos project work. Use when a worker needs to reconstruct current PR state, assumptions, failed attempts, winning evidence, and owner from repo state.
---

# Auto Run Memory

## Role

`auto-run-memory` recovers project state without relying on chat history.

## Read Order

1. Current branch and PR metadata
2. `.agents/AGENTS.md`
3. `knowledge-index.md`
4. `knowledge-log.md`
5. Relevant active wiki pages
6. CI/check outputs
7. Raw diffs and source notes only when needed

## Required Output

- current frontier
- latest accepted assumptions
- failed attempts
- latest winning evidence
- current owner
- open risks

## Hard Boundaries

- Do not treat chat history as primary memory.
- Do not invent missing PR state; report the gap.
- Do not read the whole repo when targeted recovery is enough.
