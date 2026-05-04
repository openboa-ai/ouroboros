---
name: auto-promotion-protocol
description: Use when deciding whether a project frontier, branch, task, release, or PR can move to final signoff, ready-to-land, reroute, looping, or discard based on acceptance, verification, QA, CI, and writeback evidence.
---

# Auto Promotion Protocol

## Role

`auto-promotion-protocol` decides whether the current frontier can move forward.

## Workflow

1. Gather acceptance, verification, QA, CI, and writeback evidence.
2. Choose one promotion state.
3. Identify the next owner or stop state.
4. Record whether durable writeback is complete.

## Promotion Criteria

- `looping`: the frontier is valid but needs another bounded implementation or docs pass.
- `final-signoff`: acceptance appears met, verification is current, and a human or final reviewer
  should decide.
- `ready-to-land`: acceptance is met, current checks are green, QA did not veto, and durable writeback
  is complete or explicitly unnecessary, including frontier ledger state when the repo uses one.
- `reroute`: a different owner must resolve scope, QA, CI, docs, cleanup, or external action.
- `discarded`: the approach is obsolete, unsafe, duplicate, or not worth continuing.

## Gate Checklist

- acceptance status: met, partial, failed, or unknown
- verification status: command/check name, timestamp or commit, result
- QA status: pass, conditional pass, veto, or not needed
- CI status: green, red, pending, unavailable, or not applicable
- writeback status: complete, not needed, or missing
- frontier ledger status: current, not needed, or stale
- external workflow status: relevant skill used, not available, or not needed
- risk status: material risks and whether they block landing

## Required Output

- goal
- owned boundary
- context read
- promotion state
- evidence
- decision
- acceptance status
- latest verification
- latest QA judgment when applicable
- latest CI status
- document writeback status
- frontier ledger status, if applicable
- external workflow status, if applicable
- open risks
- next owner
- `writeback_needed`

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
