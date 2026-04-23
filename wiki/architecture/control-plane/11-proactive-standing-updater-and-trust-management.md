# Proactive Standing Updater And Trust Management

This page defines how current proactive standing should actually be maintained once the first
persisted history and standing shapes exist.

It follows:

- [07-history-and-projection-model.md](07-history-and-projection-model.md)
- [08-proactive-evaluation-history-and-standing.md](08-proactive-evaluation-history-and-standing.md)
- [09-proactive-causality-and-standing-reconciliation.md](09-proactive-causality-and-standing-reconciliation.md)
- [10-proactive-record-shapes-and-standing-rebuild.md](10-proactive-record-shapes-and-standing-rebuild.md)
- [../specs/39-proactive-standing-watermark-and-reconciliation-contract.md](../specs/39-proactive-standing-watermark-and-reconciliation-contract.md)
- [../specs/41-proactive-standing-view-store-and-rebuild-contract.md](../specs/41-proactive-standing-view-store-and-rebuild-contract.md)
- [../specs/42-proactive-standing-projection-updater-contract.md](../specs/42-proactive-standing-projection-updater-contract.md)
- [../specs/43-proactive-standing-trust-downgrade-contract.md](../specs/43-proactive-standing-trust-downgrade-contract.md)

## Purpose

Turn the proactive standing view from a stored object into an explicit projection-maintenance
service with defined mutation rights, rebuild triggers, and trust-downgrade behavior.

## Scope And Non-Goals

This page covers:

- the projection updater that mutates `CurrentProactiveStandingView`
- the events and timers that should trigger standing advancement
- trust downgrade and recovery posture
- rebuild and catch-up responsibilities

This page does not cover:

- one queue implementation
- one database vendor
- one operator UI
- generic execution tracing

## Responsibilities

- define which component may mutate current proactive standing
- define when incremental catch-up is enough and when rebuild is required
- define when trust should downgrade even if no new history arrives
- keep current standing readable without hiding lag or uncertainty

## System Boundaries

This layer sits:

- above append-only proactive history and active authority
- above wake-trigger and execution-request linkage when current posture depends on them
- below operator reads, runtime wake-context reads, and orchestration dashboards

It should not collapse into:

- scheduler-local mutable memory
- one hidden projection cursor
- one runtime-owned cache pretending to be durable standing

## Primary Abstractions

- `ProactiveStandingProjectionUpdater`
- `CurrentProactiveStandingView`
- authority watermark
- history watermark
- trust downgrade policy
- rebuild request and rebuild completion posture

## Primary Flows

The stable maintenance flow should be read as:

`history or authority change detected -> projection updater loads current standing -> applies incremental advancement if safe -> updates watermark and trust posture -> exposes refreshed current standing`

When safe advancement is not possible:

`change detected -> updater records drift or lag -> downgrades trust -> schedules catch-up or rebuild -> restores trusted posture only after explicit coverage`

## Failure And Recovery Model

This layer has failed when:

- more than one component mutates standing rows opportunistically
- trust stays `trusted` after missed freshness deadlines
- emitted downstream work is known in history but not reflected in current standing
- projection rebuild exists operationally but is not part of the design contract

Recovery means:

- re-read active authority
- replay proactive evaluation and linkage history
- recompute current standing for the governed scope
- restore `trusted` only after explicit authority and history coverage

## Dependencies On Other Subsystems

- depends on proactive operations for policy-program outcomes and wake decisions
- depends on control-plane durable history families and causal linkage
- feeds agent execution and operator inspection through one current standing read

## What Is Still Delegated To Specs / ADRs

- updater behavior remains in
  [../specs/42-proactive-standing-projection-updater-contract.md](../specs/42-proactive-standing-projection-updater-contract.md)
- trust downgrade rules remain in
  [../specs/43-proactive-standing-trust-downgrade-contract.md](../specs/43-proactive-standing-trust-downgrade-contract.md)
- the durable design choice remains in
  [../adrs/0016-proactive-standing-updater-and-trust-downgrade.md](../adrs/0016-proactive-standing-updater-and-trust-downgrade.md)

## Core Rule

`CurrentProactiveStandingView` should have exactly one canonical mutation path:

- an explicit projection updater above durable history
- never ad hoc direct writes from scheduler, runtime, or operator tools

## Update Trigger Rule

The projection updater should wake on four classes of causes:

- proactive evaluation history append
- authority change or supersession
- downstream linkage arrival when current posture depends on emitted work
- time-based freshness review or explicit rebuild request

## Incremental Advancement Rule

Incremental advancement is preferred when:

- authority coverage is still valid
- new history is contiguous with the current watermark
- required downstream linkage is available
- no corruption or causality gap is detected

## Rebuild Rule

Full rebuild should replace incremental advancement when:

- authority lineage changed in a way that invalidates current standing
- history continuity or linkage continuity is broken
- projection state is corrupted or missing
- a manual or automated rebuild request is raised

## Trust Management Rule

Trust downgrade is not a secondary monitoring concern.

It is part of the standing contract itself.

The updater must be able to move standing posture from:

- `trusted`
- to `lagging`, `degraded`, `blocked`, or equivalent

even when no fresh history arrives, if:

- freshness deadline passes
- expected linkage is missing
- rebuild fails
- authority coverage becomes uncertain

## One Sentence Summary

autokairos should maintain proactive standing through one explicit projection updater that advances
watermarks when safe, downgrades trust when coverage is missing, and triggers rebuild when
incremental catch-up is no longer trustworthy.
