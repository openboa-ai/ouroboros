# ADR 0004: Production Agent Posture

## Status

`accepted`

## Context

The next implementation target in autokairos is no longer "an agent somehow."

It is a production trading agent.

The surrounding architecture work had already established:

- governed execution
- durable execution records
- external trace
- stage-bound execution
- wake posture
- external evaluation and promotion

What was still missing was a narrower decision about the actual agent to build next.

## Decision

autokairos will treat the next implementation target as one production agent subsystem with these
properties:

- one persistent acting identity
- governed invocation through `ExecutionRequest` and `ExecutionAttempt`
- explicit operational state machine
- stable domain-shaped tool surface
- layered guardrails at the tool boundary
- always-on substrate plus wakeable runtime
- external observability while active, paused, or degraded

The production agent is not defined as:

- a generic harness wrapper
- a stateless prompt runner
- a pair of separate research and execution identities
- one immortal runtime process

## Alternatives Considered

### 1. Keep designing only outer boundaries before centering the agent

Rejected because the boundary work is now sufficient to support direct agent design.

### 2. Treat the production agent as just one runtime integration detail

Rejected because the production agent has its own state, wake, guardrail, and observability
requirements that deserve canonical design treatment.

### 3. Split research agent and execution agent identities

Rejected because stage bindings and policy surfaces are a cleaner control mechanism than hard
identity splits.

## Consequences

### Positive

- the design now centers the actual software artifact to be built next
- production readiness becomes explicit in state, guardrails, and observability
- implementation can start from a clearer agent target

### Negative

- the architecture now needs more detailed agent-level specs
- production readiness requirements become stricter before coding can start

## Supersedes / Superseded By

- Supersedes: none
- Superseded by: none

## Date / Owner

- Date: `2026-04-19`
- Owner: `autokairos architecture`
