# Paper Comparison Symmetric Runtime Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every
> behavior change and superpowers:verification-before-completion before each commit. This plan is
> executed under the standing autonomous-goal instruction; do not wait for an approval checkpoint.

**Goal:** Consume one verified `PaperTradingComparisonActivation` through a durable, bounded,
recoverable state machine that starts both qualification sides in parallel against the same fixed
first tick and reaches only `both_running`, `stopped_cleanly`, or `cleanup_required`, without
creating observations, Ledger evidence, economic outcomes, verdicts, promotion, or public authority.

**Architecture:** Add append-only attempt, side-result, and sequenced outcome records in domain;
persist and validate them under LocalStore's comparison-evidence queue; require an exact runtime
write context for every bound start/stop mutation; expose internal comparison-side session methods
behind a focused application port; orchestrate parallel start, policy checks, cleanup, and restart
reconciliation in an uncomposed application coordinator.

**Tech Stack:** TypeScript 5.9, Vitest 4, Node.js `crypto`, AbortController/timers, filesystem-backed
LocalStore, existing fake paper Gateway/API provider, sandbox adapter ports

## Global Constraints

- Design source:
  `docs/superpowers/specs/2026-07-11-paper-comparison-symmetric-runtime-activation-design.md`.
- Design commit: `b76084c`.
- Frozen design SHA-256:
  `a2faf01c11d61314c39dcc9c0d0b4090d09605786c7e30fe9577e9f94ad9d0c3`.
- Attempt intent is durable before any provider, sandbox, runner, session, or lifecycle effect.
- Start calls are parallel and receive one immutable first-tick view; activation performs no
  underlying Binance read.
- Public/default `PaperTradingSessionService.activate`, `observe`, `schedule`, `stop`, and recovery
  keep qualification rejection/skip behavior.
- Context-free pair-bound side writers remain rejected.
- Runtime write context authorizes only exact start/stop transitions for one bound side and one open
  attempt; it never authorizes observation or Ledger writes.
- No automatic retry. Retry requires latest `stopped_cleanly` and must remain within the frozen
  `maximum_retry_count_per_side`.
- Timeout is uncertain state, not proof of failure-with-no-effect. Late settlement remains observed
  and is cleaned up.
- No public command, route, read model, CLI, TUI, Web, Desktop, or runtime composition imports the
  new coordinator in this frontier.
- Every persisted read is shape-checked, digest-checked, total, and fail-closed.

---

## Task 1: Canonical Runtime Activation State Machine

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/paper-trading-comparison-runtime-activation.test.ts`

**Produces:**
- `PaperTradingComparisonActivationAttemptRecord`
- `PaperTradingComparisonActivationSideResultRecord`
- `PaperTradingComparisonActivationOutcomeRecord`
- `PaperTradingComparisonRuntimeWriteContext`
- canonical digest inputs and total runtime predicates for all four contracts
- pure baseline evaluation reconstruction and zero-evidence activation-state predicates

- [ ] **Step 1: Write RED domain tests**

Test canonical key-order-independent digests and every bound field. Table-test malformed refs,
attempt/retry sequence, deadline order, side operation/reason/outcome combinations, time order,
request count, outcome sequence/previous ref, status/reason/next-action compatibility, authority,
and non-canonical nested values without raw exceptions.

Build the exact original evaluation from an immutable qualification commitment plus bound
evaluation ref and assert its persisted full-record digest equals the pair fixture's frozen
evaluation digest. Test allowed `not_started`, zero-evidence `running`, and zero-evidence `stopped`
states. Reject any observation count, score, account, order, processed event/trade, commitment ref,
identity, interval, or authority drift.

- [ ] **Step 2: Confirm RED**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-runtime-activation.test.ts
```

- [ ] **Step 3: Implement minimal contracts and pure functions**

Reuse the persisted canonical comparison serializer. Attempt digest includes attempted/deadline
times. Side-result and outcome digests include all effect/reconciliation fields. Add all persisted
records to `FixtureRecord`; keep runtime context non-record authority input.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-runtime-activation.test.ts packages/domain/src/paper-trading-comparison-activation.test.ts packages/domain/src/paper-trading-comparison-tick.test.ts packages/domain/src/paper-trading-comparison-commitment.test.ts
npm run typecheck -w @ouroboros/domain
git diff --check

git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-runtime-activation.test.ts
git commit -m "feat: define paper comparison runtime activation state"
```

## Task 2: Append-Only Attempt, Side Result, And Outcome Persistence

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Produces:** append/get/list StorePort methods and LocalStore collections for attempts, side
results, and outcomes; first-attempt and retry admission; stable Store errors.

- [ ] **Step 1: Write RED LocalStore lifecycle tests**

Use the real stored pair, first tick, and activation fixture. Assert:

- exact first attempt append/get/list/semantic replay;
- activation/pair/tick/side/policy/time/digest closure and server deadline derivation;
- deterministic sequence/retry index, one open attempt, concurrent alternate exclusion;
- retry blocked without latest `stopped_cleanly`, after `both_running` or `cleanup_required`, and
  beyond the frozen retry count;
- exact side-result append, per-role operation sequence, current-state/result compatibility;
- exact sequenced outcome append and previous-outcome chain;
- false `both_running`, false `stopped_cleanly`, and unsupported transition rejection;
- corrupt JSON, shape-valid digest drift, same-ID drift, and zero mutation on rejection.

- [ ] **Step 2: Confirm RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison runtime activation"
```

- [ ] **Step 3: Implement record persistence under the existing queue**

Add imports, collections, read validators, stable errors, and StorePort methods. Attempt append
revalidates the complete inert graph for sequence 1. Retry append reconstructs and verifies the
baseline plus stopped zero-evidence current state. Side results and outcomes independently reload
all refs and latest state before append.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison"
npm run typecheck -w @ouroboros/local-store
npm run typecheck -w @ouroboros/application
git diff --check

git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist paper comparison activation lifecycle"
```

## Task 3: Authority-Aware Bound Side Transitions

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Produces:** optional `PaperTradingComparisonRuntimeWriteContext` on the exact Store writers used by
internal start/stop, plus writer-specific transition validation.

- [ ] **Step 1: Write RED transition tests**

For one open attempt, prove exact context permits only:

1. sandbox start and bound TradingRun `registered/stopped -> running`;
2. exact start run-control audit;
3. bound zero-evidence evaluation `not_started/stopped -> running`;
4. sandbox stop and TradingRun `running -> stopped`;
5. exact stop run-control audit;
6. bound zero-evidence evaluation `running -> stopped`.

Table-test missing/wrong activation, attempt, digest, role, operation, writer, side, current state,
outcome state, and cross-attempt context. Keep all existing context-free writer rejection tests.
Explicitly prove observation, Ledger, order/execution, candidate, CandidateVersion, SystemCode,
admission, commitment, and promotion mutation remains blocked even when a context object is supplied.

- [ ] **Step 2: Confirm RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "runtime activation write context"
```

- [ ] **Step 3: Implement the smallest writer gate**

Refactor `assertNoPairBoundSideMutation` into context-free rejection plus exact context validation.
Do not add a general bypass flag. Each writer validates its own transition and the reconstructed
baseline. Serialize all affected methods through the existing comparison-evidence queue.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run packages/local-store/test/local-store.test.ts
npm run typecheck -w @ouroboros/local-store
npm run typecheck -w @ouroboros/application
git diff --check

git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: guard paper comparison side transitions"
```

## Task 4: Bounded Internal Comparison Session Port

**Files:**
- Create: `packages/application/src/ports/paper-comparison-session.ts`
- Modify: `packages/application/src/trading/gateway/runtime-binding.ts`
- Modify: `packages/application/src/trading/gateway/runtime-binding.test.ts`
- Modify: `packages/application/src/trading/paper/session-service.ts`
- Modify: `packages/application/src/trading/paper/session-service.test.ts`

**Produces:** `PaperTradingComparisonSessionPort`, hard paper API request cap, and internal
qualification side start/stop/inspect methods.

- [ ] **Step 1: Write RED request-cap tests**

Add `maximum_request_count` to paper API provider options. Prove requests through the committed
count execute and are logged; every later request fails with a stable bounded response before
market/account/order handlers run. Closing still works and request count remains inspectable.

- [ ] **Step 2: Write RED session tests**

Use exact activation attempt context and fixed first-tick view. Prove:

- start independently reloads candidate/run/commitment/evaluation/SystemCode and context;
- fixed view is used for provider startup with zero underlying market reads;
- provider and sandbox identities are run-specific;
- no scheduler or observation starts;
- every Store mutation carries exact context;
- abort before/between effects cleans same-side resources;
- structured status reports current run/evaluation/sandbox and request count;
- stop is bounded and idempotent for running/not-running states;
- public/default qualification activate/observe/schedule/stop/recovery remain rejected/skipped.

- [ ] **Step 3: Implement focused port and internal methods**

Allow `gatewayBinding(marketDataOverride)`, track per-run comparison bindings/provider sessions, pass
request cap into the API provider, and factor existing start/stop mechanics without weakening public
guards. Check `AbortSignal` before and after each external await; late start settlement performs
authorized same-side cleanup.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run packages/application/src/trading/gateway/runtime-binding.test.ts packages/application/src/trading/paper/session-service.test.ts
npm run typecheck -w @ouroboros/application
git diff --check

git add packages/application/src/ports/paper-comparison-session.ts packages/application/src/trading/gateway/runtime-binding.ts packages/application/src/trading/gateway/runtime-binding.test.ts packages/application/src/trading/paper/session-service.ts packages/application/src/trading/paper/session-service.test.ts
git commit -m "feat: start authorized paper comparison sides"
```

## Task 5: Parallel Start And Cleanup Coordinator

**Files:**
- Create: `packages/application/src/trading/paper/comparison-runtime-activation-coordinator.ts`
- Create: `packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts`

**Produces:** deterministic `start`, effect timeout/late-settlement handling, side-result persistence,
policy evaluation, both-side cleanup, and exact idempotency.

- [ ] **Step 1: Write RED coordinator tests with a fake session port**

Cover:

- attempt append completes before either start call;
- both calls are in flight together and receive the same fixed view/tick identity;
- exact success produces `both_running` only within start-time skew, deadline, current-state, and
  request bounds;
- champion-only, challenger-only, double failure, timeout, late success, skew, elapsed, request
  budget, side-result write failure, cleanup failure, and inspect mismatch;
- all invalid starts invoke both-side reconciliation and yield only `stopped_cleanly` or
  `cleanup_required`;
- exact retry does no effect; alternate identity conflicts before effect;
- no automatic retry; concurrent calls admit one attempt;
- malformed StorePort/session values produce stable errors without raw exceptions.

- [ ] **Step 2: Implement start flow**

Use one promise-tail queue, deterministic SHA-256 IDs, shared AbortController deadline, settled
side wrappers that continue observing late completion, and bounded cleanup. Persist only stable
error codes. Build one `ComparisonMarketDataView`; do not retain or call a Binance delegate.

- [ ] **Step 3: Verify and commit**

```bash
npx vitest run packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts packages/application/src/trading/paper/comparison-activation-coordinator.test.ts packages/application/src/trading/paper/comparison-tick-coordinator.test.ts
npm run typecheck -w @ouroboros/application
git diff --check

git add packages/application/src/trading/paper/comparison-runtime-activation-coordinator.ts packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts
git commit -m "feat: coordinate symmetric paper comparison start"
```

## Task 6: Conservative Restart Recovery And Real Integration

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-runtime-activation-coordinator.ts`
- Modify: `packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`
- Modify: `packages/application/src/trading/paper/session-service.test.ts`

**Produces:** `recoverIncompleteActivations` and a real pair -> first tick -> authorization ->
attempt -> two side start -> both-running -> restart cleanup integration.

- [ ] **Step 1: Write RED recovery tests**

For latest outcome absent, `both_running`, and `cleanup_required`, reconstruct a coordinator/session
with no in-memory provider ownership. Inspect and stop both sides, append sequenced stop results, and
append `stopped_cleanly` only after exact inactive state. Any stop/inspect/persistence uncertainty
must leave `cleanup_required`. Never resume or retry automatically.

- [ ] **Step 2: Extend real integration**

Use the real comparison fixture, LocalStore, fixed first tick, effect-free authorization, real
SessionService, fake provider, fake sandbox adapter, and runner. Assert:

- attempt bytes exist before provider/sandbox counters increment;
- both sides start with distinct provider/sandbox identities and the same first-tick view;
- no underlying market read, scheduler, observation, Ledger, score, account, verdict, or promotion;
- public qualification methods remain closed;
- a fresh coordinator/service recovery stops both and records a later `stopped_cleanly` outcome;
- no active provider, sandbox, runner, or running evaluation remains after recovery.

- [ ] **Step 3: Implement recovery and verify**

```bash
npx vitest run packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/application/src/trading/paper/session-service.test.ts packages/local-store/test/local-store.test.ts -t "paper comparison"
npm run typecheck
git diff --check

git add packages/application/src/trading/paper/comparison-runtime-activation-coordinator.ts packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/application/src/trading/paper/session-service.test.ts
git commit -m "feat: recover paper comparison activation"
```

## Task 7: Durable Writeback And Whole-Branch Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: relevant comparison specs and implementation records
- Modify: this plan

- [ ] **Step 1: Update durable truth**

Add Attempt, SideResult, and Outcome vocabulary. Record symmetric start/cleanup/recovery as
implemented only if real integration passes. State explicitly that `both_running` is operational
evidence and not a paired checkpoint, qualification result, verdict, or promotion.

- [ ] **Step 2: Historicalize this plan**

Replace execution detail with goal, implemented/non-goal boundary, invariants, commit ledger, exact
focused/full evidence, authority audit, review decision, and next paired-checkpoint frontier.

- [ ] **Step 3: Run full verification**

```bash
npm test
npm run typecheck
npm run check:repo-guards
```

Use local loopback/IPC permission for the full suite. Record exact test-file/test counts from the
final HEAD.

- [ ] **Step 4: Audit authority and commit**

Confirm no public/runtime composition imports the new coordinator and no observation, Ledger,
verdict, promotion, private/live, or UI path changed. Re-run qualification session guards.

```bash
git add AGENTS.md docs
git commit -m "docs: record symmetric paper comparison activation"
```

## Stop And Reroute Conditions

Stop this frontier and create a new design before continuing if implementation evidence shows any of
the following:

- the immutable baseline cannot be reconstructed exactly from current commitments;
- LocalStore cannot distinguish a valid authority transition from a generic mutation without a
  broad bypass;
- a supported sandbox/provider start cannot be bounded or late-settlement cleanup cannot be observed;
- API request limits cannot be enforced before handler effects;
- successful start requires an observation, Ledger write, later market tick, or public composition;
- restart cannot conservatively prove both sides stopped;
- any proposed change weakens private/live/order authority boundaries.

## Self-Review

- [x] Every external effect has prior durable intent.
- [x] Baseline identity remains independently reconstructible after mutable runtime transition.
- [x] Store context is exact and writer-specific, not a general bypass.
- [x] Parallel start, timeout uncertainty, late settlement, partial cleanup, retry, and restart each
  have explicit durable evidence.
- [x] Public qualification guards remain closed.
- [x] First paired checkpoint, observation, Ledger, economic evidence, verdict, and promotion remain
  outside this frontier.
