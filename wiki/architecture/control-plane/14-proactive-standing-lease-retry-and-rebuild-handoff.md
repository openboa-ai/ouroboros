# Proactive Standing Lease, Retry, And Rebuild Handoff

This page defines how standing-claim ownership should age, how retries should back off, and when a
failed cycle should hand control to rebuild instead of retrying forever.

It follows:

- [12-proactive-standing-update-cycle.md](12-proactive-standing-update-cycle.md)
- [13-proactive-standing-claim-retry-and-cycle-outcomes.md](13-proactive-standing-claim-retry-and-cycle-outcomes.md)
- [../specs/47-proactive-standing-claim-lease-and-expiry-contract.md](../specs/47-proactive-standing-claim-lease-and-expiry-contract.md)
- [../specs/48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md](../specs/48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md)
- [../adrs/0019-proactive-standing-lease-retry-and-rebuild-handoff.md](../adrs/0019-proactive-standing-lease-retry-and-rebuild-handoff.md)

## Purpose

Keep standing maintenance recoverable under worker death, claim loss, repeated failures, and
partial restoration without hard-coding one lease backend or retry library.

## Scope And Non-Goals

This page covers:

- claim lease renewal and expiry semantics
- retry backoff posture
- escalation from retry to rebuild handoff

This page does not cover:

- one exact lease duration
- one timer wheel
- one queue service
- one rebuild implementation topology

## Responsibilities

- prevent dead claims from blocking later updates forever
- prevent hot-loop retry after repeat cycle failure
- escalate to rebuild when retry no longer improves confidence

## System Boundaries

This layer sits:

- above single-scope claim ownership
- above cycle outcome history
- below rebuild execution and operator remediation

It should not collapse into:

- one magic timeout hidden in worker code
- infinite retry with no escalation rule
- manual rebuild as the default recovery path

## Primary Abstractions

- claim lease
- lease renewal
- lease expiry
- retry budget or retry posture
- retry backoff
- rebuild handoff

## Primary Flow

The stable recovery flow should be read as:

`claim acquired -> cycle runs -> claim renewed while progress is plausible -> cycle succeeds or fails -> retry with bounded backoff when safe -> hand off to rebuild when retries stop improving confidence`

## Failure And Recovery Model

This layer has failed when:

- dead claim holders block the governed scope indefinitely
- retry storms occur after claim loss or downstream lag
- rebuild is obviously needed but the system keeps trying incremental retry

Recovery means:

- lease expiry makes the scope reclaimable
- retries re-enter with bounded backoff and fresh reads
- rebuild handoff becomes the default next step after repeated unsafe retry

## Dependencies On Other Subsystems

- depends on scope-claim semantics and cycle outcome history
- depends on update-cycle rules and trust downgrade semantics
- feeds rebuild coordination and operator diagnostics

## What Is Still Delegated To Specs / ADRs

- claim lease rules remain in
  [../specs/47-proactive-standing-claim-lease-and-expiry-contract.md](../specs/47-proactive-standing-claim-lease-and-expiry-contract.md)
- retry and rebuild handoff rules remain in
  [../specs/48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md](../specs/48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md)
- the design decision remains in
  [../adrs/0019-proactive-standing-lease-retry-and-rebuild-handoff.md](../adrs/0019-proactive-standing-lease-retry-and-rebuild-handoff.md)

## Core Rule

Claims should be temporary, retries should be bounded, and rebuild should be a normal handoff path
rather than a last-resort mystery operation.

## One Sentence Summary

autokairos should treat standing claims as expiring leases, retries as bounded recovery attempts,
and rebuild as the explicit next owner when retry can no longer safely converge.
