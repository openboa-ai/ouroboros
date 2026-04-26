# Proactive Rebuild Progress Field Families

This page defines the field families that make `CurrentProactiveRebuildProgressView` readable,
freshness-aware, and coverage-aware without hard-coding one storage schema or one dashboard model.

It follows:

- [16-proactive-rebuild-progress-and-action-history.md](16-proactive-rebuild-progress-and-action-history.md)
- [../historical/specs/53-proactive-standing-rebuild-progress-view-contract.md](../historical/specs/53-proactive-standing-rebuild-progress-view-contract.md)
- [../historical/specs/55-proactive-rebuild-progress-field-families-contract.md](../historical/specs/55-proactive-rebuild-progress-field-families-contract.md)
- [18-proactive-rebuild-read-safety-classes.md](18-proactive-rebuild-read-safety-classes.md)
- [../historical/specs/56-proactive-rebuild-read-safety-classes-contract.md](../historical/specs/56-proactive-rebuild-read-safety-classes-contract.md)
- [../adrs/0022-proactive-rebuild-progress-field-families.md](../adrs/0022-proactive-rebuild-progress-field-families.md)

## Purpose

Keep rebuild progress readable through stable field families so the system can express freshness,
coverage, and current posture precisely without freezing one database schema or transport payload.

## Scope And Non-Goals

This page covers:

- progress-view field families
- required semantic groupings for freshness and coverage
- read-safety cues that prevent stale progress from looking live

This page does not cover:

- one SQL table
- one JSON schema version
- one alerting policy
- one progress percentage algorithm

## Responsibilities

- preserve a stable shape language for progress reads
- prevent `running`, `idle`, `blocked`, and `unknown` from collapsing into one ambiguous status
- make freshness and coverage explicit enough for operator and automation-safe reads

## System Boundaries

This layer sits:

- above attempt history, request history, and operator action history
- above raw worker logs or heartbeat streams
- below storage schema, API payload, or UI formatting choices

It should not collapse into:

- one opaque `status_payload`
- one timestamp with no freshness posture
- one mutable row that hides what history it actually covers

## Primary Abstractions

- identity and linkage family
- posture and reason family
- freshness family
- coverage family
- terminal summary family
- read-safety family

## Primary Flow

The stable shape flow should be read as:

`append durable request/attempt/action history -> project current progress view -> populate stable field families -> let callers decide whether the read is fresh enough or whether deeper chronology is required`

## Failure And Recovery Model

This layer has failed when:

- progress view exposes only one status string and one timestamp
- callers cannot tell what chronology the view has actually incorporated
- stale running posture still looks operationally current
- blocked or unknown posture can only be inferred from missing data

Recovery means:

- field families make freshness and coverage explicit
- unknown or partial posture remains visible as such
- deeper chronology can still be consulted when the read boundary says it should be

## Dependencies On Other Subsystems

- depends on rebuild request, attempt, and operator action history
- depends on rebuild progress read semantics already fixed in the adjacent spec
- feeds operator status reads, alerting, and automation-safe recovery decisions

## What Is Still Delegated To Specs / ADRs

- the read semantics remain in
  [../historical/specs/53-proactive-standing-rebuild-progress-view-contract.md](../historical/specs/53-proactive-standing-rebuild-progress-view-contract.md)
- the field-family contract remains in
  [../historical/specs/55-proactive-rebuild-progress-field-families-contract.md](../historical/specs/55-proactive-rebuild-progress-field-families-contract.md)
- the caller-class read-safety contract remains in
  [../historical/specs/56-proactive-rebuild-read-safety-classes-contract.md](../historical/specs/56-proactive-rebuild-read-safety-classes-contract.md)
- the next subsystem page remains in
  [18-proactive-rebuild-read-safety-classes.md](18-proactive-rebuild-read-safety-classes.md)
- the design decision remains in
  [../adrs/0022-proactive-rebuild-progress-field-families.md](../adrs/0022-proactive-rebuild-progress-field-families.md)

## Core Rule

Current rebuild progress should be shaped as stable semantic field families, not as one opaque
status blob and not as one rigid implementation schema.

## One Sentence Summary

autokairos should express rebuild progress through stable identity, posture, freshness, coverage,
terminal-summary, and read-safety field families so callers can tell when current recovery state is
fresh, partial, blocked, or unknown.
