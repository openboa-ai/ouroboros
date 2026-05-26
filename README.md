# Ouroboros

Ouroboros is an automated weak-to-strong trading-system laboratory. Its core product is a
`CandidateArena`: researchers generate many `TradingSystem` candidates in parallel or across
iterations, external `Evaluation` ranks them by revenue minus cost, and only a selected candidate
can move into paper `Gateway` and `Ledger` evidence.

## Core Doctrine

The researcher is a candidate generator, not the authority.

```text
problem
-> parallel or iterative candidate generation
-> external Evaluation
-> leaderboard
-> findings and lineage
-> next generation
-> selected candidate paper evidence
```

The authority boundary is outside the candidate. A candidate is accepted or rejected by external
Evaluation, provider/risk validation, and paper-only Gateway/Ledger evidence after selection.
Failures and losing candidates remain useful arena memory unless they crash, submit malformed
orders, bypass provider boundaries, fail risk validation, or attempt private/live behavior.

## Source Of Truth

Linear owns product truth, planning, Project Documents, comments, project updates, and durable
operating history. The repo owns implementation truth: code, tests, fixtures, validation scripts,
package scripts, compact developer entry points, and repo-local agent instructions.

Primary Linear surfaces:

- Project: https://linear.app/openboa/project/ouroboros-113fef53f6d1
- 00 Start Here - Ouroboros Documentation Index: https://linear.app/openboa/document/00-start-here-ouroboros-documentation-index-953f443725df
- 35 Source Synthesis - Runtime, Evaluation, Product Postures: https://linear.app/openboa/document/35-source-synthesis-runtime-evaluation-product-postures-fd857d802e22
- 38 Source Addendum - AlphaProof Nexus and Candidate Arena References: https://linear.app/openboa/document/38-source-addendum-alphaproof-nexus-and-candidate-arena-references-fa78e56e2ad2

See [LINEAR.md](LINEAR.md) for the full document map.

## Canonical Flow

Use the same nouns in code, API, UI, issues, and compact docs:

```text
Candidate Arena -> Trading System -> System Code -> Evaluation -> selected Trading Run -> Sandbox -> Gateway -> Ledger
```

`OrderRequest`, `GatewayResult`, and `ExecutionResult` are the Ledger chain. `Improvement`,
full-cycle research, fixtures, Docker Sandboxes, Compose, host paths, and compatibility scripts are
developer/detail surfaces. They must not replace the primary Candidate Arena workflow.

## Repository Shape

- `apps/runtime`: runtime API, Candidate Arena runner, candidate materialization, provider adapter seam, selected paper execution, and local persistence.
- `apps/operator-web`: operator UI for Candidate Arena state, leaderboard, selected candidate detail, and selected-candidate paper evidence.
- `packages/domain`: shared domain contracts.
- `packages/local-store`: filesystem-backed local store primitives.
- `.agents`: repo-local skills and agent operating support.

## Primary Commands

Run local services:

```bash
npm install
npm run dev:runtime
npm run dev:operator-web
```

Operate the Candidate Arena:

```bash
npm run trading:arena -- status
npm run trading:arena -- tick
npm run trading:arena -- start
npm run trading:arena -- stop
```

Use Linear GraphQL for mandatory Linear writeback:

```bash
npm run linear:graphql -- --query-file query.graphql --variables-file variables.json
npm run linear:workpad -- --issue OURO-158 --body-file workpad.md
```

Both commands read `LINEAR_API_KEY` from the environment first, then local `.env`, and never print
the token. Their implementation lives under [.agents/skills/linear-graphql](.agents/skills/linear-graphql/SKILL.md)
because Linear access is agent operating support, not product runtime code.

## Product Boundary

MLP-01 is paper-only. Paper uses Binance production public market data with a fake account, fake
executor, and fake Ledger. Live trading, private account reads, signed exchange requests,
listenKey/user-data streams, leverage or margin mutation, and live orders remain disabled until a
bounded Linear issue explicitly owns that authority step.

## Validation

Before a PR is ready:

```bash
bash scripts/check-docs.sh
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

For implementation changes, also run the relevant tests plus:

```bash
npm test
npm run typecheck --workspaces --if-present
npm run build
```

Runbooks for Docker Sandboxes `sbx`/`sdx`, S5 audits, recovery helpers, fixture compatibility, and
full-cycle research are developer/detail surfaces. Use the relevant npm script `--help` output and
Linear service docs when that work is explicitly in scope.
