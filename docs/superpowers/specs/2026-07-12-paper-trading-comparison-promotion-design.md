# Paper Trading Comparison Promotion Design

**Status:** Approved for implementation

## Goal

Allow the explicit `trading_candidate.promote` operator command to move one challenger into
`TradingReview` only when a terminal, precommitted
`PaperTradingComparisonConfirmationCampaignOutcome` proves repeatable qualified improvement over
the exact current champion. The promotion remains paper-only, starts no process, submits no order,
grants no private or live authority, and preserves the exact comparison evidence that authorized
the review transition.

## Why This Frontier Is Next

The internal comparison path can now commit prospective champion/challenger windows, run both
sides on common public market opportunities, qualify exact TradingRun evidence, seal one-window
verdicts, reserve non-overlapping confirmation windows, aggregate every reserved result, and
release terminal outcomes into causal research memory. The remaining loop break is authority
consumption: even an `eligible` confirmed campaign cannot create `TradingPromotion`, so a proven
challenger cannot become the next Trading review target or the frozen champion for another
comparison.

This is not an automatic deployment frontier. `TradingPromotion` means review selection under
`not_live`; the operator command remains the explicit mutation boundary. Continuous paper session
replacement, private exchange access, signed requests, and live trading remain outside scope.

## Source Interpretation

Anthropic's Automated Weak-to-Strong Researcher supports independent researchers, broad research
directions, autonomous experiment sequencing, external evaluation, shared findings/code, and
held-out pressure against reward hacking. It does not provide a trading-specific champion
transition rule. Ouroboros therefore adds the controls required by a noisy, path-dependent,
non-stationary market:

- candidate and evaluation policy freeze before prospective evidence;
- identical eligible market opportunities and cost assumptions for both sides;
- multiple precommitted, non-overlapping qualified windows;
- an explicit operator transition after external confirmation;
- no inference of execution authority from research or economic evidence.

The design preserves researcher flexibility inside the sandbox. It constrains only the external
evidence and authority boundary.

## Considered Approaches

### 1. Let the operator scan outcomes and write the existing bare promotion

Rejected. A bare `candidate_ref` plus one `paper_trading_evaluation_ref` cannot prove which
campaign authorized the transition, whether every reserved window improved, or whether the
campaign challenged the current champion. It also leaves LocalStore unable to reject stale or
drifted evidence atomically.

### 2. Add a separate promotion-decision record before `TradingPromotion`

Rejected for this frontier. The terminal campaign outcome already is the external economic
decision, while `TradingPromotion` is the explicit operator transition. A third decision record
would duplicate lifecycle state without adding authority separation.

### 3. Bind confirmation evidence directly into `TradingPromotion`

Selected. `TradingPromotion` receives one compact immutable comparison basis. An application
service locates eligible evidence and constructs the record; LocalStore independently reconstructs
and validates the full evidence graph before the append-only write. Later comparisons freeze the
whole promotion record digest, including its confirmation basis.

## Owned Boundary

This frontier owns:

- the comparison-confirmation basis embedded in `TradingPromotionRecord`;
- a deterministic application service that resolves one candidate's current eligible campaign;
- LocalStore graph validation and append-only replay semantics;
- `trading_candidate.promote` composition and stable operator errors;
- exact-evaluation and compact confirmation provenance in shared operator read models;
- focused domain, application, LocalStore, operator, restart, and no-authority tests.

## Non-Goals

- no automatic/background promotion;
- no champion paper-session stop, start, or replacement;
- no CandidateArena selection mutation;
- no reuse of research-feedback evidence as qualification evidence;
- no direct provider, Gateway, Ledger, order, exchange, credential, private, or live operation;
- no new comparison scheduling or production comparison command;
- no statistical rule beyond the existing precommitted all-window confirmation policy;
- no adaptive ResearchWorker allocation in this frontier;
- no requirement that research release happen before or after promotion.

## Canonical Vocabulary

The existing canonical nouns remain sufficient:

- `PaperTradingComparisonConfirmationCampaignOutcome` is the external aggregate economic
  decision;
- `TradingPromotion` is the explicit paper-backed transition into `TradingReview`;
- `TradingReview` is the active operator review projection and is not live exchange promotion.

The compact embedded field is named `comparison_confirmation`. It is evidence provenance, not a
new lifecycle noun. Avoid `winner`, `deployment`, `live_promotion`, `auto_promotion`, or a generic
`approval` name because each would blur either statistical meaning or authority.

No compatibility alias is added. Existing local test fixtures and persisted version-1 promotion
shape are migrated directly to the new required comparison-backed shape because the production
command has never been able to create a promotion without this evidence.

## Domain Contract

`TradingPromotionRecord` gains a required immutable evidence basis:

```ts
export interface TradingPromotionComparisonConfirmation {
  basis_kind: "paper_trading_comparison_confirmation";
  campaign_ref: Ref;
  campaign_digest: string;
  campaign_outcome_ref: Ref;
  campaign_outcome_digest: string;
  final_verdict_ref: Ref;
  final_verdict_digest: string;
}

export interface TradingPromotionRecord extends BaseRecord {
  record_kind: "trading_promotion";
  trading_promotion_id: string;
  status: "promoted_for_trading_review";
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  paper_trading_evaluation_ref: Ref;
  comparison_confirmation: TradingPromotionComparisonConfirmation;
  promoted_at: string;
  promoted_by_command_ref?: Ref;
  authority_status: "not_live";
}
```

The promotion's `paper_trading_evaluation_ref` is the challenger evaluation from the final
reserved confirmation verdict. It is not "the latest candidate evaluation" and is never resolved
by mutable recency. Every campaign slot must already have improved; choosing the final slot only
gives the promotion one canonical qualified evaluation to bind for subsequent champion freezes.

`paperTradingComparisonTradingPromotionHasRuntimeShape` validates the new basis, exact record
kinds, digest strings, ISO time, `not_live`, and absence of alternate authority states. The existing
canonical full-record digest then freezes the basis automatically whenever a later comparison
binds this promotion as champion.

## Application Service

Add `PaperTradingComparisonPromotionService` with one method:

```ts
promote(input: { candidateId: string }): Promise<TradingPromotionRecord>
```

The service performs reads and record construction; it does not trust provider output or candidate
self-report.

### Evidence Selection

1. Normalize the candidate ID before any read.
2. Read confirmation outcomes and inspect only runtime-valid, digest-valid terminal records.
3. Keep only `campaign_outcome: "confirmed_improvement"`,
   `promotion_eligibility: "eligible"`, `next_action: "review_for_trading_promotion"`, and all
   slot results `challenger_improved`.
4. Load each candidate campaign and require exact challenger candidate/version/SystemCode identity.
5. Sort eligible candidate outcomes by `evaluated_at` descending, then stable ID descending.
6. Select only evidence whose champion selection still matches the latest `TradingPromotion`:
   - bootstrap requires no current promotion;
   - champion challenge requires the exact current promotion ref and full-record digest.
7. If the latest promotion already references the selected outcome, return it byte-identically.
8. If candidate evidence exists but only for an old champion, return a stable stale-evidence error.
9. If no eligible candidate evidence exists, return a stable evidence-required error.

### Final Verdict Binding

The final slot must contain a verdict ref and digest. The service loads that verdict and requires:

- `verdict_outcome: "challenger_improved"`;
- pair qualification `qualified` for both sides;
- campaign, outcome, final slot, and verdict refs/digests agree;
- verdict challenger candidate/version/SystemCode agree with the campaign challenger;
- the final challenger evaluation ref is the one written into `TradingPromotion`;
- `promoted_at` is strictly later than both outcome and final verdict evaluation time.

The deterministic ID is derived from the outcome ID:

```text
trading-promotion-<safe campaign outcome id>
```

No random ID or candidate-local counter is needed. Exact retries converge on one record.

## LocalStore Authority Gate

`recordTradingPromotion` remains inside the existing comparison-evidence write transaction and
becomes append-only:

1. validate runtime shape;
2. if the same ID exists, return only byte-identical content and reject any drift;
3. load the campaign, outcome, final verdict, candidate version, SystemCode, admission, final
   challenger commitment/evaluation/observations, and current promotion;
4. call the existing full campaign-outcome and verdict graph validators, not only shallow shape
   checks;
5. require the terminal eligible/all-improved semantics and exact challenger identity;
6. require the final challenger evaluation to remain stopped, canonically qualified, and bound to
   complete run-specific Ledger evidence through the verdict closure;
7. enforce bootstrap/no-current-promotion or exact current-champion selection inside the same
   transaction;
8. reject writes frozen by another active comparison through the existing authority-write guard;
9. write one promotion JSON record.

A process crash cannot partially create the record because the promotion is one atomic JSON write.
After restart, `getLatestTradingPromotion` reconstructs the review target. Repeating the command
returns the same record; changed evidence or timestamps conflict.

## Operator Command Semantics

`trading_candidate.promote` remains the only product command that creates `TradingPromotion`.

The command first verifies that the candidate exists, then asks the comparison-promotion service
for an eligible current campaign. On success it returns the persisted promotion and does not alter
the Arena selection or start/stop any runner.

When no eligible campaign exists, the command retains the current diagnostic distinction:

- no paper evaluation: `paper_trading_evaluation_required`;
- latest evidence is collecting, invalid, failed, or research feedback:
  `paper_trading_qualification_required` with the current reasons;
- standalone qualification exists but no confirmed campaign:
  `paper_trading_comparison_required`;
- an eligible campaign challenges an old champion:
  `paper_trading_comparison_stale`;
- refs, digests, qualification, or persisted graph disagree:
  `paper_trading_comparison_invalid`.

Diagnostic fallback may inspect the latest paper row only to explain why no promotion basis exists.
It must never replace the exact final-verdict evaluation in a successful promotion.

## Read Model

Add a compact read-only projection shared by `TradingPromotion`, `TradingReview`, and the review
packet evidence-quality section:

```ts
export interface TradingPromotionComparisonConfirmationReadModel {
  campaign_id: string;
  campaign_outcome_id: string;
  final_verdict_id: string;
  required_window_count: number;
  improved_window_count: number;
  primary_metric: "net_revenue_usdt";
  minimum_net_revenue_lift_usdt: number;
  evaluated_at: string;
  evaluation_authority: "external_to_trading_systems";
  authority_status: "not_live";
}
```

Builders load the evaluation named by `promotion.paper_trading_evaluation_ref`; they must not fall
back to a newer unrelated evaluation for qualification, performance, or packet evidence. A missing
or corrupt basis degrades to blocked/missing evidence rather than silently reading candidate-latest
state.

Rendering this projection in every UI is not required in this frontier. The shared command/read
model contract is the authoritative interface and can be rendered without another runtime change.

## Error And Race Semantics

- Malformed input performs no store read.
- Missing candidate/campaign/outcome/verdict/evaluation evidence creates no promotion.
- A non-confirmed, ineligible, partially improved, expired, or mixed campaign creates no promotion.
- A source one-window verdict is never sufficient.
- An eligible campaign bound to an earlier Trading review target cannot replace the current target.
- Concurrent promotion and comparison reservation serialize through the comparison evidence
  transaction; one exact champion state wins and the other operation fails closed.
- Promotion time cannot precede its deciding evidence.
- Store response must be byte-identical to the requested record or the service reports a
  persistence conflict.
- No error path mutates candidate, paper evidence, comparison evidence, Gateway, Ledger, runner,
  exchange, credentials, or authority.

## Test Strategy

### Domain

- accept one canonical comparison-backed promotion;
- reject missing/wrong record refs, digests, basis kind, time, and authority;
- prove the full promotion digest changes when any confirmation basis field changes.

### Application service

- malformed candidate ID performs zero reads;
- select only eligible all-improved candidate evidence;
- ignore unrelated candidate outcomes;
- reject mixed/not-confirmed/source-verdict-only evidence;
- reject stale champion selection;
- bind the exact final challenger evaluation rather than candidate latest;
- construct deterministic ID and strict post-evidence time;
- exact replay returns the same record;
- persistence mismatch fails closed;
- no runner, order, private, live, research-release, or CandidateArena mutation is called.

### LocalStore

- persist and reload one valid comparison-backed promotion;
- reject every campaign/outcome/final-verdict ref or digest drift;
- reject non-qualified final challenger evidence and incomplete Ledger closure;
- reject candidate/version/SystemCode role swaps;
- reject bootstrap when a current promotion exists;
- reject champion challenge after the current promotion changes;
- serialize concurrent comparison reservation and promotion;
- preserve exact replay and reject same-ID mutation;
- restart reconstructs the same latest promotion and read model.

### Operator and lifecycle

- current qualification and comparison-required diagnostics remain stable;
- a full confirmed campaign can be explicitly promoted;
- Trading review points to the exact final challenger evaluation and confirmation summary;
- research release remains independent;
- promotion does not start/stop the champion or challenger paper process;
- authority scans prove no private/live/order path is introduced.

## Acceptance Criteria

This frontier is complete only when current code and tests prove:

1. only a terminal eligible all-improved confirmation campaign can create a promotion;
2. the command and persisted record identify the exact campaign, outcome, final verdict, candidate,
   version, SystemCode, and challenger qualification evaluation;
3. bootstrap and replacement promotions are checked against the exact current champion state;
4. one-window, standalone, research-feedback, stale, mixed, ineligible, expired, malformed, or
   drifted evidence creates no promotion;
5. retries and restart preserve one byte-identical promotion;
6. shared read models use the promotion-bound evaluation and expose compact confirmation evidence;
7. the transition remains explicit, paper-only, `not_live`, and has no runner/order/private/live
   side effect;
8. focused tests, package typechecks, repository guards, and the full suite pass.

## Next Frontier

After comparison-backed promotion is proven, CandidateArena can implement actual bounded adaptive
ResearchWorker allocation: persist per-tick selection and budget decisions, consume only released
causal memory and external efficiency evidence, enforce a diversity/exploration floor, and prove
restart-stable ablation against static allocation. Production comparison scheduling and continuous
champion-session handoff remain separately reviewed frontiers.
