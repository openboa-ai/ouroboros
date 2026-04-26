# 034 - OpenAI Shell Tool

## Source

- URL: https://developers.openai.com/api/docs/guides/tools-shell
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 34
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

The shell tool gives models terminal access in hosted containers or local runtimes. The docs warn
that arbitrary shell commands are dangerous and should be sandboxed, allowlisted/denylisted where
possible, and logged for audit.

For autokairos, this is a direct source for allowing agent-authored scripts while keeping hard
boundaries.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Hosted shell containers | Provider-hosted execution is possible but still physical placement, not product truth. |
| Local shell runtime | Local process execution must still use adapter semantics and trace. |
| Arbitrary command risk | Shell belongs in sandbox/hands only, never host/global authority. |
| Allowlists/denylists | Stage-specific shell policy is required. |
| Audit logging | Every shell command/output must become trace or attached artifact. |

## Deep autokairos Insight

This source supports the user's desire that trader systems can write and run code. The restriction
should not be a tiny human-authored DSL. The restriction should be:

```text
sandboxed shell/program freedom
with no direct secrets
with trace
with tool/gateway boundaries
```

That lets an agent build flexible trading behavior without becoming the authority layer.

## What Not To Copy

- Do not let shell run on the host without sandboxing.
- Do not give shell access to exchange credentials.
- Do not treat shell success as evidence.
- Do not allow live-stage shell mutation of promoted runtime without version/evaluation path.

## Design Questions Forced By This Source

- What shell capabilities are allowed in backtest, paper, live?
- How are shell commands redacted and audited?
- What filesystem paths are writable?
- When does script change require a new `CandidateVersion`?

## autokairos Design Pressure

Shell is powerful enough to express rich trader-system behavior, but only inside `HandsEnvironment`
with explicit policy and trace.
