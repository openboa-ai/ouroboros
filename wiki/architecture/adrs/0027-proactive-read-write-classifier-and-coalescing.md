# ADR 0027: Proactive Read Write Classifier And Coalescing

## Status

Accepted

## Context

autokairos already fixes:

- write-policy rules for read admission
- write-policy rules for fallback invocation

That still leaves two implementation gaps:

- how to classify concrete read behavior into one stable durability bucket
- how to suppress duplicate healthy success without erasing serious chronology

## Decision

autokairos will:

- place one canonical classifier in front of read-history writers
- allow coalescing only for narrow duplicate-success healthy operator reads
- keep warning, failure, automation-safe significance, and actual fallback chronology
  non-coalescible by default

The architecture keeps flexible:

- exact coalescing windows
- exact summarization/anchor formats
- exact persistence and exporter choices

But fixes:

- that write classification comes from one stable boundary
- that duplicate-success suppression stays narrow
- that serious chronology is never coalesced away by default

## Alternatives Considered

### 1. Let writers classify and coalesce ad hoc

Rejected because policy drift would spread across surfaces and backends.

### 2. Disable coalescing entirely

Rejected because healthy repetitive polling would still overwhelm higher-signal history.

### 3. Allow broad coalescing of successful reads regardless of class

Rejected because automation-safe and audit-relevant success can still be operationally important.

## Consequences

### Positive

- durability policy becomes easier to apply consistently
- duplicate healthy success can be controlled without weakening serious auditability
- serious fallback chronology stays visible

### Negative

- classifier and coalescing boundaries add more control-plane machinery
- implementations must carry bounded-window logic for low-value reads

## Supersedes / Superseded By

- Extends [0026-proactive-read-write-policy-and-sampling.md](0026-proactive-read-write-policy-and-sampling.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
