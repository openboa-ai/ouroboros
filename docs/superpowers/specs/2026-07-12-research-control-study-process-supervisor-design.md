# ResearchControlStudy Process Supervisor Design

**Status:** Implemented and locally verified under the standing CandidateArena Goal authority;
the listener-capable full suite passes, while a prospective replicated study remains uncollected

## Goal

Discover committed, incomplete `ResearchControlStudy` records from repository-owned evidence and
run them through the existing sequential study runtime without requiring a caller to identify each
study manually.

The process must preserve fixed study order, restart projection, stop-between-campaign behavior,
and the separation between study inference and policy selection. It must not add a public command,
start multiple studies concurrently, create policy decisions automatically, or widen trading
authority.

## Approaches

### Add a public CLI or HTTP start command

Rejected for this frontier. It widens the operator contract before process ownership and
listener-capable evidence are proven.

### Auto-start every incomplete study from every runtime process

Rejected. Multiple composition roots could duplicate external campaign effects. A durable
cross-process lease is a separate deployment problem.

### Add one internally owned discovery supervisor

Selected. One composition root owns one in-memory supervisor. On start it discovers the oldest
incomplete study, opens its existing runtime, drains it to completion, rescans durable evidence,
and proceeds sequentially until caught up. Restart repeats discovery from append-only records.

## Boundaries

The supervisor owns process scheduling only. Existing components retain their responsibilities:

- `ResearchControlStudy` owns pre-effect replication commitment.
- `ResearchControlStudyExecutor` derives one legal next action from exact evidence.
- `ResearchControlStudyRunner` drains one study sequentially and stops between campaigns.
- `ResearchControlStudyProcessSupervisor` discovers which study the process should run next.
- `ResearchAllocationPolicyDecisionService` remains a separate explicit action after study
  adjudication.

The supervisor never interprets campaign statistics, creates candidates directly, evaluates paper
evidence, or selects an allocation policy.

## Discovery Contract

`discoverResearchControlStudyProcessQueue` consumes exact study and study-outcome lists and returns
pending studies ordered by:

1. `committed_at` ascending;
2. `research_control_study_id` ascending.

Discovery fails closed when:

- a study ID is duplicated;
- a study outcome ID is duplicated;
- an outcome references an absent study;
- more than one outcome references one study;
- an outcome study digest differs from its study;
- an outcome predates its study;
- record ordering or required identifiers are malformed.

A study with one exact matching terminal outcome is complete and excluded. A study without an
outcome is pending regardless of whether its current campaign is absent, active, or terminal; the
existing executor derives that finer-grained action.

## Process Lifecycle

The supervisor exposes:

```ts
type ResearchControlStudyProcessStatus =
  | { status: "idle" }
  | { status: "discovering"; completedStudyCount: number }
  | { status: "running"; studyId: string; completedStudyCount: number }
  | { status: "caught_up"; completedStudyCount: number }
  | { status: "stopped"; completedStudyCount: number; studyId?: string }
  | {
      status: "failed";
      completedStudyCount: number;
      studyId?: string;
      errorCode: string;
      errorMessage: string;
    };
```

`start()` returns `started` or `already_running`. The process runs asynchronously. `drain()` waits
for caught-up, stopped, or failed state. `stop()` requests stop on the active study runner, waits for
its current campaign action to drain, and does not open another study.

After each completed study, the process reloads repository evidence rather than trusting only the
runner result. If the same study remains pending, it fails with a persistence-conflict error instead
of spinning. It rescans after every completion so a study committed while another study was running
joins the deterministic queue.

## Runtime Opening

The supervisor receives one injected `openStudy(study)` factory returning the existing study
runner surface:

```ts
interface ResearchControlStudyProcessRuntime {
  runner: Pick<ResearchControlStudyRunner, "start" | "drain" | "stop" | "status">;
}
```

The factory is invoked only for the selected pending study. This keeps filesystem, agent, market
data, sandbox, and paper-session composition in the runtime layer and makes listener-free process
tests possible. Factory failure is terminal for that supervisor run and retains the study as
pending for restart.

## Recovery And Ownership

No process-progress record is persisted. Recovery derives from studies, campaigns, campaign
outcomes, and study outcomes already owned by the existing graph. A stopped or failed process can
be recreated and started against the same store.

Version 1 assumes exactly one process supervisor per LocalStore composition root. Cross-process
leases, distributed ownership, stale-owner takeover, and server auto-start are non-goals. This
constraint prevents the new discovery loop from claiming deployment safety it does not yet have.

## Failure Semantics

- Discovery graph errors use `research_control_study_process_graph_invalid`.
- Runtime factory errors use `research_control_study_process_open_failed`.
- A failed study runner preserves its stable runner error code as process `errorCode`.
- A completed runner without exact persisted closure uses
  `research_control_study_process_persistence_conflict`.
- Stop is not failure and drains the active runner before returning.
- Failures never skip to a later study because doing so would violate deterministic experiment
  order and hide an unresolved earlier effect.

## Authority

The process has research scheduling authority only. It has no evaluation, policy-selection,
promotion, order-submission, private-read, credential, or live-exchange authority. It never invokes
`ResearchAllocationPolicyDecisionService`.

## Testing

- exact discovery ordering and terminal filtering;
- duplicate, orphan, mismatched, and time-inverted graph rejection;
- sequential one-study-at-a-time execution;
- rescan after completion and inclusion of newly committed work;
- caught-up no-op behavior;
- active-study stop and no later study start;
- stable runner failure propagation;
- completed-without-persistence rejection;
- reconstruction and resume after process restart;
- regression for the existing study runner/runtime and policy-decision separation.

## Non-Goals

- Public CLI, HTTP, TUI, or Desktop commands.
- Server auto-start or long-lived polling for newly committed studies.
- Cross-process lease or distributed execution.
- Parallel studies or parallel campaigns within one study.
- Automatic study commitment or policy-decision creation.
- Listener-capable paper infrastructure changes.
- Distinct-regime, memory/no-memory, or agent/baseline factorial inference.
- TradingPromotion, private exchange access, or live execution.

## Acceptance

1. One process start deterministically drains all currently discoverable incomplete studies.
2. At most one study runner is active at a time.
3. Restart derives the next study only from exact persisted evidence.
4. Stop drains the active campaign and starts no later study.
5. Failure in an earlier study cannot be silently skipped.
6. Completion without exact persisted outcome fails closed.
7. No policy decision or trading authority is created.
