# Proactive Evaluation History And Standing

This page defines how proactive policy evaluation should remain visible both as durable chronology
and as current operational standing.

It follows:

- [05-proactive-policy-and-wake-records.md](05-proactive-policy-and-wake-records.md)
- [07-history-and-projection-model.md](07-history-and-projection-model.md)
- [../historical/proactive-operations/07-policy-evaluation-and-resolution.md](../historical/proactive-operations/07-policy-evaluation-and-resolution.md)
- [../historical/specs/36-proactive-evaluation-record-contract.md](../historical/specs/36-proactive-evaluation-record-contract.md)
- [../historical/specs/37-current-proactive-standing-view-contract.md](../historical/specs/37-current-proactive-standing-view-contract.md)
- [../historical/specs/38-proactive-evaluation-to-execution-linkage-contract.md](../historical/specs/38-proactive-evaluation-to-execution-linkage-contract.md)
- [../historical/specs/39-proactive-standing-watermark-and-reconciliation-contract.md](../historical/specs/39-proactive-standing-watermark-and-reconciliation-contract.md)
- [09-proactive-causality-and-standing-reconciliation.md](09-proactive-causality-and-standing-reconciliation.md)

## Purpose

Explain how autokairos should preserve:

- what proactive authority evaluation decided
- what proactive authority and standing currently are

without collapsing those two questions into one mutable scheduler state row.

## Scope And Non-Goals

This page covers:

- proactive evaluation history
- current proactive standing views
- the relationship between emitted, suppressed, coalesced, and escalated outcomes

This page does not cover:

- candidate evaluation semantics
- promotion decisions
- one backend schema
- one UI for proactive status

## Responsibilities

- define the durable history surface for proactive evaluation outcomes
- define the projection surface for current proactive standing
- keep proactive explainability separate from current convenience reads
- prevent scheduler-local state from becoming the only truth

## System Boundaries

This layer sits between:

- proactive policy evaluation and wake resolution
- downstream operator, automation, and runtime-facing reads

It is upstream of:

- `WakeTriggerRecord`
- `ExecutionRequest`
- review or escalation intake
- operator inspection of current proactive posture

## Primary Abstractions

- `ProactiveEvaluationRecord`
- `CurrentProactiveStandingView`
- evaluated candidate outcome
- current standing and reconciliation posture

## Primary Flows

The stable flow should be read as:

`normalized proactive candidate -> policy evaluation -> append ProactiveEvaluationRecord -> update CurrentProactiveStandingView -> emit downstream work when required`

## Failure And Recovery Model

This layer has failed when:

- only the latest scheduler state survives
- emitted or suppressed proactive outcomes are not reconstructable
- current standing cannot explain which recent evaluation changed it
- projection drift cannot be detected or repaired

Recovery means:

- durable evaluation chronology remains append-only
- current standing remains rebuildable and watermark-aware

## Dependencies On Other Subsystems

- depends on proactive operations for policy programs and evaluation phases
- depends on control-plane history/projection doctrine
- feeds agent invocation through wake-trigger and execution-request linkage

## What Is Still Delegated To Specs / ADRs

- narrow contracts remain in
  [../historical/specs/36-proactive-evaluation-record-contract.md](../historical/specs/36-proactive-evaluation-record-contract.md)
  and
  [../historical/specs/37-current-proactive-standing-view-contract.md](../historical/specs/37-current-proactive-standing-view-contract.md)
- tighter causality and projection-trust rules remain in
  [../historical/specs/38-proactive-evaluation-to-execution-linkage-contract.md](../historical/specs/38-proactive-evaluation-to-execution-linkage-contract.md)
  and
  [../historical/specs/39-proactive-standing-watermark-and-reconciliation-contract.md](../historical/specs/39-proactive-standing-watermark-and-reconciliation-contract.md)
- implementation-grade record shapes remain in
  [../historical/specs/40-proactive-evaluation-record-store-contract.md](../historical/specs/40-proactive-evaluation-record-store-contract.md)
  and
  [../historical/specs/41-proactive-standing-view-store-and-rebuild-contract.md](../historical/specs/41-proactive-standing-view-store-and-rebuild-contract.md)
- the durable design choice remains in
  [../adrs/0013-proactive-evaluation-history-and-standing.md](../adrs/0013-proactive-evaluation-history-and-standing.md)

## Core Rule

autokairos should preserve proactive evaluation at two levels:

- append-only chronology for what evaluation decided
- current standing for what currently applies

The bridge between those levels and downstream execution should also remain explicit.

These must be adjacent, but not collapsed.

## What Proactive Evaluation History Answers

`ProactiveEvaluationRecord` should answer:

- which normalized proactive candidate was evaluated
- which standing orders and wake policies applied
- whether the result was emitted, suppressed, coalesced, escalated, or rejected
- why that result occurred
- which downstream object, if any, was created

This is the durable chronology of proactive judgment.

## What Current Proactive Standing Answers

`CurrentProactiveStandingView` should answer:

- what proactive authority is currently in force for this scope
- what the most recent meaningful evaluation outcome was
- whether there are active escalations or pending review conditions
- what the current next-step posture is
- how fresh or reconciled this standing surface is

This is the operational read surface, not the deeper authority.

## Why The Split Matters

Without this split:

- emitted work may be explainable but current standing unreadable
- or current standing may be cheap to read while chronology disappears

autokairos needs both:

- durable explanation
- live operational clarity

## One Sentence Summary

autokairos should preserve proactive evaluation as append-only outcome history and preserve current
proactive posture as a rebuildable standing view, without confusing one for the other.
