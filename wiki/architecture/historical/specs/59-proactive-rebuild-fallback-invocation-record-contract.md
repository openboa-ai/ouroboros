# Proactive Rebuild Fallback Invocation Record Contract

## Thesis

When current proactive rebuild progress is rejected for a serious caller, the architecture should
durably record that deeper chronology was actually invoked rather than only implied.

## Why This Spec Exists

autokairos already defines:

- explicit `reject_and_fallback` admission outcomes
- deeper chronology sources beneath current projection

Implementation still needs one narrower contract:

**when fallback really happens, what append-only record preserves that chronology handoff and its
result?**

Without this spec:

- reject paths may exist on paper but never be operationally visible
- audit cannot tell whether chronology was merely suggested or actually used
- fallback failures and degraded fallback paths may disappear into logs

## Canonical Object / Interface / Boundary

This spec defines:

1. `ProactiveRebuildFallbackInvocationRecord`

This is an append-only operational-history object.

## Required Fields Or Required Behaviors

## 1. Required linkage

The record must preserve enough linkage to answer:

- which governed scope needed fallback?
- which admission decision caused it?
- which chronology source family was invoked?

Required semantic fields:

- `governed_scope_key`
- `causing_read_admission_record_ref`
- `fallback_source_family`

## 2. Required invocation posture

The record must preserve:

- why fallback was invoked
- what read class required it
- what invocation posture occurred

Required semantic fields:

- `requested_read_class`
- `fallback_reason_codes`
- `fallback_invocation_posture`

Supported posture families may vary, but should distinguish at least:

- `invoked`
- `completed`
- `failed`
- `partial`
- `abandoned`

## 3. Required timing and result summary

The record must preserve:

- when fallback started
- when it ended or was abandoned
- what result class it produced

Required semantic fields:

- `invoked_at`
- optional `completed_at`
- `result_summary_class`

## 4. Required source visibility

The record must preserve enough visibility to answer which chronology source was actually used.

Required behavior:

- fallback must be more specific than "read history"
- the architecture should be able to distinguish request-history fallback from attempt-history
  fallback and operator-action fallback

## 5. Required failure visibility

If fallback fails or returns only partial chronology, that should remain durable.

Required behavior:

- fallback failure must not silently collapse back into a missing current projection
- partial fallback must remain distinguishable from successful chronology retrieval

## 6. Flexibility rule

This spec does not require:

- one RPC call shape
- one query engine
- one storage backend
- one full chronology snapshot payload

It fixes the append-only fallback-invocation history only.

## Lifecycle Or State Model

The fallback-invocation lifecycle should be read as:

`admission requires chronology fallback -> fallback invocation starts -> chronology source is
 queried or walked -> result completes, partially completes, fails, or is abandoned -> append-only
 invocation history remains inspectable`

## What This Is Not

This spec is not:

- one replacement for chronology itself
- one cache of full historical results
- one UI audit card

It is the append-only fallback-invocation history contract only.

## Failure Modes / Invariants

### Invariants

- chronology fallback that actually runs is durably visible
- fallback failure and partial fallback remain distinguishable
- fallback records stay causally linked to the admission decision that required them

### Failure modes

- reject-and-fallback is logged as theory but no invocation history exists
- fallback failure disappears into generic errors
- callers cannot tell which chronology family was actually consulted

## Relationship To Adjacent Specs

- [57-proactive-rebuild-read-admission-and-fallback-contract.md](57-proactive-rebuild-read-admission-and-fallback-contract.md)
  defines the evaluator that may force this fallback path.
- [58-proactive-rebuild-read-admission-record-contract.md](58-proactive-rebuild-read-admission-record-contract.md)
  defines the admission record that should link to this invocation.
- [61-proactive-fallback-invocation-write-policy-contract.md](61-proactive-fallback-invocation-write-policy-contract.md)
  defines the stricter durability policy for actual fallback execution history.
- [52-proactive-standing-rebuild-attempt-record-contract.md](52-proactive-standing-rebuild-attempt-record-contract.md)
  defines one chronology family this record may invoke.
- [54-proactive-standing-operator-action-record-contract.md](54-proactive-standing-operator-action-record-contract.md)
  defines another chronology family this record may invoke for remediation-aware reads.
