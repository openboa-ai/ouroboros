# 028 - OpenAI Agents SDK Integrations And Observability

## Source

- URL: https://developers.openai.com/api/docs/guides/agents/integrations-observability
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 28
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This page makes trace a first-class runtime artifact. OpenAI traces can record model calls, tool
calls, handoffs, guardrails, custom spans, and whole workflows.

For autokairos, this is direct support for treating `AgentEvent` and `Trace` as mandatory runtime
outputs, not optional debugging logs.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Default tracing | Provider-backed runs must export structured trace by default where possible. |
| Model-call spans | Record model/provider config and reasoning/tool phases enough for audit. |
| Tool-call spans | `ToolProxy` events need inputs, outputs, failures, and permissions. |
| Handoff spans | Multi-agent communication must be reconstructable. |
| Guardrail spans | Validation/rejection must be part of trace. |
| Custom spans | autokairos-specific events such as materialization/gateway/eval linkage need spans. |

## Deep autokairos Insight

This page strengthens a key distinction:

```text
trace is necessary
trace is not evidence
```

Trace gives observability and recovery. Evidence requires an evaluation boundary that decides what
counts. The system must persist trace before making candidate/evidence/promotion/live decisions, but
must not promote trace alone.

## What Not To Copy

- Do not rely only on provider dashboard traces for autokairos audit.
- Do not omit trace export to reduce friction.
- Do not treat custom spans as sufficient without schema and retention policy.
- Do not expose sensitive secrets in traces.

## Design Questions Forced By This Source

- What provider trace fields map to autokairos `Trace`?
- What autokairos events need custom spans?
- What trace redaction is required for credentials, prompts, market data, and PII?
- How long must traces be retained for promotion/live audit?

## autokairos Design Pressure

Every provider-backed runtime must have a trace export path. No trace, no trustworthy candidate
materialization or evaluation.
