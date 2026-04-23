# History And Projection Model

This page defines how autokairos should separate durable history from current operational state.

It follows:

- [03-record-model.md](03-record-model.md)
- [04-review-operations-and-audit.md](04-review-operations-and-audit.md)
- [05-proactive-policy-and-wake-records.md](05-proactive-policy-and-wake-records.md)
- [06-proactive-record-implementation-plan.md](06-proactive-record-implementation-plan.md)
- [../specs/30-event-log-first-durable-truth-posture.md](../specs/30-event-log-first-durable-truth-posture.md)
- [../specs/31-history-record-families-contract.md](../specs/31-history-record-families-contract.md)
- [../specs/32-current-state-projection-families-contract.md](../specs/32-current-state-projection-families-contract.md)

## Purpose

Explain how the control plane keeps durable chronology without forcing every operational read to
replay every historical event.

## Scope And Non-Goals

This page covers:

- why history and projections must be separate
- which kinds of records belong to each layer
- how mutation and rebuild should work conceptually
- why this is an architecture rule rather than a database trick

This page does not cover:

- exact database tables
- projection implementation mechanics for one backend
- event-bus technology selection

## Responsibilities

- define what counts as append-only durable history
- define what counts as current-state projection
- define which layer is authoritative for which question
- define what is rebuildable and what is not

## System Boundaries

This model sits inside the control plane and above:

- active runtime execution
- transient runtime-local state

It feeds:

- operator and governance views
- queue and claim surfaces
- downstream evaluation and audit consumers

## Primary Abstractions

- history record family
- projection family
- projection watermark or reconciliation posture
- rebuild and replay boundary

## Primary Flows

The primary flow is:

`runtime or orchestration fact -> append durable history -> update or reconcile current-state projection -> operator or system read`

## Failure And Recovery Model

The key distinction is:

- losing a projection is recoverable if durable history remains
- losing durable history is not recoverable from projections alone

That is why autokairos should optimize for preserving history first and projections second.

## Dependencies On Other Subsystems

This page depends on:

- proactive operations for wake history and future-work authority
- agent system for execution-attempt lifecycle and trace emission
- evaluation and progression for evidence and decision history

## What Is Still Delegated To Specs / ADRs

- narrow contracts remain in `../specs/`
- the accepted split is preserved in `../adrs/`

## Core Rule

autokairos should not have one undifferentiated "record store."

It should have:

- append-only durable history for facts that happened
- explicit current-state projections for what currently stands

These are related layers, but they answer different questions.

## What History Answers

History answers:

- what happened?
- in what order?
- why did it happen?
- what was emitted, suppressed, accepted, interrupted, or decided?

Examples:

- `WakeTriggerRecord`
- `ProactiveEvaluationRecord`
- `ExecutionAttemptLifecycleEvent`
- `PromotionDecision`
- trace events or durable trace references

## What Projections Answer

Projections answer:

- what is active now?
- what currently stands for this request or attempt?
- what wake policy is in force?
- what work is claimable right now?
- what watermark and reconciliation posture a current standing view actually has?

Examples:

- current wake-policy view
- current proactive standing view
- current execution-request view
- current execution-attempt view
- current review standing view

## Why The Split Matters

Without the split, the system drifts into one of two bad defaults:

- projection-only truth
  current rows overwrite the chronology that explains how the system got here
- history-only ergonomics
  every operational read becomes a replay problem and the live system gets slower and harder to
  inspect

autokairos needs both.

## Rebuild Principle

The safe default is:

- projections may be rebuilt or reconciled from durable history
- durable history should not need projections in order to remain intelligible
- projections should expose watermark and reconciliation posture rather than silently implying
  completeness

This does not mean every projection rebuild must be cheap or immediate.

It means the architecture should preserve a path back to truth if projections drift, are lost, or
need to be regenerated.

## One Sentence Summary

autokairos should preserve what happened as append-only history and preserve what currently stands
as explicit projections, without confusing one for the other.
