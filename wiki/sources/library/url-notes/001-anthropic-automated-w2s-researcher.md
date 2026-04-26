# 001 - Anthropic Automated Weak-to-Strong Researcher

## Source

- URL: https://alignment.anthropic.com/2026/automated-w2s-researcher/
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 1
- Related cluster note:
  [anthropic-automated-w2s-researcher.md](../anthropic-automated-w2s-researcher.md)

## What This Source Actually Proves

This source is the strongest thesis reference for autokairos.

It does not prove "agents can generate good trading ideas." It proves a more specific and more
important structure:

- a weak supervisor can make progress by creating an environment where stronger automated workers
  search independently
- the hard product problem moves from idea generation to evaluation design
- agents should be free inside their sandbox, but the scoring truth must be outside the sandbox
- parallel search is useful only when diversity, logs, and external scoring prevent collapse or
  self-serving shortcuts

For autokairos, the equivalent is not "one strategy card." The equivalent is a pool of
`TraderSystemCandidate` objects whose trader-system behavior can be generated, run, inspected,
externally evaluated, and promoted under explicit legitimacy boundaries.

## Mechanisms To Preserve

| Mechanism | Why it matters for autokairos |
| --- | --- |
| Independent sandboxes | Candidate trader systems need isolated execution surfaces so one candidate cannot corrupt another candidate's state or evaluation. |
| Remote evaluation API | Counted evidence must be produced outside the candidate runtime; trace and self-report are not enough. |
| External logs and shared findings | Runtime-local memory is disposable; durable trace, artifacts, and cross-candidate learnings must live outside the sandbox. |
| Minimal human-prescribed workflow | Overly scripted workflows reduce agent flexibility; autokairos should bound authority, not micromanage internal reasoning. |
| Directed diversity | Candidate generation needs deliberate diversity pressure; otherwise many agents converge on the same local idea family. |
| Reward-hacking pressure | Any counted metric will be gamed; evaluation design is a security boundary, not a dashboard feature. |
| Generalization checks | A candidate that works in one dataset/stage may fail elsewhere; promotion must test transfer, not just local score. |

## Deep autokairos Insight

The crucial design lesson is that `TraderSystemRuntime` should be autonomous internally, but
legitimacy must be external.

That means:

- the runtime may decide to write scripts, call an agent provider, run experiments, analyze traces,
  or propose changes
- the runtime may not decide that its own result counts
- `Trace` is not `EvidenceRecord`
- provider output is not `PromotionDecision`
- live trading authority is not a property of a successful sandbox run

This source also argues against designing autokairos as a deterministic strategy DSL. If the weak
human predefines every signal, trigger, and action shape, the product reintroduces the weak human as
the strategy designer. The system should instead define the sandbox, data, tools, gateway,
evaluation, trace, and promotion boundaries, then let candidate trader systems search within them.

## What Not To Copy

- Do not copy PGR as a literal trading KPI.
- Do not copy unlimited evaluation submissions into trading promotion without abuse controls.
- Do not assume a single numerical score is enough for live trading legitimacy.
- Do not assume that a method discovered in backtest transfers to paper or live.
- Do not make the shared findings forum a hidden authority channel; it is trace/context, not
  evidence.

## Design Questions Forced By This Source

- What is the trading equivalent of a remote evaluation API?
- Which backtest/paper/live results are counted, and which are convenience-only?
- How do we preserve candidate diversity without forcing human-authored strategy templates?
- What prevents a candidate from overfitting to the evaluator, simulator, or known market period?
- What trace is needed to reconstruct how a trader-system candidate reached a result?

## autokairos Design Pressure

This source should pressure the architecture toward:

```text
candidate search freedom
-> isolated runtime placement
-> durable trace outside runtime
-> external evaluation
-> explicit promotion
-> bounded live authority
```

If a design skips external evaluation or lets runtime self-report become evidence, it contradicts
this source.
