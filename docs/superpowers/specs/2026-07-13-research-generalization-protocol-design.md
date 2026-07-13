# ResearchGeneralizationProtocol Design

Status: implemented and repository-verified on 2026-07-13. Prospective real-market evidence
collection remains open.

Implementation evidence:

- `e57873e` adds the closed-public-kline classifier and Gateway evidence boundary.
- `67cf883`, `1b60e86`, and `c1774f8` add create-only protocol commitment, exact study assignment,
  and automatic prospective slot scheduling.
- `1af1283` and `8ef9f78` add conservative stratified outcome adjudication and automatic
  oldest-missing reconciliation.
- The completed frontier passes 183 Vitest files with 2930 tests, every workspace typecheck, docs,
  architecture, naming, tracked-env, secret, and diff guards.
- This verifies protocol mechanics and authority closure. It does not claim that six eligible
  forward-time studies have completed or that generalization, profitability, promotion eligibility,
  or live readiness has been established.

## Goal

Extend the proven same-baseline `ResearchControlStudy` path into a bounded, prospective protocol
that can test whether an allocation-policy effect survives independent source baselines and
pre-effect public market conditions.

The protocol must prevent one deterministic fixture, one favorable market path, repeated trials
from one baseline, or post-outcome block selection from becoming a broad policy claim. It remains
research-only and cannot promote a `TradingSystem`, replace Trading review, submit an order, or
grant live authority.

## Current Evidence Boundary

The implemented Gate 1 path has established the following mechanics:

- one `ResearchControlStudy` commits six exact same-baseline replications before effects;
- real arm/session composition can produce qualified non-tied evidence under one frozen path;
- external campaign and study adjudication survives restart;
- a separate `ResearchAllocationPolicyDecision` can select `adaptive_default` for future
  uncontrolled research ticks within the exact same-baseline causal scope;
- the server can commit, lease, execute, adjudicate, and reconcile that path automatically.

It has not established independent-baseline replication, forward-time market-condition coverage,
real-market superiority, profitability, TradingPromotion eligibility, or live authority.

## Unbiased AAR Interpretation

Anthropic AAR demonstrates that a long-running agentic research system can improve a measurable
artifact when generation, evaluation, retention, and iteration are tightly closed. It does not
show that repeated measurements from one non-stationary financial path are independent or that a
research-policy effect transfers across market conditions.

Ouroboros therefore retains the useful AAR mental model while adding controls required by trading:

- candidate generation remains broad and agentic;
- evaluation remains external to the candidate and ResearchWorker;
- negative and failed evidence remains in lineage;
- study membership, conditions, budgets, and stopping are fixed before effects;
- same-baseline stochastic replication and cross-condition generalization remain separate claims;
- broader policy review requires prospective evidence from multiple source baselines and market
  conditions;
- economic promotion remains a separate paper-backed decision.

## Taxonomy Decision

### Goal

Name the bounded multi-study commitment without implying deployment, policy replacement, or a new
kind of candidate evaluation.

### Context Read

- `ResearchControlCampaign` is one adaptive/static candidate-generation comparison.
- `ResearchControlStudy` is one same-frozen-baseline set of campaign replications.
- `ResearchControlStudyOutcome` is the external same-baseline aggregate.
- `ResearchAllocationPolicyDecision` is a separate research-policy selection record.
- the maintained evidence-program design calls the next boundary a stratified protocol and a
  separate multi-study generalization record.

### Vocabulary Sources

Conventional experimental-design terms are primary: protocol, stratum/block, prospective,
pre-effect, replication, exact sign test, and generalization. Existing Ouroboros `ResearchControl`
names remain unchanged.

### Canonical Vocabulary

- `ResearchGeneralizationProtocol`: immutable pre-effect commitment for required market-condition
  blocks, deterministic study slots, timing, resource bounds, and stratified analysis.
- `ResearchGeneralizationOutcome`: immutable external aggregate over the exact protocol slots.
- `market_condition`: the pre-effect public-data classification bound to one protocol study.
- `condition_block`: one precommitted `long`, `short`, or `flat` stratum.

`ResearchGeneralizationProtocol` is coined because no existing record owns the cross-study
commitment. It deliberately omits `control`, `allocation`, `market`, and `program` from the noun;
those are fields or context, not separate ownership axes.

### Compatibility

Existing `ResearchControlStudy` and `ResearchControlStudyOutcome` records keep their names and
same-baseline meaning. A new optional `generalization_assignment` field distinguishes protocol
studies without reinterpreting historical Gate 1 records. There are no aliases or fallback reads.

Do not extend the following names:

- `ResearchProgram`, because it does not identify the committed statistical boundary;
- `MarketRegimeStudy`, because it hides source-baseline generalization and overstates a coarse
  public classifier;
- `AdaptivePolicyPromotion`, because the protocol grants no promotion authority;
- `ResearchControlStudyV2`, because schema versioning would hide the new cross-study owner.

No migration is required. Historical records remain valid and are never eligible as protocol
slots unless they already carry the exact assignment.

`writeback_needed: true` because the vocabulary changes durable domain and evidence meaning.

## Public Market Condition Evidence

### Gateway Boundary

The classifier must not infer a condition from the current summarized `MarketSnapshot`. That
surface can be backed by a variable number of WebSocket closes and cannot prove the requested
lookback boundary.

Add a Gateway-owned public kline-window capability behind `MarketDataPort`. The Binance adapter
uses the official USD-M Futures kline endpoint with:

- symbol `BTCUSDT`;
- interval `1m`;
- exactly 30 klines;
- `endTime` equal to the final millisecond of the last fully closed minute before observation;
- no credentials, account data, order submission, or private stream.

The normalized input persists each open time, close time, and close price. Validation requires 30
strictly contiguous, complete one-minute klines, finite positive closes, no duplicate timestamps,
and no close after the fixed boundary. Missing, stale, malformed, future, or non-public evidence
opens no study slot.

### Classifier V1

`btc_usdt_closed_kline_direction_v1` computes:

```text
fast_mean = mean(last 5 closes)
slow_mean = mean(all 30 closes)
directional_gap_ratio = (fast_mean - slow_mean) / slow_mean
threshold = 0.00005
```

The condition block is:

- `long` when `directional_gap_ratio > threshold`;
- `short` when `directional_gap_ratio < -threshold`;
- `flat` otherwise.

The policy, source configuration, exact kline window, derived features, and classification each
have stable SHA-256 digests. Classification is a pure function and does not call an LLM. A future
volatility, funding, liquidity, or cost stratification requires a new protocol version; it cannot
change v1 after outcomes are visible.

## Protocol Commitment

One `ResearchGeneralizationProtocolRecord` commits:

- the exact adaptive allocation policy and digest under test;
- one exact ResearchWorker provider/model/profile identity;
- one exact paper evaluation protocol and campaign policy;
- classifier policy and source configuration digests;
- two study slots for each `long`, `short`, and `flat` block;
- six replications per study and one tick per arm;
- a global minimum 24-hour interval between included study commitments;
- a maximum 90-day collection window;
- the existing per-study file, byte, concurrency, and provider-request bounds;
- equal precommitted block weighting;
- a minimum of six terminal studies, six non-tied study effects, and three distinct source baseline
  snapshot digests;
- a two-sided exact sign test at alpha 0.05;
- a harmful-block rule and missing-block rule.

Every slot precommits its block, ordinal, study idempotency key, and expected
`ResearchControlStudy` ID. Slot identity cannot depend on observed outcomes.

The protocol is create-only. Concurrent exact creation converges on the same bytes. Any semantic
conflict for the deterministic identity fails closed.

## Study Assignment

After the protocol exists, the automatic commitment coordinator may fill one slot only when:

1. no incomplete `ResearchControlStudy` exists;
2. the protocol is inside its collection window;
3. the exact 24-hour spacing boundary has elapsed;
4. a valid pre-effect public kline window classifies to a block with an unfilled slot;
5. the latest `TradingPromotion` still matches the frozen paper/campaign protocol;
6. its source artifact has not already filled another slot in that condition block;
7. the current ResearchWorker identity matches the protocol;
8. the study and all six campaign identities match the precommitted slot.

The study's `generalization_assignment` binds the protocol ref/digest, slot, market condition,
source artifact identity, and classification digest. The existing study commitment then binds the
exact materialized baseline snapshot digest before any campaign effect.

An unavailable condition, full block, repeated source baseline, policy drift, worker drift, paper
protocol drift, elapsed collection window, or spacing boundary is an explicit deferred result. It
must not be converted into another block or an unplanned study. Transient public-data unavailability
does not terminate the scheduler; corrupt persisted evidence does.

## Forward-Time And Baseline Independence

Wall-clock time is not inserted into an idempotency key. The protocol precommits six deterministic
slots, and the assignment evidence records which public window opened each slot.

The 24-hour boundary prevents rapid repeated studies from one market observation. The per-block
source-artifact uniqueness rule prevents duplicate source code from counting twice in one stratum.
The outcome additionally requires at least three distinct baseline snapshot digests. Repeated
baselines in different condition blocks remain visible but cannot alone satisfy baseline
generalization.

## Stratified Outcome

`ResearchGeneralizationOutcome` can be committed only when all six slots have terminal study
outcomes, or once the 90-day collection deadline has passed. It reports every planned slot,
including missing and ineligible slots.

For every condition block it reports:

- planned, completed, non-tied, tied, missing, and ineligible study counts;
- each study's adaptive-minus-static qualified-discovery-rate effect;
- the equal-weight block mean;
- distinct baseline count;
- the exact refs and digests needed to replay the result.

The overall estimand is the equal-weight mean of the three precommitted block means. The exact sign
test uses study-level effect signs; ties remain in the mean and denominator but are excluded from
the sign test.

The outcome is `generalization_supported` only when:

- every required slot is terminal and eligible;
- every block has its two studies;
- at least three distinct baseline snapshot digests are present;
- all six study effects are non-tied;
- the two-sided exact sign-test p-value is at most 0.05;
- the equal-weight overall mean is positive;
- no block mean is zero or negative.

It is `insufficient_generalization_evidence` when required blocks, eligible studies, non-ties, or
distinct baselines are absent. It is `generalization_not_supported` when complete eligible evidence
fails the effect or harmful-block rule. Unsupported and insufficient outcomes remain durable
negative evidence.

## Authority Boundary

The protocol has research scheduling authority only. The outcome has external evaluation
authority only. Neither record grants:

- automatic or explicit `TradingPromotion`;
- replacement of Trading review;
- candidate admission or ranking authority;
- order submission or private exchange access;
- live authority.

A future broad `ResearchAllocationPolicyDecision` may consume an exact supported generalization
outcome, but that is a separate frontier and decision record. Existing same-baseline decisions stay
unchanged and keep their narrow provenance.

## Recovery And Concurrency

- Protocol, study, and outcome writes are create-only and exact-race convergent.
- Restart selects only the earliest missing eligible action.
- A slot is filled only by its deterministic expected study ID.
- A study assignment is immutable once recorded.
- Existing study execution leases continue to own effects; the protocol does not add a second
  runtime owner.
- Scheduler read failures from public data become bounded deferred evidence; persisted graph drift
  is terminal.
- Expiry closes collection without fabricating missing studies.

## Verification

### Classifier

- exact 30-kline long, short, and flat windows classify deterministically;
- threshold boundaries classify as flat;
- future, incomplete, gapped, duplicate, malformed, private, and wrong-symbol evidence fails;
- digest replay is byte-stable;
- adapter requests the exact closed-window `endTime`.

### Protocol

- deterministic IDs and six precommitted slots replay exactly;
- exact concurrent creation converges; conflicting content fails;
- no historical unassigned study can occupy a slot;
- authority fields remain research-only.

### Commitment

- protocol creation precedes the first included study;
- one scheduler cycle performs at most one durable action;
- spacing, expiry, full-block, missing-data, source-reuse, and drift deferrals have stable reasons;
- condition evidence predates study and campaign effects;
- restart fills only the earliest matching slot;
- two server processes cannot publish different studies for one slot.

### Outcome

- equal block weighting cannot be changed by oversampling;
- every slot and harmful block remains visible;
- duplicate baselines do not satisfy the minimum;
- all-positive six-study evidence yields exact p-value 0.03125;
- missing, tied, harmful, and protocol-drift cases remain unsupported or insufficient;
- no outcome mutates an existing policy decision or promotion.

## Non-Goals

- Automatic TradingPromotion or champion runner handoff.
- Live exchange authority or private market data.
- Multi-host study-execution fencing.
- LLM-judged market narratives.
- Volatility, funding, liquidity, or cost factorial claims in v1.
- Retrofitting historical same-baseline studies into the protocol.
- Claiming economic profitability from candidate-discovery yield.

## Acceptance

The frontier is complete when the default server can create the frozen protocol, classify only
pre-effect Gateway-owned public evidence, fill deterministic forward-time slots without duplicate
baseline credit, adjudicate all planned blocks conservatively, reconstruct the exact graph after
restart/race, and expose no promotion or live authority.
