# Policy Programs And Extensibility

This page defines how proactive authority should stay governable without hardening too early into a
fixed orchestration schema.

It follows:

- [01-overview.md](01-overview.md)
- [03-governed-self-scheduling.md](03-governed-self-scheduling.md)
- [04-precedence-and-overlap.md](04-precedence-and-overlap.md)
- [../foundation/04-invariants-and-extensibility.md](../foundation/04-invariants-and-extensibility.md)
- [../specs/21-wake-policy-contract.md](../specs/21-wake-policy-contract.md)
- [../specs/22-standing-order-contract.md](../specs/22-standing-order-contract.md)

## Purpose

Explain how proactive authority should be modeled as declarative programs with extensible envelopes
rather than as a prematurely frozen object taxonomy.

## Scope And Non-Goals

This page covers:

- why proactive authority should be read as programmatic
- which parts of proactive objects should stay stable
- which parts should stay extensible
- how registries and family kinds should evolve safely

This page does not cover:

- one scheduler implementation
- exact table layouts
- one expression language
- one serialization format

## Responsibilities

- keep proactive authority legible without over-freezing it
- define the outer-envelope versus inner-program distinction
- define how trigger, policy, and change families should evolve
- keep provenance, authority, and chronology rigid while letting mechanism detail evolve

## System Boundaries

This page sits between:

- foundation doctrine about invariants and extensibility
- lower-level proactive specs for wake policy, standing orders, and self-scheduling

It is upstream of:

- concrete orchestration implementations
- control-plane storage choices

## Primary Abstractions

- outer envelope
- declarative program
- family registry
- baseline family
- extensible parameters

## Primary Flows

The core proactive-authority flow should be read as:

`stable envelope -> family-specific declarative program -> precedence and authority evaluation -> durable history and projections`

## Failure And Recovery Model

This layer has failed when:

- a first implementation row shape becomes permanent architecture truth
- every new trigger or policy kind requires redesigning the whole subsystem
- family evolution becomes so loose that provenance and authority cannot be reconstructed

Recovery means:

- move rigidity back into envelopes and invariants
- move mechanism detail into program clauses and family registries
- record any real invariant change in an ADR

## Dependencies On Other Subsystems

- depends on foundation for invariants and extensibility doctrine
- depends on control plane for durable truth and audit
- depends on trading substrate for signal families
- feeds the agent system through governed execution requests

## What Is Still Delegated To Specs / ADRs

- exact object contracts remain in `../specs/`
- durable doctrine shifts remain in `../adrs/`

## Core Claim

`WakePolicy` and `StandingOrder` should be read as:

- durable envelopes with stable provenance and authority meaning
- declarative programs whose internal clauses can evolve

They should not be read as one narrow row schema whose first implementation becomes permanent
architecture truth.

## Outer Envelope Versus Inner Program

### Outer envelope should stay stable

The outer layer should preserve:

- durable identity
- governed scope
- authority basis
- provenance
- status
- effective window
- schema or program version

### Inner program may evolve

The inner program may vary by family and version.

Examples:

- periodic cadence clauses
- event predicate clauses
- suppression or coalescing hints
- escalation clauses
- delivery posture clauses
- mandatory-obligation clauses

## Baseline Families Versus Closed Taxonomies

The current proactive design has useful baseline families.

Examples:

- periodic monitoring
- event-driven wakes
- one-shot follow-up work
- standing authority for mandatory or forbidden behavior

These should be treated as:

- baseline family registries

not as:

- permanently closed enums

That means a future trigger or policy family may be added if it still preserves:

- provenance
- authority
- chronology
- precedence compatibility

## Preferred Design Style

### Capability-first

Ask first:

- what must the system be able to authorize?
- what must the system be able to suppress?
- what must the system be able to explain later?

Only then decide which named object or family needs a first-class contract.

### Declarative over imperative

The proactive layer should prefer declarative statements of:

- what to watch
- when to watch
- what to suppress
- what must escalate

over imperative scheduler-owned behavior hidden inside runtime code.

### Registry over ad hoc special cases

If a family is expected to grow, new meaning should usually enter through:

- family kind
- versioned clause set
- explicit precedence compatibility

not through one-off undocumented flags.

## One Sentence Summary

autokairos should model proactive authority as stable, auditable envelopes around extensible
declarative programs rather than as a permanently closed orchestration schema.
