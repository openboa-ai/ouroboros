# Diagramming And Views

This page defines how autokairos should use diagrams and architectural views.

It is informed by:

- [C4 model: Home](https://c4model.com/)
- [C4 model: Diagrams](https://c4model.com/diagrams)
- [C4 model: Abstractions](https://c4model.com/abstractions)
- [C4 model: Tooling](https://c4model.com/tooling)

And it follows:

- [02-documentation-doctrine.md](02-documentation-doctrine.md)
- [../00-system-map.md](../00-system-map.md)

## Thesis

autokairos should use diagrams as structured views, not as decoration.

The repository should prefer a small number of stable diagram types that answer different questions
at different zoom levels.

## Why Views Matter

One diagram cannot serve all readers.

The same system needs different views for:

- project orientation
- subsystem boundaries
- dynamic runtime behavior
- deployment and legitimacy posture

That is why autokairos adopts a C4-style view hierarchy instead of one diagram style for every
page.

## Default View Set

These are the default long-lived view types for autokairos.

### 1. System context

Use when the question is:

> what is autokairos, and how does it relate to external actors and systems?

Typical elements:

- autokairos
- external runtimes or harnesses
- external venues, evaluators, storage, or operators

### 2. Container-level view

Use when the question is:

> what are the major executable or durable parts inside the system?

Typical autokairos elements:

- control plane
- runtime connector
- workspace host
- evaluator surfaces
- trace sink
- record stores

### 3. Component-level view

Use only when the subsystem is too complex for container-level explanation alone.

Typical examples:

- governance surfaces inside the control plane
- execution stages inside the agent subsystem

This level is optional, not mandatory.

### 4. Dynamic view

Use when the question is about sequence or lifecycle.

Typical examples:

- agent execution lifecycle
- evaluation flow
- review and decision path
- resume after interruption

### 5. Deployment view

Use when infrastructure posture matters to legitimacy or operations.

Typical examples:

- `host-local` versus `containerized-local` versus `containerized-remote`
- bind mounts and external trace sinks
- local support stack versus worker containers

## Views To Avoid By Default

These views are not default canonical architecture artifacts.

### Code-level class diagrams

Do not keep long-lived class or method diagrams in canonical architecture docs.

Reason:

- they go stale quickly
- IDEs and code browsing are better sources for that level
- they confuse architecture with implementation detail

### Decorative relationship maps

Do not add diagrams that merely restate bullet lists.

If the diagram does not answer a concrete architectural question, omit it.

## View Selection Matrix

| Question | Preferred view |
| --- | --- |
| What is the system boundary? | system context |
| What are the major subsystems or runtime surfaces? | container-level |
| How does one subsystem internally decompose? | component-level |
| What happens over time? | dynamic |
| What runs where, and under which execution posture? | deployment |

## Mermaid Policy

autokairos uses Mermaid for canonical long-lived diagrams by default.

Rules:

- prefer Mermaid for diagrams committed in markdown
- keep node labels descriptive and stable
- use explicit arrow directions only when they communicate meaning
- do not overload one diagram with multiple stories
- prefer one diagram per question
- update the diagram in the same change as the surrounding text when the design changes

## Runtime Diagram Policy

Runtime architecture diagrams must separate four concerns:

- durable product/control-plane truth
- logical runtime identity
- physical execution placement
- external authority boundaries

Do not combine those concerns into one large diagram unless the page is explicitly introducing a
map of maps.

The canonical runtime diagram set is:

| Diagram | Question |
| --- | --- |
| System boundary | What does autokairos own versus borrow? |
| Durable object model | What is official product/control-plane truth? |
| Logical versus physical execution | What is `TraderSystemRuntime` versus `RuntimePlacement`? |
| Runtime autonomy boundary | How does autonomous behavior stay bounded? |
| Stage progression | How does one artifact run under backtest, paper, and live bindings? |
| Live authority | Who can accept, reject, clip, or submit orders? |
| Recovery | What survives process, provider, or container failure? |
| Bootstrap substrate | What minimal code substrate exists before PR1? |

Forbidden runtime diagram patterns:

- using any pod-named term as durable logical product truth
- drawing a stage binding as if it creates a runtime by itself
- drawing provider sessions as if they write candidate, evidence, promotion, or execution truth
- using PR sequence as the main explanation of runtime architecture
- mixing delivery process, object model, execution placement, and trading authority in one diagram

## Diagram Quality Rules

Every canonical diagram should satisfy these rules.

- It has a named scope.
- It answers one primary question.
- It has labels that use repository vocabulary correctly.
- It does not rely on color or styling alone to communicate meaning.
- It is small enough to read in the markdown file without zoom gymnastics.
- Its accompanying prose explains why the view exists.

## Ownership And Maintenance

Diagrams are part of canonical design, not slideware.

Therefore:

- subsystem diagrams are owned by the same canonical page that explains them
- a diagram should not be copied into multiple pages unless the pages serve clearly different audiences
- when a decision changes the view materially, the relevant ADR should be linked or updated

## autokairos Default Policy

The repository should prefer:

- system context diagrams in root or section entry pages
- container-level diagrams in subsystem overview pages
- dynamic diagrams in flow and lifecycle pages
- deployment diagrams only where execution legitimacy depends on infrastructure posture

The repository should rarely use:

- component-level diagrams

The repository should avoid:

- code-level long-lived architecture diagrams

## Summary

autokairos uses diagrams as a hierarchy of views.

The default canonical set is:

- system context
- container-level
- dynamic

Component and deployment views are optional and should be used only when they add real value.
