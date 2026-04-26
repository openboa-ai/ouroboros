# 018 - OpenAI Codex App

## Source

- URL: https://openai.com/index/introducing-the-codex-app/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 18
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

The Codex app source matters because it positions Codex as an agent that can take tasks from
different work surfaces, operate in a cloud/local environment, and return artifacts for human
review.

For autokairos, Codex is not the product. Codex is a candidate provider for:

- builder-agent work
- code/script/program generation
- sandboxed analysis
- repository/tool interaction
- trace-producing execution attempts

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Task-based Codex work | Map provider invocation to `AgentRun`, not an always-on hidden process. |
| Artifact return | Generated code, diffs, logs, and summaries should become trace artifacts. |
| Human review | Candidate materialization/evaluation must happen through autokairos review gates. |
| Multi-surface access | Provider surfaces can vary; `provider_kind` must name the concrete surface. |
| Environment execution | Codex can work in a configured environment, but environment state is not product truth. |

## Deep autokairos Insight

Codex is strongest for generating and modifying executable trader-system artifacts, not for
directly owning live trading.

The right pattern is:

```text
Codex AgentRun
-> generated TraderSystemSpec / TraderSystemProgram / artifacts
-> schema + semantic validation
-> materialization or rejection
-> Trace
```

For live trading, Codex-like reasoning can still be used behind `RuntimeProviderAdapter`, but its
output must be constrained to proposed actions such as `OrderIntent`, never direct exchange calls.

## What Not To Copy

- Do not build autokairos as a Codex app wrapper.
- Do not assume Codex cloud artifacts are enough for candidate truth.
- Do not let Codex-generated scripts bypass sandbox, package, or gateway controls.
- Do not treat provider review queues as autokairos evaluation/promotion.

## Design Questions Forced By This Source

- Which Codex surfaces are actually callable from the bootstrap: CLI, SDK, app, or cloud?
- What artifacts should a Codex run produce for candidate materialization?
- How do failed Codex runs become trace without creating false candidates?
- What sandbox assumptions are required before Codex-generated code is executable?

## autokairos Design Pressure

This source supports:

```text
Codex as replaceable provider-backed execution capability
not autokairos control plane
```
