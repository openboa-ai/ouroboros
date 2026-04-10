# AGENTS.md

This directory is the repo-local agent control layer for AutoKairos.

## Purpose

- Keep Codex-facing workflow rules out of the main product docs.
- Define which local skills should be used for recurring repository knowledge work.
- Keep selected upstream skills available locally when the repository wants to compose with them.
- Keep the `docs/` tree coherent as the source of truth.

## Read Order

1. Read [../knowledge-index.md](../knowledge-index.md).
2. Read [../ARCHITECTURE.md](../ARCHITECTURE.md).
3. Read [../docs/index.md](../docs/index.md) for the documentation tree.
4. Read [../docs/exec-plans/active/product-definition.md](../docs/exec-plans/active/product-definition.md) for the current active summary.
5. Read [../docs/exec-plans/active/discovery-log-2026-04-09.md](../docs/exec-plans/active/discovery-log-2026-04-09.md) when product-definition context matters.
6. Read the relevant local skill in `.agents/skills/` before changing knowledge workflows.
7. When a task needs generic engineering workflow guidance, read the selected upstream skills under `.agents/skills/agent-skills/`.

## Operating Rules

- Keep active discovery in `docs/exec-plans/active/` until it stabilizes.
- Do not silently overwrite discovery history with polished durable docs.
- When a session produces new durable understanding, update both:
  - `docs/exec-plans/active/product-definition.md`
  - `knowledge-log.md`
- Promote stable design beliefs into `docs/design-docs/`.
- Promote stable product behavior into `docs/product-specs/`.
- Keep live-trading execution narrow and deterministic.
- Treat `.agents/skills/` as the home for repo-local Codex skills.
- Keep upstream-derived skills under `.agents/skills/agent-skills/` and keep AutoKairos-specific rules separate.

## Local Skills

- `autokairos-wiki`
  Use when discovery, architecture, or product-spec work changes the repo's markdown system.
- `coding-harness`
  Use when doing bounded coding work inside AutoKairos and you need repo-first orientation, evidence-based completion, and stronger live-safety guardrails.

## Upstream Skill Set

- `skills/agent-skills/`
  Selected skills copied from `addyosmani/agent-skills`. Use them as generic engineering workflow companions and keep AutoKairos-specific behavior in local skills instead of mutating the upstream-derived copies unless there is a repo-specific reason.
