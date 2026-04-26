# Substrate Signal Contract

## Thesis

autokairos needs a canonical `SubstrateSignal` object so domain facts can move from the always-on
trading substrate into trace, runtime state surfaces, evaluation, and operator inspection without
becoming runtime-control commands or internal trader-system handlers.

## Why This Spec Exists

The current architecture separates:

- continuously live substrate state
- domain-relevant fact changes
- deployed trader-system runtime behavior
- operator/control-plane lifecycle decisions
- evaluation and promotion truth

Without a signal contract, connector-specific events leak into runtime control, and every market or
risk fact starts looking like something autokairos should route into the trader system.

## Canonical Object

A `SubstrateSignal` is:

- one normalized domain-fact candidate emitted by the always-on trading substrate
- downstream of continuously maintained substrate state surfaces
- upstream of trace, read models, evaluation inputs, runtime state refresh, and operator inspection
- not a runtime-control command
- not a trader-system internal handler selector

## Required Fields

At minimum, a `SubstrateSignal` must carry:

- `signal_ref`
- `observed_at`
- `source_timestamp` when available
- `ingested_at`
- `surface_family`: `market`, `order_fill`, `position`, `account`, `risk`, or
  `connector_liveness`
- `signal_family`: substrate-local classification for storage, dedupe, and inspection
- `source_scope_ref`
- freshness class
- connector-liveness posture
- correlation or dedupe key
- normalized fact payload
- provenance refs

Substrate classifications are for storage and inspection. They must not become autokairos-owned
runtime handler enums.

## Lifecycle

A `SubstrateSignal` should move through a narrow lifecycle:

- `observed`
- `recorded`
- `linked_to_trace_or_state`
- `consumed_by_runtime_or_evaluator`
- `expired`

The important point is that consumption may happen without lifecycle control.

## What This Is Not

A `SubstrateSignal` is not:

- a `RuntimeControl` command
- a `RuntimeControlDecision`
- an `ExecutionRequest`
- a runtime trace event by itself
- an operator alert
- a promotion or evaluation artifact

It says what happened, where it came from, and how fresh/trustworthy it looked. It does not say how
the trader-system should internally react.

## Invariants

- substrate signal is upstream of runtime state and trace
- freshness must be explicit
- runtime death must not erase substrate posture
- stage-facing bindings must preserve stable trading concepts
- every substrate signal must be safe to inspect without exposing credentials
- no substrate signal should grant tool, gateway, provider, or exchange authority

## Relationship To Adjacent Specs

- [24-always-on-trading-substrate-contract.md](24-always-on-trading-substrate-contract.md) defines
  the continuously maintained trading substrate.
- [26-substrate-state-surface-contract.md](26-substrate-state-surface-contract.md) defines state
  surfaces that may include or summarize signals.
- [27-order-fill-surface-contract.md](27-order-fill-surface-contract.md) defines order/fill surfaces
  that may emit signals.
- [09-trace-contract.md](09-trace-contract.md) defines when signals become trace inputs.
