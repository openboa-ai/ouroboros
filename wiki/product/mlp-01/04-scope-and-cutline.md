# Scope And Cutline

## Purpose

This page defends the first lovable cut from adjacent but premature scope.

## In Scope

MLP-01 includes:

- small pool of `TraderSystemCandidates`
- durable `TraderSystemSpec` references
- durable `CapabilityPackage` references
- backtest, paper, and live as `StageBindings`
- external trace and evidence boundary
- one live promotion gate
- bounded live agent authority through autokairos gateway
- wake, inspect, pause, stop, override, and audit for the first live runtime
- clone/evaluate/promote path for self-evolution

## Out Of Scope

MLP-01 excludes:

- full marketplace
- full Kubernetes clone
- broad venue support
- dynamic multi-level agent organization
- multi-agent runtimes unless a PRD acceptance criterion cannot be met by one agent session
- direct exchange access from external agent harnesses
- unbounded live mutation
- treating Claude outcomes or agent self-critique as trading evidence
- generic agent management unrelated to trader-system candidates

## Later Candidates

Later work may add:

- marketplace packaging and licensing
- multiple venues
- richer candidate portfolio management
- remote container fleets
- OpenClaw/ACP bridge support
- Multica-style runtime inventory
- more advanced multiagent configurations

## Cutline Heuristics

Include work now only if it helps prove:

```text
one trader-system candidate
-> same artifact under bindings
-> external evidence
-> bounded live runtime
-> operator control
```

Reject work now if it primarily proves:

- broad platform generality
- marketplace liquidity
- venue breadth
- harness feature completeness
- dashboard breadth
- speculative future package trading without the first runtime proof

## False-Positive Scope

These ideas sound aligned but should not enter MLP-01 as full scope:

- full package marketplace UI
- many-candidate ranking and optimization
- generalized Kubernetes-like scheduler
- agent-to-agent economy
- multi-agent mesh before one single-agent candidate proves the loop
- direct live trading tools inside Codex/Claude sessions
- auto-updating live systems without cloned version evaluation

## Architecture Invariants

Scope cannot violate:

- candidate identity is `TraderSystemCandidate`
- tools/context are packaged as `CapabilityPackage`
- secrets live in vault/binding/gateway layers, not packages
- bindings define environment-specific execution semantics
- evidence is external to runtimes
- live authority is bounded by autokairos gateway
- active live systems cannot mutate in place
- MLP starts single-agent; multi-agent admission requires explicit run purposes,
  `RuntimeCommunicationPolicy`, `TeamTrace`, and no live-authority bypass

## Scope Acceptance Test

A new request belongs in MLP-01 only if it makes the first promoted bounded trader-system runtime more
believable without expanding into platform or marketplace breadth.
