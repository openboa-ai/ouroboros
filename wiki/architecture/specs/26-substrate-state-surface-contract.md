# Substrate State Surface Contract

## Thesis

autokairos needs a canonical `SubstrateStateSurface` object so continuously live trading posture can
exist outside the runtime as an inspectable operational mirror rather than being rediscovered ad
hoc from raw connectors on every wake.

## Why This Spec Exists

The broader substrate contract says the system needs:

- continuously maintained market, account, position, order/fill, risk, and connector-liveness views
- explicit freshness and liveness posture
- inspectable state beneath proactive wake logic and beneath runtime execution

Without a state-surface contract, the architecture drifts toward:

- connector-specific payloads becoming the only current truth
- runtime-local caches becoming de facto operational state
- no stable object for proactive logic, runtime reads, or operator inspection to consume

Official trading-platform docs keep reinforcing the same pattern.

- account endpoints expose current buying-power and trading-block posture
- position endpoints expose current open exposure and cost-basis posture
- order/event streams expose lifecycle state, cumulative fill, and rejection posture
- market streams expose current product status, heartbeat, sequencing, and freshness clues

autokairos should normalize that common shape rather than carry venue-specific state all the way up.

## Canonical Object / Interface / Boundary

This spec defines the canonical `SubstrateStateSurface` object.

A `SubstrateStateSurface` is:

- one continuously maintained operational mirror for one stable surface family and scope
- downstream of external venues, brokers, and connectors
- upstream of `SubstrateSignal`, proactive wake evaluation, and runtime read surfaces

It is the local durable-enough current posture object for:

- `market`
- `account`
- `position`
- `order_fill`
- `risk`
- `connector_liveness`

## Required Fields Or Required Behaviors

At minimum, every `SubstrateStateSurface` must carry:

### 1. Identity and scope

- `surface_ref`
- `surface_family`
- `scope_ref`
  such as instrument, product, venue, account, connector, or other governed scope

### 2. Provenance

- `source_kind`
  such as venue REST, venue stream, broker stream, replay source, or simulation source
- `source_ref`
  connector, venue, broker, or replay identity
- last observed upstream sequence, watermark, or equivalent provenance marker when available

### 3. Time posture

- `source_timestamp`
  when the upstream source says the posture became true
- `observed_at`
  when the substrate observed or ingested it
- `updated_at`
  when the local surface last changed

### 4. Freshness and liveness posture

- freshness class
- liveness or availability posture
- degraded, disconnected, or recovering reason when applicable

### 5. Current value posture

- a normalized current-state payload
- stable field semantics for the given `surface_family`
- enough content for downstream consumers to inspect current posture without rereading raw venue data

### 6. Reconciliation posture

- whether the surface is authoritative enough for its intended local use
- whether it is partial, lagging, or awaiting reconciliation

## Lifecycle Or State Model

A `SubstrateStateSurface` should support a narrow state lifecycle:

- `initialized`
  the surface exists for one scope but may not yet be trustworthy
- `current`
  the surface is fresh enough for intended use
- `lagging`
  the surface still exists but freshness has degraded
- `degraded`
  the surface is partially impaired
- `disconnected`
  the surface is not trustworthy for current operational use
- `recovering`
  the surface is returning toward trusted current posture
- `superseded`
  the specific local posture snapshot has been replaced by a newer one

The surface object is about current posture, not immutable event history.

## What This Is Not

A `SubstrateStateSurface` is not:

- the venue's canonical ledger
- a `SubstrateSignal`
- a `WakeTriggerRecord`
- a `Trace`
- an `EvidenceRecord`
- a prompt-local runtime cache

It answers:

- what is the current operational posture for this scope?
- how fresh is it?
- where did it come from?

It does not answer:

- should the system wake?
- should the agent act?
- how should the candidate be judged?

## Failure Modes / Invariants

### Invariants

- every surface must be inspectable outside the runtime
- freshness and provenance must be explicit, not inferred from polling frequency
- the same surface family must preserve stable semantics across stages even when backing sources change
- the surface must remain distinct from signal emission and from wake-trigger history

### Failure modes

- runtime-owned cache becomes the only current market or account posture
- freshness is implied from recent logs rather than carried on the surface itself
- connector-specific fields leak upward with no normalized surface shape
- order or position posture cannot be inspected without replaying event history by hand
- stage changes require different conceptual surface families instead of different bindings underneath

## Relationship To Adjacent Specs

- [24-always-on-trading-substrate-contract.md](24-always-on-trading-substrate-contract.md)
  defines the broader substrate boundary that owns these surfaces.
- [25-substrate-signal-contract.md](25-substrate-signal-contract.md)
  defines the domain-fact signal emitted above surface updates.
- [15-persistent-operations-and-wake-policy.md](15-persistent-operations-and-wake-policy.md)
  defines the runtime wake posture that must stay downstream of current substrate state.
- [19-wake-orchestration-and-trigger-model.md](19-wake-orchestration-and-trigger-model.md)
  defines how orchestration evaluates candidate wake sources above surface and signal layers.
