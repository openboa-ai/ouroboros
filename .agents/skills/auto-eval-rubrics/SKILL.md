---
name: auto-eval-rubrics
description: Use when a worker needs shared pass/fail language for PM clarity, coding quality, QA outcomes, wiki writeback, CI recovery, promotion readiness, evidence confidence, or keep/discard/reroute decisions.
---

# Auto Eval Rubrics

## Role

`auto-eval-rubrics` gives workers shared judgment language.

## Workflow

1. Identify the worker surface being judged.
2. Compare evidence to the relevant axes.
3. Return one stop language value.
4. State confidence and missing evidence.

## Rubric Table

| Surface | Pass | Conditional pass | Fail | Veto | Reroute |
| --- | --- | --- | --- | --- | --- |
| PM | Goal, boundary, non-goals, acceptance, validation, and owner are clear | Minor unresolved risk is named | Missing acceptance or validation | Conflicting scope would cause harmful work | Needs context, research, QA, or cleanup first |
| Coding | Bounded change meets acceptance and checks | Works with named residual risk | Does not meet acceptance | Breaks critical behavior or safety boundary | Root cause outside owned boundary |
| QA | Scenarios cover material risk | Usable with tracked gaps | Evidence is insufficient | Critical defect or unsafe ambiguity | Needs PM, coding, CI, or wiki owner |
| Wiki | Durable truth is minimal, linked, and current | Small navigation or wording gap remains | Writeback incomplete | Active truth is contradictory | Needs source/context or cleanup first |
| CI | Root cause and fix path are clear | Repro or permission gap is explicit | Failure remains unexplained | Red check blocks promotion | Needs different owner or external action |
| Promotion | Acceptance, validation, QA, CI, and writeback are current | Ready except named non-blocker | Important gate is stale | Critical gate failed | Needs bounded loop or owner change |

## Evidence Rules

- Evidence may be command output, diff, source citation, active doc, test result, CI run, review note,
  or reproducible observation.
- Confidence must reflect evidence freshness and directness.
- Missing evidence is not neutral; it usually produces `conditional_pass`, `fail`, or `reroute`.

## Required Output

- goal
- owned boundary
- context read
- judged surface
- evidence used
- decision: one stop language value
- confidence
- missing evidence
- risks
- next owner
- `writeback_needed`

## Axes

- PM: goal, boundary, non-goals, acceptance, validation, next owner
- Coding: correctness, CI health, complexity delta, boundary safety
- QA: scenario coverage, regression pressure, edge-case exposure, severity clarity
- Wiki: durable truth, minimal duplication, link health, active/historical separation
- CI recovery: smallest root cause, reproducibility, bounded fix owner

## Stop Language

Use exactly one of: `pass`, `conditional_pass`, `fail`, `veto`, `reroute`.

## Handoff

If the judgment changes a durable PR/frontier status, set `writeback_needed: yes` and route to
`llm-wiki`.

## Hard Boundaries

- Do not score without evidence.
- Do not hide uncertain confidence.
- Reroute when the best next step is outside the current worker boundary.
