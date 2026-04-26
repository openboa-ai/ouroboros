---
name: auto-project
description: Use when project work needs routing: a branch, PR, task, or implementation thread has unclear ownership, drifting scope, blocked progress, multiple possible next workers, or needs a clear stop state with one active frontier.
---

# Auto Project

## Role

`auto-project` owns repo-work routing. It is the only project harness scheduler.

It schedules work in the repository. It must not be confused with the product runtime of whatever
system the repository builds.

## Workflow

1. Recover current repo truth from branch, task/PR metadata, `knowledge-index.md`, relevant wiki
   pages, and CI.
2. Name exactly one active frontier.
3. Route to exactly one owner: `auto-pm`, `auto-coding`, `auto-qa`, `llm-wiki`, or a utility.
4. Require evidence before keeping changes.
5. Require every owner to return `writeback_needed: yes/no`.
6. Route to `llm-wiki` when durable decisions need writeback.

## Required Output

- goal
- owned boundary
- active frontier
- evidence
- current owner
- evidence required to keep the work
- decision: `route`, `park`, `discard`, `ready`, or `blocked`
- next owner or stop state
- `writeback_needed`
- reason this is repo-work routing, not product behavior

## Handoff

`auto-project` should not be the final memory. If the route produces durable truth, stop only after
`llm-wiki` writes it back or explicitly records why writeback is unnecessary.

## Hard Boundaries

- Do not implement directly unless the user explicitly asks to bypass the harness.
- Do not allow multiple active writers.
- Do not move work forward without current evidence.
- Do not let chat history be the only memory of a completed decision.
