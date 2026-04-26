# PRD: One Candidate Runs As Bounded Live Trader-System Runtime

This PRD is the downstream contract for Slice 3.

Trust question:

**Can I actually let this system trade?**

## Problem

Externally evaluated candidates still do not create value until one promoted candidate runs under a
live binding with real but bounded authority.

Without this:

- the product remains research-only
- live presence is ceremonial
- the operator keeps manually relaying decisions
- agent autonomy is either fake or reckless

## Why This Matters

This is the first proof that autokairos is a live trading-system control plane.

## User Trigger

The operator approves one evidence-backed candidate for live deployment on the first market wedge.

## Desired Outcome

One promoted `TraderSystemCandidate` runs as a `TraderSystemRuntime` under live binding on Binance BTC
perpetual futures.

## In-Scope Behavior

- create a live `StageBinding` for one promoted candidate
- launch one live `TraderSystemRuntime`
- run the promoted candidate's `TraderSystemProgram` inside the bounded hands environment when the
  runtime requires executable behavior
- resolve one `AgentSpec` / `AgentSession` pair with a PR3-specific live-run
  `AgentRun.purpose`
- use `RuntimeOperatingPolicy` for live lifecycle, placement, trace, gateway, stop, and recovery
- expose live market data and account state through `ToolProxy`
- allow the agent brain or sandboxed `TraderSystemProgram` to produce `OrderIntent`
- route order intent through autokairos risk/execution gateway as a durable `GatewayDecision`
- record `ExecutionAttempt`
- keep spec/package/evidence/promotion links inspectable

## Out-Of-Scope Behavior

- direct exchange credentials inside agent context or packages
- unbounded agent order execution
- multi-venue routing
- broad portfolio orchestration
- operator intervention as the main contract
- full A2A mesh or distributed multi-runtime coordination
- live in-place self-mutation

## What Must Feel Lovable

The operator sees that:

- the same evaluated candidate is now live
- agent judgment is active
- real execution authority is bounded by gateway
- routine live action does not require per-action human approval
- the system is alive without being uncontrolled

## Critical Constraints

- live binding must preserve candidate identity
- `CapabilityPackage` cannot carry secrets
- agent authority stops at `OrderIntent`
- `TraderSystemProgram` authority also stops at `OrderIntent`
- live `AgentRun` emits `OrderIntent` only; raw provider events cannot bypass live authority
- sandboxed program output cannot bypass live authority
- gateway decision is the only path from order intent to exchange request
- agent-to-agent communication does not expand live authority
- autokairos gateway owns real execution
- live limits are explicit
- live behavior is traceable to promotion decision

## Failure Scenarios

- live runtime is not the same evaluated artifact
- agent directly calls exchange APIs
- gateway limits are unclear or unenforced
- gateway rejection or clipping is not durable
- routine trading still requires hidden operator relay
- live system patches itself without cloned re-evaluation

## Acceptance Criteria

- one promoted candidate launches under live binding
- one order intent can be accepted, rejected, or clipped by gateway
- accepted, rejected, and clipped gateway decisions are inspectable
- one execution attempt is durable and inspectable
- live state links back to candidate, trader-system spec, trader-system program, packages,
  evidence, and promotion
- no direct unrestricted exchange access is available to the agent harness

## Metrics / Proof

- live runtime produces meaningful bounded trading behavior
- operator can explain what is live and what authority it has
- routine action does not depend on hidden human runtime labor

## Open Questions

- minimum first risk envelope
- minimum order-intent schema
- minimum live telemetry to prove real bounded operation

## Subsystem Impact Map

- trading-substrate: first live venue surfaces
- agent-system: brain session and runtime behavior
- control-plane: live binding, gateway decision, execution record

## PR Slicing Guidance

Do not ship exchange connectivity as success. Ship only when the product can prove:

```text
promoted candidate -> live binding -> OrderIntent -> gateway decision -> ExecutionAttempt
```
