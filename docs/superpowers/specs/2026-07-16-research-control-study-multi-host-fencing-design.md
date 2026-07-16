# ResearchControlStudy Multi-Host Fencing Design

**Status:** Approved for implementation by the standing goal-based execution contract

## Goal

Allow multiple Ouroboros runtime hosts to share one `LocalStore` root while ensuring that only the
current owner of a `ResearchControlStudy` can publish research-control or nested paper effects.
Expiry and takeover must remain available without trusting remote PID liveness, and a delayed old
owner must be rejected after a newer owner acquires the study.

This is runtime coordination evidence only. A fencing token never changes rank, Finding,
allocation, evaluation, promotion, order, private, or live authority.

## Existing Gap

The current filesystem lease is deliberately same-host:

- a different host has `unknown` liveness and therefore cannot take over an expired lease;
- `guard()` runs before an executor advance, leaving a time-of-check/time-of-use window;
- `lease_token` is an opaque acquisition identity, not a monotonic fencing token;
- the coordinator and arm `LocalStore` publications do not validate ownership at commit time.

Consequently, a paused process can pass its pre-advance guard, lose ownership later, resume, and
publish evidence after a replacement owner starts.

## Threat Model

The fence must handle:

- two hosts racing for one study;
- lease expiry while an owner is paused or partitioned from the shared root;
- delayed work resuming after takeover;
- host restart, process restart, and PID reuse;
- a coordination transaction that is temporarily busy or whose state is malformed.

All hosts must address the same durable root and that root must provide one coherent SQLite/POSIX
locking domain. A split-brain filesystem, independently copied roots, Byzantine host, or external
provider that ignores Ouroboros authority is outside this adapter's proof. Locking or storage
ambiguity fails closed; it is never converted into a second owner.

## Considered Approaches

### Global runtime lock

Rejected. It would serialize unrelated studies and paper work, reduce availability, and turn a
narrow ownership boundary into a deployment-wide rule.

### Time-only lease plus pre-action assertion

Rejected. Expiry enables failover but does not stop a delayed owner from writing after takeover.

### Add the token to business ranking and evidence rules

Rejected. Fencing is a capability and commit-order concern, not research authority. Mixing it into
ranking or promotion would make infrastructure state affect scientific results.

### Per-study monotonic token plus commit-time serialization

Selected. A shared coordination adapter allocates an integer token and serializes acquire, renew,
release, takeover, and each guarded publication. A publication either linearizes before takeover
under the old token or begins after takeover and is rejected. There is no check-then-write gap.

## Domain Contract

`ResearchControlStudyExecutionLeaseRecord` gains:

```ts
fencing_token: number;
```

The value is a positive safe integer, is stable through renewal and release, and increases for
every acquisition of the same study. `lease_token` remains the opaque acquisition nonce. An
expired lease closed by the distributed adapter uses `expired_fenced_takeover`; the same-host
adapter retains `expired_owner_absent`.

The application port gains one capability operation:

```ts
withFencedWrite<T>(input: {
  lease: ResearchControlStudyExecutionLeaseRecord;
  write: () => Promise<T>;
}): Promise<T>;
```

The callback is not arbitrary transaction authority. It is the adapter boundary needed to keep
the ownership check and one already-validated `LocalStore` publication in the same serialized
critical section.

## Shared Adapter

Add `SharedSqliteResearchControlStudyExecutionLeaseStore` in `packages/local-store`.

It stores, under the shared root:

```text
research-control-study-execution-leases/shared-fence.sqlite
```

The database has one per-study row containing the frozen study digest, last allocated fencing
token, and optional active lease JSON, plus immutable terminal lease history keyed by lease ID.
Every mutation uses `BEGIN IMMEDIATE`, `journal_mode=DELETE`, and `synchronous=FULL`.

Acquire behavior:

1. serialize on the shared database;
2. reject study-digest drift or malformed persisted state;
3. return held while the active lease is unexpired;
4. when expired, archive it as `expired_fenced_takeover` without remote PID inference;
5. increment the per-study token and publish exactly one active lease;
6. commit before returning ownership.

Guarded write behavior:

1. serialize on the same database;
2. require the exact study, lease ID, owner, nonce, and fencing token;
3. require that the lease was unexpired at the write linearization point;
4. execute one `LocalStore` publication while takeover is excluded;
5. commit the coordination transaction, or roll it back and propagate the write failure.

If the write started while valid and spans expiry, takeover waits. The write therefore linearizes
before takeover. If takeover commits first, the old token cannot enter the callback.

The existing `FileSystemResearchControlStudyExecutionLeaseStore` remains the single-host adapter.
It allocates monotonic tokens from its active/history state and implements guarded writes using its
confirmed-same-host liveness rule. The runtime server defaults to the shared adapter.

## LocalStore Integration

`LocalStore` accepts an optional write transaction decorator and can open another root while
preserving that decorator. Both common publication primitives, replace and create-only, execute
inside it. Existing validation, append-only identities, and authority checks remain unchanged.

When a study lease is acquired, `openResearchControlStudyServerRuntime` creates a fenced view of
the coordinator store. Campaign arm stores inherit the same decorator even though their files live
under separate roots. This covers coordinator records, CandidateArena arm evidence, paper records,
Gateway/Ledger records written through those stores, and terminal study outcomes.

Workspace copies and provider computation are not promoted to evidence by the fence. A delayed
external computation may finish, but its post-takeover durable publication is rejected. Existing
lease-loss handling still requests runner stop and child cleanup.

## Failure Semantics

- Unexpired owner: contender receives held and waits.
- Expired owner with no active guarded write: one contender takes over with token `n + 1`.
- Guarded write already linearized: takeover waits and occurs after that write.
- Delayed old token after takeover: callback is never entered; ownership is lost.
- Busy, unreadable, malformed, or digest-drifted coordination state: fail closed.
- Renewal or guarded-write failure: session becomes terminal and supervisor cleanup runs.
- PID reuse and process restart: owner metadata may repeat partially, but nonce and monotonic token
  cannot match the new acquisition.

## Validation

- domain tests for monotonic token shape, digest, renewal, and close reasons;
- two adapter instances modeling separate hosts and racing for one study;
- expiry/takeover with a live or unknown old host;
- a blocked old writer that linearizes before takeover;
- a delayed old writer rejected after partition/heal and takeover;
- restart and PID-reuse fixtures proving the old nonce/token cannot publish;
- coordinator and arm `LocalStore` write-transaction tests;
- runtime session/server tests proving the default shared adapter and inherited guarded stores;
- existing single-host lease tests and repo-required validation.

## Non-Goals

- no generic distributed job system or global runtime lock;
- no split-brain storage or Byzantine consensus claim;
- no provider-session migration or adoption;
- no change to candidate generation, scoring, rank, allocation, promotion, or trading authority;
- no production-duration soak result; OURO-189 owns that evidence.

## Acceptance

The frontier is complete when deterministic two-host tests prove that every acquisition receives a
strictly increasing token, only one owner is active, and no old token can enter a durable write
after takeover, while all existing single-host and research behavior remains compatible.
