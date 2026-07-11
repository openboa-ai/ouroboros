# Paper Comparison First Tick Implementation Record

**Date:** 2026-07-11
**Status:** Implemented and verified
**Design commit:** `f73371f`
**Plan commit:** `30b4b4b`
**Design SHA-256:** `1328bd5787f2dc90b91776b85dcefad0d44d516196137f97bbbe82433f4d17f2`

This page is the compact historical implementation record. Active behavior is owned by source and
tests. Product meaning is owned by [Paper Comparison First Tick
Design](../specs/2026-07-11-paper-comparison-first-tick-design.md), [Prospective Paper Comparison
Design](../specs/2026-07-10-prospective-paper-comparison-design.md), and [CandidateArena Evaluation
Protocol](../../candidate-arena-evaluation-protocol.md).

## Goal

Persist exactly one eligible Gateway-owned first market checkpoint for a verified inert
champion/challenger pair and expose that exact stored checkpoint through a non-delegating read-only
view, without granting runtime, observation, adjudication, promotion, or public-command authority.

## Implemented Boundary

The frontier implements:

- canonical `PaperTradingComparisonTickRecord`, digest input, and total runtime predicate;
- sequence-1-only, fresh, no-gap, read-only, BTCUSDT market/public-execution eligibility;
- StorePort append/get/list methods and atomic LocalStore persistence under the existing
  comparison-evidence transaction;
- exact pair ref/digest, configuration digest, source time, capture time, and inert-graph checks;
- deterministic first-tick idempotency and alternate/concurrent first-tick exclusion;
- `PaperTradingComparisonTickCoordinator` with one market read and one public-execution read;
- `ComparisonMarketDataView`, which serves clones of one stored tick and retains no Binance read
  delegate;
- explicit REST market source, priority, freshness, WebSocket, fallback, and gap metadata;
- real commitment-coordinator plus LocalStore integration evidence.

The frontier does not implement:

- qualification activation, scheduling, observation, stop, cleanup, or recovery;
- provider or sandbox start;
- later comparison tick sequences or an advanceable market view;
- run-control, Ledger, paper observation, score, account outcome, or side consumption;
- adjudication, verdict, evidence release, confirmation, or promotion;
- a public command, route, operator mutation, CLI action, or UI control;
- private exchange access, credentials, signed requests, or live order authority.

## Invariants

1. The complete pair graph verifies and remains inert before every external market read.
2. The configured `GatewayMarketDataPort` digest equals the frozen pair digest.
3. A new capture performs exactly one market read and one public-execution read.
4. The server assigns capture completion time after both reads return.
5. Source timestamps remain unchanged and cannot be later than capture completion.
6. Only sequence 1 is accepted in this frontier.
7. Market and public-execution evidence is fresh, no-gap, read-only, and fully shaped.
8. Tick content binds the pair ref/digest, configuration digest, exact snapshots, sequence, and
   capture time through canonical SHA-256.
9. LocalStore independently revalidates the complete inert pair under its comparison write queue.
10. An exact retry reloads the graph and configuration but performs no Gateway read.
11. Another first-tick identity fails before a Gateway read.
12. Persisted malformed JSON, shape-valid digest drift, and same-ID content drift fail closed.
13. The fixed view returns independent clones and cannot delegate, advance, synthesize liveness, or
    expose peer/evaluator state.
14. Candidate API conversion continues to omit `expected_direction`.
15. Both side evaluations remain `not_started`; graph activation authority remains `not_granted`.

## Architecture

### Domain

`packages/domain/src/index.ts` owns the tick record, canonical digest input, and strict total
predicate. The predicate requires complete first-tick market metrics, explicit source priority,
freshness, no gaps, read-only nested authority, and `not_live` tick authority.

### Store

`packages/application/src/ports/store.ts` exposes tick append/get/list. `packages/local-store/src/index.ts`
serializes append with all comparison evidence writers, verifies persisted digests on reads, reloads
the exact pair, invokes the existing full inert-graph validator, and atomically writes one first tick.

### Application

`packages/application/src/trading/paper/comparison-tick-coordinator.ts` owns deterministic capture
identity, in-process serialization, pre-read graph/configuration validation, two concurrent Gateway
reads, server capture time, StorePort append, and post-write reload.

`packages/application/src/trading/paper/comparison-market-data-view.ts` copies source identity and one
verified tick. It intentionally stores no source methods. Market and public-execution reads return
clones; liveness fails with `comparison_market_liveness_surface_unavailable`.

### Adapter

`packages/adapters/src/binance/public-market-adapter.ts` now marks successful REST market snapshots
as `binance_production_public_rest`, `rest_fallback`, `fresh`, WebSocket disconnected, fallback used,
and no gap. WebSocket/hybrid paths preserve their actual metadata.

## Commit Ledger

### `b419854` - Domain contract

- Added the tick record, persisted canonical digest input, and strict total predicate.
- Added key-order, evidence-binding, malformed nested record, freshness, gap, source priority,
  symbol, numeric, timestamp, and authority tests.

### `5753fe2` - Atomic persistence

- Added StorePort and LocalStore tick operations.
- Added pair/configuration/time closure, exact replay, conflict, concurrent writer, corrupt
  collection, persisted digest drift, and non-inert graph tests.

### `601c96f` - Capture and fixed view

- Added the fixed non-delegating view and first-tick coordinator.
- Added exact external read-count, zero-write failure, raw symbol/source validation, idempotent retry,
  concurrent capture, malformed StorePort return, and clone isolation tests.
- Added explicit REST metadata and a real inert pair plus LocalStore integration test.

## Evidence

Focused verification passed:

```text
Domain comparison tests: 50 passed
LocalStore plus tick domain tests: 201 passed
View, capture, pair integration, LocalStore, and adapter tests: 280 passed
```

Exact frontier HEAD passed:

```text
npm test
184/184 suites, 1013/1013 tests

npm run typecheck
all workspaces passed

npm run check:repo-guards
docs, architecture, naming, tracked env, secrets, and diff checks passed
```

The full suite requires local loopback and `tsx` IPC socket permission. The reported full result was
collected from the same HEAD with those test-only local sockets enabled.

## Review Decision

**Decision:** keep the implementation and advance to a separate activation-authorization frontier.

The implementation proves that one immutable common input can be captured before outcomes and
served without independent Binance reads. It does not prove either side consumed the input,
produced comparable evidence, qualified, improved the champion, or earned promotion.

No production runtime composition imports the tick coordinator or view. No public command or
qualification session authority changed.

## Next Frontier

Design a durable `PaperTradingComparisonActivation` authorization bound to the exact verified pair
and first tick. It must own symmetric provider/sandbox start, partial-start evidence, authority-aware
cleanup, restart recovery, one shared advanceable view, provider request budgets, and the first
paired checkpoint while leaving verdict and promotion authority closed.
