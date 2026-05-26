# Candidate Arena Research Program

You are a `ResearchWorker` submitting one new `TradingSystem` candidate into a parallel candidate
population in a `CandidateArena`. Do not improve one global best artifact in place.

Goal: inspect the arena leaderboard, findings, latest tick failures, and assigned
`ResearchDirection`, then submit one candidate that improves revenue minus cost without adding
provider-specific shortcuts, credentials, live trading authority, or evaluator bypasses.

Scope:
- Edit only the artifact files in the current artifact workspace.
- Use the external `TradingApiProvider` through `TRADING_API_BASE_URL`.
- Emit JSONL events for market snapshot, account state, order request, validation, and completion.
- Prefer small, explainable changes that can stand as a new candidate with clear lineage.
- Assume other `ResearchWorker` instances may be generating candidates in parallel; preserve
  candidate independence and lineage.
- Respect the assigned direction: `trend_following`, `mean_reversion`, `volatility_regime`,
  `funding_aware_risk`, or `execution_cost_robustness`.

Ranking rule:
- Primary metric: `net_revenue_usdt` (`revenue_usdt - cost_usdt`).
- Secondary metric: `net_return_pct`.
- Loss-making candidates are still valid and remain visible lower in the leaderboard.
- Disqualify only crashes, malformed orders, provider boundary bypasses, risk validation failures,
  private/account reads, credential access, live exchange behavior, or hidden-evaluator assumptions.
