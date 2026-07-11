# Paper Comparison Symmetric Runtime Activation Implementation Record

**Date:** 2026-07-11
**Status:** Implemented and verified
**Design commit:** `b76084c`
**Plan commit:** `7354982`
**Implementation commit:** `c3034d1`
**Design SHA-256:** `a2faf01c11d61314c39dcc9c0d0b4090d09605786c7e30fe9577e9f94ad9d0c3`

This page is the compact historical implementation record. Active behavior is owned by source and
tests. Product meaning is owned by [Paper Comparison Symmetric Runtime Activation
Design](../specs/2026-07-11-paper-comparison-symmetric-runtime-activation-design.md), [Prospective
Paper Comparison Design](../specs/2026-07-10-prospective-paper-comparison-design.md), and
[CandidateArena Evaluation Protocol](../../candidate-arena-evaluation-protocol.md).

## Goal

Consume one exact `PaperTradingComparisonActivation` through a durable, bounded, recoverable state
machine that starts both qualification sides in parallel against the same fixed first tick and can
claim only `both_running`, `stopped_cleanly`, or `cleanup_required`, without creating observations,
Ledger evidence, economic outcomes, verdicts, promotion, or public authority.

## Implemented Boundary

The frontier implements:

- canonical append-only activation attempt, per-side result, and sequenced outcome records;
- exact immutable-baseline reconstruction after current run/evaluation state moves to running or
  stopped;
- LocalStore append/reload/digest/sequence/semantic validation under the comparison-evidence queue;
- an exact activation/attempt/role/operation runtime-write context on only sandbox start/stop,
  run-control start/stop, and zero-evidence evaluation running/stopped transitions;
- context-free rejection for every pair-bound mutation and continued rejection of observation,
  Ledger, candidate, CandidateVersion, SystemCode, admission, commitment, and promotion writes;
- a focused internal comparison session port that reloads the complete side identity, verifies the
  frozen executable and first-tick view, starts no scheduler, and reports structured status;
- a hard API request cap enforced before market, account, or order handlers, with total request
  count retained independently of bounded logs and scoped by activation attempt plus role;
- transient sandbox cleanup when abort or Store rejection occurs after an adapter start;
- durable attempt-before-effect ordering, parallel side start, exact idempotency, start deadline,
  elapsed, sandbox skew, provider-request, and current-state checks;
- symmetric cleanup for partial, failed, malformed, late, timed-out, policy-invalid, result-write,
  and outcome-write paths;
- conservative restart recovery that never resumes a side or claims a process-local provider
  survived, and instead stops both or leaves `cleanup_required`;
- real LocalStore plus real session integration from inert pair through `both_running`, simulated
  process restart, and sequenced `stopped_cleanly` recovery.

The frontier does not implement:

- a paper observation, TradingSystem decision consumption, Ledger chain, account/score mutation, or
  economic evidence;
- an advanceable shared market view, later tick, atomic paired checkpoint, or no-order continuity;
- qualification adjudication, comparability, superiority, confirmation, evidence release, verdict,
  TradingPromotion, or live authority;
- a public command, runtime route, operator read-model mutation, CLI action, TUI action, Web control,
  or Desktop control;
- peer evidence exposure, private exchange access, credentials, signed requests, or direct orders;
- automatic retry or retention of an unowned `both_running` pair after restart.

`both_running` is zero-observation operational evidence only. It is not a paired checkpoint,
qualification result, comparison verdict, or promotion.

## Invariants

1. Attempt intent is append-only and durable before any provider or sandbox start.
2. Both starts are in flight together and receive the same immutable first-tick view.
3. Session and Store independently reload activation, attempt, side, executable, commitment,
   evaluation, run, baseline, and current state before authority-bearing transitions.
4. Runtime context is writer-specific and cannot authorize observations, Ledger, economic state, or
   immutable graph drift.
5. API requests after the frozen side budget fail before handler effects.
6. `both_running` requires exact side identity, two succeeded start results, running sandbox/run/
   evaluation state, deadline, elapsed, skew, request, and current-inspection checks.
7. Timeout remains uncertain even when an immediate inspect is inactive; late settlement remains
   observed and cannot become `both_running`.
8. Every invalid start reconciles both sides and can end only stopped-cleanly or cleanup-required.
9. Side-result or cleanup uncertainty blocks retry; automatic retry does not exist.
10. Explicit retry is admitted only after a prior stopped-cleanly outcome, advances sequence/retry
    index, and uses a server-owned time strictly after the prior terminal outcome.
11. Restart treats both-running, outcome-less, and cleanup-required attempts as unowned and never
    reconstructs a process-local provider session.
12. Public/default qualification activate, observe, schedule, stop, and recovery remain closed.
13. No production composition imports the runtime activation coordinator.
14. Live, private, credential, order-submission, verdict, promotion, and public authority remain
    closed in every new record and result.

## Commit Ledger

### `42bcb43` - Runtime activation domain state

- Added canonical attempt, side-result, outcome, runtime context, digests, total predicates, and
  immutable baseline reconstruction.

### `69c4a3e` - Append-only lifecycle persistence

- Added StorePort and LocalStore attempt/result/outcome operations, first-attempt and retry
  admission, sequence chains, semantic reconciliation, corruption rejection, and concurrency guards.

### `8675f0f` - Bound runtime transition authority

- Added exact optional context to only the six bound start/stop Store transitions.
- Preserved context-free rejection and all observation/Ledger/immutable/promotion guards.

### `c3034d1` - Session, coordinator, recovery, and durable truth

- Added the focused session port, hard API request cap, transient cleanup, parallel coordinator,
  conservative recovery, and real integration.

## Evidence

Focused verification passed on the committed implementation:

```text
Domain tests: 216 passed
LocalStore tests: 243 passed
Runtime/session/comparison focused regression: 157 passed
Application, LocalStore, and domain typechecks: passed
Docs, naming, architecture, and diff checks: passed
Real LocalStore/session start plus restart cleanup integration: passed
Full repository suite: 89/89 test files, 1218/1218 tests passed
```

For historical context, an earlier restricted full-suite run before the final two focused
ownership/cleanup cases completed with environment-only socket failures:

```text
81/89 test files passed
1184/1215 tests passed
31 failures: localhost listen EPERM or tsx IPC listen EPERM
```

No coordinator, Store, session, domain, naming, architecture, or docs failure appeared. The
subsequent permission-enabled run exercised the localhost and `tsx` IPC paths and passed all 89
files and 1218 tests.

## Authority Audit

- Production import search finds the new coordinator only in its own uncomposed application module.
- The implementation imports no runtime server, command controller, operator surface, CLI, TUI,
  Web, or Desktop composition.
- The coordinator calls no observation or Ledger writer and creates no score, account, verdict,
  qualification, confirmation, promotion, private, credential, direct-order, or live record.
- Real integration leaves both observation lists empty before and after restart cleanup.
- Existing public qualification session guards and recovery skip behavior remain covered and pass.

## Review Decision

**Decision:** keep the implementation and do not compose it publicly. The implementation commit and
full-suite evidence satisfy this frontier's verification contract; broader branch promotion remains
outside this record.

The state machine closes the non-atomic start/crash gap without claiming economic evidence. It is a
necessary operational precondition for a prospective controlled comparison, not proof that either
candidate consumed the same opportunity, qualified, or improved the champion.

## Next Frontier

Design one separately claimed first paired checkpoint. It must advance a shared immutable market
view through contiguous later ticks, preserve candidate-owned decision cadence, enforce continuous
elapsed/request budgets, atomically record both side checkpoint results or durable uncertainty, and
record no-order continuity without leaking peer or sealed outcomes. Adjudication, evidence release,
verdict, confirmation, and promotion remain closed after that checkpoint frontier.
