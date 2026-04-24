# Wake Policy Contract

This page defines the minimum `WakePolicy` contract needed by the current MLP-01 baseline.

It follows:

- [../04-pr4-live-pod-remains-controllable-design.md](../04-pr4-live-pod-remains-controllable-design.md)

## Thesis

`WakePolicy` is the durable control-plane policy that defines when one live pod may wake the
operator.

It is where autokairos says:

- which live scope is being watched
- which trigger families are wake-worthy
- how urgency should be interpreted
- what should be suppressed or deduped

Without this object, wake authority drifts into runtime heuristics and noisy monitoring.

## Current Active Applicability

This spec is currently active for PR4.

Its job is to make meaningful operator wake authority durable before individual wake events happen.

## What This Is Not

`WakePolicy` is not:

- one fired wake
- one operator action
- one execution attempt
- a broad scheduler platform

Most importantly:

- policy defines wake authority
- wake trigger record preserves one evaluated event
- operator action comes afterward

## Canonical Role In The System

```mermaid
flowchart LR
    A["Live Facts"] --> B["WakePolicy"]
    B --> C["WakeTriggerRecord"]
```

## Minimum Contract

A `WakePolicy` must carry at least:

| Field | Meaning |
| --- | --- |
| `wake_policy_id` | Stable durable identity |
| `governed_scope_ref` | One live candidate or live pod scope |
| `trigger_families` | Wake-worthy families such as risk, execution, market, or connector posture |
| `urgency_rules` | How urgency should be classified |
| `suppression_posture` | What gets deduped, delayed, or suppressed |
| `delivery_surface` | Where the operator wake should appear |
| `authority_basis` | Why the policy is allowed to wake |
| `provenance` | Who or what created or updated the policy |
| `status` | `enabled`, `paused`, `superseded`, `expired`, or `revoked` |
| `updated_at` | Latest durable policy change time |

## Required Interpretation

The current active baseline is rigid about:

- governed scope
- trigger families
- urgency rules
- suppression posture
- authority basis
- status

This is the minimum needed to keep wake meaning explicit and non-noisy.

## Boundary Rules

- wake policy truth must remain outside the runtime
- one governed live pod should have one inspectable current wake policy posture
- a paused or revoked policy must not continue waking the operator
- meaningful wake should be defined by explicit policy, not by incidental log volume

## Not In The Active Baseline

The current active baseline does not require:

- broad scheduler-program families
- governed self-scheduling surfaces
- general-purpose cadence registries

If later work needs those, it should add them deliberately rather than broadening this contract by
default.
