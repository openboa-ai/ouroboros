---
name: autokairos-wiki
description: Maintain the AutoKairos markdown system across architecture docs, product specs, active execution plans, references, and the knowledge log. Use when product-definition work, architecture decisions, runtime research, or plan progress changes what the repository should remember or how its docs tree should be organized.
---

# AutoKairos Wiki

Use this skill to keep AutoKairos as a compounding markdown system instead of a pile of stale notes.

## Goal

Update the right document layer without creating overlapping or contradictory docs.

## Docs Tree

- `ARCHITECTURE.md`
  Top-level system shape
- `docs/design-docs/`
  Stable design beliefs and technical models
- `docs/product-specs/`
  Product behavior and trading specifications
- `docs/exec-plans/active/`
  Active discovery and current plans
- `docs/exec-plans/completed/`
  Closed plans and historical decisions
- `docs/references/`
  Source-backed reference notes
- `docs/generated/`
  Generated artifacts
- `knowledge-index.md`
  Navigation layer
- `knowledge-log.md`
  Append-only chronology

## When To Use

Use this skill when:

- a product-definition conversation changes current decisions
- a runtime or architecture decision becomes stable enough to harden
- an active plan is created, updated, completed, or archived
- new external research needs to be integrated into the reference layer
- the docs tree feels duplicated, stale, or structurally confused

## Layer Rules

- Put still-moving decisions in `docs/exec-plans/active/`.
- Put stable design beliefs in `docs/design-docs/`.
- Put stable product behavior in `docs/product-specs/`.
- Put source-backed analysis in `docs/references/`.
- Put generated output in `docs/generated/`.

Do not create a second document when an existing one should be updated.

## Workflow

1. Read:
   - `knowledge-index.md`
   - `ARCHITECTURE.md`
   - `docs/index.md`
   - the most relevant file in `docs/exec-plans/active/`
   - `knowledge-log.md`
2. Decide the right destination layer.
3. Update the current active plan or discovery file first when the decision is still moving.
4. Promote only the stable part into `docs/design-docs/` or `docs/product-specs/`.
5. Update `knowledge-index.md` if navigation changed.
6. Append a concise entry to `knowledge-log.md` when repository knowledge changed materially.

## Writing Rules

- Prefer factual bullets over long prose.
- Separate:
  - current decisions
  - stable beliefs
  - open questions
- Keep links tight. Link instead of re-explaining.
- Preserve identifiers in English.
