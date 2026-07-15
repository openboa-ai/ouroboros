# ResearchControlStudy Design

**Status:** Approved under the standing CandidateArena Goal authority

## Goal

Turn multiple terminal `ResearchControlCampaignOutcome` records into one precommitted, replicated
test of whether `adaptive_default` allocation improves prospective qualified challenger discovery
rate over `static_control` under the same frozen research condition.

The study must prevent post-hoc campaign selection, count every planned replication, use a declared
paired inference rule, and preserve paper-only authority. It may make a scoped causal statement about
the studied stochastic repetitions. It may not automatically replace allocation policy, promote a
candidate, submit an order, or claim market-regime generalization.

## Why This Frontier

One `ResearchControlCampaignOutcome` deliberately fixes
`causal_conclusion = single_campaign_observation_only`. Its at-most-five paper slots per arm are too
small for a general policy claim. Now that the internal paper executor can produce exact terminal
slot outcomes, the next scientific boundary is replication under a rule committed before any
planned campaign effect.

Anthropic's Automated Weak-to-Strong Researcher is useful here as experimental pressure, not as
transferred proof: compare researcher conditions under equal budgets, repeat runs, keep process
diagnostics separate from held-out outcomes, and expose negative or reward-hacking evidence. For
Ouroboros the held-out outcome remains prospective paper qualified discovery, not preflight score,
admission count, entropy, or researcher self-evaluation.

## Approaches

### Aggregate whichever terminal campaigns are available

Rejected. Outcome-aware inclusion can select favorable runs, change sample size after inspecting
results, and manufacture apparent lift.

### Increase one campaign's tick count

Rejected. This increases within-run slots but does not create independent researcher repetitions.
It also widens the bounded campaign contract and leaves one baseline/run realization as the unit of
inference.

### Precommit exact campaign identities and paired inference

Selected. One append-only study fixes 6 to 30 deterministic campaign IDs, one exact baseline
snapshot digest, one research condition, and one exact analysis policy before any planned campaign
commits. The terminal study outcome consumes every exact campaign and campaign outcome.

## Canonical Vocabulary

`ResearchControlStudy` is the pre-effect replicated experiment commitment.

`ResearchControlStudyOutcome` is the append-only aggregate inference over every planned campaign.

`replication` means one complete `ResearchControlCampaign` with both adaptive and static arms. A
paper slot is not a replication.

## Study Condition

The study stores the exact condition that every planned campaign must match:

```ts
interface ResearchControlStudyCondition {
  source: ResearchControlCampaignSource;
  research_agent: ResearchControlCampaignAgentIdentity;
  paper_comparator: Extract<
    ResearchControlCampaignPaperComparator,
    { comparator_status: "trading_review" }
  >;
  paper_evaluation_protocol: Extract<
    ResearchControlCampaignPaperEvaluationProtocol,
    { protocol_status: "bound" }
  >;
  allocation_policy: CandidateArenaResearchAllocationPolicy;
  allocation_policy_digest: string;
  campaign_policy: ResearchControlCampaignPolicy;
  condition_digest: string;
}
```

Campaign identity, arm/tick IDs, baseline metadata, and clocks are excluded from the condition
digest. Source artifact closure, managed agent identity, comparator, paper protocol, allocation
policy, resource bounds, and reservation rule are included.

Version 1 uses `same_frozen_snapshot`: every replication must have the exact study baseline digest.
This isolates stochastic researcher/runtime variation and supports only same-baseline inference.
Distinct regimes or rolling baselines require a later stratified study protocol.

## Study Commitment

```ts
interface ResearchControlStudyReplication {
  replication_index: number;
  campaign_idempotency_key: string;
  campaign_ref: Ref;
  expected_baseline_snapshot_digest: string;
}

interface ResearchControlStudyAnalysisPolicy {
  policy_version: "paired_exact_sign_test_v1";
  primary_estimand:
    "mean_adaptive_minus_static_qualified_discovery_rate";
  significance_method: "two_sided_exact_sign_test";
  alpha: 0.05;
  minimum_non_tied_replication_count: 6;
  tie_policy: "exclude_from_sign_test_include_in_mean";
  minimum_mean_rate_difference: 0;
}

interface ResearchControlStudyRecord extends BaseRecord {
  record_kind: "research_control_study";
  research_control_study_id: string;
  idempotency_key: string;
  hypothesis:
    "adaptive_allocation_improves_replicated_qualified_discovery_yield";
  baseline_policy: "same_frozen_snapshot";
  baseline_snapshot_digest: string;
  condition: ResearchControlStudyCondition;
  replications: ResearchControlStudyReplication[];
  analysis_policy: ResearchControlStudyAnalysisPolicy;
  committed_at: string;
  study_digest: string;
  research_scheduling_authority: true;
  evaluation_authority: false;
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}
```

Replication indices are contiguous from 1. Campaign refs are deterministic from their unique
idempotency keys. Replication count is 6 to 30. Every expected baseline digest equals the study
baseline. Study identity and digest are deterministic and append-only.

LocalStore rejects a study when a planned campaign already exists. When a later planned campaign
is recorded, LocalStore requires study commit time before campaign commit time, exact baseline
digest, and an exact condition match. Unplanned campaigns remain valid but cannot be inserted into
the study.

## Outcome And Inference

The outcome consumes one exact campaign and one exact terminal campaign outcome for every planned
replication. It records only refs/digests and the already adjudicated adaptive-minus-static rate
difference.

```ts
interface ResearchControlStudyReplicationResult {
  replication_index: number;
  campaign_ref: Ref;
  campaign_digest: string;
  campaign_outcome_ref: Ref;
  campaign_outcome_digest: string;
  observed_rate_difference: number;
}
```

```ts
interface ResearchControlStudyOutcomeRecord extends BaseRecord {
  record_kind: "research_control_study_outcome";
  research_control_study_outcome_id: string;
  study_ref: Ref;
  study_digest: string;
  replication_results: ResearchControlStudyReplicationResult[];
  planned_replication_count: number;
  completed_replication_count: number;
  adaptive_positive_count: number;
  static_positive_count: number;
  tied_count: number;
  non_tied_count: number;
  mean_rate_difference: number;
  exact_sign_test_p_value: number;
  inference_status:
    | "adaptive_effect_supported"
    | "adaptive_effect_not_supported"
    | "insufficient_non_tied_replications";
  causal_scope: "same_baseline_stochastic_replication_only";
  policy_decision_eligibility:
    | "eligible_for_separate_policy_decision"
    | "not_eligible";
  next_action:
    | "review_research_allocation_policy"
    | "accumulate_or_redesign_precommitted_study";
  adjudicated_at: string;
  study_outcome_digest: string;
  evaluation_authority: "external_to_trading_systems";
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}
```

The aggregate records:

- planned and completed replication count;
- adaptive-positive, static-positive, and tied campaign counts;
- non-tied count;
- mean adaptive-minus-static rate difference, rounded to six decimals;
- a two-sided exact sign-test p-value over non-tied campaigns, rounded to six decimals;
- `adaptive_effect_supported`, `adaptive_effect_not_supported`, or
  `insufficient_non_tied_replications`;
- `same_baseline_stochastic_replication_only` as causal scope;
- `eligible_for_separate_policy_decision` only when the adaptive effect is supported.

For `n` non-tied campaigns and `k = min(adaptive_positive, static_positive)`, the two-sided p-value
is `min(1, 2 * sum(Binomial(n, 0.5), i=0..k))`. Ties remain in the planned denominator and mean but
are excluded from the sign test. `adaptive_effect_supported` requires all of:

1. at least six non-tied replications;
2. adaptive-positive count greater than static-positive count;
3. p-value at most `0.05`;
4. mean rate difference greater than `0`.

The outcome never stops early and cannot omit a planned loss, tie, ineligible campaign, or expired
paper slot. Six adaptive-positive and zero static-positive non-tied campaigns produce p = 0.03125;
this is the smallest all-positive version-1 supporting sample.

## Recovery And Failure

- Existing exact study or outcome replays byte-equivalently.
- Same-ID drift fails closed.
- Missing campaign or campaign outcome leaves the study nonterminal; it does not shrink the sample.
- Comparator, protocol, source, agent, policy, baseline, or campaign-ID drift invalidates the study
  outcome.
- A campaign committed before its study is ineligible and cannot be repaired by later writeback.
- Arithmetic, count, p-value, inference, or authority drift fails domain/store validation.

## Authority Boundary

- Researchers and TradingSystems never compute or supply study inference.
- Only externally adjudicated `ResearchControlCampaignOutcome` records enter the study.
- The study can authorize planned research campaign scheduling only.
- A supported effect is evidence for a separate research-policy decision, not automatic policy
  mutation.
- CandidateAdmission, TradingPromotion, TradingReview, Gateway, Ledger, private data, credentials,
  and live exchange authority remain unchanged.

## Testing

- strict domain shape/digest tests for study and outcome;
- deterministic ID and condition decision tests;
- LocalStore precommit, planned-campaign guard, append conflict, and reload tests;
- exact sign-test table tests, including ties, six all-positive, mixed signs, missing replication,
  condition drift, and result drift;
- application/store outcome replay tests;
- canonical docs, typechecks, repository guards, and full-suite evidence.

## Implemented Boundary

The strict study and outcome records, deterministic application decisions, StorePort contract, and
LocalStore precommit/source-graph guards are implemented. Focused study and campaign suites pass.
The command-sandbox full run has no study failures; its remaining failures require listener or
`tsx` IPC capabilities denied with `EPERM`.

The internal `createResearchControlStudyRuntime` composition now derives progress from exact
evidence, runs one planned campaign through terminal paper outcome per executor advance, and repeats
sequentially through adjudication. Follow-on frontiers now add an explicitly owned one-shot process
supervisor for committed studies and a separate exact-digest allocation-policy decision. Server
auto-start, cross-process leasing, actual prospective study evidence, and distinct-regime or
factorial studies remain later boundaries rather than extensions to this same-baseline record.

## Non-Goals

- Distinct-baseline, market-regime-stratified, or rolling-window inference.
- Directed/undirected, memory/no-memory, or agent/baseline factorial studies.
- Automatic allocation-policy replacement.
- Automatic TradingPromotion or champion handoff.
- Private exchange data or live execution.

## Acceptance

1. Study and exact campaign IDs exist before every planned campaign effect.
2. Every planned campaign matches one frozen baseline and condition.
3. Every planned campaign and terminal outcome is included exactly once.
4. Exact sign-test and mean calculations are deterministic and independently validated.
5. Six all-positive non-tied campaigns support the adaptive effect; underpowered or mixed evidence
   does not.
6. No study field carries raw paper scores, sealed evaluator data, policy mutation, promotion,
   order, private, or live authority.
7. Restart and replay create no duplicate study or outcome.
8. Focused tests, workspace typechecks, repository guards, and available full-suite checks pass.
