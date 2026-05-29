# Interface Parity

Ouroboros exposes one product loop through three operator surfaces:

- CLI: the baseline human and automation interface.
- TUI: keyboard action console.
- Web UI: operator cockpit.

All three surfaces read the same state from `GET /api/operator`. Product loop mutations go through
`POST /api/commands` and use command names from `OUROBOROS_COMMAND_REGISTRY`.

## Product Loop Commands

`packages/domain` marks the primary loop subset with `OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS`:

- `arena.status`
- `arena.start`
- `arena.stop`
- `arena.tick`
- `candidate.select`
- `trading_run.start`
- `trading_run.observe`
- `trading_run.stop`
- `agent_provider.status`
- `agent_provider.setup`
- `agent_provider.login.start`
- `agent_provider.probe`
- `researcher.provider.select`

These are the commands that must stay visible as a coherent product loop whenever the CLI, TUI, or
Web UI changes:

```text
status
-> setup/provider
-> start/tick
-> leaderboard
-> select candidate
-> start paper trading
-> observe paper score
-> stop paper trading
-> evidence readback
```

Developer/detail commands can remain in `OUROBOROS_COMMAND_REGISTRY` without becoming interface
parity requirements. If a developer command becomes part of the operator product loop, first add it
to `OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS`, then update the CLI/TUI/Web parity tests.

## CLI Local Controller Exception

`ouroboros agent setup|login|probe|status codex|fixture` is product-facing, but it may use the
local controller instead of the runtime server. Managed login must happen in the operator terminal with
Ouroboros-owned runtime directories, so the CLI can run those provider operations locally.

TUI and Web UI still expose provider setup/probe/login-start through `/api/commands`. When an
operation needs terminal interaction, the command result should guide the operator back to the CLI
instead of falling back to host-local provider state.

## Boundary

Interface parity does not change authority. Candidate, Paper Evidence, and Live remain visibly separate states.
Paper Trading is the continuous selected-candidate evaluation state between candidate selection and any
future live promotion. `trading_run.start`, `trading_run.observe`, and `trading_run.stop`
control selected-candidate `PaperTradingEvaluation`; Ledger paper evidence is readback, not live
promotion. Each surface should expose runner active status, next observation time, observation
count, latest market snapshot, latest paper score, and any paper failure from `OperatorReadModel`.
Live/private Binance authority remains disabled.
