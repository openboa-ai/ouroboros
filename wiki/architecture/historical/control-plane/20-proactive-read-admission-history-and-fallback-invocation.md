# Proactive Read Admission History And Fallback Invocation

This page defines how proactive rebuild read admission becomes operationally visible when a
serious caller needs more than one ephemeral admission result.

It follows:

- [19-proactive-rebuild-read-admission-and-fallback.md](19-proactive-rebuild-read-admission-and-fallback.md)
- [../historical/specs/57-proactive-rebuild-read-admission-and-fallback-contract.md](../historical/specs/57-proactive-rebuild-read-admission-and-fallback-contract.md)
- [../historical/specs/58-proactive-rebuild-read-admission-record-contract.md](../historical/specs/58-proactive-rebuild-read-admission-record-contract.md)
- [../historical/specs/59-proactive-rebuild-fallback-invocation-record-contract.md](../historical/specs/59-proactive-rebuild-fallback-invocation-record-contract.md)
- [21-proactive-read-write-policy-and-sampling.md](21-proactive-read-write-policy-and-sampling.md)
- [../historical/specs/60-proactive-read-admission-write-policy-contract.md](../historical/specs/60-proactive-read-admission-write-policy-contract.md)
- [../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md](../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md)
- [../adrs/0025-proactive-read-admission-history-and-fallback-invocation.md](../adrs/0025-proactive-read-admission-history-and-fallback-invocation.md)

## Purpose

Keep non-trivial read-admission decisions and chronology fallback invocations inspectable without
forcing every operator poll or every UI refresh into durable history.

## Scope And Non-Goals

This page covers:

- durable history for non-trivial read-admission outcomes
- durable visibility for chronology fallback invocations
- the split between ephemeral reads and operationally significant reads

This page does not cover:

- one analytics warehouse
- one dashboard implementation
- one HTTP audit endpoint
- one sampling policy for low-value reads

## Responsibilities

- keep serious read-admission decisions inspectable after the moment they occur
- preserve when deeper chronology was actually invoked
- avoid turning harmless polling into noisy append-only history by default
- keep automation-safe and audit-relevant reads more visible than casual operator peeks

## System Boundaries

This layer sits:

- above the canonical read-admission evaluator
- above current progress view and chronology fallback sources
- below downstream operator tools, automation products, and audit surfaces

It should not collapse into:

- no visibility at all for rejected or warned reads
- full logging of every harmless UI refresh
- one mutable audit row that overwrites prior admissions

## Primary Abstractions

- `ProactiveRebuildReadAdmissionRecord`
- `ProactiveRebuildFallbackInvocationRecord`
- ephemeral read
- durable non-trivial read
- chronology fallback execution

## Primary Flow

The stable flow should be read as:

`caller requests rebuild read -> canonical evaluator decides admit / warn / reject -> durable
 admission history is written when the read is operationally significant -> chronology fallback is
 invoked when required -> fallback invocation is durably recorded`

## Failure And Recovery Model

This layer has failed when:

- automation-safe reject paths leave no durable trail
- fallback happened but later cannot be reconstructed
- harmless operator refreshes flood history and drown meaningful events

Recovery means:

- non-trivial reads become append-only admission history
- chronology fallback invocations become append-only operational history
- low-value polling remains optional, sampled, or ephemeral

## Dependencies On Other Subsystems

- depends on the canonical read-admission evaluator
- depends on current rebuild progress and deeper chronology sources
- feeds operator audit, automation debugging, and recovery-forensics tooling

## What Is Still Delegated To Specs / ADRs

- the evaluator boundary remains in
  [../historical/specs/57-proactive-rebuild-read-admission-and-fallback-contract.md](../historical/specs/57-proactive-rebuild-read-admission-and-fallback-contract.md)
- durable admission history remains in
  [../historical/specs/58-proactive-rebuild-read-admission-record-contract.md](../historical/specs/58-proactive-rebuild-read-admission-record-contract.md)
- durable fallback invocation history remains in
  [../historical/specs/59-proactive-rebuild-fallback-invocation-record-contract.md](../historical/specs/59-proactive-rebuild-fallback-invocation-record-contract.md)
- write-policy semantics remain in
  [../historical/specs/60-proactive-read-admission-write-policy-contract.md](../historical/specs/60-proactive-read-admission-write-policy-contract.md)
  and
  [../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md](../historical/specs/61-proactive-fallback-invocation-write-policy-contract.md)
- the next subsystem page remains in
  [21-proactive-read-write-policy-and-sampling.md](21-proactive-read-write-policy-and-sampling.md)
- the design decision remains in
  [../adrs/0025-proactive-read-admission-history-and-fallback-invocation.md](../adrs/0025-proactive-read-admission-history-and-fallback-invocation.md)

## Core Rule

autokairos should durably preserve non-trivial read admission and chronology fallback, but it
should not require every low-value status glance to become permanent control-plane history.

## One Sentence Summary

autokairos should keep serious read-admission and fallback behavior audit-visible through
append-only records, while leaving harmless polling flexible and downstream.
