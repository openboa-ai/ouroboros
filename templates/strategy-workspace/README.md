# Strategy Workspace Template

This directory is a minimal workspace-shaped strategy asset template.

It reflects the current contract:

- `strategy.json` is the canonical entrypoint
- the workspace is the asset boundary
- the official client should use a service layer rather than mutating this structure directly
- checkpoints and exports remain explicit and addressable
- `live/live-lane.json` points at the active live-centered state files
- `state/dashboard.json` and `state/decisions.json` drive the current desktop scaffold
- `checkpoints/items/<checkpoint_id>/` stores addressable checkpoint material
