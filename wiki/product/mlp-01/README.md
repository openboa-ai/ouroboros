# MLP-01 Planning Pack

This directory contains the planning pack for the first lovable autokairos product.

It sits below the product strategy stack and above architecture. Its job is to make MLP-01
decision-complete before implementation starts.

## MLP-01 Definition

MLP-01 proves that one serious solo crypto operator can use autokairos to evolve a small pool of
agent-built `TraderSystemCandidates`, externally evaluate them, promote one, run it as a bounded
live `TraderSystemRuntime` on Binance BTC perpetual futures, and keep control through wake and
intervention.

This pack no longer defines a single static-note flow. It defines the first control-plane proof
for trader-system candidates and runtimes.

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
9. what bootstrap substrate must exist before PR1 feature implementation begins

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
10. [08-greenfield-bootstrap-plan.md](08-greenfield-bootstrap-plan.md)
11. [../../architecture/05-bootstrap-tech-spec.md](../../architecture/05-bootstrap-tech-spec.md)
12. [../../architecture/06-runtime-provider-adapter-feasibility.md](../../architecture/06-runtime-provider-adapter-feasibility.md)

## Planning Completion Standard

Planning is complete when:

- the MLP brief is stable
- the user problem and value proposition are decision-complete
- the journey map shows both as-is and to-be clearly, including trust breakpoints
- the story map yields a believable first release sequence with visible exit criteria
- scope and cutline can reject off-mission work quickly
- success, launch, and kill criteria are explicit
- remaining open questions are non-critical rather than identity-defining and include evidence gaps
- PRDs can be written or refined without redefining product truth
- one canonical implementation plan exists so coding does not start from subsystem-first drift
- one canonical bootstrap plan exists so coding does not start from legacy-restore inference or
  substrate drift
- one runtime-provider feasibility layer exists so coding does not start from vague Codex, Claude,
  OpenClaw/ACP, or A2A labels

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

Implementation should begin from [07-implementation-plan.md](07-implementation-plan.md), then
[08-greenfield-bootstrap-plan.md](08-greenfield-bootstrap-plan.md), then
[../../architecture/05-bootstrap-tech-spec.md](../../architecture/05-bootstrap-tech-spec.md), not
from old subsystem-level implementation plans or the deleted legacy app/runtime tree.

Real provider execution should additionally read
[../../architecture/06-runtime-provider-adapter-feasibility.md](../../architecture/06-runtime-provider-adapter-feasibility.md)
before implementation. Provider labels are not enough; the implementation must name an invocation
surface, auth mode, sandbox policy, trace mode, and output contract.
