# Source Note: Agent Client Protocol And OpenClaw ACP Agents

## Source

- Title: `Agent Client Protocol (ACP)` and OpenClaw ACP agents
- Primary docs:
  - [Agent Client Protocol](https://zed-industries.github.io/agent-client-protocol/)
  - [Zed ACP overview](https://zed.dev/acp)
  - [OpenClaw ACP agents](https://docs.openclaw.ai/tools/acp-agents)
- Source type: official protocol docs and OpenClaw product docs
- Checked: `2026-04-24`

## What This Source Is

ACP is a client/agent protocol for connecting coding editors or agent clients to external coding
harnesses. OpenClaw uses ACP agents to run external harnesses such as Codex, Claude Code, Gemini CLI,
and similar tools through an ACP backend.

## Core Thesis

- ACP is a bridge to an external coding harness, not a trading-system runtime by itself.
- A client can spawn or route work to a harness while keeping the surrounding product in control of
  session ownership and UI.
- ACP is useful when autokairos wants to invoke Codex/Claude/OpenClaw-like systems without owning the
  full harness implementation.

## Vocabulary And Mental Models

| ACP / OpenClaw term | autokairos translation |
| --- | --- |
| external harness session | `AgentSession.provider_kind = openclaw_acp` or an ACP-backed provider |
| spawn/run request | `AgentRun` |
| streaming output | `AgentEvent` and trace input |
| editor/client integration | provider bridge, not product truth |
| OpenClaw Gateway | reference for keeping session routing outside the external harness |

## What Transfers To autokairos

- ACP can be an adapter path for external coding harnesses.
- Treat ACP sessions as provider sessions that emit events and artifacts.
- Keep candidate materialization, evidence, promotion, live gateway, and audit in autokairos.
- Use ACP when the harness should be replaceable by another provider.

## What Not To Copy

- Do not treat ACP as A2A; ACP bridges clients to coding harnesses, while A2A delegates tasks between
  independent agents.
- Do not assume ACP is suitable for live trading authority.
- Do not let ACP output create `TraderSystemCandidate` without schema and semantic materialization.
- Do not copy OpenClaw's full Gateway product shape into MLP-01.
