# TradingSystem Paper Event Protocol

`TradingSystem` owns its decision cadence. Paper trading observations do not ask the Gateway to
invent decisions from a refreshed market snapshot; they only consume JSONL events emitted by the
running system.

Each sandbox log line can contain one paper event. Other log lines, heartbeats, and diagnostics are
allowed, but only the events below affect `PaperTradingEvaluation`.

The machine-readable schema is
[`docs/schemas/trading-system-paper-event.schema.json`](schemas/trading-system-paper-event.schema.json).

## Paper Runtime API

When a selected `TradingSystem` needs current paper context, Ouroboros injects
`TRADING_API_BASE_URL` into the sandbox environment. That endpoint is owned by the paper Gateway
runtime and exposes the same bounded provider contract used in research:

- `GET /market/snapshot`
- `GET /account/state`
- `POST /orders/validate`

The endpoint may read Binance production public market data through the Gateway-owned
`MarketDataPort`, and it may read fake paper account state. It never exposes private Binance
account state, signed requests, live order submission, listenKey/user-data streams, leverage
mutation, or margin mutation. A `TradingSystem` may call this runtime API to decide on its own
schedule, but the API call itself is not evidence of execution. Only emitted JSONL paper events,
Gateway validation, fake paper execution, and Ledger/readback records count.

## Common Fields

All paper events require:

| Field | Value |
| --- | --- |
| `event` | `order_request`, `cancel_order`, `hold`, or `no_action` |
| `event_id` | Stable id used for dedupe across repeated sandbox log reads |
| `instance_id` | Running sandbox or TradingSystem instance id |
| `at` | ISO timestamp when the TradingSystem emitted the event |
| `authority_status` | Must be `trace_only` |

Private or live authority markers are protocol errors. A paper event must not include live runtime
authority, signed request intent, listenKey/user-data stream intent, private account read intent,
leverage mutation, margin mutation, API keys, or signatures.

## Event Shapes

`order_request` submits a bounded order intent to the paper Gateway:

```json
{
  "event": "order_request",
  "event_id": "paper-smoke-order-0001",
  "instance_id": "paper-smoke-system",
  "at": "2026-05-16T00:00:03.000Z",
  "authority_status": "trace_only",
  "intent_kind": "place_order",
  "symbol": "BTCUSDT",
  "side": "buy",
  "order_type": "limit",
  "quantity": "0.001",
  "limit_price": "60000",
  "reason": "sample bounded BTCUSDT paper order"
}
```

`cancel_order` cancels remaining fake paper quantity. `order_id` is optional; when omitted, the
paper engine cancels all open or partial orders for this paper account.

```json
{
  "event": "cancel_order",
  "event_id": "paper-smoke-cancel-0001",
  "instance_id": "paper-smoke-system",
  "at": "2026-05-16T00:01:03.000Z",
  "authority_status": "trace_only",
  "reason": "sample cancel of remaining paper quantity"
}
```

`hold` and `no_action` are explicit no-order decisions. They preserve decision cadence evidence and
do not create Ledger records.

```json
{
  "event": "hold",
  "event_id": "paper-smoke-hold-0001",
  "instance_id": "paper-smoke-system",
  "at": "2026-05-16T00:02:03.000Z",
  "authority_status": "trace_only",
  "reason": "no fresh setup after the initial paper order"
}
```

## Validation Boundary

Malformed events and private/live attempts become paper decision errors. They are marked processed
by `event_id` so repeated sandbox log reads do not replay them. They do not create Ledger chains,
do not read private Binance state, and do not mutate the fake paper account.

Valid `order_request` events still go through Gateway validation before the fake paper engine can
open, fill, reject, or cancel an order. Risk rejection records Gateway/Ledger evidence but leaves
paper account state unchanged.

The sample paper TradingSystem is
[`fixtures/trading-systems/paper_smoke.py`](../fixtures/trading-systems/paper_smoke.py). It runs
without a researcher or provider and emits stable `order_request`, optional `cancel_order`, and
`hold` events. The deterministic runtime fixture
[`fixtures/trading-systems/clock.py`](../fixtures/trading-systems/clock.py) emits a stable paper
`order_request` without injected runtime context, and becomes market-reactive when
`TRADING_API_BASE_URL` is present. That fixture proves the selected `TradingSystem` reads
Ouroboros-owned paper runtime APIs instead of calling Binance or credentials directly.
