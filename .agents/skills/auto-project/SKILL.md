---
name: auto-project
description: Autokairos project harness scheduler. Use when a PR or implementation thread needs one active frontier, one next owner, keep/discard discipline, CI/QA/wiki routing, or a clear stop state.
---

# Auto Project

## Role

`auto-project` owns repo-work routing. It is the only project harness scheduler.

It schedules work on autokairos, not inside autokairos. Do not confuse this with
`TraderSystemRuntime`, `RuntimeControl`, or any product runtime behavior.

## When To Use

Use when:

- a PR must be opened, resumed, repaired, or moved toward review
- the next owner is unclear
- scope is drifting across PM, coding, QA, wiki, or CI work
- a run needs a keep, discard, reroute, final-signoff, or ready-to-land decision

## Workflow

1. Recover current repo truth from branch, PR, `knowledge-index.md`, relevant wiki pages, and CI.
2. Name exactly one active frontier.
3. Route to exactly one owner: `auto-pm`, `auto-coding`, `auto-qa`, `llm-wiki`, or a utility.
4. Require evidence before keeping changes.
5. Require `llm-wiki` writeback for durable decisions.

## Required Output

- active frontier
- current owner
- evidence required to keep the work
- next owner or stop state
- reason this is not product runtime scheduling

## Stop Conditions

Stop when the frontier is routed, parked for signoff, ready to land, discarded, or blocked by a
specific risk.

## Hard Boundaries

- Do not implement directly unless the user explicitly asks to bypass the harness.
- Do not allow multiple active writers.
- Do not move a PR forward without current evidence.
- Do not let chat history be the only memory of a completed decision.
