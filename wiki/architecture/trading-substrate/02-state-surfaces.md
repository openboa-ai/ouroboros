# Trading Substrate State Surfaces

This page defines the continuously maintained state surfaces the trading substrate should own.

It follows:

- [01-overview.md](01-overview.md)
- [../specs/24-always-on-trading-substrate-contract.md](../specs/24-always-on-trading-substrate-contract.md)
- [../specs/25-substrate-signal-contract.md](../specs/25-substrate-signal-contract.md)
- [../specs/26-substrate-state-surface-contract.md](../specs/26-substrate-state-surface-contract.md)
- [../historical/specs/15-persistent-operations-and-wake-policy.md](../historical/specs/15-persistent-operations-and-wake-policy.md)

It is also informed by additional official trading-platform documentation:

- [Alpaca: Working with /account](https://docs.alpaca.markets/docs/working-with-account)
- [Alpaca: Working with /positions](https://docs.alpaca.markets/docs/working-with-positions)
- [Alpaca: Orders at Alpaca](https://docs.alpaca.markets/docs/orders-at-alpaca)
- [Binance Spot: User Data Stream](https://developers.binance.com/docs/binance-spot-api-docs/user-data-stream)
- [Binance Spot: Spot Glossary](https://developers.binance.com/docs/binance-spot-api-docs/faqs/spot_glossary)
- [Coinbase Exchange: WebSocket Channels](https://docs.cdp.coinbase.com/exchange/websocket-feed/channels)
- [Interactive Brokers: Placing Orders](https://interactivebrokers.github.io/tws-api/order_submission.html)

## Purpose

Define the stable operational surfaces the rest of autokairos should depend on instead of reading
venue- or connector-specific state ad hoc.

## Scope And Non-Goals

This page covers:

- the canonical surface families
- what each surface should answer
- how those surfaces differ from external venue truth

This page does not cover:

- exact database tables
- full adapter APIs
- candidate or evidence objects

## Responsibilities

Each substrate state surface should:

- expose the current operational view
- expose stable scope and provenance
- carry explicit freshness and source-time posture
- remain inspectable even when the runtime is currently `cold`
- remain consumable by proactive operations and stage-facing runtime bindings

## System Boundaries

These surfaces are local operational truth for autokairos.

They are not:

- the venue's canonical ledger
- the control-plane governance record
- a prompt-local summary inside the runtime

They should instead behave as continuously refreshed operational mirrors with:

- scope
- timestamps
- freshness and liveness posture
- inspectable current value posture

## Surface Families

### 1. Market state surface

This surface answers:

- what market facts are currently visible?
- how fresh are they?
- what instrument or venue scope do they cover?

Typical content:

- last trade / mid / mark / index price
- bounded book or liquidity summary
- volatility or regime summary
- source timestamps and ingest timestamps

### 2. Account and balance surface

This surface answers:

- what account resources are available?
- what balances, margin, and exposure budget exist?
- when were those numbers last refreshed?

### 3. Position surface

This surface answers:

- what positions currently exist?
- what size, direction, and cost basis are in force?
- what unrealized and realized posture matters right now?

### 4. Order and fill surface

This surface answers:

- what orders are pending, working, filled, canceled, or rejected?
- what fills or execution deltas have recently happened?
- which execution path is blocked or degraded?

### 5. Risk surface

This surface answers:

- what risk limits currently matter?
- what soft or hard breaches exist?
- what escalation posture is active?

This surface should combine:

- current quantitative exposure posture
- policy-derived limits
- operational risk state such as kill-switch or pause posture

### 6. Connector-liveness surface

This surface answers:

- are the upstream connectors healthy?
- are market, account, and order channels all current?
- what is degraded, reconnecting, stale, or disconnected?

## State Surface Table

| Surface | Primary question | Typical consumers | Must carry |
| --- | --- | --- | --- |
| `market` | what is happening in the market now? | proactive ops, runtime, risk | source time, ingest time, freshness |
| `account` | what capital and margin posture exist now? | runtime, risk, review surfaces | source time, freshness, scope |
| `position` | what exposure exists now? | runtime, risk, review surfaces | position lineage, freshness |
| `order_fill` | what execution activity exists now? | proactive ops, runtime, observe/evidence | lifecycle state, freshness, linkage |
| `risk` | what constraints or breaches matter now? | proactive ops, runtime, governance views | breach posture, severity, freshness |
| `connector_liveness` | can the system trust upstream ingress now? | proactive ops, runtime, operators | health, lag, degraded reason |

## External Truth Versus Operational Truth

The important distinction is:

- external venues and brokers remain the canonical external source
- the trading substrate is autokairos's continuously refreshed operational mirror

That mirror must be:

- explicit
- stage-aware
- freshness-aware
- inspectable outside the runtime

## Surface Design Discipline

Across official venue and broker docs, the same pattern keeps appearing.

- account surfaces expose current trading ability and buying-power posture
- position surfaces expose current open exposure and cost-basis posture
- order surfaces expose lifecycle state, fill accumulation, and rejection posture
- market-data channels expose current product status, heartbeat, sequencing, and freshness clues

autokairos should normalize those patterns into one local object shape per surface family instead of
letting each connector invent a new state language.

That means every substrate state surface should be able to answer:

- what scope does this surface cover?
- what is the latest operational posture for that scope?
- when did the source say this became true?
- when did autokairos observe it?
- how fresh and trustworthy is it now?
- what upstream source or connector produced it?

## What Is Still Delegated To Specs / ADRs

- the narrow boundary contract remains in
  [../specs/24-always-on-trading-substrate-contract.md](../specs/24-always-on-trading-substrate-contract.md)
- the canonical surface object remains in
  [../specs/26-substrate-state-surface-contract.md](../specs/26-substrate-state-surface-contract.md)
- the first family-specific deep dive remains in
  [../specs/27-order-fill-surface-contract.md](../specs/27-order-fill-surface-contract.md)
- exact wake authority and trigger recording remain in the proactive and control-plane specs

## Core Claim

If the runtime has to rediscover market, account, order, and risk state ad hoc on every wake,
autokairos does not have an always-on trading substrate.

It only has a smarter polling loop.
