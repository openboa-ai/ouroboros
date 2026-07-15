---
name: auto-pm
description: "Use when a rough request, blocked branch, ambiguous design/code task, or drifting work item needs one bounded frontier with goal, non-goals, acceptance, validation, owner, and writeback expectations."
---

# Auto PM

## Role

`auto-pm` turns ambiguous work into one bounded frontier.

## Workflow

1. Load `auto-handoff-protocol` and recover the incoming canonical Frontier Packet when one exists.
2. Recover current truth from repo docs, issue state, and branch state; reconcile it into the
   packet.
3. State the one-sentence goal and define the owned boundary, non-goals, and dependencies.
4. Define observable acceptance and validation evidence in the packet.
5. Confirm whether the frontier is `repo`, `linear_only`, or `not_executable`; do not plan
   implementation for a tracking parent.
6. Assign the next owner and set the packet decision to `ready`, `blocked`, or `reroute`.
7. Decide whether the resulting plan needs `llm-wiki` writeback and name the project ledger target
   when frontier state changes.

## Ready Criteria

- The owned boundary names files, modules, docs, config, or checks that are in scope.
- Non-goals explicitly block tempting adjacent work.
- Acceptance criteria are observable from tests, checks, docs, review, or CI.
- Validation can run locally or be verified by a named external check.
- The next owner can act without asking what the frontier means.
- If an external planning or brainstorming skill was used, the resulting plan is translated into
  repo-local files, validation commands, and writeback targets.

## Reroute Criteria

- The request changes durable repo truth before source/context is read.
- The task needs research before implementation.
- The requested boundary conflicts with existing active docs.
- Validation is impossible or permission-bound.
- The task is actually QA, CI recovery, cleanup, or writeback.

## Required Output

- every canonical Frontier Packet field from `auto-handoff-protocol`
- planning extension: `ledger_update_target`

Use the packet's `decision` for `ready`, `blocked`, or `reroute`. Do not return a PM-specific
frontier schema or aliases for canonical scope, acceptance, validation, risk, or owner fields.

## Handoff

If the frontier changes product truth, architecture, delivery sequence, or work item meaning, set
`writeback_needed: yes` and route durable summary to `llm-wiki`.

## Hard Boundaries

- Do not implement.
- Do not widen locked scope silently.
- Do not leave conflicting scope statements unresolved.
- Do not promote a plan that lacks validation criteria.
