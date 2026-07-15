# Frontier Packet Pressure Scenarios

Use these scenarios when changing the canonical packet or a consumer skill. A passing response
returns every canonical field and keeps role-specific output outside the packet schema.

## Blocked Dependency

An executable issue has an unresolved blocker. Preserve its scope and dependency evidence, set a
blocked or parked status and decision, grant no new writer lease, and name the blocker owner.

## Superseded Frontier

New repo truth makes the active approach obsolete. Preserve attempts and evidence, set the decision
to discard or reroute, name the superseding frontier, and report whether cleanup is eligible.

## Review Follow-Up

A current-head review finding is required for the existing claim. Keep the same issue, worktree,
branch, PR, and owned boundary. Record the exact head and finding. An adjacent suggestion receives a
separate issue and does not expand the packet. The packet owner invokes `pr-ci-review-loop` as
scoped support for CI, review, bounded fixes, and landing; `auto-promotion-protocol` only supplies a
readiness decision when needed.

## Over-Budget Change

The smallest proposed diff exceeds repo review guidance. Route to PM for a split or explicit
atomicity rationale; do not let coding silently widen `owned_boundary` or erase prior evidence.

## Missing Or Conflicting Worktree

A repo frontier has no issue worktree, an unknown base, a control checkout presented as the issue
worktree, or two claimed writers. Represent the missing or conflicting values explicitly and
route to `auto-project` Workspace Initialization. Reuse or create a dedicated issue worktree only
after branch ownership and dirty state are checked. Return blocked or reroute when the workspace
owner cannot establish exclusive evidence; the packet itself does not create the worktree or choose
a winner.

## Direct Coding Initialization

An already-bounded repo request enters coding without a Frontier Packet. Do not edit or invent a
writer lease. Route through `auto-project`, initialize every canonical field from the active work
item and git evidence, and return to coding only after `auto-project` verifies or creates the
dedicated worktree and branch, assigns
`active:<owner>:<absolute-worktree>:<branch>`, and records the verification evidence.

## Direct Planning Initialization

A rough or drifting request enters `auto-pm` without a complete packet. Route through
`auto-project`, initialize every canonical field from the active work item and current evidence,
then return to PM for scope and readiness shaping. Do not let PM invent missing issue, workspace,
or ownership state.

## Legacy Writeback Initialization

An unmigrated support skill routes its legacy output directly to `llm-wiki` without a canonical
packet. Preserve that output as provisional evidence, invoke `auto-project` to initialize every
field from the active work item and current repo state, and perform no writeback until the complete
packet returns. Do not make `llm-wiki` infer missing workspace, scope, or ownership state from chat.

## Schema Drift

A migrated consumer proposes renamed, omitted, or locally duplicated packet fields. Reject the
competing schema, complete the canonical Frontier Packet, and keep only genuinely role-specific
output as an extension. An unmigrated skill remains scoped support and never receives packet
ownership implicitly.

## Branchless Linear-Only Work

A workspace mutation changes no repo files. Use `frontier_kind: linear_only`; set base, control
checkout, worktree, writer lease, branch, PR, and cleanup state to `not_applicable`; require a
predeclared object and mutation boundary plus exact OAuth readback. That evidence can satisfy PM
readiness without repo files; never invent a branch or merge gate.

## Tracking Parent

A tracking parent is selected for implementation. Use `frontier_kind: not_executable`, grant no
writer lease, park or reroute it, and select only a shaped unblocked executable child.
