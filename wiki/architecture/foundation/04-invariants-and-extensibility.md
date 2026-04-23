# Invariants And Extensibility

This page defines how autokairos should keep its upper layers strict enough to be governable but
flexible enough to evolve.

It is informed by:

- [OpenAI Agents SDK: Tools](https://openai.github.io/openai-agents-js/guides/tools/)
- [Claude Code: Scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)
- [OpenClaw: Automation](https://docs.openclaw.ai/automation)
- [Model Context Protocol: Schema Reference](https://modelcontextprotocol.io/specification/2025-06-18/schema)
- [Model Context Protocol: Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)

And it follows:

- [01-naming-and-vocabulary.md](01-naming-and-vocabulary.md)
- [02-documentation-doctrine.md](02-documentation-doctrine.md)
- [../specs/04-boundaries.md](../specs/04-boundaries.md)
- [../specs/30-event-log-first-durable-truth-posture.md](../specs/30-event-log-first-durable-truth-posture.md)

## Purpose

Define which upper-layer properties must remain invariant and which upper-layer mechanisms must
remain extensible.

## Scope And Non-Goals

This page covers:

- rigid architecture invariants for upper layers
- flexible mechanism zones for orchestration and control-plane design
- how canonical objects should avoid becoming a frozen product schema
- how extensibility should be expressed without losing provenance or governance

This page does not cover:

- one storage backend choice
- exact database tables
- one scheduler implementation
- one runtime-driver implementation

## Responsibilities

- define what upper layers are allowed to fix rigidly
- define what upper layers must leave extensible
- prevent the architecture from hardening into a workflow engine too early
- prevent flexibility from collapsing provenance, authority, or chronology

## System Boundaries

This doctrine applies primarily to:

- `proactive-operations/`
- `control-plane/`
- upper-layer supporting specs in `../specs/`

It constrains what those sections may treat as canonical.

## Primary Abstractions

- invariant
- mechanism
- extensible envelope
- registry or kind family
- declarative policy program
- read surface

## Primary Flows

The intended upper-layer design flow is:

`fix architecture invariants -> define extensible envelopes -> specialize through registries or policy -> project into operational read surfaces`

## Failure And Recovery Model

Upper-layer design has failed when either of these happens:

- too rigid:
  the architecture turns current record names, trigger kinds, or projection forms into permanent
  product truth
- too loose:
  provenance, authority, chronology, or governance boundaries become ambiguous

Recovery means:

- move rigid meaning back into invariants
- move mechanism-specific detail back into extensible envelopes, registries, or policy programs
- record the baseline change in an ADR when the invariant set changes

## Dependencies On Other Subsystems

This page depends on:

- foundation naming and documentation doctrine
- proactive operations for wake authority and trigger evolution
- control plane for durable truth and operational views

## What Is Still Delegated To Specs / ADRs

- narrow contracts remain in `../specs/`
- accepted doctrine shifts remain in `../adrs/`

## Thesis

Upper layers in autokairos should be designed as:

- **strict invariants**
- **flexible mechanisms**

The architecture should be rigid about what must remain true.

It should stay flexible about how evolving orchestration, policy, and operational surfaces are
expressed.

## What Must Stay Rigid

These upper-layer invariants should stay fixed unless an ADR explicitly changes them.

### Provenance

The system must preserve why something happened, not only that it happened.

### Authority

The system must preserve which surface was allowed to cause, approve, suppress, or constrain work.

### Chronology

The system must preserve append-only durable history where causality matters.

### Governance boundaries

Runtime execution, orchestration truth, evaluation, and promotion governance must not collapse into
one layer.

### Stage explicitness

Stage semantics must remain explicit and external, not implicit in one runtime mode or one
connector path.

## What Must Stay Flexible

These upper-layer mechanism zones should remain open to evolution.

### Trigger kinds

The current set of periodic, event-driven, and authority-driven wakes should not be treated as a
closed taxonomy forever.

### Policy expression

Wake policy and standing authority should remain declarative programs, not frozen row semantics.

### Projection form

Current-state surfaces should remain readable and governed, but their exact materialization form
should not become architectural truth.

### Backend and transport choices

Backend, queue, projection engine, and transport choices remain downstream of the architecture.

### Runtime integration shapes

The architecture should not assume one forever-stable runtime product, one forever-stable tool
registry, or one forever-stable driver inventory shape.

## Design Rules

### 1. Capability-first before object-catalog-first

Start by asking:

- what capability must exist?
- what invariant must it preserve?

Only then decide whether a named object deserves first-class status.

This keeps the upper layer from freezing current implementation detail into architecture.

### 2. Prefer extensible envelopes for changing upper-layer objects

When a family is expected to grow, prefer a stable outer envelope with versioned inner meaning.

Examples of stable outer fields:

- `kind`
- `scope`
- `authority`
- `cause`
- `payload`
- `schema_version`

The invariant is the envelope discipline and provenance requirement, not one permanently frozen set
of kinds.

### 3. Prefer registries and families over closed enums too early

Trigger families, standing-authority families, and similar orchestration concepts should usually be
treated as:

- named families
- registries
- policy-addressable kinds

not as permanently closed enumerations hard-coded into architecture doctrine.

### 4. Prefer declarative policy programs over fixed row meaning

`WakePolicy` and `StandingOrder` should be understood as declarative authority programs composed
from:

- selectors
- cadence or event predicates
- constraints
- expiry or review boundaries
- suppression or coalescing hints

not as one narrow object shape whose first implementation becomes permanent truth.

### 5. Prefer read surfaces over projection absolutism

Current-state projections are important, but the architecture should care more about what the
system must be able to read quickly than about one specific projection storage shape.

That means:

- `current standing` is important
- one exact projection table layout is not

### 6. Keep backend and runtime products downstream

Just as one database product must not become the architecture, one scheduler, runtime, or queue
product must not become it either.

## Anti-Patterns

These upper-layer anti-patterns are explicitly disallowed.

- turning current trigger kinds into a permanently closed taxonomy too early
- treating current projection rows as the canonical definition of truth
- baking one scheduler implementation into orchestration doctrine
- using object catalogs as a substitute for capability design
- confusing one implementation schema with one architecture invariant set

## One Sentence Summary

autokairos should keep upper-layer provenance, authority, chronology, and governance boundaries
rigid while keeping trigger families, policy programs, projection forms, and backend choices
extensible.
