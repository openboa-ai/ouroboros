---
name: auto-project
description: Use when project work needs routing: a branch, PR, task, implementation thread, external workflow skill handoff, or project state document has unclear ownership, drifting scope, blocked progress, multiple possible next workers, or needs a clear stop state with one active frontier.
---

# Auto Project

## Role

`auto-project` owns repo-work routing. It is the only project harness scheduler.

It schedules work in the repository. It must not be confused with the product runtime of whatever
system the repository builds.

## Workflow

1. Recover current repo truth from branch, task/PR metadata, `LINEAR.md`, relevant project
   documents, and CI.
2. If a project state document exists, read it before selecting work.
3. Check whether external workflow skills are available and relevant.
4. Name exactly one active frontier.
5. Route to exactly one owner: `auto-pm`, `auto-coding`, `auto-qa`, `llm-wiki`, or a utility.
6. Require evidence before keeping changes.
7. Require every owner to return `writeback_needed: yes/no`.
8. Route to `llm-wiki` when durable decisions need writeback.

## Skill-First Gate

Before routing or acting, check whether a repo-local or external skill should govern the next step.

- If user intent, design, or acceptance is unclear, shape before implementation.
- If a written plan exists, execute the plan instead of improvising.
- If a check fails, debug root cause before patching.
- If work is claimed complete, verify before claiming completion.
- If work is ready to integrate, use a finish/PR/merge decision flow.

This gate is process discipline, not product behavior. It does not override explicit user
instructions or maintained repo truth.

## Ledger-First PR-Unit Mode

Use this mode when the repo tracks PR-sized frontiers.

1. Read branch state and the project state document.
2. If an active frontier exists, continue it unless evidence says it is blocked or ready.
3. If no active frontier exists, choose the first queued frontier whose prerequisite is met.
4. Route by status:
   - `queued`: park unless prerequisite is met
   - `implementation-ready`: `auto-pm` or `auto-coding`
   - `in-progress`: `auto-coding` or `auto-qa`
   - `pr-open`: `auto-promotion-protocol` or `ci-recovery`
   - `ready-to-land`: final owner or merge owner
   - `merged`: `llm-wiki`, then select next frontier
   - `blocked`: blocker owner or user action
5. Persist frontier state changes through `llm-wiki`.

## Superpowers-Compatible Mapping

When Superpowers skills are installed in the current environment, use them as external process
skills behind the same repo-local ownership model:

| Need | Prefer when available | Repo-local fallback |
| --- | --- | --- |
| skill selection discipline | `superpowers:using-superpowers` | this skill's Skill-First Gate |
| clarify intent or design | `superpowers:brainstorming` | `auto-pm` |
| write an implementation plan | `superpowers:writing-plans` | `auto-pm` |
| isolated branch/worktree setup | `superpowers:using-git-worktrees` | `auto-run-memory` plus git hygiene |
| execute an approved plan | `superpowers:executing-plans` or `superpowers:subagent-driven-development` | `auto-coding` |
| debug a failing check or bug | `superpowers:systematic-debugging` | `ci-recovery` |
| request independent review | `superpowers:requesting-code-review` | `auto-qa` |
| verify before completion | `superpowers:verification-before-completion` | `auto-promotion-protocol` |
| finish a branch | `superpowers:finishing-a-development-branch` | `auto-promotion-protocol` |

External workflow skills may strengthen the route, but they do not own project truth. The project
project state document, maintained docs, git state, checks, and `llm-wiki` writeback remain authoritative.

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
- current_mlp, if the repo uses MLP-style planning
- active frontier
- branch and PR, if known
- status
- route
- skills considered
- evidence
- evidence required to keep the work
- current owner
- decision: `route`, `park`, `discard`, `ready`, or `blocked`
- next owner or stop state
- risks
- `writeback_needed`
- reason this is repo-work routing, not product behavior

## Auto Project Run Packet

Return this shape for PR-unit routing:

```text
current_mlp:
active_frontier:
branch:
pr:
status:
context_read:
route:
skills_considered:
evidence_required:
risks:
next_owner:
writeback_needed:
llm_wiki_target:
```

## Handoff

`auto-project` should not be the final memory. If the route produces durable truth, stop only after
`llm-wiki` writes it back or explicitly records why writeback is unnecessary.

## Hard Boundaries

- Do not implement directly unless the user explicitly asks to bypass the harness.
- Do not allow multiple active writers.
- Do not move work forward without current evidence.
- Do not let chat history be the only memory of a completed decision.
