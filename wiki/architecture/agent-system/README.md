# Agent System

This section defines the runtime-side subsystem that operates brain sessions and harness adapters
for MLP-01 trader-system pods.

## Why This Exists For MLP-01

The agent system exists because autokairos needs a runtime layer that can:

- build and propose `TraderSystemCandidates`
- run candidate-linked brain sessions under stage bindings
- call hands environments and tools without owning durable truth
- execute bounded routine live behavior after promotion
- respond to pause, stop, and override without turning the operator into the runtime loop

## What This Section Owns

- brain-session invocation and lifecycle behavior
- agent-loop policy application without central step-by-step orchestration
- runtime-provider adapter posture, including concrete Codex CLI/SDK, Claude Agent SDK,
  OpenClaw/ACP, A2A endpoint, local-process, or future explicitly designed equivalents
- `AgentRuntimeUnit` resolution, including provider/driver selection for Codex, Claude Code,
  Claude Managed Agents, OpenClaw/ACP, local drivers, A2A endpoints, or future equivalents
- `runtime_unit_role` separation from provider selection
- pod communication routing under one provider-neutral `PodCommunicationPolicy`
- candidate materialization handoff payloads
- `TradingSystemPod` runtime launch behavior from a governed request
- tool-call and hands-environment interaction from the agent side
- execution behavior after the control plane has already authorized a live pod
- runtime response to governed pause, stop, and override

## What This Section Does Not Own

- durable `TraderSystemCandidate` truth
- durable `TradingSystemImage` or `CapabilityPackage` records
- stage-binding authority
- counted evidence meaning
- promotion and live-gate meaning
- exchange credential custody
- A2A task or artifact legitimacy
- wake authority
- durable audit history

## Supported PRD Acceptance

| PRD | What the agent system must support |
| --- | --- |
| PRD 1 | one agent-built `TraderSystemCandidate` can be proposed and handed off for durable materialization without runtime state becoming truth |
| PRD 3 | one promoted candidate can run as a bounded live `TradingSystemPod` and perform routine live actions through governed surfaces |
| PRD 4 | live pod behavior can respond to pause, stop, and override while preserving control-plane auditability |

## Durable Truth, Interfaces, And Recovery Boundaries

The runtime is not the source of truth.

The agent system must therefore consume and emit bounded interfaces around:

- candidate proposal handoff into control-plane materialization
- `TradingSystemPod` launch requests
- brain-session event references
- agent-runtime-unit references
- pod communication policy
- agent loop policy
- hands-environment execution references
- custom tool requests and results
- trace export for later external evaluation

If multiple agent runtime units participate, their messages, tasks, and artifacts must be exported
as `TeamTrace` or trace artifacts. They do not count as evidence unless evaluation later seals them.

For PR1, agent-system responsibility stops after proposing a candidate and handing off bounded
materialization input. The durable candidate record belongs to the control plane.

PR1 uses `runtime_unit_role=builder_agent`, `provider_kind=codex_cli`, and explicit `gpt-5.4`
until provider feasibility evidence changes.

PR3 uses `runtime_unit_role=live_operator_agent` plus a `continuous_live` `AgentLoopPolicy`.

Those roles must not be conflated even if the same provider family can run both.

Recovery must assume that brain sessions, harnesses, and hands environments can fail or be replaced.
The system still needs durable candidate, image, package, binding, execution, wake, and audit truth
outside the runtime.

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-execution-lifecycle.md](02-execution-lifecycle.md)
- [03-state-and-ownership.md](03-state-and-ownership.md)

## Active Spec Gate

The current active supporting specs are:

- [../specs/06-containerized-execution.md](../specs/06-containerized-execution.md)
- [../specs/07-runtime-bridge-interface.md](../specs/07-runtime-bridge-interface.md)
- [../06-runtime-provider-adapter-feasibility.md](../06-runtime-provider-adapter-feasibility.md)
- [../specs/15-agent-loop-policy-contract.md](../specs/15-agent-loop-policy-contract.md)
- [../specs/12-governed-execution-request-contract.md](../specs/12-governed-execution-request-contract.md)
- [../specs/13-execution-attempt-contract.md](../specs/13-execution-attempt-contract.md)

## Not In The Default Baseline

Provider-specific harness lock-in, full multiagent orchestration, full managed-agent dependency,
and runtime-deep observability families remain out of the current default MLP-01 baseline unless a
slice explicitly requires them.

Vague provider labels are also out of baseline. A real provider integration must name
`provider_kind`, invocation surface, auth mode, sandbox policy, trace mode, and output contract.
