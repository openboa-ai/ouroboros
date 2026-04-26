# Proactive Standing View Store And Rebuild Contract

## Thesis

The first persisted `CurrentProactiveStandingView` should be one readable current-state surface per
governed scope, with explicit authority watermark, history watermark, trust posture, and rebuild
state.

## Why This Spec Exists

autokairos already knows:

- current proactive standing must be rebuildable
- current proactive standing must advertise freshness and reconciliation posture

Implementation still needs one narrower contract:

**what exactly should the first stored standing view contain, and when should it advance, degrade,
or rebuild?**

Without this spec:

- standing rows will silently become scheduler-owned mutable truth
- watermark advancement will be ad hoc
- drift and rebuild will exist only as operator intuition

## Canonical Object / Interface / Boundary

This spec defines the first-cut persisted projection shape for proactive standing:

1. `CurrentProactiveStandingView`

It sits above:

- active `WakePolicy` and `StandingOrder`
- `ProactiveEvaluationRecordHeader`
- downstream wake and request history when needed for current outcome posture

And below:

- operator proactive-status reads
- runtime-facing proactive context reads
- projection catch-up and rebuild workers

## Required Fields Or Required Behaviors

## 1. CurrentProactiveStandingView

### Required fields

| Field | Notes |
| --- | --- |
| `governed_scope_key` | Primary standing-scope identifier |
| `effective_wake_policy_refs_payload` | Effective wake authority envelope |
| `effective_standing_order_refs_payload` | Effective standing authority envelope |
| `latest_proactive_evaluation_record_ref` | Latest meaningful evaluation applied |
| `latest_outcome_posture` | `emitted`, `suppressed`, `coalesced`, `escalated`, `quiet`, or equivalent |
| `authority_watermark` | Coverage marker for authority applied |
| `history_watermark` | Coverage marker for proactive history applied |
| `trust_posture` | `trusted`, `degraded`, `blocked`, or equivalent |
| `reconciliation_status` | `in_sync`, `catching_up`, `rebuilding`, `drift_detected`, `degraded`, or equivalent |
| `last_updated_at` | Last successful projection mutation |

### Strongly recommended nullable fields

| Field | Notes |
| --- | --- |
| `latest_wake_trigger_record_ref` | Latest relevant emitted or suppressed wake |
| `latest_execution_request_ref` | Latest request when current posture depends on emitted work |
| `active_review_or_escalation_ref` | Review work when current standing is escalated |
| `freshness_deadline_at` | When trust should degrade if no new reconciliation occurs |
| `drift_reason_code` | Structured reason current standing is not trustworthy |
| `rebuild_requested_at` | When full rebuild was requested |
| `rebuilding_since` | When rebuild work started |
| `last_reconciled_at` | Last successful reconciliation pass |

### Required behavior

This view must remain the canonical current-state owner of:

- current proactive posture for one governed scope
- current authority coverage horizon
- current history coverage horizon
- current trust and reconciliation posture

It must not become the deeper owner of chronology.

## 2. Watermark advancement rules

Watermarks may advance only when:

- applicable authority coverage for the scope is known
- new proactive evaluation history has been durably appended
- downstream linkage needed for the current posture is present or explicitly `not_applicable`

The projection must not advance history watermark past history it has not actually incorporated.

## 3. Drift detection rules

The projection should enter `drift_detected`, `catching_up`, or `degraded` when:

- active authority changed after the current authority watermark
- newer proactive evaluation history exists after the current history watermark
- the latest applied evaluation implies emitted downstream work, but linkage is missing
- the view misses its freshness deadline
- reconciliation or rebuild previously failed

## 4. Rebuild triggers

Full rebuild should be triggered when one or more of these happens:

- authority coverage is invalid or unknown
- history watermark cannot be advanced through incremental reconciliation
- projection corruption or inconsistency is detected
- operator or system explicitly requests rebuild

Incremental catch-up is preferred when history is merely behind but causal consistency still holds.

## 5. Required query surfaces

The first implementation should support:

- current standing by `governed_scope_key`
- all standing views with `trust_posture != trusted`
- all standing views with `reconciliation_status != in_sync`
- standing views whose `freshness_deadline_at` has passed
- standing views whose latest posture references one `ExecutionRequest`

## Lifecycle Or State Model

The first standing-view lifecycle should be read as:

`initialized -> in_sync -> catching_up or degraded when lag appears -> rebuilt or reconciled -> trusted again only after watermark coverage is explicit`

## What This Is Not

This spec is not:

- one exact database schema
- one cron loop
- one hidden in-memory cache
- one claim that the standing view is itself durable chronology

It is the first projection-store and rebuild contract only.

## Failure Modes / Invariants

### Invariants

- current proactive standing always names the authority and history horizons it reflects
- trust degrades when coverage is missing or stale
- rebuild remains possible from active authority plus durable history
- current standing is cheap to read without pretending to be the deeper truth

### Failure modes

- standing rows advance watermark without actual causal coverage
- downstream emitted work exists but the current view still points to older posture
- rebuild is impossible because watermarks or references were never stored
- operator reads cannot distinguish `in_sync` from `quiet but stale`

## Relationship To Adjacent Specs

- [37-current-proactive-standing-view-contract.md](37-current-proactive-standing-view-contract.md)
  defines the higher-level projection contract above this persisted shape.
- [39-proactive-standing-watermark-and-reconciliation-contract.md](39-proactive-standing-watermark-and-reconciliation-contract.md)
  defines the trust and rebuild rules this shape must preserve.
- [40-proactive-evaluation-record-store-contract.md](40-proactive-evaluation-record-store-contract.md)
  defines the durable history family beneath this view.
- [32-current-state-projection-families-contract.md](32-current-state-projection-families-contract.md)
  defines the broader projection-family posture this view belongs to.
