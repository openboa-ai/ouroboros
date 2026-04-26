# 019 - OpenAI Codex Product Page

## Source

- URL: https://openai.com/codex/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 19
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

The Codex product page is useful mainly for provider posture. It presents Codex as a coding agent
surface across local and cloud execution, with work artifacts that can be reviewed and integrated.

It does not define autokairos architecture. It defines a candidate external harness surface.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Coding-agent work | Codex can author `TraderSystemProgram` and tooling inside sandbox boundaries. |
| Local/cloud surfaces | `provider_kind` must distinguish `codex_cli`, future SDK/cloud, and app surfaces. |
| Reviewable outputs | Generated code/results must be inspectable before materialization or promotion. |
| Repository guidance | `AGENTS.md`-style instructions can shape provider behavior but are not evidence. |
| Security posture | Runtime permission and sandbox settings are part of feasibility, not afterthoughts. |

## Deep autokairos Insight

This page supports a practical provider sequence:

1. start with `codex_cli` only if it passes binary/auth/model/schema-output probe
2. use it for candidate generation and program drafting
3. normalize output to `AgentEvent` and `Trace`
4. validate before creating `TraderSystemCandidate`
5. do not use Codex as live exchange authority

The important design point is not "Codex can do everything." It is "Codex can be a serious external
builder/harness if autokairos owns the materialization boundary."

## What Not To Copy

- Do not treat Codex product claims as stable API guarantees.
- Do not generalize "coding agent" into "trading agent with exchange authority."
- Do not rely on Codex provider memory as the system of record.
- Do not skip adapter feasibility because the product page looks capable.

## Design Questions Forced By This Source

- What is the exact first callable Codex adapter?
- What output schema must Codex produce for PR1-style materialization?
- Which Codex capabilities are unavailable in the local environment?
- How does autokairos preserve reproducibility when provider product behavior changes?

## autokairos Design Pressure

This source reinforces:

```text
provider label is not executable
until concrete invocation, auth, model, output, and trace are verified
```
