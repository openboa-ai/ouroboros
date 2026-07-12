# ResearchPopulationDiversity Trajectory Design

**Status:** Complete

## Goal

Make current CandidateArena diversity collapse observable at the same cross-sectional level used by
Anthropic's Automated Weak-to-Strong Researcher while preserving the existing latest-ten-tick
population coverage aggregate.

This frontier adds measurement resolution only. It does not classify semantic strategy families,
declare a collapse threshold, change research allocation, or claim that diversity causes qualified
paper improvement.

## Why The Existing Aggregate Is Insufficient

The first `ResearchPopulationDiversity` frontier correctly separates assigned
`ResearchDirection` concentration from exact same-suite observed behavior concentration. It
aggregates samples over the latest ten completed ticks. That answers a useful longitudinal coverage
question: which lanes and exact behaviors appeared in the recent population?

It does not answer the AAR cross-sectional question: are the workers in the current iteration
converging on one approach? Anthropic categorized active-worker ideas at every iteration and plotted
the entropy trajectory over cumulative hill-climbing time. A rolling aggregate can hide current
collapse behind diverse older ticks. It can also become globally `incomparable_suites` after a
protocol or development-suite rotation even when each individual tick remains internally
comparable.

Ouroboros therefore needs both views:

1. latest-ten-tick aggregate for recent population coverage;
2. one bounded per-tick series for cross-sectional concentration and trend inspection.

## Source Interpretation

Anthropic's
[Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/)
computes Shannon entropy at each iteration across active workers after model-based categorization
into eleven method families. It reports that directed workers retained higher entropy than an
undirected control.

Ouroboros cannot directly reproduce that claim with exact behavior fingerprints:

- a `ResearchDirection` is assigned scheduling context, not an observed semantic method;
- an exact `ResearchBehaviorFingerprint` is a bounded development-suite behavior key, not a method
  family;
- three selected workers per default tick provide a much smaller cross-section than nine AARs;
- no directed-versus-undirected causal campaign exists yet.

The trajectory is therefore a lower-bound operational diagnostic. It must not be presented as a
replication of Anthropic's method-family result.

## Considered Approaches

### 1. Keep only the rolling aggregate

Rejected as complete entropy-collapse evidence. It preserves recent coverage but can mask a latest
tick where all workers emitted the same behavior.

### 2. Replace the aggregate with the latest tick

Rejected. A three-worker sample is noisy, and removing the rolling view would lose direction
coverage and repeated-behavior history.

### 3. Keep the aggregate and add a bounded per-tick trajectory

Selected. Each tick is independently cohort-checked and measured. Consumers can inspect current
collapse, recovery, and suite transitions without combining incomparable evidence or discarding
recent population coverage.

## Taxonomy

Keep `ResearchPopulationDiversity` as the canonical noun. Add only the descriptive type
`ResearchPopulationDiversityTickReadModel` and field `tick_series`.

Vocabulary axes:

- domain noun: research population diversity;
- data role: derived read-only tick cross-section;
- lifecycle: one entry per completed CandidateArena tick in the bounded window;
- source: exact tick, commitment, direction, fingerprint, and admission evidence;
- audience: Operator surfaces and next ResearchWorker context;
- authority: no scheduling, evaluation, admission, rank, qualification, promotion, order, private,
  or live authority.

Do not add `collapse_score`, `diversity_health`, `healthy`, `unhealthy`, `warning`, or
`recommended_allocation`. Those names imply an uncalibrated threshold or policy.

There is no compatibility alias or migration. The read model is new on the current branch, so the
required field is updated directly.

## Read Model

Extend `ResearchPopulationDiversityReadModel`:

```ts
interface ResearchPopulationDiversityTickReadModel {
  tick_id: string;
  completed_at: string;
  assigned_directions: ResearchDiversityDistributionReadModel;
  observed_behaviors: ResearchPopulationDiversityObservedBehaviorReadModel;
  evaluation_authority: false;
  promotion_authority: false;
  authority_status: "not_promotion_authority";
}

interface ResearchPopulationDiversityReadModel {
  protocol_version: "research_population_diversity_v1";
  window_tick_count: number;
  assigned_directions: ResearchDiversityDistributionReadModel;
  observed_behaviors: ResearchPopulationDiversityObservedBehaviorReadModel;
  by_direction: ResearchPopulationDiversityDirectionReadModel[];
  tick_series: ResearchPopulationDiversityTickReadModel[];
  evaluation_authority: false;
  promotion_authority: false;
  authority_status: "not_promotion_authority";
}
```

`tick_series` invariants:

- length equals `window_tick_count` and is at most ten;
- entries are newest first by `completed_at`, then `tick_id` descending;
- tick IDs are unique;
- every distribution uses only evidence bound to that exact tick;
- assigned samples include every direction result in the tick;
- observed samples include at most one exact fingerprint per exact commitment;
- admission classifications use only exact commitment-bound decisions;
- each tick performs its own protocol/development-suite cohort check;
- fewer than two samples remain `insufficient_evidence`;
- mixed cohorts inside one tick are `incomparable_suites`;
- no per-tick raw IDs, digests, observations, scenario IDs, score, PnL, sealed, or paper evidence is
  exposed.

The top-level aggregate and `by_direction` behavior stay unchanged. A window can be
`incomparable_suites` while each tick entry remains measured under its own single cohort.

## Calculation

Reuse the existing exact-linkage, Shannon entropy, normalization, and six-decimal rounding
functions. Build one evidence bucket per selected tick while scanning fingerprints and admissions:

1. select and order the latest ten completed ticks;
2. validate every in-window commitment's ResearchDirection and matching tick result;
3. assign each exact fingerprint and admission to its commitment's tick and direction;
4. compute the existing window aggregate;
5. compute one independent distribution pair per tick;
6. validate the final read model with the strict domain shape helper.

Do not persist the series. Restart reconstruction from append-only Store evidence must be
deterministic.

## CandidateArena And Worker Context

`CandidateArenaReadModel.research_population_diversity` carries the series automatically. The next
ResearchWorker receives the same aggregate object. The existing `latest_ticks` and
`latest_research_efficiency` context provide the matching cost and outcome coordinates by
`tick_id`; this frontier does not duplicate those metrics inside the diversity object.

No UI policy, badge, alert, or automatic allocation change is added. A later surface may visualize
the series only after product requirements define how to communicate small-sample uncertainty.

## Failure And Recovery

- Orphan fingerprints and historical admissions without exact commitment linkage remain excluded.
- Missing direction or tick-result linkage for an in-window commitment fails the derived read.
- Conflicting fingerprints or admissions for one commitment fail the derived read.
- A suite transition between ticks does not erase valid within-tick measurements.
- A suite conflict inside one tick yields `incomparable_suites` for that tick.
- Restart produces byte-equivalent ordering and metrics from the same records.

## Non-Goals

- semantic method-family classification;
- bootstrapped confidence intervals;
- a minimum-worker policy beyond `insufficient_evidence` for fewer than two samples;
- an entropy-collapse threshold or status label;
- directed-versus-undirected, memory, adaptive/static, or agent/baseline causal adjudication;
- entropy-driven allocation;
- economic, qualification, promotion, order, private, or live authority.

## Acceptance

The frontier is complete when tests prove:

- a diverse earlier tick plus collapsed latest tick remains distinguishable in `tick_series`;
- top-level rolling coverage remains unchanged;
- a cross-tick suite transition makes only the window aggregate incomparable while single-cohort
  ticks retain valid entropy;
- an intra-tick suite conflict is incomparable only for that tick and the window;
- ordering, length, uniqueness, exact linkage, and strict authority are enforced;
- CandidateArena and next-worker context expose the bounded series without raw evidence;
- all workspace typechecks, repository guards, focused regressions, and the full suite pass.

## Implemented Evidence

`ResearchPopulationDiversityReadModel` now requires a newest-first `tick_series` whose length equals
the bounded window count. Strict domain validation enforces exact keys, canonical time and order,
unique tick IDs, per-tick cohort rules, closed authority, and conservation of assigned, observed,
admission, duplicate, artifact-duplicate, and unavailable counts between the series and top-level
aggregate.

The pure builder creates window and tick accumulators during the same exact commitment-bound
fingerprint/admission scan. Tests prove an earlier diverse tick remains distinct from a latest
collapsed tick, rolling coverage is unchanged, cross-tick suite transitions preserve valid
single-cohort tick entropy, intra-tick suite conflicts remain incomparable, and latest-ten ordering
is deterministic. The real CandidateArena distinct-to-exact-duplicate sequence exposes the same
series through Operator readback and next-worker context without raw fingerprint evidence.

Focused evidence is 41 domain tests, 11 pure application tests, 232 cross-layer tests, and 16
product-loop smoke tests. All workspace typechecks and repository guards pass. The full suite passes
287/287 suites and 2117/2117 tests with zero failed, pending, or todo. The first two full-suite
attempts exposed a pre-existing test-harness mismatch: polling could exceed the `/api/operator`
rate limit, then a rate-safe interval could exceed the default 20-second test timeout under CPU
contention. The final harness uses at most 60 polls at 500 ms and a 40-second timeout only for the
long-running repeating-arena smoke.

This closes cross-sectional observability, not causal attribution. Semantic method-family
classification, confidence intervals, collapse thresholds, directed/undirected controls,
memory/no-memory controls, adaptive/static discovery yield, agent/baseline leverage, and
prospective economic improvement remain separate frontiers.
