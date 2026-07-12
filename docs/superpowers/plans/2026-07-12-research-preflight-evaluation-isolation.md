# ResearchPreflight Evaluation Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and
> superpowers:test-driven-development. The paper-handoff predecessor is complete and committed.

**Status:** In progress; Tasks 1-5 complete, Task 6 next

**Goal:** Separate adaptive development replay from one-shot sealed CandidateArena admission so a
ResearchWorker can learn from useful experiment feedback without repeatedly querying or selecting
against the evidence that authorizes materialization.

**Architecture:** Persist one pre-effect `ResearchPreflightCommitment` per direction, run bounded
development replay with adaptive aggregate feedback, freeze one artifact using development evidence
only, run at most one evaluator-owned rotating sealed admission suite over those exact bytes, then
run paper handoff conformance and bind the complete graph into the existing terminal evaluation,
Finding, Lineage, admission, and materialization path.

**Tech Stack:** TypeScript, Vitest, application ports, LocalStore JSON evidence, deterministic
scenario generation, Host and Docker Sandboxes `sbx` artifact runners, CandidateArena.

## Preconditions

- [x] `docs/superpowers/plans/2026-07-12-paper-trading-handoff-conformance.md` is `Complete`.
- [x] Its focused regression, workspace typecheck, repository guards, and full `npm test` pass on
  the predecessor head (`121` files and `1,878` tests).
- [x] `docs: record paper handoff conformance` is committed separately as `d420837`.

## Global Constraints

- Follow
  `docs/superpowers/specs/2026-07-12-research-preflight-evaluation-isolation-design.md`.
- Use `ResearchPreflightCommitment` as the only new canonical noun.
- Rich development feedback is allowed and explicitly non-authoritative.
- A practical query cap is a resource bound, not proof against reward hacking.
- The sealed suite is committed before worker effects, never used for development, and rotated by
  tick and direction through a versioned generator plus evaluator-held random seed. Persist only a
  commitment digest, never the raw seed in worker-readable repo or LocalStore state.
- Freeze one submitted artifact before sealed evaluation. No sealed result may influence artifact
  selection or trigger a same-commitment retry.
- Run `PaperTradingHandoffConformance` only for the exact sealed-admission artifact after sealed
  replay accepts it.
- Keep sealed seed, suite digest, scenarios, IDs, outcomes, per-scenario metrics, raw events, and
  evaluator details outside worker prompt, notebook, artifact workspace, and Arena context.
- Preserve infrastructure versus candidate attribution.
- Preserve all paper-only, qualification, promotion, order, private, and live authority boundaries.
- Use TDD and observe each focused RED failure before implementation.
- Commit after every independently reviewable task.

---

### Task 1: Define ResearchPreflightCommitment And Terminal Linkage

**Files:**
- Create: `packages/domain/src/research-preflight-commitment.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: domain fixtures that construct persisted record unions

**Interfaces:**
- Produces: `ResearchPreflightCommitmentRecord`.
- Produces: `researchPreflightCommitmentDigestInput(record)`.
- Produces: `researchPreflightCommitmentHasRuntimeShape(value)`.
- Extends: `TradingEvaluationResultRecord` with optional historical-compatible sealed-admission
  commitment/SystemCode linkage and submission phase/sequence.

- [x] **Step 1: Write failing canonical commitment tests**

Assert exact source, worker, direction, allocation, development policy, rotating sealed policy,
timestamps, closed authority, and deterministic digest. Assert mutation of every identity, policy,
suite, seed-commitment, budget, time, or authority field changes digest input.

- [x] **Step 2: Write failing malformed-shape tests**

Reject missing/wrong refs, non-canonical timestamps, invalid digest or seed commitment, empty suite digest,
development limit outside the allocation budget, sealed limit other than one, wrong release policy,
unknown generator version, or any admission/promotion/order/live authority.

- [x] **Step 3: Write failing terminal-linkage tests**

Prove linkage is all-or-none, sealed phase requires sequence one, commitment and submitted artifact
digests are exact, and historical records remain readable without satisfying new admission.

- [x] **Step 4: Run RED**

```bash
npx vitest run packages/domain/src/research-preflight-commitment.test.ts
```

- [x] **Step 5: Implement and verify**

```bash
npx vitest run packages/domain/src/research-preflight-commitment.test.ts packages/domain/src/paper-trading-handoff-conformance.test.ts packages/domain/src/candidate-admission-policy.test.ts
npm run typecheck --workspace @ouroboros/domain
git add packages/domain/src/index.ts packages/domain/src/research-preflight-commitment.test.ts
git commit -m "feat: define research preflight commitment"
```

Evidence: the RED run failed all 46 new tests before implementation. The final domain regression
passed 3 files and 85 tests, and `@ouroboros/domain` typecheck passed.

---

### Task 2: Generate Precommitted Rotating Evaluation Suites

**Files:**
- Create: `packages/application/src/trading/research/preflight-plan.ts`
- Create: `packages/application/src/trading/research/preflight-plan.test.ts`
- Modify: `packages/application/src/trading/research/replay-trading-api-provider.ts`
- Modify: `packages/application/src/trading/research/types.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Produces: `buildResearchPreflightPlan(input)`.
- Produces: deterministic development and evaluator-held sealed scenario plans plus public
  commitment fields.
- Keeps the raw sealed suite and 256-bit seed in evaluator-owned process/external-adapter state
  only; process loss fails closed.

- [x] **Step 1: Write failing deterministic and rotation tests**

With an injected evaluator seed, prove deterministic generation for one
tick/direction/source/allocation input. Prove independently generated adjacent tick/direction plans
have different seed commitments and suite digests, while the persisted commitment cannot reveal or
reconstruct the raw seed.

- [x] **Step 2: Write failing balance and anti-shortcut tests**

Require long, short, flat, volatility, and cost-stress coverage; balanced directional frequency;
canonical times and finite bounds; and no label encoding in ID, order, timestamp, price magnitude,
difficulty, or provider response shape.

- [x] **Step 3: Write failing visibility tests**

The public commitment view contains version, digest, bound, and release policy but no raw scenario,
expected direction, target risk, outcome, cost labels, or per-scenario score.

- [x] **Step 4: Run RED**

```bash
npx vitest run packages/application/src/trading/research/preflight-plan.test.ts
```

- [x] **Step 5: Implement and verify**

Use a pure deterministic generator. Do not use mutable global randomness or wall-clock time after
the plan input is frozen.

```bash
npx vitest run packages/application/src/trading/research/preflight-plan.test.ts apps/runtime/test/trading-research-loop.test.ts
npm run typecheck --workspace @ouroboros/application
git add packages/application/src/index.ts packages/application/src/trading/research/types.ts packages/application/src/trading/research/preflight-plan.ts packages/application/src/trading/research/preflight-plan.test.ts packages/application/src/trading/research/replay-trading-api-provider.ts apps/runtime/test/trading-research-loop.test.ts
git commit -m "feat: rotate sealed research preflight suites"
```

Evidence: RED failed because the evaluator-owned plan module did not exist. The final plan plus
research runtime regression passed 2 files and 42 tests; the focused generator suite passed 6 tests
after locale-independent ordering, and `@ouroboros/application` typecheck passed.

---

### Task 3: Split Development Replay From Sealed Admission

**Files:**
- Modify: `packages/application/src/trading/research/replay-set-runner.ts`
- Modify: `packages/application/src/trading/research/run-trading-research.ts`
- Modify: `packages/application/src/trading/research/agent-adapters.ts`
- Modify: `packages/application/src/trading/research/types.ts`
- Modify: `apps/runtime/test/trading-research-loop.test.ts`

**Interfaces:**
- Produces separate fixed-entry functions for adaptive development replay and sealed admission.
- Extends `TradingResearchLoopResult` with one frozen submitted artifact and terminal sealed result.
- Keeps the existing standalone replay helper behavior explicit rather than adding an unsafe phase
  boolean to public callers.

- [x] **Step 1: Write failing adaptive-development tests**

Prove the committed development budget permits current one/two iterations, exact aggregate
development feedback remains in prompt/notebook, `previous_best_score` is development-only, and no
development iteration runs paper handoff conformance.

- [x] **Step 2: Write failing freeze-before-sealed tests**

Record the artifact digest and adapter-call count at selection close. Assert one frozen artifact is
selected using development evidence before sealed evaluation starts, and no adapter call occurs
after any sealed result exists.

- [x] **Step 3: Write failing one-shot and no-retry tests**

An adversarial artifact may improve development score across iterations but receives exactly zero
sealed score feedback before freeze and at most one sealed submission. Sealed rejection returns no
new candidate artifact, no retry, and no paper handoff probe.

- [x] **Step 4: Write failing exact-byte conformance tests**

Sealed pass runs one handoff probe over the same digest. Mutation between selection, sealed replay,
and probe rejects and restores bytes. Infrastructure failure propagates without strategy score.

- [x] **Step 5: Run RED**

```bash
npx vitest run apps/runtime/test/trading-research-loop.test.ts
```

- [x] **Step 6: Implement and verify**

```bash
npx vitest run packages/application/src/trading/research/preflight-plan.test.ts packages/application/src/trading/research/paper-handoff-conformance.test.ts apps/runtime/test/trading-research-loop.test.ts
npm run typecheck --workspace @ouroboros/application
git add packages/application/src/trading/research/replay-set-runner.ts packages/application/src/trading/research/run-trading-research.ts packages/application/src/trading/research/agent-adapters.ts packages/application/src/trading/research/types.ts apps/runtime/test/trading-research-loop.test.ts
git commit -m "feat: isolate sealed research admission"
```

Evidence: the listener-backed RED run failed all five selected phase tests against the combined
loop. The final explicit development/sealed plan, handoff, and runtime regression passed 3 files and
65 tests; freeze-time instrumentation proves no adapter call occurs after sealed evaluation starts,
and both `@ouroboros/application` and `@ouroboros/runtime` typechecks passed.

---

### Task 4: Persist Commitment Before Worker Effects

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `packages/local-store/src/index.ts`
- Create: `packages/local-store/test/research-preflight-commitment.test.ts`
- Modify: `packages/local-store/test/paper-trading-handoff-conformance.test.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`

**Interfaces:**
- Adds LocalStore record/get/list operations.
- Moves ResearchWorker and source SystemCode persistence before agent effects.
- Passes one exact evaluator-owned plan into the research loop.

- [x] **Step 1: Write failing LocalStore tests**

Cover persist/get/list/restart/exact record replay, same-ID mutation, malformed digest, missing
source worker/direction/allocation, allocation digest mismatch, budget mismatch, raw-seed leakage,
suite-commitment mismatch, and adjacent commitment rotation.

- [x] **Step 2: Write failing pre-effect ordering tests**

Prove:

```text
ResearchWorker and source SystemCode
-> ResearchPreflightCommitment
-> agent effect
-> development runs
-> frozen submitted SystemCode
-> sealed TradingEvaluationResult
-> PaperTradingHandoffConformance
-> Finding and Lineage
-> CandidateAdmissionDecision
-> materialization
```

Agent failure, process throw, and infrastructure failure must still leave the pre-effect commitment
inspectable without fabricating terminal strategy evidence.

- [x] **Step 3: Bind exact terminal graph**

LocalStore rejects wrong commitment, source, allocation, submitted SystemCode, suite, phase,
sequence, or conformance. CandidateArena materializes only the complete exact graph.

- [x] **Step 4: Implement and verify**

```bash
npx vitest run packages/local-store/test/research-preflight-commitment.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/trading-research-loop.test.ts
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/application
git add packages/application/src/ports/store.ts packages/application/src/candidate/arena.ts packages/local-store/src/index.ts packages/local-store/test/research-preflight-commitment.test.ts packages/local-store/test/paper-trading-handoff-conformance.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/trading-research-loop.test.ts
git commit -m "feat: precommit sealed arena evaluation"
```

**Evidence:** `4` focused files and `86` tests passed with loopback listener permission; the
reference paper soak passed `3` tests; LocalStore, application, and runtime typechecks passed; and
`git diff --check` passed. Coverage includes exact replay and restart, malformed/digest/ref/graph
drift, raw-seed exclusion, rotation and terminal one-shot reuse, pre-effect ordering, process and
infrastructure failure recovery, sealed source/submission/suite binding, conformance-bound
admission, and materialization gating.

---

### Task 5: Close Feedback, Readback, And Adversarial Gaps

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Review: `packages/application/src/trading/research/replay-set-runner.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `apps/runtime/test/trading-research-loop.test.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`

- [x] **Step 1: Write failing worker-surface barrier tests**

Inspect prompt stdin, notebook, replay-set feedback, Arena context, and direction readback. Assert
sealed seed, digest, scenario IDs, outcomes, per-scenario metrics, score deltas, raw events, paths,
commands, and evaluator internals are absent while development feedback remains present.

- [x] **Step 2: Write failing differential-probe control**

Use a fixture worker that alters one decision across its full development budget. Assert it can
observe development movement but cannot infer any sealed delta, request a second sealed evaluation,
or alter the frozen candidate after terminal evidence.

- [x] **Step 3: Add compact readback and efficiency split**

Expose commitment ID, development submission count, sealed terminal status, and generic reason
only. Split development versus sealed scenario/request counts under `not_promotion_authority`.

- [x] **Step 4: Prove closed authority**

Assert isolation changes no research leaderboard rank semantics, PaperTradingEvaluation rank,
qualification, comparison, Trading review, promotion, Gateway order, private, or live path.

- [x] **Step 5: Implement and verify**

```bash
npx vitest run packages/domain/src/research-preflight-commitment.test.ts packages/application/src/trading/research/preflight-plan.test.ts apps/runtime/test/trading-research-loop.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/operator-product-loop-smoke.test.tsx
npm run typecheck --workspace @ouroboros/runtime
git add packages/domain/src/index.ts packages/application/src/candidate/arena.ts packages/local-store/src/index.ts apps/runtime/test/trading-research-loop.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
git commit -m "feat: close sealed preflight feedback"
```

**Evidence:** The Task 5 focused matrix passed `5` files and `141` tests with loopback listener
permission, including domain commitment, evaluator-plan rotation, worker notebook/stdin barriers,
differential development feedback, CandidateArena compact readback, and operator product-loop smoke.
Domain, application, and LocalStore typechecks passed. Readback exposes only commitment ID,
development submission count, generic sealed terminal status/reason, and authority-free phase cost
counts; worker context contains no commitment, digest, suite, scenario identity/result, evaluator
trace, event path, or runner command evidence.

---

### Task 6: Update Durable Truth And Verify The Frontier

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `AGENTS.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/ouroboros-doctrine.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/product-quality-design.md`
- Modify: `docs/superpowers/specs/2026-07-12-research-preflight-evaluation-isolation-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-research-preflight-evaluation-isolation.md`

- [ ] **Step 1: Correct canonical truth**

Record the development/admission split, pre-effect commitment, one-shot rotating sealed set,
feedback release boundary, exact conformance chain, and remaining limits. Do not claim caps prevent
reward hacking or that replay proves economic generalization.

Keep behavior-level duplicate detection, durable ResearchWorker workspace/process recovery,
production comparison scheduling, automatic promotion, champion runner handoff, private/live, full
adversarial coverage, P0, and Goal completion open.

- [ ] **Step 2: Mark design and plan implemented**

Only after every verification step passes, set both statuses to Complete and check all steps.

- [ ] **Step 3: Run focused regression**

```bash
npx vitest run packages/domain/src/research-preflight-commitment.test.ts packages/domain/src/paper-trading-handoff-conformance.test.ts packages/domain/src/candidate-admission-policy.test.ts packages/application/src/trading/research/preflight-plan.test.ts packages/application/src/trading/research/paper-handoff-conformance.test.ts packages/local-store/test/research-preflight-commitment.test.ts packages/local-store/test/paper-trading-handoff-conformance.test.ts apps/runtime/test/trading-research-loop.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/operator-product-loop-smoke.test.tsx
```

- [ ] **Step 4: Run workspace and repository validation**

```bash
npm run typecheck
npm run check:repo-guards
npm test
```

Run listener tests outside the filesystem/network sandbox.

- [ ] **Step 5: Commit durable truth**

```bash
git add README.md ARCHITECTURE.md AGENTS.md docs/project-direction.md docs/ouroboros-doctrine.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/autonomy-model.md docs/naming-taxonomy.md docs/product-quality-design.md docs/superpowers/specs/2026-07-12-research-preflight-evaluation-isolation-design.md docs/superpowers/plans/2026-07-12-research-preflight-evaluation-isolation.md
git commit -m "docs: record isolated research preflight evaluation"
```

## Completion Evidence

Keep this frontier only when current evidence proves:

1. pre-effect commitment without raw-seed persistence or worker visibility;
2. adaptive development feedback with closed authority;
3. artifact selection before sealed outcome;
4. rotating evaluator-owned sealed scenarios with no worker visibility;
5. at most one sealed submission and no same-commitment retry;
6. exact submitted-byte binding through evaluation, conformance, admission, and materialization;
7. causal rejection memory and separate infrastructure attribution;
8. compact readback without hidden evidence leakage;
9. adversarial differential-probe control;
10. focused tests, workspace typechecks, repository guards, and full suite pass;
11. durable docs explicitly leave economic generalization, P0, and Goal completion open.

After completion, route back to auto-project and choose behavior-level duplicate detection or
durable ResearchWorker recovery from current evidence.
