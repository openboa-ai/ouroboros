# Proactive Standing Claim Lease And Expiry Contract

## Thesis

`ProactiveStandingScopeClaim` should behave like an expiring lease, not a permanent lock.

## Why This Spec Exists

autokairos already defines:

- one scope claim per governed scope
- claim loss semantics

Implementation still needs one narrower contract:

**how should claim ownership remain alive while useful work is happening, and how should it become
reclaimable when the owner dies, stalls, or disappears?**

Without this spec:

- dead workers can block scopes indefinitely
- claim recovery depends on manual cleanup
- claim renewal and expiry become vendor-specific accidents

## Canonical Object / Interface / Boundary

This spec tightens:

1. `ProactiveStandingScopeClaim`

with explicit lease and expiry semantics.

## Required Fields Or Required Behaviors

## 1. Lease posture

A claim must support:

- acquisition time
- expiry or deadline marker
- optional renewal time or heartbeat marker

The exact field names may vary.

## 2. Renewal rule

Claim renewal should happen only while:

- the updater still owns the scope
- the cycle is plausibly making progress

Blind periodic renewal with no progress semantics is discouraged.

## 3. Expiry rule

When the lease expires:

- the claim must no longer authorize standing mutation
- a later updater may acquire a new valid claim

## 4. Lost ownership before persist

If expiry or supersession happens before standing persist:

- the current cycle must abort standing mutation
- it may record a lost-claim outcome
- it may schedule retry or rebuild follow-up

## 5. Stale-claim recovery rule

The architecture must not require manual deletion of stale claims as the normal recovery path.

Expiry, supersession, or equivalent reclaim semantics must exist.

## 6. Flexibility rule

This spec does not require:

- one lease TTL
- one heartbeat cadence
- one compare-and-swap primitive
- one external coordinator

Those remain downstream choices.

## Lifecycle Or State Model

The lease lifecycle should be read as:

`acquired -> optionally renewed while progress continues -> released on success or handoff -> expired or superseded if owner disappears or loses authority`

## What This Is Not

This spec is not:

- one distributed lock algorithm
- one worker heartbeat implementation
- one cluster leader-election system

It is the minimum lease semantics only.

## Failure Modes / Invariants

### Invariants

- valid ownership is time-bounded
- expired ownership cannot still authorize standing mutation
- claim recovery is possible without manual repair as the default path

### Failure modes

- stale claims never expire
- workers renew claims forever while not making progress
- a later claimant cannot safely recover the scope
- expired owner still writes standing

## Relationship To Adjacent Specs

- [45-proactive-standing-scope-claim-contract.md](45-proactive-standing-scope-claim-contract.md)
  defines the broader ownership invariant this lease tightens.
- [44-proactive-standing-update-cycle-contract.md](44-proactive-standing-update-cycle-contract.md)
  defines the cycle that must revalidate ownership before persist.
- [48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md](48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md)
  defines how repeated failed ownership or retry should hand off into rebuild.
