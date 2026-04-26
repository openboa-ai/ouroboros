# Proactive Record Shapes And Standing Rebuild

This page defines the first implementation-grade record shapes for proactive evaluation history and
current proactive standing.

It follows:

- [08-proactive-evaluation-history-and-standing.md](08-proactive-evaluation-history-and-standing.md)
- [09-proactive-causality-and-standing-reconciliation.md](09-proactive-causality-and-standing-reconciliation.md)
- [06-proactive-record-implementation-plan.md](06-proactive-record-implementation-plan.md)
- [../historical/specs/36-proactive-evaluation-record-contract.md](../historical/specs/36-proactive-evaluation-record-contract.md)
- [../historical/specs/37-current-proactive-standing-view-contract.md](../historical/specs/37-current-proactive-standing-view-contract.md)
- [../historical/specs/38-proactive-evaluation-to-execution-linkage-contract.md](../historical/specs/38-proactive-evaluation-to-execution-linkage-contract.md)
- [../historical/specs/39-proactive-standing-watermark-and-reconciliation-contract.md](../historical/specs/39-proactive-standing-watermark-and-reconciliation-contract.md)
- [../historical/specs/40-proactive-evaluation-record-store-contract.md](../historical/specs/40-proactive-evaluation-record-store-contract.md)
- [../historical/specs/41-proactive-standing-view-store-and-rebuild-contract.md](../historical/specs/41-proactive-standing-view-store-and-rebuild-contract.md)

## Purpose

Turn the newer proactive causality and standing-trust rules into a first concrete storage and
rebuild design.

## Scope And Non-Goals

This page covers:

- first persisted shapes for proactive evaluation history
- first persisted shape for current proactive standing
- watermark advancement
- drift detection
- rebuild triggers

This page does not cover:

- one backend vendor
- one queue technology
- one operator UI

## Responsibilities

- keep proactive evaluation history append-only and causally linked
- keep current proactive standing cheap to read but explicit about trust posture
- define when watermark advancement is valid
- define when drift should trigger catch-up, rebuild, or degraded trust

## System Boundaries

This layer sits:

- below policy evaluation and wake resolution
- above operator reads and execution issuance

It should not collapse into:

- one scheduler-local state blob
- one hidden projection cursor
- one runtime-owned wake context cache

## Primary Abstractions

- `ProactiveEvaluationRecordHeader`
- `ProactiveEvaluationDownstreamLink`
- `CurrentProactiveStandingView`
- authority watermark
- history watermark
- reconciliation and rebuild posture

## Primary Flows

The stable implementation flow should be read as:

`evaluate proactive candidate -> append evaluation header -> append downstream linkage -> advance standing watermarks if safe -> expose current standing read`

If watermarks cannot safely advance:

`append durable history -> mark standing lagging or drifted -> queue catch-up or rebuild -> degrade trust until reconciled`

## Failure And Recovery Model

This layer has failed when:

- evaluation history is durable but cannot be joined to emitted work cheaply
- standing watermarks advance past unprocessed history
- authority changes occur without explicit standing invalidation
- rebuild only exists as an operator ritual rather than a design rule

Recovery means:

- replay durable proactive history
- re-read active authority
- recompute standing
- restore trust posture only after watermark coverage is explicit again

## Dependencies On Other Subsystems

- depends on proactive operations for normalized candidates and resolved outcomes
- depends on control-plane history/projection doctrine
- feeds agent invocation through request issuance and operator reads through current standing

## What Is Still Delegated To Specs / ADRs

- narrow record shapes remain in
  [../historical/specs/40-proactive-evaluation-record-store-contract.md](../historical/specs/40-proactive-evaluation-record-store-contract.md)
- watermark and rebuild rules remain in
  [../historical/specs/41-proactive-standing-view-store-and-rebuild-contract.md](../historical/specs/41-proactive-standing-view-store-and-rebuild-contract.md)
- the durable design choice remains in
  [../adrs/0015-proactive-record-shapes-and-standing-rebuild.md](../adrs/0015-proactive-record-shapes-and-standing-rebuild.md)

## Core Rule

The first serious proactive implementation should keep:

- append-only proactive evaluation history as the deeper truth
- one readable current standing surface as the operational truth
- explicit watermarks and rebuild posture between them

## Minimal Shape Rule

The first cut should stay intentionally small.

For history:

- one evaluation header
- one optional downstream-link family

For projection:

- one current standing row per governed scope

Do not explode the model into many tiny tables unless implementation pressure forces it.

## Watermark Rule

`CurrentProactiveStandingView` should advance only when:

- authority coverage is known
- proactive evaluation history has been applied through an explicit horizon
- downstream linkage needed for the current outcome has either been written or explicitly marked
  `not_applicable`

## Drift Rule

The standing view should mark itself drifted or degraded when:

- authority changes invalidate current coverage
- expected proactive history has not been applied by the allowed lag window
- downstream emitted work exists but standing still points to an earlier evaluation horizon
- projection rebuild or catch-up fails

## Rebuild Rule

Rebuild should re-derive current standing from:

- active `WakePolicy`
- active `StandingOrder`
- `ProactiveEvaluationRecord` history
- `WakeTriggerRecord` and downstream linkage when needed for current outcome posture

The rebuilt standing should not regain `in_sync` trust until its authority and history watermarks
are explicit.

## One Sentence Summary

The first concrete proactive implementation should store a small append-only evaluation family plus
one watermark-aware current standing surface, and it should treat rebuild and trust degradation as
part of the architecture rather than as an operational afterthought.
