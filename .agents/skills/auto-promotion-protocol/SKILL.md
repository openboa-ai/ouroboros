---
name: auto-promotion-protocol
description: "Use when deciding whether a frontier, branch, task, release, or PR is ready for final signoff, ready to land, still looping, rerouted, or discarded based on acceptance, verification, QA, CI, and writeback evidence."
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
- PR review status: current-head feedback handled, current-head no-suggestion signal, pending, unavailable, or not applicable
- writeback status: complete, not needed, or missing
- frontier ledger status: current, not needed, or stale
- external workflow status: relevant skill used, not available, or not needed
- risk status: material risks and whether they block landing

## PR Review Freshness Gate

For PR-backed work, promotion evidence must be tied to the current PR head, not merely to PR
existence. Treat review status as `pending` until the current head has one of these signals:

- a completed reviewer comment pass whose actionable threads have been handled or intentionally
  routed with evidence
- a no-suggestion signal from the configured reviewer
- an explicit human handoff because review infrastructure is unavailable

Do not use a newly opened PR by itself as promotion evidence. If review status is pending, choose
`looping` or `reroute` and keep the work owner in the active execution loop rather than moving the
frontier to final signoff.

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
- latest PR review status when applicable
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
