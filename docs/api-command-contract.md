# API And Command Contract

The primary operator contract is shared by Desktop, CLI, TUI, Web UI, and runtime HTTP:

- `GET /api/operator`
- `POST /api/commands`

Mutation aliases are not product API. Product-facing actions use the command contract.
Commands are operator controls over the doctrine, not provider commands.

## Command Authority

`packages/domain` owns the canonical command catalog through `OuroborosCommand`,
`OuroborosCommandKind`, and `OUROBOROS_COMMAND_REGISTRY`. Desktop, shared UI, CLI, TUI, and route
code must not invent mutation names outside that registry.

`OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS` marks the subset that Desktop, CLI, TUI, and Web UI must keep
as one operator loop. See [Interface Parity](interface-parity.md) for the shared UX contract and the
CLI local controller exception for managed agent setup/login/probe.

Current command groups:

- `arena`: status, start, stop, tick, cycle. `arena.start` starts the repeating below-authority
  autonomous paper loop: each runner tick creates candidates, selects the highest-ranked candidate
  created by that tick, and starts or resumes that candidate's selected continuous
  `PaperTradingEvaluation`. `arena.tick` is one research round: candidate generation,
  research-time replay/backtest preflight, leaderboard update, findings, and lineage. By itself it
  is not continuous paper trading and must not be treated as final evaluation authority.
  `arena.cycle` runs one below-authority autonomous paper cycle: execute a research tick, select
  the highest-ranked candidate created by that tick, then start or resume its selected continuous
  `PaperTradingEvaluation` through `trading_run.start`.
- `candidate`: select, run candidate evaluation, run candidate replay, and compatibility paper
  evidence readback. `candidate.select` chooses one candidate for proof; primary paper evaluation
  starts through `trading_run.start`.
- `trading_candidate`: request that a paper-backed candidate enter Trading review.
  `trading_candidate.promote` rejects research-feedback, uncommitted, collecting, resume-needed,
  failed, invalidated, or quality-blocked evaluations with qualification reasons. A standalone
  `qualified` window is also rejected with `paper_trading_comparison_required`; no promotion record
  is created until a persisted external comparison verdict is promotion eligible. Promotion is
  deliberately unavailable until shared comparison evidence, adjudication, and promotion
  integration exist. This command does not bind
  live authority, submit exchange orders, or bypass `PaperTradingQualification`.
- `trading_run`: start, observe, stop paper trading runs through command dispatch. Product
  evaluation authority belongs here: selected candidates must accumulate continuous paper trading
  `revenue - cost` over time before their performance counts as product evidence.
  `trading_run.start` starts or resumes the selected `TradingSystem` as a managed paper session.
  Every currently reachable start creates `evidence_purpose: "research_feedback"`; public start,
  observe, and stop address only the candidate/version default `runtime_ref` and reject every
  additional internal TradingRun without exposing its evidence. Public command payloads cannot
  select an additional TradingRun, evidence purpose, or comparison ID. A `CandidateVersion.runtime_ref`
  identifies that default compatibility session; it does not limit the version to one internally
  owned paper run. Before provider, sandbox, market, Gateway, Ledger, or score
  effects, the application resolves executable bytes, persists an append-only
  `PaperTradingEvaluationCommitment`, creates the linked evaluation, and verifies the frozen chain.
  Resume, recovery, scheduled observation, and manual observation reverify the original commitment
  instead of reconstructing it from current mutable state. A mismatch terminally invalidates the
  evaluation and records no new paper observation.
  Public commands cannot create or alter a `PaperTradingComparisonPreparationRecord`, select
  qualification evidence purpose, comparison ID, comparison role, candidate admission decision,
  champion promotion, comparison policy, or comparison `committed_at`. Internal comparison
  preparation assigns time from its server-owned clock and persists an inert append-only record.
  Public qualification activation remains closed. The internal first shared tick and effect-free
  `PaperTradingComparisonActivation` authorization have no public command exposure. A separate
  uncomposed internal coordinator may persist an activation attempt, start both bound qualification
  sides in parallel against that first-tick view, enforce request/time/skew bounds, stop partial or
  invalid starts, and conservatively stop unowned pairs after restart. Its `both_running` outcome is
  zero-observation operational state only. Another uncomposed internal coordinator may persist a
  checkpoint intent, refresh both sandboxes under exact checkpoint authority, prepare both sides
  without economic writes, and commit one atomic paired bundle. The sequence-1 bundle is the sole
  acknowledgement-optional checkpoint. After it, the exact running role-bound provider may be
  internally enabled to persist a
  `PaperTradingComparisonTickDelivery` before returning first-tick context from
  `/market/snapshot`, then persist a matching `PaperTradingComparisonTickAcknowledgement` through
  `/comparison/tick/ack`. Once both roles acknowledge that tick, internal sequence-N coordinators
  can persist one contiguous next Gateway-owned tick, persist the next checkpoint attempt before
  effects, advance both owned provider views without restarting their sandboxes, require distinct
  exact acknowledgements for the new tick, and atomically commit both sides. The same sequence-N
  path is covered through sequence 3 without provider or sandbox restart. An internal
  `PaperTradingComparisonWindowDriver` can reconstruct the graph and perform one legal transition,
  while a process-local `PaperTradingComparisonWindowRunner` can schedule non-overlapping steps to
  the precommitted observation/time maximum without score-aware stopping. Restart rematerializes
  committed bundles and stops unowned sessions without replaying decisions; the runner never
  adopts or resumes provider identity. These internal routes, records, coordinators, driver, and
  runner are not composed into an app/controller or public `OuroborosCommand` and create no private,
  direct-order, promotion, or live authority. An internal read-only
  `PaperTradingComparisonQualificationService` may assess one cleanly stopped window only after the
  shared graph gate passes. It requires both canonical side qualifications, the frozen pair count
  and activation-to-latest-tick elapsed minimums, and exact equality between checkpoint-declared
  Ledger refs and complete chains from each additional qualification TradingRun. Its result carries
  `not_verdict`, performs no writes, and is not a command, score comparison, winner, release, or
  promotion decision. Public composition, process resume, adjudication, confirmation, verdict,
  evidence release, promotion, private access, and live authority remain pending and outside this
  command contract.
  The session stays running until `trading_run.stop`, process exit, crash, or runtime restart stops
  it; it is not a finite snapshot decision run.
  The runtime injects `TRADING_API_BASE_URL` for the sandbox so the `TradingSystem` can read
  Gateway-owned paper market snapshots, fake account state, and order validation without importing
  Binance or touching private/live authority.
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
  An activated additional `research_feedback` TradingRun owns its own provider, sandbox, fake
  account, cursors, Ledger, and lifecycle. A prepared qualification TradingRun owns only its
  persisted TradingRun and supporting refs, frozen commitment and account identity, and
  `not_started` evaluation. The internal prospective comparison coordinator may persist and verify
  a complete pair commitment, but the graph remains persistence-only and inert.
  Sandbox JSONL output must follow the
  [TradingSystem Paper Event Protocol](trading-system-paper-event-protocol.md): stable `event_id`,
  `trace_only` authority, bounded `order_request`, `cancel_order`, and explicit `hold`/`no_action`
  events. Protocol errors are rejected without Ledger creation or fake account mutation.
- `run_control`: record lifecycle control decisions and audit evidence.
- `trading_substrate`: record private-readiness posture without enabling private/live authority.
- `sandbox`: start or stop sandbox execution through command dispatch.
- `agent_provider`: managed provider status, setup, login start, probe
- `researcher`: researcher provider selection

## Read Model Authority

`OperatorReadModel` is the shared operator state for all user surfaces. It must show the
CandidateArena status, research-preflight leaderboard, selected candidate, selected
`PaperTradingEvaluation`, product `PaperTradingEvaluation` board, paper evidence readback, runner
active status, interval, next observation time, latest market snapshot, latest public execution
snapshot, market data mode, local order book sync state, fake paper account, open orders, latest
fill, latest classified paper failure, agent/provider status, latest ticks, latest candidates,
latest command results, latest `TradingPromotion` state, `TradingReview` active target binding, and latest
TradingSystem paper decision when one has been emitted, research-efficiency summaries for latest
CandidateArena ticks, and authority flags.

`ResearchEfficiency` is not a leaderboard or promotion metric. It summarizes provider request
count, runner command count, scenario count, and elapsed milliseconds for a CandidateArena
direction result with `not_promotion_authority`, so researchers can compare autonomy efficiency
without weakening paper evidence or Trading review authority.

`CandidateAdmissionDecision` is the research-only external gate between `ResearchPreflight` and
candidate materialization. A CandidateArena direction result is `created` only when the persisted
decision is `admitted` with `runnable_paper_handoff: true`. Unchanged output is `duplicate` and
invalid external evaluation is `quarantined`. Every completed admission outcome carries
`admission_decision_id` and `admission_reason`; duplicate and quarantined results also carry a
finding summary without a candidate id. Infrastructure exceptions remain `failed`. Changed versus
unchanged is derived from the source and submitted SystemCode artifact
digests, not the ResearchWorker's edit self-report. Only `not_counted` research evidence can be
admitted; already counted evidence is quarantined instead of being repurposed as a runnable
handoff. A tick is `completed` when every direction
reaches an admission outcome, even if none is admitted; `completed_with_errors` or `failed` is
reserved for partial or total infrastructure failure. Admission does not qualify paper evidence,
change paper rank, grant promotion, or enable live authority.

Admission persists references to both the exact source SystemCode snapshot and submitted
SystemCode. LocalStore verifies each stored digest against its referenced record and checks that the
ExperimentRun, TradingEvaluationResult, and ResearchFinding form one consistent evidence chain.

The legacy `runAgentTradingCycle` and `runCandidateGeneration` direct-materialization helpers are
retired and return `agent_trading_cycle_retired_use_candidate_arena` and
`candidate_generation_retired_use_candidate_arena`, respectively. CandidateArena is the only
application path that may turn research or provider output into a materialized candidate.

The `paper_trading_board` ranks persisted paper evaluations by `net_revenue_usdt` first and
`net_return_pct` second. It keeps negative paper evaluations visible, exposes runner state
(`active`, `needs_resume`, or `inactive`), exposes qualification status and reasons, and exposes
promotion-gate state without enabling live authority. Selected evaluation and board rows expose
evidence purpose, commitment ID and digest, freeze status, and stable invalidation reason. A row is
`verified` only when its persisted commitment digest and evaluation identity chain match; mere
record presence is insufficient. Each row also exposes `trend` and
`blocker_density` as `not_promotion_authority` explanation signals; these fields do not participate
in rank, qualification, or promotion policy. Latest paper failures must preserve the raw
reason and add `PaperTradingFailure` kind, summary, and next action for operator remediation.
CLI, TUI, and Web surfaces must render the classified kind, human summary, and next action before
raw failure text.
Qualification is not the rank metric. It is
the evidence-quality gate for an eligible qualification-purpose evaluation: observation window
size, elapsed time derived from actual observation timestamps, runner health when known, failed
observation ratio, market snapshot presence,
public execution evidence for fills, a complete contiguous observation/commitment identity chain,
fake-account-reconciled score, and a frozen provider identity explicitly eligible for
qualification. Every observation delta must reconcile to its cumulative score, every present
observation account must reconcile to that cumulative score under the committed initial equity,
account-less failure observations must preserve the prior score, and the final observation
score/account must match the evaluation. A mature profitable
research-feedback row or provider-ineligible window remains
`not_qualification_evidence`. UI, CLI, and TUI must distinguish board rank from qualification and
promotion authority, while CandidateArena leaderboard remains research preflight.
Paired qualification is a separate application-only gate over a stopped shared comparison. It does
not recompute side quality: both exact side results must already be `qualified`. It additionally
requires contiguous paired checkpoints, a clean `handoff_cleanup`, shared count/elapsed minimums,
and exact run-specific Ledger set equality. A zero-chain LocalStore Ledger is valid only when
`has_activity=false`, `chain_count=0`, all latest records are null, and checkpoint-declared refs are
also empty. The paired result is `not_verdict` and cannot affect rank, findings, release, or
promotion.
When compacting this board into researcher context, do not invent runner authority: if the current
process cannot see the in-memory runner, keep the paper status and score but mark runner state as
unknown or omit the promotion gate instead of calling an active evaluation `needs_resume`. The
compacted researcher context should include deterministic blocker groups and next actions derived
from qualification reasons, so the next CandidateArena tick can respond to evidence-window,
runner-health, market-provenance, fill-provenance, and observation-quality failures without making
those groups a second promotion gate. Expected research-feedback purpose is an authority label, not
an adaptive research failure, so it must not become a finding-cluster blocker. Only a canonically
matching `research_feedback` commitment with `closed_observation` release policy enters these paper
research projections, and its observation chain and score must reconcile to the committed fake
account. Candidate-level Ledger activity cannot create a paper research projection by itself.
Qualification-purpose, invalidated, or integrity-failed scores, failures, observations, Ledger
fields, and commitment digests remain omitted even after a run stops or fails; a future adjudicator
owns release. The same predicate gates `paper_trading_evaluation_leader` source selection; sealed or
corrupt paper evidence cannot become the next ResearchWorker's parent. Candidate-aggregate Ledger
summaries are omitted until evidence can be resolved by the released evaluation's exact TradingRun.
Selected paper
evidence should also carry a compact
`lineage` summary: lineage status, research direction, parent candidate, latest finding,
evaluation status, and `lineage_only` authority. That lets the next ResearchWorker react to
paper-backed lineage evidence without treating lineage as promotion authority.
Selected paper evidence should also carry compact `paper_loop_latency`: expected observation
interval, latest observed interval, latest and max lag, observed interval count, cadence status,
and `not_promotion_authority`. It is derived from persisted `PaperTradingObservation` timestamps
and exists only so the next ResearchWorker can notice lagging or thin paper cadence; it must not
change paper rank, qualification, Trading review readiness, or promotion decisions.
`CandidateArenaReadModel` and CandidateArena researcher context should also carry
`finding_clusters` grouped by research direction, top paper blocker, market regime, and classified
protocol failure. These clusters are `not_promotion_authority`: they guide next candidate
generation only. When no explicit `directions` list is supplied, CandidateArena may use those
clusters and recent `ResearchEfficiency` cost/latency pressure to prioritize the next default
ResearchDirection order and include an `adaptive_direction_focus` summary in researcher context.
That direction focus is still
`not_promotion_authority`: it must not change paper ranking, qualification, Trading review
readiness, or promotion decisions. Operator surfaces may render it in Research as read-only
next-generation context, but they must not treat it as a blocker, rank, or action.

Read models are projections. They must not trigger candidate generation, paper evidence, provider
login, or exchange behavior.

Candidate, Paper Evidence, Paper Trading, TradingPromotion, and Live are separate states in every
operator surface. TradingPromotion moves a paper-backed candidate into Trading review while
preserving `not_live` authority. `trading_review` is the read projection that tells surfaces which
candidate is the active Trading review target, which Arena candidate is currently selected, and
whether those ids match. `trading_review.review_packet` is the structured read-only evidence
packet for that target: verdict, top blocker, subject, paper performance, evidence quality,
runner health, Ledger continuity, lineage, provenance, risk, authority, and next action.
Provenance includes market source, public execution source, freshness, WebSocket connection state,
REST fallback state, stream marker, latest fill status, and order-book sync summary when public
paper evidence provides it. Lineage includes `paper_board_learning`, a compact rank, score,
qualification, blocker, failure, and next-research-focus summary shared with CandidateArena
researcher context under `lineage_only` authority. Subject includes promoted time, and evidence
quality includes first/last observed times when available, so operator surfaces can explain both
when the target entered review and which paper evidence interval is being judged. Its authority
section must keep the disabled capability set explicit: no live exchange authority, no private read
authority, no order submission authority, and no credentials.
Trading controls must not silently use the Arena selected candidate when
`selected_matches_trading_review` is false.
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
- `GET /api/trading-system/execution-mode-contracts`
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
