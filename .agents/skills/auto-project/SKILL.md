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

## Routing Decision Table

| Situation | Route |
| --- | --- |
| Current state, branch, or assumptions are unclear | `auto-run-memory` |
| Project framing or active docs are unclear | `project-context` |
| Scope, owner, non-goals, or acceptance are unclear | `auto-pm` |
| One bounded change is ready to make | `auto-coding` |
| Work is claimed done or risky | `auto-qa` |
| Local checks or remote CI fail | `ci-recovery` |
| Promotion or landing state is unclear | `auto-promotion-protocol` |
| Durable decision or result must survive chat | `llm-wiki` |
| Repo memory is stale, duplicated, or hard to resume | `auto-garbage-collection` |
| Skill surface itself is drifting | `harness-skill-audit` |

## Stop States

- `routed`: next owner is known and has enough context.
- `blocked`: work cannot continue without external input, permission, or missing evidence.
- `ready`: acceptance, validation, and writeback posture are current.
- `discarded`: the change or route should not continue.
- `parked`: valid work exists but is not the active frontier now.

## Required Output

- goal
- owned boundary
- context read
- active frontier
- evidence
- current owner
- evidence required to keep the work
- decision: `route`, `park`, `discard`, `ready`, or `blocked`
- next owner or stop state
- risks
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
