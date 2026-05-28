# Product Loop Smoke

The smoke target proves that the doctrine is operable, not just documented:

```text
status
-> setup/provider
-> arena tick
-> leaderboard
-> select candidate
-> run paper evidence
-> evidence readback
```

The automated smoke test is
`apps/runtime/test/operator-product-loop-smoke.test.tsx`. It builds the runtime in-process, connects
the `ouroboros` CLI fetch path to that runtime, runs the product loop, and renders the TUI from the
same `OperatorReadModel`.

## Acceptance

- `ouroboros status` shows the stopped arena, no selected candidate, paper evidence `not_run`, and
  live authority disabled.
- The fixture provider can be set up, probed, and selected as the researcher provider.
- `ouroboros arena tick` creates multiple candidates and the leaderboard is sorted by
  `net_revenue_usdt`.
- `ouroboros candidate select <candidate-id>` makes the candidate explicit while paper evidence is
  still `not_run`.
- `ouroboros candidate evidence run <candidate-id>` records selected paper Gateway/Ledger evidence.
- `GET /api/operator`, CLI JSON, candidate resource readback, and TUI render agree on
  `ledger_chain_complete`.
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
ouroboros candidate evidence run <candidate-id>
ouroboros status
ouroboros tui
```

For automated CI, prefer the in-process runtime smoke test over a port-bound runtime server. The
smoke still exercises the replay TradingApiProvider boundary, so local sandboxed runs may need
permission to bind the provider on localhost.
