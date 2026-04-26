# Containerized Execution

## Purpose

This page defines how containers support trader-system runtimes without becoming the whole model.

## Thesis

Containers are important because they create execution and legitimacy boundaries.

But a `TraderSystemRuntime` is not simply "the container."

The runtime is the logical stage-bound execution instance assembled from:

- `TraderSystemSpec`
- `TraderSystemProgram`
- `CapabilityPackage`
- `CapabilityPackageAdmissionRecord`
- `CapabilityGrant`
- `CapabilityMountRecord`
- `StageBinding`
- one or more `AgentSpec` / `AgentSession` records
- `ToolProxy`
- external trace/evidence sinks

The default serious execution posture is that the runtime's `HandsEnvironment` is container-backed,
because W2S-style evaluation needs repeatable, inspectable, and isolated run environments.

`TraderSystemProgram` is expected to run inside this hands environment when local execution is
required. It can be open-ended agent-authored code, not a human-predefined strategy DSL.

The brain may be container-local, provider-managed, or remote. A multi-agent runtime may use
provider-native subagent threads or A2A-compatible remote endpoints. The session truth must remain
external.

In short:

```text
TraderSystemRuntime != Docker container
TraderSystemRuntime = logical runtime boundary
RuntimePlacement = physical execution placement and handles
ExecutionPod = optional pod-like physical group under RuntimePlacement
container-backed HandsEnvironment = default reproducible hands substrate
```

Inside the sandbox, the agent-built system should have high freedom to run Python scripts,
generated policies, local planners, indicators, experiments, and internal state files.

Outside the sandbox, every side effect must pass through narrow autokairos contracts.

## Legitimacy Levels

| Mode | Purpose | Evidence posture |
| --- | --- | --- |
| `host-local` | debugging and harness iteration | convenience only |
| `containerized-local` | serious local evaluation | eligible for legitimate local evidence if evaluator boundary is preserved |
| `containerized-remote` | scalable or stronger-isolation runs | eligible for larger legitimate evaluations |

These modes are not the same as `backtest`, `paper`, and `live`. They are execution-environment
legitimacy levels that can support those bindings.

## Brain / Hands / Session Mapping

| Managed Agents concept | autokairos concept |
| --- | --- |
| brain / harness | `BrainSession` |
| hands / sandbox | `HandsEnvironment` |
| session log | external `Trace` and control-plane records |
| resources | `CapabilityPackage` plus binding resources |
| vault | credential injection through vault/gateway |
| multiagent thread | possible `AgentSession` implementation detail for a provider-managed team |

## Single-Agent And Multi-Agent Container Shapes

MLP-01 may start with one `AgentSession`.

Later runtime shapes are allowed only if the communication boundary stays explicit:

| Shape | Hands model | Communication model | Provider posture |
| --- | --- | --- | --- |
| single agent session | one hands environment | no agent-to-agent channel | one provider |
| shared-hands team | shared container/filesystem | coordinator-routed or provider-native threads | one or many providers, depending on bridge support |
| independent-hands team | separate hands environments per session | A2A-compatible or bridge-mediated | can mix providers |
| distributed runtime team | separate runtime/session endpoints | control-plane mediated plus optional A2A-compatible exchange | can mix providers |

The architecture should not assume that all agents in a team share a container. Claude Managed
Agents does for provider-native multiagent sessions, while A2A is useful when agents are
independent endpoints.

Provider choice is independent of the communication shape. Codex, Claude Code, Claude Managed
Agents, OpenClaw/ACP, local containers, and A2A endpoints are agent-session providers or drivers;
they are not separate communication policies.

## Multi-Agent Admission Rule

MLP-01 starts single-agent.

A runtime may become multi-agent only when a current PRD acceptance criterion cannot be met by one
agent session.

Admission requires:

- explicit slice-local `AgentRun.purpose` for every `AgentRun`
- one `RuntimeCommunicationPolicy`
- `TeamTrace`
- non-secret `SharedContextSurface` declarations
- no communication path to live authority except `ToolProxy` / gateway

This prevents container shape from becoming an excuse to build an uncontrolled agent mesh.

## Container Role

A container may host the `HandsEnvironment`.

An `ExecutionPod` may group one or more containers, local processes, sidecars, or sandbox surfaces
when they share lifecycle, network, storage, and trace export. Do not create an `ExecutionPod`
record merely because the design is inspired by Kubernetes; create it only when the physical
execution placement is actually pod-like.

For serious backtest, paper, or live-adjacent evaluation, this is the default expectation unless a
slice explicitly accepts weaker `host-local` convenience mode.

It can provide:

- filesystem isolation
- package/runtime dependencies
- `TraderSystemProgram` execution
- limited network access
- mounted context files
- tool proxy clients
- non-root execution
- output directories

It must not own:

- candidate identity
- trader-system spec truth
- trader-system program truth
- candidate materialization truth
- package registry truth
- durable session/event truth
- evaluator secrets
- promotion decisions
- live exchange credentials
- the only trace copy

## Physical Execution Boundary

The container is one possible physical execution surface, not the runtime identity.

For each launch or resume, the `RuntimeConnector` records a `RuntimePlacement` that says:

- which logical `TraderSystemRuntime` is being placed
- which process/container/provider/remote endpoint is used
- which `BrainSession` and `HandsEnvironment` are attached
- which packages, mounts, network policy, and tool-proxy routes are active
- where trace and artifacts are exported
- whether the physical execution is active, stopped, failed, recreated, or abandoned

If the container dies, the logical runtime does not disappear. autokairos recovers or stops the runtime from
durable `Trace`, `RuntimePlacement`, exported artifacts, and control-plane records.

## Program Freedom Boundary

`TraderSystemProgram` is agent-authored executable behavior.

It may contain:

- Python modules
- shell scripts
- TypeScript or JavaScript modules
- generated rule engines
- local planners
- indicator code
- market-state processors
- self-authored internal scheduling or monitoring logic
- internal cache or state files

autokairos must not reduce this to a fixed human-authored strategy form or a narrow trigger/playbook
DSL. That would recreate the weak-human bottleneck the product is meant to escape.

The mandatory boundary is output, not internal strategy shape.

Allowed exported outputs include:

- trace fragments
- diagnostic artifacts
- metric snapshots
- `ReviewRequest`
- `ReviewRequest`
- `OrderIntent`
- proposed `CandidateVersion` artifacts

Forbidden outputs and side effects include:

- direct exchange API calls
- raw secret reads
- evaluator ground-truth access
- direct live gateway token use
- unlogged network side effects
- self-promotion or counted-evidence writes

The sandbox may execute freely, but the gateway and control plane decide what counts, what can trade,
and what persists as durable truth.

## Mount Policy

Inputs may include:

- trading trader-system spec contents
- trader-system program files
- capability package files mounted read-only by default after admission and grant
- stage binding files
- read-only market data
- tool proxy configuration
- communication policy
- shared context surface for multi-agent runtimes

Restricted inputs:

- evaluator ground truth
- live credentials
- promotion decisions
- hidden labels
- gateway signing keys
- secrets in shared context surfaces
- rejected or quarantined capability packages
- hidden evaluator labels, benchmark answers, or scoring ground truth

Outputs:

- trace fragments
- artifacts
- reports
- proposed order intents
- proposed next attention plans
- proposed candidate versions
- A2A-compatible task/message/artifact records when remote agent endpoints participate

Outputs must be exported to durable stores outside the container.

Package injection must be traceable. Each runtime run should be able to report which
`CapabilityPackage` ids and versions were mounted, which admission record allowed consideration,
which `CapabilityGrant` allowed access under the current stage binding, and which declared tools
were registered with the `ToolProxy`.

Package content and runtime output must stay separate:

- package files are read-only by default
- generated files go to scratch, artifacts, trace, or candidate-version proposals
- runtime writes must not mutate the package artifact silently
- `CapabilityMountRecord` records mounted content refs, excluded content refs, mount mode, and trace
  refs
- a mounted package is not evidence and does not grant live authority

## Backtest / Paper / Live Bindings

The same candidate spec can run with:

- backtest binding: historical data, simulated exchange, evaluator
- paper binding: live data, paper exchange/gateway, paper risk envelope
- live binding: live data, real gateway, strict risk envelope, operating policy

The container mode can vary independently from the binding.

## Lifecycle

```text
resolve candidate
-> resolve spec/program/package refs
-> resolve trader-system program artifact refs
-> resolve stage binding
-> resolve runtime autonomy contract
-> provision hands environment
-> attach brain session
-> execute or resume trader-system program inside sandbox when the lifecycle command or runtime requires it
-> stream trace externally
-> export artifacts
-> tear down or checkpoint
```

No lifecycle step may make the container the system of record.

Container teardown must not destroy the only useful record of the run. Trace fragments, artifacts,
validation failures, proposed order intents, and provider events that matter for later evaluation
or debugging must be exported outside the container before the run is considered complete.

## Acceptance Test

A reader should be able to explain:

- why runtime is larger than container
- why the default serious hands substrate is container-backed
- why brain and hands can be separated
- why secrets are not mounted as package data
- why containerized execution may support legitimacy
- why trace and evidence remain external
