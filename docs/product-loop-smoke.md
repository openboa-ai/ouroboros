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
-> PaperTradingEvaluation board
```

This smoke is a proof-path check, not final product evaluation. Replay/backtest belongs inside
candidate creation and research preflight. The product evaluation authority is selected continuous
paper trading, where Ledger evidence accumulates over time against live public market data with
fake account and fake execution.

The automated smoke test is
`apps/runtime/test/operator-product-loop-smoke.test.tsx`. It builds the runtime in-process, connects
the `ouroboros` CLI fetch path to that runtime, runs the product loop, and renders the TUI from the
same `OperatorReadModel`.

The reference paper soak test is
`apps/runtime/test/reference-paper-soak-trading-system.test.ts`. It registers the repo-owned
`fixtures/trading-systems/reference_paper_soak.py` SystemCode as a selected candidate, starts
continuous paper trading, lets the running system emit its own order/hold/cancel cadence through
`TRADING_API_BASE_URL`, and proves fake fill, position, PnL, Ledger, stop, and operator readback
accumulate across observations.

The arena paper context test is
`apps/runtime/test/candidate-arena-paper-context.test.ts`. It proves selected-candidate paper
evidence is not only operator readback: latest paper score, market snapshot, public execution
evidence, account/fill state, failures, and Ledger summary are compacted into the next
CandidateArena researcher context, even before that candidate appears in the replay leaderboard.
It also proves the compact paper board enters the next researcher context so future candidates can
learn from top, negative, failed, and resume-needed paper evaluations.
The runtime product-loop smoke also proves the repeating autonomous runner uses a started
`PaperTradingEvaluation` leader as the next tick's source candidate and records the next generated
TradingSystem lineage to that paper-backed source.

## Acceptance

- `ouroboros status` shows the stopped arena, no selected candidate, `PaperTradingEvaluation`
  `not_started`, paper evidence `not_run`, and live authority disabled.
- The fixture provider can be set up, probed, and selected as the researcher provider.
- `ouroboros arena start` starts the repeating autonomous paper loop: generated candidates are
  selected per tick and moved into selected continuous Paper Trading Evaluation through
  `trading_run.start` until `ouroboros arena stop`.
- After `arena.start` starts a selected `PaperTradingEvaluation`, the paper runner continues
  scheduled observations without a manual `trading_run.observe`, recording no-order continuity when
  the running `TradingSystem` has emitted no new decision.
- Runtime restart preserves the last successful `arena.start` intent: when no later successful
  `arena.stop` exists, startup resumes the autonomous arena loop from the persisted command ledger
  without recording a synthetic operator command.
- `ouroboros arena tick` creates multiple candidates and the leaderboard is sorted by
  `net_revenue_usdt`.
- `ouroboros arena cycle` runs one research tick, selects the highest-ranked candidate created by
  that tick, and starts or resumes its selected continuous Paper Trading Evaluation through the
  same `trading_run.start` command path.
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
- The reference paper soak must prove that a selected `TradingSystem` can run as a long-lived
  process, emit multiple paper events on its own cadence, and be observed without the Gateway
  inventing decisions from refreshed snapshots.
- CandidateArena researcher context must include latest selected paper evidence: paper score,
  observation count, market snapshot, public execution evidence, fake account/fill state, failures,
  and Ledger summary. This keeps the next candidate generation grounded in paper results instead of
  replay-only leaderboard data.
- Failed paper evidence in CandidateArena researcher context must include both raw failure reason
  and classified `PaperTradingFailure` kind, summary, and next action so the next `ResearchWorker`
  can repair protocol, market, runner, Ledger, or authority-boundary failures without treating the
  classification as promotion authority.
- CandidateArena researcher context must include the compact paper board with qualification
  reasons, grouped blocker severity, trend, blocker density, and next action, so paper evidence
  changes the next candidate generation instead of staying only in the operator surface.
- CandidateArena latest ticks and next researcher context must include `ResearchEfficiency`
  summaries: provider requests, runner commands, scenario count, elapsed milliseconds, and
  `not_promotion_authority`.
- CLI, TUI, and Web UI must render latest CandidateArena tick direction status, generated count,
  failed count, and any `ResearchEfficiency` summary without treating it as promotion authority.
- `GET /api/operator` must include `paper_trading_board`, ranked by selected-candidate continuous
  paper `net_revenue_usdt`; negative paper candidates remain visible below profitable candidates.
- `paper_trading_board` entries must expose qualification status, reasons, evidence window,
  trend, blocker density, runner state, and market/fill quality so ranking by paper score is not
  confused with readiness.
- `GET /api/operator`, CLI JSON, candidate resource readback, and TUI render agree on
  `PaperTradingEvaluation`, `PaperTradingEvaluation` board, runner active status, observation count, latest market snapshot,
  latest public execution evidence, market data mode, order book sync state, latest paper decision,
  accumulated score, classified paper failure with raw reason, and `ledger_chain_complete`.
- Runtime restart smoke must keep persisted paper evidence visible while making scheduler loss
  explicit: `running` evaluation plus inactive in-memory runner is `needs resume`, and `trading_run.start`
  resumes the session instead of creating duplicate runners.
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
ouroboros arena cycle
ouroboros status --json
npm run package:operator-desktop
npm run open:operator-desktop
npm run verify:operator-desktop-release
npm run measure:operator-performance -- --check
npm run dev:operator-desktop
npm run dev:operator-web
ouroboros candidate select <candidate-id>
ouroboros candidate paper start <candidate-id>
ouroboros trading-run observe <trading-run-id>
ouroboros status
ouroboros tui
```

The primary interactive operator surface is the Tauri Desktop app in `apps/operator-desktop`.
`apps/operator-web` remains the shared Operator UI source and browser/development surface, not the
default operator verification target. `npm run package:operator-desktop` must build the shared
Operator UI bundle and produce a local macOS app bundle at
`apps/operator-desktop/src-tauri/target/release/bundle/macos/Ouroboros Operator.app`.
`npm run open:operator-desktop` opens that packaged app without opening a browser; use
`npm run dev:operator-desktop` for the native app development loop without starting the Web dev
server, and use `npm run dev:operator-web` only when developing the shared UI surface directly.
`npm run verify:operator-desktop-release` validates the app bundle and packaged runtime contract.
`npm run measure:operator-performance -- --check` records runtime, payload, asset, Desktop bundle,
and native app screenshot performance evidence.
Check the Candidate Arena side rail:

- `Arena runner` shows `running` or `stopped` with the tick count from `GET /api/operator`.
- `Latest ticks` shows the last tick status, generated count, `Source`, directions, and research
  efficiency.
- `Source` must read `fixture_seed`, `evaluated_arena_leader`,
  `paper_trading_evaluation_leader`, or `explicit_candidate`; a
  `paper_trading_evaluation_leader` source proves the next CandidateArena generation used the
  current paper TradingEvaluation leader instead of restarting from the fixture seed or only the
  replay leaderboard.
- The Desktop app, CLI, TUI, and Web surface expose the same evidence as `Latest tick source` from
  the shared runtime/store-backed session data, so every operator surface can verify the same
  running loop without importing runtime internals.

For automated CI, prefer the in-process runtime smoke test over a port-bound runtime server. The
smoke still exercises the replay TradingApiProvider boundary, so local sandboxed runs may need
permission to bind the provider on localhost.
