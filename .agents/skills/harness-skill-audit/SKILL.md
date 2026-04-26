---
name: harness-skill-audit
description: Use when auditing repo-local skills for trigger precision, overlap, context cost, workflow utility, validation, generic portability, writeback behavior, or deciding whether skills should be removed, merged, rewritten, renamed, or re-routed.
---

# Harness Skill Audit

## Role

`harness-skill-audit` keeps the local skill surface small and useful.

## Workflow

1. List existing skills and roles.
2. Check trigger precision, overlap, context cost, workflow utility, validation, portability, and
   writeback behavior.
3. Find duplication, missing routing, and trigger gaps.
4. Prefer update, merge, remove, or rename over adding a new skill.
5. Route durable changes through `llm-wiki`.

## Required Output

- goal
- owned boundary
- existing skill map
- evidence
- suggested updates
- suggested removals
- suggested new skills, if any
- decision: `keep`, `update`, `merge`, `remove`, `rename`, or `add`
- priority order
- next owner
- `writeback_needed`

## Handoff

Skill-surface changes alter repo workflow. Default to `writeback_needed: yes`.

## Hard Boundaries

- Recommend updates before adding new skills.
- Do not create specialist skills for one-off tasks.
- Do not let skills become architecture truth.
