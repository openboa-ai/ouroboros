# Paper Trading Comparison Verdict Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist one sealed, promotion-ineligible external verdict for every settled paper
comparison while preserving negative evidence and releasing the pair for another precommitted
window.

**Architecture:** Domain owns the qualification snapshot and verdict schema/digests. A pure
application decision compares only qualified frozen net-revenue scores. An application service
reloads exact evidence after paired qualification, and LocalStore is the append-only referential
authority that also changes active-pair conflict from historical preparation to unterminated
comparison.

**Tech Stack:** TypeScript, Vitest, `@ouroboros/domain`, `@ouroboros/application`, LocalStore JSON
records, existing paired qualification and comparison fixtures.

**Design:**
`docs/superpowers/specs/2026-07-12-paper-trading-comparison-verdict-design.md`

## Global Constraints

- Every settled positive, negative, or ineligible window receives one deterministic verdict.
- Qualified score comparison uses only frozen `net_revenue_usdt`; improved means lift is positive
  and at least the frozen minimum.
- Unqualified verdicts carry no side score or metric fields.
- Every verdict remains `sealed`, `not_eligible` for promotion, and `not_live`.
- No prior verdict can count confirmation without a campaign precommitted before outcomes.
- Candidate/provider output, rank, research claims, and future windows cannot affect the decision.
- No public command, operator projection, Finding, Lineage, TradingPromotion, private, or live
  composition is added.

---

### Task 1: Define domain-owned qualification and verdict evidence

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/paper-trading-comparison-verdict.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-qualification-decision.ts`
- Modify: `packages/application/src/trading/paper/comparison-qualification-decision.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonQualificationStatus`
- Produces: `PaperTradingComparisonQualificationReason`
- Produces: `PaperTradingComparisonQualificationResult`
- Produces: `PaperTradingComparisonVerdictRecord` and nested verdict types
- Produces: `paperTradingComparisonQualificationResultDigestInput`
- Produces: `paperTradingComparisonVerdictDigestInput`
- Produces: `paperTradingComparisonVerdictHasRuntimeShape`
- Preserves: application exports of the moved qualification types

- [ ] **Step 1: Write failing domain schema tests**

Create valid qualified-improved, qualified-not-improved, and ineligible verdict fixtures. Assert:

```ts
expect(paperTradingComparisonVerdictHasRuntimeShape(improved)).toBe(true);
expect(paperTradingComparisonVerdictHasRuntimeShape(notImproved)).toBe(true);
expect(paperTradingComparisonVerdictHasRuntimeShape(ineligible)).toBe(true);
expect(paperTradingComparisonVerdictDigestInput(improved)).toBe(
  paperTradingComparisonPersistedRecordDigestInput(expectedPayload)
);
```

Add table cases that reject a changed qualification ID, missing exact side ref, non-finite score,
metric arithmetic drift, score-bearing ineligible record, score-less qualified record, wrong next
action, promotion eligibility other than `not_eligible`, non-sealed release, confirmation counted,
private/live authority, reordered or unequal checkpoint ref/digest arrays, and non-canonical time.

- [ ] **Step 2: Run the domain test and verify RED**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-verdict.test.ts
```

Expected: FAIL because the verdict exports do not exist.

- [ ] **Step 3: Move the qualification result vocabulary into domain**

Define the existing application result shape in `@ouroboros/domain` without changing field names:

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

Import and re-export these exact types from `comparison-qualification-decision.ts`; keep existing
call sites source-compatible.

- [ ] **Step 4: Implement verdict types, canonical digest inputs, and runtime shape**

Implement the exact schema from the design. `paperTradingComparisonVerdictDigestInput` removes
record kind, version, ID, and `verdict_digest`, then delegates to
`paperTradingComparisonPersistedRecordDigestInput`. Runtime shape must enforce:

```ts
const scored = value.pair_qualification.qualification_status === "qualified";
if (scored) {
  return hasBothSideScores(value) && metricArithmeticMatches(value) &&
    value.verdict_outcome !== "comparison_ineligible";
}
return noSideScores(value) && value.metric === undefined &&
  value.verdict_outcome === "comparison_ineligible";
```

Require a positive observed lift at or above minimum only for `challenger_improved`; all other
qualified lifts map to `challenger_not_improved`. Require the outcome-specific confirmation
disposition and next action from the design.

- [ ] **Step 5: Run domain and existing qualification regressions**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-verdict.test.ts packages/application/src/trading/paper/comparison-qualification-decision.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
```

Expected: verdict schema tests and existing paired qualification tests pass; both typechecks pass.

- [ ] **Step 6: Commit domain evidence**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-verdict.test.ts packages/application/src/trading/paper/comparison-qualification-decision.ts packages/application/src/trading/paper/comparison-qualification-decision.test.ts
git commit -m "feat: define paper comparison verdict evidence"
```

### Task 2: Implement the pure single-window metric decision

**Files:**
- Create: `packages/application/src/trading/paper/comparison-verdict-decision.ts`
- Create: `packages/application/src/trading/paper/comparison-verdict-decision.test.ts`

**Interfaces:**
- Consumes: `PaperTradingComparisonQualificationResult`
- Consumes: `TradingProfitLossReadModel`
- Produces: `decidePaperTradingComparisonVerdict`
- Produces: `PaperTradingComparisonVerdictDecision`

- [ ] **Step 1: Write failing decision tests**

Use this input and result contract:

```ts
interface PaperTradingComparisonVerdictDecisionInput {
  pairQualification: PaperTradingComparisonQualificationResult;
  minimumLiftUsdt: number;
  championScore?: TradingProfitLossReadModel;
  challengerScore?: TradingProfitLossReadModel;
}

interface PaperTradingComparisonVerdictDecision {
  verdict_outcome:
    | "challenger_improved"
    | "challenger_not_improved"
    | "comparison_ineligible";
  champion?: { net_revenue_usdt: number; cost_usdt: number };
  challenger?: { net_revenue_usdt: number; cost_usdt: number };
  metric?: PaperTradingComparisonVerdictMetric;
  confirmation_disposition: "requires_precommitted_campaign" | "not_applicable";
  next_action:
    | "precommit_confirmation_campaign"
    | "return_to_candidate_arena"
    | "repair_evidence_or_rerun_comparison";
}
```

Cover positive lift above and exactly at a positive threshold, positive lift below threshold, zero,
negative, a zero frozen threshold with equal scores, six-decimal rounding, qualified pair with
non-qualified side, non-finite or negative minimum, missing qualified scores, score-bearing
ineligible input, every ineligible reason, immutability, and deterministic replay.

- [ ] **Step 2: Run the decision test and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-verdict-decision.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure decision**

For qualified evidence, round score values and:

```ts
const lift = round6(challenger.net_revenue_usdt - champion.net_revenue_usdt);
const improved = lift > 0 && lift >= minimumLiftUsdt;
```

Return `comparison_ineligible` without economic fields for any valid `not_qualified` pair. Throw
`PaperTradingComparisonVerdictDecisionError` with code
`invalid_paper_trading_comparison_verdict_decision_input` for malformed combinations.

- [ ] **Step 4: Run tests and application typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-verdict-decision.test.ts packages/application/src/trading/paper/comparison-qualification-decision.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: all pure decision regressions and typecheck pass.

- [ ] **Step 5: Commit the metric decision**

```bash
git add packages/application/src/trading/paper/comparison-verdict-decision.ts packages/application/src/trading/paper/comparison-verdict-decision.test.ts
git commit -m "feat: decide paper comparison verdict"
```

### Task 3: Persist exact verdicts and release only terminated pairs

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Produces: `OuroborosStorePort.recordPaperTradingComparisonVerdict`
- Produces: `OuroborosStorePort.getPaperTradingComparisonVerdict`
- Produces: `OuroborosStorePort.listPaperTradingComparisonVerdicts`
- Changes: active pair means a preparation with no exact terminal verdict

- [ ] **Step 1: Write failing LocalStore persistence tests**

Using a fully persisted stopped comparison fixture, assert:

```ts
await expect(store.recordPaperTradingComparisonVerdict(verdict)).resolves.toEqual(verdict);
await expect(store.recordPaperTradingComparisonVerdict(verdict)).resolves.toEqual(verdict);
await expect(store.getPaperTradingComparisonVerdict(verdictId)).resolves.toEqual(verdict);
await expect(store.listPaperTradingComparisonVerdicts(comparisonId))
  .resolves.toEqual([verdict]);
```

Before the verdict, a second preparation for the unordered candidate-version pair must reject with
`paper_trading_comparison_active_pair_conflict`. After any valid terminal verdict, a new
idempotency-key preparation for that same ordered role pair must succeed. A missing verdict must not
release the pair.

Add rejection cases for malformed shape, digest mismatch, missing or reordered checkpoints,
wrong activation/attempt/final outcome, unstopped evaluations, side identity/digest drift, metric
arithmetic drift, changed replay, a second verdict for the same comparison, and a verdict whose
qualification IDs/count disagree with Store evidence.

- [ ] **Step 2: Run selected Store tests and verify RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "comparison verdict|active pair"
```

Expected: FAIL because Store methods and terminal-pair semantics do not exist.

- [ ] **Step 3: Add the Store port and LocalStore record family**

Add:

```ts
recordPaperTradingComparisonVerdict(
  verdict: PaperTradingComparisonVerdictRecord
): Promise<PaperTradingComparisonVerdictRecord>;
getPaperTradingComparisonVerdict(
  verdictId: string
): Promise<PaperTradingComparisonVerdictRecord | undefined>;
listPaperTradingComparisonVerdicts(
  comparisonId?: string
): Promise<PaperTradingComparisonVerdictRecord[]>;
```

Persist under `paper-trading-comparison-verdicts/items`. Validate canonical digest before any write,
then reload and validate exact commitment, activation, attempt, final outcome, latest tick, ordered
checkpoint outcomes, qualification snapshot IDs/count, both side identities/digests, stopped
evaluations, and metric arithmetic. Exact replay returns the stored record; changed replay throws
`paper_trading_comparison_verdict_conflict`.

- [ ] **Step 4: Change active-pair conflict to terminal ownership**

In `reservePaperTradingComparisonPreparationUnlocked`, load existing verdicts once and build the set
of terminated comparison IDs. A prior preparation conflicts only when its
`paper_trading_comparison_commitment_id` is absent from that set. Do not infer termination from a
stopped run, activation outcome, clock time, or qualification result alone.

- [ ] **Step 5: Run all LocalStore tests and typechecks**

```bash
npx vitest run packages/local-store/test/local-store.test.ts
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/application
```

Expected: new verdict/active-pair cases and every existing LocalStore test pass; both typechecks
pass.

- [ ] **Step 6: Commit persistence authority**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist paper comparison verdicts"
```

### Task 4: Build the external verdict application service

**Files:**
- Create: `packages/application/src/trading/paper/comparison-verdict-service.ts`
- Create: `packages/application/src/trading/paper/comparison-verdict-service.test.ts`

**Interfaces:**
- Consumes: `PaperTradingComparisonQualificationService.assess`
- Consumes: exact `OuroborosStorePort` comparison reads and verdict write
- Consumes: `decidePaperTradingComparisonVerdict`
- Produces: `PaperTradingComparisonVerdictService.evaluate`

- [ ] **Step 1: Write failing service tests**

Define:

```ts
export class PaperTradingComparisonVerdictService {
  constructor(options: {
    store: OuroborosStorePort;
    qualifications: Pick<PaperTradingComparisonQualificationService, "assess">;
    now?: () => string;
  });

  evaluate(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonVerdictRecord>;
}
```

Assert invalid IDs reject before dependencies; qualification runs before verdict reads; qualified
positive and negative decisions embed exact refs/digests and scores; settled unqualified evidence
embeds no scores; `both_running`, open attempt, `cleanup_required`, ownership loss, and unstopped
evaluations reject as not terminal; Store/qualification cause codes survive graph wrapping; exact
replay calls Store with a deeply equal record; `evaluated_at` comes only from the service clock; no
provider, runner, command, promotion, or release method is called.

- [ ] **Step 2: Run service tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-verdict-service.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement strict evidence loading and record construction**

Normalize IDs, call qualification first, and reload exact evidence. Require final
`stopped_cleanly`, both exact evaluations `stopped`, no open checkpoint attempt, and ordered
terminal outcomes. Build qualification and verdict digests with domain canonical helpers. Derive
the deterministic verdict ID from comparison and activation-attempt IDs. For qualified evidence,
pass exact evaluation scores to the pure decision; for unqualified evidence pass no scores.

Wrap graph faults as:

```ts
new PaperTradingComparisonVerdictServiceError(
  "paper_trading_comparison_verdict_graph_invalid",
  "Paper comparison verdict graph is unreadable or inconsistent.",
  { cause_code: stableErrorCode(error) }
)
```

Return Store conflict and invalid-input errors with their stable codes; do not turn expected
`comparison_ineligible` into an exception.

- [ ] **Step 4: Run service, qualification, decision, and typecheck regressions**

```bash
npx vitest run packages/application/src/trading/paper/comparison-verdict-service.test.ts packages/application/src/trading/paper/comparison-verdict-decision.test.ts packages/application/src/trading/paper/comparison-qualification-service.test.ts packages/application/src/trading/paper/comparison-window-state.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: verdict service and upstream qualification/window contracts pass; typecheck passes.

- [ ] **Step 5: Commit application adjudication**

```bash
git add packages/application/src/trading/paper/comparison-verdict-service.ts packages/application/src/trading/paper/comparison-verdict-service.test.ts
git commit -m "feat: adjudicate paper comparison windows"
```

### Task 5: Prove real negative verdict, replay, restart, and pair release

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4
- Produces: real LocalStore/session terminal verdict evidence

- [ ] **Step 1: Extend the real sequence-3 integration**

After the existing qualified zero-score sequence-3 window, evaluate and require:

```ts
expect(verdict).toMatchObject({
  pair_qualification: { qualification_status: "qualified" },
  verdict_outcome: "challenger_not_improved",
  metric: {
    metric_kind: "net_revenue_usdt",
    champion_value_usdt: 0,
    challenger_value_usdt: 0,
    observed_lift_usdt: 0
  },
  confirmation_disposition: "not_applicable",
  promotion_eligibility: "not_eligible",
  release_status: "sealed",
  authority_status: "not_live"
});
```

Repeat evaluation and assert one stored verdict. Restart LocalStore, recompute qualification, and
assert exact verdict replay without new provider, sandbox, decision, Ledger, observation, or score
evidence.

- [ ] **Step 2: Prove the terminal verdict releases only the experiment pair**

Before verdict persistence, retain the existing active-pair conflict assertion. After verdict,
prepare the same champion/challenger versions under a new idempotency key and assert new inert run,
commitment, and evaluation IDs with zero provider/sandbox/market effects. Assert the old verdict is
not referenced as confirmation and the new comparison remains unactivated.

- [ ] **Step 3: Run real integration and full Store regressions**

```bash
npx vitest run packages/application/src/trading/paper/comparison-coordinator.test.ts -t "three paired checkpoints"
npx vitest run packages/local-store/test/local-store.test.ts
```

Expected: real negative verdict, idempotency, restart parity, terminal pair release, and all Store
tests pass.

- [ ] **Step 4: Commit real verdict evidence**

```bash
git add packages/application/src/trading/paper/comparison-coordinator.test.ts
git commit -m "test: prove paper comparison verdict lifecycle"
```

### Task 6: Update durable truth and verify the frontier

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-12-paper-trading-comparison-verdict-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-paper-trading-comparison-verdict.md`

**Interfaces:**
- Records: terminal single-window external verdict and pair release
- Leaves closed: post-hoc confirmation, campaign, release, promotion, and public composition

- [ ] **Step 1: Update canonical docs**

Add `PaperTradingComparisonVerdict` as a sealed append-only external evidence decision. State that
all outcomes remain promotion-ineligible, any terminal verdict frees only the experiment pair, and
the next valid confirmation step is a campaign precommitted before outcomes. Preserve the explicit
closure of Finding/Lineage release, TradingPromotion, private access, and live authority.

- [ ] **Step 2: Verify no forbidden composition**

```bash
rg -n "PaperTradingComparisonVerdictService|recordPaperTradingComparisonVerdict" apps packages --glob '!**/*.test.ts'
rg -n "promotion_eligibility: \"eligible\"|release_status: \"released\"|confirmation_count" packages/domain/src/index.ts packages/application/src/trading/paper/comparison-verdict-*.ts
```

Expected: domain, Store port/adapter, and internal application service only; no app/controller match
and no eligible, released, or post-hoc confirmation output.

- [ ] **Step 3: Run focused and repository-wide verification**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-verdict.test.ts packages/application/src/trading/paper/comparison-verdict-decision.test.ts packages/application/src/trading/paper/comparison-verdict-service.test.ts packages/application/src/trading/paper/comparison-qualification-decision.test.ts packages/application/src/trading/paper/comparison-qualification-service.test.ts packages/application/src/trading/paper/comparison-window-state.test.ts packages/application/src/trading/paper/comparison-window-driver.test.ts packages/application/src/trading/paper/comparison-window-runner.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts
npm run typecheck
npm run check:repo-guards
npm test
git diff --check
```

Expected: all focused tests, workspace typechecks, guards, full suite, and diff checks pass in the
localhost/subprocess-capable environment.

- [ ] **Step 4: Commit durable verdict truth**

```bash
git add AGENTS.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-12-paper-trading-comparison-verdict-design.md docs/superpowers/plans/2026-07-12-paper-trading-comparison-verdict.md
git commit -m "docs: record paper comparison verdicts"
```

## Plan Self-Review

- All ten design acceptance items map to Tasks 1-6.
- Domain type ownership prevents Store-to-application dependency inversion.
- Pure score policy, evidence construction, Store authority, real integration, and writeback are
  independently reviewable.
- Ineligible closure preserves failures without exposing sealed score fields.
- Active-pair release depends only on an exact persisted verdict, never on time or inferred stop.
- Improved verdicts cannot become confirmation because no campaign or confirmation count exists.
- No task adds Finding/Lineage release, TradingPromotion, public composition, private access, or
  live authority.
- No placeholders remain and all cross-task type and method names are consistent.
