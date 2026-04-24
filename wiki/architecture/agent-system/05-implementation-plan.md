# Agent System Implementation Plan

This page turns the agent-system design into an implementation sequence.

It follows:

- [01-overview.md](01-overview.md)
- [02-execution-lifecycle.md](02-execution-lifecycle.md)
- [03-state-and-ownership.md](03-state-and-ownership.md)
- [04-runtime-driver-model.md](04-runtime-driver-model.md)
- [06-first-code-seam.md](06-first-code-seam.md)
- [07-persistent-operations-model.md](07-persistent-operations-model.md)
- [08-production-agent-design.md](08-production-agent-design.md)
- [../specs/23-wake-trigger-record-contract.md](../specs/23-wake-trigger-record-contract.md)
- [../specs/28-wake-policy-precedence-and-overlap-contract.md](../specs/28-wake-policy-precedence-and-overlap-contract.md)

## Thesis

The first autokairos implementation should build the agent system in the same order the execution
subsystem actually depends on itself.

That means:

- wake authority first
- durable references first
- live trace second
- stage resolution before runtime launch
- persistent substrate assumptions before hot runtime assumptions
- workspace host before real runtime integration

## Goal

Establish one serious, architecture-faithful production-agent path that proves autokairos can run
a persistent trading agent without collapsing durable truth into one runtime, one container, or
one workspace.

## First Serious Target

The first serious target remains:

> one persistent agent identity, one candidate-aware execution path, one session continuity path,
> one container-backed workspace host, one runtime bridge, and one external trace sink.

This is enough to validate the agent system as a subsystem instead of a prompt wrapper.

The chosen first posture should stay explicit:

- one stage: `backtesting`
- one serious execution mode: `containerized-local`
- one explicit wake default: `cold` for the first serious stage
- one runtime bridge path
- one explicit durable truth layer outside the runtime, centered on append-only history plus
  current-state projections, with backend choice left downstream

## Interfaces To Define First

The first implementation should define these interfaces before provider-specific runtime work.

- wake-policy shape
- standing-order shape
- wake-trigger record shape
- governed execution request shape
- execution-attempt record shape
- durable execution-record store
- external trace sink
- stage-binding resolver
- production-agent operational state machine
- production-agent tool-surface and guardrail layer
- production-agent observability surface
- wake-policy classification surface
- workspace materializer
- container workspace host
- runtime bridge

## Build Order

### 1. Proactive control-plane truth

Before the runtime is treated as part of a living system, the control plane needs a durable place
for:

- `WakePolicy`
- `StandingOrder`
- `SelfSchedulingIntent` history
- wake-trigger history or a clear equivalent
- precedence and overlap outcomes expressed durably through trigger records and emitted request
  linkage

This is the upstream prerequisite for governed self-scheduling.

### 2. Control-plane execution records

Before a runtime can run meaningfully, the system needs a durable place for:

- `ExecutionRequest`
- `ExecutionAttempt`
- `AgentIdentity`
- `Candidate`
- `Session`
- `Trace`
- lightweight execution references

This does not require the whole control plane yet.

It does require explicit ownership outside the runtime.

It also requires proactively emitted requests to preserve:

- one primary wake-trigger reference
- any coalesced wake-origin references that materially contributed to the request

### 3. Trace sink

The trace sink should exist before the first serious runtime integration.

Otherwise the system will drift toward:

- stdout as truth
- workspace files as truth
- runtime-local memory as truth

All three are wrong for autokairos.

### 4. Stage-binding resolver

The first run should still resolve `StageBinding` explicitly, even if only one concrete stage
exists at first.

That avoids hard-coding stage semantics into runtime instructions.

### 5. Wake-policy classification

Before the first serious runtime is treated as persistent, the system should classify wake posture
explicitly.

The first implementation does not need every stage or optimization, but it should still know:

- what stays always on outside the runtime
- what counts as `cold`, `warm`, and `hot`
- that the first serious candidate run defaults to `cold`

### 6. Workspace materializer

The system should then be able to shape a bounded workspace from:

- candidate context
- session continuity
- stage binding
- runtime-facing instructions

This is the point where the execution surface becomes real.

### 7. Container workspace host

Only after the workspace is materialized should the first serious host be built.

The initial host should be:

- local
- container-backed
- disposable
- recreatable without losing durable truth

### 8. Runtime bridge implementation

Then the bridge can become real.

The first bridge should be able to:

- probe driver availability
- start a run
- attach or resume if possible
- stream trace
- interrupt and stop

### 9. Session continuity path

Once the bridge is live, session continuity should be tested as a real behavior:

- fresh run
- interrupted run
- resumed run

The point is to prove that continuity depends on explicit system surfaces, not a lucky surviving
container.

### 10. Backtesting connector surface

The first stage-local action surface should then be implemented for `backtesting`.

This is the first point where the agent becomes useful in the product domain rather than only
architecturally sound.

## Risks And Failure Modes

The first implementation should explicitly guard against these risks.

- treating stdout or workspace files as the authoritative run record
- letting stage semantics leak into prompt text instead of a resolved binding
- tying continuity to one surviving container
- letting the runtime bridge become the first owner of durable truth
- introducing provider-specific assumptions before the bridge contract is stable
- treating one long-lived runtime as the continuity model instead of a latency optimization

## Test And Acceptance Criteria

The first implementation should prove all of the following.

1. A governed request can start a real runtime attempt.
2. The system can explain which primary wake trigger, wake policy, and standing authority allowed
   that request to exist.
3. If several wake candidates were coalesced, the system can still show that history durably.
4. The runtime executes inside a bounded workspace.
5. The system can externalize trace while the runtime is active.
6. The system can survive container loss without losing durable truth.
7. The same agent identity can be resumed through a session continuity path.
8. Stage semantics are resolved outside prompt text.
9. The first serious candidate run can explain why it is `cold`, not just that it happens to start
   cold.

## Explicitly Deferred

The first implementation should not try to solve everything.

Still deferred:

- `paper` and `live`
- automatic promotion
- rich evaluation UI
- full review queue operations
- many runtime providers
- complex multi-agent decomposition

This is not because those topics are unimportant.

It is because the agent system should first prove that its core execution architecture is sound.

## Relationship To The Supporting Specs

This page is the section-level implementation plan.

The more detailed supporting specs remain:

- [../05-agent-execution-architecture.md](../specs/05-agent-execution-architecture.md)
- [../06-containerized-execution.md](../specs/06-containerized-execution.md)
- [../07-runtime-bridge-interface.md](../specs/07-runtime-bridge-interface.md)
- [../12-governed-execution-request-contract.md](../specs/12-governed-execution-request-contract.md)
- [../13-execution-attempt-contract.md](../specs/13-execution-attempt-contract.md)
- [../specs/21-wake-policy-contract.md](../specs/21-wake-policy-contract.md)
- [../specs/22-standing-order-contract.md](../specs/22-standing-order-contract.md)
- [../specs/23-wake-trigger-record-contract.md](../specs/23-wake-trigger-record-contract.md)
- [../specs/28-wake-policy-precedence-and-overlap-contract.md](../specs/28-wake-policy-precedence-and-overlap-contract.md)
- [../specs/15-persistent-operations-and-wake-policy.md](../specs/15-persistent-operations-and-wake-policy.md)
- [../specs/16-production-agent-state-machine.md](../specs/16-production-agent-state-machine.md)
- [../specs/17-production-agent-tool-surface-and-guardrails.md](../specs/17-production-agent-tool-surface-and-guardrails.md)
- [../specs/18-production-agent-observability-and-slos.md](../specs/18-production-agent-observability-and-slos.md)

Use this page to understand implementation order.

Use the supporting specs to answer lower-level execution questions while building.

If the implementation question becomes "what should be coded before the first real runtime
integration," continue with [06-first-code-seam.md](06-first-code-seam.md).
