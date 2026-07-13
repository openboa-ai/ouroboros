# ResearchAllocationPolicyDecision Design

**Status:** Implemented and locally verified under the standing CandidateArena Goal authority;
listener-capable full-suite verification remains environment-blocked

## Goal

Convert one externally adjudicated `ResearchControlStudyOutcome` into a separate, append-only
decision about whether the exact studied adaptive research allocation policy may be used as an
evidence-backed default for future uncontrolled CandidateArena ticks.

The decision must preserve causal scope, distinguish failure to support adaptive allocation from
evidence that static allocation is superior, and make future allocation provenance inspectable. It
must not change campaign controls, candidate qualification, TradingPromotion, orders, private data,
or live authority.

## Statistical Boundary

Version 1 tests the directional hypothesis that `adaptive_default` improves qualified discovery
yield over `static_control`. Therefore:

- `adaptive_effect_supported` may approve the exact adaptive policy digest;
- `adaptive_effect_not_supported` does not prove static superiority;
- `insufficient_non_tied_replications` does not prove equivalence;
- no version-1 result may select `static_control` as the repository default;
- same-baseline evidence cannot claim distinct-regime generalization.

This asymmetry is intentional. A future static-superiority, equivalence, non-inferiority, or
regime-stratified decision requires a separately precommitted study policy.

## Approaches

### Switch to static whenever adaptive is not significant

Rejected. Failure to reject the adaptive null is not evidence for static superiority and would turn
low power or ties into a policy change.

### Let the study outcome mutate the default directly

Rejected. It would collapse external evaluation and policy authority into one record, violating the
study outcome's explicit `policy_replacement_authority: false` contract.

### Append a separate digest-bound policy decision and persist allocation provenance

Selected. One deterministic decision consumes the exact study and study outcome, approves only the
studied adaptive policy digest when eligible, and remains `not_approved` otherwise. Future default
allocations may cite only an approved decision whose digest and current policy digest still match.

## Canonical Vocabulary

`ResearchAllocationPolicyDecision` is the separate research-only policy selection record.

`CandidateArenaResearchAllocationPolicyBasis` explains why one tick used its allocation mode:
explicit caller request, repository default, or an approved research allocation policy decision.

## Decision Contract

```ts
interface ResearchAllocationPolicyDecisionPolicy {
  policy_version: "adaptive_supported_effect_v1";
  target_allocation_mode: "adaptive_default";
  required_inference_status: "adaptive_effect_supported";
  required_causal_scope: "same_baseline_stochastic_replication_only";
  required_policy_decision_eligibility:
    "eligible_for_separate_policy_decision";
  application_scope: "future_uncontrolled_candidate_arena_ticks";
}

interface ResearchAllocationPolicyDecisionRecord extends BaseRecord {
  record_kind: "research_allocation_policy_decision";
  research_allocation_policy_decision_id: string;
  study_ref: Ref;
  study_digest: string;
  study_outcome_ref: Ref;
  study_outcome_digest: string;
  target_allocation_policy_digest: string;
  decision_policy: ResearchAllocationPolicyDecisionPolicy;
  decision_status: "approved" | "not_approved";
  decision_reason:
    | "supported_same_baseline_adaptive_effect"
    | "study_outcome_not_eligible";
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

The ID is deterministic from the study outcome ID. `target_allocation_policy_digest` must equal the
study condition's allocation policy digest. Approval requires the exact supported inference,
eligibility, causal scope, positive mean, alpha-compliant p-value, and adaptive-positive majority
already validated by the study outcome. Every other valid outcome records `not_approved` and a null
effective mode.

The decision carries research scheduling authority only. It does not inherit evaluation authority
and does not alter the study or outcome.

## Allocation Policy Basis

Every new `CandidateArenaResearchAllocation` stores exactly one basis:

```ts
type CandidateArenaResearchAllocationPolicyBasis =
  | { basis_kind: "explicit_request" }
  | { basis_kind: "repository_default" }
  | {
      basis_kind: "research_allocation_policy_decision";
      policy_decision_ref: Ref;
      policy_decision_digest: string;
      study_outcome_ref: Ref;
      study_outcome_digest: string;
    };
```

Rules:

- `directions` and explicit `researchAllocationMode` inputs use `explicit_request`;
- an uncontrolled tick with no applicable approved decision uses `repository_default` and the
  existing `adaptive_default` compatibility behavior;
- an uncontrolled tick may use `research_allocation_policy_decision` only when the latest approved
  decision targets `adaptive_default`, its target policy digest equals the current
  `CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY` digest, and all decision/outcome refs and digests
  reload exactly;
- campaign arms always pass explicit adaptive/static modes and never consume a default decision;
- `explicit` direction lists cannot cite a policy decision;
- the basis enters the allocation digest and read model.

The compatibility fallback remains adaptive because this frontier records evidence provenance; it
does not reinterpret prior product behavior as a permission gate. An approved decision changes the
basis from repository default to evidence-backed policy decision, not the algorithm bytes.

## Application Flow

1. `ResearchAllocationPolicyDecisionService.decide` reloads the exact study and outcome.
2. The pure decision derives status, reason, target digest, authority, ID, and digest.
3. LocalStore independently validates study/outcome graph, statistics, identity, digest, and
   append-only replay.
4. Before an uncontrolled Arena tick, the allocation resolver loads the newest approved decision
   matching the current policy digest.
5. `CandidateArenaResearchAllocationService` records the resolved mode and exact basis before worker
   effects.
6. LocalStore independently reloads and verifies any decision-backed basis before accepting the
   allocation.

## Ordering And Recovery

- The policy decision must be after study adjudication.
- An allocation citing the decision must be after the decision time.
- Same-ID replay is byte-equivalent; drift conflicts.
- A missing, malformed, stale-digest, not-approved, or policy-digest-mismatched decision falls back
  to repository default before allocation. A caller-supplied forged decision basis is rejected at
  persistence.
- Existing historical allocations are not rewritten. This schema change is repository-local and
  pre-release, so fixtures and current records migrate directly without compatibility aliases.

## Authority Boundary

- The decision may select one research allocation default only.
- It cannot alter per-tick findings, scores, candidate ranking, admission, paper qualification, or
  promotion.
- It cannot submit an `OrderRequest`, access private exchange state, credentials, or live execution.
- TradingSystems and ResearchWorkers cannot create, choose, or self-score the decision.
- Study execution does not automatically invoke policy decision creation; it remains a separate
  service action.

## Testing

- strict domain shape/digest and authority tests;
- exact approved/not-approved inference table;
- application graph, replay, persistence-conflict, and time-order tests;
- LocalStore missing/substituted/corrupt study-outcome validation;
- allocation basis exact-shape and mode compatibility tests;
- resolver tests for explicit precedence, approved exact digest, stale digest, not-approved, and
  repository fallback;
- Arena tick tests proving decision-backed default provenance and campaign explicit isolation;
- focused allocation/study/campaign tests, workspace typechecks, guards, and available full suite.

## Non-Goals

- Static-superiority, equivalence, or non-inferiority decisions.
- Automatic decision creation at study completion.
- Policy parameter tuning or a learned bandit.
- Distinct-regime generalization.
- Public operator commands or default process discovery.
- Candidate promotion, private exchange data, or live execution.

## Acceptance

1. Only an exact eligible supported study outcome approves the studied adaptive policy digest.
2. Non-supported or underpowered outcomes never select static control.
3. Decision and allocation provenance are append-only, deterministic, and independently validated.
4. Explicit directions and campaign modes cannot be overridden by a default decision.
5. A stale or different policy digest cannot borrow prior study support.
6. Future uncontrolled allocations can cite the exact approved decision and study outcome.
7. Historical allocations are migrated directly and no compatibility alias is added.
8. No policy field grants evaluation, promotion, order, private, credential, or live authority.
