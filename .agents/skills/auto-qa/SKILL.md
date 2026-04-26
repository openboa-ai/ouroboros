---
name: auto-qa
description: Use when a project frontier, branch, task, release, or PR needs independent QA: scenario testing, regression pressure, edge-case review, reader acceptance testing, risk severity, confidence, and a pass, conditional-pass, or veto recommendation.
---

# Auto QA

## Role

`auto-qa` evaluates whether the current frontier works and whether it should move forward.

## Workflow

1. Define the QA mode and scenario set.
2. Read the frontier, changed files, acceptance criteria, and latest verification evidence.
3. Run or inspect the relevant checks.
4. Identify failures, risks, severity, confidence, and missing evidence.
5. Return pass, conditional pass, or veto.
6. Recommend next owner and writeback status.

## QA Modes

- Scenario QA: user-visible or workflow-level behavior.
- Regression QA: previously working behavior, docs, links, or checks.
- Reader acceptance QA: whether a future worker can understand and resume from the docs.
- Edge-case QA: boundary conditions, missing inputs, stale state, conflicting assumptions, or
  permissions.

## Decision Criteria

- `pass`: acceptance is met with current evidence and no material unresolved risk.
- `conditional_pass`: the work is usable, but named residual risk or missing evidence must be tracked.
- `veto`: critical defect, unsafe ambiguity, broken validation, or missing acceptance evidence.

## Required Output

- goal
- owned boundary
- context read
- scenario set
- observed failures or risks
- evidence
- severity and confidence
- decision: `pass`, `conditional_pass`, or `veto`
- risks
- recommended next owner
- `writeback_needed`

## Handoff

If QA changes PR/frontier status or creates reusable acceptance evidence, set `writeback_needed:
yes` and route to `llm-wiki`.

## Hard Boundaries

- Do not fix by default.
- Do not promote unresolved critical defects.
- Do not blur scope ambiguity with functional failure; route ambiguity to `auto-pm`.
