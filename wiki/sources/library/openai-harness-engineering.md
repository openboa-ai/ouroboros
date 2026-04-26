# Source Note: Harness Engineering

## Source

- Title: `Harness engineering: leveraging Codex in an agent-first world`
- Primary URL: [https://openai.com/index/harness-engineering/](https://openai.com/index/harness-engineering/)
- Source type: engineering article
- Checked: `2026-04-18`
- Research scope:
  - primary article
  - sections:
    - `We started with an empty git repository`
    - `Redefining the role of the engineer`
    - `Increasing application legibility`
    - `We made repository knowledge the system of record`
    - `Agent legibility is the goal`
    - `Enforcing architecture and taste`
    - `Throughput changes the merge philosophy`
    - `Increasing levels of autonomy`
    - `Entropy and garbage collection`

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| Primary article | engineering essay | opening experiment setup | shows the scale and framing of the Codex-built product |
| Primary article | engineering essay | repository-knowledge sections | clarifies `AGENTS.md` and docs-as-system-of-record posture |
| Primary article | engineering essay | architecture/taste sections | explains how OpenAI encodes constraints for agents |
| Primary article | engineering essay | merge/autonomy sections | shows what changes operationally at high agent throughput |
| Primary article | engineering essay | entropy/garbage-collection section | gives the maintenance model for agent-generated systems |

## What This Source Is

This is OpenAI's account of running an internal product experiment in an agent-first engineering
mode. It is not mainly a Codex product announcement. Its strongest value is showing what changes
when the repository becomes the operating environment for agents: docs become a system of record,
`AGENTS.md` becomes a map, merge philosophy changes, and recurring cleanup becomes a structural
part of the system.

## Core Thesis

- In an agent-first environment, humans steer and agents execute.
- The repository must be legible to agents, not only to humans.
- `AGENTS.md` should be a map into richer documentation rather than a giant instruction monolith.
- Repository knowledge should become the durable system of record.
- Architectural taste should be enforced through mechanical invariants, not ad hoc review alone.
- High-throughput agent work changes merge philosophy and requires explicit garbage collection.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Humans steer. Agents execute.` | division of labor in an agent-first engineering system | opening framing |
| `AGENTS.md as map` | short context entrypoint pointing to deeper docs | repository-knowledge sections |
| `Repository knowledge as system of record` | docs tree becomes the canonical design/behavior layer | section `We made repository knowledge the system of record` |
| `Agent legibility` | optimize repository structure for agent reasoning | section `Agent legibility is the goal` |
| `Golden principles` | encoded mechanical invariants and taste rules | sections `Enforcing architecture and taste` and `Entropy and garbage collection` |
| `Background cleanup tasks` | recurring Codex tasks that scan for drift and open refactors | section `Entropy and garbage collection` |
| `Minimal blocking merge gates` | merge philosophy adapted to agent throughput | section `Throughput changes the merge philosophy` |

### Architectural Reading

- The repository itself is treated as the harness surface.
- Design history, docs, tests, CI, and cleanup tasks are all part of the agent operating
  environment.
- Governance appears here as repository invariants and human escalation, not as a separate control
  plane.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| OpenAI describes the experiment as building and shipping a product with zero manually written code | opening framing |
| the article explicitly says `Humans steer. Agents execute.` | opening framing |
| OpenAI says the initial `AGENTS.md` was itself written by Codex | section `We started with an empty git repository` |
| the repository contains product code, tests, CI config, docs, tooling, evaluation harnesses, and review artifacts written by agents | section `What "agent-generated" actually means` |
| the article says one early lesson was to give Codex `a map, not a 1,000-page instruction manual` | repository-knowledge sections |
| the article says the repo is optimized first for Codex's legibility | section `Agent legibility is the goal` |
| OpenAI enforces strict boundaries and predictable structure with custom linters and structural tests | section `Enforcing architecture and taste` |
| the repository operates with minimal blocking merge gates because waiting becomes expensive at high throughput | section `Throughput changes the merge philosophy` |
| the article says Codex can reproduce bugs, record videos, implement fixes, open PRs, remediate failures, and merge changes with human escalation only for judgment | section `Increasing levels of autonomy` |
| OpenAI describes recurring cleanup tasks as `garbage collection` for drift and `AI slop` | section `Entropy and garbage collection` |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `agent-first world` | engineering setting where agents are the main executors | title and opening framing | overall posture of the article |
| `legibility` | repository shape that agents can reason over reliably | multiple sections, especially `Agent legibility is the goal` | central design target |
| `AGENTS.md` | compact repository map injected into context | repository-knowledge sections | explicit instruction-surface primitive |
| `system of record` | docs tree holding canonical product and architecture knowledge | section `We made repository knowledge the system of record` | durable truth layer in this source |
| `golden principles` | explicit mechanical invariants that encode taste | `Entropy and garbage collection` | governance-through-invariants concept |
| `garbage collection` | recurring cleanup of drift in agent-generated systems | `Entropy and garbage collection` | maintenance model |
| `merge philosophy` | operational review/merge norms shaped by throughput | `Throughput changes the merge philosophy` | human governance posture |

## Transferable Lessons

- Treat repository structure and documentation as part of the runtime environment for agents.
- Keep `AGENTS.md` thin and high-signal.
- Encode taste and boundaries as machine-checkable invariants where possible.
- Expect throughput changes to reshape review and merge policy.
- Build recurring cleanup into the system instead of treating drift as occasional human janitorial
  work.

## Non-transferable Baggage

- The article describes one specific OpenAI internal experiment and its own repository shape.
- It is heavily optimized for software-product generation, not for external evaluation or promotion
  systems.
- Its merge philosophy assumes a repository with strong fast feedback and may not transfer directly
  to higher-risk domains.

## Open Questions / Tensions

- How much repository structure improves legibility before it becomes excessive overhead?
- Which forms of human taste can really be encoded as mechanical rules?
- How stable are these practices as models improve further?
- Where is the line between repository governance and a separate control plane?
