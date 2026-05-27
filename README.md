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

- `apps/runtime`: Fastify composition root and HTTP route/controller registration.
- `apps/cli`: `ouroboros` command-line interface over the shared command/read contracts.
- `apps/operator-tui`: Ink action console over the shared Operator read model and command endpoint.
- `apps/operator-web`: operator UI over the shared Operator read model and Ouroboros command endpoint.
- `packages/domain`: shared domain contracts, including the Operator command descriptors used by CLI, TUI, and Web UI.
- `packages/application`: command controllers, application services, Candidate Arena use cases, read-model builders, and ports.
- `packages/adapters`: Codex, fixture, Binance public market, Sandbox, and other concrete adapter implementations.
- `packages/local-store`: filesystem-backed local store primitives.
- `.agents`: repo-local skills and agent operating support.

Architecture quality is enforced as a product constraint. New runtime work should follow
Hexagonal/Clean/Layered Architecture, DDD vocabulary, and CQRS command/read separation. Use
Strategy, Factory, Builder, Adapter, Decorator, Observer, Middleware, Registry, Plugin, and
Dependency Injection only at the extension point they solve; see [ARCHITECTURE.md](ARCHITECTURE.md)
for the decision matrix.

## Primary Commands

Run local services:

```bash
npm install
ouroboros runtime serve
npm run dev:operator-web
```

Operate the product loop through the Ouroboros command surface:

```bash
ouroboros arena status
ouroboros arena tick
ouroboros arena start
ouroboros arena stop
ouroboros candidate select <candidate-id>
ouroboros candidate evidence run <candidate-id>
ouroboros agent setup codex
ouroboros agent login codex
ouroboros agent probe codex
ouroboros researcher provider set codex
ouroboros tui
```

The CLI, Operator UI, and Ink TUI all read `GET /api/operator` and mutate through
`POST /api/commands`. Adapter names such as Codex are internal provider settings on managed
`AgentProfile` records. The agent setup surface is provider-scoped, and the researcher selects one
available provider from that managed set; product-facing commands stay under the `ouroboros` noun.

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
npm run check:architecture
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
