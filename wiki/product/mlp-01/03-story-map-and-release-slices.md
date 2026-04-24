# Story Map And Release Slices

## Purpose

This page converts the MLP-01 trust journey into releaseable proof milestones.

## Story-Mapping Thesis

Slices follow trust proof, not subsystem taxonomy.

Each slice must close one user-visible question about whether a weak human can delegate to a
stronger trader-system candidate.

## User Activities And Tasks

| Activity | User-visible tasks |
| --- | --- |
| See candidate systems | inspect small pool, compare candidate identity, understand provenance |
| Understand system artifact | inspect image version, brain/team spec, capability packages |
| Evaluate under bindings | see backtest/paper runs as bindings for the same artifact |
| Decide promotion | inspect counted evidence and live-gate meaning |
| Let one pod trade live | see bounded order intent, gateway decision, live status |
| Stay in control | inspect, pause, stop, override, audit |

## Canonical Release Slices

### Slice 1: Trader-System Candidate Becomes Real

Trust question:

**What system is this?**

Closes:

- small pool can produce durable `TraderSystemCandidate` records
- candidate image and capability package references are inspectable
- candidate is no longer chat/runtime residue

Visible proof:

- the operator can inspect one candidate system and know what artifact will be evaluated

### Slice 2: Candidate Becomes Externally Evaluated

Trust question:

**Why should I trust this candidate?**

Closes:

- same artifact can run under a backtest binding
- trace is externalized
- counted and non-counted evidence are separated
- hold/reject/promotion meaning is visible

Visible proof:

- the product governs evaluation instead of trusting agent self-report

### Slice 3: One Candidate Runs As Bounded Live Trader-System Pod

Trust question:

**Can I actually let this system trade?**

Closes:

- one promoted candidate runs under live binding
- agent produces bounded `OrderIntent`
- autokairos gateway owns execution authority
- live state is inspectable

Visible proof:

- this is real live delegation, not paper theater or direct unbounded agent access

### Slice 4: Live Pod Remains Controllable

Trust question:

**Can I stay in control after delegation?**

Closes:

- meaningful wake reasons exist
- inspect context is available
- pause, stop, override are decisive
- operator action history is auditable
- self-evolution creates cloned candidate versions for re-evaluation

Visible proof:

- the operator can delegate without becoming the permanent runtime

## Slice Dependency Logic

- Slice 1 must come first because evaluation cannot judge an undefined system.
- Slice 2 must come before Slice 3 because live without external evidence is reckless.
- Slice 3 must come before Slice 4 because intervention needs a real live pod to control.
- Slice 4 is still part of MLP-01 because live delegation without recovery/control is not lovable.

## Branch Markers

- `hold` and `reject` belong to Slice 2 as trust-preserving evaluation outcomes.
- `clone` belongs to Slice 4 as the safe self-evolution branch.
- `intervene` belongs to Slice 4 as the live-control branch.

## Relationship To PRDs

| Slice | PRD |
| --- | --- |
| Slice 1 | [prds/01-trader-system-candidate-becomes-real.md](prds/01-trader-system-candidate-becomes-real.md) |
| Slice 2 | [prds/02-candidate-becomes-externally-evaluated.md](prds/02-candidate-becomes-externally-evaluated.md) |
| Slice 3 | [prds/03-bounded-live-trading-system-pod.md](prds/03-bounded-live-trading-system-pod.md) |
| Slice 4 | [prds/04-live-pod-remains-controllable.md](prds/04-live-pod-remains-controllable.md) |

## Slice Acceptance Test

The slice map is correct only if a reader can explain:

- why the first slice is candidate-system identity
- why capability packages are inspectable before evaluation
- why external evidence precedes live promotion
- why bounded live authority precedes wake/control
- why self-evolution is clone/evaluate/promote
