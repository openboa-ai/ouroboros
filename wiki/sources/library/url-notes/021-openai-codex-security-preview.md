# 021 - OpenAI Codex Security Research Preview

## Source

- URL: https://openai.com/index/codex-security-now-in-research-preview/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 21
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This is a security-oriented Codex product posture source. Its relevance is not that autokairos
should become a security scanner. The relevance is that agentic code systems are being used for
high-risk analysis where findings require review, evidence, and context.

For autokairos, it reinforces that powerful agents can investigate complex systems, but their
outputs must be interpreted through a domain-specific evidence and governance layer.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| High-risk domain use | Trading and security both require stronger audit than generic productivity tasks. |
| Finding generation | Provider output is a candidate finding or artifact, not final truth. |
| Evidence review | Claims must be backed by reproducible artifacts and external verification. |
| Research preview status | Provider/security features may be unstable and should not be hard MLP dependencies. |

## Deep autokairos Insight

The security preview creates a useful analogy:

```text
security finding != confirmed vulnerability
trading candidate output != counted evidence
```

An agent can propose a finding, generate tests, inspect artifacts, and summarize risk. But a
separate review/evaluation boundary decides whether the finding is valid.

For trading, the equivalent is:

```text
provider output
-> Trace
-> EvidenceRecord only after external evaluation
```

## What Not To Copy

- Do not copy security-product UX or terminology into trading.
- Do not make Codex Security a dependency.
- Do not treat agent-generated "risk analysis" as gateway approval.
- Do not let research-preview products define stable architecture contracts.

## Design Questions Forced By This Source

- What makes a trading result reproducible enough to count?
- What artifacts must accompany an agent's claim about performance or risk?
- How do we mark provider features that are useful but unstable?
- What is the trading equivalent of "confirmed finding"?

## autokairos Design Pressure

This source strengthens:

```text
agent-generated claims require external verification
especially in high-risk domains
```
