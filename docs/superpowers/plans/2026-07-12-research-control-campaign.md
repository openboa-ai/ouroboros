# ResearchControlCampaign Implementation Plan

**Status:** Complete

**Goal:** Implement one pre-effect, equal-bound, isolated `adaptive_default` versus
`static_control` CandidateArena campaign that produces only a research-phase report and exact future
paper candidate reservations.

## Task 1: Domain Contract

**Files**

- Modify `packages/domain/src/index.ts`
- Add `packages/domain/src/research-control-campaign.test.ts`

**Steps**

1. Add failing runtime-shape tests for valid campaign, arm intent, reservation, arm report, and
   terminal report fixtures.
2. Add rejection tests for unequal arms, duplicate/non-contiguous ticks, invalid bounds, baseline
   mismatch, malformed refs/digests, non-conserved diagnostics, reordered arm reports, an
   adjudicated research outcome, winner-like fields, and widened authority.
3. Add canonical types, digest-input helpers, exact-key runtime-shape validators, and the fixed
   version-1 campaign policy.
4. Run domain tests and typecheck.
5. Commit the domain contract.

## Task 2: Application Decisions

**Files**

- Add `packages/application/src/candidate/research-control-campaign.ts`
- Add `packages/application/src/candidate/research-control-campaign.test.ts`
- Modify `packages/application/src/index.ts`
- Modify `packages/application/src/ports/store.ts`

**Steps**

1. Add failing tests for deterministic commitment creation and idempotent persistence.
2. Build a campaign only from exact baseline, source closure, managed agent identity, and bounded
   policy input.
3. Add failing tests for arm intent creation and exact request matching.
4. Add failing report tests covering exact tick/allocation linkage, diagnostic conservation,
   campaign-only diversity, deterministic first-created reservation, explicit empty slots, and
   hidden raw evidence.
5. Implement pure arm/report builders and an append-only service using the store port.
6. Run application/domain focused tests and typechecks.
7. Commit application decisions.

## Task 3: LocalStore Persistence

**Files**

- Modify `packages/local-store/src/index.ts`
- Add `packages/local-store/test/research-control-campaign.test.ts`

**Steps**

1. Add failing append/reload/conflict/corruption tests for all three record families.
2. Add collections and exact digest/runtime-shape validation.
3. Verify report graph references the exact coordinator campaign and arm intents, while arm stores
   may persist their own intent independently.
4. Run local-store, application, and domain focused tests plus typechecks.
5. Commit LocalStore persistence.

## Task 4: Snapshot And Runtime Coordinator

**Files**

- Add `apps/runtime/src/candidate/arena/research-control-campaign.ts`
- Add `apps/runtime/test/research-control-campaign.test.ts`

**Steps**

1. Add failing snapshot tests for stable canonical digest, campaign collection exclusion, source
   mutation, temporary file, symlink, byte/file bounds, nested workspace, and conflicting roots.
2. Implement bounded regular-file manifest capture and verified copy through temporary sibling
   roots and atomic rename.
3. Add a failing end-to-end fixture campaign test proving pre-effect commitment and arm intents,
   exact isolated tick modes, no cross-arm writes, candidate reservation, unadjudicated report, and
   restart replay without new ticks.
4. Implement sequence-paired arm execution using `runCandidateArenaTick` and independent
   `LocalStore` instances.
5. Add interrupted-arm recovery coverage: reuse completed exact tick and run only the missing arm.
6. Run runtime-focused tests and all workspace typechecks.
7. Commit runtime coordination.

## Task 5: Durable Truth And Verification

**Files**

- Modify `AGENTS.md`
- Modify `README.md`
- Modify `ARCHITECTURE.md`
- Modify `docs/project-direction.md`
- Modify `docs/candidate-arena-research-goal.md`
- Modify `docs/candidate-arena-evaluation-protocol.md`
- Modify `docs/autonomy-model.md`
- Modify `docs/api-command-contract.md`
- Modify `docs/naming-taxonomy.md`
- Modify `docs/product-quality-design.md`
- Modify this plan and its design document

**Steps**

1. Document the canonical noun, isolation boundary, diagnostic-only report, paper reservation rule,
   and remaining prospective outcome work.
2. Run focused tests, all workspace typechecks, the full suite, and repository guards.
3. Record exact evidence and mark the plan complete only after every check passes.
4. Commit durable truth.

## Required Verification

```bash
npm test -- packages/domain/src/research-control-campaign.test.ts
npm test -- packages/application/src/candidate/research-control-campaign.test.ts
npm test -- packages/local-store/test/research-control-campaign.test.ts
npm test -- apps/runtime/test/research-control-campaign.test.ts
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

- Do not infer policy superiority from research-phase diagnostics.
- Do not run an arm before campaign and arm intent persistence.
- Do not continue after snapshot instability, graph mismatch, or authority widening.
- Do not expand this frontier into paper scheduling, outcome adjudication, automatic allocation
  replacement, promotion, or live behavior.

## Final Evidence

- `packages/domain/src/research-control-campaign.test.ts`: 58 passed.
- `packages/application/src/candidate/research-control-campaign.test.ts`: 22 passed.
- `packages/local-store/test/research-control-campaign.test.ts`: 8 passed.
- `apps/runtime/test/research-control-campaign.test.ts`: 10 passed.
- Combined new frontier: 4 files and 98 tests passed.
- Existing CandidateArena plus campaign runtime regression: 3 files and 73 tests passed.
- All workspace typechecks passed, including the Operator Desktop Rust build.
- Repository docs, architecture, naming, tracked-env, secret, and diff guards passed.
- Full repository suite: 298 of 298 suites and 2215 of 2215 tests passed; zero failed, pending,
  or todo. The sandboxed run failed only because loopback listeners received `EPERM`; the approved
  local-port rerun passed.

The campaign frontier created isolated treatment/control research populations and froze future
paper candidate slots. This historical plan deliberately stopped before outcome adjudication. The
later outcome, paper-protocol, and paper-executor plans now own the internal schedule, execution,
and terminal adjudication implementation; default always-on deployment remains open.
