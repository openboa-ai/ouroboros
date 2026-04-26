# Proactive Rebuild Progress Field Families Contract

## Thesis

`CurrentProactiveRebuildProgressView` should be shaped as stable semantic field families so
freshness, coverage, and read safety stay explicit without freezing one storage schema.

## Why This Spec Exists

autokairos already defines:

- append-only rebuild attempt history
- append-only operator action history
- a rebuildable current progress view with explicit read semantics

Implementation still needs one narrower contract:

**what field families must exist so the progress view can express current recovery posture without
collapsing freshness, coverage, and chronology into one mutable status row?**

Without this spec:

- one implementation may expose only `status`
- another may expose only timestamps
- automation-safe reads may become inconsistent because required semantic groups were never fixed

## Canonical Object / Interface / Boundary

This spec defines semantic field families for:

1. `CurrentProactiveRebuildProgressView`

It does not require one exact column list or JSON schema.

## Required Fields Or Required Behaviors

## 1. Identity and linkage family

The progress view must carry an identity and linkage family that answers:

- which governed scope is this about?
- which rebuild request is currently active or most relevant?
- which attempt is active or latest?
- which terminal attempt most recently completed, failed, or blocked?

The exact fields may vary, but this family should support at least:

- `governed_scope_key`
- `active_or_latest_rebuild_request_ref`
- `active_or_latest_rebuild_attempt_ref`
- `last_terminal_rebuild_attempt_ref` or equivalent

## 2. Posture and reason family

The progress view must carry a posture family that answers:

- what is the current recovery posture?
- what is the visible reason for blocked, failed, unknown, or waiting posture?
- what phase or strategy hint is currently most relevant?

The exact fields may vary, but this family should support at least:

- `current_rebuild_posture`
- `current_phase_hint` or equivalent
- `current_strategy_hint` or equivalent
- `primary_reason_code`

## 3. Freshness family

The progress view must carry a freshness family that answers:

- when was progress last observed?
- when should this view stop being treated as current if nothing new arrives?
- is the view currently fresh, lagging, stale, or unknown?

The exact fields may vary, but this family should support at least:

- `last_progress_observed_at`
- `freshness_deadline_at` or equivalent
- `freshness_posture`
- `freshness_reason_code` when posture is not fresh

## 4. Coverage family

The progress view must carry a coverage family that answers:

- which request history is covered?
- which attempt history is covered?
- which operator action history is covered when relevant?
- is the current read complete enough for its intended use?

The exact fields may vary, but this family should support at least:

- `request_watermark` or equivalent request-coverage marker
- `attempt_watermark` or equivalent attempt-coverage marker
- optional `operator_action_watermark`
- `coverage_posture`
- `coverage_reason_code` when coverage is partial or unknown

## 5. Terminal-summary family

The progress view must carry a terminal-summary family that answers:

- what was the most recent meaningful terminal outcome?
- when did it happen?
- what object did it lead to?

The exact fields may vary, but this family should support at least:

- `latest_terminal_outcome_class`
- `latest_terminal_at`
- `latest_resulting_ref` or equivalent

## 6. Read-safety family

The progress view must carry a read-safety family that answers:

- may an automation treat this as a safe current read?
- should the caller fall back to deeper chronology?
- is this only good enough for operator inspection?

The exact fields may vary, but this family should support at least:

- `read_safety_posture` or equivalent
- `deeper_read_required` or equivalent
- optional `recommended_read_class`

## 7. Separation rule

These families must remain semantically distinct.

Required behavior:

- freshness posture must not be inferred only from coverage posture
- coverage posture must not be inferred only from current status
- terminal summary must not replace active posture
- read safety must not be inferred only from one timestamp

## 8. Flexibility rule

This spec must not require:

- one exact relational schema
- one wire payload
- one store technology
- one background-task runtime

It fixes semantic field families only.

## Lifecycle Or State Model

The field-family lifecycle should be read as:

`identity and linkage established -> posture and reason change over time -> freshness and coverage drift independently -> terminal summary updates on meaningful completion -> read-safety posture changes as freshness and coverage change`

## What This Is Not

This spec is not:

- one final table definition
- one protobuf schema
- one dashboard card contract
- one replacement for deeper rebuild chronology

It is the semantic field-family contract only.

## Failure Modes / Invariants

### Invariants

- progress reads always expose enough fields to separate identity, posture, freshness, and coverage
- stale recovery never looks current only because the status still says `running`
- partial chronology coverage is readable as partial rather than silently complete
- callers can tell when to fall back to deeper history

### Failure modes

- one implementation publishes only `status` and loses freshness semantics
- another publishes only timestamps and loses posture semantics
- blocked, unknown, and idle become UI-only distinctions
- automation reads use stale progress because read-safety posture was never modeled

## Relationship To Adjacent Specs

- [53-proactive-standing-rebuild-progress-view-contract.md](53-proactive-standing-rebuild-progress-view-contract.md)
  defines the higher-level read semantics these field families must satisfy.
- [56-proactive-rebuild-read-safety-classes-contract.md](56-proactive-rebuild-read-safety-classes-contract.md)
  defines the caller-class admission rules that evaluate these field families differently for
  operator, automation-safe, and audit reads.
- [52-proactive-standing-rebuild-attempt-record-contract.md](52-proactive-standing-rebuild-attempt-record-contract.md)
  defines the attempt chronology many coverage markers should summarize.
- [54-proactive-standing-operator-action-record-contract.md](54-proactive-standing-operator-action-record-contract.md)
  defines the manual action history that the coverage family may need to summarize.
- [39-proactive-standing-watermark-and-reconciliation-contract.md](39-proactive-standing-watermark-and-reconciliation-contract.md)
  provides the broader watermark and trust discipline this progress-field contract should remain
  compatible with.
