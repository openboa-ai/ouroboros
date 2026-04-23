# ADR 0008: Wake-Policy Precedence

## Status

accepted

## Context

autokairos now explicitly supports:

- periodic wake policy
- event-driven wake policy
- one-shot follow-up wake
- governed self-scheduling
- standing-order authority above all of them

That means overlap is no longer hypothetical.

Without an explicit rule, the architecture would rely on:

- scheduler implementation order
- whichever trigger arrives first
- runtime-local debounce logic
- undocumented operator intuition

None of those are durable enough for a living trading system.

## Decision

autokairos adopts a deterministic wake-precedence model.

Overlap must be resolved in this order:

1. authority first
2. scope specificity second
3. trigger urgency third
4. coalescing and dedupe last

This implies:

- more restrictive standing-order authority beats more permissive policy
- narrower scope beats broader scope without widening authority
- explicit one-shot or event-driven work beats ambient recurring observation
- identical resulting work should be coalesced into one primary execution request
- all suppressed or coalesced candidates must remain durably visible

## Alternatives considered

### 1. First trigger wins

Rejected because timing race is not a durable governance rule.

### 2. Most recent policy wins

Rejected because recency alone does not encode scope specificity or authority bounds.

### 3. Scheduler-specific resolution only

Rejected because overlap resolution would then live in implementation details instead of canonical
 architecture truth.

### 4. No explicit overlap support

Rejected because living proactive systems inevitably accumulate overlapping periodic, event, and
 follow-up wake candidates.

## Consequences

Positive:

- overlap becomes explainable and auditable
- self-scheduling can coexist with standing authority without hidden races
- duplicate emitted work is reduced without losing trigger history
- mandatory risk wakeups are protected from cadence convenience

Negative:

- proactive orchestration becomes more opinionated
- control-plane records and wake-trigger history need richer suppression reasons
- implementers must follow the precedence contract instead of inventing local shortcuts

## Supersedes / superseded by

- supersedes: none
- superseded by: none

## Date / owner

- date: 2026-04-19
- owner: Codex
