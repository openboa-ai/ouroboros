---
name: llm-wiki
description: Use when a repository needs durable knowledge maintenance: source ingestion, source-to-synthesis promotion, wiki health checks, stale naming repair, cross-reference repair, active/historical cleanup, or durable branch/task/PR/run/design/CI writeback.
---

# LLM Wiki

## Role

`llm-wiki` owns the maintained knowledge system and durable project-loop memory.

It does not schedule project work; use `auto-project` when routing or next-owner selection is
unclear. It does own the final writeback gate for durable source, design, PR, frontier, run, CI, and
workflow outcomes.

## Workflow

1. Orient from repo-level `AGENTS.md`, `.agents/AGENTS.md`, and the nearest relevant schema.
2. Read `knowledge-index.md` and `knowledge-log.md`.
3. Read the affected maintained wiki/source pages.
4. Choose the operation: `ingest`, `query`, `lint`, or `writeback`.
5. Make the lightest durable update that preserves current truth.
6. Update navigation or log only when discoverability or chronology changed.
7. Return the writeback location and remaining gaps.

## Operations

- `ingest`: add or update source notes, register references, and promote durable lessons.
- `query`: answer from maintained wiki first, then write back durable results if needed.
- `lint`: repair stale naming, dead paths, duplicate pages, weak provenance, or active/historical
  confusion.
- `writeback`: record durable branch/task/PR/run/CI/workflow outcomes in `knowledge-log.md`, active
  wiki pages, or future `wiki/prs/` and `wiki/runs/`.

## Required Output

- goal
- owned boundary
- operation
- pages read
- pages changed
- durable truth recorded
- evidence
- decision: `written`, `no-op`, `reroute`, or `blocked`
- unresolved gaps
- next owner, if any
- `writeback_needed`
- `writeback_complete: yes/no`

## Handoff

If writeback is incomplete, return the smallest unresolved gap and next owner. If writeback is
complete, return the durable page or log location a future worker should read first.

## References

For concrete wiki templates and lifecycle details, read only when needed:

- [references/operating-model.md](references/operating-model.md)
- [references/templates.md](references/templates.md)
- [references/lint-checklist.md](references/lint-checklist.md)

## Hard Boundaries

- Do not answer from raw sources first when maintained wiki truth exists.
- Do not duplicate the same content across layers without a clear reason.
- Do not turn every transient chat answer into a permanent page.
- Do not create new folders or templates without enough maintained substance.
- Do not replace `auto-project`, `auto-pm`, `auto-coding`, or `auto-qa`.
- Do not let durable decisions remain only in chat history.
