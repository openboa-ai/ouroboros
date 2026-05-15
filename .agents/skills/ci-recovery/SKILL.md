---
name: ci-recovery
description: "Use when local validation, GitHub Actions, or CI services fail and the repo needs exact failing evidence, smallest actionable root cause, bounded fix owner, scope status, and writeback status."
---

# CI Recovery

## Role

`ci-recovery` extracts actionable CI failure evidence.

## Workflow

1. Identify failing local command, check suite, run, job, and commit.
2. Open the smallest relevant log, not the whole run by default.
3. Extract the first actionable root cause and distinguish it from downstream noise.
4. Classify whether the fix is inside the current owned boundary.
5. Decide whether the next owner is `auto-coding`, `auto-pm`, `auto-qa`, `llm-wiki`, or user action.
6. Decide writeback status.

## Triage Procedure

- Confirm the failure reproduces or is tied to a specific remote run.
- Capture failing check name, command, job URL when available, and exact error excerpt.
- Identify the smallest file, config, dependency, permission, or environment cause.
- Mark unrelated or flaky failures explicitly instead of folding them into the current work.
- If the failure mode is reusable, route the lesson to `llm-wiki` after the fix decision.

## Decision Criteria

- `fix-in-scope`: root cause is inside the current frontier and a bounded patch can address it.
- `reroute`: root cause belongs to a different worker or scope.
- `blocked`: logs, permissions, secrets, or environment are unavailable.
- `external-action`: user, host platform, account, or third-party service must act.

## Required Output

- goal
- owned boundary
- context read
- failing check name
- run URL or local command
- smallest root cause
- evidence
- decision: `fix-in-scope`, `reroute`, `blocked`, or `external-action`
- risks
- recommended next owner
- whether the fix is inside current PR scope
- `writeback_needed`

## Handoff

If the failure mode or recovery decision affects future PR work, set `writeback_needed: yes` and
route to `llm-wiki` after the fix or blocker is clear.

## Hard Boundaries

- Inspect CI; do not replace the PR loop.
- Do not patch broad unrelated failures.
- If failure requires unavailable secrets or permissions, report that blocker directly.
