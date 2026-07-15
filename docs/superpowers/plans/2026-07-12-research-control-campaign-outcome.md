# ResearchControlCampaign Outcome Implementation Plan

**Status:** Complete

**Goal:** Bind the pre-effect Trading review comparator and adjudicate every exact campaign paper
slot only from same-comparator, same-policy terminal prospective ResearchRelease evidence.

## Task 1: Comparator And Outcome Domain

**Files**

- Modify `packages/domain/src/index.ts`
- Modify `packages/domain/src/research-control-campaign.test.ts`
- Add `packages/domain/src/research-control-campaign-outcome.test.ts`

**Steps**

1. Add RED tests requiring `paper_comparator` in every campaign and rejecting promotion drift.
2. Add the unavailable and exact Trading review comparator union.
3. Add RED tests for terminal slot results, arm metrics, observed-rate result, exact keys, count/rate
   conservation, unique graphs, closed authority, and absence of winner/policy authority.
4. Add outcome types, digest input, and strict runtime-shape validation.
5. Run domain tests and typecheck; commit.

## Task 2: Pre-Effect Comparator Resolution

**Files**

- Modify `packages/application/src/candidate/research-control-campaign.ts`
- Modify `packages/application/src/candidate/research-control-campaign.test.ts`
- Modify `packages/local-store/src/index.ts`
- Modify `packages/local-store/test/research-control-campaign.test.ts`
- Modify `apps/runtime/src/candidate/arena/research-control-campaign.ts`
- Modify `apps/runtime/test/research-control-campaign.test.ts`

**Steps**

1. Require comparator input in campaign decisions and idempotency matching.
2. Resolve the exact latest TradingPromotion before campaign effects, or persist explicit
   unavailability.
3. Make LocalStore verify a Trading review comparator ref/digest and candidate/evaluation identity.
4. Prove a later promotion cannot repair an unavailable campaign and a changed promotion conflicts.
5. Run cross-layer comparator tests and typechecks; commit.

## Task 3: External Outcome Adjudicator

**Files**

- Add `packages/application/src/candidate/research-control-campaign-outcome.ts`
- Add `packages/application/src/candidate/research-control-campaign-outcome.test.ts`
- Modify `packages/application/src/index.ts`
- Modify `packages/application/src/ports/store.ts`

**Steps**

1. Add RED tests for all five slot classifications and adaptive/equal/static observed rates.
2. Define a complete slot evidence closure containing confirmation campaign, terminal outcome, and
   ResearchRelease.
3. Validate exact report reservation, challenger closure, Trading review champion, campaign/outcome/
   release graph, and one shared policy/configuration identity across arms.
4. Count every slot once, compute canonical six-place rates, and preserve
   `single_campaign_observation_only` plus `not_eligible` policy authority.
5. Add an idempotent application service for coordinator persistence.
6. Run application/domain focused tests and typechecks; commit.

## Task 4: LocalStore And Arm Collector

**Files**

- Modify `packages/local-store/src/index.ts`
- Modify `packages/local-store/test/research-control-campaign.test.ts`
- Modify `apps/runtime/src/candidate/arena/research-control-campaign.ts`
- Add `apps/runtime/test/research-control-campaign-outcome.test.ts`

**Steps**

1. Add append/reload/conflict/corruption and exact campaign/report graph tests.
2. Add coordinator outcome collection and digest validation.
3. Load exact arm-local terminal records by reservation, construct complete closures, and reject
   missing/extra/mismatched evidence.
4. Prove exact outcome replay survives missing arm workspaces after persistence.
5. Do not add a scheduler or public command in this frontier.
6. Run focused tests and all workspace typechecks; commit.

## Task 5: Durable Truth And Verification

**Files**

- Update canonical root/docs surfaces and these design/plan files.

**Steps**

1. Record the comparator, outcome metric, single-campaign interpretation, authority closure, and
   remaining production scheduler/replication gaps.
2. Run repository guards and the full suite with local loopback permission where required.
3. Record exact evidence, mark complete, and commit durable truth.

## Required Verification

```bash
npm test -- packages/domain/src/research-control-campaign.test.ts
npm test -- packages/domain/src/research-control-campaign-outcome.test.ts
npm test -- packages/application/src/candidate/research-control-campaign-outcome.test.ts
npm test -- packages/local-store/test/research-control-campaign-outcome.test.ts
npm test -- apps/runtime/test/research-control-campaign-outcome.test.ts
npm run typecheck --workspaces --if-present
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
npm test
```

## Stop Conditions

- Do not adjudicate without a pre-effect Trading review comparator.
- Do not use research diagnostics or admission alone as a terminal paper result.
- Do not accept bootstrap, mixed comparator, mixed policy, substituted candidate, or partial slot
  evidence.
- Do not call one campaign a causal policy winner or make it policy-replacement eligible.
- Do not expand into production scheduling, automatic promotion, private access, or live trading.

## Final Evidence

- `packages/domain/src/research-control-campaign-outcome.test.ts`: 30 passed.
- `packages/application/src/candidate/research-control-campaign-outcome.test.ts`: 17 passed.
- `packages/local-store/test/research-control-campaign.test.ts`: 14 passed.
- `apps/runtime/test/research-control-campaign-outcome.test.ts`: 6 passed.
- `apps/runtime/test/research-control-campaign.test.ts`: 10 passed as runtime regression coverage.
- The cross-layer focused set passed, and all workspace typechecks passed including the Operator
  Desktop Rust build.
- Repository docs, architecture, naming, tracked-env, secret, and diff guards passed.
- Full repository suite: 304 of 304 suites and 2279 of 2279 tests passed; zero failed, pending, or
  todo. Final machine-readable evidence is
  `/private/tmp/ouroboros-research-control-outcome-final.json`.

The completed frontier can adjudicate supplied terminal releases and replay the coordinator result
without arm stores. It does not create those releases. Production paper-slot scheduling,
replicated-campaign inference, allocation-policy replacement, automatic promotion, and champion
runtime handoff remain open.
