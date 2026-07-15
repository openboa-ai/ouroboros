# CandidateArena Evaluation Protocol

Status: P0 target contract with partial implementation evidence. This document defines the bounded
frontiers required by [CandidateArena And Research Goal](candidate-arena-research-goal.md). Current
allocation and ResearchPreflight commitments, split development/sealed preflight, exact
development behavior fingerprints, external paper handoff conformance, admission, sealed
comparison, confirmation, causal ResearchRelease, explicit comparison-backed TradingPromotion,
bounded adaptive ResearchWorker allocation, and durable logical ResearchWorker checkpoint/restart
tests demonstrate only the explicitly listed partial conformance; they do not establish production
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
9. Replay success alone cannot claim runnable paper handoff. The exact sealed submitted artifact
   must pass an external bounded target paper-protocol probe before admission and materialization.
10. One pre-effect `ResearchPreflightCommitment` must bind source, allocation, worker, development
    budget, and rotating sealed-suite commitments. The worker controls a bounded session, submits
    externally frozen development snapshots, receives aggregate feedback, and explicitly selects a
    completed sequence before one sealed submission. No score or mutable-workspace fallback may
    select for it; process loss closes rather than reconstructs the plan.
11. Population identity must distinguish artifact bytes from bounded behavior. One exact
    development protocol/suite fingerprint may own at most one admitted population slot; sealed and
    paper outcomes never define that fingerprint.
12. A checkpoint-enabled logical ResearchWorker may continue only through a new allocation and
    commitment. Every old commitment closes once as completed or failed-closed before a later
    worker effect. Completed includes exact admission closure and explicit finish without a
    selection; restart never adopts its process, budget, seed, or sealed suite.
13. Population diversity is a read-only diagnostic. Assigned direction and exact observed behavior
    distributions remain separate; behavior comparisons require one exact protocol/development-
    suite cohort, and no entropy value may become rank, admission, allocation, qualification, or
    promotion authority.

## Evidence Lifecycle

| Evidence stage | Visible to ResearchWorker | May guide future research | May admit a candidate | May qualify a candidate |
| --- | --- | --- | --- | --- |
| Inspectable research experiment | Yes | Yes | No | No |
| Development `ResearchPreflight` | Aggregate development feedback only | Yes | No | No |
| `ResearchBehaviorFingerprint` | No raw cross-candidate observations; generic duplicate Finding after close | Yes | No; may exclude an exact admitted duplicate | No |
| `ResearchPopulationDiversity` | Aggregate counts and entropy only; no raw identity or evaluator evidence | Yes, as concentration context only | No | No |
| `ResearchControlCampaign` research report | Arm diagnostics and precommitted candidate slots only; no winner or paper outcome | No, until a separate terminal paper release | No retroactive admission | No |
| `ResearchControlCampaignOutcome` | No raw paper records; exact refs, digests, slot classifications, and bounded arm rates only | Yes, after every slot is terminal | No retroactive admission | Records released qualification evidence but grants no promotion |
| `ResearchControlStudy` | Exact planned campaign identities and frozen condition only; no outcomes | No, until every planned outcome closes | No | No |
| `ResearchControlStudyOutcome` | Aggregate counts, mean difference, exact sign p-value, bounded inference, and refs/digests only | Yes, within same-baseline causal scope | No | No; may only enable a separate policy decision |
| `ResearchGeneralizationProtocol` | Six exact pre-effect study slots, frozen public condition blocks, timing, source-baseline, resource, and analysis policy | No, until terminal closure or expiry | No | No; research scheduling only |
| `ResearchGeneralizationOutcome` | Every planned slot, equal-weight block effects, baseline count, exact sign p-value, bounded inference, and refs/digests | Yes, within prospective condition-blocked cross-baseline scope | No | No; may only enable the separate ResearchGeneralizationPolicyDecision |
| `ResearchGeneralizationPolicyDecision` | Exact protocol/outcome refs, digests, bounded status, effective mode, and research-policy authority only | Yes, as future uncontrolled-allocation provenance | No | No; never grants evaluation, promotion, order, private, or live authority |
| Effective generalization policy application projection | Latest and resolver-effective decisions, compact allocation/completed-tick counts, and latest exact allocation link | No; it observes existing application and adds no feedback | No | No; read-only contract evidence with closed downstream authority |
| `ResearchAllocationPolicyDecision` | Exact study/outcome refs, digests, bounded status, and research-policy authority only | Yes, as future allocation provenance | No | No; never selects promotion or live authority |
| One-shot sealed admission | No scenario, score, or outcome feedback | Generic closed result only after freeze | Yes, only with exact terminal graph plus passed handoff conformance | No |
| `PaperTradingHandoffConformance` | Generic status and reason only | Yes | Yes, only when exact passed evidence is bound into admission | No |
| Paper research-feedback window | Yes after each declared release point | Yes | Already admitted | No |
| Prospective paper qualification window | No outcome feedback before close | Only after adjudication | Already admitted and frozen | Yes |
| Closed `Finding` and `Lineage` | Yes | Yes | No retroactive upgrade | Preserves the completed decision only |

Research feedback and qualification are different evidence purposes even when both use
`PaperTradingEvaluation`. One physical observation or window cannot carry both purposes.

`ResearchPreflightCommitment` is append-only and precedes every worker effect. It stores canonical
digests and a seed commitment, not the raw evaluator seed or sealed scenarios. The evaluator-owned
in-memory plan supports bounded adaptive development and exactly one sealed submission over the
explicitly selected frozen snapshot. No selection leaves the sealed plan unclaimed. A lost process
cannot reconstruct or silently resample that plan.
CandidateArena rank, materialized research lineage, and next-worker context retain the
development-visible evaluation. The sealed terminal score decides admission only and is not
released through the research leaderboard.

`ResearchBehaviorFingerprint` uses only the final externally recorded validation order for every
canonical development scenario. Its digest covers protocol, development-suite version/digest, and
sorted normalized decisions. SystemCode identity and time bind the evidence record but do not alter
the behavioral key. LocalStore compares only fingerprints referenced by prior `admitted`
decisions; quarantined, duplicate, orphaned, cross-suite, later, or corrupt evidence cannot become
a baseline. Exact duplicates retain Finding and Lineage without materialization. Missing complete
canonical observations quarantine an otherwise admissible candidate. Version 1 keeps exact
quantity, so approximate sizing similarity remains a separate future policy.

`ResearchPopulationDiversity` is reconstructed rather than persisted as authority. It uses at most
the latest ten completed CandidateArena ticks. Every direction result counts as an assigned sample;
only complete fingerprints with exact window commitment and direction linkage count as observed
behavior. Shannon entropy is rounded to six places. Assigned normalization uses the maximum
possible entropy for the smaller of sample count and seven canonical directions; behavior
normalization uses the maximum for its sample count. Top-level distributions measure rolling
coverage, while required newest-first `tick_series` entries independently measure each exact tick
cross-section. Multiple fingerprint protocol/development-suite cohorts report
`incomparable_suites` and omit global and per-direction unique/entropy claims. A suite transition
between ticks can close the window aggregate while each internally single-cohort tick remains
measured; a conflict inside one tick closes that tick too.
Admission classifications join only through the exact commitment graph. Missing historical links
are ignored, while a window commitment missing its ResearchDirection fails the derived read. The
same bounded read model enters CandidateArena and next-worker context without raw IDs, digests,
observations, scenarios, sealed outcomes, or paper evidence.

`ResearchControlCampaign` freezes an adaptive allocation treatment and static equal-maximum-bound
control before either arm effect. Its canonical store snapshot excludes only campaign evidence
collections to avoid self-reference; candidate, Finding, Lineage, checkpoint, duplicate-baseline,
and artifact state remain covered. The actual single-file research source is sealed and copied
separately so compatibility SystemCode artifact identifiers cannot masquerade as the bytes used by
both arms. Each arm has its own LocalStore, worker state, candidate artifacts, and exact tick IDs.
The primary store retains campaign, coordinator arm intents, the terminal report, the deterministic
paper schedule, compact start-batch witnesses, replicated terminal slot outcomes, and the aggregate
outcome. Arm ticks, candidates, TradingRuns, and Ledger evidence stay in their owning arm store. The
report may compare research diagnostics and reserve one deterministic candidate slot per tick, but
it fixes `unadjudicated` and `not_available_from_research_phase`. Before effects the campaign freezes
the exact Trading review comparator or explicit unavailability. After the report, the schedule binds
every source identity and deadline before paper effects. Matched source ticks consume one shared
public market/execution snapshot, while a `ResearchControlCampaignPaperStartBatch` records only the
cross-arm fairness witness rather than copying peer runtime graphs. Source verdicts, missed
deadlines, and strict confirmation ResearchReleases each close through one exact
`ResearchControlCampaignPaperSlotOutcome`. `ResearchControlCampaignOutcome` accepts only a complete
set of those schedule-owned terminal outcomes under the frozen comparator and policy. No-candidate,
ineligible, expired, source-not-improved, and non-reproduced slots remain in the denominator; only
`qualified_improvement` receives credit. The outcome fixes `single_campaign_observation_only` and
cannot replace allocation policy, promote, submit orders, or gain live authority.
`ResearchControlStudy` must exist before all of its 6 to 30 deterministic campaign identities. It
freezes one exact campaign condition and baseline snapshot plus a two-sided paired exact sign-test
policy. Every planned campaign outcome enters `ResearchControlStudyOutcome` once; ties remain in the
mean but leave the sign test, and no outcome-aware inclusion or early stopping is allowed. A
supported adaptive effect has `same_baseline_stochastic_replication_only` causal scope and grants
only `eligible_for_separate_policy_decision`. It never mutates allocation policy or creates trading
authority.
`ResearchMemoryControlStudy` must exist before either side of every planned pair. Every pair starts
from two verified copies of one frozen baseline and shares source, agent/model/profile, direction,
submission bound, development suite, sealed suite, and rotation commitment. Provider context and
opaque side paths disclose no arm assignment. `ResearchMemoryControlPairOutcome` maps external
unchanged-artifact or exact same-suite fingerprint evidence to exact-repeat indicators; failures,
interruptions, missing fingerprints, and malformed graphs stay in the denominator. The study
outcome runs its precommitted exact sign test only after all pairs close. Support is limited to
reduced exact repetition under those same-baseline conditions and is not paper or policy evidence.
Same-root memory-study and allocation publication serializes through an atomic lock owner that
binds token, PID, process-start marker, and acquisition time. Recovery retires an owner only when
the PID is absent or its process-start marker proves PID reuse; unreadable identity remains held.
`ResearchGeneralizationProtocol` is committed before any of its six deterministic studies. It
freezes two slots in each public `long`, `short`, and `flat` condition block, exact worker and
paper/campaign identities, 24-hour global spacing, a 90-day deadline, source reuse constraints, and
equal-weight analysis. Only an exact 30-element fully closed `BTCUSDT` one-minute kline window may
classify a pre-effect slot. `ResearchGeneralizationOutcome` accounts for every planned slot at full
terminal closure or expiry; it cannot drop unfavorable or missing evidence. Generalization support
requires six eligible non-ties, at least three distinct baseline snapshots, exact two-sided sign
p-value at most 0.05, positive equal-weight mean, and no zero-or-negative block. Support grants no
current policy replacement: it is only eligible for the separate
`ResearchGeneralizationPolicyDecision` boundary. That decision reloads the exact graph and may
approve only the protocol's frozen `adaptive_default` policy digest. Unsupported or insufficient
outcomes become `not_approved` with no effective mode and never establish static superiority.
`ResearchGeneralizationReadModel` exposes this prospective graph through the shared CandidateArena
operator state without changing it. It independently selects the oldest protocol missing an
outcome, the latest adjudicated outcome, the chronologically latest policy decision, and the exact
approved decision the uncontrolled-allocation resolver currently selects. A newer negative decision
does not revoke an older applicable approval. The effective decision joins only to exact existing
allocations and completed ticks, producing `awaiting_allocation`, `allocated`, or `completed_tick`,
counts, and the latest allocation link. Complete protocol-to-decision and decision-to-allocation-to-
tick graph validation fails on duplicate, orphaned, mismatched, malformed, or impossible-time
evidence. Raw windows, artifacts, digests, study/campaign identities, and per-slot effects remain
outside operator readback. The projection has `not_promotion_authority` and does not enter
ResearchWorker context, direction scoring, ranking, qualification, promotion, orders, private
reads, or live behavior. Deterministic full-graph fixtures are contract proof only, not real-market
generalization or profitability evidence.
`ResearchAllocationPolicyDecision` separately reloads that exact graph. Version 1 approves only an
eligible supported adaptive effect for the exact studied policy digest. Non-supported or
underpowered evidence records `not_approved` with no effective mode and cannot select static
control. Uncontrolled ticks resolve explicit caller intent first, then the latest applicable exact
generalization approval, then the latest applicable exact same-baseline approval, then the
repository adaptive fallback. The chosen basis enters the pre-effect allocation digest and read
model, and LocalStore independently rejects forged, stale, or time-inverted decision provenance.
After successful default scheduler catch-up,
`ResearchAllocationPolicyDecisionCoordinator` validates exact existing decisions and ensures the
oldest terminal outcome missing one, at most one per cycle. Selection is independent of inference
status: supported evidence may become `approved`, while unsupported and underpowered evidence is
persisted as `not_approved`. Equal adjudication and decision milliseconds advance by exactly one;
clock regression fails. Same-root publication is create-only and a race loser accepts only a winner
re-derived exactly with the winner's timestamp. The operational result is not evaluation, Finding,
Lineage, rank, promotion, order, private, or live evidence.
The internal study executor derives the next action from that exact evidence graph. It runs or
resumes only the earliest incomplete campaign, requires its terminal paper outcome before the next
replication, and invokes study adjudication only after full closure. The sequential runner can drain
an active campaign and stop between replications; no mutable StudyRun progress record participates
in evidence or recovery.
The internal `ResearchControlStudyCommitmentCoordinator` runs before each default scheduler
discovery cycle. It reloads the latest exact TradingPromotion and its sealed confirmation campaign,
then deterministically creates or accepts one study with six one-tick-per-arm replications and fixed
baseline limits. The bound protocol preserves every numeric comparison limit, market-data digest,
and paper-policy identity while normalizing only `comparison_mode` to `champion_challenge` for the
new reviewed-source study. A missing promotion or another incomplete study defers. Malformed,
drifted, or conflicting evidence halts before runtime effects, and same-root process races use
create-only publication with one exact winner. Commitment status is operational only and grants no
allocation-policy, promotion, order, private, or live authority.
The internal `ResearchControlStudyProcessSupervisor` discovers incomplete studies from exact
study/outcome lists, orders them by commitment time and ID, opens one injected study runtime, and
rescans only after exact persisted completion. It does not skip a failed earlier study or create a
policy decision. `ResearchControlStudyScheduler` now runs that one-shot owner immediately under the
default runtime server, invokes commitment before discovery, then invokes oldest-missing
generalization outcome, generalization-policy decision, and same-baseline policy-decision
reconciliation in that order after successful catch-up. Each coordinator is bounded to at most one
record. It then waits on an interruptible bounded poll and considers later reviewed sources. It does
not reconcile after contention, failure, stop, or invalid supervisor state.
Runtime opening reuses the exact persisted condition and fails before effects on agent identity
drift. Before runtime opening,
`ResearchControlStudyExecutionLease` atomically elects one
same-host server for one shared LocalStore root. The active owner renews and asserts its exact token
before every executor advance. Alive or liveness-unknown owners remain held after expiry; takeover
requires both expiry and a confirmed-absent same-host PID. Release and confirmed-dead takeover write
terminal owner history. New claims publish a populated lock directory atomically; an interrupted
empty claim can be removed before a new owner is elected. Lease state is excluded from study
outcomes, Findings, Lineage, rank, allocation, policy decisions, and promotion because it proves
coordination, not research quality.

`ResearchWorkerCheckpoint` is separate from evaluator state. It closes one exact commitment with a
contiguous stable-worker link, current and cumulative development submission counts, zero remaining
submission authority, and a bounded sanitized notebook tail. A same-worker next tick receives that
tail in a separate prior context while its current notebook starts empty. Restart scans only
checkpoint-enabled orphan commitments before new effects. Exact persisted admission reconstructs a
completed checkpoint without rerunning materialization; otherwise recovery records failed-closed.
An explicit no-selection finish also records a completed checkpoint without admission and remains
valid prior context. Neither path recreates or claims the lost sealed plan.

`PaperTradingHandoffConformance` is a research-only compatibility gate between sealed admission and
admission. It runs the same exact submitted bytes against the bounded production paper event protocol,
persists only an external evidence summary, and contributes no economic score, qualification,
comparison verdict, promotion, order, private, or live authority.

For generated single-file Python candidates, exact submitted bytes means one canonical closure
digest over the frozen manifest and sole editable entrypoint. Research rejects undeclared files,
directories, symlinks, editable paths, and manifest drift before effects; paper artifact resolution
recomputes the same closure before preparation.

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

## Candidate Sandbox Network Boundary

Generated-candidate execution requires stable Docker Sandboxes `sbx >= 0.35.0`. Before candidate
effect, the runner snapshots the effective per-Sandbox network allow rules. An exact but unowned
Gateway rule fails closed. Other inherited allow resources are neutralized by runner-owned,
Sandbox-scoped deny rules with the exact same aggregate resources; the machine-global policy and
other Sandboxes are not mutated. The CLI may expand one multi-resource mutation into multiple owned
rule IDs. A host-provider run then adds one runner-owned
`localhost:<GatewayPort>` rule for the injected `http://host.docker.internal:<GatewayPort>` URL; a
Sandbox-local replay sidecar receives no additional allow. Docker's deny-wins evaluation plus a
fixed public, DNS/UDP, raw TCP, metadata, private-network, and alternate-host policy-check matrix
must prove the effective boundary before candidate code executes. No policy in this boundary
restricts strategy logic, candidate content, or tool choice.

Every terminal path collects the bounded `sbx policy log`, removes every exact owned Gateway allow
rule by ID, then removes every owned deny rule by ID, stops or removes the Sandbox, and retains
command evidence. If Gateway-rule cleanup fails, the deny overlay remains. Continuous paper sessions
persist both rule-ID sets and the inherited allow fingerprint outside the candidate workspace so a
replacement adapter can recover and remove only owned rules after restart. Existing v1 Gateway leases are
migrated by resolving one exact Sandbox-scoped rule ID before removal. Unknown ownership, policy
JSON drift, cleanup failure, and an unsupported `sbx` version are infrastructure failures, not
strategy Findings. Host policy mutation is outside candidate authority; durable start/end policy
identity and mismatch evidence belong to the egress-attestation frontier.

`npm run prove:candidate-sandbox-egress` is the live platform proof. It starts a temporary local
Gateway and executes a candidate-owned adversarial fixture that requires Gateway HTTP success while
direct HTTP, redirects, DNS, raw sockets, subprocesses, metadata/private addresses, and a second
reachable but unallowed host listener fail. Raw TCP counts as an escape only after response bytes
return; socket connect completion alone can be a proxy-local acknowledgement. This runtime proof
does not replace the future durable egress-attestation record.

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

Qualification independently replays the same score-free maximum-count, maximum-elapsed, and
next-cadence boundary from the frozen comparison policy. At the clean-handoff API boundary, the
runtime captures one `window_closure.requested_at` and immediately requests one Store-linearized
closure-graph snapshot before it enters the activation queue. The snapshot shares the current
LocalStore evidence-write queue with tick, checkpoint-attempt, checkpoint-outcome, and paired
checkpoint transactions; it does not reconstruct request-time visibility from record timestamps.
The final handoff outcome digest binds the snapshot's tick, checkpoint-attempt, paired-checkpoint,
and latest-reference state. Qualification requires the closure to match the final reader-validated
graph exactly, requires every captured tick to have one paired checkpoint, and requires the closure
request to precede both exact stop effects. Evidence committed after the snapshot makes the final
graph differ and therefore fails closed. Stop-side `effect_started_at` and cleanup completion remain
lifecycle evidence; neither can extend the research window. Meeting only the minimum
observation/elapsed gates, or crossing the deadline in queue or cleanup latency, adds
`comparison_frozen_window_boundary_not_reached`; the verdict is `comparison_ineligible` without
economic fields and cannot enter confirmation or promotion.

## Evaluator Information Barrier

The evaluator and its durable logs live outside ResearchWorker and candidate sandboxes.

- Hidden outcomes, future events, raw labels, evaluator implementation, held-out event selection,
  and per-example correctness remain unavailable. The committed duration and policy are visible
  when a candidate needs them to operate, but cannot change after outcomes are observed.
- Development `ResearchPreflight` may return bounded aggregate feedback needed for hill climbing.
  Query budgets, rate limits, and granularity are evaluator policy, but those caps are not treated
  as proof that reward hacking is impossible.
- Sealed seed, scenarios, scenario IDs, outcomes, metrics, score deltas, raw events, paths, commands,
  and evaluator internals never enter worker prompt, notebook, replay feedback, or next-generation
  Arena context. Operator readback receives only commitment ID, development submission count,
  generic terminal status/reason, and authority-free development/sealed cost counts.
- Raw paper observations, market/account/open-order/fill/decision state, cadence telemetry, and
  latest failure strings also stay outside the open ResearchWorker session. Only bounded aggregate
  FindingClusters, released findings, diversity, allocation focus, leaderboard, and efficiency
  context may guide generation.
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
| Valid and distinct one-shot sealed admission plus exact passed handoff conformance | Materialize only when commitment, source, submitted SystemCode, suite, terminal evaluation, experiment, conformance, finding, admission, and lineage form one exact graph. |
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
-> pre-effect allocation, direction, worker, source, and ResearchPreflightCommitment
-> bounded ResearchWorkerSession with immutable development submissions and aggregate feedback
-> explicit selected sequence | no_submission
-> freeze the selected artifact
-> one-shot rotating sealed admission with no worker feedback
-> external PaperTradingHandoffConformance over the exact submitted artifact
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
   candidates and an exact quarantined finding; replay success cannot bypass target paper-protocol
   conformance.
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
  can move an exactly confirmed challenger into Trading review. The default server now creates one
  deterministic latest-promotion study when the bounded queue is empty and runs it with same-host
  shared-LocalStore execution leasing, then reconciles one oldest missing policy decision after
  successful catch-up. There is still no multi-host fencing, automatic promotion loop,
  provider-process adoption after restart, or champion runner handoff.
- ResearchRelease has a server-owned execution path only inside an already committed study. Raw
  sealed outcomes stay unavailable to ResearchWorkers unless that exact append-only release
  succeeds; standalone release and promotion remain explicit, promotion does not imply research
  visibility, and release does not imply promotion.
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
  and exposes an equal-bound static control. Every allocation seals explicit-request,
  repository-default, or exact approved-decision provenance. ResearchWorkers now have stable logical identity by
  direction/provider/model/profile, a stable workspace, sanitized per-tick notebook continuity,
  closed cumulative budget history, and restart-safe orphan reconciliation. Provider-process and
  sandbox adoption, worker-chosen experiment sequencing, provider-dollar cost, and learned
  allocation remain open.
- `ResearchControlCampaign` now composes an actual isolated adaptive/static run from one verified
  store and source-artifact baseline. Campaign and arm intent precede effects; sequence-paired arms
  wait for both settlements; restart reuses exact completed ticks and runs only missing ticks; and
  a terminal research report freezes diagnostics plus future paper slots without a winner. The
  internal bounded executor now commits the deterministic schedule, installs exact arm graphs,
  seals shared-snapshot start batches, drives source and confirmation paths one persisted action at
  a time, and records every candidate terminal path as an arm-local slot outcome. The collector
  validates and replicates those exact outcomes, counts every slot, and persists one non-causal
  adaptive/static observation that survives later arm-store loss. The replicated study contract now
  precommits every exact campaign, enforces no early stopping, applies a fixed exact sign test, and
  persists the same-baseline aggregate outcome. The internal study runtime now derives exact
  progress and can execute those campaigns sequentially through adjudication. Default process
  discovery now drains incomplete studies deterministically through one explicitly owned process.
  Each arm can now be composed from its exact LocalStore plus an arm-local paper-session service;
  the real comparison services advance confirmation one persisted transition at a time and preserve
  exact wake times through the campaign runner. One listener-capable six-replication fixture study
  now closes all 12 candidate slots through two post-activation checkpoints and restarts without
  effects through real loopback providers and deterministic sandbox processes. Generated
  `TradingSystem` decisions are emitted before their exact tick acknowledgements. Under one frozen
  falling-price fixture, every adaptive mean-reversion slot is pair-qualified, improves at source,
  reproduces once in confirmation, and closes as `qualified_improvement`; every equal-bound static
  trend-following slot closes as `source_not_improved`. The study records six non-ties, a mean rate
  difference of 1, exact sign-test p-value 0.03125, and `adaptive_effect_supported`, while leaving
  promotion and allocation-policy state unchanged. Exact provider/sandbox 36/36 lifecycle symmetry
  includes the 24 source-side sessions plus 12 required adaptive confirmation sessions. This proves
  qualified non-tied causal-protocol execution for the deterministic fixture, not real-market
  superiority, cross-regime generalization, or a learned policy. The default server now owns
  bounded polling, deterministic latest-promotion study commitment, exact persisted-condition
  runtime reconstruction, same-host cross-process execution leasing, and symmetric oldest-first
  automatic policy-decision reconciliation. It also owns a prospective six-slot
  `ResearchGeneralizationProtocol`, public closed-kline block classification, deterministic
  24-hour-spaced slot assignment, and oldest-first terminal-or-expired outcome reconciliation.
  The required `ResearchGeneralizationReadModel` now makes exact lifecycle, active condition-block
  progress, deadline, latest outcome, and latest broad policy decision visible through
  `GET /api/operator`, `arena.status`, CLI, TUI, and Web Research while remaining outside every
  feedback and authority path. Complete eligible real-market protocol evidence, multi-host fencing,
  and generated or tuned policy parameters remain open. Both the same-baseline and broad
  approval-only decisions plus their future-allocation provenance paths are implemented.
- Every selected direction now also persists a pre-effect `ResearchPreflightCommitment`, freezes one
  explicitly selected immutable development artifact, and permits one rotating sealed submission.
  The terminal Evaluation binds the selected development sequence and exact submitted SystemCode
  digest separately from sealed submission sequence one. LocalStore rejects
  source/allocation/worker/suite/submission graph drift, adjacent rotation reuse, a second terminal
  result, and conformance-bound admission mismatch. The raw seed and sealed suite are process-local,
  so crash recovery deliberately fails closed rather than resuming the evaluator plan.
- Every frozen submission now also records one development-only `ResearchBehaviorFingerprint` when
  complete canonical observations exist. CandidateArena and LocalStore permit only the first prior
  admitted exact protocol/suite/decision key to own a population slot, preserve later matches as
  `behavior_duplicate` Finding/Lineage, and quarantine an otherwise admissible submission when the
  fingerprint is unavailable.
- CandidateArena now derives `ResearchPopulationDiversity` over its latest ten completed ticks and
  exposes the same object to the next ResearchWorker. Rolling coverage and per-tick cross-sectional
  trajectories remain distinct, assigned labels and exact observed behavior remain orthogonal,
  cross-suite evidence is incomparable, and entropy changes no allocation, rank, admission,
  qualification, or promotion policy. Directed/undirected, memory/no-memory, and agent/baseline
  controls remain open. Adaptive/static arm execution, prospective paper-slot execution, and one
  terminal outcome contract exist internally, and the replicated same-baseline inference contract
  plus its sequential executor are implemented. The separate exact-digest adaptive policy decision
  and explicit/repository/decision allocation provenance are also implemented. An internal
  single-owner process can now discover and drain committed studies. A six-replication real-arm
  fixture study proves exact qualified non-tied closure, provider and sandbox 36/36 cleanup, and
  effect-free restart. Its six adaptive positives and six static negatives support the bounded
  `adaptive_effect_supported` fixture conclusion without mutating policy or promotion state.
  The default server now commits, starts, and drains this study path, polls for later reviewed
  sources, excludes competing same-host processes through renewable leases, and automatically
  records one oldest missing generalization outcome, broad generalization-policy decision, and
  same-baseline research policy decision in that order after catch-up. The prospective
  condition-blocked protocol and approval-only policy bridge are implemented; complete real-market
  evidence, multi-host fencing, production learned allocation, and external-validity claims remain
  open.
- One concrete outcome-aware window-selection path is closed: a handoff requested before every
  frozen maximum boundary cannot qualify, even if activation-queue delay or cleanup finishes after
  the elapsed deadline. The Store-linearized closure graph is outcome-digest-covered, must equal
  the terminal reader graph, and must contain one paired checkpoint for every captured tick.
  One provider-transcript smuggling path is also closed: declared GET requests cannot carry a
  candidate-authored body, order validation accepts only the exact declared request envelope,
  evaluator/self-report field matching is casing- and separator-insensitive, and private/live
  payloads retain their specific rejection. A handoff-only adversarial rejection creates no
  candidate and persists as an `anti_hacking_case` Finding under the handoff boundary that observed
  it.
  Generated-candidate direct process egress is now deny-by-default through a Sandbox-scoped overlay
  that neutralizes inherited host allows, with an exact local Gateway exception, adversarial
  in-Sandbox probes, rule-ID restart cleanup, and policy command evidence.
  Durable egress attestation and the full adversarial matrix for score probing, evaluator side
  channels, other window cherry-picking paths, cross-commitment probing, provider-identity
  ineligibility, and approximate or cross-suite behavior clustering remain incomplete.

The isolated candidate-to-paper handoff is now partial conformance evidence rather than a current
gap. Candidate-facing development payloads omit evaluator direction, outcome, hidden risk, private,
credential, direct-order, and live fields; sealed evidence is not released to the worker at all.
Only the frozen development winner runs the one-shot sealed set and bounded host or `sbx`
target-protocol probe. Every decision must use the external market and account reads; only an
emitted `OrderRequest` requires `/orders/validate`. An externally parsed `hold` or `no_action`
remains valid no-order continuity without synthesizing an order, while any validation request that
is emitted must still match the decision exactly, including a positive decimal-string
`limit_price` for a limit order. ResearchPreflight binds that price as protocol identity but does
not claim a limit fill: its v1 behavior fingerprint remains the declared four-field development
key and its score continues to use the replay market snapshot. Prospective paper Gateway/Ledger
evidence owns actual limit-fill authority. LocalStore binds commitment, submitted
SystemCode, terminal evaluation, ExperimentRun, evaluation task, conformance, and admission;
materialization requires the complete
passed graph, and generated-candidate paper start revalidates it before effects. Rejection creates
no candidate and remains causal memory, while runner/provider setup failure remains infrastructure
attribution without fabricated terminal evidence. This proves evaluator isolation and bounded
protocol compatibility only, not reward-hacking immunity, long-duration liveness, economic quality,
qualification, production scheduling, private/live authority, P0, or Goal completion.

These are target gaps, not permission to widen one patch across every subsystem. Each implementation
frontier must preserve the full protocol while remaining independently testable.

The implemented admission, handoff-conformance, and commitment frontiers are partial conformance
evidence only. They demonstrate that failed, unchanged, crashed, disqualified, and quarantined
submissions cannot materialize a runnable paper candidate; exact sealed target-protocol proof is
required before new admission and generated-candidate paper effects; valid accepted negative
results remain research memory; low-cost rejection is not
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
## Implementation Frontier Order

1. **Partial:** evidence purpose, candidate freeze, admission, quarantine, the inert paired
   comparison commitment graph, contiguous shared ticks, one effect-free activation authorization,
   bounded symmetric runtime activation/recovery, atomic paired checkpoints through sequence 3,
   role-bound delivery/acknowledgement evidence, and an internal bounded window runner are
   implemented and validated; read-only paired qualification and sealed single-window adjudication
   are also implemented internally. Arm-local comparison/session composition, candidate-owned
   post-activation cadence, matched-arm synchronization, the bounded campaign runner, and one exact
   six-replication qualified non-tied fixture protocol study are implemented. Prospective
   condition-blocked slot commitment and conservative generalization adjudication are implemented;
   complete eligible real-market evidence and longitudinal deployed soak remain.
2. **Implemented:** pre-effect `ResearchPreflightCommitment`, one bounded Codex or fixture
   `ResearchWorkerSession`, worker-timed immutable development submissions, aggregate feedback,
   explicit selection or no submission, one-shot rotating sealed admission, exact terminal graph,
   passed `PaperTradingHandoffConformance`, and admitted-only exact development
   `ResearchBehaviorFingerprint` comparison gate materialization; generated-candidate paper start
   revalidates the same persisted graph before effects.
3. **Partial:** worker surfaces exclude sealed seed/scenarios/outcomes and paper-handoff fixtures
   reject bounded protocol, provider, self-report, hidden-field, private/live, and timeout
   violations. Provider request envelopes are now structurally exact, hidden/self-report aliases
   normalize before classification, and handoff-only attacks persist as anti-hacking memory. Exact
   same-suite behavior duplicates are isolated. Generated-candidate direct process egress
   neutralizes inherited host allows with a Sandbox-scoped deny overlay, permits one exact injected
   Gateway exception, and has adversarial runtime proof, while
   durable egress attestation, cross-commitment probing, broader evaluator side channels, window
   cherry-picking, and approximate behavior clustering remain. Query bounds alone are not a
   reward-hacking proof.
4. **Implemented for current starts:** immutable research-feedback commitments, verification,
   invalidation, restart, qualification ineligibility, and research projection sealing exist.
   Qualification-purpose creation is internal and inert; public/default session activation remains
   intentionally unavailable, and the new authorization does not weaken those guards.
5. **Implemented internally through campaign research release and explicit promotion:** append-only activation,
   contiguous tick, and checkpoint intent/outcome evidence; symmetric start and view advance; hard
   provider-request caps; acknowledgement-required sequence-N preparation; recoverable atomic
   paired LocalStore bundles through sequence 3; one-step graph reconstruction; non-overlapping
   process-local scheduling; frozen maximum-bound stopping; symmetric cleanup; conservative restart
   recovery; read-only clean-stop, earliest exact stop-start maximum-bound replay, canonical-side,
   shared-minimum, and exact-run Ledger qualification; append-only positive, negative, and
   ineligible verdicts; deterministic
   precommitted confirmation slots; strict sequence, non-overlap, and deadline gates; all-result
   confirmed/not-confirmed aggregation; restart-stable exact replay; campaign-bound pair release;
   deterministic positive, non-reproduced, ineligible, and expired ResearchRelease classification;
   recoverable Finding/Lineage materialization; causal CandidateArena context; exact
   campaign/outcome/final-verdict promotion binding; atomic current-champion
   revalidation; restart-stable replay; promotion-bound readback; and explicit paper-only
   `trading_candidate.promote` composition. The default server deterministically commits one
   latest-promotion study at a time within the active prospective generalization protocol, executes
   it under same-host renewable leasing, and reconciles terminal generalization outcomes, broad
   generalization-policy decisions, and same-baseline policy decisions without selecting only
   favorable outcomes; multi-host fencing, automatic promotion, and runner handoff remain later
   frontiers.
6. **Partial:** released research-feedback and explicit campaign-release findings feed later workers
   while unreleased qualification evidence stays hidden. Persisted bounded adaptive allocation now
   changes actual three-of-five selection, concurrency, and experiment budgets before effects;
   completed allocation history preserves exploration and static control supplies an equal-bound
   ablation. Separate exact-digest same-baseline and cross-condition policy decisions can now supply
   evidence-backed provenance to an uncontrolled adaptive tick without overriding explicit modes or
   treating non-significance as static superiority. Broad approval takes precedence because its
   causal scope is stronger; the default scheduler creates at most one oldest missing decision per
   family after successful catch-up and records unsupported or underpowered results as not approved.
   Stable ResearchWorker workspace identity, bounded sanitized notebook continuity, append-only
   budget closure, bounded worker-chosen sequencing, no-submission continuation, and fail-closed
   restart reconciliation are implemented. Durable provider-process/sandbox adoption,
   provider-dollar cost, learned allocation, and causal discovery-yield evidence remain.
7. **Partial:** restart, focused soak, interface parity, and repository guards exist; a bounded
   three-checkpoint scientific-control window, read-only qualification, and sealed single-window
   verdict, multi-window confirmation campaign, ResearchRelease, explicit comparison-backed
   TradingPromotion, arm-local runtime composition, and exact six-replication qualified non-tied
   fixture-study closure are proven. Default automatic commitment, server scheduling, same-host
   multi-process ownership, prospective condition-blocked generalization commitment/adjudication,
   and post-catch-up automatic research policy decisions are implemented; complete eligible
   real-market generalization evidence, multi-host fencing, deployed soak evidence, durable worker
   process adoption, and full P0 evidence remain.
