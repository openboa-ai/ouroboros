# ResearchPopulationDiversity Trajectory Implementation Plan

> **For agentic workers:** Use test-driven development and execute each task as one bounded
> keep/discard/reroute loop.

**Status:** In progress

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

- [ ] Add RED for required `tick_series`, exact tick shape, bounded length, unique IDs, newest-first
  ordering, exact length, metric validity, raw-field rejection, and closed authority.
- [ ] Implement `ResearchPopulationDiversityTickReadModel` and strict nested validation.
- [ ] Run domain GREEN and typecheck.
- [ ] Commit `feat: define research diversity trajectory`.

### Task 2: Compute Independent Tick Cross-Sections

**Files:**
- Modify: `packages/application/src/candidate/research-population-diversity.ts`
- Modify: `packages/application/src/candidate/research-population-diversity.test.ts`

- [ ] Add RED for earlier diversity plus latest collapse, top-level aggregate preservation,
  cross-tick suite transition, intra-tick suite conflict, admission counts, and deterministic order.
- [ ] Refactor evidence accumulation into exact window and per-tick buckets without duplicating raw
  evidence or changing current aggregate results.
- [ ] Run application/domain GREEN and typechecks.
- [ ] Commit `feat: measure research diversity trajectory`.

### Task 3: Prove CandidateArena And Worker Readback

**Files:**
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify typed Operator fixtures for required `tick_series`.

- [ ] Add RED proving real distinct/duplicate ticks appear newest-first in CandidateArena and the
  next-worker context.
- [ ] Prove raw fingerprint, suite, scenario, sealed, and paper evidence remain absent.
- [ ] Run CandidateArena and shared Operator regressions.
- [ ] Commit `test: prove arena diversity trajectory`.

### Task 4: Reconcile Truth And Verify

**Files:**
- Modify canonical README, architecture, Goal, protocol, autonomy, API, taxonomy, and AGENTS docs.
- Modify this design and plan with exact evidence.

- [ ] Record the rolling-coverage versus cross-sectional-trajectory distinction and residual causal
  gaps.
- [ ] Run all workspace typechecks.
- [ ] Run focused cross-layer tests and `npm run check:repo-guards`.
- [ ] Run the full suite and record exact counts.
- [ ] Mark design and plan complete and commit `docs: record research diversity trajectory`.
