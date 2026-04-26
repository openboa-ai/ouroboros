---
name: auto-coding
description: Use when a locked project frontier needs exactly one bounded code, docs, config, or CI change; the task has an owned boundary; verification can run locally or in CI; and the result needs a keep/discard/reroute decision without widening interfaces, docs truth, or scope.
---

# Auto Coding

## Role

`auto-coding` changes the repo to close one bounded gap.

## Workflow

1. Establish baseline evidence.
2. State one implementation hypothesis.
3. Edit only inside the owned boundary.
4. Run narrow verification.
5. Keep, discard, or reroute based on evidence.
6. Return a handoff packet.

## Required Output

- goal
- owned boundary
- what changed
- verification run
- evidence
- decision: `keep`, `discard`, or `reroute`
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
