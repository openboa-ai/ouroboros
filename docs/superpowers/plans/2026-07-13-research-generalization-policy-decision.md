# ResearchGeneralizationPolicyDecision Implementation Plan

Status: approved for autonomous execution under the active CandidateArena goal.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Execute every code step test-first and preserve the
> commit boundaries below.

**Goal:** Consume exact eligible prospective generalization evidence through one separate,
append-only research-policy decision and make that stronger authority basis available to future
uncontrolled CandidateArena allocations and every operator surface.

**Architecture:** Domain owns the record, exact runtime guard, digest input, allocation basis, and
read-model types. Application owns pure decision, idempotent service, oldest-missing coordinator,
allocation resolver precedence, and compact projection. LocalStore independently rederives every
source and allocation linkage. Runtime composes the coordinator after generalization outcome
reconciliation. CLI, TUI, and Web render only the shared projection.

**Tech Stack:** TypeScript, Vitest, LocalStore JSON records, Fastify inject tests, Ink, React server
rendering, existing scheduler and design-system patterns.

## Global Constraints

- Approve only exact `generalization_supported` evidence for the protocol's frozen policy digest.
- Persist `not_approved` for unsupported and insufficient outcomes; never infer static superiority.
- Preserve explicit direction and explicit mode precedence.
- Prefer valid broad approval over same-baseline approval for uncontrolled ticks.
- Create at most one oldest missing decision per coordinator call.
- Add no public command, mutation route, provider authority, rank, qualification, promotion, order,
  private, or live behavior.
- Do not generate or tune allocation-policy parameters in this frontier.
- Keep `.superpowers/` untracked and untouched.

---

### Task 1: Domain Record And Exact Runtime Guard

**Files:**

- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/research-generalization-policy-decision.test.ts`

- [ ] **Step 1: Write RED domain tests**

Cover the exact approved and not-approved shapes plus mutations of every source ref/digest, policy
literal, decision pairing, effective mode, time, digest, and authority field. Assert the persisted
record union accepts only the new exact shape.

- [ ] **Step 2: Confirm RED**

```bash
npx vitest run packages/domain/src/research-generalization-policy-decision.test.ts
```

- [ ] **Step 3: Add canonical domain types**

Add `ResearchGeneralizationPolicyDecisionPolicy`,
`ResearchGeneralizationPolicyDecisionRecord`,
`researchGeneralizationPolicyDecisionDigestInput`, and
`researchGeneralizationPolicyDecisionHasRuntimeShape`. Add the record to the persisted-record
union. Runtime shape must couple `approved` to
`supported_cross_condition_adaptive_effect/adaptive_default` and `not_approved` to
`generalization_outcome_not_eligible/null`.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run packages/domain/src/research-generalization-policy-decision.test.ts
npm run typecheck -w @ouroboros/domain
git diff --check
git add packages/domain/src/index.ts packages/domain/src/research-generalization-policy-decision.test.ts
git commit -m "feat: define generalization policy decisions"
```

---

### Task 2: Pure Decision, Idempotent Service, And Coordinator

**Files:**

- Create: `packages/application/src/candidate/research-generalization-policy-decision.ts`
- Create: `packages/application/src/candidate/research-generalization-policy-decision.test.ts`
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/application/src/index.ts`

- [ ] **Step 1: Write RED pure-decision tests**

Build exact protocol/outcome fixtures and prove supported evidence approves. Prove every other
inference, eligibility, count, baseline, p-value, mean, block, harmful-block, digest, ref, and time
variant rejects input or produces deterministic not-approval as appropriate.

- [ ] **Step 2: Implement the pure decision**

Create the deterministic ID from outcome ID, revalidate the complete protocol/outcome graph and
all frozen support criteria, build the authority-closed record, compute its digest, and validate its
runtime shape.

- [ ] **Step 3: Write RED service and coordinator tests**

Cover source reload mismatch, exact retry, deterministic conflict, create-only race winner,
persistence corruption, duplicate list identities/outcome refs, absent refs, existing-decision
drift, oldest-first creation, one-per-call bounds, equal-time +1 ms, clock regression, overflow, and
up-to-date status.

- [ ] **Step 4: Implement service and coordinator**

Follow the existing same-baseline service pattern but use only generalization protocol/outcome
ports. The coordinator must validate every existing decision before creating the oldest missing
one.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run packages/application/src/candidate/research-generalization-policy-decision.test.ts
npm run typecheck -w @ouroboros/application
git diff --check
git add packages/application/src/candidate/research-generalization-policy-decision.ts packages/application/src/candidate/research-generalization-policy-decision.test.ts packages/application/src/ports/store.ts packages/application/src/index.ts
git commit -m "feat: decide generalized research policy"
```

---

### Task 3: LocalStore Independent Validation

**Files:**

- Modify: `packages/local-store/src/index.ts`
- Create: `packages/local-store/test/research-generalization-policy-decision.test.ts`

- [ ] **Step 1: Write RED LocalStore tests**

Persist a complete exact protocol/outcome graph and decision. Cover round-trip, sorted listing,
exact retry, create-only convergence, append-only conflict, malformed input, wrong digest,
non-deterministic ID, missing source, source ref/digest/policy/time mismatch, false approval,
incorrect reason/effective mode, and corrupt reload.

- [ ] **Step 2: Implement strict store methods**

Add record/get/list methods under `research-generalization-policy-decisions`. Recompute source graph,
approval, identity, and digest independently rather than trusting the application service.

- [ ] **Step 3: Verify and commit**

```bash
npx vitest run packages/local-store/test/research-generalization-policy-decision.test.ts packages/application/src/candidate/research-generalization-policy-decision.test.ts
npm run typecheck -w @ouroboros/local-store
git diff --check
git add packages/local-store/src/index.ts packages/local-store/test/research-generalization-policy-decision.test.ts
git commit -m "feat: persist generalization policy decisions"
```

---

### Task 4: Future Allocation Provenance

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/candidate-arena-research-allocation.test.ts`
- Modify: `packages/application/src/candidate/research-allocation.ts`
- Modify: `packages/application/src/candidate/research-allocation.test.ts`
- Modify: `packages/application/src/candidate/research-allocation-policy-decision.test.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/candidate-arena-research-allocation.test.ts`

- [ ] **Step 1: Write RED basis and precedence tests**

Add the exact `research_generalization_policy_decision` basis shape. Prove explicit direction and
mode avoid decision reads, latest applicable broad approval is selected over any same-baseline
approval, invalid/not-approved/wrong-policy broad decisions are ignored, latest broad ordering is
deterministic, and the previous fallback chain remains intact.

- [ ] **Step 2: Implement resolver precedence**

Load both decision collections only after explicit checks. Validate canonical decision digests and
the current repository policy digest. Clone refs into the returned basis.

- [ ] **Step 3: Write RED LocalStore allocation provenance tests**

Cover exact persistence and rejection of missing, forged, stale, not-approved, wrong-outcome,
wrong-policy, wrong-mode, and time-inverted broad decision bases.

- [ ] **Step 4: Implement independent allocation validation**

Branch by basis kind and reload the corresponding decision family. Do not weaken existing
same-baseline checks.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run packages/domain/src/candidate-arena-research-allocation.test.ts packages/application/src/candidate/research-allocation.test.ts packages/application/src/candidate/research-allocation-policy-decision.test.ts packages/local-store/test/candidate-arena-research-allocation.test.ts
npm run typecheck -w @ouroboros/domain
npm run typecheck -w @ouroboros/application
npm run typecheck -w @ouroboros/local-store
git diff --check
git add packages/domain/src/index.ts packages/domain/src/candidate-arena-research-allocation.test.ts packages/application/src/candidate/research-allocation.ts packages/application/src/candidate/research-allocation.test.ts packages/application/src/candidate/research-allocation-policy-decision.test.ts packages/local-store/src/index.ts packages/local-store/test/candidate-arena-research-allocation.test.ts
git commit -m "feat: apply generalized policy provenance"
```

---

### Task 5: Scheduler And Default Server Composition

**Files:**

- Modify: `apps/runtime/src/candidate/arena/research-control-study-scheduler.ts`
- Modify: `apps/runtime/test/research-control-study-scheduler.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts`
- Modify: `apps/runtime/test/research-control-study-server-runtime.test.ts`
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/test/server.test.ts`

- [ ] **Step 1: Write RED scheduler-order tests**

Prove the order is generalization outcome, generalization policy decision, same-baseline decision;
all run only after `caught_up`. Prove no decision after contention, failure, stop, or outcome
coordinator failure. Preserve each last result in cloned scheduler status.

- [ ] **Step 2: Implement scheduler lifecycle**

Add an optional coordinator interface and `lastGeneralizationPolicyDecision` status. Invoke it
between the existing outcome and same-baseline coordinators.

- [ ] **Step 3: Write RED server composition tests**

Cover injected and default coordinator creation, startup-disable behavior, lifecycle status, and
server-close ordering.

- [ ] **Step 4: Compose the default coordinator**

Add server option, factory, and default wiring. Do not expose a command or route.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts apps/runtime/test/server.test.ts
npm run typecheck -w @ouroboros/runtime
git diff --check
git add apps/runtime/src/candidate/arena/research-control-study-scheduler.ts apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts apps/runtime/test/research-control-study-server-runtime.test.ts apps/runtime/src/server.ts apps/runtime/test/server.test.ts
git commit -m "feat: reconcile generalization policy decisions"
```

---

### Task 6: Shared Decision Readback

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/candidate/research-generalization-read-model.ts`
- Modify: `packages/application/src/candidate/research-generalization-read-model.test.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/server.test.ts`
- Modify: typed `CandidateArenaReadModel` fixtures reported by TypeScript

- [ ] **Step 1: Write RED projection tests**

Add required `latest_policy_decision`. Prove empty, newest decision ordering, simultaneous active
protocol/latest outcome/latest decision, exact source refs, authority closure, cloned output, and
corrupt decision graph failure.

- [ ] **Step 2: Extend the pure projection and CandidateArena load**

Load complete decisions with the existing graph arrays. Expose no digest, raw slot, study, campaign,
artifact, or evaluator fields. Legacy all-absent test doubles receive the canonical empty
projection; partial method availability fails.

- [ ] **Step 3: Verify and commit**

```bash
npx vitest run packages/application/src/candidate/research-generalization-read-model.test.ts apps/runtime/test/server.test.ts
npm run typecheck
git diff --check
git add packages/domain/src/index.ts packages/application/src/candidate/research-generalization-read-model.ts packages/application/src/candidate/research-generalization-read-model.test.ts packages/application/src/candidate/arena.ts apps/runtime/test/server.test.ts apps/operator-web/src/App.test.tsx apps/runtime/test/operator-interface-parity.test.ts apps/runtime/test/operator-tui.test.tsx apps/runtime/test/ouroboros-cli.test.ts
git commit -m "feat: expose generalization policy decisions"
```

---

### Task 7: CLI, TUI, And Web Parity

**Files:**

- Modify: `apps/cli/src/ouroboros-cli.ts`
- Modify: `apps/runtime/test/ouroboros-cli.test.ts`
- Modify: `apps/operator-tui/src/operator-tui.tsx`
- Modify: `apps/runtime/test/operator-tui.test.tsx`
- Modify: `apps/operator-web/src/App.tsx`
- Modify: `apps/operator-web/src/App.test.tsx`
- Modify: `apps/operator-web/src/sections/research/research-generalization-section.tsx`

- [ ] **Step 1: Write RED surface tests**

CLI and TUI compact lines must retain active progress, latest inference, decision status/effective
mode, next action, and `not_promotion_authority`. Web renders a read-only latest-decision block
after outcome, before Finding clusters and Research signals. Assert no controls or downstream
authority language.

- [ ] **Step 2: Implement UI-only presentation mapping**

Keep domain-to-presentation conversion in `App.tsx`; the reusable Research section must not import
domain, API, App, or design tokens directly. Add no command/key binding.

- [ ] **Step 3: Verify and commit**

```bash
npx vitest run apps/runtime/test/ouroboros-cli.test.ts apps/runtime/test/operator-tui.test.tsx apps/runtime/test/operator-interface-parity.test.ts apps/operator-web/src/App.test.tsx
npm run typecheck
git diff --check
git add apps/cli/src/ouroboros-cli.ts apps/runtime/test/ouroboros-cli.test.ts apps/operator-tui/src/operator-tui.tsx apps/runtime/test/operator-tui.test.tsx apps/operator-web/src/App.tsx apps/operator-web/src/App.test.tsx apps/operator-web/src/sections/research/research-generalization-section.tsx
git commit -m "feat: surface generalization policy decisions"
```

---

### Task 8: Durable Truth And Full Verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/product-quality-design.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/autonomy-model.md`
- Modify: design and this plan

- [ ] **Step 1: Record exact durable contracts**

Document taxonomy, approval-only semantics, source graph, precedence, scheduler ordering, readback,
and remaining gaps. Do not claim learned policy parameters, real-market generalization, or
completion of the broad CandidateArena goal.

- [ ] **Step 2: Run focused validation**

```bash
npx vitest run packages/domain/src/research-generalization-policy-decision.test.ts packages/application/src/candidate/research-generalization-policy-decision.test.ts packages/local-store/test/research-generalization-policy-decision.test.ts packages/application/src/candidate/research-allocation.test.ts packages/local-store/test/candidate-arena-research-allocation.test.ts packages/application/src/candidate/research-generalization-read-model.test.ts apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/server.test.ts apps/runtime/test/ouroboros-cli.test.ts apps/runtime/test/operator-tui.test.tsx apps/runtime/test/operator-interface-parity.test.ts apps/operator-web/src/App.test.tsx
```

- [ ] **Step 3: Run complete verification**

```bash
npm run typecheck
npm test
npm run check:repo-guards
```

- [ ] **Step 4: Audit scope and commit**

Confirm no scoring, worker strategy context, rank, admission, qualification, promotion, runner,
order, private, or live code changed. Confirm `.superpowers/` remains untouched.

```bash
git add AGENTS.md README.md docs/project-direction.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/product-quality-design.md docs/naming-taxonomy.md docs/autonomy-model.md docs/superpowers/specs/2026-07-13-research-generalization-policy-decision-design.md docs/superpowers/plans/2026-07-13-research-generalization-policy-decision.md
git commit -m "docs: record generalization policy boundary"
```

- [ ] **Step 5: Reassess the active goal**

Treat learned policy parameter generation, real-market evidence, memory/no-memory and agent/control
causal proof, multi-host fencing, automatic promotion, champion runner handoff, and deployed soak as
separate frontiers. Select the next one from the completion rubric rather than inferring success
from an approved fixture decision.
