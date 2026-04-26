# autokairos Product Principles

## Purpose

These principles translate the source hierarchy into product rules. Downstream planning,
architecture, and implementation documents may elaborate them, but must not contradict them.

## Principle 1: The Candidate Is A Trader System

The active meaning of `Candidate` is `TraderSystemCandidate`.

It is not:

- a strategy note
- a chat output
- a single prompt result
- a one-off backtest artifact

It is a versioned candidate trading system that can be run, evaluated, promoted, and controlled.

## Principle 2: The Runtime Is The Logical Execution Instance

A `TraderSystemRuntime` is the stage-bound execution instance of a trader-system candidate.

It is assembled from:

- `TraderSystemSpec`
- `TraderSystemProgram`
- `CapabilityPackage`
- `StageBinding`
- one or more `AgentSpec` and `AgentSession` records
- `RuntimeOperatingPolicy`
- `RuntimeCommunicationPolicy`
- `ToolProxy`
- external trace and evidence sinks

The runtime is not merely "an agent inside a container." Claude Managed Agents makes the critical
separation clear: brain, hands, and session must remain separate interfaces. OpenAI's newer
agent/sandbox posture adds the same boundary in different language: harness, compute, session,
trace, and capability manifest must not collapse into one runtime blob.

`TraderSystemRuntime` is the logical runtime boundary. `RuntimePlacement` is the physical placement:
process, container, provider-managed environment, or remote endpoint. Physical placement may be
recreated; the logical runtime, trace, and control-plane truth must survive.

`ExecutionPod` is a physical-only term. Use it only when the placement is actually pod-like:
co-scheduled execution surfaces sharing sandbox, network, storage, lifecycle, and trace export.

`TraderSystemProgram` is the agent-authored executable behavior bundle that can run inside the
hands/sandbox environment. It is not a human-authored strategy DSL. autokairos constrains its
outputs and side effects, not the internal creativity of the program.

The runtime owns internal trading behavior. It may choose whether to invoke an agent brain, run a
program, execute local scripts, use scratch state, or do nothing. autokairos owns the operating
boundary around that behavior: lifecycle control, placement, event export, trace, tool proxy,
gateway, intervention, external evaluation, promotion, and audit.

The agent brain inside a runtime is provider-backed by default:

```text
TraderSystemRuntime
-> RuntimePlacement
-> AgentSession
-> RuntimeProviderAdapter
-> external provider or harness
-> AgentRun
-> AgentEvent
-> Trace
```

Codex, Claude, OpenClaw/ACP, A2A, and local processes provide reasoning or harness execution
capability behind `RuntimeProviderAdapter`. They do not become the runtime, the control plane, the
system of record, the evaluator, or the live gateway.

Trace is not just observability after the fact. It is the minimum recoverable session log used to
reattach, recreate, stop for review, or abandon a runtime safely after runtime failure.

An `AgentSpec` is the configured agent participant, close to Claude Managed Agents' `Agent`.

An `AgentSession` is one running agent participant, close to Claude Managed Agents' `Session`:

- `BrainSession`
- `HandsEnvironment`
- allowed tools
- allowed communication channels
- trace/export boundary

For MLP-01, the default runtime can be single-agent. The product model must still allow later
managed-team or distributed-agent runtimes without redefining candidate identity.

## Principle 3: Backtest, Paper, And Live Are Bindings

Backtest, paper, and live are not separate systems.

They are different `StageBindings` injected into the same candidate artifact.

Implication:

- promotion means the same candidate system earns the right to run under a stronger binding
- live should not require rewriting the candidate into a different product object
- evaluation legitimacy depends on controlling which binding was used

## Principle 4: Capability Is A Packageable Artifact

Context, tools, skills, data access, market notes, and adapter requirements must be packaged as
`CapabilityPackage` artifacts.

Secrets and credentials are not package contents.

Implication:

- packages can later become shareable or tradable units
- package provenance and versioning matter from the beginning
- package usage must be auditable
- vaults, bindings, or tool proxies inject credentials at runtime

## Principle 5: Evaluation Is The Bottleneck

autokairos does not win by producing many candidate systems.

It wins by making a small pool of candidate systems externally evaluable and legitimately
promotable.

Implication:

- counted evidence must come from an evaluator outside the trader-system runtime
- convenience runs and legitimate runs must remain distinct
- outcome rubrics, self-critiques, and tool results are not automatically trading evidence

## Principle 6: Weak Human Supervision Is The Root Problem

The user is not weak as a thinker.

The user is weak as a continuous supervisor of stronger, always-on trader systems.

Implication:

- the product must reduce hidden human runtime labor
- the operator should inspect and decide at key gates, not manually carry every stage
- trust comes from external truth, bounded authority, and intervention clarity

## Principle 7: Live Authority Is Bounded

An agent brain may observe, reason, propose, and explain.

It must not hold direct unrestricted exchange authority.

Live execution flows through autokairos-owned gateways:

```text
agent judgment -> OrderIntent -> risk gateway -> GatewayDecision -> ExecutionAttempt
```

## Principle 8: Multi-Agent Communication Is Explicit

Multi-agent does not mean blending several agents into one hidden runtime.

A multi-agent `TraderSystemRuntime` must be modeled as:

```text
AgentSpec[]
AgentSession[]
+ SharedContextSurface
+ RuntimeCommunicationPolicy
+ TeamTrace
```

Google A2A is the reference for communication between independent agent endpoints. Claude Managed
Agents is the reference for provider-native coordinator/subagent threads in a shared environment.
MCP and `ToolProxy` remain the reference for tools, data, and side-effecting capabilities.

Provider choice belongs to `AgentSession`, not to `RuntimeCommunicationPolicy`.

A single `TraderSystemRuntime` may contain heterogeneous agent sessions, for example:

```text
coordinator: Claude Managed Agents
researcher: Codex
implementation-checker: Claude Code
runtime-connector: OpenClaw / ACP
```

`RuntimeCommunicationPolicy` remains one unified policy over that mixed team. It answers:

- which agent sessions may talk
- whether communication is coordinator-routed, direct, or disabled
- which shared context surfaces are visible
- which artifacts must be exported to `TeamTrace`
- which channels are forbidden near live execution

Implication:

- `AgentSession` outputs become trace inputs unless the evaluator later seals them as evidence
- A2A tasks and artifacts are not promotion decisions
- shared context is not shared secrets
- agent-to-agent messages never grant live execution authority
- MLP-01 may start single-agent, but must not block a future team-runtime or distributed-runtime model

## Principle 9: Self-Evolution Is Versioned

Self-evolution never means mutating the active live system in place.

The valid path is:

```text
live insight -> clone CandidateVersion -> backtest binding -> evidence -> promotion decision
```

This preserves auditability and prevents the live system from silently becoming something else.

## Principle 10: Operator Trust Is A Product Surface

Wake reason, approval meaning, intervention, and audit are core product value.

The operator must be able to answer:

- what system is running?
- which spec and capability packages are active?
- which binding is active?
- what evidence counted?
- what authority does the live runtime have?
- why was I woken?
- what happens if I pause, stop, or override?

## Principle 11: Runtime References Do Not Own Product Truth

Codex, Claude Code, Claude Managed Agents, Google A2A, OpenClaw, and Multica can inform runtime
posture.

They cannot own:

- candidate identity
- evidence legitimacy
- promotion meaning
- live trading authority
- operator trust semantics

Provider-backed execution is an implementation capability, not product authority. A provider output
enters autokairos as `AgentEvent -> Trace`; it becomes evidence only after external evaluation and it
becomes live action only through `OrderIntent -> GatewayDecision -> ExecutionAttempt`.

## Principle 12: Product Truth Precedes Delivery

Architecture implements the product model:

```text
source thesis -> product truth -> runtime architecture -> implementation design -> delivery units
```

Architecture must not redefine the user, candidate identity, first wedge, evaluation legitimacy,
live gate, or bounded autonomy posture.

## What These Principles Force Downstream

Any downstream document that changes one of the following must first update product truth:

- `TraderSystemCandidate` as the active candidate meaning
- `TraderSystemRuntime` as the execution unit
- `TraderSystemProgram` as the open-ended agent-authored executable behavior bundle
- `CapabilityPackage` as the context/tool artifact boundary
- backtest/paper/live as bindings
- external evaluator ownership of counted evidence
- bounded live authority through autokairos gateway
- clone/evaluate/promote as the only self-evolution path
- explicit multi-agent communication boundaries when runtimes use more than one agent session

## Read Next

1. [02-market-icp-and-alternatives.md](02-market-icp-and-alternatives.md)
2. [mlp-01/00-mlp-brief.md](mlp-01/00-mlp-brief.md)
