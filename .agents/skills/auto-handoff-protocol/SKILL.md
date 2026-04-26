---
name: auto-handoff-protocol
description: Use when repository work moves between PM, coding, QA, wiki, CI recovery, skill audit, or final review and needs a standard handoff packet with ownership, evidence, decision, next owner, and writeback status.
---

# Auto Handoff Protocol

## Role

`auto-handoff-protocol` keeps ownership and latest truth explicit.

## Workflow

1. Name the current goal.
2. State current truth and owned boundary.
3. List attempts and evidence.
4. State remaining gap and risks.
5. Choose next owner or stop state.
6. Decide writeback status.

## Handoff Packet Template

```text
goal:
context_read:
current_truth:
owned_boundary:
attempts_made:
changes_or_findings:
evidence:
remaining_quality_gap:
open_risks:
decision:
next owner:
writeback_needed:
llm_wiki_target:
```

## Quality Bar

- The next owner can continue from repo evidence without chat memory.
- The owned boundary names what may change and what must not.
- Evidence includes commands, files, docs, CI runs, review notes, or source refs.
- Risks distinguish blockers from acceptable residual risk.
- `writeback_needed` is explicit even when the answer is `no`.

## Required Output

- `goal`
- `context_read`
- `current_truth`
- `owned_boundary`
- `attempts_made`
- `changes_or_findings`
- `evidence`
- `remaining_quality_gap`
- `open_risks`
- `decision`
- `next owner`
- `recommended_next_owner`
- `writeback_needed`
- `llm_wiki_target`

## Handoff

If `writeback_needed: yes`, the next owner is `llm-wiki` unless a blocking fix must happen first.

## Hard Boundaries

- One owner at a time.
- No worker continues indefinitely without a new route.
- If the next owner is unclear, route to `auto-project`.
