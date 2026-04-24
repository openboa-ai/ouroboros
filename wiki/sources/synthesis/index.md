# Synthesis Map

This directory is the first interpretation layer above the per-source notes in
[`../library/`](../library/).

Use it after reading the relevant source notes and before changing anything in
`wiki/architecture/`. The goal is to compare sources, extract shared patterns, and surface
important disagreements without yet collapsing them into autokairos-specific design commitments.

## Reading Order

1. [agent-runtime-and-harness-principles.md](agent-runtime-and-harness-principles.md)
   Runtime, harness, session, workspace, sandbox, and agent-communication concepts across
   Anthropic, Google A2A, OpenAI, Codex, Claude Code, and OpenClaw.
2. [proactive-operations-and-wake-orchestration.md](proactive-operations-and-wake-orchestration.md)
   Periodic wakeups, scheduled background runs, event triggers, standing orders, and governed
   self-scheduling across Claude Code, Codex, OpenClaw, Multica, and Paperclip.
3. [evaluation-governance-and-promotion.md](evaluation-governance-and-promotion.md)
   External evaluation, audit, stage progression, and governance across AAR, Automated W2S
   Researcher, the automated-w2s-research repo, and Paperclip.
4. [reference-systems-and-product-postures.md](reference-systems-and-product-postures.md)
   Product-posture comparison across Claude Managed Agents, Codex, Claude Code, OpenClaw,
   Multica, and Paperclip.

## Questions This Layer Should Answer

- What does each source think the core system actually is?
- Where does each source place durable truth?
- Where does each source place autonomy?
- Where does each source place governance?
- Which sources are most useful as runtime references, control-plane references, or
  research-pattern references?

## Source-Role Rule

This synthesis layer should keep the current autokairos source hierarchy explicit.

- `AAR`, `Automated W2S Researcher`, and the `automated-w2s-research` repo are the **primary
  thesis spine**.
  They are the strongest references for:
  weak supervision, evaluation bottlenecks, external truth, and legitimacy boundaries.
- `Paperclip` is the **governance spine**.
  It is the strongest reference for:
  wake, approval, intervention, audit, and product-visible operator control.
- `Claude Managed Agents`, `Google A2A`, `Codex`, `Claude Code`, `OpenClaw`, and `Multica` are the
  **runtime/orchestration spine**.
  They inform:
  brain/hands/session separation, harness posture, agent-to-agent communication, background work,
  runtime separation, and operator re-entry surfaces.

Within that runtime/orchestration spine, source roles are narrower:

- `Claude Managed Agents` is the strongest reference for brain/hands/session and managed-team
  threads.
- `Google A2A` is the strongest reference for interoperable communication between independent
  agent endpoints.
- MCP/tool-proxy style patterns remain the preferred reference for tools, resources, and structured
  side effects.

This hierarchy exists to extract:

- mindset
- failure models
- design constraints
- boundary lessons

It does **not** imply that autokairos should clone any reference product or infrastructure stack
literally.

## Rule

Synthesis pages should cite local source notes first. If a claim is not grounded in a source note
under [`../library/`](../library/), it does not belong here yet.
