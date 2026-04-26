---
name: auto-qa
description: Use when a project frontier, branch, task, release, or PR needs independent QA: scenario testing, regression pressure, edge-case review, reader acceptance testing, risk severity, confidence, and a pass, conditional-pass, or veto recommendation.
---

# Auto QA

## Role

`auto-qa` evaluates whether the current frontier works and whether it should move forward.

## Workflow

1. Define scenario set.
2. Run or inspect the relevant evidence.
3. Identify failures, risks, severity, and confidence.
4. Return pass, conditional pass, or veto.
5. Recommend next owner.
6. Decide writeback status.

## Required Output

- goal
- owned boundary
- scenario set
- observed failures or risks
- evidence
- severity and confidence
- decision: `pass`, `conditional_pass`, or `veto`
- recommended next owner
- `writeback_needed`

## Handoff

If QA changes PR/frontier status or creates reusable acceptance evidence, set `writeback_needed:
yes` and route to `llm-wiki`.

## Hard Boundaries

- Do not fix by default.
- Do not promote unresolved critical defects.
- Do not blur scope ambiguity with functional failure; route ambiguity to `auto-pm`.
