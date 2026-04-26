# 036 - OpenAI Compaction

## Source

- URL: https://developers.openai.com/api/docs/guides/compaction
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 36
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

Compaction reduces context size during long-running conversations while preserving state needed for
future turns. The docs distinguish server-side compaction and standalone compaction, and note that
compaction items may be opaque rather than human-interpretable.

For autokairos, this reinforces that provider context management is not durable truth.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Server-side compaction | Provider can manage context windows, but autokairos still needs trace. |
| Opaque compaction item | Compacted state cannot be the only audit/recovery record. |
| State carry-forward | Useful for `AgentSession` continuity, not evidence. |
| Cost/latency/quality tradeoff | Runtime budget belongs in `AgentRun`/placement metadata. |

## Deep autokairos Insight

Compaction is a provider convenience, not an audit model.

The correct split is:

```text
provider compaction = helps next model turn
autokairos trace = reconstructs what happened
evidence = externally judged trace/artifacts
```

If a trader-system runtime can only explain itself through an opaque compaction item, it is not
inspectable enough for promotion or live delegation.

## What Not To Copy

- Do not treat compaction summaries as faithful evidence.
- Do not let compaction delete audit-critical trace events.
- Do not hide memory/trace mutation behind provider context management.
- Do not use compaction as a substitute for runtime checkpoints.

## Design Questions Forced By This Source

- Which trace fields are never compacted away?
- Which summaries are operator-visible?
- How does a fresh provider session recover without opaque provider state?
- How do compaction artifacts affect evaluation reproducibility?

## autokairos Design Pressure

Compaction can support long-running runtime sessions, but durable trace remains canonical.
