---
name: ci-recovery
description: Use when GitHub Actions, CI services, or local validation checks fail and the repository needs failing check evidence, smallest actionable root cause, bounded fix owner, scope status, and writeback status.
---

# CI Recovery

## Role

`ci-recovery` extracts actionable CI failure evidence.

## Workflow

1. Identify failing PR checks with `gh pr view` or `gh run list`.
2. Open the failing job log.
3. Extract the smallest actionable root cause.
4. Decide whether the next owner is `auto-coding`, `auto-pm`, `auto-qa`, `llm-wiki`, or user action.
5. Decide writeback status.

## Required Output

- goal
- owned boundary
- failing check name
- run URL or local command
- smallest root cause
- evidence
- decision: `fix-in-scope`, `reroute`, `blocked`, or `external-action`
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
