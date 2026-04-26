# 049 - Google Jules With Gemini 3

## Source

- URL: https://developers.googleblog.com/jules-gemini-3/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 49
- Related cluster note:
  [google-2026-agent-platform-and-protocols.md](../google-2026-agent-platform-and-protocols.md)

## What This Source Actually Proves

Jules is described as an always-on autonomous coding agent with shared project context across
surfaces such as terminal tools, Gemini CLI extension, and API. The post says stronger models
improve multi-step coherence, intent alignment, and reliability.

For autokairos, Jules is a provider/product posture reference similar to Codex.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Always-on autonomous coding agent | Provider-backed agents can continue work without the operator managing every transition. |
| Shared project context | Runtime context across surfaces is useful, but not product truth. |
| Multiple surfaces | Provider invocation can occur through CLI, extension, API, or hosted surface. |
| Stronger model improves coherence | Provider/model quality affects runtime performance and must be recorded. |
| Multi-step task follow-through | Long-running tasks need trace and handoff artifacts. |

## Deep autokairos Insight

Jules reinforces that external coding agents can be runtime providers. autokairos should not build
all coding-agent harness capability internally.

But Jules also reinforces that provider context is not enough. autokairos still needs:

- candidate identity
- runtime placement
- trace
- validation
- evaluation
- gateway
- audit

## What Not To Copy

- Do not copy Jules product UX into trading.
- Do not let shared provider project context become autokairos truth.
- Do not assume stronger model coherence equals trading legitimacy.
- Do not treat provider API availability as first-MVP dependency without probe.

## Design Questions Forced By This Source

- Could Jules become a future `RuntimeProviderAdapter`?
- What metadata is needed to compare Jules-backed and Codex-backed runs?
- Which provider surfaces preserve enough trace for evaluation?

## autokairos Design Pressure

Provider-backed execution should stay replaceable and trace-normalized.
