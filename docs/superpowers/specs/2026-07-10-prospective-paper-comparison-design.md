# Prospective Paper Comparison Design

**Date:** 2026-07-10
**Status:** Inert comparison commitment graph implemented; shared ticks, activation, verdict, and recovery pending
**Scope:** CandidateArena P0 prospective champion/challenger comparison
**Depends on:** PaperTradingEvaluation commitments, candidate admission, and sealed ResearchPreflight

## Purpose

Ouroboros needs direct evidence that a challenger improved the trading frontier, not merely a high
score from a favorable or adaptively selected paper window. A valid comparison must bind both
candidate versions and all evaluation policy before outcomes exist, let both systems observe the
same prospective public market opportunities, keep qualification outcomes hidden from research,
and preserve the selected champion's independent continuous paper session.

This design adds a paired qualification protocol. It does not hardcode a strategy, model, provider,
tool, decision cadence, or trade count. It freezes only the external authority, evidence, market,
account, cost, risk, resource, and adjudication envelope.

## Rejected Approaches

### Reuse the champion's research-feedback session

Rejected because a research-feedback window cannot become qualification evidence after outcomes
are visible. Stopping or repurposing that session also violates champion continuity.

### Clone the champion as another candidate

Rejected because equal SystemCode under a new candidate ID is still a duplicate. Cloning would
corrupt population diversity and lineage while hiding the real requirement: one candidate version
must support more than one independent TradingRun.

### Compare sealed replay runs

Rejected as qualification authority. Identical replay data remains useful `ResearchPreflight`, but
it is not prospective paper evidence from a future market interval.

## Canonical Vocabulary

- `PaperTradingComparisonCommitment`: append-only pre-start record that binds champion and
  challenger roles, their independent qualification sessions, one shared market-opportunity policy,
  resource bounds, and the verdict policy.
- `PaperTradingComparisonTick`: append-only Gateway-owned market and public-execution checkpoint
  referenced by both sides of one paired observation step.
- `PaperTradingComparisonVerdict`: append-only external adjudication of one closed comparison. Its
  outcome is `challenger_improved`, `champion_retained`, `incomparable`, or `invalidated`.

`champion` and `challenger` are role fields inside the comparison. They are not new candidate types.
`TradingRun` remains the canonical execution-session noun. The existing generic
`EvaluationComparisonSet` and replay comparison read models remain research/backtest scaffolds and
must not be reused as paper qualification authority.

## Implemented Prerequisite: Multiple TradingRuns Per CandidateVersion

The multi-run persistence and lifecycle boundary is implemented. A frozen CandidateVersion can own
its default selected continuous paper session and additional isolated internal paper TradingRuns,
including a champion qualification run, without mutating the default session.

The implemented ownership rule is:

- `CandidateVersion.runtime_ref` remains the compatibility/default continuous paper run;
- any additional `TradingRunRecord` may reference the same candidate and candidate version when its
  SystemCode, authority, placement, hands environment, and memory boundary are independently
  recorded;
- `getCandidateForTradingRun` resolves through the `TradingRunRecord.candidate_ref` and
  `candidate_version_ref`, not by reverse matching only `CandidateVersion.runtime_ref`;
- activated additional `research_feedback` commitment, evaluation, observation, run-control,
  sandbox, provider, and Ledger validation use the selected TradingRun's own refs;
- an additional run never overwrites the candidate's default runtime projection.

Standalone qualification preparation may resolve and freeze executable artifact identity, then
persist only its TradingRun and supporting refs, frozen commitment and account identity, and
`not_started` evaluation. It remains runtime-inert: the internal `PaperTradingComparisonCoordinator`
may prepare and verify a complete pair commitment, but it cannot start provider, sandbox, market,
Gateway, Ledger, observation, or lifecycle effects. Shared comparison ticks, activation,
adjudication, non-overlapping confirmation, a verdict, and promotion integration remain pending.

## Commitment-Graph Frontier Status

The first implementation frontier persists a `PaperTradingComparisonPreparationRecord` before
either qualification side. It freezes the deterministic future pair ID, both role-specific
candidate refs plus full-record CandidateVersion, SystemCode, and admission-decision digests and,
for champion challenge, the full-record champion-promotion digest plus the exact stopped qualified
promotion evaluation ref/full-record digest, exact qualification commitment ref/full-record digest,
and canonical ordered full-record observation-chain digest. It also freezes each exact SystemCode
artifact digest, the champion selection, the complete comparison policy, market-data configuration
digest, paper policy identity, and a server-owned `committed_at`. Exact replay reuses that timestamp;
caller and public command payloads cannot set it.

The resulting commitment graph is append-only and inert. Both side provider identities must be
qualification-eligible, both complete window policies must match, and the pair is persisted only
after both distinct non-default qualification TradingRuns and side graphs exist. This frontier
atomically reserves frozen authority evidence before side creation, rejects non-noop mutation or
extension of the bound promotion qualification commitment/evaluation/observation chain, and
atomically validates and appends the pair against run, commitment, evaluation, observation, Ledger,
run-control, and sandbox writers. Each pair side freezes the existing side-commitment self-digest
plus full persisted-record digests for its exact baseline commitment and evaluation, including
their timestamps and complete zero state; pair-bound side mutation remains forbidden.

The champion authority closure enforces `SystemCode.created_at <= admission.decided_at <=
commitment.committed_at <= evaluation.started_at <= ordered observations <= evaluation.stopped_at
<= promotion.promoted_at <= preparation.committed_at`. LocalStore and the application qualification
API use one domain-owned qualification decision: complete key-order-insensitive score/account
continuity, at least 30 observations and 30 minutes, at most ten percent failed observations,
current market evidence, and matching public execution evidence for fills. LocalStore and
application each independently verify the commitment self-digest before supplying that result to
the decision; the application wrapper preserves its existing public API. Read-only verification
applies full prepared-side validation, including SystemCode-before-admission, before loading
champion selection authority or dereferencing nested side records.

This frontier grants no activation authority and starts no provider, sandbox, market, runner,
Gateway, Ledger, or observation effect. Each pair side binds the exact sole
commitment/evaluation chain for its qualification `TradingRun` and a zero-score,
zero-observation, empty-account-activity baseline. Post-pair reload is read-only and fails closed on
missing, changed, or malformed side records without repair or invalidation. Shared ticks,
`ComparisonMarketDataView`, verdict/adjudication, confirmations, promotion integration, and pair recovery remain pending.

## Domain Records

### PaperTradingComparisonCommitment

```ts
interface PaperTradingComparisonSide {
  role: "champion" | "challenger";
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  trading_run_ref: Ref;
  paper_trading_evaluation_commitment_ref: Ref;
}

interface PaperTradingComparisonPolicy {
  policy_version: string;
  comparison_mode: "bootstrap" | "champion_challenge";
  symbol: "BTCUSDT";
  interval_ms: number;
  minimum_observation_count: number;
  minimum_elapsed_ms: number;
  maximum_observation_count: number;
  maximum_elapsed_ms: number;
  maximum_start_skew_ms: number;
  maximum_provider_request_count_per_side: number;
  maximum_retry_count_per_side: number;
  primary_metric: "net_revenue_usdt";
  minimum_net_revenue_lift_usdt: number;
  required_confirmation_count: number;
  require_non_overlapping_windows: true;
  require_both_qualified: true;
  release_policy: "sealed_until_adjudication";
}

interface PaperTradingComparisonCommitmentRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_commitment";
  paper_trading_comparison_commitment_id: string;
  champion: PaperTradingComparisonSide;
  challenger: PaperTradingComparisonSide;
  comparison_policy: PaperTradingComparisonPolicy;
  market_data_configuration_digest: string;
  paper_policy_identity: PaperTradingEvaluationPolicyIdentity;
  committed_at: string;
  commitment_digest: string;
  authority_status: "not_live";
}
```

Both side commitments must already exist, have `evidence_purpose: "qualification"`, use
`sealed_until_adjudication`, resolve to distinct TradingRuns, and match the pair's market and paper
policy identities. An idempotent retry may repair a partially prepared set, but no provider,
sandbox, market read, or runner may start until the complete set verifies.

### PaperTradingComparisonTick

```ts
interface PaperTradingComparisonTickRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_tick";
  paper_trading_comparison_tick_id: string;
  paper_trading_comparison_commitment_ref: Ref;
  sequence: number;
  observed_at: string;
  market_snapshot: PaperTradingMarketSnapshotSummary;
  public_execution_snapshot: PaperTradingPublicExecutionSnapshotSummary;
  authority_status: "not_live";
}
```

The coordinator reads the underlying Gateway market port once per tick and persists the result
before either paired observation. Both observations reference the same tick and must embed matching
market/public-execution content. Missing, rewritten, skipped, or cross-comparison tick refs make the
pair incomparable.

### PaperTradingComparisonVerdict

```ts
interface PaperTradingComparisonVerdictRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_verdict";
  paper_trading_comparison_verdict_id: string;
  paper_trading_comparison_commitment_ref: Ref;
  champion_evaluation_ref: Ref;
  challenger_evaluation_ref: Ref;
  outcome: "challenger_improved" | "champion_retained" | "incomparable" | "invalidated";
  champion_net_revenue_usdt?: number;
  challenger_net_revenue_usdt?: number;
  net_revenue_lift_usdt?: number;
  confirmation_count: number;
  required_confirmation_count: number;
  promotion_eligible: boolean;
  reason: string;
  adjudicated_at: string;
  authority_status: "not_live";
}
```

`promotion_eligible` is true only when the challenger improved under the precommitted lift rule,
both windows independently pass `PaperTradingQualification`, all comparison ticks are shared and
contiguous, hard constraints pass, and the required number of non-overlapping confirmations exists.
One favorable comparison may remain `challenger_improved` while still not promotion eligible.

## Application Boundaries

### PaperTradingSessionService

Extract the paper-session lifecycle from public command parsing. The internal service owns:

- creating an additional TradingRun for a frozen CandidateVersion;
- preparing an evaluation commitment and `not_started` evaluation without activating a runner;
- activating only a fully verified prepared session;
- observing with either the normal Gateway port or an externally supplied comparison tick;
- stopping one session without mutating another session for the same candidate version.

`PaperTradingCommandService.start` remains the public adapter and always requests
`research_feedback` on the default TradingRun. It does not accept evidence purpose or comparison
IDs from payloads.

### PaperTradingComparisonCoordinator

The coordinator is the only application owner allowed to create qualification-purpose sessions.
Preparation is two phase:

1. select explicit incumbent/challenger candidate versions and deterministic new TradingRun IDs;
2. resolve both executable artifacts and build both qualification commitments in memory;
3. persist the two TradingRuns, commitments, evaluations, and pair commitment idempotently;
4. reload and verify the complete graph;
5. capture the initial shared market tick;
6. activate both isolated sessions only after steps 1 through 5 succeed.

For each later tick, the coordinator reads one Gateway snapshot and one public-execution snapshot,
records one comparison tick, then asks both sessions to checkpoint against that exact tick. The two
checkpoint calls may run concurrently. Each TradingSystem keeps its own internal decision cadence;
the coordinator never synthesizes a decision, forces equal trade counts, or treats no-order
continuity as failure.

### ComparisonMarketDataView

Qualification provider sessions receive a read-only view backed by the latest persisted comparison
tick. They cannot call the underlying Binance adapter independently. Repeated candidate reads return
the current tick and are request-logged; future ticks, evaluator state, peer decisions, peer scores,
and peer account state are unavailable.

## Selection And Champion Continuity

When a `TradingPromotion` exists, its active TradingReview target is the champion role. Its default
continuous paper TradingRun remains untouched. The comparison coordinator creates a second,
qualification-purpose TradingRun for the same frozen CandidateVersion.

When no promotion exists, the comparison is `bootstrap`: the incumbent role is an explicit admitted
candidate selected before the window, both sides must qualify, and the winner may become the first
champion only after the same confirmation policy. Bootstrap selection is not inferred from paper
outcomes and is recorded in the comparison commitment.

Research, challenger, coordinator, or qualification-run failure never stops, replaces, or mutates
the champion's default continuous session. Replacement occurs only through an eligible verdict and
the existing explicit `TradingPromotion` transition.

## Information Barrier

Before adjudication, ResearchWorkers may see that a bounded comparison exists, but not candidate
roles, scores, failures, observations, tick data, commitment digests, or partial qualification
status. Operator projections may show identities, lifecycle, bounds, and health needed for recovery,
but score and verdict fields remain sealed.

After closure, the adjudicator writes one verdict. Only then may bounded aggregate findings and
lineage enter later CandidateArena context. The closed evidence cannot be reused as qualification
for a descendant candidate.

## Adjudication

Adjudication is external to both candidates and ResearchWorkers. It verifies, in order:

1. canonical pair and side commitment digests and immutable identity refs;
2. distinct isolated TradingRuns with equal policy, market source, initial account, and resource
   bounds;
3. start skew, elapsed time, observation count, and maximum-bound compliance;
4. contiguous comparison ticks referenced by both sides with byte-equivalent market evidence;
5. candidate-authored values did not count and Gateway/Ledger/account score chains are complete;
6. both evaluations independently pass qualification;
7. the precommitted net-revenue lift rule;
8. non-overlapping prior confirmations under the same policy version.

Any failure through step 6 yields `incomparable` or `invalidated`, never a favorable economic
verdict. Profit cannot offset a hard-constraint failure.

## Recovery And Bounds

- At most one active pair exists for the same champion/challenger CandidateVersion tuple.
- One pair owns exactly two qualification TradingRuns and never owns the champion default run.
- Maximum observations, elapsed time, start skew, retries, and provider requests are committed.
- Restart scans prepared/running pair records, reloads the original commitments, and either resumes
  both from their last common tick or closes the pair as incomparable.
- If only one side completed a tick before a crash, recovery does not reuse that partial tick as a
  common observation; it closes or retries under the precommitted policy.
- Orphaned prepared records are inert until the complete graph verifies and may be garbage-collected
  only after durable audit evidence.

## Error Handling

- Failure before full graph verification starts no runner and creates no market or Ledger evidence.
- Failure after one qualification runner starts stops both qualification runners, preserves all
  records, and leaves the champion default session alone.
- One candidate crash, malformed event, risk violation, provider bypass, private/live attempt,
  commitment drift, missing tick, or evidence mismatch vetoes improvement.
- Market or platform failure is `incomparable`; it is not attributed as strategy loss or favorable
  research efficiency.
- No raw provider config, secret, private account data, or peer evidence enters errors.

## Acceptance Evidence

1. One CandidateVersion can own a default continuous TradingRun and a distinct qualification
   TradingRun without projection or lifecycle cross-talk.
2. Both qualification commitments and the pair commitment persist and verify before any provider,
   sandbox, market, runner, Gateway, Ledger, or observation effect.
3. Public commands still cannot select `qualification` or a comparison ID.
4. Each comparison tick causes exactly one underlying market/public-execution read and both paired
   observations reference the same immutable tick.
5. Different candidate decision cadence and no-order behavior do not break comparability or force
   equal trades.
6. Candidate or ResearchWorker contexts cannot read active pair outcomes or peer evidence.
7. A side failure, restart, or commitment mutation cannot produce `challenger_improved` and cannot
   stop the champion default session.
8. Net-revenue lift alone cannot override qualification, risk, evidence, cost, authority, resource,
   start-skew, or common-tick failures.
9. Promotion remains blocked until the verdict is promotion eligible under non-overlapping
   confirmation policy.
10. Restart reproduces the same pair identity, account lineage, tick chain, verdict, and authority
    without reconstructing commitments from current mutable state.

## Non-Goals

- Live exchange or private-account authority.
- Universal statistical claims from one market regime or one comparison.
- Strategy-specific trade cadence, indicators, prompts, models, or tools.
- Equal trade counts or forced TradingSystem decisions.
- Replacing the selected champion before an explicit eligible promotion.
- Redesigning Desktop, Web, TUI, or CLI.
- Long-running ResearchWorker lifecycle and adaptive budget allocation beyond consuming a closed
  comparison finding.

## Implementation Decomposition

This design is intentionally split into two independently reviewable frontiers:

1. **Multi-run paper sessions:** allow multiple isolated TradingRuns per CandidateVersion, extract
   internal prepare/activate/observe/stop lifecycle, and preserve default-session compatibility.
2. **Prospective comparison:** the inert pair commitment graph and internal prepare/read-only
   coordinator are implemented. Shared tick persistence, market view, activation authority,
   sealing, adjudication, confirmation, promotion integration, and recovery remain pending.

The second frontier must not begin by weakening the first frontier's identity or authority checks.
