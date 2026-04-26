# ADR 0028: Proactive Read Durability And Recovery

## Status

Accepted

## Context

autokairos already fixes:

- one canonical write classifier
- narrow duplicate-success suppression

That still leaves one bigger durability gap.

The architecture needs a stable place where:

- serious reads bypass coalescing
- low-value healthy duplicate-success reads may share bounded operational suppression
- suppressed healthy periods still become durably visible
- restart and shutdown may lose optimization state without endangering durable truth

## Decision

autokairos will:

- place one canonical durability layer between read classification and final history writing
- treat healthy duplicate-success suppression as bounded, resettable operational state
- require suppressed healthy continuity to reappear through durable visibility
- allow restart to lose optimization state while forbidding fabricated chronology

The architecture keeps flexible:

- exact worker model
- exact persistence shape for optimization state
- exact visibility record shape
- exact loop or retry implementation

But fixes:

- that serious chronology bypasses coalescing
- that optimization state is not canonical durable truth
- that suppressed healthy periods still leave durable visibility
- that restart does not get to invent chronology it cannot prove

## Alternatives Considered

### 1. Let writers and loops manage durability details independently

Rejected because behavior would drift and serious chronology might be suppressed inconsistently.

### 2. Make optimization state durable truth

Rejected because coalescing is an optimization and visibility layer, not a source of truth.

### 3. Leave recovery semantics implementation-defined

Rejected because restart and shutdown behavior would later hard-code backend assumptions into the
architecture.

## Consequences

### Positive

- coalescing stays coordinated and bounded
- serious chronology remains protected
- healthy repeated reads can stay lightweight without becoming invisible
- restart remains safe even when optimization state is lost

### Negative

- one explicit durability boundary is required
- lower-level loop and view details are intentionally left to later implementation design

## Supersedes / Superseded By

- Extends [0027-proactive-read-write-classifier-and-coalescing.md](0027-proactive-read-write-classifier-and-coalescing.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-20
- Owner: Codex
