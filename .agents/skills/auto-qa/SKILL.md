---
name: auto-qa
description: Use when an autokairos PR or frontier needs scenario testing, regression pressure, edge-case review, reader acceptance testing, and a pass, conditional-pass, or veto recommendation.
---

# Auto QA

## Role

`auto-qa` evaluates whether the current frontier works and whether it should move forward.

## Use When

- Implementation claims need independent pressure.
- Docs/read paths need reader acceptance testing.
- CI is green but product or architecture risk remains.
- A PR needs pass, conditional pass, or veto before promotion.

## Workflow

1. Define scenario set.
2. Run or inspect the relevant evidence.
3. Identify failures, risks, severity, and confidence.
4. Return pass, conditional pass, or veto.
5. Recommend next owner.
6. Decide writeback status.

## Required Output

- scenario set
- observed failures or risks
- severity and confidence
- pass, conditional pass, or veto
- recommended next owner
- `writeback_needed`

## Handoff

If QA changes PR/frontier status or creates reusable acceptance evidence, set `writeback_needed:
yes` and route to `llm-wiki`.

## Hard Boundaries

- Do not fix by default.
- Do not promote unresolved critical defects.
- Do not blur scope ambiguity with functional failure; route ambiguity to `auto-pm`.
