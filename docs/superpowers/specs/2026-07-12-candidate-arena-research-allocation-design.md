# CandidateArena Research Allocation Design

**Status:** Implemented and verified as persisted bounded adaptive ResearchWorker allocation

## Goal

Make CandidateArena change actual ResearchWorker selection, concurrency, and experiment budget from
causal research evidence while persisting the complete decision before any worker effect. Preserve
an exploration floor, provide an equal-bound static control, survive restart without recomputing a
tick's allocation, and keep every signal under research-only authority.

## Why This Frontier Was Selected

Before this frontier, CandidateArena derived `adaptive_direction_focus` from paper-backed
FindingClusters, released comparison findings, and ResearchEfficiency. When a caller omitted
`directions`, it used those signals only to reorder all five default ResearchDirections, started all
five workers concurrently, and gave each one research-loop iteration.

That baseline provided adaptive context and ordering, but not adaptive allocation. Findings,
failures, regime evidence, novelty, and cost did not change which workers ran, how many ran
together, or how many experiments a worker received. The decision was also absent from durable
evidence before provider effects, so restart could not explain why a lane was selected or deferred.

The implemented frontier closes that specific gap. It does not claim the broader CandidateArena
Goal, P0, or long-lived ResearchWorker lifecycle complete.

## Source Interpretation

Anthropic's Automated Weak-to-Strong Researcher supports independent sandboxes, broad directed
lanes, autonomous experiment sequences, external evaluation, and shared findings/code. Its results
also warn against over-prescribing researcher behavior and against repeatedly optimizing on a
leaky evaluator.

Ouroboros should therefore allocate external resources without scripting the worker's internal
research method. The allocator may choose a lane, a bounded number of experiment opportunities,
and a concurrency limit. It must not choose candidate code, expose sealed qualification evidence,
or convert a scheduling heuristic into economic or promotion authority.

The current evidence is too heterogeneous and sparse to justify a calibrated stochastic bandit.
Finding pressure and ResearchEfficiency are scheduling signals, not reward samples. This design
uses a deterministic bounded policy and a static control until qualified discovery-yield evidence
supports a more statistical allocator.

## Considered Approaches

### 1. Keep reordering all five directions

Rejected. This preserves context quality but changes no resource allocation and provides no
pre-effect decision record.

### 2. Run only the highest-scoring directions

Rejected. Pure exploitation can repeatedly select a narrow family, amplify one noisy failure or
cheap provider path, and collapse population entropy. It also cannot distinguish useful adaptation
from a static top-k shortcut.

### 3. Persist bounded focus plus exploration allocation

Selected. Each default tick gets at most two evidence-focused lanes plus at least one exploration
lane, three selected lanes total, two concurrent workers, and at most five research experiments.
The allocation is append-only and precedes worker effects. A static control uses the same slots,
concurrency, and total experiment bound while ignoring evidence.

### 4. Implement UCB, Thompson sampling, or learned allocation

Deferred. Those approaches require a stable reward definition, comparable exposure, uncertainty
tracking, and enough observations per lane. Current preflight score, paper findings, failure
pressure, and cost proxies are not interchangeable reward samples. Using bandit terminology now
would add false precision.

## Canonical Vocabulary

The new canonical noun is `CandidateArenaResearchAllocation`.

It is one append-only, pre-effect scheduling decision for one CandidateArena tick. It owns selected
ResearchDirections, deferred default directions, bounded experiment budgets, concurrency, the
signal snapshot used for the decision, and authority fields.

The embedded terms are:

- `focus`: selected because current released evidence produced positive scheduling pressure;
- `exploration`: selected to preserve direction coverage independently of focus score;
- `static_control`: selected by the equal-bound no-evidence control;
- `explicit`: selected because the caller supplied an exact direction list;
- `experiment_budget`: the maximum research-loop iterations for that selected worker;
- `signal_snapshot`: frozen scheduling input, never an economic score or promotion gate.

Avoid `winner`, `fitness`, `reward`, `bandit`, `optimal`, or `promotion` in allocation names. No
compatibility alias is added because no persisted allocation schema exists today.

## Domain Contract

Add a required version-1 allocation record:

```ts
export type CandidateArenaResearchAllocationMode =
  | "adaptive_default"
  | "static_control"
  | "explicit";

export type CandidateArenaResearchSelectionKind =
  | "focus"
  | "exploration"
  | "static_control"
  | "explicit";

export interface CandidateArenaResearchAllocationPolicy {
  policy_kind: "bounded_adaptive_v1";
  default_direction_slot_count: 3;
  maximum_focus_direction_count: 2;
  minimum_exploration_direction_count: 1;
  concurrency_limit: 2;
  focus_experiment_budget: 2;
  exploration_experiment_budget: 1;
  explicit_experiment_budget: 1;
  maximum_total_experiment_budget: 5;
}

export interface CandidateArenaResearchAllocationSignal {
  direction_kind: ResearchDirectionKind;
  finding_pressure_score: number;
  research_efficiency_score: number;
  recent_outcome_score: number;
  focus_score: number;
  completed_selection_count: number;
  last_completed_allocation_ref?: Ref;
  source_candidate_ids: string[];
  source_tick_ids: string[];
  reasons: string[];
}

export interface CandidateArenaResearchAllocationSelection {
  direction_kind: ResearchDirectionKind;
  selection_kind: CandidateArenaResearchSelectionKind;
  priority: number;
  experiment_budget: number;
  signal_score: number;
  reasons: string[];
}

export interface CandidateArenaResearchAllocationRecord extends BaseRecord {
  record_kind: "candidate_arena_research_allocation";
  candidate_arena_research_allocation_id: string;
  tick_id: string;
  allocation_mode: CandidateArenaResearchAllocationMode;
  policy: CandidateArenaResearchAllocationPolicy;
  source_tick_refs: Ref[];
  signal_snapshot: CandidateArenaResearchAllocationSignal[];
  selected_directions: CandidateArenaResearchAllocationSelection[];
  deferred_directions: ResearchDirectionKind[];
  allocated_at: string;
  allocation_digest: string;
  research_scheduling_authority: true;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}
```

`candidateArenaResearchAllocationDigestInput` excludes only record kind, version, ID, and digest.
The digest therefore freezes tick, mode, policy, signal snapshot, selections, budgets, provenance,
time, and authority.

`CandidateArenaTickRecord` binds the allocation ref and digest. Its read model exposes a compact
`research_allocation` projection so CLI, TUI, Web, and researcher context can explain the decision
without reading LocalStore directly. Historical read models may omit the projection, but every new
persisted tick must bind one allocation.

## Allocation Policy

### Allowed evidence

Adaptive allocation may consume only:

- CandidateArena FindingClusters derived from released research-feedback paper evidence;
- accepted `PaperTradingComparisonResearchRelease` findings already present in those clusters;
- completed prior CandidateArena direction outcomes;
- prior ResearchEfficiency provider-request, runner-command, scenario-count, and elapsed-time
  proxies;
- completed prior allocations for exploration coverage.

It may not consume raw confirmation outcomes, unreleased qualification evidence, candidate
self-report, TradingPromotion, private exchange state, credentials, or live results.

### Signal calculation

Reuse the existing FindingCluster and ResearchEfficiency focus calculations. Merge their pressure
per default direction, then apply only these recent outcome adjustments:

- `created`: `0`;
- `duplicate`: `-15`, because repeated bytes are negative novelty evidence;
- `quarantined`: `-30`, because invalid output must not earn more focus budget;
- `failed`: `-10`, because immediate infrastructure retries should cool down but remain reachable
  through exploration.

`focus_score` is finding pressure plus positive ResearchEfficiency focus plus the recent outcome
adjustment. It is a deterministic scheduling score only. Profit, paper rank, qualification, and
promotion do not read it.

### Adaptive default mode

1. Build one signal for each of the five default ResearchDirections.
2. Select at most two directions with `focus_score > 0`, ordered by score descending and canonical
   default order for ties.
3. Fill the remaining slots to exactly three with exploration directions not already selected.
4. Order exploration by completed selection count ascending, never-selected or oldest last
   selection first, then canonical default order.
5. Give each focus worker two experiment iterations and each exploration worker one.
6. Run at most two workers concurrently.

This yields one to two exploration slots when fewer than two focus signals exist and guarantees at
least one exploration slot even when every direction has positive pressure. Expensive, failed, or
duplicate lanes remain reachable through exploration.

Only allocations linked from completed CandidateArena ticks count toward exploration history. An
orphan pre-effect allocation from a crashed tick can be replayed for that same tick, but it cannot
consume another tick's exploration floor.

### Static control mode

Select the first three canonical default directions, ignore evidence, assign experiment budgets
`2`, `2`, and `1`, and use concurrency `2`. This matches the adaptive maximum of three workers and
five experiments, allowing a controlled evidence-adaptive versus static comparison.

### Explicit mode

Preserve one to five unique caller-supplied directions in order, assign one experiment to each, and
use concurrency `2`. Explicit input bypasses adaptive selection but still receives a persisted
allocation, bounded execution, exact replay, and authority fields. Empty, duplicate, or more than
five explicit directions fail before worker effects.

## Application Flow

`runCandidateArenaTick` performs this order:

1. normalize tick ID, source candidate, clock, and optional allocation mode;
2. load an existing allocation for the same tick and verify requested mode/directions, or compute
   and persist a new allocation;
3. start no more than `concurrency_limit` selected workers at once while preserving allocation
   priority in the final result;
4. pass the selected entry and full compact allocation into researcher context;
5. map `experiment_budget` to `runTradingResearchLoop.iterations`;
6. choose the latest externally accepted `keep` notebook entry for candidate evidence, falling back
   to the final entry only when no iteration was kept;
7. aggregate ResearchEfficiency across every budgeted iteration;
8. persist the CandidateArena tick with exact allocation ref/digest and direction results matching
   selected direction order.

The allocation is intent, not success evidence. A worker crash produces the existing failed
direction result and leaves the pre-effect decision intact.

## Persistence And Replay

LocalStore adds record/get/list operations for allocations.

- runtime shape and canonical digest must match before write;
- IDs are deterministic from tick ID;
- same-ID byte-identical writes are exact replay;
- same-ID drift is a conflict;
- allocation records are append-only;
- new tick writes require an existing exact allocation ref/digest;
- tick direction results must equal the allocation's selected directions in order;
- restart returns the same allocation and compact read model;
- re-entering the same tick reuses its frozen allocation even if newer findings now exist;
- re-entering with a different mode or explicit direction list fails closed.

No allocation write may create a candidate, start a provider, mutate paper evidence, select a
Trading review target, or touch Gateway, Ledger, order, credential, private, or live state.

## Error Semantics

- malformed policy, signal, selection, digest, time, authority, or explicit input fails before
  worker effects;
- missing or drifted allocation evidence prevents final tick persistence;
- selected count, exploration floor, concurrency, or total experiment budget outside policy fails;
- selected and deferred default directions may not overlap;
- an adaptive allocation must contain every default direction exactly once across selected and
  deferred sets;
- worker failure remains a direction result, not allocation corruption;
- an orphan allocation is recoverable intent and is excluded from completed exploration history;
- store response must be byte-identical to the requested allocation.

## Read Model And Context

Each new latest-tick projection exposes:

- allocation ID and mode;
- selected direction, selection kind, priority, experiment budget, signal score, and reasons;
- deferred default directions;
- concurrency and total experiment bounds;
- allocated time;
- `research_only` authority plus explicit no-promotion, no-order, and no-live fields.

Researcher context includes only the current worker's selection entry plus the compact allocation.
It must not expose sealed raw qualification or comparison records. UI rendering is not required in
this frontier; the shared read-model contract is the authoritative surface.

## Test Strategy

### Domain

- accept canonical adaptive, static-control, and explicit records;
- reject malformed modes, policy constants, signals, priorities, budgets, overlaps, times, digest
  shape, and authority;
- prove any scheduling or authority mutation changes digest input.

### Allocation decision

- no evidence fills all three slots through exploration;
- repeated completed allocations cover every default direction;
- finding/failure pressure selects the mapped remediation direction for focus;
- low-cost/low-latency ResearchEfficiency can focus a lane while an expensive lane remains
  exploration-eligible;
- duplicate, quarantined, and failed outcomes reduce focus pressure without removing exploration;
- at most two focus lanes and at least one exploration lane are selected;
- total experiment budget never exceeds five and concurrency remains two;
- static control ignores the same evidence under equal bounds;
- explicit mode preserves valid input and rejects empty, duplicate, or oversized lists;
- input objects are not mutated.

### LocalStore

- persist, get, list, restart, and exact replay one allocation;
- reject digest drift, malformed policy, same-ID mutation, invalid authority, and missing refs;
- reject a tick whose allocation ref, digest, selected directions, or order disagrees;
- accept a failed worker result when its direction still matches the allocation.

### CandidateArena integration

- prove the allocation exists before the first agent call;
- prove no more than two workers are active concurrently;
- prove focus workers receive two iterations and exploration workers one;
- aggregate ResearchEfficiency across all iterations;
- preserve explicit-direction behavior through a persisted explicit allocation;
- expose allocation readback and current-worker context without promotion authority;
- replay the same tick allocation after restart and after new evidence appears;
- compare adaptive and static-control selection under the same pressure and equal resource bounds;
- prove no CandidateArena selection, paper, Trading review, Gateway, Ledger, order, private, or live
  side effect comes from allocation alone.

## Acceptance Criteria

This frontier is complete only when current code and tests prove:

1. every new CandidateArena tick has a pre-effect append-only allocation;
2. default adaptive ticks run exactly three of five directions, at most two concurrently;
3. no more than two focus lanes are selected and at least one exploration lane always runs;
4. focus and exploration budgets change actual research-loop iterations within a total bound of
   five;
5. causal findings, regime/failure pressure, novelty, and ResearchEfficiency can change actual
   worker selection;
6. all default directions remain reachable through completed-history exploration;
7. static control ignores evidence under equal worker, experiment, and concurrency bounds;
8. restart and exact replay preserve the same allocation and readback;
9. explicit caller input remains ordered, bounded, and non-adaptive;
10. allocation signals cannot affect paper rank, qualification, Trading review, promotion, orders,
    private access, or live authority;
11. focused tests, workspace typechecks, repository guards, and the full suite pass.

## Non-Goals

- no calibrated bandit, learned allocator, random sampling, or economic reward model;
- no provider-dollar estimate until adapters expose reliable usage;
- no long-lived ResearchWorker workspace recovery or process adoption;
- no more than one materialized candidate per selected direction per tick;
- no public allocation command or operator editing control;
- no automatic comparison, promotion, champion runner handoff, private access, or live trading;
- no P0 or CandidateArena Goal completion claim.

## Next Frontier

After this allocation frontier is verified, reassess the remaining Goal axes from current code.
Likely next work is durable ResearchWorker lifecycle and bounded restart ownership or the remaining
evaluator-side-channel and adversarial matrix, selected by whichever gap blocks the core loop most
directly after allocation evidence exists.
