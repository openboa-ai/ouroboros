# autokairos Product

This directory is the canonical PM operating system for autokairos.

It exists to answer product questions before architecture, specs, or implementation try to answer
them implicitly.

At the top level, the product should be read as:

**autokairos is an automated weak-to-strong trader: a control plane for evolving agent-built
trader-system pods across backtest, paper, and live bindings.**

The first lovable wedge under that brand is narrower:

- one serious solo crypto operator
- one market: Binance BTC perpetual futures
- one proof: one `TraderSystemCandidate` becomes a bounded live `TradingSystemPod` and remains
  externally evaluated, inspectable, and controllable

## Purpose

Use this directory to lock:

- the top-level product framing and category
- the first market and wedge
- the source-role hierarchy
- the product rules downstream docs cannot violate
- the current MLP and its lovable proof
- the journey contracts and PRDs that define the first implementation target

## Product Model

The active product model is:

- `TraderSystemCandidate`
  the candidate system under judgment
- `TradingSystemImage`
  the packaged trader-system definition
- `CapabilityPackage`
  versioned context, tool, skill, and data-access artifact; no secrets inside
- `StageBinding`
  backtest, paper, or live environment injection
- `TradingSystemPod`
  the running composite of image, package, binding, brain session, hands environment, and tool proxy
- `AgentRuntimeUnit`
  one brain/hands/session participant inside or beside a pod, including provider/driver choice
- `PodCommunicationPolicy`
  one provider-neutral rule for communication, sharing, routing, and isolation across runtime units

The product does not treat backtest, paper, and live as separate product systems. They are different
bindings for the same candidate artifact.

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
10. [mlp-01/08-greenfield-bootstrap-plan.md](mlp-01/08-greenfield-bootstrap-plan.md)
11. [../architecture/05-bootstrap-tech-spec.md](../architecture/05-bootstrap-tech-spec.md)
12. [../architecture/06-runtime-provider-adapter-feasibility.md](../architecture/06-runtime-provider-adapter-feasibility.md)

## Product Truth Rules

- product decisions must be explicit before architecture grows
- brand/category is upstream of wedge
- Candidate means `TraderSystemCandidate`
- Pod means `TradingSystemPod`, not merely a container
- `CapabilityPackage` is an artifact boundary and never a secret store
- multi-agent means explicit `AgentRuntimeUnit` records plus one pod-level communication policy,
  not a hidden agent mesh
- A2A-style communication is a traceable collaboration seam, not evidence, promotion, or live
  authority
- provider support must resolve to concrete callable adapter surfaces before implementation
- the MLP is downstream of strategy and principles
- PRDs are downstream of the MLP
- architecture is downstream of PRDs
- specs are active only when current PRD implementation needs them
- ADRs preserve history rather than defining current product truth

## Start Here

1. [../sources/synthesis/evaluation-governance-and-promotion.md](../sources/synthesis/evaluation-governance-and-promotion.md)
2. [../sources/synthesis/agent-runtime-and-harness-principles.md](../sources/synthesis/agent-runtime-and-harness-principles.md)
3. [../sources/synthesis/proactive-operations-and-wake-orchestration.md](../sources/synthesis/proactive-operations-and-wake-orchestration.md)
4. [../sources/synthesis/reference-systems-and-product-postures.md](../sources/synthesis/reference-systems-and-product-postures.md)
5. [00-product-strategy.md](00-product-strategy.md)
6. [01-product-principles.md](01-product-principles.md)
7. [02-market-icp-and-alternatives.md](02-market-icp-and-alternatives.md)
8. [03-product-metrics-and-decision-rules.md](03-product-metrics-and-decision-rules.md)
9. [04-roadmap-now-next-later.md](04-roadmap-now-next-later.md)
10. [05-product-decision-log.md](05-product-decision-log.md)
11. [mlp-01/README.md](mlp-01/README.md)
12. [mlp-01/00-mlp-brief.md](mlp-01/00-mlp-brief.md)
13. [mlp-01/prds/README.md](mlp-01/prds/README.md)
14. [../architecture/README.md](../architecture/README.md)
15. [../architecture/00-system-map.md](../architecture/00-system-map.md)
16. [mlp-01/08-greenfield-bootstrap-plan.md](mlp-01/08-greenfield-bootstrap-plan.md)
17. [../architecture/05-bootstrap-tech-spec.md](../architecture/05-bootstrap-tech-spec.md)
18. [../architecture/06-runtime-provider-adapter-feasibility.md](../architecture/06-runtime-provider-adapter-feasibility.md)

## Rule

If a document is trying to decide user, market, lovable proof, live gate meaning, autonomy posture,
or candidate/pod identity, it belongs here.

If it is trying to explain subsystem ownership or implementation-critical boundaries, it belongs in
`wiki/architecture/`.
