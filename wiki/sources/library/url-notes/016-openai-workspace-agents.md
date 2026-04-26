# 016 - OpenAI Workspace Agents

## Source

- URL: https://openai.com/index/introducing-workspace-agents-in-chatgpt/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 16
- Localized alias note:
  [009-openai-workspace-agents-ko-alias.md](009-openai-workspace-agents-ko-alias.md)
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

Workspace Agents are a product-posture reference for reusable agents that work across tools,
memory, schedules, Slack, approvals, analytics, and enterprise controls.

The source is especially relevant because it says agents are powered by Codex in the cloud, can use
files, code, tools, memory, and can continue work across multiple steps. It also highlights that the
hard part is not only the model, but integrations, memory, and user experience.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Agent templates | Candidate/system generation can start from structured templates, but templates must not replace evaluation. |
| Tools and connected apps | External capability must be explicit and permissioned through `ToolProxy`. |
| Memory | Agent memory can improve repeated work but must be scoped and auditable. |
| Schedules and Slack entrypoints | external entrypoints can exist, but autokairos should expose lifecycle/control and review surfaces rather than own internal trader-system dispatch. |
| Approval for sensitive actions | Trading side effects need explicit gateway/review boundaries. |
| Analytics and compliance visibility | Runtime runs/config updates must be observable and auditable. |
| Shared agent library | Future `TraderSystemCandidate` and `CapabilityPackage` marketplace patterns need sharing/versioning. |

## Deep autokairos Insight

This source helps frame the provider-backed runtime model:

```text
external provider supplies cloud/runtime/tool capability
autokairos supplies trading truth, evidence, promotion, gateway, and audit
```

Workspace Agents demonstrate that provider platforms are moving toward complete work agents.
autokairos should integrate them where useful, but should not let a generic workspace agent define
trading legitimacy.

The important UX lesson is that reusable agent systems improve through use. For autokairos, that
should become:

- candidate versioning
- trace-backed learning
- externally evaluated promotion
- package/spec duplication under review

not hidden mutation of a live runtime.

## What Not To Copy

- Do not turn autokairos into a generic workspace-agent builder.
- Do not equate schedule support with safe live trading behavior.
- Do not let provider analytics replace autokairos audit.
- Do not treat memory-guided improvement as promotion.
- Do not let connected-app authority imply exchange authority.

## Design Questions Forced By This Source

- Which provider surfaces can become `RuntimeProviderAdapter` implementations?
- What provider run/config data must be mirrored into autokairos audit?
- How should candidate systems be shared, duplicated, or versioned?
- What is the trading equivalent of approval for sensitive actions?

## autokairos Design Pressure

This source supports:

```text
agent work becomes reusable and shareable
but sensitive side effects require explicit control
```

It reinforces product posture without replacing W2S/evaluation thesis.
