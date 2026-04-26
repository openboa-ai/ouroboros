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

## Audit Checklist

- Trigger precision: description clearly says when the skill should load.
- Overlap: no two skills own the same decision unless one is a shared protocol.
- Context cost: body is short enough and references are loaded only when needed.
- Workflow utility: steps tell the worker what to read, decide, do, and output.
- Validation: skill names evidence or checks needed to keep a result.
- Portability: skill is generic and reads repo truth instead of embedding domain truth.
- Writeback behavior: durable outcomes route to `llm-wiki`.

## Actions

- `keep`: skill is clear, bounded, and useful.
- `update`: skill is right but needs better trigger, workflow, or output contract.
- `merge`: two skills overlap enough that one should absorb the other.
- `remove`: skill is unused, duplicative, or too narrow.
- `rename`: name no longer matches the trigger or role.
- `add`: only when no existing skill can reasonably own the repeated workflow.

## Required Output

- goal
- owned boundary
- context read
- existing skill map
- evidence
- suggested updates
- suggested removals
- suggested new skills, if any
- decision: `keep`, `update`, `merge`, `remove`, `rename`, or `add`
- priority order
- risks
- next owner
- `writeback_needed`

## Handoff

Skill-surface changes alter repo workflow. Default to `writeback_needed: yes`.

## Hard Boundaries

- Recommend updates before adding new skills.
- Do not create specialist skills for one-off tasks.
- Do not let skills become architecture truth.
