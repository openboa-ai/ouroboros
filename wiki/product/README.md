# autokairos Product

This directory is the canonical PM operating system for autokairos.

It exists to answer product questions before architecture, specs, or implementation try to answer
them implicitly.

At the top level, the product should be read as:

**autokairos is an automated weak-to-strong trader.**

The first lovable wedge under that brand is narrower:

- one serious solo crypto operator
- one market: Binance BTC perpetual futures
- one proof: stronger governed trading behavior under weak human oversight

## Purpose

Use this directory to lock:

- the top-level product framing and category
- the first market and wedge
- the product rules downstream docs cannot violate
- the current MLP and its lovable proof
- the journey contracts and PRDs that define the first implementation target

## What Belongs Here

- product strategy
- product principles
- market / ICP / alternatives analysis
- metrics and product decision rules
- roadmap priorities
- product decision log
- MLP-01 planning pack
- MLP-01 PRDs

## What Does Not Belong Here

- subsystem ownership
- technical interfaces
- low-level contracts
- ADR history

Those belong in [../architecture/README.md](../architecture/README.md) only after the PRDs are
locked.

## Product Stack

1. [00-product-strategy.md](00-product-strategy.md)
2. [01-product-principles.md](01-product-principles.md)
3. [02-market-icp-and-alternatives.md](02-market-icp-and-alternatives.md)
4. [03-product-metrics-and-decision-rules.md](03-product-metrics-and-decision-rules.md)
5. [04-roadmap-now-next-later.md](04-roadmap-now-next-later.md)
6. [05-product-decision-log.md](05-product-decision-log.md)
7. [mlp-01/README.md](mlp-01/README.md)
8. [mlp-01/prds/README.md](mlp-01/prds/README.md)
9. [mlp-01/07-implementation-plan.md](mlp-01/07-implementation-plan.md)

## Product Truth Rules

- product decisions must be explicit before architecture grows
- brand/category is upstream of wedge
- the MLP is downstream of strategy and principles
- PRDs are downstream of the MLP
- architecture is downstream of PRDs
- the canonical implementation plan is downstream of PRDs and the reduced architecture baseline
- specs are active only when current PRD implementation needs them
- ADRs preserve history rather than defining current product truth

## Start Here

1. [../sources/synthesis/evaluation-governance-and-promotion.md](../sources/synthesis/evaluation-governance-and-promotion.md)
2. [../sources/synthesis/proactive-operations-and-wake-orchestration.md](../sources/synthesis/proactive-operations-and-wake-orchestration.md)
3. [../sources/synthesis/reference-systems-and-product-postures.md](../sources/synthesis/reference-systems-and-product-postures.md)
4. [00-product-strategy.md](00-product-strategy.md)
5. [01-product-principles.md](01-product-principles.md)
6. [02-market-icp-and-alternatives.md](02-market-icp-and-alternatives.md)
7. [03-product-metrics-and-decision-rules.md](03-product-metrics-and-decision-rules.md)
8. [04-roadmap-now-next-later.md](04-roadmap-now-next-later.md)
9. [05-product-decision-log.md](05-product-decision-log.md)
10. [mlp-01/README.md](mlp-01/README.md)
11. [mlp-01/00-mlp-brief.md](mlp-01/00-mlp-brief.md)
12. [mlp-01/prds/README.md](mlp-01/prds/README.md)
13. [../architecture/README.md](../architecture/README.md)
14. [../architecture/00-system-map.md](../architecture/00-system-map.md)
15. [mlp-01/07-implementation-plan.md](mlp-01/07-implementation-plan.md)

## Rule

If a document is trying to decide user, market, lovable proof, live gate meaning, or autonomy
posture, it belongs here.

If it is trying to explain subsystem ownership or implementation-critical boundaries, it belongs in
`wiki/architecture/`.
