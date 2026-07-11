# Paper Comparison First Tick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist exactly one eligible first `PaperTradingComparisonTick` for a verified inert pair
and expose its exact stored snapshots through a non-delegating `ComparisonMarketDataView`.

**Architecture:** Add a strict self-digested tick record in domain and StorePort, append it under the
existing LocalStore comparison-evidence transaction, and capture it through a focused coordinator
that verifies the inert pair before performing one Gateway market read and one public-execution
read. Keep provider, sandbox, runner, observation, verdict, promotion, and public-command authority
closed.

**Tech Stack:** TypeScript 5.9, Vitest 4, Node.js `crypto`, filesystem-backed LocalStore,
`GatewayMarketDataPort`

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-11-paper-comparison-first-tick-design.md`.
- Frozen design SHA-256: `1328bd5787f2dc90b91776b85dcefad0d44d516196137f97bbbe82433f4d17f2`.
- This plan captures only `sequence: 1`; later sequences require a separate activation/tick plan.
- Tick capture is internal and grants no qualification activation authority.
- Existing pair-bound side and incumbent-evidence writer exclusions remain unchanged.
- Existing public paper commands remain default-run `research_feedback` only.
- Candidate-visible market responses continue to omit `expected_direction`.
- No private exchange access, credentials, signed requests, or live order authority is added.
- Every record read from disk must be shape-checked and fail closed rather than throw a raw
  `TypeError`.

---

## File Map

- Modify `packages/domain/src/index.ts`: add the tick record, digest input, and total shape predicate.
- Create `packages/domain/src/paper-trading-comparison-tick.test.ts`: own domain tick contract tests.
- Modify `packages/application/src/ports/store.ts`: add comparison tick append/get/list methods.
- Modify `packages/local-store/src/index.ts`: persist and validate the first tick in the existing
  comparison transaction.
- Modify `packages/local-store/test/local-store.test.ts`: prove append-only, graph, corruption, and
  concurrency behavior using the existing stored comparison fixture.
- Create `packages/application/src/trading/paper/comparison-market-data-view.ts`: serve one verified
  stored tick without a delegate.
- Create `packages/application/src/trading/paper/comparison-market-data-view.test.ts`: prove fixed,
  cloned, non-delegating reads.
- Create `packages/application/src/trading/paper/comparison-tick-coordinator.ts`: own idempotent first
  capture and post-write verification.
- Create `packages/application/src/trading/paper/comparison-tick-coordinator.test.ts`: prove read
  counts, ordering, eligibility, and zero runtime effects.
- Modify `packages/adapters/src/binance/public-market-adapter.ts` and
  `apps/runtime/test/binance-public-market-adapter.test.ts`: make successful REST market provenance
  explicit.
- Modify `AGENTS.md`, `docs/naming-taxonomy.md`,
  `docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md`, and
  `docs/candidate-arena-evaluation-protocol.md`: record the implemented boundary and remaining gaps.

### Task 1: Canonical First-Tick Domain Contract

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/paper-trading-comparison-tick.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonTickRecord`.
- Produces: `paperTradingComparisonTickDigestInput(record): string`.
- Produces: `paperTradingComparisonTickHasRuntimeShape(value): value is PaperTradingComparisonTickRecord`.
- Preserves: all existing commitment/preparation digest encoders and predicates unchanged.

- [ ] **Step 1: Write failing canonical and total-predicate tests**

Use one valid record fixture with all required market metrics and fresh public execution evidence:

```ts
const validTick: PaperTradingComparisonTickRecord = {
  record_kind: "paper_trading_comparison_tick",
  version: 1,
  paper_trading_comparison_tick_id: "paper-comparison-tick-001",
  paper_trading_comparison_commitment_ref: {
    record_kind: "paper_trading_comparison_commitment",
    id: "paper-comparison-001"
  },
  paper_trading_comparison_commitment_digest: "sha256:comparison",
  sequence: 1,
  market_data_configuration_digest: "sha256:market",
  market_snapshot: {
    symbol: "BTCUSDT",
    price: 60000,
    moving_average_fast: 60100,
    moving_average_slow: 59900,
    volatility: 0.01,
    expected_direction: "long",
    observed_at: "2026-07-11T00:00:00.000Z",
    source_kind: "binance_production_public_rest",
    source_priority: "rest_fallback",
    freshness: "fresh",
    ws_connected: false,
    rest_fallback_used: true,
    gap_detected: false,
    authority_status: "read_only"
  },
  public_execution_snapshot: {
    symbol: "BTCUSDT",
    observed_at: "2026-07-11T00:00:00.000Z",
    source_kind: "binance_production_public_rest",
    source_priority: "rest_fallback",
    freshness: "fresh",
    ws_connected: false,
    rest_fallback_used: true,
    gap_detected: false,
    stream_marker: "public-execution-001",
    agg_trades: [],
    authority_status: "read_only"
  },
  observed_at: "2026-07-11T00:00:01.000Z",
  tick_digest: "sha256:tick",
  authority_status: "not_live"
};
```

Assert reordered object keys produce the same digest input; bound snapshot, pair digest,
configuration digest, sequence, or time changes alter it. Use table tests that reject sequence 0/2,
wrong symbol, non-positive price/averages, negative volatility, missing direction, stale/unavailable
freshness, reported gaps, malformed ticker/trades/order book, non-ISO timestamps, and non-read-only
or live authority. Every malformed value must return false without throwing.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-tick.test.ts
```

Expected: fail because the tick exports do not exist.

- [ ] **Step 3: Implement the minimal domain contract**

Add the exact record shape from the design. Build the digest from canonical comparison JSON after
excluding `record_kind`, `version`, `paper_trading_comparison_tick_id`, and `tick_digest`. Reuse the
existing private nested market/public validators, but apply stricter first-tick checks for required
metrics, freshness, gaps, sequence, and authority.

- [ ] **Step 4: Run focused domain and existing comparison tests**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-tick.test.ts packages/domain/src/paper-trading-comparison-commitment.test.ts
npm run typecheck -w @ouroboros/domain
```

Expected: all pass.

- [ ] **Step 5: Commit the domain contract**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-tick.test.ts
git commit -m "feat: define paper comparison first tick"
```

### Task 2: Atomic LocalStore First-Tick Persistence

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Consumes: Task 1 tick type, digest input, and total predicate.
- Produces: `recordPaperTradingComparisonTick`, `getPaperTradingComparisonTick`, and
  `listPaperTradingComparisonTicks` on `OuroborosStorePort` and `LocalStore`.
- Produces stable LocalStore errors for invalid input, digest mismatch, append conflict, corrupt
  collection, missing/mismatched pair, and first-tick conflict.

- [ ] **Step 1: Write failing StorePort/LocalStore tests**

Extend the existing `storedComparisonFixture(store)` path. After recording its comparison, create a
valid tick whose pair/configuration digests come from the fixture and whose digest is computed with
Task 1's encoder. Assert:

```ts
await expect(store.recordPaperTradingComparisonTick(tick)).resolves.toEqual(tick);
await expect(store.getPaperTradingComparisonTick(tick.paper_trading_comparison_tick_id))
  .resolves.toEqual(tick);
await expect(store.listPaperTradingComparisonTicks(
  tick.paper_trading_comparison_commitment_ref.id
)).resolves.toEqual([tick]);
```

Add negative tests for shape/digest/ref/pair digest/configuration/time drift, missing or non-inert
pair, alternate sequence-1 ID, same-ID content drift, corrupt collection JSON, and two concurrent
first-tick appends. The concurrent case must produce one fulfilled write and one typed conflict.

- [ ] **Step 2: Run the focused LocalStore tests and confirm RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison tick"
```

Expected: fail because tick StorePort methods do not exist.

- [ ] **Step 3: Implement StorePort and LocalStore persistence**

Add the three exact methods from the design. Add `paper-trading-comparison-ticks` to the collection
union and the tick type to domain fixture unions/imports. Route append through
`withComparisonEvidenceWriteTransaction`, validate canonical SHA-256, reload the exact pair,
invoke existing complete inert graph validation, enforce pair/configuration/time identity and no
prior tick, then use the existing atomic `writeJson` path. Collection reads must validate every
record and map parse/shape failures to tick-specific Store errors.

- [ ] **Step 4: Run Store tests and typechecks**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison"
npm run typecheck -w @ouroboros/local-store
npm run typecheck -w @ouroboros/application
```

Expected: all pass.

- [ ] **Step 5: Commit atomic persistence**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist paper comparison first ticks"
```

### Task 3: Fixed Market View And First-Tick Capture

**Files:**
- Create: `packages/application/src/trading/paper/comparison-market-data-view.ts`
- Create: `packages/application/src/trading/paper/comparison-market-data-view.test.ts`
- Create: `packages/application/src/trading/paper/comparison-tick-coordinator.ts`
- Create: `packages/application/src/trading/paper/comparison-tick-coordinator.test.ts`
- Modify: `packages/adapters/src/binance/public-market-adapter.ts`
- Modify: `apps/runtime/test/binance-public-market-adapter.test.ts`

**Interfaces:**
- Consumes: verified graph reload, Task 2 StorePort methods, `GatewayMarketDataPort`, and
  `paperTradingMarketDataConfigurationDigest`.
- Produces: `ComparisonMarketDataView` implementing `GatewayMarketDataPort` without a delegate.
- Produces: `PaperTradingComparisonTickCoordinator.captureFirstTick` with the exact design signature.
- Produces: `PaperTradingComparisonTickError` with stable application error codes.

- [ ] **Step 1: Write failing fixed-view tests**

Construct the view from a source identity object and valid stored tick. Assert repeated market and
execution reads equal the stored values but are not the same object references. Mutating a returned
object must not change later reads. Assert `readPublicMarketLivenessSurface()` rejects with
`comparison_market_liveness_surface_unavailable`. Use spies that would fail if any source read
method is invoked after construction.

- [ ] **Step 2: Write failing capture-coordinator tests**

Use a minimal in-memory tick StorePort and a `comparisons.reload` stub returning a complete verified
graph. Count Gateway calls. Cover:

- new capture: one market and one public-execution read, one stored tick, server completion time;
- exact retry: zero additional Gateway reads, with graph/configuration revalidation;
- alternate first tick: rejection before Gateway reads;
- missing/corrupt/non-inert graph and configuration drift: rejection before reads;
- one read failing: no persisted tick;
- stale, gapped, malformed, or wrong-symbol evidence: no persisted tick;
- concurrent calls: serialized, one persisted first tick;
- returned graph still has `activation_authority: "not_granted"` and no runtime method is called.

- [ ] **Step 3: Run focused application tests and confirm RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-market-data-view.test.ts packages/application/src/trading/paper/comparison-tick-coordinator.test.ts
```

Expected: fail because the view and coordinator do not exist.

- [ ] **Step 4: Implement the immutable view**

Copy source identity metadata, verify source/tick configuration and tick SHA-256 at construction,
store a structured clone of the tick, and return new clones on every read. Convert the market
summary to the application `MarketSnapshot` shape while retaining all actual source metadata.
Never retain or call a source read-method delegate.

- [ ] **Step 5: Implement the capture coordinator**

Use a SHA-256 suffix of `comparisonId:idempotencyKey` for deterministic IDs and one promise-tail
queue for capture serialization. Follow the ten-step order in the design. Wrap raw dependency
failures in stable comparison-tick errors without payloads or provider configuration. Compute the
record digest only after the two reads and server completion timestamp are available; reload and
verify the stored record before constructing the view.

- [ ] **Step 6: Make REST market provenance explicit and test it**

Extend `readBinanceBtcUsdtMarketSnapshot` output with:

```ts
source_kind: "binance_production_public_rest",
source_priority: "rest_fallback",
freshness: "fresh",
ws_connected: false,
rest_fallback_used: true,
gap_detected: false
```

Update the existing Binance adapter test to assert those exact fields while preserving hybrid/hub
metadata tests.

- [ ] **Step 7: Run focused and integration tests**

```bash
npx vitest run packages/application/src/trading/paper/comparison-market-data-view.test.ts packages/application/src/trading/paper/comparison-tick-coordinator.test.ts apps/runtime/test/binance-public-market-adapter.test.ts packages/local-store/test/local-store.test.ts -t "comparison|REST market"
npm run typecheck
```

Expected: all pass.

- [ ] **Step 8: Commit capture and view**

```bash
git add packages/application/src/trading/paper/comparison-market-data-view.ts packages/application/src/trading/paper/comparison-market-data-view.test.ts packages/application/src/trading/paper/comparison-tick-coordinator.ts packages/application/src/trading/paper/comparison-tick-coordinator.test.ts packages/adapters/src/binance/public-market-adapter.ts apps/runtime/test/binance-public-market-adapter.test.ts
git commit -m "feat: capture first shared paper comparison tick"
```

### Task 4: Durable Boundary Writeback And Whole-Branch Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md`
- Modify: `docs/superpowers/specs/2026-07-11-paper-comparison-first-tick-design.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/superpowers/plans/2026-07-11-paper-comparison-first-tick.md`

**Interfaces:**
- Consumes: verified implementation and test evidence from Tasks 1-3.
- Produces: canonical vocabulary and an accurate partial-conformance statement.
- Preserves: activation, observation, verdict, release, confirmation, recovery, and promotion as
  explicit gaps.

- [ ] **Step 1: Update durable truth**

Add `PaperTradingComparisonTick` to canonical vocabulary. Mark first-tick persistence and the fixed
view implemented. State explicitly that the tick is not consumption evidence, qualification,
activation authority, a verdict, or promotion proof. Record the exact next frontier as durable
activation authorization plus partial-start cleanup/recovery.

- [ ] **Step 2: Historicalize this completed plan**

Replace checkbox execution detail with a compact implementation record containing the owned
boundary, invariants, commit ledger, tests, review decision, and next frontier. Keep active design
truth in the two specs and evaluation protocol rather than duplicating source code.

- [ ] **Step 3: Run full validation**

```bash
npm test
npm run typecheck
npm run check:repo-guards
```

Expected: every suite, workspace typecheck, docs, architecture, naming, tracked environment,
secrets, and diff check passes. If the restricted sandbox blocks local listeners, rerun the same
test command with local test socket permission and record both results.

- [ ] **Step 4: Review authority and public surface**

Confirm with source search and diff review that no runtime composition, command payload, provider
start, sandbox start, runner start, paper observation, Ledger write, verdict, or promotion path was
added. Confirm exact retry still revalidates the pair and configuration before returning.

- [ ] **Step 5: Commit durable writeback**

```bash
git add AGENTS.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md docs/superpowers/specs/2026-07-11-paper-comparison-first-tick-design.md docs/candidate-arena-evaluation-protocol.md docs/superpowers/plans/2026-07-11-paper-comparison-first-tick.md
git commit -m "docs: record first shared comparison tick"
```

## Self-Review

- [x] Spec coverage: record integrity, StorePort, atomic LocalStore append, idempotency, eligibility,
  fixed view, REST provenance, authority closure, tests, and writeback each have one owner.
- [x] Scope: activation, provider/sandbox runtime, later ticks, observations, verdict, promotion,
  release, and recovery have no implementation step.
- [x] Type consistency: `PaperTradingComparisonTickRecord`, digest/predicate exports, three StorePort
  methods, fixed view, and coordinator names match the design.
- [x] Ordering: exact retry skips external reads but still reloads and validates pair/configuration;
  alternate first tick fails before reads; new writes verify pair before and after append.
- [x] Failure attribution: platform/read/store failures create no strategy result or runtime effect.
- [x] Public authority: no runtime or command file is in the implementation map.
- [x] Documentation: completed execution detail is historicalized after evidence is collected.
