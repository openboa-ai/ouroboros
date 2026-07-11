# Paper Comparison First Paired Checkpoint Design

**Date:** 2026-07-11
**Status:** Implemented and integration-verified on 2026-07-11
**Depends on:** Verified comparison commitment, sole first tick, authorized activation, and one
owned `both_running` activation attempt

## Goal

Consume the exact first public comparison tick once for both running qualification sides and commit
one externally verifiable paired paper checkpoint. The checkpoint must preserve each
`TradingSystem`'s own decision cadence, treat no newly emitted decision as valid no-order
continuity, and prevent either side's economic state from becoming authoritative unless both sides
are committed against the same immutable tick.

This frontier proves common-opportunity consumption. It does not claim qualification,
comparability, superiority, confirmation, promotion, or live authority.

## Why The First Tick Comes First

Both provider sessions are started with the fixed `ComparisonMarketDataView` backed by the stored
first tick. Any market snapshot available to either candidate before this checkpoint is therefore
that first tick. The first checkpoint must consume candidate events against that tick.

Capturing a later tick first would be incorrect: an event emitted during activation may have been
caused by the first tick but would be mislabeled as a decision on the later tick. Later view
advancement remains closed until the runtime can durably attribute every consumed decision to the
exact comparison tick served to that side. Timestamp inference is not sufficient causal evidence.

## Approaches Considered

### Sequential observation writes

Reuse the public paper observation path for champion and then challenger. This is small, but a
process failure can advance one score, account, Ledger, and observation chain without the other.
Ordering bias and partial authority make this unacceptable.

### Independent side writes plus a final pair marker

Write each side independently and claim success only after a final pair record. This makes failure
detectable, but generic evaluation readers can still observe a one-sided score or Ledger mutation
before the pair marker. Quarantine after the fact is weaker than preventing the partial authority.

### Staged side preparation plus one atomic Store bundle

Prepare both side outcomes without economic Store writes, then commit both Ledger chains,
observations, evaluation updates, and the paired outcome through one Store operation. LocalStore
persists one atomically renamed transaction bundle before materializing normal collection records.
The bundle is the commit point; materialization is idempotent and recoverable.

This is the selected approach. It keeps provider/sandbox effects outside the Store transaction but
makes all economic evidence symmetric at its authority boundary.

## Canonical Vocabulary

### `PaperTradingComparisonCheckpointAttempt`

Append-only intent written before sandbox log refresh or decision consumption. It binds the exact
activation attempt, latest `both_running` activation outcome, first tick, side identities, initial
evaluation digests, provider request baselines, deadline, and checkpoint sequence.

### `PaperTradingComparisonCheckpointOutcome`

Append-only terminal result for one checkpoint attempt. `paired` contains both committed side
evidence summaries. `incomplete` contains no authoritative side observation refs and records the
stable failure and cleanup direction.

### `PaperTradingComparisonCheckpointWriteContext`

Exact writer authority for sandbox evidence refresh and the paired Store commit. It cannot
authorize an ordinary observation, ordinary Ledger write, lifecycle start/stop, candidate/code
mutation, verdict, promotion, private access, or live behavior.

No alias or compatibility read is introduced. These are new internal persisted nouns.

## Domain Records

```ts
interface PaperTradingComparisonCheckpointAttemptSide {
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  paper_trading_evaluation_ref: Ref;
  evaluation_record_digest: string;
  observation_chain_digest: string;
  provider_request_count_before: number;
}

interface PaperTradingComparisonCheckpointAttemptRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_checkpoint_attempt";
  paper_trading_comparison_checkpoint_attempt_id: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  activation_outcome_ref: Ref;
  activation_outcome_digest: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  tick_ref: Ref;
  tick_digest: string;
  checkpoint_sequence: 1;
  champion: PaperTradingComparisonCheckpointAttemptSide;
  challenger: PaperTradingComparisonCheckpointAttemptSide;
  attempted_at: string;
  checkpoint_deadline_at: string;
  attempt_status: "preparing";
  attempt_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}
```

The first frontier admits exactly `checkpoint_sequence: 1` and the exact activation `first_tick_ref`.
The deadline is recorded before effects, is no more than 60 seconds after `attempted_at`, and cannot
extend past the comparison's total `maximum_elapsed_ms` window measured from activation attempt
time.

```ts
interface PaperTradingComparisonCheckpointSideEvidence {
  role: "champion" | "challenger";
  observation_ref: Ref;
  observation_record_digest: string;
  evaluation_record_digest: string;
  ledger_chain_refs: Ref[];
  observation_status: "recorded" | "no_order" | "failed";
  consumed_event_count: number;
  provider_request_count_after: number;
}

interface PaperTradingComparisonCheckpointOutcomeRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_checkpoint_outcome";
  paper_trading_comparison_checkpoint_outcome_id: string;
  checkpoint_attempt_ref: Ref;
  checkpoint_attempt_digest: string;
  tick_ref: Ref;
  tick_digest: string;
  checkpoint_sequence: 1;
  outcome_status: "paired" | "incomplete";
  outcome_reason:
    | "paired_checkpoint_recorded"
    | "side_preparation_failed"
    | "side_preparation_timed_out"
    | "provider_request_budget_exceeded"
    | "checkpoint_deadline_exceeded"
    | "paired_persistence_failed"
    | "restart_cleanup";
  champion?: PaperTradingComparisonCheckpointSideEvidence;
  challenger?: PaperTradingComparisonCheckpointSideEvidence;
  stable_error_code?: string;
  next_action:
    | "design_attributed_next_tick"
    | "close_failed_comparison"
    | "recover_cleanup";
  completed_at: string;
  outcome_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}
```

`paired` requires both side evidence objects. `incomplete` forbids both. A paired side may have a
failed observation when the candidate itself emitted a protocol error; this is symmetric negative
evidence and forces `close_failed_comparison`. Infrastructure uncertainty does not create a failed
paper observation and instead produces `incomplete`.

`PaperTradingObservationRecord` gains optional comparison tick and checkpoint-attempt refs plus
digests. They are required for qualification observations committed by this path and absent for
ordinary `research_feedback` observations.

## Authority And Ownership

The checkpoint coordinator accepts only an activation attempt whose latest activation outcome is
exactly `both_running`. In the current process it must also prove that the activation coordinator
owns both provider sessions. A replay in another coordinator instance cannot prepare a checkpoint;
it must use recovery.

The checkpoint write context binds:

- activation ref and digest;
- activation-attempt ref and digest;
- `both_running` activation-outcome ref and digest;
- checkpoint-attempt ref and digest;
- role;
- operation `refresh_sandbox_evidence` or `commit_paired_checkpoint`.

LocalStore independently reloads all records and verifies that the context targets the latest
attempt and exact frozen side. Public/default `observe`, `schedule`, `recordLedger`, and
`recordPaperTradingObservation` remain rejected for qualification runs.

## Side Preparation

`PaperTradingComparisonSessionPort` adds `prepareComparisonCheckpointSide`. It receives one role,
the exact write context, the stored first tick, the deadline, and the frozen total provider request
limit. It performs the following steps without economic Store writes:

1. Reload activation, activation attempt/outcome, checkpoint attempt, side commitment, current run,
   evaluation, sandbox, and SystemCode.
2. Require running sandbox/run/evaluation state, zero prior observations, and exact first-checkpoint
   baseline.
3. Refresh sandbox logs through checkpoint-scoped authority and reload the side candidate read
   model.
4. Parse only previously unprocessed candidate events. No event means no-order continuity; it does
   not synthesize `hold` or an `OrderRequest`.
5. Preview deterministic paper Ledger records for candidate-emitted order requests without writing
   them.
6. Apply the existing paper engine against the first tick's market and public-execution snapshots.
7. Return the proposed Ledger records, one observation, one evaluation update, event count, and
   provider request total with a canonical side-preparation digest.

Both side preparations start concurrently. They receive cloned tick content and cannot read peer
state, peer requests, peer decisions, peer account state, scores, or the other side's result.

## Paired Commit

The Store port adds a preview-only Ledger operation and one paired checkpoint operation. The paired
operation receives both prepared side bundles and the proposed `paired` outcome.

Under the comparison-evidence write queue, LocalStore:

1. Reloads and verifies the complete comparison, activation, attempt, outcome, checkpoint attempt,
   side, sandbox, run, evaluation, commitment, observation, and Ledger graph.
2. Recomputes every digest and deterministic Ledger identity.
3. Requires both observations to reference the same first tick and checkpoint attempt, sequence 1,
   and their own frozen side only.
4. Requires each evaluation to advance exactly from zero to one observation with valid account,
   event, public-fill, cost, and score continuity.
5. Requires total provider requests at or below the frozen per-side cap and completion before the
   checkpoint deadline.
6. Builds all collection records in memory and writes one LocalStore checkpoint transaction bundle
   by atomic temp-file rename.
7. Materializes the bundle into normal Ledger, observation, evaluation, run, checkpoint-outcome,
   and projection records idempotently.

The transaction bundle is the commit point. A crash before it leaves no economic mutation. A crash
after it leaves a committed paired checkpoint that recovery can rematerialize exactly. Ordinary
collection files without a matching bundle cannot establish a paired outcome.

## Failure And Recovery

- Candidate `hold`, `no_action`, or silence is normal evidence and can produce a paired no-order
  observation.
- Candidate malformed/error events produce a paired failed observation when both side bundles are
  otherwise preparable; profit cannot offset that failure.
- Sandbox read failure, timeout, provider-budget excess, deadline excess, graph drift, or one
  unpreparable side creates no economic transaction bundle.
- On preparation failure, the coordinator stops both sides through the existing activation cleanup
  path, then appends one `incomplete` checkpoint outcome.
- On Store failure, the coordinator first reloads the deterministic transaction/outcome. An exact
  committed bundle is success even if materialization or acknowledgement failed. Absence or conflict
  triggers symmetric cleanup and `incomplete`.
- Startup recovery scans checkpoint attempts before generic activation cleanup. It rematerializes an
  exact committed bundle. For an outcome-less, uncommitted attempt it never re-reads candidate logs
  or reconstructs a decision; it stops both and appends `restart_cleanup`.
- A committed first checkpoint remains valid after restart, but unowned provider sessions are
  stopped. Resuming from that checkpoint is deferred until attributed later-tick consumption exists.

## Information Barrier

The coordinator and Store APIs are internal and receive no runtime route, command, operator action,
CLI, TUI, Web, or Desktop composition in this frontier. Active checkpoint records are not added to
ResearchWorker context or public operator projections. Errors expose stable codes and identities
needed for recovery, never peer decisions, scores, account values, raw provider config, or secrets.

## Non-Goals

- Capturing or advancing to a later comparison tick.
- Inferring causal tick identity from timestamps.
- Scheduling repeated checkpoints or resuming after restart.
- Qualification adjudication or comparison verdict.
- Evidence release to ResearchWorkers.
- Non-overlapping confirmation or TradingPromotion.
- Private exchange access, credentials, signed requests, direct orders, or live authority.
- A public command or operator control.

## Acceptance Evidence

1. The checkpoint attempt is durable before either sandbox log refresh.
2. Both side preparation calls are concurrently in flight and receive byte-equivalent first-tick
   evidence.
3. The path performs zero underlying market/public-execution reads.
4. An order-producing side uses only candidate-emitted events, deterministic previewed Gateway and
   Ledger evidence, and the existing paper engine.
5. A silent, hold, or no-action side records no-order continuity without a synthesized decision or
   Ledger chain.
6. One atomic Store bundle advances both evaluations from zero to one and records both observations
   against the same tick; there is no successful one-sided state.
7. Transaction acknowledgement/materialization failure reloads the exact bundle and cannot duplicate
   Ledger, observation, score, account, or event consumption.
8. One-side timeout or technical failure records no economic bundle, stops both, and yields
   `incomplete`.
9. Restart before commit never replays candidate decisions; restart after commit rematerializes the
   same paired evidence and then safely stops unowned sessions.
10. Provider requests remain under the frozen total cap, and elapsed time remains under the recorded
    deadline and comparison maximum.
11. Default/public qualification observe, schedule, Ledger, and observation writes remain blocked.
12. No verdict, promotion, private/live authority, peer evidence exposure, or production composition
    is added.

## Implementation Evidence

- Domain checkpoint records and total predicates: `d2d34e5`.
- Append-only checkpoint lifecycle: `de031a6`.
- Atomic LocalStore bundle and Ledger preview: `902e372`.
- No-write side preparation and post-commit cleanup preservation: `0f9609b`.
- Deterministic coordination, handoff, candidate-failure closure, and restart recovery: `a98df74`.
- Real LocalStore/session integration proves one paired first-tick observation per side, exact
  rematerialization, zero decision replay, and conservative unowned-session cleanup.

## Next Frontier

After the first checkpoint is proven, design causal served-tick attribution. A later checkpoint may
advance one shared view only when each consumed candidate event can be tied to the exact persisted
tick served to that side. That frontier can then add contiguous tick sequence, repeated paired
checkpoints, bounded resume, and eventual external adjudication without mislabeling stale decisions.
