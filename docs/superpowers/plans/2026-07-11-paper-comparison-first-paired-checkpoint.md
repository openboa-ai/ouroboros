# Paper Comparison First Paired Checkpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commit one symmetric first-tick paper checkpoint for an owned `both_running` comparison
without allowing one-sided economic authority.

**Architecture:** Persist checkpoint intent before effects, prepare champion and challenger evidence
concurrently without economic writes, then make one LocalStore transaction bundle the commit point
for both Ledger/Observation/Evaluation sides and the paired outcome. Restart either rematerializes
that exact bundle or stops both sides and records incomplete uncertainty; it never reconstructs a
candidate decision.

**Tech Stack:** TypeScript, Vitest, Node.js crypto/fs, existing hexagonal application ports,
LocalStore JSON records, deterministic sandbox/provider fixtures.

**Design:**
`docs/superpowers/specs/2026-07-11-paper-comparison-first-paired-checkpoint-design.md`
at commit `0188837`.

## Global Constraints

- This frontier admits only checkpoint sequence `1` and the activation's exact stored first tick.
- Checkpoint execution performs zero underlying market or public-execution reads.
- Candidate silence, `hold`, and `no_action` are valid no-order continuity; no decision is
  synthesized.
- Pair-bound ordinary `recordLedger`, `recordPaperTradingObservation`, `observe`, and `schedule`
  paths remain closed.
- A `paired` outcome requires both side evidence in one committed LocalStore transaction bundle.
- Before the bundle commit point there is no economic Store mutation.
- Transaction materialization is idempotent and recoverable from the committed bundle.
- Later tick advancement, adjudication, evidence release, verdict, promotion, private access, live
  authority, and public/operator composition remain out of scope.

---

### Task 1: Define checkpoint evidence and total predicates

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/paper-trading-comparison-checkpoint.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonCheckpointAttemptRecord`
- Produces: `PaperTradingComparisonCheckpointOutcomeRecord`
- Produces: `PaperTradingComparisonCheckpointWriteContext`
- Produces: checkpoint digest-input and runtime-shape functions
- Extends: `PaperTradingObservationRecord` with optional checkpoint/tick refs and digests

- [ ] **Step 1: Write failing domain tests**

Add tests that construct canonical sequence-1 attempt and outcome records, hash them, and assert:

```ts
expect(paperTradingComparisonCheckpointAttemptHasRuntimeShape(attempt)).toBe(true);
expect(paperTradingComparisonCheckpointOutcomeHasRuntimeShape(paired)).toBe(true);
expect(paperTradingComparisonCheckpointOutcomeHasRuntimeShape(incomplete)).toBe(true);
expect(paperTradingComparisonCheckpointWriteContextHasRuntimeShape(context)).toBe(true);
```

Use table cases to reject sequence `2`, mismatched side roles/refs, malformed ISO timestamps,
deadline over 60 seconds, missing paired side evidence, side evidence on `incomplete`, duplicate
cross-role observation refs, invalid provider counts, non-empty authority flags, and digest drift.

- [ ] **Step 2: Run the domain test and verify RED**

Run:

```bash
npx vitest run packages/domain/src/paper-trading-comparison-checkpoint.test.ts
```

Expected: FAIL because checkpoint types and predicate exports do not exist.

- [ ] **Step 3: Add exact domain records and digest functions**

Implement the design fields with these status unions:

```ts
export type PaperTradingComparisonCheckpointOutcomeStatus = "paired" | "incomplete";
export type PaperTradingComparisonCheckpointOutcomeReason =
  | "paired_checkpoint_recorded"
  | "side_preparation_failed"
  | "side_preparation_timed_out"
  | "provider_request_budget_exceeded"
  | "checkpoint_deadline_exceeded"
  | "paired_persistence_failed"
  | "restart_cleanup";
```

Add canonical digest functions that omit record identity and digest fields exactly as the existing
activation attempt/outcome functions do. Add total runtime predicates that enforce the paired versus
incomplete field matrix rather than checking only field presence.

Extend `PaperTradingObservationRecord` with:

```ts
paper_trading_comparison_tick_ref?: Ref;
paper_trading_comparison_tick_digest?: string;
paper_trading_comparison_checkpoint_attempt_ref?: Ref;
paper_trading_comparison_checkpoint_attempt_digest?: string;
```

- [ ] **Step 4: Run domain regression and typecheck**

Run:

```bash
npx vitest run packages/domain/src/paper-trading-comparison-checkpoint.test.ts packages/domain/src/paper-trading-comparison-runtime-activation.test.ts packages/domain/src/paper-trading-comparison-tick.test.ts
npm run typecheck --workspace @ouroboros/domain
```

Expected: all selected tests and domain typecheck pass.

- [ ] **Step 5: Commit the domain contract**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-checkpoint.test.ts
git commit -m "feat: define paired paper checkpoint evidence"
```

### Task 2: Persist checkpoint intent and incomplete outcomes

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Consumes: Task 1 checkpoint records and predicates
- Produces: Store get/list/record operations for attempts and outcomes
- Rule: direct outcome persistence admits only `incomplete`; `paired` is reserved for Task 3's
  transaction operation

- [ ] **Step 1: Write failing LocalStore lifecycle tests**

Add tests proving:

```ts
await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
expect(await store.getPaperTradingComparisonCheckpointAttempt(attemptId)).toEqual(attempt);
expect(await store.listPaperTradingComparisonCheckpointAttempts(activationAttemptId))
  .toEqual([attempt]);
```

Also assert exact replay, conflicting replay rejection, sequence-1-only admission, exact latest
`both_running` activation outcome, zero-observation side baselines, one open attempt per activation
attempt, direct `paired` outcome rejection, valid `incomplete` append after cleanup, and corrupted
persisted-record rejection.

- [ ] **Step 2: Run the lifecycle tests and verify RED**

Run:

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison checkpoint lifecycle"
```

Expected: FAIL because the Store port and LocalStore methods do not exist.

- [ ] **Step 3: Add port methods and append-only LocalStore collections**

Add these methods to `OuroborosStorePort`:

```ts
recordPaperTradingComparisonCheckpointAttempt(record): Promise<AttemptRecord>;
getPaperTradingComparisonCheckpointAttempt(id): Promise<AttemptRecord | undefined>;
listPaperTradingComparisonCheckpointAttempts(activationAttemptId): Promise<AttemptRecord[]>;
recordPaperTradingComparisonCheckpointOutcome(record): Promise<OutcomeRecord>;
getPaperTradingComparisonCheckpointOutcome(id): Promise<OutcomeRecord | undefined>;
listPaperTradingComparisonCheckpointOutcomes(checkpointAttemptId): Promise<OutcomeRecord[]>;
```

Put all writes on `withComparisonEvidenceWriteTransaction`. Recompute canonical digests, reload the
complete comparison/activation graph, require the latest exact `both_running` outcome, and reject
ordinary `paired` outcome writes with
`paper_trading_comparison_paired_checkpoint_transaction_required`.

- [ ] **Step 4: Run lifecycle and existing activation persistence regressions**

Run:

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison checkpoint|paper comparison runtime activation"
npm run typecheck --workspace @ouroboros/local-store
```

Expected: selected tests and LocalStore typecheck pass.

- [ ] **Step 5: Commit lifecycle persistence**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist paired checkpoint lifecycle"
```

### Task 3: Add previewed Ledger plans and the atomic paired bundle

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Produces: `previewLedger(input: LedgerInput): Promise<LedgerWriteOutcome>` with no writes
- Produces: `PreparedPaperTradingComparisonCheckpointSide`
- Produces: `recordPaperTradingComparisonPairedCheckpoint(input)`
- Produces: `recoverPaperTradingComparisonCheckpointTransactions()`

- [ ] **Step 1: Write failing preview and transaction tests**

Prove that `previewLedger` returns the same deterministic IDs as `recordLedger` while leaving the
order, Gateway, execution, run, and projection files unchanged.

Build champion/challenger side bundles and assert one paired call:

```ts
const committed = await store.recordPaperTradingComparisonPairedCheckpoint({
  attempt,
  outcome,
  champion,
  challenger
});
expect(committed.outcome_status).toBe("paired");
expect((await store.listPaperTradingObservations(championEvaluationId))).toHaveLength(1);
expect((await store.listPaperTradingObservations(challengerEvaluationId))).toHaveLength(1);
```

Assert both observations bind the same tick, both evaluations move `0 -> 1`, direct pair-bound
Ledger/observation writes still fail, invalid side input creates no transaction file, and exact
replay creates no duplicates. Delete selected materialized files after a successful call, create a
new LocalStore, run transaction recovery, and assert exact rematerialization from the bundle.

- [ ] **Step 2: Run transaction tests and verify RED**

Run:

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paired checkpoint transaction|ledger preview"
```

Expected: FAIL because preview, paired commit, and transaction recovery are missing.

- [ ] **Step 3: Refactor Ledger construction into a pure plan**

Extract the record construction inside `recordLedgerUnlocked` into a private builder returning:

```ts
interface LocalLedgerWritePlan {
  outcome: LedgerWriteOutcome;
  stageBinding?: StageBindingRecord;
  updatedRuntime: TradingRunRecord;
}
```

`previewLedger` validates and builds this plan but writes nothing. `recordLedgerUnlocked` persists
the same plan, preserving all existing IDs and behavior.

- [ ] **Step 4: Implement the single-file transaction commit point**

Validate both complete side bundles in memory. Persist one self-digested adapter-internal bundle at:

```text
paper-trading-comparison-checkpoint-transactions/items/<attempt-id>.json
```

The bundle contains the exact Ledger plans, observations, evaluation updates, run updates, and
paired outcome. Write it with existing temp-file rename before any normal collection materialization.
Then materialize exact records idempotently and rebuild projections. On replay/recovery, validate the
bundle digest and rematerialize missing exact records; reject any conflict.

- [ ] **Step 5: Run transaction, Ledger, observation, and projection regressions**

Run:

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paired checkpoint transaction|ledger preview|records ledger chains|paper trading observation"
npm run typecheck --workspace @ouroboros/local-store
```

Expected: all selected tests and LocalStore typecheck pass.

- [ ] **Step 6: Commit the atomic Store boundary**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: commit paired checkpoint evidence atomically"
```

### Task 4: Prepare side evidence without economic writes

**Files:**
- Modify: `packages/application/src/ports/paper-comparison-session.ts`
- Modify: `packages/application/src/trading/paper/observation.ts`
- Create: `packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts`
- Modify: `packages/application/src/trading/paper/session-service.ts`
- Modify: `packages/application/src/trading/paper/session-service.test.ts`
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Consumes: Task 3 Ledger preview and prepared-side bundle
- Produces: `prepareComparisonCheckpointSide` on `PaperTradingComparisonSessionPort`
- Produces: checkpoint-scoped sandbox evidence refresh authority
- Preserves: the existing public observation path and its outputs

- [ ] **Step 1: Write failing pure-preparation tests**

Add focused cases using a stored first tick:

- one candidate-emitted order produces a previewed Ledger chain, `recorded` observation, and engine
  update without calling `recordLedger` or `recordPaperTradingObservation`;
- silence produces `no_order`, no decision, no Ledger plan, zero score delta, and account continuity;
- `hold` and `no_action` produce no-order continuity while consuming their event IDs;
- a malformed/error event produces a failed observation with zero favorable score;
- every observation contains exact tick/checkpoint refs and digests.

- [ ] **Step 2: Run the preparation test and verify RED**

Run:

```bash
npx vitest run packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts
```

Expected: FAIL because the side preparation API does not exist.

- [ ] **Step 3: Extract a no-write observation preparation core**

Refactor the event parsing, deterministic Ledger preview, paper-engine checkpoint, observation
construction, and evaluation update from `observation.ts` into an exported preparation function.
The existing public path calls that function, persists its Ledger plans and audit, then records its
observation exactly as before. The comparison path supplies the stored first tick and does not call
market liveness or underlying market ports.

- [ ] **Step 4: Write failing session boundary tests**

Assert `prepareComparisonCheckpointSide` independently reloads the exact running side, refreshes
sandbox evidence with checkpoint context, invokes no market read, returns a canonical prepared
bundle, reports total provider requests, and rejects wrong role/context, non-latest attempt,
non-`both_running` outcome, prior observation, stopped sandbox, deadline excess, and request-cap
excess.

- [ ] **Step 5: Add checkpoint session context and implementation**

Add the method:

```ts
prepareComparisonCheckpointSide(input: {
  side: PaperTradingComparisonActivationSide;
  authority: PaperTradingComparisonCheckpointWriteContext;
  tick: PaperTradingComparisonTickRecord;
  deadlineAt: string;
  maximumProviderRequestCount: number;
  signal: AbortSignal;
}): Promise<PreparedPaperTradingComparisonCheckpointSide>;
```

Allow `recordSandboxObservations` only for
`operation: "refresh_sandbox_evidence"` under that exact context. Do not authorize sandbox start,
stop, run control, evaluation, observation, or Ledger through this context. Extend comparison stop
and inspect loading to accept either zero evidence or one exact committed paired checkpoint so
restart cleanup remains possible after success.

- [ ] **Step 6: Run application and Store regressions**

Run:

```bash
npx vitest run packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts packages/application/src/trading/paper/session-service.test.ts packages/local-store/test/local-store.test.ts -t "checkpoint|comparison|paper trading observation"
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
```

Expected: selected tests and both typechecks pass.

- [ ] **Step 7: Commit side preparation**

```bash
git add packages/application/src/ports/paper-comparison-session.ts packages/application/src/trading/paper/observation.ts packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts packages/application/src/trading/paper/session-service.ts packages/application/src/trading/paper/session-service.test.ts packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: prepare paired checkpoint side evidence"
```

### Task 5: Coordinate, reconcile, and recover the first checkpoint

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-runtime-activation-coordinator.ts`
- Modify: `packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts`
- Create: `packages/application/src/trading/paper/comparison-checkpoint-coordinator.ts`
- Create: `packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts`

**Interfaces:**
- Consumes: owned `both_running` activation, Task 2 lifecycle, Task 3 atomic commit, Task 4 sessions
- Produces: `PaperTradingComparisonCheckpointCoordinator.captureFirst`
- Produces: `recoverIncompleteCheckpoints`
- Produces: activation-coordinator owned-attempt inspection and explicit handoff cleanup

- [ ] **Step 1: Write failing activation ownership/cleanup tests**

Add tests that an activation coordinator reports ownership only for the exact in-process
`both_running` attempt and can explicitly stop both with `handoff_cleanup`, append stop side results,
and append the next `stopped_cleanly` or `cleanup_required` activation outcome. A new coordinator
instance must not claim ownership.

- [ ] **Step 2: Implement the narrow activation handoff API**

Expose:

```ts
ownsRunningAttempt(attemptId: string): boolean;
stopOwnedAttempt(input: {
  attemptId: string;
  reason: "handoff_cleanup";
}): Promise<PaperTradingComparisonRuntimeActivationResult>;
```

Reuse existing cleanup and outcome persistence; do not create a second stop state machine.

- [ ] **Step 3: Write failing checkpoint coordinator tests**

Cover:

- attempt persists before either side preparation starts;
- both preparations are concurrently pending and receive exact cloned first-tick content;
- only one paired Store commit occurs;
- exact idempotent replay performs no sandbox refresh or preparation;
- candidate failed observation can still commit paired negative evidence and then cleanly stop;
- one-side reject/timeout, request cap, deadline, malformed bundle, and Store conflict stop both and
  append `incomplete`;
- Store throws after an exact bundle commit, reload finds paired success, and no cleanup occurs;
- restart with committed bundle rematerializes then stops unowned sessions;
- restart without bundle never re-prepares decisions and records `restart_cleanup` after stop;
- no verdict, promotion, public command, or market read is invoked.

- [ ] **Step 4: Run coordinator tests and verify RED**

Run:

```bash
npx vitest run packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts
```

Expected: FAIL because the coordinator and handoff APIs are missing.

- [ ] **Step 5: Implement deterministic capture and recovery**

`captureFirst` accepts only activation ID, activation-attempt ID, and idempotency key. It reloads the
full graph, verifies current-process ownership, creates deterministic attempt/outcome IDs, records
the attempt, races both preparation promises against the recorded deadline, validates request totals
and side digests, and submits one atomic paired commit. Failure uses the activation handoff API before
writing `incomplete`.

`recoverIncompleteCheckpoints` first calls transaction recovery. A committed bundle is reloaded and
never recomputed. An attempt without a committed bundle is cleaned up and terminated as
`restart_cleanup`; no provider session, sandbox log, event, Ledger, observation, or score is
reconstructed.

- [ ] **Step 6: Run checkpoint and activation regressions**

Run:

```bash
npx vitest run packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts packages/application/src/trading/paper/session-service.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: all selected tests and application typecheck pass.

- [ ] **Step 7: Commit coordination and recovery**

```bash
git add packages/application/src/trading/paper/comparison-runtime-activation-coordinator.ts packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts packages/application/src/trading/paper/comparison-checkpoint-coordinator.ts packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts
git commit -m "feat: coordinate first paired paper checkpoint"
```

### Task 6: Prove the real path and write durable truth

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md`
- Modify: `docs/superpowers/specs/2026-07-11-paper-comparison-first-paired-checkpoint-design.md`
- Modify: `docs/superpowers/plans/2026-07-11-paper-comparison-first-paired-checkpoint.md`

**Interfaces:**
- Consumes: Tasks 1-5 complete path
- Produces: real LocalStore/session integration evidence and historical implementation record
- Leaves: all production/public composition closed

- [ ] **Step 1: Write the failing real integration test**

Extend the existing comparison integration to prepare an inert pair, capture the first tick,
authorize and start both real qualification sessions, then call `captureFirst`. Assert:

```ts
expect(outcome.outcome_status).toBe("paired");
expect(championObservation.paper_trading_comparison_tick_ref?.id).toBe(firstTickId);
expect(challengerObservation.paper_trading_comparison_tick_ref?.id).toBe(firstTickId);
expect(championEvaluation.observation_count).toBe(1);
expect(challengerEvaluation.observation_count).toBe(1);
expect(underlyingMarketReads).toBe(0);
```

Recreate Store/session/coordinators, run checkpoint recovery before activation recovery, and assert
the same transaction/evidence reloads exactly while both unowned runtimes stop.

- [ ] **Step 2: Run integration and verify RED**

Run:

```bash
npx vitest run packages/application/src/trading/paper/comparison-coordinator.test.ts -t "first paired checkpoint"
```

Expected: FAIL until all real adapters are wired through the new internal ports.

- [ ] **Step 3: Complete integration without production composition**

Wire only the test composition. Search production imports and keep the checkpoint coordinator absent
from runtime controllers, commands, operator read models, CLI, TUI, Web, and Desktop.

- [ ] **Step 4: Update canonical docs and implementation status**

Add the three canonical checkpoint nouns, state that first-tick paired consumption is implemented,
state that later ticks remain blocked on served-tick attribution, and preserve explicit closure of
adjudication/verdict/promotion/live authority. Convert this plan to a compact implementation record
with actual commit hashes and verification counts after code commits exist.

- [ ] **Step 5: Run focused and repository-wide verification**

Run:

```bash
npx vitest run packages/domain/src/paper-trading-comparison-checkpoint.test.ts packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts
npm run typecheck
npm run check:repo-guards
npm test
git diff --check
```

Expected: every focused test, workspace typecheck, repo guard, and full test file passes. Run the full
suite with localhost/IPC permission if the restricted sandbox reports `listen EPERM`.

- [ ] **Step 6: Commit durable implementation evidence**

```bash
git add AGENTS.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md docs/superpowers/specs/2026-07-11-paper-comparison-first-paired-checkpoint-design.md docs/superpowers/plans/2026-07-11-paper-comparison-first-paired-checkpoint.md packages/application/src/trading/paper/comparison-coordinator.test.ts
git commit -m "docs: record first paired paper checkpoint"
```

## Plan Self-Review

- Every design acceptance item maps to a named test or verification command above.
- Pair success has one commit point; incomplete attempts cannot call the paired writer.
- Type names, status values, and method names are consistent across tasks.
- The first tick is consumed before any later-view work, preventing stale decision misattribution.
- No task adds public composition, adjudication, verdict, promotion, private access, or live
  authority.
