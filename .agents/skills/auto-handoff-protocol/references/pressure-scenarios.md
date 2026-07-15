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
separate issue and does not expand the packet.

## Over-Budget Change

The smallest proposed diff exceeds repo review guidance. Route to PM for a split or explicit
atomicity rationale; do not let coding silently widen `owned_boundary` or erase prior evidence.

## Missing Or Conflicting Worktree

A repo frontier has no issue worktree, an unknown base, a control checkout presented as the issue
worktree, or two claimed writers. Represent the missing or conflicting values explicitly and
return blocked or reroute. The packet does not create the worktree or choose a winner.

## Schema Drift

A consumer proposes renamed, omitted, or locally duplicated packet fields. Reject the competing
schema, complete the canonical Frontier Packet, and keep only genuinely role-specific output as an
extension.

## Branchless Linear-Only Work

A workspace mutation changes no repo files. Use `frontier_kind: linear_only`; set base, control
checkout, worktree, writer lease, branch, PR, and cleanup state to `not_applicable`; require a
predeclared mutation and exact object readback; never invent a branch or merge gate.

## Tracking Parent

A tracking parent is selected for implementation. Use `frontier_kind: not_executable`, grant no
writer lease, park or reroute it, and select only a shaped unblocked executable child.
