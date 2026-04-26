# Proactive Standing Trust Downgrade Contract

## Thesis

`CurrentProactiveStandingView` should lose trust explicitly and early whenever authority coverage,
history coverage, linkage coverage, or freshness posture becomes uncertain.

## Why This Spec Exists

autokairos already treats current proactive standing as:

- a rebuildable projection
- a read surface that must expose watermarks and reconciliation posture

That still leaves one operational ambiguity:

**when exactly should the system stop trusting current standing, and what downgrade classes should
exist before full rebuild?**

Without this spec:

- current standing will stay `trusted` too long
- stale proactive posture will look quiet instead of degraded
- rebuild will be overused because intermediate downgrade classes were never designed

## Canonical Object / Interface / Boundary

This spec defines the trust-downgrade boundary for:

1. `CurrentProactiveStandingView.trust_posture`
2. `CurrentProactiveStandingView.reconciliation_status`

It sits above:

- authority and history coverage
- freshness deadlines
- downstream linkage completeness
- updater success or failure

And below:

- operator trust decisions
- runtime wake-context reads
- rebuild orchestration

## Required Fields Or Required Behaviors

## 1. Minimum posture classes

The standing view must support at least these semantic trust classes:

- `trusted`
- `lagging`
- `degraded`
- `blocked`

The exact enum names may vary, but these meanings must remain visible.

## 2. Downgrade triggers

The system must support trust downgrade when one or more of these happens:

- freshness deadline passed without successful reconciliation
- newer proactive evaluation history exists beyond the applied history watermark
- authority changed beyond the applied authority watermark
- emitted or coalesced downstream posture depends on linkage that is still missing
- rebuild or reconciliation previously failed
- projection state is missing or internally inconsistent

## 3. Downgrade behavior

Required behavior:

- `lagging` should mean history or authority is behind but catch-up still looks plausible
- `degraded` should mean standing is readable but not safe for strong operational trust
- `blocked` should mean current standing should not be used for consequential wake decisions until
  rebuild or manual intervention resolves the issue

## 4. Upgrade behavior

Trust may return to `trusted` only when:

- authority watermark is current enough for the governed scope
- history watermark is current enough for the intended use
- required downstream linkage is present or explicitly inapplicable
- reconciliation status is `in_sync` or equivalent

## 5. Required operator/read-surface semantics

The read surface must make it possible to answer:

- is this standing safe enough for operational wake decisions?
- is it merely behind or actually blocked?
- what reason caused the downgrade?
- did trust fall because of time, missing linkage, authority drift, or rebuild failure?

## 6. Required reason visibility

The downgrade surface should expose:

- one structured reason code
- one timestamp for when trust fell
- optional latest failed horizon or missing reference when meaningful

## Lifecycle Or State Model

The trust lifecycle should be read as:

`trusted -> lagging when behind -> degraded when confidence drops -> blocked when trust is operationally unsafe -> trusted again only after explicit reconciliation`

## What This Is Not

This spec is not:

- one SLA monitor
- one UI warning banner
- one backend metric threshold
- a claim that every degraded posture requires immediate rebuild

It is the canonical downgrade semantics only.

## Failure Modes / Invariants

### Invariants

- trust falls before stale standing can masquerade as quiet standing
- downgrade reason remains inspectable
- blocked standing is not silently reused for consequential wake decisions
- trust returns only after explicit coverage and reconciliation

### Failure modes

- standing remains `trusted` while history watermark is behind
- linkage-dependent posture is shown as current without linkage
- rebuild fails but trust posture never changes
- operator reads cannot distinguish minor lag from operationally unsafe standing

## Relationship To Adjacent Specs

- [39-proactive-standing-watermark-and-reconciliation-contract.md](39-proactive-standing-watermark-and-reconciliation-contract.md)
  defines the broader trust and reconciliation posture this spec sharpens.
- [41-proactive-standing-view-store-and-rebuild-contract.md](41-proactive-standing-view-store-and-rebuild-contract.md)
  defines the persisted standing-view shape that carries trust posture.
- [42-proactive-standing-projection-updater-contract.md](42-proactive-standing-projection-updater-contract.md)
  defines the canonical updater that must apply these downgrade rules.
