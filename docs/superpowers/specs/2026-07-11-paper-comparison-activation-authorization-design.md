# Paper Comparison Activation Authorization Design

**Date:** 2026-07-11
**Status:** Approved by the standing autonomous-goal instruction; implementation pending
**Scope:** CandidateArena P0, durable paper-only activation authorization without runtime effects
**Depends on:** Verified inert comparison graph and one verified first comparison tick

## Goal

Persist one append-only, narrowly scoped authorization that records exactly when and under which
bounded policy a verified champion/challenger qualification pair may later be started. Creating the
authorization must not start, schedule, observe, stop, or recover either side and must not weaken the
current `PaperTradingSessionService` rejection of qualification activation.

This frontier separates market evidence from execution authority. A first tick says one common
future input exists. A `PaperTradingComparisonActivation` says a later internal coordinator may use
that exact pair and tick under one frozen paper-only start/cleanup/recovery policy. Neither record
proves that a runtime started or consumed evidence.

## Context

The current repository can:

- freeze and verify two admitted, distinct qualification side graphs;
- persist one eligible, shared, self-digested first market/public-execution tick;
- serve that tick through a fixed market-data view with no Binance delegate.

The current session service intentionally rejects qualification `activate`, `stop`, and recovery.
Starting two external provider/sandbox sessions is not atomic, so runtime work must not infer
authority directly from the pair or first tick. It needs a durable record that freezes start-skew,
retry, request-budget, partial-start cleanup, and restart semantics before any effect occurs.

## Approaches Considered

### Separate append-only activation authorization

Selected. A new record binds the exact pair and first tick, both side runtime refs, a derived bounded
activation policy, server authorization time, paper-only scope, and no-live authority. Store and
application independently verify the complete closure. Runtime consumers remain absent.

### Treat the first tick as activation authority

Rejected. A market checkpoint is evidence, not a capability. Combining those meanings would make
it impossible to distinguish "common input captured" from "external start allowed" during audit,
cleanup, recovery, or future policy replacement.

### Issue an in-memory capability only

Rejected. An ephemeral token disappears on restart and cannot prove which pair, tick, side refs, or
failure policy was authorized. Reconstructing it from mutable current state would violate the
precommitment and recoverability goals.

## Vocabulary

### PaperTradingComparisonActivation

`PaperTradingComparisonActivation` is the canonical persisted authorization noun. Its initial
record has `activation_status: "authorized"`; this does not mean either side started. Later runtime
work should use separate append-only activation-attempt and outcome evidence rather than mutating
the authorization record.

The concept axes remain fields:

- domain: one paper comparison;
- lifecycle: authorized, with future attempts/outcomes separate;
- authority: qualification pair only, `not_live`;
- provenance: exact comparison and first tick;
- policy: bounded start, cleanup, retry, request, and recovery rules;
- audience: internal application/store only.

No compatibility alias or migration is required. Avoid extending names such as `activationToken`,
`startGrant`, or `runtimePermit`; they hide persisted lineage or conflate an ephemeral object with
durable authority.

## Owned Boundary

This frontier owns:

- `PaperTradingComparisonActivationSide`, policy, and activation record domain contracts;
- canonical activation digest input and total runtime predicates;
- one domain function that derives the exact activation policy from comparison policy;
- StorePort append/get/list operations;
- LocalStore append-only authorization under the comparison-evidence transaction;
- exact pair, first-tick, side-ref, policy, timestamp, and inert-state closure validation;
- an internal authorization coordinator with deterministic idempotency and no effectful dependency;
- focused tests and durable taxonomy/protocol writeback.

## Non-Goals

This frontier does not:

- call `PaperTradingSessionService.activate`, `observe`, `schedule`, `stop`, or recovery;
- create or stop a provider, sandbox, runner, TradingSystem, or market view;
- change a TradingRun, evaluation, observation, run-control, Ledger, sandbox, or account record;
- make the fixed first-tick view advanceable;
- capture a later tick or paired checkpoint;
- add activation attempt, started-side, cleanup, completion, or recovery outcome records;
- add a public command, route, read-model mutation, CLI action, or UI control;
- expose active comparison identity, tick content, or authorization to a ResearchWorker;
- adjudicate, release evidence, confirm, or promote;
- grant private exchange, credential, signed request, or live order authority.

## Domain Contracts

```ts
interface PaperTradingComparisonActivationSide {
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  paper_trading_evaluation_commitment_ref: Ref;
  paper_trading_evaluation_ref: Ref;
}

interface PaperTradingComparisonActivationPolicy {
  policy_version: "paper-comparison-activation-v1";
  maximum_start_skew_ms: number;
  maximum_retry_count_per_side: number;
  maximum_provider_request_count_per_side: number;
  maximum_activation_elapsed_ms: 60_000;
  cleanup_timeout_ms: 10_000;
  require_both_running_before_observation: true;
  partial_start_policy: "stop_started_side_before_retry";
  restart_policy: "recover_both_or_stop_both";
  market_view_policy: "first_tick_then_contiguous_persisted_ticks";
}

interface PaperTradingComparisonActivationRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_activation";
  paper_trading_comparison_activation_id: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  first_tick_ref: Ref;
  first_tick_digest: string;
  champion: PaperTradingComparisonActivationSide;
  challenger: PaperTradingComparisonActivationSide;
  market_data_configuration_digest: string;
  activation_policy: PaperTradingComparisonActivationPolicy;
  activation_scope: "qualification_pair";
  activation_status: "authorized";
  authorized_at: string;
  activation_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  private_exchange_access: "forbidden";
  credentials_access: "forbidden";
  authority_status: "not_live";
}
```

`paperTradingComparisonActivationPolicyFor(comparisonPolicy)` is the sole policy builder. It copies
the precommitted start skew, retry count, and provider request count, then adds the versioned fixed
60-second activation bound, 10-second cleanup bound, both-running gate, partial-start cleanup,
restart, and market-view policies above. Caller input cannot override any field.

The canonical activation digest excludes record kind, version, activation ID, `authorized_at`, and
`activation_digest`. It includes the exact pair/tick closure, side refs, configuration digest,
policy, scope, status, and no-authority fields. Authorization time is separately server-owned and
append-only, matching the existing comparison commitment pattern.

## Authorization Closure

An authorization is valid only when:

1. the exact comparison graph reloads through `PaperTradingComparisonCoordinator` as verified and
   still reports `activation_authority: "not_granted"`;
2. exactly one first tick exists for that comparison;
3. the tick has valid runtime shape and canonical digest;
4. tick pair ref/digest and market-data configuration digest equal the comparison;
5. tick capture time is at or after comparison commitment and source timestamps;
6. both side TradingRun, evaluation commitment, and evaluation refs equal the pair record;
7. both side commitments/evaluations remain the exact inert qualification baselines;
8. no paper observation, Ledger, run-control, sandbox, provider, runner, or lifecycle effect exists;
9. activation policy is exactly derived from comparison policy;
10. server-owned `authorized_at` is at or after the first tick capture time;
11. authority remains paper qualification pair only with no live, private, credential, or direct
    order-submission capability.

The existing comparison graph validator already owns items 6-8. Store authorization append invokes
that validator again inside the same comparison-evidence transaction rather than duplicating a
weaker inert check.

## Store Contract

```ts
recordPaperTradingComparisonActivation(
  activation: PaperTradingComparisonActivationRecord
): Promise<PaperTradingComparisonActivationRecord>;

getPaperTradingComparisonActivation(
  activationId: string
): Promise<PaperTradingComparisonActivationRecord | undefined>;

listPaperTradingComparisonActivations(
  comparisonId: string
): Promise<PaperTradingComparisonActivationRecord[]>;
```

LocalStore independently validates runtime shape, canonical SHA-256, exact pair/tick refs and
digests, sole first tick, derived policy, timestamp closure, and full inert pair graph. It permits
one exact authorization per comparison. Exact replay returns the stored record; same-ID drift or a
second authorization ID fails before any write.

Reads validate shape and digest and map corrupt JSON or shape-valid digest drift to stable activation
reload errors. Append is serialized with pair, tick, side, and frozen authority writers by the
existing comparison-evidence queue.

## Authorization Coordinator

```ts
interface PaperTradingComparisonActivationCoordinatorOptions {
  store: OuroborosStorePort;
  comparisons: Pick<PaperTradingComparisonCoordinator, "reload">;
  now?: () => string;
}

authorize(input: {
  comparisonId: string;
  idempotencyKey: string;
}): Promise<{
  comparison: VerifiedPaperTradingComparisonCommitmentGraph;
  firstTick: PaperTradingComparisonTickRecord;
  activation: PaperTradingComparisonActivationRecord;
  runtimeEffects: "not_started";
}>;
```

The coordinator has one non-reentrant authorization queue for the current single-process LocalStore
composition. It derives a collision-resistant activation ID from comparison ID plus idempotency key.

Operation order is fixed:

1. validate non-empty IDs and load any deterministic existing authorization;
2. reload the complete verified inert comparison graph;
3. load and validate exactly one first tick;
4. if an existing authorization is exact, revalidate the complete closure and return it;
5. reject another authorization ID before calling server time or Store append;
6. derive side bindings and policy only from verified records;
7. assign server-owned authorization time and require it not precede the tick;
8. compute canonical activation digest and append through StorePort;
9. reload the exact authorization, graph, and tick and verify persisted semantic equality;
10. return `runtimeEffects: "not_started"`.

The coordinator has no market, session, provider, sandbox, runner, Gateway order, Ledger,
observation, promotion, or public adapter dependency.

## Error Model

Stable application errors cover invalid input, missing/invalid graph, missing/invalid or non-sole
first tick, idempotency conflict, existing authorization conflict, invalid server time, and
persistence failure. Stable Store errors distinguish invalid shape, digest mismatch, corrupt reload,
missing/mismatched pair or tick, policy mismatch, timestamp mismatch, non-inert graph, append-only
conflict, and second authorization conflict.

Errors contain only stable reason codes and record IDs. They do not contain snapshots, provider
configuration, URLs, candidate output, peer evidence, secrets, private data, or credentials.

## Test Strategy

### Domain

- canonical activation digest and policy derivation;
- key-order independence and every bound evidence field;
- strict side/policy/record runtime shape;
- malformed nested refs, policy values, status, scope, time, and authority return false without
  throwing.

### LocalStore

- exact append/get/list/replay;
- pair, tick, side, configuration, policy, time, and digest mismatch rejection;
- missing, alternate, malformed, stale, or non-sole first tick rejection;
- same-ID drift, alternate authorization ID, concurrent writes, corrupt JSON, and persisted digest
  drift rejection;
- pair mutation racing authorization append is serialized and cannot create authority from a
  non-inert graph;
- zero mutation to side, runtime, observation, Ledger, run-control, or sandbox collections.

### Application

- exact authorization from real verified pair plus first tick;
- caller cannot supply policy, side refs, tick ID, or authorization time;
- exact retry revalidates graph/tick and does no write;
- missing/alternate/corrupt tick and graph/configuration drift fail before server time/write;
- concurrent alternate authorization produces one record;
- persisted JSON omission is compared semantically;
- malformed StorePort records fail closed without raw `TypeError`;
- dependency surface has no effectful runtime methods;
- returned graph remains `not_granted` and runtime effects remain `not_started`.

### Repository

Run focused tests, full tests, typechecks, and repository guards. Review source imports and branch
diff to confirm no runtime composition, public command, session lifecycle, observation, Ledger,
verdict, or promotion path changed.

## Acceptance Criteria

This frontier is complete when current code and tests prove:

1. one verified inert pair plus its sole first tick can produce exactly one durable activation
   authorization;
2. the record binds exact pair/tick digests, side refs, market configuration, derived bounded
   policy, server time, and no-authority scope;
3. exact replay revalidates all closure evidence and creates no duplicate;
4. drift, corruption, missing evidence, alternate identity, time reversal, policy override, and
   concurrent writes fail closed;
5. both side evaluations remain `not_started` and no runtime/evidence collection changes;
6. session service still rejects qualification activation, stop, and recovery;
7. no public or ResearchWorker surface can create or inspect the authorization;
8. full validation passes.

## Next Frontier

A separate runtime design may consume this authorization to create append-only activation attempt
and outcome evidence, start both sides against one shared advanceable view, stop a partially started
side before retry, and recover both-or-neither after restart. It must independently revalidate this
authorization immediately before each effect and still leave paired observation, verdict, evidence
release, and promotion authority closed until their own frontiers.
