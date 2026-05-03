# Ouroboros

Ouroboros is an automated weak-to-strong trader-system laboratory. Its first product proof is a single serious solo crypto operator evolving one agent-built `TraderSystemCandidate` into a bounded live `TraderSystemRuntime` with durable identity, evaluation, promotion, control, and audit.

## Source Of Truth

Linear is the source of truth for product, planning, project state, documentation, comments, project updates, and durable operating history.

Primary Linear surfaces:

- Project: https://linear.app/openboa/project/ouroboros-113fef53f6d1
- 00 Start Here - Ouroboros Documentation Index: https://linear.app/openboa/document/ouroboros-documentation-index-953f443725df
- 01 Product Strategy - Thesis, Market, Metrics: https://linear.app/openboa/document/ouroboros-product-strategy-0b56a519c964
- 02 MLP-01 Brief - Scope, JTBD, Cutline: https://linear.app/openboa/document/mlp-01-brief-and-cutline-b64af14949a6
- 03 MLP-01 Release Plan - Milestones and Slices: https://linear.app/openboa/document/mlp-01-release-plan-d3d83c35f208
- 04 Execution Ledger - Active Frontier and Handoff: https://linear.app/openboa/document/execution-ledger-and-active-frontier-9e036cf84011

See [LINEAR.md](LINEAR.md) for the full read order and document taxonomy.

## Repository Role

This repository owns implementation truth: code under `apps/` and `packages/`, tests, fixtures, package scripts, validation scripts, executable repo-local agent instructions under `.agents/`, and minimal developer entry points.

Long-form product, architecture, source, service, and project-memory material lives in Linear Project Documents. Do not reintroduce a parallel repo documentation tree.

## Current Technical Shape

- `apps/runtime` hosts the runtime API, candidate materialization, provider adapter seam, and local execution surfaces.
- `apps/operator-web` hosts the operator-facing web surface.
- `packages/domain` owns shared domain contracts.
- `packages/local-store` owns filesystem-backed local persistence.
- `.agents` owns reusable agent operating skills for this repo.

## Development Read Path

1. Read the active Linear issue, milestone, blockers, comments, and project updates.
2. Read [LINEAR.md](LINEAR.md) and the referenced Linear Project Documents.
3. Read [AGENTS.md](AGENTS.md) for repo-specific agent policy.
4. Read [ARCHITECTURE.md](ARCHITECTURE.md) for the compact local code map.
5. Inspect only the code and tests relevant to the current issue.

## Local Commands

```bash
npm install
bash scripts/check-docs.sh
bash scripts/check-secrets.sh
git diff --check
npm test
npm run typecheck
```

## Documentation Policy

Repo-originated durable product, architecture, source, service, or project-memory updates go to Linear. Linear content is not synced back into repo documentation. Update repo docs only when developer or agent execution would be wrong without the local hint.
