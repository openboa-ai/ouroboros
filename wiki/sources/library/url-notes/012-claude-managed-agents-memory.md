# 012 - Claude Managed Agents Memory

## Source

- URL: https://platform.claude.com/docs/en/managed-agents/memory
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 12
- Related cluster note:
  [anthropic-2026-runtime-and-managed-agent-stack.md](../anthropic-2026-runtime-and-managed-agent-stack.md)

## What This Source Actually Proves

Managed Agents memory is a separate resource attached to sessions, not an invisible extension of the
model.

The source establishes several useful boundary facts:

- each session starts with fresh context unless memory is attached
- memory stores are workspace-scoped collections of text documents
- stores are mounted into the session container
- each memory is addressed by path
- every change creates an immutable memory version
- stores can be `read_write` or `read_only`
- prompt injection can poison writable memory
- multiple stores can be used for different owners and lifecycles
- memory reads/writes appear in the event stream

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Memory store resource | Trading memory should be an explicit attached resource, not hidden provider state. |
| Path-addressed memories | Memory should be inspectable as artifacts with names, scopes, and owners. |
| Immutable versions | Memory mutation needs version history and recovery. |
| Read-only vs read-write | Market/reference knowledge and runtime scratch memory need different permissions. |
| Prompt-injection warning | Agent-writable memory can become a persistent attack surface. |
| Event-stream visibility | Memory reads/writes should become trace events. |
| Attach at session creation | Memory binding belongs in runtime placement/session setup, not ad hoc hidden mutation. |

## Deep autokairos Insight

This source is a direct design constraint for `TraderSystemRuntime`.

Memory must be split by trust and lifecycle:

- read-only reference material
- candidate-local runtime memory
- operator preferences
- market-regime notes
- error/recovery notes
- evaluator-visible evidence context

These cannot all live in one blob. If a live runtime can write to the same memory that future
evaluators treat as trusted reference, prompt injection or reward hacking can persist across runs.

For autokairos, memory should feed runtime reasoning, but every memory influence must remain
auditable. Memory should not become evidence unless an external evaluation boundary seals it.

## What Not To Copy

- Do not copy provider-specific memory-store APIs as autokairos storage truth.
- Do not attach read-write memory everywhere by default.
- Do not let live runtime memory include secrets, exchange credentials, or evaluator ground truth.
- Do not treat memory versioning as enough; the operator still needs review and rollback surfaces.

## Design Questions Forced By This Source

- Which memory stores are read-only versus read-write per stage?
- Which memory reads/writes must be included in `Trace`?
- How does memory poisoning get detected and rolled back?
- Can a candidate version be promoted if its behavior depends on unreviewed writable memory?
- How does memory differ from trace, evidence, and candidate spec?

## autokairos Design Pressure

This source pushes toward:

```text
MemoryResource
-> attached through RuntimePlacement / StageBinding
-> accessed through HandsEnvironment or AgentSession
-> visible as AgentEvent / ProgramEvent
-> persisted in Trace
-> never counted until evaluated
```

It makes memory a first-class controlled resource, not a convenient hidden context cache.
