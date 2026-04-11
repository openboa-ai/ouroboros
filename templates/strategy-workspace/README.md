# Strategy Workspace Template

This directory is a minimal workspace-shaped strategy asset template.

It reflects the current contract:

- `strategy.json` is the canonical entrypoint
- the workspace is the asset boundary
- the official client should use a service layer rather than mutating this structure directly
- checkpoints and exports remain explicit and addressable
- `live/live-lane.json` points at the active live-centered state files
- `state/runtime-status.json` stores the authoritative live runtime control state
- `state/dashboard.json` and `state/decisions.json` drive the current desktop scaffold
- `adapters/index.json` declares exchange/runtime adapters the workspace can run against
- `evaluations/index.json` stores backtest and paper-trading run history
- `indexes/sessions.json` and `sessions/items/*` materialize live session context as addressable workspace docs
- `state/eval-summaries.json` and `eval-summaries/items/*` materialize live evaluation evidence as addressable workspace docs
- `checkpoints/items/<checkpoint_id>/` stores addressable checkpoint material
- `operations/index.json` tracks durable service-layer mutations against the workspace
