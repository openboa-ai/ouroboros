# ResearchBehaviorFingerprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and
> superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Status:** In progress

**Goal:** Reject textually different CandidateArena submissions that are observationally identical
on the exact development replay protocol while preserving causal research evidence and all sealed,
paper, and live authority boundaries.

**Architecture:** Define an append-only domain record whose canonical digest covers normalized
effective development decisions, derive it in a focused application module from externally recorded
validation requests, persist and validate it in LocalStore, and bind its admitted-only comparison
result into CandidateArena admission before materialization.

**Tech Stack:** TypeScript, Vitest, canonical SHA-256 digests, application ports, LocalStore JSON
evidence, CandidateArena, ResearchPreflight.

## Global Constraints

- Follow
  `docs/superpowers/specs/2026-07-12-research-behavior-fingerprint-design.md` exactly.
- Use `ResearchBehaviorFingerprint` as the only new canonical noun.
- Fingerprint only worker-visible development decisions; never sealed or paper observations.
- Compare exact normalized effective decisions, not scores, PnL, reason text, or event noise.
- Compare only against fingerprints linked from prior admitted decisions on the exact same protocol
  and development suite.
- Preserve historical admission readability while requiring the new CandidateArena path to fail
  closed before materialization.
- Preserve all existing evaluation, conformance, paper-only, promotion, order, private, and live
  authority boundaries.
- Use TDD and observe every focused RED failure before production implementation.
- Keep `.superpowers/` untracked and outside every commit.

---

### Task 1: Define Canonical Fingerprint Evidence

**Files:**
- Create: `packages/domain/src/research-behavior-fingerprint.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces: `ResearchBehaviorFingerprintRecord` and normalized observation types.
- Produces: `researchBehaviorFingerprintDigestInput(record)`.
- Produces: `researchBehaviorFingerprintHasRuntimeShape(value)`.

- [ ] **Step 1: Write failing canonical digest tests**

Construct two records with different SystemCode, commitment, timestamp, and record identity but the
same protocol, suite, and observations. Assert equal digest input. Mutate symbol, side, exact
quantity, order type, scenario ID, suite digest, suite version, and protocol version independently
and assert different digest input.

- [ ] **Step 2: Write failing runtime-shape tests**

Reject missing or extra properties, unsorted/duplicate/empty scenario observations, non-finite or negative
quantity, invalid side/order pairs, wrong refs, count mismatch, non-canonical timestamp or digest,
and any promotion/order/live authority.

- [ ] **Step 3: Run RED**

```bash
npx vitest run packages/domain/src/research-behavior-fingerprint.test.ts
```

Expected: FAIL because the record type and functions are absent.

- [ ] **Step 4: Implement the minimal domain contract**

Add the version-1 record and pure canonical helpers. Keep identity/linkage fields outside the
behavior digest payload and export the record through the persisted-record union.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run packages/domain/src/research-behavior-fingerprint.test.ts packages/domain/src/research-preflight-commitment.test.ts
npm run typecheck --workspace @ouroboros/domain
git add packages/domain/src/index.ts packages/domain/src/research-behavior-fingerprint.test.ts
git commit -m "feat: define research behavior fingerprint"
```

---

### Task 2: Derive Behavior From External Development Decisions

**Files:**
- Create: `packages/application/src/trading/research/behavior-fingerprint.ts`
- Create: `packages/application/src/trading/research/behavior-fingerprint.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: `TradingScenarioEvaluationResult[]` and exact ResearchPreflight/SystemCode linkage.
- Produces: `deriveResearchBehaviorFingerprint(input): ResearchBehaviorFingerprintRecord`.
- Produces: a typed unavailable error for incomplete canonical observations.

- [ ] **Step 1: Write failing normalization tests**

Assert that scenario input order, timestamps, rationale, candidate event noise, scores, metrics,
PnL, and sealed result objects do not alter the record's fingerprint digest. Assert that the final
externally recorded `POST /orders/validate` decision is selected and stripped to the four canonical
order fields.

- [ ] **Step 2: Write failing fail-closed tests**

Reject empty results, duplicate scenario IDs, missing validation requests, malformed orders,
non-finite quantities, and commitment/SystemCode/suite linkage mismatches.

- [ ] **Step 3: Run RED**

```bash
npx vitest run packages/application/src/trading/research/behavior-fingerprint.test.ts
```

Expected: FAIL because the derivation module is absent.

- [ ] **Step 4: Implement pure derivation**

Read only development `provider_requests`, normalize the final effective validation body, sort by
scenario ID, compute the canonical digest, and return a closed-authority domain record. Do not read
sealed admission data.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run packages/application/src/trading/research/behavior-fingerprint.test.ts packages/application/src/trading/research/replay-set-runner.test.ts
npm run typecheck --workspace @ouroboros/application
git add packages/application/src/index.ts packages/application/src/trading/research/behavior-fingerprint.ts packages/application/src/trading/research/behavior-fingerprint.test.ts
git commit -m "feat: derive development behavior fingerprints"
```

---

### Task 3: Persist And Compare An Admitted-Only Graph

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/domain/src/candidate-admission-policy.ts`
- Modify: `packages/domain/src/candidate-admission-policy.test.ts`
- Modify: `packages/local-store/src/index.ts`
- Create: `packages/local-store/test/research-behavior-fingerprint.test.ts`

**Interfaces:**
- Produces store methods: `recordResearchBehaviorFingerprint`, `getResearchBehaviorFingerprint`,
  and `listResearchBehaviorFingerprints`.
- Extends admission policy with `behavior_comparison_status` and reasons `behavior_duplicate` and
  `behavior_fingerprint_unavailable`.
- Adds optional historical-compatible current/matched fingerprint linkage to
  `CandidateAdmissionDecisionRecord`.

- [ ] **Step 1: Write failing persistence tests**

Prove exact append-only replay, canonical digest checking, commitment/SystemCode/suite linkage,
timestamp ordering, malformed-record rejection, and deterministic list ordering.

- [ ] **Step 2: Write failing policy and graph tests**

Prove safety failures take precedence; a comparable admitted match yields
`duplicate/behavior_duplicate`; missing evidence quarantines an otherwise-admissible candidate;
quarantined or duplicate records cannot become baselines; and a claimed `distinct` decision is
rejected when an admitted matching key already exists.

- [ ] **Step 3: Run RED**

```bash
npx vitest run packages/domain/src/candidate-admission-policy.test.ts packages/local-store/test/research-behavior-fingerprint.test.ts
```

Expected: FAIL on the new status, reasons, methods, and graph invariants.

- [ ] **Step 4: Implement persistence and comparison validation**

Add the collection, runtime validator, canonical digest check, exact refs, all-or-none admission
linkage, admitted-only baseline lookup, and append-only semantics. Preserve reads for historical
admission records without linkage.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run packages/domain/src/research-behavior-fingerprint.test.ts packages/domain/src/candidate-admission-policy.test.ts packages/local-store/test/research-behavior-fingerprint.test.ts packages/local-store/test/paper-trading-handoff-conformance.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
git add packages/application/src/ports/store.ts packages/domain/src/candidate-admission-policy.ts packages/domain/src/candidate-admission-policy.test.ts packages/local-store/src/index.ts packages/local-store/test/research-behavior-fingerprint.test.ts
git commit -m "feat: enforce admitted behavior identity"
```

---

### Task 4: Gate CandidateArena Materialization

**Files:**
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify test-only networkless replay runners where their artifact-insensitive behavior would make
  unrelated fixtures observationally identical.

**Interfaces:**
- Consumes: selected development entry, preflight commitment, and frozen SystemCode.
- Persists: one current fingerprint before admission.
- Produces: exact distinct, duplicate, or unavailable admission input and linkage.

- [ ] **Step 1: Write failing end-to-end duplicate test**

Run two ticks whose agents produce different artifact digests while a controlled runner emits the
same effective development orders. Assert one candidate slot, a second
`duplicate/behavior_duplicate` decision, exact prior-fingerprint linkage, a `duplicate_result`
Finding and Lineage, and no second leaderboard entry.

- [ ] **Step 2: Write failing boundary tests**

Prove changes only to reason/event noise/sealed score do not create novelty; a real side or exact
quantity change does; an unavailable fingerprint quarantines before materialization; and duplicate
Finding context reaches the next generation without raw fingerprint or sealed details.

- [ ] **Step 3: Run RED**

```bash
npx vitest run apps/runtime/test/candidate-arena-paper-context.test.ts
```

Expected: FAIL because CandidateArena does not derive or bind behavior identity.

- [ ] **Step 4: Implement the CandidateArena gate**

Pass the development-selected entry separately from the sealed terminal entry, persist its
fingerprint, compare against prior admitted linkage inside the serialized store mutation, then bind
the status and refs into Finding and admission. Never feed sealed data into the fingerprint or
materialized research rank.

- [ ] **Step 5: Repair test fixture fidelity and run GREEN**

Where a networkless runner is intended to represent different executable artifacts, make its
effective order depend on the artifact's declared behavior while staying within risk limits. Keep a
dedicated invariant-behavior runner for the duplicate test.

```bash
npx vitest run apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/managed-codex-researcher-execution.test.ts apps/runtime/test/operator-product-loop-smoke.test.tsx
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/runtime
git add packages/application/src/candidate/arena.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/managed-codex-researcher-execution.test.ts apps/runtime/test/operator-product-loop-smoke.test.tsx
git commit -m "feat: reject duplicate arena behavior"
```

---

### Task 5: Write Back Doctrine And Verify The Frontier

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `AGENTS.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: this design and plan status/evidence

**Interfaces:**
- Records `ResearchBehaviorFingerprint` as bounded development evidence and explicit non-authority.
- Records exact duplicate, unavailable, compatibility, and remaining approximate-clustering gaps.

- [ ] **Step 1: Update canonical truth**

Document the artifact-vs-behavior distinction, admitted-only exact matching, development-only
scope, fail-closed unavailable behavior, generic Finding feedback, and explicit non-claims about
global semantic identity or economic quality.

- [ ] **Step 2: Run focused and package verification**

```bash
npx vitest run packages/domain/src/research-behavior-fingerprint.test.ts packages/domain/src/candidate-admission-policy.test.ts packages/application/src/trading/research/behavior-fingerprint.test.ts packages/local-store/test/research-behavior-fingerprint.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
npm run typecheck
```

- [ ] **Step 3: Run product and repository verification**

```bash
npx vitest run apps/runtime/test/reference-paper-soak-trading-system.test.ts apps/runtime/test/operator-product-loop-smoke.test.tsx
npm run check:repo-guards
npm test
```

- [ ] **Step 4: Mark evidence complete and commit**

Record exact suite/test counts and any residual risks in the design and plan, then run:

```bash
git diff --check
git add README.md ARCHITECTURE.md AGENTS.md docs/project-direction.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-12-research-behavior-fingerprint-design.md docs/superpowers/plans/2026-07-12-research-behavior-fingerprint.md
git commit -m "docs: record arena behavior identity"
```

## Promotion Decision

Promote this frontier only if the current head proves exact behavioral duplicates cannot create
multiple population slots, malformed or unavailable evidence cannot bypass the gate, sealed data
does not affect identity, prior non-admitted fingerprints cannot exclude candidates, and all
focused, product, repository, typecheck, and full-suite evidence is green. Otherwise keep the
frontier active and reroute the smallest failing invariant.
