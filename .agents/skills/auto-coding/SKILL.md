---
name: auto-coding
description: Use when a locked project frontier needs one bounded code, docs, config, or CI change, verification, and a keep/discard decision without widening interfaces or scope.
---

# Auto Coding

## Role

`auto-coding` changes the repo to close one bounded gap.

## Use When

- The user or `auto-pm` has locked the frontier.
- A code, docs, CI, or reliability change is needed.
- The change can be verified in the current repo.

## Workflow

1. Establish baseline evidence.
2. State one implementation hypothesis.
3. Edit only inside the owned boundary.
4. Run narrow verification.
5. Keep, discard, or reroute based on evidence.
6. Return a handoff packet.

## Required Output

- what changed
- verification run
- keep/discard/reroute decision
- remaining gap
- next owner
- `writeback_needed`

## Handoff

If the change creates durable product, design, source, branch, CI, or workflow truth, set
`writeback_needed: yes` and route to `llm-wiki`.

## Hard Boundaries

- Do not run multiple speculative fixes at once.
- Do not keep unverified changes.
- Do not silently widen public interfaces, docs truth, or system authority.
- Do not alter unrelated dirty worktree state.
