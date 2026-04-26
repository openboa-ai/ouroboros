# Proactive Read Write Classifier And Coalescing

This page defines the canonical classifier that turns proactive rebuild read behavior into
durability classes, plus the narrow coalescing rules that keep low-value healthy reads from
flooding control-plane history.

It follows:

- [21-proactive-read-write-policy-and-sampling.md](21-proactive-read-write-policy-and-sampling.md)
- [../historical/specs/60-proactive-read-admission-write-policy-contract.md](../historical/specs/60-proactive-read-admission-write-policy-contract.md)
- [../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md](../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md)
- [../historical/specs/62-proactive-read-write-classifier-contract.md](../historical/specs/62-proactive-read-write-classifier-contract.md)
- [../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md](../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md)
- [23-proactive-read-write-coordinator-and-window-state.md](23-proactive-read-write-coordinator-and-window-state.md)
- [../historical/specs/64-proactive-read-write-coordinator-contract.md](../historical/specs/64-proactive-read-write-coordinator-contract.md)
- [../adrs/0027-proactive-read-write-classifier-and-coalescing.md](../adrs/0027-proactive-read-write-classifier-and-coalescing.md)

## Purpose

Keep durability decisions consistent across surfaces and keep low-value repetitive healthy reads
from overwhelming serious read history.

## Scope And Non-Goals

This page covers:

- the canonical classifier that maps read behavior into write classes
- duplicate-success suppression and coalescing for low-value reads
- hard limits on what may never be coalesced away

This page does not cover:

- one storage backend
- one queue or batching implementation
- one dashboard aggregation
- one telemetry exporter

## Responsibilities

- classify read behavior into stable durability buckets
- prevent arbitrary surface-specific write policy drift
- permit narrow coalescing only for low-value repetitive success cases
- protect serious warning, failure, and fallback chronology from suppression

## System Boundaries

This layer sits:

- above read-admission and fallback write-policy rules
- above individual UI polling behavior
- below concrete persistence, batching, and exporter implementations

It should not collapse into:

- one implicit write heuristic per surface
- aggressive deduplication that erases meaningful chronology
- one global "sample everything healthy" shortcut

## Primary Abstractions

- `read_write_classifier`
- `write_class`
- `coalescing_candidate`
- `duplicate_success_suppression`
- `non_coalescible_read`

## Primary Flow

The stable flow should be read as:

`admission or fallback event occurs -> classifier determines write class -> if the event is a
 low-value healthy success it may enter a narrow coalescing path -> otherwise durable history is
 appended immediately`

## Failure And Recovery Model

This layer has failed when:

- one API writes everything while another drops equivalent reads
- duplicate healthy polls drown warning and failure history
- coalescing suppresses actual fallback or degraded admission chronology

Recovery means:

- one canonical classifier decides write classes
- only narrow duplicate-success cases can be coalesced
- serious read behavior remains durably visible without suppression

## Dependencies On Other Subsystems

- depends on read-admission and fallback-invocation record families
- depends on write-policy rules for admission and fallback
- feeds control-plane history writers, samplers, and summarization services

## What Is Still Delegated To Specs / ADRs

- classifier semantics remain in
  [../historical/specs/62-proactive-read-write-classifier-contract.md](../historical/specs/62-proactive-read-write-classifier-contract.md)
- coalescing semantics remain in
  [../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md](../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md)
- downstream durability, visibility, and recovery semantics remain in
  [../historical/specs/64-proactive-read-write-coordinator-contract.md](../historical/specs/64-proactive-read-write-coordinator-contract.md)
- the next subsystem page remains in
  [23-proactive-read-write-coordinator-and-window-state.md](23-proactive-read-write-coordinator-and-window-state.md)
- the design decision remains in
  [../adrs/0027-proactive-read-write-classifier-and-coalescing.md](../adrs/0027-proactive-read-write-classifier-and-coalescing.md)

## Core Rule

Durability class should come from one canonical classifier, and coalescing should be limited to
duplicate healthy success cases that do not change operational interpretation.

## One Sentence Summary

autokairos should classify read behavior through one stable write classifier and allow coalescing
only for narrow duplicate-success cases, never for serious warning, failure, or fallback history.
