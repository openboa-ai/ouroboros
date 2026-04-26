---
name: auto-eval-rubrics
description: Use when judging PM clarity, coding quality, QA outcomes, wiki writeback, CI recovery, promotion readiness, or keep/discard decisions with shared pass/fail language.
---

# Auto Eval Rubrics

## Role

`auto-eval-rubrics` gives workers shared judgment language.

## Use When

- A worker needs a consistent pass/fail/veto standard.
- A frontier is being promoted, rerouted, or discarded.
- Evidence quality is unclear.

## Workflow

1. Identify the worker surface being judged.
2. Compare evidence to the relevant axes.
3. Return one stop language value.
4. State confidence and missing evidence.

## Required Output

- judged surface
- evidence used
- stop language
- confidence
- missing evidence
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
