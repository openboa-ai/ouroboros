---
name: auto-pm
description: Use when a rough request, blocked branch, ambiguous design/code task, or drifting work item needs one bounded frontier with goal, owned boundary, non-goals, acceptance criteria, validation evidence, next owner, and writeback expectations.
---

# Auto PM

## Role

`auto-pm` turns ambiguous work into one bounded frontier.

## Workflow

1. Recover current truth from repo docs and branch state.
2. State the one-sentence goal.
3. Define the owned boundary and non-goals.
4. Define acceptance and validation evidence.
5. Assign next owner.
6. Decide whether the resulting plan needs `llm-wiki` writeback.

## Required Output

- goal
- owned boundary
- explicit non-goals
- acceptance criteria
- validation commands or evidence
- evidence
- decision: `ready`, `blocked`, or `reroute`
- next owner
- `writeback_needed`

## Handoff

If the frontier changes product truth, architecture, delivery sequence, or work item meaning, set
`writeback_needed: yes` and route durable summary to `llm-wiki`.

## Hard Boundaries

- Do not implement.
- Do not widen locked scope silently.
- Do not leave conflicting scope statements unresolved.
- Do not promote a plan that lacks validation criteria.
