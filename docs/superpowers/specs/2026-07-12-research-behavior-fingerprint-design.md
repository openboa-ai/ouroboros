# ResearchBehaviorFingerprint Design

**Status:** Approved for implementation by the standing Goal

## Goal

Prevent CandidateArena population and lineage memory from being inflated by SystemCode artifacts
that differ textually but produce the same externally observed decisions on the exact same adaptive
development suite. Preserve those rejected attempts as Findings without granting them a candidate
slot, paper handoff, or promotion authority.

This frontier does not claim to prove global strategy equivalence. It records bounded observational
equivalence under one named, versioned protocol and one exact development-suite digest.

## Why This Frontier Is Next

CandidateArena currently derives duplicate status only from equality between the source and
submitted artifact digests. That catches no-op edits and dishonest worker change reports, but a
worker can change comments, control flow, names, or dead code while emitting exactly the same
orders. Those artifacts can occupy separate population slots, distort direction diversity,
duplicate leaderboard evidence, and bias future source selection.

The sealed ResearchPreflight boundary now prevents repeated adaptation against admission evidence.
The next missing admission invariant is therefore behavioral population identity on the already
public, adaptive development distribution. Prospective PaperTradingEvaluation remains the only
economic generalization authority.

## Source Interpretation

Anthropic's Automated Weak-to-Strong Researcher supports using independent researchers, external
evaluation, findings, and lineage as a search process in its studied setting. It does not establish
that syntactically different programs are independent hypotheses or that a leaderboard containing
duplicate behavior represents broader search. Its held-out probing failure also argues against
using sealed outcomes for adaptive identity or clustering.

Ouroboros therefore derives duplicate identity only from worker-visible development evidence. It
does not expose or fingerprint sealed scenarios, results, scores, PnL, evaluator internals, or
future paper observations.

## Considered Approaches

### 1. Keep artifact-digest equality only

Rejected. It detects byte identity, not behavior identity, and is trivially evaded without changing
a TradingSystem decision.

### 2. Compare development scores or PnL

Rejected. Equal aggregate scores can hide different decisions, and score equality would erase
useful strategy diversity. Scores also carry evaluator semantics that should not define identity.

### 3. Fingerprint sealed-admission decisions

Rejected. Sealed suites rotate by direction and tick, so their outputs are not cross-candidate
comparable. Persisting or feeding them into duplicate detection would also widen the sealed
feedback surface.

### 4. Compare normalized effective decisions on one exact development suite

Selected. For each development scenario, capture the final externally recorded
`POST /orders/validate` body that the evaluator treats as the effective candidate decision. Keep
only `symbol`, `side`, `quantity`, and `order_type`; exclude rationale, timestamps, request counts,
event noise, paths, scores, metrics, PnL, and sealed evidence. Sort observations by scenario ID and
digest them with the protocol and exact suite identity.

### 5. Cluster near-equivalent or prospective paper behavior

Deferred. Tolerance-based clustering can identify one-satoshi or tiny sizing evasions, but it needs
an explicit distance policy and can collapse economically meaningful sizing differences. Paper
behavior clustering is stronger evidence but arrives too late to be the initial population gate.

## Canonical Vocabulary

Add one canonical noun: `ResearchBehaviorFingerprint`.

It is append-only evidence that one frozen SystemCode produced one normalized effective decision
per scenario on one exact development suite. The fingerprint digest identifies the protocol-scoped
observation sequence, not source-code meaning, universal strategy equivalence, profitability, or
promotion readiness.

Candidate admission uses the field `behavior_comparison_status` with values:

- `distinct`: no prior admitted fingerprint has the same protocol, suite digest, and fingerprint;
- `duplicate`: one prior admitted fingerprint matches exactly;
- `unavailable`: complete canonical observations could not be derived.

Use admission reason `behavior_duplicate` only for `duplicate`. Use
`behavior_fingerprint_unavailable` to quarantine an otherwise-admissible candidate when the gate
cannot be evaluated. Keep `no_candidate_change` for source/submission artifact equality.

## Persisted Evidence

Add version-1 `ResearchBehaviorFingerprintRecord`:

```ts
export interface ResearchBehaviorFingerprintRecord extends BaseRecord {
  record_kind: "research_behavior_fingerprint";
  research_behavior_fingerprint_id: string;
  research_preflight_commitment_ref: Ref;
  research_preflight_commitment_digest: string;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  protocol_version: "research_behavior_fingerprint_v1";
  development_suite_version: "research_development_replay_v1";
  development_suite_digest: string;
  observations: Array<{
    scenario_id: string;
    decision: {
      symbol: string;
      side: "buy" | "sell" | "hold";
      quantity: number;
      order_type: "market" | "limit" | "none";
    };
  }>;
  observation_count: number;
  fingerprint_digest: string;
  created_at: string;
  duplicate_detection_authority: true;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}
```

The digest payload contains only protocol version, suite version, suite digest, and sorted
observations. It intentionally excludes SystemCode identity, commitment identity, timestamp, and
authority fields so two different artifacts can share a behavioral key. The persisted record still
binds the digest to exact SystemCode and ResearchPreflight evidence.

Observations are retained rather than storing only a digest so LocalStore can recompute the key,
audit normalization, and reject corrupt evidence. They contain only public development decisions,
not sealed data.

## Derivation Rules

For the development evaluation selected before sealed admission:

1. require the commitment's exact `research_development_replay_v1` suite identity;
2. require the complete canonical scenario ID set for the committed suite with no missing,
   additional, or duplicate IDs;
3. for every scenario, select the final externally recorded `POST /orders/validate` body;
4. require an exact valid order shape with finite quantity and official BTCUSDT spelling preserved;
5. remove `reason` and all other fields;
6. sort by scenario ID and reject duplicate IDs;
7. compute the canonical SHA-256 digest.

The final validation request is used because it is the decision the existing external evaluator
matches against the candidate event and scores. Earlier validation probes, rationale text, and
event verbosity cannot create false novelty.

Exact quantity remains part of version 1. This avoids declaring two genuinely different position
sizes equivalent. Near-duplicate sizing needs a separately reviewed distance protocol.

## Admission Semantics

After development selection is frozen and before materialization:

1. persist the current fingerprint with exact commitment and SystemCode linkage;
2. compare only against fingerprints linked from prior `admitted` decisions;
3. compare only records with identical protocol version, development-suite version, and suite
   digest;
4. if an admitted match exists, record `duplicate` / `behavior_duplicate`, point to the prior
   fingerprint, preserve a `duplicate_result` Finding and Lineage, and create no candidate;
5. if no match exists, record `distinct` and continue through all existing sealed evaluation and
   paper-handoff checks;
6. if derivation or comparison is unavailable, quarantine an otherwise-admissible candidate with
   `behavior_fingerprint_unavailable`.

Safety and integrity failures keep precedence. A failed worker, failed experiment, disqualified
sealed evaluation, rejected conformance, or invalid evidence remains quarantined for its causal
reason even if its development behavior matches another candidate.

Historical admission records without fingerprint linkage remain readable. They cannot serve as
fingerprint comparison evidence. The new CandidateArena write path always emits linkage and fails
closed before materialization if it cannot do so.

## Store Integrity

LocalStore must enforce:

- exact runtime shape, canonical timestamp, finite normalized values, unique sorted scenarios, and
  `observation_count === observations.length`;
- canonical fingerprint digest and append-only exact replay;
- exact commitment ref/digest, development suite ref/digest, SystemCode ref/digest, and timestamp
  ordering;
- admission linkage to the current fingerprint;
- `duplicate` decisions link one earlier admitted fingerprint with an exact comparable key;
- `distinct` decisions have no admitted matching key at decision time;
- a fingerprint from a quarantined or duplicate decision cannot become the duplicate baseline;
- closed promotion, order, private, and live authority.

CandidateArena store mutation serialization provides one deterministic winner when concurrent
directions produce the same fingerprint: the first valid admitted decision owns the population
slot and later exact matches become duplicates.

## Feedback And Read Model

The compact direction result exposes only the existing admission status, reason, and generic
Finding. It does not expose observations or digest. Later worker context may consume the generic
duplicate Finding after the decision closes, but not raw behavior from another candidate.

## Failure And Recovery

- Fingerprint derivation failure does not fabricate identity evidence.
- Persistence or graph mismatch aborts the store transaction and creates no candidate.
- A crash after fingerprint persistence but before admission leaves append-only research evidence;
  exact retry may reuse it, but cannot silently alter it.
- A duplicate remains a useful Finding and Lineage node but never becomes leaderboard or source
  selection input as a candidate.

## Non-Goals

- semantic program equivalence or static-code clone detection;
- approximate behavior distance, clustering, or tolerance policy;
- using sealed or paper outcomes for adaptive duplicate identity;
- changing ResearchWorker strategy, model, tool use, or direction order;
- durable ResearchWorker process recovery;
- automatic TradingPromotion, private data, or live exchange behavior.

## Acceptance

The frontier is complete when tests prove:

- different artifacts with identical effective development decisions produce one admitted
  candidate and one causal behavioral duplicate;
- rationale, event noise, ordering, score, PnL, and sealed outcomes cannot change the fingerprint;
- side, order type, symbol, exact quantity, suite digest, or protocol changes do change identity;
- malformed, missing, duplicate-scenario, non-finite, corrupt-digest, or mismatched graph evidence
  fails closed;
- only prior admitted fingerprints can exclude a new candidate;
- duplicate evidence reaches next-generation Finding context without entering the leaderboard;
- focused tests, package typechecks, repository guards, reference-paper soak, operator product-loop
  smoke, and the full test suite pass.
