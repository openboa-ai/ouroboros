# Naming And Vocabulary Guide

This page defines the naming rules for autokairos.

It exists because the source layer uses overlapping terms for different layers, and several of the
current autokairos terms are local design choices rather than official upstream names.

It is grounded in:

- [../../sources/synthesis/agent-runtime-and-harness-principles.md](../../sources/synthesis/agent-runtime-and-harness-principles.md)
- [../../sources/synthesis/reference-systems-and-product-postures.md](../../sources/synthesis/reference-systems-and-product-postures.md)
- [../../sources/library/anthropic-managed-agents.md](../../sources/library/anthropic-managed-agents.md)
- [../../sources/library/google-agent2agent-a2a.md](../../sources/library/google-agent2agent-a2a.md)
- [../../sources/library/anthropic-building-effective-agents.md](../../sources/library/anthropic-building-effective-agents.md)
- [../../sources/library/openai-next-evolution-of-the-agents-sdk.md](../../sources/library/openai-next-evolution-of-the-agents-sdk.md)
- [../../sources/library/openai-harness-engineering.md](../../sources/library/openai-harness-engineering.md)
- [../../sources/library/repo-anthropics-claude-code.md](../../sources/library/repo-anthropics-claude-code.md)
- [../../sources/library/repo-openclaw.md](../../sources/library/repo-openclaw.md)
- [../../sources/library/repo-multica.md](../../sources/library/repo-multica.md)

And it follows:

- [../00-first-principles-architecture-thesis.md](../historical/specs/00-first-principles-architecture-thesis.md)
- [../02-core-primitives.md](../specs/02-core-primitives.md)
- [../04-boundaries.md](../specs/04-boundaries.md)

## Thesis

Naming is part of the architecture.

The source set makes this unavoidable:

- Anthropic uses `Agent`, `Environment`, `Session`, `Events`, `session`, `harness`, and `sandbox`
- OpenAI uses `harness`, `compute`, `manifest`, `session`, `state`, and `trace`
- Claude Code uses `CLAUDE.md`, `rules`, `skills`, `hooks`, `checkpoints`, `permissions`
- OpenClaw uses `Gateway`, `session`, `runtime`, `ACP`
- Multica uses `daemon`, `runtime`, `agent`, `task`, `autopilot`
- Google A2A uses `AgentCard`, `Task`, `Message`, `Artifact`, and agent endpoints

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
- use Google A2A's `AgentCard / Task / Message / Artifact` when discussing the protocol

Do not silently rewrite those into autokairos-local terms inside source notes.

That normalization belongs only in architecture documents and only when necessary.

## Rule 2: Use autokairos Terms Only For autokairos Objects

The following terms are the current autokairos-local canonical object language.

### Stable local terms

| Local term | Meaning | Why it stays |
| --- | --- | --- |
| `TraderSystemCandidate` | the promotable candidate trading system under judgment | active meaning of Candidate |
| `TraderSystemSpec` | versioned runnable trader-system artifact | separates candidate identity from runnable artifact |
| `TraderSystemProgram` | agent-authored executable behavior bundle inside a trader-system spec | preserves open-ended W2S system generation without forcing a human-authored strategy DSL |
| `CapabilityPackage` | versioned context/tool/skill/data-access artifact | keeps packageable capability separate from secrets |
| `Stage` | product stage such as `backtest`, `paper`, `live` | central product concept |
| `StageBinding` | concrete environment injection for a stage | makes same-artifact execution possible across stages |
| `TraderSystemRuntime` | stage-bound execution instance assembled from trader-system spec, program, package, binding, brain, hands, and tool proxy | active execution unit |
| `AgentSpec` | configured agent participant definition, close to OpenAI / Claude / Google `Agent` concepts | separates participant configuration from execution |
| `AgentSession` | running participant context plus provider/driver selection inside or beside a runtime | preserves session continuity without making it durable product truth |
| `AgentRun` | one invocation or attempt inside or against an `AgentSession` | separates run purpose, status, failure, and output from session continuity |
| `AgentEvent` | provider-normalized raw event from an agent run or session | keeps Claude Events, Google ADK Events, OpenAI trace/span items, Codex events, and A2A updates outside counted evidence |
| `BrainSession` | provider/harness reasoning session | preserves Managed Agents brain/session distinction |
| `HandsEnvironment` | sandbox/tool/data/gateway environment | preserves Managed Agents hands distinction |
| `ToolProxy` | authority boundary around tools, credentials, and side effects | prevents direct credential or exchange authority inside packages |
| `RuntimeCommunicationPolicy` | one provider-neutral policy for communication, sharing, routing, and isolation between agent sessions | keeps A2A/provider-native communication explicit without making provider choice the policy |
| `SharedContextSurface` | non-secret shared context for multi-agent runtimes | prevents shared context from becoming a secret store |
| `Trace` | autokairos durable normalized history for one execution attempt or collaboration | separates raw provider events from durable system truth |
| `EvidenceRecord` | judged artifact derived from traces and evaluators | needed to keep judged evidence distinct from raw trace |
| `PromotionDecision` | explicit governance act over candidate standing | keeps progression explicit |
| `ReviewItem` | durable governance-work object before a decision is committed | keeps review work explicit |

### Stable system-layer terms

| Local term | Meaning | Why it stays |
| --- | --- | --- |
| `Control plane` | the subsystem that owns durable truth and governance records | clear systems term, not borrowed as a primitive from one source |
| `Runtime connector` | stable interface between control plane and runtime execution | needed to avoid coupling to one runtime |
| `Execution driver` | environment-specific launcher/attachment layer | clarifies that the bridge and the concrete launcher are not the same |
| `GovernedExecutionRequest` | governed invocation object before a live run exists | keeps invocation separate from concrete execution |
| `ExecutionAttempt` | durable record of one concrete execution try | keeps request intent separate from run history |

### Local terms that must be treated carefully

| Local term | Meaning | Risk |
| --- | --- | --- |
| historical acting identity terms | older durable-actor vocabulary | now secondary to `TraderSystemCandidate`, `BrainSession`, and `TraderSystemRuntime` |
| `Session` | source-specific or provider-specific continuity surface | easy to confuse with durable autokairos trace or runtime record |

These are still acceptable terms, but they must always be introduced as autokairos-local
abstractions, not as if they were standard industry vocabulary.

## Rule 3: Separate Candidate, Brain, Hands, Runtime, And ExecutionPod

The word `agent` is too overloaded to use by itself for every layer.

So autokairos should distinguish:

| Term | What it means |
| --- | --- |
| `TraderSystemCandidate` | the system under product judgment and promotion |
| `TraderSystemProgram` | the executable behavior bundle authored by an agent and run inside bounded hands environments |
| `BrainSession` | the model/harness reasoning session |
| `HandsEnvironment` | the sandbox/tool/data/gateway environment |
| `TraderSystemRuntime` | the stage-bound execution instance assembled from candidate artifact, capability, binding, brain, hands, and tool proxy |
| `AgentSpec` | configured participant definition |
| `AgentSession` | one running participant inside or beside a runtime, with its own brain/hands/session boundary |
| `AgentRun` | one invocation attempt with a slice-local purpose |
| `AgentEvent` | provider-normalized raw event emitted during a run/session |
| `agent-system` | the subsystem that invokes and manages brain/hands runtime behavior |

This is why plain `Agent` should usually be avoided in architecture contracts unless the meaning is
obvious from context.

Provider names such as Codex, Claude Code, Claude Managed Agents, OpenClaw/ACP, local container,
or A2A endpoint belong on `AgentSession.provider_kind`. The reason for a concrete invocation
belongs on `AgentRun.purpose`. Neither should become a runtime type or communication-policy name.

## Rule 4: Separate Agent Communication From Tools And Evidence

Google A2A adds another overloaded surface.

Use these terms carefully:

| Term | Meaning in autokairos |
| --- | --- |
| `A2AAgentEndpoint` | an independent remote agent endpoint discoverable through A2A-style metadata |
| `A2ATaskRecord` | a task/message exchange with an agent endpoint |
| `A2AArtifact` | output from an agent-to-agent task |
| `TeamTrace` | durable trace of multi-agent collaboration |

These are communication and trace terms.

They are not:

- `CapabilityPackage`
- `EvidenceRecord`
- `PromotionDecision`
- live execution authority

MCP/tool-proxy style terms should be used for tools, APIs, resources, and side effects. A2A-style
terms should be used only when the other participant is an agent system.

## Rule 5: Separate Session, Trace, Hands Environment, And Sandbox

These words must not be used interchangeably.

| Term | Meaning in autokairos |
| --- | --- |
| `BrainSession` | provider/harness reasoning continuity |
| `Trace` | durable raw event record outside the active brain context |
| `HandsEnvironment` | bounded execution surface presented to the runtime |
| `sandbox` | source-specific term for the isolated compute environment or policy boundary around execution |

Practical rule:

- provider session context is not autokairos truth
- `Trace` must survive the active run
- `HandsEnvironment` may be recreated
- `sandbox` describes the isolation posture or source-specific execution boundary

## Rule 6: Separate Approval From Promotion

This distinction is mandatory.

| Term | Meaning |
| --- | --- |
| `runtime approval` | local permission or approval during execution |
| `PromotionDecision` | explicit governance act that changes candidate standing |

The source layer already supports this split:

- Claude Code permissions are execution-local controls
- AAR/W2S and Paperclip-like systems push advancement into external review and decision surfaces

So docs must never imply that a runtime approval is equivalent to promotion governance.

## Rule 7: Use `governance` Carefully

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

### 1. Some historical local terms sound more universal than they are

This applies most to:

- historical acting identity terms
- `Session`

They may appear in historical docs, but active contracts should prefer `TraderSystemCandidate`,
`BrainSession`, `HandsEnvironment`, `TraderSystemRuntime`, and `StageBinding`.

### 2. Some section titles are broader than the objects they discuss

Examples:

- `Agent System` is broader than `harness` or `runtime`, which is fine, but the docs must keep
  reminding the reader that it is a subsystem and not "the whole product."
- `Control plane` is also broader than any single upstream term, so it must keep being defined as
  the local ownership layer for durable truth and governance records.

## Names To Avoid

Avoid these unless they are explicitly source-specific.

- `harness` as the name for the whole autokairos product
- `runtime` as if it means the same thing as `driver`, `hands environment`, and `live loop`
- `session` when you really mean `BrainSession` or `Trace`
- `hands environment` when you really mean durable truth
- `approval` when you really mean promotion
- `agent` when you really mean `TraderSystemCandidate`, `BrainSession`, `HandsEnvironment`, or
  `TraderSystemRuntime`
- `A2A` when you really mean tool access, evidence, or live authority

## Canonical Vocabulary Snapshot

If a new architecture page needs a short canonical vocabulary, use this one.

- `TraderSystemCandidate`
- `TraderSystemSpec`
- `CapabilityPackage`
- `Stage`
- `StageBinding`
- `TraderSystemRuntime`
- `AgentSpec`
- `AgentSession`
- `AgentRun`
- `AgentEvent`
- `BrainSession`
- `HandsEnvironment`
- `ToolProxy`
- `RuntimeCommunicationPolicy`
- `SharedContextSurface`
- `Runtime connector`
- `Execution driver`
- `GovernedExecutionRequest`
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
- never collapse candidate identity, brain session, hands environment, runtime, and governance
  into one shared noun

That is the naming discipline the rest of the architecture should now follow.
