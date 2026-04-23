# MLP-01 Planning Pack

This directory contains the full planning pack for the first lovable autokairos product.

It sits below the product strategy stack and above architecture. Its job is to make MLP-01
decision-complete before implementation starts.

## Purpose

This pack must answer:

1. what exactly MLP-01 promises
2. what user problem and JTBD it is solving
3. what as-is and to-be journey it is trying to change
4. what user activities and release slices define the first lovable cut
5. what is in, out, and later
6. what launch bar, success bar, and kill bar apply
7. what open questions remain after planning
8. how implementation should proceed once the MLP, PRDs, and architecture baseline are locked

## Read Order

1. [00-mlp-brief.md](00-mlp-brief.md)
2. [01-problem-jtbd-and-value.md](01-problem-jtbd-and-value.md)
3. [02-journey-map.md](02-journey-map.md)
4. [03-story-map-and-release-slices.md](03-story-map-and-release-slices.md)
5. [04-scope-and-cutline.md](04-scope-and-cutline.md)
6. [05-success-metrics-and-launch-bar.md](05-success-metrics-and-launch-bar.md)
7. [06-risks-and-open-questions.md](06-risks-and-open-questions.md)
8. [prds/README.md](prds/README.md)
9. [07-implementation-plan.md](07-implementation-plan.md)

## Planning Completion Standard

Planning is complete when:

- the MLP brief is stable
- the user problem and value proposition are decision-complete
- the journey map shows both as-is and to-be clearly, including trust breakpoints
- the story map yields a believable first release slice with visible exit criteria
- scope and cutline can reject off-mission work quickly
- success, launch, and kill criteria are explicit
- remaining open questions are non-critical rather than identity-defining and include evidence gaps
- PRDs can be written or refined without redefining product truth
- one canonical implementation plan exists so coding does not start from subsystem-first drift

## Relationship To Other Product Docs

- [../00-product-strategy.md](../00-product-strategy.md)
- [../01-product-principles.md](../01-product-principles.md)
- [../02-market-icp-and-alternatives.md](../02-market-icp-and-alternatives.md)
- [../03-product-metrics-and-decision-rules.md](../03-product-metrics-and-decision-rules.md)
- [../04-roadmap-now-next-later.md](../04-roadmap-now-next-later.md)
- [../05-product-decision-log.md](../05-product-decision-log.md)

## Rule

Architecture and specs are not allowed to answer a question that this planning pack is supposed to
answer first.

Implementation should begin from [07-implementation-plan.md](07-implementation-plan.md), not from
old subsystem-level implementation plans.
