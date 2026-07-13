# Architecture

Ouroboros is organized around the Candidate Arena trust kernel:

```text
CandidateArena
-> parallel or iterative TradingSystem candidates
-> SystemCode
-> pre-effect ResearchPreflightCommitment
-> bounded development replay/backtest feedback
-> frozen SystemCode and one-shot rotating sealed admission
-> external PaperTradingHandoffConformance
-> development-only ResearchBehaviorFingerprint comparison
-> CandidateAdmissionDecision and materialization
-> terminal ResearchWorkerCheckpoint
-> leaderboard, findings, and lineage
-> selected continuous Paper Trading
-> Gateway
-> Ledger
```

Canonical naming surface: Candidate Arena -> Trading System -> System Code -> research preflight -> selected Paper Trading -> Gateway -> Ledger.
Inside that compact product-facing sequence, the enforced evidence spine inserts
`PaperTradingHandoffConformance`, `ResearchBehaviorFingerprint`, and
`CandidateAdmissionDecision` between ResearchPreflight and selected Paper Trading.

Researchers and LLM agents are candidate generators. Development replay/backtest is an adaptive
research tool, not admission or final evaluation authority. Before worker effects, LocalStore binds
one `ResearchPreflightCommitment` to the allocation, direction, worker, source SystemCode, bounded
development suite, and evaluator-owned sealed suite commitment. The worker never receives the raw
seed, sealed scenarios, or sealed outcome; one development-selected artifact is frozen and may be
submitted to that sealed set only once. Process loss fails that commitment closed rather than
resampling. Exact
terminal commitment/SystemCode/suite linkage and external paper handoff conformance gate new admission and generated
paper start without becoming economic evidence. Generated CandidateArena Python SystemCode uses a
canonical manifest-plus-entrypoint closure digest, and both research and paper resolution reject
undeclared closure state. Continuous paper trading is the product evaluation
authority for selected candidates, and paper `Gateway`/`Ledger` evidence belongs only to selected
Trading Runs, not to every candidate.
CandidateArena separately derives an append-only `ResearchBehaviorFingerprint` from normalized
effective orders on the exact development suite. LocalStore compares only protocol- and
suite-compatible fingerprints linked from earlier admitted decisions. An exact match keeps its
Finding and Lineage but receives no population slot; unavailable evidence fails closed. This
comparison consumes no sealed or paper result and claims no global semantic equivalence.
`ResearchPopulationDiversity` is a derived CQRS read model over the same latest ten completed
CandidateArena ticks plus exact commitment, direction, fingerprint, and admission records. It
reports assigned-direction concentration separately from same-cohort exact behavior concentration.
Multiple fingerprint protocol/development-suite cohorts fail closed as `incomparable_suites`; no
cross-cohort unique or entropy value is synthesized. The top-level distributions measure rolling
population coverage; the required newest-first `tick_series` recomputes the same distributions for
each exact tick cross-section. A protocol/suite transition can therefore close only the window
comparison while valid within-tick entropy remains visible. The application builder returns bounded
aggregate metrics only and has no mutation, scheduling, evaluation, or promotion authority.
CandidateArena and the next-worker context share that object rather than raw fingerprint evidence.
The runtime composition root also owns `ResearchControlCampaign`. It snapshots every regular
LocalStore file except campaign evidence collections, separately seals the actual single-file
research source, and clones that immutable baseline into independent adaptive and static LocalStore
roots. Domain/application services own campaign, arm-intent, and research-report decisions;
LocalStore validates append-only graphs; the runtime alone owns filesystem placement and paired
execution. Arm ticks and candidates do not enter the primary Arena store. The report is diagnostic
and remains unadjudicated. A deterministic `ResearchControlCampaignPaperSchedule` freezes every
report slot before paper effects. Candidate-bearing arm stores retain their own TradingRuns and
Ledger evidence; a coordinator-owned `ResearchControlCampaignPaperStartBatch` is the compact
cross-arm witness that paired first and repeated ticks used one shared public market/execution
snapshot. A bounded runtime executor derives one next action from append-only evidence, runs source
and strict confirmation windows through existing paper services, and closes every candidate slot
with one arm-local `ResearchControlCampaignPaperSlotOutcome`. The collector replicates those exact
slot outcomes to the coordinator and the application adjudicator persists one authority-closed
`ResearchControlCampaignOutcome`. Existing graph and outcome records replay without reopening
completed effects. `createResearchControlCampaignPaperRuntime` is the canonical internal factory
for these coordinators, the evidence loader, executor, and interruptible runner, while
`runResearchControlCampaign` exposes an optional single-step hook.
`createResearchControlCampaignPaperRuntimeArm` is the lower composition boundary. It binds one
arm-local store and session service to the existing comparison, activation, tick, checkpoint,
qualification, verdict, confirmation, and release services. One activation coordinator owns the
arm's source and confirmation session attempts. Confirmation execution projects one durable
transition at a time; a window `next_wake_at` becomes an executor wait step, and restart recovery
stops an unowned running attempt instead of adopting it.
Domain and application services also own `ResearchControlStudy`, which precommits 6 to 30 exact
campaign IDs under one frozen condition and baseline before any planned campaign is stored.
LocalStore enforces that order and exact graph, while `ResearchControlStudyOutcome` consumes every
terminal planned campaign outcome under one fixed paired exact sign test. Its causal scope is
same-baseline stochastic replication only, with no early stopping and no direct policy mutation.
The runtime `ResearchControlStudyExecutor` derives the earliest legal action from those records,
composes one campaign through terminal paper outcome per advance, and reloads exact persisted bytes
before progressing. Its default arm path opens each copied LocalStore root and receives a session
service bound to that exact store before applying the arm factory; explicit custom arm composition
remains available. `createResearchControlStudyRuntime` adds a sequential runner without a second
progress record; restart therefore reconstructs state from the evidence graph.
`ResearchControlStudyProcessSupervisor` adds the process-level queue without adding another durable
record. One composition root discovers incomplete studies from exact study/outcome lists, orders
them by commitment time and ID, opens one injected runtime, verifies persisted completion, and
rescans until caught up. It fails before later work when discovery, runtime opening, execution, or
completion persistence is invalid. `ResearchControlStudyCommitmentCoordinator` is the internal
pre-discovery application component. It derives one deterministic, bounded study from the latest
exact TradingPromotion, its sealed confirmation campaign, the selected managed-agent identity, and
repository policy. It retains the campaign's exact numeric, market-data, and paper settings,
normalizes comparison mode to `champion_challenge`, bounds the queue at one incomplete study, and
uses LocalStore create-only publication to resolve same-root process races without overwrite. Its
committed, existing, or deferred result is operational state only; malformed or drifted evidence
fails closed and it grants no downstream authority. `ResearchControlStudyScheduler` invokes this
component before each process-local supervisor cycle under `buildServer`: default startup follows
Store initialization and paper recovery, a bounded interruptible wait considers later promotions,
and shutdown drains the study path before CandidateArena and shared paper sessions. The server
runtime reconstructs each campaign only from its persisted study condition and revalidates the
configured research-agent identity.
`ResearchControlStudyExecutionLease` is the outer same-host ownership boundary. A filesystem
adapter under the shared LocalStore root atomically claims the oldest pending study; one renewable
session guards every executor advance and releases on completion, failure, or shutdown. Active
snapshots are operational mutable state, while released or confirmed-dead expired snapshots become
immutable terminal history. Alive or liveness-unknown owners fail closed; takeover requires expiry
and a confirmed-absent PID on the same host. This is runtime coordination only, not evidence or
policy authority. Multi-host storage, PID namespaces, and distributed fencing remain outside.
Application services separately derive `ResearchAllocationPolicyDecision` from one exact persisted
study and outcome. Only eligible supported same-baseline adaptive evidence can approve the studied
policy digest; every other valid outcome is not approved and cannot select static control. Before
an uncontrolled Arena tick, the allocation resolver chooses explicit caller intent first, then the
latest approved decision for the current policy digest, then the repository adaptive default.
`CandidateArenaResearchAllocation` seals the chosen basis before effects, and LocalStore reloads
and verifies decision/outcome digests and time order. This grants research-policy selection only;
promotion and champion runtime handoff remain outside the boundary.
`ResearchWorker` is a stable logical identity for one direction and exact managed-agent profile,
not a provider process. Its stable workspace owns per-tick sanitized notebooks. Every new
commitment still runs isolated candidate bytes and closes through one append-only
`ResearchWorkerCheckpoint` with a contiguous prior link, bounded cumulative submission accounting,
zero retry authority, and completed or failed-closed status. Restart reconciliation runs before a
new tick effect: it reconstructs a terminal checkpoint from an exact persisted admission or closes
the orphan as restart recovery. It never adopts a process or recreates evaluator-held sealed state.
`Improvement` remains a compatibility/AAR lineage record; it must not pull the architecture back
toward one best artifact being improved in place.

The separation is an evaluator-isolation control, not a proof of economic generalization or a
complete reward-hacking defense. Prospective continuous paper comparison remains above it.

Selected Paper Trading is a running `TradingSystem` session, not a snapshot-driven decision helper.
The TradingSystem owns its decision cadence and emits `OrderRequest`s when its own strategy, tools,
market subscriptions, internal agent loop, or risk logic says to act. Paper observations are
checkpoint/readback events: refresh market evidence, consume newly emitted orders, record Gateway
validation and fake execution, or record no-order continuity.

Candidate generation may be parallel across stable `ResearchWorker` and `ResearchDirection` lanes
or iterative across new tick commitments. The architecture should preserve candidate population memory: losing
candidates, failed directions, findings, parent links, and lineage are inputs to the next
generation.

Operator control is product-facing through Ouroboros commands, not provider commands. The Desktop
app is the primary interactive operator surface, while the CLI remains the complete baseline for
headless operation and automation. CLI, Desktop, Web, and Ink TUI share `POST /api/commands` for
actions, `GET /api/operator` for state, and the same runtime/store-backed session data.
`AgentProfile` records own managed provider runtime directories such as `codex`, and the researcher
stores a provider selection from the available managed providers. Codex is the implemented provider
adapter today, while future providers such as Claude Code must remain behind the same adapter
boundary.

Runtime implementation follows a physical controller/service/adapter split:

- `packages/domain`: domain records, read models, command descriptors, and vocabulary. It must not
  import application, adapters, runtime, UI, vendor SDKs, or persistence implementations.
- `packages/application`: product controllers, command dispatch, application services,
  CandidateArena use cases, read-model builders, and ports.
- `packages/adapters`: concrete implementations for Codex, fixtures, Binance public market data,
  Sandboxes, subprocess execution, and other outer systems.
- `apps/runtime`: Fastify composition root plus controller route modules. It wires concrete
  adapters into application controllers; product mutations enter through `POST /api/commands`.
- `apps/cli`, `apps/operator-tui`, `apps/operator-web`, and `apps/operator-desktop`: operator
  interfaces over the same command descriptors, `GET /api/operator`, and `POST /api/commands`.
  CLI-only local operations use the local Ouroboros controller rather than importing provider
  implementations. The Desktop app is the primary Tauri operator app and may launch or reuse the
  local runtime process through the packaged runtime sidecar contract. `apps/operator-web` remains
  the shared Operator UI source and browser/development surface; it must not become a separate
  product authority, command bus, or store.

Directory shape should reveal ownership before a developer opens a file. Prefer nested directories
when several names share a durable prefix: use `agent/profiles.ts`, `agent/trading-cycle.ts`,
`candidate/arena.ts`, `trading/gateway/runtime-binding.ts`, or `research/orchestration/*` instead
of long flat `agent-*`, `candidate-*`, or `trading-*` runs. Kebab-case is still fine for a leaf file
or route name when it names one operation; it should not replace a visible tree.

Adapters are grouped by the external system or concrete implementation boundary they attach:
`packages/adapters/src/codex/*`, `binance/*`, `fixture/*`, and `sandbox/*`. Ouroboros product logic
belongs in `packages/application`; adapter folders should only translate between application ports
and outside systems.

Binance public market data is one of those adapter boundaries. Application Gateway code depends on
`GatewayMarketDataPort` / `MarketDataPort`; concrete REST/SDK/fetch behavior, TTL cache, and
in-flight public read sharing belong in `packages/adapters/src/binance/*`. `TradingSystem`
candidates emit `OrderRequest`s and never attach directly to Binance.

## Architecture Pattern Guide

Ouroboros uses Hexagonal Architecture, Clean Architecture, Layered Architecture, Domain-Driven
Design, and CQRS as the default design frame.

- Hexagonal Architecture: domain and application services depend on ports, while Codex, Binance,
  Sandbox, filesystem, HTTP, CLI, TUI, and Web UI stay outside as adapters or interfaces.
- Clean Architecture: dependencies point inward. Domain contracts must not import runtime,
  adapter, UI, vendor SDK, or filesystem implementation modules.
- Layered Architecture: interfaces call controllers; controllers call services; services coordinate
  domain contracts and ports; adapters implement ports; composition roots wire concrete instances.
- Domain-Driven Design: durable names follow the CandidateArena taxonomy and authority boundaries.
  Domain nouns are not transport names, UI component names, or provider implementation names.
- CQRS: product-facing mutations are `OuroborosCommand` envelopes, while operator state is returned
  through read models such as `OperatorReadModel`. Do not smuggle mutation behavior into read-model
  builders or UI fetch helpers.

Use these patterns deliberately:

| Pattern | Use when | Current anchor |
| --- | --- | --- |
| Strategy | runtime-selectable algorithm, policy, scoring, ranking, or risk behavior | evaluation/ranking/risk policies |
| Factory | choosing one implementation from provider, runner, sandbox, or exchange options | agent and artifact runner creation |
| Builder | assembling complex read models, prompt context, Ledger summaries, or command responses | Operator and CandidateArena read models |
| Adapter | integrating external tools, vendor SDKs, subprocesses, sandboxes, stores, or exchanges | Codex, Binance, Sandbox, LocalStore |
| Decorator | adding timeout, audit, retry, logging, metric, or authority guard behavior around a port | future cross-cutting port wrappers |
| Observer | reacting to tick completed, candidate created, evidence recorded, or failure events | future application events |
| Middleware | validating or shaping transport/command envelopes before controller dispatch | HTTP rate limits and command validation |
| Registry | publishing discoverable commands, providers, plugins, or handler catalogs | Ouroboros command descriptors |
| Plugin | packaging future agent, exchange, evaluator, or sandbox capabilities behind descriptors | future provider packages |
| Dependency Injection | giving services concrete port implementations at composition roots | server runtime wiring |

When adding a feature, choose the smallest pattern that solves the concrete extension point. Do not
add a pattern because it is available. If a feature changes a public command, provider, exchange,
or evidence boundary, update the registry/port first, then implement the adapter or service.

This file is a compact development map. The canonical architecture contract lives in
[Architecture Governance](docs/architecture-governance.md), with API naming in
[API And Command Contract](docs/api-command-contract.md) and vocabulary in
[Naming Taxonomy](docs/naming-taxonomy.md).

## Local Layers

- `apps/runtime`: Fastify runtime server and HTTP composition root.
- `apps/cli`: installable `ouroboros` command-line interface.
- `apps/operator-tui`: Ink action console for the same Operator read model and commands.
- `apps/operator-web`: shared Operator UI source and browser/development surface for inspecting
  Candidate Arena state, selected-candidate `PaperTradingEvaluation`, and paper Ledger evidence
  through the shared command/read-model contract.
- `apps/operator-desktop`: primary Tauri operator app that loads the shared Operator UI bundle
  through the platform WebView, launches or reuses the local runtime through the packaged sidecar
  hook, keeps the runtime visible from the macOS menu bar, restores the operator window from the
  tray, and hides rather than quits on window close as described in
  [Operator Desktop Performance And Release](docs/operator-desktop-performance-release.md).
- `packages/domain`: shared contracts and domain types.
- `packages/application`: command/query controllers, services, use cases, ports, and read-model builders.
- `packages/adapters`: concrete provider, exchange, sandbox, subprocess, and fixture adapters.
- `packages/local-store`: durable local filesystem store primitives.
- `.agents`: repo-local coding-agent harness and reusable work skills.

## Current Development Boundary

Preserve these separations: Candidate Arena state vs selected Trading Run execution,
SystemCode artifact identity vs protocol-scoped behavior identity, TradingSystem identity vs
ResearchPreflight evidence, research-time replay/backtest vs continuous
paper trading evaluation, replay score vs exact PaperTradingHandoffConformance, handoff conformance
vs economic/qualification authority, entrypoint bytes vs complete declared artifact closure,
TradingRun control vs OrderRequest generation, paper observation
checkpoint vs TradingSystem decision cadence, provider output as trace material rather than proof,
and persistence with enough attribution to replay why state exists.
Docker, Compose, Docker Sandboxes `sbx`, placement, adapter, and host paths stay below the Sandbox
boundary.

## Repo Architecture Sources

- [Project Direction](docs/project-direction.md)
- [Architecture Governance](docs/architecture-governance.md)
- [API And Command Contract](docs/api-command-contract.md)
- [Naming Taxonomy](docs/naming-taxonomy.md)

## Validation Surface

- Architecture pattern and layer guardrails: `npm run check:architecture`
- Naming surface changes: `npm run check:naming`
- Documentation and agent-policy changes: `bash scripts/check-docs.sh`, `bash scripts/check-secrets.sh`, `git diff --check`
- Runtime or package changes: add the relevant tests, then run `npm test` and `npm run typecheck`
