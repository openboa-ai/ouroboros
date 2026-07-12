# ResearchPopulationDiversity Design

**Status:** Approved for implementation

## Goal

Measure whether CandidateArena research is collapsing onto a small set of assigned directions or
externally observed behaviors. Keep those measurements separate from one another and from economic
quality, admission, qualification, and promotion.

This frontier makes diversity observable. It does not claim that a direction label proves a unique
hypothesis, that an exact behavior key proves semantic strategy identity, or that entropy predicts
future paper profit.

## Source Interpretation

Anthropic's
[Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/)
reports that assigning nine parallel researchers distinct ambiguous directions improved
hill-climbing and maintained higher Shannon entropy than an undirected condition. Their diversity
measurement used Claude to categorize proposed ideas into eleven method families. It was a
cross-sectional research-process measurement, not an economic score, a proof of semantic
independence, or the held-out evaluator itself.

The paper also reports evaluator reward hacks and concludes that entirely held-out transfer is
needed. That limits what Ouroboros may infer from a diversity chart: high entropy can accompany
invalid, unprofitable, or overfit candidates, and low entropy can be rational when evidence
converges. Diversity is a search diagnostic, not an authority gate.

Ouroboros has stronger externally observed behavior evidence than a self-authored idea label, but
weaker semantic categorization than Anthropic's method-family classifier. Version 1 therefore
reports two orthogonal distributions and does not pretend they are interchangeable:

1. assigned `ResearchDirection` distribution;
2. exact development `ResearchBehaviorFingerprint` distribution.

## Considered Approaches

### 1. Report only assigned direction counts

Rejected as sufficient evidence. Directions are preassigned and can look diverse while every
candidate emits the same decisions.

### 2. Ask the ResearchWorker or another LLM to classify strategy families

Deferred. This could approximate Anthropic's method-family analysis but introduces a model-judged
taxonomy, prompt drift, and self-report dependence. It needs an external versioned classifier and
calibration before becoming repo evidence.

### 3. Treat every artifact digest as a distinct idea

Rejected. Text changes, comments, dead code, and equivalent control flow can inflate diversity.

### 4. Treat every exact behavior fingerprint as globally comparable

Rejected. Fingerprints are comparable only under the exact same protocol and development-suite
version/digest. Combining different suites would manufacture novelty.

### 5. Report assigned-direction and same-suite behavior entropy separately

Selected. Assigned entropy reveals scheduling concentration. Exact behavior entropy reveals
observational concentration on the bounded public development suite. Their disagreement is useful:
high assigned entropy plus low behavior entropy is direct evidence that labels are not producing
different behavior.

## Canonical Vocabulary

Add one read-model noun: `ResearchPopulationDiversity`.

It is a read-only, restart-reconstructible CandidateArena measurement over append-only tick,
commitment, fingerprint, and admission evidence. It is not a persisted authority record and cannot
admit, rank, qualify, promote, submit an order, read private data, or enable live trading.

## Measurement Window

Version 1 uses the same bounded latest-tick window already exposed by CandidateArena: at most ten
completed ticks. The read model records the actual tick count. It does not mix active or orphan
allocations without a completed tick.

Assigned-direction samples come from each direction result in those completed ticks, including
created, duplicate, quarantined, and failed outcomes. This measures what the scheduler actually
attempted.

Observed-behavior samples come from complete persisted `ResearchBehaviorFingerprint` records whose
exact commitment belongs to the window. Invalid or unavailable fingerprints are not fabricated.
Admission classifications are joined through the exact commitment-bound admission graph.

## Entropy Contract

For category counts `n_i` and total `N`, Shannon entropy is:

```text
H = -sum((n_i / N) * log2(n_i / N))
```

Values are rounded to six decimal places.

Assigned-direction normalized entropy divides by the maximum possible entropy for the smaller of
the sample count and the seven canonical `ResearchDirectionKind` values. Observed-behavior
normalized entropy divides by `log2(N)`, the maximum when every comparable submission has a unique
exact behavior key. A distribution with fewer than two samples is `insufficient_evidence` and
reports zero entropy.

Behavior identity includes exact:

- fingerprint protocol version;
- development-suite version;
- development-suite digest;
- fingerprint digest.

If the window contains more than one protocol/suite cohort, observed behavior status is
`incomparable_suites`. Version 1 reports the cohort count and submission count but omits entropy and
unique-count claims rather than aggregating incomparable evidence.

No entropy threshold automatically declares collapse. Threshold selection requires empirical
calibration and would be a separate policy decision.

## Read Model

Add `ResearchPopulationDiversityReadModel` to `CandidateArenaReadModel`:

```ts
interface ResearchDiversityDistributionReadModel {
  measurement_status: "insufficient_evidence" | "measured" | "incomparable_suites";
  sample_count: number;
  unique_count?: number;
  entropy_bits?: number;
  normalized_entropy?: number;
}

interface ResearchPopulationDiversityReadModel {
  protocol_version: "research_population_diversity_v1";
  window_tick_count: number;
  assigned_directions: ResearchDiversityDistributionReadModel;
  observed_behaviors: ResearchDiversityDistributionReadModel & {
    cohort_count: number;
    admitted_submission_count: number;
    exact_behavior_duplicate_count: number;
    artifact_duplicate_count: number;
    unavailable_fingerprint_count: number;
  };
  by_direction: Array<{
    direction_kind: ResearchDirectionKind;
    attempt_count: number;
    observed_behavior_count: number;
    unique_behavior_count?: number;
    admitted_submission_count: number;
    exact_behavior_duplicate_count: number;
  }>;
  evaluation_authority: false;
  promotion_authority: false;
  authority_status: "not_promotion_authority";
}
```

Only directions with at least one attempted or behavior/admission sample appear in `by_direction`,
in canonical order. The read model exposes counts and aggregate entropy, never fingerprint IDs,
digests, observations, scenario IDs, sealed results, or paper outcomes.
When behavior cohorts are incomparable, direction rows also omit `unique_behavior_count`; a local
unique claim would have the same cross-suite defect as a global one.

## CandidateArena And Worker Context

`buildCandidateArenaReadModel` reconstructs the measurement from Store evidence and includes it in
the shared Operator read model. The compact worker context receives the same aggregate object so a
ResearchWorker can see concentration pressure without reading another worker's raw behavior.

Version 1 does not directly alter allocation. Existing duplicate and failure outcomes already
affect allocation scores and the exploration floor remains active. Feeding entropy itself into a
budget policy requires a separately tested strategy and an equal-bound control.

## Failure And Recovery

- Missing historical commitment linkage excludes that sample rather than guessing.
- Missing direction linkage fails the calculation because persisted checkpoint-enabled evidence is
  corrupt.
- Missing or malformed fingerprints are counted only through explicit unavailable admission when
  present; no behavior key is synthesized.
- Restart recomputes the same result from append-only records.
- Cross-suite evidence is surfaced as incomparable, not rounded into apparent diversity.

## Non-Goals

- semantic strategy-family classification;
- LLM-judged idea complexity or method-family labels;
- a directed-versus-undirected causal experiment;
- memory-versus-no-memory or agent-versus-template ablation;
- changing allocation, admission, leaderboard, qualification, or promotion policy;
- claiming high entropy is profitable or low entropy is bad;
- approximate or prospective paper behavior clustering.

## Acceptance

The frontier is complete when tests prove:

- exact Shannon and normalized entropy for known assigned distributions;
- equal labels with different behaviors and different labels with equal behaviors remain visibly
  distinct cases;
- repeated exact behavior lowers observed entropy without raw fingerprint exposure;
- artifact-only duplicates, exact behavior duplicates, admitted submissions, and unavailable
  fingerprints are counted separately;
- different protocol/suite cohorts produce `incomparable_suites` with no synthetic entropy;
- orphan, historical-unlinked, sealed, paper, score, PnL, rationale, and event noise cannot alter
  the behavior distribution;
- CandidateArena and next-worker context expose only bounded aggregate metrics;
- focused tests, typechecks, repository guards, product-loop regression, and the full suite pass.
