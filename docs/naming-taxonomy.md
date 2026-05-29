# Naming Taxonomy

Ouroboros names must keep product scope, authority, source/provenance, lifecycle, audience, and
compatibility separate. Prefer compact canonical nouns plus explicit fields instead of long names
that pack every axis into one identifier.

## Canonical Nouns

| Canonical noun | Meaning |
| --- | --- |
| `CandidateArena` | Research workflow where multiple TradingSystem candidates are generated, evaluated, ranked, and selected. |
| `ResearchWorker` | Candidate generator operating within one ResearchDirection for a CandidateArena tick. |
| `ResearchDirection` | Arena research lane such as trend following, mean reversion, volatility regime, funding-aware risk, or execution-cost robustness. |
| `CandidateArenaTick` | One arena iteration that records per-direction candidate creation, failure, finding, and lineage evidence. |
| `TradingSystem` | Executable BTCUSDT USD-M futures candidate system; it may include code, rules, model calls, tools, or an internal agent runtime. |
| `SystemCode` | Code packaging and verification surface for a TradingSystem, not the limit of what the system can do. |
| `ResearchPreflight` | Replay, backtest, or simulation used during candidate creation; useful evidence, not final product authority. |
| `PaperTradingEvaluation` | Continuous selected-candidate paper TradingRun evidence ranked by accumulated `revenue - cost`. |
| `TradingSystemDecision` | Per-observation `OrderRequest` or `hold` emitted by a selected TradingSystem after it receives a market snapshot. |
| `Evaluation` | Generic evidence noun; qualify it as ResearchPreflight or PaperTradingEvaluation when authority matters. |
| `Finding` | Research observation from a candidate, failed direction, negative result, or paper evidence summary. |
| `Lineage` | Parent, direction, evaluation, finding, and evidence chain that explains why a candidate exists. |
| `PaperEvidence` | Selected-candidate proof from the paper TradingRun, Gateway, and Ledger path. |
| `Improvement` | Compatibility/AAR lineage noun for proposal and experiment flows that predate CandidateArena. |
| `TradingRun` | One execution session for a TradingSystem. |
| `Sandbox` | Isolated execution boundary for a TradingRun. |
| `Gateway` | Boundary that handles OrderRequest before exchange authority. |
| `MarketDataPort` | Gateway-owned public market data boundary; Binance is one adapter behind this port. |
| `Ledger` | OrderRequest, GatewayResult, and ExecutionResult record chain. |
| `OuroborosCommand` | Product-facing command envelope shared by CLI, UI, and TUI. |
| `OperatorReadModel` | Shared operator state returned to CLI, UI, and TUI. |
| `AgentProfile` | Managed provider runtime profile, such as codex; researcher selects one available provider. |

Use these nouns for new code, tests, docs, API paths, UI labels, and persisted keys. If a name
drifts, replace it with the canonical term instead of adding a new alias, unless the old name is an
explicit compatibility boundary.

## Vocabulary Sources

Use the most authoritative vocabulary source for each domain:

1. OpenAI, Anthropic, and established agent-tool vocabulary for agent, model, tool, MCP, guardrail,
   eval, trace, workflow, and memory terms.
2. Binance USD-M Futures vocabulary for BTCUSDT perpetual futures terms, including account, asset,
   balance, position, order, trade, user data stream, listenKey, margin, leverage, mark price,
   liquidation price, notional, `USER_DATA`, and `TRADE`.
3. GitHub vocabulary for repository, branch, commit, pull request, check, workflow, and review
   state.
4. Linear vocabulary only when the concept is actually a Linear issue, project, milestone, cycle,
   document, comment, or status update.
5. Conventional engineering, product, finance, and trading terms before coining project-local terms.

Coin an Ouroboros-specific term only when the project introduces a genuinely new concept or no
standard term fits. Record that decision in repo docs and tests.

## Naming Rules

- Preserve external API, protocol, fixture, and persisted-schema spelling unless a compatibility
  layer explicitly maps it.
- Do not expose provider commands as product commands. Use `ouroboros` commands and provider
  selection fields.
- Do not call candidate output proof. ResearchPreflight is not final authority; selected continuous
  PaperTradingEvaluation and Ledger evidence are proof.
- Do not imply TradingSystem is only code. It may include an internal agent runtime, but it must
  emit bounded validated OrderRequests.
- Do not reuse old sandbox output as a fresh paper decision. Each paper observation needs current
  market input and a new TradingSystemDecision.
- Do not attach Binance directly to TradingSystem. Public market data goes through Gateway
  `MarketDataPort`; private/live Binance authority remains outside the product loop.
- Do not use compatibility nouns such as `Improvement` to name new CandidateArena primary workflow.
- Do not widen `scripts/check-naming-surface.mjs` allowlists to avoid a vocabulary decision.
