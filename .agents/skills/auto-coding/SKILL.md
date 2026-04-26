---
name: auto-coding
description: Use when a locked project frontier needs exactly one bounded code, docs, config, or CI change; the task has an owned boundary; verification can run locally or in CI; and the result needs a keep/discard/reroute decision without widening interfaces, docs truth, or scope.
---

# Auto Coding

## Role

`auto-coding` changes the repo to close one bounded gap.

## Workflow

1. Check branch and dirty state before editing.
2. Read the locked frontier, active docs, and only the files inside the owned boundary.
3. State one implementation hypothesis.
4. Edit only inside the owned boundary.
5. Run the narrowest valid verification, then broader checks only when risk justifies it.
6. Keep, discard, or reroute based on evidence.
7. Return a handoff packet.

## Implementation Loop

- Baseline: record branch, dirty files, relevant failing check, and expected success signal.
- Hypothesis: state the smallest change likely to close the gap.
- Patch: make focused edits; do not opportunistically refactor.
- Verify: run targeted commands and capture failures exactly.
- Decide: keep only when evidence supports the goal; otherwise discard or reroute.

## Keep / Discard / Reroute

- `keep`: acceptance is met, checks ran or a clear reason explains why not, and residual risk is
  named.
- `discard`: the hypothesis failed, made the code/docs worse, or cannot be verified.
- `reroute`: root cause is outside the owned boundary, scope is wrong, or a different worker is
  needed.

## Failure Handling

Do not respond to a failed narrow fix by silently widening the task. Capture the failure, restore
direction through evidence, and route to `auto-pm`, `auto-qa`, or `ci-recovery` when needed.

## Required Output

- goal
- owned boundary
- context read
- what changed
- verification run
- evidence
- decision: `keep`, `discard`, or `reroute`
- remaining gap
- risks
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
