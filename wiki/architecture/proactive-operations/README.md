# Proactive Operations

This section defines the subsystem that turns live pod conditions into meaningful wakes above the
runtime.

## Why This Exists For MLP-01

MLP-01 does not count if a bounded live `TradingSystemPod` still requires constant shadow
monitoring.

Proactive operations therefore exist to make sure:

- wakes happen for meaningful reasons
- wake authority does not live inside the runtime
- urgency and wake semantics stay governed rather than noisy

## What This Section Owns

- meaningful wake generation
- urgency semantics for live conditions
- the boundary between substrate signals, pod conditions, and operator-visible wake reasons
- wake authority above the runtime

## What This Section Does Not Own

- durable wake record truth
- candidate standing or promotion meaning
- runtime cognition
- broad incident-management workflow

## Supported PRD Acceptance

| PRD | What proactive operations must support |
| --- | --- |
| PRD 3 | bounded live pod execution stays responsive without reducing the product to manual polling |
| PRD 4 | one meaningful wake can be raised with clear reason and urgency semantics above the runtime |

## Durable Truth, Interfaces, And Recovery Boundaries

This subsystem decides why work should wake.

It does not own the durable record of what happened afterward.

Its interfaces sit between:

- substrate signals coming from always-on live facts
- control-plane truth that preserves wake reason and auditability
- agent execution that responds to governed wake outcomes

Recovery must assume missed, bursty, or noisy signals.

The answer is better wake authority and meaning, not runtime-owned timers or constant operator
watching.

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-trigger-model.md](02-trigger-model.md)

## Active Spec Gate

The current active supporting specs are:

- [../04-pr4-live-pod-remains-controllable-design.md](../04-pr4-live-pod-remains-controllable-design.md)
- [../specs/21-wake-policy-contract.md](../specs/21-wake-policy-contract.md)
- [../specs/23-wake-trigger-record-contract.md](../specs/23-wake-trigger-record-contract.md)

Read [../04-pr4-live-pod-remains-controllable-design.md](../04-pr4-live-pod-remains-controllable-design.md)
first when implementing Slice 4.

## Not In The Default Baseline

Governed self-scheduling, standing orders, clause-model registries, precedence pipelines,
proactive-standing, rebuild, read-admission, coalescing, and similar deep families remain in the
repo but are not part of the current default MLP-01 baseline.
