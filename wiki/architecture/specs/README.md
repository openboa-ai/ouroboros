# Architecture Specs

This directory is the active-spec gate for the current MLP-01 design baseline.

If a markdown file is in this directory, it is active implementation guidance. If a former spec is
not directly required for the current baseline, it lives under
[../historical/specs/](../historical/specs/).

## Active Spec Baseline

The current active spec baseline is exactly the files listed below.

### Core boundary specs

- [02-core-primitives.md](02-core-primitives.md)
- [04-boundaries.md](04-boundaries.md)
- [06-containerized-execution.md](06-containerized-execution.md)
- [07-runtime-connector-contract.md](07-runtime-connector-contract.md)
- [15-runtime-operating-policy-contract.md](15-runtime-operating-policy-contract.md)
- [18-capability-package-trust-and-permission-contract.md](18-capability-package-trust-and-permission-contract.md)
- [19-trader-system-artifact-contract.md](19-trader-system-artifact-contract.md)

Provider execution must also read
[../06-runtime-provider-adapter-feasibility.md](../06-runtime-provider-adapter-feasibility.md).
Provider names such as Codex or Claude are not implementation-grade unless they resolve to a
concrete adapter invocation surface and readiness record.

### Journey object specs

- [03-staged-evaluation.md](03-staged-evaluation.md)
- [08-candidate-contract.md](08-candidate-contract.md)
- [09-trace-contract.md](09-trace-contract.md)
- [10-evidence-record-contract.md](10-evidence-record-contract.md)
- [11-promotion-decision-contract.md](11-promotion-decision-contract.md)
- [14-review-item-contract.md](14-review-item-contract.md)
- [17-evaluation-comparability-and-sealing-contract.md](17-evaluation-comparability-and-sealing-contract.md)

### Live execution specs

- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)
- [16-order-intent-and-gateway-decision-contract.md](16-order-intent-and-gateway-decision-contract.md)

### Substrate specs

- [24-always-on-trading-substrate-contract.md](24-always-on-trading-substrate-contract.md)
- [25-substrate-signal-contract.md](25-substrate-signal-contract.md)
- [26-substrate-state-surface-contract.md](26-substrate-state-surface-contract.md)
- [27-order-fill-surface-contract.md](27-order-fill-surface-contract.md)

## Active Count

This directory should contain 22 markdown files including this README.

## How To Use This Directory

This path mirrors [../README.md](../README.md) and the top-level
[../../../knowledge-index.md](../../../knowledge-index.md). Do not start from individual specs until
the system map and runtime operating model are clear.

1. read [../00-system-map.md](../00-system-map.md)
2. read [../08-runtime-authority-model.md](../08-runtime-authority-model.md)
3. read [../09-trader-system-runtime-operating-model.md](../09-trader-system-runtime-operating-model.md)
4. read [../07-production-design-method.md](../07-production-design-method.md)
5. read [../05-bootstrap-tech-spec.md](../05-bootstrap-tech-spec.md) if working on the code substrate
6. read only the spec family needed for the concern you are changing

## Concern-Specific Read Paths

### Bootstrap

- [../05-bootstrap-tech-spec.md](../05-bootstrap-tech-spec.md)
- [../09-trader-system-runtime-operating-model.md](../09-trader-system-runtime-operating-model.md)
- [02-core-primitives.md](02-core-primitives.md)
- [19-trader-system-artifact-contract.md](19-trader-system-artifact-contract.md)
- [18-capability-package-trust-and-permission-contract.md](18-capability-package-trust-and-permission-contract.md)
- [17-evaluation-comparability-and-sealing-contract.md](17-evaluation-comparability-and-sealing-contract.md)
- [09-trace-contract.md](09-trace-contract.md)
- [08-candidate-contract.md](08-candidate-contract.md)
- [04-boundaries.md](04-boundaries.md)

### Candidate materialization

- [02-core-primitives.md](02-core-primitives.md)
- [04-boundaries.md](04-boundaries.md)
- [../09-trader-system-runtime-operating-model.md](../09-trader-system-runtime-operating-model.md)
- [08-candidate-contract.md](08-candidate-contract.md)
- [19-trader-system-artifact-contract.md](19-trader-system-artifact-contract.md)
- [../06-runtime-provider-adapter-feasibility.md](../06-runtime-provider-adapter-feasibility.md)
- [07-runtime-connector-contract.md](07-runtime-connector-contract.md)
- [15-runtime-operating-policy-contract.md](15-runtime-operating-policy-contract.md)
- [09-trace-contract.md](09-trace-contract.md)

### External evaluation

- [03-staged-evaluation.md](03-staged-evaluation.md)
- [09-trace-contract.md](09-trace-contract.md)
- [17-evaluation-comparability-and-sealing-contract.md](17-evaluation-comparability-and-sealing-contract.md)
- [10-evidence-record-contract.md](10-evidence-record-contract.md)
- [11-promotion-decision-contract.md](11-promotion-decision-contract.md)
- [14-review-item-contract.md](14-review-item-contract.md)

### Bounded live runtime

- [06-containerized-execution.md](06-containerized-execution.md)
- [../09-trader-system-runtime-operating-model.md](../09-trader-system-runtime-operating-model.md)
- [02-core-primitives.md](02-core-primitives.md)
- [19-trader-system-artifact-contract.md](19-trader-system-artifact-contract.md)
- [07-runtime-connector-contract.md](07-runtime-connector-contract.md)
- [15-runtime-operating-policy-contract.md](15-runtime-operating-policy-contract.md)
- [09-trace-contract.md](09-trace-contract.md)
- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
- [16-order-intent-and-gateway-decision-contract.md](16-order-intent-and-gateway-decision-contract.md)
- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)
- [24-always-on-trading-substrate-contract.md](24-always-on-trading-substrate-contract.md)
- [26-substrate-state-surface-contract.md](26-substrate-state-surface-contract.md)
- [27-order-fill-surface-contract.md](27-order-fill-surface-contract.md)

### Operator intervention

- [../09-trader-system-runtime-operating-model.md](../09-trader-system-runtime-operating-model.md)
- [15-runtime-operating-policy-contract.md](15-runtime-operating-policy-contract.md)
- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)
- [04-boundaries.md](04-boundaries.md)

## Not In The Current Baseline

The following families remain in the repo but are not part of the current default implementation
path:

- retired proactive-activation, attention, standing-order, and trigger-taxonomy families
- older persistent-runtime posture and production-agent state-machine families
- proactive-standing, rebuild, read-admission, coalescing, retry, lease, and recovery families
- record-store, projection, and storage-posture detail families not needed by the active baseline

These files are retained under [../historical/specs/](../historical/specs/) as background or future
detail, not as equal-weight current truth.

## Rule

Specs are justified only when:

- an active PRD needs lower-level implementation precision, or
- a cross-cutting invariant would otherwise drift

Interesting detail alone is not enough.
