# Product Requirements

These PRDs define MLP-01 as user-journey contracts.

They are not subsystem specs, and they are not the top-level product-definition layer.

They are downstream of:

- product strategy
- product principles
- market / ICP / alternatives
- product metrics and decision rules
- roadmap and decision log
- the `mlp-01` planning pack

Each PRD answers:

- what must work
- why it matters
- what must feel lovable
- what is in and out
- what the acceptance bar is
- which open questions remain
- what architecture must support
- how PRs should be sliced to close meaningful milestones

## PRD Order

1. [01-hypothesis-to-candidate.md](01-hypothesis-to-candidate.md)
   Agent-generated strategy ideas must become real candidates rather than disposable chat output.
2. [02-candidate-evaluation-and-live-gate.md](02-candidate-evaluation-and-live-gate.md)
   Candidates must accumulate counted evidence and reach a clear live-gate decision.
3. [03-live-deployment-and-autonomous-execution.md](03-live-deployment-and-autonomous-execution.md)
   A promoted candidate must actually run live within explicit risk and policy limits.
4. [04-operator-trust-wake-and-intervention.md](04-operator-trust-wake-and-intervention.md)
   The operator must trust, inspect, and intervene without becoming the permanent runtime loop.

## PRD Rule

Architecture and specs should only add detail that is necessary to implement one of these journey
contracts safely.

While the MLP is being locked, do not deepen PRDs in ways that reopen:

- first market scope
- hypothesis origin
- live gate placement
- autonomy posture
