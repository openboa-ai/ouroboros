# CandidateArena Research Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Ready for implementation

**Goal:** Persist one pre-effect bounded ResearchAllocation per CandidateArena tick and make its focus, exploration, concurrency, and experiment budgets control actual ResearchWorker execution.

**Architecture:** Add a strict domain record and pure deterministic allocation decision, persist it append-only through the Store before worker effects, and bind every new CandidateArena tick to its exact allocation. CandidateArena executes selected lanes in bounded batches, maps experiment budgets to research-loop iterations, aggregates efficiency across those iterations, and projects the allocation into shared read models and researcher context.

**Tech Stack:** TypeScript, Vitest, `@ouroboros/domain`, application services, LocalStore JSON evidence collections, CandidateArena integration tests.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-12-candidate-arena-research-allocation-design.md` exactly.
- Use `CandidateArenaResearchAllocation` as the only new canonical noun.
- Persist the allocation before any ResearchWorker, provider, artifact-runner, or candidate effect.
- Default adaptive mode selects exactly three default directions, at most two focus lanes, and at least one exploration lane.
- Concurrency is exactly bounded at two; focus budget is two experiments, exploration budget is one, and total budget is at most five.
- Static control uses the same three slots, concurrency two, and experiment budgets `2`, `2`, `1` while ignoring evidence.
- Explicit mode preserves one to five unique supplied directions and gives each one experiment.
- Use only released research memory, FindingClusters, completed prior tick outcomes, ResearchEfficiency, and completed allocation history.
- Allocation is research scheduling authority only. It cannot change rank, qualification, Trading review, promotion, paper evidence, orders, private access, or live authority.
- Use TDD and observe each focused RED failure before implementation.
- Commit after every independently reviewable task.

---

### Task 1: Define CandidateArenaResearchAllocation Evidence

**Files:**
- Create: `packages/domain/src/candidate-arena-research-allocation.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces: `CandidateArenaResearchAllocationRecord` and its policy, signal, selection, mode, and selection-kind types.
- Produces: `CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY`.
- Produces: `candidateArenaResearchAllocationDigestInput(record)`.
- Produces: `candidateArenaResearchAllocationHasRuntimeShape(value)`.
- Adds the record to the domain persisted-record union.

- [ ] **Step 1: Write failing canonical-shape and digest tests**

Create a canonical adaptive fixture with three selections and two deferred directions:

```ts
const DEFAULT_SIGNAL_FIXTURES: CandidateArenaResearchAllocationSignal[] = [
  {
    direction_kind: "trend_following",
    finding_pressure_score: 0,
    research_efficiency_score: 0,
    recent_outcome_score: -10,
    focus_score: -10,
    completed_selection_count: 1,
    source_candidate_ids: [],
    source_tick_ids: ["adaptive-tick-1"],
    reasons: ["recent_outcome:failed"]
  },
  {
    direction_kind: "mean_reversion",
    finding_pressure_score: 0,
    research_efficiency_score: 21,
    recent_outcome_score: 0,
    focus_score: 21,
    completed_selection_count: 0,
    source_candidate_ids: [],
    source_tick_ids: ["adaptive-tick-1"],
    reasons: ["research_efficiency_budget:low_cost_latency"]
  },
  {
    direction_kind: "volatility_regime",
    finding_pressure_score: 0,
    research_efficiency_score: 0,
    recent_outcome_score: 0,
    focus_score: 0,
    completed_selection_count: 0,
    source_candidate_ids: [],
    source_tick_ids: [],
    reasons: []
  },
  {
    direction_kind: "funding_aware_risk",
    finding_pressure_score: 0,
    research_efficiency_score: 0,
    recent_outcome_score: 0,
    focus_score: 0,
    completed_selection_count: 0,
    source_candidate_ids: [],
    source_tick_ids: [],
    reasons: []
  },
  {
    direction_kind: "execution_cost_robustness",
    finding_pressure_score: 37,
    research_efficiency_score: 0,
    recent_outcome_score: 0,
    focus_score: 37,
    completed_selection_count: 0,
    source_candidate_ids: ["candidate-001"],
    source_tick_ids: [],
    reasons: [
      "public_execution_evidence_gap:observation_quality:paper_evaluation_failed"
    ]
  }
];

const allocation: CandidateArenaResearchAllocationRecord = {
  record_kind: "candidate_arena_research_allocation",
  version: 1,
  candidate_arena_research_allocation_id:
    "candidate-arena-research-allocation-adaptive-tick-2",
  tick_id: "adaptive-tick-2",
  allocation_mode: "adaptive_default",
  policy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  source_tick_refs: [{
    record_kind: "candidate_arena_tick",
    id: "candidate-arena-tick-adaptive-tick-1"
  }],
  signal_snapshot: DEFAULT_SIGNAL_FIXTURES,
  selected_directions: [
    {
      direction_kind: "execution_cost_robustness",
      selection_kind: "focus",
      priority: 1,
      experiment_budget: 2,
      signal_score: 37,
      reasons: ["public_execution_evidence_gap:observation_quality:paper_evaluation_failed"]
    },
    {
      direction_kind: "mean_reversion",
      selection_kind: "focus",
      priority: 2,
      experiment_budget: 2,
      signal_score: 21,
      reasons: ["research_efficiency_budget:low_cost_latency"]
    },
    {
      direction_kind: "trend_following",
      selection_kind: "exploration",
      priority: 3,
      experiment_budget: 1,
      signal_score: -10,
      reasons: ["exploration_floor"]
    }
  ],
  deferred_directions: ["volatility_regime", "funding_aware_risk"],
  allocated_at: "2026-07-12T10:00:00.000Z",
  allocation_digest: "sha256:allocation",
  research_scheduling_authority: true,
  promotion_authority: false,
  order_submission_authority: false,
  live_exchange_authority: false,
  authority_status: "research_only"
};
```

Assert the fixture is accepted. Assert digest input changes after mutating mode, policy,
signal score, selected order, experiment budget, deferred directions, source refs, time, or any
authority field.

- [ ] **Step 2: Write failing invalid-shape table tests**

Reject each of these mutations independently:

```ts
[
  "unknown allocation mode",
  "non-canonical policy constant",
  "duplicate signal direction",
  "non-finite signal score",
  "duplicate selected direction",
  "non-contiguous priority",
  "focus budget other than two",
  "exploration budget other than one",
  "more than two focus selections",
  "missing adaptive exploration selection",
  "selected and deferred overlap",
  "adaptive default direction omitted",
  "total budget above five",
  "non-canonical allocated_at",
  "empty allocation digest",
  "promotion authority true",
  "order authority true",
  "live authority true",
  "authority status other than research_only"
]
```

Also accept one canonical `static_control` and one canonical `explicit` fixture. Static control must
use three default directions with budgets `2`, `2`, `1`; explicit mode must use one to five unique
directions with budget `1` and no adaptive signal snapshot.

- [ ] **Step 3: Run the domain test and observe RED**

```bash
npm test -- packages/domain/src/candidate-arena-research-allocation.test.ts
```

Expected: FAIL because the allocation exports do not exist.

- [ ] **Step 4: Implement the domain contract**

Add the exact policy:

```ts
export const CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY = {
  policy_kind: "bounded_adaptive_v1",
  default_direction_slot_count: 3,
  maximum_focus_direction_count: 2,
  minimum_exploration_direction_count: 1,
  concurrency_limit: 2,
  focus_experiment_budget: 2,
  exploration_experiment_budget: 1,
  explicit_experiment_budget: 1,
  maximum_total_experiment_budget: 5
} as const satisfies CandidateArenaResearchAllocationPolicy;
```

Implement the types exactly as the design specifies. `candidateArenaResearchAllocationDigestInput`
must remove only `record_kind`, `version`, `candidate_arena_research_allocation_id`, and
`allocation_digest`, then serialize the remaining payload through the repository's canonical
persisted-record JSON path.

`candidateArenaResearchAllocationHasRuntimeShape` must enforce the mode-specific invariants from
Steps 1 and 2, exact policy constants, unique directions, finite integer scores/counts, canonical
refs/times, and closed authority. It validates digest shape but does not hash; LocalStore owns hash
comparison.

- [ ] **Step 5: Run domain tests and typecheck**

```bash
npm test -- packages/domain/src/candidate-arena-research-allocation.test.ts
npm run typecheck --workspace @ouroboros/domain
```

Expected: PASS.

- [ ] **Step 6: Commit domain evidence**

```bash
git add packages/domain/src/index.ts packages/domain/src/candidate-arena-research-allocation.test.ts
git commit -m "feat: define arena research allocations"
```

---

### Task 2: Decide Bounded Adaptive, Static, And Explicit Allocations

**Files:**
- Create: `packages/application/src/candidate/research-allocation.ts`
- Create: `packages/application/src/candidate/research-allocation.test.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `packages/application/src/candidate/arena.ts`

**Interfaces:**
- Consumes: domain allocation types, policy, digest input, FindingClusters, latest tick read models, and prior allocation records.
- Produces: `DEFAULT_ARENA_DIRECTIONS` from `research-allocation.ts`, re-exported through `arena.ts`.
- Produces: `decideCandidateArenaResearchAllocation(input): CandidateArenaResearchAllocationRecord`.
- Produces: `candidateArenaAdaptiveDirectionFocus` and `candidateArenaResearchEfficiencyBudgetFocus` for existing researcher context.
- Produces: `CandidateArenaResearchAllocationDecisionError` with stable code `invalid_candidate_arena_research_allocation_decision_input`.

- [ ] **Step 1: Write failing pure decision tests**

Use fixed clocks and immutable fixtures to prove:

```ts
const result = decideCandidateArenaResearchAllocation({
  tickId: "tick-2",
  allocatedAt: "2026-07-12T10:00:00.000Z",
  allocationMode: "adaptive_default",
  findingClusters,
  latestTicks,
  priorAllocations,
  completedTickIds
});
```

Test these exact outcomes:

1. No signals and no history select `trend_following`, `mean_reversion`, and
   `volatility_regime`, all as exploration with one experiment each.
2. A second completed-history decision selects never-run `funding_aware_risk` and
   `execution_cost_robustness` before any previously completed lane.
3. Public execution failure pressure selects `execution_cost_robustness` as focus with budget `2`.
4. Low-cost mean reversion ResearchEfficiency selects `mean_reversion` as focus while expensive
   trend following remains eligible for exploration.
5. Duplicate, quarantined, and failed latest outcomes contribute `-15`, `-30`, and `-10`.
6. Five positive focus signals still produce only two focus selections and one exploration.
7. Orphan allocations whose tick IDs are not completed do not change exploration counts.
8. `static_control` selects canonical first three with budgets `2`, `2`, `1` under the same signal
   fixture.
9. `explicit` preserves supplied order with budget `1` and rejects empty, duplicate, and six-item
   input.
10. The function does not mutate any input object.

- [ ] **Step 2: Run the decision test and observe RED**

```bash
npm test -- packages/application/src/candidate/research-allocation.test.ts
```

Expected: FAIL because the decision module does not exist.

- [ ] **Step 3: Extract existing scheduling-signal helpers**

Move these behaviors from `arena.ts` without changing their current output:

```ts
export function candidateArenaAdaptiveDirectionFocus(
  findingClusters: CandidateArenaFindingClusterReadModel[]
): CandidateArenaAdaptiveDirectionFocus[];

export function candidateArenaResearchEfficiencyBudgetFocus(
  latestTicks: CandidateArenaTickReadModel[]
): CandidateArenaAdaptiveDirectionFocus[];
```

Move the failure-to-direction mapping, focus score, failure remediation text, latest-outcome lookup,
and ResearchEfficiency effort calculation with them. Keep `arenaContext` using these exports so
allocation and prompt context cannot drift.

- [ ] **Step 4: Implement the pure allocation decision**

Define this input:

```ts
export interface DecideCandidateArenaResearchAllocationInput {
  tickId: string;
  allocatedAt: string;
  allocationMode: CandidateArenaResearchAllocationMode;
  explicitDirections?: ResearchDirectionKind[];
  findingClusters: CandidateArenaFindingClusterReadModel[];
  latestTicks: CandidateArenaTickReadModel[];
  priorAllocations: CandidateArenaResearchAllocationRecord[];
  completedTickIds: string[];
}
```

For adaptive mode, merge per-direction FindingCluster pressure, positive ResearchEfficiency focus,
and recent outcome adjustment. Focus selection requires `focus_score > 0`. Fill to three using
completed allocation counts, never/oldest selection, then canonical order. Static and explicit
mode follow the design's exact selection and budget rules.

Construct ID `candidate-arena-research-allocation-${safeId(tickId)}`, canonical source tick refs,
signal snapshots, selected priorities, deferred directions, closed authority, and SHA-256 digest.
Validate the constructed record with the domain runtime-shape function before return.

- [ ] **Step 5: Run decision, context regression, and typecheck**

```bash
npm test -- packages/application/src/candidate/research-allocation.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: decision tests pass and existing context tests remain green before execution behavior changes.

- [ ] **Step 6: Commit deterministic allocation**

```bash
git add packages/application/src/candidate/research-allocation.ts packages/application/src/candidate/research-allocation.test.ts packages/application/src/candidate/arena.ts packages/application/src/index.ts
git commit -m "feat: decide bounded arena allocation"
```

---

### Task 3: Persist Allocation Intent And Bind Completed Ticks

**Files:**
- Create: `packages/local-store/test/candidate-arena-research-allocation.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`

**Interfaces:**
- Produces Store methods `recordCandidateArenaResearchAllocation`, `getCandidateArenaResearchAllocation`, and `listCandidateArenaResearchAllocations`.
- Requires each new `CandidateArenaTickRecord` to carry `research_allocation_ref` and `research_allocation_digest`.
- Preserves exact replay and rejects same-ID mutation.

- [ ] **Step 1: Write failing LocalStore allocation tests**

Create a dedicated temporary-root suite that proves:

```ts
await store.recordCandidateArenaResearchAllocation(allocation);
await expect(store.getCandidateArenaResearchAllocation(
  allocation.candidate_arena_research_allocation_id
)).resolves.toEqual(allocation);
await expect(store.listCandidateArenaResearchAllocations())
  .resolves.toEqual([allocation]);
```

Then prove restart readback, byte-identical replay, digest mismatch rejection, same-ID drift
conflict, malformed mode/policy/authority rejection, and canonical descending allocation order.

- [ ] **Step 2: Write failing tick-binding tests**

Persist a canonical allocation, then require this exact tick binding:

```ts
research_allocation_ref: {
  record_kind: "candidate_arena_research_allocation",
  id: allocation.candidate_arena_research_allocation_id
},
research_allocation_digest: allocation.allocation_digest
```

Reject missing allocation, ref drift, digest drift, tick-ID mismatch, omitted selected direction,
extra direction, and selected-order mismatch. Accept both created and failed direction results when
their ordered direction kinds match the allocation.

- [ ] **Step 3: Run LocalStore tests and observe RED**

```bash
npm test -- packages/local-store/test/candidate-arena-research-allocation.test.ts
```

Expected: FAIL because Store methods and tick binding do not exist.

- [ ] **Step 4: Implement append-only LocalStore persistence**

Add these port methods:

```ts
recordCandidateArenaResearchAllocation(
  allocation: CandidateArenaResearchAllocationRecord
): Promise<CandidateArenaResearchAllocationRecord>;
getCandidateArenaResearchAllocation(
  allocationId: string
): Promise<CandidateArenaResearchAllocationRecord | undefined>;
listCandidateArenaResearchAllocations(): Promise<
  CandidateArenaResearchAllocationRecord[]
>;
```

Use collection `candidate-arena-research-allocations`. Before write, verify runtime shape and
`sha256(candidateArenaResearchAllocationDigestInput(record))`. Return exact replay when stored JSON
is deep-equal; otherwise throw `candidate_arena_research_allocation_conflict`.

Extend `recordCandidateArenaTick` to load and verify the allocation, tick ID, ref, digest, and exact
ordered selected directions before writing the tick. Add stable LocalStore error codes for invalid
input, digest mismatch, conflict, missing reference, and tick graph mismatch.

- [ ] **Step 5: Migrate the one raw CandidateArena tick fixture**

In `seedResearchEfficiencyTick`, persist a matching explicit allocation first and bind its ref and
digest into the seeded tick. Do not add compatibility reads or optional writes for new ticks.

- [ ] **Step 6: Run LocalStore, CandidateArena context, and package checks**

```bash
npm test -- packages/local-store/test/candidate-arena-research-allocation.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts packages/local-store/test/local-store.test.ts
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/application
```

Expected: PASS.

- [ ] **Step 7: Commit persistence evidence**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/candidate-arena-research-allocation.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
git commit -m "feat: persist arena research allocations"
```

---

### Task 4: Execute Allocation Budgets And Bounded Concurrency

**Files:**
- Modify: `packages/application/src/candidate/research-allocation.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`

**Interfaces:**
- Produces `CandidateArenaResearchAllocationService.allocate` with exact replay and request matching.
- Adds `researchAllocationMode?: "adaptive_default" | "static_control"` and `now?: () => string` to `RunCandidateArenaTickInput`.
- Adds compact `research_allocation` to `CandidateArenaTickReadModel`.
- Maps each selected `experiment_budget` to `runTradingResearchLoop.iterations`.

- [ ] **Step 1: Write failing pre-effect and execution-control tests**

Add integration harnesses proving:

1. the allocation can be read from LocalStore inside the first agent call;
2. a default no-signal tick invokes exactly three directions;
3. a barrier agent observes maximum active worker count `2`;
4. two focus lanes receive two `improveArtifact` calls each and the exploration lane receives one;
5. final `direction_results` remain in allocation priority order despite different completion times;
6. ResearchEfficiency sums provider requests, runner commands, scenarios, and elapsed time across
   every notebook entry;
7. a failed selected worker still produces one failed direction result and leaves allocation
   readback intact.

- [ ] **Step 2: Run the integration tests and observe RED**

```bash
npm test -- apps/runtime/test/candidate-arena-paper-context.test.ts -t "research allocation|bounded concurrency|experiment budget"
```

Expected: FAIL because CandidateArena still runs all directions once and persists no pre-effect allocation.

- [ ] **Step 3: Implement allocation service and exact replay**

Add:

```ts
export class CandidateArenaResearchAllocationService {
  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  });

  allocate(input: {
    tickId: string;
    allocationMode: CandidateArenaResearchAllocationMode;
    explicitDirections?: ResearchDirectionKind[];
    findingClusters: CandidateArenaFindingClusterReadModel[];
    latestTicks: CandidateArenaTickReadModel[];
  }): Promise<CandidateArenaResearchAllocationRecord>;
}
```

The service first loads the deterministic allocation ID. Existing evidence must match requested
mode and explicit direction list and is returned byte-identically. New evidence loads prior
allocations and completed ticks, calls the pure decision, persists it, and requires a byte-identical
Store response.

- [ ] **Step 4: Compose allocation before worker effects**

In `runCandidateArenaTick`, resolve tick ID and fixed `startedAt`, build prior research context, and
call the allocation service before `runArenaDirection`. Explicit `directions` imply `explicit` mode;
no directions default to `adaptive_default` unless `researchAllocationMode` is
`static_control`.

Replace unbounded `Promise.allSettled` with ordered batches of at most
`allocation.policy.concurrency_limit`. Pass the complete allocation and selected entry to each
direction run.

- [ ] **Step 5: Apply experiment budgets and best-entry semantics**

Call:

```ts
runTradingResearchLoop({
  iterations: input.allocationSelection.experiment_budget,
  arena_context: await arenaContext(
    input.store,
    input.direction,
    input.allocation,
    input.allocationSelection
  )
});
```

Select the most recent notebook entry whose decision is `keep`; use the final entry only when no
iteration was kept. Aggregate ResearchEfficiency over every entry rather than only the final entry.

- [ ] **Step 6: Bind and project the allocation**

Add allocation ref/digest to the tick builder. Load allocations while building latest tick read
models and expose allocation ID, mode, policy bounds, selections, deferred directions, allocated
time, and closed authority. Add the same compact object plus the current selection to researcher
context.

- [ ] **Step 7: Run focused integration and typechecks**

```bash
npm test -- packages/application/src/candidate/research-allocation.test.ts packages/local-store/test/candidate-arena-research-allocation.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/runtime
```

Expected: PASS.

- [ ] **Step 8: Commit executable allocation**

```bash
git add packages/application/src/candidate/research-allocation.ts packages/application/src/candidate/arena.ts packages/domain/src/index.ts apps/runtime/test/candidate-arena-paper-context.test.ts
git commit -m "feat: execute bounded arena allocations"
```

---

### Task 5: Prove Restart, Exploration, Static Ablation, And Authority Closure

**Files:**
- Modify: `packages/application/src/candidate/research-allocation.test.ts`
- Modify: `packages/local-store/test/candidate-arena-research-allocation.test.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`

**Interfaces:**
- Verifies the complete allocation lifecycle without adding a public command or UI control.

- [ ] **Step 1: Add completed-history exploration coverage test**

Generate consecutive adaptive decisions, mark each prior tick completed, and assert the union of
selected directions contains every default direction by the second no-signal allocation. Repeat
under persistent execution-cost focus and assert at least one non-focus direction remains selected
on every tick.

- [ ] **Step 2: Add restart and frozen replay test**

Persist an adaptive allocation, restart LocalStore, add a new released finding that would change a
fresh decision, then allocate the same tick ID. Assert strict equality with the original record,
one allocation file, and unchanged compact readback. Re-entering the same tick with static mode or
different explicit directions must fail closed.

- [ ] **Step 3: Add equal-bound static ablation**

Under one public-execution failure cluster, run pure decisions for adaptive and static-control
modes. Assert both use three workers, concurrency two, and total budget five. Assert adaptive
includes `execution_cost_robustness` while static remains exactly `trend_following`,
`mean_reversion`, and `volatility_regime`.

- [ ] **Step 4: Update old reorder-only expectations**

Change existing default-direction tests from five reordered results to the three directions
actually selected by the allocation. Change context slices and counts from five to the exact summed
experiment budgets. Keep explicit-direction tests unchanged except for the new allocation
projection.

- [ ] **Step 5: Add authority and side-effect scan**

Use a Store proxy or spies to prove allocation decision/persistence calls none of:

```text
materializeCandidate
recordPaperTradingEvaluation
recordPaperTradingObservation
recordTradingPromotion
recordLedger
startComparisonSide
submitOrder
readPrivateAccount
```

Assert every allocation and projection carries research-only scheduling authority and explicit
false promotion, order, and live authority.

- [ ] **Step 6: Run the full focused allocation regression**

```bash
npm test -- packages/domain/src/candidate-arena-research-allocation.test.ts packages/application/src/candidate/research-allocation.test.ts packages/local-store/test/candidate-arena-research-allocation.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit lifecycle evidence**

```bash
git add packages/application/src/candidate/research-allocation.test.ts packages/local-store/test/candidate-arena-research-allocation.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
git commit -m "test: prove adaptive arena allocation"
```

---

### Task 6: Update Durable Truth And Verify The Frontier

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/product-quality-design.md`
- Modify: `docs/superpowers/specs/2026-07-12-candidate-arena-research-allocation-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-candidate-arena-research-allocation.md`

- [ ] **Step 1: Update canonical truth**

Record that every new tick persists a pre-effect allocation; default adaptive mode selects three
lanes with at most two focus and at least one exploration; concurrency is two; actual experiment
budgets are two/one within five; completed allocations drive coverage; and static control provides
equal-bound ablation. Remove claims that current behavior only reorders directions or lacks actual
allocation.

Keep long-lived worker workspace recovery, provider-dollar cost, learned/bandit allocation,
production comparison scheduling, automatic promotion, runner handoff, private/live authority, P0
completion, and Goal completion explicitly open.

- [ ] **Step 2: Mark design and plan implemented**

Set design status to:

```text
Implemented and verified as persisted bounded adaptive ResearchWorker allocation
```

Set this plan Status to Complete and check each completed step.

- [ ] **Step 3: Run focused regression**

```bash
npm test -- packages/domain/src/candidate-arena-research-allocation.test.ts packages/application/src/candidate/research-allocation.test.ts packages/local-store/test/candidate-arena-research-allocation.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run workspace and repository validation**

```bash
npm run typecheck
npm run check:repo-guards
npm test
```

Expected: all workspace typechecks, docs, architecture, naming, environment, secret, diff, and all
tests pass. Run the full test suite outside the filesystem/network sandbox because existing tests
open local HTTP listeners.

- [ ] **Step 5: Commit durable truth**

```bash
git add AGENTS.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/autonomy-model.md docs/naming-taxonomy.md docs/product-quality-design.md docs/superpowers/specs/2026-07-12-candidate-arena-research-allocation-design.md docs/superpowers/plans/2026-07-12-candidate-arena-research-allocation.md
git commit -m "docs: record adaptive arena allocation"
```

## Completion Evidence

Keep this frontier only when current evidence proves:

1. pre-effect canonical allocation shape, policy, digest, and authority;
2. deterministic adaptive, static-control, and explicit decisions;
3. actual three-of-five default selection, bounded concurrency two, and experiment budgets within five;
4. at most two focus lanes and at least one exploration lane;
5. completed-history direction coverage and orphan-intent exclusion;
6. exact LocalStore replay, restart, conflict rejection, and tick binding;
7. aggregate multi-iteration ResearchEfficiency and externally selected kept entry;
8. equal-bound adaptive versus static ablation;
9. no paper, Trading review, promotion, Gateway, Ledger, order, private, or live side effect;
10. focused tests, workspace typechecks, repository guards, and full suite pass;
11. durable docs leave long-lived worker recovery and Goal/P0 completion open.

After completion, route back to auto-project and select the remaining core-loop blocker from current
evidence rather than assuming the entire CandidateArena Goal is complete.
