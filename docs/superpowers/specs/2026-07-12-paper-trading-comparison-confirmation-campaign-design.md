# Paper Trading Comparison Confirmation Campaign Design

**Date:** 2026-07-12
**Status:** Approved by standing Goal authority; implementation not started
**Depends on:** Repository-verified sealed `PaperTradingComparisonVerdict`

## Goal

Confirm that one challenger improvement reproduces across a fixed number of new prospective paper
windows without choosing windows after their results are known. The campaign must be committed
after one source `challenger_improved` verdict but before any campaign-bound market tick, reserve
every future window deterministically, count every reserved outcome, enforce strict non-overlap and
bounded start delay, and produce no private or live authority.

The source verdict is a reason to start a campaign, not one of its confirmation results. A campaign
therefore cannot retroactively promote a favorable historical sequence.

## Scientific-Control Decision

Use one append-only campaign commitment with deterministic sequential slots. Each slot fixes the
future comparison idempotency key, preparation ID, and comparison commitment ID. All slots bind the
same exact candidate versions, SystemCode artifacts, admission evidence, champion selection,
comparison policy, market-data configuration, and paper policy as the source verdict's comparison.

The v1 campaign reserves exactly
`source_comparison.comparison_policy.required_confirmation_count` new windows and uses
`all_reserved_windows_must_improve`. Every slot must end in `challenger_improved`; a
`challenger_not_improved`, `comparison_ineligible`, or expired slot makes the campaign
`not_confirmed`. A negative result does not permit score-aware early stopping: later reserved slots
still run unless an operational start deadline expires the campaign.

The maximum first-tick delay for each slot is frozen to the source comparison's
`maximum_elapsed_ms`. Slot 1 must start after campaign commitment and within that delay. Slot N must
start strictly after both the prior verdict's `window_ended_at` and `evaluated_at`, and within the
same delay after the prior verdict's `evaluated_at`. This is not a claim of statistical significance,
but it prevents indefinite regime waiting and overlapping reuse of market evidence.

## Approaches Rejected

### Post-hoc verdict accumulation

Counting favorable existing verdicts is rejected because the system can inspect each outcome before
deciding whether it belongs to confirmation.

### Precreate all comparison graphs

Creating every comparison, TradingRun, commitment, and evaluation before the first outcome would
make attachment explicit but conflicts with the one-active-pair invariant and allocates dormant
runtime graphs that cannot execute concurrently. Deterministic slots provide the same
precommitment without that operational waste.

### Success-count threshold with extra optional windows

Reserving more windows than required and stopping after enough successes creates optionality and
multiple-testing ambiguity. V1 reserves exactly the required count and requires every slot to
improve. A later statistically designed protocol may add a larger fixed sample and explicit
decision rule as a new schema version.

## Taxonomy Decision

### Canonical vocabulary

- `PaperTradingComparisonConfirmationCampaign`: append-only precommitment for all new confirmation
  windows associated with one source improved verdict.
- `PaperTradingComparisonConfirmationSlot`: one deterministic future comparison identity inside the
  campaign; it is nested commitment data, not a mutable lifecycle record.
- `PaperTradingComparisonConfirmationCampaignOutcome`: append-only external aggregate decision over
  every reserved slot.
- `PaperTradingComparisonConfirmationCampaignService`: application service that precommits and
  settles campaigns.
- `PaperTradingComparisonConfirmationWindowService`: application service that materializes only the
  next exact reserved comparison through the existing comparison coordinator.

`PaperTradingComparisonVerdict` remains the one-window decision. Do not call the campaign outcome a
verdict, winner, promotion, or statistical proof. No alias or migration is needed because these are
new internal record families.

## Deterministic Comparison Identity

Move the existing comparison idempotency-key-to-ID derivation into a domain-owned pure helper so the
campaign, coordinator, and Store use one rule:

```ts
interface PaperTradingComparisonIds {
  preparation_id: string;
  comparison_commitment_id: string;
}

paperTradingComparisonIdsForIdempotencyKey(
  idempotencyKey: string
): PaperTradingComparisonIds;
```

Each slot idempotency key is canonical and derived from campaign identity and one-based index:

```text
paper-comparison-confirmation:<campaign-id>:slot:<index>
```

The campaign persists both the key and its derived IDs. Changed derivation, duplicate IDs, skipped
indices, reordered slots, or a slot count different from the frozen required confirmation count is
invalid.

## Campaign Commitment

```ts
interface PaperTradingComparisonConfirmationSlot {
  slot_index: number;
  comparison_idempotency_key: string;
  paper_trading_comparison_preparation_id: string;
  paper_trading_comparison_commitment_id: string;
}

interface PaperTradingComparisonConfirmationCampaignPolicy {
  policy_version: "paper-comparison-confirmation-v1";
  required_window_count: number;
  decision_rule: "all_reserved_windows_must_improve";
  slot_order_policy: "strict_sequence";
  non_overlap_policy: "strict";
  maximum_slot_start_delay_ms: number;
  missed_slot_policy: "campaign_not_confirmed";
}

interface PaperTradingComparisonConfirmationCampaignRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_confirmation_campaign";
  paper_trading_comparison_confirmation_campaign_id: string;
  source_verdict_ref: Ref;
  source_verdict_digest: string;
  source_comparison_ref: Ref;
  source_comparison_digest: string;
  champion: PaperTradingComparisonCandidateSide;
  challenger: PaperTradingComparisonCandidateSide;
  champion_selection: PaperTradingComparisonChampionSelection;
  comparison_policy: PaperTradingComparisonPolicy;
  market_data_configuration_digest: string;
  paper_policy_identity: PaperTradingEvaluationPolicyIdentity;
  campaign_policy: PaperTradingComparisonConfirmationCampaignPolicy;
  slots: PaperTradingComparisonConfirmationSlot[];
  committed_at: string;
  campaign_digest: string;
  evaluation_authority: "external_to_trading_systems";
  promotion_eligibility: "not_eligible";
  release_status: "sealed";
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}
```

Campaign ID is deterministic from the source verdict ID. One source verdict can create at most one
campaign. Creation requires the source verdict to be exact, sealed, `challenger_improved`,
`requires_precommitted_campaign`, and `not_eligible`. The source comparison must still match every
verdict side identity and digest. `committed_at` is server-owned and later than the source verdict's
`evaluated_at`.

The campaign is active until one exact campaign outcome exists. While active, it owns the unordered
candidate-version pair even before a slot comparison is materialized.

## Slot Materialization

`PaperTradingComparisonConfirmationWindowService.prepareNext({ campaignId })`:

1. reloads and verifies the campaign and absence of a campaign outcome;
2. finds the first slot without its exact preparation;
3. requires every prior slot to have one exact terminal verdict;
4. rejects materialization after that slot's start deadline;
5. calls `PaperTradingComparisonCoordinator.prepare` with the slot's frozen idempotency key,
   candidate/admission IDs, comparison policy, market-data digest, and paper policy;
6. verifies the returned preparation and commitment IDs and frozen contents equal the slot and
   campaign;
7. returns exact replay without provider, sandbox, market, activation, observation, Ledger, verdict,
   or promotion effects.

LocalStore enforces the same ownership independently. An active campaign rejects every preparation
for its pair except the next exact slot. A future slot before its predecessor verdict, a changed
pair/policy, an arbitrary same-pair comparison, or a second active campaign conflicts.

Existing single-window comparisons remain valid when no active campaign owns their pair.

## First-Tick Gate

LocalStore recognizes campaign slots by their precommitted comparison ID. Before persisting a
slot's first `PaperTradingComparisonTick`, it requires:

- the exact campaign and slot;
- all prior slot verdicts;
- no campaign outcome;
- slot 1 `observed_at > campaign.committed_at`;
- slot N `observed_at > prior_verdict.window_ended_at` and
  `observed_at > prior_verdict.evaluated_at`;
- `observed_at` no later than the applicable start time plus
  `maximum_slot_start_delay_ms`.

This is the authority boundary that proves campaign market evidence did not exist before campaign
or predecessor closure. Later ticks continue to use the existing comparison cadence and maximum
elapsed rules.

## Campaign Outcome

```ts
type PaperTradingComparisonConfirmationSlotResultStatus =
  | "challenger_improved"
  | "challenger_not_improved"
  | "comparison_ineligible"
  | "slot_expired";

interface PaperTradingComparisonConfirmationSlotResult {
  slot_index: number;
  paper_trading_comparison_commitment_ref: Ref;
  status: PaperTradingComparisonConfirmationSlotResultStatus;
  verdict_ref?: Ref;
  verdict_digest?: string;
  window_started_at?: string;
  window_ended_at?: string;
}

interface PaperTradingComparisonConfirmationCampaignOutcomeRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_confirmation_campaign_outcome";
  paper_trading_comparison_confirmation_campaign_outcome_id: string;
  campaign_ref: Ref;
  campaign_digest: string;
  slot_results: PaperTradingComparisonConfirmationSlotResult[];
  improved_count: number;
  not_improved_count: number;
  ineligible_count: number;
  expired_count: number;
  campaign_outcome: "confirmed_improvement" | "not_confirmed";
  decision_rule: "all_reserved_windows_must_improve";
  promotion_eligibility: "eligible" | "not_eligible";
  release_status: "sealed";
  next_action: "review_for_trading_promotion" | "return_to_candidate_arena";
  evaluated_at: string;
  outcome_digest: string;
  evaluation_authority: "external_to_trading_systems";
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}
```

`settle({ campaignId })` does not return an outcome while an unmaterialized next slot remains inside
its deadline or any materialized slot lacks a verdict. It also does not stop after a negative
verdict. It produces `confirmed_improvement` and `promotion_eligibility: "eligible"` only when every
reserved slot has one exact non-overlapping `challenger_improved` verdict. Any other terminal
verdict produces `not_confirmed` after all slots finish. If the next slot misses its start deadline,
the current and remaining unstarted slots become explicit `slot_expired` results and the campaign is
`not_confirmed`.

`eligible` means only that the campaign satisfies this paper confirmation protocol and may enter a
later TradingPromotion review integration. The outcome does not create a TradingPromotion, replace
the champion, grant private exchange access, or authorize live orders.

Campaign outcome ID is deterministic from campaign ID. Initial settlement uses the service clock;
replay reassesses exact evidence and reuses persisted `evaluated_at`. Changed slot evidence under the
same outcome ID conflicts.

## Store Authority

Add append-only Store methods for campaigns and outcomes. LocalStore validates canonical shape and
digest, source improved verdict, source comparison identity, deterministic slots, one active
campaign per pair, exact next-slot preparation, first-tick timing/non-overlap, ordered verdict set,
counts, decision arithmetic, and replay.

Pair ownership is:

```text
active campaign without outcome
OR preparation without verdict
```

An outcome releases campaign ownership. A per-window verdict releases only that slot's preparation
and enables the next reserved slot; it does not release the pair from the active campaign.

## Information And Authority Boundary

Campaign commitments, slots, verdicts, and outcomes remain hidden from CandidateArena context,
Finding, Lineage, leaderboards, operator read models, public commands, and TradingPromotion. The
campaign does not let candidates choose windows, inspect sibling outcomes, alter policy, or author
the aggregate decision.

The implementation remains paper-only, public-market-data-only, fake-execution-only, sealed, and
external to TradingSystems. A later frontier may consume an eligible campaign outcome for
TradingPromotion review and separately release closed evidence into causal research memory.

## Failure And Recovery

- Invalid source verdict or campaign input writes nothing.
- Campaign commitment exact replay is idempotent; a second campaign for the source or active pair
  conflicts.
- A crash after slot preparation but before caller readback replays the exact inert graph.
- A crash after a slot verdict leaves the next deterministic slot discoverable.
- Missing or corrupt prior verdict evidence blocks the next slot.
- A missed start deadline settles explicit expired slot results; it cannot be silently omitted.
- Campaign settlement failure leaves all prior commitments and verdicts intact and campaign
  ownership active.
- Restart reconstructs campaign progress entirely from campaign, preparation, verdict, and outcome
  records without provider or sandbox adoption.

## Acceptance

1. Only one exact source `challenger_improved` verdict can precommit one campaign.
2. The source verdict never appears in campaign slot results or confirmation counts.
3. All required future slot IDs, pair/artifact identity, policies, decision rule, and start delay are
   committed before any campaign tick.
4. An active campaign rejects arbitrary same-pair comparisons and out-of-order slots.
5. The next exact slot prepares inertly and replay creates no external or economic effect.
6. First ticks are strictly sequential, non-overlapping, and inside frozen start deadlines.
7. Negative or ineligible verdicts do not permit early stopping or replacement windows.
8. Every reserved slot is represented by an exact verdict or explicit expiry in the outcome.
9. Only all improved reserved windows produce `confirmed_improvement` and protocol-level
   `promotion_eligibility: "eligible"`.
10. Outcome replay is deterministic and restart-stable after clock advance.
11. Per-window verdict release enables only the next slot; campaign outcome releases campaign pair
    ownership.
12. No public command, operator projection, Finding/Lineage release, TradingPromotion creation,
    private access, direct order, or live authority is added.
13. Focused tests, workspace typechecks, repository guards, and the full suite pass.

## Out Of Scope

- optional or replacement campaign windows;
- early success/failure stopping inside a non-expired campaign;
- p-values, confidence intervals, regime stratification, or multiple-testing correction;
- automatic long-running campaign scheduling or process-provider resume;
- Finding/Lineage release and CandidateArena research adaptation;
- TradingPromotion command integration or champion replacement;
- private exchange data, credentials, or live trading.

## Next Frontier

After repository verification, consume sealed campaign outcomes in two separately reviewed paths:
promotion review for eligible outcomes, and causal Finding/Lineage release for all positive,
negative, ineligible, and expired campaign evidence. Neither path may mutate the completed campaign.
