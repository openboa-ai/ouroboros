# Documentation Doctrine

This page defines what counts as a real autokairos document.

It is informed by:

- [arc42: Why arc42](https://arc42.org/why)
- [C4 model: Home](https://c4model.com/)
- [AWS Prescriptive Guidance: ADR Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/best-practices.html)
- [GitLab Handbook: Architecture Design Workflow](https://handbook.gitlab.com/handbook/engineering/architecture/workflow/)

And it follows:

- [01-naming-and-vocabulary.md](01-naming-and-vocabulary.md)
- [03-diagramming-and-views.md](03-diagramming-and-views.md)
- [04-invariants-and-extensibility.md](04-invariants-and-extensibility.md)

## Thesis

autokairos should not be documented as `architecture first`.

It should be documented as:

`sources -> strategy -> MLP -> PRD -> architecture -> specs -> ADRs -> implementation`

Product truth must exist before technical design becomes canonical.

## Why This Doctrine Exists

Without a doctrine, this repository drifts into three failures.

- architecture expands before product value is explicit
- implementers must infer user pain from subsystem docs
- specs multiply because future detail feels interesting, not because current product work needs them

autokairos should avoid that failure pattern.

## Canonical Document Families

| Document family | Primary purpose | Canonical location | Prescriptive? |
| --- | --- | --- | --- |
| `Source Note` | Preserve external material neutrally | `wiki/sources/library/` | no |
| `Synthesis` | Normalize and compare sources | `wiki/sources/synthesis/` | partly |
| `Product Strategy` | Define the target user, wedge, and strategic direction | `wiki/product/00-product-strategy.md` | yes |
| `Product Principles` | Define product rules downstream docs must respect | `wiki/product/01-product-principles.md` | yes |
| `MLP` | Define the first lovable product promise | `wiki/product/mlp-01/00-mlp-brief.md` | yes |
| `PRD` | Define one user-journey product contract | `wiki/product/mlp-01/prds/` | yes |
| `System Map` | Explain the reading order and system split | `wiki/architecture/00-system-map.md` | yes |
| `Subsystem Design` | Define one technical subsystem | `wiki/architecture/<subsystem>/` | yes |
| `Spec` | Define a narrow implementation-critical contract | `wiki/architecture/specs/` | yes |
| `ADR` | Preserve one major decision and its rationale | `wiki/architecture/adrs/` | yes |
| `Implementation Plan` | Define build order and acceptance before code | product or architecture layer, as appropriate | yes |
| `Runbook` / `Operator Guide` | Explain live operational procedure after implementation | later, if needed | operational |

## Product-First Hierarchy

The canonical hierarchy is now:

1. `sources`
   What the references say
2. `strategy`
   What market, user, wedge, and product rules autokairos is choosing
3. `MLP`
   What first lovable product autokairos is committing to
4. `PRD`
   What user journeys must actually work
5. `architecture`
   How the system will make those journeys real
6. `spec`
   Only the lower-level contracts needed to build active PRD work safely
7. `ADR`
   Why major choices were made
8. `PR`
   One delivery unit that closes a real PRD milestone

## One Document, One Question

Each canonical document should answer one primary question.

Examples:

- `What is the first lovable product?`
- `What must happen from agent-originated hypothesis to live trade?`
- `How does the trading substrate support that product journey?`
- `Why did we choose this documentation system?`

## Required Separation

The following separations are mandatory.

### Research versus product truth

- sources preserve evidence and synthesis
- product docs define what users need and what must matter

### Product truth versus technical design

- `MLP` and `PRD` define the product contract
- architecture defines how that contract will be implemented

### Structure versus decision history

- subsystem docs and specs define the current technical shape
- ADRs explain why specific major choices were made

## Required Templates

### MLP template

Each `MLP` should contain:

- Product promise
- Primary user
- Core pain
- Why this hurts
- Lovable moment
- Product scope and non-goals
- Hard constraints from research
- Success criteria
- What architecture must respect

### PRD template

Each `PRD` should contain:

- Problem
- Why this matters
- User trigger
- Desired outcome
- In-scope behavior
- Out-of-scope behavior
- What must feel lovable
- Critical constraints
- Failure scenarios
- Acceptance criteria
- Metrics / proof
- Subsystem impact map
- PR slicing guidance

### Subsystem Design template

Each subsystem design should contain:

- Purpose
- Scope and non-goals
- Responsibilities
- System boundaries
- Primary abstractions
- Primary flows
- Failure and recovery model
- Dependencies on other subsystems
- What is still delegated to specs or ADRs

### Spec template

Each spec should contain:

- Thesis
- Why this spec exists
- Canonical object, interface, or boundary
- Required fields or required behaviors
- Lifecycle or state model
- What this is not
- Failure modes or invariants
- Relationship to adjacent specs

### ADR template

Each ADR should contain:

- Status
- Context
- Decision
- Alternatives considered
- Consequences
- Supersedes / superseded by
- Date / owner

### Implementation Plan template

Each implementation plan should contain:

- Goal
- Build order
- Interfaces to define first
- Risks and failure modes
- Test and acceptance criteria
- Explicitly deferred items

## Spec Creation Gate

Specs should not be created merely because a lower-level question exists.

A spec is justified only when:

- an active PRD needs implementation precision, or
- a cross-cutting invariant would otherwise be violated

The following are not sufficient reasons by themselves:

- it might matter later
- the internal taxonomy feels incomplete
- the detail is interesting

## Review Rules

- prefer improving the smallest canonical page that owns the question
- product value belongs in `MLP` and `PRD`, not hidden in subsystem prose
- architecture should point back to product truth rather than re-invent it
- one PR should close one PRD milestone whenever possible
- major design decisions should live in ADRs
- if structure changes materially, update `knowledge-index.md`, append to `knowledge-log.md`, and update the nearest `AGENTS.md`

## Development Workflow

autokairos should now flow like this:

1. source research
2. synthesis
3. `MLP`
4. `PRD`
5. architecture
6. spec
7. ADR
8. implementation plan
9. PR / code
10. post-code reconciliation

Implementation should not be the place where product meaning or architectural boundaries are first discovered.
