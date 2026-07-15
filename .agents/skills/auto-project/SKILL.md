---
name: auto-project
description: "Use when repo work needs routing across branch, PR, task, implementation thread, workflow skill, or project state because ownership, scope, blockers, next worker, or stop state is unclear."
---

# Auto Project

## Role

`auto-project` owns repo-work routing. It is the only project harness scheduler.

It schedules work in the repository. It must not be confused with the product runtime of whatever
system the repository builds.

## Workflow

1. Load `auto-handoff-protocol` and recover the incoming canonical Frontier Packet when one exists.
   If none exists, initialize every field from the active issue or work item and current git
   evidence, using explicit `unknown`, `pending`, or `not_applicable` values for unresolved fields.
2. Recover current repo truth from branch, task/PR metadata, `LINEAR.md`, relevant project
   documents, and CI; reconcile that evidence into the packet. For a `repo` frontier,
   `auto-project` is the workspace owner until it verifies or establishes the control checkout,
   issue worktree, base, branch, and single writer lease as described below.
3. If a project state document exists, read it before selecting work.
4. Check whether external workflow skills are available and relevant.
5. Name exactly one active executable frontier. Park or reroute tracking parents as
   `not_executable` instead of assigning them an implementation owner.
6. Transfer canonical packet ownership only to one migrated owner: `auto-pm`, `auto-coding`, or
   `llm-wiki`. When another workflow skill is needed, retain packet ownership, invoke it as scoped
   support, and record its result in `changes_or_findings` and `evidence`. If it must own the next
   step, park or reroute rather than claiming a canonical handoff.
7. Require evidence before keeping changes and update the same packet with the route and owner.
8. Route to `llm-wiki` when durable decisions need writeback.

## Workspace Initialization

`auto-project` owns the transition from an uninitialized `repo` packet to a workspace that one
writer can use. The packet records this transition; it does not perform it.

1. Inspect `git worktree list --porcelain`, the intended base, current branch ownership, and the
   selected worktree's status.
2. Reuse an existing dedicated issue worktree only when its absolute path, base, and branch match
   the active issue and it contains no unrelated dirty state. Otherwise create the issue worktree
   and branch through the repo's worktree workflow. Never use the control checkout as the issue
   writer workspace.
3. Refuse the lease when the branch is checked out by another worktree, the worktree contains
   unrelated changes, or another active packet already names a writer for that worktree. Record the
   conflict and park or reroute instead of choosing a winner.
4. When those checks pass, assign one logical lease to the next migrated writer and record it as
   `active:<owner>:<absolute-worktree>:<branch>` plus the verification commands in `evidence`.
   Existing dedicated checkout and branch evidence can satisfy this step; a second worktree is not
   required.
5. On owner handoff, release the prior holder and assign the same workspace lease to the new owner
   in one packet update. On merge, discard, or cleanup, mark it `released` before removing the
   worktree or branch.

This lease is an explicit workflow ownership assertion, not a filesystem lock. If exclusive
ownership cannot be established from current evidence, coding remains blocked. Lifecycle and
stronger enforcement may be implemented by a separate bounded workflow change without making this
initialization path undefined.

## Skill-First Gate

Before routing or acting, check whether a repo-local or external skill should govern the next step.

- If user intent, design, or acceptance is unclear, shape before implementation.
- If a written plan exists, execute the plan instead of improvising.
- If a check fails, debug root cause before patching.
- If work is claimed complete, verify before claiming completion.
- If work is ready to integrate, use a finish/PR/merge decision flow.

This gate is process discipline, not product behavior. It does not override explicit user
instructions or maintained repo truth.

## Ledger-First PR-Unit Mode

Use this mode when the repo tracks PR-sized frontiers.

1. Read branch state and the project state document.
2. If an active frontier exists, continue it unless evidence says it is blocked or ready.
3. If no active frontier exists, choose the first queued frontier whose prerequisite is met.
4. Route by status:
   - `queued`: park unless prerequisite is met
   - `implementation-ready`: `auto-pm` or `auto-coding`
   - `in-progress`: `auto-coding`; invoke `auto-qa` as scoped support when needed
   - `pr-open`: retain `auto-project` ownership while invoking `pr-ci-review-loop` as the landing
     conductor; use `ci-recovery` for failed checks and `auto-promotion-protocol` for an ambiguous
     readiness decision
   - `ready-to-land`: retain `auto-project` ownership through the recorded landing decision
   - `merged`: `llm-wiki`, then select next frontier
   - `blocked`: blocker owner or user action
5. Persist frontier state changes through `llm-wiki`.

## Superpowers-Compatible Mapping

When Superpowers skills are installed in the current environment, use them as external process
skills behind the same repo-local ownership model:

| Need | Prefer when available | Repo-local fallback |
| --- | --- | --- |
| skill selection discipline | `superpowers:using-superpowers` | this skill's Skill-First Gate |
| clarify intent or design | `superpowers:brainstorming` | `auto-pm` |
| write an implementation plan | `superpowers:writing-plans` | `auto-pm` |
| isolated branch/worktree setup | `superpowers:using-git-worktrees` | `auto-run-memory` plus git hygiene |
| execute an approved plan | `superpowers:executing-plans` or `superpowers:subagent-driven-development` | `auto-coding` |
| debug a failing check or bug | `superpowers:systematic-debugging` | `ci-recovery` |
| request independent review | `superpowers:requesting-code-review` | `auto-qa` |
| verify before completion | `superpowers:verification-before-completion` | `auto-promotion-protocol` |
| finish a branch | `superpowers:finishing-a-development-branch` | `auto-promotion-protocol` |

External workflow skills may strengthen the route, but they do not own project truth. The project
state document, maintained docs, git state, checks, and `llm-wiki` writeback remain authoritative.

## Routing Decision Table

| Situation | Route |
| --- | --- |
| Current state, branch, or assumptions are unclear | retain ownership; invoke `auto-run-memory` as support |
| Project framing or active docs are unclear | retain ownership; invoke `project-context` as support |
| Scope, owner, non-goals, or acceptance are unclear | `auto-pm` |
| One bounded change is ready to make | `auto-coding` |
| Work is claimed done or risky | retain ownership; invoke `auto-qa` as support |
| A PR is open and needs current-head CI, review, fixes, or merge | retain ownership; invoke `pr-ci-review-loop` as support |
| Local checks or remote CI fail | retain ownership; invoke `ci-recovery` as support |
| Promotion or landing state is unclear | retain ownership; invoke `auto-promotion-protocol` as support |
| Durable decision or result must survive chat | `llm-wiki` |
| Repo memory is stale, duplicated, or hard to resume | retain ownership; invoke `auto-garbage-collection` as support |
| Skill surface itself is drifting | retain ownership; invoke `harness-skill-audit` as support |

## Stop States

- `routed`: next owner is known and has enough context.
- `blocked`: work cannot continue without external input, permission, or missing evidence.
- `ready`: acceptance, validation, and writeback posture are current.
- `discarded`: the change or route should not continue.
- `parked`: valid work exists but is not the active frontier now.

## Required Output

- every canonical Frontier Packet field from `auto-handoff-protocol`
- routing extension: `route`, `skills_considered`, `evidence_required`, and
  `repo_routing_reason`
- `project_state_reference`, when the repo maintains one

Use the packet's `decision` for `route`, `park`, `discard`, `ready`, or `blocked`. Do not create an
Auto Project-specific packet or aliases for the active issue, branch, PR, owner, or status.

## Handoff

`auto-project` should not be the final memory. If the route produces durable truth, stop only after
`llm-wiki` writes it back or explicitly records why writeback is unnecessary.

## Hard Boundaries

- Do not implement directly unless the user explicitly asks to bypass the harness.
- Do not allow multiple active writers.
- Do not route a `repo` frontier to coding before completing Workspace Initialization.
- Do not transfer canonical packet ownership to an unmigrated consumer.
- Do not move work forward without current evidence.
- Do not let chat history be the only memory of a completed decision.
