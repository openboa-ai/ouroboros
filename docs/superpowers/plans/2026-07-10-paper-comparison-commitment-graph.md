# Paper Comparison Commitment Graph Implementation Record

**Date:** 2026-07-10
**Status:** Implemented and verified as an inert frontier
**Plan commit:** `4e83396`
**Final frontier commit:** `6fbc8cf`
**Design digest:** `b0e43cb06a946c26db6f60f39a89ce53f61bc909bf85e03e41ae9317474b1e6b`

This page is the compact historical implementation record for the first prospective paper
comparison frontier. The active design is [Prospective Paper Comparison
Design](../specs/2026-07-10-prospective-paper-comparison-design.md), and the product acceptance
contract is [CandidateArena Evaluation Protocol](../../candidate-arena-evaluation-protocol.md).
Source, tests, and those two documents are authoritative if this record drifts.

## Goal

Persist and verify an append-only champion/challenger qualification commitment graph before either
side can observe market outcomes. The graph must bind admitted frozen candidates, executable
artifacts, evidence purpose, comparison policy, account/cost/risk policy, and any incumbent
promotion authority without granting runtime, public-command, adjudication, or promotion authority.

## Owned Boundary

This frontier implemented:

- one server-timestamped `PaperTradingComparisonPreparationRecord` before side creation;
- exact full-record digests for CandidateVersion, SystemCode, admission, and incumbent promotion
  evidence;
- two distinct non-default qualification TradingRuns with inert commitments and zero-state
  evaluations;
- one append-only `PaperTradingComparisonCommitmentRecord` that binds the complete pair;
- a shared pure qualification decision used by application and LocalStore validation;
- atomic LocalStore reservation, pair append, frozen-evidence exclusion, and active unordered-pair
  exclusion;
- deterministic repair of only the exact commitment-only partial preparation state;
- an internal prepare/reload/verify coordinator whose post-pair behavior is read-only;
- multi-run paper session isolation and observation-safe stop behavior required by the pair.

This frontier deliberately did not implement:

- a comparison market-data view or shared market tick;
- qualification activation, scheduling, or paired observation;
- evidence release, adjudication, verdict, confirmation, or promotion;
- pair lifecycle closure or restart recovery;
- any public command, route, or operator mutation for comparison control;
- private exchange reads, credentials, live order authority, or direct Binance access by a
  TradingSystem.

## Invariants

1. Preparation is persisted before either qualification side exists.
2. Caller input cannot supply or alter the server-owned preparation time.
3. Both candidates are already admitted, frozen, distinct, runnable in paper, and `not_live`.
4. Each side uses a distinct non-default TradingRun, commitment, evaluation, provider identity,
   sandbox boundary, fake account, event cursor, and run-control chain.
5. Both side commitments use `evidence_purpose: "qualification"`,
   `release_policy: "sealed_until_adjudication"`, and the same complete window, market, paper,
   account, cost, and risk identity.
6. The pair starts from zero outcome, zero observation, no account activity, no Ledger activity,
   and no active runner.
7. A champion challenge binds the exact current promotion and its exact stopped qualified
   commitment, evaluation, and ordered observation chain. A later or equivalent-looking chain is
   not interchangeable.
8. Frozen full-record digests are recomputed on reservation, pair append, replay, and reload.
9. Pair-bound side evidence and bound incumbent evidence cannot be extended or rewritten while the
   inert reservation is active.
10. Post-pair reload never calls session preparation and cannot repair, invalidate, replace, or
    activate persisted state.
11. Public `trading_run.start`, `observe`, and `stop` remain limited to the default
    `research_feedback` run.
12. Malformed, missing, duplicated, drifted, or non-inert state fails closed with stable comparison
    errors and no runtime effects.

## Architecture

### Domain

`packages/domain/src/index.ts` owns the comparison records, canonical digest inputs, total runtime
shape predicates, neutral baseline, unordered candidate-version pair key, stopped qualification
closure, and the single pure `decidePaperTradingQualification` decision.

The domain has no crypto or adapter dependency. Application and LocalStore independently verify
the commitment SHA-256 and supply that fact to the domain decision.

### Application

`packages/application/src/trading/paper/session-service.ts` owns isolated paper-session
prepare/activate/observe/stop behavior. Preparation may persist an inert qualification session, but
activation still rejects qualification evidence.

`packages/application/src/trading/paper/comparison-coordinator.ts` owns only:

1. candidate, admission, and incumbent authority validation;
2. server-time preparation reservation;
3. deterministic pre-pair side preparation;
4. pair persistence;
5. read-only graph reload and verification.

It is not composed in `apps/runtime`, has no public command, and has no market, provider, sandbox,
runner, Gateway, Ledger, or observation authority.

### Store

`packages/application/src/ports/store.ts` exposes preparation and pair persistence as StorePort
operations. `packages/local-store/src/index.ts` implements them through one non-reentrant
comparison-evidence queue shared with all relevant authority and side writers.

LocalStore validates exact persisted records, sole run-level commitment/evaluation chains,
ordered observations, timestamp causality, pair identity, inert baselines, and frozen promotion
closure before accepting or replaying records.

### Public Surface

`packages/application/src/trading/paper/commands.ts` always requests `research_feedback` for the
candidate's default TradingRun. Additional runs are internal-only. `apps/runtime/src/server.ts`
composes the shared paper session service and startup recovery but does not compose the comparison
coordinator.

## Implemented Tasks

### 1. Canonical Qualification And Comparison Domain

Commits: `acb33d9`, `4c2c0f8`, `5f59e90`

- Added comparison record contracts, canonical digest inputs, total shape predicates, and pair key.
- Moved qualification integrity and policy into one domain decision.
- Enforced complete interval closure, provider eligibility, account/score continuity, runner health,
  minimum evidence, market freshness, and public fill evidence.
- Preserved the existing application qualification API by delegation.

### 2. Atomic Preparation And Pair Persistence

Commits: `66595b7`, `4a08d77`

- Added StorePort and LocalStore preparation/pair methods.
- Serialized reservation and pair append with frozen authority and side writers.
- Rejected duplicate executable artifacts, default runs, role reversal, alternate evidence chains,
  and malformed persisted collections.
- Made graph reads total and fail closed on corrupt JSON.

### 3. Exact Partial-State Repair

Commits: `0acb1d5`, `2e82316`, `4b4e7ee`

- Allowed idempotent repair only when the deterministic TradingRun and commitment exist and the
  matching zero-state evaluation is absent.
- Rejected alternate commitments, evaluations, observations, Ledger records, run-control records,
  sandbox state, or terminal replay.
- Preserved normal replay of already-running `research_feedback` sessions.

### 4. Inert Pair Coordinator And Session Safety

Commits: `2bbb0ca`, `ac6bf81`, `10d42db`

- Added server-timestamped preparation, deterministic side preparation, pair append, read-only
  reload, and complete graph verification.
- Kept runtime and public composition closed.
- Serialized stop with in-flight observations, reloaded the latest evaluation before terminal
  write, and failed closed when observation drain times out.
- Mapped corrupt graph reads to stable comparison errors.

### 5. Durable Contract Writeback

Commit: `6fbc8cf`

- Updated the prospective comparison design, evaluation protocol, and API command contract.
- Recorded that the current graph is inert and that shared ticks, activation, verdict, and recovery
  remain future authority boundaries.

## Evidence

The exact frontier HEAD passed:

```text
npm test
178/178 suites, 961/961 tests

npm run typecheck
all workspaces passed

npm run check:repo-guards
docs, architecture, naming, tracked env, secrets, and diff checks passed
```

The full test suite requires a test environment that permits local loopback listeners and `tsx`
IPC sockets. A restricted filesystem/network sandbox produces `listen EPERM`; rerunning the same
HEAD with local test sockets enabled passes all tests.

Focused coverage includes:

- canonical comparison and qualification domain behavior;
- LocalStore append, replay, corruption, conflict, and writer-interleaving cases;
- exact partial preparation repair and alternate-chain rejection;
- coordinator idempotency, drift, zero-effect, and read-only reload cases;
- default versus additional TradingRun isolation;
- stop/observation race and drain-timeout behavior;
- public command isolation and runtime non-composition.

## Review Decision

**Decision:** keep the implementation, historicalize this page, and advance to a separate shared
market-tick frontier.

The implemented graph is a necessary commitment substrate, not prospective qualification proof.
It demonstrates that comparable paper evidence can be precommitted without leaking authority. It
does not demonstrate same-market observations, challenger superiority, adjudication, promotion, or
CandidateArena P0 completion.

## Next Frontier

The next independently reviewable frontier should add a Gateway-owned
`PaperTradingComparisonTick` and read-only `ComparisonMarketDataView`, then grant a separate,
verified activation capability only after the first shared tick is persisted. It must preserve:

- one underlying public market read per pair sequence;
- the same persisted tick identity and content for both sides;
- independent TradingSystem decision cadence and no-order continuity;
- bounded provider requests, retries, observations, elapsed time, and cost;
- outcome sealing from ResearchWorkers until adjudication;
- no verdict or promotion authority in the tick/activation component itself.
