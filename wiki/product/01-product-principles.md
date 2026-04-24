# autokairos Product Principles

## Purpose

These principles translate the source hierarchy into product rules. Downstream PRDs, architecture,
and implementation plans may elaborate them, but must not contradict them.

## Principle 1: The Candidate Is A Trader System

The active meaning of `Candidate` is `TraderSystemCandidate`.

It is not:

- a strategy note
- a chat output
- a single prompt result
- a one-off backtest artifact

It is a versioned candidate trading system that can be run, evaluated, promoted, and controlled.

## Principle 2: The Pod Is The Execution Instance

A `TradingSystemPod` is the stage-bound execution instance of a trader-system candidate.

It is assembled from:

- `TradingSystemImage`
- `CapabilityPackage`
- `StageBinding`
- one or more `AgentRuntimeUnit` records
- `ToolProxy`
- external trace and evidence sinks

The pod is not merely "an agent inside a container." Claude Managed Agents makes the critical
separation clear: brain, hands, and session must remain separate interfaces.

An `AgentRuntimeUnit` is one agent participant:

- `BrainSession`
- `HandsEnvironment`
- allowed tools
- allowed communication channels
- trace/export boundary

For MLP-01, the default pod can be single-agent. The product model must still allow later
managed-team or distributed-agent pods without redefining candidate identity.

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

- counted evidence must come from an evaluator outside the trader-system pod
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

A multi-agent `TradingSystemPod` must be modeled as:

```text
AgentRuntimeUnit[]
+ SharedContextSurface
+ PodCommunicationPolicy
+ TeamTrace
```

Google A2A is the reference for communication between independent agent endpoints. Claude Managed
Agents is the reference for provider-native coordinator/subagent threads in a shared environment.
MCP and `ToolProxy` remain the reference for tools, data, and side-effecting capabilities.

Provider choice belongs to `AgentRuntimeUnit`, not to `PodCommunicationPolicy`.

A single `TradingSystemPod` may contain heterogeneous runtime units, for example:

```text
coordinator: Claude Managed Agents
researcher: Codex
implementation-checker: Claude Code
runtime-bridge: OpenClaw / ACP
```

`PodCommunicationPolicy` remains one unified policy over that mixed team. It answers:

- which runtime units may talk
- whether communication is coordinator-routed, direct, or disabled
- which shared context surfaces are visible
- which artifacts must be exported to `TeamTrace`
- which channels are forbidden near live execution

Implication:

- `AgentRuntimeUnit` outputs become trace inputs unless the evaluator later seals them as evidence
- A2A tasks and artifacts are not promotion decisions
- shared context is not shared secrets
- agent-to-agent messages never grant live execution authority
- MLP-01 may start single-agent, but must not block a future team-pod or distributed-pod model

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
- which image and capability packages are active?
- which binding is active?
- what evidence counted?
- what authority does the live pod have?
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

## Principle 12: Product Truth Precedes Architecture

Architecture implements the product model:

```text
MLP -> PRD -> Architecture -> Slice Design -> PR
```

Architecture must not redefine the user, candidate identity, first wedge, evaluation legitimacy,
live gate, or bounded autonomy posture.

## What These Principles Force Downstream

Any downstream document that changes one of the following must first update product truth:

- `TraderSystemCandidate` as the active candidate meaning
- `TradingSystemPod` as the execution unit
- `CapabilityPackage` as the context/tool artifact boundary
- backtest/paper/live as bindings
- external evaluator ownership of counted evidence
- bounded live authority through autokairos gateway
- clone/evaluate/promote as the only self-evolution path
- explicit multi-agent communication boundaries when pods use more than one agent runtime unit

## Read Next

1. [02-market-icp-and-alternatives.md](02-market-icp-and-alternatives.md)
2. [mlp-01/00-mlp-brief.md](mlp-01/00-mlp-brief.md)
