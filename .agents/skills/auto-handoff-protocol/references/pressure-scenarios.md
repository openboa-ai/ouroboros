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
separate issue only after it passes issue admission; otherwise retain it in the active workpad or
tracking parent without expanding the packet. The packet owner invokes `pr-ci-review-loop` as scoped
support for CI, review, bounded fixes, and landing; `auto-promotion-protocol` only supplies a
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
a winner. In a fresh checkout, verify the ignored directory with `.worktrees/` or the intended child
path; checking the nonexistent `.worktrees` pathname without its directory form is not evidence.

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

## Independent Outcome Fan-Out

A stable foundation is already on `main`, and two sibling outcomes are independently usable, have
distinct owned boundaries, acceptance, and validation, save more parallel wall time than their
additional delivery cycles cost, and have named writer capacity now. Give neither sibling a
dependency on the other. Start both from the same stable base in separate issue worktrees, and
require that either merge order preserves each outcome.

## Legitimate Fan-In

An integration frontier validates the combined behavior of several independently useful merged
components and closes a distinct rollout, migration, qualification, or risk decision. Block the
integration issue on the exact component issues whose artifacts it consumes, start it only after
those artifacts are on `main`, and keep integration acceptance distinct from component acceptance.

## Micro-Component Fan-In

Two helpers own different files and can merge in either order, but neither is useful until a third
issue wires them together. Reject the split and keep the helpers plus necessary wiring in one
outcome packet. Code independence does not offset three issue, worktree, PR, CI, review, merge,
cleanup, and writeback cycles.

## False Creation-Order Blocker

Two siblings were linked only because one was written or expected to be reviewed first. Remove the
blocking relation, use priority or cycle placement for preference, and retain a dependency only if
the blocked issue requires a concrete artifact or contract that is not available on `main`.

## Inseparable Scope

One proposed issue cannot start or validate without another sibling's unmerged implementation,
both mutate the same unstable contract, or one does not close independent delivery value. Combine
their necessary implementation and wiring as one outcome packet. If it exceeds the scope budget,
review outcome coherence, risk, ownership, rollback, and validation and record a rationale when it
is still the smallest safe result; do not manufacture helper and glue issues to fit the number.

## Issue Admission Rejection

A review fix already belongs to the active claim, an outcome duplicates existing work, a transient
failure is not reproducible, or an idea lacks an owned boundary and validation. Do not create an
issue. Record the evidence in the active workpad or tracking parent and admit a future issue only
after it owns a distinct durable claim and independent execution contract.

## Clean Worktree Creation

A shaped repo issue has no existing workspace. Fetch and pin the intended base from the control
checkout, verify the ignored directory path, create one `codex/OURO-NNN-short-slug` branch in one
dedicated issue worktree, verify clean status, and assign one writer lease before any edit.

## Parallel Issue Worktrees

Two admitted siblings run concurrently. Each has its own branch, absolute worktree, base, writer
lease, build output, service port, and cleanup authority. Shared read-only caches are allowed;
shared mutable resources require an explicit lease and must not create hidden sibling ordering.

## Stacked Dependency Worktree

A true dependency requires code that is not yet on `main`. Record the dependency head as the base,
create a separate worktree and branch for the dependent issue, target the dependency PR explicitly,
and never reuse the dependency's worktree or writer lease.

## Stale Recovery

Chat says a new workspace is needed, but repo and external state may have advanced. Enumerate the
git common directory, worktrees, branch ownership, per-worktree dirty state, open PR heads, and
workpad leases. Resume the one exact matching frontier or report a conflict instead of creating a
duplicate branch, worktree, issue, or PR.

## Dirty Control Checkout

The root control checkout contains unrelated user changes. Preserve them, use it only for fetch and
worktree inventory, and perform implementation in the dedicated clean issue worktree. Dirty control
state is not permission to clean, stash, reset, or move the user's files.

## Duplicate Activation

An assignment event fires while the issue already owns a branch, worktree, PR, or active lease.
Read back all four surfaces, resume the matching owner when consistent, and otherwise park with the
conflict. Never create a second writer or workspace merely because the event was delivered twice.

## Failed Cleanup

The remote PR is merged, but external readback is incomplete, the worktree is dirty, or a lease is
still active. Record cleanup as pending and preserve the workspace. Cleanup may proceed only after
merge and workflow readback, lease release, and a clean inactive worktree are all verified from the
control checkout.
