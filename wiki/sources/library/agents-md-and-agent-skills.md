# AGENTS.md And Agent Skills

## Source

- [AGENTS.md](https://agents.md/)
- [Agent Skills overview](https://agentskills.io/home)
- [Agent Skills specification](https://agentskills.io/specification)
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)
- [Agent Skills optimizing descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)
- [Agent Skills evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)
- [Agent Skills using scripts](https://agentskills.io/skill-creation/using-scripts)

## What This Source Is

These sources define two complementary layers for coding-agent repositories:

- `AGENTS.md` is a predictable, Markdown-based instruction file for repo-wide or subtree-specific
  agent guidance.
- Agent Skills are portable folders with `SKILL.md` frontmatter and instructions that agents load
  on demand through progressive disclosure.

## Core Thesis

Repo guidance should be split by loading frequency:

- Always-on rules belong in `AGENTS.md`.
- Recurring but conditional workflows belong in skills.
- Detailed references, scripts, and assets belong behind skill-level progressive disclosure.

This prevents agent instructions from becoming either too sparse to help or too large to use.

## Key Mechanisms / Architecture

- `AGENTS.md` acts as an agent-facing README: setup, tests, style, security, PR conventions, and
  project-specific gotchas.
- Nested `AGENTS.md` files can specialize instructions by subtree. The closest file should win
  where tools support that behavior.
- A skill is a directory containing `SKILL.md` with at least `name` and `description` frontmatter.
- Skills support optional `scripts/`, `references/`, and `assets/` directories.
- Agents first see only skill metadata, then load the full `SKILL.md` only when the task matches,
  then load references/scripts/assets only when needed.
- Skill descriptions carry most trigger responsibility, so they should use intent-focused "Use when"
  language.
- Effective skills are concise, grounded in real project expertise, provide defaults rather than
  menus, and include validation loops for fragile work.

## Important Passages Or Facts

- AGENTS.md is intended to complement README files with detailed agent-specific instructions that
  would clutter human-facing docs.
- Common AGENTS.md sections include project overview, setup/build/test commands, style guidelines,
  testing instructions, and security considerations.
- Agent Skills require `name` and `description`; `name` should match the parent directory and use
  lowercase alphanumeric characters plus hyphens.
- Progressive disclosure has three stages: discovery by metadata, activation by `SKILL.md`, and
  execution through optional resources.
- Skill best practices emphasize real task extraction, project-specific context, concise procedures,
  coherent units, defaults, gotchas, templates, and validation loops.
- Scripts are useful when a repeated or fragile command is easier to run deterministically than to
  rewrite from instructions.

## Vocabulary And Mental Models

- `AGENTS.md`: always-on repo or subtree operating instructions.
- `SKILL.md`: conditional task capability with metadata and procedure.
- progressive disclosure: load minimal metadata first, detailed instructions only when relevant.
- skill description: trigger surface that decides whether the skill is loaded.
- references: optional skill-specific material loaded on demand.
- scripts: optional deterministic helpers bundled with a skill.

## Transferable Lessons

- autokairos should keep root `AGENTS.md` small and use it as an entrypoint, not an encyclopedia.
- `.agents/AGENTS.md` should hold always-on project operating rules.
- `.agents/skills/AGENTS.md` should route skills by workflow phase and ownership.
- Individual skills should stay small, triggerable, and bounded to one recurring job.
- `llm-wiki` should be the durable writeback gate because repo decisions must survive beyond chat
  history.
- Skill descriptions should begin with "Use when..." and describe user intent, not internal
  implementation.
- Validation commands belong in always-on instructions and reusable skill workflows.

## Non-transferable Baggage

- Agent Skills do not define autokairos product runtime capabilities.
- Repo-local skills are not `CapabilityPackage` artifacts and should not be confused with
  trader-system packages.
- AGENTS.md should not replace active architecture specs or source synthesis pages.
- Skill scripts should not be added unless repeated execution or fragility justifies them.

## Open Questions / Tensions

- How much workflow policy should live in `.agents/AGENTS.md` versus the skill registry?
- When a skill changes durable repo truth, how much should be logged in `knowledge-log.md` versus a
  future PR/run note?
- How aggressively should CI enforce skill trigger/routing conventions without making skill
  iteration cumbersome?
