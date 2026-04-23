# Synthesis Map

This directory is the first interpretation layer above the per-source notes in
[`../library/`](../library/).

Use it after reading the relevant source notes and before changing anything in
`wiki/architecture/`. The goal is to compare sources, extract shared patterns, and surface
important disagreements without yet collapsing them into autokairos-specific design commitments.

## Reading Order

1. [agent-runtime-and-harness-principles.md](agent-runtime-and-harness-principles.md)
   Runtime, harness, session, workspace, and sandbox concepts across Anthropic, OpenAI, Codex,
   Claude Code, and OpenClaw.
2. [proactive-operations-and-wake-orchestration.md](proactive-operations-and-wake-orchestration.md)
   Periodic wakeups, scheduled background runs, event triggers, standing orders, and governed
   self-scheduling across Claude Code, Codex, OpenClaw, Multica, and Paperclip.
3. [evaluation-governance-and-promotion.md](evaluation-governance-and-promotion.md)
   External evaluation, audit, stage progression, and governance across AAR, Automated W2S
   Researcher, the automated-w2s-research repo, and Paperclip.
4. [reference-systems-and-product-postures.md](reference-systems-and-product-postures.md)
   Product-posture comparison across Codex, Claude Code, OpenClaw, Multica, and Paperclip.

## Questions This Layer Should Answer

- What does each source think the core system actually is?
- Where does each source place durable truth?
- Where does each source place autonomy?
- Where does each source place governance?
- Which sources are most useful as runtime references, control-plane references, or
  research-pattern references?

## Rule

Synthesis pages should cite local source notes first. If a claim is not grounded in a source note
under [`../library/`](../library/), it does not belong here yet.
