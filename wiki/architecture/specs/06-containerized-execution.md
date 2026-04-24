# Containerized Execution

## Purpose

This page defines how containers support trader-system pods without becoming the whole model.

## Thesis

Containers are important because they create execution and legitimacy boundaries.

But a `TradingSystemPod` is not simply "the container."

The pod is the stage-bound execution instance assembled from:

- `TradingSystemImage`
- `CapabilityPackage`
- `StageBinding`
- one or more `AgentRuntimeUnit` records
- `ToolProxy`
- external trace/evidence sinks

The hands environment may be container-backed. The brain may be provider-managed. A multi-agent pod
may use provider-native subagent threads or A2A-compatible remote endpoints. The session truth must
remain external.

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
| multiagent thread | possible `AgentRuntimeUnit` implementation detail for a provider-managed team |

## Single-Agent And Multi-Agent Container Shapes

MLP-01 may start with one `AgentRuntimeUnit`.

Later pod shapes are allowed only if the communication boundary stays explicit:

| Shape | Hands model | Communication model | Provider posture |
| --- | --- | --- | --- |
| single runtime unit | one hands environment | no agent-to-agent channel | one provider |
| shared-hands team | shared container/filesystem | coordinator-routed or provider-native threads | one or many providers, depending on bridge support |
| independent-hands team | separate hands environments per unit | A2A-compatible or bridge-mediated | can mix providers |
| distributed pod team | separate pod/session endpoints | control-plane mediated plus optional A2A-compatible exchange | can mix providers |

The architecture should not assume that all agents in a team share a container. Claude Managed
Agents does for provider-native multiagent sessions, while A2A is useful when agents are
independent endpoints.

Provider choice is independent of the communication shape. Codex, Claude Code, Claude Managed
Agents, OpenClaw/ACP, local containers, and A2A endpoints are runtime-unit providers or drivers;
they are not separate communication policies.

## Multi-Agent Admission Rule

MLP-01 starts single-agent.

A pod may become multi-agent only when a current PRD acceptance criterion cannot be met by one
runtime unit.

Admission requires:

- explicit `runtime_unit_role` for every `AgentRuntimeUnit`
- one `PodCommunicationPolicy`
- `TeamTrace`
- non-secret `SharedContextSurface` declarations
- no communication path to live authority except `ToolProxy` / gateway

This prevents container shape from becoming an excuse to build an uncontrolled agent mesh.

## Container Role

A container may host the `HandsEnvironment`.

It can provide:

- filesystem isolation
- package/runtime dependencies
- limited network access
- mounted context files
- tool proxy clients
- non-root execution
- output directories

It must not own:

- candidate identity
- package registry truth
- evaluator secrets
- promotion decisions
- live exchange credentials
- the only trace copy

## Mount Policy

Inputs may include:

- trading system image contents
- capability package files
- stage binding files
- read-only market data
- tool proxy configuration
- communication policy
- shared context surface for multi-agent pods

Restricted inputs:

- evaluator ground truth
- live credentials
- promotion decisions
- hidden labels
- gateway signing keys
- secrets in shared context surfaces

Outputs:

- trace fragments
- artifacts
- reports
- proposed order intents
- proposed candidate versions
- A2A-compatible task/message/artifact records when remote agent endpoints participate

Outputs must be exported to durable stores outside the container.

## Backtest / Paper / Live Bindings

The same candidate image can run with:

- backtest binding: historical data, simulated exchange, evaluator
- paper binding: live data, paper exchange/gateway, paper risk envelope
- live binding: live data, real gateway, strict risk envelope, wake policy

The container mode can vary independently from the binding.

## Lifecycle

```text
resolve candidate
-> resolve image/package refs
-> resolve stage binding
-> resolve agent loop policy
-> provision hands environment
-> attach brain session
-> stream trace externally
-> export artifacts
-> tear down or checkpoint
```

No lifecycle step may make the container the system of record.

## Acceptance Test

A reader should be able to explain:

- why pod is larger than container
- why brain and hands can be separated
- why secrets are not mounted as package data
- why containerized execution may support legitimacy
- why trace and evidence remain external
