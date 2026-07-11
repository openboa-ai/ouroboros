# Paired Paper Comparison Qualification Design

**Date:** 2026-07-12
**Status:** Implemented and repository-verified internally; not production-composed
**Depends on:** Internally proven bounded paper comparison window through sequence 3

## Goal

Decide whether one cleanly stopped champion/challenger paper comparison is complete and trustworthy
enough to enter later score adjudication. Qualification must combine the exact shared-window graph,
both canonical side qualifications, and run-specific Ledger completeness without comparing scores,
selecting a winner, releasing sealed evidence, or granting promotion authority.

This is an evidence-quality decision only. `qualified` means both frozen sides survived the same
prospective comparison protocol and their evidence can be handed to a separate adjudicator. It does
not mean the challenger is better, statistically significant, confirmed, released, promoted, or
live-capable.

## Implementation Evidence

- A pure decision returns stable ordered blockers for window, minimum, canonical-side, exact-run,
  chain-completeness, and ref-set failures without mutating input.
- The Store-backed service calls the existing window reader first, rejects readback drift, invokes
  canonical side qualification with frozen minimums, and performs no writes.
- A real LocalStore/session sequence-3 window qualifies after orderly `handoff_cleanup`; replay and
  restart-rematerialized assessment are deeply equal and preserve record counts.
- Default-run substitution, extra and partial chains, hidden or duplicate refs, side evidence
  drift, incomplete checkpoints, and unsupported/cross-run refs are covered by stable blockers or
  graph rejection.
- No app, controller, command, operator read model, adjudicator, release, promotion, private, or
  live composition was added.

## Selected Architecture

Add one application-only `PaperTradingComparisonQualificationService` with no new durable record:

1. Reuse `LocalStorePaperTradingComparisonWindowStateReader` as the fail-closed shared-window graph
   gate.
2. Load the exact comparison commitment, activation attempt, final activation outcome, checkpoint
   attempts/outcomes, side commitments, stopped evaluations, observations, and each side's exact
   TradingRun projection through `OuroborosStorePort`.
3. Delegate each side's evidence-quality decision to the existing canonical
   `qualifyPaperTradingEvaluation`, overriding only minimum count and elapsed policy from the frozen
   comparison policy.
4. Independently compare every checkpoint-declared Ledger ref with the complete Ledger chains in
   that exact additional TradingRun.
5. Return one read-only paired qualification result with side results and stable blockers.

The service performs no writes. Deterministic recomputation from immutable records is sufficient at
this boundary; a durable decision belongs with the later adjudication/release protocol that will
bind exact input digests.

## Approaches Rejected

### Persist a qualification verdict now

A new record would need final naming, digest, release, supersession, and adjudication references
before those contracts exist. Persisting a partial verdict would create migration pressure and risk
being mistaken for winner or promotion authority.

### Extend the window driver

The driver owns bounded execution transitions. Making terminal stop also qualify evidence would mix
runtime ownership with independent evaluation authority and make cleanup success look like evidence
quality.

### Qualify both side evaluations without the pair graph

Two independently qualified evaluations do not prove common ticks, acknowledgement lineage, atomic
paired checkpoints, or equal prospective conditions. The pair graph must be validated first.

## Input And Result

```ts
interface PaperTradingComparisonQualificationInput {
  activationId: string;
  activationAttemptId: string;
}

type PaperTradingComparisonQualificationStatus =
  | "qualified"
  | "not_qualified";

type PaperTradingComparisonQualificationReason =
  | "comparison_window_not_stopped_cleanly"
  | "comparison_window_not_completed_normally"
  | "comparison_checkpoint_incomplete"
  | "comparison_minimum_observation_count_not_met"
  | "comparison_minimum_elapsed_not_met"
  | "champion_not_qualified"
  | "challenger_not_qualified"
  | "champion_ledger_incomplete"
  | "challenger_ledger_incomplete"
  | "champion_ledger_lineage_mismatch"
  | "challenger_ledger_lineage_mismatch";

interface PaperTradingComparisonQualificationResult {
  comparison_id: string;
  activation_id: string;
  activation_attempt_id: string;
  qualification_status: PaperTradingComparisonQualificationStatus;
  qualification_reasons: PaperTradingComparisonQualificationReason[];
  checkpoint_count: number;
  champion: PaperTradingQualificationResult;
  challenger: PaperTradingQualificationResult;
  authority_status: "not_verdict";
}
```

Malformed input rejects with `invalid_paper_trading_comparison_qualification_input`. Missing,
corrupt, stale, or digest-inconsistent graph evidence rejects with
`paper_trading_comparison_qualification_graph_invalid`; corruption is not a normal blocker result.

## Shared Window Gate

The service first calls the Store-backed window reader for the exact activation and attempt. The
reader must reconstruct the full commitment, activation, contiguous ticks, checkpoint attempts and
outcomes, role-bound delivery/acknowledgement lineage, evaluations, observations, chronology, and
terminal successor state.

Qualification then requires:

- terminal `window_stopped` state;
- final activation outcome `stopped_cleanly` with `handoff_cleanup`;
- no incomplete checkpoint and no paired failed side;
- all checkpoints paired contiguously against the same tick sequence;
- no open runtime ownership and both exact TradingRuns/evaluations stopped;
- checkpoint count within the frozen maximum; minimum count/time are evaluated independently below.

The pure decision receives `checkpointOutcomesComplete` explicitly. This keeps an incomplete
terminal attempt distinct from a below-minimum but otherwise clean paired window instead of trying
to infer both states from one phase string.

An elapsed-bound window may contain fewer than the maximum observation count. That is valid only if
both sides still satisfy the frozen minimum qualification policy. Restart cleanup, cleanup-required,
candidate-failed, open, and partially persisted windows are not qualified.

Pair elapsed time is `latest shared tick observed_at - activationAttempt.attempted_at`, never the
evaluation preparation timestamp. Require this shared elapsed value and paired checkpoint count to
meet the frozen comparison minimums. This prevents inert preparation or activation-queue delay from
being counted as prospective market exposure.

## Canonical Side Qualification

For each role, load its exact `PaperTradingEvaluationCommitment`, stopped
`PaperTradingEvaluation`, and observations by the refs bound in the activation attempt. Call
`qualifyPaperTradingEvaluation` with:

- `runnerActive: false`, because a qualified comparison is stopped;
- `minObservationCount` from `comparison_policy.minimum_observation_count`;
- `minElapsedMs` from `comparison_policy.minimum_elapsed_ms`;
- the canonical failed-observation, market-data, public-fill, commitment, account, and score checks.

Both results must be `qualified`. Preserve the complete side results in the pair result so callers
can inspect evidence-window counts and canonical reasons without inventing a second quality model.

## Exact TradingRun Ledger Gate

Candidate-level aggregate Ledger state is forbidden. For each role, call
`getCandidateForTradingRun` with the additional qualification TradingRun bound in the activation
attempt and require the returned `trading_run.ref.id` to match exactly.

Build the expected Ledger ref set from every paired checkpoint outcome for that role. Build the
actual ref set from every chain in the exact run projection:

- `order_request.order_request_id`;
- `gateway_result.gateway_result_id`;
- `execution_result.execution_result_id`.

Every actual chain must be complete and internally role/run-bound by the Store projection. The
expected and actual ref sets must be exactly equal: no missing, extra, duplicate, or cross-run
records. A side with only acknowledged silence is valid when both sets are empty and its observations
contain no Ledger refs. An order-bearing observation with no complete chain is blocked.

LocalStore represents a zero-chain Ledger with `has_activity=false`, `chain_count=0`, null latest
records, and aggregate `chain_complete=false` because there is no chain to complete. That exact
projection is valid only against an empty expected ref set. A missing projection or Ledger remains
incomplete; any non-empty chain still must carry `chain_complete=true` and complete internal refs.

This gate proves evidence completeness only. Gateway rejection and paper execution failure remain
valid complete chains when their canonical records say so; qualification does not rewrite their
economic meaning.

## Information And Authority Boundary

The result may expose the existing per-side qualification windows but does not compute or return
score lift, winner, confidence, p-value, rank, confirmation count, release state, or promotion
eligibility. It carries `authority_status: "not_verdict"` and is not an `OuroborosCommand`, operator
read model, CandidateArena allocation signal, Finding, Lineage, or TradingPromotion input yet.

Provider output, candidate self-reports, and ResearchWorker claims cannot affect the result. Only
the Store-backed comparison, Gateway, fake-account, Observation, and Ledger evidence participates.

## Error Handling And Replay

- Invalid IDs reject before Store reads.
- Reader or Store graph errors retain a stable cause code and fail closed.
- Expected closed-window quality blockers return `not_qualified`; they do not throw.
- Repeated assessment over unchanged records returns a deeply equal result and performs no writes.
- Any later record drift causes graph rejection or a qualification blocker; it never silently
  changes a prior result into authority.

## Acceptance

1. A cleanly stopped three-checkpoint shared window with two canonically qualified sides and exact
   empty no-order Ledgers returns `qualified`.
2. Order-bearing sides qualify only when every checkpoint Ledger ref resolves to one complete chain
   in the exact additional TradingRun.
3. Candidate-level default-run or aggregate Ledger evidence cannot satisfy the gate.
4. Missing, extra, duplicate, cross-role, or cross-run Ledger refs return stable side blockers.
5. Running, restart-cleaned, cleanup-required, incomplete, failed-side, below-minimum, or integrity-
   failed windows return `not_qualified` or reject when the graph itself is corrupt.
6. Both existing canonical side qualification results are preserved exactly.
7. Repeated assessment is deterministic and write-free.
8. No score comparison, winner, confirmation, release, Finding, Lineage, promotion, private access,
   public command, or live authority is introduced.
9. Focused tests, typechecks, repository guards, and the full suite pass.

## Out Of Scope

- challenger-versus-champion score lift or statistical adjudication;
- repeated non-overlapping confirmation windows;
- durable verdict, evidence release, Finding, or Lineage records;
- champion replacement or TradingPromotion integration;
- production runner/controller/command composition;
- process-resume, private exchange, credentials, or live trading.

## Next Frontier

After paired qualification is proven, define a separately persisted external comparison verdict
that compares qualified net revenue after costs under the frozen policy, binds exact input digests,
requires non-overlapping confirmations, and still grants no live authority by itself.
