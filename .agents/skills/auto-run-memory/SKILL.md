---
name: auto-run-memory
description: Use when a worker needs to reconstruct current project state from repo evidence instead of chat history: branch/task/PR status, assumptions, failed attempts, winning evidence, owner, open risks, and writeback gaps.
---

# Auto Run Memory

## Role

`auto-run-memory` recovers project state without relying on chat history.

## Workflow

1. Identify branch, upstream, dirty files, latest local commits, and the intended work item.
2. Read repo-level `AGENTS.md`, then `.agents/AGENTS.md`, then `.agents/skills/AGENTS.md`.
3. Read `LINEAR.md` and the latest relevant issue or project-document entries.
4. Read the project state document when the repo defines one.
5. Read only the active docs or project documents needed to recover the current frontier.
6. Inspect open diffs, staged changes, recent commits, and CI/check outputs only when they affect the
   frontier.
7. Compare repo truth against chat/user claims; prefer repo truth and name any gaps.
8. Emit a `Recovered State Packet` and route the next owner.

## Read Order

- Start with `git status --short --branch`.
- Check recent commits with a narrow log when branch history matters.
- Inspect `git diff --stat`, `git diff --name-status`, and staged diff only when dirty state exists.
- Read task/PR metadata only when branch state alone does not explain the frontier.
- Read the project project state document before inferring the next PR-sized task.
- Read docs through the repo navigation path instead of scanning the whole repo.

## Recovery Rules

- Repo files, commits, checks, and maintained project documents outrank chat memory.
- If two repo truth sources conflict, name both and route to `auto-project` or `llm-wiki`.
- If branch/PR/CI state conflicts with the project state document, treat the ledger as stale and route
  writeback before continuing.
- If recovery requires unavailable external permissions, mark the state `blocked` rather than
  guessing.
- Do not continue implementation until the current owner and owned boundary are explicit.

## Required Output

- goal
- owned boundary
- context read
- current frontier
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
