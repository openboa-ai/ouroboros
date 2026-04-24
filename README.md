# autokairos

**autokairos is an automated weak-to-strong trader.**

It is a control plane for a weak human operator to create, run, evaluate, promote, and control
agent-built trader-system pods across backtest, paper, and live bindings.

## Why This Exists

The hard problem is not "can an agent write a trading idea?"

The hard problem is:

can a weak human supervisor build a reliable environment where stronger agent-built trader systems
can be generated, externally evaluated, promoted, and bounded in live trading?

That makes the product thesis:

- weak humans are weak supervisors relative to stronger always-on trader systems
- the product wins by making trader-system candidates count credibly, not by producing idea volume
- backtest, paper, and live should be the same artifact under different bindings
- live authority must be bounded through the autokairos control plane, not hidden inside an agent
  harness

## Product Model

The current active model is:

```text
TraderSystemCandidate
  -> TradingSystemImage + CapabilityPackage
  -> StageBinding(backtest | paper | live)
  -> TradingSystemPod
  -> Trace
  -> EvidenceRecord
  -> PromotionDecision
  -> bounded live execution
  -> wake / inspect / pause / stop / override
```

The important boundary is that a `Candidate` is not a static strategy note. It is a
`TraderSystemCandidate`: a versioned trader-system candidate that can be packaged, run, evaluated,
and promoted.

## First Wedge

The first lovable wedge is still deliberately narrow:

- user: one serious solo crypto operator
- market: Binance BTC perpetual futures
- proof: one agent-built `TraderSystemCandidate` becomes a bounded live `TradingSystemPod` and
  remains inspectable and controllable

This wedge is not the whole company. It is the first proof that the control-plane model works.

## Source Spine

The source hierarchy is now explicit:

- **AAR / Automated W2S / automated-w2s-research** define the thesis spine:
  weak supervision, external evaluation, legitimacy boundaries, and counted evidence.
- **Paperclip** defines the governance spine:
  wake, approval, intervention, audit, and recovery control.
- **Claude Managed Agents / Google A2A / Codex / Claude Code / OpenClaw / Multica** inform the
  runtime and interoperability spine:
  brain/hands/session separation, agent-to-agent communication, harness posture, external tools,
  background work, and operator re-entry.

Runtime references are only actionable when they map to a callable adapter surface. The current
first feasible local provider path is Codex CLI `codex exec`; Claude should be integrated through
Claude Agent SDK rather than a vague provider label.

Claude Managed Agents is used as an interface reference, not as a direct clone target. The key
lesson is that brain, hands, session, tools, resources, and vault-backed credentials must be
separable.

Google A2A is used as an interoperability reference, not as evidence or governance truth. The key
lesson is that independent agent endpoints need explicit task/message/artifact communication
boundaries, while tools and side effects remain MCP/tool-proxy concerns.

## Document Stack

autokairos now follows this order:

`sources -> product -> mlp-01 -> PRDs -> architecture -> active specs when needed -> PR`

That means:

- product truth lives in `wiki/product/`
- the current planning spine lives in `wiki/product/mlp-01/`
- architecture is downstream of the PRDs
- specs are active only when current implementation safety needs them
- ADRs preserve decision history rather than defining the current read path

The repository directory split is:

- `wiki/`
  Internal research, product, and architecture wiki
- `docs/`
  Future user-facing service documentation, intentionally light for now

## Repository Status

This repository should be read as a **design-locked docs-only reset workspace**.

The deleted legacy app/runtime tree is historical context, not the active implementation baseline.
The next code work is greenfield bootstrap, not legacy restoration.

The canonical implementation path is:

1. [wiki/product/mlp-01/07-implementation-plan.md](wiki/product/mlp-01/07-implementation-plan.md)
2. [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](wiki/product/mlp-01/08-greenfield-bootstrap-plan.md)
3. [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md)
4. [wiki/architecture/06-runtime-provider-adapter-feasibility.md](wiki/architecture/06-runtime-provider-adapter-feasibility.md)
5. [wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md](wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md)
6. [wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md](wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md)
7. [wiki/architecture/03-pr3-bounded-live-trading-system-pod-design.md](wiki/architecture/03-pr3-bounded-live-trading-system-pod-design.md)
8. [wiki/architecture/04-pr4-live-pod-remains-controllable-design.md](wiki/architecture/04-pr4-live-pod-remains-controllable-design.md)

## Current Canonical Areas

- [wiki/index.md](wiki/index.md)
- [wiki/sources/README.md](wiki/sources/README.md)
- [wiki/product/README.md](wiki/product/README.md)
- [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md)
- [wiki/product/mlp-01/prds/README.md](wiki/product/mlp-01/prds/README.md)
- [wiki/architecture/README.md](wiki/architecture/README.md)
- [wiki/architecture/specs/README.md](wiki/architecture/specs/README.md)
- [wiki/architecture/adrs/README.md](wiki/architecture/adrs/README.md)
- [docs/README.md](docs/README.md)
- [knowledge-index.md](knowledge-index.md)

## Read Next

1. [wiki/sources/README.md](wiki/sources/README.md)
2. [wiki/sources/synthesis/evaluation-governance-and-promotion.md](wiki/sources/synthesis/evaluation-governance-and-promotion.md)
3. [wiki/sources/synthesis/agent-runtime-and-harness-principles.md](wiki/sources/synthesis/agent-runtime-and-harness-principles.md)
4. [wiki/product/README.md](wiki/product/README.md)
5. [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md)
6. [wiki/product/mlp-01/prds/README.md](wiki/product/mlp-01/prds/README.md)
7. [wiki/architecture/README.md](wiki/architecture/README.md)
8. [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md)
9. [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](wiki/product/mlp-01/08-greenfield-bootstrap-plan.md)
10. [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md)
11. [wiki/architecture/06-runtime-provider-adapter-feasibility.md](wiki/architecture/06-runtime-provider-adapter-feasibility.md)
