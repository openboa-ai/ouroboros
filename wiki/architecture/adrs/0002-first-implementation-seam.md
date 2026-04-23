# ADR 0002: First Implementation Seam

## Status

`accepted`

## Context

autokairos already had a strong architectural spine for:

- bounded execution
- external trace
- staged progression
- runtime versus control-plane separation

But implementation could still drift in the wrong order.

The main risk was starting with one runtime wrapper or container launcher and letting that become
the de facto system of record. The source layer argues against that repeatedly:

- Anthropic keeps session outside harness and sandbox
- OpenAI keeps resumable state outside the current turn and keeps session as a persistent memory
  layer
- W2S treats the worker container as disposable and keeps legitimacy outside it
- Multica keeps task and runtime supervision outside the current CLI process

So autokairos needed one explicit decision about what gets coded before the first real runtime
integration.

## Decision

autokairos will start implementation from the smallest governed execution shell rather than from
the runtime bridge alone.

The first implementation seam is:

1. governed execution request
2. durable execution-attempt records
3. external trace sink

Only after those exist should autokairos implement:

4. stage-binding resolution
5. workspace materialization
6. container host
7. runtime bridge integration

The first serious execution posture remains:

- one stage: `backtesting`
- one serious execution mode: `containerized-local`

## Alternatives Considered

### 1. Start with the runtime bridge first

Rejected because it would push durable truth into whichever CLI, container, or harness wrapper got
built first.

### 2. Start with the container host first

Rejected because it proves only that a worker can start, not that autokairos owns continuity,
trace, or execution identity outside that worker.

### 3. Start with candidate/promotion workflows first

Rejected because progression logic depends on trustworthy execution and trace boundaries that do
not yet exist in code.

## Consequences

### Positive

- execution identity exists before runtime launch
- trace ownership is external from day one
- runtime drivers stay replaceable
- container loss does not imply truth loss
- later progression logic has a durable execution substrate to build on

### Negative

- the first runnable demo arrives later than a direct CLI wrapper would
- implementation must define more records before it can show visible agent output
- some early engineering work goes into infrastructure and record shape rather than user-visible
  behavior

## Supersedes / Superseded By

- Supersedes: none
- Superseded by: none

## Date / Owner

- Date: `2026-04-19`
- Owner: `autokairos architecture`
