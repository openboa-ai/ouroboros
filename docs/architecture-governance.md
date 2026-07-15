# Architecture Governance

Ouroboros uses Domain -> Application -> Adapters -> Controllers -> Interfaces as the physical
architecture shape. The product doctrine stays simple: generate many candidates, preflight quickly,
paper trade selected candidates continuously, keep memory, repeat, and read Ledger evidence from the
selected `PaperTradingEvaluation`. Architecture patterns are subordinate to that loop.

## Layer Rules

- `packages/domain`: domain records, command descriptors, read models, and vocabulary. It must not
  import application, adapters, runtime, UI, vendor SDKs, or persistence implementations.
- `packages/application`: command dispatch, application services, use cases, ports, read-model
  builders, and product controllers.
- `packages/adapters`: concrete Codex, fixture, Binance public market, Sandbox, subprocess, store,
  and other outer-system implementations.
- `apps/runtime`: Fastify HTTP composition root plus controller route modules. It wires concrete
  adapters into application controllers; product mutations enter through `POST /api/commands`.
- `apps/cli`, `apps/operator-tui`, `apps/operator-web`, and `apps/operator-desktop`: user
  interfaces over the same command and read-model contracts. They must not import concrete
  provider, exchange, sandbox, or store implementations. `apps/operator-desktop` is the primary
  Tauri operator app; it may launch or reuse the runtime process through the packaged sidecar hook,
  load the shared Operator UI bundle, and expose macOS menu bar runtime status. `apps/operator-web`
  remains shared UI source plus browser/development surface. Neither surface may introduce a
  separate product API, separate store, or renderer-side Node authority.

## Directory Cohesion

Repository structure should make the boundary visible without forcing another abstraction layer.
Use directories when a repeated prefix is carrying ownership:

- `packages/application/src/agent/*`: managed agent profiles and agent-facing product cycles.
- `packages/application/src/candidate/*`: CandidateArena, candidate evaluation, and materialization
  use cases.
- `packages/application/src/research/*`: research orchestration and sealed evaluation helpers.
- `packages/application/src/trading/*`: TradingSystem execution, replay, gateway, and research
  application logic.
- `packages/application/src/trading/paper/*`: selected-candidate continuous paper trading use
  cases, including observation recording, fake account/order state transitions, and runner
  scheduling contracts.
- `packages/adapters/src/codex/*`, `binance/*`, `fixture/*`, `sandbox/*`: concrete outside-system
  adapters grouped by the thing they integrate with.
- `apps/runtime/src/controllers/*`: HTTP request validation and response mapping.
- `apps/runtime/src/registry/*`: route-module registration.

Kebab-case is allowed for a leaf operation name such as `runtime-binding.ts`, but repeated
prefix-heavy files should be folded into a tree. Do not add a new service or port only to satisfy
the directory shape; move code first, then introduce an abstraction only when a real extension
point exists.

## Design Frame

Use Hexagonal Architecture, Clean Architecture, Layered Architecture, Domain-Driven Design, and
CQRS as the default frame:

- Hexagonal Architecture: application services depend on ports; Codex, Binance, Sandbox,
  filesystem, HTTP, CLI, TUI, Web UI, and Desktop app stay outside as adapters or interfaces.
- Clean Architecture: dependencies point inward toward domain/application contracts.
- Layered Architecture: interfaces call controllers; controllers validate and dispatch; services
  orchestrate use cases through ports; adapters implement ports; composition roots wire instances.
- Domain-Driven Design: durable names follow the CandidateArena taxonomy and authority boundaries.
- CQRS: mutations use `OuroborosCommand`; read state uses `OperatorReadModel` and related read
  models. Do not hide mutations inside read builders or UI fetch helpers.
- Derived research diagnostics such as `ResearchPopulationDiversity` must reconstruct append-only
  evidence through pure application builders, expose aggregate read state only, and carry no
  scheduling, evaluation, admission, qualification, or promotion authority.

## Pattern Selection

Use the smallest pattern that solves the extension point. These patterns exist to let providers,
evaluators, sandboxes, research directions, and evidence boundaries evolve without changing the
CandidateArena doctrine:

| Pattern | Use when |
| --- | --- |
| Strategy | scoring, ranking, risk, execution, or other runtime-selectable policy |
| Factory | selecting a provider, exchange, sandbox, runner, evaluator, or adapter implementation |
| Builder | assembling read models, prompt context, Ledger summaries, findings, lineage, or command responses |
| Adapter | integrating Codex, future Claude Code, Gemini-powered agents, vendor SDKs, subprocesses, sandboxes, stores, exchanges, or external tools |
| Decorator | adding timeout, retry, logging, audit, metrics, reproducibility, or authority guards around a port |
| Observer | reacting to tick completion, candidate creation, evidence recording, or failures |
| Middleware | validating or shaping transport and command envelopes before controller dispatch |
| Registry | publishing discoverable command, provider, plugin, or handler catalogs |
| Plugin | packaging future provider, exchange, evaluator, or sandbox capabilities behind descriptors |
| Dependency Injection | wiring concrete adapters into services at composition roots |

Do not add a pattern because it is fashionable. If a feature changes a public command, provider,
exchange, evaluator, sandbox, or evidence boundary, update the domain registry or application port
before implementing concrete behavior.

## Market Data Boundary

Binance public market data is a Gateway concern. Application code depends on `MarketDataPort` /
`GatewayMarketDataPort`; concrete Binance REST, WebSocket, SDK, fetch, cache, and local order book
behavior belongs under `packages/adapters/src/binance/*`. A `TradingSystem` must never import
Binance, read private account state, sign requests, open listenKey/user-data streams, mutate
leverage/margin, or submit live orders. It owns decision cadence and emits bounded `OrderRequest`s
when it chooses to trade; Gateway validation, market snapshot cache, fake paper execution, and
Ledger recording produce evidence.

Paper observations are checkpoint/readback events over the running TradingSystem. They may record
the latest market snapshot, active runner state, newly emitted orders, no-order continuity, score,
and Ledger evidence. They must not make the Gateway or runner synthesize a trade decision simply
because a public market snapshot was refreshed.

The paper command and observation use cases belong in `packages/application/src/trading/paper/*`.
`apps/runtime` may wire the store, Gateway market-data port, sandbox adapters, provider factory,
and timer instance, but it should not own `trading_run.start/observe/stop` orchestration, provider
session lifecycle, paper account transitions, observation records, TradingSystem event processing,
or Ledger decision assembly.

`PaperTradingEngine` is the stateful fake exchange/account boundary. It owns wallet/equity,
available balance, margin, position, average entry, realized/unrealized PnL, open/partial/filled/
canceled orders, fees, slippage, funding, and order fill state. Market orders fill from routed
Binance `/public` `bookTicker`; limit orders fill only from routed `/market` `aggTrade` evidence.
Routed WebSocket is primary for live public evidence; REST is the cold-start, snapshot, backfill,
and gap-recovery anchor. Public execution evidence failure records a failed observation and leaves
the TradingSystem event retryable.

The Gateway market data adapter may cache public exchangeInfo for one hour, server time and
premium/mark price for five seconds, and one-minute klines for thirty seconds. It should share
in-flight reads for the same key so continuous `PaperTradingEvaluation` observations do not fan out
duplicate public reads. Local order book sync follows Binance's `depth` rule: buffer WebSocket
updates while loading the REST snapshot, drop events with `u < lastUpdateId`, apply the first event
where `U <= lastUpdateId <= u`, then require every next event's `pu` to equal the previous `u`.
When that continuity breaks, mark a gap, reset from REST snapshot, and keep unsupported fills
retryable.
