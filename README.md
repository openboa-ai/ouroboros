# Ouroboros

[![CI](https://github.com/openboa-ai/ouroboros/actions/workflows/ci.yml/badge.svg)](https://github.com/openboa-ai/ouroboros/actions/workflows/ci.yml)

**Ouroboros is a weak-to-strong research system for turning advances in frontier agents into cumulative, externally verified progress—tested first in trading.**

[Thesis](#the-thesis) · [Why trading](#why-trading) · [How it works](#how-ouroboros-compounds-progress) · [What is built](#built-today--still-to-prove) · [Quickstart](#quickstart) · [Architecture](#product-and-architecture) · [Development](#operate-and-develop)

Generation is improving faster than trustworthy selection: an agent can propose many plausible systems, but it should not decide which deserve trust or more authority. Ouroboros keeps those roles separate. Agents generate candidates; frozen artifacts are evaluated outside their generator; admitted, rejected, invalid, and duplicate outcomes become bounded memory for the next generation. Trading is the first test domain, not the thesis.

## The thesis

**Ouroboros turns better external agents into a testable research loop instead of trying to rebuild those agents.** It does not build foundation models, a general coding agent, or a generic agent harness. Its work is the domain and evidence layer: define a hard problem, bound a worker's tools and workspace, preserve artifacts and evidence, and decide what later authority the evidence supports.

Today, Codex is the only current non-fixture provider path. Claude Code and future frontier agents are intended sources of external intelligence, not claimed current integrations. That boundary matters: improving intelligence supply can widen candidate generation, but it must not let a generator grade itself, choose its own evidence, or grant itself trading authority.

For the detailed product thesis and authority model, see [Project Direction](docs/project-direction.md), [Ouroboros Doctrine](docs/ouroboros-doctrine.md), and the [Autonomy Model](docs/autonomy-model.md).

## Why trading

**Trading pressure-tests the method because markets are competitive, noisy, non-stationary, and costly to act in.** A candidate must survive changing regimes and observable fees, funding, slippage, and risk; an attractive backtest or self-report is not enough.

The concrete question is deliberately narrower than a profitability promise:

> Can an AI research system repeatedly find a TradingSystem that improves on its current champion with prospective paper evidence—after costs and risk—without weakening evaluation rules?

Admitted TradingSystems rank by accumulated `revenue - cost` only within comparable cohorts. Advancement separately requires a qualified prospective comparison against the exact current champion; raw PnL alone is insufficient.

The current boundary is `BTCUSDT` USD-M futures paper trading over Binance public market data. Accounts, execution, and Ledgers are fake. Ouroboros does not claim stock support, private exchange access, signed requests, live orders, proven profitability, completed generalization, or completed weak-to-strong success.

## How Ouroboros compounds progress

**The loop converts externally checked outcomes into a more informed next generation, rather than treating a model response as proof.**

```text
improving frontier agents
        -> diverse candidate systems
        -> external evaluation
        -> bounded paper evidence
        -> findings and lineage
        -> better-informed next generation
```

Here, "external evaluation" means evaluator-owned evaluation outside the generating session, not a claim that a third party grades the candidate. Released, sanitized context—such as Arena paper results, traces, failures, Findings, lineage, and bounded population-diversity summaries—can inform later generations; raw sealed data stays withheld. The short names below describe the product roles; the detailed evidence graph remains in the maintained protocols.

| Role | Plain-language responsibility |
| --- | --- |
| Research | Gives bounded agent sessions directions, tools, and workspaces; freezes immutable submissions, carries them through evaluator-owned admission, and retains findings, lineage, and sanitized inputs. |
| Arena | Runs admitted TradingSystems in isolated paper sessions and records comparable paper performance, lifecycle, trace, failure, and recovery evidence. |
| Gateway | Owns public market-data access, order validation, and fake paper execution instead of letting a TradingSystem reach an exchange directly. |
| Ledger | Records the append-only evidence needed to inspect paper decisions, costs, risk, and outcomes. |

[CandidateArena And Research Goal](docs/candidate-arena-research-goal.md) explains the research boundary. [Research And Arena Product Loop](docs/research-arena-product-loop.md) explains the operator loop, and [API And Command Contract](docs/api-command-contract.md) defines the shared command/read surface.

The repository's canonical product vocabulary is `Candidate Arena -> Trading System -> System Code -> research preflight -> selected Paper Trading -> Gateway -> Ledger`.

## Built today / Still to prove

**The implementation establishes evidence controls and paper operation; it does not establish the economic result those controls are meant to test.**

| Built today | Still to prove |
| --- | --- |
| Codex-first bounded research-worker sessions, with bounded tools, workspaces, and explicit submissions | Economic frontier improvement from better agents |
| External admission and paper-handoff conformance for frozen candidate artifacts | A causal agent-leverage effect rather than correlation or one-off success |
| Isolated `BTCUSDT` paper operation over public Binance data, with fake accounts and execution | Long-horizon, real-market generalization |
| Recorded fees, funding, slippage, risk, Gateway provenance, and Ledger evidence | Production-duration autonomous operation and complete runtime-soak evidence |
| Shared Desktop, CLI, TUI, and browser-development operator surfaces; Research and Arena remain separate views, while persisted operational detail is currently an Arena surface | Multi-host operation, private exchange access, and live authority |
| Paper-only safety: researchers do not grade themselves, and paper evidence is not live promotion | Profitability or a completed weak-to-strong result |

Replay and backtests are useful research tools, not final authority. Continuous comparable paper evidence gathers proof; it does not unlock private access or live trading. The exact product and architecture boundaries are maintained in [Research And Arena Product Loop](docs/research-arena-product-loop.md) and [Architecture](ARCHITECTURE.md).

## Quickstart

**Start with the native Desktop app; use the CLI when you need a headless surface.**

Prerequisites:

- Node.js and npm. CI currently uses Node 24; `package.json` does not declare a hard engine minimum.
- Python 3.11 or later for contributor validation (`tomllib`); CI uses Python 3.12.
- `gitleaks` for contributor secret scanning.
- Rust and Cargo for native Tauri Desktop development.
- Linux Desktop development also requires the `glib-2.0`, `gtk+-3.0`, and `webkit2gtk-4.1` pkg-config modules; distribution package names vary.
- macOS for the packaged/open/verify Desktop release path. The source-checkout Desktop development command is still the primary interactive path.

Install dependencies and open the source-checkout Desktop app:

```bash
npm install
npm run dev:operator-desktop
```

The Desktop app launches or reuses the local runtime. In another terminal, inspect that runtime and its operator state:

```bash
curl -fsS http://127.0.0.1:4173/health
./bin/ouroboros status
```

For headless operation, use two terminals. In Terminal 1, start the runtime:

```bash
./bin/ouroboros runtime serve
```

In Terminal 2, use the repository-local CLI:

```bash
./bin/ouroboros arena status
```

`./bin/ouroboros` is the source-checkout CLI entry point; `npm install` does not install a global `ouroboros` binary. The Web app is a Vite-only browser development surface: start it only when a Desktop app or runtime is already running. It is not the primary operator app:

```bash
npm run dev:operator-web
```

The full generated-candidate research and paper loop has additional prerequisites: a configured Codex CLI and Docker Sandboxes `sbx` version 0.35.0 or later. Set up, log in to, probe, and select Codex with the source-checkout CLI:

```bash
./bin/ouroboros agent setup codex
./bin/ouroboros agent login codex
./bin/ouroboros agent probe codex
./bin/ouroboros researcher provider set codex
```

Those prerequisites are not required merely to open the Desktop app or inspect its local runtime.

For the native launch, packaged macOS path, and release verification, see [Operator Desktop Performance And Release](docs/operator-desktop-performance-release.md).

## Product and architecture

**Ouroboros is one product loop with several shared operator surfaces, not separate trading products.** The Desktop app is the primary interactive operator surface; CLI remains the complete baseline for headless operation and automation. Desktop, CLI, TUI, and Web share the same runtime/store-backed session data and product command/read contract; Web remains a browser development surface with no separate authority.

| Path | Purpose |
| --- | --- |
| `apps/runtime` | Local runtime and shared operator API. |
| `apps/operator-desktop` | Primary Tauri Desktop operator application. |
| `apps/operator-web` | Shared browser/development UI source. |
| `apps/cli` and `apps/operator-tui` | Headless and terminal operator surfaces. |
| `packages/domain` | Shared domain contracts and command descriptors. |
| `packages/application` | Use cases, controllers, read models, and ports. |
| `packages/adapters` | Boundary adapters, including Codex, Binance public data, fixtures, and sandbox integration. |
| `packages/local-store` | Filesystem-backed persistence primitives. |

The architecture keeps candidate generation, evaluation, public-market access, and authority separate. Read [Architecture](ARCHITECTURE.md), [Architecture Governance](docs/architecture-governance.md), and [Naming Taxonomy](docs/naming-taxonomy.md) before changing those contracts.

## Operate and develop

**Use the same command contract for Desktop, CLI, TUI, and Web, and verify documentation changes before sharing them.**

Common source-checkout commands:

```bash
# Inspect the Arena through a running local runtime; run arena start only after provider setup.
./bin/ouroboros status
./bin/ouroboros arena start
./bin/ouroboros arena stop
./bin/ouroboros tui

# Build, open, and verify the local macOS Desktop bundle.
npm run package:operator-desktop
npm run open:operator-desktop
npm run verify:operator-desktop-release
```

Run the repository guards for a README or other documentation change:

```bash
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

Runbooks for Docker Sandboxes `sbx`/`sdx`, S5 audits, recovery helpers, fixture compatibility, and
full-cycle research are developer/detail surfaces. Use the relevant npm script `--help` output and
Linear workflow notes when that work is explicitly in scope.

For implementation changes, add the relevant tests and run `npm test`, `npm run typecheck`, and `npm run build`. The [Development Workflow](docs/development-workflow.md) describes the repository delivery boundary; [API And Command Contract](docs/api-command-contract.md) lists the product commands and their authority.

## Canonical documentation

**The linked repository documents are the durable source of truth; this README is the first-reader map.**

- [Project Direction](docs/project-direction.md)
- [Ouroboros Doctrine](docs/ouroboros-doctrine.md)
- [CandidateArena And Research Goal](docs/candidate-arena-research-goal.md)
- [Research And Arena Product Loop](docs/research-arena-product-loop.md)
- [Autonomy Model](docs/autonomy-model.md)
- [Architecture](ARCHITECTURE.md)
- [API And Command Contract](docs/api-command-contract.md)
- [Development Workflow](docs/development-workflow.md)

## Contributing and license

**Contribution guidance and licensing terms are not yet published.**
