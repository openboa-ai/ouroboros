# First-Principles Architecture Thesis

This page is the shortest architectural statement for autokairos.

It does not define full schemas or implementation details. Its purpose is narrower:

- define what kind of system autokairos is
- define where autonomy belongs
- define where durable truth belongs
- define where governance belongs
- define what the architecture must refuse to become

Read this after:

- [00-mission-and-philosophy.md](00-mission-and-philosophy.md)
- [foundation/01-naming-and-vocabulary.md](../foundation/01-naming-and-vocabulary.md)

And before:

- [02-core-primitives.md](02-core-primitives.md)
- [04-boundaries.md](04-boundaries.md)

## Thesis

autokairos should be designed as a governed search system for AI-based trading.

That means the system is not centered on:

- one bot
- one chat loop
- one workspace
- one runtime process

It is centered on the combination of:

- persistent agent search
- bounded execution
- external evidence
- staged progression
- explicit governance

The shortest rule is:

> search may be cheap, but advancement must be expensive.

## Why This Spec Exists

This spec exists to pin down the shortest canonical answer to one question:

**what kind of system is autokairos before narrower contracts and subsystem design begin?**

It deliberately sits above object-level schemas and below broader mission framing.

## The Architectural Problem

Human-supervised AI trading is treated here as a weak-to-strong oversight problem.

Humans can supply:

- priors
- hypotheses
- constraints
- risk boundaries
- standards of evidence

But humans do not scale as the permanent source of ideas or the sole engine of iteration.

So the primary architectural question is not:

- can the system generate candidates?

It is:

- can stronger search happen without escaping external judgment, stage control, and promotion governance?

## The Four First Principles

Across the current source base, four principles recur strongly enough to be treated as
first-principles constraints.

### 1. The active runtime loop is not the whole system

Anthropic separates `session`, `harness`, and `sandbox`. OpenAI separates `harness` and
`compute`. Claude Code separates the loop from permissions, checkpoints, memory, and hooks.
OpenClaw separates Gateway ownership from runtime sessions. Multica separates daemon/runtime
activation from higher-level task and runtime records.

autokairos must preserve the same idea:

- the live loop is necessary
- the live loop is not the whole product

### 2. Durable truth must outlive the current workspace

The strongest common pattern in the sources is that important truth survives outside the current
execution environment.

What must survive one lost workspace, one lost container, or one lost runtime process:

- continuity
- raw run history
- judged evidence
- stage standing
- governance decisions

### 3. Evaluation is the scarce resource

AAR and W2S make this explicit. Once search gets cheaper, evaluation becomes the bottleneck.

So autokairos should optimize for:

- abundant exploration
- scarce advancement
- external evidence over narration

### 4. Governance belongs outside self-description

Runtime approvals, local guardrails, and execution-time permissions matter, but they are not the
same thing as progression governance.

Advancement, demotion, pause, rejection, and rollback must stay outside the runtime's own
self-description.

## Where The System Places Its Weight

The architecture should distribute responsibility like this.

| Concern | Where it belongs |
| --- | --- |
| search and action | inside bounded execution |
| continuity | outside any single workspace |
| raw run history | external trace surfaces |
| judged evaluation | external evidence surfaces |
| advancement and legitimacy | explicit governance surfaces |

This distribution is more important than any one runtime or tool choice.

## The Core System Shape

```mermaid
flowchart LR
    A["Governed invocation"] --> B["Bounded execution"]
    B --> C["External trace"]
    C --> D["Evidence and review"]
    D --> E["Promotion or rejection"]
```

This diagram is intentionally minimal.

It says:

- execution sits in the middle
- trace leaves execution
- judgment happens after execution
- advancement happens after judgment

## What This Spec Is Not

This spec is not:

- the full mission and philosophy narrative
- the primitive object catalog
- the runtime bridge contract
- the staged-evaluation contract
- the control-plane record model

## What autokairos Must Not Become

autokairos should not drift into any of these shapes:

- a chat-first trading bot
- a workspace-as-truth architecture
- a self-grading runtime
- a control plane hidden inside runtime prompts
- a UI-defined system of record

If the design drifts toward one of those, it is violating first principles rather than merely
choosing a different implementation.

## Design Consequence

If this thesis is correct, the next architectural work must answer four questions cleanly.

1. What are the smallest durable objects the system actually owns?
2. What are the smallest boundaries that must never collapse?
3. How does the agent system execute without becoming the control plane?
4. How does evaluation govern progression without depending on runtime-local truth?

Those questions are answered by:

- [02-core-primitives.md](02-core-primitives.md)
- [04-boundaries.md](04-boundaries.md)
- [agent-system/README.md](../agent-system/README.md)
- [evaluation-and-progression/README.md](../evaluation-and-progression/README.md)
- [control-plane/README.md](../control-plane/README.md)

## Failure Modes / Invariants

The core invariant of this spec is that execution, evidence, and governance must stay distinct.

The design is violating first principles if:

- the workspace becomes the source of truth
- the runtime loop becomes the whole product
- promotion is inferred from runtime-local state
- UI or prompt surfaces become the durable system of record

## Relationship To Adjacent Specs

This spec feeds directly into:

- [00-mission-and-philosophy.md](00-mission-and-philosophy.md)
- [02-core-primitives.md](02-core-primitives.md)
- [04-boundaries.md](04-boundaries.md)

The subsystem guides then elaborate those constraints in system form:

- [../agent-system/README.md](../agent-system/README.md)
- [../evaluation-and-progression/README.md](../evaluation-and-progression/README.md)
- [../control-plane/README.md](../control-plane/README.md)

## Source Basis

This thesis is grounded primarily in:

- [../sources/synthesis/agent-runtime-and-harness-principles.md](../../sources/synthesis/agent-runtime-and-harness-principles.md)
- [../sources/synthesis/evaluation-governance-and-promotion.md](../../sources/synthesis/evaluation-governance-and-promotion.md)
- [../sources/synthesis/reference-systems-and-product-postures.md](../../sources/synthesis/reference-systems-and-product-postures.md)

And under those pages, the deep notes in:

- [../sources/library/index.md](../../sources/library/index.md)
