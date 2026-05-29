# AGENTS.md

## Canonical Sources

The GitHub repository on `main` is the source of truth for Ouroboros product, architecture,
naming, API contracts, runtime behavior, tests, validation, and agent operating policy.

Start every non-trivial task from:

1. this file, [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and `.agents/skills/AGENTS.md`
2. [Project Direction](docs/project-direction.md)
3. [Architecture Governance](docs/architecture-governance.md)
4. [API And Command Contract](docs/api-command-contract.md)
5. [Naming Taxonomy](docs/naming-taxonomy.md)
6. [LINEAR.md](LINEAR.md), only when the task needs issue workflow or Linear writeback

Linear is a workflow scratchpad and issue tracker. It can coordinate work and record progress, but
it must point back to repo truth instead of replacing it.

## CandidateArena Core Doctrine

Keep every non-trivial product, docs, source-ingestion, and implementation task tied to the core
loop:

```text
problem
-> parallel or iterative TradingSystem candidate generation
-> external Evaluation
-> leaderboard
-> findings and lineage
-> next generation
-> selected candidate continuous PaperTradingEvaluation
```

Researchers and LLM agents generate candidates; they do not grant authority. External Evaluation,
provider/risk validation, selected-candidate continuous paper `revenue - cost`, and Gateway/Ledger
evidence decide what counts. Binance public market data enters through the Gateway-owned
`MarketDataPort`, never directly through a `TradingSystem`. Failed or loss-making candidates remain
useful arena memory unless they crash, submit malformed orders, bypass provider boundaries, fail
risk validation, or attempt private/live behavior.

Treat AAR, AlphaProof Nexus, and future research references as pressure toward this candidate
population loop. If a proposed change does not strengthen CandidateArena generation, external
Evaluation, leaderboard/finding/lineage memory, or selected paper evidence, treat it as scope
expansion and reroute through Linear before implementation.

## Codex Operating Contract

This repository uses Codex features as an operating system for quality, not as a second source of
truth.

| Codex surface | Repo role |
| --- | --- |
| `AGENTS.md` | Always-on policy for source order, boundaries, naming, validation, and writeback. |
| `.agents/skills` | Bounded workflow instructions loaded only when the task matches the skill. |
| Plugins | External app, MCP, and reusable workflow bundles such as Linear, GitHub, browser, security, and OpenAI docs access. |
| Project-scoped subagents | Explicitly requested read-only exploration or review workers for parallel evidence gathering. |
| Hooks | Local pre-tool and post-tool safety checks; Git hooks and CI remain the final guard. |

Use plugins and skills to access the system that owns each workflow fact: GitHub for repo,
PR/CI/review evidence, Linear for issue workflow notes, OpenAI docs for Codex/OpenAI behavior, and
browser tooling for rendered local UI evidence. Do not replace repo truth with chat memory.

For any work that reads, creates, updates, comments on, audits, or writes back Linear issues,
projects, documents, cycles, comments, or project updates, load and follow the `linear` skill first.
Use it because Linear workflow needs explicit target issue/project/team context, read-before-write
discipline, durable identifiers, related-operation batching, and a clear summary of remaining
blockers.

The purpose of the `linear` skill is to keep issue workflow notes connected to repo truth. The
method is: recover the active issue and project context, read relevant comments/updates, decide the
exact Linear operation, execute that operation through the repo-local GraphQL path, and report the
exact Linear objects changed. Linear comments and chat memory must not become substitutes for repo
docs, code, tests, and validation.

GraphQL is the main execution path for Linear operations in this repo. The `linear` skill owns the
workflow and the `.agents/skills/linear-graphql` skill owns the repo-local execution helpers:

```bash
npm run linear:workpad -- --issue OURO-158 --body-file workpad.md
npm run linear:graphql -- --query-file query.graphql --variables-file variables.json
```

The GraphQL path reads `LINEAR_API_KEY` from the environment first, then local `.env`; never print
raw token values. Its implementation lives in `.agents/skills/linear-graphql` because it is agent
operating support, not product runtime code. If GraphQL execution fails, report the work as blocked
with the failing evidence.

Use project-scoped subagents only when the task benefits from parallel read-only work, such as
Linear context recovery, code path mapping, PR review, or UI reproduction. Subagents are advisory:
the main Codex worker remains responsible for the final patch, validation, and writeback decision.

## Repository Responsibility

The repo owns durable truth: code, tests, fixtures, local validation scripts, compact
developer-facing docs, executable agent instructions, architecture policy, naming policy, API
contracts, and review evidence.

Linear owns workflow coordination: issues, comments, scratchpads, project boards, cycles, project
updates, and handoff notes that point back to repo truth.

When the two disagree, reconcile by updating or linking back to the repo source of truth. Do not
promote Linear scratchpad text above repo code, tests, and docs.

## Agent Workflow

1. Recover the current branch, issue, dirty state, and nearest validation evidence.
2. Read this file, [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and the relevant
   docs under [docs](docs/project-direction.md).
3. Read [LINEAR.md](LINEAR.md) and active Linear issue notes only when the task needs workflow
   context or writeback.
4. Read `.agents/skills/AGENTS.md`.
5. Route work through `.agents/skills/AGENTS.md` when the task is multi-step or ambiguous.
6. Keep implementation changes bounded to the active repo issue, task, or approved plan.
7. Run the narrowest meaningful validation, then the repo's required checks.
8. Keep durable outcomes in repo code, tests, docs, and validation. Write Linear progress notes
   through the `linear` skill and repo-local GraphQL path only when issue workflow needs it.

## Skill-First Gate

Use `.agents/skills/AGENTS.md` before routing multi-step repo work. Keep `project-context`, `llm-wiki`, `writeback_needed`, `superpowers:using-superpowers`, and Skill-First Gate active.

`llm-wiki` remains the durable-writeback skill name for compatibility, but its target is now repo
docs, repo policy, or workflow notes that point back to repo truth.

Default skill routing:

| Work shape | Skill route |
| --- | --- |
| Recover branch, dirty state, PR, task, and nearest evidence | `auto-run-memory` |
| Explain current product, architecture, or repo posture | `project-context` |
| Decide the next bounded frontier or owner | `auto-project` |
| Shape a rough request into acceptance criteria | `auto-pm` |
| Implement one approved docs, code, config, or CI change | `auto-coding` |
| Review scenarios, regressions, risks, or acceptance | `auto-qa` |
| Decide PR readiness, landing, or reroute | `auto-promotion-protocol` |
| Update repo durable truth or workflow memory | `llm-wiki` |
| Design durable vocabulary or schema names | `taxonomy-design` |

When an external Superpowers skill is available, use it as process support behind the same
repo-local ownership model. Project truth comes from this repo; workflow context can come from
Linear when relevant.

## Taxonomy and Naming

For durable domain names, schema families, public/persisted keys, or naming cleanup, use `.agents/skills/taxonomy-design` before implementation.

Ouroboros taxonomy should be maintained as vocabulary guidance, not as a mechanical blocklist.
Prefer compact canonical nouns plus explicit fields for product scope, authority,
source/provenance, lifecycle, audience, and compatibility. Do not add naming/audit blockers unless
a repo issue explicitly asks for enforcement.

Canonical Ouroboros nouns for the current product surface:

| Canonical noun | Meaning |
| --- | --- |
| `CandidateArena` | Research workflow where multiple TradingSystem candidates are generated, evaluated, ranked, and selected. |
| `ResearchWorker` | Candidate generator operating within one ResearchDirection for a CandidateArena tick. |
| `ResearchDirection` | Arena research lane such as trend following, mean reversion, volatility regime, funding-aware risk, or execution-cost robustness. |
| `CandidateArenaTick` | One arena iteration that records per-direction candidate creation, failure, finding, and lineage evidence. |
| `TradingSystem` | Agent-built BTCUSDT USD-M futures trading system. |
| `SystemCode` | Executable code produced for a TradingSystem. |
| `Evaluation` | Backtest or evaluation evidence, ranked by `net_revenue_usdt` first and `net_return_pct` second. |
| `Improvement` | Compatibility/AAR lineage noun for proposal and experiment flows that predate the primary CandidateArena workflow. |
| `TradingRun` | One execution session for a TradingSystem. |
| `Sandbox` | Isolated execution boundary for a TradingRun. |
| `Gateway` | Boundary that handles OrderRequest before exchange authority. |
| `Ledger` | OrderRequest, GatewayResult, and ExecutionResult record chain. |
| `OuroborosCommand` | Product-facing command envelope shared by CLI, UI, and TUI. |
| `OperatorReadModel` | Shared operator state returned to CLI, UI, and TUI. |
| `AgentProfile` | Managed provider runtime profile, such as codex; researcher selects one available provider. |

Use the canonical nouns above for new code, tests, docs, API paths, UI labels, and persisted keys.
When a name drifts, replace it directly with the canonical term instead of adding aliases or
compatibility reads.

`npm run check:naming` is the repo-local naming quality gate. It checks public routes, UI labels,
compact docs, and canonical read-model exports. If it fails, fix the vocabulary decision instead
of widening the allowlist unless the old name is explicitly a compatibility boundary.

Use the most authoritative vocabulary source for each domain before inventing project-local terms:

1. Agent, harness, AI, model, tool, MCP, guardrail, eval, trace, workflow, and memory terms should follow OpenAI and Claude/Anthropic terminology when those products have established names. Treat frontier product language as de facto standard vocabulary before coining local synonyms.
2. Bitcoin perpetual futures and trading substrate terms should follow Binance USD-M Futures terminology for `BTCUSDT`, including account, asset, balance, position, position side, order, trade, user data stream, listenKey, margin, leverage, mark price, liquidation price, notional, `USER_DATA`, and `TRADE`.
3. Planning and execution-state terms should follow GitHub when the concept is a repository,
branch, commit, pull request, workflow, check, or review state.
4. Linear terms should be used only when the concept is a Linear issue, project, milestone, cycle,
document, comment, status update, or project update.
5. Other concepts should use conventional engineering, product, finance, and trading terms where they exist.
6. Coin an Ouroboros-specific term only when the project introduces a genuinely new concept or no standard term fits. Record that decision in repo docs and tests.

At external API, persisted-schema, fixture, or connector boundaries, preserve official spelling and casing unless a compatibility layer explicitly maps it. Internal aliases can be clearer, but they must name the source term they represent.

Project-specific taxonomy truth starts from [Naming Taxonomy](docs/naming-taxonomy.md).

## Architecture Pattern Selection

Use Hexagonal Architecture, Clean Architecture, Layered Architecture, Domain-Driven Design, and
CQRS as the default design frame for new runtime work. Apply patterns as design tools, not as
decoration:

| Pattern | Use when |
| --- | --- |
| Strategy | selecting an algorithm, scoring policy, ranking rule, or risk rule |
| Factory | choosing provider, exchange, sandbox, runner, or adapter implementation |
| Builder | assembling read models, prompt context, Ledger summaries, or command responses |
| Adapter | integrating external tools, vendor SDKs, subprocesses, stores, or exchanges |
| Decorator | wrapping a port with timeout, retry, logging, audit, metrics, or authority guards |
| Observer | reacting to application events such as tick completion or evidence recording |
| Middleware | transport or command-envelope validation, shaping, rate limits, or error mapping |
| Registry | publishing discoverable command, provider, plugin, or handler catalogs |
| Plugin | adding packaged provider/exchange/evaluator/sandbox capabilities behind descriptors |
| Dependency Injection | wiring concrete adapters into services from a composition root |

Interfaces call controllers. Controllers validate and dispatch only. Services orchestrate use cases
through domain contracts and ports. Adapters implement ports. `apps/runtime` is the HTTP composition
root, `apps/cli` is the command-line interface, `apps/operator-tui` is the Ink interface, and
`apps/operator-web` is the Web interface. Shared command/query behavior belongs in
`packages/application`; concrete Codex, Binance, Sandbox, fixture, subprocess, and other outer
system integrations belong in `packages/adapters`. UI, CLI, and TUI must use the shared Operator
read model and Ouroboros command surface, or the local Ouroboros controller for CLI-only local
operations, instead of importing runtime internals. If a new feature touches a public command,
provider, exchange, or evidence boundary, update the registry or port first and document the chosen
pattern in the PR or repo docs when it changes durable architecture.

## Validation

Before a PR is ready for merge, collect all of the following evidence unless the active issue
explicitly narrows the scope:

```bash
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

For implementation changes, also run the relevant package tests and type checks.
For PR completion, wait for GitHub CI and Codex review. If review leaves actionable comments, fix
or explicitly reroute them before merge. After merge, update Linear only when issue workflow needs a
progress note; durable truth remains in the merged repo state.
