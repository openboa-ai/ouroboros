# PRD: Live Deployment And Autonomous Execution

This PRD is the canonical downstream contract for `Slice 3: Path Can Really Trade`.

It inherits the weak-supervision thesis from `01-problem-jtbd-and-value`, implements the third
trust moment from `02-journey-map`, maps directly to Slice 3 in
`03-story-map-and-release-slices`, respects the cutline in `04-scope-and-cutline`, supports the
judgment bars in `05-success-metrics-and-launch-bar`, and keeps only execution-detail uncertainty
allowed by `06-risks-and-open-questions`.

The trust question for this PRD is:

**`Can I actually let it trade?`**

## Problem

The root problem at this stage is not lack of approval surfaces and not lack of simulated success.

The problem is that a candidate can look legitimate and still fail to become a believable live
trading path.

Without a real live transition:

- the product remains a research artifact with a live wrapper
- the operator still has to manually relay or shadow routine trading behavior
- live approval remains emotionally fake because nothing durable changed after promotion
- the team mistakes technical connectivity for delegated operation

This PRD exists to make one promoted candidate become one genuinely live trading path that can
operate within explicit limits without requiring the operator to remain the routine executor.

## Why This Matters

This is the first visible proof that autokairos is a live operator system rather than a paper-only
decision tool.

It is the stage where the operator should feel:

- this candidate actually became a running live actor
- the system can execute routine behavior without waiting for me every time
- live behavior is bounded, not reckless
- what I approved is now operating in the real market, not merely represented in a status screen

Without this stage, trustworthy evaluation still does not become trustworthy delegation.

## User Trigger

The mostly manual serious solo operator has already approved one candidate for live and now expects
the system to deploy it into real trading without turning the operator into the constant manual
executor.

The operator is not asking for multi-strategy orchestration or broad venue coverage.

The operator is asking for one approved path to become one believable live path under explicit
limits.

## Desired Outcome

One promoted candidate is deployed into real live trading and operates autonomously within explicit
risk and policy limits.

By the end of this stage:

- one approved path is actually trading live
- routine live actions no longer require per-action operator participation
- live limits remain visible and meaningful
- live behavior remains distinct from backtesting, paper evaluation, and approval semantics
- the path now counts as a delegated live trading path rather than a ceremonial live presence

## In-Scope Behavior

- deploy one promoted candidate into real live operation
- execute that candidate on Binance BTC perpetual futures as the first market wedge
- enforce explicit risk and policy limits during routine live behavior
- keep live semantics distinct from backtesting, paper, evaluation, and gate semantics
- make it clear that the system can continue routine live actions without per-action operator
  approval
- preserve a visible venue-adapter seam so architecture can support future portability without
  broadening first-cut scope

## Out-Of-Scope Behavior

- multi-venue routing or multi-asset expansion
- portfolio coordination across many live strategies
- unlimited autonomy or hidden runtime privileges
- per-action approval loops after live promotion
- wake, inspect, pause, stop, or override behavior as the core subject of this contract
- generic live trading platform breadth beyond one believable delegated path

## What Must Feel Lovable

- after live approval, the candidate actually starts trading instead of stopping at a ceremonial
  handoff
- the operator no longer needs to manually relay routine trading actions
- explicit live limits feel real enough that autonomy becomes believable rather than reckless
- the product feels like a living trading system, not a paper artifact with exchange connectivity
- delegated live behavior feels like relief from manual burden, not disguised risk transfer

## Critical Constraints

- full autonomous execution remains bounded by explicit limits
- live operation is only for the first wedge:
  Binance BTC perpetual futures
- stage boundaries must remain explicit after promotion
- approved live behavior must stay traceable to the promoted candidate and its gate meaning
- routine live actions must not require hidden human labor
- adapter-friendly architecture must survive, but it must not delay first-venue proof depth
- live execution must remain governable rather than bypassing policy through privileged internal
  paths

## Failure Scenarios

- the candidate is marked live, but routine trading still depends on manual operator action
- the system reaches the exchange, but live behavior is so constrained or broken that the proof is
  only ceremonial
- explicit limits are vague, implicit, or not actually enforced
- live behavior drifts from what the operator approved at the gate
- venue coupling is so hard-coded that the first proof damages later portability
- hidden operator labor is still required to keep the live path functioning normally

## Acceptance Criteria

- one promoted candidate can be deployed into real live trading on Binance BTC perpetual futures
- the system can perform routine live trading actions for that candidate without per-action operator
  approval
- explicit risk and policy limits remain visible and are enforced during live operation
- the operator can tell that the candidate is genuinely live rather than paper-complete with a live
  wrapper
- live behavior remains tied to the approved candidate and does not silently exceed approved stage
  meaning
- the venue-adapter seam is preserved well enough to support future portability without expanding
  current scope

## Metrics / Proof

- at least one promoted path reaches real live trading on the first target venue
- routine live behavior no longer requires constant human relay or shadow execution
- live execution remains inside visible configured limits
- the live path produces meaningful live trading behavior rather than merely technical live
  presence
- the operator can explain what is live and why it is allowed without relying on private
  implementation knowledge

## Open Questions

- what first live risk envelope is strict enough to be trustworthy without collapsing the proof into
  ceremonial live presence?
- what minimum live telemetry is needed for the operator to believe the path is genuinely trading
  without turning PRD 3 into PRD 4?
- how much policy surface is needed before bounded autonomy feels real rather than ambiguous?

These questions are execution-detail questions only.

They must not reopen:

- first user
- first market
- lovable proof
- live gate placement
- autonomy posture

## Subsystem Impact Map

- trading substrate:
  live market, order, fill, position, account, and risk surfaces required for one real venue path
- live execution runtime:
  candidate-linked execution behavior that can continue routine actions within explicit limits
- stage and policy control plane:
  promoted-candidate identity, live posture, enforced limits, and venue-adapter boundary

## PR Slicing Guidance

- the first implementation milestone should close:
  `deploy one promoted candidate live -> enforce visible explicit limits -> let routine live
  actions continue without per-action operator approval`
- the next milestone may strengthen:
  `operator legibility that this path is genuinely live and bounded`
- do not ship exchange connectivity without proving that routine live behavior can actually continue
  under policy
- do not pull wake, pause, stop, or override deeply into this PRD if that blurs the Slice 3 and
  Slice 4 boundary
