---
name: harness-skill-audit
description: Audit autokairos repo-local skills. Use when deciding which skills should exist, be removed, be merged, or be rewritten to fit the current project harness.
---

# Harness Skill Audit

## Role

`harness-skill-audit` keeps the local skill surface small and useful.

## Audit Questions

- Is this a recurring workflow or just a topic?
- Does an existing skill already cover it?
- Does the skill improve routing, evidence, or resumability?
- Does it duplicate `.agents/AGENTS.md` or active wiki truth?
- Is the description precise enough to trigger only when useful?

## Required Output

- existing skills
- suggested updates
- suggested removals
- suggested new skills
- priority order

## Hard Boundaries

- Recommend updates before adding new skills.
- Do not create specialist skills for one-off tasks.
- Do not let skills become architecture truth.
