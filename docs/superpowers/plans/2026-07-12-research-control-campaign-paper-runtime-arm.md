# ResearchControlCampaign Paper Runtime Arm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real arm-local paper runtime and make confirmation execution bounded,
restart-projectable, and sleep-aware.

**Architecture:** A runtime-layer comparison advancer projects exactly one next operation from
persisted confirmation evidence. A factory composes that advancer with the existing application
comparison, activation, window, qualification, confirmation, and release services. Waiting is
propagated through the current executor step contract.

**Tech Stack:** TypeScript, Vitest, existing application paper services, OuroborosStorePort,
PaperTradingComparisonSessionPort, GatewayMarketDataPort.

## Global Constraints

- One durable protocol transition per confirmation action.
- Existing application services retain all comparison and release policy authority.
- No second progress cursor or duplicate comparison logic.
- No adoption of unowned running sessions after restart.
- No public command, server auto-start, cross-process lease, or policy-decision automation.
- No TradingPromotion, private exchange, credential, order, or live authority.
- `.superpowers/` remains untracked and untouched.
- Git commits remain pending while approved escalation is unavailable.

---

### Task 1: Confirmation Transition And Waiting Contract

**Files:**
- Create: `apps/runtime/src/candidate/arena/research-control-campaign-paper-comparison-advancer.ts`
- Create: `apps/runtime/test/research-control-campaign-paper-comparison-advancer.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign-paper-confirmation.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign-paper-executor.ts`
- Modify: `apps/runtime/test/research-control-campaign-paper-confirmation.test.ts`
- Modify: `apps/runtime/test/research-control-campaign-paper-executor.test.ts`

- [x] **Step 1: Write failing state-projection tests**

Cover first tick, authorization, start, one driver transition, waiting, unowned recovery, terminal
verdict, exact replay, and graph rejection.

- [x] **Step 2: Verify RED**

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-comparison-advancer.test.ts
```

- [x] **Step 3: Implement the bounded advancer**

Validate the exact confirmation slot and singular evidence, derive deterministic keys, and invoke
only the existing service that owns the selected transition.

- [x] **Step 4: Propagate waiting**

Type `advanceComparison`, preserve a `waiting` result through the confirmation coordinator, and map
it to the executor's existing `wait_until` step.

- [x] **Step 5: Verify Task 1**

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-comparison-advancer.test.ts apps/runtime/test/research-control-campaign-paper-confirmation.test.ts apps/runtime/test/research-control-campaign-paper-executor.test.ts apps/runtime/test/research-control-campaign-paper-runner.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 2: Real Runtime Arm Composition

**Files:**
- Create: `apps/runtime/src/candidate/arena/research-control-campaign-paper-runtime-arm.ts`
- Create: `apps/runtime/test/research-control-campaign-paper-runtime-arm.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-runtime.ts`
- Modify: `apps/runtime/test/research-control-study-runtime.test.ts`

- [x] **Step 1: Write failing factory tests**

Prove that one factory returns the complete runtime arm, reuses one activation ownership
coordinator, and can be supplied as the default arm opener from root-specific stores.

- [x] **Step 2: Verify RED**

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-runtime-arm.test.ts
```

- [x] **Step 3: Compose existing services**

Construct comparison, activation, runtime activation, reader, dynamic window driver, qualification,
verdict, confirmation campaign/window, release, and bounded advancer services. Do not reimplement
their decisions.

- [x] **Step 4: Add the default study arm-opening path**

Allow `runResearchControlCampaignToOutcome` to receive a root-to-store opener plus shared paper
sessions and build the real arm itself, while preserving the existing explicit `openArm` injection
for tests and custom composition.

- [x] **Step 5: Verify Task 2**

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-runtime-arm.test.ts apps/runtime/test/research-control-campaign-paper-runtime.test.ts apps/runtime/test/research-control-study-runtime.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 3: Durable Truth And Frontier Verification

**Files:**
- Modify canonical docs only where the implemented composition changes current truth.
- Modify this plan and its design spec with exact verification evidence.

- [x] **Step 1: Run focused regression**

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-*.test.ts apps/runtime/test/research-control-study-*.test.ts packages/application/src/trading/paper/comparison-*.test.ts
```

- [x] **Step 2: Run required checks**

```bash
npm run typecheck
npm run check:repo-guards
npm test
```

- [ ] **Step 3: Record the next evidence frontier**

Collect one listener-capable prospective replicated study through the real arm factory. Keep
distinct-regime and memory/agent factorial inference separate until that evidence exists.

- [ ] **Step 4: Commit when escalation is available**

Stage only explicit repository paths and never `.superpowers/`. Do not retry Git escalation before
the recorded quota window reopens.

## Verification Evidence

- Advancer, confirmation waiting, executor, and runner: 4 files and 39 tests passed.
- Runtime-arm composition: 2 tests passed.
- Campaign paper and study runtime regression: 18 files and 145 tests passed.
- Application paper comparison regression: 21 of 22 files and 313 of 314 tests passed. The sole
  failure is the previously identified listener-restricted coordinator scenario.
- All workspace typechecks passed.
- Docs, architecture, naming, tracked-env, secret, and diff guards passed.
- Full suite: 159 of 169 files and 2643 of 2707 tests passed. The same 64 tests in the same 10
  listener/subprocess-restricted files failed; both new test files and all 16 new or extended tests
  passed.
- Listener-capable rerun was requested but the execution environment rejected escalation because
  the Codex usage quota does not reopen until 2026-07-18 15:20 KST. Policy prohibits retry or an
  indirect workaround.
- Promotion decision: the runtime-arm frontier is locally ready. Prospective replicated evidence
  and Git commit remain externally blocked; distinct-regime/factorial implementation remains gated
  on that evidence.
