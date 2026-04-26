# 027 - OpenAI Agents SDK Guardrails And Human Review

## Source

- URL: https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 27
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

The page separates automatic validation from human review:

- guardrails validate input, output, or tool behavior automatically
- human review pauses the run for approval/rejection of sensitive actions
- together they define whether a run continues, pauses, or stops

For autokairos, this maps directly to live trading control:

```text
agent proposes
guardrails/gateway/policy evaluate
human review only where needed
```

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Input guardrails | runtime inputs, tool/context refs, and program/provider payloads can be validated before use. |
| Output guardrails | Candidate JSON, `OrderIntent`, and summaries require schema/semantic checks. |
| Tool approval | Sensitive side effects should pause or be rejected before execution. |
| Continue/pause/stop | Runtime control states need explicit audit records. |
| Blocking vs parallel guardrails | Some safety checks must block; others can run alongside speculative work. |

## Deep autokairos Insight

This source supports bounded autonomy without per-action operator approval.

The operator should not approve every routine runtime thought. But the system needs deterministic
boundaries for:

- candidate materialization
- evaluator admission
- credential/tool access
- live order gateway
- wake escalation
- stop/pause/override

Guardrails are useful, but live trading needs a stronger gateway decision record:

```text
OrderIntent -> GatewayDecision -> ExecutionAttempt
```

## What Not To Copy

- Do not treat provider guardrails as sufficient for financial risk.
- Do not make human review the only safety mechanism.
- Do not let auto-approval hide rejected/clipped tool calls.
- Do not confuse output validation with counted evidence.

## Design Questions Forced By This Source

- Which autokairos boundaries are automatic guardrails?
- Which actions must pause for operator review?
- Which rejected actions must be visible in operator audit?
- How does the runtime resume after approval/rejection?

## autokairos Design Pressure

Guardrails/human review support a layered control model, but trading authority still belongs to
autokairos gateway and policy records.
