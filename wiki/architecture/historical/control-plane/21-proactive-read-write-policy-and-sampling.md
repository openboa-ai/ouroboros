# Proactive Read Write Policy And Sampling

This page defines when proactive rebuild read-admission and fallback behavior must become durable
history, and when low-value reads may remain sampled or ephemeral.

It follows:

- [20-proactive-read-admission-history-and-fallback-invocation.md](20-proactive-read-admission-history-and-fallback-invocation.md)
- [../historical/specs/58-proactive-rebuild-read-admission-record-contract.md](../historical/specs/58-proactive-rebuild-read-admission-record-contract.md)
- [../historical/specs/59-proactive-rebuild-fallback-invocation-record-contract.md](../historical/specs/59-proactive-rebuild-fallback-invocation-record-contract.md)
- [../historical/specs/60-proactive-read-admission-write-policy-contract.md](../historical/specs/60-proactive-read-admission-write-policy-contract.md)
- [../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md](../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md)
- [22-proactive-read-write-classifier-and-coalescing.md](22-proactive-read-write-classifier-and-coalescing.md)
- [../historical/specs/62-proactive-read-write-classifier-contract.md](../historical/specs/62-proactive-read-write-classifier-contract.md)
- [../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md](../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md)
- [../adrs/0026-proactive-read-write-policy-and-sampling.md](../adrs/0026-proactive-read-write-policy-and-sampling.md)

## Purpose

Preserve signal-rich operational history for serious read behavior without forcing every harmless
status glance or repetitive healthy poll into permanent control-plane chronology.

## Scope And Non-Goals

This page covers:

- durable write policy for read-admission history
- durable write policy for fallback-invocation history
- sampling and ephemerality boundaries for low-value reads

This page does not cover:

- one telemetry backend
- one analytics product
- one UI polling strategy
- one storage-engine implementation

## Responsibilities

- keep serious read behavior reconstructable
- prevent noisy operator polling from drowning meaningful history
- require stronger durability for automation-safe and audit-relevant reads
- keep fallback execution more visible than mere projection peeks

## System Boundaries

This layer sits:

- above admission and fallback record shapes
- above individual product polling behaviors
- below backend-specific logging and telemetry pipelines

It should not collapse into:

- always write everything
- write nothing and hope traces are enough
- one hidden implementation-specific heuristic

## Primary Abstractions

- `must_write`
- `write_if_non_trivial`
- `sample_or_ephemeral`
- caller-class-aware durability
- fallback-first durability

## Primary Flow

The stable write-policy flow should be read as:

`read admission happens -> classify durability obligation -> append durable history when required or
 justified -> keep harmless reads sampled or ephemeral when allowed -> persist actual fallback
 invocations with stronger guarantees`

## Failure And Recovery Model

This layer has failed when:

- harmless operator polling floods durable history
- automation-safe reject/warn paths disappear because they were sampled away
- actual fallback executions are less visible than projection peeks

Recovery means:

- must-write categories remain durable
- non-trivial operator reads remain available when needed
- low-value healthy reads stay lightweight

## Dependencies On Other Subsystems

- depends on admission-record and fallback-invocation record contracts
- depends on caller-class semantics and admission evaluator semantics
- feeds control-plane storage, audit tooling, and operational analytics

## What Is Still Delegated To Specs / ADRs

- admission-history write policy remains in
  [../historical/specs/60-proactive-read-admission-write-policy-contract.md](../historical/specs/60-proactive-read-admission-write-policy-contract.md)
- fallback-history write policy remains in
  [../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md](../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md)
- classifier and coalescing semantics remain in
  [../historical/specs/62-proactive-read-write-classifier-contract.md](../historical/specs/62-proactive-read-write-classifier-contract.md)
  and
  [../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md](../historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md)
- the next subsystem page remains in
  [22-proactive-read-write-classifier-and-coalescing.md](22-proactive-read-write-classifier-and-coalescing.md)
- the design decision remains in
  [../adrs/0026-proactive-read-write-policy-and-sampling.md](../adrs/0026-proactive-read-write-policy-and-sampling.md)

## Core Rule

Serious read behavior should be durably visible by default, but harmless healthy polling should be
allowed to remain sampled or ephemeral so control-plane history keeps signal.

## One Sentence Summary

autokairos should write non-trivial admission and real fallback behavior durably, while treating
healthy low-value read traffic as sampled or ephemeral unless the caller class or outcome raises
its importance.
