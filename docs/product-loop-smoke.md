# Product Loop Smoke

The smoke target proves that the doctrine is operable, not just documented:

```text
status
-> setup/provider
-> arena tick
-> leaderboard
-> select candidate
-> start paper trading
-> observe paper trading
-> evidence readback
```

This smoke is a proof-path check, not final product evaluation. Replay/backtest belongs inside
candidate creation and research preflight. The product evaluation authority is selected continuous
paper trading, where Ledger evidence accumulates over time against live public market data with
fake account and fake execution.

The automated smoke test is
`apps/runtime/test/operator-product-loop-smoke.test.tsx`. It builds the runtime in-process, connects
the `ouroboros` CLI fetch path to that runtime, runs the product loop, and renders the TUI from the
same `OperatorReadModel`.

## Acceptance

- `ouroboros status` shows the stopped arena, no selected candidate, `PaperTradingEvaluation`
  `not_started`, paper evidence `not_run`, and live authority disabled.
- The fixture provider can be set up, probed, and selected as the researcher provider.
- `ouroboros arena tick` creates multiple candidates and the leaderboard is sorted by
  `net_revenue_usdt`.
- `ouroboros candidate select <candidate-id>` makes the candidate explicit while paper trading is
  still `not_started`.
- `ouroboros candidate paper start <candidate-id>` starts selected continuous paper trading.
- `ouroboros trading-run observe <trading-run-id>` appends another paper observation while the run
  is active. It records a Ledger chain only when the TradingSystem emitted a new `OrderRequest`;
  explicit `hold` or no new decision output are valid no-order checkpoints.
- Sandbox JSONL events follow the
  [TradingSystem Paper Event Protocol](trading-system-paper-event-protocol.md). The smoke must
  prove at least one accepted `order_request` and one explicit `hold`/`no_action` readback, while
  protocol errors remain rejected without Ledger or fake account mutation.
- The running `TradingSystem` receives `TRADING_API_BASE_URL`, reads Gateway-owned paper runtime
  market/account/validation APIs when it wants context, and still emits its own JSONL events.
  The smoke must not call Binance directly from the `TradingSystem`.
- `GET /api/operator`, CLI JSON, candidate resource readback, and TUI render agree on
  `PaperTradingEvaluation`, runner active status, observation count, latest market snapshot,
  latest public execution evidence, market data mode, order book sync state, latest paper decision,
  accumulated score, and `ledger_chain_complete`.
- Live/private Binance authority stays disabled throughout the loop.

## Manual Check

When validating a local runtime manually, use the same command sequence:

```bash
ouroboros runtime serve
ouroboros status
ouroboros agent setup fixture
ouroboros agent probe fixture
ouroboros researcher provider set fixture
ouroboros arena tick
ouroboros status --json
ouroboros candidate select <candidate-id>
ouroboros candidate paper start <candidate-id>
ouroboros trading-run observe <trading-run-id>
ouroboros status
ouroboros tui
```

For automated CI, prefer the in-process runtime smoke test over a port-bound runtime server. The
smoke still exercises the replay TradingApiProvider boundary, so local sandboxed runs may need
permission to bind the provider on localhost.
