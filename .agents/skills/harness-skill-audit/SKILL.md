---
name: harness-skill-audit
description: Use when deciding whether autokairos repo-local skills should exist, be removed, be merged, rewritten, renamed, or re-routed to fit the current project harness.
---

# Harness Skill Audit

## Role

`harness-skill-audit` keeps the local skill surface small and useful.

## Use When

- Skills overlap or trigger poorly.
- A new workflow is being added to `.agents/skills/`.
- A skill may duplicate `.agents/AGENTS.md`, active wiki truth, or another skill.
- The user asks to improve project harness skills.

## Workflow

1. List existing skills and roles.
2. Compare each skill to recurring project work.
3. Find duplication, missing routing, and trigger gaps.
4. Prefer update/merge/remove over adding a new skill.
5. Route durable changes through `llm-wiki`.

## Required Output

- existing skill map
- suggested updates
- suggested removals
- suggested new skills, if any
- priority order
- `writeback_needed`

## Handoff

Skill-surface changes alter repo workflow. Default to `writeback_needed: yes`.

## Hard Boundaries

- Recommend updates before adding new skills.
- Do not create specialist skills for one-off tasks.
- Do not let skills become architecture truth.
