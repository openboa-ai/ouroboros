# Control Plane

This section defines the subsystem that owns durable system truth outside runtime state.

## Why This Exists For MLP-01

MLP-01 fails if candidate, evidence, promotion, live posture, wake reason, and operator action are
only reconstructable from runtime memory or private human notes.

The control plane exists so the system still makes sense when:

- no runtime is active
- a live run fails or restarts
- the operator needs to inspect what counted or why they were woken

## What This Section Owns

- candidate materialization
- durable candidate truth and provenance
- durable evidence, review, and promotion records
- durable execution references and live posture truth
- durable wake reason and operator-action history
- audit-visible reconstruction of the trust chain

## What This Section Does Not Own

- runtime cognition
- counted-evidence semantics by itself
- substrate liveness and market-state generation
- wake generation logic by itself

## Supported PRD Acceptance

| PRD | What the control plane must support |
| --- | --- |
| PRD 1 | one surfaced path becomes one durable inspectable candidate with visible provenance and explicit handoff-ready state |
| PRD 2 | counted evidence, non-counted evidence context, and live-gate rationale remain durable and reviewable |
| PRD 3 | promoted live execution, explicit limits, and execution history remain reconstructable outside runtime state |
| PRD 4 | wake reasons, operator actions, and intervention history remain auditable and product-visible |

## Durable Truth, Interfaces, And Recovery Boundaries

The control plane is the durable ownership layer.

Its interfaces sit around:

- candidate materialization
- durable candidate provenance truth
- evidence and promotion records
- governed execution requests and attempts
- wake reason, operator action, and audit history

For PR1 specifically, the control plane owns the first durable write that turns one surfaced path
into one real candidate.

Recovery must assume runtime failure, partial execution history, and interrupted live operation.

The system still needs durable records that explain what the path is, what counted, what was
approved, what ran, why the operator was woken, and what action they took.

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-governance-surfaces.md](02-governance-surfaces.md)
- [03-record-model.md](03-record-model.md)
- [04-review-operations-and-audit.md](04-review-operations-and-audit.md)
- [05-proactive-policy-and-wake-records.md](05-proactive-policy-and-wake-records.md)
- [07-history-and-projection-model.md](07-history-and-projection-model.md)

## Active Spec Gate

The current active supporting specs are:

- [../specs/08-candidate-contract.md](../specs/08-candidate-contract.md)
- [../specs/10-evidence-record-contract.md](../specs/10-evidence-record-contract.md)
- [../specs/11-promotion-decision-contract.md](../specs/11-promotion-decision-contract.md)
- [../specs/12-governed-execution-request-contract.md](../specs/12-governed-execution-request-contract.md)
- [../specs/13-execution-attempt-contract.md](../specs/13-execution-attempt-contract.md)
- [../specs/14-review-item-contract.md](../specs/14-review-item-contract.md)
- [../specs/21-wake-policy-contract.md](../specs/21-wake-policy-contract.md)
- [../specs/23-wake-trigger-record-contract.md](../specs/23-wake-trigger-record-contract.md)

## Not In The Default Baseline

Proactive-standing, rebuild, read-admission, coalescing, retry/lease, projection-watermark, and
similar deep record families remain in the repo but are not part of the current default MLP-01
baseline.
