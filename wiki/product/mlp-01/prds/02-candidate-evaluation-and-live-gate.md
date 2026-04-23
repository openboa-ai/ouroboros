# PRD: Candidate Evaluation And Live Gate

This PRD is the canonical downstream contract for `Slice 2: Path Becomes Trustworthy`.

It inherits the weak-supervision thesis from `01-problem-jtbd-and-value`, implements the second
trust moment from `02-journey-map`, maps directly to Slice 2 in
`03-story-map-and-release-slices`, respects the cutline in `04-scope-and-cutline`, does not claim
the success bars owned by `05-success-metrics-and-launch-bar`, and keeps only execution-detail
uncertainty allowed by `06-risks-and-open-questions`.

The trust question for this PRD is:

**`Why should I trust this path?`**

## Problem

The root problem at this stage is not lack of runs and not lack of analysis activity.

The problem is that a durable candidate still does not become trustworthy unless the product makes
evaluation meaning explicit.

Without that:

- the operator still has to decide manually what should count
- evidence remains a bag of runs rather than a governed progression record
- convenience checks and legitimate checks blur together
- the live gate becomes ceremonial because the serious judgment is still happening outside the
  product

This PRD exists to make one real candidate become one legibly evaluated candidate whose progression
meaning the operator can explain.

## Why This Matters

This is the first visible proof that autokairos governs progression rather than merely producing
activity.

It is the stage where the operator should feel:

- I can tell what counted
- I can tell what did not count
- I can tell why this candidate is stronger, weaker, held, or rejected
- I can tell what one live decision would actually mean

Without this stage, stronger search remains untrustworthy and live promotion remains emotionally
unsafe.

## User Trigger

The mostly manual serious solo operator now has one real candidate and wants the system to evaluate
it through governed evidence until one serious live decision can be made.

The operator is not asking for broad research output or arbitrary experimentation depth.

The operator is asking for one candidate to become legibly trustworthy enough that a bounded live
decision can later mean something real.

## Desired Outcome

One durable candidate accumulates stage-scoped evidence with explicit legitimacy boundaries.

By the end of this stage:

- counted and non-counted evidence are clearly separated
- the operator can inspect why the candidate is strengthening, weakening, held, or rejected
- one explicit per-candidate live gate exists with clear meaning
- the candidate may become eligible for promotion, but it is still not yet the live execution
  contract itself

## In-Scope Behavior

- one durable candidate is evaluated through staged evidence progression
- the system records what evidence counted and under what legitimacy conditions
- the system records what evidence did not count and why it did not count
- the operator can inspect why the candidate is stronger, weaker, held, or rejected
- stage progression remains visible rather than implicit
- one explicit per-candidate live gate is shown with clear decision meaning
- the first wedge stays explicit as scoped behavior:
  Binance BTC perpetual futures remains the first market context for evaluation and live-gate
  readiness

## Out-Of-Scope Behavior

- actual live deployment or live autonomous execution
- wake, inspect, pause, stop, or override behavior during live operation
- per-action approval loops after promotion
- multi-venue or multi-asset evaluation expansion
- arbitrary evaluation plugins with no product meaning
- broad ranking, optimization, or research-breadth systems beyond what is needed to judge one real
  candidate
- implicit promotion based on runtime success or paper success alone

## What Must Feel Lovable

- the operator can immediately tell what counts and what does not
- evaluation feels governed instead of opaque
- hold and reject remain trust-preserving outcomes rather than vague dead ends
- the live gate feels serious, bounded, and product-owned
- the operator no longer has to privately reconstruct why a candidate should or should not advance

## Critical Constraints

- evaluation is the bottleneck, not idea volume
- search and progression must remain distinct
- legitimacy boundaries must stay explicit
- convenience mode and legitimate mode must not be treated as equivalent
- illegitimate or low-trust evidence must not silently influence promotion meaning
- live promotion remains a per-candidate human gate
- counted evidence, non-counted evidence, and gate rationale must stay durable and reviewable

## Failure Scenarios

- many runs exist, but the operator still cannot tell what matters
- counted and non-counted evidence are blurred together
- illegitimate runs silently influence candidate advancement
- paper success is treated as live readiness by default
- hold or reject outcomes exist but remain hard to explain
- the live gate appears, but its meaning is ceremonial or fuzzy
- serious judgment still happens in private operator notes or memory outside the product

## Acceptance Criteria

- one durable candidate can accumulate stage-scoped evidence through evaluation
- the operator can distinguish counted from non-counted evidence for that candidate
- the operator can explain why the candidate is stronger, weaker, held, or rejected
- one explicit live gate exists with clear meaning for that candidate
- the operator can inspect the rationale supporting promotion eligibility without relying on private
  implementation knowledge
- the candidate is still not confused with actual live execution or post-promotion runtime behavior

## Metrics / Proof

- at least one operator can explain why a candidate did or did not advance using the product
  surface alone
- promotion, hold, and reject outcomes are based on visible counted evidence rather than hidden
  judgment
- illegitimate or low-trust evidence is not silently promoted into live-gate meaning
- candidate progression does not require the operator to preserve separate private notes just to
  understand the trust chain

## Open Questions

- what minimum evidence window should support the first live gate without overbuilding Slice 2?
- how much operator-facing summary is needed to make legitimacy instantly readable?
- how much stage detail should be visible before explanation quality collapses into overload?

These questions are execution-detail questions only.

They must not reopen:

- first user
- first market
- lovable proof
- live gate placement
- autonomy posture

## Subsystem Impact Map

- evaluation and progression:
  stage model, evidence capture, counted versus non-counted distinction, and candidate progression
  status
- durable evidence and gate control plane:
  reviewable evidence history, promotion-eligibility state, and explicit live-gate decision record
- operator-facing trust surface:
  the product must make legitimacy and advancement meaning visible without drifting into Slice 3 or
  Slice 4 behavior

## PR Slicing Guidance

- the first implementation milestone should close:
  `show counted versus non-counted evidence -> make candidate status meaning legible -> let the
  operator inspect why it is stronger, weaker, held, or rejected`
- the next milestone may close:
  `present one explicit live gate with reviewable decision meaning`
- do not ship a live gate before legitimacy visibility exists
- do not split counted-evidence visibility away from candidate-status meaning if that makes trust
  unreadable
