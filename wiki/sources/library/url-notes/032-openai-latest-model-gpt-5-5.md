# 032 - OpenAI Latest Model Guidance: GPT-5.5

## Source

- URL: https://developers.openai.com/api/docs/guides/latest-model
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 32
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

The page currently positions GPT-5.5 as the latest/baseline model family for complex production
workflows, coding, tool-heavy agents, grounded assistants, long-context retrieval, and polished
customer-facing workflows. It also says migration should start with a fresh baseline rather than
blindly carrying older prompt stacks forward.

This is dynamic provider guidance. It is useful, but it cannot override local feasibility evidence.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Fresh baseline migration | Provider/model upgrades require explicit eval, not silent defaults. |
| Tool-heavy agent fit | GPT-5.5 is a serious future provider/model candidate for runtime adapter testing. |
| Reasoning effort / verbosity / output format tuning | Model config is part of `AgentSession`/`AgentRun` metadata. |
| Feature continuity with GPT-5.4 | Migration can be possible, but access must be probed. |
| Prompt guidance link | Prompt stacks should be tested against representative examples. |

## Deep autokairos Insight

This source creates an important tension with the local smoke-test note: docs may recommend the
latest model, while the local environment may only have confirmed access to another model.

The right autokairos rule is:

```text
official latest-model guidance informs candidate provider roadmap
but runtime defaults require local probe evidence
```

Therefore, if `gpt-5.5` is inaccessible in the current environment and `gpt-5.4` works, the
implementation default remains `gpt-5.4` until a new provider probe succeeds.

## What Not To Copy

- Do not silently change model defaults from docs alone.
- Do not mix eval results across model versions without recording model metadata.
- Do not assume prompt behavior transfers unchanged between models.
- Do not let latest-model preference override reproducibility.

## Design Questions Forced By This Source

- What is the provider/model probe record?
- How does autokairos migrate a candidate from one model to another?
- Which evaluations must rerun when model changes?
- How are model-specific prompt/output assumptions versioned?

## autokairos Design Pressure

Model choice is candidate/runtime evidence context, not a hidden deployment setting.
