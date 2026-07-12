# ResearchWorker Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and
> superpowers:test-driven-development to implement this plan task-by-task.

**Status:** In progress

**Goal:** Persist a stable logical ResearchWorker, sanitized notebook and closed budget history,
and fail-closed restart recovery without replaying an old ResearchPreflight commitment.

**Architecture:** Add an append-only `ResearchWorkerCheckpoint` domain record, enforce its chain in
LocalStore, then resolve stable workers and close/recover each preflight commitment in
CandidateArena. Keep candidate artifacts tick-isolated and store only bounded development-visible
notebook summaries in the worker workspace and checkpoint graph.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-12-research-worker-lifecycle-design.md` exactly.
- Never persist, reconstruct, expose, or retry an evaluator seed or sealed suite.
- Never resume a prior commitment; a new effect requires a new allocation and commitment.
- Keep all leftover development submission authority at zero after terminal closure.
- Keep historical records readable and exclude them from v1 recovery.
- Use TDD and observe focused RED before production implementation.
- Keep `.superpowers/` untracked and outside every commit.

### Task 1: Define ResearchWorkerCheckpoint

**Files:**
- Create: `packages/domain/src/research-worker-checkpoint.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `docs/naming-taxonomy.md`

- [x] Write canonical digest and strict runtime-shape tests.
- [x] Cover status/reason/admission cardinality, bounded sanitized entries, budget arithmetic,
  authority closure, canonical timestamps, and previous-checkpoint pairing.
- [x] Run RED because the record and helpers do not exist.
- [x] Implement the minimal domain record, digest input, and runtime-shape helper.
- [x] Run focused domain GREEN and typecheck.
- [ ] Commit `feat: define research worker checkpoints`.

Evidence: the RED run failed all 47 new tests because the checkpoint API was absent. The final
domain matrix passed 2 files and 81 tests, and the `@ouroboros/domain` typecheck passed.

### Task 2: Persist The Checkpoint Chain

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/domain/src/candidate-admission-policy.ts`
- Modify: `packages/local-store/src/index.ts`
- Create: `packages/local-store/test/research-worker-checkpoint.test.ts`

- [ ] Write persistence RED for exact replay, one checkpoint per commitment, contiguous worker
  lineage, graph mismatch, budget arithmetic, commitment-bound admission, and restart reload.
- [ ] Add historical-compatible commitment refs to CandidateAdmissionDecision and require them on
  the checkpoint-enabled CandidateArena path.
- [ ] Implement record/get/list methods and strict graph validation.
- [ ] Run LocalStore and admission regression GREEN plus affected typechecks.
- [ ] Commit `feat: persist research worker checkpoints`.

### Task 3: Build Sanitized Notebook Continuity

**Files:**
- Modify: `packages/application/src/trading/research/types.ts`
- Modify: `packages/application/src/trading/research/run-trading-research.ts`
- Modify: `packages/application/src/trading/research/agent-adapters.ts`
- Create or modify focused research-loop tests.

- [ ] Write RED proving prior context is separate from current entries and excluded from current
  submission count.
- [ ] Prove the persisted notebook excludes sealed data, paths, commands, stdout/stderr, provider
  requests, and oversized summary text.
- [ ] Add configurable notebook path and compact `prior_checkpoint` context.
- [ ] Update the agent prompt summarizer to include only bounded prior/current summaries.
- [ ] Run focused application GREEN and typecheck.
- [ ] Commit `feat: continue sanitized research notebooks`.

### Task 4: Reuse Stable Workers And Close Every Tick

**Files:**
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify related product-loop tests only where identity expectations change.

- [ ] Write RED for stable direction/worker/workspace reuse across two ticks and identity rotation
  on provider/model/profile/direction change.
- [ ] Write RED for completed, immediate failed-closed, orphan restart, and terminal-admission
  reconstruction paths.
- [ ] Assert recovery occurs before the next agent effect and never calls the old agent, runner,
  provider, or materializer.
- [ ] Resolve deterministic checkpoint-enabled workers, write notebooks under their stable
  workspace, append checkpoints on every current path, and recover orphans before allocation.
- [ ] Bind every new CandidateArena admission to its exact commitment.
- [ ] Run CandidateArena, managed-provider, Operator product-loop, and restart regression GREEN.
- [ ] Commit `feat: recover durable research workers`.

### Task 5: Reconcile Durable Truth And Verify

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `AGENTS.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/autonomy-model.md`
- Modify this design and plan with final evidence.

- [ ] Replace the tick-scoped-worker gap with exact implemented and residual claims.
- [ ] Run focused cross-layer tests and all affected workspace typechecks.
- [ ] Run `npm run check:repo-guards` and `git diff --check`.
- [ ] Run the full test suite and record exact suite/test counts.
- [ ] Mark design and plan complete only after current-head evidence passes.
- [ ] Commit `docs: record durable research worker recovery`.
