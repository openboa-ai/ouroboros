# Knowledge Index

This repository uses a compact LLM-maintained wiki shape.

## Layers

- [README.md](README.md)
  Product-first top-level entry point
- [wiki/index.md](wiki/index.md)
  Internal maintained wiki
- [wiki/sources/README.md](wiki/sources/README.md)
  Source grounding and synthesis
- [wiki/product/README.md](wiki/product/README.md)
  Strategy, market, MLP, journey, and PRD product truth
- [wiki/architecture/README.md](wiki/architecture/README.md)
  Technical design downstream of locked PRDs
- [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md)
  Diagram-first architecture map for the object model, pod anatomy, runtime loop, live authority,
  and PR slice flow
- [docs/README.md](docs/README.md)
  Reserved future home for external service docs
- [wiki/architecture/specs/README.md](wiki/architecture/specs/README.md)
  Minimal active spec gate
- [wiki/architecture/adrs/README.md](wiki/architecture/adrs/README.md)
  Decision history
- [knowledge-log.md](knowledge-log.md)
  Append-only chronology
- [.agents/AGENTS.md](.agents/AGENTS.md)
  Repo-local workflow schema

## Read Order

1. [README.md](README.md)
2. [wiki/index.md](wiki/index.md)
3. [wiki/sources/README.md](wiki/sources/README.md)
4. [wiki/sources/library/index.md](wiki/sources/library/index.md)
5. [wiki/sources/synthesis/index.md](wiki/sources/synthesis/index.md)
6. [wiki/product/README.md](wiki/product/README.md)
7. [wiki/product/00-product-strategy.md](wiki/product/00-product-strategy.md)
8. [wiki/product/01-product-principles.md](wiki/product/01-product-principles.md)
9. [wiki/product/02-market-icp-and-alternatives.md](wiki/product/02-market-icp-and-alternatives.md)
10. [wiki/product/03-product-metrics-and-decision-rules.md](wiki/product/03-product-metrics-and-decision-rules.md)
11. [wiki/product/04-roadmap-now-next-later.md](wiki/product/04-roadmap-now-next-later.md)
12. [wiki/product/05-product-decision-log.md](wiki/product/05-product-decision-log.md)
13. [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md)
14. [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md)
15. [wiki/product/mlp-01/prds/README.md](wiki/product/mlp-01/prds/README.md)
16. [wiki/architecture/README.md](wiki/architecture/README.md)
17. [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md)
18. [wiki/product/mlp-01/07-implementation-plan.md](wiki/product/mlp-01/07-implementation-plan.md)
19. [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](wiki/product/mlp-01/08-greenfield-bootstrap-plan.md)
20. [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md)
21. [wiki/architecture/06-runtime-provider-adapter-feasibility.md](wiki/architecture/06-runtime-provider-adapter-feasibility.md)
22. [wiki/architecture/07-production-design-method.md](wiki/architecture/07-production-design-method.md)
23. [wiki/architecture/specs/15-agent-loop-policy-contract.md](wiki/architecture/specs/15-agent-loop-policy-contract.md)
24. [wiki/architecture/specs/16-order-intent-and-gateway-decision-contract.md](wiki/architecture/specs/16-order-intent-and-gateway-decision-contract.md)
25. the slice design note that matches the PRD you are implementing:
    [wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md](wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md),
    [wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md](wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md),
    [wiki/architecture/03-pr3-bounded-live-trading-system-pod-design.md](wiki/architecture/03-pr3-bounded-live-trading-system-pod-design.md), or
    [wiki/architecture/04-pr4-live-pod-remains-controllable-design.md](wiki/architecture/04-pr4-live-pod-remains-controllable-design.md)
26. the subsystem README that matches the PRD you are implementing
27. [wiki/architecture/specs/README.md](wiki/architecture/specs/README.md) only when needed
28. [wiki/architecture/adrs/README.md](wiki/architecture/adrs/README.md) for decision history
29. [ARCHITECTURE.md](ARCHITECTURE.md)

## Product Core Pages

- [wiki/product/00-product-strategy.md](wiki/product/00-product-strategy.md)
- [wiki/product/01-product-principles.md](wiki/product/01-product-principles.md)
- [wiki/product/02-market-icp-and-alternatives.md](wiki/product/02-market-icp-and-alternatives.md)
- [wiki/product/03-product-metrics-and-decision-rules.md](wiki/product/03-product-metrics-and-decision-rules.md)
- [wiki/product/04-roadmap-now-next-later.md](wiki/product/04-roadmap-now-next-later.md)
- [wiki/product/05-product-decision-log.md](wiki/product/05-product-decision-log.md)
- [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md)
- [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md)
- [wiki/product/mlp-01/01-problem-jtbd-and-value.md](wiki/product/mlp-01/01-problem-jtbd-and-value.md)
- [wiki/product/mlp-01/02-journey-map.md](wiki/product/mlp-01/02-journey-map.md)
- [wiki/product/mlp-01/03-story-map-and-release-slices.md](wiki/product/mlp-01/03-story-map-and-release-slices.md)
- [wiki/product/mlp-01/04-scope-and-cutline.md](wiki/product/mlp-01/04-scope-and-cutline.md)
- [wiki/product/mlp-01/05-success-metrics-and-launch-bar.md](wiki/product/mlp-01/05-success-metrics-and-launch-bar.md)
- [wiki/product/mlp-01/06-risks-and-open-questions.md](wiki/product/mlp-01/06-risks-and-open-questions.md)
- [wiki/product/mlp-01/07-implementation-plan.md](wiki/product/mlp-01/07-implementation-plan.md)
- [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](wiki/product/mlp-01/08-greenfield-bootstrap-plan.md)
- [wiki/product/mlp-01/prds/01-trader-system-candidate-becomes-real.md](wiki/product/mlp-01/prds/01-trader-system-candidate-becomes-real.md)
- [wiki/product/mlp-01/prds/02-candidate-becomes-externally-evaluated.md](wiki/product/mlp-01/prds/02-candidate-becomes-externally-evaluated.md)
- [wiki/product/mlp-01/prds/03-bounded-live-trading-system-pod.md](wiki/product/mlp-01/prds/03-bounded-live-trading-system-pod.md)
- [wiki/product/mlp-01/prds/04-live-pod-remains-controllable.md](wiki/product/mlp-01/prds/04-live-pod-remains-controllable.md)

## Architecture Core Pages

- [wiki/architecture/README.md](wiki/architecture/README.md)
- [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md)
- [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md)
- [wiki/architecture/06-runtime-provider-adapter-feasibility.md](wiki/architecture/06-runtime-provider-adapter-feasibility.md)
- [wiki/architecture/07-production-design-method.md](wiki/architecture/07-production-design-method.md)
- [wiki/architecture/specs/15-agent-loop-policy-contract.md](wiki/architecture/specs/15-agent-loop-policy-contract.md)
- [wiki/architecture/specs/16-order-intent-and-gateway-decision-contract.md](wiki/architecture/specs/16-order-intent-and-gateway-decision-contract.md)
- [wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md](wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md)
- [wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md](wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md)
- [wiki/architecture/03-pr3-bounded-live-trading-system-pod-design.md](wiki/architecture/03-pr3-bounded-live-trading-system-pod-design.md)
- [wiki/architecture/04-pr4-live-pod-remains-controllable-design.md](wiki/architecture/04-pr4-live-pod-remains-controllable-design.md)
- [wiki/architecture/foundation/README.md](wiki/architecture/foundation/README.md)
- [wiki/architecture/agent-system/README.md](wiki/architecture/agent-system/README.md)
- [wiki/architecture/evaluation-and-progression/README.md](wiki/architecture/evaluation-and-progression/README.md)
- [wiki/architecture/trading-substrate/README.md](wiki/architecture/trading-substrate/README.md)
- [wiki/architecture/proactive-operations/README.md](wiki/architecture/proactive-operations/README.md)
- [wiki/architecture/control-plane/README.md](wiki/architecture/control-plane/README.md)
- [wiki/architecture/specs/README.md](wiki/architecture/specs/README.md)
- [wiki/architecture/adrs/README.md](wiki/architecture/adrs/README.md)

## Source Anchors

The most important cross-source pages for the current reset are:

- [wiki/sources/synthesis/evaluation-governance-and-promotion.md](wiki/sources/synthesis/evaluation-governance-and-promotion.md)
- [wiki/sources/synthesis/agent-runtime-and-harness-principles.md](wiki/sources/synthesis/agent-runtime-and-harness-principles.md)
- [wiki/sources/synthesis/proactive-operations-and-wake-orchestration.md](wiki/sources/synthesis/proactive-operations-and-wake-orchestration.md)
- [wiki/sources/synthesis/reference-systems-and-product-postures.md](wiki/sources/synthesis/reference-systems-and-product-postures.md)
- [wiki/sources/library/anthropic-automated-alignment-researchers.md](wiki/sources/library/anthropic-automated-alignment-researchers.md)
- [wiki/sources/library/anthropic-automated-w2s-researcher.md](wiki/sources/library/anthropic-automated-w2s-researcher.md)
- [wiki/sources/library/repo-safety-research-automated-w2s-research.md](wiki/sources/library/repo-safety-research-automated-w2s-research.md)
- [wiki/sources/library/anthropic-managed-agents.md](wiki/sources/library/anthropic-managed-agents.md)
- [wiki/sources/library/google-agent2agent-a2a.md](wiki/sources/library/google-agent2agent-a2a.md)
- [wiki/sources/library/repo-paperclip.md](wiki/sources/library/repo-paperclip.md)

## Current Priorities

- keep the top-level product framing clear:
  `autokairos = automated weak-to-strong trader`
- keep Candidate identity as `TraderSystemCandidate`, not a static note
- keep `TradingSystemPod` as the running composite of image, package, binding, brain session,
  hands environment, and tool proxy
- keep `CapabilityPackage` as a versioned artifact boundary for context, tools, skills, and data
  access, with secrets outside the package
- keep `AgentRuntimeUnit` as the participant boundary for one-agent or many-agent pod shapes, with
  provider/driver choice on each runtime unit
- keep `runtime_unit_role` separate from `provider_kind`
- keep `AgentLoopPolicy` as the autonomy envelope, not a central workflow engine
- keep `PodCommunicationPolicy` as one provider-neutral policy per pod
- keep provider names grounded in concrete callable adapter surfaces; first real local adapter is
  `codex_cli`, not a generic "Codex" label
- keep A2A-compatible communication as a future agent-to-agent seam, not as provider selection,
  evidence, promotion, or live authority
- keep backtest, paper, and live as `StageBinding` differences for the same artifact
- keep the first wedge fixed as one serious solo operator on Binance BTC perpetual futures
- keep external evaluation, counted evidence, and promotion truth outside runtime self-report
- keep bounded live authority through the autokairos gateway
- keep `OrderIntent -> GatewayDecision -> ExecutionAttempt` explicit before PR3
- keep [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](wiki/product/mlp-01/08-greenfield-bootstrap-plan.md)
  and [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md)
  as the bridge from docs-only reset baseline to the Bootstrap PR
- keep [wiki/architecture/06-runtime-provider-adapter-feasibility.md](wiki/architecture/06-runtime-provider-adapter-feasibility.md)
  as the implementation-grade check before adding real provider execution
