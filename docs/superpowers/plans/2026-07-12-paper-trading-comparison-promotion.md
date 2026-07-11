# Paper Trading Comparison Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Status:** Ready for implementation

**Goal:** Make the explicit trading_candidate.promote command create one restart-stable, paper-only TradingPromotion only from an eligible confirmed comparison campaign bound to the exact current champion.

**Architecture:** Extend TradingPromotionRecord with immutable confirmation provenance, construct it in a focused application service, and make LocalStore independently validate the complete campaign, outcome, final verdict, qualification, and current-champion graph inside its existing comparison write transaction. Operator read models resolve the exact promotion-bound paper evaluation and expose a compact confirmation summary without starting or stopping a runtime.

**Tech Stack:** TypeScript, Vitest, @ouroboros/domain, application ports/services, LocalStore JSON evidence collections, Operator command/read models.

## Global Constraints

- Follow docs/superpowers/specs/2026-07-12-paper-trading-comparison-promotion-design.md exactly.
- Keep TradingPromotion, TradingReview, every source record, and every read model not_live.
- Only trading_candidate.promote composes the service into a product mutation.
- Never start or stop a runner, submit an order, access credentials or private exchange state, mutate CandidateArena selection, or auto-release research evidence.
- Successful promotion uses the final confirmation verdict challenger evaluation, never a candidate-latest fallback.
- Bootstrap requires no current promotion; replacement requires the campaign's exact frozen current-promotion ref and digest.
- LocalStore performs full graph validation and exact replay inside the comparison evidence write transaction.
- Use TDD and observe every focused RED failure before implementation.
- Commit after every independently reviewable task.

---

### Task 1: Define Comparison-Backed TradingPromotion Evidence

**Files:**
- Create: packages/domain/src/paper-trading-comparison-promotion.test.ts
- Modify: packages/domain/src/index.ts
- Modify: existing typed promotion fixtures found by rg

**Interfaces:**
- Produces TradingPromotionComparisonConfirmation.
- Requires TradingPromotionRecord.comparison_confirmation.
- Produces TradingPromotionComparisonConfirmationReadModel.
- Adds the read-only summary to TradingPromotionReadModel, TradingReviewReadModel, and TradingReviewPacketReadModel.evidence_quality.
- Preserves paperTradingComparisonTradingPromotionDigestInput as the full-record digest input.

- [ ] **Step 1: Write the failing domain tests**

Create the fixture and mutation pressure:

~~~ts
describe("paper trading comparison promotion evidence", () => {
  it("accepts one comparison-confirmed paper-only promotion", () => {
    expect(paperTradingComparisonTradingPromotionHasRuntimeShape(
      promotionFixture()
    )).toBe(true);
  });

  it("freezes the whole promotion record", () => {
    const promotion = promotionFixture();
    expect(paperTradingComparisonTradingPromotionDigestInput(promotion)).toBe(
      paperTradingComparisonPersistedRecordDigestInput(promotion)
    );
  });

  it.each([
    ["basis kind", (value: any) => {
      value.comparison_confirmation.basis_kind = "single_verdict";
    }],
    ["campaign ref", (value: any) => {
      value.comparison_confirmation.campaign_ref.record_kind =
        "paper_trading_comparison_verdict";
    }],
    ["outcome ref", (value: any) => {
      value.comparison_confirmation.campaign_outcome_ref.record_kind =
        "paper_trading_comparison_confirmation_campaign";
    }],
    ["final verdict ref", (value: any) => {
      value.comparison_confirmation.final_verdict_ref.record_kind =
        "paper_trading_comparison_confirmation_campaign_outcome";
    }],
    ["campaign digest", (value: any) => {
      value.comparison_confirmation.campaign_digest = "campaign";
    }],
    ["outcome digest", (value: any) => {
      value.comparison_confirmation.campaign_outcome_digest = "";
    }],
    ["verdict digest", (value: any) => {
      value.comparison_confirmation.final_verdict_digest = "sha256:";
    }],
    ["promotion time", (value: any) => {
      value.promoted_at = "2026-07-12 09:00:00";
    }],
    ["authority", (value: any) => {
      value.authority_status = "live";
    }]
  ])("rejects invalid %s", (_label, mutate) => {
    const promotion = promotionFixture() as any;
    mutate(promotion);
    expect(paperTradingComparisonTradingPromotionHasRuntimeShape(promotion))
      .toBe(false);
  });
});
~~~

The canonical fixture contains:

~~~ts
comparison_confirmation: {
  basis_kind: "paper_trading_comparison_confirmation",
  campaign_ref: {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    id: "campaign-001"
  },
  campaign_digest: "sha256:campaign",
  campaign_outcome_ref: {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    id: "campaign-001-outcome"
  },
  campaign_outcome_digest: "sha256:outcome",
  final_verdict_ref: {
    record_kind: "paper_trading_comparison_verdict",
    id: "campaign-001-slot-2-verdict"
  },
  final_verdict_digest: "sha256:verdict"
}
~~~

- [ ] **Step 2: Run RED**

~~~bash
npm test -- packages/domain/src/paper-trading-comparison-promotion.test.ts
~~~

Expected: FAIL because the new basis/read-model contracts do not exist and the old predicate accepts a bare promotion.

- [ ] **Step 3: Implement the domain contracts**

Add:

~~~ts
export interface TradingPromotionComparisonConfirmation {
  basis_kind: "paper_trading_comparison_confirmation";
  campaign_ref: Ref;
  campaign_digest: string;
  campaign_outcome_ref: Ref;
  campaign_outcome_digest: string;
  final_verdict_ref: Ref;
  final_verdict_digest: string;
}

export interface TradingPromotionComparisonConfirmationReadModel {
  campaign_id: string;
  campaign_outcome_id: string;
  final_verdict_id: string;
  required_window_count: number;
  improved_window_count: number;
  primary_metric: "net_revenue_usdt";
  minimum_net_revenue_lift_usdt: number;
  evaluated_at: string;
  evaluation_authority: "external_to_trading_systems";
  authority_status: "not_live";
}
~~~

Require comparison_confirmation on TradingPromotionRecord. Update paperTradingComparisonTradingPromotionHasRuntimeShape with exact basis kind, record kinds, digests, ISO timestamp, and not_live checks.

- [ ] **Step 4: Migrate all typed fixtures**

~~~bash
rg -n 'record_kind: "trading_promotion"' packages apps
~~~

Add a valid confirmation basis to every positive typed fixture. Malformed-input tests may omit or mutate it deliberately. Use fixture-local campaign/outcome/verdict IDs where LocalStore validates the graph.

- [ ] **Step 5: Verify and commit**

~~~bash
npm test -- packages/domain/src/paper-trading-comparison-promotion.test.ts packages/domain/src/paper-trading-comparison-commitment.test.ts
npm run typecheck -w @ouroboros/domain
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-promotion.test.ts
git commit -m "feat: bind promotions to comparison evidence"
~~~

Add only the fixture files actually changed by the required type migration.

---

### Task 2: Construct Promotions From Current Eligible Campaigns

**Files:**
- Create: packages/application/src/trading/paper/comparison-promotion-service.ts
- Create: packages/application/src/trading/paper/comparison-promotion-service.test.ts

**Interfaces:**
- Consumes OuroborosStorePort outcome, campaign, verdict, candidate, and current-promotion reads.
- Produces PaperTradingComparisonPromotionService.promote({ candidateId }).
- Produces stable PaperTradingComparisonPromotionServiceErrorCode values.

- [ ] **Step 1: Write failing service tests**

Cover:

~~~ts
const promotion = await service.promote({ candidateId: "challenger" });

expect(promotion).toMatchObject({
  candidate_ref: harness.campaign.challenger.candidate_ref,
  candidate_version_ref: harness.campaign.challenger.candidate_version_ref,
  paper_trading_evaluation_ref:
    harness.finalVerdict.challenger.paper_trading_evaluation_ref,
  comparison_confirmation: {
    basis_kind: "paper_trading_comparison_confirmation",
    campaign_ref: { id: harness.campaignId },
    campaign_digest: harness.campaign.campaign_digest,
    campaign_outcome_ref: { id: harness.outcomeId },
    campaign_outcome_digest: harness.outcome.outcome_digest,
    final_verdict_ref: { id: harness.finalVerdictId },
    final_verdict_digest: harness.finalVerdict.verdict_digest
  },
  promoted_at: "2026-07-12T09:00:00.000Z",
  authority_status: "not_live"
});
expect(harness.recordedPromotions).toEqual([promotion]);
~~~

Add explicit tests for blank input with zero reads; unrelated candidates; non-confirmed, ineligible, mixed, expired, and source-verdict-only evidence; stale bootstrap and champion challenge; final verdict ref/digest/role/qualification drift; newer unrelated candidate evaluation; invalid clock; exact replay; Store response drift; and absence of research-release, CandidateArena, runner, Gateway, Ledger, order, credential, private, and live calls.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- packages/application/src/trading/paper/comparison-promotion-service.test.ts
~~~

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Implement typed errors and the no-read input gate**

~~~ts
export type PaperTradingComparisonPromotionServiceErrorCode =
  | "invalid_paper_trading_comparison_promotion_input"
  | "paper_trading_comparison_promotion_evidence_required"
  | "paper_trading_comparison_promotion_stale"
  | "paper_trading_comparison_promotion_reference_not_found"
  | "paper_trading_comparison_promotion_graph_invalid"
  | "paper_trading_comparison_promotion_persistence_conflict";
~~~

Normalize candidateId before any Store call.

- [ ] **Step 4: Implement eligible and current evidence selection**

An outcome is eligible only when:

~~~ts
outcome.campaign_outcome === "confirmed_improvement" &&
outcome.promotion_eligibility === "eligible" &&
outcome.next_action === "review_for_trading_promotion" &&
outcome.slot_results.length > 0 &&
outcome.slot_results.every((result) =>
  result.status === "challenger_improved" &&
  result.verdict_ref !== undefined &&
  result.verdict_digest !== undefined
)
~~~

Sort candidate-matching outcomes by evaluated_at descending and stable ID descending. Bootstrap matches only when no current promotion exists. Champion challenge matches only when its promotion ref and canonical full-record digest equal the current promotion. Return an existing promotion byte-identically when it already references the selected outcome. Distinguish absent evidence from evidence stale against an old champion.

- [ ] **Step 5: Bind the final verdict and persist**

Require final verdict outcome challenger_improved, pair qualification qualified, exact final slot refs/digests, and exact campaign challenger candidate/version/SystemCode. Construct the deterministic ID from safeId(outcomeId), bind finalVerdict.challenger.paper_trading_evaluation_ref, and require promoted_at strictly after outcome and verdict evaluation times. Reject a non-identical Store response.

- [ ] **Step 6: Verify and commit**

~~~bash
npm test -- packages/application/src/trading/paper/comparison-promotion-service.test.ts
npm run typecheck -w @ouroboros/application
git add packages/application/src/trading/paper/comparison-promotion-service.ts packages/application/src/trading/paper/comparison-promotion-service.test.ts
git commit -m "feat: decide comparison-backed promotion"
~~~

---

### Task 3: Enforce The Complete Promotion Graph In LocalStore

**Files:**
- Modify: packages/local-store/src/index.ts
- Modify: packages/local-store/test/local-store.test.ts
- Modify: comparison fixtures affected by required promotion provenance

**Interfaces:**
- Reuses validatePaperTradingComparisonConfirmationCampaignOutcomeGraph.
- Reuses validatePaperTradingComparisonVerdictGraph.
- Keeps recordTradingPromotion inside withComparisonEvidenceWriteTransaction.
- Produces append-only exact replay and stable LocalStore errors.

- [ ] **Step 1: Write failing persistence and corruption tests**

From an actual valid confirmation fixture, prove record/get/latest/exact replay. Add one mutation per campaign ref/digest, outcome ref/digest, final verdict ref/digest, candidate, version, final evaluation, qualification, outcome eligibility, promotion time, bootstrap currentness, champion replacement currentness, and same-ID drift. Add restart readback.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- packages/local-store/test/local-store.test.ts -t "comparison-backed TradingPromotion"
~~~

Expected: FAIL because the current writer neither validates confirmation provenance nor enforces append-only replay.

- [ ] **Step 3: Implement shape, reload, and append-only gates**

Add stable errors:

~~~ts
| "invalid_trading_promotion_input"
| "trading_promotion_conflict"
| "trading_promotion_reference_not_found"
| "trading_promotion_graph_invalid"
| "trading_promotion_stale_champion"
| "trading_promotion_reload_failed"
~~~

recordTradingPromotionUnlocked must validate runtime shape, return only exact existing content, reject same-ID drift, validate the full graph before assertFrozenAuthorityWriteAllowed, and then write one JSON record. get/list must reject malformed persisted data.

- [ ] **Step 4: Implement full graph/currentness validation**

Load campaign, outcome, final verdict, candidate version, SystemCode, admission, final commitment/evaluation/observations, and current promotion. Invoke the existing full outcome and verdict graph validators. Require all slots improved, eligible outcome, qualified final verdict, exact challenger identity, exact final evaluation, and strict post-evidence time.

For a new bootstrap promotion, latest must be absent. For a new champion challenge, latest ref and canonical digest must equal campaign.champion_selection. For exact replay, the existing record may be latest, but any newer promotion makes the attempted transition stale.

- [ ] **Step 5: Add transaction race pressure**

Race a comparison reservation against promotion while pausing one operation after latest-promotion read. Exactly one current-champion state may win; the loser fails closed and neither side leaves a partial record.

- [ ] **Step 6: Verify and commit**

~~~bash
npm test -- packages/local-store/test/local-store.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
npm run typecheck -w @ouroboros/local-store
git add packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
git commit -m "feat: persist comparison-backed promotions"
~~~

---

### Task 4: Compose The Explicit Command And Exact Readback

**Files:**
- Modify: packages/application/src/services/operator.ts
- Modify: apps/runtime/test/operator-paper-trading-board.test.ts

**Interfaces:**
- Adds an injectable Pick<PaperTradingComparisonPromotionService, "promote"> to OperatorServiceOptions.
- Produces successful trading_candidate.promote execution.
- Preserves current missing/unqualified/standalone diagnostics.
- Produces compact confirmation evidence from exact promotion refs.

- [ ] **Step 1: Write failing command tests**

Success returns { promotion } and calls promote once. Error mapping is:

~~~text
evidence_required plus no evaluation -> paper_trading_evaluation_required
evidence_required plus unqualified latest -> paper_trading_qualification_required
evidence_required plus standalone qualified latest -> paper_trading_comparison_required
stale -> paper_trading_comparison_stale
graph, reference, or persistence conflict -> paper_trading_comparison_invalid
~~~

Preserve active_trading_review_candidate_id and attempted_replacement_candidate_id details.

- [ ] **Step 2: Write failing exact-readback tests**

Seed a promotion-bound final evaluation and then a newer unrelated candidate evaluation. Assert TradingPromotion, TradingReview, and review packet still use promotion.paper_trading_evaluation_ref. Assert the compact summary contains campaign/outcome/final-verdict IDs, required/improved counts, metric, minimum lift, evaluated_at, external evaluation authority, and not_live.

- [ ] **Step 3: Run RED**

~~~bash
npm test -- apps/runtime/test/operator-paper-trading-board.test.ts -t "promotion|Trading review"
~~~

Expected: success remains blocked and confirmation summary is absent.

- [ ] **Step 4: Compose the service with diagnostic fallback**

Try the promotion service first. Only evidence_required enters the existing latest-paper qualification diagnostic. Map stale separately and all evidence corruption to paper_trading_comparison_invalid. On success do not alter selectedCandidateId and do not call any runtime mutation port.

- [ ] **Step 5: Build exact evidence projection**

Load getPaperTradingEvaluation(promotion.paper_trading_evaluation_ref.id), exact observations/commitment, and the campaign/outcome named by comparison_confirmation. Produce the summary only when refs, digests, eligible counts, and final verdict identity agree. Never use candidate-latest as successful promotion evidence.

- [ ] **Step 6: Verify and commit**

~~~bash
npm test -- apps/runtime/test/operator-paper-trading-board.test.ts
npm run typecheck -w @ouroboros/application
npm run typecheck -w @ouroboros/runtime
git add packages/application/src/services/operator.ts apps/runtime/test/operator-paper-trading-board.test.ts
git commit -m "feat: promote confirmed paper challengers"
~~~

---

### Task 5: Prove Campaign-To-Promotion Replay And Restart

**Files:**
- Modify: packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts
- Modify: packages/local-store/test/local-store.test.ts only for shared lifecycle helpers

**Interfaces:**
- Consumes the real campaign runner, terminal outcome, independent research release, promotion service, LocalStore, and restart initialization.
- Proves one explicit review transition with no runtime or authority side effects.

- [ ] **Step 1: Extend the actual lifecycle test**

After the confirmed outcome and independent research release, promote the real challenger. Assert the final slot verdict's challenger evaluation is bound, the exact campaign/outcome/verdict provenance is stored, and authority remains not_live.

- [ ] **Step 2: Prove no side effects**

Snapshot TradingRuns, paper evaluations, observations, Ledger records, comparisons, releases, findings, lineage, candidates, and SystemCode before promotion. After promotion, only the trading-promotions collection changes.

- [ ] **Step 3: Prove replay and restart**

Advance the clock and repeat promote; expect strict equality. Restart LocalStore, read the same latest promotion, repeat promote again, and expect strict equality. Use the restarted promotion as the exact champion frozen by a subsequent champion_challenge preparation.

- [ ] **Step 4: Prove lifecycle vetoes**

The existing mixed campaign produces no promotion. Add stale-champion, newer unrelated research-feedback evaluation, and drifted final outcome/verdict restart cases.

- [ ] **Step 5: Verify writer and authority boundaries**

~~~bash
npm test -- packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts
npm test -- packages/local-store/test/local-store.test.ts -t "comparison-backed TradingPromotion"
rg -n "recordTradingPromotion|PaperTradingComparisonPromotionService" packages apps
rg -n "credentials|signed|live_order|order_submission|startSandbox|stopSandbox|recordLedger" packages/application/src/trading/paper/comparison-promotion-service.ts
~~~

Expected: lifecycle tests pass; writer paths are limited to port, LocalStore, service, and explicit command; the service has no private/live/order/runner mutation.

- [ ] **Step 6: Commit lifecycle evidence**

~~~bash
git add packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts packages/local-store/test/local-store.test.ts
git commit -m "test: prove comparison-backed promotion lifecycle"
~~~

---

### Task 6: Update Durable Truth And Verify The Frontier

**Files:**
- Modify: AGENTS.md
- Modify: docs/candidate-arena-evaluation-protocol.md
- Modify: docs/api-command-contract.md
- Modify: docs/naming-taxonomy.md
- Modify: docs/superpowers/specs/2026-07-12-paper-trading-comparison-promotion-design.md
- Modify: docs/superpowers/plans/2026-07-12-paper-trading-comparison-promotion.md

- [ ] **Step 1: Update canonical truth**

Record that TradingPromotion now requires a terminal eligible all-improved campaign; binds campaign, outcome, final verdict, and final challenger qualification; is revalidated atomically against the current champion; is created only by the explicit operator command; and changes Trading review only. Remove stale claims that campaign release or promotion integration is absent. Keep automatic promotion, production scheduling, runner handoff, adaptive allocation, private/live authority, P0 completion, and Goal completion explicitly open.

- [ ] **Step 2: Mark design and plan implemented**

Set the design status to:

~~~text
Implemented and verified as an explicit paper-only comparison-backed TradingPromotion frontier
~~~

Set this plan Status to Complete and check each completed step.

- [ ] **Step 3: Run focused regression**

~~~bash
npm test -- packages/domain/src/paper-trading-comparison-promotion.test.ts packages/application/src/trading/paper/comparison-promotion-service.test.ts packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts apps/runtime/test/operator-paper-trading-board.test.ts
~~~

Expected: PASS.

- [ ] **Step 4: Run workspace and repository validation**

~~~bash
npm run typecheck
npm run check:repo-guards
npm test
~~~

Expected: all workspace typechecks, docs, architecture, naming, env, secret, diff, and all tests pass. Reproduce any failure in isolation, then rerun the full suite before claiming completion.

- [ ] **Step 5: Commit durable truth**

~~~bash
git add AGENTS.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-12-paper-trading-comparison-promotion-design.md docs/superpowers/plans/2026-07-12-paper-trading-comparison-promotion.md
git commit -m "docs: record paper comparison promotion"
~~~

## Completion Evidence

Keep this frontier only when current evidence proves:

1. canonical comparison-backed promotion shape and digest pressure;
2. deterministic selection of the exact current eligible campaign;
3. full LocalStore outcome, verdict, qualification, and current-champion validation;
4. explicit command success and stable closed failure modes;
5. exact promotion-bound evaluation and compact confirmation readback;
6. actual campaign-to-promotion replay and restart;
7. no CandidateArena, runner, Gateway, Ledger, order, private, credential, or live side effect;
8. focused tests, workspace typechecks, repository guards, and full suite pass;
9. durable docs leave automatic composition, adaptive allocation, and Goal/P0 completion open.

After completion, route back to auto-project and activate persisted bounded adaptive ResearchWorker allocation.

