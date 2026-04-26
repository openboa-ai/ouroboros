# Standing Order Program Clause Model

This page defines the baseline clause model for `StandingOrder` as a declarative authority program.

It follows:

- [22-standing-order-contract.md](22-standing-order-contract.md)
- [20-governed-self-scheduling-contract.md](20-governed-self-scheduling-contract.md)
- [28-wake-policy-precedence-and-overlap-contract.md](28-wake-policy-precedence-and-overlap-contract.md)
- [../proactive-operations/06-clause-model-and-registries.md](../proactive-operations/06-clause-model-and-registries.md)

It is also informed by additional official documentation:

- [OpenClaw: Standing Orders](https://docs.openclaw.ai/automation/standing-orders)
- [OpenClaw: Automation & Tasks](https://docs.openclaw.ai/automation)
- [Claude Code: Automate work with routines](https://code.claude.com/docs/en/web-scheduled-tasks)
- [OpenAI Agents SDK: Running agents](https://openai.github.io/openai-agents-js/guides/running-agents/)

## Thesis

`StandingOrder` should be modeled as a stable envelope around a clause-composed authority program,
not as one closed catalog of permissible behavior.

## Why This Spec Exists

The standing-order contract already says the object is a durable authority program.

That is still too broad unless the architecture says what types of authority clauses must exist.

Without a clause model:

- "scope", "approval", and "escalation" stay prose-only
- mandatory obligations and soft preferences drift together
- self-scheduling bounds become ad hoc conditionals instead of explicit authority logic

## Canonical Object / Interface / Boundary

This spec defines the baseline clause model for `StandingOrder`.

The stable envelope owns:

- identity
- governed scope
- authority basis
- provenance
- lifecycle status

The inner program is composed from versioned authority clauses.

## Required Fields Or Required Behaviors

## 1. Required baseline clause families

A `StandingOrder` program should be able to compose these clause families.

### Scope selector clauses

Define the governed surface.

Examples:

- candidate or strategy family
- venue, asset, or market subset
- stage or environment scope

### Objective clauses

Define what program the authority exists for.

Examples:

- monitoring program
- reconciliation program
- alert-handling program

### Allowance clauses

Define what is permitted.

Examples:

- allowed trigger families
- allowed assets or signal families
- permitted cadence bands

### Obligation clauses

Define what is mandatory.

Examples:

- non-disableable risk wakeups
- minimum reporting or verification requirement
- required review classes

### Constraint and clamp clauses

Define what may not widen silently and how proposals should be limited.

Examples:

- cadence floor or ceiling
- clamp-on-tighten rule
- suppression ban for mandatory triggers

### Approval and escalation clauses

Define when work may auto-apply and when it must escalate.

Examples:

- approval gate for widening cadence
- escalation rule for unknown trigger family
- review requirement for live-stage authority changes

## 2. Required baseline clause examples

The first implementation should be able to express at least:

- `scope_selector_clause`
- `objective_clause`
- `allowed_trigger_family_clause`
- `asset_or_signal_scope_clause`
- `cadence_bound_clause`
- `mandatory_obligation_clause`
- `approval_gate_clause`
- `escalation_clause`
- `self_scheduling_rule_clause`
- `forbidden_action_clause`

These are baseline clause kinds, not a forever-closed list.

## 3. Registry posture

New standing-order clause kinds may be introduced if they:

- preserve authority interpretability
- remain evaluable against self-scheduling and wake-policy change proposals
- preserve precedence compatibility
- remain attributable to a schema or program version

## Lifecycle Or State Model

The `StandingOrder` envelope lifecycle still governs:

`created -> active -> paused | superseded | revoked`

The inner clause set should evolve by explicit supersession or replacement of the containing order,
not by silent drift in prose or runtime behavior.

## What This Is Not

This spec is not:

- one prose template for operator instructions
- one fixed YAML or markdown format
- a closed enum of all future authority clauses
- a substitute for progression governance

It defines baseline authority-program clause families only.

## Failure Modes / Invariants

### Invariants

- authority meaning remains decomposable into inspectable clauses
- mandatory obligations stay distinct from optional allowances
- escalation behavior stays explicit
- new clause kinds remain versioned and reviewable

### Failure modes

- all authority meaning lives only in prose blocks
- cadence limits, approval gates, and escalation rules are mixed into one opaque field
- self-scheduling auto-apply behavior cannot be traced back to explicit clauses
- new authority clauses break precedence or review routing unexpectedly

## Relationship To Adjacent Specs

- [22-standing-order-contract.md](22-standing-order-contract.md)
  defines the stable envelope and lifecycle the clause model lives inside.
- [20-governed-self-scheduling-contract.md](20-governed-self-scheduling-contract.md)
  defines the proposal object this authority program constrains.
- [21-wake-policy-contract.md](../../specs/21-wake-policy-contract.md)
  defines the downstream policy program constrained by these clauses.
- [33-wake-policy-program-clause-model.md](33-wake-policy-program-clause-model.md)
  defines the adjacent clause model for the wake-policy program itself.
