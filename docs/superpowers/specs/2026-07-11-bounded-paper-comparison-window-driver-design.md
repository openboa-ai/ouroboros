# Bounded Paper Comparison Window Driver Design

**Date:** 2026-07-11
**Status:** Implemented internally with sequence-3 Store/session evidence; not production-composed
**Depends on:** Repeated paired comparison checkpoints through sequence 2

## Goal

Drive one owned champion/challenger paper comparison across its precommitted observation/time
window without requiring an operator to call every tick and checkpoint transition. The driver must
remain bounded, reconstructible from Store evidence, observable at each transition, and subordinate
to each candidate's own decision and acknowledgement cadence.

This frontier automates scientific-control plumbing. It does not qualify either side, compare
scores, release sealed evidence, select a winner, create a TradingPromotion, resume a provider after
process restart, or expose a public command.

## Implementation Evidence

- The pure classifier covers cadence waits, acknowledgement waits, contiguous tick/checkpoint
  phases, frozen count/time bounds, incomplete/failed terminal states, ownership loss, and invalid
  chronology/cardinality.
- The Store-backed reader validates commitment, activation, tick, checkpoint, role-bound delivery
  and acknowledgement, evaluation, observation, digest, chronology, and exact stopped-successor
  lineage before returning facts.
- The one-step driver and non-overlapping runner have deterministic replay, concurrency, terminal,
  error, timer, and bounded-drain tests.
- A process-local runner drives the LocalStore/session integration from sequence 2 through tick 3,
  view advance, acknowledgement wait, paired commit, and frozen-maximum stop without provider or
  sandbox restart. Restart then rematerializes every bundle and preserves stopped evaluations
  without decision or economic replay.
- No app, controller, command, CLI, TUI, Web, Desktop, qualification, adjudication, release,
  promotion, private, or live composition was added.

## Selected Architecture

Use three application-only components:

1. `PaperTradingComparisonWindowStateReader` reloads and validates the durable graph and returns the
   exact facts and current writer IDs needed for one step.
2. `PaperTradingComparisonWindowDriver.advance` classifies those facts, performs at most one bounded
   effect, and returns a structured step result.
3. `PaperTradingComparisonWindowRunner` schedules repeated `advance` calls with one timer per owned
   activation attempt, exposes status and drain controls, and stops scheduling on terminal state or
   unexpected error.

The Store records already form the durable state machine. No mutable current-phase record, lease,
or job schema is added. Exact replay is delegated to the existing deterministic tick and checkpoint
coordinators.

## Approaches Rejected

### One blocking run-until-complete call

A call that captures a tick, waits for candidate acknowledgement, and completes a checkpoint would
hold process-local control across external candidate latency. It obscures which transition is
blocked, complicates shutdown, and cannot honestly survive restart.

### A timer that calls the existing methods optimistically

Using exceptions from `captureNextTick`, `beginNext`, and `completeNext` as phase detection would
mix expected waiting with graph corruption and policy failure. The runner needs an explicit
read-before-effect classifier.

### Durable leased jobs with process-resume

A lease/heartbeat/job subsystem could coordinate multiple processes, but the current runtime policy
deliberately treats provider and sandbox ownership as process-local and stops both sides after
restart. Adding resumable jobs before resumable provider identity exists would persist a claim the
runtime cannot satisfy.

## Vocabulary

No new domain record is introduced.

- `PaperTradingComparisonWindowDriver` is an application service that advances one persisted
  comparison graph by at most one transition.
- `PaperTradingComparisonWindowStateReader` is an internal read port and Store-backed adapter that
  validates and projects the exact current comparison graph without writing it.
- `PaperTradingComparisonWindowRunner` is a process-local scheduler for that driver, analogous to
  `PaperTradingEvaluationRunner` but keyed by activation-attempt ID.
- `PaperTradingComparisonWindowStep` is a read-only application result, not durable evidence or a
  verdict.

The existing `handoff_cleanup` activation outcome remains the orderly terminal transition when the
precommitted maximum observation/time boundary is reached. The checkpoint chain and stopped
evaluation state provide the durable evidence needed by a later qualification frontier. No alias or
migration is required.

## Driver Input And Result

```ts
interface PaperTradingComparisonWindowDriverInput {
  activationId: string;
  activationAttemptId: string;
}

type PaperTradingComparisonWindowPhase =
  | "waiting_first_checkpoint_due"
  | "first_checkpoint_committed"
  | "waiting_tick_acknowledgements"
  | "next_tick_captured"
  | "views_advanced"
  | "checkpoint_committed"
  | "window_stopped"
  | "comparison_failed"
  | "recovery_required";

interface PaperTradingComparisonWindowStep {
  activation_id: string;
  activation_attempt_id: string;
  phase: PaperTradingComparisonWindowPhase;
  checkpoint_sequence: number;
  transition:
    | "none"
    | "capture_first_checkpoint"
    | "capture_next_tick"
    | "begin_next_checkpoint"
    | "complete_next_checkpoint"
    | "stop_window";
  terminal: boolean;
  next_wake_at?: string;
  stable_error_code?: string;
  authority_status: "not_live";
}
```

The result reports orchestration state only. It never reports hidden score comparison, qualification,
or a winner.

## Durable Graph Classification

Each `advance` call asks the Store-backed state reader to reload and digest-check the commitment,
activation, exact latest activation attempt/outcome, contiguous tick chain, contiguous checkpoint
attempts/outcomes, role-bound acknowledgements, current evaluations, and observations. The reader
also returns the latest tick and open checkpoint-attempt IDs needed by existing writers.

The driver requires the activation attempt to be owned by the current runtime coordinator before
any effect. A persisted `both_running` attempt without process-local ownership returns terminal
`recovery_required` for the current runner; it is never adopted. Explicit recovery remains a
separate operation.

The legal states are:

1. **No checkpoint attempt:** wait until the first tick's `observed_at + interval_ms`, then call
   `captureFirst` once.
2. **Paired checkpoints equal ticks:** wait for both exact acknowledgements of the latest tick.
   Once present, either stop at the precommitted window boundary or call `captureNextTick`.
3. **One more tick than checkpoint attempt:** call `beginNext` for that exact latest tick.
4. **One open latest checkpoint attempt:** wait for both acknowledgements. If both exist, call
   `completeNext`. If its deadline expires, call `completeNext` so the existing fail-closed path
   stops both sides and records an incomplete outcome.
5. **Incomplete checkpoint, failed paired side, or terminal activation outcome:** return terminal
   `comparison_failed` or `window_stopped` without another effect.

Any other cardinality, sequence, digest, role, run, predecessor, or outcome combination is graph
invalid and stops the runner with an error. The driver does not repair evidence.

## Bounds And Optional-Stopping Control

The comparison policy is frozen before outcomes exist. The driver may stop normally only when:

- `checkpoint_sequence === maximum_observation_count`; or
- the next cadence point would exceed
  `activationAttempt.attempted_at + maximum_elapsed_ms`.

It does not stop because one side currently leads, because the minimum observation count was
reached, or because a ResearchWorker asks to inspect results. Minimum observation/time fields are
later qualification gates, not adaptive stopping triggers.

Maximum elapsed time governs admission of new shared market ticks. A repeated attempt whose tick
was already captured within the window may settle under its separately frozen checkpoint deadline;
missing acknowledgement or deadline failure still takes the existing incomplete-checkpoint cleanup
path. If elapsed time arrives before the first checkpoint or between paired checkpoints, the driver
calls the owned activation's orderly `handoff_cleanup` and never asks the market port for an
ineligible tick. Provider request caps remain enforced by the provider, session, attempt, and Store
layers.

## Candidate Cadence And Waiting

The driver never calls a candidate endpoint, synthesizes an acknowledgement, emits an order, or
forces a decision. Running candidates independently GET the current immutable market view and POST
the returned context. Missing acknowledgement is an expected `waiting_tick_acknowledgements` state
until a checkpoint or window deadline requires fail-closed cleanup.

One step performs at most one of: first checkpoint, next tick capture, view advance, repeated
checkpoint completion, or orderly stop. This keeps each call short and makes effects and retries
auditable.

## Runner Lifecycle

`PaperTradingComparisonWindowRunner.start` registers one timer loop per activation-attempt ID.
Duplicate start returns `already_running`. Each timer invokes one driver step, stores the latest
read-only status, and schedules the next poll only when the step is nonterminal.

The runner:

- uses `setTimeout`, not overlapping intervals;
- removes the timer before awaiting the driver;
- tracks active step promises for bounded `drain`;
- accepts injected polling interval, timer, and error callback for deterministic tests;
- stops scheduling on terminal state or unexpected error;
- does not claim comparison cleanup merely because its timer stopped.

Composition shutdown must first stop or recover owned activation attempts, then drain the runner.
Restart recovery remains conservative: transaction bundles rematerialize and unowned running/open
attempts stop; the runner does not resume them.

## Idempotency And Concurrency

- Driver calls for one activation attempt serialize through one queue.
- Deterministic internal idempotency keys include activation-attempt ID, checkpoint sequence, and
  transition kind.
- Existing tick/checkpoint coordinators remain the sole writers for their records.
- Exact repeated driver steps replay existing records; conflicting records fail closed.
- One runner owns at most one timer and one active step per activation attempt.

## Error Handling

Expected waiting is returned, not thrown. Policy terminal states are returned with stable phase and
error code where applicable. Graph corruption, lost ownership during an effect, persistence
failure, or an unexpected child-coordinator error rejects the step; the runner records the error,
stops scheduling, and leaves cleanup to the explicit recovery path.

No caught error is reclassified as successful window completion. Candidate failure remains paired
negative evidence only when the atomic checkpoint already committed it; infrastructure failure is
an incomplete comparison.

## Acceptance

1. The driver reconstructs every legal phase from Store evidence and performs at most one effect.
2. First checkpoint execution waits until the frozen first cadence point.
3. Missing role acknowledgement returns waiting without market, view, Ledger, observation, or
   lifecycle writes.
4. Exact acknowledgements advance through capture, begin, and complete on separate steps.
5. Three or more checkpoints run through the same sequence-N path without provider or sandbox
   restart.
6. Deterministic replay does not duplicate market reads, attempts, outcomes, observations, Ledger,
   or score.
7. Observation count and elapsed-time maximums stop both sides cleanly without score-aware optional
   stopping.
8. Open-attempt deadline, candidate failure, request-cap failure, and child persistence failure
   produce no one-sided economic evidence.
9. Lost ownership returns recovery required and never adopts or resumes the persisted session.
10. Restart recovery rematerializes committed bundles, closes open attempts, and causes the runner
    to remain terminal without decision replay.
11. The timer runner has no overlapping steps, supports exact duplicate start, bounded drain, and
    terminal/error stop.
12. No public command, runtime controller, CLI, TUI, Web, Desktop, private exchange, verdict,
    qualification, release, promotion, or live authority is added.
13. Focused tests, typechecks, repository guards, and the full suite pass.

## Out Of Scope

- process-restart resume or cross-process leases;
- comparison qualification or minimum-window acceptance;
- score adjudication, statistical confidence, or champion replacement;
- non-overlapping confirmation-window orchestration;
- released Finding/Lineage generation;
- CandidateArena generation-budget adaptation;
- public or operator composition;
- private exchange or live trading.

## Next Frontier

After the bounded driver proves a complete stopped comparison window, implement a read-only paired
qualification decision over both exact run-specific chains. Only qualified closed windows may enter
score adjudication; confirmation, evidence release, and promotion remain later boundaries.
