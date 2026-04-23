# Source Note: openclaw/openclaw

## Source

- Title: `openclaw/openclaw`
- Primary URL: [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
- Source type: implementation repository
- Checked: `2026-04-19`
- Research scope:
  - root `README.md`
  - `VISION.md`
  - root `AGENTS.md`
  - docs:
    - `docs/concepts/architecture.md`
    - `docs/concepts/session.md`
    - `docs/tools/acp-agents.md`
  - adjacent official docs:
    - `https://docs.openclaw.ai/automation`
    - `https://docs.openclaw.ai/automation/tasks`
    - `https://docs.openclaw.ai/gateway/heartbeat`
    - `https://docs.openclaw.ai/automation/standing-orders`
    - `https://docs.openclaw.ai/automation/hooks`

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| `README.md` | repo root readme | product framing, Gateway, channels, security model, docs map | establishes product posture |
| `VISION.md` | strategy doc | plugin stance, memory stance, MCP stance, anti-heavy-orchestration stance | shows deliberate product boundaries |
| root `AGENTS.md` | contributor contract | architecture boundaries and boundary vocabulary | clarifies internal repo mental model |
| `docs/concepts/architecture.md` | concept doc | Gateway architecture and client/node flow | concrete control-plane model |
| `docs/concepts/session.md` | concept doc | session routing, lifecycle, and storage | durable truth placement |
| `docs/tools/acp-agents.md` | tool/runtime doc | ACP sessions, external harness runtime, thread binding | external harness integration model |
| `automation` | official operations doc | cron vs heartbeat vs standing orders vs task flow vs hooks | clarifies proactive-operations taxonomy |
| `automation/tasks` | official operations doc | task ledger semantics and task-vs-scheduler boundary | clarifies detached-work records |
| `gateway/heartbeat` | official operations doc | heartbeat cadence, main-session context, isolation options | clarifies approximate periodic wake model |
| `automation/standing-orders` | official operations doc | programs with triggers, approval gates, and escalation | clarifies governed self-scheduling / authority posture |
| `automation/hooks` | official operations doc | lifecycle and tool-call event surfaces | clarifies event-driven wake/automation hooks |

## What This Source Is

OpenClaw is an always-on personal-assistant platform, not a narrow coding harness. It is valuable
as a reference for persistent assistant posture, strong gateway ownership, session centralization,
and ACP-based integration of external harnesses such as Codex and Claude Code.

## Core Thesis

- The Gateway is the control plane; the product is the assistant.
- OpenClaw is designed as a long-lived, local, always-on assistant spanning channels and devices.
- Session state is owned by the Gateway, not by transient clients.
- OpenClaw has both a native embedded runtime and an ACP path for external harnesses.
- OpenClaw explicitly distinguishes proactive-work mechanisms instead of flattening cron,
  heartbeat, tasks, hooks, and standing orders into one feature.
- The project explicitly resists heavy nested manager-of-manager orchestration as a default
  architecture.
- Plugins, skills, and optional capability should live at the edges while the core stays lean.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Gateway` | long-lived daemon and control plane | `README.md`, opening framing; `docs/concepts/architecture.md` |
| `Node` | device-side helper connected over the same WebSocket server | `docs/concepts/architecture.md` |
| `Session ownership` | all session state stored and owned by the Gateway | `docs/concepts/session.md` |
| `Embedded runtime` | default in-core assistant runtime | `README.md`; `docs/tools/acp-agents.md` by contrast |
| `ACP session` | external harness runtime session tracked as background work | `docs/tools/acp-agents.md` |
| `Bound session` | conversation or thread pinned to a persistent ACP session | `docs/tools/acp-agents.md` |
| `ACP session control plane` | OpenClaw-owned control layer that runs external harnesses through ACP plugins and adapters | `docs/tools/acp-agents.md`, `How ACP runs Claude Code` |
| `Background-task tracking` | tracking surface for spawned ACP work | `docs/tools/acp-agents.md` |
| `Workspace bootstrap files` | repo-owned workspace guidance files such as `AGENTS.md` and related documents | root `AGENTS.md` and product docs posture |
| `Cron` | exact scheduler for isolated or main-session executions | `automation` |
| `Heartbeat` | approximate periodic main-session turn with full session context | `automation`; `gateway/heartbeat` |
| `Background task ledger` | record layer for detached work, not a scheduler | `automation`; `automation/tasks` |
| `Standing order` | durable authority program with triggers, approval gates, and escalation rules | `automation/standing-orders` |
| `Task Flow` | durable orchestration layer above individual background tasks | `automation` |
| `Hook` | event-driven automation script surface around lifecycle, compaction, messages, and tools | `automation`; `automation/hooks` |

### Architectural Reading

- OpenClaw is partly a runtime reference and partly a platform product.
- Its strongest invariant is that session and transport ownership stay centralized in the Gateway.
- ACP is treated as an external-runtime bridge, not as the native default runtime model.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| the README explicitly says the Gateway is just the control plane and the product is the assistant | root `README.md`, opening description |
| the README presents OpenClaw as a personal, single-user, always-on assistant | root `README.md`, opening description |
| the architecture doc says a single long-lived Gateway owns messaging surfaces and exposes a typed WebSocket API | `docs/concepts/architecture.md`, `Overview` |
| the session doc says all session state is owned by the Gateway and stored under `~/.openclaw/agents/<agentId>/sessions/` | `docs/concepts/session.md`, `Where state lives` |
| the session doc gives explicit routing behavior for DMs, groups, rooms, cron jobs, and webhooks | `docs/concepts/session.md`, `How messages are routed` |
| the ACP docs distinguish ACP sessions from CLI backends and from exposing OpenClaw itself as an ACP server | `docs/tools/acp-agents.md`, `Which page do I want?` |
| the ACP docs say persistent chat/thread-bound ACP sessions are tracked as background tasks | `docs/tools/acp-agents.md`, opening paragraphs |
| the ACP docs explicitly model Claude-through-ACP as a stack of `OpenClaw ACP session control plane -> bundled acpx runtime plugin -> Claude ACP adapter -> Claude-side runtime/session machinery` | `docs/tools/acp-agents.md`, `How ACP runs Claude Code` |
| the ACP docs say ACP Claude carries session resume, background-task tracking, and optional conversation/thread binding | `docs/tools/acp-agents.md`, `How ACP runs Claude Code` |
| bound sessions keep OpenClaw owning channel transport, auth, safety, and delivery while pinning follow-up messages to the same ACP session key | `docs/tools/acp-agents.md`, `Bound sessions` |
| `VISION.md` says OpenClaw prefers plugins and a lean core, ships some bundled skills, and currently prefers MCP through `mcporter` rather than first-class MCP runtime in core | `VISION.md`, `Plugins & Memory`, `Skills`, `MCP Support` |
| `VISION.md` explicitly says OpenClaw will not merge heavy nested agent-hierarchy frameworks as a default architecture for now | `VISION.md`, `What We Will Not Merge (For Now)` |
| the automation docs distinguish exact cron scheduling from approximate heartbeat turns, and explicitly say heartbeat uses full main-session context while cron creates task records | `automation`, `Scheduled Tasks (Cron) vs Heartbeat` |
| the automation docs say tasks are records, not schedulers, and that task flow is a durable orchestration substrate above individual tasks | `automation`, `Tasks`; `Task Flow` |
| the heartbeat docs define heartbeat as a periodic main-session turn that does not create background task records and support options such as active hours, light context, and isolated sessions | `gateway/heartbeat`, opening section and defaults |
| the standing-orders docs define standing orders as programs with scope, triggers, approval gates, and escalation rules, typically injected from `AGENTS.md` every session | `automation/standing-orders`, opening section; `How They Work` |
| the background-tasks docs say heartbeat runs do not create task records, but task completion can trigger a heartbeat wake | `automation/tasks`, `Tasks and heartbeat` |
| the hooks docs describe event-driven automation over lifecycle, message flow, compaction, and tool execution | `automation/hooks`, overview |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `Gateway` | long-lived control plane daemon | `README.md`, architecture doc | most important control-plane term |
| `assistant` | the actual user-facing product | `README.md`, opening description | distinguishes product from control plane |
| `session` | routed conversation state owned by the gateway | session doc | durable truth surface |
| `node` | device/client-capability endpoint | architecture doc | distributed device model |
| `ACP` | runtime/session path for external harness agents | ACP docs | external-harness integration vocabulary |
| `bound session` | conversation/thread tied to one ACP session | ACP docs | continuity primitive |
| `ACP session control plane` | OpenClaw-owned control layer around external harness sessions | ACP docs | separates OpenClaw governance from upstream harness machinery |
| `background task` | tracked spawned runtime work | ACP docs | durability and supervision primitive |
| `plugin` | preferred edge extension mechanism | `VISION.md` | extensibility posture |
| `mcporter` | bridge used for MCP support | `VISION.md`, `MCP Support` | shows OpenClaw's MCP strategy is bridge-first |
| `cron` | precise scheduler with isolated or main-session delivery options | `automation` | exact proactive-work primitive |
| `heartbeat` | periodic main-session turn with approximate timing | `automation`; `gateway/heartbeat` | contextual proactive-work primitive |
| `standing order` | durable operating program loaded every session | `automation/standing-orders` | governed autonomy primitive |
| `task flow` | durable orchestration layer above tasks | `automation` | flow-level orchestration primitive |
| `lightContext` | heartbeat mode that only injects heartbeat bootstrap context | `gateway/heartbeat` | latency/control knob |
| `isolatedSession` | heartbeat mode that avoids full chat history | `gateway/heartbeat` | continuity-vs-latency knob |

## Transferable Lessons

- A persistent assistant system benefits from a clearly owned control plane.
- Session truth can be centralized outside clients and outside transient runtime loops.
- Native runtime and external-runtime bridge paths can coexist if they are named and separated
  cleanly.
- Product posture matters: an always-on assistant has different constraints than a terminal coding
  harness.
- It is useful to state explicitly what orchestration complexity the system is refusing to adopt.
- Proactive operations should be decomposed into different primitives with distinct context,
  precision, and audit semantics: heartbeat, cron, hooks, task flow, and standing orders.
- Governed self-scheduling is a first-class idea: standing orders define scope, triggers,
  approval gates, and escalation rather than letting the agent silently rewrite its own behavior.

## Non-transferable Baggage

- OpenClaw spans messaging channels, voice, nodes, canvas, and many assistant-specific concerns.
- Its Gateway protocol, pairing model, and device ecosystem are product-specific.
- The assistant posture is broader and heavier than many narrower runtime systems need.

## Open Questions / Tensions

- How much of OpenClaw's gateway/session model is essential outside multi-channel assistant use
  cases?
- When should a system prefer its native runtime versus an ACP-launched external harness?
- How much bootstrap context should be injected into a session before it becomes noise?
- Where does OpenClaw stop being a runtime reference and become mainly a product/platform
  reference?
- Which proactive-work primitives are essential in a narrower trading system, and which are
  assistant-product-specific?
