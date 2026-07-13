# ResearchControlStudy Process Supervisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover and sequentially drain every incomplete ResearchControlStudy currently committed
to one store without manual study-ID selection.

**Architecture:** A pure discovery projector validates study/outcome cross-record identity and
returns the deterministic pending queue. One in-memory process supervisor opens the existing study
runtime for the oldest pending study, drains it, reloads evidence, and repeats until caught up.
Process progress is never persisted; restart derives from append-only study evidence.

**Tech Stack:** TypeScript, Vitest, existing OuroborosStorePort, ResearchControlStudyRunner, domain
shape/digest helpers.

## Global Constraints

- One composition root owns one supervisor for one store.
- At most one study runner is active.
- Earlier failed work is never skipped.
- Stop drains the active campaign and opens no later study.
- Completion must be visible in exact persisted study-outcome evidence before progress.
- No public command, server auto-start, long polling, cross-process lease, or parallel study run.
- No automatic study commitment or ResearchAllocationPolicyDecision creation.
- No evaluation, promotion, order, private, credential, or live authority.
- `.superpowers/` remains untracked and untouched.
- Git commits remain pending while approved escalation is unavailable.

---

### Task 1: Deterministic Study Process Discovery

**Files:**
- Create: `apps/runtime/src/candidate/arena/research-control-study-process-discovery.ts`
- Create: `apps/runtime/test/research-control-study-process-discovery.test.ts`
- Create: `apps/runtime/test/helpers/research-control-study.ts`

**Interfaces:**
- Consumes exact `ResearchControlStudyRecord[]` and `ResearchControlStudyOutcomeRecord[]`.
- Produces `discoverResearchControlStudyProcessQueue(input): ResearchControlStudyRecord[]` and
  `ResearchControlStudyProcessDiscoveryError`.

- [x] **Step 1: Write failing ordering and filtering tests**

Cover empty input, committed-time then ID order, exact terminal exclusion, and one outcome per
study. Include one pending study before and after a terminal study.

- [x] **Step 2: Write failing graph rejection tests**

Reject duplicate study IDs, duplicate outcome IDs, orphan outcomes, two outcomes for one study,
study-ref or study-digest drift, outcome time before study, and malformed shape/digest.

- [x] **Step 3: Verify RED**

```bash
npx vitest run apps/runtime/test/research-control-study-process-discovery.test.ts
```

Expected: fail because the discovery module does not exist.

- [x] **Step 4: Implement the pure projector**

Validate every record with existing domain runtime-shape and canonical digest helpers. Require each
outcome ID to equal `researchControlStudyOutcomeId(study)`. Build one outcome map, reject graph
ambiguity, filter terminal studies, clone records, and sort deterministically.

- [x] **Step 5: Verify Task 1**

```bash
npx vitest run apps/runtime/test/research-control-study-process-discovery.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 2: Single-Owner Process Supervisor

**Files:**
- Create: `apps/runtime/src/candidate/arena/research-control-study-process-supervisor.ts`
- Create: `apps/runtime/test/research-control-study-process-supervisor.test.ts`

**Interfaces:**
- Consumes `Pick<OuroborosStorePort, "listResearchControlStudies" |
  "listResearchControlStudyOutcomes">` and injected `openStudy(study)`.
- Produces `ResearchControlStudyProcessSupervisor`, `ResearchControlStudyProcessStatus`, and stable
  process error codes.

- [x] **Step 1: Write failing lifecycle tests**

Prove caught-up no-op, sequential oldest-first execution, at-most-one active runtime, rescan after
completion, and inclusion of a study committed while another runner is active.

- [x] **Step 2: Write failing stop, failure, and restart tests**

Prove stop invokes active runner stop, drains it, and never opens the next study. Prove runtime-open
failure, stable runner failure, completed-without-persisted-outcome conflict, and reconstruction by a
new supervisor over the same mutable fake store.

- [x] **Step 3: Verify RED**

```bash
npx vitest run apps/runtime/test/research-control-study-process-supervisor.test.ts
```

Expected: fail because the supervisor module does not exist.

- [x] **Step 4: Implement queued lifecycle**

`start()` returns `started` or `already_running`; `drain()` awaits the tracked run; `stop()` sets the
stop flag and awaits active runner stop. The run loop discovers, opens only the first pending study,
drains it, inspects exact runner status, rescans, and fails if the completed study remains pending.
Store no process progress.

- [x] **Step 5: Verify Task 2**

```bash
npx vitest run apps/runtime/test/research-control-study-process-supervisor.test.ts apps/runtime/test/research-control-study-runner.test.ts apps/runtime/test/research-control-study-runtime.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 3: Durable Truth And Frontier Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/superpowers/specs/2026-07-12-research-control-study-process-supervisor-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-research-control-study-process-supervisor.md`

**Interfaces:**
- Consumes verified process behavior.
- Produces canonical current-state truth and the next listener-capable evidence frontier.

- [x] **Step 1: Update canonical docs**

Document internal one-shot discovery, deterministic oldest-first execution, single-process
ownership, stop/failure semantics, no automatic policy decision, and remaining server-auto-start,
cross-process lease, listener evidence, and distinct-regime boundaries.

- [x] **Step 2: Run focused and required checks**

```bash
npx vitest run apps/runtime/test/research-control-study-process-*.test.ts apps/runtime/test/research-control-study-*.test.ts packages/application/src/candidate/research-control-study*.test.ts packages/domain/src/research-control-study*.test.ts packages/local-store/test/research-control-study.test.ts
npm run typecheck
npm run check:repo-guards
npm test
```

- [x] **Step 3: Record frontier decision**

Next: collect one listener-capable prospective replicated study through the real arm/session
composition. Then design distinct-regime and memory/agent factorial protocols. TradingPromotion
remains unrelated.

- [ ] **Step 4: Commit when escalation is available**

Stage only explicit repository paths and never `.superpowers/`. If Git escalation remains
quota-blocked, preserve the verified diff and record that one blocker without retrying another
path.

## Verification Evidence

- Discovery and process lifecycle: 19 tests passed.
- Full ResearchControlStudy regression: 11 files and 137 tests passed.
- All workspace typechecks passed.
- Docs, architecture, naming, tracked-env, secret, and diff guards passed.
- Full suite: 157 of 167 files and 2627 of 2691 tests passed. The same 64
  listener/subprocess-restricted failures remain in the same 10 files; both new test files and all
  19 new tests passed.
- Listener-capable rerun on 2026-07-13 KST: 169 of 169 files and 2,707 of 2,707 tests passed. The
  prior 64 failures were environment restrictions, not retained code failures.
- Promotion decision: one-shot single-owner process discovery and real arm dependency composition
  are locally ready. A prospective replicated study and Git commit remain pending; the execution
  environment is no longer the blocker.
