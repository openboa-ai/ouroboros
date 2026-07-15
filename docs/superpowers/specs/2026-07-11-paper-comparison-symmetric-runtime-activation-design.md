# Paper Comparison Symmetric Runtime Activation Design

**Date:** 2026-07-11
**Status:** Implemented with focused and real LocalStore/session integration evidence
**Scope:** CandidateArena P0, recoverable paper-only symmetric runtime start and cleanup
**Depends on:** Verified `PaperTradingComparisonActivation`, sole first tick, and complete inert pair

## Goal

Consume one exact `PaperTradingComparisonActivation` to start champion and challenger qualification
sessions in parallel against the same fixed first-tick market view, record every external start and
cleanup result append-only, and reach only one of three durable states: both running within policy,
both confirmed stopped, or cleanup still required.

This frontier must make a non-atomic external operation observable and recoverable. It must never
infer success from an invocation returning, never leave a one-sided start eligible for evidence,
never allow retry while cleanup is uncertain, and never weaken the existing public/default
`PaperTradingSessionService` qualification guards.

## Why A Separate State Machine Is Required

Provider and sandbox starts cannot be committed atomically with LocalStore. Either side may fail,
time out, finish late, or survive a process crash. Starting one side also changes its TradingRun,
sandbox, run-control, and evaluation records, so the existing inert comparison reload cannot remain
the validator after the first effect.

The pair still owns an immutable baseline. Its side commitments contain enough data to reconstruct
the exact original `not_started` evaluation, and the pair stores that baseline record digest. Runtime
activation therefore uses two forms of truth:

1. immutable pair, first-tick, activation, and reconstructed baseline identity;
2. append-only attempt/result/outcome evidence plus narrowly validated current side transitions.

No generic side writer becomes mutable by default. A writer may cross the inert boundary only with
an exact runtime-write context tied to one open activation attempt and one bound side.

## Approaches Considered

### Append-only attempt state machine plus authority-aware side transitions

Selected. Persist intent before effects, start both sides in parallel, record side results, clean up
on any policy failure, and derive current pair state from append-only outcomes. Store validates every
side writer against the exact attempt and allowed transition.

### Call the existing session `activate` twice

Rejected. Qualification activation is intentionally blocked, the first successful call destroys the
inert reload assumption, no pair-level attempt exists for restart, and a second failure can leave an
unexplained running side.

### Keep side records inert while external processes run

Rejected. An unlinked provider or sandbox is not observable, cannot be recovered safely, and would
let operational reality diverge from TradingRun and evaluation state.

### Treat one in-memory `Promise.all` as atomic

Rejected. Process death loses the result, timeout does not cancel an external effect, and a late
success can appear after the peer has already failed.

## Canonical Vocabulary

### PaperTradingComparisonActivationAttempt

Append-only pair-level intent recorded before any external effect. It binds the exact activation,
comparison, first tick, side refs, derived policy, attempt sequence, parallel start mode, server
attempt time, and start deadline.

### PaperTradingComparisonActivationSideResult

Append-only result of one side operation under an attempt. Operations are `start` or `stop`; reasons
distinguish symmetric start, partial-start cleanup, policy cleanup, restart cleanup, and explicit
handoff cleanup. Outcomes are `succeeded`, `failed`, `timed_out`, or `not_running`.

### PaperTradingComparisonActivationOutcome

Append-only pair-level reconciliation result. Outcomes are sequenced because restart or late-effect
reconciliation may follow an earlier `both_running` or `cleanup_required` result. The latest outcome
is one of:

- `both_running`: both exact sides are running within all start policy bounds;
- `stopped_cleanly`: neither side is active and a later bounded retry may be admitted;
- `cleanup_required`: one or both side states remain failed, timed out, late, or uncertain.

`both_running` is operational evidence only. It is not a paired checkpoint, paper observation,
qualification result, economic verdict, or promotion authority.

Do not use `activationRun`, `startGrant`, `runtimePermit`, or mutable `activationStatus` aliases.

## Domain Contracts

```ts
interface PaperTradingComparisonActivationAttemptRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_activation_attempt";
  paper_trading_comparison_activation_attempt_id: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  first_tick_ref: Ref;
  first_tick_digest: string;
  champion: PaperTradingComparisonActivationSide;
  challenger: PaperTradingComparisonActivationSide;
  activation_policy: PaperTradingComparisonActivationPolicy;
  attempt_sequence: number;
  retry_index: number;
  start_mode: "parallel";
  attempt_status: "starting";
  attempted_at: string;
  start_deadline_at: string;
  attempt_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

interface PaperTradingComparisonActivationSideResultRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_activation_side_result";
  paper_trading_comparison_activation_side_result_id: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  role: "champion" | "challenger";
  operation_sequence: number;
  operation: "start" | "stop";
  reason:
    | "symmetric_start"
    | "partial_start_cleanup"
    | "policy_cleanup"
    | "restart_cleanup"
    | "handoff_cleanup";
  outcome: "succeeded" | "failed" | "timed_out" | "not_running";
  trading_run_ref: Ref;
  paper_trading_evaluation_ref: Ref;
  sandbox_ref?: Ref;
  runtime_lifecycle_status: TradingRunLifecycleStatus | "unknown";
  evaluation_status: PaperTradingEvaluationStatus | "unknown";
  provider_request_count: number;
  effect_started_at: string;
  effect_completed_at: string;
  stable_error_code?: string;
  side_result_digest: string;
  authority_status: "not_live";
}

interface PaperTradingComparisonActivationOutcomeRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_activation_outcome";
  paper_trading_comparison_activation_outcome_id: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  outcome_sequence: number;
  previous_outcome_ref?: Ref;
  outcome_status: "both_running" | "stopped_cleanly" | "cleanup_required";
  outcome_reason:
    | "started_within_policy"
    | "start_failed"
    | "start_timed_out"
    | "start_skew_exceeded"
    | "activation_elapsed_exceeded"
    | "provider_request_budget_exceeded"
    | "side_result_persistence_failed"
    | "cleanup_failed"
    | "restart_cleanup";
  champion_latest_result_ref?: Ref;
  challenger_latest_result_ref?: Ref;
  next_action:
    | "capture_first_paired_checkpoint"
    | "retry_activation"
    | "recover_cleanup";
  completed_at: string;
  outcome_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}
```

Canonical digests exclude record kind, version, record ID, and their own digest. Attempt digest
includes attempt/deadline times because those times bound external effects. Side-result and outcome
digests include all effect and reconciliation times, refs, counts, status, reason, and closed
authority fields.

The domain also owns a pure baseline builder and transition predicates. Given the immutable paper
commitment and bound evaluation ref, the builder reconstructs the exact original `not_started`
evaluation so its full-record digest can still be checked after the current evaluation file moves to
`running` or `stopped`. Allowed activation states preserve zero observations, zero score, initial
account, empty orders, empty processed-event sets, exact commitment refs, and `not_live` authority.

## Runtime Write Context

```ts
interface PaperTradingComparisonRuntimeWriteContext {
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  role: "champion" | "challenger";
  operation: "start" | "stop";
}
```

This context is not a bearer token and is insufficient by itself. LocalStore reloads and verifies
the referenced activation, attempt, latest outcome, bound side, reconstructed baseline, and current
writer-specific transition under the comparison-evidence queue.

At this frontier the context may authorize only:

- bound sandbox start and TradingRun transition to `running`;
- exact start run-control audit;
- bound zero-observation evaluation transition to `running`;
- runner/provider/sandbox stop and TradingRun transition to `stopped`;
- exact stop run-control audit;
- bound zero-observation evaluation transition to `stopped`.

Paper observations, Ledger writes, order/execution records, later ticks, candidate/SystemCode/
admission drift, commitment replacement, and promotion remain blocked regardless of context.

## Store State Machine

All attempt, side-result, outcome, and authority-aware side writes use the existing
comparison-evidence queue.

### Attempt admission

1. Reload and digest-check the activation, pair, and sole first tick.
2. For sequence 1, re-run the complete inert comparison graph validator.
3. For a retry, require the previous attempt's latest outcome to be `stopped_cleanly` and verify
   both sides are exact zero-evidence stopped/baseline states.
4. Require `attempt_sequence === prior attempt count + 1` and
   `retry_index === attempt_sequence - 1`.
5. Reject when `retry_index` exceeds `maximum_retry_count_per_side`.
6. Reject a second open, `both_running`, or `cleanup_required` attempt.
7. Exact replay returns the stored attempt; same-ID drift and alternate concurrent attempts fail.

### Side writes and results

Start writes require no prior result for that role/operation and no outcome. Stop writes are allowed
after a failed, timed-out, late, policy-invalid, or `both_running` state. Writer-specific validators
permit only the fields listed in Runtime Write Context. Side results are append-only and must match
the current persisted run/evaluation/sandbox state or explicitly report `unknown` after timeout.

### Outcomes

- `both_running` requires two succeeded start results, exact current running state, persisted sandbox
  start-time skew within `maximum_start_skew_ms`, completion before `start_deadline_at`, and request
  counts within budget. Adapter start times must fall between attempt and server-observed completion.
- `stopped_cleanly` requires neither side active and exact stopped/baseline zero-evidence state.
- `cleanup_required` requires a failed/timed-out/unknown side result or failed reconciliation and
  blocks retry.
- Outcome sequence is contiguous; a later reconciliation references the previous outcome.

Corrupt JSON, shape-valid digest drift, missing refs, illegal transition, non-contiguous sequence,
or current-state mismatch fails closed before a write.

## Session Boundary

`PaperTradingSessionService` gains internal comparison-side methods behind a focused
`PaperTradingComparisonSessionPort`:

```ts
startComparisonSide(input: {
  side: PaperTradingComparisonActivationSide;
  authority: PaperTradingComparisonRuntimeWriteContext;
  marketData: GatewayMarketDataPort;
  deadlineAt: string;
  maximumProviderRequestCount: number;
  signal: AbortSignal;
}): Promise<PaperTradingComparisonSessionSideStatus>;

stopComparisonSide(input: {
  side: PaperTradingComparisonActivationSide;
  authority: PaperTradingComparisonRuntimeWriteContext;
  deadlineAt: string;
  reason: PaperTradingComparisonActivationSideResultRecord["reason"];
}): Promise<PaperTradingComparisonSessionSideStatus>;

inspectComparisonSide(...): Promise<PaperTradingComparisonSessionSideStatus>;
```

The service independently loads the bound candidate, run, commitment, evaluation, SystemCode, and
runtime-write context. It verifies the immutable commitment against the supplied fixed comparison
view, uses a per-run Gateway binding, starts no scheduler, and passes the context to every Store
transition. Existing `activate`, `observe`, `schedule`, `stop`, and default recovery keep their
qualification rejection/skip behavior.

Both sides receive the same immutable `ComparisonMarketDataView` backed by the same first tick. API
provider startup may read that view, but activation performs no underlying Binance read. The paper
API provider enforces a hard per-side request count; requests beyond the committed maximum fail
closed and cannot reach market/account/order validation handlers.

## Coordinator Flow

`PaperTradingComparisonRuntimeActivationCoordinator.start` has input only activation ID and
idempotency key.

1. Serialize pair activation within the process.
2. Load and verify activation closure and current attempt state.
3. Derive deterministic attempt ID, sequence, retry index, server attempt time, and deadline.
4. Append the attempt before any provider, sandbox, runner, or session effect.
5. Build one fixed first-tick view without an underlying market read.
6. Invoke both side starts in parallel with one shared abort deadline.
7. Persist each settled side result; timeout is recorded as uncertain, never as failure-with-no-effect.
8. Reinspect both sides and enforce overall elapsed time, persisted sandbox start-time skew, request
   budget, and exact running state.
9. If every bound passes, append `both_running` and return the uncomposed running handle.
10. Otherwise stop every possibly started side in parallel within `cleanup_timeout_ms`, persist stop
    results, inspect again, and append `stopped_cleanly` or `cleanup_required`.

There is no automatic retry loop. A later call may create the next attempt only after a durable
`stopped_cleanly` outcome and within the frozen retry limit.

Late start settlement remains observed. A late success immediately invokes authorized stop and
cannot be promoted to `both_running`. If cleanup/result persistence is unavailable, the latest
durable state remains or becomes `cleanup_required`; retry stays blocked.

## Restart Recovery

`recoverIncompleteActivations` scans attempts whose latest outcome is absent, `both_running`, or
`cleanup_required`. This frontier has no durable paired-checkpoint handoff claim, so startup recovery
treats every persisted `both_running` outcome as unowned and stops both sides. A future frontier must
add an append-only claim before changing that rule.

Because API provider sessions are process-local, this frontier never claims that a pre-crash
`both_running` pair survived intact. Recovery inspects both sides, attempts authorized stop for both,
persists side results, and appends the next outcome as `stopped_cleanly` only when neither side is
active. Otherwise it appends `cleanup_required`. This is the conservative `stop_both` branch of the
frozen `recover_both_or_stop_both` policy.

A ref-less timed-out start or failed transient-sandbox cleanup remains externally uncertain even
when Store state has no active sandbox. Absence of a persisted sandbox ref is not stop proof; that
role keeps its uncertain latest result and recovery remains `cleanup_required` until an adapter- or
operator-backed cleanup frontier can prove the external instance is gone.

Recovery never resumes one side, never synthesizes a missing success result, never reuses a partial
checkpoint, and never starts a retry automatically.

## Failure And Timeout Semantics

- Start and cleanup clocks are server-owned exact ISO timestamps.
- Parallel start shares the activation deadline; cleanup receives its own fixed timeout.
- A timeout means state unknown until inspect/stop reconciliation proves otherwise.
- Error records contain stable codes only, never provider URLs, candidate output, snapshots, peer
  evidence, credentials, secrets, or raw adapter exceptions.
- If one side succeeds and the other fails, the successful side is stopped before retry eligibility.
- If both succeed outside skew or elapsed bounds, both are stopped.
- If request budget is exceeded during startup, both are stopped.
- No result or outcome may claim a state that LocalStore cannot independently verify.

## Non-Goals

This frontier does not:

- schedule or record a paper observation;
- capture a later comparison tick or create an advanceable shared view;
- consume `OrderRequest`s, append Ledger records, or mutate paper score/account state;
- decide qualification, comparability, superiority, confirmation, evidence release, or promotion;
- expose activation through a public command, runtime route, operator read model, CLI, TUI, Web, or
  Desktop control;
- expose peer decisions, score, account state, or active comparison identity to either candidate;
- grant private exchange, credential, signed request, direct order, or live authority;
- automatically retry or keep an unowned pair running after restart.

## Test Strategy

### Domain

- canonical attempt, side-result, and outcome digests;
- total nested runtime predicates and cross-field outcome rules;
- baseline evaluation reconstruction equals the pair's frozen original digest;
- allowed running/stopped zero-evidence transitions and forbidden observation/account/score drift.

### LocalStore

- exact attempt/result/outcome append, reload, semantic replay, and corruption rejection;
- first-attempt inert closure, retry sequence/limit, open-attempt conflict, and latest-outcome rules;
- context-free bound writers remain rejected;
- exact context permits only start/stop transitions for its bound role;
- observation, Ledger, candidate, code, admission, commitment, and promotion writes remain blocked;
- concurrent attempts and side results serialize;
- `both_running`, `stopped_cleanly`, and `cleanup_required` cannot be falsely asserted.

### Session

- fixed first-tick binding, no underlying market read, distinct provider/sandbox identities;
- hard request limit, abort/late-settlement cleanup, and structured status;
- authorized qualification start/stop works only with exact context;
- public/default qualification activate/observe/schedule/stop/recovery guards remain closed.

### Coordinator

- both start calls begin in parallel only after durable attempt append;
- symmetric success within skew produces `both_running`;
- all single/double failure, timeout, late success, skew, elapsed, request-budget, result-write, and
  cleanup combinations produce only valid outcomes;
- no automatic retry; retry bounds and exact replay hold;
- restart with absent, running, partial, and uncertain state stops both or remains cleanup-required;
- real LocalStore plus session integration starts and then cleans two qualification sides without
  observation, Ledger, score, or underlying market reads.

### Repository

Run focused tests, full tests, every workspace typecheck, repository guards, and a production import
audit. Confirm no public composition imports the runtime activation coordinator.

## Acceptance Criteria

This frontier is complete when current code and tests prove:

1. one append-only attempt exists before any external start effect;
2. both sides start in parallel from the exact authorization and same first-tick view;
3. `both_running` is impossible unless side identity, current state, time, skew, and request bounds
   all pass;
4. every partial, failed, timed-out, late, or policy-invalid start triggers bounded both-side
   reconciliation and cannot enable evidence;
5. retry is possible only after durable `stopped_cleanly` and within the frozen retry count;
6. restart conservatively stops both or leaves durable `cleanup_required`;
7. current side records can transition only through exact authority-aware Store validation while
   immutable baseline identity remains reconstructible;
8. no observation, Ledger, economic score, verdict, promotion, private/live authority, or public
   control is created;
9. existing qualification session guards remain closed;
10. full validation and authority audit pass.

## Next Frontier

After symmetric runtime activation is proven, a separate paired-checkpoint frontier may add one
advanceable shared market view, contiguous later ticks, candidate-owned decision cadence, and
atomic pair checkpoint records. It must claim a `both_running` attempt, enforce continuous request
and elapsed budgets, record no-order continuity, and leave adjudication, evidence release, verdict,
confirmation, and promotion closed.
