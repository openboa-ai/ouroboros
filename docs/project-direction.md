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
paper trading over live public market data. Between them,
`PaperTradingHandoffConformance` is external research-only proof that the exact submitted artifact
satisfies the bounded target paper event protocol before admission and generated-candidate start.
`ResearchPreflightCommitment` is the pre-effect record that keeps adaptive development feedback
separate from one rotating, evaluator-owned sealed admission submission.
`ResearchBehaviorFingerprint` is the development-only population identity record that binds one
frozen SystemCode to normalized effective orders on one exact protocol and suite digest.
`ResearchPopulationDiversity` is the read-only latest-ten-tick coverage aggregate plus a bounded
newest-first series that separately measures each tick's assigned-direction and exact same-suite
observed-behavior cross-section.
`ResearchControlCampaign` is the pre-effect adaptive-versus-static policy experiment: one exact
store and source-artifact baseline, isolated arm stores, fixed bounded ticks, diagnostic-only
research report, and deterministic future paper candidate slots. It does not declare a winner.
`ResearchControlCampaignOutcome` is the append-only external adjudication of those slots against
the campaign's pre-effect Trading review comparator and one shared prospective paper policy. It
counts every slot and treats only an exact `confirmed_improvement` ResearchRelease as qualified
discovery credit. One outcome is an observation, not causal proof or policy-replacement authority.
`ResearchControlStudy` is the pre-effect replicated experiment commitment. It fixes 6 to 30 exact
campaign identities, one same-frozen-snapshot condition, and one paired exact sign-test policy
before any planned campaign is stored, and it permits no early stopping.
`ResearchControlStudyOutcome` aggregates every exact planned campaign outcome once and limits its
causal scope to same-baseline stochastic repetitions. Supported adaptive effect means only that a
separate allocation-policy decision may be considered; the outcome cannot replace policy.
`ResearchAllocationPolicyDecision` is that separate append-only research-only decision. It reloads
the exact study and outcome, approves only eligible `adaptive_effect_supported` evidence, binds the
studied allocation-policy digest, and otherwise records `not_approved` with no effective mode.
Non-significance never selects static control. Future uncontrolled allocations cite the latest
applicable approval or the repository adaptive fallback; explicit directions and adaptive/static
modes retain precedence, and every allocation seals its exact basis before effects.
The internal paper executor commits a deterministic schedule, seals candidate-bearing source starts
with shared public snapshots, advances one persisted action at a time, and converts every source,
deadline, or confirmation terminal path into an exact slot outcome before adjudication. The
executor is restart-derived and paper-only; it is not yet a default always-on runtime, public
command, policy replacement mechanism, or TradingPromotion path.
`createResearchControlCampaignPaperRuntimeArm` now binds each arm-local store and session service
to the existing comparison, activation, checkpoint, qualification, confirmation, and release
services. It performs one confirmation transition per action, propagates exact wake times, and
recovers rather than adopts unowned attempts. `createResearchControlCampaignPaperRuntime` composes
those arms into source, confirmation, evidence, action, executor, and runner wiring.
`createResearchControlStudyRuntime` similarly derives exact study progress, runs one
planned campaign to terminal paper outcome per advance, and repeats sequentially without a progress
record; its default campaign path can open exact arm roots and build real arms from arm-local
session factories. `ResearchControlStudyProcessSupervisor` now discovers incomplete studies oldest first,
drains one injected runtime at a time, verifies persisted completion, and rescans until caught up.
`ResearchControlStudyScheduler` now starts that process path by default in `buildServer`, performs
bounded interruptible polling for later commitments, reconstructs every campaign from the exact
persisted condition, and stops before shared runtime dependencies. One renewable
`ResearchControlStudyExecutionLease` now prevents same-host servers sharing a LocalStore root from
opening the same pending study. Every executor advance asserts exact ownership; alive or unknown
owners wait, and only an expired owner with a confirmed-absent same-host PID may be replaced. Lease
history is operational coordination, never study evidence or policy authority. Multi-host fencing,
real-market replicated outcome evidence, distinct-regime inference, learned policy parameters, and
automatic study or decision creation remain open.
`ResearchWorkerCheckpoint` is the terminal lifecycle record that lets one stable logical worker
carry a sanitized notebook and closed budget history into a later new commitment without resuming
an old process or sealed evaluator plan.

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
-> pre-effect ResearchPreflightCommitment
-> bounded development replay/backtest feedback
-> frozen artifact and one-shot rotating sealed admission
-> external PaperTradingHandoffConformance
-> development-only ResearchBehaviorFingerprint comparison
-> CandidateAdmissionDecision and materialization
-> terminal ResearchWorkerCheckpoint
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

Development replay success alone does not establish runnable handoff. CandidateArena persists the
allocation, direction, worker, source bytes, development budget, and sealed-suite commitments
before worker effects. It freezes one development-selected artifact, allows one sealed submission,
and exposes no raw seed, sealed scenario, score, or evaluator internals to the worker. New admitted
candidates bind that exact terminal graph and passed `PaperTradingHandoffConformance`, and
generated-candidate paper start revalidates it before
effects. Generated single-file Python SystemCode identity includes its frozen manifest and sole
editable entrypoint; undeclared closure state is invalid. Rejected protocol evidence stays in causal research memory, while infrastructure failure
stays platform-attributed. Conformance has no economic, qualification, promotion, order, private,
or live authority.

ResearchWorker identity persists across ticks only when direction, provider, model, and managed
agent profile are exact. The worker owns a stable workspace with one sanitized notebook per tick;
candidate artifact bytes remain isolated. Every new commitment closes through one append-only
checkpoint with a contiguous prior link, bounded cumulative submission counts, and zero remaining
retry authority. Restart recovery runs before the next worker effect. It reconstructs a checkpoint
from an already persisted exact admission or fails the orphan closed, and never reruns the old
artifact, process, provider, sandbox, budget, seed, or sealed suite.

Candidate population identity is not source-text identity. CandidateArena records normalized
effective `symbol`, `side`, exact `quantity`, and `order_type` decisions from every canonical
development scenario, excluding rationale, timestamps, event noise, score, PnL, sealed evidence,
and paper evidence. Only an earlier admitted exact match on the same protocol and suite can consume
the population slot; duplicate attempts remain causal research memory. This does not claim that
programs are semantically equivalent outside the bounded suite.

Population concentration is now observable without becoming policy. CandidateArena derives
Shannon entropy for assigned directions and, only when every sample shares one exact fingerprint
protocol and development-suite cohort, for observed behavior keys. Top-level distributions retain
recent population coverage while `tick_series` makes current cross-sectional collapse and recovery
visible. A mixed cohort is explicitly `incomparable_suites`; global and per-direction unique claims
are omitted. Cross-tick suite transitions do not erase valid single-cohort tick measurements. The
next worker receives only bounded counts and entropy, never raw identity or evaluator evidence.
High entropy does not prove quality or independence, low entropy does not prove failure, and neither
value changes allocation, rank, admission, paper qualification, or promotion.

This is a bounded information-barrier improvement, not evidence that synthetic replay predicts
future paper economics or that evaluator query caps eliminate reward hacking. Prospective paper
evidence and the remaining P0 controls stay authoritative.

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
