# Generic Skill Registry

`.agents/skills/` contains reusable project-harness skills. Skills are bounded capabilities loaded on demand, not always-on policy. Always-on policy belongs in [../AGENTS.md](../AGENTS.md).

## Project Operating Flow

Recover -> Context -> Shape -> Execute -> Evaluate -> Promote -> Persist -> Clean

| Phase | Default skill | Use when |
| --- | --- | --- |
| Recover | `auto-run-memory` | current branch, task, assumptions, failed attempts, or evidence must be reconstructed from repo state |
| Context | `project-context` | current repo thesis, domain, constraints, active docs, or project-document context is needed |
| Shape | `auto-project` | ownership, route, stop state, or work direction is unclear |
| Shape | `auto-pm` | a rough request needs one bounded frontier with acceptance and validation |
| Shape | `taxonomy-design` | durable concepts, schema families, or domain names need vocabulary design before implementation |
| Execute | `auto-coding` | one bounded code, documentation, or config change must be made and verified |
| Evaluate | `auto-qa` | a frontier needs scenario, regression, edge-case, or reader acceptance pressure |
| Evaluate | `ci-recovery` | local checks or remote CI fail and need root-cause routing |
| Promote | `auto-promotion-protocol` | a frontier, branch, release, or PR needs a landing/readiness decision |
| Persist | `llm-wiki` | durable source/project-document/project-memory writeback is needed |
| Clean | `auto-garbage-collection` | stale docs, duplicate memory, or old run notes block resumption |

## Phase Evidence

Recover produces state evidence. Context names pages read. Execute produces diff and verification. Promote returns `looping`, `final-signoff`, `ready-to-land`, `reroute`, or `discarded`. Persist records only durable facts.

## Default Routing

1. If current state is unclear, use `auto-run-memory`.
2. If the next owner is unclear, use `auto-project`.
3. If naming or taxonomy is the source of ambiguity, use `taxonomy-design`.
4. If the task is already bounded, use the matching worker directly.
5. Before stopping, decide `writeback_needed: yes/no`.
6. If `writeback_needed: yes`, route to `llm-wiki`.

## Codex Feature Routing

Use repo-local skills for repeatable workflow, external plugins for connected systems, and
project-scoped subagents for read-heavy parallel evidence. A subagent report is input evidence,
not a final decision. The main worker still owns patch scope, validation, and handoff.

Recommended subagent uses:

- context exploration before planning a broad task
- code-path mapping before implementation
- review of a branch or diff before promotion
- browser or UI reproduction evidence before a focused fix

Do not create a new skill or subagent for one-off work. Prefer updating this registry when a
capability becomes reusable.

## External Workflow Skills

This is the registry-level Skill-First Gate. `superpowers:using-superpowers` maps to skill selection. `superpowers:brainstorming` maps to `auto-pm`. `superpowers:executing-plans` maps to `auto-coding`. `superpowers:systematic-debugging` maps to `ci-recovery`. `superpowers:verification-before-completion` and `superpowers:finishing-a-development-branch` map to `auto-promotion-protocol`.

## PR-Unit Conductor Mode

When a repo has a project state document, `auto-project` uses it as the first operational state source after branch status. Product docs own product truth. Architecture docs own design truth. Skills own workflow, not truth.

## Skill Quality Standard

Every `SKILL.md` must be a valid Agent Skill and stay cheap to discover.

- Use YAML frontmatter with only `name` and `description`.
- Keep `name` lowercase hyphen-case, 1-64 characters, no leading/trailing hyphen, no `--`, and matching the skill directory.
- Keep `description` under 1024 characters, start it with `Use when`, and describe user intent, trigger context, and ownership boundary. Prefer one precise sentence over a generic capability summary.
- Quote frontmatter values that contain YAML-sensitive punctuation such as `: `.
- Keep the body focused on `Role`, `Workflow`, `Required Output`, `Handoff`, and `Hard Boundaries`. Put detailed examples or long references in one-hop `references/` files and say exactly when to read them.
- Keep each skill generic. Skills must not embed project-specific product truth; read root `AGENTS.md`, `README.md`, `LINEAR.md`, and maintained project documents for project context.

## Mandatory llm-wiki Gate

Use `llm-wiki` when durable product/design decisions, source interpretation, branch/task/PR/run/release outcome, CI or QA result, skill routing, harness policy, active/historical documentation boundary, read-path, or stale-term cleanup must survive chat.

## Handoff Packet

Every worker should return `goal`, `context_read`, `owned_boundary`, `changes_or_findings`, `evidence`, `decision`, `risks`, `next_owner`, `writeback_needed`, and `llm_wiki_target` when writeback is needed.

For PR-unit routing, `auto-project` should return an `Auto Project Run Packet` with `current_mlp`, `active_frontier`, `branch`, `pr`, `status`, `context_read`, `route`, `skills_considered`, `evidence_required`, `next_owner`, and `writeback_needed`.

## Boundary Rules

- `auto-project` schedules repo work, not product behavior.
- `auto-pm` locks scope and acceptance; it does not implement.
- `auto-coding` implements one bounded change and verifies before keeping it.
- `auto-qa` can veto; it does not fix by default.
- `ci-recovery` extracts actionable check evidence; it does not broaden the work.
- `llm-wiki` owns source ingest, project-document health checks, and durable writeback.
