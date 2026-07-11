# Repeated Paired Comparison Checkpoint Design

**Date:** 2026-07-11
**Status:** Approved by standing Goal authority; implementation not started
**Depends on:** One committed first paired checkpoint and role-bound served-tick attribution

## Goal

Extend one owned champion/challenger paper comparison from its first atomic checkpoint to a
contiguous sequence of prospective, same-opportunity paired checkpoints. The first delivered
implementation must prove tick sequence 2 end to end, while every new contract is sequence-N rather
than tick-2-specific.

This frontier is scientific-control infrastructure. It does not adjudicate superiority, release
sealed qualification evidence, resume a comparison after process restart, or promote a candidate.

## Selected Protocol

Use a two-phase repeated-checkpoint protocol:

```text
paired checkpoint N-1
-> exact role acknowledgements for the currently served tick when required
-> persist contiguous tick N from one Gateway-owned market read
-> persist checkpoint attempt N as the owned view-advance intent
-> advance both role-bound provider views to tick N
-> each candidate GETs tick N and acknowledges its exact delivery
-> candidate emits an acknowledgement-bound decision or remains acknowledged-silent
-> prepare both sides without economic writes
-> atomically commit both Ledger/Observation/Evaluation transitions and paired outcome N
```

The checkpoint attempt is persisted before either provider view changes. It is the durable intent
for the in-process transition and already carries a bounded deadline, side baselines, exact tick,
and activation authority. No extra mutable "current view" record is introduced.

## Approaches Rejected

### Replace one mutable latest-tick pointer

A mutable pointer is operationally convenient but destroys append-only lineage and makes restart
state depend on whichever write happened last. It cannot prove which candidate saw which immutable
market opportunity and is rejected.

### Infer event ownership from time or provider log order

Clock skew, queued logs, retries, and late events can assign a stale decision to a new tick. The
existing delivery and acknowledgement protocol exists specifically to avoid this inference and
remains mandatory for every checkpoint after sequence 1.

### One call that advances, waits, and commits

Candidate response latency is asynchronous and external to the coordinator. Holding one call open
would conflate durable orchestration with candidate cadence, weaken restart handling, and make
timeouts hard to replay. Separate `beginNext` and `completeNext` calls keep each state transition
bounded and observable.

## Taxonomy Decision

No new durable product noun is needed. Existing nouns become genuinely sequence-aware:

- `PaperTradingComparisonTick` is one append-only item in a contiguous market-opportunity chain.
- `PaperTradingComparisonCheckpointAttempt` is the bounded durable intent for one sequence. For
  sequence 2+, it is also the provider view-advance intent.
- `PaperTradingComparisonCheckpointOutcome` is the terminal paired or incomplete result for that
  exact attempt.

`PaperTradingComparisonTickCaptureWriteContext` is an internal Store authority context, not a new
product record. `advanceComparisonCheckpointSide` is an application-port operation, not persisted
vocabulary.

The sequence-1 schema remains valid without predecessor or acknowledgement fields. Sequence 2+
requires them. This is an additive internal-schema evolution; no aliases or migration reads are
introduced because this comparison surface is not publicly composed.

## Domain Contract

### Tick lineage

`PaperTradingComparisonTickRecord` adds:

```ts
previous_tick_ref?: Ref;
previous_tick_digest?: string;
```

Sequence 1 requires both fields absent. Sequence 2+ requires both fields, an exact predecessor with
`sequence === current.sequence - 1`, a strictly later `observed_at`, the same commitment and market
configuration, and no sequence gap. The Store permits at most one not-yet-checkpointed latest tick.

Later capture requires an exact `PaperTradingComparisonTickCaptureWriteContext` containing the
activation, owned activation attempt, previous checkpoint attempt/outcome, and
`operation: "capture_next_tick"`. First-tick capture remains authority-free and inert.

### Checkpoint lineage

`checkpoint_sequence` becomes a positive integer in checkpoint attempts and outcomes. An attempt
adds optional predecessor outcome ref/digest fields:

```ts
previous_checkpoint_outcome_ref?: Ref;
previous_checkpoint_outcome_digest?: string;
```

Sequence 1 requires them absent. Sequence 2+ requires the exact paired outcome for sequence N-1.
The attempt snapshots the current evaluation digest, full observation-chain digest, and current
provider request count for each role before view advancement.

`PaperTradingComparisonCheckpointSideEvidence` and `PaperTradingObservationRecord` add optional
tick acknowledgement ref/digest fields. They are absent for sequence 1 and mandatory for sequence
2+. Each must identify the exact persisted acknowledgement for that role, TradingRun, activation
attempt, tick ref/digest, and provider request order.

Successful sequence-1 outcome uses next action `serve_and_acknowledge_current_tick`. Successful
sequence 2+ outcome uses `capture_next_tick`. Incomplete outcomes continue to close or recover the
comparison and never carry side economic evidence.

## Next Tick Capture

`PaperTradingComparisonTickCoordinator.captureNextTick` accepts activation ID, activation-attempt
ID, and idempotency key. It requires:

- the activation attempt is owned by the current runtime coordinator and remains `both_running`;
- every prior checkpoint is exact, paired, contiguous, and has no failed side;
- sequence 1 has exact delivery and acknowledgement records for both roles before tick 2 capture;
- no open checkpoint attempt and no already-captured uncheckpointed alternate tick;
- the next sequence does not exceed `maximum_observation_count` or `maximum_elapsed_ms`;
- the next capture is at least `comparison_policy.interval_ms` after the prior tick;
- one Gateway market snapshot and one public-execution snapshot satisfy the frozen data identity.

The coordinator persists one contiguous tick and returns an immutable `ComparisonMarketDataView`.
It does not change either running provider.

## Begin Next Checkpoint

`PaperTradingComparisonCheckpointCoordinator.beginNext` reloads the selected next tick, full paired
checkpoint chain, current side evaluations/observations, and current in-process provider counts. It
persists checkpoint attempt N before effects, then calls
`advanceComparisonCheckpointSide` for champion and challenger concurrently.

The session operation independently verifies the latest open attempt, prior paired outcome,
current evaluation and observation-chain digests, provider count, running sandbox, and exact tick.
It replaces the Gateway binding's immutable `ComparisonMarketDataView` and the role-bound enabled
attribution context as one synchronous in-memory transition. Provider request handlers dereference
that binding for every request, so later market and validation calls see tick N without restarting
the sandbox.

If either side fails or times out, the coordinator stops both owned sessions and records one
`incomplete` outcome. A side that changed early cannot produce paired evidence. Restart loses the
in-process ownership marker; recovery therefore stops both sides and records no fabricated
delivery, acknowledgement, decision, or economic result.

## Complete Next Checkpoint

`completeNext` accepts the exact open checkpoint-attempt ID. It requires current in-process
ownership, an unexpired deadline, and one exact acknowledgement per role for the attempt tick.
Delivery without acknowledgement is insufficient.

For each side, sandbox logs are refreshed under checkpoint authority. Every newly consumed
decision event must echo that side's exact acknowledgement ref and digest. No new event is valid
acknowledged silence. A missing, stale, cross-role, or mismatched event acknowledgement fails the
attempt without economic writes.

Both prepared sides then enter the existing recoverable LocalStore bundle. Sequence N observation,
Ledger preview, account lineage, processed-event delta, provider count, cumulative score, and
evaluation transition are validated against sequence N-1 state. Neither side materializes unless
the single transaction contains both sides and the paired outcome.

## Concurrency And Recovery

- Tick capture, checkpoint begin, and checkpoint complete each use one coordinator queue.
- Tick IDs and checkpoint-attempt IDs are deterministic for exact replay.
- At most one open checkpoint attempt exists per activation attempt.
- A captured next tick may be retried into the same begin operation; a conflicting tick at the same
  sequence is rejected.
- A successful begin is owned only by the current coordinator instance.
- Recovery rematerializes an already-written atomic bundle, but it never resumes an open provider
  session or repeats a candidate decision.
- Open or partial repeated attempts end with symmetric stop or `cleanup_required` evidence.

## Authority Boundaries

This frontier remains internal and paper-only:

- no runtime controller, public command, CLI, TUI, Web, or Desktop composition;
- no private exchange endpoint, credential, direct order submission, or live authority;
- no evaluator result, hidden label, qualification decision, verdict, evidence release, or
  promotion authority;
- candidates can acknowledge input and emit requests, but cannot persist ticks, attempts, outcomes,
  observations, Ledger chains, or scores themselves.

## Acceptance

1. Domain predicates accept sequence 1 compatibility and require exact predecessor and
   acknowledgement lineage for sequence 2+.
2. LocalStore accepts only one contiguous next tick after a paired predecessor and rejects gaps,
   alternates, stale authority, premature capture, cadence/cap overflow, and corrupt lineage.
3. Tick 2 capture performs exactly one Gateway market read and one public-execution read and does
   not change either provider view.
4. `beginNext` persists attempt 2 before view effects and advances both role-bound providers to the
   same immutable tick 2 without restarting either sandbox.
5. Partial view advancement produces no economic evidence and triggers symmetric cleanup.
6. Tick 2 delivery and acknowledgement are distinct by role/run and exact by tick/digest.
7. `completeNext` rejects missing, stale, cross-role, or mismatched acknowledgement evidence before
   paired economic persistence.
8. Acknowledged silence is a valid sequence-2 no-order observation for each side.
9. Exact acknowledgement-bound order, cancel, hold, and no-action events retain causal lineage.
10. One atomic transaction advances both observations/evaluations from sequence 1 to 2; crash
    recovery rematerializes both or neither.
11. Provider request caps, deadline, maximum observation count, comparison elapsed time, and cadence
    remain enforced across both checkpoints.
12. Restart never fabricates view advancement, delivery, acknowledgement, event, decision, Ledger,
    observation, score, or outcome evidence.
13. First-checkpoint behavior and generic non-comparison provider responses remain compatible.
14. Focused tests, workspace typechecks, repository guards, and the full suite pass with no public
    composition.

## Out Of Scope

- automatic cadence scheduling or a long-running comparison loop;
- process-restart resume of qualification sessions;
- minimum-window qualification or score adjudication;
- non-overlapping confirmation windows;
- external verdict, evidence release, TradingPromotion, private exchange, or live trading.

## Next Frontier

After one repeated checkpoint is proven, add bounded orchestration that captures and completes
successive ticks until the precommitted observation/time limit, including restart-safe stop/resume
policy. Only then can adjudication compare sealed cumulative paper `revenue - cost` under the frozen
policy.
