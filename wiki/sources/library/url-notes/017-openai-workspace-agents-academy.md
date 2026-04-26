# 017 - OpenAI Workspace Agents Academy

## Source

- URL: https://openai.com/academy/workspace-agents/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 17
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This source is useful because it explains Workspace Agents as repeatable agents for real workflows,
not as one-off prompts. It frames agent design around instructions, connected tools, memory,
approval points, schedules, and measurable outcomes.

The key distinction for autokairos is between:

- deterministic workflow automation
- probabilistic agent work under instructions/tools/guardrails

autokairos should not reduce trader-system behavior to deterministic workflows, but it also should
not let probabilistic work escape control boundaries.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Use-case selection | Agent systems need a concrete recurring job, not generic "AI trader" breadth. |
| Instructions and tools | `AgentSpec` and `CapabilityPackage` should be explicit, versioned, and inspectable. |
| Memory | Repeated work improves with memory, but memory must remain scoped and auditable. |
| Approval checkpoints | Sensitive side effects require review/gateway boundaries. |
| Iterative improvement | Candidate versions should improve through trace/evaluation, not hidden live mutation. |
| Outcomes | Agent success needs measured outcomes, not chat satisfaction. |

## Deep autokairos Insight

This source supports treating `TraderSystemCandidate` as a repeatable system, not a single
generated idea.

A real candidate should have:

- instructions / system behavior
- tools and packages
- memory/context boundaries
- stage binding
- approval/gateway rules
- outcome/evaluation path

That maps to `TraderSystemSpec + CapabilityPackage[] + StageBinding + RuntimeOperatingPolicy`.

## What Not To Copy

- Do not turn autokairos into a generic enterprise workflow-agent product.
- Do not use provider workspace-agent onboarding as trading evaluation.
- Do not equate "recurring scheduled work" with safe live trading.
- Do not let provider memory or tools become the product system of record.

## Design Questions Forced By This Source

- What recurring job does the first trader-system candidate actually own?
- Which instructions are candidate-owned versus operator/platform-owned?
- What approval points are stage-specific?
- Which outcomes are convenience metrics versus counted evidence?

## autokairos Design Pressure

This source supports:

```text
repeatable agent system
with instructions/tools/memory/outcomes
bounded by autokairos evaluation and authority
```
