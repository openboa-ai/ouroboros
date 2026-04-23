# Order-Fill Surface Contract

## Thesis

autokairos needs a family-specific `order_fill` surface contract so the current posture of orders,
fills, cancel/reject outcomes, and execution blockage can remain explicit without collapsing into
raw venue event streams or runtime-local reconciliation logic.

## Why This Spec Exists

The generic `SubstrateStateSurface` contract is necessary but not sufficient for live trading.

`order_fill` is the first family that becomes operationally dangerous if it stays underspecified,
because production systems quickly fail when they cannot distinguish between:

- current order posture
- cumulative fill posture
- raw event history
- pending replace or cancel intent
- venue-specific status strings

Official platform docs keep showing the same shape in different language.

- Alpaca exposes order state plus trade updates and partial-fill posture
- Binance user-data streams expose execution events separately from current order status
- Coinbase channels separate order lifecycle and trade-match flow at the event layer
- Interactive Brokers distinguishes open order posture, order status, and execution details

autokairos therefore needs one normalized current-state surface above those raw event vocabularies.

## Canonical Object / Interface / Boundary

This spec defines the `OrderFillSurface`, a family-specific specialization of
`SubstrateStateSurface`.

An `OrderFillSurface` is:

- the current operational posture for one order scope or one bounded execution scope
- downstream of venue order events, broker order endpoints, and fill streams
- upstream of `SubstrateSignal`, wake evaluation, runtime execution decisions, and operator review

It must preserve both:

- normalized current posture
- raw upstream provenance

without becoming the full immutable execution-event ledger.

## Required Fields Or Required Behaviors

At minimum, an `OrderFillSurface` must carry:

### 1. Identity and scope

- `surface_ref`
- `surface_family = order_fill`
- `account_scope_ref`
- order or execution scope identifier
- instrument or product scope

### 2. Order identity mapping

- local client-order reference
- upstream venue or broker order reference when available
- replace-chain or parent-child linkage when orders are amended or replaced

### 3. Static order intent posture

- side
- order type
- time-in-force or durability posture
- requested quantity or notional
- limit, stop, trigger, or protection fields when applicable

### 4. Normalized lifecycle posture

The surface must expose one normalized lifecycle class independent of venue-specific wording.

At minimum it must cover:

- `received`
- `working`
- `partially_filled`
- `filled`
- `cancel_pending`
- `canceled`
- `replace_pending`
- `replaced`
- `rejected`
- `expired`
- `suspended_or_blocked`
- `unknown`

The raw upstream status or execution type may also be retained, but it must not replace the
normalized lifecycle posture.

### 5. Fill posture

- cumulative filled quantity
- remaining quantity when meaningful
- average fill price when meaningful
- last fill price and timestamp when available
- partial-fill posture explicit enough to distinguish current exposure from still-working intent

### 6. Failure and interruption posture

- reject reason when rejected
- cancel reason when canceled
- block or impairment reason when execution is suspended or degraded
- connector or venue impairment linkage when current execution posture depends on upstream failure

### 7. Time and provenance posture

- source timestamp
- observed-at timestamp
- updated-at timestamp
- upstream sequence, version, or watermark when available
- freshness and liveness posture inherited from the broader substrate rules

## Lifecycle Or State Model

An `OrderFillSurface` should support this normalized lifecycle:

- `initialized`
  local scope exists but no trusted venue posture is confirmed yet
- `received`
  the order intent is known and accepted into the local operational mirror
- `working`
  the order is live and may still receive fills
- `partially_filled`
  some execution happened but remaining intent still exists
- `filled`
  no remaining executable intent exists
- `cancel_pending`
  cancellation has been requested but final posture is not yet resolved
- `canceled`
  the order is no longer executable and was not fully filled
- `replace_pending`
  a replace or amend action is underway
- `replaced`
  this order scope has been superseded by a successor order
- `rejected`
  the order never became executable or lost executable legitimacy before work started
- `expired`
  the order stopped being executable due to time or venue policy
- `suspended_or_blocked`
  the order is not safely executable due to operational or risk posture

The important point is that the surface represents current posture, not the full event log.

## What This Is Not

An `OrderFillSurface` is not:

- the immutable execution-event ledger
- the venue's canonical order history
- a `Trace`
- a `SubstrateSignal`
- an `ExecutionAttempt`
- a promotion or evaluation artifact

It answers:

- what is the current executable posture of this order scope?
- how much has filled?
- what remains?
- what is blocked, rejected, canceled, or degraded right now?

It does not answer:

- every raw event that ever happened
- whether the system should wake
- whether the runtime should submit a new order

## Failure Modes / Invariants

### Invariants

- current order posture must stay distinct from immutable order-event history
- normalized lifecycle posture must stay explicit even when raw upstream statuses differ
- cumulative fill and remaining intent must be inspectable without replaying the full event stream
- replace and cancel posture must not be collapsed into generic `working` or `done`
- provenance back to raw upstream status must remain available

### Failure modes

- partial fill is visible only by replaying raw events
- rejected or canceled posture is lost once a new order attempt starts
- runtime keeps a more accurate current order picture than the substrate
- venue-specific statuses leak upward with no normalized lifecycle mapping
- filled and canceled orders are treated as the same terminal concept

## Relationship To Adjacent Specs

- [26-substrate-state-surface-contract.md](26-substrate-state-surface-contract.md)
  defines the generic contract this family specializes.
- [25-substrate-signal-contract.md](25-substrate-signal-contract.md)
  defines the signal object emitted above order/fill surface changes.
- [24-always-on-trading-substrate-contract.md](24-always-on-trading-substrate-contract.md)
  defines the broader substrate boundary that owns the `order_fill` family.
- [23-wake-trigger-record-contract.md](23-wake-trigger-record-contract.md)
  defines wake history that may later reference signals emitted from order/fill changes.
- [09-trace-contract.md](09-trace-contract.md)
  defines runtime execution history, which must remain separate from the always-on order/fill
  surface.
