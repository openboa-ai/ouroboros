# Control Plane

This section defines the subsystem that owns durable system truth outside runtime state.

## Why This Exists For MLP-01

MLP-01 fails if candidate identity, image/package composition, agent runtime composition, stage
binding, evidence, promotion, live posture, wake reason, or operator action are only
reconstructable from brain-session memory, hands-environment files, remote-agent messages, or
private human notes.

The control plane exists so the system still makes sense when:

- no runtime is active
- a harness provider changes
- a hands environment dies
- a live pod fails or restarts
- the operator needs to inspect what counted, what ran, or why they were woken

## What This Section Owns

- durable `TraderSystemCandidate` materialization
- durable `TradingSystemImage` references
- durable `CapabilityPackage` references
- durable `AgentRuntimeUnit` references
- durable pod communication policy and team trace references when more than one agent participates
- `CandidateVersion` records
- `StageBinding` records
- durable provenance and artifact lineage
- durable evidence, review, and promotion records
- durable governed execution requests and execution attempts
- durable wake reason and operator-action history
- audit-visible reconstruction of the trust chain

## What This Section Does Not Own

- runtime cognition
- provider-specific brain-session behavior
- remote agent endpoint behavior
- exchange market data generation
- counted-evidence semantics by itself
- wake-generation logic by itself
- secret custody inside capability packages

## Supported PRD Acceptance

| PRD | What the control plane must support |
| --- | --- |
| PRD 1 | one agent-built trader-system candidate becomes one durable inspectable candidate with image/package references and visible provenance |
| PRD 2 | counted evidence, non-counted context, review items, and promotion decisions remain durable and reviewable |
| PRD 3 | promoted live pod launch, explicit limits, and execution history remain reconstructable outside runtime state |
| PRD 4 | wake reasons, operator actions, and intervention history remain auditable and product-visible |

## Durable Truth, Interfaces, And Recovery Boundaries

The control plane is the durable ownership layer.

Its interfaces sit around:

- candidate materialization
- image/package/version records
- agent runtime unit and communication policy records
- stage binding records
- evidence and promotion records
- governed execution requests and attempts
- wake reason, operator action, and audit history

For PR1, the control plane owns the first durable write that turns one agent-built candidate into a
real `TraderSystemCandidate`.

Recovery must assume runtime failure, partial execution history, interrupted live operation, and
harness-provider replacement.

The system still needs durable records that explain what the candidate is, which package and
binding it used, which agent runtime units participated, what communication artifacts were
produced, what counted, what was approved, what ran, why the operator was woken, and what action
they took.

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-governance-surfaces.md](02-governance-surfaces.md)
- [03-record-model.md](03-record-model.md)
- [04-review-operations-and-audit.md](04-review-operations-and-audit.md)
- [05-proactive-policy-and-wake-records.md](05-proactive-policy-and-wake-records.md)
- [07-history-and-projection-model.md](07-history-and-projection-model.md)

## Active Spec Gate

The current active supporting specs are:

- [../specs/02-core-primitives.md](../specs/02-core-primitives.md)
- [../specs/04-boundaries.md](../specs/04-boundaries.md)
- [../specs/08-candidate-contract.md](../specs/08-candidate-contract.md)
- [../specs/10-evidence-record-contract.md](../specs/10-evidence-record-contract.md)
- [../specs/11-promotion-decision-contract.md](../specs/11-promotion-decision-contract.md)
- [../specs/12-governed-execution-request-contract.md](../specs/12-governed-execution-request-contract.md)
- [../specs/13-execution-attempt-contract.md](../specs/13-execution-attempt-contract.md)
- [../specs/14-review-item-contract.md](../specs/14-review-item-contract.md)
- [../specs/21-wake-policy-contract.md](../specs/21-wake-policy-contract.md)
- [../specs/23-wake-trigger-record-contract.md](../specs/23-wake-trigger-record-contract.md)

## Not In The Default Baseline

Full marketplace records, Kubernetes-like scheduling, proactive-standing, rebuild, read-admission,
coalescing, retry/lease, projection-watermark, and similar deep record families remain in the repo
but are not part of the current default MLP-01 baseline.
