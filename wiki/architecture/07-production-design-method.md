# Production Design Method

This page defines what "production-level design" means for the current MLP-01 architecture.

It is a design-quality bar, not a request to build enterprise-scale infrastructure.

Production-level here means:

```text
an implementer can build Bootstrap, PR1, PR2, PR3, and PR4 without inventing lifecycle,
durability, validation, recovery, security, observability, or operator-inspection rules.
```

## Purpose

Use this page before deepening any Bootstrap or PR slice design.

It exists to prevent two failures:

- under-design: implementation starts with vague "agent autonomy", "provider adapter", or
  "live gateway" labels
- over-design: old speculative production-agent, workflow-engine, proactive-standing, or fleet
  orchestration docs become active again without a current PRD need

## Production Design Thesis

Production design for MLP-01 must be **boundary-complete**.

It must explain:

- which object owns durable truth
- which runtime may act but not own truth
- what gets validated before a record is created
- what happens when validation fails
- how retries, cancellation, restart, and recovery preserve chronology
- where credentials and side effects are blocked
- what the operator can inspect without private implementation knowledge

It must not require a central finite-state machine or workflow engine. `AgentLoopPolicy` bounds
autonomous loops; the agent owns reasoning inside the loop.

## Required Production Questions

Every Bootstrap or PR slice design must answer these questions before implementation starts.

| Concern | Required answer |
| --- | --- |
| Lifecycle and ownership | What starts, continues, stops, retries, resumes, or cancels the work, and who owns each step? |
| Durable truth | Which records are authoritative after process restart? |
| Schema boundary | What minimum shape must be accepted, rejected, or deferred? |
| Validation and rejection | What fails closed, and what failure record or trace remains? |
| Idempotency and retry | What can be safely retried without duplicate truth? |
| Recovery and restart | What can be reconstructed after runtime or provider failure? |
| Security and permissions | Where are credentials, tool access, package permissions, and side effects enforced? |
| Observability and audit | Which trace, event, decision, or operator action explains what happened later? |
| Operator inspectability | What can the operator understand from product surfaces? |
| Explicit deferral | Which production concerns are intentionally not part of this slice? |

## Slice Readiness Bar

| Slice | Production bar |
| --- | --- |
| Bootstrap | file-backed durable substrate survives restart and preserves future boundaries without implying evidence, live, or wake meaning |
| PR1 | provider output can become a candidate only through probe, schema validation, semantic validation, trace retention, and materialization acceptance |
| PR2 | trace becomes counted or non-counted evidence only through external evaluator ownership and explicit legitimacy mode |
| PR3 | live agent authority stops at `OrderIntent`; gateway creates durable accepted/rejected/clipped decisions linked to execution attempts |
| PR4 | wake, inspect, pause, stop, override, audit, and candidate versioning preserve control without turning the operator back into hidden runtime |

## Interface Rules

### `AgentLoopPolicy`

Production design must name:

- trigger source
- loop mode
- cadence or heartbeat posture
- timeout
- cancellation
- retry and resume posture
- trace export requirement
- tool access posture
- stop conditions

The policy bounds the loop. It does not direct each reasoning step.

### `RuntimeProviderAdapter`

A provider label is not executable until the design names:

- probe behavior
- binary/package/API availability
- auth state
- model access
- invocation surface
- schema output or event stream contract
- trace/export path
- failure modes

Current PR1 default remains `codex_cli + gpt-5.4 + schema output` until feasibility evidence
changes.

### `TraderSystemCandidate`

A candidate can be created only after:

- provider run output exists
- schema validation passes
- semantic/materialization validation passes
- provenance and trace refs are retained
- duplicate or retry behavior is resolved

Failed provider output may remain trace or artifact context. It must not create a false candidate.

### `StageBindingProfile`

Backtest, paper, and live bindings must stay typed.

- backtest: historical or replay data, deterministic clock, simulator, evaluator, no live
  credentials
- paper: live-like data, simulated order gateway, paper risk envelope, no real exchange execution
- live: live data, real gateway, risk envelope, credential binding, wake policy, and upstream
  promotion plus governed execution request

### `OrderIntent / GatewayDecision / ExecutionAttempt`

Production live authority requires:

```text
live_operator_agent -> OrderIntent -> GatewayDecision -> ExecutionAttempt
```

The agent proposes. The gateway decides. The execution attempt links decisions and venue outcomes.

Rejected and clipped gateway decisions are durable production outcomes, not discarded errors.

### `CapabilityPackageManifest`

Package manifests declare:

- provenance
- tools
- data access
- allowed stages
- required permissions
- forbidden contents

They do not grant access. Runtime access is granted only through `StageBinding` and `ToolProxy`.

## When To Add A New Spec

Do not create a new spec because a future concern might matter.

Create or promote a spec only when:

- a current PRD cannot be implemented safely from the slice design note
- a cross-slice invariant would otherwise drift
- a boundary has safety, credential, live-authority, evidence, or audit consequences

Otherwise, add a compact `Production Readiness` section to the slice design note.

## Historical Spec Rule

Older production-agent state-machine, persistent-operations, proactive-standing, rebuild,
read-admission, coalescing, and fleet-orchestration docs remain historical background.

They are not active production design unless a current MLP-01 PRD explicitly promotes them.

Current active posture:

- agent-driven runtime
- `AgentLoopPolicy` boundary
- no central step-by-step workflow engine
- single-agent MLP start
- multi-agent only by admission rule

## Acceptance Test

A slice is production-designed only if a reader can explain:

- what starts and stops the work
- what durable records exist after restart
- what validation gates record creation
- what retry does and does not duplicate
- what failure remains inspectable
- where secrets and side effects are blocked
- which trace, evidence, decision, or audit record explains the outcome
- what the operator can see
- what is intentionally deferred
