# Provider Model

AutoKairos should treat `Codex` and `Claude Code` as replaceable brains behind one local managed
agent system.

## Current Principles

- the user connects provider auth directly
- provider credentials must stay outside sandboxes
- the app should expose explicit provider connection status
- provider cost belongs in trading economics
- provider identity should remain visible in repository artifacts when it materially affects work
- agent definitions should stay provider-neutral
- providers should plug into the orchestrator through provider adapters, not directly into the
  client
- provider switching should not change the workspace-asset contract

## Current Scope

- first-class Codex support
- first-class Claude Code support
- one orchestrated local system that can route work across providers without feeling like two
  separate apps

## Provider Position In The Architecture

- `agent`
  Provider-neutral declaration of work and policy
- `provider adapter`
  Concrete integration that satisfies the agent's brain contract
- `orchestrator`
  Chooses which provider adapter to use for a given session or task
- `application service`
  Exposes provider connection status and provider-related actions to the client

This keeps provider choice as an implementation decision behind a stable agent/runtime contract.
