# ADR 0003: Persistent Operations Posture

## Status

`accepted`

## Context

autokairos is being designed for trading, where wake latency matters more than in many other agent
systems.

The challenge is to balance three constraints:

- the system must feel always operational
- the runtime loop must wake or resume quickly enough for the stage
- durable truth must not collapse into one immortal process or container

The source layer points in the same direction:

- Anthropic separates durable `session` from replaceable `harness` and `sandbox`
- OpenAI keeps session memory and resumable `state` outside the current run
- Docker restart and live-restore features reduce downtime but do not replace durable records

So autokairos needed an explicit posture for persistent operation before implementation starts.

## Decision

autokairos adopts an always-on substrate plus wakeable runtime posture.

The architecture will treat:

- control-plane records
- trace and audit sinks
- trading state ingestion
- risk and policy surfaces
- wake triggers and review triggers

as part of the always-on trading substrate.

The LLM-centered runtime loop will be treated as wakeable with explicit classes:

- `cold`
- `warm`
- `hot`

Default stage posture:

- `backtesting` -> `cold`
- `paper` -> `warm`
- `live` -> `warm` minimum, `hot` when justified

## Alternatives Considered

### 1. One immortal runtime process

Rejected because it would make truth and continuity drift into one lucky surviving process or
container.

### 2. Cold-start the full runtime stack for every action

Rejected because trading needs faster wake and more predictable operational readiness than that
posture provides.

### 3. Keep everything hot all the time

Rejected because it is operationally expensive and unnecessary for lower-risk stages such as
backtesting.

## Consequences

### Positive

- persistent operation becomes a property of the whole system
- runtime restart no longer implies truth loss
- stage-specific wake expectations become explicit
- the design can target fast wake without demanding an immortal harness

### Negative

- the architecture now has one more policy surface to manage
- implementation must classify hot, warm, and cold explicitly
- some operational complexity moves into substrate and wake management

## Supersedes / Superseded By

- Supersedes: none
- Superseded by: none

## Date / Owner

- Date: `2026-04-19`
- Owner: `autokairos architecture`
