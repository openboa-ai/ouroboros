# Paper Comparison Activation Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist exactly one paper-only activation authorization that binds a verified inert pair,
its sole first tick, both side runtime refs, and one bounded derived policy without starting any
runtime effect.

**Architecture:** Add canonical activation contracts and policy derivation in domain, append the
authorization under the existing LocalStore comparison-evidence transaction, and create an internal
coordinator that reloads the full pair/tick closure before and after append. Do not touch session
lifecycle, runtime composition, public commands, observations, verdicts, or promotion.

**Tech Stack:** TypeScript 5.9, Vitest 4, Node.js `crypto`, filesystem-backed LocalStore

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-11-paper-comparison-activation-authorization-design.md`.
- Frozen design SHA-256: `127fbd2b36cd120da51e0291b0f7b890fd34674e2e2fdb367ccbdfb05bcc3a2e`.
- Caller input contains only comparison ID and idempotency key.
- The authorization binds the sole first tick; callers cannot choose a tick or policy.
- `PaperTradingSessionService` qualification activation, stop, and recovery guards remain unchanged.
- Authorization creation has no market, provider, sandbox, runner, Gateway order, Ledger,
  observation, run-control, verdict, promotion, or public dependency.
- Existing pair/tick/frozen-evidence writer exclusions remain unchanged.
- Every persisted read is total, shape-checked, digest-checked, and fail-closed.

---

## File Map

- Modify `packages/domain/src/index.ts`: add activation side/policy/record, policy derivation, digest,
  and total predicates.
- Create `packages/domain/src/paper-trading-comparison-activation.test.ts`: own domain tests.
- Modify `packages/application/src/ports/store.ts`: add activation append/get/list methods.
- Modify `packages/local-store/src/index.ts`: append and validate authorization under the comparison
  transaction.
- Modify `packages/local-store/test/local-store.test.ts`: prove closure, corruption, conflict, and
  concurrency behavior.
- Create `packages/application/src/trading/paper/comparison-activation-coordinator.ts`: own
  deterministic, effect-free authorization.
- Create `packages/application/src/trading/paper/comparison-activation-coordinator.test.ts`: own
  application tests.
- Modify `packages/application/src/trading/paper/comparison-coordinator.test.ts`: prove real pair,
  tick, LocalStore, and authorization integration with zero runtime effects.
- Modify `AGENTS.md`, `docs/naming-taxonomy.md`, comparison specs, evaluation protocol, and this plan:
  record canonical vocabulary, partial conformance, evidence, and next runtime frontier.

### Task 1: Canonical Activation Authorization Contract

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/paper-trading-comparison-activation.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonActivationSide`.
- Produces: `PaperTradingComparisonActivationPolicy`.
- Produces: `PaperTradingComparisonActivationRecord`.
- Produces: `paperTradingComparisonActivationPolicyFor(policy)`.
- Produces: `paperTradingComparisonActivationDigestInput(record)`.
- Produces: total side, policy, and activation runtime predicates.

- [ ] **Step 1: Write failing policy, digest, and total-predicate tests**

Use the exact record shape and constants from the design. Assert policy derivation copies
`maximum_start_skew_ms`, `maximum_retry_count_per_side`, and
`maximum_provider_request_count_per_side`, then fixes:

```ts
{
  policy_version: "paper-comparison-activation-v1",
  maximum_activation_elapsed_ms: 60_000,
  cleanup_timeout_ms: 10_000,
  require_both_running_before_observation: true,
  partial_start_policy: "stop_started_side_before_retry",
  restart_policy: "recover_both_or_stop_both",
  market_view_policy: "first_tick_then_contiguous_persisted_ticks"
}
```

Prove digest key-order independence and binding of pair/tick digests, side refs, configuration,
policy, scope/status, and no-authority fields. Table-test malformed refs, role swaps, duplicate runs,
zero/negative bounds, policy drift, non-ISO time, wrong scope/status, and any live/private/credential
authority. Predicates must return false without throwing.

- [ ] **Step 2: Run focused test and confirm RED**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-activation.test.ts
```

Expected: fail because activation exports do not exist.

- [ ] **Step 3: Implement the minimal domain contract**

Add the exact design types. Derive policy in one pure function. Canonically digest persisted content
while excluding record metadata, activation ID, server authorization time, and digest. Reuse total
comparison ref/string/number helpers and require distinct champion/challenger run, commitment, and
evaluation refs.

- [ ] **Step 4: Run domain tests and typecheck**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-activation.test.ts packages/domain/src/paper-trading-comparison-tick.test.ts packages/domain/src/paper-trading-comparison-commitment.test.ts
npm run typecheck -w @ouroboros/domain
```

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-activation.test.ts
git commit -m "feat: define paper comparison activation authorization"
```

### Task 2: Atomic Authorization Persistence

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Consumes: Task 1 contracts and existing pair/tick graph validators.
- Produces: `recordPaperTradingComparisonActivation`,
  `getPaperTradingComparisonActivation`, and `listPaperTradingComparisonActivations`.
- Produces: stable activation shape/digest/reload/ref/policy/time/graph/conflict Store errors.

- [ ] **Step 1: Write failing LocalStore tests**

Use `storedComparisonFixture`, record its pair and valid first tick, derive side refs and policy, and
assert exact append/get/list/replay. Add rejection cases for pair/tick digest or ref drift,
configuration drift, side ref drift, policy override, authorization before tick, missing/non-sole or
corrupt tick, non-inert pair, same-ID drift, alternate authorization ID, concurrent alternate writes,
corrupt activation JSON, and persisted shape-valid digest drift.

Capture comparison collection byte snapshots before/after rejected writes to prove no side,
evaluation, observation, Ledger, run-control, sandbox, or tick mutation.

- [ ] **Step 2: Run focused Store tests and confirm RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison activation"
```

- [ ] **Step 3: Implement StorePort and LocalStore**

Add the collection, imports, error codes, shape/digest read validation, and three methods. Serialize
append with `withComparisonEvidenceWriteTransaction`. Independently reload and digest-check the pair
and sole first tick, call the existing full inert pair validator, compare exact side refs and derived
policy, enforce tick-to-authorization time, and allow only one authorization per comparison.

- [ ] **Step 4: Run Store comparison tests and typechecks**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison"
npm run typecheck -w @ouroboros/local-store
npm run typecheck -w @ouroboros/application
```

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist paper comparison activation authorization"
```

### Task 3: Effect-Free Authorization Coordinator

**Files:**
- Create: `packages/application/src/trading/paper/comparison-activation-coordinator.ts`
- Create: `packages/application/src/trading/paper/comparison-activation-coordinator.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`

**Interfaces:**
- Consumes: verified graph reload and activation/tick StorePort methods.
- Produces: `PaperTradingComparisonActivationCoordinator.authorize` with the exact design signature.
- Produces: `PaperTradingComparisonActivationError` with stable application reason codes.

- [ ] **Step 1: Write failing coordinator unit tests**

Use in-memory StorePort methods and a verified graph stub. Prove:

- caller input has only comparison ID/idempotency key;
- one authorization binds exact graph/tick/side refs and derived policy;
- server time is assigned after tick time;
- exact retry revalidates graph/tick and performs no write;
- alternate identity is rejected before calling server time/write;
- missing, malformed, non-sole, or drifted graph/tick/policy state fails closed;
- malformed StorePort objects never throw raw `TypeError`;
- concurrent alternate calls produce one authorization;
- returned `runtimeEffects` is `not_started` and graph remains `not_granted`.

- [ ] **Step 2: Write failing real integration test**

Extend the existing real comparison fixture: prepare the pair, capture the first tick, authorize it,
then assert the LocalStore authorization exists while both side evaluations remain `not_started`,
both runners are inactive, and provider/sandbox/market read counters do not change during
authorization.

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-activation-coordinator.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts -t "activation authorization"
```

- [ ] **Step 4: Implement the coordinator**

Use a SHA-256 suffix of comparison ID plus idempotency key and one promise-tail queue. Reload the
verified graph, load exactly one tick, derive side/policy fields, assign server time only after all
closure checks, append through StorePort, then reload graph/tick/authorization and compare persisted
semantic content. Map raw dependency failures to stable errors without payloads or configuration.

- [ ] **Step 5: Run focused integration and full typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-activation-coordinator.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts -t "paper comparison"
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/application/src/trading/paper/comparison-activation-coordinator.ts packages/application/src/trading/paper/comparison-activation-coordinator.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
git commit -m "feat: authorize paper comparison activation"
```

### Task 4: Durable Writeback And Whole-Branch Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: comparison design specs
- Modify: `docs/superpowers/plans/2026-07-11-paper-comparison-activation-authorization.md`

- [ ] **Step 1: Update durable truth**

Add `PaperTradingComparisonActivation` to canonical vocabulary. Record authorization as implemented
but runtime effects, attempts/outcomes, symmetric start/cleanup/recovery, paired observation,
verdict, and promotion as pending. Explicitly state that authorization is not runtime evidence.

- [ ] **Step 2: Historicalize this plan**

Replace execution detail with a compact record containing goal, invariants, commit ledger, focused
and full validation, review decision, and next runtime frontier.

- [ ] **Step 3: Run full verification**

```bash
npm test
npm run typecheck
npm run check:repo-guards
```

Use local loopback/IPC test permission when required and record exact suite/test counts.

- [ ] **Step 4: Review authority closure**

Confirm no production runtime composition, public command, session lifecycle, market read, provider,
sandbox, runner, run-control, Ledger, observation, verdict, or promotion path changed. Re-run focused
guards proving session qualification activation/stop/recovery still reject or skip.

- [ ] **Step 5: Commit durable writeback**

```bash
git add AGENTS.md docs/naming-taxonomy.md docs/candidate-arena-evaluation-protocol.md docs/superpowers/specs docs/superpowers/plans/2026-07-11-paper-comparison-activation-authorization.md
git commit -m "docs: record paper comparison activation authorization"
```

## Self-Review

- [x] Spec coverage: domain, policy, StorePort, LocalStore closure, coordinator, corruption,
  concurrency, zero-effect integration, taxonomy, and verification each have one owner.
- [x] Scope: no task edits session service, runtime composition, commands, market adapters,
  observation, Ledger, verdict, or promotion code.
- [x] Type consistency: activation side/policy/record, digest/predicates, StorePort methods, and
  coordinator names match the design.
- [x] Ordering: graph and sole tick verify before server time/write; exact replay revalidates;
  post-write reload verifies persisted semantic equality.
- [x] Authority: record scope is qualification-pair-only and all live/private/credential/order
  authority fields remain closed.
- [x] Documentation: completed execution detail is historicalized after evidence collection.
