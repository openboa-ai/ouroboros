# ResearchMemoryControlStudy Design

**Date:** 2026-07-13

## Goal

Make Ouroboros able to test whether released cross-generation research memory causes a
`ResearchWorker` to repeat fewer exact prior failures than an otherwise identical no-memory worker.
The experiment must bind the information difference before worker effects, preserve every planned
pair, and permit no evaluation, allocation-policy, promotion, order, private, or live authority.

This frontier addresses the causal-research-memory completion axis. It does not claim that memory
improves qualified paper discovery, future paper revenue, or the economic frontier.

## Source Model

Anthropic's Automated Alignment Researcher uses independent long-running workers, broad research
directions, an evaluator outside each sandbox, and a shared findings forum. That architecture makes
shared memory plausible, but it does not by itself prove that shared memory improves research. The
Ouroboros adaptation therefore keeps the shared-findings mechanism and adds a precommitted
memory/no-memory control whose outcome is derived from external CandidateArena evidence.

The relevant repository contract is stricter than the reference implementation:

- a worker may consume released aggregate findings, lineage summaries, population diagnostics,
  and its sanitized prior checkpoint;
- a worker must not consume raw sealed admission, paper qualification, private, or live evidence;
- a worker does not grade whether its own output is new or valid;
- only persisted external admission and behavior-fingerprint evidence can classify an exact repeat;
- a control result changes no production allocation, rank, qualification, or promotion policy.

## Alternatives

### Reuse `ResearchControlCampaign` arms

Rejected. That campaign intentionally compares `adaptive_default` with `static_control`. Giving its
adaptive arm memory and its static arm no memory would confound two interventions. Giving both arms
the same allocation mode would contradict the campaign's persisted hypothesis, arm names, report,
paper schedule, and outcome semantics.

### Generalize all controls into one factorial experiment engine

Deferred. A generic treatment/control schema could eventually cover directed/undirected,
memory/no-memory, allocation, and agent/baseline studies. Migrating the mature allocation campaign,
paper scheduler, outcomes, studies, generalization protocol, fixtures, and read models in this
frontier would create a large compatibility and review surface before one memory hypothesis is
tested.

### Add a dedicated paired memory study

Selected. `ResearchMemoryControlStudy` owns one narrow intervention, uses existing CandidateArena
ticks and admission evidence, and does not duplicate the prospective paper campaign. The study can
later be retained as a concrete implementation behind a generic control protocol if multiple
factorial studies justify that abstraction.

## Vocabulary

### `ResearchWorkerMemoryPolicy`

An embedded pre-effect policy on every new CandidateArena `ResearchPreflightCommitment`. It records
which cross-generation memory projection the worker receives.

Modes:

- `released_memory`: expose the existing sanitized CandidateArena memory and sanitized prior
  checkpoint.
- `memory_masked`: expose only the current task, assigned direction, and current bounded selection;
  do not expose prior Arena observations or prior checkpoint content.

The policy is not an agent preference and grants no authority.

### `ResearchMemoryControlStudy`

The append-only pre-effect commitment for 6 to 30 independent same-baseline pairs. It freezes the
source, managed-agent identity, direction schedule, exact tick identities, bounded budget, context
policies, baseline snapshot, and analysis policy before any planned worker effect.

### `ResearchMemoryControlPairOutcome`

The append-only terminal external observation for one planned pair. It binds both exact arm tick
results, preflight memory policies, admission evidence, resource summaries, and a paired exact-repeat
difference. Interrupted, malformed, unavailable, or unpaired evidence remains terminal but
ineligible for the primary estimand.

### `ResearchMemoryControlStudyOutcome`

The append-only inference over every planned pair outcome. It may report supported, not supported,
or insufficient evidence. It never changes worker context policy automatically.

## Information Boundary

CandidateArena builds one full safe memory source before each worker effect. It contains only the
already allowed aggregate fields:

- leaderboard and latest Finding summaries;
- negative findings and released campaign findings;
- FindingClusters and adaptive focus summaries;
- population-diversity and research-efficiency summaries;
- latest duplicate or quarantine admission summaries;
- the sanitized prior `ResearchWorkerCheckpoint`, when one exists.

It contains no raw evaluator scenario, sealed score, paper qualification, market snapshot, account,
fill, command, provider request, stdout/stderr, filesystem path, credential, private, or live field.

The full safe memory source is canonicalized before projection. Both modes bind:

- `memory_source_digest`;
- `available_memory_item_count`;
- `arena_context_digest` for the exact projected JSON;
- the prior checkpoint reference and digest when one was available;
- whether that checkpoint was `included`, `masked`, or `none_available`.

For `released_memory`, the provider receives the full safe Arena memory and the sanitized prior
checkpoint. For `memory_masked`, the provider receives neither. Both modes still receive the same
research program, source artifact, current direction, current selection, submission limit, local
workspace tools, and aggregate feedback for submissions made inside the current session. The
intervention is cross-generation memory, not within-session learning.

The adapter's existing context sanitizer remains defense in depth. Tests must prove that the
sanitized provider payload hashes to the preflight policy's `arena_context_digest` and that a masked
payload contains no memory-bearing key or prior checkpoint.

Existing persisted version-1 commitments without `ResearchWorkerMemoryPolicy` remain readable.
Every newly created CandidateArena commitment must include it; a memory control pair is ineligible
unless both new commitments contain exact policies.

## Study Commitment

The study freezes:

- one bounded LocalStore regular-file baseline snapshot;
- one exact source candidate version, SystemCode record, and artifact closure;
- one managed provider, model, profile, and permission-policy identity;
- 6 to 30 pair plans in canonical sequence;
- one explicit `ResearchDirection` per pair;
- one development submission per worker and one sealed submission maximum;
- exact treatment and control tick IDs;
- `released_memory` for treatment and `memory_masked` for control;
- concurrent initial execution within each pair;
- sequential execution across pairs;
- a two-sided paired exact sign-test policy;
- research-only authority flags.

Each pair starts from two fresh copies of the same frozen baseline. Pair 2 does not inherit Pair 1's
generated records. This makes pairs stochastic replications of consuming the same available memory,
rather than correlated steps in one evolving arm. The source artifact is identical across all pairs.

The direction schedule is explicit and fixed before effects. A caller may repeat directions, but
the list must contain at least two distinct canonical directions so a supported result cannot be a
single-direction claim. CandidateArena's explicit allocation fixes one worker slot and one
development submission on both sides. Allocation is not an intervention in this study.

The pre-effect baseline must contain at least one safe memory item. Treatment and control
commitments in a pair must report the same non-zero `memory_source_digest` and item count. Otherwise
the pair is terminally ineligible because no memory contrast was established.

## Pair Execution

For each pair, the runtime:

1. verifies the study and the frozen baseline;
2. creates fresh treatment and control stores through temporary roots and atomic rename;
3. verifies both copies against the exact baseline snapshot;
4. runs the two planned CandidateArena ticks concurrently with identical source, agent, direction,
   explicit allocation, and maximum budget;
5. applies only the planned memory mode to each side;
6. loads exact tick, preflight, checkpoint, admission, and behavior evidence from each arm store;
7. records one immutable `ResearchMemoryControlPairOutcome` in the coordinator store;
8. removes no evidence and starts the next pair only after the prior pair is terminal.

The study runtime does not adopt a provider process, tool server, sandbox, or unfinished worker
session after restart.

Restart behavior is evidence-derived:

- no planned allocation or preflight effect on either side: the pair may start;
- both exact ticks are complete but the pair outcome is missing: reconstruct the outcome once;
- one side is complete, or either side has a preflight effect without a complete tick: close orphan
  worker evidence through existing recovery and record the pair as interrupted/ineligible;
- an exact pair outcome exists: return it without another worker effect;
- copied baseline, identity, policy, or graph drift: fail closed and do not run either side.

The runtime records concise platform failure kinds, not provider stdout/stderr or raw evaluator
data. One failed pair does not cancel later precommitted pairs, but it remains in the final
denominator and cannot be replaced.

## Exact-Repeat Estimand

The primary unit is one planned pair, and the primary worker observation is binary:

- `1` (`exact_repeat`): the external admission record says the submitted artifact was unchanged or
  its complete development behavior fingerprint exactly matched a prior admitted fingerprint on
  the same protocol and suite;
- `0` (`distinct_behavior`): the worker submitted changed SystemCode and the external behavior
  comparison is `distinct`, even if another independent gate later quarantined it;
- `ineligible`: no submission, worker/platform failure, missing or unavailable fingerprint,
  malformed graph, missing memory contrast, or an interrupted/unpaired run.

No text similarity, LLM classification, replay score, sealed score, or paper outcome participates.

For an eligible pair:

```text
paired_difference = masked_exact_repeat - released_memory_exact_repeat
```

Therefore `+1` favors released memory, `0` is tied, and `-1` favors the masked control. This is an
exact repeated-behavior estimand, not a general candidate-quality or economic estimand.

The pair outcome also retains non-authoritative diagnostics: admission status, no-submission and
failure status, provider requests, runner commands, scenario count, elapsed time, and exact
candidate/tick/preflight references. These diagnostics cannot substitute for the primary
classification.

## Study Inference

`ResearchMemoryControlStudyOutcome` requires exactly one terminal pair outcome for every planned
pair. There is no early stopping, pair replacement, or outcome-aware inclusion.

The frozen policy is:

- `policy_version`: `paired_exact_repeat_sign_test_v1`;
- `primary_estimand`: mean masked-minus-released-memory exact-repeat indicator;
- two-sided exact sign test;
- alpha `0.05`;
- minimum six non-tied eligible pairs;
- ties excluded from the sign test and included in the mean;
- ineligible pairs retained in counts and excluded from inference;
- minimum mean paired difference greater than zero.

Inference:

- `memory_effect_supported`: minimum evidence is met, favorable pairs exceed unfavorable pairs,
  exact p-value is at most `0.05`, and mean paired difference is positive;
- `memory_effect_not_supported`: minimum evidence is met but the support rule fails;
- `insufficient_memory_control_evidence`: fewer than six non-tied eligible pairs or any required
  graph is missing.

The causal scope is limited to the exact frozen baseline, memory source, provider/model/profile,
directions, source artifact, and bounded CandidateArena protocol. Supported evidence closes only
the narrow claim that released memory reduced exact repeats under those conditions. Broader memory
efficacy requires separately precommitted baselines and real provider runs.

## Persistence And Validation

The domain owns runtime shapes, canonical digest inputs, deterministic identities, and pure outcome
validation. Application services own commit/replay decisions and exact sign-test calculation.
`OuroborosStorePort` and `LocalStore` own append-only persistence, digest checks, deterministic IDs,
study-before-effect rules, one outcome per pair, one outcome per study, and exact source-graph
validation.

The existing campaign snapshot implementation should be factored into a generic bounded research
baseline helper. Existing persisted campaign snapshots remain readable; new baseline capture uses
an experiment-wide evidence exclusion policy and excludes both allocation-control and memory-control
records. This is a storage-helper refactor, not a migration of existing campaign semantics.

Runtime composition belongs in `apps/runtime/src/candidate/arena`. It uses the existing
`runCandidateArenaTick`, ResearchWorker recovery, LocalStore, source-artifact closure, and managed
agent factory. No public command, default scheduler, UI, or always-on process is added in this
frontier.

## Failure And Recovery

- Empty or unstable baseline: no study commitment.
- Study commitment conflict: no pair effect.
- Baseline copy mismatch: no worker effect in that pair.
- Memory source digest or count mismatch: pair ineligible, no causal comparison.
- Memory-bearing key reaches a masked provider payload: hard failure before provider invocation.
- Preflight policy missing or inconsistent: pair ineligible and no reconstruction by inference.
- One-sided process loss: pair interrupted/ineligible; never rerun only the missing side.
- Both ticks complete before coordinator persistence: reconstruct the exact pair outcome.
- Pair outcome conflict: stop the study; records are append-only.
- Provider failure: preserve bounded evidence, close the worker, classify the pair without retry.
- Study outcome conflict: fail closed; never recompute under a new analysis policy.

## Non-Goals

- Qualified paper discovery-yield or future-revenue inference.
- Reusing or changing `ResearchControlCampaign` allocation semantics.
- A generic factorial experiment framework.
- Directed versus undirected worker controls.
- Agent versus random/template generation controls.
- Semantic, approximate, or model-judged duplicate detection.
- Automatic memory-policy replacement or disabling released memory.
- Default scheduling, public commands, UI, TradingPromotion, private data, orders, or live exchange.

## Acceptance

1. Every new CandidateArena preflight binds an exact `ResearchWorkerMemoryPolicy`; old persisted
   commitments remain readable.
2. A masked provider receives the same current task, direction, source, agent, and budget as its
   paired treatment but no Arena memory or prior checkpoint.
3. Both pair commitments bind the same non-zero memory source digest/count and opposite exact modes
   before provider effects.
4. A study commits 6 to 30 deterministic pairs before any planned allocation, preflight, or tick.
5. Every pair starts from fresh verified copies of one exact baseline and runs initial sides
   concurrently.
6. Pair outcomes classify exact repeats only from external unchanged-artifact or exact behavior-
   fingerprint evidence.
7. No-submission, unavailable fingerprint, malformed evidence, or one-sided restart cannot become
   a favorable observation.
8. All planned pairs appear exactly once in the final outcome; no early stop or replacement is
   possible.
9. Six favorable non-tied fixture pairs produce p-value `0.03125` and supported narrow inference;
   ties, adverse pairs, missing pairs, or fewer than six non-ties do not.
10. Replaying a complete pair or study creates no provider call and returns byte-equivalent records.
11. Independent QA probes context leakage, forged digests, pair substitution, baseline mutation,
    asymmetric restart, authority widening, and outcome-aware omission.
12. Focused tests, package typechecks, full repository tests, and repository guards pass.

## Evidence Claim

Deterministic fixtures can prove the protocol, isolation, persistence, inference math, and restart
behavior. A one-pair real Codex run can prove provider integration. Neither proves that AI workers
benefit from memory. The causal-research-memory Goal axis remains open until a precommitted eligible
multi-pair real-provider outcome supports the effect, or a separately justified discovery-yield
memory study does so.
