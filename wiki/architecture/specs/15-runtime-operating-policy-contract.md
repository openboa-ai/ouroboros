# Runtime Operating Policy Contract

## Purpose

This page defines the lifecycle, observability, recovery, and audit envelope around one
`TraderSystemRuntime`.

It replaces the older autonomy/activation framing. The policy does not decide every internal trader-system
step. It defines the operating boundary under which an agent-built trader system may run.

## Thesis

`RuntimeOperatingPolicy` is the control-plane policy for running a deployed trader system safely.

It tells autokairos:

- which lifecycle transitions are allowed
- which placement classes are allowed
- which trace and artifact exports are required
- which tool and gateway boundaries apply
- which timeout, cancellation, retry, resume, stop, and kill rules apply
- which recovery and audit records must survive restart

It does not tell the trader system:

- which market fact to react to
- when to call a provider-backed agent
- which script or planner to run
- how to structure internal trading behavior

## Minimum Contract

A `RuntimeOperatingPolicy` must carry at least:

| Field | Meaning |
| --- | --- |
| `runtime_operating_policy_id` | stable policy identity |
| `runtime_ref` | governed runtime scope |
| `stage_binding_ref` | binding this policy applies to |
| `allowed_lifecycle_transitions` | permitted `RuntimeControl` transitions |
| `placement_policy` | allowed placement classes and sandbox posture |
| `trace_export_policy` | required trace events, span/export destination, and failure posture |
| `artifact_export_policy` | checkpoint/artifact export requirements |
| `tool_access_posture` | allowed tool classes and whether side effects require proxy approval |
| `outbound_gateway_policy` | outbound request classes requiring `ToolProxy`, gateway, evaluator, or operator approval |
| `timeout_policy` | wall-clock or idle timeout where applicable |
| `cancellation_policy` | who may cancel and what trace must be retained |
| `retry_policy` | whether retry creates a new placement/run or resumes an existing one |
| `resume_policy` | whether provider or placement resume is allowed |
| `stop_conditions` | explicit conditions that end execution |
| `kill_conditions` | emergency termination conditions |
| `recovery_policy` | how restart/replacement decisions are made |
| `audit_policy` | required operator/control-plane audit records |

## RuntimeControl Link

`RuntimeControl` commands are evaluated against `RuntimeOperatingPolicy`.

```text
RuntimeControl command
-> RuntimeOperatingPolicy validation
-> RuntimeControlDecision
-> RuntimeLifecycleEvent
-> Trace / Audit
```

The policy may accept, reject, modify, defer, or require review for a lifecycle command. It must not
become an internal step scheduler.

## Logical Boundary Versus Physical Execution

`TraderSystemRuntime` is the logical runtime identity. `RuntimePlacement` is the physical execution
mapping.

Physical execution may be:

- a local process
- a container-backed `HandsEnvironment`
- a provider-managed session
- a Codex or Claude Code working directory
- an OpenClaw/ACP session
- an A2A-compatible remote endpoint

The runtime identity, trace, and control-plane records survive placement replacement.

## Required Trace

Each active runtime must write enough trace to restore product-visible state after process,
container, provider, or connector failure.

Minimum trace/lifecycle events:

- `runtime_registered`
- `runtime_deployed`
- `runtime_start_requested`
- `runtime_placement_bound`
- `agent_session_attached` when applicable
- `agent_run_started` when applicable
- `agent_event` when applicable
- `program_event`
- `tool_request`
- `tool_result`
- `order_intent` when live intent exists
- `gateway_decision` when live authority is evaluated
- `checkpoint`
- `error`
- `runtime_pause_requested`
- `runtime_resume_requested`
- `runtime_stop_requested`
- `runtime_stopped`
- `runtime_killed`
- `runtime_recovery_required`

Trace does not need to recreate a model's hidden state. It must recreate product-visible state:

- which candidate/spec/program/package/binding was running
- which runtime placement was used
- which provider sessions and hands environment were attached
- what outputs crossed the boundary
- what artifacts were exported
- whether the runtime should resume, stop, or require review

## Recovery Rule

On restart, autokairos restores from durable trace and control-plane records, not from a live
container or provider process.

Recovery flow:

```text
load TraderSystemRuntime
-> load RuntimeOperatingPolicy
-> load latest RuntimePlacement and trace cursor
-> load checkpoint / exported artifact refs
-> recreate or reattach physical placement when allowed
-> continue, stop, or require operator review
```

If provider-native resume is unavailable, a new `AgentSession` may be started by the trader system
after placement recovery. That is new execution continuity, not a rewrite of old events.

## Boundary Rules

- the policy bounds runtime operation; it does not author trading behavior
- the trader system may call provider-backed agents internally
- every provider run must produce `AgentRun` and `AgentEvent` trace
- every program execution must produce program events, checkpoints, errors, or artifacts
- every external tool or side-effect request must cross `ToolProxy` or an equivalent gateway
- every rejected or clipped outbound request must remain durable and inspectable
- runtime-local state must never be the only record of what happened
- live execution authority remains `OrderIntent -> GatewayDecision -> ExecutionAttempt`

## Failure Modes Prevented

- autokairos becomes a hidden workflow engine
- provider sessions become product truth
- program output bypasses trace
- runtime cannot be stopped or killed cleanly
- placement failure loses runtime history
- live execution proceeds without gateway decision
- operator intervention is not auditable
