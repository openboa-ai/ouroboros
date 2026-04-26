# 045 - Google Agent Development Kit

## Source

- URL: https://adk.dev/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 45
- Related cluster note:
  [google-2026-agent-platform-and-protocols.md](../google-2026-agent-platform-and-protocols.md)

## What This Source Actually Proves

ADK is a code-first, multi-language agent framework that supports prompts, tools, multi-agent
orchestration, graph-based workflows, evaluation, deployment, and open integrations.

For autokairos, ADK is a vocabulary and provider/reference option. It should not force autokairos
into graph-first orchestration.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Agent + tools | Reinforces `AgentSpec` and explicit tool attachment. |
| Multi-agent orchestration | Supports future multi-agent admission, but not default. |
| Graph workflows | Useful for deterministic subflows, not the whole trader runtime. |
| Evaluation | Agent quality must be measured beyond successful runs. |
| Deployment | Provider/framework selection can be separated from product truth. |
| AI-generated agents | Agents can help build agents, but generated systems need validation/evaluation. |

## Deep autokairos Insight

ADK supports the idea that external frameworks can build/run agents. autokairos should own:

- candidate lifecycle
- stage binding
- trace/evidence/promotion
- live gateway
- audit

ADK can become one `RuntimeProviderAdapter` or authoring reference later.

## What Not To Copy

- Do not make graph workflows the default runtime autonomy model.
- Do not copy ADK object names if autokairos already has clearer cross-provider terms.
- Do not let ADK evaluation outputs become counted trading evidence automatically.

## Design Questions Forced By This Source

- What would an ADK-backed `RuntimeProviderAdapter` need to probe?
- Which ADK event/state fields map to autokairos `Trace`?
- When does graph structure help versus restrict trader-system autonomy?

## autokairos Design Pressure

Keep ADK as a provider/framework option and vocabulary reference, not a product architecture owner.
