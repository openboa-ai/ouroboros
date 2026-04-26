---
name: auto-eval-rubrics
description: Shared scoring rubric for autokairos project workers. Use when judging PM clarity, coding quality, QA outcomes, wiki writeback, CI recovery, or keep/discard decisions.
---

# Auto Eval Rubrics

## Role

`auto-eval-rubrics` provides common pass/fail language.

## Axes

- PM: goal, boundary, non-goals, acceptance, validation, next owner
- Coding: correctness, runtime health, CI health, complexity delta, boundary safety
- QA: scenario coverage, regression pressure, edge-case exposure, severity clarity
- Wiki: durable truth, minimal duplication, link health, active/historical separation
- CI recovery: smallest root cause, reproducibility, bounded fix owner

## Stop Language

Use one of:

- `pass`
- `conditional_pass`
- `fail`
- `veto`
- `reroute`

## Hard Boundaries

- Do not score without evidence.
- Do not hide uncertain confidence.
- Reroute when the best next step is outside the current worker boundary.
