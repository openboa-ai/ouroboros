# Proactive Read Durability And Recovery

This page defines the large-picture durability shape for proactive read history after
classification: what stays operational, what must become durable, and what recovery is allowed to
lose.

It follows:

- [22-proactive-read-write-classifier-and-coalescing.md](22-proactive-read-write-classifier-and-coalescing.md)
- [../historical/specs/62-proactive-read-write-classifier-contract.md](../historical/specs/62-proactive-read-write-classifier-contract.md)
- [../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md](../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md)
- [../historical/specs/64-proactive-read-write-coordinator-contract.md](../historical/specs/64-proactive-read-write-coordinator-contract.md)
- [../adrs/0028-proactive-read-write-coordinator-and-window-state.md](../adrs/0028-proactive-read-write-coordinator-and-window-state.md)

## Purpose

Keep the big picture clear after classification:

- what kind of healthy read may be suppressed
- what operational state may remain local and resettable
- what durable visibility must still survive
- what restart and shutdown are allowed to lose

## Scope And Non-Goals

This page covers:

- the coordinator boundary between classification and durable history
- bounded healthy duplicate-success windows as operational optimization state
- append-only durable visibility for suppressed healthy periods
- explicit flush, shutdown, and restart posture at subsystem level

This page does not cover:

- one storage backend
- one retry loop
- one pending-visibility view
- one operational service implementation

## Responsibilities

- decide when serious chronology bypasses suppression entirely
- keep healthy duplicate-success suppression bounded and explicitly subordinate to durable truth
- require suppressed healthy periods to reappear through durable visibility before they become
  operationally invisible
- keep restart and shutdown semantics safe by allowing optimization loss but not durable-truth loss

## System Boundaries

This layer sits:

- above read classification and coalescing policy
- above individual writers and exporter details
- below product surfaces and downstream analytics

It should not collapse into:

- classifier logic duplicated in writers
- unbounded hidden suppression
- durable truth being delegated to local optimization state

## Primary Abstractions

- `proactive_read_write_coordinator`
- bounded healthy suppression window
- append-only durable visibility for suppressed healthy periods
- restart-safe recovery posture

## Primary Flow

The stable flow should be read as:

`read behavior arrives -> classifier assigns write class -> serious chronology writes immediately or
 healthy duplicate-success enters a bounded operational window -> suppressed healthy period later
 becomes durably visible through explicit flush/summary -> restart may lose optimization state but
 durable chronology remains`

## Failure And Recovery Model

This layer has failed when:

- healthy suppression becomes invisible durable truth
- restart correctness depends on perfect survival of local optimization state
- shutdown or recovery invent chronology they cannot justify

Recovery means:

- serious history still exists independently of local suppression state
- losing local suppression state only increases write volume, not truth loss
- healthy continuity is made durable through explicit bounded visibility rather than hidden caches

## Dependencies On Other Subsystems

- depends on canonical read classification
- depends on admission and fallback record families
- feeds durable history writers and any later operational summaries

## What Is Still Delegated To Specs / ADRs

- narrow contract details remain in
  [../historical/specs/64-proactive-read-write-coordinator-contract.md](../historical/specs/64-proactive-read-write-coordinator-contract.md)
- the design decision remains in
  [../adrs/0028-proactive-read-write-coordinator-and-window-state.md](../adrs/0028-proactive-read-write-coordinator-and-window-state.md)

## Core Rule

Classification decides what may be suppressed; the durability layer decides how bounded healthy
suppression stays operational, how durable visibility still happens, and why restart may lose
optimization state without losing truth.

## One Sentence Summary

autokairos should treat healthy duplicate-success suppression as bounded operational optimization
above append-only durable visibility, with one coordinator boundary and restart-safe recovery that
never turns local coalescing state into truth.
