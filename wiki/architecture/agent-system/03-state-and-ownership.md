# Agent State And Ownership

This page defines which state surfaces belong to the autokairos agent system and where each one is
owned.

It follows:

- [01-overview.md](01-overview.md)
- [02-execution-lifecycle.md](02-execution-lifecycle.md)
- [../02-core-primitives.md](../specs/02-core-primitives.md)
- [../04-boundaries.md](../specs/04-boundaries.md)
- [../09-trace-contract.md](../specs/09-trace-contract.md)
- [../control-plane/03-record-model.md](../control-plane/03-record-model.md)
- [../../sources/library/anthropic-managed-agents.md](../../sources/library/anthropic-managed-agents.md)
- [../../sources/library/openai-next-evolution-of-the-agents-sdk.md](../../sources/library/openai-next-evolution-of-the-agents-sdk.md)
- [../../sources/library/repo-anthropics-claude-code.md](../../sources/library/repo-anthropics-claude-code.md)

## Thesis

The agent system only stays legible if its state surfaces are split by ownership.

The main question is not "what state exists?"

It is:

**which layer owns each state surface, how durable is it, and what survives if one runtime process
or one container disappears?**

## State Ownership Matrix

| State surface | What it is | Primary owner | Durability | If container dies |
| --- | --- | --- | --- | --- |
| `AgentIdentity` | persistent identity of the acting agent | control plane | durable | unaffected |
| `Candidate` | promotable lineage object | control plane | durable | unaffected |
| `Stage` | current legitimacy level | control plane | durable | unaffected |
| `StageBinding` | resolved execution semantics for a stage | control plane / invocation layer | durable per run intent | can be recomputed |
| `Session` | continuity surface for future turns or resumed runs | control plane | durable | should survive |
| `Workspace` | bounded execution surface for one active attempt | agent system / execution host | disposable | may be recreated |
| runtime session | harness-local active loop state | runtime / driver | semi-durable at best | may be lost |
| checkpoint state | runtime-local rewind aid | runtime / workspace | local convenience | may be lost or recreated |
| project memory / local notes | runtime-local continuity aid | runtime / host-local storage | medium | may survive only if intentionally externalized |
| execution handle | bridge-local operational reference for an active attempt | runtime connector | temporary | becomes invalid |
| `Trace` | external raw run history | control plane trace sink | durable | should survive |
| `EvidenceRecord` | judged artifact derived from trace | evaluation system / control plane | durable | unaffected |
| `PromotionDecision` | explicit governance act | control plane | durable | unaffected |

## Durable Truth Versus Execution State

The key split is simple.

### Durable truth

Belongs outside the live runtime:

- `AgentIdentity`
- `Candidate`
- `Stage`
- `Session`
- `Trace`
- `EvidenceRecord`
- `PromotionDecision`

### Execution state

Belongs to the active or recently active execution path:

- `Workspace`
- runtime session
- checkpoints
- bridge-local execution handle

This is why container loss should be a runtime failure or interruption, not a total system-memory
loss.

## The Most Important Boundaries

### `Session` is not `Workspace`

`Session` is continuity.

`Workspace` is bounded execution state.

The system should be able to rebuild a workspace from the combination of:

- candidate reference
- session continuity
- stage binding
- invocation context

### `Trace` is not runtime memory

Runtime memory and checkpointing can help the agent continue work.

They are not the canonical record of what happened.

That belongs to the external trace.

### `StageBinding` is not prompt text

Stage meaning must exist before the runtime starts.

It cannot be treated as a soft convention embedded only in instructions.

### runtime approval is not progression governance

Approval prompts during execution may influence what the runtime can do next.

They do not change candidate standing by themselves.

## Runtime-Local State Surfaces

The runtime may maintain several local state surfaces that are useful but non-canonical.

### Workspace-local artifacts

Examples:

- temporary outputs
- generated files
- scratch notes
- intermediate logs

### Runtime-local checkpoints

Examples:

- Claude Code checkpoints
- undo stacks
- harness-local state rewinds

### Runtime-local memory

Examples:

- project memory
- session-local caches
- local state snapshots

These should all be treated as:

- helpful
- sometimes necessary
- never sufficient as the durable system record

## What Must Survive A Lost Container

The first serious autokairos implementation is container-backed.

So the state model must assume that a container can disappear.

If that happens, the system should still retain:

- agent identity
- candidate standing
- stage and stage-binding intent
- session continuity record
- external trace history
- downstream governance records

What may be lost:

- active runtime session
- local checkpoints
- workspace-local scratch state
- bridge-local execution handle

This is the practical ownership test for the whole design.

## The Agent System's Real State Responsibilities

Within this larger ownership split, the agent system itself is responsible for:

- reconstructing execution from durable references
- managing the current workspace and active runtime session
- maintaining bridge-local operational state while a run is live
- emitting enough external trace so the rest of the system does not depend on runtime-local memory

That is narrower than "owning state" in general, but it is exactly the right scope.

## Summary

The agent system should be stateful, but only in the right way.

- It should own live execution state.
- It should respect control-plane ownership of durable truth.
- It should use runtime-local checkpoints and memory as continuity aids, not as governance truth.
- It should assume containers and runtime sessions are replaceable.

That ownership split is what makes the subsystem resilient instead of merely convenient.
