# Proactive Standing Update Cycle Contract

## Thesis

`ProactiveStandingProjectionUpdater` should mutate `CurrentProactiveStandingView` only through one
stable single-scope update cycle:

`intake -> claim -> load -> decide -> persist -> follow-up`

## Why This Spec Exists

autokairos already defines:

- one canonical updater boundary
- one standing view shape
- explicit trust downgrade semantics

Implementation still needs one narrower contract:

**what exact sequence should one updater run for one governed scope so that standing mutation stays
deterministic and idempotent?**

Without this spec:

- different callers will implement different update sequences
- trust downgrade and rebuild request timing will drift
- the standing layer will become operationally inconsistent under retries

## Canonical Object / Interface / Boundary

This spec defines one canonical service loop for:

1. `ProactiveStandingProjectionUpdater.updateScope(...)`

The exact function name may vary.

The cycle meaning should not.

## Required Fields Or Required Behaviors

## 1. Intake step

The cycle must begin with one explicit update cause for one governed scope.

Examples:

- proactive evaluation appended
- authority changed
- downstream linkage arrived
- freshness review fired
- explicit rebuild requested

The cycle must normalize the cause before mutating standing.

## 2. Single-scope claim step

The cycle must ensure one governed scope has one canonical updater owner for the duration of one
update attempt.

The exact claim mechanism is flexible.

The invariant is:

- two concurrent updaters must not commit conflicting standing mutations for the same scope without
  ordering or retry behavior

## 3. Load step

The cycle must load:

- current standing if present
- effective authority for the scope
- relevant proactive evaluation history after the last applied watermark
- required downstream linkage when current posture depends on emitted work

## 4. Decision step

The cycle must choose exactly one primary outcome class:

- `no_change`
- `incremental_advance`
- `trust_downgrade`
- `mark_catching_up`
- `request_rebuild`
- `complete_rebuild`
- `fail_cycle`

The exact enum may vary.

The exclusivity of the primary outcome must remain clear.

## 5. Persist step

The cycle must commit one coherent standing mutation that updates:

- standing posture fields
- relevant watermarks
- reconciliation status
- trust posture
- downgrade or rebuild reason when applicable

Partial invisible mutation is not allowed.

## 6. Follow-up step

The cycle must emit explicit follow-up signals when needed.

Examples:

- enqueue catch-up
- enqueue rebuild
- emit operator-visible degraded standing
- emit execution-side context refresh signal

The transport is flexible.

The follow-up semantics are not.

## 7. Idempotency rule

Re-running the same cycle for the same cause and same history horizon should converge on the same
standing result.

## 8. Unsafe advancement rule

If the cycle cannot prove causal coverage, it must not force incremental advancement.

It should:

- downgrade trust
- request rebuild
- or remain catching up

## 9. Required observability

The cycle should leave enough information to answer:

- what cause triggered the cycle
- which outcome class was chosen
- whether the scope was advanced, downgraded, or marked for rebuild
- whether the cycle failed and why

## Lifecycle Or State Model

One update cycle should be read as:

`ready -> claimed -> loaded -> decided -> persisted -> follow-up emitted -> released`

## What This Is Not

This spec is not:

- one cron job
- one queue product
- one distributed lock algorithm
- one exact SQL transaction design

It is the canonical service-loop contract only.

## Failure Modes / Invariants

### Invariants

- one governed scope has one coherent mutation outcome per cycle
- standing mutation follows one stable order of operations
- unsafe advancement downgrades trust or requests rebuild instead of guessing
- retried cycles converge instead of diverging

### Failure modes

- one caller skips the load phase and writes trust posture directly
- concurrent updaters overwrite each other for the same scope
- rebuild is needed but the cycle still advances history watermark
- operator reads see standing changes with no explicit cycle outcome

## Relationship To Adjacent Specs

- [42-proactive-standing-projection-updater-contract.md](42-proactive-standing-projection-updater-contract.md)
  defines the broader updater boundary this cycle implements.
- [43-proactive-standing-trust-downgrade-contract.md](43-proactive-standing-trust-downgrade-contract.md)
  defines the downgrade semantics the cycle must apply.
- [41-proactive-standing-view-store-and-rebuild-contract.md](41-proactive-standing-view-store-and-rebuild-contract.md)
  defines the standing shape the cycle mutates.
- [40-proactive-evaluation-record-store-contract.md](40-proactive-evaluation-record-store-contract.md)
  defines the durable history family the cycle consumes.
