# Evaluation And Progression

This section defines the subsystem that turns candidate activity into trusted progression meaning.

## Why This Exists For MLP-01

MLP-01 depends on one candidate becoming trustworthy before it becomes live.

This subsystem exists to make clear:

- what counted
- what did not count
- why a candidate is stronger, weaker, held, or rejected
- what one serious live gate means

## What This Section Owns

- stage semantics
- counted versus non-counted evidence meaning
- candidate status meaning during progression
- hold, reject, and promotion eligibility meaning
- live-gate meaning above raw run activity

## What This Section Does Not Own

- runtime execution mechanics
- durable record ownership for every judged artifact
- live routine execution behavior
- wake authority

## Supported PRD Acceptance

| PRD | What evaluation and progression must support |
| --- | --- |
| PRD 2 | counted versus non-counted evidence, candidate-status meaning, and one explicit live gate |
| PRD 3 | promotion eligibility that can safely hand off one candidate into real live execution |

## Durable Truth, Interfaces, And Recovery Boundaries

This subsystem owns judgment meaning, not runtime state.

Its interfaces sit between:

- raw trace and candidate-linked run history coming from execution
- durable evidence, review, and decision truth stored in the control plane

Recovery depends on keeping raw run activity, judged evidence, and committed promotion meaning
separate.

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-evaluation-flow.md](02-evaluation-flow.md)
- [03-progression-model.md](03-progression-model.md)
- [04-review-and-decision-path.md](04-review-and-decision-path.md)

## Active Spec Gate

The current active supporting specs are:

- [../specs/03-staged-evaluation.md](../specs/03-staged-evaluation.md)
- [../specs/08-candidate-contract.md](../specs/08-candidate-contract.md)
- [../specs/09-trace-contract.md](../specs/09-trace-contract.md)
- [../specs/10-evidence-record-contract.md](../specs/10-evidence-record-contract.md)
- [../specs/11-promotion-decision-contract.md](../specs/11-promotion-decision-contract.md)
- [../specs/14-review-item-contract.md](../specs/14-review-item-contract.md)

## Not In The Default Baseline

Broader evaluation taxonomies and speculative lower-level detail remain in the repo but are not
part of the current default MLP-01 baseline.
