# PaperTradingEvaluation Commitment Design

**Date:** 2026-07-10
**Status:** Approved for implementation
**Scope:** CandidateArena P0 evaluation lifecycle
**Depends on:** Candidate admission gating and sealed ResearchPreflight

## Purpose

Ouroboros must decide what a paper observation is allowed to prove before the observation exists.
The current paper path starts a mutable `PaperTradingEvaluation`, continuously feeds its results to
research, and also allows the same evaluation to become `PaperTradingQualification` evidence. That
permits post-hoc purpose selection: a favorable research-feedback history can be relabeled as
qualification evidence after its outcomes are known.

This design introduces an append-only `PaperTradingEvaluationCommitment` that is persisted before a
paper runner starts or an observation is recorded. The commitment fixes both:

1. the evidence purpose of the session; and
2. the candidate, executable artifact, runtime, market, risk, cost, account, and event-policy
   identities under which its evidence may count.

All currently reachable paper sessions are research feedback. Qualification remains unavailable
until a separate prospective champion/challenger comparison protocol is implemented. Existing paper
history must never be reclassified as qualification evidence.

## Product Invariant

The invariant is:

```text
commit purpose and frozen execution envelope
-> verify the commitment
-> start or resume the paper runner
-> verify again before every observation
-> consume market and TradingSystem decisions
-> record evidence for only the committed purpose
```

The inverse is forbidden:

```text
observe outcomes
-> choose whether the history is research or qualification evidence
```

A paper result remains useful research memory when it loses money, emits no orders, or fails within
the permitted runtime. It stops being valid evidence when its committed identity changes, its
provider boundary cannot be verified, or its paper-only authority is violated.

## Terminology Decisions

### New canonical nouns

- `PaperTradingEvaluationCommitment`: append-only pre-start record that fixes evidence purpose and
  the frozen evaluation envelope.
- `PaperTradingEvidencePurpose`: persisted purpose enum with exactly `research_feedback` and
  `qualification`.
- `PaperTradingEvaluationInvalidationReason`: stable reason explaining why later observations may
  no longer count under a commitment.

### Existing nouns that retain their meaning

- `PaperTradingEvaluation`: mutable accumulated result of one continuous paper session.
- `PaperTradingQualification`: evidence-quality gate over an eligible qualification evaluation. It
  remains separate from rank and does not become a champion-superiority verdict.
- `EvidenceSealingDecision`: existing post-evaluation disposition for the general evaluation
  scaffold. It is not a pre-start paper commitment and will not be reused.

`research-feedback window` and `qualification window` remain descriptive lifecycle labels. They do
not become additional top-level schema nouns.

## Chosen Architecture

The commitment is a dedicated append-only domain record referenced by the mutable evaluation:

```text
PaperTradingEvaluationCommitment (write once)
                  |
                  v
PaperTradingEvaluation (mutable aggregate)
                  |
                  v
PaperTradingObservation (append-only sequence)
```

This is preferred over embedding the snapshot in every mutable evaluation update because a
write-once record has a distinct ownership boundary, a stable digest, and an independently
reloadable audit trail. It is preferred over the general evaluation sealing records because those
records are backtest-oriented and describe a post-hoc evidence disposition rather than a pre-start
paper protocol.

## Domain Contract

### Evidence purpose

```ts
export type PaperTradingEvidencePurpose =
  | "research_feedback"
  | "qualification";
```

All existing public paper start paths create `research_feedback`. No existing command accepts a
caller-supplied evidence purpose. A future paired-comparison application service will be the only
owner allowed to create `qualification` commitments.

### Commitment record

The record has this logical shape. Exact nested type names may follow nearby domain conventions,
but no listed identity may be omitted from the persisted contract.

```ts
export interface PaperTradingEvaluationCommitmentRecord extends BaseRecord {
  record_kind: "paper_trading_evaluation_commitment";
  paper_trading_evaluation_commitment_id: string;
  evidence_purpose: PaperTradingEvidencePurpose;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  resolved_artifact_digest: string;
  runtime_identity: {
    artifact_kind: SystemCodeKind;
    runtime_kind: SystemCodeRuntimeKind;
    entrypoint: string[];
    artifact_runtime_contract_ref?: Ref;
  };
  provider_identity: {
    runtime_provider_kind: "none" | "managed_agent";
    agent_profile_ref?: Ref;
    model?: string;
    provider_configuration_digest?: string;
    qualification_eligible: boolean;
    ineligibility_reason?: "provider_identity_unavailable";
  };
  capability_policy_ref: Ref;
  secret_policy_ref: Ref;
  policy_identity: {
    market_data_policy_version: string;
    gateway_policy_version: string;
    cost_policy_version: string;
    funding_policy_version: string;
    slippage_policy_version: string;
    fill_policy_version: string;
    risk_policy_version: string;
    paper_account_policy_version: string;
    decision_event_protocol_version: string;
    persistent_state_boundary_version: string;
  };
  data_identity: {
    symbol: "BTCUSDT";
    market_data_port: "gateway_owned";
    allowed_market_data_source: PaperTradingMarketDataSourceKind;
    market_data_configuration_digest: string;
    private_exchange_access: "forbidden";
    live_order_access: "forbidden";
  };
  window_policy: {
    interval_ms: number;
    release_policy: "closed_observation" | "sealed_until_adjudication";
    eligibility_policy_version: string;
  };
  initial_account_snapshot: PaperTradingAccountSnapshot;
  committed_at: string;
  commitment_digest: string;
  authority_status: "not_live";
}
```

The implementation may use compact value-object interfaces for the nested fields. The persisted
content and digest inputs must remain equivalent to this contract.

### Evaluation and observation linkage

`PaperTradingEvaluationRecord` gains `paper_trading_evaluation_commitment_ref`. The TypeScript field
is optional only at the persistence read boundary so legacy JSON can be represented; every new
non-invalidated write requires it. Its `status` gains `invalidated`. It also records the latest
stable invalidation reason when invalidated.

`PaperTradingObservationRecord` gains the same required commitment ref. The store rejects an
observation unless its evaluation, candidate, candidate version, trading run, and commitment refs
match the referenced evaluation and commitment exactly.

The commitment ref is required for newly written records and observations. Legacy records without
it are treated as uncommitted evidence and are never inferred to be qualification evidence.

### Invalidation reasons

The first implementation uses stable reasons rather than arbitrary error strings:

```ts
export type PaperTradingEvaluationInvalidationReason =
  | "commitment_missing"
  | "commitment_digest_mismatch"
  | "candidate_identity_mismatch"
  | "candidate_version_identity_mismatch"
  | "system_code_identity_mismatch"
  | "stored_artifact_digest_mismatch"
  | "resolved_artifact_digest_mismatch"
  | "runtime_identity_mismatch"
  | "provider_identity_mismatch"
  | "capability_policy_mismatch"
  | "secret_policy_mismatch"
  | "evaluation_policy_identity_mismatch"
  | "initial_account_identity_mismatch"
  | "paper_only_authority_violation";
```

The evaluation may preserve a more detailed diagnostic string separately, but operator decisions,
tests, and persisted behavior use the stable reason.

## Canonical Digest Rules

`commitment_digest` is SHA-256 over a canonical JSON representation of all commitment fields except
record metadata, `committed_at`, and `commitment_digest` itself. Canonical JSON recursively sorts
object keys, preserves array order, rejects non-finite numbers and `undefined`, and encodes UTF-8.

The digest includes `evidence_purpose`. Therefore purpose cannot be changed without creating a
different commitment, and the store rejects overwriting an existing commitment ID with different
canonical content.

`resolved_artifact_digest` is computed from executable bytes at commitment creation and again during
verification:

- `python_file`: SHA-256 of the file bytes.
- `container_image`: a resolved immutable image digest. A mutable tag alone is not acceptable.

The existing `SystemCodeRecord.artifact_digest` is also captured and compared, but it is not trusted
as proof that the executable bytes still match. Both the stored digest and the resolved artifact
digest must remain stable.

## Lifecycle

### Start

`trading_run.start`, `arena.start`, `arena.cycle`, and every ordinary paper start execute this
sequence:

1. resolve the selected candidate and candidate version;
2. resolve the full `SystemCodeRecord` and executable artifact;
3. build a `research_feedback` commitment from composition-root policy identities and the initial
   fake paper account;
4. calculate the resolved artifact and commitment digests;
5. append the commitment to the store;
6. create the evaluation with the commitment ref;
7. verify the persisted commitment against current state;
8. start the runner.

Nothing may start a sandbox, consume market data, write to Gateway or Ledger, or record a paper
observation before steps 1 through 7 succeed.

An idempotent retry may reuse the same commitment and evaluation only when their canonical content
is identical. A material difference creates a new candidate version and a new commitment.

### Observe

Every scheduled or manually requested observation performs commitment verification before reading a
new market snapshot or consuming TradingSystem events. Only a successful verification may continue
to decision processing, Gateway handling, fake execution, Ledger recording, and observation append.

The committed initial account is verified when the evaluation is created. Later ticks verify that
the current account descends from that persisted initial state through the evaluation's own ordered
observations; they do not compare a legitimately changing current balance to the initial balance.
Missing, cross-evaluation, or rewritten account lineage is an `initial_account_identity_mismatch`.

This ordering is intentional. An invalidated evaluation receives no additional observation, no
score delta, and no new evidence side effects.

### Resume and process recovery

Runner recovery loads the evaluation and its commitment from the durable store. It re-resolves the
candidate, candidate version, SystemCode, executable bytes, runtime identity, and composition-root
policy identity before scheduling the next tick.

A recovered running evaluation whose commitment is missing or mismatched is invalidated and is not
resumed. Recovery never manufactures a replacement commitment from current mutable state.

### Stop

An operator stop changes the evaluation from `running` to `stopped` and stops its runner. It does
not alter purpose, commitment, or already recorded observations. A stopped research-feedback
evaluation may remain research memory but cannot become qualification evidence.

### Invalidate

On the first verification failure:

1. mark the evaluation `invalidated` with the stable reason and diagnostic detail;
2. stop its runner and provider/sandbox process;
3. record run-control or audit evidence without creating a paper observation;
4. exclude the evaluation from qualification and promotion;
5. require a new candidate version and commitment for further evidence.

Invalidation is terminal. Later restoration of the artifact or policy does not reactivate the same
evidence window.

## Research Feedback and Qualification

### Research feedback

A `research_feedback` commitment uses `release_policy: "closed_observation"`. Closed observations
and aggregate paper findings may be supplied to future ResearchWorkers. The active observation is
never visible before it closes.

Research-feedback evidence may affect candidate generation and arena memory. It may not satisfy the
qualification gate or authorize promotion.

### Qualification

A `qualification` commitment uses `release_policy: "sealed_until_adjudication"`. Its observations,
scores, and failure details remain unavailable to candidate generation until the future paired
comparison adjudicator closes the window.

No public command creates this purpose in this frontier. The next frontier must introduce a
prospective champion/challenger comparison that creates both frozen commitments before either
window begins and applies equal market, cost, risk, timing, and evidence policies.

### Qualification gate behavior

`PaperTradingQualificationStatus` gains `not_qualification_evidence`, with reason
`evidence_purpose_not_qualification`. `qualifyPaperTradingEvaluation` returns this terminal result
before maturity or quality checks when the linked commitment is not `qualification`.

A missing commitment returns the same status with `paper_evaluation_commitment_missing`. An
invalidated qualification evaluation returns `blocked_by_quality` with
`paper_evaluation_invalidated`. These results are explicit so old or corrupted evidence cannot fall
through to maturity checks.

For a qualification commitment, the existing maturity and quality checks still apply. Passing them
means only that the evidence window is usable. It does not claim that the candidate beat a champion.

`trading_candidate.promote` rejects every evaluation whose purpose is not `qualification`, whose
evaluation is invalidated, or whose qualification status is not `qualified`. Because no current
command creates qualification commitments, promotion is deliberately unavailable until the paired
comparison frontier exists.

## Store Semantics

The store port gains operations to record and retrieve commitments. The local store maintains an
append-only commitment collection and indexes it by ID.

Write rules:

- first write for an ID appends the record;
- an exact canonical replay is idempotent;
- a replay with different canonical content fails;
- an evaluation must reference an existing matching commitment;
- an observation must reference the same commitment as its evaluation;
- purpose, candidate, version, system code, and initial-account identities cannot be changed by an
  evaluation update;
- an invalidated evaluation cannot return to `running`, `stopped`, or `failed`;
- no observation may be appended after invalidation.

Store serialization, reload, rebuild, and fixture helpers preserve the commitment record and digest.
Old serialized evaluations without a commitment remain readable only as uncommitted, ineligible
history. They are not silently upgraded.

## Application Ownership

The application layer owns commitment creation and verification. Domain records describe facts; the
store enforces referential and append-only invariants; adapters resolve executable bytes and runtime
identity.

Composition roots inject explicit policy-version constants. These constants identify behavior, not
deployment timestamps. A material policy change requires a new version string and invalidates any
running commitment built against the old version.

The paper runner remains an orchestration mechanism, not evidence authority. It may schedule work,
but it cannot choose purpose, bypass verification, or relabel results.

## Operator Read Models

Shared operator projections expose:

- `evidence_purpose`;
- commitment ID and digest;
- freeze status: `committed`, `verified`, or `invalidated`;
- stable invalidation reason and latest diagnostic;
- qualification ineligibility for research-feedback evidence.

CLI, Web, Desktop, and TUI consume the shared read model. This frontier does not redesign the UI.
Existing paper board ranking may continue to rank research-feedback net revenue, but labels and
promotion gates must not imply that rank is qualification authority.

Active qualification evidence must be omitted from research-learning projections until its future
adjudication releases it. This frontier implements the filter even though no qualification start
path is yet exposed.

## Error Handling

Commitment construction errors fail the start command before an evaluation or runner is created.
Verification errors after creation produce terminal invalidation rather than a retry loop. Transient
market or fake-execution errors remain ordinary failed observations only when the commitment itself
still verifies.

Errors must identify the failed boundary without exposing secrets, full provider configuration, or
private environment values. Digests and policy-version identifiers are safe operator evidence.

## Validation Strategy

Implementation follows test-driven development. Required tests include:

1. every current paper start path persists a `research_feedback` commitment before starting;
2. callers cannot supply or mutate evidence purpose;
3. canonical commitment retries are idempotent and conflicting writes fail;
4. evaluation and observation refs must match the commitment;
5. executable byte mutation is detected even when `SystemCodeRecord.artifact_digest` is unchanged;
6. candidate, version, runtime, policy, account, and authority mismatches invalidate before market,
   Gateway, Ledger, score, or observation effects;
7. invalidation is terminal and stops the runner;
8. restart reloads and verifies the original commitment rather than reconstructing it;
9. research-feedback evidence returns `not_qualification_evidence` regardless of age, count, or
   profit;
10. research-feedback evidence cannot promote a candidate;
11. active qualification-purpose data is excluded from research-learning projections;
12. persisted store reload/rebuild preserves commitment refs and digest;
13. all existing paper no-order, order, fill, cost, funding, failure, and restart scenarios remain
    valid under a verified commitment.

The frontier is accepted only after relevant package tests and type checks pass, followed by the
repository architecture, naming, docs, environment, secret, and diff guards.

## Scope Boundaries

This frontier includes domain contracts, local persistence, paper commands, observation and runner
recovery, qualification gating, promotion gating, shared read models, tests, and canonical docs.

It does not implement:

- paired champion/challenger execution;
- a statistical or economic superiority decision;
- adaptive research allocation;
- long-lived ResearchWorker scheduling;
- a new UI design;
- live exchange or private-account authority.

## Follow-on Frontier

The next bounded frontier is a prospective paper comparison service. It must create frozen champion
and challenger commitments before a shared eligible interval, run independent accounts and decision
cadences over the same market stream and policies, keep results sealed from research until close,
and produce a separate comparison verdict. Only that verdict plus a qualified evidence window may
restore a valid promotion path.
