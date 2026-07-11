# Comparison Served-Tick Attribution Design

**Date:** 2026-07-11
**Status:** Approved by standing goal authority; implementation not started
**Depends on:** One committed first paired checkpoint and its owned `both_running` activation

## Goal

Create durable causal evidence that one comparison side received and acknowledged one exact
persisted comparison tick before a later checkpoint attributes silence or candidate-emitted events
to that tick.

The first paired checkpoint remains a narrow exception: only the first tick could have been served
before it, so candidate events and silence can be consumed against that tick without an explicit
acknowledgement. Every later checkpoint must require explicit served-tick attribution. Timestamp
ordering, log order, and "latest tick at observation time" are not causal evidence.

This frontier implements the attribution substrate for the existing first-tick provider session. It
does not append tick sequence 2, advance a live comparison view, or record a repeated checkpoint.

## Approaches Considered

### Infer attribution from timestamps

Treat an event as belonging to the latest tick whose `observed_at` precedes the event timestamp.
This is small but incorrect under delayed logs, clock skew, queued decisions, retries, and candidate
state. It can label a stale decision as a response to a new tick and is rejected.

### Persist only a server-side delivery receipt

Record that the paper API provider prepared a successful `/market/snapshot` response. This proves
which bytes the server intended to send but not that candidate code received the context. It cannot
distinguish acknowledged silence from a candidate that never consumed the tick and is insufficient.

### Delivery context plus candidate acknowledgement

Persist a role-bound delivery before sending the candidate-facing market response, include an
opaque comparison-tick context in that response, and require candidate code to return it through a
dedicated acknowledgement endpoint. Candidate decision events emitted after acknowledgement echo
the acknowledgement ref and digest. This is the selected approach.

It cannot prove a candidate reasoned well about the market. It does prove the strongest observable
causal chain available at the process boundary:

```text
persisted tick
-> role-bound provider response context
-> persisted delivery
-> candidate acknowledgement request
-> persisted acknowledgement
-> candidate decision event or acknowledged silence
-> later paired checkpoint
```

## Canonical Vocabulary

### `PaperTradingComparisonTickDelivery`

Append-only evidence that one role-bound paper API provider prepared the first successful
candidate-facing `GET /market/snapshot` response for one exact tick. It is not evidence that the
candidate acknowledged or acted on the tick.

### `PaperTradingComparisonTickAcknowledgement`

Append-only evidence that the same role-bound candidate session returned the exact delivery context
through `POST /comparison/tick/ack`. It proves observable receipt, not strategy quality or an order.

### `PaperTradingComparisonTickContext`

Candidate-facing protocol object containing exact tick and delivery refs/digests. It is opaque
lineage metadata, not authority and not a hidden evaluator label.

These are project-local terms because no vendor API owns Ouroboros comparison-tick causality.
`delivery` and `acknowledgement` follow conventional messaging and HTTP terminology. Existing
`TradingProviderRequestLog` remains provider telemetry and is not upgraded into causal evidence.

## Domain Records

```ts
interface PaperTradingComparisonTickDeliveryRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_tick_delivery";
  paper_trading_comparison_tick_delivery_id: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  tick_ref: Ref;
  tick_digest: string;
  tick_sequence: number;
  provider_request_count_at_delivery: number;
  endpoint: "GET /market/snapshot";
  delivered_at: string;
  delivery_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

interface PaperTradingComparisonTickAcknowledgementRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_tick_acknowledgement";
  paper_trading_comparison_tick_acknowledgement_id: string;
  delivery_ref: Ref;
  delivery_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  tick_ref: Ref;
  tick_digest: string;
  tick_sequence: number;
  provider_request_count_at_acknowledgement: number;
  endpoint: "POST /comparison/tick/ack";
  acknowledged_at: string;
  acknowledgement_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

interface PaperTradingComparisonTickContext {
  tick_ref: Ref;
  tick_digest: string;
  tick_sequence: number;
  delivery_ref: Ref;
  delivery_digest: string;
}
```

There is one deterministic delivery identity per activation-attempt, role, and tick. Repeated market
reads return the same context and do not create an unbounded evidence stream. There is one
deterministic acknowledgement identity for that delivery. Provider request totals still count every
request, including repeated reads and acknowledgement calls.

## Write Authority

`PaperTradingComparisonTickIOWriteContext` binds activation, activation attempt, role, trading run,
and tick refs/digests with operation `deliver_market_snapshot` or `acknowledge_tick`.

LocalStore independently reloads the graph and requires:

- the latest activation attempt and its exact role-bound TradingRun;
- a current `both_running` activation outcome;
- the exact persisted comparison tick;
- provider request count within the frozen per-side cap;
- delivery before acknowledgement;
- exact replay or append-only conflict;
- no checkpoint outcome that terminally closed the comparison runtime.

The context authorizes only delivery or acknowledgement records. It cannot mutate sandbox, run
lifecycle, evaluation, observation, Ledger, score, account, candidate, tick, checkpoint, verdict,
promotion, private access, or live authority.

## Provider Protocol

The generic paper API provider gains optional comparison-tick hooks. Non-comparison sessions retain
their exact current JSON shapes and behavior.

For a comparison session:

1. Candidate calls `GET /market/snapshot`.
2. The provider obtains the exact current persisted tick and asks the role-bound hook to record or
   replay its delivery using the current total provider request count.
3. If persistence fails, the provider returns `503` and does not return tick context.
4. On success, the normal market payload includes:

```json
{
  "comparison_tick_context": {
    "tick_ref": { "record_kind": "paper_trading_comparison_tick", "id": "..." },
    "tick_digest": "sha256:...",
    "tick_sequence": 1,
    "delivery_ref": {
      "record_kind": "paper_trading_comparison_tick_delivery",
      "id": "..."
    },
    "delivery_digest": "sha256:..."
  }
}
```

5. Candidate calls `POST /comparison/tick/ack` with that exact context.
6. The provider records or replays one acknowledgement and returns its ref/digest.
7. Unknown, stale, cross-role, malformed, or over-budget contexts fail without acknowledgement.

The provider's initial candidate-input snapshot and internal order-validation market reads do not
create delivery evidence. Only the explicit candidate-facing market endpoint can create delivery.
This prevents provider startup from falsely proving candidate receipt.

## Candidate Event Protocol

Parsed paper events gain optional:

```ts
comparison_tick_acknowledgement_ref?: Ref;
comparison_tick_acknowledgement_digest?: string;
```

The parser accepts these fields only as an all-or-none pair with the exact acknowledgement record
kind and canonical digest syntax. The current first-checkpoint preparation permits them to be absent
and preserves them when present. A later-checkpoint preparation will require every newly consumed
decision event to reference an acknowledgement for that side and tick.

Acknowledged silence is valid no-order evidence: the acknowledgement exists and no new decision
event exists at checkpoint time. Silence without acknowledgement means the tick was not observably
consumed and cannot produce a later economic checkpoint. `hold` and `no_action` remain decisions and
must echo the acknowledgement just like an `OrderRequest` or cancel.

## Session Integration

`PaperTradingSessionService` installs the optional provider hooks only for an exact comparison
activation side, but leaves attribution dormant during startup. An internal
`enableComparisonTickAttribution` call may enable one role only after the activation coordinator
owns the exact `both_running` attempt. Until then, `/market/snapshot` retains its current response
without comparison context and creates no delivery. The enabled closure knows role, TradingRun,
frozen request cap, Store, and the current `ComparisonMarketDataView` tick. It creates no market read
and exposes no peer state.

The existing first paired checkpoint does not require acknowledgement and remains byte-compatible.
This frontier proves delivery and acknowledgement can be recorded for the first tick without
changing first-checkpoint economic results. The later-tick coordinator will reuse the same hook after
the view advances.

## Failure And Recovery

- Delivery Store failure returns `503`; no context is sent and no acknowledgement can be valid.
- Invalid acknowledgement returns a stable client error and creates no record.
- Provider request-cap rejection happens before delivery or acknowledgement persistence.
- Delivery without acknowledgement is non-economic evidence and cannot enable a later checkpoint.
- Acknowledgement without a decision is eligible acknowledged silence only in a later bounded
  checkpoint protocol.
- Restart does not reconstruct delivery or acknowledgement. Existing exact records remain evidence;
  unowned provider sessions are still stopped conservatively.
- Corrupt or conflicting delivery/acknowledgement records fail closed.

## Scope Boundaries

This frontier does not:

- append comparison tick sequence 2;
- mutate or advance `ComparisonMarketDataView`;
- capture a repeated paired checkpoint;
- resume provider sessions after restart;
- adjudicate, qualify, compare scores, release evidence, or promote;
- add public/runtime controller, CLI, TUI, Web, or Desktop composition;
- grant private exchange, credentials, direct order, or live authority.

## Acceptance

1. Domain predicates are total and reject wrong role/ref/digest/endpoint/count/time/authority
   combinations.
2. Delivery is persisted before a comparison market response includes context.
3. Provider startup, candidate input, account reads, and order validation create no delivery.
4. Market reads before explicit owned-side enablement create no delivery; repeated reads afterward
   return the same deterministic context while provider request totals grow.
5. Exact acknowledgement persists once; stale, cross-role, malformed, or invented contexts fail.
6. Generic non-comparison provider responses remain byte-compatible.
7. Event parsing preserves an exact acknowledgement ref/digest pair and rejects partial or malformed
   attribution.
8. First paired checkpoint behavior and all existing economic records remain unchanged.
9. Delivery and acknowledgement writers cannot mutate any economic or lifecycle state.
10. Full restart recovery never fabricates delivery, acknowledgement, event, or decision evidence.

## Next Frontier

After this substrate is proven, extend `PaperTradingComparisonTick` to contiguous sequence 2+, add
one owned view-advance intent, require one acknowledgement per role for the new tick, and generalize
the paired checkpoint transaction to sequence N. Only after repeated windows exist should Ouroboros
design external adjudication, non-overlapping confirmation, or promotion release.
