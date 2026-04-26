# autokairos Product Strategy

## Purpose

This page defines the product strategy above any single MLP, PRD, or architecture page.

## Product Thesis

**autokairos is an automated weak-to-strong trader: a control plane for evolving agent-built
trader-system runtimes across backtest, paper, and live bindings.**

The strategy is not to build another trading dashboard, research notebook, generic agent shell, or
manual strategy workbench.

The strategy is to let a weak human supervisor create, run, evaluate, promote, and control a small
pool of stronger agent-built trading systems without becoming the runtime.

In this strategy, the unit of product value is not a strategy note. It is a
`TraderSystemCandidate`: a versioned candidate trading system that can run as the same
`TraderSystemSpec` under different bindings.

## Source-Role Hierarchy

autokairos uses the reference set with explicit weights.

| Source family | Product role | What transfers |
| --- | --- | --- |
| AAR / Automated W2S / automated-w2s-research | Thesis spine | weak human supervision, evaluation bottleneck, external evaluator truth, legitimacy modes |
| Claude Managed Agents | Interface spine | `brain / hands / session`, versioned agent config, environment templates, event streams, resource injection |
| Google A2A | Agent communication spine | interoperable agent endpoints, agent cards, task/message/artifact exchange, A2A-vs-MCP boundary |
| Paperclip | Governance spine | wake, approval, intervention, rollback-like control, audit |
| Codex / Claude Code / OpenClaw / Multica | Harness/orchestration spine | external runtime adapters, background work, task/session management, operator re-entry |

autokairos is not cloning any one source. It is extracting the boundary lessons that matter for
trading-system evaluation and live control.

## Target User

The first user is still one serious solo crypto operator.

This user:

- trades real capital
- wants leverage from autonomous agent systems rather than another copilot surface
- cannot continuously supervise many candidate systems manually
- will trust autonomy only when evaluation, promotion, limits, and intervention are visible
- needs one narrow live proof before believing broader venue or marketplace claims

## Core Problem

The root problem is not that the operator lacks ideas.

The root problem is that a human becomes a weak supervisor relative to stronger, always-on,
agent-built trader systems.

That creates three product failures:

- promising candidate systems stay trapped in transient harness output
- evaluation is not external, legitimate, or comparable enough to promote safely
- live operation either becomes reckless direct automation or collapses back into hidden human labor

autokairos solves this by making trader-system candidates durable, runnable, evaluable,
promotable, and controllable.

## Strategic Wedge

The first wedge stays deliberately narrow:

- one user: serious solo crypto operator
- one market: Binance BTC perpetual futures
- one candidate shape: small pool of agent-built trader-system candidates
- one proof: one promoted bounded trader-system runtime can run live and remain controllable

The first market is narrow, but the candidate model is not a one-off static note. It is the
smallest product proof of a system that can later support richer candidate pools, package exchange,
and multiple execution environments.

## Product Shape

The product shape is:

```text
weak human operator
-> small pool of TraderSystemCandidates
-> TraderSystemSpec + TraderSystemProgram + CapabilityPackage
-> backtest / paper / live StageBindings
-> external evidence
-> promotion decision
-> bounded live runtime
-> wake / intervention / audit
```

Key definitions:

- `TraderSystemCandidate` is the promotable candidate trading system.
- `TraderSystemSpec` is the versioned system artifact that should remain stable across
  environments.
- `TraderSystemProgram` is the agent-authored executable behavior bundle inside the spec.
- `CapabilityPackage` is the packageable context/tool/skill/data-access artifact injected into the
  runtime.
- `StageBinding` defines how the same system is run in `backtest`, `paper`, or `live`.
- `TraderSystemRuntime` is the stage-bound execution instance of the candidate system.
- `AgentSpec` is the configured agent participant definition.
- `AgentSession` is one running brain/hands/session participant inside or beside a runtime.
- `AgentRun` is one provider invocation, task, turn, or attempt against that session.
- `AgentEvent` is raw provider/runtime output that may become trace but is not evidence by itself.
- `AgentSession.provider_kind` defines which backend runs that participant:
  Codex, Claude Code, Claude Managed Agents, OpenClaw/ACP, local container, or a future equivalent.
- `RuntimeCommunicationPolicy` is one unified policy for all participants in the runtime. It defines
  topology, allowed channels, shared context, artifact routing, and isolation rules. It is not a
  provider selector.

Single-agent runtimes are the first proof. Multi-agent runtimes are allowed only when they preserve the
same control-plane boundaries:

`TraderSystemProgram` must remain open-ended. autokairos should not constrain the agent to a
human-authored strategy DSL. The product defines sandbox, trace, evaluation, permission, and gateway
contracts; the agent-built trader system defines its own trading behavior inside those contracts.

```text
many AgentSessions, possibly with different providers
-> explicit shared context surface
-> traceable task/message/artifact exchange
-> external evaluation
-> bounded live authority
```

## Differentiation

autokairos differentiates through product boundaries:

- candidate identity is the trader system, not a strategy note
- context and tools are packaged as explicit artifacts
- the same system artifact can be evaluated across stronger bindings
- multi-agent trader systems can use independent agent sessions without becoming an
  uncontrolled agent mesh
- counted evidence comes from external evaluation, not agent self-report
- live agent authority is bounded through an autokairos gateway
- self-evolution happens through cloned candidate versions, not live in-place mutation
- wake, intervention, and audit are part of the product value

## Why Now

The timing matters because external agent harnesses are becoming good enough to create and iterate
candidate systems, while W2S-style research makes the bottleneck clear: the hard part is not idea
generation, but legitimate evaluation and promotion.

Claude Managed Agents adds one important interface lesson: do not couple the brain, hands, and
session into one fragile runtime. autokairos should own the control plane and evaluation truth while
letting external harnesses provide the evolving agent brain.

## What The Strategy Avoids

autokairos should not drift into:

- full Kubernetes cloning
- full marketplace scope in the first MLP
- direct exchange access from agent harnesses
- a generic multi-agent platform
- venue breadth before one venue proof works
- treating Claude outcomes, agent self-critique, or custom tool results as legitimate trading
  evidence

## Strategy Success Signals

The strategy is on track when:

- readers understand that `Candidate` means `TraderSystemCandidate`
- backtest, paper, and live are understood as bindings for the same artifact
- `CapabilityPackage` is understood as a future-tradable artifact boundary
- one serious operator can explain why a promoted live runtime is trusted
- implementation can start from runtime/spec/capability/evaluator boundaries without rediscovering the
  product thesis

## Read Next

1. [01-product-principles.md](01-product-principles.md)
2. [02-market-icp-and-alternatives.md](02-market-icp-and-alternatives.md)
3. [mlp-01/00-mlp-brief.md](mlp-01/00-mlp-brief.md)
