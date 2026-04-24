# MLP-01 Greenfield Bootstrap Plan

## Purpose

This page defines the first engineering step after the docs-only reset baseline.

## Goal

Create the smallest executable substrate that can later prove:

```text
TraderSystemCandidate -> TradingSystemImage + CapabilityPackage -> inspectable operator surface
```

Bootstrap does not prove evaluation or live trading. It creates the substrate that makes PR1 real
feature work rather than product rediscovery.

## Current Repo Posture

- the repo is a design-locked docs-only reset workspace
- deleted legacy app/runtime code is historical context
- implementation proceeds through greenfield bootstrap
- old strategy-workspace assumptions are not active implementation truth

## Bootstrap Product Requirements

Bootstrap must establish:

- durable local records for `TraderSystemCandidate`
- durable references for `TradingSystemImage`
- durable references for `CapabilityPackage`
- a minimal `CapabilityPackageManifest` shape so context/tool/skill/data-access artifacts declare
  provenance, permissions, allowed stages, and forbidden contents before runtime injection
- a minimal `AgentRuntimeUnit` placeholder so a candidate can declare whether it is single-agent or
  team-capable later, and which provider/driver would run each participant
- a minimal `AgentLoopPolicy` placeholder so PR1 can add a real one-shot builder run without
  inventing loop semantics
- a thin operator inspect surface
- a local runtime/service boundary
- a file-backed non-relational store
- a runtime provider adapter seam grounded in concrete invocation surfaces
- a trace/evaluator placeholder seam
- one unified provider-neutral communication policy placeholder without implementing remote-agent
  networking

Bootstrap must not leave provider execution as a vague label. The seam should already be able to
name `provider_kind`, invocation surface, auth reference, sandbox policy, trace mode, and output
contract even if no real provider run happens in the Bootstrap PR.

Bootstrap must also keep `runtime_unit_role` separate from `provider_kind`:

- `runtime_unit_role` says whether the unit is a builder, evaluator, live operator, critic, or
  remote specialist.
- `provider_kind` says whether the unit runs through Codex CLI, Claude SDK, OpenClaw/ACP, A2A, or
  another driver.
- Bootstrap may fixture these fields, but it must not merge them.

## First Code Shape

Recommended roots:

- `apps/operator-web`
- `apps/runtime`
- `packages/domain`
- `packages/local-store`

This keeps operator UI, runtime behavior, domain contracts, and durable truth separate.

## Storage Posture

Use a local-first file-backed store.

It must preserve:

- candidate identity
- image refs
- package refs
- package manifest refs
- agent runtime unit refs
- agent loop policy refs
- communication policy refs
- provenance
- inspect read models
- future trace/evidence attachment points

It must not treat runtime memory, provider session state, or workspace files as the only source of
truth.

## Operator Surface

The first UI is inspect-first, not dashboard-first.

It should show:

- candidate list
- candidate detail
- image reference
- capability package references
- package manifest summary:
  provenance, allowed stages, declared tools/data access, required permissions, and forbidden
  contents
- agent runtime shape:
  single-agent or future team-capable, including runtime role, concrete provider kind, and model
  selection per runtime unit
- loop policy summary:
  loop mode, trigger source, timeout, stop conditions, trace requirement, and tool posture
- provenance
- current bootstrap status

It should not show:

- live controls
- wake console
- marketplace
- full portfolio optimization

## Convenience vs Legitimate Mode

Bootstrap is local convenience mode.

It must still preserve future seams for legitimate mode:

- trace is not evidence
- local fixture state is not counted evidence
- provider session output is not promotion truth
- schema-valid builder output is not evaluation legitimacy
- local `AgentLoopPolicy` execution is not a proof that a later live loop is safe
- evaluator-owned evidence can attach later without redesign

## Explicitly Deferred

- external evaluator implementation
- real agent harness execution
- real A2A networking
- multi-agent scheduling
- real `continuous_live` loop execution
- paper/live bindings
- exchange gateway
- `OrderIntent` / `GatewayDecision` execution flow
- wake/intervention
- package marketplace
- remote pod orchestration

## Acceptance Criteria

Bootstrap is complete only if:

- one local app can inspect candidate/image/package fixture state
- one local runtime owns durable record access
- durable truth survives runtime restart
- domain contracts already name `TraderSystemCandidate`, `TradingSystemImage`, and
  `CapabilityPackage`
- domain contracts already name `CapabilityPackageManifest`, `AgentRuntimeUnit.runtime_unit_role`,
  and `AgentLoopPolicy`
- domain contracts leave a narrow seam for `AgentRuntimeUnit.provider` and unified
  `PodCommunicationPolicy` without making multi-agent behavior part of bootstrap
- the provider seam points to the runtime-provider feasibility layer and does not imply that a
  generic `Codex` or `Claude` label is executable
- the first real PR1 provider path can use `runtime_unit_role=builder_agent`,
  `provider_kind=codex_cli`, and `model=gpt-5.4` without changing bootstrap contracts
- PR1 can add real materialization without changing the product model

## Read Next

1. [07-implementation-plan.md](07-implementation-plan.md)
2. [../../architecture/05-bootstrap-tech-spec.md](../../architecture/05-bootstrap-tech-spec.md)
3. [../../architecture/06-runtime-provider-adapter-feasibility.md](../../architecture/06-runtime-provider-adapter-feasibility.md)
