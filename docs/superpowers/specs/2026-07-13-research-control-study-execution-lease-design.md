# ResearchControlStudy Execution Lease Design

**Status:** Approved for implementation under the standing autonomous Goal mandate

## Goal

Prevent two Ouroboros runtime-server processes on the same host and LocalStore root from opening
the same pending `ResearchControlStudy` concurrently. Ownership must be persisted, renewable,
inspectable, safely releasable, and recoverable after a confirmed owner-process exit without adding
research, evaluation, policy, promotion, order, private, or live authority.

## Why This Frontier Is Next

`ResearchControlStudyScheduler` now gives one server process continuous ownership of committed
study work. `ResearchControlStudyProcessSupervisor` still discovers from shared study/outcome
evidence without a cross-process claim. Two servers pointed at one LocalStore can therefore both
discover the same oldest pending study and start duplicate provider, sandbox, and paper effects.

The scheduler design identified a persisted lease as the next ownership boundary. A time-only
lease is insufficient: an event-loop pause can let another process take over while the original
process and its children are still alive. This design sacrifices availability when liveness is
unknown and permits takeover only when both the lease is expired and the same-host owner PID is no
longer alive.

## Scope

This frontier covers multiple local runtime processes sharing one filesystem-backed LocalStore on
the same host. It does not claim multi-host distributed consensus, container-namespace identity,
network-partition tolerance, or a generic durable-job subsystem.

The active lease coordinates runtime ownership only. `ResearchControlStudy`, campaign, paper,
Finding, Lineage, allocation-policy, and promotion records remain the sole evidence and authority
sources for their existing domains.

## Considered Approaches

### Time-only JSON lease

Rejected. Expiry alone cannot prove the previous process stopped. A paused process could resume
after takeover and overlap provider or sandbox effects.

### In-memory mutex or per-LocalStore promise queue

Rejected. Existing LocalStore write queues serialize one JavaScript object only and do not protect
two processes.

### Generic job queue or external database

Rejected for this frontier. Ouroboros has one exact ownership problem and a filesystem Store. A
generic queue widens architecture, deployment, and authority without strengthening current study
semantics.

### OS-native advisory lock dependency

Rejected for now. The repository has no portable advisory-lock dependency, and native `flock`
support is not uniform across current macOS and container paths. The narrow directory-claim
protocol can be tested directly with two independent adapter instances.

### Same-host renewable execution lease with confirmed-dead takeover

Selected. Atomic directory creation elects one owner. Exact owner metadata and heartbeat expiry are
persisted. A contender waits while the owner is alive or liveness is unknown. Only an expired lease
whose same-host PID is confirmed absent may move through atomic takeover.

## Canonical Vocabulary

Add `ResearchControlStudyExecutionLease` as the canonical operational noun.

- `ExecutionLease` is the conventional runtime-coordination term.
- `ResearchControlStudy` fixes the exact scope and avoids a generic job abstraction.
- `owner` carries server-instance, host, and process identity as fields rather than in the noun.
- `lease_token` is an opaque fencing identity for one acquisition.
- `lease_status` is `active`, `released`, or `expired`.

Do not rename `ResearchControlStudyProcessSupervisor` or
`ResearchControlStudyScheduler`. The scheduler starts process cycles, the supervisor owns queue
order, and the execution lease owns same-host cross-process exclusion.

## Persisted Record

Add a domain `ResearchControlStudyExecutionLeaseRecord`:

```ts
interface ResearchControlStudyExecutionLeaseRecord extends BaseRecord {
  record_kind: "research_control_study_execution_lease";
  research_control_study_execution_lease_id: string;
  study_ref: Ref;
  study_digest: string;
  owner: {
    server_instance_id: string;
    host_id: string;
    process_id: number;
  };
  lease_token: string;
  lease_status: "active" | "released" | "expired";
  lease_duration_ms: number;
  acquired_at: string;
  renewed_at: string;
  expires_at: string;
  closed_at?: string;
  close_reason?: "owner_released" | "expired_owner_absent";
  lease_digest: string;
  runtime_coordination_authority: true;
  evaluation_authority: false;
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "runtime_coordination_only";
}
```

The ID includes the study identity plus an opaque token-derived suffix. Active renewal replaces one
active snapshot atomically; it is operational state, not append-only evaluation evidence. Release
or takeover writes one immutable terminal snapshot to history before removing the active claim.
The digest covers every field except record envelope identity and `lease_digest`, following current
domain digest conventions.

## Port And Adapter

Add a focused `ResearchControlStudyExecutionLeasePort` in `packages/application` with four
operations:

```ts
acquire(input): Promise<
  | { status: "acquired"; lease: ResearchControlStudyExecutionLeaseRecord }
  | { status: "held"; lease: ResearchControlStudyExecutionLeaseRecord;
      reason: "owner_alive" | "owner_liveness_unknown" | "transition" }
>;
renew(input): Promise<ResearchControlStudyExecutionLeaseRecord>;
assertOwned(input): Promise<ResearchControlStudyExecutionLeaseRecord>;
release(input): Promise<ResearchControlStudyExecutionLeaseRecord>;
```

Implement the filesystem adapter in `packages/local-store` because LocalStore owns the physical
root and JSON persistence policy. It receives an injected exact clock, token factory, and owner
liveness probe for deterministic tests.

### Physical layout

```text
<store>/research-control-study-execution-leases/
  active/<sha256-study-id>.lock/lease.json
  transitions/<sha256-study-id>.lock/lease.json
  history/items/<encoded-lease-id>.json
```

`mkdir(active)` is the initial atomic claim. Renewal writes a unique temporary file inside the
active directory and renames it over `lease.json`. Release and takeover first rename the active
directory to the canonical transition directory. Every claimant treats a transition as held until
it is safely recovered.

### Transition recovery

- If an active claim exists with a different token, archive or remove the completed transition and
  preserve the active owner.
- If no active claim exists and the transitioned owner is alive or liveness is unknown, restore the
  transition to active.
- If no active claim exists, the transition is expired, and the owner is confirmed absent, archive
  it as `expired` and remove the transition before a new atomic claim.
- If a terminal history file already exists, require exact equality and continue idempotently.
- Corrupt or ambiguous state fails closed; it is never treated as an absent owner.

## Liveness And Takeover

The server owner identity is:

```text
server_instance_id = random UUID for this buildServer instance
host_id = os.hostname()
process_id = process.pid
```

The default liveness probe returns:

- `alive` when the record host matches and `process.kill(pid, 0)` succeeds or returns `EPERM`;
- `absent` when the record host matches and the PID returns `ESRCH`;
- `unknown` for a different host or any ambiguous platform error.

Takeover requires exact lease expiry and `absent`. `alive` and `unknown` both remain held. PID reuse
may delay recovery but cannot create overlap, which is the required fail-closed tradeoff.

The default lease duration is 30 seconds and renewal interval is 10 seconds. Both are runtime
resource bounds, not research or evaluation policy. Require finite positive integers and renewal
strictly below half the duration.

## Runtime Session

Add `ResearchControlStudyExecutionLeaseSession` in `apps/runtime`:

1. it owns one acquired record;
2. it renews at the bounded interval with an unreferenced timer;
3. `guard()` asserts the exact active token and owner before every study-executor advance;
4. renewal or guard failure becomes terminal `research_control_study_execution_lease_lost`;
5. lease loss requests runner stop and prevents a later replication or adjudication action;
6. graceful completion, failure, or server stop archives an exact `released` record;
7. release failure halts the process supervisor rather than silently freeing later work.

The same-host liveness rule prevents takeover while the old process is alive, including while one
campaign action drains. Existing restart recovery still stops unowned provider/sandbox attempts
before new effects after a confirmed process exit.

## Supervisor And Scheduler Composition

Extend `ResearchControlStudyProcessSupervisor` with an optional lease-session factory:

- claim the oldest pending study before `openStudy`;
- on `held`, return `contended` without opening that study or skipping to a later study;
- pass `guard` into `openStudy` and the study runner;
- start renewal before the runner;
- on lease loss, stop and drain the runner, then fail with the lease error;
- release after runner terminal handling and exact outcome reload;
- release on open failure, runner failure, and graceful supervisor stop.

`ResearchControlStudyScheduler` treats `contended` like `caught_up`: accumulate no completed study,
wait one bounded poll interval, and retry. It still fails on malformed status or lease corruption.

`buildServer` creates the default filesystem lease adapter and session factory. Tests may inject a
lease port, owner identity, duration, and renewal interval. No public command or UI is added.

## Failure Semantics

- Active owner alive: contender waits.
- Owner liveness unknown: contender waits.
- Expired owner confirmed absent: one contender atomically takes over.
- Active token, digest, owner, study, or transition mismatch: fail closed.
- Renewal failure: mark session lost, stop the runner, and halt the supervisor.
- Release failure: halt; do not start a later study.
- Study outcome already terminal after owner death: process discovery excludes it, while transition
  recovery archives the old lease without rerunning the study.
- No lease event becomes research performance, Finding, rank, allocation, or promotion evidence.

## Tests

### Domain and adapter

- exact active/released/expired shapes and digest inputs;
- two independent adapters racing for one study produce exactly one owner;
- alive and unknown owners cannot be taken over after expiry;
- confirmed-absent expired owner is archived and replaced once;
- renewal extends exact expiry and stale token renew/assert/release fail;
- release archives exact owner evidence and permits a later claim;
- transition recovery is idempotent after each crash boundary;
- corrupt active, transition, or history records fail closed.

### Runtime session and supervisor

- bounded renewal and interruptible release;
- guard failure stops before the next executor advance;
- contended oldest study opens no runtime and does not skip later work;
- acquired lease wraps open, run, completion reload, and release;
- open, runner, stop, and release failures preserve stable attribution;
- scheduler waits and retries after contention without busy polling.

### Server

- default server supplies one exact owner identity and lease policy;
- two servers sharing one root cannot both open the same pending study;
- server shutdown releases before shared runtime dependencies stop;
- explicit injection remains available for deterministic tests.

## Non-Goals

- no multi-host distributed consensus or network-partition claim;
- no automatic ResearchControlStudy commitment;
- no generic queue, job, worker, or cron schema;
- no provider-process adoption across a live owner;
- no policy decision, TradingPromotion, champion handoff, private exchange, or live authority;
- no claim that this completes P0 or the overall Goal.

## Acceptance Criteria

1. Two same-host server processes sharing one LocalStore cannot open the same study concurrently.
2. A live or unknown owner is never displaced solely because time elapsed.
3. A confirmed-dead expired owner can be taken over exactly once with terminal owner history.
4. Every study action is preceded by an exact active-token guard.
5. Lease loss or corrupt coordination state halts without skipping or producing research evidence.
6. Graceful completion, failure, and shutdown release exact ownership before later work starts.
7. Scheduler contention waits without overlap or busy polling.
8. Focused races, full tests, type checks, and repository guards pass.

## Remaining Boundary

This closes same-host filesystem-backed cross-process ownership. Multi-host shared storage,
container PID-namespace ambiguity, distributed fencing, automatic study commitment, automatic
policy decisions, real-market regime replication, and longitudinal autonomous soak remain open.
