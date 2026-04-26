# 025 - OpenAI Agents SDK Running Agents

## Source

- URL: https://developers.openai.com/api/docs/guides/agents/running-agents
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 25
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This page defines a concrete agent run loop:

1. call the current agent model
2. inspect output
3. execute tools if requested
4. switch agent on handoff
5. return when a final answer or stopping point appears

It also distinguishes state continuation strategies: replay-ready history, SDK sessions, server
conversation IDs, or manual application state.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| One run as one application turn | `AgentRun` should be an invocation/attempt, not the durable runtime itself. |
| Tool-call loop | Tool requests must go through `ToolProxy`, not direct arbitrary side effects. |
| Handoff loop | Handoff changes active agent ownership; autokairos must record that in trace. |
| State strategies | `AgentSession` provider state and autokairos `Trace` are different continuity layers. |
| Pause/approval behavior | Runtime may pause without losing product truth if trace/control records persist. |

## Deep autokairos Insight

This page is useful precisely because it shows what autokairos should not own step-by-step.

OpenAI's runner can manage the provider's inner loop. autokairos should not reimplement that loop as
a central workflow engine. autokairos should define:

- how runtime lifecycle control reaches the deployed trader system
- what provider/session/tool boundary is allowed
- what trace must be emitted
- what outputs are acceptable
- how side effects cross gateway/evaluation boundaries

The provider runner can decide how many model/tool iterations are needed inside an `AgentRun`.

## What Not To Copy

- Do not expose provider run-loop internals as product truth.
- Do not treat conversation/session state as enough for audit or recovery.
- Do not confuse a final answer with candidate materialization, evidence, or execution approval.
- Do not use handoffs as a reason to default to multi-agent runtime.

## Design Questions Forced By This Source

- What is the autokairos definition of one `AgentRun`?
- Which continuation state is provider-owned versus autokairos-owned?
- What outputs can terminate a run?
- How are tool calls, handoffs, and pauses normalized into trace?

## autokairos Design Pressure

Provider run loops are borrowed capability. autokairos owns the boundary around the run, not every
internal model/tool step.
