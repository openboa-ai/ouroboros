# Proactive Standing Rebuild Progress View Contract

## Thesis

autokairos should expose one rebuildable current progress view for active or latest proactive
rebuild work so operators and downstream surfaces can read recovery posture without scanning raw
attempt history.

## Why This Spec Exists

autokairos already defines:

- append-only rebuild attempt chronology
- append-only operator action history
- watermark-aware current standing

Implementation still needs one narrower contract:

**what current progress surface should exist so a blocked or running rebuild can be understood as a
read model rather than as a hidden background branch?**

Without this spec:

- operators must reconstruct progress manually from attempt history
- "blocked", "running", and "never started" become hard to distinguish quickly
- product-specific UIs may invent conflicting status semantics

## Canonical Object / Interface / Boundary

This spec defines one rebuildable projection:

1. `CurrentProactiveRebuildProgressView`

It sits above:

- active rebuild request
- rebuild attempt chronology
- latest operator action when meaningful

And below:

- operator status surfaces
- recovery dashboards
- alerting and audit reads

## Required Fields Or Required Behaviors

## 1. Required identity and scope

The view must identify:

- one governed scope key
- one active or latest rebuild request ref when present
- one active or latest attempt ref when present
- last updated timestamp

Strongly recommended:

- last terminal attempt ref
- latest operator action ref when meaningful
- current strategy or phase hint when meaningful

## 2. Required current posture

The view should preserve current rebuild posture such as:

- `idle`
- `requested`
- `running`
- `suspended`
- `blocked`
- `completed`
- `failed`
- `unknown` or equivalent freshness-invalid posture

The exact enum may vary.

The important rule is semantic separation:

- `idle` means no active recovery is currently expected for the scope
- `requested` means recovery intent exists but no live attempt is currently proven
- `running` means a live attempt is currently believed to be making progress
- `suspended` means the latest attempt paused or lost liveness without a terminal conclusion
- `blocked` means automated recovery cannot proceed safely without follow-up
- `unknown` means the projection cannot currently prove which live recovery posture is true

## 3. Required freshness and coverage semantics

The view must expose enough freshness and coverage information to answer:

- how recent is the progress picture?
- which attempt chronology and request chronology are known to be covered?
- is current posture fresh, lagging, or unknown?

Required behavior:

- the view must preserve some explicit freshness signal rather than relying on one implicit
  timestamp only
- the view must preserve some explicit coverage signal rather than pretending all request and
  attempt history is reflected

The exact fields may vary, but the architecture should support at least:

- one freshness timestamp such as `last_progress_observed_at` or equivalent
- one freshness posture such as `fresh`, `lagging`, `stale`, or equivalent
- one request or attempt coverage marker such as `request_watermark`, `attempt_watermark`, or
  equivalent
- one reason code when freshness or coverage is insufficient

Counters and percentages remain optional.

## 4. Required read semantics

This view must support stable caller interpretation.

At minimum, a caller should be able to distinguish:

- `no active rebuild`
- `active rebuild with fresh progress`
- `active rebuild but progress is lagging`
- `rebuild state currently unknown because projection freshness or coverage is insufficient`
- `blocked rebuild awaiting follow-up`

Required rule:

- callers must not have to infer these distinctions from missing fields alone

Recommended read classes:

- operator status read
- automation-safe read
- audit read

The exact APIs may vary, but the semantics should allow an automation to tell when:

- it may trust `running`
- it should treat the view as lagging or unknown
- it should fall back to deeper request or attempt history

## 5. Required progress semantics

The view must still expose enough current progress information to answer:

- is rebuild currently running?
- if running, what phase or strategy posture is it in?
- if blocked or failed, what is the primary visible reason?
- if completed, which attempt and request most recently succeeded?

The exact progress fields may vary.

## 6. Rebuildability rule

This view must be derivable from durable history and request state.

It must not become a deeper owner of chronology than:

- rebuild request history
- rebuild attempt history
- operator action history

## 7. Trust-on-read rule

If the view is stale or partially covered, it should expose that posture explicitly instead of
pretending current recovery state is fully known.

Required behavior:

- coverage or freshness uncertainty remains inspectable
- callers can distinguish `no active rebuild` from `progress unknown`
- stale progress should not masquerade as live progress
- blocked posture should not be inferred only from the absence of new heartbeats

## 8. Flexibility rule

This spec does not require:

- one UI card
- one percentage field
- one polling cadence
- one event-stream backend

It fixes the current read contract only.

## Lifecycle Or State Model

The rebuild-progress lifecycle should be read as:

`no active recovery -> rebuild requested -> running or suspended while freshness is known -> completed, failed, blocked, or unknown when freshness/coverage can no longer prove posture -> new request or operator action may replace current posture`

## What This Is Not

This spec is not:

- the append-only attempt ledger
- one worker heartbeat stream
- one exact metrics schema
- permission to derive standing trust directly from rebuild progress alone
- permission to treat stale progress as equivalent to fresh progress

It is the current recovery-progress view only.

## Failure Modes / Invariants

### Invariants

- current progress is fast to read without replacing deeper chronology
- stale or partial recovery status is readable as stale or partial
- active request and latest attempt linkage remain visible
- `running`, `idle`, `blocked`, and `unknown` are semantically distinguishable
- the view exposes when callers should fall back to deeper chronology

### Failure modes

- operators cannot tell blocked from idle
- current progress disagrees with durable attempt history with no freshness signal
- stale `running` posture survives after liveness was lost
- `idle` is shown when recovery actually exists but projection coverage is incomplete
- product UIs invent competing progress semantics because no canonical view exists

## Relationship To Adjacent Specs

- [52-proactive-standing-rebuild-attempt-record-contract.md](52-proactive-standing-rebuild-attempt-record-contract.md)
  defines the append-only chronology this view summarizes.
- [49-proactive-standing-rebuild-request-contract.md](49-proactive-standing-rebuild-request-contract.md)
  defines the request state this view must surface.
- [54-proactive-standing-operator-action-record-contract.md](54-proactive-standing-operator-action-record-contract.md)
  defines the latest manual action history this view may surface when blocked recovery is being
  handled manually.
- [41-proactive-standing-view-store-and-rebuild-contract.md](41-proactive-standing-view-store-and-rebuild-contract.md)
  defines the separate standing projection that recovery progress must not replace.
- [39-proactive-standing-watermark-and-reconciliation-contract.md](39-proactive-standing-watermark-and-reconciliation-contract.md)
  defines the broader watermark and trust posture discipline this progress view should stay
  compatible with.
- [55-proactive-rebuild-progress-field-families-contract.md](55-proactive-rebuild-progress-field-families-contract.md)
  defines the semantic field families this progress view should expose so freshness, coverage, and
  read safety remain explicit.
