# Project Direction

Ouroboros is an automated weak-to-strong trading-system laboratory. It connects improving AI agents
to a hard, dynamic trading problem where `revenue - cost` is observable but noisy, path-dependent,
and non-stationary. The product center is the `CandidateArena`: researchers generate parallel
TradingSystem candidates, research-time replay/backtest helps create and preflight them, findings
and lineage feed the next generation, and only selected candidates can move into continuous paper
trading `Gateway` and `Ledger` evidence.

Trading must be made outcome-gradable under a precommitted evaluation protocol. Raw PnL alone is
not a stable answer because candidate identity, market opportunity, costs, risk, evidence purpose,
and the prospective window determine what the result can prove.

Read [Ouroboros Doctrine](ouroboros-doctrine.md) for the full product thesis.
Read [CandidateArena And Research Goal](candidate-arena-research-goal.md) for the long-running North
Star, completion rubric, veto gates, and implementation priorities. Read
[CandidateArena Evaluation Protocol](candidate-arena-evaluation-protocol.md) for the P0 target
contract that separates adaptive research feedback from prospective qualification evidence.
Read [Autonomy Model](autonomy-model.md) for the detailed boundary between autonomous research,
selected paper evaluation, paper qualification, Trading review promotion, and future live authority.
Read [Product Quality Design](product-quality-design.md) for the product-quality contract that
turns that direction into review-packet, UX, eval, and implementation-frontier detail.

Two names keep the evaluation boundary stable: `ResearchPreflight` is replay, backtest, or
simulation inside candidate creation; `PaperTradingEvaluation` is selected-candidate continuous
paper trading over live public market data.

## Source Of Truth

The GitHub repository on `main` is the source of truth for Ouroboros. Code, tests, validation
scripts, root documentation, `docs/`, and `.agents` instructions define the durable product,
architecture, naming, and operating contract.

Linear is a workflow tool for issues, comments, scratchpads, project coordination, and historical
progress notes. Linear can point back to repo truth, but it does not replace the repo as the final
authority.

## Core Loop

```text
parallel TradingSystem candidates
-> research-time replay/backtest preflight
-> leaderboard
-> findings and lineage
-> next generation
-> selected candidate continuous paper trading evaluation
-> PaperTradingEvaluation board
```

Researchers and LLM agents generate candidates; they do not grant authority. Replay/backtest is a
research tool, not final evaluation authority. It can help researchers create, compare, and reject
ideas before a candidate enters paper, but it must not become the product leaderboard authority for
living agent-based systems.

Continuous paper trading is the evaluation authority. Selected candidates run against live public
market data through the Gateway-owned `MarketDataPort`, fake account, fake executor, and Ledger.
Binance attaches behind the Gateway market data boundary, not inside a `TradingSystem`. WebSocket
is the primary live public evidence path; REST remains the cold-start snapshot, backfill, recovery,
and sanity-check anchor. Each observation records the market snapshot, execution evidence, order
book sync state, and fallback status it used. Operator surfaces expose the latest market data mode
with the continuous paper score.

The paper engine is a real paper trading engine, not a single dry-run receipt. It keeps fake wallet
balance, equity, available balance, margin reserved, net BTCUSDT position, average entry price,
realized/unrealized PnL, open orders, partial fills, canceled orders, fees, slippage, funding, and
Ledger references. Market fills require public execution evidence (routed `/public` `bookTicker`
for market orders, routed `/market` `aggTrade` for limit order matching). Local order book state is
consistency evidence built from REST `depth` snapshot plus routed `/public` WebSocket `depth@100ms`
`U/u/pu` continuity. Mark price can update valuation; it cannot create a fill by itself.

The CandidateArena leaderboard is research preflight, not final product authority. The
`PaperTradingEvaluation` board is the product authority surface: it ranks selected candidates by
accumulated paper `net_revenue_usdt`, uses `net_return_pct` as the secondary rank, keeps negative
paper candidates visible, and exposes qualification separately from rank. Qualification answers
whether the paper evidence window is mature enough to trust: minimum observation count, elapsed
time, runner health when known, failed-observation ratio, market snapshot availability, and public
execution evidence for fills. A candidate can lead the board by paper `net_revenue_usdt` while
still being `collecting_evidence` or `blocked_by_quality`. That board is also compacted into the
next researcher context so new candidates are generated from paper evidence, not replay scores
alone. The compaction carries paper blockers, remediation guidance, and lineage/finding summaries
under read-only authority so ResearchWorkers can respond to what paper evidence actually showed.
`TradingReviewPacket.lineage.paper_board_learning` uses the same compact rank, score,
qualification, blocker, failure, and next-research-focus summary so operator review and next
generation context do not drift.
Researcher context must not pretend to know in-memory runner state when it cannot see the active
runner; running paper evidence remains running evidence, not an automatic `needs_resume` claim.

TradingSystem owns its decision cadence. The selected `TradingSystem` may decide on timers, market
events, news or social inputs, tool calls, internal agent loops, or risk gates.
Ouroboros may inject `TRADING_API_BASE_URL` so the running system can read paper market snapshots,
fake account state, and order validation through the Gateway-owned runtime API. That is the only
supported paper context path for a TradingSystem; it must not attach to Binance, credentials,
private account state, or order submission directly.
`trading_run.observe` is not a command to force a trade decision; it is a checkpoint/readback over
the running paper session. If the `TradingSystem` has emitted a new bounded `OrderRequest`, the
Gateway validates it and fake executes it into Ledger evidence. If it emitted nothing, the
observation records a valid no-order checkpoint and preserves score continuity. Accumulated
`revenue - cost`, risk behavior, and Ledger evidence decide what counts. Loss-making candidates
remain useful arena memory unless they crash, submit malformed orders, bypass provider boundaries,
fail risk validation, or attempt private/live behavior.

AI agents improve over time. Codex, Claude Code, Gemini-powered agents, and future providers should
plug into the same loop as replaceable research labor rather than changing the product doctrine.
The stable contract is candidate generation, research-time preflight, findings/lineage memory, and
selected continuous paper trading evidence.

Ouroboros should become autonomous by automating the loop below the authority boundary, not by
letting generated systems approve themselves. CandidateArena can run research, selected
PaperTradingEvaluation can collect proof, and PaperTradingQualification can block weak evidence.
Trading review promotion remains an operator or explicit-policy decision, and live/private exchange
authority remains outside MLP-01.

TradingSystem may include an internal agent runtime, model calls, tools, deterministic code, rules,
and execution logic. TradingSystem may include an internal agent runtime, and it owns when to emit
`OrderRequest`s. Researcher cannot grade, candidate cannot grade itself, and Gateway binding
changes, TradingSystem identity does not. Candidate, Paper Evidence, and Live are separate states.

## Product Boundary

MLP-01 is paper-only. Paper execution reads Binance production public market data only through
`MarketDataPort` while using a fake account, fake executor, and fake Ledger. Live trading, private
account reads, signed exchange requests, listenKey or user-data streams, leverage or margin
mutation, and live orders remain disabled until a future repo issue explicitly enables that
authority. In short: Live trading, private account reads, and signed requests stay outside this
frontier.

## Non-Goals

- Do not move back to improving one best artifact in place.
- Do not treat provider output, generated comments, or candidate self-report as proof.
- Do not add new strategy families just to make the leaderboard look richer.
- Do not expose fixture, full-cycle, or replay-only controls as the primary product workflow.
- Do not enable live/private Binance authority in CandidateArena work.
