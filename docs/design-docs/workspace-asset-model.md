# Workspace Asset Model

AutoKairos treats the agent workspace as the primary strategy-asset boundary.

The workspace is not only a file bundle.
It is the durable local home for the managed-agent system that produces, evaluates, checkpoints,
exports, and runs trading strategy state.

## Core Rule

- the workspace is the asset
- `strategy.json` is the canonical entrypoint
- the official client does not mutate this structure directly
- the application service owns machine writes and invariant enforcement
- the orchestrator and agents operate inside this asset boundary
- secrets and host trust material stay outside it

## Top-Level Entities

- `artifact`
  The strategy asset lineage
- `checkpoint`
  An addressable snapshot that belongs to an artifact
- `collection`
  A logical storage unit that materializes as one `source + UTC hour` shard in the current
  implementation
- `entry`
  One source-centered metadata card owned by one collection
- `blob`
  An immutable content-addressed body object

## Identifier Direction

- `artifact_id`: `UUIDv7`
- `checkpoint_id`: `UUIDv7`
- `collection_id`: `UUIDv7`
- `entry_id`: `UUIDv7`
- `blob_id`: `sha256:<lowercase-hex>`
- `slug`: human-facing alias, not the primary identifier

## `strategy.json`

`strategy.json` should stay thin.

It is not the entire workspace in one file.
It should act as the root bootstrap/index with two top-level surfaces:

- `active`
- `indexes`

### `active`

The minimum current set is:

- `live_lane_ref`
- `current_checkpoint_ref`
- `export_policy_ref`

### `indexes`

The current minimum direction is:

- `checkpoints_ref`
- `agents_ref`
- `environments_ref`
- `collections_ref`
- `imports_ref`
- `operations_ref`
- `sessions_ref`

## Managed-Agent Workspace Content

The workspace asset is where AutoKairos stores the durable managed-agent materials that must be
inspectable, exportable, and replayable.

That includes:

- agent definitions
- environment definitions
- durable session artifacts
- event logs
- live lane state
- checkpoint snapshots
- source collections, entries, and blobs
- import/export manifests
- operation records

This does not require a fixed semantic or episodic memory taxonomy.
The contract is workspace-first, not memory-taxonomy-first.

## Export Model

- export is checkpoint-based
- exporting the current live asset creates a fresh checkpoint first
- export stays live-centered
- any artifact that materially affects live trading should remain export-targetable
- sanitized export must exclude secrets and user-identifying material

## Storage Direction

- workspace-first hybrid storage
- v0 materialization is file-first JSON inside the workspace
- the application service seeds a mutable development workspace under `var/dev-workspace/`
- file/blob storage is authoritative for the current scaffold
- a document-oriented embedded store can be added later behind the same workspace contract
- storage backends should remain swappable behind the same asset contract
- document-oriented embedded storage may later accelerate mutable indexes and state, but the
  workspace boundary remains the source of truth

## Current V0 Workspace Paths

- `strategy.json` is the canonical entrypoint
- `live/live-lane.json` defines the active lane and state refs
- `agents/` should hold provider-neutral agent definitions and related workspace materials as the
  managed-agent topology hardens
- `environments/` should hold configured runtime surfaces for those agents as the environment model
  hardens
- `state/dashboard.json` carries the dashboard-facing live context
- `state/decisions.json` stores short-form decision history
- `indexes/sessions.json` catalogs live session documents under `sessions/items/<session_id>/`
- `state/eval-summaries.json` catalogs evaluation evidence summaries under
  `eval-summaries/items/<summary_id>/`
- `state/positions.json` and `state/orders.json` preserve current state plus event history
- `checkpoints/index.json` is the addressable checkpoint timeline
- `imports/index.json` is the staged sanitized-import registry
- `operations/index.json` is the durable workspace-wide service-operation registry
- `checkpoints/items/<checkpoint_id>/` stores immutable checkpoint snapshots
- `exports/generated/<checkpoint_id>/` stores live-centered export bundles derived from checkpoints
- `imports/items/<import_id>/` stores staged sanitized bundles without mutating the active live
  lane
- `operations/items/<operation_id>.json` stores addressable service-operation records

## Service-Owned Access Rules

- the official client should browse workspace documents through a service-owned catalog instead of
  hard-coding file paths
- workspace search should stay service-owned so the client queries searchable documents and content
  through the same boundary
- workspace documents should expose service-owned backlinks so the asset graph stays navigable
  without the client reading storage directly
- staged imports should be comparable against the current live workspace through the same service
  boundary before activation
- staged imports should also be activatable through the service boundary, promoting the staged
  workspace into the live asset without letting the client mutate workspace files directly
- staged import activation should be preflight-gated by the service layer so missing entrypoints,
  missing live-state refs, or unsanitized bundles block activation before the live workspace is
  touched
- collection manifests, entry shards, staged import manifests, and staged import bundle manifests
  should appear in the service-owned workspace document catalog instead of being client-side ad hoc
  additions
- individual operation records should be addressable workspace documents, not just rows in an
  operations summary list
- restoring checkpoints or activating imports should preserve service-owned roots such as
  `checkpoints/`, `imports/`, `operations/`, generated exports, and secret-bearing directories so
  the workspace can rotate live state without destroying its audit trail
