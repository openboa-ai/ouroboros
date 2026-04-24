# Repo Local Agents

This repository is currently design-first.

## Rules

- Treat [README.md](../README.md) as the top-level thesis.
- Treat [knowledge-index.md](../knowledge-index.md) as the navigation layer.
- Treat [knowledge-log.md](../knowledge-log.md) as the append-only chronology.
- Treat [wiki/index.md](../wiki/index.md) as the internal wiki root.
- Treat [wiki/product/README.md](../wiki/product/README.md) as the canonical product workspace.
- Treat [wiki/product/mlp-01/07-implementation-plan.md](../wiki/product/mlp-01/07-implementation-plan.md) as the canonical implementation entry point once PRDs and architecture are locked.
- Treat [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](../wiki/product/mlp-01/08-greenfield-bootstrap-plan.md) as the canonical code-substrate planning page while the repo remains in docs-only reset posture.
- Treat [wiki/architecture/06-runtime-provider-adapter-feasibility.md](../wiki/architecture/06-runtime-provider-adapter-feasibility.md) as mandatory before implementing real Codex, Claude, OpenClaw/ACP, or A2A runtime provider execution.
- Treat [wiki/architecture/07-production-design-method.md](../wiki/architecture/07-production-design-method.md) as the production-level design bar before deepening or implementing Bootstrap, PR1, PR2, PR3, or PR4.
- Treat [wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md](../wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md),
  [wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md](../wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md),
  [wiki/architecture/03-pr3-bounded-live-trading-system-pod-design.md](../wiki/architecture/03-pr3-bounded-live-trading-system-pod-design.md), and
  [wiki/architecture/04-pr4-live-pod-remains-controllable-design.md](../wiki/architecture/04-pr4-live-pod-remains-controllable-design.md)
  as the canonical slice-level implementation-shape pages before touching code for each slice.
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
- PR2 evidence and live-gate meaning boundary
- PR3 governed live execution boundary
- PR4 wake/control/audit boundary
- greenfield bootstrap substrate beneath PR1
- `AgentRuntimeUnit` and A2A-compatible communication seams for future multi-agent pod shapes
- concrete runtime-provider adapter surfaces, starting with `codex_cli` rather than vague provider
  labels

UI remains out of scope unless explicitly brought back later.
