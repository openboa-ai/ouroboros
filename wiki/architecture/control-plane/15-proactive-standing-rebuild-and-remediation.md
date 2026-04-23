# Proactive Standing Rebuild And Remediation

This page defines how rebuild should become explicit detached recovery work and how blocked rebuild
should hand off into operator remediation without hard-coding one queue, ticket, or workflow tool.

It follows:

- [14-proactive-standing-lease-retry-and-rebuild-handoff.md](14-proactive-standing-lease-retry-and-rebuild-handoff.md)
- [../specs/49-proactive-standing-rebuild-request-contract.md](../specs/49-proactive-standing-rebuild-request-contract.md)
- [../specs/50-proactive-standing-rebuild-worker-contract.md](../specs/50-proactive-standing-rebuild-worker-contract.md)
- [../specs/51-proactive-standing-operator-remediation-and-unblock-contract.md](../specs/51-proactive-standing-operator-remediation-and-unblock-contract.md)
- [../adrs/0020-proactive-standing-rebuild-and-remediation.md](../adrs/0020-proactive-standing-rebuild-and-remediation.md)

## Purpose

Keep standing recovery explicit after bounded retry stops being safe, while leaving queue topology,
worker process model, and operator tooling downstream of the architecture.

## Scope And Non-Goals

This page covers:

- explicit rebuild-request issuance
- detached rebuild work for one governed scope
- blocked rebuild handoff into operator remediation or unblock

This page does not cover:

- one background-task engine
- one rebuild algorithm
- one ticketing product or admin UI
- broad candidate-stage governance unrelated to proactive standing recovery

## Responsibilities

- ensure rebuild exists as durable recovery work rather than worker-local intuition
- ensure rebuild recomputes standing from durable truth instead of stale projection memory
- ensure blocked scopes remain inspectable until a safe unblock path exists

## System Boundaries

This layer sits:

- above claim lease, retry, and rebuild handoff
- above current standing view and proactive evaluation history
- below implementation-specific workers, queues, or operator tooling

It should not collapse into:

- implicit "just try a bigger retry" logic inside one worker
- manual standing repair with no causal lineage
- direct trust reset with no rebuild or remediation history

## Primary Abstractions

- `ProactiveStandingRebuildRequest`
- `ProactiveStandingRebuildWorker`
- operator remediation / unblock boundary
- rebuild completion
- blocked-rebuild handoff

## Primary Flow

The stable recovery flow should be read as:

`retry stops being safe -> append explicit rebuild request -> detached rebuild worker claims recovery work -> recompute standing from active authority plus durable history -> complete rebuild or declare blocked state -> hand off blocked scopes to operator remediation until a safe follow-up exists`

## Failure And Recovery Model

This layer has failed when:

- rebuild exists only as log text or in-memory worker intention
- rebuild trusts stale standing rows as its primary truth
- blocked rebuilds have no durable path to operator action
- operators can mark standing trusted again without restored causal coverage

Recovery means:

- a rebuild request captures why recovery is needed
- a rebuild worker re-derives standing from durable authority and history
- blocked or ambiguous recovery stays visible until operator action creates a new safe path

## Dependencies On Other Subsystems

- depends on proactive standing update, claim, and retry semantics
- depends on durable proactive evaluation history and current standing view
- depends on review and audit posture when operator remediation becomes necessary

## What Is Still Delegated To Specs / ADRs

- rebuild-request semantics remain in
  [../specs/49-proactive-standing-rebuild-request-contract.md](../specs/49-proactive-standing-rebuild-request-contract.md)
- rebuild-worker semantics remain in
  [../specs/50-proactive-standing-rebuild-worker-contract.md](../specs/50-proactive-standing-rebuild-worker-contract.md)
- operator-remediation and unblock semantics remain in
  [../specs/51-proactive-standing-operator-remediation-and-unblock-contract.md](../specs/51-proactive-standing-operator-remediation-and-unblock-contract.md)
- the design decision remains in
  [../adrs/0020-proactive-standing-rebuild-and-remediation.md](../adrs/0020-proactive-standing-rebuild-and-remediation.md)

## Core Rule

Rebuild should be explicit detached recovery work, and manual unblock should never stand in for
restored causal coverage.

## One Sentence Summary

autokairos should recover blocked proactive standing through explicit rebuild requests, detached
rebuild workers, and audit-visible operator remediation paths instead of hidden worker behavior or
manual trust resets.
