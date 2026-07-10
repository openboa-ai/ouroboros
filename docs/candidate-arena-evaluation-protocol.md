# CandidateArena Evaluation Protocol

Status: P0 target contract. This document defines the first implementation frontier required by
[CandidateArena And Research Goal](candidate-arena-research-goal.md). The current implementation is
not yet evidence of conformance.

## Purpose

AI-agent hill climbing is only useful when the evaluator is harder to exploit than the search is to
run. Trading has observable economic outcomes, but its outcomes are noisy, path-dependent, and
non-stationary. This protocol separates research feedback from qualification evidence so
Ouroboros can learn continuously without presenting adaptive overfitting as product proof.

This protocol uses existing canonical nouns such as `ResearchPreflight`, `PaperTradingEvaluation`,
`PaperTradingQualification`, `TradingSystem`, `SystemCode`, `Finding`, and `Lineage`. Labels such as
"research-feedback window" and "qualification window" describe evidence purpose; they do not add
persisted schema names. Any future public or persisted fields require a separate taxonomy decision.

## Non-Negotiable Rules

1. Evaluation authority remains outside the candidate and ResearchWorker.
2. Evidence purpose is committed before the window starts and cannot be upgraded after results are
   known.
3. Evidence released into research context is adaptive feedback and cannot also be independent
   qualification evidence.
4. Candidate identity and evaluation policy are frozen before prospective qualification begins.
5. Direct candidate comparisons require the same eligible market opportunity stream and compatible
   account, cost, execution, and risk assumptions.
6. Profit is the objective; risk, evidence, authority, and operating limits are hard gates rather
   than score weights that profit can offset.
7. Valid negative results remain research memory. Invalid results remain quarantined evidence and
   cannot become runnable paper candidates.
8. Research and paper remain public-data and fake-execution only.

## Evidence Lifecycle

| Evidence stage | Visible to ResearchWorker | May guide future research | May admit a candidate | May qualify a candidate |
| --- | --- | --- | --- | --- |
| Inspectable research experiment | Yes | Yes | No | No |
| Sealed `ResearchPreflight` | Aggregate feedback only | Yes | Yes, subject to admission | No |
| Paper research-feedback window | Yes after each declared release point | Yes | Already admitted | No |
| Prospective paper qualification window | No outcome feedback before close | Only after adjudication | Already admitted and frozen | Yes |
| Closed `Finding` and `Lineage` | Yes | Yes | No retroactive upgrade | Preserves the completed decision only |

Research feedback and qualification are different evidence purposes even when both use
`PaperTradingEvaluation`. One physical observation or window cannot carry both purposes.

When a qualification window closes, its adjudicated result may become next-generation research
memory. That release does not contaminate the decision already made from the closed window, but the
same evidence cannot be reused as fresh qualification for a descendant candidate.

## Candidate Freeze

Before qualification evidence starts, the evaluation record must commit at least:

- candidate and `SystemCode` identity plus content digest;
- model and provider configuration that affects decisions;
- dependency closure and runtime image or environment identity;
- allowed tools, network destinations, and data sources;
- Gateway, fee, funding, slippage, fake-account, and risk-policy versions;
- initial account state and evaluation-window eligibility rules;
- decision-event protocol and declared persistent-state boundary.

Market observations, account state, positions, tool results, and declared runtime memory may evolve
inside the frozen envelope. A change to code, prompts, model configuration, dependencies,
permissions, decision policy, or undeclared state creates a new candidate and lineage before more
qualification evidence can count.

## Comparable Trading Evidence

A higher paper score is only a direct challenger-over-champion result when the comparison is fair.

- Champion and challenger consume the same public market opportunity stream over the same committed
  interval, preferably as concurrent isolated paper sessions.
- The champion's continuing paper session is not owned by a ResearchWorker. Research or challenger
  failure cannot stop or mutate it, and replacement requires an explicit qualified transition.
- Each candidate has an independent fake account but the same initial balance, fee, funding,
  slippage, fill, leverage, and risk policy.
- Both use the Gateway-owned `MarketDataPort` and public execution evidence. Direct exchange access
  is a veto.
- Each `TradingSystem` keeps its own decision cadence. Observation checkpoints consume emitted
  `OrderRequest`s or record no-order continuity; they never force equivalent trade counts.
- Eligibility, duration, minimum evidence, regime claims, and comparison rule are committed before
  outcomes are visible.
- A run may support only the market regimes and horizon it actually observed. It cannot prove
  universal adaptability.

If concurrent comparison is unavailable, a sealed identical event stream may support
`ResearchPreflight`, but it does not replace prospective paper qualification. Candidates evaluated
on unrelated calendar windows cannot support a direct superiority claim without an explicit
uncertainty model and a precommitted comparison policy.

## Evaluator Information Barrier

The evaluator and its durable logs live outside ResearchWorker and candidate sandboxes.

- Hidden outcomes, future events, raw labels, evaluator implementation, held-out event selection,
  and per-example correctness remain unavailable. The committed duration and policy are visible
  when a candidate needs them to operate, but cannot change after outcomes are observed.
- `ResearchPreflight` may return bounded aggregate feedback needed for hill climbing. Query budgets,
  rate limits, granularity, and repeated-submission detection are evaluator policy.
- Qualification outcomes remain sealed until the window closes or the run is invalidated.
- Score probing, seed cherry-picking, window selection after observation, evaluator endpoint
  exfiltration, and side-channel access are recorded as anti-hacking findings.
- Candidate-authored metrics and explanations are trace only. Gateway, fake account, evaluator, and
  Ledger records calculate counted results.
- ResearchWorkers may inspect process evidence such as their own logs and failed experiments, but
  cannot inspect evidence reserved for qualification.

## Admission And Quarantine

| Outcome | Required treatment |
| --- | --- |
| Valid and distinct preflight result | Materialize the candidate and record complete experiment, evaluation, finding, and lineage references. |
| Valid negative economic result | Preserve it as research evidence and lineage; do not erase it or present it as a qualified winner. |
| Duplicate hypothesis, artifact, or behavior | Record the duplicate finding and source lineage; do not allocate a distinct population slot merely because the identifier differs. |
| Crash, malformed output, protocol violation, risk invalidation, provider bypass, hidden-data access, private/live attempt | Quarantine the evidence, create no runnable paper handoff, and preserve the exact failure reason. |
| Infrastructure or evaluator failure | Attribute it to the platform boundary and retry or reroute under policy; do not turn it into a strategy finding or favorable efficiency result. |

Admission is not qualification. A valid candidate may enter the research population and still be
economically weak. A disqualified candidate may remain useful anti-hacking memory but cannot enter
paper qualification.

## Protocol Flow

```text
ResearchDirection
-> long-running ResearchWorker sandbox
-> inspectable experiments and notebook
-> candidate submission
-> sealed ResearchPreflight
-> admit | negative evidence | duplicate | quarantine
-> frozen candidate plus committed evaluation policy
-> paper research-feedback window OR prospective paper qualification window
-> external Gateway, fake account, evaluator, and Ledger evidence
-> close and adjudicate
-> qualification decision
-> release Finding and Lineage to next-generation research memory
```

The `OR` is an evidence boundary. A window selected for research feedback cannot later be promoted
to qualification because its results looked favorable.

## Anti-Hacking Validation

The protocol is not complete until deterministic fixtures and adversarial tests cover at least:

- lookahead or future-event access;
- direct use of an expected answer, hidden direction, or evaluator-only field;
- repeated score probing and differential outcome extraction;
- random-seed or evaluation-window cherry-picking;
- candidate self-reported profit, cost, risk, or execution evidence;
- missing fees, funding, slippage, partial fills, or public execution evidence;
- undeclared leverage, position concentration, liquidation exposure, or risk-policy changes;
- direct market or exchange access outside Gateway and `MarketDataPort`;
- code, prompt, model, dependency, permission, or decision-policy mutation after freeze;
- stale runner, missing Ledger continuity, repeated event consumption, and no-order fabrication;
- duplicate artifacts or behavior submitted under new identifiers;
- platform failure misclassified as successful research efficiency or strategy evidence.

An anti-hacking test passes only when the evaluator rejects or quarantines the submission and the
attempt remains available as a `Finding` for future workers.

## P0 Acceptance Evidence

P0 passes only when all of the following are demonstrated from current code and tests:

1. A failed, crashed, malformed, or disqualified ResearchWorker produces zero runnable paper
   candidates and an exact quarantined finding.
2. A valid loss-making result remains visible research memory without becoming qualification proof.
3. Evidence purpose is immutable and a research-feedback window cannot be relabeled for
   qualification.
4. Candidate freeze rejects or versions every material identity change before more evidence counts.
5. Champion and challenger paper sessions can consume the same public market stream under equal
   account and cost policies while retaining independent decision cadence.
6. Qualification outcomes remain unavailable to ResearchWorkers until close, then become lineage
   input for later generations.
7. Score probing, lookahead, expected-answer access, direct exchange access, and candidate-authored
   metrics are rejected by adversarial tests.
8. Restart and replay preserve evidence purpose, freeze identity, observation consumption, and
   Ledger continuity.
9. Operator read models distinguish research rank, paper collection, qualification, quarantine,
   and authority without triggering mutations.
10. Repo-required docs, architecture, naming, environment, secret, diff, package, and targeted
    runtime checks pass.

## Current Main Gaps

The following current surfaces require implementation work before P0 can pass:

- `packages/application/src/trading/research/replay-trading-api-provider.ts` exposes evaluator-like
  directional hints in its small replay scenario payload.
- `packages/application/src/candidate/arena.ts` combines generation, evaluation recording,
  materialization, adaptive context, and scheduling without a distinct admission policy or frozen
  evidence-purpose boundary.
- `packages/application/src/services/operator.ts` selects a created research candidate for paper
  without a separate conformance proof for the target protocol.
- Paper-board evidence is fed back into new research, but current records do not distinguish that
  adaptive feedback from prospective qualification evidence.
- Current paper sessions do not provide a committed champion-and-challenger comparison on the same
  market opportunity stream.

These are target gaps, not permission to widen one patch across every subsystem. Each implementation
frontier must preserve the full protocol while remaining independently testable.

## Implementation Frontier Order

1. Define evidence purpose, candidate freeze, admission, quarantine, and comparison contracts in
   domain types and persistence validation.
2. Put a dedicated admission policy between `ResearchPreflight` and candidate materialization.
3. Remove evaluator-answer leakage and add adversarial sealed-preflight fixtures.
4. Add immutable research-feedback and qualification window lifecycle.
5. Add comparable concurrent paper sessions for champion and challenger on one public market stream.
6. Release closed findings and lineage to long-running ResearchWorkers without exposing active
   qualification outcomes.
7. Add restart, soak, operator parity, and scientific-control evidence before claiming P0 complete.
