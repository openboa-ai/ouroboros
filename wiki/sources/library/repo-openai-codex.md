# Source Note: openai/codex

## Source

- Title: `openai/codex`
- Primary URL: [https://github.com/openai/codex](https://github.com/openai/codex)
- Source type: implementation repository
- Checked: `2026-04-19`
- Research scope:
  - root `README.md`
  - `docs/contributing.md`
  - `codex-rs/README.md`
  - adjacent official docs:
    - `https://openai.com/index/introducing-the-codex-app/`
    - `https://openai.com/index/codex-for-almost-everything/`
    - `https://openai.com/codex/`
  - repository landing-page file tree

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| `README.md` | repo root readme | product framing, install modes, CLI/app/web split | establishes Codex product posture |
| `codex-rs/README.md` | runtime doc | maintained Rust CLI, MCP support, exec mode, sandbox policy, code organization | provides concrete runtime/control vocabulary |
| `docs/contributing.md` | process doc | contribution workflow and cross-surface consistency | shows how the project thinks about surfaces and stability |
| `introducing-the-codex-app` | official product announcement | multi-agent threads, long-running tasks, skills, app posture | clarifies background-work product direction above the CLI |
| `codex-for-almost-everything` | official product update | automations, future work scheduling, proactive suggestions, memory | clarifies proactive-work posture and self-wake direction |
| `codex` product page | official product page | always-on background work and automations framing | confirms product positioning |
| repo tree | repository structure | presence of docs, rust workspace, app/cli structure | confirms multi-surface product shape |

## What This Source Is

This repository is Codex's open implementation repository. It is strongest as a local runtime and
repository-guidance reference. The repo combines product framing with concrete runtime controls:
CLI surfaces, sandbox policies, approval/control surfaces, MCP roles, and project-local guidance
through `AGENTS.md`.

## Core Thesis

- Codex is a coding agent that runs locally, but spans CLI, IDE, app, and web surfaces.
- The maintained local runtime is the Rust CLI.
- Sandbox policy and explicit local control are first-class.
- Codex can act as both an MCP client and an experimental MCP server.
- The repository assumes project-local guidance and configuration are part of the runtime contract.
- The contribution model emphasizes consistency across all Codex surfaces.
- The broader Codex product is moving toward long-running, background, and automation-driven work
  above the local CLI runtime.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Codex CLI` | local coding-agent runtime | root `README.md` and `codex-rs/README.md` |
| `Rust CLI` | maintained implementation of Codex CLI | `codex-rs/README.md`, opening section |
| `Sandbox policy` | explicit `--sandbox` choice such as `read-only`, `workspace-write`, `danger-full-access` | `codex-rs/README.md`, sandbox section |
| `codex exec` | non-interactive programmatic run mode | `codex-rs/README.md`, `codex exec` section |
| `MCP client` | connects to MCP servers at startup | `codex-rs/README.md`, `MCP client` section |
| `MCP server` | experimental mode exposing Codex as a tool to another agent | `codex-rs/README.md`, `MCP server (experimental)` |
| `AGENTS.md` | project-local instruction surface | root `README.md` and repo framing around docs; also visible from the repo structure and broader Codex docs posture |
| `Thread` | long-running unit of work in the app organized under projects | `introducing-the-codex-app` |
| `Automation` | scheduled background Codex work with optional skills and review queue landing | `introducing-the-codex-app`; `codex-for-almost-everything` |
| `Review queue` | place where completed automation results land for human continuation or supervision | `introducing-the-codex-app` |
| `Memory` | persistent preference and context layer reused in later work | `codex-for-almost-everything` |
| `Background computer use` | Codex operating GUI apps in parallel while the user keeps working | `codex-for-almost-everything` |
| `Future work scheduling` | Codex scheduling work for itself and waking later to continue | `codex-for-almost-everything` |

### Architectural Reading

- Codex is local-runtime-first, not control-plane-first.
- The repo exposes concrete execution controls rather than abstract orchestration theory.
- The runtime model is explicit about sandbox choices, programmatic execution, and CLI/tool
  integration.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| the root README describes Codex CLI as a coding agent from OpenAI that runs locally on your computer | root `README.md`, opening lines |
| the root README distinguishes CLI, IDE, app, and cloud/web surfaces | root `README.md`, opening/product links |
| `codex-rs/README.md` states the Rust implementation is now the maintained Codex CLI | `codex-rs/README.md`, opening section |
| Codex supports rich configuration through `config.toml` | `codex-rs/README.md`, `Config` |
| Codex functions as an MCP client and can also run as an experimental MCP server | `codex-rs/README.md`, `Model Context Protocol Support` |
| `codex exec` is the non-interactive run surface | `codex-rs/README.md`, `codex exec` section |
| Codex exposes explicit sandbox policies through `--sandbox` and persistent `sandbox_mode` config | `codex-rs/README.md`, sandbox policy section |
| `workspace-write` explicitly includes `~/.codex/memories` in writable roots | `codex-rs/README.md`, sandbox policy section |
| the contribution guide emphasizes consistency across CLI, IDE, web, and other Codex surfaces | `docs/contributing.md`, opening rationale for invited contributions |
| OpenAI's Codex app announcement explicitly frames the app as a command center for agents handling long-running tasks that span hours, days, or weeks | `introducing-the-codex-app`, opening section |
| the Codex app organizes agents into threads by project and uses isolated worktrees so multiple agents can keep working in parallel | `introducing-the-codex-app`, `Work with multiple agents in parallel` |
| the app announcement says Automations let Codex work in the background on an automatic schedule and send results to a review queue | `introducing-the-codex-app`, `Delegate repetitive work with Automations` |
| the April 16, 2026 update says Codex can now schedule future work for itself and wake automatically to continue long-term tasks across days or weeks | `codex-for-almost-everything`, `Carry work forward over time` |
| the same update says Codex now proactively proposes useful follow-up work using projects, plugins, and memory | `codex-for-almost-everything`, `Carry work forward over time` |
| the Codex product page explicitly markets Automations as always-on background work such as issue triage, alert monitoring, and CI/CD | `codex` product page, `Made for always-on background work` |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `Codex CLI` | local coding-agent runtime | root `README.md`, `codex-rs/README.md` | primary harness surface |
| `sandbox` | explicit local execution policy | `codex-rs/README.md` | safety/control vocabulary |
| `read-only / workspace-write / danger-full-access` | concrete sandbox modes | `codex-rs/README.md` | operational control primitives |
| `config.toml` | persistent runtime configuration | `codex-rs/README.md` | stable user control plane inside the CLI |
| `MCP client` | Codex connecting outward to external tool servers | `codex-rs/README.md` | tool-integration model |
| `MCP server` | Codex exposed outward as a tool | `codex-rs/README.md` | reverse-direction integration model |
| `exec` | headless programmatic execution mode | `codex-rs/README.md` | non-interactive automation surface |
| `AGENTS.md` | project-local instruction layer | repo posture / Codex docs ecosystem | repository guidance primitive |
| `thread` | persistent app-level work stream for one agent/task line | `introducing-the-codex-app` | long-running work container above the CLI |
| `automation` | scheduled background Codex job with optional skills | `introducing-the-codex-app`; `codex-for-almost-everything` | proactive-work primitive |
| `review queue` | human re-entry and supervision surface for completed automated work | `introducing-the-codex-app` | governance/supervision surface above automation |
| `memory` | reused preference and experience layer for future tasks | `codex-for-almost-everything` | persistence primitive above one run |
| `background computer use` | GUI-operating runtime capability | `codex-for-almost-everything` | background-execution posture |

## Transferable Lessons

- A local runtime can expose strong control through explicit sandbox and config surfaces.
- Treat non-interactive execution as a first-class mode, not an afterthought.
- Make directionality explicit in protocol support: client mode and server mode are different.
- Keep project-local instructions near the repo, not only in global settings.
- Cross-surface consistency matters when one product spans CLI, IDE, app, and web.
- Background work should land in a human-readable re-entry surface such as a review queue rather
  than disappearing into logs.
- Long-running proactive work can be a product primitive above the local CLI runtime without making
  the CLI itself the sole source of truth.

## Non-transferable Baggage

- The specific sandbox modes, CLI flags, and configuration conventions are Codex-specific.
- The repo is focused on coding workflows rather than external evaluation or staged promotion.
- Contribution restrictions and surface consistency rules are product-governance details, not
  universal runtime principles.
- Codex app automations and background computer use are broader product features than the open repo
  alone exposes.

## Open Questions / Tensions

- How much runtime control should stay in CLI flags versus config files versus repo-local docs?
- When should a local runtime expose itself as a tool to other agents?
- Which Codex local-runtime ideas are universal, and which depend on its specific product stack?
- How much durable truth belongs in project files versus runtime state under `~/.codex/`?
- How much of Codex's future-work scheduling should be treated as app-layer orchestration rather
  than runtime behavior?
