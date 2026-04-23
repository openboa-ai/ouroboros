# Substrate Signal Contract

## Thesis

autokairos needs a canonical `SubstrateSignal` object so domain facts can move from the always-on
trading substrate into proactive wake evaluation without collapsing signal, wake authority, and
runtime execution into one layer.

## Why This Spec Exists

The current architecture already depends on a strong separation between:

- continuously live substrate state
- domain-relevant fact changes
- governed wake evaluation
- actual runtime execution

Without a signal contract, the architecture drifts toward:

- connector-specific events leaking straight into wake logic
- no durable way to explain what fact was observed before a wake was emitted or suppressed
- wake records carrying both domain facts and governance judgments at once

## Canonical Object / Interface / Boundary

This spec defines the canonical `SubstrateSignal` object.

A `SubstrateSignal` is:

- one normalized domain-fact candidate emitted by the always-on trading substrate
- upstream of wake-policy and standing-order evaluation
- downstream of continuously maintained substrate state surfaces

It is the handoff object between:

- the trading-substrate subsystem
- the proactive wake-orchestration subsystem

## Required Fields Or Required Behaviors

At minimum, a `SubstrateSignal` must carry:

### 1. Identity and timing

- `signal_ref`
- `observed_at`
- `source_timestamp` when available
- `ingested_at` or equivalent substrate observation time

### 2. Source posture

- `surface_family`
  such as `market`, `order_fill`, `position`, `account`, `risk`, or `connector_liveness`
- `signal_family`
  such as `threshold_cross`, `fill_update`, `risk_breach`, or `connector_degraded`
- `source_scope_ref`
  the relevant instrument, venue, account, connector, or candidate scope

### 3. Freshness and liveness context

- freshness class at observation time
- connector-liveness posture at observation time
- degraded or disconnected reason when applicable

### 4. Correlation and dedupe support

- correlation key or dedupe key
- burst or sequence metadata when the source can emit repeated similar facts

### 5. Payload discipline

- a normalized fact payload
- enough detail to reconstruct what happened without embedding wake-policy judgment

## Lifecycle Or State Model

A `SubstrateSignal` should move through a narrow lifecycle:

- `observed`
  the substrate noticed and normalized a domain fact
- `recorded`
  the signal is durable or reconstructable enough for orchestration to inspect
- `evaluated`
  proactive orchestration used it as one wake candidate input
- `linked`
  the resulting wake-trigger history may reference it
- `expired`
  the signal is no longer actionable as a fresh wake candidate, even though its history may remain

The important point is that evaluation may happen without emission.

## What This Is Not

A `SubstrateSignal` is not:

- a `WakeTriggerRecord`
- a wake-policy decision
- a standing-order authority record
- an `ExecutionRequest`
- a runtime trace event
- a promotion or evaluation artifact

It says:

- what happened
- where it came from
- how fresh and trustworthy it looked

It does not say:

- whether waking was authorized
- whether waking actually happened
- whether runtime work succeeded

## Failure Modes / Invariants

### Invariants

- a substrate signal must remain upstream of wake-trigger disposition
- the signal must preserve domain meaning without embedding governance judgment
- freshness and liveness context must travel with the signal
- the same conceptual signal family must stay stable across stages even if backing semantics differ

### Failure modes

- substrate events are evaluated with no recorded freshness posture
- dedupe happens only inside the runtime after wake already occurred
- wake records cannot be traced back to a normalized substrate fact
- connector-specific payloads leak directly into proactive policy logic

## Relationship To Adjacent Specs

- [24-always-on-trading-substrate-contract.md](24-always-on-trading-substrate-contract.md)
  defines the broader substrate boundary that emits signals.
- [19-wake-orchestration-and-trigger-model.md](19-wake-orchestration-and-trigger-model.md)
  defines how proactive orchestration evaluates candidate wake sources.
- [21-wake-policy-contract.md](21-wake-policy-contract.md)
  defines durable wake authority above the signal.
- [22-standing-order-contract.md](22-standing-order-contract.md)
  defines durable operating authority above the signal.
- [23-wake-trigger-record-contract.md](23-wake-trigger-record-contract.md)
  defines the emitted-or-suppressed record produced after orchestration evaluates signals.
