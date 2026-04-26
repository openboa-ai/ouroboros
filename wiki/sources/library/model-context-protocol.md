# Source Note: Model Context Protocol

## Source

- Title: `Model Context Protocol (MCP)`
- Primary docs:
  - [MCP introduction](https://modelcontextprotocol.io/docs/tool)
  - [Architecture overview](https://modelcontextprotocol.io/docs/learn/architecture)
  - [Server concepts](https://modelcontextprotocol.io/docs/learn/server-concepts)
  - [Elicitation](https://modelcontextprotocol.org/specification/draft/client/elicitation)
- Source type: official MCP documentation and specification pages
- Checked: `2026-04-24`

## What This Source Is

MCP is a protocol for exposing tools, resources, prompts, and related client/server capabilities to AI
applications. For autokairos, MCP is a tool/resource boundary, not an agent identity or trading
authority model.

## Core Thesis

- MCP servers expose tools, resources, and prompts through negotiated protocol capabilities.
- Tools are executable functions, resources are contextual data, and prompts are reusable templates.
- Elicitation and sampling are client-mediated flows; they do not remove application control.
- MCP access needs validation, permissioning, and logging because tools can have side effects.

## Vocabulary And Mental Models

| MCP term | autokairos translation |
| --- | --- |
| tool | `ToolProxy` capability, possibly declared by `CapabilityManifest` |
| resource | context/data access surface, usually package or binding mediated |
| prompt | reusable instruction template, not product truth |
| elicitation | user/operator input request, still mediated by autokairos |
| sampling | server-requested model call, not external evaluation by itself |

## What Transfers To autokairos

- Use MCP for tool/resource/prompt access, not agent-to-agent delegation.
- Treat tool declarations as requested capabilities, not granted permissions.
- Keep actual access grants in `StageBinding`, `ToolProxy`, vault, and gateway layers.
- Log tool calls and results into trace; do not count them as evidence automatically.

## What Not To Copy

- Do not make MCP the multi-agent communication protocol.
- Do not put secrets or live exchange credentials in `CapabilityPackage`.
- Do not let MCP tools call live trading endpoints directly without gateway mediation.
- Do not treat MCP prompt templates as candidate identity.
