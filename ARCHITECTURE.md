# Architecture

AutoKairos is an installable trading app with a built-in managed-agent control plane.

The product should feel like one local application, not a bundle of scripts.
The agent side should feel alive by default, but the live-trading path must remain narrow,
auditable, and structurally harder to mutate than the rest of the system.

## Design Sources

This architecture intentionally combines two families of ideas:

- Anthropic managed-agent concepts:
  - `agent`
  - `environment`
  - `session`
  - `events`
  - `brain / hands / session` separation
- AutoKairos core system patterns:
  - `Hexagonal Architecture`
  - `CQRS-light`
  - `Supervisor / Worker`
  - `Snapshot + Event Journal`
  - `State Machine + Policy`
  - `Adapter / Strategy`

The product also borrows the feel of an `orchestrator + agent workforce + runtime` system from
Multica, while remaining local-first and trading-specific instead of becoming a general cloud
agent platform.

## Pattern Stack

- `Hexagonal Architecture`
  Domain and application logic stay independent from Tauri, Binance, provider CLIs, storage
  engines, and UI concerns.
- `CQRS-light`
  Read models and write commands stay separate, but the system does not force full event sourcing.
- `Supervisor / Worker`
  The orchestrator owns scheduling and lifecycle; workers perform ingest, evaluation, export,
  import, and execution tasks.
- `Snapshot + Event Journal`
  Current state is snapshot-oriented, while critical activity remains replayable through journals.
- `State Machine + Policy`
  Live mode, intervention mode, import activation, export flow, and execution safety use explicit
  state and policy objects instead of ad hoc branching.
- `Adapter / Strategy`
  Providers, exchange APIs, storage backends, and evaluators stay swappable behind stable
  contracts.

## Bounded Contexts

- `app shell`
  The installable desktop shell and trading dashboard users launch.
- `client`
  The React UI that renders read models and sends commands, but does not mutate the workspace
  directly.
- `transport`
  Tauri command handlers that translate desktop invocations into application-layer queries and
  mutations.
- `application service`
  The official machine boundary for validation, invariants, locking, checkpoint/export/import
  workflows, and read/write orchestration.
- `workspace asset`
  The local strategy workspace that acts as the primary strategy-asset boundary.
- `orchestrator`
  The local control plane that coordinates agent sessions, environment usage, background work, and
  promotion logic.
- `agents`
  Provider-neutral task workers declared inside the workspace asset and run by the orchestrator.
- `environments`
  Configured execution surfaces used by agents for tools, files, and runtime dependencies.
- `sessions and event logs`
  Durable ordered work history that lives outside any one model context window.
- `execution core`
  The safety-critical live-trading bounded context for order placement, position safety, and
  invariant enforcement.
- `adapters`
  Provider, exchange, storage, and external-data implementations that satisfy domain/application
  interfaces.
- `docs tree`
  The durable markdown operating memory for design, product, and implementation decisions.

## Managed-Agent Adaptation

AutoKairos adopts Anthropic's managed-agent vocabulary, but it adapts it for a local,
workspace-centered, trading-specific product.

- `agent`
  A provider-neutral worker definition that bundles brain choice, prompts, tools, skills, and
  policy refs.
- `environment`
  The configured runtime boundary where an agent is allowed to act.
- `session`
  A durable running unit of work for one agent inside one environment.
- `events`
  The append-only ordered activity record for a session.
- `orchestrator`
  The AutoKairos-specific control plane that creates sessions, routes work, manages retries,
  coordinates evaluation, and promotes artifacts.

AutoKairos does not copy the hosted Anthropic product shape.
It keeps the managed-agent concepts while relocating them into the local workspace asset and local
application service.

## Live-Path Separation

The agent plane and the execution plane are different bounded contexts.

- agents may inspect code, docs, data, and runtime context
- agents may propose or materialize future strategy changes inside the workspace asset
- live execution must remain deterministic and harder to mutate
- candidate changes must pass isolated backtest and isolated paper trading before promotion
- live trading must never depend directly on an unreviewed experimental workspace
- the current scaffold seeds a mutable workspace from `templates/strategy-workspace/` into
  `var/dev-workspace/`

## Current Live-Path Invariants

- every live position must have an exchange-native protective stop
- critical execution failures are owned by the execution core, not delegated to agents
- model issues may block new entries, but execution invariants may trigger stronger intervention
- users always keep ultimate control over trading state and emergency actions
- official clients never mutate workspace files directly; all machine writes go through the
  application service

## Documentation Map

- [docs/design-docs/index.md](docs/design-docs/index.md)
  Durable design beliefs and technical model
- [docs/design-docs/vocabulary.md](docs/design-docs/vocabulary.md)
  Canonical architecture vocabulary and naming rules
- [docs/design-docs/agent-runtime.md](docs/design-docs/agent-runtime.md)
  Orchestrator, agent, environment, session, and event-log model
- [docs/design-docs/client-architecture.md](docs/design-docs/client-architecture.md)
  Desktop client and service-boundary model
- [docs/design-docs/workspace-asset-model.md](docs/design-docs/workspace-asset-model.md)
  Strategy workspace, entity model, and entrypoint contract
- [docs/product-specs/index.md](docs/product-specs/index.md)
  Product behavior and trading-spec documents
- [docs/exec-plans/active/product-definition.md](docs/exec-plans/active/product-definition.md)
  Current active product-definition summary
- [docs/references/index.md](docs/references/index.md)
  Source-backed analysis and external reference notes
