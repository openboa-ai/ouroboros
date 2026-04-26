# Control Plane

This section defines the durable control-plane subsystem for autokairos.

The active model is:

```text
external agent creates TraderSystem artifact
-> autokairos registers and deploys it
-> TraderSystemRuntime runs internally
-> autokairos observes, gates, evaluates, controls lifecycle, and audits
```

autokairos is not the trading-system backend and does not call an internal trader loop step by
step. It is the devops/control-plane layer around agent-built trader systems.

## What This Section Owns

- durable `TraderSystemCandidate` and `CandidateVersion` records
- durable `TraderSystemSpec`, `TraderSystemProgram`, and `CapabilityPackage` references
- `StageBinding` and stage legitimacy records
- `TraderSystemRuntime` identity and `RuntimePlacement` history
- `RuntimeControl` decisions and `RuntimeLifecycleEvent` history
- governed execution requests and execution attempts
- trace, evidence, review, promotion, and audit records
- control-plane inspection surfaces that remain valid when no runtime is active

## What This Section Does Not Own

- the internals of `TraderSystemProgram`
- provider-private brain-session behavior
- remote A2A agent behavior
- exchange market data generation
- counted-evidence semantics by itself
- secrets inside capability packages or sandboxed programs
- internal scheduling or trading behavior inside a deployed trader system

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-governance-surfaces.md](02-governance-surfaces.md)
- [03-record-model.md](03-record-model.md)
- [04-review-operations-and-audit.md](04-review-operations-and-audit.md)

Older proactive-standing and wake-oriented control-plane notes are preserved under
[../historical/control-plane/](../historical/control-plane/) and are not active baseline.

## Active Spec Gate

The current supporting specs are:

- [../specs/02-core-primitives.md](../specs/02-core-primitives.md)
- [../specs/04-boundaries.md](../specs/04-boundaries.md)
- [../specs/08-candidate-contract.md](../specs/08-candidate-contract.md)
- [../specs/10-evidence-record-contract.md](../specs/10-evidence-record-contract.md)
- [../specs/11-promotion-decision-contract.md](../specs/11-promotion-decision-contract.md)
- [../specs/12-governed-execution-request-contract.md](../specs/12-governed-execution-request-contract.md)
- [../specs/13-execution-attempt-contract.md](../specs/13-execution-attempt-contract.md)
- [../specs/14-review-item-contract.md](../specs/14-review-item-contract.md)
- [../specs/15-runtime-operating-policy-contract.md](../specs/15-runtime-operating-policy-contract.md)
- [../specs/17-evaluation-comparability-and-sealing-contract.md](../specs/17-evaluation-comparability-and-sealing-contract.md)

## One Sentence Summary

The control plane owns durable truth and lifecycle authority around agent-built trader systems; it
does not own the trader system's internal trading loop.
