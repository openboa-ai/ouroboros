---
name: auto-project
description: Use when an autokairos PR or implementation thread needs one active frontier, one next owner, keep/discard discipline, CI/QA/wiki routing, or a clear stop state.
---

# Auto Project

## Role

`auto-project` owns repo-work routing. It is the only project harness scheduler.

It schedules work on autokairos, not inside autokairos. Do not confuse this with
`TraderSystemRuntime`, `RuntimeControl`, or product runtime behavior.

## Use When

- A PR must be opened, resumed, repaired, or moved toward review.
- The next owner is unclear.
- Scope is drifting across PM, coding, QA, wiki, or CI work.
- A run needs keep, discard, reroute, final-signoff, or ready-to-land decision.

## Workflow

1. Recover current repo truth from branch, PR, `knowledge-index.md`, relevant wiki pages, and CI.
2. Name exactly one active frontier.
3. Route to exactly one owner: `auto-pm`, `auto-coding`, `auto-qa`, `llm-wiki`, or a utility.
4. Require evidence before keeping changes.
5. Require every owner to return `writeback_needed: yes/no`.
6. Route to `llm-wiki` when durable decisions need writeback.

## Required Output

- active frontier
- current owner
- evidence required to keep the work
- next owner or stop state
- `writeback_needed`
- reason this is repo scheduling, not product runtime scheduling

## Handoff

`auto-project` should not be the final memory. If the route produces durable truth, stop only after
`llm-wiki` writes it back or explicitly records why writeback is unnecessary.

## Hard Boundaries

- Do not implement directly unless the user explicitly asks to bypass the harness.
- Do not allow multiple active writers.
- Do not move a PR forward without current evidence.
- Do not let chat history be the only memory of a completed decision.
