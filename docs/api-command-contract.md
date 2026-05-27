# API And Command Contract

The primary operator contract is shared by CLI, TUI, Web UI, and runtime HTTP:

- `GET /api/operator`
- `POST /api/commands`

Compatibility routes can remain, but new product-facing actions must use the command contract.
Commands are operator controls over the doctrine, not provider commands.

## Command Authority

`packages/domain` owns the canonical command catalog through `OuroborosCommand`,
`OuroborosCommandKind`, and `OUROBOROS_COMMAND_REGISTRY`. UI, CLI, TUI, and route code must not
invent mutation names outside that registry.

Current command groups:

- `arena`: status, start, stop, tick. `arena.tick` is one research round: candidate generation,
  external Evaluation, leaderboard update, findings, and lineage.
- `candidate`: select, run selected paper evidence. `candidate.select` chooses one candidate for
  proof, and `candidate.paper_evidence.run` creates paper Gateway/Ledger evidence for that selected
  candidate only.
- `agent_provider`: managed provider status, setup, login start, probe
- `researcher`: researcher provider selection

## Read Model Authority

`OperatorReadModel` is the shared operator state for all user surfaces. It must show the
CandidateArena status, leaderboard, selected candidate, paper evidence summary, agent/provider
status, latest ticks, latest candidates, latest command results, and authority flags.

Read models are projections. They must not trigger candidate generation, paper evidence, provider
login, or exchange behavior.

Candidate, Paper Evidence, and Live are separate states in every operator surface. `Run paper
evidence` is proof gathering, not live promotion.

## Compatibility Policy

Existing compatibility routes remain available while they delegate to the same application services
or command/query controllers. Compatibility is allowed for older scripts and tests, not as a reason
to add new primary workflows outside `/api/operator` and `/api/commands`.

The product-facing command name is `ouroboros`. Adapter names such as Codex, fixture, Binance, or
future Claude Code remain provider settings or implementation details unless the domain registry
explicitly exposes them.
