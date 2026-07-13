# Ouroboros

Ouroboros is not a trading dashboard and not a one-shot AI trading bot generator. It connects
continuously improving AI agents to a hard, dynamic trading problem with externally recorded
economic outcomes, then turns that external agent progress into parallel `TradingSystem` candidate
search.

AI agents improve over time. Trading is hard, dynamic, and adversarial. `revenue - cost`, return,
costs, risk, and paper evidence provide objective accounting, but strategy quality remains noisy,
path-dependent, and non-stationary. Ouroboros exists to make that combination compound: generate
many candidates, evaluate externally, keep findings and lineage, and prove only the selected
candidate under a precommitted evidence policy.

## Core Doctrine

The researcher is a candidate generator, not the authority. Researcher cannot grade, candidate
cannot grade itself, and selected paper evidence is proof gathering, not live promotion.

Replay and backtest are research tools, not final evaluation authority. They belong inside the
candidate creation stage as fast ways to explore, sanity-check, and reject weak ideas. The primary
product score must come from continuous paper trading: selected candidates run against live public
market data with fake account, fake execution, and fake Ledger, and are judged by accumulated
`revenue - cost` over time.

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
-> selected continuous paper trading evaluation
-> PaperTradingEvaluation board
```

`TradingSystem` is an executable candidate system. It may be code, rules, model-assisted policy, or
an internal agent runtime, but it must emit bounded validated `OrderRequest`s and remain externally
evaluated in paper before it earns authority.

Development replay success alone cannot claim runnable paper handoff. Each direction first
persists a `ResearchPreflightCommitment` that binds allocation, direction, worker, source bytes,
development budget, and evaluator-owned sealed-suite commitments before worker effects. The worker
may receive bounded aggregate development feedback, but one frozen artifact is submitted only once
to the rotating sealed set. Raw evaluator seed and sealed scenarios remain process-local; process
loss closes that commitment instead of reconstructing or resampling it. Every new admitted candidate
must then bind the exact commitment, sealed terminal evaluation, submitted `SystemCode`, and one
external `PaperTradingHandoffConformance`, and a
generated candidate must revalidate that evidence before paper effects. For generated single-file
Python candidates, the SystemCode digest covers the frozen manifest plus sole editable entrypoint;
undeclared files, directories, symlinks, or manifest drift invalidate the closure. This gate proves bounded
target-protocol compatibility only; it does not add economic score, qualification, promotion,
order, private, or live authority.

Before population materialization, CandidateArena also derives one `ResearchBehaviorFingerprint`
from the final externally recorded order decision for every exact development scenario. Different
SystemCode artifacts with the same protocol, development-suite digest, and normalized decisions
share one behavioral key. Only a prior admitted fingerprint can exclude a later exact match;
duplicates retain Finding and Lineage but receive no candidate slot. Missing canonical observations
quarantine an otherwise admissible submission. This is bounded observational equality on a public
development suite, not semantic program equivalence or economic evidence, and sealed or paper
outcomes never enter the fingerprint.

CandidateArena reconstructs `ResearchPopulationDiversity` over the same latest ten completed ticks
shown in its read model. The top-level distributions measure recent population coverage, while the
newest-first `tick_series` independently measures each tick's worker cross-section so older
diversity cannot hide current exact-behavior collapse. Assigned `ResearchDirection` entropy and
exact observed-behavior entropy remain separate. Behavior is comparable only inside one exact
fingerprint protocol and development suite; mixed cohorts report `incomparable_suites` and make no
unique-count or entropy claim. A suite transition between ticks may close the window aggregate
while preserving valid single-cohort tick measurements. The same bounded object is available to the
next ResearchWorker without raw fingerprint, observation, scenario, suite-digest, sealed, or paper
evidence. It is a search diagnostic with no rank, admission, allocation, qualification, promotion,
order, private, or live authority.

CandidateArena policy can now be exercised through the internal `ResearchControlCampaign` runtime
composition. It seals one bounded LocalStore baseline plus the actual single-file research artifact,
then clones independent `adaptive_default` and `static_control` stores and runs their exact tick
sequences concurrently by sequence. The append-only report records admission, duplicate, failure,
diversity, and efficiency diagnostics and reserves the first admitted candidate per tick for future
paper evidence. It deliberately has `unadjudicated` primary outcome and no winner. Before arm
effects, the campaign also freezes the exact current Trading review comparator or explicit
unavailability. A bound campaign now commits one deterministic
`ResearchControlCampaignPaperSchedule`. The internal bounded paper executor can install that graph
in candidate-bearing arm stores, prepare matched source comparisons, seal shared first-tick market
and public-execution evidence in a `ResearchControlCampaignPaperStartBatch`, drive source and
confirmation windows, and close every candidate slot with an exact
`ResearchControlCampaignPaperSlotOutcome`. The outcome collector consumes those slot outcomes,
counts every precommitted slot, credits only `qualified_improvement`, and persists one
authority-closed single-campaign observation in the coordinator.
`ResearchControlStudy` now precommits 6 to 30 deterministic campaign identities before any planned
campaign exists, freezes their exact source/agent/comparator/paper/allocation condition on one
baseline snapshot, and fixes a two-sided paired exact sign test with no early stopping.
`ResearchControlStudyOutcome` consumes every planned terminal campaign outcome exactly once. Its
only causal claim is over same-baseline stochastic repetitions; a supported adaptive effect makes a
separate policy decision eligible but does not change allocation policy itself.
`ResearchAllocationPolicyDecisionService` now creates that separate append-only research-only
decision from the exact persisted study graph. Version 1 approves only an eligible
`adaptive_effect_supported` outcome and binds the exact studied allocation-policy digest;
non-supported or underpowered outcomes remain `not_approved` and never select static control. Each
future allocation records an explicit-request, repository-default, or approved-decision basis.
Uncontrolled ticks use the latest applicable exact approval, while caller-specified directions and
adaptive/static modes always take precedence. LocalStore revalidates decision-backed provenance and
time order before accepting the pre-effect allocation.
`createResearchControlCampaignPaperRuntimeArm` composes each arm-local store and paper-session
service into the existing comparison, activation, checkpoint, qualification, confirmation, and
release services. Confirmation advances one restart-projectable transition per executor action and
propagates exact window wake times to the runner instead of polling. Each arm has one runtime
activation owner, and restart recovery stops rather than adopts an unowned running attempt.
`createResearchControlCampaignPaperRuntime` then composes the source, confirmation, evidence,
action, executor, and interruptible runner components, and `runResearchControlCampaign` can invoke
one injected executor step.
`createResearchControlStudyRuntime` now binds that campaign lifecycle into a sequential study
executor and runner. Each advance completes or resumes only the earliest planned campaign, reloads
its terminal closure, and adjudicates only after all replications; stop drains the active campaign.
`ResearchControlStudyProcessSupervisor` can now discover incomplete committed studies oldest first,
open one injected study runtime at a time, reload exact completion, and rescan until caught up.
Failure does not skip later work, restart derives from append-only evidence, and stop drains the
active campaign. The campaign-to-outcome runtime can now open root-specific arm stores and build
those real arm services from an arm-local session factory. `ResearchControlStudyScheduler` now
keeps that one-shot supervisor alive under the runtime server. Before each discovery cycle, the
default `ResearchControlStudyCommitmentCoordinator` reloads the latest exact TradingPromotion and
its sealed confirmation campaign, then creates or accepts one deterministic six-replication,
one-tick-per-arm study. It preserves the campaign's numeric, market-data, and paper policy and
normalizes only the comparison mode to `champion_challenge`. No promotion or one already-pending
study defers; malformed or drifted evidence stops the scheduler before effects. Same-root races use
create-only publication and accept only the exact deterministic winner. The scheduler then runs the
supervisor immediately. After successful catch-up, and before its interruptible bounded wait,
`ResearchAllocationPolicyDecisionCoordinator` validates existing decisions and ensures the oldest
terminal outcome missing one. It processes at most one per cycle and records supported,
unsupported, and underpowered evidence symmetrically as `approved` or `not_approved`; a
non-significant result never selects static control. Decision publication is create-only across
same-root contenders, and an automatic approval is available to the next uncontrolled Arena tick as
exact provenance. The scheduler can then consider a later reviewed source without an operator
command. Each opened runtime reconstructs source, agent identity, campaign bounds, and the bound
paper protocol from the exact persisted study condition. Shutdown stops this scheduler before
CandidateArena and paper-session dependencies.
Before opening a pending study, each server
now acquires one renewable `ResearchControlStudyExecutionLease` scoped to the same host and
LocalStore root. The default 30-second lease renews every 10 seconds, guards every executor advance,
and records released or expired ownership history. A live or liveness-unknown owner remains held;
takeover requires both exact expiry and a confirmed-absent same-host PID. The lease coordinates
runtime effects only and never becomes research, rank, allocation, or promotion evidence. Multi-host
fencing and PID-namespace claims remain outside. Automatic commitment owns research scheduling
only; automatic policy decisions own future uncontrolled research allocation only. Distinct-regime
and forward-time study selection, learned policy, automatic TradingPromotion, and champion handoff
remain separate and outside this path.

One logical `ResearchWorker` is stable across ticks for an exact direction, provider, model, and
managed-agent profile. It owns a stable workspace with per-tick sanitized notebooks, while candidate
artifact bytes remain isolated under the tick run. Every checkpoint-enabled commitment closes with
one append-only `ResearchWorkerCheckpoint`: completed admission or failed-closed execution, zero
remaining submission authority, cumulative bounded budget accounting, and at most six recent
development-visible notebook entries. Before a new tick effect, restart recovery closes every
orphan in commitment order. An already persisted exact admission reconstructs only the terminal
checkpoint; otherwise the orphan becomes `failed_closed/restart_recovery`. Neither path reruns the
old worker, artifact, provider, sandbox, budget, evaluator seed, or sealed suite.

This isolation and diversity measurement reduce direct evaluator reuse and make population
concentration observable; they do not prove that a
query cap prevents reward hacking or that synthetic replay generalizes economically. Approximate
or cross-suite behavior clustering, durable provider-process or sandbox adoption, worker-chosen
de-risking sequences, directed-versus-undirected and memory/baseline controls, actually executed
replicated study evidence across distinct regimes, controlled discovery-yield and long-duration
restart soak evidence, deployed always-on paper execution, automatic promotion, champion runner handoff, private/live
authority, P0, and the overall Goal remain open.

The authority boundary is outside the candidate. A candidate is accepted or rejected by external
paper trading performance, provider/risk validation, and paper-only Gateway/Ledger evidence after
selection. Failures and losing candidates remain useful arena memory unless they crash, submit
malformed orders, bypass provider boundaries, fail risk validation, or attempt private/live
behavior.

Paper trading runs the selected `TradingSystem`; it does not ask the Gateway to invent a decision
on every snapshot. The `TradingSystem` owns when and how often it evaluates market state, news,
tools, internal agents, and risk. The Gateway owns public market data access, cache, validation,
fake paper execution, and Ledger evidence. A paper observation is a checkpoint/readback: record the
latest market snapshot, consume any newly emitted `OrderRequest`s through the Gateway, update paper
score and Ledger evidence, or record a valid no-order checkpoint when the system emitted nothing.
The paper engine owns the fake account, open/partial/filled/canceled orders, fake fills, mark-to-
market PnL, fees, slippage, funding, and position state. Fills require public execution evidence:
Binance routed WebSocket `/public` `bookTicker` and `/market` `aggTrade` are the primary live
sources, REST is the snapshot, backfill, and recovery anchor, and local order book state follows
Binance `/public` `depth` snapshot plus `U/u/pu` continuity rules. Fills are not invented from a
mark price alone.
Replaying old sandbox output as a new decision is not paper trading evaluation.

The Candidate Arena leaderboard is a research preflight board. The `PaperTradingEvaluation` board
is the product evaluation board: it ranks selected candidates by accumulated paper
`net_revenue_usdt` first and `net_return_pct` second, keeps losing candidates visible as useful
evidence, and shows a qualification gate without enabling live authority. Ranking and
qualification are deliberately separate: a high paper `net_revenue_usdt` can still be
`collecting_evidence` or `blocked_by_quality` when the evidence window is too small, the runner is
inactive, failure ratio is high, market snapshots are missing, or fill-bearing results lack public
execution evidence.
CandidateArena rank and next-generation context use development-visible preflight evidence; the
sealed terminal score is an admission gate and never becomes a leaderboard value or worker
feedback channel.

Gateway binding changes, TradingSystem identity does not. Candidate, Paper Evidence, and Live are
separate states; live authority remains disabled.

## Source Of Truth

The GitHub repository on `main` is the Ouroboros source of truth. Code, tests, validation scripts,
root documentation, [docs](docs/project-direction.md), and `.agents` instructions define durable
product, architecture, naming, API, and operating truth.

Linear is a workflow tool for issues, comments, scratchpads, project coordination, and historical
progress notes. See [LINEAR.md](LINEAR.md) for how Linear work should reference repo truth.

Canonical repo docs:

- [Project Direction](docs/project-direction.md)
- [CandidateArena And Research Goal](docs/candidate-arena-research-goal.md)
- [CandidateArena Evaluation Protocol](docs/candidate-arena-evaluation-protocol.md)
- [Ouroboros Doctrine](docs/ouroboros-doctrine.md)
- [Autonomy Model](docs/autonomy-model.md)
- [Product Quality Design](docs/product-quality-design.md)
- [Architecture Governance](docs/architecture-governance.md)
- [API And Command Contract](docs/api-command-contract.md)
- [Interface Parity](docs/interface-parity.md)
- [Product Loop Smoke](docs/product-loop-smoke.md)
- [Operator Desktop Performance And Release](docs/operator-desktop-performance-release.md)
- [TradingSystem Paper Event Protocol](docs/trading-system-paper-event-protocol.md)
- [Naming Taxonomy](docs/naming-taxonomy.md)

## Canonical Flow

Use the same nouns in code, API, UI, issues, and compact docs:

```text
Candidate Arena -> Trading System -> System Code -> research preflight -> selected Paper Trading -> Gateway -> Ledger
```

`OrderRequest`, `GatewayResult`, and `ExecutionResult` are the Ledger chain. `Improvement`,
full-cycle research, fixtures, Docker Sandboxes, Compose, and host paths are developer/detail
surfaces. They must not replace the primary Candidate Arena workflow.

## Repository Shape

- `apps/runtime`: Fastify composition root and HTTP route/controller registration.
- `apps/cli`: `ouroboros` command-line interface over the shared command/read contracts. It
  remains complete enough for automation and headless operation.
- `apps/operator-tui`: Ink action console over the shared Operator read model and command endpoint.
- `apps/operator-web`: shared Operator UI source and browser/development surface over the same
  Operator read model and Ouroboros command endpoint. It is not a separate product authority.
- `apps/operator-desktop`: primary Tauri operator app. It launches or reuses the runtime, keeps
  runtime status visible from the macOS menu bar, restores the operator window from the tray, and
  loads the shared Operator UI bundle through the platform WebView without granting frontend Tauri
  permissions.
- `packages/domain`: shared domain contracts, including the Operator command descriptors used by
  CLI, TUI, shared UI, and the Desktop app.
- `packages/application`: command controllers, application services, Candidate Arena use cases, read-model builders, and ports, organized by product domain such as `agent/`, `candidate/`, `research/`, and `trading/`.
- `packages/adapters`: concrete outside-system integrations grouped by boundary, such as `codex/`, `binance/`, `fixture/`, and `sandbox/`.
- `packages/local-store`: filesystem-backed local store primitives.
- `.agents`: repo-local skills and agent operating support.

Architecture quality is enforced as a product constraint. New runtime work follows
Hexagonal/Clean/Layered Architecture, DDD vocabulary, and CQRS command/read separation. Use
Strategy, Factory, Builder, Adapter, Decorator, Observer, Middleware, Registry, Plugin, and
Dependency Injection only at the extension point they solve; see
[Architecture Governance](docs/architecture-governance.md) for the decision matrix.

## Primary Commands

Run local services:

```bash
npm install
ouroboros runtime serve
npm run package:operator-desktop
npm run open:operator-desktop
npm run verify:operator-desktop-release
npm run measure:operator-performance -- --check
npm run dev:operator-desktop
npm run dev:operator-web
```

Operate the product loop through the Ouroboros command surface:

```bash
ouroboros arena status
ouroboros arena tick
ouroboros arena cycle
ouroboros arena start
ouroboros arena stop
ouroboros candidate select <candidate-id>
ouroboros candidate promote <candidate-id>
ouroboros candidate paper start <candidate-id>
ouroboros trading-run observe <trading-run-id>
ouroboros trading-run stop <trading-run-id>
ouroboros agent setup codex
ouroboros agent login codex
ouroboros agent probe codex
ouroboros researcher provider set codex
ouroboros tui
```

The Desktop app is the primary interactive operator surface; use the packaged app path for operator
checks instead of opening the browser development surface. The CLI remains the complete baseline
for headless operation and automation. CLI, Desktop, Web, and TUI all read `GET /api/operator`,
mutate through `POST /api/commands`, and share the same runtime/store-backed session data. Adapter
names such as Codex are internal provider settings on managed `AgentProfile` records. The agent
setup surface is provider-scoped, and the researcher selects one available provider from that
managed set; product-facing commands stay under the `ouroboros` noun.

Use Linear GraphQL when a task needs Linear workflow writeback:

```bash
npm run linear:graphql -- --query-file query.graphql --variables-file variables.json
npm run linear:workpad -- --issue OURO-158 --body-file workpad.md
```

Both commands read `LINEAR_API_KEY` from the environment first, then local `.env`, and never print
the token. Their implementation lives under [.agents/skills/linear-graphql](.agents/skills/linear-graphql/SKILL.md)
because Linear access is agent operating support, not product runtime code. Linear writeback must
point back to repo truth rather than replacing it.

## Product Boundary

MLP-01 is paper-only. Paper uses Binance production public market data through the Gateway-owned
`MarketDataPort` with a fake account, fake executor, and fake Ledger. Binance never attaches
directly to a `TradingSystem`; the `TradingSystem` emits validated `OrderRequest`s and the Gateway
owns REST + WebSocket market data reads, cache, order book recovery, validation, execution routing,
and evidence. Live trading, private account reads, signed exchange requests,
listenKey/user-data streams, leverage or margin mutation, and live orders remain disabled until a
future repo issue explicitly enables that authority.

## Validation

Before a PR is ready:

```bash
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

For implementation changes, also run the relevant tests plus:

```bash
npm test
npm run typecheck --workspaces --if-present
npm run build
```

Runbooks for Docker Sandboxes `sbx`/`sdx`, S5 audits, recovery helpers, fixture compatibility, and
full-cycle research are developer/detail surfaces. Use the relevant npm script `--help` output and
Linear workflow notes when that work is explicitly in scope.
