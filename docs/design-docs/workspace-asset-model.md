# Workspace Asset Model

AutoKairos treats the agent workspace as the primary strategy-asset boundary.

## Core Rule

- the workspace is the asset
- `strategy.json` is the canonical entrypoint
- the official client does not mutate this structure directly
- the service layer owns machine writes and invariant enforcement

## Top-Level Entities

- `artifact`
  The strategy asset lineage
- `checkpoint`
  An addressable snapshot that belongs to an artifact
- `collection`
  A logical storage unit that materializes as one `source + UTC hour` shard in the current implementation
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
- `collections_ref`
- `sessions_ref`

## Export Model

- export is checkpoint-based
- exporting the current live asset creates a fresh checkpoint first
- export stays live-centered
- any artifact that materially affects live trading should remain export-targetable
- sanitized export must exclude secrets and user-identifying material

## Storage Direction

- workspace-first hybrid storage
- v0 materialization is file-first JSON inside the workspace
- the service layer seeds a mutable development workspace under `var/dev-workspace/`
- file/blob storage is authoritative for the current scaffold
- a document-oriented embedded store can be added later behind the same workspace contract
- storage backends should remain swappable behind the same asset contract

## Current V0 Workspace Paths

- `strategy.json` is the canonical entrypoint
- `live/live-lane.json` defines the active lane and state refs
- `state/dashboard.json` carries the dashboard-facing live context
- `state/decisions.json` stores short-form decision history
- `state/positions.json` and `state/orders.json` preserve current state plus event history
- `checkpoints/index.json` is the addressable checkpoint timeline
- `checkpoints/items/<checkpoint_id>/` stores immutable checkpoint snapshots
- `exports/generated/<checkpoint_id>/` stores live-centered export bundles derived from checkpoints
