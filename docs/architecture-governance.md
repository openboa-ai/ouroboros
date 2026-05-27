# Architecture Governance

Ouroboros uses Domain -> Application -> Adapters -> Controllers -> Interfaces as the physical
architecture shape. The product doctrine stays simple: generate many candidates, evaluate
externally, keep memory, repeat, and prove only the selected candidate with paper evidence.
Architecture patterns are subordinate to that loop.

## Layer Rules

- `packages/domain`: domain records, command descriptors, read models, and vocabulary. It must not
  import application, adapters, runtime, UI, vendor SDKs, or persistence implementations.
- `packages/application`: command dispatch, application services, use cases, ports, read-model
  builders, and product controllers.
- `packages/adapters`: concrete Codex, fixture, Binance public market, Sandbox, subprocess, store,
  and other outer-system implementations.
- `apps/runtime`: Fastify HTTP composition root plus controller route modules. It wires concrete
  adapters into application controllers; product mutations enter through `POST /api/commands`.
- `apps/cli`, `apps/operator-tui`, and `apps/operator-web`: user interfaces over the same command
  and read-model contracts. They must not import concrete provider, exchange, sandbox, or store
  implementations.

## Design Frame

Use Hexagonal Architecture, Clean Architecture, Layered Architecture, Domain-Driven Design, and
CQRS as the default frame:

- Hexagonal Architecture: application services depend on ports; Codex, Binance, Sandbox,
  filesystem, HTTP, CLI, TUI, and Web UI stay outside as adapters or interfaces.
- Clean Architecture: dependencies point inward toward domain/application contracts.
- Layered Architecture: interfaces call controllers; controllers validate and dispatch; services
  orchestrate use cases through ports; adapters implement ports; composition roots wire instances.
- Domain-Driven Design: durable names follow the CandidateArena taxonomy and authority boundaries.
- CQRS: mutations use `OuroborosCommand`; read state uses `OperatorReadModel` and related read
  models. Do not hide mutations inside read builders or UI fetch helpers.

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
