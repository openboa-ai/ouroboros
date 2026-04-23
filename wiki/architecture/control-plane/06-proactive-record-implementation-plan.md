# Proactive Record Implementation Plan

This page turns proactive control-plane truth into an implementation sequence.

It follows:

- [05-proactive-policy-and-wake-records.md](05-proactive-policy-and-wake-records.md)
- [../proactive-operations/01-overview.md](../proactive-operations/01-overview.md)
- [../proactive-operations/03-governed-self-scheduling.md](../proactive-operations/03-governed-self-scheduling.md)
- [../agent-system/05-implementation-plan.md](../agent-system/05-implementation-plan.md)
- [../specs/20-governed-self-scheduling-contract.md](../specs/20-governed-self-scheduling-contract.md)
- [../specs/21-wake-policy-contract.md](../specs/21-wake-policy-contract.md)
- [../specs/22-standing-order-contract.md](../specs/22-standing-order-contract.md)
- [../specs/23-wake-trigger-record-contract.md](../specs/23-wake-trigger-record-contract.md)
- [../../sources/library/repo-openclaw.md](../../sources/library/repo-openclaw.md)
- [../../sources/library/repo-anthropics-claude-code.md](../../sources/library/repo-anthropics-claude-code.md)
- [../../sources/library/repo-openai-codex.md](../../sources/library/repo-openai-codex.md)

## Goal

Define the first implementation order for proactive control-plane truth, so living work can exist
before the runtime becomes the center of the system.

## Why This Must Exist Before Runtime-Heavy Work

The research base now points in one direction.

- Claude Code preserves routine/task configuration and run history outside one active session.
- OpenClaw makes the task ledger inspectable and explicitly says tasks are records, not schedulers.
- Codex treats automations and review re-entry as product surfaces above runtime execution.

Taken together, that means autokairos should not reach a "living system" by embedding more timers
inside the runtime.

It should reach it by building durable proactive records first.

## Required First-Cut Record Family

The first real proactive record family should include:

- `WakePolicy`
- `StandingOrder`
- `WakeTriggerRecord`
- `SelfSchedulingIntent` persistence with disposition
- `ProactiveEvaluationRecordHeader`
- `CurrentProactiveStandingView`

## Build Order

### 1. WakePolicy store

The first step is a durable store for currently active future-work authority.

The implementation should support:

- create
- supersede
- pause
- expire
- revoke
- fetch current policy for a governed scope

### 2. StandingOrder store

The next step is durable authority above wake policy.

The implementation should support:

- create and revise authority programs
- mark mandatory trigger classes
- define cadence bounds
- define what may auto-apply versus what must escalate

### 3. WakeTriggerRecord store

The system must then preserve actual wake history.

The implementation should support recording:

- detected trigger
- evaluated trigger
- emitted trigger
- suppressed trigger
- resulting `ExecutionRequest` link when one exists

This is the durable answer to:

> why did the system wake, or why did it choose not to wake?

### 4. SelfSchedulingIntent persistence

The runtime-facing proposal object should become durable control-plane history.

The implementation should support:

- proposed
- evaluated
- auto-applied
- pending review
- rejected
- linked resulting `WakePolicy` change when accepted

### 5. ExecutionRequest emission from wake truth

Only after the previous records exist should a wake emission create a durable
`ExecutionRequest`.

That is the first point where proactive operations hand work to the execution subsystem.

The emitted request must preserve:

- one originating `ProactiveEvaluationRecord` linkage
- one primary `WakeTriggerRecord` linkage
- any coalesced wake-origin linkage when overlap resolution merged several candidates
- the governing `WakePolicy` and `StandingOrder` context needed to explain why that request exists

### 6. Proactive evaluation history store

After wake truth exists, the system should persist append-only proactive evaluation history as:

- `ProactiveEvaluationRecordHeader`
- `ProactiveEvaluationDownstreamLink`

This is the durable answer to:

> what exactly was evaluated, what outcome class was decided, and what downstream object or
> non-emission posture followed?

### 7. Current proactive standing view

Only after the previous history family exists should the system materialize one
`CurrentProactiveStandingView` per governed scope.

That projection must preserve:

- effective authority references
- latest meaningful evaluation reference
- authority watermark
- history watermark
- trust posture
- reconciliation status

### 8. Standing projection updater and trust downgrade

Only after the standing view exists should the system add one canonical updater boundary that:

- advances standing incrementally when causal coverage is explicit
- downgrades trust when freshness, authority, or linkage coverage becomes uncertain
- requests rebuild when incremental catch-up can no longer prove continuity

The first implementation should keep this as one explicit control-plane capability rather than
spreading standing mutation across scheduler and runtime code.

### 9. Stable standing update cycle

After the canonical updater exists, the system should fix one stable update cycle per governed
scope:

- trigger intake
- single-scope claim
- standing and history load
- advance vs downgrade vs rebuild decision
- standing mutation commit
- follow-up signal emission

This keeps standing maintenance deterministic while leaving queue, lock, and storage mechanisms
downstream.

### 10. Scope claim and cycle outcome visibility

After the update cycle exists, the system should add:

- one single-scope claim invariant before standing persist
- one minimal append-only cycle-outcome record for downgrade, rebuild, claim-loss, and failed
  cycles

This makes retries and concurrent triggers legible without hard-coding one lock or queue product.

### 11. Lease expiry, bounded retry, and rebuild handoff

After claim semantics exist, the system should add:

- expiring claim leases rather than permanent ownership
- bounded retry with backoff for transient cycle failure
- explicit rebuild handoff when retry no longer improves confidence

This keeps recovery automatic without turning the control plane into an infinite retry loop.

### 12. Explicit rebuild request, detached rebuild work, and blocked remediation

After retry and rebuild handoff exist, the system should add:

- one explicit rebuild-request envelope per governed scope
- one detached rebuild worker that reconstructs standing from active authority plus durable history
- one explicit operator-remediation or unblock path when automated rebuild cannot safely converge

This keeps rebuild visible as deliberate recovery work rather than an internal retry mode, while
keeping queue, worker, and remediation tooling flexible.

### 13. Rebuild attempt history, current progress view, and operator action history

After rebuild request and remediation boundaries exist, the system should add:

- append-only rebuild attempt history for each concrete try
- one rebuildable current progress view for active or latest recovery work
- append-only operator action history for manual unblock or recovery-path changes

This keeps recovery inspectable without turning request status into one overloaded mutable row.

## Minimal First Slice

The smallest useful implementation is:

- one `WakePolicy` family
  `scheduled_run`
- one `StandingOrder` family
  cadence bounds + mandatory trigger classes
- one `WakeTriggerRecord` lifecycle
  `detected -> emitted | suppressed`
- one `SelfSchedulingIntent` family
  `tighten_cadence`
- one link from emitted wake trigger to governed execution request
- one current proactive standing view with explicit watermark and reconciliation posture

This is enough to prove that future-work truth is external before full trigger diversity exists.

## Failure Modes To Guard Against

- direct scheduler mutation with no durable record
- accepted self-scheduling change with no provenance
- emitted wake with no link to its policy basis
- suppressed wake with no explanation
- overlapping wake policies with no explicit precedence
- runtime and control plane disagreeing on current wake authority

## Acceptance Criteria

The first proactive-control-plane slice is correct if all of these are true.

1. The system can show the currently active `WakePolicy` for one governed scope.
2. The system can show the `StandingOrder` that constrained that policy.
3. A runtime-proposed `SelfSchedulingIntent` can be persisted and resolved without mutating policy in place.
4. A fired wake can be inspected as a `WakeTriggerRecord`.
5. A suppressed wake can also be inspected with an explicit reason.
6. An emitted wake can be traced to the `ExecutionRequest` it created.
7. If several wake candidates were coalesced into one request, the non-primary origins remain
   durably visible.
8. Replacing a wake policy preserves supersession history rather than overwriting state invisibly.
9. The system can show which proactive evaluation emitted one request, or that no request was
   emitted.
10. The system can show whether current proactive standing is `in_sync`, `catching_up`,
    `rebuilding`, `drift_detected`, or otherwise degraded.
11. The system can explain which updater or trust rule moved one standing scope from `trusted` to
    `lagging`, `degraded`, or `blocked`.
12. The system can explain which update cycle cause advanced, downgraded, or requested rebuild for
    one governed scope.
13. The system can show whether one cycle lost claim, failed, requested rebuild, or downgraded
    standing without depending only on transient logs.
14. The system can show when a stale claim expired, when retry backed off, and when retry was
    replaced by explicit rebuild handoff for one governed scope.
15. The system can show which rebuild request exists for one blocked scope, whether rebuild
    completed or blocked, and what operator-visible remediation path now owns the next safe step.
16. The system can show which concrete rebuild attempt ran, whether the current recovery posture is
    requested, running, blocked, failed, or completed, and what explicit operator action changed
    the recovery path when human intervention occurred.

## Explicitly Deferred

The first proactive record implementation does not need:

- full multi-asset trigger graphs
- every trigger family at once
- rich operator UI
- full workflow routing for every orchestration review question
- remote scheduling backends

## One Sentence Summary

The first proactive-control-plane implementation should make future-work authority durable before
it makes future-work execution smarter.
