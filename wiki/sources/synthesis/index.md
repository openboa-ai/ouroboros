# Synthesis Map

This directory is the first interpretation layer above the per-source notes in
[`../library/`](../library/).

Use it after reading the relevant source notes and before changing anything in
`wiki/architecture/`. The goal is to compare sources, extract shared patterns, and surface
important disagreements without yet collapsing them into autokairos-specific design commitments.

For supplied reference lists, start from [../reference-ledger.md](../reference-ledger.md). The
ledger is the audit trail; these synthesis pages are the interpretation layer.

After the 2026 URL-level ingestion pass, synthesis also acts as the promotion layer from source
notes into active design constraints. Architecture changes should be able to point to one of these
pages rather than re-deriving conclusions directly from raw URLs.

## Reading Order

1. [agent-runtime-and-harness-principles.md](agent-runtime-and-harness-principles.md)
   Runtime, harness, session, run, event, workspace, sandbox, tool, and agent-communication
   concepts across Anthropic, OpenAI, Google ADK, Google A2A, MCP, ACP, Codex, Claude Code, and
   OpenClaw.
2. [proactive-operations-and-runtime-control.md](proactive-operations-and-runtime-control.md)
   Background work, long-running sessions, operator re-entry, and the current runtime-control
   translation across Claude Code, Codex, OpenClaw, Multica, and Paperclip.
3. [evaluation-governance-and-promotion.md](evaluation-governance-and-promotion.md)
   External evaluation, audit, stage progression, and governance across AAR, Automated W2S
   Researcher, the automated-w2s-research repo, and Paperclip.
4. [reference-systems-and-product-postures.md](reference-systems-and-product-postures.md)
   Product-posture comparison across OpenAI Agents SDK, Claude Managed Agents, Claude Agent SDK,
   Google ADK, A2A, MCP, ACP, Codex, Claude Code, OpenClaw, Multica, and Paperclip.
5. [reference-impact-audit-2026-04.md](reference-impact-audit-2026-04.md)
   Rows 1-51 audit layer that classifies source pressure into reinforced design, wording changes,
   boundary changes, new primitive candidates, and rejected reference-system behavior before active
   architecture is changed.

## Questions This Layer Should Answer

- What does each source think the core system actually is?
- Where does each source place durable truth?
- Where does each source place autonomy?
- Where does each source place governance?
- Which sources are most useful as runtime references, control-plane references, or
  research-pattern references?
- Which source pressures have already been audited before an active architecture patch?

## Source-Role Rule

This synthesis layer should keep the current autokairos source hierarchy explicit.

- `AAR`, `Automated W2S Researcher`, and the `automated-w2s-research` repo are the **primary
  thesis spine**.
  They are the strongest references for:
  weak supervision, evaluation bottlenecks, external truth, and legitimacy boundaries.
- `Paperclip` is the **governance spine**.
  It is the strongest reference for:
  approval, intervention, audit, and product-visible operator control.
- `OpenAI Agents SDK`, `Claude Managed Agents`, `Claude Agent SDK`, `Google ADK`, `Google A2A`,
  `MCP`, `ACP`, `Codex`, `Claude Code`, `OpenClaw`, and `Multica` are the
  **runtime/orchestration spine**.
  They inform:
  brain/hands/session separation, harness posture, agent-to-agent communication, background work,
  runtime separation, and operator re-entry surfaces.

Within that runtime/orchestration spine, source roles are narrower:

- `OpenAI Agents SDK`, `Claude Managed Agents`, `Claude Agent SDK`, and `Google ADK` ground the
  `AgentSpec / AgentSession / AgentRun / AgentEvent` vocabulary.
- [anthropic-2026-runtime-and-managed-agent-stack.md](../library/anthropic-2026-runtime-and-managed-agent-stack.md)
  is the current Anthropic cluster for Managed Agents, long-running harnesses, memory, skills, auto
  mode, and autonomy measurement.
- [openai-2026-agent-codex-workspace-stack.md](../library/openai-2026-agent-codex-workspace-stack.md)
  is the current OpenAI cluster for Workspace Agents, Codex, AgentKit, Agents SDK docs, tools,
  guardrails, evals, observability, sandboxes, and model guidance.
- [google-2026-agent-platform-and-protocols.md](../library/google-2026-agent-platform-and-protocols.md)
  is the current Google cluster for Gemini Enterprise Agent Platform, ADK, A2A, memory, runtime,
  Jules, and Cloud Assist.
- `Claude Managed Agents` is the strongest reference for brain/hands/session and managed-team
  threads.
- `Google A2A` is the strongest reference for interoperable communication between independent
  agent endpoints.
- `ACP` is the bridge reference for invoking external coding harnesses.
- MCP/tool-proxy style patterns remain the preferred reference for tools, resources, and structured
  side effects.
- `Google Agent Runtime`, `Memory Bank`, `Agent Gateway`, `Agent Identity`, `Agent Registry`, and
  `Agent Evaluation` are decomposition references. They require autokairos to separate runtime
  placement, memory context, gateway authority, identity, registry/discovery, observability, and
  evaluation rather than cloning Gemini Enterprise scope.
- OpenAI sandbox, tools, observability, guardrail, and eval docs reinforce that provider runs,
  sandbox compute, tool access, trace, review, and evidence must remain separate boundaries.

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
