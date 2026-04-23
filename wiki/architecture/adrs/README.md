# Architecture Decision Records

This directory stores immutable decision history for autokairos.

ADRs are not the default implementation entry point.

They exist to preserve why major architectural choices were made.

## Purpose

Use this directory when you need baseline design history, not when you need the current product or
subsystem contract.

Read the PRDs and subsystem READMEs first.

## Current Baseline ADRs

Only the following ADRs are part of the current MLP-01 baseline:

1. [0001-documentation-system.md](0001-documentation-system.md)
   Product-first documentation doctrine.
2. [0002-first-implementation-seam.md](0002-first-implementation-seam.md)
   Governed execution requests and attempts before runtime-first collapse.
3. [0003-persistent-operations-posture.md](0003-persistent-operations-posture.md)
   Always-on substrate plus wakeable runtime, not one immortal loop.
4. [0004-production-agent-posture.md](0004-production-agent-posture.md)
   Serious production trading agent posture instead of generic harness framing.
5. [0005-proactive-operations-layer.md](0005-proactive-operations-layer.md)
   Wake orchestration as its own subsystem above the runtime.
6. [0006-proactive-control-plane-truth.md](0006-proactive-control-plane-truth.md)
   Wake policy and authority truth outside runtime-local state.
7. [0007-trading-substrate-layer.md](0007-trading-substrate-layer.md)
   Dedicated always-on trading substrate beneath runtime and wake orchestration.
8. [0009-event-log-first-durable-truth.md](0009-event-log-first-durable-truth.md)
   Durable truth centered on append-only history rather than runtime state.
9. [0010-history-projection-split.md](0010-history-projection-split.md)
   History and current-state projections kept explicitly separate.

## Historical Or Lower-Priority ADRs

The remaining ADRs stay in the repo as history, background, or lower-priority detail.

They are not part of the current default MLP-01 implementation baseline.

This especially includes:

- [0008-wake-policy-precedence.md](0008-wake-policy-precedence.md)
- [0011-upper-layer-flexibility.md](0011-upper-layer-flexibility.md)
- the proactive-standing, rebuild, read-admission, coalescing, and related ADR chain from
  `0012` through `0028`

## Rules

- do not rewrite old ADRs into new truth
- do not treat every `accepted` ADR as part of the active implementation baseline
- create a new ADR only when a real architecture rule changes, not for read-path cleanup alone

## Read Order

1. read the PRD
2. read the supporting subsystem README
3. read a baseline ADR only if you need decision history for that subsystem boundary
