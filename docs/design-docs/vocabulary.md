# Vocabulary

This file defines the canonical architecture vocabulary for AutoKairos.

If code, docs, or comments use older names, prefer the terms in this file.

## Core Terms

- `workspace asset`
  The primary strategy-asset boundary. It is the local home for strategy definition, agent
  materials, checkpoints, collections, session records, and exportable state.
- `strategy.json`
  The canonical entrypoint at the root of a workspace asset. It is a thin bootstrap/index file,
  not a giant all-in-one configuration dump.
- `application service`
  The official machine boundary that owns validation, invariants, locking, migrations, command
  execution, read-model assembly, export rules, and import/preflight rules.
- `client`
  The official UI surface that reads via the application service and sends commands through it.
- `orchestrator`
  The local control plane that coordinates agent sessions, environments, background work,
  evaluation, and promotion logic.
- `agent`
  A provider-neutral worker definition. An agent bundles a brain selection, prompt/skill/tool
  refs, policy refs, and environment compatibility.
- `environment`
  A configured runtime boundary used by an agent. It describes where an agent can run and what it
  can access.
- `session`
  A durable running unit of work for one agent in one environment.
- `event log`
  The append-only ordered record of activity for a session or operation.
- `execution core`
  The safety-critical live-trading bounded context responsible for order placement, position
  safety, invariant enforcement, and emergency intervention.
- `provider adapter`
  The implementation that connects an agent's brain contract to a concrete provider such as Codex
  or Claude.
- `checkpoint`
  An immutable snapshot of an artifact state. Checkpoints are addressable and typed
  (`promotion`, `export`, `incident`).
- `collection`
  The logical storage unit for source-centered records. In the current file-first implementation,
  one collection materializes as one `source + UTC hour` shard.
- `entry`
  A source-centered metadata card that belongs to exactly one collection.
- `blob`
  An immutable content-addressed body object referenced by entries or other documents.

## Naming Rules

- Prefer `orchestrator` over `resident supervisor`.
- Prefer `agent` over `researcher` or `trader` when describing generic managed-agent topology.
- Prefer `environment` over `sandbox` when the concern is the configured execution surface rather
  than low-level isolation mechanics.
- Prefer `session` over `thread` when referring to durable units of agent work inside the system.
- Prefer `event log` over loose phrases like `history` or `trace` when the ordered durable record
  matters.
- Prefer `workspace asset` over `bundle`, `workspace`, or `artifact` alone when the strategy
  boundary is the point.
- Prefer `application service` over `service layer` when talking about the official machine
  boundary the client uses.

## Intentional Distinctions

- `orchestrator` is not `execution core`
  The orchestrator manages agent work. The execution core manages live-trading safety.
- `agent` is not `provider`
  Agents are provider-neutral. Providers are brains behind adapters.
- `workspace asset` is not `embedded DB`
  The workspace asset is the boundary. Storage engines are implementation details inside it.
- `checkpoint` is not `export bundle`
  A checkpoint is an internal immutable snapshot. An export bundle is a sanitized, checkpoint-based
  delivery artifact.

## Terms To Avoid As Top-Level Architecture Names

- `resident supervisor`
- `research runtime`
- `researcher`
- `trader`
- `memory taxonomy`

These may still exist as lower-level implementation or product concepts, but they are not the
canonical top-level architecture vocabulary.
