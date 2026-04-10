# Client Rules

## Core Rule

The official AutoKairos client talks to a service layer.
It does not treat the workspace as a public storage API.

## Dashboard Rules

- The main surface is a live trading dashboard first.
- `observer`, `paper`, and `live` must be visually impossible to confuse.
- The dashboard should emphasize:
  - positions
  - protective orders
  - PnL
  - leverage and exposure
  - provider status
  - liveness and intervention state

## Reasoning Rules

- Short decision reasons belong on the main surface.
- Deep reasoning, evaluation detail, and candidate history belong in drill-down surfaces.
- The client should never require users to read raw workspace files to understand live behavior.

## Chart Rules

- Charts are first-class surfaces.
- The initial client should support at least:
  - price context
  - equity or net-PnL curve
  - symbol exposure
  - checkpoint or version comparisons

## Safety Rules

- The client must always expose explicit intervention controls.
- The client must surface forced interventions and incident history clearly.
- The client must never imply that a workspace mutation has succeeded until the service layer confirms it.
