# ResearchControlCampaign Paper Executor Design

**Status:** Implemented internally; default always-on runtime composition remains open

## Goal

Execute every bound `ResearchControlCampaignPaperSchedule` through the existing paper comparison,
qualification, verdict, confirmation, and ResearchRelease services until every candidate slot has
one terminal `ResearchControlCampaignPaperSlotOutcome` and the coordinator can adjudicate the
campaign outcome.

The executor must be restart-safe, bounded per step, matched across research arms, paper-only, and
free of outcome-aware retries. It must not add a second comparison algorithm or let a
`TradingSystem` score itself.

## Baseline Boundary

The repository already provides:

- a paper protocol bound before research effects;
- an append-only schedule bound after the exact research report;
- exact source comparison identities and start deadlines;
- arm-local terminal slot outcome variants;
- an outcome adjudicator that consumes exact schedule-owned slot outcomes;
- single-comparison preparation, first-tick capture, activation, paired side checkpoints,
  qualification, verdict, confirmation, ResearchRelease, and cleanup services.

This was the baseline before the frontier. The implementation now provides graph installation,
source and confirmation coordinators, a pure next-action projector, a bounded executor, an
interruptible convenience runner, one canonical internal composition factory, and an optional
one-step campaign hook. It does not yet provide a default process supervisor or public command that
discovers and runs bound campaigns.

## Approaches

### Copy the peer comparison graph into each arm store

Rejected. This would duplicate TradingRuns, evaluations, checkpoints, and Ledger evidence across
stores and make one store appear to own effects executed by another. Conflict and recovery rules
would become difficult to reason about.

### Merge both research arms into one paper store

Rejected. Candidate and admission evidence is currently produced inside isolated arm stores.
Merging complete candidate graphs introduces a broad import protocol and weakens the experiment's
physical isolation.

### Keep arm-local execution and add one cross-arm start batch

Selected. Each source comparison remains in the arm store that produced its challenger. A compact
`ResearchControlCampaignPaperStartBatch` binds the cross-arm first-tick relationship and is copied
to both stores. It proves that candidate-bearing source comparisons for one schedule sequence used
one shared public market/execution snapshot and an allowed observed-time skew, or that the matched
start became terminally ineligible.

## Canonical Vocabulary

`ResearchControlCampaignPaperStartBatch` is the durable noun for one schedule sequence's source
comparison start evidence.

The name carries only the domain noun. These axes remain fields:

- lifecycle: `batch_status`;
- scope: schedule ref/digest and `sequence`;
- provenance: comparison and first-tick refs/digests;
- fairness: shared snapshot digests and observed-time skew;
- authority: scheduling/evaluation-only flags and `not_live` status.

No compatibility alias is added because this is a new persisted family. Existing
`PaperTradingComparisonTick`, `PaperTradingComparisonActivation`, and
`ResearchControlCampaignPaperSlotOutcome` names remain unchanged.

## Paper Start Batch

The start batch is committed after all candidate-bearing source comparisons for one sequence are
prepared and before activation effects.

```ts
type ResearchControlCampaignPaperStartBatchStatus =
  | "single_ready"
  | "paired_ready"
  | "ineligible";

interface ResearchControlCampaignPaperStartBatchSide {
  arm_kind: ResearchControlCampaignArmKind;
  source_comparison_ref: Ref;
  source_comparison_digest: string;
  first_tick_ref?: Ref;
  first_tick_digest?: string;
  first_tick_observed_at?: string;
}

interface ResearchControlCampaignPaperStartBatchRecord extends BaseRecord {
  record_kind: "research_control_campaign_paper_start_batch";
  research_control_campaign_paper_start_batch_id: string;
  schedule_ref: Ref;
  schedule_digest: string;
  sequence: number;
  batch_status: ResearchControlCampaignPaperStartBatchStatus;
  sides: ResearchControlCampaignPaperStartBatchSide[];
  source_start_deadline_at: string;
  shared_market_snapshot_digest?: string;
  shared_public_execution_snapshot_digest?: string;
  ineligible_reason?:
    | "first_tick_incomplete"
    | "cross_arm_first_tick_mismatch"
    | "source_start_deadline_missed";
  evaluated_at: string;
  start_batch_digest: string;
  evaluation_authority: "external_to_trading_systems";
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}
```

Rules:

- Zero candidate-bearing slots create no start batch.
- One candidate-bearing slot creates `single_ready` with exactly one complete side.
- Two complete sides create `paired_ready` only when both first ticks contain identical market and
  public execution snapshots and their observed-time skew is within the frozen bound.
- `ineligible/first_tick_incomplete` is allowed only after the applicable start deadline and lists
  every first tick that actually persisted. It applies to one or two candidate-bearing sides.
- `ineligible/source_start_deadline_missed` closes one or two sides when all first ticks exist but at
  least one was observed after the frozen deadline.
- `ineligible/cross_arm_first_tick_mismatch` is allowed immediately after both first ticks
  exist and fail equality or skew.
- Batch identity is deterministic from schedule ID and sequence. The record is append-only.
- `source_start_deadline_at` is the exact applicable start plus the frozen maximum source delay.
- Coordinator creation validates both arm stores. Arm-store replication validates the exact
  schedule/sequence and sealed batch digest without claiming ownership of peer effects.

`source_start_ineligible` slot outcomes bind an exact start-batch ref and digest. LocalStore uses
that batch as the cross-store witness instead of pretending that one arm store contains the peer
comparison tick.

## Runtime Components

### Graph installer

`installResearchControlCampaignPaperGraph` copies both exact arm intents, the report, and the
schedule into each arm store. It copies a committed start batch into each candidate-bearing arm in
that batch; a no-candidate arm has no local source graph and must not claim the batch through the
arm-local replication boundary. It uses append-only record methods and verifies byte-equivalent
readback. It performs no market, provider, sandbox, Gateway, or Ledger effect.

### Next-action projector

`projectResearchControlCampaignPaperNextAction` is a pure read-model decision over the frozen
schedule and append-only evidence. It selects only the lowest sequence that is not terminal and
returns one stable action:

```text
wait_until
expire_unopened_source_slot
prepare_source_batch
capture_source_start_batch
authorize_source_batch
start_source_batch
advance_source_window
adjudicate_source_verdict
precommit_confirmation
expire_confirmation_precommit
advance_confirmation
record_slot_outcome
collect_campaign_outcome
complete
```

The projector never reads model output and never selects an action from profitability.

### Source batch coordinator

For one schedule sequence it:

1. prepares all candidate-bearing source comparisons before market or runtime effects;
2. reads one public market snapshot and one public execution snapshot;
3. supplies immutable clones of that evidence to each existing first-tick coordinator with one
   batch observed time;
4. recovers a partial first-tick write from the already persisted tick rather than reading a new
   market state;
5. records and replicates the exact start batch;
6. authorizes both comparisons before starting either runtime;
7. starts both runtimes concurrently and stops any survivor if its peer does not reach
   `both_running`;
8. drives paired source windows in lockstep through the existing tick, checkpoint, cleanup,
   qualification, and verdict services.

When both arms have candidates, every repeated source tick also uses one shared market/execution
snapshot and one observed time. A side failure stops the peer; persisted activation/window evidence
then determines the ordinary terminal ineligible path or leaves an explicit stable blocker when
cleanup cannot be proven. When only one arm has a candidate, the existing single-comparison window
driver is used without fabricating a peer.

### Confirmation coordinator

`challenger_not_improved` and `comparison_ineligible` source verdicts close directly. Only
`challenger_improved` can precommit the existing confirmation campaign. The precommit must occur no
later than `source_verdict.evaluated_at + confirmation_precommit_deadline_ms`.

The confirmation coordinator processes the existing campaign's slots in strict sequence, using the
existing single-comparison services. It settles the campaign, creates the ResearchRelease, and then
records the matching terminal slot outcome. It never promotes the challenger.

LocalStore rejects a late confirmation campaign at write time and rejects a confirmation release
whose source campaign missed the ResearchControlCampaign deadline. A late campaign cannot repair an
expired slot. Projection and confirmation execution both derive the deadline only from the exact
campaign-bound paper protocol; runtime configuration cannot supply a competing value.

### Step executor and runner

`ResearchControlCampaignPaperExecutor.advance` performs at most one externally meaningful
transition and returns:

```ts
type ResearchControlCampaignPaperExecutorStep = {
  status: "advanced";
  action: string;
  sequence?: number;
  armKind?: ResearchControlCampaignArmKind;
  outcome?: ResearchControlCampaignOutcomeRecord;
} | {
  status: "waiting";
  action: "wait_until";
  sequence: number;
  wakeAt: string;
} | {
  status: "complete";
  action: "complete";
};
```

`ResearchControlCampaignPaperRunner` repeatedly calls `advance`, sleeps only until an exact
`wakeAt`, interrupts scheduled waits on shutdown while draining an active step, and stops on
terminal evidence or stable failure. The runner is convenience only; correctness comes from
persisted state and the step executor.

## Restart And Recovery

There is no mutable cursor.

- Existing exact graph records replay.
- A report without a schedule commits the deterministic schedule before paper effects.
- Each arm graph is reinstalled idempotently.
- A preparation without a commitment resumes through the comparison coordinator.
- One persisted first tick anchors the peer's recovery snapshot; the runtime never reads a newer
  market state for that batch.
- Incomplete activation attempts are cleaned with the existing runtime activation recovery service.
- A cleanly stopped attempt can start a new deterministic retry only within the frozen retry bound.
- Terminal source verdicts never rerun.
- Existing confirmation campaigns, outcomes, releases, slot outcomes, and campaign outcomes replay.
- Conflicting same-ID evidence fails closed.

The executor records source expiry only when no preparation or commitment exists. It records
confirmation precommit expiry only when no confirmation campaign exists. It never deletes evidence
to make a retry possible.

## Error Handling

Stable errors are divided by evidence meaning:

- graph/source mismatch: fail closed, no retry;
- missed frozen deadline: record the matching terminal expiry;
- paired start mismatch/incomplete: stop started effects, record a start batch and zero-credit slot
  outcomes;
- provider/sandbox/checkpoint failure: use existing comparison negative or ineligible evidence and
  stop cleanly;
- process interruption: recover cleanup first, then derive the next action;
- persistence acknowledgement loss: reload deterministic identity before deciding whether to retry.

An unexpected runtime exception is not automatically strategy loss. It remains an operator-visible
stable failure until an existing evidence rule can classify it.

## Authority Boundary

- Public Binance market data enters only through `GatewayMarketDataPort`.
- TradingSystem decisions still pass through paper session Gateway and Ledger paths.
- The executor can schedule and evaluate paper work only.
- It cannot change CandidateAdmission, TradingPromotion, TradingReview, selected champion runtime,
  credentials, private reads, or live order authority.
- Research workers receive no paper outcome before the whole controlled campaign closes.

## Testing

The implementation requires:

- domain exact-shape/digest tests for start batches;
- application decision tests for single, paired, incomplete, mismatch, and replay cases;
- LocalStore tests for cross-store replication, late confirmation rejection, and append conflicts;
- pure next-action table tests for every persisted phase;
- runtime tests proving no effect before schedule/graph installation;
- paired first and repeated tick tests proving one shared snapshot and bounded skew;
- crash tests after preparation, one first tick, activation, checkpoint, verdict, confirmation
  precommit, release, slot outcome, and coordinator replication;
- end-to-end source-loss, source-ineligible, confirmed-improvement, non-reproduction, deadline expiry,
  and all-no-candidate campaigns;
- a bounded multi-sequence soak proving no duplicate TradingRuns, verdicts, releases, or outcomes.

## Non-Goals

- Replicated-campaign causal inference and adaptive-policy replacement.
- Automatic TradingPromotion or selected champion handoff.
- Private exchange data or live order execution.
- A public mutation command before the executor is proven by fixture integration and soak tests.
- Replacing the existing comparison, qualification, verdict, confirmation, or release algorithms.

## Acceptance

1. Every bound schedule reaches one terminal outcome per candidate slot without favorable-result
   retry.
2. Source comparisons for matched arms use identical public snapshots at each lockstep tick.
3. Cross-arm first-tick evidence is independently sealed by one start batch and readable in every
   candidate-bearing arm store without fabricating a graph in a no-candidate arm.
4. Restart at every persisted boundary creates no duplicate TradingRun, tick, verdict, confirmation,
   ResearchRelease, slot outcome, or campaign outcome.
5. Losing and ineligible source verdicts close directly and stay in the denominator.
6. Only an on-time improved source verdict enters confirmation.
7. Only a confirmed ResearchRelease earns discovery credit.
8. All failures stop paper runtimes cleanly or remain an explicit operator-visible blocker.
9. Paper-only and external-evaluation authority remain closed.
10. Focused tests, workspace typechecks, repository guards, the full suite, and a bounded soak pass.
