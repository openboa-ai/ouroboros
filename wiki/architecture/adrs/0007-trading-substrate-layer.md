# ADR 0007: Trading Substrate Layer

## Status

accepted

## Context

The architecture already adopted:

- always-on substrate plus wakeable runtime
- proactive operations as a separate subsystem
- wake authority as control-plane truth

But the substrate itself remained underdefined.

That left an important gap:

- proactive orchestration depended on signals that did not yet have an explicit home
- persistent operations referenced market, account, order, risk, and connector state without a
  dedicated subsystem boundary
- agent execution risked reabsorbing domain state and connector logic back into the runtime layer

## Decision

autokairos adopts an explicit `trading-substrate` subsystem.

This subsystem owns:

- continuously refreshed market, account, position, order/fill, risk, and connector-liveness
  surfaces
- explicit freshness and degraded posture
- substrate signals above raw ingress and below wake-policy evaluation
- stage-facing projections that preserve stable trading concepts across `backtesting`, `paper`, and
  `live`

This subsystem does not own:

- wake-policy authority
- standing-order authority
- governed execution request emission
- candidate evaluation or promotion
- cognitive runtime execution

## Alternatives Considered

### 1. Keep the substrate implicit inside agent-system docs

Rejected because it lets runtime execution absorb domain-state ownership and connector semantics.

### 2. Fold the substrate into proactive operations

Rejected because signal sources and wake authority are not the same concern.

### 3. Fold the substrate into the control plane

Rejected because continuously refreshed operational state and durable governance truth have
different failure modes and different ownership boundaries.

## Consequences

- autokairos gains a dedicated layer for continuously live trading surfaces.
- Proactive operations can now consume substrate signals without owning their state model.
- Agent execution can depend on stable substrate projections rather than venue-specific direct
  connector logic.
- The implementation order changes to place the trading substrate before proactive wake truth and
  before runtime-heavy work.

## Supersedes / superseded by

- supersedes nothing
- superseded by none

## Date / owner

- 2026-04-19
- Codex
