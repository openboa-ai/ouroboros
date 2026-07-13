# ResearchGeneralizationPolicyDecision Design

Status: approved for autonomous implementation under the active CandidateArena goal.

## Goal

Close the current prospective generalization outcome's explicit next-action boundary without
conflating same-baseline evidence, negative evidence, or operator readback with research-policy
authority.

An exact eligible `generalization_supported` outcome may approve only the already precommitted
`CandidateArenaResearchAllocationPolicy` digest for future uncontrolled CandidateArena ticks. Every
terminal outcome receives a decision, including unsupported and insufficient outcomes. The
decision cannot generate policy parameters, infer static superiority, promote a TradingSystem,
submit an order, or gain private/live authority.

## Why This Frontier

`ResearchGeneralizationOutcome.next_action` currently points to
`review_broad_research_allocation_policy`, but no owner can consume it. The existing
`ResearchAllocationPolicyDecision` is intentionally limited to one same-baseline stochastic study.
Reusing it would erase the stronger cross-baseline, condition-blocked causal scope.

The new decision creates a strict bridge:

```text
ResearchGeneralizationProtocol
-> ResearchGeneralizationOutcome
-> ResearchGeneralizationPolicyDecision
-> future uncontrolled CandidateArenaResearchAllocation provenance
```

This strengthens the external-Evaluation-to-next-generation loop. It remains only one prerequisite
for learned allocation: version 1 can approve the exact frozen policy, but it does not search for
or synthesize new parameters and therefore does not complete the Adaptive allocation goal axis.

## Approaches Considered

### Extend ResearchAllocationPolicyDecision

Rejected. One record family would then represent both same-baseline replication and prospective
cross-condition generalization. Its approval reason and source graph would no longer communicate
what was actually proven.

### Select static control from a non-supported outcome

Rejected. `generalization_not_supported` includes non-significance, ties, harmful blocks, and
mixed evidence. Failure to support adaptive allocation is not precommitted proof that static
allocation is superior. Version 1 records `not_approved` with no effective mode.

### Approve an exact precommitted policy in a separate record

Selected. The decision revalidates the entire protocol/outcome graph, approves only the exact
target policy digest, is created for every outcome oldest-first, and can be selected by later
uncontrolled allocations without weakening explicit requests.

## Taxonomy Decision

The canonical noun is `ResearchGeneralizationPolicyDecision`.

It is an append-only research-policy selection record derived from one exact
`ResearchGeneralizationProtocol` and `ResearchGeneralizationOutcome`. It is not an Evaluation,
Finding, promotion, Trading review, or live policy. `writeback_needed: true` because it adds a
persisted schema, store port, allocation provenance variant, shared read model, and scheduler
lifecycle state.

Do not call it `GeneralizationPromotion`, `LearnedPolicy`, `RegimeWinner`, or
`ResearchAllocationPolicyDecisionV2`. Those names either imply unsupported authority or hide the
distinct causal source.

## Persisted Contract

Add this version-1 record:

```ts
interface ResearchGeneralizationPolicyDecisionPolicy {
  policy_version: "generalization_supported_adaptive_v1";
  target_allocation_mode: "adaptive_default";
  required_inference_status: "generalization_supported";
  required_causal_scope:
    "pre_effect_market_condition_blocked_cross_baseline_study_effects";
  required_policy_decision_eligibility:
    "eligible_for_separate_generalization_policy_decision";
  application_scope: "future_uncontrolled_candidate_arena_ticks";
}

interface ResearchGeneralizationPolicyDecisionRecord extends BaseRecord {
  record_kind: "research_generalization_policy_decision";
  version: 1;
  research_generalization_policy_decision_id: string;
  protocol_ref: Ref;
  protocol_digest: string;
  generalization_outcome_ref: Ref;
  generalization_outcome_digest: string;
  target_allocation_policy_digest: string;
  decision_policy: ResearchGeneralizationPolicyDecisionPolicy;
  decision_status: "approved" | "not_approved";
  decision_reason:
    | "supported_cross_condition_adaptive_effect"
    | "generalization_outcome_not_eligible";
  effective_default_mode: "adaptive_default" | null;
  decided_at: string;
  policy_decision_digest: string;
  research_policy_selection_authority: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_policy_only";
}
```

The ID is deterministic from the generalization outcome ID. `decided_at` must be strictly later
than `adjudicated_at`. The digest excludes record kind, version, deterministic ID, and itself,
matching other append-only research decisions.

## Approval Rule

Approval requires all of the following to be true after exact source-graph validation:

- protocol and outcome runtime shapes and canonical digests are valid;
- the outcome deterministically belongs to the protocol and binds its exact target policy digest;
- inference is `generalization_supported` with the exact prospective causal scope and eligibility;
- all six slots are completed and non-tied, with no missing or ineligible studies;
- distinct baselines meet the frozen minimum;
- the exact sign-test p-value meets the frozen alpha;
- the equal-weight mean is strictly positive;
- every canonical block is complete-positive and no harmful block exists.

Anything else is `not_approved/generalization_outcome_not_eligible` with no effective default mode.
The decision preserves negative and insufficient evidence; it does not convert it into a static
policy decision.

## Service, Persistence, And Coordination

The pure decision function receives protocol, outcome, and decision time. The application service
reloads both source records, handles deterministic retry, publishes create-only, and accepts only
an exact same-root winner. LocalStore independently rederives identity, digest, source graph,
approval status, reason, effective mode, and temporal ordering before append-only publication.

The coordinator loads complete protocol, outcome, and decision collections. It rejects duplicate
identities, duplicate outcome refs, absent refs, and drifted existing decisions. Outcomes are
ordered by `adjudicated_at` then ID ascending; each call creates at most the oldest missing decision.
If the injected clock equals outcome adjudication it advances exactly one millisecond. Clock
regression and overflow fail closed.

## Allocation Integration

Add a distinct `CandidateArenaResearchAllocationPolicyBasis` variant:

```ts
{
  basis_kind: "research_generalization_policy_decision";
  policy_decision_ref: Ref;
  policy_decision_digest: string;
  generalization_outcome_ref: Ref;
  generalization_outcome_digest: string;
}
```

Resolution order is:

1. explicit directions;
2. explicit allocation mode;
3. latest applicable approved ResearchGeneralizationPolicyDecision;
4. latest applicable approved same-baseline ResearchAllocationPolicyDecision;
5. repository adaptive default.

An applicable decision must have a valid canonical digest, `approved`, effective
`adaptive_default`, and the current repository policy digest. Broad approval outranks a later
same-baseline approval because its causal scope is stronger. LocalStore revalidates the exact
decision and outcome linkage plus `decided_at < allocated_at`; forged, stale, or time-inverted
allocation provenance fails closed.

Explicit directions and modes never consult or inherit the decision. Version 1 does not change the
policy parameters or selection algorithm; it changes which externally supported authority basis
the uncontrolled tick can claim.

## Scheduler Ordering

After a successful `caught_up` supervisor cycle, the default scheduler runs:

1. oldest-missing ResearchGeneralizationOutcome reconciliation;
2. oldest-missing ResearchGeneralizationPolicyDecision reconciliation;
3. existing oldest-missing same-baseline ResearchAllocationPolicyDecision reconciliation.

No reconciliation occurs after contention, failure, stop, or invalid supervisor state. Scheduler
status retains compact last-result evidence for all three coordinators.

## Shared Readback

Extend required `ResearchGeneralizationReadModel` with
`latest_policy_decision: ResearchGeneralizationLatestPolicyDecisionReadModel | null`. It exposes
only decision/protocol/outcome IDs, status, reason, effective mode, decision time, explicit false
downstream authorities, and `research_policy_only` status. It excludes digests and source slot
detail.

CLI and TUI append compact decision status to the existing Arena scan. Web Research renders the
latest policy decision after the latest outcome. There are no new controls, routes, commands, or
key bindings.

## Error Handling

- Missing protocols, outcomes, or decisions remain valid empty/up-to-date states.
- Existing exact decisions are idempotent.
- Source mismatch fails with a stable generalization-policy graph error.
- A deterministic-ID conflict fails; no alternate ID or last-write-wins path exists.
- Publication races accept only the exact winner reconstructed with the winner timestamp.
- Corrupt decision evidence fails the operator read path; it never disappears as a null decision.

## Authority And Non-Goals

The frontier must not:

- modify explicit allocation intent;
- infer or select static superiority from negative or insufficient evidence;
- generate or tune allocation-policy parameters;
- enter ResearchWorker strategy context as a Finding;
- change candidate rank, admission, qualification, Trading review, or TradingPromotion;
- start or stop a paper runner;
- submit orders, read private exchange state, or enable live authority;
- create a public command or automatic TradingPromotion.

Real-market completion, learned policy parameter generation, multi-host fencing, automatic
promotion, champion runner handoff, and longitudinal deployed soak remain separate frontiers.

## Acceptance

The frontier is complete only when tests prove:

1. exact supported evidence approves; negative and insufficient evidence deterministically do not;
2. malformed graph, digest, time, criteria, and authority variants fail;
3. service retry and create-only races preserve one exact winner;
4. LocalStore independently rejects forged decision and allocation provenance;
5. coordinator ordering is outcome-complete, oldest-first, bounded to one, and fail-closed;
6. resolver precedence preserves explicit intent and prefers valid broad approval over same-baseline
   approval;
7. scheduler/server composition runs the new coordinator only after successful generalization
   outcome reconciliation;
8. CLI, TUI, Web, HTTP, and command readback show the same authority-closed latest decision;
9. focused tests, all workspace typechecks, the full suite, and every repository guard pass;
10. no allocator scoring, ResearchWorker context, rank, promotion, order, private, or live path
    changes outside the exact provenance selection described above.
