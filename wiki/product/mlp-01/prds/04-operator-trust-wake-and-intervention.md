# PRD: Operator Trust, Wake, And Intervention

This PRD is the canonical downstream contract for `Slice 4: Delegation Stays Safe Under Live Conditions`.

It inherits the weak-supervision thesis from `01-problem-jtbd-and-value`, implements the fourth
trust moment from `02-journey-map`, maps directly to Slice 4 in
`03-story-map-and-release-slices`, respects the cutline in `04-scope-and-cutline`, supports the
judgment bars in `05-success-metrics-and-launch-bar`, and keeps only execution-detail uncertainty
allowed by `06-risks-and-open-questions`.

The trust question for this PRD is:

**`Can I stay in control after I let it trade?`**

## Problem

The root problem at this stage is not simply that live systems can fail.

The problem is that live delegation still collapses if the operator cannot understand why they were
woken, what it means, and what decisive action is available.

Without that:

- bounded autonomy still feels emotionally unsafe
- the operator falls back into constant shadow monitoring
- wake surfaces become noise instead of trust-preserving signals
- intervention becomes an internal engineering escape hatch instead of product control

This PRD exists to make live delegation stay governable even when the happy path breaks.

## Why This Matters

Trust is not complete when the path goes live.

Trust is complete only when the operator believes:

- I do not have to stare at the system constantly
- if I am interrupted, the reason is meaningful
- I can understand what happened quickly
- I can act decisively without becoming the permanent runtime again

This is the stage where autokairos proves that control survives live autonomy rather than being
traded away for it.

Without this stage, Slice 3 can still degrade into fake autonomy carried by hidden human vigilance.

## User Trigger

The mostly manual serious solo operator has already allowed one path to trade live and is now away
from the constant runtime loop.

The operator expects to be interrupted only when something meaningful requires attention and expects
the product to return control cleanly if intervention is needed.

The operator is not asking for a broad operations console or enterprise workflow.

The operator is asking for trustworthy wake and decisive intervention around one believable live
path.

## Desired Outcome

The operator is only interrupted for meaningful reasons, understands the reason immediately, and
can inspect, pause, stop, or override without collapsing back into permanent manual supervision.

By the end of this stage:

- wake reasons are explicit and understandable
- the current situation is inspectable in operator language
- decisive control actions exist for one live path
- important intervention events remain auditable afterward
- control returns without destroying the trust earned by bounded live delegation

## In-Scope Behavior

- wake the operator for meaningful market, risk, execution, or policy reasons during live
  operation
- explain why the wake happened, why it matters now, and what happens if no action is taken
- let the operator inspect current live posture, recent actions, and relevant candidate context
- let the operator pause, stop, or override one live path decisively
- preserve an audit trail for meaningful wake and intervention events
- keep the first wedge explicit as scoped behavior:
  wake and intervention apply to the first live path on Binance BTC perpetual futures

## Out-Of-Scope Behavior

- full enterprise compliance or incident-management consoles
- waking for every low-value internal event
- generic company-management workflow metaphors
- multi-operator coordination or escalation chains
- broad operational analytics unrelated to one live path staying controllable
- replacing normal bounded autonomy with per-action manual approval loops

## What Must Feel Lovable

- the operator can step away instead of shadowing the system continuously
- one wake is understandable in seconds
- the operator can tell why this interruption matters now
- intervention feels decisive rather than like falling into internal system complexity
- control recovery preserves trust instead of proving that autonomy was fake all along

## Critical Constraints

- wake reason must be explicit
- wake surfaces must be meaningful rather than noisy
- operator trust must remain product-visible during intervention moments
- intervention must exist without collapsing normal autonomy into manual runtime
- auditability must survive pause, stop, and override behavior
- control actions must operate on one concrete live path, not a vague system state
- intervention surfaces must not reopen product scope into a broad operations platform

## Failure Scenarios

- the system wakes too often with low-value noise
- the operator cannot tell why they were woken or why it matters now
- the operator cannot see what action is available or what happens next
- pause, stop, or override are unclear, slow, or only partially effective
- override exists only as an internal engineering path rather than an operator surface
- the operator keeps shadow-monitoring constantly because wake trust never lands
- intervention works mechanically but leaves no usable audit trail

## Acceptance Criteria

- the system can wake the operator for one meaningful live reason with clear explanation
- the operator can inspect the current situation quickly enough to decide what to do
- the operator can pause, stop, or override one live path without entering technical internals
- wake and intervention preserve control without restoring permanent manual runtime
- meaningful intervention actions are auditable afterward
- the operator can explain why they were woken and what action they took from the product surface
  alone

## Metrics / Proof

- operators report that wakes are meaningful rather than noisy
- operators can explain why they were woken and why the reason mattered
- intervention can be completed decisively without entering technical internals
- constant shadow-monitoring drops because the operator trusts wake and intervention enough to step
  away
- audit records are sufficient to reconstruct meaningful intervention events afterward

## Open Questions

- which wake channels should be first-class in the initial operator experience?
- how much context is enough for the operator to understand a wake in seconds without overload?
- what minimum action set is sufficient for decisive control in MLP-01 without broadening the
  product surface unnecessarily?

These questions are execution-detail questions only.

They must not reopen:

- first user
- first market
- lovable proof
- live gate placement
- autonomy posture

## Subsystem Impact Map

- proactive operations:
  wake orchestration, wake reason generation, and urgency semantics
- operator control surface:
  inspect, pause, stop, and override flows for one live path
- audit and control plane:
  current live standing, operator actions, and durable intervention history

## PR Slicing Guidance

- the first implementation milestone should close:
  `raise one meaningful wake -> explain why it matters -> let the operator inspect the current
  situation`
- the next milestone may close:
  `pause and stop one live path decisively with audit visibility`
- the final milestone may close:
  `override behavior that remains operator-usable and auditable`
- do not ship wake surfaces that are noisy or explanation-poor
- do not blur this PRD back into per-action manual runtime or a broad operations platform
