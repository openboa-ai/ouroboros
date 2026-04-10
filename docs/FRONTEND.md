# FRONTEND

## Current UI Priorities

- main dashboard for positions, protective orders, PnL, leverage, and mode
- explicit intervention controls
- visible provider status
- visible candidate and version history without polluting the main live screen

## Client Stack

- desktop shell: `Tauri 2`
- client framework: `React`
- bundler: `Vite`
- styling: `Tailwind CSS`
- component direction: `shadcn/ui`-oriented primitives
- chart direction: `shadcn/ui` chart patterns adapted for trading dashboards

## Client Rules

- The client does not read or mutate the workspace directly.
- The client talks to a service/application layer that owns validation, locks, migrations, and invariant enforcement.
- `observer`, `paper`, and `live` must be visually impossible to confuse.
- The main surface is a trading dashboard first, not an agent-chat surface.
- Live surfaces should prioritize:
  - current positions
  - protective orders
  - current PnL
  - leverage and exposure
  - provider and liveness status
  - explicit intervention controls
- Decision reasons should be short and scannable on the main dashboard.
- Deep reasoning, change history, and research detail should live in drill-down views.
- Charts are first-class surfaces, not decorative widgets.
- The initial chart set should support:
  - price context
  - equity or net-PnL curve
  - exposure by symbol
  - checkpoint or version performance comparisons
