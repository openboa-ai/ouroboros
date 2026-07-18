# Research And Arena Product Loop

Status: target product and operator contract with partial implementation. This document defines
what the continuously operating Research and Arena surfaces mean. It does not claim that the
current scheduler, read models, or UI already satisfy the contract.

## Product Boundary

Ouroboros has two cooperating product loops:

| Surface | Owns | Does not own |
| --- | --- | --- |
| Research | Bounded generation sessions, methodology, immutable development submissions, admission, findings, lineage, and sanitized evidence inputs. | Paper rank, fake-account execution, promotion, private data, or live authority. |
| Arena | Isolated admitted `TradingSystem` paper sessions, comparable paper evidence, performance rank, lifecycle, trace, logs, and recovery state. | Candidate generation, self-grading, qualification disclosure to an open worker, or live execution. |

Research creates an exact admitted `SystemCode`. Arena executes that exact artifact. The stable
join is candidate, version, SystemCode, admission, handoff-conformance, paper-evaluation, and
TradingRun identity. Mutable workspace state, provider narrative, display name, or a development
score cannot substitute for that join.

Future live operation is outside this frontier. Research may eventually consume a sanitized,
immutable live evidence artifact under the same information barrier, and Arena may eventually
produce a qualified handoff for an explicit live decision. Neither path grants current live,
private-data, credential, or order authority.

## Continuing Loop

```text
goal, timer, Arena event, future live event, or restart recovery
-> bounded Research trigger
-> ResearchDirection and methodology
-> immutable sanitized evidence inputs
-> bounded ResearchWorkerSession
-> immutable development submissions and aggregate feedback
-> explicit selection or finish without submission
-> sealed admission and paper handoff conformance
-> exact admitted SystemCode
-> bounded Arena queue
-> isolated PaperTradingEvaluation and TradingRun
-> comparable paper revenue - cost, risk, trace, failures, and lineage
-> sanitized Finding and evidence artifact
-> next bounded Research trigger
```

The service is continuous; individual effects are not. A 24/365 process repeatedly schedules
bounded, persisted work, stops at explicit limits, and reconstructs the next action after restart.
It must never depend on one infinite provider process, one mutable candidate workspace, or one
unbounded retry loop.

## Research Contract

Research is the observable candidate-generation process. A Research list row represents a real
persisted session or queued allocation, not a configured direction placeholder.

Each session exposes:

- trigger kind, goal, and exact source reference;
- ResearchDirection, hypothesis, method, and source candidate when present;
- worker, provider, model, commitment, bounded budget, and lifecycle;
- immutable development submissions and the worker's explicit selection;
- sanitized notebook and log summaries with truncation state;
- resulting admission, duplicate, quarantine, no-submission, or failed-closed state;
- exact admitted candidate and SystemCode link when one exists.

The supported lifecycle is `queued`, `allocating`, `running`, `awaiting_selection`,
`sealed_admission`, `admitted`, `duplicate`, `quarantined`, `finished_without_submission`,
`failed_closed`, or `recovering`. Process loss never changes old evidence or resumes an old sealed
opportunity. Recovery closes the old commitment exactly once and creates a new bounded allocation
only when policy still requests work.

### Research Evidence Input

Research may consume only immutable `ResearchEvidenceArtifact` inputs assembled outside the
worker. An input identifies its source subject, artifact, digest, capture time, and sanitization
status. Allowed source families are Arena paper result, Arena trace, Arena failure, released
research Finding, and future sanitized live result or trace.

The worker must not receive raw qualification windows before release, evaluator seeds, sealed
scenarios or outcomes, exchange credentials, private account data, mutable runner state, arbitrary
host paths, or direct access to Arena and live processes. Evidence compaction may summarize
performance, failures, risk, behavior, and lineage but cannot turn hidden evidence into feedback.

## Arena Contract

Arena is the observable paper execution and evaluation process for admitted TradingSystems. An
Arena list row represents one exact candidate version and its paper-session lifecycle. It is not a
ResearchPreflight score row.

Every admitted runnable handoff enters a bounded queue. The Arena supervisor starts up to the
configured concurrent-session limit. Each system owns an independent artifact workspace,
Sandbox, provider process when required, fake account, order state, TradingRun, Evaluation,
observation cursor, Ledger chain, lifecycle, and cleanup. Shared public market evidence may be
sealed for a comparison cohort, but state and effects remain isolated.

The supported lifecycle is `queued`, `starting`, `running`, `recovering`, `stopped`, `completed`,
`failed`, or `invalidated`. A detail projection exposes:

- exact candidate, version, SystemCode, admission, Evaluation, and TradingRun identity;
- Sandbox and workspace identity without a host-private filesystem path;
- network-policy and egress-attestation state;
- paper revenue, cost, net revenue, return, observations, risk, account, orders, and fills;
- bounded ordered lifecycle, market, decision, Gateway, Ledger, and recovery trace;
- bounded sanitized TradingSystem, Sandbox, Gateway, Ledger, and supervisor logs;
- explicit truncation, failure, next observation, and restart state.

The detail identity carries the exact `candidate_admission_decision_ref` and
`paper_trading_handoff_conformance_ref`; consumers do not reconstruct either admission edge from
candidate, SystemCode, Evaluation, or TradingRun identifiers.

### Comparability And Rank

Arena rank is based on externally calculated paper `net_revenue_usdt`; `net_return_pct` is the
secondary metric. ResearchPreflight revenue or score never defines Arena rank.

Ranked systems must share an exact comparison cohort that binds market opportunity, evidence
purpose, account, cost, risk, and relevant evaluation policy. Running sessions may receive a
provisional rank only at an exact common observation sequence and cutoff. Qualification remains a
separate evidence-quality decision. A session that is queued, invalidated, missing a common
boundary, or from a different cohort remains visible but unranked with an explicit reason. The UI
must not sort incomparable values into one implied leaderboard.

The cohort preserves the complete `PaperTradingEvaluationCommitmentRecord.policy_identity` and
`window_policy` as `evaluation_policy_identity` and `evaluation_window_policy`. A display label or
digest assembled from only a subset of those fields cannot establish comparability.

Negative and failed systems remain visible as research evidence. Malformed, boundary-bypassing,
or otherwise invalid systems remain quarantined or invalidated and cannot gain rank or downstream
authority.

## Operator UX Contract

Arena and Research are separate primary views with the same master-detail interaction model.

### Arena

The first viewport shows actual system count, loop health, active and queued capacity, latest
observation time, comparable cohort, and a dense system table. Default columns are lifecycle,
system, direction, comparable rank, net revenue, return, observations, risk or blocker, and latest
activity. Selecting a row opens system identity, paper performance, account and positions,
orders/fills, isolation, trace, logs, lineage, and failures without navigating away from the list.

### Research

The first viewport shows actual session count, loop health, active and queued capacity, latest
progress time, and a dense session table. Default columns are lifecycle, methodology, direction,
trigger, provider, budget, submissions, result, and latest progress. Selecting a row opens the
goal, hypothesis, method, sanitized evidence inputs, immutable submissions, selected artifact,
admission graph, notebook summary, logs, lineage, and resulting Arena link.

Both views must distinguish empty, stopped, queued, running, recovering, degraded, terminal, and
failed states. Fixture data must be labeled. Configured directions, selected-candidate fallbacks,
or synthetic rows must not appear as active work.

## 24/365 Operation

One store-scoped supervisor owns scheduling and recovery while preserving lane isolation:

1. Reconcile persisted desired state and exact process ownership.
2. Recover or close interrupted Research and Arena work before creating new effects.
3. Admit bounded work according to concurrency, provider, Sandbox, cost, and storage capacity.
4. Persist every transition and next wake time before sleeping.
5. Retry only retryable operational failure with bounded backoff and an explicit attempt budget.
6. Keep a failed lane visible and continue unrelated healthy work when authority and capacity allow.
7. Stop in reverse ownership order and retain evidence when cleanup is incomplete.

Always-on means the supervisor remains available and makes persisted progress. It does not mean
constant candidate generation, forced trading decisions, hidden retries, or ignoring backpressure.
Goal, time, event, and recovery triggers may all create work, but each trigger produces one bounded
and attributable unit.

## Read-Model Contract

The compatibility `CandidateArenaReadModel` and selected-candidate paper projections remain
available during migration. They do not satisfy this product contract by themselves.

The additive domain projections are:

| Projection | Purpose |
| --- | --- |
| `ArenaOperationsReadModel` | Loop health, capacity, and all admitted paper-system summaries. |
| `ArenaTradingSystemDetailReadModel` | One system's execution, isolation, paper state, trace, logs, and artifacts. |
| `ResearchOperationsReadModel` | Loop health, capacity, and actual queued or persisted Research sessions. |
| `ResearchSessionDetailReadModel` | One session's trigger, methodology, evidence, submissions, result, and logs. |

Operator migration may expose these fields optionally until the owning builders and UI ship. An
absent projection means unavailable, not an empty or successful loop. Once the builders are
implemented, the projections become required API state and compatibility views can be retired in a
separate migration.

## Delivery Slices

This contract is implemented through three product changes and a separate operations evidence
track:

1. `OURO-228`: freeze this product, UX, state, and read-model contract.
2. `OURO-229`: implement bounded concurrent Arena scheduling, paper-based comparable rank, list and
   detail projections, Desktop UX, and rendered validation.
3. `OURO-230`: implement bounded goal/time/event Research scheduling, sanitized evidence inputs,
   session list and detail projections, Desktop UX, and rendered validation.
4. Operations tickets independently harden process ownership, Sandbox cleanup, restart recovery,
   and the final two-hour unattended evidence run.

`OURO-229` and `OURO-230` may proceed in separate worktrees after this contract lands. They must not
depend on each other's unmerged code. Their only shared join is the exact admitted SystemCode and
persisted evidence contract defined here.

## Acceptance Evidence

The Research and Arena product frontier is accepted only when current-head evidence demonstrates:

1. A real provider session is visible in Research from trigger through terminal admission state.
2. At least two admitted systems can queue or run in independently owned Arena sessions.
3. Arena rank uses only comparable paper evidence and visibly leaves other systems unranked.
4. Selecting any system or session exposes the required bounded trace, logs, identity, and lineage.
5. An Arena result produces one sanitized immutable Research evidence input without hidden
   qualification or private data.
6. Restart reconstructs both lists and continues or closes exact persisted work without duplicate
   effects.
7. Desktop screenshots cover populated, empty, degraded, and narrow viewport states without
   overlap or synthetic active work.
8. Required typechecks, tests, security guards, current-head CI, and current-head Codex review pass.

Long-horizon economic frontier improvement and live promotion are later outcomes. They are not
required to prove that this continuous Research and Arena environment exists and operates
correctly.
