# ResearchPreflight Evaluation Isolation Design

**Status:** Approved for implementation

## Goal

Preserve useful adaptive ResearchWorker feedback while preventing the same queried replay score
from also deciding CandidateArena admission. One final artifact must be selected using development
evidence only, frozen, and submitted exactly once to a precommitted rotating sealed admission set
before `PaperTradingHandoffConformance`, admission, and materialization.

## Why This Frontier Is Next

The current evaluator removes `expected_direction`, target risk, outcome, private, credential,
direct-order, and live fields from candidate-facing provider payloads. The paper handoff frontier
also proves exact target-protocol compatibility before a new runnable handoff.

The remaining P0 leak is adaptive evaluator reuse. Every ResearchWorker iteration currently runs
the same two replay scenarios, receives exact aggregate score, net revenue, metric names,
keep/discard state, and previous-best score, and then lets the same score select the artifact that
reaches admission. Hiding per-scenario labels does not prevent differential score probing, seed or
parameter cherry-picking, or eventual overfitting to the fixed replay set. The current replay set is
therefore functioning simultaneously as development feedback, model selection, and admission
evidence.

This frontier separates those roles without prescribing the ResearchWorker's internal scientific
workflow. It does not claim that synthetic replay proves economic quality. Prospective comparable
`PaperTradingEvaluation` remains the product authority.

## Source Interpretation

Anthropic's Automated Weak-to-Strong Researcher demonstrates the value of independent long-running
researchers, broad directions, external evaluation, rich process evidence, shared findings, and
code lineage. It also demonstrates the failure mode directly relevant here: repeated access to a
remote held-out score turned the test set into a validation set, enabled iterative seed
cherry-picking and label exfiltration, and was not fixed by practical submission caps. The authors
recommend evaluation on entirely held-out datasets.

Ouroboros should preserve the useful half of that model rather than copying the failure:

- development replay may remain adaptive and informative because it has no authority;
- a submission cap is a resource bound, not an anti-hacking proof;
- admission evidence must not be queried while the worker can still modify or select the artifact;
- the sealed admission set must rotate across ticks instead of becoming a permanent target;
- prospective paper comparison, not replay, remains the economic generalization test.

## Considered Approaches

### 1. Keep exact feedback and add only a submission cap

Rejected as the main defense. It bounds cost but does not prevent careful differential probing, and
the AAR evidence shows that practical caps mostly make researchers budget attacks more carefully.

### 2. Return only coarse pass/fail feedback from every replay

Rejected. A binary oracle can still be probed, and deleting useful process feedback weakens the
ResearchWorker without creating a genuinely independent evaluation boundary.

### 3. Hide scenario fields but reuse the same replay set

Rejected. This is the current shape. Aggregate scores and repeated candidate submissions still
leak information about the hidden set.

### 4. Separate adaptive development replay from one-shot sealed admission

Selected. Workers may hill-climb on development evidence within a bounded budget. Ouroboros then
freezes one artifact selected without sealed results and evaluates it once against a precommitted,
rotating set that has not been queried during that research run.

## Canonical Vocabulary

Add one canonical noun: `ResearchPreflightCommitment`.

It is an append-only pre-effect research record that freezes development and sealed-admission
evaluation policy, query budgets, source identity, rotation identity, feedback release, and closed
authority for one CandidateArena direction. It is not a candidate, score, verdict, qualification,
promotion, or trading authorization.

Keep `TradingEvaluationResult` as the terminal external ResearchPreflight result. A sealed result
must bind its exact commitment and submitted SystemCode rather than introducing a second terminal
evaluation noun.

## Evidence Model

### Adaptive development replay

- Runs only within the commitment's bounded development-submission budget.
- May return aggregate score, net revenue, protocol/risk diagnostics, and process evidence to the
  ResearchWorker.
- May select which development artifact to freeze.
- Carries `not_counted` and no admission, paper, qualification, promotion, order, private, or live
  authority.
- Never runs `PaperTradingHandoffConformance`; target-protocol probing is reserved for the final
  frozen submission.

### Sealed admission replay

- Runs exactly once for one frozen submitted artifact after development selection closes.
- Uses a scenario set precommitted before worker effects and never used for development feedback.
- Uses a deterministic versioned generator plus evaluator-held random tick/direction seed; only
  its commitment and the resulting suite digest are persisted before worker effects.
- Keeps scenario IDs, seed, hidden direction, target risk, outcomes, per-scenario scores, raw events,
  and evaluator internals outside the ResearchWorker workspace and notebook.
- Releases only a bounded terminal summary after the worker can no longer change or resubmit the
  artifact under that commitment.
- If externally accepted, runs `PaperTradingHandoffConformance` over the same sealed bytes.
- If rejected, creates no candidate and preserves one causal Finding. There is no retry under the
  same commitment.

## Persisted Commitment

Add version-1 `ResearchPreflightCommitmentRecord`:

```ts
export interface ResearchPreflightCommitmentRecord extends BaseRecord {
  record_kind: "research_preflight_commitment";
  research_preflight_commitment_id: string;
  candidate_arena_tick_id: string;
  research_direction_ref: Ref;
  research_worker_ref: Ref;
  research_allocation_ref: Ref;
  research_allocation_digest: string;
  source_system_code_ref: Ref;
  source_artifact_digest: string;
  development_policy: {
    suite_version: "research_development_replay_v1";
    suite_digest: string;
    submission_limit: number;
    feedback_release: "aggregate_after_each_submission";
  };
  sealed_admission_policy: {
    suite_version: "research_sealed_admission_v1";
    generator_version: "research_scenario_generator_v1";
    rotation_commitment_digest: string;
    suite_digest: string;
    submission_limit: 1;
    feedback_release: "terminal_after_freeze";
  };
  committed_at: string;
  research_preflight_authority: true;
  admission_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
  commitment_digest: string;
}
```

The record is persisted before `ResearchWorker` effects. LocalStore validates canonical digest,
source SystemCode, exact allocation selection and budget, bounded counts, distinct rotation
commitments, append-only replay, and closed authority.

The 256-bit rotation seed and raw sealed suite are not persisted in worker-readable repo or
LocalStore state before evaluation. They remain inside an evaluator-owned in-memory plan handle or
an external evaluator adapter that the ResearchWorker cannot read. The commitment stores only the
seed commitment and suite digest. Current-process exact generation is deterministic from the held
seed; process loss fails the direction closed rather than reconstructing or silently resampling the
suite. Durable evaluator-owned recovery is a later frontier.

The terminal `TradingEvaluationResultRecord` adds exact commitment ref/digest, submitted
SystemCode ref/digest, `sealed_admission_suite_digest`, `evaluation_phase: "sealed_admission"`, and
`submission_sequence: 1`. New admitted decisions require that complete chain. Historical records
remain readable but cannot satisfy the new sealed-admission graph.

## Scenario Isolation

The development suite remains a stable inspectable research distribution. Its exact aggregate
feedback is explicitly adaptive and cannot be promoted to admission evidence.

The sealed suite is generated from a versioned evaluator-owned generator and a cryptographically
random 256-bit seed scoped to tick and direction. Only the seed commitment and suite digest are
persisted before worker effects. Neither the seed, plan handle, nor raw scenarios enter the artifact
workspace, worker-readable filesystem state, ResearchWorker notebook, prompt, Arena context, or
compact read model.

The generated set must cover at least long, short, flat, volatility, and execution-cost stress.
The generator must balance directions and avoid encoding expected labels in IDs, ordering,
timestamps, price magnitude, difficulty, or response shape. Candidate-facing provider payloads
continue to expose only legitimate contemporaneous market and account inputs.

Rotation is not economic generalization proof. It reduces repeated synthetic-set targeting while
prospective paper comparison remains the authority for future market performance.

## Loop Semantics

For each CandidateArena direction:

1. persist ResearchWorker identity, source SystemCode, and `ResearchPreflightCommitment` before
   agent effects;
2. run zero to the committed number of adaptive development iterations;
3. select one development artifact using only development evidence and freeze its canonical
   manifest-plus-entrypoint closure;
4. close development selection permanently for that commitment;
5. run one sealed admission replay over the frozen artifact;
6. if accepted, run one bounded paper handoff probe over the same bytes;
7. persist SystemCode, ExperimentRun, terminal TradingEvaluationResult, conformance, Finding,
   Lineage, and CandidateAdmissionDecision with exact refs and digests;
8. materialize only a fully valid admitted graph.

An infrastructure failure before attributable sealed evidence fails the direction and does not
consume strategy evidence. A candidate-attributable sealed rejection closes the commitment,
creates a Finding, and cannot be retried by changing the artifact.

## Feedback Boundary

The worker may receive development summaries such as aggregate score, aggregate net revenue,
provider/risk diagnostics, logs from its own experiments, and whether a development artifact was
kept. This is the hill-climbing surface.

The worker must not receive the sealed suite seed, digest, scenarios, IDs, per-scenario results,
score deltas, raw outputs, exact hidden failure location, or terminal result while it can still
modify or select the committed submission. The terminal generic finding may enter later
CandidateArena context only after the commitment is closed.

`previous_best_score` must mean development score only. No sealed-admission score may become a next
iteration prompt field under the same commitment.

## Failure And Recovery

- Crash before commitment persistence: no worker effect is allowed.
- Crash during development: retain external run evidence; a later process may fail the direction
  closed, but cannot synthesize a final submission.
- Crash after commitment or candidate freeze but before terminal sealed evidence: discard the
  evaluator-held seed and fail closed. This frontier performs no reconstruction, resampling, or
  implicit retry.
- Crash after terminal result persistence: LocalStore exact replay reconstructs the same graph and
  never reruns the evaluator.
- Extra sealed submission, suite drift, seed drift, candidate mutation, or feedback-before-close is
  an integrity failure and creates no runnable handoff.

This frontier does not implement durable process adoption or long-lived worker resume.

## Read Model

CandidateArena direction results may expose only compact commitment ID, development-submission
count, sealed submission status, and generic terminal reason after close. They must not expose the
rotation seed, suite digest, scenario count by regime, per-scenario score, or raw evaluator output.

ResearchEfficiency separates development runs from the one sealed submission so a rejected
candidate cannot appear efficient merely because integrity stopped evaluation early. Neither count
participates in rank or promotion.

## Test Strategy

### Domain and store

- canonical commitment validates and hashes deterministically without containing a raw seed;
- policy, source, allocation, seed commitment, suite digest, budget, time, or authority mutation
  changes digest;
- malformed refs, bounds, timestamps, suite commitments, or authority fail;
- injected evaluator seeds reproduce one in-process suite for tests, while adjacent tick/direction
  plans use distinct random commitments;
- terminal result must bind sequence 1, exact commitment, exact submitted bytes, and exact suite;
- no second sealed result can be recorded for one commitment.

### Information barrier

- development prompt/notebook contains adaptive development feedback only;
- sealed seed, digest, scenario IDs, outcomes, per-scenario metrics, and raw events never enter the
  worker surface;
- a worker that changes one prediction repeatedly cannot observe sealed score deltas;
- terminal feedback appears only after candidate freeze and no further adapter call occurs;
- candidate provider requests cannot reach evaluator, plan, seed, or score endpoints.

### Selection and admission

- development score selects one artifact before sealed evaluation;
- sealed evaluation cannot influence artifact selection or trigger a retry;
- a development winner that fails sealed admission creates no candidate and one causal Finding;
- a lower development score cannot replace the frozen artifact after sealed outcomes exist;
- only sealed pass plus exact paper handoff pass can produce admitted materialization;
- infrastructure failure remains direction failure rather than strategy evidence.

### Controls

- compare static reused evaluation against rotating sealed admission using an adversarial probing
  fixture; the probe may improve development score but cannot extract or adapt to sealed results;
- prove development budget one and two preserve current allocation bounds;
- prove fixture, host, and `sbx` paths use the same phase and evidence contract;
- prove no change to PaperTradingEvaluation rank, qualification, comparison, promotion, order,
  private, or live authority.

## Acceptance Criteria

This frontier is complete only when current code and tests prove:

1. one pre-effect commitment freezes both development and sealed-admission policy;
2. adaptive development feedback remains useful but has no admission authority;
3. one artifact is frozen before any sealed result exists;
4. the sealed set is evaluator-owned, direction-balanced, committed before effects, and rotated
   across tick/direction commitments without persisting its raw seed to worker-readable state;
5. exactly one sealed submission is possible and no same-commitment retry exists;
6. worker-visible surfaces contain no sealed scenario or score information;
7. terminal evaluation, conformance, admission, and materialization bind the same exact bytes;
8. rejection creates no candidate and remains causal memory only after close;
9. infrastructure and candidate attribution remain distinct;
10. focused adversarial tests, workspace typechecks, repository guards, and the full suite pass.

## Non-Goals

- no claim that a query cap alone prevents reward hacking;
- no removal of useful development process feedback;
- no strategy, model, tool, indicator, research order, or internal workflow prescription;
- no paper qualification, comparison verdict, promotion, champion replacement, private, or live
  authority;
- no durable ResearchWorker process recovery or production scheduler;
- no behavior-level duplicate detector;
- no full adversarial-matrix, P0, or CandidateArena Goal completion claim.

## Next Frontier

After evaluation isolation is verified, reassess behavior-level duplicate detection versus durable
ResearchWorker workspace/recovery ownership. Choose from current evidence rather than assuming
synthetic holdout isolation proves economic generalization.
