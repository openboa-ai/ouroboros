# Trading Substrate

This section defines the always-on first-venue operational layer beneath live execution and wake
generation.

## Why This Exists For MLP-01

MLP-01 needs one promoted candidate to run as a bounded live `TraderSystemRuntime` on Binance BTC
perpetual futures.

The trading substrate exists to keep that first-venue reality available as stable operational
surfaces rather than burying it inside runtime-local logic.

## What This Section Owns

- Binance BTC perpetual futures market, order, fill, account, risk, and liveness surfaces
- normalized first-venue state beneath runtime execution
- substrate signals that may later justify wakes
- the visible adapter seam needed for later portability

## What This Section Does Not Own

- candidate standing
- promotion meaning
- wake authority
- runtime cognition
- broad multi-venue orchestration

## Supported PRD Acceptance

| PRD | What the trading substrate must support |
| --- | --- |
| PRD 3 | one promoted candidate can run as a bounded live `TraderSystemRuntime` on Binance BTC perpetual futures within explicit live limits |
| PRD 4 | meaningful wake and intervention context can be grounded in live market, order, fill, account, and risk facts |

## Durable Truth, Interfaces, And Recovery Boundaries

The substrate keeps domain facts live even when the runtime is cold.

Its interfaces sit between:

- external venue and account systems
- the agent system that needs stage-binding execution surfaces
- proactive operations that need meaningful signal candidates

Recovery must assume degraded connectors, stale surfaces, and partial liveness.

The substrate should make those conditions explicit rather than hiding them behind the runtime.

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-state-surfaces.md](02-state-surfaces.md)
- [03-signal-and-liveness.md](03-signal-and-liveness.md)
- [04-stage-facing-bindings.md](04-stage-facing-bindings.md)

## Active Spec Gate

The current active supporting specs are:

- [../03-pr3-bounded-live-trader-system-runtime-design.md](../03-pr3-bounded-live-trader-system-runtime-design.md)
- [../specs/24-always-on-trading-substrate-contract.md](../specs/24-always-on-trading-substrate-contract.md)
- [../specs/25-substrate-signal-contract.md](../specs/25-substrate-signal-contract.md)
- [../specs/26-substrate-state-surface-contract.md](../specs/26-substrate-state-surface-contract.md)
- [../specs/27-order-fill-surface-contract.md](../specs/27-order-fill-surface-contract.md)

Read [../03-pr3-bounded-live-trader-system-runtime-design.md](../03-pr3-bounded-live-trader-system-runtime-design.md)
first when implementing Slice 3.

## Not In The Default Baseline

Broader venue-generalization work and deeper implementation-planning detail remain in the repo but
are not part of the current default MLP-01 baseline.
