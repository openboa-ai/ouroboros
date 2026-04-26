# PR3 Design: One Candidate Runs As Bounded Live Trader-System Runtime

## Goal

Answer:

**Can I actually let this system trade?**

PR3 proves one promoted candidate can run under live binding with bounded agent authority.

## Canonical Flow

```text
PromotionDecision
-> live StageBinding
-> TraderSystemRuntime
-> RuntimePlacement
-> live AgentSession
-> runtime-internal agent/program autonomy
-> AgentRun / TraderSystemProgram execution emits traceable events
-> agent or program emits OrderIntent only for live side effects
-> ToolProxy / risk gateway
-> GatewayDecision
-> ExecutionAttempt
-> live inspect state
```

## Ownership And Boundaries

- evaluation-and-progression owns promotion meaning
- control-plane owns live binding and execution records
- agent-system owns agent-session and runtime behavior
- trading-substrate owns Binance BTC perpetual futures surfaces
- gateway owns real execution authority

The agent harness or remote agent endpoint never owns unrestricted exchange credentials.

The live agent run must introduce a PR3-specific `AgentRun.purpose`. It cannot silently reuse PR1
`candidate_generation` semantics.

## Minimum Objects

- `GovernedExecutionRequest`
- `TraderSystemRuntime`
- `AgentSpec`
- `AgentSession`
- `AgentRun`
- `AgentEvent`
- `RuntimePlacement`
- `RuntimeOperatingPolicy` for live lifecycle, placement, trace, gateway, stop, and recovery
- `TraderSystemProgram`
- `RuntimeCommunicationPolicy`
- `OrderIntent`
- `GatewayDecision`
- `ExecutionAttempt`
- live `StageBinding`
- live risk envelope

## Operator Surface

The operator must see:

- which candidate is live
- which spec/packages are active
- where the logical runtime is physically running
- which agent sessions are active
- which live agent runs are producing order intents
- what promotion allowed
- what the live binding contains
- recent order intents and gateway decisions
- accepted, rejected, and clipped gateway decisions
- current bounded live status

## Risks And Failure Modes

- live runtime is not the evaluated candidate
- agent directly calls exchange APIs
- agent-to-agent communication expands authority outside the gateway
- risk gateway is vague or bypassable
- rejected or clipped gateway decisions are not durable
- live behavior is ceremonial
- operator still manually relays routine actions

## Production Readiness

PR3 is production-designed when one promoted candidate can run as an autonomous live runtime within
explicit limits while every live side effect remains gateway-bounded and auditable.

### Lifecycle And Ownership

```text
PromotionDecision
-> GovernedExecutionRequest
-> LiveBindingProfile
-> TraderSystemRuntime launch
-> RuntimePlacement
-> RuntimeOperatingPolicy
-> runtime-internal AgentRun and TraderSystemProgram execution
-> AgentEvent / ProgramEvent / Trace export
-> OrderIntent
-> GatewayDecision
-> venue order request when accepted
-> ExecutionAttempt and fill/order state linkage
```

- evaluation-and-progression owns promotion meaning
- control-plane owns governed request, live binding, execution attempt, and gateway decision
  records
- agent-system owns runtime-internal live behavior under the deployed trader-system program
- runtime connector owns runtime placement, trace export, interruption, checkpoint, and
  recovery mechanics
- trading-substrate owns Binance BTC perpetual futures market, order, fill, and risk surfaces
- gateway owns accept/reject/clip authority

### Durable Truth And Schema Boundary

- `OrderIntent` is the only live action proposal the agent or `TraderSystemProgram` may emit
- `AgentEvent` is raw runtime/provider output and cannot bypass the gateway
- `ProgramEvent` or sandbox output is raw runtime output and cannot become authority by itself
- sandboxed program output is trace/artifact data unless it conforms to an allowed output contract
- `GatewayDecision` is the durable authority decision
- `ExecutionAttempt` links candidate, live binding, runtime operating policy, order intents, gateway decisions,
  venue submission results, and fill state
- live status must be reconstructable from durable records and substrate surfaces, not provider
  memory
- live physical placement must be reconstructable from `RuntimePlacement`, not guessed from a
  running process

### Validation And Rejection

Gateway must reject or clip when:

- intent violates risk envelope
- intent references an unsupported instrument or order type
- quantity/notional exceeds limits
- required limit or trigger price is missing
- live binding lacks promotion, governed execution request, credential binding, or kill-switch
  posture
- intent provenance cannot be linked to the live runtime trace

Rejected and clipped decisions are durable production outcomes.

### Idempotency And Retry

- retrying venue submission must not create duplicate exchange orders without an idempotency key or
  prior order-request reference
- repeated order intents must be separate durable proposals unless explicitly deduplicated by the
  gateway
- gateway retry does not rewrite the original intent or decision

### Recovery And Restart

- live runtime lifecycle, timeout, cancellation, resume, recovery, and stop conditions come from
  `RuntimeOperatingPolicy`
- runtime restart must recover live attempt status from execution attempt, gateway decisions,
  substrate state, order/fill surfaces, trace, and `RuntimePlacement`
- venue submission failure remains linked to the accepted gateway decision
- fill reconciliation must not depend on provider narration
- if provider-native resume is unavailable, a new runtime placement may resume from trace
  or stop for operator review

### Security, Credentials, And Kill Switch

- exchange credentials stay outside agent context and packages
- live binding references credential binding and risk envelope; it does not embed secrets
- kill-switch and stop posture must be enforceable outside the agent runtime
- no agent-session message, A2A artifact, or provider output can bypass `ToolProxy` / gateway

### Observability And Operator Inspectability

- operator must see current live runtime, loop state, risk envelope summary, order intents, gateway
  decisions, venue submission/fill outcomes, runtime placement status, and current bounded
  live status
- gateway rejection/clipping reasons must be operator-readable

## Test And Acceptance Criteria

- one promoted candidate launches under live binding
- one order intent is processed by gateway
- gateway decision is durable as accepted, rejected, or clipped
- execution attempt is durable
- live state is inspectable
- no direct unrestricted exchange access exists inside agent context
- no agent-session message or artifact can bypass the gateway

## Explicitly Deferred

- operator alert console
- pause/stop/override
- candidate clone promotion
- multi-venue routing
- full A2A remote-agent mesh
