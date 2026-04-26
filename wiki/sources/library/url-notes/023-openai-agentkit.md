# 023 - OpenAI AgentKit

## Source

- URL: https://openai.com/index/introducing-agentkit/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 23
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

AgentKit is OpenAI's product layer for building, deploying, and optimizing agents. It includes a
visual Agent Builder, Connector Registry, ChatKit, guardrails, datasets, trace grading, prompt
optimization, and third-party model evaluation.

The deep relevance for autokairos is that modern agent platforms are separating:

- workflow design/versioning
- connectors
- guardrails
- UI embedding
- trace/eval loops
- model optimization

These are adjacent layers, not one agent loop.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Agent Builder versioning | Trader-system specs and runtime configurations need versions before comparison/promotion. |
| Connector Registry | Tools and data access need central governance; packages should request access, not grant it. |
| Guardrails | Runtime actions need input/output/tool checks outside the model. |
| Trace grading | Trace can be graded, but grading output must become `EvidenceRecord` only through autokairos evaluation rules. |
| Third-party model support | Provider comparison is a first-class concern; Codex/Claude/OpenClaw/A2A runs must preserve model/provider metadata. |
| ChatKit | UI embedding is not the core architecture; useful later for operator surfaces. |

## Deep autokairos Insight

AgentKit reinforces that agent performance is optimized through an eval loop, not by trusting the
first agent design.

For autokairos:

```text
TraderSystemSpec version
-> stage-bound run
-> trace
-> evaluator / grader
-> evidence
-> next candidate version or promotion
```

This is especially important because autokairos will compare provider-backed trader systems. If a
candidate's performance changes because the provider/model changed, trace and evidence must preserve
that context.

## What Not To Copy

- Do not copy visual workflow-builder posture into core architecture.
- Do not make OpenAI Connector Registry the only connector governance option.
- Do not use prompt optimization to mutate a live trader runtime in place.
- Do not treat third-party model eval support as proof of trading legitimacy.

## Design Questions Forced By This Source

- How does autokairos version trader-system specs, prompts, tools, and provider configs?
- Which connector/tool permissions are operator-owned versus runtime-owned?
- What trace grading criteria map to trading evidence?
- How are provider/model comparisons kept fair?

## autokairos Design Pressure

AgentKit supports versioned agent-system iteration and provider comparison, while warning against
turning the architecture into a generic visual workflow platform.
