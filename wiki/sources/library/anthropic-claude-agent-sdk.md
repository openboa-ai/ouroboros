# Source Note: Claude Agent SDK

## Source

- Title: `Claude Agent SDK`
- Primary docs:
  - [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk)
  - [How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop)
- Source type: official Anthropic / Claude Code documentation
- Checked: `2026-04-24`

## What This Source Is

Claude Agent SDK is Anthropic's SDK surface for embedding a Claude Code-style agent loop in an
application. It differs from the lower-level client SDK because tool execution and the loop are part
of the SDK surface rather than fully implemented by the application.

## Core Thesis

- The SDK owns more of the agent loop than a raw message API.
- A session accumulates context across turns and can be resumed through a session ID.
- Tool definitions, MCP servers, skills, project guidance, and large tool outputs all consume
  context and must be scoped.
- Subagents can reduce context pressure but return summarized results, not full shared runtime truth.

## Vocabulary And Mental Models

| Claude Agent SDK term | autokairos translation |
| --- | --- |
| agent definition / SDK agent | `AgentSpec` |
| SDK session | `AgentSession` |
| one query / turn / streamed result | `AgentRun` plus `AgentEvent` stream |
| tool stream events | `AgentEvent` and later `Trace` |
| tools / MCP / skills | `CapabilityPackage` declarations plus `ToolProxy` grants |
| subagent | future multi-agent admission, not MLP default |

## What Transfers To autokairos

- Use `AgentSpec` for configured behavior and scoped tools.
- Keep context/tool load small and explicit.
- Treat session continuity as provider state, not candidate truth.
- Treat streamed messages and tool events as raw events until autokairos normalizes them into trace.

## What Not To Copy

- Do not brand autokairos as Claude Code or Claude Agent.
- Do not depend on Claude-specific compaction, session, or subagent semantics as product truth.
- Do not make provider-native subagents the default multi-agent architecture.
- Do not let SDK tool access bypass autokairos `ToolProxy`, vault, gateway, or evaluation boundaries.
