# Repo Local Agents

This repository is currently design-first.

## Rules

- Treat [README.md](../README.md) as the top-level thesis.
- Treat [knowledge-index.md](../knowledge-index.md) as the navigation layer.
- Treat [knowledge-log.md](../knowledge-log.md) as the append-only chronology.
- Treat [wiki/index.md](../wiki/index.md) as the internal wiki root.
- Treat [wiki/product/README.md](../wiki/product/README.md) as the canonical product workspace.
- Treat [wiki/product/mlp-01/07-implementation-plan.md](../wiki/product/mlp-01/07-implementation-plan.md) as the canonical implementation entry point once PRDs and architecture are locked.
- Treat [wiki/architecture/01-pr1-path-becomes-real-design.md](../wiki/architecture/01-pr1-path-becomes-real-design.md) as the canonical PR1 implementation-shape page before touching Slice 1 code.
- Treat [wiki/architecture/README.md](../wiki/architecture/README.md) as the canonical technical design workspace downstream of product truth.
- Treat old subsystem-level implementation-plan pages as background unless a newer doc explicitly promotes them back to the active baseline.
- Treat [wiki/architecture/foundation/02-documentation-doctrine.md](../wiki/architecture/foundation/02-documentation-doctrine.md) as the rule for what counts as a real design doc.
- Treat [wiki/architecture/adrs/README.md](../wiki/architecture/adrs/README.md) as the rule for major architectural decisions.
- Treat [wiki/sources/README.md](../wiki/sources/README.md) as the raw-source layer rule.
- Treat [docs/README.md](../docs/README.md) as reserved future space for external service documentation rather than the current internal design wiki.
- Prefer updating the product docs first, then the architecture docs, over inventing chat-only answers when the result has durable value.
- Keep major design decisions in ADRs instead of burying them in README or section prose.
- Use repo-local skills under `.agents/skills/` when they match the task.

## Current Focus

- AutoKairos core architecture
- PR1 candidate materialization boundary
- staged evaluation
- persistent agent model
- external evaluation and governed promotion

UI remains out of scope unless explicitly brought back later.
