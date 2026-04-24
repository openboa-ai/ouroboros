# Product Requirements

These PRDs define MLP-01 as trader-system trust contracts.

They are not subsystem specs, and they are not the top-level product-definition layer.

They are downstream of:

- product strategy
- product principles
- market / ICP / alternatives
- product metrics and decision rules
- roadmap and decision log
- the `mlp-01` planning pack

Each PRD answers:

- what must work
- why it matters
- what must feel lovable
- what is in and out
- what the acceptance bar is
- which open questions remain
- what architecture must support
- how PRs should be sliced to close meaningful milestones

## PRD Order

1. [01-trader-system-candidate-becomes-real.md](01-trader-system-candidate-becomes-real.md)
   A `TraderSystemCandidate` must become durable and inspectable rather than disappearing into
   harness output.
2. [02-candidate-becomes-externally-evaluated.md](02-candidate-becomes-externally-evaluated.md)
   The candidate must run under an evaluation binding and produce externally judged evidence.
3. [03-bounded-live-trading-system-pod.md](03-bounded-live-trading-system-pod.md)
   One promoted candidate must run as a bounded live `TradingSystemPod`.
4. [04-live-pod-remains-controllable.md](04-live-pod-remains-controllable.md)
   The live pod must remain inspectable, interruptible, auditable, and version-safe.

## PRD Rule

Architecture and specs should only add detail that is necessary to implement one of these journey
contracts safely.

Implementation should begin from:

- [../07-implementation-plan.md](../07-implementation-plan.md)
- [../08-greenfield-bootstrap-plan.md](../08-greenfield-bootstrap-plan.md)

and not by jumping directly from PRDs into assumed legacy code structure.

Do not deepen PRDs in ways that reopen:

- first market scope
- `TraderSystemCandidate` as candidate identity
- `TradingSystemPod` as execution unit
- `CapabilityPackage` as context/tool artifact boundary
- live gate placement
- bounded live authority posture
