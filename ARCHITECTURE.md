# Architecture

Ouroboros is organized around the Candidate Arena trust kernel:

```text
CandidateArena
-> parallel or iterative TradingSystem candidates
-> SystemCode
-> Evaluation
-> leaderboard, findings, and lineage
-> selected TradingRun
-> Sandbox
-> Gateway
-> Ledger
```

Canonical naming surface: Candidate Arena -> Trading System -> System Code -> Evaluation -> selected Trading Run -> Sandbox -> Gateway -> Ledger.

Researchers and LLM agents are candidate generators. Evaluation is the authority boundary for
candidate ranking, and paper `Gateway`/`Ledger` evidence belongs only to the selected Trading Run,
not to every candidate. `Improvement` remains a compatibility/AAR lineage record; it must not pull
the architecture back toward one best artifact being improved in place.

Candidate generation may be parallel across `ResearchWorker` and `ResearchDirection` lanes or
iterative across ticks. The architecture should preserve candidate population memory: losing
candidates, failed directions, findings, parent links, and lineage are inputs to the next
generation.

Operator control is product-facing through Ouroboros commands, not provider commands. The CLI,
Operator UI, and Ink TUI share `POST /api/commands` for actions and `GET /api/operator` for state.
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
- `apps/cli`, `apps/operator-tui`, and `apps/operator-web`: operator interfaces over the same
  command descriptors, `GET /api/operator`, and `POST /api/commands`. CLI-only local operations use
  the local Ouroboros controller rather than importing provider implementations.

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
- `apps/operator-web`: operator UI for inspecting Candidate Arena state and selected-candidate paper evidence through the shared command/read-model contract.
- `packages/domain`: shared contracts and domain types.
- `packages/application`: command/query controllers, services, use cases, ports, and read-model builders.
- `packages/adapters`: concrete provider, exchange, sandbox, subprocess, and fixture adapters.
- `packages/local-store`: durable local filesystem store primitives.
- `.agents`: repo-local coding-agent harness and reusable work skills.

## Current Development Boundary

Preserve these separations: Candidate Arena state vs selected Trading Run execution,
TradingSystem identity vs Evaluation evidence, Evaluation evidence vs paper evidence, TradingRun
control vs OrderRequest generation, provider output as trace material rather than proof, and
persistence with enough attribution to replay why state exists. Docker, Compose, Docker Sandboxes
`sbx`, placement, adapter, and host paths stay below the Sandbox boundary.

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
