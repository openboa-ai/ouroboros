# ResearchControlCampaign Paper Protocol And Slot Schedule Design

**Status:** Approved under the standing CandidateArena Goal authority

## Goal

Produce fair, restart-safe terminal paper evidence for every precommitted
`ResearchControlCampaign` slot without waiting for a favorable first comparison, selecting paper
policy after research results, or reimplementing the existing paper comparison verifier.

This frontier closes two invalid optionality gaps:

1. comparison policy, market-data configuration, and paper policy are currently chosen after the
   research arms finish;
2. the existing confirmation campaign can start only from `challenger_improved`, so a candidate
   that loses or becomes ineligible in its first prospective comparison can never produce the
   terminal release required by the campaign outcome.

The scheduler must count those first-window failures as terminal zero-credit evidence. It must not
retry until improvement or describe a source verdict as a confirmation release.

## Approaches

### Retry the source comparison until it improves

Rejected. Outcome-aware retry is optional stopping and converts market-regime search into apparent
candidate quality. It is also unbounded and makes negative candidates disappear from the
denominator.

### Synthesize a confirmation campaign for a losing source verdict

Rejected. `PaperTradingComparisonConfirmationCampaign` means that an observed improvement is being
tested for reproduction. Creating one after `challenger_not_improved` or
`comparison_ineligible` would falsify provenance and weaken the existing verifier.

### Precommit paper protocol, reserve source comparisons, and record terminal slot outcomes

Selected. The campaign freezes paper policy before research effects. After the deterministic
research report exists, one append-only schedule binds every slot to an exact source-comparison
identity and deadline before paper effects. Each candidate then closes either from a terminal source
verdict/expiry or from the existing confirmation campaign and ResearchRelease graph.

## Pre-Effect Paper Protocol

`ResearchControlCampaign` gains one `paper_evaluation_protocol` union.

```ts
type ResearchControlCampaignPaperEvaluationProtocol =
  | {
      protocol_status: "bound";
      comparison_policy: PaperTradingComparisonPolicy;
      market_data_configuration_digest: string;
      paper_policy_identity: PaperTradingEvaluationPolicyIdentity;
      schedule_policy: {
        policy_version: "research-control-paper-schedule-v1";
        source_start_order: "paired_by_sequence";
        maximum_active_source_pairs: 2;
        maximum_cross_arm_first_tick_skew_ms: number;
        source_missed_start_policy: "slot_expired";
        confirmation_precommit_deadline_ms: number;
      };
      protocol_digest: string;
    }
  | {
      protocol_status: "unavailable";
      reason:
        | "no_trading_promotion_at_commitment"
        | "paper_configuration_unavailable_at_commitment";
    };
```

Rules:

- `bound` requires the campaign comparator to be `trading_review` and comparison mode to be
  `champion_challenge`.
- `unavailable/no_trading_promotion_at_commitment` requires the comparator to be unavailable.
- The protocol digest binds comparison policy, market-data configuration, paper policy, and
  schedule policy.
- `maximum_cross_arm_first_tick_skew_ms` is no greater than the comparison policy's
  `maximum_start_skew_ms`.
- `confirmation_precommit_deadline_ms` equals the comparison policy's `maximum_elapsed_ms` in v1.
- A campaign with an unavailable protocol may finish research diagnostics but cannot create a paper
  schedule or economic outcome.

The runtime must receive the bound protocol as explicit configuration when it commits a campaign.
There is no implicit mutable default hidden inside the scheduler.

## Append-Only Paper Schedule

`ResearchControlCampaignPaperSchedule` is committed after the exact research report and before any
scheduled source comparison preparation, first tick, provider, sandbox, observation, or Ledger
effect.

```ts
type ResearchControlCampaignPaperScheduleSlot =
  | {
      sequence: number;
      tick_ref: Ref;
      slot_status: "no_admitted_candidate";
    }
  | {
      sequence: number;
      tick_ref: Ref;
      slot_status: "candidate_scheduled";
      candidate_ref: Ref;
      candidate_version_ref: Ref;
      system_code_ref: Ref;
      system_code_artifact_digest: string;
      admission_decision_ref: Ref;
      source_comparison_idempotency_key: string;
      source_preparation_id: string;
      source_comparison_commitment_id: string;
      maximum_source_start_delay_ms: number;
    };

interface ResearchControlCampaignPaperScheduleArm {
  arm_kind: ResearchControlCampaignArmKind;
  slots: ResearchControlCampaignPaperScheduleSlot[];
}

interface ResearchControlCampaignPaperScheduleRecord extends BaseRecord {
  record_kind: "research_control_campaign_paper_schedule";
  research_control_campaign_paper_schedule_id: string;
  campaign_ref: Ref;
  campaign_digest: string;
  report_ref: Ref;
  report_digest: string;
  paper_comparator: Extract<
    ResearchControlCampaignPaperComparator,
    { comparator_status: "trading_review" }
  >;
  paper_evaluation_protocol_digest: string;
  arms: [
    ResearchControlCampaignPaperScheduleArm,
    ResearchControlCampaignPaperScheduleArm
  ];
  committed_at: string;
  schedule_digest: string;
  paper_evaluation_scheduling_authority: true;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}
```

The schedule mirrors every report slot exactly. Candidate slots preserve the report's admission ref
and derive source comparison IDs with the existing
`paperTradingComparisonIdsForIdempotencyKey`. The idempotency key is:

```text
research-control-paper:<campaign-id>:<adaptive|static>:slot:<sequence>:source
```

For sequence 1, the applicable start is schedule commitment. For sequence N, it is the later
terminal time of the two sequence N-1 arm slots; a no-candidate slot contributes schedule commitment
as its terminal time. `maximum_source_start_delay_ms` equals the frozen comparison maximum elapsed
time. A source first tick must occur after the applicable start and no later than applicable start
plus that delay. The schedule cannot be recommitted with a later clock. No-candidate slots create no
paper effect and are already terminal for scheduling purposes.

The coordinator records the schedule first. The runtime then copies that exact record into both arm
stores before preparing a source comparison. Each arm LocalStore treats its scheduled candidate
pairs as owned: it accepts only the exact next sequence source preparation ID, comparator, policy,
candidate, admission, and deadline. An arbitrary same-pair preparation or a later sequence before
the current sequence is terminal conflicts before TradingRun allocation.

## Execution Order And Fairness

Candidate source comparisons start in matched sequence batches:

1. prepare both candidate-bearing arm slots for sequence N without market or runtime effects;
2. capture first ticks from one batch-owned public market and execution snapshot, with persisted
   observed times inside the frozen skew bound;
3. require cross-arm first-tick skew within the frozen bound;
4. authorize and start each pair symmetrically through the existing activation coordinator;
5. drive each bounded window through the existing window reader, driver, checkpoint coordinator,
   qualification service, and verdict service;
6. do not start sequence N+1 until both sequence-N arm slots are terminal.

If only one arm has a candidate in a sequence, that source comparison runs alone and the other arm's
no-candidate slot remains in the denominator. At most two source pairs are active. The scheduler
never calls default/public qualification observation paths and never grants private or live
authority.

A batch start failure before comparable first ticks records explicit evidence-ineligible terminal
slot outcomes for affected candidate slots after cleaning up any started runtime. It does not let
the surviving arm continue as comparable evidence.

## Terminal Slot Outcome

`ResearchControlCampaignPaperSlotOutcome` is append-only arm-local evidence for one exact scheduled
slot. It contains the schedule/report candidate identity and one terminal evidence variant.

```ts
type ResearchControlCampaignPaperSlotTerminalEvidence =
  | {
      evidence_kind: "source_verdict";
      source_comparison_ref: Ref;
      source_comparison_digest: string;
      source_verdict_ref: Ref;
      source_verdict_digest: string;
      terminal_status: "source_not_improved" | "evidence_ineligible";
    }
  | {
      evidence_kind: "source_slot_expired";
      terminal_status: "paper_slot_expired";
      expired_at: string;
    }
  | {
      evidence_kind: "source_start_ineligible";
      start_batch_ref: Ref;
      start_batch_digest: string;
      terminal_status: "evidence_ineligible";
      reason:
        | "first_tick_incomplete"
        | "cross_arm_first_tick_mismatch"
        | "source_start_deadline_missed";
      persisted_first_tick_refs: Ref[];
      persisted_first_tick_digests: string[];
      evaluated_at: string;
    }
  | {
      evidence_kind: "confirmation_precommit_expired";
      source_comparison_ref: Ref;
      source_comparison_digest: string;
      source_verdict_ref: Ref;
      source_verdict_digest: string;
      terminal_status: "paper_slot_expired";
      expired_at: string;
    }
  | {
      evidence_kind: "confirmation_release";
      confirmation_campaign_ref: Ref;
      confirmation_campaign_digest: string;
      confirmation_outcome_ref: Ref;
      confirmation_outcome_digest: string;
      research_release_ref: Ref;
      research_release_digest: string;
      release_kind: PaperTradingComparisonResearchReleaseKind;
      terminal_status:
        | "qualified_improvement"
        | "not_reproduced"
        | "evidence_ineligible"
        | "paper_slot_expired";
    };
```

The full record also binds schedule ref/digest, arm kind, sequence, tick, candidate, CandidateVersion,
SystemCode, artifact digest, admission decision, source IDs, terminal time, digest, and closed
authority.

Source-verdict mapping is exact:

| Source verdict | Scheduler action | Slot terminal status |
| --- | --- | --- |
| `challenger_improved` | Precommit and run the existing confirmation campaign | determined by confirmation ResearchRelease |
| `challenger_not_improved` | Do not create a confirmation campaign | `source_not_improved` |
| `comparison_ineligible` | Do not create a confirmation campaign | `evidence_ineligible` |
| no source start by deadline | No first tick or source start batch may exist; inert partial preparation may remain | `paper_slot_expired` |

An improved source verdict must precommit its confirmation campaign no later than the scheduled
confirmation deadline. Missing that deadline closes the slot as `paper_slot_expired`; a later
campaign cannot repair it.

`source_start_ineligible` is not a free-form scheduler error. It binds the exact
`ResearchControlCampaignPaperStartBatch` ref and digest. LocalStore accepts it only after the
applicable source deadline when a candidate-bearing side has no first tick, when a persisted first
tick missed the deadline, or immediately when paired first ticks violate the frozen observed-time
or shared-snapshot rule. The record lists every persisted first-tick ref/digest. Any started runtime
is stopped before the terminal outcome is recorded.

## Outcome Adjudicator Revision

`ResearchControlCampaignOutcome` consumes the exact schedule plus every arm-local slot outcome.
It no longer assumes that all candidates have a confirmation ResearchRelease.

Terminal metrics add `source_not_improved_count`; only `qualified_improvement` has discovery credit
1. `source_not_improved`, `not_reproduced`, `evidence_ineligible`, `paper_slot_expired`, and
`no_admitted_candidate` all have credit 0 and remain in the precommitted denominator.

For `confirmation_release`, the adjudicator retains the existing complete campaign/outcome/release
validation. For source verdict and expiry variants, LocalStore and the application validate exact
schedule ownership, comparison IDs, policy/comparator match, terminal timing, and absence of a
forbidden confirmation campaign. The coordinator outcome stores slot-outcome refs/digests rather
than raw source scores or market evidence.

One campaign remains `single_campaign_observation_only` and `not_eligible` for policy replacement.

## Recovery

The scheduler derives its next action from append-only schedule, comparison, activation,
checkpoint, verdict, confirmation, release, and slot-outcome records. It has no mutable process-only
cursor.

- Exact existing preparation/commitment: reload; do not allocate another TradingRun.
- Running activation after restart: recover through the existing paired runtime recovery path, then
  continue the window driver.
- Terminal source verdict: create exactly one source terminal slot outcome or precommit the exact
  confirmation campaign.
- Terminal confirmation release: create exactly one confirmation terminal slot outcome.
- Missed source-start deadline: record expiry without starting effects, including both sides of a
  partially prepared pair.
- Existing exact slot outcome: replay.
- Conflicting evidence or ambiguous release: fail closed.
- All slot outcomes terminal: invoke the existing campaign outcome collector.

Scheduler failure never mutates the selected champion TradingRun or Trading review promotion.

## Information And Authority Boundary

- Research workers never receive source or confirmation outcomes while the controlled campaign is
  running.
- All paper records remain arm-local until the coordinator outcome closes.
- The schedule can orchestrate paper-only evaluation but cannot rank, admit, promote, submit live
  orders, access credentials, or replace a champion.
- Fake paper `OrderRequest`s still pass through the Gateway and Ledger path owned by the existing
  paper services.
- A stable error code is evidence-quality failure, not strategy loss.

## Non-Goals

- Replicated-campaign statistical inference or allocation-policy replacement.
- Automatic TradingPromotion or champion runtime handoff.
- A public command or operator mutation surface.
- Private exchange data, credentials, or live orders.
- Changing the existing single-pair comparison, confirmation, qualification, verdict, or release
  algorithms.
- Releasing controlled outcomes into the primary CandidateArena before the whole campaign closes.

## Acceptance

1. Campaign digest binds an exact paper protocol before research arm effects.
2. Schedule digest binds every report slot, exact source comparison identity, and deadline before
   paper effects.
3. A losing or ineligible first comparison closes once without retry and remains in the denominator.
4. Only an improved source verdict may enter the existing confirmation path.
5. Paired sequence starts are bounded, comparable, and fail together before evidence collection.
6. Slot outcomes are append-only, arm-local, exact, and authority-closed.
7. Restart derives one next action without duplicate TradingRuns, windows, releases, or outcomes.
8. The revised campaign outcome counts every slot and credits only confirmed improvement.
9. Existing comparison and selected-champion behavior remains unchanged.
10. Focused tests, workspace typechecks, repository guards, and the full suite pass.
