---
name: auto-wiki
description: Autokairos repo-memory writeback worker. Use when PR/frontier/run outcomes, durable assumptions, CI/QA decisions, or implementation results must be written back to knowledge-log or relevant wiki pages.
---

# Auto Wiki

## Role

`auto-wiki` writes durable project state back into the repo.

Use `llm-wiki` for source ingestion, synthesis, wiki structure, and wiki health checks. Use
`auto-wiki` for current PR/frontier/run memory.

## When To Use

Use when:

- a PR frontier changes state
- a completed run produced durable assumptions or evidence
- CI/QA/promotion results must be recoverable without chat history
- active docs or `knowledge-log.md` need a minimal update

## Required Output

- updated durable memory location
- what changed
- why it matters
- next owner or stop state

## Writeback Rules

- Prefer `knowledge-log.md` for chronology.
- Prefer active wiki pages for stable product or architecture truth.
- Use future `wiki/prs/` or `wiki/runs/` only when the PR loop needs resumable records.
- Write the minimum durable truth needed.

## Hard Boundaries

- Do not overpopulate wiki pages with transient chat details.
- Do not promote unstable implementation notes into product truth.
- Do not duplicate the same state across many files.
