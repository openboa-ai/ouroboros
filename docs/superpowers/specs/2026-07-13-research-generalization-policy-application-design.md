# ResearchGeneralization Policy Application Design

Status: approved for autonomous implementation under the active CandidateArena goal.

## Goal

Make the completed prospective research loop causally observable from the exact persisted graph:

```text
ResearchGeneralizationProtocol
-> six terminal condition-blocked ResearchControlStudies
-> ResearchGeneralizationOutcome
-> ResearchGeneralizationPolicyDecision
-> CandidateArenaResearchAllocation
-> completed CandidateArenaTick
```

The operator must be able to distinguish the chronologically latest decision from the approved
decision that the allocation resolver would currently select. It must also be possible to tell
whether that effective decision is still awaiting allocation, has only pre-effect allocation
intent, or has been consumed by a completed CandidateArena tick.

This frontier adds evidence and a compositional proof. It does not generate policy parameters,
claim real-market generalization, create a tick, promote a TradingSystem, or add order/private/live
authority.

## Current Gap

`ResearchGeneralizationReadModel.latest_policy_decision` reports the newest decision regardless of
status. The resolver correctly chooses the newest applicable approved decision. Therefore, a newer
`not_approved` decision can coexist with an older approved decision that still governs future
uncontrolled allocations, while the operator sees only the non-approved record.

The allocation already seals decision and outcome provenance, and a completed tick already seals
the allocation ref and digest. Those records are sufficient to prove application, but no shared
projection joins them. Component tests prove each edge independently; no single integration test
currently closes the complete graph and its negative control.

## Approaches Considered

### Treat the latest decision as effective

Rejected. Chronological recency and applicability are different. A valid newer negative decision
does not revoke an older approved decision under the current resolver contract.

### Persist a new policy-application record

Rejected. `CandidateArenaResearchAllocation` is already the append-only pre-effect application
record, and `CandidateArenaTick` is already the terminal consumption witness. A second record would
duplicate authority and introduce reconciliation races without new facts.

### Project the effective decision and existing application graph

Selected. Reuse the resolver's exact selector, validate allocation/tick linkage in the read-model
builder, and expose only compact application evidence.

## Taxonomy Decision

No new persisted canonical noun is introduced.

- `effective_policy_decision` is a read-model field for the exact approved
  `ResearchGeneralizationPolicyDecision` currently selected by the uncontrolled-allocation
  resolver.
- `ResearchGeneralizationPolicyApplicationReadModel` is a compact projection over existing
  `CandidateArenaResearchAllocation` and completed `CandidateArenaTick` records.
- `application_status` is `awaiting_allocation`, `allocated`, or `completed_tick`.

Do not call this `PolicyPromotion`, `LearnedPolicy`, `Deployment`, `RegimeWinner`, or
`GeneralizationSuccess`. The projection proves use of one fixed research policy, not economic
quality or transfer to real markets.

`writeback_needed: true` because the required shared operator contract changes.

## Shared Selector

Extract the generalization-decision selection rule from
`resolveCandidateArenaResearchAllocationPolicy` into one pure exported application helper. Both the
resolver and read-model builder must use it.

An applicable decision must:

- pass the exact runtime-shape and canonical decision-digest checks;
- be `approved/supported_cross_condition_adaptive_effect`;
- have effective mode `adaptive_default`;
- target the current repository allocation-policy digest;
- be ordered by `decided_at`, then deterministic decision ID.

The latest applicable decision wins. A newer `not_approved`, stale, malformed, or wrong-policy
decision does not replace it. The helper selects research policy only; it grants no new authority.

## Read-Model Contract

Extend required `ResearchGeneralizationReadModel` with:

```ts
effective_policy_decision: {
  research_generalization_policy_decision_id: string;
  research_generalization_protocol_id: string;
  research_generalization_outcome_id: string;
  effective_default_mode: "adaptive_default";
  decided_at: string;
  application: {
    application_status:
      | "awaiting_allocation"
      | "allocated"
      | "completed_tick";
    allocation_count: number;
    completed_tick_count: number;
    latest_allocation: {
      candidate_arena_research_allocation_id: string;
      tick_id: string;
      allocated_at: string;
      completed_at: string | null;
    } | null;
  };
  research_policy_selection_authority: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_policy_only";
} | null;
```

`latest_policy_decision` remains chronological history. `effective_policy_decision` is the current
resolver selection and may reference an older approved decision.

## Application Graph

The builder receives complete generalization records, all
`CandidateArenaResearchAllocationRecord`s, and all `CandidateArenaTickRecord`s.

For every allocation whose basis kind is `research_generalization_policy_decision`, it must verify:

- the decision exists and is approved/applicable;
- decision ref/digest and outcome ref/digest match exactly;
- allocation mode is `adaptive_default`;
- allocation policy equals the current repository policy;
- decision time is strictly before allocation time;
- allocation runtime shape and canonical digest are valid.

For every tick that references one of those allocations, it must verify exact allocation ref/digest,
matching tick ID, completed status, and `allocated_at <= started_at <= completed_at`. A corrupt or
orphan application edge fails with the existing stable
`research_generalization_read_model_graph_invalid` error; it is never omitted.

Application status for the current effective decision is:

- `awaiting_allocation` when no allocation cites it;
- `allocated` when at least one allocation cites it but none has a valid completed tick;
- `completed_tick` when at least one exact completed tick consumes it.

Counts include every exact allocation and completed tick for that decision. `latest_allocation` is
ordered by allocation time then ID descending and includes `completed_at` only when its exact tick
has closed. Explicit requests and allocations citing other decisions do not count.

## CandidateArena Composition

`buildCandidateArenaReadModel` already loads tick and allocation records. Reuse those arrays when
building research generalization instead of issuing duplicate store reads. Preserve the all-absent
legacy test-double behavior; partial generalization method availability still fails closed.

No scheduler, command, route, provider, runner, promotion, or trading behavior changes.

## Operator Surfaces

- CLI and TUI retain latest decision status/mode and append effective mode, application status,
  allocation count, and completed-tick count.
- Web Research renders an `Effective policy application` block after `Latest policy decision`.
- A newer non-approved latest decision and an older effective approved decision must both be
  visible without implying contradiction.
- No control, key binding, command, raw digest, study ID, campaign ID, strategy context, rank, or
  promotion language is added.

## Compositional Closure Proof

Add one application integration test that uses production decision functions and services over one
restart-stable test store to compose:

1. a precommitted protocol;
2. two long, two short, and two flat assigned studies with at least three baselines;
3. six eligible non-tied terminal study outcomes;
4. a supported generalization outcome;
5. an approved policy decision;
6. resolver-selected broad allocation provenance;
7. a completed tick consuming that allocation;
8. the final effective/application projection after service reconstruction.

The negative control changes one precommitted block to non-positive, records
`generalization_not_supported/not_approved`, proves no static selection, and proves repository or a
previous approved fallback remains effective. Deterministic fixture evidence must be labeled as a
contract proof, not real-market generalization.

## Authority And Non-Goals

The frontier must not:

- create, mutate, or tune allocation policy;
- revoke an older approved decision from a newer negative result;
- make an allocation count as completed without an exact terminal tick;
- feed application state into ResearchWorker prompts or direction scoring;
- change candidate rank, admission, qualification, Trading review, or TradingPromotion;
- start or stop any runner;
- submit orders, read private exchange data, or enable live authority;
- claim real-market, profitability, or cross-regime success from deterministic fixtures.

## Acceptance

The frontier is complete only when tests prove:

1. resolver and read model share one exact effective-decision selector;
2. latest and effective decisions remain distinct when a newer negative decision exists;
3. awaiting, allocated, and completed-tick states are deterministic and restart-stable;
4. corrupt decision/allocation/tick refs, digests, modes, policies, identities, and times fail;
5. the supported six-study closure selects broad provenance and reaches completed-tick evidence;
6. a harmful-block negative control cannot select static or fabricate application;
7. CandidateArena, HTTP, CLI, TUI, and Web expose the same compact authority-closed evidence;
8. all focused tests, workspace typechecks, full suite, and repository guards pass;
9. no scoring, worker context, rank, promotion, runner, order, private, or live path changes.
