# Proactive Rebuild Progress And Action History

This page defines how proactive-standing rebuild should remain inspectable while it is running and
how operator intervention should remain audit-visible after automated recovery stops being enough.

It follows:

- [15-proactive-standing-rebuild-and-remediation.md](15-proactive-standing-rebuild-and-remediation.md)
- [../specs/52-proactive-standing-rebuild-attempt-record-contract.md](../specs/52-proactive-standing-rebuild-attempt-record-contract.md)
- [../specs/53-proactive-standing-rebuild-progress-view-contract.md](../specs/53-proactive-standing-rebuild-progress-view-contract.md)
- [../specs/55-proactive-rebuild-progress-field-families-contract.md](../specs/55-proactive-rebuild-progress-field-families-contract.md)
- [../specs/54-proactive-standing-operator-action-record-contract.md](../specs/54-proactive-standing-operator-action-record-contract.md)
- [../adrs/0021-proactive-rebuild-progress-and-action-history.md](../adrs/0021-proactive-rebuild-progress-and-action-history.md)

## Purpose

Keep rebuild recovery inspectable as real work in progress rather than a hidden background branch,
and keep operator intervention reconstructable after blocked recovery or policy-changing action.

## Scope And Non-Goals

This page covers:

- append-only attempt history for concrete rebuild tries
- current progress visibility for active or latest rebuild work
- append-only operator action history for remediation and unblock

This page does not cover:

- one dashboard layout
- one metrics backend
- one task runtime or queue
- broad candidate-stage human review unrelated to proactive-standing recovery

## Responsibilities

- preserve concrete chronology for each rebuild attempt
- expose current rebuild progress without confusing it with durable standing truth
- expose freshness and coverage posture so stale recovery state does not masquerade as current
- preserve operator actions that launch, narrow, pause, or unblock recovery paths

## System Boundaries

This layer sits:

- above rebuild request, rebuild worker, and operator-remediation boundaries
- above current standing and trust posture
- below product-specific status views, alerts, or workflow UX

It should not collapse into:

- one mutable status row with no attempt chronology
- one worker log stream that operators must tail manually
- manual remediation with no durable record of what changed

## Primary Abstractions

- `ProactiveStandingRebuildAttemptRecord`
- `CurrentProactiveRebuildProgressView`
- `ProactiveStandingOperatorActionRecord`

## Primary Flow

The stable visibility flow should be read as:

`rebuild request becomes active -> one concrete rebuild attempt starts and appends attempt history -> progress view reflects latest active posture -> attempt completes, blocks, or fails -> operator action history records any manual follow-up or unblock decision`

## Failure And Recovery Model

This layer has failed when:

- rebuild is running but there is no durable attempt record
- progress can only be inferred from transient logs
- operator actions cannot be traced back to one blocked request or scope
- later readers cannot distinguish "rebuild never started" from "rebuild ran and blocked"

Recovery means:

- each concrete rebuild try leaves append-only attempt history
- progress visibility is rebuildable from attempts and request state
- current reads can distinguish fresh progress from lagging or unknown progress
- operator intervention leaves explicit action history with causal links

## Dependencies On Other Subsystems

- depends on rebuild-request and rebuild-worker semantics
- depends on standing trust posture and blocked remediation semantics
- feeds audit, operator status, and follow-up governance surfaces

## What Is Still Delegated To Specs / ADRs

- rebuild-attempt history remains in
  [../specs/52-proactive-standing-rebuild-attempt-record-contract.md](../specs/52-proactive-standing-rebuild-attempt-record-contract.md)
- rebuild progress view remains in
  [../specs/53-proactive-standing-rebuild-progress-view-contract.md](../specs/53-proactive-standing-rebuild-progress-view-contract.md)
- progress field families remain in
  [../specs/55-proactive-rebuild-progress-field-families-contract.md](../specs/55-proactive-rebuild-progress-field-families-contract.md)
- operator action history remains in
  [../specs/54-proactive-standing-operator-action-record-contract.md](../specs/54-proactive-standing-operator-action-record-contract.md)
- the design decision remains in
  [../adrs/0021-proactive-rebuild-progress-and-action-history.md](../adrs/0021-proactive-rebuild-progress-and-action-history.md)

## Core Rule

Progress should be readable as a projection, attempts should remain append-only chronology, and
manual intervention should be durable history rather than chat memory.

## One Sentence Summary

autokairos should make proactive-standing rebuild visible through append-only attempt records,
rebuildable current progress views, and audit-visible operator action history.
