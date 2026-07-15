# ResearchPopulationDiversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and
> superpowers:test-driven-development to implement this plan task-by-task.

**Status:** Complete

**Goal:** Measure assigned research-direction concentration and externally observed exact behavior
concentration without treating either as economic or promotion authority.

**Architecture:** Define a compact domain read model, compute it in a pure application builder from
completed tick and exact commitment/fingerprint/admission evidence, then add it to CandidateArena
and sanitized worker context. Do not persist redundant derived evidence or change allocation.

## Global Constraints

- Follow
  `docs/superpowers/specs/2026-07-12-research-population-diversity-design.md` exactly.
- Keep assigned direction and observed behavior as separate distributions.
- Compare behavior only within one exact protocol/suite cohort.
- Never expose raw fingerprints, observations, scenario IDs, sealed evidence, or paper outcomes.
- Do not use entropy for rank, admission, qualification, promotion, or allocation in this frontier.
- Use TDD and observe focused RED before implementation.
- Keep `.superpowers/` untracked and outside every commit.

### Task 1: Define The Diversity Read Model

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/research-population-diversity.test.ts`
- Modify: `docs/naming-taxonomy.md`

- [x] Write strict shape tests for measured, insufficient, and incomparable distributions.
- [x] Reject negative/non-finite counts, out-of-range normalized entropy, raw identity fields, and
  any evaluation or promotion authority.
- [x] Run RED because the read model and shape helper do not exist.
- [x] Implement the minimal domain contract and runtime-shape helper.
- [x] Run domain GREEN and typecheck.
- [x] Commit `feat: define research population diversity`.

### Task 2: Compute Direction And Behavior Entropy

**Files:**
- Create: `packages/application/src/candidate/research-population-diversity.ts`
- Create: `packages/application/src/candidate/research-population-diversity.test.ts`
- Modify: `packages/application/src/index.ts`

- [x] Write RED for known Shannon distributions, normalization, exact behavior cohorts, separate
  admission classifications, canonical direction order, and empty windows.
- [x] Write adversarial RED for cross-suite aggregation, orphan fingerprints, raw-field influence,
  and hidden/sealed/paper data influence.
- [x] Implement a pure builder with six-decimal canonical rounding.
- [x] Run application GREEN and typecheck.
- [x] Commit `feat: measure research population diversity`.

### Task 3: Project Aggregate Diversity Into CandidateArena

**Files:**
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify typed Operator fixtures where the required read model is constructed.

- [x] Write RED proving CandidateArena exposes aggregate metrics after distinct and duplicate runs.
- [x] Prove the next worker sees aggregate diversity but no fingerprint/digest/scenario/sealed data.
- [x] Reconstruct the bounded window from Store evidence and attach it to Operator state/context.
- [x] Run CandidateArena, Operator interface, managed-provider, and product-loop GREEN.
- [x] Commit `feat: expose arena population diversity`.

### Task 4: Reconcile Truth And Verify

**Files:**
- Modify canonical README, architecture, Goal, protocol, autonomy, API, taxonomy, and AGENTS docs.
- Modify this design and plan with final evidence.

- [x] Record exact implemented and residual claims without declaring entropy an outcome metric.
- [x] Run all workspace typechecks and focused cross-layer tests.
- [x] Run `npm run check:repo-guards` and `git diff --check`.
- [x] Run the full test suite and record exact suite/test counts.
- [x] Mark design and plan complete only after current-head evidence passes.
- [x] Commit `docs: record research population diversity`.

## Verification Evidence

- Domain/runtime-shape RED: 28 failures before the contract existed; final domain file: 29/29.
- Pure application RED: module resolution failed before implementation; final builder file: 9/9.
- Focused domain/application run: 2 files, 38/38 tests.
- CandidateArena and shared Operator regression: 7 files, 218/218 tests.
- All workspace typechecks passed, including Operator Desktop Rust build check.
- `npm run check:repo-guards` passed docs, architecture, naming, tracked env, secrets, and diff
  checks.
- Implementation and canonical-doc full suite: 287/287 suites, 2103/2103 tests, zero failed,
  pending, or todo. Final design/plan-only writeback then passed `npm run check:repo-guards`.
- Full-suite JSON: `/private/tmp/ouroboros-research-population-diversity-full.json`.
- Implementation commits: `202e949`, `3c3095d`, and `531b6f8`.
