# ResearchMemoryControlStudy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: approved for autonomous execution under the active CandidateArena goal.

**Goal:** Add a precommitted same-baseline paired control that can determine whether released
cross-generation research memory reduces exact repeated TradingSystem behavior relative to a
memory-masked condition.

**Architecture:** Bind an exact `ResearchWorkerMemoryPolicy` into every new CandidateArena
preflight, then compose independent fresh-baseline treatment/control pairs from existing
CandidateArena ticks. Persist pair outcomes from external admission/fingerprint evidence and derive
one all-pairs exact-sign-test outcome with no policy, promotion, order, private, or live authority.

**Tech Stack:** TypeScript, Node filesystem/crypto, CandidateArena, ResearchPreflight,
ResearchWorkerCheckpoint, LocalStore, Vitest, existing exact sign-test implementation.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-13-research-memory-control-study-design.md` exactly.
- The only intervention is cross-generation memory visibility.
- Keep source artifact, provider/model/profile, direction, allocation, submission limit, and
  within-session aggregate feedback equal inside each pair.
- Derive exact-repeat evidence only from unchanged-artifact or exact same-suite behavior-fingerprint
  evidence recorded outside the worker.
- Expose no raw evaluator, sealed, paper, private, account, fill, command, provider-output, or live
  field.
- Never rerun only one interrupted side of a pair.
- Add no public command, default scheduler, UI, policy replacement, promotion, order, private, or
  live path.
- Keep `.superpowers/` untracked and untouched.
- Use TDD and observe focused RED before production changes.

---

### Task 1: Preflight-Bound ResearchWorker Memory Policy

**Files:**

- Modify: `packages/domain/src/index.ts`
- Create: `packages/application/src/candidate/research-worker-memory.ts`
- Create: `packages/application/src/candidate/research-worker-memory.test.ts`
- Modify: `packages/application/src/trading/research/preflight-plan.ts`
- Modify: `packages/application/src/trading/research/preflight-plan.test.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `packages/application/src/trading/research/agent-adapters.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify: `apps/runtime/test/trading-research-loop.test.ts`
- Modify: `packages/local-store/src/index.ts`
- Create: `packages/local-store/test/research-worker-memory-policy.test.ts`

**Interfaces:**

- Produces:

```ts
export type ResearchWorkerMemoryMode = "released_memory" | "memory_masked";

export interface ResearchWorkerMemoryControlAssignment {
  study_ref: Ref;
  study_digest: string;
  pair_index: number;
  arm_kind: "released_memory_treatment" | "memory_masked_control";
}

export interface ResearchWorkerMemoryPolicy {
  protocol_version: "research_worker_memory_v1";
  memory_mode: ResearchWorkerMemoryMode;
  memory_source_digest: string;
  available_memory_item_count: number;
  arena_context_digest: string;
  prior_checkpoint:
    | {
        disposition: "included" | "masked";
        checkpoint_ref: Ref;
        checkpoint_digest: string;
      }
    | { disposition: "none_available" };
  control_assignment?: ResearchWorkerMemoryControlAssignment;
}

export function buildResearchWorkerMemoryProjection(input: {
  mode: ResearchWorkerMemoryMode;
  currentContext: Record<string, unknown>;
  memoryContext: Record<string, unknown>;
  priorCheckpointRecord?: ResearchWorkerCheckpointRecord;
  priorCheckpoint?: TradingResearchPriorCheckpoint;
}): {
  arenaContext: string;
  priorCheckpoint?: TradingResearchPriorCheckpoint;
  policy: ResearchWorkerMemoryPolicy;
};
```

- Modifies `ResearchPreflightCommitmentRecord` with optional persisted `memory_policy` for version-1
  compatibility. `buildResearchPreflightPlan` accepts optional `memory_policy`; every CandidateArena
  caller supplies it.
- Adds `researchMemoryMode?: ResearchWorkerMemoryMode` and
  `researchMemoryControlAssignment?: ResearchWorkerMemoryControlAssignment` to
  `RunCandidateArenaTickInput`. The mode defaults to `released_memory`; only the paired runtime uses
  the assignment.

- [ ] **Step 1: Write RED projection tests**

  Prove the released projection contains all current and safe memory fields plus the supplied prior
  checkpoint, while the masked projection contains only current fields and
  `research_memory_policy: { memory_mode: "memory_masked" }`. Assert both policies bind the same
  non-zero memory source digest/count, opposite dispositions, and different exact context digests.

- [ ] **Step 2: Run the projection test and capture RED**

  Run:

  ```bash
  npx vitest run packages/application/src/candidate/research-worker-memory.test.ts
  ```

  Expected: FAIL because `buildResearchWorkerMemoryProjection` and domain types do not exist.

- [ ] **Step 3: Implement the pure projection and domain runtime shape**

  Canonicalize with `paperTradingComparisonPersistedRecordDigestInput`. Count each non-empty
  top-level memory object as one item and every top-level array element as one item, plus one for an
  available prior checkpoint. Reject zero available items only in study validation, not ordinary
  CandidateArena operation.

- [ ] **Step 4: Write RED preflight and LocalStore graph tests**

  Prove the commitment digest changes with policy content, old commitments without a policy remain
  readable, new CandidateArena commitments always have one, and an included/masked checkpoint ref
  must resolve to the exact digest, worker, direction, and a close time no later than commitment.
  At this task boundary validate assignment shape/digest only; Task 4 adds the study graph check.

- [ ] **Step 5: Wire CandidateArena before worker effects**

  Split the current `arenaContext` object into `currentContext` and `memoryContext` inside
  `arena.ts`. Resolve lifecycle and safe memory projection before building/persisting preflight;
  pass the projected context and only the projected prior checkpoint into `runTradingResearchLoop`.

- [ ] **Step 6: Harden the provider projection**

  Allow only `research_memory_policy` in addition to the existing safe keys. Export or exercise the
  sanitizer so tests prove the exact provider JSON hashes to `arena_context_digest` and a masked
  prompt contains no leaderboard, Finding, cluster, rejection, diversity, efficiency, released
  campaign, or prior-checkpoint content.

- [ ] **Step 7: Run focused GREEN and typechecks**

  ```bash
  npx vitest run packages/application/src/candidate/research-worker-memory.test.ts packages/application/src/trading/research/preflight-plan.test.ts packages/local-store/test/research-worker-memory-policy.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/trading-research-loop.test.ts
  npm run typecheck --workspace @ouroboros/domain
  npm run typecheck --workspace @ouroboros/application
  npm run typecheck --workspace @ouroboros/local-store
  git diff --check
  ```

  Expected: all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add packages/domain/src/index.ts packages/application/src/candidate/research-worker-memory.ts packages/application/src/candidate/research-worker-memory.test.ts packages/application/src/trading/research/preflight-plan.ts packages/application/src/trading/research/preflight-plan.test.ts packages/application/src/candidate/arena.ts packages/application/src/trading/research/agent-adapters.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/trading-research-loop.test.ts packages/local-store/src/index.ts packages/local-store/test/research-worker-memory-policy.test.ts
  git commit -m "feat: bind research worker memory policy"
  ```

### Task 2: Generic Bounded Research Baseline And Source

**Files:**

- Modify: `packages/domain/src/index.ts`
- Create: `apps/runtime/src/candidate/arena/research-experiment-baseline.ts`
- Create: `apps/runtime/test/research-experiment-baseline.test.ts`
- Create: `apps/runtime/src/candidate/arena/research-experiment-source.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-commitment-coordinator.ts`
- Modify: `apps/runtime/test/research-control-campaign.test.ts`
- Modify: `packages/application/src/candidate/research-control-campaign.ts`
- Modify: `packages/application/src/candidate/research-generalization-protocol.ts`

**Interfaces:**

- Rename TypeScript-only campaign primitives to `ResearchExperimentBaselineSnapshot`,
  `ResearchExperimentSource`, and `ResearchExperimentAgentIdentity`; update all imports directly and
  add no aliases.
- Preserve old persisted snapshot values while accepting the new exclusion policy:

```ts
exclusion_policy:
  | "research_control_campaign_evidence_only"
  | "research_experiment_evidence_only";
```

- Produces bounded helpers:

```ts
captureResearchExperimentBaseline(input): Promise<ResearchExperimentBaselineSnapshot>
verifyResearchExperimentBaseline(input): Promise<void>
ensureResearchExperimentStoreCopy(input): Promise<void>
resolveResearchExperimentSource(input): Promise<{
  source: ResearchExperimentSource;
  artifactDirectory: string;
}>
```

- [ ] **Step 1: Write RED baseline tests**

  Prove deterministic sorted regular-file capture, file/byte limits, symlink/temp rejection, atomic
  copy, exact verification, source closure validation, and exclusion of allocation-control and
  memory-control evidence collections.

- [ ] **Step 2: Run RED**

  ```bash
  npx vitest run apps/runtime/test/research-experiment-baseline.test.ts
  ```

  Expected: FAIL because the generic helpers do not exist.

- [ ] **Step 3: Extract the existing implementation without changing campaign behavior**

  Move bounded file traversal, verification, temporary-copy, and source-resolution code out of
  `research-control-campaign.ts`. Keep campaign public wrapper behavior only where tests require it;
  production campaign code calls the generic functions.

- [ ] **Step 4: Run campaign regressions and typechecks**

  ```bash
  npx vitest run apps/runtime/test/research-experiment-baseline.test.ts apps/runtime/test/research-control-campaign.test.ts apps/runtime/test/research-control-campaign-outcome.test.ts
  npm run typecheck --workspace @ouroboros/domain
  npm run typecheck --workspace @ouroboros/runtime
  git diff --check
  ```

  Expected: all pass and no persisted campaign fixture rewrite.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/domain/src/index.ts apps/runtime/src/candidate/arena/research-experiment-baseline.ts apps/runtime/test/research-experiment-baseline.test.ts apps/runtime/src/candidate/arena/research-experiment-source.ts apps/runtime/src/candidate/arena/research-control-campaign.ts apps/runtime/src/candidate/arena/research-control-study-commitment-coordinator.ts apps/runtime/test/research-control-campaign.test.ts packages/application/src/candidate/research-control-campaign.ts packages/application/src/candidate/research-generalization-protocol.ts
  git commit -m "refactor: share bounded research baselines"
  ```

### Task 3: Memory Study, Pair Outcome, And Inference Decisions

**Files:**

- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/research-memory-control-study.test.ts`
- Create: `packages/application/src/candidate/research-memory-control-study.ts`
- Create: `packages/application/src/candidate/research-memory-control-study.test.ts`
- Create: `packages/application/src/candidate/research-memory-control-study-outcome.ts`
- Create: `packages/application/src/candidate/research-memory-control-study-outcome.test.ts`

**Interfaces:**

- Produces `ResearchMemoryControlStudyRecord`, `ResearchMemoryControlPairOutcomeRecord`, and
  `ResearchMemoryControlStudyOutcomeRecord` plus canonical digest inputs and runtime-shape guards.
- Produces deterministic pure decisions:

```ts
decideResearchMemoryControlStudy(input): ResearchMemoryControlStudyRecord
decideResearchMemoryControlPairOutcome(input): ResearchMemoryControlPairOutcomeRecord
decideResearchMemoryControlStudyOutcome(input): ResearchMemoryControlStudyOutcomeRecord
researchMemoryControlStudyId(idempotencyKey: string): string
researchMemoryControlPairOutcomeId(studyId: string, pairIndex: number): string
researchMemoryControlStudyOutcomeId(studyId: string): string
```

- [ ] **Step 1: Write RED domain/application decision tests**

  Cover 6/30 bounds, at least two directions, canonical sequence/IDs, opposite modes, one submission,
  no authority widening, exact digest sensitivity, eligible `+1/0/-1` pair classification, and all
  ineligible reasons from the design.

- [ ] **Step 2: Run RED**

  ```bash
  npx vitest run packages/domain/src/research-memory-control-study.test.ts packages/application/src/candidate/research-memory-control-study.test.ts packages/application/src/candidate/research-memory-control-study-outcome.test.ts
  ```

  Expected: FAIL because the records and decision functions do not exist.

- [ ] **Step 3: Implement study and pair decisions**

  Require the study baseline to contain a non-empty source and exact agent identity. Pair evidence
  must bind planned tick IDs, exact memory policies, same memory source digest/count, tick/preflight/
  admission digests, external behavior status, and resource summaries. Use `null`, never zero, for
  an ineligible paired difference.

- [ ] **Step 4: Implement all-pairs inference**

  Reuse `exactTwoSidedSignTestPValue`. Require every planned pair outcome in exact order. Six
  favorable non-tied pairs must yield `0.03125` and `memory_effect_supported`; missing, substituted,
  ineligible, tied-only, adverse, non-positive mean, or widened-authority evidence must not.

- [ ] **Step 5: Run GREEN and typechecks**

  ```bash
  npx vitest run packages/domain/src/research-memory-control-study.test.ts packages/application/src/candidate/research-memory-control-study.test.ts packages/application/src/candidate/research-memory-control-study-outcome.test.ts
  npm run typecheck --workspace @ouroboros/domain
  npm run typecheck --workspace @ouroboros/application
  git diff --check
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add packages/domain/src/index.ts packages/domain/src/research-memory-control-study.test.ts packages/application/src/candidate/research-memory-control-study.ts packages/application/src/candidate/research-memory-control-study.test.ts packages/application/src/candidate/research-memory-control-study-outcome.ts packages/application/src/candidate/research-memory-control-study-outcome.test.ts
  git commit -m "feat: define research memory control studies"
  ```

### Task 4: Append-Only Store Graph

**Files:**

- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Create: `packages/local-store/test/research-memory-control-study.test.ts`

**Interfaces:**

- Adds `record/get/list` methods for study, pair outcome, and study outcome records.
- Study publication is create-only and must precede every planned tick allocation/preflight in the
  coordinator store.
- Pair and study outcomes are append-only under deterministic identities and exact source digests.
- A study-assigned preflight is accepted only when the exact study has already been replicated into
  the arm store and the assignment matches one planned tick, pair, mode, and arm kind.

- [ ] **Step 1: Write RED persistence and adversarial graph tests**

  Test idempotent exact replay, conflicting replay, malformed digest, study-after-preflight,
  unplanned assigned tick, pair index/tick substitution,
  mode swap, memory-source mismatch, duplicate pair outcome, missing pair, outcome omission, order
  change, post-effect study publication, and every authority flag.

- [ ] **Step 2: Run RED**

  ```bash
  npx vitest run packages/local-store/test/research-memory-control-study.test.ts
  ```

  Expected: FAIL because StorePort and LocalStore methods do not exist.

- [ ] **Step 3: Implement minimal append-only methods and graph checks**

  Use existing `writeJsonCreateOnly`, runtime-shape guards, canonical digest helpers, deterministic
  collection names, and exact sorting. Do not add generic untyped record persistence.

- [ ] **Step 4: Run GREEN plus adjacent Store tests**

  ```bash
  npx vitest run packages/local-store/test/research-memory-control-study.test.ts packages/local-store/test/research-control-study.test.ts packages/local-store/test/research-worker-memory-policy.test.ts
  npm run typecheck --workspace @ouroboros/application
  npm run typecheck --workspace @ouroboros/local-store
  git diff --check
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/research-memory-control-study.test.ts
  git commit -m "feat: persist research memory controls"
  ```

### Task 5: Paired Fresh-Baseline Runtime

**Files:**

- Create: `apps/runtime/src/candidate/arena/research-memory-control-study.ts`
- Create: `apps/runtime/test/research-memory-control-study.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-experiment-baseline.ts`
- Modify: `packages/application/src/candidate/arena.ts`

**Interfaces:**

- Produces:

```ts
prepareResearchMemoryControlStudy(input): Promise<ResearchMemoryControlStudyRecord>
runResearchMemoryControlStudy(input): Promise<{
  study: ResearchMemoryControlStudyRecord;
  pairOutcomes: ResearchMemoryControlPairOutcomeRecord[];
  outcome: ResearchMemoryControlStudyOutcomeRecord;
}>
researchMemoryControlStudyWorkspacePaths(input): {
  studyRoot: string;
  baselineRoot: string;
  sourceArtifactRoot: string;
  pairRoots: Array<{
    releasedMemory: string;
    memoryMasked: string;
  }>;
}
```

- [ ] **Step 1: Write RED runtime tests with an injected memory-sensitive session adapter**

  Run six planned pairs from one fixture baseline. The treatment adapter must inspect released
  memory and produce distinct behavior; the masked adapter must repeat baseline behavior. Assert
  fresh stores, identical source/direction/budget/agent inputs, concurrent initial pair starts,
  exact preflight policies, six `+1` outcomes, `0.03125`, and no coordinator population mutation.

- [ ] **Step 2: Write RED restart and failure tests**

  Cover exact replay with zero new provider calls, both-complete outcome reconstruction, one-sided
  completion becoming interrupted/ineligible without missing-side rerun, orphan preflight recovery,
  provider failure, baseline mutation, pair-root collision, and later-pair continuation after one
  failed pair.

- [ ] **Step 3: Run RED**

  ```bash
  npx vitest run apps/runtime/test/research-memory-control-study.test.ts
  ```

  Expected: FAIL because runtime composition does not exist.

- [ ] **Step 4: Implement preparation and workspace isolation**

  Capture baseline and source before study publication, commit the study before pair effects, create
  one verified baseline root and two fresh verified copies per pair, replicate the exact study into
  each arm store before allocation, and copy the sealed source artifact once outside arm stores.
  Reject overlapping source/workspace paths.

- [ ] **Step 5: Implement bounded execution and evidence collection**

  Execute pairs sequentially and initial sides with `Promise.allSettled`. Call
  `runCandidateArenaTick` with one explicit direction and the exact mode. Derive pair evidence from
  exact tick, allocation, preflight, checkpoint, admission, and fingerprint records. Record terminal
  ineligible evidence rather than replacing or retrying a pair.

- [ ] **Step 6: Implement evidence-derived restart**

  Before any provider call, inspect planned tick allocation/preflight/tick evidence in both arm
  stores. Recover orphan checkpoints through `recoverIncompleteResearchWorkerCheckpoints`; never
  adopt processes or rerun one side. Reconstruct only when both complete exact ticks already exist.

- [ ] **Step 7: Run focused GREEN and runtime typecheck**

  ```bash
  npx vitest run apps/runtime/test/research-memory-control-study.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/research-control-campaign.test.ts
  npm run typecheck --workspace @ouroboros/runtime
  git diff --check
  ```

- [ ] **Step 8: Run one bounded real Codex integration probe**

  Use one non-inferential pair against a temporary copied fixture store with the installed Codex
  CLI. Verify opposite memory policies, exact provider cleanup, terminal pair evidence, and no raw
  evaluator/provider output in persisted records. Record it as integration evidence only, not
  memory-effect evidence.

- [ ] **Step 9: Commit**

  ```bash
  git add apps/runtime/src/candidate/arena/research-memory-control-study.ts apps/runtime/test/research-memory-control-study.test.ts apps/runtime/src/candidate/arena/research-experiment-baseline.ts packages/application/src/candidate/arena.ts
  git commit -m "feat: run research memory controls"
  ```

### Task 6: Adversarial QA And Durable Truth

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/product-quality-design.md`
- Modify: `research/program.md`
- Modify: this plan and companion design if implementation details changed
- Modify: focused tests identified by review

- [ ] **Step 1: Run an independent code-review pass**

  Review specifically for information leakage, policy confounding, non-independent pair reuse,
  outcome-aware omission, asymmetric restart, forged external evidence, context digest mismatch,
  authority widening, and claims stronger than the persisted evidence.

- [ ] **Step 2: Add adversarial tests before fixes**

  For every actionable finding, first add the narrow failing regression test, observe RED, then make
  the smallest correction and rerun the focused suite.

- [ ] **Step 3: Write canonical documentation**

  Add the three canonical nouns, exact information boundary, same-baseline paired protocol,
  external exact-repeat estimand, restart semantics, non-authority, and empirical-claim limitation.
  State explicitly that deterministic fixtures and one Codex pair do not close causal-memory or
  economic-frontier Goal axes.

- [ ] **Step 4: Run complete validation**

  ```bash
  npm test
  npm run typecheck
  npm run check:repo-guards
  git diff --check
  ```

  Expected: every test, workspace typecheck, docs/architecture/naming/env/secrets guard, and diff
  check passes.

- [ ] **Step 5: Audit scope and evidence**

  Confirm no public route/command, default scheduler, allocation-policy decision, rank,
  qualification, promotion, order, private, or live path changed. Confirm `.superpowers/` remains
  untracked and untouched. Record exact test counts and the real Codex probe disposition below.

- [ ] **Step 6: Commit**

  ```bash
  git add AGENTS.md README.md ARCHITECTURE.md docs/project-direction.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/autonomy-model.md docs/naming-taxonomy.md docs/product-quality-design.md research/program.md docs/superpowers/specs/2026-07-13-research-memory-control-study-design.md docs/superpowers/plans/2026-07-13-research-memory-control-study.md
  git commit -m "docs: record research memory controls"
  ```

- [ ] **Step 7: Reassess the broad Goal**

  Keep the broad Goal open unless an eligible precommitted real-provider multi-pair outcome supports
  the narrow memory effect. Select the next bounded unclosed axis using current repo evidence rather
  than chat memory.
