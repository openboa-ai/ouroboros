# ResearchPopulationDiversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and
> superpowers:test-driven-development to implement this plan task-by-task.

**Status:** In progress

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

- [ ] Write strict shape tests for measured, insufficient, and incomparable distributions.
- [ ] Reject negative/non-finite counts, out-of-range normalized entropy, raw identity fields, and
  any evaluation or promotion authority.
- [ ] Run RED because the read model and shape helper do not exist.
- [ ] Implement the minimal domain contract and runtime-shape helper.
- [ ] Run domain GREEN and typecheck.
- [ ] Commit `feat: define research population diversity`.

### Task 2: Compute Direction And Behavior Entropy

**Files:**
- Create: `packages/application/src/candidate/research-population-diversity.ts`
- Create: `packages/application/src/candidate/research-population-diversity.test.ts`
- Modify: `packages/application/src/index.ts`

- [ ] Write RED for known Shannon distributions, normalization, exact behavior cohorts, separate
  admission classifications, canonical direction order, and empty windows.
- [ ] Write adversarial RED for cross-suite aggregation, orphan fingerprints, raw-field influence,
  and hidden/sealed/paper data influence.
- [ ] Implement a pure builder with six-decimal canonical rounding.
- [ ] Run application GREEN and typecheck.
- [ ] Commit `feat: measure research population diversity`.

### Task 3: Project Aggregate Diversity Into CandidateArena

**Files:**
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify typed Operator fixtures where the required read model is constructed.

- [ ] Write RED proving CandidateArena exposes aggregate metrics after distinct and duplicate runs.
- [ ] Prove the next worker sees aggregate diversity but no fingerprint/digest/scenario/sealed data.
- [ ] Reconstruct the bounded window from Store evidence and attach it to Operator state/context.
- [ ] Run CandidateArena, Operator interface, managed-provider, and product-loop GREEN.
- [ ] Commit `feat: expose arena population diversity`.

### Task 4: Reconcile Truth And Verify

**Files:**
- Modify canonical README, architecture, Goal, protocol, autonomy, API, taxonomy, and AGENTS docs.
- Modify this design and plan with final evidence.

- [ ] Record exact implemented and residual claims without declaring entropy an outcome metric.
- [ ] Run all workspace typechecks and focused cross-layer tests.
- [ ] Run `npm run check:repo-guards` and `git diff --check`.
- [ ] Run the full test suite and record exact suite/test counts.
- [ ] Mark design and plan complete only after current-head evidence passes.
- [ ] Commit `docs: record research population diversity`.
