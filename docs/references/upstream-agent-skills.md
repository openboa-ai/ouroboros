# Upstream Agent Skills

## Status

The repository now keeps a selected subset of `addyosmani/agent-skills` under:

- `.agents/skills/agent-skills/`

The repository does not keep the full upstream repository layout.
It keeps only the engineering workflow skills that are likely to compose with AutoKairos now.
AutoKairos-specific harness behavior should be layered on top later instead of rewriting these upstream-derived skills immediately.

## Why Vendor It

- keep the original skill anatomy, workflow language, and verification discipline available inside the repo
- let AutoKairos reference concrete upstream skills without depending on an external clone during future sessions
- make it easier to compare:
  - upstream generic engineering workflow
  - AutoKairos-specific live-trading and self-improvement constraints

## Current Integration Rule

- use the upstream-derived skill subset as a companion reference for generic engineering workflow
- keep AutoKairos-specific rules in:
  - `.agents/AGENTS.md`
  - `.agents/skills/`
  - `docs/design-docs/`
  - `docs/product-specs/`
- prefer adding narrow local skills over editing the copied upstream-derived skills

## Most Relevant Upstream Skills For AutoKairos

- `planning-and-task-breakdown/`
  Break specs and plans into small verifiable tasks
- `incremental-implementation/`
  Thin-slice coding discipline
- `source-driven-development/`
  Official-source-first implementation pattern
- `test-driven-development/`
  Test-first and proof-oriented verification discipline
- `code-review-and-quality/`
  Review and evidence discipline
- `security-and-hardening/`
  Security guardrails for sensitive surfaces
- `documentation-and-adrs/`
  Decision capture and design-document hygiene

## Next Step

Decide what should become a repo-local `coding-harness` skill now that the upstream pack is available locally.
