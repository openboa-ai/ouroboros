# Order Intent And Gateway Decision Contract

## Purpose

This page defines the minimum live-authority boundary for PR3.

It exists because a live agent may propose trading action, but autokairos must own the decision to
turn that proposal into exchange execution.

## Thesis

`OrderIntent` is an agent proposal.

`GatewayDecision` is the autokairos decision about that proposal.

`ExecutionAttempt` is the durable live attempt that links the running runtime, the trace, and any
gateway decisions.

The agent never owns unrestricted exchange authority.

## Current Active Applicability

This spec is active for PR3 and later PR4 intervention work.

## Canonical Flow

```text
live AgentSession
-> OrderIntent
-> ToolProxy / Risk Gateway
-> GatewayDecision
-> exchange order request when accepted
-> ExecutionAttempt linkage
```

## `OrderIntent`

An `OrderIntent` must carry at least:

| Field | Meaning |
| --- | --- |
| `order_intent_id` | stable durable identity |
| `candidate_ref` | candidate whose live runtime produced the intent |
| `execution_attempt_ref` | live attempt in which the intent was produced |
| `agent_session_ref` | agent session that emitted the intent |
| `instrument` | first MLP scope is Binance BTC perpetual futures |
| `side` | buy / sell or equivalent venue-normalized side |
| `order_type` | market, limit, stop, or supported normalized type |
| `quantity` / `notional` | proposed size |
| `limit_price` | required when order type needs it |
| `trigger_price` | required when order type needs it |
| `rationale` | agent-visible reason for the proposal |
| `created_at` | when the intent was emitted |
| `trace_ref` | trace event or span where the intent was produced |

An `OrderIntent` is not an exchange order.

## `GatewayDecision`

A `GatewayDecision` must carry at least:

| Field | Meaning |
| --- | --- |
| `gateway_decision_id` | stable durable identity |
| `order_intent_ref` | upstream proposal |
| `execution_attempt_ref` | live attempt context |
| `risk_envelope_ref` | limits used to judge the intent |
| `decision` | `accepted`, `rejected`, or `clipped` |
| `reason` | operator-readable reason |
| `resulting_order_request_ref` | present only when an exchange request is created |
| `created_at` | when gateway decision became durable |

Rejected and clipped decisions are as important as accepted decisions. They must remain durable and
inspectable.

## Boundary Rules

- agent context may include tool contracts, but not unrestricted exchange credentials
- every real exchange order must be downstream of one `GatewayDecision`
- gateway acceptance may still fail at venue submission; that result belongs to execution/substrate
  records, not back into the original intent
- A2A messages, provider reports, and subagent output cannot bypass the gateway
- live wake/intervention may later reference gateway decisions, but PR3 only needs durable linkage

## Failure Modes

The design is failing if:

- an agent can submit directly to Binance without the gateway
- an exchange order exists without a prior `OrderIntent` and `GatewayDecision`
- rejected or clipped decisions disappear from operator inspection
- risk limits are only prompt text
- multi-agent messages can create orders without ToolProxy/Gateway mediation

## Relationship To Adjacent Specs

This spec depends on:

- [07-runtime-connector-contract.md](07-runtime-connector-contract.md)
- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)

It is constrained by:

- [04-boundaries.md](04-boundaries.md)
