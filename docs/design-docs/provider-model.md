# Provider Model

AutoKairos should treat `Codex` and `Claude Code` as replaceable brains behind one local harness.

## Current Principles

- the user connects provider auth directly
- provider credentials must stay outside sandboxes
- the app should expose explicit provider connection status
- provider cost belongs in trading economics
- provider identity should remain visible in repository artifacts when it materially affects work

## Current Scope

- first-class Codex support
- first-class Claude Code support
- one resident system that can route work across providers without feeling like two separate apps
