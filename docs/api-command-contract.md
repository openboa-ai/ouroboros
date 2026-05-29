# API And Command Contract

The primary operator contract is shared by CLI, TUI, Web UI, and runtime HTTP:

- `GET /api/operator`
- `POST /api/commands`

Mutation aliases are not product API. Product-facing actions use the command contract.
Commands are operator controls over the doctrine, not provider commands.

## Command Authority

`packages/domain` owns the canonical command catalog through `OuroborosCommand`,
`OuroborosCommandKind`, and `OUROBOROS_COMMAND_REGISTRY`. UI, CLI, TUI, and route code must not
invent mutation names outside that registry.

`OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS` marks the subset that CLI, TUI, and Web UI must keep as one
operator loop. See [Interface Parity](interface-parity.md) for the shared UX contract and the CLI
local controller exception for managed agent setup/login/probe.

Current command groups:

- `arena`: status, start, stop, tick. `arena.tick` is one research round: candidate generation,
  research-time replay/backtest preflight, leaderboard update, findings, and lineage. It is not
  continuous paper trading and must not be treated as final evaluation authority.
- `candidate`: select, run candidate evaluation, run candidate replay, and compatibility paper
  evidence readback. `candidate.select` chooses one candidate for proof; primary paper evaluation
  starts through `trading_run.start`.
- `trading_run`: start, observe, stop paper trading runs through command dispatch. Product
  evaluation authority belongs here: selected candidates must accumulate continuous paper trading
  `revenue - cost` over time before their performance counts as product evidence.
  `trading_run.start` starts or resumes the selected `TradingSystem` in paper mode.
  `trading_run.observe` is a checkpoint/readback over that running system: refresh the latest market
  snapshot, consume newly emitted `OrderRequest`s, run Gateway validation and fake paper execution
  when orders exist, record no-order continuity when none exist, then update score and evidence.
  Fake execution is stateful: open orders, partial fills, canceled orders, account equity, position,
  PnL, fees, slippage, funding, public execution stream marker, and processed TradingSystem event
  ids must be exposed as readback state. Market fills require routed public `/public` `bookTicker`
  or `/market` `aggTrade` evidence and must remain retryable if that evidence is unavailable.
  Routed WebSocket evidence is primary; REST provides snapshot, backfill, fallback, and local order
  book recovery. The readback must show source priority, freshness, WebSocket connection state, REST
  fallback, gap detection, latest update id, and order book sync state when present.
  It must not force a trade decision just because a snapshot was read.
- `run_control`: record lifecycle control decisions and audit evidence.
- `trading_substrate`: record private-readiness posture without enabling private/live authority.
- `sandbox`: start or stop sandbox execution through command dispatch.
- `agent_provider`: managed provider status, setup, login start, probe
- `researcher`: researcher provider selection

## Read Model Authority

`OperatorReadModel` is the shared operator state for all user surfaces. It must show the
CandidateArena status, leaderboard, selected candidate, `PaperTradingEvaluation`, paper evidence
readback, runner active status, interval, next observation time, latest market snapshot, latest
public execution snapshot, market data mode, local order book sync state, fake paper account, open
orders, latest fill, latest paper failure, agent/provider status, latest ticks, latest candidates,
latest command results, and latest TradingSystem paper decision when one has been emitted, and
authority flags.

Read models are projections. They must not trigger candidate generation, paper evidence, provider
login, or exchange behavior.

Candidate, Paper Evidence, Paper Trading, and Live are separate states in every operator surface.
Replay/backtest is a research tool, not final evaluation authority. `trading_run.start`,
`trading_run.observe`, and `trading_run.stop` operate the selected candidate's continuous paper
trading evaluation through the Gateway and `MarketDataPort`. The TradingSystem owns decision
cadence; paper evidence is Ledger readback, not live promotion.

## Resource Reads

Resource controllers are read-only projections. They expose detail screens and developer evidence
without creating candidates, paper evidence, provider login, sandbox mutation, or exchange behavior.

Canonical resource reads:

- `GET /api/candidates`
- `GET /api/candidates/:candidate_id`
- `GET /api/candidates/:candidate_id/evaluations`
- `GET /api/evaluations/:evaluation_id`
- `GET /api/candidates/:candidate_id/replay-runs`
- `GET /api/replay-runs/:run_id`
- `GET /api/replay-runs/:run_id/validation-state`
- `GET /api/replay-runs/:run_id/comparison`
- `GET /api/trading-runs/:trading_run_id`
- `GET /api/sandboxes`
- `GET /api/sandboxes/:sandbox_id`
- `GET /api/sandboxes/:sandbox_id/logs`
- `GET /api/gateway/environment`
- `GET /api/trading-substrate/order-fill/latest`
- `GET /api/trading-substrate/public-market/latest`
- `GET /api/trading-substrate/private-readiness/latest`
- `GET /api/trading-substrate/private-readiness-posture/latest`
- `GET /api/trading-substrate/account-position-risk/latest`

## Removed Routes

Removed primary routes such as `/api/candidate-arena*`, `/api/trading-systems/*`,
`/api/candidate-generation-runs`, and `/api/candidate-materialization-attempts` are not product
contracts. Repo-owned interfaces must use mutations through `/api/commands` and reads through the
resource controllers above.

The product-facing command name is `ouroboros`. Adapter names such as Codex, fixture, Binance, or
future Claude Code remain provider settings or implementation details unless the domain registry
explicitly exposes them.
