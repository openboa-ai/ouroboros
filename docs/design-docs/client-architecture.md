# Client Architecture

The official AutoKairos client is a desktop application, not a thin file browser over the workspace.

## Stack Direction

- shell: `Tauri 2`
- frontend: `React`
- build tool: `Vite`
- styling: `Tailwind CSS`
- component direction: `shadcn/ui`-oriented primitives
- chart direction: `shadcn/ui` chart patterns adapted for trading dashboards

## Boundary Model

- `workspace`
  The strategy asset and local system-of-record
- `service layer`
  The only supported machine interface for the official client
- `desktop client`
  The UI that consumes service-layer queries and commands

## Why The Client Does Not Touch The Workspace Directly

- Workspace layout should be free to evolve without breaking the client contract.
- Service-layer validation should own asset invariants.
- Export, checkpoint creation, and live-safety rules should be enforced before any mutation lands.
- Multiple frontends should be able to share the same application contract later:
  - desktop app
  - headless runner
  - CLI

## Service-Layer Responsibilities

- expose current live dashboard state
- expose mode and provider status
- expose current live lane context
- expose checkpoint and export metadata
- accept intervention commands
- enforce locks, migrations, and invariant checks

## Client-Side Responsibilities

- render the main live dashboard
- render charts for price, equity, and exposure
- surface short decision reasons
- surface version and checkpoint history without crowding the main live surface
- provide explicit intervention controls

## UX Constraint

The main surface is a trading dashboard first.

It should not collapse into an agent chat interface.
Research and reasoning depth belong in drill-downs.
