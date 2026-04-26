# Proactive Standing Scope Claim Contract

## Thesis

Each proactive standing update cycle should hold one explicit claim for one governed scope before
mutating `CurrentProactiveStandingView`.

## Why This Spec Exists

autokairos already defines:

- one canonical updater
- one stable single-scope update cycle

Implementation still needs one narrower contract:

**what minimal ownership semantics should exist so concurrent updaters cannot both commit
conflicting standing mutations for the same scope?**

Without this spec:

- claim behavior becomes an implementation accident
- concurrent retries can race and overwrite standing
- lost ownership may still lead to stale commits

## Canonical Object / Interface / Boundary

This spec defines one canonical ownership boundary:

1. `ProactiveStandingScopeClaim`

The exact storage or lease mechanism may vary.

The ownership meaning should not.

## Required Fields Or Required Behaviors

## 1. Required claim identity

A claim must identify:

- the governed scope
- the claimant or worker identity
- one claim token, generation, lease id, or equivalent unique ownership marker
- acquisition time

## 2. Required claim lifecycle

The architecture must support these semantic states:

- `acquired`
- `renewed` or equivalent ongoing ownership
- `released`
- `expired`
- `lost` or superseded

The exact enum may vary.

## 3. Single-owner invariant

At any moment, one governed scope must have at most one currently valid update owner for standing
mutation.

## 4. Lost-claim rule

If a cycle loses the claim before persist:

- it must not commit standing mutation
- it must not advance watermarks
- it may emit an aborted or retryable cycle outcome

## 5. Expiry and recovery rule

Claims must not live forever.

Required behavior:

- stale or dead claim holders become recoverable through expiry, supersession, or equivalent
- later cycles can re-acquire the scope without manual cleanup as the default path

## 6. Retry compatibility

Claim semantics must remain compatible with retried cycles.

Required behavior:

- a retried cycle revalidates ownership before persist
- a later claimant can safely recompute standing from durable state

## 7. Flexibility rule

This contract must not require one particular mechanism such as:

- SQL row lock
- advisory lock
- Redis lease
- in-memory mutex
- queue partition ownership

Those remain downstream choices.

## Lifecycle Or State Model

The claim lifecycle should be read as:

`requested -> acquired -> optionally renewed -> released or expired -> optionally reacquired by a later cycle`

## What This Is Not

This spec is not:

- one lock vendor
- one heartbeat interval
- one exact lease TTL
- one full worker scheduling system

It is the canonical ownership contract only.

## Failure Modes / Invariants

### Invariants

- one governed scope has one valid standing-mutation owner at a time
- lost claim prevents standing mutation
- stale claims do not permanently block recovery
- retries re-check ownership rather than assuming it

### Failure modes

- two workers both persist standing for the same scope
- a lost claimant still writes a newer standing row
- expired claims never clear and block rebuild forever
- retry code skips ownership validation before persist

## Relationship To Adjacent Specs

- [44-proactive-standing-update-cycle-contract.md](44-proactive-standing-update-cycle-contract.md)
  defines the cycle that must obtain and honor this claim.
- [42-proactive-standing-projection-updater-contract.md](42-proactive-standing-projection-updater-contract.md)
  defines the broader updater boundary this claim protects.
- [46-proactive-standing-cycle-outcome-record-contract.md](46-proactive-standing-cycle-outcome-record-contract.md)
  defines the outcome visibility expected when claim loss or retry occurs.
