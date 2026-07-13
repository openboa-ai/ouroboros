# ResearchGeneralizationProtocol Implementation Plan

Status: completed and repository-verified on 2026-07-13. Real-market protocol collection and any
separate generalization-policy decision remain outside this implementation frontier.

Implementation record: `e57873e`, `67cf883`, `1b60e86`, `c1774f8`, `1af1283`, and `8ef9f78`.
Final verification passed 183 Vitest files with 2930 tests, all workspace typechecks, and all
required repository guards.

> Execute autonomously under the active CandidateArena goal. Use TDD for every behavioral step and
> commit each bounded frontier only after focused verification.

**Goal:** Turn the proven same-baseline `ResearchControlStudy` path into a prospective,
public-condition-blocked, independent-baseline generalization protocol without adding promotion or
live authority.

**Architecture:** Add a Gateway-owned closed-kline evidence port and pure classifier, then a
create-only domain protocol with deterministic study slots. Extend study commitment with one exact
optional protocol assignment, let the existing scheduler fill only eligible slots, and aggregate
terminal study outcomes in a separate external read-only result.

**Stack:** TypeScript, Vitest, Fastify runtime composition, `LocalStore`, official Binance USD-M
Futures connector, SHA-256 canonical digest helpers.

---

## Task 1: Closed Public Kline Evidence And Classifier

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/ports/market-data.ts`
- Create: `packages/application/src/candidate/research-generalization-market-condition.ts`
- Create: `packages/application/src/candidate/research-generalization-market-condition.test.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `packages/adapters/src/binance/public-market-adapter.ts`
- Modify: `packages/adapters/src/binance/public-market-adapter.test.ts`

**Steps:**

1. Write failing tests for exact long, short, flat, threshold, malformed, gapped, future, and
   digest-replay cases.
2. Add normalized public kline-window and classifier policy/condition domain shapes.
3. Implement the pure classifier and stable error code.
4. Write failing adapter tests for exact `endTime`, 30 closed klines, and normalized evidence.
5. Add the optional Gateway capability and official Binance adapter implementation.
6. Run focused domain/application/adapter tests and type checks.
7. Commit.

## Task 2: ResearchGeneralizationProtocol Domain And Store

**Files:**

- Modify: `packages/domain/src/index.ts`
- Create: `packages/application/src/candidate/research-generalization-protocol.ts`
- Create: `packages/application/src/candidate/research-generalization-protocol.test.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/src/index.test.ts`

**Steps:**

1. Write failing decision tests for deterministic six-slot commitment, frozen policy, timing,
   resource, analysis, digest, and authority fields.
2. Implement pure protocol creation and runtime-shape validation.
3. Write failing LocalStore tests for create-only persistence, deterministic IDs, exact concurrent
   convergence, conflict rejection, and corrupt reload.
4. Implement protocol store methods and initialization paths.
5. Run focused tests and package type checks.
6. Commit.

## Task 3: Protocol-Bound Study Assignment

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/candidate/research-control-study.ts`
- Modify: `packages/application/src/candidate/research-control-study.test.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/src/index.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-runtime.ts`
- Modify: `apps/runtime/test/research-control-study-runtime.test.ts`

**Steps:**

1. Write failing tests for exact optional `generalization_assignment` sealing.
2. Require protocol ref/digest, deterministic slot identity, condition evidence, source artifact
   identity, and pre-effect timestamps for assigned studies.
3. Preserve historical unassigned Gate 1 study behavior exactly.
4. Make LocalStore verify the referenced protocol, expected slot/study identity, classification,
   source-artifact binding, and append-only order before publishing the study.
5. Thread the assignment through runtime materialization so the exact baseline snapshot digest is
   sealed before campaigns.
6. Run focused tests and type checks.
7. Commit.

## Task 4: Automatic Protocol And Slot Commitment

**Files:**

- Modify: `apps/runtime/src/candidate/arena/research-control-study-commitment-coordinator.ts`
- Modify: `apps/runtime/test/research-control-study-commitment-coordinator.test.ts`
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/test/server.test.ts`

**Steps:**

1. Write failing coordinator tests for protocol-first creation and one durable action per call.
2. Add deterministic active-protocol reconstruction from frozen policy, worker, paper protocol,
   classifier, timing, and budget inputs.
3. Write failing tests for long/short/flat earliest-slot selection, 24-hour spacing, 90-day expiry,
   block-full, public-data unavailable, source reuse, worker drift, protocol drift, pending study,
   and cross-process exact-race behavior.
4. Fill at most one exact matching slot and preserve existing study execution ownership.
5. Compose the public kline capability through the default server while allowing custom ports that
   lack it to return an explicit deferred status.
6. Run focused runtime/server tests and type checks.
7. Commit.

## Task 5: ResearchGeneralizationOutcome

**Files:**

- Modify: `packages/domain/src/index.ts`
- Create: `packages/application/src/candidate/research-generalization-outcome.ts`
- Create: `packages/application/src/candidate/research-generalization-outcome.test.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/src/index.test.ts`

**Steps:**

1. Write failing tests for complete supported evidence, equal block weighting, exact p-value,
   duplicate baselines, ties, missing slots, ineligible studies, harmful blocks, and expiry.
2. Implement pure external adjudication over exact protocol slots and immutable study outcomes.
3. Persist one deterministic create-only outcome with exact race reconciliation.
4. Prove the outcome cannot mutate or imply policy decision, promotion, order, or live authority.
5. Run focused tests and type checks.
6. Commit.

## Task 6: Automatic Outcome Reconciliation And Server Readback

**Files:**

- Create: `packages/application/src/candidate/research-generalization-outcome-coordinator.ts`
- Create: `packages/application/src/candidate/research-generalization-outcome-coordinator.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-scheduler.ts`
- Modify: `apps/runtime/test/research-control-study-scheduler.test.ts`
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/test/server.test.ts`

**Steps:**

1. Write failing oldest-missing reconciliation tests.
2. Reconcile at most one terminal/expired protocol outcome after successful scheduler catch-up and
   before the bounded wait.
3. Preserve scheduler status shape when no protocol outcome coordinator is configured.
4. Treat corrupt graph evidence as terminal and incomplete/unexpired evidence as up to date.
5. Compose the coordinator in the default server.
6. Run focused tests and type checks.
7. Commit.

## Task 7: Durable Truth And Full Verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: this design and plan status as implementation evidence requires

**Steps:**

1. Record the canonical noun, classifier, protocol slots, generalization scope, and explicit
   authority limits.
2. Run focused tests for every changed package.
3. Run the full Vitest suite and all workspace type checks.
4. Run `bash scripts/check-docs.sh`, `npm run check:architecture`, `npm run check:naming`,
   `bash scripts/check-env-files.sh --tracked`, `bash scripts/check-secrets.sh`, and
   `git diff --check`.
5. Review the final diff for unrelated changes and keep `.superpowers/` untouched.
6. Commit the durable writeback.
7. Reassess the next frontier. Do not automate broad policy replacement or TradingPromotion unless
   the exact supported generalization outcome and a separately designed authority boundary exist.
