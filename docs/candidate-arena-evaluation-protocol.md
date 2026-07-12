# CandidateArena Evaluation Protocol

Status: P0 target contract with partial implementation evidence. This document defines the bounded
frontiers required by [CandidateArena And Research Goal](candidate-arena-research-goal.md). Current
commitment, admission, sealed comparison, confirmation, causal ResearchRelease, explicit
comparison-backed TradingPromotion, and bounded adaptive ResearchWorker allocation tests
demonstrate only the explicitly listed partial conformance; they do not establish production
composition, automatic champion operation, or P0 completion.

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

Prospective comparison preparation uses `PaperTradingComparisonPreparationRecord` and accepts only
already-admitted, frozen candidates. Each side binds one exact `CandidateAdmissionDecisionRecord`
with `status: "admitted"`, runnable paper handoff, `not_live` authority, and SystemCode
identity/digest matching its CandidateVersion; duplicate, quarantined, missing, or mismatched
evidence is rejected before any preparation or side write. Bootstrap requires no current
TradingPromotion. Champion challenge binds the exact current TradingPromotion and its full-record
digest plus champion refs. It also binds the promotion's exact stopped `PaperTradingEvaluation`,
exact qualification commitment, and ordered observation chain; the total domain closure must
satisfy runtime shape and causality, and the one domain qualification decision must return
`qualified` with `runnerActive: false` after the accepting boundary independently verifies the
commitment self-digest. The application qualification API delegates to that decision. Preparation
time is server-owned. The promotion and preparation must bind the same exact evaluation ref; a
second chain for the same candidate, CandidateVersion, and SystemCode is not interchangeable.
The persisted graph remains inert, binds one exact baseline commitment/evaluation chain per side
`TradingRun`, and does not activate qualification, repair a post-pair graph, mutate pair-bound side
evidence, or by itself implement promotion behavior. One first shared tick and one separate
`PaperTradingComparisonActivation` authorization may now be appended while both sides remain inert.
The authorization freezes paper-only start, cleanup, retry, request-budget, restart, and market-view
policy; it is not proof of runtime start or evidence consumption. The internal symmetric runtime
coordinator now persists one attempt before effects, starts both sides in parallel against the fixed
first-tick view, records per-side start/stop results, enforces time, skew, and request bounds, and
persists only `both_running`, `stopped_cleanly`, or `cleanup_required`. Restart recovery never
resumes a side or claims a process-local provider survived; it stops both or leaves cleanup required.
`both_running` is zero-observation operational evidence only. The internal checkpoint coordinator
persists each checkpoint intent before side effects, prepares both sides concurrently without
economic writes, and commits both Ledger/Observation/Evaluation transitions plus one `paired`
outcome through a single recoverable LocalStore bundle. Sequence 1 consumes the exact stored first
tick and is the sole acknowledgement-optional exception. Silence, `hold`, and `no_action` remain
valid no-order continuity; malformed candidate events remain paired negative evidence.

After sequence 1, each role-bound provider can append one deterministic
`PaperTradingComparisonTickDelivery` before a candidate-facing market response and one exact
`PaperTradingComparisonTickAcknowledgement` after the candidate returns its opaque context. Once
both roles acknowledge the current tick, the next-tick coordinator can append one contiguous
Gateway-owned tick. `beginNext` persists checkpoint attempt N before advancing both provider views;
`completeNext` requires distinct exact acknowledgements for that tick and atomically commits both
sides. Every newly consumed sequence-N event must echo its role's exact acknowledgement; no event
is valid acknowledged silence. The implemented end-to-end proof reaches sequence 3 while the data
and coordinator contracts are sequence-N. Startup, candidate input, account reads, order
validation, and checkpoint preparation create no delivery or acknowledgement record. Those records
are non-economic causal evidence only and grant no lifecycle, Ledger, evaluation, private,
direct-order, verdict, promotion, or live authority. Restart rematerializes committed bundles,
stops unowned sessions, and never fabricates view, delivery, acknowledgement, decision, or economic
evidence. Internal bounded cadence through the frozen maximum, minimum-window paired qualification,
one single-window verdict, and a precommitted multi-window confirmation campaign are implemented.
Post-campaign ResearchRelease and explicit comparison-backed TradingPromotion are implemented.
Process resume, production comparison scheduling, automatic promotion, champion runner handoff,
and private/live authority remain pending.

After a comparison settles, `PaperTradingComparisonVerdictService` first reruns paired
qualification, reloads exact terminal evidence, and asks LocalStore to persist one append-only
`PaperTradingComparisonVerdict`. A qualified verdict compares only both stopped evaluations'
`net_revenue_usdt` after costs against the frozen minimum lift. A strictly positive lift meeting the
minimum is `challenger_improved`; equal, negative, or below-threshold evidence is
`challenger_not_improved`. A settled unqualified comparison is `comparison_ineligible` and carries
no side score or metric fields. Every outcome is sealed, externally evaluated, promotion-ineligible,
paper-only, and `not_live`. The record's window begins at the first shared tick and ends at the
latest tick; the qualification elapsed minimum remains activation-attempt time through the latest
tick. Exact replay, including after restart and clock advance, reuses the sealed evaluation time.
Any terminal verdict releases only the experiment pair for a new precommitted comparison. It does
not count confirmation, select a champion, release Finding/Lineage memory, create TradingPromotion,
or enter a public/operator surface.

One exact sealed `challenger_improved` verdict may start a
`PaperTradingComparisonConfirmationCampaign`, but that source verdict never counts as a campaign
result. The campaign freezes every deterministic future slot, the exact pair and policies, strict
sequence, non-overlap, bounded start delay, and `all_reserved_windows_must_improve` before its first
tick. Each slot materializes only after the prior slot's verdict; negative or ineligible evidence
cannot stop the campaign early, and missed unmaterialized slots become explicit expiry results.
Only all improved reserved slots produce a sealed protocol-level `eligible` campaign outcome. Mixed,
ineligible, or expired campaigns are `not_confirmed`. Exact outcome replay survives restart and
clock advance, while active pair ownership is released only by the aggregate outcome. Raw campaign
records and outcomes remain hidden from CandidateArena memory and public/operator surfaces. An
outcome cannot create TradingPromotion by itself; only the explicit `trading_candidate.promote`
command may consume a terminal eligible all-improved campaign after exact current-champion
revalidation. The transition exposes compact confirmation provenance in Trading review and grants
no CandidateArena, runner, private, direct-order, or live authority.

One terminal outcome becomes visible to later ResearchWorkers only through an append-only
`PaperTradingComparisonResearchRelease`. The service deterministically classifies all-improved,
observed non-reproduction, ineligible-only, and expired evidence; binds the challenger admission
Finding and original ArtifactLineage; and persists one bundle before materializing its exact new
Finding and extended Lineage. LocalStore freezes those child IDs and rematerializes missing children
from the bundle after restart. Raw outcomes never enter CandidateArena by fallback. The compact
`released_campaign_findings` projection omits slot economics and promotion fields, while the
released direction and release kind contribute `unknown`-regime FindingCluster pressure under
`not_promotion_authority`. An unreleased/released ablation proves only the accepted release changes
the next default ResearchDirection order. Release does not change eligibility, leaderboard,
Trading review, TradingPromotion, private access, direct orders, or live authority.

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

## Implemented Session Boundary

One frozen `CandidateVersion` may own its default continuous paper TradingRun plus additional
internal paper-only TradingRuns. `CandidateVersion.runtime_ref` remains the compatibility/default
continuous-session pointer. An activated additional `research_feedback` run owns its own provider,
sandbox, fake account, evaluation and observation cursors, Ledger, lifecycle, and cleanup. Public
start, observe, and stop stay on the default `research_feedback` session and reject every additional
run, evidence purpose, or comparison ID.

An internal qualification-purpose run may be prepared as persistence-only state, but it is inert:
preparation owns only the persisted TradingRun and supporting refs, frozen executable and account
identity, commitment, and `not_started` evaluation. The implemented comparison coordinator can
persist and verify the complete pair commitment graph, but it must not start a provider or sandbox,
read market data, create Gateway or Ledger evidence, consume an observation, or mutate lifecycle.
A separate internal first-tick coordinator may reload that verified inert graph, perform exactly one
Gateway market read plus one public-execution read, and atomically persist one fresh no-gap
`PaperTradingComparisonTick`. Its fixed `ComparisonMarketDataView` serves only that stored content
without retaining a Binance delegate. An internal effect-free authorization coordinator may then
bind the exact verified pair, sole first tick, side refs, and derived bounded policy into one
append-only `PaperTradingComparisonActivation`. Capture and authorization leave both side
evaluations `not_started` and have no provider, sandbox, runner, Gateway order, Ledger, observation,
run-control, verdict, promotion, or public dependency.

The internal runtime-activation coordinator consumes only that authorization. It appends a
`PaperTradingComparisonActivationAttempt` before external effects, gives both isolated sides the
same non-delegating first-tick view, and starts them concurrently through a focused internal session
port. The paper API provider rejects requests beyond the frozen per-side cap before market, account,
or order handlers. Every sandbox, run-control, and zero-evidence evaluation transition carries the
exact activation/attempt/role/operation Store context; observations, Ledger writes, score/account
changes, candidate/code drift, verdicts, and promotion remain forbidden. Per-side settlements are
append-only `PaperTradingComparisonActivationSideResult` records. Pair reconciliation is a
sequenced `PaperTradingComparisonActivationOutcome` and can claim only `both_running`,
`stopped_cleanly`, or `cleanup_required`; timeout and late settlement remain uncertain until durable
cleanup proves otherwise. Startup recovery treats every unclaimed `both_running` pair as unowned and
stops both sides. Public/default qualification activate, observe, schedule, stop, and recovery paths
remain rejected or skipped.

The checkpoint boundary consumes only events attributable to its exact stored tick. It refreshes
sandbox evidence under checkpoint-scoped authority, previews Ledger writes, and commits neither
side unless one atomic bundle contains both sides and the paired outcome. A crash before the bundle
leaves no economic write; a crash after it rematerializes the same records. Sequence 1 consumes the
first tick without acknowledgement. Sequence 2+ requires the exact role-bound tick acknowledgement
for every event or for acknowledged silence. Startup recovery never reconstructs a candidate
decision and stops unowned sessions.

Once the exact first paired bundle exists, `PaperTradingSessionService` may enable dormant
comparison hooks separately for the two owned roles. Only a successful candidate-facing
`GET /market/snapshot` persists a role/run/tick-bound delivery before returning its context, and only
`POST /comparison/tick/ack` with that exact context persists the matching acknowledgement. Repeated
requests reuse the deterministic records while still consuming the frozen provider-request budget.
These hooks do not read a new market source or expose peer state. They are an internal transport
protocol, not an `OuroborosCommand`; existing first-checkpoint economics remain unchanged. After
both roles acknowledge the current tick, `captureNextTick` performs one Gateway market and one
public-execution read and persists a contiguous next tick without changing either provider view.
`beginNext` persists the next checkpoint attempt before synchronously replacing both owned bindings
with immutable views of that tick. `completeNext` requires both exact acknowledgements, prepares
both sides under one deadline, and commits one recoverable atomic bundle. Partial advance,
preparation, deadline, request-budget, or persistence failure stops both sides and records no
one-sided economic evidence. The Store/session path is proven through sequence 3 without provider
or sandbox restart. An internal graph reader and one-step driver reconstruct each legal phase, and
a process-local runner schedules non-overlapping steps until the frozen observation/time maximum.
Normal stopping never depends on current score. Restart rematerializes committed bundles and stops
unowned sessions rather than adopting provider identity. No app/controller/public command or
process-resume path is composed for this runner. Qualification, adjudication, ResearchRelease, and
explicit TradingPromotion remain separate boundaries; the promotion command consumes sealed
evidence without composing, starting, stopping, or adopting this runner.

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
- `packages/application/src/services/operator.ts` selects a created research candidate for paper
  without a separate conformance proof for the target protocol.
- The internal comparison coordinators can create and verify an inert prospective `qualification`
  pair, persist a contiguous Gateway-owned tick sequence, run both paper-only sides, record exact
  role-bound delivery and acknowledgement, and atomically commit paired observations through a
  proven third checkpoint. Internal application-only driver/runner components can advance an owned
  graph to its frozen maximum boundary. A read-only paired qualification service now admits only a
  cleanly stopped window whose shared count/elapsed minimums, both canonical side qualifications,
  and exact checkpoint-declared run-specific `ledger_chain` sets are complete. A separate internal
  service persists one exact positive, negative, or ineligible single-window verdict and releases
  the terminated pair for another precommitted experiment. Internal campaign services then reserve
  deterministic future slots, enforce strict sequence/non-overlap/deadlines, count all terminal
  results, and persist one restart-stable confirmed or not-confirmed outcome. A separate internal
  ResearchRelease can materialize causal Finding/Lineage memory, and the explicit operator command
  can move an exactly confirmed challenger into Trading review. These components are still not
  composed into a production comparison scheduler or automatic promotion loop, cannot resume
  provider processes after restart, and do not hand off or replace champion runners.
- ResearchRelease remains a separate internal operation with no production scheduler. Raw sealed
  outcomes stay unavailable to ResearchWorkers unless that exact append-only release succeeds;
  promotion does not imply research visibility and release does not imply promotion.
- `PaperTradingQualification` now verifies commitment, observation, provider, and fake-account score
  integrity, including per-observation delta/account continuity. Paired qualification and the
  single-window verdict require run-specific Ledger completeness. Single-window verdicts remain
  `not_eligible`; only a sealed all-improved campaign outcome may be protocol-level `eligible`.
  `trading_candidate.promote` now binds that exact campaign, outcome, final verdict, and final
  qualified challenger evaluation after atomically revalidating the current champion. It changes
  Trading review only and does not automate scheduling, runtime handoff, or authority. Every
  campaign is committed before campaign-bound outcomes and counts every reserved terminal result.
  Candidate-level aggregate Ledger state is insufficient once one CandidateVersion owns multiple
  TradingRuns.
- Every new CandidateArena tick now persists a pre-effect `CandidateArenaResearchAllocation` and
  uses it to control actual direction selection, concurrency, and experiment iterations. The
  bounded policy selects three default lanes with at most two focus and at least one exploration,
  runs no more than two workers concurrently, applies focus/exploration budgets of two/one within
  five total experiments, counts only completed tick-bound allocations for exploration coverage,
  and exposes an equal-bound static control. ResearchWorkers are still tick-scoped invocations
  rather than durable long-lived workers with workspace, process, recovery, and causal memory
  ownership; provider-dollar cost and learned allocation also remain open.
- The full adversarial matrix for score probing, evaluator side channels, window cherry-picking,
  provider-identity ineligibility, and behavior-level duplicate detection is incomplete.

These are target gaps, not permission to widen one patch across every subsystem. Each implementation
frontier must preserve the full protocol while remaining independently testable.

The implemented admission and commitment frontiers are partial conformance evidence only. They
demonstrate that failed,
unchanged, crashed, disqualified, and quarantined submissions cannot materialize a runnable paper
candidate; valid accepted negative results remain research memory; low-cost rejection is not
treated as favorable allocation evidence; admission outcomes are distinct from infrastructure
failure; every reachable paper start is precommitted as research feedback; executable or policy
drift invalidates before new evidence; research history cannot qualify or promote; and active
qualification-purpose, invalidated, integrity-failed, and candidate-Ledger-only evidence is excluded
from Arena paper-learning projections and next-generation source selection. Candidate-aggregate
Ledger summaries remain absent until they can be resolved by exact TradingRun. Standalone
qualification cannot create a new promotion. The first shared tick demonstrates only that a common
immutable input is available. The activation authorization demonstrates only that one exact inert
pair may enter the bounded paper-only start protocol. Symmetric activation evidence now demonstrates
durable intent, bounded parallel start, partial cleanup, and conservative restart recovery. The
paired-checkpoint path proves both sides consume a common opportunity through one atomic evidence
bundle, then advances contiguous ticks only after exact role-bound acknowledgement. It also proves
acknowledged silence and exact acknowledgement-bound events can produce sequence-N paired evidence
through sequence 3 without provider or sandbox restart, a bounded internal runner can schedule one
reconstructible transition at a time, exact terminal successors survive transaction recovery, and
restart rematerializes bundles without decision replay. The read-only paired qualification path
then proves the clean stop, shared prospective minimums, both canonical side qualifications, exact
additional TradingRun identity, and complete Ledger ref-set equality without writing evidence. The
external verdict path seals exact qualified improvement, qualified non-improvement, or ineligible
closure, survives restart, and releases only the terminated experiment pair. The confirmation path
then proves every precommitted reserved result, releases terminal evidence into causal
Finding/Lineage only through ResearchRelease, and lets only an explicit operator command bind an
eligible all-improved outcome to the exact current champion and final qualified challenger
evaluation. This is restart-stable comparison-backed Trading review, not production composition,
automatic promotion, champion runner replacement, private/live authority, or P0 completion. The
separate allocation path proves restart-stable bounded scheduling intent and actual worker resource
control, not long-lived worker recovery, calibrated reward learning, or economic improvement.

## Implementation Frontier Order

1. **Partial:** evidence purpose, candidate freeze, admission, quarantine, the inert paired
   comparison commitment graph, contiguous shared ticks, one effect-free activation authorization,
   bounded symmetric runtime activation/recovery, atomic paired checkpoints through sequence 3,
   role-bound delivery/acknowledgement evidence, and an internal bounded window runner are
   implemented and validated; read-only paired qualification and sealed single-window adjudication
   are also implemented internally, while production comparison and runner composition remain.
2. **Implemented:** a dedicated admission policy gates candidate materialization after
   `ResearchPreflight`.
3. **Partial:** sealed-preflight anti-hacking fixtures exist; evaluator-answer leakage removal and
   broader adversarial coverage remain.
4. **Implemented for current starts:** immutable research-feedback commitments, verification,
   invalidation, restart, qualification ineligibility, and research projection sealing exist.
   Qualification-purpose creation is internal and inert; public/default session activation remains
   intentionally unavailable, and the new authorization does not weaken those guards.
5. **Implemented internally through campaign research release and explicit promotion:** append-only activation,
   contiguous tick, and checkpoint intent/outcome evidence; symmetric start and view advance; hard
   provider-request caps; acknowledgement-required sequence-N preparation; recoverable atomic
   paired LocalStore bundles through sequence 3; one-step graph reconstruction; non-overlapping
   process-local scheduling; frozen maximum-bound stopping; symmetric cleanup; conservative restart
   recovery; read-only clean-stop, canonical-side, shared-minimum, and exact-run Ledger
   qualification; append-only positive, negative, and ineligible verdicts; deterministic
   precommitted confirmation slots; strict sequence, non-overlap, and deadline gates; all-result
   confirmed/not-confirmed aggregation; restart-stable exact replay; campaign-bound pair release;
   deterministic positive, non-reproduced, ineligible, and expired ResearchRelease classification;
   recoverable Finding/Lineage materialization; causal CandidateArena context; exact
   campaign/outcome/final-verdict promotion binding; atomic current-champion
   revalidation; restart-stable replay; promotion-bound readback; and explicit paper-only
   `trading_candidate.promote` composition. Automatic promotion, production scheduling, and runner
   handoff remain later frontiers.
6. **Partial:** released research-feedback and explicit campaign-release findings feed later workers
   while unreleased qualification evidence stays hidden. Persisted bounded adaptive allocation now
   changes actual three-of-five selection, concurrency, and experiment budgets before effects;
   completed allocation history preserves exploration and static control supplies an equal-bound
   ablation. Durable ResearchWorker workspace/process recovery, provider-dollar cost, learned
   allocation, and causal discovery-yield evidence remain.
7. **Partial:** restart, focused soak, interface parity, and repository guards exist; a bounded
   three-checkpoint scientific-control window, read-only qualification, and sealed single-window
   verdict, multi-window confirmation campaign, ResearchRelease, and explicit comparison-backed
   TradingPromotion are proven, while production composition, longer soak evidence, durable worker
   recovery, and full P0 evidence remain.
