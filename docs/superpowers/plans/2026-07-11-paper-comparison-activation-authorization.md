# Paper Comparison Activation Authorization Implementation Record

**Date:** 2026-07-11
**Status:** Implemented and verified
**Design commit:** `6962b02`
**Plan commit:** `896f3d4`
**Design SHA-256:** `127fbd2b36cd120da51e0291b0f7b890fd34674e2e2fdb367ccbdfb05bcc3a2e`

This page is the compact historical implementation record. Active behavior is owned by source and
tests. Product meaning is owned by [Paper Comparison Activation Authorization
Design](../specs/2026-07-11-paper-comparison-activation-authorization-design.md), [Prospective Paper
Comparison Design](../specs/2026-07-10-prospective-paper-comparison-design.md), and [CandidateArena
Evaluation Protocol](../../candidate-arena-evaluation-protocol.md).

## Goal

Persist exactly one paper-only activation authorization that binds a verified inert comparison, its
sole first tick, both exact side runtime refs, and one bounded derived policy without starting,
scheduling, observing, stopping, or recovering either side.

## Implemented Boundary

The frontier implements:

- canonical `PaperTradingComparisonActivationSide`, policy, and append-only record contracts;
- one policy builder that copies only frozen pair start-skew, retry, and provider-request bounds and
  adds fixed activation, cleanup, both-running, partial-start, restart, and market-view rules;
- canonical digest input that binds pair/tick digests, side refs, market configuration, policy,
  scope, status, and closed authority while excluding record metadata, ID, server time, and digest;
- strict total side, policy, and record runtime predicates;
- StorePort append/get/list operations and LocalStore persistence under the existing comparison
  evidence transaction;
- exact pair digest, sole first-tick digest/ref, configuration, side-ref, derived-policy, time, and
  complete inert-graph closure validation;
- exact semantic replay, same-ID drift rejection, one authorization per comparison, concurrent
  alternate exclusion, corrupt JSON rejection, and persisted digest verification;
- deterministic `PaperTradingComparisonActivationCoordinator.authorize` identity, one in-process
  promise-tail queue, server-owned time, pre/post graph and tick reload, and post-write semantic
  verification;
- real pair, first-tick, LocalStore, and authorization integration with explicit
  `runtimeEffects: "not_started"`.

The frontier does not implement:

- provider, sandbox, runner, TradingSystem, or paper-session start/stop/recovery effects;
- activation attempt, started-side, cleanup, completion, or recovery outcome records;
- an advanceable shared market view, later tick, side checkpoint, or paired observation;
- run-control, Ledger, score, account outcome, evidence release, verdict, confirmation, or promotion;
- a public command, route, read-model mutation, CLI action, TUI action, Web control, or Desktop control;
- ResearchWorker access to active comparison identity, peer evidence, or authorization;
- private exchange access, credentials, signed requests, direct order submission, or live authority.

## Invariants

1. Caller input contains only comparison ID and idempotency key.
2. The complete comparison graph reloads as verified and still reports
   `activation_authority: "not_granted"`.
3. Exactly one self-digested first tick exists and still binds the pair, configuration, source
   timestamps, and capture time.
4. Champion and challenger run, evaluation-commitment, and evaluation refs come only from the
   verified pair and remain distinct.
5. Activation policy comes only from the frozen comparison policy; caller overrides are impossible.
6. Server authorization time is exact ISO and cannot precede the first tick.
7. LocalStore independently repeats all closure checks under the shared comparison write queue.
8. One exact authorization exists per comparison; same-ID drift and alternate IDs fail closed.
9. Every persisted activation read checks runtime shape and canonical SHA-256.
10. Exact application retry revalidates graph, tick, and collection without reading server time or
    writing again.
11. Authorization status is `authorized`, scope is `qualification_pair`, and all live, order,
    private, credential, and record authority fields remain closed.
12. Both side evaluations remain `not_started`; no runtime or economic evidence is created.

## Commit Ledger

### `a9a1d32` - Domain authorization contract

- Added activation side, bounded policy, and record types.
- Added sole policy derivation, canonical digest input, total predicates, and malformed nested-value
  tests.

### `2af5995` - Atomic authorization persistence

- Added StorePort and LocalStore activation append/get/list operations.
- Added pair/tick/side/policy/time/inert closure, byte-invariance, semantic replay, concurrent
  conflict, corrupt collection, and persisted digest-drift tests.

### `90b129b` - Effect-free authorization use case

- Added deterministic internal authorization coordinator with total dependency validation and stable
  application errors.
- Added exact retry, alternate/concurrent identity, malformed StorePort, clock, write-race, and
  post-persistence verification tests.
- Extended the real comparison integration through prepare, first tick, and authorization while
  proving inactive runners, `not_started` evaluations, and unchanged effect counters.

## Evidence

Focused verification passed:

```text
Domain comparison tests: 79 passed
LocalStore tests: 197 passed
Application comparison coordinator tests: 104 passed
Qualification session guards: 8 passed, 15 filtered out
```

Exact code HEAD passed:

```text
npm test
86/86 test files, 1077/1077 tests

npm run typecheck
all workspaces passed

npm run check:repo-guards
docs, architecture, naming, tracked env, secrets, and diff checks passed
```

The full suite requires local loopback and `tsx` IPC socket permission. The reported result was
collected from the same code HEAD with those test-only local sockets enabled.

## Review Decision

**Decision:** keep the implementation and advance to a separate symmetric runtime-activation
frontier.

The record creates a durable paper-only activation precondition and closes the crash gap between first
tick capture and future external effects. It is not runtime evidence: no side started, consumed a
tick, emitted an order decision, accrued revenue or cost, qualified, beat the champion, or earned
promotion.

The production diff adds only domain contracts, StorePort/LocalStore persistence, and an uncomposed
internal application coordinator. No session lifecycle, provider, sandbox, runner, market adapter,
Gateway, Ledger, observation, command, route, operator, verdict, promotion, or UI implementation
changed. Existing qualification session guards remain closed.

## Next Frontier

Design and implement a recoverable symmetric runtime activation protocol that consumes this exact
authorization. It must record append-only attempt and per-side start outcome evidence, revalidate
authority immediately before each external effect, start both sides against one shared advanceable
view within the frozen skew/request/time budgets, stop a partially started side before retry, and
recover both-or-neither after restart. The first paired checkpoint, later contiguous ticks,
adjudication, evidence release, verdict, confirmation, and promotion remain separately closed.
