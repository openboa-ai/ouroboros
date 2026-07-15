# ResearchControlStudy Server Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically and continuously execute committed pending `ResearchControlStudy` work from the runtime server under one bounded process-local scheduler.

**Architecture:** A new `ResearchControlStudyScheduler` repeatedly invokes the existing one-shot `ResearchControlStudyProcessSupervisor` and owns interruptible polling. A server-runtime factory reconstructs each study runtime exclusively from its persisted condition. `buildServer` owns scheduler creation, default startup, inspection callback, and shutdown ordering.

**Tech Stack:** TypeScript, Fastify lifecycle hooks, Vitest, existing LocalStore, CandidateArena runtime services, PaperTradingSessionService.

**Status:** Completed on 2026-07-13. Full validation passed with 174 test files and 2760 tests,
workspace-wide type checks, and `npm run check:repo-guards`.

## Global Constraints

- GitHub `main` repo truth and root `AGENTS.md` doctrine remain authoritative.
- A persisted pending study is execution intent; this frontier does not create studies.
- One server process may run at most one supervisor and one study runtime at a time.
- Every campaign policy input comes from the exact persisted study condition.
- Failures halt without skipping, spinning, favorable evidence, policy mutation, or promotion.
- Paper remains public-data, fake-execution, `not_live`; no private or live authority is added.
- Cross-process leasing, automatic policy decisions, promotion, and champion handoff remain out of scope.
- Write tests first and observe the expected failure before implementation.

---

### Task 1: Interruptible Process-Local Scheduler

**Files:**
- Create: `apps/runtime/src/candidate/arena/research-control-study-scheduler.ts`
- Create: `apps/runtime/test/research-control-study-scheduler.test.ts`

**Interfaces:**
- Consumes: `ResearchControlStudyProcessSupervisor` lifecycle methods `start`, `drain`, `stop`, and `status`.
- Produces: `ResearchControlStudyScheduler`, `ResearchControlStudySchedulerStatus`, and a lifecycle interface usable by `buildServer`.

- [x] **Step 1: Write failing scheduler lifecycle tests**

Cover immediate start, `caught_up` wait and rescan, cumulative completed count, duplicate start,
interruptible stop, active-supervisor stop delegation, terminal failure, and invalid interval. Use a
scripted fake supervisor whose cycle statuses are exact
`ResearchControlStudyProcessStatus` values and a deferred sleep so tests do not use wall-clock time.

The primary assertion shape is:

```ts
const scheduler = new ResearchControlStudyScheduler({
  supervisor,
  pollIntervalMs: 10_000,
  now: clock.now,
  sleep: clock.sleep
});
expect(scheduler.start()).toBe("started");
await clock.waiting();
expect(scheduler.status()).toMatchObject({
  status: "waiting",
  cycleCount: 1,
  completedStudyCount: 1,
  nextPollAt: "2026-07-13T00:00:10.000Z"
});
clock.advance();
await scheduler.stop();
expect(scheduler.status()).toMatchObject({ status: "stopped" });
```

- [x] **Step 2: Run the scheduler test and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-scheduler.test.ts
```

Expected: FAIL because `research-control-study-scheduler.ts` does not exist.

- [x] **Step 3: Implement the minimal scheduler**

Implement this public surface:

```ts
export interface ResearchControlStudySchedulerLifecycle {
  start(): "started" | "already_running";
  stop(): Promise<void>;
  drain(): Promise<void>;
  status(): ResearchControlStudySchedulerStatus;
}

export class ResearchControlStudyScheduler
  implements ResearchControlStudySchedulerLifecycle {
  constructor(options: {
    supervisor: Pick<ResearchControlStudyProcessSupervisor,
      "start" | "drain" | "stop" | "status">;
    pollIntervalMs?: number;
    now?: () => string;
    sleep?: (milliseconds: number) => Promise<void>;
  });
}
```

Use a deferred stop signal raced against sleep. Require a positive integer interval, validate exact
ISO clocks before projecting `nextPollAt`, unref default timers, and treat any supervisor status
other than `caught_up`, `failed`, or an expected stop as a stable scheduler failure. Add each
supervisor cycle's `completedStudyCount` to the scheduler cumulative total.

- [x] **Step 4: Run the scheduler test and verify GREEN**

Run the Task 1 command. Expected: all scheduler tests pass with no leaked timer or unresolved
promise.

- [x] **Step 5: Commit Task 1**

```bash
git add apps/runtime/src/candidate/arena/research-control-study-scheduler.ts apps/runtime/test/research-control-study-scheduler.test.ts
git commit -m "feat: schedule pending research studies"
```

---

### Task 2: Exact Persisted-Study Runtime Reconstruction

**Files:**
- Create: `apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts`
- Create: `apps/runtime/test/research-control-study-server-runtime.test.ts`

**Interfaces:**
- Consumes: `LocalStore`, `ResearchControlStudyRecord`, `createResearchControlStudyRuntime`, server research-agent factory, artifact runner, replay provider, public market data, and arm session factory.
- Produces: `openResearchControlStudyServerRuntime` and `createResearchControlStudyServerScheduler`.

- [x] **Step 1: Write failing reconstruction tests**

Use `researchControlStudyFixture` and an injected `createStudyRuntime` spy. Assert the captured
campaign input contains:

```ts
expect(captured).toMatchObject({
  store,
  campaign: {
    workspaceRoot,
    sourceCandidateId: study.condition.source.candidate_ref.id,
    researchAgent: study.condition.research_agent.provider,
    tickCountPerArm: study.condition.campaign_policy.tick_count_per_arm,
    maximumBaselineRegularFileCount:
      study.condition.campaign_policy.maximum_baseline_regular_file_count,
    maximumBaselineTotalBytes:
      study.condition.campaign_policy.maximum_baseline_total_bytes,
    paperEvaluationProtocol: {
      protocol_status: "bound",
      comparison_policy:
        study.condition.paper_evaluation_protocol.comparison_policy
    },
    marketData,
    createArmSessions
  }
});
```

Assert `protocol_digest` is absent, artifact/replay adapters are forwarded, the workspace default is
`${path.resolve(store.root())}-research-control-study-workspaces` and does not overlap the source
store, and provider/model/permission or identity-digest drift throws
`research_control_study_server_runtime_agent_mismatch` before `createStudyRuntime` is called.

- [x] **Step 2: Run the reconstruction test and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-server-runtime.test.ts
```

Expected: FAIL because the server-runtime factory does not exist.

- [x] **Step 3: Implement exact reconstruction and scheduler composition**

Implement:

```ts
export async function openResearchControlStudyServerRuntime(input: {
  study: ResearchControlStudyRecord;
  store: LocalStore;
  workspaceRoot?: string;
  repoRoot?: string;
  marketData: GatewayMarketDataPort;
  agentFactory(agent: TradingResearchRuntimeAgent): TradingResearchAgentAdapter;
  createArmSessions: NonNullable<
    RunResearchControlCampaignToOutcomeInput["createArmSessions"]>;
  artifactRunner?: TradingArtifactRunner;
  replayProviderFactory?: ReplayTradingApiProviderFactory;
  createStudyRuntime?: typeof createResearchControlStudyRuntime;
}): Promise<ResearchControlStudyRuntime>;
```

Recompute the persisted compact agent identity digest with the domain canonical digest input used by
campaign decisions. Reject unsupported providers and all identity drift. Freeze an agent factory
that revalidates every adapter it returns. Strip only `protocol_digest` from the persisted bound
protocol and pass every other field unchanged.

`createResearchControlStudyServerScheduler` must build one
`ResearchControlStudyProcessSupervisor` whose `openStudy` calls this function, then wrap it in Task
1's scheduler. Do not add a second discovery implementation.

- [x] **Step 4: Run reconstruction and existing process tests**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-server-runtime.test.ts apps/runtime/test/research-control-study-process-supervisor.test.ts apps/runtime/test/research-control-study-process-discovery.test.ts
```

Expected: all files pass.

- [x] **Step 5: Commit Task 2**

```bash
git add apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts apps/runtime/test/research-control-study-server-runtime.test.ts
git commit -m "feat: reconstruct committed study runtimes"
```

---

### Task 3: Runtime Server Lifecycle Composition

**Files:**
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/test/server.test.ts`

**Interfaces:**
- Consumes: Task 1 scheduler lifecycle, Task 2 scheduler factory, and existing arm session factory.
- Produces: default server startup and shutdown ownership for pending studies.

- [x] **Step 1: Write failing server lifecycle tests**

Add an injected scheduler fake and prove:

```ts
const server = await buildRuntimeTestServer({
  researchControlStudyScheduler: scheduler,
  onResearchControlStudySchedulerCreated(value) {
    observed = value;
  }
});
expect(scheduler.startCount).toBe(1);
expect(observed).toBe(scheduler);
await server.close();
expect(scheduler.stopCount).toBe(1);
```

Add a disabled-start case with `runResearchControlStudiesOnStart: false` that leaves `startCount`
at zero while still allowing safe close. Record lifecycle events and assert scheduler stop begins
before primary paper-session stop.

- [x] **Step 2: Run the server tests and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/server.test.ts
```

Expected: type or assertion failure because the new `BuildServerOptions` and lifecycle wiring are
absent.

- [x] **Step 3: Add server options and default composition**

Add these options:

```ts
researchControlStudyScheduler?: ResearchControlStudySchedulerLifecycle;
researchControlStudyPollIntervalMs?: number;
researchControlStudyWorkspaceRoot?: string;
researchControlStudyArmSessionFactory?: ReturnType<
  typeof createResearchControlStudyArmSessionFactory>;
runResearchControlStudiesOnStart?: boolean;
onResearchControlStudySchedulerCreated?: (
  scheduler: ResearchControlStudySchedulerLifecycle
) => void;
```

The default arm factory must create a fresh adapter registry for each arm-local store, allow only
that arm's `candidate-arena-runs` artifact root for deterministic fixtures, reuse the server's public
market data, paper-only provider factory/options, artifact resolver, and configured paper intervals,
and add no private/live binding.

After store initialization and paper-session recovery, create or accept the scheduler, invoke the
observer, and start it unless explicitly disabled. In `onClose`, await scheduler stop before
CandidateArena, autonomous paper starts, and the primary paper-session service are stopped.

- [x] **Step 4: Run server and runtime-focused tests**

Run:

```bash
npx vitest run apps/runtime/test/server.test.ts apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts apps/runtime/test/research-control-study-runtime.test.ts
```

Expected: all files pass.

- [x] **Step 5: Commit Task 3**

```bash
git add apps/runtime/src/server.ts apps/runtime/test/server.test.ts
git commit -m "feat: run research studies with the server"
```

---

### Task 4: Durable Truth And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/superpowers/specs/2026-07-13-research-control-study-server-scheduler-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-research-control-study-server-scheduler.md`

**Interfaces:**
- Consumes: verified scheduler and server behavior.
- Produces: canonical implementation posture, explicit remaining cross-process boundary, and final evidence.

- [x] **Step 1: Update current implementation posture**

State only what tests prove: default server auto-start, bounded polling, exact persisted-condition
reconstruction, one active process-local study, failure halt, and shutdown drain. Remove `server
auto-start` and `long polling` from current gaps. Keep cross-process lease, automatic study
commitment, policy decision, promotion, champion handoff, real-market regimes, and long soak open.

- [x] **Step 2: Run focused and full validation**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts apps/runtime/test/research-control-study-process-supervisor.test.ts apps/runtime/test/research-control-study-runtime.test.ts apps/runtime/test/server.test.ts
npm test
npm run typecheck
npm run check:repo-guards
```

Expected: zero failing tests, zero type errors, and every repository guard passes.

- [x] **Step 3: Inspect and commit final durable truth**

```bash
git status --short
git diff --check
git add README.md ARCHITECTURE.md docs/project-direction.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/superpowers/specs/2026-07-13-research-control-study-server-scheduler-design.md docs/superpowers/plans/2026-07-13-research-control-study-server-scheduler.md
git commit -m "docs: record study server scheduling"
```

- [x] **Step 4: Promotion review**

Confirm only `.superpowers/` remains untracked, list the implementation commits, and select
persisted cross-process study ownership as the next frontier rather than claiming P0 or Goal
completion.
