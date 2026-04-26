# Always-On Trading Substrate Contract

## Thesis

autokairos needs an explicit always-on trading substrate that keeps domain-relevant operational
surfaces live beneath deployed trader-system runtimes and operator/control-plane inspection.

## Why This Spec Exists

The architecture already depends on:

- an always-on substrate
- runtime state refresh and trace
- deployed trader-system runtimes

Without a substrate contract, that first layer remains vague and the system drifts toward:

- direct connector calls from runtime code
- market/account/risk truth rediscovered ad hoc by each runtime
- no clean line between domain facts and runtime-control decisions

## Canonical Object / Interface / Boundary

This spec defines the `AlwaysOnTradingSubstrate` boundary.

That boundary owns:

- continuously refreshed state surfaces
- explicit freshness and liveness posture
- domain-relevant substrate signals
- stage-facing projections over those surfaces

It sits:

- above external feeds, venues, brokers, and connectors
- below runtime control and operator inspection
- below agent-runtime reads and execution bindings

## Required Fields Or Required Behaviors

The substrate must provide:

### 1. Stable state surfaces

At minimum:

- `market`
- `account`
- `position`
- `order_fill`
- `risk`
- `connector_liveness`

### 2. Freshness and liveness posture

Each surface must be able to express:

- source or venue timestamp
- ingest or observation timestamp
- freshness class
- degraded or disconnected reason when applicable

### 3. Signal emission

The substrate must be able to emit domain-fact candidates such as:

- market threshold or regime changes
- order/fill lifecycle changes
- position/account deltas
- risk breaches or recoveries
- connector degradation or recovery

### 4. Stage-facing projections

The substrate must support stage-facing bindings that preserve stable domain concepts while
changing backing semantics for:

- `backtesting`
- `paper`
- `live`

## Lifecycle Or State Model

Each state surface or connector posture must be able to express at minimum:

- `fresh`
- `delayed`
- `stale`
- `degraded`
- `disconnected`
- `recovering`

## What This Is Not

This substrate is not:

- runtime-control authority
- the standing-order authority
- the scheduler
- the control plane
- the cognitive runtime
- the promotion or evaluation layer

The substrate may notice facts.

It should not decide runtime lifecycle, operator intervention, or internal trader-system behavior.

## Failure Modes / Invariants

### Invariants

- substrate signal is upstream of runtime state, trace, evaluation, and operator inspection
- freshness must be explicit, not guessed from polling behavior
- runtime death must not erase substrate posture
- stage-facing bindings must preserve stable trading concepts

### Failure modes

- stale surfaces appear usable
- runtime reconnect logic becomes the only place market or risk truth exists
- every substrate signal becomes runtime control or operator interruption by default
- stage changes require different conceptual trading objects instead of different bindings

## Relationship To Adjacent Specs

- [25-substrate-signal-contract.md](25-substrate-signal-contract.md)
  defines normalized domain facts emitted by the substrate.
- [09-trace-contract.md](09-trace-contract.md)
  defines when substrate facts become trace inputs.
