---
name: harness-skill-audit
description: "Use when auditing repo-local skills for trigger precision, overlap, context cost, workflow utility, validation coverage, generic portability, writeback behavior, or remove/merge/rewrite/rename decisions."
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

- Format: `SKILL.md` has valid YAML frontmatter with only `name` and `description`.
- Name: lowercase hyphen-case, under 64 characters, no leading/trailing hyphen, no `--`, and matches the directory.
- Description: starts with `Use when`, stays under 1024 characters, and names user intent, trigger context, and ownership boundary.
- Trigger precision: description is specific enough to load for relevant prompts and avoid near-misses.
- Overlap: no two skills own the same decision unless one is a shared protocol.
- Context cost: body is short enough, high-value, and references are loaded only when needed.
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
