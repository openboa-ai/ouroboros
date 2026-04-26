# 051 - Anthropic Project Deal

## Source

- URL: https://www.anthropic.com/features/project-deal
- Posted: April 24, 2026
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 51
- Related synthesis:
  [evaluation-governance-and-promotion.md](../../synthesis/evaluation-governance-and-promotion.md),
  [reference-systems-and-product-postures.md](../../synthesis/reference-systems-and-product-postures.md)

## What This Source Actually Proves

Project Deal is a real-world marketplace experiment where Claude agents represented humans in a
classified marketplace. Anthropic recruited 69 employees, gave each a $100 budget, gathered seller,
buyer, price, and negotiation-style preferences through an intake interview, then deployed custom
Claude agents into parallel Slack marketplaces. The agents posted listings, made offers,
counteroffered, and closed deals without human intervention during the negotiation phase. The real
run produced 186 deals with a total transaction value just above $4,000.

The strongest result for autokairos is not that "agents can negotiate." The deeper result is:

- agent representatives can create real economic outcomes for humans
- stronger models can produce objectively better transaction outcomes
- humans represented by weaker models may not perceive that disadvantage
- prompting/personality instructions may matter less than underlying model capability
- agent-to-agent markets can create inequality and security risks that humans do not notice in the
  moment

This is highly aligned with autokairos' weak-to-strong framing. In trading, a weak human operator
may not be able to tell whether a weaker trader-system candidate is quietly leaving money on the
table or taking worse risk-adjusted opportunities.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Intake interview | Candidate/runtime setup needs explicit operator preference capture, constraints, risk tolerance, and style/instructions. |
| Custom agent representative | `TraderSystemCandidate` should represent a bounded operator objective, not generic autonomous trading. |
| Parallel market runs | Backtest/paper/live comparisons should support multiple candidate/runtime variants under comparable conditions. |
| No human intervention during run | Delegation can be real only if the operator is not approving every micro-action. |
| Post-run survey and objective stats | Subjective satisfaction and objective outcome can diverge; both must be tracked separately. |
| Model quality variation | Provider/model choice is an economic variable, not an implementation detail. |
| Real items and real exchange | Evaluation becomes more meaningful when consequences are real, but risk boundaries must be stronger. |
| Prompt-injection and information leakage warnings | Agent-mediated markets need security controls around messages, tools, memory, and authority. |

## Deep autokairos Insight

Project Deal strengthens three autokairos design commitments.

First, agent quality must be externally evaluated. The experiment found objective gaps between
frontier and smaller models while participants often did not perceive those gaps. For autokairos,
this means the solo trader cannot be the only judge of whether a trader-system candidate is strong.
The product must produce comparable, external, counted evidence.

Second, model/provider selection is part of candidate performance. A `TraderSystemRuntime` backed by
Codex, Claude, OpenClaw/ACP, A2A, or a local process is not interchangeable just because the
interface is normalized. `AgentSession.provider_kind`, model, tools, memory, and hands environment
must be preserved in trace and evaluation context.

Third, delegation must be bounded but real. If the operator has to approve every negotiation move,
Project Deal's result would not be meaningful. Similarly, autokairos cannot prove delegated trading
if every routine decision requires operator approval. But the boundary must be stronger in trading:
live side effects go through `OrderIntent -> GatewayDecision -> ExecutionAttempt`.

## What Not To Copy

- Do not copy the no-human-intervention setup directly into live trading. Anthropic explicitly notes
  this experiment is not how agents should be deployed in the real world.
- Do not treat subjective operator satisfaction as proof of candidate quality.
- Do not assume better prompting compensates for weaker model/provider capability.
- Do not copy a Slack marketplace architecture into autokairos.
- Do not treat agent-to-agent communication as safe simply because transactions are natural
  language.
- Do not let agents optimize for other agents' attention in a way that bypasses human welfare,
  risk, or legitimacy.

## Design Questions Forced By This Source

- How does autokairos compare candidate performance when two candidates run under similar market
  conditions?
- Which provider/model metadata must be preserved so outcomes can be attributed correctly?
- How does the operator know if a candidate is objectively worse even when the surface feels fine?
- What is the trading equivalent of "got a worse deal but did not notice"?
- How should autokairos prevent agent-to-agent or tool-output prompt injection from changing live
  behavior?
- Which live decisions can be delegated without per-action approval, and which must always hit the
  gateway or operator review?

## autokairos Design Pressure

Project Deal pushes autokairos toward:

```text
operator preference capture
-> agent-built representative runtime
-> comparable stage-bound runs
-> objective external evaluation
-> provider/model attribution
-> bounded real delegation
-> audit and security controls
```

The core warning is that a weak human may not notice being represented by a weaker agent. That is
exactly why autokairos must treat external evaluation, trace, evidence, and promotion as first-class
control-plane truth.
