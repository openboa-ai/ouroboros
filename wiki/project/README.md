# Project Work Ledger

This directory records current project execution state.

It is not product strategy, architecture, or source synthesis. It is the operational layer that lets
`auto-project` resume work, pick the next PR-sized frontier, and hand off to the right owner without
using chat history as memory.

## Read Order

1. [frontier-ledger.md](frontier-ledger.md)
2. [../product/mlp-01/07-implementation-plan.md](../product/mlp-01/07-implementation-plan.md)
3. [../product/mlp-01/08-greenfield-bootstrap-plan.md](../product/mlp-01/08-greenfield-bootstrap-plan.md)
4. [../architecture/05-bootstrap-tech-spec.md](../architecture/05-bootstrap-tech-spec.md)

## Rules

- One active frontier owns the next PR-sized work item.
- Completed, merged, blocked, or discarded frontier state must be written back here.
- Product and architecture truth stay in their own wiki sections; this ledger points to them.
- If this ledger conflicts with maintained product or architecture docs, fix the conflict before
  implementation continues.
- `knowledge-log.md` records important chronology; this directory records resumable execution state.
