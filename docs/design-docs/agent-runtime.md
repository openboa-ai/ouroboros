# Agent Runtime

AutoKairos should behave like one resident system with several clear layers.

## Runtime Layers

- `app shell`
  Lifecycle, settings, approvals, dashboard, and intervention UI
- `resident supervisor`
  Owns long-lived threads, turns, logs, and background work
- `research runtime`
  Observes, plans, edits, and evaluates candidate changes
- `execution core`
  Owns live position safety, order placement, and invariant enforcement

## Agent Model

- research should be allowed to inspect code, docs, data, and runtime state
- research should be allowed to modify non-live strategy and evaluation logic
- live execution should not depend on an experimental workspace
- current decisions should be recorded as markdown artifacts, not left in chat-only memory

## Current Boundaries

- model failures may block new entries
- execution invariant failures may trigger stronger intervention
- every live position must have an exchange-native protective stop
- the execution core owns critical safety decisions

## Current Open Design Question

- whether v1 live should remain a single promoted strategy version or eventually allow several promoted live sub-strategies with central allocation
