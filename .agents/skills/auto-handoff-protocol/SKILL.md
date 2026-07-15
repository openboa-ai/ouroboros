---
name: auto-handoff-protocol
description: "Use when repo work moves among routing, PM, coding, and writeback consumers and needs one canonical Frontier Packet carrying ownership, workspace identity, evidence, decision, next owner, cleanup, and writeback state."
---

# Auto Handoff Protocol

## Role

`auto-handoff-protocol` owns the one canonical Frontier Packet exchanged by the currently migrated
repository-delivery consumers: `auto-project`, `auto-pm`, `auto-coding`, and `llm-wiki`. These
skills complete this packet and may add role-specific output, but they do not define competing
packet schemas. Other workflow skills are outside this packet-version contract until migrated.

## Workflow

1. Read repository truth, the active issue or work item, current git/PR state, and the incoming
   Frontier Packet when one exists.
2. Fill every canonical field from current evidence before the next owner acts. Preserve prior
   attempts and evidence; correct stale fields explicitly instead of silently replacing history.
3. Validate `frontier_kind` and its workspace fields. A `repo` frontier names actual base,
   worktree, writer lease, and branch state. A `linear_only` frontier marks repo-only fields
   `not_applicable`. A `not_executable` item cannot own a writer and must be parked or rerouted.
4. Let the current migrated owner perform only its bounded role, then update the same packet with
   findings, evidence, decision, remaining gap, cleanup state, and next owner. A supporting
   unmigrated skill does not receive packet ownership; the current owner records its result.
5. Decide writeback and return the complete packet plus only the current owner's role-specific
   output.

## Frontier Packet

```text
issue_id:
frontier_kind:
goal:
context_read:
current_truth:
owned_boundary:
non_goals:
dependencies:
acceptance:
validation:
base:
control_checkout:
worktree:
writer_lease:
branch:
pr:
status:
attempts_made:
changes_or_findings:
evidence:
remaining_gap:
risks:
decision:
current_owner:
next_owner:
cleanup_state:
writeback_needed:
llm_wiki_target:
```

Use `not_applicable`, `unknown`, or `pending` rather than omitting a field. `frontier_kind` is
`repo`, `linear_only`, or `not_executable`. The packet reports workflow truth; it does not create a
worktree, grant a writer lease, merge a PR, mutate Linear, or certify acceptance by itself.

## Quality Bar

- The next owner can continue from repo evidence without chat memory.
- The issue, kind, goal, owned boundary, non-goals, dependencies, acceptance, and validation remain
  stable across owners unless an explicit reroute changes them.
- Repo work identifies the root control checkout separately from one actual issue worktree and at
  most one active writer lease. The control checkout is not the issue writer workspace. Missing or
  conflicting workspace evidence cannot be represented as ready.
- Linear-only work has `base`, `control_checkout`, `worktree`, `writer_lease`, `branch`, `pr`, and
  `cleanup_state` set to `not_applicable`; exact object readback belongs in `validation` and
  `evidence`.
- Tracking parents and other non-executable items use `not_executable`, have no writer, and are
  parked or rerouted instead of implemented.
- Evidence includes commands, files, docs, CI runs, review notes, or source refs.
- For PR-backed work, review evidence names the current head SHA and whether feedback is handled,
  no-suggestion, pending, unavailable, or intentionally handed to a human.
- Adjacent findings stay outside `owned_boundary` and are rerouted instead of expanding the packet.
- Risks distinguish blockers from acceptable residual risk, and cleanup never claims removal of a
  dirty, active, or leased workspace.
- `writeback_needed` is explicit even when the answer is `no`.

Read [references/pressure-scenarios.md](references/pressure-scenarios.md) when changing this packet,
updating a consumer skill, or auditing handoff behavior.

## Required Output

- every Frontier Packet field
- current migrated owner's role-specific output, if any

## Handoff

If `writeback_needed: yes`, route the packet to `llm-wiki` after any blocking fix. The receiving
owner updates the same packet rather than reconstructing one from chat.

## Hard Boundaries

- One owner at a time.
- One active writer lease per repo worktree.
- No omitted canonical fields or aliases from a migrated consumer.
- No worker continues indefinitely without a new route.
- If the next owner is unclear, route to `auto-project`.
