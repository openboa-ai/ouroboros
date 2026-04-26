---
name: auto-promotion-protocol
description: Use when deciding whether an autokairos frontier or PR can move to final signoff, ready-to-land, reroute, looping, or discard based on current evidence.
---

# Auto Promotion Protocol

## Role

`auto-promotion-protocol` decides whether the current frontier can move forward.

## Use When

- A worker claims acceptance is met.
- QA, CI, or docs checks need promotion judgment.
- The PR is being moved toward review or merge.

## Workflow

1. Gather acceptance, verification, QA, CI, and writeback evidence.
2. Choose one promotion state.
3. Identify the next owner or stop state.
4. Record whether durable writeback is complete.

## Required Output

- promotion state
- acceptance status
- latest verification
- latest QA judgment when applicable
- latest CI status
- wiki/writeback status
- open risks
- next owner

## Promotion States

- `looping`: more bounded work is needed
- `final-signoff`: acceptance appears met and owner review is needed
- `ready-to-land`: final checklist and current checks are green
- `reroute`: next best owner differs from current owner
- `discarded`: change should not continue

## Handoff

Promotion state is durable project memory. If it changes, set `writeback_needed: yes` and route to
`llm-wiki`.

## Hard Boundaries

- Do not promote stale evidence.
- Do not promote with critical regressions.
- Do not promote when the current owner or scope is unclear.
