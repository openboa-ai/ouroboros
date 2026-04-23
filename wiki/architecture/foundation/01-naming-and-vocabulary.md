# Naming And Vocabulary Guide

This page defines the naming rules for autokairos.

It exists because the source layer uses overlapping terms for different layers, and several of the
current autokairos terms are local design choices rather than official upstream names.

It is grounded in:

- [../../sources/synthesis/agent-runtime-and-harness-principles.md](../../sources/synthesis/agent-runtime-and-harness-principles.md)
- [../../sources/synthesis/reference-systems-and-product-postures.md](../../sources/synthesis/reference-systems-and-product-postures.md)
- [../../sources/library/anthropic-managed-agents.md](../../sources/library/anthropic-managed-agents.md)
- [../../sources/library/anthropic-building-effective-agents.md](../../sources/library/anthropic-building-effective-agents.md)
- [../../sources/library/openai-next-evolution-of-the-agents-sdk.md](../../sources/library/openai-next-evolution-of-the-agents-sdk.md)
- [../../sources/library/openai-harness-engineering.md](../../sources/library/openai-harness-engineering.md)
- [../../sources/library/repo-anthropics-claude-code.md](../../sources/library/repo-anthropics-claude-code.md)
- [../../sources/library/repo-openclaw.md](../../sources/library/repo-openclaw.md)
- [../../sources/library/repo-multica.md](../../sources/library/repo-multica.md)

And it follows:

- [../00-first-principles-architecture-thesis.md](../specs/00-first-principles-architecture-thesis.md)
- [../02-core-primitives.md](../specs/02-core-primitives.md)
- [../04-boundaries.md](../specs/04-boundaries.md)

## Thesis

Naming is part of the architecture.

The source set makes this unavoidable:

- Anthropic uses `session`, `harness`, and `sandbox`
- OpenAI uses `harness`, `compute`, `manifest`, `session`, `state`, and `trace`
- Claude Code uses `CLAUDE.md`, `rules`, `skills`, `hooks`, `checkpoints`, `permissions`
- OpenClaw uses `Gateway`, `session`, `runtime`, `ACP`
- Multica uses `daemon`, `runtime`, `agent`, `task`, `autopilot`

If autokairos flattens these into one fuzzy vocabulary, the design will drift even if the diagrams
look clean.

## The Main Naming Risk

The biggest risk is not one bad noun.

It is using one noun for multiple layers.

The most overloaded words in the current design space are:

- `agent`
- `runtime`
- `session`
- `workspace`
- `approval`
- `governance`

So this guide does two things:

1. preserve source vocabulary when talking about the sources
2. define a smaller autokairos-local vocabulary for the system itself

## Rule 1: Keep Source Terms Source-Specific

When a document is talking about an upstream system, use that system's own terms.

Examples:

- use Anthropic's `session / harness / sandbox`
- use OpenAI's `harness / compute / manifest / session / state / trace`
- use Claude Code's `CLAUDE.md / rules / skills / hooks / checkpoints / permissions`
- use OpenClaw's `Gateway / ACP / session`
- use Multica's `daemon / runtime / task / autopilot`

Do not silently rewrite those into autokairos-local terms inside source notes.

That normalization belongs only in architecture documents and only when necessary.

## Rule 2: Use autokairos Terms Only For autokairos Objects

The following terms are the current autokairos-local canonical object language.

### Stable local terms

| Local term | Meaning | Why it stays |
| --- | --- | --- |
| `Candidate` | the promotable line of work | no good upstream universal equivalent |
| `Stage` | legitimacy level such as `backtesting`, `paper`, `live` | central product concept |
| `Trace` | raw external record of one execution attempt | aligned with OpenAI eval vocabulary and generally stable |
| `EvidenceRecord` | judged artifact derived from traces and evaluators | needed to keep judged evidence distinct from raw trace |
| `PromotionDecision` | explicit governance act over candidate standing | keeps progression explicit |
| `ReviewItem` | durable governance-work object before a decision is committed | keeps review work explicit |

### Stable system-layer terms

| Local term | Meaning | Why it stays |
| --- | --- | --- |
| `Control plane` | the subsystem that owns durable truth and governance records | clear systems term, not borrowed as a primitive from one source |
| `Runtime bridge` | stable interface between control plane and runtime execution | needed to avoid coupling to one runtime |
| `Execution driver` | environment-specific launcher/attachment layer | clarifies that the bridge and the concrete launcher are not the same |
| `ExecutionRequest` | governed invocation object before a live run exists | keeps invocation separate from concrete execution |
| `ExecutionAttempt` | durable record of one concrete execution try | keeps request intent separate from run history |

### Local terms that must be treated carefully

| Local term | Meaning | Risk |
| --- | --- | --- |
| `AgentIdentity` | durable acting identity across runs and stages | easy to confuse with the live runtime loop or with a product-level "agent" |
| `StageBinding` | resolved execution semantics attached to a stage | useful, but not an upstream-standard term |

These are still acceptable terms, but they must always be introduced as autokairos-local
abstractions, not as if they were standard industry vocabulary.

## Rule 3: Separate Identity, Loop, And Host

The word `agent` is too overloaded to use by itself for every layer.

So autokairos should distinguish:

| Term | What it means |
| --- | --- |
| `AgentIdentity` | the durable acting identity in the autokairos model |
| `runtime session` | the currently live harness/runtime loop |
| `agent system` | the execution subsystem that invokes, hosts, and traces the run |

This is why plain `Agent` should usually be avoided in architecture contracts unless the meaning is
obvious from context.

## Rule 4: Separate Session, Workspace, And Sandbox

These words must not be used interchangeably.

| Term | Meaning in autokairos |
| --- | --- |
| `Session` | continuity surface across runs |
| `Workspace` | bounded execution surface presented to the runtime |
| `sandbox` | source-specific term for the isolated compute environment or policy boundary around execution |

Practical rule:

- `Session` survives runs
- `Workspace` may be recreated
- `sandbox` describes the isolation posture or source-specific execution boundary

## Rule 5: Separate Approval From Promotion

This distinction is mandatory.

| Term | Meaning |
| --- | --- |
| `runtime approval` | local permission or approval during execution |
| `PromotionDecision` | explicit governance act that changes candidate standing |

The source layer already supports this split:

- Claude Code permissions are execution-local controls
- AAR/W2S and Paperclip-like systems push advancement into external review and decision surfaces

So docs must never imply that a runtime approval is equivalent to promotion governance.

## Rule 6: Use `governance` Carefully

`Governance` is a useful umbrella word, but too broad to be precise on its own.

When possible, prefer the more specific surface:

- `policy`
- `review`
- `decision`
- `audit`
- `promotion`

Use `governance` when referring to the whole family of these surfaces together.

## Naming Audit Of The Current Design

The current design is not fundamentally broken, but it has two real naming weaknesses.

### 1. Some local terms sound more universal than they are

This applies most to:

- `AgentIdentity`
- `StageBinding`

They are still acceptable, but they must be documented as local autokairos abstractions.

### 2. Some section titles are broader than the objects they discuss

Examples:

- `Agent System` is broader than `harness` or `runtime`, which is fine, but the docs must keep
  reminding the reader that it is a subsystem and not "the whole product."
- `Control plane` is also broader than any single upstream term, so it must keep being defined as
  the local ownership layer for durable truth and governance records.

## Names To Avoid

Avoid these unless they are explicitly source-specific.

- `harness` as the name for the whole autokairos product
- `runtime` as if it means the same thing as `driver`, `workspace host`, and `live loop`
- `session` when you really mean `workspace`
- `workspace` when you really mean durable truth
- `approval` when you really mean promotion
- `agent` when you really mean `AgentIdentity` or `runtime session`

## Canonical Vocabulary Snapshot

If a new architecture page needs a short canonical vocabulary, use this one.

- `AgentIdentity`
- `Candidate`
- `Stage`
- `StageBinding`
- `Session`
- `Workspace`
- `Runtime bridge`
- `Execution driver`
- `ExecutionRequest`
- `ExecutionAttempt`
- `Trace`
- `EvidenceRecord`
- `ReviewItem`
- `PromotionDecision`
- `Control plane`

## Summary

The current naming is directionally sound, but not yet self-defending.

The main fix is not a total rename pass.

The main fix is to make the naming contract explicit:

- preserve upstream vocabulary in source notes
- use autokairos-local names only for autokairos objects
- never collapse identity, runtime loop, workspace, and governance into one shared noun

That is the naming discipline the rest of the architecture should now follow.
