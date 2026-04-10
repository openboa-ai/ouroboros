# Strategy Workspace Template

This directory is a minimal workspace-shaped strategy asset template.

It reflects the current contract:

- `strategy.json` is the canonical entrypoint
- the workspace is the asset boundary
- the official client should use a service layer rather than mutating this structure directly
- checkpoints and exports remain explicit and addressable
