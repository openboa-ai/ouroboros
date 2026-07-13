# TradingSystem Comparison Cadence Design

**Status:** Approved under the operator's standing autonomous implementation authority

## Goal

Make a real sandboxed TradingSystem consume and acknowledge a comparison tick after activation so
the existing external paper evaluator can close a qualified two-checkpoint comparison. Preserve the
core authority boundary: the TradingSystem owns decision cadence; Gateway serves public market data
and records delivery; external Evaluation decides qualification.

This frontier proves eligible denominator closure. It does not claim candidate improvement,
adaptive-allocation benefit, market generalization, economic authority, or live authority.

## Observed Blocker

The retained six-replication prospective study closes every slot, but each source comparison uses
one checkpoint. Its first tick precedes activation, so a positive `minimum_elapsed_ms` cannot be
met even though both individual paper evaluations qualify. The study therefore has 12
`evidence_ineligible` slots and no credible comparison denominator.

The runtime already provides the necessary authority-safe protocol:

1. `GET /market/snapshot` may include an exact `comparison_tick_context`;
2. the TradingSystem may return that exact context to `POST /comparison/tick/ack`;
3. the session service binds delivery and acknowledgement to role, TradingRun, tick, request count,
   and time;
4. the external checkpoint coordinator records a new order or no-order continuity.

The fixture TradingSystem currently reads the provider once at startup and emits only heartbeats
afterward, so it never consumes a later comparison tick.

## Alternatives

### 1. TradingSystem-owned provider polling and acknowledgement

Enhance the opaque clock fixture so its own `--interval-ms` loop reads the paper provider. When a
response carries a new `comparison_tick_context.delivery_ref.id`, post the exact context to the ack
endpoint and remember the delivery ID. Repeated delivery of the same context is read but not
acknowledged again.

This is the selected design. It exercises the real process, HTTP provider, session hooks, Store
authority, and external checkpoint path without moving decision authority into Ouroboros.

### 2. Gateway or session automatic acknowledgement

The runtime could acknowledge a tick immediately after serving it. This would make tests fast, but
it would falsely claim that the TradingSystem consumed the tick and would let Gateway manufacture
decision continuity. Reject this approach.

### 3. Test-harness acknowledgement

The prospective harness could call the endpoint for each process. This would validate Store and
coordinator mechanics but not the candidate runtime. Reject it as synthetic evidence.

## Runtime Behavior

`clock.py` keeps its initial market-driven order behavior unchanged. When
`TRADING_API_BASE_URL` is present, each subsequent fixture cadence performs one market read. If no
comparison context is present, it emits the normal heartbeat and waits. If a context is present:

1. require an object context with a non-empty `delivery_ref.id`;
2. if the ID matches the last acknowledged delivery, do not post it again;
3. otherwise post the context without modification to `/comparison/tick/ack`;
4. require a structurally valid acknowledgement ref and digest;
5. remember the delivery ID, then continue the heartbeat loop.

The artifact does not call Binance, private APIs, credentials, or an order-submission endpoint. It
does not emit a second OrderRequest merely to satisfy the evaluator. The acknowledged market read,
continued process heartbeat, and absence of a new order allow the external evaluator to record
no-order continuity.

A malformed context, failed request, or malformed acknowledgement remains a process failure. There
is no automatic ack, synthetic hold, or evaluator fallback.

## Prospective Protocol

Keep the same precommitted six replications, real arm-local Stores, real deterministic subprocesses,
real loopback providers, controlled read-only BTCUSDT market data, and effect-free restart replay.
Change only the frozen comparison window needed to test the new cadence:

- `minimum_observation_count: 2`;
- `maximum_observation_count: 2`;
- `minimum_elapsed_ms: 25`;
- sandbox fixture cadence equal to the 25 ms comparison interval;
- all other paper, schedule, request-count, authority, and release policies unchanged.

Expected classification is 12 pair-qualified source verdicts. Equal candidates are
`source_not_improved`, not evidence-ineligible and not an improvement. The six-replication study may
remain six ties with p-value 1 and no allocation-policy eligibility.

## Verification

Artifact contract test:

- run the real Python fixture against a real loopback paper provider;
- serve `undefined`, context 1, repeated context 1, then context 2 across startup and three cadence
  reads;
- assert the exact context bodies are acknowledged in order;
- assert repeated context 1 is not acknowledged twice;
- retain initial order and heartbeat behavior.

Prospective integration:

- assert all 12 terminal statuses are `source_not_improved`;
- assert pair, champion, and challenger qualification reasons are empty;
- assert exact provider/sandbox start-stop symmetry;
- assert six completed ties, no policy decision, unchanged promotion state, and effect-free restart.

Run focused artifact, provider/session, comparison, and prospective tests, then workspace typechecks,
repository guards, and the full test suite.

## Next Decision

If the qualified study remains tied, retain that negative result and next isolate candidate behavior:
prove that a challenger can emit a distinct post-activation decision and produce a non-tied paper
outcome under a frozen market path. Do not start market-condition generalization until the
same-baseline study has qualified non-tied evidence.
