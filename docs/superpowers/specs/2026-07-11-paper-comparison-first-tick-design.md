# Paper Comparison First Tick Design

**Date:** 2026-07-11
**Status:** Implemented and verified as an inert first-checkpoint frontier
**Scope:** CandidateArena P0 prospective comparison, first shared market checkpoint only
**Depends on:** Verified inert `PaperTradingComparisonCommitment` graph

## Goal

Persist one eligible Gateway-owned public market opportunity for an inert champion/challenger pair
and expose that exact stored opportunity through a read-only market-data view, without starting a
provider, sandbox, runner, TradingSystem, Gateway order path, Ledger write, paper observation,
adjudication, or promotion.

This frontier establishes the evidence needed to say "both sides can be given the same future
market opportunity." It does not yet establish that either side consumed it or performed better.

## Context

The implemented comparison commitment graph freezes two admitted CandidateVersions, their distinct
qualification TradingRuns, one comparison policy, one market-data configuration digest, one paper
policy identity, and zero-state side evaluations. Its verification result explicitly carries
`activation_authority: "not_granted"`.

The next unsafe step would be to start both external sessions directly. External activation cannot
be atomic: one provider or sandbox can start while the peer fails. That requires a durable
activation authorization, authority-aware cleanup, and recovery policy. Those concerns are kept out
of this frontier so the first shared market evidence can be reviewed independently.

## Approaches Considered

### Persist the first tick and fixed view before activation

Selected. The coordinator performs one market snapshot read and one public execution snapshot read,
then atomically appends a self-digested tick only while the pair remains verified and inert. A fixed
view serves only the stored tick and never delegates candidate reads to Binance.

This gives deterministic idempotency, a small failure surface, and a durable handoff to the later
activation frontier.

### Persist the tick and activate both sides together

Rejected for this frontier. It would also need partial-start rollback, qualification-authorized
stop, activation completion evidence, restart recovery, request budgets, and paired checkpoint
serialization. Combining those effects with first-tick integrity would hide the authority boundary.

### Give each side a direct Gateway proxy

Rejected. Independent reads can observe different cache, WebSocket, REST fallback, order book, or
aggregate-trade states. They cannot prove a direct candidate comparison and cannot be replayed from
durable evidence.

## Vocabulary

### PaperTradingComparisonTick

`PaperTradingComparisonTick` is the canonical persisted evidence noun for one Gateway-owned market
and public-execution checkpoint bound to a single comparison. This name already appears in the
prospective comparison design and follows the repository's `PaperTrading...Record` schema family.

The first implementation allows only `sequence: 1`. Later paired observation work may extend the
same record family to contiguous later sequences; it must not create a second first-tick noun.

### ComparisonMarketDataView

`ComparisonMarketDataView` is an application adapter, not a persisted authority record. It
implements `GatewayMarketDataPort` from one verified stored tick and the frozen source configuration
identity. It cannot read the underlying Binance adapter, advance to a future tick, expose peer state,
or authorize activation.

No compatibility alias or schema migration is needed because neither name is currently persisted.

## Owned Boundary

This frontier owns:

- the `PaperTradingComparisonTickRecord` domain contract, canonical digest input, and total runtime
  predicate;
- StorePort append/get/list operations for comparison ticks;
- LocalStore append-only first-tick persistence in the comparison-evidence transaction;
- strict validation that the referenced pair still exists, verifies, and remains inert;
- an internal first-tick coordinator with deterministic idempotency and one in-process capture queue;
- an immutable `ComparisonMarketDataView` backed only by the verified stored tick;
- explicit public REST market metadata required for qualification eligibility;
- focused tests and durable protocol/taxonomy writeback.

## Non-Goals

This frontier does not:

- activate, schedule, observe, stop, or recover a qualification TradingRun;
- create a provider HTTP server or sandbox;
- write run-control, Ledger, paper observation, evaluation outcome, or account state;
- capture a second comparison tick;
- add a public command, route, read-model mutation, CLI action, or UI control;
- expose a tick, hidden outcome, peer decision, peer account, or peer score to a ResearchWorker;
- adjudicate superiority, release evidence, create confirmations, or promote a challenger;
- add private exchange access, credentials, signed requests, or live order authority;
- weaken pair-bound side mutation or frozen incumbent-evidence exclusion.

## Domain Record

```ts
interface PaperTradingComparisonTickRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_tick";
  paper_trading_comparison_tick_id: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  sequence: number;
  market_data_configuration_digest: string;
  market_snapshot: PaperTradingMarketSnapshotSummary;
  public_execution_snapshot: PaperTradingPublicExecutionSnapshotSummary;
  observed_at: string;
  tick_digest: string;
  authority_status: "not_live";
}
```

`observed_at` is the server-owned capture-completion time assigned after both Gateway reads return.
The two nested snapshots preserve their own source observation timestamps. Both future side
observations must reference this tick and embed the exact nested snapshot content; equal tick
identity does not require pretending the source timestamps were identical.

The first-tick predicate requires:

- `record_kind`, version, ID, refs, digests, and exact ISO timestamps;
- `sequence === 1` for this frontier;
- `BTCUSDT`, finite positive price and moving averages, finite non-negative volatility, and an
  explicit direction used only inside the Gateway-side market shape;
- read-only source authority, `fresh` market/public-execution evidence, and no reported gap;
- a non-empty public-execution stream marker and valid book ticker, trades, and order-book shapes;
- `authority_status: "not_live"`.

The canonical tick digest excludes record kind, version, record ID, and `tick_digest`. It includes
the comparison ref and digest, sequence, market-data configuration digest, both exact snapshots, and
server capture time.

## Capture Coordinator

Create a focused `PaperTradingComparisonTickCoordinator` rather than expanding the existing
commitment coordinator.

Its dependencies are:

```ts
interface PaperTradingComparisonTickCoordinatorOptions {
  store: OuroborosStorePort;
  comparisons: Pick<PaperTradingComparisonCoordinator, "reload">;
  marketData: GatewayMarketDataPort;
  now?: () => string;
}
```

Its only operation is:

```ts
captureFirstTick(input: {
  comparisonId: string;
  idempotencyKey: string;
}): Promise<{
  comparison: VerifiedPaperTradingComparisonCommitmentGraph;
  tick: PaperTradingComparisonTickRecord;
  marketDataView: ComparisonMarketDataView;
}>;
```

The operation uses one non-reentrant in-process queue. The current LocalStore composition is
single-process; a future multi-process StorePort must replace this assumption with a durable capture
lease before composing the coordinator.

Capture order is fixed:

1. validate non-empty IDs and derive a collision-resistant tick ID from comparison ID plus
   idempotency key;
2. load any existing record for that deterministic ID without performing a Gateway read;
3. reload and verify the complete inert comparison graph;
4. verify the configured `GatewayMarketDataPort` digest matches the frozen comparison digest;
5. if the existing record is exact, revalidate its tick digest and pair closure, then return it
   without a Gateway read;
6. reject any other existing first tick before any Gateway read;
7. read one market snapshot and one public-execution snapshot concurrently from the Gateway port;
8. validate eligibility and assign server-owned capture-completion time;
9. append the tick through StorePort;
10. reload the persisted tick, revalidate its digest and pair closure, then construct the fixed
    view.

Any failure before append produces no tick. A successful external read followed by a store failure
may be retried with the same idempotency key; no outcome is exposed and no runtime effect exists.

## Store Contract

Add these methods:

```ts
recordPaperTradingComparisonTick(
  tick: PaperTradingComparisonTickRecord
): Promise<PaperTradingComparisonTickRecord>;

getPaperTradingComparisonTick(
  tickId: string
): Promise<PaperTradingComparisonTickRecord | undefined>;

listPaperTradingComparisonTicks(
  comparisonId: string
): Promise<PaperTradingComparisonTickRecord[]>;
```

LocalStore runs tick append in the existing comparison-evidence write queue. It independently:

- validates total runtime shape and canonical SHA-256;
- loads the exact comparison commitment and verifies its digest;
- validates the complete comparison graph is still inert;
- verifies comparison ref/digest and market-data configuration digest equality;
- requires `comparison.committed_at <= tick.observed_at`;
- permits only sequence 1 and no prior tick for the comparison;
- returns an exact existing record idempotently;
- rejects same-ID drift, alternate first ticks, corrupt collections, missing refs, and non-inert
  graphs with stable typed errors.

The tick write does not relax any existing side, evaluation, observation, Ledger, sandbox,
run-control, promotion, admission, CandidateVersion, or SystemCode writer guard.

## ComparisonMarketDataView

The view copies only the source identity fields needed by `GatewayMarketDataPort` and the verified
tick. It intentionally keeps no delegate to the underlying market-data port.

- `readMarketSnapshot()` returns a deep copy of the stored market snapshot converted to the
  application `MarketSnapshot` shape.
- `readPublicExecutionSnapshot()` returns a deep copy of the stored public-execution snapshot.
- `readPublicMarketLivenessSurface()` fails with a stable
  `comparison_market_liveness_surface_unavailable` error because a liveness record was not captured;
  it must not synthesize one or call Binance.
- request timestamp arguments cannot alter the returned content.
- construction verifies the source configuration digest, tick digest, and source authority.

The existing candidate API conversion continues to remove `expected_direction` before any
TradingSystem receives a market response. The fixed view exposes no future tick and no evaluator or
peer state.

## Public REST Metadata

The REST-only Binance market snapshot now records explicit source/freshness evidence after a
successful read:

```text
source_kind: binance_production_public_rest
source_priority: rest_fallback
freshness: fresh
ws_connected: false
rest_fallback_used: true
gap_detected: false
```

This is source attribution, not a strategy signal. WebSocket/hybrid adapters preserve their own
actual metadata.

## Error Model

Application errors use stable codes for invalid input, missing comparison, market configuration
drift, existing-first-tick conflict, ineligible market/public evidence, idempotency conflict,
Gateway read failure, and persisted graph corruption.

Store errors distinguish invalid shape, digest mismatch, missing/mismatched comparison reference,
first-tick conflict, append-only conflict, non-inert graph, and corrupt tick collection.

Errors contain record IDs and reason codes only. They do not include raw market payloads, provider
configuration, URLs, secrets, private data, candidate output, or peer evidence.

## Test Strategy

### Domain

- canonical tick digest is key-order independent and changes for any bound evidence change;
- malformed nested market/public snapshots return false rather than throwing;
- stale, unavailable, gap-reported, non-positive, wrong-symbol, non-ISO, non-read-only, and
  sequence-not-one records are rejected.

### LocalStore

- exact append/reload/list and exact replay;
- digest, pair ref, pair digest, market configuration, timestamp, and graph mismatch rejection;
- alternate first tick and same-ID drift rejection;
- corrupt persisted tick collection fails closed;
- concurrent first-tick writes yield one record;
- no side, evaluation, observation, Ledger, sandbox, or run-control mutation is introduced.

### Application

- one market read and one public-execution read for a new first tick;
- exact retry performs zero Gateway reads;
- another first tick is rejected before Gateway reads;
- reads run only after comparison and market configuration verification;
- partial Gateway failure produces zero persisted ticks;
- capture time is server-owned and after the comparison commitment;
- the returned view serves byte-equivalent snapshot content without delegating;
- view liveness fails closed and repeated reads return independent clones;
- no provider, sandbox, runner, observation, Ledger, or public command dependency exists.

### Repository

Run focused domain, LocalStore, adapter, and application tests, then:

```bash
npm test
npm run typecheck
npm run check:repo-guards
```

## Acceptance Criteria

This frontier is complete when current code and tests prove:

1. an exact verified inert pair can persist exactly one first comparison tick;
2. the tick came from one Gateway market read and one Gateway public-execution read;
3. both exact source snapshots, pair identity/digest, configuration digest, sequence, and server
   capture time are append-only and self-digested;
4. malformed, stale, gapped, drifted, duplicate, missing, or non-inert inputs fail closed;
5. an exact retry performs no external market read;
6. `ComparisonMarketDataView` returns only the stored tick and cannot delegate to Binance or expose
   future/peer/evaluator state;
7. no qualification runtime or public authority is granted;
8. focused and repository-wide validation passes.

## Implementation Evidence

- `b419854` defines the canonical tick record, digest input, and strict total predicate.
- `5753fe2` adds StorePort and atomic LocalStore append/get/list behavior under the existing
  comparison-evidence transaction.
- `601c96f` adds the fixed non-delegating view, first-tick coordinator, explicit REST provenance,
  and a real coordinator-plus-LocalStore integration test.
- Domain, Store, application, adapter, and integration tests prove exact replay, one read per source,
  alternate/concurrent conflict, source eligibility, persisted digest validation, JSON omission
  semantics, graph revalidation, and zero provider/sandbox/runner/observation effects.
- Exact frontier verification passed 184/184 test suites and 1013/1013 tests, every workspace
  typecheck, and repository docs, architecture, naming, tracked environment, secrets, and diff
  guards.
- The graph still returns `activation_authority: "not_granted"`; both qualification evaluations
  remain `not_started` after capture.

This is partial conformance evidence only. No side has consumed the tick, and no direct economic
comparison, qualification result, verdict, evidence release, confirmation, or promotion has been
created.

## Next Frontier

A separate design may add a durable `PaperTradingComparisonActivation` authorization that binds the
verified pair and first tick, starts both side sessions against one shared advanceable view, records
partial-start state, supplies authority-aware cleanup, and recovers after restart. It must precede
paired observations and later contiguous tick capture. Verdict, evidence release, confirmation, and
promotion remain later frontiers.
