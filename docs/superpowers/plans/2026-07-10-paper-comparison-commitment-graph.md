# Paper Comparison Commitment Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and verify an inert, append-only champion/challenger paper qualification commitment graph without granting runtime or public-command authority.

**Architecture:** Add an append-only `PaperTradingComparisonPreparationRecord` that freezes the complete server-timestamped comparison intent and full-record digests for each CandidateVersion, SystemCode, admission decision, and bound champion promotion before either side exists, then extend `OuroborosStorePort` and `LocalStore` with one comparison-evidence transaction for atomic preparation reservation, pair graph validation/append, and conflicting authority/side-writer exclusion. Move qualification policy and evidence integrity into one pure domain decision; application and LocalStore independently verify commitment SHA-256 and supply that result to the same decision. Repair `PaperTradingSessionService.prepare` so only the exact deterministic commitment-only partial state is retryable; an internal `PaperTradingComparisonCoordinator` may use that prepare-only capability before pair persistence, but all post-pair reload and verification is read-only StorePort graph loading with no provider, sandbox, market, runner, Gateway, Ledger, observation, repair, invalidation, or replacement effects.

**Tech Stack:** TypeScript 5.9, Vitest 4, Node.js `crypto`, filesystem-backed `LocalStore`, application ports, `PaperTradingSessionService`

## Global Constraints

- This design adds a paired qualification protocol. It does not hardcode a strategy, model, provider,
  tool, decision cadence, or trade count. It freezes only the external authority, evidence, market,
  account, cost, risk, resource, and adjudication envelope.
- `CandidateVersion.runtime_ref` remains the compatibility/default continuous paper run.
- Any additional `TradingRunRecord` may reference the same candidate and candidate version when its
  SystemCode, authority, placement, hands environment, and memory boundary are independently
  recorded.
- Each qualification TradingRun owns a distinct sandbox, provider session, fake account, event cursor,
  run-control chain, and lifecycle. It reuses the frozen CandidateVersion and SystemCode bytes, not
  runtime state from another session.
- Standalone qualification preparation may resolve and freeze executable artifact identity, then
  persist the commitment and `not_started` evaluation, but remains runtime-inert.
- Both side commitments must already exist, have `evidence_purpose: "qualification"`, use
  `sealed_until_adjudication`, resolve to distinct TradingRuns, and match the pair's market and paper
  policy identities.
- An idempotent retry may repair a partially prepared set, but no provider, sandbox, market read, or
  runner may start until the complete set verifies.
- The append-only comparison preparation is persisted before either side, freezes both roles and
  CandidateVersions plus the complete policy envelope, and remains active until a later lifecycle
  record closes it.
- Comparison `committed_at` is assigned by the coordinator's server-owned clock. Caller payloads and
  public commands cannot supply, backdate, or future-date it; retries reuse the persisted value.
- Both sides bind the exact CandidateVersion ref/full-record digest, SystemCode ref/full-record
  digest/artifact digest, and admitted CandidateAdmissionDecision ref/full-record digest. Store and
  coordinator independently recompute all three digests before preparation and on replay; same-ID
  content drift fails before side writes. The mutable candidate active projection is not authority.
- Admission runnable handoff, `not_live` authority, CandidateVersion SystemCode identity, and
  artifact digest validate before preparation; duplicate, quarantined, missing, or mismatched
  admission fails with zero writes.
- Bootstrap preparation requires no current `TradingPromotion`; champion challenge binds the exact
  current promotion ref plus its full-record digest, champion refs, exact referenced stopped
  `PaperTradingEvaluation` ref/full-record digest, exact qualification commitment ref/full-record
  digest, and canonical ordered full-record observation-chain digest. Replay and reload recompute
  the complete closure without silently reselecting a newer promotion or evidence chain.
- Once preparation reserves that champion-promotion evidence closure, the LocalStore comparison-
  evidence transaction rejects non-noop writes to the exact bound qualification commitment,
  evaluation, or observation chain before and after side creation. Pair append independently
  reloads and revalidates the same frozen closure.
- Qualification status and reasons come from one pure domain-owned decision. Application preserves
  its existing qualification API by delegation; LocalStore calls the same decision directly.
  Application and LocalStore each independently verify the commitment SHA-256 and supply that
  boolean to domain, which has no `node:crypto` or application dependency.
- Both qualification side commitments require `provider_identity.qualification_eligible === true`,
  no `ineligibility_reason`, exact ISO side commitment time at or after preparation, and equal full
  `window_policy` values including `eligibility_policy_version`.
- `PaperTradingCommandService.start` remains the public adapter and always requests
  `research_feedback` on the default TradingRun. It does not accept evidence purpose or comparison
  IDs from payloads.
- At most one active pair exists for the same unordered set of champion/challenger CandidateVersions;
  swapping the roles does not create a second active pair.
- The filesystem `LocalStore` adapter is a single-process composition and atomically serializes the
  preparation reservation's reads/currentness checks/append with every CandidateVersion,
  SystemCode, CandidateAdmissionDecision, and TradingPromotion writer. The same transaction
  serializes pair graph validation/append with run, commitment, evaluation, observation, Ledger,
  run-control, and sandbox writers; pair-bound side mutation is rejected while the inert pair is
  active. Any future multi-process StorePort adapter must provide equivalent frozen-evidence,
  graph-snapshot, and transactional unordered-pair guarantees before it can compose the coordinator.
- One pair owns exactly two qualification TradingRuns and never owns the champion default run.
- Failure before full graph verification starts no runner and creates no market or Ledger evidence.
- No raw provider config, secret, private account data, or peer evidence enters errors.
- This frontier adds no comparison tick, `ComparisonMarketDataView`, qualification activation,
  paired observation, verdict or adjudication, confirmations, promotion integration, or pair recovery.
- No provider, sandbox, market, runner, Gateway, Ledger, or observation effect is permitted until a
  later plan supplies verified pair authority.
- After a pair exists, reload and verification are read-only. Missing or corrupt side records fail
  closed without calling `PaperTradingSessionService.prepare`, repairing, invalidating, or replacing
  any commitment, evaluation, observation, or run-control record.
- Public command and qualification activation guards remain unchanged.

---

## File Map

- Modify `packages/domain/src/index.ts`: own canonical candidate-side, preparation, runtime-side,
  policy, commitment, one pure paper qualification decision, unordered pair-key,
  persistence-shaped exact-record and observation-chain digest inputs, side commitment/evaluation
  full-record digest inputs, and comparison digest-input contracts while preserving the existing
  evaluation-commitment self-digest encoder unchanged.
- Create `packages/domain/src/paper-trading-comparison-commitment.test.ts`: prove canonical
  CandidateVersion, SystemCode, admission, promotion, preparation, and pair digest behavior,
  unordered pair identity, total runtime predicates, and every domain qualification boundary.
- Modify `packages/application/src/trading/paper/qualification.ts`: preserve its public API while
  delegating evidence integrity and qualification to the domain-owned decision and supplying the
  independently computed commitment self-digest result.
- Create `packages/application/src/trading/paper/qualification.test.ts`: prove wrapper/domain
  decision parity and compatibility of `paperTradingEvidenceIntegrityReasons`.
- Modify `packages/application/src/ports/store.ts`: expose atomic preparation reservation and
  append/get/list methods for comparison commitments and exact referenced records.
- Modify `packages/local-store/src/index.ts`: own the comparison-evidence transaction, append-only
  preparation/pair persistence, total runtime shape checks, independent digest verification,
  preparation-bound graph validation, and active unordered-pair exclusion.
- Modify `packages/local-store/test/local-store.test.ts`: prove preparation replay/conflicts, pair binding, reload, malformed graph rejection, duplicate executable rejection, default-run rejection, and role-reversed active-pair conflict.
- Modify `packages/application/src/trading/paper/session-service.ts`: repair only an exact
  deterministic commitment-only partial qualification preparation without changing activation guards.
- Modify `packages/application/src/trading/paper/session-service.test.ts`: inject an evaluation-write
  failure and prove exact inert retry repair plus alternate-chain rejection.
- Consume unchanged `packages/application/src/trading/paper/commitment.ts`: use its existing exported `paperTradingMarketDataConfigurationDigest`; this plan makes no edit there.
- Create `packages/application/src/trading/paper/comparison-coordinator.ts`: own server-timestamped preparation anchoring, deterministic pre-pair side preparation, read-only post-pair reload, and complete graph verification.
- Create `packages/application/src/trading/paper/comparison-coordinator.test.ts`: prove pre-side exact-content anchoring, policy/content-drift rejection after interruption, two-sided repair, exact replay, causal role-reversed active-pair rejection, read-only reload failure, and zero runtime effects.
- Verify unchanged `apps/runtime/test/paper-trading-evaluation-commitment.test.ts`: retain the public payload guard without adding a route, command, or runtime composition.
- Modify `docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md`: record the implemented preparation anchor and still-pending shared-tick/verdict boundary.
- Modify `docs/candidate-arena-evaluation-protocol.md`: record server-owned preparation time and inert comparison-graph authority.
- Modify `docs/api-command-contract.md`: record that public commands cannot set comparison intent, evidence purpose, comparison ID, or comparison time.

### Task 1: Canonical Comparison Preparation And Commitment Domain Contract

**Files:**
- Modify: `packages/domain/src/index.ts:1-13,1684-1865,3264-3285`
- Create: `packages/domain/src/paper-trading-comparison-commitment.test.ts`
- Modify: `packages/application/src/trading/paper/qualification.ts:1-416`
- Create: `packages/application/src/trading/paper/qualification.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonCandidateSide`.
- Produces: `PaperTradingComparisonChampionSelection`.
- Produces: `PaperTradingComparisonPreparationRecord`.
- Produces: `PaperTradingComparisonSide`.
- Produces: `PaperTradingComparisonPolicy`.
- Produces: `PaperTradingComparisonCommitmentRecord`.
- Produces: `paperTradingComparisonCandidateVersionPairKey(leftId, rightId): string`.
- Produces: `paperTradingComparisonPersistedRecordDigestInput(value): string`.
- Produces: `paperTradingComparisonCandidateVersionDigestInput(record): string`.
- Produces: `paperTradingComparisonSystemCodeRecordDigestInput(record): string`.
- Produces: `paperTradingComparisonAdmissionDecisionDigestInput(record): string`.
- Produces: `paperTradingComparisonTradingPromotionDigestInput(record): string`.
- Produces: `paperTradingComparisonEvaluationCommitmentRecordDigestInput(record): string`.
- Produces: `paperTradingComparisonEvaluationRecordDigestInput(record): string`.
- Produces: `paperTradingComparisonObservationChainDigestInput(records): string`.
- Produces: `paperTradingComparisonPreparationDigestInput(record): string`.
- Produces: `paperTradingComparisonCommitmentDigestInput(record): string`.
- Produces: `paperTradingComparisonRefsEqual(left, right): boolean`.
- Produces: `paperTradingComparisonTradingPromotionHasRuntimeShape(value): boolean`.
- Produces: `paperTradingComparisonPolicyHasRuntimeShape(value): boolean`.
- Produces: `paperTradingComparisonChampionSelectionHasRuntimeShape(value, mode): boolean`.
- Produces: `paperTradingComparisonCandidateSideHasRuntimeShape(value, role): boolean`.
- Produces: `paperTradingComparisonSideHasRuntimeShape(value, role): boolean`.
- Produces: `paperTradingComparisonPreparationHasRuntimeShape(value): boolean`.
- Produces: `paperTradingComparisonCommitmentHasRuntimeShape(value): boolean`.
- Produces: `PaperTradingQualificationPolicy`,
  `PaperTradingQualificationDecisionInput`, and `PaperTradingQualificationResult`.
- Produces: `DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY`.
- Produces: `paperTradingEvidenceIntegrityReasons(input): PaperTradingQualificationReason[]` in
  domain, with application compatibility wrapper unchanged.
- Produces: `decidePaperTradingQualification(input): PaperTradingQualificationResult` as the one
  evidence-integrity/default-qualification authority decision used by application and LocalStore.
- Produces: `paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(value: unknown):
  value is PaperTradingComparisonStoppedQualificationClosure` as
  the total stopped commitment/evaluation/observation/SystemCode/admission/promotion runtime and
  causality predicate used before the qualification decision.
- Produces: `paperTradingComparisonSideRecordsHaveInertShape(records): boolean` shared by the
  LocalStore and coordinator graph validators.
- Produces: `PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT` and
  `PAPER_TRADING_COMPARISON_ZERO_SCORE` as the exact qualification baseline.
- Preserves: `paperTradingEvaluationCommitmentDigestInput(record): string` behavior.
- Preserves: application `PaperTradingQualificationPolicy`,
  `PaperTradingQualificationResult`, `DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY`,
  `paperTradingEvidenceIntegrityReasons`, and `qualifyPaperTradingEvaluation` public APIs.

- [ ] **Step 1: Write the failing canonical domain and qualification tests**

Create `packages/domain/src/paper-trading-comparison-commitment.test.ts` with a complete canonical record fixture and assertions that object key order and excluded record metadata do not change the digest input, while side identity and explicit policy do:

<!-- plan-typecheck:domain-test:start -->
```ts
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY,
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  decidePaperTradingQualification,
  paperTradingEvidenceIntegrityReasons,
  paperTradingComparisonAdmissionDecisionDigestInput,
  paperTradingComparisonCandidateVersionPairKey,
  paperTradingComparisonCandidateVersionDigestInput,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonPreparationDigestInput,
  paperTradingComparisonPreparationHasRuntimeShape,
  paperTradingComparisonPolicyHasRuntimeShape,
  paperTradingComparisonChampionSelectionHasRuntimeShape,
  paperTradingComparisonSideRecordsHaveInertShape,
  paperTradingComparisonStoppedQualificationClosureHasRuntimeShape,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingComparisonTradingPromotionHasRuntimeShape,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingEvaluationCommitmentDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateVersionRecord,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonPolicy,
  type PaperTradingEvaluationPolicyIdentity,
  type PaperTradingComparisonPreparationRecord,
  type PaperTradingComparisonStoppedQualificationClosure,
  type PaperTradingAccountSnapshot,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord,
  type PaperTradingQualificationDecisionInput,
  type SystemCodeRecord,
  type TradingPromotionRecord
} from "./index";

describe("PaperTradingComparisonCommitment", () => {
  it("returns false instead of throwing for malformed loaded side JSON", () => {
    const malformed = {
      candidate: { candidate_id: "candidate", runtime: {} },
      candidateVersion: { capability_package_refs: undefined },
      admission: {},
      run: {},
      systemCode: { entrypoint: undefined },
      commitment: { provider_identity: undefined },
      evaluation: { latest_score: undefined },
      observations: []
    };

    expect(() => paperTradingComparisonSideRecordsHaveInertShape(malformed)).not.toThrow();
    expect(paperTradingComparisonSideRecordsHaveInertShape(malformed)).toBe(false);
  });

  it.each([
    ["managed provider model object", (value: any) => {
      value.commitment.provider_identity = {
        runtime_provider_kind: "managed_agent",
        agent_profile_ref: { record_kind: "agent_profile", id: "codex" },
        model: {},
        provider_configuration_digest: "sha256:provider",
        qualification_eligible: true
      };
    }],
    ["missing python artifact path", (value: any) => {
      delete value.systemCode.artifact_path;
    }],
    ["object CandidateVersion runtime ref", (value: any) => {
      value.candidateVersion.runtime_ref.id = {};
    }],
    ["string evaluation score", (value: any) => {
      value.evaluation.latest_score.net_revenue_usdt = "0";
    }]
  ])("returns false for malformed nested object fields: %s", (_label, mutate) => {
    const value = inertLoadedSideRecords();
    mutate(value);
    expect(() => paperTradingComparisonSideRecordsHaveInertShape(value)).not.toThrow();
    expect(paperTradingComparisonSideRecordsHaveInertShape(value)).toBe(false);
  });

  it("validates complete preparation and pair shapes without nested dereference throws", () => {
    const preparation = comparisonPreparation();
    const pair = comparisonCommitment();
    expect(paperTradingComparisonPreparationHasRuntimeShape(preparation)).toBe(true);
    expect(paperTradingComparisonCommitmentHasRuntimeShape(pair)).toBe(true);
    expect(paperTradingComparisonPolicyHasRuntimeShape(preparation.comparison_policy)).toBe(true);
    expect(paperTradingComparisonChampionSelectionHasRuntimeShape(
      preparation.champion_selection,
      preparation.comparison_policy.comparison_mode
    )).toBe(true);

    const invalidPolicy = {
      ...preparation.comparison_policy,
      minimum_observation_count: 0,
      maximum_retry_count_per_side: -1,
      require_both_qualified: false
    };
    expect(paperTradingComparisonPolicyHasRuntimeShape(invalidPolicy)).toBe(false);
    expect(() => paperTradingComparisonPreparationHasRuntimeShape({
      ...preparation,
      comparison_policy: invalidPolicy,
      champion_selection: null
    })).not.toThrow();
    expect(paperTradingComparisonPreparationHasRuntimeShape({
      ...preparation,
      comparison_policy: invalidPolicy,
      champion_selection: null
    })).toBe(false);
  });

  it("accepts one complete stopped qualification closure shape", () => {
    expect(paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(
      stoppedQualificationClosure()
    )).toBe(true);
  });

  it.each([
    {
      label: "reordered semantically identical account",
      mutate(value: PaperTradingComparisonStoppedQualificationClosure) {
        value.evaluation.paper_account_snapshot = reorderedQualificationAccount(
          value.evaluation.paper_account_snapshot!
        );
      },
      expectedStatus: "qualified",
      expectedReasons: []
    },
    {
      label: "29 observations over 30 elapsed minutes",
      mutate(value: PaperTradingComparisonStoppedQualificationClosure) {
        setQualificationWindow(value, 29, 30);
      },
      expectedStatus: "collecting_evidence",
      expectedReasons: ["min_observation_count_not_met"]
    },
    {
      label: "30 observations over 29 elapsed minutes",
      mutate(value: PaperTradingComparisonStoppedQualificationClosure) {
        setQualificationWindow(value, 30, 29);
      },
      expectedStatus: "collecting_evidence",
      expectedReasons: ["min_elapsed_ms_not_met"]
    },
    {
      label: "30 observations over 30 elapsed minutes",
      mutate(_value: PaperTradingComparisonStoppedQualificationClosure) {},
      expectedStatus: "qualified",
      expectedReasons: []
    },
    {
      label: "exactly 3 of 30 failed observations",
      mutate(value: PaperTradingComparisonStoppedQualificationClosure) {
        setFailedQualificationObservations(value, 3);
      },
      expectedStatus: "qualified",
      expectedReasons: []
    },
    {
      label: "4 of 30 failed observations",
      mutate(value: PaperTradingComparisonStoppedQualificationClosure) {
        setFailedQualificationObservations(value, 4);
      },
      expectedStatus: "blocked_by_quality",
      expectedReasons: ["failed_observation_ratio_exceeded"]
    },
    {
      label: "missing latest market evidence",
      mutate(value: PaperTradingComparisonStoppedQualificationClosure) {
        for (const observation of value.observations) {
          delete observation.market_snapshot;
        }
      },
      expectedStatus: "blocked_by_quality",
      expectedReasons: ["latest_market_snapshot_missing"]
    },
    {
      label: "account and score discontinuity",
      mutate(value: PaperTradingComparisonStoppedQualificationClosure) {
        value.observations[0]!.score_delta.revenue_usdt = 1;
        value.observations[0]!.cumulative_score.revenue_usdt = 1;
      },
      expectedStatus: "blocked_by_quality",
      expectedReasons: ["paper_score_account_mismatch"]
    },
    {
      label: "fill without matching public execution evidence",
      mutate(value: PaperTradingComparisonStoppedQualificationClosure) {
        value.evaluation.latest_fill = {
          fill_id: "fill-unmatched",
          order_id: "order-unmatched",
          fill_status: "filled",
          fill_price: "60000",
          fill_quantity: "0.001",
          fee_usdt: "0",
          slippage_usdt: "0",
          funding_usdt: "0",
          trade_time: value.evaluation.stopped_at!,
          source_trade_id: "aggTrade:unmatched"
        };
      },
      expectedStatus: "blocked_by_quality",
      expectedReasons: ["fill_public_execution_evidence_missing"]
    },
    {
      label: "stale commitment self-digest",
      mutate(_value: PaperTradingComparisonStoppedQualificationClosure) {},
      commitmentDigestVerified: false,
      expectedStatus: "not_qualification_evidence",
      expectedReasons: ["paper_evaluation_commitment_missing"]
    }
  ] as const)(
    "uses one domain qualification decision for $label",
    ({ mutate, commitmentDigestVerified = true, expectedStatus, expectedReasons }) => {
    const value = stoppedQualificationClosure();
    mutate(value);
    const input = qualificationDecisionInput(value, commitmentDigestVerified);

    const result = decidePaperTradingQualification(input);

    expect(result.qualification_status).toBe(expectedStatus);
    expect(result.qualification_reasons).toEqual(expectedReasons);
    }
  );

  it("keeps evidence-integrity reason compatibility in the domain decision", () => {
    const value = stoppedQualificationClosure();
    expect(paperTradingEvidenceIntegrityReasons(
      qualificationDecisionInput(value, true)
    )).toEqual([]);
    expect(paperTradingEvidenceIntegrityReasons(
      qualificationDecisionInput(value, false)
    )).toEqual(["paper_evaluation_commitment_missing"]);
    expect(DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY).toEqual({
      minObservationCount: 30,
      minElapsedMs: 1_800_000,
      maxFailedObservationRatio: 0.1,
      assessRunnerHealth: true
    });
  });

  it.each([
    {
      label: "inactive running evaluation",
      mutate(
        value: PaperTradingComparisonStoppedQualificationClosure,
        _input: PaperTradingQualificationDecisionInput
      ) {
        value.evaluation.status = "running";
      },
      expectedStatus: "needs_resume",
      expectedReason: "runner_inactive_for_running_evaluation"
    },
    {
      label: "incomplete observation chain",
      mutate(
        value: PaperTradingComparisonStoppedQualificationClosure,
        _input: PaperTradingQualificationDecisionInput
      ) {
        value.observations[0]!.sequence = 2;
      },
      expectedStatus: "blocked_by_quality",
      expectedReason: "paper_observation_chain_incomplete"
    },
    {
      label: "failed evaluation",
      mutate(
        value: PaperTradingComparisonStoppedQualificationClosure,
        _input: PaperTradingQualificationDecisionInput
      ) {
        value.evaluation.status = "failed";
      },
      expectedStatus: "paper_failed",
      expectedReason: "paper_evaluation_failed"
    },
    {
      label: "research-feedback purpose",
      mutate(
        value: PaperTradingComparisonStoppedQualificationClosure,
        _input: PaperTradingQualificationDecisionInput
      ) {
        value.commitment.evidence_purpose = "research_feedback";
        value.commitment.window_policy.release_policy = "closed_observation";
      },
      expectedStatus: "not_qualification_evidence",
      expectedReason: "evidence_purpose_not_qualification"
    },
    {
      label: "ineligible provider",
      mutate(
        value: PaperTradingComparisonStoppedQualificationClosure,
        _input: PaperTradingQualificationDecisionInput
      ) {
        value.commitment.provider_identity = {
          runtime_provider_kind: "none",
          qualification_eligible: false,
          ineligibility_reason: "provider_identity_unavailable"
        };
      },
      expectedStatus: "not_qualification_evidence",
      expectedReason: "provider_identity_not_qualification_eligible"
    },
    {
      label: "invalidated evaluation",
      mutate(
        value: PaperTradingComparisonStoppedQualificationClosure,
        _input: PaperTradingQualificationDecisionInput
      ) {
        value.evaluation.status = "invalidated";
      },
      expectedStatus: "blocked_by_quality",
      expectedReason: "paper_evaluation_invalidated"
    }
  ] as const)("preserves qualification status and reason for $label", ({
    mutate,
    expectedStatus,
    expectedReason
  }) => {
    const value = stoppedQualificationClosure();
    const input = qualificationDecisionInput(value, true);
    mutate(value, input);

    expect(decidePaperTradingQualification(input)).toMatchObject({
      qualification_status: expectedStatus,
      qualification_reasons: [expectedReason]
    });
  });

  it.each([
    ["malformed managed provider", (value: any) => {
      value.commitment.provider_identity = {
        runtime_provider_kind: "managed_agent",
        agent_profile_ref: { record_kind: "agent_profile", id: "codex" },
        model: {},
        provider_configuration_digest: "sha256:provider",
        qualification_eligible: true
      };
      refreshClosureCommitmentDigest(value);
    }],
    ["wrong frozen SystemCode", (value: any) => {
      value.commitment.system_code_ref = {
        record_kind: "system_code",
        id: "different-system-code"
      };
      refreshClosureCommitmentDigest(value);
    }],
    ["object fill source_trade_id", (value: any) => {
      value.evaluation.latest_fill = {
        fill_id: "fill-1",
        order_id: "order-1",
        fill_status: "filled",
        fill_price: "60000",
        fill_quantity: "0.01",
        fee_usdt: "0.1",
        slippage_usdt: "0",
        funding_usdt: "0",
        trade_time: "2026-07-09T22:02:00.000Z",
        source_trade_id: {}
      };
    }],
    ["null aggregate trade", (value: any) => {
      value.evaluation.latest_public_execution_snapshot = {
        symbol: "BTCUSDT",
        observed_at: "2026-07-09T22:02:00.000Z",
        source_kind: "binance_production_public_rest",
        stream_marker: "aggTrade:1",
        agg_trades: [null],
        authority_status: "read_only"
      };
    }]
  ])("returns false without throwing for malformed stopped closure: %s", (_label, mutate) => {
    const value = stoppedQualificationClosure();
    mutate(value);
    expect(() => paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(value))
      .not.toThrow();
    expect(paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(value)).toBe(false);
  });

  it("binds full exact records even when their IDs are reused", () => {
    const version = candidateVersion();
    const systemCode = comparisonSystemCode();
    const admission = admissionDecision();
    const promotion = tradingPromotion();

    expect(paperTradingComparisonCandidateVersionDigestInput({
      ...version,
      runtime_ref: { record_kind: "trading_run", id: "changed-default-run" }
    })).not.toBe(paperTradingComparisonCandidateVersionDigestInput(version));
    expect(paperTradingComparisonCandidateVersionDigestInput({
      ...version,
      capability_package_refs: [{ record_kind: "capability_package", id: "changed-capability" }]
    })).not.toBe(paperTradingComparisonCandidateVersionDigestInput(version));
    expect(paperTradingComparisonSystemCodeRecordDigestInput({
      ...systemCode,
      entrypoint: ["python3", "changed.py"]
    })).not.toBe(paperTradingComparisonSystemCodeRecordDigestInput(systemCode));
    expect(paperTradingComparisonSystemCodeRecordDigestInput({
      ...systemCode,
      capability_policy_ref: { record_kind: "capability_policy", id: "changed-policy" }
    })).not.toBe(paperTradingComparisonSystemCodeRecordDigestInput(systemCode));
    expect(paperTradingComparisonAdmissionDecisionDigestInput({
      ...admission,
      submitted_artifact_digest: "sha256:changed-artifact"
    })).not.toBe(paperTradingComparisonAdmissionDecisionDigestInput(admission));
    expect(paperTradingComparisonTradingPromotionDigestInput({
      ...promotion,
      promoted_at: "2026-07-10T00:00:01.000Z"
    })).not.toBe(paperTradingComparisonTradingPromotionDigestInput(promotion));
    expect(paperTradingComparisonTradingPromotionHasRuntimeShape(promotion)).toBe(true);
    expect(paperTradingComparisonTradingPromotionHasRuntimeShape({
      ...promotion,
      paper_trading_evaluation_ref: { record_kind: "paper_trading_evaluation", id: {} }
    })).toBe(false);
  });

  it("omits only undefined object properties for persisted-record digests", () => {
    const versionWithUndefined = {
      ...candidateVersion(),
      system_code_ref: undefined
    } satisfies CandidateVersionRecord;
    const { system_code_ref: _versionSystemCode, ...persistedVersion } =
      versionWithUndefined;
    const codeWithUndefined = {
      ...comparisonSystemCode(),
      artifact_runtime_contract_ref: undefined
    } satisfies SystemCodeRecord;
    const { artifact_runtime_contract_ref: _runtimeContract, ...persistedCode } =
      codeWithUndefined;

    expect(paperTradingComparisonCandidateVersionDigestInput(versionWithUndefined))
      .toBe(paperTradingComparisonPersistedRecordDigestInput(persistedVersion));
    expect(paperTradingComparisonSystemCodeRecordDigestInput(codeWithUndefined))
      .toBe(paperTradingComparisonPersistedRecordDigestInput(persistedCode));
  });

  it.each([
    ["undefined array item", { ...candidateVersion(), capability_package_refs: [undefined] }],
    ["non-finite number", { ...candidateVersion(), version: Number.POSITIVE_INFINITY }],
    ["function", { ...candidateVersion(), injected: () => undefined }],
    ["symbol", { ...candidateVersion(), injected: Symbol("invalid") }],
    ["symbol-keyed property", Object.assign(candidateVersion(), {
      [Symbol("hidden")]: "not-persisted"
    })],
    ["bigint", { ...candidateVersion(), injected: 1n }]
  ])("rejects non-persistable full-record content: %s", (_label, value) => {
    expect(() => paperTradingComparisonPersistedRecordDigestInput(value))
      .toThrow("paper_trading_comparison_non_persistable_record");
  });

  it("binds full side commitment, evaluation, and ordered observation records", () => {
    const commitment = sideQualificationCommitment();
    const evaluation = sideQualificationEvaluation(commitment);
    const observations = sideQualificationObservations(commitment, evaluation);

    expect(paperTradingComparisonEvaluationCommitmentRecordDigestInput({
      ...commitment,
      committed_at: "2026-07-10T00:00:01.000Z"
    })).not.toBe(
      paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
    );
    expect(paperTradingComparisonEvaluationRecordDigestInput({
      ...evaluation,
      started_at: "2026-07-10T00:00:01.000Z"
    })).not.toBe(paperTradingComparisonEvaluationRecordDigestInput(evaluation));
    expect(paperTradingComparisonObservationChainDigestInput([{
      ...observations[0]!,
      observed_at: "2026-07-09T22:01:01.000Z"
    }, ...observations.slice(1)])).not.toBe(
      paperTradingComparisonObservationChainDigestInput(observations)
    );
    expect(paperTradingComparisonObservationChainDigestInput([...observations].reverse()))
      .toBe(paperTradingComparisonObservationChainDigestInput(observations));
  });

  it("binds exact record digests into the frozen preparation", () => {
    const version = candidateVersion();
    const systemCode = comparisonSystemCode();
    const admission = admissionDecision();
    const originalFixture = comparisonPreparation();
    const original = comparisonPreparation({
      champion: {
        ...originalFixture.champion,
        candidate_version_digest: exactRecordDigest(
          paperTradingComparisonCandidateVersionDigestInput(version)
        ),
        system_code_record_digest: exactRecordDigest(
          paperTradingComparisonSystemCodeRecordDigestInput(systemCode)
        ),
        system_code_artifact_digest: systemCode.artifact_digest,
        admission_decision_digest: exactRecordDigest(
          paperTradingComparisonAdmissionDecisionDigestInput(admission)
        )
      }
    });
    const changedVersion = comparisonPreparation({
      champion: {
        ...original.champion,
        candidate_version_digest: exactRecordDigest(
          paperTradingComparisonCandidateVersionDigestInput({
            ...version,
            runtime_ref: { record_kind: "trading_run", id: "changed-default-run" }
          })
        )
      }
    });
    const changedSystemCodeRecord = {
      ...systemCode,
      artifact_digest: "sha256:changed-artifact"
    } satisfies SystemCodeRecord;
    const changedSystemCode = comparisonPreparation({
      champion: {
        ...original.champion,
        system_code_artifact_digest: changedSystemCodeRecord.artifact_digest,
        system_code_record_digest: exactRecordDigest(
          paperTradingComparisonSystemCodeRecordDigestInput(changedSystemCodeRecord)
        )
      }
    });
    const changedAdmissionRecord = {
      ...admission,
      decided_at: "2026-07-10T00:00:01.000Z"
    } satisfies CandidateAdmissionDecisionRecord;
    const changedAdmission = comparisonPreparation({
      champion: {
        ...original.champion,
        admission_decision_digest: exactRecordDigest(
          paperTradingComparisonAdmissionDecisionDigestInput(changedAdmissionRecord)
        )
      }
    });

    expect(paperTradingComparisonPreparationDigestInput(changedVersion))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
    expect(paperTradingComparisonPreparationDigestInput(changedSystemCode))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
    expect(paperTradingComparisonPreparationDigestInput(changedAdmission))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
  });

  it("binds the complete pre-side intent and server-owned commit time", () => {
    const original = comparisonPreparation();
    const changedPolicy = comparisonPreparation({
      comparison_policy: {
        ...original.comparison_policy,
        minimum_net_revenue_lift_usdt: 25
      }
    });
    const changedTime = comparisonPreparation({
      committed_at: "2026-07-10T00:00:01.000Z"
    });

    expect(paperTradingComparisonPreparationDigestInput(changedPolicy))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
    expect(paperTradingComparisonPreparationDigestInput(changedTime))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
  });

  it("canonicalizes equivalent preparation key order", () => {
    const left = comparisonPreparation();
    const right = Object.fromEntries(
      Object.entries(left).reverse()
    ) as unknown as PaperTradingComparisonPreparationRecord;

    expect(paperTradingComparisonPreparationDigestInput(left))
      .toBe(paperTradingComparisonPreparationDigestInput(right));
  });

  it("binds the champion selection authority", () => {
    const original = comparisonPreparation();
    const changedDigest = comparisonPreparation({
      champion_selection: {
        selection_kind: "trading_review",
        trading_promotion_ref: {
          record_kind: "trading_promotion",
          id: "trading-promotion-champion"
        },
        trading_promotion_digest: "sha256:changed-promotion-record",
        paper_trading_evaluation_ref: {
          record_kind: "paper_trading_evaluation",
          id: "paper-evaluation-selection"
        },
        paper_trading_evaluation_record_digest:
          "sha256:paper-evaluation-selection-record",
        paper_trading_evaluation_commitment_ref: {
          record_kind: "paper_trading_evaluation_commitment",
          id: "paper-commitment-selection"
        },
        paper_trading_evaluation_commitment_record_digest:
          "sha256:paper-commitment-selection-record",
        paper_trading_observation_chain_digest:
          "sha256:paper-observation-selection-chain"
      }
    });
    const changed = comparisonPreparation({
      champion_selection: { selection_kind: "bootstrap" },
      comparison_policy: {
        ...original.comparison_policy,
        comparison_mode: "bootstrap"
      }
    });

    expect(paperTradingComparisonPreparationDigestInput(changedDigest))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
    expect(paperTradingComparisonPreparationDigestInput(changed))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
  });

  it("binds the complete champion promotion evidence closure", () => {
    const original = comparisonPreparation();
    if (original.champion_selection.selection_kind !== "trading_review") {
      throw new Error("fixture selection was not trading_review");
    }
    const changedEvaluation = comparisonPreparation({
      champion_selection: {
        ...original.champion_selection,
        paper_trading_evaluation_record_digest: "sha256:changed-selection-evaluation"
      }
    });
    const changedCommitment = comparisonPreparation({
      champion_selection: {
        ...original.champion_selection,
        paper_trading_evaluation_commitment_record_digest:
          "sha256:changed-selection-commitment"
      }
    });
    const changedObservations = comparisonPreparation({
      champion_selection: {
        ...original.champion_selection,
        paper_trading_observation_chain_digest: "sha256:changed-selection-observations"
      }
    });

    expect(paperTradingComparisonPreparationDigestInput(changedEvaluation))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
    expect(paperTradingComparisonPreparationDigestInput(changedCommitment))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
    expect(paperTradingComparisonPreparationDigestInput(changedObservations))
      .not.toBe(paperTradingComparisonPreparationDigestInput(original));
  });

  it("canonicalizes equivalent key order", () => {
    const left = comparisonCommitment();
    const right = Object.fromEntries(
      Object.entries(left).reverse()
    ) as unknown as PaperTradingComparisonCommitmentRecord;

    expect(paperTradingComparisonCommitmentDigestInput(left))
      .toBe(paperTradingComparisonCommitmentDigestInput(right));
  });

  it("binds both side identities and the explicit pair policy", () => {
    const original = comparisonCommitment();
    const changedSide = comparisonCommitment({
      challenger: {
        ...original.challenger,
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: "candidate-version-challenger-002"
        }
      }
    });
    const changedPolicy = comparisonCommitment({
      comparison_policy: {
        ...original.comparison_policy,
        minimum_net_revenue_lift_usdt: 25
      }
    });
    const changedEvaluation = comparisonCommitment({
      challenger: {
        ...original.challenger,
        paper_trading_evaluation_ref: {
          record_kind: "paper_trading_evaluation",
          id: "paper-evaluation-challenger-replacement"
        }
      }
    });
    const changedSideCommitmentDigest = comparisonCommitment({
      challenger: {
        ...original.challenger,
        paper_trading_evaluation_commitment_digest:
          "sha256:changed-side-commitment-content"
      }
    });
    const changedSideCommitmentRecordDigest = comparisonCommitment({
      challenger: {
        ...original.challenger,
        paper_trading_evaluation_commitment_record_digest:
          "sha256:changed-side-commitment-record"
      }
    });
    const changedSideEvaluationRecordDigest = comparisonCommitment({
      challenger: {
        ...original.challenger,
        paper_trading_evaluation_record_digest:
          "sha256:changed-side-evaluation-record"
      }
    });

    expect(paperTradingComparisonCommitmentDigestInput(changedSide))
      .not.toBe(paperTradingComparisonCommitmentDigestInput(original));
    expect(paperTradingComparisonCommitmentDigestInput(changedPolicy))
      .not.toBe(paperTradingComparisonCommitmentDigestInput(original));
    expect(paperTradingComparisonCommitmentDigestInput(changedEvaluation))
      .not.toBe(paperTradingComparisonCommitmentDigestInput(original));
    expect(paperTradingComparisonCommitmentDigestInput(changedSideCommitmentDigest))
      .not.toBe(paperTradingComparisonCommitmentDigestInput(original));
    expect(paperTradingComparisonCommitmentDigestInput(changedSideCommitmentRecordDigest))
      .not.toBe(paperTradingComparisonCommitmentDigestInput(original));
    expect(paperTradingComparisonCommitmentDigestInput(changedSideEvaluationRecordDigest))
      .not.toBe(paperTradingComparisonCommitmentDigestInput(original));
  });

  it("binds the preparation ref into the pair digest", () => {
    const original = comparisonCommitment();
    const changed = comparisonCommitment({
      preparation_ref: {
        record_kind: "paper_trading_comparison_preparation",
        id: "paper-comparison-preparation-002"
      }
    });

    expect(paperTradingComparisonCommitmentDigestInput(changed))
      .not.toBe(paperTradingComparisonCommitmentDigestInput(original));
  });

  it("excludes record metadata, pair id, commit time, and digest", () => {
    const original = comparisonCommitment();
    const relabeled = {
      ...original,
      version: 2,
      paper_trading_comparison_commitment_id: "paper-comparison-another-id",
      committed_at: "2026-07-10T01:00:00.000Z",
      commitment_digest: "sha256:another-derived-value"
    } as unknown as PaperTradingComparisonCommitmentRecord;

    expect(paperTradingComparisonCommitmentDigestInput(relabeled))
      .toBe(paperTradingComparisonCommitmentDigestInput(original));
  });

  it("uses one active-pair key when champion and challenger roles are swapped", () => {
    expect(paperTradingComparisonCandidateVersionPairKey(
      "candidate-version-champion",
      "candidate-version-challenger"
    )).toBe(paperTradingComparisonCandidateVersionPairKey(
      "candidate-version-challenger",
      "candidate-version-champion"
    ));
    expect(paperTradingComparisonCandidateVersionPairKey(
      "candidate-version-champion",
      "candidate-version-third"
    )).not.toBe(paperTradingComparisonCandidateVersionPairKey(
      "candidate-version-champion",
      "candidate-version-challenger"
    ));
  });
});

function comparisonPreparation(
  overrides: Partial<PaperTradingComparisonPreparationRecord> = {}
): PaperTradingComparisonPreparationRecord {
  return {
    record_kind: "paper_trading_comparison_preparation",
    version: 1,
    paper_trading_comparison_preparation_id: "paper-comparison-preparation-001",
    paper_trading_comparison_commitment_id: "paper-comparison-001",
    champion: {
      role: "champion",
      candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-champion" },
      candidate_version_ref: { record_kind: "candidate_version", id: "candidate-version-champion" },
      candidate_version_digest: "sha256:candidate-version-champion-record",
      system_code_ref: { record_kind: "system_code", id: "system-code-champion" },
      system_code_record_digest: "sha256:system-code-champion-record",
      system_code_artifact_digest: "sha256:system-code-champion-artifact",
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "candidate-admission-champion"
      },
      admission_decision_digest: "sha256:candidate-admission-champion-record"
    },
    challenger: {
      role: "challenger",
      candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-challenger" },
      candidate_version_ref: { record_kind: "candidate_version", id: "candidate-version-challenger" },
      candidate_version_digest: "sha256:candidate-version-challenger-record",
      system_code_ref: { record_kind: "system_code", id: "system-code-challenger" },
      system_code_record_digest: "sha256:system-code-challenger-record",
      system_code_artifact_digest: "sha256:system-code-challenger-artifact",
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "candidate-admission-challenger"
      },
      admission_decision_digest: "sha256:candidate-admission-challenger-record"
    },
    champion_selection: {
      selection_kind: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: "trading-promotion-champion"
      },
      trading_promotion_digest: "sha256:trading-promotion-champion-record",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "paper-evaluation-selection"
      },
      paper_trading_evaluation_record_digest:
        "sha256:paper-evaluation-selection-record",
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "paper-commitment-selection"
      },
      paper_trading_evaluation_commitment_record_digest:
        "sha256:paper-commitment-selection-record",
      paper_trading_observation_chain_digest:
        "sha256:paper-observation-selection-chain"
    },
    comparison_policy: comparisonPolicy(),
    market_data_configuration_digest: "sha256:market-data-configuration",
    paper_policy_identity: paperPolicyIdentity(),
    committed_at: "2026-07-10T00:00:00.000Z",
    preparation_digest: "sha256:derived-preparation-value",
    authority_status: "not_live",
    ...overrides
  };
}

function comparisonCommitment(
  overrides: Partial<PaperTradingComparisonCommitmentRecord> = {}
): PaperTradingComparisonCommitmentRecord {
  return {
    record_kind: "paper_trading_comparison_commitment",
    version: 1,
    paper_trading_comparison_commitment_id: "paper-comparison-001",
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: "paper-comparison-preparation-001"
    },
    champion: {
      role: "champion",
      candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-champion" },
      candidate_version_ref: { record_kind: "candidate_version", id: "candidate-version-champion" },
      candidate_version_digest: "sha256:candidate-version-champion-record",
      system_code_ref: { record_kind: "system_code", id: "system-code-champion" },
      system_code_record_digest: "sha256:system-code-champion-record",
      system_code_artifact_digest: "sha256:system-code-champion-artifact",
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "candidate-admission-champion"
      },
      admission_decision_digest: "sha256:candidate-admission-champion-record",
      trading_run_ref: { record_kind: "trading_run", id: "trading-run-champion-qualification" },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "paper-commitment-champion"
      },
      paper_trading_evaluation_commitment_digest: "sha256:paper-commitment-champion-content",
      paper_trading_evaluation_commitment_record_digest:
        "sha256:paper-commitment-champion-record",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "paper-evaluation-champion"
      },
      paper_trading_evaluation_record_digest: "sha256:paper-evaluation-champion-record"
    },
    challenger: {
      role: "challenger",
      candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-challenger" },
      candidate_version_ref: { record_kind: "candidate_version", id: "candidate-version-challenger" },
      candidate_version_digest: "sha256:candidate-version-challenger-record",
      system_code_ref: { record_kind: "system_code", id: "system-code-challenger" },
      system_code_record_digest: "sha256:system-code-challenger-record",
      system_code_artifact_digest: "sha256:system-code-challenger-artifact",
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "candidate-admission-challenger"
      },
      admission_decision_digest: "sha256:candidate-admission-challenger-record",
      trading_run_ref: { record_kind: "trading_run", id: "trading-run-challenger-qualification" },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "paper-commitment-challenger"
      },
      paper_trading_evaluation_commitment_digest: "sha256:paper-commitment-challenger-content",
      paper_trading_evaluation_commitment_record_digest:
        "sha256:paper-commitment-challenger-record",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "paper-evaluation-challenger"
      },
      paper_trading_evaluation_record_digest:
        "sha256:paper-evaluation-challenger-record"
    },
    champion_selection: {
      selection_kind: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: "trading-promotion-champion"
      },
      trading_promotion_digest: "sha256:trading-promotion-champion-record",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "paper-evaluation-selection"
      },
      paper_trading_evaluation_record_digest:
        "sha256:paper-evaluation-selection-record",
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "paper-commitment-selection"
      },
      paper_trading_evaluation_commitment_record_digest:
        "sha256:paper-commitment-selection-record",
      paper_trading_observation_chain_digest:
        "sha256:paper-observation-selection-chain"
    },
    comparison_policy: comparisonPolicy(),
    market_data_configuration_digest: "sha256:market-data-configuration",
    paper_policy_identity: paperPolicyIdentity(),
    committed_at: "2026-07-10T00:00:00.000Z",
    commitment_digest: "sha256:derived-value",
    authority_status: "not_live",
    ...overrides
  };
}

function comparisonPolicy(): PaperTradingComparisonPolicy {
  return {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge",
      symbol: "BTCUSDT",
      interval_ms: 60_000,
      minimum_observation_count: 30,
      minimum_elapsed_ms: 1_800_000,
      maximum_observation_count: 120,
      maximum_elapsed_ms: 7_200_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 500,
      maximum_retry_count_per_side: 3,
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 10,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true,
      require_both_qualified: true,
      release_policy: "sealed_until_adjudication"
  };
}

function paperPolicyIdentity(): PaperTradingEvaluationPolicyIdentity {
  return {
      market_data_policy_version: "binance-public-market-v1",
      gateway_policy_version: "paper-gateway-dry-run-v1",
      cost_policy_version: "paper-cost-8bps-v1",
      funding_policy_version: "paper-funding-engine-v1",
      slippage_policy_version: "paper-public-fill-slippage-v1",
      fill_policy_version: "paper-public-execution-fill-v1",
      risk_policy_version: "paper-risk-validation-v1",
      paper_account_policy_version: "fake-paper-account-10000usdt-v1",
      decision_event_protocol_version: "trading-system-paper-events-v1",
      persistent_state_boundary_version: "paper-engine-checkpoint-v1"
  };
}

function exactRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function candidateVersion(): CandidateVersionRecord {
  return {
    record_kind: "candidate_version",
    version: 1,
    candidate_version_id: "candidate-version-champion",
    candidate_id: "candidate-champion",
    version_label: "v1",
    spec_ref: { record_kind: "trading_system_spec", id: "spec-champion" },
    program_ref: { record_kind: "trading_system_program", id: "program-champion" },
    capability_package_refs: [{ record_kind: "capability_package", id: "capability-champion" }],
    runtime_ref: { record_kind: "trading_run", id: "default-run-champion" },
    trace_placeholder_ref: { record_kind: "trace_placeholder", id: "trace-champion" },
    system_code_ref: { record_kind: "system_code", id: "system-code-champion" }
  };
}

function comparisonSystemCode(): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "system-code-champion",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:system-code-champion-artifact",
    runtime_kind: "python",
    entrypoint: ["python3", "fixtures/trading-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "secret-policy-v1" },
    capability_policy_ref: { record_kind: "capability_policy", id: "paper-code-v1" },
    provenance_refs: [{ record_kind: "research_finding", id: "finding-champion" }],
    status: "registered",
    created_at: "2026-07-09T20:00:00.000Z",
    authority_status: "not_live"
  };
}

function admissionDecision(): CandidateAdmissionDecisionRecord {
  return {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: "candidate-admission-champion",
    source_system_code_ref: { record_kind: "system_code", id: "source-code-champion" },
    system_code_ref: { record_kind: "system_code", id: "system-code-champion" },
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment-champion" },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: "evaluation-result-champion"
    },
    research_finding_ref: { record_kind: "research_finding", id: "finding-champion" },
    source_artifact_digest: "sha256:source-champion",
    submitted_artifact_digest: "sha256:system-code-champion-artifact",
    research_worker_outcome: "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted",
    status: "admitted",
    reason: "evaluation_accepted",
    runnable_paper_handoff: true,
    decided_at: "2026-07-09T21:00:00.000Z",
    authority_status: "not_live"
  };
}

function tradingPromotion(): TradingPromotionRecord {
  return {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "trading-promotion-champion",
    status: "promoted_for_trading_review",
    candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-champion" },
    candidate_version_ref: { record_kind: "candidate_version", id: "candidate-version-champion" },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: "paper-evaluation-selection"
    },
    promoted_at: "2026-07-10T00:00:00.000Z",
    authority_status: "not_live"
  };
}

function sideQualificationCommitment(): PaperTradingEvaluationCommitmentRecord {
  return {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: "paper-commitment-side-digest",
    evidence_purpose: "qualification",
    candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-champion" },
    candidate_version_ref: { record_kind: "candidate_version", id: "candidate-version-champion" },
    trading_run_ref: { record_kind: "trading_run", id: "trading-run-side-digest" },
    system_code_ref: { record_kind: "system_code", id: "system-code-champion" },
    system_code_artifact_digest: "sha256:system-code-champion-artifact",
    resolved_artifact_digest: "sha256:resolved-system-code-champion",
    runtime_identity: {
      artifact_kind: "python_file",
      runtime_kind: "python",
      entrypoint: ["python3", "fixtures/trading-systems/clock.py"]
    },
    provider_identity: {
      runtime_provider_kind: "none",
      qualification_eligible: true
    },
    capability_policy_ref: { record_kind: "capability_policy", id: "paper-code-v1" },
    secret_policy_ref: { record_kind: "secret_policy", id: "secret-policy-v1" },
    policy_identity: paperPolicyIdentity(),
    data_identity: {
      symbol: "BTCUSDT",
      market_data_port: "gateway_owned",
      allowed_market_data_source: "binance_production_public_rest",
      market_data_configuration_digest: "sha256:market-data-configuration",
      private_exchange_access: "forbidden",
      live_order_access: "forbidden"
    },
    window_policy: {
      interval_ms: 60_000,
      release_policy: "sealed_until_adjudication",
      eligibility_policy_version: "paper-evidence-eligibility-v1"
    },
    initial_account_snapshot: structuredClone(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT),
    committed_at: "2026-07-09T22:00:00.000Z",
    commitment_digest: "sha256:self-digest-excludes-time",
    authority_status: "not_live"
  };
}

function sideQualificationEvaluation(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: "paper-evaluation-side-digest",
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "stopped",
    interval_ms: 60_000,
    observation_count: 30,
    started_at: commitment.committed_at,
    last_observed_at: "2026-07-09T22:30:00.000Z",
    stopped_at: "2026-07-09T22:30:00.000Z",
    latest_score: { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 },
    paper_account_snapshot: structuredClone(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
}

function sideQualificationObservations(
  commitment: PaperTradingEvaluationCommitmentRecord,
  evaluation: PaperTradingEvaluationRecord
): PaperTradingObservationRecord[] {
  return Array.from({ length: 30 }, (_, index) => index + 1).map((sequence) => ({
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: `paper-observation-side-digest-${sequence}`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: evaluation.paper_trading_evaluation_id
    },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    sequence,
    status: "no_order",
    observed_at: new Date(
      Date.parse(evaluation.started_at) + sequence * 60_000
    ).toISOString(),
    ...(sequence === 30
      ? {
          market_snapshot: {
            symbol: "BTCUSDT" as const,
            price: 60_000,
            observed_at: "2026-07-09T22:30:00.000Z",
            source_kind: "binance_production_public_rest" as const,
            authority_status: "read_only" as const
          }
        }
      : {}),
    paper_account_snapshot: structuredClone(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    score_delta: { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 },
    cumulative_score: { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 },
    authority_status: "not_live"
  }));
}

function stoppedQualificationClosure(): PaperTradingComparisonStoppedQualificationClosure {
  const systemCode = comparisonSystemCode();
  const admission = admissionDecision();
  const commitmentWithoutDigest = sideQualificationCommitment();
  const commitment = {
    ...commitmentWithoutDigest,
    commitment_digest: exactRecordDigest(
      paperTradingEvaluationCommitmentDigestInput(commitmentWithoutDigest)
    )
  };
  const evaluation = sideQualificationEvaluation(commitment);
  const observations = sideQualificationObservations(commitment, evaluation);
  return {
    systemCode,
    admission,
    commitment,
    evaluation,
    observations,
    promotion: {
      ...tradingPromotion(),
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: evaluation.paper_trading_evaluation_id
      },
      promoted_at: "2026-07-09T22:31:00.000Z"
    },
    preparationCommittedAt: "2026-07-09T22:32:00.000Z"
  };
}

function refreshClosureCommitmentDigest(
  value: PaperTradingComparisonStoppedQualificationClosure
): void {
  value.commitment.commitment_digest = exactRecordDigest(
    paperTradingEvaluationCommitmentDigestInput(value.commitment)
  );
}

function qualificationDecisionInput(
  value: PaperTradingComparisonStoppedQualificationClosure,
  commitmentDigestVerified: boolean
): PaperTradingQualificationDecisionInput {
  return {
    evaluation: value.evaluation,
    commitment: value.commitment,
    observations: value.observations,
    runnerActive: false,
    commitmentDigestVerified
  };
}

function setQualificationWindow(
  value: PaperTradingComparisonStoppedQualificationClosure,
  observationCount: number,
  elapsedMinutes: number
): void {
  value.observations.splice(observationCount);
  const last = value.observations.at(-1);
  if (!last) {
    throw new Error("qualification fixture requires at least one observation");
  }
  last.observed_at = new Date(
    Date.parse(value.evaluation.started_at) + elapsedMinutes * 60_000
  ).toISOString();
  value.evaluation.observation_count = observationCount;
  value.evaluation.last_observed_at = last.observed_at;
  value.evaluation.stopped_at = last.observed_at;
}

function setFailedQualificationObservations(
  value: PaperTradingComparisonStoppedQualificationClosure,
  count: number
): void {
  for (const observation of value.observations.slice(0, count)) {
    observation.status = "failed";
    observation.failure_reason = "isolated qualification failure";
  }
}

function reorderedQualificationAccount(
  account: PaperTradingAccountSnapshot
): PaperTradingAccountSnapshot {
  const reorderedPosition = Object.fromEntries(
    Object.entries(account.position).reverse()
  ) as unknown as PaperTradingAccountSnapshot["position"];
  return Object.fromEntries(
    Object.entries(account).reverse().map(([key, value]) =>
      key === "position" ? [key, reorderedPosition] : [key, value]
    )
  ) as unknown as PaperTradingAccountSnapshot;
}

function inertLoadedSideRecords(): unknown {
  const systemCode = comparisonSystemCode();
  const version = candidateVersion();
  const commitment = {
    ...sideQualificationCommitment(),
    committed_at: "2026-07-10T00:00:00.000Z"
  };
  const evaluation: PaperTradingEvaluationRecord = {
    ...sideQualificationEvaluation(commitment),
    status: "not_started",
    observation_count: 0,
    started_at: commitment.committed_at,
    last_observed_at: undefined,
    stopped_at: undefined
  };
  return {
    candidate: {
      candidate_id: "candidate-champion",
      display_name: "Champion",
      status: "materialized",
      active_version_id: version.candidate_version_id,
      runtime: { ref: { record_kind: "trading_run", id: "trading-run-side-digest" } },
      system_code: { ref: { record_kind: "system_code", id: systemCode.system_code_id } },
      candidate_version: {
        candidate_version_id: version.candidate_version_id,
        version_label: version.version_label
      }
    },
    candidateVersion: version,
    admission: admissionDecision(),
    run: {
      record_kind: "trading_run",
      version: 1,
      trading_run_id: "trading-run-side-digest",
      stage_binding_profile: "paper",
      runtime_lifecycle_status: "registered",
      paper_evidence_purpose: "qualification",
      candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-champion" },
      candidate_version_ref: { record_kind: "candidate_version", id: version.candidate_version_id },
      placement_ref: { record_kind: "sandbox_placement", id: "placement-side-digest" },
      hands_environment_ref: { record_kind: "hands_environment", id: "hands-side-digest" },
      memory_surface_ref: { record_kind: "runtime_memory_surface", id: "memory-side-digest" },
      system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
      created_at: commitment.committed_at,
      authority_status: "not_live"
    },
    systemCode,
    commitment,
    evaluation,
    observations: []
  };
}
```
<!-- plan-typecheck:domain-test:end -->

Create `packages/application/src/trading/paper/qualification.test.ts` to pin the existing
application API to the domain decision and prove that the wrapper supplies commitment-digest
verification without restoring a second semantic implementation:

<!-- plan-typecheck:application-qualification-test:start -->
```ts
import { describe, expect, it } from "vitest";
import {
  decidePaperTradingQualification,
  type PaperTradingAccountSnapshot,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord,
  type PaperTradingQualificationDecisionInput
} from "@ouroboros/domain";
import { paperTradingEvaluationCommitmentDigest } from "./commitment";
import {
  DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY,
  paperTradingEvidenceIntegrityReasons,
  qualifyPaperTradingEvaluation
} from "./qualification";

describe("paper trading qualification compatibility wrapper", () => {
  it("delegates key-order-insensitive qualification to the domain decision", () => {
    const fixture = qualificationFixture();
    fixture.evaluation.paper_account_snapshot = reorderedAccount(
      fixture.evaluation.paper_account_snapshot!
    );
    const domainInput: PaperTradingQualificationDecisionInput = {
      ...fixture,
      runnerActive: false,
      commitmentDigestVerified: true,
      policy: {
        minObservationCount: 1,
        minElapsedMs: 0,
        maxFailedObservationRatio: 0.1,
        assessRunnerHealth: true
      }
    };

    const applicationResult = qualifyPaperTradingEvaluation({
      evaluation: fixture.evaluation,
      commitment: fixture.commitment,
      observations: fixture.observations,
      runnerActive: false,
      policy: domainInput.policy
    });

    expect(applicationResult).toEqual(decidePaperTradingQualification(domainInput));
    expect(applicationResult).toMatchObject({
      qualification_status: "qualified",
      qualification_reasons: []
    });
    expect(paperTradingEvidenceIntegrityReasons(fixture)).toEqual([]);
    expect(DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY.minObservationCount).toBe(30);
  });

  it("maps a stale commitment self-digest through the compatibility API", () => {
    const fixture = qualificationFixture();
    fixture.commitment.data_identity.market_data_configuration_digest =
      "sha256:stale-self-digest";

    expect(qualifyPaperTradingEvaluation({
      ...fixture,
      runnerActive: false
    })).toMatchObject({
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["paper_evaluation_commitment_missing"]
    });
    expect(paperTradingEvidenceIntegrityReasons(fixture))
      .toEqual(["paper_evaluation_commitment_missing"]);
  });
});

function qualificationFixture(): {
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
} {
  const initialAccount = neutralAccount();
  const commitmentWithoutDigest: PaperTradingEvaluationCommitmentRecord = {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: "qualification-wrapper-commitment",
    evidence_purpose: "qualification",
    candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-wrapper" },
    candidate_version_ref: { record_kind: "candidate_version", id: "version-wrapper" },
    trading_run_ref: { record_kind: "trading_run", id: "run-wrapper" },
    system_code_ref: { record_kind: "system_code", id: "code-wrapper" },
    system_code_artifact_digest: "sha256:code-wrapper",
    resolved_artifact_digest: "sha256:resolved-code-wrapper",
    runtime_identity: {
      artifact_kind: "python_file",
      runtime_kind: "python",
      entrypoint: ["python3", "wrapper.py"]
    },
    provider_identity: {
      runtime_provider_kind: "none",
      qualification_eligible: true
    },
    capability_policy_ref: { record_kind: "capability_policy", id: "paper-wrapper" },
    secret_policy_ref: { record_kind: "secret_policy", id: "paper-wrapper" },
    policy_identity: {
      market_data_policy_version: "market-v1",
      gateway_policy_version: "gateway-v1",
      cost_policy_version: "cost-v1",
      funding_policy_version: "funding-v1",
      slippage_policy_version: "slippage-v1",
      fill_policy_version: "fill-v1",
      risk_policy_version: "risk-v1",
      paper_account_policy_version: "account-v1",
      decision_event_protocol_version: "decision-v1",
      persistent_state_boundary_version: "state-v1"
    },
    data_identity: {
      symbol: "BTCUSDT",
      market_data_port: "gateway_owned",
      allowed_market_data_source: "binance_production_public_rest",
      market_data_configuration_digest: "sha256:market-wrapper",
      private_exchange_access: "forbidden",
      live_order_access: "forbidden"
    },
    window_policy: {
      interval_ms: 60_000,
      release_policy: "sealed_until_adjudication",
      eligibility_policy_version: "paper-evidence-eligibility-v1"
    },
    initial_account_snapshot: initialAccount,
    committed_at: "2026-07-09T22:00:00.000Z",
    commitment_digest: "",
    authority_status: "not_live"
  };
  const commitment = {
    ...commitmentWithoutDigest,
    commitment_digest: paperTradingEvaluationCommitmentDigest(commitmentWithoutDigest)
  };
  const evaluation: PaperTradingEvaluationRecord = {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: "qualification-wrapper-evaluation",
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "stopped",
    interval_ms: 60_000,
    observation_count: 1,
    started_at: "2026-07-09T22:00:00.000Z",
    last_observed_at: "2026-07-09T22:01:00.000Z",
    stopped_at: "2026-07-09T22:01:00.000Z",
    latest_score: zeroScore(),
    paper_account_snapshot: neutralAccount(),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
  const observation: PaperTradingObservationRecord = {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: "qualification-wrapper-observation",
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: evaluation.paper_trading_evaluation_id
    },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    sequence: 1,
    status: "no_order",
    observed_at: "2026-07-09T22:01:00.000Z",
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000,
      observed_at: "2026-07-09T22:01:00.000Z",
      source_kind: "binance_production_public_rest",
      authority_status: "read_only"
    },
    paper_account_snapshot: neutralAccount(),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    score_delta: zeroScore(),
    cumulative_score: zeroScore(),
    authority_status: "not_live"
  };
  return { commitment, evaluation, observations: [observation] };
}

function neutralAccount(): PaperTradingAccountSnapshot {
  return {
    wallet_balance_usdt: "10000",
    available_balance_usdt: "10000",
    equity_usdt: "10000",
    realized_pnl_usdt: "0",
    unrealized_pnl_usdt: "0",
    fee_paid_usdt: "0",
    slippage_paid_usdt: "0",
    funding_paid_usdt: "0",
    margin_reserved_usdt: "0",
    position: {
      symbol: "BTCUSDT",
      quantity: "0",
      side: "flat",
      mark_price: "0",
      notional_usdt: "0"
    },
    open_order_count: 0,
    authority_status: "not_live"
  };
}

function zeroScore() {
  return {
    revenue_usdt: 0,
    cost_usdt: 0,
    net_revenue_usdt: 0,
    net_return_pct: 0
  };
}

function reorderedAccount(account: PaperTradingAccountSnapshot): PaperTradingAccountSnapshot {
  const position = Object.fromEntries(
    Object.entries(account.position).reverse()
  ) as unknown as PaperTradingAccountSnapshot["position"];
  return Object.fromEntries(
    Object.entries(account).reverse().map(([key, value]) =>
      key === "position" ? [key, position] : [key, value]
    )
  ) as unknown as PaperTradingAccountSnapshot;
}
```
<!-- plan-typecheck:application-qualification-test:end -->

- [ ] **Step 2: Run the domain and application tests and confirm RED**

Run: `npx vitest run packages/domain/src/paper-trading-comparison-commitment.test.ts packages/application/src/trading/paper/qualification.test.ts`

Expected: FAIL because the comparison record types, canonical qualification decision, and delegated
application wrapper are not implemented.

- [ ] **Step 3: Add the exact comparison record types**

Add the approved record shapes next to `PaperTradingEvaluationCommitmentRecord` in `packages/domain/src/index.ts`:

<!-- plan-typecheck:domain-types:start -->
```ts
export interface PaperTradingComparisonCandidateSide {
  role: "champion" | "challenger";
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  candidate_version_digest: string;
  system_code_ref: Ref;
  system_code_record_digest: string;
  system_code_artifact_digest: string;
  candidate_admission_decision_ref: Ref;
  admission_decision_digest: string;
}

export interface PaperTradingComparisonSide {
  role: "champion" | "challenger";
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  candidate_version_digest: string;
  system_code_ref: Ref;
  system_code_record_digest: string;
  system_code_artifact_digest: string;
  candidate_admission_decision_ref: Ref;
  admission_decision_digest: string;
  trading_run_ref: Ref;
  paper_trading_evaluation_commitment_ref: Ref;
  paper_trading_evaluation_commitment_digest: string;
  paper_trading_evaluation_commitment_record_digest: string;
  paper_trading_evaluation_ref: Ref;
  paper_trading_evaluation_record_digest: string;
}

export interface PaperTradingComparisonPolicy {
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

export type PaperTradingComparisonChampionSelection =
  | { selection_kind: "bootstrap" }
  | {
      selection_kind: "trading_review";
      trading_promotion_ref: Ref;
      trading_promotion_digest: string;
      paper_trading_evaluation_ref: Ref;
      paper_trading_evaluation_record_digest: string;
      paper_trading_evaluation_commitment_ref: Ref;
      paper_trading_evaluation_commitment_record_digest: string;
      paper_trading_observation_chain_digest: string;
    };

export interface PaperTradingComparisonPreparationRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_preparation";
  paper_trading_comparison_preparation_id: string;
  paper_trading_comparison_commitment_id: string;
  champion: PaperTradingComparisonCandidateSide;
  challenger: PaperTradingComparisonCandidateSide;
  champion_selection: PaperTradingComparisonChampionSelection;
  comparison_policy: PaperTradingComparisonPolicy;
  market_data_configuration_digest: string;
  paper_policy_identity: PaperTradingEvaluationPolicyIdentity;
  committed_at: string;
  preparation_digest: string;
  authority_status: "not_live";
}

export interface PaperTradingComparisonCommitmentRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_commitment";
  paper_trading_comparison_commitment_id: string;
  preparation_ref: Ref;
  champion: PaperTradingComparisonSide;
  challenger: PaperTradingComparisonSide;
  champion_selection: PaperTradingComparisonChampionSelection;
  comparison_policy: PaperTradingComparisonPolicy;
  market_data_configuration_digest: string;
  paper_policy_identity: PaperTradingEvaluationPolicyIdentity;
  committed_at: string;
  commitment_digest: string;
  authority_status: "not_live";
}

export interface PaperTradingQualificationPolicy {
  minObservationCount: number;
  minElapsedMs: number;
  maxFailedObservationRatio: number;
  assessRunnerHealth: boolean;
}

export interface PaperTradingQualificationEvidenceInput {
  evaluation: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
  observations: PaperTradingObservationRecord[];
  commitmentDigestVerified: boolean;
}

export interface PaperTradingQualificationDecisionInput
  extends PaperTradingQualificationEvidenceInput {
  runnerActive: boolean;
  policy?: Partial<PaperTradingQualificationPolicy>;
}

export interface PaperTradingQualificationResult {
  qualification_status: PaperTradingQualificationStatus;
  qualification_reasons: PaperTradingQualificationReason[];
  evidence_window: {
    observation_count: number;
    elapsed_ms: number;
    failed_observation_count: number;
    first_observed_at?: string;
    last_observed_at?: string;
  };
}
```
<!-- plan-typecheck:domain-types:end -->

Add both new record interfaces to the exported `FixtureRecord` persisted-record union beside
`PaperTradingEvaluationCommitmentRecord`; this keeps generic LocalStore fixture and record typing
aware of the new schema family.

- [ ] **Step 4: Share the canonical encoder, unordered pair key, and comparison digest input**

Leave `canonicalPaperTradingCommitmentJson` and
`paperTradingEvaluationCommitmentDigestInput` byte-for-byte unchanged. Add a separate encoder for
full persisted comparison records. It mirrors JSON persistence only for object properties whose
value is `undefined`; it rejects sparse/undefined array entries, non-finite numbers, functions,
symbols, bigint, cycles, class instances, and every other non-JSON record value:

<!-- plan-typecheck:domain-digests:start -->
```ts
export function paperTradingComparisonPersistedRecordDigestInput(
  value: unknown
): string {
  return canonicalPaperTradingComparisonPersistedRecordJson(value, new Set<object>());
}

function canonicalPaperTradingComparisonPersistedRecordJson(
  value: unknown,
  ancestors: Set<object>
): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("paper_trading_comparison_non_persistable_record");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new Error("paper_trading_comparison_non_persistable_record");
    }
    ancestors.add(value);
    try {
      const encoded = Array.from({ length: value.length }, (_, index) => {
        if (!Object.hasOwn(value, index) || value[index] === undefined) {
          throw new Error("paper_trading_comparison_non_persistable_record");
        }
        return canonicalPaperTradingComparisonPersistedRecordJson(value[index], ancestors);
      });
      return `[${encoded.join(",")}]`;
    } finally {
      ancestors.delete(value);
    }
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("paper_trading_comparison_non_persistable_record");
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      throw new Error("paper_trading_comparison_non_persistable_record");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.values(descriptors).some((descriptor) =>
      !descriptor.enumerable || !("value" in descriptor)
    )) {
      throw new Error("paper_trading_comparison_non_persistable_record");
    }
    if (ancestors.has(value)) {
      throw new Error("paper_trading_comparison_non_persistable_record");
    }
    ancestors.add(value);
    try {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
      return `{${entries.map(([key, item]) =>
        `${JSON.stringify(key)}:${canonicalPaperTradingComparisonPersistedRecordJson(
          item,
          ancestors
        )}`
      ).join(",")}}`;
    } finally {
      ancestors.delete(value);
    }
  }
  throw new Error("paper_trading_comparison_non_persistable_record");
}

export function paperTradingComparisonCandidateVersionDigestInput(
  record: CandidateVersionRecord
): string {
  return paperTradingComparisonPersistedRecordDigestInput(record);
}

export function paperTradingComparisonSystemCodeRecordDigestInput(
  record: SystemCodeRecord
): string {
  return paperTradingComparisonPersistedRecordDigestInput(record);
}

export function paperTradingComparisonAdmissionDecisionDigestInput(
  record: CandidateAdmissionDecisionRecord
): string {
  return paperTradingComparisonPersistedRecordDigestInput(record);
}

export function paperTradingComparisonTradingPromotionDigestInput(
  record: TradingPromotionRecord
): string {
  return paperTradingComparisonPersistedRecordDigestInput(record);
}

export function paperTradingComparisonEvaluationCommitmentRecordDigestInput(
  record: PaperTradingEvaluationCommitmentRecord
): string {
  return paperTradingComparisonPersistedRecordDigestInput(record);
}

export function paperTradingComparisonEvaluationRecordDigestInput(
  record: PaperTradingEvaluationRecord
): string {
  return paperTradingComparisonPersistedRecordDigestInput(record);
}

export function paperTradingComparisonObservationChainDigestInput(
  records: readonly PaperTradingObservationRecord[]
): string {
  const ordered = [...records].sort((left, right) =>
    left.sequence - right.sequence ||
    left.paper_trading_observation_id.localeCompare(right.paper_trading_observation_id)
  );
  return paperTradingComparisonPersistedRecordDigestInput(ordered);
}

export function paperTradingComparisonCandidateVersionPairKey(
  leftCandidateVersionId: string,
  rightCandidateVersionId: string
): string {
  const ordered = leftCandidateVersionId <= rightCandidateVersionId
    ? [leftCandidateVersionId, rightCandidateVersionId]
    : [rightCandidateVersionId, leftCandidateVersionId];
  return canonicalPaperTradingCommitmentJson(ordered);
}

export function paperTradingComparisonPreparationDigestInput(
  record: PaperTradingComparisonPreparationRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    paper_trading_comparison_preparation_id: _id,
    preparation_digest: _preparationDigest,
    ...payload
  } = record;
  return canonicalPaperTradingCommitmentJson(payload);
}

export function paperTradingComparisonCommitmentDigestInput(
  record: PaperTradingComparisonCommitmentRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    paper_trading_comparison_commitment_id: _id,
    committed_at: _committedAt,
    commitment_digest: _commitmentDigest,
    ...payload
  } = record;
  return canonicalPaperTradingCommitmentJson(payload);
}
```
<!-- plan-typecheck:domain-digests:end -->

Add total shared runtime predicates beside those digest functions. Preparation, pair, policy,
selection, candidate-side, and runtime-side predicates protect every store/coordinator dereference.
Replace the current type-only `candidate-admission-policy` import with the value-plus-type import
shown below. One stopped-qualification closure predicate owns the complete promotion commitment/evaluation/
observation/SystemCode/admission/promotion shape and causal chain. Persisted data cannot be accepted
merely because two corrupted records agree with each other:

<!-- plan-typecheck:domain-admission-import:start -->
```ts
import {
  isCandidateAdmissionDecisionConsistent,
  type CandidateAdmissionDecisionRecord,
  type CandidateAdmissionReason
} from "./candidate-admission-policy";
```
<!-- plan-typecheck:domain-admission-import:end -->

Add the following qualification decision and total comparison predicates after the comparison
digest helpers:

<!-- plan-typecheck:domain-runtime:start -->
```ts
export const PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT: PaperTradingAccountSnapshot = {
  wallet_balance_usdt: "10000",
  available_balance_usdt: "10000",
  equity_usdt: "10000",
  realized_pnl_usdt: "0",
  unrealized_pnl_usdt: "0",
  fee_paid_usdt: "0",
  slippage_paid_usdt: "0",
  funding_paid_usdt: "0",
  margin_reserved_usdt: "0",
  position: {
    symbol: "BTCUSDT",
    quantity: "0",
    side: "flat",
    mark_price: "0",
    notional_usdt: "0"
  },
  open_order_count: 0,
  authority_status: "not_live"
};

const PAPER_TRADING_QUALIFICATION_ZERO_SCORE: TradingProfitLossReadModel = {
  revenue_usdt: 0,
  cost_usdt: 0,
  net_revenue_usdt: 0,
  net_return_pct: 0
};

export const PAPER_TRADING_COMPARISON_ZERO_SCORE: TradingProfitLossReadModel = {
  ...PAPER_TRADING_QUALIFICATION_ZERO_SCORE
};

export interface PaperTradingComparisonLoadedSideRecords {
  candidate: PaperTradingComparisonCandidateProjection;
  candidateVersion: CandidateVersionRecord;
  admission: CandidateAdmissionDecisionRecord;
  run: TradingRunRecord;
  systemCode: SystemCodeRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}

export interface PaperTradingComparisonStoppedQualificationClosure {
  systemCode: SystemCodeRecord;
  admission: CandidateAdmissionDecisionRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
  promotion: TradingPromotionRecord;
  preparationCommittedAt: string;
}

export function paperTradingComparisonRefsEqual(
  left: unknown,
  right: unknown
): boolean {
  return paperComparisonObject(left) && paperComparisonObject(right) &&
    paperComparisonNonEmpty(left.record_kind) &&
    paperComparisonNonEmpty(left.id) &&
    paperComparisonNonEmpty(right.record_kind) &&
    paperComparisonNonEmpty(right.id) &&
    left.record_kind === right.record_kind &&
    left.id === right.id;
}

function paperComparisonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function paperComparisonRefIs(value: unknown, recordKind: string): value is Ref {
  return paperComparisonObject(value) && value.record_kind === recordKind &&
    paperComparisonNonEmpty(value.id);
}

function paperComparisonRef(value: unknown): value is Ref {
  return paperComparisonObject(value) &&
    paperComparisonNonEmpty(value.record_kind) &&
    paperComparisonNonEmpty(value.id);
}

function paperComparisonOptionalRef(value: unknown, recordKind?: string): boolean {
  return value === undefined || (recordKind
    ? paperComparisonRefIs(value, recordKind)
    : paperComparisonRef(value));
}

function paperComparisonRefArray(value: unknown, recordKind?: string): value is Ref[] {
  return Array.isArray(value) && value.every((item) => recordKind
    ? paperComparisonRefIs(item, recordKind)
    : paperComparisonRef(item));
}

function paperComparisonNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function paperComparisonCanonicalEqual(left: unknown, right: unknown): boolean {
  try {
    return paperTradingComparisonPersistedRecordDigestInput(left) ===
      paperTradingComparisonPersistedRecordDigestInput(right);
  } catch {
    return false;
  }
}

function paperComparisonExactIso(value: unknown): value is string {
  if (!paperComparisonNonEmpty(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

type PaperTradingComparisonCandidateProjection = CandidateInspectReadModel & {
  system_code: NonNullable<CandidateInspectReadModel["system_code"]> & { ref: Ref };
};

function paperComparisonCandidateProjection(
  value: unknown
): value is PaperTradingComparisonCandidateProjection {
  if (!paperComparisonObject(value) ||
    !paperComparisonObject(value.runtime) ||
    !paperComparisonObject(value.system_code) ||
    !paperComparisonObject(value.candidate_version)) {
    return false;
  }
  return paperComparisonNonEmpty(value.candidate_id) &&
    paperComparisonNonEmpty(value.display_name) &&
    (value.status === "fixture_only" || value.status === "materialized") &&
    paperComparisonNonEmpty(value.active_version_id) &&
    paperComparisonRefIs(value.runtime.ref, "trading_run") &&
    paperComparisonRefIs(value.system_code.ref, "system_code") &&
    paperComparisonNonEmpty(value.candidate_version.candidate_version_id) &&
    paperComparisonNonEmpty(value.candidate_version.version_label);
}

function paperComparisonCandidateVersion(value: unknown): value is CandidateVersionRecord {
  if (!paperComparisonObject(value) || !paperComparisonRefArray(
    value.capability_package_refs,
    "capability_package"
  )) {
    return false;
  }
  return value.record_kind === "candidate_version" && value.version === 1 &&
    paperComparisonNonEmpty(value.candidate_version_id) &&
    paperComparisonNonEmpty(value.candidate_id) &&
    paperComparisonNonEmpty(value.version_label) &&
    paperComparisonRefIs(value.spec_ref, "trading_system_spec") &&
    paperComparisonRefIs(value.program_ref, "trading_system_program") &&
    paperComparisonRefIs(value.runtime_ref, "trading_run") &&
    paperComparisonRefIs(value.trace_placeholder_ref, "trace_placeholder") &&
    paperComparisonOptionalRef(value.evaluation_run_ref, "evaluation_run_record") &&
    paperComparisonOptionalRef(value.materialization_attempt_ref, "candidate_materialization_attempt") &&
    paperComparisonOptionalRef(value.agent_spec_ref, "agent_spec") &&
    paperComparisonOptionalRef(value.agent_session_ref, "agent_session") &&
    paperComparisonOptionalRef(value.agent_run_ref, "agent_run") &&
    paperComparisonOptionalRef(value.agent_event_ref, "agent_event") &&
    paperComparisonOptionalRef(value.provider_readiness_ref, "provider_readiness_record") &&
    paperComparisonOptionalRef(value.provider_probe_attempt_ref, "provider_probe_attempt") &&
    paperComparisonOptionalRef(value.system_code_ref, "system_code");
}

function paperComparisonSystemCode(value: unknown): value is SystemCodeRecord {
  if (!paperComparisonObject(value) ||
    !Array.isArray(value.entrypoint) ||
    !paperComparisonObject(value.declared_output_contract) ||
    !Array.isArray(value.declared_output_contract.declared_output_kinds) ||
    !paperComparisonRefArray(value.provenance_refs)) {
    return false;
  }
  const outputKinds = new Set([
    "program_event", "runtime_log", "runtime_heartbeat", "metric_snapshot",
    "diagnostic_artifact", "order_request"
  ]);
  const artifactShape = value.artifact_kind === "python_file"
    ? paperComparisonNonEmpty(value.artifact_path) && value.image_ref === undefined &&
      value.runtime_kind === "python"
    : value.artifact_kind === "container_image" &&
      paperComparisonNonEmpty(value.image_ref) && value.artifact_path === undefined &&
      value.runtime_kind === "container_image";
  return value.record_kind === "system_code" && value.version === 1 &&
    paperComparisonNonEmpty(value.system_code_id) && artifactShape &&
    paperComparisonNonEmpty(value.artifact_digest) &&
    paperComparisonOptionalRef(value.artifact_ref) &&
    paperComparisonOptionalRef(value.artifact_runtime_contract_ref, "artifact_runtime_contract") &&
    value.entrypoint.length > 0 && value.entrypoint.every(paperComparisonNonEmpty) &&
    value.declared_output_contract.contract_kind === "opaque_runtime_boundary" &&
    value.declared_output_contract.declared_output_kinds.length > 0 &&
    value.declared_output_contract.declared_output_kinds.every((item) =>
      paperComparisonNonEmpty(item) && outputKinds.has(item)
    ) &&
    paperComparisonOptionalRef(value.declared_output_contract.event_envelope_ref) &&
    paperComparisonOptionalRef(value.declared_output_contract.log_contract_ref) &&
    paperComparisonOptionalRef(value.declared_output_contract.heartbeat_contract_ref) &&
    paperComparisonRefIs(value.secret_policy_ref, "secret_policy") &&
    paperComparisonRefIs(value.capability_policy_ref, "capability_policy") &&
    value.status === "registered" && paperComparisonExactIso(value.created_at) &&
    value.authority_status === "not_live";
}

function paperComparisonAdmission(value: unknown): value is CandidateAdmissionDecisionRecord {
  if (!paperComparisonObject(value)) {
    return false;
  }
  const fieldsHaveRuntimeShape =
    value.record_kind === "candidate_admission_decision" && value.version === 1 &&
    paperComparisonNonEmpty(value.candidate_admission_decision_id) &&
    paperComparisonRefIs(value.source_system_code_ref, "system_code") &&
    paperComparisonRefIs(value.system_code_ref, "system_code") &&
    paperComparisonRefIs(value.experiment_run_ref, "experiment_run") &&
    paperComparisonRefIs(value.trading_evaluation_result_ref, "trading_evaluation_result") &&
    paperComparisonRefIs(value.research_finding_ref, "research_finding") &&
    paperComparisonNonEmpty(value.source_artifact_digest) &&
    paperComparisonNonEmpty(value.submitted_artifact_digest) &&
    value.research_worker_outcome === "changed" && value.experiment_status === "evaluated" &&
    value.evaluation_status === "accepted" && value.evidence_disposition === "not_counted" &&
    value.status === "admitted" && value.reason === "evaluation_accepted" &&
    value.runnable_paper_handoff === true && paperComparisonExactIso(value.decided_at) &&
    value.authority_status === "not_live";
  if (!fieldsHaveRuntimeShape) {
    return false;
  }
  return isCandidateAdmissionDecisionConsistent(
    value as unknown as CandidateAdmissionDecisionRecord
  );
}

export function paperTradingComparisonTradingPromotionHasRuntimeShape(
  value: unknown
): value is TradingPromotionRecord {
  return paperComparisonObject(value) && value.record_kind === "trading_promotion" &&
    value.version === 1 && paperComparisonNonEmpty(value.trading_promotion_id) &&
    value.status === "promoted_for_trading_review" &&
    paperComparisonRefIs(value.candidate_ref, "trading_system_candidate") &&
    paperComparisonRefIs(value.candidate_version_ref, "candidate_version") &&
    paperComparisonRefIs(value.paper_trading_evaluation_ref, "paper_trading_evaluation") &&
    paperComparisonExactIso(value.promoted_at) &&
    paperComparisonOptionalRef(value.promoted_by_command_ref) &&
    value.authority_status === "not_live";
}

function paperComparisonRun(value: unknown): value is TradingRunRecord {
  if (!paperComparisonObject(value)) {
    return false;
  }
  const emptyRefs = [
    value.order_request_refs, value.gateway_result_refs, value.execution_result_refs,
    value.run_control_command_refs, value.run_control_decision_refs,
    value.runtime_audit_event_refs
  ];
  return value.record_kind === "trading_run" && value.version === 1 &&
    paperComparisonNonEmpty(value.trading_run_id) && value.stage_binding_profile === "paper" &&
    value.runtime_lifecycle_status === "registered" &&
    value.paper_evidence_purpose === "qualification" &&
    paperComparisonRefIs(value.candidate_ref, "trading_system_candidate") &&
    paperComparisonRefIs(value.candidate_version_ref, "candidate_version") &&
    paperComparisonRefIs(value.placement_ref, "sandbox_placement") &&
    paperComparisonRefIs(value.hands_environment_ref, "hands_environment") &&
    paperComparisonRefIs(value.memory_surface_ref, "runtime_memory_surface") &&
    paperComparisonRefIs(value.system_code_ref, "system_code") &&
    value.stage_binding_ref === undefined && value.runtime_operating_policy_ref === undefined &&
    value.trace_ref === undefined && value.sandbox_ref === undefined &&
    emptyRefs.every((refs) => refs === undefined ||
      (paperComparisonRefArray(refs) && refs.length === 0)
    ) &&
    paperComparisonExactIso(value.created_at) && value.authority_status === "not_live";
}

function paperComparisonProviderIdentity(
  value: unknown
): value is PaperTradingEvaluationProviderIdentity {
  if (!paperComparisonObject(value) || typeof value.qualification_eligible !== "boolean" ||
    (value.ineligibility_reason !== undefined &&
      value.ineligibility_reason !== "provider_identity_unavailable")) {
    return false;
  }
  return value.runtime_provider_kind === "none"
    ? value.agent_profile_ref === undefined && value.model === undefined &&
      value.provider_configuration_digest === undefined
    : value.runtime_provider_kind === "managed_agent" &&
      paperComparisonRefIs(value.agent_profile_ref, "agent_profile") &&
      paperComparisonNonEmpty(value.model) &&
      paperComparisonNonEmpty(value.provider_configuration_digest);
}

function paperComparisonPolicyIdentity(value: unknown): boolean {
  return paperComparisonObject(value) && [
    "market_data_policy_version", "gateway_policy_version", "cost_policy_version",
    "funding_policy_version", "slippage_policy_version", "fill_policy_version",
    "risk_policy_version", "paper_account_policy_version",
    "decision_event_protocol_version", "persistent_state_boundary_version"
  ].every((key) => paperComparisonNonEmpty(value[key]));
}

function paperComparisonCommitment(
  value: unknown
): value is PaperTradingEvaluationCommitmentRecord {
  if (!paperComparisonObject(value) || !paperComparisonObject(value.runtime_identity) ||
    !Array.isArray(value.runtime_identity.entrypoint) ||
    !paperComparisonObject(value.data_identity) ||
    !paperComparisonObject(value.window_policy) ||
    !paperComparisonProviderIdentity(value.provider_identity) ||
    !paperComparisonPolicyIdentity(value.policy_identity)) {
    return false;
  }
  const runtimePair = value.runtime_identity.artifact_kind === "python_file"
    ? value.runtime_identity.runtime_kind === "python"
    : value.runtime_identity.artifact_kind === "container_image" &&
      value.runtime_identity.runtime_kind === "container_image";
  const sourceKinds = new Set([
    "binance_production_public_rest", "binance_production_public_websocket",
    "binance_production_public_hybrid", "binance_production_public_stream"
  ]);
  return value.record_kind === "paper_trading_evaluation_commitment" && value.version === 1 &&
    paperComparisonNonEmpty(value.paper_trading_evaluation_commitment_id) &&
    value.evidence_purpose === "qualification" &&
    paperComparisonRefIs(value.candidate_ref, "trading_system_candidate") &&
    paperComparisonRefIs(value.candidate_version_ref, "candidate_version") &&
    paperComparisonRefIs(value.trading_run_ref, "trading_run") &&
    paperComparisonRefIs(value.system_code_ref, "system_code") &&
    paperComparisonNonEmpty(value.system_code_artifact_digest) &&
    paperComparisonNonEmpty(value.resolved_artifact_digest) && runtimePair &&
    value.runtime_identity.entrypoint.length > 0 &&
    value.runtime_identity.entrypoint.every(paperComparisonNonEmpty) &&
    paperComparisonOptionalRef(
      value.runtime_identity.artifact_runtime_contract_ref,
      "artifact_runtime_contract"
    ) &&
    value.provider_identity.qualification_eligible === true &&
    value.provider_identity.ineligibility_reason === undefined &&
    paperComparisonRefIs(value.capability_policy_ref, "capability_policy") &&
    paperComparisonRefIs(value.secret_policy_ref, "secret_policy") &&
    value.data_identity.symbol === "BTCUSDT" &&
    value.data_identity.market_data_port === "gateway_owned" &&
    sourceKinds.has(value.data_identity.allowed_market_data_source as string) &&
    paperComparisonNonEmpty(value.data_identity.market_data_configuration_digest) &&
    value.data_identity.private_exchange_access === "forbidden" &&
    value.data_identity.live_order_access === "forbidden" &&
    paperComparisonPositiveInteger(value.window_policy.interval_ms) &&
    value.window_policy.release_policy === "sealed_until_adjudication" &&
    paperComparisonNonEmpty(value.window_policy.eligibility_policy_version) &&
    paperComparisonCanonicalEqual(
      value.initial_account_snapshot,
      PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT
    ) && paperComparisonExactIso(value.committed_at) &&
    paperComparisonNonEmpty(value.commitment_digest) && value.authority_status === "not_live";
}

function paperComparisonEvaluation(value: unknown): value is PaperTradingEvaluationRecord {
  if (!paperComparisonObject(value) || !paperComparisonObject(value.latest_score) ||
    !Array.isArray(value.open_orders) ||
    !Array.isArray(value.processed_trading_system_event_ids) ||
    !Array.isArray(value.processed_public_trade_ids)) {
    return false;
  }
  return value.record_kind === "paper_trading_evaluation" && value.version === 1 &&
    paperComparisonNonEmpty(value.paper_trading_evaluation_id) &&
    paperComparisonRefIs(value.candidate_ref, "trading_system_candidate") &&
    paperComparisonRefIs(value.candidate_version_ref, "candidate_version") &&
    paperComparisonRefIs(value.trading_run_ref, "trading_run") &&
    paperComparisonRefIs(
      value.paper_trading_evaluation_commitment_ref,
      "paper_trading_evaluation_commitment"
    ) && value.status === "not_started" && paperComparisonPositiveInteger(value.interval_ms) &&
    value.observation_count === 0 &&
    paperComparisonExactIso(value.started_at) &&
    paperComparisonCanonicalEqual(value.latest_score, PAPER_TRADING_COMPARISON_ZERO_SCORE) &&
    paperComparisonCanonicalEqual(
      value.paper_account_snapshot,
      PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT
    ) && value.open_orders.length === 0 &&
    value.processed_trading_system_event_ids.length === 0 &&
    value.processed_public_trade_ids.length === 0 &&
    value.last_observed_at === undefined && value.next_observation_at === undefined &&
    value.stopped_at === undefined && value.latest_fill === undefined &&
    value.latest_public_execution_snapshot === undefined &&
    value.invalidation_reason === undefined && value.latest_failure_reason === undefined &&
    value.authority_status === "not_live";
}

function paperComparisonPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function paperComparisonNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function paperComparisonFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function paperComparisonOptionalNonEmpty(value: unknown): boolean {
  return value === undefined || paperComparisonNonEmpty(value);
}

function paperComparisonOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

export function paperTradingComparisonPolicyHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonPolicy {
  if (!paperComparisonObject(value)) {
    return false;
  }
  return paperComparisonNonEmpty(value.policy_version) &&
    (value.comparison_mode === "bootstrap" || value.comparison_mode === "champion_challenge") &&
    value.symbol === "BTCUSDT" && paperComparisonPositiveInteger(value.interval_ms) &&
    paperComparisonPositiveInteger(value.minimum_observation_count) &&
    paperComparisonPositiveInteger(value.minimum_elapsed_ms) &&
    paperComparisonPositiveInteger(value.maximum_observation_count) &&
    paperComparisonPositiveInteger(value.maximum_elapsed_ms) &&
    paperComparisonNonNegativeInteger(value.maximum_start_skew_ms) &&
    paperComparisonPositiveInteger(value.maximum_provider_request_count_per_side) &&
    paperComparisonNonNegativeInteger(value.maximum_retry_count_per_side) &&
    value.minimum_observation_count <= value.maximum_observation_count &&
    value.minimum_elapsed_ms <= value.maximum_elapsed_ms &&
    value.maximum_start_skew_ms <= value.maximum_elapsed_ms &&
    value.primary_metric === "net_revenue_usdt" &&
    paperComparisonFinite(value.minimum_net_revenue_lift_usdt) &&
    value.minimum_net_revenue_lift_usdt >= 0 &&
    paperComparisonPositiveInteger(value.required_confirmation_count) &&
    value.require_non_overlapping_windows === true && value.require_both_qualified === true &&
    value.release_policy === "sealed_until_adjudication";
}

export function paperTradingComparisonCandidateSideHasRuntimeShape(
  value: unknown,
  role: "champion" | "challenger"
): value is PaperTradingComparisonCandidateSide {
  return paperComparisonObject(value) && value.role === role &&
    paperComparisonRefIs(value.candidate_ref, "trading_system_candidate") &&
    paperComparisonRefIs(value.candidate_version_ref, "candidate_version") &&
    paperComparisonNonEmpty(value.candidate_version_digest) &&
    paperComparisonRefIs(value.system_code_ref, "system_code") &&
    paperComparisonNonEmpty(value.system_code_record_digest) &&
    paperComparisonNonEmpty(value.system_code_artifact_digest) &&
    paperComparisonRefIs(
      value.candidate_admission_decision_ref,
      "candidate_admission_decision"
    ) && paperComparisonNonEmpty(value.admission_decision_digest);
}

export function paperTradingComparisonSideHasRuntimeShape(
  value: unknown,
  role: "champion" | "challenger"
): value is PaperTradingComparisonSide {
  if (!paperComparisonObject(value) ||
    !paperTradingComparisonCandidateSideHasRuntimeShape(value, role)) {
    return false;
  }
  const runtimeSide: Record<string, unknown> = value;
  return paperComparisonRefIs(runtimeSide.trading_run_ref, "trading_run") &&
    paperComparisonRefIs(
      runtimeSide.paper_trading_evaluation_commitment_ref,
      "paper_trading_evaluation_commitment"
    ) && paperComparisonNonEmpty(runtimeSide.paper_trading_evaluation_commitment_digest) &&
    paperComparisonNonEmpty(runtimeSide.paper_trading_evaluation_commitment_record_digest) &&
    paperComparisonRefIs(
      runtimeSide.paper_trading_evaluation_ref,
      "paper_trading_evaluation"
    ) && paperComparisonNonEmpty(runtimeSide.paper_trading_evaluation_record_digest);
}

export function paperTradingComparisonChampionSelectionHasRuntimeShape(
  value: unknown,
  mode: PaperTradingComparisonPolicy["comparison_mode"]
): value is PaperTradingComparisonChampionSelection {
  if (!paperComparisonObject(value)) {
    return false;
  }
  if (mode === "bootstrap") {
    return value.selection_kind === "bootstrap" &&
      value.trading_promotion_ref === undefined &&
      value.trading_promotion_digest === undefined &&
      value.paper_trading_evaluation_ref === undefined &&
      value.paper_trading_evaluation_record_digest === undefined &&
      value.paper_trading_evaluation_commitment_ref === undefined &&
      value.paper_trading_evaluation_commitment_record_digest === undefined &&
      value.paper_trading_observation_chain_digest === undefined;
  }
  return value.selection_kind === "trading_review" &&
    paperComparisonRefIs(value.trading_promotion_ref, "trading_promotion") &&
    paperComparisonNonEmpty(value.trading_promotion_digest) &&
    paperComparisonRefIs(value.paper_trading_evaluation_ref, "paper_trading_evaluation") &&
    paperComparisonNonEmpty(value.paper_trading_evaluation_record_digest) &&
    paperComparisonRefIs(
      value.paper_trading_evaluation_commitment_ref,
      "paper_trading_evaluation_commitment"
    ) && paperComparisonNonEmpty(value.paper_trading_evaluation_commitment_record_digest) &&
    paperComparisonNonEmpty(value.paper_trading_observation_chain_digest);
}

export function paperTradingComparisonPreparationHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonPreparationRecord {
  if (!paperComparisonObject(value) ||
    !paperTradingComparisonPolicyHasRuntimeShape(value.comparison_policy)) {
    return false;
  }
  const champion = value.champion;
  const challenger = value.challenger;
  return value.record_kind === "paper_trading_comparison_preparation" && value.version === 1 &&
    paperComparisonNonEmpty(value.paper_trading_comparison_preparation_id) &&
    paperComparisonNonEmpty(value.paper_trading_comparison_commitment_id) &&
    paperTradingComparisonCandidateSideHasRuntimeShape(champion, "champion") &&
    paperTradingComparisonCandidateSideHasRuntimeShape(challenger, "challenger") &&
    champion.candidate_version_ref.id !== challenger.candidate_version_ref.id &&
    paperTradingComparisonChampionSelectionHasRuntimeShape(
      value.champion_selection,
      value.comparison_policy.comparison_mode
    ) && paperComparisonNonEmpty(value.market_data_configuration_digest) &&
    paperComparisonPolicyIdentity(value.paper_policy_identity) &&
    paperComparisonExactIso(value.committed_at) &&
    paperComparisonNonEmpty(value.preparation_digest) && value.authority_status === "not_live";
}

export function paperTradingComparisonCommitmentHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonCommitmentRecord {
  if (!paperComparisonObject(value) ||
    !paperTradingComparisonPolicyHasRuntimeShape(value.comparison_policy)) {
    return false;
  }
  const champion = value.champion;
  const challenger = value.challenger;
  return value.record_kind === "paper_trading_comparison_commitment" && value.version === 1 &&
    paperComparisonNonEmpty(value.paper_trading_comparison_commitment_id) &&
    paperComparisonRefIs(value.preparation_ref, "paper_trading_comparison_preparation") &&
    paperTradingComparisonSideHasRuntimeShape(champion, "champion") &&
    paperTradingComparisonSideHasRuntimeShape(challenger, "challenger") &&
    champion.candidate_version_ref.id !== challenger.candidate_version_ref.id &&
    champion.trading_run_ref.id !== challenger.trading_run_ref.id &&
    champion.paper_trading_evaluation_commitment_ref.id !==
      challenger.paper_trading_evaluation_commitment_ref.id &&
    champion.paper_trading_evaluation_ref.id !== challenger.paper_trading_evaluation_ref.id &&
    paperTradingComparisonChampionSelectionHasRuntimeShape(
      value.champion_selection,
      value.comparison_policy.comparison_mode
    ) && paperComparisonNonEmpty(value.market_data_configuration_digest) &&
    paperComparisonPolicyIdentity(value.paper_policy_identity) &&
    paperComparisonExactIso(value.committed_at) && paperComparisonNonEmpty(value.commitment_digest) &&
    value.authority_status === "not_live";
}

function paperComparisonProfitLossHasRuntimeShape(value: unknown): boolean {
  return paperComparisonObject(value) &&
    ["revenue_usdt", "cost_usdt", "net_revenue_usdt", "net_return_pct"]
      .every((key) => paperComparisonFinite(value[key]));
}

function paperComparisonAccountHasRuntimeShape(value: unknown): boolean {
  if (!paperComparisonObject(value) || !paperComparisonObject(value.position)) {
    return false;
  }
  return [
    "wallet_balance_usdt", "available_balance_usdt", "equity_usdt",
    "realized_pnl_usdt", "unrealized_pnl_usdt", "fee_paid_usdt",
    "slippage_paid_usdt", "funding_paid_usdt", "margin_reserved_usdt"
  ].every((key) => paperComparisonNonEmpty(value[key])) &&
    value.position.symbol === "BTCUSDT" && paperComparisonNonEmpty(value.position.quantity) &&
    (value.position.side === "long" || value.position.side === "short" ||
      value.position.side === "flat") &&
    paperComparisonOptionalNonEmpty(value.position.average_entry_price) &&
    paperComparisonNonEmpty(value.position.mark_price) &&
    paperComparisonNonEmpty(value.position.notional_usdt) &&
    paperComparisonNonNegativeInteger(value.open_order_count) &&
    value.authority_status === "not_live";
}

function paperComparisonOrderHasRuntimeShape(value: unknown): boolean {
  return paperComparisonObject(value) && paperComparisonNonEmpty(value.order_id) &&
    paperComparisonNonEmpty(value.event_id) &&
    (value.side === "buy" || value.side === "sell") &&
    (value.order_type === "market" || value.order_type === "limit") &&
    paperComparisonNonEmpty(value.quantity) &&
    paperComparisonOptionalNonEmpty(value.limit_price) &&
    ["open", "partially_filled", "filled", "canceled", "rejected"].includes(
      value.status as string
    ) && paperComparisonNonEmpty(value.cumulative_filled_quantity) &&
    paperComparisonNonEmpty(value.remaining_quantity) &&
    paperComparisonOptionalNonEmpty(value.average_fill_price) &&
    paperComparisonExactIso(value.created_at) && paperComparisonExactIso(value.updated_at) &&
    paperComparisonOptionalRef(value.ledger_ref);
}

function paperComparisonFillHasRuntimeShape(value: unknown): boolean {
  return value === undefined || (paperComparisonObject(value) &&
    paperComparisonNonEmpty(value.fill_id) && paperComparisonNonEmpty(value.order_id) &&
    (value.fill_status === "partially_filled" || value.fill_status === "filled") &&
    paperComparisonNonEmpty(value.fill_price) && paperComparisonNonEmpty(value.fill_quantity) &&
    paperComparisonNonEmpty(value.fee_usdt) && paperComparisonNonEmpty(value.slippage_usdt) &&
    paperComparisonNonEmpty(value.funding_usdt) && paperComparisonExactIso(value.trade_time) &&
    paperComparisonOptionalNonEmpty(value.source_trade_id));
}

function paperComparisonOrderBookHasRuntimeShape(value: unknown): boolean {
  return value === undefined || (paperComparisonObject(value) && value.symbol === "BTCUSDT" &&
    paperComparisonExactIso(value.observed_at) &&
    [
      "binance_production_public_rest", "binance_production_public_websocket",
      "binance_production_public_hybrid", "binance_production_public_stream"
    ].includes(value.source_kind as string) &&
    ["not_started", "buffering", "synced", "recovering", "stale"]
      .includes(value.sync_status as string) &&
    paperComparisonOptionalNonEmpty(value.last_update_id) &&
    paperComparisonOptionalNonEmpty(value.previous_final_update_id) &&
    paperComparisonOptionalNonEmpty(value.top_bid_price) &&
    paperComparisonOptionalNonEmpty(value.top_bid_quantity) &&
    paperComparisonOptionalNonEmpty(value.top_ask_price) &&
    paperComparisonOptionalNonEmpty(value.top_ask_quantity) &&
    (value.depth_level_count === undefined ||
      paperComparisonNonNegativeInteger(value.depth_level_count)) &&
    typeof value.gap_detected === "boolean" && value.authority_status === "read_only");
}

function paperComparisonMarketSnapshotHasRuntimeShape(value: unknown): boolean {
  return value === undefined || (paperComparisonObject(value) && value.symbol === "BTCUSDT" &&
    paperComparisonFinite(value.price) &&
    (value.moving_average_fast === undefined || paperComparisonFinite(value.moving_average_fast)) &&
    (value.moving_average_slow === undefined || paperComparisonFinite(value.moving_average_slow)) &&
    (value.volatility === undefined || paperComparisonFinite(value.volatility)) &&
    (value.expected_direction === undefined || ["long", "short", "flat"].includes(
      value.expected_direction as string
    )) && paperComparisonExactIso(value.observed_at) &&
    [
      "binance_production_public_rest", "binance_production_public_websocket",
      "binance_production_public_hybrid", "binance_production_public_stream"
    ].includes(value.source_kind as string) &&
    (value.source_priority === undefined || [
      "websocket_primary", "rest_fallback", "hybrid_recovered"
    ].includes(value.source_priority as string)) &&
    (value.freshness === undefined || [
      "fresh", "stale", "recovering", "unavailable"
    ].includes(value.freshness as string)) &&
    paperComparisonOptionalBoolean(value.ws_connected) &&
    paperComparisonOptionalBoolean(value.rest_fallback_used) &&
    paperComparisonOptionalBoolean(value.gap_detected) &&
    paperComparisonOptionalNonEmpty(value.last_update_id) &&
    paperComparisonOptionalNonEmpty(value.stream_marker) && value.authority_status === "read_only");
}

function paperComparisonPublicExecutionHasRuntimeShape(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!paperComparisonObject(value) || value.symbol !== "BTCUSDT" ||
    !paperComparisonExactIso(value.observed_at) ||
    ![
      "binance_production_public_rest", "binance_production_public_websocket",
      "binance_production_public_hybrid", "binance_production_public_stream"
    ].includes(value.source_kind as string) || !paperComparisonNonEmpty(value.stream_marker) ||
    !Array.isArray(value.agg_trades)) {
    return false;
  }
  const bookTicker = value.book_ticker;
  const bookTickerValid = bookTicker === undefined || (paperComparisonObject(bookTicker) &&
    paperComparisonNonEmpty(bookTicker.bid_price) &&
    paperComparisonNonEmpty(bookTicker.bid_quantity) &&
    paperComparisonNonEmpty(bookTicker.ask_price) &&
    paperComparisonNonEmpty(bookTicker.ask_quantity) &&
    paperComparisonOptionalNonEmpty(bookTicker.event_time));
  return bookTickerValid && value.agg_trades.every((trade) =>
    paperComparisonObject(trade) && paperComparisonNonEmpty(trade.trade_id) &&
    paperComparisonNonEmpty(trade.price) && paperComparisonNonEmpty(trade.quantity) &&
    paperComparisonNonEmpty(trade.trade_time) &&
    paperComparisonOptionalBoolean(trade.is_buyer_maker)
  ) && paperComparisonOrderBookHasRuntimeShape(value.order_book) &&
    (value.source_priority === undefined || [
      "websocket_primary", "rest_fallback", "hybrid_recovered"
    ].includes(value.source_priority as string)) &&
    (value.freshness === undefined || [
      "fresh", "stale", "recovering", "unavailable"
    ].includes(value.freshness as string)) &&
    paperComparisonOptionalBoolean(value.ws_connected) &&
    paperComparisonOptionalBoolean(value.rest_fallback_used) &&
    paperComparisonOptionalBoolean(value.gap_detected) &&
    paperComparisonOptionalNonEmpty(value.last_update_id) &&
    value.authority_status === "read_only";
}

function paperComparisonDecisionHasRuntimeShape(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!paperComparisonObject(value) || ![
    "order_request", "hold", "no_action", "cancel_order", "error"
  ].includes(value.decision_kind as string) ||
    value.source_kind !== "trading_system_decision" ||
    typeof value.reason !== "string" || !paperComparisonExactIso(value.observed_at) ||
    value.authority_status !== "trace_only") {
    return false;
  }
  if (value.order_request === undefined) {
    return value.decision_kind !== "order_request";
  }
  return value.decision_kind === "order_request" && paperComparisonObject(value.order_request) &&
    value.order_request.intent_kind === "place_order" &&
    value.order_request.symbol === "BTCUSDT" &&
    (value.order_request.side === "buy" || value.order_request.side === "sell") &&
    (value.order_request.order_type === "market" ||
      value.order_request.order_type === "limit") &&
    paperComparisonNonEmpty(value.order_request.quantity) &&
    paperComparisonOptionalNonEmpty(value.order_request.limit_price);
}

function paperComparisonStoppedCommitmentHasRuntimeShape(
  value: unknown
): value is PaperTradingEvaluationCommitmentRecord {
  if (!paperComparisonObject(value) || !paperComparisonObject(value.runtime_identity) ||
    !Array.isArray(value.runtime_identity.entrypoint) ||
    !paperComparisonProviderIdentity(value.provider_identity) ||
    !paperComparisonPolicyIdentity(value.policy_identity) ||
    !paperComparisonObject(value.data_identity) || !paperComparisonObject(value.window_policy)) {
    return false;
  }
  const runtimePair = value.runtime_identity.artifact_kind === "python_file"
    ? value.runtime_identity.runtime_kind === "python"
    : value.runtime_identity.artifact_kind === "container_image" &&
      value.runtime_identity.runtime_kind === "container_image";
  return value.record_kind === "paper_trading_evaluation_commitment" && value.version === 1 &&
    paperComparisonNonEmpty(value.paper_trading_evaluation_commitment_id) &&
    value.evidence_purpose === "qualification" &&
    paperComparisonRefIs(value.candidate_ref, "trading_system_candidate") &&
    paperComparisonRefIs(value.candidate_version_ref, "candidate_version") &&
    paperComparisonRefIs(value.trading_run_ref, "trading_run") &&
    paperComparisonRefIs(value.system_code_ref, "system_code") &&
    paperComparisonNonEmpty(value.system_code_artifact_digest) &&
    paperComparisonNonEmpty(value.resolved_artifact_digest) && runtimePair &&
    value.runtime_identity.entrypoint.length > 0 &&
    value.runtime_identity.entrypoint.every(paperComparisonNonEmpty) &&
    paperComparisonOptionalRef(
      value.runtime_identity.artifact_runtime_contract_ref,
      "artifact_runtime_contract"
    ) && value.provider_identity.qualification_eligible === true &&
    value.provider_identity.ineligibility_reason === undefined &&
    paperComparisonRefIs(value.capability_policy_ref, "capability_policy") &&
    paperComparisonRefIs(value.secret_policy_ref, "secret_policy") &&
    value.data_identity.symbol === "BTCUSDT" &&
    value.data_identity.market_data_port === "gateway_owned" &&
    [
      "binance_production_public_rest", "binance_production_public_websocket",
      "binance_production_public_hybrid", "binance_production_public_stream"
    ].includes(value.data_identity.allowed_market_data_source as string) &&
    paperComparisonNonEmpty(value.data_identity.market_data_configuration_digest) &&
    value.data_identity.private_exchange_access === "forbidden" &&
    value.data_identity.live_order_access === "forbidden" &&
    paperComparisonPositiveInteger(value.window_policy.interval_ms) &&
    value.window_policy.release_policy === "sealed_until_adjudication" &&
    paperComparisonNonEmpty(value.window_policy.eligibility_policy_version) &&
    paperComparisonAccountHasRuntimeShape(value.initial_account_snapshot) &&
    paperComparisonExactIso(value.committed_at) &&
    paperComparisonNonEmpty(value.commitment_digest) && value.authority_status === "not_live";
}

function paperComparisonStoppedEvaluationHasRuntimeShape(
  value: unknown
): value is PaperTradingEvaluationRecord {
  return paperComparisonObject(value) && value.record_kind === "paper_trading_evaluation" &&
    value.version === 1 && paperComparisonNonEmpty(value.paper_trading_evaluation_id) &&
    paperComparisonRefIs(value.candidate_ref, "trading_system_candidate") &&
    paperComparisonRefIs(value.candidate_version_ref, "candidate_version") &&
    paperComparisonRefIs(value.trading_run_ref, "trading_run") &&
    paperComparisonRefIs(
      value.paper_trading_evaluation_commitment_ref,
      "paper_trading_evaluation_commitment"
    ) && value.status === "stopped" && paperComparisonPositiveInteger(value.interval_ms) &&
    paperComparisonNonNegativeInteger(value.observation_count) &&
    paperComparisonExactIso(value.started_at) && paperComparisonExactIso(value.last_observed_at) &&
    value.next_observation_at === undefined && paperComparisonExactIso(value.stopped_at) &&
    paperComparisonProfitLossHasRuntimeShape(value.latest_score) &&
    paperComparisonAccountHasRuntimeShape(value.paper_account_snapshot) &&
    Array.isArray(value.open_orders) && value.open_orders.every(paperComparisonOrderHasRuntimeShape) &&
    paperComparisonFillHasRuntimeShape(value.latest_fill) &&
    Array.isArray(value.processed_trading_system_event_ids) &&
    value.processed_trading_system_event_ids.every(paperComparisonNonEmpty) &&
    Array.isArray(value.processed_public_trade_ids) &&
    value.processed_public_trade_ids.every(paperComparisonNonEmpty) &&
    paperComparisonPublicExecutionHasRuntimeShape(value.latest_public_execution_snapshot) &&
    value.invalidation_reason === undefined &&
    paperComparisonOptionalNonEmpty(value.latest_failure_reason) &&
    value.authority_status === "not_live";
}

function paperComparisonStoppedObservationHasRuntimeShape(
  value: unknown
): value is PaperTradingObservationRecord {
  return paperComparisonObject(value) && value.record_kind === "paper_trading_observation" &&
    value.version === 1 && paperComparisonNonEmpty(value.paper_trading_observation_id) &&
    paperComparisonRefIs(value.paper_trading_evaluation_ref, "paper_trading_evaluation") &&
    paperComparisonRefIs(
      value.paper_trading_evaluation_commitment_ref,
      "paper_trading_evaluation_commitment"
    ) && paperComparisonRefIs(value.candidate_ref, "trading_system_candidate") &&
    paperComparisonRefIs(value.candidate_version_ref, "candidate_version") &&
    paperComparisonRefIs(value.trading_run_ref, "trading_run") &&
    paperComparisonPositiveInteger(value.sequence) &&
    ["recorded", "no_order", "failed"].includes(value.status as string) &&
    paperComparisonExactIso(value.observed_at) &&
    paperComparisonMarketSnapshotHasRuntimeShape(value.market_snapshot) &&
    paperComparisonPublicExecutionHasRuntimeShape(value.public_execution_snapshot) &&
    paperComparisonDecisionHasRuntimeShape(value.decision) &&
    paperComparisonOptionalRef(value.ledger_ref) &&
    (value.paper_account_snapshot === undefined ||
      paperComparisonAccountHasRuntimeShape(value.paper_account_snapshot)) &&
    (value.open_orders === undefined ||
      (Array.isArray(value.open_orders) && value.open_orders.every(
        paperComparisonOrderHasRuntimeShape
      ))) && paperComparisonFillHasRuntimeShape(value.latest_fill) &&
    (value.processed_trading_system_event_ids === undefined ||
      (Array.isArray(value.processed_trading_system_event_ids) &&
        value.processed_trading_system_event_ids.every(paperComparisonNonEmpty))) &&
    (value.processed_public_trade_ids === undefined ||
      (Array.isArray(value.processed_public_trade_ids) &&
        value.processed_public_trade_ids.every(paperComparisonNonEmpty))) &&
    paperComparisonProfitLossHasRuntimeShape(value.score_delta) &&
    paperComparisonProfitLossHasRuntimeShape(value.cumulative_score) &&
    paperComparisonOptionalNonEmpty(value.failure_reason) && value.authority_status === "not_live";
}

export const DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY: PaperTradingQualificationPolicy = {
  minObservationCount: 30,
  minElapsedMs: 30 * 60_000,
  maxFailedObservationRatio: 0.1,
  assessRunnerHealth: true
};

export function paperTradingEvidenceIntegrityReasons(
  input: PaperTradingQualificationEvidenceInput
): PaperTradingQualificationReason[] {
  if (!input.commitment || !input.commitmentDigestVerified ||
    !paperTradingQualificationCommitmentMatchesEvaluation(
      input.commitment,
      input.evaluation
    )) {
    return ["paper_evaluation_commitment_missing"];
  }
  if (!paperTradingQualificationObservationChainComplete(
    input.evaluation,
    input.commitment,
    input.observations
  )) {
    return ["paper_observation_chain_incomplete"];
  }
  if (!paperTradingQualificationObservationAccountingComplete(
    input.evaluation,
    input.commitment,
    input.observations
  ) || !paperTradingQualificationScoreMatchesAccount(
    input.evaluation,
    input.commitment
  )) {
    return ["paper_score_account_mismatch"];
  }
  return [];
}

export function decidePaperTradingQualification(
  input: PaperTradingQualificationDecisionInput
): PaperTradingQualificationResult {
  const policy: PaperTradingQualificationPolicy = {
    ...DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY,
    ...input.policy
  };
  const failedObservationCount = input.observations.filter((observation) =>
    observation.status === "failed"
  ).length;
  const observationBounds = paperTradingQualificationObservationBounds(
    input.evaluation,
    input.observations
  );
  const evidenceWindow = {
    observation_count: input.evaluation.observation_count,
    elapsed_ms: paperTradingQualificationElapsedMs(input.evaluation, input.observations),
    failed_observation_count: failedObservationCount,
    ...observationBounds
  };
  const failedRatio = evidenceWindow.observation_count > 0
    ? failedObservationCount / evidenceWindow.observation_count
    : 0;
  if (input.evaluation.status === "invalidated") {
    return {
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["paper_evaluation_invalidated"],
      evidence_window: evidenceWindow
    };
  }
  const commitment = input.commitment;
  if (!commitment || !input.commitmentDigestVerified ||
    !paperTradingQualificationCommitmentMatchesEvaluation(commitment, input.evaluation)) {
    return {
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["paper_evaluation_commitment_missing"],
      evidence_window: evidenceWindow
    };
  }
  if (commitment.evidence_purpose !== "qualification") {
    return {
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["evidence_purpose_not_qualification"],
      evidence_window: evidenceWindow
    };
  }
  if (!commitment.provider_identity.qualification_eligible) {
    return {
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["provider_identity_not_qualification_eligible"],
      evidence_window: evidenceWindow
    };
  }
  if (input.evaluation.status === "failed") {
    return {
      qualification_status: "paper_failed",
      qualification_reasons: ["paper_evaluation_failed"],
      evidence_window: evidenceWindow
    };
  }
  const integrityReasons = paperTradingEvidenceIntegrityReasons({
    evaluation: input.evaluation,
    commitment,
    observations: input.observations,
    commitmentDigestVerified: input.commitmentDigestVerified
  });
  if (integrityReasons.length > 0) {
    return {
      qualification_status: "blocked_by_quality",
      qualification_reasons: integrityReasons,
      evidence_window: evidenceWindow
    };
  }
  const collectionReasons: PaperTradingQualificationReason[] = [];
  if (input.evaluation.observation_count < policy.minObservationCount) {
    collectionReasons.push("min_observation_count_not_met");
  }
  if (evidenceWindow.elapsed_ms < policy.minElapsedMs) {
    collectionReasons.push("min_elapsed_ms_not_met");
  }
  const qualityReasons: PaperTradingQualificationReason[] = [];
  if (policy.assessRunnerHealth && input.evaluation.status === "running" &&
    !input.runnerActive) {
    qualityReasons.push("runner_inactive_for_running_evaluation");
  }
  if (failedRatio > policy.maxFailedObservationRatio) {
    qualityReasons.push("failed_observation_ratio_exceeded");
  }
  if (evidenceWindow.observation_count >= policy.minObservationCount &&
    !paperTradingQualificationHasMarketSnapshot(input.observations)) {
    qualityReasons.push("latest_market_snapshot_missing");
  }
  if (!paperTradingQualificationFillsHavePublicEvidence(
    input.evaluation,
    input.observations
  )) {
    qualityReasons.push("fill_public_execution_evidence_missing");
  }
  if (qualityReasons.length > 0) {
    return {
      qualification_status: qualityReasons.length === 1 &&
          qualityReasons[0] === "runner_inactive_for_running_evaluation"
        ? "needs_resume"
        : "blocked_by_quality",
      qualification_reasons: qualityReasons,
      evidence_window: evidenceWindow
    };
  }
  if (collectionReasons.length > 0) {
    return {
      qualification_status: "collecting_evidence",
      qualification_reasons: collectionReasons,
      evidence_window: evidenceWindow
    };
  }
  return {
    qualification_status: "qualified",
    qualification_reasons: [],
    evidence_window: evidenceWindow
  };
}

function paperTradingQualificationCommitmentMatchesEvaluation(
  commitment: PaperTradingEvaluationCommitmentRecord,
  evaluation: PaperTradingEvaluationRecord
): boolean {
  const purposeMatchesRelease =
    (commitment.evidence_purpose === "research_feedback" &&
      commitment.window_policy.release_policy === "closed_observation") ||
    (commitment.evidence_purpose === "qualification" &&
      commitment.window_policy.release_policy === "sealed_until_adjudication");
  return paperTradingQualificationRefsEqual(
      evaluation.paper_trading_evaluation_commitment_ref,
      {
        record_kind: "paper_trading_evaluation_commitment",
        id: commitment.paper_trading_evaluation_commitment_id
      }
    ) &&
    paperTradingQualificationRefsEqual(evaluation.candidate_ref, commitment.candidate_ref) &&
    paperTradingQualificationRefsEqual(
      evaluation.candidate_version_ref,
      commitment.candidate_version_ref
    ) &&
    paperTradingQualificationRefsEqual(evaluation.trading_run_ref, commitment.trading_run_ref) &&
    evaluation.interval_ms === commitment.window_policy.interval_ms &&
    purposeMatchesRelease && commitment.authority_status === "not_live" &&
    evaluation.authority_status === "not_live";
}

function paperTradingQualificationObservationChainComplete(
  evaluation: PaperTradingEvaluationRecord,
  commitment: PaperTradingEvaluationCommitmentRecord,
  observations: PaperTradingObservationRecord[]
): boolean {
  if (observations.length !== evaluation.observation_count) {
    return false;
  }
  const ordered = [...observations].sort((left, right) => left.sequence - right.sequence);
  return ordered.every((observation, index) =>
    observation.sequence === index + 1 &&
    paperTradingQualificationRefsEqual(observation.paper_trading_evaluation_ref, {
      record_kind: "paper_trading_evaluation",
      id: evaluation.paper_trading_evaluation_id
    }) &&
    paperTradingQualificationRefsEqual(
      observation.paper_trading_evaluation_commitment_ref,
      evaluation.paper_trading_evaluation_commitment_ref
    ) &&
    paperTradingQualificationRefsEqual(observation.candidate_ref, commitment.candidate_ref) &&
    paperTradingQualificationRefsEqual(
      observation.candidate_version_ref,
      commitment.candidate_version_ref
    ) &&
    paperTradingQualificationRefsEqual(observation.trading_run_ref, commitment.trading_run_ref)
  );
}

function paperTradingQualificationRefsEqual(
  left: Ref | undefined,
  right: Ref | undefined
): boolean {
  return Boolean(left && right && left.record_kind === right.record_kind && left.id === right.id);
}

function paperTradingQualificationRoundProfit(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function paperTradingQualificationDecimal(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paperTradingQualificationScoreFromAccount(
  account: PaperTradingAccountSnapshot,
  initialEquityUsdt: number
): TradingProfitLossReadModel {
  const revenue = paperTradingQualificationDecimal(account.realized_pnl_usdt) +
    paperTradingQualificationDecimal(account.unrealized_pnl_usdt);
  const cost = paperTradingQualificationDecimal(account.fee_paid_usdt) +
    paperTradingQualificationDecimal(account.slippage_paid_usdt) +
    paperTradingQualificationDecimal(account.funding_paid_usdt);
  const net = paperTradingQualificationDecimal(account.equity_usdt) - initialEquityUsdt;
  return {
    revenue_usdt: paperTradingQualificationRoundProfit(revenue),
    cost_usdt: paperTradingQualificationRoundProfit(cost),
    net_revenue_usdt: paperTradingQualificationRoundProfit(net),
    net_return_pct: paperTradingQualificationRoundProfit(net / initialEquityUsdt * 100)
  };
}

function paperTradingQualificationProfitLossEqual(
  left: TradingProfitLossReadModel,
  right: TradingProfitLossReadModel
): boolean {
  return left.revenue_usdt === right.revenue_usdt &&
    left.cost_usdt === right.cost_usdt &&
    left.net_revenue_usdt === right.net_revenue_usdt &&
    left.net_return_pct === right.net_return_pct;
}

function paperTradingQualificationProfitLossFinite(
  value: TradingProfitLossReadModel
): boolean {
  return Object.values(value).every((item) => Number.isFinite(item));
}

function paperTradingQualificationProfitLossDelta(
  current: TradingProfitLossReadModel,
  previous: TradingProfitLossReadModel
): TradingProfitLossReadModel {
  return {
    revenue_usdt: paperTradingQualificationRoundProfit(
      current.revenue_usdt - previous.revenue_usdt
    ),
    cost_usdt: paperTradingQualificationRoundProfit(current.cost_usdt - previous.cost_usdt),
    net_revenue_usdt: paperTradingQualificationRoundProfit(
      current.net_revenue_usdt - previous.net_revenue_usdt
    ),
    net_return_pct: paperTradingQualificationRoundProfit(
      current.net_return_pct - previous.net_return_pct
    )
  };
}

function paperTradingQualificationObservationAccountingComplete(
  evaluation: PaperTradingEvaluationRecord,
  commitment: PaperTradingEvaluationCommitmentRecord,
  observations: PaperTradingObservationRecord[]
): boolean {
  const initialEquityUsdt = Number(commitment.initial_account_snapshot.equity_usdt);
  if (!Number.isFinite(initialEquityUsdt) || initialEquityUsdt <= 0 ||
    !paperTradingQualificationProfitLossEqual(
      paperTradingQualificationScoreFromAccount(
        commitment.initial_account_snapshot,
        initialEquityUsdt
      ),
      PAPER_TRADING_QUALIFICATION_ZERO_SCORE
    )) {
    return false;
  }
  let previousScore = PAPER_TRADING_QUALIFICATION_ZERO_SCORE;
  let latestAccount = commitment.initial_account_snapshot;
  const ordered = [...observations].sort((left, right) => left.sequence - right.sequence);
  for (const observation of ordered) {
    if (!paperTradingQualificationProfitLossFinite(observation.score_delta) ||
      !paperTradingQualificationProfitLossFinite(observation.cumulative_score) ||
      !paperTradingQualificationProfitLossEqual(
      observation.score_delta,
      paperTradingQualificationProfitLossDelta(observation.cumulative_score, previousScore)
    )) {
      return false;
    }
    if (observation.paper_account_snapshot) {
      if (!paperTradingQualificationProfitLossEqual(
        paperTradingQualificationScoreFromAccount(
          observation.paper_account_snapshot,
          initialEquityUsdt
        ),
        observation.cumulative_score
      )) {
        return false;
      }
      latestAccount = observation.paper_account_snapshot;
    } else if (!paperTradingQualificationProfitLossEqual(
      observation.cumulative_score,
      previousScore
    )) {
      return false;
    }
    previousScore = observation.cumulative_score;
  }
  return Boolean(evaluation.paper_account_snapshot) &&
    paperTradingQualificationProfitLossEqual(previousScore, evaluation.latest_score) &&
    paperTradingQualificationSemanticEqual(latestAccount, evaluation.paper_account_snapshot);
}

function paperTradingQualificationScoreMatchesAccount(
  evaluation: PaperTradingEvaluationRecord,
  commitment: PaperTradingEvaluationCommitmentRecord
): boolean {
  const initialEquityUsdt = Number(commitment.initial_account_snapshot.equity_usdt);
  return Boolean(evaluation.paper_account_snapshot) &&
    Number.isFinite(initialEquityUsdt) && initialEquityUsdt > 0 &&
    paperTradingQualificationProfitLossEqual(
      paperTradingQualificationScoreFromAccount(
        evaluation.paper_account_snapshot!,
        initialEquityUsdt
      ),
      evaluation.latest_score
    );
}

function paperTradingQualificationSemanticEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null || typeof left !== typeof right) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((item, index) =>
        paperTradingQualificationSemanticEqual(item, right[index]));
  }
  if (typeof left === "object" && typeof right === "object") {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord)
      .filter((key) => leftRecord[key] !== undefined)
      .sort();
    const rightKeys = Object.keys(rightRecord)
      .filter((key) => rightRecord[key] !== undefined)
      .sort();
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] &&
        paperTradingQualificationSemanticEqual(leftRecord[key], rightRecord[key]));
  }
  return false;
}

function paperTradingQualificationElapsedMs(
  evaluation: PaperTradingEvaluationRecord,
  observations: PaperTradingObservationRecord[]
): number {
  const last = [...observations].sort((left, right) => left.sequence - right.sequence).at(-1);
  if (!last) {
    return 0;
  }
  const started = Date.parse(evaluation.started_at);
  const ended = Date.parse(last.observed_at);
  return Number.isFinite(started) && Number.isFinite(ended) && ended >= started
    ? ended - started
    : 0;
}

function paperTradingQualificationObservationBounds(
  evaluation: PaperTradingEvaluationRecord,
  observations: PaperTradingObservationRecord[]
): { first_observed_at?: string; last_observed_at?: string } {
  const ordered = [...observations].sort((left, right) =>
    left.sequence - right.sequence || left.observed_at.localeCompare(right.observed_at)
  );
  return {
    first_observed_at: ordered[0]?.observed_at,
    last_observed_at: ordered.at(-1)?.observed_at ?? evaluation.last_observed_at
  };
}

function paperTradingQualificationHasMarketSnapshot(
  observations: PaperTradingObservationRecord[]
): boolean {
  return [...observations].reverse().some((observation) =>
    observation.market_snapshot !== undefined);
}

function paperTradingQualificationFillHasPublicEvidence(
  fill: PaperTradingFillSummary,
  snapshots: Array<PaperTradingPublicExecutionSnapshotSummary | undefined>
): boolean {
  return snapshots.some((snapshot) => {
    if (!snapshot) {
      return false;
    }
    if (!fill.source_trade_id) {
      return Boolean(snapshot.book_ticker || snapshot.agg_trades.length > 0);
    }
    return snapshot.agg_trades.some((trade) => trade.trade_id === fill.source_trade_id) ||
      snapshot.stream_marker === fill.source_trade_id ||
      fill.source_trade_id.startsWith(`${snapshot.stream_marker}:`);
  });
}

function paperTradingQualificationFillsHavePublicEvidence(
  evaluation: PaperTradingEvaluationRecord,
  observations: PaperTradingObservationRecord[]
): boolean {
  const uniqueFills = new Map<string, PaperTradingFillSummary>();
  for (const fill of [evaluation.latest_fill, ...observations.map((item) => item.latest_fill)]) {
    if (fill) {
      uniqueFills.set(fill.source_trade_id ?? fill.fill_id, fill);
    }
  }
  const snapshots = [
    evaluation.latest_public_execution_snapshot,
    ...observations.map((item) => item.public_execution_snapshot)
  ];
  return [...uniqueFills.values()].every((fill) =>
    paperTradingQualificationFillHasPublicEvidence(fill, snapshots));
}

export function paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonStoppedQualificationClosure {
  if (!paperComparisonObject(value) || !paperComparisonSystemCode(value.systemCode) ||
    !paperComparisonAdmission(value.admission) ||
    !paperComparisonStoppedCommitmentHasRuntimeShape(value.commitment) ||
    !paperComparisonStoppedEvaluationHasRuntimeShape(value.evaluation) ||
    !Array.isArray(value.observations) ||
    !value.observations.every(paperComparisonStoppedObservationHasRuntimeShape) ||
    !paperTradingComparisonTradingPromotionHasRuntimeShape(value.promotion) ||
    !paperComparisonExactIso(value.preparationCommittedAt)) {
    return false;
  }
  const { systemCode, admission, commitment, evaluation, promotion } = value;
  const observations = [...value.observations].sort((left, right) =>
    left.sequence - right.sequence ||
    left.paper_trading_observation_id.localeCompare(right.paper_trading_observation_id)
  );
  const refsMatch =
    paperTradingComparisonRefsEqual(admission.system_code_ref, {
      record_kind: systemCode.record_kind,
      id: systemCode.system_code_id
    }) && admission.submitted_artifact_digest === systemCode.artifact_digest &&
    Date.parse(systemCode.created_at) <= Date.parse(admission.decided_at) &&
    paperTradingComparisonRefsEqual(commitment.system_code_ref, admission.system_code_ref) &&
    commitment.system_code_artifact_digest === systemCode.artifact_digest &&
    paperComparisonCanonicalEqual(commitment.runtime_identity, {
      artifact_kind: systemCode.artifact_kind,
      runtime_kind: systemCode.runtime_kind,
      entrypoint: systemCode.entrypoint,
      ...(systemCode.artifact_runtime_contract_ref
        ? { artifact_runtime_contract_ref: systemCode.artifact_runtime_contract_ref }
        : {})
    }) && paperTradingComparisonRefsEqual(
      commitment.capability_policy_ref,
      systemCode.capability_policy_ref
    ) && paperTradingComparisonRefsEqual(commitment.secret_policy_ref, systemCode.secret_policy_ref) &&
    paperTradingComparisonRefsEqual(evaluation.candidate_ref, commitment.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      evaluation.candidate_version_ref,
      commitment.candidate_version_ref
    ) && paperTradingComparisonRefsEqual(evaluation.trading_run_ref, commitment.trading_run_ref) &&
    paperTradingComparisonRefsEqual(evaluation.paper_trading_evaluation_commitment_ref, {
      record_kind: commitment.record_kind,
      id: commitment.paper_trading_evaluation_commitment_id
    }) && evaluation.interval_ms === commitment.window_policy.interval_ms &&
    paperTradingComparisonRefsEqual(promotion.candidate_ref, commitment.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      promotion.candidate_version_ref,
      commitment.candidate_version_ref
    ) && paperTradingComparisonRefsEqual(promotion.paper_trading_evaluation_ref, {
      record_kind: evaluation.record_kind,
      id: evaluation.paper_trading_evaluation_id
    });
  const observationChainMatches = observations.length === evaluation.observation_count &&
    observations.every((observation, index) =>
      observation.sequence === index + 1 &&
      paperTradingComparisonRefsEqual(observation.paper_trading_evaluation_ref, {
        record_kind: evaluation.record_kind,
        id: evaluation.paper_trading_evaluation_id
      }) && paperTradingComparisonRefsEqual(
        observation.paper_trading_evaluation_commitment_ref,
        evaluation.paper_trading_evaluation_commitment_ref
      ) && paperTradingComparisonRefsEqual(observation.candidate_ref, commitment.candidate_ref) &&
      paperTradingComparisonRefsEqual(
        observation.candidate_version_ref,
        commitment.candidate_version_ref
      ) && paperTradingComparisonRefsEqual(observation.trading_run_ref, commitment.trading_run_ref) &&
      (index === 0 || Date.parse(observations[index - 1]!.observed_at) <=
        Date.parse(observation.observed_at))
    ) && evaluation.last_observed_at === observations.at(-1)?.observed_at;
  const firstObservedAt = observations[0]?.observed_at ?? evaluation.started_at;
  const lastObservedAt = observations.at(-1)?.observed_at ?? evaluation.started_at;
  const timesAreCausal = Date.parse(systemCode.created_at) <= Date.parse(admission.decided_at) &&
    Date.parse(admission.decided_at) <= Date.parse(commitment.committed_at) &&
    Date.parse(commitment.committed_at) <= Date.parse(evaluation.started_at) &&
    Date.parse(evaluation.started_at) <= Date.parse(firstObservedAt) &&
    Date.parse(lastObservedAt) <= Date.parse(evaluation.stopped_at!) &&
    Date.parse(evaluation.stopped_at!) <= Date.parse(promotion.promoted_at) &&
    Date.parse(promotion.promoted_at) <= Date.parse(value.preparationCommittedAt);
  return refsMatch && observationChainMatches && timesAreCausal;
}

export function paperTradingComparisonSideRecordsHaveInertShape(
  value: unknown
): value is PaperTradingComparisonLoadedSideRecords {
  if (!paperComparisonObject(value)) {
    return false;
  }
  const raw = value as Record<string, unknown>;
  if (!paperComparisonCandidateProjection(raw.candidate) ||
    !paperComparisonCandidateVersion(raw.candidateVersion) ||
    !paperComparisonAdmission(raw.admission) || !paperComparisonRun(raw.run) ||
    !paperComparisonSystemCode(raw.systemCode) ||
    !paperComparisonCommitment(raw.commitment) ||
    !paperComparisonEvaluation(raw.evaluation) || !Array.isArray(raw.observations)) {
    return false;
  }
  const { candidate, candidateVersion, admission, run, systemCode, commitment,
    evaluation, observations } = raw as unknown as PaperTradingComparisonLoadedSideRecords;
  return paperTradingComparisonRefsEqual(candidate.runtime.ref, {
      record_kind: run.record_kind,
      id: run.trading_run_id
    }) &&
    paperTradingComparisonRefsEqual(candidate.system_code.ref, {
      record_kind: systemCode.record_kind,
      id: systemCode.system_code_id
    }) && candidateVersion.candidate_id === candidate.candidate_id &&
    candidateVersion.runtime_ref.id !== run.trading_run_id &&
    paperTradingComparisonRefsEqual(candidateVersion.system_code_ref, {
      record_kind: systemCode.record_kind,
      id: systemCode.system_code_id
    }) && paperTradingComparisonRefsEqual(admission.system_code_ref, {
      record_kind: systemCode.record_kind,
      id: systemCode.system_code_id
    }) && admission.submitted_artifact_digest === systemCode.artifact_digest &&
    Date.parse(systemCode.created_at) <= Date.parse(admission.decided_at) &&
    paperTradingComparisonRefsEqual(run.candidate_ref, commitment.candidate_ref) &&
    paperTradingComparisonRefsEqual(run.candidate_version_ref, commitment.candidate_version_ref) &&
    paperTradingComparisonRefsEqual(run.system_code_ref, commitment.system_code_ref) &&
    paperTradingComparisonRefsEqual(evaluation.candidate_ref, commitment.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      evaluation.candidate_version_ref,
      commitment.candidate_version_ref
    ) && paperTradingComparisonRefsEqual(evaluation.trading_run_ref, commitment.trading_run_ref) &&
    paperTradingComparisonRefsEqual(evaluation.paper_trading_evaluation_commitment_ref, {
      record_kind: commitment.record_kind,
      id: commitment.paper_trading_evaluation_commitment_id
    }) &&
    evaluation.interval_ms === commitment.window_policy.interval_ms &&
    observations.length === 0;
}
```
<!-- plan-typecheck:domain-runtime:end -->

The shared predicates are deliberately strict and total: every nested object/array is proven before
access; all current CandidateVersion, SystemCode, provider, run, commitment, evaluation,
observation, account, order, fill, decision, market snapshot, public execution, aggregate trade,
book ticker, and order-book fields that downstream code reads use exact string, enum, finite number,
integer, ISO-time, conditional shape, array, and Ref checks. The inert predicate matches
`initialPaperTradingEngineState()` byte-for-byte after normal JSON omission of
`average_entry_price: undefined`; it also enforces `SystemCode.created_at <= admission.decided_at`
for both sides. Candidate mutable projection fields such as `active_version_id` are shape-checked
but are not frozen or digested; the exact `CandidateVersionRecord` is the comparison authority.

The stopped closure predicate additionally binds the qualification commitment's SystemCode ref,
artifact digest, runtime identity, capability policy, and secret policy to the supplied frozen
champion SystemCode and enforces the complete causal chain through nondecreasing observation times.
It does not decide qualification. `decidePaperTradingQualification` is the one domain-owned
policy and evidence-integrity decision for all statuses and reasons, including runner health,
observation and elapsed minima, failed ratio, account/score continuity, market evidence, and fill
provenance. Its semantic account comparison ignores object key insertion order and treats an
undefined object property like its persisted omission. The decision accepts a
`commitmentDigestVerified` boolean; it imports no `node:crypto`. Application and LocalStore each
compute the SHA-256 self-digest at their own boundary and supply that result before accepting
qualification.

The existing commitment encoder remains strict and unchanged. The separate full-record encoder is
recursive and key-sorted, omits only undefined object properties, and rejects undefined/sparse
array items plus every non-persistable value. CandidateVersion, SystemCode, admission, promotion,
side commitment, side evaluation, and ordered observation-chain helpers include every persisted
field, including record kind, version, ID, optional refs, timestamps, runtime/capability fields,
zero/nonzero state, and authority fields. Store and coordinator wrap each canonical input with
`sha256:${createHash("sha256").update(input).digest("hex")}` and compare it to the frozen side or
selection digest.
The preparation digest deliberately includes `paper_trading_comparison_commitment_id` and
`committed_at`; those fields are part of the frozen pre-side intent. The pair digest includes
`preparation_ref` through its payload.

- [ ] **Step 5: Delegate the application qualification API to the domain decision**

Replace `packages/application/src/trading/paper/qualification.ts` with this compatibility wrapper.
No evidence-integrity, threshold, accounting, market, fill, or status decision remains in
application:

<!-- plan-typecheck:application-qualification:start -->
```ts
import {
  DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY as DOMAIN_DEFAULT_QUALIFICATION_POLICY,
  decidePaperTradingQualification,
  paperTradingEvidenceIntegrityReasons as domainPaperTradingEvidenceIntegrityReasons,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord,
  type PaperTradingQualificationPolicy as DomainPaperTradingQualificationPolicy,
  type PaperTradingQualificationReason,
  type PaperTradingQualificationResult as DomainPaperTradingQualificationResult
} from "@ouroboros/domain";
import { paperTradingEvaluationCommitmentDigest } from "./commitment";

export type PaperTradingQualificationPolicy = DomainPaperTradingQualificationPolicy;
export type PaperTradingQualificationResult = DomainPaperTradingQualificationResult;

export const DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY =
  DOMAIN_DEFAULT_QUALIFICATION_POLICY;

interface PaperTradingEvidenceIntegrityInput {
  evaluation: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
  observations: PaperTradingObservationRecord[];
}

export function paperTradingEvidenceIntegrityReasons(
  input: PaperTradingEvidenceIntegrityInput
): PaperTradingQualificationReason[] {
  return domainPaperTradingEvidenceIntegrityReasons({
    ...input,
    commitmentDigestVerified: paperTradingCommitmentDigestVerified(input.commitment)
  });
}

export function qualifyPaperTradingEvaluation(input: {
  evaluation: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
  observations: PaperTradingObservationRecord[];
  runnerActive: boolean;
  policy?: Partial<PaperTradingQualificationPolicy>;
}): PaperTradingQualificationResult {
  return decidePaperTradingQualification({
    ...input,
    commitmentDigestVerified: paperTradingCommitmentDigestVerified(input.commitment)
  });
}

function paperTradingCommitmentDigestVerified(
  commitment: PaperTradingEvaluationCommitmentRecord | undefined
): boolean {
  if (!commitment) {
    return false;
  }
  try {
    return commitment.commitment_digest ===
      paperTradingEvaluationCommitmentDigest(commitment);
  } catch {
    return false;
  }
}
```
<!-- plan-typecheck:application-qualification:end -->

- [ ] **Step 6: Run domain and application tests and typechecks**

Run: `npx vitest run packages/domain/src/paper-trading-evaluation-commitment.test.ts packages/domain/src/paper-trading-comparison-commitment.test.ts packages/application/src/trading/paper/qualification.test.ts`

Run: `npm run typecheck -w @ouroboros/domain && npm run typecheck -w @ouroboros/application`

Expected: PASS; existing commitment canonicalization and the application qualification API remain
compatible; role reversal uses one unordered active-pair key; full-record digests bind all frozen
authority; total runtime predicates reject malformed records without throwing; and the single
domain decision treats reordered equal accounts as equal while distinguishing 29/30 observations,
29/30 elapsed minutes, exactly 3/30 versus 4/30 failures, missing market evidence, accounting
discontinuity, unmatched fills, and a stale commitment self-digest.

- [ ] **Step 7: Commit the domain contract and qualification delegation**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-commitment.test.ts packages/application/src/trading/paper/qualification.ts packages/application/src/trading/paper/qualification.test.ts
git commit -m "feat: define paper comparison qualification contract"
```

### Task 2: Append-Only Preparation And Pair Store Validation

**Files:**
- Modify: `packages/application/src/ports/store.ts:1-170`
- Modify: `packages/local-store/src/index.ts:1-340`
- Modify: `packages/local-store/src/index.ts:930-1125`
- Modify: `packages/local-store/src/index.ts:1390-1640`
- Modify: `packages/local-store/src/index.ts:1810-2135`
- Modify: `packages/local-store/src/index.ts:2440-3290`
- Modify: `packages/local-store/src/index.ts:3310-3785`
- Modify: `packages/local-store/src/index.ts:6865-7050`
- Modify: `packages/local-store/test/local-store.test.ts:90-180`
- Modify: `packages/local-store/test/local-store.test.ts:1220-1415`
- Modify: `packages/local-store/test/local-store.test.ts:3970-4125`

**Interfaces:**
- Consumes: preparation/commitment records; full-record CandidateVersion, SystemCode, admission,
  promotion, promotion evaluation, promotion qualification commitment, side commitment, and side
  evaluation digest inputs; ordered observation-chain digest input; comparison digest inputs;
  shared total runtime-shape predicates; the domain-owned qualification decision; and unordered pair
  key from Task 1. LocalStore supplies its independently recomputed commitment self-digest result to
  that decision.
- Produces: `OuroborosStorePort.reservePaperTradingComparisonPreparation(preparation)` as the
  adapter-level atomic compare-and-reserve boundary.
- Produces: `OuroborosStorePort.getCandidateVersion(candidateVersionId)` for exact frozen-version
  resolution without falling back to the candidate's current active projection.
- Produces: `OuroborosStorePort.getPaperTradingComparisonPreparation(preparationId)`.
- Produces: `OuroborosStorePort.listPaperTradingComparisonPreparations()`.
- Produces: `OuroborosStorePort.recordPaperTradingComparisonCommitment(commitment)`.
- Produces: `OuroborosStorePort.getPaperTradingComparisonCommitment(comparisonId)`.
- Produces: `OuroborosStorePort.listPaperTradingComparisonCommitments()`.
- Produces: `OuroborosStorePort.getPaperTradingEvaluation(evaluationId)` for exact pair-bound
  evaluation loading; commitment/evaluation list reads prove the bound deterministic IDs are the
  sole chain for the side's full `trading_run_ref`.
- Produces: `LocalStore` collections `paper-trading-comparison-preparations` and `paper-trading-comparison-commitments`.
- Enforces: exact preparation replay only; complete promotion-evidence closure revalidation;
  full-record CandidateVersion/SystemCode/admission/side commitment/side evaluation digest
  revalidation; append-only drift rejection; active unordered candidate-version pair exclusion at
  preparation time; exact preparation-bound pair/evaluation identity; and complete zero-outcome
  inert side graph validation.
- Serializes: the reservation read/currentness/append transaction with every production writer of
  CandidateVersion, SystemCode, CandidateAdmissionDecision, and TradingPromotion authority evidence,
  including `recordSystemCode`, candidate materialization, the direct SystemCode write in
  `materializeImprovementProposal`, admission writes, and promotion writes.
- Serializes: reservation and pair validation against non-noop writes to the bound champion
  promotion's exact qualification commitment, evaluation, and ordered observation chain; that
  evidence remains frozen before side creation, during partial preparation, and after both sides
  exist.
- Serializes: pair graph reads/validation/append with `createPaperTradingRun`, side commitment,
  evaluation, observation, Ledger, run-control, and sandbox writers; once the pair is appended,
  those writers reject any attempt to mutate its bound inert side graph.

- [ ] **Step 1: Add failing preparation and pair persistence tests**

Import the preparation/commitment records and extend the existing domain value import with the
exact-record helpers. Extend the existing `node:fs/promises` import with `readFile`, `readdir`,
`rm`, and `writeFile`; extend the domain type import with `CandidateInspectReadModel`,
`PaperTradingComparisonCandidateSide`, `TradingPromotionRecord`, and
`TradingSystemCandidateRecord`:

Also extend the existing `../src/index` import with `type SandboxObservationInput`; this is the
LocalStore-owned input type and does not cross the application package boundary.

```ts
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  decidePaperTradingQualification,
  paperTradingComparisonAdmissionDecisionDigestInput,
  paperTradingComparisonCandidateVersionDigestInput,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonPreparationDigestInput,
  paperTradingComparisonPreparationHasRuntimeShape,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonSideRecordsHaveInertShape,
  paperTradingComparisonStoppedQualificationClosureHasRuntimeShape,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingComparisonTradingPromotionHasRuntimeShape,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingEvaluationCommitmentDigestInput
} from "@ouroboros/domain";
import type {
  CandidateInspectReadModel,
  PaperTradingAccountSnapshot,
  PaperTradingComparisonCandidateSide,
  PaperTradingComparisonCommitmentRecord,
  PaperTradingComparisonPreparationRecord,
  PaperTradingComparisonSide,
  TradingPromotionRecord,
  TradingSystemCandidateRecord
} from "@ouroboros/domain";
```

First prove that the intent anchor is append-only and owns unordered active-pair exclusion before
any side exists:

```ts
it("records exact preparation replay and rejects drift or role-swapped active intent", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  const championRunsBefore = await store.listTradingRunsForCandidateVersion(
    fixture.preparation.champion.candidate_version_ref.id
  );
  const challengerRunsBefore = await store.listTradingRunsForCandidateVersion(
    fixture.preparation.challenger.candidate_version_ref.id
  );

  const first = await store.reservePaperTradingComparisonPreparation(fixture.preparation);
  const repeated = await store.reservePaperTradingComparisonPreparation(fixture.preparation);
  expect(repeated).toEqual(first);

  const swappedEvidence = await recordQualifiedPromotionEvidence(
    store,
    fixture.challenger,
    "role-swap",
    "2026-07-09T21:32:00.000Z"
  );
  const swappedPromotion: TradingPromotionRecord = {
    ...fixture.promotion,
    trading_promotion_id: "trading-promotion-role-swap",
    candidate_ref: { ...fixture.preparation.challenger.candidate_ref },
    candidate_version_ref: { ...fixture.preparation.challenger.candidate_version_ref },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: swappedEvidence.evaluation.paper_trading_evaluation_id
    },
    promoted_at: "2026-07-09T22:03:00.000Z"
  };
  await store.recordTradingPromotion(swappedPromotion);
  await expectStoreError(
    store.reservePaperTradingComparisonPreparation(withPreparationDigest({
      ...fixture.preparation,
      comparison_policy: {
        ...fixture.preparation.comparison_policy,
        minimum_net_revenue_lift_usdt: 25
      },
      preparation_digest: ""
    })),
    "paper_trading_comparison_preparation_conflict"
  );

  await expectStoreError(
    store.reservePaperTradingComparisonPreparation(withPreparationDigest({
      ...fixture.preparation,
      paper_trading_comparison_preparation_id: "paper-comparison-preparation-role-swap",
      paper_trading_comparison_commitment_id: "paper-comparison-role-swap",
      committed_at: "2026-07-10T00:00:02.000Z",
      champion: { ...fixture.preparation.challenger, role: "champion" },
      challenger: { ...fixture.preparation.champion, role: "challenger" },
      champion_selection: {
        selection_kind: "trading_review",
        trading_promotion_ref: {
          record_kind: "trading_promotion",
          id: swappedPromotion.trading_promotion_id
        },
        trading_promotion_digest: comparisonExactRecordDigest(
          paperTradingComparisonTradingPromotionDigestInput(swappedPromotion)
        ),
        paper_trading_evaluation_ref: { ...swappedPromotion.paper_trading_evaluation_ref },
        paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationRecordDigestInput(swappedEvidence.evaluation)
        ),
        paper_trading_evaluation_commitment_ref: {
          record_kind: "paper_trading_evaluation_commitment",
          id: swappedEvidence.commitment.paper_trading_evaluation_commitment_id
        },
        paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(
            swappedEvidence.commitment
          )
        ),
        paper_trading_observation_chain_digest: comparisonExactRecordDigest(
          paperTradingComparisonObservationChainDigestInput(swappedEvidence.observations)
        )
      },
      preparation_digest: ""
    })),
    "paper_trading_comparison_active_pair_conflict"
  );
  await expect(store.listPaperTradingComparisonPreparations())
    .resolves.toEqual([fixture.preparation]);
  expect(await store.listTradingRunsForCandidateVersion(
    fixture.preparation.champion.candidate_version_ref.id
  )).toEqual(championRunsBefore);
  expect(await store.listTradingRunsForCandidateVersion(
    fixture.preparation.challenger.candidate_version_ref.id
  )).toEqual(challengerRunsBefore);
});

it("serializes concurrent preparation reservations for one candidate-version pair", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  const competing = withPreparationDigest({
    ...fixture.preparation,
    paper_trading_comparison_preparation_id: "paper-comparison-preparation-competing",
    paper_trading_comparison_commitment_id: "paper-comparison-competing",
    preparation_digest: ""
  });

  const results = await Promise.allSettled([
    store.reservePaperTradingComparisonPreparation(fixture.preparation),
    store.reservePaperTradingComparisonPreparation(competing)
  ]);

  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const [rejected] = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );
  expect(rejected?.reason).toMatchObject({
    code: "paper_trading_comparison_active_pair_conflict"
  });
  await expect(store.listPaperTradingComparisonPreparations()).resolves.toHaveLength(1);
});

it.each(["evaluation-mutation", "observation-append"] as const)(
  "freezes selected promotion evidence before any side write: %s",
  async (writer) => {
    const store = new LocalStore(path.join(tmpDir, writer));
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const championRunsBefore = await store.listTradingRunsForCandidateVersion(
      fixture.preparation.champion.candidate_version_ref.id
    );
    const challengerRunsBefore = await store.listTradingRunsForCandidateVersion(
      fixture.preparation.challenger.candidate_version_ref.id
    );
    const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
    const evaluationsBefore = await store.listPaperTradingEvaluations();
    await store.reservePaperTradingComparisonPreparation(fixture.preparation);
    const promotionEvidenceBefore = await promotionEvidenceSnapshot(store, fixture);

    await expectStoreError(
      invokeFrozenPromotionEvidenceWriter(store, fixture, writer),
      "paper_trading_comparison_frozen_authority_write_conflict"
    );
    await expect(promotionEvidenceSnapshot(store, fixture))
      .resolves.toEqual(promotionEvidenceBefore);
    await expect(store.listTradingRunsForCandidateVersion(
      fixture.preparation.champion.candidate_version_ref.id
    )).resolves.toEqual(championRunsBefore);
    await expect(store.listTradingRunsForCandidateVersion(
      fixture.preparation.challenger.candidate_version_ref.id
    )).resolves.toEqual(challengerRunsBefore);
    await expect(store.listPaperTradingEvaluationCommitments())
      .resolves.toEqual(commitmentsBefore);
    await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
    await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  }
);

it.each(["evaluation-mutation", "observation-append"] as const)(
  "keeps selected promotion evidence frozen after side creation and before pair append: %s",
  async (writer) => {
    const store = new LocalStore(path.join(tmpDir, `after-sides-${writer}`));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    const sideBefore = await boundComparisonEvidenceSnapshot(store, fixture);
    const promotionEvidenceBefore = await promotionEvidenceSnapshot(store, fixture);

    await expectStoreError(
      invokeFrozenPromotionEvidenceWriter(store, fixture, writer),
      "paper_trading_comparison_frozen_authority_write_conflict"
    );
    await expect(boundComparisonEvidenceSnapshot(store, fixture)).resolves.toEqual(sideBefore);
    await expect(promotionEvidenceSnapshot(store, fixture))
      .resolves.toEqual(promotionEvidenceBefore);
    await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  }
);

it.each(["evaluation-mutation", "observation-append"] as const)(
  "keeps selected promotion evidence byte-identical after pair append: %s",
  async (writer) => {
    const store = new LocalStore(path.join(tmpDir, `after-pair-${writer}`));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const before = {
      promotion: await promotionEvidenceSnapshot(store, fixture),
      graphBytes: await comparisonGraphByteSnapshot(store)
    };

    await expectStoreError(
      invokeFrozenPromotionEvidenceWriter(store, fixture, writer),
      "paper_trading_comparison_frozen_authority_write_conflict"
    );

    await expect(promotionEvidenceSnapshot(store, fixture)).resolves.toEqual(before.promotion);
    await expect(comparisonGraphByteSnapshot(store)).resolves.toEqual(before.graphBytes);
  }
);

it("atomically appends a valid pair before a concurrent side mutation", async () => {
  const store = new InterleavingComparisonLocalStore(tmpDir);
  await store.initialize();
  const fixture = await storedComparisonFixture(store);
  store.pauseExactEvaluationRead();

  const pairAppend = store.recordPaperTradingComparisonCommitment(fixture.comparison);
  await store.exactEvaluationReadEntered;
  const sideMutation = store.recordPaperTradingEvaluation({
    ...fixture.challengerEvaluation,
    latest_score: {
      revenue_usdt: 1,
      cost_usdt: 0,
      net_revenue_usdt: 1,
      net_return_pct: 0.0001
    }
  });
  await expectPromiseStillPending(sideMutation);
  store.releaseExactEvaluationRead();

  await expect(pairAppend).resolves.toEqual(fixture.comparison);
  await expectStoreError(
    sideMutation,
    "paper_trading_comparison_inert_graph_mutation_forbidden"
  );
  await expect(store.getPaperTradingEvaluation(
    fixture.challengerEvaluation.paper_trading_evaluation_id
  )).resolves.toEqual(fixture.challengerEvaluation);
});

it("rejects pair append when a side mutation wins the evidence transaction", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const fixture = await storedComparisonFixture(store);
  await store.recordPaperTradingEvaluation({
    ...fixture.challengerEvaluation,
    latest_score: {
      revenue_usdt: 1,
      cost_usdt: 0,
      net_revenue_usdt: 1,
      net_return_pct: 0.0001
    }
  });

  await expectStoreError(
    store.recordPaperTradingComparisonCommitment(fixture.comparison),
    "paper_trading_comparison_commitment_reference_mismatch"
  );
  await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
});

const controlledPairWriterKinds = [
  "create-run-exact",
  "alternate-commitment",
  "alternate-commitment-evaluation-chain",
  "evaluation",
  "observation",
  "ledger",
  "run-control",
  "sandbox-start"
] as const;

it.each(controlledPairWriterKinds)(
  "holds representative %s writer behind pair validation",
  async (writer) => {
    const store = new InterleavingComparisonLocalStore(path.join(tmpDir, writer));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    const pausesEvaluation = writer === "evaluation" || writer === "observation";
    if (pausesEvaluation) {
      store.pauseExactEvaluationRead();
    } else {
      store.pauseExactRunRead();
    }
    const pairAppend = store.recordPaperTradingComparisonCommitment(fixture.comparison);
    await (pausesEvaluation ? store.exactEvaluationReadEntered : store.exactRunReadEntered);
    const sideWriter = invokeBoundSideWriter(store, fixture, writer);
    await expectPromiseStillPending(sideWriter);
    if (pausesEvaluation) {
      store.releaseExactEvaluationRead();
    } else {
      store.releaseExactRunRead();
    }

    await expect(pairAppend).resolves.toEqual(fixture.comparison);
    if (writer === "create-run-exact") {
      await expect(sideWriter).resolves.toEqual(fixture.challengerRun);
    } else {
      await expectStoreError(
        sideWriter,
        "paper_trading_comparison_inert_graph_mutation_forbidden"
      );
    }
  }
);

it.each(controlledPairWriterKinds)(
  "makes representative %s writer visible when it wins before pair validation",
  async (writer) => {
    const store = new LocalStore(path.join(tmpDir, `writer-first-${writer}`));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await invokeBoundSideWriter(store, fixture, writer);

    if (writer === "create-run-exact") {
      await expect(store.recordPaperTradingComparisonCommitment(fixture.comparison))
        .resolves.toEqual(fixture.comparison);
    } else {
      await expectStoreError(
        store.recordPaperTradingComparisonCommitment(fixture.comparison),
        "paper_trading_comparison_commitment_reference_mismatch"
      );
      await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    }
  }
);
```

Add same-ID overwrite tests against the adapter's test-only files. Each case records a valid
preparation, rewrites one referenced record under the same ID, and proves exact replay revalidates
full content before any qualification side write:

```ts
it.each([
  "candidate-version-runtime",
  "system-code-entrypoint",
  "admission-content",
  "promotion-content",
  "promotion-evaluation-content",
  "promotion-commitment-content",
  "promotion-observation-content"
] as const)("rejects frozen same-ID drift: %s", async (drift) => {
  const store = new LocalStore(path.join(tmpDir, drift));
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  await store.reservePaperTradingComparisonPreparation(fixture.preparation);
  const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
  const evaluationsBefore = await store.listPaperTradingEvaluations();
  const tradingRunFilesBefore = (await readdir(
    path.join(store.root(), "trading-runs", "items")
  )).sort();

  if (drift === "candidate-version-runtime") {
    const record = (await store.getCandidateVersion(
      fixture.preparation.champion.candidate_version_ref.id
    ))!;
    await overwriteComparisonFixtureRecord(store, "candidate-versions", record.candidate_version_id, {
      ...record,
      runtime_ref: { record_kind: "trading_run", id: "same-id-drifted-default-run" }
    });
  } else if (drift === "system-code-entrypoint") {
    const record = (await store.getSystemCode(
      fixture.preparation.champion.system_code_ref.id
    ))!;
    await overwriteComparisonFixtureRecord(store, "system-codes", record.system_code_id, {
      ...record,
      entrypoint: ["python3", "same-id-drifted.py"],
      capability_policy_ref: {
        record_kind: "capability_policy",
        id: "same-id-drifted-capability-policy"
      }
    });
  } else if (drift === "admission-content") {
    const record = (await store.getCandidateAdmissionDecision(
      fixture.preparation.champion.candidate_admission_decision_ref.id
    ))!;
    await overwriteComparisonFixtureRecord(
      store,
      "candidate-admission-decisions",
      record.candidate_admission_decision_id,
      { ...record, decided_at: "2026-07-09T23:59:58.000Z" }
    );
  } else if (drift === "promotion-content") {
    const selection = fixture.preparation.champion_selection;
    if (selection.selection_kind !== "trading_review") {
      throw new Error("fixture promotion selection was not trading_review");
    }
    const record = (await store.getTradingPromotion(selection.trading_promotion_ref.id))!;
    await overwriteComparisonFixtureRecord(store, "trading-promotions", record.trading_promotion_id, {
      ...record,
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "same-id-drifted-selection-evaluation"
      }
    });
  } else if (drift === "promotion-evaluation-content") {
    const record = fixture.championPromotionEvidence.evaluation;
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      record.paper_trading_evaluation_id,
      { ...record, latest_failure_reason: "same-id-promotion-evaluation-drift" }
    );
  } else if (drift === "promotion-commitment-content") {
    const record = fixture.championPromotionEvidence.commitment;
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluation-commitments",
      record.paper_trading_evaluation_commitment_id,
      { ...record, committed_at: "2026-07-09T21:00:00.001Z" }
    );
  } else {
    const [record] = fixture.championPromotionEvidence.observations;
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-observations",
      record!.paper_trading_observation_id,
      { ...record, failure_reason: "same-id-promotion-observation-drift" }
    );
  }

  await expectStoreError(
    store.reservePaperTradingComparisonPreparation(fixture.preparation),
    "paper_trading_comparison_frozen_record_digest_mismatch"
  );
  await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(commitmentsBefore);
  await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
  expect((await readdir(path.join(store.root(), "trading-runs", "items"))).sort())
    .toEqual(tradingRunFilesBefore);
});

async function overwriteComparisonFixtureRecord(
  store: LocalStore,
  collection: string,
  id: string,
  record: unknown
): Promise<void> {
  await writeFile(
    path.join(store.root(), collection, "items", `${encodeURIComponent(id)}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8"
  );
}

async function readComparisonFixtureRecord<T>(
  store: LocalStore,
  collection: string,
  id: string
): Promise<T> {
  return JSON.parse(await readFile(
    path.join(store.root(), collection, "items", `${encodeURIComponent(id)}.json`),
    "utf8"
  )) as T;
}

it("keeps current materialization valid when optional record fields persist by omission", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const { system_code_ref: _systemCodeRef, ...withoutOptionalSystemCode } =
    validMaterializationInput();

  const outcome = await store.materializeCandidate(withoutOptionalSystemCode);

  expect(outcome.status).toBe("materialized");
  if (outcome.status !== "materialized") {
    throw new Error("candidate materialization unexpectedly failed");
  }
  const version = await store.getCandidateVersion(
    outcome.candidate.candidate_version.candidate_version_id
  );
  expect(version).toBeDefined();
  expect(Object.hasOwn(version!, "system_code_ref")).toBe(false);
  expect(() => paperTradingComparisonCandidateVersionDigestInput(version!)).not.toThrow();
});
```

Add focused pre-write rejection tests. `comparisonPreparationFixture` accepts
`championAdmissionStatus: "duplicate" | "quarantined"`, `omitChampionAdmission: true`,
`omitChampionPromotion: true`,
`mismatchChampionPromotion: true`, or `comparisonMode: "bootstrap"`; every variant records complete
supporting admission/promotion evidence before returning the unpersisted preparation:

```ts
const preparationRejectionCases: Array<[
  string,
  ComparisonPreparationFixtureOptions
]> = [
  ["missing admission", { omitChampionAdmission: true }],
  ["mismatched admission", { mismatchChampionAdmission: true }],
  ["duplicate admission", { championAdmissionStatus: "duplicate" }],
  ["quarantined admission", { championAdmissionStatus: "quarantined" }],
  ["admission after preparation", { futureChampionAdmission: true }],
  ["duplicate stored executable", { duplicateChallengerSystemCode: true }],
  ["missing champion promotion", { omitChampionPromotion: true }],
  ["mismatched champion promotion", { mismatchChampionPromotion: true }],
  ["missing promotion evaluation", { missingPromotionEvaluation: true }],
  ["wrong promotion evaluation refs", { wrongPromotionEvaluationRef: true }],
  ["qualification before champion admission", { preAdmissionQualification: true }],
  ["reversed promotion observation time", { reversePromotionObservationTime: true }],
  ["challenger SystemCode after admission", { challengerSystemCodeAfterAdmission: true }],
  ["promotion after preparation", { futureChampionPromotion: true }],
  ["bootstrap with existing promotion", { comparisonMode: "bootstrap" }]
];

it.each(preparationRejectionCases)(
  "rejects %s before preparation or side writes",
  async (_label, options) => {
  const store = new LocalStore(path.join(tmpDir, _label.replaceAll(" ", "-")));
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store, options);
  const runsBefore = await store.listTradingRunsForCandidateVersion(
    fixture.preparation.champion.candidate_version_ref.id
  );
  const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
  const evaluationsBefore = await store.listPaperTradingEvaluations();

  await expectStoreError(
    store.reservePaperTradingComparisonPreparation(fixture.preparation),
    options.omitChampionAdmission
      ? "paper_trading_comparison_preparation_reference_not_found"
      : options.duplicateChallengerSystemCode
      ? "paper_trading_comparison_duplicate_executable"
      : options.championAdmissionStatus || options.mismatchChampionAdmission ||
          options.futureChampionAdmission || options.challengerSystemCodeAfterAdmission
      ? "paper_trading_comparison_candidate_not_admitted"
      : options.missingPromotionEvaluation
      ? "paper_trading_comparison_preparation_reference_not_found"
      : "paper_trading_comparison_champion_selection_mismatch"
  );
  await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(commitmentsBefore);
  await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
  await expect(store.listTradingRunsForCandidateVersion(
    fixture.preparation.champion.candidate_version_ref.id
  )).resolves.toEqual(runsBefore);
  }
);

it("isolates the exact promotion evaluation ref with a second same-champion chain", async () => {
  const store = new LocalStore(path.join(tmpDir, "same-champion-exact-ref"));
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store, {
    wrongPromotionEvaluationRef: true
  });
  const alternate = fixture.alternateChampionPromotionEvidence;
  const selection = fixture.preparation.champion_selection;
  if (!alternate || selection.selection_kind !== "trading_review") {
    throw new Error("same-champion alternate promotion evidence was not built");
  }
  expect(alternate.commitment.candidate_ref).toEqual(
    fixture.championPromotionEvidence.commitment.candidate_ref
  );
  expect(alternate.commitment.candidate_version_ref).toEqual(
    fixture.championPromotionEvidence.commitment.candidate_version_ref
  );
  expect(alternate.commitment.system_code_ref).toEqual(
    fixture.championPromotionEvidence.commitment.system_code_ref
  );
  expect(fixture.promotion.paper_trading_evaluation_ref.id).toBe(
    fixture.championPromotionEvidence.evaluation.paper_trading_evaluation_id
  );
  expect(selection.paper_trading_evaluation_ref.id).toBe(
    alternate.evaluation.paper_trading_evaluation_id
  );
  const runsBefore = await store.listTradingRunsForCandidateVersion(
    fixture.preparation.champion.candidate_version_ref.id
  );
  const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
  const evaluationsBefore = await store.listPaperTradingEvaluations();

  await expectStoreError(
    store.reservePaperTradingComparisonPreparation(fixture.preparation),
    "paper_trading_comparison_champion_selection_mismatch"
  );
  await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  await expect(store.listTradingRunsForCandidateVersion(
    fixture.preparation.champion.candidate_version_ref.id
  )).resolves.toEqual(runsBefore);
  await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(commitmentsBefore);
  await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
});

it.each([
  "malformed-managed-provider",
  "wrong-system-code",
  "nested-fill-source-trade",
  "nested-public-execution-trade"
] as const)("rejects semantic promotion closure corruption without throwing: %s", async (kind) => {
  const store = new LocalStore(path.join(tmpDir, kind));
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  const evidence = fixture.championPromotionEvidence;
  let commitment = evidence.commitment;
  let evaluation = evidence.evaluation;
  if (kind === "malformed-managed-provider") {
    commitment = withPaperTradingCommitmentDigest({
      ...commitment,
      provider_identity: {
        runtime_provider_kind: "managed_agent",
        agent_profile_ref: { record_kind: "agent_profile", id: "codex" },
        model: {} as never,
        provider_configuration_digest: "sha256:provider",
        qualification_eligible: true
      },
      commitment_digest: ""
    });
  } else if (kind === "wrong-system-code") {
    commitment = withPaperTradingCommitmentDigest({
      ...commitment,
      system_code_ref: { record_kind: "system_code", id: "wrong-frozen-system-code" },
      commitment_digest: ""
    });
  } else if (kind === "nested-fill-source-trade") {
    evaluation = {
      ...evaluation,
      latest_fill: {
        fill_id: "fill-malformed",
        order_id: "order-malformed",
        fill_status: "filled",
        fill_price: "60000",
        fill_quantity: "0.01",
        fee_usdt: "0.1",
        slippage_usdt: "0",
        funding_usdt: "0",
        trade_time: evaluation.stopped_at!,
        source_trade_id: {} as never
      }
    };
  } else {
    evaluation = {
      ...evaluation,
      latest_public_execution_snapshot: {
        symbol: "BTCUSDT",
        observed_at: evaluation.stopped_at!,
        source_kind: "binance_production_public_rest",
        stream_marker: "malformed-aggregate-trade",
        agg_trades: [null] as never,
        authority_status: "read_only"
      }
    };
  }
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-evaluation-commitments",
    commitment.paper_trading_evaluation_commitment_id,
    commitment
  );
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-evaluations",
    evaluation.paper_trading_evaluation_id,
    evaluation
  );
  const selection = fixture.preparation.champion_selection;
  if (selection.selection_kind !== "trading_review") {
    throw new Error("fixture selection was not trading_review");
  }
  const preparation = withPreparationDigest({
    ...fixture.preparation,
    champion_selection: {
      ...selection,
      paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
      ),
      paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(evaluation)
      )
    },
    preparation_digest: ""
  });

  await expectStoreError(
    store.reservePaperTradingComparisonPreparation(preparation),
    "paper_trading_comparison_champion_selection_mismatch"
  );
  await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
});

it.each([
  "missing-market",
  "failed-ratio",
  "accounting-discontinuity",
  "bad-commitment-self-digest"
] as const)("rejects directly stored unqualified promotion evidence: %s", async (kind) => {
  const store = new LocalStore(path.join(tmpDir, `direct-qualification-${kind}`));
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  const selection = fixture.preparation.champion_selection;
  if (selection.selection_kind !== "trading_review") {
    throw new Error("fixture selection was not trading_review");
  }
  let commitment = structuredClone(fixture.championPromotionEvidence.commitment);
  const evaluation = structuredClone(fixture.championPromotionEvidence.evaluation);
  const observations = structuredClone(fixture.championPromotionEvidence.observations);
  if (kind === "missing-market") {
    for (const observation of observations) {
      delete observation.market_snapshot;
    }
  } else if (kind === "failed-ratio") {
    for (const observation of observations.slice(0, 4)) {
      observation.status = "failed";
      observation.failure_reason = "isolated failed-ratio evidence";
    }
  } else if (kind === "accounting-discontinuity") {
    observations[0]!.score_delta.revenue_usdt = 1;
    observations[0]!.cumulative_score.revenue_usdt = 1;
  } else {
    commitment = {
      ...commitment,
      data_identity: {
        ...commitment.data_identity,
        market_data_configuration_digest: "sha256:self-digest-isolated-drift"
      }
    };
  }
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-evaluation-commitments",
    commitment.paper_trading_evaluation_commitment_id,
    commitment
  );
  for (const observation of observations) {
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-observations",
      observation.paper_trading_observation_id,
      observation
    );
  }
  const preparation = withPreparationDigest({
    ...fixture.preparation,
    champion_selection: {
      ...selection,
      paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
      ),
      paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(evaluation)
      ),
      paper_trading_observation_chain_digest: comparisonExactRecordDigest(
        paperTradingComparisonObservationChainDigestInput(observations)
      )
    },
    preparation_digest: ""
  });
  const runsBefore = await store.listTradingRunsForCandidateVersion(
    preparation.champion.candidate_version_ref.id
  );
  const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
  const evaluationsBefore = await store.listPaperTradingEvaluations();

  await expectStoreError(
    store.reservePaperTradingComparisonPreparation(preparation),
    "paper_trading_comparison_champion_selection_mismatch"
  );
  await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  await expect(store.listTradingRunsForCandidateVersion(
    preparation.champion.candidate_version_ref.id
  )).resolves.toEqual(runsBefore);
  await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(commitmentsBefore);
  await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
});

it("accepts a key-reordered but semantically identical promotion account", async () => {
  const store = new LocalStore(path.join(tmpDir, "qualification-account-key-order"));
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  const evaluation = structuredClone(fixture.championPromotionEvidence.evaluation);
  const account = evaluation.paper_account_snapshot;
  if (!account) {
    throw new Error("qualification fixture evaluation has no account");
  }
  const runsBefore = await store.listTradingRunsForCandidateVersion(
    fixture.preparation.champion.candidate_version_ref.id
  );
  const reorderedPosition = Object.fromEntries(
    Object.entries(account.position).reverse()
  ) as unknown as PaperTradingAccountSnapshot["position"];
  evaluation.paper_account_snapshot = Object.fromEntries(
    Object.entries(account).reverse().map(([key, value]) =>
      key === "position" ? [key, reorderedPosition] : [key, value]
    )
  ) as unknown as PaperTradingAccountSnapshot;
  expect(comparisonExactRecordDigest(
    paperTradingComparisonEvaluationRecordDigestInput(evaluation)
  )).toBe(fixture.preparation.champion_selection.selection_kind === "trading_review"
    ? fixture.preparation.champion_selection.paper_trading_evaluation_record_digest
    : "");
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-evaluations",
    evaluation.paper_trading_evaluation_id,
    evaluation
  );

  await expect(store.reservePaperTradingComparisonPreparation(fixture.preparation))
    .resolves.toEqual(fixture.preparation);
  await expect(store.listTradingRunsForCandidateVersion(
    fixture.preparation.champion.candidate_version_ref.id
  )).resolves.toEqual(runsBefore);
});
```

Use `storedComparisonFixture(store)` to record the validated preparation, both side runs, side
commitments, and `not_started` evaluations before constructing the pair:

```ts
it("records and reloads an exact paper comparison commitment", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const fixture = await storedComparisonFixture(store);

  const first = await store.recordPaperTradingComparisonCommitment(fixture.comparison);
  const repeated = await store.recordPaperTradingComparisonCommitment(fixture.comparison);

  expect(repeated).toEqual(first);
  await expect(store.listPaperTradingComparisonCommitments())
    .resolves.toEqual([fixture.comparison]);
  const reloaded = new LocalStore(tmpDir);
  await expect(reloaded.getPaperTradingComparisonCommitment(
    fixture.comparison.paper_trading_comparison_commitment_id
  )).resolves.toEqual(fixture.comparison);
});

it.each(["evaluation-content", "observation-chain"] as const)(
  "revalidates frozen promotion %s before pair append",
  async (drift) => {
    const store = new LocalStore(path.join(tmpDir, `pair-revalidation-${drift}`));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    if (drift === "evaluation-content") {
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-evaluations",
        fixture.championPromotionEvidence.evaluation.paper_trading_evaluation_id,
        {
          ...fixture.championPromotionEvidence.evaluation,
          latest_failure_reason: "test-only-bypass-of-frozen-evidence-guard"
        }
      );
    } else {
      const last = fixture.championPromotionEvidence.observations.at(-1)!;
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-observations",
        last.paper_trading_observation_id,
        {
          ...last,
          market_snapshot: { ...last.market_snapshot!, price: 60_001 }
        }
      );
    }

    await expectStoreError(
      store.recordPaperTradingComparisonCommitment(fixture.comparison),
      "paper_trading_comparison_frozen_record_digest_mismatch"
    );
    await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  }
);

const postPairWriterCases = [
  ["createPaperTradingRun exact replay", "create-run-exact", "no_change"],
  ["recordPaperTradingEvaluationCommitment exact replay", "commitment-exact", "no_change"],
  ["recordPaperTradingEvaluation exact replay", "evaluation-exact", "no_change"],
  ["alternate commitment for bound run", "alternate-commitment", "reject"],
  [
    "alternate commitment/evaluation chain for bound run",
    "alternate-commitment-evaluation-chain",
    "reject"
  ],
  ["recordPaperTradingEvaluation mutation", "evaluation", "reject"],
  ["recordPaperTradingObservation", "observation", "reject"],
  ["recordLedger", "ledger", "reject"],
  ["recordRunControlAudit", "run-control", "reject"],
  ["recordSandboxStart", "sandbox-start", "reject"],
  ["recordSandboxObservations", "sandbox-observations", "reject"],
  ["stopSandbox", "sandbox-stop", "reject"]
] as const;

it.each(postPairWriterCases)(
  "serializes and guards post-pair writer: %s",
  async (_label, writer, expected) => {
    const store = new LocalStore(path.join(tmpDir, writer));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    if (writer === "sandbox-observations" || writer === "sandbox-stop") {
      await seedBoundSandboxForWriterTest(store, fixture);
    }
    const before = await boundComparisonEvidenceSnapshot(store, fixture);

    const call = invokeBoundSideWriter(store, fixture, writer);
    if (expected === "no_change") {
      await expect(call).resolves.toBeDefined();
    } else {
      await expectStoreError(
        call,
        "paper_trading_comparison_inert_graph_mutation_forbidden"
      );
    }
    await expect(boundComparisonEvidenceSnapshot(store, fixture)).resolves.toEqual(before);
  }
);

it.each([
  ["recordSystemCode", "system-code"],
  ["recordCandidateAdmissionDecision", "admission"],
  ["recordTradingPromotion", "promotion"]
] as const)("rejects frozen authority writer drift after pair: %s", async (_label, writer) => {
  const store = new LocalStore(path.join(tmpDir, writer));
  await store.initialize();
  const fixture = await storedComparisonFixture(store);
  await store.recordPaperTradingComparisonCommitment(fixture.comparison);
  const before = await boundComparisonEvidenceSnapshot(store, fixture);
  const call = writer === "system-code"
    ? store.recordSystemCode({
        ...(await store.getSystemCode(fixture.preparation.champion.system_code_ref.id))!,
        entrypoint: ["python3", "frozen-writer-drift.py"]
      })
    : writer === "admission"
      ? store.recordCandidateAdmissionDecision({
          ...(await store.getCandidateAdmissionDecision(
            fixture.preparation.champion.candidate_admission_decision_ref.id
          ))!,
          decided_at: "2026-07-09T20:55:00.001Z"
        })
      : store.recordTradingPromotion({
          ...fixture.promotion,
          promoted_at: "2026-07-09T21:31:00.001Z"
        });

  await expectStoreError(
    call,
    "paper_trading_comparison_frozen_authority_write_conflict"
  );
  await expect(boundComparisonEvidenceSnapshot(store, fixture)).resolves.toEqual(before);
});

it("allows deterministic CandidateVersion materialization replay without changing frozen bytes", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const fixture = await storedComparisonFixture(store);
  await store.recordPaperTradingComparisonCommitment(fixture.comparison);
  const versionBefore = await store.getCandidateVersion(
    fixture.preparation.challenger.candidate_version_ref.id
  );

  await expect(store.materializeCandidate(
    fixture.challengerMaterializationInput
  )).resolves.toMatchObject({ status: "materialized" });
  await expect(store.getCandidateVersion(
    fixture.preparation.challenger.candidate_version_ref.id
  )).resolves.toEqual(versionBefore);
});

it("rejects comparison drift, preparation mismatch, and invalid side graphs", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const fixture = await storedComparisonFixture(store);
  await store.recordPaperTradingComparisonCommitment(fixture.comparison);

  await expectStoreError(
    store.recordPaperTradingComparisonCommitment({
      ...fixture.comparison,
      committed_at: "2026-07-10T00:01:00.000Z"
    }),
    "paper_trading_comparison_commitment_conflict"
  );

  await expectStoreError(
    store.recordPaperTradingComparisonCommitment(withComparisonDigest({
      ...fixture.comparison,
      preparation_ref: {
        record_kind: "paper_trading_comparison_preparation",
        id: "missing-paper-comparison-preparation"
      },
      commitment_digest: ""
    })),
    "paper_trading_comparison_preparation_reference_not_found"
  );

  await expectStoreError(
    store.recordPaperTradingComparisonCommitment(withComparisonDigest({
      ...fixture.comparison,
      paper_trading_comparison_commitment_id: "paper-comparison-zero-minimum",
      comparison_policy: {
        ...fixture.comparison.comparison_policy,
        minimum_observation_count: 0,
        minimum_elapsed_ms: 0
      },
      commitment_digest: ""
    })),
    "invalid_paper_trading_comparison_commitment_input"
  );

  const invalidStore = new LocalStore(path.join(tmpDir, "wrong-market"));
  await invalidStore.initialize();
  const invalidFixture = await storedComparisonFixture(invalidStore);
  const wrongMarket = withComparisonDigest({
    ...invalidFixture.comparison,
    market_data_configuration_digest: "sha256:different-market",
    commitment_digest: ""
  });
  await expectStoreError(
    invalidStore.recordPaperTradingComparisonCommitment(wrongMarket),
    "paper_trading_comparison_preparation_mismatch"
  );
});

it.each([
  ["provider-ineligible", "paper_trading_comparison_commitment_reference_mismatch"],
  ["window-policy-mismatch", "paper_trading_comparison_commitment_reference_mismatch"],
  ["duplicate-resolved-artifact", "paper_trading_comparison_commitment_reference_mismatch"],
  ["evaluation-outcome-state", "paper_trading_comparison_commitment_reference_mismatch"],
  ["replacement-evaluation-id", "paper_trading_comparison_commitment_reference_mismatch"],
  ["side-time-before-preparation", "paper_trading_comparison_commitment_reference_mismatch"],
  ["run-time-before-preparation", "paper_trading_comparison_commitment_reference_mismatch"]
] as const)("rejects malformed inert side graph %s", async (malformation, code) => {
  const store = new LocalStore(path.join(tmpDir, malformation));
  await store.initialize();
  const fixture = await storedComparisonFixture(store, { malformation });

  await expectStoreError(
    store.recordPaperTradingComparisonCommitment(fixture.comparison),
    code
  );
  await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
});

it.each([
  "commitment-authority",
  "private-exchange-access",
  "non-neutral-account",
  "ref-kind-drift"
] as const)("rejects persisted self-consistent inert-state drift: %s", async (drift) => {
  const store = new LocalStore(path.join(tmpDir, drift));
  await store.initialize();
  const fixture = await storedComparisonFixture(store);
  await store.recordPaperTradingComparisonCommitment(fixture.comparison);
  const nonNeutralAccount = {
    ...structuredClone(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT),
    wallet_balance_usdt: "10001",
    available_balance_usdt: "10001",
    equity_usdt: "10001",
    realized_pnl_usdt: "1"
  };
  const changedCommitment = withPaperTradingCommitmentDigest({
    ...fixture.challengerCommitment,
    ...(drift === "commitment-authority"
      ? { authority_status: "live" as never }
      : {}),
    ...(drift === "private-exchange-access"
      ? {
          data_identity: {
            ...fixture.challengerCommitment.data_identity,
            private_exchange_access: "allowed" as never
          }
        }
      : {}),
    ...(drift === "non-neutral-account"
      ? { initial_account_snapshot: nonNeutralAccount }
      : {}),
    ...(drift === "ref-kind-drift"
      ? {
          candidate_ref: {
            record_kind: "same-id-wrong-kind",
            id: fixture.challengerCommitment.candidate_ref.id
          }
        }
      : {}),
    commitment_digest: ""
  });
  const changedEvaluation = drift === "non-neutral-account"
    ? {
        ...fixture.challengerEvaluation,
        paper_account_snapshot: nonNeutralAccount
      }
    : fixture.challengerEvaluation;
  const changedPair = withComparisonDigest({
    ...fixture.comparison,
    challenger: {
      ...fixture.comparison.challenger,
      paper_trading_evaluation_commitment_digest: changedCommitment.commitment_digest,
      paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(changedCommitment)
      ),
      paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(changedEvaluation)
      )
    },
    commitment_digest: ""
  });
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-evaluation-commitments",
    changedCommitment.paper_trading_evaluation_commitment_id,
    changedCommitment
  );
  if (changedEvaluation !== fixture.challengerEvaluation) {
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      fixture.challengerEvaluation.paper_trading_evaluation_id,
      changedEvaluation
    );
  }
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-comparison-commitments",
    changedPair.paper_trading_comparison_commitment_id,
    changedPair
  );

  await expectStoreError(
    store.recordPaperTradingComparisonCommitment(changedPair),
    "paper_trading_comparison_commitment_reference_mismatch"
  );
});

it("rejects same-ID side time rewrites while the persisted pair bytes stay unchanged", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const fixture = await storedComparisonFixture(store);
  await store.recordPaperTradingComparisonCommitment(fixture.comparison);
  const pairBefore = await readComparisonFixtureRecord<PaperTradingComparisonCommitmentRecord>(
    store,
    "paper-trading-comparison-commitments",
    fixture.comparison.paper_trading_comparison_commitment_id
  );
  const rewrittenAt = "2026-07-10T00:00:00.001Z";
  const changedCommitment = withPaperTradingCommitmentDigest({
    ...fixture.challengerCommitment,
    committed_at: rewrittenAt,
    commitment_digest: ""
  });
  const changedEvaluation = {
    ...fixture.challengerEvaluation,
    started_at: rewrittenAt
  };
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-evaluation-commitments",
    changedCommitment.paper_trading_evaluation_commitment_id,
    changedCommitment
  );
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-evaluations",
    changedEvaluation.paper_trading_evaluation_id,
    changedEvaluation
  );

  expect(changedCommitment.commitment_digest)
    .toBe(fixture.challengerCommitment.commitment_digest);
  await expect(store.getPaperTradingComparisonCommitment(
    pairBefore.paper_trading_comparison_commitment_id
  )).resolves.toEqual(pairBefore);
  await expectStoreError(
    store.recordPaperTradingComparisonCommitment(pairBefore),
    "paper_trading_comparison_commitment_reference_mismatch"
  );
});

it.each(["missing-provider-identity", "missing-account-position"] as const)(
  "returns a stable graph error for persisted malformed nested data: %s",
  async (malformation) => {
    const store = new LocalStore(path.join(tmpDir, malformation));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const { provider_identity: _providerIdentity, ...withoutProvider } =
      fixture.challengerCommitment;
    const { position: _position, ...accountWithoutPosition } =
      fixture.challengerCommitment.initial_account_snapshot;
    const malformedCommitment = withPaperTradingCommitmentDigest({
      ...(malformation === "missing-provider-identity"
        ? withoutProvider
        : {
            ...fixture.challengerCommitment,
            initial_account_snapshot: accountWithoutPosition as never
          }),
      commitment_digest: ""
    } as PaperTradingEvaluationCommitmentRecord);
    const malformedPair = withComparisonDigest({
      ...fixture.comparison,
      challenger: {
        ...fixture.comparison.challenger,
        paper_trading_evaluation_commitment_digest: malformedCommitment.commitment_digest,
        paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(malformedCommitment)
        )
      },
      commitment_digest: ""
    });
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluation-commitments",
      malformedCommitment.paper_trading_evaluation_commitment_id,
      malformedCommitment
    );
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-comparison-commitments",
      malformedPair.paper_trading_comparison_commitment_id,
      malformedPair
    );

    await expectStoreError(
      store.recordPaperTradingComparisonCommitment(malformedPair),
      "paper_trading_comparison_commitment_reference_mismatch"
    );
  }
);

it.each(["candidate", "candidate-version", "trading-run", "system-code"] as const)(
  "rejects persisted same-ID loaded-record drift: %s",
  async (drift) => {
    const store = new LocalStore(path.join(tmpDir, drift));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    let replay = fixture.comparison;
    if (drift === "candidate") {
      const candidate = await readComparisonFixtureRecord<TradingSystemCandidateRecord>(
        store,
        "candidates",
        fixture.comparison.challenger.candidate_ref.id
      );
      await overwriteComparisonFixtureRecord(store, "candidates", candidate.candidate_id, {
        ...candidate,
        candidate_id: "same-path-drifted-candidate-id"
      });
    } else if (drift === "candidate-version") {
      const version = (await store.getCandidateVersion(
        fixture.comparison.challenger.candidate_version_ref.id
      ))!;
      const changedVersion = {
        ...version,
        runtime_ref: { ...fixture.comparison.challenger.trading_run_ref }
      };
      await overwriteComparisonFixtureRecord(
        store,
        "candidate-versions",
        version.candidate_version_id,
        changedVersion
      );
      replay = await rewriteFrozenSideDigestsForSemanticTest(store, fixture, {
        candidate_version_digest: comparisonExactRecordDigest(
          paperTradingComparisonCandidateVersionDigestInput(changedVersion)
        )
      });
    } else if (drift === "trading-run") {
      const run = (await store.getTradingRun(fixture.challengerRun.trading_run_id))!;
      await overwriteComparisonFixtureRecord(store, "trading-runs", run.trading_run_id, {
        ...run,
        trace_ref: { record_kind: "trace_placeholder", id: "unexpected-prestart-trace" }
      });
    } else {
      const code = (await store.getSystemCode(
        fixture.comparison.challenger.system_code_ref.id
      ))!;
      const changedCode = {
        ...code,
        entrypoint: ["python3", "same-id-drifted-entrypoint.py"]
      };
      await overwriteComparisonFixtureRecord(
        store,
        "system-codes",
        code.system_code_id,
        changedCode
      );
      replay = await rewriteFrozenSideDigestsForSemanticTest(store, fixture, {
        system_code_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonSystemCodeRecordDigestInput(changedCode)
        )
      });
    }

    await expectStoreError(
      store.recordPaperTradingComparisonCommitment(replay),
      "paper_trading_comparison_commitment_reference_mismatch"
    );
  }
);

async function rewriteFrozenSideDigestsForSemanticTest(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>,
  updates: Partial<PaperTradingComparisonSide>
): Promise<PaperTradingComparisonCommitmentRecord> {
  const preparation = withPreparationDigest({
    ...fixture.preparation,
    challenger: { ...fixture.preparation.challenger, ...updates },
    preparation_digest: ""
  });
  const pair = withComparisonDigest({
    ...fixture.comparison,
    challenger: { ...fixture.comparison.challenger, ...updates },
    commitment_digest: ""
  });
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-comparison-preparations",
    preparation.paper_trading_comparison_preparation_id,
    preparation
  );
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-comparison-commitments",
    pair.paper_trading_comparison_commitment_id,
    pair
  );
  return pair;
}
```

Add focused fixtures for the validation cases. Reuse the existing `validMaterializationInput`,
`validPaperTradingCommitment`, `validPaperTradingEvaluation`, and `withPaperTradingCommitmentDigest`
helpers in the same test file; do not duplicate their implementations. The
`wrongPromotionEvaluationRef` variant creates a second valid causal qualification run for the same
champion CandidateVersion and SystemCode. The persisted promotion remains bound to the canonical
chain while the preparation selection binds the alternate chain, so only the exact evaluation ref
and its paired commitment/evaluation/observation digests differ:

```ts
interface ComparisonPreparationFixtureOptions {
  championAdmissionStatus?: "admitted" | "duplicate" | "quarantined";
  omitChampionAdmission?: boolean;
  mismatchChampionAdmission?: boolean;
  futureChampionAdmission?: boolean;
  omitChampionPromotion?: boolean;
  mismatchChampionPromotion?: boolean;
  futureChampionPromotion?: boolean;
  missingPromotionEvaluation?: boolean;
  wrongPromotionEvaluationRef?: boolean;
  preAdmissionQualification?: boolean;
  reversePromotionObservationTime?: boolean;
  challengerSystemCodeAfterAdmission?: boolean;
  comparisonMode?: "bootstrap" | "champion_challenge";
  duplicateChallengerSystemCode?: boolean;
  challengerSystemCode?: SystemCodeRecord;
}

async function comparisonPreparationFixture(
  store: LocalStore,
  options: ComparisonPreparationFixtureOptions = {}
) {
  const champion = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!champion) {
    throw new Error("fixture champion was not materialized");
  }
  const challengerCode = options.challengerSystemCode ?? {
    ...validProposedSystemCodeRecord(),
    system_code_id: "system-code-paper-comparison-challenger",
    artifact_digest: options.duplicateChallengerSystemCode
      ? (await store.getSystemCode(FIXTURE_SYSTEM_CODE_ID))!.artifact_digest
      : "sha256:paper-comparison-challenger",
    artifact_path: "fixtures/trading-systems/clock.py",
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-arena-paper-system-code"
    },
    created_at: options.challengerSystemCodeAfterAdmission
      ? "2026-07-09T20:57:00.000Z"
      : "2026-07-09T20:50:00.000Z",
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "secret-policy-no-raw-values-v1"
    }
  };
  await store.recordSystemCode(challengerCode);
  const challengerMaterializationInput: CandidateMaterializationInput = {
    ...validMaterializationInput(),
    idempotency_key: "paper-comparison-challenger",
    system_code_ref: options.duplicateChallengerSystemCode
      ? { record_kind: "system_code", id: FIXTURE_SYSTEM_CODE_ID }
      : { record_kind: "system_code", id: challengerCode.system_code_id }
  };
  const challengerOutcome = await store.materializeCandidate(challengerMaterializationInput);
  if (challengerOutcome.status !== "materialized") {
    throw new Error("comparison challenger was not materialized");
  }
  const challenger = challengerOutcome.candidate;
  const championAdmission = await recordComparisonAdmissionEvidence(
    store,
    champion,
    "champion",
    options.championAdmissionStatus ?? "admitted",
    options.omitChampionAdmission ?? false,
    options.futureChampionAdmission
      ? "2026-07-10T00:01:00.000Z"
      : options.preAdmissionQualification
        ? "2026-07-09T21:15:00.000Z"
        : "2026-07-09T20:55:00.000Z"
  );
  const challengerAdmission = await recordComparisonAdmissionEvidence(
    store,
    challenger,
    "challenger",
    "admitted",
    false,
    "2026-07-09T20:56:00.000Z"
  );
  const comparisonMode = options.comparisonMode ?? "champion_challenge";
  let championPromotionEvidence = await recordQualifiedPromotionEvidence(
    store,
    champion,
    "champion",
    "2026-07-09T21:00:00.000Z"
  );
  if (options.reversePromotionObservationTime) {
    championPromotionEvidence = await reverseQualificationObservationTime(
      store,
      championPromotionEvidence
    );
  }
  const alternateChampionPromotionEvidence = options.wrongPromotionEvaluationRef
    ? await recordQualifiedPromotionEvidence(
        store,
        champion,
        "alternate-champion-authority",
        "2026-07-09T21:00:00.000Z"
      )
    : undefined;
  const promotion: TradingPromotionRecord = {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "trading-promotion-comparison-champion",
    status: "promoted_for_trading_review",
    candidate_ref: options.mismatchChampionPromotion
      ? { record_kind: "trading_system_candidate", id: challenger.candidate_id }
      : { record_kind: "trading_system_candidate", id: champion.candidate_id },
    candidate_version_ref: options.mismatchChampionPromotion
      ? {
          record_kind: "candidate_version",
          id: challenger.candidate_version.candidate_version_id
        }
      : {
          record_kind: "candidate_version",
          id: champion.candidate_version.candidate_version_id
        },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: championPromotionEvidence.evaluation.paper_trading_evaluation_id
    },
    promoted_at: options.futureChampionPromotion
      ? "2026-07-10T00:01:00.000Z"
      : "2026-07-09T21:31:00.000Z",
    authority_status: "not_live"
  };
  if (options.missingPromotionEvaluation) {
    await rm(path.join(
      store.root(),
      "paper-trading-evaluations/items",
      `${encodeURIComponent(championPromotionEvidence.evaluation.paper_trading_evaluation_id)}.json`
    ), { force: true });
  }
  if (!options.omitChampionPromotion) {
    await store.recordTradingPromotion(promotion);
  }
  const preparationWithoutDigest: PaperTradingComparisonPreparationRecord = {
    record_kind: "paper_trading_comparison_preparation",
    version: 1,
    paper_trading_comparison_preparation_id: "paper-comparison-preparation-store-001",
    paper_trading_comparison_commitment_id: "paper-comparison-store-001",
    champion: await comparisonCandidateSide(
      store,
      "champion",
      champion,
      options.mismatchChampionAdmission ? challengerAdmission : championAdmission
    ),
    challenger: await comparisonCandidateSide(
      store,
      "challenger",
      challenger,
      challengerAdmission
    ),
    champion_selection: comparisonMode === "bootstrap"
      ? { selection_kind: "bootstrap" }
      : {
          selection_kind: "trading_review",
          trading_promotion_ref: {
            record_kind: "trading_promotion",
            id: promotion.trading_promotion_id
          },
          trading_promotion_digest: comparisonExactRecordDigest(
            paperTradingComparisonTradingPromotionDigestInput(promotion)
          ),
          paper_trading_evaluation_ref: {
            record_kind: "paper_trading_evaluation",
            id: (alternateChampionPromotionEvidence ?? championPromotionEvidence)
              .evaluation.paper_trading_evaluation_id
          },
          paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
            paperTradingComparisonEvaluationRecordDigestInput(
              (alternateChampionPromotionEvidence ?? championPromotionEvidence).evaluation
            )
          ),
          paper_trading_evaluation_commitment_ref: {
            record_kind: "paper_trading_evaluation_commitment",
            id: (alternateChampionPromotionEvidence ?? championPromotionEvidence)
              .commitment.paper_trading_evaluation_commitment_id
          },
          paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
            paperTradingComparisonEvaluationCommitmentRecordDigestInput(
              (alternateChampionPromotionEvidence ?? championPromotionEvidence).commitment
            )
          ),
          paper_trading_observation_chain_digest: comparisonExactRecordDigest(
            paperTradingComparisonObservationChainDigestInput(
              (alternateChampionPromotionEvidence ?? championPromotionEvidence).observations
            )
          )
        },
    comparison_policy: {
      ...validPaperTradingComparisonCommitment().comparison_policy,
      comparison_mode: comparisonMode
    },
    market_data_configuration_digest:
      validPaperTradingCommitment().data_identity.market_data_configuration_digest,
    paper_policy_identity: structuredClone(
      validPaperTradingComparisonCommitment().paper_policy_identity
    ),
    committed_at: "2026-07-10T00:00:00.000Z",
    preparation_digest: "",
    authority_status: "not_live"
  };
  return {
    champion,
    challenger,
    championAdmission,
    challengerAdmission,
    challengerMaterializationInput,
    promotion,
    championPromotionEvidence,
    alternateChampionPromotionEvidence,
    preparation: withPreparationDigest(preparationWithoutDigest)
  };
}

async function comparisonCandidateSide(
  store: LocalStore,
  role: "champion" | "challenger",
  candidate: CandidateInspectReadModel,
  admission: CandidateAdmissionDecisionRecord
): Promise<PaperTradingComparisonCandidateSide> {
  const candidateVersion = await store.getCandidateVersion(
    candidate.candidate_version.candidate_version_id
  );
  const systemCode = candidateVersion?.system_code_ref
    ? await store.getSystemCode(candidateVersion.system_code_ref.id)
    : undefined;
  if (!candidateVersion || !systemCode) {
    throw new Error(`comparison ${role} exact CandidateVersion/SystemCode was not found`);
  }
  return {
    role,
    candidate_ref: { record_kind: "trading_system_candidate", id: candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: candidateVersion.candidate_version_id
    },
    candidate_version_digest: comparisonExactRecordDigest(
      paperTradingComparisonCandidateVersionDigestInput(candidateVersion)
    ),
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    system_code_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonSystemCodeRecordDigestInput(systemCode)
    ),
    system_code_artifact_digest: systemCode.artifact_digest,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: admission.candidate_admission_decision_id
    },
    admission_decision_digest: comparisonExactRecordDigest(
      paperTradingComparisonAdmissionDecisionDigestInput(admission)
    )
  };
}

function comparisonExactRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

async function recordComparisonAdmissionEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel,
  suffix: "champion" | "challenger",
  status: "admitted" | "duplicate" | "quarantined",
  omitDecision: boolean,
  decidedAt?: string
): Promise<CandidateAdmissionDecisionRecord> {
  const systemCodeId = candidate.system_code?.ref?.id;
  const systemCode = systemCodeId ? await store.getSystemCode(systemCodeId) : undefined;
  if (!systemCode) {
    throw new Error(`comparison ${suffix} SystemCode was not found`);
  }
  const base = validCandidateAdmissionRecords();
  const sourceDigest = status === "duplicate"
    ? systemCode.artifact_digest
    : `sha256:comparison-admission-source-${suffix}`;
  const sourceSystemCode: SystemCodeRecord = {
    ...validCandidateAdmissionSourceSystemCode(),
    system_code_id: `system-code-comparison-admission-source-${suffix}`,
    artifact_digest: sourceDigest,
    created_at: "2026-07-09T20:51:00.000Z"
  };
  const experiment: ExperimentRunRecord = {
    ...base.experiment,
    experiment_run_id: `experiment-run-comparison-admission-${suffix}`,
    research_worker_ref: {
      record_kind: "research_worker",
      id: `research-worker-comparison-admission-${suffix}`
    },
    research_direction_ref: {
      record_kind: "research_direction",
      id: `research-direction-comparison-admission-${suffix}`
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: `trading-evaluation-task-comparison-admission-${suffix}`
    },
    submitted_at: "2026-07-09T20:52:00.000Z"
  };
  const evaluation: TradingEvaluationResultRecord = {
    ...base.evaluation,
    trading_evaluation_result_id: `trading-evaluation-result-comparison-admission-${suffix}`,
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    result_status: status === "quarantined" ? "quarantined_for_review" : "accepted",
    completed_at: "2026-07-09T20:53:00.000Z"
  };
  const finding: ResearchFindingRecord = {
    ...base.finding,
    research_finding_id: `research-finding-comparison-admission-${suffix}`,
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    supporting_record_refs: [{
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    }],
    created_at: "2026-07-09T20:54:00.000Z"
  };
  const admission: CandidateAdmissionDecisionRecord = {
    ...base.admission,
    candidate_admission_decision_id: `candidate-admission-comparison-${suffix}`,
    source_system_code_ref: {
      record_kind: "system_code",
      id: sourceSystemCode.system_code_id
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: { ...finding.trading_evaluation_result_ref },
    research_finding_ref: {
      record_kind: "research_finding",
      id: finding.research_finding_id
    },
    source_artifact_digest: sourceDigest,
    submitted_artifact_digest: systemCode.artifact_digest,
    research_worker_outcome: status === "duplicate" ? "unchanged" : "changed",
    evaluation_status: status === "quarantined" ? "quarantined_for_review" : "accepted",
    status,
    reason: status === "admitted"
      ? "evaluation_accepted"
      : status === "duplicate"
        ? "no_candidate_change"
        : "evaluation_quarantined",
    runnable_paper_handoff: status === "admitted",
    decided_at: decidedAt ?? base.admission.decided_at
  };
  await store.recordSystemCode(sourceSystemCode);
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  await store.recordResearchFinding(finding);
  if (!omitDecision) {
    await store.recordCandidateAdmissionDecision(admission);
  }
  return admission;
}

async function recordQualifiedPromotionEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel,
  suffix: string,
  startedAt: string
): Promise<{
  run: TradingRunRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}> {
  const run = await store.createPaperTradingRun({
    idempotency_key: `promotion-evidence-${suffix}`,
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: startedAt
  });
  const systemCode = (await store.getSystemCode(run.system_code_ref!.id))!;
  const commitment = qualificationCommitment(
    candidate,
    run,
    systemCode,
    `paper-commitment-promotion-${suffix}`,
    startedAt
  );
  await store.recordPaperTradingEvaluationCommitment(commitment);
  let evaluation: PaperTradingEvaluationRecord = {
    ...validPaperTradingEvaluation(commitment),
    paper_trading_evaluation_id: `paper-evaluation-promotion-${suffix}`,
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    observation_count: 0,
    started_at: startedAt,
    latest_score: { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 },
    paper_account_snapshot: structuredClone(commitment.initial_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: []
  };
  await store.recordPaperTradingEvaluation(evaluation);
  const observations: PaperTradingObservationRecord[] = [];
  for (let sequence = 1; sequence <= 30; sequence += 1) {
    const observedAt = new Date(Date.parse(startedAt) + sequence * 60_000).toISOString();
    const observation: PaperTradingObservationRecord = {
      record_kind: "paper_trading_observation",
      version: 1,
      paper_trading_observation_id: `paper-observation-promotion-${suffix}-${sequence}`,
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: evaluation.paper_trading_evaluation_id
      },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: commitment.paper_trading_evaluation_commitment_id
      },
      candidate_ref: { ...commitment.candidate_ref },
      candidate_version_ref: { ...commitment.candidate_version_ref },
      trading_run_ref: { ...commitment.trading_run_ref },
      sequence,
      status: "no_order",
      observed_at: observedAt,
      ...(sequence === 30
        ? {
            market_snapshot: {
              symbol: "BTCUSDT" as const,
              price: 60_000,
              observed_at: observedAt,
              source_kind: "binance_production_public_rest" as const,
              authority_status: "read_only" as const
            }
          }
        : {}),
      paper_account_snapshot: structuredClone(commitment.initial_account_snapshot),
      open_orders: [],
      processed_trading_system_event_ids: [],
      processed_public_trade_ids: [],
      score_delta: { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 },
      cumulative_score: { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 },
      authority_status: "not_live"
    };
    const { next_observation_at: _next, stopped_at: _stopped, ...previous } = evaluation;
    evaluation = {
      ...previous,
      status: sequence === 30 ? "stopped" : "running",
      observation_count: sequence,
      last_observed_at: observedAt,
      ...(sequence === 30
        ? { stopped_at: observedAt }
        : {
            next_observation_at: new Date(
              Date.parse(startedAt) + (sequence + 1) * 60_000
            ).toISOString()
          })
    };
    await store.recordPaperTradingObservation(observation, evaluation);
    observations.push(observation);
  }
  return { run, commitment, evaluation, observations };
}

async function reverseQualificationObservationTime(
  store: LocalStore,
  evidence: Awaited<ReturnType<typeof recordQualifiedPromotionEvidence>>
): Promise<Awaited<ReturnType<typeof recordQualifiedPromotionEvidence>>> {
  const observations = structuredClone(evidence.observations);
  const previous = observations[9];
  const current = observations[10];
  if (!previous || !current) {
    throw new Error("qualification fixture requires observations 10 and 11");
  }
  observations[10] = {
    ...current,
    observed_at: new Date(Date.parse(previous.observed_at) - 1_000).toISOString()
  };
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-observations",
    current.paper_trading_observation_id,
    observations[10]
  );
  return { ...evidence, observations };
}

function withPreparationDigest(
  preparation: PaperTradingComparisonPreparationRecord
): PaperTradingComparisonPreparationRecord {
  return {
    ...preparation,
    preparation_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonPreparationDigestInput(preparation))
      .digest("hex")}`
  };
}

async function storedComparisonFixture(
  store: LocalStore,
  input: {
    malformation?:
      | "provider-ineligible"
      | "window-policy-mismatch"
      | "duplicate-resolved-artifact"
      | "evaluation-outcome-state"
      | "replacement-evaluation-id"
      | "side-time-before-preparation"
      | "run-time-before-preparation";
  } = {}
) {
  const preparationFixture = await comparisonPreparationFixture(store);
  const {
    champion,
    challenger,
    preparation,
    promotion,
    championPromotionEvidence,
    challengerMaterializationInput
  } = preparationFixture;
  await store.reservePaperTradingComparisonPreparation(preparation);
  const championRun = await store.createPaperTradingRun({
    idempotency_key: "paper-comparison-store:champion",
    candidate_id: champion.candidate_id,
    candidate_version_id: champion.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: "2026-07-10T00:00:00.000Z"
  });
  const challengerRun = await store.createPaperTradingRun({
    idempotency_key: "paper-comparison-store:challenger",
    candidate_id: challenger.candidate_id,
    candidate_version_id: challenger.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: "2026-07-10T00:00:00.000Z"
  });
  if (input.malformation === "run-time-before-preparation") {
    await overwriteComparisonFixtureRecord(store, "trading-runs", challengerRun.trading_run_id, {
      ...challengerRun,
      created_at: "2026-07-09T23:59:59.999Z"
    });
  }
  const championCommitment = qualificationCommitment(
    champion,
    championRun,
    (await store.getSystemCode(championRun.system_code_ref!.id))!,
    "paper-commitment-comparison-champion",
    preparation.committed_at
  );
  let challengerCommitment = qualificationCommitment(
    challenger,
    challengerRun,
    (await store.getSystemCode(challengerRun.system_code_ref!.id))!,
    "paper-commitment-comparison-challenger",
    preparation.committed_at
  );
  if (input.malformation === "provider-ineligible") {
    challengerCommitment = withPaperTradingCommitmentDigest({
      ...challengerCommitment,
      provider_identity: {
        runtime_provider_kind: "managed_agent",
        agent_profile_ref: {
          record_kind: "agent_profile",
          id: "codex"
        },
        model: "gpt-5-codex",
        provider_configuration_digest: "sha256:well-shaped-ineligible-provider",
        qualification_eligible: false,
        ineligibility_reason: "provider_identity_unavailable"
      },
      commitment_digest: ""
    });
  }
  if (input.malformation === "window-policy-mismatch") {
    challengerCommitment = withPaperTradingCommitmentDigest({
      ...challengerCommitment,
      window_policy: {
        ...challengerCommitment.window_policy,
        eligibility_policy_version: "paper-evidence-eligibility-v2"
      },
      commitment_digest: ""
    });
  }
  if (input.malformation === "duplicate-resolved-artifact") {
    challengerCommitment = withPaperTradingCommitmentDigest({
      ...challengerCommitment,
      resolved_artifact_digest: championCommitment.resolved_artifact_digest,
      commitment_digest: ""
    });
  }
  if (input.malformation === "side-time-before-preparation") {
    challengerCommitment = withPaperTradingCommitmentDigest({
      ...challengerCommitment,
      committed_at: "2026-07-09T23:59:59.999Z",
      commitment_digest: ""
    });
  }
  const championEvaluation: PaperTradingEvaluationRecord = {
    ...validPaperTradingEvaluation(championCommitment),
    paper_trading_evaluation_id: "paper-evaluation-comparison-champion",
    candidate_ref: { ...championCommitment.candidate_ref },
    candidate_version_ref: { ...championCommitment.candidate_version_ref },
    trading_run_ref: { ...championCommitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: championCommitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    observation_count: 0,
    latest_score: {
      revenue_usdt: 0,
      cost_usdt: 0,
      net_revenue_usdt: 0,
      net_return_pct: 0
    },
    paper_account_snapshot: structuredClone(championCommitment.initial_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: []
  };
  let challengerEvaluation: PaperTradingEvaluationRecord = {
    ...validPaperTradingEvaluation(challengerCommitment),
    paper_trading_evaluation_id: "paper-evaluation-comparison-challenger",
    candidate_ref: { ...challengerCommitment.candidate_ref },
    candidate_version_ref: { ...challengerCommitment.candidate_version_ref },
    trading_run_ref: { ...challengerCommitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: challengerCommitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    observation_count: 0,
    latest_score: {
      revenue_usdt: 0,
      cost_usdt: 0,
      net_revenue_usdt: 0,
      net_return_pct: 0
    },
    paper_account_snapshot: structuredClone(challengerCommitment.initial_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: []
  };
  await store.recordPaperTradingEvaluationCommitment(championCommitment);
  await store.recordPaperTradingEvaluation(championEvaluation);
  await store.recordPaperTradingEvaluationCommitment(challengerCommitment);
  await store.recordPaperTradingEvaluation(challengerEvaluation);
  if (input.malformation === "evaluation-outcome-state") {
    challengerEvaluation = {
      ...challengerEvaluation,
      latest_score: {
        revenue_usdt: 1,
        cost_usdt: 0,
        net_revenue_usdt: 1,
        net_return_pct: 0.0001
      },
      next_observation_at: "2026-07-10T00:01:00.000Z"
    };
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      challengerEvaluation.paper_trading_evaluation_id,
      challengerEvaluation
    );
  }
  if (input.malformation === "replacement-evaluation-id") {
    await store.recordPaperTradingEvaluation({
      ...challengerEvaluation,
      paper_trading_evaluation_id: "paper-evaluation-comparison-challenger-replacement"
    });
  }

  const comparison = withComparisonDigest({
    ...validPaperTradingComparisonCommitment(),
    paper_trading_comparison_commitment_id:
      preparation.paper_trading_comparison_commitment_id,
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: preparation.paper_trading_comparison_preparation_id
    },
    champion: comparisonSide(preparation.champion, championCommitment, championEvaluation),
    challenger: comparisonSide(preparation.challenger, challengerCommitment, challengerEvaluation),
    champion_selection: structuredClone(preparation.champion_selection),
    comparison_policy: structuredClone(preparation.comparison_policy),
    market_data_configuration_digest: preparation.market_data_configuration_digest,
    paper_policy_identity: structuredClone(preparation.paper_policy_identity),
    committed_at: preparation.committed_at,
    commitment_digest: ""
  });
  return {
    champion,
    challenger,
    championRun,
    challengerRun,
    championCommitment,
    challengerCommitment,
    championEvaluation,
    challengerEvaluation,
    preparation,
    promotion,
    championPromotionEvidence,
    challengerMaterializationInput,
    comparison
  };
}
```

Define the remaining helpers in the same file with exact field mapping:

```ts
function qualificationCommitment(
  candidate: CandidateInspectReadModel,
  run: TradingRunRecord,
  systemCode: SystemCodeRecord,
  id: string,
  committedAt: string
): PaperTradingEvaluationCommitmentRecord {
  const base = validPaperTradingCommitment();
  return withPaperTradingCommitmentDigest({
    ...base,
    paper_trading_evaluation_commitment_id: id,
    evidence_purpose: "qualification",
    candidate_ref: { record_kind: "trading_system_candidate", id: candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: candidate.candidate_version.candidate_version_id
    },
    trading_run_ref: { record_kind: "trading_run", id: run.trading_run_id },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    system_code_artifact_digest: systemCode.artifact_digest,
    resolved_artifact_digest: `sha256:resolved-${systemCode.system_code_id}`,
    runtime_identity: {
      artifact_kind: systemCode.artifact_kind,
      runtime_kind: systemCode.runtime_kind,
      entrypoint: [...systemCode.entrypoint],
      ...(systemCode.artifact_runtime_contract_ref
        ? { artifact_runtime_contract_ref: { ...systemCode.artifact_runtime_contract_ref } }
        : {})
    },
    capability_policy_ref: { ...systemCode.capability_policy_ref },
    secret_policy_ref: { ...systemCode.secret_policy_ref },
    window_policy: {
      ...base.window_policy,
      release_policy: "sealed_until_adjudication"
    },
    committed_at: committedAt,
    commitment_digest: ""
  });
}

function comparisonSide(
  frozen: PaperTradingComparisonCandidateSide,
  commitment: PaperTradingEvaluationCommitmentRecord,
  evaluation: PaperTradingEvaluationRecord
): PaperTradingComparisonSide {
  return {
    ...structuredClone(frozen),
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    paper_trading_evaluation_commitment_digest: commitment.commitment_digest,
    paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
    ),
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: evaluation.paper_trading_evaluation_id
    },
    paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonEvaluationRecordDigestInput(evaluation)
    )
  };
}

type BoundSideWriterKind = (typeof postPairWriterCases)[number][1];

async function invokeBoundSideWriter(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>,
  writer: BoundSideWriterKind
): Promise<unknown> {
  if (writer === "create-run-exact") {
    return store.createPaperTradingRun({
      idempotency_key: "paper-comparison-store:challenger",
      candidate_id: fixture.challenger.candidate_id,
      candidate_version_id: fixture.challenger.candidate_version.candidate_version_id,
      evidence_purpose: "qualification",
      created_at: fixture.preparation.committed_at
    });
  }
  if (writer === "commitment-exact") {
    return store.recordPaperTradingEvaluationCommitment(fixture.challengerCommitment);
  }
  if (writer === "evaluation-exact") {
    return store.recordPaperTradingEvaluation(fixture.challengerEvaluation);
  }
  if (writer === "evaluation") {
    return store.recordPaperTradingEvaluation({
      ...fixture.challengerEvaluation,
      latest_failure_reason: "post-pair-mutation"
    });
  }
  if (writer === "alternate-commitment" ||
    writer === "alternate-commitment-evaluation-chain") {
    const commitment = alternateSideCommitment(fixture);
    await store.recordPaperTradingEvaluationCommitment(commitment);
    if (writer === "alternate-commitment") {
      return commitment;
    }
    return store.recordPaperTradingEvaluation({
      ...fixture.challengerEvaluation,
      paper_trading_evaluation_id: "paper-evaluation-comparison-challenger-alternate-chain",
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: commitment.paper_trading_evaluation_commitment_id
      }
    });
  }
  if (writer === "observation") {
    const observedAt = "2026-07-10T00:01:00.000Z";
    const observation = {
      ...validPaperTradingObservation(
        fixture.challengerCommitment,
        fixture.challengerEvaluation
      ),
      paper_trading_observation_id: "paper-observation-post-pair-mutation",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation" as const,
        id: fixture.challengerEvaluation.paper_trading_evaluation_id
      },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment" as const,
        id: fixture.challengerCommitment.paper_trading_evaluation_commitment_id
      },
      candidate_ref: { ...fixture.challengerCommitment.candidate_ref },
      candidate_version_ref: { ...fixture.challengerCommitment.candidate_version_ref },
      trading_run_ref: { ...fixture.challengerCommitment.trading_run_ref },
      sequence: 1,
      observed_at: observedAt
    };
    return store.recordPaperTradingObservation(observation, {
      ...fixture.challengerEvaluation,
      status: "running",
      observation_count: 1,
      last_observed_at: observedAt,
      next_observation_at: "2026-07-10T00:02:00.000Z"
    });
  }
  if (writer === "ledger") {
    return store.recordLedger({
      ...validLedgerInput(fixture.challenger.candidate_version.candidate_version_id),
      idempotency_key: "post-pair-ledger",
      candidate_id: fixture.challenger.candidate_id,
      candidate_version_id: fixture.challenger.candidate_version.candidate_version_id,
      runtime_id: fixture.challengerRun.trading_run_id
    });
  }
  if (writer === "run-control") {
    return store.recordRunControlAudit({
      ...validRunControlAuditInput(
        fixture.challenger.candidate_version.candidate_version_id
      ),
      idempotency_key: "post-pair-run-control",
      candidate_id: fixture.challenger.candidate_id,
      candidate_version_id: fixture.challenger.candidate_version.candidate_version_id,
      runtime_id: fixture.challengerRun.trading_run_id
    });
  }
  const sandbox = boundSideSandboxInput(fixture);
  if (writer === "sandbox-start") {
    return store.recordSandboxStart(sandbox);
  }
  if (writer === "sandbox-observations") {
    return store.recordSandboxObservations(sandbox.instance.sandbox_id, {
      lifecycle_status: "running",
      logs: [],
      heartbeats: [],
      command_evidence: []
    });
  }
  return store.stopSandbox(
    { sandbox_id: sandbox.instance.sandbox_id, stopped_at: "2026-07-10T00:02:00.000Z" },
    {}
  );
}

function alternateSideCommitment(
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>
): PaperTradingEvaluationCommitmentRecord {
  return withPaperTradingCommitmentDigest({
    ...fixture.challengerCommitment,
    paper_trading_evaluation_commitment_id:
      "paper-commitment-comparison-challenger-alternate-chain",
    commitment_digest: ""
  });
}

function boundSideSandboxInput(
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>
): SandboxObservationInput {
  return {
    instance: {
      record_kind: "sandbox",
      version: 1,
      sandbox_id: "sandbox-post-pair-writer",
      adapter_kind: "deterministic_test",
      system_code_ref: { ...fixture.challengerRun.system_code_ref! },
      runtime_ref: {
        record_kind: "trading_run",
        id: fixture.challengerRun.trading_run_id
      },
      sandbox_placement_ref: { ...fixture.challengerRun.placement_ref },
      lifecycle_status: "running",
      sandbox_name: "paper-comparison-post-pair-writer",
      created_at: "2026-07-10T00:01:00.000Z",
      started_at: "2026-07-10T00:01:00.000Z",
      log_refs: [],
      heartbeat_refs: [],
      command_evidence_refs: [],
      authority_status: "not_live"
    }
  };
}

async function seedBoundSandboxForWriterTest(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>
): Promise<void> {
  const sandbox = boundSideSandboxInput(fixture).instance;
  await overwriteComparisonFixtureRecord(
    store,
    "sandboxes",
    sandbox.sandbox_id,
    sandbox
  );
}

async function boundComparisonEvidenceSnapshot(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>
): Promise<unknown> {
  const collections = [
    "order-requests", "gateway-results", "execution-results", "run-control-commands",
    "run-control-decisions", "runtime-audit-events", "sandboxes", "sandbox-logs",
    "runtime-heartbeats", "sandbox-command-evidence"
  ];
  return {
    run: await store.getTradingRun(fixture.challengerRun.trading_run_id),
    commitment: await store.getPaperTradingEvaluationCommitment(
      fixture.challengerCommitment.paper_trading_evaluation_commitment_id
    ),
    evaluation: await store.getPaperTradingEvaluation(
      fixture.challengerEvaluation.paper_trading_evaluation_id
    ),
    observations: await store.listPaperTradingObservations(
      fixture.challengerEvaluation.paper_trading_evaluation_id
    ),
    allCommitments: await store.listPaperTradingEvaluationCommitments(),
    allEvaluations: await store.listPaperTradingEvaluations(),
    files: Object.fromEntries(await Promise.all(collections.map(async (collection) => [
      collection,
      await readdir(path.join(store.root(), collection, "items")).catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return [];
        }
        throw error;
      })
    ])))
  };
}

async function comparisonGraphByteSnapshot(
  store: LocalStore
): Promise<Record<string, Array<{ file: string; bytes: string }>>> {
  const collections = [
    "trading-promotions",
    "paper-trading-comparison-preparations",
    "paper-trading-comparison-commitments",
    "trading-runs",
    "paper-trading-evaluation-commitments",
    "paper-trading-evaluations",
    "paper-trading-observations"
  ];
  return Object.fromEntries(await Promise.all(collections.map(async (collection) => {
    const itemDir = path.join(store.root(), collection, "items");
    const files = (await readdir(itemDir).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    })).sort();
    return [collection, await Promise.all(files.map(async (file) => ({
      file,
      bytes: await readFile(path.join(itemDir, file), "utf8")
    })))] as const;
  })));
}

type PromotionEvidenceFixture = {
  championPromotionEvidence: Awaited<ReturnType<typeof recordQualifiedPromotionEvidence>>;
};

async function promotionEvidenceSnapshot(
  store: LocalStore,
  fixture: PromotionEvidenceFixture
): Promise<unknown> {
  const evidence = fixture.championPromotionEvidence;
  return {
    commitment: await store.getPaperTradingEvaluationCommitment(
      evidence.commitment.paper_trading_evaluation_commitment_id
    ),
    evaluation: await store.getPaperTradingEvaluation(
      evidence.evaluation.paper_trading_evaluation_id
    ),
    observations: await store.listPaperTradingObservations(
      evidence.evaluation.paper_trading_evaluation_id
    )
  };
}

async function invokeFrozenPromotionEvidenceWriter(
  store: LocalStore,
  fixture: PromotionEvidenceFixture,
  writer: "evaluation-mutation" | "observation-append"
): Promise<unknown> {
  const evidence = fixture.championPromotionEvidence;
  if (writer === "evaluation-mutation") {
    return store.recordPaperTradingEvaluation({
      ...evidence.evaluation,
      latest_failure_reason: "attempted-frozen-promotion-evaluation-mutation"
    });
  }

  const last = evidence.observations.at(-1);
  if (!last) {
    throw new Error("promotion evidence fixture has no observations");
  }
  const observedAt = new Date(Date.parse(last.observed_at) + 60_000).toISOString();
  const { market_snapshot: _marketSnapshot, ...lastWithoutMarketSnapshot } = last;
  const observation: PaperTradingObservationRecord = {
    ...lastWithoutMarketSnapshot,
    paper_trading_observation_id: `${last.paper_trading_observation_id}-append-attempt`,
    sequence: last.sequence + 1,
    observed_at: observedAt
  };
  const { stopped_at: _stoppedAt, ...evaluationWithoutStoppedAt } = evidence.evaluation;
  return store.recordPaperTradingObservation(observation, {
    ...evaluationWithoutStoppedAt,
    status: "stopped",
    observation_count: observation.sequence,
    last_observed_at: observedAt,
    stopped_at: observedAt
  });
}

function withComparisonDigest(
  comparison: PaperTradingComparisonCommitmentRecord
): PaperTradingComparisonCommitmentRecord {
  return {
    ...comparison,
    commitment_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonCommitmentDigestInput(comparison))
      .digest("hex")}`
  };
}
```

Define the complete pair fixture locally; its side fields are overwritten by
`storedComparisonFixture` before persistence:

```ts
function validPaperTradingComparisonCommitment(): PaperTradingComparisonCommitmentRecord {
  return {
    record_kind: "paper_trading_comparison_commitment",
    version: 1,
    paper_trading_comparison_commitment_id: "paper-comparison-store-001",
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: "paper-comparison-preparation-store-001"
    },
    champion: {
      role: "champion",
      candidate_ref: { record_kind: "trading_system_candidate", id: "replaced-champion" },
      candidate_version_ref: { record_kind: "candidate_version", id: "replaced-champion-version" },
      candidate_version_digest: "sha256:replaced-champion-version-record",
      system_code_ref: { record_kind: "system_code", id: "replaced-champion-code" },
      system_code_record_digest: "sha256:replaced-champion-code-record",
      system_code_artifact_digest: "sha256:replaced-champion-code-artifact",
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "replaced-champion-admission"
      },
      admission_decision_digest: "sha256:replaced-champion-admission-record",
      trading_run_ref: { record_kind: "trading_run", id: "replaced-champion-run" },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "replaced-champion-commitment"
      },
      paper_trading_evaluation_commitment_digest: "sha256:replaced-champion-commitment-content",
      paper_trading_evaluation_commitment_record_digest:
        "sha256:replaced-champion-commitment-record",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "replaced-champion-evaluation"
      },
      paper_trading_evaluation_record_digest:
        "sha256:replaced-champion-evaluation-record"
    },
    challenger: {
      role: "challenger",
      candidate_ref: { record_kind: "trading_system_candidate", id: "replaced-challenger" },
      candidate_version_ref: { record_kind: "candidate_version", id: "replaced-challenger-version" },
      candidate_version_digest: "sha256:replaced-challenger-version-record",
      system_code_ref: { record_kind: "system_code", id: "replaced-challenger-code" },
      system_code_record_digest: "sha256:replaced-challenger-code-record",
      system_code_artifact_digest: "sha256:replaced-challenger-code-artifact",
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "replaced-challenger-admission"
      },
      admission_decision_digest: "sha256:replaced-challenger-admission-record",
      trading_run_ref: { record_kind: "trading_run", id: "replaced-challenger-run" },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "replaced-challenger-commitment"
      },
      paper_trading_evaluation_commitment_digest:
        "sha256:replaced-challenger-commitment-content",
      paper_trading_evaluation_commitment_record_digest:
        "sha256:replaced-challenger-commitment-record",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "replaced-challenger-evaluation"
      },
      paper_trading_evaluation_record_digest:
        "sha256:replaced-challenger-evaluation-record"
    },
    champion_selection: {
      selection_kind: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: "replaced-trading-promotion"
      },
      trading_promotion_digest: "sha256:replaced-trading-promotion-record",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "replaced-promotion-evaluation"
      },
      paper_trading_evaluation_record_digest:
        "sha256:replaced-promotion-evaluation-record",
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "replaced-promotion-commitment"
      },
      paper_trading_evaluation_commitment_record_digest:
        "sha256:replaced-promotion-commitment-record",
      paper_trading_observation_chain_digest:
        "sha256:replaced-promotion-observation-chain"
    },
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge",
      symbol: "BTCUSDT",
      interval_ms: 60_000,
      minimum_observation_count: 30,
      minimum_elapsed_ms: 1_800_000,
      maximum_observation_count: 120,
      maximum_elapsed_ms: 7_200_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 500,
      maximum_retry_count_per_side: 3,
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 10,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true,
      require_both_qualified: true,
      release_policy: "sealed_until_adjudication"
    },
    market_data_configuration_digest: "sha256:market-data-configuration",
    paper_policy_identity: {
      market_data_policy_version: "binance-public-market-v1",
      gateway_policy_version: "paper-gateway-dry-run-v1",
      cost_policy_version: "paper-cost-8bps-v1",
      funding_policy_version: "paper-funding-engine-v1",
      slippage_policy_version: "paper-public-fill-slippage-v1",
      fill_policy_version: "paper-public-execution-fill-v1",
      risk_policy_version: "paper-risk-validation-v1",
      paper_account_policy_version: "fake-paper-account-10000usdt-v1",
      decision_event_protocol_version: "trading-system-paper-events-v1",
      persistent_state_boundary_version: "paper-engine-checkpoint-v1"
    },
    committed_at: "2026-07-10T00:00:00.000Z",
    commitment_digest: "",
    authority_status: "not_live"
  };
}
```

Add a preparation test whose two candidate sides use the same CandidateVersion; it must reject with
`invalid_paper_trading_comparison_preparation_input` before the preparation file exists. Separately,
`comparisonPreparationFixture(store, { duplicateChallengerSystemCode: true })` must reject before
the preparation write with `paper_trading_comparison_duplicate_executable`, while
`storedComparisonFixture(store, { malformation: "duplicate-resolved-artifact" })` must reach pair
validation and reject with `paper_trading_comparison_commitment_reference_mismatch`. Add a crafted
pair whose champion side references the exact champion `CandidateVersionRecord.runtime_ref`; it
must reject with the same code even when all other fields are valid.

- [ ] **Step 2: Add exact admission, promotion, preparation, and pair port signatures**

Import `CandidateVersionRecord`, `PaperTradingComparisonPreparationRecord`, and
`PaperTradingComparisonCommitmentRecord` into
`packages/application/src/ports/store.ts` and add:

```ts
getCandidateAdmissionDecision(
  decisionId: string
): Promise<CandidateAdmissionDecisionRecord | undefined>;
getCandidateVersion(
  candidateVersionId: string
): Promise<CandidateVersionRecord | undefined>;
getTradingPromotion(promotionId: string): Promise<TradingPromotionRecord | undefined>;
getPaperTradingEvaluation(
  evaluationId: string
): Promise<PaperTradingEvaluationRecord | undefined>;
reservePaperTradingComparisonPreparation(
  preparation: PaperTradingComparisonPreparationRecord
): Promise<PaperTradingComparisonPreparationRecord>;
getPaperTradingComparisonPreparation(
  preparationId: string
): Promise<PaperTradingComparisonPreparationRecord | undefined>;
listPaperTradingComparisonPreparations(): Promise<PaperTradingComparisonPreparationRecord[]>;
recordPaperTradingComparisonCommitment(
  commitment: PaperTradingComparisonCommitmentRecord
): Promise<PaperTradingComparisonCommitmentRecord>;
getPaperTradingComparisonCommitment(
  comparisonId: string
): Promise<PaperTradingComparisonCommitmentRecord | undefined>;
listPaperTradingComparisonCommitments(): Promise<PaperTradingComparisonCommitmentRecord[]>;
```

`LocalStore.getPaperTradingEvaluation(evaluationId)` already performs the required exact collection
read; keep that implementation unchanged and make it part of `OuroborosStorePort` so coordinator
reload cannot fall back to a latest-evaluation query.

Run: `npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison"`

Expected: FAIL because `LocalStore` does not implement the exact admission/promotion getters or the
preparation and pair methods/collections.

- [ ] **Step 3: Add collections and stable LocalStore error codes**

Add `"paper-trading-comparison-preparations"` and
`"paper-trading-comparison-commitments"` to `Collection`, then add these codes to
`LocalStoreErrorCode`:

```ts
| "invalid_paper_trading_comparison_preparation_input"
| "paper_trading_comparison_preparation_digest_mismatch"
| "paper_trading_comparison_preparation_conflict"
| "paper_trading_comparison_preparation_reference_not_found"
| "paper_trading_comparison_frozen_record_digest_mismatch"
| "paper_trading_comparison_candidate_not_admitted"
| "paper_trading_comparison_duplicate_executable"
| "paper_trading_comparison_champion_selection_mismatch"
| "paper_trading_comparison_preparation_mismatch"
| "invalid_paper_trading_comparison_commitment_input"
| "paper_trading_comparison_commitment_digest_mismatch"
| "paper_trading_comparison_commitment_conflict"
| "paper_trading_comparison_commitment_reference_not_found"
| "paper_trading_comparison_commitment_reference_mismatch"
| "paper_trading_comparison_active_pair_conflict"
| "paper_trading_comparison_frozen_authority_write_conflict"
| "paper_trading_comparison_inert_graph_mutation_forbidden"
| "authority_evidence_identity_conflict"
```

- [ ] **Step 4: Implement one comparison-evidence transaction and atomic preparation reservation**

Import `paperTradingComparisonCandidateVersionDigestInput`,
`paperTradingComparisonSystemCodeRecordDigestInput`,
`paperTradingComparisonAdmissionDecisionDigestInput`, and
`paperTradingComparisonTradingPromotionDigestInput`; the two side full-record digest helpers; the
ordered observation-chain digest helper; `paperTradingComparisonTradingPromotionHasRuntimeShape`;
`paperTradingComparisonRefsEqual`; and `paperTradingComparisonSideRecordsHaveInertShape` from
`@ouroboros/domain`. Also import `decidePaperTradingQualification` and
`paperTradingEvaluationCommitmentDigestInput`; LocalStore supplies its own SHA-256 digest result
to the domain decision and does not import application qualification code. Add exact getters for
admission and promotion records, then reserve preparation only after shape, digest,
candidate/version, admission, selection, and unordered-pair validation. The compare/read/currentness
checks and append execute under the same adapter transaction as every mutable authority-evidence
writer:

```ts
private comparisonEvidenceWriteQueue: Promise<void> = Promise.resolve();

private withComparisonEvidenceWriteTransaction<T>(task: () => Promise<T>): Promise<T> {
  const queued = this.comparisonEvidenceWriteQueue.then(task);
  this.comparisonEvidenceWriteQueue = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
}

private async assertFrozenAuthorityWriteAllowed(input:
  | { recordKind: "candidate_version"; id: string; digest: string }
  | { recordKind: "system_code"; id: string; digest: string }
  | { recordKind: "candidate_admission_decision"; id: string; digest: string }
  | { recordKind: "trading_promotion"; id: string; digest: string }
): Promise<void> {
  for (const preparation of await this.listPaperTradingComparisonPreparations()) {
    const expected = this.frozenComparisonAuthorityDigest(
      preparation,
      input.recordKind,
      input.id
    );
    if (expected !== undefined && expected !== input.digest) {
      throw new LocalStoreError(
        "paper_trading_comparison_frozen_authority_write_conflict",
        `active paper comparison preparation freezes ${input.recordKind}:${input.id}`
      );
    }
  }
}

private frozenComparisonAuthorityDigest(
  preparation: PaperTradingComparisonPreparationRecord,
  recordKind: "candidate_version" | "system_code" |
    "candidate_admission_decision" | "trading_promotion",
  id: string
): string | undefined {
  for (const side of [preparation.champion, preparation.challenger]) {
    if (recordKind === "candidate_version" &&
      side.candidate_version_ref.record_kind === recordKind &&
      side.candidate_version_ref.id === id) {
      return side.candidate_version_digest;
    }
    if (recordKind === "system_code" && side.system_code_ref.record_kind === recordKind &&
      side.system_code_ref.id === id) {
      return side.system_code_record_digest;
    }
    if (recordKind === "candidate_admission_decision" &&
      side.candidate_admission_decision_ref.record_kind === recordKind &&
      side.candidate_admission_decision_ref.id === id) {
      return side.admission_decision_digest;
    }
  }
  const selection = preparation.champion_selection;
  return recordKind === "trading_promotion" && selection.selection_kind === "trading_review" &&
    selection.trading_promotion_ref.record_kind === recordKind &&
    selection.trading_promotion_ref.id === id
    ? selection.trading_promotion_digest
    : undefined;
}

async getCandidateAdmissionDecision(
  decisionId: string
): Promise<CandidateAdmissionDecisionRecord | undefined> {
  return this.readOptionalRecord<CandidateAdmissionDecisionRecord>(
    "candidate-admission-decisions",
    decisionId
  );
}

async getCandidateVersion(
  candidateVersionId: string
): Promise<CandidateVersionRecord | undefined> {
  return this.readOptionalRecord<CandidateVersionRecord>(
    "candidate-versions",
    candidateVersionId
  );
}

async getTradingPromotion(promotionId: string): Promise<TradingPromotionRecord | undefined> {
  return this.readOptionalRecord<TradingPromotionRecord>("trading-promotions", promotionId);
}

async reservePaperTradingComparisonPreparation(
  preparation: PaperTradingComparisonPreparationRecord
): Promise<PaperTradingComparisonPreparationRecord> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.reservePaperTradingComparisonPreparationUnlocked(preparation)
  );
}

private async reservePaperTradingComparisonPreparationUnlocked(
  preparation: PaperTradingComparisonPreparationRecord
): Promise<PaperTradingComparisonPreparationRecord> {
  if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
    throw new LocalStoreError(
      "invalid_paper_trading_comparison_preparation_input",
      "invalid paper trading comparison preparation input"
    );
  }
  const expectedDigest = `sha256:${createHash("sha256")
    .update(paperTradingComparisonPreparationDigestInput(preparation))
    .digest("hex")}`;
  if (preparation.preparation_digest !== expectedDigest) {
    throw new LocalStoreError(
      "paper_trading_comparison_preparation_digest_mismatch",
      "paper trading comparison preparation digest does not match canonical content"
    );
  }
  const existing = await this.getPaperTradingComparisonPreparation(
    preparation.paper_trading_comparison_preparation_id
  );
  if (existing) {
    if (!sameJson(existing, preparation)) {
      throw new LocalStoreError(
        "paper_trading_comparison_preparation_conflict",
        "paper trading comparison preparation is append-only"
      );
    }
    await this.validatePaperTradingComparisonPreparation(existing, false);
    return existing;
  }

  await this.validatePaperTradingComparisonPreparation(preparation, true);
  const pairKey = paperTradingComparisonCandidateVersionPairKey(
    preparation.champion.candidate_version_ref.id,
    preparation.challenger.candidate_version_ref.id
  );
  const activeConflict = (await this.listPaperTradingComparisonPreparations()).find((record) =>
    paperTradingComparisonCandidateVersionPairKey(
      record.champion.candidate_version_ref.id,
      record.challenger.candidate_version_ref.id
    ) === pairKey
  );
  if (activeConflict) {
    throw new LocalStoreError(
      "paper_trading_comparison_active_pair_conflict",
      "an active preparation already owns this unordered candidate-version pair"
    );
  }
  await this.writeJson(
    this.itemPath(
      "paper-trading-comparison-preparations",
      preparation.paper_trading_comparison_preparation_id
    ),
    preparation
  );
  return preparation;
}

async getPaperTradingComparisonPreparation(
  preparationId: string
): Promise<PaperTradingComparisonPreparationRecord | undefined> {
  return this.readOptionalRecord<PaperTradingComparisonPreparationRecord>(
    "paper-trading-comparison-preparations",
    preparationId
  );
}

async listPaperTradingComparisonPreparations(): Promise<PaperTradingComparisonPreparationRecord[]> {
  return (await this.readCollection<PaperTradingComparisonPreparationRecord>(
    "paper-trading-comparison-preparations"
  )).sort((left, right) =>
    left.committed_at.localeCompare(right.committed_at) ||
    left.paper_trading_comparison_preparation_id.localeCompare(
      right.paper_trading_comparison_preparation_id
    )
  );
}
```

Refactor every production authority-evidence writer into a public queued wrapper and a private
unlocked implementation. Private implementations never call a queued wrapper, which avoids nested
queue deadlock. The existing validation bodies stay in their private methods; before their first
write they call `assertExactAuthorityIdentity` for every CandidateVersion, SystemCode, or admission
they will persist. Promotion keeps its existing generic write semantics and uses only the active
frozen-authority check described below:

```ts
async recordSystemCode(systemCode: SystemCodeRecord): Promise<SystemCodeRecord> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordSystemCodeUnlocked(systemCode)
  );
}

async recordCandidateAdmissionDecision(
  decision: CandidateAdmissionDecisionRecord
): Promise<CandidateAdmissionDecisionRecord> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordCandidateAdmissionDecisionUnlocked(decision)
  );
}

async recordTradingPromotion(
  promotion: TradingPromotionRecord
): Promise<TradingPromotionRecord> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordTradingPromotionUnlocked(promotion)
  );
}

async materializeCandidate(
  input: CandidateMaterializationInput
): Promise<CandidateMaterializationOutcome> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.materializeCandidateUnlocked(input)
  );
}

async materializeImprovementProposal(
  input: ImprovementProposalMaterializationInput
): Promise<ImprovementProposalMaterializationOutcome> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.materializeImprovementProposalUnlocked(input)
  );
}

async createPaperTradingRun(input: {
  idempotency_key: string;
  candidate_id: string;
  candidate_version_id: string;
  evidence_purpose: PaperTradingEvidencePurpose;
  created_at?: string;
}): Promise<TradingRunRecord> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.createPaperTradingRunUnlocked(input)
  );
}

async recordPaperTradingEvaluationCommitment(
  commitment: PaperTradingEvaluationCommitmentRecord
): Promise<PaperTradingEvaluationCommitmentRecord> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordPaperTradingEvaluationCommitmentUnlocked(commitment)
  );
}

async recordPaperTradingEvaluation(
  evaluation: PaperTradingEvaluationRecord
): Promise<PaperTradingEvaluationRecord> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordPaperTradingEvaluationUnlocked(evaluation)
  );
}

async recordPaperTradingObservation(
  observation: PaperTradingObservationRecord,
  evaluation: PaperTradingEvaluationRecord
): Promise<PaperTradingObservationRecord> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordPaperTradingObservationUnlocked(observation, evaluation)
  );
}

async recordLedger(input: LedgerInput): Promise<LedgerWriteOutcome> {
  return this.withComparisonEvidenceWriteTransaction(() => this.recordLedgerUnlocked(input));
}

async recordRunControlAudit(input: RunControlAuditInput): Promise<RunControlAuditOutcome> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordRunControlAuditUnlocked(input)
  );
}

private async assertNoPairBoundSideMutation(input: {
  runId?: string;
  commitmentId?: string;
  evaluationId?: string;
}): Promise<void> {
  const freezesPromotionEvidence = (await this.listPaperTradingComparisonPreparations())
    .some((preparation) => {
      const selection = preparation.champion_selection;
      return selection.selection_kind === "trading_review" && (
        (input.commitmentId !== undefined && paperTradingComparisonRefsEqual(
          selection.paper_trading_evaluation_commitment_ref,
          { record_kind: "paper_trading_evaluation_commitment", id: input.commitmentId }
        )) ||
        (input.evaluationId !== undefined && paperTradingComparisonRefsEqual(
          selection.paper_trading_evaluation_ref,
          { record_kind: "paper_trading_evaluation", id: input.evaluationId }
        ))
      );
    });
  if (freezesPromotionEvidence) {
    throw new LocalStoreError(
      "paper_trading_comparison_frozen_authority_write_conflict",
      "active paper comparison preparation freezes champion promotion evidence"
    );
  }
  const bound = (await this.listPaperTradingComparisonCommitments()).some((pair) =>
    [pair.champion, pair.challenger].some((side) =>
      (input.runId !== undefined && paperTradingComparisonRefsEqual(
        side.trading_run_ref,
        { record_kind: "trading_run", id: input.runId }
      )) ||
      (input.commitmentId !== undefined &&
        paperTradingComparisonRefsEqual(
          side.paper_trading_evaluation_commitment_ref,
          { record_kind: "paper_trading_evaluation_commitment", id: input.commitmentId }
        )) ||
      (input.evaluationId !== undefined &&
        paperTradingComparisonRefsEqual(
          side.paper_trading_evaluation_ref,
          { record_kind: "paper_trading_evaluation", id: input.evaluationId }
        ))
    )
  );
  if (bound) {
    throw new LocalStoreError(
      "paper_trading_comparison_inert_graph_mutation_forbidden",
      "persisted paper comparison side graph is inert until a later authority lifecycle exists"
    );
  }
}

private async assertPaperTradingCommitmentWriteDoesNotMutateBoundGraph(
  commitment: PaperTradingEvaluationCommitmentRecord
): Promise<void> {
  await this.assertNoPairBoundSideMutation({
    runId: commitment.trading_run_ref.id,
    commitmentId: commitment.paper_trading_evaluation_commitment_id
  });
}

private async assertExactAuthorityIdentity<T extends FixtureRecord>(input: {
  collection: "candidate-versions" | "system-codes" |
    "candidate-admission-decisions";
  id: string;
  recordKind: "candidate_version" | "system_code" |
    "candidate_admission_decision";
  next: T;
  digestInput: (record: T) => string;
}): Promise<"append" | "exact_replay"> {
  const digest = comparisonExactRecordDigest(input.digestInput(input.next));
  const existing = await this.readOptionalRecord<T>(input.collection, input.id);
  if (existing && !sameJson(existing, input.next)) {
    await this.assertFrozenAuthorityWriteAllowed({
      recordKind: input.recordKind,
      id: input.id,
      digest
    });
    throw new LocalStoreError(
      "authority_evidence_identity_conflict",
      `${input.recordKind}:${input.id} is immutable under its deterministic identity`
    );
  }
  await this.assertFrozenAuthorityWriteAllowed({
    recordKind: input.recordKind,
    id: input.id,
    digest
  });
  return existing ? "exact_replay" : "append";
}
```

Apply the same public-wrapper/private-unlocked split to the sandbox paths that can update a
`TradingRunRecord` through `writeSandboxObservations`. Keep LocalStore's existing exported
`SandboxObservationInput` in `packages/local-store/src/index.ts`; do not import
`@ouroboros/application` or add a package dependency. Preserve these exact LocalStore signatures
and defaults (the application StorePort remains structurally assignable with its existing adapter
result types):

```ts
async recordSandboxStart(input: SandboxObservationInput): Promise<StartSandboxOutcome> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordSandboxStartUnlocked(input)
  );
}

async recordSandboxObservations(
  sandboxId: string,
  observations: Omit<SandboxObservationInput, "instance"> & {
    lifecycle_status?: SandboxRecord["lifecycle_status"];
    last_heartbeat_at?: string;
  }
): Promise<SandboxLogsOutcome> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordSandboxObservationsUnlocked(sandboxId, observations)
  );
}

async stopSandbox(
  input: StopSandboxInput,
  observations: Omit<SandboxObservationInput, "instance"> = {}
): Promise<StartSandboxOutcome> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.stopSandboxUnlocked(input, observations)
  );
}
```

Each unlocked side writer resolves its exact run/commitment/evaluation identity and calls
`assertNoPairBoundSideMutation` before its first write. `recordLedgerUnlocked` and
`recordRunControlAuditUnlocked` call it after resolving `runtime_id`; sandbox unlocked methods call
it after resolving `SandboxRecord.runtime_ref`; observation writes pass all three exact IDs. A side
writer that wins the queue before pair validation is visible to that validation, while a writer
queued after a successful pair append sees the bound pair and rejects. No unlocked method calls a
public queued writer.

`recordPaperTradingEvaluationCommitmentUnlocked` keeps its current exact-existing return and all
current digest/reference checks, then calls
`assertPaperTradingCommitmentWriteDoesNotMutateBoundGraph(commitment)` immediately before its
existing `writeJson`. Passing `commitment.trading_run_ref.id` is mandatory: a different commitment
ID for a pair-bound run is a run mutation and cannot bypass the guard.

The same guard first scans active preparations: once a `trading_review` selection is reserved, any
non-noop write to its exact qualification commitment, evaluation, or observation chain fails with
`paper_trading_comparison_frozen_authority_write_conflict`, even before the pair exists. This keeps
the newly frozen promotion-evidence closure stable across partial side preparation.

Preserve each method's existing deterministic no-op path before the mutation guard: an exact
`createPaperTradingRun`, commitment, evaluation, Ledger, or run-control replay may return its
already-persisted records without writing. Any branch that would append or replace a bound run,
commitment, evaluation, observation, Ledger/run-control record, sandbox record, or run field must
call the guard while still holding the transaction. Sandbox start/observe/stop are treated as
writes because their current implementations rebuild projections and may rewrite the bound run.

`recordSystemCodeUnlocked` uses `paperTradingComparisonSystemCodeRecordDigestInput` in this helper;
`recordCandidateAdmissionDecisionUnlocked` uses its matching canonical helper.
`recordTradingPromotionUnlocked` preserves its current generic write behavior and package boundary:
it does not become globally append-only and imports no application type. Immediately before its
existing `writeJson`, it calls `assertFrozenAuthorityWriteAllowed` with the full promotion digest;
therefore an unbound promotion keeps current semantics, while a promotion already frozen by an
active preparation cannot drift. `materializeCandidateUnlocked` computes its complete `CandidateVersionRecord`,
calls the helper with `paperTradingComparisonCandidateVersionDigestInput`, and performs no record
write until that check succeeds. Its existing idempotency-key replay remains deterministic, and a
same CandidateVersion ID with different runtime, capability, or provenance content is rejected.
`materializeImprovementProposalUnlocked` must replace its direct
`writeJson(itemPath("system-codes", ...))` with the same exact-identity check and private
`recordSystemCodeUnlocked` path before writing the attempt/proposal/lineage batch. Thus every
production `system-codes` write, including the current direct improvement path, participates in
the reservation transaction. Initialization-only fixture seeding completes before the adapter is
returned and cannot interleave with a reservation.

The `frozenComparisonAuthorityDigest` method scans both frozen sides and the bound selection. It
returns the preparation's CandidateVersion, SystemCode, admission, or promotion digest only when
both `record_kind` and ID match; a referenced same-ID rewrite with different content therefore
fails while the preparation remains active. Exact-content replay is allowed.

Add controlled interleaving tests with a barrier-enabled `LocalStore` subclass. The barrier is
entered from `getLatestTradingPromotion` while the comparison-evidence transaction is held:

```ts
it("serializes champion currentness and preparation append against promotion writes", async () => {
  const store = new InterleavingComparisonLocalStore(tmpDir);
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  store.pauseLatestPromotionRead();

  const reservation = store.reservePaperTradingComparisonPreparation(fixture.preparation);
  await store.latestPromotionReadEntered;
  const laterPromotionWrite = store.recordTradingPromotion(laterChampionPromotion(fixture));
  await expectPromiseStillPending(laterPromotionWrite);

  store.releaseLatestPromotionRead();
  await expect(reservation).resolves.toEqual(fixture.preparation);
  await expect(laterPromotionWrite).resolves.toMatchObject({
    trading_promotion_id: "trading-promotion-after-reservation"
  });
});

it("rejects a stale selection when the promotion wins the evidence transaction", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  await store.recordTradingPromotion(laterChampionPromotion(fixture));

  await expectStoreError(
    store.reservePaperTradingComparisonPreparation(fixture.preparation),
    "paper_trading_comparison_champion_selection_mismatch"
  );
  await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
});

it("blocks same-ID SystemCode drift until reservation then rejects it", async () => {
  const store = new InterleavingComparisonLocalStore(tmpDir);
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  const code = (await store.getSystemCode(fixture.preparation.champion.system_code_ref.id))!;
  store.pauseLatestPromotionRead();

  const reservation = store.reservePaperTradingComparisonPreparation(fixture.preparation);
  await store.latestPromotionReadEntered;
  const driftWrite = store.recordSystemCode({ ...code, entrypoint: ["python3", "drift.py"] });
  await expectPromiseStillPending(driftWrite);
  store.releaseLatestPromotionRead();

  await expect(reservation).resolves.toEqual(fixture.preparation);
  await expectStoreError(
    driftWrite,
    "paper_trading_comparison_frozen_authority_write_conflict"
  );
});

it("freezes promotion evaluation content in the same reservation transaction", async () => {
  const store = new InterleavingComparisonLocalStore(tmpDir);
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  store.pauseExactEvaluationRead();

  const reservation = store.reservePaperTradingComparisonPreparation(fixture.preparation);
  await store.exactEvaluationReadEntered;
  const evidenceWrite = store.recordPaperTradingEvaluation({
    ...fixture.championPromotionEvidence.evaluation,
    latest_failure_reason: "concurrent-promotion-evidence-drift"
  });
  await expectPromiseStillPending(evidenceWrite);
  store.releaseExactEvaluationRead();

  await expect(reservation).resolves.toEqual(fixture.preparation);
  await expectStoreError(
    evidenceWrite,
    "paper_trading_comparison_frozen_authority_write_conflict"
  );
});

it("rejects same-ID SystemCode drift that reaches the evidence transaction first", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const fixture = await comparisonPreparationFixture(store);
  const code = (await store.getSystemCode(fixture.preparation.champion.system_code_ref.id))!;

  await expectStoreError(
    store.recordSystemCode({ ...code, entrypoint: ["python3", "writer-first-drift.py"] }),
    "authority_evidence_identity_conflict"
  );
  await expect(store.getSystemCode(code.system_code_id)).resolves.toEqual(code);
  await expect(store.reservePaperTradingComparisonPreparation(fixture.preparation))
    .resolves.toEqual(fixture.preparation);
});

it("routes the improvement proposal direct SystemCode write through frozen identity checks", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const improvementInput = validImprovementProposalMaterializationInput();
  const suffix = createHash("sha256")
    .update(improvementInput.idempotency_key)
    .digest("hex")
    .slice(0, 16);
  const frozenCode: SystemCodeRecord = {
    ...validProposedSystemCodeRecord(),
    system_code_id: `research-system-code-proposal-${suffix}`,
    artifact_digest: "sha256:frozen-improvement-system-code",
    entrypoint: ["python3", "frozen-improvement.py"]
  };
  const fixture = await comparisonPreparationFixture(store, {
    challengerSystemCode: frozenCode
  });
  await store.reservePaperTradingComparisonPreparation(fixture.preparation);
  const attemptsBefore = await store.listImprovementProposalMaterializationAttempts();
  const proposalsBefore = await store.listImprovementProposals();
  const lineagesBefore = await store.listArtifactLineages();

  await expectStoreError(
    store.materializeImprovementProposal(improvementInput),
    "paper_trading_comparison_frozen_authority_write_conflict"
  );
  await expect(store.listImprovementProposalMaterializationAttempts())
    .resolves.toEqual(attemptsBefore);
  await expect(store.listImprovementProposals()).resolves.toEqual(proposalsBefore);
  await expect(store.listArtifactLineages()).resolves.toEqual(lineagesBefore);
  await expect(store.getSystemCode(frozenCode.system_code_id)).resolves.toEqual(frozenCode);
});

class InterleavingComparisonLocalStore extends LocalStore {
  latestPromotionReadEntered: Promise<void> = Promise.resolve();
  exactEvaluationReadEntered: Promise<void> = Promise.resolve();
  exactRunReadEntered: Promise<void> = Promise.resolve();
  private markPromotionReadEntered: (() => void) | undefined;
  private promotionReadRelease: Promise<void> | undefined;
  private releasePromotionRead: (() => void) | undefined;
  private markEvaluationReadEntered: (() => void) | undefined;
  private evaluationReadRelease: Promise<void> | undefined;
  private releaseEvaluationRead: (() => void) | undefined;
  private markRunReadEntered: (() => void) | undefined;
  private runReadRelease: Promise<void> | undefined;
  private releaseRunRead: (() => void) | undefined;

  pauseLatestPromotionRead(): void {
    this.latestPromotionReadEntered = new Promise((resolve) => {
      this.markPromotionReadEntered = resolve;
    });
    this.promotionReadRelease = new Promise((resolve) => {
      this.releasePromotionRead = resolve;
    });
  }

  releaseLatestPromotionRead(): void {
    this.releasePromotionRead?.();
  }

  pauseExactEvaluationRead(): void {
    this.exactEvaluationReadEntered = new Promise((resolve) => {
      this.markEvaluationReadEntered = resolve;
    });
    this.evaluationReadRelease = new Promise((resolve) => {
      this.releaseEvaluationRead = resolve;
    });
  }

  releaseExactEvaluationRead(): void {
    this.releaseEvaluationRead?.();
  }

  pauseExactRunRead(): void {
    this.exactRunReadEntered = new Promise((resolve) => {
      this.markRunReadEntered = resolve;
    });
    this.runReadRelease = new Promise((resolve) => {
      this.releaseRunRead = resolve;
    });
  }

  releaseExactRunRead(): void {
    this.releaseRunRead?.();
  }

  override async getLatestTradingPromotion(): Promise<TradingPromotionRecord | undefined> {
    const result = await super.getLatestTradingPromotion();
    if (this.promotionReadRelease) {
      this.markPromotionReadEntered?.();
      await this.promotionReadRelease;
      this.promotionReadRelease = undefined;
      this.releasePromotionRead = undefined;
      this.markPromotionReadEntered = undefined;
    }
    return result;
  }

  override async getPaperTradingEvaluation(
    evaluationId: string
  ): Promise<PaperTradingEvaluationRecord | undefined> {
    const result = await super.getPaperTradingEvaluation(evaluationId);
    if (this.evaluationReadRelease) {
      this.markEvaluationReadEntered?.();
      await this.evaluationReadRelease;
      this.evaluationReadRelease = undefined;
      this.releaseEvaluationRead = undefined;
      this.markEvaluationReadEntered = undefined;
    }
    return result;
  }

  override async getTradingRun(
    tradingRunId: string
  ): Promise<TradingRunRecord | undefined> {
    const result = await super.getTradingRun(tradingRunId);
    if (this.runReadRelease) {
      this.markRunReadEntered?.();
      await this.runReadRelease;
      this.runReadRelease = undefined;
      this.releaseRunRead = undefined;
      this.markRunReadEntered = undefined;
    }
    return result;
  }
}

function laterChampionPromotion(
  fixture: Awaited<ReturnType<typeof comparisonPreparationFixture>>
): TradingPromotionRecord {
  return {
    ...fixture.promotion,
    trading_promotion_id: "trading-promotion-after-reservation",
    promoted_at: "2026-07-09T23:59:59.500Z"
  };
}

async function expectPromiseStillPending(promise: Promise<unknown>): Promise<void> {
  const state = await Promise.race([
    promise.then(() => "fulfilled", () => "rejected"),
    new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 5))
  ]);
  expect(state).toBe("pending");
}
```

The symmetric case where the conflicting SystemCode write obtains the transaction
first: it fails with `authority_evidence_identity_conflict`, the original exact record remains, and
the subsequent reservation may proceed. The direct-path test attempts a
`materializeImprovementProposal` result whose deterministic SystemCode ID is already frozen with
different bytes and requires failure before any improvement attempt/proposal/lineage write. These tests
prove that no stale champion selection or same-ID evidence drift can pass between validation and
append.

Validate exact frozen admission and champion-selection evidence before the first preparation write.
On exact replay, validate the bound immutable records but do not require the bound promotion to
remain latest; future activation may re-check currentness:

```ts
private async validatePaperTradingComparisonPreparation(
  preparation: PaperTradingComparisonPreparationRecord,
  requireCurrentSelection: boolean
): Promise<void> {
  if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
    throw new LocalStoreError(
      "invalid_paper_trading_comparison_preparation_input",
      "invalid paper trading comparison preparation input"
    );
  }
  const expectedDigest = `sha256:${createHash("sha256")
    .update(paperTradingComparisonPreparationDigestInput(preparation))
    .digest("hex")}`;
  if (preparation.preparation_digest !== expectedDigest) {
    throw new LocalStoreError(
      "paper_trading_comparison_preparation_digest_mismatch",
      "paper trading comparison preparation digest does not match canonical content"
    );
  }
  const loadedSides = await Promise.all([preparation.champion, preparation.challenger].map(
    async (side) => {
      const [candidate, candidateVersion, admission] = await Promise.all([
        this.readOptionalRecord<TradingSystemCandidateRecord>(
          "candidates",
          side.candidate_ref.id
        ),
        this.getCandidateVersion(side.candidate_version_ref.id),
        this.getCandidateAdmissionDecision(side.candidate_admission_decision_ref.id)
      ]);
      const systemCode = candidateVersion?.system_code_ref
        ? await this.getSystemCode(candidateVersion.system_code_ref.id)
        : undefined;
      return { side, candidate, candidateVersion, admission, systemCode };
    }
  ));
  if (loadedSides.some(({ candidate, candidateVersion, admission, systemCode }) =>
    !candidate || !candidateVersion || !admission || !systemCode
  )) {
    throw new LocalStoreError(
      "paper_trading_comparison_preparation_reference_not_found",
      "paper comparison preparation references missing candidate, version, admission, or SystemCode"
    );
  }
  for (const loaded of loadedSides) {
    const { side, candidate, candidateVersion, admission, systemCode } = loaded as {
      side: PaperTradingComparisonCandidateSide;
      candidate: TradingSystemCandidateRecord;
      candidateVersion: CandidateVersionRecord;
      admission: CandidateAdmissionDecisionRecord;
      systemCode: SystemCodeRecord;
    };
    const exactContentMatches =
      paperTradingComparisonRefsEqual(side.candidate_ref, {
        record_kind: candidate.record_kind,
        id: candidate.candidate_id
      }) && paperTradingComparisonRefsEqual(side.candidate_version_ref, {
        record_kind: candidateVersion.record_kind,
        id: candidateVersion.candidate_version_id
      }) && side.candidate_version_digest === comparisonExactRecordDigest(
        paperTradingComparisonCandidateVersionDigestInput(candidateVersion)
      ) && paperTradingComparisonRefsEqual(side.system_code_ref, {
        record_kind: systemCode.record_kind,
        id: systemCode.system_code_id
      }) &&
      side.system_code_record_digest === comparisonExactRecordDigest(
        paperTradingComparisonSystemCodeRecordDigestInput(systemCode)
      ) &&
      side.system_code_artifact_digest === systemCode.artifact_digest &&
      paperTradingComparisonRefsEqual(side.candidate_admission_decision_ref, {
        record_kind: admission.record_kind,
        id: admission.candidate_admission_decision_id
      }) &&
      side.admission_decision_digest === comparisonExactRecordDigest(
        paperTradingComparisonAdmissionDecisionDigestInput(admission)
      );
    if (!exactContentMatches) {
      throw new LocalStoreError(
        "paper_trading_comparison_frozen_record_digest_mismatch",
        "paper comparison frozen CandidateVersion, SystemCode, or admission content changed"
      );
    }
    const admitted =
      candidate.candidate_id === side.candidate_ref.id &&
      candidateVersion.candidate_id === side.candidate_ref.id &&
      candidateVersion.candidate_version_id === side.candidate_version_ref.id &&
      paperTradingComparisonRefsEqual(
        candidateVersion.system_code_ref,
        { record_kind: systemCode.record_kind, id: systemCode.system_code_id }
      ) &&
      admission.status === "admitted" &&
      admission.runnable_paper_handoff === true &&
      admission.authority_status === "not_live" &&
      isCandidateAdmissionDecisionConsistent(admission) &&
      isIsoTimestamp(systemCode.created_at) &&
      isIsoTimestamp(admission.decided_at) &&
      Date.parse(systemCode.created_at) <= Date.parse(admission.decided_at) &&
      Date.parse(admission.decided_at) <= Date.parse(preparation.committed_at) &&
      paperTradingComparisonRefsEqual(
        admission.system_code_ref,
        { record_kind: systemCode.record_kind, id: systemCode.system_code_id }
      ) &&
      admission.submitted_artifact_digest === systemCode.artifact_digest;
    if (!admitted) {
      throw new LocalStoreError(
        "paper_trading_comparison_candidate_not_admitted",
        "paper comparison candidates must bind exact admitted frozen SystemCode evidence"
      );
    }
  }
  const [champion, challenger] = loadedSides as [
    { systemCode: SystemCodeRecord },
    { systemCode: SystemCodeRecord }
  ];
  if (champion.systemCode.artifact_digest === challenger.systemCode.artifact_digest) {
    throw new LocalStoreError(
      "paper_trading_comparison_duplicate_executable",
      "paper comparison candidates freeze the same stored SystemCode bytes"
    );
  }

  const latestPromotion = requireCurrentSelection
    ? await this.getLatestTradingPromotion()
    : undefined;
  if (preparation.comparison_policy.comparison_mode === "bootstrap") {
    if (
      preparation.champion_selection.selection_kind !== "bootstrap" ||
      (requireCurrentSelection && latestPromotion)
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_champion_selection_mismatch",
        "bootstrap comparison requires no current TradingPromotion"
      );
    }
    return;
  }
  if (preparation.champion_selection.selection_kind !== "trading_review") {
    throw new LocalStoreError(
      "paper_trading_comparison_champion_selection_mismatch",
      "champion challenge requires a bound TradingPromotion"
    );
  }
  const boundPromotion = await this.getTradingPromotion(
    preparation.champion_selection.trading_promotion_ref.id
  );
  if (!boundPromotion) {
    throw new LocalStoreError(
      "paper_trading_comparison_preparation_reference_not_found",
      "bound TradingPromotion was not found"
    );
  }
  const [promotionEvaluation, promotionCommitment] = await Promise.all([
    this.getPaperTradingEvaluation(
      preparation.champion_selection.paper_trading_evaluation_ref.id
    ),
    this.getPaperTradingEvaluationCommitment(
      preparation.champion_selection.paper_trading_evaluation_commitment_ref.id
    )
  ]);
  if (!promotionEvaluation || !promotionCommitment) {
    throw new LocalStoreError(
      "paper_trading_comparison_preparation_reference_not_found",
      "bound TradingPromotion qualification evaluation or commitment was not found"
    );
  }
  const promotionObservations = await this.listPaperTradingObservations(
    promotionEvaluation.paper_trading_evaluation_id
  );
  const championAdmission = loadedSides[0]!.admission!;
  const championSystemCode = loadedSides[0]!.systemCode!;
  if (!paperTradingComparisonStoppedQualificationClosureHasRuntimeShape({
    systemCode: championSystemCode,
    admission: championAdmission,
    commitment: promotionCommitment,
    evaluation: promotionEvaluation,
    observations: promotionObservations,
    promotion: boundPromotion,
    preparationCommittedAt: preparation.committed_at
  })) {
    throw new LocalStoreError(
      "paper_trading_comparison_champion_selection_mismatch",
      "bound TradingPromotion qualification evidence has invalid persisted shape"
    );
  }
  const promotionCommitmentSelfDigest = `sha256:${createHash("sha256")
    .update(paperTradingEvaluationCommitmentDigestInput(promotionCommitment))
    .digest("hex")}`;
  const promotionCommitmentDigestVerified =
    promotionCommitment.commitment_digest === promotionCommitmentSelfDigest;
  const qualification = decidePaperTradingQualification({
    evaluation: promotionEvaluation,
    commitment: promotionCommitment,
    observations: promotionObservations,
    runnerActive: false,
    commitmentDigestVerified: promotionCommitmentDigestVerified
  });
  if (!promotionCommitmentDigestVerified ||
    qualification.qualification_status !== "qualified") {
    throw new LocalStoreError(
      "paper_trading_comparison_champion_selection_mismatch",
      "bound TradingPromotion evidence does not satisfy the canonical qualification decision"
    );
  }
  const frozenPromotionContentMatches =
    preparation.champion_selection.trading_promotion_digest ===
      comparisonExactRecordDigest(
        paperTradingComparisonTradingPromotionDigestInput(boundPromotion)
      ) &&
    preparation.champion_selection.paper_trading_evaluation_record_digest ===
      comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(promotionEvaluation)
      ) &&
    preparation.champion_selection.paper_trading_evaluation_commitment_record_digest ===
      comparisonExactRecordDigest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(promotionCommitment)
      ) &&
    preparation.champion_selection.paper_trading_observation_chain_digest ===
      comparisonExactRecordDigest(
        paperTradingComparisonObservationChainDigestInput(promotionObservations)
      );
  if (!frozenPromotionContentMatches) {
    throw new LocalStoreError(
      "paper_trading_comparison_frozen_record_digest_mismatch",
      "paper comparison frozen TradingPromotion qualification closure changed"
    );
  }
  const orderedPromotionObservations = [...promotionObservations].sort((left, right) =>
    left.sequence - right.sequence ||
    left.paper_trading_observation_id.localeCompare(right.paper_trading_observation_id)
  );
  const promotionMatches =
    paperTradingComparisonRefsEqual(
      boundPromotion.paper_trading_evaluation_ref,
      preparation.champion_selection.paper_trading_evaluation_ref
    ) &&
    paperTradingComparisonRefsEqual(
      promotionEvaluation.paper_trading_evaluation_commitment_ref,
      preparation.champion_selection.paper_trading_evaluation_commitment_ref
    ) &&
    paperTradingComparisonRefsEqual(
      preparation.champion_selection.paper_trading_evaluation_commitment_ref,
      {
        record_kind: promotionCommitment.record_kind,
        id: promotionCommitment.paper_trading_evaluation_commitment_id
      }
    ) &&
    promotionEvaluation.observation_count === orderedPromotionObservations.length &&
    promotionEvaluation.observation_count >=
      preparation.comparison_policy.minimum_observation_count &&
    Date.parse(promotionEvaluation.stopped_at!) -
      Date.parse(promotionEvaluation.started_at) >=
      preparation.comparison_policy.minimum_elapsed_ms &&
    paperTradingComparisonRefsEqual(
      boundPromotion.candidate_ref,
      preparation.champion.candidate_ref
    ) &&
    paperTradingComparisonRefsEqual(
      boundPromotion.candidate_version_ref,
      preparation.champion.candidate_version_ref
    ) &&
    (!requireCurrentSelection || latestPromotion?.trading_promotion_id ===
      boundPromotion.trading_promotion_id);
  if (!promotionMatches) {
    throw new LocalStoreError(
      "paper_trading_comparison_champion_selection_mismatch",
      "bound TradingPromotion does not authorize the selected champion"
    );
  }
}

function comparisonExactRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}
```

- [ ] **Step 5: Implement append-only pair persistence with independent digest verification**

Add the three port methods beside the existing paper evaluation commitment methods. The write path
must recompute the pair digest itself, accept only byte-equivalent replay, reject any same-ID drift,
load and match the exact preparation, validate the full inert graph, and write only after all checks
pass. Active unordered-pair exclusion already happened when the preparation was created:

```ts
async recordPaperTradingComparisonCommitment(
  commitment: PaperTradingComparisonCommitmentRecord
): Promise<PaperTradingComparisonCommitmentRecord> {
  return this.withComparisonEvidenceWriteTransaction(
    () => this.recordPaperTradingComparisonCommitmentUnlocked(commitment)
  );
}

private async recordPaperTradingComparisonCommitmentUnlocked(
  commitment: PaperTradingComparisonCommitmentRecord
): Promise<PaperTradingComparisonCommitmentRecord> {
  if (!paperTradingComparisonCommitmentHasRuntimeShape(commitment)) {
    throw new LocalStoreError(
      "invalid_paper_trading_comparison_commitment_input",
      "invalid paper trading comparison commitment input"
    );
  }
  const expectedDigest = `sha256:${createHash("sha256")
    .update(paperTradingComparisonCommitmentDigestInput(commitment))
    .digest("hex")}`;
  if (commitment.commitment_digest !== expectedDigest) {
    throw new LocalStoreError(
      "paper_trading_comparison_commitment_digest_mismatch",
      "paper trading comparison commitment digest does not match canonical content"
    );
  }

  const existing = await this.getPaperTradingComparisonCommitment(
    commitment.paper_trading_comparison_commitment_id
  );
  if (existing) {
    if (!sameJson(existing, commitment)) {
      throw new LocalStoreError(
        "paper_trading_comparison_commitment_conflict",
        "paper trading comparison commitment is append-only"
      );
    }
    await this.validatePaperTradingComparisonCommitmentGraph(existing);
    return existing;
  }

  await this.validatePaperTradingComparisonCommitmentGraph(commitment);
  await this.writeJson(
    this.itemPath(
      "paper-trading-comparison-commitments",
      commitment.paper_trading_comparison_commitment_id
    ),
    commitment
  );
  return commitment;
}

async getPaperTradingComparisonCommitment(
  comparisonId: string
): Promise<PaperTradingComparisonCommitmentRecord | undefined> {
  return this.readOptionalRecord<PaperTradingComparisonCommitmentRecord>(
    "paper-trading-comparison-commitments",
    comparisonId
  );
}

async listPaperTradingComparisonCommitments(): Promise<PaperTradingComparisonCommitmentRecord[]> {
  return (await this.readCollection<PaperTradingComparisonCommitmentRecord>(
    "paper-trading-comparison-commitments"
  )).sort((left, right) =>
    left.committed_at.localeCompare(right.committed_at) ||
    left.paper_trading_comparison_commitment_id.localeCompare(
      right.paper_trading_comparison_commitment_id
    )
  );
}
```

- [ ] **Step 6: Implement preparation-bound inert graph validation**

Add `validatePaperTradingComparisonCommitmentGraph` and a side loader. Validation must load both
side commitments, matching evaluations, candidate versions, TradingRuns, and SystemCode records;
recompute each side digest; and reject unless all of these predicates hold:

```ts
interface LoadedPaperTradingComparisonSideGraph {
  input: PaperTradingComparisonSide;
  candidate: CandidateInspectReadModel;
  candidateVersion: CandidateVersionRecord;
  admission: CandidateAdmissionDecisionRecord;
  run: TradingRunRecord;
  systemCode: SystemCodeRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}

private async validatePaperTradingComparisonCommitmentGraph(
  comparison: PaperTradingComparisonCommitmentRecord
): Promise<void> {
  const preparation = await this.getPaperTradingComparisonPreparation(
    comparison.preparation_ref.id
  );
  if (!preparation) {
    throw new LocalStoreError(
      "paper_trading_comparison_preparation_reference_not_found",
      "paper comparison commitment preparation was not found"
    );
  }
  await this.validatePaperTradingComparisonPreparation(preparation, false);
  const candidateSideMatches = (
    runtimeSide: PaperTradingComparisonSide,
    candidateSide: PaperTradingComparisonCandidateSide
  ) => runtimeSide.role === candidateSide.role &&
    paperTradingComparisonRefsEqual(runtimeSide.candidate_ref, candidateSide.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      runtimeSide.candidate_version_ref,
      candidateSide.candidate_version_ref
    ) &&
    runtimeSide.candidate_version_digest === candidateSide.candidate_version_digest &&
    paperTradingComparisonRefsEqual(runtimeSide.system_code_ref, candidateSide.system_code_ref) &&
    runtimeSide.system_code_record_digest === candidateSide.system_code_record_digest &&
    runtimeSide.system_code_artifact_digest === candidateSide.system_code_artifact_digest &&
    paperTradingComparisonRefsEqual(
      runtimeSide.candidate_admission_decision_ref,
      candidateSide.candidate_admission_decision_ref
    ) &&
    runtimeSide.admission_decision_digest === candidateSide.admission_decision_digest;
  const preparationMatches =
    comparison.preparation_ref.record_kind === "paper_trading_comparison_preparation" &&
    comparison.paper_trading_comparison_commitment_id ===
      preparation.paper_trading_comparison_commitment_id &&
    candidateSideMatches(comparison.champion, preparation.champion) &&
    candidateSideMatches(comparison.challenger, preparation.challenger) &&
    sameJson(comparison.champion_selection, preparation.champion_selection) &&
    sameJson(comparison.comparison_policy, preparation.comparison_policy) &&
    comparison.market_data_configuration_digest ===
      preparation.market_data_configuration_digest &&
    sameJson(comparison.paper_policy_identity, preparation.paper_policy_identity) &&
    comparison.committed_at === preparation.committed_at;
  if (!preparationMatches) {
    throw new LocalStoreError(
      "paper_trading_comparison_preparation_mismatch",
      "paper comparison commitment does not match its frozen preparation"
    );
  }
  const champion = await this.loadPaperTradingComparisonSide(comparison.champion);
  const challenger = await this.loadPaperTradingComparisonSide(comparison.challenger);
  if (!champion || !challenger) {
    throw new LocalStoreError(
      "paper_trading_comparison_commitment_reference_not_found",
      "paper trading comparison commitment references an incomplete side graph"
    );
  }

  const sideMatches = (
    role: "champion" | "challenger",
    side: LoadedPaperTradingComparisonSideGraph | undefined
  ): boolean => Boolean(side) &&
    side!.input.role === role &&
    paperTradingComparisonSideRecordsHaveInertShape(side!) &&
    isIsoTimestamp(side!.commitment.committed_at) &&
    Date.parse(side!.commitment.committed_at) >= Date.parse(preparation.committed_at) &&
    isIsoTimestamp(side!.run.created_at) &&
    side!.run.created_at === preparation.committed_at &&
    side!.commitment.commitment_digest === `sha256:${createHash("sha256")
      .update(paperTradingEvaluationCommitmentDigestInput(side!.commitment))
      .digest("hex")}` &&
    side!.input.paper_trading_evaluation_commitment_record_digest ===
      comparisonExactRecordDigest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(side!.commitment)
      ) &&
    side!.input.paper_trading_evaluation_record_digest ===
      comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(side!.evaluation)
      ) &&
    side!.evaluation.started_at === side!.commitment.committed_at &&
    paperTradingComparisonRefsEqual(side!.input.candidate_ref, {
      record_kind: side!.candidate.record_kind,
      id: side!.candidate.candidate_id
    }) &&
    side!.candidateVersion.candidate_id === side!.input.candidate_ref.id &&
    side!.candidateVersion.candidate_version_id === side!.input.candidate_version_ref.id &&
    paperTradingComparisonRefsEqual(
      side!.candidateVersion.system_code_ref,
      side!.input.system_code_ref
    ) &&
    side!.input.candidate_version_digest === comparisonExactRecordDigest(
      paperTradingComparisonCandidateVersionDigestInput(side!.candidateVersion)
    ) &&
    paperTradingComparisonRefsEqual(side!.input.system_code_ref, {
      record_kind: side!.systemCode.record_kind,
      id: side!.systemCode.system_code_id
    }) &&
    side!.input.system_code_record_digest === comparisonExactRecordDigest(
      paperTradingComparisonSystemCodeRecordDigestInput(side!.systemCode)
    ) &&
    side!.input.system_code_artifact_digest === side!.systemCode.artifact_digest &&
    paperTradingComparisonRefsEqual(side!.input.candidate_ref, side!.commitment.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      side!.input.candidate_version_ref,
      side!.commitment.candidate_version_ref
    ) &&
    paperTradingComparisonRefsEqual(side!.input.system_code_ref, side!.commitment.system_code_ref) &&
    side!.input.system_code_artifact_digest ===
      side!.commitment.system_code_artifact_digest &&
    paperTradingComparisonRefsEqual(
      side!.input.candidate_admission_decision_ref,
      {
        record_kind: side!.admission.record_kind,
        id: side!.admission.candidate_admission_decision_id
      }
    ) &&
    side!.input.admission_decision_digest === comparisonExactRecordDigest(
      paperTradingComparisonAdmissionDecisionDigestInput(side!.admission)
    ) &&
    side!.admission.status === "admitted" &&
    side!.admission.runnable_paper_handoff === true &&
    side!.admission.authority_status === "not_live" &&
    isCandidateAdmissionDecisionConsistent(side!.admission) &&
    isIsoTimestamp(side!.admission.decided_at) &&
    Date.parse(side!.admission.decided_at) <= Date.parse(preparation.committed_at) &&
    paperTradingComparisonRefsEqual(
      side!.admission.system_code_ref,
      { record_kind: side!.systemCode.record_kind, id: side!.systemCode.system_code_id }
    ) &&
    side!.admission.submitted_artifact_digest === side!.systemCode.artifact_digest &&
    paperTradingComparisonRefsEqual(side!.input.trading_run_ref, side!.commitment.trading_run_ref) &&
    paperTradingComparisonRefsEqual(
      side!.input.paper_trading_evaluation_commitment_ref,
      {
        record_kind: side!.commitment.record_kind,
        id: side!.commitment.paper_trading_evaluation_commitment_id
      }
    ) &&
    side!.input.paper_trading_evaluation_commitment_digest ===
      side!.commitment.commitment_digest &&
    paperTradingComparisonRefsEqual(
      side!.input.paper_trading_evaluation_ref,
      {
        record_kind: side!.evaluation.record_kind,
        id: side!.evaluation.paper_trading_evaluation_id
      }
    ) &&
    paperTradingComparisonRefsEqual(side!.run.candidate_ref, side!.commitment.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      side!.run.candidate_version_ref,
      side!.commitment.candidate_version_ref
    ) &&
    paperTradingComparisonRefsEqual(side!.run.system_code_ref, side!.commitment.system_code_ref) &&
    paperTradingComparisonRefsEqual(
      side!.evaluation.paper_trading_evaluation_commitment_ref,
      side!.input.paper_trading_evaluation_commitment_ref
    ) &&
    paperTradingComparisonRefsEqual(
      side!.evaluation.candidate_ref,
      side!.commitment.candidate_ref
    ) &&
    paperTradingComparisonRefsEqual(
      side!.evaluation.candidate_version_ref,
      side!.commitment.candidate_version_ref
    ) &&
    paperTradingComparisonRefsEqual(
      side!.evaluation.trading_run_ref,
      side!.commitment.trading_run_ref
    ) &&
    sameJson(side!.commitment.runtime_identity, {
      artifact_kind: side!.systemCode.artifact_kind,
      runtime_kind: side!.systemCode.runtime_kind,
      entrypoint: side!.systemCode.entrypoint,
      ...(side!.systemCode.artifact_runtime_contract_ref
        ? { artifact_runtime_contract_ref: side!.systemCode.artifact_runtime_contract_ref }
        : {})
    }) &&
    paperTradingComparisonRefsEqual(
      side!.commitment.capability_policy_ref,
      side!.systemCode.capability_policy_ref
    ) &&
    paperTradingComparisonRefsEqual(
      side!.commitment.secret_policy_ref,
      side!.systemCode.secret_policy_ref
    ) &&
    paperTradingEvaluationReferencesMatch(side!.evaluation, side!.commitment);

  const pairMatches = sideMatches("champion", champion) &&
    sideMatches("challenger", challenger) &&
    champion.input.candidate_version_ref.id !== challenger.input.candidate_version_ref.id &&
    champion.input.trading_run_ref.id !== challenger.input.trading_run_ref.id &&
    champion.input.paper_trading_evaluation_commitment_ref.id !==
      challenger.input.paper_trading_evaluation_commitment_ref.id &&
    champion.input.paper_trading_evaluation_ref.id !==
      challenger.input.paper_trading_evaluation_ref.id &&
    champion.evaluation.paper_trading_evaluation_id !==
      challenger.evaluation.paper_trading_evaluation_id &&
    champion.commitment.resolved_artifact_digest !==
      challenger.commitment.resolved_artifact_digest &&
    comparison.comparison_policy.symbol === champion.commitment.data_identity.symbol &&
    sameJson(champion.commitment.data_identity, challenger.commitment.data_identity) &&
    comparison.market_data_configuration_digest ===
      champion.commitment.data_identity.market_data_configuration_digest &&
    sameJson(comparison.paper_policy_identity, champion.commitment.policy_identity) &&
    sameJson(champion.commitment.policy_identity, challenger.commitment.policy_identity) &&
    comparison.comparison_policy.interval_ms === champion.commitment.window_policy.interval_ms &&
    comparison.comparison_policy.interval_ms === challenger.commitment.window_policy.interval_ms &&
    sameJson(champion.commitment.window_policy, challenger.commitment.window_policy) &&
    sameJson(
      champion.commitment.initial_account_snapshot,
      challenger.commitment.initial_account_snapshot
    );

  if (!pairMatches) {
    throw new LocalStoreError(
      "paper_trading_comparison_commitment_reference_mismatch",
      "paper trading comparison commitment does not match its complete inert side graph"
    );
  }
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}
```

Implement the loader by exact persisted refs. It scans every commitment and evaluation by full
`trading_run_ref`, then requires the pair-bound deterministic commitment and evaluation to be the
only chain for that run. It must not select by current candidate state or latest evaluation:

```ts
private async loadPaperTradingComparisonSide(
  input: PaperTradingComparisonSide
): Promise<LoadedPaperTradingComparisonSideGraph | undefined> {
  const [
    candidate,
    candidateVersion,
    admission,
    run,
    systemCode,
    commitment,
    evaluation,
    allCommitments,
    allEvaluations
  ] =
    await Promise.all([
    this.getCandidateForTradingRun(input.trading_run_ref.id),
    this.getCandidateVersion(input.candidate_version_ref.id),
    this.getCandidateAdmissionDecision(input.candidate_admission_decision_ref.id),
    this.getTradingRun(input.trading_run_ref.id),
    this.getSystemCode(input.system_code_ref.id),
    this.getPaperTradingEvaluationCommitment(
      input.paper_trading_evaluation_commitment_ref.id
    ),
    this.getPaperTradingEvaluation(input.paper_trading_evaluation_ref.id),
    this.listPaperTradingEvaluationCommitments(),
    this.listPaperTradingEvaluations()
  ]);
  if (!candidate || !candidateVersion || !admission || !run || !systemCode ||
    !commitment || !evaluation) {
    return undefined;
  }
  const persistedField = (value: unknown, key: string): unknown =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)[key]
      : undefined;
  const runRef = { record_kind: "trading_run", id: input.trading_run_ref.id };
  const commitmentsForRun = allCommitments.filter((record) =>
    paperTradingComparisonRefsEqual(persistedField(record, "trading_run_ref"), runRef)
  );
  const evaluationsForRun = allEvaluations.filter((record) =>
    paperTradingComparisonRefsEqual(persistedField(record, "trading_run_ref"), runRef)
  );
  if (
    commitmentsForRun.length !== 1 ||
    persistedField(
      commitmentsForRun[0],
      "paper_trading_evaluation_commitment_id"
    ) !== input.paper_trading_evaluation_commitment_ref.id ||
    evaluationsForRun.length !== 1 ||
    persistedField(evaluationsForRun[0], "paper_trading_evaluation_id") !==
      input.paper_trading_evaluation_ref.id ||
    !paperTradingComparisonRefsEqual(
      persistedField(evaluation, "paper_trading_evaluation_commitment_ref"),
      input.paper_trading_evaluation_commitment_ref
    ) ||
    persistedField(candidateVersion, "candidate_id") !== input.candidate_ref.id
  ) {
    return undefined;
  }
  return {
    input,
    candidate,
    candidateVersion,
    admission,
    run,
    systemCode,
    commitment,
    evaluation,
    observations: await this.listPaperTradingObservations(
      input.paper_trading_evaluation_ref.id
    )
  };
}
```

- [ ] **Step 7: Reuse the exported total comparison runtime predicates**

Delete the LocalStore-private preparation, pair, side, selection, policy, promotion-evaluation, and
promotion-observation predicates. Import the Task 1 predicates and call them before the first field
access in each append/replay path:

```ts
if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
  throw new LocalStoreError(
    "invalid_paper_trading_comparison_preparation_input",
    "invalid paper trading comparison preparation input"
  );
}

if (!paperTradingComparisonCommitmentHasRuntimeShape(commitment)) {
  throw new LocalStoreError(
    "invalid_paper_trading_comparison_commitment_input",
    "invalid paper trading comparison commitment input"
  );
}
```

Every scan of persisted preparations or pairs in a writer guard also validates the loaded record
before dereferencing it. A malformed active record fails with a stable LocalStore comparison input
error rather than a raw property-access exception:

```ts
private assertPersistedComparisonPreparationShape(
  value: unknown
): asserts value is PaperTradingComparisonPreparationRecord {
  if (!paperTradingComparisonPreparationHasRuntimeShape(value)) {
    throw new LocalStoreError(
      "invalid_paper_trading_comparison_preparation_input",
      "persisted paper comparison preparation has invalid runtime shape"
    );
  }
}

private assertPersistedComparisonCommitmentShape(
  value: unknown
): asserts value is PaperTradingComparisonCommitmentRecord {
  if (!paperTradingComparisonCommitmentHasRuntimeShape(value)) {
    throw new LocalStoreError(
      "invalid_paper_trading_comparison_commitment_input",
      "persisted paper comparison commitment has invalid runtime shape"
    );
  }
}
```

- [ ] **Step 8: Run LocalStore tests and package typechecks**

Run: `npx vitest run packages/local-store/test/local-store.test.ts -t "paper comparison"`

Run: `npm run typecheck -w @ouroboros/application`

Run: `npm run typecheck -w @ouroboros/local-store`

Expected: PASS; preparation replay recomputes every exact-record digest, admission/promotion/policy
drift and causally valid role reversal fail before side writes, the happy-path market/evaluation refs
are valid, same-champion alternate-chain refs and semantically unqualified direct-store evidence
write no preparation or side, and a key-reordered semantically identical final account is accepted
by the same domain decision used by application. Malformed or nonzero preparation-bound pair graphs
write no pair, authority writers cannot race reservation, and side/run/evidence writers cannot race
or mutate an appended inert pair.

- [ ] **Step 9: Commit the store boundary**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist paper comparison preparation graphs"
```

### Task 3: Retryable Partial Qualification Preparation

**Files:**
- Modify: `packages/application/src/trading/paper/session-service.ts:115-270`
- Modify: `packages/application/src/trading/paper/session-service.test.ts:19-260`

**Interfaces:**
- Preserves: `PaperTradingSessionService.prepare(input): Promise<PreparedPaperTradingSession>`.
- Preserves: qualification `activate`, `observe`, `schedule`, and `stop` rejection behavior.
- Produces: deterministic repair only when the exact deterministic side commitment exists and the
  exact deterministic `not_started` evaluation is absent.
- Rejects: evaluation-without-commitment, alternate or additional commitment/evaluation records for
  the run, alternate commitment/evaluation chains, commitment identity drift, artifact drift,
  policy drift, and terminal evaluation replay.

- [ ] **Step 1: Write failing exact-identity repair and conflict tests**

Add the exact missing imports to `session-service.test.ts`:

```ts
import { createHash } from "node:crypto";
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  PAPER_TRADING_COMPARISON_ZERO_SCORE,
  paperTradingEvaluationCommitmentDigestInput,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import {
  initialPaperTradingEngineState,
  paperTradingScoreFromAccount
} from "./engine";
```

Pin the shared constants to the application engine's serialized baseline byte-for-byte:

```ts
it("keeps comparison neutral constants byte-identical to the paper engine baseline", () => {
  const initial = initialPaperTradingEngineState();
  expect(JSON.stringify(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT))
    .toBe(JSON.stringify(initial.account));
  expect(initial.openOrders).toEqual([]);
  expect(initial.processedTradingSystemEventIds).toEqual([]);
  expect(initial.processedPublicTradeIds).toEqual([]);
  expect(paperTradingScoreFromAccount(initial.account))
    .toEqual(PAPER_TRADING_COMPARISON_ZERO_SCORE);
});
```

First fail the evaluation write after the deterministic commitment is durable, then retry with the
unwrapped `LocalStore`:

```ts
it("repairs a commitment-only qualification preparation without runtime effects", async () => {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!candidate) {
    throw new Error("fixture candidate was not materialized");
  }
  const run = await store.createPaperTradingRun({
    idempotency_key: "session-service-partial-qualification",
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: "2026-07-10T00:00:00.000Z"
  });
  const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
  const first = inertSessionService(failFirstEvaluationWrite(store), effects);

  await expect(first.prepare({
    candidateId: candidate.candidate_id,
    candidateVersionId: candidate.candidate_version.candidate_version_id,
    tradingRunId: run.trading_run_id,
    evidencePurpose: "qualification",
    clock: "external"
  })).rejects.toThrow("injected_evaluation_write_failure");
  const [persistedCommitment] = await store.listPaperTradingEvaluationCommitments();
  expect(persistedCommitment?.trading_run_ref.id).toBe(run.trading_run_id);
  expect(await store.getLatestPaperTradingEvaluationForTradingRun(run.trading_run_id))
    .toBeUndefined();

  const repaired = await inertSessionService(store, effects).prepare({
    candidateId: candidate.candidate_id,
    candidateVersionId: candidate.candidate_version.candidate_version_id,
    tradingRunId: run.trading_run_id,
    evidencePurpose: "qualification",
    clock: "external"
  });

  expect(repaired.commitment).toEqual(persistedCommitment);
  expect(repaired.commitment.paper_trading_evaluation_commitment_id)
    .toMatch(/^paper-trading-evaluation-commitment-/);
  const deterministicSuffix = repaired.commitment.paper_trading_evaluation_commitment_id.slice(
    "paper-trading-evaluation-commitment-".length
  );
  expect(repaired.evaluation.paper_trading_evaluation_id).toBe(
    `paper-trading-evaluation-${deterministicSuffix}`
  );
  expect(repaired.evaluation).toMatchObject({
    status: "not_started",
    observation_count: 0,
    started_at: persistedCommitment!.committed_at,
    paper_trading_evaluation_commitment_ref: {
      id: persistedCommitment!.paper_trading_evaluation_commitment_id
    }
  });
  expect(repaired.candidate.candidate_id).toBe(candidate.candidate_id);
  expect(repaired.verification.status).toBe("verified");
  expect(repaired.clock).toBe("external");
  expect(effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  await expect(store.listPaperTradingObservations(
    repaired.evaluation.paper_trading_evaluation_id
  )).resolves.toEqual([]);
});

it.each([
  "alternate-evaluation-for-exact-commitment",
  "additional-evaluation-for-exact-commitment",
  "alternate-commitment-only",
  "alternate-commitment-evaluation-chain"
] as const)("rejects non-deterministic partial session identity: %s", async (shape) => {
  const store = new LocalStore(path.join(tmpDir, shape));
  await store.initialize();
  const fixture = await qualificationRunFixture(store, shape);
  const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
  const failing = inertSessionService(failFirstEvaluationWrite(store), effects);
  await expect(failing.prepare(fixture.input)).rejects.toThrow(
    "injected_evaluation_write_failure"
  );
  const [exactCommitment] = await store.listPaperTradingEvaluationCommitments();
  if (!exactCommitment) {
    throw new Error("deterministic commitment was not persisted");
  }
  const exactCommitmentId = exactCommitment.paper_trading_evaluation_commitment_id;
  const exactEvaluationId = `paper-trading-evaluation-${exactCommitmentId.slice(
    "paper-trading-evaluation-commitment-".length
  )}`;

  if (shape === "additional-evaluation-for-exact-commitment") {
    await store.recordPaperTradingEvaluation(
      notStartedEvaluationFixture(exactCommitment, exactEvaluationId)
    );
  }
  if (shape === "alternate-commitment-evaluation-chain" ||
    shape === "alternate-commitment-only") {
    const alternateCommitment = withSessionCommitmentDigest({
      ...exactCommitment,
      paper_trading_evaluation_commitment_id: `${exactCommitmentId}-alternate`,
      commitment_digest: ""
    });
    await store.recordPaperTradingEvaluationCommitment(alternateCommitment);
    if (shape === "alternate-commitment-evaluation-chain") {
      await store.recordPaperTradingEvaluation(
        notStartedEvaluationFixture(
          alternateCommitment,
          `${exactEvaluationId}-alternate-chain`
        )
      );
    }
  } else {
    await store.recordPaperTradingEvaluation(
      notStartedEvaluationFixture(
        exactCommitment,
        `${exactEvaluationId}-alternate`
      )
    );
  }
  const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
  const evaluationsBefore = await store.listPaperTradingEvaluations();

  await expect(inertSessionService(store, effects).prepare(fixture.input)).rejects.toMatchObject({
    code: "paper_trading_session_deterministic_identity_conflict"
  });
  await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(commitmentsBefore);
  await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
  expect(effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

async function qualificationRunFixture(store: LocalStore, suffix: string) {
  const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!candidate) {
    throw new Error("fixture candidate was not materialized");
  }
  const run = await store.createPaperTradingRun({
    idempotency_key: `session-deterministic-identity-${suffix}`,
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: "2026-07-10T00:00:00.000Z"
  });
  const input: Parameters<PaperTradingSessionService["prepare"]>[0] = {
    candidateId: candidate.candidate_id,
    candidateVersionId: candidate.candidate_version.candidate_version_id,
    tradingRunId: run.trading_run_id,
    evidencePurpose: "qualification",
    clock: "external"
  };
  return { candidate, run, input };
}

function notStartedEvaluationFixture(
  commitment: PaperTradingEvaluationCommitmentRecord,
  evaluationId: string
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: evaluationId,
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    interval_ms: commitment.window_policy.interval_ms,
    observation_count: 0,
    started_at: commitment.committed_at,
    latest_score: {
      revenue_usdt: 0,
      cost_usdt: 0,
      net_revenue_usdt: 0,
      net_return_pct: 0
    },
    paper_account_snapshot: structuredClone(commitment.initial_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
}

function withSessionCommitmentDigest(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationCommitmentRecord {
  return {
    ...commitment,
    commitment_digest: `sha256:${createHash("sha256")
      .update(paperTradingEvaluationCommitmentDigestInput(commitment))
      .digest("hex")}`
  };
}

function failFirstEvaluationWrite(store: OuroborosStorePort): OuroborosStorePort {
  let failed = false;
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "recordPaperTradingEvaluation") {
        return async (...args: Parameters<OuroborosStorePort["recordPaperTradingEvaluation"]>) => {
          if (!failed) {
            failed = true;
            throw new Error("injected_evaluation_write_failure");
          }
          return target.recordPaperTradingEvaluation(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
```

Define the no-effect harness directly in the test. Preparation must never invoke its effectful
methods:

```ts
function inertSessionService(
  store: OuroborosStorePort,
  effects: { providerStarts: number; sandboxStarts: number; marketReads: number }
): PaperTradingSessionService {
  return new PaperTradingSessionService({
    store,
    intervalMs: 60_000,
    artifactResolver: {
      async resolveArtifactDigest() {
        return "sha256:session-service-fixture";
      }
    },
    sandboxAdapters: {
      deterministic_test: {
        async startArtifactInstance() {
          effects.sandboxStarts += 1;
          throw new Error("qualification preparation started a sandbox");
        }
      }
    } as never,
    marketData: {
      provider_kind: "binance_production_public_market_data",
      source_kind: "binance_production_public_hybrid",
      rest_base_url: "https://example.invalid",
      required_endpoints: [],
      authority_status: "read_only",
      async readMarketSnapshot() {
        effects.marketReads += 1;
        throw new Error("qualification preparation read market data");
      },
      async readPublicMarketLivenessSurface() {
        effects.marketReads += 1;
        throw new Error("qualification preparation read market liveness");
      },
      async readPublicExecutionSnapshot() {
        effects.marketReads += 1;
        throw new Error("qualification preparation read public execution");
      }
    },
    async apiProviderFactory() {
      effects.providerStarts += 1;
      throw new Error("qualification preparation started a provider");
    }
  });
}
```

- [ ] **Step 2: Run the exact-identity tests and confirm RED**

Run: `npx vitest run packages/application/src/trading/paper/session-service.test.ts -t "partial session identity|commitment-only qualification"`

Expected: FAIL because retry still selects a latest evaluation by TradingRun and does not reject an
alternate or additional commitment/evaluation chain.

- [ ] **Step 3: Split deterministic IDs and not-started evaluation construction from persistence**

At the start of `prepare`, derive both IDs once:

```ts
const commitmentId = `paper-trading-evaluation-commitment-${safeRouteId(input.tradingRunId)}`;
const evaluationId = `paper-trading-evaluation-${safeRouteId(input.tradingRunId)}`;
```

Extract the existing evaluation literal into a private pure helper that uses the commitment as the
identity and time source:

```ts
private notStartedEvaluation(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationRecord {
  const initialEngineState = initialPaperTradingEngineState();
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id:
      `paper-trading-evaluation-${safeRouteId(commitment.trading_run_ref.id)}`,
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    interval_ms: commitment.window_policy.interval_ms,
    observation_count: 0,
    started_at: commitment.committed_at,
    latest_score: zeroPaperTradingProfitLoss(),
    paper_account_snapshot: commitment.initial_account_snapshot,
    open_orders: initialEngineState.openOrders,
    processed_trading_system_event_ids: initialEngineState.processedTradingSystemEventIds,
    processed_public_trade_ids: initialEngineState.processedPublicTradeIds,
    authority_status: "not_live"
  };
}
```

- [ ] **Step 4: Enforce exact deterministic identity before reuse or repair**

After resolving current candidate, run, SystemCode, artifact digest, and Gateway binding, inspect
all persisted commitment/evaluation records before any write. Do not use
`getLatestPaperTradingEvaluationForTradingRun` in `prepare`. Import
`paperTradingComparisonRefsEqual` from `@ouroboros/domain` and match full Refs, not IDs alone:

```ts
const runRef = { record_kind: "trading_run", id: input.tradingRunId };
const [exactCommitment, exactEvaluation, allCommitments, allEvaluations] = await Promise.all([
  this.options.store.getPaperTradingEvaluationCommitment(commitmentId),
  this.options.store.getPaperTradingEvaluation(evaluationId),
  this.options.store.listPaperTradingEvaluationCommitments(),
  this.options.store.listPaperTradingEvaluations()
]);
const commitmentsForRun = allCommitments.filter((record) =>
  paperTradingComparisonRefsEqual(record.trading_run_ref, runRef)
);
const commitmentIdsForRun = new Set(
  commitmentsForRun.map((record) => record.paper_trading_evaluation_commitment_id)
);
const evaluationsForRun = allEvaluations.filter((record) =>
  paperTradingComparisonRefsEqual(record.trading_run_ref, runRef) ||
  (record.paper_trading_evaluation_commitment_ref?.record_kind ===
    "paper_trading_evaluation_commitment" &&
    commitmentIdsForRun.has(record.paper_trading_evaluation_commitment_ref.id))
);
const alternateCommitment = commitmentsForRun.find(
  (record) => record.paper_trading_evaluation_commitment_id !== commitmentId
);
const alternateEvaluation = evaluationsForRun.find(
  (record) => record.paper_trading_evaluation_id !== evaluationId
);
if (
  alternateCommitment ||
  alternateEvaluation ||
  (exactEvaluation && !exactCommitment) ||
  (exactCommitment && !paperTradingComparisonRefsEqual(exactCommitment.trading_run_ref, runRef)) ||
  (exactEvaluation && !paperTradingComparisonRefsEqual(exactEvaluation.trading_run_ref, runRef)) ||
  (exactEvaluation && exactEvaluation.paper_trading_evaluation_commitment_ref?.record_kind !==
    "paper_trading_evaluation_commitment") ||
  (exactEvaluation && exactEvaluation.paper_trading_evaluation_commitment_ref?.id !== commitmentId)
) {
  throw new PaperTradingSessionError(
    "paper_trading_session_deterministic_identity_conflict",
    "Paper session preparation found a non-deterministic commitment/evaluation identity."
  );
}

if (exactEvaluation) {
  const resolved = await this.verifyExisting(candidate, exactEvaluation, binding);
  const verification = resolved.verification;
  if (verification.status !== "verified") {
    const invalidated = await this.persistInvalidation(
      candidate,
      exactEvaluation,
      verification
    );
    throw new PaperTradingSessionError(
      "paper_trading_evaluation_invalidated",
      verification.diagnostic,
      { paper_trading_evaluation: invalidated, reason: verification.reason }
    );
  }
  return {
    candidate,
    commitment: resolved.commitment,
    evaluation: resolved.evaluation,
    verification,
    clock: input.clock
  };
}

const commitment = exactCommitment ?? createPaperTradingEvaluationCommitment({
  commitmentId,
  evidencePurpose: input.evidencePurpose,
  candidate,
  systemCode,
  resolvedArtifactDigest,
  marketData: binding.marketData,
  intervalMs: this.intervalMs,
  initialAccountSnapshot: initialPaperTradingEngineState().account,
  committedAt: new Date().toISOString()
});
if (!exactCommitment) {
  await this.options.store.recordPaperTradingEvaluationCommitment(commitment);
}
const evaluation = this.notStartedEvaluation(commitment);
if (evaluation.paper_trading_evaluation_id !== evaluationId) {
  throw new PaperTradingSessionError(
    "paper_trading_evaluation_identity_mismatch",
    "Deterministic paper evaluation identity changed during preparation."
  );
}
const verification = verifyPaperTradingEvaluationCommitment({
  commitment,
  evaluation,
  candidate,
  systemCode,
  resolvedArtifactDigest,
  marketData: binding.marketData,
  intervalMs: this.intervalMs
});
await this.options.store.recordPaperTradingEvaluation(evaluation);
if (verification.status !== "verified") {
  const invalidated = await this.persistInvalidation(candidate, evaluation, verification);
  throw new PaperTradingSessionError(
    "paper_trading_evaluation_invalidated",
    verification.diagnostic,
    { paper_trading_evaluation: invalidated, reason: verification.reason }
  );
}
return { candidate, commitment, evaluation, verification, clock: input.clock };
```

Call the current `verifyExisting(candidate, evaluation, binding)` signature exactly. It is reached
only for deterministic IDs and retains existing commitment, artifact, policy, and terminal-state
validation. Both exact-existing and repaired/new paths preserve the current invalid-verification
behavior: persist invalidation, then throw with the invalidated evaluation and reason. Every
successful path returns the full `PreparedPaperTradingSession`, including `candidate`, verified
commitment/evaluation, `verification`, and `clock: input.clock`. The sole repair path is exact
commitment present plus exact evaluation absent; no replacement identity can be frozen later.

- [ ] **Step 5: Re-run preparation and guard tests**

Run: `npx vitest run packages/application/src/trading/paper/session-service.test.ts`

Run: `npx vitest run apps/runtime/test/paper-trading-multi-run-session.test.ts -t "qualification"`

Expected: PASS; the commitment-only state repairs to one `not_started` evaluation, all counters
remain zero, every success returns a complete verified `PreparedPaperTradingSession`, invalid
verification still persists invalidation before throwing, and standalone qualification activation,
observation, scheduling, and stop remain rejected with
`paper_trading_comparison_authority_required`.

- [ ] **Step 6: Run the application typecheck**

Run: `npm run typecheck -w @ouroboros/application`

Expected: PASS.

- [ ] **Step 7: Commit the partial preparation repair**

```bash
git add packages/application/src/trading/paper/session-service.ts packages/application/src/trading/paper/session-service.test.ts
git commit -m "fix: repair partial qualification preparation"
```

### Task 4: Internal Inert Comparison Coordinator

**Files:**
- Create: `packages/application/src/trading/paper/comparison-coordinator.ts`
- Create: `packages/application/src/trading/paper/comparison-coordinator.test.ts`
- Verify unchanged: `packages/application/src/trading/paper/commands.ts`
- Verify unchanged: `apps/runtime/src/server.ts`
- Verify unchanged: `apps/runtime/test/paper-trading-evaluation-commitment.test.ts`

**Interfaces:**
- Consumes: `OuroborosStorePort.getCandidateForTradingRun`, `getCandidateVersion`, `getSystemCode`,
  `getCandidateAdmissionDecision`, `getLatestTradingPromotion`, `getTradingPromotion`,
  `getPaperTradingEvaluation`, evaluation commitment/evaluation/observation list reads, and the
  atomic preparation reservation plus commitment append/get/list methods from Task 2.
- Consumes: `Pick<PaperTradingSessionService, "prepare">` only inside pre-pair `prepareSide`,
  including partial repair. `reload`, `reloadSide`, and `verify` use StorePort reads only.
- Consumes unchanged: existing exported
  `paperTradingMarketDataConfigurationDigest(marketData): string` from `commitment.ts`; no edit to
  that file is planned.
- Consumes unchanged: `qualifyPaperTradingEvaluation`, now a Task 1 compatibility wrapper over
  `decidePaperTradingQualification` that independently verifies the commitment self-digest.
- Consumes: `PaperTradingComparisonCoordinatorOptions.now?: () => string`; the default is
  `() => new Date().toISOString()` and only the first preparation write calls it.
- Produces: `PaperTradingComparisonCoordinator.prepare(input): Promise<VerifiedPaperTradingComparisonCommitmentGraph>`.
- Produces: `PaperTradingComparisonCoordinator.reload(comparisonId): Promise<VerifiedPaperTradingComparisonCommitmentGraph | undefined>`.
- Produces: `PaperTradingComparisonCoordinator.verify(graph): Promise<VerifiedPaperTradingComparisonCommitmentGraph>`.
- Produces: deterministic preparation/pair IDs and role-specific additional TradingRun idempotency
  keys; the preparation is durable before either TradingRun is created.
- Requires: reservation success before either side write and exact `TradingRun.created_at ===
  preparation.committed_at`; an earlier preseeded deterministic role run fails before session
  preparation.
- Rejects before preparation: missing, duplicate, quarantined, or mismatched admission evidence;
  stale/missing/mismatched champion promotion or its exact stopped qualification
  evaluation/commitment/ordered observation chain; bootstrap while a promotion exists; same
  candidate version; same stored executable digest; and another active unordered pair.
- Rejects during replay/verification: same deterministic ID with changed exact CandidateVersion,
  SystemCode, admission, promotion/evaluation/commitment/observation closure, policy, market, or paper content; missing/duplicate/drifting
  persisted commitment/evaluation run-chain identity; nonzero pre-start evaluation state;
  incomplete graphs; full
  window-policy mismatch; invalid or pre-preparation side timestamps; non-inert persisted record
  shapes or full-Ref drift; and a provider identity with
  `qualification_eligible !== true` or any `ineligibility_reason`.

- [ ] **Step 1: Write failing coordinator preparation and no-effect tests**

Create `packages/application/src/trading/paper/comparison-coordinator.test.ts`. Build one fixture
champion and one materialized challenger with distinct SystemCode digests, an actual `LocalStore`,
an actual `PaperTradingSessionService`, and counting effect ports. The primary test is:

```ts
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type { OuroborosStorePort } from "../../ports/store";
import {
  decidePaperTradingQualification,
  paperTradingComparisonCandidateVersionDigestInput,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPreparationDigestInput,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingEvaluationCommitmentDigestInput
} from "@ouroboros/domain";
import type {
  CandidateAdmissionDecisionRecord,
  CandidateInspectReadModel,
  CandidateMaterializationInput,
  ExperimentRunRecord,
  PaperTradingAccountSnapshot,
  PaperTradingComparisonCommitmentRecord,
  PaperTradingComparisonPolicy,
  PaperTradingComparisonPreparationRecord,
  PaperTradingComparisonSide,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  PaperTradingObservationRecord,
  ResearchFindingRecord,
  SystemCodeRecord,
  TradingEvaluationResultRecord,
  TradingPromotionRecord,
  TradingRunRecord,
  TradingSystemCandidateRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, FIXTURE_SYSTEM_CODE_ID, LocalStore } from "@ouroboros/local-store";
import {
  PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1,
  paperTradingMarketDataConfigurationDigest
} from "./commitment";
import { PaperTradingEvaluationRunner } from "./evaluation-runner";
import { qualifyPaperTradingEvaluation } from "./qualification";
import { PaperTradingSessionService } from "./session-service";
import {
  PaperTradingComparisonCoordinator,
  type PreparePaperTradingComparisonInput,
  type VerifiedPaperTradingComparisonCommitmentGraph
} from "./comparison-coordinator";

it("prepares and verifies two inert qualification sides before sealing the pair", async () => {
  const fixture = await comparisonFixture();
  const championDefaultRunId = fixture.champion.runtime.ref.id;

  const prepared = await fixture.coordinator.prepare(fixture.input);

  expect("committedAt" in fixture.input).toBe(false);
  expect("committed_at" in fixture.input).toBe(false);
  expect(Object.keys(fixture.input)).not.toEqual(
    expect.arrayContaining(["committedAt", "committed_at"])
  );
  expect(prepared.preparation.committed_at).toBe("2026-07-10T00:00:10.000Z");
  expect(prepared.commitment.committed_at).toBe(prepared.preparation.committed_at);
  expect(prepared.champion.run.created_at).toBe(prepared.preparation.committed_at);
  expect(prepared.challenger.run.created_at).toBe(prepared.preparation.committed_at);
  expect(prepared.commitment).toMatchObject({
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: prepared.preparation.paper_trading_comparison_preparation_id
    },
    champion: { role: "champion" },
    challenger: { role: "challenger" },
    comparison_policy: fixture.input.comparisonPolicy,
    market_data_configuration_digest: fixture.input.marketDataConfigurationDigest,
    paper_policy_identity: fixture.input.paperPolicyIdentity,
    authority_status: "not_live"
  });
  expect(prepared.champion.run.trading_run_id)
    .not.toBe(prepared.challenger.run.trading_run_id);
  expect(prepared.champion.run.trading_run_id).not.toBe(championDefaultRunId);
  expect(prepared.champion.commitment).toMatchObject({
    evidence_purpose: "qualification",
    window_policy: { release_policy: "sealed_until_adjudication" }
  });
  expect(prepared.challenger.commitment).toMatchObject({
    evidence_purpose: "qualification",
    window_policy: { release_policy: "sealed_until_adjudication" }
  });
  expect(prepared.champion.evaluation.status).toBe("not_started");
  expect(prepared.challenger.evaluation.status).toBe("not_started");
  expect(fixture.runner.active(prepared.champion.run.trading_run_id)).toBe(false);
  expect(fixture.runner.active(prepared.challenger.run.trading_run_id)).toBe(false);
  expect(fixture.effects).toEqual({
    providerStarts: 0,
    sandboxStarts: 0,
    marketReads: 0
  });
  expect(prepared.champion.observations).toEqual([]);
  expect(prepared.challenger.observations).toEqual([]);
  expect((await fixture.store.getCandidate(fixture.champion.candidate_id))?.runtime.ref.id)
    .toBe(championDefaultRunId);
  expect((await fixture.store.getCandidateForTradingRun(
    prepared.champion.run.trading_run_id
  ))?.ledger?.has_activity).toBe(false);
  expect((await fixture.store.getCandidateForTradingRun(
    prepared.challenger.run.trading_run_id
  ))?.ledger?.has_activity).toBe(false);
});

it("prepares bootstrap selection only when no TradingPromotion exists", async () => {
  const fixture = await comparisonFixture({
    comparisonMode: "bootstrap",
    omitPromotion: true
  });

  const prepared = await fixture.coordinator.prepare(fixture.input);

  expect(prepared.preparation.champion_selection).toEqual({
    selection_kind: "bootstrap"
  });
  expect(prepared.commitment.champion_selection).toEqual({
    selection_kind: "bootstrap"
  });
  expect(prepared.verification).toEqual({
    status: "verified",
    activation_authority: "not_granted"
  });
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it("builds common admission and promotion fixtures accepted by current LocalStore predicates", async () => {
  const fixture = await comparisonFixture();

  await expect(fixture.store.getCandidateAdmissionDecision(
    fixture.championAdmission.candidate_admission_decision_id
  )).resolves.toEqual(fixture.championAdmission);
  await expect(fixture.store.getTradingPromotion(
    fixture.promotion.trading_promotion_id
  )).resolves.toEqual(fixture.promotion);
  await expect(fixture.store.getPaperTradingEvaluation(
    fixture.promotionEvidence.evaluation.paper_trading_evaluation_id
  )).resolves.toEqual(fixture.promotionEvidence.evaluation);
  await expect(fixture.store.listPaperTradingObservations(
    fixture.promotionEvidence.evaluation.paper_trading_evaluation_id
  )).resolves.toHaveLength(30);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});
```

The fixture must pass the pair policy as input rather than reading a coordinator constant:

```ts
const comparisonPolicy: PaperTradingComparisonPolicy = {
  policy_version: "paper-comparison-v1",
  comparison_mode: "champion_challenge",
  symbol: "BTCUSDT",
  interval_ms: 60_000,
  minimum_observation_count: 30,
  minimum_elapsed_ms: 1_800_000,
  maximum_observation_count: 120,
  maximum_elapsed_ms: 7_200_000,
  maximum_start_skew_ms: 5_000,
  maximum_provider_request_count_per_side: 500,
  maximum_retry_count_per_side: 3,
  primary_metric: "net_revenue_usdt",
  minimum_net_revenue_lift_usdt: 10,
  required_confirmation_count: 2,
  require_non_overlapping_windows: true,
  require_both_qualified: true,
  release_policy: "sealed_until_adjudication"
};
```

Consume the already-exported `paperTradingMarketDataConfigurationDigest` unchanged. Build the
session service and input from the same `marketData` object, use a `60_000` interval, and return
a distinct resolved digest for each SystemCode. The provider factory, sandbox start, and
market/public-execution reads increment the three counters and throw; successful preparation proves
none were called. The complete `comparisonFixture` below contains the sole
`PreparePaperTradingComparisonInput` construction, after champion, challenger, admissions, and
`marketData` are all in scope.

Define the complete fixture helpers in the new coordinator test:

`wrongPromotionEvaluationRef` records a second valid chain for the same champion and uses a
StorePort test proxy to return that alternate exact record when the canonical promotion evaluation
ID is requested. The promotion itself remains canonical, so coordinator rejection isolates its
promotion-to-evaluation Ref check before any preparation or side write.

```ts
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-comparison-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

interface ComparisonFixtureOptions {
  duplicateChallengerSystemCode?: boolean;
  championAdmissionStatus?: "admitted" | "duplicate" | "quarantined";
  comparisonMode?: "bootstrap" | "champion_challenge";
  omitPromotion?: boolean;
  mismatchPromotion?: boolean;
  futureChampionAdmission?: boolean;
  missingPromotionEvaluation?: boolean;
  wrongPromotionEvaluationRef?: boolean;
  futurePromotion?: boolean;
  preAdmissionQualification?: boolean;
  reversePromotionObservationTime?: boolean;
  challengerSystemCodeAfterAdmission?: boolean;
}

async function comparisonFixture(options: ComparisonFixtureOptions = {}) {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const champion = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!champion) {
    throw new Error("fixture champion was not materialized");
  }
  const challengerCode = options.duplicateChallengerSystemCode
    ? await store.getSystemCode(FIXTURE_SYSTEM_CODE_ID)
    : comparisonChallengerSystemCode(
        options.challengerSystemCodeAfterAdmission
          ? "2026-07-09T20:57:00.000Z"
          : "2026-07-09T20:50:00.000Z"
      );
  if (!challengerCode) {
    throw new Error("comparison challenger SystemCode was not found");
  }
  if (!options.duplicateChallengerSystemCode) {
    await store.recordSystemCode(challengerCode);
  }
  const challengerOutcome = await store.materializeCandidate(
    comparisonChallengerMaterializationInput(challengerCode.system_code_id)
  );
  if (challengerOutcome.status !== "materialized") {
    throw new Error("comparison challenger was not materialized");
  }
  const challenger = challengerOutcome.candidate;
  const championAdmission = await recordCoordinatorAdmissionEvidence(
    store,
    champion,
    "champion",
    options.championAdmissionStatus ?? "admitted",
    options.futureChampionAdmission
      ? "2026-07-10T00:00:11.000Z"
      : options.preAdmissionQualification
        ? "2026-07-09T21:15:00.000Z"
        : "2026-07-09T20:55:00.000Z"
  );
  const challengerAdmission = await recordCoordinatorAdmissionEvidence(
    store,
    challenger,
    "challenger",
    "admitted",
    "2026-07-09T20:56:00.000Z"
  );
  const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
  const marketData: GatewayMarketDataPort = {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://example.invalid",
    required_endpoints: ["GET /fapi/v1/exchangeInfo", "GET /fapi/v1/premiumIndex"],
    authority_status: "read_only",
    async readMarketSnapshot() {
      effects.marketReads += 1;
      throw new Error("comparison preparation read market data");
    },
    async readPublicMarketLivenessSurface() {
      effects.marketReads += 1;
      throw new Error("comparison preparation read market liveness");
    },
    async readPublicExecutionSnapshot() {
      effects.marketReads += 1;
      throw new Error("comparison preparation read public execution");
    }
  };
  const runner = new PaperTradingEvaluationRunner();
  const sessions = new PaperTradingSessionService({
    store,
    intervalMs: 60_000,
    runner,
    marketData,
    artifactResolver: {
      async resolveArtifactDigest(systemCode) {
        return `sha256:resolved-${systemCode.system_code_id}`;
      }
    },
    sandboxAdapters: {
      deterministic_test: {
        async startArtifactInstance() {
          effects.sandboxStarts += 1;
          throw new Error("comparison preparation started a sandbox");
        }
      }
    } as never,
    async apiProviderFactory() {
      effects.providerStarts += 1;
      throw new Error("comparison preparation started a provider");
    }
  });
  let promotionEvidence = await recordCoordinatorQualifiedPromotionEvidence(
    store,
    sessions,
    champion,
    "champion",
    "2026-07-09T21:00:00.000Z"
  );
  if (options.reversePromotionObservationTime) {
    promotionEvidence = await reverseCoordinatorQualificationObservationTime(
      store,
      promotionEvidence
    );
  }
  const alternateChampionPromotionEvidence = options.wrongPromotionEvaluationRef
    ? await recordCoordinatorQualifiedPromotionEvidence(
        store,
        sessions,
        champion,
        "alternate-champion-authority",
        "2026-07-09T21:00:00.000Z"
      )
    : undefined;
  const promotion: TradingPromotionRecord = {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "trading-promotion-coordinator-champion",
    status: "promoted_for_trading_review",
    candidate_ref: options.mismatchPromotion
      ? { record_kind: "trading_system_candidate", id: challenger.candidate_id }
      : { record_kind: "trading_system_candidate", id: champion.candidate_id },
    candidate_version_ref: options.mismatchPromotion
      ? {
          record_kind: "candidate_version",
          id: challenger.candidate_version.candidate_version_id
        }
      : {
          record_kind: "candidate_version",
          id: champion.candidate_version.candidate_version_id
        },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: promotionEvidence.evaluation.paper_trading_evaluation_id
    },
    promoted_at: options.futurePromotion
      ? "2026-07-10T00:00:11.000Z"
      : "2026-07-09T21:31:00.000Z",
    authority_status: "not_live"
  };
  if (options.missingPromotionEvaluation) {
    await rm(path.join(
      store.root(),
      "paper-trading-evaluations/items",
      `${encodeURIComponent(promotionEvidence.evaluation.paper_trading_evaluation_id)}.json`
    ), { force: true });
  }
  if (!options.omitPromotion) {
    await store.recordTradingPromotion(promotion);
  }
  const coordinatorStore = options.wrongPromotionEvaluationRef
    ? new Proxy(store, {
        get(target, property, receiver) {
          if (property === "getPaperTradingEvaluation") {
            return async (evaluationId: string) => evaluationId ===
              promotionEvidence.evaluation.paper_trading_evaluation_id
              ? structuredClone(alternateChampionPromotionEvidence!.evaluation)
              : target.getPaperTradingEvaluation(evaluationId);
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        }
      }) as OuroborosStorePort
    : store;
  const coordinator = new PaperTradingComparisonCoordinator({
    store: coordinatorStore,
    sessions,
    now: () => "2026-07-10T00:00:10.000Z"
  });
  const input: PreparePaperTradingComparisonInput = {
    idempotencyKey: "paper-comparison-coordinator-001",
    champion: {
      candidateId: champion.candidate_id,
      candidateVersionId: champion.candidate_version.candidate_version_id,
      admissionDecisionId: championAdmission.candidate_admission_decision_id
    },
    challenger: {
      candidateId: challenger.candidate_id,
      candidateVersionId: challenger.candidate_version.candidate_version_id,
      admissionDecisionId: challengerAdmission.candidate_admission_decision_id
    },
    comparisonPolicy: {
      ...comparisonPolicy,
      comparison_mode: options.comparisonMode ?? "champion_challenge"
    },
    marketDataConfigurationDigest: paperTradingMarketDataConfigurationDigest(marketData),
    paperPolicyIdentity: PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1
  };
  return {
    store,
    champion,
    challenger,
    championAdmission,
    challengerAdmission,
    promotion,
    promotionEvidence,
    alternateChampionPromotionEvidence,
    sessions,
    runner,
    coordinator,
    input,
    effects
  };
}

async function recordCoordinatorAdmissionEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel,
  suffix: "champion" | "challenger",
  status: "admitted" | "duplicate" | "quarantined",
  decidedAt: string
): Promise<CandidateAdmissionDecisionRecord> {
  const systemCodeId = candidate.system_code?.ref?.id;
  const systemCode = systemCodeId ? await store.getSystemCode(systemCodeId) : undefined;
  if (!systemCode) {
    throw new Error(`coordinator ${suffix} SystemCode was not found`);
  }
  const sourceDigest = status === "duplicate"
    ? systemCode.artifact_digest
    : `sha256:coordinator-admission-source-${suffix}`;
  const sourceSystemCode: SystemCodeRecord = {
    ...systemCode,
    system_code_id: `system-code-coordinator-admission-source-${suffix}`,
    artifact_digest: sourceDigest,
    provenance_refs: [],
    created_at: "2026-07-09T20:51:00.000Z"
  };
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-run-coordinator-admission-${suffix}`,
    research_worker_ref: {
      record_kind: "research_worker",
      id: `research-worker-coordinator-admission-${suffix}`
    },
    research_direction_ref: {
      record_kind: "research_direction",
      id: `research-direction-coordinator-admission-${suffix}`
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: `trading-evaluation-task-coordinator-admission-${suffix}`
    },
    trace_ref: {
      record_kind: "trace_placeholder",
      id: `trace-coordinator-admission-${suffix}`
    },
    submitted_at: "2026-07-09T20:52:00.000Z",
    status: "evaluated",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id:
      `trading-evaluation-result-coordinator-admission-${suffix}`,
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    evaluator_ref: {
      record_kind: "external_evaluator",
      id: "coordinator-admission-evaluator-v1"
    },
    result_status: status === "quarantined" ? "quarantined_for_review" : "accepted",
    evidence_disposition: "not_counted",
    score_summary: {
      total_score: 0.7,
      oos_score: 0.7,
      drawdown_score: 0.7,
      turnover_score: 0.7,
      cost_survival_score: 0.7,
      reproducibility_score: 0.7,
      complexity_penalty: 0
    },
    metric_refs: [{ record_kind: "metric_snapshot", id: `metric-admission-${suffix}` }],
    evaluator_trace_ref: {
      record_kind: "trace_placeholder",
      id: `evaluator-trace-coordinator-admission-${suffix}`
    },
    completed_at: "2026-07-09T20:53:00.000Z",
    authority_status: "not_counted"
  };
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `research-finding-coordinator-admission-${suffix}`,
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    finding_kind: "positive_result",
    summary: "Complete external admission evidence for coordinator qualification tests.",
    supporting_record_refs: [{
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    }],
    created_at: "2026-07-09T20:54:00.000Z",
    authority_status: "research_trace_only"
  };
  const admission: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: `candidate-admission-coordinator-${suffix}`,
    source_system_code_ref: {
      record_kind: "system_code",
      id: sourceSystemCode.system_code_id
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: { ...finding.trading_evaluation_result_ref },
    research_finding_ref: {
      record_kind: "research_finding",
      id: finding.research_finding_id
    },
    source_artifact_digest: sourceDigest,
    submitted_artifact_digest: systemCode.artifact_digest,
    research_worker_outcome: status === "duplicate" ? "unchanged" : "changed",
    experiment_status: "evaluated",
    evaluation_status: status === "quarantined" ? "quarantined_for_review" : "accepted",
    evidence_disposition: "not_counted",
    status,
    reason: status === "admitted"
      ? "evaluation_accepted"
      : status === "duplicate"
        ? "no_candidate_change"
        : "evaluation_quarantined",
    runnable_paper_handoff: status === "admitted",
    decided_at: decidedAt,
    authority_status: "not_live"
  };
  await store.recordSystemCode(sourceSystemCode);
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  await store.recordResearchFinding(finding);
  await store.recordCandidateAdmissionDecision(admission);
  return admission;
}

async function recordCoordinatorQualifiedPromotionEvidence(
  store: LocalStore,
  sessions: Pick<PaperTradingSessionService, "prepare">,
  candidate: CandidateInspectReadModel,
  suffix: string,
  startedAt: string
): Promise<{
  run: TradingRunRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}> {
  const run = await store.createPaperTradingRun({
    idempotency_key: `coordinator-promotion-evidence-${suffix}`,
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: startedAt
  });
  vi.useFakeTimers();
  vi.setSystemTime(startedAt);
  const prepared = await sessions.prepare({
    candidateId: candidate.candidate_id,
    candidateVersionId: candidate.candidate_version.candidate_version_id,
    tradingRunId: run.trading_run_id,
    evidencePurpose: "qualification",
    clock: "external"
  }).finally(() => vi.useRealTimers());
  let evaluation: PaperTradingEvaluationRecord = prepared.evaluation;
  const observations: PaperTradingObservationRecord[] = [];
  for (let sequence = 1; sequence <= 30; sequence += 1) {
    const observedAt = new Date(Date.parse(startedAt) + sequence * 60_000).toISOString();
    const observation: PaperTradingObservationRecord = {
      record_kind: "paper_trading_observation",
      version: 1,
      paper_trading_observation_id:
        `paper-observation-coordinator-promotion-${suffix}-${sequence}`,
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: evaluation.paper_trading_evaluation_id
      },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: prepared.commitment.paper_trading_evaluation_commitment_id
      },
      candidate_ref: { ...prepared.commitment.candidate_ref },
      candidate_version_ref: { ...prepared.commitment.candidate_version_ref },
      trading_run_ref: { ...prepared.commitment.trading_run_ref },
      sequence,
      status: "no_order",
      observed_at: observedAt,
      ...(sequence === 30
        ? {
            market_snapshot: {
              symbol: "BTCUSDT" as const,
              price: 60_000,
              observed_at: observedAt,
              source_kind: "binance_production_public_rest" as const,
              authority_status: "read_only" as const
            }
          }
        : {}),
      paper_account_snapshot: structuredClone(prepared.commitment.initial_account_snapshot),
      open_orders: [],
      processed_trading_system_event_ids: [],
      processed_public_trade_ids: [],
      score_delta: { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 },
      cumulative_score: { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 },
      authority_status: "not_live"
    };
    const { next_observation_at: _next, stopped_at: _stopped, ...previous } = evaluation;
    evaluation = {
      ...previous,
      status: sequence === 30 ? "stopped" : "running",
      observation_count: sequence,
      last_observed_at: observedAt,
      ...(sequence === 30
        ? { stopped_at: observedAt }
        : {
            next_observation_at: new Date(
              Date.parse(startedAt) + (sequence + 1) * 60_000
            ).toISOString()
          })
    };
    await store.recordPaperTradingObservation(observation, evaluation);
    observations.push(observation);
  }
  expect(qualifyPaperTradingEvaluation({
    evaluation,
    commitment: prepared.commitment,
    observations,
    runnerActive: false
  })).toMatchObject({
    qualification_status: "qualified",
    qualification_reasons: []
  });
  return { run, commitment: prepared.commitment, evaluation, observations };
}

async function reverseCoordinatorQualificationObservationTime(
  store: LocalStore,
  evidence: Awaited<ReturnType<typeof recordCoordinatorQualifiedPromotionEvidence>>
): Promise<Awaited<ReturnType<typeof recordCoordinatorQualifiedPromotionEvidence>>> {
  const observations = structuredClone(evidence.observations);
  const previous = observations[9];
  const current = observations[10];
  if (!previous || !current) {
    throw new Error("coordinator qualification fixture requires observations 10 and 11");
  }
  observations[10] = {
    ...current,
    observed_at: new Date(Date.parse(previous.observed_at) - 1_000).toISOString()
  };
  await writeCoordinatorRecord(
    store,
    "paper-trading-observations",
    current.paper_trading_observation_id,
    observations[10]
  );
  return { ...evidence, observations };
}

function comparisonChallengerSystemCode(
  createdAt = "2026-07-09T20:50:00.000Z"
): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "system-code-paper-comparison-challenger",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:paper-comparison-challenger",
    runtime_kind: "python",
    entrypoint: ["python3", "fixtures/trading-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "metric_snapshot"]
    },
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "secret-policy-no-raw-values-v1"
    },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-arena-paper-system-code"
    },
    provenance_refs: [{ record_kind: "research_finding", id: "comparison-challenger-finding" }],
    status: "registered",
    created_at: createdAt,
    authority_status: "not_live"
  };
}

function comparisonChallengerMaterializationInput(
  systemCodeId: string
): CandidateMaterializationInput {
  return {
    idempotency_key: "paper-comparison-coordinator-challenger",
    provider: {
      provider_kind: "fixture_only",
      model: "comparison-fixture",
      invocation_surface: "vitest",
      agent_run_id: "agent-run-comparison-challenger",
      agent_event_id: "agent-event-comparison-challenger",
      trace_id: "trace-comparison-challenger",
      output_artifact_hash: "sha256:comparison-challenger-output"
    },
    candidate: {
      title: "Paper comparison challenger",
      system_summary: "Distinct candidate for inert prospective paper comparison preparation.",
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: "Trade BTCUSDT through paper-only Gateway authority.",
      market: "Binance USD-M Futures",
      instrument: "BTCUSDT",
      supported_stage_binding_profiles: ["backtest", "paper"]
    },
    program: {
      summary: "Emit bounded TradingSystem paper events.",
      declared_runtime: "python-sandbox-fixture",
      declared_outputs: ["OrderRequest", "ProgramEvent", "Trace"]
    },
    capability_package: {
      summary: "Read-only public market context for paper evaluation.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_market_bars", "read_position_state"],
      forbidden_contents: ["exchange_credentials", "evaluator_hidden_labels", "live_order_authority"]
    },
    artifact_refs: [{ record_kind: "provider_output_artifact", id: "comparison-challenger-output" }],
    system_code_ref: { record_kind: "system_code", id: systemCodeId }
  };
}
```

- [ ] **Step 2: Add failing retry, duplicate, replay, active-pair, and reload tests**

Add these exact behavioral cases:

```ts
it("creates no side record until the atomic preparation reservation succeeds", async () => {
  const fixture = await comparisonFixture();
  let releaseReservation!: () => void;
  let markReservationEntered!: () => void;
  const reservationEntered = new Promise<void>((resolve) => {
    markReservationEntered = resolve;
  });
  const reservationRelease = new Promise<void>((resolve) => {
    releaseReservation = resolve;
  });
  const delayedStore = new Proxy(fixture.store, {
    get(target, property, receiver) {
      if (property === "reservePaperTradingComparisonPreparation") {
        return async (
          preparation: Parameters<
            OuroborosStorePort["reservePaperTradingComparisonPreparation"]
          >[0]
        ) => {
          markReservationEntered();
          await reservationRelease;
          return target.reservePaperTradingComparisonPreparation(preparation);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as OuroborosStorePort;
  const coordinator = new PaperTradingComparisonCoordinator({
    store: delayedStore,
    sessions: fixture.sessions,
    now: () => "2026-07-10T00:00:10.000Z"
  });

  const pending = coordinator.prepare(fixture.input);
  await reservationEntered;
  await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(fixture.store.listPaperTradingEvaluationCommitments())
    .resolves.toEqual([fixture.promotionEvidence.commitment]);
  await expect(fixture.store.listPaperTradingEvaluations())
    .resolves.toEqual([fixture.promotionEvidence.evaluation]);
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  releaseReservation();
  await expect(pending).resolves.toMatchObject({
    verification: { status: "verified", activation_authority: "not_granted" }
  });
});

it("creates no side record when the atomic preparation reservation rejects", async () => {
  const fixture = await comparisonFixture();
  const rejectedStore = new Proxy(fixture.store, {
    get(target, property, receiver) {
      if (property === "reservePaperTradingComparisonPreparation") {
        return async () => {
          throw new Error("injected_reservation_rejection");
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as OuroborosStorePort;
  const coordinator = new PaperTradingComparisonCoordinator({
    store: rejectedStore,
    sessions: fixture.sessions,
    now: () => "2026-07-10T00:00:10.000Z"
  });

  await expect(coordinator.prepare(fixture.input))
    .rejects.toThrow("injected_reservation_rejection");
  await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(fixture.store.listPaperTradingEvaluationCommitments())
    .resolves.toEqual([fixture.promotionEvidence.commitment]);
  await expect(fixture.store.listPaperTradingEvaluations())
    .resolves.toEqual([fixture.promotionEvidence.evaluation]);
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it("anchors intent before one-side failure and rejects policy drift before challenger writes", async () => {
  const fixture = await comparisonFixture();
  let failChallengerRun = true;
  const interruptedStore = new Proxy(fixture.store, {
    get(target, property, receiver) {
      if (property === "createPaperTradingRun") {
        return async (input: Parameters<OuroborosStorePort["createPaperTradingRun"]>[0]) => {
          if (
            failChallengerRun &&
            input.candidate_version_id === fixture.input.challenger.candidateVersionId
          ) {
            failChallengerRun = false;
            throw new Error("injected_challenger_run_failure");
          }
          return target.createPaperTradingRun(input);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as OuroborosStorePort;
  const interrupted = new PaperTradingComparisonCoordinator({
    store: interruptedStore,
    sessions: fixture.sessions,
    now: () => "2026-07-10T00:00:10.000Z"
  });

  await expect(interrupted.prepare(fixture.input))
    .rejects.toThrow("injected_challenger_run_failure");
  const [frozenPreparation] = await fixture.store.listPaperTradingComparisonPreparations();
  expect(frozenPreparation?.comparison_policy).toEqual(fixture.input.comparisonPolicy);
  expect(frozenPreparation?.committed_at).toBe("2026-07-10T00:00:10.000Z");
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  expect(await fixture.store.listPaperTradingEvaluationCommitments()).toHaveLength(2);
  expect(await fixture.store.listPaperTradingEvaluations()).toHaveLength(2);
  expect(await fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.challenger.candidateVersionId
  )).toHaveLength(1);

  const driftedRequests: PreparePaperTradingComparisonInput[] = [
    {
      ...fixture.input,
      champion: fixture.input.challenger,
      challenger: fixture.input.champion
    },
    {
      ...fixture.input,
      comparisonPolicy: {
        ...fixture.input.comparisonPolicy,
        minimum_net_revenue_lift_usdt: 11
      }
    },
    {
      ...fixture.input,
      marketDataConfigurationDigest: "sha256:changed-market-configuration"
    },
    {
      ...fixture.input,
      paperPolicyIdentity: {
        ...fixture.input.paperPolicyIdentity,
        cost_policy_version: "paper-cost-changed"
      }
    }
  ];
  for (const drifted of driftedRequests) {
    await expect(interrupted.prepare(drifted)).rejects.toMatchObject({
      code: "paper_trading_comparison_idempotency_conflict"
    });
  }
  expect(await fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.challenger.candidateVersionId
  )).toHaveLength(1);
  expect(await fixture.store.listPaperTradingEvaluationCommitments()).toHaveLength(2);

  let retryClockCalls = 0;
  const retry = new PaperTradingComparisonCoordinator({
    store: fixture.store,
    sessions: fixture.sessions,
    now: () => {
      retryClockCalls += 1;
      return "2026-07-10T00:05:00.000Z";
    }
  });
  const repaired = await retry.prepare(fixture.input);
  expect(repaired.preparation.committed_at).toBe(frozenPreparation!.committed_at);
  expect(repaired.commitment.committed_at).toBe(frozenPreparation!.committed_at);
  expect(retryClockCalls).toBe(0);
  expect(repaired.verification).toEqual({
    status: "verified",
    activation_authority: "not_granted"
  });
  expect(await fixture.store.listPaperTradingEvaluationCommitments()).toHaveLength(3);
  expect(await fixture.store.listPaperTradingEvaluations()).toHaveLength(3);
  expect(await fixture.store.listPaperTradingComparisonCommitments()).toHaveLength(1);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it("rejects a preseeded deterministic side run created before preparation", async () => {
  const fixture = await comparisonFixture();
  const suffix = createHash("sha256")
    .update(fixture.input.idempotencyKey)
    .digest("hex")
    .slice(0, 16);
  const comparisonId = `paper-trading-comparison-${suffix}`;
  const preseeded = await fixture.store.createPaperTradingRun({
    idempotency_key: `${comparisonId}:champion`,
    candidate_id: fixture.input.champion.candidateId,
    candidate_version_id: fixture.input.champion.candidateVersionId,
    evidence_purpose: "qualification",
    created_at: "2026-07-10T00:00:09.999Z"
  });

  await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
    code: "paper_trading_comparison_run_time_mismatch"
  });
  expect((await fixture.store.getTradingRun(preseeded.trading_run_id))?.created_at)
    .toBe("2026-07-10T00:00:09.999Z");
  await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toHaveLength(1);
  await expect(fixture.store.listPaperTradingEvaluationCommitments())
    .resolves.toEqual([fixture.promotionEvidence.commitment]);
  await expect(fixture.store.listPaperTradingEvaluations())
    .resolves.toEqual([fixture.promotionEvidence.evaluation]);
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it("rejects same-ID frozen content drift after one-side failure before another side write", async () => {
  const fixture = await comparisonFixture();
  let failChallengerRun = true;
  const interruptedStore = new Proxy(fixture.store, {
    get(target, property, receiver) {
      if (property === "createPaperTradingRun") {
        return async (input: Parameters<OuroborosStorePort["createPaperTradingRun"]>[0]) => {
          if (
            failChallengerRun &&
            input.candidate_version_id === fixture.input.challenger.candidateVersionId
          ) {
            failChallengerRun = false;
            throw new Error("injected_challenger_run_failure");
          }
          return target.createPaperTradingRun(input);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as OuroborosStorePort;
  const interrupted = new PaperTradingComparisonCoordinator({
    store: interruptedStore,
    sessions: fixture.sessions,
    now: () => "2026-07-10T00:00:10.000Z"
  });
  await expect(interrupted.prepare(fixture.input))
    .rejects.toThrow("injected_challenger_run_failure");
  const [preparation] = await fixture.store.listPaperTradingComparisonPreparations();
  const systemCode = (await fixture.store.getSystemCode(
    preparation!.champion.system_code_ref.id
  ))!;
  await writeFile(
    path.join(
      fixture.store.root(),
      "system-codes/items",
      `${encodeURIComponent(systemCode.system_code_id)}.json`
    ),
    `${JSON.stringify({
      ...systemCode,
      entrypoint: ["python3", "same-id-drifted.py"]
    }, null, 2)}\n`,
    "utf8"
  );
  const evaluationsBefore = await fixture.store.listPaperTradingEvaluations();

  await expect(interrupted.prepare(fixture.input)).rejects.toMatchObject({
    code: "paper_trading_comparison_frozen_record_digest_mismatch"
  });
  await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  expect(await fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.challenger.candidateVersionId
  )).toHaveLength(1);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it("allows exact replay and rejects deterministic-id or active-tuple conflicts", async () => {
  const fixture = await comparisonFixture();
  const first = await fixture.coordinator.prepare(fixture.input);
  await expect(fixture.coordinator.prepare(fixture.input)).resolves.toEqual(first);

  await expect(fixture.coordinator.prepare({
    ...fixture.input,
    comparisonPolicy: {
      ...fixture.input.comparisonPolicy,
      minimum_net_revenue_lift_usdt: 11
    }
  })).rejects.toMatchObject({ code: "paper_trading_comparison_idempotency_conflict" });

  await expect(fixture.coordinator.prepare({
    ...fixture.input,
    idempotencyKey: "paper-comparison-coordinator-active-conflict"
  })).rejects.toMatchObject({ code: "paper_trading_comparison_active_pair_conflict" });

  const swappedEvidence = await recordCoordinatorQualifiedPromotionEvidence(
    fixture.store,
    fixture.sessions,
    fixture.challenger,
    "role-swap",
    "2026-07-09T21:32:00.000Z"
  );
  await fixture.store.recordTradingPromotion({
    ...fixture.promotion,
    trading_promotion_id: "trading-promotion-coordinator-role-swap",
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: fixture.challenger.candidate_id
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: fixture.challenger.candidate_version.candidate_version_id
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: swappedEvidence.evaluation.paper_trading_evaluation_id
    },
    promoted_at: "2026-07-09T22:03:00.000Z"
  });
  await expect(fixture.coordinator.prepare({
    ...fixture.input,
    idempotencyKey: "paper-comparison-coordinator-reversed-active-conflict",
    champion: fixture.input.challenger,
    challenger: fixture.input.champion
  })).rejects.toMatchObject({ code: "paper_trading_comparison_active_pair_conflict" });
});

it("rejects distinct candidate versions that resolve to duplicate SystemCode bytes", async () => {
  const fixture = await comparisonFixture({ duplicateChallengerSystemCode: true });

  await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
    code: "paper_trading_comparison_duplicate_executable"
  });
  await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it("rejects the same CandidateVersion before creating side records", async () => {
  const fixture = await comparisonFixture();
  const runsBefore = await fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.champion.candidateVersionId
  );

  await expect(fixture.coordinator.prepare({
    ...fixture.input,
    challenger: fixture.input.champion
  })).rejects.toMatchObject({
    code: "paper_trading_comparison_duplicate_candidate_version"
  });

  await expect(fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.champion.candidateVersionId
  )).resolves.toEqual(runsBefore);
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it.each([
  ["duplicate admission", { championAdmissionStatus: "duplicate" }, "paper_trading_comparison_candidate_not_admitted"],
  ["quarantined admission", { championAdmissionStatus: "quarantined" }, "paper_trading_comparison_candidate_not_admitted"],
  ["future admission", { futureChampionAdmission: true }, "paper_trading_comparison_candidate_not_admitted"],
  ["missing promotion", { omitPromotion: true }, "paper_trading_comparison_champion_selection_mismatch"],
  ["mismatched promotion", { mismatchPromotion: true }, "paper_trading_comparison_champion_selection_mismatch"],
  ["missing promotion evaluation", { missingPromotionEvaluation: true }, "paper_trading_comparison_champion_selection_mismatch"],
  ["wrong promotion evaluation refs", { wrongPromotionEvaluationRef: true }, "paper_trading_comparison_champion_selection_mismatch"],
  ["future promotion", { futurePromotion: true }, "paper_trading_comparison_champion_selection_mismatch"],
  ["qualification before admission", { preAdmissionQualification: true }, "paper_trading_comparison_champion_selection_mismatch"],
  ["reversed promotion observation time", { reversePromotionObservationTime: true }, "paper_trading_comparison_champion_selection_mismatch"],
  ["challenger SystemCode after admission", { challengerSystemCodeAfterAdmission: true }, "paper_trading_comparison_candidate_not_admitted"],
  ["bootstrap with promotion", { comparisonMode: "bootstrap" }, "paper_trading_comparison_champion_selection_mismatch"]
] as const)(
  "rejects %s before preparation, sides, or effects",
  async (_label, options, expectedCode) => {
  const fixture = await comparisonFixture(options);
  const championRunsBefore = await fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.champion.candidateVersionId
  );
  const challengerRunsBefore = await fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.challenger.candidateVersionId
  );
  const commitmentsBefore = await fixture.store.listPaperTradingEvaluationCommitments();
  const evaluationsBefore = await fixture.store.listPaperTradingEvaluations();

  await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
    code: expectedCode
  });
  await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  await expect(fixture.store.listPaperTradingEvaluationCommitments())
    .resolves.toEqual(commitmentsBefore);
  await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
  await expect(fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.champion.candidateVersionId
  )).resolves.toEqual(championRunsBefore);
  await expect(fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.challenger.candidateVersionId
  )).resolves.toEqual(challengerRunsBefore);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  }
);

it("rejects an exact promotion/evaluation ref mismatch between same-champion chains", async () => {
  const fixture = await comparisonFixture({ wrongPromotionEvaluationRef: true });
  const alternate = fixture.alternateChampionPromotionEvidence;
  if (!alternate) {
    throw new Error("same-champion alternate promotion evidence was not built");
  }
  expect(alternate.commitment.candidate_ref).toEqual(
    fixture.promotionEvidence.commitment.candidate_ref
  );
  expect(alternate.commitment.candidate_version_ref).toEqual(
    fixture.promotionEvidence.commitment.candidate_version_ref
  );
  expect(alternate.commitment.system_code_ref).toEqual(
    fixture.promotionEvidence.commitment.system_code_ref
  );
  expect(fixture.promotion.paper_trading_evaluation_ref.id).toBe(
    fixture.promotionEvidence.evaluation.paper_trading_evaluation_id
  );
  const runsBefore = await fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.champion.candidateVersionId
  );
  const commitmentsBefore = await fixture.store.listPaperTradingEvaluationCommitments();
  const evaluationsBefore = await fixture.store.listPaperTradingEvaluations();

  await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
    code: "paper_trading_comparison_champion_selection_mismatch"
  });
  await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  await expect(fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.champion.candidateVersionId
  )).resolves.toEqual(runsBefore);
  await expect(fixture.store.listPaperTradingEvaluationCommitments())
    .resolves.toEqual(commitmentsBefore);
  await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it.each([
  ["reordered-account", "qualified", []],
  ["29-observations", "collecting_evidence", ["min_observation_count_not_met"]],
  ["29-elapsed-minutes", "collecting_evidence", ["min_elapsed_ms_not_met"]],
  ["30-observations-30-minutes", "qualified", []],
  ["3-of-30-failed", "qualified", []],
  ["4-of-30-failed", "blocked_by_quality", ["failed_observation_ratio_exceeded"]],
  ["missing-market", "blocked_by_quality", ["latest_market_snapshot_missing"]],
  ["accounting-discontinuity", "blocked_by_quality", ["paper_score_account_mismatch"]],
  ["unmatched-fill", "blocked_by_quality", ["fill_public_execution_evidence_missing"]],
  ["bad-self-digest", "not_qualification_evidence", ["paper_evaluation_commitment_missing"]]
] as const)("delegates one domain qualification decision: %s",
  async (kind, expectedStatus, expectedReasons) => {
  const fixture = await comparisonFixture();
  let commitment = structuredClone(fixture.promotionEvidence.commitment);
  const evaluation = structuredClone(fixture.promotionEvidence.evaluation);
  const observations = structuredClone(fixture.promotionEvidence.observations);
  if (kind === "reordered-account") {
    const account = evaluation.paper_account_snapshot;
    if (!account) {
      throw new Error("qualification parity fixture has no evaluation account");
    }
    const position = Object.fromEntries(
      Object.entries(account.position).reverse()
    ) as unknown as PaperTradingAccountSnapshot["position"];
    evaluation.paper_account_snapshot = Object.fromEntries(
      Object.entries(account).reverse().map(([key, value]) =>
        key === "position" ? [key, position] : [key, value]
      )
    ) as unknown as PaperTradingAccountSnapshot;
  } else if (kind === "29-observations") {
    observations.splice(29);
    const last = observations.at(-1)!;
    last.observed_at = new Date(
      Date.parse(evaluation.started_at) + 30 * 60_000
    ).toISOString();
    evaluation.observation_count = 29;
    evaluation.last_observed_at = last.observed_at;
    evaluation.stopped_at = last.observed_at;
  } else if (kind === "29-elapsed-minutes") {
    const last = observations.at(-1)!;
    last.observed_at = new Date(
      Date.parse(evaluation.started_at) + 29 * 60_000
    ).toISOString();
    evaluation.last_observed_at = last.observed_at;
    evaluation.stopped_at = last.observed_at;
  } else if (kind === "3-of-30-failed" || kind === "4-of-30-failed") {
    const failedCount = kind === "3-of-30-failed" ? 3 : 4;
    for (const observation of observations.slice(0, failedCount)) {
      observation.status = "failed";
      observation.failure_reason = "qualification parity failure";
    }
  } else if (kind === "missing-market") {
    for (const observation of observations) {
      delete observation.market_snapshot;
    }
  } else if (kind === "accounting-discontinuity") {
    observations[0]!.score_delta.revenue_usdt = 1;
    observations[0]!.cumulative_score.revenue_usdt = 1;
  } else if (kind === "unmatched-fill") {
    evaluation.latest_fill = {
      fill_id: "parity-fill-unmatched",
      order_id: "parity-order-unmatched",
      fill_status: "filled",
      fill_price: "60000",
      fill_quantity: "0.001",
      fee_usdt: "0",
      slippage_usdt: "0",
      funding_usdt: "0",
      trade_time: evaluation.stopped_at!,
      source_trade_id: "aggTrade:parity-unmatched"
    };
  } else if (kind === "bad-self-digest") {
    commitment = {
      ...commitment,
      data_identity: {
        ...commitment.data_identity,
        market_data_configuration_digest: "sha256:parity-self-digest-drift"
      }
    };
  }
  const selfDigestMatches = commitment.commitment_digest ===
    withCoordinatorCommitmentDigest({ ...commitment, commitment_digest: "" })
      .commitment_digest;
  const domainResult = decidePaperTradingQualification({
    commitment,
    evaluation,
    observations,
    runnerActive: false,
    commitmentDigestVerified: selfDigestMatches
  });
  const applicationResult = qualifyPaperTradingEvaluation({
    commitment,
    evaluation,
    observations,
    runnerActive: false
  });

  expect(applicationResult).toEqual(domainResult);
  expect(applicationResult.qualification_status).toBe(expectedStatus);
  expect(applicationResult.qualification_reasons).toEqual(expectedReasons);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  }
);

it.each(["ineligible-provider", "malformed-provider-model", "pre-start-outcome"] as const)(
  "rejects persisted same-ID semantic drift with recomputed digests: %s",
  async (drift) => {
  const fixture = await comparisonFixture();
  const prepared = await fixture.coordinator.prepare(fixture.input);
  if (drift === "ineligible-provider" || drift === "malformed-provider-model") {
    const changedCommitment = withCoordinatorCommitmentDigest({
      ...prepared.champion.commitment,
      provider_identity: drift === "ineligible-provider"
        ? {
            runtime_provider_kind: "none",
            qualification_eligible: false,
            ineligibility_reason: "provider_identity_unavailable"
          }
        : {
            runtime_provider_kind: "managed_agent",
            agent_profile_ref: { record_kind: "agent_profile", id: "codex" },
            model: {} as never,
            provider_configuration_digest: "sha256:provider-shape-test",
            qualification_eligible: true
          },
      commitment_digest: ""
    });
    const changedPair = withCoordinatorPairDigest({
      ...prepared.commitment,
      champion: {
        ...prepared.commitment.champion,
        paper_trading_evaluation_commitment_digest: changedCommitment.commitment_digest,
        paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(changedCommitment)
        )
      },
      commitment_digest: ""
    });
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluation-commitments",
      changedCommitment.paper_trading_evaluation_commitment_id,
      changedCommitment
    );
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-comparison-commitments",
      changedPair.paper_trading_comparison_commitment_id,
      changedPair
    );
  } else {
    const changedEvaluation: PaperTradingEvaluationRecord = {
      ...prepared.challenger.evaluation,
      latest_score: {
        revenue_usdt: 1,
        cost_usdt: 0,
        net_revenue_usdt: 1,
        net_return_pct: 0.0001
      },
      open_orders: [{
        order_id: "pre-start-order",
        event_id: "pre-start-event",
        side: "buy",
        order_type: "market",
        quantity: "0.001",
        status: "open",
        cumulative_filled_quantity: "0",
        remaining_quantity: "0.001",
        created_at: "2026-07-10T00:00:10.000Z",
        updated_at: "2026-07-10T00:00:10.000Z"
      }],
      next_observation_at: "2026-07-10T00:01:10.000Z"
    };
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluations",
      prepared.challenger.evaluation.paper_trading_evaluation_id,
      changedEvaluation
    );
    const changedPair = withCoordinatorPairDigest({
      ...prepared.commitment,
      challenger: {
        ...prepared.commitment.challenger,
        paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationRecordDigestInput(changedEvaluation)
        )
      },
      commitment_digest: ""
    });
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-comparison-commitments",
      changedPair.paper_trading_comparison_commitment_id,
      changedPair
    );
  }
  const mutationCalls: string[] = [];
  const readOnly = readOnlyStoreProxy(fixture.store, mutationCalls);
  const coordinator = new PaperTradingComparisonCoordinator({
    store: readOnly,
    sessions: sessionsPrepareMustNotRun()
  });

  await expect(coordinator.reload(
    prepared.commitment.paper_trading_comparison_commitment_id
  )).rejects.toMatchObject({
    code: "paper_trading_comparison_graph_invalid"
  });
  expect(mutationCalls).toEqual([]);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  }
);

it.each([
  "malformed-managed-provider",
  "wrong-system-code",
  "malformed-fill-source-trade-id",
  "malformed-public-execution-trade"
] as const)("rejects malformed champion qualification closure before preparation: %s", async (
  corruption
) => {
  const fixture = await comparisonFixture();
  const championRunsBefore = await fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.champion.candidateVersionId
  );
  const challengerRunsBefore = await fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.challenger.candidateVersionId
  );
  if (corruption === "malformed-managed-provider" || corruption === "wrong-system-code") {
    let changedCommitment: PaperTradingEvaluationCommitmentRecord;
    if (corruption === "malformed-managed-provider") {
      changedCommitment = withCoordinatorCommitmentDigest({
        ...fixture.promotionEvidence.commitment,
        provider_identity: {
          runtime_provider_kind: "managed_agent",
          agent_profile_ref: { record_kind: "agent_profile", id: "codex" },
          model: {} as never,
          provider_configuration_digest: "sha256:provider-shape-test",
          qualification_eligible: true
        },
        commitment_digest: ""
      });
    } else {
      const challengerSystemCodeRef = fixture.challenger.system_code?.ref;
      if (!challengerSystemCodeRef) {
        throw new Error("fixture challenger SystemCode ref was not materialized");
      }
      changedCommitment = withCoordinatorCommitmentDigest({
        ...fixture.promotionEvidence.commitment,
        system_code_ref: {
          record_kind: "system_code",
          id: challengerSystemCodeRef.id
        },
        commitment_digest: ""
      });
    }
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluation-commitments",
      changedCommitment.paper_trading_evaluation_commitment_id,
      changedCommitment
    );
  } else {
    const changedEvaluation: PaperTradingEvaluationRecord = {
      ...fixture.promotionEvidence.evaluation,
      ...(corruption === "malformed-fill-source-trade-id"
        ? {
            latest_fill: {
              fill_id: "promotion-fill-shape-test",
              order_id: "promotion-order-shape-test",
              fill_status: "filled" as const,
              fill_price: "60000",
              fill_quantity: "0.001",
              fee_usdt: "0",
              slippage_usdt: "0",
              funding_usdt: "0",
              trade_time: fixture.promotionEvidence.evaluation.stopped_at!,
              source_trade_id: {} as never
            }
          }
        : {
            latest_public_execution_snapshot: {
              symbol: "BTCUSDT" as const,
              observed_at: fixture.promotionEvidence.evaluation.stopped_at!,
              source_kind: "binance_production_public_rest" as const,
              stream_marker: "malformed-promotion-public-execution",
              agg_trades: [null as never],
              authority_status: "read_only" as const
            }
          })
    };
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluations",
      changedEvaluation.paper_trading_evaluation_id,
      changedEvaluation
    );
  }
  const commitmentsAfterCorruption =
    await fixture.store.listPaperTradingEvaluationCommitments();
  const evaluationsAfterCorruption = await fixture.store.listPaperTradingEvaluations();

  await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
    code: "paper_trading_comparison_champion_selection_mismatch"
  });
  await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  await expect(fixture.store.listPaperTradingEvaluationCommitments())
    .resolves.toEqual(commitmentsAfterCorruption);
  await expect(fixture.store.listPaperTradingEvaluations())
    .resolves.toEqual(evaluationsAfterCorruption);
  await expect(fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.champion.candidateVersionId
  )).resolves.toEqual(championRunsBefore);
  await expect(fixture.store.listTradingRunsForCandidateVersion(
    fixture.input.challenger.candidateVersionId
  )).resolves.toEqual(challengerRunsBefore);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it.each(["invalid-policy", "null-selection"] as const)(
  "rejects recomputed malformed preparation and pair before dereference: %s",
  async (corruption) => {
  const fixture = await comparisonFixture();
  const prepared = await fixture.coordinator.prepare(fixture.input);
  const changedPreparation = withCoordinatorPreparationDigest({
    ...prepared.preparation,
    ...(corruption === "invalid-policy"
      ? {
          comparison_policy: {
            ...prepared.preparation.comparison_policy,
            minimum_observation_count: 0
          }
        }
      : { champion_selection: null as never }),
    preparation_digest: ""
  });
  const changedPair = withCoordinatorPairDigest({
    ...prepared.commitment,
    ...(corruption === "invalid-policy"
      ? {
          comparison_policy: {
            ...prepared.commitment.comparison_policy,
            minimum_observation_count: 0
          }
        }
      : { champion_selection: null as never }),
    commitment_digest: ""
  });
  await writeCoordinatorRecord(
    fixture.store,
    "paper-trading-comparison-preparations",
    changedPreparation.paper_trading_comparison_preparation_id,
    changedPreparation
  );
  await writeCoordinatorRecord(
    fixture.store,
    "paper-trading-comparison-commitments",
    changedPair.paper_trading_comparison_commitment_id,
    changedPair
  );
  const mutationCalls: string[] = [];
  const coordinator = new PaperTradingComparisonCoordinator({
    store: readOnlyStoreProxy(fixture.store, mutationCalls),
    sessions: sessionsPrepareMustNotRun()
  });

  await expect(coordinator.reload(changedPair.paper_trading_comparison_commitment_id))
    .rejects.toMatchObject({ code: "paper_trading_comparison_graph_invalid" });
  await expect(coordinator.verify({
    ...prepared,
    preparation: changedPreparation,
    commitment: changedPair
  } as VerifiedPaperTradingComparisonCommitmentGraph)).rejects.toMatchObject({
    code: "paper_trading_comparison_graph_invalid"
  });
  expect(mutationCalls).toEqual([]);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  }
);

it.each([
  "candidate",
  "run",
  "system-code",
  "commitment",
  "evaluation",
  "observations"
] as const)("rejects malformed prepared-side %s before selection dereference", async (field) => {
  const fixture = await comparisonFixture();
  const prepared = await fixture.coordinator.prepare(fixture.input);
  const malformed = structuredClone(prepared) as VerifiedPaperTradingComparisonCommitmentGraph;
  if (field === "candidate") {
    malformed.champion.candidate = null as never;
  } else if (field === "run") {
    malformed.champion.run = null as never;
  } else if (field === "system-code") {
    malformed.champion.systemCode = {
      ...malformed.champion.systemCode,
      entrypoint: null as never
    };
  } else if (field === "commitment") {
    malformed.champion.commitment = {
      ...malformed.champion.commitment,
      provider_identity: null as never
    };
  } else if (field === "evaluation") {
    malformed.champion.evaluation = {
      ...malformed.champion.evaluation,
      latest_score: null as never
    };
  } else {
    malformed.champion.observations = [null as never];
  }
  const mutationCalls: string[] = [];
  const readCalls: string[] = [];
  const coordinator = new PaperTradingComparisonCoordinator({
    store: readOnlyStoreProxy(fixture.store, mutationCalls, readCalls),
    sessions: sessionsPrepareMustNotRun()
  });

  await expect(coordinator.verify(malformed)).rejects.toMatchObject({
    code: "paper_trading_comparison_graph_invalid"
  });
  expect(readCalls).not.toContain("getTradingPromotion");
  expect(mutationCalls).toEqual([]);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it("fails read-only reload after same-ID side timestamps change under unchanged pair bytes", async () => {
  const fixture = await comparisonFixture();
  const prepared = await fixture.coordinator.prepare(fixture.input);
  const pairBefore = await fixture.store.getPaperTradingComparisonCommitment(
    prepared.commitment.paper_trading_comparison_commitment_id
  );
  const rewrittenAt = "2026-07-10T00:00:10.001Z";
  const changedCommitment = withCoordinatorCommitmentDigest({
    ...prepared.champion.commitment,
    committed_at: rewrittenAt,
    commitment_digest: ""
  });
  await writeCoordinatorRecord(
    fixture.store,
    "paper-trading-evaluation-commitments",
    changedCommitment.paper_trading_evaluation_commitment_id,
    changedCommitment
  );
  await writeCoordinatorRecord(
    fixture.store,
    "paper-trading-evaluations",
    prepared.champion.evaluation.paper_trading_evaluation_id,
    { ...prepared.champion.evaluation, started_at: rewrittenAt }
  );
  await expect(fixture.store.getPaperTradingComparisonCommitment(
    prepared.commitment.paper_trading_comparison_commitment_id
  )).resolves.toEqual(pairBefore);
  expect(changedCommitment.commitment_digest)
    .toBe(prepared.champion.commitment.commitment_digest);

  const mutationCalls: string[] = [];
  const coordinator = new PaperTradingComparisonCoordinator({
    store: readOnlyStoreProxy(fixture.store, mutationCalls),
    sessions: sessionsPrepareMustNotRun()
  });
  await expect(coordinator.reload(
    prepared.commitment.paper_trading_comparison_commitment_id
  )).rejects.toMatchObject({ code: "paper_trading_comparison_graph_invalid" });
  expect(mutationCalls).toEqual([]);
});

it("rejects recomputed challenger SystemCode time after its frozen admission", async () => {
  const fixture = await comparisonFixture();
  const prepared = await fixture.coordinator.prepare(fixture.input);
  const changedSystemCode: SystemCodeRecord = {
    ...prepared.challenger.systemCode,
    created_at: "2026-07-09T20:56:00.001Z"
  };
  const changedSystemCodeDigest = comparisonExactRecordDigest(
    paperTradingComparisonSystemCodeRecordDigestInput(changedSystemCode)
  );
  const changedPreparation = withCoordinatorPreparationDigest({
    ...prepared.preparation,
    challenger: {
      ...prepared.preparation.challenger,
      system_code_record_digest: changedSystemCodeDigest
    },
    preparation_digest: ""
  });
  const changedPair = withCoordinatorPairDigest({
    ...prepared.commitment,
    challenger: {
      ...prepared.commitment.challenger,
      system_code_record_digest: changedSystemCodeDigest
    },
    commitment_digest: ""
  });
  await writeCoordinatorRecord(
    fixture.store,
    "system-codes",
    changedSystemCode.system_code_id,
    changedSystemCode
  );
  await writeCoordinatorRecord(
    fixture.store,
    "paper-trading-comparison-preparations",
    changedPreparation.paper_trading_comparison_preparation_id,
    changedPreparation
  );
  await writeCoordinatorRecord(
    fixture.store,
    "paper-trading-comparison-commitments",
    changedPair.paper_trading_comparison_commitment_id,
    changedPair
  );
  const mutationCalls: string[] = [];
  const coordinator = new PaperTradingComparisonCoordinator({
    store: readOnlyStoreProxy(fixture.store, mutationCalls),
    sessions: sessionsPrepareMustNotRun()
  });

  await expect(coordinator.reload(changedPair.paper_trading_comparison_commitment_id))
    .rejects.toMatchObject({ code: "paper_trading_comparison_graph_invalid" });
  await expect(coordinator.verify({
    ...prepared,
    preparation: changedPreparation,
    commitment: changedPair,
    challenger: { ...prepared.challenger, systemCode: changedSystemCode }
  })).rejects.toMatchObject({ code: "paper_trading_comparison_graph_invalid" });
  expect(mutationCalls).toEqual([]);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});
```

Add exact read-only reload failure tests. These use test-only files and must not add a production
mutation or recovery API:

```ts
it.each([
  "deleted-evaluation",
  "replacement-evaluation-id",
  "alternate-side-commitment",
  "alternate-side-commitment-evaluation-chain",
  "corrupt-side-commitment",
  "drifted-ref-kind",
  "drifted-bound-promotion",
  "drifted-promotion-evaluation",
  "drifted-promotion-commitment",
  "drifted-promotion-observation",
  "drifted-candidate",
  "drifted-candidate-version",
  "drifted-run",
  "drifted-system-code"
] as const)("fails closed without repair for %s", async (corruption) => {
  const fixture = await comparisonFixture();
  const prepared = await fixture.coordinator.prepare(fixture.input);
  const before = await persistedInertCounts(fixture.store, prepared);
  const evaluationPath = path.join(
    fixture.store.root(),
    "paper-trading-evaluations/items",
    `${encodeURIComponent(prepared.champion.evaluation.paper_trading_evaluation_id)}.json`
  );

  if (corruption === "replacement-evaluation-id") {
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluations",
      "paper-evaluation-readonly-replacement",
      {
        ...prepared.champion.evaluation,
        paper_trading_evaluation_id: "paper-evaluation-readonly-replacement"
      }
    );
    await rm(evaluationPath, { force: true });
  } else if (corruption === "deleted-evaluation") {
    await rm(evaluationPath, { force: true });
  } else if (corruption === "alternate-side-commitment" ||
    corruption === "alternate-side-commitment-evaluation-chain") {
    const alternateCommitment = withCoordinatorCommitmentDigest({
      ...prepared.champion.commitment,
      paper_trading_evaluation_commitment_id:
        `alternate-${prepared.champion.commitment.paper_trading_evaluation_commitment_id}`,
      commitment_digest: ""
    });
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluation-commitments",
      alternateCommitment.paper_trading_evaluation_commitment_id,
      alternateCommitment
    );
    if (corruption === "alternate-side-commitment-evaluation-chain") {
      const alternateEvaluation: PaperTradingEvaluationRecord = {
        ...prepared.champion.evaluation,
        paper_trading_evaluation_id:
          `alternate-${prepared.champion.evaluation.paper_trading_evaluation_id}`,
        paper_trading_evaluation_commitment_ref: {
          record_kind: "paper_trading_evaluation_commitment",
          id: alternateCommitment.paper_trading_evaluation_commitment_id
        }
      };
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-evaluations",
        alternateEvaluation.paper_trading_evaluation_id,
        alternateEvaluation
      );
    }
  } else if (corruption === "corrupt-side-commitment" ||
    corruption === "drifted-ref-kind") {
    const commitmentPath = path.join(
      fixture.store.root(),
      "paper-trading-evaluation-commitments/items",
      `${encodeURIComponent(
        prepared.champion.commitment.paper_trading_evaluation_commitment_id
      )}.json`
    );
    const commitment = JSON.parse(await readFile(commitmentPath, "utf8")) as
      PaperTradingEvaluationCommitmentRecord;
    const changedCommitment = withCoordinatorCommitmentDigest({
      ...commitment,
      ...(corruption === "corrupt-side-commitment"
        ? {
            provider_identity: {
              runtime_provider_kind: "none" as const,
              qualification_eligible: false,
              ineligibility_reason: "provider_identity_unavailable" as const
            }
          }
        : {
            candidate_ref: {
              record_kind: "same-id-wrong-kind",
              id: commitment.candidate_ref.id
            }
          }),
      commitment_digest: ""
    });
    const changedPair = withCoordinatorPairDigest({
      ...prepared.commitment,
      champion: {
        ...prepared.commitment.champion,
        paper_trading_evaluation_commitment_digest: changedCommitment.commitment_digest,
        paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(changedCommitment)
        )
      },
      commitment_digest: ""
    });
    await writeFile(commitmentPath, `${JSON.stringify(changedCommitment, null, 2)}\n`, "utf8");
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-comparison-commitments",
      changedPair.paper_trading_comparison_commitment_id,
      changedPair
    );
  } else if (corruption === "drifted-bound-promotion") {
    const selection = prepared.preparation.champion_selection;
    if (selection.selection_kind !== "trading_review") {
      throw new Error("fixture selection was not trading_review");
    }
    const promotion = (await fixture.store.getTradingPromotion(
      selection.trading_promotion_ref.id
    ))!;
    await writeFile(
      path.join(
        fixture.store.root(),
        "trading-promotions/items",
        `${encodeURIComponent(promotion.trading_promotion_id)}.json`
      ),
      `${JSON.stringify({
        ...promotion,
        paper_trading_evaluation_ref: {
          record_kind: "paper_trading_evaluation",
          id: "same-id-drifted-selection-evaluation"
        }
      }, null, 2)}\n`,
      "utf8"
    );
  } else if (corruption === "drifted-promotion-evaluation") {
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluations",
      fixture.promotionEvidence.evaluation.paper_trading_evaluation_id,
      {
        ...fixture.promotionEvidence.evaluation,
        latest_failure_reason: "same-id-promotion-evaluation-drift"
      }
    );
  } else if (corruption === "drifted-promotion-commitment") {
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluation-commitments",
      fixture.promotionEvidence.commitment.paper_trading_evaluation_commitment_id,
      {
        ...fixture.promotionEvidence.commitment,
        committed_at: "2026-07-09T21:00:00.001Z"
      }
    );
  } else if (corruption === "drifted-promotion-observation") {
    const last = fixture.promotionEvidence.observations.at(-1)!;
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-observations",
      last.paper_trading_observation_id,
      {
        ...last,
        market_snapshot: { ...last.market_snapshot!, price: 60_001 }
      }
    );
  } else if (corruption === "drifted-candidate") {
    const candidate = await readCoordinatorRecord<TradingSystemCandidateRecord>(
      fixture.store,
      "candidates",
      prepared.champion.side.candidate_ref.id
    );
    await writeCoordinatorRecord(
      fixture.store,
      "candidates",
      prepared.champion.side.candidate_ref.id,
      { ...candidate, candidate_id: "same-path-drifted-candidate-id" }
    );
  } else if (corruption === "drifted-run") {
    await writeCoordinatorRecord(
      fixture.store,
      "trading-runs",
      prepared.champion.run.trading_run_id,
      {
        ...prepared.champion.run,
        trace_ref: { record_kind: "trace_placeholder", id: "unexpected-prestart-trace" }
      }
    );
  } else if (corruption === "drifted-candidate-version") {
    const version = (await fixture.store.getCandidateVersion(
      prepared.champion.side.candidate_version_ref.id
    ))!;
    const changedVersion = {
      ...version,
      runtime_ref: { ...prepared.champion.side.trading_run_ref }
    };
    await writeCoordinatorRecord(
      fixture.store,
      "candidate-versions",
      version.candidate_version_id,
      changedVersion
    );
    await rewriteCoordinatorFrozenSideDigestForSemanticTest(
      fixture.store,
      prepared,
      {
        candidate_version_digest: comparisonExactRecordDigest(
          paperTradingComparisonCandidateVersionDigestInput(changedVersion)
        )
      }
    );
  } else {
    const changedSystemCode = {
      ...prepared.champion.systemCode,
      entrypoint: ["python3", "same-id-drifted-entrypoint.py"]
    };
    await writeCoordinatorRecord(
      fixture.store,
      "system-codes",
      prepared.champion.systemCode.system_code_id,
      changedSystemCode
    );
    await rewriteCoordinatorFrozenSideDigestForSemanticTest(
      fixture.store,
      prepared,
      {
        system_code_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonSystemCodeRecordDigestInput(changedSystemCode)
        )
      }
    );
  }
  const afterCorruption = await persistedInertCounts(fixture.store, prepared);

  const mutationCalls: string[] = [];
  const readOnlyReload = new PaperTradingComparisonCoordinator({
    store: readOnlyStoreProxy(fixture.store, mutationCalls),
    sessions: sessionsPrepareMustNotRun(),
    now: () => "2026-07-10T00:10:00.000Z"
  });
  await expect(readOnlyReload.reload(
    prepared.commitment.paper_trading_comparison_commitment_id
  )).rejects.toMatchObject({
    code: expect.stringMatching(/^paper_trading_comparison_/)
  });
  const after = await persistedInertCounts(fixture.store, prepared);
  expect(mutationCalls).toEqual([]);
  expect(after).toEqual(afterCorruption);
  expect(after.commitments).toBe(
    corruption === "alternate-side-commitment" ||
      corruption === "alternate-side-commitment-evaluation-chain"
      ? before.commitments + 1
      : before.commitments
  );
  expect(after.observations).toBe(before.observations);
  expect(after.runControlRefs).toBe(before.runControlRefs);
  if (corruption === "alternate-side-commitment-evaluation-chain") {
    expect(after.evaluations).toBe(before.evaluations + 1);
  } else {
    expect(after.evaluations).toBeLessThanOrEqual(before.evaluations);
  }
  if (corruption === "replacement-evaluation-id") {
    expect(await fixture.store.getPaperTradingEvaluation(
      "paper-evaluation-readonly-replacement"
    )).toBeDefined();
    expect(await fixture.store.getPaperTradingEvaluation(
      prepared.champion.side.paper_trading_evaluation_ref.id
    )).toBeUndefined();
  }
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it("fails closed when reload finds canonical pair drift", async () => {
  const fixture = await comparisonFixture();
  const prepared = await fixture.coordinator.prepare(fixture.input);
  const pairPath = path.join(
    tmpDir,
    "paper-trading-comparison-commitments/items",
    `${prepared.commitment.paper_trading_comparison_commitment_id}.json`
  );
  const persisted = JSON.parse(await readFile(pairPath, "utf8")) as
    PaperTradingComparisonCommitmentRecord;
  await writeFile(pairPath, `${JSON.stringify({
    ...persisted,
    comparison_policy: {
      ...persisted.comparison_policy,
      maximum_elapsed_ms: persisted.comparison_policy.maximum_elapsed_ms + 1
    }
  }, null, 2)}\n`, "utf8");

  const reloaded = new PaperTradingComparisonCoordinator({
    store: fixture.store,
    sessions: fixture.sessions
  });
  await expect(reloaded.reload(
    prepared.commitment.paper_trading_comparison_commitment_id
  )).rejects.toMatchObject({ code: "paper_trading_comparison_digest_mismatch" });
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

it("uses only StorePort reads for post-pair reload and verify", async () => {
  const fixture = await comparisonFixture();
  const prepared = await fixture.coordinator.prepare(fixture.input);
  const mutationCalls: string[] = [];
  const coordinator = new PaperTradingComparisonCoordinator({
    store: readOnlyStoreProxy(fixture.store, mutationCalls),
    sessions: sessionsPrepareMustNotRun()
  });

  const reloaded = await coordinator.reload(
    prepared.commitment.paper_trading_comparison_commitment_id
  );
  expect(reloaded).toBeDefined();
  await expect(coordinator.verify(reloaded!)).resolves.toEqual(reloaded);
  expect(mutationCalls).toEqual([]);
  expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
});

function readOnlyStoreProxy(
  store: OuroborosStorePort,
  mutationCalls: string[],
  readCalls: string[] = []
): OuroborosStorePort {
  const allowedReads = new Set<keyof OuroborosStorePort>([
    "getCandidateForTradingRun",
    "getCandidateVersion",
    "getCandidateAdmissionDecision",
    "getTradingRun",
    "getSystemCode",
    "getTradingPromotion",
    "getPaperTradingEvaluationCommitment",
    "getPaperTradingEvaluation",
    "getPaperTradingComparisonPreparation",
    "getPaperTradingComparisonCommitment",
    "listPaperTradingEvaluationCommitments",
    "listPaperTradingEvaluations",
    "listPaperTradingObservations"
  ]);
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || typeof value !== "function") {
        return value;
      }
      if (allowedReads.has(property as keyof OuroborosStorePort)) {
        readCalls.push(property);
        return value.bind(target);
      }
      return async () => {
        mutationCalls.push(property);
        throw new Error(`post_pair_mutation_attempt:${property}`);
      };
    }
  }) as OuroborosStorePort;
}

function sessionsPrepareMustNotRun(): Pick<PaperTradingSessionService, "prepare"> {
  return {
    async prepare() {
      throw new Error("post_pair_reload_called_sessions_prepare");
    }
  } as Pick<PaperTradingSessionService, "prepare">;
}

function withCoordinatorCommitmentDigest(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationCommitmentRecord {
  return {
    ...commitment,
    commitment_digest: `sha256:${createHash("sha256")
      .update(paperTradingEvaluationCommitmentDigestInput(commitment))
      .digest("hex")}`
  };
}

function comparisonExactRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function withCoordinatorPreparationDigest(
  preparation: PaperTradingComparisonPreparationRecord
): PaperTradingComparisonPreparationRecord {
  return {
    ...preparation,
    preparation_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonPreparationDigestInput(preparation))
      .digest("hex")}`
  };
}

function withCoordinatorPairDigest(
  commitment: PaperTradingComparisonCommitmentRecord
): PaperTradingComparisonCommitmentRecord {
  return {
    ...commitment,
    commitment_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonCommitmentDigestInput(commitment))
      .digest("hex")}`
  };
}

async function rewriteCoordinatorFrozenSideDigestForSemanticTest(
  store: LocalStore,
  graph: VerifiedPaperTradingComparisonCommitmentGraph,
  updates: Partial<PaperTradingComparisonSide>
): Promise<void> {
  const preparation = withCoordinatorPreparationDigest({
    ...graph.preparation,
    champion: { ...graph.preparation.champion, ...updates },
    preparation_digest: ""
  });
  const pair = withCoordinatorPairDigest({
    ...graph.commitment,
    champion: { ...graph.commitment.champion, ...updates },
    commitment_digest: ""
  });
  await writeCoordinatorRecord(
    store,
    "paper-trading-comparison-preparations",
    preparation.paper_trading_comparison_preparation_id,
    preparation
  );
  await writeCoordinatorRecord(
    store,
    "paper-trading-comparison-commitments",
    pair.paper_trading_comparison_commitment_id,
    pair
  );
}

async function writeCoordinatorRecord(
  store: LocalStore,
  collection: string,
  id: string,
  value: unknown
): Promise<void> {
  await writeFile(
    path.join(store.root(), collection, "items", `${encodeURIComponent(id)}.json`),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

async function readCoordinatorRecord<T>(
  store: LocalStore,
  collection: string,
  id: string
): Promise<T> {
  return JSON.parse(await readFile(
    path.join(store.root(), collection, "items", `${encodeURIComponent(id)}.json`),
    "utf8"
  )) as T;
}

async function persistedInertCounts(
  store: LocalStore,
  graph: VerifiedPaperTradingComparisonCommitmentGraph
): Promise<{
  commitments: number;
  evaluations: number;
  observations: number;
  runControlRefs: number;
}> {
  const runs = await Promise.all([
    store.getTradingRun(graph.champion.run.trading_run_id),
    store.getTradingRun(graph.challenger.run.trading_run_id)
  ]);
  const observations = await Promise.all([
    store.listPaperTradingObservations(graph.champion.evaluation.paper_trading_evaluation_id),
    store.listPaperTradingObservations(graph.challenger.evaluation.paper_trading_evaluation_id)
  ]);
  return {
    commitments: (await store.listPaperTradingEvaluationCommitments()).length,
    evaluations: (await store.listPaperTradingEvaluations()).length,
    observations: observations[0].length + observations[1].length,
    runControlRefs: runs.reduce((count, run) => count +
      (run?.run_control_command_refs?.length ?? 0) +
      (run?.run_control_decision_refs?.length ?? 0) +
      (run?.runtime_audit_event_refs?.length ?? 0), 0)
  };
}
```

- [ ] **Step 3: Run the coordinator test and confirm RED**

Run: `npx vitest run packages/application/src/trading/paper/comparison-coordinator.test.ts`

Expected: FAIL because the coordinator module and its interfaces do not exist.

- [ ] **Step 4: Define exact coordinator types and the prepare-only dependency**

Create `packages/application/src/trading/paper/comparison-coordinator.ts` with:

```ts
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  isCandidateAdmissionDecisionConsistent,
  paperTradingComparisonAdmissionDecisionDigestInput,
  paperTradingComparisonCandidateVersionDigestInput,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPreparationDigestInput,
  paperTradingComparisonPreparationHasRuntimeShape,
  paperTradingComparisonPolicyHasRuntimeShape,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonSideRecordsHaveInertShape,
  paperTradingComparisonSideHasRuntimeShape,
  paperTradingComparisonStoppedQualificationClosureHasRuntimeShape,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingComparisonTradingPromotionHasRuntimeShape,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingEvaluationCommitmentDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateInspectReadModel,
  type CandidateVersionRecord,
  type PaperTradingComparisonCandidateSide,
  type PaperTradingComparisonChampionSelection,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonPolicy,
  type PaperTradingComparisonPreparationRecord,
  type PaperTradingComparisonSide,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingEvaluationPolicyIdentity,
  type PaperTradingObservationRecord,
  type SystemCodeRecord,
  type TradingPromotionRecord,
  type TradingRunRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import type { PaperTradingSessionService } from "./session-service";
import { qualifyPaperTradingEvaluation } from "./qualification";

export interface PaperTradingComparisonCandidateInput {
  candidateId: string;
  candidateVersionId: string;
  admissionDecisionId: string;
}

export interface PreparePaperTradingComparisonInput {
  idempotencyKey: string;
  champion: PaperTradingComparisonCandidateInput;
  challenger: PaperTradingComparisonCandidateInput;
  comparisonPolicy: PaperTradingComparisonPolicy;
  marketDataConfigurationDigest: string;
  paperPolicyIdentity: PaperTradingEvaluationPolicyIdentity;
}

export interface PreparedPaperTradingComparisonSide {
  side: PaperTradingComparisonSide;
  candidate: CandidateInspectReadModel;
  run: TradingRunRecord;
  systemCode: SystemCodeRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}

export interface PreparedPaperTradingComparison {
  preparation: PaperTradingComparisonPreparationRecord;
  commitment: PaperTradingComparisonCommitmentRecord;
  champion: PreparedPaperTradingComparisonSide;
  challenger: PreparedPaperTradingComparisonSide;
}

export interface VerifiedPaperTradingComparisonCommitmentGraph
  extends PreparedPaperTradingComparison {
  verification: {
    status: "verified";
    activation_authority: "not_granted";
  };
}

export interface PaperTradingComparisonCoordinatorOptions {
  store: OuroborosStorePort;
  sessions: Pick<PaperTradingSessionService, "prepare">;
  now?: () => string;
}

interface ValidatedComparisonCandidate {
  side: PaperTradingComparisonCandidateSide;
  candidateVersion: CandidateVersionRecord;
  admission: CandidateAdmissionDecisionRecord;
  systemCode: SystemCodeRecord;
}

export class PaperTradingComparisonError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingComparisonError";
  }
}

export class PaperTradingComparisonCoordinator {
  private readonly now: () => string;

  constructor(private readonly options: PaperTradingComparisonCoordinatorOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }
}
```

Do not inject `GatewayMarketDataPort`, a provider factory, sandbox adapters, a runner, or the full
effectful session service surface into this coordinator.

`PreparePaperTradingComparisonInput` intentionally has no `committedAt`, `committed_at`,
`championSelection`, or promotion-ref field. Time and champion-role authority are server-owned and
resolved before the first durable write; public command payloads gain none of these fields.

The existing `paperTradingMarketDataConfigurationDigest` export in `commitment.ts` is consumed by
the test fixture unchanged; Task 4 does not edit that module.

- [ ] **Step 5: Implement deterministic prepare and pair construction**

Derive both future record IDs from the idempotency key with SHA-256, not lossy string
normalization. The preparation digest includes the future pair ID and frozen server timestamp:

```ts
function comparisonPreparationDigest(
  record: PaperTradingComparisonPreparationRecord
): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonPreparationDigestInput(record))
    .digest("hex")}`;
}

function comparisonCommitmentDigest(
  record: PaperTradingComparisonCommitmentRecord
): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonCommitmentDigestInput(record))
    .digest("hex")}`;
}

function comparisonExactRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function comparisonIds(idempotencyKey: string): {
  preparationId: string;
  commitmentId: string;
} {
  if (!idempotencyKey.trim()) {
    throw new PaperTradingComparisonError(
      "invalid_paper_trading_comparison_input",
      "Paper comparison idempotency key is required."
    );
  }
  const suffix = createHash("sha256")
    .update(idempotencyKey)
    .digest("hex")
    .slice(0, 16);
  return {
    preparationId: `paper-trading-comparison-preparation-${suffix}`,
    commitmentId: `paper-trading-comparison-${suffix}`
  };
}

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

```

`prepare` validates exact admission and current champion-selection authority before the first
preparation write. An existing deterministic preparation is compared to every caller-controlled
field and replayed through the store validator; the coordinator does not call `now()` again. A new
preparation freezes `now()`, both exact admission refs, the bound promotion selection, the explicit
pair policy, market digest, and paper identity before either role-specific TradingRun exists.
StorePort owns unordered-pair exclusion over all still-active preparations; `LocalStore` serializes
the complete authority-evidence currentness/read/append reservation against every relevant
authority writer, so concurrent coordinator calls cannot both reserve the same pair and no side
write can begin until reservation success:

```ts
async prepare(
  input: PreparePaperTradingComparisonInput
): Promise<VerifiedPaperTradingComparisonCommitmentGraph> {
  if (!paperTradingComparisonPolicyHasRuntimeShape(input.comparisonPolicy)) {
    throw new PaperTradingComparisonError(
      "invalid_paper_trading_comparison_input",
      "Paper comparison policy has invalid runtime shape."
    );
  }
  if (input.champion.candidateVersionId === input.challenger.candidateVersionId) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_duplicate_candidate_version",
      "Champion and challenger CandidateVersions must be distinct."
    );
  }
  const ids = comparisonIds(input.idempotencyKey);
  let preparation = await this.options.store.getPaperTradingComparisonPreparation(
    ids.preparationId
  );
  if (preparation) {
    if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Persisted paper comparison preparation has invalid runtime shape."
      );
    }
    this.assertRequestedPreparationIdentity(preparation, ids.commitmentId, input);
    await this.assertFrozenPreparationRecords(preparation);
    preparation = await this.options.store.reservePaperTradingComparisonPreparation(preparation);
    if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Reserved paper comparison preparation has invalid runtime shape."
      );
    }
    const existingPair = await this.options.store.getPaperTradingComparisonCommitment(
      ids.commitmentId
    );
    if (existingPair) {
      const graph = await this.reload(ids.commitmentId);
      if (!graph) {
        throw new PaperTradingComparisonError(
          "paper_trading_comparison_reload_failed",
          "Persisted paper comparison commitment could not be reloaded."
        );
      }
      return graph;
    }
  } else {
    const committedAt = this.now();
    if (!isExactIsoTimestamp(committedAt)) {
      throw new PaperTradingComparisonError(
        "invalid_paper_trading_comparison_input",
        "Paper comparison server clock must return an exact ISO timestamp."
      );
    }
    const [championCandidate, challengerCandidate] = await Promise.all([
      this.validateCandidateSide("champion", input.champion, committedAt),
      this.validateCandidateSide("challenger", input.challenger, committedAt)
    ]);
    if (
      championCandidate.systemCode.artifact_digest ===
        challengerCandidate.systemCode.artifact_digest
    ) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_duplicate_executable",
        "Champion and challenger freeze the same stored SystemCode bytes."
      );
    }
    const championSelection = await this.resolveChampionSelection(
      input.comparisonPolicy.comparison_mode,
      championCandidate,
      committedAt
    );
    const withoutDigest: PaperTradingComparisonPreparationRecord = {
      record_kind: "paper_trading_comparison_preparation",
      version: 1,
      paper_trading_comparison_preparation_id: ids.preparationId,
      paper_trading_comparison_commitment_id: ids.commitmentId,
      champion: championCandidate.side,
      challenger: challengerCandidate.side,
      champion_selection: championSelection,
      comparison_policy: structuredClone(input.comparisonPolicy),
      market_data_configuration_digest: input.marketDataConfigurationDigest,
      paper_policy_identity: structuredClone(input.paperPolicyIdentity),
      committed_at: committedAt,
      preparation_digest: "",
      authority_status: "not_live"
    };
    preparation = await this.options.store.reservePaperTradingComparisonPreparation({
      ...withoutDigest,
      preparation_digest: comparisonPreparationDigest(withoutDigest)
    });
  }

  if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison preparation has invalid runtime shape."
    );
  }

  const champion = await this.prepareSide(
    ids.commitmentId,
    preparation.champion,
    preparation.committed_at
  );
  const challenger = await this.prepareSide(
    ids.commitmentId,
    preparation.challenger,
    preparation.committed_at
  );
  if (
    champion.commitment.resolved_artifact_digest ===
      challenger.commitment.resolved_artifact_digest
  ) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_duplicate_executable",
      "Champion and challenger resolve to the same executable bytes."
    );
  }

  const withoutDigest: PaperTradingComparisonCommitmentRecord = {
    record_kind: "paper_trading_comparison_commitment",
    version: 1,
    paper_trading_comparison_commitment_id:
      preparation.paper_trading_comparison_commitment_id,
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: preparation.paper_trading_comparison_preparation_id
    },
    champion: champion.side,
    challenger: challenger.side,
    champion_selection: structuredClone(preparation.champion_selection),
    comparison_policy: structuredClone(preparation.comparison_policy),
    market_data_configuration_digest: preparation.market_data_configuration_digest,
    paper_policy_identity: structuredClone(preparation.paper_policy_identity),
    committed_at: preparation.committed_at,
    commitment_digest: "",
    authority_status: "not_live"
  };
  const commitment = {
    ...withoutDigest,
    commitment_digest: comparisonCommitmentDigest(withoutDigest)
  };
  await this.options.store.recordPaperTradingComparisonCommitment(commitment);
  const reloaded = await this.reload(ids.commitmentId);
  if (!reloaded) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_reload_failed",
      "Persisted paper comparison commitment could not be reloaded."
    );
  }
  this.assertRequestedPreparationIdentity(reloaded.preparation, ids.commitmentId, input);
  return reloaded;
}
```

Before creating either side, use the exact candidate/admission and current selection helpers below.
The store repeats these checks independently when the preparation is appended:

```ts
private async validateCandidateSide(
  role: "champion" | "challenger",
  input: PaperTradingComparisonCandidateInput,
  committedAt: string
): Promise<ValidatedComparisonCandidate> {
  const [candidateVersion, admission] = await Promise.all([
    this.options.store.getCandidateVersion(input.candidateVersionId),
    this.options.store.getCandidateAdmissionDecision(input.admissionDecisionId)
  ]);
  const systemCodeRef = candidateVersion?.system_code_ref;
  const systemCode = systemCodeRef
    ? await this.options.store.getSystemCode(systemCodeRef.id)
    : undefined;
  const admitted = candidateVersion && admission && systemCode &&
    candidateVersion.candidate_id === input.candidateId &&
    candidateVersion.candidate_version_id === input.candidateVersionId &&
    paperTradingComparisonRefsEqual(
      candidateVersion.system_code_ref,
      { record_kind: systemCode.record_kind, id: systemCode.system_code_id }
    ) &&
    admission.status === "admitted" &&
    admission.runnable_paper_handoff === true &&
    admission.authority_status === "not_live" &&
    isCandidateAdmissionDecisionConsistent(admission) &&
    isExactIsoTimestamp(systemCode.created_at) &&
    isExactIsoTimestamp(admission.decided_at) &&
    Date.parse(systemCode.created_at) <= Date.parse(admission.decided_at) &&
    Date.parse(admission.decided_at) <= Date.parse(committedAt) &&
    paperTradingComparisonRefsEqual(
      admission.system_code_ref,
      { record_kind: systemCode.record_kind, id: systemCode.system_code_id }
    ) &&
    admission.submitted_artifact_digest === systemCode.artifact_digest;
  if (!admitted) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_candidate_not_admitted",
      "Paper comparison candidates require exact admitted frozen SystemCode evidence."
    );
  }
  return {
    candidateVersion,
    admission,
    systemCode,
    side: {
      role,
      candidate_ref: { record_kind: "trading_system_candidate", id: input.candidateId },
      candidate_version_ref: { record_kind: "candidate_version", id: input.candidateVersionId },
      candidate_version_digest: comparisonExactRecordDigest(
        paperTradingComparisonCandidateVersionDigestInput(candidateVersion)
      ),
      system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
      system_code_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonSystemCodeRecordDigestInput(systemCode)
      ),
      system_code_artifact_digest: systemCode.artifact_digest,
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: input.admissionDecisionId
      },
      admission_decision_digest: comparisonExactRecordDigest(
        paperTradingComparisonAdmissionDecisionDigestInput(admission)
      )
    }
  };
}

private async resolveChampionSelection(
  mode: PaperTradingComparisonPolicy["comparison_mode"],
  champion: ValidatedComparisonCandidate,
  committedAt: string
): Promise<PaperTradingComparisonChampionSelection> {
  const latest = await this.options.store.getLatestTradingPromotion();
  if (mode === "bootstrap") {
    if (latest) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_champion_selection_mismatch",
        "Bootstrap comparison requires no current TradingPromotion."
      );
    }
    return { selection_kind: "bootstrap" };
  }
  if (!latest) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_champion_selection_mismatch",
      "Champion challenge requires the exact current TradingPromotion."
    );
  }
  const evidence = await this.loadQualifiedPromotionAuthority(
    latest,
    champion,
    committedAt
  );
  return {
    selection_kind: "trading_review",
    trading_promotion_ref: {
      record_kind: "trading_promotion",
      id: latest.trading_promotion_id
    },
    trading_promotion_digest: comparisonExactRecordDigest(
      paperTradingComparisonTradingPromotionDigestInput(latest)
    ),
    paper_trading_evaluation_ref: { ...latest.paper_trading_evaluation_ref },
    paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonEvaluationRecordDigestInput(evidence.evaluation)
    ),
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: evidence.commitment.paper_trading_evaluation_commitment_id
    },
    paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonEvaluationCommitmentRecordDigestInput(evidence.commitment)
    ),
    paper_trading_observation_chain_digest: comparisonExactRecordDigest(
      paperTradingComparisonObservationChainDigestInput(evidence.observations)
    )
  };
}

private async loadQualifiedPromotionAuthority(
  promotion: TradingPromotionRecord,
  champion: ValidatedComparisonCandidate,
  committedAt: string
): Promise<{
  evaluation: PaperTradingEvaluationRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  observations: PaperTradingObservationRecord[];
}> {
  if (!paperTradingComparisonTradingPromotionHasRuntimeShape(promotion)) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_champion_selection_mismatch",
      "TradingPromotion has invalid persisted shape."
    );
  }
  const evaluation = await this.options.store.getPaperTradingEvaluation(
    promotion.paper_trading_evaluation_ref.id
  );
  const commitment = evaluation?.paper_trading_evaluation_commitment_ref
    ? await this.options.store.getPaperTradingEvaluationCommitment(
        evaluation.paper_trading_evaluation_commitment_ref.id
      )
    : undefined;
  const observations = evaluation
    ? await this.options.store.listPaperTradingObservations(
        evaluation.paper_trading_evaluation_id
      )
    : [];
  if (!evaluation || !commitment ||
    !paperTradingComparisonStoppedQualificationClosureHasRuntimeShape({
      systemCode: champion.systemCode,
      admission: champion.admission,
      commitment,
      evaluation,
      observations,
      promotion,
      preparationCommittedAt: committedAt
    })) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_champion_selection_mismatch",
      "TradingPromotion qualification evidence is missing or malformed."
    );
  }
  const ordered = [...observations].sort((left, right) =>
    left.sequence - right.sequence ||
    left.paper_trading_observation_id.localeCompare(right.paper_trading_observation_id)
  );
  const refsMatch =
    paperTradingComparisonRefsEqual(promotion.candidate_ref, champion.side.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      promotion.candidate_version_ref,
      champion.side.candidate_version_ref
    );
  const commitmentSelfDigestMatches = commitment.commitment_digest ===
    `sha256:${createHash("sha256")
      .update(paperTradingEvaluationCommitmentDigestInput(commitment))
      .digest("hex")}`;
  const qualification = qualifyPaperTradingEvaluation({
    evaluation,
    commitment,
    observations: ordered,
    runnerActive: false
  });
  if (!refsMatch || !commitmentSelfDigestMatches ||
    qualification.qualification_status !== "qualified") {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_champion_selection_mismatch",
      "TradingPromotion must reference a causally prior stopped qualified paper evaluation."
    );
  }
  return { evaluation, commitment, observations: ordered };
}
```

`prepareSide` must use idempotency key `${comparisonId}:${role}`, `evidence_purpose:
"qualification"`, the persisted candidate IDs, and `created_at: preparation.committed_at`; then call
`sessions.prepare` with `evidencePurpose: "qualification"` and `clock: "external"`. Build the side
only from the returned commitment/evaluation refs, then convert it immediately through the
read-only exact `reloadSide` loader. Never retain `PreparedPaperTradingSession` in the comparison
graph and never use the candidate's default runtime ref.

```ts
private async prepareSide(
  comparisonId: string,
  candidate: PaperTradingComparisonCandidateSide,
  persistedCommittedAt: string
): Promise<PreparedPaperTradingComparisonSide> {
  const run = await this.options.store.createPaperTradingRun({
    idempotency_key: `${comparisonId}:${candidate.role}`,
    candidate_id: candidate.candidate_ref.id,
    candidate_version_id: candidate.candidate_version_ref.id,
    evidence_purpose: "qualification",
    created_at: persistedCommittedAt
  });
  if (!isExactIsoTimestamp(run.created_at ?? "") || run.created_at !== persistedCommittedAt) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_run_time_mismatch",
      "Qualification TradingRun must start at the frozen preparation timestamp."
    );
  }
  const session = await this.options.sessions.prepare({
    candidateId: candidate.candidate_ref.id,
    candidateVersionId: candidate.candidate_version_ref.id,
    tradingRunId: run.trading_run_id,
    evidencePurpose: "qualification",
    clock: "external"
  });
  const side: PaperTradingComparisonSide = {
    ...structuredClone(candidate),
    trading_run_ref: { ...session.commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: session.commitment.paper_trading_evaluation_commitment_id
    },
    paper_trading_evaluation_commitment_digest: session.commitment.commitment_digest,
    paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonEvaluationCommitmentRecordDigestInput(session.commitment)
    ),
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: session.evaluation.paper_trading_evaluation_id
    },
    paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonEvaluationRecordDigestInput(session.evaluation)
    )
  };
  return this.reloadSide(side, candidate.role);
}
```

- [ ] **Step 6: Implement exact reload and coordinator verification**

`reload(comparisonId)` loads only the persisted pair, preparation, and exact side records through
StorePort reads, then passes that graph to `verify`. It does not prepare, repair, invalidate,
replace, activate, or scan for resumable pairs:

```ts
async reload(
  comparisonId: string
): Promise<VerifiedPaperTradingComparisonCommitmentGraph | undefined> {
  const commitment = await this.options.store
    .getPaperTradingComparisonCommitment(comparisonId);
  if (!commitment) {
    return undefined;
  }
  if (!paperTradingComparisonCommitmentHasRuntimeShape(commitment)) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison commitment has invalid persisted shape."
    );
  }
  if (commitment.commitment_digest !== comparisonCommitmentDigest(commitment)) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_digest_mismatch",
      "Paper comparison canonical content changed."
    );
  }
  const preparation = await this.options.store.getPaperTradingComparisonPreparation(
    commitment.preparation_ref.id
  );
  if (!preparation) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_incomplete",
      "Paper comparison preparation is missing."
    );
  }
  if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison preparation has invalid persisted shape."
    );
  }
  if (preparation.preparation_digest !== comparisonPreparationDigest(preparation)) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_digest_mismatch",
      "Paper comparison preparation canonical content changed."
    );
  }
  const champion = await this.reloadSide(commitment.champion, "champion");
  const challenger = await this.reloadSide(commitment.challenger, "challenger");
  return this.verify({ preparation, commitment, champion, challenger });
}
```

Reload each side from exact persisted refs, then scan every paper commitment and evaluation by
full `trading_run_ref`. The bound deterministic commitment and evaluation IDs must form the only
chain for that run; an alternate commitment, evaluation, or alternate chain fails closed:

```ts
private async reloadSide(
  side: unknown,
  expectedRole: "champion" | "challenger"
): Promise<PreparedPaperTradingComparisonSide> {
  if (!paperTradingComparisonSideHasRuntimeShape(side, expectedRole)) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison side has invalid persisted shape."
    );
  }
  const [candidate, run, systemCode, commitment, evaluation,
    allCommitments, allEvaluations, observations] = await Promise.all([
    this.options.store.getCandidateForTradingRun(side.trading_run_ref.id),
    this.options.store.getTradingRun(side.trading_run_ref.id),
    this.options.store.getSystemCode(side.system_code_ref.id),
    this.options.store.getPaperTradingEvaluationCommitment(
      side.paper_trading_evaluation_commitment_ref.id
    ),
    this.options.store.getPaperTradingEvaluation(side.paper_trading_evaluation_ref.id),
    this.options.store.listPaperTradingEvaluationCommitments(),
    this.options.store.listPaperTradingEvaluations(),
    this.options.store.listPaperTradingObservations(side.paper_trading_evaluation_ref.id)
  ]);
  if (!candidate || !run || !systemCode || !commitment || !evaluation) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_incomplete",
      "Paper comparison side candidate, run, SystemCode, commitment, or evaluation was not found."
    );
  }
  const persistedField = (value: unknown, key: string): unknown =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)[key]
      : undefined;
  const commitmentsForRun = allCommitments.filter((record) =>
    paperTradingComparisonRefsEqual(
      persistedField(record, "trading_run_ref"),
      side.trading_run_ref
    ));
  const evaluationsForRun = allEvaluations
    .filter((record) => paperTradingComparisonRefsEqual(
      persistedField(record, "trading_run_ref"),
      side.trading_run_ref
    ));
  if (
    commitmentsForRun.length !== 1 ||
    persistedField(
      commitmentsForRun[0],
      "paper_trading_evaluation_commitment_id"
    ) !==
      side.paper_trading_evaluation_commitment_ref.id ||
    evaluationsForRun.length !== 1 ||
    persistedField(evaluationsForRun[0], "paper_trading_evaluation_id") !==
      side.paper_trading_evaluation_ref.id ||
    !paperTradingComparisonRefsEqual(
      persistedField(
        evaluationsForRun[0],
        "paper_trading_evaluation_commitment_ref"
      ),
      side.paper_trading_evaluation_commitment_ref
    )
  ) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison side must bind the sole commitment/evaluation chain for its run."
    );
  }
  return {
    side: structuredClone(side),
    candidate,
    run,
    systemCode,
    commitment,
    evaluation,
    observations
  };
}
```

`verify(graph)` first validates only the top-level pair/preparation and side refs needed for exact
StorePort reads. Immediately after loading each exact CandidateVersion and admission, it applies
`paperTradingComparisonSideRecordsHaveInertShape` to both complete prepared-side envelopes. This
full unknown-safe gate must pass before `getTradingPromotion`, `loadQualifiedPromotionAuthority`,
persisted graph comparisons, or any nested side dereference. It then independently requires:

```ts
async verify(
  graph: PreparedPaperTradingComparison
): Promise<VerifiedPaperTradingComparisonCommitmentGraph> {
  const preparedSideRefEnvelopeHasRuntimeShape = (
    value: unknown,
    role: "champion" | "challenger"
  ): value is PreparedPaperTradingComparisonSide => value !== null &&
    typeof value === "object" && !Array.isArray(value) &&
    paperTradingComparisonSideHasRuntimeShape(
      (value as Record<string, unknown>).side,
      role
    );
  const rawGraph = graph as unknown;
  if (rawGraph === null || typeof rawGraph !== "object" || Array.isArray(rawGraph)) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison graph has invalid runtime shape."
    );
  }
  const raw = rawGraph as Record<string, unknown>;
  if (!paperTradingComparisonPreparationHasRuntimeShape(raw.preparation) ||
    !paperTradingComparisonCommitmentHasRuntimeShape(raw.commitment) ||
    !preparedSideRefEnvelopeHasRuntimeShape(raw.champion, "champion") ||
    !preparedSideRefEnvelopeHasRuntimeShape(raw.challenger, "challenger")) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison graph has invalid runtime shape."
    );
  }
  const { preparation, commitment, champion, challenger } = graph;
  const [
    persistedPreparation,
    persistedCommitment,
    persistedChampionCommitment,
    persistedChallengerCommitment,
    persistedChampionEvaluation,
    persistedChallengerEvaluation,
    persistedChampionCandidate,
    persistedChallengerCandidate,
    persistedChampionRun,
    persistedChallengerRun,
    persistedChampionSystemCode,
    persistedChallengerSystemCode,
    allPersistedCommitments,
    allPersistedEvaluations,
    persistedChampionObservations,
    persistedChallengerObservations,
    championVersion,
    challengerVersion,
    championAdmission,
    challengerAdmission
  ] = await Promise.all([
    this.options.store.getPaperTradingComparisonPreparation(
      preparation.paper_trading_comparison_preparation_id
    ),
    this.options.store.getPaperTradingComparisonCommitment(
      commitment.paper_trading_comparison_commitment_id
    ),
    this.options.store.getPaperTradingEvaluationCommitment(
      champion.side.paper_trading_evaluation_commitment_ref.id
    ),
    this.options.store.getPaperTradingEvaluationCommitment(
      challenger.side.paper_trading_evaluation_commitment_ref.id
    ),
    this.options.store.getPaperTradingEvaluation(
      champion.side.paper_trading_evaluation_ref.id
    ),
    this.options.store.getPaperTradingEvaluation(
      challenger.side.paper_trading_evaluation_ref.id
    ),
    this.options.store.getCandidateForTradingRun(champion.side.trading_run_ref.id),
    this.options.store.getCandidateForTradingRun(challenger.side.trading_run_ref.id),
    this.options.store.getTradingRun(champion.side.trading_run_ref.id),
    this.options.store.getTradingRun(challenger.side.trading_run_ref.id),
    this.options.store.getSystemCode(champion.side.system_code_ref.id),
    this.options.store.getSystemCode(challenger.side.system_code_ref.id),
    this.options.store.listPaperTradingEvaluationCommitments(),
    this.options.store.listPaperTradingEvaluations(),
    this.options.store.listPaperTradingObservations(
      champion.side.paper_trading_evaluation_ref.id
    ),
    this.options.store.listPaperTradingObservations(
      challenger.side.paper_trading_evaluation_ref.id
    ),
    this.options.store.getCandidateVersion(champion.side.candidate_version_ref.id),
    this.options.store.getCandidateVersion(challenger.side.candidate_version_ref.id),
    this.options.store.getCandidateAdmissionDecision(
      champion.side.candidate_admission_decision_ref.id
    ),
    this.options.store.getCandidateAdmissionDecision(
      challenger.side.candidate_admission_decision_ref.id
    )
  ]);
  const preparedSideHasFullRuntimeShape = (
    value: unknown,
    role: "champion" | "challenger",
    candidateVersion: unknown,
    admission: unknown
  ): value is PreparedPaperTradingComparisonSide => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const side = value as Record<string, unknown>;
    return paperTradingComparisonSideHasRuntimeShape(side.side, role) &&
      paperTradingComparisonSideRecordsHaveInertShape({
        candidate: side.candidate,
        candidateVersion,
        admission,
        run: side.run,
        systemCode: side.systemCode,
        commitment: side.commitment,
        evaluation: side.evaluation,
        observations: side.observations
      });
  };
  if (!preparedSideHasFullRuntimeShape(
    champion,
    "champion",
    championVersion,
    championAdmission
  ) || !preparedSideHasFullRuntimeShape(
    challenger,
    "challenger",
    challengerVersion,
    challengerAdmission
  )) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison prepared side has invalid persisted runtime shape."
    );
  }
  const boundPromotion = preparation.champion_selection.selection_kind === "trading_review"
    ? await this.options.store.getTradingPromotion(
        preparation.champion_selection.trading_promotion_ref.id
      )
    : undefined;
  const selectionEvidence =
    preparation.champion_selection.selection_kind === "trading_review" &&
    boundPromotion && championVersion && championAdmission
      ? await this.loadQualifiedPromotionAuthority(
          boundPromotion,
          {
            side: preparation.champion,
            candidateVersion: championVersion,
            admission: championAdmission,
            systemCode: champion.systemCode
          },
          preparation.committed_at
        )
      : undefined;
  const selectionMatches = preparation.comparison_policy.comparison_mode === "bootstrap"
    ? preparation.champion_selection.selection_kind === "bootstrap"
    : preparation.champion_selection.selection_kind === "trading_review" &&
      Boolean(boundPromotion && selectionEvidence) &&
      preparation.champion_selection.trading_promotion_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonTradingPromotionDigestInput(boundPromotion!)
        ) &&
      paperTradingComparisonRefsEqual(
        preparation.champion_selection.paper_trading_evaluation_ref,
        boundPromotion!.paper_trading_evaluation_ref
      ) &&
      preparation.champion_selection.paper_trading_evaluation_record_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonEvaluationRecordDigestInput(selectionEvidence!.evaluation)
        ) &&
      paperTradingComparisonRefsEqual(
        preparation.champion_selection.paper_trading_evaluation_commitment_ref,
        {
          record_kind: selectionEvidence!.commitment.record_kind,
          id: selectionEvidence!.commitment.paper_trading_evaluation_commitment_id
        }
      ) &&
      preparation.champion_selection.paper_trading_evaluation_commitment_record_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(
            selectionEvidence!.commitment
          )
        ) &&
      preparation.champion_selection.paper_trading_observation_chain_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonObservationChainDigestInput(selectionEvidence!.observations)
        );
  const candidateSideMatches = (
    runtimeSide: PaperTradingComparisonSide,
    candidateSide: PaperTradingComparisonCandidateSide
  ) => runtimeSide.role === candidateSide.role &&
    paperTradingComparisonRefsEqual(runtimeSide.candidate_ref, candidateSide.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      runtimeSide.candidate_version_ref,
      candidateSide.candidate_version_ref
    ) &&
    runtimeSide.candidate_version_digest === candidateSide.candidate_version_digest &&
    paperTradingComparisonRefsEqual(runtimeSide.system_code_ref, candidateSide.system_code_ref) &&
    runtimeSide.system_code_record_digest === candidateSide.system_code_record_digest &&
    runtimeSide.system_code_artifact_digest === candidateSide.system_code_artifact_digest &&
    paperTradingComparisonRefsEqual(
      runtimeSide.candidate_admission_decision_ref,
      candidateSide.candidate_admission_decision_ref
    ) &&
    runtimeSide.admission_decision_digest === candidateSide.admission_decision_digest;
  const preparationMatches =
    paperTradingComparisonPreparationHasRuntimeShape(persistedPreparation) &&
    paperTradingComparisonCommitmentHasRuntimeShape(persistedCommitment) &&
    isDeepStrictEqual(persistedPreparation, preparation) &&
    isDeepStrictEqual(persistedCommitment, commitment) &&
    preparation.preparation_digest === comparisonPreparationDigest(preparation) &&
    commitment.commitment_digest === comparisonCommitmentDigest(commitment) &&
    preparation.authority_status === "not_live" &&
    paperTradingComparisonRefsEqual(commitment.preparation_ref, {
      record_kind: preparation.record_kind,
      id: preparation.paper_trading_comparison_preparation_id
    }) &&
    commitment.paper_trading_comparison_commitment_id ===
      preparation.paper_trading_comparison_commitment_id &&
    candidateSideMatches(commitment.champion, preparation.champion) &&
    candidateSideMatches(commitment.challenger, preparation.challenger) &&
    isDeepStrictEqual(commitment.champion_selection, preparation.champion_selection) &&
    isDeepStrictEqual(commitment.comparison_policy, preparation.comparison_policy) &&
    commitment.market_data_configuration_digest ===
      preparation.market_data_configuration_digest &&
    isDeepStrictEqual(commitment.paper_policy_identity, preparation.paper_policy_identity) &&
    commitment.committed_at === preparation.committed_at &&
    isExactIsoTimestamp(preparation.committed_at) &&
    selectionMatches;
  const persistedField = (value: unknown, key: string): unknown =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)[key]
      : undefined;
  const commitmentsForRun = (runRef: unknown) => allPersistedCommitments.filter((record) =>
    paperTradingComparisonRefsEqual(persistedField(record, "trading_run_ref"), runRef));
  const evaluationsForRun = (runRef: unknown) => allPersistedEvaluations.filter((record) =>
    paperTradingComparisonRefsEqual(persistedField(record, "trading_run_ref"), runRef));
  const championRunCommitments = commitmentsForRun(champion.side.trading_run_ref);
  const challengerRunCommitments = commitmentsForRun(challenger.side.trading_run_ref);
  const championRunEvaluations = evaluationsForRun(champion.side.trading_run_ref);
  const challengerRunEvaluations = evaluationsForRun(challenger.side.trading_run_ref);
  const persistedSideGraphsMatch =
    isDeepStrictEqual(persistedChampionCommitment, champion.commitment) &&
    isDeepStrictEqual(persistedChallengerCommitment, challenger.commitment) &&
    isDeepStrictEqual(persistedChampionEvaluation, champion.evaluation) &&
    isDeepStrictEqual(persistedChallengerEvaluation, challenger.evaluation) &&
    isDeepStrictEqual(persistedChampionCandidate, champion.candidate) &&
    isDeepStrictEqual(persistedChallengerCandidate, challenger.candidate) &&
    isDeepStrictEqual(persistedChampionRun, champion.run) &&
    isDeepStrictEqual(persistedChallengerRun, challenger.run) &&
    isDeepStrictEqual(persistedChampionSystemCode, champion.systemCode) &&
    isDeepStrictEqual(persistedChallengerSystemCode, challenger.systemCode) &&
    isDeepStrictEqual(persistedChampionObservations, champion.observations) &&
    isDeepStrictEqual(persistedChallengerObservations, challenger.observations) &&
    championRunCommitments.length === 1 &&
    persistedField(
      championRunCommitments[0],
      "paper_trading_evaluation_commitment_id"
    ) === champion.side.paper_trading_evaluation_commitment_ref.id &&
    challengerRunCommitments.length === 1 &&
    persistedField(
      challengerRunCommitments[0],
      "paper_trading_evaluation_commitment_id"
    ) === challenger.side.paper_trading_evaluation_commitment_ref.id &&
    championRunEvaluations.length === 1 &&
    persistedField(
      championRunEvaluations[0],
      "paper_trading_evaluation_id"
    ) === champion.side.paper_trading_evaluation_ref.id &&
    paperTradingComparisonRefsEqual(
      persistedField(
        championRunEvaluations[0],
        "paper_trading_evaluation_commitment_ref"
      ),
      champion.side.paper_trading_evaluation_commitment_ref
    ) &&
    challengerRunEvaluations.length === 1 &&
    persistedField(
      challengerRunEvaluations[0],
      "paper_trading_evaluation_id"
    ) === challenger.side.paper_trading_evaluation_ref.id &&
    paperTradingComparisonRefsEqual(
      persistedField(
        challengerRunEvaluations[0],
        "paper_trading_evaluation_commitment_ref"
      ),
      challenger.side.paper_trading_evaluation_commitment_ref
    );
  const sideRefsMatch = (side: PreparedPaperTradingComparisonSide) =>
    side.candidate.candidate_id === side.side.candidate_ref.id &&
    side.candidate.candidate_version.candidate_version_id ===
      side.side.candidate_version_ref.id &&
    paperTradingComparisonRefsEqual(side.side.trading_run_ref, {
      record_kind: side.run.record_kind,
      id: side.run.trading_run_id
    }) &&
    paperTradingComparisonRefsEqual(side.side.trading_run_ref, side.commitment.trading_run_ref) &&
    paperTradingComparisonRefsEqual(side.side.system_code_ref, {
      record_kind: side.systemCode.record_kind,
      id: side.systemCode.system_code_id
    }) &&
    paperTradingComparisonRefsEqual(side.side.system_code_ref, side.commitment.system_code_ref) &&
    side.side.system_code_artifact_digest === side.systemCode.artifact_digest &&
    side.side.system_code_artifact_digest === side.commitment.system_code_artifact_digest &&
    paperTradingComparisonRefsEqual(side.side.paper_trading_evaluation_commitment_ref, {
      record_kind: side.commitment.record_kind,
      id: side.commitment.paper_trading_evaluation_commitment_id
    }) &&
    side.side.paper_trading_evaluation_commitment_digest ===
      side.commitment.commitment_digest &&
    side.side.paper_trading_evaluation_commitment_record_digest ===
      comparisonExactRecordDigest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(side.commitment)
      ) &&
    paperTradingComparisonRefsEqual(side.side.paper_trading_evaluation_ref, {
      record_kind: side.evaluation.record_kind,
      id: side.evaluation.paper_trading_evaluation_id
    }) &&
    side.side.paper_trading_evaluation_record_digest ===
      comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(side.evaluation)
      ) &&
    paperTradingComparisonRefsEqual(
      side.evaluation.paper_trading_evaluation_commitment_ref,
      side.side.paper_trading_evaluation_commitment_ref
    ) &&
    paperTradingComparisonRefsEqual(side.evaluation.candidate_ref, side.side.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      side.evaluation.candidate_version_ref,
      side.side.candidate_version_ref
    ) &&
    paperTradingComparisonRefsEqual(side.evaluation.trading_run_ref, side.side.trading_run_ref) &&
    paperTradingComparisonRefsEqual(side.run.candidate_ref, side.side.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      side.run.candidate_version_ref,
      side.side.candidate_version_ref
    ) &&
    paperTradingComparisonRefsEqual(side.run.system_code_ref, side.side.system_code_ref);
  const sideHasInertShape = (
    side: PreparedPaperTradingComparisonSide,
    version: CandidateVersionRecord | undefined,
    admission: CandidateAdmissionDecisionRecord | undefined
  ) => Boolean(version && admission) &&
    paperTradingComparisonSideRecordsHaveInertShape({
      candidate: side.candidate,
      candidateVersion: version!,
      admission: admission!,
      run: side.run,
      systemCode: side.systemCode,
      commitment: side.commitment,
      evaluation: side.evaluation,
      observations: side.observations
    }) &&
    side.evaluation.started_at === side.commitment.committed_at;
  const sideIsQualificationEligible = (side: PreparedPaperTradingComparisonSide) =>
    side.commitment.evidence_purpose === "qualification" &&
    side.commitment.window_policy.release_policy ===
      "sealed_until_adjudication" &&
    side.commitment.provider_identity.qualification_eligible === true &&
    side.commitment.provider_identity.ineligibility_reason === undefined &&
    isExactIsoTimestamp(side.commitment.committed_at) &&
    Date.parse(side.commitment.committed_at) >=
      Date.parse(preparation.committed_at) &&
    isExactIsoTimestamp(side.run.created_at ?? "") &&
    side.run.created_at === preparation.committed_at &&
    side.commitment.commitment_digest ===
      `sha256:${createHash("sha256")
        .update(paperTradingEvaluationCommitmentDigestInput(side.commitment))
        .digest("hex")}` &&
    isDeepStrictEqual(side.commitment.runtime_identity, {
      artifact_kind: side.systemCode.artifact_kind,
      runtime_kind: side.systemCode.runtime_kind,
      entrypoint: side.systemCode.entrypoint,
      ...(side.systemCode.artifact_runtime_contract_ref
        ? { artifact_runtime_contract_ref: side.systemCode.artifact_runtime_contract_ref }
        : {})
    }) &&
    paperTradingComparisonRefsEqual(
      side.commitment.capability_policy_ref,
      side.systemCode.capability_policy_ref
    ) &&
    paperTradingComparisonRefsEqual(
      side.commitment.secret_policy_ref,
      side.systemCode.secret_policy_ref
    );
  const admissionMatches = (
    side: PreparedPaperTradingComparisonSide,
    admission: CandidateAdmissionDecisionRecord | undefined
  ) => Boolean(admission) && paperTradingComparisonRefsEqual(
    side.side.candidate_admission_decision_ref,
    {
      record_kind: admission!.record_kind,
      id: admission!.candidate_admission_decision_id
    }
  ) &&
    admission!.status === "admitted" &&
    admission!.runnable_paper_handoff === true &&
    admission!.authority_status === "not_live" &&
    isCandidateAdmissionDecisionConsistent(admission!) &&
    side.side.admission_decision_digest === comparisonExactRecordDigest(
      paperTradingComparisonAdmissionDecisionDigestInput(admission!)
    ) &&
    isExactIsoTimestamp(admission!.decided_at) &&
    Date.parse(admission!.decided_at) <= Date.parse(preparation.committed_at) &&
    paperTradingComparisonRefsEqual(
      admission!.system_code_ref,
      side.commitment.system_code_ref
    ) &&
    admission!.submitted_artifact_digest ===
      side.commitment.system_code_artifact_digest;
  const frozenVersionMatches = (
    side: PreparedPaperTradingComparisonSide,
    version: CandidateVersionRecord | undefined
  ) => Boolean(version) && paperTradingComparisonRefsEqual(
    side.side.candidate_version_ref,
    { record_kind: version!.record_kind, id: version!.candidate_version_id }
  ) &&
    version!.candidate_id === side.side.candidate_ref.id &&
    paperTradingComparisonRefsEqual(version!.system_code_ref, side.side.system_code_ref) &&
    side.side.candidate_version_digest === comparisonExactRecordDigest(
      paperTradingComparisonCandidateVersionDigestInput(version!)
    ) &&
    side.side.system_code_record_digest === comparisonExactRecordDigest(
      paperTradingComparisonSystemCodeRecordDigestInput(side.systemCode)
    ) &&
    version!.runtime_ref.id !== side.run.trading_run_id;
  const identitiesMatch =
    preparationMatches &&
    persistedSideGraphsMatch &&
    champion.side.role === "champion" &&
    challenger.side.role === "challenger" &&
    sideHasInertShape(champion, championVersion, championAdmission) &&
    sideHasInertShape(challenger, challengerVersion, challengerAdmission) &&
    sideRefsMatch(champion) &&
    sideRefsMatch(challenger) &&
    frozenVersionMatches(champion, championVersion) &&
    frozenVersionMatches(challenger, challengerVersion) &&
    admissionMatches(champion, championAdmission) &&
    admissionMatches(challenger, challengerAdmission) &&
    sideIsQualificationEligible(champion) &&
    sideIsQualificationEligible(challenger) &&
    commitment.authority_status === "not_live" &&
    commitment.comparison_policy.release_policy === "sealed_until_adjudication" &&
    champion.side.candidate_version_ref.id !== challenger.side.candidate_version_ref.id &&
    champion.run.trading_run_id !== challenger.run.trading_run_id &&
    champion.side.paper_trading_evaluation_commitment_ref.id !==
      challenger.side.paper_trading_evaluation_commitment_ref.id &&
    champion.side.paper_trading_evaluation_ref.id !==
      challenger.side.paper_trading_evaluation_ref.id &&
    champion.evaluation.paper_trading_evaluation_id !==
      challenger.evaluation.paper_trading_evaluation_id &&
    champion.commitment.resolved_artifact_digest !==
      challenger.commitment.resolved_artifact_digest &&
    commitment.comparison_policy.interval_ms ===
      champion.commitment.window_policy.interval_ms &&
    commitment.comparison_policy.interval_ms ===
      challenger.commitment.window_policy.interval_ms &&
    isDeepStrictEqual(
      champion.commitment.window_policy,
      challenger.commitment.window_policy
    ) &&
    commitment.market_data_configuration_digest ===
      champion.commitment.data_identity.market_data_configuration_digest &&
    commitment.comparison_policy.symbol === champion.commitment.data_identity.symbol &&
    isDeepStrictEqual(
      champion.commitment.data_identity,
      challenger.commitment.data_identity
    ) &&
    isDeepStrictEqual(
      commitment.paper_policy_identity,
      champion.commitment.policy_identity
    ) &&
    isDeepStrictEqual(
      champion.commitment.policy_identity,
      challenger.commitment.policy_identity
    ) &&
    isDeepStrictEqual(
      champion.commitment.initial_account_snapshot,
      challenger.commitment.initial_account_snapshot
    );
  if (!identitiesMatch) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison graph is incomplete, mismatched, duplicate, or no longer inert."
    );
  }
  return {
    ...graph,
    verification: { status: "verified", activation_authority: "not_granted" }
  };
}
```

Implement exact idempotency comparison against the stored preparation before creating or repairing
either side. The comparison deliberately has no caller time check; the persisted server timestamp
is reused even when a retrying coordinator's `now()` would return another value:

```ts
private assertRequestedPreparationIdentity(
  preparation: PaperTradingComparisonPreparationRecord,
  expectedCommitmentId: string,
  input: PreparePaperTradingComparisonInput
): void {
  const matches =
    preparation.paper_trading_comparison_commitment_id === expectedCommitmentId &&
    preparation.champion.candidate_ref.id === input.champion.candidateId &&
    preparation.champion.candidate_version_ref.id === input.champion.candidateVersionId &&
    preparation.champion.candidate_admission_decision_ref.id ===
      input.champion.admissionDecisionId &&
    preparation.challenger.candidate_ref.id === input.challenger.candidateId &&
    preparation.challenger.candidate_version_ref.id === input.challenger.candidateVersionId &&
    preparation.challenger.candidate_admission_decision_ref.id ===
      input.challenger.admissionDecisionId &&
    isDeepStrictEqual(preparation.comparison_policy, input.comparisonPolicy) &&
    preparation.market_data_configuration_digest === input.marketDataConfigurationDigest &&
    isDeepStrictEqual(preparation.paper_policy_identity, input.paperPolicyIdentity);
  if (!matches) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_idempotency_conflict",
      "Paper comparison idempotency key was reused with different input."
    );
  }
}

private async assertFrozenPreparationRecords(
  preparation: PaperTradingComparisonPreparationRecord
): Promise<void> {
  if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_graph_invalid",
      "Paper comparison preparation has invalid runtime shape."
    );
  }
  const [championVersion, challengerVersion, championCode, challengerCode,
    championAdmission, challengerAdmission] = await Promise.all([
    this.options.store.getCandidateVersion(preparation.champion.candidate_version_ref.id),
    this.options.store.getCandidateVersion(preparation.challenger.candidate_version_ref.id),
    this.options.store.getSystemCode(preparation.champion.system_code_ref.id),
    this.options.store.getSystemCode(preparation.challenger.system_code_ref.id),
    this.options.store.getCandidateAdmissionDecision(
      preparation.champion.candidate_admission_decision_ref.id
    ),
    this.options.store.getCandidateAdmissionDecision(
      preparation.challenger.candidate_admission_decision_ref.id
    )
  ]);
  const sideMatches = (
    side: PaperTradingComparisonCandidateSide,
    version: CandidateVersionRecord | undefined,
    systemCode: SystemCodeRecord | undefined,
    admission: CandidateAdmissionDecisionRecord | undefined
  ) => Boolean(version && systemCode && admission) &&
    paperTradingComparisonRefsEqual(side.candidate_version_ref, {
      record_kind: version!.record_kind,
      id: version!.candidate_version_id
    }) &&
    version!.candidate_id === side.candidate_ref.id &&
    paperTradingComparisonRefsEqual(version!.system_code_ref, side.system_code_ref) &&
    paperTradingComparisonRefsEqual(side.system_code_ref, {
      record_kind: systemCode!.record_kind,
      id: systemCode!.system_code_id
    }) &&
    side.candidate_version_digest === comparisonExactRecordDigest(
      paperTradingComparisonCandidateVersionDigestInput(version!)
    ) &&
    side.system_code_record_digest === comparisonExactRecordDigest(
      paperTradingComparisonSystemCodeRecordDigestInput(systemCode!)
    ) &&
    side.system_code_artifact_digest === systemCode!.artifact_digest &&
    paperTradingComparisonRefsEqual(admission!.system_code_ref, side.system_code_ref) &&
    paperTradingComparisonRefsEqual(side.candidate_admission_decision_ref, {
      record_kind: admission!.record_kind,
      id: admission!.candidate_admission_decision_id
    }) &&
    admission!.submitted_artifact_digest === side.system_code_artifact_digest &&
    admission!.status === "admitted" &&
    admission!.runnable_paper_handoff === true &&
    admission!.authority_status === "not_live" &&
    isCandidateAdmissionDecisionConsistent(admission!) &&
    isExactIsoTimestamp(systemCode!.created_at) &&
    isExactIsoTimestamp(admission!.decided_at) &&
    Date.parse(systemCode!.created_at) <= Date.parse(admission!.decided_at) &&
    Date.parse(admission!.decided_at) <= Date.parse(preparation.committed_at) &&
    side.admission_decision_digest === comparisonExactRecordDigest(
      paperTradingComparisonAdmissionDecisionDigestInput(admission!)
    );
  if (
    !sideMatches(preparation.champion, championVersion, championCode, championAdmission) ||
    !sideMatches(preparation.challenger, challengerVersion, challengerCode, challengerAdmission)
  ) {
    throw new PaperTradingComparisonError(
      "paper_trading_comparison_frozen_record_digest_mismatch",
      "Frozen CandidateVersion, SystemCode, or admission content changed."
    );
  }
  if (preparation.champion_selection.selection_kind === "trading_review") {
    const selection = preparation.champion_selection;
    const promotion = await this.options.store.getTradingPromotion(
      selection.trading_promotion_ref.id
    );
    if (!promotion || !championVersion || !championCode || !championAdmission) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_frozen_record_digest_mismatch",
        "Frozen TradingPromotion qualification closure is incomplete."
      );
    }
    const evidence = await this.loadQualifiedPromotionAuthority(
      promotion,
      {
        side: preparation.champion,
        candidateVersion: championVersion,
        admission: championAdmission,
        systemCode: championCode
      },
      preparation.committed_at
    );
    if (
      selection.trading_promotion_digest !==
        comparisonExactRecordDigest(
          paperTradingComparisonTradingPromotionDigestInput(promotion)
        ) ||
      !paperTradingComparisonRefsEqual(
        selection.paper_trading_evaluation_ref,
        promotion.paper_trading_evaluation_ref
      ) ||
      selection.paper_trading_evaluation_record_digest !==
        comparisonExactRecordDigest(
          paperTradingComparisonEvaluationRecordDigestInput(evidence.evaluation)
        ) ||
      !paperTradingComparisonRefsEqual(
        selection.paper_trading_evaluation_commitment_ref,
        {
          record_kind: evidence.commitment.record_kind,
          id: evidence.commitment.paper_trading_evaluation_commitment_id
        }
      ) ||
      selection.paper_trading_evaluation_commitment_record_digest !==
        comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(evidence.commitment)
        ) ||
      selection.paper_trading_observation_chain_digest !==
        comparisonExactRecordDigest(
          paperTradingComparisonObservationChainDigestInput(evidence.observations)
        )
    ) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_frozen_record_digest_mismatch",
        "Frozen TradingPromotion qualification closure changed."
      );
    }
  }
}
```

- [ ] **Step 7: Run focused coordinator, store, session, and public-guard tests**

Run: `npx vitest run packages/domain/src/paper-trading-comparison-commitment.test.ts packages/application/src/trading/paper/qualification.test.ts packages/local-store/test/local-store.test.ts packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts apps/runtime/test/paper-trading-evaluation-commitment.test.ts`

Expected: PASS; coordinator tests prove two distinct non-default qualification runs, exact-content
replay, partial pre-pair repair, same-ID drift rejection, causal active unordered-pair rejection,
full admission-to-promotion causality, exact sole run-level commitment/evaluation-chain identity,
preseeded-run time rejection, domain-decision/application-wrapper equality across every qualification
threshold and evidence failure, full prepared-side gating,
recomputed SystemCode-after-admission rejection, zero-outcome baselines, and persisted corruption
failure under a StorePort mutation-throwing proxy. Provider/sandbox/market/runner/Gateway/
Ledger/observation effects and post-pair writes stay zero. The runtime test continues to prove
public payload fields cannot select qualification or a comparison ID.

- [ ] **Step 8: Prove activation and composition remain out of scope**

Run: `git diff --exit-code -- packages/application/src/trading/paper/commands.ts apps/runtime/src/server.ts apps/runtime/test/paper-trading-evaluation-commitment.test.ts`

Expected: exit 0 with no diff. No command, route, runtime wiring, activation bypass, market view,
tick, observation, verdict, confirmation, promotion, or recovery behavior is introduced.

- [ ] **Step 9: Run repository verification**

```bash
npm run typecheck
npm test
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

Expected: all checks pass. Listener or process tests that cannot bind inside a restricted sandbox
must be rerun in the repository's approved unrestricted test environment; do not omit their result.

- [ ] **Step 10: Commit the inert coordinator frontier**

```bash
git add packages/application/src/trading/paper/comparison-coordinator.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
git commit -m "feat: prepare inert paper comparison pairs"
```

### Task 5: Durable Inert-Frontier Documentation Writeback

**Files:**
- Modify: `docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`

**Interfaces:**
- Produces: durable documentation of the implemented preparation anchor, server-owned timestamp,
  full-record CandidateVersion/SystemCode/admission/promotion digests, the exact stopped qualified
  promotion evaluation/commitment/ordered-observation closure, exact sole side run-level
  commitment/evaluation chains,
  full side commitment/evaluation record digests, atomic authority/side-evidence reservation,
  one domain-owned qualification decision with boundary-supplied self-digest verification,
  zero-outcome baselines, full prepared-side validation
  before selection dereference, read-only reload, provider eligibility, and inert graph.
- Preserves: public command payloads and qualification activation remain closed.
- Defers: shared tick, `ComparisonMarketDataView`, activation authority, paired observation,
  verdict/adjudication, confirmations, promotion integration, and pair recovery.

- [ ] **Step 1: Run the pre-write documentation assertion and confirm RED**

Run:

```bash
node -e 'const fs=require("node:fs"); const required={"docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md":["PaperTradingComparisonPreparationRecord","ordered full-record observation-chain digest","one domain-owned qualification decision","grants no activation authority","Shared ticks","pair recovery remain pending"],"docs/candidate-arena-evaluation-protocol.md":["PaperTradingComparisonPreparationRecord","runnerActive: false","one domain qualification decision","persisted graph remains inert","does not activate qualification","pair recovery remain pending"],"docs/api-command-contract.md":["Public commands cannot","Public qualification activation remains closed","shared comparison ticks","pair recovery remain pending"]}; const missing=Object.entries(required).flatMap(([p,phrases])=>{const s=fs.readFileSync(p,"utf8");return phrases.filter((x)=>!s.includes(x)).map((x)=>`${p}: ${x}`)}); if(missing.length){console.error(missing.join("\n"));process.exit(1)} console.log("scoped writeback present")'
```

Expected: FAIL with one or more path-scoped missing phrases before inert authority, command closure,
and pending tick/verdict/recovery boundaries are documented in their owning files.

- [ ] **Step 2: Record the implemented boundary in the prospective design**

Add this implementation-status block to
`docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md`:

```md
## Commitment-Graph Frontier Status

The first implementation frontier persists a `PaperTradingComparisonPreparationRecord` before
either qualification side. It freezes the deterministic future pair ID, both role-specific
candidate refs plus full-record CandidateVersion, SystemCode, and admission-decision digests and,
for champion challenge, the full-record champion-promotion digest plus the exact stopped qualified
promotion evaluation ref/full-record digest, exact qualification commitment ref/full-record digest,
and canonical ordered full-record observation-chain digest. It also freezes each exact SystemCode
artifact digest, the champion selection,
the complete comparison policy, market-data configuration digest, paper policy identity, and a
server-owned `committed_at`. Exact replay reuses that timestamp; caller and public command payloads
cannot set it.

The resulting commitment graph is append-only and inert. Both side provider identities must be
qualification-eligible, both complete window policies must match, and the pair is persisted only
after both distinct non-default qualification TradingRuns and side graphs exist. This frontier
atomically reserves frozen authority evidence before side creation, rejects non-noop mutation or
extension of the bound promotion qualification commitment/evaluation/observation chain, and
atomically validates/appends the pair against run, commitment, evaluation, observation, Ledger,
run-control, and sandbox writers.
Each pair side freezes the existing side-commitment self-digest plus full persisted-record digests
for its exact baseline commitment and evaluation, including their timestamps and complete zero
state; pair-bound side mutation remains forbidden.
The champion authority closure enforces `SystemCode.created_at <= admission.decided_at <=
commitment.committed_at <= evaluation.started_at <= ordered observations <= evaluation.stopped_at
<= promotion.promoted_at <= preparation.committed_at`.
LocalStore and the application qualification API use one domain-owned qualification decision:
complete key-order-insensitive score/account continuity, at least 30 observations and 30 minutes,
at most ten percent failed observations, current market evidence, and matching public execution
evidence for fills. LocalStore and application each independently verify the commitment
self-digest before supplying that result to the decision; the application wrapper preserves its
existing public API. Read-only
verification applies full prepared-side validation, including SystemCode-before-admission, before
loading champion selection authority or dereferencing nested side records.
This frontier
grants no activation authority and starts no provider, sandbox, market, runner, Gateway, Ledger, or
observation effect. Each pair side binds the exact sole commitment/evaluation chain for its
qualification `TradingRun` and a zero-score, zero-observation, empty-account-activity baseline.
Post-pair reload is read-only and fails closed on
missing or changed side records without repair or invalidation. Shared ticks,
`ComparisonMarketDataView`, verdict/adjudication, confirmations,
promotion integration, and pair recovery remain pending.
```

- [ ] **Step 3: Record admission and selection authority in the evaluation protocol**

Add this paragraph under prospective paper qualification in
`docs/candidate-arena-evaluation-protocol.md`:

```md
Prospective comparison preparation uses `PaperTradingComparisonPreparationRecord` and accepts only
already-admitted, frozen candidates. Each side
binds one exact `CandidateAdmissionDecisionRecord` with `status: "admitted"`, runnable paper
handoff, `not_live` authority, and SystemCode identity/digest matching its CandidateVersion;
duplicate, quarantined, missing, or mismatched evidence is rejected before any preparation or side
write. Bootstrap requires no current TradingPromotion. Champion challenge binds the exact current
TradingPromotion and its full-record digest plus champion refs. It also binds the promotion's exact
stopped `PaperTradingEvaluation`, exact qualification commitment, and ordered observation chain;
the total domain closure must satisfy runtime shape and causality, and the one domain qualification
decision must return `qualified` with `runnerActive: false` after the accepting boundary
independently verifies the commitment self-digest. The application qualification API delegates to
that decision. Preparation time is
server-owned. The promotion and preparation must bind the same exact evaluation ref; a second chain
for the same candidate, CandidateVersion, and SystemCode is not interchangeable.
The persisted graph remains inert, binds one exact baseline commitment/evaluation chain per side
`TradingRun`, and does not activate qualification, repair a post-pair graph, mutate pair-bound side
evidence, or implement promotion behavior.
Shared ticks, verdicts, and pair recovery remain pending.
```

- [ ] **Step 4: Keep the public command boundary closed**

Add this paragraph to `docs/api-command-contract.md` beside paper-start payload restrictions:

```md
Public commands cannot create or alter a `PaperTradingComparisonPreparationRecord`, select
qualification evidence purpose, comparison ID, comparison role,
candidate admission decision, champion promotion, comparison policy, or comparison
`committed_at`. Internal comparison preparation assigns time from its server-owned clock and
persists an inert append-only authority record. Public qualification activation remains closed;
shared comparison ticks, verdict authority, and pair recovery remain pending and are not part of
this command contract.
```

- [ ] **Step 5: Run docs verification and confirm GREEN**

```bash
node -e 'const fs=require("node:fs"); const required={"docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md":["PaperTradingComparisonPreparationRecord","ordered full-record observation-chain digest","one domain-owned qualification decision","grants no activation authority","Shared ticks","pair recovery remain pending"],"docs/candidate-arena-evaluation-protocol.md":["PaperTradingComparisonPreparationRecord","runnerActive: false","one domain qualification decision","persisted graph remains inert","does not activate qualification","pair recovery remain pending"],"docs/api-command-contract.md":["Public commands cannot","Public qualification activation remains closed","shared comparison ticks","pair recovery remain pending"]}; const missing=Object.entries(required).flatMap(([p,phrases])=>{const s=fs.readFileSync(p,"utf8");return phrases.filter((x)=>!s.includes(x)).map((x)=>`${p}: ${x}`)}); if(missing.length){console.error(missing.join("\n"));process.exit(1)} console.log("scoped writeback present")'
bash scripts/check-docs.sh
npm run check:naming
git diff --check
```

Expected: `scoped writeback present`; all documentation, naming, and whitespace checks pass.

- [ ] **Step 6: Commit the documentation writeback**

```bash
git add docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md
git commit -m "docs: record inert paper comparison frontier"
```

## Cross-Plan Boundary

The next plan may consume `VerifiedPaperTradingComparisonCommitmentGraph` only as verified pre-start
evidence with full-record CandidateVersion/SystemCode/admission/promotion digests, the exact frozen
promotion qualification evaluation/commitment/ordered-observation closure, exact baseline side
run-level commitment/evaluation chains, side commitment self-digests, full side
commitment/evaluation record digests,
provider eligibility, full window bindings, and
`activation_authority: "not_granted"`. Post-pair reload remains read-only. The next plan must add the
first shared comparison tick and
`ComparisonMarketDataView` before defining a separate qualification activation authority. A later
plan owns paired observation, closure, verdict/adjudication, non-overlapping confirmations,
promotion integration, and restart recovery. Until a verdict lifecycle exists, every persisted pair
commitment is treated as active for unordered-pair exclusion; no role swap, cleanup, or implicit replacement is
allowed in this frontier.

## Self-Review Record

- [x] Spec coverage: Tasks 1-5 cover canonical full-record CandidateVersion, SystemCode, admission,
  promotion, promotion qualification evaluation/commitment/ordered-observation closure,
  preparation, and pair digests; server-owned frozen time; append-only serialized store persistence;
  atomic authority reservation, promotion-evidence writer exclusion, and pair/side-writer graph
  snapshots; exact evaluation identity, side-commitment self-digest, full side commitment/evaluation
  record digests, and sole run-level commitment/evaluation-chain checks; zero-outcome inert baselines;
  provider eligibility, full-window predicates, one domain-owned qualification decision with
  boundary-supplied commitment digest verification,
  same-champion exact promotion Ref isolation, full prepared-side pre-dereference gating, and
  SystemCode-before-admission read-only enforcement; two distinct side runs; pair-after-sides
  ordering; partial pre-pair repair; exact replay; duplicate/active-pair rejection; read-only
  post-pair reload; unchanged public/activation guards; and durable docs writeback.
- [x] Scope coverage: comparison ticks, market views, activation, paired observations, verdicts,
  adjudication, confirmations, promotion integration, and pair recovery have no implementation
  step or runtime/public-composition file.
- [x] Type consistency: `PaperTradingComparisonCandidateSide`,
  `PaperTradingComparisonPreparationRecord`, `PaperTradingComparisonChampionSelection`,
  `PaperTradingComparisonPolicy`, `PaperTradingComparisonSide`,
  `PaperTradingComparisonCommitmentRecord`, `PreparePaperTradingComparisonInput`,
  `PreparedPaperTradingComparison`, and `VerifiedPaperTradingComparisonCommitmentGraph` use one
  spelling and one field shape throughout all tasks; pair sides always include the exact side
  commitment self-digest, full commitment/evaluation record digests, and evaluation ref. Domain
  snippets import `isCandidateAdmissionDecisionConsistent` as a value and cast only after field
  validation, provider narrowing is a `PaperTradingEvaluationProviderIdentity` type predicate,
  interval values use numeric type guards, runtime-side fields stay behind a guarded record, and
  the candidate projection preserves required `system_code.ref` through its loaded-side type.
- [x] Runtime-shape consistency: exported total policy, selection, candidate-side, runtime-side,
  preparation, pair, inert-side-record, and stopped-qualification-closure predicates accept
  `unknown`, guard every nested object/array before access, use `trace_placeholder`, match the
  serialized `initialPaperTradingEngineState()` baseline, and return false rather than throwing on
  corrupt JSON. The stopped closure owns runtime shape and causality only. The domain qualification
  decision owns all evidence-integrity, account/score, runner, count, elapsed, failure-ratio, market,
  fill, status, and reason semantics; application delegates to it, LocalStore calls it directly, and
  coordinator applies the full inert-side predicate before promotion or nested graph dereference.
- [x] Read-only consistency: in production coordinator implementation,
  `PaperTradingSessionService.prepare` appears only in pre-pair `prepareSide`; `reload`,
  `reloadSide`, and `verify` contain only StorePort reads and cannot repair, invalidate, replace, or
  create side records.
- [x] Current-code consistency: exact CandidateVersion lookup, a separate persisted-record encoder
  that mirrors JSON omission of undefined object properties, the shared comparison-evidence queue,
  LocalStore-owned `SandboxObservationInput` signatures/defaults, digest revalidation, causal
  `SystemCode <= admission <= qualification commitment <= evaluation <= ordered observations <=
  stop <= promotion <= preparation` timestamps for promotion and inert side graphs, one shared
  qualification decision plus application-wrapper and LocalStore integration tests,
  run-level side-chain
  uniqueness, persisted graph equality, `trace_placeholder` refs, and default `runtime_ref`
  rejection remain present.
- [x] Command consistency: every task has a failing test command, a passing focused command, and one
  commit for its independently reviewable deliverable.
- [x] Prose completeness: every code-producing step includes concrete signatures or implementation
  snippets, and every referenced new function or type is defined in the task that owns it.

Run this verification block before execution handoff; every command must exit zero:

```bash
node -e 'const fs=require("node:fs"); const p="docs/superpowers/plans/2026-07-10-paper-comparison-commitment-graph.md"; const s=fs.readFileSync(p,"utf8"); const bad=["T"+"BD","T"+"ODO","implement "+"later","fill in "+"details","Similar "+"to Task"]; const hits=bad.filter((x)=>s.includes(x)); if(hits.length){console.error(hits.join("\n"));process.exit(1)} console.log("clean")'
node -e 'const fs=require("node:fs"); const s=fs.readFileSync("docs/superpowers/plans/2026-07-10-paper-comparison-commitment-graph.md","utf8"); const fences=(s.match(/^```/gm)||[]).length; if(fences%2){throw new Error(`unbalanced code fences: ${fences}`)} console.log(`balanced code fences: ${fences}`)'
node -e 'const fs=require("node:fs"); const s=fs.readFileSync("docs/superpowers/plans/2026-07-10-paper-comparison-commitment-graph.md","utf8"); const bad=["recordPaperTradingComparison"+"Preparation","authorityEvidence"+"WriteQueue","InterleavingAuthority"+"LocalStore","SandboxStart"+"Result","SandboxAdapterObservation"+"Result","verifyExisting"+"({","input."+"committedAt","input."+"committed_at","side."+"session","record_kind: \"trace\""]; const hits=bad.filter((x)=>s.includes(x)); if(hits.length){console.error(hits.join("\n"));process.exit(1)} console.log("stale-name scan clean")'
node -e 'const fs=require("node:fs"); const s=fs.readFileSync("docs/superpowers/plans/2026-07-10-paper-comparison-commitment-graph.md","utf8"); const required=["type SandboxObservationInput","function promotionEvidenceSnapshot(","function invokeFrozenPromotionEvidenceWriter(","function comparisonExactRecordDigest(","paperTradingComparisonPersistedRecordDigestInput","paperTradingComparisonEvaluationCommitmentRecordDigestInput","paperTradingComparisonEvaluationRecordDigestInput","paperTradingComparisonObservationChainDigestInput"]; const missing=required.filter((x)=>!s.includes(x)); if(missing.length){console.error(missing.join("\n"));process.exit(1)} console.log("helper/type scan clean")'
node -e 'const fs=require("node:fs"); const s=fs.readFileSync("docs/superpowers/plans/2026-07-10-paper-comparison-commitment-graph.md","utf8"); const token="const input: PreparePaperTradingComparison"+"Input"; const count=s.split(token).length-1; if(count!==1){console.error(`expected one in-scope Prepare input, found ${count}`);process.exit(1)} console.log("single coordinator input excerpt present")'
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = process.cwd();
const plan = fs.readFileSync(
  "docs/superpowers/plans/2026-07-10-paper-comparison-commitment-graph.md",
  "utf8"
);
function snippet(name) {
  const start = "<!-- plan-typecheck:" + name + ":start -->";
  const end = "<!-- plan-typecheck:" + name + ":end -->";
  const from = plan.indexOf(start);
  const to = plan.indexOf(end);
  if (from < 0 || to < 0 || to <= from) {
    throw new Error("missing plan typecheck marker: " + name);
  }
  const match = plan.slice(from + start.length, to).match(/```ts\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error("missing TypeScript fence for marker: " + name);
  }
  return match[1];
}
const domainPath = path.join(root, "packages/domain/src/index.ts");
const currentAdmissionImport = [
  "import type {",
  "  CandidateAdmissionDecisionRecord,",
  "  CandidateAdmissionReason",
  "} from \"./candidate-admission-policy\";"
].join("\n");
const currentDomain = fs.readFileSync(domainPath, "utf8");
if (!currentDomain.includes(currentAdmissionImport)) {
  throw new Error("current domain admission import drifted");
}
const proposedDomain = currentDomain.replace(
  currentAdmissionImport,
  snippet("domain-admission-import")
) + "\n" + snippet("domain-types") + "\n" + snippet("domain-digests") +
  "\n" + snippet("domain-runtime");
const overlays = new Map([
  [path.resolve(domainPath), proposedDomain],
  [
    path.resolve(root, "packages/domain/src/paper-trading-comparison-commitment.test.ts"),
    snippet("domain-test")
  ],
  [
    path.resolve(root, "packages/application/src/trading/paper/qualification.ts"),
    snippet("application-qualification")
  ],
  [
    path.resolve(root, "packages/application/src/trading/paper/qualification.test.ts"),
    snippet("application-qualification-test")
  ]
]);
const config = ts.readConfigFile(
  path.join(root, "tsconfig.base.json"),
  ts.sys.readFile
);
if (config.error) {
  throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
}
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const options = {
  ...parsed.options,
  noEmit: true,
  baseUrl: root,
  paths: {
    "@ouroboros/domain": ["packages/domain/src/index.ts"],
    "@ouroboros/domain/*": ["packages/domain/src/*"]
  }
};
const roots = [
  ...ts.sys.readDirectory(path.join(root, "packages/domain/src"), [".ts"]),
  ...ts.sys.readDirectory(path.join(root, "packages/application/src"), [".ts"]),
  ...[...overlays.keys()].filter((file) => !fs.existsSync(file))
];
const host = ts.createCompilerHost(options, true);
const readFile = host.readFile.bind(host);
const fileExists = host.fileExists.bind(host);
host.readFile = (file) => overlays.get(path.resolve(file)) ?? readFile(file);
host.fileExists = (file) => overlays.has(path.resolve(file)) || fileExists(file);
host.getSourceFile = (file, language) => {
  const source = host.readFile(file);
  return source === undefined
    ? undefined
    : ts.createSourceFile(file, source, language, true);
};
const program = ts.createProgram({
  rootNames: [...new Set(roots.map((file) => path.resolve(file)))],
  options,
  host
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics) {
    const location = diagnostic.file && diagnostic.start !== undefined
      ? path.relative(root, diagnostic.file.fileName) + ":" +
        (diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1)
      : "global";
    console.error(
      location + " TS" + diagnostic.code + ": " +
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    );
  }
  process.exit(1);
}
console.log(
  "composed strict TypeScript validation passed: " + overlays.size +
  " overlays, " + program.getSourceFiles().length + " source files"
);
NODE
node -e 'const fs=require("node:fs"); const s=fs.readFileSync("docs/superpowers/plans/2026-07-10-paper-comparison-commitment-graph.md","utf8"); const relation="Date.parse(systemCode.created_at) <= Date.parse(admission.decided_at)"; const closure=s.slice(s.indexOf("export function paperTradingComparisonStoppedQualificationClosureHasRuntimeShape"),s.indexOf("export function paperTradingComparisonSideRecordsHaveInertShape")); const refs=closure.slice(closure.indexOf("const refsMatch"),closure.indexOf("const observationChainMatches")); const inert=s.slice(s.indexOf("export function paperTradingComparisonSideRecordsHaveInertShape"),s.indexOf("The shared predicates are deliberately strict and total")); const count=(text,value)=>text.split(value).length-1; if(count(refs,relation)!==1||count(inert,relation)!==1){console.error({closureRefs:count(refs,relation),inert:count(inert,relation)});process.exit(1)} console.log("SystemCode/admission timestamp predicates placed exactly")'
node -e 'const fs=require("node:fs"); const s=fs.readFileSync("docs/superpowers/plans/2026-07-10-paper-comparison-commitment-graph.md","utf8"); const start=s.indexOf("\nasync reload(\n"); const end=s.indexOf("\nprivate assertRequestedPreparationIdentity(",start); const region=s.slice(start,end); const allowed=new Set(["getPaperTradingComparisonCommitment","getPaperTradingComparisonPreparation","getPaperTradingEvaluationCommitment","getPaperTradingEvaluation","getCandidateForTradingRun","getTradingRun","getSystemCode","listPaperTradingEvaluationCommitments","listPaperTradingEvaluations","listPaperTradingObservations","getCandidateVersion","getCandidateAdmissionDecision","getTradingPromotion"]); const calls=[...region.matchAll(/this\.options\.store\.([A-Za-z0-9_]+)/g)].map((match)=>match[1]); const bad=calls.filter((name)=>!allowed.has(name)); const fullGate=region.indexOf("if (!preparedSideHasFullRuntimeShape("); const promotion=region.indexOf("const boundPromotion ="); if(start<0||end<0||bad.length||region.includes("this.options.sessions.prepare")||fullGate<0||promotion<0||fullGate>promotion){console.error({start,end,bad,fullGate,promotion});process.exit(1)} console.log("reload/verify read-only and full-side gate ordering clean")'
bash scripts/check-docs.sh
npm run check:naming
git diff --check
```
