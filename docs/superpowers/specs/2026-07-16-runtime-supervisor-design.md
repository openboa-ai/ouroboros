# Runtime Supervisor Design

**Status:** Approved for implementation on 2026-07-16

## Goal

Make the existing selected-paper, CandidateArena, and ResearchControlStudy runtime loops operate
continuously under one fail-closed server lifecycle. The supervisor must recover exact persisted
intent after restart, avoid duplicate effects, retry transient failures within fixed bounds, retain
durable blocked/stopped state, and expose one infrastructure health projection.

This frontier creates the operating environment for long-running evidence. It does not claim that
long-horizon paper performance, prospective economic improvement, or restart-soak duration has
already been proven.

## Current Gap

`buildServer` currently owns four independent lifecycle fragments:

1. it recovers running paper evaluations once and terminally fails each first recovery error;
2. it asks `OperatorService` to resume an Arena command once;
3. it starts one `ResearchControlStudyScheduler` which cannot restart after failure;
4. it stops scheduler, Arena, pending paper starts, and sessions through a handwritten hook.

Those components already own their domain behavior. The missing boundary is coordination:
single-process ownership, bounded retry, no-progress detection, durable lifecycle state, and one
observable status. Generated candidates also pass an external deny-default egress probe during
admission but their ordinary long-running paper session still selects the deterministic host
adapter, so the actual paper process does not retain the same deny-default Sandbox boundary.

## Considered Approaches

### Add retry state to every existing engine

Rejected. Paper, Arena, and study scheduling would acquire different retry, status, shutdown, and
persistence semantics. `buildServer` would remain the implicit lifecycle owner.

### Replace the engines with a generic job queue

Rejected. The existing engines already encode exact evidence reconstruction, candidate cadence,
study ordering, and paper lifecycle. Reimplementing those rules in a queue would duplicate product
authority and encourage centralized rule-based trading behavior.

### Add one coordination-only supervisor

Selected. One `RuntimeSupervisor` calls the existing recovery/resume/start/stop APIs and owns only
process lifecycle policy. It does not call `CandidateArenaRunner.tick`, synthesize observations,
select candidates, interpret profitability, or mutate promotion state.

## Architecture

### Lanes

The supervisor owns three fixed lanes in startup order:

1. `selected_paper`: reconcile exact persisted running, non-qualification
   `PaperTradingEvaluation` sessions through `PaperTradingSessionService`;
2. `candidate_arena`: resume only when persisted `arena.start` intent and provider readiness allow
   the existing autonomous Arena runner to run;
3. `research_control_study_scheduler`: start or restart the existing scheduler, which continues to
   discover and execute studies through its current supervisor and lease boundaries.

Shutdown reverses dependency order: study scheduler, Arena and pending Arena paper continuations,
then paper sessions. A failure in a research lane must not stop a healthy selected-paper lane.

### State model

The shared top-level states are:

- `recovering`: one or more due lane reconciliations are executing;
- `running`: every desired lane is healthy and every undesired lane is intentionally idle;
- `degraded`: at least one lane failed but has a bounded retry scheduled;
- `blocked`: at least one lane exhausted the no-progress budget or hit a fail-closed ownership or
  checkpoint error;
- `stopped`: ordered shutdown completed and ownership was released.

Each lane records desired state, basis digest, progress digest, attempt count, no-progress count,
optional retry time, and a stable reason code. Attempts reset when the lane basis changes or
observable progress advances. Three failures against one unchanged basis/progress pair exhaust the
default budget. A blocked lane stays blocked for that basis; changed persisted intent/evidence may
open a new bounded attempt series.

### Durable checkpoint chain

`RuntimeSupervisorCheckpoint` is runtime-coordination evidence, not trading or evaluation
evidence. A filesystem adapter under the LocalStore root appends one immutable linear chain with:

- monotonically increasing sequence;
- predecessor digest;
- shared supervisor and lane projection;
- exact checkpoint digest;
- explicit false evaluation, promotion, order, private, and live authority.

Publication compares the expected predecessor and uses create-only writes. Load validates every
record and the complete predecessor chain. Corruption, a fork, or stale publication fails closed.
The latest checkpoint reconstructs retry and sticky blocked state after process restart.

### Single-owner process boundary

Extend `RuntimeProcessOwnership` with `runtime_supervisor`. `buildServer` claims the current server
PID and exact store-scoped supervisor identity before child effects. A second live server for the
same store cannot supervise the lanes. A dead previous owner is retired by the existing exact PID
start-marker logic. Clean shutdown closes, rather than signals, the current process ownership.

This remains same-host fencing. Multi-host distributed fencing is a separate frontier.

### Paper retry semantics

`recoverRunningEvaluations` gains an explicit non-terminal mode used only by the supervisor.
Provider and Sandbox effects are cleaned after a failed attempt, while the persisted evaluation
remains running and retryable. Direct callers retain the existing terminal-on-failure default.
After the no-progress budget is exhausted, the supervisor records the existing paper recovery
failure once and leaves the lane durably blocked. Invalid commitment or artifact evidence remains
immediately invalidated and is never retried as transient infrastructure failure.

### Candidate Sandbox egress

The generated-candidate eligibility check becomes a shared application service invoked both by the
public paper command and `PaperTradingSessionService` before provider or Sandbox effects. Fixture
candidates keep the deterministic adapter. A non-fixture provider-generated candidate selects
`docker_sandboxes_sbx` only after version 2 handoff and egress-attestation verification for its
exact SystemCode and evidence chain. Sandbox acquisition then verifies the active deny-default
network policy before candidate execution.

Restart first stops the adapter recorded by the existing Sandbox before selecting another adapter.
Docker stop terminates the candidate, stops the Sandbox, releases owned network rules, and removes
the Sandbox with `sbx rm --force`. A new/recovered process therefore receives a newly verified
active policy rather than reusing an unattested external container.

### Health projection

`RuntimeSupervisorReadModel` is returned unchanged from both `/health` and
`OperatorReadModel.runtime_supervisor`. It reports infrastructure/security lifecycle only. Trading
loss, rank, strategy behavior, and candidate quality cannot degrade or block this status.

## Failure Rules

- Ownership conflict, checkpoint corruption, and invalid durable identity fail closed before lane
  effects.
- Invalid paper commitment/artifact/handoff evidence keeps its existing terminal invalidation.
- Transient provider, Sandbox, provider-readiness, and scheduler failures receive bounded retries.
- No-progress exhaustion persists `blocked`; it never spins indefinitely.
- Research failure does not stop a healthy selected paper session.
- Startup publication failure drains any recovered lanes before ownership release. A drain or
  ownership-close failure retains ownership and fails closed against duplicate startup.
- Shutdown waits for the active reconciliation, then drains dependencies in fixed order and writes
  `stopped`.
- A signal-triggered drain failure retains ownership and exits non-zero so only exact-PID
  stale-owner recovery can admit the replacement process.
- If Docker stop and force removal both fail, preserve failed lifecycle evidence and retain the
  deny policy plus lease while candidate execution may still exist.
- No lane grants promotion, order submission, private exchange access, or live authority.

## Verification

- checkpoint adapter: append/reload, predecessor conflict, corruption/fork rejection, restart
  reconstruction;
- supervisor: exact startup order, duplicate-owner rejection, retry/progress reset, sticky blocked,
  independent paper continuity, interruptible monitor, and reverse shutdown order;
- paper: non-terminal retry mode, terminal exhaustion, service-level generated eligibility, adapter
  selection, adapter transition cleanup, and no effects before rejection;
- Docker adapter: stop, policy release, forced removal, and restart acquisition order;
- server: default composition, disable flags, identical `/health` and Operator projection, callback
  compatibility, and close ordering;
- focused tests, full Vitest, workspace type checks, and repository guards.

## Non-Goals

- no TradingSystem cadence, strategy, model, tool, or order rule;
- no candidate selection, paper rank, qualification, promotion, or champion handoff change;
- no automatic private or live exchange authority;
- no multi-host fencing or distributed consensus;
- no claim of completed long-duration soak or profitable prospective performance;
- no generic job queue and no new public mutation command.

## Acceptance Criteria

1. One exact store-scoped runtime owner supervises all three existing lanes without duplicate
   effects after restart.
2. Transient failures retry at fixed bounds; unchanged no-progress exhausts to durable `blocked`.
3. Clean shutdown persists `stopped` and drains in dependency order.
4. A research failure cannot stop a healthy selected-paper lane.
5. Non-fixture provider-generated long-running paper execution uses a freshly verified
   deny-default Docker Sandbox and cleans policy plus container state before restart.
6. `/health` and `OperatorReadModel` expose the same five-state projection and stable lane reasons.
7. The supervisor contains no trading/economic decision authority.
