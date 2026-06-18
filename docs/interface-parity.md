# Interface Parity

Ouroboros exposes one product loop through three operator surfaces:

- CLI: the baseline human and automation interface.
- TUI: keyboard action console.
- Web UI: operator cockpit with four primary tabs: `Trading`, `Arena`, `Research`, and `Details`.

All three surfaces read the same state from `GET /api/operator`. Product loop mutations go through
`POST /api/commands` and use command names from `OUROBOROS_COMMAND_REGISTRY`.

The Web tab shell may show compact state badges, but only when they are derived from
`OperatorReadModel`. Badges are read-only navigation signals for active Trading review, collecting
paper evidence, or blocked provider readiness; they must not invent state, trigger commands, or
make Details look like a product-authority surface.

## Product Loop Commands

`packages/domain` marks the primary loop subset with `OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS`:

- `arena.status`
- `arena.start`
- `arena.stop`
- `arena.tick`
- `candidate.select`
- `trading_candidate.promote`
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
-> qualify paper evidence
-> move to Trading review
-> stop paper trading
-> evidence readback
-> PaperTradingEvaluation board
```

Failed entries in `OperatorReadModel.latest_commands` are command evidence, not product state.
CLI, TUI, and Web must render their shared remediation as a pointer back to the visible owning
surface, such as Trading review packet blockers, Paper Board qualification, selected paper failure,
Agent provider status, or Candidate Arena runner/tick evidence. A command log must never become the
only place where the operator can understand a blocker.

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
The Web UI keeps those states separated by tab:

- `Trading` is the paper Trading review cockpit. In MLP-01 it shows the
  `TradingReviewPacket` before the `TradingPromotion` review candidate. The packet is projected
  through `TradingReview` with paper qualification/readiness, verdict/top blocker/subject time,
  evidence window time/runner/Ledger/lineage/lineage-learning/provenance/risk/next action, and the
  reason live/private exchange authority remains disabled. Packet provenance must carry the same
  market source, public execution freshness, WebSocket/REST fallback state, stream marker, fill
  status, and order-book sync summary shown by CLI and TUI. Packet lineage learning must show the
  same paper rank, qualification status, score, observation count, top blocker, and next research
  focus shown by CLI and TUI. The Web first-viewport recommended action must use
  `buildTradingFirstViewportRecommendation`: it derives from `TradingReviewPacket.next_action`,
  verdict severity, top blocker, runner state, and selected target mismatch before falling back to
  compatibility-cycle recommendations. It must use the active Trading review target, not whichever
  Arena candidate the operator last clicked. Operator-facing `next_action` and blocker remediation
  copy should render readable product language such as `Paper Trading Evaluation`, not raw
  schema-shaped type names. The Web
  paper summary below the packet uses packet-aligned supporting labels such as `Paper risk equity`,
  `Paper score`, `Paper risk position`, and `Review readiness`; it explains packet evidence and
  must not introduce a competing recommendation. Lower Trading readback labels must keep the same
  authority-specific wording, including `Paper Trading Evaluation`, `Paper runner`, `Paper fill`,
  and `Public execution evidence`, so supporting evidence cannot drift back into generic Evaluation
  language, unscoped runner language, latest-fill live-trading language, or market-source-only
  provenance.
- `Arena` is the selected-candidate continuous paper trading arena. CandidateArena controls,
  revenue-cost leaderboard, `PaperTradingEvaluation` board, selected paper account, open orders,
  fills, and Ledger readback live here.
- `Research` is candidate generation, research lineage, selected paper evidence learning,
  preflight/backtest context, and next candidate handoff. When
  `TradingReviewPacket.lineage.paper_board_learning` exists, Web UI should surface its rank,
  score, qualification, blocker, authority, and next research focus as read-only context; CLI and
  TUI expose the same packet learning summary in their status output. When
  `OperatorReadModel.candidate_arena.finding_clusters` exists, Web Research should show those
  direction/blocker/market-regime/protocol-failure clusters as read-only next-generation context
  with `not_promotion_authority`; they are not paper rank, qualification, Trading review blockers,
  or direction scheduling authority.
- `Details` is raw records, developer controls, replay/full-cycle compatibility, substrate
  readbacks, and low-level evidence. Web UI should label this as a raw evidence and
  developer/detail-record boundary so operators do not treat Details as qualification,
  promotion, blocker ownership, or live-authority surface area.

Web UI tabs support stable QA and remote screenshot entrypoints through
`?view=trading|arena|research|details`. The query parameter only selects the visible cockpit tab;
it must not trigger product commands, refresh candidate state, or change exchange authority.

Paper Trading is the continuous selected-candidate evaluation state between candidate selection and any
future live promotion. `trading_candidate.promote` only moves a `qualified` paper-backed candidate
into Trading review; collecting, resume-needed, failed, or quality-blocked paper evidence must keep
the action disabled or return a command error with visible qualification reasons. It does not create live exchange authority. `trading_run.start`, `trading_run.observe`, and `trading_run.stop`
control selected-candidate `PaperTradingEvaluation`; Ledger paper evidence is readback, not live
promotion. Each surface should expose runner active status, next observation time, observation
count, latest market snapshot, latest paper score, `PaperTradingEvaluation` board rank, Trading
review packet blocker groups with summary/remediation, runner/Ledger continuity, lineage, lineage
learning, packet provenance, and any classified paper failure from `OperatorReadModel` with raw
reason retained.
Each surface must also expose paper qualification status,
qualification reasons, evidence window, trend, blocker density, runner state, market source, latest
fill status, and open order count in the paper board itself so a high `net_revenue_usdt` candidate
does not look ready when it is still collecting evidence or blocked by market/fill data quality. The
CandidateArena leaderboard is research preflight; the paper board is the product evaluation
authority and must remain visibly distinct in CLI, TUI, and Web UI.
CandidateArena latest ticks must also show direction status, generated count, failure count, and
`ResearchEfficiency` where available. These are autonomy trajectory signals with
`not_promotion_authority`; they must not become rank, qualification, or Trading review authority.
If the active Trading review target differs from the Arena selected candidate, every surface must
show that mismatch and prevent Trading controls from silently acting on the wrong candidate.
Promoting a different qualified candidate is an explicit Trading review target replacement, still
under `not_live` authority. Attempting that replacement with collecting, resume-needed, failed, or
quality-blocked paper evidence must preserve the existing active target and return qualification
reasons for the attempted replacement.
When a persisted evaluation is still `running` but the in-memory runner is inactive after a runtime
restart, every surface must say `needs resume` instead of making the session look actively scheduled
or fully stopped. Live/private Binance authority remains disabled.
