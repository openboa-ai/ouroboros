# Source Note: multica-ai/multica

## Source

- Title: `multica-ai/multica`
- Primary URL: [https://github.com/multica-ai/multica](https://github.com/multica-ai/multica)
- Source type: implementation repository
- Checked: `2026-04-18`
- Research scope:
  - root `README.md`
  - `CLI_AND_DAEMON.md`
  - `packages/core/types/agent.ts`
  - `packages/core/types/events.ts`
  - `packages/core/types/autopilot.ts`
  - `apps/docs/content/docs/guides/agents.mdx`
  - repository tree and architecture summary in the README

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| `README.md` | repo root readme | product framing, features, daemon/runtime model, Paperclip comparison | establishes product posture |
| `CLI_AND_DAEMON.md` | operational guide | daemon lifecycle, polling, heartbeat, workspace-root, runtime registration | clarifies actual runtime-bridge behavior |
| `packages/core/types/agent.ts` | type surface | `Agent`, `RuntimeDevice`, `AgentTask`, skill types | shows managed entities and control-plane schema |
| `packages/core/types/events.ts` | type surface | task event stream and daemon lifecycle events | clarifies external progress and liveness surfaces |
| `packages/core/types/autopilot.ts` | type surface | recurring/scheduled work objects | clarifies orchestration above task assignment |
| `apps/docs/.../agents.mdx` | user guide | execution model, runtime providers, local vs workspace skills | clarifies practical agent/runtime behavior |

## What This Source Is

This repository is a managed-agents collaboration platform. It is strongest as a control-plane and
runtime-registry reference, not as a raw harness reference. It assumes external coding harnesses
already exist and focuses instead on making them manageable as teammates with runtimes, tasks,
skills, and isolated workspaces.

## Core Thesis

- Multica treats agents as managed teammates rather than raw loops.
- The daemon is the bridge between external harness CLIs and the higher-level platform.
- The platform owns task lifecycle, runtime detection, workspace isolation, and progress streaming.
- Skills exist at both local-runtime and workspace-shared levels.
- Runtime inventory, daemon liveness, and task progress are explicit platform records.
- Recurring or API-triggered work is modeled above direct task assignment.
- The main abstraction is a management plane over agents and runtimes, not a single harness.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Daemon` | local bridge that detects CLIs, starts tasks, and reports progress | `README.md`, `Getting Started`; `agents.mdx`, execution model |
| `Runtime` / `RuntimeDevice` | compute environment registered with provider info and health/status | `README.md`, `What is a Runtime?`; `packages/core/types/agent.ts` |
| `Agent` | managed profile bound to a runtime and configured with instructions, env, args, concurrency, and skills | `packages/core/types/agent.ts` |
| `AgentTask` | task lifecycle object with queue/dispatched/running/completed/failed states | `packages/core/types/agent.ts` |
| `Task events` | external event stream for dispatch, progress, completion, failure, messages, and cancellation | `packages/core/types/events.ts` |
| `Daemon heartbeat / register` | explicit daemon liveness and runtime-registration events | `packages/core/types/events.ts`; `CLI_AND_DAEMON.md` |
| `Autopilot` | scheduled or API-triggered work surface above direct task assignment | `packages/core/types/autopilot.ts` |
| `Workspace isolation` | isolated workspace directory created per task | `agents.mdx`, execution model |
| `Local skills` | skills already installed in the underlying runtime | `agents.mdx`, `Reusable Skills` |
| `Workspace skills` | platform-shared skills injected into agent runs | `README.md`, features; `agents.mdx`, `Reusable Skills` |

### Architectural Reading

- Multica is platform-first: runtimes, agents, tasks, events, and skills are all managed records.
- It does not try to own the internal cognition of Claude Code, Codex, or OpenClaw.
- The daemon is the key bridge between local compute and the higher-level control plane.
- Task progress, daemon liveness, and recurring execution all sit outside the underlying agent CLI.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| the README frames Multica as infrastructure that turns coding agents into real teammates | `README.md`, opening and `What is Multica?` |
| the daemon auto-detects agent CLIs on PATH and registers them as runtimes | `README.md`, `Getting Started`; `agents.mdx`, provider table |
| the daemon creates an isolated workspace directory and spawns the chosen agent CLI | `agents.mdx`, `Agent Execution Model` |
| the documented task lifecycle is `enqueue -> claim -> start -> complete/fail` | `agents.mdx`, `Agent Execution Model` |
| `CLI_AND_DAEMON.md` says the daemon polls for claimed tasks, creates an isolated workspace directory, streams results back, sends heartbeats periodically, and deregisters runtimes on shutdown | `CLI_AND_DAEMON.md`, `How It Works` |
| `CLI_AND_DAEMON.md` documents a dedicated workspaces root and daemon-level timeout, polling, heartbeat, and concurrency settings | `CLI_AND_DAEMON.md`, `Configuration` |
| the repo explicitly supports many external providers, including Claude Code, Codex, OpenClaw, Hermes, Gemini, Pi, and Cursor Agent | `README.md`, `What is Multica?`; `agents.mdx`, provider table |
| `Agent`, `RuntimeDevice`, `AgentTask`, and skill records are first-class typed entities | `packages/core/types/agent.ts` |
| `RuntimeDevice` carries workspace ownership, daemon linkage, runtime mode, provider, status, and metadata | `packages/core/types/agent.ts` |
| `Agent` carries runtime selection, instructions, runtime config, custom env/args, visibility, status, concurrency, and attached skills | `packages/core/types/agent.ts` |
| `events.ts` exposes explicit external event types for `task:dispatch`, `task:progress`, `task:completed`, `task:failed`, `task:message`, `task:cancelled`, `daemon:heartbeat`, and `daemon:register` | `packages/core/types/events.ts` |
| `TaskMessagePayload` distinguishes text, thinking, tool use, tool result, and error as separate external message types | `packages/core/types/events.ts` |
| Multica distinguishes `local skills` from `workspace skills` and uses both | `agents.mdx`, `Reusable Skills` |
| the README contrasts Multica with Paperclip as lighter-weight management versus heavier governance | `README.md`, `Multica vs Paperclip` |
| `Autopilot`, `AutopilotTrigger`, and `AutopilotRun` model scheduled or API-triggered execution above direct task assignment, and can link to issues and tasks | `packages/core/types/autopilot.ts` |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `managed agents` | agents treated as teammates under platform control | `README.md`, opening framing | central product identity |
| `daemon` | local runtime bridge | `README.md`, `Getting Started`; `agents.mdx` | key control-plane/runtime bridge |
| `runtime` | compute environment that can execute agent tasks | `README.md`, `What is a Runtime?`; `agent.ts` | platform-level execution primitive |
| `runtime device` | typed registered runtime object | `packages/core/types/agent.ts` | durable runtime inventory record |
| `agent` | managed teammate profile, not just an active loop | `README.md`, `agents.mdx`, `agent.ts` | human-facing management primitive |
| `agent task` | externally tracked execution attempt linked to agent, runtime, issue, and status | `packages/core/types/agent.ts` | durable task-lifecycle primitive |
| `task progress` | externally streamed execution surface rather than implicit CLI output only | `packages/core/types/events.ts` | trace/progress primitive |
| `daemon heartbeat` | explicit liveness record for the runtime bridge | `packages/core/types/events.ts`; `CLI_AND_DAEMON.md` | control-plane liveness primitive |
| `workspace skills` | team-shared skills injected by the platform | `README.md`, `agents.mdx` | shared knowledge primitive |
| `local skills` | skills already installed in the underlying runtime | `agents.mdx` | runtime-local capability primitive |
| `autopilot` | scheduled or API-triggered external work surface above task assignment | `packages/core/types/autopilot.ts` | recurring control-plane primitive |

## Transferable Lessons

- A daemon can bridge local execution environments and a higher-level management surface cleanly.
- Runtime inventory, task lifecycle, and skills can be durable control-plane entities.
- External task progress and daemon-heartbeat events are good references for keeping run visibility outside the harness.
- Recurring work can be modeled above the task layer instead of being embedded inside the runtime itself.
- It can be useful to separate local-runtime skills from team-shared skills.
- External harnesses can remain external while a platform coordinates them as managed workers.

## Non-transferable Baggage

- Multica is optimized for coding-team collaboration rather than evaluation-governed stage
  progression.
- The `agents as teammates` metaphor is product-facing and may over-socialize otherwise mechanical
  runtime concepts.
- It offers weaker guidance on external evaluation and promotion than research-oriented references.
- Its task-centric model is stronger on bridge supervision than on candidate lineage or evidence legitimacy.

## Open Questions / Tensions

- When does a runtime registry become the dominant abstraction instead of the underlying harness?
- How much of the agent-profile object is governance-critical versus board/UI convenience?
- How should local skills and shared skills interact when stronger audit requirements are needed?
- Where should evaluation and promotion live in a platform that is currently task-centric?
- What should be the relationship between task lifecycle records and a stronger candidate/evidence lineage model?
