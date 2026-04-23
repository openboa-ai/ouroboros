# autokairos Architecture

This directory is the canonical technical implementation layer for autokairos.

It sits strictly downstream of locked product truth.

Read [../product/README.md](../product/README.md) and the `mlp-01` PRDs first.

## Purpose

Translate the locked MLP-01 product contracts into:

- subsystem ownership
- durable truth boundaries
- implementation-critical interfaces
- recovery boundaries

This directory does not define user, market, lovable proof, gate meaning, or autonomy posture.

Those are already locked in `wiki/product/`.

## Current Input Contract

Architecture is currently implementing only these product contracts:

1. [../product/mlp-01/prds/01-hypothesis-to-candidate.md](../product/mlp-01/prds/01-hypothesis-to-candidate.md)
2. [../product/mlp-01/prds/02-candidate-evaluation-and-live-gate.md](../product/mlp-01/prds/02-candidate-evaluation-and-live-gate.md)
3. [../product/mlp-01/prds/03-live-deployment-and-autonomous-execution.md](../product/mlp-01/prds/03-live-deployment-and-autonomous-execution.md)
4. [../product/mlp-01/prds/04-operator-trust-wake-and-intervention.md](../product/mlp-01/prds/04-operator-trust-wake-and-intervention.md)

Everything in `wiki/architecture/` should be read as downstream of those four PRDs.

After the PRDs and architecture baseline are understood, the canonical build order lives in
[../product/mlp-01/07-implementation-plan.md](../product/mlp-01/07-implementation-plan.md).

Old subsystem-level implementation plans remain background only.

For PR1 specifically, the canonical implementation shape lives in
[01-pr1-path-becomes-real-design.md](01-pr1-path-becomes-real-design.md).

## Active Technical Invariants

The current MLP-01 architecture baseline is intentionally small.

The active invariants are:

- durable truth lives outside runtime state
- stage boundaries remain explicit
- legitimacy boundaries remain explicit
- live limits remain explicit and enforceable
- wake authority and intervention boundaries remain explicit
- first-venue depth comes before portability breadth

## PRD To Subsystem Map

| Product contract | Main supporting subsystems |
| --- | --- |
| PRD 1: Path Becomes Real | `agent-system`, `control-plane`, `foundation` |
| PRD 2: Path Becomes Trustworthy | `evaluation-and-progression`, `control-plane`, `foundation` |
| PRD 3: Path Can Really Trade | `trading-substrate`, `agent-system`, `control-plane` |
| PRD 4: Delegation Stays Safe Under Live Conditions | `proactive-operations`, `control-plane`, `agent-system` |

## Active Subsystem Baseline

- [foundation/README.md](foundation/README.md)
  Naming, doctrine, invariants, and restraint rules that keep product meaning from collapsing.
- [agent-system/README.md](agent-system/README.md)
  Agent-originated path creation and candidate-linked execution behavior without runtime-owned
  governance truth.
- [evaluation-and-progression/README.md](evaluation-and-progression/README.md)
  Counted versus non-counted evidence, stage semantics, and live-gate meaning.
- [trading-substrate/README.md](trading-substrate/README.md)
  Binance BTC perpetual futures first-venue surfaces, liveness, risk state, and adapter seam.
- [proactive-operations/README.md](proactive-operations/README.md)
  Meaningful wake generation, wake authority, and urgency semantics above the runtime.
- [control-plane/README.md](control-plane/README.md)
  Durable candidate, evidence, promotion, execution, wake, and audit truth outside runtime state.

## Active Spec Gate

The active spec baseline is intentionally narrow.

Read [specs/README.md](specs/README.md) only when a current PRD implementation question needs more
precision than the subsystem overviews provide.

The active spec families are limited to:

- core boundaries
- journey objects
- live execution request/attempt
- substrate surfaces
- wake policy and wake trigger history

Deep proactive-standing, rebuild, read-admission, coalescing, containerization, observability, and
other speculative families are not part of the current default baseline.

## ADR Baseline

Read [adrs/README.md](adrs/README.md) as decision history, not as the primary implementation entry
point.

Only a small subset of ADRs is part of the current MLP-01 baseline.

The rest remain historical background.

## Read Order

1. [../product/mlp-01/00-mlp-brief.md](../product/mlp-01/00-mlp-brief.md)
2. [../product/mlp-01/prds/README.md](../product/mlp-01/prds/README.md)
3. [00-system-map.md](00-system-map.md)
4. [../product/mlp-01/07-implementation-plan.md](../product/mlp-01/07-implementation-plan.md) for
   the canonical build order
5. [01-pr1-path-becomes-real-design.md](01-pr1-path-becomes-real-design.md) when implementing
   PRD 1 / Slice 1
6. the subsystem README that matches the PRD you are implementing
7. [specs/README.md](specs/README.md) only if the subsystem README points you there
8. [adrs/README.md](adrs/README.md) only if you need decision history

## Rule

If a page primarily answers:

- why the user cares
- what should feel lovable
- where the human gate belongs
- what counts as product success

it belongs in `wiki/product/`, not here.
