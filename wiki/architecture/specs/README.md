# Architecture Specs

This directory contains the lower-level supporting contracts for autokairos.

After `mlp-01` lock, this is no longer a broad architecture baseline.

It is a narrow active-spec gate for current PRD implementation safety.

## Purpose

Use specs only when a current PRD implementation question still needs more precision than the
subsystem README provides.

If a spec is not directly needed to implement PRD 1 through PRD 4 safely, it is not part of the
current canonical baseline.

## Active Spec Baseline

The current active spec baseline is limited to these families.

### Core boundary specs

- [02-core-primitives.md](02-core-primitives.md)
- [04-boundaries.md](04-boundaries.md)

### Journey object specs

- [03-staged-evaluation.md](03-staged-evaluation.md)
- [08-candidate-contract.md](08-candidate-contract.md)
- [09-trace-contract.md](09-trace-contract.md)
- [10-evidence-record-contract.md](10-evidence-record-contract.md)
- [11-promotion-decision-contract.md](11-promotion-decision-contract.md)
- [14-review-item-contract.md](14-review-item-contract.md)

### Live execution specs

- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)

### Substrate specs

- [24-always-on-trading-substrate-contract.md](24-always-on-trading-substrate-contract.md)
- [25-substrate-signal-contract.md](25-substrate-signal-contract.md)
- [26-substrate-state-surface-contract.md](26-substrate-state-surface-contract.md)
- [27-order-fill-surface-contract.md](27-order-fill-surface-contract.md)

### Wake and control specs

- [21-wake-policy-contract.md](21-wake-policy-contract.md)
- [23-wake-trigger-record-contract.md](23-wake-trigger-record-contract.md)

## How To Use This Directory

1. read the PRD first
2. read the implementation plan
3. if you are implementing PR1, read [../01-pr1-path-becomes-real-design.md](../01-pr1-path-becomes-real-design.md)
4. read the supporting subsystem README
5. read only the spec family that subsystem README points you to

For PR1 specifically, the first spec pair to read is usually:

- [04-boundaries.md](04-boundaries.md)
- [08-candidate-contract.md](08-candidate-contract.md)

If you need more than the active baseline above, that is a signal to justify the extra detail
explicitly rather than quietly broadening the baseline.

## Not In The Current Baseline

The following families remain in the repo but are not part of the current default implementation
path:

- first-principles and mission essay specs
- runtime bridge, containerization, persistent-runtime posture, and observability families
- wake-orchestration clause-model and standing-order program families
- proactive-standing, rebuild, read-admission, coalescing, retry, lease, and recovery families
- record-store, projection, and storage-posture detail families not needed by the active PRDs

These files are retained as background or future detail, not as equal-weight current truth.

## Rule

Specs are justified only when:

- an active PRD needs lower-level implementation precision, or
- a cross-cutting invariant would otherwise drift

Interesting detail alone is not enough.
