# Mission And Philosophy

This page explains why autokairos should exist at all.

It sits above the primitive and boundary documents. Its job is not to define the object model in
detail. Its job is to clarify the project's mission, problem framing, and philosophical posture
before deeper architecture work proceeds.

For direct grounding, read:

- [../sources/library/anthropic-automated-alignment-researchers.md](../../sources/library/anthropic-automated-alignment-researchers.md)
- [../sources/library/anthropic-automated-w2s-researcher.md](../../sources/library/anthropic-automated-w2s-researcher.md)
- [../sources/library/anthropic-building-effective-agents.md](../../sources/library/anthropic-building-effective-agents.md)
- [../sources/synthesis/agent-runtime-and-harness-principles.md](../../sources/synthesis/agent-runtime-and-harness-principles.md)
- [../sources/synthesis/evaluation-governance-and-promotion.md](../../sources/synthesis/evaluation-governance-and-promotion.md)

## Thesis

autokairos exists to make persistent AI trading systems governable before they become powerful
enough to outrun weak human oversight.

## Why This Spec Exists

This spec exists to answer one question:

**why should autokairos exist, and what philosophical posture should constrain the rest of the
architecture?**

It should be read before narrower specs and before implementation planning.

## Mission

autokairos exists to build persistent AI trading systems that can search more aggressively than a
human can manually sustain, while remaining governable through external evaluation, staged
progression, and explicit promotion decisions.

The mission is not to remove human intent from the system. The mission is to move humans upward in
the system:

- away from being the permanent source of every idea
- away from being the sole engine of endless manual iteration
- toward defining objectives, constraints, risk boundaries, evaluation standards, and promotion
  conditions

autokairos is therefore a system for governed search, not just automated execution.

## Problem Framing

autokairos treats human-supervised AI trading as a weak-to-strong oversight problem.

In this framing:

- humans provide weak supervision through priors, taste, constraints, and risk boundaries
- agent systems search beyond what humans can manually generate or test
- the hard question is not whether agents can generate candidates
- the hard question is whether stronger search can remain inside external judgment and control

That changes the architectural problem.

The central problem is not:

- how to make one trading bot

The central problem is:

- how to let search scale without letting promotion, truth, and risk control collapse into the
  active agent loop

## Why This Domain Matters

Trading is not identical to Anthropic's research setting, but it has one unusually favorable
property: staged evaluation can be comparatively fast.

- `backtesting` provides cheap, high-volume rejection
- `paper` provides live-ish behavior without final real-money side effects
- `live` provides the risk-bearing environment

This means autokairos can be built around a staged evaluation ladder rather than a single binary
launch.

That matters because the source layer repeatedly suggests the same pattern:

- search gets cheaper first
- evaluation becomes the bottleneck
- progression must be governed explicitly

## Philosophical Position

autokairos assumes that in AI-based trading, search will scale faster than manual idea production.
That changes the human role.

Humans should not remain the permanent source of every trader-system candidate or the only engine
of iteration. Their role shifts upward:

- define the arena
- define the standards of evidence
- define the conditions under which a candidate may advance

The system must therefore support agent autonomy without surrendering control.

- agents need room to explore, branch, test, fail, retry, and act when the current stage allows it
- but they must do so inside bounded execution environments
- and the results of that execution must be judged from outside the workspace

The resulting posture is simple:

- generation should be cheap
- evaluation should be harder
- promotion should be explicit

## What The Source Layer Changes

The source layer has already forced several important conclusions.

### 1. Evaluation is the center of gravity

The AAR and W2S material strongly suggests that once search scales, evaluation becomes the scarce
resource. autokairos therefore should not organize itself around chat turns or runtime cleverness
first. It should organize itself around trustworthy evidence and progression.

### 2. Workspace is not truth

The runtime and harness material repeatedly separates execution from durable truth. The active
workspace may be useful, but it should not become the final authority on success, promotion, or
legitimacy.

### 3. Stage boundaries matter more than role splits

The source set does not justify hard-coding `research agent` and `execution agent` as separate
identities by default. It more strongly justifies one persistent agent operating under changing
stage bindings, permissions, and evaluators.

### 4. Governance belongs outside self-report

Promotion should not happen because the agent claims success. It should happen because external
evidence and explicit governance surfaces justify it.

### 5. Simplicity is a constraint

Anthropic's engineering guidance is important here: start with the simplest system that can work.
autokairos should resist unnecessary multi-agent theatrics, abstraction layers, and premature
product metaphors.

## Core Beliefs

1. One persistent agent should be able to search and act.
2. Workspaces are for bounded execution, not final truth.
3. A candidate should advance because evidence says it should, not because the agent says it did
   well.
4. Stage progression should control risk more than role decomposition does.
5. Governance should stay external to the active workspace.
6. Simplicity is part of the architecture, not just the implementation style.

## Non-Goals

autokairos is not trying to be:

- a single chat-first trading bot
- a UI-first product
- a system that trusts self-report over external evidence
- a system that defaults to separate research and execution agent identities
- a framework-heavy architecture before the core control surfaces are proven

## Where This Leads

If this philosophy is right, the architecture should naturally converge on:

- one persistent agent identity
- candidate lineage distinct from runtime continuity
- isolated execution workspaces
- staged progression through `backtesting -> paper -> live`
- external traces, evidence, and promotion decisions
- clear separation between runtime, control plane, and downstream presentation

Those conclusions are made concrete in:

- [00-first-principles-architecture-thesis.md](00-first-principles-architecture-thesis.md)
- [02-core-primitives.md](02-core-primitives.md)
- [03-staged-evaluation.md](03-staged-evaluation.md)
- [04-boundaries.md](04-boundaries.md)

## What This Spec Is Not

This spec is not:

- a runtime implementation plan
- a candidate or trace schema
- a promotion workflow contract
- a substitute for source notes or synthesis

## Failure Modes / Invariants

The main invariant of this spec is that human role shifts upward rather than disappearing.

The design is drifting away from this philosophy if:

- humans are modeled as the permanent source of every idea
- runtime-local success claims are treated as enough for advancement
- stage progression is treated as a convenience label rather than a legitimacy ladder
- the system is optimized for one bot instead of governed search

## Relationship To Adjacent Specs

This spec leads directly into:

- [00-first-principles-architecture-thesis.md](00-first-principles-architecture-thesis.md)
- [02-core-primitives.md](02-core-primitives.md)
- [03-staged-evaluation.md](03-staged-evaluation.md)
- [04-boundaries.md](04-boundaries.md)
