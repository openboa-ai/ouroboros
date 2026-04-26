# Bootstrap Tech Spec

## Purpose

This page is the implementation-ready contract for the greenfield Bootstrap PR.

Bootstrap creates a small, executable substrate for inspecting durable trader-system records. It
does not prove candidate generation, evaluation, live trading, runtime action APIs, operator
intervention, provider execution, or program execution.

Read it after:

- [00-system-map.md](00-system-map.md)
- [09-trader-system-runtime-operating-model.md](09-trader-system-runtime-operating-model.md)
- [specs/02-core-primitives.md](specs/02-core-primitives.md)
- [specs/19-trader-system-artifact-contract.md](specs/19-trader-system-artifact-contract.md)
- [specs/18-capability-package-trust-and-permission-contract.md](specs/18-capability-package-trust-and-permission-contract.md)
- [specs/17-evaluation-comparability-and-sealing-contract.md](specs/17-evaluation-comparability-and-sealing-contract.md)

## Bootstrap Contract

Bootstrap has four deliverables only:

| Root | Responsibility |
| --- | --- |
| `apps/operator-web` | browser inspect UI |
| `apps/runtime` | local read-only runtime service |
| `packages/domain` | shared record and read-model contracts |
| `packages/local-store` | local file-backed fixture store and projections |

The point is to make durable seams visible before real provider, evaluator, program, wake, or live
systems exist.

## Scope Split

### Build Now

Bootstrap must build:

- workspace roots for `apps/operator-web`, `apps/runtime`, `packages/domain`, and
  `packages/local-store`
- shared domain contracts for the fixture records and inspect read models
- a local file-backed store under `.autokairos/dev-store/`
- idempotent fixture seeding
- read-only runtime APIs
- a browser UI that can inspect candidate, spec, program, package, runtime, trace, and evaluation
  placeholder state
- restart recovery: after runtime restart, the same inspect read model is rebuilt from item files

### Fixture Only

Bootstrap may seed fixture records for:

- provider readiness and probe attempts
- `AgentSpec`, `AgentSession`, `AgentRun`, and `AgentEvent`
- trace placeholders
- `RuntimeMemorySurface`
- `EvaluationRunRecord`, `EvaluationComparisonSet`, and `EvidenceSealingDecision`
- `ProgramManifest` and `ProgramValidationRecord`
- `CapabilityPackageAdmissionRecord`, `CapabilityGrant`, and `CapabilityMountRecord`
- `RuntimePlacement` and `HandsEnvironment`

Fixture records are inspectable placeholders. They do not authorize execution, access, evidence,
promotion, or live trading.

### Do Not Build

Bootstrap must not build:

- provider execution
- provider probes against real Codex, Claude, OpenClaw/ACP, A2A, or local-process adapters
- program execution
- real sandbox, container, or Kubernetes placement
- evaluator execution
- evidence sealing
- promotion
- live gateway or exchange execution
- runtime control action APIs
- operator intervention controls
- marketplace behavior
- A2A networking or multi-agent routing

## Runtime API

Bootstrap exposes only read APIs:

- `GET /health`
- `GET /api/candidates`
- `GET /api/candidates/:candidate_id`

The API must not expose action endpoints for provider runs, program runs, evaluator runs,
promotion, runtime action APIs, marketplace, live execution, or exchange access.

## Local Store Contract

Default store root:

```text
.autokairos/dev-store/
```

Store rules:

- item files are authoritative truth
- indexes are projections rebuilt from item files
- every fixture record has `record_kind`, `version`, and a stable id or ref
- writes use temp-write then rename posture
- fixture seeding is idempotent
- restart must restore the same candidate inspect read model from store files
- provider session state, runtime memory, scratch files, and workspace files are never the only
  source of truth

Minimum directory shape:

```text
.autokairos/dev-store/
  candidates/
    index.json
    items/<candidate_id>.json
  candidate-versions/
    index.json
    items/<candidate_version_id>.json
  trader-system-specs/
    index.json
    items/<trader_system_spec_id>.json
  trader-system-programs/
    index.json
    items/<trader_system_program_id>.json
  program-manifests/
    index.json
    items/<program_manifest_id>.json
  program-validations/
    index.json
    items/<program_validation_record_id>.json
  capability-packages/
    index.json
    items/<capability_package_id>.json
  capability-manifests/
    index.json
    items/<capability_manifest_id>.json
  capability-admissions/
    index.json
    items/<capability_package_admission_record_id>.json
  capability-grants/
    index.json
    items/<capability_grant_id>.json
  capability-mounts/
    index.json
    items/<capability_mount_record_id>.json
  agent-specs/
    index.json
    items/<agent_spec_id>.json
  agent-sessions/
    index.json
    items/<agent_session_id>.json
  agent-runs/
    index.json
    items/<agent_run_id>.json
  agent-events/
    index.json
    items/<agent_event_id>.json
  provider-readiness-records/
    index.json
    items/<provider_readiness_record_id>.json
  provider-probe-attempts/
    index.json
    items/<provider_probe_attempt_id>.json
  trader-system-runtimes/
    index.json
    items/<trader_system_runtime_id>.json
  runtime-placements/
    index.json
    items/<runtime_placement_id>.json
  hands-environments/
    index.json
    items/<hands_environment_id>.json
  runtime-memory-surfaces/
    index.json
    items/<runtime_memory_surface_id>.json
  traces/
    index.json
    placeholders/<trace_id>.json
  evaluation-runs/
    index.json
    items/<evaluation_run_record_id>.json
  evaluation-comparison-sets/
    index.json
    items/<evaluation_comparison_set_id>.json
  evidence-sealing-decisions/
    index.json
    items/<evidence_sealing_decision_id>.json
  read-models/
    candidates/
      index.json
      items/<candidate_id>.json
```

## Minimum Fixture Shape

Bootstrap seeds one inspectable candidate lineage with stable refs:

- `TraderSystemCandidate`
- `CandidateVersion`
- `TraderSystemSpecRef`
- `TraderSystemProgramRef`
- `ProgramManifestRef`
- `ProgramValidationRecordRef`
- `CapabilityPackageRef`
- `CapabilityManifest`
- `CapabilityPackageAdmissionRecordRef`
- `CapabilityGrantRef`
- `CapabilityMountRecordRef`
- `AgentSpecRef`
- `AgentSessionRef`
- `AgentRunRef`
- `AgentEventRef`
- `ProviderReadinessRecordRef`
- `ProviderProbeAttemptRef`
- `TraderSystemRuntimeRef`
- `RuntimePlacementRef`
- `HandsEnvironmentRef`
- `RuntimeMemorySurfaceRef`
- `TracePlaceholderRef`
- `EvaluationRunRecordRef`
- `EvaluationComparisonSetRef`
- `EvidenceSealingDecisionRef`

The fixture must make its convenience status explicit:

- no provider has run
- no program has executed
- no package has been scanned or mounted for real
- no tool permission has been granted for real
- no memory write/review/rollback workflow exists
- no evaluator has run
- no evidence has counted
- no promotion or live gate exists

## Candidate Inspect Read Model

`CandidateInspectReadModel` is the only required UI-facing read model.

It must show:

- candidate id, version, status, and provenance refs
- spec ref and supported stage-binding profiles
- program ref, program manifest summary, and program validation placeholder status
- capability package refs
- capability manifest summary
- capability admission, grant, and mount placeholder statuses
- agent spec/session/run/event placeholders
- provider readiness placeholder status
- runtime placement and hands-environment placeholders
- runtime memory surface placeholder with trust class, access mode, version, visibility, and
  quarantine status
- trace placeholder status
- evaluation run, comparison set, and sealing placeholder statuses
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

The read model must not imply counted evidence, provider readiness, program execution, real package
grants, or live authority.

## Boundary Rules

- `ProviderReadinessRecordRef` in Bootstrap is a fixture, not proof that a provider is executable.
- `ProgramValidationRecordRef` in Bootstrap is a fixture, not proof that a program is safe or
  runnable.
- `CapabilityGrantRef` in Bootstrap is a fixture, not access authorization.
- `RuntimeMemorySurfaceRef` in Bootstrap is context metadata, not evidence or durable provider
  memory.
- `TracePlaceholderRef` in Bootstrap is runtime-history shape, not counted evidence.
- `EvaluationRunRecordRef`, `EvaluationComparisonSetRef`, and `EvidenceSealingDecisionRef` are seam
  refs only; Bootstrap produces no `EvidenceRecord`.
- `TraderSystemRuntimeRef` and `RuntimePlacementRef` are visible as logical/physical seams, but no
  runtime placement is actually launched.

## Reference Contracts

Bootstrap must preserve seams for later work without implementing them:

- provider readiness: [06-runtime-provider-adapter-feasibility.md](06-runtime-provider-adapter-feasibility.md)
- runtime operating cycle: [09-trader-system-runtime-operating-model.md](09-trader-system-runtime-operating-model.md)
- artifact identity: [specs/19-trader-system-artifact-contract.md](specs/19-trader-system-artifact-contract.md)
- capability trust: [specs/18-capability-package-trust-and-permission-contract.md](specs/18-capability-package-trust-and-permission-contract.md)
- evaluation sealing: [specs/17-evaluation-comparability-and-sealing-contract.md](specs/17-evaluation-comparability-and-sealing-contract.md)
- trace: [specs/09-trace-contract.md](specs/09-trace-contract.md)
- candidate truth: [specs/08-candidate-contract.md](specs/08-candidate-contract.md)
- boundaries: [specs/04-boundaries.md](specs/04-boundaries.md)

## Acceptance Criteria

Bootstrap is complete only if:

- the four code roots exist and can be run locally
- `GET /health`, `GET /api/candidates`, and `GET /api/candidates/:candidate_id` work
- fixture seed is idempotent
- item files are authoritative and indexes/read models are projections
- runtime restart restores the same inspect read model
- the operator UI can inspect the fixture candidate and all required seam refs
- the UI clearly marks fixture/convenience-mode status
- no provider, program, evaluator, wake, promotion, live, marketplace, or A2A execution path exists
- no fixture placeholder is presented as evidence, permission, readiness, promotion, or live authority

## Implementation Sequence

1. Create workspace roots and minimal package wiring.
2. Define domain contracts and read models.
3. Implement local-store item file loading, projection rebuild, and idempotent fixture seed.
4. Implement read-only runtime API.
5. Implement inspect UI against the read-only API.
6. Verify restart recovery and boundary labels.

Anything beyond this sequence belongs to a later design/implementation plan.
