# autokairos Market, ICP, And Alternatives

## Purpose

This page exists to make the product wedge defensible at a PM level.

It answers:

- which user segment is actually being chosen first
- why that user is the right ICP
- which market category autokairos is entering
- what alternatives already serve that workflow
- why the first market is Binance BTC perpetual futures
- what this analysis forces downstream in the MLP and PRDs

This page sits between strategy and MLP.

## Market Category

autokairos is not entering the market as:

- a generic AI chat product
- a retail investing assistant
- a generalized quant research suite
- a broad trading terminal

The relevant product category is:

**always-on trading operator system for governed strategy progression and bounded live execution**

That category matters because the product value is not pure ideation and not pure execution alone.
It sits across:

- strategy origination
- candidate formation
- legitimacy-aware evaluation
- promotion gating
- bounded live execution
- wake and intervention

## Why This Market Matters

The first-market wedge is not arbitrary.

The strongest reasons are:

1. crypto perpetual futures are a dominant trading format
2. perpetuals fit always-on runtime behavior better than expiring contracts
3. BTC perpetuals are the cleanest first instrument for trust, liquidity, and explainability
4. a solo operator can feel the pain sharply without team workflow complexity

Current external references support that framing:

- Coinbase wrote that perpetual futures dominate roughly 90% of global crypto derivatives trading
  volume in its July 2025 U.S. perpetual futures announcement.
- Coinbase also presents perpetual futures as a core advanced-trader surface across a wide set of
  markets on Coinbase Advanced and Coinbase International Exchange.
- CME Bitcoin futures, by contrast, are cash-settled and expire on a monthly cycle, which makes
  them a worse first fit for an always-on trading runtime proof.

This does not prove Binance specifically by itself, but it does validate the product category and
why a perpetual-first wedge is better than a dated-futures-first wedge.

Sources:

- [Coinbase perpetual futures announcement](https://www.coinbase.com/zh-cn/blog/perpetual-futures-have-arrived-in-the-us)
- [Coinbase perpetual futures product page](https://www.coinbase.com/perpetuals/)
- [Coinbase International Exchange](https://www.coinbase.com/international-exchange)
- [CME Bitcoin futures overview](https://www.cmegroup.com/education/courses/introduction-to-bitcoin/what-are-bitcoin-futures)

## User Segments Considered

Several plausible user segments exist, but they are not equally good first wedges.

| Segment | Why it is attractive | Why it is not the first wedge |
| --- | --- | --- |
| Serious solo crypto operator | Acute pain, fast feedback loop, low coordination overhead, direct trust problem | Narrower market at first |
| Small crypto trading team | Larger budgets, collaborative workflows | Adds approvals, shared visibility, and team ops too early |
| Discretionary retail trader | Large top-of-funnel audience | Too broad, too education-heavy, too weak on legitimate automation demand |
| Institutional desk or prop team | High economic upside | Procurement, compliance, permissions, and integrations distort the first lovable cut |

## Chosen Primary User

The chosen first user is:

**one serious solo crypto operator who trades real capital and wants an always-on agent to move one
strategy all the way into live trading without requiring constant babysitting**

Why this segment wins first:

- the pain is strong enough to justify a non-trivial system
- the user can evaluate value quickly
- one person can approve a live gate without team workflow
- the product can prove trust with fewer moving organizational parts
- failure is legible: if the operator still has to do the serious work manually, the product failed

## User Selection Criteria

This primary user was selected because the first MLP needs:

- high urgency
- a live trading use case, not a research-only use case
- tolerance for automation if trust is strong
- low organizational overhead
- a narrow market where one believable win matters more than broad coverage

The serious solo operator is the best fit across all five.

## Core User Pain

The user pain is not "I need more ideas."

The user pain is:

**I cannot continuously watch the market, I cannot fully trust ad hoc agent output, and I do not
have a believable system that turns one strategy into legitimate live trading without making me the
permanent runtime loop.**

That breaks down into four pain clusters:

- search pain: too many ideas, too little durable progression
- legitimacy pain: unclear what evidence should count
- deployment pain: paper success does not naturally justify live risk
- operating pain: once live, the human becomes the fallback runtime

## Existing Alternatives

Today this user usually solves the problem with some combination of:

- manual discretionary trading
- ad hoc scripts and notebooks
- backtesting frameworks plus separate exchange execution
- alert bots and dashboards
- generic coding agents or copilots

These alternatives all fail in one of two ways:

1. they help with one stage only
2. they shift hidden labor back onto the operator

That is why autokairos should not think of itself as competing only with "another AI agent."

It is competing with the operator's stitched-together workflow.

## Why Binance BTC Perpetual Futures First

The first market wedge is:

- Binance futures
- BTC perpetual futures only

This choice is good PM strategy for several reasons.

### 1. The instrument is liquid, familiar, and easy to explain

BTC perpetual futures are one of the most legible and commonly watched instruments in crypto
derivatives. That helps the operator understand what the system is doing and why it matters.

### 2. Perpetuals fit always-on behavior

Perpetual contracts match the product's persistent, wakeable, always-on agent posture better than
dated monthly futures.

### 3. One venue prevents false generality

The first lovable proof should not be diluted by multi-venue abstraction, routing variance, or
cross-exchange semantics.

### 4. BTC is the cleanest first trust asset

For a first lovable cut, BTC is easier to justify than a long tail of altcoin contracts because the
operator can spend more attention on trust, legitimacy, and operating behavior rather than on
asset-selection complexity.

## Why Not Start With Something Broader

The first MLP should not begin with:

- multi-venue execution
- multi-asset portfolio behavior
- spot plus options plus futures together
- a general "bring any strategy" product surface

Those all create the appearance of strategic breadth, but they weaken the first lovable proof.

## Market Risks

This wedge also comes with risks.

- Binance availability is jurisdiction-sensitive
- product meaning could drift into exchange-specific workflow detail
- a narrow first wedge can be mistaken for the whole company
- BTC-perp-first may underserve users who mainly care about portfolio-level automation

These are acceptable first-product risks, but they should stay explicit.

## Product Implications

This analysis forces several downstream product choices:

- the first UX should optimize for one operator, not team collaboration
- counted versus non-counted evidence must be visible before live promotion
- live gate meaning must be extremely explicit
- wake and intervention cannot be treated as admin-only surfaces
- venue portability is real, but it belongs in architecture rather than first-cut scope

## Questions This Analysis Settles

This page should settle the following for the current product strategy:

- the first user is a serious solo operator
- the product category is an always-on trading operator system
- the product is competing with fragmented operator workflows, not just other AI tools
- the first market wedge is Binance BTC perpetual futures
- a narrow believable live path is strategically better than early breadth

## Read Next

1. [03-product-metrics-and-decision-rules.md](03-product-metrics-and-decision-rules.md)
2. [mlp-01/00-mlp-brief.md](mlp-01/00-mlp-brief.md)
3. [mlp-01/01-problem-jtbd-and-value.md](mlp-01/01-problem-jtbd-and-value.md)
