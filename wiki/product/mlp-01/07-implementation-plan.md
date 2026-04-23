# MLP-01 Implementation Plan

This page is the canonical implementation entry point for MLP-01.

It turns the locked product stack into one build sequence and first PR breakdown that an
implementer can execute without rediscovering product meaning.

It is downstream of:

- [00-mlp-brief.md](00-mlp-brief.md)
- [01-problem-jtbd-and-value.md](01-problem-jtbd-and-value.md)
- [02-journey-map.md](02-journey-map.md)
- [03-story-map-and-release-slices.md](03-story-map-and-release-slices.md)
- [04-scope-and-cutline.md](04-scope-and-cutline.md)
- [05-success-metrics-and-launch-bar.md](05-success-metrics-and-launch-bar.md)
- [06-risks-and-open-questions.md](06-risks-and-open-questions.md)
- [prds/README.md](prds/README.md)
- [../../architecture/README.md](../../architecture/README.md)

Old subsystem-level implementation plans remain background only.

They are not the current canonical build path.

## Goal

Build one believable delegated live path in the same order the user must learn to trust it.

That means implementation must follow the locked trust-proof milestones rather than subsystem
taxonomy.

The active implementation contract is:

- PRD 1 through PRD 4 are fixed
- architecture is downstream support, not competing truth
- one PR should close one visible milestone whenever possible
- plumbing-only PRs are allowed only when they directly unblock the current milestone

There is also one operational prerequisite before implementation PRs begin:

- normalize the current repo state so canonical docs are tracked or intentionally staged rather than
  living inside an effectively untrusted `wiki/` state

This prerequisite is not product work, but it is required before serious implementation starts.

## Build Order

The build order is fixed.

It must not be reordered for technical convenience.

### 1. Slice 1 / PRD 1: Path Becomes Real

Build the minimum path that proves:

- one serious agent-originated path can surface
- that path becomes one durable candidate
- provenance is inspectable
- the operator no longer carries the record manually

This stage does **not** prove legitimacy, promotion, live execution, or intervention.

### 2. Slice 2 / PRD 2: Path Becomes Trustworthy

Build the minimum path that proves:

- trace can become judged evidence
- counted versus non-counted evidence is visible
- candidate status meaning is readable:
  stronger, weaker, hold, reject
- one explicit live gate exists with clear promotion meaning

This stage does **not** yet prove real live execution or wake/control recovery.

### 3. Slice 3 / PRD 3: Path Can Really Trade

Build the minimum path that proves:

- one governed request can become real live execution
- Binance BTC perpetual futures is a usable first-venue substrate
- routine live actions can continue without per-action operator approval
- explicit live limits and bounded autonomy are real

This stage does **not** yet prove trustworthy wake or control recovery.

### 4. Slice 4 / PRD 4: Delegation Stays Safe Under Live Conditions

Build the minimum path that proves:

- meaningful wake reasons exist
- the operator can inspect the situation quickly
- pause, stop, and override are decisive
- operator action and wake history remain durable and auditable

This stage closes the lovable proof.

## Interfaces To Define First

The first implementation-critical interface set is intentionally small.

These interfaces exist to preserve PRD boundaries before coding expands.

| Interface / boundary | Why it must exist first | Primary owner |
| --- | --- | --- |
| `Candidate` | Makes one surfaced path durable and inspectable | `control-plane` |
| provenance / candidate materialization boundary | Separates path origination from durable truth | `control-plane` |
| `Trace` | Preserves raw execution history before judgment | `agent-system` |
| `EvidenceRecord` | Separates judged evidence from raw trace | `evaluation-and-progression` |
| `PromotionDecision` | Makes live-gate meaning explicit and durable | `evaluation-and-progression` |
| `ReviewItem` | Preserves pending governance work between evidence and decision | `control-plane` |
| `GovernedExecutionRequest` | Separates promotion meaning from real live execution | `control-plane` |
| `ExecutionAttempt` | Makes concrete live execution reconstructable outside runtime state | `agent-system` |
| `WakePolicy` | Keeps wake authority above the runtime | `proactive-operations` |
| `WakeTriggerRecord` | Makes wake reason durable and explainable | `control-plane` |

These are the minimum object boundaries needed to keep:

- candidate creation distinct from legitimacy
- legitimacy distinct from live execution
- live execution distinct from wake and intervention history

## First PR Breakdown

The first PR sequence should be:

### PR 1

- one serious path surfaces
- one durable candidate is created
- provenance is inspectable
- no legitimacy, promotion, or live meaning yet

### PR 2

- trace and evidence path exists
- counted versus non-counted evidence becomes visible
- candidate progression meaning becomes readable

### PR 3

- one explicit live gate exists
- promotion rationale is durable and inspectable
- live approval meaning is clear before any real live execution begins

### PR 4

- one promoted candidate can trade live on Binance BTC perpetual futures
- routine live behavior runs within explicit limits
- the live path is clearly real rather than ceremonial

### PR 5

- meaningful wake reason
- inspect context
- pause, stop, and override
- durable operator action and wake history

PR sequence rules:

- do not split candidate creation from durable candidate materialization unless absolutely necessary
- do not ship live execution before legitimacy visibility and gate meaning exist
- do not move wake/intervention earlier in a way that blurs the Slice 3 / Slice 4 boundary
- do not quietly broaden venue scope, operator model, or platform ambition inside delivery PRs

## Risks And Failure Modes

The implementation must guard against these failures:

- candidate creation stays transient and the operator remains the system of record
- evidence looks plentiful but counted versus non-counted meaning stays ambiguous
- live gate exists only as a ceremonial approval surface
- exchange connectivity is mistaken for a believable delegated live path
- hidden operator labor remains the real runtime behind the product
- wake surfaces are noisy or vague enough that the operator returns to constant shadow monitoring
- subsystem-first work expands faster than trust-proof milestones land
- repo-state ambiguity causes implementation to target documentation that is not safely versioned

## Test And Acceptance Criteria

The implementation-planning layer is correct only if:

1. one reader can explain what gets built first and why the order is fixed
2. the build order matches the PRD trust-proof order exactly:
   PRD 1 -> PRD 2 -> PRD 3 -> PRD 4
3. the first interface set is clear enough that an implementer does not invent new product meaning
   at the boundary lines
4. the first PR sequence does not blur:
   candidate creation with legitimacy,
   legitimacy with live execution,
   live execution with wake/intervention
5. the implementation path still honors the launch and fake-success rules from
   [05-success-metrics-and-launch-bar.md](05-success-metrics-and-launch-bar.md)
6. canonical implementation docs are tracked or intentionally staged before coding begins

## Explicitly Deferred

The first implementation sequence does not include:

- additional venues beyond Binance BTC perpetual futures
- broader multi-strategy or portfolio orchestration
- team approvals or multi-operator workflow
- public platform breadth or generic plugin expansion
- wider analytics suites that do not directly strengthen the first lovable proof
- subsystem-deep speculative work that is not required by the current PRD milestones

## Read Next

1. [prds/README.md](prds/README.md)
2. [../../architecture/README.md](../../architecture/README.md)
3. [../../architecture/00-system-map.md](../../architecture/00-system-map.md)
4. [../../architecture/01-pr1-path-becomes-real-design.md](../../architecture/01-pr1-path-becomes-real-design.md)
   for the canonical PR1 implementation shape
