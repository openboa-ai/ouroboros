---
name: ci-recovery
description: Use when GitHub Actions or local checks fail and a repository needs failing check evidence, smallest root cause, bounded fix owner, and writeback status.
---

# CI Recovery

## Role

`ci-recovery` extracts actionable CI failure evidence.

## Use When

- A PR check is failing.
- A local validation command fails and the next owner is unclear.
- CI evidence must be summarized without broadening the PR.

## Workflow

1. Identify failing PR checks with `gh pr view` or `gh run list`.
2. Open the failing job log.
3. Extract the smallest actionable root cause.
4. Decide whether the next owner is `auto-coding`, `auto-pm`, `auto-qa`, `llm-wiki`, or user action.
5. Decide writeback status.

## Required Output

- failing check name
- run URL or local command
- smallest root cause
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
