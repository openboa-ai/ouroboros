# Source Note: paperclipai/paperclip

## Source

- Title: `paperclipai/paperclip`
- Primary URL: [https://github.com/paperclipai/paperclip](https://github.com/paperclipai/paperclip)
- Source type: implementation repository
- Checked: `2026-04-19`
- Research scope:
  - root `README.md`
  - `ROADMAP.md`
  - root `AGENTS.md`
  - repository landing-page file tree

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| `README.md` | repo root readme | company metaphor, features, comparison to single-agent tools, quickstart | establishes product posture and governance surfaces |
| `ROADMAP.md` | roadmap doc | milestones around budgeting, approvals, routines, outcomes, planning | shows intended control-plane direction |
| root `AGENTS.md` | contributor contract | repo map, control-plane purpose, adapters/plugins, invariants | clarifies internal architecture vocabulary |
| repo tree | repository structure | server/ui/packages split | confirms control-plane implementation posture |

## What This Source Is

Paperclip is a governance-heavy orchestration system for running many agents as a company. It is
not a raw harness. It is best read as a control-plane reference for heartbeats, budgets, approvals,
goal ancestry, ticketing, durable context, and rollback.

## Core Thesis

- Paperclip is a company-level orchestration layer, not a chatbot or single-agent tool.
- It coordinates many external agents through goals, heartbeats, budgets, governance, and tickets.
- Persistent agent state and goal ancestry matter more than one-shot prompt loops.
- Governance is not secondary: approvals, rollback, and budgets are core product features.
- The system is explicitly bring-your-own-agent and runtime-agnostic.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Heartbeat` | scheduled wake-up / work-check loop | `README.md`, features and FAQ |
| `Goal alignment / ancestry` | tasks carry company/project/goal context upward | `README.md`, features and problem/solution table |
| `Budget` | monthly or bounded spend control per agent | `README.md`, features; `ROADMAP.md`, `Better Budgeting` |
| `Governance with rollback` | approval gates plus revisioned config and reversal | `README.md`, `Why Paperclip is special` |
| `Ticket system` | threaded conversations plus immutable audit tracing | `README.md`, features |
| `Bring your own agent` | external harness/runtime integration | `README.md`, opening framing and compatibility table; `AGENTS.md`, repo map |
| `Adapter` | runtime integration packages such as Claude/Codex/Cursor adapters | root `AGENTS.md`, repo map |

### Architectural Reading

- Paperclip is overtly a control-plane product, not a harness.
- Durable truth is in goals, tickets, budgets, approvals, and audit surfaces.
- Runtime execution is delegated outward to adapters and external agents.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| the README explicitly says `If OpenClaw is an employee, Paperclip is the company` | `README.md`, `What is Paperclip?` |
| Paperclip describes itself as orchestration for zero-human companies and a system to manage goals rather than pull requests | `README.md`, opening sections |
| the feature list makes heartbeats, goal alignment, cost control, governance, org charts, and ticketing first-class | `README.md`, `Features` |
| the README says tasks are ticket-based, conversations are threaded, and sessions persist across reboots | `README.md`, `Problems Paperclip solves` |
| `Why Paperclip is special` lists atomic execution, persistent agent state, runtime skill injection, governance with rollback, and goal-aware execution | `README.md`, `Why Paperclip is special` |
| the README says Paperclip is not a chatbot, not an agent framework, and not a single-agent tool | `README.md`, `What Paperclip is not` |
| the README FAQ says agents run by default on scheduled heartbeats and event-based triggers such as task assignment and `@`-mentions | `README.md`, FAQ section near development notes |
| the roadmap makes `Scheduled Routines`, `Better Budgeting`, `Agent Reviews and Approvals`, and `Enforced Outcomes` explicit milestones | `ROADMAP.md`, milestone sections |
| the root `AGENTS.md` says `Paperclip is a control plane for AI-agent companies` and maps adapters/plugins as separate packages | root `AGENTS.md`, `Purpose` and `Repo Map` |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `company` | Paperclip's primary management metaphor | `README.md`, opening framing | defines scope and posture |
| `heartbeat` | recurring scheduled wake-up for work | `README.md`, features and FAQ | always-on orchestration primitive |
| `goal alignment` | tasks linked to company mission and upstream context | `README.md`, features | durable intent model |
| `budget` | cost-control and hard-stop primitive | `README.md`, features; `ROADMAP.md` | governance through resource limits |
| `governance` | operator approvals, overrides, pausing, and rollback | `README.md`, features | explicit control layer |
| `ticket system` | threaded work and immutable audit trace | `README.md`, features | durable work object model |
| `adapter` | concrete integration with an external agent runtime | root `AGENTS.md`, repo map | execution-bridge primitive |
| `control plane` | central product layer managing AI-agent companies | root `AGENTS.md`, purpose | clearest architecture label in the repo |

## Transferable Lessons

- Governance can be treated as a first-class architecture concern rather than admin tooling.
- Persistent work objects such as tickets, budgets, and approvals can outlive any one agent run.
- Scheduled wake-up loops are a real systems primitive, not a convenience feature.
- A control plane can coordinate many external harnesses without owning their internal loops.
- Goal ancestry is a useful way to preserve `why`, not only `what`.

## Non-transferable Baggage

- The company/org-chart metaphor is intentionally heavy and may be overbuilt for smaller systems.
- Paperclip is designed for multi-agent and multi-company operation, which may be premature in
  lighter domains.
- It assumes a management-heavy operator posture that not every runtime product needs.

## Open Questions / Tensions

- How much governance is valuable before the system becomes heavier than the work it manages?
- Which Paperclip ideas belong in a lighter single-domain control plane and which require the full
  company metaphor?
- How much persistent organizational structure is necessary before it slows iteration?
- Where should the boundary sit between agent runtime concerns and company-level governance?
