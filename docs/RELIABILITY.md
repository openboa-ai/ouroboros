# RELIABILITY

## Current Reliability Principles

- liveness must be tracked across data, model, orders, position sync, and protective stops
- execution invariants belong to the execution core
- live trading should degrade safely when critical inputs disappear
- active research must never silently weaken the current live path
