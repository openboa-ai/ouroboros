# autokairos Product Metrics And Decision Rules

## Purpose

This page defines how product progress will be judged.

It is not an analytics dashboard spec. It is the PM rulebook for:

- what counts as product progress
- what signals justify continuing
- what signals justify widening scope
- what signals mean the current wedge is failing

## Current North-Star

The current north-star is not volume.

It is:

**one agent-built `TraderSystemCandidate` is externally evaluated, promoted, run as a bounded live
`TradingSystemPod` on Binance BTC perpetual futures, and remains trustworthy enough that the
operator does not become the permanent runtime loop.**

Everything else is secondary to proving that path.

## Supporting Product Signals

The current phase should track four classes of signals.

### 1. Progression Signals

- one agent-built trader-system candidate becomes durable
- one candidate can be run under backtest/paper/live bindings without changing identity
- one candidate accumulates counted evidence outside runtime self-report
- one candidate reaches a clear promotion decision
- one promoted candidate runs as a bounded live pod

### 2. Trust Signals

- the operator can explain what the candidate is
- the operator can explain what capability package and binding were used
- the operator can explain why evidence counted
- the operator can explain what was approved for live
- the operator can explain why the live pod woke them

### 3. Autonomy Signals

- live execution happens inside explicit limits
- the operator is not required for per-action approval
- intervention is exception-driven rather than constant

### 4. Focus Signals

- product work advances the lovable loop instead of broadening category claims
- multi-venue or enterprise work does not preempt the first believable proof

## Go Rules

The current wedge should continue if all of the following remain true:

- the serious solo operator is still the sharpest first ICP
- Binance BTC perpetual futures is still the narrowest believable live market
- counted versus non-counted evidence remains central to trust
- the operator still values bounded live autonomy more than idea volume

## Hold Or Slow-Down Rules

The current wedge should slow down if any of the following becomes true:

- users value idea generation but do not value governed trader-system candidate progression
- live legitimacy remains too fuzzy for a serious gate
- the operator still has to supervise normal execution constantly
- intervention and wake surfaces remain too confusing to trust

## Widen Rules

Scope should widen only after the first lovable proof is credible.

That means at minimum:

- one believable bounded live pod exists on Binance BTC perpetual futures
- the operator can explain why it counted and what was approved
- bounded autonomy and intervention both work

Only after those are true should the product seriously consider:

- additional crypto venues
- additional instruments
- team workflows
- broader external surfaces

## Kill Or Reframe Rules

The current wedge should be killed or reframed if:

- users consistently prefer manual system design over agent-built candidate evolution
- trustworthy live promotion cannot be made legible enough for operator confidence
- the product collapses into an idea copilot or monitoring dashboard instead of a living trading
  system
- the product requires broadening scope before one bounded live pod can be made lovable

## What This Means For Current Planning

Current planning should optimize for:

- one credible externally evaluated live pod
- one serious user
- one serious market
- one readable trust loop

It should not optimize for:

- volume of features
- breadth of coverage
- future platform claims

## Read Next

1. [04-roadmap-now-next-later.md](04-roadmap-now-next-later.md)
2. [05-product-decision-log.md](05-product-decision-log.md)
3. [mlp-01/00-mlp-brief.md](mlp-01/00-mlp-brief.md)
