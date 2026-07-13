# CandidateArena And Research Goal

Status: target contract. This document defines the North Star and completion evidence for the
long-running CandidateArena and Research system. It does not claim that the current implementation
already satisfies the contract.

Read [CandidateArena Evaluation Protocol](candidate-arena-evaluation-protocol.md) for the first
required implementation frontier. Read [Project Direction](project-direction.md) and
[Autonomy Model](autonomy-model.md) for the current product and authority boundaries.

## North Star

Ouroboros should use the hill-climbing ability of improving AI agents to discover, evaluate, and
retain increasingly capable `TradingSystem` candidates over time.

The North Star is:

> Repeatedly discover a qualified `TradingSystem` that produces better expected future paper
> `net_revenue_usdt` than the current champion on comparable, prospective market evidence, after
> fees, funding, and slippage, without relaxing risk, evidence, authority, or operating bounds.

The descriptive phrase "qualified trading frontier" means the set of candidates whose prospective
evidence remains useful across the market regimes covered by their evaluation. It is not a new
persisted record type and it does not imply that every candidate can receive execution authority.

One profitable observation, one high replay score, or one leaderboard leader does not satisfy the
North Star. Markets are non-stationary and noisy. Improvement requires repeated evidence collected
under a policy committed before the result is known.

## Objective Hierarchy

The product objective and its constraints are deliberately not collapsed into one opaque score.

1. Economic objective: improve expected future paper `net_revenue_usdt` after trading costs.
2. Hard constraints: preserve risk limits, evidence integrity, paper-only authority, runtime
   reliability, and bounded resource use.
3. Research objective: improve the rate at which qualified frontier candidates are discovered per
   unit of research time and cost.

Profit cannot compensate for a hard-constraint violation. A candidate that makes more money by
increasing undeclared leverage, bypassing Gateway, using leaked evaluation information, or
changing during evaluation is invalid rather than superior.

## System Roles

| Role | Responsibility | Must not do |
| --- | --- | --- |
| Ouroboros | Operate the continuing research, evaluation, memory, and recovery loop. | Hide a fixed strategy behind an autonomous label. |
| `CandidateArena` | Maintain candidate population, admission, external evaluation, comparison, findings, and lineage. | Grant authority from provider output or candidate self-report. |
| `ResearchWorker` | Explore one broad `ResearchDirection`, choose experiments, inspect process evidence, and produce candidate versions and findings. | Read qualification outcomes before release or grade its own candidate. |
| `TradingSystem` | Own decision cadence and use a bounded combination of agents, models, tools, technical analysis, rules, and thresholds. | Attach directly to exchange authority or mutate its evaluated identity without a new version. |
| Gateway and evaluator | Provide market inputs, validate actions, fake execute, account for costs, and record external evidence. | Synthesize a trade decision or accept candidate-authored proof. |
| Ledger | Preserve the evidence chain needed to reconstruct decisions and results. | Turn missing evidence into a successful observation. |

`TradingSystem` is an agentic runtime boundary, not a requirement to call an LLM for every market
event. Deterministic rules, thresholds, and risk controls are valid components. The fixed part is
the external authority envelope; the candidate may remain flexible inside that envelope.

## Two Kinds Of Adaptation

Within-run adaptation and inter-generation evolution must remain distinct.

- Within-run adaptation may update declared runtime state, memory, positions, observations, tool
  results, or model context while the candidate identity and allowed capability envelope remain
  frozen.
- Inter-generation evolution changes `SystemCode`, prompts, model or provider configuration,
  dependency closure, tool permissions, or decision policy. It creates a new candidate identity and
  an explicit `Lineage` edge before new evidence is collected.

An evaluated candidate cannot silently rewrite itself and keep its existing evidence. This rule is
what lets flexible agentic systems remain scientifically comparable and operationally auditable.

## Completion Rubric

The Goal is complete only when every axis has direct, current evidence. A conditional pass is
progress, not completion.

| Axis | Required pass evidence |
| --- | --- |
| Longitudinal autonomy | A bounded soak run continues research, evaluation, memory, and next-generation work without iteration-by-iteration human instructions, and resumes correctly after restart. |
| Genuine population diversity | Distinct directions produce measurably different hypotheses, artifacts, or decision behavior; duplicates are detected and do not occupy distinct population slots. |
| ResearchWorker autonomy | A worker has a persistent sandbox or workspace, notebook, budget, and multiple experiment opportunities, and can choose its own de-risking and iteration sequence. |
| External evaluation and admission | Candidate output is evaluated outside its authority; one pre-effect commitment must separate bounded development feedback from a one-shot rotating sealed admission over the exact frozen artifact, followed by bounded target paper-protocol conformance. Crashed, malformed, boundary-bypassing, leaked, and otherwise invalid submissions cannot reach runnable paper handoff. |
| Comparable prospective evidence | Candidate identity and evaluation policy are committed before a paper window; challengers see the same eligible market opportunity and cost assumptions as their comparator. |
| Causal research memory | Positive, negative, invalid, and duplicate findings resolve through lineage and are consumed by later workers; a controlled ablation shows less repeated failure or better discovery yield than a no-memory condition. |
| Adaptive allocation | Findings, regime evidence, failures, novelty, and cost change actual worker selection, concurrency, or budget while an exploration floor prevents entropy collapse. |
| Economic frontier improvement | A predeclared evaluation policy finds a challenger with repeatable qualified lift over the champion, not merely one favorable observation or one reused research window. |
| AI-agent leverage | Under the same evaluator and resource budget, agent-guided research outperforms random mutation, template generation, or another declared non-agent search baseline on qualified discovery yield. |
| Execution continuity | The selected champion continues its paper decision cadence while research and challenger evaluation run; research failure cannot interrupt it, and replacement is an explicit qualified transition with complete evidence. |
| Bounded and legible operation | Concurrency, time, cost, storage, retries, and paper sessions are bounded; every selection, rejection, restart, and lineage transition is reconstructable from external records. |

Current partial implementation evidence now covers the bounded allocation mechanism: every new
tick persists a pre-effect `CandidateArenaResearchAllocation`; adaptive-default ticks select three
of five directions with at most two focus lanes and at least one exploration lane; concurrency is
two; focus and exploration receive two and one experiment iterations respectively within a total
budget of five; completed allocations drive exploration coverage; and `static_control` provides an
equal-bound `2`, `2`, `1` ablation. This does not complete the Adaptive allocation axis or the Goal:
each allocation now also seals explicit-request, repository-default, or exact approved-decision
provenance. Provider-dollar cost, learned policy parameters, actual controlled discovery-yield
results, and the remaining completion evidence are still open.

Current partial implementation evidence now also covers the first controlled allocation execution
boundary. `ResearchControlCampaign` commits one exact LocalStore baseline, source SystemCode record,
actual single-file research artifact closure, managed-agent identity, equal maximum tick/worker/
submission bounds, and exact adaptive/static tick IDs before effects. The runtime copies that
baseline independently into two arm stores, executes matching sequences concurrently, reuses only
exact completed ticks after restart, and leaves the primary Arena population untouched. Its report
conserves arm outcomes and resource proxies, embeds campaign-only diversity, and reserves the first
admitted candidate per tick. The campaign freezes the current Trading review comparator before arm
effects and commits a deterministic paper schedule after the exact report. An internal bounded
executor prepares every candidate-bearing source batch before market effects, uses one shared public
market/execution snapshot for matched arm ticks, enforces strict confirmation deadlines, and records
one terminal slot outcome for every source, expiry, or confirmation path. A separate append-only
`ResearchControlCampaignOutcome` validates those exact slot outcomes under one shared paper policy.
Every precommitted slot remains in the denominator and only `qualified_improvement` receives
qualified-discovery credit. The research report itself remains `unadjudicated`, one outcome cannot
claim causal allocation lift or replace policy. `ResearchControlStudy` now precommits 6 to 30 exact
same-baseline campaign identities and one paired exact sign-test policy before any planned campaign
exists. `ResearchControlStudyOutcome` requires all planned terminal campaign outcomes with no early
stopping, and limits any supported effect to same-baseline stochastic repetitions plus eligibility
for a separate policy decision. The internal study runtime now resumes the earliest incomplete
campaign, drives it through terminal paper outcome, and repeats sequentially until exact
adjudication without a duplicate progress record. A separate append-only
`ResearchAllocationPolicyDecision` now approves only the exact studied adaptive policy after an
eligible supported outcome; unsupported and underpowered outcomes remain not approved and never
select static control. Uncontrolled ticks prefer the latest applicable exact approval, then the
repository adaptive fallback, while explicit directions and modes always win. After successful
study catch-up, an internal coordinator validates existing decisions and ensures the oldest terminal
outcome missing one, at most one per cycle. It processes every inference status symmetrically,
publishes one exact same-root winner, and makes an automatic approval available to the next
uncontrolled tick without granting promotion or trading authority. Default process
discovery uses a single-process, one-shot supervisor that drains incomplete studies oldest first and
rescans exact evidence. Before each default server discovery cycle, an internal commitment
coordinator reloads the latest exact TradingPromotion and sealed confirmation campaign and ensures
one deterministic six-replication, one-tick-per-arm study. It preserves numeric, market-data, and
paper policy, binds comparison to `champion_challenge`, bounds the incomplete queue at one, and uses
create-only publication for one exact same-root winner. Missing prerequisites defer; corruption or
drift fails before effects. The process-local scheduler then starts the supervisor, waits on a
bounded interruptible poll after post-catch-up decision reconciliation, and reconstructs each
runtime from the persisted study condition.
Before opening a study, a renewable `ResearchControlStudyExecutionLease` atomically excludes other
same-host servers using the same LocalStore root. Exact ownership is checked before each executor
advance and released on terminal paths. Alive or liveness-unknown owners cannot be displaced; an
expired lease is replaced only after the same-host PID is confirmed absent. These records coordinate
effects and do not enter research context, allocation, evaluation, ranking, or promotion.
Each copied arm can be opened as an exact LocalStore with its own paper-session service and composed
into the existing comparison, qualification, confirmation, and release protocol. Confirmation
advances one persisted transition at a time and propagates exact wake times; restart stops rather
than adopts unowned attempts. Multi-host fencing, real-market and distinct-regime replication,
forward-time study selection, and learned policy parameters remain open.

Current partial implementation evidence also covers logical ResearchWorker continuity. One exact
direction/provider/model/managed-profile identity owns a stable workspace and a new sanitized
notebook for each tick. Every checkpoint-enabled commitment closes through one append-only
`ResearchWorkerCheckpoint` with a contiguous previous link, current and cumulative bounded
submission counts, zero remaining retry authority, and completed or failed-closed status. Before a
new tick effect, restart recovery closes orphan commitments oldest first: an exact persisted
admission reconstructs only completed lifecycle evidence, while an orphan without admission becomes
`failed_closed/restart_recovery`. Later same-worker prompts receive at most six recent public
development summaries and never sealed, paper, path, command, provider-request, stdout/stderr, or
private/live fields. This does not revive a provider process or sandbox, let the worker choose an
open-ended de-risking sequence, or prove long-duration autonomous restart soak.

Current partial implementation evidence also covers isolated research preflight and the
candidate-to-paper handoff boundary. Before a worker effect, CandidateArena persists direction,
worker, source SystemCode, allocation, bounded development policy, and an evaluator-owned rotating
sealed-suite commitment. Raw evaluator seed and sealed scenarios remain in memory. The worker gets
aggregate development feedback only; one development-selected artifact is frozen and submitted
once to sealed admission. Terminal evaluation, submitted bytes, suite, paper handoff conformance,
admission, and materialization form one append-only graph, and process loss fails closed rather
than resampling. Compact direction readback exposes only commitment ID, development submission
count, generic terminal status/reason, and authority-free phase cost counts. Generated-candidate
paper start revalidates the graph before effects. Rejected sealed evidence remains causal memory;
infrastructure failure remains platform-attributed without fabricated terminal evidence.

Current partial implementation evidence also covers exact development behavior identity. One
`ResearchBehaviorFingerprint` binds the frozen SystemCode and commitment to sorted normalized
effective orders over the complete canonical development suite. Only a prior admitted exact match
on the same protocol and suite can exclude a submission. The duplicate keeps Finding and Lineage
but no population slot; unavailable observations quarantine an otherwise admissible candidate.
Raw fingerprint evidence is absent from next-worker context, and sealed or paper outcomes do not
enter the key. This proves bounded exact observational duplicate detection only, not semantic
equivalence or near-duplicate clustering.

Current partial implementation evidence also makes population concentration reconstructible.
`ResearchPopulationDiversity` uses the same latest ten completed ticks as CandidateArena readback,
reports assigned-direction Shannon entropy separately from exact observed-behavior entropy, and
counts admitted submissions, exact behavior duplicates, artifact duplicates, and unavailable
fingerprints separately. Top-level distributions measure recent coverage; newest-first
`tick_series` entries independently preserve every tick's worker cross-section, so a diverse older
population cannot hide latest exact-behavior collapse. Behavior entropy and unique counts exist
only for one exact fingerprint protocol/development-suite cohort; mixed cohorts are
`incomparable_suites`. A suite transition may make the window incomparable while each single-cohort
tick remains measured. The next worker receives the bounded read model without raw fingerprint
identity, observations, scenarios, sealed results, or paper outcomes. This is direct measurement
evidence for concentration, not completion of Genuine population diversity, Adaptive allocation,
AI-agent leverage, Causal research memory, or Economic frontier improvement.

This does not complete external evaluation, P0, or the Goal. A bounded hidden set and query cap do
not prove reward-hacking resistance or economic generalization. Approximate or cross-suite behavior
clustering, broader adversarial side-channel coverage, durable provider-process/sandbox adoption,
worker-chosen research sequences, controlled directed/undirected, memory, prospective allocation,
and AI-agent ablations, executed adaptive/static studies across regimes, deployed always-on paper
execution, automatic promotion, champion runner handoff,
private/live authority, and the other completion axes remain open.

The exact horizon, risk limits, confidence rule, regime coverage, and resource budget belong to a
versioned evaluation policy. They must be declared before a run rather than chosen after results are
visible.

## Veto Gates

Any one of these conditions vetoes Goal completion:

- Candidate or ResearchWorker can read hidden outcomes, future data, evaluator internals, or
  qualification results before their release boundary.
- A worker effect can occur before its ResearchPreflight commitment, or one commitment can receive
  a second sealed submission, retry, reconstruction, or silent resample after process loss, or a
  later worker effect can start before an orphan checkpoint-enabled commitment is terminally closed.
- Candidate self-report, generated explanation, or provider optimism can count as evaluation proof.
- Replay success or a manifest declaration can claim runnable paper handoff without exact external
  target-protocol conformance for the submitted artifact.
- A crashed, malformed, disqualified, duplicate, risk-invalid, provider-bypassing, private, or live
  submission can enter qualified paper evaluation.
- The same adaptive feedback window is reused as independent qualification evidence.
- A candidate can change `SystemCode`, model configuration, dependency closure, tool permissions,
  or decision policy during evaluation without a new identity and lineage.
- Research, evaluator, or challenger failure can silently stop, replace, or mutate the selected
  champion paper session.
- Higher leverage, missing costs, missing Ledger continuity, stale runner state, or missing market
  evidence can be mistaken for economic improvement.
- Worker count, candidate count, paper sessions, evaluation queries, retries, storage, time, or cost
  can grow without a configured bound.
- Research or paper paths can gain private exchange access or live order authority.

## Scientific Controls

Ouroboros must prove the leverage attributed to AI-agent hill climbing rather than assume it.
Controlled comparisons should use the same data access, evaluator, risk policy, and resource budget.

- Directed ResearchWorkers versus undirected ResearchWorkers.
- Shared findings and lineage versus an otherwise identical no-memory condition.
- Evidence-adaptive allocation versus static allocation.
- Agent-guided candidate generation versus random mutation or template generation.
- Champion versus challenger on the same prospective market opportunity stream.
- Agentic candidates versus deterministic, no-action, and simple market baselines.

Deterministic and rule-based systems are scientific controls and valid candidate components. They
are not the Ouroboros product thesis, but an agentic system that cannot beat them under equal
conditions has not demonstrated useful agent leverage.

## Priority Order

1. P0: evaluation information barriers, immutable evidence purpose, candidate freeze, prospective
   qualification evidence, and fair comparison.
2. P1: candidate admission, invalid quarantine, duplicate handling, and referentially complete
   findings and lineage.
3. P2: long-running ResearchWorker lifecycle, sandbox, notebook, snapshots, and shared memory.
4. P3: population diversity, exploration protection, and evidence-adaptive direction and budget
   allocation.
5. P4: champion and challenger paper comparison, qualification policy, and repeatable frontier
   lift.
6. P5: long-running recovery, cost control, observability, and shared operator read models.

The order is intentional. More autonomous generation without evaluation integrity increases the
speed of overfitting and evaluator exploitation rather than the rate of valid progress.

## Non-Goals

- Do not hardcode one strategy family, indicator set, provider, model, tool, research workflow, or
  candidate internal architecture as the solution.
- Do not require an LLM call for every `TradingSystemDecision`.
- Do not optimize candidate count, agent count, replay rank, or UI activity as the product outcome.
- Do not require monotonic improvement from every tick, direction, candidate, or market window.
- Do not preserve one mutable best artifact in place.
- Do not treat research feedback as final qualification evidence.
- Do not enable private or live exchange authority inside this Goal.
