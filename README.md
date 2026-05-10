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

## Local Runtime Stack

The repo-owned stack files are development and validation tooling. Product state still lives in
the persisted records and Linear, not in Docker, Compose, or sandbox names.

Run the host services:

```bash
npm run dev:runtime
npm run dev:operator-web
```

Run the Compose stack:

```bash
docker compose build
docker compose up runtime operator-web
```

Prerequisites are a running Docker daemon and the Docker Compose v2 plugin.

Defaults:

- Runtime API: `http://127.0.0.1:${OUROBOROS_RUNTIME_PORT:-4173}`
- Operator web: `http://127.0.0.1:${OUROBOROS_OPERATOR_WEB_PORT:-5173}`
- Runtime container store root: `/data/ouroboros-store`
- Runtime persisted volume: `ouroboros-local_ouroboros-store`
- Compose network: `ouroboros-local_ouroboros-local`

Compose validation covers package-level checks in a clean container image:

```bash
docker compose --profile validation run --rm validation npm test
docker compose --profile validation run --rm validation npm run typecheck
docker compose --profile validation run --rm validation npm run build
```

Run `bash scripts/check-docs.sh`, `bash scripts/check-secrets.sh`, and `git diff --check` on the
host or inside a Docker Sandbox workspace with repository metadata available.

Docker Sandboxes validation runs from the repository root with the host checks above, then the
same Compose commands when the sandbox has Compose available. The only durable result to record is
the command evidence and resulting records; sandbox IDs, host paths, and local agent configuration
are not project state.

## Documentation Policy

Repo-originated durable product, architecture, source, service, or project-memory updates go to Linear. Linear content is not synced back into repo documentation. Update repo docs only when developer or agent execution would be wrong without the local hint.
