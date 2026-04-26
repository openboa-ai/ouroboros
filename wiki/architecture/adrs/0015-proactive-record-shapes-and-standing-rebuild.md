# ADR 0015: Proactive Record Shapes And Standing Rebuild

## Status

accepted

## Context

autokairos already had:

- proactive evaluation history as durable chronology
- current proactive standing as rebuildable projection
- explicit causality from proactive evaluation into execution issuance

The remaining implementation ambiguity was:

- what the first persisted proactive history shapes should be
- what the first persisted standing-view shape should be
- when watermark advancement, drift detection, and rebuild should happen

## Decision

autokairos will use a small first implementation posture:

1. append-only proactive history:
   - `ProactiveEvaluationRecordHeader`
   - `ProactiveEvaluationDownstreamLink`
2. current standing projection:
   - one `CurrentProactiveStandingView` per governed scope

The standing view must carry:

- authority watermark
- history watermark
- trust posture
- reconciliation status

Watermarks may advance only after authority coverage, history coverage, and needed downstream
causality are explicit.

## Alternatives considered

### One opaque proactive-evaluation blob

Rejected because it hides downstream causality and makes emitted versus non-emitted outcomes harder
to query and audit.

### Many small proactive tables from the start

Rejected because it hardens the upper layer too early and turns one flexible subsystem into rigid
schema taxonomy.

### Standing row without watermarks

Rejected because it makes operational reads convenient but unsafe.

## Consequences

Positive:

- the first proactive implementation stays small
- emitted and non-emitted proactive outcomes remain equally durable
- current standing becomes operationally useful without pretending to be infallible

Negative:

- projection trust and rebuild posture become explicit implementation work
- incrementally maintained current standing must now carry more metadata than a naive status row

## Supersedes / superseded by

- Supersedes: none
- Superseded by: none

## Date / owner

- Date: 2026-04-19
- Owner: Codex
