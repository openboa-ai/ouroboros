# Managed Agent And Provider Analysis

This document focuses specifically on managed-agent architecture, provider abstraction, and auth
boundaries for AutoKairos.

Accessed on April 9, 2026.

## Sources

1. Anthropic, `Claude Managed Agents: get to production 10x faster`
   URL: https://claude.com/blog/claude-managed-agents

2. Anthropic, `Scaling Managed Agents: Decoupling the brain from the hands`
   URL: https://www.anthropic.com/engineering/managed-agents

3. QwibitaI, `nanoclaw`
   URL: https://github.com/qwibitai/nanoclaw

## Sentence-Level Understanding That Matters

### Anthropic product announcement

The product post says Managed Agents gives developers:

- secure sandboxing
- authentication
- tool execution
- long-running sessions
- multi-agent coordination
- governance with scoped permissions and tracing

The key takeaway is not "use Anthropic's hosted product."
The key takeaway is that these are the minimum surfaces people expect once an agent moves from toy
to production:

- durable work
- secure execution
- scoped access
- observability
- orchestration

For AutoKairos, those should become local product requirements, not optional extras.

### Anthropic engineering post

The engineering post makes several more precise architectural claims.

1. Harness assumptions go stale.
   A good interface should survive model changes even when the implementation changes.

2. Session, harness, and sandbox should be different components.
   This is the most important design lesson for AutoKairos.

3. The brain should call the hands through a narrow interface.
   Anthropic expresses this as tool-like execution against named environments.

4. Credentials must stay outside the sandbox.
   This is a structural requirement, not just a permissions checklist.

5. The session log is not the same thing as the model context window.
   Durable event history should live outside the brain and be recoverable after failure.

For AutoKairos, this means:

- the local app should own session continuity
- provider brains should be replaceable
- sandboxes should be disposable
- auth should be host-managed

### NanoClaw

NanoClaw is not the target architecture, but it provides useful concrete patterns.

What is worth copying:

- small orchestrator
- container isolation
- per-group or per-scope memory
- code-first customization
- skills-over-feature-bloat mindset
- keeping secrets out of the container path

What should be generalized beyond NanoClaw:

- provider support should not be Claude-only
- the resident agent should be a harness-level concept, not a provider-level assumption
- auth should support more than one brain

## Direct Implications For AutoKairos

### 1. One harness, many brains

AutoKairos should have one local harness and multiple brain adapters.

Initial adapters:

- Codex
- Claude Code

### 2. One resident agent, many possible providers

The installed app should feel like it has one resident Kairos agent.
Internally, Kairos may route work to different providers.

### 3. Auth is a product surface

Connecting brains is not a hidden implementation detail.
It is a first-class user action in the app.

The app should expose:

- connect Codex
- connect Claude Code
- provider health
- provider selection per thread

### 4. Sandboxes are hands, not brains

Provider credentials must never live in the same sandbox where self-written code executes.

### 5. Durable logs belong to AutoKairos

AutoKairos should keep its own thread and turn history even if provider-native sessions are reset,
replaced, or re-authenticated.

## Practical Design Decision

AutoKairos should be designed as:

- an installable local app
- with one local harness
- with one resident agent identity
- with multiple provider adapters
- with host-side auth
- with disposable sandboxes
- with repo-local durable memory

That is the cleanest way to satisfy the lessons from Anthropic and the practical security shape
shown by NanoClaw.

