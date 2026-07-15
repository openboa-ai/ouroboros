---
name: linear-workflow
description: "Use when work needs a policy-backed Linear Initiative, Project, milestone, issue-shape, priority, label, dependency, cycle, state, or GitHub-linkage decision after the external linear skill establishes the target and connected execution path."
---

# Linear Workflow

## Role

`linear-workflow` applies the planning contract read from repository truth to Linear coordination.
It owns the decision procedure for hierarchy, work shape, selection, priority, labels, state,
dependency, cycle, and GitHub linkage. The external `linear` skill owns connected reads and
mutations.

## Workflow

1. Load the external `linear` skill before any Linear read or write. Read root `AGENTS.md`,
   `LINEAR.md`, `docs/development-workflow.md`, and the target Initiative, Project, milestone,
   issue, relations, and existing `## Codex Workpad`.
2. Read both the target program boundaries and any current migration or compatibility rule from
   root policy. Apply the current rule. Split a Project only when the active issue owns that
   migration; otherwise preserve the documented interim structure and point to or queue the
   migration frontier instead of adding a program label.
3. Classify the object and issue shape: Initiative, Project, milestone, tracking parent,
   executable repo issue, Linear-only issue, cycle, view, Document, or workpad.
4. For an executable issue, verify one observable claim, owned boundary, non-goals, acceptance,
   validation, dependencies, and writeback. For a tracking parent, require `Backlog`, no issue
   priority, and explicit `no branch / no PR`. For a Linear-only issue, require one mutation
   surface, exact readback, and explicit `no branch / no PR`.
5. Select only shaped, unblocked executable work that fits WIP. Set issue priority independently
   from Initiative and Project priority: `Urgent` for an active exposure or sole immediate blocker,
   `High` for the next unblocked critical path, `Medium` for planned work, `Low` for optional work,
   and `No priority` for intake, parked work, or tracking parents.
6. Keep Initiative labels to cross-cutting strategic dimensions and Project labels to reusable
   cross-Project operational dimensions. Normalize issue labels to exactly one `area:*`, exactly
   one `type:*`, zero or more `risk:*`, and at most one `gate:*` for a non-derivable human,
   environment, or manual gate. Do not encode program, status, priority, dependency, assignee,
   cycle, delegate, or runner readiness as labels at any level.
7. After creating a subissue, read back and explicitly normalize Project, priority, labels,
   dependencies, and state; Project and priority may inherit while labels do not.
8. Enforce state evidence. `Todo` is selected and unblocked. `In Progress` has an owner and workpad,
   plus branch and base for repo work. `In Review` has PR/local evidence or a Linear-only readback
   gate. `Done` has merged-main evidence or exact post-mutation readback.
9. Predeclare the exact related mutations, execute them through the connected path selected by the
   external `linear` skill, read back the changed objects, and report stable identifiers,
   remaining blockers, and next action.

## Pressure Checks

- Blocked tracker, blocked child, and unblocked `Medium`: keep the tracker `Backlog` with no
  priority, do not select the blocked child, and promote only the shaped unblocked issue when it is
  the next critical path.
- Programs with a target split but a documented interim shared Project: preserve the interim
  milestone, parent, and description boundary unless the active issue owns migration; point to or
  queue that migration and do not hide the mix behind labels.
- Several `Urgent` or ready `High` issues: keep additional selections only for independent active
  exposures or independent staffed critical paths; otherwise normalize the rest.
- Urgent Initiative or Project with ordinary child work: keep the three priority decisions
  independent; do not make every child issue Urgent or High.
- New child inherited parent priority but no labels: explicitly set the child's own priority,
  `area:*`, `type:*`, risks, dependencies, and state before selection.
- External human or environment gate: use one `gate:*` only when assignment, dependency, status,
  cycle, delegate, or GitHub state cannot express it.
- Adjacent review finding: create a separate `Backlog` issue and leave the active PR boundary
  unchanged unless the finding is required for the current claim to be correct.
- Connected Linear execution unavailable: continue repo work that does not require Linear
  mutation, mark writeback blocked with exact evidence, and never fall back to an undeclared
  transport, credential path, or chat memory.

## Required Output

- goal and context read
- program and object type
- issue shape and selection decision
- Initiative, Project, milestone, cycle, state, and dependency decisions
- priority decision and rationale
- labels to keep, add, and remove
- branch and PR decision
- predeclared mutations
- exact changed identifiers and readback evidence
- blockers, next action, and `writeback_needed`

## Handoff

Route an unshaped frontier to `auto-pm`, executable repo work to `auto-coding`, PR landing to
`pr-ci-review-loop`, and durable policy changes to `llm-wiki`. Keep connector execution with the
external `linear` skill.

## Hard Boundaries

- Linear coordinates delivery; repo `main` owns durable product, architecture, code, tests, and
  operating policy.
- Never collapse program boundaries defined by root policy or expose delivery credentials/state to
  the system being delivered.
- Never give a tracking parent, Initiative, Project, milestone, cycle, view, or Document a branch
  or pull request.
- Never use priority or labels as duplicate status, dependency, assignment, or authority fields.
- Never bypass the connected path selected by the external `linear` skill or use chat memory as a
  workflow store.
- Never migrate live Linear configuration outside the active issue's owned boundary.
