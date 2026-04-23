# autokairos Product Principles

## Purpose

This page translates the strongest research lessons into product rules.

These principles are not architecture slogans. They are the constraints that every MLP, PRD, and
delivery slice must respect.

## Principle 1: Evaluation Matters More Than Idea Volume

autokairos does not win by generating many hypotheses.

autokairos wins by making one hypothesis progress credibly toward live trading.

Implication:

- product surfaces should prioritize progression clarity over raw idea count

## Principle 2: Weak Human Oversight Is A First-Class Design Constraint

The first user is not weak in the sense of being uninformed.

The user is weak in the weak-to-strong sense: they cannot continuously or perfectly supervise a
stronger always-on trading system.

Implication:

- the product must help a weak supervisor govern a stronger system rather than pretending the human
  can manually evaluate every transition
- product trust depends on making strong-system behavior legible, bounded, and interruptible

## Principle 3: Legitimacy Comes Before Promotion

Helpful-looking output is not automatically legitimate evidence.

The product must distinguish between:

- evidence that counts
- evidence that is visible but does not count
- the actor that decides progression

Implication:

- promotion cannot be a fuzzy side effect of runtime convenience

## Principle 4: The Product Needs One Serious Human Gate

The first product should not spread human approval across every action.

It should place one serious human gate at the point where one candidate is allowed to enter live
bounded execution.

Implication:

- the operator approves one candidate deployment, not every live micro-action after promotion

## Principle 5: Autonomy Must Be Real But Bounded

Fake autonomy is not lovable.

If the operator still has to babysit every serious action, the product has failed.

Real autonomy does not mean unrestricted autonomy.

Implication:

- live operation should be fully autonomous only within explicit limits, risk boundaries, and
  intervention surfaces

## Principle 6: Operator Trust Is A Product Surface

Wake reason, approval meaning, intervention, and audit are not backoffice details.

They are part of the product experience.

Implication:

- the user-facing experience must make it obvious why the system acted, why it woke the operator,
  and how the operator can intervene

## Principle 7: Go Deep On One Market Before Broadening

Breadth too early weakens product truth.

The first product should prove one believable market path before claiming multi-venue portability
as product scope.

Implication:

- Binance BTC perpetual futures is a product boundary for the first lovable cut
- adapter portability remains an architecture requirement, not a marketing promise for the first cut

## Principle 8: Product Truth Must Precede Architecture

Architecture is downstream of product decisions.

If architecture has to infer who the user is, where the live gate sits, or what autonomy means, the
product layer is incomplete.

Implication:

- strategy, principles, MLP, and journey docs must become stable before deep spec growth

## Principle 9: PRDs Should Follow The User Journey, Not Subsystem Boundaries

The user experiences an end-to-end path, not separate internal subsystems.

Implication:

- PRDs should describe journey contracts such as hypothesis-to-candidate, candidate-to-evidence,
  live gate, live execution, and operator intervention
- subsystem docs belong in architecture, not product definition

## What These Principles Force Downstream

Any downstream document that changes one of the following must first update product truth:

- the primary user
- the first market
- what counts as legitimate evidence
- where the human gate lives
- what autonomy means
- whether operator trust is treated as product behavior

## Read Next

1. [02-market-icp-and-alternatives.md](02-market-icp-and-alternatives.md)
2. [mlp-01/00-mlp-brief.md](mlp-01/00-mlp-brief.md)
