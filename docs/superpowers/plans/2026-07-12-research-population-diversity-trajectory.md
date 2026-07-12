# ResearchPopulationDiversity Trajectory Implementation Plan

> **For agentic workers:** Use test-driven development and execute each task as one bounded
> keep/discard/reroute loop.

**Status:** Complete

**Goal:** Preserve recent population coverage while adding the missing per-tick cross-sectional
diversity trajectory required to observe current entropy collapse.

## Global Constraints

- Follow
  `docs/superpowers/specs/2026-07-12-research-population-diversity-trajectory-design.md`.
- Keep the existing rolling aggregate and exact-linkage rules unchanged.
- Compute every tick independently before any cross-tick aggregation claim.
- Add no thresholds, alerts, allocation effects, or authority.
- Keep `.superpowers/` untracked and outside every commit.

### Task 1: Define The Tick-Series Contract

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/research-population-diversity.test.ts`

- [x] Add RED for required `tick_series`, exact tick shape, bounded length, unique IDs, newest-first
  ordering, exact length, metric validity, raw-field rejection, and closed authority.
- [x] Implement `ResearchPopulationDiversityTickReadModel` and strict nested validation.
- [x] Run domain GREEN and typecheck.
- [x] Commit `feat: define research diversity trajectory`.

### Task 2: Compute Independent Tick Cross-Sections

**Files:**
- Modify: `packages/application/src/candidate/research-population-diversity.ts`
- Modify: `packages/application/src/candidate/research-population-diversity.test.ts`

- [x] Add RED for earlier diversity plus latest collapse, top-level aggregate preservation,
  cross-tick suite transition, intra-tick suite conflict, admission counts, and deterministic order.
- [x] Refactor evidence accumulation into exact window and per-tick buckets without duplicating raw
  evidence or changing current aggregate results.
- [x] Run application/domain GREEN and typechecks.
- [x] Commit `feat: measure research diversity trajectory`.

### Task 3: Prove CandidateArena And Worker Readback

**Files:**
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify typed Operator fixtures for required `tick_series`.

- [x] Add RED proving real distinct/duplicate ticks appear newest-first in CandidateArena and the
  next-worker context.
- [x] Prove raw fingerprint, suite, scenario, sealed, and paper evidence remain absent.
- [x] Run CandidateArena and shared Operator regressions.
- [x] Commit `test: prove arena diversity trajectory`.

### Task 4: Reconcile Truth And Verify

**Files:**
- Modify canonical README, architecture, Goal, protocol, autonomy, API, taxonomy, and AGENTS docs.
- Modify this design and plan with exact evidence.

- [x] Record the rolling-coverage versus cross-sectional-trajectory distinction and residual causal
  gaps.
- [x] Run all workspace typechecks.
- [x] Run focused cross-layer tests and `npm run check:repo-guards`.
- [x] Run the full suite and record exact counts.
- [x] Mark design and plan complete and commit `docs: record research diversity trajectory`.

## Verification Evidence

- Domain RED: new-shape valid fixtures failed and missing `tick_series` still passed before the
  contract; final domain file is 41/41.
- Application RED: 10/11 scenarios failed through `derived_read_model_invalid` before per-tick
  accumulation; final application file is 11/11.
- Focused domain/application run: 2 files, 52/52 tests.
- CandidateArena and shared Operator regression: 7 files, 232/232 tests.
- Product-loop smoke after rate-safe polling correction: 16/16 tests.
- All workspace typechecks passed, including Operator Desktop Rust build check.
- `npm run check:repo-guards` passed docs, architecture, naming, tracked env, secrets, and diff
  checks.
- Final full suite: 287/287 suites, 2117/2117 tests, zero failed, pending, or todo.
- Full-suite JSON: `/private/tmp/ouroboros-research-diversity-trajectory-full.json`.
- Implementation commits: `3a7f068`, `aa5e3a3`, `0cd0a17`, and `0638b2c`.
