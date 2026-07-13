# ResearchControlStudy Server Scheduler Design

**Status:** Approved for implementation under the standing autonomous Goal mandate

## Goal

Make committed `ResearchControlStudy` work a server-owned, bounded, restart-derived process. The
runtime server must automatically drain pending studies, wait without busy polling, discover later
commitments, and stop active work cleanly during shutdown without changing study, allocation,
promotion, paper, or live authority.

## Why This Frontier Is Next

The existing `ResearchControlStudyProcessSupervisor` already discovers incomplete studies in exact
commitment order, runs one injected study runtime at a time, rescans after completion, halts on
failure, and reconstructs work from append-only evidence after restart. It is still one-shot and
must be started explicitly. A committed study can therefore remain inert indefinitely even while
the CandidateArena server and paper runtime are running.

The previous frontier proved a six-replication qualified non-tied adaptive/static study through
real arm-local paper sessions. The next missing core behavior is longitudinal ownership: the
composition root must keep that already-bounded process alive without an operator issuing one
instruction per study.

## Considered Approaches

### 1. Add a public command that runs one study

Rejected. It improves accessibility but leaves iteration-by-iteration human control in the core
research loop. It also creates a second execution route instead of composing the existing process
supervisor.

### 2. Start the existing one-shot supervisor once during server boot

Rejected as insufficient. It drains commitments present at startup but exits at `caught_up`; a
study committed one second later remains inert until process restart.

### 3. Wrap the supervisor in a server-owned bounded scheduler

Selected. A small runtime scheduler starts the existing supervisor, waits after `caught_up`, and
starts it again at a frozen poll interval. The server composition root owns startup and shutdown.
The scheduler does not duplicate study discovery, execution, or persistence rules.

## Canonical Vocabulary

Use `ResearchControlStudyScheduler` for the process-local runtime component. `Scheduler` is the
conventional engineering term for bounded recurring work. It is not a new domain record and adds
no persisted key or compatibility alias.

Keep `ResearchControlStudyProcessSupervisor` as the one-shot queue owner. The scheduler controls
when that supervisor runs; the supervisor continues to control study ordering and single-active
execution.

## Architecture

### Scheduler boundary

Add one runtime-only `ResearchControlStudyScheduler` with this lifecycle:

```text
idle
-> start
-> supervisor.start
-> supervisor.drain
-> caught_up
-> interruptible bounded wait
-> supervisor.start
-> ...
-> stop requested
-> supervisor.stop when active
-> stopped
```

Only one scheduler loop and one supervisor run may exist per server instance. Calling `start` while
active is idempotent. A scheduler failure is terminal for that server process: it records the stable
error, stops polling, and does not skip or spin over the failing study. Restart reconstructs the
pending queue from persisted study and outcome evidence.

The default poll interval is 10 seconds. It must be a finite positive integer and is a runtime
resource bound, not a persisted evaluation-policy field. Timers must be unreferenced where Node
supports it, and `stop` must interrupt the wait immediately rather than sleeping through shutdown.

### Exact runtime reconstruction

Add a server composition factory that opens one study runtime from the exact persisted
`ResearchControlStudyRecord`:

1. use `condition.source.candidate_ref.id` as the frozen source candidate;
2. create the configured provider adapter for `condition.research_agent.provider` and require its
   compact provider/model/permission identity to match the persisted identity digest;
3. use `condition.campaign_policy` for tick count and baseline file/byte bounds;
4. remove only the derived protocol digest and reuse the exact bound paper-evaluation protocol;
5. use one deterministic workspace root below the primary store root;
6. reuse the server's research artifact runner and replay-provider factory;
7. create each arm's `PaperTradingSessionService` against that arm's exact copied `LocalStore`,
   public `MarketDataPort`, artifact resolver, provider factory, and isolated sandbox-adapter
   registry.

No policy field is resampled from current defaults. If current runtime dependencies cannot satisfy
the persisted condition, opening fails closed and the supervisor records a stable platform failure.

### Server lifecycle

`buildServer` creates the default scheduler after store initialization and paper-session recovery.
It starts the scheduler before returning the server unless
`runResearchControlStudiesOnStart: false` is explicitly supplied for a bounded test or maintenance
process. The default product path is enabled.

The server's `onClose` hook stops the study scheduler before stopping CandidateArena and paper
services. This lets active arm-local runners perform their existing cleanup before shared runtime
dependencies disappear.

Expose dependency-injection options for tests and specialized composition:

- `researchControlStudyScheduler` to supply a lifecycle-compatible scheduler;
- `researchControlStudyPollIntervalMs` to freeze a bounded runtime interval;
- `researchControlStudyWorkspaceRoot` to override physical placement;
- `researchControlStudyArmSessionFactory` to supply exact arm-local paper sessions;
- `onResearchControlStudySchedulerCreated` for status inspection without adding a public command.

## Error And Stop Semantics

- Discovery or persisted graph corruption stops the scheduler with the supervisor's stable error.
- Runtime opening failure remains platform-attributed and leaves the study pending.
- Study runner failure remains attached to that study and later studies are not opened.
- Scheduler poll/sleep failure stops the scheduler; it is never converted into strategy evidence.
- Shutdown requests stop the active supervisor, await its existing drain semantics, and then mark
  the scheduler stopped.
- A server restart may retry pending work because no study outcome exists; exact campaign and study
  services continue to reject duplicate effects and reuse persisted completion.

## Tests

### Scheduler tests

- starts one supervisor immediately and never overlaps runs;
- waits after `caught_up`, then discovers work committed during the wait;
- accumulates completed-study count across poll cycles;
- returns `already_running` on duplicate start;
- interrupts a waiting poll on stop;
- delegates stop to an active supervisor and opens no later cycle;
- halts on stable supervisor failure without a retry loop.

### Reconstruction tests

- derives source, agent, bounds, protocol, and workspace from one exact persisted study;
- rejects configured agent identity drift before campaign effects;
- creates arm sessions against the arm-local store root;
- forwards the current public market-data and paper-only provider boundaries;
- never creates a study, policy decision, promotion, private read, or live authority.

### Server tests

- starts the scheduler by default after server construction;
- supports the explicit disabled path;
- stops and drains the scheduler before other runtime services on close;
- exposes the created scheduler through the bounded observer callback;
- restart starts a new scheduler which can reconstruct still-pending evidence.

Run focused tests, the complete Vitest suite, workspace type checks, and repository guards before
the frontier is kept.

## Non-Goals

- no automatic `ResearchControlStudy` commitment;
- no automatic `ResearchAllocationPolicyDecision` creation;
- no automatic `TradingPromotion` or champion runner handoff;
- no public operator command or new UI;
- no cross-process lease in this frontier;
- no private exchange data, credentials, signed requests, live orders, or new authority;
- no claim that process-local scheduling completes P0, real-market replication, longitudinal soak,
  or the overall Goal.

## Acceptance Criteria

1. A default runtime server automatically executes an already committed pending study without an
   operator command.
2. A study committed after the server reaches `caught_up` is discovered within one bounded poll
   interval.
3. At most one study runtime is active in one server process.
4. Every runtime input is reconstructed from and revalidated against the persisted study condition.
5. Failure stops the scheduler without skipping, spinning, or producing strategy evidence.
6. Server shutdown interrupts waiting and drains active study work before dependent services stop.
7. Restart derives pending work from append-only evidence and produces no duplicate terminal
   outcome.
8. Tests, type checks, docs, architecture, naming, environment, secret, and diff guards pass.

## Remaining Boundary

This frontier establishes server-owned process-local scheduling. Multiple server processes can
still observe the same pending study. A persisted cross-process lease with expiry, renewal,
takeover, and exact owner evidence is the next ownership frontier before this scheduler can be
claimed safe for horizontally duplicated deployment.
