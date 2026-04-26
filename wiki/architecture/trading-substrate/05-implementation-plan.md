# Trading Substrate Implementation Plan

This page turns the trading-substrate design into an implementation sequence.

It follows:

- [01-overview.md](01-overview.md)
- [02-state-surfaces.md](02-state-surfaces.md)
- [03-signal-and-liveness.md](03-signal-and-liveness.md)
- [04-stage-facing-bindings.md](04-stage-facing-bindings.md)
- [../specs/24-always-on-trading-substrate-contract.md](../specs/24-always-on-trading-substrate-contract.md)
- [../specs/26-substrate-state-surface-contract.md](../specs/26-substrate-state-surface-contract.md)

## Goal

Define the first serious implementation order for the always-on trading substrate so deployed
trader-system runtimes, gateway decisions, evaluation, and operator inspection do not need to
rediscover domain state ad hoc.

## Build Order

### 1. Normalized substrate state envelope

Define one stable envelope for:

- scope
- provenance
- source time
- observed time
- freshness posture
- degraded reason when applicable

### 2. Core surface stores

Implement continuously maintained stores for:

- market
- account
- position
- order_fill
- risk
- connector_liveness

The point of this step is not just storage.
It is to make each family available as a `SubstrateStateSurface` rather than as raw connector
payload.

The first family-specific hardening should focus on `order_fill`, because live trading systems
break fastest when current order posture, partial fills, cancel/reject state, and event history
collapse into one fuzzy layer.

### 3. Freshness and liveness classification

The system must explicitly classify:

- fresh
- delayed
- stale
- degraded
- disconnected
- recovering

### 4. Substrate signal emission

Implement substrate signals as domain-fact records above state updates and below runtime reads,
gateway decisions, evaluation, and operator inspection.

### 5. Stage-facing projections

Implement the stage-facing read surface so:

- `backtesting`
- `paper`
- `live`

consume stable concepts with different backing semantics.

### 6. Runtime and gateway handoff

Only after the substrate emits inspectable state and signal records should runtime/gateway
integration consume them.
against wake policy and standing authority.

## Risks And Failure Modes

- runtime directly calls raw connectors and bypasses the substrate
- wake decisions are made during state ingestion
- freshness is implied rather than explicit
- connector degradation disappears into logs instead of becoming inspectable posture
- stage-specific logic leaks into prompt-only instructions

## Acceptance Criteria

The first serious substrate slice is correct if all of these are true.

1. The system can inspect current market, account, position, order/fill, risk, and connector-liveness posture.
2. Each surface carries explicit freshness or degraded posture.
3. The system can emit a substrate signal without automatically emitting a governed wake.
4. The system can distinguish substrate signal history from wake-trigger history.
5. `backtesting`, `paper`, and `live` can consume stable trading concepts through different bindings.

## Explicitly Deferred

The first substrate implementation does not need:

- every venue adapter
- ultra-low-latency execution infrastructure
- full multi-venue netting
- full historical replay infrastructure for every asset class

## One Sentence Summary

Build the continuously live domain surfaces first, then let proactive orchestration and runtime
consume them.
