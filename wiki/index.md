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
16. [product/mlp-01/07-implementation-plan.md](product/mlp-01/07-implementation-plan.md)
17. [architecture/01-pr1-path-becomes-real-design.md](architecture/01-pr1-path-becomes-real-design.md)
18. the subsystem README that matches the PRD you are implementing
19. [architecture/specs/README.md](architecture/specs/README.md) only when needed
20. [architecture/adrs/README.md](architecture/adrs/README.md) for decision history

## Rule

Use `sources/` to ground what the references imply.

Use `product/` to define what must matter to the user and what the product must do.

Use `architecture/` only after `mlp-01` PRDs are clear enough to constrain technical design.

Use `product/mlp-01/07-implementation-plan.md` as the canonical build-order page once product and
architecture lock is complete.

Use `architecture/01-pr1-path-becomes-real-design.md` as the canonical PR1 implementation-shape
page before touching code for Slice 1.

Use [../knowledge-index.md](../knowledge-index.md) as the top-level navigation layer.
