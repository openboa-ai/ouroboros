# Source Note: Google Agent Development Kit

## Source

- Title: `Google Agent Development Kit (ADK)`
- Primary docs:
  - [Agent Runtime](https://adk.dev/runtime/)
  - [State](https://adk.dev/sessions/state/)
  - [Artifacts](https://adk.dev/artifacts/)
- Source type: official Google ADK documentation
- Checked: `2026-04-24`

## What This Source Is

Google ADK is a framework for building, running, deploying, evaluating, and integrating agents. Its
useful vocabulary for autokairos is the explicit split between `Agent`, `Runner`, `Session`, `State`,
`Event`, `Artifact`, and `Tool`.

## Core Thesis

- A runner executes an agent against session and artifact services.
- Sessions and state are managed through lifecycle boundaries, not mutated arbitrarily.
- Events are the primary record emitted during agent operation.
- Artifacts are versioned outputs that should be managed outside transient model context.
- Tools are integration points; they are not the same as agent-to-agent communication.

## Vocabulary And Mental Models

| Google ADK term | autokairos translation |
| --- | --- |
| `Agent` | `AgentSpec` |
| `Runner` / invocation | `AgentRun` |
| `Session` / `State` | `AgentSession` continuity, not durable product truth |
| `Event` | `AgentEvent` |
| `Artifact` | trace artifact, candidate materialization input, or package artifact depending on boundary |
| `Tool` | `ToolProxy` / MCP / capability declaration |

## What Transfers To autokairos

- Keep runner/invocation separate from configured agent.
- Keep event streams explicit and durable enough to normalize into `Trace`.
- Use artifact services as a mental model for outputs that outlive one model turn.
- Preserve session-state boundaries so provider memory does not become autokairos truth.

## What Not To Copy

- Do not introduce Google ADK workflow agents as the central autokairos orchestrator.
- Do not let ADK session state replace control-plane candidate/evidence/promotion records.
- Do not make ADK deployment shape a dependency for MLP-01.
- Do not treat ADK evaluation surfaces as the only valid external evaluator model.
