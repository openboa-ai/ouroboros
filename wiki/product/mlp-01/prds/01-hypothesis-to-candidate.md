# PRD: Hypothesis To Candidate

This PRD is the canonical downstream contract for `Slice 1: Path Becomes Real`.

It inherits the weak-supervision thesis from `01-problem-jtbd-and-value`, implements the first
trust moment from `02-journey-map`, maps directly to Slice 1 in
`03-story-map-and-release-slices`, respects the cutline in `04-scope-and-cutline`, does not claim
the success bars owned by `05-success-metrics-and-launch-bar`, and keeps only execution-detail
uncertainty allowed by `06-risks-and-open-questions`.

The trust question for this PRD is:

**`Is this path real?`**

## Problem

The root problem at this stage is not lack of ideas.

The problem is that agent output stays transient unless the product turns it into a durable
candidate.

Without that transition:

- the path remains trapped in chat output, session state, notes, or operator memory
- the operator stays the hidden runtime and system of record
- stronger search remains unusable because nothing real exists to hand off into evaluation

This PRD exists to make one surfaced path become one governed object that the operator no longer
has to carry manually.

## Why This Matters

This is the first visible proof that autokairos is not idea spam, commentary, or disposable agent
output.

It is the first moment where the operator should feel:

- this path is serious enough to follow
- the system now owns the record of that path
- later evaluation can start without manual restatement or reconstruction

Without durable candidate creation, stronger search cannot progress into trustworthy delegation.

## User Trigger

The mostly manual serious solo operator wants the system to surface one serious path without
requiring the operator to hand-author the starting point.

The operator is not asking for broad brainstorming.

The operator is asking for one candidate-worthy path to appear in product form so it can move
forward without depending on tabs, chat history, or private notes.

## Desired Outcome

One agent-originated path becomes one durable, inspectable candidate with enough structure to enter
later evaluation without manual rewriting.

By the end of this stage:

- the path is real inside the product
- the operator can inspect what it is and why it exists
- the path is ready for later evaluation handoff
- the candidate is still not being presented as legitimate, promoted, or live-ready

## In-Scope Behavior

- one serious agent-originated path appears instead of disposable idea spam
- the surfaced path is materialized as one durable candidate object
- the operator can inspect the candidate's origin, rationale, and current status
- the candidate is clearly distinct from chat history, runtime/session state, or transient messages
- the candidate carries enough structured information to support later evaluation handoff
- the first wedge stays explicit as scoped behavior:
  Binance BTC perpetual futures is the first market context for this candidate path

## Out-Of-Scope Behavior

- counted versus non-counted evidence
- legitimacy judgment beyond candidate creation
- hold or reject evaluation outcomes
- live gate meaning or promotion readiness
- live deployment or autonomous execution
- multi-venue or multi-asset expansion
- broad ranking or idea-funnel optimization beyond what is needed to surface one clear path

## What Must Feel Lovable

- the surfaced path feels serious rather than generic
- the operator immediately feels:
  "this is now real"
- candidate creation feels like system ownership rather than admin work
- the operator no longer has to remember, restate, or reconstruct the path manually

## Critical Constraints

- hypothesis origin remains agent-originated only
- candidate creation must not imply legitimacy, promotion, or live readiness
- durable truth must survive beyond transient runtime context
- first-market specificity supports the wedge but does not redefine the product-level contract
- architecture may preserve adapter-friendly seams, but this PRD must not broaden first-cut scope

## Failure Scenarios

- the agent produces idea spam with no serious threshold
- the candidate is too vague to evaluate later
- the operator cannot tell why the path appeared
- the operator must manually rewrite or restate the hypothesis before it can continue
- the candidate exists only as session output, message text, or notebook residue
- candidate creation is mistaken for evaluation success, promotion, or live approval
- hidden human labor is still required to preserve the path's meaning and record

## Acceptance Criteria

- one surfaced path becomes one durable candidate
- the operator can inspect what the path is, where it came from, and why it exists
- the operator can tell that the candidate is now a real tracked object inside the system
- the candidate can move into later evaluation without reauthoring the path from scratch
- the candidate is not confused with counted evidence, promotion, or live approval
- the operator is no longer the sole keeper of the path's meaning and record

## Metrics / Proof

- at least one operator-visible candidate is created from an agent-originated path without manual
  rewriting
- the operator can explain the path and its provenance from the product surface alone
- candidate creation reduces out-of-band manual glue such as private notes, memory, or chat-history
  reconstruction
- evaluation handoff does not depend on transient runtime state or private human notes

## Open Questions

- what is the minimum candidate payload shape needed to support later evaluation quality without
  over-designing Slice 1?
- how much initial ranking is actually needed before path spam becomes a real problem for the
  chosen operator?

These questions are execution-detail questions only.

They must not reopen:

- first user
- first market
- lovable proof
- live gate placement
- autonomy posture

## Subsystem Impact Map

- agent origination:
  hypothesis generation must produce one serious path with visible provenance and rationale
- durable candidate and provenance control plane:
  the system must materialize and retain one candidate as a real tracked object
- evaluation handoff boundary:
  the candidate must carry enough structure to move into later evaluation without redefining Slice 2
  behavior early

## PR Slicing Guidance

- the first implementation milestone should close:
  `surface one serious path -> materialize one durable candidate -> let the operator inspect it`
- later PRs may improve hypothesis quality, presentation quality, or ranking only after this proof
  exists
- do not split path appearance and durable candidate materialization into separate user-invisible
  milestones unless absolutely necessary
