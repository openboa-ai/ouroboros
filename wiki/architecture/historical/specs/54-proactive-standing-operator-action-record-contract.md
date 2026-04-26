# Proactive Standing Operator Action Record Contract

## Thesis

Manual intervention in proactive-standing recovery should append one durable operator-action record
so unblock, retry authorization, authority narrowing, and other remediation steps remain citeable.

## Why This Spec Exists

autokairos already defines:

- operator remediation as a control-plane boundary
- blocked rebuild as a first-class posture
- rebuild requests and rebuild attempts as recovery chronology

Implementation still needs one narrower contract:

**what durable action history should remain once an operator actually does something that changes
the recovery path?**

Without this spec:

- operator remediation remains chat memory or console state
- later readers cannot reconstruct why a blocked scope resumed or stayed blocked
- audit posture weakens precisely where manual recovery matters most

## Canonical Object / Interface / Boundary

This spec defines one append-only audit object:

1. `ProactiveStandingOperatorActionRecord`

It is the durable history of a concrete manual or governance-mediated recovery action.

## Required Fields Or Required Behaviors

## 1. Required identity and linkage

The record must identify:

- one operator action id
- one governed scope key
- one timestamp
- one actor identity or actor class

Strongly recommended:

- one blocked rebuild request ref
- one rebuild attempt ref when meaningful
- one standing-view ref when meaningful

## 2. Required action semantics

The record must preserve:

- action kind
- short rationale or reason code
- resulting follow-up posture

The architecture should support at least these semantic action kinds:

- authorize retry or relaunch rebuild
- request broader replay or rebuild
- narrow, pause, or retire active authority
- keep blocked pending external dependency
- escalate into another governance surface

The exact enum may vary.

## 3. Result linkage rule

When an operator action creates a new durable follow-up, the record should link to it.

Examples:

- new rebuild request
- new review item
- changed standing order or wake policy revision

## 4. No-silent-unblock rule

If operator action changes the recovery path materially, the action must be durably recorded.

There should be no hidden unblock by:

- mutable UI state only
- ephemeral chat acknowledgement
- undocumented console command

## 5. Flexibility rule

This spec does not require:

- one workflow product
- one approval engine
- one human-only actor model

An installation may represent the actor as:

- a human operator
- a policy-constrained governance service
- another durable review surface

## Lifecycle Or State Model

The operator-action lifecycle should be read as:

`scope becomes blocked or intervention-worthy -> action is chosen and durably appended -> action may launch new follow-up work or keep the scope blocked`

## What This Is Not

This spec is not:

- the remediation work queue itself
- one approval UI log
- permission to restore trusted standing by action record alone

It is the append-only action history only.

## Failure Modes / Invariants

### Invariants

- manual recovery actions are citeable later
- operator actions link back to the blocked scope or recovery item they affect
- resulting follow-up work is traceable when created

### Failure modes

- blocked scope becomes unblocked with no action history
- action exists but cannot be linked to one request or scope
- operators disagree later because the rationale was never recorded
- the system treats acknowledgement as equivalent to causal recovery

## Relationship To Adjacent Specs

- [51-proactive-standing-operator-remediation-and-unblock-contract.md](51-proactive-standing-operator-remediation-and-unblock-contract.md)
  defines the remediation boundary this action history makes durable.
- [49-proactive-standing-rebuild-request-contract.md](49-proactive-standing-rebuild-request-contract.md)
  defines the blocked or superseded rebuild request many actions should reference.
- [52-proactive-standing-rebuild-attempt-record-contract.md](52-proactive-standing-rebuild-attempt-record-contract.md)
  defines the concrete rebuild attempt that may have triggered manual action.
- [53-proactive-standing-rebuild-progress-view-contract.md](53-proactive-standing-rebuild-progress-view-contract.md)
  defines the current recovery view that may surface the latest action posture.
