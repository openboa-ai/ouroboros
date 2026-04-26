# Source Note: OpenAI Agents SDK And SandboxAgent

## Source

- Title: `OpenAI Agents SDK`, `Runner`, `RunConfig`, `Sessions`, `Tracing`, and `SandboxAgent`
- Primary docs:
  - [Agents SDK guide](https://platform.openai.com/docs/guides/agents-sdk/)
  - [Running agents](https://openai.github.io/openai-agents-python/running_agents/)
  - [SandboxAgent reference](https://openai.github.io/openai-agents-python/ref/sandbox/sandbox_agent/)
  - [Sandbox guide](https://openai.github.io/openai-agents-python/sandbox/guide/)
  - [Tracing](https://openai.github.io/openai-agents-python/tracing/)
- Source type: official OpenAI SDK documentation
- Checked: `2026-04-24`

## What This Source Is

The OpenAI Agents SDK is a programmable agent harness. Its most useful vocabulary for autokairos is
the separation between configured `Agent`, execution via `Runner.run(...)`, runtime `RunConfig`,
sessions for continuity, traces for observability, and sandbox manifests/capabilities for controlled
workspaces.

## Core Thesis

- A configured agent is not the same as a run.
- Runtime transport and sandbox details belong in run-time configuration, not inside the agent object.
- A session is a continuity layer, not product truth.
- Tracing should record model calls, tool calls, handoffs, guardrails, and custom events for a run.
- Sandbox manifests/capabilities are useful boundaries for controlled workspaces, but they are not
  equivalent to trading authority.

## Vocabulary And Mental Models

| OpenAI term | autokairos translation |
| --- | --- |
| `Agent` / `SandboxAgent` | `AgentSpec` when used as a configured participant definition |
| `Runner.run(...)` | `AgentRun` |
| `RunConfig` | invocation/runtime configuration, partly represented by `AgentRun` plus `RuntimeOperatingPolicy` |
| `Session` / conversation state | `AgentSession` provider/session continuity |
| `Trace` / spans | raw provider events plus durable autokairos `Trace` |
| `Manifest` / `Capability` | reference for `CapabilityManifest`, not a direct clone |

## What Transfers To autokairos

- Keep `AgentSpec`, `AgentSession`, and `AgentRun` separate.
- Put provider-specific runtime details on the session/run boundary, not on candidate identity.
- Use trace IDs and grouped run records so later evidence can cite what happened.
- Treat sandbox capabilities as declared access surfaces that still need autokairos permission and
  gateway boundaries.
- Let agent-authored `TraderSystemProgram` artifacts run inside sandbox/compute boundaries while
  keeping secrets, evidence, promotion, and live gateway authority outside that compute environment.

## What Not To Copy

- Do not make OpenAI's SDK object model the product object model.
- Do not treat a successful SDK run as counted trading evidence.
- Do not treat sandbox capability as exchange authority.
- Do not make `TraderSystemSpec` a Docker or OpenAI sandbox manifest.
