# ResearchGeneralization Read Model Design

Status: implemented and verified on 2026-07-13.

Implementation evidence: `f356bd2` adds the strict pure projection, `e3e6b1c` attaches it to the
shared CandidateArena operator state, and `86d7c5f` renders authority-safe CLI, TUI, and Web
readback. Verification passed 190 focused tests, all workspace typechecks, 184 full-suite files with
2,949 tests, and every required repository guard.

## Goal

Make prospective ResearchGeneralizationProtocol progress and terminal
ResearchGeneralizationOutcome evidence observable through the shared Operator contract without
granting policy, promotion, order, private, or live authority.

The implementation already commits, executes, reconstructs, and adjudicates the protocol graph.
Today that evidence is visible only through LocalStore records and an injected scheduler lifecycle
hook. A normal operator cannot tell whether no protocol exists, which condition blocks remain
unfilled, whether assigned studies are terminal, or what the latest conservative outcome concluded.

## Approaches Considered

### Shared CandidateArena projection

Add one required compact projection to `CandidateArenaReadModel`, build it once in the application
layer from exact store evidence, and render it in CLI, TUI, and Web Research. This preserves the
existing `GET /api/operator` and `arena.status` contract and keeps all user surfaces aligned.

This is the selected approach.

### Generalization evidence as FindingCluster or ResearchWorker input

This would close a feedback loop quickly, but it mixes allocation-policy inference with
TradingSystem strategy findings. It could exert scheduling or generation pressure before a
separate generalization-policy decision has been designed. It is excluded.

### Raw protocol/outcome resource routes

This would expose implementation records without answering the operator's compact progress and
authority questions. It would also force each surface to reconstruct semantics independently. It
is excluded.

## Taxonomy Decision

### Goal

Name a read-only projection of the existing ResearchGeneralizationProtocol and
ResearchGeneralizationOutcome nouns without creating another durable domain authority.

### Vocabulary Sources And Axes

The canonical nouns come from Ouroboros. Experimental-design terms provide `protocol`, `condition
block`, `planned`, `assigned`, `terminal`, and `outcome`. Product axes are lifecycle state,
progress, inference, next action, audience, and authority.

### Canonical Vocabulary

- `ResearchGeneralizationReadModel`: compact operator projection over protocol progress and latest
  outcome evidence.
- `research_generalization`: required `CandidateArenaReadModel` field.
- lifecycle states: `not_started`, `collecting`, `awaiting_outcome`, and `closed`.
- `condition_blocks`: canonical `long`, `short`, and `flat` progress rows.

No new persisted record or authority noun is coined. Existing protocol/outcome IDs and domain enum
values retain their official spelling. There are no aliases or migrations.

Do not extend `ResearchProgram`, `GeneralizationRun`, `PolicyPromotion`, or `RegimeResult`; each
either hides the existing record owner or implies authority the projection does not have.

`writeback_needed: true` because `OperatorReadModel` is a durable public/shared contract.

## Read Model Contract

`CandidateArenaReadModel.research_generalization` is always present:

```ts
interface ResearchGeneralizationReadModel {
  status: "not_started" | "collecting" | "awaiting_outcome" | "closed";
  protocol_count: number;
  outcome_count: number;
  active_protocol: ResearchGeneralizationActiveProtocolReadModel | null;
  latest_outcome: ResearchGeneralizationLatestOutcomeReadModel | null;
  authority_status: "not_promotion_authority";
}
```

The active protocol is the oldest protocol without an outcome, ordered by `committed_at` then
protocol ID. This matches automatic oldest-missing reconciliation. It exposes:

- protocol ID, commitment time, and collection deadline;
- planned, assigned, and terminal study counts;
- one canonical progress row for each `long`, `short`, and `flat` block;
- `collect_precommitted_studies`, `complete_assigned_studies`, or
  `await_outcome_reconciliation` as the deterministic next action;
- `research_only` authority.

An active protocol is `awaiting_outcome` only when every planned study has a terminal
ResearchControlStudyOutcome. Otherwise it is `collecting`. Wall-clock expiry is not inferred in a
read projection; the exact deadline is exposed and the outcome coordinator owns expiry closure.

The latest outcome is ordered by `adjudicated_at` then outcome ID descending. It exposes:

- outcome and protocol IDs;
- inference status and adjudication time;
- planned, completed, non-tied, tied, missing, and ineligible counts;
- distinct baseline count, equal-weight mean, exact sign-test p-value, and harmful blocks;
- policy-decision eligibility and next action exactly as sealed by the outcome;
- explicit false policy-replacement, promotion, order-submission, and live-exchange authority.

Raw kline windows, source artifacts, baseline digests, study IDs, campaign IDs, evaluator internals,
and per-slot effect details remain outside this compact projection.

## Projection And Validation

Create a focused pure application builder. It receives complete protocol, study, study-outcome, and
generalization-outcome arrays. It must:

1. reject duplicate protocol, study, study-outcome, or outcome identities;
2. reject outcome refs to absent protocols;
3. count a study only when its ID, protocol assignment, and slot identity match an exact planned
   slot;
4. count a terminal study only when one exact outcome references that assigned study;
5. reject studies or study outcomes that claim a protocol slot but cannot be reconciled exactly;
6. sort independently of store enumeration order;
7. clone arrays so consumers cannot mutate source evidence.

The builder throws `ResearchGeneralizationReadModelError` with stable code
`research_generalization_read_model_graph_invalid` for corrupt graph evidence. No partial or
optimistic summary is returned.

`buildCandidateArenaReadModel` loads these arrays through the store port and delegates to the pure
builder. Legacy partial test doubles without the new list methods receive the canonical empty
projection; production LocalStore implements the complete port.

## Surface Contract

### HTTP And Commands

`GET /api/operator` and `arena.status` expose the same required
`candidate_arena.research_generalization` projection. No new route or command is added.

### CLI

The status summary prints one compact line with status, protocol/outcome counts, active assigned
and terminal progress, latest inference, and research next action when present.

### TUI

The top Arena scan prints the same status and bounded progress. It remains read-only and carries no
new key binding.

### Web

The Research tab renders one un-nested, compact evidence section before FindingCluster and Research
signals. It shows lifecycle, progress, deadline, each condition block, latest inference/statistics,
next action, and authority. Empty state is explicit. The Arena and Trading first viewports do not
duplicate this research-policy evidence.

## Error Handling

- Missing protocol evidence returns `not_started`, not an error.
- Incomplete valid evidence returns `collecting` with exact counts.
- Complete terminal evidence without an outcome returns `awaiting_outcome`.
- Outcomes coexist with a newer active protocol: the projection shows both the oldest active
  protocol and latest closed outcome.
- Corrupt references, duplicates, or mismatched assignments fail the read path with the stable
  application error. Store corruption is never hidden by a zero-count projection.

## Authority Boundary

The projection is read-only evidence. It must not:

- mutate CandidateArenaResearchAllocation;
- enter ResearchWorker generation context;
- create or select a generalization-policy decision;
- change rank, qualification, Trading review, or TradingPromotion;
- submit an order or enable private/live exchange access.

`generalization_supported` remains an externally evaluated research inference that is merely
eligible for a separately designed policy decision.

## Verification

Acceptance requires:

- pure builder tests for empty, collecting, awaiting, closed supported, closed negative,
  simultaneous active/latest, unordered input, duplicate IDs, orphan refs, assignment mismatch,
  and immutable output;
- CandidateArena builder and Operator HTTP tests proving the required projection;
- CLI, TUI, and Web tests proving equivalent status, progress, next-action, and authority meaning;
- all workspace typechecks and the full repository validation suite;
- no changes to allocator, ResearchWorker prompt, commands, promotion, orders, or live authority.
