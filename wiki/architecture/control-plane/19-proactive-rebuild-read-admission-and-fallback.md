# Proactive Rebuild Read Admission And Fallback

This page defines the canonical boundary that decides whether the current proactive rebuild
progress view is good enough for a caller, or whether the caller must fall back to deeper
chronology.

It follows:

- [18-proactive-rebuild-read-safety-classes.md](18-proactive-rebuild-read-safety-classes.md)
- [../specs/53-proactive-standing-rebuild-progress-view-contract.md](../specs/53-proactive-standing-rebuild-progress-view-contract.md)
- [../specs/56-proactive-rebuild-read-safety-classes-contract.md](../specs/56-proactive-rebuild-read-safety-classes-contract.md)
- [../specs/57-proactive-rebuild-read-admission-and-fallback-contract.md](../specs/57-proactive-rebuild-read-admission-and-fallback-contract.md)
- [20-proactive-read-admission-history-and-fallback-invocation.md](20-proactive-read-admission-history-and-fallback-invocation.md)
- [../specs/58-proactive-rebuild-read-admission-record-contract.md](../specs/58-proactive-rebuild-read-admission-record-contract.md)
- [../specs/59-proactive-rebuild-fallback-invocation-record-contract.md](../specs/59-proactive-rebuild-fallback-invocation-record-contract.md)
- [../adrs/0024-proactive-rebuild-read-admission-and-fallback.md](../adrs/0024-proactive-rebuild-read-admission-and-fallback.md)

## Purpose

Prevent every API, dashboard, automation surface, and audit tool from inventing its own threshold
 for when current rebuild progress is safe enough to use.

## Scope And Non-Goals

This page covers:

- canonical read-admission evaluation for proactive rebuild progress
- explicit fallback to deeper chronology
- stable admission outcomes above caller-class semantics

This page does not cover:

- one HTTP endpoint
- one RPC transport
- one dashboard widget
- one authorization model

## Responsibilities

- evaluate current rebuild progress against the requested read class
- make the admission outcome explicit instead of implicit
- require fallback when current projection is not trustworthy enough
- keep operator convenience distinct from automation safety and audit sufficiency

## System Boundaries

This layer sits:

- above current progress view and its field families
- above caller-class semantics for operator, automation-safe, and audit reads
- below product APIs, UI surfaces, and downstream automation policies

It should not collapse into:

- hidden caller-specific heuristics
- one boolean `safe_to_read`
- one assumption that the current projection is always preferred over chronology

## Primary Abstractions

- `requested_read_class`
- `current_progress_view`
- `read_admission_evaluator`
- `admission_outcome`
- `fallback_to_chronology`

## Primary Flow

The stable read-admission flow should be read as:

`caller requests rebuild status -> state requested read class -> load current progress view ->
 evaluate posture, freshness, coverage, and read-safety inputs -> either admit current view or warn
 or reject -> fall back to deeper chronology when required`

## Failure And Recovery Model

This layer has failed when:

- automation acts on operator-grade current progress
- audit uses stale projection as final truth with no chronology fallback
- one API admits a view another API rejects for the same class

Recovery means:

- one canonical evaluator makes the admission decision
- the admission outcome is visible and inspectable
- chronology remains the fallback whenever current projection is insufficient

## Dependencies On Other Subsystems

- depends on rebuild progress view and field-family semantics
- depends on caller-class read-safety semantics
- depends on append-only request, attempt, and operator-action history for fallback
- feeds operator status surfaces, automation decision surfaces, and audit reads

## What Is Still Delegated To Specs / ADRs

- progress-view semantics remain in
  [../specs/53-proactive-standing-rebuild-progress-view-contract.md](../specs/53-proactive-standing-rebuild-progress-view-contract.md)
- caller-class semantics remain in
  [../specs/56-proactive-rebuild-read-safety-classes-contract.md](../specs/56-proactive-rebuild-read-safety-classes-contract.md)
- the admission and fallback boundary remains in
  [../specs/57-proactive-rebuild-read-admission-and-fallback-contract.md](../specs/57-proactive-rebuild-read-admission-and-fallback-contract.md)
- durable admission history remains in
  [../specs/58-proactive-rebuild-read-admission-record-contract.md](../specs/58-proactive-rebuild-read-admission-record-contract.md)
- durable fallback invocation history remains in
  [../specs/59-proactive-rebuild-fallback-invocation-record-contract.md](../specs/59-proactive-rebuild-fallback-invocation-record-contract.md)
- the next subsystem page remains in
  [20-proactive-read-admission-history-and-fallback-invocation.md](20-proactive-read-admission-history-and-fallback-invocation.md)
- the design decision remains in
  [../adrs/0024-proactive-rebuild-read-admission-and-fallback.md](../adrs/0024-proactive-rebuild-read-admission-and-fallback.md)

## Core Rule

Current rebuild progress should never be used directly by serious callers; it should first pass
through one canonical admission evaluator that can admit, warn, or reject and fall back.

## One Sentence Summary

autokairos should evaluate current proactive rebuild progress through one canonical admission
boundary so operator, automation-safe, and audit callers either receive an explicitly admitted
current read or are forced onto deeper chronology.
