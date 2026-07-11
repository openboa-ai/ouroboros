# Paired Paper Comparison Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic read-only qualification decision that admits only cleanly stopped,
canonically qualified champion/challenger windows with complete exact-TradingRun Ledger lineage.

**Architecture:** A pure decision module maps validated window, side qualification, and Ledger facts
to stable paired blockers. A Store-backed application service reuses the comparison-window reader
as the graph gate, invokes canonical side qualification, and passes exact-run evidence to the pure
decision. No record or public composition is added.

**Tech Stack:** TypeScript, Vitest, Ouroboros domain qualification functions,
`OuroborosStorePort`, LocalStore fixtures.

**Design:**
`docs/superpowers/specs/2026-07-12-paired-paper-comparison-qualification-design.md`

## Global Constraints

- Qualification is evidence quality, never score comparison, winner selection, or promotion.
- Both sides use canonical `qualifyPaperTradingEvaluation` with frozen comparison minimums.
- Ledger evidence comes from each exact qualification TradingRun, not candidate aggregate state.
- Checkpoint Ledger refs and complete run-chain refs must be exactly equal.
- Empty Ledger sets are valid only for all-no-order paired evidence.
- Assessment is deterministic and write-free; graph corruption rejects.
- No durable record, public composition, adjudication, release, promotion, private, or live authority.

---

### Task 1: Define the pure paired qualification decision

**Files:**
- Create: `packages/application/src/trading/paper/comparison-qualification-decision.ts`
- Create: `packages/application/src/trading/paper/comparison-qualification-decision.test.ts`

**Interfaces:**
- Consumes: `PaperTradingQualificationResult`, `LedgerReadModel`
- Produces: `PaperTradingComparisonQualificationResult`
- Produces: `decidePaperTradingComparisonQualification`

- [ ] **Step 1: Write failing decision tests**

Define the exact input:

```ts
interface PaperTradingComparisonQualificationDecisionInput {
  comparisonId: string;
  activationId: string;
  activationAttemptId: string;
  windowPhase: PaperTradingComparisonWindowPhase;
  finalOutcomeReason?: PaperTradingComparisonActivationOutcomeReason;
  checkpointCount: number;
  minimumObservationCount: number;
  minimumElapsedMs: number;
  activationAttemptedAt: string;
  latestTickObservedAt: string;
  champion: PaperTradingComparisonQualificationSideInput;
  challenger: PaperTradingComparisonQualificationSideInput;
}

interface PaperTradingComparisonQualificationSideInput {
  tradingRunId: string;
  projectedTradingRunId?: string;
  qualification: PaperTradingQualificationResult;
  expectedLedgerRefs: readonly Ref[];
  ledger?: LedgerReadModel;
}
```

Test clean empty no-order qualification; complete order/gateway/execution refs; shared checkpoint
count and `latestTickObservedAt - activationAttemptedAt` minimums; every canonical side status;
running/failed/recovery/non-handoff windows; missing projection; wrong exact run; incomplete chain;
duplicate, missing, extra, and cross-run refs; deterministic reason order; input immutability; and
exact replay.

- [ ] **Step 2: Run decision tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-qualification-decision.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure decision**

Create:

```ts
export type PaperTradingComparisonQualificationStatus = "qualified" | "not_qualified";

export type PaperTradingComparisonQualificationReason =
  | "comparison_window_not_stopped_cleanly"
  | "comparison_window_not_completed_normally"
  | "comparison_checkpoint_incomplete"
  | "comparison_minimum_observation_count_not_met"
  | "comparison_minimum_elapsed_not_met"
  | "champion_not_qualified"
  | "challenger_not_qualified"
  | "champion_ledger_incomplete"
  | "challenger_ledger_incomplete"
  | "champion_ledger_lineage_mismatch"
  | "challenger_ledger_lineage_mismatch";

export interface PaperTradingComparisonQualificationResult {
  comparison_id: string;
  activation_id: string;
  activation_attempt_id: string;
  qualification_status: PaperTradingComparisonQualificationStatus;
  qualification_reasons: PaperTradingComparisonQualificationReason[];
  checkpoint_count: number;
  champion: PaperTradingQualificationResult;
  challenger: PaperTradingQualificationResult;
  authority_status: "not_verdict";
}
```

Flatten actual refs from every chain's order request, gateway result, and execution result. Require
every chain complete, exact projected run identity, supported ref kinds, no duplicates, and sorted
set equality. An absent ledger is incomplete; an exact empty ledger matches only empty expected refs.

- [ ] **Step 4: Run decision tests and typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-qualification-decision.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: all decision tests and typecheck pass.

- [ ] **Step 5: Commit the decision**

```bash
git add packages/application/src/trading/paper/comparison-qualification-decision.ts packages/application/src/trading/paper/comparison-qualification-decision.test.ts
git commit -m "feat: decide paired paper qualification"
```

### Task 2: Load exact Store evidence and canonical side qualification

**Files:**
- Create: `packages/application/src/trading/paper/comparison-qualification-service.ts`
- Create: `packages/application/src/trading/paper/comparison-qualification-service.test.ts`

**Interfaces:**
- Consumes: `PaperTradingComparisonWindowStateReader.load`
- Consumes: `OuroborosStorePort`, `qualifyPaperTradingEvaluation`
- Consumes: `decidePaperTradingComparisonQualification`
- Produces: `PaperTradingComparisonQualificationService.assess`

- [ ] **Step 1: Write failing service tests**

Define:

```ts
export class PaperTradingComparisonQualificationService {
  constructor(options: {
    store: OuroborosStorePort;
    windowReader: PaperTradingComparisonWindowStateReader;
  });

  assess(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonQualificationResult>;
}
```

Using a scripted reader and focused Store mock with real records, assert invalid input rejects before
reads; graph errors retain cause code; exact activation/attempt/comparison/outcome/checkpoint refs are
loaded; each side loads exact commitment/evaluation/observations/run projection; canonical
qualification receives `runnerActive: false` plus frozen minimum count/elapsed; checkpoint Ledger
refs are flattened per role; reader facts supply shared activation/latest-tick elapsed time to the
pure decision; no mutation method runs; and replay is deeply equal.

- [ ] **Step 2: Run service tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-qualification-service.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement strict Store loading**

Normalize IDs, call the window reader first, load exact activation and latest attempt, load the bound
comparison commitment, require contiguous checkpoint attempts with one terminal outcome each, load
both role-bound evidence closures and exact run projections, invoke canonical side qualification,
then return the pure decision unchanged.

Wrap missing/corrupt evidence as:

```ts
new PaperTradingComparisonQualificationServiceError(
  "paper_trading_comparison_qualification_graph_invalid",
  "Paper comparison qualification graph is unreadable or inconsistent.",
  { cause_code: stableErrorCode(error) }
)
```

Expected `not_qualified` decisions are returned, not thrown.

- [ ] **Step 4: Run service and qualification regressions**

```bash
npx vitest run packages/application/src/trading/paper/comparison-qualification-service.test.ts packages/application/src/trading/paper/comparison-window-state.test.ts packages/application/src/trading/paper/qualification.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: service, window, canonical qualification, and typecheck pass.

- [ ] **Step 5: Commit the service**

```bash
git add packages/application/src/trading/paper/comparison-qualification-service.ts packages/application/src/trading/paper/comparison-qualification-service.test.ts
git commit -m "feat: qualify stopped paper comparisons"
```

### Task 3: Prove stopped-window and exact-run Ledger behavior

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`
- Modify: `packages/local-store/test/local-store.test.ts` only if projection defects are found

**Interfaces:**
- Consumes: Tasks 1-2
- Produces: real LocalStore/session paired qualification evidence

- [ ] **Step 1: Extend the sequence-3 integration**

After runner-driven orderly stop, assess the same activation and require:

```ts
expect(await qualifier.assess({ activationId, activationAttemptId })).toMatchObject({
  qualification_status: "qualified",
  qualification_reasons: [],
  checkpoint_count: 3,
  champion: { qualification_status: "qualified" },
  challenger: { qualification_status: "qualified" },
  authority_status: "not_verdict"
});
```

Repeat assessment and assert no record count changes.

- [ ] **Step 2: Add exact-run negative integrations**

Use Store proxies to substitute the default run, add an extra chain, remove gateway/execution from
an expected chain, hide an expected ref, and drift evaluation/checkpoint evidence. Require stable
Ledger blockers or graph rejection. Restart-rematerialized evidence must return the same qualified
result.

- [ ] **Step 3: Run integration and LocalStore regressions**

```bash
npx vitest run packages/application/src/trading/paper/comparison-qualification-decision.test.ts packages/application/src/trading/paper/comparison-qualification-service.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts -t "paired qualification|three paired checkpoints"
npx vitest run packages/local-store/test/local-store.test.ts
```

Expected: qualified no-order window, exact-run negatives, restart parity, and LocalStore pass.

- [ ] **Step 4: Commit integration evidence**

```bash
git add packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts
git commit -m "test: prove paired paper qualification"
```

### Task 4: Update durable truth and verify the frontier

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-12-paired-paper-comparison-qualification-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-paired-paper-comparison-qualification.md`

**Interfaces:**
- Records: read-only paired evidence-quality qualification
- Leaves closed: adjudication, verdict, release, confirmation, promotion, and public composition

- [ ] **Step 1: Update canonical docs**

Record `PaperTradingComparisonQualification` as a read-only application decision that requires both
canonical side qualifications and exact run-specific Ledger lineage. `qualified` permits only later
adjudication and carries `not_verdict` authority.

- [ ] **Step 2: Verify no forbidden composition or verdict output**

```bash
rg -n "PaperTradingComparisonQualificationService|decidePaperTradingComparisonQualification" apps packages --glob '!**/*.test.ts'
rg -n "winner|promotion_eligible|score_lift|p_value" packages/application/src/trading/paper/comparison-qualification-*.ts
```

Expected: internal application definitions only and no winner/statistical/promotion output.

- [ ] **Step 3: Run repository verification**

```bash
npx vitest run packages/application/src/trading/paper/comparison-qualification-decision.test.ts packages/application/src/trading/paper/comparison-qualification-service.test.ts packages/application/src/trading/paper/comparison-window-state.test.ts packages/application/src/trading/paper/comparison-window-driver.test.ts packages/application/src/trading/paper/comparison-window-runner.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts
npm run typecheck
npm run check:repo-guards
npm test
git diff --check
```

Expected: focused tests, all typechecks, guards, full suite, and diff checks pass in the required
localhost/subprocess-capable environment.

- [ ] **Step 4: Commit durable evidence**

```bash
git add AGENTS.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-12-paired-paper-comparison-qualification-design.md docs/superpowers/plans/2026-07-12-paired-paper-comparison-qualification.md
git commit -m "docs: record paired paper qualification"
```

## Plan Self-Review

- Every design acceptance item maps to Tasks 1-4.
- Decision logic, Store orchestration, stopped-window integration, and docs are separately reviewable.
- Canonical side qualification remains the only account/score/fill quality model.
- Exact run identity and ref-set equality block aggregate/default-run substitution.
- Empty all-no-order evidence is distinct from missing order-bearing chains.
- No task adds score comparison, winner, verdict, release, confirmation, promotion, public
  composition, private access, process resume, or live authority.
- No placeholders remain and all cross-task interface names are consistent.
