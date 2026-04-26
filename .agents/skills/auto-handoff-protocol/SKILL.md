---
name: auto-handoff-protocol
description: Use when autokairos work moves between PM, coding, QA, wiki, CI recovery, skill audit, or final review and needs explicit ownership, evidence, next owner, and writeback status.
---

# Auto Handoff Protocol

## Role

`auto-handoff-protocol` keeps ownership and latest truth explicit.

## Use When

- Work moves between skills or workers.
- A PR/frontier is being parked, rerouted, or promoted.
- The next owner needs enough evidence to continue without chat archaeology.

## Workflow

1. Name the current goal.
2. State current truth and owned boundary.
3. List attempts and evidence.
4. State remaining gap and risks.
5. Choose next owner or stop state.
6. Decide writeback status.

## Required Output

- `goal`
- `current_truth`
- `owned_boundary`
- `attempts_made`
- `evidence`
- `remaining_quality_gap`
- `open_risks`
- `recommended_next_owner`
- `writeback_needed`
- `llm_wiki_target`

## Handoff

If `writeback_needed: yes`, the next owner is `llm-wiki` unless a blocking fix must happen first.

## Hard Boundaries

- One owner at a time.
- No worker continues indefinitely without a new route.
- If the next owner is unclear, route to `auto-project`.
