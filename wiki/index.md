# Wiki

This directory is the maintained internal wiki for autokairos.

It has three primary layers:

1. `sources`
   Research grounding and synthesis
2. `product`
   strategy, market, MLP, journey, and PRD product truth
3. `architecture`
   technical design downstream of locked PRDs

The repository keeps a separate role for:

- `wiki/`
  Internal research, product, and architecture knowledge
- `docs/`
  Future user-facing service documentation

## Current Product Model

The active product model is:

`weak human -> agent-built TraderSystemCandidates -> TraderSystemRuntimes with explicit AgentSpecs, AgentSessions, AgentRuns, and AgentEvents -> externally evaluated candidates -> promoted bounded live runtime -> wake / inspect / pause / stop / override`

Candidate identity, runtime identity, capability packaging, and stage binding are product truth, not
implementation garnish.

Multi-agent execution is also product-sensitive: agents may collaborate through provider-native
team threads or A2A-compatible endpoints, but communication outputs remain trace inputs until
autokairos evaluation and governance decide otherwise.

Provider choice is per `AgentSession`; communication and sharing are governed by one
provider-neutral `RuntimeCommunicationPolicy` for the pod.

Provider choice is not implementation-ready until it names a callable adapter surface, such as
`codex_cli` through `codex exec` or `claude_agent_sdk_python` through Claude Agent SDK.

## Read Order

1. [sources/README.md](sources/README.md)
2. [sources/library/index.md](sources/library/index.md)
3. [sources/synthesis/index.md](sources/synthesis/index.md)
4. [product/README.md](product/README.md)
5. [product/00-product-strategy.md](product/00-product-strategy.md)
6. [product/01-product-principles.md](product/01-product-principles.md)
7. [product/02-market-icp-and-alternatives.md](product/02-market-icp-and-alternatives.md)
8. [product/03-product-metrics-and-decision-rules.md](product/03-product-metrics-and-decision-rules.md)
9. [product/04-roadmap-now-next-later.md](product/04-roadmap-now-next-later.md)
10. [product/05-product-decision-log.md](product/05-product-decision-log.md)
11. [product/mlp-01/README.md](product/mlp-01/README.md)
12. [product/mlp-01/00-mlp-brief.md](product/mlp-01/00-mlp-brief.md)
13. [product/mlp-01/prds/README.md](product/mlp-01/prds/README.md)
14. [architecture/README.md](architecture/README.md)
15. [architecture/00-system-map.md](architecture/00-system-map.md)
16. [architecture/08-runtime-authority-model.md](architecture/08-runtime-authority-model.md)
17. [architecture/09-trader-system-runtime-operating-model.md](architecture/09-trader-system-runtime-operating-model.md)
18. [product/mlp-01/07-implementation-plan.md](product/mlp-01/07-implementation-plan.md)
19. [product/mlp-01/08-greenfield-bootstrap-plan.md](product/mlp-01/08-greenfield-bootstrap-plan.md)
20. [architecture/05-bootstrap-tech-spec.md](architecture/05-bootstrap-tech-spec.md)
21. [architecture/06-runtime-provider-adapter-feasibility.md](architecture/06-runtime-provider-adapter-feasibility.md)
22. the slice design note that matches the PRD you are implementing:
    [architecture/01-pr1-trader-system-candidate-becomes-real-design.md](architecture/01-pr1-trader-system-candidate-becomes-real-design.md),
    [architecture/02-pr2-candidate-becomes-externally-evaluated-design.md](architecture/02-pr2-candidate-becomes-externally-evaluated-design.md),
    [architecture/03-pr3-bounded-live-trader-system-runtime-design.md](architecture/03-pr3-bounded-live-trader-system-runtime-design.md), or
    [architecture/04-pr4-live-runtime-remains-controllable-design.md](architecture/04-pr4-live-runtime-remains-controllable-design.md)
23. the subsystem README that matches the PRD you are implementing
24. [architecture/specs/README.md](architecture/specs/README.md) for the active spec gate
25. [architecture/adrs/README.md](architecture/adrs/README.md) for decision history

## Rule

Use `sources/` to ground what the references imply.

Use `product/` to define what must matter to the user and what the product must do.

Use `architecture/` only after `mlp-01` PRDs are clear enough to constrain technical design.

Use `product/mlp-01/08-greenfield-bootstrap-plan.md` and
`architecture/05-bootstrap-tech-spec.md` as the bridge from docs-only reset baseline into the
Bootstrap PR. Use `architecture/06-runtime-provider-adapter-feasibility.md` before implementing
real Codex, Claude, OpenClaw/ACP, or A2A runtime adapters.

Use the `architecture/01-04` slice design notes as the canonical implementation-shape layer before
touching code for each slice.

Use [../knowledge-index.md](../knowledge-index.md) as the top-level navigation layer.
