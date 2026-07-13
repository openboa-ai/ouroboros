# ResearchAllocationPolicyDecision Automatic Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and
> superpowers:test-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically reconcile every terminal ResearchControlStudyOutcome into one exact
research-only policy decision before the default study scheduler waits.

**Architecture:** Reuse the existing decision service as the sole statistical interpreter, harden
decision publication with create-only filesystem semantics, add one oldest-first application
coordinator, invoke it only after successful scheduler catch-up, and compose it by default in
buildServer. The path records approved and not-approved outcomes symmetrically and leaves promotion
authority separate.

**Tech Stack:** TypeScript, Node filesystem hard-link atomics, application Store ports, LocalStore,
existing ResearchAllocationPolicyDecision service and allocation resolver, runtime scheduler,
Fastify lifecycle, Vitest.

## Global Constraints

- Keep `ResearchAllocationPolicyDecision` as the only persisted record; add no job or progress
  schema.
- Reconcile all valid terminal outcomes, not only favorable outcomes.
- Create at most one oldest missing decision per scheduler cycle.
- Keep the existing fixed decision policy and exact policy-digest binding.
- Preserve explicit direction and allocation-mode precedence.
- Same-root races publish one complete record and never overwrite a winner.
- Invoke automatic decision only after supervisor `caught_up`, never on failure or contention.
- Missing or corrupt evidence and clock regression fail closed.
- Grant research-policy selection authority only; no evaluation, promotion, order, private, or live
  authority.
- Keep automatic promotion, handoff, multi-host fencing, learned policy, distinct-regime claims, and
  Goal completion out of scope.
- Do not touch, stage, or remove the existing untracked `.superpowers/` path.

---

### Task 1: Atomic Decision Publication And Race Recovery

**Files:**
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/research-control-study.test.ts`
- Modify: `packages/application/src/candidate/research-allocation-policy-decision.ts`
- Modify: `packages/application/src/candidate/research-allocation-policy-decision.test.ts`

**Interfaces:**
- Consumes: one fully validated ResearchAllocationPolicyDecision and deterministic final path.
- Produces: create-only LocalStore publication and service-level exact-winner recovery.

- [x] **Step 1: Write failing cross-instance and service-race tests**

Add LocalStore tests using two independent stores over one root. Exact concurrent bytes must return
one record. Two valid decisions differing only in `decided_at` must yield one direct-store winner and
one `research_allocation_policy_decision_conflict` without overwrite.

Add an application service test whose first write loses to an already published semantic winner
with a different valid timestamp. The service must return that winner after exact re-derivation.

- [x] **Step 2: Run focused tests and verify RED**

```bash
npx vitest run packages/local-store/test/research-control-study.test.ts packages/application/src/candidate/research-allocation-policy-decision.test.ts
```

Expected: direct-store publication can overwrite or race through a shared temp path, and the
service rejects rather than accepting the exact winner.

- [x] **Step 3: Reuse complete create-only publication**

Replace the decision family's final `writeJson` with `writeJsonCreateOnly`. On `exists`, reload and
return only exact bytes; otherwise throw the existing append-only conflict.

- [x] **Step 4: Reconcile a concurrent semantic winner in the service**

When persistence throws or substitutes bytes, reload the deterministic ID. Re-derive using the
winner's `decided_at` and return only exact semantic equality. Otherwise keep
`research_allocation_policy_decision_persistence_conflict`.

- [x] **Step 5: Verify and commit Task 1**

```bash
npx vitest run packages/local-store/test/research-control-study.test.ts packages/application/src/candidate/research-allocation-policy-decision.test.ts
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/application
git add packages/local-store/src/index.ts packages/local-store/test/research-control-study.test.ts packages/application/src/candidate/research-allocation-policy-decision.ts packages/application/src/candidate/research-allocation-policy-decision.test.ts
git commit -m "fix: reconcile policy decision races"
```

---

### Task 2: Symmetric Terminal-Outcome Decision Coordinator

**Files:**
- Modify: `packages/application/src/candidate/research-allocation-policy-decision.ts`
- Modify: `packages/application/src/candidate/research-allocation-policy-decision.test.ts`

**Interfaces:**
- Consumes: exact lists of studies, terminal outcomes, decisions, and one exact clock.
- Produces: `ResearchAllocationPolicyDecisionCoordinator.ensureNextDecision()` and bounded
  `ensured | up_to_date` operational status.

- [x] **Step 1: Write failing reconciliation tests**

Cover empty evidence, supported approval, unsupported/underpowered not-approved decisions,
oldest-first missing selection after validating existing decisions, one-write-per-call, orphan and
graph failures, equal-millisecond ordering, clock regression, and exact replay.

Use the existing allocation resolver to prove an automatically ensured approval becomes the next
uncontrolled tick's `research_allocation_policy_decision` basis.

- [x] **Step 2: Run the application test and verify RED**

```bash
npx vitest run packages/application/src/candidate/research-allocation-policy-decision.test.ts
```

Expected: coordinator exports are absent.

- [x] **Step 3: Implement bounded exact reconciliation**

Add:

```ts
export type ResearchAllocationPolicyDecisionCoordinationResult =
  | {
      status: "ensured";
      decisionId: string;
      studyOutcomeId: string;
      decisionStatus: "approved" | "not_approved";
    }
  | {
      status: "up_to_date";
      terminalOutcomeCount: number;
    };

export interface ResearchAllocationPolicyDecisionCoordinatorLifecycle {
  ensureNextDecision(): Promise<
    ResearchAllocationPolicyDecisionCoordinationResult
  >;
}
```

Sort exact outcomes, reject orphan decisions, validate existing records through the service, and
ensure only the oldest missing outcome. Wrap failures in a stable
`research_allocation_policy_decision_coordination_failed` error.

For `decided_at`, use exact `now` when later, add one millisecond only when equal, and reject earlier
or invalid clocks.

- [x] **Step 4: Verify and commit Task 2**

```bash
npx vitest run packages/application/src/candidate/research-allocation-policy-decision.test.ts packages/application/src/candidate/research-allocation.test.ts
npm run typecheck --workspace @ouroboros/application
git add packages/application/src/candidate/research-allocation-policy-decision.ts packages/application/src/candidate/research-allocation-policy-decision.test.ts
git commit -m "feat: ensure terminal study policy decisions"
```

---

### Task 3: Run Policy Decision After Successful Scheduler Catch-Up

**Files:**
- Modify: `apps/runtime/src/candidate/arena/research-control-study-scheduler.ts`
- Modify: `apps/runtime/test/research-control-study-scheduler.test.ts`

**Interfaces:**
- Consumes: optional `ResearchAllocationPolicyDecisionCoordinatorLifecycle`.
- Produces: post-catch-up invocation and optional bounded `lastPolicyDecision` status.

- [x] **Step 1: Write failing scheduler-order and boundary tests**

Prove the event order is commitment, supervisor catch-up, policy decision, wait. Prove no decision
call on contention, failure, stop, or invalid supervisor state. A decision failure must produce a
terminal scheduler status after preserving the completed-study counters.

- [x] **Step 2: Run scheduler tests and verify RED**

```bash
npx vitest run apps/runtime/test/research-control-study-scheduler.test.ts
```

Expected: constructor does not accept or invoke the coordinator.

- [x] **Step 3: Add post-catch-up reconciliation**

Invoke `ensureNextDecision` only after terminal status validation and only for `caught_up`. Preserve
the exact old status shape when no coordinator is configured. Clone and expose the latest result as
`lastPolicyDecision` when configured.

- [x] **Step 4: Verify and commit Task 3**

```bash
npx vitest run apps/runtime/test/research-control-study-scheduler.test.ts
npm run typecheck --workspace @ouroboros/runtime
git add apps/runtime/src/candidate/arena/research-control-study-scheduler.ts apps/runtime/test/research-control-study-scheduler.test.ts
git commit -m "feat: decide study policy after catch-up"
```

---

### Task 4: Compose Automatic Decisions In The Default Server

**Files:**
- Modify: `apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts`
- Modify: `apps/runtime/test/research-control-study-server-runtime.test.ts`
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/test/server.test.ts`

**Interfaces:**
- Consumes: initialized LocalStore and optional injected decision coordinator.
- Produces: default automatic decision creation plus deterministic opt-out behavior.

- [x] **Step 1: Write failing server composition tests**

Cover pass-through in `createResearchControlStudyServerScheduler`, default empty-store
`lastPolicyDecision: up_to_date`, explicit injected coordinator invocation, disabled startup with
zero calls, and injected scheduler bypass.

- [x] **Step 2: Run server tests and verify RED**

```bash
npx vitest run apps/runtime/test/research-control-study-server-runtime.test.ts apps/runtime/test/server.test.ts
```

Expected: runtime and buildServer do not pass or create the coordinator.

- [x] **Step 3: Compose one coordinator per default server**

Add a BuildServer option for explicit coordinator injection. Create the default application
coordinator from LocalStore, pass it through the server scheduler factory, and leave direct injected
scheduler and disabled startup behavior unchanged.

- [x] **Step 4: Verify focused server and decision loop regression**

```bash
npx vitest run packages/application/src/candidate/research-allocation-policy-decision.test.ts packages/application/src/candidate/research-allocation.test.ts apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts apps/runtime/test/server.test.ts packages/local-store/test/research-control-study.test.ts
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/runtime
```

- [x] **Step 5: Commit Task 4**

```bash
git add apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts apps/runtime/test/research-control-study-server-runtime.test.ts apps/runtime/src/server.ts apps/runtime/test/server.test.ts
git commit -m "feat: automate research policy decisions"
```

---

### Task 5: Durable Truth And Full Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/superpowers/specs/2026-07-12-research-allocation-policy-decision-design.md`
- Modify: `docs/superpowers/specs/2026-07-13-research-allocation-policy-decision-automatic-creation-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-research-allocation-policy-decision-automatic-creation.md`

**Interfaces:**
- Consumes: verified Tasks 1-4.
- Produces: canonical current truth, exact validation evidence, and next frontier selection.

- [x] **Step 1: Update canonical docs with proven behavior**

Record symmetric all-outcome reconciliation, one decision per successful cycle, strict
post-adjudication ordering, same-root create-only publication, next-tick approved provenance,
not-approved negative evidence, and research-only authority. Remove automatic decision creation
from current-gap lists. Keep distinct-regime/forward-time scheduling, learned policy, automatic
promotion, handoff, multi-host ownership, soak, and P0 open.

- [x] **Step 2: Run full verification**

```bash
npx vitest run
npm run typecheck
npm run check:repo-guards
```

- [x] **Step 3: Record exact evidence and self-review**

Update both design statuses, check every plan box, record commit hashes and exact test counts, and
confirm the worktree contains only the existing untracked `.superpowers/` path.

Select the next bounded frontier from current evidence. Prefer forward-time/distinct-regime study
scheduling or automatic promotion readiness only after preserving the separate TradingPromotion
authority boundary.

- [x] **Step 4: Commit durable truth**

```bash
git add AGENTS.md README.md ARCHITECTURE.md docs/project-direction.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/superpowers/specs/2026-07-12-research-allocation-policy-decision-design.md docs/superpowers/specs/2026-07-13-research-allocation-policy-decision-automatic-creation-design.md docs/superpowers/plans/2026-07-13-research-allocation-policy-decision-automatic-creation.md
git commit -m "docs: record automatic policy decisions"
```

## Execution Evidence

- Design and plan: `daa7709` (`docs: design automatic research policy decisions`)
- Task 1: `54cdbca` (`fix: reconcile policy decision races`)
- Task 2: `fc8bf6b` (`feat: ensure terminal study policy decisions`)
- Task 3: `72b8973` (`feat: decide study policy after catch-up`)
- Task 4: `ea01ace` (`feat: automate research policy decisions`)
- Focused regression: 6 files, 127 tests passed.
- Full regression: 178 files, 2,858 tests passed.
- Type safety: `npm run typecheck` passed for every workspace.
- Repository policy: `npm run check:repo-guards` passed, including docs, architecture, naming,
  tracked environment, secret, and diff checks.
- Worktree review: only the nine intended durable-truth documents and the pre-existing untracked
  `.superpowers/` path remained before this documentation commit.

The next bounded frontier should address forward-time and distinct-regime study scheduling before
claiming external validity. Automatic TradingPromotion remains a separate authority boundary.
