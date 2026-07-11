# Bounded Paper Comparison Window Driver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically advance one owned paper comparison through its frozen observation/time
window with one reconstructible, bounded transition per step.

**Architecture:** A pure classifier maps one validated durable graph to the next legal action. A
Store-backed state reader owns graph validation and projects exact transition facts and IDs. An
application driver invokes at most one existing tick/checkpoint/activation coordinator effect and
returns a read-only step result. A process-local timer runner repeats steps without overlapping
calls and never adopts a comparison after restart.

**Tech Stack:** TypeScript, Vitest, existing Ouroboros domain predicates, application coordinator
ports, LocalStore JSON evidence, Node.js timers.

**Design:**
`docs/superpowers/specs/2026-07-11-bounded-paper-comparison-window-driver-design.md`

## Global Constraints

- One driver call performs at most one effecting transition.
- Candidates own their decision and acknowledgement cadence; the driver never calls candidate
  endpoints or fabricates input consumption.
- Exact waiting is a return state, while graph corruption and unexpected child errors reject.
- Normal stopping is determined only by frozen maximum observation/time bounds, never current
  score or minimum qualification thresholds.
- Persisted `both_running` evidence without process-local ownership is `recovery_required`, never
  adopted.
- Restart rematerializes committed bundles and stops unowned sessions; it does not resume a provider
  or candidate process.
- Existing tick, checkpoint, and activation coordinators remain the sole evidence writers.
- No new domain record, public command, runtime controller, CLI, TUI, Web, Desktop, qualification,
  adjudication, release, promotion, private access, or live authority is added.

---

### Task 1: Define the pure window state classifier

**Files:**
- Create: `packages/application/src/trading/paper/comparison-window-state.ts`
- Create: `packages/application/src/trading/paper/comparison-window-state.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonWindowPhase`
- Produces: `PaperTradingComparisonWindowDecision`
- Produces: `classifyPaperTradingComparisonWindow`
- Consumes: already validated policy, activation, tick, checkpoint, acknowledgement, and clock facts

- [x] **Step 1: Write failing classifier tests**

Define a compact input made only of validated facts:

```ts
export interface PaperTradingComparisonWindowFacts {
  owned: boolean;
  now: string;
  activation_attempted_at: string;
  interval_ms: number;
  maximum_observation_count: number;
  maximum_elapsed_ms: number;
  tick_count: number;
  latest_tick_observed_at: string;
  checkpoint_attempt_count: number;
  paired_checkpoint_count: number;
  latest_checkpoint_status?: "open" | "paired" | "incomplete";
  latest_checkpoint_has_failed_side: boolean;
  latest_checkpoint_deadline_at?: string;
  latest_tick_acknowledged_roles: readonly ("champion" | "challenger")[];
  activation_status: "both_running" | "stopped_cleanly" | "cleanup_required";
}
```

Test exact decisions for:

- no first checkpoint before and at `first_tick_observed_at + interval_ms`;
- paired checkpoint waiting for zero/one acknowledgement;
- paired checkpoint with both acknowledgements and room for another tick;
- one captured tick awaiting `begin_next_checkpoint`;
- one open attempt waiting for acknowledgements, ready to complete, and deadline-expired;
- max observation and next-cadence-over-max-elapsed orderly stop;
- incomplete, failed-side, stopped-cleanly, cleanup-required, and lost-ownership terminal states;
- impossible cardinalities rejected with `paper_trading_comparison_window_graph_invalid`.

- [x] **Step 2: Run classifier tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-window-state.test.ts
```

Expected: FAIL because the state types and classifier do not exist.

- [x] **Step 3: Implement the total classifier**

Return:

```ts
export type PaperTradingComparisonWindowTransition =
  | "none"
  | "capture_first_checkpoint"
  | "capture_next_tick"
  | "begin_next_checkpoint"
  | "complete_next_checkpoint"
  | "stop_window";

export interface PaperTradingComparisonWindowDecision {
  phase: PaperTradingComparisonWindowPhase;
  transition: PaperTradingComparisonWindowTransition;
  checkpoint_sequence: number;
  terminal: boolean;
  next_wake_at?: string;
  stable_error_code?: string;
}
```

Validate exact ISO timestamps, positive bounds, `paired_checkpoint_count <=
checkpoint_attempt_count <= tick_count`, and at most one unpaired tick or open attempt. Resolve
terminal activation/failure states before effect states. For a healthy paired latest checkpoint,
stop only at max count or when `latest_tick_observed_at + interval_ms` exceeds the activation window
deadline; otherwise require both acknowledgements before next capture.

- [x] **Step 4: Run classifier tests and application typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-window-state.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: all classifier tests and application typecheck pass.

Actual: 14 classifier tests and `@ouroboros/application` typecheck passed. Lost ownership is
terminal for the current process runner while remaining an explicit recovery-required durable
state.

- [x] **Step 5: Commit the classifier**

```bash
git add packages/application/src/trading/paper/comparison-window-state.ts packages/application/src/trading/paper/comparison-window-state.test.ts
git commit -m "feat: classify paper comparison window progress"
```

Actual: committed with the complete bounded window as `5f90d31`.

### Task 2: Implement one-step durable window driving

**Files:**
- Create: `packages/application/src/trading/paper/comparison-window-reader.ts`
- Create: `packages/application/src/trading/paper/comparison-window-driver.ts`
- Create: `packages/application/src/trading/paper/comparison-window-driver.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-window-state.ts`

**Interfaces:**
- Consumes: `classifyPaperTradingComparisonWindow`
- Consumes: `PaperTradingComparisonWindowStateReader`
- Consumes: `PaperTradingComparisonTickCoordinator.captureNextTick`
- Consumes: `PaperTradingComparisonCheckpointCoordinator.captureFirst`, `beginNext`, and
  `completeNext`
- Consumes: runtime activation ownership and `stopOwnedAttempt`
- Produces: `PaperTradingComparisonWindowDriver.advance`

- [x] **Step 1: Write failing graph and effect tests**

Define the read port first:

```ts
export interface PaperTradingComparisonWindowSnapshot {
  facts: PaperTradingComparisonWindowFacts;
  latest_tick_id: string;
  latest_checkpoint_attempt_id?: string;
}

export interface PaperTradingComparisonWindowStateReader {
  load(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonWindowSnapshot>;
}
```

Then define the exact focused effect ports:

```ts
interface WindowTickPort {
  captureNextTick(input: {
    activationId: string;
    activationAttemptId: string;
    idempotencyKey: string;
  }): Promise<{ tick: PaperTradingComparisonTickRecord }>;
}

interface WindowCheckpointPort {
  captureFirst(input: {
    activationId: string;
    activationAttemptId: string;
    idempotencyKey: string;
  }): Promise<PaperTradingComparisonCheckpointOutcomeRecord>;
  beginNext(input: {
    activationId: string;
    activationAttemptId: string;
    tickId: string;
    idempotencyKey: string;
  }): Promise<PaperTradingComparisonCheckpointAttemptRecord>;
  completeNext(input: {
    checkpointAttemptId: string;
  }): Promise<PaperTradingComparisonCheckpointOutcomeRecord>;
}

interface WindowActivationPort {
  ownsRunningAttempt(attemptId: string): boolean;
  stopOwnedAttempt(input: {
    attemptId: string;
    reason: "handoff_cleanup";
  }): Promise<PaperTradingComparisonRuntimeActivationResult>;
}
```

Using Store mocks with real domain records, assert:

- every digest, contiguous sequence, predecessor, role/run, current evaluation, observation count,
  and acknowledgement is revalidated before classification;
- each phase invokes exactly one expected child method and no others;
- deterministic keys are
  `window:<activationAttemptId>:checkpoint:1`,
  `window:<activationAttemptId>:tick:<N>`, and
  `window:<activationAttemptId>:checkpoint:<N>`;
- waiting and recovery-required paths perform no effects;
- max count/time calls one orderly activation stop and requires `stopped_cleanly`;
- duplicate advance serializes through one queue and exact child replay remains idempotent;
- child rejection preserves its stable code and does not invoke a later transition.

- [x] **Step 2: Run driver tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-window-driver.test.ts
```

Expected: FAIL because `PaperTradingComparisonWindowDriver` does not exist.

- [x] **Step 3: Implement the reader contract and one-step driver**

Create:

```ts
export interface PaperTradingComparisonWindowDriverOptions {
  reader: PaperTradingComparisonWindowStateReader;
  ticks: WindowTickPort;
  checkpoints: WindowCheckpointPort;
  activations: WindowActivationPort;
  now?: () => string;
}

export class PaperTradingComparisonWindowDriver {
  advance(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonWindowStep>;
}
```

The driver loads one snapshot through the reader, calls the pure classifier, maps one transition to
one effect, then reloads through the reader. Unit tests use a scripted reader so effect sequencing
does not duplicate the repository's large persisted-record fixtures. Define the Store-backed reader
class contract now, but implement its exact graph validation under the real LocalStore RED in Task 4
before any production composition.

- [x] **Step 4: Implement one transition per call**

Map decisions exactly:

```ts
capture_first_checkpoint -> checkpoints.captureFirst(...)
capture_next_tick       -> ticks.captureNextTick(...)
begin_next_checkpoint   -> checkpoints.beginNext(...latestTickId...)
complete_next_checkpoint-> checkpoints.completeNext(...latestAttemptId...)
stop_window             -> activations.stopOwnedAttempt({ reason: "handoff_cleanup" })
none                    -> no effect
```

Reload after the effect and build the returned step from persisted evidence rather than trusting
the child return alone. Require orderly stop to return `stopped_cleanly`. Keep one per-driver promise
queue so concurrent calls cannot race phases.

- [x] **Step 5: Run driver, existing coordinator, and typecheck regressions**

```bash
npx vitest run packages/application/src/trading/paper/comparison-window-state.test.ts packages/application/src/trading/paper/comparison-window-driver.test.ts packages/application/src/trading/paper/comparison-tick-coordinator.test.ts packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: driver and existing sequence-N coordinator regressions pass.

Actual so far: 14 classifier and 9 driver tests passed together; application typecheck passed. The
existing sequence-N coordinator and Store-backed reader regressions now pass in the combined
application run. The classifier now has 18 cases including chronology and impossible-state
invariants.

- [x] **Step 6: Commit one-step driving**

```bash
git add packages/application/src/trading/paper/comparison-window-state.ts packages/application/src/trading/paper/comparison-window-reader.ts packages/application/src/trading/paper/comparison-window-driver.ts packages/application/src/trading/paper/comparison-window-driver.test.ts
git commit -m "feat: drive one paper comparison window step"
```

Actual: committed with the complete bounded window as `5f90d31`.

### Task 3: Add the bounded process-local runner

**Files:**
- Create: `packages/application/src/trading/paper/comparison-window-runner.ts`
- Create: `packages/application/src/trading/paper/comparison-window-runner.test.ts`

**Interfaces:**
- Consumes: `Pick<PaperTradingComparisonWindowDriver, "advance">`
- Produces: `PaperTradingComparisonWindowRunner.start`, `active`, `status`, `stopScheduling`, and
  `drain`

- [x] **Step 1: Write failing runner tests with fake timers**

Assert:

- `start` returns `started`, duplicate start returns `already_running`;
- one immediate step is scheduled and only one timeout exists afterward;
- a waiting step schedules the next poll without overlap;
- terminal step removes ownership and preserves the latest status;
- rejected step calls `onError`, records failed status, and does not reschedule;
- `stopScheduling` clears only timer ownership and explicitly does not claim runtime cleanup;
- `drain(attemptId, timeoutMs)` waits for an active step and returns false on timeout;
- multiple activation attempts remain isolated.

- [x] **Step 2: Run runner tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-window-runner.test.ts
```

Expected: FAIL because the runner does not exist.

- [x] **Step 3: Implement non-overlapping scheduling**

Use maps keyed by activation-attempt ID for timers, active promises, and latest status. Schedule with
recursive `setTimeout`; delete the timer before invoking `advance`; add/remove the active promise in
`finally`; reschedule only after a nonterminal fulfilled step and while ownership remains active.
Call `.unref()` when available. Follow `PaperTradingEvaluationRunner`'s bounded drain pattern.

- [x] **Step 4: Run runner and evaluation-runner regressions**

```bash
npx vitest run packages/application/src/trading/paper/comparison-window-runner.test.ts packages/application/src/trading/paper/session-service.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: runner tests, session runner compatibility, and typecheck pass.

Actual: 9 runner tests, the focused session/checkpoint/runtime set, and application typecheck pass.

- [x] **Step 5: Commit the runner**

```bash
git add packages/application/src/trading/paper/comparison-window-runner.ts packages/application/src/trading/paper/comparison-window-runner.test.ts
git commit -m "feat: run bounded paper comparison windows"
```

Actual: committed with classifier, reader, driver, and integration evidence as `5f90d31`.

### Task 4: Prove sequence 3, policy stop, and restart behavior

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-window-driver.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-window-runner.test.ts`
- Modify: `packages/local-store/test/local-store.test.ts` only if a sequence-3 Store defect is found

**Interfaces:**
- Consumes: Tasks 1-3
- Produces: complete bounded-window integration evidence

- [x] **Step 1: Write a LocalStore/session integration through sequence 3**

Extend the fake-provider integration to:

1. start with `maximum_observation_count: 3`;
2. commit checkpoint 1 through the established coordinator path and validate the reader's
   pre-checkpoint frozen-evaluation boundary;
3. deliver/ack each current tick independently for both roles;
4. establish sequence 2, then let the process-local runner drive tick/checkpoint sequence 3;
5. assert the next driver call invokes orderly stop;
6. assert exactly three ticks, attempts, paired outcomes, observations per role, and evaluation
   count 3;
7. assert provider starts 2, sandbox starts 2, and neither restarts during the window;
8. assert cumulative acknowledgement, account, score, processed-event, and Ledger lineage;
9. restart LocalStore, recover, and prove no decision or economic replay.

- [x] **Step 2: Add boundary and failure coverage**

Cover across pure classifier, one-step driver, checkpoint coordinator, Store, and session tests:

- elapsed boundary stops before capturing an ineligible next tick;
- one missing acknowledgement remains waiting with no writes;
- open attempt deadline produces one incomplete outcome and symmetric stop;
- lost ownership returns recovery required;
- a failed paired side stops and cannot schedule another tick;
- exact rerun of every step produces no duplicate record or market read.

Actual: count/time boundaries, missing acknowledgement, open-attempt cleanup, ownership loss,
paired candidate failure, deterministic child replay, cross-role acknowledgement tampering, initial
evaluation drift, exact stopped-successor recovery, and stopped-successor mutation are covered.

- [x] **Step 3: Run focused integration and full LocalStore tests**

```bash
npx vitest run packages/application/src/trading/paper/comparison-window-state.test.ts packages/application/src/trading/paper/comparison-window-driver.test.ts packages/application/src/trading/paper/comparison-window-runner.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts -t "comparison window|three paired checkpoints|bounded window"
npx vitest run packages/local-store/test/local-store.test.ts
```

Expected: complete sequence-3 window, boundary/failure cases, and all LocalStore tests pass.

Actual: the process-local runner drives the sequence-3 Store/session integration through orderly
stop; 18 classifier cases, 9 driver tests, 9 runner tests, 133 focused application tests, and all
298 LocalStore tests pass.

- [x] **Step 4: Commit bounded-window evidence**

```bash
git add packages/application/src/trading/paper/comparison-coordinator.test.ts packages/application/src/trading/paper/comparison-window-driver.test.ts packages/application/src/trading/paper/comparison-window-runner.test.ts packages/local-store/test/local-store.test.ts
git commit -m "test: prove bounded paper comparison window"
```

Actual: committed with the complete bounded window as `5f90d31`.

### Task 5: Update durable truth and verify the frontier

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-11-bounded-paper-comparison-window-driver-design.md`
- Modify: `docs/superpowers/plans/2026-07-11-bounded-paper-comparison-window-driver.md`

**Interfaces:**
- Records: internal bounded automatic window execution and conservative restart policy
- Leaves closed: qualification, adjudication, confirmation, release, promotion, public composition

- [x] **Step 1: Update canonical docs**

State that an internal application runner can automatically drive one owned comparison to its
precommitted max observation/time boundary without score-aware stopping. State that the runner is
process-local, Store-reconstructible, and cannot resume provider identity after restart. Preserve
the explicit closure of qualification and all later authority.

- [x] **Step 2: Verify no production composition**

```bash
rg -n "PaperTradingComparisonWindowDriver|PaperTradingComparisonWindowRunner" apps packages --glob '!**/*.test.ts'
```

Expected: internal application modules only; no app/controller/command composition.

Actual: only the internal application driver and runner modules matched outside tests.

- [x] **Step 3: Run focused and repository-wide verification**

```bash
npx vitest run packages/application/src/trading/paper/comparison-window-state.test.ts packages/application/src/trading/paper/comparison-window-driver.test.ts packages/application/src/trading/paper/comparison-window-runner.test.ts packages/application/src/trading/paper/comparison-tick-coordinator.test.ts packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts packages/application/src/trading/paper/comparison-runtime-activation-coordinator.test.ts packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts
npm run typecheck
npm run check:repo-guards
bash scripts/check-docs.sh
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
npm test
git diff --check
```

Expected: focused tests, all workspace typechecks, repository guards, full suite, docs, naming,
environment, secrets, and diff checks pass.

Actual: 133 focused application tests and all 298 LocalStore tests passed; all workspace
typechecks, repository guards, docs, architecture, naming, environment, secrets, and diff checks
passed; the escalated full suite passed all 1,485 tests across 97 files.

- [x] **Step 4: Commit durable window-driver evidence**

```bash
git add AGENTS.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-11-bounded-paper-comparison-window-driver-design.md docs/superpowers/plans/2026-07-11-bounded-paper-comparison-window-driver.md
git commit -m "docs: record bounded paper comparison windows"
```

## Plan Self-Review

- Every spec acceptance item maps to Tasks 1-5.
- Classification, effect orchestration, timer scheduling, real sequence-3 proof, and durable
  writeback are independently reviewable.
- The driver performs one transition per call and the runner never overlaps steps.
- Waiting, terminal policy, graph failure, and process ownership are distinct states.
- Maximum boundaries are frozen before outcomes and no score-aware optional stopping is introduced.
- Existing coordinators remain the only evidence writers; no duplicate mutable phase state exists.
- No task adds restart resume, qualification, adjudication, confirmation, release, promotion,
  private access, live authority, or public composition.
