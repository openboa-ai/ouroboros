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

1. [../product/mlp-01/prds/01-trader-system-candidate-becomes-real.md](../product/mlp-01/prds/01-trader-system-candidate-becomes-real.md)
2. [../product/mlp-01/prds/02-candidate-becomes-externally-evaluated.md](../product/mlp-01/prds/02-candidate-becomes-externally-evaluated.md)
3. [../product/mlp-01/prds/03-bounded-live-trading-system-pod.md](../product/mlp-01/prds/03-bounded-live-trading-system-pod.md)
4. [../product/mlp-01/prds/04-live-pod-remains-controllable.md](../product/mlp-01/prds/04-live-pod-remains-controllable.md)

Everything in `wiki/architecture/` should be read as downstream of those four PRDs.

After the PRDs and architecture baseline are understood, the canonical build order lives in
[../product/mlp-01/07-implementation-plan.md](../product/mlp-01/07-implementation-plan.md).

The current repo posture is a **docs-only reset baseline**.

That means the next engineering step is defined in
[../product/mlp-01/08-greenfield-bootstrap-plan.md](../product/mlp-01/08-greenfield-bootstrap-plan.md),
and implemented through
[05-bootstrap-tech-spec.md](05-bootstrap-tech-spec.md),
not through any assumed restore of the deleted legacy app/runtime tree.

Old subsystem-level implementation plans remain background only.

The canonical bootstrap technical-design page now lives in:

- [05-bootstrap-tech-spec.md](05-bootstrap-tech-spec.md)
- [06-runtime-provider-adapter-feasibility.md](06-runtime-provider-adapter-feasibility.md)
  turns provider names such as Codex or Claude into concrete callable adapter surfaces.

The canonical slice-design pack now lives in:

- [01-pr1-trader-system-candidate-becomes-real-design.md](01-pr1-trader-system-candidate-becomes-real-design.md)
- [02-pr2-candidate-becomes-externally-evaluated-design.md](02-pr2-candidate-becomes-externally-evaluated-design.md)
- [03-pr3-bounded-live-trading-system-pod-design.md](03-pr3-bounded-live-trading-system-pod-design.md)
- [04-pr4-live-pod-remains-controllable-design.md](04-pr4-live-pod-remains-controllable-design.md)

## Active Technical Invariants

The current MLP-01 architecture baseline is intentionally small.

The active invariants are:

- candidate means `TraderSystemCandidate`
- execution unit means `TradingSystemPod`
- image and pod remain distinct
- context/tool injection is a `CapabilityPackage` artifact boundary
- agent participants are modeled as `AgentRuntimeUnit` records
- `runtime_unit_role` is separate from provider choice
- `AgentLoopPolicy` bounds autonomous loops without central step-by-step orchestration
- provider/driver choice belongs to each `AgentRuntimeUnit`
- provider names must resolve to concrete invocation surfaces through a `RuntimeProviderAdapter`
  contract; `Codex` or `Claude` as a label is not implementation-grade
- multi-agent communication is explicit through one provider-neutral `PodCommunicationPolicy`, not
  hidden runtime mesh
- backtest, paper, and live are `StageBindings` for the same candidate artifact
- durable truth lives outside provider runtime state
- live authority is bounded through autokairos gateway
- live authority flows through `OrderIntent -> GatewayDecision -> ExecutionAttempt`
- wake authority and intervention boundaries remain explicit
- first-venue depth comes before portability breadth

## PRD To Subsystem Map

| Product contract | Main supporting subsystems |
| --- | --- |
| PRD 1: Trader-System Candidate Becomes Real | `agent-system`, `control-plane`, `foundation` |
| PRD 2: Candidate Becomes Externally Evaluated | `evaluation-and-progression`, `control-plane`, `agent-system` |
| PRD 3: One Candidate Runs As Bounded Live Trader-System Pod | `trading-substrate`, `agent-system`, `control-plane` |
| PRD 4: Live Pod Remains Controllable | `proactive-operations`, `control-plane`, `agent-system` |

## Active Subsystem Baseline

- [foundation/README.md](foundation/README.md)
  Naming, doctrine, invariants, and restraint rules that keep product meaning from collapsing.
- [agent-system/README.md](agent-system/README.md)
  Brain sessions, harness adapters, and pod runtime behavior without runtime-owned governance
  truth.
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

[00-system-map.md](00-system-map.md) is the diagram-first architecture map. Read it before jumping
into slice design notes or specs if you need the full object, pod, loop, provider, stage, live
authority, and PR-slice flow in one place.

[07-production-design-method.md](07-production-design-method.md) defines the production-level
design bar for Bootstrap and PR1 through PR4. Read it before deepening or implementing a slice
design.

The active spec families are limited to:

- core boundaries
- journey objects
- agent loop policy
- live execution request/attempt and gateway decision
- substrate surfaces
- wake policy and wake trigger history

Deep proactive-standing, rebuild, read-admission, coalescing, and observability families are not
part of the current default baseline. Containerization and runtime-bridge specs are active only
where they protect pod/image/binding boundaries.

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
5. [../product/mlp-01/08-greenfield-bootstrap-plan.md](../product/mlp-01/08-greenfield-bootstrap-plan.md)
   for the minimal code-substrate plan beneath the docs-only reset baseline
6. [05-bootstrap-tech-spec.md](05-bootstrap-tech-spec.md)
   for the decision-complete bootstrap technical spec before code begins
7. [06-runtime-provider-adapter-feasibility.md](06-runtime-provider-adapter-feasibility.md)
   before adding real provider execution, Codex, Claude, OpenClaw/ACP, or A2A endpoints
8. [07-production-design-method.md](07-production-design-method.md)
   before deepening or implementing a production-level slice design
9. the slice design note that matches the PRD you are implementing:
   [01-pr1-trader-system-candidate-becomes-real-design.md](01-pr1-trader-system-candidate-becomes-real-design.md),
   [02-pr2-candidate-becomes-externally-evaluated-design.md](02-pr2-candidate-becomes-externally-evaluated-design.md),
   [03-pr3-bounded-live-trading-system-pod-design.md](03-pr3-bounded-live-trading-system-pod-design.md), or
   [04-pr4-live-pod-remains-controllable-design.md](04-pr4-live-pod-remains-controllable-design.md)
10. the subsystem README that matches the PRD you are implementing
11. [specs/README.md](specs/README.md) only if the subsystem README points you there
12. [adrs/README.md](adrs/README.md) only if you need decision history

## Rule

If a page primarily answers:

- why the user cares
- what should feel lovable
- where the human gate belongs
- what counts as product success

it belongs in `wiki/product/`, not here.
