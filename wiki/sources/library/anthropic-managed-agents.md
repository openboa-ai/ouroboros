# Source Note: Scaling Managed Agents

## Source

- Title: `Scaling Managed Agents: Decoupling the brain from the hands`
- Primary URL: [https://www.anthropic.com/engineering/managed-agents](https://www.anthropic.com/engineering/managed-agents)
- Source type: engineering article
- Checked: `2026-04-18`
- Research scope:
  - primary article
  - adjacent official docs:
    - `https://claude.com/blog/context-management`
  - sections / passages on:
    - harnesses going stale
    - the `session / harness / sandbox` split
    - pets vs cattle framing
    - security boundary and credentials
    - long-context failure modes
    - memory outside the active context window

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| Primary article | engineering essay | opening framing on stale harness assumptions | explains why Anthropic wants stable interfaces rather than one fixed harness |
| Primary article | engineering essay | virtualization analogy and stable abstractions | defines `session`, `harness`, and `sandbox` as first-class abstractions |
| Primary article | engineering essay | coupled-container failure discussion | provides the `pets vs cattle` infrastructure lesson |
| Primary article | engineering essay | security boundary discussion | clarifies where credentials should and should not live |
| Primary article | engineering essay | context window discussion | motivates state outside the active context window |
| `Managing context on the Claude Developer Platform` | official product/engineering post | context editing and memory tool | clarifies Anthropic's current posture for state outside the active window |

## What This Source Is

This is Anthropic's architectural explanation of Managed Agents as a hosted long-horizon agent
system. It is less about prompts and more about service boundaries. Its key contribution is the
decision to split agent infrastructure into stable abstractions—`session`, `harness`, and
`sandbox`—so the harness can change over time without forcing a redesign of everything around it.

## Core Thesis

- Harnesses encode assumptions about model weaknesses, so they go stale as models improve.
- Long-horizon agent systems need interfaces that outlast a specific harness implementation.
- Anthropic's answer is to virtualize the agent into `session`, `harness`, and `sandbox`.
- Durable state should live outside a single container or process.
- Credentials should never be reachable from the sandbox where model-generated code executes.
- Infrastructure should treat harness containers as replaceable cattle, not fragile pets.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Session` | append-only log of everything that happened | article passage introducing the three abstractions |
| `Harness` | the loop that calls Claude and routes tool calls | same abstraction-defining passage |
| `Sandbox` | execution environment where Claude runs code and edits files | same abstraction-defining passage |
| `Pet vs cattle` | warning against coupling all components into one fragile container | section `Don't adopt a pet` |
| `Externalized context/state` | state object living outside the context window and outside the active harness | opening discussion of long-horizon tasks and context retention |
| `Credential isolation` | auth bundled with resources or held in a vault outside the sandbox | security-boundary discussion |
| `Memory tool` | persistence surface outside the active context window | adjacent `Managing context on the Claude Developer Platform` post |
| `Context editing` | explicit removal of stale in-window material while retaining important state elsewhere | same adjacent post |

### Architectural Reading

- The article is explicit that stable interfaces matter more than preserving one harness shape.
- It treats session durability and security boundaries as structural architecture, not later
  operational hardening.
- The system boundary is infrastructural: service design, storage design, and credential placement.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| harness assumptions can become dead weight as models improve | opening discussion of stale harness assumptions and `context anxiety` example |
| Managed Agents are built around interfaces meant to outlast any particular implementation | opening paragraphs introducing the hosted service |
| Anthropic explicitly virtualizes the agent into `session`, `harness`, and `sandbox` | article passage comparing Managed Agents to OS abstractions |
| in the original coupled design, session, harness, and sandbox lived in one container | section `Don't adopt a pet` |
| the coupled design created a `pet` that was hard to debug and expensive to lose | section `Don't adopt a pet` |
| in the coupled design, untrusted generated code ran in the same container as credentials | security-boundary discussion |
| the structural fix was to ensure tokens are never reachable from the sandbox | security-boundary discussion |
| Anthropic supports MCP-backed custom tools while storing OAuth tokens in a secure vault | security-boundary discussion |
| the article warns that context compaction and trimming are irreversible decisions that can fail | opening discussion of long-horizon tasks and context retention |
| Anthropic's context-management post says the memory tool stores information outside the context window in a dedicated memory directory that persists across conversations | adjacent `Managing context on the Claude Developer Platform` post |
| the same post says context editing clears stale file reads and test results while memory preserves debugging insights and architectural decisions | adjacent `Managing context on the Claude Developer Platform` post |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `Managed Agents` | hosted service for long-horizon agent work | opening paragraphs | identifies the product posture |
| `session` | append-only history/log of work | abstraction passage | Anthropic's durable truth object |
| `harness` | loop around the model and tools | abstraction passage | execution logic that may evolve |
| `sandbox` | environment for code execution and file edits | abstraction passage | execution boundary and risk boundary |
| `pet` | fragile container that cannot be lost | section `Don't adopt a pet` | negative infrastructure metaphor |
| `cattle` | interchangeable replaceable infrastructure | `Don't adopt a pet` | desired posture for harness containers |
| `context anxiety` | premature wrap-up behavior near the context limit | opening discussion | example of a stale harness assumption |
| `vault outside the sandbox` | secure auth storage unreachable from generated code | security-boundary discussion | clarifies credential placement |
| `memory tool` | explicit file-based persistence outside the context window | adjacent context-management post | continuity primitive |
| `context editing` | deliberate clearing of stale in-window context | adjacent context-management post | separates active context from durable state |

## Transferable Lessons

- Separate durable session truth from the currently running harness.
- Keep the harness thin enough that it can evolve as model behavior changes.
- Treat credential isolation as part of the core architecture.
- Avoid coupling session persistence, harness execution, and sandbox compute into one fragile unit.
- Use stable abstractions even when the underlying runtime implementation is expected to change.

## Non-transferable Baggage

- Managed Agents is a hosted Anthropic service with Anthropic-specific platform constraints.
- The exact service split and product surface are not universal requirements.
- The article is not a complete specification for client-facing workflows, approvals, or
  user-visible governance.

## Open Questions / Tensions

- How thin can the `harness` abstraction be before it stops being useful?
- Which parts of the session object belong in append-only history versus derived indexes?
- How much infrastructure complexity is justified before a simpler local system should win?
- What additional governance surfaces are needed beyond the `session / harness / sandbox` split?
