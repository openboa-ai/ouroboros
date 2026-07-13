# ResearchAllocationPolicyDecision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record a separate evidence-backed approval for the exact studied adaptive allocation
policy and persist that provenance on future uncontrolled CandidateArena allocations.

**Architecture:** Domain and application layers derive a deterministic decision from an exact study
outcome. LocalStore independently validates the graph. CandidateArena resolves explicit inputs
first, then an applicable approved decision, then the existing repository default, and the chosen
basis is sealed into each allocation record.

**Tech Stack:** TypeScript, Vitest, Node crypto/util, existing StorePort and LocalStore JSON
collections, CandidateArena allocation service.

## Global Constraints

- Only `adaptive_effect_supported` and eligible same-baseline outcome may approve.
- Not-supported and insufficient outcomes never imply static superiority.
- Approval binds the exact studied allocation policy digest.
- Explicit directions and campaign allocation modes always take precedence.
- Historical/current allocation records migrate directly; no compatibility aliases or fallback
  reads are added.
- Study completion does not automatically create a policy decision.
- No evaluation, promotion, order, private, credential, or live authority is added.
- `.superpowers/` remains untracked and untouched.
- Git commits remain pending while approved escalation is unavailable.

---

### Task 1: Strict Policy Decision Domain Contract

**Files:**
- Modify: `packages/domain/src/index.ts`
- Add: `packages/domain/src/research-allocation-policy-decision.test.ts`

**Interfaces:**
- Produces `ResearchAllocationPolicyDecisionPolicy`,
  `ResearchAllocationPolicyDecisionRecord`, digest input, and runtime shape.
- Consumes study/outcome refs and exact SHA-256 digests only.

- [x] **Step 1: Write failing exact-shape tests**

Cover approved and not-approved records, exact keys, deterministic policy constants, null effective
mode for not-approved, digest input, time, and all authority fields. Reject static selection,
approval with null mode, not-approved with adaptive mode, extra keys, digest format drift, evaluation,
promotion, order, and live authority.

- [x] **Step 2: Verify RED**

```bash
npx vitest run packages/domain/src/research-allocation-policy-decision.test.ts
```

- [x] **Step 3: Implement the contract**

Add the exact design interfaces, `researchAllocationPolicyDecisionDigestInput`, and
`researchAllocationPolicyDecisionHasRuntimeShape`. Include the record in `FixtureRecord`.

- [x] **Step 4: Verify Task 1**

```bash
npx vitest run packages/domain/src/research-allocation-policy-decision.test.ts
npm run typecheck --workspace @ouroboros/domain
```

---

### Task 2: Deterministic Decision And Service

**Files:**
- Add: `packages/application/src/candidate/research-allocation-policy-decision.ts`
- Add: `packages/application/src/candidate/research-allocation-policy-decision.test.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `packages/application/src/ports/store.ts`

**Interfaces:**
- Produces `decideResearchAllocationPolicyDecision`, deterministic ID, and
  `ResearchAllocationPolicyDecisionService.decide`.
- Consumes one exact `ResearchControlStudyRecord`, one exact
  `ResearchControlStudyOutcomeRecord`, StorePort, and a clock.

- [x] **Step 1: Write failing inference tests**

Approve only exact `adaptive_effect_supported`; record not-approved for not-supported or
insufficient outcomes. Assert target digest equals the study condition allocation digest, static is
never selected, and caller supplies no status, reason, mode, or statistic.

- [x] **Step 2: Write failing graph/service tests**

Reject study/outcome ref or digest mismatch, pre-outcome decision time, unsupported causal scope,
tampered statistics, missing persisted study/outcome, replay drift, and persistence substitution.

- [x] **Step 3: Implement pure decision and service**

The service reloads exact study/outcome before deciding. Same-ID replay uses the persisted decision
time; changed source graph conflicts. New decisions record once, reload, and deep-compare.

- [x] **Step 4: Add StorePort methods and export**

```ts
recordResearchAllocationPolicyDecision(record): Promise<Record>;
getResearchAllocationPolicyDecision(id): Promise<Record | undefined>;
listResearchAllocationPolicyDecisions(): Promise<Record[]>;
```

- [x] **Step 5: Verify Task 2**

```bash
npx vitest run packages/application/src/candidate/research-allocation-policy-decision.test.ts packages/application/src/candidate/research-control-study-outcome.test.ts
npm run typecheck --workspace @ouroboros/application
```

---

### Task 3: Independent LocalStore Persistence

**Files:**
- Modify: `packages/local-store/src/index.ts`
- Add: `packages/local-store/test/research-allocation-policy-decision.test.ts`

**Interfaces:**
- Produces the `research-allocation-policy-decisions` collection and exact graph validation.
- Consumes Task 1 shape/digest and existing study/study-outcome records.

- [x] **Step 1: Write failing persistence tests**

Prove append/reload/list order/replay, conflict, missing study/outcome, substituted outcome, target
policy digest drift, arithmetic/status drift, pre-outcome time, malformed file, and deterministic
identity.

- [x] **Step 2: Implement collection and graph checks**

Reload study and outcome; recompute their digests, exact inference, decision, decision ID/digest,
target policy digest, authority, and time order before append. Persist no raw paper records.

- [x] **Step 3: Verify Task 3**

```bash
npx vitest run packages/local-store/test/research-allocation-policy-decision.test.ts
npm run typecheck --workspace @ouroboros/local-store
```

---

### Task 4: Persisted Allocation Policy Basis

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/candidate-arena-research-allocation.test.ts`
- Modify: `packages/application/src/candidate/research-allocation.ts`
- Modify: `packages/application/src/candidate/research-allocation.test.ts`
- Modify: `packages/application/src/candidate/research-control-campaign.test.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify: `packages/local-store/src/index.ts`

**Interfaces:**
- Produces `CandidateArenaResearchAllocationPolicyBasis` on every allocation record/read model.
- Decision basis consumes exact decision/outcome refs and digests.

- [x] **Step 1: Write failing domain basis tests**

Accept explicit, repository-default, and decision-backed bases. Reject decision basis on static or
explicit mode, explicit basis on an uncontrolled default, missing/wrong ref kinds, extra fields, and
digest drift.

- [x] **Step 2: Extend allocation decisions and read models**

Require `allocationPolicyBasis` in the pure decision and service. Include it in the allocation
digest/read model and preserve exact replay matching.

- [x] **Step 3: Update direct callers and fixtures**

Campaign adaptive/static calls use `explicit_request`; explicit direction lists use
`explicit_request`; direct default tests use `repository_default` unless specifically testing a
policy decision.

- [x] **Step 4: Add LocalStore decision-basis guard**

For decision-backed allocation, reload an approved decision; require exact decision/outcome digests,
target mode/digest, and `decision.decided_at < allocation.allocated_at`. Reject forged or stale
bases before append.

- [x] **Step 5: Verify Task 4**

```bash
npx vitest run packages/domain/src/candidate-arena-research-allocation.test.ts packages/application/src/candidate/research-allocation.test.ts packages/application/src/candidate/research-control-campaign.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
```

---

### Task 5: Arena Default Decision Resolver

**Files:**
- Modify: `packages/application/src/candidate/research-allocation.ts`
- Modify: `packages/application/src/candidate/research-allocation.test.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`

**Interfaces:**
- Produces `resolveCandidateArenaResearchAllocationPolicy` and decision-backed uncontrolled ticks.
- Consumes explicit request state, current policy digest, and StorePort decision records.

- [x] **Step 1: Write failing resolver table**

Explicit directions/modes win. Latest approved exact-policy decision produces adaptive mode plus
decision basis. Not-approved, stale target digest, malformed, or absent decisions produce adaptive
mode plus repository-default basis. Later invalid decisions do not shadow an earlier valid approval.

- [x] **Step 2: Implement resolver and Arena wiring**

Resolve before allocation persistence. Never use a decision for campaign calls that explicitly pass
adaptive/static mode. Sort applicable decisions by decision time then deterministic ID.

- [x] **Step 3: Write workflow tests**

Run an uncontrolled tick with approved decision and prove allocation/readback contains exact
decision provenance. Run explicit static and explicit directions with the same store and prove no
decision basis is consumed.

- [x] **Step 4: Verify Task 5**

```bash
npx vitest run packages/application/src/candidate/research-allocation.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
npm run typecheck --workspace @ouroboros/application
```

---

### Task 6: Durable Truth And Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/superpowers/specs/2026-07-12-research-allocation-policy-decision-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-research-allocation-policy-decision.md`

**Interfaces:**
- Consumes verified decision and provenance behavior.
- Produces canonical current-state truth, evidence, and the next frontier.

- [x] **Step 1: Update canonical docs**

Document one-sided adaptive approval, exact policy digest, explicit precedence, repository fallback,
decision-backed provenance, and remaining actual-study/distinct-regime boundaries.

- [x] **Step 2: Run focused and required checks**

```bash
npx vitest run packages/domain/src/research-allocation-policy-decision.test.ts packages/application/src/candidate/research-allocation-policy-decision.test.ts packages/local-store/test/research-control-study.test.ts packages/domain/src/candidate-arena-research-allocation.test.ts packages/application/src/candidate/research-allocation.test.ts packages/local-store/test/candidate-arena-research-allocation.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
npx vitest run apps/runtime/test/research-control-study*.test.ts packages/domain/src/research-control-study*.test.ts packages/application/src/candidate/research-control-study*.test.ts packages/local-store/test/research-control-study.test.ts
npm run typecheck --workspaces --if-present
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
npm test
```

- [x] **Step 3: Record frontier decision**

Next: listener-capable prospective study execution and default process discovery, then
distinct-regime and memory/agent factorial protocols. TradingPromotion remains unrelated.

- [ ] **Step 4: Commit when escalation is available**

Stage only explicit repository paths. Never stage `.superpowers/`. If escalation remains
quota-blocked, preserve the verified diff and record the single blocker without retrying another
path.

## Verification Evidence

- Focused policy-decision, allocation-provenance, and study-supervisor regression: 11 files and 200
  tests passed.
- CandidateArena workflow integration: 43 tests passed, including approved-decision provenance and
  explicit-mode precedence.
- All workspace typechecks passed.
- Docs, architecture, naming, tracked-env, secret, and diff guards passed.
- Full suite: 155 of 165 files and 2608 of 2672 tests passed. The 64 failures exactly match the
  prior listener/subprocess-restricted baseline; the two new files and 53 added tests all passed.
  The apparently indirect comparison-checkpoint failure was traced to both paper sessions closing
  activation as `stopped_cleanly/start_failed` before checkpoint capture.
- Promotion decision: implementation is locally ready; listener-capable full-suite evidence and Git
  commit remain pending external environment availability. Git escalation must not be retried before
  the recorded quota window reopens.
