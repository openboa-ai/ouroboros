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
| External evaluation and admission | Candidate output is evaluated outside its authority; the exact submitted artifact must pass sealed ResearchPreflight and bounded target paper-protocol conformance, and crashed, malformed, boundary-bypassing, leaked, and otherwise invalid submissions cannot reach runnable paper handoff. |
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
long-lived worker ownership, provider-dollar cost, controlled discovery-yield results, and the
remaining completion evidence are still open.

Current partial implementation evidence also covers the candidate-to-paper handoff boundary.
Candidate-facing replay and paper-probe payloads exclude evaluator-only direction, outcome, hidden
risk, private, credential, direct-order, and live fields. Every replay-accepted research iteration
runs the exact sealed submitted artifact through a bounded external
`PaperTradingHandoffConformance` probe using the production paper event parser. New admission and
materialization require the exact passed record, and generated-candidate paper start revalidates
that graph before commitment, provider, sandbox, runner, Ledger, or observation effects. Generated
single-file Python identity is a canonical manifest-plus-entrypoint closure digest; undeclared
files, directories, symlinks, editable paths, and manifest drift are rejected. Rejected
conformance remains a causal Finding and infrastructure failure remains a direction failure. This
does not complete external evaluation, P0, or the Goal: repeated-score and window probing,
behavior-level duplicate detection, durable ResearchWorker recovery, production comparison
scheduling, automatic promotion, champion runner handoff, private/live authority, and the other
completion axes remain open.

The exact horizon, risk limits, confidence rule, regime coverage, and resource budget belong to a
versioned evaluation policy. They must be declared before a run rather than chosen after results are
visible.

## Veto Gates

Any one of these conditions vetoes Goal completion:

- Candidate or ResearchWorker can read hidden outcomes, future data, evaluator internals, or
  qualification results before their release boundary.
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
