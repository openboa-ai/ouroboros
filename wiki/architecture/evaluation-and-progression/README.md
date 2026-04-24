# Evaluation And Progression

This section defines the subsystem that turns trader-system candidate runs into trusted progression
meaning.

## Why This Exists For MLP-01

MLP-01 depends on one `TraderSystemCandidate` becoming trustworthy before it can run as a bounded
live `TradingSystemPod`.

This subsystem exists to make clear:

- what counted
- what did not count
- why a candidate version is stronger, weaker, held, or rejected
- what one serious promotion decision means before live binding

## What This Section Owns

- stage semantics
- counted versus non-counted evidence meaning
- candidate-version status meaning during progression
- hold, reject, and promotion eligibility meaning
- promotion-decision meaning above raw run activity

## What This Section Does Not Own

- runtime execution mechanics
- durable record ownership for every judged artifact
- live routine execution behavior
- wake authority

## Supported PRD Acceptance

| PRD | What evaluation and progression must support |
| --- | --- |
| PRD 2 | counted versus non-counted evidence, candidate-version status meaning, and one explicit promotion decision |
| PRD 3 | promotion eligibility that can safely hand off one candidate into a bounded live pod |

## Durable Truth, Interfaces, And Recovery Boundaries

This subsystem owns judgment meaning, not runtime state.

Its interfaces sit between:

- raw trace and candidate-linked run history coming from brain sessions and hands environments
- durable evidence, review, and decision truth stored in the control plane

Recovery depends on keeping raw run activity, custom tool results, outcome/rubric results, judged
evidence, and committed promotion meaning separate.

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-evaluation-flow.md](02-evaluation-flow.md)
- [03-progression-model.md](03-progression-model.md)
- [04-review-and-decision-path.md](04-review-and-decision-path.md)

## Active Spec Gate

The current active supporting specs are:

- [../02-pr2-candidate-becomes-externally-evaluated-design.md](../02-pr2-candidate-becomes-externally-evaluated-design.md)
- [../specs/03-staged-evaluation.md](../specs/03-staged-evaluation.md)
- [../specs/08-candidate-contract.md](../specs/08-candidate-contract.md)
- [../specs/09-trace-contract.md](../specs/09-trace-contract.md)
- [../specs/10-evidence-record-contract.md](../specs/10-evidence-record-contract.md)
- [../specs/11-promotion-decision-contract.md](../specs/11-promotion-decision-contract.md)
- [../specs/14-review-item-contract.md](../specs/14-review-item-contract.md)

Read [../02-pr2-candidate-becomes-externally-evaluated-design.md](../02-pr2-candidate-becomes-externally-evaluated-design.md)
first when implementing Slice 2.

## Not In The Default Baseline

Broader evaluation taxonomies and speculative lower-level detail remain in the repo but are not
part of the current default MLP-01 baseline.
