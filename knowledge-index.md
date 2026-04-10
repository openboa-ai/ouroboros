# Knowledge Index

This repository keeps the durable markdown system centered in `docs/` and the repo-local agent rules in `.agents/`.

## Read Order

- [README.md](README.md)
  Purpose: project overview and entry point
- [ARCHITECTURE.md](ARCHITECTURE.md)
  Purpose: top-level system shape and live/research boundaries
- [.agents/AGENTS.md](.agents/AGENTS.md)
  Purpose: repo-local agent workflow rules and local skills
- [.agents/skills/coding-harness/SKILL.md](.agents/skills/coding-harness/SKILL.md)
  Purpose: repo-local coding workflow for implementation work in AutoKairos
- [.agents/skills/agent-skills/incremental-implementation/SKILL.md](.agents/skills/agent-skills/incremental-implementation/SKILL.md)
  Purpose: selected upstream engineering workflow skills copied into the repo
- [docs/index.md](docs/index.md)
  Purpose: canonical documentation tree
- [docs/exec-plans/active/product-definition.md](docs/exec-plans/active/product-definition.md)
  Purpose: current active product-definition summary
- [docs/exec-plans/active/discovery-log-2026-04-09.md](docs/exec-plans/active/discovery-log-2026-04-09.md)
  Purpose: ongoing discovery trail for the current session
- [docs/exec-plans/active/coding-harness-skill-plan.md](docs/exec-plans/active/coding-harness-skill-plan.md)
  Purpose: plan for a repo-local coding-harness skill based on OpenAI harness ideas
- [knowledge-log.md](knowledge-log.md)
  Purpose: chronology of repository knowledge updates

## Knowledge Layers

- `.agents/`
  Repo-local agent rules and project-specific Codex skills
- `.agents/skills/coding-harness/`
  Repo-local coding workflow skill for bounded implementation turns
- `.agents/skills/agent-skills/`
  Selected upstream `agent-skills` workflows copied into the repo for generic engineering guidance
- `docs/`
  Canonical docs plus active execution plans

## Docs Tree

- `docs/design-docs/`
  Stable beliefs, runtime model, provider model, and skill-system rules
- `docs/product-specs/`
  Product behavior and trading-mode specs
- `docs/exec-plans/active/`
  Current plans and active discovery
- `docs/exec-plans/completed/`
  Historical plans that are no longer active
- `docs/references/`
  External source analysis and long-lived reference notes
- `docs/generated/`
  Generated artifacts that should stay in the repo

## Current Focus

- Preserve the current Binance Futures product-definition session without losing question-by-question decisions.
- Keep the selected upstream `agent-skills` subset stable while deciding how much AutoKairos should adapt locally.
- Keep unstable discovery in `docs/exec-plans/active/` until the product shape is stable enough to harden.
- Keep durable design beliefs in `docs/design-docs/` and product behavior in `docs/product-specs/`.
- Build out the first desktop app scaffold around `Tauri 2 + React + Vite + Tailwind`.
- Keep the official client behind a service layer while the workspace asset contract hardens.
