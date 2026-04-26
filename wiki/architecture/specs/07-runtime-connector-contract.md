# Runtime Connector Contract

## Purpose

This page defines the stable interface between autokairos control-plane records and physical
execution surfaces.

It is paired with
[../06-runtime-provider-adapter-feasibility.md](../06-runtime-provider-adapter-feasibility.md),
which turns provider names into concrete invocation surfaces.

## Thesis

The runtime connector maps a logical `TraderSystemRuntime` onto a replaceable
`RuntimePlacement`.

It launches, observes, interrupts, stops, and tears down placements. It does not own candidate
truth, evidence truth, promotion authority, live execution authority, or internal trader-system
behavior.

The connector is not a supervisor pattern and not a central workflow manager. It is the boundary
that keeps lifecycle control, physical execution, trace export, artifacts, tool requests, provider
runs, and gateway requests attached to durable control-plane records.

## Logical Boundary And Physical Boundary

| Boundary | Meaning | Owned by |
| --- | --- | --- |
| `TraderSystemRuntime` | logical deployed runtime instance of a candidate | control plane record plus runtime connector |
| `RuntimePlacement` | physical execution placement and handles for one launch/resume | runtime connector |
| `HandsEnvironment` | sandbox/tool/data/program execution surface | connector/provider, referenced durably |
| `AgentSession` | provider/harness reasoning session used by the trader system when needed | provider or harness, referenced durably |
| `Trace` | recoverable append-only session log | trace store / control plane |

The logical runtime may survive multiple runtime placements.

## Connector Input

The connector accepts a governed runtime-control command plus resolved runtime records.

Minimum command context:

- `runtime_control_command`
- `runtime_ref`
- `candidate_ref`
- `candidate_version_ref`
- `trader_system_spec_ref`
- `trader_system_program_ref`
- `capability_package_refs`
- `stage_binding_ref`
- `runtime_operating_policy_ref`
- `runtime_placement_ref` when resuming or stopping
- `agent_session_refs` when applicable
- per-session `provider_kind`
- per-session invocation surface
- per-session `provider_readiness_record_ref` for real provider execution
- hands environment spec
- capability mount refs
- runtime memory surface refs visible to the placement
- tool proxy policy
- runtime communication policy
- trace destination
- timeout policy
- interrupt/cancel policy

The command may be lifecycle-oriented: register, deploy, start, pause, resume, stop, inspect,
override, or kill. It must not be a request for the connector to choose internal trading behavior.

## Connector Output

The connector returns:

- `runtime_control_decision_ref`
- `runtime_lifecycle_event_ref`
- `runtime_placement_ref`
- `hands_environment_ref`
- `agent_session_refs` when applicable
- `execution_handle` when applicable
- trace stream reference
- artifact export references
- completion or placement status
- failure reason when rejected or failed

## Required Operations

| Operation | Purpose |
| --- | --- |
| `probeDriver` | confirm the selected process/container/provider/external bridge is available |
| `probeProviderReadiness` | create or refresh the readiness record that makes a provider surface runnable |
| `resolveRuntimeProviderAdapter` | map concrete `provider_kind` to a callable adapter implementation |
| `validateRuntimeOperatingPolicy` | verify lifecycle command against the operating boundary |
| `createRuntimePlacement` | allocate physical placement for one logical runtime launch or resume |
| `attachRuntimePlacement` | attach to an existing placement if safe |
| `prepareHandsEnvironment` | materialize sandbox, package mounts, tool clients, network policy, and scratch space |
| `prepareAgentSessions` | resolve provider-backed sessions the trader system may call |
| `startRuntime` | launch a deployed trader system into placement |
| `pauseRuntime` | stop new side effects and retain inspectability |
| `resumeRuntime` | continue a paused runtime under policy |
| `stopRuntime` | cleanly end placement and retain trace/artifacts |
| `killRuntime` | emergency terminate when safe stop is unavailable |
| `exportTrace` | stream lifecycle, program, provider, tool, gateway, artifact, and error events |
| `exportArtifacts` | move checkpoints/output artifacts out of placement-local state |

## Provider-Backed Agent Execution

Agent execution inside a `TraderSystemRuntime` is provider-backed by default.

```text
TraderSystemProgram
-> AgentSession
-> RuntimeProviderAdapter
-> external provider or harness
-> AgentRun
-> AgentEvent
-> Trace
```

The provider may be Codex, Claude, OpenClaw/ACP, A2A, or `local_process`. Provider choice changes
invocation mechanics only. It must not change candidate identity, evidence meaning, promotion
authority, live gateway authority, or audit ownership.

The connector owns:

- selecting a concrete `RuntimeProviderAdapter`
- probing availability, auth, model/tool access, and output contract support
- starting `AgentRun` records against an `AgentSession`
- normalizing provider events into `AgentEvent`
- exporting trace and artifacts out of provider-local/session-local state
- enforcing interruption, timeout, cancellation, and trace requirements from
  `RuntimeOperatingPolicy`

The provider owns model reasoning and provider-native session continuity before normalization.

## `RuntimePlacement`

`RuntimePlacement` records the physical placement selected for one launch or resume.

Minimum fields:

- `runtime_placement_id`
- `runtime_ref`
- `stage_binding_ref`
- `execution_mode`: `host-local`, `containerized-local`, `containerized-remote`,
  `provider-managed`, or `remote-endpoint`
- `execution_pod_ref` when the placement uses a pod-like physical execution group
- `hands_environment_ref`
- `agent_session_refs`
- `container_or_process_handle_ref` when applicable
- `working_directory_ref`
- `mount_refs`
- `network_policy_ref`
- `tool_proxy_ref`
- `credential_boundary_refs` visible only to proxy/gateway layers
- `trace_ref`
- `created_at`
- `ended_at`
- `status`

`RuntimePlacement` is not product truth. It is the physical mapping needed to inspect, debug,
interrupt, and recover the logical runtime.

## `ExecutionPod`

`ExecutionPod` is an optional physical grouping inside `RuntimePlacement`.

Create or attach an `ExecutionPod` only when the execution surface is pod-like: one or more
co-scheduled processes, containers, sandboxes, or sidecars that share lifecycle, network, mounted
packages, scratch storage, and trace export.

Do not create an `ExecutionPod` record for a plain provider-managed session or remote A2A endpoint
unless autokairos actually controls a pod-like execution group around it.

## RuntimeControl Decisions

The connector must record whether a control command was:

- accepted
- rejected
- modified
- deferred
- applied
- failed
- requires operator review

Rejected, failed, killed, and review-required decisions must retain reason, trace refs, and
placement status when available.

## Boundary Rules

- connector lifecycle control is not internal step orchestration
- connector placement state is not candidate, evidence, or promotion truth
- provider output enters only as `AgentEvent -> Trace`
- `local_process` still needs trace, permission, output contract, and failure handling
- A2A is remote agent communication, not tool access, evidence, promotion, or live authority
- live side effects still go through `OrderIntent -> GatewayDecision -> ExecutionAttempt`
- runtime-local state must be exported or considered non-durable
