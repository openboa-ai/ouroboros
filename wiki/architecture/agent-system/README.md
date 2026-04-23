# Agent System

This section defines the runtime-side subsystem that originates paths and performs candidate-linked
execution behavior for MLP-01.

## Why This Exists For MLP-01

The agent system exists because autokairos needs a runtime that can:

- surface one serious agent-originated path
- continue candidate-linked live behavior after promotion
- respond to control actions without pretending that runtime state is durable truth

## What This Section Owns

- runtime-side path origination behavior
- bounded handoff payload for candidate materialization
- governed invocation into candidate-linked execution behavior
- runtime lifecycle and continuity semantics
- the execution behavior that actually performs routine live actions
- pause, stop, and override execution behavior once control actions are issued

## What This Section Does Not Own

- durable candidate truth
- durable candidate materialization
- counted evidence meaning
- promotion and live-gate meaning
- wake authority
- durable audit history

## Supported PRD Acceptance

| PRD | What the agent system must support |
| --- | --- |
| PRD 1 | one serious path can be surfaced and handed off as bounded materialization input without runtime state becoming the record of truth |
| PRD 3 | one promoted candidate can perform routine live actions without per-action operator participation |
| PRD 4 | execution behavior can respond to pause, stop, and override without forcing the operator back into the runtime loop |

## Durable Truth, Interfaces, And Recovery Boundaries

The runtime is not the source of truth.

The agent system must therefore consume and emit bounded interfaces around:

- surfaced path handoff into candidate materialization
- candidate-linked requests from the control plane
- substrate state needed for execution behavior
- trace and execution references that can be interpreted outside the runtime

For PR1 specifically, agent-system responsibility stops after surfacing one serious path and
handing off the bounded materialization input.

The durable candidate record belongs to the control plane.

Recovery must assume that runtimes die and restart.

The system still needs durable candidate, execution, wake, and audit truth outside the runtime.

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-execution-lifecycle.md](02-execution-lifecycle.md)
- [03-state-and-ownership.md](03-state-and-ownership.md)

## Active Spec Gate

The current active supporting specs are:

- [../specs/12-governed-execution-request-contract.md](../specs/12-governed-execution-request-contract.md)
- [../specs/13-execution-attempt-contract.md](../specs/13-execution-attempt-contract.md)

## Not In The Default Baseline

Runtime bridge, containerization, persistent-operations posture, observability, and other
runtime-deep families remain in the repo but are not part of the current default MLP-01 baseline.
