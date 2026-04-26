# MLP-01 Greenfield Bootstrap Plan

## Purpose

This page defines the first engineering step after the docs/design baseline.

Bootstrap is not a product proof. It is the smallest executable substrate that lets a developer and
operator inspect durable trader-system records before real provider execution, evaluation, runtime
actions, operator intervention, or live trading exists.

## Bootstrap Goal

Create a local inspect path for:

```text
TraderSystemCandidate
-> CandidateVersion
-> TraderSystemSpec
-> TraderSystemProgram
-> CapabilityPackage
-> TraderSystemRuntime seam
-> trace/evaluation placeholders
```

The important proof is persistence and inspectability, not trading performance.

## Build Now

Bootstrap builds only:

- `apps/operator-web`: inspect-first browser UI
- `apps/runtime`: local read-only runtime service
- `packages/domain`: shared record and read-model contracts
- `packages/local-store`: local file-backed fixture store and projections
- read-only APIs: `GET /health`, `GET /api/candidates`, `GET /api/candidates/:candidate_id`
- idempotent fixture seeding
- restart recovery from item files

## Fixture Only

Bootstrap may show placeholders for future seams:

- provider readiness and provider probe attempts
- `AgentSpec`, `AgentSession`, `AgentRun`, and `AgentEvent`
- `ProgramManifest` and `ProgramValidationRecord`
- `CapabilityManifest`, `CapabilityPackageAdmissionRecord`, `CapabilityGrant`, and
  `CapabilityMountRecord`
- `RuntimePlacement` and `HandsEnvironment`
- `RuntimeMemorySurface`
- trace placeholders
- `EvaluationRunRecord`, `EvaluationComparisonSet`, and `EvidenceSealingDecision`

These records are fixture/convenience-mode state. They are visible so later implementation can
attach real behavior without changing product identity.

## Do Not Build

Bootstrap must not implement:

- Codex, Claude, OpenClaw/ACP, A2A, or local-process provider execution
- provider probing against real systems
- program execution
- sandbox/container execution
- package scanning, marketplace, real grants, or real mounts
- runtime memory write/review/rollback workflow
- evaluator execution
- evidence sealing
- promotion
- runtime control action APIs
- live gateway, exchange access, or order execution
- operator intervention controls
- A2A networking or multi-agent routing

## Storage Posture

Use `.autokairos/dev-store/` as a local file-backed store.

Rules:

- item files are authoritative truth
- indexes and read models are projections
- every fixture record has `record_kind`, `version`, and a stable id/ref
- fixture seeding is idempotent
- writes use temp-write then rename posture
- runtime restart must rebuild the same inspect read model
- provider memory, runtime memory, scratch files, and workspace files are not durable product truth

## Operator Surface

The first UI is inspect-first.

It should show:

- candidate list and candidate detail
- candidate version, spec ref, and supported stage-binding profiles
- program ref, program manifest summary, and validation placeholder status
- capability package, manifest, admission, grant, and mount placeholder summaries
- agent/provider placeholder shape
- runtime placement and hands-environment placeholders
- runtime memory surface placeholder with trust class, access mode, version, visibility, and
  quarantine status
- trace/evaluation placeholders
- explicit fixture/convenience-mode labels

It must not show:

- action buttons
- provider-run controls
- program-run controls
- evaluator-run controls
- evidence claims
- promotion controls
- runtime control or operator intervention surfaces
- live execution controls
- marketplace surfaces

## Boundary Rules

- `ProviderReadinessRecordRef` is not proof that a provider is executable.
- `ProgramValidationRecordRef` is not proof that a program is safe, performant, or runnable.
- `CapabilityGrantRef` is not real access authorization.
- `RuntimeMemorySurfaceRef` is context metadata, not evidence.
- `TracePlaceholderRef` is runtime-history shape, not counted evidence.
- `EvaluationRunRecordRef`, `EvaluationComparisonSetRef`, and `EvidenceSealingDecisionRef` are seam
  refs only; Bootstrap produces no `EvidenceRecord`.
- `TraderSystemRuntimeRef` and `RuntimePlacementRef` are visible as logical/physical seams, but no
  runtime placement is launched.

## Acceptance Criteria

Bootstrap is complete only if:

- one local app can inspect candidate/spec/program/package/runtime fixture state
- one local runtime owns durable record access
- durable truth survives runtime restart
- read APIs are read-only
- fixture records expose all required seam refs
- the UI marks fixture/convenience-mode status clearly
- no placeholder is presented as evidence, permission, readiness, promotion, or live authority
- later candidate materialization can attach real provider output without changing the product model

## Read Next

1. [../../architecture/05-bootstrap-tech-spec.md](../../architecture/05-bootstrap-tech-spec.md)
2. [../../architecture/00-system-map.md](../../architecture/00-system-map.md)
3. [../../architecture/specs/README.md](../../architecture/specs/README.md)
