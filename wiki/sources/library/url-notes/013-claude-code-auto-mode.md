# 013 - Claude Code Auto Mode

## Source

- URL: https://www.anthropic.com/engineering/claude-code-auto-mode
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 13
- Related cluster note:
  [anthropic-2026-runtime-and-managed-agent-stack.md](../anthropic-2026-runtime-and-managed-agent-stack.md)

## What This Source Actually Proves

Auto mode is important because it shows that high autonomy does not mean no permission system.

The source describes the real tradeoff:

- manual approvals create approval fatigue
- full permission skipping is unsafe
- sandboxing is safer but can be operationally expensive
- auto mode inserts classifier-based decisions between those extremes
- broad interpreter/package-manager permissions are too dangerous to carry over blindly
- real incidents include data exfiltration, production database risk, and safety-check bypasses

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Approval fatigue | Per-action approval is not scalable for live trading, but removing guardrails is worse. |
| Permission tiers | Tool/gateway permissions need tiers, not one global allow/deny switch. |
| Prompt-injection probe | Tool results and external data can be adversarial inputs to runtime reasoning. |
| Broad interpreter escape removal | Python/shell access in `HandsEnvironment` must be sandboxed and not equivalent to host authority. |
| Classifier for risky actions | Gateway/risk classification can reduce friction, but final live rules remain deterministic. |
| Incident log | Misbehavior examples should feed test cases and safety regression suites. |

## Deep autokairos Insight

The source creates a strong design rule:

```text
autonomy requires layered permission architecture
```

For autokairos, the equivalent is:

- agent/program freedom inside sandbox
- no secrets in sandbox
- no direct exchange credentials in provider context
- side effects through ToolProxy
- live side effects through TradingGateway
- review or rejection for risky actions
- trace every allowed, rejected, or clipped decision

This is also why `FastPathAction` cannot be an ungoverned bypass. Fast response can be deterministic,
but it still needs an authority envelope and gateway audit.

## What Not To Copy

- Do not copy coding permission tiers directly into trading risk tiers.
- Do not let a model classifier be the sole authority for live order approval.
- Do not treat sandboxing as enough if network/tool/exchange authority leaks out.
- Do not hide blocked/rejected actions; they are safety telemetry.

## Design Questions Forced By This Source

- What is autokairos' equivalent of Tier 1/2/3 action classes?
- Which trading actions are auto-allow, classifier/review, or always reject?
- Which permissions are stripped when moving from backtest to paper to live?
- What prompt-injection protections exist for market/news/tool outputs?

## autokairos Design Pressure

This source supports:

```text
high autonomy
without direct authority
through layered permission and gateway controls
```

It is a key source for bounded live runtime design.
