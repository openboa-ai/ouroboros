# Wake Policy Program Clause Model

This page defines the baseline clause model for `WakePolicy` as a declarative program.

It follows:

- [21-wake-policy-contract.md](../../specs/21-wake-policy-contract.md)
- [19-wake-orchestration-and-trigger-model.md](19-wake-orchestration-and-trigger-model.md)
- [28-wake-policy-precedence-and-overlap-contract.md](28-wake-policy-precedence-and-overlap-contract.md)
- [../proactive-operations/06-clause-model-and-registries.md](../proactive-operations/06-clause-model-and-registries.md)

It is also informed by additional official documentation:

- [Claude Code: Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks)
- [Claude Code: Automate work with routines](https://code.claude.com/docs/en/web-scheduled-tasks)
- [OpenAI Agents SDK: Tools](https://openai.github.io/openai-agents-js/guides/tools/)
- [MCP Schema Reference](https://modelcontextprotocol.io/specification/2025-06-18/schema)

## Thesis

`WakePolicy` should be modeled as a stable envelope around a clause-composed declarative program,
not as one closed row schema.

## Why This Spec Exists

The `WakePolicy` contract already says the object is a policy program.

That is still too vague unless the architecture says what kinds of clauses the program is expected
to contain.

Without a clause model:

- cadence and event logic blur together
- delivery and dedupe behavior become ad hoc flags
- future trigger families become schema migrations instead of extensible clause growth

## Canonical Object / Interface / Boundary

This spec defines the baseline clause model for `WakePolicy`.

The stable envelope owns:

- identity
- scope
- authority basis
- provenance
- lifecycle status

The inner program is composed from versioned clauses.

## Required Fields Or Required Behaviors

## 1. Required baseline clause families

A `WakePolicy` program should be able to compose these clause families.

### Scope selector clauses

Define what governed scope the policy applies to.

Examples:

- candidate-specific scope
- agent-specific scope
- account or venue subset

### Trigger clauses

Define which trigger families may activate the policy.

Examples:

- heartbeat cadence trigger
- exact scheduled trigger
- event-driven trigger
- one-shot follow-up trigger

### Timing clauses

Define when the policy is allowed to operate.

Examples:

- active market-hours window
- weekend exclusion
- policy expiry

### Delivery clauses

Define how resulting work should be delivered.

Examples:

- main-context turn
- detached execution
- explicit suppression or no-op under certain conditions

### Constraint clauses

Define operating bounds and control knobs.

Examples:

- dedupe window
- catch-up policy
- jitter or approximate posture
- freshness requirement

## 2. Required baseline clause examples

The first implementation should be able to express at least:

- `cadence_clause`
- `event_watch_clause`
- `active_window_clause`
- `delivery_clause`
- `dedupe_clause`
- `catch_up_clause`
- `expiry_clause`

These are baseline clause kinds, not a forever-closed list.

## 3. Registry posture

New clause kinds may be introduced if they:

- fit an existing clause family or create a justified new family
- preserve precedence compatibility
- preserve provenance and durable explainability
- remain attributable to a schema or program version

## Lifecycle Or State Model

The `WakePolicy` envelope lifecycle still governs:

`created -> enabled -> paused | superseded | expired | revoked`

The inner clause set may evolve by supersession or replacement of the containing policy rather than
by silent mutation of historical meaning.

## What This Is Not

This spec is not:

- a scheduler implementation
- one SQL or document schema
- a closed enum of all future wake clauses
- a permission to hide wake logic inside runtime code

It defines baseline clause families for the policy program only.

## Failure Modes / Invariants

### Invariants

- `WakePolicy` meaning stays decomposable into explainable clauses
- cadence, event, delivery, and constraint semantics stay distinct
- new clause kinds remain versioned and precedence-compatible

### Failure modes

- every new trigger family requires a redesign of the whole policy object
- one giant opaque JSON blob becomes the only meaning surface
- delivery or dedupe logic is hidden outside the policy program
- clause additions break overlap resolution or provenance

## Relationship To Adjacent Specs

- [21-wake-policy-contract.md](../../specs/21-wake-policy-contract.md)
  defines the stable envelope and lifecycle the clause model lives inside.
- [19-wake-orchestration-and-trigger-model.md](19-wake-orchestration-and-trigger-model.md)
  defines the baseline trigger families these clauses may reference.
- [28-wake-policy-precedence-and-overlap-contract.md](28-wake-policy-precedence-and-overlap-contract.md)
  constrains which clause kinds are safe to add.
- [34-standing-order-program-clause-model.md](34-standing-order-program-clause-model.md)
  defines the adjacent authority-program clause model that constrains this policy.
