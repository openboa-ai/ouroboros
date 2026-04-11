# Documentation Index

This repository keeps its markdown system centered in `docs/` and its repo-local agent rules in
`.agents/`.

## Read This First

- [../AGENTS.md](../AGENTS.md): short entry point for agents
- [../.agents/AGENTS.md](../.agents/AGENTS.md): repo-local agent workflow rules and local skills
- [../.agents/skills/coding-harness/SKILL.md](../.agents/skills/coding-harness/SKILL.md): repo-local implementation workflow skill for coding turns
- [../.agents/skills/agent-skills/incremental-implementation/SKILL.md](../.agents/skills/agent-skills/incremental-implementation/SKILL.md): upstream engineering workflow companion skills copied into the repo
- [../knowledge-index.md](../knowledge-index.md): active knowledge map and navigation
- [../ARCHITECTURE.md](../ARCHITECTURE.md): top-level system shape
- [design-docs/index.md](design-docs/index.md): stable design beliefs and technical models
- [design-docs/vocabulary.md](design-docs/vocabulary.md): canonical architecture vocabulary
- [design-docs/agent-runtime.md](design-docs/agent-runtime.md): managed-agent runtime model for orchestrator, agents, environments, sessions, and events
- [product-specs/index.md](product-specs/index.md): product behavior and trading specs
- [exec-plans/active/product-definition.md](exec-plans/active/product-definition.md): current active product-definition summary
- [exec-plans/active/coding-harness-skill-plan.md](exec-plans/active/coding-harness-skill-plan.md): plan for the repo-local coding-harness skill
- [product-specs/client-rules.md](product-specs/client-rules.md): client-side rules and service-boundary requirements
- [design-docs/client-architecture.md](design-docs/client-architecture.md): desktop app, service layer, and workspace boundary model
- [design-docs/workspace-asset-model.md](design-docs/workspace-asset-model.md): workspace asset and `strategy.json` contract
- [references/index.md](references/index.md): external source analysis and long-lived reference notes

## Structure

- `.agents/` holds repo-local agent operating rules and project-specific Codex skills.
- `.agents/skills/agent-skills/` holds the selected upstream companion skills from
  `addyosmani/agent-skills`.
- `knowledge-index.md` and `knowledge-log.md` hold the repository knowledge map and chronology.
- `docs/design-docs/` holds stable design beliefs and technical models.
- `docs/product-specs/` holds product behavior and trading specifications.
- `docs/exec-plans/` holds active and completed plans.
- `docs/references/` holds source-backed external analysis.
- `docs/generated/` holds generated artifacts.

## Working Principle

Keep `AGENTS.md` short.
Keep active discovery in `docs/exec-plans/active/`.
Keep durable design beliefs in `docs/design-docs/`.
Keep product behavior in `docs/product-specs/`.
Keep live execution narrow and self-improvement explicit.
Use the managed-agent vocabulary from `docs/design-docs/vocabulary.md`.
