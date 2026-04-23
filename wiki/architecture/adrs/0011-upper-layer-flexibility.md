# ADR 0011: Upper-Layer Flexibility

## Status

accepted

## Context

As autokairos expanded its proactive-operations and control-plane design, the architecture gained:

- more record families
- more named orchestration objects
- more current-state surfaces

That improved precision, but it also introduced a risk:

the upper layers could harden into a fixed workflow-engine schema too early.

The system still needs flexibility to evolve:

- wake-trigger kinds
- policy languages
- projection forms
- backend and transport choices
- runtime integration shapes

without losing the invariants that make the system governable.

## Decision

autokairos will treat upper layers as:

- strict about invariants
- flexible about mechanisms

The invariant set includes:

- provenance
- authority
- chronology
- governance boundaries
- explicit stage boundaries

The extensible mechanism set includes:

- trigger kinds
- policy expression
- projection form
- backend and transport choices
- runtime integration shapes

Upper-layer design should therefore prefer:

- capability-first reasoning
- extensible envelopes
- registries or kind families where change is expected
- declarative policy programs
- read-surface thinking instead of projection absolutism

## Alternatives Considered

### 1. Keep refining fixed upper-layer object catalogs

This improves short-term clarity but risks freezing current implementation detail into the
architecture.

### 2. Leave upper-layer flexibility implicit

This keeps docs shorter but makes future rigidity harder to detect and easier to justify
accidentally.

### 3. Make the whole upper layer schema-free

This preserves evolution freedom but weakens provenance, authority, and governance discipline too
much.

## Consequences

Positive consequences:

- upper layers stay adaptable as proactive-agent patterns evolve
- implementation can choose envelopes, registries, and policy forms without violating doctrine
- current record families are interpreted as invariant buckets, not frozen product schema

Negative consequences:

- some existing specs must now be read as current canonical baselines rather than permanently
  closed taxonomies
- future specs must be clearer about what is invariant versus what is only one implementation
  shape

## Supersedes / Superseded By

- supersedes: none
- superseded by: none

## Date / Owner

- date: 2026-04-19
- owner: Codex
