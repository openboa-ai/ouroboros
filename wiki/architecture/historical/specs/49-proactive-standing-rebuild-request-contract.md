# Proactive Standing Rebuild Request Contract

## Thesis

Each proactive-standing rebuild handoff should create one explicit durable request for one governed
scope so later recovery work has stable causality, visibility, and ownership.

## Why This Spec Exists

autokairos already defines:

- bounded retry and explicit rebuild handoff
- current standing views with rebuild posture
- non-trivial cycle outcome history

Implementation still needs one narrower contract:

**what durable request should exist once retry stops being safe and the system decides one scope
now needs rebuild?**

Without this spec:

- rebuild may exist only as a log message or internal worker branch
- blocked scopes may have no stable recovery handle
- later workers may not know which cause, horizon, or scope they are repairing

## Canonical Object / Interface / Boundary

This spec defines one canonical recovery object:

1. `ProactiveStandingRebuildRequest`

It is the durable request envelope for recovery work on one governed scope.

It is not:

- the standing view itself
- the rebuild worker implementation
- the operator-remediation tool or ticket

## Required Fields Or Required Behaviors

## 1. Required identity and scope

The request must identify:

- one rebuild request id
- one governed scope key
- one creation timestamp
- one current request status

## 2. Required causality linkage

The request must preserve why rebuild was requested.

Required linkage should include:

- one triggering cycle outcome, evaluation record, or equivalent recovery cause
- one latest standing-view ref or standing version when meaningful
- one cause or reason code

Strongly recommended:

- authority watermark snapshot
- history watermark snapshot
- latest relevant wake or execution linkage when the scope posture depends on it

## 3. Requested recovery envelope

The request should carry recovery intent without hard-coding one rebuild engine.

Required semantics:

- requested recovery scope is explicit
- urgency or priority posture is inspectable
- optional strategy hint may exist

The exact fields may vary, but the architecture should support at least:

- full-scope rebuild
- targeted reconciliation repair
- operator-requested replay or refresh

## 4. Lifecycle posture

The architecture must support at least these semantic states:

- `requested`
- `claimed` or `running`
- `completed`
- `blocked`
- `cancelled` or `superseded`

The exact enum may vary.

## 5. Coalescing and supersession rule

Repeated rebuild needs for the same governed scope should not create ambiguous active intent.

Required behavior:

- the active rebuild intent for one governed scope remains inspectable
- later requests may coalesce or supersede earlier ones
- prior requests remain reconstructable as history

## 6. Recovery-ownership rule

The request must be durable before rebuild work is treated as canonical follow-up.

Worker-local memory or transient queue state alone is insufficient.

## 7. Flexibility rule

This contract must not require one implementation such as:

- one SQL job table
- one task queue
- one event-stream subscription
- one operator console

Those remain downstream choices.

## Lifecycle Or State Model

The rebuild-request lifecycle should be read as:

`cycle or standing posture indicates rebuild -> append rebuild request -> request may be coalesced or claimed -> rebuild completes, blocks, cancels, or is superseded`

## What This Is Not

This spec is not:

- one background task record
- one lock or lease system
- one operator ticket product
- permission to mark current standing trusted again by request alone

It is the canonical rebuild-request envelope only.

## Failure Modes / Invariants

### Invariants

- each rebuild handoff leaves durable recovery intent
- rebuild intent is traceable back to one governed scope and one cause
- active rebuild intent for a scope is unambiguous even if history contains multiple requests
- rebuild request does not itself become current standing truth

### Failure modes

- rebuild is needed but no durable request exists
- two active requests for one scope conflict with each other
- rebuild request loses the reason or horizon that caused recovery
- request exists only inside one worker queue and disappears on restart

## Relationship To Adjacent Specs

- [48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md](48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md)
  defines when rebuild should be requested instead of retried again.
- [46-proactive-standing-cycle-outcome-record-contract.md](46-proactive-standing-cycle-outcome-record-contract.md)
  defines the non-trivial cycle history that may trigger or reference this request.
- [50-proactive-standing-rebuild-worker-contract.md](50-proactive-standing-rebuild-worker-contract.md)
  defines the detached recovery work that should consume this request.
- [51-proactive-standing-operator-remediation-and-unblock-contract.md](51-proactive-standing-operator-remediation-and-unblock-contract.md)
  defines how blocked rebuild should hand off when this request cannot safely complete.
- [52-proactive-standing-rebuild-attempt-record-contract.md](52-proactive-standing-rebuild-attempt-record-contract.md)
  defines the append-only chronology for concrete tries beneath this request.
