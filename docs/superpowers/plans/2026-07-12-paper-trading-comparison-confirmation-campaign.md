# Paper Trading Comparison Confirmation Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Precommit every future paper confirmation window before campaign outcomes, enforce exact
sequential/non-overlapping execution, and aggregate all reserved results into one sealed external
campaign outcome.

**Architecture:** Domain owns campaign/outcome schemas, runtime shapes, and digests. Application
owns the existing Node-based deterministic comparison-ID helper used by the coordinator and
campaign; LocalStore independently verifies the same derivation. LocalStore also owns source-verdict
validation, active campaign pair ownership, exact next-slot preparation, first-tick timing, outcome
persistence, and release. Application services precommit, materialize the next inert slot through
the existing coordinator, and settle all reserved results through a pure decision.

**Tech Stack:** TypeScript, Vitest, `@ouroboros/domain`, `@ouroboros/application`, LocalStore JSON
records, existing comparison coordinator and verdict evidence.

**Design:**
`docs/superpowers/specs/2026-07-12-paper-trading-comparison-confirmation-campaign-design.md`

## Global Constraints

- The source improved verdict starts the campaign but never counts as a campaign result.
- Reserve exactly `required_confirmation_count` new deterministic slots before the first slot tick.
- Every slot binds the exact source pair, artifacts, admission, champion selection, comparison
  policy, market configuration, and paper policy.
- Decision rule is `all_reserved_windows_must_improve`; no optional replacement window exists.
- Negative/ineligible results do not permit early stopping; a missed start deadline explicitly
  expires current and remaining unstarted slots.
- First ticks are strictly sequential, non-overlapping, and bounded by frozen start delay.
- Campaign commitment and outcome remain sealed, external to TradingSystems, paper-only, and
  `not_live`.
- Campaign eligibility does not create TradingPromotion or grant private/live authority.
- No app/controller, public command, operator projection, Finding, Lineage, or leaderboard
  composition is added.

---

### Task 1: Define deterministic slot and campaign evidence

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/paper-trading-comparison-confirmation-campaign.test.ts`
- Create: `packages/application/src/trading/paper/comparison-identity.ts`
- Create: `packages/application/src/trading/paper/comparison-identity.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-coordinator.ts`
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`

**Interfaces:**
- Produces: `paperTradingComparisonIdsForIdempotencyKey`
- Produces: `PaperTradingComparisonConfirmationSlot`
- Produces: `PaperTradingComparisonConfirmationCampaignRecord`
- Produces: `PaperTradingComparisonConfirmationSlotResult`
- Produces: `PaperTradingComparisonConfirmationCampaignOutcomeRecord`
- Produces: campaign/outcome digest inputs and runtime-shape functions
- Preserves: existing comparison IDs for every existing idempotency key

- [ ] **Step 1: Write failing domain identity and schema tests**

Assert the existing key remains stable and campaign slot IDs use the same helper:

```ts
expect(paperTradingComparisonIdsForIdempotencyKey("paper-comparison-coordinator-001"))
  .toEqual({
    preparation_id: "paper-trading-comparison-preparation-74f7a27ffac400ff",
    comparison_commitment_id: "paper-trading-comparison-74f7a27ffac400ff"
  });
```

Build one valid campaign with two slots and valid confirmed/not-confirmed outcomes. Reject source
verdict count inclusion, non-contiguous slots, changed derived IDs, duplicate slot IDs, count/policy
drift, wrong source refs, non-canonical times, `eligible` campaign commitments, partial slot-result
arrays, wrong counts, confirmed mixed outcomes, non-sealed release, and private/live authority.

- [ ] **Step 2: Run the domain test and verify RED**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-confirmation-campaign.test.ts
```

Expected: FAIL because the campaign exports do not exist.

- [ ] **Step 3: Extract application comparison ID derivation**

Implement:

```ts
export function paperTradingComparisonIdsForIdempotencyKey(
  idempotencyKey: string
): PaperTradingComparisonIds {
  if (!idempotencyKey || idempotencyKey.trim() !== idempotencyKey) {
    throw new Error("invalid paper trading comparison idempotency key");
  }
  const suffix = createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 16);
  return {
    preparation_id: `paper-trading-comparison-preparation-${suffix}`,
    comparison_commitment_id: `paper-trading-comparison-${suffix}`
  };
}
```

Change the coordinator's private `comparisonIds` wrapper to delegate to this helper and map the
snake-case result to its existing local names. Keep Node hashing out of domain. LocalStore adds its
own equivalent derivation in Task 3 and validates against the fixed test vector. Do not change
persisted IDs or public input.

- [ ] **Step 4: Implement campaign and outcome runtime contracts**

Implement the exact records from the design, canonical digest inputs that remove record metadata,
and strict runtime shapes. Campaign shape must derive every slot's key and IDs, require slot count
equal to both campaign policy and comparison policy required count, and require
`maximum_slot_start_delay_ms === comparison_policy.maximum_elapsed_ms`.

Outcome shape must require one ordered result per slot, exact count arithmetic, all improved for
`confirmed_improvement`, and map eligibility/action exactly:

```ts
const confirmed = slot_results.every((result) =>
  result.status === "challenger_improved");
```

- [ ] **Step 5: Run domain and coordinator regressions**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-confirmation-campaign.test.ts packages/application/src/trading/paper/comparison-identity.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts -t "deterministic|exact replay|active-tuple"
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
```

Expected: campaign schema tests pass, existing IDs/replay remain exact, and both typechecks pass.

- [ ] **Step 6: Commit campaign evidence vocabulary**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-confirmation-campaign.test.ts packages/application/src/trading/paper/comparison-identity.ts packages/application/src/trading/paper/comparison-identity.test.ts packages/application/src/trading/paper/comparison-coordinator.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
git commit -m "feat: define paper confirmation campaign evidence"
```

### Task 2: Implement the pure campaign decision

**Files:**
- Create: `packages/application/src/trading/paper/comparison-confirmation-decision.ts`
- Create: `packages/application/src/trading/paper/comparison-confirmation-decision.test.ts`

**Interfaces:**
- Consumes: campaign commitment and one complete ordered slot-result list
- Produces: `decidePaperTradingComparisonConfirmationCampaign`
- Produces: counts, campaign outcome, eligibility, and next action

- [ ] **Step 1: Write failing pure-decision tests**

Use:

```ts
interface PaperTradingComparisonConfirmationDecisionInput {
  campaign: PaperTradingComparisonConfirmationCampaignRecord;
  slotResults: PaperTradingComparisonConfirmationSlotResult[];
}

interface PaperTradingComparisonConfirmationDecision {
  improved_count: number;
  not_improved_count: number;
  ineligible_count: number;
  expired_count: number;
  campaign_outcome: "confirmed_improvement" | "not_confirmed";
  promotion_eligibility: "eligible" | "not_eligible";
  next_action: "review_for_trading_promotion" | "return_to_candidate_arena";
}
```

Cover all-improved, one not-improved, one ineligible, one expired, mixed failures, reordered,
missing, duplicate, foreign-comparison, verdict-bearing expiry, verdict-less completed result,
input mutation, and deterministic replay.

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-confirmation-decision.test.ts
```

Expected: FAIL because the decision module does not exist.

- [ ] **Step 3: Implement exact all-window decision**

Validate the campaign runtime shape and complete slot list, derive counts, then set confirmed only
when `improved_count === campaign.slots.length`. Throw
`invalid_paper_trading_comparison_confirmation_decision_input` for every malformed combination.

- [ ] **Step 4: Run tests and typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-confirmation-decision.test.ts packages/application/src/trading/paper/comparison-verdict-decision.test.ts
npm run typecheck --workspace @ouroboros/application
```

- [ ] **Step 5: Commit pure campaign decision**

```bash
git add packages/application/src/trading/paper/comparison-confirmation-decision.ts packages/application/src/trading/paper/comparison-confirmation-decision.test.ts
git commit -m "feat: decide paper confirmation campaigns"
```

### Task 3: Persist campaign commitments and own the pair

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Produces: campaign record/get/list Store methods
- Changes: active-pair ownership includes a campaign without outcome
- Changes: only the next exact campaign slot may reserve that pair

- [ ] **Step 1: Write failing LocalStore campaign tests**

Add Store tests that persist one campaign from an exact improved source verdict, replay it, reload
it after restart, and reject malformed shape, digest drift, non-improved source, source identity
drift, second campaign for source, and second active campaign for pair.

Before campaign outcome, assert an arbitrary same-pair preparation rejects with
`paper_trading_comparison_active_campaign_pair_conflict`. Slot 1 exact preparation succeeds; slot 2
before slot-1 verdict rejects with `paper_trading_comparison_confirmation_slot_not_ready`. After an
exact slot-1 verdict, slot 2 succeeds; any changed pair/policy/ID rejects.

- [ ] **Step 2: Run selected Store tests and verify RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "confirmation campaign|campaign pair|confirmation slot"
```

Expected: FAIL because campaign Store methods and ownership do not exist.

- [ ] **Step 3: Add Store port and campaign collection**

Add:

```ts
recordPaperTradingComparisonConfirmationCampaign(
  campaign: PaperTradingComparisonConfirmationCampaignRecord
): Promise<PaperTradingComparisonConfirmationCampaignRecord>;
getPaperTradingComparisonConfirmationCampaign(
  campaignId: string
): Promise<PaperTradingComparisonConfirmationCampaignRecord | undefined>;
listPaperTradingComparisonConfirmationCampaigns(): Promise<
  PaperTradingComparisonConfirmationCampaignRecord[]
>;
```

Persist under `paper-trading-comparison-confirmation-campaigns/items`. Validate shape/digest, source
verdict and source comparison, exact candidate sides/selection/policy, deterministic slots, source
uniqueness, active pair uniqueness, exact replay, and changed replay.

LocalStore's private ID derivation must produce the same
`paper-trading-comparison-preparation-74f7a27ffac400ff` and
`paper-trading-comparison-74f7a27ffac400ff` vector for
`paper-comparison-coordinator-001` before campaign tests can pass.

- [ ] **Step 4: Enforce active campaign slot ownership**

In `reservePaperTradingComparisonPreparationUnlocked`, resolve any active campaign for the unordered
pair. Permit only its first unmaterialized slot, and only after every prior slot has an exact
verdict. Validate the preparation's frozen sides, selection, policy, market digest, paper identity,
and IDs against the campaign. Existing non-campaign active-pair behavior remains unchanged.

- [ ] **Step 5: Run LocalStore and typecheck regressions**

```bash
npx vitest run packages/local-store/test/local-store.test.ts
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/application
```

- [ ] **Step 6: Commit campaign pair authority**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: reserve paper confirmation campaigns"
```

### Task 4: Enforce slot timing and persist campaign outcomes

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Adds: campaign outcome record/get/list Store methods
- Changes: campaign slot first-tick gate
- Changes: campaign pair release requires campaign outcome

- [ ] **Step 1: Write failing first-tick and outcome tests**

For slot 1, reject first tick at/before campaign commitment and after its frozen deadline. For slot
2, reject overlap with prior `window_ended_at`, a tick at/before prior `evaluated_at`, and late
start; accept one strictly ordered in-window tick. Replays remain exact.

Persist confirmed, negative, ineligible, and expiry campaign outcomes. Reject incomplete slot lists,
missing/foreign/reordered verdicts, wrong counts, false eligibility, changed replay, and outcome
before all results or expiry. Before outcome arbitrary same-pair preparation remains blocked; after
outcome it succeeds.

- [ ] **Step 2: Run selected tests and verify RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "campaign first tick|campaign outcome|campaign release"
```

- [ ] **Step 3: Add outcome Store methods**

Add:

```ts
recordPaperTradingComparisonConfirmationCampaignOutcome(
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord>;
getPaperTradingComparisonConfirmationCampaignOutcome(
  outcomeId: string
): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord | undefined>;
listPaperTradingComparisonConfirmationCampaignOutcomes(
  campaignId?: string
): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord[]>;
```

Persist under
`paper-trading-comparison-confirmation-campaign-outcomes/items`, and validate campaign digest,
ordered slot evidence, exact verdict refs/digests, strict non-overlap, count arithmetic, eligibility,
and deterministic outcome identity.

- [ ] **Step 4: Add first-tick timing and release gates**

Before `recordPaperTradingComparisonTickUnlocked` writes sequence 1, resolve a campaign slot by
comparison ID and enforce the design's lower/upper time bounds. Treat a campaign as active in pair
reservation until its exact outcome exists, even when the latest slot already has a verdict.

- [ ] **Step 5: Run full Store and typechecks**

```bash
npx vitest run packages/local-store/test/local-store.test.ts
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/application
```

- [ ] **Step 6: Commit timing and outcome authority**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: settle paper confirmation campaign evidence"
```

### Task 5: Build precommit, next-slot, and settlement services

**Files:**
- Create: `packages/application/src/trading/paper/comparison-confirmation-campaign-service.ts`
- Create: `packages/application/src/trading/paper/comparison-confirmation-campaign-service.test.ts`
- Create: `packages/application/src/trading/paper/comparison-confirmation-window-service.ts`
- Create: `packages/application/src/trading/paper/comparison-confirmation-window-service.test.ts`

**Interfaces:**
- Produces: `precommit({ sourceVerdictId })`
- Produces: `settle({ campaignId })`
- Produces: `prepareNext({ campaignId })`

```ts
class PaperTradingComparisonConfirmationCampaignService {
  constructor(options: {
    store: OuroborosStorePort;
    now?: () => string;
  });
  precommit(input: {
    sourceVerdictId: string;
  }): Promise<PaperTradingComparisonConfirmationCampaignRecord>;
  settle(input: {
    campaignId: string;
  }): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord>;
}

class PaperTradingComparisonConfirmationWindowService {
  constructor(options: {
    store: OuroborosStorePort;
    comparisons: Pick<PaperTradingComparisonCoordinator, "prepare">;
    now?: () => string;
  });
  prepareNext(input: {
    campaignId: string;
  }): Promise<VerifiedPaperTradingComparisonCommitmentGraph>;
}
```

- [ ] **Step 1: Write failing service tests**

Require invalid IDs to reject before dependencies. `precommit` must load source verdict/comparison,
derive one campaign and all slots, use a server-owned time after source evaluation, and exact-replay
after clock advance. Reject non-improved, ineligible, unsealed, mismatched, or already-campaigned
sources.

`prepareNext` must call the existing coordinator only for the first unmaterialized ready slot with
exact frozen inputs. It must reject future slots, active outcome, expired deadline, and drifted
returned graph; replay must create no provider/sandbox/market effect.

`settle` must load every slot verdict, refuse early negative stopping, return not-terminal while a
slot remains inside deadline, create expiry results after deadline, delegate to the pure decision,
persist exact output, and replay after clock advance.

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-confirmation-campaign-service.test.ts packages/application/src/trading/paper/comparison-confirmation-window-service.test.ts
```

- [ ] **Step 3: Implement campaign service**

Use stable errors:

```ts
type PaperTradingComparisonConfirmationCampaignServiceErrorCode =
  | "invalid_paper_trading_comparison_confirmation_campaign_input"
  | "paper_trading_comparison_confirmation_campaign_source_ineligible"
  | "paper_trading_comparison_confirmation_campaign_not_terminal"
  | "paper_trading_comparison_confirmation_campaign_graph_invalid";
```

Precommit and settlement persistence calls stay outside graph-error wrapping so Store conflict codes
survive unchanged. Existing campaign/outcome timestamps are reused for replay.

- [ ] **Step 4: Implement next-slot service**

Inject `Pick<PaperTradingComparisonCoordinator, "prepare">`. Build exact coordinator input from the
campaign's next slot and frozen candidate/admission refs. Verify returned preparation, commitment,
sides, selection, policies, and IDs before return.

- [ ] **Step 5: Run focused regressions and typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-confirmation-decision.test.ts packages/application/src/trading/paper/comparison-confirmation-campaign-service.test.ts packages/application/src/trading/paper/comparison-confirmation-window-service.test.ts packages/application/src/trading/paper/comparison-verdict-service.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
npm run typecheck --workspace @ouroboros/application
```

- [ ] **Step 6: Commit campaign application services**

```bash
git add packages/application/src/trading/paper/comparison-confirmation-campaign-service.ts packages/application/src/trading/paper/comparison-confirmation-campaign-service.test.ts packages/application/src/trading/paper/comparison-confirmation-window-service.ts packages/application/src/trading/paper/comparison-confirmation-window-service.test.ts
git commit -m "feat: run paper confirmation campaigns"
```

### Task 6: Prove lifecycle, write back truth, and verify

**Files:**
- Create: `packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts`
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-12-paper-trading-comparison-confirmation-campaign-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-paper-trading-comparison-confirmation-campaign.md`

**Interfaces:**
- Proves: source verdict exclusion, deterministic slots, non-overlap, all-result aggregation,
  restart replay, expiry, and campaign pair release
- Records: campaign remains uncomposed; promotion/research release remain next frontiers

- [ ] **Step 1: Write the real LocalStore lifecycle integration**

Use exact persisted source comparison/verdict evidence and a two-slot campaign. Assert source verdict
is absent from slot results, arbitrary same-pair preparation is blocked, each next slot prepares
inertly only after prior verdict, first ticks are non-overlapping, one mixed campaign is
`not_confirmed`, one all-improved campaign is `confirmed_improvement`, restart replay is exact after
clock advance, and only campaign outcome releases pair ownership. Compare provider, sandbox, market,
decision, Ledger, observation, score, and promotion counts before/after campaign control operations.

- [ ] **Step 2: Run integration and Store regressions**

```bash
npx vitest run packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts
npx vitest run packages/local-store/test/local-store.test.ts
```

- [ ] **Step 3: Update canonical docs**

Add the campaign and outcome nouns, source-verdict exclusion, deterministic slot reservation,
strict non-overlap/deadline, all-window decision, and protocol-level eligibility. State explicitly
that no TradingPromotion, Finding/Lineage release, public composition, private access, or live
authority exists.

- [ ] **Step 4: Verify no forbidden composition**

```bash
rg -n "ConfirmationCampaignService|ConfirmationWindowService|recordPaperTradingComparisonConfirmation" apps packages --glob '!**/*.test.ts'
rg -n 'createTradingPromotion|release_status: "released"|private_exchange_access: "allowed"|live_exchange_authority: true' packages/application/src/trading/paper/comparison-confirmation-*.ts packages/domain/src/index.ts
```

Expected: internal domain/application/Store surfaces only and no promotion, release, private, or live
composition.

- [ ] **Step 5: Run repository-wide verification**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-confirmation-campaign.test.ts packages/application/src/trading/paper/comparison-confirmation-decision.test.ts packages/application/src/trading/paper/comparison-confirmation-campaign-service.test.ts packages/application/src/trading/paper/comparison-confirmation-window-service.test.ts packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts packages/application/src/trading/paper/comparison-verdict-service.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts
npm run typecheck
npm run check:repo-guards
npm test
git diff --check
```

- [ ] **Step 6: Commit lifecycle and durable truth**

```bash
git add packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts AGENTS.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-12-paper-trading-comparison-confirmation-campaign-design.md docs/superpowers/plans/2026-07-12-paper-trading-comparison-confirmation-campaign.md
git commit -m "docs: record paper confirmation campaigns"
```

## Plan Self-Review

- Every design acceptance item maps to Tasks 1-6.
- Source verdict exclusion is enforced in schema, Store validation, service behavior, and
  integration.
- Deterministic slots avoid precreating dormant TradingRuns while preserving precommitment.
- Pair ownership and first-tick timing are Store authority, not caller convention.
- Pure campaign decision cannot cherry-pick or stop after observed failure.
- Expiry is explicit evidence, never an omitted window.
- Protocol-level eligibility remains separate from TradingPromotion and live authority.
- Existing standalone comparison behavior remains source-compatible when no active campaign owns
  the pair.
- No placeholder, alias, public composition, or cross-task type-name mismatch remains.
