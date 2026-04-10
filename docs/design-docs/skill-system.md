# Skill System

Repo-local skills should live under `.agents/skills/`.
Upstream-derived companion skills should live under `.agents/skills/agent-skills/`.

## Principles

- create narrow skills for recurring workflows
- keep upstream-derived skills recognizable and separate from AutoKairos-local skills
- use skills to maintain repo behavior, not to store every belief about the project
- keep skill bodies concise and push detail into the docs tree only when needed
- treat wiki maintenance as a recurring workflow, not an ad hoc cleanup

## Current Local Skill

- `autokairos-wiki`
  Maintains the docs tree, active plans, and knowledge log
- `coding-harness`
  Runs bounded coding turns with repo-first orientation, evidence rules, and stronger guardrails for high-risk trading surfaces

## Current Upstream Skills

- `skills/agent-skills/`
  Selected skills copied from `addyosmani/agent-skills` and kept as the generic engineering workflow companion set
