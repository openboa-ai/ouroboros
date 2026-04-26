# autokairos Architecture

This directory is the canonical technical design layer for autokairos.

It sits strictly downstream of locked product truth.

Read [../product/README.md](../product/README.md) first for product truth, then read the runtime
authority model before any delivery or PR-slicing document.

## Purpose

Translate the locked product model into:

- runtime ownership
- execution placement
- authority boundaries
- durable truth boundaries
- observability and recovery boundaries

This directory does not define user, market, lovable proof, gate meaning, or bounded-control
posture.

Those are already locked in `wiki/product/`.

## Current Design Contract

Architecture is currently design-first.

The active runtime design contract is:

1. autokairos is a trader-system control plane, not an agent harness.
2. `TraderSystemCandidate` is the promotable trader-system candidate.
3. `TraderSystemRuntime` is the logical stage-bound runtime boundary.
4. `RuntimePlacement` is the physical process/container/provider/endpoint placement.
5. `Trace` is the recoverable session log, not evidence.
6. External evaluation records what was judged, seals what counted, then creates `EvidenceRecord`.
7. Promotion creates the right to construct stronger bindings.
8. Live authority flows through `OrderIntent -> GatewayDecision -> ExecutionAttempt`.
9. Runtime control flows through register, deploy, start, pause, resume, stop, inspect, override,
   kill, and audit.

Read [08-runtime-authority-model.md](08-runtime-authority-model.md) as the canonical design-first
page for roles, execution locations, ownership, authority, and recovery.

Read [09-trader-system-runtime-operating-model.md](09-trader-system-runtime-operating-model.md) as
the canonical operating-model page for how autokairos deploys and controls agent-built trader
systems without becoming the trader-system brain.

PRDs and PR-slice documents remain useful delivery contracts, but they are not the primary runtime
design model.

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

The delivery/slice design pack lives in:

- [01-pr1-trader-system-candidate-becomes-real-design.md](01-pr1-trader-system-candidate-becomes-real-design.md)
- [02-pr2-candidate-becomes-externally-evaluated-design.md](02-pr2-candidate-becomes-externally-evaluated-design.md)
- [03-pr3-bounded-live-trader-system-runtime-design.md](03-pr3-bounded-live-trader-system-runtime-design.md)
- [04-pr4-live-runtime-remains-controllable-design.md](04-pr4-live-runtime-remains-controllable-design.md)

## Active Technical Invariants

The current MLP-01 architecture baseline is intentionally small.

The active invariants are:

- candidate means `TraderSystemCandidate`
- execution unit means `TraderSystemRuntime`
- `TraderSystemSpec`, `TraderSystemProgram`, and `TraderSystemRuntime` remain distinct
- `TraderSystemSpec` is not a Docker image; `TraderSystemProgram` is not a human-authored strategy
  DSL
- executable trader-system programs require manifest and validation records before mounting or
  execution
- `TraderSystemRuntime` is the logical runtime boundary; `RuntimePlacement` is the replaceable
  physical process/container/provider/endpoint placement
- `TraderSystemProgram` is agent-authored executable behavior, not a human-authored strategy DSL
- sandbox or container execution may run the program, but cannot own durable truth, evidence,
  promotion, secrets, or live authority
- `TraderSystemRuntime` owns internal trading behavior; autokairos owns lifecycle control,
  placement, event export, trace, tool/gateway boundaries, intervention, evaluation, promotion, and
  audit
- context/tool injection is a `CapabilityPackage` artifact boundary, but package authority flows
  through manifest declaration, admission, stage-bound grant, and traceable mount records
- agent participants are modeled as `AgentSpec` and `AgentSession` records
- provider invocations are modeled as `AgentRun` records and raw provider output as `AgentEvent`
- slice-local `AgentRun.purpose` is separate from provider choice
- `RuntimeOperatingPolicy` bounds lifecycle, placement, trace, recovery, stop, gateway, and audit
  posture without central step-by-step orchestration
- `RuntimeControl` is lifecycle/governance, not internal strategy routing
- session trace must be durable and recoverable enough to recreate or safely stop a runtime after
  process, container, provider, or connector failure
- `RuntimeMemorySurface` is scoped context derived from trace and approved artifacts; it is not
  evidence, promotion truth, or provider-private memory
- provider/driver choice belongs to each `AgentSession`
- provider names must resolve to concrete invocation surfaces through a `RuntimeProviderAdapter`
  contract; `Codex` or `Claude` as a label is not implementation-grade
- multi-agent communication is explicit through one provider-neutral `RuntimeCommunicationPolicy`, not
  hidden runtime mesh
- backtest, paper, and live are `StageBindings` for the same candidate artifact
- durable truth lives outside provider runtime state
- live authority is bounded through autokairos gateway
- live authority flows through `OrderIntent -> GatewayDecision -> ExecutionAttempt`
- operator intervention and audit boundaries remain explicit
- first-venue depth comes before portability breadth

## Delivery Contract To Subsystem Map

This map is secondary. Use it only after the runtime authority model is clear.

| Product contract | Main supporting subsystems |
| --- | --- |
| PRD 1: Trader-System Candidate Becomes Real | `agent-system`, `control-plane`, `foundation` |
| PRD 2: Candidate Becomes Externally Evaluated | `evaluation-and-progression`, `control-plane`, `agent-system` |
| PRD 3: One Candidate Runs As Bounded Live Trader-System Runtime | `trading-substrate`, `agent-system`, `control-plane` |
| PRD 4: Live Runtime Remains Controllable | `control-plane`, `agent-system`, `trading-substrate` |

## Active Subsystem Baseline

- [foundation/README.md](foundation/README.md)
  Naming, doctrine, invariants, and restraint rules that keep product meaning from collapsing.
- [agent-system/README.md](agent-system/README.md)
  Brain sessions, harness adapters, sandbox/program execution, and runtime behavior without
  runtime-owned governance truth.
- [evaluation-and-progression/README.md](evaluation-and-progression/README.md)
  Counted versus non-counted evidence, stage semantics, and live-gate meaning.
- [trading-substrate/README.md](trading-substrate/README.md)
  Binance BTC perpetual futures first-venue surfaces, liveness, risk state, and adapter seam.
- [control-plane/README.md](control-plane/README.md)
  Durable candidate, evidence, promotion, runtime lifecycle, execution, and audit truth outside
  runtime state.

## Active Spec Gate

The active spec baseline is intentionally narrow and physically enforced.

Read [specs/README.md](specs/README.md) when a current implementation question needs more
precision than the subsystem overviews provide.

[00-system-map.md](00-system-map.md) is the diagram-first architecture map.

[08-runtime-authority-model.md](08-runtime-authority-model.md) is the design-first authority map.
Read it before jumping into Bootstrap, PRD, PR, or slice design documents.

[09-trader-system-runtime-operating-model.md](09-trader-system-runtime-operating-model.md) is the
operating-cycle map. Read it after the authority model and before connector/autonomy/trace specs.

[07-production-design-method.md](07-production-design-method.md) defines the production-level
design bar. Use it after the runtime authority model when turning the design into implementable
work.

The active spec families are limited to:

- core boundaries
- trader-system artifact identity
- journey objects
- runtime operating policy
- live execution request/attempt and gateway decision
- capability package trust, sandbox, permission, and mount boundaries
- substrate surfaces

Older proactive wake, standing-order, rebuild, read-admission, coalescing, and observability
families are not part of the current default baseline and are preserved under
[historical/](historical/). Containerization and runtime-connector specs are active only where they
protect runtime/spec/binding boundaries.

## ADR Baseline

Read [adrs/README.md](adrs/README.md) as decision history, not as the primary implementation entry
point.

Only a small subset of ADRs is part of the current MLP-01 baseline.

The rest remain historical background.

## Read Order

Default architecture read path:

1. [../product/mlp-01/00-mlp-brief.md](../product/mlp-01/00-mlp-brief.md)
2. [00-system-map.md](00-system-map.md)
3. [08-runtime-authority-model.md](08-runtime-authority-model.md)
4. [09-trader-system-runtime-operating-model.md](09-trader-system-runtime-operating-model.md)
5. [specs/README.md](specs/README.md)

Add only what the current concern needs:

| Concern | Read next |
| --- | --- |
| Bootstrap substrate | [../product/mlp-01/08-greenfield-bootstrap-plan.md](../product/mlp-01/08-greenfield-bootstrap-plan.md), [05-bootstrap-tech-spec.md](05-bootstrap-tech-spec.md) |
| Provider execution | [06-runtime-provider-adapter-feasibility.md](06-runtime-provider-adapter-feasibility.md), [specs/07-runtime-connector-contract.md](specs/07-runtime-connector-contract.md) |
| Production readiness | [07-production-design-method.md](07-production-design-method.md) |
| Delivery contracts | [../product/mlp-01/prds/README.md](../product/mlp-01/prds/README.md), then the matching slice design note |
| Decision history | [adrs/README.md](adrs/README.md) |

## Rule

If a page primarily answers:

- why the user cares
- what should feel lovable
- where the human gate belongs
- what counts as product success

it belongs in `wiki/product/`, not here.
