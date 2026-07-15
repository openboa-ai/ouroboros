---
name: auto-coding
description: "Use when a planned repo frontier needs one bounded code, docs, config, or CI change plus local/CI verification and a keep/discard/reroute decision."
---

# Auto Coding

## Role

`auto-coding` changes the repo to close one bounded gap.

## Workflow

1. Load `auto-handoff-protocol` and recover the incoming canonical Frontier Packet. If no packet
   exists, route to `auto-project` to initialize it from the active work item and current git
   evidence before editing.
2. Confirm `frontier_kind: repo`, the locked owned boundary, separate control-checkout and issue
   worktree paths, actual base/branch evidence, and a single writer lease before editing. Reroute
   incomplete, Linear-only, non-executable, or conflicting-writer packets without changing files.
3. Check branch and dirty state, then read active docs and only the files inside the owned boundary.
4. State one implementation hypothesis and edit only inside the owned boundary.
5. Run the narrowest valid verification, then broader checks only when risk justifies it.
6. Keep, discard, or reroute based on evidence and update the same packet.

## Implementation Loop

- Baseline: record branch, dirty files, relevant failing check, and expected success signal.
- Hypothesis: state the smallest change likely to close the gap.
- Patch: make focused edits; do not opportunistically refactor.
- Verify: run targeted commands and capture failures exactly.
- Decide: keep only when evidence supports the goal; otherwise discard or reroute.

If an external execution-plan skill is available and an approved plan exists, follow that plan's
steps instead of inventing a new implementation path. Still report repo-local evidence, changed
paths, and `writeback_needed`.

## Keep / Discard / Reroute

- `keep`: acceptance is met, checks ran or a clear reason explains why not, and residual risk is
  named.
- `discard`: the hypothesis failed, made the code/docs worse, or cannot be verified.
- `reroute`: root cause is outside the owned boundary, scope is wrong, or a different worker is
  needed.

## Failure Handling

Do not respond to a failed narrow fix by silently widening the task. Capture the failure and route
the packet to `auto-pm` when scope must change or `auto-project` when `auto-qa`, `ci-recovery`, or
another unmigrated support skill is needed.

## Required Output

- every canonical Frontier Packet field from `auto-handoff-protocol`
- implementation extension: `implementation_hypothesis` and `verification_run`

Record changed paths and behavior in `changes_or_findings`; use the packet's `decision` for `keep`,
`discard`, or `reroute`. Do not return an implementation-specific handoff schema.

## Handoff

If the change creates durable product, design, source, branch, CI, or workflow truth, set
`writeback_needed: yes` and route to `llm-wiki`.

## Hard Boundaries

- Do not run multiple speculative fixes at once.
- Do not keep unverified changes.
- Do not silently widen public interfaces, docs truth, or system authority.
- Do not alter unrelated dirty worktree state.
