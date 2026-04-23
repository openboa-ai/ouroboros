# Proactive Standing Watermark And Reconciliation Contract

## Thesis

`CurrentProactiveStandingView` is only operationally trustworthy if it advertises:

- which authority and history horizon it reflects
- whether it is in sync, lagging, rebuilding, drifted, or otherwise degraded

## Why This Spec Exists

autokairos already distinguishes:

- append-only proactive evaluation history
- current proactive standing as a projection

That still leaves one dangerous ambiguity:

**when should operators or downstream systems trust the current standing view?**

Without this spec:

- current standing can look authoritative while silently lagging
- projection rebuild posture becomes a hidden implementation detail
- live decisions may read a projection with unknown coverage

## Canonical Object / Interface / Boundary

This spec defines the watermark and reconciliation boundary for `CurrentProactiveStandingView`.

It sits above:

- active authority objects
- `ProactiveEvaluationRecord` history
- related wake-trigger and escalation history

And below:

- operator-facing proactive status reads
- runtime-facing proactive context reads
- reconciliation and rebuild machinery

It is a projection-trust contract, not one projection implementation.

## Required Fields Or Required Behaviors

### 1. Authority coverage posture

The standing view must express which active authority it currently reflects.

Required behavior:

- preserve the effective `WakePolicy` and `StandingOrder` references
- preserve authority revision, supersession horizon, or equivalent coverage marker when meaningful

### 2. History watermark posture

The standing view must express the durable proactive-history horizon it has applied.

Examples:

- latest applied `ProactiveEvaluationRecord`
- latest applied `WakeTriggerRecord`
- history sequence, cursor, or watermark equivalent

Required behavior:

- the view must be able to say "this projection includes history through X"

### 3. Freshness posture

The standing view must expose whether it is fresh enough for the intended use.

Required behavior:

- preserve last-updated time
- preserve freshness or staleness classification when meaningful
- avoid silently implying that current standing is fresh when freshness is unknown

### 4. Reconciliation posture

The standing view must expose its reconciliation state.

The architecture should support a posture like:

- `in_sync`
- `catching_up`
- `rebuilding`
- `drift_detected`
- `degraded`
- `unknown`

The exact enum may vary, but the read surface must expose this meaning.

### 5. Trust signaling

The standing view must support operational reads such as:

- can this standing be trusted for a live wake decision right now?
- is the view complete enough for operator inspection?
- is it missing recent history or authority updates?

Trust posture may be derived from watermark plus reconciliation state, but it must remain explicit
at the read boundary.

### 6. Rebuild and recovery compatibility

Required behavior:

- losing or invalidating the standing view must remain recoverable from durable history and active
  authority objects
- if rebuild coverage is incomplete, the view must downgrade trust rather than silently pretending
  to be current

## Lifecycle Or State Model

The standing-view lifecycle should be read as:

`initialized -> updated from authority and history -> marked fresh or lagging -> reconciled or rebuilt when drift is detected`

Unlike durable history, this projection is expected to change often.

## What This Is Not

This contract is not:

- one scheduler checkpoint file
- one database trigger
- one hidden projection cursor
- a guarantee that every projection rebuild is cheap
- a claim that the current standing view is itself the source of proactive truth

It defines the minimum trust and recovery semantics only.

## Failure Modes / Invariants

### Invariants

- current proactive standing always points back to active authority and durable history
- current standing exposes freshness and reconciliation posture rather than hiding them
- losing or invalidating the projection remains recoverable from durable truth
- projection trust degrades explicitly when coverage is incomplete

### Failure modes

- operator or runtime reads cannot tell whether the standing view is stale
- a projection silently falls behind new proactive evaluation history
- authority changes happen but current standing keeps old coverage with no warning
- a damaged projection is treated as truth because no rebuild posture is visible

## Relationship To Adjacent Specs

- [37-current-proactive-standing-view-contract.md](37-current-proactive-standing-view-contract.md)
  defines the broader current-state read surface this contract tightens.
- [36-proactive-evaluation-record-contract.md](36-proactive-evaluation-record-contract.md)
  defines the append-only evaluation history beneath this projection.
- [32-current-state-projection-families-contract.md](32-current-state-projection-families-contract.md)
  defines the broader projection-family posture that this contract specializes.
- [31-history-record-families-contract.md](31-history-record-families-contract.md)
  defines the durable history families that make rebuild possible.
- [41-proactive-standing-view-store-and-rebuild-contract.md](41-proactive-standing-view-store-and-rebuild-contract.md)
  defines the first persisted standing-view shape that should carry these trust and rebuild
  semantics.
