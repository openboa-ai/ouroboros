---
name: auto-run-memory
description: "Use when current project state must be reconstructed from repo evidence rather than chat: branch, task, PR, dirty state, assumptions, failed attempts, winning evidence, owner, risks, and writeback gaps."
---

# Auto Run Memory

## Role

`auto-run-memory` recovers project state without relying on chat history.

## Workflow

1. Resolve the git common directory and control checkout. Enumerate `git worktree list --porcelain`,
   branch ownership, each relevant worktree's dirty state, upstream, base, latest commits, and the
   intended work item before creating or switching anything.
2. Read repo-level `AGENTS.md`, then `.agents/AGENTS.md`, then `.agents/skills/AGENTS.md`.
3. Read `LINEAR.md` and the latest relevant issue or project-document entries.
4. Read the project state document when the repo defines one.
5. Read only the active docs or project documents needed to recover the current frontier.
6. Read the issue workpad, active writer lease, branch, and PR head through the owning external
   systems when they affect activation or cleanup.
7. Inspect open diffs, staged changes, recent commits, and CI/check outputs only when they affect the
   frontier.
8. Compare repo truth against chat/user claims; prefer repo truth and name any gaps.
9. Emit a `Recovered State Packet` and route the next owner.

## Read Order

- Start with `git status --short --branch`.
- Resolve `git rev-parse --path-format=absolute --git-common-dir`, then run
  `git worktree list --porcelain` before creating a branch or worktree.
- Inspect status in the control checkout and intended issue worktree separately; unrelated dirty
  control-checkout state must not be attributed to the issue worktree.
- Check recent commits with a narrow log when branch history matters.
- Inspect `git diff --stat`, `git diff --name-status`, and staged diff only when dirty state exists.
- Read task/PR metadata only when branch state alone does not explain the frontier.
- Read the project state document before inferring the next PR-sized task.
- Read docs through the repo navigation path instead of scanning the whole repo.

## Recovery Rules

- Repo files, commits, checks, and maintained project documents outrank chat memory.
- If two repo truth sources conflict, name both and route to `auto-project` or `llm-wiki`.
- If branch/PR/CI state conflicts with the project state document, treat the ledger as stale and route
  writeback before continuing.
- If recovery requires unavailable external permissions, mark the state `blocked` rather than
  guessing.
- Do not continue implementation until the current owner and owned boundary are explicit.
- Resume an exact issue/worktree/branch/PR/lease match instead of duplicating it. Park conflicting
  claims and do not choose a writer implicitly.
- A dirty control checkout does not authorize cleanup and does not block work in a verified clean
  dedicated issue worktree.
- Cleanup remains pending until remote merge and external readback, lease release, and a clean
  inactive worktree are all verified from the control checkout.

## Required Output

- goal
- owned boundary
- context read
- current frontier
- control checkout and worktree inventory
- issue worktree, base, branch, PR, writer lease, and cleanup state
- latest accepted assumptions
- failed attempts
- latest winning evidence
- evidence
- decision: `recovered`, `blocked`, or `reroute`
- current owner
- open risks
- next owner
- `writeback_needed`

## Recovered State Packet

Return this shape when recovery is the main output:

```text
goal:
owned_boundary:
context_read:
current_frontier:
control_checkout:
worktree_inventory:
issue_worktree:
base_commit:
branch:
pr:
writer_lease:
cleanup_state:
latest_accepted_assumptions:
failed_attempts:
latest_winning_evidence:
dirty_or_staged_state:
open_risks:
decision:
next owner:
writeback_needed:
llm_wiki_target:
```

## Handoff

If recovery finds missing durable memory, route to `llm-wiki` to repair the gap before more work
depends on chat history.

## Hard Boundaries

- Do not treat chat history as primary memory.
- Do not invent missing project state; report the gap.
- Do not read the whole repo when targeted recovery is enough.
- Do not clean, stash, reset, remove, or reuse a dirty or actively leased worktree during recovery.
