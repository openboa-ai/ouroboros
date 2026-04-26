# Proactive Standing Operator Remediation And Unblock Contract

## Thesis

When automated rebuild cannot safely converge, autokairos should hand the governed scope into one
explicit operator-remediation path and keep the scope blocked until a cited recovery action creates
a new safe path forward.

## Why This Spec Exists

autokairos already defines:

- blocked trust posture
- rebuild requests
- detached rebuild work

Implementation still needs one narrower contract:

**what operator-visible remediation and unblock semantics must exist once automated rebuild has
stopped being safe or sufficient?**

Without this spec:

- blocked rebuild becomes a vague operational mystery
- operators may clear trust manually with no causal proof
- recovery may depend on chat memory instead of audit-visible action

## Canonical Object / Interface / Boundary

This spec defines one canonical control-plane boundary:

1. operator remediation and unblock for one governed scope

This boundary may be implemented through:

- a specialized review item
- an operations work item
- a task-flow step
- another durable control-plane work surface

The exact work object remains flexible.

## Required Fields Or Required Behaviors

## 1. Durable visibility rule

When operator remediation is required, the system must leave durable visibility of:

- the governed scope
- the blocked rebuild request or equivalent recovery handoff
- the current standing posture
- the primary reason automated recovery stopped

## 2. Minimal operator packet rule

The operator-facing packet should make these questions answerable without hunting through raw logs:

- what scope is blocked?
- what authority or history coverage is missing or invalid?
- which rebuild request or worker attempt failed or blocked?
- what follow-up actions are safe candidates?

## 3. Allowed outcome classes

The architecture should support at least these semantic outcomes:

- keep blocked and wait
- launch a new rebuild or replay
- force broader rebuild or reset posture
- suspend, retire, or narrow the active authority program
- escalate into a broader governance or review path

The exact enum or UI wording may vary.

## 4. Unblock safety rule

Manual unblock must not mean:

- "set trust back to trusted"
- "clear blocked because an operator clicked acknowledge"

Required behavior:

- a trusted posture returns only after rebuilt or reconciled coverage is restored
- operator action may authorize a new recovery path, change authority, or intentionally keep the
  scope blocked

## 5. Audit rule

Operator remediation must be audit-visible.

At minimum, later readers should be able to tell:

- who or what resolved the remediation path
- what action was taken
- what prior blocked scope or rebuild request it referenced

## 6. Flexibility rule

This spec must not require:

- one ticketing product
- one admin UI
- one approval workflow engine
- reuse of `ReviewItem` if an installation prefers a different durable work object

It fixes remediation semantics, not one work-management product.

## Lifecycle Or State Model

The operator-remediation lifecycle should be read as:

`rebuild blocks or requires intervention -> durable remediation handoff becomes visible -> operator or governance surface chooses a recovery action -> system either launches a new safe path, keeps the scope blocked, or retires the active authority`

## What This Is Not

This spec is not:

- a blanket requirement for human review on every rebuild
- permission to bypass causal recovery
- one universal ticket schema
- a replacement for candidate-stage review and promotion governance

It is the canonical remediation and unblock boundary only.

## Failure Modes / Invariants

### Invariants

- blocked scopes remain visible until an explicit recovery action exists
- operator action is durable and citeable
- trusted standing is not restored by acknowledgement alone
- remediation boundary stays compatible with multiple work-item implementations

### Failure modes

- blocked rebuild disappears into logs with no durable handoff
- operator clears trust without rebuilt or reconciled coverage
- remediation result cannot be linked back to the blocked scope
- architecture hard-codes one workflow product and loses flexibility

## Relationship To Adjacent Specs

- [49-proactive-standing-rebuild-request-contract.md](49-proactive-standing-rebuild-request-contract.md)
  defines the rebuild request that may become blocked and require remediation.
- [50-proactive-standing-rebuild-worker-contract.md](50-proactive-standing-rebuild-worker-contract.md)
  defines the automated recovery work that may hand off here.
- [43-proactive-standing-trust-downgrade-contract.md](43-proactive-standing-trust-downgrade-contract.md)
  defines blocked or degraded posture that remediation must respect.
- [14-review-item-contract.md](../../specs/14-review-item-contract.md)
  remains a reusable durable governance-work object if an implementation chooses to route blocked
  remediation through the existing review surface.
- [54-proactive-standing-operator-action-record-contract.md](54-proactive-standing-operator-action-record-contract.md)
  defines the append-only action history that makes concrete remediation durable and citeable.
