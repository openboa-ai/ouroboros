---
name: auto-pm
description: Use when a rough request, blocked branch, or drifting work item needs one bounded frontier with goal, non-goals, acceptance criteria, validation, owner, and writeback expectations.
---

# Auto PM

## Role

`auto-pm` turns ambiguous work into one bounded frontier.

## Use When

- The request mixes design, code, QA, docs, and operations.
- Implementation, design, infrastructure, or release scope could drift.
- Acceptance criteria are implicit.
- The next owner cannot continue without inventing requirements.

## Workflow

1. Recover current truth from repo docs and branch state.
2. State the one-sentence goal.
3. Define the owned boundary and non-goals.
4. Define acceptance and validation evidence.
5. Assign next owner.
6. Decide whether the resulting plan needs `llm-wiki` writeback.

## Required Output

- one-sentence goal
- owned boundary
- explicit non-goals
- acceptance criteria
- validation commands or evidence
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
