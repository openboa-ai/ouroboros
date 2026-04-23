# Proactive Rebuild Read Safety Classes

This page defines how the same proactive-rebuild progress view should be interpreted differently by
operator, automation-safe, and audit reads.

It follows:

- [17-proactive-rebuild-progress-field-families.md](17-proactive-rebuild-progress-field-families.md)
- [../specs/53-proactive-standing-rebuild-progress-view-contract.md](../specs/53-proactive-standing-rebuild-progress-view-contract.md)
- [../specs/55-proactive-rebuild-progress-field-families-contract.md](../specs/55-proactive-rebuild-progress-field-families-contract.md)
- [../specs/56-proactive-rebuild-read-safety-classes-contract.md](../specs/56-proactive-rebuild-read-safety-classes-contract.md)
- [19-proactive-rebuild-read-admission-and-fallback.md](19-proactive-rebuild-read-admission-and-fallback.md)
- [../specs/57-proactive-rebuild-read-admission-and-fallback-contract.md](../specs/57-proactive-rebuild-read-admission-and-fallback-contract.md)
- [../adrs/0023-proactive-rebuild-read-safety-classes.md](../adrs/0023-proactive-rebuild-read-safety-classes.md)

## Purpose

Prevent one current progress view from being treated as equally trustworthy for every caller, while
keeping storage, payload, and UI implementations flexible.

## Scope And Non-Goals

This page covers:

- read classes for rebuild progress
- minimum guarantees for each class
- fallback behavior when freshness or coverage is insufficient

This page does not cover:

- one API surface
- one alerting policy
- one dashboard implementation
- candidate-stage governance reads outside proactive rebuild

## Responsibilities

- distinguish operator-readable progress from automation-safe progress
- prevent stale or partial views from driving automated recovery decisions
- keep audit reads reconstructable even when current progress is stale

## System Boundaries

This layer sits:

- above progress-view field families and read semantics
- above raw attempt chronology and request history
- below concrete product APIs and UI widgets

It should not collapse into:

- one universal "status is good enough" rule
- one hidden caller-specific interpretation
- one assumption that all readers tolerate stale or partial coverage equally

## Primary Abstractions

- operator read
- automation-safe read
- audit read
- fallback to deeper chronology
- read admission vs read rejection

## Primary Flow

The stable read-safety flow should be read as:

`caller asks for rebuild progress -> classify intended read class -> inspect freshness, coverage, posture, and read-safety family -> either admit current view for that class or require fallback to deeper chronology`

## Failure And Recovery Model

This layer has failed when:

- automation uses an operator-grade read as if it were machine-safe
- audit cannot reconstruct history because the current view is stale
- callers cannot tell when to fall back from projection to deeper chronology

Recovery means:

- read classes state explicit minimum guarantees
- stale or partial current views remain visible as such
- deeper chronology remains the fallback whenever the current read is insufficient

## Dependencies On Other Subsystems

- depends on rebuild progress view and field-family semantics
- depends on append-only request, attempt, and operator action history
- feeds operator UX, automation policies, and audit tooling

## What Is Still Delegated To Specs / ADRs

- progress-view semantics remain in
  [../specs/53-proactive-standing-rebuild-progress-view-contract.md](../specs/53-proactive-standing-rebuild-progress-view-contract.md)
- field-family semantics remain in
  [../specs/55-proactive-rebuild-progress-field-families-contract.md](../specs/55-proactive-rebuild-progress-field-families-contract.md)
- read-safety class semantics remain in
  [../specs/56-proactive-rebuild-read-safety-classes-contract.md](../specs/56-proactive-rebuild-read-safety-classes-contract.md)
- the admission and fallback boundary remains in
  [../specs/57-proactive-rebuild-read-admission-and-fallback-contract.md](../specs/57-proactive-rebuild-read-admission-and-fallback-contract.md)
- the next subsystem page remains in
  [19-proactive-rebuild-read-admission-and-fallback.md](19-proactive-rebuild-read-admission-and-fallback.md)
- the design decision remains in
  [../adrs/0023-proactive-rebuild-read-safety-classes.md](../adrs/0023-proactive-rebuild-read-safety-classes.md)

## Core Rule

The current progress view may be sufficient for some callers and insufficient for others; read
safety must therefore be classed explicitly instead of assumed globally.

## One Sentence Summary

autokairos should classify proactive rebuild reads into operator, automation-safe, and audit
classes, each with explicit minimum guarantees and explicit fallback to deeper chronology when the
current view is not good enough.
