# autokairos

**autokairos is an automated weak-to-strong trader.**

It is a product for a serious operator who wants an always-on system to originate a trading
hypothesis, drive it through governed evaluation, and put it into live trading autonomously within
limits without losing trust, control, or auditability.

## Why This Exists

The hard problem is not "how do we spin up an agent?"

The hard problem is:

how does a weak human operator safely create, govern, and supervise a stronger trading system?

In product terms:

how do we turn `ship strategy -> execute trading` into one continuous governed product path?

Today that path usually breaks in the middle.

- ideas do not become durable candidates
- evidence is hard to trust
- paper success does not cleanly become live deployment
- live execution either feels unsafe or requires constant human babysitting

autokairos exists to close that path.

It should not be read as:

- an AI idea generator
- a generic autonomous trading bot
- a broad quant research environment

It should be read as:

- stronger search
- stronger delivery
- stronger bounded operation

under weak human oversight.

## First Wedge

The first lovable product is for a **serious solo crypto operator**.

This operator:

- cannot watch the market and the agent all the time
- wants more than a copilot chat window
- wants agent-originated ideas to become real trading paths
- wants autonomy in live trading, but only inside explicit limits

This is the first ICP and wedge, not the whole brand.

## The First Lovable Product

The first lovable proof is simple:

one agent-originated trading hypothesis becomes one real candidate, survives governed evaluation,
passes a live gate, runs live on Binance BTC perpetual futures, and stays controllable through
meaningful wake and intervention.

The first product posture is fixed as:

- Binance BTC perpetual futures only
- agent-originated hypothesis only
- per-candidate live deployment as the human gate
- full autonomous execution within limits after promotion
- adapter-based venue portability as a technical requirement, not a first-release marketing claim

## What The Research Forces

autokairos is mainly inspired by four source clusters:

- **Automated Alignment Researchers**
  Search scales, but evaluation becomes the bottleneck.
- **Automated W2S Researcher**
  What counts, what does not count, and who decides promotion must stay explicit.
- **automated-w2s-research repo**
  Convenience mode and legitimate mode are not the same thing.
- **Paperclip**
  Persistent wake, approvals, intervention, and audit are product value, not admin garnish.

Those sources force five product rules:

- search and progression are different
- humans become weak supervisors relative to stronger systems
- legitimacy boundaries must be explicit
- operator trust must be product-visible
- live autonomy must stay governed rather than fuzzy

## Document Stack

autokairos now follows this order:

`sources -> strategy -> principles -> market/ICP -> metrics/decision rules -> roadmap -> mlp-01 planning pack -> mlp-01 PRDs -> architecture -> active specs when needed -> ADR history -> PR`

That means:

- research grounds the product
- product truth lives in `wiki/product/`
- the current planning spine lives in `wiki/product/mlp-01/`
- architecture is downstream of the PRDs
- specs are active only when current PRD implementation needs them
- ADRs preserve decision history rather than defining the current read path

The repository directory split now follows:

- `wiki/`
  Internal research, product, and architecture wiki
- `docs/`
  Future user-facing service documentation, intentionally kept light for now

## Repository Status

This repository is still documentation-first, but the current center of gravity has moved.

The current goal is:

use the locked `mlp-01` PRDs to reset the active architecture baseline, then cut implementation PRs
against one believable delegated live path.

The canonical implementation entry point after PRD and architecture lock is:

- [wiki/product/mlp-01/07-implementation-plan.md](wiki/product/mlp-01/07-implementation-plan.md)
  Build order and first PR breakdown for MLP-01

Current canonical areas:

- [wiki/index.md](wiki/index.md)
  Internal wiki root
- [wiki/sources/README.md](wiki/sources/README.md)
  Source grounding and synthesis
- [wiki/product/README.md](wiki/product/README.md)
  Product truth through strategy, market analysis, `mlp-01`, and PRDs
- [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md)
  Current planning pack for the first lovable product
- [wiki/product/mlp-01/prds/README.md](wiki/product/mlp-01/prds/README.md)
  Locked product-to-architecture input contract
- [wiki/architecture/README.md](wiki/architecture/README.md)
  Technical design downstream of the PRDs
- [wiki/architecture/specs/README.md](wiki/architecture/specs/README.md)
  Minimal active spec gate
- [wiki/architecture/adrs/README.md](wiki/architecture/adrs/README.md)
  Architecture decision history
- [docs/README.md](docs/README.md)
  Reserved future home for external service docs
- [knowledge-index.md](knowledge-index.md)
  Top-level navigation

## Read Next

1. [wiki/sources/README.md](wiki/sources/README.md)
2. [wiki/sources/synthesis/evaluation-governance-and-promotion.md](wiki/sources/synthesis/evaluation-governance-and-promotion.md)
3. [wiki/sources/synthesis/proactive-operations-and-wake-orchestration.md](wiki/sources/synthesis/proactive-operations-and-wake-orchestration.md)
4. [wiki/product/README.md](wiki/product/README.md)
5. [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md)
6. [wiki/product/mlp-01/prds/README.md](wiki/product/mlp-01/prds/README.md)
7. [wiki/architecture/README.md](wiki/architecture/README.md)
8. [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md)
9. [wiki/product/mlp-01/07-implementation-plan.md](wiki/product/mlp-01/07-implementation-plan.md)
10. [wiki/architecture/01-pr1-path-becomes-real-design.md](wiki/architecture/01-pr1-path-becomes-real-design.md)
11. [ARCHITECTURE.md](ARCHITECTURE.md)
