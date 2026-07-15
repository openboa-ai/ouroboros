# Paper Trading Comparison Verdict Design

**Date:** 2026-07-12
**Status:** Implemented and repository-verified internally
**Depends on:** Repository-verified paired paper comparison qualification

## Goal

Persist one candidate-external, deterministic terminal decision for every settled paper comparison
window. A verdict must preserve both positive and negative scientific evidence, bind the exact
qualified or ineligible input graph, release the candidate-version pair for a later precommitted
window, and grant no confirmation, promotion, private, or live authority.

The primary metric remains the frozen `net_revenue_usdt` difference after fees, slippage, and
funding. A qualified challenger is `challenger_improved` only when its lift is strictly positive and
meets `comparison_policy.minimum_net_revenue_lift_usdt`. Equal, regressed, or below-threshold
qualified windows are `challenger_not_improved`. A settled but unqualified window is
`comparison_ineligible` and carries no metric decision.

## Scientific-Control Decision

Implement one single-window verdict now and a separate precommitted confirmation campaign later.
Do not accumulate successful verdicts after observing their outcomes. Starting a confirmation
chain from a favorable result would allow adaptive selection of later windows and recreate the
overfitting this protocol is meant to prevent.

Every verdict therefore has:

- `confirmation_disposition: "requires_precommitted_campaign"` for an improved result, otherwise
  `"not_applicable"`;
- `promotion_eligibility: "not_eligible"` for every outcome;
- `release_status: "sealed"` until a later Finding/Lineage release protocol exists;
- `evaluation_authority: "external_to_trading_systems"`;
- `authority_status: "not_live"`.

The next frontier must create a campaign before any campaign-bound market outcome exists, reserve
the required number of non-overlapping windows, and count every reserved terminal result. Verdicts
created before such a campaign are useful research evidence but can never be retroactively selected
as promotion confirmation.

## Approaches Rejected

### Post-hoc cumulative verdict chain

Linking only favorable prior verdicts is operationally simple but lets the system inspect one
result before deciding whether it belongs to the confirmation set. This is adaptive
cherry-picking and is rejected.

### One delayed batch verdict

Waiting for all windows before persisting anything hides terminal negative and ineligible evidence,
weakens crash recovery, and leaves the candidate pair permanently occupied during long campaigns.
Each settled window needs its own append-only verdict.

### Reuse TradingPromotion

`TradingPromotion` changes product review state. A comparison verdict is external evaluation
evidence and may be negative or ineligible. Reusing promotion would collapse evidence, decision,
and authority boundaries.

## Taxonomy Decision

### Goal and context read

The maintained sources are `AGENTS.md`, `docs/candidate-arena-evaluation-protocol.md`,
`docs/api-command-contract.md`, `docs/naming-taxonomy.md`, the bounded-window design, and the paired
qualification design. Existing operator code already requires a promotion-eligible external paper
comparison verdict but deliberately keeps promotion closed.

### Vocabulary sources considered

- `verdict` is the repository's existing conventional noun for an external evidence decision.
- `PaperTradingComparison` preserves the existing candidate-pair and prospective-paper scope.
- `confirmation campaign` follows experimental pre-registration language and keeps confirmation
  policy separate from one observed result.
- `TradingPromotion` remains the GitHub-like product state transition after evidence, not the
  evidence itself.

### Naming problem and concept axes

The concept has these axes: paper comparison domain, one-window lifecycle, external-to-candidate
evaluation authority, sealed release state, confirmation applicability, and promotion authority.
Only the stable domain noun belongs in the type name; the volatile axes belong in fields.

### Canonical vocabulary

- `PaperTradingComparisonVerdict`: one append-only terminal external evaluation of one exact paper
  comparison activation attempt.
- `PaperTradingComparisonVerdictSide`: exact frozen side identity, evaluation lineage, and scored
  value used by that verdict.
- `PaperTradingComparisonVerdictService`: application service that recomputes qualification,
  constructs the verdict, and asks the Store to persist it.
- Future, not implemented here: `PaperTradingComparisonConfirmationCampaign`.

No alias is introduced. Avoid extending `winner`, `promotion verdict`, `comparison result`, or
`qualified candidate` as substitute durable nouns. This is an additive internal schema with no
migration because no persisted verdict family exists. Writeback is required in canonical taxonomy,
protocol, API contract, tests, and this design.

The existing paired qualification status, reason, and result interfaces move from application-only
type declarations into `@ouroboros/domain`; the application module re-exports those exact types for
source compatibility. This is type ownership correction, not a persisted alias or schema migration.
Domain also owns the canonical qualification-result digest input so LocalStore never imports the
application layer.

## Durable Record

```ts
type PaperTradingComparisonVerdictOutcome =
  | "challenger_improved"
  | "challenger_not_improved"
  | "comparison_ineligible";

interface PaperTradingComparisonVerdictSide {
  role: "champion" | "challenger";
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  trading_run_ref: Ref;
  paper_trading_evaluation_commitment_ref: Ref;
  paper_trading_evaluation_commitment_record_digest: string;
  paper_trading_evaluation_ref: Ref;
  paper_trading_evaluation_record_digest: string;
  paper_trading_observation_chain_digest: string;
  net_revenue_usdt?: number;
  cost_usdt?: number;
}

interface PaperTradingComparisonVerdictMetric {
  metric_kind: "net_revenue_usdt";
  champion_value_usdt: number;
  challenger_value_usdt: number;
  observed_lift_usdt: number;
  minimum_lift_usdt: number;
}

interface PaperTradingComparisonVerdictRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_verdict";
  paper_trading_comparison_verdict_id: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  final_activation_outcome_ref: Ref;
  final_activation_outcome_digest: string;
  latest_tick_ref: Ref;
  latest_tick_digest: string;
  checkpoint_outcome_refs: Ref[];
  checkpoint_outcome_digests: string[];
  pair_qualification: PaperTradingComparisonQualificationResult;
  pair_qualification_digest: string;
  champion: PaperTradingComparisonVerdictSide;
  challenger: PaperTradingComparisonVerdictSide;
  metric?: PaperTradingComparisonVerdictMetric;
  verdict_outcome: PaperTradingComparisonVerdictOutcome;
  window_started_at: string;
  window_ended_at: string;
  evaluator_policy_version: "paper-comparison-verdict-v1";
  evaluation_authority: "external_to_trading_systems";
  confirmation_disposition: "requires_precommitted_campaign" | "not_applicable";
  promotion_eligibility: "not_eligible";
  release_status: "sealed";
  next_action:
    | "precommit_confirmation_campaign"
    | "return_to_candidate_arena"
    | "repair_evidence_or_rerun_comparison";
  evaluated_at: string;
  verdict_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}
```

Qualified verdicts require `pair_qualification.qualification_status === "qualified"`, both optional
side score fields, and `metric`. Ineligible verdicts require a `not_qualified` snapshot and forbid
all score fields and `metric`, preventing unqualified sealed economics from leaking through a
terminal closure record. Checkpoint refs are ordered by sequence and arrays must have equal length.

## Pure Decision

Add a pure application decision that consumes only:

- the exact paired qualification result;
- frozen minimum lift;
- champion and challenger `latest_score` from their exact stopped evaluations.

It returns the outcome, optional metric, confirmation disposition, and next action. Round all
reported numeric values to six decimal places using the same paper score precision. Input mutation,
non-finite values, a `qualified` result with non-qualified sides, or a `not_qualified` result with
score output rejects as invalid decision input.

For a qualified result:

```text
lift = challenger.net_revenue_usdt - champion.net_revenue_usdt
challenger_improved = lift > 0 && lift >= frozen minimum lift
```

The verdict does not inspect model output, research claims, rank, future windows, or prior verdict
outcomes.

## Application Service

`PaperTradingComparisonVerdictService.evaluate` accepts exact activation and attempt IDs. It:

1. calls `PaperTradingComparisonQualificationService.assess` first;
2. reloads the exact commitment, activation attempt, final outcome, ticks, checkpoint outcomes,
   side commitments/evaluations/observations, and exact TradingRun projections;
3. requires a settled `stopped_cleanly` activation outcome and stopped exact evaluations;
4. rejects running, open, `cleanup_required`, recovery-required, or corrupt graphs without a
   verdict;
5. creates an ineligible verdict for settled unqualified evidence, with no economic fields;
6. creates an improved or not-improved verdict only for a fully qualified pair;
7. persists through `OuroborosStorePort.recordPaperTradingComparisonVerdict`;
8. returns exact replay for an unchanged graph.

The service clock owns the initial `evaluated_at`. The deterministic verdict ID is derived from the
comparison commitment and activation attempt, so one settled window has at most one verdict
independent of caller retry keys. On replay, the service reassesses qualification, reloads exact
evidence, and reuses the persisted `evaluated_at` to reproduce the sealed record even when the clock
has advanced.

`window_started_at` is the first shared tick's `observed_at`, and `window_ended_at` is the latest
tick's `observed_at`. This market-evidence interval is distinct from paired qualification's elapsed
minimum, which remains activation-attempt time through the latest tick.

## Store Authority

LocalStore validates runtime shape, canonical digest, exact linked record IDs/digests, ordered
checkpoint closure, side identity, stopped evaluation state, and metric arithmetic before writing.
It allows exact replay and rejects any changed record under the same verdict ID. Missing or corrupt
evidence cannot be closed by a verdict.

`reservePaperTradingComparisonPreparation` now treats only a preparation whose comparison has no
terminal verdict as active. Any exact persisted verdict, including `comparison_ineligible` or
`challenger_not_improved`, releases the unordered candidate-version pair for a new precommitted
window. Release permits another experiment; it does not count confirmation or select a winner.

## Information Boundary

The verdict record remains sealed and is not added to CandidateArena context, Findings, Lineage,
operator read models, public commands, or TradingPromotion. Candidates and ResearchWorkers cannot
read active-window results through this service. A later release protocol decides which terminal
negative or positive facts become causal research memory.

No verdict outcome carries credentials, private exchange access, direct-order authority, or live
authority. `challenger_improved` is one prospective window result, not statistical significance,
regime robustness, champion replacement, or promotion eligibility.

## Failure And Replay

- Invalid IDs reject before qualification or Store reads.
- Qualification/graph corruption retains a stable cause code and writes nothing.
- An unsettled window rejects with `paper_trading_comparison_verdict_not_terminal`.
- A settled unqualified graph persists `comparison_ineligible`; it is not thrown away.
- Exact retries return the same verdict without duplicate writes.
- A changed input under the same deterministic verdict ID conflicts.
- Persistence failure leaves the prior comparison evidence intact and the pair active.

## Implementation Evidence

- Domain owns the qualification snapshot, verdict schema, runtime shape, and canonical digests.
- Application owns the pure net-revenue decision and the qualification-first exact-evidence verdict
  service.
- LocalStore persists one append-only verdict per comparison, validates terminal graph identity,
  and releases only verdict-terminated pairs.
- The real sequence-3 comparison proves zero-score `challenger_not_improved`, exact retry, restart
  replay after clock advance, and a fresh inert same-pair comparison with no new provider, sandbox,
  market, decision, Ledger, observation, or score effect.
- No app, controller, operator projection, Finding, Lineage, TradingPromotion, private, or live
  composition is added.

## Acceptance

1. A qualified positive-lift window persists `challenger_improved` only when lift is positive and
   meets the frozen threshold.
2. Equal, negative, and below-threshold qualified windows persist `challenger_not_improved`.
3. A settled unqualified window persists `comparison_ineligible` without metric or side score
   fields.
4. Every record binds exact comparison, activation, final outcome, tick, checkpoint, qualification,
   side evaluation, observation-chain, and TradingRun evidence digests.
5. Runtime shape and Store validation reject malformed arithmetic, reordered/missing refs,
   unstopped evidence, digest drift, duplicate verdicts, and changed replay.
6. Exact replay is idempotent and restart-stable.
7. A persisted terminal verdict releases the candidate-version pair for a new comparison; no
   verdict leaves the pair occupied.
8. Positive, negative, and ineligible records remain sealed and promotion-ineligible.
9. No post-hoc confirmation counting, winner selection, Finding/Lineage release, TradingPromotion,
   public command, private access, or live authority is added.
10. Focused tests, workspace typechecks, repository guards, and the full suite pass.

## Out Of Scope

- precommitted multi-window confirmation campaign and campaign-bound comparison schema;
- statistical significance, confidence intervals, regime stratification, or multiple testing;
- verdict release into Finding, Lineage, leaderboard, or ResearchWorker context;
- champion replacement, TradingPromotion, operator command/read-model composition;
- process-resume, private exchange, credentials, or live trading.

## Next Frontier

Precommit a `PaperTradingComparisonConfirmationCampaign` before its first campaign window starts.
It must bind exact champion/challenger artifacts and policy, reserve every required window, enforce
non-overlap, count all terminal verdicts rather than selected successes, and only then produce
promotion-eligible external evidence without granting live authority.
