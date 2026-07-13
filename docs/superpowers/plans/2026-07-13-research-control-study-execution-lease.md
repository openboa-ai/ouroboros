# ResearchControlStudy Execution Lease Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give one same-host runtime-server process exclusive, renewable, persisted ownership of a pending `ResearchControlStudy`, with confirmed-dead takeover and exact terminal owner history.

**Architecture:** Domain functions own the exact lease record and digest. A focused filesystem adapter under `packages/local-store` uses atomic active/transition directories, while a runtime lease session renews and guards study actions. The existing process supervisor and server scheduler consume this optional ownership boundary without duplicating discovery or study execution.

**Tech Stack:** TypeScript, Node filesystem atomics, LocalStore root layout, Vitest, Fastify lifecycle, existing ResearchControlStudy runtime.

## Global Constraints

- Same-host processes sharing one filesystem LocalStore are the only ownership scope.
- Takeover requires both exact expiry and confirmed absent same-host PID; alive or unknown waits.
- Lease records are runtime coordination, never research, evaluation, ranking, policy, or promotion evidence.
- No generic job queue, external database, new dependency, public command, private exchange, or live authority.
- The oldest contended study is not skipped for later work.
- Every task follows RED, observed expected failure, minimal GREEN, focused regression, and commit.
- Multi-host distributed fencing, automatic study commitment, policy decision, promotion, and champion handoff remain out of scope.

---

### Task 1: Exact Lease Domain And Focused Port

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/research-control-study-execution-lease.test.ts`
- Create: `packages/application/src/ports/research-control-study-execution-lease.ts`

**Interfaces:**
- Consumes: `ResearchControlStudyRecord`, `Ref`, and `paperTradingComparisonPersistedRecordDigestInput`.
- Produces: `ResearchControlStudyExecutionLeaseRecord`, decision/renew/close functions, digest/runtime-shape helpers, and `ResearchControlStudyExecutionLeasePort`.

- [ ] **Step 1: Write failing domain tests**

Cover exact active, renewed, released, and expired records; deterministic ID/digest; authority
closure; malformed owner/PID/token/time/status pairs; non-active renewal/closure; and non-monotonic
time. Use this public surface:

```ts
const active = decideResearchControlStudyExecutionLease({
  study,
  owner: {
    server_instance_id: "server-a",
    host_id: "host-a",
    process_id: 101
  },
  leaseToken: "lease-token-a",
  leaseDurationMs: 30_000,
  acquiredAt: "2026-07-13T00:00:00.000Z"
});
const renewed = renewResearchControlStudyExecutionLease({
  lease: active,
  renewedAt: "2026-07-13T00:00:10.000Z"
});
const released = closeResearchControlStudyExecutionLease({
  lease: renewed,
  leaseStatus: "released",
  closedAt: "2026-07-13T00:00:11.000Z"
});
expect(researchControlStudyExecutionLeaseHasRuntimeShape(released)).toBe(true);
```

- [ ] **Step 2: Run domain tests and verify RED**

Run:

```bash
npx vitest run packages/domain/src/research-control-study-execution-lease.test.ts
```

Expected: import failure because the new domain surface does not exist.

- [ ] **Step 3: Implement the exact domain record**

Add the record and owner interfaces from the design, plus:

```ts
export function decideResearchControlStudyExecutionLease(input: {
  study: ResearchControlStudyRecord;
  owner: ResearchControlStudyExecutionLeaseOwner;
  leaseToken: string;
  leaseDurationMs: number;
  acquiredAt: string;
}): ResearchControlStudyExecutionLeaseRecord;

export function renewResearchControlStudyExecutionLease(input: {
  lease: ResearchControlStudyExecutionLeaseRecord;
  renewedAt: string;
}): ResearchControlStudyExecutionLeaseRecord;

export function closeResearchControlStudyExecutionLease(input: {
  lease: ResearchControlStudyExecutionLeaseRecord;
  leaseStatus: "released" | "expired";
  closedAt: string;
}): ResearchControlStudyExecutionLeaseRecord;

export function researchControlStudyExecutionLeaseDigestInput(
  lease: ResearchControlStudyExecutionLeaseRecord
): string;

export function researchControlStudyExecutionLeaseHasRuntimeShape(
  value: unknown
): value is ResearchControlStudyExecutionLeaseRecord;
```

Require exact ISO instants, positive integer PID and duration, `expires_at === renewed_at +
lease_duration_ms`, active records without close fields, and terminal records with the matching
close reason. Compute the opaque lease ID from study ID plus token without exposing raw token in a
path requirement.

- [ ] **Step 4: Add the focused application port**

Define owner liveness and result types plus:

```ts
export interface ResearchControlStudyExecutionLeasePort {
  acquire(input: {
    study: ResearchControlStudyRecord;
    owner: ResearchControlStudyExecutionLeaseOwner;
    leaseDurationMs: number;
  }): Promise<
    | { status: "acquired"; lease: ResearchControlStudyExecutionLeaseRecord }
    | {
        status: "held";
        lease: ResearchControlStudyExecutionLeaseRecord;
        reason: "owner_alive" | "owner_liveness_unknown" | "transition";
      }
  >;
  renew(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord>;
  assertOwned(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord>;
  release(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord>;
}
```

- [ ] **Step 5: Verify and commit Task 1**

Run the focused test and domain/application type checks, then:

```bash
git add packages/domain/src/index.ts packages/domain/src/research-control-study-execution-lease.test.ts packages/application/src/ports/research-control-study-execution-lease.ts
git commit -m "feat: define study execution lease"
```

---

### Task 2: Atomic Filesystem Lease Adapter

**Files:**
- Create: `packages/local-store/src/research-control-study-execution-lease-store.ts`
- Modify: `packages/local-store/src/index.ts`
- Create: `packages/local-store/test/research-control-study-execution-lease-store.test.ts`

**Interfaces:**
- Consumes: Task 1 domain decisions and structural `ResearchControlStudyExecutionLeasePort` contract.
- Produces: `FileSystemResearchControlStudyExecutionLeaseStore` and same-host owner liveness helper.

- [ ] **Step 1: Write failing adapter race and lifecycle tests**

Use two independent adapter instances over one temporary root. Cover:

```ts
const [left, right] = await Promise.all([
  leftStore.acquire({ study, owner: owner("left", 101), leaseDurationMs: 30_000 }),
  rightStore.acquire({ study, owner: owner("right", 202), leaseDurationMs: 30_000 })
]);
expect([left.status, right.status].sort()).toEqual(["acquired", "held"]);
```

Also prove renewal, exact-token assertion, stale-token rejection, alive/unknown expired contention,
confirmed-absent takeover, immutable expired/released history, later reacquisition, corrupt-state
failure, and transition recovery after these injected crash boundaries:

- active renamed to transition before archive;
- terminal history written before transition removal;
- new active written while old transition remains.

- [ ] **Step 2: Run adapter tests and verify RED**

Run:

```bash
npx vitest run packages/local-store/test/research-control-study-execution-lease-store.test.ts
```

Expected: import failure because the filesystem adapter does not exist.

- [ ] **Step 3: Implement layout and atomic claim**

Implement:

```ts
export class FileSystemResearchControlStudyExecutionLeaseStore {
  constructor(root: string, options?: {
    now?: () => string;
    leaseToken?: () => string;
    ownerLiveness?: (
      owner: ResearchControlStudyExecutionLeaseOwner
    ) => Promise<"alive" | "absent" | "unknown">;
  });
  acquire(...): ReturnType<ResearchControlStudyExecutionLeasePort["acquire"]>;
  renew(...): ReturnType<ResearchControlStudyExecutionLeasePort["renew"]>;
  assertOwned(...): ReturnType<ResearchControlStudyExecutionLeasePort["assertOwned"]>;
  release(...): ReturnType<ResearchControlStudyExecutionLeasePort["release"]>;
}
```

Use SHA-256 study path keys, unique temporary record files, atomic `mkdir` and `rename`, canonical
active/transition directories, exact digest reload, and `writeFile(..., { flag: "wx" })` for
terminal history. Never interpret unreadable data as no lease.

- [ ] **Step 4: Implement confirmed-dead takeover and transition recovery**

Acquisition must run this order:

```text
recover canonical transition
read exact active
if absent -> atomic mkdir claim
if active and not expired -> held
if expired -> owner liveness
if alive/unknown -> held
if absent -> rename active to transition, revalidate, archive expired, remove transition, retry claim
```

Default liveness uses `os.hostname()` and `process.kill(pid, 0)`, mapping `ESRCH` to absent,
success/`EPERM` to alive, and all different-host or ambiguous states to unknown.

- [ ] **Step 5: Verify and commit Task 2**

Run the adapter test, LocalStore tests scoped to study records, and local-store typecheck, then:

```bash
git add packages/local-store/src/research-control-study-execution-lease-store.ts packages/local-store/src/index.ts packages/local-store/test/research-control-study-execution-lease-store.test.ts
git commit -m "feat: persist study execution leases"
```

---

### Task 3: Renewable Runtime Lease Session

**Files:**
- Create: `apps/runtime/src/candidate/arena/research-control-study-execution-lease-session.ts`
- Create: `apps/runtime/test/research-control-study-execution-lease-session.test.ts`

**Interfaces:**
- Consumes: Task 1 port and Task 2 adapter-compatible results.
- Produces: session factory, acquired session lifecycle, stable loss status, and supervisor-facing claim result.

- [ ] **Step 1: Write failing session tests**

Use a scripted port and deferred sleep. Cover acquire/held projection, immediate exact guard,
bounded renewal, duplicate start, interruptible release, guard loss, renewal loss, callback once,
release failure, and invalid duration/interval. The primary surface is:

```ts
const factory = createResearchControlStudyExecutionLeaseSessionFactory({
  port,
  owner,
  leaseDurationMs: 30_000,
  renewalIntervalMs: 10_000,
  sleep: clock.sleep
});
const claim = await factory.acquire(study);
if (claim.status !== "acquired") throw new Error("expected acquired");
claim.session.start((error) => losses.push(error.code));
await claim.session.guard();
await claim.session.stopAndRelease();
```

- [ ] **Step 2: Run session tests and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-execution-lease-session.test.ts
```

Expected: import failure because the session module does not exist.

- [ ] **Step 3: Implement the session and factory**

Expose:

```ts
export interface ResearchControlStudyExecutionLeaseSessionLifecycle {
  start(onLost: (error: ResearchControlStudyExecutionLeaseSessionError) => void):
    "started" | "already_running";
  guard(): Promise<void>;
  stopAndRelease(): Promise<ResearchControlStudyExecutionLeaseRecord>;
  status(): ResearchControlStudyExecutionLeaseSessionStatus;
}

export function createResearchControlStudyExecutionLeaseSessionFactory(options: {
  port: ResearchControlStudyExecutionLeasePort;
  owner: ResearchControlStudyExecutionLeaseOwner;
  leaseDurationMs?: number;
  renewalIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}): ResearchControlStudyExecutionLeaseSessionFactory;
```

Use an interruptible stop signal raced with an unreferenced default sleep. Update the in-memory
exact lease after every successful renew/assert. Any mismatch or port failure becomes
`research_control_study_execution_lease_lost`, stops renewal, and invokes `onLost` once. Release is
permitted only from a non-lost exact session and is idempotent after success.

- [ ] **Step 4: Verify and commit Task 3**

Run focused tests and runtime typecheck, then:

```bash
git add apps/runtime/src/candidate/arena/research-control-study-execution-lease-session.ts apps/runtime/test/research-control-study-execution-lease-session.test.ts
git commit -m "feat: renew study execution ownership"
```

---

### Task 4: Supervisor, Runner, And Scheduler Ownership

**Files:**
- Modify: `apps/runtime/src/candidate/arena/research-control-study-runner.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-runtime.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-process-supervisor.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-scheduler.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts`
- Modify: `apps/runtime/test/research-control-study-runner.test.ts`
- Modify: `apps/runtime/test/research-control-study-process-supervisor.test.ts`
- Modify: `apps/runtime/test/research-control-study-scheduler.test.ts`
- Modify: `apps/runtime/test/research-control-study-server-runtime.test.ts`

**Interfaces:**
- Consumes: Task 3 lease-session factory and lifecycle.
- Produces: oldest-study contention, guarded executor advances, renewal-loss halt, and exact release around process execution.

- [ ] **Step 1: Write failing guard and contention tests**

Add runner tests proving `beforeAdvance` runs before every executor call and a guard failure prevents
that call. Add supervisor tests proving:

- held oldest study yields `contended` and opens no runtime or later study;
- acquired session starts before runner effects and releases after persisted completion;
- open failure, runner failure, graceful stop, and exact completion each release;
- lease loss stops the active runner and returns the stable lease error;
- release failure halts before later work.

Add scheduler tests proving `contended` enters one bounded wait and retries without failure.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-runner.test.ts apps/runtime/test/research-control-study-process-supervisor.test.ts apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts
```

Expected: type/assertion failures because guard, lease factory, and `contended` status are absent.

- [ ] **Step 3: Add guarded runner and runtime composition**

Extend the runner constructor with optional `beforeAdvance(): Promise<void>` and call it immediately
before each `executor.advance`. Extend `createResearchControlStudyRuntime` campaign input with the
guard and pass it to the runner. The server runtime must receive supervisor ownership context and
forward the exact guard without changing campaign policy.

- [ ] **Step 4: Add lease-aware supervisor lifecycle**

Extend supervisor options structurally:

```ts
leaseSessionFactory?: ResearchControlStudyExecutionLeaseSessionFactory;
openStudy(
  study: ResearchControlStudyRecord,
  ownership?: { guard(): Promise<void> }
): ResearchControlStudyProcessRuntime | Promise<ResearchControlStudyProcessRuntime>;
```

Add `contended` to process status with study ID, reason, and lease expiry but no token. Acquire before
open, start renewal before runner, stop on loss, and call `stopAndRelease` exactly once on every
terminal path. A held oldest study returns; it never scans the next item.

- [ ] **Step 5: Teach scheduler and server-runtime factory about contention**

Treat `contended` as a successful zero-completion process cycle followed by the normal poll wait.
Pass the optional lease-session factory through `createResearchControlStudyServerScheduler`; keep
the existing discovery implementation as the only queue source.

- [ ] **Step 6: Verify and commit Task 4**

Run the focused command, study runtime/process discovery tests, and runtime typecheck, then:

```bash
git add apps/runtime/src/candidate/arena/research-control-study-runner.ts apps/runtime/src/candidate/arena/research-control-study-runtime.ts apps/runtime/src/candidate/arena/research-control-study-process-supervisor.ts apps/runtime/src/candidate/arena/research-control-study-scheduler.ts apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts apps/runtime/test/research-control-study-runner.test.ts apps/runtime/test/research-control-study-process-supervisor.test.ts apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts
git commit -m "feat: lease research study execution"
```

---

### Task 5: Server Defaults, Durable Truth, And Full Verification

**Files:**
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/test/server.test.ts`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-13-research-control-study-execution-lease-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-research-control-study-execution-lease.md`

**Interfaces:**
- Consumes: verified Task 2 adapter and Task 3 session factory.
- Produces: default same-host server ownership, explicit DI, canonical docs, and final validation evidence.

- [ ] **Step 1: Write failing server composition tests**

Add `BuildServerOptions` expectations for injected lease port/session factory, owner identity,
duration, and renewal interval. Prove one exact owner is reused by the server scheduler, invalid
policy rejects construction, and scheduler shutdown still precedes paper dependencies. Keep normal
API tests on the explicit scheduler-disabled path.

- [ ] **Step 2: Run server tests and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/server.test.ts
```

Expected: type/assertion failure because server lease composition options do not exist.

- [ ] **Step 3: Compose default lease ownership**

Create the default adapter with `store.root()`, owner `{ randomUUID(), hostname(), process.pid }`,
30-second duration, and 10-second renewal. Build the session factory once per server and pass it to
`createResearchControlStudyServerScheduler`. Support explicit injected port, factory, owner, and
policy for tests without exposing a public command.

- [ ] **Step 4: Update durable repo truth**

Record only proven claims: same-host shared-LocalStore exclusion, alive/unknown fail-closed wait,
confirmed-dead expired takeover, action guard, terminal owner history, and shutdown release. Add the
canonical taxonomy row. Keep multi-host fencing, PID namespace ambiguity, automatic commitment,
policy decision, real-market regimes, promotion, handoff, soak, P0, and Goal completion open.

- [ ] **Step 5: Run full verification**

Run:

```bash
npx vitest run
npm run typecheck
npm run check:repo-guards
```

Expected: zero failing tests, zero type errors, and all repository guards green.

- [ ] **Step 6: Promotion review and commit**

Confirm only `.superpowers/` remains untracked, select automatic bounded study commitment as the
next core-autonomy frontier, and commit:

```bash
git add apps/runtime/src/server.ts apps/runtime/test/server.test.ts README.md ARCHITECTURE.md docs/project-direction.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-13-research-control-study-execution-lease-design.md docs/superpowers/plans/2026-07-13-research-control-study-execution-lease.md
git commit -m "feat: own studies across local processes"
```
