# Repeated Paired Comparison Checkpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advance one owned champion/challenger comparison from its first paired checkpoint through
one causally attributed, atomic second checkpoint using sequence-N contracts.

**Architecture:** A Gateway-owned next tick is persisted as a contiguous append-only record. A
sequence-N checkpoint attempt is then persisted before both role-bound provider views advance.
Candidates explicitly GET and acknowledge that tick before a second call prepares and atomically
commits both sides. Open or partial attempts stop both sessions and never create economic evidence.

**Tech Stack:** TypeScript, Vitest, Node.js HTTP/crypto, existing application ports, LocalStore JSON
records and recoverable transaction bundle.

**Design:**
`docs/superpowers/specs/2026-07-11-repeated-paired-comparison-checkpoint-design.md`
at commit `c83a6e7`.

## Global Constraints

- Sequence 1 remains compatible without predecessor or acknowledgement fields.
- Every sequence 2+ tick has one exact predecessor tick and one exact prior paired checkpoint.
- A checkpoint attempt is persisted before either provider view changes.
- Every sequence 2+ side must persist an exact tick delivery and acknowledgement before preparation.
- Every newly consumed sequence 2+ decision event echoes that side's exact acknowledgement; zero
  events is valid acknowledged silence.
- Provider view advancement is symmetric at the coordinator boundary; partial advancement stops
  both sides and records no economic evidence.
- Tick, checkpoint, observation, evaluation, Ledger, account, provider-count, deadline, cadence,
  observation-cap, and elapsed-time lineage remain exact and append-only.
- Restart can rematerialize a committed atomic bundle but never resumes a provider or reconstructs a
  candidate decision.
- No public/runtime controller, CLI, TUI, Web, Desktop, private exchange, credential, direct-order,
  verdict, qualification, release, promotion, or live authority is added.

---

### Task 1: Generalize tick and checkpoint domain lineage

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/paper-trading-comparison-tick.test.ts`
- Modify: `packages/domain/src/paper-trading-comparison-checkpoint.test.ts`
- Modify: `packages/domain/src/paper-trading-comparison-tick-attribution.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonTickCaptureWriteContext`
- Extends: `PaperTradingComparisonTickRecord` with optional predecessor ref/digest
- Generalizes: checkpoint attempt/outcome sequence from literal `1` to positive integer
- Extends: sequence-N attempt predecessor outcome and side acknowledgement evidence
- Extends: `PaperTradingObservationRecord` with optional comparison acknowledgement ref/digest
- Extends: `PaperTradingComparisonCheckpointWriteContext.operation` with `advance_tick_view`

- [x] **Step 1: Write failing sequence-N domain tests**

Create a valid sequence-2 tick whose predecessor is sequence 1, a capture authority bound to the
exact activation attempt and prior paired checkpoint, a checkpoint attempt whose predecessor is the
sequence-1 paired outcome, and a paired outcome whose two sides bind distinct exact
acknowledgements. Assert all total predicates accept them.

Use table cases to reject:

- sequence 1 with predecessor fields or sequence 2 without them;
- partial predecessor ref/digest pairs, wrong record kinds, and non-positive sequences;
- sequence-2 attempt without prior paired outcome lineage;
- sequence-1 outcome carrying acknowledgement lineage;
- sequence-2 paired outcome missing one role acknowledgement or sharing one acknowledgement;
- incomplete outcome carrying either side evidence;
- capture/write contexts with missing, extra, cross-role, order, private, or live authority.

- [x] **Step 2: Run domain tests and verify RED**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-tick.test.ts packages/domain/src/paper-trading-comparison-checkpoint.test.ts packages/domain/src/paper-trading-comparison-tick-attribution.test.ts
```

Expected: FAIL because predecessor, sequence-N, acknowledgement, and capture-authority contracts do
not exist.

- [x] **Step 3: Implement exact additive domain shapes**

Add:

```ts
export interface PaperTradingComparisonTickCaptureWriteContext {
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  previous_checkpoint_attempt_ref: Ref;
  previous_checkpoint_attempt_digest: string;
  previous_checkpoint_outcome_ref: Ref;
  previous_checkpoint_outcome_digest: string;
  operation: "capture_next_tick";
}
```

Add all-or-none optional predecessor fields to tick and checkpoint attempt records. Add all-or-none
optional acknowledgement fields to checkpoint side evidence and observation records. Replace
`checkpoint_sequence: 1` with `checkpoint_sequence: number`, requiring a positive integer.

Replace `design_attributed_next_tick` with:

```ts
type PaperTradingComparisonCheckpointNextAction =
  | "serve_and_acknowledge_current_tick"
  | "capture_next_tick"
  | "close_failed_comparison"
  | "recover_cleanup";
```

The outcome predicate requires `serve_and_acknowledge_current_tick` for a successful sequence-1
outcome and `capture_next_tick` for a successful sequence-2+ outcome.

- [x] **Step 4: Run domain regressions and typecheck**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-tick.test.ts packages/domain/src/paper-trading-comparison-checkpoint.test.ts packages/domain/src/paper-trading-comparison-tick-attribution.test.ts packages/domain/src/paper-trading-comparison-runtime-activation.test.ts
npm run typecheck --workspace @ouroboros/domain
```

Expected: selected domain tests and domain typecheck pass.

Actual: 4 domain files, 200 tests passed; `@ouroboros/domain` typecheck passed.

- [x] **Step 5: Commit domain lineage**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-tick.test.ts packages/domain/src/paper-trading-comparison-checkpoint.test.ts packages/domain/src/paper-trading-comparison-tick-attribution.test.ts
git commit -m "feat: define repeated comparison lineage"
```

### Task 2: Enforce contiguous next-tick persistence

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Consumes: `PaperTradingComparisonTickCaptureWriteContext`
- Changes: `recordPaperTradingComparisonTick(tick, authority?)`
- Preserves: authority-free sequence-1 capture only
- Produces: exact sequence-2 append/replay validation for Task 3

- [x] **Step 1: Write failing LocalStore next-tick tests**

Starting from a real running activation with one paired checkpoint and both first-tick
acknowledgements, call:

```ts
await store.recordPaperTradingComparisonTick(nextTick, captureAuthority);
```

Assert exact replay and one sequence-2 record. Reject no authority, stale/cross-attempt authority,
wrong prior outcome, incomplete or failed prior checkpoint, missing role acknowledgement for
sequence 1, sequence gap, alternate tick at sequence 2, non-monotonic timestamps, cadence below
`interval_ms`, observation-cap overflow, elapsed-time overflow, open checkpoint attempt, and a third
tick before checkpoint 2 is paired. Assert sequence-1 capture rejects any authority and remains
compatible.

- [x] **Step 2: Run LocalStore tick tests and verify RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "contiguous comparison tick"
```

Expected: FAIL because Store accepts only one first tick and has no next-tick authority.

- [x] **Step 3: Generalize the Store tick writer**

Change the port and implementation signature to:

```ts
recordPaperTradingComparisonTick(
  tick: PaperTradingComparisonTickRecord,
  authority?: PaperTradingComparisonTickCaptureWriteContext
): Promise<PaperTradingComparisonTickRecord>;
```

For sequence 1, require no authority, no existing tick, and the inert verified commitment graph. For
sequence N, require exact predecessor, contiguous sorted ticks, current owned-attempt durable graph,
latest activation outcome `both_running`, prior checkpoint sequence N-1 paired with no failed side,
both required prior acknowledgements, no open attempt, frozen cadence/count/elapsed bounds, and an
exact capture context. Permit only exact replay for the same deterministic record.

- [x] **Step 4: Run LocalStore regressions and typecheck**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "comparison tick|paired checkpoint|tick attribution"
npm run typecheck --workspace @ouroboros/local-store
```

Expected: selected Store tests and LocalStore typecheck pass.

Actual: 7 new contiguous-tick tests, 43 selected comparison regressions, and all 290 LocalStore
tests passed; `@ouroboros/local-store` typecheck passed.

- [x] **Step 5: Commit contiguous tick persistence**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist contiguous comparison ticks"
```

### Task 3: Capture the next Gateway-owned tick

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-tick-coordinator.ts`
- Modify: `packages/application/src/trading/paper/comparison-tick-coordinator.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`

**Interfaces:**
- Adds: `captureNextTick({ activationId, activationAttemptId, idempotencyKey })`
- Adds: optional activation ownership port with `ownsRunningAttempt(attemptId)`
- Produces: `CapturedPaperTradingComparisonTick`
- Preserves: `captureFirstTick` behavior and deterministic replay

- [ ] **Step 1: Write failing coordinator tests**

Build a real LocalStore comparison through first paired checkpoint and first-tick acknowledgements.
Assert `captureNextTick`:

- rejects a non-owned activation attempt before market reads;
- performs one market and one public-execution read;
- persists sequence 2 with exact predecessor and prior checkpoint authority;
- returns an immutable view serving only tick 2;
- replays exact idempotency without another market read;
- rejects missing first-tick acknowledgement, early cadence, cap/horizon overflow, alternate
  idempotency, failed prior side, and corrupt predecessor evidence;
- does not mutate either running provider view, evaluation, observation, Ledger, or score.

- [ ] **Step 2: Run tick-coordinator tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-tick-coordinator.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts -t "next tick|contiguous tick"
```

Expected: FAIL because `captureNextTick` and ownership validation do not exist.

- [ ] **Step 3: Implement next-tick capture**

Add:

```ts
captureNextTick(input: {
  activationId: string;
  activationAttemptId: string;
  idempotencyKey: string;
}): Promise<CapturedPaperTradingComparisonTick>;
```

Reload and digest-check activation, owned latest attempt/outcome, tick chain, checkpoint chain,
acknowledgements, and frozen comparison policy before reading the Gateway. Derive sequence from the
latest tick, use a deterministic ID containing activation attempt, sequence, and idempotency key,
read market/public execution concurrently once, build predecessor lineage, persist with the Task 2
authority, reload exact content, and return `ComparisonMarketDataView`.

- [ ] **Step 4: Run coordinator regressions and application typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-tick-coordinator.test.ts packages/application/src/trading/paper/comparison-market-data-view.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: tick/view/integration tests and application typecheck pass.

- [ ] **Step 5: Commit next-tick capture**

```bash
git add packages/application/src/trading/paper/comparison-tick-coordinator.ts packages/application/src/trading/paper/comparison-tick-coordinator.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
git commit -m "feat: capture next comparison tick"
```

### Task 4: Generalize checkpoint chain persistence and atomic transactions

**Files:**
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Generalizes: checkpoint attempt/outcome append chains to contiguous sequence N
- Generalizes: committed comparison side state to all paired transactions through sequence N
- Requires: exact acknowledgement lineage for sequence 2+ paired transaction
- Preserves: sequence-1 atomic bundle and recovery behavior

- [ ] **Step 1: Write failing sequence-2 Store tests**

From sequence-1 paired state plus persisted tick 2, construct attempt 2 with current evaluation and
observation-chain digests. Assert attempt persistence requires exact predecessor outcome and allows
one open latest attempt. Construct prepared acknowledged-silence sides and a paired outcome 2. Assert
the atomic writer advances both observations/evaluations to sequence 2 and stores both exact
acknowledgements in observation/outcome evidence.

Inject transaction failures before bundle write, after bundle write, and during materialization;
assert recovery yields both sequence-2 sides or neither. Reject gaps, duplicate sequence, stale
evaluation/observation digests, wrong prior outcome, mismatched ack, event-count drift, provider
count regression/overflow, stale Ledger preview, one-sided observation, and partial materialization.

- [ ] **Step 2: Run Store sequence-2 tests and verify RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "repeated paired checkpoint"
```

Expected: FAIL because checkpoint persistence and committed-state validation assume exactly one
checkpoint and observation.

- [ ] **Step 3: Implement contiguous checkpoint state**

Sort checkpoint attempts by `checkpoint_sequence` then ID and reject gaps or duplicate sequences.
For attempt N, reload all prior attempts and exact terminal outcomes, require sequences 1..N-1 are
paired, bind `previous_checkpoint_outcome_ref/digest`, validate current side evaluation and complete
observation-chain digest, and bound provider counts.

Generalize `paperTradingComparisonRuntimeSideHasCommittedCheckpointState` to validate every paired
transaction and observation in order, aggregate Ledger refs across outcomes, and compare the current
evaluation to the latest transaction. When the latest attempt is open, validate committed state
through N-1 rather than treating the open attempt as committed.

In the atomic transaction builder, load `checkpointAttempt.tick_ref` rather than activation first
tick, require `observation.sequence === checkpoint_sequence`, validate exact acknowledgement fields
for sequence 2+, and use the current evaluation as `previous_evaluation`. Keep the same recoverable
bundle and materialization algorithm.

- [ ] **Step 4: Run Store and domain regressions**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "checkpoint|comparison tick|runtime activation"
npx vitest run packages/domain/src/paper-trading-comparison-checkpoint.test.ts
npm run typecheck --workspace @ouroboros/local-store
```

Expected: sequence-1 and sequence-2 Store regressions plus LocalStore typecheck pass.

- [ ] **Step 5: Commit sequence-N Store transactions**

```bash
git add packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist repeated paired checkpoints"
```

### Task 5: Advance role-bound views and require acknowledgement in preparation

**Files:**
- Modify: `packages/application/src/ports/paper-comparison-session.ts`
- Modify: `packages/application/src/trading/paper/session-service.ts`
- Modify: `packages/application/src/trading/paper/session-service.test.ts`
- Modify: `packages/application/src/trading/paper/observation.ts`
- Modify: `packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts`

**Interfaces:**
- Adds: `advanceComparisonCheckpointSide`
- Generalizes: `prepareComparisonCheckpointSide` for sequence N
- Requires: exact role-bound acknowledgement for sequence 2+
- Preserves: first checkpoint's acknowledgement-optional preparation

- [ ] **Step 1: Write failing session/view tests**

Persist open attempt 2 after tick 2. For each role assert:

- stale/wrong role, tick, attempt, prior outcome, evaluation digest, observation digest, provider
  count, stopped sandbox, existing tick-2 delivery, and non-contiguous sequence are rejected;
- exact advance changes that provider's `/market/snapshot` from tick 1 to tick 2 without restarting
  its provider or sandbox;
- the first tick-2 GET persists a distinct role-bound delivery and exact replay reuses it;
- tick-1 ack is rejected after advance and tick-2 ack persists once;
- no market delegate read, economic write, peer state, private/live authority, or request-cap bypass
  occurs.

For preparation, assert missing/cross-role/stale ack fails before economic output, acknowledged
silence produces sequence-2 `no_order`, and order/cancel/hold/no-action events must echo the exact
ack. First-checkpoint events remain acknowledgement-optional.

- [ ] **Step 2: Run session/preparation tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts -t "advance comparison view|repeated checkpoint|acknowledged silence"
```

Expected: FAIL because the session cannot advance a binding and preparation assumes sequence 1.

- [ ] **Step 3: Add the session port and causal preparation checks**

Add:

```ts
advanceComparisonCheckpointSide(input: {
  side: PaperTradingComparisonActivationSide;
  authority: PaperTradingComparisonCheckpointWriteContext & {
    operation: "advance_tick_view";
  };
  tick: PaperTradingComparisonTickRecord;
}): Promise<void>;
```

Reload the exact open attempt and prior committed state. Require current provider count equals the
attempt's side baseline. Construct a new `ComparisonMarketDataView` from the existing binding's
frozen source identity and tick N, then synchronously replace `binding.marketData` and the enabled
attribution map. Exact replay is allowed; different evidence is rejected.

During sequence-N preparation, load the role's exact persisted acknowledgement and pass it to
`preparePaperTradingComparisonCheckpointEvidence`. Require every newly consumed event to carry the
same ref/digest. Add acknowledgement lineage to the resulting observation. Zero events remains
valid only because the exact ack exists.

- [ ] **Step 4: Run session/provider/observation regressions and typecheck**

```bash
npx vitest run packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts packages/application/src/trading/paper/events.test.ts packages/application/src/trading/gateway/runtime-binding.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: session, event, provider, preparation tests and application typecheck pass.

- [ ] **Step 5: Commit view advancement and ack gate**

```bash
git add packages/application/src/ports/paper-comparison-session.ts packages/application/src/trading/paper/session-service.ts packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/paper/observation.ts packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts
git commit -m "feat: require acknowledged comparison views"
```

### Task 6: Coordinate two-phase repeated checkpoints

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-checkpoint-coordinator.ts`
- Modify: `packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts`

**Interfaces:**
- Adds: `beginNext`
- Adds: `completeNext`
- Tracks: in-process ownership of successfully advanced open attempts
- Generalizes: checkpoint graph loading, failure cleanup, and recovery through sequence N

- [ ] **Step 1: Write failing two-phase coordinator tests**

Assert `beginNext`:

- requires owned running activation and exact tick 2;
- captures current provider counts and sequence-1 evaluation/observation digests;
- persists attempt 2 before invoking either side advance;
- advances both sides concurrently;
- on one rejection/timeout stops both and records incomplete sequence-2 outcome with no side
  economic evidence;
- exact in-process replay returns the open attempt, while restart refuses ownership.

Assert `completeNext`:

- requires the in-process open attempt and both exact acknowledgements;
- prepares both sides concurrently under the same deadline;
- commits one paired outcome 2 through the atomic Store writer;
- keeps healthy sessions running, removes open ownership, and permits next tick capture;
- exact committed replay returns the existing outcome;
- missing/stale/cross-role ack, deadline, request cap, side failure, or persistence failure produces
  no partial economic evidence and executes conservative cleanup.

- [ ] **Step 2: Run coordinator tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts -t "begin next|complete next|repeated checkpoint"
```

Expected: FAIL because the coordinator exposes only one synchronous first-checkpoint path.

- [ ] **Step 3: Generalize graph loading and add two-phase methods**

Add:

```ts
beginNext(input: {
  activationId: string;
  activationAttemptId: string;
  tickId: string;
  idempotencyKey: string;
}): Promise<PaperTradingComparisonCheckpointAttemptRecord>;

completeNext(input: {
  checkpointAttemptId: string;
}): Promise<PaperTradingComparisonCheckpointOutcomeRecord>;
```

Refactor the internal graph loader to validate contiguous ticks, attempts, outcomes, observations,
and current evaluations for a requested sequence. Build attempt IDs from activation attempt,
sequence, and idempotency key. Persist before `Promise.all` view advancement. Add successful open
attempt IDs to an in-memory set only after both advances resolve. `completeNext` reloads and verifies
the open graph and ack records before reusing concurrent side preparation and atomic commit logic.

Generalize recovery to rematerialize transaction bundles first, then fail and stop every remaining
open attempt without claiming provider survival or replaying decisions.

- [ ] **Step 4: Run checkpoint/runtime/session regressions and typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts packages/application/src/trading/paper/session-service.test.ts packages/local-store/test/local-store.test.ts -t "checkpoint|comparison tick|activation"
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
```

Expected: sequence-1 and sequence-2 coordinator/runtime/session/Store regressions and both
typechecks pass.

- [ ] **Step 5: Commit two-phase coordination**

```bash
git add packages/application/src/trading/paper/comparison-checkpoint-coordinator.ts packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts
git commit -m "feat: coordinate repeated paired checkpoints"
```

### Task 7: Prove the real two-tick path and update durable truth

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-11-repeated-paired-comparison-checkpoint-design.md`
- Modify: `docs/superpowers/plans/2026-07-11-repeated-paired-comparison-checkpoint.md`

**Interfaces:**
- Consumes: Tasks 1-6 full sequence-2 path
- Produces: real provider/sandbox/LocalStore/restart evidence and canonical implementation status
- Leaves: automatic multi-tick loop, resume, adjudication, confirmation, release, and promotion closed

- [ ] **Step 1: Write the real end-to-end integration test**

Extend the real LocalStore and actual HTTP provider fixture:

1. prepare, capture tick 1, authorize, start both, and commit paired checkpoint 1;
2. GET and acknowledge tick 1 for both roles;
3. capture tick 2 from one new Gateway market/public-execution read;
4. call `beginNext` and prove attempt 2 persisted before both views advance;
5. GET and acknowledge tick 2 from both real provider URLs;
6. call `completeNext` with acknowledged silence;
7. assert two contiguous ticks, attempts, paired outcomes, observations, and evaluation counts;
8. assert distinct role/run delivery/ack lineage, same tick-2 evidence, cumulative account/score
   continuity, no peer/private/live leakage, and provider/sandbox reuse;
9. restart LocalStore and recover, proving the exact two bundles rematerialize without new provider,
   delivery, acknowledgement, decision, Ledger, observation, score, or outcome evidence.

- [ ] **Step 2: Run the real integration test**

```bash
npx vitest run packages/application/src/trading/paper/comparison-coordinator.test.ts -t "repeated paired checkpoint"
```

Expected: PASS only when the real HTTP provider, session view, LocalStore transaction, and recovery
boundaries agree.

- [ ] **Step 3: Verify no production composition**

```bash
rg -n "captureNextTick|beginNext|completeNext|advanceComparisonCheckpointSide|capture_next_tick" apps packages --glob '!**/*.test.ts'
```

Expected: domain, Store, provider/session, and internal coordinators only; no runtime controller,
public command, CLI, TUI, Web, or Desktop composition.

- [ ] **Step 4: Update canonical docs**

State that one acknowledgement-required repeated paired checkpoint is implemented as internal
scientific-control evidence. Preserve explicit closure of automatic cadence, process resume,
minimum-window qualification, adjudication, confirmation, verdict, evidence release, promotion,
private access, and live authority. Record actual commits and verification counts in this plan.

- [ ] **Step 5: Run focused and repository-wide verification**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-tick.test.ts packages/domain/src/paper-trading-comparison-tick-attribution.test.ts packages/domain/src/paper-trading-comparison-checkpoint.test.ts packages/application/src/trading/paper/comparison-tick-coordinator.test.ts packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts
npm run typecheck
npm run check:repo-guards
npm test
git diff --check
```

Expected: all focused tests, workspace typechecks, repository guards, and full suite pass.

- [ ] **Step 6: Commit durable repeated-checkpoint evidence**

```bash
git add AGENTS.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-11-repeated-paired-comparison-checkpoint-design.md docs/superpowers/plans/2026-07-11-repeated-paired-comparison-checkpoint.md packages/application/src/trading/paper/comparison-coordinator.test.ts
git commit -m "docs: record repeated paired checkpoint"
```

## Plan Self-Review

- The spec's fourteen acceptance items map to named tests or commands.
- Sequence-1 compatibility and sequence-2 mandatory predecessor/ack rules are explicit in every
  domain, Store, session, and coordinator task.
- Tick capture, view advance, candidate acknowledgement, preparation, and atomic commit are separate
  authority boundaries.
- The persisted attempt precedes in-memory view effects and restart never claims that those effects
  survived.
- Partial view/preparation/commit failures create no one-sided economic evidence.
- Provider request, deadline, cadence, observation-count, and elapsed-time bounds are carried across
  both checkpoints.
- No task adds scheduling, resume, adjudication, confirmation, release, promotion, private access,
  live authority, or public composition.
