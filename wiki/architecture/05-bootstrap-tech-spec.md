# Bootstrap Tech Spec

## Purpose

This page is the implementation-ready technical spec for the greenfield bootstrap PR.

It sits below:

- [../product/mlp-01/08-greenfield-bootstrap-plan.md](../product/mlp-01/08-greenfield-bootstrap-plan.md)
- [specs/02-core-primitives.md](specs/02-core-primitives.md)
- [specs/08-candidate-contract.md](specs/08-candidate-contract.md)
- [06-runtime-provider-adapter-feasibility.md](06-runtime-provider-adapter-feasibility.md)

## Goal

Create the minimum code substrate for inspecting durable trader-system candidate state.

Bootstrap must prove:

- the repo can boot from a greenfield codebase
- `TraderSystemCandidate` truth can live outside runtime memory
- `TradingSystemImage` and `CapabilityPackage` refs are first-class
- `AgentRuntimeUnit` and communication policy seams exist without implementing a full agent mesh
- provider adapter seams are concrete enough to later launch Codex or Claude without redesign
- operator UI can inspect candidate-system state
- later PR1 can add real materialization without changing the model

Bootstrap does not prove:

- real external harness execution
- real Codex, Claude, OpenClaw/ACP, or A2A provider runs
- external evaluation
- live trading
- wake/intervention
- package marketplace
- real A2A networking or multi-agent scheduling

## Locked Defaults

- TypeScript
- npm workspaces
- `apps/operator-web`
- `apps/runtime`
- `packages/domain`
- `packages/local-store`
- local-first file-backed store
- browser inspect-first UI
- runtime bound to `127.0.0.1`
- provider execution remains disabled in bootstrap, but the first real adapter target is
  `codex_cli` through local `codex exec`
- provider labels must use concrete `provider_kind` values from
  [06-runtime-provider-adapter-feasibility.md](06-runtime-provider-adapter-feasibility.md)

## Code Roots

### `packages/domain`

Owns shared types:

- `TraderSystemCandidate`
- `TradingSystemImageRef`
- `CapabilityPackageRef`
- `CapabilityPackageManifest`
- `AgentRuntimeUnitRef`
- `PodCommunicationPolicy`
- `AgentLoopPolicyRef`
- `RuntimeProviderAdapterRef`
- `CandidateVersionRef`
- `Stage`
- `StageBindingRef`
- `CandidateInspectReadModel`
- `CandidateListItemReadModel`
- `TracePlaceholderRef`

### `packages/local-store`

Owns:

- file layout
- candidate persistence
- image/package ref persistence
- capability package manifest persistence
- agent runtime unit, agent loop policy, and communication-policy ref persistence
- inspect read-model projection
- trace placeholder path helpers

### `apps/runtime`

Owns:

- local HTTP service
- store initialization
- fixture seeding
- read-only candidate APIs
- internal materialization service seam for PR1
- provider-adapter registry placeholder without executing providers

### `apps/operator-web`

Owns:

- candidate list
- candidate detail
- image/package provenance display
- agent runtime shape display
- runtime health display

## Runtime API

Bootstrap exposes read-only APIs:

- `GET /health`
- `GET /api/candidates`
- `GET /api/candidates/:candidate_id`

Bootstrap must not expose:

- evidence APIs
- promotion APIs
- live execution APIs
- wake/action APIs
- marketplace APIs

## Store Layout

Default data directory:

```text
.autokairos/dev-store/
  candidates/
    index.json
    items/<candidate_id>.json
  images/
    index.json
    items/<image_ref>.json
  capability-packages/
    index.json
    items/<package_ref>.json
  capability-package-manifests/
    index.json
    items/<package_id>@<version>.json
  agent-runtime-units/
    index.json
    items/<agent_runtime_unit_id>.json
  agent-loop-policies/
    index.json
    items/<agent_loop_policy_id>.json
  traces/
    placeholders/
```

The directory must be gitignored.

## Minimum Fixture

When the store is empty, bootstrap may seed exactly one fixture candidate:

- `candidate_kind: trader_system`
- one image ref
- one capability package ref
- one agent runtime unit ref
- one agent loop policy ref using `one_shot_builder` or fixture-only placeholder
- communication policy: topology `isolated`, no inter-agent channels
- first market scope: Binance BTC perpetual futures
- status: `materialized`
- evaluation handoff ready: false or true, explicitly set

The fixture is not evidence and not a live system.

## Domain Type Sketch

```text
TraderSystemCandidate
  candidate_id
  candidate_kind = trader_system
  created_at
  created_by_harness_ref
  materialized_from_provider_run_ref
  trading_system_image_ref
  capability_package_refs
  agent_runtime_unit_refs
  pod_communication_policy
  first_market_scope
  title
  system_summary
  candidate_status
  evaluation_handoff_ready
```

```text
TradingSystemImageRef
  image_id
  version
  artifact_uri
  manifest_summary
```

```text
CapabilityPackageRef
  package_id
  version
  package_kind
  manifest_ref
  summary
  allowed_stages
```

```text
CapabilityPackageManifest
  package_id
  version
  package_kind
  provenance
  declared_tools
  declared_data_access
  allowed_stages
  required_permissions
  forbidden_contents
  compatibility_notes
```

```text
AgentRuntimeUnitRef
  agent_runtime_unit_id
  runtime_unit_role = builder_agent | evaluation_runner | live_operator_agent | critic_agent | remote_specialist
  provider_kind = codex_cli | codex_sdk_ts | codex_cloud | claude_agent_sdk_python | claude_agent_sdk_ts | claude_cli | openclaw_acp | a2a_endpoint | local_process
  model
  provider_ref
  invocation_surface
  auth_ref
  sandbox_policy
  output_contract_ref
  trace_destination
  agent_loop_policy_ref
  brain_profile_summary
  hands_environment_summary
  communication_role
```

```text
PodCommunicationPolicy
  topology = isolated
  allowed_channels = []
  forbidden_edges = []
  shared_context_surface_refs = []
  artifact_export_required = true
```

```text
AgentLoopPolicyRef
  agent_loop_policy_id
  loop_mode = one_shot_builder
  trigger_source
  cadence_policy
  timeout_policy
  cancellation_policy
  trace_export_required = true
  tool_access_posture
  stop_conditions
```

## Bootstrap PR Scope

Include:

- workspace/package roots
- minimal runtime app shell
- minimal operator-web app shell
- local file store scaffold
- domain contracts
- fixture-backed inspect path
- placeholder communication policy shape
- placeholder agent loop policy shape
- minimal capability package manifest shape

Exclude:

- real `RuntimeProviderAdapter` execution
- real A2A endpoint calls
- multi-agent task routing
- evaluator implementation
- live gateway
- wake/control
- package marketplace
- remote pod orchestration

## Production Readiness

Bootstrap is production-designed when it can carry later PRs without changing the core durability
model.

### Lifecycle And Ownership

- `apps/runtime` owns store initialization, fixture seeding, and read-only API serving.
- `packages/local-store` owns durable record reads/writes and restart-safe file layout.
- `apps/operator-web` consumes inspect read models only.
- Bootstrap does not run real providers. Provider execution remains a disabled seam.

### Durable Truth And Schema Boundary

- every persisted record must carry an explicit record kind and version
- candidate, image, package, package manifest, runtime unit, loop policy, and communication policy
  records must be stored outside runtime memory
- fixture records must use the same domain contracts as future PR1 materialized records
- trace placeholders are references only; they are not evidence

### Validation And Rejection

- runtime must reject fixture or store records with missing required ids, kind, or version
- package manifests must reject forbidden contents such as credentials, gateway tokens, evaluator
  secrets, or undeclared side-effect paths
- bootstrap must not infer evidence, promotion, live binding, wake, or marketplace meaning from any
  fixture field

### Idempotency And Retry

- store initialization must be idempotent
- fixture seeding must not duplicate the same fixture candidate on restart
- repeated reads must not mutate records
- failed fixture validation should leave an inspectable developer error rather than creating partial
  candidate truth

### Recovery And Restart

- runtime restart must preserve candidate/image/package/runtime-unit/loop-policy records
- local-store writes should use an atomic write posture: write temp content, fsync where practical,
  then rename into place
- index files must be reconstructable from item files or clearly treated as non-authoritative
  projections

### Security, Credentials, And Permissions

- no exchange credentials, provider API keys, gateway tokens, or evaluator secrets belong in
  fixture records or package manifests
- local runtime binds to `127.0.0.1`
- package manifest permissions are declarations only; they do not grant runtime access

### Observability And Operator Inspectability

- runtime health must show store availability
- operator UI must show candidate, image, package, manifest, runtime-unit, communication-policy,
  and loop-policy summaries
- operator UI must make clear that Bootstrap state is fixture/convenience mode, not counted
  evidence or live execution

## Acceptance Criteria

Bootstrap is complete only if:

- `npm` workspace can install/build the new roots
- runtime can initialize local store
- fixture candidate survives restart
- operator web can inspect candidate/image/package state
- operator web can see whether the pod shape is single-agent or future team-capable
- no evidence or live meaning is implied
- PR1 can add materialization as feature work
- PR1 can add `codex_cli` materialization without redefining provider invocation, trace, or output
  contract semantics
- PR1 can enforce package forbidden contents and runtime-unit role separation without changing
  bootstrap domain contracts
