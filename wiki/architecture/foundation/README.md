# Foundation

This section defines the small set of architectural ground rules that MLP-01 implementation may
not violate.

## Why This Exists For MLP-01

Foundation exists so the current product contracts do not collapse into fuzzy technical language.

It keeps the current architecture baseline honest about:

- what a `candidate` is
- what `counted evidence` means
- where `promotion` ends and `live execution` begins
- where `wake` and `control` sit relative to the runtime

## What This Section Owns

- naming and vocabulary discipline
- documentation doctrine
- architecture restraint rules
- core primitives and boundary language
- the small invariant set that all other subsystem docs must respect

## What This Section Does Not Own

- runtime lifecycle
- evidence evaluation logic
- live trading behavior
- wake generation
- durable record implementation

## Supported PRD Acceptance

| PRD | What foundation keeps explicit |
| --- | --- |
| PRD 1 | hypothesis, candidate, provenance, and durable-truth boundaries |
| PRD 2 | counted versus non-counted evidence, stage meaning, and live-gate meaning |
| PRD 3 | explicit live-limit and stage-boundary language, plus adapter-friendly first-venue depth |
| PRD 4 | wake, intervention, operator action, and audit boundaries |

## Durable Truth, Interfaces, And Recovery Boundaries

Foundation does not store durable truth itself.

Its job is to make sure downstream subsystems do not confuse:

- runtime state with durable truth
- raw trace with judged evidence
- live execution with wake authority
- operator control with manual runtime ownership

Recovery at this layer means reconciling vocabulary and boundary drift before implementation does.

## Current Active Docs

- [01-naming-and-vocabulary.md](01-naming-and-vocabulary.md)
- [02-documentation-doctrine.md](02-documentation-doctrine.md)
- [04-invariants-and-extensibility.md](04-invariants-and-extensibility.md)

## Active Spec Gate

The current active supporting specs are:

- [../specs/02-core-primitives.md](../specs/02-core-primitives.md)
- [../specs/04-boundaries.md](../specs/04-boundaries.md)

## Not In The Default Baseline

Diagramming policy, longer first-principles essays, and other foundation background remain in the
repo but are not part of the default MLP-01 implementation path.
