---
name: ci-recovery
description: GitHub Actions recovery utility for autokairos. Use when PR checks fail and the next step is to inspect run logs, identify the smallest actionable cause, and route a bounded fix.
---

# CI Recovery

## Role

`ci-recovery` extracts actionable CI failure evidence.

## Workflow

1. Identify failing PR checks with `gh pr view` or `gh run list`.
2. Open the failing job log.
3. Extract the smallest actionable root cause.
4. Decide whether the next owner is `auto-coding`, `auto-pm`, `auto-qa`, or external/user action.

## Required Output

- failing check name
- run URL
- smallest root cause
- recommended next owner
- whether the fix is inside current PR scope

## Hard Boundaries

- Inspect CI; do not replace the PR loop.
- Do not patch broad unrelated failures.
- If failure requires secrets or permissions unavailable locally, report that blocker directly.
