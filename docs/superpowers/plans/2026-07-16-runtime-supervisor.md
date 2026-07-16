# Runtime Supervisor Implementation Plan

> **For agentic workers:** Execute one task at a time with test-first evidence. Keep this as one
> OURO-185 PR; do not create sub-issues for the steps below.

**Goal:** Operate selected paper, CandidateArena, and research scheduling continuously under one
bounded, durable, same-host runtime lifecycle.

**Architecture:** A coordination-only `RuntimeSupervisor` owns three adapters over existing engine
APIs. `RuntimeProcessOwnership` fences one store-scoped server, an immutable LocalStore checkpoint
chain reconstructs lifecycle state, and non-fixture provider-generated paper sessions use the
deny-default Docker Sandbox adapter. The same read model feeds `/health` and `OperatorReadModel`.

**Tech Stack:** TypeScript, Fastify lifecycle hooks, Vitest, LocalStore filesystem adapters,
existing CandidateArena/paper/study services, Docker Sandboxes `sbx` adapter.

**Status:** Implementation complete; delivery in progress on 2026-07-16.

## Global Constraints

- Reuse existing paper recovery, Arena resume, and study scheduler APIs; do not reproduce their
  domain behavior.
- Persist operational coordination only; no checkpoint may become evaluation or promotion
  evidence.
- Preserve candidate-owned decision cadence and Gateway/Ledger authority.
- Keep retries finite and reset them only on basis or progress change.
- Keep selected paper independent from research-lane failure.
- Non-fixture provider-generated paper must fail before provider/Sandbox effects if eligibility is
  invalid.
- Write tests first and observe RED before implementation.

---

### Task 1: Durable Supervisor Contract And Ownership

**Files:**
- Create: `packages/domain/src/runtime-supervisor.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/ports/runtime-process-ownership.ts`
- Create: `packages/application/src/ports/runtime-supervisor.ts`
- Create: `packages/local-store/src/runtime-supervisor-checkpoint-store.ts`
- Modify: `packages/local-store/src/index.ts`
- Create: `packages/local-store/test/runtime-supervisor-checkpoint-store.test.ts`
- Modify: `packages/domain/src/runtime-process-ownership.test.ts`

- [x] Write RED tests for the five states, `runtime_supervisor` process kind, immutable append,
  exact predecessor, corruption/fork rejection, and latest-state reconstruction.
- [x] Implement the minimal domain/read-model types, port, and filesystem checkpoint adapter.
- [x] Run the focused domain and LocalStore tests.

### Task 2: Bounded Three-Lane Runtime Supervisor

**Files:**
- Create: `apps/runtime/src/runtime-supervisor.ts`
- Create: `apps/runtime/test/runtime-supervisor.test.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `packages/application/src/services/operator.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-scheduler.ts`

- [x] Write RED tests for startup order, idempotent start, ownership conflict, progress-aware retry,
  sticky blocked, independent lane failure, restart reconstruction, and reverse shutdown.
- [x] Add only the minimum Arena/scheduler health and restart hooks needed by the lane adapters.
- [x] Implement the supervisor loop with unreferenced interruptible timers and immutable
  checkpoints.
- [x] Run focused supervisor, Arena runner, scheduler, and Operator tests.

### Task 3: Supervised Paper Recovery And Deny-Default Generated Runtime

**Files:**
- Create: `packages/application/src/trading/paper/start-eligibility.ts`
- Modify: `packages/application/src/trading/paper/commands.ts`
- Modify: `packages/application/src/trading/paper/session-service.ts`
- Modify: `packages/adapters/src/sandbox/adapter.ts`
- Modify: focused paper command/session and Sandbox adapter tests.

- [x] Write RED tests for shared eligibility before effects, non-fixture provider-generated Docker
  selection, recorded adapter cleanup, Docker policy release plus forced removal, non-terminal
  recovery retry, and terminal failure only after supervisor exhaustion.
- [x] Extract the existing generated handoff gate without changing fixture compatibility.
- [x] Select the Sandbox adapter from candidate provenance and fail closed on non-running starts.
- [x] Add explicit non-terminal recovery mode and bounded-exhaustion finalization.
- [x] Run focused application, adapter, and runtime paper tests.

### Task 4: Server Composition And Shared Health

**Files:**
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/src/controllers/core.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/services/operator.ts`
- Modify: `apps/runtime/test/server.test.ts`
- Modify: restart/recovery integration tests.

- [x] Write RED tests that one supervisor replaces the fragmented startup/close paths, preserves
  existing disable flags/callbacks, and returns one identical health projection.
- [x] Wire ownership, checkpoint adapter, three lane adapters, startup, and shutdown.
- [x] Update canonical architecture, API, naming, project-direction, and README truth where the
  implemented boundary changed.
- [x] Run focused runtime integration tests.

### Task 5: Keep Or Reroute Decision And Delivery

- [x] Run `npm test` and `npm run typecheck`.
- [x] Run `bash scripts/check-docs.sh`, `npm run check:architecture`, `npm run check:naming`,
  `bash scripts/check-env-files.sh --tracked`, `bash scripts/check-secrets.sh`, and
  `git diff --check`.
- [x] Review the diff against OURO-185 non-goals and remove unrelated scope.
- [x] Update the existing OURO-185 workpad comment with exact evidence.
- [ ] Commit, push, open one PR whose body is exactly `OURO-185`, then wait for all CI and the
  current-head Codex review.
- [ ] Fix actionable findings, merge only the reviewed head, move OURO-185 to Done, and clean the
  worktree/branches.
