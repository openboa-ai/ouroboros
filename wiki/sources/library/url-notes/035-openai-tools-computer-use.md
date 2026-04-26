# 035 - OpenAI Computer Use

## Source

- URL: https://developers.openai.com/api/docs/guides/tools-computer-use
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 35
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

Computer use lets a model operate software through UI actions, screenshots, and harness-mediated
interaction. The docs explicitly recommend isolated browsers/VMs, human-in-the-loop review for
high-impact actions, and treating page content as untrusted input.

For autokairos, this is a high-risk tool surface.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| UI operation | Computer use can access systems without APIs, but must be constrained and audited. |
| Isolated browser/VM | UI automation belongs in isolated `HandsEnvironment`. |
| Human in loop for high impact | Trading/exchange/account actions cannot be delegated to raw UI automation. |
| Untrusted page content | Prompt injection risk applies to market/news/web pages and exchange UIs. |
| Harness shapes | autokairos can wrap provider computer use, but must own permission and trace. |

## Deep autokairos Insight

Computer use should not be a shortcut around missing APIs.

In trading, UI automation could be useful for:

- research
- screenshots
- report inspection
- non-authoritative workflow support

But it should not place orders or modify account state. Live trading must use structured gateway
objects, not UI clicks:

```text
OrderIntent -> GatewayDecision -> ExecutionAttempt
```

## What Not To Copy

- Do not use computer use to operate an exchange UI directly.
- Do not trust browser content as safe instructions.
- Do not allow high-impact UI actions without approval/gateway.
- Do not treat screenshots as counted evidence without evaluation.

## Design Questions Forced By This Source

- Is computer use ever allowed in live stage?
- What UI actions are read-only versus side-effecting?
- How are screenshots and UI actions traced?
- How does autokairos detect prompt injection in web/UI contexts?

## autokairos Design Pressure

Computer use is a research/support tool, not live trading authority.
