# PR3 Design: One Candidate Runs As Bounded Live Trader-System Pod

## Goal

Answer:

**Can I actually let this system trade?**

PR3 proves one promoted candidate can run under live binding with bounded agent authority.

## Canonical Flow

```text
PromotionDecision
-> live StageBinding
-> TradingSystemPod
-> live_operator_agent produces OrderIntent
-> ToolProxy / risk gateway
-> GatewayDecision
-> ExecutionAttempt
-> live inspect state
```

## Ownership And Boundaries

- evaluation-and-progression owns promotion meaning
- control-plane owns live binding and execution records
- agent-system owns agent-runtime-unit and pod runtime behavior
- trading-substrate owns Binance BTC perpetual futures surfaces
- gateway owns real execution authority

The agent harness or remote agent endpoint never owns unrestricted exchange credentials.

The live runtime unit must use `runtime_unit_role=live_operator_agent`. It cannot silently reuse
PR1 builder-agent semantics.

## Minimum Objects

- `GovernedExecutionRequest`
- `TradingSystemPod`
- `AgentRuntimeUnit`
- `AgentLoopPolicy` with `continuous_live`
- `PodCommunicationPolicy`
- `OrderIntent`
- `GatewayDecision`
- `ExecutionAttempt`
- live `StageBinding`
- live risk envelope

## Operator Surface

The operator must see:

- which candidate is live
- which image/packages are active
- which runtime units are active
- what promotion allowed
- what the live binding contains
- recent order intents and gateway decisions
- accepted, rejected, and clipped gateway decisions
- current bounded live status

## Risks And Failure Modes

- live pod is not the evaluated candidate
- agent directly calls exchange APIs
- agent-to-agent communication expands authority outside the gateway
- risk gateway is vague or bypassable
- rejected or clipped gateway decisions are not durable
- live behavior is ceremonial
- operator still manually relays routine actions

## Production Readiness

PR3 is production-designed when one promoted candidate can run live continuously within explicit
limits while every live action remains gateway-bounded and auditable.

### Lifecycle And Ownership

```text
PromotionDecision
-> GovernedExecutionRequest
-> LiveBindingProfile
-> TradingSystemPod launch
-> continuous_live AgentLoopPolicy
-> OrderIntent
-> GatewayDecision
-> venue order request when accepted
-> ExecutionAttempt and fill/order state linkage
```

- evaluation-and-progression owns promotion meaning
- control-plane owns governed request, live binding, execution attempt, and gateway decision
  records
- agent-system owns live runtime loop behavior under `continuous_live`
- trading-substrate owns Binance BTC perpetual futures market, order, fill, and risk surfaces
- gateway owns accept/reject/clip authority

### Durable Truth And Schema Boundary

- `OrderIntent` is the only live action proposal the agent may emit
- `GatewayDecision` is the durable authority decision
- `ExecutionAttempt` links candidate, live binding, agent loop, order intents, gateway decisions,
  venue submission results, and fill state
- live status must be reconstructable from durable records and substrate surfaces, not provider
  memory

### Validation And Rejection

Gateway must reject or clip when:

- intent violates risk envelope
- intent references an unsupported instrument or order type
- quantity/notional exceeds limits
- required limit or trigger price is missing
- live binding lacks promotion, governed execution request, credential binding, or kill-switch
  posture
- intent provenance cannot be linked to the live pod trace

Rejected and clipped decisions are durable production outcomes.

### Idempotency And Retry

- retrying venue submission must not create duplicate exchange orders without an idempotency key or
  prior order-request reference
- repeated order intents must be separate durable proposals unless explicitly deduplicated by the
  gateway
- gateway retry does not rewrite the original intent or decision

### Recovery And Restart

- live loop heartbeat/cadence and stop conditions come from `AgentLoopPolicy`
- runtime restart must recover live attempt status from execution attempt, gateway decisions,
  substrate state, and order/fill surfaces
- venue submission failure remains linked to the accepted gateway decision
- fill reconciliation must not depend on provider narration

### Security, Credentials, And Kill Switch

- exchange credentials stay outside agent context and packages
- live binding references credential binding and risk envelope; it does not embed secrets
- kill-switch and stop posture must be enforceable outside the agent runtime
- no runtime-unit message, A2A artifact, or provider output can bypass `ToolProxy` / gateway

### Observability And Operator Inspectability

- operator must see current live pod, loop state, risk envelope summary, order intents, gateway
  decisions, venue submission/fill outcomes, and current bounded live status
- gateway rejection/clipping reasons must be operator-readable

## Test And Acceptance Criteria

- one promoted candidate launches under live binding
- one order intent is processed by gateway
- gateway decision is durable as accepted, rejected, or clipped
- execution attempt is durable
- live state is inspectable
- no direct unrestricted exchange access exists inside agent context
- no runtime-unit message or artifact can bypass the gateway

## Explicitly Deferred

- wake console
- pause/stop/override
- candidate clone promotion
- multi-venue routing
- full A2A remote-agent mesh
